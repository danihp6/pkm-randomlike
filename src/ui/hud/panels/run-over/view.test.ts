import { describe, expect, it } from 'vitest';
import { createRun, createRunPokemon, type RunPokemon, type RunState } from '../../../../engine/run';
import { t } from '../../../../i18n';
import { runSummary } from '../../../runSummary';
import { RUN_OVER_EM_DASH, liveRunOverView, runOverBoard } from './view';

const SEED = 'pkm-148';

function member(id: string, speciesId: string, level = 12): RunPokemon {
  return createRunPokemon({ id, speciesId, level, learnsetSeed: SEED });
}

/** A run with a party, a box and a rip list, standing on route 5. */
function endedRun(): RunState {
  const starter = member('charmander-1', 'charmander');
  const base = createRun({ seed: SEED, starter });
  return {
    ...base,
    routeIndex: 5,
    stats: { catches: 9, casualties: 6 },
    party: [starter, member('pikachu-2', 'pikachu'), member('bulbasaur-3', 'bulbasaur')],
    box: [member('abra-4', 'abra')],
    rip: [member('psyduck-5', 'psyduck'), member('gastly-6', 'gastly')],
  };
}

/** A run whose last Pokémon has fallen: the defeat screen's own state. */
function lostRun(): RunState {
  const run = endedRun();
  return { ...run, party: [], box: [], rip: [...run.party, ...run.box, ...run.rip] };
}

describe('liveRunOverView', () => {
  it('draws the loss headline and blurb on a lost run, the win pair on a won one', () => {
    const lost = liveRunOverView(lostRun(), false, 'totals', 'E');
    expect(lost.won).toBe(false);
    expect(lost.title).toBe(t('runOver.headlineLoss'));
    expect(lost.blurb).toBe(t('runOver.blurbLoss'));

    const won = liveRunOverView(endedRun(), true, 'totals', 'E');
    expect(won.won).toBe(true);
    expect(won.title).toBe(t('runOver.headlineWin'));
    expect(won.blurb).toBe(t('runOver.blurbWin'));
  });

  it('prints runSummary’s four figures, two digits, and the em dash for enemies fainted', () => {
    const run = endedRun();
    const summary = runSummary(run, false);
    const view = liveRunOverView(run, false, 'totals', 'E');
    const value = (id: string): string => view.stats.find((stat) => stat.id === id)!.value;

    expect(view.stats.map((stat) => stat.id)).toEqual(['routes', 'catches', 'lost', 'fainted']);
    expect(value('routes')).toBe(String(summary.routesCleared).padStart(2, '0'));
    expect(value('routes')).toBe('04');
    expect(value('catches')).toBe('09');
    expect(value('lost')).toBe('06');
    expect(value('fainted')).toBe(RUN_OVER_EM_DASH);
    expect(value('fainted')).toBe('\u2014');
  });

  it('labels the rows with the label half of the runOver family and never a figure', () => {
    const view = liveRunOverView(endedRun(), false, 'totals', 'E');
    const label = (id: string): string => view.stats.find((stat) => stat.id === id)!.label;

    expect(label('routes')).toBe(t('runOver.routes', { count: '' }).split(':')[0]!.trim());
    expect(label('catches')).toBe(t('runOver.caught', { count: '' }).split(':')[0]!.trim());
    expect(label('lost')).toBe(t('runOver.lost', { count: '' }).split(':')[0]!.trim());
    expect(label('fainted')).toBe(t('runOver.enemiesFainted'));
    expect(view.stats.every((stat) => !/\d/.test(stat.label))).toBe(true);
  });

  it('carries the share line and the one action’s copy', () => {
    const run = endedRun();
    const view = liveRunOverView(run, true, 'totals', 'E');

    expect(view.share).toBe(t('runOver.share', { share: runSummary(run, true).share }));
    expect(view.button.label).toBe(t('runOver.return', { key: 'E' }));
    expect(view.secondary).toBeNull();
    expect(liveRunOverView(run, true, 'totals', '\u2191').button.label).toContain('\u2191');
  });

  it('names both tabs, the table columns and the three states from the table', () => {
    const view = liveRunOverView(endedRun(), true, 'totals', 'E');

    expect(view.tabLabels).toEqual({
      totals: t('runOver.tabTotals'),
      pokemon: t('runOver.tabPokemon'),
    });
    expect(view.columnLabels).toEqual({
      pokemon: t('runOver.colPokemon'),
      kos: t('runOver.colKos'),
      dealt: t('runOver.colDealt'),
      tanked: t('runOver.colTanked'),
    });
    expect(view.stateLabels).toEqual({
      party: t('runOver.stateParty'),
      box: t('runOver.stateBox'),
      rip: t('runOver.stateRip'),
    });
    expect(view.columnLabels.pokemon).toBe(t('runOver.colPokemon'));
    expect(view.stateLabels.rip).toBe(t('runOver.stateRip'));
    expect(view.tab).toBe('totals');
    expect(liveRunOverView(endedRun(), true, 'pokemon', 'E').tab).toBe('pokemon');
  });

  it('draws the party strip in party order and none on a lost run', () => {
    expect(liveRunOverView(endedRun(), true, 'totals', 'E').portraits).toEqual([
      { memberId: 'charmander-1', name: 'Charmander' },
      { memberId: 'pikachu-2', name: 'Pikachu' },
      { memberId: 'bulbasaur-3', name: 'Bulbasaur' },
    ]);
    expect(liveRunOverView(lostRun(), false, 'totals', 'E').portraits).toEqual([]);
  });

  it('keeps TOTALS row-free and lists party, box then rip on POKEMON', () => {
    const run = endedRun();
    expect(liveRunOverView(run, true, 'totals', 'E').rows).toEqual([]);

    const rows = liveRunOverView(run, true, 'pokemon', 'E').rows;
    expect(rows.map((row) => row.memberId)).toEqual([
      'charmander-1',
      'pikachu-2',
      'bulbasaur-3',
      'abra-4',
      'psyduck-5',
      'gastly-6',
    ]);
    expect(rows.map((row) => row.state)).toEqual(['party', 'party', 'party', 'box', 'rip', 'rip']);
    const view = liveRunOverView(run, true, 'pokemon', 'E');
    expect(rows.map((row) => view.stateLabels[row.state])).toEqual([
      t('runOver.stateParty'),
      t('runOver.stateParty'),
      t('runOver.stateParty'),
      t('runOver.stateBox'),
      t('runOver.stateRip'),
      t('runOver.stateRip'),
    ]);
    expect(rows.map((row) => row.level)).toEqual([12, 12, 12, 12, 12, 12]);
  });

  it('records no per-member figure: every live row column is null, never a number', () => {
    const rows = liveRunOverView(endedRun(), true, 'pokemon', 'E').rows;

    expect(rows.every((row) => row.kos === null)).toBe(true);
    expect(rows.every((row) => row.dealt === null)).toBe(true);
    expect(rows.every((row) => row.tanked === null)).toBe(true);
  });

  it('is pure: the same input is deep-equal and JSON round-trips unchanged', () => {
    const run = endedRun();
    const first = liveRunOverView(run, true, 'pokemon', 'E');
    const second = liveRunOverView(run, true, 'pokemon', 'E');

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
  });
});

describe('runOverBoard', () => {
  it('pins the desktop card to the 06 / 07 rects', () => {
    const board = runOverBoard('desktop');

    expect(board.panel).toEqual({ x: 280, y: 170, w: 720, h: 480, radius: 11 });
    expect(board.title).toEqual({ x: 320, y: 196, w: 640, h: 36 });
    expect(board.blurb).toEqual({ x: 320, y: 236, w: 640, h: 20 });
    expect(board.tabs).toEqual([
      { id: 'totals', x: 336, y: 312, w: 90, h: 24 },
      { id: 'pokemon', x: 432, y: 312, w: 100, h: 24 },
    ]);
    expect(board.statLabel).toEqual({ x: 336, y: 360, w: 300, h: 16, pitch: 46 });
    expect(board.statValue).toEqual({ x: 764, y: 358, w: 180, h: 20, pitch: 46 });
    expect(board.share).toEqual({ x: 336, y: 544, w: 608, h: 12 });
    expect(board.button).toEqual({ x: 540, y: 590, w: 200, h: 40 });
    expect(board.row).toEqual({ x: 336, y: 404, w: 608, h: 32, pitch: 36 });
  });

  it('pins the phone card to the m06 / m07 rects', () => {
    const board = runOverBoard('narrow');

    expect(board.panel).toEqual({ x: 8, y: 96, w: 374, h: 604, radius: 12 });
    expect(board.tabs).toEqual([
      { id: 'totals', x: 32, y: 236, w: 90, h: 28 },
      { id: 'pokemon', x: 130, y: 236, w: 100, h: 28 },
    ]);
    expect(board.button).toEqual({ x: 35, y: 600, w: 320, h: 44 });
    expect(board.statLabel.pitch).toBe(46);
    expect(board.row.pitch).toBe(50);
  });
});
