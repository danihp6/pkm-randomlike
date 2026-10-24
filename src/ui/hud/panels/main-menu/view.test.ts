import { describe, expect, it } from 'vitest';
import { getBiome } from '../../../../data/biomes';
import { biomeForMap } from '../../../../engine/maps/plan';
import { createRun, createRunPokemon, type RunPokemon, type RunState } from '../../../../engine/run';
import { t } from '../../../../i18n';
import { partyRows } from '../../../partyScreen';
import { runPositionLabel } from '../../../runSummary';
import { liveMainMenuView } from './view';

const SEED = 'pkm-145';

function member(id: string, speciesId: string, nickname?: string): RunPokemon {
  return createRunPokemon({
    id,
    speciesId,
    level: 12,
    moves: ['tackle'],
    ...(nickname === undefined ? {} : { nickname }),
  });
}

/** A run standing on map 3 with the four members the mobile frame names. */
function savedRun(): RunState {
  const party = [
    member('charmander-1', 'charmander'),
    member('pikachu-2', 'pikachu'),
    member('bulbasaur-3', 'bulbasaur'),
    member('gastly-4', 'gastly'),
  ];
  return { ...createRun({ seed: SEED, starter: party[0]! }), mapIndex: 3, party };
}

describe('liveMainMenuView', () => {
  it('draws the three navigable rows, in board order, with the run’s position', () => {
    const run = savedRun();
    const view = liveMainMenuView(run, 0);

    expect(view.rows.map((row) => row.id)).toEqual(['continue', 'new', 'options']);
    expect(view.rows.every((row) => row.enabled)).toBe(true);
    expect(view.rows.map((row) => row.label)).toEqual([
      t('menu.continue'),
      t('menu.new'),
      t('menu.options'),
    ]);
    expect(view.rows[0]!.value).toBe(runPositionLabel(run));
    expect(view.rows[0]!.value).toContain(getBiome(biomeForMap(run.seed, run.mapIndex)).name);
    expect(view.rows.slice(1).map((row) => row.value)).toEqual(['', '']);
    expect(view.title).toBe(t('menu.title'));
    expect(view.stats).toEqual([]);
    expect(view.version).toBeNull();
  });

  it('carries one portrait per party member, in party order', () => {
    const run = savedRun();
    const view = liveMainMenuView(run, 0);

    expect(view.portraits.length).toBe(run.party.length);
    expect(view.portraits.map((portrait) => portrait.memberId)).toEqual(
      partyRows(run).map((row) => row.id),
    );
    expect(view.portraits.map((portrait) => portrait.name)).toEqual(
      partyRows(run).map((row) => row.name),
    );
    expect(view.portraits[0]!.name).toBe('Charmander');
  });

  it('drops the CONTINUE row and every portrait without a run', () => {
    const view = liveMainMenuView(null, 0);

    expect(view.rows.map((row) => row.id)).toEqual(['new', 'options']);
    expect(view.rows.some((row) => row.id === 'continue')).toBe(false);
    expect(view.portraits).toEqual([]);
    expect(view.stats).toEqual([]);
    expect(view.selected).toBe('new');
  });

  it('follows the cursor and clamps it onto the last row', () => {
    const run = savedRun();

    expect(liveMainMenuView(run, 0).selected).toBe('continue');
    expect(liveMainMenuView(run, 1).selected).toBe('new');
    expect(liveMainMenuView(run, 2).selected).toBe('options');
    expect(liveMainMenuView(run, 9).selected).toBe('options');
    expect(liveMainMenuView(run, -4).selected).toBe('continue');
    expect(liveMainMenuView(null, 0).selected).toBe('new');
    expect(liveMainMenuView(null, 9).selected).toBe('options');
  });

  it('is pure: the same input is deep-equal and JSON round-trips unchanged', () => {
    const run = savedRun();
    const first = liveMainMenuView(run, 1);
    const second = liveMainMenuView(run, 1);

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
  });
});
