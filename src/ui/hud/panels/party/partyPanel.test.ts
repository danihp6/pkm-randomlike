import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { PORTRAIT_COLS } from '../../../../data/portraits';
import { t } from '../../../../i18n';
import type { HudCommand } from '../../commands';
import type { HudPartyRow, HudRoute, HudState } from '../../state';
import { PartyCard, type PartyDrag, type PartyPanelProps } from './partyPanel';
import { initialPartyPanelUi, partyPanelView, type PartyPanelView } from './view';
import * as view from './view';

const DESKTOP = { width: 1280, height: 800 } as const;
const PARTY_CSS = fileURLToPath(new URL('./party.css', import.meta.url));

function member(id: string, overrides: Partial<HudPartyRow> = {}): HudPartyRow {
  return {
    id,
    speciesId: 'pikachu',
    name: id.toUpperCase(),
    level: 12,
    hp: 20,
    maxHp: 40,
    status: null,
    statusLabel: null,
    heldItem: null,
    heldItemName: null,
    shiny: false,
    dark: false,
    hpFraction: 0.5,
    ...overrides,
  };
}

const ROUTE: HudRoute = {
  mode: 'finite',
  mapIndex: 1,
  routeInMap: 0,
  routeIndex: 3,
  biomeId: 'forest',
  biomeName: 'Forest',
  levelCap: 20,
  squadLevel: 12,
  xp: 480,
  xpFraction: 0.5,
  pokevialCharges: 2,
  pokevialMax: 3,
  bossDefeated: false,
  discoveredRooms: [0, 1],
  mission: null,
  missionsCompleted: 0,
  stats: { catches: 1, casualties: 0 },
};

function partyView(members: readonly HudPartyRow[]): PartyPanelView {
  const state: HudState = {
    party: members,
    bag: [],
    money: 120,
    route: ROUTE,
    battle: null,
    notice: null,
  };
  return partyPanelView(state, initialPartyPanelUi(), DESKTOP);
}

type Node = Readonly<{ type: unknown; props: Record<string, unknown> }>;

/** Every vnode the tree carries, depth first, in paint order; a component is painted too. */
function nodes(value: unknown, found: Node[] = []): Node[] {
  if (Array.isArray(value)) {
    for (const entry of value) nodes(entry, found);
    return found;
  }
  if (typeof value !== 'object' || value === null) return found;
  const node = value as Node;
  if (node.props === undefined) return found;
  if (typeof node.type === 'function') {
    return nodes((node.type as (props: unknown) => unknown)(node.props), found);
  }
  found.push(node);
  return nodes(node.props.children, found);
}

/** One paint of the card, as Preact would mount it. */
function paint(props: PartyPanelProps & Readonly<{ drag: PartyDrag }>): Node {
  return PartyCard(props) as unknown as Node;
}

function rowNodes(card: Node): readonly Node[] {
  return nodes(card.props.children).filter((node) => node.props['data-hud-party-member'] !== undefined);
}

function inside(row: Node, match: (props: Record<string, unknown>) => boolean): Node {
  const node = nodes(row.props.children).find((entry) => match(entry.props));
  if (node === undefined) throw new Error('the row paints no such node');
  return node;
}

const portraitNode = (row: Node): Node =>
  inside(row, (props) => props['data-hud-party-portrait'] === true);
const hpNode = (row: Node): Node => inside(row, (props) => props['data-hud-party-hp'] === true);
const fillNode = (row: Node): Node => inside(row, (props) => props['data-hud-party-hp-fill'] === true);

/** The card's drag cell, as the mount holds it: one object across paints. */
function dragCell(): PartyDrag {
  const cell = {
    from: null as number | null,
    swallowed: { current: false },
    setFrom: (next: number | null): void => {
      cell.from = next;
    },
  };
  return cell;
}

function handler(node: Node, name: string): () => void {
  const fn = node.props[name];
  if (typeof fn !== 'function') throw new Error(`the node has no ${name}`);
  return fn as () => void;
}

describe('the card’s pointer drag', () => {
  it('emits one onReorder for a drop on another row and eats the click that follows', () => {
    const view = partyView([member('a'), member('b'), member('c')]);
    const drag = dragCell();
    const send = vi.fn<(command: HudCommand) => void>();
    const reorder = vi.fn<(from: number, to: number) => void>();

    const picked = rowNodes(paint({ view, drag, onCommand: send, onReorder: reorder }));
    expect(picked).toHaveLength(3);
    handler(picked[1]!, 'onPointerDown')();
    expect(drag.from).toBe(1);
    expect(reorder).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();

    const dropped = rowNodes(paint({ view, drag, onCommand: send, onReorder: reorder }));
    handler(dropped[0]!, 'onPointerUp')();
    expect(reorder).toHaveBeenCalledTimes(1);
    expect(reorder).toHaveBeenCalledWith(1, 0);
    expect(drag.from).toBeNull();
    expect(drag.swallowed.current).toBe(true);

    handler(dropped[0]!, 'onClick')();
    expect(send).not.toHaveBeenCalled();
    expect(drag.swallowed.current).toBe(false);

    const after = rowNodes(paint({ view, drag, onCommand: send, onReorder: reorder }));
    handler(after[0]!, 'onClick')();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ type: 'member', memberId: 'a' });
  });

  it('keeps the shipped member command for a release on the same row', () => {
    const view = partyView([member('a'), member('b')]);
    const drag = dragCell();
    const send = vi.fn<(command: HudCommand) => void>();
    const reorder = vi.fn<(from: number, to: number) => void>();

    const rows = rowNodes(paint({ view, drag, onCommand: send, onReorder: reorder }));
    handler(rows[1]!, 'onPointerDown')();
    handler(rows[1]!, 'onPointerUp')();
    expect(reorder).not.toHaveBeenCalled();
    expect(drag.from).toBeNull();

    handler(rows[1]!, 'onClick')();
    expect(send).toHaveBeenCalledWith({ type: 'member', memberId: 'b' });
  });

  it('clears the carried row on a pointer-up outside every row and on a cancel', () => {
    const view = partyView([member('a'), member('b')]);
    const drag = dragCell();
    const reorder = vi.fn<(from: number, to: number) => void>();

    const card = paint({ view, drag, onReorder: reorder });
    const rows = rowNodes(card);
    handler(rows[1]!, 'onPointerDown')();
    handler(card, 'onPointerUp')();
    expect(drag.from).toBeNull();
    expect(reorder).not.toHaveBeenCalled();

    handler(rows[0]!, 'onPointerDown')();
    handler(card, 'onPointerCancel')();
    expect(drag.from).toBeNull();
    expect(reorder).not.toHaveBeenCalled();
  });

  it('marks the carried row and no other one', () => {
    const view = partyView([member('a'), member('b')]);
    const drag = dragCell();
    const dragged = rowNodes(paint({ view, drag }));
    handler(dragged[1]!, 'onPointerDown')();

    const repainted = rowNodes(paint({ view, drag }));
    expect(repainted.map((row) => row.props['data-dragging'])).toEqual([undefined, 'true']);
  });

  it('sends no reorder without a carried row', () => {
    const view = partyView([member('a'), member('b')]);
    const reorder = vi.fn<(from: number, to: number) => void>();
    const rows = rowNodes(paint({ view, drag: dragCell(), onReorder: reorder }));
    handler(rows[1]!, 'onPointerUp')();
    expect(reorder).not.toHaveBeenCalled();
  });
});

describe('the card’s portrait cells', () => {
  it('paints each member’s atlas cell into the 45 px box', () => {
    const view = partyView([member('a'), member('b', { speciesId: '' })]);
    const rows = rowNodes(paint({ view, drag: dragCell() }));
    const [caught, nameless] = rows;
    const mine = caught!.props['data-hud-party-member'];
    expect(mine).toBe('a');

    const style = portraitNode(caught!).props.style as Record<string, string>;
    const crop = view.rows[0]!.portraitImage!;
    expect(style.backgroundImage).toMatch(/^url\(".*"\)$/);
    expect(style.backgroundSize).toBe(`${PORTRAIT_COLS * 45}px auto`);
    expect(style.backgroundPosition).toBe(`${-crop.col * 45}px ${-crop.row * 45}px`);
    expect(style.left).toBe('2px');
    expect(style.top).toBe('4px');
    expect(style.width).toBe('45px');
    expect(style.height).toBe('45px');

    const box = portraitNode(nameless!).props.style as Record<string, string>;
    expect(box.left).toBe('2px');
    expect(box.top).toBe('4px');
    expect(box.width).toBe('45px');
    expect(box.height).toBe('45px');
    expect('backgroundImage' in box).toBe(false);
  });
});

describe('the card’s HP fills', () => {
  it('keeps the bar’s own hook and starts the fill at the track’s left edge', () => {
    const view = partyView([member('a', { hpFraction: 1, hp: 40, maxHp: 40 })]);
    const [row] = rowNodes(paint({ view, drag: dragCell() }));

    const track = hpNode(row!).props.style as Record<string, string>;
    const fill = fillNode(row!);
    expect(fill.props['data-hud-party-hp-fill']).toBe(true);
    expect(fill.props.style).toStrictEqual({ width: `${view.rows[0]!.hpBar.w}px` });
    expect(view.rows[0]!.hpFraction * view.rows[0]!.hpBar.w).toBe(view.rows[0]!.hpBar.w);
    expect(track.width).toBe(`${view.rows[0]!.hpBar.w}px`);
    expect(track.left).toBe(`${view.rows[0]!.hpBar.x - view.rows[0]!.row.x}px`);
  });

  it('is a fraction of the very same track below 100 %', () => {
    const view = partyView([member('a', { hpFraction: 0.25 })]);
    const [row] = rowNodes(paint({ view, drag: dragCell() }));
    expect(fillNode(row!).props.style).toStrictEqual({
      width: `${0.25 * view.rows[0]!.hpBar.w}px`,
    });
  });

  it('no longer exports the retired track ratio and drops its inset tokens', () => {
    expect('PARTY_HP_FILL_RATIO' in view).toBe(false);
    const css = readFileSync(PARTY_CSS, 'utf8');
    expect(css).not.toContain('--party-hp-inset-x');
    expect(css).not.toContain('--party-hp-inset-y');
    expect(css).not.toContain('--party-hp-fill-height');
    const rule = /\.party__hp-fill\s*{([^}]*)}/.exec(css);
    expect(rule).not.toBeNull();
    expect(rule![1]).toContain('left: 0;');
    expect(rule![1]).toContain('top: 0;');
    expect(rule![1]).toContain('height: 100%;');
  });
});

describe('the card’s press path', () => {
  it('still answers the chip with the panel toggle', () => {
    const view = partyView([member('a')]);
    const send = vi.fn<(command: HudCommand) => void>();
    const card = paint({ view, drag: dragCell(), onCommand: send });
    const chip = nodes(card.props.children).find((node) => node.props['data-hud-party'] === 'chip');
    expect(chip).toBeDefined();
    handler(chip!, 'onClick')();
    expect(send).toHaveBeenCalledWith({ type: 'panel', panel: 'party' });
  });

  it('keeps the row’s accessible label', () => {
    const view = partyView([member('a')]);
    const [row] = rowNodes(paint({ view, drag: dragCell() }));
    expect(row!.props['aria-label']).toBe(t('party.rowLabel', { name: 'A', level: 12, status: '' }));
    expect(row!.props.type).toBe('button');
  });
});
