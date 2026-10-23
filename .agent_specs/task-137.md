# Spec: Task-137 — the notices strip and the mission line are the HUD's

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene + DOM panel migration (Phase 12, `D49`).
- **Role:** Dev.
- **Objective:** the route's three passive cards — the transient notice strip, the
  area-entry banner and the floor's mission line — become DOM text at the top of the
  screen in `src/ui/hud/panels/notices/`, mounted into `#hud` behind `?hud=dom`, with
  the safe-area inset the canvas never respected (**47 px top, 810 bottom**, from
  `design/tokens.json`'s `safeArea`). With the flag on `src/scenes/panels/notices.ts`
  draws none of the three in Phaser; with it off they are exactly the shipped
  Phaser cards. The hold times keep the same beat, and nothing on this panel takes
  input: the route keeps walking under it.
- **Environment:** worktree `../wt-pkm-137`, branch `task-137`.
- **Dependencies:** merged on `main` before this branch:
  - `[Task-127]`, `[Task-124]`, `[Task-125]` — the flag spike, the shell and the kit.
  - `[Task-128]` — the panel layer and `RoutePanelHost`.
  - `[Task-129]`–`[Task-136]` — the sibling migrations; `src/scenes/panels/shop.ts`
    + `src/ui/hud/panels/shop/` are the worked example of the flag/mount/pause shape.

Before you write code, in your worktree: `npm ci`, then `npm test` once (baseline on
the base commit: 213 files / 3942 tests green).

### Exclusive paths (single writer)

**Nothing outside this list.**

- `src/scenes/panels/notices.ts`
- `src/ui/hud/panels/notices/**` (new folder: `view.ts`, `view.test.ts`,
  `noticesPanel.tsx`, `notices.css`, `mount.tsx`, `index.ts`, `fixture.test.ts`,
  `README.md`)
- `design/fixtures/03k-panels-notice-item.json` (new)
- `src/scenes/panels/README.md` — **you are the only writer of this file in the
  batch.** It currently maps `trade.ts` as "the trade card's entry point; its
  drawing still lives in `rooms/trade.ts`", `rewards.ts` as the floating reward card
  and `notices.ts` as the Phaser strip/banner/mission. After this batch those three
  lines are stale. Rewrite **only those three bullets**, once, to state their
  post-migration role (each panel's DOM card under `?hud=dom`, the Phaser drawing
  still the flag-off path). Do not reword any other line and do not reorder the
  list: `Task-135` and `Task-136` are forbidden from touching this file, so your
  edit is the batch's only one.

### Inputs (read-only)

- `src/ui/notice.ts` — `Notice` (`{ text, holdMs }`), `NOTICE_HOLD_MS`,
  `AREA_PANEL_HOLD_MS`, `areaEntryNotice`. **Never edit**: the model carries text and
  a hold only.
- `src/scenes/panels/types.ts` — `RoutePanelHost`, `RoutePanelDescriptor`.
- `src/scenes/RouteScene.ts` — the callers you must not break:
  `showAreaPanel(this.panelHost)` (lines 1106, 1282, 2586) and
  `showPanelNotice(this.panelHost, notice)` from its private `showNotice`
  (3315-3317), plus `refreshNotices` from the panel registry.
- `src/ui/hud/panels/shop/**`, `src/scenes/panels/shop.ts` — the reference migration
  (flag read once, `Signal`, `mount…` disposer, `'pause'`/`'resume'`/`'shutdown'`).
- `src/ui/hud/styles/root.css` — the type scale, the palette and the panel tokens you
  must consume (`--hud-type-readout-size/line`, `--hud-type-meta-*`,
  `--hud-panel-fill`, `--hud-panel-border`, `--hud-panel-radius`,
  `--hud-text-ink`, `--hud-text-muted`).
- `design/tokens.json` — `safeArea.top = 47`, `safeArea.bottom = 810`; `panel.alphas`,
  `radii`, `scale`.
- `design/frames/03k-panels-notice-item.json` and `m03k-panels-notice-item.json` — the
  board's strip (720×56 at (280,24) desktop; 374×56 at (8,47) mobile).
- `design/fixtures/02-options.json` — the fixture shape.
- `docs/hud-fidelity.md` §5 (the safe area), `docs/hud-dom-proposal.md` §7,
  `docs/tech-decisions.md` `D49`.

## 🔒 Contract

### The pure view

`src/ui/hud/panels/notices/view.ts`:

```ts
export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;

/** One line the panel can float; all three cards share the shape. */
export type NoticesLine = Readonly<{ text: string; box: Rect }>;

export type NoticesInput = Readonly<{
  /** The transient notice, or null while it is not up. */
  notice: string | null;
  /** The area-entry banner's line, or null. */
  area: string | null;
  /** The floor's mission line, or null when the run carries no mission. */
  mission: string | null;
}>;

export type NoticesPanelView = Readonly<{
  notice: NoticesLine | null;
  area: NoticesLine | null;
  mission: NoticesLine | null;
}>;

/** The three cards' rects at this viewport, in the stack the screen draws. */
export function noticeBox(viewport: Viewport): Rect;
export function missionBox(viewport: Viewport): Rect;
export function areaBox(viewport: Viewport): Rect;
export function noticesPanelView(input: NoticesInput, viewport: Viewport): NoticesPanelView;
```

- **Desktop (`viewport.height > 560`, i.e. the board's 1280×800):** the strip is
  **720×56**, centred (`x = (width − 720) / 2`, clamped to an 8 px margin) at
  **y = 24**; the mission card is 360×32 at `y = notice.y + 56 + 8`; the area banner
  is 360×64 at `y = mission.y + 32 + 8` — the shipped stack, with the board's taller
  strip. Text is centred in its card with a 16 px inset on both sides, 16 px/20 px
  (readout) on the strip and the mission, 18 px/23 px (title) on the area banner —
  the shipped sizes.
- **Phone (`viewport.width <= 560`, the board's 390×844):** each card is
  **374 px wide at x = 8** and the **top is the safe area's 47**, never 24: strip
  374×56 at (8,47); mission 374×32 at (8,111); area 374×64 at (8,151). The bottom
  of the stack never crosses `safeArea.bottom` (810) — a fourth line would be
  clamped, not drawn past it.
- Between the two (a narrow desktop window) the width is `min(720, width − 16)`
  centred and the phone top applies only below the 560 px breakpoint, so no card
  ever overflows horizontally.
- **Pure and total:** same input ⇒ deep-equal view; the input is never written; no
  Phaser, no DOM, no `t()` needed (the caller resolves the copy), no `holdMs` in the
  view.

### The scene side

`src/scenes/panels/notices.ts` keeps its whole public surface:

```ts
export function showNotice(host: RoutePanelHost, notice: Notice): void;
export function showAreaPanel(host: RoutePanelHost): void;
export function noticesDrawnObjectCount(): number; // 0 under ?hud=dom
export const descriptor: RoutePanelDescriptor;     // id 'notices', order 60
```

- **Flag off:** the shipped `buildNotice` / `buildAreaPanel` / `buildMissionLine`
  and their timers are untouched in behaviour (the board's 56 px strip replaces the
  shipped 44 px one only if you keep one number — keep the shipped 44 off-flag and
  use 56 for the DOM card; state the choice in the module's doc comment).
- **Flag on:** `build` mounts `mountNoticesPanel` into `#hud` with a
  `Signal<NoticesPanelView>` and builds no Phaser card; `showNotice` and
  `showAreaPanel` push their line into the signal and schedule the hide with
  `host.scene.time.delayedCall(notice.holdMs, …)` — **the same beat**, no new clock,
  no CSS animation that outlives the timer. `refresh` repaints the mission line:
  `run.mission` → `t('hud.mission', { mission: t(mission.nameKey) })`, else hidden
  (exactly what the shipped `refreshNotices` does).
- The card takes **no input**: `pointer-events: none`, no key handler, and the route
  must keep walking under it. One notice at a time: a second notice replaces the
  first and restarts its hold, exactly as today.
- Scene events: `'pause'`/`'resume'` clear and restore the stack (a battle or the
  Settings screen covers the route; a paused route's notices must not float over the
  battle), `'shutdown'` disposes the mount. Spelled as strings, never a Phaser
  import; `descriptor.close` calls the same disposer.
- `src/scenes/panels/README.md`: the three bullets as described above.
- The i18n copy comes from `src/ui/notice.ts`'s factories (`areaEntryNotice`,
  `itemPickupNotice`, `levelUpNotice`, …) — the panel prints `Notice.text` and adds
  no string of its own; the mission line uses the shipped `hud.mission` key.

### Not the board's two extra rows

The board's `03l` (the level-up strip, 132 px tall, "LEARNED MOVES" plus the move
names) prints data `Notice` does not carry: a kind, an icon and the learned moves.
This task **does not** add them: `src/ui/notice.ts` and `RouteScene`'s call sites are
not its paths. The DOM strip is the board's `03k` shape for every notice, level-up
included, and the missing variant is recorded in **Coordination** as a follow-up.

## 🧩 Data and configuration

- One fixture: `design/fixtures/03k-panels-notice-item.json` with
  `{ "slug": "03k-panels-notice-item", "state": { party: [], bag: [], money: null,
  route: null, battle: null, notice: null }, "notice": { "text": "Obtained Potion!" },
  "mission": null, "area": null }` — the frame's own line (`Obtained Potion!`, the
  board prints it upper-cased by CSS, store it as the key's output,
  `t('notice.itemObtained', { name: 'Potion' })` → `Obtained Potion!`).
- No `03l` fixture: its frame belongs to the un-implemented variant above.
- No new i18n key, no `src/i18n` edit.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; green, including `view.test.ts` and
    `fixture.test.ts`.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-137` audited against the exclusive paths —
    in particular, `src/scenes/panels/README.md` must be the **only** README touched
    outside the new folder, and its diff must be the three bullets.
  - One `[live]` criterion (the strip on screen); the rest are `[unit]`.
- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` is clean and the new folder imports no Phaser and no
        scene module.
  - [ ] `[unit]` `noticesPanelView` is pure and total; each card's box never leaves
        the viewport (assert the four edges at 1280×800, 390×844, 560×800).
  - [ ] `[unit]` At 1280×800 the strip is `(280,24,720,56)`, the mission
        `(460,88,360,32)` and the area banner `(460,128,360,64)`; at 390×844 they are
        `(8,47,374,56)`, `(8,111,374,32)`, `(8,151,374,64)` — asserted against
        `design/frames/03k-panels-notice-item.json` for the strip and against these
        numbers for the two cards the board does not carry.
  - [ ] `[unit]` The safe area is the source: the phone top equals
        `design/tokens.json`'s `safeArea.top` (47), not a literal copied twice.
  - [ ] `[unit]` `fixture.test.ts` pins the fixture: the text, the strip's rect and
        that `area`/`mission` render nothing when null.
  - [ ] `[unit]` `noticesDrawnObjectCount()` is 0 with the flag on and the shipped
        count with it off.
  - [ ] `[unit]` `src/ui/notice.ts`, `RouteScene.ts` and the i18n tables are
        untouched by the branch.
  - [ ] `[live]` **The strip lands on the board's rect and clears the safe area.**
        Measurement: `CHROME_PATH=/usr/bin/chromium npm run dev`, open
        `http://127.0.0.1:<port>/?hud=dom`, reach a route (Enter ×3: new run, seed,
        starter), then via CDP `Runtime.evaluate` (`awaitPromise: true`):
        `const m = await import('/src/main.ts'); const r = m.game.scene.getScene('Route'); const n = await import('/src/scenes/panels/notices.ts'); n.showNotice(r.panelHost, { text: 'Obtained Potion!', holdMs: 2600 });`
        — read `document.querySelector('[data-hud-panel="notices"] [data-hud-notice]').getBoundingClientRect()`
        and require `(280,24,720,56)` within 2 px at 1280×800 and `x = 8`,
        `y = 47`, `w = 374`, `h = 56` at 390×844; then
        `n.noticesDrawnObjectCount() === 0` on the same page and `> 0` with `?hud`
        absent; then re-read the same element after 3 s and require it hidden
        (`hidden === true` or `getBoundingClientRect().height === 0`), proving the
        hold is the shipped `holdMs`. Report both rects and the timed result verbatim.

## 📣 Coordination

- For the Architect: the level-up variant of the board (`03l`, 132 px, learned-move
  rows) is **not** shipped here — it needs a `Notice` kind/icon and the learned-move
  list at the caller (`src/ui/notice.ts` + `RouteScene`), which this batch does not
  claim. Register it as a follow-up if the human wants the board's two rows.
- For the next batch: the panel carries `data-hud-panel="notices"` and one
  `[data-hud-notice]` / `[data-hud-area]` / `[data-hud-mission]` node each;
  `noticesDrawnObjectCount` is the live probe. `src/scenes/panels/README.md` is
  written by this task for the whole batch.

## ⛔ Out of scope

- `src/ui/notice.ts`, `RouteScene.ts`, any i18n table, the level-up strip's extra
  rows, any other panel, `src/scenes/panels/README.md`'s bullets outside the three
  named, `src/ui/hud/panels/README.md` (already lists `notices/`), `docs/**`,
  `package.json`, `src/main.ts`, `src/data/**`.
- The typewriter beat: notices are plain text today and stay plain text.
