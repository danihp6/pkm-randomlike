import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../../../scripts/legacy-art/png-codec.mjs';
// The packers are plain ESM under `scripts/`, outside the TypeScript program, so
// the one pure check this suite exercises is imported untyped.
// @ts-expect-error no declaration for the interior packer
import { assertKindInLayout } from '../../../scripts/frlg/build-interior-tilesets.mjs';
import { hasArt } from '../../assets/art';
import { COUNTER, DOOR, FLOOR, HEAL, PC, WALL } from '../../engine/map';
import { resolveTileFrame } from '../../engine/tileFrames';
import { TILESETS } from './index';
import centreManifest from '../frlg/interior-centre.json';
import houseManifest from '../frlg/interior-house.json';
import labManifest from '../frlg/interior-lab.json';
import manifest from '../frlg/interior.json';
import {
  FRLG_CENTRE_TILESET,
  FRLG_HOUSE_TILESET,
  FRLG_INTERIOR_TILESET,
  FRLG_LAB_TILESET,
  INTERIOR_KIND_VALUES,
  type InteriorKind,
} from './interior';
import type { TilesetConfig } from '../../engine/tileset';

/**
 * The interior atlas is provisional art composed from the two field sheets
 * (`docs/tileset-spec.md` §6) behind a committed manifest; the three
 * `interior-*` fields are the decomp's own metatiles (`§2b`). The frames are
 * measured against the generated 64x208 sheets like the forest's and the city's.
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

/** The pinned decomp metatile each field's kinds are composed from (§2b). */
const PINNED: Readonly<Record<string, Readonly<Record<InteriorKind, number>>>> = {
  'interior-lab': { floor: 649, wall: 105, door: 665, counter: 641, heal: 685, pc: 117 },
  'interior-centre': { floor: 641, wall: 644, door: 27, counter: 692, heal: 715, pc: 736 },
  'interior-house': { floor: 273, wall: 172, door: 27, counter: 327, heal: 335, pc: 341 },
};

type FieldManifest = Readonly<{
  id: string;
  atlas: Readonly<Record<string, number>>;
  cells: Readonly<Record<InteriorKind, number>>;
  metatiles: Readonly<Record<InteriorKind, number>>;
}>;

/** The three fields the region's lab, Centre and houses draw (`docs/tileset-spec.md` §2b). */
type FieldId = 'interior-lab' | 'interior-centre' | 'interior-house';

const FIELDS: readonly Readonly<{
  id: FieldId;
  config: TilesetConfig;
  manifest: FieldManifest;
}>[] = [
  { id: 'interior-lab', config: FRLG_LAB_TILESET, manifest: labManifest },
  { id: 'interior-centre', config: FRLG_CENTRE_TILESET, manifest: centreManifest },
  { id: 'interior-house', config: FRLG_HOUSE_TILESET, manifest: houseManifest },
];

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

function source(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
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

describe('the lab, the Centre and the house fields', () => {
  it('each ship a 4x13 manifest of 16px cells', () => {
    for (const field of FIELDS) {
      expect(field.manifest.id, field.id).toBe(field.id);
      expect(field.manifest.atlas, field.id).toEqual({
        tileSize: 16,
        cols: 4,
        rows: 13,
        width: 64,
        height: 208,
      });
      expect(field.config.atlas, field.id).toEqual(field.manifest.atlas);
    }
  });

  it('order their cells floor, wall, door, counter, heal, pc', () => {
    for (const field of FIELDS) {
      expect(Object.keys(field.manifest.cells), field.id).toEqual([...KINDS]);
      expect(Object.keys(field.manifest.metatiles), field.id).toEqual([...KINDS]);
    }
  });

  it('draw the floor as frame 0 and give the other five kinds a frame of their own', () => {
    for (const field of FIELDS) {
      expect(field.config.frames[FLOOR], field.id).toBe(0);
      expect(field.manifest.cells.floor, field.id).toBe(0);
      const frames = KINDS.filter((kind) => kind !== 'floor').map(
        (kind) => field.config.frames[INTERIOR_KIND_VALUES[kind]],
      );
      expect(new Set(frames).size, field.id).toBe(frames.length);
      expect(frames, field.id).not.toContain(0);
      for (const frame of frames) {
        expect(Number.isInteger(frame), field.id).toBe(true);
        expect(frame, field.id).toBeGreaterThanOrEqual(1);
        expect(frame, field.id).toBeLessThanOrEqual(51);
      }
    }
  });

  it('read each kind off its own committed manifest', () => {
    for (const field of FIELDS) {
      for (const kind of KINDS) {
        const value = INTERIOR_KIND_VALUES[kind];
        expect(field.manifest.cells[kind], `${field.id} ${kind}`).toBe(field.config.frames[value]);
        expect(resolveTileFrame([[value]], 0, 0, field.config)?.frame, `${field.id} ${kind}`).toBe(
          field.config.frames[value],
        );
      }
    }
  });

  it('pin the decomp metatile each cell was composed from', () => {
    for (const field of FIELDS) expect(field.manifest.metatiles, field.id).toEqual(PINNED[field.id]);
  });

  it('declare no autotile, no pattern and no variants: one frame per kind', () => {
    for (const field of FIELDS) {
      expect(field.config.autotile, field.id).toBeUndefined();
      expect(field.config.wallPattern, field.id).toBeUndefined();
      expect(field.config.variants, field.id).toBeUndefined();
      expect(field.config.wallAdjacentVariants, field.id).toBeUndefined();
      expect(field.config.commonFrames, field.id).toBeUndefined();
      expect(field.config.grassRustle, field.id).toBeUndefined();
      expect(field.config.hiddenItemFrame, field.id).toBeUndefined();
    }
  });

  it('refuse a metatile id its layout does not place', () => {
    const layout = new Set([649, 105, 665, 641, 685, 117]);
    expect(() => assertKindInLayout(PINNED['interior-lab'], layout, 'interior-lab')).not.toThrow();
    expect(() =>
      assertKindInLayout({ ...PINNED['interior-lab'], door: 666 }, layout, 'interior-lab'),
    ).toThrow(/interior-lab: the door metatile 666 is not in the layout's map\.bin/);
  });
});

describe('the committed interior blanks', () => {
  it('are 64x208 sheets, so each manifest slices into 52 cells', () => {
    const png = decodePng(readFileSync(fileURLToPath(BLANK)));
    expect(png.width).toBe(64);
    expect(png.height).toBe(208);
    for (const field of FIELDS) {
      const blank = decodePng(
        readFileSync(
          fileURLToPath(new URL(`../../assets/placeholders/frlg/${field.id}.png`, import.meta.url)),
        ),
      );
      expect([blank.width, blank.height], field.id).toEqual([64, 208]);
    }
  });
});

describe('the two room scenes', () => {
  it('draw the room kind its own field', () => {
    for (const file of ['../../scenes/InteriorScene.ts', '../../scenes/services.ts']) {
      const text = source(file);
      expect(text, file).toContain('interiorTilesetId');
      expect(text, file).not.toContain('FRLG_INTERIOR_TILESET');
    }
  });

  it('leave the gym on the provisional field', () => {
    expect(source('../../scenes/GymScene.ts')).toContain('FRLG_INTERIOR_TILESET');
  });
});

describe.skipIf(hasArt('frlg/interior.png'))('a clone without the pack', () => {
  it('resolves the committed interior blank', () => {
    expect(TILESETS.interior.atlasUrl).toContain('placeholders/frlg/interior.png');
  });
});

for (const field of FIELDS) {
  describe.skipIf(hasArt(`frlg/${field.id}.png`))(`a clone without the ${field.id} pack`, () => {
    it('resolves the committed blank', () => {
      expect(TILESETS[field.id].atlasUrl).toContain(`placeholders/frlg/${field.id}.png`);
    });
  });

  describe.skipIf(!hasArt(`frlg/${field.id}.png`))(`the packed ${field.id} atlas`, () => {
    const packed = (): { width: number; height: number; data: Uint8Array } =>
      decodePng(
        readFileSync(fileURLToPath(new URL(`../../assets/frlg/${field.id}.png`, import.meta.url))),
      );

    it('is a 64x208 sheet with no hole in any of its 52 cells', () => {
      const png = packed();
      expect(png.width).toBe(64);
      expect(png.height).toBe(208);
      for (let frame = 0; frame < 52; frame++) expect(isOpaque(png, frame), `frame ${frame}`).toBe(true);
    });

    it('draws its kinds in colours a reader can tell apart', () => {
      const png = packed();
      const means = new Map(KINDS.map((kind) => [kind, meanColour(png, field.manifest.cells[kind])]));
      const distance = (a: number[], b: number[]): number =>
        Math.max(...a.map((value, channel) => Math.abs(value - b[channel])));
      for (let i = 0; i < KINDS.length; i++) {
        for (let j = i + 1; j < KINDS.length; j++) {
          expect(
            distance(means.get(KINDS[i])!, means.get(KINDS[j])!),
            `${field.id} ${KINDS[i]} vs ${KINDS[j]}`,
          ).toBeGreaterThanOrEqual(12);
        }
      }
    });
  });
}

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
