# Spec: Task-199 — The main menu prints its three records and its version

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** data + Phaser/DOM panel (pure view model, one scene, one i18n pair, docs).
- **Role:** Dev.
- **Objective:** after this task the main menu's footer is **live data**, not an empty
  list, and the version line is printed: `liveMainMenuView` takes a record set and one
  version string and returns the board's three figures (`WINS`, `MAX ELITE STRIKE`,
  `MONTHLY MAX STRIKE`) plus the `v<package version> · PHASE <n>` line, and
  `MainMenuScene` builds both from the save it already reads (`save.history`) and from the
  build, so the panel stops painting `stats: []` / `version: null`.
- **Environment:** worktree `../wt-pkm-199`, branch `task-199`.
- **Dependencies:** none to merge. The files it reads and must not change are
  `src/engine/run/history.ts` (`RunHistoryRecord`: `seed`, `mode`, `mapReached`,
  `catches`, `casualties`, `playtimeMs`, `won`, `endedAt`, `species`;
  `RunMode = 'finite' | 'infinite'`), `src/engine/save.ts` (`loadSave().history`) and
  `src/ui/hud/panels/main-menu/mainMenuPanel.tsx` (which already paints
  `view.stats` into `[data-hud-main-menu-stat]` and `view.version` into
  `[data-hud-main-menu-version]`).

### Exclusive paths (single writer)

Nothing outside this list. No other task in Batch 87 claims any of these.

- `src/ui/hud/panels/main-menu/view.ts`
- `src/ui/hud/panels/main-menu/view.test.ts`
- `src/ui/hud/panels/main-menu/version.ts` *(new)*
- `src/ui/hud/panels/main-menu/version.test.ts` *(new)*
- `src/ui/hud/panels/main-menu/index.ts`
- `src/ui/hud/panels/main-menu/README.md`
- `src/ui/hud/panels/main-menu/main-menu.css` *(only if a measured offset must move)*
- `src/ui/hud/panels/stats/records.ts` *(new)*
- `src/ui/hud/panels/stats/records.test.ts` *(new)*
- `src/ui/hud/panels/stats/view.ts`
- `src/ui/hud/panels/stats/view.test.ts`
- `src/ui/hud/panels/stats/README.md`
- `src/scenes/MainMenuScene.ts`
- `src/scenes/MainMenuScene.test.ts`
- `src/i18n/en.ts`
- `src/i18n/es.ts`
- `docs/design-spec.md` — **§2 only**
- `docs/hud-fidelity.md` — **`## 9. Portraits in the DOM HUD` only**

`package.json` is **not** yours: no version bump, no new dependency, no script.

### Inputs (read-only)

Beyond `AGENTS.md`:

- `src/engine/run/history.ts`, `src/engine/run/state.ts` (`RunMode`, `RunState`),
  `src/engine/save.ts` (`SaveDocument.history`, `loadSave`).
- `src/ui/hud/panels/main-menu/{mainMenuPanel.tsx,main-menu.css,mount.tsx,README.md}`,
  `src/ui/hud/panels/stats/{view.ts,README.md}`.
- `design/frames/01-main-menu.json`, `design/frames/m01-main-menu.json`,
  `design/fixtures/01-main-menu.json` (the board's own copy: `version`
  `"v0.7.0 · PHASE 7"`, `stats` `WINS 23` / `MAX ELITE STRIKE 2` /
  `MONTHLY MAX STRIKE 7` + `NOVA`).
- `docs/design-spec.md` §2, `docs/hud-fidelity.md` §9, `docs/tech-decisions.md` D11/D43.
- `src/i18n/index.ts` (`t`, `TranslationKey`, `setLocale`), `src/i18n/index.test.ts`
  (the parity/glyph/width gate your two new keys must pass).

## 🔒 Contract

### TypeScript

```ts
// src/ui/hud/panels/stats/records.ts  (new: the arithmetic the stats screen and the menu share)
import type { RunHistoryRecord } from '../../../../engine/run/history';

/** The finished runs that were won. */
export function historyWins(history: readonly RunHistoryRecord[]): number;

/** The deepest floor (1-based `mapReached`) in `history`; 0 for an empty list. */
export function historyBestFloor(history: readonly RunHistoryRecord[]): number;

/** `YYYY-MM` in UTC for `now`, or null for an instant the store cannot read. */
export function recordMonthKey(now: Date): string | null;
```

```ts
// src/ui/hud/panels/main-menu/version.ts  (new)
import pkg from '../../../../../package.json';

/** The version string `package.json` carries. */
export const APP_VERSION: string;

/** The roadmap phase this build ships (`TODO.md`'s current phase): 17 today. */
export const MENU_PHASE: number;

/** `<v><version> · PHASE <phase>`, the board's own shape: `v0.7.0 · PHASE 7`. */
export function menuVersionLabel(version?: string, phase?: number): string;
```

- `menuVersionLabel()` with no arguments is `\`v${APP_VERSION} · PHASE ${MENU_PHASE}\``;
  the separator is ` · ` (space, U+00B7, space), the `v` is lowercase and `PHASE` uppercase.
- `APP_VERSION` is `pkg.version` **read, never hardcoded**. `resolveJsonModule` is on in
  `tsconfig.json`, so the default JSON import is the contract; if `npm run build` rejects
  that form under this tsconfig, use the import-attribute form
  `import pkg from '../../../../../package.json' with { type: 'json' };` and say so in your
  report. Do **not** replace it with a literal.
- `MENU_PHASE` is UI copy, not a game rule: it is `17` (the phase `TODO.md` currently
  opens) and a new phase bumps this one line.

```ts
// src/ui/hud/panels/main-menu/view.ts  (changed)
import type { RunHistoryRecord } from '../../../../engine/run/history';

export type MainMenuRecords = Readonly<{
  wins: number;
  /** The deepest floor a **finite** run reached; 0 when none has. */
  elite: number;
  /** The deepest floor a finite run reached in the current UTC month; 0 when none has. */
  monthly: number;
  /** The month the monthly figure belongs to, as `statsMonthLabel` prints it (`OCT 2026`). */
  monthlyLabel: string;
}>;

export const EMPTY_MAIN_MENU_RECORDS: MainMenuRecords;

/** The footer's three figures, always three, in `['wins','elite','monthly']` order. */
export function mainMenuStats(records: MainMenuRecords): readonly MainMenuStatView[];

/** The live records from the store and the clock the caller supplies. */
export function mainMenuRecords(history: readonly RunHistoryRecord[], now: Date): MainMenuRecords;

export function liveMainMenuView(
  run: RunState | null,
  index: number,
  previewSeed?: string,          // default MAIN_MENU_SLUG, unchanged
  records?: MainMenuRecords,     // default EMPTY_MAIN_MENU_RECORDS
  version?: string | null,       // default null
): MainMenuView;
```

Rules for the three figures:

- `wins` = `historyWins(history)` — every record with `won === true`.
- `elite` = `historyBestFloor(history.filter((r) => r.mode === 'finite'))` — an
  **infinite-mode** record never raises it.
- `monthly` = `historyBestFloor(history.filter((r) => r.mode === 'finite' &&
  recordMonthKey(new Date(r.endedAt)) === recordMonthKey(now)))` — the same finite rule,
  restricted to `now`'s UTC month; a record with an unreadable `endedAt` is skipped.
- `monthlyLabel` = `statsMonthLabel(recordMonthKey(now) ?? '')` (import it from
  `../stats/view`; `''` is what that function already returns for an unreadable key).
- `mainMenuStats(records)` returns exactly three `MainMenuStatView`s:
  - `{ id: 'wins',   label: t('menu.stat.wins'),   value: String(records.wins),   name: null }`
  - `{ id: 'elite',  label: t('menu.stat.elite'),  value: String(records.elite),  name: null }`
  - `{ id: 'monthly',label: t('menu.stat.monthly'),value: String(records.monthly),name: records.monthlyLabel === '' ? null : records.monthlyLabel }`
  Values are `'0'`, never `''` — the empty state prints the labels and zeroes, never a blank.
- `liveMainMenuView` returns `stats: mainMenuStats(records)` (always three) and
  `version`. `EMPTY_MAIN_MENU_RECORDS` is `{ wins: 0, elite: 0, monthly: 0, monthlyLabel: '' }`,
  so a call with no record set (every existing unit test, and the fixture path) returns
  `monthly.name === null` and still three figures.
- **`forLayout` is unchanged.** Compact still drops only the CONTINUE row's `value` and
  returns `version` and `stats` untouched; the phone hides the version line in CSS
  (`main-menu.css`'s `@media (max-width: 600px)` `.main-menu__version { display: none; }`).
- The view still reads no clock and no storage: `now` is an argument, `mainMenuRecords`
  and `mainMenuStats` are pure, the same arguments return a deep-equal view.

```ts
// src/scenes/MainMenuScene.ts  (changed)
private records: MainMenuRecords = EMPTY_MAIN_MENU_RECORDS;
private versionLabel: string = menuVersionLabel();

private menuView(): MainMenuView {
  return liveMainMenuView(this.run, this.index, this.previewSeed, this.records, this.versionLabel);
}
```

- In `create()`, after `this.history = save.history;`, set
  `this.records = mainMenuRecords(this.history, new Date());`. `new Date()` is the scene's
  clock (the same read `statsView()` already makes); the engine and the view stay
  clock-free (`D11`).
- `this.versionLabel` is initialised once from `menuVersionLabel()`, not per repaint.
- Exactly **one** `liveMainMenuView(` call site stays in the scene, and it is the line
  above.

### Data

New translation keys, added to **both** `src/i18n/en.ts` and `src/i18n/es.ts` in the same
edit, next to `menu.stats`:

| key | `en` | `es` |
| --- | --- | --- |
| `menu.stat.wins` | `WINS` | `VICTORIAS` |
| `menu.stat.elite` | `MAX ELITE STRIKE` | `MEJOR ASALTO ÉLITE` |
| `menu.stat.monthly` | `MONTHLY MAX STRIKE` | `ASALTO MÁXIMO DEL MES` |

The version line is **not** a key: it is build metadata (`v`, a semver, `PHASE`, a
number), identical in every locale, and `menuVersionLabel` is a pure formatter.

No other key, no `MISSING_ES` change, no data table, no `SAVE_VERSION` bump.

## 🧩 Data and configuration

- `MainMenuStatView.name` widens its meaning from "the record holder" to "the record's
  own label": the board prints a holder (`NOVA`), the live menu prints the **month** the
  figure belongs to, because `RunHistoryRecord` carries no player name and the save format
  is not yours to change. Update the type's doc line to say so.
- Nothing else in `MainMenuView` changes: `title`, `rows`, `portraits`, `selected`,
  `previewSeed` keep their shape, and `fixtureMainMenuView` (the frame's own copy) is
  untouched.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; green, including the tests below.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-199` audited against the exclusive-path list above.
  - **Browser pass:** `npm run dev` (Vite on port **5175**), Chromium at
    `/usr/bin/chromium`, the DOM HUD at `http://localhost:5175/?hud=dom` (the main menu is
    the boot screen), viewports exactly **1280×800** and **390×844**. Read the DOM over
    CDP (`Runtime.evaluate` + `getBoundingClientRect`), not a screenshot. The asset store
    lives at `$ASSETS_ROOT` and must **never** be symlinked into the worktree; a clean tree
    with only `src/assets/placeholders/` is enough for this task (the footer and the
    version line draw no art).
  - The end-to-end "finish a run and come back" pass is **not** owed: the repository has
    no browser seam that writes a `RunHistoryRecord` (no dev-menu writer, and the save is
    an encoded document), so the history path is proven `[unit]` instead — see the second
    and third criteria below.

- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` is clean: the JSON import resolves, the new signatures
        typecheck, no unused export.
  - [ ] `[unit]` `npm test` green, including: `version.test.ts` pins
        `menuVersionLabel('0.7.0', 7) === 'v0.7.0 · PHASE 7'` (**the board's own string in
        `design/fixtures/01-main-menu.json`'s `menu.version`**), `menuVersionLabel()` equals
        `\`v${APP_VERSION} · PHASE ${MENU_PHASE}\``, and `MENU_PHASE === 17`.
  - [ ] `[unit]` `stats/records.test.ts`: on a hand-built history of three records —
        one won finite at floor 5, one lost finite at floor 2, one infinite at floor 9 —
        `historyWins` is `1`, `historyBestFloor(all)` is `9`,
        `historyBestFloor(finite only)` is `5`, and `recordMonthKey` reads
        `'2026-10'` for `new Date('2026-10-18T12:00:00.000Z')` and `null` for `'not-a-date'`.
  - [ ] `[unit]` `view.test.ts`: `mainMenuRecords` ignores the infinite record for `elite`
        and the out-of-month record for `monthly` (a run ending `2026-09-30T23:59:59Z` with
        `now = new Date('2026-10-18T12:00:00Z')` contributes nothing); `monthlyLabel` is
        `'OCT 2026'` for that `now`.
  - [ ] `[unit]` `view.test.ts`: `liveMainMenuView(run, 0, seed, records, 'v1 · PHASE 2')`
        returns `version === 'v1 · PHASE 2'`, three `stats` with ids
        `['wins','elite','monthly']`, and `monthly.name === 'OCT 2026'`;
        `liveMainMenuView(run, 0)` (no records, no version) still returns **three** stats
        whose values are all `'0'` and `version === null`, and never `''` where a figure
        belongs.
  - [ ] `[unit]` `view.test.ts`: `mainMenuStats(EMPTY_MAIN_MENU_RECORDS)`'s labels are
        `t('menu.stat.wins' | 'menu.stat.elite' | 'menu.stat.monthly')`, and with
        `setLocale('es')` they read `VICTORIAS` / `MEJOR ASALTO ÉLITE` /
        `ASALTO MÁXIMO DEL MES` (restore `setLocale(DEFAULT_LOCALE)` afterwards).
  - [ ] `[unit]` `MainMenuScene.test.ts`: the source carries exactly one
        `liveMainMenuView(` and exactly one
        `return liveMainMenuView(this.run, this.index, this.previewSeed, this.records, this.versionLabel);`
        (the existing pin at `'return liveMainMenuView(this.run, this.index, this.previewSeed);'`
        is updated to this string in the same edit), `create()` still draws the preview
        seed once, and the scene still calls no `Date.now()`.
  - [ ] `[unit]` `npm test` still passes the i18n gate: key parity both ways, the glyph
        check for the three Spanish labels (no em dash) and the width guards.
  - [ ] `[live]` At **1280×800** on `?hud=dom` with a fresh profile (empty history):
        `document.querySelectorAll('[data-hud-main-menu-stat]')` has **length 3**; their
        `[data-hud-main-menu-stat]` attributes read `wins`, `elite`, `monthly` in that
        order; each `.main-menu__stat-label`'s `textContent` equals `WINS` /
        `MAX ELITE STRIKE` / `MONTHLY MAX STRIKE`; each `.main-menu__stat-value`'s
        `textContent` is `0`; `monthly`'s `.main-menu__stat-name` `textContent` equals the
        current UTC month label (`OCT 2026` on the day of the run) and the `wins`/`elite`
        ones have no name node.
  - [ ] `[live]` Same page: the three `[data-hud-main-menu-stat="…"]` boxes'
        `getBoundingClientRect()` are `left` **96**, **240**, **724** at 1280×800, each
        **within 1 px** of the board's columns (`MAIN_MENU_BOARD.footer.columns`) and of
        width ≤ 320; no two boxes intersect; the box's top edge is **616 ± 1**
        (`MAIN_MENU_BOARD.footer.labelY`).
  - [ ] `[live]` Same page: `[data-hud-main-menu-version]`'s `textContent` equals
        `` `v${packageJson.version} · PHASE 17` `` (`v0.0.0 · PHASE 17` on this tree) and its
        rect is `{ left: 1065, top: 750 }` **± 1 px** (`MAIN_MENU_BOARD.version`), height
        15 ± 1.
  - [ ] `[live]` At **390×844** on the same URL: the three stat boxes' rects equal
        `MAIN_MENU_FOOTER_NARROW`'s three blocks **within 1 px**
        (`wins` `{x:16,y:676,w:172,h:48}`, `elite` `{x:196,y:676,…}`,
        `monthly` `{x:16,y:732,…}`), no two of them intersect, and every label and value is
        inside its own block (four edges, 1 px tolerance — this is the wrap the board's
        phone frame forced); `getComputedStyle` of `[data-hud-main-menu-version]` reports
        `display: none` (the phone frames draw no version line).

## 📣 Coordination

**Premises of the task entry I corrected against the tree (read these before you start):**

1. The entry says the live menu draws "none of them" because `liveMainMenuView` returns
   `version: null` and `stats: []` — that part is exact (view.ts, the `return` block of
   `liveMainMenuView`). The footer's **geometry already exists**: `MAIN_MENU_FOOTER_NARROW`
   (two-row phone rects), `MAIN_MENU_BOARD.footer` (desk columns 96/240/724),
   `MAIN_MENU_BOARD.version` (`{ x: 1065, y: 750, w: 122, h: 15 }`),
   `MainMenuStatId`/`MainMenuStatView`, and `mainMenuPanel.tsx` already paints
   `[data-hud-main-menu-footer]`, `[data-hud-main-menu-stat]`, `.main-menu__stat-name` and
   `[data-hud-main-menu-version]`. You add **no** geometry and **no** markup; you feed the
   view.
2. The entry says the stats panel "(`src/ui/hud/panels/stats/view.ts` 436) already computes
   wins and the best floor". Line 436 is a closing brace of `runsView`; the computation is
   `totalsView` (`history.filter((record) => record.won).length` and
   `Math.max(...history.map((record) => nonNegative(record.mapReached)))`, around lines
   324–331). Lift those two into `stats/records.ts` and have `totalsView` call them:
   stats' own `bestFloor` keeps counting **every** record (infinite included) — do not
   change the stats screen's numbers; the menu filters to finite before calling the same
   function.
3. The entry says the monthly figure carries "the record's own label beside it". A
   `RunHistoryRecord` has no player label (`seed`, `mode`, `mapReached`, `catches`,
   `casualties`, `playtimeMs`, `won`, `endedAt`, `species`) and the board's `NOVA` is
   accepted fiction. The live menu prints the **month** there instead; see the contract's
   note on `MainMenuStatView.name`.
4. The entry claims `docs/hud-fidelity.md` §9 for "the footer's blocks and their wraps" —
   correct, §9 is `## 9. Portraits in the DOM HUD` and already ends with the footer's
   two-row decision and the CONTINUE row's portraits. Extend that section's footer
   paragraph with **what the three figures count** and the version line; do not restate
   the rects that are already there.
5. `package.json`'s `version` is `0.0.0`, so the live line reads `v0.0.0 · PHASE 17` on
   this tree. That is the honest build stamp; a release version is the human's call, not a
   silent literal in the panel.

- **For the Architect:** the entry's `[live]` ("finish a run and come back") has no
  executable seam in this repo; it is delivered as the `[unit]` history tests plus the
  scene's source pins. `docs/design-spec.md` §2 is yours alone in this batch; §4 belongs to
  `[Task-206]` and no other section may move.
- **For `[Task-201]` / `[Task-211]` (later batches, same panel and scene):** the footer is
  `mainMenuStats(MainMenuRecords)` returning always three entries, and the version is a
  fifth positional argument of `liveMainMenuView`; the scene holds `records` and
  `versionLabel` as fields. `[Task-211]`'s fifth row only touches `MAIN_MENU_ROW_IDS` and
  the card height, not the footer.
- **For `[Task-210]`** (the global ranking): the month arithmetic you will count against is
  `recordMonthKey(now)` in `stats/records.ts` — one UTC month key, no local time.
- **Integration QA:** `docs/hud-fidelity.md` is held by three tasks this batch
  (`[Task-199]` §9, `[Task-203]` two §5 blocks + §6, `[Task-206]` one §5 block); review the
  merged document for lost lines.

## ⛔ Out of scope

- No version bump, no `vite.config.ts` change, no `define`, no new dependency.
- No change to `MainMenuStatView`/`MainMenuView`'s other fields, to the rows, the
  portraits, the route window (`[Task-198]`), or the oval (`[Task-201]`).
- No new markup, CSS geometry or fixture edit: `design/fixtures/01-main-menu.json` keeps
  its board copy (`23` / `2` / `7 · NOVA`), and the fixture path keeps drawing it.
- No change to the stats screen's figures, its modes or its `bestFloor` semantics.
- No `SAVE_VERSION` bump and no change to `RunHistoryRecord`: a player-name field is a
  different task.
- No touch of `src/ui/hud/panels/main-menu/mainMenuPanel.tsx`, `mount.tsx`, `preview.ts`
  or `routeWindow.ts`.
