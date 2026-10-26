# Spec: Task-160 — Population Bomb and the two Triple moves check accuracy on every hit

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule (battle hit loop + a data-field type) with an audit-table update.
- **Role:** Dev.
- **Objective:** after this task the three moves the dex marks `multiaccuracy` — **Population
  Bomb** (10 hits, 90 %), **Triple Axel** and **Triple Kick** (3 hits, 90 %) — roll accuracy
  **once per hit** instead of once per move: the hit loop rolls `rollHitWith` before every hit
  after the first and **stops the move on the first miss** with exactly one `battle.log.missed`.
  The same loop gives Triple Kick and Triple Axel their **ramp** (`basePower × (hit + 1)`:
  10/20/30 and 20/40/60), which is why their damage reads flat today. The move audit learns to
  see both halves: `MoveProbe` gains `damageAmounts` and the three rows pin a miss stop and a
  rising per-hit sequence under a fixed seed, so a flat multi-hit cannot pass again.
- **Environment:** worktree `../wt-pkm-160`, branch `task-160`.
- **Dependencies:** none open. `[Task-159]` (Batch 72, merged) added `MoveProbe.residual` and the
  residual pass to the same files; nothing here depends on it beyond not disturbing it.

### Exclusive paths (single writer)

- `src/data/dex/moves.ts` — the hand-written `Move` type only; `moves.json` is generated and
  already carries `multiaccuracy` (do **not** run `npm run data:dex`).
- `src/engine/battle/turn.ts`
- `src/engine/battle/modifiers.ts`
- `src/engine/battle/moveAudit.ts`
- `src/engine/battle/turn.test.ts`
- `docs/battle-spec.md` — **only** §3.1 and §3.4.
- `docs/balance/effect-coverage.md` and `src/data/moveCoverage.json` — **only if**
  `npm run docs:coverage` rewrites them; otherwise leave both untouched.

### Inputs (read-only)

- `src/engine/battle/turn.ts` before editing: `useMove` 858, the aim-level accuracy roll
  1096-1100, `hits` 1160-1168, the hit loop 1170-1292, `multihitHits` 277-281, `beatUpHits`
  283-289, the Spit Up settle 1293, `applyMoveEffects` 1303.
- `src/engine/battle/modifiers.ts` (`hitChance` 17, `rollHitWith` 34-43), `accuracy.ts`,
  `damage.ts` (`resolveBasePower` returns `move.basePower` for an unresolved move),
  `effects/registry.ts` (`runModifyMultihit` 450), `effects/abilities.ts` (`skillLink` 864),
  `state.ts` (`state.rng`, `state.log`), `fighter.ts`.
- `src/engine/battle/moveAudit.ts` before editing: `MoveProbe` 60-90, `snapshotState` 194-221,
  `PROBE_SEED = 2026` 108, rows `populationbomb` 850-868, `tripleaxel` 1198, `triplekick` 1200.
- `src/engine/battle/moveAudit.test.ts` (`probeRow` 166-178 compares only the keys `expected`
  names), `src/data/dex/index.ts`, `docs/battle-spec.md` §3.

## 🔒 Contract

```ts
// src/data/dex/moves.ts — Move gains one optional field, nothing else moves
  /** Set by the dex on the moves that roll accuracy on every hit (`multiaccuracy`). */
  multiaccuracy?: boolean;
```

```ts
// src/engine/battle/modifiers.ts
export function multiHitPower(move: Move, hit: number): number;
// `move.basePower * (hit + 1)` for `triplekick` and `tripleaxel` (0-based `hit`), else
// `move.basePower` unchanged. Pure, total for any `hit >= 0`, reads no RNG.
```

```ts
// src/engine/battle/moveAudit.ts — MoveProbe gains one field, filled by snapshotState
  /** The `amount` of every `damage` event in `state.log`, in order. */
  damageAmounts: readonly number[];
```

- **The per-hit rule (in `turn.ts`'s hit loop, immediately after the `hitTarget.hp <= 0` break):**
  `if (hit > 0 && hitMove.multiaccuracy === true && !sure && !rollHitWith(state, side, hitMove,
  attacker, hitTarget)) { pushText(state, 'battle.log.missed', { name: attacker.name }); break; }`.
  `sure` is the aim's own flag (Lock-On/Mind Reader and Telekinesis), so a guaranteed move still
  guarantees every hit; the first hit keeps the roll it already made at the aim level and is
  **not** rolled twice.
- **The ramp:** inside the same loop compute `const power = multiHitPower(hitMove, hit)` and use
  `const perHitMove = power === hitMove.basePower ? hitMove : { ...hitMove, basePower: power }`
  for every read of the move inside the loop body (crit ratio, `computeDamage`, `runModifyDamage`,
  `runModifyEffectiveness`, `runTrySubstitute`, `damageMessage`, the Endure/Substitute path). When
  the power does not change, no object is allocated.
- **Events:** one `damage` per landed hit (unchanged shape), one `battle.log.missed` on the stop,
  and nothing else — the move still falls through to `applyMoveEffects` exactly as the existing
  `result.damage === 0` break does.
- **Determinism:** the battle's single seeded `Rng` (`state.rng`); one extra `next()` per hit
  after the first, and only while `hitChance(...) < 1` (No Guard, Lock-On or Telekinesis draw
  nothing, exactly as at the aim level). No new stream, no new seed derivation.
- **Unchanged:** `multihitHits`, `runModifyMultihit`, `skillLink` (it forces the **count** — the
  max of `multihit` — and never the rolls), `rollHitWith`/`hitChance`, `beatUpHits`,
  `resolveBasePower`, `estimateDamage`/`movePreview` (they draw nothing and keep showing the
  first hit's power).

## 🧩 Data and configuration

No table, no balancing value, no new key. The facts this task relies on already ship in
`src/data/dex/moves.json`: `populationbomb` `accuracy 90`, `multihit [10,10]`, `multiaccuracy
true`; `tripleaxel` `accuracy 90`, `basePower 20`, `multihit [3,3]`, `multiaccuracy true`;
`triplekick` `accuracy 90`, `basePower 10`, `multihit [3,3]`, `multiaccuracy true`. The ledger
note of all three stays `data: multihit` in `src/data/moveCoverage.json`.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-160` audited against the exclusive paths list.
  - **No browser pass is owed:** every criterion below is `[unit]` and headless. The three moves
    are reachable only through the engine, and the scene never branches on them.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean (`npm run build`).
  - [ ] `[unit]` A test pins the data facts it depends on: `getMove('populationbomb')`,
    `getMove('tripleaxel')` and `getMove('triplekick')` each have `multiaccuracy === true`, and
    their `multihit` reads `[10, 10]`, `[3, 3]`, `[3, 3]`.
  - [ ] `[unit]` `multiHitPower` is unit-tested directly from `turn.test.ts`: triple kick at hits
    0/1/2 gives `10/20/30`, triple axel gives `20/40/60`, and Population Bomb and a plain
    multi-hit (`pinmissile`) give their dex power on every hit index.
  - [ ] `[unit]` A fixed seed where all three Triple Kick hits land reports **three** `damage`
    events whose amounts are **strictly increasing**, and whose sum equals the enemy's lost HP.
  - [ ] `[unit]` A fixed seed whose second per-hit roll misses ends Triple Kick at **one** `damage`
    event plus exactly one `battle.log.missed` text entry in `state.log` — no third hit, no second
    miss line. (The board may lower the hit chance — an accuracy stage, evasion or `state.fog` — as
    long as the seed is fixed and the miss is deterministic.)
  - [ ] `[unit]` Population Bomb pins both ends on fixed seeds: one run with all ten rolls landing
    reports 10 `damage` events (and the faint), one that stops at hit 4 reports exactly 4 `damage`
    events plus one `battle.log.missed`.
  - [ ] `[unit]` Skill Link keeps the full count and does **not** buy the rolls: on the seed whose
    Population Bomb stops at hit 4, the same move from a Skill Link user also stops at 4, while
    `runModifyMultihit` for it still answers 10 (the existing abilities test stays green).
  - [ ] `[unit]` The three `MOVE_AUDIT_ROWS` rows are re-pinned under `PROBE_SEED = 2026`: each
    names `events` **and** the new `damageAmounts`; the two Triple rows' amounts strictly increase
    (a flat three-hit sequence fails the row), and the Population Bomb row's amount count matches
    its `damage`-event count.
  - [ ] `[unit]` The **only** re-pinned seeds are those three audit rows: the three move ids appear
    in no other `*.test.ts` (`grep -rn "populationbomb\|tripleaxel\|triplekick" src --include=*.test.ts`
    is empty), `golden.test.ts` (seed 2026, ember/vinewhip) and `randomLearnsetBattle.test.ts`
    (asserts no-throw and a non-empty log only) do not move, and any other pin that moves is named
    and justified in the spec note as a per-hit draw.
  - [ ] `[unit]` `docs/battle-spec.md` §3.1 lists the Triple pair's ramp and §3.4 records the
    per-hit accuracy draws and the miss stop; no other section changed.
  - [ ] `[unit]` `npm run docs:coverage` leaves `docs/balance/effect-coverage.md` and
    `src/data/moveCoverage.json` byte-identical, or the two files carry exactly that regeneration.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.

## 📣 Coordination

- **One ambiguity resolved here, for the Orchestrator:** the backlog says "rolls `rollHitWith`
  before each hit"; this spec reads it as *every hit after the first*, because the aim-level roll
  at `turn.ts` 1097 already covers hit 0 (the reference rolls the move's first hit there). Rolling
  hit 0 twice would make Population Bomb 81 % instead of 90 % and spend a draw for nothing.
- For the Architect: this task is the **single owner** of `src/data/dex/moves.ts` for the batch
  (the `Move` type gains one optional field; `moves.json`, `meta.json` and the dex counts do not
  move). No other task may claim `turn.ts`, `modifiers.ts`, `moveAudit.ts` or §3 of the battle spec
  in the same batch.
- For the next batch: a battle that uses any of these three moves now spends one extra `Rng` draw
  per hit after the first, so any later fixed-seed pin that includes one of them shifts. The audit
  can now see per-hit damage (`MoveProbe.damageAmounts`); a "a handler exists but the rule never
  repeats" class of bug should use it as `Task-159` used `residual`. Loaded Dice is still `no-op`
  and any task that ports it extends `multihitHits`, not this loop.
- The reference's "multiaccuracy ignores accuracy/evasion stages" clause is **not** modelled: the
  per-hit roll is the same `rollHitWith` call the first hit makes. Say so in §3.4 rather than
  inventing it.

## ⛔ Out of scope

- Loaded Dice (the item is still `no-op`) and any change to how many hits a move rolls.
- Skill Link, `runModifyMultihit`, `multihitHits`, `beatUpHits`, Parental Bond or any hit-count
  rule.
- The FIGHT menu preview and `estimateDamage` (they show the first hit's power and draw nothing).
- Spread targets and double battles: the per-hit rule is per aim, and the existing aim loop already
  handles one roll per target.
- Regenerating the dex, the coverage table (beyond the conditional path above), i18n, art or any
  scene. No `src/scenes/**` file may be touched by this task.
