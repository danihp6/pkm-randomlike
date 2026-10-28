import type { HudPanelId } from '../../../../data/hudLayout';
import { keyLabel, type KeybindAction, type Keybinds } from '../../../../data/keybinds';
import { t } from '../../../../i18n';

/**
 * The route strip's layout model (`D49`, frame `03 Route HUD`): the edge chips a
 * collapsed HUD panel leaves behind, as data. A collapsed card hides its whole
 * DOM root — its own accent chip included — so the strip is the only way back to a
 * collapsed bag, box or map; this module decides which chips exist and where the
 * board puts them.
 *
 * Pure and total: no Phaser, no DOM, no RNG, no engine read. The scene pushes the
 * panel records' docks and the live keybinds in, and paints what comes back.
 */

export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;

/** The four panels that carry a quick key (`PANEL_KEY_ACTIONS`), in rail order. */
export const STRIP_CHIP_ORDER = ['header', 'box', 'party', 'bag'] as const;
export type StripChipId = (typeof STRIP_CHIP_ORDER)[number];

/** The board's 26×26 badge (`docs/hud-fidelity.md` §5, `m03` chips). */
export const STRIP_CHIP_SIZE = 26;
/** At or above this width the hard-coded phone slots give way to the panels' own docks. */
export const STRIP_NARROW = 600;

/** One chip per panel: the letter is the panel's initial, never the bound key's. */
export const STRIP_CHIP_LETTERS: Readonly<Record<StripChipId, string>> = {
  header: 'M',
  box: 'C',
  party: 'P',
  bag: 'I',
};

/** The action whose key the chip's accessible label names (the `PANEL_KEY_ACTIONS` map). */
export const STRIP_CHIP_ACTIONS: Readonly<Record<StripChipId, KeybindAction>> = {
  header: 'map',
  box: 'box',
  party: 'party',
  bag: 'bag',
};

/**
 * The phone slots, top-left corner per chip, measured from `design/frames/m03-route-hud.json`:
 * `m chip MAP` (8,55), `m chip BOX` (8,119), `m chip BAG` (38,551). `party` has no collapsed
 * form on the board and takes the bag's column x at the first rail row: (38,55).
 */
export const STRIP_PHONE_SLOTS: Readonly<Record<StripChipId, Readonly<{ x: number; y: number }>>> = {
  header: { x: 8, y: 55 },
  box: { x: 8, y: 119 },
  party: { x: 38, y: 55 },
  bag: { x: 38, y: 551 },
};

/** One panel record as the scene knows it: its dock after the saved drag offset. */
export type StripSlot = Readonly<{
  id: HudPanelId;
  x: number;
  y: number;
  collapsed: boolean;
}>;

export type StripInput = Readonly<{
  /** False while the route is paused under a battle or the Settings screen. */
  open: boolean;
  slots: readonly StripSlot[];
  /** The live bindings, so the accessible label tracks a rebind. */
  keybinds: Keybinds;
}>;

export type StripChip = Readonly<{
  id: StripChipId;
  letter: string;
  label: string;
  box: Rect;
}>;

export type StripView = Readonly<{
  open: boolean;
  viewport: Viewport;
  /** In `STRIP_CHIP_ORDER`, only panels that are collapsed; `[]` when `open` is false. */
  chips: readonly StripChip[];
}>;

/**
 * The accessible label: the panel's name from the keybind table, then its live key.
 * Exported because a card's own frame chip names the same panel and the same key.
 */
export function chipLabel(action: KeybindAction, keybinds: Keybinds): string {
  return `${t(`keybind.${action}`)} (${keyLabel(keybinds[action])})`;
}

/**
 * The strip as data: one chip per collapsed panel, in rail order. A phone has no
 * room for a docked rail, so it takes the board's own slots; a wider window puts
 * each chip exactly where the panel's Phaser collapse icon was, so the rail follows
 * the drag for free. A panel absent from `slots` gets no chip, and an open panel is
 * drawn by its card's own chip rather than twice.
 */
export function stripView(input: StripInput, viewport: Viewport): StripView {
  if (!input.open) return { open: false, viewport, chips: [] };
  const narrow = viewport.width < STRIP_NARROW;
  const chips: StripChip[] = [];
  for (const id of STRIP_CHIP_ORDER) {
    const slot = input.slots.find((entry) => entry.id === id);
    if (slot === undefined || !slot.collapsed) continue;
    const action = STRIP_CHIP_ACTIONS[id];
    const origin = narrow ? STRIP_PHONE_SLOTS[id] : { x: slot.x, y: slot.y };
    chips.push({
      id,
      letter: STRIP_CHIP_LETTERS[id],
      label: chipLabel(action, input.keybinds),
      box: { x: origin.x, y: origin.y, w: STRIP_CHIP_SIZE, h: STRIP_CHIP_SIZE },
    });
  }
  return { open: true, viewport, chips };
}
