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
  type MegaForm,
} from './megas';
import { getSpecies, playableSpecies, type Species } from './species';

const counts = (meta as { counts: Readonly<Record<string, number>> }).counts;

type GeneratedRow = MegaForm & Readonly<{ isNonstandard?: string }>;
type GeneratedSpeciesRow = Species & Readonly<{ isNonstandard?: string | null }>;

const ROWS = MEGA_FORMES as readonly GeneratedRow[];
const SPECIES_ROWS = playableSpecies() as readonly GeneratedSpeciesRow[];
const FUTURE = ROWS.filter((mega) => mega.isNonstandard === 'Future');

describe('generated Mega formes', () => {
  it('matches the count recorded in meta.json', () => {
    expect(MEGA_FORMES.length).toBe(counts.megas);
  });

  it('carries the Future Megas the Past filter alone would have missed', () => {
    expect(MEGA_FORMES.length).toBeGreaterThan(48);
    expect(FUTURE.length).toBeGreaterThan(0);
    const ids = new Set(MEGA_FORMES.map((mega) => mega.id));
    for (const id of [
      'raichumegax',
      'raichumegay',
      'clefablemega',
      'dragonitemega',
      'chesnaughtmega',
      'garchompmega',
      'baxcaliburmega',
    ]) {
      expect(ids.has(id), id).toBe(true);
    }
  });

  // The nine `Future` formes the dex leaves `isMega` unset on (Absol Z, Garchomp
  // Z, Lucario Z, both Meowstic, Magearna-Original and the three Tatsugiri) name
  // the forme instead. `isPlayable` drops them by name-shape, so they ship in
  // neither file and the two generated id sets stay disjoint.
  it('keeps the species and Mega id sets disjoint', () => {
    const playable = new Set(playableSpecies().map((species) => species.id));
    for (const mega of MEGA_FORMES) {
      expect(playable.has(mega.id), mega.id).toBe(false);
      expect(isMegaSpecies(mega.id), mega.id).toBe(true);
    }
    for (const id of ['absolmegaz', 'meowsticfmega', 'tatsugiristretchymega']) {
      expect(playable.has(id), id).toBe(false);
      expect(isMegaSpecies(id), id).toBe(false);
    }
  });

  it('anchors every Mega to a base species in the playable set', () => {
    const playable = new Set(playableSpecies().map((species) => species.id));
    for (const mega of MEGA_FORMES) {
      expect(playable.has(mega.baseSpeciesId), `${mega.id} -> ${mega.baseSpeciesId}`).toBe(true);
    }
  });

  it('leaves no Future forme that names a Mega in the playable set', () => {
    const leaked = SPECIES_ROWS.filter(
      (species) => species.isNonstandard === 'Future' && /mega/i.test(species.forme ?? ''),
    );
    expect(leaked.map((species) => species.id)).toEqual([]);
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
    const stoneIds = MEGA_FORMES.map((mega) => mega.stoneId);
    expect(new Set(stoneIds).size, 'stoneId must be unique').toBe(stoneIds.length);
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
