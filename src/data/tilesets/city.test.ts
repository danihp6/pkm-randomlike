import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../../../scripts/legacy-art/png-codec.mjs';
import { hasArt } from '../../assets/art';
import { FLOOR, PATH, PLAZA, ROOF, SIGN, TALL_GRASS, WALL, WATER, DOOR } from '../../engine/map';
import { resolveTileFrame } from '../../engine/tileFrames';
import { TILESETS } from './index';
import { CITY_KIND_VALUES, FRLG_CITY_TILESET, type CityKind } from './city';
import manifest from '../frlg/city.json';

/**
 * The city atlas is a committed manifest (`scripts/frlg/build-region-tilesets.mjs`)
 * and a generated 64x208 sheet; the layout is measured against both instead of
 * trusted, so a crop that slips a frame cannot pass unnoticed.
 */
const KINDS: readonly CityKind[] = ['grass', 'path', 'plaza', 'wall', 'roof', 'door', 'water', 'sign'];

const KIND_VALUES: Readonly<Record<CityKind, number>> = {
  grass: TALL_GRASS,
  path: PATH,
  plaza: PLAZA,
  wall: WALL,
  roof: ROOF,
  door: DOOR,
  water: WATER,
  sign: SIGN,
};

const BLANK = new URL('../../assets/placeholders/frlg/city.png', import.meta.url);
const PACKED = new URL('../../assets/frlg/city.png', import.meta.url);

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

describe('the city kinds', () => {
  it('stamps every kind as the map value the generators are frozen against', () => {
    expect(CITY_KIND_VALUES).toEqual(KIND_VALUES);
    expect(Object.keys(CITY_KIND_VALUES)).toEqual([...KINDS]);
  });

  it('reads one frame per kind out of the committed manifest', () => {
    expect(Object.keys(manifest.cells)).toEqual([...KINDS]);
    for (const kind of KINDS) {
      const value = CITY_KIND_VALUES[kind];
      expect(value, kind).toBe(KIND_VALUES[kind]);
      expect(manifest.cells[kind], kind).toBe(FRLG_CITY_TILESET.frames[value]);
      expect(resolveTileFrame([[value]], 0, 0, FRLG_CITY_TILESET)?.frame, kind).toBe(
        FRLG_CITY_TILESET.frames[value],
      );
    }
  });

  it('lays the pavement on frame 0 and gives every kind a frame of its own', () => {
    expect(FRLG_CITY_TILESET.frames[FLOOR]).toBe(0);
    const frames = KINDS.map((kind) => FRLG_CITY_TILESET.frames[CITY_KIND_VALUES[kind]]);
    expect(new Set(frames).size).toBe(frames.length);
    expect(frames).not.toContain(0);
    for (const frame of frames) {
      expect(Number.isInteger(frame)).toBe(true);
      expect(frame).toBeGreaterThanOrEqual(1);
      expect(frame).toBeLessThanOrEqual(51);
    }
  });

  it('declares the same 4x13 grid of 16px cells its manifest describes', () => {
    expect(manifest.atlas).toEqual(FRLG_CITY_TILESET.atlas);
    expect(FRLG_CITY_TILESET.atlas).toEqual({
      tileSize: 16,
      cols: 4,
      rows: 13,
      width: 64,
      height: 208,
    });
  });

  it('declares no autotile, no pattern and no variants: one frame per kind', () => {
    expect(FRLG_CITY_TILESET.autotile).toBeUndefined();
    expect(FRLG_CITY_TILESET.wallPattern).toBeUndefined();
    expect(FRLG_CITY_TILESET.variants).toBeUndefined();
    expect(FRLG_CITY_TILESET.wallAdjacentVariants).toBeUndefined();
    expect(FRLG_CITY_TILESET.commonFrames).toBeUndefined();
    expect(FRLG_CITY_TILESET.grassRustle).toBeUndefined();
    expect(FRLG_CITY_TILESET.hiddenItemFrame).toBeUndefined();
  });
});

describe('the committed city blank', () => {
  it('is a 64x208 sheet, so the manifest slices it into 52 cells', () => {
    const png = decodePng(readFileSync(fileURLToPath(BLANK)));
    expect(png.width).toBe(64);
    expect(png.height).toBe(208);
  });
});

describe.skipIf(hasArt('frlg/city.png'))('a clone without the pack', () => {
  it('resolves the committed city blank', () => {
    expect(TILESETS.city.atlasUrl).toContain('placeholders/frlg/city.png');
  });
});

describe.skipIf(!hasArt('frlg/city.png'))('the packed city atlas', () => {
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
    expect(distance(means.get('door')!, means.get('wall')!)).toBeGreaterThanOrEqual(25);
  });
});
