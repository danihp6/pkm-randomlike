import { describe, expect, it } from 'vitest';
import { getItem } from '../items';
import { portraitFor } from '../portraits';
import { pokemonSprite } from '../pokemonSprites';
import meta from './meta.json';
import {
  MEGA_FORMES,
  isMegaSpecies,
  megaFormForItem,
  megaFormsForBase,
  megaMatchesSpecies,
} from './megas';
import { getSpecies, playableSpecies } from './species';

const counts = (meta as { counts: Readonly<Record<string, number>> }).counts;

describe('generated Mega formes', () => {
  it('matches the count recorded in meta.json', () => {
    expect(MEGA_FORMES.length).toBe(counts.megas);
    expect(MEGA_FORMES.length).toBe(34);
  });

  it('resolves every Mega and its base species', () => {
    const playable = new Set(playableSpecies().map((species) => species.id));
    for (const mega of MEGA_FORMES) {
      expect(getSpecies(mega.id), mega.id).toBeDefined();
      const base = getSpecies(mega.baseSpeciesId);
      expect(base, mega.baseSpeciesId).toBeDefined();
      expect(playable.has(mega.baseSpeciesId), mega.baseSpeciesId).toBe(true);
      // A Mega never changes HP.
      expect(mega.baseStats.hp, mega.id).toBe(base!.baseStats.hp);
    }
  });

  it('keeps Mega formes out of the playable set', () => {
    for (const mega of MEGA_FORMES) {
      expect(playableSpecies().some((species) => species.id === mega.id), mega.id).toBe(false);
      expect(isMegaSpecies(mega.id)).toBe(true);
    }
    expect(isMegaSpecies('venusaur')).toBe(false);
    expect(isMegaSpecies('not-a-species')).toBe(false);
  });

  it('ties every Mega to a held stone that maps back to it', () => {
    for (const mega of MEGA_FORMES) {
      const stone = getItem(mega.stoneId);
      expect(stone, `${mega.id} needs ${mega.stoneId}`).toBeDefined();
      expect(stone!.kind).toBe('held');
      expect(stone!.mega).toEqual({ base: mega.baseSpeciesId, form: mega.id });
      expect(megaFormForItem(mega.stoneId)?.id).toBe(mega.id);
      expect(megaMatchesSpecies(mega.stoneId, mega.baseSpeciesId)).toBe(true);
    }
  });

  it('lists every Mega of a base species (Charizard has two)', () => {
    expect(megaFormsForBase('charizard').map((mega) => mega.id)).toEqual([
      'charizardmegax',
      'charizardmegay',
    ]);
    expect(megaFormsForBase('venusaur').map((mega) => mega.id)).toEqual(['venusaurmega']);
    expect(megaFormsForBase('pikachu')).toEqual([]);
  });

  it('does not let a stone match the wrong species', () => {
    expect(megaMatchesSpecies('venusaurite', 'charizard')).toBe(false);
    expect(megaMatchesSpecies('charcoal', 'venusaur')).toBe(false);
  });

  it('has the battle art and a portrait cell for every Mega', () => {
    for (const mega of MEGA_FORMES) {
      expect(pokemonSprite(mega.id, 'front'), `${mega.id} front`).not.toBeNull();
      expect(pokemonSprite(mega.id, 'back'), `${mega.id} back`).not.toBeNull();
      expect(portraitFor(mega.id), `${mega.id} portrait`).not.toBeNull();
    }
  });
});
