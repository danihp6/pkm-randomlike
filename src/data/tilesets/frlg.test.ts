import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../../../scripts/legacy-art/png-codec.mjs';
import { FLOOR, WALL, type TileMap } from '../../engine/map';
import { resolveGroundFrame } from '../../engine/tileFrames';
import {
  FRAME_FLOOR,
  FRAME_FLOOR_ALT_1,
  FRAME_FLOOR_ALT_2,
  FRAME_FLOOR_ALT_3,
  FRAME_FLOOR_ALT_4,
  FRAME_FLOOR_ALT_5,
  FRAME_LEDGE,
  TILE_SIZE,
  WATER_SHAPES,
} from '../../engine/tileset';
import {
  FRLG_ATLAS_HEIGHT,
  FRLG_ATLAS_WIDTH,
  FRLG_LEDGE_LEFT,
  FRLG_LEDGE_RIGHT,
  FRLG_TILE_SIZE,
  FRLG_TILESET,
  FRLG_WALL_BASE_FRAMES,
  FRLG_WALL_BODY_FRAMES,
  FRLG_WALL_CROWN_FRAMES,
  FRLG_WALL_LOWER_FRAMES,
  FRLG_WALL_MID_FRAMES,
  FRLG_WALL_TOP_FRAMES,
} from './frlg';

/**
 * The FRLG atlases are committed artifacts (`scripts/frlg/build-tilesets.mjs`),
 * composed off the gitignored `sprite-sources/frlg/` rips. The registry declares a
 * different cell size than the PMD sheets (`D18`), so the declared geometry and
 * every frame the autotiler can return are measured against the real PNGs here
 * instead of trusted.
 */
const ATLASES = ['outdoor', 'forest', 'cave'] as const;

const FLOOR_FRAMES = [
  FRAME_FLOOR,
  FRAME_FLOOR_ALT_1,
  FRAME_FLOOR_ALT_2,
  FRAME_FLOOR_ALT_3,
  FRAME_FLOOR_ALT_4,
  FRAME_FLOOR_ALT_5,
];

function atlas(name: (typeof ATLASES)[number]) {
  return decodePng(readFileSync(fileURLToPath(new URL(`../../assets/frlg/${name}.png`, import.meta.url))));
}

function tileIsBlank(png: { width: number; data: Uint8Array }, frame: number): boolean {
  const cols = png.width / FRLG_TILE_SIZE;
  const col = frame % cols;
  const row = Math.floor(frame / cols);
  for (let y = 0; y < FRLG_TILE_SIZE; y++) {
    for (let x = 0; x < FRLG_TILE_SIZE; x++) {
      const alpha = png.data[(((row * FRLG_TILE_SIZE + y) * png.width) + col * FRLG_TILE_SIZE + x) * 4 + 3];
      if (alpha > 0) return false;
    }
  }
  return true;
}

describe('frlg tileset atlases', () => {
  it('is a 4x13 grid of 16px cells', () => {
    expect(FRLG_TILE_SIZE).toBe(16);
    expect(FRLG_TILESET.atlas.tileSize).toBe(FRLG_TILE_SIZE);
    expect(FRLG_TILESET.atlas.width).toBe(FRLG_ATLAS_WIDTH);
    expect(FRLG_TILESET.atlas.height).toBe(FRLG_ATLAS_HEIGHT);
    for (const name of ATLASES) {
      const png = atlas(name);
      expect(png.width, name).toBe(FRLG_ATLAS_WIDTH);
      expect(png.height, name).toBe(FRLG_ATLAS_HEIGHT);
    }
  });

  it('stamps the solid wall frames and the water shapes the autotiler can return', () => {
    for (const name of ATLASES) {
      const png = atlas(name);
      // The body, crown and lower frames are the tree itself: always stamped. The
      // top and base frames keep a transparent ground so the floor shows through,
      // and their edge columns can be fully transparent (the crown/trunk is
      // narrower than the motif), so only the whole row has to carry art.
      for (const frame of [
        ...FRLG_WALL_BODY_FRAMES,
        ...FRLG_WALL_CROWN_FRAMES,
        ...FRLG_WALL_MID_FRAMES,
        ...FRLG_WALL_LOWER_FRAMES,
      ]) {
        expect(tileIsBlank(png, frame), `${name} wall frame ${frame}`).toBe(false);
      }
      for (const frames of [FRLG_WALL_TOP_FRAMES, FRLG_WALL_BASE_FRAMES]) {
        expect(frames.some((frame) => !tileIsBlank(png, frame)), `${name} wall row`).toBe(true);
      }
      for (const frame of Object.values(WATER_SHAPES)) {
        expect(tileIsBlank(png, frame), `${name} water frame ${frame}`).toBe(false);
      }
    }
  });

  it('stamps the floor and every floor variant', () => {
    for (const name of ATLASES) {
      const png = atlas(name);
      for (const frame of FLOOR_FRAMES) {
        expect(tileIsBlank(png, frame), `${name} floor frame ${frame}`).toBe(false);
      }
    }
  });

  it('stamps the ledge lip and its run end caps', () => {
    for (const name of ATLASES) {
      const png = atlas(name);
      for (const frame of [FRAME_LEDGE, FRLG_LEDGE_LEFT, FRLG_LEDGE_RIGHT]) {
        expect(tileIsBlank(png, frame), `${name} ledge frame ${frame}`).toBe(false);
      }
    }
  });
});

describe('frlg tileset geometry', () => {
  it('scales its 16px cells back up to the 24px world tile by exactly 1.5 (D18)', () => {
    expect(TILE_SIZE).not.toBe(FRLG_TILE_SIZE);
    expect(TILE_SIZE / FRLG_TILE_SIZE).toBe(1.5);
  });

  it('keeps the field ground uniform next to a wall (no lighter path decal)', () => {
    const besideWall: TileMap = [
      [WALL, WALL, WALL],
      [FLOOR, FLOOR, FLOOR],
    ];
    expect(resolveGroundFrame(besideWall, 1, 1, FRLG_TILESET).frame).toBe(FRAME_FLOOR);
    expect(resolveGroundFrame(besideWall, 1, 0, FRLG_TILESET).frame).toBe(FRAME_FLOOR);
  });
});
