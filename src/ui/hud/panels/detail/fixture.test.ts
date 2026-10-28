import { describe, expect, it } from 'vitest';
import fixture from '../../../../../design/fixtures/03m-panels-pokemon-moves.json';
import type { MemberDetail } from '../../../partyDetail';
import { isHudState } from '../../fixtures';
import { DetailPanel } from './detailPanel';
import type { DetailIntent } from './mount';
import {
  DETAIL_TAB_H,
  DETAIL_TABS_TOP,
  detailPanelView,
  type DetailPanelUi,
  type DetailPoolRow,
} from './view';

/**
 * The `03m Panels · pokemon moves` frame as data: the panel builds headlessly from
 * the fixture's own copy of the member, the learnset band and the cursor state, so
 * the strings the board prints are pinned without a dex read or a scene.
 */
type FixtureFile = Readonly<{
  slug: string;
  state: unknown;
  detail: MemberDetail;
  pool: readonly DetailPoolRow[];
  ui: DetailPanelUi;
}>;

const FIXTURE = fixture as unknown as FixtureFile;
const DESKTOP = { width: 1280, height: 800 };

describe('the 03m fixture', () => {
  it('carries the frame slug and a HudState that validates unchanged', () => {
    expect(FIXTURE.slug).toBe('03m-panels-pokemon-moves');
    expect(isHudState(FIXTURE.state)).toBe(true);
  });

  it('opens the MOVES tab on slot 0 with nothing pinned', () => {
    expect(FIXTURE.ui).toEqual({
      tab: 'moves',
      cursor: 0,
      page: 0,
      poolCursor: 0,
      info: null,
      abilityInfo: false,
      grab: null,
      nickname: null,
    });
    const view = detailPanelView(FIXTURE.detail, FIXTURE.pool, FIXTURE.ui, DESKTOP);
    expect(view.open).toBe(true);
    expect(view.tabs.find((tab) => tab.active)?.tab).toBe('moves');
    expect(view.moves[0].selected).toBe(true);
  });

  it('reproduces the frame header and its four move cards', () => {
    const view = detailPanelView(FIXTURE.detail, FIXTURE.pool, FIXTURE.ui, DESKTOP);
    expect(view.name).toBe('CHARIZARD');
    expect(view.level).toBe('Lv36');
    expect(view.moves.map((slot) => slot.name)).toEqual([
      'FLAMETHROWER',
      'AIR SLASH',
      'DRAGON CLAW',
      'EARTHQUAKE',
    ]);
    expect(view.moves.map((slot) => `${slot.pp} ${slot.power} ${slot.accuracy}`)).toEqual([
      'PP 15/15 PWR 90 ACC 100',
      'PP 15/15 PWR 75 ACC 95',
      'PP 10/10 PWR 80 ACC 100',
      'PP 10/10 PWR 100 ACC 100',
    ]);
    expect(view.moves.every((slot) => slot.enabled)).toBe(true);
  });

  it('reproduces the frame learnset band', () => {
    const view = detailPanelView(FIXTURE.detail, FIXTURE.pool, FIXTURE.ui, DESKTOP);
    expect(view.pool.map((row) => row.name).slice(0, 2)).toEqual(['RAZOR LEAF', 'LEECH SEED']);
    expect(view.pool.map((row) => row.source).slice(0, 2)).toEqual(['Lv 12', 'Lv 15']);
    expect(view.pool).toHaveLength(4);
    expect(view.emptyPool).toBeNull();
  });

  it('paints the header, the stats and the nature tint the frame prints', () => {
    const view = detailPanelView(FIXTURE.detail, FIXTURE.pool, FIXTURE.ui, DESKTOP);
    expect(view.nature).toBe('NATURE  Adamant');
    expect(view.ability).toBe('ABILITY  Blaze');
    expect(view.held).toBe('HELD  none');
    expect(view.caught).toBe('CAUGHT  starter');
    expect(view.stats.find((row) => row.stat === 'atk')?.effect).toBe('up');
    expect(view.stats.find((row) => row.stat === 'spa')?.effect).toBe('down');
  });

  it('pins the pasted family graph with the current row on charizard', () => {
    const evolutionTab: DetailPanelUi = { ...FIXTURE.ui, tab: 'evolution' };
    const view = detailPanelView(FIXTURE.detail, FIXTURE.pool, evolutionTab, DESKTOP);
    expect(view.evolution?.rows.map((row) => row.id)).toEqual([
      'charmander',
      'charmeleon',
      'charizard',
      'charizardmegax',
      'charizardmegay',
      'charizardgmax',
    ]);
    expect(view.evolution?.rows.filter((row) => row.current).map((row) => row.id)).toEqual([
      'charizard',
    ]);
    expect(view.evolution?.edges.map((edge) => edge.d)).toEqual([
      'M 34 14 H 25 V 42 H 42',
      'M 68 42 H 59 V 70 H 76',
      'M 102 70 H 93 V 98 H 110',
      'M 102 70 H 93 V 126 H 110',
      'M 102 70 H 93 V 154 H 110',
    ]);
    expect(view.evolution?.box).toEqual({ x: 20, y: 130, w: 420, h: 168 });
    expect(detailPanelView(FIXTURE.detail, FIXTURE.pool, FIXTURE.ui, DESKTOP).evolution).toBeNull();
  });
});

type ElementProps = Record<string, unknown>;

/** Every element the card paints, at any depth: a component vnode is answered by calling it. */
function cardElements(props: ElementProps): ElementProps[] {
  const found: ElementProps[] = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const entry of value) walk(entry);
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    const node = value as Readonly<{ type?: unknown; props?: ElementProps }>;
    if (node.props === undefined || node.props === null) return;
    found.push(node.props);
    if (typeof node.type === 'function') {
      walk((node.type as (given: ElementProps) => unknown)(node.props));
      return;
    }
    walk(node.props.children);
  };
  walk(props.children);
  return found;
}

function cardOf(
  ui: DetailPanelUi = FIXTURE.ui,
  onIntent?: (intent: DetailIntent) => void,
): ElementProps {
  const view = detailPanelView(FIXTURE.detail, FIXTURE.pool, ui, DESKTOP);
  return (DetailPanel({ view, onIntent }) as unknown as Readonly<{ props: ElementProps }>).props;
}

const STATS_UI: DetailPanelUi = { ...FIXTURE.ui, tab: 'stats' };
const EVOLUTION_UI: DetailPanelUi = { ...FIXTURE.ui, tab: 'evolution' };

function attribute(elements: readonly ElementProps[], name: string): unknown[] {
  return elements.filter((props) => name in props).map((props) => props[name]);
}

class FakeElement {
  readonly tagName: string;
  constructor(tagName: string) {
    this.tagName = tagName;
  }
}

function pressTab(
  ui: DetailPanelUi,
  key: string,
  target: FakeElement,
): Readonly<{ intents: DetailIntent[]; prevented: number; stopped: number }> {
  const intents: DetailIntent[] = [];
  const onKeyDown = cardOf(ui, (intent) => intents.push(intent)).onKeyDown as (event: unknown) => void;
  let prevented = 0;
  let stopped = 0;
  onKeyDown({
    key,
    target,
    preventDefault: () => {
      prevented += 1;
    },
    stopPropagation: () => {
      stopped += 1;
    },
  });
  return { intents, prevented, stopped };
}

describe('the card as a tree', () => {
  it('paints three tab buttons in board order from the view', () => {
    const elements = cardElements(cardOf());
    const tabs = elements.filter((props) => typeof props['data-hud-detail-tab'] === 'string');
    expect(tabs.map((props) => props['data-hud-detail-tab'])).toEqual(['stats', 'evolution', 'moves']);
    expect(tabs.map((props) => props.children)).toEqual(['STATS', 'EVOLUTION', 'MOVES']);
    expect(tabs.map((props) => props['aria-pressed'])).toEqual([false, false, true]);
    expect(tabs.every((props) => props.type === 'button')).toBe(true);
    expect(tabs.map((props) => props.style)).toEqual([
      { left: '20px', top: `${DETAIL_TABS_TOP}px`, width: '137px', height: `${DETAIL_TAB_H}px` },
      { left: '161px', top: `${DETAIL_TABS_TOP}px`, width: '137px', height: `${DETAIL_TAB_H}px` },
      { left: '302px', top: `${DETAIL_TABS_TOP}px`, width: '138px', height: `${DETAIL_TAB_H}px` },
    ]);
  });

  it('keeps the tab strip as the one container all three boxes hang from', () => {
    const strip = cardElements(cardOf()).find((props) => props['data-hud-detail'] === 'tabs');
    expect(strip).toBeDefined();
    const children = strip?.children as readonly Readonly<{ props: ElementProps }>[] | undefined;
    expect(children?.map((child) => child.props['data-hud-detail-tab'])).toEqual([
      'stats',
      'evolution',
      'moves',
    ]);
  });

  it('paints the graph on EVOLUTION alone, and the stats block on STATS alone', () => {
    const stats = cardElements(cardOf(STATS_UI));
    expect(attribute(stats, 'data-hud-detail').includes('evolution')).toBe(false);
    expect(attribute(stats, 'data-hud-detail-stat')).toHaveLength(6);
    expect(stats.filter((props) => props['data-hud-detail'] === 'stats')[0]?.hidden).toBe(false);

    const evolution = cardElements(cardOf(EVOLUTION_UI));
    expect(attribute(evolution, 'data-hud-detail').includes('evolution')).toBe(true);
    expect(attribute(evolution, 'data-hud-detail-evo-row')).toHaveLength(6);
    expect(evolution.filter((props) => props['data-hud-detail'] === 'stats')[0]?.hidden).toBe(true);
    expect(attribute(evolution, 'data-hud-detail-slot')).toHaveLength(0);
  });

  it('keeps the move cells, the search and the pool on MOVES alone', () => {
    const moves = cardElements(cardOf());
    expect(attribute(moves, 'data-hud-detail-slot')).toHaveLength(4);
    expect(
      moves.filter((props) => props.class === 'detail__slot-info kit-row--interactive'),
    ).toHaveLength(4);
    expect(attribute(moves, 'data-hud-detail').includes('evolution')).toBe(false);
    expect(moves.some((props) => props['data-hud-detail'] === 'search')).toBe(true);
    expect(moves.some((props) => props['data-hud-detail'] === 'pool')).toBe(true);
  });
});

describe('the card s keyboard', () => {
  const holder = globalThis as unknown as { Element?: unknown };
  const previous = holder.Element;

  function withElementTree(run: () => void): void {
    holder.Element = FakeElement;
    try {
      run();
    } finally {
      if (previous === undefined) delete holder.Element;
      else holder.Element = previous;
    }
  }

  it('steps the tab with ArrowRight and ArrowLeft and swallows the key', () => {
    withElementTree(() => {
      const target = new FakeElement('DIV');
      const right = pressTab(STATS_UI, 'ArrowRight', target);
      expect(right.intents).toStrictEqual([{ type: 'tab', tab: 'evolution' }]);
      expect(right.prevented).toBe(1);
      expect(right.stopped).toBe(1);

      expect(pressTab(EVOLUTION_UI, 'ArrowRight', target).intents).toStrictEqual([
        { type: 'tab', tab: 'moves' },
      ]);
      expect(pressTab(STATS_UI, 'ArrowLeft', target).intents).toStrictEqual([
        { type: 'tab', tab: 'moves' },
      ]);
      expect(pressTab(STATS_UI, 'Enter', target)).toStrictEqual({
        intents: [],
        prevented: 0,
        stopped: 0,
      });
    });
  });

  it('leaves the nickname field its own arrows', () => {
    withElementTree(() => {
      expect(pressTab(STATS_UI, 'ArrowRight', new FakeElement('INPUT'))).toStrictEqual({
        intents: [],
        prevented: 0,
        stopped: 0,
      });
    });
  });
});
