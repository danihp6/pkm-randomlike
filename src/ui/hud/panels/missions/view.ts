/**
 * The floor-mission panel's value model: the card's box and one row per mission, in
 * plain data. Pure and total — no run, no scene, no `src/data/**` — because the scene
 * resolves every string and this module only places it.
 */

export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;

/** One row of the card: the floor the run stands on, or a floor it already met. */
export type MissionRowView = Readonly<{
  id: string;
  /** The row's display name, resolved by the scene. */
  name: string;
  /** The floor's progress line, or null on a completed row. */
  progress: string | null;
  /** `Map 3`, resolved by the scene; empty on the head row. */
  map: string;
  /** True on a floor the run already met. */
  completed: boolean;
  /** Panel-relative. */
  box: Rect;
}>;

/** What the scene hands the panel: the strings, already resolved. */
export type MissionsInput = Readonly<{
  open: boolean;
  /** `t('hud.missions')`. */
  title: string;
  /** The floor the run stands on, or null when the run carries no mission row. */
  current: Readonly<{ id: string; name: string; progress: string }> | null;
  /** The run's met floors, **newest first**, already named by the scene. */
  completed: readonly Readonly<{ id: string; name: string; map: string }>[];
  /** `t('hud.missionsEmpty')`, printed only when `completed` is empty. */
  empty: string;
}>;

export type MissionsPanelView = Readonly<{
  open: boolean;
  /** Viewport coordinates. */
  box: Rect;
  title: string;
  /** The head row: the floor's mission with its progress, or null. */
  current: MissionRowView | null;
  /** Newest first, at most `MISSIONS_MAX_ROWS`; empty when nothing was met. */
  rows: readonly MissionRowView[];
  /** `t('hud.missionsEmpty')` while `rows` is empty, else null. */
  empty: string | null;
}>;

/** The desk card's width: the notices stack's own 360, beside the mission line it replaces. */
export const MISSIONS_W = 360;
/** The phone card's width: the notices stack's 374 at the 8 px gutter. */
export const MISSIONS_PHONE_W = 374;
/** At or below this width the phone card is used. */
export const MISSIONS_NARROW = 560;
/** The head row's height: the floor's own mission and its progress. */
export const MISSIONS_HEAD_H = 32;
/** One completed floor's row. */
export const MISSIONS_ROW_H = 22;
/** The rows the card draws before it stops: the oldest are the ones that fall off. */
export const MISSIONS_MAX_ROWS = 6;
/** The card's own inset from the row's sides, and the phone's gutter. */
export const MISSIONS_PAD = 8;
/** The chip slot the frame draws at the card's corner, which the title clears. */
export const MISSIONS_CONTENT_LEFT = 30;

/**
 * The card's box: the notice stack's second row, widened to the card's own width, with
 * one head row plus one row per completed floor (at least one, so the empty state has
 * somewhere to paint). Clamped to the window it is drawn in.
 */
export function missionsPanelBox(viewport: Viewport, completedCount: number): Rect {
  const narrow = viewport.width <= MISSIONS_NARROW;
  const w = Math.min(
    narrow ? MISSIONS_PHONE_W : MISSIONS_W,
    Math.max(0, viewport.width - MISSIONS_PAD * 2),
  );
  const x = narrow ? MISSIONS_PAD : Math.max(MISSIONS_PAD, (viewport.width - w) / 2);
  const top = (narrow ? 47 : 24) + 56 + MISSIONS_PAD;
  const rows = Math.max(
    1,
    Math.min(Number.isFinite(completedCount) ? Math.trunc(completedCount) : 0, MISSIONS_MAX_ROWS),
  );
  const h = MISSIONS_HEAD_H + rows * MISSIONS_ROW_H;
  const y = Math.max(0, Math.min(top, Math.min(viewport.height, 810) - h));
  return { x, y, w, h };
}

/** The card as data: the head row first, then the floors the run met, newest first. */
export function missionsPanelView(input: MissionsInput, viewport: Viewport): MissionsPanelView {
  const completed = input.completed.slice(0, MISSIONS_MAX_ROWS);
  const box = missionsPanelBox(viewport, completed.length);
  const rowW = Math.max(0, box.w - MISSIONS_PAD * 2);
  const current: MissionRowView | null =
    input.current === null
      ? null
      : {
          id: input.current.id,
          name: input.current.name,
          progress: input.current.progress,
          map: '',
          completed: false,
          box: { x: MISSIONS_PAD, y: 0, w: rowW, h: MISSIONS_HEAD_H },
        };
  const rows = completed.map((row, index) => ({
    id: row.id,
    name: row.name,
    progress: null,
    map: row.map,
    completed: true,
    box: {
      x: MISSIONS_PAD,
      y: MISSIONS_HEAD_H + index * MISSIONS_ROW_H,
      w: rowW,
      h: MISSIONS_ROW_H,
    },
  }));
  return {
    open: input.open,
    box,
    title: input.title,
    current,
    rows,
    empty: rows.length === 0 ? input.empty : null,
  };
}
