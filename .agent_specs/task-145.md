# Spec: Task-145 — The main menu is the HUD's (`01`, `01b`)

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene + DOM panel (`D49` migration).
- **Role:** Dev.
- **Objective:** `src/ui/hud/panels/main-menu/` renders the main menu (`01` with a save,
  `01b` without) as Preact over the `#hud` layer — the title block with its accent rule,
  the route window, the row card with its CONTINUE / NEW RUN / OPTIONS / STATS rows
  (CONTINUE only when the save holds a living run, carrying its map · biome value and the
  party portraits) and the stats footer — while `src/scenes/MainMenuScene.ts` keeps the
  scene, the save read, the keyboard cursor and every navigation it performs today
  (`continue` → `Route`, `new` → `Starter` with a fresh seed, `options` → the Settings
  screen paused on top). Under `?hud=dom` the scene draws **no Phaser object** and mounts
  the panel; with the flag off the shipped Phaser menu is untouched, object for object.
  Two fixtures (`design/fixtures/01-main-menu.json`, `design/fixtures/01b-main-menu-no-save.json`)
  reproduce the frames, and `?hud=dom&hudFixture=<slug>` mounts the frame's own copy.
- **Environment:** worktree `../wt-pkm-145`, branch `task-145`, created from `main`
  (`git worktree add ../wt-pkm-145 -b task-145`). Linux, headless, no browser by default;
  assets — if any are needed — live **outside** the checkout under `$ASSETS_ROOT` and are
  never symlinked or junctioned into the worktree.
- **Dependencies (already merged — read their output, do not re-create it):**
  - Options `02` is the spike, and the spike is the gate (`[Task-127]`) →
    `src/ui/hud/panels/options/**` is the template for every file this task writes
    (`view.ts` + `view.test.ts`, component + `.css`, `mount.tsx`, `index.ts`,
    `preview.ts` + `preview.test.ts`, `README.md`), and its `installOptionsPreview`
    is the fixture-page pattern to copy.
  - The HUD shell mounts once and owns no Phaser object (`[Task-124]`) → `src/main.ts`
    already mounts `#hud` above the canvas behind `?hud=dom`; `src/ui/hud/README.md`
    and `src/ui/hud/panels/README.md` already list the `main-menu/` folder (do not edit
    either).
  - The panel kit the board is made of (`[Task-125]`) → `src/ui/hud/kit/` (`Panel`,
    `Row`, `Meta`) and `src/ui/hud/styles/root.css`'s `--hud-*` tokens are the only
    primitives and the only colour/type source this panel may use.

### Exclusive paths (single writer)

The list of paths this task creates or modifies. **Nothing outside this list.**
No other task in the batch may claim the same path. Deleting a stray `.gitkeep`
from a directory this task populates is always allowed.

- `src/scenes/MainMenuScene.ts`
- `src/ui/hud/panels/main-menu/view.ts` — new
- `src/ui/hud/panels/main-menu/view.test.ts` — new
- `src/ui/hud/panels/main-menu/mainMenuPanel.tsx` — new
- `src/ui/hud/panels/main-menu/main-menu.css` — new
- `src/ui/hud/panels/main-menu/mount.tsx` — new
- `src/ui/hud/panels/main-menu/preview.ts` — new
- `src/ui/hud/panels/main-menu/preview.test.ts` — new
- `src/ui/hud/panels/main-menu/fixture.test.ts` — new
- `src/ui/hud/panels/main-menu/index.ts` — new
- `src/ui/hud/panels/main-menu/README.md` — new (this folder's own map, one role line
  per file, no exported names)
- `design/fixtures/01-main-menu.json` — new
- `design/fixtures/01b-main-menu-no-save.json` — new

Explicitly **not** yours (another role owns each): `src/ui/hud/panels/README.md`,
`src/ui/hud/README.md`, `src/ui/hud/mount.ts`, `src/ui/hud/shell.tsx`,
`src/ui/hud/state.ts`, `src/ui/hud/commands.ts`, `src/ui/hud/fixtures/**`,
`src/ui/hud/kit/**`, `src/ui/hud/styles/root.css`, `src/ui/runSummary.ts`,
`src/ui/partyScreen.ts`, `src/i18n/**`, `src/engine/**` (so `SAVE_VERSION` stays 23),
`src/data/**`, `package.json`, `vite.config.ts`, `src/main.ts`, every other
`src/scenes/*.ts`, `design/frames/**`, `design/screens/**`, `design/tokens.json`,
`scripts/**`, `docs/**`, `TODO.md`, `CHANGELOG.md`.

### Inputs (read-only)

Files this task may read, and only these, beyond `AGENTS.md` itself.

- `docs/tech-decisions.md` — `D49` (the bridge, the gate, per-element escape hatches),
  `D50` (why the board's rasters carry the world) and `D43` (game text comes from
  `src/i18n/en.ts`; a key is never invented outside it).
- `docs/hud-fidelity.md` — §2 (the type scale with a pinned line box per size), §4
  (palette, radii, strokes), §5 (panel geometry; the desktop card is 460 px and the
  phone card 374 px at x = 8), §6 (the frame → node map) and §8 (what the gate can and
  cannot measure).
- `docs/agent-spec-template.md` — this file's format.
- `design/frames/01-main-menu.json`, `design/frames/01b-main-menu-no-save.json`,
  `design/frames/m01-main-menu.json`, `design/frames/m01b-main-menu-no-save.json` —
  the geometry and the strings this panel must reproduce (the four route-window
  interiors are the world's, see Coordination).
- `design/screens/01-main-menu.png`, `design/screens/01b-main-menu-no-save.png`,
  `design/screens/m01-main-menu.png`, `design/screens/m01b-main-menu-no-save.png` — the
  diff references (`scripts/hud/diff.mjs` reads them; read only through it).
- `design/tokens.json` — the type scale (the title's `38 / 49` pair is in `scale`).
- `src/ui/hud/mount.ts`, `src/ui/hud/shell.tsx`, `src/ui/hud/styles/root.css`,
  `src/ui/hud/kit/**` — the layer, the tokens and the primitives.
- `src/ui/hud/fixtures/flags.ts`, `src/ui/hud/fixtures/index.ts` — `parseHudFlags`,
  `installFixture`, `isHudState`; the fixture store.
- `src/ui/hud/panels/options/**` — the spike: the file set, the `preview.ts`
  microtask-mount pattern, the `data-hud-*` attribute style.
- `src/ui/hud/panels/rewards/fixture.test.ts` — the frame-reading test pattern
  (`nodesOf` / `named` / `rectOf` / `textOf`).
- `src/ui/hud/panels/party/view.ts` (the `Rect`/placeholder-cell convention) and
  `src/ui/hud/panels/trade/README.md` (rule 1: a view is data).
- `src/scenes/SettingsScene.ts` — the shipped scene-side wiring of a DOM panel:
  `DOM_HUD`, `mountPanel`/`disposePanel`, `pushView`, the `SHUTDOWN` disposer.
- `src/scenes/panels/bag.ts`, `src/scenes/panels/map.ts` — the scene-module probe style.
- `src/ui/runSummary.ts` — `runPositionLabel(run)` is the CONTINUE row's map · biome
  string, unchanged.
- `src/ui/partyScreen.ts` — `partyRows(run)` for the portraits' ids and names.
- `src/engine/run/state.ts` — the `RunState` type (`party`, `mapIndex`, `seed`).
- `src/engine/save.ts` — `loadSave`, `Settings`.
- `src/engine/rng.ts` (`randomSeed`), `src/engine/run/index.ts` (`hasLivingParty`),
  `src/input/input.ts` (`subscribeKeybinds`), `src/settings.ts` (`loadSettings`),
  `src/storage.ts` (`browserStorage`), `src/audio/audio.ts` (`playMusic`),
  `src/i18n/index.ts` (`t`, `TranslationKey`), `src/data/keybinds.ts`
  (`keyLabel`, `KeybindAction`), `src/data/portraits.ts` and
  `src/data/anil/pokemon-sprites.json` (read only if the portrait cells need a size —
  the cells are placeholders, see the Contract).
- `scripts/hud/diff.mjs` — the harness (run it, never edit it).

## 🔒 Contract

The public surface other tasks will be written against. It is a promise, not a
suggestion. Every name, field and default below is frozen.

### TypeScript — `src/ui/hud/panels/main-menu/view.ts`

```ts
import type { RunState } from '../../../../engine/run';

/** Every row the board can draw, in board order. */
export const MAIN_MENU_ROW_IDS = ['continue', 'new', 'options', 'stats'] as const;
export type MainMenuRowId = (typeof MAIN_MENU_ROW_IDS)[number];

/** The rows the scene can navigate today. `stats` is frame-only (see Coordination). */
export const MAIN_MENU_ACTIONS = ['continue', 'new', 'options'] as const;
export type MainMenuAction = (typeof MAIN_MENU_ACTIONS)[number];

export type MainMenuRowView = Readonly<{
  id: MainMenuRowId;
  /** The label exactly as printed; the stylesheet uppercases it. */
  label: string;
  /** The right-aligned value; '' draws no value node at all. */
  value: string;
  /** False draws the row inert (`disabled` + `aria-disabled="true"`); the boards never do. */
  enabled: boolean;
}>;

export type MainMenuPortraitView = Readonly<{
  /** The run member's id, so the strip is stable across repaints. */
  memberId: string;
  /** The member's name, read out by a screen reader. */
  name: string;
}>;

export type MainMenuStatId = 'wins' | 'elite' | 'monthly';

export type MainMenuStatView = Readonly<{
  id: MainMenuStatId;
  /** 'WINS' | 'MAX ELITE STRIKE' | 'MONTHLY MAX STRIKE' as the frame prints them. */
  label: string;
  /** '23' | '2' | '7' as the frame prints them. */
  value: string;
  /** The record holder under the value (the frame's 'NOVA'), or null. */
  name: string | null;
}>;

export type MainMenuView = Readonly<{
  title: string;
  /** The bottom-right version line; null draws none (the phone frames have none). */
  version: string | null;
  /** In board order, always a prefix-order subset of `MAIN_MENU_ROW_IDS`. */
  rows: readonly MainMenuRowView[];
  /** The CONTINUE row's party portraits, in party order; [] without a run. */
  portraits: readonly MainMenuPortraitView[];
  /** The footer's figures, left to right; [] draws no footer. */
  stats: readonly MainMenuStatView[];
  /** The id drawn selected (accent bar, `>`, accent fill + border), or null. */
  selected: MainMenuRowId | null;
}>;

/** The board's desktop rects (`01`, `01b`), page coordinates at 1280×800. */
export const MAIN_MENU_BOARD: Readonly<{
  title: { x: number; y: number; w: number; h: number };
  rule: { x: number; y: number; w: number; h: number };
  card: { x: number; y: number; w: number };
  row: { x: number; w: number; h: number; pitch: number; top: number };
  window: { x: number; y: number; w: number; h: number };
  footerRule: { x: number; y: number; w: number; h: number };
  footer: { labelY: number; valueY: number; nameY: number; columns: readonly number[] };
  version: { x: number; y: number; w: number; h: number };
  portrait: { size: number; x: number; y: number; pitch: number };
}>;

/** The board's phone rects (`m01`, `m01b`), page coordinates at 390×844. */
export const MAIN_MENU_BOARD_NARROW: Readonly<{
  title: { x: number; y: number; w: number; h: number };
  rule: { x: number; y: number; w: number; h: number };
  card: { x: number; y: number; w: number };
  row: { x: number; w: number; h: number; pitch: number; top: number };
  window: { x: number; y: number; w: number; h: number };
  footer: { labelY: number; valueY: number; columns: readonly number[] };
  portrait: { size: number; y: number; pitch: number };
}>;

/** The breakpoint the board's two frames switch at; the stylesheet uses the same 600px. */
export const MAIN_MENU_NARROW_QUERY = '(max-width: 600px)';

/** The frame this panel answers to with a save, and the one without. */
export const MAIN_MENU_SLUG = '01-main-menu';
export const MAIN_MENU_SLUG_NO_SAVE = '01b-main-menu-no-save';
export const MAIN_MENU_SLUGS = [MAIN_MENU_SLUG, MAIN_MENU_SLUG_NO_SAVE] as const;
export type MainMenuSlug = (typeof MAIN_MENU_SLUGS)[number];

/** The live menu, from the save's run and the scene's cursor. */
export function liveMainMenuView(run: RunState | null, index: number): MainMenuView;

/** The frame's own copy, or null when the payload is not one this panel can draw. */
export function fixtureMainMenuView(payload: unknown): MainMenuView | null;
```

`liveMainMenuView` rules, exactly:

1. `rows` is `[continue?, new, options]` — three rows when `run !== null`, two when it is
   `null`. **No `stats` row is ever live** (there is no stats screen and no `menu.stats`
   key; `Task-146` adds both). `enabled` is `true` on every row it emits.
2. Labels: `continue` → `t('menu.continue')`, `new` → `t('menu.new')`,
   `options` → `t('menu.options')`. No other i18n key is used and none is added.
3. Values: the `continue` row's value is exactly `runPositionLabel(run)`
   (`src/ui/runSummary.ts`, unchanged); every other row's value is `''` (the game has no
   string for the frame's `NEW SEED`).
4. `portraits` is `partyRows(run).map((row) => ({ memberId: row.id, name: row.name }))`
   in party order — one cell per member, including a member without portrait art. `[]`
   when `run === null`.
5. `stats` is always `[]` (the numbers on the frame are the stats screen's; see
   Coordination).
6. `version` is `null`.
7. `selected` is `rows[index]!.id`, with `index` clamped into `[0, rows.length - 1]`;
   `null` only when `rows` is empty.
8. `title` is `t('menu.title')`.

`fixtureMainMenuView` rules, exactly:

1. Non-object payload → `null`. The block read is `payload.menu`; a payload without a
   plain-object `menu` → `null`.
2. `title` must be a non-empty string; `version` a string or `null`; `selected` a
   `MainMenuRowId` that appears in `rows`, or `null`.
3. `rows` must be an array of 1…4 entries; every entry needs a `MainMenuRowId`-valued
   `id` (no duplicates), a non-empty string `label`, a string `value`, and an optional
   boolean `enabled` **defaulting to `true`**; the ids must follow `MAIN_MENU_ROW_IDS`
   order. Anything else → `null`.
4. `stats` must be an array of 0 or exactly 3 entries, ids `wins`, `elite`, `monthly` in
   that order, each `{ label: non-empty string, value: non-empty string, name: string | null }`;
   anything else → `null`.
5. `portraits` is derived from `payload.state.party` when that is an array of objects
   with a non-empty string `id` and a string `name` — `{ memberId: id, name }` per row —
   and `[]` otherwise. It is **independent of `rows`**: the frame, not the payload,
   decides whether a CONTINUE row is drawn, and the test pins the two together.
6. Nothing is read from `payload.panel`/`payload.mobile`: both frames print the same
   strings and only their geometry differs, and that difference is the stylesheet's
   media query.

Rules for the whole module: no Phaser import, no DOM API, no clock, no `Rng`, no
mutation — same input (and locale) ⇒ deep-equal output, always. **Determinism:** reads
no RNG; the run it is handed is the one `loadSave` returned.

### TypeScript — `src/ui/hud/panels/main-menu/mainMenuPanel.tsx`

```ts
export type MainMenuPanelProps = Readonly<{
  view: MainMenuView;
  onIntent?: ((intent: MainMenuIntent) => void) | undefined;
}>;

export function MainMenuPanel(props: MainMenuPanelProps): JSX.Element;
```

Renders, inside `<div class="main-menu" data-hud-panel="main-menu">`:

| Element | Mark | Must carry |
| --- | --- | --- |
| the glow | a paint-only layer | nothing (desktop only, see CSS) |
| the title | `<h1>` | `data-hud-main-menu-title` |
| the accent rule | `<span>` | `data-hud-main-menu-rule` |
| the route window | `<div>` | `data-hud-main-menu-window` |
| the card | a `<div>` wrapping a `kit` `Panel` (`class="main-menu__card"`) | `data-hud-main-menu-card` on the wrapper |
| one row per `view.rows` entry | `<div>` wrapping a `kit` `Row` | `data-hud-main-menu-row="<id>"`, `data-selected="true"` when selected |
| the selected row's bar + cursor | `<span>` ×2 inside the selected row | `data-hud-main-menu-bar`, `data-hud-main-menu-cursor` |
| one cell per `view.portraits` entry | `<span role="img" aria-label={name}>` | `data-hud-main-menu-portrait` |
| the footer | `<div>` (only when `stats.length > 0`) | `data-hud-main-menu-footer` |
| one figure per stat | `<div>` | `data-hud-main-menu-stat="<id>"` |
| the version line | `<span>` (only when `version !== null`) | `data-hud-main-menu-version` |

The `data-hud-main-menu-row` wrapper is the measured row box (420 × 54 desktop,
326 × 48 phone); the `kit` `Row` it wraps must render the same box to within 1 px, so the
focus ring and the 44 px hit area land on the drawn row. The same rule holds for the card:
`data-hud-main-menu-card` sits on a wrapper whose box is the card (460 × 362 / 460 × 300
desktop, 374 × 264 / 374 × 196 phone) and the `Panel` fills it, because `PanelProps`
carries no `data-*` passthrough — the wrapper is the measured node, the `Panel` is its
skin. `Row` gets `selected` and `disabled={!row.enabled}` and `onPress`; `onPress` emits
`{ type: <intent> }` where `continue` → `continue`, `new` → `new-run`, `options` →
`options`, `stats` → `stats`.

### TypeScript — `src/ui/hud/panels/main-menu/mount.tsx`

```ts
/** What a press, a tap or Enter on a row asks the scene for. */
export type MainMenuIntent =
  | Readonly<{ type: 'continue' }>
  | Readonly<{ type: 'new-run' }>
  | Readonly<{ type: 'options' }>
  | Readonly<{ type: 'stats' }>;

export type MainMenuHandle = Readonly<{
  /** Repaints from a new view. Exactly one render per call. */
  update(view: MainMenuView): void;
  /** Drops the container, clears the tree; idempotent. */
  dispose(): void;
}>;

export function mountMainMenu(
  host: Element,
  view: MainMenuView,
  onIntent?: ((intent: MainMenuIntent) => void) | undefined,
): MainMenuHandle;
```

- One `div.main-menu-mount` appended to `host`, the panel rendered into it.
- **No global keyboard listener.** The scene's `subscribeKeybinds` is the keyboard path;
  the rows are `<button>`s, so Enter/Space on a focused row is the browser's own click.
  Registering a `keydown` handler would double-handle the confirm key.
- `dispose()` is callable twice and removes the container.

### TypeScript — `src/ui/hud/panels/main-menu/preview.ts`

```ts
/** True only when the URL asks for `?hud=dom&hudFixture=<a main-menu slug>`. */
export function mainMenuPreviewRequested(search: string): boolean;

/** Mounts the frame's panel once into `#hud`; null when the URL does not ask for it. */
export function installMainMenuPreview(search: string): (() => void) | null;
```

Copy `src/ui/hud/panels/options/preview.ts`: both payloads imported statically
(`design/fixtures/01-main-menu.json`, `design/fixtures/01b-main-menu-no-save.json`), the
slug from `parseHudFlags(search).fixture`, `installFixture(...)` consulted so a broken
file is inert, the mount deferred with `queueMicrotask` (the `#hud` root is mounted after
the module graph runs), and a disposer that un-installs. Inert — no node, no listener —
for every other URL, and under `?hudFixture=<slug>` without `?hud=dom`.

### TypeScript — `src/ui/hud/panels/main-menu/index.ts`

The barrel: `MAIN_MENU_ACTION(S|S)`, `MAIN_MENU_BOARD`, `MAIN_MENU_BOARD_NARROW`,
`MAIN_MENU_NARROW_QUERY`, `MAIN_MENU_ROW_IDS`, `MAIN_MENU_SLUG`, `MAIN_MENU_SLUGS`,
`MAIN_MENU_SLUG_NO_SAVE`, `fixtureMainMenuView`, `liveMainMenuView`, `MainMenuPanel`,
`mountMainMenu`, `installMainMenuPreview`, `mainMenuPreviewRequested` and the types
`MainMenuAction`, `MainMenuHandle`, `MainMenuIntent`, `MainMenuPanelProps`,
`MainMenuPortraitView`, `MainMenuRowId`, `MainMenuRowView`, `MainMenuSlug`,
`MainMenuStatId`, `MainMenuStatView`, `MainMenuView`.

### `src/scenes/MainMenuScene.ts`

Keeps every rule it has today. Its contract after this task:

```ts
/** `?hud=dom` read once (`D49`): with it on this scene draws no Phaser object. */
const DOM_HUD: boolean;

/** The number of display objects the menu draws right now: 0 under `?hud=dom`. */
export function mainMenuDrawnObjectCount(scene: Phaser.Scene): number;
```

- At module load, exactly like `SettingsScene`: `installMainMenuPreview(window.location.search)`.
- `create()` keeps, before anything is drawn: `loadSettings()`, `loadSave(browserStorage())`,
  `this.run = save.run && hasLivingParty(save.run) ? save.run : null`.
- **DOM branch.** When `DOM_HUD` is on **and** `mainMenuPreviewRequested(window.location.search)`
  is false, the scene draws nothing, builds
  `this.items = MAIN_MENU_ACTIONS.filter((id) => view.rows.some((row) => row.id === id))`
  from one `liveMainMenuView(this.run, 0)`, `this.index = 0`, and mounts the panel into
  `document.getElementById('hud')` (a missing host mounts nothing). When the fixture
  preview claims the URL the scene draws nothing and mounts nothing (the preview owns the
  layer).
- Both paths then run the shared tail it has today: `subscribeKeybinds(this, ({ action })
  => this.handleAction(action), () => this.settings.keybinds)`, the `RESUME` handler
  (re-read settings, `playMusic(this, 'menu-music')`, `this.render()`), `playMusic(...)`
  and `this.render()`; under the flag a `SHUTDOWN` once-listener disposes the panel.
- `handleAction` (`up`/`down`/`confirm`/`settings`), `move`, `choose` and `openOptions`
  keep their behaviour. `choose()` under the flag applies the same three destinations
  from the row id. The `stats` intent is received and not navigated (there is no stats
  screen yet — `Task-146`); it must be a named, commented branch, not a silent fallthrough.
- `render()` under the flag is one `this.controller?.update(liveMainMenuView(this.run, this.index))`
  and no Phaser call.
- With the flag off, the file's drawing code and its layout constants stay as they are
  today (`PANEL_W`, `ROW_H`, `ROW_GAP`, `ROW_TOP`, the portrait pitch/scale constants,
  `MENU_LABELS`, `menuLabel`); the probe returns `scene.children.length`.

### DOM contract (read by QA over CDP)

Root `[data-hud-panel="main-menu"]` covers the viewport (`position: fixed; inset: 0`) and
is the only node that re-enables `pointer-events` (`auto`) inside `#hud`; every element
below is `pointer-events: none` except the row buttons. Attributes:
`data-hud-main-menu-title`, `-rule`, `-window`, `-card`, `-row="<id>"`, `-bar`, `-cursor`,
`-portrait`, `-footer`, `-stat="wins|elite|monthly"`, `-version`; the selected row also
carries `data-selected="true"`.

### Data — the two fixture payloads (`design/fixtures/`)

Both files are the frame's own copy plus the snapshot the store validates. Exact shape:

```jsonc
{
  "slug": "01-main-menu",              // must equal the file name's slug
  "state": { "party": [/* 4 rows */], "bag": [/* … */], "money": 1240,
             "route": { /* … */ }, "battle": null, "notice": null },
  "menu": {
    "title": "POKERANDOMLIKE",
    "version": "v0.7.0 · PHASE 7",
    "selected": "continue",
    "rows": [
      { "id": "continue", "label": "CONTINUE", "value": "MAP 3 · FOREST" },
      { "id": "new",      "label": "NEW RUN",  "value": "NEW SEED" },
      { "id": "options",  "label": "OPTIONS",  "value": "" },
      { "id": "stats",    "label": "STATS",    "value": "" }
    ],
    "stats": [
      { "id": "wins",    "label": "WINS",               "value": "23", "name": null },
      { "id": "elite",   "label": "MAX ELITE STRIKE",   "value": "2",  "name": null },
      { "id": "monthly", "label": "MONTHLY MAX STRIKE", "value": "7",  "name": "NOVA" }
    ]
  }
}
```

- `state` must pass `isHudState` (`src/ui/hud/fixtures/index.ts`): exactly the six keys
  `party`, `bag`, `money`, `route`, `battle`, `notice`, with a string `id` on every party
  row and a string `itemId` on every bag row. `01-main-menu`'s party is the four the
  mobile frame names — `CH`, `PI`, `BU`, `GA` (`design/frames/m01-main-menu.json`, nodes
  `portrait CH/PI/BU/GA`) — as four members with `name` `Charmander`, `Pikachu`,
  `Bulbasaur`, `Gastly`; `01b-main-menu-no-save`'s is `[]` with `route: null`,
  `money: null`, `battle: null`, `notice: null`.
- `01b-main-menu-no-save.json`: same keys, `"selected": "new"`, three rows
  (`new` / `options` / `stats`) with the no-save values (`"NEW SEED"`, `""`, `""`), the
  same three `stats` entries, and no `continue` entry anywhere.
- Key defaults frozen here: `rows[].enabled` defaults to `true`; `menu.version` and
  `menu.selected` may be `null`; `stats[].name` may be `null`. `menu.stats` may be `[]`
  (the footer is then not drawn). No other key is read.

## 🧩 Data and configuration

Only the two fixture files above. No new `src/data/` table, no `docs/` line, no token and
no `package.json` change: the panel's colours, radii and type sizes come from
`src/ui/hud/styles/root.css`'s `--hud-*` custom properties, and the one value the tokens
do not expose (the title's `38 px / 49 px` pair, `design/tokens.json` → `scale`) plus the
frame-specific fills are declared once as `--main-menu-*` properties at the top of
`main-menu.css`:

```css
.main-menu {
  --main-menu-screen: #0b1017;                 /* the frame's own fill, 01/01b */
  --main-menu-window: #0b1017;                 /* `route window` fill, desktop frame */
  --main-menu-card-fill: rgb(16 22 31 / 86%);  /* `menu card`, 86 % not the kit's 72 % */
  --main-menu-title-size: 38px;
  --main-menu-title-line: 49px;
  --main-menu-row-label-size: 20px;
  --main-menu-row-label-line: 26px;
  --main-menu-row-value-size: 12px;
  --main-menu-row-value-line: 15px;
  --main-menu-stat-label-size: 12px;
  --main-menu-stat-label-line: 15px;
  --main-menu-stat-value-size: 24px;
  --main-menu-stat-value-line: 31px;
}
```

The phone block (`@media (max-width: 600px)`) re-declares exactly the values the mobile
frames change: `--main-menu-title-size: 20px`, `--main-menu-title-line: 26px`,
`--main-menu-window: #05070c` (the `m01`/`m01b` `m route window` fill — the two frames'
fills differ; this is not a typo), `--main-menu-row-label-size: 10px`,
`--main-menu-row-label-line: 13px`, `--main-menu-stat-value-size: 16px`,
`--main-menu-stat-value-line: 20px`, and hides the glow and the version line (neither
frame has them).

Board geometry the panel reproduces (page coordinates; the constants above carry the
same numbers so the fixture test pins the frames):

| item | desktop `01` / `01b` | phone `m01` / `m01b` |
| --- | --- | --- |
| screen | 1280 × 800, `#0B1017` | 390 × 844, `#0B1017` |
| glow | ellipse 1000 × 720 at (−180, −140), accent 10 % | none |
| title box | (724, 146) 447 × 49, 38 Bold, `#F8FAFC` | (16, 68) 235 × 26, 20 Bold |
| accent rule | (724, 204) 88 × 3, r2, `#7DD3FC` | (16, 108) 64 × 3, r2 |
| route window | (96, 150) 560 × 380, r11, fill `#0B1017`, 1 px white 16 % hairline | (16, 126) 358 × 240, r11, fill `#05070C` |
| menu card | (724, 236) 460 × **362** with 4 rows / 460 × **300** with 3, r11, `#10161F` 86 %, hairline white 16 %, 1 px highlight at (x+12, y+12) white 14 % | (8, 390) 374 × **264** with 4 rows / 374 × **196** with 3, same skin |
| row box | (744, 300 + i·62) 420 × 54, r8; card→row0 = 64 | (32, 402 + i·54) 326 × 48, r8; card→row0 = 12 |
| row bar (selected) | (744, row+8) 3 × 38, r2, accent | not drawn (the phone frames have no bar) |
| cursor (selected) | (760, row+16) 9 × 18, 14 px accent `>` | not drawn |
| row label | (782, row+17) 20 / 26 Bold, `#F8FAFC` | (48, row+17) 10 / 13 Bold |
| row value | right-aligned, box top row+22, 12 / 15; `#94A3B8` on NEW RUN, accent on CONTINUE | right-aligned, near the row's right inset |
| selected row skin | fill accent 14 %, 1 px accent border | same |
| unselected row skin | fill white 4 %, 1 px white 8 % border | same |
| portraits | 26 × 26, r7, y = 314, x = 922 / 952 / 982 / 1012 (pitch 30), white 14 % border | 22 × 22, y = 415, x = 258 / 283 / 308 / 333 (pitch 25) |
| footer rule | (96, 592) 520 × 1, white 10 % | none |
| footer labels | y = 616, 12 / 15, `#94A3B8`, columns x = 96 / 240 / 724 | y = 676, 12 / 15, columns x = 16 / 140 / 264 |
| footer values | y = 636, 24 / 31 Bold, `#F8FAFC` | y = 692, 16 / 20 Bold |
| footer record name | (754, 650) 12 / 15 Bold, `#94A3B8` (only the monthly column) | beneath the monthly value |
| version line | (1065, 750) 122 × 15, 12 / 15, `#475569` | none |

The portrait cells are **placeholder cells** (r7 desktop, white 4 % fill, white 14 %
hairline, one per party member, in party order) — the board's sprite pixels are the
canvas's, the rule the DOM party and trade panels already follow
(`src/ui/hud/panels/trade/README.md` rule 1, `src/ui/hud/panels/detail/README.md` rule 5).
A member the atlas has no cell for still keeps its place, so the party's order reads.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the three test files this task
    adds (`view.test.ts`, `preview.test.ts`, `fixture.test.ts`).
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-145` audit against the exclusive path list (the spec
    commit that the Orchestrator lands on the branch tip is not counted).
  - Browser budget goes to the `[live]` criteria. Run them with
    `npm run dev -- --port 5173 --host 127.0.0.1` and drive Chromium over CDP with
    `deviceScaleFactor: 2` (the harness's own settings: 1280 × 800 and 390 × 844). For
    every rectangle below, `getBoundingClientRect()` rounded to integers must match the
    table in §Data and configuration within **2 px** on each of x, y, width and height.
  - The diff harness (`D49`): `node scripts/hud/diff.mjs --slug 01-main-menu` and
    `node scripts/hud/diff.mjs --slug 01b-main-menu-no-save`, which boots the preview
    through Vite, screenshots both viewports and compares against
    `design/screens/<slug>.png` / `m<slug>.png`. **Read its two metrics apart**: the board's
    `route window` interior is the route's own screenshot (`D50`), which this panel does
    not own (`D49`: the world stays in the canvas), so the harness's `pass` is expected to
    be red on that interior only. Record `report.json`'s `geometry` and `colour` verbatim
    and check the diff PNGs (see the `[live]` criteria).
- **Acceptance criteria:**

Unit
- [ ] `[unit]` `npm run build` exits 0 (`tsc --noEmit && vite build`).
- [ ] `[unit]` `npm test` exits 0 with `src/ui/hud/panels/main-menu/view.test.ts`,
      `preview.test.ts` and `fixture.test.ts` present and passing; `npm test` reports the
      pre-existing counts plus this task's new tests, none skipped for a missing asset.
- [ ] `[unit]` `view.test.ts` covers, headless: (a) with a run — the rows are exactly
      `['continue','new','options']` in that order, all `enabled`, the CONTINUE value is
      `runPositionLabel(run)` and contains the biome's name from
      `getBiome(biomeForMap(run.seed, run.mapIndex)).name`, `portraits.length ===
      run.party.length` with the ids and names in party order, `stats` is `[]` and
      `version` is `null`; (b) without a run — `['new','options']`, no continue row, no
      portraits, `selected === 'new'`; (c) the cursor — `liveMainMenuView(run, 1)` selects
      `new`, `liveMainMenuView(run, 9)` clamps to the last row, `liveMainMenuView(null, 0)`
      selects `new`; (d) purity — two calls with the same input are deep-equal and the
      result JSON round-trips unchanged.
- [ ] `[unit]` `fixture.test.ts` covers both slugs against
      `design/frames/01-main-menu.json` / `01b-main-menu-no-save.json` and
      `m01` / `m01b`: `isHudState(payload.state)` is true and its keys are exactly the six;
      `fixtureMainMenuView(payload)` is non-null; the drawn rows' `label`/`value` equal the
      frame's text nodes in order (`CONTINUE`/`MAP 3 · FOREST`, `NEW RUN`/`NEW SEED`,
      `OPTIONS`, `STATS`; `01b` has no `CONTINUE`); `selected` is the id of the row drawn
      at the frame's first row `y`; `portraits.length === payload.state.party.length`
      (4 and 0); `stats` equals the frame's three figures (`23`, `2`, `7` + `NOVA`); the
      title and the version equal the frame's; and `MAIN_MENU_BOARD` /
      `MAIN_MENU_BOARD_NARROW` equal the frames' `title`, `accent rule`/`m rule`,
      `menu card`/`m menu card` x/y/width, `row`/`m row *` pitch, `route window`/
      `m route window`, `stats rule`, `slot 0…3`/`portrait *` pitch and `version` rects.
- [ ] `[unit]` `fixture.test.ts` also pins the guards: a payload with no `menu` block, a
      row with an unknown id, duplicate ids, ids out of `MAIN_MENU_ROW_IDS` order, a
      `stats` array of 2, and a `selected` naming no row each return `null`.
- [ ] `[unit]` `preview.test.ts` pins `mainMenuPreviewRequested`'s truth table: true for
      `?hud=dom&hudFixture=01-main-menu` and `…=01b-main-menu-no-save` in either pair
      order and either case; false for `?hudFixture=01-main-menu` alone, `?hud=game`,
      `?hud=dom` with no slug, `?hud=dom&hudFixture=02-options`, `?hud=dom&hudFixture=m01-main-menu`
      and the malformed slugs the flag parser rejects.
- [ ] `[unit]` `git diff --name-only main...task-145` lists only the 13 exclusive paths.
- [ ] `[unit]` The DOM branch is guarded and returns before any draw:
      `grep -n 'if (DOM_HUD)' src/scenes/MainMenuScene.ts` prints one line, whose number is
      smaller than the first match of `grep -nE 'this\.add\.|addFrlg(Text|Window)' src/scenes/MainMenuScene.ts`;
      `grep -c 'mainMenuPreviewRequested' src/scenes/MainMenuScene.ts` is at least 1.
- [ ] `[unit]` No engine, save or data file moved: `git diff --name-only main...task-145 | grep -cE '^(src/engine/|src/data/|src/i18n/|package\.json)'` prints `0`,
      and `grep -n 'SAVE_VERSION = 23' src/engine/save.ts` still matches.
- [ ] `[unit]` The panel imports no Phaser and no engine rule new to it:
      `grep -cE "from 'phaser'" src/ui/hud/panels/main-menu/*.ts src/ui/hud/panels/main-menu/*.tsx` prints `0` for every file.

Live (measured over CDP; each rect within 2 px of the §Data table)
- [ ] `[live]` `/?hud=dom&hudFixture=01-main-menu` at **1280×800**: `[data-hud-panel="main-menu"]`
      covers the viewport (rect 0, 0, 1280, 800); `[data-hud-main-menu-title]`,
      `[data-hud-main-menu-rule]`, `[data-hud-main-menu-card]` (460 × 362),
      `[data-hud-main-menu-window]` (560 × 380) and `[data-hud-main-menu-card]`'s computed
      `background-color`/`border` read `rgb(16 22 31 / 0.86)`-equivalent flat fill and a
      1 px white 16 % hairline. Measurement: the five `getBoundingClientRect()`s plus the
      two computed styles, quoted in the task's report.
- [ ] `[live]` Same URL: the four row boxes are `420 × 54` at `y = 300, 362, 424, 486`
      (pitch 62, tolerance 2), in the order `continue`, `new`, `options`, `stats`;
      `data-hud-main-menu-row`'s inner `button.kit-row` box equals its wrapper within 1 px.
- [ ] `[live]` Same URL: `document.querySelectorAll('[data-hud-main-menu-portrait]').length`
      equals the fixture's `state.party.length` (4), and the four cells are `26 × 26` at
      `x = 922, 952, 982, 1012`, `y = 314` (tolerance 2).
- [ ] `[live]` Same URL: the footer — `[data-hud-main-menu-footer]` present,
      `[data-hud-main-menu-stat="wins"]` label box `(96, 616) 41 × 15` and value box
      `(94, 636) 42 × 31`; `="elite"` label `(240, 616)`, value `(238, 636)`;
      `="monthly"` label `(724, 616)`, value `(724, 636)`, record name `(754, 650) 51 × 15`;
      `[data-hud-main-menu-version]` at `(1065, 750) 122 × 15`.
- [ ] `[live]` `/?hud=dom&hudFixture=01b-main-menu-no-save` at **1280×800**:
      `document.querySelector('[data-hud-main-menu-row="continue"]')` is `null`, the card
      is `460 × 300`, the three rows are at `y = 300, 362, 424` and the first is `new`,
      `document.querySelectorAll('[data-hud-main-menu-portrait]').length` is `0`, and the
      footer and the version are still drawn.
- [ ] `[live]` The CONTINUE row's enabled state differs between the two fixtures, measured
      as: in `01-main-menu` the node exists, `hasAttribute('disabled')` is `false`,
      `getAttribute('aria-disabled')` is `null` (or `"false"`) and `getComputedStyle(...).opacity`
      is `1`; in `01b-main-menu-no-save` the node is absent (`querySelector` → `null`). The
      board deletes the row rather than disabling it (frame `01b`'s first row is `NEW RUN`).
- [ ] `[live]` `/?hud=dom&hudFixture=01-main-menu` and `…=01b-main-menu-no-save` at
      **390×844**: the card is `374 × 264` / `374 × 196` at `(8, 390)`; the rows are
      `326 × 48` at `y = 402 / 456 / 510 / 564` and `402 / 456 / 510`; the title is
      `(16, 68) 235 × 26`; the window is `(16, 126) 358 × 240`; the footer labels sit at
      `y = 676` and the values at `y = 692` with columns `x = 16 / 140 / 264`; no glow and
      no version node; `document.documentElement.scrollWidth === 390` (no horizontal
      overflow).
- [ ] `[live]` The harness run, both slugs, both viewports: `node scripts/hud/diff.mjs
      --slug 01-main-menu` and `--slug 01b-main-menu-no-save` complete and write
      `design/diff/<slug>/report.json`. QA quotes `geometry.max`, `geometry.unmatched`
      and `colour.flat` for each viewport and opens `1280x800.diff.png` and
      `390x844.diff.png`: every differing area must be inside the route window's interior
      (`(96, 150)`–`(656, 530)` desktop, `(16, 126)`–`(374, 366)` phone — the board's own
      world screenshot, `D50`) or a glyph's anti-aliased edge inside a text box. **Nothing
      else may differ**; a differing row edge, card edge, portrait cell or footer line is a
      failure. A boxed `pass: false` caused only by the window's interior is the accepted
      outcome and is stated as such in the task's report.
- [ ] `[live]` The scene still navigates, measured on `/?hud=dom` with the HUD layer
      live and the save cleared (`localStorage.removeItem('pokerandomlike.save')` then a
      reload): `document.querySelector('[data-hud-main-menu-row="continue"]')` is `null`,
      `data-selected="true"` sits on `new`; one `ArrowDown` on the document moves it to
      `options`; one press on `[data-hud-main-menu-row="options"]` opens
      `[data-hud-panel="options"]` (the Settings panel); after `Escape`/`Q` the menu panel
      is back at the same rect. With a save present the same run starts `Route`
      (the menu panel disappears and `[data-hud-main-menu-row="continue"]`'s press is what
      does it).
- [ ] `[live]` The flag contract, measured on `/` (no query): `document.querySelectorAll('[data-hud-panel]').length`
      is `0`, the canvas is not blank (two sampled pixels, e.g. (100, 100) and (640, 400),
      differ) and the shipped Phaser menu still paints — i.e. the Phaser path is untouched
      when the flag is off. Under `/?hud=dom` on the same save, the scene's display list is
      empty: `mainMenuDrawnObjectCount` reports `0` and the same probe with the flag off
      reports the count it reported before this task (quote both numbers).

## 📣 Coordination

- **For the Orchestrator:** three decisions this spec had to take, which the human should
  confirm (none blocks the work):
  1. **The STATS row.** Both frames draw a fourth row, `STATS`. There is no stats screen,
     no `menu.stats` key and no `src/ui/hud/panels/stats/` yet (`Task-146` owns all
     three), so the *live* menu draws the three rows it can navigate today
     (`continue`/`new`/`options`) and the **frame-only row comes from the fixture payload**.
     The `stats` intent exists in the frozen union so `Task-146` only has to route it, and
     `MainMenuScene` receives it as a named no-op branch today.
  2. **The footer, the version line and `NEW SEED`.** The board prints `WINS 23`,
     `MAX ELITE STRIKE 2`, `MONTHLY MAX STRIKE 7 NOVA`, `v0.7.0 · PHASE 7` and `NEW SEED`;
     the save has none of these numbers (`SaveDocument` is settings + run, `RunStats` is
     catches/casualties) and `package.json` is another task's path. They are fixture copy;
     the live view passes `stats: []`, `version: null` and an empty `NEW SEED` value until
     `Task-146` gives the numbers a source. `runPositionLabel` (the map · biome value) is
     the one derived field, and it is unchanged.
  3. **The route window's interior.** The board's window shows the route screenshot
     (`D50`); this panel owns its chrome (radius 11, fill, hairline) and leaves the
     interior flat. The reference's own world edges therefore make the diff harness's
     `geometry.unmatched` and `colour.flat` red **inside that rect only** — no other screen
     in the repo has a boxed world picture, so this is the first task that must state the
     exemption. The screen's real fidelity gate is the element-by-element measurement in
     the `[live]` list against `design/frames/01*.json`. If the human prefers the window to
     be a hole onto a live route, that is a different task (it needs the canvas).
- **For the next batch:** `Task-146` (stats and ranking) builds on this: it adds
  `src/ui/hud/panels/stats/**`, the `menu.stats` key (`src/i18n/en.ts` + `es.ts`) and the
  live `stats` row plus the footer's source, and it routes `MainMenuScene`'s `stats`
  intent. It must not re-claim this panel's folder. `Task-147` (starter) and `Task-148`
  (run over) are independent of this file set.
- **Paths another task may not touch:** everything under
  `src/ui/hud/panels/main-menu/` and both fixtures are written here; `Task-124` already
  owns `src/ui/hud/panels/README.md` (its `main-menu/` line exists — do not re-add it) and
  `src/ui/hud/README.md`.
- **The scene is a hot file and is claimed here:** `src/scenes/MainMenuScene.ts` is
  written by this task only. `Task-146` takes it next.
- **Environment notes:** the environment is Linux and headless; run the harness with
  `CHROME_PATH` set if `scripts/hud/diff.mjs` cannot find a browser. Portraits are
  placeholders, so the panel needs no atlas: no `$ASSETS_ROOT` tree is required, nothing is
  symlinked into the worktree, and the portrait cells must not shrink to zero when an atlas
  is missing.

## ⛔ Out of scope

- No new i18n key, no `src/i18n/**` edit, no `menu.subtitle` or `menu.controls` line: the
  frames draw neither (the title block is the title + the accent rule; the footer replaces
  the controls hint).
- No stats screen, no ranking screen, no `src/ui/hud/panels/stats/**`, no monthly record
  row, no wins counter, no `SaveDocument`/`SAVE_VERSION` change, no `RunStats` change.
- No real portrait sprites: the cells stay the placeholder the other DOM panels draw.
- No route preview inside the route window; no canvas work at all, no change to
  `src/main.ts`, `vite.config.ts` or `package.json`.
- No effect on the flag-off Phaser menu: no restyle, no re-layout, no behaviour change
  there, and no shared refactor of it into a helper module (that would be a path this spec
  does not own).
- No touch-pad work, no `Task-139` chips, no battle or route panel touched, no
  `docs/**` or `TODO.md` / `CHANGELOG.md` edit (the Orchestrator writes the tick and the
  changelog entry at merge).

### Exit protocol

1. Commit the work on `task-145` and push it (`git push -u origin task-145`).
2. Run the full gate: `npm test` and `npm run build` must both be green, the path audit
   must list only the exclusive paths, and the `[live]` measurements above must be recorded
   with their numbers.
3. Then `git commit --allow-empty -m 'dev: done task-145'` and push it: the branch tip's
   subject is the turnstile (`docs/agent-ci.md`), and QA starts from that tip. Never merge
   and never commit to `main`.
