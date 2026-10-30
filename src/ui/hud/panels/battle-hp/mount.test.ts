import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFighter, type BattleFighter } from '../../../../engine/battle/fighter';
import { createBattle } from '../../../../engine/battle/state';
import { Rng } from '../../../../engine/rng';
import { hudMetrics } from '../../../../scenes/panels/hud';
import type { HudState } from '../../state';
import { projectHud } from '../../state';
import { mountBattleHp, type BattleHpController } from './mount';
import { battleHpBox, type BattleHpView, type Viewport } from './view';

const EMPTY_VIEW: BattleHpView = {
  boxes: [],
  foeBalls: [],
  foeBallsBox: null,
  stageChips: [],
  stageBox: null,
};

/** Every paint the mount asked for, in order: the vnode and the node it went into. */
const painted = vi.hoisted(() => ({
  vnodes: [] as unknown[],
  containers: [] as unknown[],
}));

vi.mock('preact', async (importOriginal) => {
  const actual = await importOriginal<typeof import('preact')>();
  return {
    ...actual,
    h: (type: unknown, props: unknown): unknown => ({ type, props }),
    render: (vnode: unknown, container: unknown): void => {
      painted.vnodes.push(vnode);
      painted.containers.push(container);
    },
  };
});

const DESKTOP: Viewport = { width: 1280, height: 800 };
const PHONE: Viewport = { width: 390, height: 844 };
const BOTH: Readonly<{ enemy: boolean; player: boolean }> = { enemy: true, player: true };
const FOE_ONLY: Readonly<{ enemy: boolean; player: boolean }> = { enemy: true, player: false };
const NEITHER: Readonly<{ enemy: boolean; player: boolean }> = { enemy: false, player: false };

/** The minimal element the mount touches: a class, children and a way out of the tree. */
class FakeElement {
  className = '';
  readonly children: FakeElement[] = [];
  parent: FakeElement | null = null;

  appendChild(child: FakeElement): FakeElement {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  remove(): void {
    if (this.parent === null) return;
    const at = this.parent.children.indexOf(this);
    if (at >= 0) this.parent.children.splice(at, 1);
    this.parent = null;
  }
}

function stubDocument(): { host: FakeElement; created: FakeElement[] } {
  const host = new FakeElement();
  const created: FakeElement[] = [];
  vi.stubGlobal('document', {
    createElement: (): FakeElement => {
      const element = new FakeElement();
      created.push(element);
      return element;
    },
  });
  return { host, created };
}

/** The mount only needs the part of `Element` a fake host honours. */
function mountInto(host: FakeElement): BattleHpController {
  return mountBattleHp(host as unknown as Element);
}

function fighter(id: string, speciesId: string, moves: readonly string[]): BattleFighter {
  return createFighter({ id, speciesId, level: 5, moves });
}

/** A projected battle: `player` and `enemy` members a side fields, at `double` or not. */
function battleState(players: number, enemies: number, double: boolean): HudState {
  const party = (count: number, prefix: string, species: readonly string[]) =>
    species
      .slice(0, count)
      .map((speciesId, index) => fighter(`${prefix}-${index + 1}`, speciesId, ['tackle']));
  const battle = createBattle({
    player: party(players, 'player', ['charmander', 'squirtle']),
    enemy: party(enemies, 'enemy', ['bulbasaur', 'geodude']),
    rng: new Rng(235),
    isWild: false,
    ...(double ? { double: true } : {}),
  });
  return projectHud({ screen: 'battle', battle, canCapture: false });
}

/** The view the last paint was handed, read off the props `h(BattleHp, …)` received. */
function lastView(): BattleHpView {
  const vnode = painted.vnodes[painted.vnodes.length - 1] as Readonly<{
    props?: Readonly<{ view?: BattleHpView }>;
  }> | null;
  const view = vnode?.props?.view;
  if (view === undefined) throw new Error('the last paint carried no view');
  return view;
}

function boxOf(view: BattleHpView, id: BattleHpView['boxes'][number]['id']) {
  const box = view.boxes.find((entry) => entry.id === id);
  if (box === undefined) throw new Error(`no box ${id}`);
  return box.box;
}

describe('mountBattleHp', () => {
  afterEach(() => {
    painted.vnodes = [];
    painted.containers = [];
    vi.unstubAllGlobals();
  });

  it('paints the empty layer once at the mount, in one container', () => {
    const { host, created } = stubDocument();

    mountInto(host);

    expect(created).toHaveLength(1);
    expect(host.children).toHaveLength(1);
    expect(painted.vnodes).toHaveLength(1);
    expect(lastView()).toStrictEqual(EMPTY_VIEW);
    expect(painted.containers).toStrictEqual([host.children[0]]);
  });

  it('takes the rects from the push, not from the mount', () => {
    const { host } = stubDocument();
    const state = battleState(1, 1, false);
    const controller = mountInto(host);

    controller.update(state, DESKTOP, NEITHER);
    expect(boxOf(lastView(), 'player-0')).toStrictEqual(battleHpBox(DESKTOP, 'player', 0));

    controller.update(state, PHONE, NEITHER);
    expect(boxOf(lastView(), 'player-0')).toStrictEqual(battleHpBox(PHONE, 'player', 0));
    expect(boxOf(lastView(), 'player-0')).toStrictEqual({ x: 16, y: 504, w: 358, h: 80 });

    expect(painted.vnodes).toHaveLength(3);
    expect(host.children).toHaveLength(1);
    expect(painted.containers.every((container) => container === host.children[0])).toBe(true);
  });

  it('takes the sides count from the push, not from the mount', () => {
    const { host } = stubDocument();
    const controller = mountInto(host);

    controller.update(battleState(2, 2, true), DESKTOP, BOTH);
    expect(lastView().boxes.map((box) => box.id)).toStrictEqual([
      'enemy-0',
      'enemy-1',
      'player-0',
      'player-1',
    ]);

    controller.update(battleState(1, 2, true), DESKTOP, FOE_ONLY);
    expect(lastView().boxes.map((box) => box.id)).toStrictEqual(['enemy-0', 'enemy-1', 'player-0']);
  });

  it('never stacks cards under a resize storm', () => {
    const { host } = stubDocument();
    const state = battleState(2, 2, true);
    const controller = mountInto(host);

    controller.update(state, PHONE, BOTH);
    const first = lastView();
    controller.update(state, PHONE, BOTH);
    const second = lastView();

    expect(second.boxes.map((box) => box.id)).toStrictEqual(first.boxes.map((box) => box.id));
    expect(second.boxes.map((box) => box.box)).toStrictEqual(first.boxes.map((box) => box.box));
    expect(second.foeBallsBox).toStrictEqual(first.foeBallsBox);
    expect(second.stageBox).toStrictEqual(first.stageBox);
    expect(host.children).toHaveLength(1);
  });

  it('drops the whole layer on dispose', () => {
    const { host } = stubDocument();
    const controller = mountInto(host);

    controller.dispose();

    expect(painted.vnodes).toStrictEqual([expect.anything(), null]);
    expect(host.children).toHaveLength(0);
  });
});

describe('the route HUD metrics a resize recompute reads', () => {
  it('keeps the clamp to width − 16 for the panels', () => {
    expect(hudMetrics(320).panelW).toBe(304);
    expect(hudMetrics(1280).panelW).toBe(344);
    expect(hudMetrics(390).panelW).toBe(344);
  });
});
