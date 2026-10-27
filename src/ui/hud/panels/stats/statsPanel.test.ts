import { describe, expect, it } from 'vitest';
import runsFixture from '../../../../../design/fixtures/08b-stats-runs.json';
import pokemonFixture from '../../../../../design/fixtures/08c-stats-pokemon.json';
import rankingFixture from '../../../../../design/fixtures/09-ranking.json';
import rankingPokemonFixture from '../../../../../design/fixtures/09b-ranking-pokemon.json';
import totalsFixture from '../../../../../design/fixtures/08-stats-totals.json';
import { statsPanelTree, type StatsPanelProps } from './statsPanel';
import {
  STATS_NARROW_QUERY,
  fixtureStatsView,
  statsBoard,
  type StatsMode,
  type StatsView,
} from './view';

type Node = Readonly<{ type: unknown; props: Readonly<Record<string, unknown>> }>;

function asNode(value: unknown): Node | null {
  return typeof value === 'object' && value !== null && 'props' in value ? (value as Node) : null;
}

function childrenOf(node: Node): Node[] {
  const found: Node[] = [];
  const push = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const child of value) push(child);
      return;
    }
    const child = asNode(value);
    if (child !== null) found.push(child);
  };
  push(node.props.children);
  return found;
}

/** Every vnode under `root`, depth first, the root itself excluded. */
function nodesUnder(root: Node): Node[] {
  const found: Node[] = [];
  const walk = (node: Node): void => {
    for (const child of childrenOf(node)) {
      found.push(child);
      walk(child);
    }
  };
  walk(root);
  return found;
}

function classOf(node: Node): string {
  const value = node.props.class;
  return typeof value === 'string' ? value : '';
}

function hasClass(node: Node, name: string): boolean {
  return classOf(node).split(/\s+/).includes(name);
}

function isRule(node: Node): boolean {
  return node.props['data-hud-stats-rule'] === true;
}

function withClass(nodes: readonly Node[], name: string): Node[] {
  return nodes.filter((node) => hasClass(node, name));
}

function viewOf(payload: unknown): StatsView {
  const view = fixtureStatsView(payload);
  expect(view).not.toBeNull();
  return view!;
}

function treeOf(payload: unknown, compact = false): Node {
  const props: StatsPanelProps = { view: viewOf(payload) };
  return statsPanelTree(props, compact) as unknown as Node;
}

const TABLE_MODES = [
  ['runs', runsFixture],
  ['pokemon', pokemonFixture],
  ['ranking', rankingFixture],
  ['ranking-pokemon', rankingPokemonFixture],
] as const satisfies readonly (readonly [StatsMode, unknown])[];

/** Each figure's rule style, as a `property: value` line in box order. */
function figureStyles(tree: Node): readonly string[] {
  return withClass(nodesUnder(tree), 'stats__figure').map((figure) => {
    const rule = childrenOf(figure).find(isRule);
    const style = (rule?.props.style ?? {}) as Readonly<Record<string, string>>;
    return ['left', 'top', 'width', 'height']
      .map((property) => `${property}: ${style[property] ?? ''}`)
      .join('; ');
  });
}

describe('the figures’ rule node', () => {
  it('sits inside every one of the twelve figures, and only there', () => {
    const tree = treeOf(totalsFixture);
    const figures = withClass(nodesUnder(tree), 'stats__figure');

    expect(figures).toHaveLength(12);

    for (const figure of figures) {
      const rules = childrenOf(figure).filter(isRule);
      expect(rules).toHaveLength(1);
      expect(rules[0]!.props.class).toBe('stats__figure-rule');
      expect(rules[0]!.props['aria-hidden']).toBe('true');
    }
    expect(nodesUnder(tree).filter(isRule)).toHaveLength(12);
  });

  it('carries the desk’s own local box at 1280 and the phone’s at 390', () => {
    const desk = figureStyles(treeOf(totalsFixture));
    const phone = figureStyles(treeOf(totalsFixture, true));

    expect(desk.every((style) => style === 'left: 0px; top: 44px; width: 320px; height: 1px')).toBe(
      true,
    );
    expect(phone.every((style) => style === 'left: 0px; top: 50px; width: 165px; height: 1px')).toBe(
      true,
    );
    expect(statsBoard('desktop').figureRule.columns).toBe(3);
    expect(statsBoard('narrow').figureRule.columns).toBe(2);
    expect(STATS_NARROW_QUERY).toBe('(max-width: 600px)');
  });
});

describe('the rows’ rule node', () => {
  it('is the last child of every row of every table mode, and there is exactly one', () => {
    for (const [mode, payload] of TABLE_MODES) {
      const view = viewOf(payload);
      const tree = treeOf(payload);
      const table = withClass(nodesUnder(tree), 'stats__table')[0];
      expect(table, mode).toBeDefined();

      const rows = nodesUnder(tree).filter((node) => node.props['data-hud-stats-row'] !== undefined);
      expect(rows, mode).toHaveLength(view.rows.length);
      expect(view.rows.length, mode).toBeGreaterThan(0);
      expect(nodesUnder(table!).filter(isRule), mode).toHaveLength(view.rows.length);

      for (const row of rows) {
        const children = childrenOf(row);
        const rules = children.filter(isRule);
        expect(rules, mode).toHaveLength(1);
        expect(children[children.length - 1], mode).toBe(rules[0]);
        expect(rules[0]!.props.class, mode).toBe('stats__row-rule');
        expect(rules[0]!.props['aria-hidden'], mode).toBe('true');
        expect(rules[0]!.props.style, mode).toBeUndefined();
      }
    }
  });

  it('draws no rule in a mode that has neither figures nor rows', () => {
    const empty: StatsView = {
      mode: 'totals',
      title: 'STATS',
      blurb: 'BLURB',
      tabs: [],
      figures: [],
      columns: [],
      rows: [],
      empty: 'NOTHING YET',
      month: null,
      actions: [{ id: 'back', label: 'BACK' }],
    };
    const tree = statsPanelTree({ view: empty }, false) as unknown as Node;

    expect(nodesUnder(tree).filter(isRule)).toEqual([]);
  });
});
