import { GATES, GATE_KINDS, type GateKind } from '../../data/gates';
import type { Tile } from '../grid';
import { FLOOR, WALL, type TileMap } from '../map';
import { hashSeed, Rng } from '../rng';
import { tileKey, type RouteGate } from './routeMap';
import { reachableTiles } from './validate';

/**
 * The gated reward room's carve (`docs/maps-spec.md` §7, `D11`): one one-tile vault
 * two cells off a walkable tile, sealed by a bush, a rock or a pond. It runs as its
 * own build pass (`RouteRequest.gate`, `src/engine/routes/sketch.ts`), off two
 * minted streams so nothing the route builder already draws moves, and it writes
 * only the two cells it returns.
 */

/** How many cells from the fence the seal may sit; the ring itself must stay solid. */
export const GATE_INSET = 1;

/** The four cardinals, in the site rule's own order: N, E, S, W. */
const CARDINALS: readonly Tile[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

/** What the carve needs from the build. */
export type GatedVaultOptions = Readonly<{
  /** The build's seed (`RouteRequest.seed`, never the debug `#rN` suffix). */
  seed: string;
  /** The room's stable index (`routeIndexForRoom`), so the vault survives a revisit. */
  routeIndex: number;
  /** The route's entry: never the corridor's mouth. */
  entry: Tile;
  /** Cells the vault must not use: the entry, every exit and every pocket. */
  reserved: ReadonlySet<string>;
  /** `false` when the floor's gate is already open: carve the chamber, leave no seal. */
  sealed: boolean;
}>;

function at(tiles: TileMap, tile: Tile): number | undefined {
  if (tile.y < 0 || tile.y >= tiles.length) return undefined;
  if (tile.x < 0 || tile.x >= tiles[tile.y].length) return undefined;
  return tiles[tile.y][tile.x];
}

function same(a: Tile, b: Tile): boolean {
  return a.x === b.x && a.y === b.y;
}

/**
 * Carves the room's **gated vault** in place and returns the gate it made, or null when
 * the room has no room left for one. Deterministic and with no side effect beyond
 * `tiles`: the kind and the site come from two minted, module-local streams, so nothing
 * the route builder already draws moves (`D11`), and it writes only the two cells it
 * returns.
 */
export function carveGatedVault(tiles: number[][], options: GatedVaultOptions): RouteGate | null {
  const height = tiles.length;
  const width = height > 0 ? tiles[0].length : 0;
  const reached = reachableTiles(tiles, options.entry);
  const insideFence = (tile: Tile): boolean =>
    GATE_INSET <= tile.x &&
    tile.x <= width - 1 - GATE_INSET &&
    GATE_INSET <= tile.y &&
    tile.y <= height - 1 - GATE_INSET;
  const sites: (readonly [Tile, Tile])[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const mouth = { x, y };
      if (tiles[y][x] !== FLOOR || !reached.has(tileKey(mouth))) continue;
      if (options.reserved.has(tileKey(mouth)) || same(mouth, options.entry)) continue;
      for (const dir of CARDINALS) {
        const seal: Tile = { x: mouth.x + dir.x, y: mouth.y + dir.y };
        const pocket: Tile = { x: mouth.x + dir.x * 2, y: mouth.y + dir.y * 2 };
        if (at(tiles, seal) !== WALL || at(tiles, pocket) !== WALL) continue;
        if (!insideFence(seal) || !insideFence(pocket)) continue;
        const perpendicular =
          dir.x === 0
            ? [
                { x: 1, y: 0 },
                { x: -1, y: 0 },
              ]
            : [
                { x: 0, y: 1 },
                { x: 0, y: -1 },
              ];
        if (perpendicular.some((step) => at(tiles, { x: seal.x + step.x, y: seal.y + step.y }) !== WALL))
          continue;
        const aroundPocket = CARDINALS.filter((step) => !same(step, { x: -dir.x, y: -dir.y }));
        if (
          aroundPocket.some((step) => at(tiles, { x: pocket.x + step.x, y: pocket.y + step.y }) !== WALL)
        )
          continue;
        sites.push([seal, pocket]);
      }
    }
  }

  const kind = gateKindFor(options.seed, options.routeIndex);
  if (sites.length === 0) return null;
  const rng = new Rng(hashSeed(`${options.seed}:gate:${options.routeIndex}:site`));
  const [seal, pocket] = sites[rng.int(0, sites.length - 1)];
  tiles[seal.y][seal.x] = options.sealed ? GATES[kind].tile : FLOOR;
  tiles[pocket.y][pocket.x] = FLOOR;
  return { kind, tile: seal, pocket };
}

/** The gate's kind: `GATE_KINDS[int(0, 2)]` off `Rng(hashSeed(`${seed}:gate:${routeIndex}`))`. */
export function gateKindFor(seed: string, routeIndex: number): GateKind {
  const rng = new Rng(hashSeed(`${seed}:gate:${routeIndex}`));
  return GATE_KINDS[rng.int(0, GATE_KINDS.length - 1)];
}

/** The floor's stable opening mark in `pickedItems`: `gate-<mapIndex>-<roomId>`. */
export function gateId(mapIndex: number, roomId: number): string {
  return `gate-${mapIndex}-${roomId}`;
}

/** The reward's stable ground-item id in `pickedItems`: `gate-loot-<mapIndex>-<roomId>`. */
export function gateRewardId(mapIndex: number, roomId: number): string {
  return `gate-loot-${mapIndex}-${roomId}`;
}
