# Spec: Task-151 — The custom ability row: `darkmatter`

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** data + engine rule (pure TypeScript, no Phaser).
- **Role:** Dev.
- **Objective:** the game owns an ability the generated Gen 9 dex does not carry, and
  the whole pipeline accepts it. `src/data/dex/customAbilities.ts` hand-authors
  **`darkmatter`** (EN *Dark Matter*, ES *Materia Oscura*): the holder's moves ignore
  the type chart. `getAbility('darkmatter')` resolves that row, the effect registry
  registers its `onModifyEffectiveness` handler (it returns `1`; `turn.ts` already
  dispatches it before the chart is applied), the random-ability pool therefore
  includes it, and `meta.json` counts it. `docs/data-spec.md` gets its line and
  `docs/balance/effect-coverage.md` is regenerated with `npm run docs:coverage`.
- **Environment:** worktree `../wt-pkm-151`, branch `task-151`.
- **Dependencies:** none.

### Exclusive paths (single writer)

- `src/data/dex/customAbilities.ts` *(new)*
- `src/data/dex/abilities.ts`
- `src/data/dex/meta.json`
- `src/data/dex/README.md` *(the folder map: this task adds a file, so it updates it —
  one role line for `customAbilities.ts`; `AGENTS.md` requires it in the same task)*
- `src/engine/battle/effects/abilities.ts`
- `src/engine/battle/randomAbility.test.ts`
- `src/i18n/content.ts`
- `docs/data-spec.md`
- `docs/balance/effect-coverage.md` *(regenerated, never hand-edited)*

Nothing else. **`src/data/dex/abilities.json` is not yours** — it stays exactly as
`npm run data:dex` writes it. Never edit it.

### Inputs (read-only)

- `src/data/dex/abilities.json` (the generated rows), `src/engine/battle/effects/registry.ts`
  (`EffectHandlers`, `ownedEffects`, `registerEffects`),
  `src/engine/battle/turn.ts` (where `runModifyEffectiveness` is dispatched),
  `src/engine/battle/randomAbility.ts` (`randomAbilityPool` — read it, do not edit it),
  `src/data/dex/abilities.test.ts` and `src/data/dex/dex.test.ts` (their invariants are
  binding; see below), `scripts/effect-coverage.mjs`.

## 🔒 Contract

### TypeScript

```ts
// src/data/dex/customAbilities.ts
import type { Ability } from './abilities';

/** A hand-authored ability row: the dex shape plus its Spanish copy. */
export type CustomAbility = Ability & Readonly<{
  nameEs: string;
  descEs: string;
  shortDescEs: string;
}>;

/** The abilities the generated dex does not carry. One today. */
export const CUSTOM_ABILITIES: readonly CustomAbility[];
```

The one row, verbatim:

| field | value |
|---|---|
| `id` | `darkmatter` |
| `name` | `Dark Matter` |
| `desc` | `The holder's moves ignore the type chart: no weaknesses, no resistances, no immunities.` |
| `shortDesc` | `The holder's moves ignore the type chart.` |
| `nameEs` | `Materia Oscura` |
| `descEs` | `Los movimientos de quien la posee ignoran la tabla de tipos: sin debilidades, sin resistencias ni inmunidades.` |
| `shortDescEs` | `Los movimientos de quien la posee ignoran la tabla de tipos.` |

```ts
// src/data/dex/abilities.ts — the existing accessors keep their meaning
export function getAbility(id: string): Ability | undefined;      // generated, then custom
export function allAbilities(): readonly Ability[];              // the GENERATED set only
export function allAbilitiesWithCustom(): readonly Ability[];    // generated + custom
export function getCustomAbility(id: string): CustomAbility | undefined;

// src/engine/battle/effects/abilities.ts
// `ABILITIES` gains ['darkmatter', darkmatter()], where the handler is
// onModifyEffectiveness: (ctx) => (ctx.owner === ctx.source ? 1 : undefined)
```

- **`allAbilities()` must keep returning exactly the generated rows (311).** Two
  tests in this repo depend on it and neither is yours to edit:
  `src/data/dex/dex.test.ts` asserts `abilitiesData.length === counts.abilities` and
  `src/data/dex/abilities.test.ts` asserts `allAbilities().length === counts.abilities`;
  `src/i18n/content.test.ts` (another task's file) asserts
  `meta.abilities.total === allAbilities().length` against the **i18n** table's 311.
  Growing `allAbilities()` breaks all three at once. So the custom row joins at
  **lookup** (`getAbility`) and in the explicit `allAbilitiesWithCustom()`.
- **`counts.abilities` in `src/data/dex/meta.json` stays `311`** (it counts generated
  rows). The custom row is counted by a new sibling key:
  `"customAbilities": 1` inside `counts`. `dex.test.ts` reads only the keys it names,
  so the extra key is safe.
- **`getAbility`** must normalise the id the way it does today
  (`toLowerCase().replace(/[^a-z0-9]/g, '')`) and must let the generated row win if an
  id ever appears in both, so a future `data:dex` run cannot silently shadow the
  custom one. Test that precedence with a stub, not by editing `abilities.json`.
- **The pool:** `randomAbilityPool()` iterates `registeredEffects()` and maps each id
  through `getAbility`, so registering the handler is what puts `darkmatter` in the
  pool — no change to `randomAbility.ts`, which is not in your paths. Because the pool
  is sorted by id and grows by one, **every random ability draw moves**: the fixed-seed
  regression in `src/engine/battle/randomAbility.test.ts` is **re-pinned in this task**
  and no other seed anywhere else may be re-pinned (if another suite goes red on a
  seed, that is a real regression, not a re-pin).
- **`src/i18n/content.ts`** gains the ES copy for the custom row only:
  `abilityName`, `abilityDescription` (and the `FromEnglish` variants) fall back to the
  row's `nameEs`/`descEs`/`shortDescEs` when the locale is `es`. English behaviour is
  untouched. Do not touch `MISSING_ES`, the `MISSING_NAMES` set, or the i18n tables.
- **Determinism:** the handler reads no RNG. `turn.ts` is **read-only** for you.
- Rules: no Phaser, no DOM, no new dependency. `onModifyEffectiveness` returns `1` for
  any move while the holder is the attacker — that is the whole rule (it also pierces
  a 0× immunity, which is intended).

### Data

`meta.json` after the task:

```json
"counts": { "species": 1281, "megas": 89, "gmaxes": 34, "moves": 835,
            "abilities": 311, "items": 249, "learnsets": 1280, "natures": 25,
            "types": 19, "customAbilities": 1 }
```

## 🧩 Data and configuration

One row, one handler, one count. No balance number changes and no run field.

## 🧪 Test and Validation Plan (for QA)

All criteria are `[unit]`. **No browser pass is owed** — nothing renders this ability
until `[Task-154]` puts a dark Pokémon in a party.

- **Method:**
  - `npm test` — Vitest, headless. **The whole suite**, because the pool change can
    move a draw anywhere.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `npm run docs:coverage` — must leave `docs/balance/effect-coverage.md` changed
    only by `darkmatter`'s new row (rerun it and confirm it is idempotent).
  - `git diff --name-only main...task-151` against the exclusive paths.
  - `git diff main...task-151 -- src/data/dex/abilities.json` must be **empty**.

### Acceptance criteria

- [ ] `[unit]` `npm run build` is clean.
- [ ] `[unit]` `npm test` is green with the re-pinned random-ability seed, and
      `randomAbilityPool().map(a => a.id)` contains `darkmatter` exactly once.
- [ ] `[unit]` `getAbility('darkmatter')` returns the row above; `getAbility('Dark Matter')`
      resolves to the same id (punctuation/space normalisation).
- [ ] `[unit]` `allAbilities().length` is `311` and equals `meta.counts.abilities`;
      `allAbilitiesWithCustom().length` is `312`; `meta.counts.customAbilities` is `1`.
- [ ] `[unit]` A battle test proves the effect fires: a fighter with
      `ability: 'darkmatter'` hits a defender that would resist or be immune
      (e.g. a Normal move into a Ghost), and the resulting `effectiveness` /
      `damage` is the neutral `1` figure, while the same move from the same fighter
      with a different ability is 0× / resisted.
- [ ] `[unit]` `src/i18n/content.test.ts` (run it, never edit it) is still green: the
      i18n table's `total`/`named` (311) still equal `allAbilities().length`.
- [ ] `[unit]` `dex.test.ts` and `abilities.test.ts` are green **unmodified**.
- [ ] `[unit]` `docs/data-spec.md` names `customAbilities.ts` and `darkmatter`;
      `docs/balance/effect-coverage.md` carries `darkmatter` as `port`.
- [ ] `[unit]` `src/data/dex/README.md` lists `customAbilities.ts`.
- [ ] `[unit]` `git diff --name-only main...task-151` lists only the exclusive paths,
      and `abilities.json` is untouched.

## 📣 Coordination

- For the Architect: the custom row's Spanish copy lives **in its own file**, not in
  `src/data/i18n/es/abilities.json`, because that table is `[Task-149]`'s exclusive
  path and its `total`/`named` (311) are asserted against `allAbilities()`. If a later
  task wants the custom row in the i18n table, it must move the row **and** bump the
  i18n counts **and** the `content.test.ts` invariant in one task.
- For `[Task-153]`: `ownedEffects` (`effects/registry.ts`) is where the second ability
  slot must add `getEffect(fighter.secondAbility)`; `darkmatter` is a normal registry
  id and needs nothing special there.
- For `[Task-154]`: a dark member's `ability` is the string `darkmatter` (registry id
  and dex id are the same) and its panel copy reads through `abilityName('darkmatter')`
  → *Materia Oscura* in `es`, *Dark Matter* in `en`.
- For the Architect: `scripts/build-dex.mjs` does not know about custom rows; the
  accessor is the merge point, so a regeneration never loses it.

## ⛔ Out of scope

- Editing `src/data/dex/abilities.json` or any other generated JSON by hand.
- A second custom ability, or a `darkmatter` UI/sprite.
- Changing `src/engine/battle/randomAbility.ts`, `turn.ts`, or any seed outside
  `randomAbility.test.ts`.
- The run's dark flag (`[Task-154]`) and the second ability slot (`[Task-153]`).
