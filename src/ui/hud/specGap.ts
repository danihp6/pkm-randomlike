/**
 * The spec gap (`D57`): a panel's own view model against the imported screen spec, in one
 * pure comparison. It answers four questions and nothing else — which boxes the view does
 * not draw, which it draws more than a pixel away, which of its strings the board does not
 * carry, and which of its colours are outside the board's palette — so a per-panel task is
 * cut from a measurement rather than from an opinion.
 *
 * No DOM, no Phaser, no clock: the caller hands both sides in, and the same two arguments
 * always give the same gap.
 */

/** One box, panel-relative, as a view model already carries it. */
export type GapBox = Readonly<{ name: string; x: number; y: number; w: number; h: number }>;

/** The three facts a panel's view model exposes to this comparison. */
export type PanelView = Readonly<{
  boxes: readonly GapBox[];
  strings: readonly string[];
  /** `#rrggbb`, lowercase, as the panel paints them. */
  colours: readonly string[];
}>;

/** One box of an imported spec (`design/screens/<slug>.json`), in frame coordinates. */
export type SpecBox = Readonly<{
  name: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
}>;

/** The part of a screen spec this comparison reads. */
export type ScreenSpec = Readonly<{
  slug: string;
  boxes: readonly SpecBox[];
  text: readonly Readonly<{ characters: string }>[];
  colours: readonly string[];
}>;

/** The gap: four lists, each one a per-panel task's evidence. */
export type SpecGap = Readonly<{
  /** Box names the view draws that the spec does not carry. */
  missing: readonly string[];
  /** Boxes both sides draw, more than `GAP_TOLERANCE` px apart, with the delta. */
  moved: readonly Readonly<{ name: string; dx: number; dy: number; dw: number; dh: number }>[];
  /** Strings the view prints that the spec's text tree does not carry. */
  strings: readonly string[];
  /** The view's colours that are not in the spec's own (already token-checked) palette. */
  colours: readonly string[];
}>;

/** A box may sit one pixel off the board and still be the board's box. */
export const GAP_TOLERANCE = 1;

/** The colours a spec's literals carry, `#rrggbb` lowercase, stripped of the alpha suffix. */
export function specColours(spec: ScreenSpec): readonly string[] {
  return [...new Set(spec.colours.map(baseColour))].sort();
}

/** `#10161f@0.72` → `#10161f`; anything else is passed through lowercased. */
function baseColour(literal: string): string {
  const at = literal.indexOf('@');
  return (at === -1 ? literal : literal.slice(0, at)).toLowerCase();
}

/** The spec's boxes by name, first wins: a frame may repeat a name for two states. */
function byName(spec: ScreenSpec): Map<string, SpecBox> {
  const map = new Map<string, SpecBox>();
  for (const box of spec.boxes) {
    if (box.name === null || box.name === '') continue;
    if (!map.has(box.name)) map.set(box.name, box);
  }
  return map;
}

/**
 * The gap between one panel's view and its screen spec. `gapFor` is total: a view box whose
 * name the spec never draws is `missing`, never a throw, and an empty view is an empty gap.
 */
export function gapFor(view: PanelView, spec: ScreenSpec): SpecGap {
  const specBoxes = byName(spec);
  const missing: string[] = [];
  const moved: { name: string; dx: number; dy: number; dw: number; dh: number }[] = [];

  for (const box of view.boxes) {
    const target = specBoxes.get(box.name);
    if (target === undefined) {
      missing.push(box.name);
      continue;
    }
    const dx = Math.round(box.x - target.x);
    const dy = Math.round(box.y - target.y);
    const dw = Math.round(box.w - target.width);
    const dh = Math.round(box.h - target.height);
    if (
      Math.abs(dx) > GAP_TOLERANCE ||
      Math.abs(dy) > GAP_TOLERANCE ||
      Math.abs(dw) > GAP_TOLERANCE ||
      Math.abs(dh) > GAP_TOLERANCE
    ) {
      moved.push({ name: box.name, dx, dy, dw, dh });
    }
  }

  // The board draws its labels in caps and a panel may reach them through CSS
  // `text-transform`, so the comparison is case-insensitive by design.
  const fold = (line: string): string => line.trim().toUpperCase();
  const specText = new Set(spec.text.map((line) => fold(line.characters)));
  const strings = [...new Set(view.strings.filter((line) => line !== ''))].filter(
    (line) => !specText.has(fold(line)),
  );

  const specPalette = new Set(specColours(spec));
  const colours = [...new Set(view.colours.map((colour) => colour.toLowerCase()))].filter(
    (colour) => !specPalette.has(colour),
  );

  return { missing, moved, strings, colours };
}

/** True when the four lists are empty: the panel draws its board. */
export function gapIsEmpty(gap: SpecGap): boolean {
  return (
    gap.missing.length === 0 &&
    gap.moved.length === 0 &&
    gap.strings.length === 0 &&
    gap.colours.length === 0
  );
}
