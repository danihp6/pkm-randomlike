import { describe, expect, it, vi } from 'vitest';
import { createFighter, type BattleFighter, type BoostId } from '../../../../engine/battle/fighter';
import { createBattle } from '../../../../engine/battle/state';
import { Rng } from '../../../../engine/rng';
import type { HudState } from '../../state';
import { projectHud } from '../../state';
import { battleMovesBox, fitsInside } from '../battle-moves/view';
import { battleCommandBox } from '../battle-command/view';
import { BattleHp } from './battleHp';
import {
  BATTLE_BALL_GAP,
  BATTLE_BALL_ROW_GAP,
  BATTLE_BALL_SIZE,
  BATTLE_HP_BREAKPOINT,
  BATTLE_STAGE_MAX,
  DESKTOP_BOTTOM_MARGIN,
  HP_FILL_MS,
  STAGE_CHIP,
  STAGE_CLEARANCE,
  STAGE_COLS,
  STAGE_GAP,
  battleHpBox,
  battleHpLayout,
  battleHpStages,
  battleHpView,
  battleStage,
  foeBallRow,
  type BattleHpView,
  type Rect,
  type Viewport,
} from './view';

// The layer keeps one piece of state (its settled flag), so the panel is read as the
// vnode tree it builds: the hooks answer their initial value and never re-render.
vi.mock('preact/hooks', () => ({
  useState: <T>(initial: T): [T, (next: T) => void] => [initial, () => {}],
  useEffect: (): void => {},
}));

const DESKTOP: Viewport = { width: 1280, height: 800 };
const PHONE: Viewport = { width: 390, height: 844 };
const SINGLE = { enemy: false, player: false };
const DOUBLE = { enemy: true, player: true };
const NO_BATTLE: HudState = { party: [], bag: [], money: null, route: null, battle: null, notice: null };

/** The battle's command card, at each column (`docs/hud-fidelity.md` §5). */
const DESK_COMMAND: Rect = { x: 680, y: 582, w: 324, h: 192 };
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
    expect(battleHpBox(DESKTOP, 'enemy', 0)).toStrictEqual({ x: 304, y: 48, w: 368, h: 100 });
    expect(battleHpBox(DESKTOP, 'player', 0)).toStrictEqual({ x: 304, y: 674, w: 368, h: 100 });
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
    expect(battleHpBox(DESKTOP, 'player', 1)).toStrictEqual({ x: 304, y: 566, w: 368, h: 100 });
    expect(battleHpBox(PHONE, 'player', 1)).toStrictEqual({ x: 16, y: 416, w: 358, h: 80 });
  });

  it('stacks the foe partner under its lead and the player partner above its own', () => {
    expect(battleHpBox(DESKTOP, 'enemy', 1)).toStrictEqual({ x: 304, y: 156, w: 368, h: 100 });
    expect(battleHpBox(PHONE, 'enemy', 1)).toStrictEqual({ x: 16, y: 104, w: 358, h: 80 });
  });
});

const ONE_LINE: readonly Viewport[] = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 900, height: 900 },
];

describe('battleStage', () => {
  it('pins the centred square at five viewports', () => {
    expect(battleStage({ width: 1280, height: 800 })).toStrictEqual({
      x: 240,
      y: 0,
      w: 800,
      h: 800,
    });
    expect(battleStage({ width: 1440, height: 900 })).toStrictEqual({
      x: 270,
      y: 0,
      w: 900,
      h: 900,
    });
    expect(battleStage({ width: 900, height: 900 })).toStrictEqual({ x: 0, y: 0, w: 900, h: 900 });
    expect(battleStage({ width: 1024, height: 768 })).toStrictEqual({
      x: 128,
      y: 0,
      w: 768,
      h: 768,
    });
    expect(battleStage({ width: 390, height: 844 })).toStrictEqual({ x: 0, y: 0, w: 390, h: 844 });
  });

  it('caps a wide square at BATTLE_STAGE_MAX and centres it', () => {
    expect(BATTLE_STAGE_MAX).toBe(900);
    expect(battleStage({ width: 2560, height: 1440 })).toStrictEqual({
      x: 830,
      y: 270,
      w: 900,
      h: 900,
    });
  });

  it('is pure: the same viewport twice deep-equals and is a new object', () => {
    const first = battleStage(DESKTOP);
    const second = battleStage(DESKTOP);
    expect(second).toStrictEqual(first);
    expect(second).not.toBe(first);
  });
});

describe('the one bottom line', () => {
  it('ends the player card and the command card on the stage bottom minus 26', () => {
    expect(DESKTOP_BOTTOM_MARGIN).toBe(26);
    for (const viewport of ONE_LINE) {
      const player = battleHpBox(viewport, 'player', 0);
      const command = battleCommandBox(viewport);
      const stage = battleStage(viewport);
      expect(player.y + player.h).toBe(command.y + command.h);
      expect(command.y + command.h).toBe(stage.y + stage.h - DESKTOP_BOTTOM_MARGIN);
    }
    expect(
      ONE_LINE.map((viewport) => battleCommandBox(viewport).y + battleCommandBox(viewport).h),
    ).toStrictEqual([774, 874, 874]);
  });

  it('keeps both panels inside the stage, and every HP box of a double with them', () => {
    for (const viewport of ONE_LINE) {
      const stage = battleStage(viewport);
      expect(fitsInside(battleHpBox(viewport, 'player', 0), stage)).toBe(true);
      expect(fitsInside(battleCommandBox(viewport), stage)).toBe(true);
      for (const entry of battleHpLayout(viewport, DOUBLE)) {
        expect(fitsInside(entry.box, stage), `${viewport.width}x${viewport.height}`).toBe(true);
        expect(fitsInside(battleHpBox(viewport, entry.side, 1), stage)).toBe(true);
      }
    }
  });

  it('keeps the phone 8 px gutter and every box inside its stage', () => {
    const player = battleHpBox(PHONE, 'player', 0);
    const command = battleCommandBox(PHONE);
    const stage = battleStage(PHONE);
    expect(player).toStrictEqual({ x: 16, y: 504, w: 358, h: 80 });
    expect(command.y - (player.y + player.h)).toBe(8);
    expect(fitsInside(player, stage)).toBe(true);
    expect(fitsInside(command, stage)).toBe(true);
    for (const entry of battleHpLayout(PHONE, DOUBLE)) {
      expect(fitsInside(entry.box, stage)).toBe(true);
    }
  });

  it('keeps the partner clearance it always had', () => {
    expect(battleHpBox(DESKTOP, 'player', 1).y + 100).toBe(battleHpBox(DESKTOP, 'player', 0).y - 8);
    expect(battleHpBox(DESKTOP, 'enemy', 1).y).toBe(battleHpBox(DESKTOP, 'enemy', 0).y + 108);
  });

  it('clears the foe column by CARD_CLEARANCE and the stage edge by 36', () => {
    for (const viewport of ONE_LINE) {
      const card = battleMovesBox(viewport);
      const foe = battleHpBox(viewport, 'enemy', 0);
      const stage = battleStage(viewport);
      expect(card.x).toBe(foe.x + foe.w + 8);
      expect(card.x + card.w).toBe(stage.x + stage.w - 36);
      expect(card.w).toBeGreaterThanOrEqual(240);
    }
    expect(ONE_LINE.map((viewport) => battleMovesBox(viewport).x)).toStrictEqual([680, 710, 440]);
    expect(
      ONE_LINE.map((viewport) => battleMovesBox(viewport).x + battleMovesBox(viewport).w),
    ).toStrictEqual([1004, 1134, 864]);
  });
});

describe('battleHpLayout', () => {
  it('draws the four boxes in draw order on the desktop', () => {
    expect(layoutOf(DESKTOP, DOUBLE)).toStrictEqual([
      { side: 'enemy', slot: 0, box: { x: 304, y: 48, w: 368, h: 100 } },
      { side: 'enemy', slot: 1, box: { x: 304, y: 156, w: 368, h: 100 } },
      { side: 'player', slot: 0, box: { x: 304, y: 674, w: 368, h: 100 } },
      { side: 'player', slot: 1, box: { x: 304, y: 566, w: 368, h: 100 } },
    ]);
  });

  it('keeps one right edge per side, so the battle menu has one left edge to clear', () => {
    const layout = battleHpLayout(DESKTOP, DOUBLE);
    const enemy = layout.filter((entry) => entry.side === 'enemy');
    expect(enemy.map((entry) => entry.box.x)).toStrictEqual([304, 304]);
    expect(enemy[1]!.box.y).toBe(enemy[0]!.box.y + enemy[0]!.box.h + 8);
    expect(Math.max(...enemy.map((entry) => entry.box.x + entry.box.w))).toBe(672);

    const player = layout.filter((entry) => entry.side === 'player');
    expect(player.map((entry) => entry.box.x)).toStrictEqual([304, 304]);
    expect(player[1]!.box.y).toBe(player[0]!.box.y - player[0]!.box.h - 8);
    expect(Math.max(...player.map((entry) => entry.box.x + entry.box.w))).toBe(672);
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
      { side: 'enemy', slot: 0, box: { x: 304, y: 48, w: 368, h: 100 } },
      { side: 'player', slot: 0, box: { x: 304, y: 674, w: 368, h: 100 } },
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
      stageChips: [],
      stageBox: null,
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
    expect(view.boxes[1]!.box).toStrictEqual({ x: 304, y: 156, w: 368, h: 100 });
    expect(view.boxes[3]!.box).toStrictEqual({ x: 304, y: 566, w: 368, h: 100 });
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
      { x: 304, y: 156, w: 16, h: 16 },
      { x: 324, y: 156, w: 16, h: 16 },
      { x: 344, y: 156, w: 16, h: 16 },
    ]);
    expect(view.foeBallsBox).toStrictEqual({ x: 304, y: 156, w: 56, h: 16 });
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
      x: 304,
      y: 156,
      w: 76,
      h: 16,
    });
    expect(battleHpView(trainerState(1, null), DESKTOP, SINGLE).foeBallsBox).toStrictEqual({
      x: 304,
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

const STAGE_ORDER: readonly BoostId[] = ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion'];

/** The first `count` stats of the board's order, one stage each. */
function stagesOf(count: number, stage = 1): Partial<Record<BoostId, number>> {
  const boosts: Partial<Record<BoostId, number>> = {};
  for (const stat of STAGE_ORDER.slice(0, count)) boosts[stat] = stage;
  return boosts;
}

/** A battle whose stages are set on the fighters, the way a stat change leaves them. */
function stagedBattle(
  boosts: Readonly<Partial<Record<BoostId, number>>>,
  options: Readonly<{ foe?: Readonly<Partial<Record<BoostId, number>>>; doubles?: boolean }> = {},
): HudState {
  const doubles = options.doubles ?? false;
  const battle = createBattle({
    player: doubles
      ? [fighter('player-1', 'charmander', ['ember']), fighter('player-2', 'squirtle', ['tackle'])]
      : [fighter('player-1', 'charmander', ['ember'])],
    enemy: [fighter('enemy-1', 'bulbasaur', ['tackle'])],
    rng: new Rng(213),
    isWild: true,
    ...(doubles ? { double: true } : {}),
  });
  Object.assign(battle.sides.player.party[0].boosts, boosts);
  if (options.foe !== undefined) Object.assign(battle.sides.enemy.party[0].boosts, options.foe);
  return projectHud({ screen: 'battle', battle, canCapture: true });
}

/** Every node of a vnode tree whose props carry `attribute`, at any depth. A component
 * vnode is answered by calling it, so the layer's own spans are walked too. */
function nodesWith(
  value: unknown,
  attribute: string,
  found: Record<string, unknown>[] = [],
): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    for (const entry of value) nodesWith(entry, attribute, found);
    return found;
  }
  if (typeof value !== 'object' || value === null) return found;
  const node = value as Readonly<{ type?: unknown; props?: Record<string, unknown> }>;
  if (node.props === undefined) return found;
  if (attribute in node.props) found.push(node.props);
  if (typeof node.type === 'function') {
    nodesWith((node.type as (given: Record<string, unknown>) => unknown)(node.props), attribute, found);
    return found;
  }
  return nodesWith(node.props.children, attribute, found);
}

/** The props of every node carrying `className` in its `class` attribute. */
function classProps(tree: unknown, className: string): Record<string, unknown>[] {
  return nodesWith(tree, 'class').filter((props) => props.class === className);
}

describe('battleHpStages', () => {
  it('pins the board chip cell, its spacing and its clearance', () => {
    expect(STAGE_CHIP).toBe(34);
    expect(STAGE_GAP).toBe(6);
    expect(STAGE_COLS).toBe(3);
    expect(STAGE_CLEARANCE).toBe(8);
  });

  it('right-aligns the grid to the player column at 1280×800', () => {
    const boxOf = (count: number): Rect | null =>
      battleHpStages(stagedBattle(stagesOf(count)), DESKTOP, SINGLE).box;

    expect(boxOf(1)).toStrictEqual({ x: 638, y: 632, w: 34, h: 34 });
    expect(boxOf(2)).toStrictEqual({ x: 598, y: 632, w: 74, h: 34 });
    expect(boxOf(6)).toStrictEqual({ x: 558, y: 592, w: 114, h: 74 });
    expect(boxOf(7)).toStrictEqual({ x: 558, y: 552, w: 114, h: 114 });
    for (const count of [1, 2, 6, 7]) {
      const box = boxOf(count)!;
      expect(box.x + box.w).toBe(672);
      expect(box.y + box.h).toBe(674 - STAGE_CLEARANCE);
    }
  });

  it('right-aligns the same grid in the phone column', () => {
    const boxOf = (count: number): Rect | null =>
      battleHpStages(stagedBattle(stagesOf(count)), PHONE, SINGLE).box;

    expect(boxOf(1)).toStrictEqual({ x: 340, y: 462, w: 34, h: 34 });
    expect(boxOf(6)).toStrictEqual({ x: 260, y: 422, w: 114, h: 74 });
    expect(boxOf(6)!.x + boxOf(6)!.w).toBe(374);
  });

  it('lays the chips 40 px apart on both axes, three to a row', () => {
    const chips = battleHpStages(stagedBattle(stagesOf(7)), DESKTOP, SINGLE).chips;

    expect(chips.map((chip) => chip.stat)).toStrictEqual([...STAGE_ORDER]);
    expect(chips.map((chip) => chip.box)).toStrictEqual([
      { x: 558, y: 552, w: 34, h: 34 },
      { x: 598, y: 552, w: 34, h: 34 },
      { x: 638, y: 552, w: 34, h: 34 },
      { x: 558, y: 592, w: 34, h: 34 },
      { x: 598, y: 592, w: 34, h: 34 },
      { x: 638, y: 592, w: 34, h: 34 },
      { x: 558, y: 632, w: 34, h: 34 },
    ]);
    for (const [index, chip] of chips.entries()) {
      if (index > 0 && index % STAGE_COLS !== 0) {
        expect(chip.box.x - chips[index - 1]!.box.x).toBe(STAGE_CHIP + STAGE_GAP);
      }
      if (index >= STAGE_COLS) {
        expect(chip.box.y - chips[index - STAGE_COLS]!.box.y).toBe(STAGE_CHIP + STAGE_GAP);
      }
    }
  });

  it('takes the label, the sign and the tone from the snapshot stage', () => {
    const chips = battleHpStages(
      stagedBattle({ atk: 2, spa: 1, spe: -1, evasion: -3 }),
      DESKTOP,
      SINGLE,
    ).chips;

    expect(chips.map((chip) => chip.label)).toStrictEqual(['ATK', 'SPA', 'SPE', 'EVA']);
    expect(chips.map((chip) => chip.sign)).toStrictEqual(['+2', '+1', '-1', '-3']);
    expect(chips.map((chip) => chip.tone)).toStrictEqual(['up', 'up', 'down', 'down']);
    expect(chips.map((chip) => chip.stage)).toStrictEqual([2, 1, -1, -3]);
  });

  it('paints nothing without a battle, with an all-zero lead or with the foe is the only one raised', () => {
    expect(battleHpStages(NO_BATTLE, DESKTOP, SINGLE)).toStrictEqual({ chips: [], box: null });
    expect(battleHpStages(battleState(false), DESKTOP, SINGLE)).toStrictEqual({
      chips: [],
      box: null,
    });
    const foeOnly = stagedBattle({}, { foe: { atk: 2, spe: -1 } });
    expect(battleHpStages(foeOnly, DESKTOP, SINGLE)).toStrictEqual({ chips: [], box: null });
    expect(battleHpView(foeOnly, DESKTOP, SINGLE).stageBox).toBeNull();
    expect(battleHpView(foeOnly, DESKTOP, SINGLE).stageChips).toStrictEqual([]);
  });

  it('anchors above the player partner in a double, never over it', () => {
    const state = stagedBattle(stagesOf(6), { doubles: true });
    const grid = battleHpStages(state, DESKTOP, DOUBLE).box!;
    const partner = battleHpBox(DESKTOP, 'player', 1);

    expect(grid.y + grid.h).toBe(partner.y - STAGE_CLEARANCE);
    expect(overlaps(grid, partner)).toBe(false);
    expect(overlaps(grid, battleHpBox(DESKTOP, 'player', 0))).toBe(false);
    expect(battleHpStages(state, DESKTOP, DOUBLE).chips.map((chip) => chip.stat)).toStrictEqual([
      'atk',
      'def',
      'spa',
      'spd',
      'spe',
      'accuracy',
    ]);
  });

  it('keeps off both HP columns and the command card at both viewports', () => {
    for (const viewport of [DESKTOP, PHONE]) {
      for (const count of [6, 7]) {
        const state = stagedBattle(stagesOf(count), { doubles: true });
        const { box, chips } = battleHpStages(state, viewport, DOUBLE);
        expect(box).not.toBeNull();
        expect(chips).toHaveLength(count);
        expect(overlaps(box!, battleHpBox(viewport, 'player', 0))).toBe(false);
        expect(overlaps(box!, battleHpBox(viewport, 'player', 1))).toBe(false);
        expect(overlaps(box!, battleHpBox(viewport, 'enemy', 0))).toBe(false);
        expect(overlaps(box!, battleMovesBox(viewport))).toBe(false);

        const single = battleHpStages(stagedBattle(stagesOf(count)), viewport, SINGLE);
        expect(overlaps(single.box!, battleHpBox(viewport, 'player', 0))).toBe(false);
        expect(overlaps(single.box!, battleHpBox(viewport, 'enemy', 0))).toBe(false);
        expect(overlaps(single.box!, battleMovesBox(viewport))).toBe(false);
      }
    }
  });

  it('is pure: the same snapshot and viewport deep-equal', () => {
    const state = stagedBattle({ atk: 2, spe: -1 });
    const first = battleHpStages(state, DESKTOP, SINGLE);
    const second = battleHpStages(state, DESKTOP, SINGLE);

    expect(second).toStrictEqual(first);
    expect(second).not.toBe(first);
    expect(battleHpView(state, DESKTOP, SINGLE).stageBox).toStrictEqual(first.box);
    expect(battleHpView(state, DESKTOP, SINGLE).stageChips).toStrictEqual(first.chips);
  });
});

describe('the stage grid layer', () => {
  it('draws the grid box and one chip per stage', () => {
    const view = battleHpView(stagedBattle({ atk: 2, spe: -1 }), DESKTOP, SINGLE);
    const tree = BattleHp({ view }) as unknown;
    const layers = nodesWith(tree, 'data-hud-battle-stages');

    expect(layers).toHaveLength(1);
    expect(layers[0]!.style).toStrictEqual({
      left: '598px',
      top: '632px',
      width: '74px',
      height: '34px',
    });

    const chips = nodesWith(tree, 'data-hud-stage');
    expect(chips.map((chip) => chip['data-hud-stage'])).toStrictEqual(['atk', 'spe']);
    expect(chips.map((chip) => chip['data-stage'])).toStrictEqual(['2', '-1']);
    expect(chips.map((chip) => chip['data-tone'])).toStrictEqual(['up', 'down']);
    expect(chips.map((chip) => chip.role)).toStrictEqual(['img', 'img']);
    expect(chips.map((chip) => chip['aria-label'])).toStrictEqual(['ATK +2', 'SPE -1']);
    expect(chips.map((chip) => chip.class)).toStrictEqual(['battle-hp__stage', 'battle-hp__stage']);
    expect(chips[0]!.style).toStrictEqual({
      left: '598px',
      top: '632px',
      width: '34px',
      height: '34px',
    });
    expect(chips[1]!.style).toStrictEqual({
      left: '638px',
      top: '632px',
      width: '34px',
      height: '34px',
    });
  });

  it('paints the sign over the label, both hidden from the accessible name', () => {
    const tree = BattleHp({ view: battleHpView(stagedBattle({ spe: -1 }), DESKTOP, SINGLE) }) as unknown;
    const signs = classProps(tree, 'battle-hp__stage-sign');
    const labels = classProps(tree, 'battle-hp__stage-label');

    expect(signs.map((props) => props.children)).toStrictEqual(['-1']);
    expect(labels.map((props) => props.children)).toStrictEqual(['SPE']);
    expect(signs.every((props) => props['aria-hidden'] === 'true')).toBe(true);
    expect(labels.every((props) => props['aria-hidden'] === 'true')).toBe(true);
  });

  it('paints no layer at all when there is no chip', () => {
    const tree = BattleHp({ view: battleHpView(NO_BATTLE, DESKTOP, DOUBLE) }) as unknown;

    expect(nodesWith(tree, 'data-hud-battle-stages')).toStrictEqual([]);
    expect(nodesWith(tree, 'data-hud-stage')).toStrictEqual([]);
    expect(classProps(tree, 'battle-hp__stage')).toStrictEqual([]);
  });
});
