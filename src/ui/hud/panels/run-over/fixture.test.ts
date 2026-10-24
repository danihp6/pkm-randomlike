import { describe, expect, it } from 'vitest';
import defeatFrame from '../../../../../design/frames/06-run-over-defeat.json';
import pokemonFrame from '../../../../../design/frames/07b-run-over-victory-pokemon.json';
import victoryFrame from '../../../../../design/frames/07-run-over-victory.json';
import phoneDefeatFrame from '../../../../../design/frames/m06-run-over-defeat.json';
import phonePokemonFrame from '../../../../../design/frames/m07b-run-over-victory-pokemon.json';
import phoneVictoryFrame from '../../../../../design/frames/m07-run-over-victory.json';
import defeatFixture from '../../../../../design/fixtures/06-run-over-defeat.json';
import pokemonFixture from '../../../../../design/fixtures/07b-run-over-victory-pokemon.json';
import victoryFixture from '../../../../../design/fixtures/07-run-over-victory.json';
import { isHudState } from '../../fixtures';
import { RUN_OVER_STAT_IDS, fixtureRunOverView, runOverBoard } from './index';

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

/** A payload cloned from the POKéMON fixture with one mutation applied. */
function payloadWith(edit: (block: Record<string, unknown>) => void): unknown {
  const clone = JSON.parse(JSON.stringify(pokemonFixture)) as { runOver: Record<string, unknown> };
  edit(clone.runOver);
  return clone;
}

describe('design/fixtures/06-run-over-defeat.json', () => {
  const frame = defeatFrame as Frame;
  const view = fixtureRunOverView(defeatFixture);

  it('carries a snapshot state that passes isHudState unchanged', () => {
    expect(isHudState(defeatFixture.state)).toBe(true);
    expect(defeatFixture.state.party).toEqual([]);
  });

  it('prints the frame’s own defeat copy, four figures, share and one action', () => {
    expect(view).not.toBeNull();
    expect(view!.won).toBe(false);
    expect(view!.tab).toBe('totals');
    expect(view!.title).toBe(textOf(frame, 'run over title'));
    expect(view!.blurb).toBe(textOf(frame, 'run over blurb'));
    expect(view!.share).toBe(textOf(frame, 'run share'));
    expect(view!.button.label).toBe(textOf(frame, 'button label main menu'));
    expect(view!.secondary).toBeNull();
    expect(view!.stats.map((stat) => stat.id)).toEqual([...RUN_OVER_STAT_IDS]);
    expect(view!.stats.map((stat) => stat.label)).toEqual(
      RUN_OVER_STAT_IDS.map((_, index) => textOf(frame, `run stat label ${index}`)),
    );
    expect(view!.stats.map((stat) => stat.value)).toEqual(
      RUN_OVER_STAT_IDS.map((_, index) => textOf(frame, `run stat value ${index}`)),
    );
  });

  it('draws no party strip and no row on a defeat', () => {
    expect(view!.portraits).toEqual([]);
    expect(view!.rows).toEqual([]);
    expect(view!.tabLabels).toEqual({
      totals: textOf(frame, 'tab totals label'),
      pokemon: textOf(frame, 'tab pokemon label'),
    });
  });

  it('pins the desktop board to the frame’s own rects', () => {
    const board = runOverBoard('desktop');
    const panel = rectOf(frame, 'run over panel');

    expect(board.panel).toEqual({ ...panel, radius: radiusOf(frame, 'run over panel') });
    expect(board.title).toEqual(rectOf(frame, 'run over title'));
    expect(board.blurb).toEqual(rectOf(frame, 'run over blurb'));
    expect(board.share).toEqual(rectOf(frame, 'run share'));
    expect(board.button).toEqual(rectOf(frame, 'main menu button'));

    const totals = rectOf(frame, 'tab totals');
    const pokemon = rectOf(frame, 'tab pokemon');
    expect(board.tabs).toEqual([
      { id: 'totals', ...totals },
      { id: 'pokemon', ...pokemon },
    ]);

    const first = rectOf(frame, 'run stat label 0');
    const second = rectOf(frame, 'run stat label 1');
    expect(board.statLabel).toEqual({ ...first, pitch: second.y - first.y });
    const value0 = rectOf(frame, 'run stat value 0');
    const value1 = rectOf(frame, 'run stat value 1');
    expect(board.statValue).toEqual({ ...value0, pitch: value1.y - value0.y });
  });
});

describe('design/fixtures/07-run-over-victory.json', () => {
  const frame = victoryFrame as Frame;
  const view = fixtureRunOverView(victoryFixture);

  it('prints the frame’s own victory copy and its two actions', () => {
    expect(view!.won).toBe(true);
    expect(view!.title).toBe(textOf(frame, 'run over title'));
    expect(view!.blurb).toBe(textOf(frame, 'run over blurb'));
    expect(view!.button.label).toBe(textOf(frame, 'button label end run'));
    expect(view!.secondary).toEqual({ label: textOf(frame, 'button label continue') });
    expect(view!.stats.map((stat) => stat.value)).toEqual([
      '08',
      '17',
      '04',
      textOf(frame, 'run stat value 3'),
    ]);
  });

  it('draws four party portraits, one per win party cell of the frame', () => {
    const cells = [0, 1, 2, 3].map((slot) => rectOf(frame, `win party ${slot}`));

    expect(view!.portraits).toHaveLength(cells.length);
    expect(view!.portraits!.map((portrait) => portrait.memberId)).toEqual(
      victoryFixture.state.party.map((row) => row.id),
    );
    expect(cells[1]!.x - cells[0]!.x).toBe(52);
    expect(cells.every((cell) => cell.w === 40 && cell.h === 40)).toBe(true);
  });

  it('centres the one-action box on the frame’s two-button row', () => {
    const board = runOverBoard('desktop');
    const endRun = rectOf(frame, 'end run button');
    const cont = rectOf(frame, 'continue button');

    expect(endRun.w).toBe(board.button.w);
    expect(endRun.h).toBe(board.button.h);
    expect(cont.x - (endRun.x + endRun.w)).toBe(24);
    expect((endRun.x + cont.x + cont.w) / 2).toBe(board.button.x + board.button.w / 2);
  });
});

describe('design/fixtures/07b-run-over-victory-pokemon.json', () => {
  const frame = pokemonFrame as Frame;
  const view = fixtureRunOverView(pokemonFixture);

  it('opens on the POKéMON tab and carries the frame’s five rows with its figures', () => {
    expect(view!.tab).toBe('pokemon');
    expect(view!.rows).toHaveLength(5);

    for (const [index, row] of view!.rows.entries()) {
      expect(row.name).toBe(textOf(frame, `row name ${index}`));
      expect(row.kos).toBe(textOf(frame, `row kos ${index}`));
      expect(row.dealt).toBe(textOf(frame, `row dealt ${index}`));
      expect(row.tanked).toBe(textOf(frame, `row tanked ${index}`));
    }
    expect(view!.rows.map((row) => row.kos)).toEqual(['8', '6', '5', '4', '4']);
    expect(view!.rows.map((row) => row.state)).toEqual(['party', 'party', 'box', 'party', 'rip']);
  });

  it('pins the row block to the frame’s 36 px pitch within the 2 px gate', () => {
    const board = runOverBoard('desktop');
    const first = rectOf(frame, 'list row 0');
    const second = rectOf(frame, 'list row 1');

    // The board's rows sit 2 px under the frame's first row so both the frame's
    // 402 and the spec's 406 fall inside the diff's ±2 gate; the pitch is exact.
    expect(Math.abs(board.row.y - first.y)).toBeLessThanOrEqual(2);
    expect(board.row.pitch).toBe(second.y - first.y);
    expect(board.row.w).toBe(first.w);
    expect(board.row.h).toBe(first.h);
    expect(board.row.x).toBe(first.x);
  });

  it('pins the phone board to the m06 / m07 rects', () => {
    const board = runOverBoard('narrow');
    const victory = phoneVictoryFrame as Frame;
    const defeat = phoneDefeatFrame as Frame;
    const phonePokemon = phonePokemonFrame as Frame;

    expect(board.panel).toEqual({
      ...rectOf(victory, 'm panel'),
      radius: radiusOf(victory, 'm panel'),
    });
    expect(board.tabs).toEqual([
      { id: 'totals', ...rectOf(victory, 'm tab TOTALS') },
      { id: 'pokemon', ...rectOf(victory, 'm tab POKEMON') },
    ]);
    expect(board.button).toEqual(rectOf(defeat, 'm button'));
    // The phone defeat frame carries no tab strip, so its card is exactly 44 px
    // shorter; the board pins the taller, tab-bearing variant (`m07` / `m07b`).
    expect(rectOf(defeat, 'm panel').h + 44).toBe(rectOf(victory, 'm panel').h);
    expect(board.row.pitch).toBe(
      rectOf(phonePokemon, 'm p row 1').y - rectOf(phonePokemon, 'm p row 0').y,
    );
    expect(board.row.w).toBe(rectOf(phonePokemon, 'm p row 0').w);
    expect(board.row.h).toBe(rectOf(phonePokemon, 'm p row 0').h);
  });
});

describe('fixtureRunOverView guards', () => {
  it('rejects anything that is not a payload with a runOver block', () => {
    expect(fixtureRunOverView(null)).toBeNull();
    expect(fixtureRunOverView('07-run-over-victory')).toBeNull();
    expect(fixtureRunOverView({ slug: '07-run-over-victory' })).toBeNull();
    expect(fixtureRunOverView({ runOver: 'nope' })).toBeNull();
  });

  it('rejects an unknown stat id, a missing stat and a short list', () => {
    expect(
      fixtureRunOverView(
        payloadWith((block) => {
          (block.stats as Record<string, unknown>[])[3]!.id = 'dealt';
        }),
      ),
    ).toBeNull();
    expect(
      fixtureRunOverView(
        payloadWith((block) => {
          delete (block.stats as Record<string, unknown>[])[2]!.label;
        }),
      ),
    ).toBeNull();
    expect(
      fixtureRunOverView(
        payloadWith((block) => {
          block.stats = (block.stats as Record<string, unknown>[]).slice(0, 3);
        }),
      ),
    ).toBeNull();
  });

  it('rejects an unknown tab and a payload without its button copy', () => {
    expect(
      fixtureRunOverView(
        payloadWith((block) => {
          block.tab = 'ranking';
        }),
      ),
    ).toBeNull();
    expect(
      fixtureRunOverView(
        payloadWith((block) => {
          block.button = {};
        }),
      ),
    ).toBeNull();
    expect(
      fixtureRunOverView(
        payloadWith((block) => {
          block.title = '';
        }),
      ),
    ).toBeNull();
  });

  it('rejects a row with a non-string, non-null column and an unknown state', () => {
    expect(
      fixtureRunOverView(
        payloadWith((block) => {
          (block.rows as Record<string, unknown>[])[0]!.kos = 8;
        }),
      ),
    ).toBeNull();
    expect(
      fixtureRunOverView(
        payloadWith((block) => {
          (block.rows as Record<string, unknown>[])[1]!.state = 'dead';
        }),
      ),
    ).toBeNull();
    expect(
      fixtureRunOverView(
        payloadWith((block) => {
          (block.rows as Record<string, unknown>[])[2]!.level = '33';
        }),
      ),
    ).toBeNull();
  });

  it('accepts a null column as the em dash source and keeps it null', () => {
    const view = fixtureRunOverView(
      payloadWith((block) => {
        (block.rows as Record<string, unknown>[])[0]!.kos = null;
      }),
    );

    expect(view!.rows[0]!.kos).toBeNull();
    expect(view!.rows[1]!.kos).toBe('6');
  });

  it('keeps reading portraits from the state, whatever the rows say', () => {
    const view = fixtureRunOverView(
      payloadWith((block) => {
        block.rows = [];
      }),
    );

    expect(view!.rows).toEqual([]);
    expect(view!.portraits!.map((portrait) => portrait.memberId)).toEqual(
      pokemonFixture.state.party.map((row) => row.id),
    );
  });
});
