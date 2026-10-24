# Spec: Task-138 — The pause panel is the HUD's

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene + DOM panel migration (`D49`, `docs/tech-decisions.md`).
- **Role:** Dev.
- **Objective:** the pause menu's **card** stops being drawn by Phaser under
  `?hud=dom` and becomes the board's card in the HUD's Preact layer
  (`src/ui/hud/panels/pause/`): a centred 360 × 200 card with a 55 % scrim, a title,
  a hairline, a divider and **two pressable rows** (`Settings`, `Reset run`). The scene
  module `src/scenes/panels/pause.ts` keeps *everything else* — the open/closed state,
  the selected row, the two-press Reset arming, the reset hold, the key routing and the
  `descriptor` — and loses only the drawing. With the flag off the shipped Phaser card
  keeps drawing exactly as today. After this task, a route under `?hud=dom` shows the
  board's pause card, and a route without it shows the shipped one, from the same
  module, with no change to any other panel, scene or engine file.
- **Environment:** worktree `../wt-pkm-138`, branch `task-138`. Linux, headless CI:
  `npm test` (Vitest, node environment — **no jsdom**) and `npm run build` must run with
  no browser; only the `[live]` checks need Chrome. Assets live outside
  the checkout under `$ASSETS_ROOT` (or `sprite-sources/`) and are never symlinked or
  junctioned into a worktree; this task adds no asset, so a clean clone with
  `src/assets/placeholders/` builds.
- **Dependencies** (all merged; each row names the file this task reads):
  - **[Task-127] Options (`02`) is the spike, and the spike is the gate.**
    `src/ui/hud/panels/options/{view.ts,mount.tsx,preview.ts,index.ts}` — the view +
    mount + preview-installer shape this task copies.
  - **[Task-128] The route's panel layer leaves the route scene.**
    `src/scenes/panels/{types.ts,registry.ts}` and `RoutePanelHost.openSettings()` /
    `restartRun()` — the descriptor this task keeps and the two scene calls its rows make.
  - **[Task-124] The HUD shell mounts once and owns no Phaser object.**
    `src/ui/hud/mount.ts`, `src/ui/hud/shell.tsx`, `src/ui/hud/styles/root.css` (the
    `--hud-*` tokens), `src/ui/hud/fixtures/**` (`parseHudFlags`, `FIXTURE_MODULES`,
    `fixtureFor`, `isHudState`) and `src/ui/hud/panels/README.md` (the folder map that
    already lists `pause/`).
  - **[Task-125] The panel kit the board is made of.** `src/ui/hud/kit/**` — read for
    the board's row/card primitives and their measured geometry.

### Exclusive paths (single writer)

This task creates or modifies **only** these paths:

- `src/scenes/panels/pause.ts`
- `src/ui/hud/panels/pause/view.ts`
- `src/ui/hud/panels/pause/view.test.ts`
- `src/ui/hud/panels/pause/fixture.test.ts`
- `src/ui/hud/panels/pause/preview.ts`
- `src/ui/hud/panels/pause/preview.test.ts`
- `src/ui/hud/panels/pause/pausePanel.tsx`
- `src/ui/hud/panels/pause/pause.css`
- `src/ui/hud/panels/pause/mount.tsx`
- `src/ui/hud/panels/pause/index.ts`
- `src/ui/hud/panels/pause/README.md`
- `design/fixtures/03n-panels-pause-menu.json`
- `src/scenes/panels/README.md` — **one line only, claimed as a section**: the
  `pause.ts` role line (line 32, `- \`pause.ts\` — the pause menu and the
  hold-to-reset overlay.`). No other line, table or section of that file may change;
  Task-139 edits the `hud.ts` line in this same batch.

Deleting a stray `.gitkeep` from a directory this task populates is allowed. Nothing
else — no `registry.ts`, no `types.ts`, no `package.json`, no `src/main.ts`, no other
`src/scenes/**`, no `src/engine/**`, no `src/data/**`, no `src/i18n/**`, no `docs/**`,
no `design/frames/**`, no `design/screens/**`.

### Inputs (read-only)

- `AGENTS.md`, `docs/agent-spec-template.md`, `docs/tech-decisions.md` (`D49`,
  `D50`), `docs/hud-fidelity.md` (§2 type boxes, §4 palette, §5 panel geometry, §8 the
  gate), `docs/agent-ci.md` (the `dev: done` turnstile).
- `src/scenes/panels/pause.ts` (the shipped module being migrated — read it fully
  before rewriting it), `src/scenes/panels/types.ts`, `src/scenes/panels/README.md`,
  `src/scenes/RouteScene.ts` (only lines 320–330, 1295–1310, 1895–1918, 3326–3348 —
  the imports and calls this task must not break).
- `src/ui/hud/fixtures/{index.ts,flags.ts,registry.ts}`,
  `src/ui/hud/panels/{notices/rewards}/{view.ts,mount.tsx,index.ts,fixture.test.ts}`,
  `src/ui/hud/panels/options/{view.ts,mount.tsx,preview.ts,preview.test.ts}`,
  `src/ui/hud/panels/rewards/view.test.ts` (the `the live flag contract` block),
  `src/scenes/panels/{notices.ts,rewards.ts}` (the flag-on / flag-off scene shape),
  `src/ui/hud/styles/root.css`, `src/ui/hud/kit/{kit.css,classes.ts,row.tsx,panel.tsx}`,
  `src/i18n/en.ts` (`hud.menu`, `pause.settings`, `pause.reset`, `pause.resetArmed`).
- `design/frames/03n-panels-pause-menu.json`, `design/frames/m03n-panels-pause-menu.json`,
  `design/fixtures/03k-panels-notice-item.json` (the fixture envelope this task copies).
- `scripts/hud/README.md`, `scripts/hud/diff.mjs` (the harness, read-only).

## 🔒 Contract

Every name below is frozen. Another task in this batch (and the next) may be written
against it.

### 1. `src/ui/hud/panels/pause/view.ts` — the pure model

No Phaser, no DOM, no `HudState`, no engine, no RNG, no `document`, no `window`. Pure
and total: the same input always yields a deep-equal output and the input is never
written. It imports only `t` from `../../../../i18n` (the `options/view.ts` path).

```ts
export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;

/** The board's four rows are CONTINUE/OPTIONS/NEW RUN/EXIT; the game ships two. */
export type PauseRowId = 'settings' | 'reset';

export type PauseRowView = Readonly<{
  id: PauseRowId;
  /** The row's index in `PAUSE_ROW_IDS` order; what a press sends back. */
  index: number;
  /** `t('pause.settings')`, or `t('pause.resetArmed')` while Reset is armed. */
  label: string;
  selected: boolean;
  /** True only on the Reset row, and only after the first press. */
  armed: boolean;
  /** The row's own box, **card-relative**. */
  box: Rect;
  /** The label's box, **card-relative** (the board's 16 px line box). */
  labelBox: Rect;
}>;

export type PausePanelView = Readonly<{
  /** True while the menu is up. A closed card is `hidden` in the tree, not absent. */
  open: boolean;
  /** The full-stage scrim, **viewport** coordinates. */
  scrim: Rect;
  /** The card itself, **viewport** coordinates. */
  box: Rect;
  /** The 1 px line 12 px inside the card's top edge, card-relative. */
  highlight: Rect;
  /** The 1 px rule under the title, card-relative. */
  divider: Rect;
  title: Readonly<{ text: string; box: Rect }>;
  /** Always exactly two rows, `[settings, reset]`, in this order. */
  rows: readonly PauseRowView[];
}>;

/** What the scene hands the live model: its own state, never a run or a battle. */
export type PauseInput = Readonly<{
  open: boolean;
  /** The cursor's row; clamped into `0…1` (a non-finite value lands on 0). */
  selected: number;
  /** True when `Reset run` was pressed once and awaits its second press. */
  armed: boolean;
}>;

/** The slug this task's fixture, its frame and `?hudFixture=` answer to. */
export const PAUSE_SLUG = '03n-panels-pause-menu';
export const PAUSE_ROW_IDS: readonly PauseRowId[] = ['settings', 'reset'];

/* The board's measured desktop card at 1280 × 800 (`design/frames/03n-panels-pause-menu.json`). */
export const PAUSE_CARD_W = 360;
export const PAUSE_CARD_H = 200; // 88 + PAUSE_ROW_PITCH × 2, the frame's own formula
export const PAUSE_CARD_RADIUS = 11;
export const PAUSE_MARGIN = 8; // the edge clamp, like REWARDS_MARGIN
export const PAUSE_HIGHLIGHT_INSET = 12; // the 1 px line
export const PAUSE_DIVIDER_TOP = 60; // card-relative, 1 px high
export const PAUSE_ROW_TOP = 76; // the first row's top, card-relative
export const PAUSE_ROW_H = 48;
export const PAUSE_ROW_PITCH = 56;
export const PAUSE_ROW_INSET = 24; // the card's side padding: 460 + 24 = 484

export const PAUSE_TITLE: Rect = { x: 24, y: 20, w: 200, h: 30 };
export const PAUSE_LABEL_INSET: Readonly<{ x: number; y: number; h: number }> = {
  x: 20,
  y: 17,
  h: 16,
};

/** The card's rect from the viewport: centred, held `PAUSE_MARGIN` off every edge. */
export function pausePanelBox(viewport: Viewport): Rect;

/** The live card: the two shipped rows, localised, on the board's geometry. */
export function pausePanelView(input: PauseInput, viewport: Viewport): PausePanelView;

/** The fixture card, or null when `payload` is not a payload this panel can draw. */
export function fixturePausePanelView(payload: unknown, viewport: Viewport): PausePanelView | null;
```

Rules the model must satisfy, exactly:

- **`pausePanelBox`** — `stageOf(viewport)` is `viewport` when both numbers are finite
  and > 0, else `{ width: 1280, height: 800 }` (the board's stage, as rewards does it).
  `w = min(PAUSE_CARD_W, max(160, stage.width - 2 * PAUSE_MARGIN))`,
  `h = min(PAUSE_CARD_H, max(120, stage.height - 2 * PAUSE_MARGIN))`,
  then `x`/`y` are `(stage - size) / 2` clamped into `[PAUSE_MARGIN, stage - size -
  PAUSE_MARGIN]`. Measured: `(460, 300, 360, 200)` at 1280 × 800 and `(15, 322, 360,
  200)` at 390 × 844.
- **`pausePanelView`** — `scrim = { x: 0, y: 0, w: stage.width, h: stage.height }`;
  `highlight = { x: 12, y: 12, w: box.w - 24, h: 1 }`;
  `divider = { x: 24, y: 60, w: box.w - 48, h: 1 }`;
  `title = { text: t('hud.menu'), box: PAUSE_TITLE }`; row `i` has
  `box = { x: 24, y: 76 + i * 56, w: box.w - 48, h: 48 }` and
  `labelBox = { x: 44, y: 93 + i * 56, w: box.w - 88, h: 16 }`; every width is derived
  from `box.w`, never from the 360 literal, so a clamped card still fits.
  `selected` is `clamp(trunc(selected), 0, 1)` with a non-finite value treated as 0.
  `armed` is true **only** on the `reset` row and only when `input.armed` is true; the
  `reset` label is then `t('pause.resetArmed')`, otherwise `t('pause.reset')`.
- **`fixturePausePanelView`** — returns null unless `payload` is a plain object whose
  `menu` is a plain object with: a non-empty string `title`; an integer `selected`
  (clamped as above); a boolean `armed`; and `rows` an array of exactly 2 objects whose
  `id`s are `'settings'` then `'reset'`, each with a non-empty string `label`. Anything
  else is null — never a throw. It paints the payload's `title`/`label`s verbatim (the
  board's own copy) on the same geometry as `pausePanelView`.

### 2. `src/ui/hud/panels/pause/mount.tsx` — the imperative controller

```ts
/** The card's whole command channel: plain data, and the scene owns every rule. */
export type PausePanelIntent = Readonly<{ type: 'row'; index: number }>;

/**
 * Mounts the card and its scrim into `host`, paints `view.value`, repaints once per
 * signal assignment, and returns the disposer. The disposer is idempotent: it stops
 * the subscription, renders `null` and removes its own container.
 */
export function mountPausePanel(
  host: Element,
  view: Signal<PausePanelView>,
  onIntent?: ((intent: PausePanelIntent) => void) | undefined,
): () => void;
```

- The mount paints `view.value` **once** before subscribing, so
  `[data-hud-panel="pause"]` exists from the moment the panel mounts even while closed.
- It creates exactly one child element of `host`: `<div class="pause-mount">`.
- It adds **no** keyboard listener. The pause menu's keys are the scene's
  (`RouteScene` → `descriptor.key` → `handlePauseMenuAction`); a DOM key path would
  double-fire them.
- Only a press on a row emits: `{ type: 'row', index }` with the row's own
  `PauseRowView.index`. Nothing else in the card answers.

### 3. `src/ui/hud/panels/pause/pausePanel.tsx` — the component

```ts
export type PausePanelProps = Readonly<{
  view: PausePanelView;
  onIntent?: ((intent: PausePanelIntent) => void) | undefined;
}>;

export function PausePanel(props: PausePanelProps): JSX.Element;
```

The rendered DOM is part of the contract (QA and the next panels select it):

| element | attributes / classes | notes |
| --- | --- | --- |
| scrim | `<div class="pause__scrim" data-hud-pause="scrim">` | `position: fixed`, the view's `scrim` rect, `pointer-events: none`; sibling **before** the card |
| root | `<div class="pause" data-hud-panel="pause" data-open="true\|false" hidden={!view.open}>` | `position: fixed`, the view's `box` rect, `pointer-events: auto` |
| body | `<div class="pause__body">` | `position: absolute; inset: -1px`, so card-relative rects land on the card's outer box (the card's 1 px border is real) |
| highlight | `<span class="pause__highlight" data-hud-pause="highlight">` | the view's `highlight` |
| title | `<span class="pause__title" data-hud-pause="title">` | the view's `title.text` / `title.box` |
| divider | `<span class="pause__divider" data-hud-pause="divider">` | the view's `divider` |
| row | `<button type="button" class="pause__row" data-hud-pause-row={index} data-selected="true\|false" data-armed="true\|false" aria-current={selected ? 'true' : undefined}>` | the view's `box`; `onClick` → `{ type: 'row', index }` |
| label | `<span class="pause__label">` | the view's `labelBox` and `label` |

Rows are positioned **absolutely** at their exact card-relative rects and are hand-rolled
buttons (`border: 0`, `box-shadow: inset 0 0 0 1px …`) so no real border shifts the
label by a pixel — the same reason `03f`'s rows are hand-rolled. `kit/Row` is **not**
composed: its selected state is the 72 % panel fill and its border is the card's
hairline, while the board's selected pause row is the accent at 16 % under a solid
accent 1 px edge.

### 4. `src/ui/hud/panels/pause/preview.ts` — the fixture card

```ts
/** True only when the URL asks for `?hud=dom&hudFixture=03n-panels-pause-menu`. */
export function pausePreviewRequested(search: string): boolean;

/**
 * Mounts the fixture card into `#hud` once and returns its disposer, or null when the
 * URL does not ask for it (or the layer/fixture is missing). Inert — no node, no
 * listener — otherwise.
 */
export function installPausePreview(search: string): (() => void) | null;
```

- It reads `design/fixtures/03n-panels-pause-menu.json` **statically**
  (`import payload from '../../../../../design/fixtures/03n-panels-pause-menu.json'`) and
  gates the mount on `installFixture(parseHudFlags(search), FIXTURE_MODULES)` plus
  `fixturePausePanelView(payload, { width: innerWidth, height: innerHeight })`.
- The mount **must be deferred**: `#hud` does not exist when this module is first
  evaluated (it is imported transitively by `main.ts`'s scene list, before
  `mountHud` runs). Attach in a `queueMicrotask`, and when
  `document.readyState === 'loading'` wait for `DOMContentLoaded` first — exactly
  `options/preview.ts` lines 48–63.
- Idempotent (`installed` flag) and idempotent on dispose. No `resize` listener.

### 5. `src/ui/hud/panels/pause/index.ts` — the barrel

```ts
export { PausePanel } from './pausePanel';
export type { PausePanelProps } from './pausePanel';
export { mountPausePanel } from './mount';
export type { PausePanelIntent } from './mount';
export { installPausePreview, pausePreviewRequested } from './preview';
export { PAUSE_HIGHLIGHT_INSET, PAUSE_TITLE, PAUSE_CARD_H, /* … */ } from './view';  // every constant above
export type { PauseInput, PausePanelView, PauseRowId, PauseRowView, Rect, Viewport } from './view';
```

The barrel is the **only** surface anything outside the folder imports, and it must
re-export every constant and type listed in §1 plus the four names above.

### 6. `src/scenes/panels/pause.ts` — the scene module

The exported surface **must not change**, because `src/scenes/RouteScene.ts` imports it
by name and this task may not edit the scene (lines 322–328):

```ts
export function pauseMenuOpenNow(): boolean;
export function openPauseMenu(host: RoutePanelHost): void;
export function closePauseMenu(): void;
export function handlePauseMenuAction(host: RoutePanelHost, action: KeybindAction): boolean;
export function updateReset(host: RoutePanelHost, delta: number, allowed: boolean): boolean;
export function hideResetOverlay(host: RoutePanelHost): void;
export const descriptor: RoutePanelDescriptor;
```

It **adds** exactly two exports, the flag seam every migrated panel carries:

```ts
/** The pause menu's own display objects; 0 under `?hud=dom`, where the card is the DOM panel's. */
export function pauseDrawnObjectCount(): number;
/** The Phaser card reports its own display-object count; under the flag it is discarded. */
export function notePauseDrawnObjects(count: number): void;
```

Behaviour, unchanged and now shared by both paths:

- `const DOM_HUD = typeof window === 'undefined' ? false : parseHudFlags(window.location.search).dom;`
  at module scope, read once (the way every scene module does it).
- Module state: `pauseMenuOpen`, `pauseMenuIndex`, `pauseMenuArmed`,
  `pauseMenuRows` (Phaser only), `resetHold`, `resetScrim`, `resetRing`; plus the DOM
  session `cardHost`, `cardView`, `cardDispose`, `shippedDrawnObjects`.
- `PAUSE_MENU_ITEMS = ['settings', 'reset']` stays the single source of the rows;
  `PAUSE_MENU_LABELS` (`pause.settings` / `pause.reset`) and `pause.resetArmed` stay
  the only labels.
- `descriptor.id` stays `'pause'`, `descriptor.order` stays `100`.
- `descriptor.build(host)` resets every module variable, builds the **reset overlay
  unconditionally** (`buildResetOverlay`, untouched) and then branches: `DOM_HUD` →
  build the DOM session (`cardHost = host`, a `signal(pausePanelView({ open: false,
  selected: 0, armed: false }, viewport(host)))`, and `mountPausePanel(#hud layer,
  view, intent => handlePauseIntent(host, intent))` when the layer exists **and**
  `pausePreviewRequested(search)` is false); otherwise `buildPauseMenu(host)` exactly
  as today.
- `descriptor.close(host)` is **added** and calls the DOM disposer — the card lives
  outside Phaser and the route scene is restarted on every new run.
- `descriptor.key(host, action)` keeps `handlePauseMenuAction` verbatim: `up`/`down`
  move the cursor and disarm, `confirm` activates, `cancel` closes, anything else
  returns `false`.
- `openPauseMenu` still calls `cancelNicknameEdit(host)`, sets `open = true`,
  `index = 0`, `armed = false`, shows the container (flag off) or paints (flag on).
  `closePauseMenu()` takes **no** argument: it hides the container or paints through
  `cardHost`.
- `activatePauseMenu(host)` keeps its rule: `settings` closes the menu and calls
  `host.openSettings()`; `reset` arms on the first press (repaint, no restart) and, on
  the second, closes the menu and calls `host.restartRun()`.
- `handlePauseIntent(host, intent)` (internal) is the DOM's twin of the shipped
  `pointerdown` zone: it ignores an index outside `0…1`, sets `pauseMenuIndex`,
  `pauseMenuArmed = false`, then calls `activatePauseMenu(host)`.
- **Totality:** every function is safe when `build` has not run and when `document` is
  absent (`pauseMenu === null`, `cardView === null` → the paint no-ops). The headless
  tests below rely on it.
- The module calls `installPausePreview(search)` once at module scope, with
  `search = typeof window === 'undefined' ? '' : window.location.search` — the
  `SettingsScene.ts` line 92 pattern.

Reads no RNG, writes no run and touches no engine file: the same seed, the same save.

### 7. `design/fixtures/03n-panels-pause-menu.json` — the payload (exact shape)

```json
{
  "slug": "03n-panels-pause-menu",
  "state": { "party": [], "bag": [], "money": null, "route": null, "battle": null, "notice": null },
  "menu": {
    "title": "MENU",
    "selected": 0,
    "armed": false,
    "rows": [
      { "id": "settings", "label": "Settings" },
      { "id": "reset", "label": "Reset run" }
    ]
  }
}
```

`state` is the empty `HudState` envelope every panel fixture carries (it must pass
`isHudState` with exactly the six keys in that order); the card's own content is the
`menu` block, which is **not** a `HudState` field. The labels are the live English
strings (`t('pause.settings')`, `t('pause.reset')`) — the board's CONTINUE/OPTIONS/NEW
RUN/EXIT are four rows the game does not ship, so the card keeps its two and takes the
board's geometry only.

## 🧩 Data and configuration

- **New data file:** `design/fixtures/03n-panels-pause-menu.json`, keys `slug`, `state`,
  `menu.{title,selected,armed,rows[].{id,label}}` with the shapes above. It is
  auto-registered by `import.meta.glob('../../../../design/fixtures/*.json')` in
  `src/ui/hud/fixtures/registry.ts` — **no shared file is edited**.
- **No new i18n key.** The card reuses `hud.menu`, `pause.settings`, `pause.reset` and
  `pause.resetArmed`; `src/i18n/**` is out of scope.
- **No new engine, save or settings value.** No `SAVE_VERSION` step.
- **The board's paint**, written once as scoped custom properties on `.pause` in
  `pause.css` (the panel tokens in `root.css` carry the kit's alphas, not this card's):
  `--pause-panel-fill: rgb(16 22 31 / 92%)`, `--pause-panel-border: rgb(255 255 255 /
  16%)`, `--pause-highlight: rgb(255 255 255 / 14%)`, `--pause-divider: rgb(255 255 255
  / 8%)`, `--pause-scrim: rgb(5 7 12 / 55%)`, `--pause-row-fill: rgb(255 255 255 / 4%)`,
  `--pause-row-border: rgb(255 255 255 / 10%)`, `--pause-row-selected-fill: rgb(125 211
  252 / 16%)`. Radii 11 (card) / 8 (row); type from `root.css`: title
  `--hud-type-hero-size`/`-line` (24/31) Bold `--hud-text-ink`, labels
  `--hud-type-name-size`/`-line` (12/15), selected label `--hud-accent`, the other
  `--hud-text-secondary`.
- **The measured table** (1280 × 800, page px) the tests and QA read:

  | thing | x | y | w | h |
  | --- | --- | --- | --- | --- |
  | scrim | 0 | 0 | 1280 | 800 |
  | card | 460 | 300 | 360 | 200 |
  | highlight | 472 | 312 | 336 | 1 |
  | title `MENU` | 484 | 320 | 200 | 30 |
  | divider | 484 | 360 | 312 | 1 |
  | row 0 `Settings` | 484 | 376 | 312 | 48 |
  | row 1 `Reset run` | 484 | 432 | 312 | 48 |
  | label 0 | 504 | 393 | 272 | 16 |
  | label 1 | 504 | 449 | 272 | 16 |

  (The frame's own numbers are these same rows 56 px apart with a 312 px card; the card
  is 112 px shorter than the board's four-row 312 px because the game ships two rows —
  the board's formula `88 + 56 × rows` gives 200, and the frame's title/divider/row
  offsets above the first row are kept unchanged. `03n`'s scrim, card fill, highlight
  14 %, divider 8 %, row 16 %/4 % and label colours are the card's, verbatim.)

## 🧪 Test and Validation Plan (for QA)

### Method

Run in the task's integration worktree (branch `task-138` merged onto the batch base):

1. `npm test` — Vitest, headless, no browser, no jsdom. Must be green **including** the
   three new files.
2. `npx vitest run src/ui/hud/panels/pause` — the three new files alone; report the file
   and test counts.
3. `npm run build` — `tsc --noEmit && vite build`; must be clean.
4. `git diff --name-only main...task-138` — audit against the exclusive paths list;
   `src/scenes/panels/README.md` must show a **one-line** diff (`git diff main...task-138
   -- src/scenes/panels/README.md` prints exactly one `-` line and one `+` line).
5. The `[live]` checks: `npm run dev` (or the built preview) with Chrome. If the runner
   has no Chrome, mark them **not run** and say so; do not fake them. The screenshot
   harness is `node scripts/hud/diff.mjs --slug 03n-panels-pause-menu` (needs
   `npm run build` first, and `CHROME_PATH` on Linux); it writes
   `design/diff/03n-panels-pause-menu/{1280x800,390x844}.{shot,diff}.png` and
   `report.json`. **It is named so the artifact exists, not as this task's gate:** the
   reference PNGs carry the board's route screenshot behind the card (`D50`), which no
   fixture boot reproduces, so its own PASS is not expected. The DOM measurements below
   are the gate, per `docs/hud-fidelity.md` §8 (geometry by measurement, text by box and
   colour).
6. A note on the fixture string check: the labels are read through `t()`, so a profile
   with a stored Spanish locale prints `MENÚ` / `Ajustes` / `Reiniciar partida`. Use a
   fresh profile (or read `t('pause.settings')` in the page console) before quoting the
   English strings.

### Acceptance criteria

- [ ] `[unit]` `npm run build` is clean (`tsc --noEmit` and `vite build`), and no file
      under `src/ui/hud/panels/pause/` imports Phaser:
      `grep -rn "from 'phaser'" src/ui/hud/panels/pause` prints nothing. Only
      `view.test.ts` may import the scene module (`../../../../scenes/panels/pause`);
      `view.ts`, `pausePanel.tsx`, `mount.tsx`, `preview.ts` and `index.ts` import no
      file under `src/scenes/`.
- [ ] `[unit]` The three new test files exist and pass: `src/ui/hud/panels/pause/view.test.ts`,
      `fixture.test.ts`, `preview.test.ts` (`npx vitest run src/ui/hud/panels/pause`
      reports 3 files passed), and `npm test` is green as a whole.
- [ ] `[unit]` `pausePanelBox` gives `{ x: 460, y: 300, w: 360, h: 200 }` at
      `{ width: 1280, height: 800 }` and `{ x: 15, y: 322, w: 360, h: 200 }` at
      `{ width: 390, height: 844 }`; a zero/`NaN` viewport falls back to the board's
      stage.
- [ ] `[unit]` The model pins the measured table: card, highlight, divider, title box
      and text `MENU`, rows at card-relative y 76/132 with `w = box.w - 48`, pitch 56,
      `h = 48`, labels at card-relative `(44, 93)`/`(44, 149)` with `w = box.w - 88`,
      `h = 16`; `selected` clamps (`5 → 1`, `-3 → 0`, `NaN → 0`); `armed: true` renames
      only row 1 to `t('pause.resetArmed')`; a closed view (`open: false`) keeps the same
      geometry; the input object is unchanged after the call and two calls with the same
      input are deep-equal.
- [ ] `[unit]` `design/fixtures/03n-panels-pause-menu.json` passes `isHudState` on its
      `state` with exactly `['party', 'bag', 'money', 'route', 'battle', 'notice']`, its
      `slug` is `03n-panels-pause-menu`, its labels equal `t('pause.settings')` and
      `t('pause.reset')`, and `fixturePausePanelView` reproduces the frame node by node:
      `pause scrim`, `pause panel`, `pause panel highlight`, `pause divider`,
      `pause title` (+ `characters`), `pause row 0`, `pause row 1`, `pause label 0`,
      `pause label 1` (every rect equal, `toEqual`, no tolerance) from
      `design/frames/03n-panels-pause-menu.json`.
- [ ] `[unit]` `fixturePausePanelView` returns `null` (never throws) for: a non-object; a
      missing `menu`; a `menu` whose `rows` has 1 or 3 entries; rows whose ids are
      swapped; a non-string or empty label; a non-integer `selected`; a non-boolean
      `armed`.
- [ ] `[unit]` `src/scenes/panels/pause.ts` still exports the frozen surface:
      `descriptor.id === 'pause'`, `descriptor.order === 100`, `descriptor.close` is a
      function, and `descriptor.key(stubHost, action)` returns `true` for `up`, `down`,
      `confirm`, `cancel` and `false` for `interact` (a stub host is enough: the spec's
      §6 "Totality" rule makes the module safe with no `build` and no `document`).
- [ ] `[unit]` The rows still run the scene's own paths, headless, through the
      descriptor: from a fresh `openPauseMenu(stub)`, `down` then `confirm` arms Reset
      and calls **no** `restartRun`; a second `confirm` calls `restartRun()` exactly once
      and leaves `pauseMenuOpenNow() === false`; `up` then `confirm` selects Settings and
      calls `openSettings()` once; `cancel` closes.
- [ ] `[unit]` The flag contract: with `window.location.search === '?hud=dom'` stubbed and
      the module imported fresh (`vi.resetModules()`), `notePauseDrawnObjects(9)` leaves
      `pauseDrawnObjectCount() === 0`; with no flag, `notePauseDrawnObjects(9)` gives 9
      and `notePauseDrawnObjects(-4)` gives 0.
- [ ] `[unit]` `pausePreviewRequested` is `true` only for `?hud=dom&hudFixture=03n-panels-pause-menu`
      (any order, case-insensitive, `?` optional) and `false` for `?hud=dom`,
      `?hudFixture=03n-panels-pause-menu` without `hud=dom`, and another slug.
- [ ] `[unit]` Nothing outside the exclusive paths changed: the `git diff --name-only
      main...task-138` output is a subset of the list in **Exclusive paths**, and
      `src/scenes/panels/README.md` shows one changed line.
- [ ] `[live]` At `http://127.0.0.1:<port>/?hud=dom&hudFixture=03n-panels-pause-menu`,
      viewport 1280 × 800 **exactly** (`Emulation.setDeviceMetricsOverride` width 1280,
      height 800, deviceScaleFactor 2, mobile false — the harness's own call), read the
      DOM: `document.querySelector('[data-hud-panel="pause"]').getBoundingClientRect()`
      is `{ left: 460, top: 300, width: 360, height: 200 }` within **±2 px**;
      `[...document.querySelectorAll('[data-hud-pause-row]')].map(r =>
      r.getBoundingClientRect())` is `[{484,376,312,48},{484,432,312,48}]` within ±2 px
      on each number, i.e. a **pitch of 56 ± 2 px**; and `getComputedStyle` on the card,
      row 0 and row 1 returns background colours whose RGB(A) is within **ΔE 2** of the
      frame's own values (`pause panel` 92 % of `rgb(16,22,31)`, `pause row 0` 16 % of
      `rgb(125,211,252)`, `pause row 1` 4 % of `rgb(255,255,255)`); the title prints
      `MENU` and the two rows print `Settings` / `Reset run`.
- [ ] `[live]` In the running game with the flag on (`/?hud=dom`, new run, on a route):
      `ESC` opens the card and the route stops walking;
      `getComputedStyle(document.querySelector('[data-hud-pause="scrim"]')).pointerEvents`
      is `none`, and a click at page `(100, 100)` (well outside the card) leaves the menu
      open and changes nothing; `ESC` closes it; pressing the `Reset run` row once leaves
      the run in place and re-labels the row `Reset run - press again`, and a second
      press on the same row starts a new run (Starter screen). Repeating the same on a
      route **without** `?hud=dom` shows the shipped Phaser card and the identical row
      behaviour.

## 📣 Coordination

- **For the Architect:** the pause card's content is the game's **two** rows
  (`Settings`, `Reset`), not the board's four (CONTINUE/OPTIONS/NEW RUN/EXIT); the card
  keeps the board's geometry and paint, so the fixture's labels are the live i18n
  strings, exactly as `03k` folds the notice strip's copy. The hold-to-reset overlay
  (the pie + the fade scrim) stays in Phaser and is **not** part of the migration; the
  board defines no such control, and `D49`'s escape hatch keeps it in the canvas.
- **For Task-139 (same batch):** this task claims **one line** of
  `src/scenes/panels/README.md` (the `pause.ts` line) and nothing else in it; the
  `hud.ts` line, the `D49` addendum in `docs/tech-decisions.md`, `src/scenes/panels/hud.ts`
  and `src/ui/hud/panels/hud/**` are untouched here. The registration of
  `design/fixtures/03n-panels-pause-menu.json` needs no registry edit — the glob picks
  it up, so a new fixture never collides.
- **For every later panel in the phase:** the pause module is the first scene module
  whose DOM card is mounted for the **scene's lifetime** and merely hidden while closed
  (notices does the same; rewards/shop mount per opening). `descriptor.close` unmounts
  it. Copy that shape for any panel that opens and closes many times.
- **For the next batch:** the frozen names are `mountPausePanel`, `PausePanel`,
  `PausePanelIntent`, `pausePanelView`, `fixturePausePanelView`, `pausePanelBox`,
  `PAUSE_SLUG`, the `PAUSE_*` constants and the `data-hud-pause*` attributes. The
  module's existing exports (`openPauseMenu`, `closePauseMenu`, `pauseMenuOpenNow`,
  `handlePauseMenuAction`, `updateReset`, `hideResetOverlay`, `descriptor`) are
  unchanged, so `src/scenes/RouteScene.ts` keeps compiling untouched; the two new ones
  are `pauseDrawnObjectCount()` and `notePauseDrawnObjects(count)`.
- **Z-order:** the pause mount is created in `descriptor.build`, which runs last
  (`order: 100`), so its container is the last child of `#hud` and paints above every
  other panel. Do not add a `z-index`.
- **Known limitation, shipped everywhere:** the card is laid out when it opens (or
  mounts) and does not follow a window resize while it is up. `notices`, `rewards` and
  `shop` behave the same; do not add a resize listener here.
- **Environment:** Linux, headless. `npm test` must not need a browser or jsdom; the
  Vitest environment has **no `document`**, so the component is covered by the `[live]`
  diff, never by a render test. Assets are read from `$ASSETS_ROOT` at pack time and are
  never linked into the worktree; this task needs no pack.

## ⛔ Out of scope

- **The hold-to-reset overlay** (`resetScrim`, `resetRing`, `drawResetOverlay`,
  `fadeResetOverlayIn`, `updateReset`, `hideResetOverlay`): untouched, still Phaser,
  still depth 400/401. The board defines no such control.
- **The phone sheet `m03n`**: its 374 × 384 sheet, grab handle, `ROUTE 3 · PAUSED`
  subtitle, ✕ and 52 px rows describe a four-row menu the game does not ship. This task
  paints the desktop card at every viewport (width clamped by `PAUSE_MARGIN`, so it fits
  390 px). No second layout, no sheet variant, no `mobile` fixture block.
- **A fourth row, a subtitle, a close button or a scrim press**: the shipped menu has
  two rows, no close control and a non-interactive scrim; adding any of them is a
  gameplay change and not this task.
- **`src/scenes/RouteScene.ts`**, `src/scenes/panels/registry.ts`, `types.ts`,
  `src/main.ts`, `package.json`, `vite.config.ts`, `src/i18n/**`, `docs/**`,
  `design/frames/**`, `design/screens/**`, `design/tokens.json`: none is edited.
- **Any engine, save, RNG, battle or data-table change.** No `SAVE_VERSION` step, no
  seed re-pin.
- **`src/ui/hud/panels/README.md`** (Task-124's map, already lists `pause/`) and every
  other panel's folder.
- **The `hud.play` awaited bridge**: the pause has no timed beat, so this task calls and
  defines none.
- **Restyling the shipped Phaser card.** With the flag off it must draw exactly as
  today; the only change on that path is that it is built inside the same `build` branch
  as before.
- **A new dependency.** Preact and `@preact/signals` are already installed; nothing new
  is added for this task.

### The dev's exit

1. `npm test` green and `npm run build` clean on `task-138`.
2. Commit the work on `task-138` (the spec is the branch's first commit, force-added,
   since `.agent_specs/` is gitignored) and push: `git push -u origin task-138`.
3. Then the turnstile: `git commit --allow-empty -m "dev: done task-138"` and
   `git push origin task-138`. The tip's subject is what the Orchestrator reads.
4. **No merge, no version bump, no `SAVE_VERSION` change, no engine file.** `main` moves
   only through the Orchestrator's batch merges after QA.
