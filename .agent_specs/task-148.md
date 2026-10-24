# Spec: Task-148 — Run over is the HUD's

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene + DOM/Preact UI panel (no engine change).
- **Role:** Dev.
- **Objective:** Under `?hud=dom`, `src/scenes/RunOverScene.ts` draws no Phaser
  object; the score screen — the panel, the win/loss title and blurb, the four stat
  rows, the share line, the TOTALS / POKEMON tabs, the POKEMON table and the one
  action — becomes a Preact panel in `src/ui/hud/panels/run-over/` at frames `06`,
  `07` and `07b`'s boxes on 1280×800 and 390×844. The scene keeps the permadeath
  rule: it clears the save, arms the input delay and the confirm returns to the main
  menu. With the flag off nothing changes.
- **Environment:** worktree `../wt-pkm-148`, branch `task-148`, base `origin/main`
  `4cdd1da` (Batch 65). Install once with
  `npm ci --prefer-offline --no-audit --no-fund`.
- **Dependencies (already merged on `main`, read them, do not edit them):**
  - `Task-145` — `src/ui/hud/panels/main-menu/` (the full-screen panel pattern).
  - `Task-124`/`Task-125`/`Task-127` — shell, kit (`Panel`, `Row`, `Chip`, `Meta`,
    `PrimaryButton`) and the fixture store.
  - `Task-109` — the notice strip, not used here.

### Exclusive paths (single writer)

Nothing outside this list. **You own the batch's one i18n key table** — no other task
may edit it, and you add exactly the two keys below. Do not edit `src/engine/**`,
any other panel, `src/ui/runSummary.ts`, `src/ui/partyScreen.ts`, `TODO.md`,
`CHANGELOG.md` or `.agent_specs/`.

- `src/scenes/RunOverScene.ts` (modify)
- `src/ui/hud/panels/run-over/**` (new folder: the files below + README)
- `design/fixtures/06-run-over-defeat.json` (new)
- `design/fixtures/07-run-over-victory.json` (new)
- `design/fixtures/07b-run-over-victory-pokemon.json` (new)
- `src/i18n/en.ts` and `src/i18n/es.ts` (only `runOver.tabTotals`,
  `runOver.tabPokemon`)

### Inputs (read-only)

- `design/frames/06-run-over-defeat.json`, `07-run-over-victory.json`,
  `07b-run-over-victory-pokemon.json` and their `m…` twins — boxes and copy.
- `design/tokens.json`, `src/ui/hud/styles/root.css`, `src/ui/hud/kit/**`,
  `src/ui/hud/fixtures/**`, `docs/hud-fidelity.md`, `docs/hud-dom-proposal.md`,
  `docs/tech-decisions.md` `D49`.
- `src/ui/hud/panels/main-menu/**` (reference migration), `src/ui/runSummary.ts`
  (`runSummary`, `RunSummary`), `src/ui/partyScreen.ts` (`partyRows`, `boxRows`,
  `ripRows`, `PartyRow`), `src/data/keybinds.ts` (`keyLabel`), settings/keybinds as
  `RunOverScene` already reads them, `src/i18n/index.ts` (`t`).
- `src/scenes/RunOverScene.ts` (the code you are changing) and `AGENTS.md`.

## 🔒 Contract

Exports of `src/ui/hud/panels/run-over/` (the barrel re-exports all):

```ts
export const RUN_OVER_SLUGS: readonly [
  '06-run-over-defeat',
  '07-run-over-victory',
  '07b-run-over-victory-pokemon',
];
export type RunOverSlug = (typeof RUN_OVER_SLUGS)[number];

export type RunOverTab = 'totals' | 'pokemon';
export type RunOverStatId = 'routes' | 'catches' | 'lost' | 'fainted';
export type RunOverStatView = Readonly<{ id: RunOverStatId; label: string; value: string }>;
export type RunOverRowView = Readonly<{
  memberId: string;
  name: string;
  state: 'party' | 'box' | 'rip';
  level: number;
  /** `null` means the run does not record it: the panel draws the em dash. */
  kos: string | null;
  dealt: string | null;
  tanked: string | null;
}>;
export type RunOverView = Readonly<{
  won: boolean;
  title: string;
  blurb: string;
  stats: readonly RunOverStatView[]; // routes, catches, lost, fainted, in this order
  share: string;
  tab: RunOverTab;
  rows: readonly RunOverRowView[]; // empty on TOTALS; live order is party, box, rip
  button: Readonly<{ label: string }>;
}>;

/** Live: runSummary's numbers, the run's rows, the current tab and the action copy. */
export function liveRunOverView(
  run: RunState,
  won: boolean,
  tab: RunOverTab,
  confirmKey: string,
): RunOverView;
/** The frame's own payload, or null when it is not one this panel can draw. */
export function fixtureRunOverView(payload: unknown): RunOverView | null;

/** Both boards' measured rects, for the fixture test and the diff. */
export function runOverBoard(viewport: 'desktop' | 'narrow'): Readonly<{
  panel: Readonly<{ x: number; y: number; w: number; h: number; radius: number }>;
  title: Readonly<{ x: number; y: number; w: number; h: number }>;
  blurb: Readonly<{ x: number; y: number; w: number; h: number }>;
  tabs: readonly Readonly<{ id: RunOverTab; x: number; y: number; w: number; h: number }>[];
  statLabel: Readonly<{ x: number; y: number; w: number; h: number; pitch: number }>;
  statValue: Readonly<{ x: number; y: number; w: number; h: number; pitch: number }>;
  share: Readonly<{ x: number; y: number; w: number; h: number }>;
  button: Readonly<{ x: number; y: number; w: number; h: number }>;
  row: Readonly<{ x: number; y: number; w: number; h: number; pitch: number }>;
}>;

export type RunOverIntent = Readonly<{ type: 'tab'; tab: RunOverTab }> | Readonly<{ type: 'confirm' }>;

export type RunOverHandle = Readonly<{
  update(view: RunOverView): void; // one render per changed view
  dispose(): void;
}>;
export function mountRunOver(
  host: Element,
  view: RunOverView,
  onIntent?: ((intent: RunOverIntent) => void) | undefined,
): RunOverHandle;

export function runOverPreviewRequested(search: string): boolean;
export function installRunOverPreview(search: string): (() => void) | null;
```

`mountRunOver` writes `[data-hud-run-over]`, `data-won`, `[data-hud-run-over-title]`,
`[data-hud-run-over-stat="<id>"]` (label/value spans),
`[data-hud-run-over-tab="totals"|"pokemon"]` (`data-selected`), a
`[data-hud-run-over-row]` per row (with `data-state`) and `[data-hud-run-over-button]`.
Both tabs are real buttons; the active tab paints the board's selected chip.
Every null column and the `fainted` stat's live `'—'` are rendered as the **em dash
`—` (U+2014)**, one cell, never a number. The panel is pure presentation: no run, no
scene, no clock, no i18n call — every string arrives in the view.

### Data honesty (hard rule)

The run records **no** enemies-fainted counter and **no** per-member KOs, damage
dealt or damage taken. Therefore:

- `liveRunOverView` sets `fainted.value = '—'`, and every live row's `kos`, `dealt`
  and `tanked` are `null` → the panel draws `—`.
- The three fixtures carry the frame's own numbers (e.g. `37`, `4,120`, `2,140`) so
  the board's geometry is reproduced exactly for the diff. Those numbers exist only
  in the fixture payload; no code derives them.
- Never compute, seed or invent a spoiler number. A later engine task will add the
  counters; this task only refuses to lie. Record it in the folder README and in the
  report.

### Scene contract (`src/scenes/RunOverScene.ts`)

1. Read the flag once at module scope (`DOM_HUD`, like `MainMenuScene`) and call
   `installRunOverPreview(window.location.search)` at module scope, so
   `?hud=dom&hudFixture=<slug>` paints the frame without walking the game.
2. Under the flag `create()` must build **no Phaser display object** (no background
   rectangle, no FRLG window, no text) and mount the panel; it still calls
   `clearRun(browserStorage())`, still arms `RUN_OVER_INPUT_DELAY_MS` and still
   subscribes the keybinds; dispose the panel on `SHUTDOWN`.
3. The scene owns the tab (`'totals'` at create). `tab` intents switch and repaint;
   `confirm` calls the existing `returnToMenu()` guarded by `armed` (exactly today's
   A press). Left/right keybinds may also switch tabs, but the click path is what the
   criteria read.
4. `render()` under the flag updates the panel with
   `liveRunOverView(this.run, this.won, this.tab, keyLabel(loadSettings().keybinds.confirm))`;
   the button's copy is `t('runOver.return', { key })`.
5. The four live stat labels are `t('runOver.routes')`'s label half and the
   `runOver.*` family already in the table; values are `String(n).padStart(2, '0')`
   for routes/catches/lost and `'—'` for fainted. The share line is
   `t('runOver.share', { share: summary.share })`. The two tab labels are the new keys.
6. Export `export function runOverDrawnObjectCount(scene: Phaser.Scene): number`
   returning `scene.children.length` (0 under the flag).
7. Flag off: the canvas screen is unchanged, including the armed delay and the
   return to `MainMenu`.

### New i18n keys (the only table edit)

```ts
// en.ts
'runOver.tabTotals': 'TOTALS',
'runOver.tabPokemon': 'POKEMON',
// es.ts
'runOver.tabTotals': 'TOTALES',
'runOver.tabPokemon': 'POKÉMON',
```

Nothing else in either table may move; the i18n tests (key parity, no empty value)
must stay green.

## 🧩 Data and configuration

Fixture shape (one file per slug, all three with a valid `HudState` under `state`):

```json
{
  "slug": "07-run-over-victory",
  "state": { "party": [], "bag": [], "money": null, "route": null, "battle": {}, "notice": null },
  "runOver": {
    "won": true,
    "tab": "totals",
    "title": "THE FINAL ROUTE FALLS.",
    "blurb": "EVERY ROUTE CLEARED · THE CHAIN ENDS HERE.",
    "stats": [
      { "id": "routes", "label": "ROUTES CLEARED", "value": "08" },
      { "id": "catches", "label": "POKEMON CAUGHT", "value": "17" },
      { "id": "lost", "label": "POKEMON LOST", "value": "04" },
      { "id": "fainted", "label": "ENEMIES FAINTED", "value": "37" }
    ],
    "share": "SHARE: PKRL-1-f-7F3A-2C",
    "button": { "label": "END RUN" },
    "rows": []
  }
}
```

`07b` sets `"tab": "pokemon"` and carries the frame's five rows with
`kos`/`dealt`/`tanked` as strings; `06` is the defeat variant with the board's
"MAIN MENU" button. `fixtureRunOverView` rejects a payload with a wrong/missing
field, an unknown stat id or tab, or a row with a non-string non-null column, and
returns `null`; never throws.

Board measurements to pin (desktop; read the frames for the rest):

- `06`/`07`: panel `280,170 720×480` r11; highlight `292,182 692×1`; accent
  `616,186 48×2`; rules `336,386/432/478/524 608×1`; title `320,196 640×36`; blurb
  `320,236 640×20`; tabs `336,312 90×24` and `432,312 100×24`; labels `336,316` and
  `432,316`; stat labels `336,360/406/452/498 300×16`; values
  `764,358/404/450/496 180×20`; share `336,544 608×12`; `06` button `540,590 200×40`
  (label `540,604`), `07` buttons `428,590` and `652,590 200×40`; `07` portraits
  `542/594/646/698,262 40×40`.
- `07b`: filter labels `336/516/696,355`; headers `378/640/720/840,382`; rows
  `336,406/438/474/510/546 608×32` r6; names `378,y+3`, portraits `346,y 24×24`.
- `m06`: panel `8,140 374×560` r12; accent `171,160 48×2`; rules `32,280/326/372/418
  326×1`; title `134,174`; blurb `141,202`; labels `32,250/296/342/388`, values
  `300,…`; share `32,500`; button `35,600 320×44` r10; label `157,612`.
- `m07`: panel `8,96 374×604` r12; tabs `32,236 90×28` and `130,236 100×28`;
  portraits `97/149/201/253,188 40×40`; stats `32,280/326/372/418`; share `32,530`;
  buttons `35,600 150×44` and `205,600 150×44`.

The panel uses the kit `Panel` for the card and `Row` for the table rows; every
colour/size/radius comes from `--hud-*` tokens or a scoped custom property; no
literal colour, no shadow the board does not draw.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; green, including the new tests and the i18n parity
    test.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-148` against the exclusive list; nothing else.
  - Live readings over CDP against `npm run dev -- --port <free> --strictPort` on
    `/usr/bin/chromium`, via `getBoundingClientRect()`/computed styles and scene
    reads, not screenshots. To open the screen without a run, build one in the page:
    `const { createRunPokemon } = await import('/src/engine/run/progression.ts');
     const { createRun } = await import('/src/engine/run/state.ts');
     const starter = createRunPokemon({ id: 'starter', speciesId: 'charmander', level: 5, learnsetSeed: 'qa' });
     const run = createRun({ seed: 'qa', starter });
     game.scene.start('RunOver', { run, won: true })` (add
    `rip` members with `{ ...run, rip: [...] }` to test the POKEMON tab).
  - `npm run hud:diff -- <slug>` is evidence if it runs here; not a gate.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `npm test` green; new tests cover `liveRunOverView` (badges/values
    from a `createRun` state, `—` for fainted and for every live row column, the
    tab's rows from party/box/rip, the share and the button copy) and
    `fixtureRunOverView` (three good payloads + five rejection cases) and the boards'
    rects, headless.
  - [ ] `[unit]` The i18n tables gain exactly the two keys and nothing else; key
    parity between `en.ts` and `es.ts` holds.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched; `src/engine/**`,
    the other panels and `src/ui/runSummary.ts` are unchanged.
  - [ ] `[live]` With `?hud=dom&hudFixture=06-run-over-defeat` at 1280×800, the panel
    is `280,170 720×480` ±2 r11, the title `320,196`, the blurb `320,236`, the four
    labels' tops `360/406/452/498` ±2, the values' tops `358/404/450/496` ±2, the
    tabs `336,312 90×24` and `432,312 100×24` ±2, the share top 544 ±2 and the
    button `540,590 200×40` ±2.
  - [ ] `[live]` The `07` fixture adds the second button at `652,590 200×40` and the
    four party portraits at `542/594/646/698,262 40×40` ±2; the `07b` fixture selects
    the POKEMON tab and draws five rows `336,406 608×32` at a 36 px pitch ±2, with the
    frame's `kos`/`dealt`/`tanked` numbers in the fixture.
  - [ ] `[live]` Both `m06` and `m07` fixtures at 390×844: the panel is
    `8,140 374×560` / `8,96 374×604` ±2, the tabs `32,236 90×28` and
    `130,236 100×28` ±2 (07), the actions `35,600 320×44` (06) and
    `35,600`+`205,600 150×44` (07) ±2; `document.documentElement.scrollWidth === 390`.
  - [ ] `[live]` In a flag-on live run-over (built as above),
    `runOverDrawnObjectCount(game.scene.getScene('RunOver')) === 0` where the flag-off
    scene paints > 5; the title equals `t('runOver.headlineLoss')` for `won: false`
    and the win blurb for `won: true`; the four values equal the padded
    `runSummary` numbers and the fainted cell's `textContent` is `'—'`.
  - [ ] `[live]` In that live screen the POKEMON tab lists exactly
    `run.party.length + run.box.length + run.rip.length` rows, in that order (the
    board's PARTY / PC / FNT states), every `kos`/`dealt`/`tanked` cell reads `'—'`
    (no figure appears anywhere in the live table), clicking the TOTALS tab returns
    to the summary, and the confirm key returns to the main menu only after
    `RUN_OVER_INPUT_DELAY_MS` (an immediate press is ignored).

## 📣 Coordination

- For the next batch: the score screen's live figures are `runSummary`'s; the
  board's enemies-fainted and per-member KO/damage columns are **not recorded** and
  ship as `—`. A later engine task must add those counters before the columns can
  carry numbers; the fixture keeps the board's figures for layout only.
- For the Architect: this task is where the missing counters surface; register the
  engine task when a batch leaves `src/engine/run/**` free.
- For QA: the three fixtures are the only place the frame's numbers exist; a live
  numeric KO/damage value is a failure, not a pass.

## ⛔ Out of scope

- Any new run field, save format, `SAVE_VERSION` step or engine counter.
- A stats/ranking screen (Task-146 is blocked, issue #51).
- New copy beyond the two tab keys; changes to `runSummary` or `partyScreen`.
- The full-board diff of frames `07b`'s filter controls (MOST KOs / MOST DAMAGE /
  MOST TANKED): the live screen has no sortable columns because it has no figures —
  the fixture may draw the labels; do not wire sorting.
