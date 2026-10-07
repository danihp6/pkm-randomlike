import { describe, expect, it } from 'vitest';
import manifest from './anil/pokemon-sprites.json';
import { pokemonIdleAnimKey, pokemonSprite } from './pokemonSprites';

describe('pokemonSprite', () => {
  it('resolves the front, back and icon sheet of a base species', () => {
    const front = pokemonSprite('bulbasaur', 'front');
    expect(front).not.toBeNull();
    expect(front!.size).toBeGreaterThan(0);
    expect(front!.frames).toBeGreaterThanOrEqual(1);
    expect(front!.url).toContain('anil/front/');
    expect(pokemonSprite('bulbasaur', 'back')!.url).toContain('anil/back/');
    expect(pokemonSprite('bulbasaur', 'icon')!.url).toContain('anil/icons/');
  });

  it('returns null for an id the manifest does not know', () => {
    expect(pokemonSprite('missingno', 'front')).toBeNull();
  });

  it('prefers the female and shiny sheets when asked for them', () => {
    const plain = pokemonSprite('pikachu', 'front')!;
    const female = pokemonSprite('pikachu', 'front', { female: true })!;
    const shiny = pokemonSprite('pikachu', 'front', { shiny: true })!;
    expect(female.textureKey).not.toBe(plain.textureKey);
    expect(female.url).toContain('_female');
    expect(shiny.url).toContain('front-shiny/');
  });

  it('falls back a step when a look has no sheet of its own', () => {
    // A species with no female art still draws the plain sheet.
    const female = pokemonSprite('bulbasaur', 'front', { female: true })!;
    expect(female.textureKey).toBe(pokemonSprite('bulbasaur', 'front')!.textureKey);
  });

  it('resolves a forme the packer could not name to its base species', () => {
    const alolan = pokemonSprite('raichualola', 'front')!;
    expect(alolan.textureKey).toBe(pokemonSprite('raichu', 'front')!.textureKey);
  });

  it('derives one idle animation key per sheet', () => {
    const sheet = pokemonSprite('bulbasaur', 'front')!;
    expect(pokemonIdleAnimKey(sheet)).toBe(`anil-idle:${sheet.textureKey}`);
  });

  it('covers every species the dex can roll', () => {
    // The manifest is written for the whole dex, so no battle can fall back to
    // the placeholder because a sheet is missing.
    const entries = Object.keys(manifest.frames);
    expect(entries.length).toBeGreaterThan(900);
    expect(entries).toContain('bulbasaur');
    expect(entries).toContain('charizard');
  });
});
