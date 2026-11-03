import { cityChanceOf, genericLines, SPECIAL_NPCS, specialNpcRow, type NpcRow } from '../../data/npcs';
import type { TranslationKey } from '../../i18n';
import type { Tile } from '../grid';
import { isWalkable, type TileMap } from '../map';
import { hashSeed, Rng } from '../rng';
import { chefTrade } from '../routes/npcs';
import { healParty } from '../run/heal';
import { isItemPicked, markItemPicked, memberById, type RunState } from '../run/state';
import { planCity, type CityPlan } from './city/plan';
import type { NodeContent } from './content';
import { nodeOf, type RegionPlan } from './plan';
import { nodeStreams } from './streams';

/**
 * Who stands in a settlement (`docs/region-spec.md` §7.7): the content pass
 * (`planNodeContent`) decides **how many** people a node holds and **which** rows,
 * and this pass turns them into placed bodies on the settlement's own tiles, each
 * with the card it opens and the mark it leaves.
 *
 * Pure: the positions are one `Rng` split off the node's `content` stream under
 * `npcs`, so the content pass's own sequence never moves (`D60`), the generic lines
 * are drawn **after** every tile, and a special's presence is its own one-draw
 * stream (`${seed}:node:${key}:npc-special:${rowId}`), so neither a line nor the
 * generic count can move a special.
 */

export type NpcFacing = 'N' | 'E' | 'S' | 'W';

export type NpcKind = 'generic' | 'special';

export type PlacedNpc = Readonly<{
  /** `npcPlacementId(nodeKey, index)`. */
  id: string;
  nodeKey: string;
  /** 0-based, in placement order: every generic first, then every special. */
  index: number;
  kind: NpcKind;
  /** The `SPECIAL_NPCS` row the body and the sprite come from. */
  rowId: string;
  /** A key of `OVERWORLD_SPRITE_KEYS`. */
  spriteKey: string;
  /** The card's title: the row's `nameKey`, or `npc.generic.name` for a generic. */
  nameKey: TranslationKey;
  /** The card's paragraph: the row's `greetingKey`, or the tier's generic line. */
  lineKey: TranslationKey;
  /** The row's first choice id, or `null` for a generic (its card offers `LEAVE` only). */
  choiceId: string | null;
  tile: Tile;
  facing: NpcFacing;
}>;

/** The draft of one body: everything but the tile, the facing and a generic's line. */
type NpcDraft = Readonly<{
  kind: NpcKind;
  rowId: string;
  spriteKey: string;
  nameKey: TranslationKey;
  /** A special's greeting; `null` for a generic, whose line is drawn after the tiles. */
  lineKey: TranslationKey | null;
  choiceId: string | null;
}>;

/** A body once it stands on a tile, before the generic lines are drawn. */
type StandingNpc = Omit<PlacedNpc, 'lineKey'> & Readonly<{ lineKey: TranslationKey | null }>;

/** `npc-<nodeKey>-<index>`, a placement's name for as long as the plan holds. */
export function npcPlacementId(nodeKey: string, index: number): string {
  return `npc-${nodeKey}-${index}`;
}

/** The `pickedItems` mark a placement leaves: its own id plus the row it stands. */
export function npcUseId(placed: PlacedNpc): string {
  return `${placed.id}-${placed.rowId}`;
}

/** True once `placed` has been taken: the card prints `npc.used` and offers nothing. */
export function npcUsed(run: RunState, placed: PlacedNpc): boolean {
  return isItemPicked(run, npcUseId(placed));
}

/** Records the placement's use mark, so a revisit replays the card as spent. */
export function markNpcUsed(run: RunState, placed: PlacedNpc): RunState {
  return markItemPicked(run, npcUseId(placed));
}

/** The tile's numeric key inside the settlement, for the taken set. */
function cellKey(city: CityPlan, x: number, y: number): number {
  return y * city.width + x;
}

/**
 * Every tile a settlement can stand a body on: walkable, never the spawn (a walk in
 * lands there) and never a door (a step there opens a building).
 */
function standingTiles(city: CityPlan): Tile[] {
  const taken = new Set<number>([cellKey(city, city.spawn.x, city.spawn.y)]);
  for (const building of city.buildings) {
    taken.add(cellKey(city, building.door.x, building.door.y));
  }
  const tiles: Tile[] = [];
  for (let y = 0; y < city.height; y++) {
    for (let x = 0; x < city.width; x++) {
      if (taken.has(cellKey(city, x, y))) continue;
      if (!isWalkable(city.tiles, { x, y })) continue;
      tiles.push({ x, y });
    }
  }
  return tiles;
}

/**
 * The way a body on `tile` looks: toward the street south of it, else north, else
 * east, else west. Derived from the map, never drawn, so a placement keeps its one
 * tile draw.
 */
function facingOf(tiles: TileMap, tile: Tile): NpcFacing {
  if (isWalkable(tiles, { x: tile.x, y: tile.y + 1 })) return 'S';
  if (isWalkable(tiles, { x: tile.x, y: tile.y - 1 })) return 'N';
  if (isWalkable(tiles, { x: tile.x + 1, y: tile.y })) return 'E';
  return 'W';
}

/** One row, one stream, one draw: whether the city stands the special it offers. */
function standsSpecial(seed: string, key: string, row: NpcRow): boolean {
  const rng = new Rng(hashSeed(`${seed}:node:${key}:npc-special:${row.id}`));
  return rng.next() < cityChanceOf(row);
}

/**
 * The people a settlement stands, in placement order: the generic NPCs the content
 * pass rolled first, then the specials it offered whose own draw passed. Every body
 * gets one tile off the node's `npcs` stream, then the generics get their line, so a
 * line can never move a tile. Throws on a key the plan does not hold or that names
 * something which is not a settlement.
 */
export function nodeNpcs(plan: RegionPlan, key: string, content: NodeContent): readonly PlacedNpc[] {
  const node = nodeOf(plan, key);
  if (!node) throw new Error(`unknown node: ${key}`);
  const city = planCity(plan, key);
  const tier = node.tier ?? 1;

  const rng = nodeStreams(plan.seed, key).content.split('npcs');

  const drafts: NpcDraft[] = [];
  for (const generic of content.npcs) {
    const row = specialNpcRow(generic.npcId) ?? SPECIAL_NPCS[0];
    drafts.push({
      kind: 'generic',
      rowId: row.id,
      spriteKey: row.spriteKey,
      nameKey: 'npc.generic.name',
      lineKey: null,
      choiceId: null,
    });
  }
  for (const special of content.specials) {
    const row = specialNpcRow(special.npcId);
    if (!row || !standsSpecial(plan.seed, key, row)) continue;
    drafts.push({
      kind: 'special',
      rowId: row.id,
      spriteKey: row.spriteKey,
      nameKey: row.nameKey,
      lineKey: row.greetingKey,
      choiceId: row.choices?.[0]?.id ?? null,
    });
  }

  const candidates = standingTiles(city);
  const standing: StandingNpc[] = [];
  for (let index = 0; index < drafts.length && candidates.length > 0; index++) {
    const at = rng.int(0, candidates.length - 1);
    const tile = candidates[at];
    candidates.splice(at, 1);
    standing.push({
      ...drafts[index],
      id: npcPlacementId(key, index),
      nodeKey: key,
      index,
      tile: { x: tile.x, y: tile.y },
      facing: facingOf(city.tiles, tile),
    });
  }

  const lines = genericLines(tier);
  return standing.map((npc) => ({
    ...npc,
    lineKey: npc.lineKey ?? lines[rng.int(0, lines.length - 1)],
  }));
}

export type NpcUseRefusal = 'once' | 'line-only' | 'needs-member' | 'needs-scene';

export type NpcUse =
  Readonly<{ ok: true; run: RunState }> | Readonly<{ ok: false; reason: NpcUseRefusal }>;

/**
 * What a card's own action does, in the order the rules answer: a spent placement
 * answers nothing, a generic only ever prints its line, the **medic** heals the
 * party and the box once, the **chef** trades three berries for its dish, and every
 * other row resolves in its own scene (the caller marks the use). Reads no RNG.
 */
export function useNpc(run: RunState, placed: PlacedNpc, memberId?: string): NpcUse {
  if (npcUsed(run, placed)) return { ok: false, reason: 'once' };
  if (placed.kind === 'generic') return { ok: false, reason: 'line-only' };
  if (placed.rowId === 'medic') return { ok: true, run: markNpcUsed(healParty(run), placed) };
  if (placed.rowId === 'chef') {
    if (memberId === undefined || memberById(run, memberId) === undefined) {
      return { ok: false, reason: 'needs-member' };
    }
    const trade = chefTrade(run, memberId);
    if (!trade.ok) return { ok: false, reason: 'needs-member' };
    return { ok: true, run: markNpcUsed(trade.run, placed) };
  }
  return { ok: false, reason: 'needs-scene' };
}
