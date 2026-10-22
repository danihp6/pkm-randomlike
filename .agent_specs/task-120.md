# Spec: Task-120 — the status half of the move audit

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule (pure TypeScript, `src/engine/battle/**`) plus the generated
  effect-coverage pair.
- **Role:** Dev.
- **Objective:** after this task, the **status half** of the moves that the shipped
  coverage ledger lists as `no-op` are implemented against the machinery that already
  ships: a move that writes a status, a stat stage, a volatile, a screen, a field, a
  heal, a protection, a type, an ability, a held item, a PP count, a lock or a copy now
  actually writes it, so `Attract`, `Disable`, `Torment`, `Soak`, `Skill Swap`, `Trick`,
  `Spite`, `Instruct` and their siblings stop printing `X used Attract!` and changing
  nothing. The instrument `[Task-119]` shipped (`src/engine/battle/moveAudit.ts`) loses
  every `knownGap` that belongs to this half, and the generated ledger
  (`docs/balance/effect-coverage.md` + `src/data/moveCoverage.json`) records each fixed
  move as `port` with the handler that implements it — or, for a row a single battle
  cannot honour, as `excluded` with the reason.
- **Environment:** worktree `../wt-pkm-120`, branch `task-120`. Run
  `npm ci --prefer-offline --no-audit --no-fund` once before anything else (a fresh
  worktree has no `node_modules`).
- **Dependencies (already merged on `main`, read them, do not re-create them):**
  - **Task-119** — `src/engine/battle/moveAudit.ts` + `moveAudit.test.ts` (the audit rows
    and `knownGap`), `scripts/effect-coverage.mjs` (the ledger's classifier and its
    `excluded` policy lists), and the generated pair
    `docs/balance/effect-coverage.md` + `src/data/moveCoverage.json`.
  - **Task-101** — the shape of `turn.ts` / `state.ts` / `fighter.ts` this task extends.
  - Shipped earlier and used, never rebuilt: `src/engine/battle/effects/registry.ts`
    (the hook surface), `src/engine/battle/harness.ts` (the scripted battle),
    `src/engine/battle/golden.test.ts` (the byte-identical golden log).

### Exclusive paths (single writer)

Nothing outside this list. (Each path is also nobody else's in this batch.)

- `src/engine/battle/effects/moves.ts`
- `src/engine/battle/effects/moves.test.ts`
- `src/engine/battle/turn.ts`
- `src/engine/battle/turn.test.ts`
- `src/engine/battle/volatile.ts`
- `src/engine/battle/volatile.test.ts`
- `src/engine/battle/fighter.ts`
- `src/engine/battle/fighter.test.ts` *(only if it already exists; do not create it otherwise)*
- `src/engine/battle/state.ts`
- `src/engine/battle/state.test.ts` *(only if it already exists)*
- `src/engine/battle/moveAudit.ts`
- `src/engine/battle/moveAudit.test.ts`
- `scripts/effect-coverage.mjs`
- `docs/balance/effect-coverage.md` *(generated)*
- `src/data/moveCoverage.json` *(generated)*
- `docs/battle-spec.md` **§4 only**
- `src/engine/README.md` *(only if this task adds or renames a file; it must not)*

**Forbidden, even though they look related:** `src/engine/battle/commands.ts`,
`src/engine/battle/damage.ts`, `src/engine/battle/preview.ts`,
`src/engine/battle/effects/abilities.ts`, `src/engine/battle/effects/items.ts`,
`src/engine/battle/ai.ts`, `src/ui/**`, `src/scenes/**`, `src/i18n/**` and the log's
wording (all of them are another task's). The engine keeps **no** locale: every
`pushText` line this task adds is plain English, exactly like its neighbours.

### Inputs (read-only)

- `docs/battle-spec.md` (§4 in particular), `docs/showdown-reuse.md`,
  `docs/tech-decisions.md` (`D4`, `D11`, `D16`), `docs/balance/effect-coverage.md`
  (the ledger's legend and its `Moves` table).
- `src/engine/battle/effects/registry.ts` (the hooks), `src/engine/battle/state.ts`
  (`BattleState`, `pushText`, `pushEvent`), `src/engine/battle/fighter.ts`
  (`BattleFighter`, `Volatiles`, `BoostId`), `src/engine/battle/damage.ts`
  (**read** how `computeDamage` consumes a move — you change no line of it),
  `src/engine/battle/status.ts`, `src/engine/battle/volatile.ts`,
  `src/engine/battle/effects/moves.ts` (`MOVE_EFFECTS`),
  `src/engine/battle/effects/apply.ts`, `src/data/dex/**` (the move data:
  `getMove(id)`), `src/data/moveCoverage.ts`.
- The Showdown reference this repo ports from (`D4`/`D16`): the `data`/`scripts` entry of
  the same move id, on the hook names `registry.ts` already declares.

## 🔒 Contract

This task adds **no new public module**. It extends three seams that already exist, and
every extension is observable from the existing exports:

### TypeScript

```ts
// src/engine/battle/effects/moves.ts — the table the registry iterates.
export const MOVE_EFFECTS: Readonly<Record<string, EffectHandlers>>;

// src/engine/battle/turn.ts — the volatile switch this task widens.
function applyVolatileEffect(
  state: BattleState,
  side: SideId,
  target: BattleFighter,
  volatile: string,
): boolean; // true when the volatile was written, false when it is unknown to the engine

// src/engine/battle/turn.ts — the data-driven seam this task widens when a field can
// carry the effect instead of a handler.
function applyMoveEffects(
  state: BattleState,
  side: SideId,
  move: Move,
  totalDamage: number,
  defenderDamaged: boolean,
  aimedAt?: BattleFighter,
): void;
```

- **A handler per move** goes in `MOVE_EFFECTS` (`moves.ts`) and mutates state through
  `EffectContext` (`state`, `side`, `source`, `target`, `move`, `rng`, `owner`). The
  hooks are the ones `registry.ts` declares (`onStart`, `onResidual`, `onTryHit`,
  `onTryVolatile`, `onAfterMove`, `onModifyMove`, `onModifyDamage`, …). Do not invent a
  new hook; if a fact cannot be expressed, the row is `excluded` (see below), never a
  silent no-op.
- **A field the engine already reads** (`fighter.ts`'s `volatiles.*`, `boosts`,
  `status`, `types`, `ability`, the two item ids, the four PP slots, `lastMoveId`, the
  side conditions and field conditions) is written by the move rather than by a new
  handler where the reference is a plain data write — that is what
  `applyMoveEffects`/`applyVolatileEffect` are for.
- **Determinism:** every draw this task adds comes from the battle's one `Rng`
  (`EffectContext.rng`). Name each draw in the spec of the handler (the reference's own
  order): `Attract`'s turn coin flip already ships in `beforeMoveVolatile`; `Disable`
  picks among the target's moves with the reference's own rule (`rng.int` over the
  eligible slots) — this is the only new draw of the family that is not a copy of an
  existing one. A move that adds no draw says so in its test.
- **No Phaser, no DOM, no `Math.random()`, no `Date.now()`.** `src/engine/` purity is a
  gate.
- **The golden log does not move.** `golden.test.ts` must stay byte-identical: it
  contains none of this family's moves, and a diff there means a shared code path was
  rewritten rather than extended.

### Data

- The ledger's own rows only: `docs/balance/effect-coverage.md` and
  `src/data/moveCoverage.json` are **generated** by `npm run docs:coverage` — never
  hand-edited. The classifier lives in `scripts/effect-coverage.mjs`.
- An exclusion is a data decision, not a code comment: a move a single battle cannot
  honour goes into the script's existing lists (`EXCLUDED_MOVES`, the doubles/ally-only
  list, the cut-mechanic list) with its **reason string**, exactly as `followme` and
  `wideguard` already are.

## 🧩 Data and configuration

- No new balance number and no new table: every rule comes from the move's own dex
  entry and the Showdown handler (`D4`).
- The one entry the ledger's legend needs is a **corrected sentence**, not a row: the
  legend's "weight is not modelled" line stays true for the weight-based damage moves
  (`[Task-121]`'s half) and must not be weakened by this task.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including every test this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-120` audited against the exclusive paths above.
  - `npx vitest run src/engine/battle/moveAudit.test.ts`
  - `npx vitest run src/engine/battle/effects/moves.test.ts`
  - `npx vitest run src/engine/battle/golden.test.ts`
  - `npm run docs:coverage` twice; the second run must leave `git diff --stat` empty
    (the generator is idempotent and this task's rows are committed).
  - The family's own headless battles (below) are added by the dev in
    `effects/moves.test.ts` and `turn.test.ts`, driven by the shipped
    `src/engine/battle/harness.ts`, seed **2026**.

- **Acceptance criteria:**

  - [ ] `[unit]` It typechecks and builds clean: `npm run build` exits 0.
  - [ ] `[unit]` `npm test` is green and the suite's test count is **greater than
        `main`'s** (the new family tests exist and run).
  - [ ] `[unit]` **The instrument closes the status half.** In
        `src/engine/battle/moveAudit.ts`, `grep -c 'knownGap: true'` is **exactly 1**
        (the relative-damage half's remaining row, `finalgambit`, which belongs to
        `[Task-121]`), and `npx vitest run src/engine/battle/moveAudit.test.ts` is green.
        The 19 rows this task closes are, by id: `aromaticmist`, `captivate`, `charge`,
        `clangoroussoul`, `coaching`, `darkvoid`, `dragoncheer`, `dreameater`,
        `electroshot`, `filletaway`, `howl`, `hyperspacefury`, `meteorbeam`, `noretreat`,
        `partingshot`, `shedtail`, `skullbash`, `snore`, `toxicthread`. A row whose
        Showdown handler needs a mechanic a single battle lacks is **removed** from the
        table and named in the script's exclusions instead — it must not stay a gap.
  - [ ] `[unit]` **The ledger is honest.** `npm run docs:coverage` then
        `git status --porcelain` is empty, and the moves section's `no-op` count is
        smaller than `main`'s **76** by exactly the number of moves this task fixed —
        the script prints the tally; record both numbers in the commit body. No move row
        this task touched still reads `reachable, not ported yet`.
  - [ ] `[unit]` **Every fixed family row has a test that would fail on `main`.**
        `effects/moves.test.ts` (or `turn.test.ts`) pins, per family, the state the
        reference writes — at minimum one row for each of: infatuation (`Attract` writes
        `volatiles.attract`; the draw is `beforeMoveVolatile`'s), move-locking
        (`Disable` writes `disabledMove` + `disableTurns` and **`legalMoveIndices`
        excludes it**; `Torment` records the repeat bar; `Encore`'s shape; `Imprison`
        writes `volatiles.imprison`), residual volatiles (`Nightmare`, `Curse`'s
        non-Ghost branch, `Octolock`, `Aqua Ring`), trapping and grounding (`Spider Web`
        traps; `Telekinesis` grounds, and `Smack Down` writes grounded on its own
        damage row), accuracy locks (`Lock-On`, `Mind Reader`), type and identity writes
        (`Soak` sets both types to water; `Reflect Type` copies the target's types onto
        the user; `Magic Powder` sets the target's type to psychic;
        `Forest's Curse`/`Trick-or-Treat` add a type; `Camouflage`'s shape),
        ability writes (`Simple Beam`, `Worry Seed`, `Gastro Acid`, `Entrainment`,
        `Skill Swap` swaps both sides, `Role Play`'s shape), stat and speed exchanges
        (`Heart Swap`, `Power Swap`, `Guard Swap`, `Speed Swap`, `Power Split`,
        `Guard Split`, `Psych Up`'s shape), heals aimed at the foe (`Heal Pulse`,
        `Floral Healing`, `Purify`, `Strength Sap`), status transfer (`Psycho Shift`),
        turn and priority control (`Instruct`, `Quash`, `Electrify`), items (`Trick`,
        `Switcheroo`, `Embargo`, `Recycle`'s shape), move copies (`Mimic`), PP (`Spite`).
        Each test names the field it reads and the value it expects.
  - [ ] `[unit]` **The golden battle did not move:**
        `npx vitest run src/engine/battle/golden.test.ts` is green with the file's own
        snapshot untouched (`git diff --stat src/engine/battle/golden.test.ts` empty).
  - [ ] `[unit]` **Nothing outside the exclusive paths was touched:**
        `git diff --name-only main...task-120` lists no `src/ui/**`, no `src/scenes/**`,
        no `src/i18n/**`, no `commands.ts`, `damage.ts`, `preview.ts`, `ai.ts`,
        `effects/abilities.ts` or `effects/items.ts`.
  - [ ] `[live]` **A type write is visible in the running battle.** What to read: the
        foe's **type band** under its name in the battle's HP panel (the row
        `[Task-53]`/`[Task-72]` ship), on the live game. How: start the dev server
        (`npm run dev -- --port <free> --strictPort`), load the game, and use the dev
        overlay (`src/dev/debugMenu.ts`) to (a) set the lead's four moves to
        `Soak`, `Tackle`, `Growl`, `Tail Whip` through the party editor
        (`onEditPartyMember`), then (b) start a wild battle against a species that is
        **not** Water (`onWildBattle('pidgey', 5)`). Read the foe's type-band rect with
        `renderer.snapshotArea` + `getImageData` before the move and on the frame after
        `Soak` resolves, over CDP, at the default 1280×800 layout. **PASS when** the
        band's mean colour changed toward the Water badge's fill: the blue channel's
        mean rose by **≥ 20** and the red channel's fell by **≥ 20** between the two
        reads, *and* the foe's type-band rect was the only measured rect that moved
        (the party's own band and the HUD's money row differ by 0 pixels between the
        two reads). If `Soak`'s `[unit]` row is green but the battle cannot be reached in
        the running game for an environmental reason, report the criterion **not run**
        with that reason — never as a pass.

## 📣 Coordination

- For the Architect: this task consumes the audit table and leaves **one** `knownGap`
  (`finalgambit`) for `[Task-121]`; if the split moves, `[Task-121]`'s spec must move
  with it.
- For the next batch: `[Task-114]` (the action log) is the **only** task that may write
  `commands.ts`, `src/ui/feed.ts` and `src/i18n/{en,es}.ts`. The `pushText` lines this
  task adds are new English literals it will have to key — count them and write the
  count in the commit body (`N new pushText call sites`), because 114's record says
  "194 call sites in twelve files" and that number is re-read at its cut time.
- For QA: the batch's other member (`[Task-117]`) never touches `src/engine/**`, so the
  integration tree's engine diff is this task's alone.

## ⛔ Out of scope

- The **relative-damage** half (`[Task-121]`): the fixed/level/half-HP/OHKO/HP-difference
  families, the counter family, the power-relative verse, `resolveBasePower`,
  `fixedDamage`, `damage.ts`, `preview.ts` and the `basePower > 0` gate in `turn.ts`
  (947). Do not touch `damage.ts` or `preview.ts` at all.
- `Sketch` and every doubles-only redirect (`Spotlight`, `Follow Me`, `Rage Powder`,
  `Ally Switch`, `Helping Hand`, …) stay `excluded`; entry hazards
  (`Spikes`, `Toxic Spikes`, `Stealth Rock`, `Sticky Web`, `Court Change`) stay
  `excluded`.
- Any rebalance of a move's numbers, any dex regeneration (`npm run data:dex`), the 311
  abilities, the 290 items, the UI, the scenes and the log's wording.
- `src/engine/battle/randomLearnset.ts` — its `FIXED_DAMAGE_IDS` and `move.ohko` skips
  stay exactly as they are.
