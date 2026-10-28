import { describe, expect, it } from 'vitest';
import { createFighter, type BattleFighter } from '../../../../engine/battle/fighter';
import { createBattle } from '../../../../engine/battle/state';
import { Rng } from '../../../../engine/rng';
import type { HudState } from '../../state';
import { projectHud } from '../../state';
import {
  BATTLE_BALL_GAP,
  BATTLE_BALL_ROW_GAP,
  BATTLE_BALL_SIZE,
  BATTLE_HP_BREAKPOINT,
  HP_FILL_MS,
  battleHpBox,
  battleHpLayout,
  battleHpView,
  foeBallRow,
  type BattleHpView,
  type Rect,
  type Viewport,
} from './view';

const DESKTOP: Viewport = { width: 1280, height: 800 };
const PHONE: Viewport = { width: 390, height: 844 };
const SINGLE = { enemy: false, player: false };
const DOUBLE = { enemy: true, player: true };
const NO_BATTLE: HudState = { party: [], bag: [], money: null, route: null, battle: null, notice: null };

/** The battle's command card, at each column (`docs/hud-fidelity.md` §5). */
const DESK_COMMAND: Rect = { x: 440, y: 582, w: 564, h: 192 };
const PHONE_COMMAND: Rect = { x: 16, y: 592, w: 358, h: 236 };

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

const FOE_SPECIES = ['bulbasaur', 'geodude', 'machop', 'pidgey', 'rattata', 'ekans'] as const;

/** A trainer battle whose foe fields `size` members, with `fainted` left at 0 HP. */
function trainerState(size: number, fainted: number | null, isWild = false): HudState {
  const enemy = FOE_SPECIES.slice(0, size).map((speciesId, index) =>
    fighter(`enemy-${index + 1}`, speciesId, ['tackle']),
  );
  const battle = createBattle({
    player: [fighter('player-1', 'charmander', ['ember'])],
    enemy,
    rng: new Rng(212),
    isWild,
  });
  if (fainted !== null) battle.sides.enemy.party[fainted]!.hp = 0;
  return projectHud({ screen: 'battle', battle, canCapture: false });
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
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

  it('stacks the foe partner under its lead and the player partner above its own', () => {
    expect(battleHpBox(DESKTOP, 'enemy', 1)).toStrictEqual({ x: 64, y: 156, w: 368, h: 100 });
    expect(battleHpBox(PHONE, 'enemy', 1)).toStrictEqual({ x: 16, y: 104, w: 358, h: 80 });
  });
});

describe('battleHpLayout', () => {
  it('draws the four boxes in draw order on the desktop', () => {
    expect(layoutOf(DESKTOP, DOUBLE)).toStrictEqual([
      { side: 'enemy', slot: 0, box: { x: 64, y: 48, w: 368, h: 100 } },
      { side: 'enemy', slot: 1, box: { x: 64, y: 156, w: 368, h: 100 } },
      { side: 'player', slot: 0, box: { x: 64, y: 660, w: 368, h: 100 } },
      { side: 'player', slot: 1, box: { x: 64, y: 552, w: 368, h: 100 } },
    ]);
  });

  it('keeps one right edge per side, so the battle menu has one left edge to clear', () => {
    const layout = battleHpLayout(DESKTOP, DOUBLE);
    const enemy = layout.filter((entry) => entry.side === 'enemy');
    expect(enemy.map((entry) => entry.box.x)).toStrictEqual([64, 64]);
    expect(enemy[1]!.box.y).toBe(enemy[0]!.box.y + enemy[0]!.box.h + 8);
    expect(Math.max(...enemy.map((entry) => entry.box.x + entry.box.w))).toBe(432);

    const player = layout.filter((entry) => entry.side === 'player');
    expect(player.map((entry) => entry.box.x)).toStrictEqual([64, 64]);
    expect(player[1]!.box.y).toBe(player[0]!.box.y - player[0]!.box.h - 8);
    expect(Math.max(...player.map((entry) => entry.box.x + entry.box.w))).toBe(432);
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
    expect(battleHpView(NO_BATTLE, DESKTOP, DOUBLE)).toStrictEqual({
      boxes: [],
      foeBalls: [],
      foeBallsBox: null,
    });
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
    expect(view.boxes[1]!.box).toStrictEqual({ x: 64, y: 156, w: 368, h: 100 });
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

describe('foeBallRow', () => {
  it('draws one ball per fielded member, in party order, spent once it faints', () => {
    const view = battleHpView(trainerState(3, 2), DESKTOP, SINGLE);
    expect(BATTLE_BALL_SIZE).toBe(16);
    expect(BATTLE_BALL_GAP).toBe(4);
    expect(BATTLE_BALL_ROW_GAP).toBe(8);
    expect(view.foeBalls).toHaveLength(3);
    expect(view.foeBalls.map((ball) => ball.index)).toStrictEqual([0, 1, 2]);
    expect(view.foeBalls.map((ball) => ball.state)).toStrictEqual(['filled', 'filled', 'spent']);
    expect(view.foeBalls.map((ball) => ball.box)).toStrictEqual([
      { x: 64, y: 156, w: 16, h: 16 },
      { x: 84, y: 156, w: 16, h: 16 },
      { x: 104, y: 156, w: 16, h: 16 },
    ]);
    expect(view.foeBallsBox).toStrictEqual({ x: 64, y: 156, w: 56, h: 16 });
  });

  it('draws no row in a wild battle and none without a battle', () => {
    const wild = battleHpView(trainerState(3, 0, true), DESKTOP, SINGLE);
    expect(wild.foeBalls).toStrictEqual([]);
    expect(wild.foeBallsBox).toBeNull();
    expect(foeBallRow(trainerState(3, 0, true), DESKTOP)).toStrictEqual({ balls: [], box: null });
    expect(foeBallRow(NO_BATTLE, PHONE)).toStrictEqual({ balls: [], box: null });
  });

  it('sits under the foe box and clears both HP columns and both command cards', () => {
    const state = trainerState(3, 2);
    expect(foeBallRow(state, PHONE).box).toStrictEqual({ x: 16, y: 104, w: 56, h: 16 });
    for (const viewport of [DESKTOP, PHONE]) {
      const row = foeBallRow(state, viewport).box!;
      expect(overlaps(row, battleHpBox(viewport, 'player', 0))).toBe(false);
      expect(overlaps(row, DESK_COMMAND)).toBe(false);
      expect(overlaps(row, PHONE_COMMAND)).toBe(false);
    }
  });

  it('spends one gap between neighbours and none past the last ball', () => {
    expect(battleHpView(trainerState(4, null), DESKTOP, SINGLE).foeBallsBox).toStrictEqual({
      x: 64,
      y: 156,
      w: 76,
      h: 16,
    });
    expect(battleHpView(trainerState(1, null), DESKTOP, SINGLE).foeBallsBox).toStrictEqual({
      x: 64,
      y: 156,
      w: 16,
      h: 16,
    });
  });

  it('is pure: the same snapshot and viewport deep-equal', () => {
    const state = trainerState(3, 2);
    const first = foeBallRow(state, DESKTOP);
    const second = foeBallRow(state, DESKTOP);
    expect(second).toStrictEqual(first);
    expect(second).not.toBe(first);
    expect(battleHpView(state, DESKTOP, SINGLE).foeBallsBox).toStrictEqual(first.box);
  });
});
