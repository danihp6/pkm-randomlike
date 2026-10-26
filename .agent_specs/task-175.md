# Spec: Task-175 — No wild or static whose evolution line the run already holds

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule (encounter pool + static room).
- **Role:** Dev.
- **Objective:** a run must never meet — in the tall grass or in a static room — a
  species whose evolution line it already holds, **however it got it**: the starter, a
  catch, a trade-in, an egg, a boxed member or one lost (`rip`). Today
  `wildExclusions(run)` already expands a recorded id to its whole line
  (`evolutionFamily` walks `prevo` up and `evos` down, `formeFamily` adds the formes)
  but it reads **only `run.caughtSpecies`**, which `recordCatch` writes on a catch
  alone. So the starter and every member the run did not catch are invisible to it,
  and the static-species leaf never consults it at all: `staticRoomContent` draws
  straight off `STATIC_SPECIES`.
- **Environment:** worktree `../wt-pkm-175`, branch `task-175`, base `origin/main`
  @ `e241f9f`.
- **Dependencies:** none — `[Task-52]`'s `caughtSpecies` record ships and is only
  extended here.

### Exclusive paths (single writer)

**Nothing outside this list.**

- `src/engine/run/pool.ts`
- `src/engine/run/pool.test.ts`
- `src/engine/routes/staticSpecies.ts`
- `src/engine/routes/staticSpecies.test.ts`
- `docs/routes-spec.md` — **§2 only**
- `docs/maps-spec.md` — **§7 only**

`src/scenes/RouteScene.ts` and `src/engine/routes/encounters.test.ts` are **not** yours:
`RouteScene` already passes `wildExclusions(this.run)` to both seams and needs no edit.
If an existing assertion in `src/engine/routes/encounters.test.ts` goes red, report it —
do not edit that file.

### Inputs (read-only)

- `AGENTS.md`
- `src/engine/run/state.ts` (`RunState.party` / `.box` / `.rip`, `RunPokemon.fighter`,
  `recordCatch`, `caughtSpecies`)
- `src/data/dex/evolutions.ts` (`evolutionFamily`, `formeFamily`)
- `src/data/staticSpecies.ts` (`STATIC_SPECIES`, `LEGENDARY_SPECIES`)
- `src/engine/routes/encounters.ts` (`EncounterTable`, `RouteEncounters`)
- `docs/routes-spec.md` §2, `docs/maps-spec.md` §7

## 🔒 Contract

### TypeScript

```ts
// src/engine/run/pool.ts — same signature, wider source set.

/**
 * The ids the wild table must not offer: every species the run **holds or held**
 * (party, box and rip members' `fighter.speciesId`) plus every recorded catch
 * (`run.caughtSpecies`), each expanded to its evolution line (`evolutionFamily`) and
 * its formes (`formeFamily`). Empty for a run with an empty party, box, rip and catch
 * record; an unknown id contributes nothing. Pure — draws no RNG (D11).
 */
export function wildExclusions(run: RunState): ReadonlySet<string>;
```

```ts
// src/engine/routes/staticSpecies.ts — same signature, filtered draw.

export function staticRoomContent(
  run: RunState,
  mapIndex: number,
  roomId: number,
  obstacle: GateKind,
): StaticRoomContent;
```

- **Determinism:** neither function draws an extra number. `wildExclusions` reads no
  RNG; `staticRoomContent` keeps its two minted streams
  (`…:static-variant:<roomId>`, `…:static-species:<roomId>`) and the same index draw
  over the **filtered** list, so a seed reproduces the same species and no shipped
  stream moves.
- **Rules:** pure TypeScript, no Phaser, no DOM, no new dependency.
  `RunState.party`, `.box` and `.rip` are all saved fields — **no `SAVE_VERSION` step**
  and no new run field.

### Behaviour (exact)

1. `wildExclusions(run)` iterates `run.caughtSpecies` **plus** `run.party`,
   `run.box` and `run.rip` (each member's `fighter.speciesId`), deduplicating through
   the same `Set`, and expands each id with `evolutionFamily` and `formeFamily` exactly
   as today. Unknown ids still contribute nothing.
2. `staticRoomContent` builds its list as today (`legendary ? LEGENDARY_SPECIES :
   STATIC_SPECIES`), then filters it by `wildExclusions(run)` **before** the species
   draw. When the filter would empty the list, fall back to the unfiltered list, so a
   late floor never fields nothing. The variant decision and the draw index arithmetic
   stay where they are.
3. Nothing else changes: `encounterTableFor`, `RouteEncounters.setExclusions`, the
   wild band windows, the static gate rows and the `pickedItems` marks are untouched.

## 🧩 Data and configuration

None. No table row, no i18n key, no saved field.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only origin/main...task-175` audited against the exclusive paths.
  - Every criterion is `[unit]`: this task owes **no** browser pass.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` The declared tests exist and pass.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[unit]` `pool.test.ts`: a run holding `pikachu` excludes `pichu`, `pikachu`,
    `raichu` and `raichualola`.
  - [ ] `[unit]` `pool.test.ts`: a run whose **starter** is `charmander` excludes
    `charmander`, `charmeleon` and `charizard` with **no** catch record at all.
  - [ ] `[unit]` `pool.test.ts`: a member in `box` and a member in `rip` each exclude
    their own line (one case per field).
  - [ ] `[unit]` `pool.test.ts`: the two shipped cases whose fixture run holds a
    starter (`is empty for a run that has caught nothing`, `contributes nothing for an
    unknown recorded id`) are **rewritten** to the new truth — the fixture run with a
    starter is no longer empty — and the fixture's doc comment no longer claims the
    function reads only `caughtSpecies`.
  - [ ] `[unit]` `staticSpecies.test.ts`: 20 fixed seeds on a run holding `pikachu`
    never draw `pichu`, `pikachu`, `raichu` or `raichualola` as the static species.
  - [ ] `[unit]` `staticSpecies.test.ts`: a fixed seed on a run whose party does not
    intersect the list still picks exactly the species it picked before the filter
    (pin the number in the test, and say in the report which seed/id you pinned).
  - [ ] `[unit]` `staticSpecies.test.ts`: an exclusion set that covers the whole list
    falls back to the unfiltered list (the room still fields a species).
  - [ ] `[unit]` `npm test -- pool staticSpecies` passes.

## 📣 Coordination

- For the Architect: the doc lines in the plan («`wildExclusions` reads only
  `run.caughtSpecies`») are now stale, and `docs/routes-spec.md` §2 /
  `docs/maps-spec.md` §7 must say "the run holds", not "the run caught".
- For the next batch: `[Task-176]` edits `docs/routes-spec.md` §2 for the TM rule in
  Batch 77 — it builds on this §2 wording, so keep the sentence shape intact and add
  only the exclusion rule.

## ⛔ Out of scope

- A new run field, a new saved set, or a `SAVE_VERSION` step.
- Filtering trainer parties, bosses or the legendary *room opening* (`missionsCompleted`
  stays the only gate).
- Any change to `RouteScene.ts`, `encounters.ts`, `encounters.test.ts`, or the wild
  band windows.
- Filtering the static **gate** rows or the `pickedItems` marks.
