# Spec: Task-153 — the engine accepts a second ability

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Read `AGENTS.md` (whole file) first, then this spec, and nothing else.

## 🎯 Scope

- **Task type:** engine rule (pure TypeScript, headless).
- **Role:** Dev.
- **Objective:** a `BattleFighter` can carry a **second ability** beside its primary
  one. After this task, `BattleFighter.secondAbility?: string` exists; the fighter
  factory, the battle snapshot and the save's fighter parser all preserve it; the
  effect dispatcher (`ownedEffects`) yields the handlers of **both** abilities; and
  every place in the battle engine that recognises an ability by comparing an id
  (`fighter.ability === 'Levitate'`) asks `hasAbility(fighter, id)` instead, so a
  granted second ability is never a silent no-op. `darkmatter` (the hand-authored
  row `Task-151` shipped) is the first ability this makes reachable in that slot.
- **Environment:** worktree `../wt-pkm-153` (absolute
  `/home/runner/work/pkm-randomlike/wt-pkm-153`), branch `task-153`, cut from
  `origin/main` @ `ebd3b24`. Install once with
  `npm ci --prefer-offline --no-audit --no-fund`; work only inside this worktree.
- **Dependencies (both already merged on `main`):** `Task-151` — the `darkmatter`
  row and its `onModifyEffectiveness` handler in
  `src/engine/battle/effects/abilities.ts`; `Task-150` — the team-type bonuses in
  `state.ts`/`damage.ts`/`turn.ts`, which is why those files are stable now.
  `Task-152` (`src/engine/run/history.ts`) is merged and irrelevant here.

### Exclusive paths (single writer)

Creates or modifies **only** these. No other task in the batch touches them
(`Task-155` holds `src/ui/hud/**`, `src/scenes/MainMenuScene.ts`, `src/i18n/**` and
`docs/design-spec.md`; nothing here).

- `src/engine/battle/fighter.ts` — the field, the helpers, the factory, the snapshot.
- `src/engine/battle/fighter.test.ts`
- `src/engine/battle/effects/registry.ts` — `ownedEffects`, `normalizeEffectId`.
- `src/engine/battle/effects/registry.test.ts`
- `src/engine/battle/effects/abilities.ts` — the id comparisons move to the helper.
- `src/engine/battle/effects/abilities.test.ts`
- `src/engine/battle/turn.ts` — its id comparisons move to the helper.
- `src/engine/battle/turn.test.ts`
- `src/engine/battle/state.ts`
- `src/engine/battle/status.ts` + `src/engine/battle/status.test.ts`
- `src/engine/battle/accuracy.ts` + `src/engine/battle/accuracy.test.ts`
- `src/engine/battle/preview.ts` + `src/engine/battle/preview.test.ts`
- `src/engine/battle/effects/items.ts` + `src/engine/battle/effects/items.test.ts`
- `src/engine/battle/effects/moves.ts` + `src/engine/battle/effects/moves.test.ts`
- `src/engine/battle/effects/weather.ts` + `src/engine/battle/effects/weather.test.ts`
- `src/engine/save.ts` — `parseFighter` accepts the optional snapshot field.
- `src/engine/save.test.ts`

No new file, no file renamed or deleted: `src/engine/README.md` needs no edit (its
`battle/` block lists file names, and none moves). Deleting a stray `.gitkeep` from
a directory this task populates is always allowed.

### Inputs (read-only)

- `src/engine/battle/damage.ts`, `src/engine/battle/effects/apply.ts`,
  `src/engine/battle/effects/conditions.ts`, `src/engine/battle/volatile.ts`,
  `src/engine/battle/harness.ts`, `src/engine/battle/golden.test.ts`,
  `src/engine/battle/randomAbility.ts`, `src/engine/battle/randomAbility.test.ts`.
- `src/data/dex/abilities.ts`, `src/data/dex/customAbilities.ts`,
  `src/data/dex/species.ts`.
- `src/engine/run/progression.ts` (`RunPokemon.secondAbility`, `memberAbilities`).
- `docs/battle-spec.md` §7 and its `D48` note, `docs/tech-decisions.md` (`D16`,
  `D48`), `docs/showdown-reuse.md` §3.

## 🔒 Contract

The public surface, exactly. Additions only: no existing export is renamed or
removed, and every existing call site keeps compiling unchanged.

### TypeScript

```ts
// src/engine/battle/fighter.ts

export type BattleFighter = {
  // …every field that exists today, unchanged…
  ability: string;
  /** The second ability a run grants beside the primary one, or absent. */
  secondAbility?: string;
  // …
};

export type FighterInput = {
  // …unchanged…
  ability?: string;
  secondAbility?: string;
  // …
};

export type FighterSnapshot = {
  // …unchanged…
  ability: string;
  /** Absent when the fighter has no second ability; never an empty string. */
  secondAbility?: string;
  // …
};

/** The one id normaliser: lowercase, every non `[a-z0-9]` dropped. */
export function normalizeAbilityId(id: string): string;

/** The fighter's abilities, primary first; the second only when it is set and differs. */
export function fighterAbilities(fighter: BattleFighter): readonly string[];

/** True when the fighter owns `id` in either slot, compared by `normalizeAbilityId`. */
export function hasAbility(fighter: BattleFighter, id: string): boolean;

export function createFighter(input: FighterInput): BattleFighter;
export function snapshotFighter(fighter: BattleFighter): FighterSnapshot;
export function restoreFighter(snapshot: FighterSnapshot): BattleFighter;
```

```ts
// src/engine/battle/effects/registry.ts

/** `Task-153`: the id normaliser now lives in `fighter.ts`; this delegates to it. */
export function normalizeEffectId(id: string): string;
```

- `normalizeEffectId` keeps its current behaviour byte-for-byte
  (`id.toLowerCase().replace(/[^a-z0-9]/g, '')`) and simply delegates, so there is
  one normaliser in the tree.
- **`createFighter`:** `secondAbility` is kept only when the input value is a string
  that, trimmed, is non-empty and whose `normalizeAbilityId` differs from the
  primary's; otherwise the field is **absent** on the returned object (never `''`,
  never a duplicate of the primary).
- **`fighterAbilities`:** `[ability]`, or `[ability, secondAbility]` when the second
  is set and differs after normalisation. Never returns `''` entries.
- **`hasAbility`:** true when either entry of `fighterAbilities` normalises to the
  normalised `id`. Case and punctuation do not matter: `hasAbility(f, 'darkmatter')`
  matches both `'darkmatter'` and `'Dark Matter'`.
- **`snapshotFighter` / `restoreFighter`:** the field round-trips: a fighter created
  with a second ability snapshots it and restores it; a fighter without one
  snapshots **no** key.
- **`save.ts` / `parseFighter`:** reads `secondAbility` from the stored record when
  it is a non-empty string whose normalised id differs from `ability`'s; otherwise
  the field is dropped and **the member is kept** (the `statTreats` / `nickname`
  tolerance idiom). No `SAVE_VERSION` step: the field is optional additive data and
  an old document simply has none.
- **`ownedEffects`** (`registry.ts`): for a fighter it pushes **one ref per distinct
  ability effect id**, both with `owner: fighter` (dedupe by `effect.id` after
  `normalizeEffectId`, so two slots naming the same row dispatch once). The
  `warnUnportedEffect('ability', id)` warning is evaluated **per slot**: a
  registered primary plus an unregistered second ability now warns (today it would
  stay silent). `abilityActive` / `gasSuppresses` and the Klutz check read both
  slots through `hasAbility`.
- **Ability-id comparisons:** every `x.ability === '<Id>'` / `!== '<Id>'` and every
  list-`includes` over an ability name in the claimed files becomes `hasAbility(...)`
  — that is the whole point of the task. The **identity** comparisons (two fighters'
  abilities compared with each other) and the copy/swap handlers are listed in
  **Out of scope** below and must be left exactly as they are.
- **Determinism:** this task draws **no** RNG, moves no damage number and changes no
  roll order. `src/engine/battle/golden.test.ts` must stay green with its inline log
  **byte-identical**; no fixed-seed expectation is re-pinned. `randomAbility`'s pool
  does not move (no ability row is added or removed).
- Rules: no Phaser import, no DOM, no `Math.random()`, no `Date.now()` in
  `src/engine/**`; no new dependency; allocation budget unchanged (the helper
  allocates only when the second slot is set).

### Data

No data file changes. `darkmatter` already ships in
`src/data/dex/customAbilities.ts` and is registered in `abilities.ts`; this task
changes **how** a registered row is dispatched, not which rows exist. Do **not**
regenerate `docs/balance/effect-coverage.md` and do **not** touch
`src/data/dex/**`: no id is added or removed, so the regenerated table would be
identical.

## 🧩 Data and configuration

None. The field's default is "absent" (one ability), which is what every existing
save, fixture and test already means.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm ci --prefer-offline --no-audit --no-fund` once, in the worktree.
  - `npm test` — Vitest, headless, must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-153` against the exclusive paths list above.
  - **Every criterion here is `[unit]`: this task owes no browser pass.**
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean (`npm run build`, exit 0).
  - [ ] `[unit]` The whole suite passes (`npm test`, exit 0) and the new tests exist:
    in `fighter.test.ts` (create → snapshot → restore with a second ability; absent
    when empty or equal to the primary), in `registry.test.ts` (both abilities'
    handlers dispatch; a duplicated id dispatches **once**; an unregistered second
    ability warns `[coverage] ability "Ball Fetch" has no ported effect (D16).`
    while the primary is registered), in `abilities.test.ts` and `turn.test.ts` (an
    effect that only exists in the second slot changes battle state), in
    `save.test.ts` (a valid `secondAbility` survives `parseFighter`; an empty string
    or a duplicate of `ability` is dropped and the member is kept).
  - [ ] `[unit]` **The effect fires from the second slot.** A battle built with
    `createBattle` where the player's fighter is `createFighter({ …, ability: 'Blaze',
    secondAbility: 'Intimidate' })` shows the enemy's `boosts.atk === -1` after
    switch-in (the `Intimidate` `onSwitchIn` handler ran from the second slot), and
    the same battle with only `Blaze` shows `0`. This is the task's headline test.
  - [ ] `[unit]` **The dispatcher accepts both.** `registry.test.ts` registers two
    effects and a fighter carrying both as primary/second, and asserts each
    `onSwitchIn` handler ran once with `ctx.owner === fighter` (`EffectRef.owner`),
    plus the dedupe case: primary and second naming the same row run it once.
  - [ ] `[unit]` **A second-slot check is honoured.** A `Pressure` second ability
    costs the foe's move 2 PP in `turn.test.ts` (today only the primary slot does);
    or, equivalently, a `Magic Guard` second ability blocks indirect damage. One such
    test is enough; name it in the dev's report.
  - [ ] `[unit]` **No id comparison is left un-helped.** Running
    `grep -rn "\.ability === '\|\.ability !== '" src/engine/battle src/engine/save.ts --include='*.ts' | grep -v '\.test\.ts'`
    returns **only** lines in the Out-of-scope list below (copy/swap/trace identity
    and list-`includes` sites the spec does not require). QA copies the remaining
    lines into its report and checks each one is on that list.
  - [ ] `[unit]` `src/engine/battle/golden.test.ts` is green with the log unchanged
    (the dev must not edit it), and `randomAbility.test.ts`'s fixed-seed pins are
    untouched.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched — in particular no
    `src/data/dex/**`, no generated table, no `docs/**`.

## 📣 Coordination

- **For Task-154 (next batch, the dark Pokémon):** the carrier is
  `FighterSnapshot.secondAbility` (`src/engine/battle/fighter.ts`), and
  `parseFighter` already preserves it. Nothing in **production** sets it yet: the
  run already stores `RunPokemon.secondAbility` (`src/engine/run/progression.ts`,
  `save.ts`), so that task must copy it into the member's fighter snapshot (or the
  battle launch) and is the one that makes the slot reachable in a real battle. Do
  not do that plumbing here.
- **For the batch:** Task-155 shares no path with this task; the merge order is
  Task-153 then Task-155.
- **For the plan:** no `SAVE_VERSION` step (an optional snapshot field with a
  tolerant parser, no migration).
- **For QA:** the `[coverage]` warning is dev-only (`IS_DEVELOP`) and its text is
  pinned by `randomAbility.test.ts:271-297`; do not change that string.

## ⛔ Out of scope

- **Ability copy/swap semantics stay on the primary slot.** `Trace`, `Role Play`,
  `Doodle`, `Entrainment`, `Skill Swap`, `Wandering Spirit`, `Mummy`,
  `Lingering Aroma`, `Transform`, `changeBattleForm` / `restoreBattleForm` and the
  `TransformBackup` / `MegaBackup` copies keep reading and writing
  `fighter.ability` exactly as today, and their identity comparisons
  (`a.ability === b.ability`) stay as they are. Copying **both** slots is a later
  decision and is not modelled here.
- No run/UI plumbing: `src/engine/run/battleLink.ts`, `src/scenes/BattleScene.ts`,
  `src/engine/run/resolve.ts`, the member panel that would show both abilities
  (`Task-154`).
- No new ability row, no change to `randomAbilityPool()`, no regeneration of
  `docs/balance/effect-coverage.md` or `src/data/moveCoverage.json`.
- No change to damage numbers, status odds, ordering or any RNG draw.
