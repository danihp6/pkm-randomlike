/**
 * The HUD panel layout (Phase 7): where the player has dragged each panel of the
 * route overlay (the `I` key) and whether it is collapsed to its icon. It is a
 * global preference that outlives a run, so it is stored with the settings in the
 * save (D22). Pure and Phaser-free, so the save can validate it and the route can
 * apply it.
 */

/** The panels of the route HUD, in the order they are listed. */
export const HUD_PANEL_IDS = ['header', 'map', 'party', 'bag', 'box', 'detail'] as const;

export type HudPanelId = (typeof HUD_PANEL_IDS)[number];

/** One panel's saved placement: its drag offset and whether it is collapsed. */
export type HudPanelLayout = Readonly<{ dx: number; dy: number; collapsed: boolean }>;

export type HudLayout = Readonly<Record<HudPanelId, HudPanelLayout>>;

/** Larger offsets than this are treated as junk and reset (a hand-edited save). */
export const HUD_LAYOUT_LIMIT = 4000;

export function defaultHudLayout(): HudLayout {
  return {
    header: { dx: 0, dy: 0, collapsed: false },
    map: { dx: 0, dy: 0, collapsed: false },
    party: { dx: 0, dy: 0, collapsed: false },
    bag: { dx: 0, dy: 0, collapsed: false },
    box: { dx: 0, dy: 0, collapsed: false },
    detail: { dx: 0, dy: 0, collapsed: false },
  };
}

/** A finite, in-range offset, or null so the default is kept. */
function readOffset(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.abs(value) <= HUD_LAYOUT_LIMIT ? value : null;
}

/** Reads one panel's layout from an untrusted value, field by field. */
function parsePanel(value: unknown, base: HudPanelLayout): HudPanelLayout {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return base;
  const record = value as Record<string, unknown>;
  const dx = readOffset(record.dx) ?? base.dx;
  const dy = readOffset(record.dy) ?? base.dy;
  const collapsed = typeof record.collapsed === 'boolean' ? record.collapsed : base.collapsed;
  return { dx, dy, collapsed };
}

/** Reads the whole layout, defaulting any panel the document omits. */
export function parseHudLayout(value: unknown): HudLayout {
  const base = defaultHudLayout();
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return base;
  const record = value as Record<string, unknown>;
  const result = {} as Record<HudPanelId, HudPanelLayout>;
  for (const id of HUD_PANEL_IDS) result[id] = parsePanel(record[id], base[id]);
  return result;
}
