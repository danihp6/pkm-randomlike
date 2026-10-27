# Spec: Task-181 — The run history is written, and the run counts what it prints

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule + Phaser scene + persistence.
- **Role:** Dev.
- **Objective:** `src/engine/run/history.ts` already knows how to build a
  `RunHistoryRecord` and prepend it to a list, and **nothing calls it**: no run ever
  reaches `save.history`, so a player who just finished a run opens STATS and reads
  "NO FINISHED RUNS YET". After this task a run that ends **once** writes **one**
  record — with the instant it started, the playtime it took and the per-species KOs
  and damage the battle actually produced — and a second visit to the end seam does
  not append a second one. The run therefore carries three new facts (`startedAt`,
  `RunStats.faints`, and each member's `kos` / `damage` / `damageTaken`), the battle
  hands them back on `BattleReturn.tallies`, and the save steps `25 → 26`.
- **Environment:** worktree `../wt-pkm-181`, branch `task-181`.
- **Dependencies:** none. `history.ts`, `battleLink.ts`, `save.ts` and the three
  scenes are all on `main` today.

### Exclusive paths (single writer)

Nothing outside this list. Another task of the same batch holds no path here;
`src/ui/hud/panels/run-over/**` (which prints these numbers) belongs to a **later**
task and must not be touched — it is not in this list.

- `src/engine/run/state.ts` and `src/engine/run/state.test.ts`
- `src/engine/run/progression.ts` and `src/engine/run/progression.test.ts`
- `src/engine/run/history.ts` and `src/engine/run/history.test.ts`
- `src/engine/run/battleLink.ts` and `src/engine/run/battleLink.test.ts`
- `src/engine/run/README.md` (only if you add, rename or delete a file in that folder)
- `src/engine/save.ts` and `src/engine/save.test.ts`
- `src/scenes/RouteScene.ts`
- `src/scenes/BattleScene.ts` and `src/scenes/BattleScene.test.ts`
- `src/scenes/RunOverScene.ts`
- `src/scenes/StarterScene.ts` (**only** the `createRun` call at line 535 — see the
  contract; do not touch the starter offer, its keys or its footer)
- `docs/design-spec.md` — **one bullet only**: §2's last bullet,
  `Losing every Pokémon in the party ends the run.`
- `docs/tech-decisions.md` — a new `## D54` section, appended after D53 and before
  `## Open questions`

`docs/hud-fidelity.md`, `src/ui/hud/**`, `src/i18n/**`, `src/data/**`, `package.json`
and `src/main.ts` are **not** yours.

### Inputs (read-only)

- `src/engine/run/history.ts` (the record shape and `pushHistory`/`makeHistoryRecord`
  you will call), `src/engine/run/battleLink.ts`, `src/engine/battle/state.ts`
  (`BattleEvent`, `BattleState.log`), `src/engine/save.ts`.
- `docs/design-spec.md` §2, `docs/tech-decisions.md` (D5, D11, D54's neighbours),
  `docs/battle-spec.md`.
- `CHANGELOG.md` for the voice of a shipped entry.

## 🔒 Contract

### `src/engine/run/state.ts`

```ts
export type RunStats = Readonly<{
  catches: number;
  casualties: number;
  /** Enemies this run has fainted, the run's own counter (`Task-181`). */
  faints: number;
}>;

export type RunState = Readonly<{
  // ... existing fields ...
  /**
   * The ISO-8601 instant the run was created, passed **in** by its caller: the
   * engine reads no clock (`D11`). `''` means the run came from a save written
   * before `SAVE_VERSION` 26 and its playtime is unknown (reported as 0).
   */
  startedAt: string;
}>;

export type RunInit = Readonly<{
  // ... existing fields ...
  /** The ISO instant the run begins; absent or `''` means unknown. */
  startedAt?: string;
}>;
```

- `emptyRunStats()` returns `{ catches: 0, casualties: 0, faints: 0 }`.
- `createRun(init)` sets `startedAt: init.startedAt ?? ''`.
- The caller supplies the clock. Only `src/scenes/RouteScene.ts` and
  `src/scenes/StarterScene.ts` may call `new Date()` / `Date.now()` for this feature.

### `src/engine/run/progression.ts` — `RunPokemon` grows three counters

```ts
export type RunPokemon = Readonly<{
  // ... existing fields ...
  /** Enemies this member fainted this run; absent means 0 (an older save). */
  kos?: number;
  /** Damage this member dealt this run; absent means 0. */
  damage?: number;
  /** Damage this member took this run; absent means 0. */
  damageTaken?: number;
}>;
```

They are optional on purpose: every construction site and every decoder stays valid,
and the readers treat an absent field as 0. Add one pure, exported, total helper so
the scene does not invent its own arithmetic:

```ts
/** `member` with `tally` added onto its three counters; absent counts as zero. */
export function withMemberTally(member: RunPokemon, tally: { kos?: number; damage?: number; damageTaken?: number }): RunPokemon;
```

It must return the same shape the file's other editors return (a frozen-free plain
object is fine) and must never write a negative counter (clamp at 0).

### `src/engine/run/battleLink.ts` — the tallies travel back with the battle

```ts
/** One member's contribution to the battle that just ended. */
export type MemberTally = Readonly<{
  /** The player member's `FighterSnapshot.id` — the same id the run's members carry. */
  memberId: string;
  /** Enemies this member fainted. */
  kos: number;
  /** Damage this member dealt. */
  damage: number;
  /** Damage this member took. */
  damageTaken: number;
}>;

export type BattleReturn = Readonly<{
  // ... existing fields ...
  /** The player's side only; absent means the battle reported no tallies. */
  tallies?: readonly MemberTally[];
}>;

/**
 * The player's per-member tallies, read off the finished battle: the `damage`
 * events of the enemy side are credited to the player fighter that was on the
 * field, an enemy `faint` under that same fighter is a KO, and the player side's
 * own `damage` events are what that fighter took. Total and pure: an empty log
 * returns one entry per player fighter with three zeros.
 */
export function battleTallies(
  log: readonly BattleEvent[],
  playerParty: readonly { id: string }[],
): readonly MemberTally[];
```

Attribution rule, stated so two readers cannot disagree: the **fielded** player
fighter starts as `playerParty[0]` and changes on every `switch` event whose side is
`player` (its `fighterId`). A `damage` event credits its `amount` to the fielded
fighter of the **other** side (enemy-side damage → the fielded player fighter's
`damage`; player-side damage → that fighter's `damageTaken`). An enemy-side `faint`
credits `kos: 1` to the fielded player fighter. `battleTallies` reads no RNG and no
clock.

A battle that captured or was fled still returns tallies (the damage happened),
so this is not conditional on the outcome.

### `src/engine/run/history.ts` — the end seam is pure and idempotent

```ts
/** A run's history as the end seam holds it: the list and whether it already ended. */
export type RunEndLog = Readonly<{
  history: readonly RunHistoryRecord[];
  ended: boolean;
}>;

export function emptyEndLog(history: readonly RunHistoryRecord[]): RunEndLog;

/**
 * The log after a run ends: appends one record and flips `ended`; a log already
 * ended is returned **unchanged**, so calling it twice appends once.
 */
export function endRun(
  log: RunEndLog,
  run: RunHistory,
  ending: Readonly<{ endedAt: string; playtimeMs: number; won: boolean }>,
): RunEndLog;
```

`makeHistoryRecord` already reads the counters structurally; with the fields above it
starts filling `species` without a signature change. Keep its existing behaviour for
a member with no counters (the row is skipped).

### `src/engine/save.ts` — `SAVE_VERSION` 25 → 26

- `SAVE_VERSION = 26`.
- A `25 → 26` migration seeds `startedAt: ''` on the run and `stats.faints: 0`; both
  are optional-safe in the decoder (a document without them decodes too, with the
  same defaults).
- The encode/decode pair round-trips both.
- New writer:

```ts
/** Writes `history` over the stored document, keeping its settings and its run. */
export function storeHistory(storage: StorageLike | null, history: readonly RunHistoryRecord[]): SaveDocument;
```

### `src/scenes/BattleScene.ts`

`returnToRoute()` adds `tallies: battleTallies(this.state.log, this.state.sides.player.party)` to the
`BattleReturn` it builds. Nothing else in the scene changes semantics.

### `src/scenes/RouteScene.ts`

- `applyBattleResult(result)` books `result.tallies` onto the run **before** the fold
  continues: each entry's `kos`/`damage`/`damageTaken` is added onto the matching
  party (and box) member by `member.fighter.id`, and `stats.faints` grows by the sum
  of the tallies' `kos`. An absent `tallies` (an old caller, a test) books nothing.
- One end seam, replacing both `scene.start('RunOver', …)` calls (today at 3786 and
  3793):

```ts
private endLog: RunEndLog | null = null; // built from the loaded save's history

/** Ends the run once: writes its record, then opens the board. */
private endRun(won: boolean): void;
```

  It reads `run.startedAt`, builds `endedAt = new Date().toISOString()`,
  `playtimeMs = startedAt === '' ? 0 : Math.max(0, Date.now() - Date.parse(startedAt))`
  (a `NaN` parse is 0), calls the pure `endRun` from `history.ts` over the log loaded
  from `loadSave(...)`, writes it with `storeHistory(...)` **only when the log
  actually changed**, and then `this.scene.start('RunOver', { run: this.run, won })`.
- Dev-only reachability for the browser pass, in the shape `BattleScene` already uses
  with `__pkmBattle`: under `IS_DEVELOP`, publish the scene as
  `(globalThis as Record<string, unknown>).__pkmRoute = this` and delete it on
  `shutdown`, plus

```ts
/** Dev-only: ends the run through the real seam, so the browser pass can measure it. */
debugEndRun(won: boolean): boolean; // false when there is no run or it already ended
```

### `src/scenes/StarterScene.ts` — one line

The `createRun` call at 535 passes `startedAt: new Date().toISOString()`. **Nothing
else in that file moves** — not the offer, not the keys, not the footer, not the
seed prompt. `RouteScene`'s own dev `createRun` call (1144) passes the same.

### Determinism

- No `Math.random()`, `Date.now()` or `new Date()` inside `src/engine/` — the instant
  arrives as an argument. `[unit]` tests assert the absence.
- `battleTallies` reads only the log; the same log returns the same tallies.

## 🧩 Data and configuration

| Field | Shape | Default | Meaning |
| --- | --- | --- | --- |
| `RunState.startedAt` | ISO-8601 string | `''` | when the run began; `''` = unknown |
| `RunStats.faints` | whole ≥ 0 | `0` | enemies fainted this run |
| `RunPokemon.kos` | whole ≥ 0, optional | absent = 0 | enemies this member fainted |
| `RunPokemon.damage` | whole ≥ 0, optional | absent = 0 | damage dealt |
| `RunPokemon.damageTaken` | whole ≥ 0, optional | absent = 0 | damage taken |
| `BattleReturn.tallies` | `MemberTally[]`, optional | absent | the player's per-member tally |
| `SAVE_VERSION` | number | **26** | the step this task takes |

No balancing value. No generated data. Do not run `npm run data:dex`.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only origin/main...task-181` audit against the exclusive paths.
  - One browser pass is owed for the two `[live]` criteria: `npm run dev -- --port
    <free> --strictPort`, Chromium headless, CDP `Runtime.evaluate` for the DOM and
    `localStorage`, at 1280×800, `?hud=dom`.
- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` is clean and `npm test` is green with every new test.
  - [ ] `[unit]` `save.test.ts`: a v25 document (no `startedAt`, no `stats.faints`)
    decodes to `startedAt === ''` and `faints === 0`, and encodes at version 26; a
    document carrying both round-trips unchanged.
  - [ ] `[unit]` `history.test.ts`: `endRun` on an `emptyEndLog` appends exactly one
    record; a **second** call with the same run returns the same `history` length
    and `ended === true`.
  - [ ] `[unit]` `battleLink.test.ts`: a fixture log — player move, enemy `damage`
    40, enemy `faint` — returns one tally with `kos: 1` and `damage: 40` for that
    member; a player-side `damage` of 12 returns `damageTaken: 12`; an empty log
    returns one entry per player fighter, all zeros, and no RNG is read.
  - [ ] `[unit]` a **fixed-seed** battle run through the engine (the pattern
    `src/engine/battle/*.test.ts` already uses) returns `tallies` whose `memberId`s
    are the player party's fighter ids and whose `damage + damageTaken` is greater
    than zero after at least one hit landed.
  - [ ] `[unit]` `state.test.ts`: `createRun` without `startedAt` reads `''`, with one
    reads it back verbatim, and `emptyRunStats().faints === 0`.
  - [ ] `[unit]` `progression.test.ts`: `withMemberTally` adds onto absent counters,
    adds onto existing ones and never goes negative.
  - [ ] `[unit]` `grep -rn "Date.now\|new Date" src/engine` finds none in the files
    this task touched (the scene owns the clock).
  - [ ] `[unit]` `git diff --name-only origin/main...task-181` lists only paths from
    the exclusive list; `src/ui/hud/**`, `src/i18n/**` and `src/data/**` are absent.
  - [ ] `[live]` **The record is written once.** Start a run from the main menu, open
    the route, then `Runtime.evaluate('__pkmRoute.debugEndRun(true)')`; read
    `JSON.parse(localStorage.getItem('pokerandomlike.save'))`: `history.length === 1`,
    `history[0].playtimeMs > 0`, `history[0].endedAt` parses as an ISO instant and
    `history[0].seed` equals the run's share seed. Call `debugEndRun(true)` a second
    time (after returning to the menu; if the scene is gone, re-enter the route) and
    read it again: still `1`. Method: CDP `Runtime.evaluate`, no screenshot.
  - [ ] `[live]` **The board lists it.** From the main menu, open the STATS panel and
    read `.run-over`'s run list rows over CDP: exactly one row, and its playtime
    text is not the empty state's `—`. Method: CDP `Runtime.evaluate` on
    `document.querySelectorAll('[data-hud-run-over-run]').length` (or the panel's own
    row selector — read it from `src/ui/hud/panels/run-over/`, read-only) plus the
    row's text content. **The dash columns inside a row are a later task's; do not
    fail this task on them.**

## 📣 Coordination

- For the Architect: the run's clock enters through `RunInit.startedAt`, so every
  future `createRun` caller owns the instant; `StarterScene` is now a **shared path**
  with the starter-reroll task and the two must not run in the same batch.
- For the next batch: `RunState.startedAt`, `RunStats.faints` and each member's
  `kos`/`damage`/`damageTaken` are the numbers the run-over board prints; a record's
  `species` is filled by `makeHistoryRecord` with no signature change.
- For QA: the dev-only `__pkmRoute.debugEndRun(won)` is the only browser seam; it is
  `IS_DEVELOP` only and must not exist in a production build.

## ⛔ Out of scope

- The run-over board's cells (a later task owns `src/ui/hud/panels/run-over/**`).
- Clearing the run from the save when it ends, or any change to CONTINUE's guard.
- A history screen, a ranking, or saving anything else across runs.
- Touching the starter offer, its keybinds, its footer or its i18n keys.
- `src/main.ts`, the debug menu's own UI, `package.json`, any generated data.
