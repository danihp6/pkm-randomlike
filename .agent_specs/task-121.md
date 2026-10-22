# Spec: Task-121 — The relative-damage half of the audit: the number the formula multiplies

> This spec is your entire world. Everything you need is written here. Read `AGENTS.md`
> too, and nothing else is required. If something below contradicts the code, the code
> wins for *shape* and this spec wins for *behaviour*: report the contradiction in your
> final message instead of inventing a third reading.

## 🎯 Scope

- **Task type:** engine rule (pure logic + its ledger).
- **Role:** Dev.
- **Objective:** after this task, a damaging move whose amount is not its dex `basePower`
  deals the right number: two new pure resolvers in `src/engine/battle/damage.ts`
  (`resolveBasePower` and `fixedDamage`) own every relative-damage family — fixed damage,
  level-based, half-HP, OHKO, HP-difference, the stockpile/body-relative powers and the
  conditional power multipliers — and `computeDamage`, `estimateDamage` and the FIGHT
  preview all read them, so the battle, the AI and the menu show one number.
  `turn.ts`'s damage gate widens from `basePower > 0` to "this move resolves to damage",
  and a fixed amount is applied without the 85–100 roll, the crit, STAB or the type
  multiplier while still honouring Endure, Substitute, `applyDamage` and the faint path.
  The move ledger stops lying about these moves: `npm run docs:coverage` leaves **zero**
  `no-op` move rows and the audit table carries **zero** `knownGap` rows.
- **Environment:** worktree `../wt-pkm-121`, branch `task-121`, cut from `origin/main`
  @ `9182192`. Linux, a headless Chromium is available over CDP, no human in the loop. Never symlink or junction an asset
  tree; `ASSETS_ROOT` lives outside the checkout and you do not touch it.
- **Dependencies (all merged; read them, do not edit them):**
  - **The move audit** — `src/engine/battle/moveAudit.ts` and `moveAudit.test.ts`: the
    `probeMove` instrument, `MOVE_AUDIT_ROWS` and the two ledger gates. This task extends
    that table; it does not replace its conventions.
  - **The status half of the audit** (the previous task) — it edited the same
    `src/engine/battle/turn.ts` and `src/engine/battle/effects/moves.ts`, which is why this
    task is its own batch. `MOVE_EFFECTS` in `effects/moves.ts` is the seam it left behind.
  - **The battle rule shape** — `turn.ts`'s `resolveMove`/`applyMoveEffects`,
    `state.ts`'s `movedSides`, `fighter.ts`'s `Volatiles` and the stat helpers,
    `commands.ts`'s move selection. `docs/battle-spec.md` §4 records the status half;
    you write §3.
- **Delivery:** commit on `task-121`, push it, then post `dev: done task-121`
  (`docs/agent-ci.md`). Never merge, never push `main`.

### Exclusive paths (single writer)

Nothing outside this list. No other task in the batch claims any of them. Deleting a stray
`.gitkeep` from a directory this task populates is always allowed.

- `src/engine/battle/damage.ts`
- `src/engine/battle/damage.test.ts`
- `src/engine/battle/turn.ts`
- `src/engine/battle/turn.test.ts`
- `src/engine/battle/preview.ts`
- `src/engine/battle/preview.test.ts`
- `src/engine/battle/effects/moves.ts`
- `src/engine/battle/effects/moves.test.ts`
- `src/engine/battle/moveAudit.ts`
- `src/engine/battle/moveAudit.test.ts`
- `src/data/moveCoverage.test.ts` **(added by the Architect: see Coordination — the plan's
  cut missed it and it pins "there is at least one `no-op` move", which this task's
  acceptance deletes)**
- `src/data/moveCoverage.json` — **generated**, committed as `npm run docs:coverage` writes it
- `docs/balance/effect-coverage.md` — **generated**, same command
- `scripts/effect-coverage.mjs` **(added by the Architect: the ledger needs a new evidence
  seam and a corrected legend sentence; see Coordination)**
- `docs/battle-spec.md` **§3 only** (lines under `## 3. Damage and stats`, up to but not
  including `## 4. Status and volatility`). Do not touch any other section of that file.

**No new files.** Every path above already exists, so no folder `README.md` changes.

### Inputs (read-only)

- `src/engine/battle/fighter.ts` (`BattleFighter`, `Volatiles`, `applyDamage`, `applyHeal`,
  `applyBoosts`, `effectiveSpeed`, `effectiveStat`, `stagedStat`, `isGrounded`),
  `src/engine/battle/state.ts` (`BattleState`, `movedSides`, `effectiveWeather`,
  `activeFighter`, `opponentOf`, `pushEvent`, `pushText`), `src/engine/battle/modifiers.ts`
  (`rollHitWith`), `src/engine/battle/commands.ts`, `src/engine/battle/harness.ts`,
  `src/engine/battle/ai.ts`, `src/engine/rng.ts`.
- `src/data/dex/moves.ts` and `getMove`/`getSpecies`/`statAtLevel` from `src/data/dex`
  (`Species.baseStats`, `Species.weightkg` are already generated — do **not** regenerate the
  dex, do not run `npm run data:dex`).
- `src/data/moveCoverage.ts`, `src/dev/warnings.ts`.
- `docs/battle-spec.md` §3, `docs/balance/effect-coverage.md`, `docs/showdown-reuse.md`,
  `docs/tech-decisions.md` (`D4`, `D11`, `D16`).

## 🔒 Contract

This is the surface other tasks and tests will be written against. It is a promise.

### TypeScript — `src/engine/battle/damage.ts`

```ts
/** The two ways a damaging move gets its number. */
export type DamageResolver = 'fixed' | 'power';

/**
 * Every move whose amount is not a dex `basePower` at all: no data field and no dex
 * number can express it, so the engine owns it outright. `'fixed'` — `fixedDamage`
 * returns the amount and the formula is bypassed. `'power'` — `resolveBasePower`
 * computes the power the formula multiplies from scratch.
 * The ledger parses this table as its evidence (`scripts/effect-coverage.mjs`), so
 * adding an id here is adding an audit row. Format matters: one `  id: 'kind',` line
 * per entry, 2-space indent, closing `};` at column 0.
 */
export const DAMAGE_RESOLVERS: Readonly<Record<string, DamageResolver>>;

/** True when the move deals damage at all — including a move whose dex power is 0. */
export function resolvesToDamage(move: Move): boolean;

/** True when the move's amount bypasses the formula. */
export function isFixedDamageMove(move: Move): boolean;

/** The power the formula multiplies. `move.basePower` for every unresolved move. */
export function resolveBasePower(
  attacker: BattleFighter,
  defender: BattleFighter,
  move: Move,
  context?: DamageContext,
): number;

/**
 * The amount the move deals outside the formula, or null when it goes through it.
 * `rng === null` is the deterministic estimate (AI / preview): no draw, no roll.
 */
export function fixedDamage(
  attacker: BattleFighter,
  defender: BattleFighter,
  move: Move,
  rng: Rng | null,
): number | null;
```

Rules the two predicates must obey: a `Status` move is never `resolvesToDamage` and never
`isFixedDamageMove`; `isFixedDamageMove` is exactly `DAMAGE_RESOLVERS[move.id] === 'fixed'`;
`resolvesToDamage` is exactly
`move.category !== 'Status' && (move.basePower > 0 || move.id in DAMAGE_RESOLVERS)`.

`DamageContext` gains exactly three optional fields (all other fields unchanged):

```ts
export type DamageContext = Readonly<{
  /* ...the existing weather, terrain, critical, effectiveness, stat and screen fields... */
  /** The user's side party, in slot order. Beat Up's hit count, Last Respects' count. */
  party?: readonly BattleFighter[];
  /** The target's side has already used a move this turn (Payback, Bolt Beak, Fishious Rend). */
  targetMovedFirst?: boolean;
  /** The user has been hit by a damaging move this turn (Avalanche, Revenge). */
  userDamagedThisTurn?: boolean;
}>;
```

`computeDamage(attacker, defender, move, rng, context)` keeps its signature and now:

1. computes `const fixed = fixedDamage(attacker, defender, move, rng)`;
2. if it is non-null, returns `{ damage: fixed, effectiveness: 1, crit: false, stab: false }`
   **before** any weather, terrain, aura, screen, crit, roll, STAB, chart or burn term —
   that is what "a fixed amount takes no roll" means;
3. otherwise multiplies `resolveBasePower(attacker, defender, move, context)` (not
   `move.basePower`) and continues exactly as today.

`estimateDamage(attacker, defender, move, context: DamageContext = {})` gains that optional
fourth parameter (every existing 3-argument call site still compiles) and reads the same two
resolvers with `fixedDamage(..., null)`, so the AI never draws. `movePreview` in
`preview.ts` reports `power` as:

```ts
const fixed = fixedDamage(attacker, target, activeMove, null);
const damaging = activeMove.category !== 'Status' && (fixed !== null || activeMove.basePower > 0);
const powerMultiplier = damaging ? runModifyDamage(ctx, activeMove, 100, 1, false, false) / 100 : 1;
const stab = damaging && fixed === null && fighter.types.includes(activeMove.type);
const power = !damaging
  ? 0
  : fixed !== null
    ? Math.max(0, Math.round(fixed * powerMultiplier))
    : Math.round(resolveBasePower(fighter, target, activeMove, context) * powerMultiplier * (stab ? 1.5 : 1));
```

with `context` built from the state (`weather: effectiveWeather(state)`, `terrain`,
`party: state.sides[side].party`, `targetMovedFirst: state.movedSides.includes(opponentOf(side))`,
`userDamagedThisTurn: fighter.volatiles.physicalDamageTaken + fighter.volatiles.specialDamageTaken > 0`).
`MovePreview.basePower` keeps its meaning: the dex number, 0 for a fixed move.

- **Determinism.** Three members draw, in this order and nowhere else:
  1. `psywave` — one `rng.int(5, 15)` **inside `fixedDamage`**;
  2. `present` — one `rng.int(1, 100)` **in the turn loop**, after the accuracy roll;
  3. the four OHKO moves — the existing accuracy draw in `rollHitWith`, then one
     `rng.int(1, 100)` success roll inside `fixedDamage`.
  Every other member draws nothing, and `estimateDamage`/`movePreview` never draw because
  they pass `rng: null`. `new Rng(seed)` plus the same inputs must reproduce the same
  battle (`D11`).
- **Rules.** No Phaser import, no DOM, no `console`, no new dependency. `src/engine/`
  stays headless. Do not read `state.log` inside the engine. Do not add a code comment
  except for a non-obvious balance or rules decision (the tables below carry their own
  reasoning; a one-line note above a threshold table is fine).
- **`turn.ts`.** The damage block's gate becomes
  `if (activeMove.category !== 'Status' && resolvesToDamage(activeMove))`. For a fixed move
  the crit roll is skipped entirely (`crit = false`, no `rollCrit`, no
  `runModifyCrit`). The damage context passed to `computeDamage` gains `party`,
  `targetMovedFirst` and `userDamagedThisTurn` as above. A result of `damage === 0` after
  the immunity branch pushes the existing `'But it failed!'` and breaks the hit loop
  (Endeavor's equal-HP case). Everything else in the loop — accuracy, `runTryHit`,
  `runModifyDamage`, Endure, Substitute, `applyDamage`, the `damage` event, the faint path
  — is untouched.

### Data (the ledger)

- New note string for a `DAMAGE_RESOLVERS` id: `` `damage: damage.ts` ``. It is emitted
  **after** the registry and turn-loop seams and **before every `data:` fallback** — so
  `finalgambit`, whose note is `data: selfdestruct` today (its faint comes from that field),
  reads `damage: damage.ts` once its amount is the resolver's.
- Ledger after this task (assert these exact strings):
  - `## Moves — 835 total (783 port, 0 no-op, 52 excluded)`
  - `grep -c '"status": "no-op"' src/data/moveCoverage.json` prints `0`.
- Three ids move to `excluded` from the script's own curated table, with these exact
  reasons (see Coordination for why):
  - `bide` — `'needs a two-turn damage accumulator'`
  - `fling` — `"needs the held item's fling power"`
  - `spotlight` — `'needs a redirection mechanic'`
- Legend (`docs/balance/effect-coverage.md`, generated from the script's template):
  the word `weight` leaves the `excluded` bullet's parenthetical (weight **is** modelled
  now), the two ability reasons `'weight is not modelled'` become
  `'weight-changing abilities are not modelled'`, and the "For a move, `port` means…"
  bullet becomes, in substance: *a registered handler, an id the turn loop special-cases, a
  data-driven field the engine reads, or an id in `DAMAGE_RESOLVERS`
  (`src/engine/battle/damage.ts`), which is what `damage: damage.ts` names; `data: basePower`
  means the formula multiplies the move's dex number, with the multiplicative exceptions
  `resolveBasePower` applies to a named few (Eruption, Hex, Facade, the weight- and
  HP-relative powers) — those are documented in `docs/battle-spec.md` §3.*

## 🧩 Data and configuration

No new table in `src/data/`. The engine's own table is `DAMAGE_RESOLVERS`; the numbers it
implements are the reference's (`D4`/`D16`: Showdown's handler wins over a cartridge quirk;
a mechanic the engine does not carry makes the row `excluded`, never invented).

### A. `fixedDamage` — the 14 fixed amounts (`'fixed'` in the table)

| Move | Amount |
| --- | --- |
| `seismictoss`, `nightshade` | `attacker.level` (also when `move.damage === 'level'`) |
| `dragonrage` | `40` |
| `sonicboom` | `20` |
| `superfang`, `naturesmadness`, `ruination` | `Math.max(1, Math.floor(defender.hp / 2))` |
| `endeavor` | `Math.max(0, defender.hp - attacker.hp)` |
| `finalgambit` | `attacker.hp`. The user's faint is **not** new code: `move.selfdestruct` already fires in `applyMoveEffects`, which runs after the damage loop |
| `psywave` | `Math.max(1, Math.floor((attacker.level * rng.int(5, 15)) / 10))`; `rng === null` → `attacker.level` |
| `fissure`, `guillotine`, `horndrill` | see the OHKO rule below |
| `sheercold` | the OHKO rule, and `0` against an Ice-type defender |

**OHKO rule (all four, `move.ohko === true`):** the accuracy roll already happened. Then,
with `rng`: if `attacker.level < defender.level`, return `0` (the move fails). Otherwise one
`rng.int(1, 100)`; success when `roll <= Math.min(100, 30 + (attacker.level - defender.level))`.
On success the amount is `defender.hp` (a straight KO); on failure `0`. With `rng === null`
return `attacker.level < defender.level ? 0 : defender.hp`.

### B. `resolveBasePower` — the 16 resolved powers (`'power'` in the table)

| Move | Power |
| --- | --- |
| `beatup` | `10 + Math.floor(baseAtk / 10)`, `baseAtk = getSpecies(attacker.speciesId)!.baseStats.atk` |
| `crushgrip`, `wringout` | `Math.max(1, Math.floor((120 * defender.hp) / defender.maxHp))` |
| `hardpress` | `Math.max(1, Math.floor((100 * defender.hp) / defender.maxHp))` |
| `flail`, `reversal` | ratio `hp / maxHp` of the **user**: `> 0.6875` → 20, `> 0.5417` → 40, `> 0.3542` → 80, `> 0.2083` → 100, else 150 |
| `electroball` | `user = effectiveSpeed(attacker)`, `foe = effectiveSpeed(defender)`; `user >= 4 * foe` → 150, `>= 3 * foe` → 120, `>= 2 * foe` → 80, `> foe` → 60, else 40 |
| `gyroball` | `Math.min(150, Math.floor((25 * foe) / user) + 1)` (same two speeds; both are `>= 1`) |
| `lowkick`, `grassknot` | defender `weightkg`: `>= 200` → 120, `>= 100` → 100, `>= 50` → 80, `>= 25` → 60, `>= 10` → 40, else 20 |
| `heatcrash`, `heavyslam` | `ratio = Math.max(0.1, userWeight) / Math.max(0.1, foeWeight)`; `>= 5` → 120, `>= 4` → 100, `>= 3` → 80, `>= 2` → 60, else 40 |
| `return`, `frustration` | `102` (see below) |
| `present` | `move.basePower > 0 ? move.basePower : 40` — the turn loop writes the rolled power onto a copy of the move |
| `spitup` | `100 * attacker.volatiles.stockpile` (0 is refused by the loop before any roll) |

`weightkg` comes from `getSpecies(id)?.weightkg ?? 0`; a missing species weighs `0`.

### C. `resolveBasePower` — the 19 conditional multipliers (not in the table: their power still derives from the dex number, so their note stays `data: basePower`; §3 names them)

| Move | Power |
| --- | --- |
| `eruption`, `waterspout`, `dragonenergy` | `Math.max(1, Math.floor((150 * attacker.hp) / attacker.maxHp))` |
| `storedpower`, `powertrip` | `20 + 20 * Σ` over `BOOST_IDS` of `Math.max(0, attacker.boosts[stat])` |
| `lastrespects` | `50 + 50 * (context.party ?? [attacker]).filter((f) => f.hp <= 0).length` |
| `hex` | `130` when `defender.status !== null`, else `65` |
| `venoshock` | `130` when the defender's status is `psn` or `tox`, else `65` |
| `facade` | `140` when `attacker.status !== null`, else `70` (the burn's ×0.5 still applies, as the formula does) |
| `brine` | `130` when `defender.hp * 2 <= defender.maxHp`, else `65` |
| `payback` | `100` when `context.targetMovedFirst === true`, else `50` |
| `avalanche`, `revenge` | `120` when `context.userDamagedThisTurn === true`, else `60` |
| `boltbeak`, `fishiousrend` | `170` when `context.targetMovedFirst !== true`, else `85` |
| `expandingforce` | `120` on `psychic` terrain, else `80` |
| `risingvoltage` | `140` when `context.terrain === 'electric'` and `isGrounded(defender)`, else `70` |
| `grassyglide` | `70` on `grassy` terrain, else `55` |
| `psyblade` | `120` on `electric` terrain, else `80` |

### D. The stat swap (not in the table)

- `bodypress` — physical, and the **attacking** stat is the user's `def` (its stages and
  `context.attackMultiplier` included).
- `foulplay` — physical, and the attacking stat is the **defender's** `atk` read through
  the defender's own stages (`context.ignoreAttackBoosts` zeroes them as it does for the
  user's). One internal helper decides the stat *and* the fighter it is read from, used by
  `computeDamage` and `estimateDamage` alike, so the AI and the battle cannot disagree.

### E. The members whose trigger the engine does not record

`retaliate` (an ally fainted last turn), `round` (an ally's Round this turn),
`echoedvoice` (a consecutive-use streak) and `ragefist` (the number of hits taken) keep
their dex `basePower` and their `data: basePower` note. Recording those triggers needs a
field in `fighter.ts`/`state.ts`, which is not this task's path. Say exactly that in
`docs/battle-spec.md` §3.

### F. The turn-loop specials (`turn.ts`, and one handler)

1. **Present** — after the accuracy roll and `runTryHit`, before the damage gate:
   `const roll = state.rng.int(1, 100)`.
   - `roll <= 20`: heal the aimed defender `Math.max(1, Math.floor(defender.maxHp / 4))`
     with `applyHeal`, push a `heal` event when it restored anything, and `continue`.
   - `21..60` → power `40`, `61..90` → power `80`, `91..100` → power `120`: hit with
     `const hitMove = { ...activeMove, basePower }`.
   No new player-facing string.
2. **Spit Up** — before the aim loop: `stockpile === 0` pushes `'But it failed!'` and
   returns. After a landed hit, `attacker.volatiles.stockpile = 0`. Leave Stockpile's
   Defence/Sp. Def stages alone (that is the reference's other half and is out of scope;
   §3 says so).
3. **Final Gambit** — no new block: its amount comes from `fixedDamage` and its user's faint
   from the existing `move.selfdestruct` branch of `applyMoveEffects`. Confirm the order in
   `moveAudit.test.ts`'s row (damage, the target's faint, then the user's).
4. **Beat Up** — the hit count is
   `Math.max(1, party.filter((f) => f.hp > 0 && f.status === null).length)` (the reference
   skips a member that carries a status) and it replaces
   `runModifyMultihit(...multihitHits(...))`; it draws nothing. Per-hit power comes from
   `resolveBasePower` (the **user's** base Attack for every hit — the reference reads each
   member's own base Attack, and that stat seam does not exist; §3 records the difference).
5. **Pain Split** — a `MOVE_EFFECTS` entry (`painsplit`) in `effects/moves.ts` with an
   `onAfterMove` handler: `const average = Math.floor((ctx.source.hp + ctx.target.hp) / 2)`,
   then move **the user** first (`applyHeal`/`applyDamage` + the `heal`/`damage` event) and
   **the target** second. No new player-facing string.
6. **Return / Frustration** — both resolve to `102`: the reference's maximum for either
   (`Math.floor(255 / 2.5)`), because the engine models no friendship axis and inventing one
   is a save-field change. §3 records it.

### G. The audit (`moveAudit.ts` / `moveAudit.test.ts`)

- `MoveAuditSetup` gains one optional knob, `playerStockpile?: number`, clamped to
  `0..3` and written to `player.volatiles.stockpile` before the move. Nothing else changes
  in `probeMove`.
- `MOVE_AUDIT_ROWS` gains **one row per `DAMAGE_RESOLVERS` id (30 — the 14 fixed and the
  16 power members of tables A and B)** plus **`painsplit`**, inserted in sorted order, and
  `finalgambit`'s existing row loses its `knownGap`. No other row changes. The 19 conditional
  multipliers of table C are **not** in the table, so they stay in the `data: basePower`
  plain-damage sweep (`BASE_POWER_SETUPS` keeps its `hex` and `lastrespects` entries) and
  their evidence is `damage.test.ts`, not a row.
  Rows that must pin HP arithmetic exactly (probe board: two level-50 Ditto, max HP 123,
  full HP unless stated):

  | Row | `setup` | `expected` |
  | --- | --- | --- |
  | `seismictoss` | — | `{ enemyHp: 73, events: ['move', 'damage'] }` |
  | `nightshade` | — | `{ enemyHp: 73, events: ['move', 'damage'] }` |
  | `dragonrage` | — | `{ enemyHp: 83, events: ['move', 'damage'] }` |
  | `sonicboom` | — | `{ enemyHp: 103, events: ['move', 'damage'] }` |
  | `superfang` | — | `{ enemyHp: 62, events: ['move', 'damage'] }` |
  | `naturesmadness` | — | `{ enemyHp: 62, events: ['move', 'damage'] }` |
  | `ruination` | — | `{ enemyHp: 62, events: ['move', 'damage'] }` |
  | `endeavor` | `{ playerHp: 40 }` | `{ playerHp: 40, enemyHp: 40, events: ['move', 'damage'] }` |
  | `finalgambit` | — | `{ playerHp: 0, enemyHp: 0, events: ['move', 'damage', 'faint', 'faint'] }` |
  | `painsplit` | `{ playerHp: 40 }` | `{ playerHp: 81, enemyHp: 81, events: ['move', 'heal', 'damage'] }` |
  | `fissure`, `guillotine`, `horndrill`, `sheercold` | `{ playerBoosts: { accuracy: 6 } }` | the outcome seed 2026 produces: `events: ['move']` on a miss, `{ enemyHp: 0, events: ['move', 'damage', 'faint'] }` on the KO |
  | `spitup` | `{ playerStockpile: 1 }` | `{ events: ['move', 'damage'] }` plus the HP the seeded roll produces |
  | `psywave` | — | `{ events: ['move', 'damage'] }` plus the HP seed 2026 produces |
  | `present` | `{ enemyHp: 40 }` | the outcome seed 2026 produces: `{ enemyHp: 70, events: ['move', 'heal'] }` on the quarter-heal branch (`floor(123 / 4) = 30`), or `{ events: ['move', 'damage'] }` with that HP on the damaging branch |

  Every other new row is `{ events: ['move', 'damage'] }` on the default board — `beatup`
  (one hit), `crushgrip`, `wringout`, `hardpress`, `flail`, `reversal`, `electroball`,
  `gyroball`, `lowkick`, `grassknot`, `heatcrash`, `heavyslam`, `return`, `frustration`.
  A row whose amount depends on the roll (the four OHKOs, `spitup`, `psywave`, `present`)
  pins what `PROBE_SEED` (2026) produces — run it once, read the received value, record it;
  never move the probe seed.
- `LEDGER_TARGETS` drops `'bide'` and `'spotlight'` (they are `excluded` now, and the gate
  asserts "a row or a `no-op`"). Every other id on that list must still be a row.
- `src/data/moveCoverage.test.ts` loses the two "greater than zero" assertions
  (`expect(noOps.length).toBeGreaterThan(0)` and
  `expect(Number(header?.[1] ?? '0')).toBeGreaterThan(0)`); every equality in that file
  stays.
- `scripts/effect-coverage.mjs`: add the `DAMAGE_RESOLVERS` parse beside the
  `TURN_LOOP_MOVES` seam (`tableKeys(text('src/engine/battle/damage.ts'), 'DAMAGE_RESOLVERS')`,
  a `Set`, note `damage: damage.ts`, third in `portedMoveNote`), the three exclusion rows
  under the existing "Deliberately out of scope" block, and the legend/ability-reason edits
  listed under Data.

## 🧪 Test and Validation Plan (for QA)

QA runs this verbatim. Every criterion below is executable by someone who has read only
this section.

- **Method:** all criteria are `[unit]`. This task is engine-only — no scene, no render, no
  input, no asset — so it owes **no browser pass** and carries **no `[live]` criterion**.
  Do not open the game for this task; if you do, it is not evidence for anything below.
- **Commands:**
  - `npx vitest run src/engine/battle/damage.test.ts`
  - `npx vitest run src/engine/battle/turn.test.ts`
  - `npx vitest run src/engine/battle/preview.test.ts`
  - `npx vitest run src/engine/battle/effects/moves.test.ts`
  - `npx vitest run src/engine/battle/moveAudit.test.ts`
  - `npx vitest run src/engine/battle/golden.test.ts`
  - `npx vitest run src/data/moveCoverage.test.ts`
  - `npm test`
  - `npm run build`
  - `npm run docs:coverage` then `git diff --exit-code docs/balance/effect-coverage.md src/data/moveCoverage.json`
  - `git diff --name-only origin/main...task-121`

- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` is clean (`tsc --noEmit && vite build`).
  - [ ] `[unit]` `npm test` is green, including every test file listed above.
  - [ ] `[unit]` `git diff --name-only origin/main...task-121` lists only the 15 paths in
    *Exclusive paths* (plus `.agent_specs/task-121.md`); any other path fails the task.
  - [ ] `[unit]` `npx vitest run src/engine/battle/golden.test.ts` is green **without
    editing `golden.test.ts`** — the inline log is byte-identical (it holds none of this
    task's moves).
  - [ ] `[unit]` `npx vitest run src/engine/battle/moveAudit.test.ts` is green and
    `grep -c 'knownGap: true' src/engine/battle/moveAudit.ts` prints `0`.
  - [ ] `[unit]` In `moveAudit.test.ts`, `seismictoss` removes exactly 50 (enemy 73/123),
    `superfang` exactly 61 (enemy 62/123), `endeavor` leaves both sides at 40,
    `finalgambit` zeroes both HP, and `painsplit` from 40 HP puts both sides at 81 — the
    assertions assert those integers, not ranges.
  - [ ] `[unit]` `npx vitest run src/engine/battle/damage.test.ts` pins `resolveBasePower`
    with a literal integer per member of tables B and C (and the two stat swaps through
    `computeDamage`): e.g. `eruption` with `hp * 2 === maxHp` is `75`, `lowkick` against a
    200 kg defender is `120`, `storedpower` with `{ atk: 2, spa: 1 }` is `80`, `boltbeak`
    with `targetMovedFirst: false` is `170`, `payback` with `targetMovedFirst: true` is
    `100`.
  - [ ] `[unit]` `damage.test.ts` pins `fixedDamage` with a literal per fixed member and
    shows the draw behaviour: a `new Rng(n)` advanced through `computeDamage` on
    `dragonrage`/`superfang`/`endeavor` leaves the stream where it was (compare
    `next()` with a fresh `new Rng(n)`), while `psywave` consumes exactly one draw.
  - [ ] `[unit]` `turn.test.ts` shows, on a fixed seed: a fixed hit logs
    `crit: false, effectiveness: 1` and its exact amount; Endure leaves the target at 1 HP;
    a Substitute absorbs the fixed hit; Endeavor pushes `But it failed!` at equal HP;
    Counter mirrors twice the physical damage taken this turn; the OHKO rule fails against
    a higher-level target without drawing; Spit Up at 0 stockpile fails, at 1 stockpile
    deals `100`-power damage and clears the counter; Beat Up lands one hit per healthy
    party member; Payback and Avalanche hit harder when `movedSides`/the per-turn damage
    say so.
  - [ ] `[unit]` `preview.test.ts` pins `movePreview(state, 'player', 0)` for a fixed move
    (`basePower: 0`, `power: 50` for a level-50 `seismictoss`, `stab: false`) and for a
    resolved-power move (`eruption` at half HP, `power` including its STAB), and proves the
    preview consumes no draw: `battle.rng.next()` equals a fresh `new Rng(seed).next()`
    after the call.
  - [ ] `[unit]` `npm run docs:coverage` then
    `git diff --exit-code docs/balance/effect-coverage.md src/data/moveCoverage.json` exits
    `0` (the committed pair is exactly what the script writes).
  - [ ] `[unit]` `grep -c '"status": "no-op"' src/data/moveCoverage.json` prints `0`, and
    `grep -cF '## Moves — 835 total (783 port, 0 no-op, 52 excluded)'
    docs/balance/effect-coverage.md` prints `1`.
  - [ ] `[unit]` The 33 formerly `no-op` ids are accounted for exactly:
    `grep -c '"status": "excluded"' src/data/moveCoverage.json` prints `52`;
    `grep -A2 -E '"id": "(bide|fling|spotlight)"' src/data/moveCoverage.json | grep -c '"status": "excluded"'`
    prints `3`; and
    `grep -A2 -E '"id": "(beatup|crushgrip|dragonrage|electroball|endeavor|fissure|flail|frustration|grassknot|guillotine|gyroball|hardpress|heatcrash|heavyslam|horndrill|lowkick|naturesmadness|nightshade|painsplit|present|psywave|return|reversal|ruination|seismictoss|sheercold|sonicboom|spitup|superfang|wringout)"' src/data/moveCoverage.json | grep -c '"status": "port"'`
    prints `30`.
  - [ ] `[unit]` `docs/battle-spec.md` §3 states, in its own words: which moves bypass the
    formula and that a fixed amount takes no roll; the OHKO rule and its two rolls; the
    weight/HP/speed tables' members; the three draws and that no other member draws;
    Return/Frustration at 102; Beat Up's borrowed attack stat; Spit Up's stockpile; Pain
    Split; Fling/Bide/Spotlight excluded and why; and the four members whose trigger the
    engine does not record.

## 📣 Coordination

- **For the Architect — one correction to the plan's path cut.** The batch record lists
  `damage/turn/preview`, `effects/moves` and the generated coverage pair. It misses
  `src/data/moveCoverage.test.ts`, which asserts `unportedMoveIds().length > 0` (and the
  generated header's `no-op` count `> 0`). With this task's acceptance — *no `no-op` row
  left* — that file goes red unless those two assertions go. It is claimed here, as a
  two-assertion deletion (`src/data/moveCoverage.test.ts`), and nothing else in it changes.
- **For the Architect — why `scripts/effect-coverage.mjs` is claimed.** The 29 former
  `no-op` members have no field the classifier knows, and `finalgambit`'s only evidence
  (`data: selfdestruct`) names its faint, not its amount, so the honest evidence seam is the
  engine's own table: the classifier now parses `DAMAGE_RESOLVERS` from `damage.ts` (the
  same textual read it already does for `TURN_LOOP_MOVES` and the `effects/moves.ts`
  tables). The script also owns the legend the task must correct (the `weight` sentence, the
  two `'weight is not modelled'` ability reasons — weight *is* modelled now, through
  `Species.weightkg` — and the sentence that tells `damage: damage.ts` from
  `data: basePower`), and the legend lives in the generator's template, so it cannot be
  fixed anywhere else.
- **Three of the 33 stay out of `port`, deliberately and with the script's own exclusion
  table** (a dead handler is worse than an honest exclusion):
  - `spotlight` — its whole effect is a single-target redirect and the engine has no
    redirection mechanic at all (Follow Me and Rage Powder are excluded for the same
    reason); in every battle the engine can run today it would change nothing.
  - `bide` — needs a two-turn damage accumulator; `fighter.ts` carries no such field and is
    not this task's path.
  - `fling` — needs the held item's `fling.basePower`, which `DexItem`
    (`src/data/dex/items.ts`) does not expose and that accessor is not this task's path.
  All three get a precise reason string in the ledger; none is a silent gap.
- **For the UI (a later batch, not this one):** `src/ui/moveGrid.ts` draws the power number
  only when `basePower > 0`, so a `Seismic Toss` row still shows `—` even though
  `MovePreview.power` is now 50. `MovePreview.basePower` deliberately keeps its dex meaning
  (0), so fixing the cell is a `src/ui/` change and belongs to whoever next touches the
  moves grid.
- **For the next batch:** the four members whose trigger the engine does not record
  (`retaliate`, `round`, `echoedvoice`, `ragefist`) need one field each in
  `fighter.ts`/`state.ts` (an ally-faint turn marker, a Round-this-turn marker, a
  consecutive-use streak, a hits-taken counter) before their power can be resolved. That is
  a `fighter.ts` task, not a `damage.ts` one.
- **Fixed-seed ledger.** No existing battle moves: the golden battle holds none of these
  moves and its `Rng` draw count is unchanged (the resolver adds a draw only for
  `psywave`, `present` and an OHKO's success roll, and `estimateDamage`/`movePreview` draw
  nothing). The new audit rows are pinned on `PROBE_SEED` 2026; the per-family multi-turn
  and wiring cases are pinned on their own literal seeds in `turn.test.ts`.

## ⛔ Out of scope

- `src/engine/battle/randomLearnset.ts` — `FIXED_DAMAGE_IDS`, `FIXED_DAMAGE_MIN_LEVEL = 20`
  and the `move.ohko` skip **keep** excluding these moves from randomized learnsets: widening
  those pools re-rolls every randomized learnset and re-pins the whole roster family. That is
  a balance task of its own.
- `src/scenes/**`, `src/ui/**`, `src/i18n/**` — no scene edit, no new player-facing string,
  no i18n key (the log's text is a later task's).
- `src/data/dex/**` — no dex regeneration, no `npm run data:dex`, no new field on `DexItem`.
- `src/engine/battle/fighter.ts` and `src/engine/battle/state.ts` — no new volatile, no new
  state field, no new `Volatiles` key.
- `golden.test.ts` — it must stay byte-identical and green; never re-pin it.
- `forceSwitch` (`Circle Throw`, `Dragon Tail`, `Roar`, `Whirlwind`), entry hazards, the
  status half (already shipped), Grassy Glide's and Expanding Force's *targeting* changes
  (power only here), Stockpile's Defence/Sp. Def stage removal on Spit Up, and any rebalance
  of a move's printed numbers.
- `TODO.md`, `CHANGELOG.md`, the batch plan and every folder `README.md`.
