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
  FRLG_FOREST_TILESET,
  FRLG_GRASS_RUSTLE_FRAMES,
  FRLG_LEDGE_LEFT,
  FRLG_LEDGE_RIGHT,
  FRLG_TALL_GRASS,
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

/** A cell's pixels, for comparing two cells byte for byte. */
function tileBytes(png: { width: number; data: Uint8Array }, frame: number): Uint8Array {
  const cols = png.width / FRLG_TILE_SIZE;
  const col = frame % cols;
  const row = Math.floor(frame / cols);
  const out = new Uint8Array(FRLG_TILE_SIZE * FRLG_TILE_SIZE * 4);
  for (let y = 0; y < FRLG_TILE_SIZE; y++) {
    const from = ((row * FRLG_TILE_SIZE + y) * png.width + col * FRLG_TILE_SIZE) * 4;
    out.set(png.data.subarray(from, from + FRLG_TILE_SIZE * 4), y * FRLG_TILE_SIZE * 4);
  }
  return out;
}

/** Whether every pixel of a cell is opaque (the rustle closes over the player). */
function tileIsOpaque(png: { width: number; data: Uint8Array }, frame: number): boolean {
  const bytes = tileBytes(png, frame);
  for (let i = 3; i < bytes.length; i += 4) if (bytes[i] !== 255) return false;
  return true;
}

/** A cell's alpha shape: its opaque pixel count and every row's opaque pixel count. */
function cellAlpha(
  png: { width: number; data: Uint8Array },
  frame: number,
): { opaque: number; rows: number[]; opaqueRows: number[] } {
  const bytes = tileBytes(png, frame);
  const rows: number[] = [];
  const opaqueRows: number[] = [];
  let opaque = 0;
  for (let y = 0; y < FRLG_TILE_SIZE; y++) {
    let row = 0;
    for (let x = 0; x < FRLG_TILE_SIZE; x++) {
      if (bytes[(y * FRLG_TILE_SIZE + x) * 4 + 3] > 0) row++;
    }
    rows.push(row);
    if (row > 0) opaqueRows.push(y);
    opaque += row;
  }
  return { opaque, rows, opaqueRows };
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

  it('stamps the tall-grass ground tile', () => {
    for (const name of ATLASES) {
      expect(tileIsBlank(atlas(name), FRLG_TALL_GRASS), `${name} tall grass frame ${FRLG_TALL_GRASS}`).toBe(false);
    }
  });

  it('stamps the five rustle cells raw: the settled rest band and one closing frame', () => {
    expect(FRLG_GRASS_RUSTLE_FRAMES).toEqual([6, 45, 46, 47, 48]);
    for (const name of ATLASES) {
      const png = atlas(name);
      for (const frame of FRLG_GRASS_RUSTLE_FRAMES) {
        expect(tileIsBlank(png, frame), `${name} rustle frame ${frame}`).toBe(false);
      }
      const restFrame = FRLG_GRASS_RUSTLE_FRAMES[0];
      const rest = cellAlpha(png, restFrame);
      // The parked cell is the rip's settled frame, which is the hit's own last frame:
      // the sprite plays 1-4 and parks on art byte-identical to `frames[4]`, so the end
      // of the hit and the standing pose are the same picture (no jump when it settles).
      expect(tileBytes(png, restFrame), `${name} rest frame`).toEqual(tileBytes(png, 48));
      // Its alpha is the rip's own: rows 0-5 are empty, so the opaque band starts at
      // row 6 of 16 - world y 153 at the shipped 1.5 scale - which covers the player's
      // lower half (13.5 of their 28.5 visible px) and leaves the head, face, shoulders
      // and upper torso clear. It is neither the opaque copy of the tall-grass tile nor
      // the blades-only frame the second cut parked on (its band started at row 10).
      expect(rest.rows.slice(0, 6), `${name} rest cell rows 0-5`).toEqual(new Array(6).fill(0));
      expect(rest.opaqueRows[0], `${name} rest cell first blade row`).toBe(6);
      expect(rest.opaque, `${name} rest cell blade pixels`).toBeLessThan((FRLG_TILE_SIZE * FRLG_TILE_SIZE) / 2);
      expect(tileIsOpaque(png, restFrame), `${name} rest cell fully opaque`).toBe(false);
      expect(tileBytes(png, restFrame), `${name} rest frame vs ground`).not.toEqual(tileBytes(png, FRLG_TALL_GRASS));
      // The hit keeps the rip's alpha: its closing frame is the one allowed to cover
      // the cell, the three that flick and settle stay see-through.
      expect(tileIsOpaque(png, 45), `${name} closing frame 45 opaque`).toBe(true);
      for (const frame of [46, 47, 48]) {
        expect(tileIsOpaque(png, frame), `${name} hit frame ${frame} opaque`).toBe(false);
      }
    }
    // The three fields stamp the same five cells, byte for byte.
    for (const frame of FRLG_GRASS_RUSTLE_FRAMES) {
      const reference = tileBytes(atlas(ATLASES[0]), frame);
      for (const name of ATLASES.slice(1)) {
        expect(tileBytes(atlas(name), frame), `${name} rustle frame ${frame}`).toEqual(reference);
      }
    }
  });

  it('leaves the two unused wall-shape cells blank', () => {
    for (const name of ATLASES) {
      for (const frame of [49, 50]) {
        expect(tileIsBlank(atlas(name), frame), `${name} cell ${frame}`).toBe(true);
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

describe('frlg forest floor', () => {
  const FOREST_FRAMES = [
    FRAME_FLOOR,
    FRAME_FLOOR_ALT_1,
    FRAME_FLOOR_ALT_2,
    FRAME_FLOOR_ALT_3,
    FRAME_FLOOR_ALT_4,
  ];

  it('mixes the forest floor from weighted dark-ground frames', () => {
    const variants = FRLG_FOREST_TILESET.variants![FLOOR];
    const weighted = variants.map((entry) => (typeof entry === 'number' ? { frame: entry, weight: 1 } : entry));
    expect(weighted.map((entry) => entry.frame)).toEqual(FOREST_FRAMES);
    // Every tile carries its own positive weight, so the mix has a clear common
    // ground (the heaviest frame first) and a rare flowered ground (the lightest last).
    const weights = weighted.map((entry) => entry.weight);
    expect(weights.every((weight) => Number.isInteger(weight) && weight > 0)).toBe(true);
    expect(new Set(weights).size).toBe(weights.length);
    expect(weights[0]).toBe(Math.max(...weights));
    expect(weights[weights.length - 1]).toBe(Math.min(...weights));
  });

  it('resolves every forest ground cell to a frame in the weighted mix', () => {
    const map: TileMap = Array.from({ length: 10 }, () => new Array<number>(10).fill(FLOOR));
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        expect(FOREST_FRAMES).toContain(resolveGroundFrame(map, x, y, FRLG_FOREST_TILESET).frame);
      }
    }
  });
});
