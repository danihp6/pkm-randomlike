# Spec: Task-208 — a DOM panel collapses to its chip, drags, and keeps its slot

> Batch 91's cut (the lowest pending batch). Batch-mates: `[Task-218]` and `[Task-219]`,
> both filled from later batches; they hold none of this task's paths.

## 🎯 Scope

- **Task type:** DOM HUD (Preact) + one settings/save seam + docs.
- **Role:** Dev.
- **Objective:** after this task every route HUD card — the map header, PARTY, the bag,
  the PC box and the member detail window — is mounted inside **one** shared DOM shell
  that restores the three behaviours `D49` left with the retired canvas layer: a **26 px
  chip** at the card's top-left that collapses it, a **header drag** whose offset is
  **clamped** to the viewport, and the **slot plus collapsed flag written through
  `hudLayout`** so a reload restores both. A collapsed card is the edge chip the strip
  already draws — there is no second chip object, and one implementation serves every
  card, so a new panel inherits the behaviour.
- **Environment:** worktree `../wt-pkm-208`, branch `task-208`. The worktree has no
  `node_modules`: run `npm ci --prefer-offline --no-audit --no-fund` once.
- **Dependencies (all merged on `main`):** `[Task-200]` — the DOM HUD is the HUD and
  `src/scenes/panels/hud.ts` records that "the drag, its clamp and the saved placement
  left with the canvas layer"; `[Task-203]` — the kit; `[Task-207]` — the party header's
  readouts. No task in this batch produces a file this one reads.

### Exclusive paths (single writer)

- `src/ui/hud/panels/hud/panelFrame.tsx` (new — the shell component)
- `src/ui/hud/panels/hud/panelFrameView.ts` (new — the pure geometry)
- `src/ui/hud/panels/hud/panelFrameView.test.ts` (new)
- `src/ui/hud/panels/hud/panelFrame.css` (new — geometry only; every colour, radius,
  size and type size still comes from `src/ui/hud/styles/root.css`'s tokens)
- `src/ui/hud/panels/hud/index.ts` (the barrel gains the frame's exports)
- `src/ui/hud/panels/hud/view.ts` (export the chip letter/label helpers the frame reuses)
- `src/ui/hud/panels/hud/view.test.ts`
- `src/ui/hud/panels/hud/README.md` (one line per new file, in the map's own order)
- `src/ui/hud/panels/{map,party,bag,pc,detail}/mount.tsx` (each wraps its card)
- `src/ui/hud/panels/{map,party,bag,pc,detail}/README.md` (only the `mount.tsx` role line,
  and only where its role actually changed)
- `src/scenes/panels/types.ts` (`RoutePanelHost`'s two new members)
- `src/scenes/panels/hud.ts` (the dock with the saved offset, and `panelFrameHost`)
- `src/scenes/panels/{map,party,bag,pc,detail}.ts` (pass the frame host to the mount)
- `src/scenes/RouteScene.ts` (**only** the two host members of `buildPanelHost`'s
  `buildPanelHost()` body and the persistence line in `setHudCardOpen`; nothing else in
  the scene)
- `docs/hud-fidelity.md` §5's new **A panel's chip and its compressed state.** block
- `docs/tech-decisions.md` the `D49` addendum block **only** (one closing paragraph)
- `docs/design-spec.md` §3's HUD-panels paragraph (lines 232-257) — **not** §2

### Inputs (read-only)

- `docs/design-spec.md` §3 (the promise being restored), `docs/hud-fidelity.md` §5
  (the board's 26 px chips), `docs/tech-decisions.md` `D49` and its addendum.
- `src/data/hudLayout.ts` (`HUD_PANEL_IDS`, `HudPanelLayout`, `HUD_LAYOUT_LIMIT`),
  `src/engine/save.ts` (`Settings.hudLayout`), `src/settings.ts` (`loadSettings`,
  `saveSettings`), `src/scenes/panels/hud.ts`, `src/scenes/panels/types.ts`,
  `src/ui/hud/panels/hud/{view.ts,strip.tsx}`, the five panels' `view.ts` and
  `mount.tsx`, `design/tokens.json`.

## 🔒 Contract

### TypeScript

```ts
// src/scenes/panels/hud.ts
export type PanelFrameHost = Readonly<{
  id: HudPanelId;
  open: boolean;
  layout: HudPanelLayout;
  /** The quick key's own toggle: `toggleHudPanel(host, id)`. */
  onToggle(): void;
  /** Clamped, persisted through the scene's settings, and the strip repaints. */
  onLayout(next: HudPanelLayout): void;
}>;
export function panelFrameHost(host: RoutePanelHost, id: HudPanelId): PanelFrameHost;
/** The card's dock plus its saved drag offset: the strip's chip rides on it. */
export function draggedDock(
  host: RoutePanelHost,
  id: HudPanelId,
): Readonly<{ x: number; y: number }>;
```

```ts
// src/ui/hud/panels/hud/panelFrameView.ts — pure, no DOM, no Phaser, no clock
export type FrameVec = Readonly<{ dx: number; dy: number }>;
/** The nearest offset that keeps `box` (its default rect) inside `viewport`. */
export function clampPanelOffset(offset: FrameVec, box: Rect, viewport: Viewport): FrameVec;
/** The chip's accessible label, or null for a panel the board draws no chip for. */
export function frameLabel(id: HudPanelId, keybinds: Keybinds): string | null;
```

```tsx
// src/ui/hud/panels/hud/panelFrame.tsx
export type PanelFrameProps = Readonly<{
  id: HudPanelId;
  open: boolean;
  layout: HudPanelLayout;
  label: string | null;
  letter: string;
  onToggle(): void;
  onLayout(next: HudPanelLayout): void;
  children: ComponentChildren;
}>;
export function PanelFrame(props: PanelFrameProps): JSX.Element;
```

- `clampPanelOffset` keeps `box.x + dx` in `[0, viewport.width - box.w]` and
  `box.y + dy` in `[0, viewport.height - box.h]`; when the box is wider (or taller) than
  the viewport it returns `0` on that axis. It never returns a non-finite number.
- `frameLabel` returns `null` for `'detail'` (the board draws no chip for it) and a
  `null` for a panel with no quick key; otherwise the strip's own label — the keybind
  table's panel name plus its live key (`chipLabel` in `panels/hud/view.ts`, which this
  task exports). **No new i18n key anywhere.**
- The chip's letter is the strip's own (`STRIP_CHIP_LETTERS`), size `STRIP_CHIP_SIZE`.

### Behaviour the frame must have

1. Its root is `<div class="hud-frame" data-hud-frame={id}>`, anchored at the card's own
   absolute box: the root paints **no** position of its own and moves the whole card with
   `transform: translate(<dx>px, <dy>px)`. The card keeps its own `view.box` untouched, so
   no panel's view math changes.
2. The chip is a `<button class="hud-frame__chip" data-hud-frame-chip={id}>` at the
   card's top-left, 26 × 26, with the strip's letter and `label` as its accessible name.
   A press **with no movement** calls `onToggle()` — the same toggle a quick key runs. It
   is also the drag handle.
3. The drag: `pointerdown` on the chip starts a gesture, `pointermove` paints the live
   offset, `pointerup` commits `clampPanelOffset(...)` through
   `onLayout({ ...layout, dx, dy })`. The card's default rect is measured once per
   gesture (`getBoundingClientRect` of the frame's first element child) and the clamp uses
   that rect **without** the live offset. A gesture whose pointer cannot be captured
   (`setPointerCapture` throwing on a synthetic pointer id) must not break: guard it.
4. `open === false` renders the root `hidden` **and no chip** — the strip draws the
   collapsed card's chip, so the two layers never draw the same object twice. The frame
   never persists anything from `open` (a paused route also reports `false`); the only
   writer of `collapsed` is the scene's `setHudCardOpen`.
5. A mount called **without** a `PanelFrameHost` (a fixture, a test, a scene with no HUD)
   renders its card unwrapped, exactly as today.

### Persistence

- `RoutePanelHost` gains `hudLayout(): HudLayout` and `setHudLayout(layout: HudLayout): void`.
  `RouteScene` implements them by replacing `this.settings` with
  `{ ...this.settings, hudLayout: next }`, calling `saveSettings(this.settings)`
  (`src/settings.ts`) and `refreshHud()`.
- `RouteScene.setHudCardOpen` writes the new `collapsed` flag of that id through
  `setHudLayout` after it changes `hudOpen`, so every collapse path (quick key, strip
  chip, frame chip) persists once and only once. A pause never reaches it.
- `src/scenes/panels/hud.ts`'s `panelsAsSlots` uses `draggedDock`, so a strip chip sits at
  the dragged card's own corner and the rail follows the drag for free.

## 🧩 Data and configuration

- No new key, no new save field and **no `SAVE_VERSION` step**: `hudLayout` already
  exists (`src/data/hudLayout.ts`) and is already decoded; `dx`/`dy` are its own
  `HUD_LAYOUT_LIMIT`-bounded numbers.
- No RNG, no clock: a drag is pointer geometry; nothing here reads `Math.random()` or
  `Date.now()`.
- The DOM layer still imports no Phaser and reads no scene: the frame receives callbacks,
  the scene half lives in `src/scenes/panels/`.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-208` audited against the exclusive paths above.
  - The task has one `[live]` criterion, so a browser pass **is** owed (see below).
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `panelFrameView.test.ts` exists and covers: a 344 × 200 card dragged by
        `(+120, +80)` inside 1280 × 800 keeps the offset; the same drag inside a 390-wide
        viewport returns the offset whose `right` is `≤ 390` and `left` is `≥ 0`; a card
        wider than the viewport returns `0`; `frameLabel('detail', …)` is `null` and
        `frameLabel('party', …)` names the panel and its bound key.
  - [ ] `[unit]` `npm test` is green and every pre-existing test still passes.
  - [ ] `[unit]` `git diff main...task-208 -- src/i18n` is empty (**no new key**) and
        `git diff main...task-208 -- src/engine/save.ts` is empty (**no version step**).
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` **Measured at 1280 × 800 and at 390 × 844** with `?hud=dom` on a route
        (`Continue` from the main menu), via CDP `Runtime.evaluate`:
        (a) pressing `[data-hud-frame-chip="party"]` hides `[data-hud-frame="party"]` and
        draws `[data-hud-strip-chip="party"]` inside ±1 px of the card's own last corner;
        pressing that chip brings the card back;
        (b) a synthetic drag of the party chip by `(+120, +80)` (`pointerdown`, three
        `pointermove`s, `pointerup`, `pointerId: 1`) moves the card's
        `getBoundingClientRect()` by exactly `(+120, +80)` at 1280 and by the clamped
        delta at 390 (`left ≥ 0` and `right ≤ 390`, ±1 px);
        (c) `JSON.parse(localStorage['pkrl.save']).settings.hudLayout.party` (whichever
        key the save uses; read it through `localStorage` and print it) carries the
        applied `dx`/`dy` and `collapsed: false`;
        (d) after `location.reload()` and a fresh boot, the same card's rect corner is the
        same (±1 px) and the saved `collapsed` is still what the last action set.
        A synthetic pointer id that cannot be captured must not break (b) — see the
        frame's guard.

## 📣 Coordination

- **The plan's record is corrected here, not silently.** Batch 91's line names
  `docs/design-spec.md` **§2**; the panel chip/drag promise has never been in §2 — it is
  §3's HUD-panels paragraph (232-257), which is the text this task makes true again.
  §2 stays `[Task-219]`'s. `src/scenes/panels/{types,hud}.ts`, the five scene panel
  modules and four lines of `RouteScene.ts` are added to the exclusive list because the
  slot has to be persisted by the only writer of the settings save (the scene owns it;
  a DOM module may not write it).
- For the Architect: `hudLayout`'s `dx`/`dy` are live again; a later task may read
  `draggedDock` instead of re-deriving a card's corner.
- For the next batch: `PanelFrame` is the only place the chip/drag/collapse is
  implemented — a new card mounts inside it and inherits all three.

## ⛔ Out of scope

- The level-up/evolution popup and the hold-to-reset ring: still canvas, and still open —
  the `D49` addendum promised them to this task's neighbourhood, and this task's doc line
  corrects that record instead of absorbing them.
- The Mart and the mini-boss reward (floating cards, `Task-89`), the pause menu, and the
  phone slot table the strip already draws.
- A settings row, a keybind, a new i18n key, a save field or a `SAVE_VERSION` step.
- Any other line of `src/scenes/RouteScene.ts`.
