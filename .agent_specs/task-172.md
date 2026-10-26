# Spec: Task-172 — Dark Matter is reachable only through a dark catch

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule (pure logic) + data/docs + a fixed-seed re-pin.
- **Role:** Dev.
- **Objective:** a plain wild or trainer roll can never hand out **Dark Matter** any
  more; the dark catch keeps it as its own grant. Today `randomAbilityPool`
  (`src/engine/battle/randomAbility.ts` 31-40) is built from **every** registered
  ability effect, and the hand-authored `darkmatter` row registers one
  (`['darkmatter', darkmatter()]`, `src/engine/battle/effects/abilities.ts` 2755), so
  `BANNED` (15-22) is the only filter and it does not name it — a wild thus rolls
  Dark Matter. The dark path grants it explicitly from the catch and needs nothing
  from the pool (`asDark`, `src/engine/run/dark.ts` 31-46, `DARK_ABILITY` at line 7),
  so keeping it out of the pool removes nothing from that path. The pool's fixed-seed
  draws move when its size changes, and this task **re-pins them in the same commit**
  instead of leaving them stale.
- **Environment:** worktree `../wt-pkm-172`, branch `task-172`.
- **Dependencies:** none — `[Task-151]` (the custom row), `[Task-153]` and
  `[Task-154]` (the catch and its grant) all shipped; every file read is on `main` @
  `f211850`.

### Exclusive paths (single writer)

Nothing outside this list. No other task in the batch claims any of these.

- `src/engine/battle/randomAbility.ts`
- `src/engine/battle/randomAbility.test.ts`
- `docs/data-spec.md` **§3 only** ("Authored", today lines 92-130, the
  `src/data/dex/customAbilities.ts` table row at line 97).
- `docs/battle-spec.md` **§11.1 only** ("The out-of-battle abilities", today lines
  718-733). `docs/battle-spec.md` is shared with Task-168 in this batch: **Task-168
  writes §4 (today lines 235-381) and this task must not touch a line of it.**
  Touch nothing outside §11.1 in that file.

No file is added, renamed or deleted, so no folder `README.md` changes.

### Declared exception (contingent, one line, Architect-added)

`src/engine/run/memberEdits.test.ts` is **not** in the plan's path list. Its
"fixed-seed pins (`D11`)" block at lines 393-430 pins `ability: 'Early Bird'` (line
406) with a comment that says the pin tracks the pool: *"The ability pool gained the
hand-authored `darkmatter` row, so every draw moves with it (the pool is sorted by
id); this context re-pins here."* Removing `darkmatter` from the pool can move that
same draw. **Only if `npm test -- memberEdits` fails on that one expectation**, change
that one asserted id (line 406) to the value the test reports, and adjust the
comment's second sentence to say the pool dropped `darkmatter`. Nothing else in that
file may change, and the deviation must be named in the dev's `dev: done` commit
message. If that file is red for any other reason, stop and report instead.

### Inputs (read-only)

- `AGENTS.md`.
- `src/engine/battle/randomAbility.ts` and `.test.ts` (the two files being edited).
- `src/engine/battle/effects/registry.ts` (`registeredEffects`, `normalizeEffectId`)
  and `src/engine/battle/effects/abilities.ts` (the `darkmatter` row, 1848-1860 and
  2755).
- `src/data/dex/abilities.ts` (`getAbility`, `allAbilities`, `allAbilitiesWithCustom`,
  `getCustomAbility`), `src/data/dex/customAbilities.ts` (the `darkmatter` row).
- `src/engine/run/dark.ts` (`DARK_ABILITY` line 7, `DARK_ABILITY_NAME` line 10,
  `isDarkCatch` 17-24, `asDark` 31-46) and `src/engine/run/dark.test.ts` (**read-only:
  it must stay byte-identical and keep passing**).
- `src/engine/battle/fighter.ts` (`createFighter`'s ability roll, 513) and
  `src/engine/run/memberEdits.ts` (`resolveAbility`, 96-113).
- `src/engine/rng.ts` (`Rng`, `hashSeed`).
- `docs/data-spec.md` §3, `docs/battle-spec.md` §11.1.

Rules: `src/engine/` stays free of Phaser and DOM; no `Math.random()`, no
`Date.now()`; no new RNG stream and no new stream key.

## 🔒 Contract

### TypeScript

`src/engine/battle/randomAbility.ts` — one entry added to the existing private set,
plus the comment that explains it:

```ts
const BANNED: ReadonlySet<string> = new Set([
  'powerconstruct',
  'multitype',
  'rkssystem',
  'gulpmissile',
  'asoneglastrier',
  'asonespectrier',
  // Dark Matter is not broken, it is gated: a dark catch is its only grant
  // (`DARK_ABILITY`, `src/engine/run/dark.ts`), so a wild roll must never hand it out.
  'darkmatter',
]);
```

The block comment above `BANNED` (today lines 5-14) currently says every banned id is
"**not functional** … absent from the effect registry today". Rewrite that sentence so
it states **two** reasons and still ends with the sentence about downside abilities
being deliberately kept:

1. an ability whose whole effect is a forme or species change the engine does not
   model (the six shipped ids);
2. an ability whose only source is a single hand-authored grant — `darkmatter`, the
   dark catch's.

Exported surface: **unchanged**. `randomAbilityPool()` and `randomAbility()` keep
their exact signatures and behaviour (`Readonly<Ability[]>`, `Ability | undefined`),
the pool stays sorted by id, and `randomAbility` keeps the draw it ships today:
`new Rng(hashSeed(seed + ':ability:' + speciesId))`, the `:ability:` stream. This
task adds **no** draw, **no** stream and **no** key; it only removes one pool member.

**Determinism:** the only thing that moves is the pool **size** (one less id) and
therefore the index `randomAbility` reads from the `:ability:` stream for the seeds
whose roll lands past the removed id. That is a re-pin, not a new stream: the draws in
`randomAbility.test.ts` are the ones this task re-pins, and no other rule may read a
different stream because of this change.

### Data

- No new key, no shape change, no save field: `SAVE_VERSION` stays **25**.
- The `darkmatter` ability row itself is unchanged (still `getAbility('darkmatter')`,
  still counted by `meta.json`'s `counts.customAbilities = 1`); only its
  reachability by roll changes.

## 🧩 Data and configuration

No JSON or balancing table is touched. The gate is engine code (`BANNED`) plus two doc
rows:

- `docs/data-spec.md` §3, the `src/data/dex/customAbilities.ts` row (line 97): after
  "…while `allAbilities()` stays the 311 generated rows, and `meta.json`'s
  `counts.customAbilities` counts them", add one clause: the random ability pool never
  rolls it — `BANNED` in `src/engine/battle/randomAbility.ts` — because the dark catch
  is its only grant (`Task-172`).
- `docs/battle-spec.md` §11.1 (718-733): after the paragraph that explains the pool is
  derived from the registered effect set, add one short paragraph: a registered row is
  *reachable*, not *rolled* — `darkmatter` is registered (its `onModifyEffectiveness`
  row) and still banned from the pool, because `src/engine/run/dark.ts`'s `asDark`
  grants it on a dark catch and nothing else may; a re-pin of the pool's fixed-seed
  draws follows a pool change of any size.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-172` audited against the exclusive paths list
    **plus** the one contingent path above.
  - Every criterion here is `[unit]`: this task owes **no** browser pass.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean (`npm run build`).
  - [ ] `[unit]` `npm test -- randomAbility` proves the pool excludes it: the test that
        today reads `expect(ids.filter((id) => id === 'darkmatter')).toHaveLength(1)`
        (line 73-76) now asserts the pool contains **no** `darkmatter`
        (`toContain` inverted, or `toHaveLength(0)` on the filtered list), and the rest
        of that test's id list (blaze, levitate, wonderguard, pickup, honeygather,
        iceface present; the twelve forme-locked ids absent; `powerconstruct`,
        `multitype`, `gulpmissile` absent; length > 200) is unchanged.
  - [ ] `[unit]` `npm test -- randomAbility` proves a roll can never produce it: 10 000
        seeds are actually drawn (a loop over `randomAbility('charmander', 'seed-' + i)`
        for `i` in `0..9999`, collecting any id equal to `'darkmatter'`) and the
        collected list is empty. Building the list and asserting it is empty once is
        fine, as long as all 10 000 draws happen.
  - [ ] `[unit]` `npm test -- randomAbility` carries the **re-pinned** draw: the
        `'run-1'` expectation at line 85 is the ability the new pool actually yields,
        and its test title no longer claims the custom row is in the pool.
  - [ ] `[unit]` `npm test -- dark` is green with `src/engine/run/dark.test.ts`
        **byte-identical** (`git diff --stat main...task-172 -- src/engine/run/dark.ts
        src/engine/run/dark.test.ts` prints nothing): `asDark` still writes
        `'Dark Matter'` as the primary and the member's old ability as the second slot.
  - [ ] `[unit]` A seeded dark catch still carries it, asserted **inside
        `randomAbility.test.ts`** (never in `dark.test.ts`) where the pool cannot
        matter: with a member built from `createFighter` and a seed the test pins,
        `asDark(member).fighter.ability === DARK_ABILITY_NAME` and
        `.secondAbility === member.fighter.ability`; and
        `randomAbilityPool()` never lists `DARK_ABILITY` (the id `'darkmatter'`).
  - [ ] `[unit]` `npm test` is green **in full**, which is what proves the re-pin is
        complete: no other fixed-seed expectation in the repository moved. If
        `npm test -- memberEdits` is the only red and its only failing expectation is
        the pinned ability id at line 406, apply the declared exception above and
        re-run; anything else is a report, not an edit.
  - [ ] `[unit]` `git diff --name-only main...task-172` lists only the four paths
        above (and, if used, `src/engine/run/memberEdits.test.ts`), with
        `docs/battle-spec.md` touched inside §11.1 only (`git diff
        main...task-172 -- docs/battle-spec.md` shows no line < 718).

## 📣 Coordination

- **For Task-168 (same batch):** `docs/battle-spec.md` is shared by section only — this
  task writes §11.1 (718-733) and Task-168 writes §4 (235-381). Do not reflow,
  renumber or touch §4.
- **For the next batch:** `BANNED` is now a two-reason list (unmodeled, and
  grant-only). Any ability whose only source is a special NPC or a special catch is
  added here with its reason written beside it, never with a filter at the call site.
  The pool's size is part of the seed's meaning, so a pool change of any kind owes the
  same re-pin this task does: `randomAbility.test.ts`'s `'run-1'` draw, and a full
  `npm test` to find any other pin.
- **For the Orchestrator:** this task can need one line in
  `src/engine/run/memberEdits.test.ts` (the `Early Bird` pin) that the plan's path list
  does not carry. It is declared above as a contingent exception; if it is used, the
  batch's cross-task audit must not read it as a path conflict (no other task in the
  batch touches that file).

## ⛔ Out of scope

- No change to the `darkmatter` effect row, to `customAbilities.ts`, to
  `meta.json`/the generated dex, or to `asDark`/`isDarkCatch` (the grant path stays
  exactly as shipped).
- No change to `randomAbility`'s seed, stream key, sort order or return type; no new
  `exclude` parameter; no reroll of stored members.
- No `src/data/**`, `package.json`, `src/i18n/**`, or any path in another task's list
  (`src/engine/battle/{turn,fighter,volatile,commands}.ts`,
  `src/scenes/BattleScene.ts`, `src/ui/evolutionGraph.ts`,
  `src/data/tilesets/props.ts`).
- No `SAVE_VERSION` step and no new run field.
