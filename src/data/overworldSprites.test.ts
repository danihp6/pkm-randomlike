import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { hasArt } from '../assets/art';
import { decodePng } from '../../scripts/legacy-art/png-codec.mjs';
import { TRAINER_ARCHETYPES } from './trainers';
import {
  NPC_SPRITE_KEYS,
  OVERWORLD_FACINGS,
  OVERWORLD_SPRITE_FALLBACKS,
  OVERWORLD_SPRITE_KEYS,
  overworldHasSprite,
  overworldSpriteFrame,
  overworldWalkFrames,
} from './overworldSprites';
import manifest from './frlg/overworld.json';

// The atlas is a committed crop of the FRLG decomp sheets
// (`scripts/frlg/build-overworld-sprites.mjs`), so its shape and the fact every
// pose frame carries art are measured here: a re-crop that shifts the frame
// origin or loses a pose fails this test instead of drawing an empty tile.
const WIDTH = manifest.size;
const HEIGHT = manifest.height;
const COLUMNS = manifest.columns;

const TRAINER_KEYS = [
  'youngster',
  'lass',
  'bugcatcher',
  'hiker',
  'camper',
  'picnicker',
  'fisher',
  'psychic',
  'blackbelt',
  'ace',
] as const;
const NPC_KEYS = [
  'merchant',
  'chef',
  'magician',
  'exorcist',
  'weather-man',
  'sacrifice',
  'medic',
  'iv-judge',
  'berry-tree',
  'ninja',
] as const;
const ALL_KEYS = [...TRAINER_KEYS, 'rocket', ...NPC_KEYS];

function atlas() {
  if (!hasArt('frlg/overworld.png')) return { width: 0, height: 0, data: new Uint8Array() };
  const url = new URL('../assets/frlg/overworld.png', import.meta.url);
  return decodePng(readFileSync(fileURLToPath(url)));
}

function frameHasArt(png: { width: number; height: number; data: Uint8Array }, frame: number): boolean {
  const row = Math.floor(frame / COLUMNS);
  const column = frame % COLUMNS;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const alpha = png.data[((row * HEIGHT + y) * png.width + column * WIDTH + x) * 4 + 3];
      if (alpha > 0) return true;
    }
  }
  return false;
}

describe.skipIf(!hasArt('frlg/overworld.png'))('overworld sprite atlas', () => {
  const png = atlas();

  it('is a grid of 16x32 frames, one row per key', () => {
    expect(WIDTH).toBe(16);
    expect(HEIGHT).toBe(32);
    expect(png.width).toBe(144);
    expect(png.width).toBe(WIDTH * COLUMNS);
    expect(png.height).toBe(32 * OVERWORLD_SPRITE_KEYS.length);
    expect(png.height).toBe(672);
    expect(COLUMNS).toBe(manifest.poses.length);
    expect(COLUMNS).toBe(9);
  });

  it('lists the trainer rows, rocket and the ten NPC rows in atlas order', () => {
    expect(OVERWORLD_SPRITE_KEYS).toEqual(ALL_KEYS);
    expect(OVERWORLD_SPRITE_KEYS).toEqual(Object.keys(manifest.sprites));
    expect(NPC_SPRITE_KEYS).toEqual(NPC_KEYS);
  });

  it('pins the trainer rows where the shipped tables expect them', () => {
    const bases: Readonly<Record<string, number>> = {
      youngster: 0,
      lass: 9,
      bugcatcher: 18,
      hiker: 27,
      camper: 36,
      picnicker: 45,
      fisher: 54,
      psychic: 63,
      blackbelt: 72,
      ace: 81,
      rocket: 90,
    };
    for (const [name, base] of Object.entries(bases)) {
      expect(manifest.sprites[name as keyof typeof manifest.sprites], name).toBe(base);
      expect(overworldSpriteFrame(name), name).toBe(base);
    }
  });

  it('names a unique overworld sprite for every archetype', () => {
    const names = new Set<string>();
    for (const archetype of TRAINER_ARCHETYPES) {
      expect(archetype.spriteKey, archetype.id).toBeTruthy();
      names.add(archetype.spriteKey!);
    }
    expect(names.size).toBe(TRAINER_ARCHETYPES.length);
    expect([...names]).toEqual([...TRAINER_KEYS]);
  });

  it('freezes the ten NPC keys and the classes they borrow', () => {
    for (const name of NPC_SPRITE_KEYS) {
      expect(overworldHasSprite(name), name).toBe(true);
      expect(manifest.sprites[name as keyof typeof manifest.sprites], name).toBeTypeOf('number');
    }
    expect(OVERWORLD_SPRITE_FALLBACKS).toEqual({
      magician: 'gentleman',
      exorcist: 'channeler',
      'weather-man': 'scientist',
      sacrifice: 'old_man_1',
      'iv-judge': 'gym_guy',
      'berry-tree': 'hiker',
    });
    for (const [name, stem] of Object.entries(OVERWORLD_SPRITE_FALLBACKS)) {
      expect(manifest.sources[name as keyof typeof manifest.sources], name).toBe(`${stem}.png`);
    }
  });

  it('maps all 189 poses onto a non-empty frame', () => {
    let frames = 0;
    for (const name of OVERWORLD_SPRITE_KEYS) {
      for (const facing of OVERWORLD_FACINGS) {
        const idle = overworldSpriteFrame(name, facing);
        expect(idle, `${name} ${facing} idle`).toBeTypeOf('number');
        expect(frameHasArt(png, idle!), `${name} ${facing} idle art`).toBe(true);
        frames += 1;
        for (const frame of overworldWalkFrames(name, facing)!) {
          expect(frameHasArt(png, frame), `${name} ${facing} walk art`).toBe(true);
          frames += 1;
        }
      }
    }
    expect(frames).toBe(189);
  });

  it('returns null for a key the sheet lacks', () => {
    expect(overworldHasSprite('nobody')).toBe(false);
    expect(overworldHasSprite('toString')).toBe(false);
    expect(overworldSpriteFrame('nobody')).toBeNull();
    expect(overworldWalkFrames('nobody', 'down')).toBeNull();
  });
});
