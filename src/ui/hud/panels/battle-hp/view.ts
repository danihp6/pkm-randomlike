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

export type BattleHpView = Readonly<{
  /** Every box the battle fields right now, in draw order: foe lead, foe partner,
   * player lead, player partner. A side that fields one active has one box. */
  boxes: readonly HpBoxView[];
}>;

/** How long a fill takes to reach its new fraction, in ms. Below the 900 ms frame
 * dwell (`MESSAGE_HOLD_MS`), so a drop lands with its line. */
export const HP_FILL_MS = 300;
/** 600: below it the phone column's boxes are used (`m05`). */
export const BATTLE_HP_BREAKPOINT = 600;

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

/** Reads only `state.battle`; a snapshot with no battle paints no box. */
export function battleHpView(
  state: HudState,
  viewport: Viewport,
  doubles: Readonly<{ enemy: boolean; player: boolean }>,
): BattleHpView {
  const battle = state.battle;
  if (battle === null) return { boxes: [] };

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
  return { boxes };
}
