# Spec: Task-155 — stats and ranking are the HUD's

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Read `AGENTS.md` (whole file) first, then this spec, and nothing else.

## 🎯 Scope

- **Task type:** Phaser scene + DOM HUD panel (Preact), i18n, fixtures.
- **Role:** Dev.
- **Objective:** the five board frames `08`, `08b`, `08c`, `09` and `09b` become one
  live DOM panel at `src/ui/hud/panels/stats/`, fed by `Task-152`'s run-history
  store (`SaveDocument.history`, `src/engine/run/history.ts`): a totals grid, the
  run list, the Pokédex-style Pokémon table and the **local** monthly record, with
  empty states when the store holds nothing. The main menu's frame-only STATS row
  becomes live **in the DOM HUD path** (`?hud=dom`): choosing it swaps the menu
  panel for the stats panel, and BACK returns to the menu.
- **Environment:** worktree `../wt-pkm-155` (absolute
  `/home/runner/work/pkm-randomlike/wt-pkm-155`), branch `task-155`, cut from
  `origin/main` @ `ebd3b24`. Install once with
  `npm ci --prefer-offline --no-audit --no-fund`; work only inside this worktree.
- **Dependencies (all merged):** `Task-152` — `src/engine/run/history.ts`
  (`RunHistoryRecord`, `MAX_HISTORY`, `pushHistory`, `makeHistoryRecord`) and
  `SaveDocument.history`; `Task-124`/`Task-125`/`Task-127` — the HUD shell, the DOM
  kit and the fixture harness; `Task-145` — the main-menu panel
  (`src/ui/hud/panels/main-menu/`), whose `view.ts` and `README.md` this task edits.

### Exclusive paths (single writer)

Creates or modifies **only** these. No other task in this batch touches them
(`Task-153` holds `src/engine/battle/**`, `src/engine/save.ts` and their tests;
nothing here overlaps).

- `src/ui/hud/panels/stats/**` — the new folder: `view.ts`, `view.test.ts`,
  `statsPanel.tsx`, `stats.css`, `mount.tsx`, `preview.ts`, `preview.test.ts`,
  `fixture.test.ts`, `index.ts`, `README.md`.
- `design/fixtures/08-stats-totals.json`
- `design/fixtures/08b-stats-runs.json`
- `design/fixtures/08c-stats-pokemon.json`
- `design/fixtures/09-ranking.json`
- `design/fixtures/09b-ranking-pokemon.json`
- `src/ui/hud/panels/main-menu/view.ts` + `src/ui/hud/panels/main-menu/view.test.ts`
  — the STATS row becomes live.
- `src/ui/hud/panels/main-menu/README.md` — rule 5 is no longer true.
- `src/scenes/MainMenuScene.ts` — the row's destination and the panel swap.
- `src/scenes/README.md` — the `MainMenuScene.ts` line gains the stats overlay.
- `src/ui/hud/panels/README.md` — the `stats/` line describes the history store,
  not "the run's counters and lines".
- `src/i18n/en.ts` + `src/i18n/es.ts` — the keys listed below.
- `docs/design-spec.md` — **only** the §2 main-menu bullet (lines 16-18) and, at
  most, a clarifying parenthesis in the §10.3 controls table row (line 604).

Nothing else. `src/main.ts` (no new scene), `package.json`, `vite.config.ts`,
`src/ui/hud/kit/**`, `src/engine/**`, `src/data/**` and `src/assets/**` are **not**
yours.

### Inputs (read-only)

- `src/engine/run/history.ts`, `src/engine/save.ts`, `src/storage.ts`,
  `src/engine/run/state.ts` (`RunStats`, `RunMode`), `src/data/dex/species.ts`
  (`getSpecies`).
- `src/ui/hud/panels/run-over/**` and `src/ui/hud/panels/main-menu/**` — the two
  migrations to copy the idiom from (model `view.ts` + `.test.ts`, `*Panel.tsx`,
  `.css`, `mount.tsx`, `preview.ts`, `fixture.test.ts`, `index.ts`, `README.md`).
- `src/ui/hud/state.ts`, `src/ui/hud/mount.ts`, `src/ui/hud/shell.tsx`,
  `src/ui/hud/kit/**` (only the primitives; do not edit them),
  `src/ui/hud/fixtures/**` (`installFixture`, `FIXTURE_MODULES`, `isHudState`,
  `parseHudFlags`).
- `src/ui/runSummary.ts`, `src/i18n/index.ts` (`t`), `src/data/keybinds.ts`.
- `design/board.json` and `design/frames/08-stats-totals.json`,
  `08b-stats-runs.json`, `08c-stats-pokemon.json`, `09-ranking.json`,
  `09b-ranking-pokemon.json` plus their `m…` twins; `design/screens/*.png`.
- `design/fixtures/01-main-menu.json` (the `state` block shape), `06-run-over-*`
  (the panel-block shape).

## 🔒 Contract

### `src/ui/hud/panels/stats/view.ts` (pure, no Preact, no DOM)

```ts
export const STATS_SLUGS = [
  '08-stats-totals',
  '08b-stats-runs',
  '08c-stats-pokemon',
  '09-ranking',
  '09b-ranking-pokemon',
] as const;
export type StatsSlug = (typeof STATS_SLUGS)[number];

export const STATS_MODES = [
  'totals',
  'runs',
  'pokemon',
  'ranking',
  'ranking-pokemon',
] as const;
export type StatsMode = (typeof STATS_MODES)[number];

/** The em dash every unrecorded figure is drawn as, one cell, never a 0. */
export const STATS_EM_DASH = '\u2014';

export type StatsFigure = Readonly<{ id: string; label: string; value: string }>;
export type StatsRow = Readonly<{ id: string; cells: readonly string[] }>;
export type StatsTab = Readonly<{ id: StatsMode; label: string }>;
export type StatsActionId = 'back' | 'ranking' | 'ranking-players' | 'ranking-pokemon';
export type StatsAction = Readonly<{ id: StatsActionId; label: string }>;
/** `key` is `YYYY-MM` in UTC; `label` is `OCT 2026` (month key + year). */
export type StatsMonth = Readonly<{ key: string; label: string }>;
export type StatsRect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type StatsBoard = Readonly<{
  panel: Readonly<{ x: number; y: number; w: number; h: number; radius: number }>;
  title: StatsRect;
  blurb: StatsRect;
  tabs: readonly Readonly<{ id: StatsMode; x: number; y: number; w: number; h: number }>[];
  figureLabel: Readonly<{ x: number; y: number; w: number; h: number; pitch: number }>;
  figureValue: Readonly<{ x: number; y: number; w: number; h: number; pitch: number }>;
  row: Readonly<{ x: number; y: number; w: number; h: number; pitch: number }>;
  button: StatsRect;
}>;

export type StatsView = Readonly<{
  mode: StatsMode;
  title: string;
  blurb: string;
  tabs: readonly StatsTab[];
  /** The TOTALS grid, three per row, exactly 12 entries; empty in every other mode. */
  figures: readonly StatsFigure[];
  /** The table's headers; empty for `totals` and for `runs` (its rows carry no header). */
  columns: readonly string[];
  rows: readonly StatsRow[];
  /** The empty-state line when the store holds nothing for this view, else null. */
  empty: string | null;
  /** RANKING's selector; null in every other mode. */
  month: Readonly<{ label: string; canPrev: boolean; canNext: boolean }> | null;
  actions: readonly StatsAction[];
}>;

export function statsBoard(viewport: 'desktop' | 'narrow'): StatsBoard;
export function statsMonths(history: readonly RunHistoryRecord[], now: Date): readonly StatsMonth[];
export function liveStatsView(
  history: readonly RunHistoryRecord[],
  mode: StatsMode,
  monthKey: string | null,
  now: Date,
): StatsView;
export function fixtureStatsView(payload: unknown): StatsView | null;
```

- **`statsBoard`** copies the rects **from the frame files**, not from this spec:
  `desktop` from `design/frames/08-stats-totals.json` (the `run over panel`,
  `run over title`, `run over blurb`, the three `tab …` nodes, `stat N label/value`,
  the row pitch and `continue button`), `narrow` from
  `design/frames/m08-stats-totals.json` (the `m panel` node and its twins). The
  sheet's page coordinates are the frame node coordinates minus the frame root's
  `y` offset. `panel.radius` is the node's `cornerRadius`. `fixture.test.ts` must
  pin every number against the JSON, so a frame change shows up as a red test.
- **`statsMonths`** — the months present in `history` (`endedAt` read in **UTC**,
  `YYYY-MM`), newest first; when the list would be empty it holds the month of
  `now` (UTC) alone. Duplicates collapse. Deterministic given its two arguments.
- **`liveStatsView`** — pure: same arguments ⇒ deep-equal output, and it reads no
  clock (`now` is the only time source), no storage and no locale beyond `t()`.

### Live content, mode by mode

Money of the screen: `history` is newest first as stored, but the model **sorts** a
copy by `endedAt` descending, ties by `seed` ascending, so a hand-edited store still
renders predictably.

- **`totals`** (frame `08`) — `title: t('stats.title')`,
  `blurb: t('stats.blurbTotals')`, `tabs` = the three tabs, `columns: []`,
  `rows: []`, `month: null`, `actions: [ranking, back]`, and exactly **12**
  `figures`, in this order:

  | id | label key | value |
  | --- | --- | --- |
  | `runsPlayed` | `stats.runsPlayed` | `history.length`, plain integer |
  | `runsWon` | `stats.runsWon` | count of `won`, plain integer |
  | `winRate` | `stats.winRate` | `Math.round(won / runs * 100) + '%'`; em dash when `runs === 0` |
  | `bestFloor` | `stats.bestFloor` | `max(mapReached)`, plain integer; em dash when `runs === 0` |
  | `caught` | `stats.caught` | `sum(catches)` |
  | `lost` | `stats.lost` | `sum(casualties)` |
  | `playtime` | `stats.playtime` | `sum(playtimeMs)` as a duration; em dash when the sum is `0` |
  | `avgRun` | `stats.avgRun` | mean `playtimeMs` as a duration; em dash when `runs === 0` or the mean is `0` |
  | `longestRun` | `stats.longestRun` | `max(playtimeMs)` as a duration; em dash when `0` |
  | `kos` | `stats.kos` | `sum(species[].kos)` |
  | `dealt` | `stats.dealt` | `sum(species[].damage)` |
  | `lastRun` | `stats.lastRun` | the newest record's `endedAt` as `YYYY-MM-DD`; em dash when empty |

  When `history` is empty every value is the em dash and `empty` is
  `t('stats.emptyTotals')`.
- **`runs`** (frame `08b`) — `blurb: t('stats.blurbRuns')`, `figures: []`,
  `columns: []` (the frame has no header row), one row per record in the sorted
  order, `id: 'run-' + index`, `cells` exactly:
  `[won ? t('stats.win') : t('stats.loss'), record.seed, date(record.endedAt),
  t('stats.runMeta', { maps: mapReached, caught: catches, lost: casualties })]`.
  `empty` = `t('stats.emptyRuns')` when there are no records.
- **`pokemon`** (frame `08c`) — `blurb: t('stats.blurbPokemon')`,
  `columns: [colPokemon, colRuns, colKos, colDealt, colTanked]`, one row per species
  over **all** records' `species[]`, `id: speciesId`, `cells`:
  `[getSpecies(id)?.name ?? id, String(runs), String(kos), String(dealt), STATS_EM_DASH]`
  where `runs` counts the records whose `species[]` names the species and `kos` /
  `dealt` are its sums. Sorted by `speciesId` ascending. `empty` =
  `t('stats.emptyPokemon')` when no species row exists (which is today's store,
  see Coordination).
- **`ranking`** (frame `09`) — the **local** monthly record:
  `blurb: t('stats.blurbRanking')`, `tabs: []` (the frame draws no tab strip),
  `month: { label: months[i].label, canPrev: i < months.length - 1, canNext: i > 0 }`,
  `columns: [colPlayer, colRuns, colWins, colBestFloor]`, and **one** row
  `id: 'you'` with `cells: [t('stats.you'), String(runs), String(wins),
  String(bestFloor)]` for the selected month; `empty` = `t('stats.emptyMonth')`
  when that month has no runs. `actions: [ranking-pokemon, back]`.
  The month is `monthKey` when it is one of `statsMonths(...)`, else the first
  month (never a crash on a stale key).
- **`ranking-pokemon`** (frame `09b`) — all runs:
  `blurb: t('stats.blurbRankingPokemon')`, `tabs: []`,
  `month: { label: t('stats.allRuns'), canPrev: false, canNext: false }`,
  `columns: [colPokemon, colRuns, colKos, colDealt]`, rows = the same species
  aggregation as `pokemon` **sorted by `kos` descending, then `runs` descending,
  then `speciesId` ascending**, cells without the tanked column.
  `empty` = `t('stats.emptyPokemon')`. `actions: [ranking-players, back]`.
- **Tabs** (every mode except `08b`/`08c`, which are `runs`/`pokemon`): the three
  tab entries are always `[totals, runs, pokemon]` with
  `t('stats.tabTotals')`, `t('stats.tabRuns')`, `t('stats.tabPokemon')`, and
  `tabs` holds them for `totals`, `runs` and `pokemon`; for `ranking` and
  `ranking-pokemon` it is `[]` (the frames `09`/`09b` draw none).
- **Actions**: `back` always last with `t('stats.actionBack')`. In `totals`, `runs`
  and `pokemon` the list is `[ranking, back]` (`t('stats.actionRanking')`); in
  `ranking` it is `[ranking-pokemon, back]` (`t('stats.actionPokemon')`); in
  `ranking-pokemon` it is `[ranking-players, back]` (`t('stats.actionPlayers')`).
  These two extra actions are the **only** chrome the live panel adds over the
  stills; the frames are five stills and the game needs a way between them.
- **Formats** (pure helpers in the same file, unit-tested):
  - duration: `t('stats.duration', { hours, minutes })` with `minutes` zero-padded
    to two digits — `41H 20M`;
  - date: `t('stats.month.M')` + a zero-padded day — `OCT 18`;
  - month label: `t('stats.month.M')` + ` ` + the four-digit UTC year — `OCT 2026`.
  - `month.M` is `stats.month.1` … `stats.month.12`.

### `statsPanel.tsx`, `mount.tsx`, `preview.ts`, `index.ts`

Copy `src/ui/hud/panels/main-menu/` exactly, replacing names:

```ts
// mount.tsx
export type StatsIntent =
  | Readonly<{ type: 'tab'; mode: StatsMode }>
  | Readonly<{ type: 'action'; id: StatsActionId }>
  | Readonly<{ type: 'month'; delta: -1 | 1 }>;
export type StatsHandle = Readonly<{ update(view: StatsView): void; dispose(): void }>;
export function mountStats(
  host: Element,
  view: StatsView,
  onIntent?: ((intent: StatsIntent) => void) | undefined,
): StatsHandle;

// preview.ts
export function statsPreviewRequested(search: string): boolean;
/** Mounts the fixture's panel once into `#hud`; null when the URL does not ask. */
export function installStatsPreview(search: string): (() => void) | null;
```

- `index.ts` is the barrel (`STATS_SLUGS`, `STATS_MODES`, `STATS_EM_DASH`,
  `statsBoard`, `statsMonths`, `liveStatsView`, `fixtureStatsView`, `StatsPanel`,
  `mountStats`, `statsPreviewRequested`, `installStatsPreview`, and the types).
- `preview.ts` mirrors `run-over/preview.ts` **line for line**: a `PAYLOADS` map
  keyed by the five slugs, `statsPreviewRequested` = the `?hud=dom` flag **and** a
  stats slug, `installFixture` to validate the payload, an `installed` guard, the
  `queueMicrotask` attach and the disposer. Read `fixtureStatsView`'s block from the
  payload's `stats` key.
- **DOM attribute contract** (the house `data-hud-*` convention, and QA's only
  hook — do not rename them):
  - root `data-hud-panel="stats"`;
  - `data-hud-stats-title`, `data-hud-stats-blurb`;
  - each tab button `data-hud-stats-tab={mode}`;
  - each figure `data-hud-stats-figure={id}` containing
    `data-hud-stats-label` and `data-hud-stats-value`;
  - the table `data-hud-stats-table`, each header `data-hud-stats-column={index}`,
    each row `data-hud-stats-row={id}`, each cell `data-hud-stats-cell={index}`;
  - the empty line `data-hud-stats-empty`;
  - the selector `data-hud-stats-month` with `data-hud-stats-month-prev` and
    `data-hud-stats-month-next` buttons, disabled by `canPrev`/`canNext`;
  - each action button `data-hud-stats-action={id}`.
- The panel never reads the locale, the storage or a clock: everything arrives in
  the `StatsView`. Labels in `.tsx` come from props (the i18n call-site sweep only
  scans `.ts`).
- `stats.css` uses the kit's tokens (`design/tokens.json` values via `:root`), the
  `t-glass` surface the other migrated panels use, and a `600px` breakpoint with the
  `narrow` geometry. The panel's own geometry must land on `statsBoard(...)`'s rects.

### `src/scenes/MainMenuScene.ts`

- `MenuAction` gains `'stats'`; `MENU_LABELS` gains `stats: 'menu.stats'`.
- `create()` also keeps the history: `this.history = save.history` (new field
  `private history: readonly RunHistoryRecord[] = []`).
- The **Phaser/canvas path is unchanged**: `create()` still builds three (or two)
  `items`; only the DOM path gets the fourth row, because
  `createDom()` derives `this.items` from `MAIN_MENU_ACTIONS`.
- Module scope, beside `installMainMenuPreview(...)`:
  `installStatsPreview(typeof window === 'undefined' ? '' : window.location.search);`
  and `createDom()` returns early when **either** preview is requested:
  `if (mainMenuPreviewRequested(...) || statsPreviewRequested(...)) return;`.
- New state: `private stats: StatsHandle | null`, `private statsOpen = false`,
  `private statsMode: StatsMode = 'totals'`, `private statsMonth: string | null`.
- `openStats()`: dispose the menu panel, `mountStats(host, liveStatsView(this.history,
  'totals', firstMonth, new Date()), (intent) => this.handleStatsIntent(intent))`,
  set `statsOpen = true`. `closeStats()`: dispose the stats handle, remount the menu
  panel from `liveMainMenuView(this.run, this.index)`, `statsOpen = false`.
- `handleIntent`'s `case 'stats'` and `choose()`'s `case 'stats'` both call
  `openStats()` (today the intent is received and dropped).
- `handleStatsIntent`: `tab` → set `statsMode`; `action back` → `closeStats()`;
  `action ranking` → `statsMode = 'ranking'`; `ranking-players` → `'ranking'`;
  `ranking-pokemon` → `'ranking-pokemon'`; `month` → move the index inside
  `statsMonths(this.history, new Date())` and clamp. Every branch ends by updating
  the mounted panel with a freshly built `liveStatsView(...)`.
- While `statsOpen`: `handleAction` answers **only** `cancel` (→ `closeStats()`) and
  ignores every other action, and `render()` returns early (the panel owns the
  layer). Movement keys must never move the menu behind the panel.
- `disposePanel()`/`SHUTDOWN` also disposes the stats handle.

### `src/ui/hud/panels/main-menu/view.ts`

- `MAIN_MENU_ACTIONS` becomes `['continue', 'new', 'options', 'stats']`.
- `liveMainMenuView` always pushes the `stats` row after `options`:
  `{ id: 'stats', label: t('menu.stats'), value: '', enabled: true }`.
- `README.md` rule 5 is rewritten: the live DOM menu draws four rows and the STATS
  row opens the stats panel; the canvas fallback keeps three.

## 🧩 Data and configuration

### The five fixtures

`design/fixtures/<slug>.json`, each `{ "slug": "<slug>", "state": {…}, "stats": {…} }`:

- `state` is a complete `HudState` (`party`, `bag`, `money`, `route`, `battle`,
  `notice`) that passes `isHudState` — copy `01-main-menu.json`'s block and empty the
  party (`"party": []`) so the payload is about the stats screen.
- `stats` is the panel block, in the shape `fixtureStatsView` parses:
  `mode`, `title`, `blurb`, `tabs` (array of `{id,label}`), `figures` (array of
  `{id,label,value}`), `columns` (array of strings), `rows` (array of
  `{id, cells: string[]}`), `empty` (string or null), `month`
  (`{label, canPrev, canNext}` or null), `actions` (array of `{id,label}`).
- The copy and every figure are the **frame's own** (`design/frames/<slug>.json`):
  - `08-stats-totals`: the 12 `stat N label` / `stat N value` pairs, the three tabs,
    the title/blurb, the `SINCE …` line as `empty: null`, `actions: [BACK]`.
  - `08b-stats-runs`: the six rows' badge/seed/meta/date nodes, in frame order.
  - `08c-stats-pokemon`: the header row, the six `p …` rows and the five columns;
    the constraint `SEARCH` field is **not** modelled (see Out of scope).
  - `09-ranking`: the eight player rows, the four columns, `‹ OCT 2026 ›`.
  - `09b-ranking-pokemon`: the eight species rows, the four columns, `ALL RUNS`,
    `tabs: []` and only the `BACK` action.
- Each file must be loadable by `installFixture` (`FIXTURE_MODULES` picks it up
  automatically — never edit that registry).

### i18n keys (`src/i18n/en.ts`, mirrored in `es.ts`)

Add, after the `runOver` block (en) / its twin (es):

```
menu.stats                 STATS / ESTADÍSTICAS
stats.title                GLOBAL STATS / ESTADÍSTICAS
stats.blurbTotals          TOTALS ACROSS EVERY RUN. / TOTALES DE TODAS LAS PARTIDAS.
stats.blurbRuns            EVERY RUN, NEWEST FIRST. / TODAS LAS PARTIDAS, LA MÁS NUEVA PRIMERO.
stats.blurbPokemon         EVERY POKÉMON YOU HAVE RAISED. / TODOS LOS POKÉMON QUE HAS CRIADO.
stats.blurbRanking         MONTHLY RECORD · THIS DEVICE. / REGISTRO MENSUAL · ESTE EQUIPO.
stats.blurbRankingPokemon  POKÉMON RANKING · EVERY RUN. / CLASIFICACIÓN POKÉMON · TODAS LAS PARTIDAS.
stats.tabTotals            TOTALS / TOTALES
stats.tabRuns              RUNS / PARTIDAS
stats.tabPokemon           POKEMON / POKÉMON
stats.actionRanking        RANKING / CLASIFICACIÓN
stats.actionPlayers        PLAYERS / JUGADORES
stats.actionPokemon        POKEMON / POKÉMON
stats.actionBack           BACK / VOLVER
stats.runsPlayed           RUNS PLAYED / PARTIDAS JUGADAS
stats.runsWon              RUNS WON / PARTIDAS GANADAS
stats.winRate              WIN RATE / TASA DE VICTORIA
stats.bestFloor            BEST FLOOR / MEJOR PISO
stats.caught               POKÉMON CAUGHT / POKÉMON CAPTURADOS
stats.lost                 POKÉMON LOST / POKÉMON PERDIDOS
stats.playtime             TOTAL PLAYTIME / TIEMPO TOTAL
stats.avgRun               AVG RUN / MEDIA POR PARTIDA
stats.longestRun           LONGEST RUN / PARTIDA MÁS LARGA
stats.kos                  TOTAL KOS / KOS TOTALES
stats.dealt                TOTAL DMG DEALT / DAÑO TOTAL HECHO
stats.lastRun              LAST RUN / ÚLTIMA PARTIDA
stats.colPlayer            PLAYER / JUGADOR
stats.colRuns              RUNS / PARTIDAS
stats.colWins              WINS / VICTORIAS
stats.colBestFloor         BEST FLOOR / MEJOR PISO
stats.colPokemon           POKEMON / POKÉMON
stats.colKos               KOS / KOS
stats.colDealt             DMG DEALT / DAÑO HECHO
stats.colTanked            DMG TANKED / DAÑO RECIBIDO
stats.win                  WIN / VICTORIA
stats.loss                 LOSS / DERROTA
stats.you                  YOU / TÚ
stats.allRuns              ALL RUNS / TODAS
stats.duration             {hours}H {minutes}M / {hours}H {minutes}M
stats.runMeta              {maps} MAPS · {caught} CAUGHT · {lost} LOST / {maps} MAPAS · {caught} CAPTURADOS · {lost} PERDIDOS
stats.emptyTotals          NO FINISHED RUNS YET. / AÚN NO HAY PARTIDAS TERMINADAS.
stats.emptyRuns            NO RUNS RECORDED YET. / AÚN NO HAY PARTIDAS REGISTRADAS.
stats.emptyPokemon         NO POKÉMON RECORDED YET. / AÚN NO HAY POKÉMON REGISTRADOS.
stats.emptyMonth           NO RUNS THIS MONTH. / NO HAY PARTIDAS ESTE MES.
stats.month.1 … .12        JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC / ENE FEB MAR ABR MAY JUN JUL AGO SEP OCT NOV DIC
```

Every key must exist in **both** tables (the `es` table is typed against `en`),
`es` must use only FRLG-atlas glyphs and **no em dash** (`i18n/index.test.ts`), and
`{hours}`/`{minutes}`/`{maps}`/… must match each key's call site exactly.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm ci --prefer-offline --no-audit --no-fund` once, in the worktree.
  - `npm test` — Vitest, headless, green, including the new tests.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-155` against the exclusive paths list.
  - **Live:** `npm run dev -- --port <free> --strictPort` and the machine's headless
    Chromium, driven over CDP. Read the **DOM** (`Runtime.evaluate` with
    `document.querySelector…`), not the canvas: this screen is DOM. The browser is
    shared, so own your port, re-check `location.href` after every navigation, kill
    the server when done. Chromium here runs as root and needs `--no-sandbox`; if you
    use a wrapper script, pass it through `CHROME_PATH`. **`npm run hud:diff` is not a
    gate in this task** — it is red on `main` for already-shipped panels
    (`06-run-over-defeat`: 2.39 % pixels, ΔE 12.92), so a pixel comparison proves
    nothing about this one.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean (`npm run build`, exit 0).
  - [ ] `[unit]` `npm test` is green and these files exist and pass:
    `view.test.ts`, `fixture.test.ts`, `preview.test.ts`, and the updated
    `main-menu/view.test.ts`.
  - [ ] `[unit]` **Totals model.** `liveStatsView` over a synthetic 3-record history
    (fixed `now`) returns exactly 12 figures with the values of the table above:
    runs/wins, the rounded win rate, the best floor, the sums, the duration format
    (`41H 20M`), the newest `YYYY-MM-DD`, and the sums over `species[]`. With `[]`
    every value is the em dash and `empty` is the empty-totals line.
  - [ ] `[unit]` **Runs model.** One row per record, newest first (an out-of-order
    store is re-sorted), each row's four cells exactly `WIN|LOSS`, seed,
    `OCT 18`-style date and the `N MAPS · N CAUGHT · N LOST` meta; `columns` is
    empty; `empty` when the store is empty.
  - [ ] `[unit]` **Pokémon model.** Aggregation across records (a species in two
    records lists `runs = 2`, summed KOs and damage), the tanked column is always
    the em dash, the `pokemon` tab sorts by `speciesId` while `ranking-pokemon` sorts
    by `kos` desc then `runs` desc then `speciesId`, and both carry the right columns
    (5 vs 4).
  - [ ] `[unit]` **Ranking model.** `statsMonths` returns the months present in the
    records (UTC, newest first, deduped) and the current month alone when empty; the
    selector's `canPrev`/`canNext` clamp at both ends; a stale `monthKey` falls back
    to the first month; `ranking` holds the single `YOU` row with the month's runs,
    wins and best floor and `empty` when the month has none; `ranking-pokemon` says
    `ALL RUNS` with both arrows off; `tabs` is empty in both ranking modes.
  - [ ] `[unit]` **Purity.** Two identical calls return deep-equal views, and the
    model reads no clock: a test that stubs `Date.now` to throw still builds a view
    (the `now` argument is the only time source).
  - [ ] `[unit]` **Fixtures against the board.** Each of the five payloads passes
    `isHudState(state)`, parses through `fixtureStatsView`, and its `title`, `blurb`,
    `tabs`, `figures`/`columns`/`rows` and `actions` equal the corresponding
    `design/frames/<slug>.json` text nodes (the run-over `fixture.test.ts` idiom:
    walk `frame.text`, compare by node name, and pin `statsBoard('desktop')` /
    `statsBoard('narrow')` against the frame `geometry` rects).
  - [ ] `[unit]` **The row is live.** `main-menu/view.test.ts` proves
    `MAIN_MENU_ACTIONS` holds `stats`, the live view pushes the row with and without
    a run, and the cursor clamps over 4 rows (3 without a run).
  - [ ] `[unit]` Every new i18n key exists in `en` and `es`, and the existing
    i18n tests (glyph set, no em dash, call-site params) pass.
  - [ ] `[live]` **The main menu's STATS row opens the panel and BACK returns.**
    Measurement, at 1280×800, fresh profile, `?hud=dom` (no fixture): wait 1500 ms;
    `document.querySelectorAll('[data-hud-main-menu-row]').length === 3` and their
    `data-hud-main-menu-row` values are `['new','options','stats']`;
    `document.querySelector('[data-hud-main-menu-row="stats"] button').click()`;
    after 300 ms `document.querySelector('[data-hud-panel="stats"]') !== null`, the
    menu panel is gone, and `document.querySelector('[data-hud-stats-empty]').textContent`
    equals `NO FINISHED RUNS YET.` (the English locale); click
    `[data-hud-stats-action="back"]`; after 300 ms `[data-hud-panel="stats"]` is gone
    and the three menu rows are back.
  - [ ] `[live]` **Frame `08` paints its own copy.** Measurement, 1280×800,
    `?hud=dom&hudFixture=08-stats-totals`: `[data-hud-stats-figure]` nodes number
    exactly **12**, their `data-hud-stats-figure` ids are the 12 ids of the table
    above in order, and each figure's label/value text equals the fixture's; the
    title, blurb and the single `back` action equal the fixture's.
  - [ ] `[live]` **Frames `08b` and `08c` paint their rows.**
    `?hud=dom&hudFixture=08b-stats-runs`: exactly **6** `[data-hud-stats-row]`
    nodes and the first row's four `[data-hud-stats-cell]` texts equal the first
    fixture row; `?hud=dom&hudFixture=08c-stats-pokemon`: exactly **6** rows, the
    five `[data-hud-stats-column]` headers equal the fixture's columns, and the
    first row's five cells equal the first fixture row (the fifth being the em dash
    the fixture carries).
  - [ ] `[live]` **Frames `09` and `09b` paint their tables.** `?hud=dom&hudFixture=09-ranking`:
    exactly **8** rows, the four headers and `[data-hud-stats-month]`'s text equal
    the fixture's (`PLAYER`, `WINS`, `BEST STRIKE`, `PARTY`, `‹ OCT 2026 ›`), and
    the first row's cells equal the fixture's; `?hud=dom&hudFixture=09b-ranking-pokemon`:
    exactly **8** rows, four headers, the selector text `ALL RUNS`, and no
    `[data-hud-stats-tab]` nodes.
  - [ ] `[live]` **The panel lands on the board's geometry.**
    `?hud=dom&hudFixture=08-stats-totals` at 1280×800:
    `document.querySelector('[data-hud-panel="stats"]').getBoundingClientRect()`
    equals the `run over panel` rect of `design/frames/08-stats-totals.json`
    (page coords: the node's `x`, `y` minus the frame root's `y`, `width`,
    `height`) within **2 px on every edge**; at 390×844 the same slug's panel rect
    equals the `m panel` rect of `design/frames/m08-stats-totals.json` within
    **2 px**. Report both measured rects and both reference rects.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched; in particular no
    `src/engine/**`, no `src/data/**`, no `src/ui/hud/kit/**`, no `src/main.ts`.

## 📣 Coordination

- **The store has no production writer yet.** `Task-152` shipped
  `makeHistoryRecord` / `pushHistory` with **no caller**: nothing appends a finished
  run, and `RunState` carries no timestamp, so `playtimeMs` cannot be measured
  today. The live screen therefore renders its **empty states** in a real
  playthrough; the five frames are exercised through the fixtures. Do **not** add a
  writer here (it needs a run field and a `SAVE_VERSION` step, and Task-154 owns
  step 25) — the Orchestrator records the gap for the human. Reading
  `loadSave(browserStorage()).history` is still the right source.
- **The panel is a DOM migration under `?hud=dom`** (`D49`): the canvas fallback
  keeps three menu rows, and `src/main.ts` registers no new scene.
- **For the next batch:** the stats folder and its README already anticipate this
  migration; `panels/README.md`'s `stats/` line is updated here, so no later task
  owes it.
- **For QA:** `[data-hud-*]` attributes are the measurement surface; if one is
  missing the criterion is red, not "not run". `hud:diff` is out of the gate (it is
  red on `main`).

## ⛔ Out of scope

- **No history writer** (see Coordination) and no `SAVE_VERSION` step.
- **No search field** in the Pokémon table: frame `08c` draws `SEARCH POKEMON...`,
  but a text input is an intent plus a re-render loop the plan does not ask for; the
  table ships complete and unsorted-by-query. Say so in the folder README.
- No "all players" leaderboard: there are no other players, so `09`/`09b` show the
  **local** record with honest copy and no invented names.
- No change to `src/ui/hud/kit/**` (its barrel test pins exactly 16 exports), to
  `state.ts`/`projectHud` (no history goes into `HudState` — the six-key fixture
  contract), to `src/ui/runSummary.ts`, or to any engine rule.
- No new Phaser scene, no `src/main.ts` edit, no asset packing, no dependency.
