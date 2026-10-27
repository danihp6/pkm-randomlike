# Spec: Task-182 — The launch fills the team-type bonuses

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule + Phaser wiring + docs.
- **Role:** Dev.
- **Objective:** after this task a battle launched from the route carries the
  player's **living party's repeated types** into `BattleState.teamTypes`, so the
  shipped `+10 %` damage and `+20` status-chance rule fires for the first time in a
  real game. Today `BattleSetup.teamTypes` exists and the engine halves in
  `src/engine/battle/damage.ts` and `src/engine/battle/turn.ts` read it, but
  **nothing ever fills it**: `BattleLaunch` has no such field, so every battle runs
  with `[]`.
- **Environment:** repository `/home/runner/work/pkm-randomlike/pkm-randomlike`,
  worktree `../wt-pkm-182`, branch `task-182`. Work only inside the worktree.
- **Dependencies:** none. `memberTypes` (`src/engine/run/party.ts`) and the two
  engine halves already ship; this task only adds the missing source and the two
  places that carry it.

### Exclusive paths (single writer)

Nothing outside this list:

- `src/engine/run/party.ts` and `src/engine/run/party.test.ts`
- `src/engine/run/battleLink.ts` and `src/engine/run/battleLink.test.ts`
- `src/scenes/RouteScene.ts`
- `src/scenes/BattleScene.ts`
- `docs/battle-spec.md` — **section 13 only** (`## 13. The four team-type bonuses`)

No other file. Do not touch `package.json`, `src/main.ts`, `docs/design-spec.md`,
`src/i18n/**`, `src/data/**` or anything under `src/ui/**`.

### Inputs (read-only)

- `AGENTS.md`
- `src/engine/run/state.ts`, `src/engine/run/progression.ts` (the `RunPokemon` shape)
- `src/engine/battle/state.ts` (`BattleSetup.teamTypes`, `BattleState.teamTypes`)
- `src/engine/battle/damage.ts`, `src/engine/battle/turn.ts` (the shipped rule)
- `design/fixtures/*` (nothing to edit)

## 🔒 Contract

### TypeScript

In `src/engine/run/party.ts` (pure module: no Phaser, no DOM, no RNG, no mutation):

```ts
/**
 * The types the player's **living** party repeats: a type is listed when at least
 * two members whose `fighter.hp > 0` share it, in party order, deduped. A fainted
 * member contributes nothing; the box is never read. `[]` for an empty party.
 */
export function livingTeamTypes(run: RunState): readonly string[];
```

Rules that follow from `docs/battle-spec.md` §13 and must be honoured:

- Only `run.party` is read — **never** `run.box`, never `run.rip`.
- A member counts only while `member.fighter.hp > 0`.
- A type needs **two** living holders. One living Water member lists nothing.
- Order is the party order of the **first** member holding the type; duplicates
  collapse. Two Fire (living) + one Water (living) + one Fire at 0 HP → `['Fire']`.
- Types come from `memberTypes(member)` (the species' own types); an unknown
  species id contributes none.

In `src/engine/run/battleLink.ts`:

```ts
export type BattleLaunch = Readonly<{
  // …every existing field unchanged…
  /**
   * The player's living party's repeated types (at least two living members each),
   * computed by the route through `livingTeamTypes`. Absent means none.
   */
  teamTypes?: readonly string[];
}>;

/** The team-type list a launch carries into the battle: absent means none. */
export function launchTeamTypes(launch: Pick<BattleLaunch, 'teamTypes'>): readonly string[];
```

- `launchTeamTypes` returns `launch.teamTypes ?? []` and never mutates or copies a
  present list beyond returning it.

In `src/scenes/RouteScene.ts`, the launch object inside `private startBattle(...)`
(around line 3479) gains `teamTypes: livingTeamTypes(this.run)` — in the same
literal as `player`/`xp`, with one short comment naming the rule. This is the
**only** construction site of `BattleLaunch` for a real battle, so it covers wild,
trainer, boss, mini-boss, double and dev battles alike.

In `src/scenes/BattleScene.ts`, `create()` (around line 811) passes
`teamTypes: launchTeamTypes(launch)` into `createBattle({...})`, beside
`bannedSpecies`/`noHeal`. The enemy side is never given the list.

**Determinism:** nothing here draws RNG. The list is a pure function of the run's
party, so a given seed keeps reproducing the same battle (D11) — the same party
always carries the same list.

### Data

No new data keys, no new file, no balance number. `TEAM_TYPE_DAMAGE` (`1.1`) and
`TEAM_TYPE_STATUS_BONUS` (`20`) stay as they are.

## 🧩 Data and configuration

Nothing to configure. The threshold (two living members) is the shipped rule and
lives in the function's comment, not in a table.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task
    adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-182` against the exclusive paths above.
  - Every criterion here is `[unit]`: this task adds no visual rule, so it owes
    **no** browser pass. The `[live]` the backlog entry carried is deliberately
    dropped (see Coordination) because the rule it would observe already ships and
    is pinned in `src/engine/battle/{damage,turn}.test.ts`; the missing half is a
    data path.
- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` typechecks and builds clean.
  - [ ] `[unit]` `livingTeamTypes` on a party of two living Fire, one living Water
        and one **fainted** Fire returns exactly `['Fire']` (`toEqual`, order
        included).
  - [ ] `[unit]` the same party with a second living Water returns
        `['Fire', 'Water']` in that order; a party of one living Fire and one
        living Water returns `[]`.
  - [ ] `[unit]` a dead member is invisible: the same Fire-only party with one Fire
        at `hp: 0` returns `[]`.
  - [ ] `[unit]` the box is never read: a party with one Fire and a **box** holding
        a second Fire returns `[]`.
  - [ ] `[unit]` an unknown species id contributes no type and does not throw.
  - [ ] `[unit]` `launchTeamTypes({})` is `[]` and `launchTeamTypes({ teamTypes:
        ['Fire'] })` is `['Fire']`.
  - [ ] `[unit]` the diff shows exactly two wiring lines: `RouteScene.startBattle`
        passes `teamTypes: livingTeamTypes(this.run)` in its launch literal, and
        `BattleScene.create` passes `teamTypes: launchTeamTypes(launch)` into
        `createBattle`. Both are in an existing object literal; neither adds a
        branch, a copy or a new call site elsewhere.
  - [ ] `[unit]` `git diff --name-only main...task-182` lists only the exclusive
        paths, and `git diff main...task-182 -- src/engine/` contains no `phaser`,
        no `window`, no `document`, no `Math.random`, no `Date.now`.
  - [ ] `[unit]` `docs/battle-spec.md` §13 no longer says the launch is "a
        follow-up": it states the launch fills the list from the **living** party,
        that a type needs two living holders, that a fainted member contributes
        nothing, that the box is not read, and that the double battle reads the same
        list. No other section of that file changes.

## 📣 Coordination

- **For the Architect — one correction to the backlog entry.** The entry's example
  expects `['Fire','Water']` from two living Fire + one living Water + one fainted
  Fire. That contradicts `docs/battle-spec.md` §13 ("a type is listed when **two
  living members** share it") and `BattleState.teamTypes`' own comment ("the
  player's repeated party types"): listing a single Water member would hand a
  three-member party up to six bonuses. This spec follows the documented rule and
  pins `['Fire']` for that party, with the fainted-Fire exclusion and the
  one-Water exclusion each tested on its own. `TODO.md`'s `[Task-182]` entry should
  be corrected the same way when it is archived into `CHANGELOG.md`.
- **For the next batch:** `src/engine/run/battleLink.ts` and
  `src/scenes/BattleScene.ts` now carry `teamTypes`/`launchTeamTypes`. `[Task-181]`
  (Batch 83) also claims `battleLink.ts` (its `BattleReturn.tallies`) and
  `BattleScene.ts` (`returnToRoute`); its spec is written after this merge, against
  that state, and must not rewrite `launchTeamTypes`.
- **Path note:** the entry listed only `party.ts`, `RouteScene.ts` and the §13 doc.
  A launch field lives in `battleLink.ts` and the `BattleSetup` is built in
  `BattleScene.ts`, so both are claimed here; no other task in this batch holds
  either file.

## ⛔ Out of scope

- Do not change the damage or status formulas, their constants, or their tests.
- Do not add a UI row, a debug readout or a `window` hook for the team types.
- Do not give the enemy side the bonus.
- Do not touch `src/engine/battle/state.ts` (the field and its default `[]` ship).
- Do not reformat files you touch; no Prettier sweep.

## 📦 Delivery protocol (read this last, then execute it)

1. `npm ci --prefer-offline --no-audit --no-fund` once in the worktree (a fresh
   worktree has no `node_modules`; never junction or copy one in).
2. Implement, then run `npm test` and `npm run build` in the worktree. Both must be
   green before you commit anything.
3. Commit in English, imperative, one logical change per commit; update
   `src/engine/run/README.md` only if you add or remove a file (this task adds
   none).
4. Leave the branch tip as an **empty** commit so the Orchestrator can see you
   finished:
   `git commit --allow-empty -m "dev: done task-182"`, then
   `git push origin task-182`.
5. Report: what you changed per file, the two gate results, and the exact
   `git rev-parse HEAD` sha of the tip you pushed. If a gate is red and you cannot
   fix it, say so plainly and do not push a `dev: done`.
