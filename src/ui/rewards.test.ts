import { describe, expect, it } from 'vitest';
import type { LootEntry } from '../data/loot';
import { allNatures, getNature, statAtLevel } from '../data/dex/natures';
import { getSpecies, playableSpecies, type StatId } from '../data/dex/species';
import { getItem } from '../data/items';
import { createFighter } from '../engine/battle/fighter';
import { hashSeed, Rng } from '../engine/rng';
import { t } from '../i18n';
import {
  pokemonRewardChoices,
  pokemonRewardRowLabel,
  rewardChoices,
  rewardRows,
  type PokemonRewardOption,
} from './rewards';

const pool: readonly LootEntry[] = [
  { itemId: 'potion', weight: 5 },
  { itemId: 'pokeball', weight: 4 },
  { itemId: 'antidote', weight: 1 },
];

const HEADLINE_STATS: readonly StatId[] = ['atk', 'def', 'spa', 'spd', 'spe'];

/** Forty real ids, the pool shape the mini-boss hands the chooser. */
const widePool: readonly string[] = playableSpecies()
  .slice(0, 40)
  .map((species) => species.id);

function request(
  overrides: Partial<Parameters<typeof pokemonRewardChoices>[0]> = {},
): Parameters<typeof pokemonRewardChoices>[0] {
  return {
    pool: widePool,
    count: 3,
    level: 20,
    learnsetSeed: 'task-63',
    rng: new Rng(5),
    ...overrides,
  };
}

function argmax(option: PokemonRewardOption): StatId {
  const species = getSpecies(option.speciesId);
  expect(species).toBeDefined();
  const stats = statAtLevel(species!, option.level, option.nature);
  let top: StatId = 'atk';
  for (const stat of HEADLINE_STATS) {
    if (stats[stat] > stats[top]) top = stat;
  }
  return top;
}

describe('rewardChoices', () => {
  it('picks `count` distinct items from the pool', () => {
    const picks = rewardChoices(pool, 2, new Rng(1));
    expect(picks).toHaveLength(2);
    expect(new Set(picks).size).toBe(2);
    for (const id of picks) expect(pool.some((entry) => entry.itemId === id)).toBe(true);
  });

  it('is deterministic and caps at the pool size', () => {
    expect(rewardChoices(pool, 2, new Rng(7))).toEqual(rewardChoices(pool, 2, new Rng(7)));
    expect(rewardChoices(pool, 9, new Rng(3))).toHaveLength(pool.length);
  });

  it('never offers an empty or zero-weight entry', () => {
    const withZero = [...pool, { itemId: 'ghost', weight: 0 }];
    for (let seed = 0; seed < 40; seed++) {
      for (const id of rewardChoices(withZero, 3, new Rng(seed))) expect(id).not.toBe('ghost');
    }
  });
});

describe('pokemonRewardChoices', () => {
  it('offers `count` distinct species of the pool, each a real rolled member', () => {
    const options = pokemonRewardChoices(request());
    expect(options).toHaveLength(3);
    expect(new Set(options.map((option) => option.speciesId)).size).toBe(3);
    for (const option of options) {
      expect(widePool).toContain(option.speciesId);
      expect(option.level).toBe(20);
      expect(allNatures().some((nature) => nature.id === option.nature)).toBe(true);
      const fighter = createFighter({
        id: 'reward',
        speciesId: option.speciesId,
        level: option.level,
        nature: option.nature,
        learnsetSeed: 'task-63',
      });
      expect(option.ability).toBe(fighter.ability);
      expect(option.moves).toEqual(fighter.moves.map((slot) => slot.moveId));
    }
  });

  it('drops unresolvable ids and repeats, and caps at the pool it has', () => {
    const options = pokemonRewardChoices(
      request({ pool: ['charmander', 'CHARMANDER', 'not-a-species', 'squirtle'], count: 9 }),
    );
    expect(options.map((option) => option.speciesId).sort()).toEqual(['charmander', 'squirtle']);
  });

  it('clamps the level the way `adoptAtLevel` does', () => {
    for (const [asked, expected] of [
      [0.5, 1],
      [-7, 1],
      [20.9, 20],
      [1000, 100],
    ] as const) {
      for (const option of pokemonRewardChoices(request({ level: asked }))) {
        expect(option.level).toBe(expected);
      }
    }
  });

  it('returns nothing and draws nothing for a non-positive count', () => {
    const stream = new Rng(11);
    const untouched = new Rng(11);
    expect(pokemonRewardChoices(request({ count: 0, rng: stream }))).toEqual([]);
    expect(pokemonRewardChoices(request({ count: -3, rng: stream }))).toEqual([]);
    expect(stream.next()).toBe(untouched.next());
  });

  it('reads exactly two draws per option and nothing else', () => {
    const after = new Rng(11);
    expect(pokemonRewardChoices(request({ count: 3, rng: after }))).toHaveLength(3);
    const six = new Rng(11);
    for (let i = 0; i < 6; i++) six.int(0, 1000000);
    expect(after.next()).toBe(six.next());
  });

  it('is deterministic for a fixed seed', () => {
    const options = { pool: ['charmander', 'squirtle', 'bulbasaur'], count: 3, level: 20 };
    const first = pokemonRewardChoices({
      ...options,
      learnsetSeed: 'task-63',
      rng: new Rng(63),
    });
    const second = pokemonRewardChoices({
      ...options,
      learnsetSeed: 'task-63',
      rng: new Rng(63),
    });
    expect(second).toEqual(first);
    // Pinned from the first run; the three (species, nature, topStat) triples are
    // stable, and so is the member each row lands.
    expect(first).toEqual([
      {
        speciesId: 'charmander',
        level: 20,
        nature: 'bold',
        topStat: 'spe',
        ability: 'Blaze',
        moves: ['geargrind', 'visegrip', 'revenge', 'shockwave'],
      },
      {
        speciesId: 'squirtle',
        level: 20,
        nature: 'bashful',
        topStat: 'def',
        ability: 'Torrent',
        moves: ['aircutter', 'forcepalm', 'thunderfang', 'spiderweb'],
      },
      {
        speciesId: 'bulbasaur',
        level: 20,
        nature: 'hasty',
        topStat: 'spa',
        ability: 'Overgrow',
        moves: ['submission', 'fly', 'recover', 'earthquake'],
      },
    ]);
  });

  it('headlines the argmax of the five stats, and a nature can flip it', () => {
    // Beedrill's Attack and Speed sit close enough that Adamant (atk up) and
    // Timid (spe up) move the headline between them.
    const adamant = pokemonRewardChoices(request({ pool: ['beedrill'], count: 1, rng: new Rng(7) }))[0];
    const timid = pokemonRewardChoices(request({ pool: ['beedrill'], count: 1, rng: new Rng(43) }))[0];
    expect(adamant.nature).toBe('adamant');
    expect(adamant.topStat).toBe('atk');
    expect(timid.nature).toBe('timid');
    expect(timid.topStat).toBe('spe');
  });

  it('never headlines HP, and always headlines the true maximum', () => {
    for (let seed = 0; seed < 40; seed++) {
      const options = pokemonRewardChoices(
        request({ level: 50, learnsetSeed: `hp-${seed}`, rng: new Rng(seed) }),
      );
      expect(options).toHaveLength(3);
      for (const option of options) {
        expect(option.topStat).not.toBe('hp');
        expect(option.topStat).toBe(argmax(option));
      }
    }
  });
});

describe('pokemonRewardRowLabel', () => {
  it('prints the stat label, the shipped separator and the nature name', () => {
    expect(
      pokemonRewardRowLabel({
        speciesId: 'charmander',
        level: 20,
        nature: 'adamant',
        topStat: 'atk',
        ability: 'Blaze',
        moves: [],
      }),
    ).toBe('ATTACK · Adamant');
  });

  it('never leaks a species name', () => {
    const statLabels = HEADLINE_STATS.map((stat) => t(`detail.stat.${stat}`));
    const natureNames = allNatures().map((nature) => nature.name);
    for (let seed = 0; seed < 40; seed++) {
      const options = pokemonRewardChoices(
        request({ learnsetSeed: `label-${seed}`, rng: new Rng(seed) }),
      );
      for (const option of options) {
        const label = pokemonRewardRowLabel(option);
        expect(statLabels.some((value) => label.startsWith(value))).toBe(true);
        expect(natureNames.some((name) => label.endsWith(name))).toBe(true);
        expect(getNature(option.nature)).toBeDefined();
        expect(label).not.toContain(getSpecies(option.speciesId)!.name);
      }
    }
  });
});

describe('rewardRows', () => {
  const option: PokemonRewardOption = {
    speciesId: 'charmander',
    level: 20,
    nature: 'adamant',
    topStat: 'atk',
    ability: 'Blaze',
    moves: ['scratch'],
  };

  it('lists the items first, then the Pokémon, in the order offered', () => {
    const rows = rewardRows(['potion', 'pokeball'], [option]);
    expect(rows.map((row) => row.kind)).toEqual(['item', 'item', 'pokemon']);
    expect(rows.slice(0, 2).map((row) => (row.kind === 'item' ? row.itemId : ''))).toEqual([
      'potion',
      'pokeball',
    ]);
    expect(rows[2]).toMatchObject({ kind: 'pokemon', option });
  });

  it('resolves an item row’s name and its one-line description', () => {
    const [row] = rewardRows(['potion'], []);
    expect(row).toEqual({
      kind: 'item',
      itemId: 'potion',
      name: 'Potion',
      description: getItem('potion')!.shortDesc,
    });
    expect(row.kind === 'item' && row.description.length > 0).toBe(true);
  });

  it('keeps the shipped label for a Pokémon row and never prints its species', () => {
    const [, pokemonRow] = rewardRows(['potion'], [option]);
    expect(pokemonRow).toEqual({
      kind: 'pokemon',
      option,
      label: pokemonRewardRowLabel(option),
    });
    expect(pokemonRow.kind === 'pokemon' && pokemonRow.label).toBe('ATTACK · Adamant');
  });

  it('keeps an unknown item id as its own label rather than dropping the row', () => {
    expect(rewardRows(['not-an-item'], [])).toEqual([
      { kind: 'item', itemId: 'not-an-item', name: 'not-an-item', description: '' },
    ]);
  });
});

describe('the two reward streams', () => {  it('leaves the shipped item chooser untouched', () => {
    // A pool of this file's own: the band tables belong to other tasks and grow,
    // and a literal derived from one would go stale. The property here is the
    // stream isolation, which a local pool measures just as well.
    const pinned = ['pokeball', 'potion', 'antidote'];
    expect(rewardChoices(pool, 3, new Rng(hashSeed('task-63:reward:4')))).toEqual(pinned);
    pokemonRewardChoices(request({ level: 30, rng: new Rng(hashSeed('task-63:reward:4:pokemon')) }));
    expect(rewardChoices(pool, 3, new Rng(hashSeed('task-63:reward:4')))).toEqual(pinned);
  });
});
