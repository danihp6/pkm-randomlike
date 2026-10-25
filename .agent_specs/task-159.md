# Spec: Task-159 — Trap moves damage their target every turn, and the audit learns to see it

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule (battle) + tooling + docs.
- **Role:** Dev.
- **Objective:** The ten binding moves — **Sand Tomb, Fire Spin, Whirlpool, Wrap, Bind,
  Infestation, Magma Storm, Thunder Cage, Snap Trap, Clamp** — all carry
  `volatileStatus: 'partiallytrapped'`, and today the engine treats it as `trapped`:
  the target cannot switch but **loses no HP on any later turn** and the state never
  expires. After this task `volatiles.partiallyTrapped` is its own record
  `{ turns, moveId }`, its **4-5 turn** duration is drawn from the battle's seeded `Rng`
  when the move lands, the residual pass pays **1/8 of max HP** (`1/6` with
  **Binding Band**, which stops being a `no-op` item), the volatile clears when the
  counter reaches zero, and a Ghost-type target still takes the damage but is **not**
  prevented from switching. The **move audit** gains a `residual` expectation — what the
  move does on the following turn — so a handler that "exists but nothing happens" can
  never pass as `port` again, and the coverage table learns the new seam.
- **Environment:** worktree `../wt-pkm-159`, branch `task-159`.
- **Dependencies:** `[Task-119]` — `src/engine/battle/moveAudit.ts` and
  `moveAudit.test.ts` ship, with the ten rows already in `MOVE_AUDIT_ROWS` at
  `bind` (line 297), `clamp` (359), `firespin` (511), `infestation` (634),
  `magmastorm` (692), `sandtomb` (925), `snaptrap` (992), `thundercage` (1099),
  `whirlpool` (1179) and `wrap` (1192). `[Task-120]`/`[Task-121]` merged the residue and
  the generated coverage pair. All merged.

### Exclusive paths (single writer)

Nothing outside this list. No other task in this batch claims any of these paths.

- `src/engine/battle/fighter.ts`
- `src/engine/battle/fighter.test.ts`
- `src/engine/battle/volatile.ts`
- `src/engine/battle/volatile.test.ts`
- `src/engine/battle/turn.ts`
- `src/engine/battle/turn.test.ts`
- `src/engine/battle/state.ts`
- `src/engine/battle/moveAudit.ts`
- `src/engine/battle/moveAudit.test.ts`
- `src/engine/battle/effects/registry.ts`
- `src/engine/battle/effects/registry.test.ts`
- `src/engine/battle/effects/items.ts`
- `src/engine/battle/effects/items.test.ts`
- `scripts/effect-coverage.mjs`
- `src/data/moveCoverage.json` (**generated** — regenerate, never hand-edit)
- `docs/balance/effect-coverage.md` (**generated** — regenerate, never hand-edit)
- `src/data/shop.ts` (**added at dev time, 2026-10-25** — Binding Band stops being
  `no-op`, and `src/data/shop.test.ts` asserts the Mart stocks every modelled
  competitive held item, so one `late` row is mandatory; nothing else in the file)
- `docs/balance/economy.md` (**added at dev time, 2026-10-25** — only the two rows the
  new `late` shelf changes: the count and the premium list)
- `src/ui/casinoReels.test.ts` (**added at dev time, 2026-10-25** — only the frozen
  `FACES.late` list, which `Task-115`'s rule says follows the Mart the day it bands an
  item)
- `src/i18n/en.ts`
- `src/i18n/es.ts`
- `docs/battle-spec.md` §4 "Status and volatility" — **only** §4

### Inputs (read-only)

- `src/engine/rng.ts` (`Rng.int`) — read only
- `src/engine/battle/damage.ts`, `status.ts` (the existing residual helpers the trap
  damage sits beside), `order.ts`, `commands.ts`, `ai.ts` (`isTrapped`'s readers)
- `src/engine/battle/effects/conditions.ts`
- `src/engine/battle/golden.test.ts` + `harness.ts` (the byte-identical golden log)
- `src/data/dex/moves.js` accessors via `getMove` (`src/data/dex/moves.ts`) — the ten
  moves' `volatileStatus`
- `src/data/items.ts` (the `bindingband` catalogue row, line 796)
- `package.json`'s `docs:coverage` script — **read only, do not edit `package.json`**
- `AGENTS.md`

## 🔒 Contract

### TypeScript — `src/engine/battle/fighter.ts`

```ts
/** A binding move's own record on the victim (`Task-159`). */
export type PartialTrap = Readonly<{ turns: number; moveId: string }>;

export type Volatiles = {
  // …every key it carries today…
  /**
   * The binding move holding the fighter: how many residual ticks are left and the
   * move that set it (`null` when nothing binds it). Replaces the old "it is only
   * `trapped`" reading: `trapped` is still set while it holds, so `isTrapped` and the
   * AI's switch rules keep working.
   */
  partiallyTrapped: PartialTrap | null;
};
```

`emptyVolatiles()` gains `partiallyTrapped: null`. `clearVolatiles`/`resetBattleState`
already reset through `emptyVolatiles()` — no other change there.

### TypeScript — `src/engine/battle/volatile.ts`

```ts
/** A binding move holds for 4-5 residual ticks (the classic duration). */
export const PARTIAL_TRAP_TURNS: Readonly<{ min: number; max: number }> = { min: 4, max: 5 };

/** The share of max HP a trap pays per turn; a held Binding Band switches it to 1/6. */
export const PARTIAL_TRAP_FRACTION = 8;

/**
 * Binds `fighter` to `moveId`: draws the duration (`rng.int(4, 5)`) — **one draw, the
 * only one this rule makes** — and replaces any trap already holding it, so a second
 * binding move resets the counter instead of stacking. Always returns `true` (the write
 * happens).
 */
export function applyPartialTrap(fighter: BattleFighter, moveId: string, rng: Rng): boolean;

/**
 * One residual tick of the trap: decrements `turns`; at zero it clears
 * `partiallyTrapped` and releases `trapped` unless `octolock` or `noretreat` still holds
 * it. Returns the turns left (`0` when it just cleared).
 */
export function tickPartialTrap(fighter: BattleFighter): number;
```

- `applyPartialTrap` sets `fighter.volatiles.partiallyTrapped = { turns: rng.int(PARTIAL_TRAP_TURNS.min, PARTIAL_TRAP_TURNS.max), moveId }`
  and `fighter.volatiles.trapped = true`.
- **Draw order (write it in the commit message):** the duration is drawn at the moment
  the move's volatile is written — after that move's accuracy roll and its
  damage secondary rolls, and **before** anything the rest of the turn draws. One draw
  per successful bind, no draw for a `trapped`/`block`/`meanlook` write.

### TypeScript — `src/engine/battle/state.ts`

```ts
/** True while `side`'s active Pokémon cannot switch out or flee (trap volatile or ability). */
export function isTrapped(state: BattleState, side: SideId): boolean;
```

New body order (the **Ghost** rule is the only change):

```ts
  const holder = activeFighter(state, side);
  if (holder.volatiles.noretreat || holder.volatiles.octolock) return true;
  if (holder.volatiles.trapped && !holder.types.includes('Ghost')) return true;
  if (holder.volatiles.ingrain) return true;
  if (state.field.fairylock > 0) return true;
  return trappedBy(opponent(state, side), holder);
```

A **Ghost** is immune to a binding move's trapping (it still takes the residual damage),
while No Retreat and Octolock — which the holder brought on itself — keep holding it.
`trappedBy` already excludes Ghosts from the trapping abilities; do not change it.

### TypeScript — `src/engine/battle/effects/registry.ts`

One new hook, shaped exactly like `onModifyRecoil`/`runModifyRecoil` (line 477):

```ts
export type EffectHandlers = Readonly<{
  // …every hook it carries today…
  /** A held item amending the damage a binding move pays (Binding Band). */
  onModifyTrapDamage?: (ctx: EffectContext, damage: number) => number | void;
}>;

/** Partial-trap damage modifiers read the trapped fighter's own held item. */
export function runModifyTrapDamage(ctx: EffectContext, damage: number): number;
```

`runModifyTrapDamage` iterates `contextEffects(ctx, false, null)` (a null move is legal
here — `moveEffect(null)` returns `[]`) and keeps the last numeric answer, like
`runModifyRecoil`. `ownedEffects`/`hasAbility` need no change.

### TypeScript — `src/engine/battle/effects/items.ts`

- **Remove `'bindingband'` from `UNMODELLED_ITEMS`** (line 64).
- Give it its handler inside `handlersFor(item)`, beside the other id-specific rows:

```ts
  if (item.id === 'bindingband') {
    handlers = { ...handlers, onModifyTrapDamage: (ctx) => Math.max(1, Math.floor(ctx.owner.maxHp / 6)) };
  }
```

`ctx.owner` is the fighter the item belongs to (the trapped one, because the residual
pass builds its context with that fighter as `source`). Nothing else in the file moves.

### TypeScript — `src/engine/battle/turn.ts`

1. **The volatile case** (`applyVolatileEffect`, the ten ids' write). `applyVolatileEffect`
   gains a fifth parameter, `moveId: string`, and its two call sites pass it:
   `applyMoveEffects` passes `move.id` (the `if (move.volatileStatus)` block, line 582);
   `applySecondary` (line 519) gains its own `moveId: string` parameter, passed down from
   `applyMoveEffects`' secondary loop. The switch becomes:

```ts
      case 'trapped':
        applyTrap(target);
        return true;
      case 'partiallytrapped':
        return applyPartialTrap(target, moveId, state.rng);
```

2. **The residual tick**, inside `resolveResiduals` (line 1541) — a **new loop between
   the ability/item residual loop (lines 1569-1576) and the Yawn loop (lines 1578-1590)**,
   so the order reads: status → weather → terrain → ability/item → **trap** → yawn →
   wish → leech seed → perish → the aqua/ingrain/curse/octolock/nightmare block:

```ts
  for (const side of SIDE_IDS) {
    for (const slot of liveSlots(state, side)) {
      const fighter = activeFighter(state, side, slot);
      const trap = fighter.volatiles.partiallyTrapped;
      if (!trap || fighter.hp <= 0) continue;
      if (takesIndirectDamage(fighter)) {
        const base = Math.max(1, Math.floor(fighter.maxHp / PARTIAL_TRAP_FRACTION));
        const damage = runModifyTrapDamage(
          makeContext(state, side, { source: fighter, target: opponent(state, side) }),
          base,
        );
        const dealt = applyDamage(fighter, damage);
        pushEvent(state, {
          kind: 'damage',
          side,
          amount: dealt,
          hp: fighter.hp,
          maxHp: fighter.maxHp,
          effectiveness: 1,
          crit: false,
        });
        pushText(state, 'battle.log.partiallyTrapped', { name: fighter.name, move: trap.moveId });
      }
      const left = tickPartialTrap(fighter);
      if (fighter.hp <= 0) {
        faint(state, side, slot);
        continue;
      }
      if (left === 0) pushText(state, 'battle.log.partiallyTrappedEnd', { name: fighter.name });
    }
  }
```

   The `left === 0` line is the second key below: both are added.

3. Nothing else in `turn.ts` moves: no other pass is reordered, and a fighter without
   `partiallyTrapped` produces no event, so **`golden.test.ts`'s inline log stays
   byte-identical** (its battle uses `ember`/`growl`/`vinewhip`/`tackle`).

### TypeScript — `src/engine/battle/moveAudit.ts`

```ts
export interface MoveAuditRow {
  moveId: string;
  expected: Partial<MoveProbe>;
  /**
   * What the move does on the **following** turn (`Task-159`): a binding move pays its
   * residual there, so a row that only writes a volatile can no longer pass as `port`.
   */
  residual?: Partial<MoveProbe>;
  setup?: Partial<MoveAuditSetup>;
  knownGap?: true;
}

/**
 * `probeMove` plus one more full turn: the player holds `splash` in slot 1, the audited
 * move runs from slot 0, then `takeTurn` runs the player's `splash` and the enemy's,
 * which is where the residual pass pays. Same seed, same board, same snapshot shape.
 */
export function probeResidual(moveId: string, setup: Partial<MoveAuditSetup> = {}): MoveProbe;
```

- `probeResidual` builds the board exactly as `probeMove` builds it (same `PROBE_SEED`,
  same species/level/HP/boosts/status/item/weather/terrain), except the player's
  `moves` are `[moveId, 'splash']`; it then runs
  `useMove(state, 'player', { type: 'fight', moveIndex: 0 })` and
  `takeTurn(state, { type: 'fight', moveIndex: 1 }, { type: 'fight', moveIndex: 0 })`,
  and returns the same `MoveProbe` snapshot.
- **The ten rows gain a `residual`.** Each of the ten carries at least
  `residual: { enemyHp: <number> }` — the value you read once from
  `probeResidual(<moveId>)` and then write down as a literal; add `events` or
  `enemyVolatiles` if the pinned answer needs them. Their `expected` gains
  `'partiallyTrapped'` in the sorted `enemyVolatiles` list (the record is truthy, so
  `volatilesOf` lists it) — re-read and re-pin each one, they are the ten rows'
  **fixed-seed regressions** and this task re-pins them on purpose.
- **The class guard** (this is the "the audit learns to see it" half), in
  `moveAudit.test.ts`:

```ts
import { RESIDUAL_VOLATILES } from './volatile';
// …
it('demands a residual expectation from every move that sets a residual volatile', () => {
  for (const row of MOVE_AUDIT_ROWS) {
    const move = getMove(row.moveId);
    const volatile = move?.volatileStatus ? normalizeVolatileId(move.volatileStatus) : '';
    if (RESIDUAL_VOLATILES.includes(volatile)) expect(row.residual, row.moveId).toBeDefined();
  }
});
```

  with `normalizeVolatileId` the lowercase/no-space normaliser the file already uses for
  the dex's volatile ids (`'partiallyTrapped'` → `'partiallytrapped'`).

### `src/engine/battle/volatile.ts` — the table the tooling reads

```ts
/**
 * The volatiles that pay damage every turn: the coverage table reads this list, so a
 * move that only writes one of them is never `port` on the strength of the write.
 */
export const RESIDUAL_VOLATILES: readonly string[] = ['partiallytrapped'];
```

### `scripts/effect-coverage.mjs`

Read the new list the way the script already reads `UNMODELLED_ITEMS` (slice from
`const RESIDUAL_VOLATILES` to `];`, match `/'([a-z0-9]+)'/g`) out of
`src/engine/battle/volatile.ts`, and in `portedMoveNote` put this check **before** the
volatile one:

```js
  if (RESIDUAL_VOLATILES.has(norm(move.volatileStatus ?? ''))) return 'data: residual';
```

Then regenerate: `npm run docs:coverage` (it writes `docs/balance/effect-coverage.md` and
`src/data/moveCoverage.json` — commit both, hand-edit neither). The ten moves stop
reading `port | data: volatileStatus` and start reading `port | data: residual`; Binding
Band's item row stops reading `no-op` and starts reading `port`.

### Data

- **i18n (`src/i18n/en.ts`, `src/i18n/es.ts`)** — two keys, authored in `en.ts` first
  (D43), each with its `es.ts` line:
  - `'battle.log.partiallyTrapped'`: EN `"{name} is hurt by the trap!"`,
    ES `"¡{name} sufre por la trampa!"`.
  - `'battle.log.partiallyTrappedEnd'`: EN `"{name} is free of the trap!"`,
    ES `"¡{name} se libra de la trampa!"`.
  (`BattleTextKey` is `Extract<TranslationKey, \`battle.log.${string}\`>`, so the keys
  must be in **both** tables or the type layer fails.)
- `Volatiles.partiallyTrapped: { turns, moveId } | null`.
- `PARTIAL_TRAP_TURNS = { min: 4, max: 5 }`, `PARTIAL_TRAP_FRACTION = 8`, the Binding
  Band's `1/6`.
- No run field, no `SAVE_VERSION` step (`FighterSnapshot` carries no volatile), no
  generated dex change.

## 🧩 Data and configuration

The duration band and the fraction live in `volatile.ts` next to `leechSeedDamage` and
`nightmareDamage` (the shipped precedent): they are the rule's own constants, not a
balance table — no band, biome or item row reads them, and the one item that amends the
fraction does it through the registry hook.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `npm run docs:coverage` — must be run and its two outputs committed.
  - `git diff --name-only main...task-159` audit against the exclusive paths list.
  - Every criterion here is `[unit]`: the battle is headless and seeded, so **this task
    owes no browser pass**.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `src/engine/battle/volatile.test.ts` pins the duration: on a fixed seed
        a bind lands with `turns === 4` and on another fixed seed with `turns === 5`
        (both written down), and `applyPartialTrap` spends exactly **one** draw
        (`rng.next()` count before/after).
  - [ ] `[unit]` `src/engine/battle/volatile.test.ts` pins the arithmetic on a board with
        a known `maxHp`: the residual pays `max(1, floor(maxHp / 8))`, and pays
        `max(1, floor(maxHp / 6))` when the victim holds `bindingband` — both as exact
        numbers for that board.
  - [ ] `[unit]` `src/engine/battle/volatile.test.ts` pins the clear: 4 ticks on a
        4-turn trap, `partiallyTrapped === null` after the last, `trapped === false`, and
        `trapped` still `true` when `octolock` (or `noretreat`) also holds it.
  - [ ] `[unit]` `src/engine/battle/volatile.test.ts` pins the reset: a second binding
        move on an already-trapped fighter replaces `{ turns, moveId }` (the counter goes
        back to the fresh draw) instead of stacking.
  - [ ] `[unit]` `src/engine/battle/turn.test.ts` proves, on a real battle: bind's
        damage lands on the **following** turn's residual (not on the landing turn), the
        victim's HP drops by the pinned fraction, and the fight's log carries
        `battle.log.partiallyTrapped`.
  - [ ] `[unit]` `src/engine/battle/turn.test.ts` proves the Ghost rule: a Ghost target
        of a binding move still takes the residual damage but `isTrapped(state, side)` is
        `false`; a non-Ghost target is `true`.
  - [ ] `[unit]` `src/engine/battle/golden.test.ts` is green **without touching its
        inline snapshot**: the golden log is byte-identical.
  - [ ] `[unit]` `src/engine/battle/moveAudit.test.ts` passes with the ten rows'
        `residual` filled and includes the class guard above; deleting one row's
        `residual` makes that test fail.
  - [ ] `[unit]` `src/engine/battle/effects/items.test.ts` is green with `bindingband`
        out of `UNMODELLED_ITEMS` (it is registered as an `item` effect) and Binding Band
        exposed as `no-op` nowhere.
  - [ ] `[unit]` `npm run docs:coverage` leaves a clean tree, and
        `src/data/moveCoverage.json` carries `{"status":"port","note":"data: residual"}`
        for all ten moves and `{"status":"port"}` for Binding Band.
  - [ ] `[unit]` `git diff main...task-159 --name-only` lists no path outside the
        exclusive list — in particular no `package.json`, no `src/scenes/**`, no
        `src/engine/run/**`, no `src/data/dex/**` and no `src/data/items.ts`.

## 📣 Coordination

- **For the Architect / the plan:** `src/engine/battle/status.ts` is **not** in the
  exclusive list (the TODO entry claimed it): the trap's damage helper lives in
  `volatile.ts` beside `leechSeedDamage`/`nightmareDamage`, which is the file's own
  precedent, so `status.ts` stays read-only here.
- **For Task-160 (Batch 73):** `turn.ts` and `moveAudit.ts` are this task's in this
  batch and yours in the next — the per-hit loop (`useMove`) and the three
  `multiaccuracy` rows must be re-read against what shipped here, not against the code
  this batch started from.
- **For `docs/battle-spec.md` §4:** add **one paragraph** immediately after the block
  that ends "…every row is pinned in `src/engine/battle/moveAudit.ts`." (line 238),
  naming: the ten moves, the `{ turns, moveId }` record, the 4-5 draw and its stream
  (`state.rng`, one draw when the move lands), the 1/8 and 1/6 fractions (Binding Band
  through `onModifyTrapDamage`), the residual's position in the end-of-turn order, the
  clear and the release of `trapped`, the Ghost immunity (damage yes, switch
  prevention no), and the audit's `residual` expectation with `RESIDUAL_VOLATILES` as
  the seam the coverage table reads. Tasks 154 and 156 own §7 and §12 — **do not touch
  §3, §7 or §12**.
- **For Integration QA:** two generated artefacts change; they must match a fresh
  `npm run docs:coverage` run exactly (no hand edits).

## ⛔ Out of scope

- **Grip Claw** (a longer trap), **Big Root**, **Loaded Dice** and every other unmodelled
  item: they stay `no-op` rows.
- The other trapping moves (`block`, `meanlook`, `spiderweb`, `octolock`, `noretreat`) —
  they keep `trapped` and their shipped behaviour, except for the Ghost read in
  `isTrapped`.
- Damage on the **landing** turn: the trap pays from the following turn's residual, as
  the games do.
- Showdown's exact residual ordering inside the same slot (`binding` before or after
  Leech Seed on the same fighter) beyond the position pinned above.
- The partial trap's own `onTrapPokemon`/switch-block message, a "can't escape" log
  line, or a battle-screen animation.
- Any change to `BattleScene.ts`, to the AI's scoring, or to the multi-hit loop
  (Task-160's).
