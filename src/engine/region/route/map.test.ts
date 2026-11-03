import { describe, expect, it } from 'vitest';
import { ROUTE_HEIGHTS, ROUTE_WIDTH } from '../../../data/region';
import { FRLG_FOREST_TILESET } from '../../../data/tilesets/frlg';
import { buildFrameMesh } from '../../frameMap';
import { DOOR, EXIT, FLOOR, isWalkable, tileAt, type TileMap } from '../../map';
import { hashSeed } from '../../rng';
import { borderEdge } from '../../routes/doors';
import { tileKey } from '../../routes/routeMap';
import { reachableTiles } from '../../routes/validate';
import { planRegion, type RegionPlan } from '../plan';
import { generateRoute, type RegionRouteMap } from './map';

const SEEDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel'];

const SCREEN_COUNTS = [2, 3, 4] as const;

type RouteCase = Readonly<{ seed: string; screens: 2 | 3 | 4; map: RegionRouteMap }>;

let cached: readonly RouteCase[] | undefined;

/** The 24 routes the criteria measure: eight seeds x the three screen counts of `route:1`. */
function routes(): readonly RouteCase[] {
  if (cached) return cached;
  const built: RouteCase[] = [];
  for (const seed of SEEDS) {
    const plan = planRegion(seed);
    for (const screens of SCREEN_COUNTS) {
      built.push({ seed, screens, map: generateRoute(plan, 'route:1', screens) });
    }
  }
  cached = built;
  return built;
}

function lateralMaps(): readonly RouteCase[] {
  return SEEDS.map((seed) => {
    const plan = planRegion(seed);
    const lateral = plan.nodes.find((node) => node.kind === 'lateral');
    if (!lateral) throw new Error(`${seed} planned no lateral`);
    return { seed, screens: 2, map: generateRoute(plan, lateral.key) };
  });
}

function walkableColumns(tiles: TileMap, y: number): number[] {
  const columns: number[] = [];
  for (let x = 0; x < tiles[y].length; x++) {
    if (isWalkable(tiles, { x, y })) columns.push(x);
  }
  return columns;
}

function digest(plan: RegionPlan, key: string, screens: 2 | 3 | 4): string {
  const map = generateRoute(plan, key, screens);
  const stitched = map.tiles.map((row) => row.join('')).join('/');
  return (
    `${map.width}x${map.height}|${map.biomeId}|${map.entry.x},${map.entry.y}|` +
    map.bands
      .map((band) => `${band.edge}:${band.neighbourKey}:${band.tiles.map(tileKey).join('.')}`)
      .join('|') +
    '|' +
    hashSeed(stitched).toString(36)
  );
}

describe('region route map', () => {
  it('carves 60 x every ROUTE_HEIGHTS for eight seeds', () => {
    for (const { seed, screens, map } of routes()) {
      const label = `${seed} ${screens}`;
      expect(map.width, label).toBe(ROUTE_WIDTH);
      expect(map.height, label).toBe(ROUTE_HEIGHTS[screens - 2]);
      expect(map.seed, label).toBe(seed);
      expect(map.key, label).toBe('route:1');
      expect(map.screens, label).toHaveLength(screens);
      expect(map.tiles.length, label).toBe(map.height);
      for (const row of map.tiles) expect(row.length, label).toBe(ROUTE_WIDTH);
    }
  }, 60_000);

  it('connects the entry band to every exit band', () => {
    for (const { seed, screens, map } of routes()) {
      const reached = reachableTiles(map.tiles, map.entry);
      const exits = map.bands.filter((band) => band.role === 'exit');
      expect(exits.length, `${seed} ${screens}`).toBeGreaterThan(0);
      expect(map.exits, `${seed} ${screens}`).toHaveLength(exits.length);
      expect(reached.has(tileKey(map.entry)), `${seed} ${screens}`).toBe(true);
      for (const band of exits) {
        for (const cell of band.tiles) {
          expect(reached.has(tileKey(cell)), `${seed} ${screens} ${tileKey(cell)}`).toBe(true);
        }
      }
      for (const exit of map.exits) {
        expect(reached.has(tileKey(exit)), `${seed} ${screens} ${tileKey(exit)}`).toBe(true);
      }
    }

    for (const { seed, map } of lateralMaps()) {
      const reached = reachableTiles(map.tiles, map.entry);
      expect(map.exits, seed).toEqual([]);
      expect(map.bands, seed).toHaveLength(1);
      expect(map.bands[0].role, seed).toBe('entry');
      for (const cell of map.bands[0].tiles) {
        expect(isWalkable(map.tiles, cell), `${seed} ${tileKey(cell)}`).toBe(true);
        expect(reached.has(tileKey(cell)), `${seed} ${tileKey(cell)}`).toBe(true);
      }
    }
  }, 60_000);

  it('leaves no walkable cell outside the reachable set', () => {
    for (const { seed, screens, map } of routes()) {
      const reached = reachableTiles(map.tiles, map.entry);
      const stranded: string[] = [];
      for (let y = 1; y < map.height - 1; y++) {
        for (let x = 1; x < map.width - 1; x++) {
          const tile = { x, y };
          if (!isWalkable(map.tiles, tile) || reached.has(tileKey(tile))) continue;
          if (stranded.length < 5) stranded.push(tileKey(tile));
        }
      }
      expect(stranded, `${seed} ${screens}`).toEqual([]);
    }
  }, 60_000);

  it('keeps every opening on the final border and draws no door', () => {
    for (const { seed, screens, map } of routes()) {
      const label = `${seed} ${screens}`;
      for (const band of map.bands) {
        expect(band.tiles.length, `${label} ${band.edge}`).toBeGreaterThan(0);
        const offEdge = band.tiles.filter(
          (cell) => borderEdge(cell, map.width, map.height) !== band.edge,
        );
        expect(offEdge, `${label} ${band.edge}`).toEqual([]);
        const notFloor = band.tiles.filter((cell) => tileAt(map.tiles, cell) !== FLOOR);
        expect(notFloor, `${label} ${band.edge}`).toEqual([]);
      }
      for (let index = 0; index + 1 < map.screens.length; index++) {
        const bottom = walkableColumns(map.tiles, map.screens[index].bottom);
        const top = walkableColumns(map.tiles, map.screens[index + 1].top);
        expect(
          top.some((x) => bottom.includes(x)),
          `${label} screen seam ${index}`,
        ).toBe(true);
      }
      const forbidden = map.tiles.flat().filter((value) => value === DOOR || value === EXIT);
      expect(forbidden, label).toEqual([]);
    }
  }, 60_000);

  it('resolves every cell to a frame in the forest tileset', () => {
    for (const { seed, screens, map } of routes()) {
      const mesh = buildFrameMesh(map.tiles, FRLG_FOREST_TILESET);
      expect(mesh.width, `${seed} ${screens}`).toBe(map.width);
      expect(mesh.height, `${seed} ${screens}`).toBe(map.height);
      expect(mesh.frames.length, `${seed} ${screens}`).toBe(map.width * map.height);
      const unresolved = [...mesh.frames].filter((frame) => frame === -1);
      expect(unresolved, `${seed} ${screens}`).toEqual([]);
    }
  }, 120_000);

  it("pins a fixed seed's stitched digest", () => {
    expect(digest(planRegion('alpha'), 'route:1', 3)).toBe(
      '60x160|forest|51,0|N:town:1:51,0.52,0|S:city:1:42,159.43,159|E:lateral:1:59,102.59,103|cb20bz',
    );
  });
});
