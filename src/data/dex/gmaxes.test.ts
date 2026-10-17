import { describe, expect, it } from 'vitest';
import { pokemonSprite } from '../pokemonSprites';
import { portraitFor } from '../portraits';
import {
  GMAX_FORMES,
  gmaxFormForBase,
  gmaxFormOf,
  isGmaxSpecies,
  type GmaxForm,
} from './gmaxes';
import meta from './meta.json';
import { getSpecies, playableSpecies, type Species } from './species';

const counts = (meta as { counts: Readonly<Record<string, number>> }).counts;

/** The base species a row changes from, which the generator guarantees is playable. */
function baseOf(gmax: GmaxForm): Species {
  const base = getSpecies(gmax.baseSpeciesId);
  if (!base) throw new Error(`${gmax.id} has no base species ${gmax.baseSpeciesId}`);
  return base;
}

describe('generated G-Max formes', () => {
  it('matches the count recorded in meta.json', () => {
    expect(GMAX_FORMES.length).toBe(counts.gmaxes);
  });

  it('takes exactly the dex entries whose name ends in Gmax', () => {
    for (const gmax of GMAX_FORMES) {
      expect(/gmax$/i.test(gmax.name), `${gmax.id} is ${gmax.name}`).toBe(true);
    }
    // The two forme-of-a-forme rows resolve to the exact base forme, which is
    // what `changesFrom` names (`baseSpecies` alone would collapse them).
    expect(gmaxFormOf('toxtricitylowkeygmax')?.baseSpeciesId).toBe('toxtricitylowkey');
    expect(gmaxFormOf('urshifurapidstrikegmax')?.baseSpeciesId).toBe('urshifurapidstrike');
    // Eternamax is not a Gigantamax: it ends in `Eternamax`, so it is in neither
    // generated file and Eternatus cannot Gigantamax.
    expect(isGmaxSpecies('eternatuseternamax')).toBe(false);
    expect(gmaxFormOf('eternatuseternamax')).toBeUndefined();
  });

  it('anchors every G-Max forme to a playable base species, one each', () => {
    const playable = new Set(playableSpecies().map((species) => species.id));
    const bases = GMAX_FORMES.map((gmax) => gmax.baseSpeciesId);
    expect(new Set(bases).size, 'baseSpeciesId must be unique').toBe(bases.length);
    for (const gmax of GMAX_FORMES) {
      expect(playable.has(gmax.baseSpeciesId), `${gmax.id} -> ${gmax.baseSpeciesId}`).toBe(true);
      expect(gmaxFormForBase(gmax.baseSpeciesId)?.id, gmax.baseSpeciesId).toBe(gmax.id);
    }
    expect(gmaxFormForBase('bulbasaur')).toBeUndefined();
    expect(gmaxFormForBase('not-a-species')).toBeUndefined();
  });

  it('keeps the G-Max id set out of the playable set', () => {
    const playable = new Set(playableSpecies().map((species) => species.id));
    for (const gmax of GMAX_FORMES) {
      expect(playable.has(gmax.id), gmax.id).toBe(false);
      expect(isGmaxSpecies(gmax.id), gmax.id).toBe(true);
      expect(getSpecies(gmax.id)?.id, gmax.id).toBe(gmax.id);
    }
    expect(playable.has('charizardgmax')).toBe(false);
    expect(isGmaxSpecies('charizard')).toBe(false);
  });

  it('keeps the base species the weight, the height and the stats (only HP changes)', () => {
    for (const gmax of GMAX_FORMES) {
      const base = baseOf(gmax);
      expect(gmax.weightkg, gmax.id).toBe(base.weightkg);
      expect(gmax.heightm, gmax.id).toBe(base.heightm);
      expect(gmax.evolutions, gmax.id).toEqual([]);
      expect(gmax.catchRate, gmax.id).toBeGreaterThan(0);
      expect(gmax.num, gmax.id).toBe(base.num);
    }
    for (const id of ['charizardgmax', 'pikachugmax']) {
      const gmax = gmaxFormOf(id);
      expect(gmax, id).toBeDefined();
      expect(gmax!.baseStats, id).toEqual(baseOf(gmax!).baseStats);
    }
  });

  it('has the battle art the battle swaps to', () => {
    const sheet = pokemonSprite('gengargmax', 'front');
    expect(sheet).not.toBeNull();
    expect(sheet!.url).toContain('/anil/front/');
    expect(sheet!.frames).toBeGreaterThan(0);
    for (const gmax of GMAX_FORMES) {
      expect(pokemonSprite(gmax.id, 'front'), `${gmax.id} front`).not.toBeNull();
    }
    expect(pokemonSprite('gengargmax', 'back')).not.toBeNull();
    expect(pokemonSprite('charizardgmax', 'back')).not.toBeNull();
  });

  it('has a portrait cell for the switch window', () => {
    expect(portraitFor('charizardgmax')).not.toBeNull();
    expect(portraitFor('gengargmax')).not.toBeNull();
    expect(portraitFor('gengargmax', true)).not.toBeNull();
  });
});
