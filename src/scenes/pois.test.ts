import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => {
  class Scene {}
  return {
    default: {
      Scene,
      Scenes: { Events: { SHUTDOWN: 'shutdown', RESUME: 'resume' } },
      Input: { Keyboard: { KeyCodes: {} } },
    },
  };
});

import { POI_ROWS } from '../data/pois';
import type { NodePoi } from '../engine/region/pois';
import { planNodeContent } from '../engine/region/content';
import { planRegion } from '../engine/region/plan';
import { nodePoi } from '../engine/region/pois';
import { generateRoute } from '../engine/region/route/map';
import { WORLD_OVERLAY_DEPTH } from '../render/tilemapLayer';
import { drawPoi, poiMarkerPoint, poiScreenRect } from './pois';
import type Phaser from 'phaser';

const TILE_SIZE = 24;

const SEED = 'alpha';

/** A stand-in for `scene.add.rectangle`'s chained setters, recording every call. */
class StubRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: number | null;
  stroke: readonly [number, number] | null = null;
  depth = 0;

  constructor(x: number, y: number, width: number, height: number, fill?: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.fill = fill ?? null;
  }

  setStrokeStyle(thickness: number, color: number): this {
    this.stroke = [thickness, color];
    return this;
  }

  setDepth(depth: number): this {
    this.depth = depth;
    return this;
  }
}

function stubScene(): { scene: Phaser.Scene; created: StubRectangle[] } {
  const created: StubRectangle[] = [];
  const rectangle = (
    x: number,
    y: number,
    width: number,
    height: number,
    fill?: number,
  ): StubRectangle => {
    const shape = new StubRectangle(x, y, width, height, fill);
    created.push(shape);
    return shape;
  };
  return { scene: { add: { rectangle } } as unknown as Phaser.Scene, created };
}

function world(): { route: ReturnType<typeof generateRoute>; poi: NodePoi } {
  const plan = planRegion(SEED);
  const lateral = plan.nodes.find((node) => node.kind === 'lateral');
  if (!lateral) throw new Error(`${SEED} planned no lateral`);
  const route = generateRoute(plan, lateral.key);
  const poi = nodePoi(plan, lateral.key, planNodeContent(plan, lateral.key, 1));
  return { route, poi };
}

const SYNTHETIC: NodePoi = {
  nodeKey: 'lateral:1',
  kind: 'trade',
  row: POI_ROWS.trade,
  rect: { x: 3, y: 4, width: 7, height: 5 },
  marker: { x: 5, y: 6 },
  gateKind: null,
  speciesId: null,
};

describe('poiScreenRect', () => {
  it('turns a tile rect into pixels at the handed-in tile size', () => {
    const { route } = world();
    expect(poiScreenRect(route, { x: 3, y: 4, width: 7, height: 5 }, TILE_SIZE)).toEqual({
      x: 72,
      y: 96,
      w: 168,
      h: 120,
    });
  });

  it('scales with the tile size and needs no route of its own', () => {
    const { route } = world();
    expect(poiScreenRect(route, { x: 0, y: 0, width: 2, height: 1 }, 8)).toEqual({
      x: 0,
      y: 0,
      w: 16,
      h: 8,
    });
  });
});

describe('poiMarkerPoint', () => {
  it('answers the middle of the marker tile', () => {
    expect(poiMarkerPoint(world().route, SYNTHETIC, TILE_SIZE)).toEqual({ x: 132, y: 156 });
  });

  it('answers the centre of every real marker at the route’s own zone', () => {
    const { route, poi } = world();
    expect(poiMarkerPoint(route, poi, TILE_SIZE)).toEqual({
      x: poi.marker.x * TILE_SIZE + TILE_SIZE / 2,
      y: poi.marker.y * TILE_SIZE + TILE_SIZE / 2,
    });
    expect(poiMarkerPoint(route, poi, 16)).toEqual({
      x: poi.marker.x * 16 + 8,
      y: poi.marker.y * 16 + 8,
    });
  });
});

describe('drawPoi', () => {
  it('draws the zone outline and the marker, above the tile layers', () => {
    const { route, poi } = world();
    const { scene, created } = stubScene();
    const drawn = drawPoi(scene, route, poi, TILE_SIZE);

    expect(drawn).toHaveLength(2);
    expect(created).toHaveLength(2);

    const zone = poiScreenRect(route, poi.rect, TILE_SIZE);
    const marker = poiMarkerPoint(route, poi, TILE_SIZE);
    const [outline, pin] = created as [StubRectangle, StubRectangle];

    expect(outline.x).toBe(zone.x + zone.w / 2);
    expect(outline.y).toBe(zone.y + zone.h / 2);
    expect(outline.width).toBe(zone.w);
    expect(outline.height).toBe(zone.h);
    expect(outline.stroke).not.toBeNull();
    expect(outline.fill).toBeNull();
    expect(outline.depth).toBeGreaterThan(WORLD_OVERLAY_DEPTH);

    expect(pin.x).toBe(marker.x);
    expect(pin.y).toBe(marker.y);
    expect(pin.width).toBe(TILE_SIZE / 2);
    expect(pin.height).toBe(TILE_SIZE / 2);
    expect(pin.fill).not.toBeNull();
    expect(pin.depth).toBeGreaterThan(WORLD_OVERLAY_DEPTH);
  });

  it('returns what it created, in draw order', () => {
    const { scene, created } = stubScene();
    const drawn = drawPoi(scene, world().route, SYNTHETIC, TILE_SIZE);
    expect(drawn).toEqual(created);
    expect(drawn[0]).not.toBe(drawn[1]);
  });

  it('registers no scene and exports no scene key', async () => {
    const module = (await import('./pois')) as Record<string, unknown>;
    expect(Object.keys(module).sort()).toEqual(['drawPoi', 'poiMarkerPoint', 'poiScreenRect']);
    for (const value of Object.values(module)) expect(typeof value).toBe('function');
  });
});
