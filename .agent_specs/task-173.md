# Spec: Task-173 — Rage Fist's power climbs with the hits its user has taken

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule (pure battle logic) + data/ledger regeneration + one doc line.
- **Role:** Dev.
- **Objective:** Rage Fist (`ragefist`, *Puño Furia*) stops dealing its flat dex
  `basePower` 50. Its user remembers, for as long as it stays in battle, how many
  **hits** it has taken (capped at six), and the move's power becomes
  `50 + 50 × hits` (capped at 350). The **one** function the damage formula and the
  FIGHT menu's preview both read (`resolveBasePower`) computes that number, so the
  menu can never print a power the hit will not use. The move audit gains a row and
  the arithmetic, and the generated coverage pair is regenerated.
- **Environment:** work only in your own worktree
  `/home/runner/work/pkm-randomlike/wt-pkm-173`, branch `task-173`, spec at
  `.agent_specs/task-173.md` inside it. Never work in
  `/home/runner/work/pkm-randomlike/pkm-randomlike` (that checkout is `main`) and
  never push to `main`.
- **Dependencies:** none. `[Task-120]`/`[Task-121]`'s audit (`MOVE_AUDIT_ROWS`,
  `probeMove`) and `[Task-167]`'s `MoveAuditRow.scenario` are already on `main`.

### Exclusive paths (single writer)

Nothing outside this list. No new file is created, so no folder `README.md`
changes.

- `src/engine/battle/fighter.ts`
- `src/engine/battle/turn.ts`
- `src/engine/battle/damage.ts`
- `src/engine/battle/preview.ts`
- `src/engine/battle/moveAudit.ts`
- `src/engine/battle/damage.test.ts`
- `src/engine/battle/preview.test.ts`
- `src/engine/battle/moveAudit.test.ts`
- `src/engine/battle/turn.test.ts` (only if it exists; add the fixed-seed turn test
  to the shipped file that already builds a full turn — do **not** create a second
  turn test file)
- `docs/balance/effect-coverage.md` (**generated**, never hand-edited)
- `src/data/moveCoverage.json` (**generated**, never hand-edited)
- `docs/battle-spec.md` §3.1 and its §3.3 sentence list

### Inputs (read-only)

- `docs/battle-spec.md` §3.1/§3.3 (the rule you document).
- `docs/balance/effect-coverage.md` and `src/data/moveCoverage.json` (the pair you
  regenerate; read to see the shape, never edit by hand).
- `src/data/dex/moves.json` entry for `ragefist` (its dex `basePower` is 50).
- `src/engine/battle/harness.ts` (`scriptedBattle`) and
  `src/engine/battle/moveAudit.ts` (the probe board) for the fixed-seed tests.

## 🔒 Contract

### `src/engine/battle/fighter.ts`

```ts
export type Volatiles = {
  // ... the shipped fields ...
  /**
   * The hits this fighter has taken since it last switched in, capped at six.
   * Rage Fist's power reads it. Battle-long inside one stay on the field: it is
   * NOT cleared at the start of a turn and IS cleared when the fighter switches
   * out (`clearVolatiles` builds a fresh object) like every other volatile.
   */
  timesHit: number;
};
```

- `emptyVolatiles()` initialises `timesHit: 0`. Every full `Volatiles` object
  literal in tests gets `timesHit: 0` too (`tsc --noEmit` will name them).
- Do **not** reset it in `takeTurn`'s per-turn loop (`turn.ts` ~1899, where
  `physicalDamageTaken`/`specialDamageTaken` are cleared): those two are
  "since the turn started" for Counter/Mirror Coat; `timesHit` is not.
- `resetBattleState`/`clearVolatiles` need no extra line: `clearVolatiles`
  replaces the object, and a switch already calls it.

### `src/engine/battle/turn.ts`

In the hit loop, beside the shipped
`if (perHitMove.category === 'Physical') hitTarget.volatiles.physicalDamageTaken += dealt;`
(`turn.ts` ~1328):

```ts
// One per *hit*, not per move: a 10-hit move is ten hits taken, and the cap is
// the reference's six. Rage Fist reads it (docs/battle-spec.md §3.3).
hitTarget.volatiles.timesHit = Math.min(6, hitTarget.volatiles.timesHit + 1);
```

- It counts **hits the fighter took**, whatever the category (a special hit counts
  too — the report is about being hit, and the reference counts any hit).
- A hit absorbed by a **Substitute** returns before `applyDamage`, so it does not
  count (that is a hit the substitute took, not the fighter).
- A hit that deals 0 damage (`result.damage === 0` breaks earlier) does not count.
- Nothing else in the loop changes; no draw is added, so every fixed seed keeps
  its stream.

### `src/engine/battle/damage.ts`

1. `DAMAGE_RESOLVERS` gains `ragefist: 'power',` (alphabetical position, after
   `present`). This is what makes the ledger regenerate as `damage: damage.ts`
   instead of `data: basePower`, and what keeps `isDamagingMove` true.
2. `resolveBasePower` gains one case:

```ts
case 'ragefist':
  return Math.min(350, 50 + 50 * attacker.volatiles.timesHit);
```

Place it in the switch with the other conditional powers. No extra `DamageContext`
field is needed: the count lives on the attacker, which every caller already has.

### `src/engine/battle/preview.ts`

No behaviour change is expected — `movePreview` already calls
`resolveBasePower(fighter, target, activeMove, context)` (~82), which is the whole
point. Keep `MovePreview.basePower` as the **dex** number (50) and let `power`
carry the effective one (150 at two hits); the grid prints `power`
(`src/ui/moveGrid.ts` 414) and paints its stat arrow from
`power > basePower`, exactly as it already does for Hex, Facade and the rest.
Touch this file only if `tsc` needs it.

### Generated data

Run `npm run docs:coverage` after the code change and commit **both**
`docs/balance/effect-coverage.md` and `src/data/moveCoverage.json`. The only
expected diff is Rage Fist's note moving from `data: basePower` to
`damage: damage.ts` (and the table's own counts if the generator prints them).
Never edit either file by hand, and never hand-edit `src/data/dex/**`.

## 🧩 Data and configuration

No new data key: the 50, the step of 50 and the cap of 350 are the reference's
numbers and live in `resolveBasePower` with their rationale (they are the move's
own rule, not a balancing knob).

`src/engine/battle/moveAudit.ts` gains one setup knob and one row:

```ts
export interface MoveAuditSetup {
  // ... the shipped fields ...
  /** The hits the player has already taken before the move runs, 0..6. Default 0. */
  playerTimesHit?: number;
}
```

- `probeBoard` seeds `player.volatiles.timesHit = clamp(setup.playerTimesHit ?? 0, 0, 6)`
  **before** the move runs.
- The row (sorted by `moveId` with the rest of the table):

```ts
{
  moveId: 'ragefist',
  setup: { enemySpecies: 'mew', playerTimesHit: 2 },
  expected: { events: ['move', 'damage'], damageAmounts: [/* pinned below */] },
  scenario: {
    setup: { playerTimesHit: 6 },
    expected: { events: ['move', 'damage'], damageAmounts: [/* pinned below */] },
  },
}
```

- The two amounts are **pinned from `PROBE_SEED`** by running the probe once the
  rule exists; the row documents the reference's arithmetic in its own comment
  (`2 hits → 150 power`, `6 hits → 350`). They must differ and the six-hit amount
  must be the larger one. Do not copy a number you did not measure.
- The audit test additionally asserts the arithmetic itself (below), so the pinned
  damage is never the only evidence.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task
    adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `npm run docs:coverage` then `git status --short` must show no further change
    (the pair is committed and reproducible).
  - `git diff --name-only main...task-173` audit against the exclusive paths list.
  - `git diff --stat` must show `src/data/dex/**` untouched.
  - Every criterion here is `[unit]`: this task has **no** browser pass, because
    nothing it changes exists only on screen (the menu's `pwr` row is fed by
    `movePreview`, whose `power` the preview test pins headlessly). Say so in the
    report instead of running a browser.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `damage.test.ts`: with a fresh fighter,
    `resolveBasePower(user, foe, move('ragefist'))` reads **50**; after setting
    `user.volatiles.timesHit` to 1 / 2 / 3 / 6 / 9 and calling again it reads
    **100 / 150 / 200 / 350 / 350**. The same test asserts
    `DAMAGE_RESOLVERS.ragefist === 'power'`.
  - [ ] `[unit]` `preview.test.ts`: in one fixed battle state, after the active
    player fighter has taken two hits (`volatiles.timesHit = 2`),
    `movePreview(state, 'player', <ragefist slot>)` answers `power === 150` and
    `basePower === 50`; at 0 hits it answers `power === 50`; the preview draws
    nothing from the RNG (same as the shipped preview tests).
  - [ ] `[unit]` A fixed-seed turn (`scriptedBattle` or the shipped turn test):
    the user is hit twice, then uses Rage Fist, and the resolved power read from
    the live state's fighter is **150** while the turn's log carries exactly one
    `damage` event for that move. The same seed re-run produces the identical
    log.
  - [ ] `[unit]` `turn.ts` counts hits: on a board where the foe uses a 3-hit move
    against the player, the player's `volatiles.timesHit` is 3 afterwards; a
    single hit raises it by 1; six hits cap it at 6.
  - [ ] `[unit]` `moveAudit.test.ts`: the `ragefist` row passes with its two
    scenarios, and the test asserts `resolveBasePower` reads 150 at two hits and
    350 at six on the probe board (the row's arithmetic, not only its pinned
    damage).
  - [ ] `[unit]` `docs/balance/effect-coverage.md` and `src/data/moveCoverage.json`
    are the generator's output: `npm run docs:coverage` leaves `git status` clean,
    and the `ragefist` entry's note is `damage: damage.ts`.
  - [ ] `[unit]` `docs/battle-spec.md` §3.3 lists Rage Fist among the conditional
    powers with the exact numbers (50, +50 per hit, six-hit cap, 350 max) and the
    statement that the user's own hits taken are counted per **hit**, cleared on
    switch-out; §3.1 still points at §3.3 as it does today.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.

## 📣 Coordination

- For the next batch: `volatiles.timesHit` is the **shared** hit counter a later
  move rule should read (Rage Fist is its first user). It is battle-long inside a
  stay on the field and resets only through `clearVolatiles`.
- For the audit: `MoveAuditSetup.playerTimesHit` is the first knob that seeds a
  volatile count; a later row that needs the same can reuse it instead of adding a
  second field.
- `MovePreview.basePower` stays the dex number on purpose; only `power` folds the
  rule in.

## ⛔ Out of scope

- Any other move, any AI change, any UI change (`src/ui/`, `src/scenes/`).
- Rage Fist's **Max Move** or its interaction with abilities — nothing to port.
- Rewriting the audit table's other rows.
- `src/data/dex/**`, `package.json`, any `src/data/` file other than the generated
  `moveCoverage.json`.
- A new `turn.test.ts` if one already exists; extend the shipped one.
