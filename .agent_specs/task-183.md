# Spec: Task-183 — Run over prints the counters the run now records

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** TypeScript UI — the `run-over` DOM panel (`D49`) plus the Phaser
  fallback model. No scene, no engine rule.
- **Role:** Dev.
- **Objective:** the end-of-run board stops printing the em dash for figures the run
  now records. Its TOTALS view prints the enemies the run fainted from
  `RunStats.faints`, and every POKEMON row prints the member's own KOs, damage dealt
  and damage taken from `RunPokemon.kos` / `damage` / `damageTaken`; the dash survives
  only for a counter the run **never recorded** (an older save, an absent or
  unreadable field), never in place of a recorded `0`. The Phaser canvas fallback
  (`runSummaryLines`) carries the same fainted figure, and the narrow (390×844)
  **lost** card stops hiding the TOTALS / POKEMON tab strip, so a defeated run can
  open its Pokémon table exactly like the victory card can.
- **Environment:** worktree `../wt-pkm-183`, branch `task-183`.
- **Dependencies:** `Task-181` (merged) — it produced `RunStats.faints` +
  `runFaints`/`addFaints` in `src/engine/run/state.ts` and `RunPokemon.kos?` /
  `damage?` / `damageTaken?` with `withMemberTally` in
  `src/engine/run/progression.ts`, which this task reads and never edits.

### Exclusive paths (single writer)

**Nothing outside this list.**

- `src/ui/hud/panels/run-over/view.ts`
- `src/ui/hud/panels/run-over/view.test.ts`
- `src/ui/hud/panels/run-over/run-over.css`
- `src/ui/hud/panels/run-over/README.md`
- `src/ui/runSummary.ts`
- `src/ui/runSummary.test.ts`
- `src/i18n/en.ts` — only the `runOver.*` block (lines 25-44)
- `src/i18n/es.ts` — only the `runOver.*` block (lines 28-47)
- `docs/design-spec.md` — **only** §2, only the score-screen sentences at lines
  408-414 (the "A run ends on a score screen" paragraph). No other section, no other
  line of that section.

**Hot files this task holds:** the i18n pair `src/i18n/{en,es}.ts` (batch 84 is this
task alone, so it holds them). It touches no `package.json`, no `src/main.ts`, no
`vite.config.ts`, no `src/scenes/*`, no `src/data/dex/**`.

**Explicitly untouchable inside the folder** (they already render the view correctly
and must not be re-pinned): `runOverPanel.tsx`, `mount.tsx`, `index.ts`,
`preview.ts`, `preview.test.ts`, `fixture.test.ts`. The panel's `rowCell()` already
turns a `null` column into the em dash and its stats block already prints
`stat.value` verbatim, so **no panel change is needed and none is allowed**.

### Inputs (read-only)

- `src/engine/run/state.ts` — `RunStats` (30-39), `runFaints` (46-49), `RunState`.
- `src/engine/run/progression.ts` — `RunPokemon` (30-56), `MemberTallyCounts` (58-63).
- `src/ui/partyScreen.ts` — `partyRow` (62-79), `PartyRow` (37-52), `partyRows`/`boxRows`/`ripRows` (81-92).
- `src/ui/hud/panels/run-over/runOverPanel.tsx` — the `data-hud-*` attributes the
  criteria below measure.
- `src/scenes/RunOverScene.ts` — the score screen's draw path and the dev-only
  `debugEndRun` seam (3890-3895) the `[live]` steps use.
- `src/i18n/index.ts` and `src/i18n/index.test.ts` — `t()`, the key parity test and
  the call-site param test.
- `src/data/ui/font.json` — the FRLG bitmap font's glyph set.
- `design/frames/m06-run-over-defeat.json`, `design/frames/m07-run-over-victory.json`,
  `design/fixtures/06-run-over-defeat.json`, `design/fixtures/07-run-over-victory.json`
  — **read-only**, see Coordination.
- `scripts/hud/diff.mjs` — the repo's reference CDP-over-WebSocket / Chrome launch
  (132-160, 321-346); the `[live]` steps below reuse that mechanism, they do not
  invent one.
- `docs/design-spec.md` §1-§9 (read, edit only §2).

## 🔒 Contract

### TypeScript — `src/ui/runSummary.ts`

```ts
/**
 * The dash both run-over surfaces print for a figure the run never recorded
 * (U+2014). It is the mark of *unknown*, never of zero.
 */
export const RUN_SUMMARY_EM_DASH = '\u2014';

/**
 * A counter the run recorded, as a whole number of at least zero, or `null` when
 * the run never recorded it. `undefined`, `NaN` and `Infinity` are *unrecorded*
 * (`null`); any finite number is recorded, is truncated toward zero and is clamped
 * to `0`. A recorded `0` therefore reads `0`, not `null`.
 */
export function recordedCount(value: number | undefined): number | null;

export type RunSummary = Readonly<{
  won: boolean;
  routesCleared: number;
  catches: number;
  casualties: number;
  /** Enemies the run fainted (`recordedCount(run.stats.faints)`); `null` when never recorded. */
  faints: number | null;
  seed: string;
  /** The seed and mode as a token that starts the same run again (`D21`). */
  share: string;
}>;

export function runSummary(run: RunState, won: boolean): RunSummary;
export function runSummaryLines(summary: RunSummary): string[];
```

- `runSummary` keeps every existing field's meaning and value and adds
  `faints: recordedCount(run.stats.faints)`. It reads no RNG and no clock.
- `runSummaryLines` returns **exactly seven** entries, in this order and with these
  calls (index → expression):

  | # | expression |
  |---|---|
  | 0 | `summary.won ? t('runOver.headlineWin') : t('runOver.headlineLoss')` |
  | 1 | `summary.won ? t('runOver.blurbWin') : t('runOver.blurbLoss')` |
  | 2 | `t('runOver.routes', { count: summary.routesCleared })` |
  | 3 | `t('runOver.caught', { count: summary.catches })` |
  | 4 | `t('runOver.lostFainted', { lost: summary.casualties, fainted: summary.faints ?? RUN_SUMMARY_EM_DASH })` |
  | 5 | `t('runOver.seed', { seed: summary.seed })` |
  | 6 | `t('runOver.share', { share: summary.share })` |

  The fainted figure rides on **index 4**, the line that carries `Pokémon lost`
  today. Why not an eighth array element: `RunOverScene.draw` (103-129) prints
  `lines.slice(2)` on a fixed 44 px pitch inside a **356 px** window, five stat lines
  (140, 184, 228, 272, 316); a sixth would start at `y + 360`, i.e. 4 px past the
  window's own bottom edge, and `src/scenes/RunOverScene.ts` is not this task's path.
  Merging the two death counters keeps the canvas inside its card and loses no fact.

### TypeScript — `src/ui/hud/panels/run-over/view.ts`

```ts
// Re-exported, same value, same public name: the model owns the mark, the panel spends it.
export const RUN_OVER_EM_DASH = RUN_SUMMARY_EM_DASH; // '\u2014', now owned by runSummary.ts

export function liveRunOverView(
  run: RunState,
  won: boolean,
  tab: RunOverTab,
  confirmKey: string,
): RunOverView;
```

Everything else in that file keeps its name, type and value: `RUN_OVER_SLUGS`,
`RUN_OVER_NARROW_QUERY`, `RUN_OVER_STAT_IDS` (`['routes','catches','lost','fainted']`),
`RUN_OVER_TABS`, `RUN_OVER_ROW_STATES`, `RUN_OVER_COLUMNS`,
`RunOverStatView`/`RunOverRowView`/`RunOverView`/`RunOverBoard`,
`runOverBoard`, `fixtureRunOverView`. `RunOverRowView.kos/dealt/tanked` stay
`string | null` — `null` still means "the run never recorded it" and the panel still
draws `RUN_OVER_EM_DASH` for it.

**The display rule, frozen (no alternatives):**

1. `figure(n)` is unchanged: `String(Math.max(0, Math.trunc(n))).padStart(2, '0')`.
   Two characters minimum, no thousands separator, no sign, no decimal. `7 → '07'`,
   `0 → '00'`, `4120 → '4120'`.
2. **TOTALS row `fainted`**, id `'fainted'`, label `t('runOver.enemiesFainted')`
   (unchanged), value:
   ```ts
   const faints = summary.faints; // RunSummary.faints, computed once at the top of liveRunOverView
   value: faints === null ? RUN_OVER_EM_DASH : figure(faints)
   ```
   The other three rows keep `figure(summary.routesCleared | catches | casualties)`.
3. **POKEMON row cells**, one per member of `run.party`, then `run.box`, then `run.rip`
   (unchanged order and `state` values), each member's three columns:
   ```ts
   function cell(value: number | undefined): string | null {
     const count = recordedCount(value);
     return count === null ? null : figure(count);
   }
   // row: { memberId, name, state, level } from partyRow(member), then
   kos: cell(member.kos),
   dealt: cell(member.damage),
   tanked: cell(member.damageTaken),
   ```
   `liveRow` takes the `RunPokemon` itself (not a `PartyRow`) and reads `partyRow(member)`
   for `id` / `name` / `level`, so the row's identity fields cannot drift from the
   party screen's. `memberId` stays the member's `fighter.id` and stays unique.
4. **When the em dash appears — exhaustive:** only when `recordedCount(...)` is `null`,
   i.e. the field is `undefined`, `NaN` or `Infinity`. A recorded `0` prints `'00'` in
   every one of the seven places. No other input prints the dash, and the dash is
   never a fallback for a formatting failure.
5. **Stable, must not be renamed or removed:** the stat ids
   `data-hud-run-over-stat="routes|catches|lost|fainted"`, their array order, the tab
   ids `data-hud-run-over-tab="totals|pokemon"`, `data-hud-run-over-row`, the three
   `data-hud-run-over-column` values, `data-hud-run-over-portrait`, and the row order
   party → box → rip. Tests and the DOM HUD read them.
6. `fixtureRunOverView` is **not** changed: a `design/fixtures/*` payload still drives
   its own figures verbatim, including its own `"23"` and its own `null` cells.
7. Determinism: the whole file reads no `Rng`, no clock, no `localStorage`. It stays a
   pure function of `(run, won, tab, confirmKey)` — the existing purity/JSON-round-trip
   test keeps passing unmodified.

### CSS — `src/ui/hud/panels/run-over/run-over.css`

Delete the narrow-viewport defeat overrides, the whole block at lines 538-560:

```css
.run-over[data-won='false'] .run-over__panel { top: 140px; height: 560px; }
.run-over[data-won='false'] .run-over__tabs,
.run-over[data-won='false'] .run-over__portraits { display: none; }
.run-over[data-won='false'] .run-over__stats { top: 110px; }
.run-over[data-won='false'] .run-over__share { top: 360px; }
.run-over[data-won='false'] .run-over__actions { top: 460px; }
```

and their comment. Nothing else in the file changes. Consequences, frozen:

- After the change the stylesheet contains **no** `[data-won='false']` selector at
  all; the only `data-won` attribute selector left is
  `.run-over[data-won='true']` (line 70), which only swaps the accent colour.
- At `max-width: 600px` a lost card therefore uses the same rules as a won one:
  `.run-over__panel` `top: 96px; height: 604px; border-radius: 12px`;
  `.run-over__tabs` `top: 140px; left: 24px; gap: 8px`, each `.run-over__tab`
  `height: 28px` (90 px / 100 px wide); `.run-over__portraits` `top: 92px; gap: 12px`;
  `.run-over__stats` `top: 184px; left: 24px; gap: 33px`; `.run-over__share`
  `top: 434px; left: 24px; width: 326px`; `.run-over__actions` `top: 504px;
  width: 374px; height: 44px; gap: 20px`; `.run-over__list` `top: 188px`.
- **Must not move:** the card's own width/left (`374 px` at `x = 8`), the accent rule,
  the portrait cell size (40×40), the tab sizes, the stat row's label/value columns,
  and the action row's absolute place — `y = 600` on the page, 44 px tall, one 320 px
  action on a loss and two 150 px actions on a win (`data-actions`), unchanged.
- The party strip on a loss is empty because the **view** has no portraits (`run.party`
  is empty on a real defeat), not because CSS hides it. A view that does carry
  portraits draws the strip on a lost card too.

### Data / i18n

One new key, added to **both** tables inside the existing `runOver.*` block, in the
same relative position (right after `'runOver.lost'`):

| key | `src/i18n/en.ts` | `src/i18n/es.ts` |
|---|---|---|
| `runOver.lostFainted` | `'Pokémon lost: {lost} · Enemies fainted: {fainted}'` | `'Pokémon perdidos: {lost} · Enemigos debilitados: {fainted}'` |

- The separator is `·` (U+00B7, present in the HUD and FRLG fonts), **not** an em
  dash: `src/i18n/index.test.ts` (359-362) forbids U+2014 in the Spanish table.
- Placeholders are exactly `{lost}` and `{fainted}` in both locales.
  `src/i18n/index.test.ts` (448-459) checks every call site's params against the key's
  tokens, so the call in `runSummary.ts` must pass exactly those two names.
- No existing key changes: `runOver.enemiesFainted` stays the TOTALS label
  (`'ENEMIES FAINTED'` / `'ENEMIGOS DEBILITADOS'`), `runOver.lost` stays the label
  source for the TOTALS `lost` row, `runOver.colKos`/`colDealt`/`colTanked` stay the
  table headers, `runOver.routes`/`caught`/`seed`/`share` stay the fallback lines.

### Docs — `docs/design-spec.md` §2 only

Replace the score-screen paragraph (lines 408-414) so it says, at minimum and
without contradicting anything else in §2:

> A run ends on a score screen, win or loss: routes cleared, Pokémon caught, Pokémon
> lost, the enemies the run fainted and, member by member, the KOs it scored and the
> damage it dealt and took, plus the seed that reproduces the run, as the raw seed and
> as the share string someone else could play (`src/ui/runSummary.ts`, `D21`). Both a
> win and a loss end on the score screen, and its confirm returns to the main menu,
> where a new run is started. A win clears its route; a loss does not, and nothing
> carries over (D5). Every figure on the board is the run's own; a counter the run
> never recorded (a save written before the counters existed) prints the em dash,
> never a zero. Both cards carry the TOTALS / POKEMON tabs and the same board geometry
> at every width — the phone defeat card is not a shorter, tab-less variant.

### README — `src/ui/hud/panels/run-over/README.md`

- Rewrite **rule 1** ("Data honesty"): it currently says the run records no counter
  and that "a live figure in that table is a bug", which this task makes false. It
  must say the board prints the run's own figures — `RunStats.faints` and each
  member's `kos` / `damage` / `damageTaken` — through the shared rule
  `recordedCount` + `figure()`, and that the em dash marks a counter the run never
  recorded, never a recorded `0`.
- Rewrite **rule 5**: the phone defeat frame no longer hides the tab strip or shortens
  the card; both phone boards use the `m07` geometry, `design/frames/m06-*` remains the
  frozen design source that the live screen now deliberately diverges from, and `won`
  still separates the two boards' copy and accent only.
- Keep rules 2, 3, 4, 6 as they are (rule 4 — the strip follows `payload.state.party` /
  `run.party`, and a real lost run has no party left — stays true).
- Update the `view.ts` / `view.test.ts` role lines so they describe what the files now
  do (the tallied columns and the dash rule; no new or deleted file, so nothing else
  in the map changes).

## 🧩 Data and configuration

No balancing value, no JSON table, no `src/data/` edit. The only data is the single
i18n key above (`runOver.lostFainted`, `{lost}` and `{fainted}` both required, no
defaults) and the paragraph in `docs/design-spec.md` §2.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds
    and the unmodified `fixture.test.ts`, `preview.test.ts`, `src/i18n/index.test.ts`
    and `src/scenes/*` suites.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-183` audited against the exclusive paths list.
  - The `[live]` criteria need a browser; run them at **390×844** with
    `Emulation.setDeviceMetricsOverride { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }`.

- **Reaching a finished, tallied run (the recipe the `[live]` criteria share).**
  There is no committed browser harness in this repo (`package.json` ships no
  puppeteer/playwright); the reference driver is `scripts/hud/diff.mjs`, which launches
  Chrome with a remote debugging port and speaks CDP over its WebSocket (132-160 and
  321-346). Reuse that mechanism:
  1. `npm run dev`, then open `http://localhost:5173/?hud=dom` (the DOM HUD is opt-in;
     without `?hud=dom` the canvas fallback paints instead).
  2. Press confirm twice through `Input.dispatchKeyEvent` (`key: 'e'`, `code: 'KeyE'`,
     `windowsVirtualKeyCode: 69`, `nativeVirtualKeyCode: 69`, one `keyDown` +
     `keyUp`, ~1 s apart): on a fresh profile the main menu has no save, so confirm
     starts the starter offer (`MainMenuScene` 395-404), and the starter's confirm
     starts the route (`StarterScene.confirm` 526-542). The bind is `E`
     (`DEFAULT_KEYBINDS.confirm`, `src/data/keybinds.ts` 51). If the injected input
     does not register, send the same two presses as a plain
     `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', code: 'KeyE', keyCode: 69, bubbles: true }))`.
  3. Poll `Runtime.evaluate` for `typeof globalThis.__pkmRoute === 'object'` (dev build
     only, `RouteScene` 1341-1346), up to 20 s.
  4. Evaluate this once, and require it to return `true`:
     ```js
     (() => {
       const route = globalThis.__pkmRoute;
       if (!route) return 'no-route';
       const tally = (member, index) => ({ ...member, kos: index + 1, damage: 120 + index * 10, damageTaken: 30 + index * 5 });
       const run = route.run;
       route.run = {
         ...run,
         stats: { ...run.stats, catches: 3, casualties: run.rip.length, faints: 7 },
         party: run.party.map(tally),
         box: run.box.map(tally),
         rip: run.rip.map(tally),
       };
       return route.debugEndRun(false); // the dev-only seam at RouteScene 3890-3895
     })()
     ```
     `debugEndRun` is the run's real end seam (it writes the record and calls
     `scene.start('RunOver', { run, won: false })`); the extra fields are exactly the
     shape `Task-181` writes in play, injected here so a fresh dev run has non-zero
     tallies instead of walking a battle to the death.
  5. Poll for `document.querySelector('[data-hud-run-over]')`, then wait 300 ms for
     the panel's stylesheet and webfont.
  - The run's own numbers on this state are: routes cleared `0` (`routeIndex` 1 on a
    fresh run, lost), catches `3`, lost `0` (`rip` empty), fainted `7`.

- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean: `npm run build` exits 0 (`tsc --noEmit` covers the new i18n key in `es.ts`, which is typed against `en.ts`).
  - [ ] `[unit]` The declared tests exist and pass: `npm test` exits 0.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched: `git diff --name-only main...task-183` lists only the nine paths above; in particular `src/scenes/RunOverScene.ts`, `src/ui/hud/panels/run-over/runOverPanel.tsx`, `design/**` and `src/engine/**` are absent.
  - [ ] `[unit]` **The tallied board prints numbers.** In `view.test.ts`, a run with `stats: { catches: 9, casualties: 6, faints: 23 }` yields
    `liveRunOverView(run, false, 'totals', 'E').stats` ids `['routes','catches','lost','fainted']`
    with values `['04','09','06','23']` (routes from `routeIndex: 5`, lost run).
  - [ ] `[unit]` **A recorded zero is `00`, a recorded small count is padded.**
    `faints: 0` → `'00'`; `faints: 7` → `'07'`; `faints: 4120` → `'4120'`.
  - [ ] `[unit]` **The dash only for a counter that was never recorded.** A run whose `stats` is `{ catches: 9, casualties: 6 }` (no `faints`) yields the TOTALS `fainted` value `RUN_OVER_EM_DASH` (`'\u2014'`), and `runSummary(run, false).faints` is `null`. The same holds for `faints: NaN` and `faints: Infinity`. Every other TOTALS row is still a two-character figure.
  - [ ] `[unit]` **Row cells read the member's own tallies, in order.** On a run whose `party` is `[{...m, kos: 8, damage: 4120, damageTaken: 214}, {...m, kos: 0, damage: 0, damageTaken: 0}, m]` (third member with none), `liveRunOverView(run, true, 'pokemon', 'E').rows.slice(0, 3)` has `kos/dealt/tanked` equal to `['08','4120','214']`, `['00','00','00']`, `[null,null,null]`; `memberId`, `name`, `level` and the party → box → rip order are unchanged from today, and `rows` is still `[]` on the `totals` tab.
  - [ ] `[unit]` **The same figure reaches the fallback.** `runSummaryLines(runSummary(talliedRun, false))` has `length === 7`, `[2] === 'Routes cleared: 4'`, `[3] === 'Pokémon caught: 9'`, `[4] === 'Pokémon lost: 6 · Enemies fainted: 23'`, `[5] === 'Seed: pkm-148'`, `[6] === 'Share: PKRL-1-f-pkm-148'`; for the legacy run (no `faints`) `[4] === 'Pokémon lost: 6 · Enemies fainted: \u2014'`.
  - [ ] `[unit]` **Both boards keep their rects.** The two existing `runOverBoard` tests in `view.test.ts` pass **unmodified** (desktop `panel {x:280,y:170,w:720,h:480,radius:11}`, `tabs [{totals,336,312,90,24},{pokemon,432,312,100,24}]`, `row {336,404,608,32,pitch:36}`; narrow `panel {x:8,y:96,w:374,h:604,radius:12}`, `button {x:35,y:600,w:320,h:44}`, `row.pitch 50`).
  - [ ] `[unit]` **No defeat-specific CSS remains.** In `view.test.ts`, read the stylesheet the way `main-menu/view.test.ts` line 22 does (`readFileSync(fileURLToPath(new URL('./run-over.css', import.meta.url)), 'utf8')`); assert `css.match(/\[data-won='(true|false)'\]/g)` equals `["[data-won='true']"]`, and `expect(/(\.run-over__tabs[^{}]*)\{[^}]*display:\s*none/.test(css)).toBe(false)`.
  - [ ] `[unit]` **No i18n key missing in `es.ts`.** `src/i18n/index.test.ts` passes untouched (same key set both ways, no unresolved placeholder, no U+2014 in Spanish, call-site params match), and `runSummary.test.ts` pins both strings verbatim: `en['runOver.lostFainted'] === 'Pokémon lost: {lost} · Enemies fainted: {fainted}'`, `es['runOver.lostFainted'] === 'Pokémon perdidos: {lost} · Enemigos debilitados: {fainted}'`. Assert `en['runOver.enemiesFainted'] === 'ENEMIES FAINTED'` and `es['runOver.enemiesFainted'] === 'ENEMIGOS DEBILITADOS'` did not move.
  - [ ] `[unit]` **The docs say what the board does.** `grep -n "enemies the run fainted" docs/design-spec.md` finds the §2 sentence; `grep -c "narrow card hides" src/ui/hud/panels/run-over/README.md` prints `0` (the old m06 asymmetry claim is gone), and `grep -n "never recorded" src/ui/hud/panels/run-over/README.md` finds rule 1.
  - [ ] `[live]` **The lost phone card draws the tab strip.** At 390×844, after step 5 above, evaluate
    ```js
    (() => {
      const root = document.querySelector('[data-hud-run-over]');
      if (!root) return { error: 'no run-over panel' };
      const tabs = [...root.querySelectorAll('[data-hud-run-over-tab]')].map((b) => {
        const r = b.getBoundingClientRect();
        return { id: b.getAttribute('data-hud-run-over-tab'), w: Math.round(r.width), h: Math.round(r.height) };
      });
      return { won: root.getAttribute('data-won'), tab: root.getAttribute('data-tab'), tabs };
    })()
    ```
    **Measurement:** `won === 'false'`, `tab === 'totals'`, `tabs.length === 2` with ids `['totals','pokemon']`, every `w` and `h` **greater than 0** (expect `h === 28`; widths `90` and `100`). Before this task the same evaluation returns `tabs.length === 2` with `w === 0 && h === 0` on both (the `display: none`), which is the defect.
  - [ ] `[live]` **The four totals cells are two-digit numbers, and the faint count is the run's.** Evaluate
    ```js
    [...document.querySelectorAll('[data-hud-run-over] [data-hud-run-over-stat]')]
      .map((row) => [row.getAttribute('data-hud-run-over-stat'), row.querySelector('.run-over__stat-value').textContent.trim()])
    ```
    **Measurement:** exactly four entries, ids in order `routes,catches,lost,fainted`, every value matching `/^\d{2}$/`, and `fainted === '07'` (the injected `faints: 7`); no value is `'\u2014'`.
  - [ ] `[live]` **The POKEMON tab opens on the lost card and its cells are numbers.** Click `document.querySelector('[data-hud-run-over] [data-hud-run-over-tab="pokemon"]').click()`, wait 200 ms, then evaluate
    ```js
    (() => {
      const root = document.querySelector('[data-hud-run-over]');
      const rows = [...root.querySelectorAll('[data-hud-run-over-row]')].map((row) =>
        ['kos', 'dealt', 'tanked'].map((c) => row.querySelector(`[data-hud-run-over-column="${c}"]`).textContent.trim()));
      return { tab: root.getAttribute('data-tab'), rows };
    })()
    ```
    **Measurement:** `tab === 'pokemon'`, `rows.length >= 1`, every cell matches `/^\d{2,}$/`, and the first row is exactly `['01','120','30']` (the injected first member). No cell is `'\u2014'`.
  - [ ] `[live]` **The lost card's geometry equals the won card's at 390×844.** Measure the same five nodes on the lost card and on `http://localhost:5173/?hud=dom&hudFixture=07-run-over-victory` (second navigation, same viewport, wait 300 ms):
    ```js
    (() => {
      const root = document.querySelector('[data-hud-run-over]');
      const panel = root.querySelector('[data-hud-run-over-panel]').getBoundingClientRect();
      const rel = (sel) => {
        const el = root.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { dx: Math.round(r.x - panel.x), dy: Math.round(r.y - panel.y), w: Math.round(r.width), h: Math.round(r.height) };
      };
      return {
        won: root.getAttribute('data-won'),
        panel: { x: Math.round(panel.x), y: Math.round(panel.y), w: Math.round(panel.width), h: Math.round(panel.height) },
        panelRadius: getComputedStyle(root.querySelector('[data-hud-run-over-panel]')).borderTopLeftRadius,
        tabs: rel('.run-over__tabs'), portraits: rel('.run-over__portraits'), stats: rel('.run-over__stats'),
        share: rel('.run-over__share'), actions: rel('.run-over__actions'),
      };
    })()
    ```
    **Measurement:** both cards report `panel {x:8,y:96,w:374,h:604}`, `panelRadius '12px'`, `tabs.dy === 140`, `tabs.dx === 24`, `tabs.h === 28`, `portraits.dy === 92`, `stats.dy === 184`, `share {dx:24,dy:434,w:326}`, `actions {dx:0,dy:504,w:374,h:44}`. The two cards' five entries must be equal field by field; only `portraits.w` may differ (one or two 40 px cells on the injected lost run against the fixture's four), and `actions` carries `data-actions` 1 vs 2 (one 320 px action vs two 150 px ones) without moving the row.
  - [ ] `[live]` **Nothing above shipped a regression on the win path.** On `?hud=dom&hudFixture=07-run-over-victory` at the same 390×844: `data-won === 'true'`, four `[data-hud-run-over-portrait]` cells, the four totals read `08 / 17 / 04 / 37` (the payload's own figures, each `/^\d{2}$/`), and the geometry expression above returns the same numbers as the lost card. That preview mounts the panel **without** an intent handler (`preview.ts` 52), so its tabs do not switch — do not measure a tab click there; the click was measured on the live lost card.

## 📣 Coordination

- **For the Architect / Orchestrator:** the canvas fallback did **not** get an eighth
  array element. `RunOverScene.draw` prints five stat lines on a 44 px pitch inside a
  356 px window, so a sixth line would hang 4 px below the card, and that scene is not
  in this task's paths. The fainted figure rides on the `lost` line
  (`runOver.lostFainted`). If a later task grows that panel (or splits the line), it
  owns `src/scenes/RunOverScene.ts` and can restore one line per counter.
- **For the next batch:** `src/i18n/{en,es}.ts` and `docs/design-spec.md` §2 are free
  again after this merge; the only new key is `runOver.lostFainted`, and
  `src/ui/runSummary.ts` now owns `RUN_SUMMARY_EM_DASH` and `recordedCount` for anyone
  who prints a run counter.
- **Frames vs the live screen (do not "fix" by re-pinning):**
  `design/frames/m06-run-over-defeat.json` still draws a 560 px, tab-less defeat card
  and `design/fixtures/06-run-over-defeat.json` still prints the frame's own `"23"`.
  Both are **read-only** here. After this task the live lost card uses the `m07`
  geometry, so `node scripts/hud/diff.mjs --slug 06-run-over-defeat --dev` will report
  a pixel difference at 390×844: the live screen is the authority, `design/**` must
  not be edited, and no test may be changed to re-pin the m06 frame against the live
  card. The existing frame-to-frame assertions in `fixture.test.ts` (m06 panel height
  + 44 === m07 height, `board.button` === m06 `m button`) stay true because the
  frames are untouched.
- **For QA:** the `[live]` recipe's only dev-only hook is `globalThis.__pkmRoute` +
  `debugEndRun(false)`; both exist on `main` (`RouteScene` 1341-1346 and 3890-3895),
  so no code may be added to reach them.
- **Reused, not invented:** `partyRow` (party screen), `t`/`recordedCount`/
  `RUN_SUMMARY_EM_DASH` (this task's model), `figure`/`runOverBoard` (the panel),
  `scripts/hud/diff.mjs`'s CDP launcher.

## ⛔ Out of scope

- No `src/scenes/**` change (the canvas panel's height/pitch stays 356 px / 44 px), no
  `src/engine/**` change, no `src/data/**` change, no `src/ui/hud/panels/run-over/`
  file other than the four listed (in particular **not** `runOverPanel.tsx`).
- No new sortable / filter row: `07b`'s MOST KOs / MOST DAMAGE / MOST TANKED filter
  stays undrawn (README rule 6).
- No thousands separator, no colour, no new column, no new tab, no change to the
  member states or to the party/box/rip order.
- No edit to `design/**` (frames, fixtures, references) and none to
  `docs/hud-fidelity.md`; no `CHANGELOG.md` or `TODO.md` edit (the Orchestrator ticks
  the backlog at merge).
- No history/`save.history` work, no playtime, no `SAVE_VERSION` change.
- No test that re-pins a `design/frames/m06-*` rect against the live card.
- No new dependency, no new script, no new file.
