import { citySize, cityTierForBadge, TOWN_SIZE } from '../../../data/region';
import { buildingFrameFor, CITY_BUILDING_SPRITES } from '../../../data/tilesets/cityBuildings';
import type { Tile } from '../../grid';
import { DOOR, PATH, PLAZA, ROOF, TALL_GRASS, WALL, type TileMap } from '../../map';
import type { Rng } from '../../rng';
import type { AccessEdge } from '../../routes/layout';
import { nodeOf, type RegionNode, type RegionPlan } from '../plan';
import { nodeStreams } from '../streams';

/**
 * A settlement is one tile square carved as a street grid of blocks: the central
 * block is the plaza every walk in lands beside, the bottom-right one is the grass
 * corner, and the rest hold the buildings — a city's Centre, its gym, its
 * laboratory and its casino, then houses (`docs/region-spec.md` §7.1). The starting
 * town is the same generator without the Centre, the gym and the casino.
 *
 * The map is emitted in the engine's own map values, never in atlas frames, and it
 * reads nothing but `nodeStreams(seed, key).layout`: the buildings' blocks are
 * shuffled off it once, then each building's house sprite in placement order — the
 * sprite's own door column is the one the map and the decal both use — and no
 * other draw is taken, so a later content pass cannot move a wall (`D11`, `D60`).
 */

/** The five things a city door can lead to. Frozen: the interior generator parses it. */
export type BuildingKind = 'centre' | 'gym' | 'lab' | 'house' | 'casino';

/** One building and the door that opens it. */
export type CityBuilding = Readonly<{
  kind: BuildingKind;
  /** The single DOOR cell of the building's front row. */
  door: Tile;
  /**
   * The interior this door opens, city-relative and stable across a rebuild:
   * `'centre'`, `'gym'`, `'lab'`, `'casino'`, or `'house:<n>'` with `n` counting
   * 1.. from the first house placed. Never carries the city key — the caller
   * already has it.
   */
  interiorKey: string;
  /** The footprint, inclusive of roof, wall and the door: top-left + size. */
  rect: Readonly<{ x: number; y: number; width: number; height: number }>;
  /** The `city-buildings` frame the scene draws over `rect`. */
  sprite: number;
}>;

/** One border exit. A city band is two-way: walking back never needs a badge. */
export type CityExitBand = Readonly<{
  edge: AccessEdge;
  neighbourKey: string;
  /** The band's border cells, in reading order; every one is walkable. */
  tiles: readonly Tile[];
}>;

export type CityPlan = Readonly<{
  /** `plan.seed`, the run seed. */
  seed: string;
  /** The settlement's node key, e.g. `city:3` or `town:1`. */
  key: string;
  /** The settlement's generated name (`RegionNode.name`). */
  name: string;
  /** The city tier, `null` on the town. */
  tier: 1 | 2 | 3 | null;
  width: number;
  height: number;
  tiles: TileMap;
  /** Where a walk in through any exit band lands. Always walkable. */
  spawn: Tile;
  /** Every building, in placement order; exactly one door each. */
  buildings: readonly CityBuilding[];
  /** One band per neighbour, in `node.edges` order. */
  exits: readonly CityExitBand[];
  /** The grass corner's cells: every one is `TALL_GRASS`. */
  grass: readonly Tile[];
}>;

/** The solid border ring a settlement keeps, in tiles; a band replaces it whole. */
const RING = 2;

/** A street axis repeats every this many tiles: one street plus one block. */
const STREET_PITCH = 10;

/** How wide a street runs, across both axes. */
const STREET_WIDTH = 3;

/** The square between two streets that holds a plaza, a building lot or the grass. */
const BLOCK = 7;

const BUILDING_WIDTH = 5;

/**
 * The footprint's rows: the front row with its door plus the five roof rows
 * behind it. The compendium's houses face south, so the front sits on the block's
 * bottom row and one `WALL` row of the block stays above the roof.
 */
const BUILDING_HEIGHT = 6;

/** An exit band's width, matched to a street so it reads as that street reaching the ring. */
const BAND_WIDTH = 3;

/** The first badge whose city holds a casino (`docs/region-spec.md` §7.1). */
const CASINO_BADGE = 3;

type BlockGrid = Readonly<{
  /** Blocks per axis. */
  count: number;
  /** The first street's top-left tile. */
  origin: number;
  /** The last street's last column/row. */
  end: number;
  /** Every block's top-left corner, row-major. */
  blocks: readonly Tile[];
}>;

/**
 * The street grid a settlement of this size carries: whole `BLOCK`-wide blocks
 * between `STREET_WIDTH`-wide streets, centred so the leftover border is shared by
 * the two sides. Every block is bounded by a street on all four sides, so the plaza,
 * the grass and every door row open onto pavement.
 */
function streetGrid(width: number, height: number): BlockGrid {
  const inner = Math.min(width, height) - RING * 2;
  const count = Math.floor((inner - STREET_WIDTH) / STREET_PITCH);
  const span = count * STREET_PITCH + STREET_WIDTH;
  const origin = RING + Math.floor((inner - span) / 2);
  const blocks: Tile[] = [];
  for (let row = 0; row < count; row++) {
    for (let column = 0; column < count; column++) {
      blocks.push({
        x: origin + STREET_WIDTH + column * STREET_PITCH,
        y: origin + STREET_WIDTH + row * STREET_PITCH,
      });
    }
  }
  return { count, origin, end: origin + span - 1, blocks };
}

function walledMap(width: number, height: number): number[][] {
  return Array.from({ length: height }, () => new Array<number>(width).fill(WALL));
}

function carveStreets(tiles: number[][], width: number, height: number, grid: BlockGrid): void {
  for (let street = 0; street <= grid.count; street++) {
    const start = grid.origin + street * STREET_PITCH;
    for (let y = RING; y < height - RING; y++) {
      for (let x = start; x < start + STREET_WIDTH; x++) tiles[y][x] = PATH;
    }
    for (let x = RING; x < width - RING; x++) {
      for (let y = start; y < start + STREET_WIDTH; y++) tiles[y][x] = PATH;
    }
  }
}

function fillBlock(tiles: number[][], block: Tile, value: number): readonly Tile[] {
  const cells: Tile[] = [];
  for (let y = 0; y < BLOCK; y++) {
    for (let x = 0; x < BLOCK; x++) {
      const cell = { x: block.x + x, y: block.y + y };
      tiles[cell.y][cell.x] = value;
      cells.push(cell);
    }
  }
  return cells;
}

/** A building's front row at `top` (one `DOOR`, the rest `WALL`) and `ROOF` above it. */
function drawBuilding(tiles: number[][], block: Tile, top: number, doorColumn: number): void {
  for (let y = 0; y < BUILDING_HEIGHT; y++) {
    for (let x = 0; x < BUILDING_WIDTH; x++) {
      const front = y === BUILDING_HEIGHT - 1;
      const value = front ? (x === doorColumn ? DOOR : WALL) : ROOF;
      tiles[top + y][block.x + x] = value;
    }
  }
}

/** Fisher-Yates in place, descending `i`, one `rng.int(0, i)` per step. */
function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The dominant axis of `to - from`, ties going to the horizontal. */
function edgeToward(from: Tile, to: Tile): AccessEdge {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'E' : 'W';
  return dy > 0 ? 'S' : 'N';
}

function blockGap(block: Tile, centreX: number, centreY: number): number {
  const half = (BLOCK - 1) / 2;
  const dx = block.x + half - centreX;
  const dy = block.y + half - centreY;
  return dx * dx + dy * dy;
}

function sameBlock(a: Tile, b: Tile): boolean {
  return a.x === b.x && a.y === b.y;
}

/** The street an edge's `index`-th band rides on, from the middle one outwards. */
function streetOrdinal(count: number, index: number): number {
  return (Math.floor(count / 2) + index) % (count + 1);
}

/**
 * Carves one exit band: the ring cells on `edge` and a straight run of `PATH` from
 * them to the street the band rides on, so a walk in lands on the grid.
 */
function openBand(
  tiles: number[][],
  edge: AccessEdge,
  grid: BlockGrid,
  width: number,
  height: number,
  start: number,
): Tile[] {
  const cells: Tile[] = [];
  const onBand = edge === 'N' || edge === 'S';
  const from = edge === 'N' || edge === 'W' ? 0 : grid.end;
  const to = edge === 'N' || edge === 'W' ? grid.origin : onBand ? height - 1 : width - 1;
  for (let along = from; along <= to; along++) {
    for (let across = start; across < start + BAND_WIDTH; across++) {
      const cell = onBand ? { x: across, y: along } : { x: along, y: across };
      tiles[cell.y][cell.x] = PATH;
      if (cell.x < RING || cell.y < RING || cell.x >= width - RING || cell.y >= height - RING) {
        cells.push(cell);
      }
    }
  }
  return cells;
}

/** The kinds a settlement fills, in filling order: services first, then its houses. */
function buildingKinds(node: RegionNode): readonly BuildingKind[] {
  const city = node.kind === 'city';
  const kinds: BuildingKind[] = [];
  if (city) kinds.push('centre');
  if (city && node.gym) kinds.push('gym');
  kinds.push('lab');
  if (city && node.badge >= CASINO_BADGE) kinds.push('casino');
  const total = city ? cityTierForBadge(node.badge).buildings : kinds.length + 1;
  while (kinds.length < total) kinds.push('house');
  return kinds;
}

/** `house` takes its 1-based number only when the settlement holds more than one. */
function interiorKeysOf(kinds: readonly BuildingKind[]): readonly string[] {
  const houses = kinds.filter((kind) => kind === 'house').length;
  let placed = 0;
  return kinds.map((kind) => {
    if (kind !== 'house') return kind;
    placed += 1;
    return houses > 1 ? `house:${placed}` : 'house';
  });
}

/**
 * One settlement: its square, its street grid, its plaza and spawn, its grass
 * corner, its buildings with their doors and its one exit band per neighbour.
 * Throws when `key` names something that is not a town or a city.
 */
export function planCity(plan: RegionPlan, key: string): CityPlan {
  const node = nodeOf(plan, key);
  if (!node || (node.kind !== 'town' && node.kind !== 'city')) {
    throw new Error(`not a settlement: ${key}`);
  }

  const city = node.kind === 'city';
  const size = city ? citySize(node.badge) : TOWN_SIZE;
  const width = size.width;
  const height = size.height;
  const tiles = walledMap(width, height);
  const grid = streetGrid(width, height);
  carveStreets(tiles, width, height, grid);

  const centreX = (width - 1) / 2;
  const centreY = (height - 1) / 2;
  const centralBlock = grid.blocks.reduce((best, block) =>
    blockGap(block, centreX, centreY) < blockGap(best, centreX, centreY) ? block : best,
  );
  fillBlock(tiles, centralBlock, PLAZA);
  const spawn: Tile = {
    x: centralBlock.x + Math.floor(BLOCK / 2),
    y: centralBlock.y + Math.floor(BLOCK / 2),
  };

  const grassBlock = grid.blocks[grid.blocks.length - 1];
  const grass = fillBlock(tiles, grassBlock, TALL_GRASS);

  const kinds = buildingKinds(node);
  const interiorKeys = interiorKeysOf(kinds);
  const layoutRng = nodeStreams(plan.seed, key).layout;
  const lots = shuffled(
    grid.blocks.filter((block) => !sameBlock(block, centralBlock) && !sameBlock(block, grassBlock)),
    layoutRng,
  );
  if (lots.length < kinds.length) {
    throw new Error(`not enough blocks for ${kinds.length} buildings in ${key}`);
  }

  const buildings: CityBuilding[] = [];
  for (let index = 0; index < kinds.length; index++) {
    const block = lots[index];
    const top = block.y + BLOCK - BUILDING_HEIGHT;
    const sprite = buildingFrameFor(kinds[index], layoutRng.int(0, CITY_BUILDING_SPRITES.length - 1));
    const doorColumn = CITY_BUILDING_SPRITES[sprite].door;
    drawBuilding(tiles, block, top, doorColumn);
    buildings.push({
      kind: kinds[index],
      door: { x: block.x + doorColumn, y: top + BUILDING_HEIGHT - 1 },
      interiorKey: interiorKeys[index],
      rect: { x: block.x, y: top, width: BUILDING_WIDTH, height: BUILDING_HEIGHT },
      sprite,
    });
  }

  const bandOrdinals = new Map<AccessEdge, number>();
  const exits: CityExitBand[] = [];
  for (const neighbourKey of node.edges) {
    const neighbour = nodeOf(plan, neighbourKey);
    if (!neighbour) continue;
    const edge = edgeToward(node.position, neighbour.position);
    const ordinal = bandOrdinals.get(edge) ?? 0;
    bandOrdinals.set(edge, ordinal + 1);
    const start = grid.origin + streetOrdinal(grid.count, ordinal) * STREET_PITCH;
    const band = openBand(tiles, edge, grid, width, height, start);
    exits.push({ edge, neighbourKey, tiles: band });
  }

  return {
    seed: plan.seed,
    key,
    name: node.name,
    tier: city ? cityTierForBadge(node.badge).tier : null,
    width,
    height,
    tiles,
    spawn,
    buildings,
    exits,
    grass,
  };
}
