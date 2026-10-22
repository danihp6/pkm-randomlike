# Spec: Task-119 — The move audit, and a coverage ledger that counts evidence instead of a flag

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule (pure, headless) + tooling + generated data.
- **Role:** Dev.
- **Objective:** Two things that did not exist before. **One:** a headless
  instrument — `src/engine/battle/moveAudit.ts` — that runs **one** move against a
  clean level-50 board and snapshots what actually changed, plus
  `MOVE_AUDIT_ROWS`, a hand-derived reference table with **one row per move the
  ledger calls ported-but-not-plain-damage**, and a suite that runs one test per
  row so a gap is green and visible instead of invisible. **Two:** an honest
  ledger: `scripts/effect-coverage.mjs` stops calling a move `port` because of
  `flags.protect`, gains a CRLF-safe reader, and is regenerated — so
  `docs/balance/effect-coverage.md` reports the real `no-op` count and the
  develop build's `D16` warning finally fires on a move that goes off and does
  nothing. This task **changes no battle rule**: it builds the instrument
  `[Task-120]` and `[Task-121]` are judged by, and it repairs the generated table
  that hid the defect. It also repairs a **shipped defect of the table
  generator**: on this CRLF checkout five abilities read `no-op` and a bogus
  `| <name> | port |` item row exists.
- **Environment:** worktree `../wt-pkm-119`, branch `task-119`. Windows,
  `core.autocrlf=true`; `.gitattributes` pins only `*.sh` and `*.mjs` to LF, so
  the **TypeScript sources this task reads as text are CRLF in the worktree**.
  That is exactly the bug you are fixing — never "fix" it by converting files.
- **Dependencies:** none. `createBattle`, `useMove`, `createFighter`,
  `scriptedBattle`, `moveCoverage` and `npm run docs:coverage` all ship on
  `main`. This task adds no run field, bumps no `SAVE_VERSION` and draws no run
  RNG.

### Exclusive paths (single writer)

Nothing outside this list. `src/data/items.ts` is **comment-only**; no other path
may be touched, and no generated file may be hand-edited.

- `src/engine/battle/moveAudit.ts` *(new)*
- `src/engine/battle/moveAudit.test.ts` *(new)*
- `scripts/effect-coverage.mjs`
- `docs/balance/effect-coverage.md` *(generated — only `npm run docs:coverage` writes it)*
- `src/data/moveCoverage.json` *(generated — same)*
- `src/data/moveCoverage.test.ts`
- `src/data/items.ts` (**the doc comment above `TERA_CRYSTALS` only**, ~line 1141-1151)
- `src/engine/README.md` *(one line: `battle/` gains `moveAudit.ts`)*
- `docs/showdown-reuse.md` — **§3 only** ("Behaviour: what we write, in what order, and the coverage problem")
- `docs/tech-decisions.md` — **the `D16` block only** (amended, no new `D##`)

**Hot files this task holds:** the generated coverage pair
(`docs/balance/effect-coverage.md`, `src/data/moveCoverage.json`) and
`docs/balance/effect-coverage.md`'s single writer. No `src/scenes/*.ts`, no
`package.json`, no `src/data/dex/**`.

### Inputs (read-only)

- `docs/agent-spec-template.md`, `AGENTS.md`, `TODO.md` (this task's entry),
  `CHANGELOG.md` (only if a rule's history is unclear).
- `src/engine/battle/state.ts` (`createBattle`, `BattleState`, `BattleEvent`,
  `SideConditionId`, `FieldConditionId`, `WeatherId`, `TerrainId`),
  `src/engine/battle/fighter.ts` (`createFighter`, `FighterInput`,
  `BOOST_IDS`, `BoostId`, `StatusId`, `Volatiles`),
  `src/engine/battle/turn.ts` (`useMove`, `applyVolatileEffect`,
  `applyMoveEffects`, `MOVE_EFFECTS` consumers),
  `src/engine/battle/effects/conditions.ts`
  (`SIDE_CONDITION_IDS`, `FIELD_CONDITION_IDS`),
  `src/engine/battle/effects/moves.ts` (`MOVE_EFFECTS`, `PROTECT_MOVES`,
  `VARIABLE_TYPE_MOVES`, `SIDE_CONDITION_MOVES`, `FIELD_CONDITION_MOVES`),
  `src/engine/battle/effects/items.ts`, `src/engine/battle/harness.ts`
  (`scriptedBattle`, `formatBattleLog`, `HarnessFighterSpec`),
  `src/engine/battle/golden.test.ts`, `src/engine/rng.ts` (`Rng`,
  `hashSeed`), `src/engine/battle/damage.ts`, `src/engine/battle/commands.ts`.
- `src/data/moveCoverage.ts`, `src/data/moveCoverage.json`,
  `src/data/dex/moves.ts` (`Move`, `getMove`, `allMoves`),
  `src/data/dex/index.ts`.
- `scripts/effect-coverage.mjs`, `docs/balance/effect-coverage.md`.

## 🔒 Contract

### TypeScript

New module `src/engine/battle/moveAudit.ts`. Pure: **no Phaser, no DOM, no
`node:fs`, no `src/dev` import**. It is imported by its test and by nothing in
the game build; it must not be re-exported from a barrel.

```ts
import type { BattleEvent, TerrainId, WeatherId, SideConditionId, FieldConditionId } from './state';
import type { BoostId, StatusId } from './fighter';

/** The knobs a row may turn before the single move runs. Every field is optional. */
export interface MoveAuditSetup {
  /** Both sides' level. Default `50`. */
  level?: number;
  /** Default `'ditto'` on both sides. */
  playerSpecies?: string;
  enemySpecies?: string;
  /** The player's starting HP, clamped to `1..maxHp`. Default: full. */
  playerHp?: number;
  /** The enemy's starting HP, clamped to `1..maxHp`. Default: full. */
  enemyHp?: number;
  playerBoosts?: Partial<Record<BoostId, number>>;
  enemyBoosts?: Partial<Record<BoostId, number>>;
  /** Default `null`. `'slp'` and `'tox'` also set `statusCounter` to 1. */
  playerStatus?: StatusId | null;
  enemyStatus?: StatusId | null;
  /** The player's held item. Default: nothing held. */
  heldItem?: string;
  /** The enemy's held item. Default: nothing held. */
  enemyHeldItem?: string;
  /** The battle starts under it with 5 turns left. Default `null`. */
  weather?: WeatherId | null;
  /** The battle starts under it with 5 turns left. Default `null`. */
  terrain?: TerrainId | null;
}

/** One snapshot of the board after the single move has resolved. */
export interface MoveProbe {
  playerHp: number;
  enemyHp: number;
  playerStatus: StatusId | null;
  enemyStatus: StatusId | null;
  /** `BOOST_IDS` order (`atk, def, spa, spd, spe, accuracy, evasion`), always length 7. */
  playerBoosts: readonly number[];
  enemyBoosts: readonly number[];
  /** Truthy `Volatiles` keys, sorted lexicographically; `0`, `false` and `null` drop. */
  playerVolatiles: readonly string[];
  enemyVolatiles: readonly string[];
  /** `SIDE_CONDITION_IDS` order, always the full length. */
  playerSideConditions: readonly number[];
  enemySideConditions: readonly number[];
  /** `FIELD_CONDITION_IDS` order, always the full length. */
  fieldConditions: readonly number[];
  weather: WeatherId | null;
  terrain: TerrainId | null;
  playerTypes: readonly string[];
  enemyTypes: readonly string[];
  playerAbility: string;
  enemyAbility: string;
  playerItem: string | null;
  enemyItem: string | null;
  /** The player's move slots' current PP, in slot order. */
  playerPp: readonly number[];
  /** The enemy's move slots' current PP, in slot order. */
  enemyPp: readonly number[];
  /** `state.log`'s non-`text` kinds, in order. */
  events: readonly BattleEvent['kind'][];
}

/** One reference expectation. `expected` is a partial snapshot, never `{}`. */
export interface MoveAuditRow {
  moveId: string;
  expected: Partial<MoveProbe>;
  setup?: Partial<MoveAuditSetup>;
  /** The engine does not satisfy this row today. */
  knownGap?: true;
}

/** Builds the clean board, runs one move and snapshots it. Never mutates `setup`. */
export function probeMove(moveId: string, setup?: Partial<MoveAuditSetup>): MoveProbe;

/** The reference table, sorted by `moveId`, one entry per id, no duplicates. */
export const MOVE_AUDIT_ROWS: readonly MoveAuditRow[];

/** A full `BOOST_IDS` vector from the stages a row cares about. */
export function boostsVector(stages?: Partial<Record<BoostId, number>>): readonly number[];

/** A full `SIDE_CONDITION_IDS` vector from the turns a row cares about. */
export function sideConditionsVector(
  turns?: Partial<Record<SideConditionId, number>>,
): readonly number[];

/** A full `FIELD_CONDITION_IDS` vector from the turns a row cares about. */
export function fieldConditionsVector(
  turns?: Partial<Record<FieldConditionId, number>>,
): readonly number[];
```

`probeMove`'s exact behaviour — freeze it, the rows depend on it:

1. Resolve `setup` over the defaults in `MoveAuditSetup` (level 50, `ditto` both
   sides, full HP, no boosts, no status, nothing held, no weather, no terrain).
2. `createFighter({ id: 'audit-player', speciesId: playerSpecies, level, ability: 'Run Away',
   ...(heldItem ? { heldItem } : {}), moves: [moveId] })` and the enemy with
   `id: 'audit-enemy'`, `enemySpecies`, `enemyHeldItem`, `moves: ['splash']`.
   The probed move is the player's **only** slot, so `moveIndex: 0` is it; a
   `createFighter` call with an explicit `moves` array does **not** pad.
3. Apply the setup: `hp` (clamped `Math.max(1, Math.min(maxHp, Math.floor(v)))`),
   `boosts` over `emptyBoosts()`, `status` plus `statusCounter`
   (`1` for `'slp'`/`'tox'`, else `0`).
4. `createBattle({ player: [player], enemy: [enemy], rng: new Rng(2026), isWild: true,
   ...(weather ? { weather: { id: weather, turns: 5 } } : {}),
   ...(terrain ? { terrain: { id: terrain, turns: 5 } } : {}) })`.
5. `useMove(state, 'player', { type: 'fight', moveIndex: 0 })` — **once**.
6. Snapshot the two `activeFighter(state, side)` fighters per `MoveProbe`
   (`activeFighter` from `./state`), plus `state.weather`, `state.terrain`,
   `state.field` and `state.log`.

- **Determinism:** the probe reads exactly one stream, `new Rng(2026)`, created
  inside the call, and spends whatever the single `useMove` spends (accuracy,
  crit, damage, any secondary). Two calls with the same `moveId` and `setup`
  return the same snapshot; no static or module-level state, no `Date`, no
  `Math.random()`.
- **Rules:** `src/engine/` carries no Phaser import and no DOM. `moveAudit.ts`
  must not be imported by any non-test module — do not add it to a barrel.
- **Anti-tautology, and it is the heart of the task:** `expected` is the delta
  the **reference** produces (Showdown's handler for that move, per `D4`/`D16`),
  never the value `probeMove` returned. The procedure is: read the move's
  Showdown handler (or its dex `status`/`volatileStatus`/`boosts`/`heal`/`sideCondition`/
  `pseudoWeather` fields), write what the reference changes, then run the probe.
  If they agree the row has no flag; if they differ the row carries
  `knownGap: true` and the engine is **not** changed. `it.fails` makes a stale
  flag fail, so a flag cannot outlive the fix.

### Data

- `scripts/effect-coverage.mjs` keeps writing the same two artifacts with the
  same shape (`{ source, moves: [...] }`, one row per move, `port | no-op |
  excluded`). This task changes **what it reads**, never the artifact schema.
- `src/data/moveCoverage.json` is regenerated by the script. Do not hand-edit
  either generated file.

## 🧩 Data and configuration

No new balance data. The values this task introduces are the classifier's seam
list and the audit's defaults.

**The classifier after the fix** — `portedMoveNote(move)` returns, in this order,
the first seam that applies, and `null` means `no-op`:

1. `registry: effects/moves.ts` / `registry: effects/items.ts` (`registeredMoves`)
2. `turn loop: turn.ts` (`TURN_LOOP_MOVES`)
3. `data: status` → `data: volatileStatus` → `data: boosts` → `data: self.boosts`
   → `data: self.status` → `data: secondaries` → `data: heal` → `data: drain` →
   `data: recoil` → `data: struggleRecoil` → `data: multihit` → `data: selfdestruct`
   → `data: selfSwitch` → `data: weather` → `data: terrain` → `data: flags.charge`
   → `data: basePower`
4. **Removed:** `if (move.flags.protect) return 'data: flags.protect';`. A flag
   is not evidence. `move.damage`, `move.ohko`, `move.sideCondition`,
   `move.pseudoWeather` and `move.forceSwitch` are **not** seams on this
   checkout and must not be added as ones.

`MOVE_VOLATILES` stops being a hand-copied literal and is derived from
`applyVolatileEffect`'s own `case` labels, so a volatile the engine cannot apply
can never read `port`:

```js
const volatileCases = (source) => {
  const start = source.indexOf('function applyVolatileEffect');
  const end = source.indexOf('function applySecondary', start);
  if (start < 0) throw new Error('effect-coverage: applyVolatileEffect not found');
  const body = source.slice(start, end < 0 ? undefined : end);
  const ids = [...body.matchAll(/case '([a-z0-9]+)':/g)].map((match) => match[1]);
  if (ids.length === 0) throw new Error('effect-coverage: no volatile cases parsed');
  return new Set(ids);
};
const MOVE_VOLATILES = volatileCases(text('src/engine/battle/turn.ts'));
```

The set it parses on `main` is the same 24 the literal lists, so this changes no
classification today; it is the guard that stops the pair drifting tomorrow.

**The CRLF repair (a shipped defect of the generator).** On this checkout the
generator matches LF-only line ends against CRLF sources. Three consequences are
visible in the committed ledger: `Huge Power`, `Pure Power`, `Sand Veil`,
`Snow Cloak` and `Thick Fat` (the five multi-line registry rows in
`src/engine/battle/effects/abilities.ts`) read `no-op`; a bogus
`| <name> | port | in the run catalogue (src/data/items.ts) |` row exists in the
**Items** table; and `tableKeys`/`UNMODELLED_ITEMS` slice past their block
(`indexOf` returns `-1`, so `slice(start, -1)` swallows the rest of the file,
which can only **over**-classify). Fix all three:

```js
// A line-end search that works on both a LF and a CRLF checkout: `core.autocrlf`
// gives Windows the CRLF form, and an indexOf('\n};') that misses slices the rest
// of the file instead of the table.
const lineEnd = (source, marker, from = 0) => {
  const crlf = source.indexOf(`\r\n${marker}`, from);
  const lf = source.indexOf(`\n${marker}`, from);
  if (crlf < 0) return lf;
  if (lf < 0) return crlf;
  return Math.min(crlf, lf);
};
```

- `registeredIds`'s multi-line pattern becomes
  `/^  \[\r?\n    '([a-z0-9]+)',\r?$/gm` (the single-line
  `/^  \['([a-z0-9]+)',/gm` stays as it is — it has no line end to match).
- `tableKeys` uses `const end = lineEnd(source, '};', start); if (end < 0) return [];`.
- The `UNMODELLED_ITEMS` reader uses
  `const end = lineEnd(itemsEffectSrc, '];', start); if (end < 0) return new Set();`.
- The doc comment above `TERA_CRYSTALS` in `src/data/items.ts` is reworded so no
  literal `item({ id: '<id>', name: '<name>'` remains in the file — the
  catalogue regex reads the source as text and was parsing that comment as a
  real item named `<name>`. Keep the **meaning** (one literal row per type,
  because the generator reads the `item(...)` rows as text); write it without a
  literal call, e.g. "the generator reads this file's `item(...)` rows as text
  (their `id` and `name` fields), so a mapped row would be invisible".

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including this task's tests.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `npm run docs:coverage` **after the dev's commit**, then
    `git diff --exit-code` — must be clean (the table is current and the
    generator is idempotent).
  - `git diff --name-only main...task-119` audit against the exclusive paths.
  - Run the suites **sequentially**, not concurrently: three full Vitest runs at
    once time out on this machine (a known environment fact, not a defect).
  - Every criterion below is `[unit]` except the two `[live]` ones, so the
    browser budget is those two only.
- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` is clean (typecheck and bundle).
  - [ ] `[unit]` `npm test` is green.
  - [ ] `[unit]` `npx vitest run src/engine/battle/moveAudit.test.ts` is green and
        its row count equals the ledger's `port` moves whose note is **not**
        `data: basePower` (the suite prints the number; compare it with
        `node -e "const m=require('./src/data/moveCoverage.json');console.log(m.moves.filter(e=>e.status==='port'&&e.note!=='data: basePower').length)"`).
  - [ ] `[unit]` `npx vitest run src/engine/battle/golden.test.ts` passes with its
        inline snapshot **byte-identical** (this task changes no battle rule).
  - [ ] `[unit]` `npm run docs:coverage` then `git diff --exit-code` is clean.
  - [ ] `[unit]` The regenerated header reports a **non-zero** move `no-op`
        count: `node -e "const t=require('fs').readFileSync('docs/balance/effect-coverage.md','utf8');console.log(/## Moves — \d+ total \(\d+ port, (\d+) no-op/.exec(t)[1])"` prints a number `> 0`.
  - [ ] `[unit]` The five multi-line ability rows are back to `port` and the bogus
        item row is gone — asserted by the new tests in
        `src/data/moveCoverage.test.ts` (they read
        `docs/balance/effect-coverage.md`): `| Huge Power | \`port\` |`,
        `| Pure Power | \`port\` |`, `| Sand Veil | \`port\` |`,
        `| Snow Cloak | \`port\` |`, `| Thick Fat | \`port\` |` each appear, and
        the doc no longer contains `| <name> |`.
  - [ ] `[unit]` `npx vitest run src/data/moveCoverage.test.ts` is green, and the
        assertion that used to demand **zero** `no-op` moves now demands the
        manifest's own non-empty `no-op` set
        (`unportedMoveIds()` equals the `no-op` ids and `isUnportedMove` agrees
        with the status) — the old assertion is the reason this test file is in
        the path list.
  - [ ] `[unit]` No row is empty, no id is duplicated, the table is sorted, and
        `probeMove` returns for **every** classified move without throwing (one
        generated assertion per manifest entry).
  - [ ] `[unit]` The rows equal the ledger both ways: every `port` move whose note
        is not `data: basePower` has a row, and no row names a move the ledger
        calls `excluded`/`no-op`.
  - [ ] `[unit]` The `data: basePower` verse is swept with one generated
        assertion per move that the probe lands a `damage` event (the sweep's
        `BASE_POWER_SETUPS` carries the setup a conditional member needs, and
        `SWEEP_EXEMPT` names — with a one-line reason — any member whose
        reference needs a condition the probe cannot seed; every exemption key
        must be a verse id).
  - [ ] `[unit]` Each of these ids is accounted for exactly once, either as a row
        or as a `no-op` in the ledger — no third state:
        `attract, disable, torment, spite, trick, switcheroo, skillswap,
        heartswap, powerswap, guardswap, powersplit, guardsplit, speedswap, soak,
        reflecttype, mimic, simplebeam, worryseed, gastroacid, entrainment,
        topsyturvy, nightmare, octolock, spiderweb, telekinesis, lockon,
        mindreader, foresight, odorsleuth, defog, healpulse, floralhealing,
        purify, instruct, quash, electrify, embargo, spotlight, psychoshift,
        magicpowder, forestscurse, trickortreat, venomdrench, bide, beatup,
        seismictoss, nightshade, dragonrage, sonicboom, psywave, superfang,
        endeavor, painsplit, present, spitup, wringout, crushgrip, electroball,
        flail, reversal, gyroball, hardpress, heatcrash, heavyslam, lowkick,
        grassknot, fissure, guillotine, horndrill, sheercold, naturesmadness,
        ruination, strengthsap`.
        Where such an id is a row, the row's `knownGap` must reflect the measured
        engine (a stale flag fails `it.fails`); the task report lists every id
        that landed as a row and every one that landed `no-op`.
  - [ ] `[unit]` The multi-turn families are pinned on seed **2026** through
        `scriptedBattle` in `moveAudit.test.ts`: one case each for Leech Seed,
        Yawn, perish song, Encore/Taunt decay and protection, each with an inline
        snapshot or exact event assertion, so a change to the residual pass
        fails.
  - [ ] `[unit]` `git diff --name-only main...task-119` lists only this spec's
        exclusive paths.
  - [ ] `[live]` In a **develop** build (`ENVIRONMENT=development`, `npm run dev`),
        a battle that uses one of the newly `no-op` moves logs the `D16`
        `[coverage]` warning **exactly once** for that move. Measurement: open
        the browser console, force the move (debug wild battle), read the
        `[coverage]` line; a second use of the same move in the same session adds
        no line.
  - [ ] `[live]` The coverage doc and the game agree on one named move: `Attract`
        is `no-op` in `docs/balance/effect-coverage.md`, and using it in battle
        changes nothing except the log line. Measurement: the doc row reads
        `| Attract | \`no-op\` |`, and the wild battle's HP, stat stages and
        status (the battle info panel) are unchanged after the move lands.

## 📣 Coordination

- **For the Architect:** `MoveProbe` is a **superset** of the snapshot the
  backlog entry lists. The entry's list has no `weather`, `terrain`, types,
  ability, held item or PP; `[Task-120]` (Soak, Trick, Skill Swap, Spite) and
  `[Task-121]` (weather-scaled power) cannot write a reference expectation
  without them, so the four extra families are frozen here rather than
  re-opened later. Adding a field later is additive; removing one is not.
- **For `[Task-120]` and `[Task-121]`:** the row table and the ledger are one
  contract. Adding a handler to `MOVE_EFFECTS` (or any registry `portedMoveNote`
  reads) turns a `no-op` move into a `port` row, and the "rows equal the ledger"
  gate then **fails** until that task adds the new row(s) in the same change.
  Fixing a move removes its `knownGap`: leave the flag and `it.fails` fails.
  `probeMove`, `MoveProbe`, `MoveAuditRow`, `MOVE_AUDIT_ROWS` and the three
  vector helpers are frozen exactly as written above.
- **The generated pair has one writer per batch.** This task regenerates
  `docs/balance/effect-coverage.md` + `src/data/moveCoverage.json` **last**, after
  the classifier and the script are final; `[Task-120]` and `[Task-121]`
  regenerate them again for their own handlers. Never hand-edit either file.
- **The ledger's own legend is script text.** The doc's legend and counts are
  rendered from the template inside `scripts/effect-coverage.mjs`. A later task
  that needs a legend sentence or a note changed must edit the script and
  regenerate; editing the `.md` is lost on the next run.
- **For the next batch:** the develop build's warning now has a real target. A
  `no-op` move the run can meet is a visible playtest bug, not a quiet gap.
- **Measured correction to the backlog entry:** the five "multi-line registry
  rows" are real (`abilities.ts`'s `thickfat`, `hugepower`, `purepower`,
  `sandveil`, `snowcloak`), and the bogus item row is real. Both are fixed here.

## ⛔ Out of scope

- **Any battle rule.** Not one handler, not one volatile case, not one damage
  formula. Every gap this task exposes is `[Task-120]`'s or `[Task-121]`'s.
- The 311 abilities and 290 items as behaviour (their ledger rows are read, never
  changed).
- `src/ui/**`, `src/scenes/**`, the battle log's text (`[Task-114]`), the AI
  preview (`[Task-121]`), `randomLearnset.ts`'s fixed-damage exclusions.
- The `excluded` families the ledger already refuses (entry hazards,
  doubles-only redirects, forced switching, `Sketch`).
- `package.json`, `src/main.ts`, `vite.config.ts`, `src/data/dex/**` (no dex
  regeneration), `src/engine/battle/golden.test.ts`.
- Rebalancing any move's numbers, and deleting the audit once it is green: the
  suite is the artefact.
