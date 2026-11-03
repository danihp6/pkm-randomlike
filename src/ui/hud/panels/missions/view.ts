import type { MissionStatus } from '../../../../engine/region/missions';

/**
 * The mission panel's value model: the card's box and one row per mission on the node's
 * stack, in plain data. Pure and total — no run, no scene, no RNG and no strings of its
 * own — because the scene resolves every string and this module only places it.
 *
 * The one engine import is the status union, type-only, so the row's state and the
 * engine's can never drift apart.
 */

export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;

/** One row of the card: a mission of the node's stack, already resolved to text. */
export type MissionRowView = Readonly<{
  id: string;
  /** `stretch`, `city:<key>` or `random:<key>`: the row's DOM hook and its only identity. */
  scopeKey: string;
  /** The row's display name, resolved by the scene. */
  name: string;
  /** The badge tag, resolved by the scene (`Badge 3`). */
  tag: string;
  /** The row's status word, or null while it is active. */
  progress: string | null;
  status: MissionStatus;
  /** Panel-relative. */
  box: Rect;
}>;

/** One mission of the stack, as the scene hands it over: strings already resolved. */
export type StackMissionInput = Readonly<{
  id: string;
  scopeKey: string;
  name: string;
  tag: string;
  progress: string | null;
  status: MissionStatus;
}>;

/** What the scene hands the panel: the stack in the engine's own order, already resolved. */
export type MissionsInput = Readonly<{
  open: boolean;
  /** `t('hud.missions')`. */
  title: string;
  /** The node's stack, exactly as `activeMissions` answered it. */
  missions: readonly StackMissionInput[];
  /** `t('hud.missionsEmpty')`, printed only when the stack is empty. */
  empty: string;
}>;

export type MissionsPanelView = Readonly<{
  open: boolean;
  /** Viewport coordinates. */
  box: Rect;
  title: string;
  /** The stack's first row (the stretch's automatic one), drawn at the head row's height. */
  current: MissionRowView | null;
  /** The rest of the stack, in order, at most `MISSIONS_MAX_ROWS` in total. */
  rows: readonly MissionRowView[];
  /** `t('hud.missionsEmpty')` while the card holds no row at all, else null. */
  empty: string | null;
}>;

/** The desk card's width: the notices stack's own 360, beside the mission line it replaces. */
export const MISSIONS_W = 360;
/** The phone card's width: the notices stack's 374 at the 8 px gutter. */
export const MISSIONS_PHONE_W = 374;
/** At or below this width the phone card is used. */
export const MISSIONS_NARROW = 560;
/** The head row's height: the stack's first mission and its status. */
export const MISSIONS_HEAD_H = 32;
/** One further mission's row. */
export const MISSIONS_ROW_H = 22;
/** The rows the card draws before it stops: the last ones are the ones that fall off. */
export const MISSIONS_MAX_ROWS = 6;
/** The card's own inset from the row's sides, and the phone's gutter. */
export const MISSIONS_PAD = 8;
/** The chip slot the frame draws at the card's corner, which the title clears. */
export const MISSIONS_CONTENT_LEFT = 30;

/**
 * The card's box: the notice stack's second row, widened to the card's own width, with
 * one head row plus one row per further mission of the stack (at least one, so the empty
 * state has somewhere to paint). Clamped to the window it is drawn in.
 */
export function missionsPanelBox(viewport: Viewport, stackCount: number): Rect {
  const narrow = viewport.width <= MISSIONS_NARROW;
  const w = Math.min(
    narrow ? MISSIONS_PHONE_W : MISSIONS_W,
    Math.max(0, viewport.width - MISSIONS_PAD * 2),
  );
  const x = narrow ? MISSIONS_PAD : Math.max(MISSIONS_PAD, (viewport.width - w) / 2);
  const top = (narrow ? 47 : 24) + 56 + MISSIONS_PAD;
  const rows = Math.max(
    1,
    Math.min(Number.isFinite(stackCount) ? Math.trunc(stackCount) : 0, MISSIONS_MAX_ROWS),
  );
  const h = MISSIONS_HEAD_H + rows * MISSIONS_ROW_H;
  const y = Math.max(0, Math.min(top, Math.min(viewport.height, 810) - h));
  return { x, y, w, h };
}

/** Every row the card paints, the head row first: the stack in the order the engine gave. */
export function missionsPanelRows(view: MissionsPanelView): readonly MissionRowView[] {
  return view.current === null ? view.rows : [view.current, ...view.rows];
}

/** The card as data: one row per mission of the node's stack, in its own order. */
export function missionsPanelView(input: MissionsInput, viewport: Viewport): MissionsPanelView {
  const stack = input.missions.slice(0, MISSIONS_MAX_ROWS);
  // The stack's first row is the head row, so the box grows by the rows below it (and
  // never past the one spare row the empty state paints in).
  const box = missionsPanelBox(viewport, stack.length - 1);
  const rowW = Math.max(0, box.w - MISSIONS_PAD * 2);
  const placed = stack.map((mission, index) => ({
    id: mission.id,
    scopeKey: mission.scopeKey,
    name: mission.name,
    tag: mission.tag,
    progress: mission.progress,
    status: mission.status,
    box:
      index === 0
        ? { x: MISSIONS_PAD, y: 0, w: rowW, h: MISSIONS_HEAD_H }
        : {
            x: MISSIONS_PAD,
            y: MISSIONS_HEAD_H + (index - 1) * MISSIONS_ROW_H,
            w: rowW,
            h: MISSIONS_ROW_H,
          },
  }));
  const current: MissionRowView | null = placed[0] ?? null;
  const rows = placed.slice(1);
  return {
    open: input.open,
    box,
    title: input.title,
    current,
    rows,
    empty: placed.length === 0 ? input.empty : null,
  };
}
