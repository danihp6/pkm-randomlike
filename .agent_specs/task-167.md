# Spec: Task-167 — Upper Hand fails unless the target is using a priority move

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule + data (move table) + generated coverage.
- **Role:** Dev.
- **Objective:** *Palma Rauda* (dex id `upperhand`) must **fail** unless the target's
  chosen command this turn is a damaging move whose effective priority is greater than
  zero. Today it is a data-only move: the ledger row is `port` on `secondaries`
  (`src/data/moveCoverage.json`), `MOVE_AUDIT_ROWS` pins only `move` + `damage` + the two
  flinch volatiles, and nothing reads the target's command, so the punch always lands.
  The engine already holds both halves: the turn's commands are in hand at
  `takeDoubleTurn` (validated right after) and a move's effective priority is
  `runModifyPriority(ctx, move, move.priority)`. After this task a conditional-fail
  table answers from the target's command, a failed read logs `battle.log.fail`, spends
  the PP and deals nothing, while the flinch stays the move's `secondaries` on a
  success.
- **Environment:** worktree `../wt-pkm-167`, branch `task-167`, base `origin/main`
  @ `e241f9f`.
- **Dependencies:** none — the command map and the priority hook ship.

### Exclusive paths (single writer)

**Nothing outside this list.** `src/scenes/BattleScene.ts` and
`src/engine/battle/commands.ts` are claimed by **Task-163 in this same batch**: read
them if you must, never edit them.

- `src/engine/battle/turn.ts`
- `src/engine/battle/effects/registry.ts`
- `src/engine/battle/effects/moves.ts`
- `src/engine/battle/effects/moves.test.ts`
- `src/engine/battle/moveAudit.ts`
- `src/engine/battle/moveAudit.test.ts`
- `src/data/moveCoverage.json` — **generated only**, by `npm run docs:coverage`
- `docs/balance/effect-coverage.md` — **generated only**, by the same script
- `docs/battle-spec.md` — **§3.3 only**. Task-163 owns §4 of the same file in this
  batch; do not touch §4 and do not reformat the document.

### Inputs (read-only)

- `AGENTS.md`
- `src/engine/battle/effects/registry.ts` (the `EffectContext`, `ContextOptions`,
  `makeContext`, `runModifyPriority`)
- `src/engine/battle/turn.ts` (`takeDoubleTurn`, the `commands: Record<SideId,
  SlotCommands>` it builds, `resolveMove` and the `spitup` fail site, the damage loop)
- `src/engine/battle/moveAudit.ts` (`MOVE_AUDIT_ROWS`, `MoveAuditRow`) and
  `moveAudit.test.ts`
- `src/engine/battle/effects/moves.test.ts` (the turn-harness idiom)
- `docs/battle-spec.md` §3.3
- `scripts/effect-coverage.mjs` (the generator)

## 🔒 Contract

### TypeScript

```ts
// src/engine/battle/effects/registry.ts

export type EffectContext = Readonly<{
  state: BattleState;
  side: SideId;
  source: BattleFighter;
  target: BattleFighter | null;
  move: Move | null;
  rng: Rng;
  owner: BattleFighter;
  /**
   * The commands both sides issued this turn, when the caller has them. Optional:
   * every existing caller and test keeps the shipped shape. `commands[side][slot]`
   * is a `Command` from `src/engine/battle/commands.ts`.
   */
  commands?: Readonly<Record<SideId, Readonly<Partial<Record<Slot, Command>>>>>;
}>;

export type ContextOptions = Readonly<{
  source: BattleFighter;
  target?: BattleFighter | null;
  move?: Move | null;
  commands?: Readonly<Record<SideId, Readonly<Partial<Record<Slot, Command>>>>>;
}>;
```

`makeContext` copies `options.commands` into the context (absent stays absent).

```ts
// src/engine/battle/effects/moves.ts

/**
 * The moves that can fail outright, keyed by move id. A predicate answers `true`
 * when the move must fail this turn; turn.ts logs `battle.log.fail`, spends the PP
 * and returns before any damage or secondary.
 */
export const CONDITIONAL_FAILS: Readonly<Record<string, (ctx: EffectContext) => boolean>>;
```

- **Determinism:** the fail decision is a read of the command map, never a roll. The
  flinch on a success stays the shipped `secondaries` draw, so a fixed seed keeps the
  same turn. Reads no new RNG stream.
- **Rules:** `upperhand` fails unless
  `ctx.commands?.[opponentOf(ctx.side)]?.[0]` is a `fight` command **and** that move's
  `runModifyPriority(targetCtx, targetMove, targetMove.priority) > 0`. A missing
  command map, a `bag`/`switch`/`run` command, or priority `<= 0` all fail. No new
  dependency. `src/engine/` stays Phaser-free.

### Behaviour (exact)

1. `takeDoubleTurn` threads the `commands` record it already builds into the move
   execution path's `makeContext` calls (the ones that resolve a move and its hits),
   so a move handler can read both sides' choices. Keep the parameter optional so the
   residual/entry/switch contexts stay unchanged.
2. In `resolveMove`, **at the shipped `spitup` fail site** (`if (move.id === 'spitup'
   && …) { pushText(state, 'battle.log.fail'); return; }`), consult
   `CONDITIONAL_FAILS[move.id]` with a context carrying `commands`, and take the same
   fail branch when it answers `true` (log `battle.log.fail`, spend nothing else).
   Verify the PP is already deducted at that point; if it is not, deduct it there.
3. `upperhand`'s `secondaries` (the flinch) and its damage are untouched on a success.
4. The coverage ledger row for `upperhand` must move off `port`-only into the
   conditional-fail coverage: regenerate with `npm run docs:coverage` and commit both
   generated files. Never hand-edit `src/data/moveCoverage.json`.

## 🧩 Data and configuration

- `CONDITIONAL_FAILS` entry: `upperhand`. No numeric value, no JSON row: the rule is
  read from the dex (`upperhand`'s own `priority` is `0`; it is the **target's** move
  that must be positive).
- `docs/battle-spec.md` §3.3 gains the conditional **fail** in the move's table row.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `npm run docs:coverage` — the generated pair reproduces the committed one.
  - `git diff --name-only origin/main...task-167` audited against the exclusive paths.
  - Every criterion here is `[unit]`: this task owes **no** browser pass.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` The declared tests exist and pass.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched, and the two generated
    files are exactly what `npm run docs:coverage` emits.
  - [ ] `[unit]` `moves.test.ts`, fixed seed: the foe picks `quickattack` — the punch
    lands (the foe's HP drops) and the foe ends the turn `flinched`.
  - [ ] `[unit]` `moves.test.ts`, fixed seed: the foe picks `tackle` — the log holds a
    `battle.log.fail` text event, no `damage` event carries the foe's HP down (the foe
    is at full HP) and no `flinched` volatile is set.
  - [ ] `[unit]` `moves.test.ts`: in the fail case the user's PP for `upperhand` drops
    by one (the move was spent, not skipped).
  - [ ] `[unit]` `moveAudit.test.ts`: the audit can no longer pass a move that never
    fails — the `upperhand` row carries a second scenario (the foe on a non-priority
    move) whose expected events are `['move', 'fail']` with no damage, and
    `MOVE_AUDIT_ROWS` still holds **exactly one row per ledger move id** (the shipped
    `ROW_MOVES` equality assertion stays true).
  - [ ] `[unit]` `npm test -- moves moveAudit` passes.

## 📣 Coordination

- For the Architect: `EffectContext` gains one optional field; no existing caller
  changes shape, so the plan's "no existing test changes" holds.
- For the next batch: `CONDITIONAL_FAILS` is the seam a later conditional-fail move
  (e.g. a follow-up report) extends without touching `turn.ts` again.

## ⛔ Out of scope

- Any other move's behaviour, any other conditional-fail move, any damage-formula change.
- `moveAudit`'s row set beyond the `upperhand` scenario.
- A second `MOVE_AUDIT_ROWS` entry for the same move (it would break the ledger
  bijection).
- Any change to `BattleScene.ts`, `commands.ts`, the i18n tables or `package.json`.
