import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createRun, createRunPokemon, type RunPokemon, type RunState } from '../../../../engine/run';
import { t } from '../../../../i18n';
import { runSummary } from '../../../runSummary';
import { RUN_OVER_EM_DASH, liveRunOverView, runOverBoard } from './view';

const SEED = 'pkm-148';

const RUN_OVER_CSS = readFileSync(fileURLToPath(new URL('./run-over.css', import.meta.url)), 'utf8');

function member(id: string, speciesId: string, level = 12): RunPokemon {
  return createRunPokemon({ id, speciesId, level, learnsetSeed: SEED });
}

/** The same member carrying the three counters a finished battle tallies. */
function tallied(base: RunPokemon, kos: number, damage: number, damageTaken: number): RunPokemon {
  return { ...base, kos, damage, damageTaken };
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

/** The same run, with the counters a played-through run now records. */
function talliedRun(): RunState {
  const run = endedRun();
  return {
    ...run,
    stats: { catches: 9, casualties: 6, faints: 23 },
    party: [tallied(run.party[0]!, 8, 4120, 214), tallied(run.party[1]!, 0, 0, 0), run.party[2]!],
  };
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

  it('prints the tallied totals: four two-character figures, the run’s own faint count', () => {
    const view = liveRunOverView(talliedRun(), false, 'totals', 'E');

    expect(view.stats.map((stat) => stat.id)).toEqual(['routes', 'catches', 'lost', 'fainted']);
    expect(view.stats.map((stat) => stat.value)).toEqual(['04', '09', '06', '23']);
  });

  it('pads a small count and prints a four-character one whole', () => {
    const fainted = (faints: number): string => {
      const run = { ...endedRun(), stats: { catches: 9, casualties: 6, faints } };
      return liveRunOverView(run, false, 'totals', 'E').stats[3]!.value;
    };

    expect(fainted(0)).toBe('00');
    expect(fainted(7)).toBe('07');
    expect(fainted(4120)).toBe('4120');
  });

  it('draws the em dash only for a counter the run never recorded', () => {
    const fainted = (stats: RunState['stats'], won = false): string =>
      liveRunOverView({ ...endedRun(), stats }, won, 'totals', 'E').stats[3]!.value;

    for (const stats of [
      { catches: 9, casualties: 6 },
      { catches: 9, casualties: 6, faints: NaN },
      { catches: 9, casualties: 6, faints: Infinity },
    ]) {
      const run = { ...endedRun(), stats };
      expect(runSummary(run, false).faints).toBeNull();
      expect(fainted(stats)).toBe(RUN_OVER_EM_DASH);
    }
    expect(RUN_OVER_EM_DASH).toBe('\u2014');
    expect(
      liveRunOverView(
        { ...endedRun(), stats: { catches: 9, casualties: 6 } },
        false,
        'totals',
        'E',
      ).stats.map((stat) => stat.value),
    ).toEqual(['04', '09', '06', '\u2014']);
  });

  it('reads every row’s three cells from that member’s own tallies', () => {
    const [first, second, third] = liveRunOverView(talliedRun(), true, 'pokemon', 'E').rows;

    expect([first!.kos, first!.dealt, first!.tanked]).toEqual(['08', '4120', '214']);
    expect([second!.kos, second!.dealt, second!.tanked]).toEqual(['00', '00', '00']);
    expect([third!.kos, third!.dealt, third!.tanked]).toEqual([null, null, null]);
    expect([first!.memberId, first!.name, first!.level]).toEqual(['charmander-1', 'Charmander', 12]);
    expect([second!.memberId, second!.name, second!.level]).toEqual(['pikachu-2', 'Pikachu', 12]);
    expect([third!.memberId, third!.name, third!.level]).toEqual(['bulbasaur-3', 'Bulbasaur', 12]);
    expect(liveRunOverView(talliedRun(), true, 'pokemon', 'E').rows.map((row) => row.memberId)).toEqual([
      'charmander-1',
      'pikachu-2',
      'bulbasaur-3',
      'abra-4',
      'psyduck-5',
      'gastly-6',
    ]);
    expect(liveRunOverView(talliedRun(), true, 'totals', 'E').rows).toEqual([]);
  });

  it('keeps a row column null for a member that never recorded it', () => {
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

describe('run-over.css', () => {
  it('keeps no defeat-specific override: both boards share one geometry', () => {
    expect(RUN_OVER_CSS.match(/\[data-won='(true|false)'\]/g)).toEqual(["[data-won='true']"]);
    expect(/(\.run-over__tabs[^{}]*)\{[^}]*display:\s*none/.test(RUN_OVER_CSS)).toBe(false);
  });
});
