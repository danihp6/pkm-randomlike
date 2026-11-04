import { describe, expect, it } from 'vitest';
import { ROUTE_HEIGHTS, ROUTE_WIDTH } from '../../data/region';
import { FRLG_CITY_TILESET } from '../../data/tilesets/city';
import { FRLG_FOREST_TILESET } from '../../data/tilesets/frlg';
import { buildFrameMesh } from '../frameMap';
import { mapFromSketch, type TileMap } from '../map';
import { resolveGroundFrame } from '../tileFrames';
import { planCity } from './city';
import { planRegion } from './plan';
import { generateRoute } from './route';
import { answerNodeRequest, buildNodeMeshes, preloadNode } from './preload';

const SEED = 'task-280';

function indices(mesh: Readonly<{ frames: Int32Array }>): number[] {
  return Array.from(mesh.frames);
}

describe('preloadNode', () => {
  it('resolves a route to the generator’s own map and frames it cell for cell', () => {
    const plan = planRegion(SEED);
    const route = generateRoute(plan, 'route:1');
    const world = preloadNode(SEED, 'route:1');
    expect(world).not.toBeNull();
    if (world === null) return;

    expect(world.key).toBe('route:1');
    expect(world.kind).toBe('route');
    expect(world.tilesetId).toBe('forest');
    expect(world.width).toBe(ROUTE_WIDTH);
    expect(world.height).toBe(route.height);
    expect(ROUTE_HEIGHTS).toContain(world.height);
    expect(world.spawn).toEqual(route.entry);
    expect(world.tiles).toEqual(route.tiles);

    const expected = buildFrameMesh(route.tiles, FRLG_FOREST_TILESET);
    expect(world.meshes.overlay.width).toBe(expected.width);
    expect(world.meshes.overlay.height).toBe(expected.height);
    for (let index = 0; index < expected.frames.length; index++) {
      expect(world.meshes.overlay.frames[index], `cell ${index}`).toBe(expected.frames[index]);
    }
  });

  it('replays the same node for the same seed', () => {
    expect(preloadNode(SEED, 'route:1')).toEqual(preloadNode(SEED, 'route:1'));
  });

  it('resolves a settlement to the city tileset, its spawn and its two meshes', () => {
    const plan = planRegion(SEED);
    const city = planCity(plan, 'city:1');
    const world = preloadNode(SEED, 'city:1');
    expect(world).not.toBeNull();
    if (world === null) return;

    expect(world.kind).toBe('city');
    expect(world.tilesetId).toBe('city');
    expect(world.width).toBe(city.width);
    expect(world.height).toBe(city.height);
    expect(world.spawn).toEqual(city.spawn);
    expect(indices(world.meshes.overlay)).toEqual(
      indices(buildFrameMesh(city.tiles, FRLG_CITY_TILESET)),
    );

    const town = preloadNode(SEED, plan.townKey);
    expect(town?.kind).toBe('town');
    expect(town?.tilesetId).toBe('city');
  });

  it('answers null for an unknown key, a malformed key and a node with no generator', () => {
    expect(preloadNode(SEED, 'city:99')).toBeNull();
    expect(preloadNode(SEED, 'city:')).toBeNull();
    expect(preloadNode(SEED, 'league:1')).toBeNull();
    expect(preloadNode(SEED, 'tower:1')).toBeNull();
    expect(preloadNode(SEED, 'nope:1')).toBeNull();
  });

  it('resolves the Victory Road to its own carver, four screens of the forest', () => {
    const plan = planRegion(SEED);
    const route = generateRoute(plan, 'victory-road:1');
    const world = preloadNode(SEED, 'victory-road:1');
    expect(world).not.toBeNull();
    if (world === null) return;

    expect(world.key).toBe('victory-road:1');
    expect(world.kind).toBe('victory-road');
    expect(world.tilesetId).toBe('forest');
    expect(world.width).toBe(ROUTE_WIDTH);
    expect(world.height).toBe(ROUTE_HEIGHTS[2]);
    expect(world.height).toBe(200);
    expect(world.spawn).toEqual(route.entry);
    expect(world.tiles).toEqual(route.tiles);
    expect(world.meshes.overlay.width).toBe(ROUTE_WIDTH);
    expect(world.meshes.overlay.height).toBe(world.height);
    expect(world.meshes.ground.width).toBe(ROUTE_WIDTH);
    expect(world.meshes.ground.height).toBe(world.height);
  });
});

describe('buildNodeMeshes', () => {
  const tiles: TileMap = mapFromSketch(['########', '#......#', '#..~~..#', '#......#', '########']);

  it('lays the floor under every cell of the tile mesh', () => {
    const meshes = buildNodeMeshes(tiles, FRLG_FOREST_TILESET);
    expect(meshes.ground.width).toBe(meshes.overlay.width);
    expect(meshes.ground.height).toBe(meshes.overlay.height);
    expect(meshes.ground.frames).toHaveLength(meshes.overlay.frames.length);
    expect(indices(meshes.overlay)).toEqual(indices(buildFrameMesh(tiles, FRLG_FOREST_TILESET)));
    for (let y = 0; y < meshes.overlay.height; y++) {
      for (let x = 0; x < meshes.overlay.width; x++) {
        const index = y * meshes.overlay.width + x;
        expect(meshes.ground.frames[index], `cell ${x},${y}`).toBe(
          resolveGroundFrame(tiles, x, y, FRLG_FOREST_TILESET).frame,
        );
      }
    }
  });

  it('frames the padded map when a pad is asked for, and the plain one by default', () => {
    const plain = buildNodeMeshes(tiles, FRLG_CITY_TILESET);
    expect(buildNodeMeshes(tiles, FRLG_CITY_TILESET, 0)).toEqual(plain);
    expect(buildNodeMeshes(tiles, FRLG_CITY_TILESET, 2).overlay.width).toBe(plain.overlay.width);
  });
});

describe('answerNodeRequest', () => {
  it('reports an unknown key instead of throwing', () => {
    const reply = answerNodeRequest({ seed: SEED, key: 'nope:1' });
    expect(reply.ok).toBe(false);
    if (reply.ok) return;
    expect(reply.key).toBe('nope:1');
    expect(reply.error.length).toBeGreaterThan(0);
  });

  it('names the generator a node is still missing', () => {
    expect(answerNodeRequest({ seed: SEED, key: 'league:1' })).toEqual({
      ok: false,
      key: 'league:1',
      error: 'no generator for league:1',
    });
  });

  it('answers a drawable node with a world a worker can post back', () => {
    const reply = answerNodeRequest({ seed: SEED, key: 'route:1' });
    expect(reply.ok).toBe(true);
    if (!reply.ok) return;
    expect(reply.key).toBe('route:1');
    expect(reply.world.key).toBe('route:1');
    expect(structuredClone(reply)).toEqual(reply);
  });
});
