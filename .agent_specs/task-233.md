# Spec: Task-233 — a collapsed panel's badge is draggable, on the desk and on the phone

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** HUD (Preact DOM) + Phaser scene callback.
- **Role:** Dev.
- **Objective:** the drag that moves a route panel lives on the **open card's** own
  frame chip, so a collapsed panel's badge cannot be moved: on the phone the strip
  pins it to the board's measured slots and `hudLayout`'s `dx`/`dy` are never read;
  on the desk it only inherits the card's last drag and can be moved only by
  reopening the card. After this task the gesture is the shell's: one shared drag
  helper used by the card's chip **and** by the strip's badge, a badge drag commits
  the same `hudLayout` entry the card writes (so it survives a reload and the
  reopened card inherits it), a press under the slop still toggles, and the phone's
  measured slots become the **base origin** the saved offset is added to. Both
  layouts clamp to the viewport minus the 26 px badge, so a chip cannot leave the
  screen. Two badges may overlap, the last drag winning the draw order — no snapping.
- **Environment:** worktree `../wt-pkm-233`, branch `task-233`.
- **Dependencies:** none.

### Exclusive paths (single writer)

- `src/ui/hud/panels/hud/strip.tsx`
- `src/ui/hud/panels/hud/strip.css`
- `src/ui/hud/panels/hud/view.ts`
- `src/ui/hud/panels/hud/view.test.ts`
- `src/ui/hud/panels/hud/panelFrame.tsx`
- `src/ui/hud/panels/hud/panelFrameView.ts` (only if a shared clamp helper lands here)
- `src/ui/hud/panels/hud/drag.ts` **(new)** and `src/ui/hud/panels/hud/drag.test.ts` **(new)**
- `src/ui/hud/panels/hud/mount.tsx` (the strip's callbacks) — and its
  `fixture.test.ts` only if a fixture snapshot moves
- `src/scenes/RouteScene.ts` — **only** the strip's one callback/slot builder
- `docs/design-spec.md` — **§2 only** (a batch-mate owns §3 and §4)
- `docs/hud-fidelity.md`
- `docs/tech-decisions.md` — **`D49`'s paragraph only**
- `src/ui/hud/panels/hud/README.md`
- `src/ui/hud/README.md`

Nothing outside this list. No other panel folder, no `src/data/hudLayout.ts` shape
change (the entry is already `{ dx, dy, collapsed }`; read it, do not widen it).

### Inputs (read-only)

- `src/data/hudLayout.ts` — `HudPanelLayout`, `HudLayout`, `defaultHudLayout`,
  `HUD_LAYOUT_LIMIT` (the stored shape and its bounds).
- `src/ui/hud/panels/hud/panelFrameView.ts` — `clampPanelOffset(offset, card,
  viewport)` and `FrameVec`, the shipped clamp.
- `src/ui/hud/panels/hud/view.ts` — `StripSlot`, `StripView`, `STRIP_PHONE_SLOTS`,
  `STRIP_CHIP_SIZE`, `STRIP_NARROW`.
- `src/ui/hud/panels/hud/mount.tsx` — where the strip is mounted and which callbacks
  the scene hands it.
- `src/scenes/RouteScene.ts` — `hudLayout` application and the strip's slot builder.
- `src/data/hudLayout.ts` + `src/engine/save.ts` — how a committed layout is saved.
- `design/frames/03-route-hud.json` + `design/screens/03-route-hud.png` — caption
  `03 Route HUD`; `design/frames/m03-route-hud.json` +
  `design/screens/m03-route-hud.png` — caption `M 03 Route HUD`;
  `design/frames/m03c-panels-compress.json` + `design/screens/m03c-panels-compress.png`
  — caption `M 03c Panels · compress`. Read-only: the measured slots stay the base
  origin, no new geometry is invented.

## 🔒 Contract

### `src/ui/hud/panels/hud/drag.ts` (new)

Pure, no DOM, no Preact — this is what the tests exercise.

```ts
import type { FrameVec } from './panelFrameView';
import type { Rect, Viewport } from './view';

/** The shipped slop, moved here so the card and the badge share it. */
export const DRAG_SLOP = 3;

export type BadgeDragStart = Readonly<{
  pointerX: number;
  pointerY: number;
  /** The panel's saved offset when the gesture started. */
  dx: number;
  dy: number;
  /** The badge's base top-left (phone slot, or the docked slot) before the offset. */
  originX: number;
  originY: number;
}>;

export type BadgeDragResult = Readonly<{
  /** The offset to commit, already clamped so the badge stays inside the viewport. */
  dx: number;
  dy: number;
  /** False under the slop: the gesture is a press, not a drag. */
  moved: boolean;
}>;

export function badgeDrag(
  start: BadgeDragStart,
  pointer: Readonly<{ x: number; y: number }>,
  viewport: Viewport,
  badgeSize: number,
): BadgeDragResult;
```

- `moved` is true only when `max(|x - pointerX|, |y - pointerY|) >= DRAG_SLOP`.
- The result is `start.dx + mx`, `start.dy + my`, clamped so
  `originX + dx` ∈ `[0, viewport.width - badgeSize]` and the same on `y`. A degenerate
  viewport (0 or smaller) returns the start offset, moved as computed.
- The card's own `panelFrame.tsx` imports `DRAG_SLOP` from here instead of keeping a
  private constant; its behaviour and clamp stay identical.

### `src/ui/hud/panels/hud/view.ts`

- `StripSlot` gains the saved offset: `{ id, x, y, dx, dy, collapsed }`.
- `stripView` keeps the desk rule (`slot.x`/`slot.y` are already the dock after the
  offset) and the phone rule becomes `STRIP_PHONE_SLOTS[id] + { dx, dy }`.
- The badge `box` stays 26 px (`STRIP_CHIP_SIZE`). The clamp itself is the drag's
  job; `stripView` never invents a position.

### `src/ui/hud/panels/hud/strip.tsx`

- `HudStrip` gains `onLayout?: (id: HudPanelId, next: HudPanelLayout) => void`.
- Each badge gets the same pointer gesture the card's chip has, through
  `badgeDrag`: `pointerdown` records the start, `pointermove` paints the live offset
  (translate the badge), `pointerup` commits through `onLayout` when `moved`, or
  fires the existing toggle when not. Reuse `setPointerCapture` with the shipped
  try/catch.
- **A badge drag never toggles; a tap under the slop still opens the panel.** The
  click that follows a drag is swallowed exactly as the card's chip swallows it.
- No new DOM attribute is required; keep `data-hud-strip-chip`.

### `src/ui/hud/panels/hud/mount.tsx` + `src/scenes/RouteScene.ts`

- The mount passes the strip `onLayout` (a new `HudStripCallbacks` entry, the same
  shape the frame already uses), and the scene commits it to the run's saved
  `hudLayout` exactly as the card's `onLayout` does today. One code path, no second
  writer of the layout.
- The scene's strip slot builder passes each panel's saved `dx`/`dy` into
  `StripSlot`.

### Data

No new key and no shape change: `HudPanelLayout` is read and written as it ships.
No `SAVE_VERSION` step, no run field. A drag commits a **global setting**, never run
state.

- **Determinism:** reads no RNG.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including `drag.test.ts` and the
    updated `view.test.ts`.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-233` audited against the exclusive paths.
- **Acceptance criteria:**
  - [ ] `[unit]` `badgeDrag` returns `moved: false` and the start offset for a travel
        under `DRAG_SLOP` on both axes.
  - [ ] `[unit]` a drag of (+40, −40) from a phone slot returns that offset when the
        badge stays inside 390×844, and clamps it so `origin + offset` never leaves
        `[0, 390 - 26] × [0, 844 - 26]`.
  - [ ] `[unit]` on a 1280×800 desk the same gesture maps to the same offset added to
        the docked slot, clamped to the viewport.
  - [ ] `[unit]` `stripView` at 390×844 places a badge at `STRIP_PHONE_SLOTS[id] + { dx, dy }`
        and at 1280×800 at the dock, and a stored offset is therefore restored.
  - [ ] `[unit]` the strip's `onLayout` receives that panel's id and its
        `{ dx, dy, collapsed }` unchanged in `collapsed`.
  - [ ] `[unit]` the desk's dock rule is unchanged for an undragged panel (offset 0).
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` at 390×844: a collapsed BAG badge dragged by (+40, −40) with CDP
        `Input.dispatchMouseEvent` lands at its phone slot + the clamped offset
        (rect read from `getBoundingClientRect`, ±1 px), `hudLayout.bag` in
        `localStorage` (the run's settings document) reads the same `dx`/`dy`, and
        after `Page.reload` the badge's rect equals the pre-reload rect.
  - [ ] `[live]` at 390×844 a tap on the same badge without travel still opens
        `[data-hud-panel="bag"]`, and at 1280×800 a badge drag moves it by the same
        delta with no panel opened.
- **A `[live]` that compares pixels is not a criterion** (`D57`): every check reads a
  rect, an attribute or the stored layout, never a screenshot.

## 📣 Coordination

- For the next batch: `drag.ts` exports `DRAG_SLOP` and `badgeDrag`; `StripSlot`
  carries `dx`/`dy`; `HudStrip` takes `onLayout`. The card and the badge share one
  gesture and one layout writer.
- For the Architect: `src/ui/hud/README.md` and the folder's own README are updated
  in this task because `drag.ts` is new; `docs/design-spec.md` §2 and `D49`'s
  paragraph gain only the drag sentence, and `docs/hud-fidelity.md` records that the
  phone slots are origins.
- The layout stays a global setting saved with the settings; no run field.

## ⛔ Out of scope

- No snapping, no grid, no collision avoidance between badges (overlap is allowed).
- No change to `src/data/hudLayout.ts`, the panel cards' geometry, the pause menu,
  the keyboard surface, or any panel other than the strip.
- No reduced-motion setting, no animation beyond the live paint.
