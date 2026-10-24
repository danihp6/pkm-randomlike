import { describe, expect, it } from 'vitest';
import { getSpecies } from '../../../../data/dex';
import { encodeRunShare } from '../../../../engine/run';
import { t } from '../../../../i18n';
import { liveStarterView } from './view';

const SEED = 'pkm-147';
const HINT = '←  →  choose      Space  confirm      S  seed      Esc  settings      X  back';
const POOL = ['squirtle', 'bulbasaur', 'charmander'] as const;

describe('liveStarterView', () => {
  it('draws one card per pool draw, in the pool’s own order', () => {
    const view = liveStarterView(POOL, 0, SEED, 'finite', HINT);

    expect(view.cards).toHaveLength(POOL.length);
    expect(view.cards.map((card) => card.speciesId)).toEqual(['squirtle', 'bulbasaur', 'charmander']);
  });

  it('reads each card’s number, name and types from the dex', () => {
    const view = liveStarterView(POOL, 0, SEED, 'finite', HINT);

    for (const card of view.cards) {
      const species = getSpecies(card.speciesId);
      expect(species, card.speciesId).toBeDefined();
      expect(card.num).toBe(species!.num);
      expect(card.name).toBe(species!.name);
      expect(card.types).toEqual(species!.types);
    }
    expect(view.cards[0]).toEqual({
      speciesId: 'squirtle',
      num: 7,
      name: 'Squirtle',
      types: ['Water'],
    });
    expect(view.cards[1]!.types).toEqual(['Grass', 'Poison']);
  });

  it('keeps a species the dex does not know under its own id', () => {
    const view = liveStarterView(['missingno'], 0, SEED, 'finite', HINT);

    expect(view.cards).toEqual([{ speciesId: 'missingno', num: 0, name: 'missingno', types: [] }]);
  });

  it('follows the cursor and clamps it into the cards', () => {
    expect(liveStarterView(POOL, 0, SEED, 'finite', HINT).selected).toBe(0);
    expect(liveStarterView(POOL, 2, SEED, 'finite', HINT).selected).toBe(2);
    expect(liveStarterView(POOL, 9, SEED, 'finite', HINT).selected).toBe(2);
    expect(liveStarterView(POOL, -4, SEED, 'finite', HINT).selected).toBe(0);
    expect(liveStarterView(POOL, 1.7, SEED, 'finite', HINT).selected).toBe(1);
    expect(liveStarterView([], 3, SEED, 'finite', HINT).selected).toBe(0);
  });

  it('prints the title, the run’s share line and the hinted footer', () => {
    const view = liveStarterView(POOL, 1, SEED, 'infinite', HINT);
    const share = encodeRunShare({ seed: SEED, mode: 'infinite' });

    expect(view.title).toBe(t('starter.title'));
    expect(view.share).toBe(t('starter.share', { share }));
    expect(view.share).toContain('PKRL-1-i-');
    expect(view.hint).toBe(HINT);
  });

  it('is pure: the same input is deep-equal and JSON round-trips unchanged', () => {
    const first = liveStarterView(POOL, 1, SEED, 'finite', HINT);
    const second = liveStarterView(POOL, 1, SEED, 'finite', HINT);

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
  });
});
