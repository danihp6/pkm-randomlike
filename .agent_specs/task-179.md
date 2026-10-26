# Spec: Task-179 — The PC swaps only in the floor's entry room, always, and never as part of a catch

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule (run state + save decoder) with the UI call sites and the
  two specs that document it.
- **Role:** Dev.
- **Objective:** the party↔PC swap has **one** window, not two: the floor's **entry
  room**, on every visit — the first one and any return. The second window the engine
  still grants (the room's own catch, `RunState.pcCatch`) is removed, and so is
  `RunState.entryDeparted`, which is what made a return to the entry room lock the PC
  for the rest of the floor. After this task `pcFullyEditable(run)` is
  `run.routeInMap === 0` and `pcMemberEditable` is exactly the same predicate, so a
  catch that lands in the box is withdrawable **only** from the entry room. Both run
  fields retire with their last readers, and the save decoder keeps reading old
  documents that still carry them (it ignores them) while emitting neither.
- **Environment:** worktree `../wt-pkm-179`, branch `task-179`.
- **Dependencies:** none. Every task this one reads is merged on `main`
  (`origin/main` @ `157b06c`): the HUD's PC panel (`src/scenes/panels/pc.ts`, the DOM
  `?hud=dom` route), `src/ui/partyScreen.ts` and the v25 decoder in
  `src/engine/save.ts` are all shipped.

### Exclusive paths (single writer)

The list of paths this task creates or modifies. **Nothing outside this list.**

- `src/engine/run/state.ts`
- `src/engine/run/state.test.ts`
- `src/engine/save.ts`
- `src/engine/save.test.ts`
- `src/engine/run/resolve.ts` (the one comment that names `pcCatch`)
- `src/engine/run/trade.ts` (the one comment that names `pcCatch`)
- `src/engine/run/trade.test.ts` (its two assertions)
- `src/ui/hud/state.ts`
- `src/ui/hud/state.test.ts`
- `src/ui/hud/panels/party/view.test.ts` (fixture only)
- `src/ui/partyScreen.ts`
- `src/ui/partyScreen.test.ts`
- `src/ui/casino.ts` (the one comment that names `pcCatch`)
- `src/ui/casino.test.ts` (its two assertions)
- `src/scenes/panels/pc.ts`
- `src/scenes/panels/rewards.ts` (the one comment that names `pcCatch`)
- `src/scenes/RouteScene.ts` (only the debug floor teleport's two lines)
- `docs/routes-spec.md` (§3 and §6 only)
- `docs/design-spec.md` (§3's **swap bullet only**)
- `docs/maps-spec.md` (only the two parenthetical field lists that name `pcCatch`,
  lines 407 and 798 — left in the list so the docs never name a field that no longer
  exists)

### Inputs (read-only)

- `AGENTS.md`, `docs/routes-spec.md`, `docs/design-spec.md`, `docs/maps-spec.md`.
- `src/engine/run/state.ts`, `src/engine/save.ts`, `src/engine/maps/plan.ts`
  (`planMap(...).entryRoom` is `0` by construction, `plan.ts` 647),
  `src/engine/run/resolve.ts`, `src/engine/run/trade.ts`, `src/engine/run/party.ts`.
- `src/ui/hud/state.ts`, `src/ui/hud/panels/pc/view.ts`, `src/ui/partyScreen.ts`,
  `src/scenes/panels/pc.ts`.

## 🔒 Contract

### TypeScript

```ts
/** True in the floor's entry room: the only place the party and the PC may trade members. */
export function pcFullyEditable(run: RunState): boolean; // run.routeInMap === 0

/** The same rule, kept as the one name the panels call. The `memberId` parameter retires. */
export function pcMemberEditable(run: RunState): boolean; // === pcFullyEditable(run)

/** Unchanged signature; it no longer records anything about the room. */
export function addCaughtPokemon(run: RunState, pokemon: RunPokemon): RunState;
```

- `RunState` **loses** `pcCatch` and `entryDeparted`; the `PcCatch` type retires.
  `createRun`, `advanceRoute` and `advanceMap` stop writing both.
  `advanceRoute` keeps `discoveredRooms`/`arrivalEdge` and its comment is rewritten
  (the entry room is no longer "departed": the rule is the room id).
- `addCaughtPokemon` becomes the plain party-first-else-box placement (it may simply
  delegate to `addPokemon`); no `pcCatch` bookkeeping, same purity, same return
  semantics (same reference when nothing moved — this one never moves nothing, so keep
  `addPokemon`'s own contract).
- `dedupeMemberIds` keeps the id dedupe and its comment; the `pcCatch` re-key
  (state.ts 362-410) goes.
- The HUD's route state (`src/ui/hud/state.ts`) loses `entryDeparted` both in the type
  and in `projectHud`.
- **Determinism:** reads no RNG. No Phaser, no DOM, no `Math.random()`, no
  `Date.now()` in `src/engine/`.
- `SAVE_VERSION` stays **25**: the decoder is field-by-field, both keys are optional
  today, and this task removes fields rather than adding any (`save.ts` 77).

### Data

- No new key, no new file, no `src/data/**` change.

## 🧩 Data and configuration

None. The rule is a room id, and the entry room is `planMap(seed, mapIndex).entryRoom`
(`0`, `src/engine/maps/plan.ts` 647), so `routeInMap === 0` is the whole rule and no
table is involved.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task
    rewrites and adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-179` against the exclusive paths above.
  - `grep -rn "pcCatch\|entryDeparted\|pcMemberEditable(run, " src/` returns **nothing**
    (prose in the two `src/data`-free comments included).
  - Browser pass over CDP on `npm run dev -- --port <free> --strictPort` with the
    machine's headless Chromium, HUD mounted as DOM (`?hud=dom`), measuring the
    rendered PC card (`[data-hud-panel="pc"]`). Read the DOM the game rendered, and say
    which method produced each number.

- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean (`npm run build`, exit 0).
  - [ ] `[unit]` The whole suite passes (`npm test`, exit 0), with at least these new
        assertions in `src/engine/run/state.test.ts`:
    - `pcFullyEditable(run)` is `true` in the entry room on the **first** visit, and
      still `true` after leaving the entry room and coming back (`advanceRoute` twice);
    - `false` in any other room of the same floor;
    - `true` again on the next floor (`advanceMap`) before leaving its entry room;
    - `pcMemberEditable(run)` answers exactly the same in all four cases;
    - a catch placed in a full party's box (`addCaughtPokemon`) is editable in the
      room it was caught **only when that room is the entry room**, and never in
      another room;
    - `dedupeMemberIds` still re-keys colliding member ids in `party` and `box`.
  - [ ] `[unit]` `src/engine/save.test.ts` pins: a v16–v25 document carrying
        `entryDeparted` and `pcCatch` still decodes (and the decoded run has neither
        key); a document without them decodes; `JSON.stringify` of a decoded run
        contains neither `"pcCatch"` nor `"entryDeparted"`; every migration from v10 to
        v25 still produces a run the type can hold (chain a document from v10 up).
  - [ ] `[unit]` `src/ui/partyScreen.test.ts` pins: no across-swap outside the entry
        room (deposit and withdraw both refused, `run` unchanged) and a full
        across-swap inside it (party → box → party by id).
  - [ ] `[unit]` Nothing outside the exclusive paths was touched, and the grep above
        finds no `pcCatch` / `entryDeparted` / two-argument `pcMemberEditable` in
        `src/`.
  - [ ] `[live]` On the shipped game over CDP, DOM HUD, a run in map 1's entry room
        with at least one member in the box (seeding
        `localStorage['pokerandomlike.save']` with a v25 document before the first
        navigation — `SAVE_KEY`, `save.ts` 80 — is a legitimate way to reach that
        state; say if you used it): open the BOX window and count
        `document.querySelectorAll('[data-hud-pc="grid"] [data-hud-pc-cell][data-locked="true"]').length`
        — it must be **0** while filled cells exist. Measure the same count in a room
        one door away: it must equal the number of filled box cells (and each of those
        cells must render one `.pc__cell-veil`). Then return to the entry room and
        re-measure: still **equal to the filled count** (a return no longer reopens the
        PC). Report the three numbers and the room ids each was taken in.

## 📣 Coordination

- For the Architect: `[Task-179]` removes `RunState.pcCatch` and
  `RunState.entryDeparted`; any future task that reads either field is stale. No
  `SAVE_VERSION` step — the chain stays **14 → 15 → 16 → 17 → 18 → … → 25**.
- For the next batch: the rule to build against is `pcFullyEditable(run)` /
  `pcMemberEditable(run)` (one argument, entry room only), and the box panel's
  `locked` flag is the only place the UI asks.

## ⛔ Out of scope

- No `SAVE_VERSION` bump and no migration that rewrites a document's fields.
- No change to the capture rules (`capturedRooms`, `stats.catches`, `caughtSpecies`,
  the party-first/PC-second placement itself).
- No new panel, no new DOM component, no restyle of the lock veil.
- No change to the debug teleport's behaviour: only its two obsolete object literal
  fields go.
- Do not touch `src/data/dex/**`, `package.json`, `src/main.ts` or any scene other
  than the named lines in `src/scenes/RouteScene.ts`.
