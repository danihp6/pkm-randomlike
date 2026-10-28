# Spec: Task-201 — The main menu's oval shows the board's gradient

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** data + Phaser-side panel (the DOM HUD's main menu; no engine rule).
- **Role:** Dev.
- **Objective:** after this task the main menu's backdrop is the board's **soft radial
  glow** instead of a flat, hard-edged ellipse. The oval's box and its gradient stops become
  data in the panel's pure view model (`MAIN_MENU_GLOW` + `glowBackground`), and
  `main-menu.css`/`mainMenuPanel.tsx` paint that one gradient, so the geometry has a single
  source and a test can pin it. Today `.main-menu__glow` is a 1000×720 box with
  `border-radius: 50%` and a flat `rgb(125 211 252 / 10%)` fill — one hard rim, no falloff —
  while frame `01` draws a soft glow that fades to nothing.
- **Environment:** worktree `../wt-pkm-201`, branch `task-201`.
- **Dependencies:** `[Task-198]` (merged: the decorative route window inside the same panel
  and the same `MainMenuView`) and `[Task-199]` (merged: `liveMainMenuView`'s records/version
  arguments and the footer). Both are on `main`; this task reads their shipped surface and
  extends it.

### Exclusive paths (single writer)

The list of paths this task creates or modifies. **Nothing outside this list.**

- `src/ui/hud/panels/main-menu/view.ts`
- `src/ui/hud/panels/main-menu/view.test.ts`
- `src/ui/hud/panels/main-menu/main-menu.css`
- `src/ui/hud/panels/main-menu/mainMenuPanel.tsx`
- `docs/hud-fidelity.md` — **only** §5's new `**The main menu's glow.**` block (see
  *Coordination*: two other tasks of this batch write other blocks of §5).

`src/scenes/MainMenuScene.ts`, `src/data/**`, `package.json`, `src/main.ts` and
`vite.config.ts` are **not** this task's. Do not touch them.

### Inputs (read-only)

- `docs/hud-fidelity.md` (§3 export rules, §6 the frame → node map, §9 portraits).
- `design/screens/01-main-menu.png` and `design/frames/01-main-menu.json` (the board's
  glow: an ellipse **1000 × 720 at (−180, −140)**, accent at **10 %**).
- `src/ui/hud/panels/main-menu/{README.md,index.ts,mount.tsx,preview.ts,routeWindow.ts,version.ts,fixture.test.ts}`
  and `design/fixtures/01-main-menu.json` (read only — this task does **not** edit the
  fixture).
- `src/ui/hud/kit/**` (the `Panel` skin the card uses).
- `src/i18n/en.ts` (no new key is needed: the glow carries no text).

## 🔒 Contract

### TypeScript

`src/ui/hud/panels/main-menu/view.ts` gains, in the same style as `MAIN_MENU_BOARD`
(`Rect` is already exported there):

```ts
/** One stop of the oval's radial gradient; `at` is 0…1 of the gradient's radius. */
export type MainMenuGlowStop = Readonly<{ at: number; color: string }>;

/** The board's oval: its box in stage coordinates and the stops that fade it out. */
export type MainMenuGlow = Readonly<{
  box: Rect;
  stops: readonly MainMenuGlowStop[];
}>;

/** The board's `01` oval: 1000 × 720 at (−180, −140), accent 10 % at the mean. */
export const MAIN_MENU_GLOW: MainMenuGlow;

/** The CSS value the panel paints: one `radial-gradient`, never a flat fill. */
export function glowBackground(glow: MainMenuGlow): string;
```

Frozen values (`MAIN_MENU_GLOW` exactly):

- `box: { x: -180, y: -140, w: 1000, h: 720 }`
- `stops: [{ at: 0, color: 'rgb(125 211 252 / 22%)' }, { at: 0.45, color: 'rgb(125 211 252 / 10%)' }, { at: 1, color: 'rgb(125 211 252 / 0%)' }]`

`glowBackground(glow)` returns, for every input, this exact shape (no spaces around
commas beyond the ones shown, `closest-side`, percentages rounded to at most two decimals
and trailing `.00` dropped):

```text
radial-gradient(closest-side, rgb(125 211 252 / 22%) 0%, rgb(125 211 252 / 10%) 45%, rgb(125 211 252 / 0%) 100%)
```

For `MAIN_MENU_GLOW` the returned string is **exactly** that literal; a test compares it
with `toBe`. `closest-side` on this 1000×720 box yields the ellipse's own 500 × 360 radii,
which is why the old `border-radius: 50%` box and this gradient are the same shape.

`MainMenuView` gains one field:

```ts
export type MainMenuView = Readonly<{
  // … the shipped fields (title, version, rows, portraits, stats, selected, previewSeed)
  /** The backdrop's oval; always present, so the panel never invents geometry. */
  glow: MainMenuGlow;
}>;
```

- `liveMainMenuView(...)` sets `glow: MAIN_MENU_GLOW`. Its shipped parameters, defaults and
  return values do not change otherwise, and it stays pure (no clock, no RNG, no DOM).
- `fixtureMainMenuView(payload)` sets `glow: MAIN_MENU_GLOW` too — the frame payload in
  `design/fixtures/01-main-menu.json` carries no glow and **must keep working unedited**.
  A payload field of its own is not read; the oval is board geometry, not fixture data.
- `forLayout(view, 'compact')` returns the object unchanged apart from the CONTINUE row it
  already rewrites: the glow is the same at both widths (the stage scales, the box does not).

`src/ui/hud/panels/main-menu/mainMenuPanel.tsx`:

- `.main-menu__glow` keeps its class and gains `data-hud-main-menu-glow`, and its inline
  style is `left/top/width/height` from `view.glow.box` plus
  `backgroundImage: glowBackground(view.glow)`.
- No other node is added, removed or renamed.

`src/ui/hud/panels/main-menu/main-menu.css`:

- `.main-menu__glow` keeps `position: absolute;` **only**. Its `top`, `left`, `width`,
  `height`, `border-radius` and `background` declarations are deleted, so the box and the
  paint have exactly one source (the view). Nothing else in the file changes.

- **Determinism:** reads no RNG and no clock. Same `MainMenuView` ⇒ same style string.
- **Rules:** no Phaser import anywhere in `src/ui/**`; no DOM API in `view.ts`; the module
  stays importable by a headless test.

### Data

- No JSON, no i18n key and no `src/data/**` entry is added or changed. The gradient's three
  colours are the shipped accent `#7dd3fc` written as `rgb(125 211 252 / a%)`, the same
  colour the old flat fill used, so the backdrop's mean brightness is the board's 10 %.

## 🧩 Data and configuration

| value | where | meaning |
| --- | --- | --- |
| `{ x: -180, y: -140, w: 1000, h: 720 }` | `MAIN_MENU_GLOW.box` | the board `01` oval, stage coordinates |
| `0` / `22 %` | stop 0 | the glow's centre, brighter than the old flat fill so the falloff keeps the same mean |
| `0.45` / `10 %` | stop 1 | the board's measured accent alpha |
| `1` / `0 %` | stop 2 | the rim reaches nothing, which is the softness the report asks for |
| `closest-side` | `glowBackground` | the gradient's radii are the box's nearest sides (500 × 360 at this box) |

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-201` — every path must be in the exclusive list above.
  - This task has **one** `[live]` criterion; the rest are `[unit]`.

- **Acceptance criteria:**
  - [ ] `[unit]` `npm test` is green and `view.test.ts` contains a test that
        `glowBackground(MAIN_MENU_GLOW)` `toBe`s the exact string
        `radial-gradient(closest-side, rgb(125 211 252 / 22%) 0%, rgb(125 211 252 / 10%) 45%, rgb(125 211 252 / 0%) 100%)`.
  - [ ] `[unit]` `liveMainMenuView(null, 0)` and `liveMainMenuView(run, 1, 'seed', records, 'v1')`
        both return `glow` deep-equal to `MAIN_MENU_GLOW`, and `fixtureMainMenuView` on the
        **unedited** `design/fixtures/01-main-menu.json` payload (read with
        `readFileSync` + `JSON.parse` in `view.test.ts`) returns the same `glow`.
  - [ ] `[unit]` `forLayout(view, 'compact').glow` is `view.glow` and every other compact
        rule still holds (the shipped `forLayout` tests stay green).
  - [ ] `[unit]` no new `border-radius: 50%` and no `rgb(125 211 252 / 10%)` background
        remains for `.main-menu__glow`: `grep -n "main-menu__glow" -A6 src/ui/hud/panels/main-menu/main-menu.css`
        shows a block whose only declarations are `position: absolute;`.
  - [ ] `[unit]` `npm run build` is green and `git diff --name-only main...task-201` lists
        only the five paths above.
  - [ ] `[live]` **Measured with the browser driver** (Playwright/CDP) at
        `http://localhost:5175/?hud=dom` (`npm run dev`), viewport **1280×800**:
        `document.querySelector('[data-hud-main-menu-glow]')` exists,
        `getComputedStyle(el).backgroundImage` **starts with** `radial-gradient(`, its
        `getBoundingClientRect()` is `{ left: -180, top: -140, width: 1000, height: 720 }`
        (the stage is unscaled at this width), and a screenshot's pixel at **(320, 210)**
        is at least **4** higher in the green channel than the pixel at **(900, 210)**,
        while **(812, 210)** and **(828, 210)** — 8 px either side of the retired rim at
        x = 820 — differ by at most **6** per channel. Read the pixels with `pngjs`
        (already a dev dependency). At **390×844** the same node exists, its rect is still
        `width: 1000` × `height: 720` (the stage is a fixed 1280×800 page, centred and
        clipped, and carries no scale), and its computed `background-image` is the same
        radial gradient — i.e. no `border-radius` ellipse is left behind at either width.

## 📣 Coordination

- **For the Architect / Integration QA:** this task writes **only** §5's new
  `**The main menu's glow.**` block of `docs/hud-fidelity.md`, inserted between the
  `**Chips.**` block and the `**The pad**` block. `[Task-207]` inserts
  `**The route header's readouts.**` after `**The target step's prompt.**` and `[Task-212]`
  appends to `**Battle zones.**`; the three hunks are disjoint, and Integration QA reads the
  combined §5 for lost lines.
- **For the next batch:** the glow's box and stops are now data. `[Task-211]` (a fifth row)
  and `[Task-208]` (the panel shell) must not re-add a `border-radius` oval; they read
  `MAIN_MENU_GLOW` and leave it alone. `[Task-200]` deletes the canvas chrome only — this
  layer is DOM and survives it.
- **For the Orchestrator:** `src/scenes/MainMenuScene.ts` belongs to `[Task-210]` in this
  batch, not here. If the dev finds a Phaser ellipse in that scene, report it in the task
  summary instead of editing the file.
- **No `SAVE_VERSION` step**, no draw, no save write.

## ⛔ Out of scope

- Any change to the route window, the walkers, the card, the rows, the footer or the version
  line.
- A blur (`backdrop-filter`): Phaser-free CSS only, and the board's glow is a gradient.
- The canvas main menu (`src/scenes/MainMenuScene.ts`) and its own look.
- `design/fixtures/**` and `design/frames/**`: read only.
- New i18n keys, new dependencies, new files.
