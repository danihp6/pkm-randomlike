# Spec: Task-217 — A fainted member's tallies reach the run's record

> Read `AGENTS.md` first. This file is your whole world. Work only inside the
> worktree `../wt-pkm-217` on branch `task-217`, base `origin/main`.

## 🎯 Scope

- **Task type:** pure engine rule (`src/engine/run/`), no Phaser, no DOM.
- **Role:** Dev.
- **Objective:** a run whose only Pokémon dies books the damage it took and then the
  member leaves the party for the rip (`releaseFainted`), but `makeHistoryRecord` reads
  `[...run.party, ...run.box]` only, so the finished run's record carries
  `species: []`. Measured on `main @ b5a06cc`: a fainting wild battle wrote
  `{casualties: 1, species: []}` where the same battle won wrote
  `species: [{ speciesId: 'slakoth', kos: 1, damage: 13 }]`. **A lost run's Pokémon
  table is therefore always empty**, and a won run loses each casualty's KOs and
  damage. After this task the record's `species` reads the **rip** beside the party
  and the box — the dead keep their counters, which is the point of permadeath — with
  the record's cap and order unchanged.
- **Environment:** worktree `../wt-pkm-217`, branch `task-217`.
- **Dependencies:** none — `run.rip` has shipped since the PC's RIP tab
  (`docs/routes-spec.md` §6).

### Exclusive paths (single writer)

- `src/engine/run/history.ts` + `src/engine/run/history.test.ts`
- `docs/design-spec.md` **§2 only** — the sentence/block that says a lost run's table
  lists the fallen. No other section.

### Inputs (read-only)

- `src/engine/run/state.ts` (`RunState.rip`, `stats.casualties`, `releaseFainted`'s
  contract), `src/engine/run/perms.ts`, `src/engine/run/index.ts`
- `src/ui/hud/panels/run-over/**` and `src/ui/hud/panels/stats/**` (they consume
  `RunHistoryRecord.species`; **read only**)
- `docs/design-spec.md` §2

## 🔒 Contract

### TypeScript (`src/engine/run/history.ts`)

```ts
/** The species rows of a run: party, box **and** rip, summed per species, sorted by id. */
function speciesRecords(run: RunHistory): readonly RunSpeciesRecord[];
```

- `makeHistoryRecord`'s exported signature and every other field stay **unchanged**:
  `{ seed, mode, mapReached, catches, casualties, playtimeMs, won, endedAt, species }`.
- The loop reads `[...run.party, ...run.box, ...run.rip]`. The aggregation, the
  `countOf` clamp, the skip of a zero-tally member and the sort by `speciesId` are
  unchanged, so a member that appears twice (never today, but the rip is appended-only)
  still sums into one row.
- **No save field and no `SAVE_VERSION` step:** the record is derived, not stored. An
  old save loads untouched.
- `run.rip` is read-only everywhere (D5): nothing here heals, moves or mutates a dead
  member, and no other function of the module changes behaviour.
- Reads no RNG.

## 🧪 Test and Validation Plan (for QA)

- **Method**
  - `npm test` — Vitest, headless; green including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only origin/main...task-217` audited against the exclusive paths.
  - **Live pass** (the criterion below is cheap but real): `npm run dev -- --port 5199
    --strictPort`, `google-chrome --headless=new --no-sandbox
    --remote-debugging-port=9222 --window-size=1280,800 about:blank`, CDP
    `Runtime.evaluate` over `http://localhost:9222/json` (Node 22's global `WebSocket`).
- **Acceptance criteria**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` a run whose **only** member fainted (party `[]`, rip holding that
        member with `kos > 0` or `damage > 0`) returns that member as one row in
        `makeHistoryRecord(run, …).species`, with its tallies, and `casualties: 1`.
  - [ ] `[unit]` a run with a live member, a boxed member and a rippen member of
        **different** species returns three rows, ascending by `speciesId`.
  - [ ] `[unit]` two members of the same species, one in the rip and one in the party,
        sum into a single row (kos and damage added).
  - [ ] `[unit]` a run with no tallies anywhere still returns `species: []`, and every
        other field of the record equals the pre-change value for the same input.
  - [ ] `[unit]` existing `history.test.ts` cases still pass unmodified except where
        they asserted the old bug; the report names each changed assertion.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` at 1280×800, a run whose only Pokémon faints reaches the run-over
        screen (`End`/`RunOverScene`) and its Pokémon table lists that species' name
        (`document.body.innerText` contains the species' display name and the row is
        the table's only row); before this task that table was empty.

## 📣 Coordination

- For the Architect: the record's `species` is now "everything that ever earned a KO
  or damage in this run, dead included"; a ranking or stats task may count casualties
  from it without a second source.
- For the next batch: no save change; the record is still derived on `endRun`.

## ⛔ Out of scope

- The run-over panel's layout, sorting or columns.
- `RunStats`, `casualties`, the PC's RIP tab, `releaseFainted` itself.
- Any `SAVE_VERSION` bump, `src/data/**`, i18n strings.
