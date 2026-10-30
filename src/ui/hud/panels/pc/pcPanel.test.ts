import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../scenes/panels/detail', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../scenes/panels/detail')>();
  return { ...actual, openMemberDetail: vi.fn(actual.openMemberDetail) };
});

import { createRunPokemon } from '../../../../engine/run';
import { createRun, type RunState } from '../../../../engine/run/state';
import type { RunPokemon } from '../../../../engine/run/progression';
import { installMemberDrag } from '../../../../scenes/panels/detail';
import { pressDomCell, runPanelReorderPc } from '../../../../scenes/panels/pc';
import type { RoutePanelHost } from '../../../../scenes/panels/types';
import type { HudCommand } from '../../commands';
import type { PartyUiState } from '../../../partyScreen';
import { PcCard, type PcDrag } from './pcPanel';
import { pcPanelView, type PcPanelUi, type PcPanelView, type PcRow } from './view';

const DESKTOP = { width: 1280, height: 800 } as const;

type Node = Readonly<{ type: unknown; props: Record<string, unknown> }>;

const starter = createRunPokemon({
  id: 'starter',
  speciesId: 'charmander',
  level: 5,
  moves: ['scratch'],
});

function member(id: string, level = 3): RunPokemon {
  return createRunPokemon({ id, speciesId: 'sentret', level });
}

function runWith(partyIds: readonly string[], boxIds: readonly string[] = []): RunState {
  const base = createRun({ seed: 'run-a', starter });
  return {
    ...base,
    party: partyIds.map((id, index) =>
      index === 0 ? { ...starter, fighter: { ...starter.fighter, id } } : member(id),
    ),
    box: boxIds.map((id) => member(id)),
  };
}

function rowsOf(ids: readonly string[], locked = false): PcRow[] {
  return ids.map((memberId) => ({
    memberId,
    name: memberId.toUpperCase(),
    level: 12,
    hp: 20,
    maxHp: 40,
    statusLabel: null,
    locked,
  }));
}

function viewOf(ids: readonly string[], ui: PcPanelUi, locked = false): PcPanelView {
  return pcPanelView(rowsOf(ids, locked), ui, 1, DESKTOP);
}

const BOX_UI: PcPanelUi = { pane: 'box', page: 0, cursor: 0 };
const RIP_UI: PcPanelUi = { pane: 'rip', page: 0, cursor: 0 };

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

function paint(props: Parameters<typeof PcCard>[0]): Node {
  return PcCard(props) as unknown as Node;
}

function cellNodes(card: Node): readonly Node[] {
  return nodes(card.props.children).filter((node) => node.props['data-hud-pc-cell'] !== undefined);
}

function handlerOf(node: Node, name: string): (() => void) | undefined {
  const fn = node.props[name];
  return typeof fn === 'function' ? (fn as () => void) : undefined;
}

/** A click as the browser hands it over: the card's own handlers stop it bubbling. */
const CLICK = { stopPropagation: () => undefined } as unknown as MouseEvent;

function click(node: Node): void {
  const fn = node.props.onClick;
  if (typeof fn !== 'function') throw new Error('the node has no onClick');
  (fn as (event: MouseEvent) => void)(CLICK);
}

/** The card's drag cell, as the mount holds it: one object across paints. */
function dragCell(): PcDrag {
  const cell = {
    from: null as number | null,
    swallowed: { current: false },
    setFrom: (next: number | null): void => {
      cell.from = next;
    },
  };
  return cell;
}

type FakeHost = Readonly<{
  host: RoutePanelHost;
  commits: readonly RunState[];
  refreshes: () => number;
  opened: () => number;
}>;

/** The scene surface a card's receiver reads, with the writes counted. */
function fakeHost(run: RunState, pane: 'box' | 'rip' = 'box'): FakeHost {
  let current = run;
  const commits: RunState[] = [];
  let refreshed = 0;
  let opened = 0;
  let detailOpen = false;
  const ui: PartyUiState = { pane, index: 0, grabbed: null };
  const host = {
    run: () => current,
    ui: () => ui,
    setUi: () => undefined,
    commitRun: (next: RunState) => {
      current = next;
      commits.push(next);
    },
    refreshHud: () => {
      refreshed += 1;
    },
    hudCardOpen: (id: string) => id !== 'detail' || detailOpen,
    setHudCardOpen: (id: string, open: boolean) => {
      if (id !== 'detail') return;
      detailOpen = open;
      opened += 1;
    },
    scene: { scale: DESKTOP, events: { on: () => undefined, off: () => undefined } },
  } as unknown as RoutePanelHost;
  return { host, commits, refreshes: () => refreshed, opened: () => opened };
}

describe('the card’s pointer drag', () => {
  it('reorders the box once for a drop on another cell and eats the click that follows', () => {
    const view = viewOf(['a', 'b', 'c'], BOX_UI);
    const drag = dragCell();
    const send = vi.fn<(command: HudCommand) => void>();
    const reorder = vi.fn<(from: number, to: number) => void>();

    const picked = cellNodes(paint({ view, drag, onCommand: send, onReorder: reorder }));
    expect(picked).toHaveLength(16);
    handlerOf(picked[2]!, 'onPointerDown')!();
    expect(drag.from).toBe(2);
    expect(reorder).not.toHaveBeenCalled();

    const dropped = cellNodes(paint({ view, drag, onCommand: send, onReorder: reorder }));
    handlerOf(dropped[0]!, 'onPointerUp')!();
    expect(reorder).toHaveBeenCalledTimes(1);
    expect(reorder).toHaveBeenCalledWith(2, 0);
    expect(drag.from).toBeNull();
    expect(drag.swallowed.current).toBe(true);

    click(dropped[0]!);
    expect(send).not.toHaveBeenCalled();
    expect(drag.swallowed.current).toBe(false);

    const after = cellNodes(paint({ view, drag, onCommand: send, onReorder: reorder }));
    click(after[0]!);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ type: 'member', memberId: 'a' });
  });

  it('sends the member and no reorder for a press on one cell', () => {
    const view = viewOf(['a', 'b'], BOX_UI);
    const drag = dragCell();
    const send = vi.fn<(command: HudCommand) => void>();
    const reorder = vi.fn<(from: number, to: number) => void>();

    const cells = cellNodes(paint({ view, drag, onCommand: send, onReorder: reorder }));
    handlerOf(cells[1]!, 'onPointerDown')!();
    handlerOf(cells[1]!, 'onPointerUp')!();
    expect(reorder).not.toHaveBeenCalled();
    expect(drag.from).toBeNull();

    click(cells[1]!);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ type: 'member', memberId: 'b' });
  });

  it('marks the carried cell and no other one', () => {
    const view = viewOf(['a', 'b'], BOX_UI);
    const drag = dragCell();
    handlerOf(cellNodes(paint({ view, drag }))[1]!, 'onPointerDown')!();
    const repainted = cellNodes(paint({ view, drag }));
    expect(repainted[1]!.props['data-dragging']).toBe('true');
    expect(repainted[0]!.props['data-dragging']).toBeUndefined();
  });

  it('clears the carried cell on a pointer-up outside every cell and on a cancel', () => {
    const view = viewOf(['a', 'b'], BOX_UI);
    const drag = dragCell();
    const reorder = vi.fn<(from: number, to: number) => void>();
    const card = paint({ view, drag, onReorder: reorder });

    handlerOf(cellNodes(card)[1]!, 'onPointerDown')!();
    handlerOf(card, 'onPointerUp')!();
    expect(drag.from).toBeNull();

    handlerOf(cellNodes(card)[0]!, 'onPointerDown')!();
    handlerOf(card, 'onPointerCancel')!();
    expect(drag.from).toBeNull();
    expect(reorder).not.toHaveBeenCalled();
  });

  it('starts no drag on a locked cell, which still opens its detail', () => {
    const view = viewOf(['a', 'b'], BOX_UI, true);
    const drag = dragCell();
    const send = vi.fn<(command: HudCommand) => void>();
    const reorder = vi.fn<(from: number, to: number) => void>();
    const cells = cellNodes(paint({ view, drag, onCommand: send, onReorder: reorder }));

    expect(cells[0]!.props['data-locked']).toBe('true');
    expect(handlerOf(cells[0]!, 'onPointerDown')).toBeUndefined();
    expect(handlerOf(cells[0]!, 'onPointerUp')).toBeUndefined();
    click(cells[0]!);
    expect(send).toHaveBeenCalledWith({ type: 'member', memberId: 'a' });
    expect(reorder).not.toHaveBeenCalled();
  });

  it('starts no drag in the RIP pane, whose cells still open their detail', () => {
    const view = viewOf(['a', 'b'], RIP_UI);
    const drag = dragCell();
    const send = vi.fn<(command: HudCommand) => void>();
    const reorder = vi.fn<(from: number, to: number) => void>();
    const cells = cellNodes(paint({ view, drag, onCommand: send, onReorder: reorder }));

    expect(cells[0]!.props['data-locked']).toBeUndefined();
    expect(handlerOf(cells[0]!, 'onPointerDown')).toBeUndefined();
    click(cells[0]!);
    expect(send).toHaveBeenCalledWith({ type: 'member', memberId: 'a' });
    expect(reorder).not.toHaveBeenCalled();
  });
});

describe('the scene’s press receiver (the command path)', () => {
  it('opens the detail once and withdraws nothing', async () => {
    const detail = await import('../../../../scenes/panels/detail');
    const open = vi.mocked(detail.openMemberDetail);
    open.mockClear();

    const run = runWith(['a'], ['b']);
    const { host, commits, refreshes, opened } = fakeHost(run);
    pressDomCell(host, 'b');

    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(host, 'b');
    expect(commits).toHaveLength(0);
    expect(host.run().party.map((entry) => entry.fighter.id)).toEqual(['a']);
    expect(host.run().box.map((entry) => entry.fighter.id)).toEqual(['b']);
    expect(refreshes()).toBe(1);
    expect(opened()).toBe(1);
  });

  it('opens a fallen member’s detail from the RIP list without moving anyone', async () => {
    const detail = await import('../../../../scenes/panels/detail');
    const open = vi.mocked(detail.openMemberDetail);
    open.mockClear();

    const fallen = member('gone');
    const run: RunState = { ...runWith(['a'], ['b']), rip: [fallen] };
    const { host, commits } = fakeHost(run, 'rip');
    pressDomCell(host, 'gone');

    expect(open).toHaveBeenCalledTimes(1);
    expect(commits).toHaveLength(0);
    expect(host.run().party.map((entry) => entry.fighter.id)).toEqual(['a']);
    expect(host.run().rip.map((entry) => entry.fighter.id)).toEqual(['gone']);
  });
});

describe('the scene’s reorder receiver', () => {
  it('reorders the box once through moveInBox', () => {
    const { host, commits } = fakeHost(runWith(['a'], ['b', 'c']));
    runPanelReorderPc(host, 0, 1);
    expect(commits).toHaveLength(1);
    expect(host.run().box.map((entry) => entry.fighter.id)).toEqual(['c', 'b']);
    expect(host.run().party.map((entry) => entry.fighter.id)).toEqual(['a']);
  });

  it('commits nothing for a drop on the cell the member already sits in', () => {
    const { host, commits } = fakeHost(runWith(['a'], ['b', 'c']));
    runPanelReorderPc(host, 1, 1);
    expect(commits).toHaveLength(0);
  });
});

type Listener = (event: unknown) => void;

/** The slice of a DOM node the HUD gesture reads: its attributes and its parents. */
class FakeNode {
  readonly attrs: Record<string, string>;
  readonly parent: FakeNode | null;
  readonly listeners = new Map<string, Listener[]>();

  constructor(attrs: Record<string, string> = {}, parent: FakeNode | null = null) {
    this.attrs = attrs;
    this.parent = parent;
  }

  closest(selector: string): FakeNode | null {
    const attr = selector.replace(/^\[|\]$/g, '');
    let node: FakeNode | null = this;
    while (node !== null) {
      if (node.attrs[attr] !== undefined) return node;
      node = node.parent;
    }
    return null;
  }

  getAttribute(name: string): string | null {
    return this.attrs[name] ?? null;
  }

  addEventListener(type: string, fn: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }

  removeEventListener(type: string, fn: Listener): void {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((entry) => entry !== fn),
    );
  }

  get count(): number {
    let total = 0;
    for (const entries of this.listeners.values()) total += entries.length;
    return total;
  }

  fire(type: string, target: FakeNode): void {
    for (const fn of this.listeners.get(type) ?? []) fn({ target });
  }
}

afterEach(() => vi.unstubAllGlobals());

const partyCard = (): FakeNode => new FakeNode({ 'data-hud-panel': 'party' });
const boxCard = (pane: 'box' | 'rip' = 'box'): FakeNode =>
  new FakeNode({ 'data-hud-panel': 'box', 'data-pane': pane });

describe('the HUD member drag (the two cards’ one gesture)', () => {
  function mount(run: RunState): Readonly<{
    host: RoutePanelHost;
    commits: readonly RunState[];
    layer: FakeNode;
    doc: FakeNode;
    dispose: () => void;
  }> {
    const layer = new FakeNode();
    const doc = new FakeNode();
    vi.stubGlobal('Element', FakeNode);
    vi.stubGlobal('document', doc);
    const { host, commits } = fakeHost(run);
    const dispose = installMemberDrag(host, layer as unknown as Element);
    return { host, commits, layer, doc, dispose };
  }

  it('withdraws a box cell let go on the party card, once', () => {
    const { host, commits, layer, doc, dispose } = mount(runWith(['a'], ['b', 'c']));
    const card = boxCard();
    const cell = new FakeNode({ 'data-hud-pc-cell': '1' }, card);
    const target = partyCard();

    layer.fire('pointerdown', cell);
    doc.fire('pointerup', target);

    expect(commits).toHaveLength(1);
    expect(host.run().party.map((entry) => entry.fighter.id)).toEqual(['a', 'c']);
    expect(host.run().box.map((entry) => entry.fighter.id)).toEqual(['b']);
    dispose();
    expect(layer.count).toBe(0);
    expect(doc.count).toBe(0);
  });

  it('deposits a party row let go on the PC card, once', () => {
    const { host, commits, layer, doc } = mount(runWith(['a', 'b']));
    const row = new FakeNode({ 'data-hud-party-member': 'b' }, partyCard());
    const card = boxCard();

    layer.fire('pointerdown', row);
    doc.fire('pointerup', card);

    expect(commits).toHaveLength(1);
    expect(host.run().party.map((entry) => entry.fighter.id)).toEqual(['a']);
    expect(host.run().box.map((entry) => entry.fighter.id)).toEqual(['b']);
  });

  it('moves nobody for a release on nothing, and forgets the drag', () => {
    const { host, commits, layer, doc } = mount(runWith(['a', 'b'], ['c']));
    const row = new FakeNode({ 'data-hud-party-member': 'b' }, partyCard());
    const wall = new FakeNode();

    layer.fire('pointerdown', row);
    doc.fire('pointerup', wall);
    expect(commits).toHaveLength(0);

    doc.fire('pointerup', partyCard());
    expect(commits).toHaveLength(0);
    expect(host.run().party.map((entry) => entry.fighter.id)).toEqual(['a', 'b']);
  });

  it('leaves the member’s own card to the card’s own gesture', () => {
    const { host, commits, layer, doc } = mount(runWith(['a'], ['b', 'c']));
    const card = boxCard();
    const from = new FakeNode({ 'data-hud-pc-cell': '0' }, card);
    const to = new FakeNode({ 'data-hud-pc-cell': '1' }, card);

    layer.fire('pointerdown', from);
    doc.fire('pointerup', to);

    expect(commits).toHaveLength(0);
    expect(host.run().box.map((entry) => entry.fighter.id)).toEqual(['b', 'c']);
  });

  it('starts no drag on a locked cell, outside the floor’s entry room', () => {
    const away = { ...runWith(['a'], ['b']), routeInMap: 2 };
    const { host, commits, layer, doc } = mount(away);
    const cell = new FakeNode({ 'data-hud-pc-cell': '0' }, boxCard());

    layer.fire('pointerdown', cell);
    doc.fire('pointerup', partyCard());

    expect(commits).toHaveLength(0);
    expect(host.run().party.map((entry) => entry.fighter.id)).toEqual(['a']);
    expect(host.run().box.map((entry) => entry.fighter.id)).toEqual(['b']);
  });

  it('starts no drag in the RIP pane', () => {
    const fallen = member('gone');
    const { host, commits, layer, doc } = mount({ ...runWith(['a'], ['b']), rip: [fallen] });
    const cell = new FakeNode({ 'data-hud-pc-cell': '0' }, boxCard('rip'));

    layer.fire('pointerdown', cell);
    doc.fire('pointerup', partyCard());

    expect(commits).toHaveLength(0);
    expect(host.run().rip.map((entry) => entry.fighter.id)).toEqual(['gone']);
  });

  it('drops the drag on a cancel', () => {
    const { host, commits, layer, doc } = mount(runWith(['a'], ['b']));
    const cell = new FakeNode({ 'data-hud-pc-cell': '0' }, boxCard());

    layer.fire('pointerdown', cell);
    doc.fire('pointercancel', cell);
    doc.fire('pointerup', partyCard());

    expect(commits).toHaveLength(0);
    expect(host.run().box.map((entry) => entry.fighter.id)).toEqual(['b']);
  });
});
