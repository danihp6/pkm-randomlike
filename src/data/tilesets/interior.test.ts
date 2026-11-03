import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../../../scripts/legacy-art/png-codec.mjs';
import { hasArt } from '../../assets/art';
import { COUNTER, DOOR, FLOOR, HEAL, PC, WALL } from '../../engine/map';
import { resolveTileFrame } from '../../engine/tileFrames';
import manifest from '../frlg/interior.json';
import { TILESETS } from './index';
import { FRLG_INTERIOR_TILESET, INTERIOR_KIND_VALUES, type InteriorKind } from './interior';

/**
 * The interior atlas is provisional art composed from the two field sheets
 * (`docs/tileset-spec.md` §6) behind a committed manifest; the frames are measured
 * against the generated 64x208 sheet like the forest's and the city's.
 */
const KINDS: readonly InteriorKind[] = ['floor', 'wall', 'door', 'counter', 'heal', 'pc'];

const KIND_VALUES: Readonly<Record<InteriorKind, number>> = {
  floor: FLOOR,
  wall: WALL,
  door: DOOR,
  counter: COUNTER,
  heal: HEAL,
  pc: PC,
};

const BLANK = new URL('../../assets/placeholders/frlg/interior.png', import.meta.url);
const PACKED = new URL('../../assets/frlg/interior.png', import.meta.url);

function cellTiles(png: { width: number; data: Uint8Array }, frame: number): Uint8Array {
  const cols = png.width / 16;
  const col = frame % cols;
  const row = Math.floor(frame / cols);
  const out = new Uint8Array(16 * 16 * 4);
  for (let y = 0; y < 16; y++) {
    const from = ((row * 16 + y) * png.width + col * 16) * 4;
    out.set(png.data.subarray(from, from + 16 * 4), y * 16 * 4);
  }
  return out;
}

function isOpaque(png: { width: number; data: Uint8Array }, frame: number): boolean {
  const bytes = cellTiles(png, frame);
  for (let i = 3; i < bytes.length; i += 4) if (bytes[i] !== 255) return false;
  return true;
}

function meanColour(png: { width: number; data: Uint8Array }, frame: number): number[] {
  const bytes = cellTiles(png, frame);
  const sum = [0, 0, 0];
  for (let i = 0; i < bytes.length; i += 4) {
    sum[0] += bytes[i];
    sum[1] += bytes[i + 1];
    sum[2] += bytes[i + 2];
  }
  return sum.map((channel) => channel / (16 * 16));
}

describe('the interior kinds', () => {
  it('stamps every kind as the map value the generators are frozen against', () => {
    expect(INTERIOR_KIND_VALUES).toEqual(KIND_VALUES);
    expect(Object.keys(INTERIOR_KIND_VALUES)).toEqual([...KINDS]);
  });

  it('reads one frame per kind out of the committed manifest', () => {
    expect(Object.keys(manifest.cells)).toEqual([...KINDS]);
    for (const kind of KINDS) {
      const value = INTERIOR_KIND_VALUES[kind];
      expect(value, kind).toBe(KIND_VALUES[kind]);
      expect(manifest.cells[kind], kind).toBe(FRLG_INTERIOR_TILESET.frames[value]);
      expect(resolveTileFrame([[value]], 0, 0, FRLG_INTERIOR_TILESET)?.frame, kind).toBe(
        FRLG_INTERIOR_TILESET.frames[value],
      );
    }
  });

  it('draws the floor as frame 0 and gives the other five kinds a frame of their own', () => {
    expect(FRLG_INTERIOR_TILESET.frames[FLOOR]).toBe(0);
    expect(manifest.cells.floor).toBe(0);
    const frames = KINDS.filter((kind) => kind !== 'floor').map(
      (kind) => FRLG_INTERIOR_TILESET.frames[INTERIOR_KIND_VALUES[kind]],
    );
    expect(new Set(frames).size).toBe(frames.length);
    expect(frames).not.toContain(0);
    for (const frame of frames) {
      expect(Number.isInteger(frame)).toBe(true);
      expect(frame).toBeGreaterThanOrEqual(1);
      expect(frame).toBeLessThanOrEqual(51);
    }
  });

  it('declares the same 4x13 grid of 16px cells its manifest describes', () => {
    expect(manifest.atlas).toEqual(FRLG_INTERIOR_TILESET.atlas);
    expect(FRLG_INTERIOR_TILESET.atlas).toEqual({
      tileSize: 16,
      cols: 4,
      rows: 13,
      width: 64,
      height: 208,
    });
  });

  it('declares no autotile, no pattern and no variants: one frame per kind', () => {
    expect(FRLG_INTERIOR_TILESET.autotile).toBeUndefined();
    expect(FRLG_INTERIOR_TILESET.wallPattern).toBeUndefined();
    expect(FRLG_INTERIOR_TILESET.variants).toBeUndefined();
    expect(FRLG_INTERIOR_TILESET.wallAdjacentVariants).toBeUndefined();
    expect(FRLG_INTERIOR_TILESET.commonFrames).toBeUndefined();
    expect(FRLG_INTERIOR_TILESET.grassRustle).toBeUndefined();
    expect(FRLG_INTERIOR_TILESET.hiddenItemFrame).toBeUndefined();
  });
});

describe('the committed interior blank', () => {
  it('is a 64x208 sheet, so the manifest slices it into 52 cells', () => {
    const png = decodePng(readFileSync(fileURLToPath(BLANK)));
    expect(png.width).toBe(64);
    expect(png.height).toBe(208);
  });
});

describe.skipIf(hasArt('frlg/interior.png'))('a clone without the pack', () => {
  it('resolves the committed interior blank', () => {
    expect(TILESETS.interior.atlasUrl).toContain('placeholders/frlg/interior.png');
  });
});

describe.skipIf(!hasArt('frlg/interior.png'))('the packed interior atlas', () => {
  it('is a 64x208 sheet with no hole in any of its 52 cells', () => {
    const png = decodePng(readFileSync(fileURLToPath(PACKED)));
    expect(png.width).toBe(64);
    expect(png.height).toBe(208);
    for (let frame = 0; frame < 52; frame++) {
      expect(isOpaque(png, frame), `frame ${frame}`).toBe(true);
    }
  });

  it('draws its kinds in colours a reader can tell apart', () => {
    const png = decodePng(readFileSync(fileURLToPath(PACKED)));
    const means = new Map(KINDS.map((kind) => [kind, meanColour(png, manifest.cells[kind])]));
    const distance = (a: number[], b: number[]): number =>
      Math.max(...a.map((value, channel) => Math.abs(value - b[channel])));
    for (let i = 0; i < KINDS.length; i++) {
      for (let j = i + 1; j < KINDS.length; j++) {
        expect(
          distance(means.get(KINDS[i])!, means.get(KINDS[j])!),
          `${KINDS[i]} vs ${KINDS[j]}`,
        ).toBeGreaterThanOrEqual(12);
      }
    }
  });
});
