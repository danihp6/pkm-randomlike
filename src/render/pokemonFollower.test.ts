import { describe, expect, it } from 'vitest';
import { OVERWORLD_FACINGS } from '../data/overworldSprites';
import { pokemonOverworldSheet, type PokemonOverworldSheet } from '../data/pokemonOverworld';
import {
  FOLLOWER_ANIMS,
  FOLLOWER_FRAME_RATE,
  followerAnimKey,
  followerAnims,
  followerDirRow,
  followerDirRowName,
  followerFrame,
  followerIdleFrame,
} from './pokemonFollower';

const sheet = pokemonOverworldSheet('bulbasaur')!;

describe('follower direction rows', () => {
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

describe('follower animations', () => {
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
