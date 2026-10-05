import { describe, expect, it } from 'vitest';
import { BIOMES, biomeForRoute } from '../../data/biomes';
import { LEDGE, TALL_GRASS } from '../map';
import { ROUTE_SHAPES, type RouteShape } from './layout';
import { tileKey, type RouteMap } from './routeMap';
import { sketchRoute, type RouteRequest } from './sketch';
import { reachableTiles, validateRoute } from './validate';

/**
 * The terrain pass (tall grass, ledges) is **on** per biome
 * (`docs/routes-spec.md` §2). Both passes may only touch the carved floor off the
 * guaranteed spine, an opening or a pocket, and no ledge may strand a branch
 * behind a one-way drop.
 */
const SEEDS = ['terrain-a', 'terrain-b', 'terrain-c', 'terrain-d'] as const;

function terrainRequest(seed: string, shape: RouteShape, routeIndex = 1): RouteRequest {
  const biome = biomeForRoute(routeIndex);
  return {
    seed,
    routeIndex,
    biomeId: biome.id,
    layout: biome.layout,
    shape,
    grassPatches: biome.terrain.grassPatches,
    ledges: biome.terrain.ledges,
  };
}

function positionsOf(route: RouteMap, kind: number): string[] {
  const found: string[] = [];
  for (let y = 0; y < route.height; y++) {
    for (let x = 0; x < route.width; x++) {
      if (route.tiles[y][x] === kind) found.push(`${x},${y}`);
    }
  }
  return found;
}

describe('route terrain passes', () => {
  it('turns grass and ledges back on for the live biome', () => {
    const biome = biomeForRoute(1);
    expect(biome.terrain.grassPatches).toBeGreaterThan(0);
    expect(biome.terrain.ledges).toBeGreaterThan(0);
    expect(BIOMES[biome.id].terrain).toEqual(biome.terrain);
  });

  it('keeps tall grass off the spine and the openings, and ledges off the pockets too', () => {
    for (const shape of ROUTE_SHAPES) {
      for (const seed of SEEDS) {
        const route = sketchRoute(terrainRequest(seed, shape));
        const open = new Set([...route.spine, route.entry, ...route.exits].map(tileKey));
        const ledgeOff = new Set([...open, ...route.pockets.map(tileKey)]);
        for (const key of positionsOf(route, TALL_GRASS)) {
          expect(open.has(key), `${shape} ${seed} grass ${key}`).toBe(false);
        }
        for (const key of positionsOf(route, LEDGE)) {
          expect(ledgeOff.has(key), `${shape} ${seed} ledge ${key}`).toBe(false);
        }
      }
    }
  });

  it('keeps every exit reachable with terrain on', () => {
    for (const shape of ROUTE_SHAPES) {
      for (const seed of SEEDS) {
        const route = sketchRoute(terrainRequest(seed, shape));
        expect(validateRoute(route).ok, `${shape} ${seed}`).toBe(true);
      }
    }
  });

  it('never strands a walkable branch tile or a pocket behind a one-way ledge', () => {
    for (const shape of ROUTE_SHAPES) {
      for (const seed of SEEDS) {
        const route = sketchRoute(terrainRequest(seed, shape));
        const reached = reachableTiles(route.tiles, route.entry);
        // A ledge may replace a branch tile (that is the point), but every tile
        // still walkable - and every loot pocket - must remain reachable.
        for (const cell of route.branches) {
          const walkable = route.tiles[cell.y][cell.x] !== LEDGE;
          if (!walkable) continue;
          expect(reached.has(tileKey(cell)), `${shape} ${seed} ${cell.x},${cell.y}`).toBe(true);
        }
        for (const pocket of route.pockets) {
          expect(reached.has(tileKey(pocket)), `${shape} ${seed} pocket ${pocket.x},${pocket.y}`).toBe(true);
        }
      }
    }
  });

  it('honours the requested counts: zero places nothing, a count places something', () => {
    for (const shape of ROUTE_SHAPES) {
      const off = sketchRoute({ ...terrainRequest('terrain-a', shape), grassPatches: 0, ledges: 0 });
      expect(positionsOf(off, TALL_GRASS)).toHaveLength(0);
      expect(positionsOf(off, LEDGE)).toHaveLength(0);
    }

    const biome = biomeForRoute(1);
    let grassTotal = 0;
    let ledgeTotal = 0;
    for (const shape of ROUTE_SHAPES) {
      for (const seed of SEEDS) {
        const route = sketchRoute(terrainRequest(seed, shape));
        const grass = positionsOf(route, TALL_GRASS).length;
        const ledges = positionsOf(route, LEDGE).length;
        grassTotal += grass;
        ledgeTotal += ledges;
        // A patch covers at most 4x3 tiles; a ledge line spans at most three.
        expect(grass, `${shape} ${seed} grass`).toBeLessThanOrEqual(biome.terrain.grassPatches * 12);
        expect(ledges, `${shape} ${seed} ledges`).toBeLessThanOrEqual(biome.terrain.ledges * 3);
      }
    }
    expect(grassTotal).toBeGreaterThan(0);
    expect(ledgeTotal).toBeGreaterThan(0);
  });
});
