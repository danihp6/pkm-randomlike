import type { Tile } from './grid';
import { WALL, extendMap, type TileMap } from './map';
import type { RouteMap } from './routes/routeMap';
import { isRouteShape } from './routes/layout';
import { wholeRunHeight } from './routes/walls';
import { patternCell, resolveTileFrame, type TileFrameSource } from './tileFrames';
import type { TilesetConfig } from './tileset';

/**
 * One map cell described for the dev "Map" tool: what tile value it holds, the
 * atlas frame it resolves to, and - when it draws as the tileset's wall motif -
 * which tree/stack object it belongs to and which other cells share that object.
 * The scene exports this (along with the route header and the tiles) so a route
 * can be inspected, pasted into a report, or re-imported to compare a change.
 */
export type FrameCellInfo = Readonly<{
  x: number;
  y: number;
  /** The raw map value at the cell (`map.ts`). */
  tile: number;
  /** The atlas frame the cell draws, or null when the value has no frame. */
  frame: number | null;
  source: TileFrameSource | null;
  /** Row into the wall pattern's `rows`, when the cell draws as the motif. */
  row: number | null;
  /** Column into that row, when the cell draws as the motif. */
  col: number | null;
  /** Connected mass of same-value wall cells this cell belongs to. */
  mass: number | null;
  /** The whole-object tree/stack this cell belongs to, its mass and its band. */
  tree: string | null;
}>;

/** A whole wall object (a `cols`-wide band over one contiguous vertical stack). */
export type FrameTreeInfo = Readonly<{
  id: string;
  mass: number;
  /** Left column of the `cols`-wide band. */
  band: number;
  top: number;
  bottom: number;
  /** True when every motif column is wall on every row of the band (no bite). */
  solid: boolean;
  /** True when `solid` and the run is a whole number of objects tall. */
  whole: boolean;
  cells: readonly (readonly [number, number])[];
}>;

export type FrameMap = Readonly<{
  width: number;
  height: number;
  /** Wall motif width, or null when the tileset draws no wall pattern. */
  cols: number | null;
  /** Wall motif row count, or null when the tileset draws no wall pattern. */
  rows: number | null;
  /** Every cell, row-major (`y * width + x`). */
  cells: readonly FrameCellInfo[];
  trees: readonly FrameTreeInfo[];
}>;

/** The JSON the scene hands to the dev "Map" tool, and reads back on import. */
export type FrameMapExport = Readonly<{
  kind: 'pkmr-framemap';
  version: 1;
  seed: string;
  routeIndex: number;
  biomeId: string;
  shape: RouteMap['shape'];
  entry: Tile;
  exits: readonly Tile[];
  frameMap: FrameMap;
}>;

const CARDINALS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * Describes every cell of `map` against `tileset`. The frame and the motif
 * row/column are resolved on a `pad`-ringed copy of the map, exactly as
 * `RouteScene` frames it (`FRAME_PAD`), so what the tool shows is what the scene
 * draws. The mass and tree ids are computed on the raw map, so they name the
 * playable cells.
 */
export function buildFrameMap(map: TileMap, tileset: TilesetConfig, pad = 1): FrameMap {
  const height = map.length;
  const width = height > 0 ? map[0].length : 0;
  const pattern = tileset.wallPattern ?? null;
  const wallValue = pattern?.value ?? WALL;
  const cols = pattern?.cols ?? null;
  const rows = pattern?.rows.length ?? null;
  const framed = pad > 0 ? extendMap(map, pad, WALL) : map;
  const at = (x: number, y: number): number => y * width + x;
  const isWall = (x: number, y: number): boolean =>
    x >= 0 && x < width && y >= 0 && y < height && map[y][x] === wallValue;

  const mass = new Array<number>(width * height).fill(-1);
  let nextMass = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isWall(x, y) || mass[at(x, y)] >= 0) continue;
      const id = nextMass++;
      mass[at(x, y)] = id;
      const stack: [number, number][] = [[x, y]];
      while (stack.length > 0) {
        const [cx, cy] = stack.pop()!;
        for (const [dx, dy] of CARDINALS) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (isWall(nx, ny) && mass[at(nx, ny)] < 0) {
            mass[at(nx, ny)] = id;
            stack.push([nx, ny]);
          }
        }
      }
    }
  }

  const band = new Array<number>(width).fill(-1);
  const colOf = new Array<number>(width).fill(-1);
  if (pattern && cols) {
    for (let x = 0; x < width; x++) {
      const col = patternCell(framed, x + pad, pad, pattern).col;
      colOf[x] = col;
      band[x] = x - col;
    }
  }

  const treeId = new Array<string | null>(width * height).fill(null);
  const trees: FrameTreeInfo[] = [];
  if (pattern && cols) {
    const bands = [...new Set(band)].sort((a, b) => a - b);
    for (const current of bands) {
      const columns: number[] = [];
      for (let x = 0; x < width; x++) if (band[x] === current) columns.push(x);
      let start = -1;
      for (let y = 0; y <= height; y++) {
        const anyWall = y < height && columns.some((x) => isWall(x, y));
        if (anyWall && start < 0) start = y;
        else if (!anyWall && start >= 0) {
          const bottom = y - 1;
          const cells: [number, number][] = [];
          let solid = true;
          for (let yy = start; yy <= bottom; yy++) {
            for (const x of columns) {
              if (isWall(x, yy)) cells.push([x, yy]);
              else solid = false;
            }
          }
          const wholeHeight = wholeRunHeight(bottom - start + 1, Math.max(2, rows! - 2));
          const id = `${current}:${start}`;
          for (const [x, yy] of cells) treeId[at(x, yy)] = id;
          trees.push({
            id,
            mass: mass[at(columns[0], start)],
            band: current,
            top: start,
            bottom,
            whole: solid && wholeHeight === bottom - start + 1,
            solid,
            cells,
          });
          start = -1;
        }
      }
    }
  }

  const cells: FrameCellInfo[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = map[y][x];
      const resolved = resolveTileFrame(framed, x + pad, y + pad, tileset);
      const motif = pattern !== null && tile === wallValue;
      cells.push({
        x,
        y,
        tile,
        frame: resolved?.frame ?? null,
        source: resolved?.source ?? null,
        row: motif && pattern ? patternCell(framed, x + pad, y + pad, pattern).row : null,
        col: motif ? colOf[x] : null,
        mass: motif ? mass[at(x, y)] : null,
        tree: motif ? treeId[at(x, y)] : null,
      });
    }
  }

  return { width, height, cols, rows, cells, trees };
}

/** Wraps a route and its frame map into the JSON the dev tool exports. */
export function serializeFrameMap(route: RouteMap, tileset: TilesetConfig, pad = 1): FrameMapExport {
  return {
    kind: 'pkmr-framemap',
    version: 1,
    seed: route.seed,
    routeIndex: route.routeIndex,
    biomeId: route.biomeId,
    shape: route.shape,
    entry: { ...route.entry },
    exits: route.exits.map((exit) => ({ ...exit })),
    frameMap: buildFrameMap(route.tiles, tileset, pad),
  };
}

/** The tile grid a frame map describes, so an import can rebuild the route. */
export function frameMapTiles(frameMap: FrameMap): number[][] {
  const tiles = Array.from({ length: frameMap.height }, () => new Array<number>(frameMap.width).fill(WALL));
  for (const cell of frameMap.cells) tiles[cell.y][cell.x] = cell.tile;
  return tiles;
}

function parsePoint(value: unknown, label: string): Tile {
  const point = value as Partial<Tile> | undefined;
  if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
    throw new Error(`malformed ${label}`);
  }
  return { x: point.x, y: point.y };
}

/** Reads the dev tool's JSON back, throwing a readable error on anything odd. */
export function parseFrameMapExport(text: string): FrameMapExport {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('not valid JSON');
  }
  const exported = value as Partial<FrameMapExport>;
  if (exported.kind !== 'pkmr-framemap' || exported.version !== 1) {
    throw new Error('not a frame map export');
  }
  if (typeof exported.seed !== 'string' || typeof exported.routeIndex !== 'number') {
    throw new Error('missing route header');
  }
  if (!isRouteShape(exported.shape)) throw new Error('invalid shape');
  const frameMap = exported.frameMap as Partial<FrameMap> | undefined;
  if (!frameMap || typeof frameMap.width !== 'number' || typeof frameMap.height !== 'number') {
    throw new Error('missing frame map');
  }
  if (!Array.isArray(frameMap.cells) || frameMap.cells.length !== frameMap.width * frameMap.height) {
    throw new Error('cell count does not match the size');
  }
  for (const cell of frameMap.cells) {
    if (!cell || typeof cell.x !== 'number' || typeof cell.y !== 'number' || typeof cell.tile !== 'number') {
      throw new Error('malformed cell');
    }
  }
  const entry = parsePoint(exported.entry, 'entry');
  if (!Array.isArray(exported.exits)) throw new Error('missing exits');
  const exits = exported.exits.map((exit, index) => parsePoint(exit, `exit ${index}`));
  return {
    kind: 'pkmr-framemap',
    version: 1,
    seed: exported.seed,
    routeIndex: exported.routeIndex,
    biomeId: typeof exported.biomeId === 'string' ? exported.biomeId : 'forest',
    shape: exported.shape,
    entry,
    exits,
    frameMap: frameMap as FrameMap,
  };
}

/** A route rebuilt from an imported frame map, so the scene can render it. */
export function routeFromFrameMapExport(exported: FrameMapExport): RouteMap {
  return {
    seed: exported.seed,
    routeIndex: exported.routeIndex,
    biomeId: exported.biomeId,
    shape: exported.shape,
    width: exported.frameMap.width,
    height: exported.frameMap.height,
    tiles: frameMapTiles(exported.frameMap),
    entry: exported.entry,
    exits: exported.exits,
    spine: [],
    branches: [],
    pockets: [],
  };
}
