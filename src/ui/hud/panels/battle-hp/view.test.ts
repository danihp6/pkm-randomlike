import { describe, expect, it } from 'vitest';
import { createFighter, type BattleFighter } from '../../../../engine/battle/fighter';
import { createBattle } from '../../../../engine/battle/state';
import { Rng } from '../../../../engine/rng';
import type { HudState } from '../../state';
import { projectHud } from '../../state';
import {
  BATTLE_HP_BREAKPOINT,
  HP_FILL_MS,
  battleHpBox,
  battleHpLayout,
  battleHpView,
  type BattleHpView,
  type Viewport,
} from './view';

const DESKTOP: Viewport = { width: 1280, height: 800 };
const PHONE: Viewport = { width: 390, height: 844 };
const SINGLE = { enemy: false, player: false };
const DOUBLE = { enemy: true, player: true };
const NO_BATTLE: HudState = { party: [], bag: [], money: null, route: null, battle: null, notice: null };

function fighter(id: string, speciesId: string, moves: readonly string[]): BattleFighter {
  return createFighter({ id, speciesId, level: 5, moves });
}

function battleState(doubles: boolean): HudState {
  const battle = createBattle({
    player: doubles
      ? [fighter('player-1', 'charmander', ['ember']), fighter('player-2', 'squirtle', ['tackle'])]
      : [fighter('player-1', 'charmander', ['ember'])],
    enemy: doubles
      ? [fighter('enemy-1', 'bulbasaur', ['tackle']), fighter('enemy-2', 'geodude', ['tackle'])]
      : [fighter('enemy-1', 'bulbasaur', ['tackle'])],
    rng: new Rng(140),
    isWild: true,
    ...(doubles ? { double: true } : {}),
  });
  return projectHud({ screen: 'battle', battle, canCapture: true });
}

function layoutOf(viewport: Viewport, doubles: Readonly<{ enemy: boolean; player: boolean }>) {
  return battleHpLayout(viewport, doubles).map((entry) => ({
    side: entry.side,
    slot: entry.slot,
    box: entry.box,
  }));
}

describe('battleHpBox', () => {
  it('draws the desktop column the board measures at 1280×800', () => {
    expect(battleHpBox(DESKTOP, 'enemy', 0)).toStrictEqual({ x: 64, y: 48, w: 368, h: 100 });
    expect(battleHpBox(DESKTOP, 'player', 0)).toStrictEqual({ x: 64, y: 660, w: 368, h: 100 });
  });

  it('draws the phone column the board measures at 390×844', () => {
    expect(battleHpBox(PHONE, 'enemy', 0)).toStrictEqual({ x: 16, y: 16, w: 358, h: 80 });
    expect(battleHpBox(PHONE, 'player', 0)).toStrictEqual({ x: 16, y: 504, w: 358, h: 80 });
  });

  it('keeps the player card above the bottom edge as the viewport shrinks', () => {
    const short = battleHpBox({ width: 1280, height: 320 }, 'player', 0);
    expect(short.y).toBeGreaterThanOrEqual(battleHpBox({ width: 1280, height: 320 }, 'enemy', 0).y);
    expect(short.y + short.h).toBeLessThanOrEqual(320);
  });

  it('switches column at the breakpoint', () => {
    expect(BATTLE_HP_BREAKPOINT).toBe(600);
    expect(battleHpBox({ width: 599, height: 844 }, 'enemy', 0)).toStrictEqual({
      x: 16,
      y: 16,
      w: 567,
      h: 80,
    });
    expect(battleHpBox({ width: 600, height: 800 }, 'enemy', 0)).toStrictEqual({
      x: 64,
      y: 48,
      w: 368,
      h: 100,
    });
  });

  it('stacks the player partner above its lead and keeps the gutter', () => {
    expect(battleHpBox(DESKTOP, 'player', 1)).toStrictEqual({ x: 64, y: 552, w: 368, h: 100 });
    expect(battleHpBox(PHONE, 'player', 1)).toStrictEqual({ x: 16, y: 416, w: 358, h: 80 });
  });

  it('puts the foe partner beside the lead when the pair fits, below it otherwise', () => {
    expect(battleHpBox(DESKTOP, 'enemy', 1)).toStrictEqual({ x: 440, y: 48, w: 368, h: 100 });
    expect(battleHpBox(PHONE, 'enemy', 1)).toStrictEqual({ x: 16, y: 104, w: 358, h: 80 });
  });
});

describe('battleHpLayout', () => {
  it('draws the four boxes in draw order on the desktop', () => {
    expect(layoutOf(DESKTOP, DOUBLE)).toStrictEqual([
      { side: 'enemy', slot: 0, box: { x: 64, y: 48, w: 368, h: 100 } },
      { side: 'enemy', slot: 1, box: { x: 440, y: 48, w: 368, h: 100 } },
      { side: 'player', slot: 0, box: { x: 64, y: 660, w: 368, h: 100 } },
      { side: 'player', slot: 1, box: { x: 64, y: 552, w: 368, h: 100 } },
    ]);
  });

  it('draws the four boxes in the phone column', () => {
    expect(layoutOf(PHONE, DOUBLE)).toStrictEqual([
      { side: 'enemy', slot: 0, box: { x: 16, y: 16, w: 358, h: 80 } },
      { side: 'enemy', slot: 1, box: { x: 16, y: 104, w: 358, h: 80 } },
      { side: 'player', slot: 0, box: { x: 16, y: 504, w: 358, h: 80 } },
      { side: 'player', slot: 1, box: { x: 16, y: 416, w: 358, h: 80 } },
    ]);
  });

  it('gives a single battle exactly two boxes, the foe first', () => {
    expect(layoutOf(DESKTOP, SINGLE)).toStrictEqual([
      { side: 'enemy', slot: 0, box: { x: 64, y: 48, w: 368, h: 100 } },
      { side: 'player', slot: 0, box: { x: 64, y: 660, w: 368, h: 100 } },
    ]);
    expect(battleHpLayout(PHONE, SINGLE)).toHaveLength(2);
  });
});

describe('battleHpView', () => {
  it('paints no box without a battle', () => {
    expect(battleHpView(NO_BATTLE, DESKTOP, DOUBLE)).toStrictEqual({ boxes: [] });
  });

  it('paints one box per active, foe lead first and the player last', () => {
    const state = battleState(true);
    const view = battleHpView(state, DESKTOP, DOUBLE);
    expect(view.boxes.map((box) => box.id)).toStrictEqual([
      'enemy-0',
      'enemy-1',
      'player-0',
      'player-1',
    ]);
    expect(view.boxes.map((box) => box.slot)).toStrictEqual([0, 1, 0, 1]);
    expect(view.boxes[1]!.box).toStrictEqual({ x: 440, y: 48, w: 368, h: 100 });
    expect(view.boxes[3]!.box).toStrictEqual({ x: 64, y: 552, w: 368, h: 100 });
  });

  it('draws a single battle as two boxes, foe above player', () => {
    const view = battleHpView(battleState(false), PHONE, SINGLE);
    expect(view.boxes.map((box) => box.id)).toStrictEqual(['enemy-0', 'player-0']);
    expect(view.boxes[0]!.box).toStrictEqual({ x: 16, y: 16, w: 358, h: 80 });
    expect(view.boxes[1]!.box).toStrictEqual({ x: 16, y: 504, w: 358, h: 80 });
  });

  it('takes the name, the level, the HP line and the fraction from the snapshot', () => {
    const state = battleState(false);
    const foe = state.battle!.sides.enemy.actives[0]!;
    const box = battleHpView(state, DESKTOP, SINGLE).boxes[0]!;
    expect(box.side).toBe('enemy');
    expect(box.name).toBe(foe.name);
    expect(box.level).toBe(foe.level);
    expect(box.hpText).toBe(`${foe.hp}/${foe.maxHp}`);
    expect(box.fraction).toBe(foe.hpFraction);
    expect(box.statusLabel).toBe(foe.statusLabel);
  });

  it('draws the highlight 12 px inside the card and w - 24 wide', () => {
    const box = battleHpView(battleState(false), DESKTOP, SINGLE).boxes[0]!;
    expect(box.highlight).toStrictEqual({ x: 12, y: 12, w: 344, h: 1 });
    const phone = battleHpView(battleState(false), PHONE, SINGLE).boxes[0]!;
    expect(phone.highlight).toStrictEqual({ x: 12, y: 12, w: 334, h: 1 });
  });

  it('is pure: the same inputs deep-equal', () => {
    const state = battleState(true);
    const first: BattleHpView = battleHpView(state, DESKTOP, DOUBLE);
    const second = battleHpView(state, DESKTOP, DOUBLE);
    expect(second).toStrictEqual(first);
    expect(second).not.toBe(first);
  });

  it('animates a fill below the frame dwell', () => {
    expect(HP_FILL_MS).toBe(300);
  });
});
