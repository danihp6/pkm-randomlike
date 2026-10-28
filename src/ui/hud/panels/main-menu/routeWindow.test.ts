import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../engine/routes/preview', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../engine/routes/preview')>();
  return { ...actual, previewRoute: vi.fn(actual.previewRoute) };
});

import { CARPET, EXIT, FLOOR, WALL } from '../../../../engine/map';
import type { TileMap } from '../../../../engine/map';
import type { PokemonOverworldSheet } from '../../../../data/pokemonOverworld';
import { PORTRAIT_ATLAS_URL } from '../../../../data/portraits';
import { previewRoute, previewWalkers, type PreviewRoom } from '../../../../engine/routes/preview';
import { resolveGroundFrame } from '../../../../engine/tileFrames';
import type { TilesetConfig } from '../../../../engine/tileset';
import { FOLLOWER_FRAME_RATE } from '../../../../render/pokemonFollower';
import {
  ROUTE_PREVIEW_STEP_MS,
  WALK_FRAME_MS,
  WALK_STEP_MS,
  previewOrigin,
  previewRoomFor,
  previewTileBox,
  previewWalkerBox,
  tileBackground,
  walkerPaint,
  type PreviewTileset,
} from './routeWindow';

const DESK = { x: 96, y: 150, w: 560, h: 380 } as const;
const PHONE = { x: 16, y: 126, w: 358, h: 240 } as const;

const MOCKED_ROUTE = vi.mocked(previewRoute);

const TILESET: TilesetConfig = {
  atlas: { tileSize: 16, cols: 4, rows: 13, width: 64, height: 208 },
  frames: { [FLOOR]: 0, [WALL]: 7 },
  commonFrames: { [CARPET]: 4 },
  variants: { [FLOOR]: [0, 1, 2] },
};

const TILES: PreviewTileset = {
  config: TILESET,
  atlasUrl: 'atlas.png',
  commonUrl: 'common.png',
};

function syntheticRoom(...rows: number[][]): PreviewRoom {
  const tiles: TileMap = rows;
  return {
    seed: 'synthetic',
    rect: { x: 0, y: 0, w: 48, h: 48 },
    cols: rows[0]!.length,
    rows: rows.length,
    tile: 24,
    biomeId: 'forest',
    tiles,
    walkable: [],
  };
}

function positionOf(frame: number, cols: number): string {
  return `${-(frame % cols) * 24}px ${-Math.floor(frame / cols) * 24}px`;
}

describe('ROUTE_PREVIEW_STEP_MS', () => {
  it('is the panel’s one timer step', () => {
    expect(ROUTE_PREVIEW_STEP_MS).toBe(600);
  });
});

describe('WALK_STEP_MS', () => {
  it('is the route scene’s own step, inside the model’s tick', () => {
    expect(WALK_STEP_MS).toBe(200);
    expect(WALK_STEP_MS).toBeLessThan(ROUTE_PREVIEW_STEP_MS);
  });

  it('frames the strip at the route follower’s rate', () => {
    expect(WALK_FRAME_MS).toBe(1000 / FOLLOWER_FRAME_RATE);
    expect(WALK_FRAME_MS).toBe(200);
  });
});

describe('previewRoomFor', () => {
  it('builds once per (seed, window) and hands back the same room', () => {
    MOCKED_ROUTE.mockClear();
    const first = previewRoomFor('route-window-cache', DESK);
    const second = previewRoomFor('route-window-cache', DESK);

    expect(second).toBe(first);
    expect(MOCKED_ROUTE).toHaveBeenCalledTimes(1);
    expect(first.rect).toEqual(DESK);
  });

  it('keys the cache by the seed and every window field', () => {
    MOCKED_ROUTE.mockClear();
    const desk = previewRoomFor('route-window-keys', DESK);

    expect(previewRoomFor('route-window-keys', DESK)).toBe(desk);
    expect(previewRoomFor('route-window-keys', PHONE)).not.toBe(desk);
    expect(previewRoomFor('route-window-keys-2', DESK)).not.toBe(desk);
    expect(previewRoomFor('route-window-keys', { ...DESK, x: DESK.x + 1 })).not.toBe(desk);
    expect(MOCKED_ROUTE).toHaveBeenCalledTimes(4);
  });
});

describe('previewOrigin', () => {
  it('centres the tile field inside the window', () => {
    expect(previewOrigin(DESK, previewRoomFor('origin-desk', DESK))).toEqual({ x: 4, y: 10 });
    expect(previewOrigin(PHONE, previewRoomFor('origin-phone', PHONE))).toEqual({ x: 11, y: 0 });
  });

  it('accounts for the window’s own page offset through the rect it was drawn at', () => {
    const room = previewRoomFor('origin-echo', DESK);

    expect(room.cols * 24).toBe(552);
    expect(room.rows * 24).toBe(360);
    expect(previewOrigin(DESK, room)).toEqual({
      x: Math.floor((DESK.w - 552) / 2),
      y: Math.floor((DESK.h - 360) / 2),
    });
  });
});

describe('previewTileBox', () => {
  it('adds the origin to a 24 px cell', () => {
    const room = previewRoomFor('box-desk', DESK);

    expect(previewTileBox(DESK, room, { x: 0, y: 0 })).toEqual({ x: 4, y: 10, w: 24, h: 24 });
    expect(previewTileBox(DESK, room, { x: 22, y: 14 })).toEqual({ x: 532, y: 346, w: 24, h: 24 });
  });

  it('keeps every cell inside the window', () => {
    for (const window of [DESK, PHONE]) {
      const room = previewRoomFor(`box-${window.w}`, window);
      for (let y = 0; y < room.rows; y++) {
        for (let x = 0; x < room.cols; x++) {
          const box = previewTileBox(window, room, { x, y });
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.y).toBeGreaterThanOrEqual(0);
          expect(box.x + box.w).toBeLessThanOrEqual(window.w);
          expect(box.y + box.h).toBeLessThanOrEqual(window.h);
        }
      }
    }
  });
});

describe('previewWalkerBox', () => {
  it('puts a walker on its own tile, one 24 px box', () => {
    const room = previewRoomFor('walker-box', DESK);
    const walkers = previewWalkers(room);

    expect(walkers.length).toBeGreaterThan(0);
    for (const walker of walkers) {
      expect(previewWalkerBox(DESK, room, walker)).toEqual(previewTileBox(DESK, room, walker.tile));
    }
  });
});

describe('tileBackground', () => {
  it('draws the object frame first and the ground last', () => {
    const room = syntheticRoom([WALL]);
    const background = tileBackground(room, { x: 0, y: 0 }, TILES);
    const ground = resolveGroundFrame(room.tiles, 0, 0, TILESET);

    expect(background.images).toEqual(['atlas.png', 'atlas.png']);
    expect(background.positions).toEqual([
      positionOf(7, TILESET.atlas.cols),
      positionOf(ground.frame, TILESET.atlas.cols),
    ]);
    expect(background.positions[0]).toBe('-72px -24px');
    expect(background.size).toBe('96px 312px');
  });

  it('reads a common frame’s atlas while the ground stays on the biome sheet', () => {
    const room = syntheticRoom([CARPET]);

    expect(tileBackground(room, { x: 0, y: 0 }, TILES).images).toEqual(['common.png', 'atlas.png']);
  });

  it('draws one image when the map value has no object frame', () => {
    const room = syntheticRoom([EXIT]);
    const background = tileBackground(room, { x: 0, y: 0 }, TILES);
    const ground = resolveGroundFrame(room.tiles, 0, 0, TILESET);

    expect(background.images).toEqual(['atlas.png']);
    expect(background.positions).toEqual([positionOf(ground.frame, TILESET.atlas.cols)]);
  });
});

/** A committed pair, shaped like `src/assets/pokemon/<fileId>.json` but small enough to pin. */
const SHEET: PokemonOverworldSheet = {
  speciesId: 'pikachu',
  fileId: 25,
  textureKey: 'pokemon:25',
  url: 'pairs/25.png',
  size: 32,
  rows: 5,
  cols: 28,
  dirRows: ['down', 'downright', 'up', 'upright', 'left'],
  anims: {
    idle: { start: 0, count: 3, durationsMs: [1333, 200, 200] },
    walk: { start: 3, count: 6, durationsMs: [133, 133, 133, 133, 133, 133] },
    attack: { start: 9, count: 11, durationsMs: [] },
    special: { start: 20, count: 6, durationsMs: [] },
    hurt: { start: 26, count: 2, durationsMs: [] },
  },
};

const WALKER = { id: 0, speciesId: 'pikachu', tile: { x: 2, y: 3 }, facing: 'S' } as const;

const STILL = { moving: false, frameStep: 0, instant: false } as const;
const STEPPING = { moving: true, frameStep: 1, instant: false } as const;

describe('walkerPaint', () => {
  it('walks on the pair’s own strip, one 24 px cell of the sheet', () => {
    const room = previewRoomFor('walker-paint-south', DESK);
    const paint = walkerPaint(DESK, room, WALKER, STEPPING, SHEET);

    expect(paint.box).toEqual(previewWalkerBox(DESK, room, WALKER));
    expect(paint.box).toEqual({ x: 52, y: 82, w: 24, h: 24 });
    expect(paint.frame).toBe(4);
    expect(paint.backgroundImage).toBe('url("pairs/25.png")');
    expect(paint.backgroundPosition).toBe('-96px 0px');
    expect(paint.backgroundSize).toBe('672px 120px');
    expect(paint.transform).toBe('none');
    expect(paint.transitionMs).toBe(WALK_STEP_MS);
  });

  it('stands on the idle strip’s first frame, whatever the clock says', () => {
    const room = previewRoomFor('walker-paint-idle', DESK);
    const paint = walkerPaint(DESK, room, WALKER, { ...STILL, frameStep: 4 }, SHEET);

    expect(paint.frame).toBe(0);
    expect(paint.backgroundPosition).toBe('0px 0px');
  });

  it('draws the side row flat for E and mirrored for W', () => {
    const room = previewRoomFor('walker-paint-side', DESK);
    const east = walkerPaint(DESK, room, { ...WALKER, facing: 'E' }, STEPPING, SHEET);
    const west = walkerPaint(DESK, room, { ...WALKER, facing: 'W' }, STEPPING, SHEET);

    expect(east.frame).toBe(116);
    expect(east.backgroundPosition).toBe('-96px -96px');
    expect(east.transform).toBe('none');
    expect(west.frame).toBe(116);
    expect(west.backgroundPosition).toBe('-96px -96px');
    expect(west.transform).toBe('scaleX(-1)');
  });

  it('asks for no slide on a first paint and a room change', () => {
    const room = previewRoomFor('walker-paint-instant', DESK);

    expect(walkerPaint(DESK, room, WALKER, { ...STEPPING, instant: true }, SHEET).transitionMs).toBe(0);
    expect(walkerPaint(DESK, room, WALKER, STEPPING, SHEET).transitionMs).toBe(WALK_STEP_MS);
  });

  it('falls back to the species’ portrait when the pair is absent', () => {
    const room = previewRoomFor('walker-paint-portrait', DESK);
    const paint = walkerPaint(DESK, room, WALKER, STEPPING, null);

    expect(paint.frame).toBeNull();
    expect(paint.backgroundImage).toBe(`url("${PORTRAIT_ATLAS_URL}")`);
    expect(paint.backgroundImage).not.toContain('pairs/25.png');
    expect(paint.backgroundSize).toContain('px');
    expect(paint.box).toEqual({ x: 52, y: 82, w: 24, h: 24 });
  });
});
