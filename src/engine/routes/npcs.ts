import { ROOM_BATTLEFIELDS, type RoomBattlefield } from '../../data/battlefields';
import { MAGICIAN_TYPES, NPC_ROWS, type NpcRequirement, type NpcRow } from '../../data/npcs';
import type { Tile } from '../grid';
import { isWalkable } from '../map';
import { firstTrainerRoom, type MapPlan } from '../maps/plan';
import { Rng, hashSeed } from '../rng';
import { partyHasAbility, partyHasMove, partyHasType } from '../run/party';
import type { RunState } from '../run/state';
import { tileKey, type RouteMap } from './routeMap';

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

/**
 * The free tile the NPC stands on, or null. Excludes the entry and its four
 * neighbours, every exit, walls, trainers and visible items; one `Rng.int` on
 * `Rng(hashSeed(`${seed}:npc:${roomIndex}:${npcId}:spot`))`.
 */
export function npcSpot(route: RouteMap, roomIndex: number, seed: string, npcId: string): Tile | null {
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

  const rng = new Rng(hashSeed(`${seed}:npc:${roomIndex}:${npcId}:spot`));
  return free[rng.int(0, free.length - 1)];
}
