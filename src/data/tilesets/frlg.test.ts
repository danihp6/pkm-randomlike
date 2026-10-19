import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../../../scripts/legacy-art/png-codec.mjs';
import { BUSH, FLOOR, ROCK, WALL, WATER, type TileMap } from '../../engine/map';
import { resolveGroundFrame, resolveTileFrame } from '../../engine/tileFrames';
import {
  FRAME_FLOOR,
  FRAME_FLOOR_ALT_1,
  FRAME_FLOOR_ALT_2,
  FRAME_FLOOR_ALT_3,
  FRAME_FLOOR_ALT_4,
  FRAME_FLOOR_ALT_5,
  FRAME_LEDGE,
  FRAME_WATER_INTERIOR,
  TILE_SIZE,
  WATER_SHAPES,
} from '../../engine/tileset';
import {
  FRLG_ATLAS_HEIGHT,
  FRLG_ATLAS_WIDTH,
  FRLG_FOREST_TILESET,
  FRLG_GRASS_RUSTLE_FRAMES,
  FRLG_GRASS_RUSTLE_TINT_FOREST,
  FRLG_LEDGE_LEFT,
  FRLG_LEDGE_RIGHT,
  FRLG_OBSTACLE_BUSH,
  FRLG_OBSTACLE_ROCK,
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
const ATLASES = ['forest'] as const;

const FLOOR_FRAMES = [
  FRAME_FLOOR,
  FRAME_FLOOR_ALT_1,
  FRAME_FLOOR_ALT_2,
  FRAME_FLOOR_ALT_3,
  FRAME_FLOOR_ALT_4,
  FRAME_FLOOR_ALT_5,
];

function atlas(name: (typeof ATLASES)[number]) {
  return decodePng(
    readFileSync(fileURLToPath(new URL(`../../assets/frlg/${name}.png`, import.meta.url))),
  );
}

function tileIsBlank(png: { width: number; data: Uint8Array }, frame: number): boolean {
  const cols = png.width / FRLG_TILE_SIZE;
  const col = frame % cols;
  const row = Math.floor(frame / cols);
  for (let y = 0; y < FRLG_TILE_SIZE; y++) {
    for (let x = 0; x < FRLG_TILE_SIZE; x++) {
      const alpha =
        png.data[((row * FRLG_TILE_SIZE + y) * png.width + col * FRLG_TILE_SIZE + x) * 4 + 3];
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

/**
 * A cell's mean colour per channel over its **opaque** pixels only: the rustle cells
 * keep the rip's own alpha, so only the pixels that actually draw a blade count.
 */
function tileMean(png: { width: number; data: Uint8Array }, frame: number): number[] {
  const bytes = tileBytes(png, frame);
  const sum = [0, 0, 0];
  let opaque = 0;
  for (let i = 0; i < bytes.length; i += 4) {
    if (bytes[i + 3] === 0) continue;
    sum[0] += bytes[i];
    sum[1] += bytes[i + 1];
    sum[2] += bytes[i + 2];
    opaque++;
  }
  return sum.map((channel) => channel / opaque);
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
        expect(
          frames.some((frame) => !tileIsBlank(png, frame)),
          `${name} wall row`,
        ).toBe(true);
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
      expect(
        tileIsBlank(atlas(name), FRLG_TALL_GRASS),
        `${name} tall grass frame ${FRLG_TALL_GRASS}`,
      ).toBe(false);
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
      expect(rest.opaque, `${name} rest cell blade pixels`).toBeLessThan(
        (FRLG_TILE_SIZE * FRLG_TILE_SIZE) / 2,
      );
      expect(tileIsOpaque(png, restFrame), `${name} rest cell fully opaque`).toBe(false);
      expect(tileBytes(png, restFrame), `${name} rest frame vs ground`).not.toEqual(
        tileBytes(png, FRLG_TALL_GRASS),
      );
      // The hit keeps the rip's alpha: its closing frame is the one allowed to cover
      // the cell, the three that flick and settle stay see-through.
      expect(tileIsOpaque(png, 45), `${name} closing frame 45 opaque`).toBe(true);
      for (const frame of [46, 47, 48]) {
        expect(tileIsOpaque(png, frame), `${name} hit frame ${frame} opaque`).toBe(false);
      }
    }
  });

  it("declares the forest's rustle tint and leaves the shared field untinted", () => {
    // The shared field layout carries no tint of its own; the forest declares one.
    expect(FRLG_TILESET.grassRustleTint).toBe(0xffffff);
    expect(FRLG_FOREST_TILESET.grassRustleTint).toBe(FRLG_GRASS_RUSTLE_TINT_FOREST);
    expect(FRLG_GRASS_RUSTLE_TINT_FOREST).toBe(0xc1d7ef);
  });

  it("tints the rustle overlay into the forest's own tall-grass palette", () => {
    // The tinted parked cell may not read lighter than the tuft it parks on, and it
    // may not sink into a black blob; the hit's flashes stay within the same band.
    const LIGHTER = 6;
    const DARKER = 30;
    const FIELDS = [{ name: 'forest', config: FRLG_FOREST_TILESET }] as const;

    for (const { name, config } of FIELDS) {
      const png = atlas(name);
      const tint = config.grassRustleTint ?? 0xffffff;
      // The route's own arithmetic: a multiplicative tint is per channel.
      const tinted = (frame: number): number[] =>
        tileMean(png, frame).map((mean, channel) =>
          Math.round((mean * ((tint >> (8 * (2 - channel))) & 0xff)) / 255),
        );
      const tuft = tileMean(png, FRLG_TALL_GRASS).map(Math.round);
      const parked = tinted(FRLG_GRASS_RUSTLE_FRAMES[0]);
      for (let channel = 0; channel < 3; channel++) {
        expect(
          parked[channel] - tuft[channel],
          `${name} parked cell channel ${channel}`,
        ).toBeLessThanOrEqual(LIGHTER);
        expect(
          parked[channel] - tuft[channel],
          `${name} parked cell channel ${channel}`,
        ).toBeGreaterThanOrEqual(-DARKER);
      }
      for (const frame of FRLG_GRASS_RUSTLE_FRAMES.slice(1)) {
        const hit = tinted(frame);
        for (let channel = 0; channel < 3; channel++) {
          expect(
            Math.abs(hit[channel] - tuft[channel]),
            `${name} hit cell ${frame} channel ${channel}`,
          ).toBeLessThanOrEqual(DARKER);
        }
      }
      // The shipped numbers: the tint lands the parked cell on the dark tuft exactly.
      expect(parked).toEqual([59, 125, 76]);
      expect(FRLG_GRASS_RUSTLE_FRAMES.slice(1).map(tinted)).toEqual([
        [61, 137, 95],
        [76, 144, 79],
        [69, 135, 70],
        [59, 125, 76],
      ]);
      // Untinted it is 78,148,81 - +19/+23/+5 lighter, the lighter green the report saw -
      // so the forest is the field the tint has to close.
      const untinted = tileMean(png, FRLG_GRASS_RUSTLE_FRAMES[0]).map(Math.round);
      expect(untinted.some((value, channel) => value - tuft[channel] > LIGHTER)).toBe(true);
    }
  });

  it('starts each rustle cell at the row the overlay clips to', () => {
    // The rustle builder clips the overlay to the cell's rows 6-15 (`setCrop(0, 6, 16, 10)`), so
    // every frame of the beat stops at the player's hips. The art's own first blade row is what
    // makes that clip load-bearing: the parked cell starts exactly at the clip row, the three
    // trim-carrying hit frames above it and the closing frame at the very top of the cell.
    const FIRST_BLADE_ROW: Readonly<Record<number, number>> = { 6: 6, 45: 0, 46: 2, 47: 5, 48: 6 };
    for (const name of ATLASES) {
      const png = atlas(name);
      for (const frame of FRLG_GRASS_RUSTLE_FRAMES) {
        const alpha = cellAlpha(png, frame);
        expect(alpha.opaqueRows[0], `${name} cell ${frame} first blade row`).toBe(
          FIRST_BLADE_ROW[frame],
        );
        // Every cell still draws inside the clipped band, so the clip never blanks a frame.
        expect(
          alpha.rows.slice(6).some((row) => row > 0),
          `${name} cell ${frame} art below the clip`,
        ).toBe(true);
      }
    }
  });

  it('stamps the two obstacle seals into the dead wall-shape cells', () => {
    expect([FRLG_OBSTACLE_BUSH, FRLG_OBSTACLE_ROCK]).toEqual([49, 50]);
    for (const name of ATLASES) {
      const png = atlas(name);
      for (const frame of [FRLG_OBSTACLE_BUSH, FRLG_OBSTACLE_ROCK]) {
        expect(tileIsBlank(png, frame), `${name} seal cell ${frame}`).toBe(false);
        // A seal covers its whole cell: it is a solid obstacle, not a decal over it.
        expect(tileIsOpaque(png, frame), `${name} seal cell ${frame} opaque`).toBe(true);
      }
      expect(tileBytes(png, FRLG_OBSTACLE_BUSH), `${name} bush vs rock`).not.toEqual(
        tileBytes(png, FRLG_OBSTACLE_ROCK),
      );
      // The bush is the tree bank's lower leaves re-grounded onto the field's floor,
      // so its ground is keyed away and the floor it is stamped over shows through.
      expect(tileBytes(png, FRLG_OBSTACLE_BUSH), `${name} bush vs floor`).not.toEqual(
        tileBytes(png, FRAME_FLOOR),
      );
    }
  });
});

describe('frlg tileset geometry', () => {
  it('scales its 16px cells back up to the 24px world tile by exactly 1.5 (D18)', () => {
    expect(TILE_SIZE).not.toBe(FRLG_TILE_SIZE);
    expect(TILE_SIZE / FRLG_TILE_SIZE).toBe(1.5);
  });

  it('wires both obstacle seals, and the forest field inherits them', () => {
    expect(FRLG_TILESET.frames[BUSH]).toBe(FRLG_OBSTACLE_BUSH);
    expect(FRLG_TILESET.frames[ROCK]).toBe(FRLG_OBSTACLE_ROCK);
    expect(FRLG_FOREST_TILESET.frames[BUSH]).toBe(FRLG_OBSTACLE_BUSH);
    expect(FRLG_FOREST_TILESET.frames[ROCK]).toBe(FRLG_OBSTACLE_ROCK);

    const seals: TileMap = [
      [FLOOR, FLOOR, FLOOR],
      [FLOOR, BUSH, ROCK],
      [FLOOR, FLOOR, FLOOR],
    ];
    expect(resolveTileFrame(seals, 1, 1, FRLG_TILESET)?.frame).toBe(FRLG_OBSTACLE_BUSH);
    expect(resolveTileFrame(seals, 2, 1, FRLG_TILESET)?.frame).toBe(FRLG_OBSTACLE_ROCK);
  });

  it('draws a one-tile pond through the water rule, as its interior cell', () => {
    const pond: TileMap = [
      [FLOOR, FLOOR, FLOOR],
      [FLOOR, WATER, FLOOR],
      [FLOOR, FLOOR, FLOOR],
    ];
    expect(FRLG_TILESET.frames[WATER]).toBe(WATER_SHAPES.interior);
    expect(resolveTileFrame(pond, 1, 1, FRLG_TILESET)?.frame).toBe(FRAME_WATER_INTERIOR);
    expect(FRLG_TILESET.frames[WATER]).toBe(FRAME_WATER_INTERIOR);
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
    const weighted = variants.map((entry) =>
      typeof entry === 'number' ? { frame: entry, weight: 1 } : entry,
    );
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
