import { ROOM_BATTLEFIELDS, type RoomBattlefield } from '../../data/battlefields';
import {
  BERRY_IDS,
  BERRY_TREE_CAP,
  BERRY_TREE_MIN,
  CHEF_BERRY_COUNT,
  CHEF_DISH_ITEM_ID,
  MAGICIAN_TYPES,
  NPC_ROWS,
  type NpcRequirement,
  type NpcRow,
} from '../../data/npcs';
import type { Tile } from '../grid';
import { isWalkable, type TileMap } from '../map';
import { firstTrainerRoom, type MapPlan } from '../maps/plan';
import { Rng, hashSeed } from '../rng';
import { healParty } from '../run/heal';
import { partyHasAbility, partyHasMove, partyHasType } from '../run/party';
import {
  addItem,
  consumeItem,
  equipHeldItem,
  isItemPicked,
  itemCount,
  markItemPicked,
  memberById,
  type RunState,
} from '../run/state';
import {
  rollEncounter,
  type Encounter,
  type EncounterLevelRoll,
  type EncounterTable,
} from './encounters';
import { FACINGS, FACING_VECTORS, tileKey, type Facing, type RouteMap } from './routeMap';

/**
 * The special-NPC framework (`docs/maps-spec.md` §7, `docs/routes-spec.md` §2): one
 * trainer room holds at most one NPC, rolled per room build off its own stream so
 * no map, encounter, roster or battle draw moves (`D11`). Pure: no Phaser, no DOM,
 * no storage and no clock.
 */

/** What one room rolled. */
export type NpcPlacement = Readonly<{ row: NpcRow; roomIndex: number }>;

/** The chance scale the table's 0..1 numbers are rounded to, so two builds agree. */
const CHANCE_SCALE = 10_000;

/** The entry's four cardinal neighbours, which the NPC never stands on. */
const ENTRY_NEIGHBOURS: readonly Tile[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

/** The way each facing reads from the tile in front of it. */
const OPPOSITE: Readonly<Record<Facing, Facing>> = { N: 'S', E: 'W', S: 'N', W: 'E' };

/** True when `tile` has at least one cardinally unwalkable neighbour, so an NPC can put its back to it. */
function touchesWall(tiles: TileMap, tile: Tile): boolean {
  for (const facing of FACINGS) {
    const step = FACING_VECTORS[facing];
    if (!isWalkable(tiles, { x: tile.x + step.x, y: tile.y + step.y })) return true;
  }
  return false;
}

/**
 * The way an NPC on `tile` looks: back to the wall, front to the room. The wall is
 * the first one in the N, E, S, W order whose opposite side is walkable, so a corner
 * turns the NPC toward the room and not into the second wall. A tile walled on
 * opposite sides (a one-wide corridor) has no such wall at all, so the first open
 * cardinal in the same order wins and the facing still points at a walkable neighbour.
 */
function awayFromWall(tiles: TileMap, tile: Tile): Facing {
  for (const wall of FACINGS) {
    const step = FACING_VECTORS[wall];
    if (isWalkable(tiles, { x: tile.x + step.x, y: tile.y + step.y })) continue;
    const facing = OPPOSITE[wall];
    const front = FACING_VECTORS[facing];
    if (isWalkable(tiles, { x: tile.x + front.x, y: tile.y + front.y })) return facing;
  }
  for (const facing of FACINGS) {
    const step = FACING_VECTORS[facing];
    if (isWalkable(tiles, { x: tile.x + step.x, y: tile.y + step.y })) return facing;
  }
  return 'S';
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** `clamp01(row.chance + row.floorStep * (mapIndex - 1))`. */
export function effectiveNpcChance(row: NpcRow, mapIndex: number): number {
  return clamp01(row.chance + row.floorStep * (mapIndex - 1));
}

/** True when the run satisfies `requirement`; absent means true. Case-insensitive. */
export function npcRequirementMet(run: RunState, requirement: NpcRequirement | undefined): boolean {
  if (!requirement) return true;
  switch (requirement.kind) {
    case 'type':
      return partyHasType(run, requirement.types);
    case 'move':
      return partyHasMove(run, requirement.moves);
    case 'ability':
      return partyHasAbility(run, requirement.abilities);
    case 'missionsCompleted':
      return run.missionsCompleted >= requirement.min;
  }
}

/**
 * At most one NPC for `roomIndex`, or null. One `Rng.next()` for presence and, on a
 * hit, one `Rng.int` for the weighted row pick, on
 * `Rng(hashSeed(`${seed}:npc:${roomIndex}`))` — its own stream, so no map,
 * encounter, roster or battle draw moves (`D11`). Rows whose effective chance is 0
 * are left out of both the total and the pick, so a guaranteed row is never rolled.
 */
export function roomNpc(
  seed: string,
  roomIndex: number,
  mapIndex: number,
  rows: readonly NpcRow[] = NPC_ROWS,
): NpcPlacement | null {
  const usable: { row: NpcRow; weight: number }[] = [];
  for (const row of rows) {
    const weight = Math.round(effectiveNpcChance(row, mapIndex) * CHANCE_SCALE);
    if (weight > 0) usable.push({ row, weight });
  }
  let total = 0;
  for (const entry of usable) total += entry.weight;

  const rng = new Rng(hashSeed(`${seed}:npc:${roomIndex}`));
  const roll = rng.next() * CHANCE_SCALE;
  if (total === 0 || roll >= total) return null;

  const ticket = rng.int(0, total - 1);
  let cumulative = 0;
  for (const entry of usable) {
    cumulative += entry.weight;
    if (cumulative > ticket) return { row: entry.row, roomIndex };
  }
  return null;
}

/**
 * The floor's guaranteed NPC for `roomIndex`, or null: the first row, in table
 * order, whose `guaranteedFromMap` is defined and `<= mapIndex`, when
 * `roomIndex === firstTrainerRoom(plan)`. Reads **no RNG** and no run state, so
 * the placement cannot move any other stream (`docs/maps-spec.md` §7).
 */
export function guaranteedNpc(
  plan: MapPlan,
  roomIndex: number,
  mapIndex: number,
  rows: readonly NpcRow[] = NPC_ROWS,
): NpcRow | null {
  if (roomIndex !== firstTrainerRoom(plan)) return null;
  for (const row of rows) {
    if (row.guaranteedFromMap === undefined) continue;
    if (row.guaranteedFromMap <= mapIndex) return row;
  }
  return null;
}

/** `npc-<mapIndex>-<roomIndex>-<id>`, the per-floor `pickedItems` use record. */
export function npcUseId(mapIndex: number, roomIndex: number, npcId: string): string {
  return `npc-${mapIndex}-${roomIndex}-${npcId}`;
}

/**
 * The sky the weather man pins: one `Rng.int` on
 * `Rng(hashSeed(`${seed}:npc:${roomIndex}:${npcId}:field`))`, in table order. Its own
 * stream, so no map, encounter, roster or battle draw moves (`D11`).
 */
export function npcForcedField(seed: string, roomIndex: number, npcId: string): RoomBattlefield {
  const rng = new Rng(hashSeed(`${seed}:npc:${roomIndex}:${npcId}:field`));
  return ROOM_BATTLEFIELDS[rng.int(0, ROOM_BATTLEFIELDS.length - 1)];
}

/**
 * The type the magician narrows the grass to: one `Rng.int` on
 * `Rng(hashSeed(`${seed}:npc:${roomIndex}:${npcId}:type`))`, in `MAGICIAN_TYPES`
 * order, on its own stream beside `npcForcedField`'s (`D11`).
 */
export function npcWildType(seed: string, roomIndex: number, npcId: string): string {
  const rng = new Rng(hashSeed(`${seed}:npc:${roomIndex}:${npcId}:type`));
  return MAGICIAN_TYPES[rng.int(0, MAGICIAN_TYPES.length - 1)];
}

/** The tile the NPC stands on and the way it looks: back to the wall, front to the room. */
export type NpcSpot = Readonly<{ tile: Tile; facing: Facing }>;

/**
 * The free tile the NPC stands on and its facing, or null. Excludes the entry and
 * its four neighbours, every exit, walls, trainers and visible items; one `Rng.int`
 * on `Rng(hashSeed(`${seed}:npc:${roomIndex}:${npcId}:spot`))`. The candidates are the
 * free tiles that touch a wall, so the NPC's back can be to it; a room with none keeps
 * every free tile and faces `'S'`. The facing is derived from the chosen tile's walls,
 * never drawn, so the stream keeps its single draw (`D11`).
 */
export function npcSpot(
  route: RouteMap,
  roomIndex: number,
  seed: string,
  npcId: string,
): NpcSpot | null {
  const taken = new Set<string>([tileKey(route.entry)]);
  for (const step of ENTRY_NEIGHBOURS) {
    taken.add(tileKey({ x: route.entry.x + step.x, y: route.entry.y + step.y }));
  }
  for (const exit of route.exits) taken.add(tileKey(exit));
  for (const trainer of route.trainers) taken.add(tileKey(trainer.position));
  for (const item of route.items) {
    if (!item.hidden) taken.add(tileKey(item.position));
  }

  const free: Tile[] = [];
  for (let y = 0; y < route.height; y++) {
    for (let x = 0; x < route.width; x++) {
      const tile: Tile = { x, y };
      if (taken.has(tileKey(tile))) continue;
      if (!isWalkable(route.tiles, tile)) continue;
      free.push(tile);
    }
  }
  if (free.length === 0) return null;

  const walled = free.filter((tile) => touchesWall(route.tiles, tile));
  const candidates = walled.length > 0 ? walled : free;
  const rng = new Rng(hashSeed(`${seed}:npc:${roomIndex}:${npcId}:spot`));
  const tile = candidates[rng.int(0, candidates.length - 1)];
  return { tile, facing: walled.length > 0 ? awayFromWall(route.tiles, tile) : 'S' };
}

/**
 * The medic's one heal per floor. Reads the shipped mark
 * `npcUseId(mapIndex, roomIndex, 'medic')`: when it is already in `pickedItems`
 * the SAME `run` object comes back (a second talk heals nothing and writes
 * nothing, so a reload can never heal twice). Otherwise the result is
 * `markItemPicked(healParty(run), npcUseId(...))` — party and box, HP and PP,
 * never a resurrection and no status cure (that is the Pokevial's rule, D5).
 * Reads no RNG.
 */
export function medicHeal(run: RunState, mapIndex: number, roomIndex: number): RunState {
  const useId = npcUseId(mapIndex, roomIndex, 'medic');
  if (isItemPicked(run, useId)) return run;
  return markItemPicked(healParty(run), useId);
}

export type ChefTradeRefusal = 'no-member' | 'already-held' | 'no-berries';

export type ChefTrade =
  | Readonly<{
      ok: true;
      run: RunState;
      memberId: string;
      dishId: string;
      /** The berry ids actually spent, with multiplicity, in `BERRY_IDS` order. */
      berries: readonly string[];
    }>
  | Readonly<{ ok: false; reason: ChefTradeRefusal }>;

/**
 * Trades `CHEF_BERRY_COUNT` berries for one `CHEF_DISH_ITEM_ID`, equipped on
 * `memberId`. The berries are taken in `BERRY_IDS` table order, as many as each
 * stack holds before the next id is read, so the choice is data, never a roll.
 * Refusals, in this order: an unknown member (`no-member`), a member already
 * holding the dish (`already-held`), fewer than `CHEF_BERRY_COUNT` berries in the
 * bag (`no-berries`). On success: consume the berries, `addItem` the dish, then
 * `equipHeldItem` it (which returns the member's previous held item to the bag).
 * Reads no RNG.
 */
export function chefTrade(run: RunState, memberId: string): ChefTrade {
  const member = memberById(run, memberId);
  if (!member) return { ok: false, reason: 'no-member' };
  if (member.fighter.heldItem === CHEF_DISH_ITEM_ID) return { ok: false, reason: 'already-held' };
  let available = 0;
  for (const berryId of BERRY_IDS) available += itemCount(run, berryId);
  if (available < CHEF_BERRY_COUNT) return { ok: false, reason: 'no-berries' };

  const berries: string[] = [];
  let traded = run;
  let needed = CHEF_BERRY_COUNT;
  for (const berryId of BERRY_IDS) {
    if (needed <= 0) break;
    const take = Math.min(needed, itemCount(traded, berryId));
    if (take <= 0) continue;
    for (let index = 0; index < take; index++) berries.push(berryId);
    traded = consumeItem(traded, berryId, take);
    needed -= take;
  }
  const equipped = equipHeldItem(addItem(traded, CHEF_DISH_ITEM_ID), memberId, CHEF_DISH_ITEM_ID);
  return { ok: true, run: equipped, memberId, dishId: CHEF_DISH_ITEM_ID, berries };
}

/**
 * The berries one shake gives: `Rng.int(BERRY_TREE_MIN, BERRY_TREE_CAP)` draws on
 * `Rng(hashSeed(`${seed}:npc:${roomIndex}:${npcId}:berries`))`, then one
 * `Rng.int(0, BERRY_IDS.length - 1)` per berry on the SAME stream.
 */
export function npcBerryHarvest(seed: string, roomIndex: number, npcId: string): readonly string[] {
  const rng = new Rng(hashSeed(`${seed}:npc:${roomIndex}:${npcId}:berries`));
  const count = rng.int(BERRY_TREE_MIN, BERRY_TREE_CAP);
  const berries: string[] = [];
  for (let index = 0; index < count; index++) {
    berries.push(BERRY_IDS[rng.int(0, BERRY_IDS.length - 1)]);
  }
  return berries;
}

/**
 * The wild the shake wakes, through the room's own table and level roll:
 * `rollEncounter(table, rng, levelFor, 1)` — always a hit — where `rng` is
 * `Rng(hashSeed(`${seed}:npc:${roomIndex}:${npcId}:wild`))`. `undefined` only when
 * `table` is empty (the caller then starts no battle). Three draws on its own
 * stream; the room's grass, shiny and variant streams do not move.
 */
export function npcTreeWild(
  seed: string,
  roomIndex: number,
  npcId: string,
  table: EncounterTable,
  levelFor: EncounterLevelRoll,
): Encounter | undefined {
  const rng = new Rng(hashSeed(`${seed}:npc:${roomIndex}:${npcId}:wild`));
  return rollEncounter(table, rng, levelFor, 1);
}

/**
 * One id out of `prizeIds`, on `Rng(hashSeed(`${seed}:npc:${roomIndex}:${npcId}:prize`))`,
 * or `null` for an empty list. Its own stream, so the stone a fixed seed pays never
 * depends on when the win happened.
 */
export function npcPrize(
  seed: string,
  roomIndex: number,
  npcId: string,
  prizeIds: readonly string[],
): string | null {
  if (prizeIds.length === 0) return null;
  const rng = new Rng(hashSeed(`${seed}:npc:${roomIndex}:${npcId}:prize`));
  return prizeIds[rng.int(0, prizeIds.length - 1)];
}

/** The stable `defeatedTrainers` id of an NPC's own battle: `npc-trainer-<mapIndex>-<roomIndex>-<npcId>`. */
export function npcTrainerId(mapIndex: number, roomIndex: number, npcId: string): string {
  return `npc-trainer-${mapIndex}-${roomIndex}-${npcId}`;
}
