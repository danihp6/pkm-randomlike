import { describe, expect, it } from 'vitest';
import totalsFrame from '../../../../../design/frames/08-stats-totals.json';
import runsFrame from '../../../../../design/frames/08b-stats-runs.json';
import pokemonFrame from '../../../../../design/frames/08c-stats-pokemon.json';
import rankingFrame from '../../../../../design/frames/09-ranking.json';
import rankingPokemonFrame from '../../../../../design/frames/09b-ranking-pokemon.json';
import phoneTotalsFrame from '../../../../../design/frames/m08-stats-totals.json';
import phoneRunsFrame from '../../../../../design/frames/m08b-stats-runs.json';
import phonePokemonFrame from '../../../../../design/frames/m08c-stats-pokemon.json';
import phoneRankingFrame from '../../../../../design/frames/m09-ranking.json';
import phoneRankingPokemonFrame from '../../../../../design/frames/m09b-ranking-pokemon.json';
import totalsFixture from '../../../../../design/fixtures/08-stats-totals.json';
import runsFixture from '../../../../../design/fixtures/08b-stats-runs.json';
import pokemonFixture from '../../../../../design/fixtures/08c-stats-pokemon.json';
import rankingFixture from '../../../../../design/fixtures/09-ranking.json';
import rankingPokemonFixture from '../../../../../design/fixtures/09b-ranking-pokemon.json';
import { isHudState } from '../../fixtures';
import { STATS_EM_DASH, STATS_FIGURE_IDS, fixtureStatsView, statsBoard } from './index';

type Node = Readonly<{
  name?: string;
  type?: string;
  properties?: Readonly<{
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    cornerRadius?: number;
    characters?: string;
  }>;
  children?: readonly Node[];
}>;

type Frame = Readonly<{ slug: string; geometry: readonly Node[]; text: readonly Node[] }>;

type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;

function nodesOf(tree: readonly Node[]): readonly Node[] {
  const out: Node[] = [];
  const walk = (node: Node): void => {
    out.push(node);
    for (const child of node.children ?? []) walk(child);
  };
  for (const node of tree) walk(node);
  return out;
}

/** The frame's own rect for a node name, in either tree (they share the node names). */
function rectOf(frame: Frame, name: string): Rect {
  const properties = nodesOf(frame.geometry).find((node) => node.name === name)?.properties ?? {};
  return {
    x: properties.x ?? -1,
    y: properties.y ?? -1,
    w: properties.width ?? -1,
    h: properties.height ?? -1,
  };
}

function radiusOf(frame: Frame, name: string): number {
  const node = nodesOf(frame.geometry).find((entry) => entry.name === name);
  return node?.properties?.cornerRadius ?? -1;
}

function textOf(frame: Frame, name: string): string {
  return nodesOf(frame.text).find((node) => node.name === name)?.properties?.characters ?? '';
}

/**
 * The rect of the text node that prints `characters`. The phone frames name every
 * label `board title` / `board subtitle`, so a name is not enough to find one.
 */
function textRect(frame: Frame, characters: string): Rect {
  const properties =
    nodesOf(frame.text).find((node) => node.properties?.characters === characters)?.properties ?? {};
  return {
    x: properties.x ?? -1,
    y: properties.y ?? -1,
    w: properties.width ?? -1,
    h: properties.height ?? -1,
  };
}

/** The text of `name` inside the frame's `group` node; the run and rank rows share names. */
function groupText(frame: Frame, group: string, name: string): string {
  const node = nodesOf(frame.text).find((entry) => entry.name === group);
  return node?.children?.find((entry) => entry.name === name)?.properties?.characters ?? '';
}

/** How many nodes of the text tree are named `<prefix><n>`: the board's row count. */
function groupCount(frame: Frame, prefix: string): number {
  return nodesOf(frame.text).filter((node) => (node.name ?? '').startsWith(prefix)).length;
}

/** The month chip's label without its arrows and double spaces: `‹  OCT 2026  ›` -> `OCT 2026`. */
function monthLabelOf(frame: Frame): string {
  return textOf(frame, 'month label')
    .replace(/[\u2039\u203a]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A payload cloned from the TOTALS fixture with one mutation applied. */
function payloadWith(edit: (block: Record<string, unknown>) => void): unknown {
  const clone = JSON.parse(JSON.stringify(totalsFixture)) as { stats: Record<string, unknown> };
  edit(clone.stats);
  return clone;
}

const RUN_ROWS = ['run row 1', 'run row 2', 'run row 3', 'run row 4', 'run row 5', 'run row 6'];
const POKEMON_ROWS = ['p row 1', 'p row 2', 'p row 3', 'p row 4', 'p row 5', 'p row 6'];
const RANK_ROWS = [
  'rank row 1',
  'rank row 2',
  'rank row 3',
  'rank row 4',
  'rank row 5',
  'rank row 6',
  'rank row 7',
  'rank row 8',
];

describe('design/fixtures/08-stats-totals.json', () => {
  const frame = totalsFrame as Frame;
  const view = fixtureStatsView(totalsFixture);

  it('carries a snapshot state that passes isHudState unchanged', () => {
    expect(isHudState(totalsFixture.state)).toBe(true);
    expect(totalsFixture.state.party).toEqual([]);
  });

  it('prints the frame’s own title, blurb, tabs and twelve figures', () => {
    expect(view).not.toBeNull();
    expect(view!.mode).toBe('totals');
    expect(view!.title).toBe(textOf(frame, 'run over title'));
    expect(view!.blurb).toBe(textOf(frame, 'run over blurb'));
    expect(view!.tabs).toEqual([
      { id: 'totals', label: textOf(frame, 'tab totals label') },
      { id: 'runs', label: textOf(frame, 'tab pokemon label') },
      { id: 'pokemon', label: textOf(frame, 'tab pokemon3 label') },
    ]);
    expect(view!.figures).toHaveLength(12);
    expect(view!.figures.map((figure) => figure.id)).toEqual([...STATS_FIGURE_IDS]);
    expect(view!.figures.map((figure) => figure.label)).toEqual(
      STATS_FIGURE_IDS.map((_, index) => textOf(frame, `stat ${index} label`)),
    );
    expect(view!.figures.map((figure) => figure.value)).toEqual(
      STATS_FIGURE_IDS.map((_, index) => textOf(frame, `stat ${index} value`)),
    );
  });

  it('carries no rows, no selector and the one BACK action', () => {
    expect(view!.columns).toEqual([]);
    expect(view!.rows).toEqual([]);
    expect(view!.empty).toBeNull();
    expect(view!.month).toBeNull();
    expect(view!.actions).toEqual([{ id: 'back', label: textOf(frame, 'button label continue') }]);
  });

  it('pins the desktop board to the frames’ own rects', () => {
    const board = statsBoard('desktop');

    expect(board.panel).toEqual({
      ...rectOf(frame, 'run over panel'),
      radius: radiusOf(frame, 'run over panel'),
    });
    expect(board.title).toEqual(rectOf(frame, 'run over title'));
    expect(board.blurb).toEqual(rectOf(frame, 'run over blurb'));
    expect(board.tabs).toEqual([
      { id: 'totals', ...rectOf(frame, 'tab totals') },
      { id: 'runs', ...rectOf(frame, 'tab pokemon') },
      { id: 'pokemon', ...rectOf(frame, 'tab pokemon3') },
    ]);
    expect(board.button).toEqual(rectOf(frame, 'continue button'));

    const label = rectOf(frame, 'stat 0 label');
    const nextLabel = rectOf(frame, 'stat 3 label');
    expect(board.figureLabel).toEqual({ ...label, pitch: nextLabel.y - label.y });
    const value = rectOf(frame, 'stat 0 value');
    const nextValue = rectOf(frame, 'stat 3 value');
    expect(board.figureValue).toEqual({ ...value, pitch: nextValue.y - value.y });

    const runs = runsFrame as Frame;
    const first = rectOf(runs, 'run row 1');
    const second = rectOf(runs, 'run row 2');
    expect(board.row).toEqual({
      x: first.x,
      y: first.y,
      w: first.w,
      h: first.h,
      pitch: second.y - first.y,
    });
  });

  it('pins the phone board to the m08 / m08b rects', () => {
    const board = statsBoard('narrow');
    const phone = phoneTotalsFrame as Frame;

    expect(board.panel).toEqual({
      ...rectOf(phone, 'm panel'),
      radius: radiusOf(phone, 'm panel'),
    });
    expect(board.title).toEqual(textRect(phone, 'STATS'));
    expect(board.blurb).toEqual(textRect(phone, 'EVERY RUN, EVERY ROUTE'));
    expect(board.tabs).toEqual([
      { id: 'totals', ...rectOf(phone, 'm tab TOTALS') },
      { id: 'runs', ...rectOf(phone, 'm tab RUNS') },
      { id: 'pokemon', ...rectOf(phone, 'm tab POKEMON') },
    ]);
    expect(board.button).toEqual(rectOf(phone, 'm button'));

    const label = textRect(phone, 'RUNS PLAYED');
    const nextLabel = textRect(phone, 'ROUTES CLEARED');
    expect(board.figureLabel).toEqual({ ...label, pitch: nextLabel.y - label.y });
    const value = textRect(phone, '128');
    const nextValue = textRect(phone, '412');
    expect(board.figureValue).toEqual({ ...value, pitch: nextValue.y - value.y });

    const phoneRuns = phoneRunsFrame as Frame;
    const first = rectOf(phoneRuns, 'm run row 1');
    const second = rectOf(phoneRuns, 'm run row 2');
    expect(board.row).toEqual({
      x: first.x,
      y: first.y,
      w: first.w,
      h: first.h,
      pitch: second.y - first.y,
    });
  });
});

describe('design/fixtures/08b-stats-runs.json', () => {
  const frame = runsFrame as Frame;
  const view = fixtureStatsView(runsFixture);

  it('carries a snapshot state that passes isHudState unchanged', () => {
    expect(isHudState(runsFixture.state)).toBe(true);
    expect(runsFixture.state.party).toEqual([]);
  });

  it('prints one row per run row of the frame, badge, seed, day and meta', () => {
    expect(view!.mode).toBe('runs');
    expect(RUN_ROWS).toHaveLength(groupCount(frame, 'run row '));
    expect(view!.rows).toHaveLength(groupCount(frame, 'run row '));

    for (const [index, group] of RUN_ROWS.entries()) {
      expect(view!.rows[index]!.id).toBe(`run-${index}`);
      expect(view!.rows[index]!.cells).toEqual([
        groupText(frame, group, 'row badge label'),
        groupText(frame, group, 'row seed'),
        groupText(frame, group, 'row date'),
        groupText(frame, group, 'row meta'),
      ]);
    }
  });

  it('carries no header row, as the frame draws none', () => {
    expect(view!.columns).toEqual([]);
    expect(view!.title).toBe(textOf(frame, 'run over title'));
    expect(view!.blurb).toBe(textOf(frame, 'run over blurb'));
    expect(view!.tabs).toHaveLength(3);
    expect(view!.figures).toEqual([]);
    expect(view!.empty).toBeNull();
    expect(view!.actions).toEqual([{ id: 'back', label: textOf(frame, 'button label continue') }]);
  });
});

describe('design/fixtures/08c-stats-pokemon.json', () => {
  const frame = pokemonFrame as Frame;
  const view = fixtureStatsView(pokemonFixture);

  it('carries a snapshot state that passes isHudState unchanged', () => {
    expect(isHudState(pokemonFixture.state)).toBe(true);
    expect(pokemonFixture.state.party).toEqual([]);
  });

  it('prints the frame’s five headers and its six Pokémon rows', () => {
    expect(view!.mode).toBe('pokemon');
    expect(view!.columns).toEqual([
      textOf(frame, 'list header pokemon'),
      textOf(frame, 'list header runs'),
      textOf(frame, 'list header kos'),
      textOf(frame, 'list header dealt'),
      textOf(frame, 'list header tanked'),
    ]);
    expect(POKEMON_ROWS).toHaveLength(groupCount(frame, 'p row '));
    expect(view!.rows).toHaveLength(groupCount(frame, 'p row '));

    for (const [index, group] of POKEMON_ROWS.entries()) {
      expect(view!.rows[index]!.cells.slice(0, 4)).toEqual([
        groupText(frame, group, 'p name'),
        groupText(frame, group, 'p runs'),
        groupText(frame, group, 'p kos'),
        groupText(frame, group, 'p dealt'),
      ]);
    }
  });

  it('draws the tanked column as the em dash the record cannot fill', () => {
    expect(view!.rows.every((row) => row.cells[4] === STATS_EM_DASH)).toBe(true);
    expect(view!.empty).toBeNull();
    expect(view!.title).toBe(textOf(frame, 'run over title'));
    expect(view!.blurb).toBe(textOf(frame, 'run over blurb'));
  });

  it('does not model the frame’s SEARCH field', () => {
    expect(Object.keys(view!)).not.toContain('search');
  });
});

describe('design/fixtures/09-ranking.json', () => {
  const frame = rankingFrame as Frame;
  const view = fixtureStatsView(rankingFixture);

  it('carries a snapshot state that passes isHudState unchanged', () => {
    expect(isHudState(rankingFixture.state)).toBe(true);
    expect(rankingFixture.state.party).toEqual([]);
  });

  it('prints the frame’s four headers and its eight player rows', () => {
    expect(view!.mode).toBe('ranking');
    expect(view!.columns).toEqual([
      textOf(frame, 'rank header player'),
      textOf(frame, 'rank header wins'),
      textOf(frame, 'rank header strike'),
      textOf(frame, 'rank header party'),
    ]);
    expect(RANK_ROWS).toHaveLength(groupCount(frame, 'rank row '));
    expect(view!.rows).toHaveLength(groupCount(frame, 'rank row '));

    for (const [index, group] of RANK_ROWS.entries()) {
      expect(view!.rows[index]!.cells.slice(0, 3)).toEqual([
        groupText(frame, group, 'rank name'),
        groupText(frame, group, 'rank wins'),
        groupText(frame, group, 'rank strike'),
      ]);
    }
  });

  it('carries the frame’s month chip, no tab strip and the one BACK action', () => {
    expect(view!.month).toEqual({ label: monthLabelOf(frame), canPrev: true, canNext: true });
    expect(monthLabelOf(frame)).toBe('OCT 2026');
    expect(view!.tabs).toEqual([]);
    expect(view!.figures).toEqual([]);
    expect(view!.empty).toBeNull();
    expect(view!.actions).toEqual([{ id: 'back', label: textOf(frame, 'button label continue') }]);
    expect(view!.title).toBe(textOf(frame, 'run over title'));
    expect(view!.blurb).toBe(textOf(frame, 'run over blurb'));
  });
});

describe('design/fixtures/09b-ranking-pokemon.json', () => {
  const frame = rankingPokemonFrame as Frame;
  const view = fixtureStatsView(rankingPokemonFixture);

  it('carries a snapshot state that passes isHudState unchanged', () => {
    expect(isHudState(rankingPokemonFixture.state)).toBe(true);
    expect(rankingPokemonFixture.state.party).toEqual([]);
  });

  it('prints the frame’s four headers and its eight species rows', () => {
    expect(view!.mode).toBe('ranking-pokemon');
    expect(view!.columns).toEqual([
      textOf(frame, 'rank header player'),
      textOf(frame, 'rank header wins'),
      textOf(frame, 'rank header strike'),
      textOf(frame, 'rank header dealt'),
    ]);
    expect(RANK_ROWS).toHaveLength(groupCount(frame, 'rank row '));
    expect(view!.rows).toHaveLength(groupCount(frame, 'rank row '));

    for (const [index, group] of RANK_ROWS.entries()) {
      expect(view!.rows[index]!.cells).toEqual([
        groupText(frame, group, 'rank name'),
        groupText(frame, group, 'rank wins'),
        groupText(frame, group, 'rank strike'),
        groupText(frame, group, `rank dealt ${index + 1}`),
      ]);
    }
  });

  it('says ALL RUNS, draws no tabs and only the BACK action', () => {
    expect(view!.month).toEqual({ label: textOf(frame, 'month label'), canPrev: false, canNext: false });
    expect(view!.month!.label).toBe('ALL RUNS');
    expect(view!.tabs).toEqual([]);
    expect(view!.actions).toEqual([{ id: 'back', label: textOf(frame, 'button label continue') }]);
  });

  it('leaves the frame’s tanked header out of the model', () => {
    expect(textOf(frame, 'rank header tanked')).toBe('DMG TANKED');
    expect(view!.columns).not.toContain(textOf(frame, 'rank header tanked'));
  });
});

describe('the phone frames share one board', () => {
  it('draws one 374 px panel, and the board pins the tall TOTALS one', () => {
    const frames = [
      phoneTotalsFrame,
      phoneRunsFrame,
      phonePokemonFrame,
      phoneRankingFrame,
      phoneRankingPokemonFrame,
    ] as Frame[];

    for (const frame of frames) {
      expect(rectOf(frame, 'm panel').x, frame.slug).toBe(8);
      expect(rectOf(frame, 'm panel').w, frame.slug).toBe(374);
    }
    expect(statsBoard('narrow').panel).toEqual({
      ...rectOf(frames[0]!, 'm panel'),
      radius: radiusOf(frames[0]!, 'm panel'),
    });
    expect(rectOf(frames[1]!, 'm panel').h).toBeLessThan(rectOf(frames[0]!, 'm panel').h);
  });
});

describe('fixtureStatsView guards', () => {
  it('rejects anything that is not a payload with a stats block', () => {
    expect(fixtureStatsView(null)).toBeNull();
    expect(fixtureStatsView('08-stats-totals')).toBeNull();
    expect(fixtureStatsView({ slug: '08-stats-totals' })).toBeNull();
    expect(fixtureStatsView({ stats: 'nope' })).toBeNull();
  });

  it('rejects an unknown mode, an empty title and an empty blurb', () => {
    expect(
      fixtureStatsView(
        payloadWith((block) => {
          block.mode = 'leaderboard';
        }),
      ),
    ).toBeNull();
    expect(
      fixtureStatsView(
        payloadWith((block) => {
          block.title = '';
        }),
      ),
    ).toBeNull();
    expect(
      fixtureStatsView(
        payloadWith((block) => {
          block.blurb = 7;
        }),
      ),
    ).toBeNull();
  });

  it('rejects a malformed tab, figure, column, row, selector or action', () => {
    expect(
      fixtureStatsView(
        payloadWith((block) => {
          (block.tabs as Record<string, unknown>[])[1]!.id = 'leaderboard';
        }),
      ),
    ).toBeNull();
    expect(
      fixtureStatsView(
        payloadWith((block) => {
          delete (block.figures as Record<string, unknown>[])[0]!.label;
        }),
      ),
    ).toBeNull();
    expect(
      fixtureStatsView(
        payloadWith((block) => {
          block.columns = ['POKEMON', 7];
        }),
      ),
    ).toBeNull();
    expect(
      fixtureStatsView(
        payloadWith((block) => {
          block.rows = [{ id: 'x', cells: [1] }];
        }),
      ),
    ).toBeNull();
    expect(
      fixtureStatsView(
        payloadWith((block) => {
          block.month = { label: 'OCT 2026', canPrev: 'yes', canNext: false };
        }),
      ),
    ).toBeNull();
    expect(
      fixtureStatsView(
        payloadWith((block) => {
          block.actions = [{ id: 'restart', label: 'RESTART' }];
        }),
      ),
    ).toBeNull();
  });

  it('accepts an empty selector, an empty row and an empty line as null', () => {
    const view = fixtureStatsView(
      payloadWith((block) => {
        block.month = null;
        block.rows = [{ id: 'run-0', cells: ['WIN', 'seed', 'OCT 18', ''] }];
        block.empty = null;
      }),
    );

    expect(view!.month).toBeNull();
    expect(view!.empty).toBeNull();
    expect(view!.rows[0]!.cells[3]).toBe('');
  });

  it('keeps a payload’s own copy, whatever the table would print', () => {
    const view = fixtureStatsView(
      payloadWith((block) => {
        block.title = 'MY STATS';
        (block.figures as Record<string, unknown>[])[0]!.value = '99';
      }),
    );

    expect(view!.title).toBe('MY STATS');
    expect(view!.figures[0]!.value).toBe('99');
  });
});
