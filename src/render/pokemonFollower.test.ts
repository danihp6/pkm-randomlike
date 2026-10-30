import { describe, expect, it } from 'vitest';
import { hasArt } from '../assets/art';
import { OVERWORLD_SCALE_MAX, OVERWORLD_SCALE_MIN } from '../data/overworldSize';
import { OVERWORLD_FACINGS } from '../data/overworldSprites';
import { pokemonOverworldSheet, type PokemonOverworldSheet } from '../data/pokemonOverworld';
import { TILE_SIZE } from '../engine/tileset';
import {
  FOLLOWER_ANIMS,
  FOLLOWER_FRAME_RATE,
  followerAnimKey,
  followerAnims,
  followerDirRow,
  followerDirRowName,
  followerFit,
  followerFrame,
  followerIdleFrame,
} from './pokemonFollower';

const sheet = pokemonOverworldSheet('bulbasaur')!;

/** A committed pair's shape (32 px cell, five rows, 28 columns) with no art behind it. */
const PAIR: PokemonOverworldSheet = {
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

describe('followerFit', () => {
  it("followerFit's scale and feet come from one call", () => {
    const diglett = followerFit({ ...PAIR, speciesId: 'diglett' });
    const eternatus = followerFit({ ...PAIR, speciesId: 'eternatus' });

    expect(diglett.scale).toBeCloseTo(0.6, 10);
    expect(diglett.feetOffset).toBe(12);
    expect(eternatus.scale).toBeCloseTo(1.2, 10);
    expect(eternatus.feetOffset).toBe(12);
    expect(diglett.scale * PAIR.size).toBeCloseTo(19.2, 10);
    expect(eternatus.scale * PAIR.size).toBeCloseTo(38.4, 10);
    for (const fit of [diglett, eternatus]) {
      const drawn = fit.scale * PAIR.size;
      expect(drawn).toBeGreaterThanOrEqual(TILE_SIZE * OVERWORLD_SCALE_MIN);
      expect(drawn).toBeLessThanOrEqual(TILE_SIZE * OVERWORLD_SCALE_MAX);
    }
  });

  it("followerFit keeps the follower's feet on the tile's bottom edge", () => {
    for (const speciesId of ['diglett', 'eternatus']) {
      expect(followerFit({ ...PAIR, speciesId }).feetOffset).toBe(TILE_SIZE / 2);
    }
    for (const size of [16, 24, 32, 64]) {
      expect(followerFit({ ...PAIR, size }).feetOffset).toBe(TILE_SIZE / 2);
    }
  });
});

describe.skipIf(!hasArt('pokemon/1.png'))('follower direction rows', () => {
  it('draws down, up and left, in the sheet order the route walks', () => {
    expect(OVERWORLD_FACINGS).toEqual(['down', 'up', 'side']);
    expect(followerDirRow(sheet, 'down')).toBe(0);
    expect(followerDirRow(sheet, 'up')).toBe(2);
    expect(followerDirRow(sheet, 'side')).toBe(4);
    expect(followerDirRowName('side')).toBe('left');
  });

  it('rests on idle step 0 and refuses a facing the sheet lacks', () => {
    expect(followerIdleFrame(sheet, 'down')).toBe(0);
    const withoutLeft: PokemonOverworldSheet = {
      ...sheet,
      dirRows: ['down', 'downright', 'up', 'upright'],
    };
    expect(followerDirRow(withoutLeft, 'side')).toBe(-1);
    expect(followerFrame(withoutLeft, 'side', 'walk', 0)).toBeNull();
    expect(followerIdleFrame(withoutLeft, 'side')).toBeNull();
  });
});

describe.skipIf(!hasArt('pokemon/1.png'))('follower animations', () => {
  it('registers idle and walk per facing, in sheet order', () => {
    const anims = followerAnims(sheet);
    expect(anims.length).toBe(6);
    expect(anims.map((anim) => anim.key)).toEqual([
      'pokemon:1:idle:0',
      'pokemon:1:walk:0',
      'pokemon:1:idle:2',
      'pokemon:1:walk:2',
      'pokemon:1:idle:4',
      'pokemon:1:walk:4',
    ]);
    for (const anim of anims) {
      expect(anim.frameRate).toBe(FOLLOWER_FRAME_RATE);
      expect(anim.repeat).toBe(-1);
    }
  });

  it('frames each strip off the counts the pair manifest holds', () => {
    const keyed = new Map(followerAnims(sheet).map((anim) => [anim.key, anim]));
    expect(keyed.get('pokemon:1:walk:4')?.frames).toEqual([115, 116, 117, 118, 119, 120]);
    expect(keyed.get('pokemon:1:idle:0')?.frames).toEqual([0, 1, 2]);
  });

  it('keeps the animation keys unique and keyed by texture, anim and row', () => {
    const keys = followerAnims(sheet).map((anim) => anim.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(followerAnimKey(sheet, 'up', 'walk')).toBe('pokemon:1:walk:2');
    expect(FOLLOWER_ANIMS).toEqual(['idle', 'walk']);
  });

  it('drops every strip of a facing the sheet cannot answer', () => {
    const withoutLeft: PokemonOverworldSheet = {
      ...sheet,
      dirRows: ['down', 'downright', 'up', 'upright'],
    };
    const anims = followerAnims(withoutLeft);
    expect(anims.length).toBe(4);
    expect(anims.some((anim) => anim.key.endsWith(':4'))).toBe(false);
    expect(anims.map((anim) => anim.key)).toEqual([
      'pokemon:1:idle:0',
      'pokemon:1:walk:0',
      'pokemon:1:idle:2',
      'pokemon:1:walk:2',
    ]);
  });
});
