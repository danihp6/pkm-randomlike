# Spec: Task-126 — A fixture reproduces a frame exactly

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** DOM UI plumbing (flags + fixture store), headless-tested.
- **Role:** Dev.
- **Objective:** the DOM HUD can be pinned to one board frame instead of the live
  run. `?hud=dom&hudFixture=<slug>` reads `design/fixtures/<slug>.json` (the frame's
  own strings and values), validates it into a `HudState`, and hands the panels a
  sink that emits that state once and then **drops every live run emission** while
  the flag is on, so `scripts/hud/diff.mjs` compares like with like instead of a
  different party against the board. A missing, unknown or malformed fixture is
  inert: the HUD behaves exactly as `?hud=dom` alone and the console stays clean.
  Task-127 is the first consumer; this task ships the whole mechanism and its tests.
- **Environment:** worktree `../wt-pkm-126`, branch `task-126`. `node_modules/` is
  not present in a fresh worktree — run `npm ci` once (the lockfile is committed)
  before any gate. Linux, Node 22.
- **Dependencies:** all merged on `origin/main` @ `4e5ce67` —
  - Task-122 — `scripts/hud/diff.mjs` (already navigates to
    `/?hud=dom&hudFixture=<slug>`; nothing here edits it), `design/README.md`.
  - Task-123 — `src/ui/hud/state.ts`: `HudState`, `HudSink`, `syncHud`,
    `projectHud` (the types this task validates into; **not edited**).
  - Task-124 — `src/ui/hud/mount.ts` (`hudRequested(search)`, the one `?hud=dom`
    parser) and `src/ui/hud/shell.tsx`.

### Exclusive paths (single writer)

**Nothing outside this list.**

- `src/ui/hud/fixtures/**` (every file it adds: the flag parser, the registry, the
  barrel, `README.md` and their tests)
- Nothing else — in particular **not** `src/ui/hud/README.md` (Task-125 owns it in
  this batch and writes this folder's line), not `src/dev/**`, not
  `src/ui/hud/mount.ts`, not `scripts/hud/diff.mjs`, not `design/**`.

### Inputs (read-only)

- `scripts/hud/diff.mjs` — the harness that consumes the flag (read it to see the
  URL it builds and the two viewports it uses: 1280×800 and 390×844).
- `src/ui/hud/state.ts` — `HudState` and `HudSink`, the only shapes a fixture may
  produce. **Do not edit it.**
- `src/ui/hud/mount.ts` — `hudRequested(search)`, which you **reuse** for the
  `?hud=dom` half; never write a second parser for it.
- `src/ui/hud/mount.test.ts` — the house style for a flag truth table.
- `src/scenes/panels/registry.ts` — the house style for a `import.meta.glob` module
  map and its `Modules` type.
- `design/README.md`, `design/frames/` (the slugs exist there today;
  `design/fixtures/` does **not** exist yet — see Coordination).
- `AGENTS.md`.

## 🔒 Contract

### TypeScript — `src/ui/hud/fixtures/`

```ts
// flags.ts
export type HudFlags = Readonly<{ dom: boolean; fixture: string | null }>;

/** Reads `?hud=dom` and `?hudFixture=<slug>` once. `dom` is `hudRequested(search)`. */
export function parseHudFlags(search: string): HudFlags;

/** Trim, lowercase, then accept only /^[a-z0-9][a-z0-9-]{0,63}$/; anything else is null. */
export function normaliseSlug(value: string): string | null;
```

- The `dom` half **delegates** to `hudRequested` from `../mount`. There is exactly one
  `?hud=dom` parser in the repo and this task does not fork it.
- The key match is case-insensitive (`HUDFIXTURE=`, `HudFixture=` both work), the
  value is normalised before validation, and an empty value is `null`.
- `parseHudFlags('')` is `{ dom: false, fixture: null }`. It never throws, on any
  string, and it reads no global.

```ts
// registry.ts
export type FixtureModules = Readonly<Record<string, unknown>>;

/**
 * The eager, build-time map of `design/fixtures/*.json`, keyed by path
 * (`'../../../design/fixtures/02-options.json'`). Empty — not absent, not an
 * error — while the folder does not exist.
 */
export const FIXTURE_MODULES: FixtureModules;
```

```ts
// index.ts (barrel: the panel tasks import from here)
import type { HudSink, HudState } from '../state';

export type HudFixture = Readonly<{ slug: string; state: HudState }>;

/** The slugs a module map carries, ascending. Paths that are not `*.json` are skipped. */
export function fixtureSlugs(modules: FixtureModules): readonly string[];

/**
 * The fixture for `slug`, or null. The entry's basename must equal `<slug>.json`,
 * the value must be a plain object with a string `slug` equal to the filename's slug
 * and a `state` that passes `isHudState`; anything else is null (never a throw).
 */
export function fixtureFor(modules: FixtureModules, slug: string): HudFixture | null;

/** Structural validation of `HudState`: the six keys, kinds and row ids. */
export function isHudState(value: unknown): value is HudState;

/** The fixture this URL asks for: null unless the flag is on and the slug resolves. */
export function installFixture(flags: HudFlags, modules: FixtureModules): HudFixture | null;

/**
 * The sink a scene installs while a fixture is on: it emits the fixture's state on
 * its first call and drops every later live emission. With `null` it returns `sink`
 * unchanged (same reference), so a scene always installs the result.
 */
export function holdForFixture(fixture: HudFixture | null, sink: HudSink): HudSink;
```

- **`isHudState`** accepts only a plain object with exactly the six `HudState` keys:
  `party` and `bag` arrays, `money` a finite number or null, `route`, `battle` and
  `notice` a plain object or null, and every `party`/`bag` row a plain object with a
  non-empty string `id` (`itemId` for a bag row). It rejects arrays, `null`, extra
  missing keys, and a row that is `null` or a string. It is a guard, not a
  deep schema: it never coerces, never fills a default and never mutates.
- **`holdForFixture`** is pure: it holds no module-level state, allocates one closure
  and no more, and `holdForFixture(null, sink) === sink`.
- **`installFixture`** is `null` when `flags.dom` is false (the HUD is not mounted at
  all), when `flags.fixture` is null, or when the slug does not resolve.
- **Determinism:** no RNG, no clock, no `fetch`, no `document`/`window` access, no
  Phaser import anywhere in this folder. The registry is resolved by Vite at build
  time, never over the network at run time.

### Data — the fixture file shape (authored by Task-127, read here)

```json
{ "slug": "02-options", "state": { "party": [], "bag": [], "money": 0, "route": null, "battle": null, "notice": null } }
```

A file whose `slug` disagrees with its filename, or whose `state` fails
`isHudState`, is rejected with a single `console.warn` naming the path and the
reason — **once per page load**, never per emission, and never a throw. A missing
`design/fixtures/` directory is silent (no warning at all).

## 🧩 Data and configuration

No balancing data, no new dependency, no script and no `design/` file. The only
"configuration" is the URL: `?hud=dom` and `?hudFixture=<slug>`, both read once.

## 🧪 Test and Validation Plan (for QA)

QA runs this verbatim.

- **Method:**
  - `npm ci` once in the worktree if `node_modules/` is absent.
  - `npm test` — Vitest, headless; the repo has no jsdom, so everything is asserted
    on pure functions and on vnode-free data. A fake module map is an object literal
    keyed `'../../../design/fixtures/<slug>.json'`.
  - `npm run build` — `tsc --noEmit && vite build`; this is also the proof that the
    empty `design/fixtures/` does not break the glob.
  - `git diff --name-only main...task-126` against the exclusive paths list.
  - The `[live]` criteria use the dev server; no fixture file exists yet, so both
    measure the **inert** path, which is the bug that would actually ship.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean, with `design/fixtures/` absent.
  - [ ] `[unit]` `npm test` is green and the new tests exist:
    `parseHudFlags` truth table (`''`, `?hud=dom`, `?hud=phaser`, `?hudFixture=02-options`,
    `?HUDFIXTURE=02-OPTIONS`, `?hudFixture=`, `?hudFixture=../x`, `?hud=dom&hudFixture=02-options`)
    and, for the `dom` half, **agreement with `hudRequested` on every case**.
  - [ ] `[unit]` `normaliseSlug` accepts `02-options`/`03b-panels-row-view` and rejects
    `''`, `../x`, `a b`, `a/b`, a 65-character slug and one starting with `-`.
  - [ ] `[unit]` `fixtureFor` returns the fixture for a matching key, rejects a
    mismatched inner `slug`, rejects an invalid `state`, rejects a non-JSON key and a
    non-object value; `fixtureSlugs` is ascending and skips non-JSON keys;
    `fixtureSlugs({})` is `[]` and does not throw.
  - [ ] `[unit]` `isHudState` accepts a minimal valid state and rejects: `null`, an
    array, a missing key, `money: '3'`, `party: [null]`, a bag row without `itemId`.
  - [ ] `[unit]` `holdForFixture(null, sink)` is the same reference; with a fixture it
    emits `fixture.state` exactly once and drops the next two live states;
    `installFixture` is null without `dom`, without a slug and for an unknown slug,
    and returns the fixture when both are present.
  - [ ] `[unit]` `FIXTURE_MODULES` is a plain object and importing it does not throw
    with `design/fixtures/` absent (assert the kind, **not** emptiness: Task-127 adds
    files).
  - [ ] `[unit]` Nothing outside the exclusive paths was touched; in particular
    `src/ui/hud/mount.ts`, `src/ui/hud/state.ts`, `src/ui/hud/README.md`,
    `src/dev/**`, `scripts/hud/diff.mjs` and `design/**` are untouched by the diff.
  - [ ] `[unit]` `src/ui/hud/fixtures/README.md` exists, one line per file, no
    exported names.
  - [ ] `[live]` **A fixture slug with no fixture file changes nothing.** With
    `npm run dev` running, load `/?hud=dom&hudFixture=02-options` and measure over CDP
    (`Runtime.evaluate`): `document.getElementById('hud')` exists with
    `getBoundingClientRect()` `{x:0, y:0, width:1280, height:800}` at the default
    viewport, `children.length === 1`, the shell has `data-hud="root"`, **no element
    carries a `data-hud-fixture` attribute**, `document.querySelector('canvas')` is
    present and `1280×800`, and there are zero `Runtime.exceptionThrown` and zero
    `console.error` events in a 3 s window.
  - [ ] `[live]` **Without `?hud=dom` the HUD does not mount at all.** Load
    `/?hudFixture=02-options` and read `document.getElementById('hud') === null` and
    zero console errors over the same 3 s window, while the canvas is present.

## 📣 Coordination

- **For the Architect — one plan change this spec makes deliberately:** the plan
  says the flags are parsed in `src/dev/hudFlags.ts`. They are not: `AGENTS.md`
  makes `src/dev/` code "that exists only while the developer gate is on" and forbids
  the shipping path importing it at the top level, and the fixture loader is shipping
  code that Task-127's `SettingsScene` reads at boot. So the parser lives in
  `src/ui/hud/fixtures/flags.ts`, beside the thing it configures, and `src/dev/`
  gains no file. Everything else the plan says about Task-126 holds.
- **For Task-127 (`Options 02`), the first consumer:** at boot, call
  `parseHudFlags(window.location.search)`, then
  `installFixture(flags, FIXTURE_MODULES)`, and install
  `holdForFixture(fixture, sink)` as the HUD's sink instead of the raw one — that is
  the whole wiring, and the fixture file `design/fixtures/02-options.json` must be
  `{ "slug": "<slug>", "state": <HudState> }` with its own frame slug
  (`02-options`) as the filename.
- **For the diff harness:** `scripts/hud/diff.mjs` already builds
  `/?hud=dom&hudFixture=<slug>`; nothing there changes. A frame with no fixture keeps
  the live run and the harness reports a different party, which is the failure this
  task removes once Task-127 writes the first fixture.

## ⛔ Out of scope

- No panel, no scene, no `main.ts` wiring (Task-127 owns the first call site).
- No `design/fixtures/**`: the directory and the first payload are Task-127's.
- No edit to `mount.ts` (a second parser is the thing this task must not create), no
  edit to `state.ts`, no edit to `scripts/hud/diff.mjs`.
- No `fetch` at run time, no `localStorage`, no network, no service worker.
- No new dependency, no schema library, no `zod`.
