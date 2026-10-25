# Spec: Task-152 — The run-history store

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine + persistence (pure TypeScript, no Phaser, no UI).
- **Role:** Dev.
- **Objective:** the save stops keeping only the run in progress. A new pure module
  `src/engine/run/history.ts` holds the **last 50 finished runs** — seed, mode, how far
  the run got, catches, casualties, playtime, and per-species KOs and damage — and
  `src/engine/save.ts` carries that list across boots as `SAVE_VERSION` **24** with a
  `23 → 24` migration that seeds an empty list. No screen renders it yet; the store is
  what `[Task-155]` will read.
- **Environment:** worktree `../wt-pkm-152`, branch `task-152`.
- **Local toolchain:** `node_modules` is already present in this worktree as a **symlink** to the main checkout's install. Do **not** run `npm ci` or `npm install`; run `npm test` / `npm run build` directly.
- **Dependencies:** none. `RunStats` (`src/engine/run/state.ts`) and the migration
  chain are shipped.

### Exclusive paths (single writer)

- `src/engine/run/history.ts` *(new)*
- `src/engine/run/history.test.ts` *(new)*
- `src/engine/run/README.md` *(the folder map — two new files, so it updates)*
- `src/engine/save.ts`
- `src/engine/save.test.ts`
- `src/engine/README.md` *(only if the folder map lists `save.ts` in a way this task
  changes; one line at most)*

Nothing else. `src/scenes/**`, `src/ui/**`, `package.json` are off-limits.

### Inputs (read-only)

- `src/engine/run/state.ts` (`RunState`, `RunStats`), `src/engine/run/progression.ts`
  (`RunPokemon`), `src/engine/save.ts`'s neighbours: `src/engine/maps/plan.ts`,
  `src/engine/run/floors.ts`.
- `docs/tech-decisions.md` (`D5`: a lost run carries over nothing — this store is a
  **record**, never a restore), `docs/design-spec.md`.

## 🔒 Contract

### TypeScript

```ts
// src/engine/run/history.ts
/** How many finished runs the store keeps. The oldest is dropped first. */
export const MAX_HISTORY = 50;

/** One species' contribution to a finished run. */
export type RunSpeciesRecord = Readonly<{
  speciesId: string;
  /** Faints this member caused. */
  kos: number;
  /** Damage this member dealt, summed over the run. */
  damage: number;
}>;

/** One finished run. `endedAt` is an ISO-8601 instant; `playtimeMs` a wall clock. */
export type RunHistoryRecord = Readonly<{
  seed: string;
  mode: RunMode;                 // 'finite' | 'infinite', from run/state.ts
  /** The floor the run reached (1-based); 0 only for a run that never left map 1. */
  mapReached: number;
  catches: number;
  casualties: number;
  playtimeMs: number;
  /** True when the run beat the final map's boss (finite mode only). */
  won: boolean;
  endedAt: string;
  /** Newest member first is not required: sorted by `speciesId` for a stable order. */
  species: readonly RunSpeciesRecord[];
}>;

export function emptyHistory(): readonly RunHistoryRecord[];

/** Prepends `record` and keeps at most `MAX_HISTORY`, newest first. Pure. */
export function pushHistory(
  history: readonly RunHistoryRecord[],
  record: RunHistoryRecord,
): readonly RunHistoryRecord[];

/** Builds a record from the run's own counters; the caller supplies the clock. */
export function makeHistoryRecord(
  run: RunHistory,
  ending: Readonly<{ endedAt: string; playtimeMs: number; won: boolean }>,
): RunHistoryRecord;

/** The run fields `makeHistoryRecord` reads. A structural subset of `RunState`. */
export type RunHistory = Readonly<{
  seed: string;
  mode: RunMode;
  mapIndex: number;
  stats: RunStats;
  party: readonly RunPokemon[];
  box: readonly RunPokemon[];
}>;
```

- **`makeHistoryRecord` reads no clock and no RNG** — `endedAt`/`playtimeMs` arrive as
  arguments, so every test is deterministic. `mapReached` is `run.mapIndex`.
- **Species rows** are derived from `party` **and** `box` (a member lost mid-run still
  contributed), keyed by `fighter.species` (the dex id), summing each member's KO and
  damage counters **if the run state already carries them**; if it does not, the caller
  passes the tally. Do **not** add a counter to `RunState` in this task — it is not in
  your paths. Concretely: `species: []` is a legal record, and the shape is what
  `[Task-155]` renders. Filter out rows with `kos === 0 && damage === 0`.
- **`pushHistory`** never mutates its argument and never reorders what it keeps.
- **No restore:** nothing in this module feeds a run. `D5` stands — the store is
  written at the end of a run and read by a screen.

### `src/engine/save.ts`

- `SAVE_VERSION` becomes **24**.
- `SaveDocument` gains `history: readonly RunHistoryRecord[]`, and `emptySave()`
  returns `history: []`.
- `SAVE_MIGRATIONS[23]` moves a v23 document to v24 by adding `history: []` — an old
  save has no record of runs that already ended, so it starts empty. Follow the shape
  of the neighbouring steps (`{ ...document, version: 24, history: [] }`) and extend the
  long doc comment above `SAVE_MIGRATIONS` with the `23` sentence, in the same voice
  (it currently ends on `22`).
- `decodeSave` validates the field: a non-array, or rows that are not records with the
  required primitive fields, are **dropped**, never repaired into nonsense; a missing
  field on a current-version document yields `[]` (never throw). `encodeSave`/the write
  path persists it. A bad row must not cost the player the run they have in progress.
- **Determinism:** no RNG anywhere in this task. No fixed-seed test may move.

## 🧩 Data and configuration

No `src/data/` change. The on-disk shape gains one top-level key:

```json
{ "version": 24, "settings": { ... }, "run": { ... } | null, "history": [ { "seed": "...", "mode": "finite", "mapReached": 3, "catches": 5, "casualties": 2, "playtimeMs": 540000, "won": false, "endedAt": "2026-10-25T12:00:00.000Z", "species": [ { "speciesId": "pikachu", "kos": 7, "damage": 412 } ] } ] }
```

## 🧪 Test and Validation Plan (for QA)

All criteria are `[unit]`. **No browser pass is owed** — nothing renders the store yet.

- **Method:**
  - `npm test` — Vitest, headless.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-152` against the exclusive paths.

### Acceptance criteria

- [ ] `[unit]` `npm run build` is clean.
- [ ] `[unit]` `npm test` is green, including the new `history.test.ts` and the
      extended `save.test.ts`.
- [ ] `[unit]` `pushHistory` on 50 rows with a 51st returns 50, newest first, with the
      oldest dropped; the input array is unchanged (`expect(before).toEqual(after)`).
- [ ] `[unit]` A v23 document (one is written verbatim in the test) decodes to
      `version: 24` with `history: []`, and the run it carried still decodes intact.
- [ ] `[unit]` A v24 document with a valid history round-trips byte-identically
      through encode/decode; one with a `history: "nope"`, one with a row missing
      `seed`, and one with `history` absent all decode with `history: []` **and keep
      the run**.
- [ ] `[unit]` `makeHistoryRecord` is pure: two calls with the same arguments are
      `toEqual`, and it never reads `Date.now()` (a test that stubs `Date.now` to throw
      still passes).
- [ ] `[unit]` `SAVE_VERSION` is `24` and `SAVE_MIGRATIONS[23]` exists — asserted by a
      test, not by reading the file.
- [ ] `[unit]` `src/engine/run/README.md` lists `history.ts` and `history.test.ts`.
- [ ] `[unit]` `git diff --name-only main...task-152` lists only the exclusive paths.

## 📣 Coordination

- For the Architect: **nothing writes the history yet.** The end-of-run call site
  (`src/scenes/RunOverScene.ts`, where the run summary is built from
  `src/ui/runSummary.ts`) is outside this task's paths, and the per-species KO/damage
  tally does not exist on `RunState`. `[Task-155]` renders the frames; it will need
  that write path and that tally — register them as the follow-up that makes the store
  live.
- For `[Task-155]`: read `history` from `SaveDocument`, `MAX_HISTORY` from
  `src/engine/run/history.ts`. A record with `species: []` is normal.
- For `[Task-154]`: this task takes `SAVE_VERSION` **24**; the dark flag takes **25**
  and must migrate `24 → 25`.

## ⛔ Out of scope

- Any scene, HUD panel, or `src/ui/**` change.
- Adding KO/damage counters to `RunState` or to the battle engine.
- Migrating a **v23** run's unrecorded history (impossible: it was never stored).
- Restoring a run from the history (`D5`).
