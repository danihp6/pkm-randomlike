import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../../../scripts/legacy-art/png-codec.mjs';
import { hasArt } from '../../assets/art';
import type { BuildingKind } from '../../engine/region/city/plan';
import manifest from '../frlg/city-buildings.json';
import {
  buildingFrameFor,
  CITY_BUILDING_COLS,
  CITY_BUILDING_H,
  CITY_BUILDING_ROWS,
  CITY_BUILDING_SPRITES,
  CITY_BUILDING_W,
} from './cityBuildings';

// The atlas is a committed-size crop of the buildings compendium
// (`scripts/frlg/build-city-buildings.mjs`), so its frozen geometry, the door
// column each frame declares and the fact every frame carries art are measured
// here rather than trusted: a repack that shifts a rect fails instead of drawing
// an invisible or door-less house.
const KINDS: readonly BuildingKind[] = ['centre', 'gym', 'lab', 'house', 'casino'];
const FRAME_TILES_WIDE = 5;

function atlas(path: string) {
  if (!hasArt(path)) return { width: 0, height: 0, data: new Uint8Array() };
  const url = new URL(`../../assets/${path}`, import.meta.url);
  return decodePng(readFileSync(fileURLToPath(url)));
}

function frameHasArt(png: { width: number; data: Uint8Array }, frame: number): boolean {
  const col = frame % CITY_BUILDING_COLS;
  const row = Math.floor(frame / CITY_BUILDING_COLS);
  for (let y = 0; y < CITY_BUILDING_H; y++) {
    for (let x = 0; x < CITY_BUILDING_W; x++) {
      const alpha =
        png.data[((row * CITY_BUILDING_H + y) * png.width + col * CITY_BUILDING_W + x) * 4 + 3];
      if (alpha > 0) return true;
    }
  }
  return false;
}

describe('city buildings atlas', () => {
  it('keeps the 80x96 frames and the 4x1 grid the plan and the scene draw', () => {
    expect(CITY_BUILDING_W).toBe(80);
    expect(CITY_BUILDING_H).toBe(96);
    expect(CITY_BUILDING_COLS).toBe(4);
    expect(CITY_BUILDING_ROWS).toBe(1);
    expect(manifest.width).toBe(CITY_BUILDING_W);
    expect(manifest.height).toBe(CITY_BUILDING_H);
    expect(manifest.cols).toBe(CITY_BUILDING_COLS);
    expect(manifest.rows).toBe(CITY_BUILDING_ROWS);
    expect(manifest.frames).toHaveLength(CITY_BUILDING_COLS * CITY_BUILDING_ROWS);
    expect(CITY_BUILDING_SPRITES).toHaveLength(manifest.frames.length);
  });

  it('names a frame for every kind the plan emits, the house standing in for the casino', () => {
    const house = buildingFrameFor('house', 0);
    for (const kind of KINDS) {
      const frame = buildingFrameFor(kind, 0);
      expect(Number.isInteger(frame), kind).toBe(true);
      expect(frame, kind).toBeGreaterThanOrEqual(0);
      expect(frame, kind).toBeLessThan(CITY_BUILDING_COLS * CITY_BUILDING_ROWS);
    }
    expect(CITY_BUILDING_SPRITES.map((sprite) => sprite.kind)).toContain('centre');
    expect(CITY_BUILDING_SPRITES.map((sprite) => sprite.kind)).toContain('gym');
    expect(CITY_BUILDING_SPRITES.map((sprite) => sprite.kind)).toContain('lab');
    expect(CITY_BUILDING_SPRITES.map((sprite) => sprite.kind)).toContain('house');
    expect(buildingFrameFor('casino', 0)).toBe(house);
  });

  it('never answers a door column outside the frame', () => {
    for (const sprite of CITY_BUILDING_SPRITES) {
      expect(sprite.door, sprite.kind).toBeGreaterThanOrEqual(0);
      expect(sprite.door, sprite.kind).toBeLessThan(FRAME_TILES_WIDE);
    }
    for (const kind of KINDS) {
      for (let index = -4; index < 8; index++) {
        const sprite = CITY_BUILDING_SPRITES[buildingFrameFor(kind, index)];
        expect(sprite.door, `${kind} ${index}`).toBeGreaterThanOrEqual(0);
        expect(sprite.door, `${kind} ${index}`).toBeLessThan(FRAME_TILES_WIDE);
      }
    }
  });

  it('wraps the index over the frames a kind carries', () => {
    for (const kind of KINDS) {
      const own = CITY_BUILDING_SPRITES.filter((sprite) => sprite.kind === kind);
      const count = own.length > 0 ? own.length : 1;
      expect(buildingFrameFor(kind, 0), kind).toBe(buildingFrameFor(kind, count));
      expect(buildingFrameFor(kind, 1), kind).toBe(buildingFrameFor(kind, count + 1));
      expect(buildingFrameFor(kind, -1), kind).toBe(buildingFrameFor(kind, count - 1));
    }
  });

  it('keeps a committed blank of the real frame size, so a clone without the pack still boots', () => {
    const placeholder = atlas('placeholders/frlg/city-buildings.png');
    expect(placeholder.width).toBe(CITY_BUILDING_W * CITY_BUILDING_COLS);
    expect(placeholder.height).toBe(CITY_BUILDING_H * CITY_BUILDING_ROWS);
  });
});

/**
 * The draw site and the load site are Phaser code, so they are pinned by source
 * rather than run: a frame grid the scene stops honouring (a frame width, a
 * footprint in tiles, a depth that leaves the player behind the roof) is a bug the
 * manifest cannot catch.
 */
describe('the city screen draws the houses, the boot loads them', () => {
  const source = (path: string): string =>
    readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8');

  it('draws one frame per building over its own rect, above the tiles and sorted by its foot', () => {
    const city = source('scenes/CityScene.ts');
    expect(city).toContain("from '../data/tilesets/cityBuildings'");
    expect(city).toContain('CITY_BUILDINGS_TEXTURE_KEY');
    expect(city).toContain('rect.x * TILE_SIZE');
    expect(city).toContain('rect.y * TILE_SIZE');
    expect(city).toContain('building.sprite');
    expect(city).toContain('rect.width * TILE_SIZE');
    expect(city).toContain('rect.height * TILE_SIZE');
    expect(city).toContain('actorDepth((rect.y + rect.height) * TILE_SIZE)');
    expect(city).toContain('private houseSprites: Phaser.GameObjects.Image[]');
  });

  it('loads the atlas as an 80x96 spritesheet under the city texture key', () => {
    const boot = source('scenes/BootScene.ts');
    expect(boot).toContain('CITY_BUILDINGS_TEXTURE_KEY');
    expect(boot).toContain('CITY_BUILDINGS_ATLAS_URL');
    expect(boot).toContain('frameWidth: CITY_BUILDING_W');
    expect(boot).toContain('frameHeight: CITY_BUILDING_H');
  });
});

describe.skipIf(!hasArt('frlg/city-buildings.png'))('packed city buildings atlas', () => {
  const png = atlas('frlg/city-buildings.png');

  it('is the 320x96 sheet the manifest describes', () => {
    expect(png.width).toBe(CITY_BUILDING_W * CITY_BUILDING_COLS);
    expect(png.height).toBe(CITY_BUILDING_H * CITY_BUILDING_ROWS);
  });

  it('has a non-empty house in every frame', () => {
    for (let frame = 0; frame < CITY_BUILDING_COLS * CITY_BUILDING_ROWS; frame++) {
      expect(frameHasArt(png, frame), `frame ${frame}`).toBe(true);
    }
  });
});
