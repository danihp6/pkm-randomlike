# Spec: Task-230 — Imposter copies the rival's sprite instead of leaving the placeholder

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene + engine effect handler.
- **Role:** Dev.
- **Objective:** a battle draws **both** sprite kinds for every species in play, and a
  successful transform tells the screen about it, so a foe that copies the player's
  Pokémon through **Imposter** (or the **Transform** move) is drawn with the copied
  species' own sheet on the frame the transform lands, instead of keeping the
  placeholder texture `battle:mon` that `BootScene` gives every monster sprite
  (`src/scenes/BootScene.ts` 91, 302). A species the shipped manifest does not name
  keeps the placeholder **on purpose** — that fallback stays and is documented.
- **Environment:** worktree `../wt-pkm-230`, branch `task-230`.
- **Dependencies:** none. Everything this task reads is already on `main`.

### Exclusive paths (single writer)

Nothing outside this list may be created or modified.

- `src/scenes/BattleScene.ts`
- `src/scenes/BattleScene.test.ts`
- `src/engine/battle/effects/abilities.ts`
- `src/engine/battle/effects/abilities.test.ts`
- `src/engine/battle/effects/moves.ts`
- `src/engine/battle/effects/moves.test.ts`
- `src/engine/battle/moveAudit.ts` — **the `transform` row only**: the coverage table
  pins the events each audited move emits, so that one row's `events` list gains
  `'forme'` when the Transform handler starts emitting it. No other row, no other
  edit in that file.
- `docs/battle-spec.md` (**§7 only** — the file's other sections are not yours)
- `docs/art-direction.md` (**§Sprite contract only**)

No file is added or deleted, so no folder `README.md` changes: both test files exist
today (`src/engine/battle/effects/abilities.test.ts`,
`src/engine/battle/effects/moves.test.ts`, `src/scenes/BattleScene.test.ts`).

### Inputs (read-only)

- `docs/battle-spec.md` §7 (what a transform is), §9 (the `mega` event precedent).
- `docs/art-direction.md` §"Pokémon battle sprites (Pokémon Añil, local only)".
- `src/engine/battle/fighter.ts` (`transformInto` 758-784, `restoreOriginalForm`
  787-798 — **read only, do not edit**), `src/engine/battle/state.ts` (`BattleEvent`
  130-155, `pushEvent` 436, `pushText` 440).
- `src/scenes/BattleScene.ts` (`battleSheets` 1405-1429, `preload`'s 507 loop,
  `applyEvents`' `forme` case 1123-1131, `syncMonSprites` 1457-1466, `showMon`
  1474-1520), `src/scenes/BootScene.ts` (`BATTLE_MON_TEXTURE_KEY`).
- `src/data/pokemonSprites.ts` (`pokemonSprite`, `PokemonSpriteSheet`,
  `pokemonIdleAnimKey`).
- `src/engine/battle/harness.ts` (`scriptedBattle`) and one existing user of it
  (`src/ui/hud/panels/battle-log/view.test.ts`) as the fixed-seed pattern.

No `design/screens/<slug>.json` / `design/exports/<slug>.png` input applies: this task
moves no rect, adds no panel and changes no layout, so there is no board frame to read
(`D57`).

## 🔒 Contract

### TypeScript

No new exported name is required, and no existing exported signature changes.

- `private battleSheets(): PokemonSpriteSheet[]` in `src/scenes/BattleScene.ts` keeps
  its signature and its de-duplication by `textureKey`, and **gains the other kind**:
  for every fighter in play — the player's whole party and the enemy's whole party,
  not only the actives — it loads `front` **and** `back` sheets of
  `fighter.speciesId`, plus both kinds of the held-Mega forme and the G-Max forme the
  two existing arms already add. A species both sides field loads **once per kind**
  (the `Map` keyed by `textureKey` keeps that promise).
- The transform reports itself on the **existing** event
  `Readonly<{ kind: 'forme'; side: SideId; fighterId: string }>`
  (`src/engine/battle/state.ts` 146), pushed with `pushEvent(ctx.state, …)` **after**
  `transformInto(...)` returned `true`, in both call sites that exist today:
  - the Imposter `onSwitchIn` handler (`src/engine/battle/effects/abilities.ts`
    2117-2130),
  - the Transform move handler (`src/engine/battle/effects/moves.ts` 232-238).
  Push exactly one event per successful transform, carrying `ctx.side` and
  `ctx.owner.id`; do **not** push it when `transformInto` answers `false`. The scene
  already handles that event (`setDisplayFighter` + `syncMonSprites`), so no new scene
  case is needed — verify it and leave it alone if it already re-syncs.
- `transformInto` and `restoreOriginalForm` keep their signatures and their shape
  logic: a switch-out restores the original species and the switch frame's own
  `syncMonSprites` redraws it. Do not add a second restore path.

- **Determinism:** this task reads **no** RNG and adds no draw. The roll that gave a
  wild Ditto its ability is `randomAbility` in the fighter builder and stays untouched.
- No Phaser import may enter `src/engine/`; the effect handlers stay pure and keep
  receiving `ctx.state`.

### Data

No new JSON key, no balancing value, no generated file. `src/data/dex/**` is never
hand-edited and `npm run data:dex` is not run.

## 🧩 Data and configuration

None. The only new facts are the two docs paragraphs named under **Docs** below.

## 🧪 Test and Validation Plan (for QA)

- **Method:** QA builds a per-task integration worktree (`qa-230`: `origin/task-230`
  merged onto the batch base), runs `npm ci --prefer-offline --no-audit --no-fund`
  once, then:
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only origin/main...task-230` against the exclusive paths above.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean (`npm run build` exit 0).
  - [ ] `[unit]` `npm test` is green and the new tests below exist and pass.
  - [ ] `[unit]` Nothing outside the exclusive paths list was touched by
        `git diff --name-only origin/main...task-230` (the `.agent_specs/task-230.md`
        commit is expected and excluded, as are `TODO.md`/`CHANGELOG.md`, which the
        Orchestrator owns).
  - [ ] `[unit]` **The preload covers both kinds.** `src/scenes/BattleScene.test.ts`
        gains an assertion reading `src/scenes/BattleScene.ts` as source — the seam
        style that file already uses for `returnToRoute` and the command card — that
        pins `battleSheets`' fighter arm to add **both** `'front'` and `'back'` for
        every fighter (one `add(…, 'back')` and one `add(…, 'front')` per fighter, or
        one loop over the two kinds), and that the two forme arms (Mega stone, G-Max)
        still add their sheet. A test that only greps for the word `battleSheets` does
        not satisfy this criterion.
  - [ ] `[unit]` **Imposter reports the transform.** In
        `src/engine/battle/effects/abilities.test.ts`, a battle whose enemy lead is
        **Ditto with `ability: 'Imposter'`** (a provided ability is trusted as-is —
        `resolveAbility`, `src/engine/battle/fighter.ts` 517-529) against a player
        lead of **Charmander** pushes, from the switch-in, exactly one
        `{ kind: 'forme', side: 'enemy', fighterId: <the Ditto's id> }` event, and the
        enemy fighter's `speciesId` is `charmander` afterwards. A second case with an
        ability that transforms nothing (e.g. `Limber`) pushes **no** `forme` event;
        a third case where the foe is already fainted pushes none either.
  - [ ] `[unit]` **The Transform move reports it too.**
        `src/engine/battle/effects/moves.test.ts` pins the same single `forme` event
        after the Transform move lands, with `ctx.owner.id` as `fighterId`.
  - [ ] `[unit]` **A fixed-seed scripted battle pins the order.** With a pinned seed,
        a `scriptedBattle` (`src/engine/battle/harness.ts`) that runs the Imposter
        switch-in answers the `forme` event **immediately after** the transform's
        `battle.log.move.transform` text entry, with no event between them.
  - [ ] `[unit]` **The manifest gap is named, not fixed.** A species id the shipped
        manifest does not name still resolves to no sheet (`pokemonSprite(...) ===
        null` in the existing API contract), so `showMon` keeps its early return
        and `battle:mon` stays drawn for it. Pin that in one assertion (it is the
        documented fallback, not a bug).
  - [ ] `[unit]` **The coverage ledger follows the event.**
        `src/engine/battle/moveAudit.ts`'s `transform` row lists
        `events: ['move', 'forme']` and no other row moved; `npm test`'s
        `moveAudit.test.ts` is green with it.
  - [ ] `[live]` **The foe draws the copied species' front sheet.** Measured at
        1280×800 over CDP against `npm run dev` (dev mode, `IS_DEVELOP` true), reading
        the live Phaser objects — **not** a screenshot and **not** a pixel diff:
        1. Boot the game and start a run through the shipped starter pick, so the
           route scene holds a party with a known lead species.
        2. Reach the Phaser game from the page (`await import('/src/main.ts')` gives
           the exported `game`), then start a real wild battle through the shipped dev
           seam: `game.scene.getScene('Route').startDebugWildBattle('ditto', 20)`.
        3. The enemy fighter's ability is a seed roll. Read
           `game.scene.getScene('Battle').state.sides.enemy.party[0].ability`; if it is
           not `Imposter`, leave and relaunch the same call (the battle counter changes
           the key and therefore the seed) and **record how many launches it took**.
        4. On the frame after the switch-in, with the battle's own scene live in
           `state.sides.enemy.party[0].speciesId === 'charmander'` (the player lead's
           id), read the foe sprite's `texture.key`.
        **PASS** when that key equals
        `pokemonSprite(<player lead species id>, 'front').textureKey` from
        `src/data/pokemonSprites.ts` and is **not** `battle:mon`; **and** the same read
        on a launch whose foe did **not** roll `Imposter` is that foe's own `front` key
        (the transform is what moves it, not the preload). Report the ability, the
        launch count, both texture keys and that the composite sprite is visible
        (`sprite.visible === true`). A red result must say which key was drawn.
- **Browser budget:** exactly one `[live]` criterion; the rest is headless.

## 📣 Coordination

- For the next batch: `src/scenes/BattleScene.ts` is claimed again by `[Task-235]`
  (Batch 104), which is why this task goes first; nothing else here is contended.
- For the scene's other readers: the preload now loads up to twice as many textures
  per battle (both kinds for both parties). `releaseMonSprites` (1468-1475) already
  walks `loadedSheets`, so the teardown needs no change — say in your report whether
  the frame count of a real battle moved in any way (it must not).

## ⛔ Out of scope

- Do **not** touch `src/engine/battle/fighter.ts`: the transform's shape logic is
  already correct, the copy of `speciesId` is what the screen resolves.
- Do **not** make the preload lazy (load a sheet when a transform happens): the sprite
  would be blank for a frame and the scene has no loading beat mid-battle. The whole
  point of §Art-direction's new paragraph is that it is eager and why.
- Do **not** add a sprite for a species the manifest does not name, do not pack art and
  do not run `npm run assets:pack` or `npm run data:anil`.
- Do **not** change the placeholder drawing in `BootScene`, the mon sizing
  (`battleSpriteHeight`), the animations or any rect.
- Do not touch `src/i18n/**`: the transform line already ships.
