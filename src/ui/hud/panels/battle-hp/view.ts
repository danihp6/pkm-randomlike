import type { BoostId } from '../../../../engine/battle/fighter';
import type { HudState } from '../../state';

export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;
export type HpSide = 'enemy' | 'player';

/** One box: which side, which of the side's two actives, and what it paints. */
export type HpBoxView = Readonly<{
  id: 'enemy-0' | 'enemy-1' | 'player-0' | 'player-1';
  side: HpSide;
  slot: 0 | 1;
  /** Viewport coordinates, from `battleHpLayout`. */
  box: Rect;
  /** Panel-relative. */
  highlight: Rect;
  name: string;
  level: number;
  /** `hp + '/' + maxHp`, exactly as `HudBattleFighter.hp`/`maxHp` read. */
  hpText: string;
  /** 0…1, from `HudBattleFighter.hpFraction`. */
  fraction: number;
  statusLabel: string | null;
}>;

export type HpBallState = 'filled' | 'spent';

/** One ball of the foe's remaining team, under its box. */
export type HpBallView = Readonly<{
  /** 0-based index in the foe's fielded party, which is the row's left-to-right order. */
  index: number;
  /** `spent` once that member has fainted (`hpFraction <= 0`). */
  state: HpBallState;
  /** Viewport coordinates, the ball's own 16 × 16 cell. */
  box: Rect;
}>;

export type BattleHpView = Readonly<{
  /** Every box the battle fields right now, in draw order: foe lead, foe partner,
   * player lead, player partner. A side that fields one active has one box. */
  boxes: readonly HpBoxView[];
  /** One ball per member the foe fielded; `[]` in a wild battle or with no battle. */
  foeBalls: readonly HpBallView[];
  /** The row's box (the balls' union), or null when `foeBalls` is empty. */
  foeBallsBox: Rect | null;
  /** The player's lead's non-zero stages, board order; `[]` with no battle or all zero. */
  stageChips: readonly HpStageChipView[];
  /** The chips' union box (viewport coordinates), or null when there is no chip. */
  stageBox: Rect | null;
}>;

/** The board's chip: a 34 px square, 6 px apart, three to a row. */
export const STAGE_CHIP = 34;
export const STAGE_GAP = 6;
export const STAGE_COLS = 3;
/** The clearance the grid keeps above the player's box. */
export const STAGE_CLEARANCE = 8;

export type HpStageTone = 'up' | 'down';

/** One stat stage painted as a chip: the stat, its label, its sign and its cell. */
export type HpStageChipView = Readonly<{
  stat: BoostId;
  label: string;
  /** `+2` / `-1` — the digit string painted above the label. */
  sign: string;
  /** −6…+6, never 0. */
  stage: number;
  /** `'up'` for a positive stage, `'down'` for a negative one. */
  tone: HpStageTone;
  /** Viewport coordinates: the chip's own 34 × 34 cell. */
  box: Rect;
}>;

/** How long a fill takes to reach its new fraction, in ms. Below the 900 ms frame
 * dwell (`MESSAGE_HOLD_MS`), so a drop lands with its line. */
export const HP_FILL_MS = 300;
/** 600: below it the phone column's boxes are used (`m05`). */
export const BATTLE_HP_BREAKPOINT = 600;

/** The board's ball cell and the row's own spacing, in px. */
export const BATTLE_BALL_SIZE = 16;
export const BATTLE_BALL_GAP = 4;
/** The gap between the foe's box's bottom edge and the row's top edge. */
export const BATTLE_BALL_ROW_GAP = 8;

/** `--hud-gutter`: the gap a partner box keeps from its lead, beside, below or above. */
const GUTTER = 8;
/** The highlight's inset from the box's top-left, and its height. */
const HIGHLIGHT_INSET = 12;
const HIGHLIGHT_H = 1;

/**
 * The board's desktop column (`05`): a 368×100 card 64 px in, 48 from the top, and
 * 140 from the bottom edge to the player card's top (40 px of margin under it).
 */
const DESKTOP_X = 64;
const DESKTOP_W = 368;
const DESKTOP_H = 100;
const DESKTOP_FOE_Y = 48;
const DESKTOP_PLAYER_FROM_BOTTOM = 140;

/**
 * The board's phone column (`m05`): the same card 16 px in, 80 tall, the player's
 * 340 from the bottom edge — the 16 px margin, the 236 px menu panel and the 8 px
 * gutter that separates them on the frame.
 */
const PHONE_X = 16;
const PHONE_H = 80;
const PHONE_FOE_Y = 16;
const PHONE_PLAYER_FROM_BOTTOM = 340;

/** The draw order of the boxes the battle fields: both foes, then both party members. */
const HP_SIDES: readonly HpSide[] = ['enemy', 'player'];

function narrowColumn(viewport: Viewport): boolean {
  return viewport.width < BATTLE_HP_BREAKPOINT;
}

/** The lead box of one side: the card the board draws, at this viewport's column. */
function leadBox(viewport: Viewport, side: HpSide): Rect {
  if (narrowColumn(viewport)) {
    const w = Math.max(0, viewport.width - PHONE_X * 2);
    const y =
      side === 'enemy'
        ? PHONE_FOE_Y
        : Math.max(PHONE_FOE_Y + PHONE_H + GUTTER, viewport.height - PHONE_PLAYER_FROM_BOTTOM);
    return { x: PHONE_X, y, w, h: PHONE_H };
  }
  const y =
    side === 'enemy'
      ? DESKTOP_FOE_Y
      : Math.max(DESKTOP_FOE_Y + DESKTOP_H + GUTTER, viewport.height - DESKTOP_PLAYER_FROM_BOTTOM);
  return { x: DESKTOP_X, y, w: DESKTOP_W, h: DESKTOP_H };
}

/**
 * The partner box. A partner never sits to the right of its side's column: the foe's
 * partner stacks under its lead the way the player's stacks above its own, so the
 * battle menu has one left edge to clear in a double and in a single alike.
 */
function partnerBox(side: HpSide, lead: Rect): Rect {
  const above = side === 'player';
  return {
    x: lead.x,
    y: above ? lead.y - lead.h - GUTTER : lead.y + lead.h + GUTTER,
    w: lead.w,
    h: lead.h,
  };
}

/** The rect of one box at this viewport and side, for `slot` 0 or 1. */
export function battleHpBox(viewport: Viewport, side: HpSide, slot: 0 | 1): Rect {
  const lead = leadBox(viewport, side);
  return slot === 0 ? lead : partnerBox(side, lead);
}

/** The highlight line the frame draws 12 px inside a box, panel-relative. */
function highlightOf(box: Rect): Rect {
  return {
    x: HIGHLIGHT_INSET,
    y: HIGHLIGHT_INSET,
    w: Math.max(0, box.w - HIGHLIGHT_INSET * 2),
    h: HIGHLIGHT_H,
  };
}

/** The whole layout: four rects in draw order, `null` for a side that fields one. */
export function battleHpLayout(
  viewport: Viewport,
  doubles: Readonly<{ enemy: boolean; player: boolean }>,
): readonly Readonly<{ side: HpSide; slot: 0 | 1; box: Rect }>[] {
  const layout: { side: HpSide; slot: 0 | 1; box: Rect }[] = [];
  for (const side of HP_SIDES) {
    layout.push({ side, slot: 0, box: battleHpBox(viewport, side, 0) });
    if (doubles[side]) layout.push({ side, slot: 1, box: battleHpBox(viewport, side, 1) });
  }
  return layout;
}

function boxId(side: HpSide, slot: 0 | 1): HpBoxView['id'] {
  if (side === 'enemy') return slot === 0 ? 'enemy-0' : 'enemy-1';
  return slot === 0 ? 'player-0' : 'player-1';
}

/**
 * The foe's ball row: one ball per member the trainer fielded, in party order, 8 px
 * under the foe's box and one gap apart. A wild battle draws no row — the wild's
 * party is the wild itself — and a fainted member keeps its ball, so the row counts
 * the team the trainer started with.
 */
export function foeBallRow(
  state: HudState,
  viewport: Viewport,
): Readonly<{ balls: readonly HpBallView[]; box: Rect | null }> {
  const battle = state.battle;
  if (battle === null || battle.isWild) return { balls: [], box: null };

  const lead = battleHpBox(viewport, 'enemy', 0);
  const top = lead.y + lead.h + BATTLE_BALL_ROW_GAP;
  const step = BATTLE_BALL_SIZE + BATTLE_BALL_GAP;
  const balls: HpBallView[] = battle.sides.enemy.party.map((member, index) => ({
    index,
    state: member.hpFraction <= 0 ? 'spent' : 'filled',
    box: { x: lead.x + index * step, y: top, w: BATTLE_BALL_SIZE, h: BATTLE_BALL_SIZE },
  }));
  if (balls.length === 0) return { balls, box: null };

  return {
    balls,
    box: {
      x: lead.x,
      y: top,
      w: balls.length * BATTLE_BALL_SIZE + (balls.length - 1) * BATTLE_BALL_GAP,
      h: BATTLE_BALL_SIZE,
    },
  };
}

/**
 * The player's lead's stage chips and their grid box. The board's own origin
 * `(448, 673)` sits inside the shipped menu card, which starts at 440 here, so the
 * grid is right-aligned to the player's HP column instead: 8 px above the topmost
 * player box, ending on that column's own right edge, three chips a row. Zero
 * stages and a missing battle paint nothing.
 */
export function battleHpStages(
  state: HudState,
  viewport: Viewport,
  doubles: Readonly<{ enemy: boolean; player: boolean }>,
): Readonly<{ chips: readonly HpStageChipView[]; box: Rect | null }> {
  const battle = state.battle;
  if (battle === null) return { chips: [], box: null };

  const lead = battle.sides.player.actives.find((active) => active.slot === 0);
  const stages = lead?.stages ?? [];
  if (stages.length === 0) return { chips: [], box: null };

  const column = battleHpBox(viewport, 'player', 0);
  const above = doubles.player ? battleHpBox(viewport, 'player', 1) : column;
  const top = Math.min(column.y, above.y);
  const cols = Math.min(STAGE_COLS, stages.length);
  const rows = Math.ceil(stages.length / STAGE_COLS);
  const step = STAGE_CHIP + STAGE_GAP;
  const w = cols * STAGE_CHIP + (cols - 1) * STAGE_GAP;
  const h = rows * STAGE_CHIP + (rows - 1) * STAGE_GAP;
  const box: Rect = { x: column.x + column.w - w, y: top - STAGE_CLEARANCE - h, w, h };

  const chips: HpStageChipView[] = stages.map((entry, index) => ({
    stat: entry.stat,
    label: entry.label,
    sign: entry.stage > 0 ? `+${entry.stage}` : `${entry.stage}`,
    stage: entry.stage,
    tone: entry.stage > 0 ? 'up' : 'down',
    box: {
      x: box.x + (index % STAGE_COLS) * step,
      y: box.y + Math.floor(index / STAGE_COLS) * step,
      w: STAGE_CHIP,
      h: STAGE_CHIP,
    },
  }));
  return { chips, box };
}

/** Reads only `state.battle`; a snapshot with no battle paints no box. */
export function battleHpView(
  state: HudState,
  viewport: Viewport,
  doubles: Readonly<{ enemy: boolean; player: boolean }>,
): BattleHpView {
  const battle = state.battle;
  const row = foeBallRow(state, viewport);
  const stages = battleHpStages(state, viewport, doubles);
  if (battle === null) {
    return {
      boxes: [],
      foeBalls: row.balls,
      foeBallsBox: row.box,
      stageChips: stages.chips,
      stageBox: stages.box,
    };
  }

  const rects = new Map<string, Rect>();
  for (const entry of battleHpLayout(viewport, doubles)) {
    rects.set(boxId(entry.side, entry.slot), entry.box);
  }

  const boxes: HpBoxView[] = [];
  for (const side of HP_SIDES) {
    for (const active of battle.sides[side].actives) {
      const slot: 0 | 1 = active.slot === 1 ? 1 : 0;
      const id = boxId(side, slot);
      const box = rects.get(id) ?? battleHpBox(viewport, side, slot);
      boxes.push({
        id,
        side,
        slot,
        box,
        highlight: highlightOf(box),
        name: active.name,
        level: active.level,
        hpText: `${active.hp}/${active.maxHp}`,
        fraction: active.hpFraction,
        statusLabel: active.statusLabel,
      });
    }
  }
  return {
    boxes,
    foeBalls: row.balls,
    foeBallsBox: row.box,
    stageChips: stages.chips,
    stageBox: stages.box,
  };
}
