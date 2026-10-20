import { describe, expect, it } from 'vitest';
import { hasArt } from '../assets/art';
import indexManifest from '../assets/pokemon/index.json';
import {
  POKEMON_OVERWORLD_DIR_ROWS,
  POKEMON_OVERWORLD_ROWS,
  POKEMON_OVERWORLD_SPRITE,
  pokemonOverworldFrame,
  pokemonOverworldSheet,
  pokemonOverworldTextureKey,
} from './pokemonOverworld';

const sheet = pokemonOverworldSheet('bulbasaur');

describe.skipIf(!hasArt('pokemon/1.png'))('pokemon overworld sheet', () => {
  it('resolves a committed pair to its manifest facts', () => {
    expect(sheet).not.toBeNull();
    expect(sheet!.speciesId).toBe('bulbasaur');
    expect(sheet!.fileId).toBe(1);
    expect(sheet!.textureKey).toBe('pokemon:1');
    expect(sheet!.size).toBe(32);
    expect(sheet!.rows).toBe(5);
    expect(sheet!.cols).toBe(28);
    expect(sheet!.dirRows).toEqual(indexManifest.dirRows);
    expect(sheet!.url.endsWith('.png')).toBe(true);
  });

  it('carries the animation blocks the pair manifest holds', () => {
    expect(sheet!.anims.walk.start).toBe(3);
    expect(sheet!.anims.walk.count).toBe(6);
    expect(sheet!.anims.idle.count).toBe(3);
    expect(sheet!.anims.walk.durationsMs.length).toBe(6);
  });

  it('frames a step as row * cols + start + step', () => {
    expect(pokemonOverworldFrame(sheet!, 'walk', 0, 1)).toBe(4);
    expect(pokemonOverworldFrame(sheet!, 'walk', 4, 1)).toBe(116);
  });

  it('clamps a step into the block and refuses a row off the sheet', () => {
    expect(pokemonOverworldFrame(sheet!, 'idle', 0, 0)).toBe(0);
    expect(pokemonOverworldFrame(sheet!, 'idle', 0, 99)).toBe(2);
    expect(pokemonOverworldFrame(sheet!, 'idle', 0, -1)).toBe(0);
    expect(pokemonOverworldFrame(sheet!, 'idle', -1, 0)).toBe(-1);
    expect(pokemonOverworldFrame(sheet!, 'idle', 5, 0)).toBe(-1);
  });

  it('returns null for an unknown id and for every id the manifest lists as missing', () => {
    expect(pokemonOverworldSheet('notaspecies')).toBeNull();
    for (const id of indexManifest.missing) {
      expect(pokemonOverworldSheet(id), id).toBeNull();
    }
  });

  it('exposes the manifest constants and the texture key', () => {
    expect(POKEMON_OVERWORLD_SPRITE).toBe(32);
    expect(POKEMON_OVERWORLD_ROWS).toBe(5);
    expect(POKEMON_OVERWORLD_DIR_ROWS).toEqual(indexManifest.dirRows);
    expect(pokemonOverworldTextureKey(35101)).toBe('pokemon:35101');
  });
});
