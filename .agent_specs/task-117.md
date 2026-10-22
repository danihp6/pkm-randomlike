# Spec: Task-117 — Team Rocket is a special NPC who carries the slot machine, and the casino room retires

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene + engine/data + docs (a **move**, not a rewrite).
- **Role:** Dev.
- **Objective:** after this task the **casino is no longer a special room**. `'casino'`
  leaves `MapRoomSpecial`, `planMap` stops drawing its leaf, its room module and its
  boot texture leave `src/scenes/`, and the machine becomes the panel of a **Team Rocket
  NPC** found by the shipped per-NPC roll in a trainer room. The slot machine itself —
  the table, the spin, the three reels, the reveal, the floor lock, the Egg and the
  grunt battle — is **moved unchanged** into `src/ui/rocketPanel.ts`, and the only scene
  edit is the `case 'rocket'` in `chooseNpc` that opens it (the merchant's own shape).
- **Environment:** worktree `../wt-pkm-117`, branch `task-117`. Run
  `npm ci --prefer-offline --no-audit --no-fund` once before anything else.
- **Dependencies (already merged on `main`, read them, do not rebuild them):**
  - **Task-91** — `src/data/npcs.ts` (`NPC_ROWS`, `NpcRow`), `src/engine/routes/npcs.ts`
    (`roomNpc`, `effectiveNpcChance`, `guaranteedNpc`, `npcUseId`), `src/ui/npcPanel.ts`
    (the card shell), and the scene's `openNpcCard`/`chooseNpc`/`rollRoomNpc`.
  - **Task-115** — `src/data/casino.ts` (`CASINO`, `EGG_ITEM_ID`) and
    `src/ui/casino.ts` (`casinoSpin`, `casinoSpinId`, `casinoLockId`,
    `casinoGruntTrainerId`, `hatchEgg`).
  - **Task-116** — `src/ui/casinoReels.ts` (the geometry, the faces, the schedule) and
    the reveal that `src/scenes/rooms/casino.ts` currently runs.
  - **Task-92** — the merchant: the precedent that a room retires and its content
    becomes an NPC panel opened straight from `chooseNpc` (`openMart(this.roomHost())`).
  - **Task-90** — the `rocket` row of the packed overworld atlas
    (`src/data/overworldSprites.ts`'s `OVERWORLD_SPRITE_KEYS`) and
    `SPECIAL_ARCHETYPES`' `rocket` trainer (`src/data/trainers.ts`).

### Exclusive paths (single writer)

Nothing outside this list. (Each path is also nobody else's in this batch: the batch's
other member is `[Task-120]`, which holds `src/engine/battle/**` only.)

- `src/engine/maps/plan.ts`
- `src/engine/maps/plan.test.ts`
- `src/data/npcs.ts`
- `src/data/npcs.test.ts`
- `src/scenes/rooms/casino.ts` *(deleted)*
- `src/scenes/rooms/casino.test.ts` *(deleted)*
- `src/scenes/rooms/registry.test.ts` *(its casino fixture and shipped-kind list)*
- `src/scenes/rooms/README.md`
- `src/scenes/RouteScene.ts` *(one `case` and its import)*
- `src/scenes/BootScene.ts` *(the retired cabinet texture block only)*
- `src/ui/rocketPanel.ts` *(new — the `git mv` target)*
- `src/ui/rocketPanel.test.ts` *(new)*
- `src/ui/casino.ts` *(doc comment only — no behaviour change)*
- `src/ui/README.md`
- `docs/maps-spec.md` **§7 only**
- `docs/design-spec.md` **§7 only**
- `docs/routes-spec.md` **§2 only**
- `docs/tech-decisions.md` *(the `Task-90` addendum's one line only)*
- `docs/art-direction.md` *(the atlas line only)*
- `docs/balance/route-curve.md` *(the quiet-room list only)*

**Forbidden:** `src/i18n/**` (the `casino.*` keys stay and the NPC panel reuses them),
`src/data/casino.ts`, `src/ui/casinoReels.ts`, `src/engine/routes/npcs.ts`,
`src/ui/npcPanel.ts`, `src/ui/mapView.ts` (it needs **no** edit: `MapRoomMarker` is an
alias of `MapRoomSpecial` and the scene draws a marker through the registry's
`byMarker` lookup), `src/engine/battle/**`, and every other `src/scenes/rooms/*.ts`.

### Inputs (read-only)

- `docs/maps-spec.md` §7, `docs/design-spec.md` §7, `docs/routes-spec.md` §2,
  `docs/tech-decisions.md` (`D33`, `D47`), `docs/art-direction.md`.
- `src/engine/maps/plan.ts` (`MapRoomSpecial`, `CASINO_CHANCE`, `CASINO_FROM_MAP`,
  `planMap`'s special pass, `specialRoom`), `src/engine/maps/plan.test.ts`.
- `src/data/npcs.ts`, `src/engine/routes/npcs.ts`, `src/ui/npcPanel.ts`.
- `src/scenes/rooms/casino.ts` (the module being moved), `src/ui/casino.ts`,
  `src/ui/casinoReels.ts`, `src/scenes/rooms/shop.ts` (`openMart`, the shape a
  panel-only module takes), `src/scenes/rooms/types.ts` (`RoomHost`, `RoomPanel`).
- `src/scenes/RouteScene.ts` (`openNpcCard`, `chooseNpc`, `roomHost`, `this.npc`).

## 🔒 Contract

### TypeScript

```ts
// src/ui/rocketPanel.ts — the moved machine. One entry point, the Mart's shape.
export function openRocket(host: RoomHost, tile: Tile): void;
```

- `tile` is the **NPC's own tile** (`RoomNpc.tile`, `RouteScene` 702), which replaces the
  retired `machineOf(host)`/`host.counterTile()` read. Everything else the module draws
  keeps its current geometry: the 460×220 card, the three reels, `SPIN`/`LEAVE`, the
  money line and the message line.
- The grunt battle is built **at `tile`** by the module's own `gruntFor`, unchanged in
  every field except its position:
  `{ id: casinoGruntTrainerId(host.view.mapIndex), position: tile,
     facing: host.facingFromTo(tile, host.entryTile()), sight: DEFAULT_TRAINER_SIGHT,
     archetypeId: 'rocket' }`, started through `host.startTrainerBattle(...)`.
- The panel is **modal** and owns the keyboard exactly as it does today
  (`host.releaseHudKeyboard()`, `host.openPanel(PANEL)`, `close()` destroys every
  timer, mask and the root).
- **No behaviour change** in the machine: `casinoSpin`, its marks, the price table, the
  lock, the Egg and the reveal are untouched — this task **moves** them.

```ts
// src/data/npcs.ts — one new row, in table order after the merchant's block.
{
  id: 'rocket',
  nameKey: 'casino.title',      // the machine's own existing key; i18n is untouched
  greetingKey: 'casino.controls',
  spriteKey: 'rocket',          // a key of OVERWORLD_SPRITE_KEYS
  chance: 0,
  floorStep: 0.03,
  repeatable: true,
}
```

- `effectiveNpcChance` (`src/engine/routes/npcs.ts`) reads `0 + 0.03 * (mapIndex - 1)`:
  **0 on map 1** (a zero weight is left out of the roll, the merchant's own filter), 3 %
  per trainer room on map 2 rising to 21 % on map 8. With
  `TRAINER_ROOMS_PER_MAP` = 2,2,3,3,3,4,4,4 that is ≈ 6 % of floors at map 2 and ≈ 61 %
  at map 8 (≈ 2.3 spins a run against the 30 % leaf's 2.1). **Re-measure it**: the row is
  read through Task-91's presence roll, so write the measured figure in the commit body
  instead of copying this one.
- `repeatable: true` — the panel writes **no** per-NPC use mark, because the machine's
  own `casino-spin-*`/`casino-lock-*` marks are the record, so a revisit can spin again
  until the floor's lock.
- The row needs **no** `requires`, no `choices`, no `grant` and no `battle`: the machine
  is its panel and its own model decides the fight.

### Engine

- `MapRoomSpecial` loses `'casino'`; `CASINO_CHANCE` and `CASINO_FROM_MAP` leave
  `plan.ts`; `planMap`'s special pass runs **shop → mini-boss → mega-stone → gated →
  trade → no-heal** (plus the later minted streams, untouched). Everything drawn
  **before** the casino's slot — the shop, the mini-boss, the mega-stone, every regular
  room, room id and size — stays put; the leaves drawn **after** it consume the values
  the casino took, so their presence and parents move for a fixed seed and are
  **re-pinned**.
- `src/scenes/rooms/registry.ts` is untouched: it collects descriptors, and the casino's
  descriptor leaves with its module.

### Scene

- `chooseNpc` gains **one** case beside the merchant's:
  `case 'rocket': this.closePanel(); openRocket(this.roomHost(), this.npc!.tile); return;`
  (read the tile through the scene's own `this.npc`, never a second lookup), plus the
  import. `openNpcCard`'s "already used" guard already skips a `repeatable` row, so no
  second edit is needed there.

## 🧩 Data and configuration

- No new i18n key, no new balance table and no new save field (`SAVE_VERSION` stays
  **23**).
- The rocket row's `chance`/`floorStep` are the only new numbers, and they live in
  `src/data/npcs.ts`, never in engine code.
- `src/scenes/BootScene.ts`: the `CASINO_MACHINE_TEXTURE_KEY` constant and the block that
  draws the cabinet leave **together**; nothing else in that file changes.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; green, including the tests this task moves and adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-117` audited against the exclusive paths above.
  - `npx vitest run src/engine/maps/plan.test.ts src/data/npcs.test.ts src/ui/rocketPanel.test.ts src/scenes/rooms/registry.test.ts`
  - `grep -rn "casino" src/engine/maps/plan.ts` shows no `'casino'` kind and no
    `CASINO_CHANCE`/`CASINO_FROM_MAP`.
  - `git status --porcelain` is empty after `npm test` (no generated file left dirty).

- **Acceptance criteria:**

  - [ ] `[unit]` It typechecks and builds clean: `npm run build` exits 0.
  - [ ] `[unit]` `npm test` is green and the suite's test count is **≥ `main`'s** (the
        moved tests still run; the deleted fixtures are the only losses, and the new
        `rocketPanel.test.ts` replaces them).
  - [ ] `[unit]` **The room is gone from the type and the plan.**
        `grep -c "'casino'" src/engine/maps/plan.ts` is **0** (the word may survive in a
        doc comment only if the comment is corrected — prefer 0),
        `src/scenes/rooms/casino.ts` and `casino.test.ts` do not exist, and
        `collectDescriptors`' shipped-kind list in `registry.test.ts` no longer names
        `casino` while every other kind still does.
  - [ ] `[unit]` **The special pass keeps its order and re-pins honestly.**
        `plan.test.ts` pins, for a fixed seed, that the shop, the mini-boss and the
        mega-stone leaves and **every regular room, id and size** are byte-identical to
        `main` (assert them, do not just re-pin the file), and that the gated, trade and
        no-heal leaves are the re-read values. The re-pin is recorded in the commit body
        with the seeds whose leaves moved.
  - [ ] `[unit]` **The rocket row is data, and its rate is measured.**
        `npcs.test.ts` pins `id`, `spriteKey: 'rocket'`, `chance: 0`, `floorStep: 0.03`,
        `repeatable: true`, and that `effectiveNpcChance(row, 1) === 0`,
        `=== 0.03` at map 2 and `=== 0.21` at map 8; plus one test that
        `roomNpc(seed, roomIndex, 1)` never returns the rocket row for a set of seeds
        that do roll another row.
  - [ ] `[unit]` **The machine moved, not changed.** `rocketPanel.test.ts` covers the
        module's pure half — the face the reels land on for each booked outcome, the
        price/lock lines and the grunt's `RouteTrainer` fields (id from
        `casinoGruntTrainerId`, `archetypeId: 'rocket'`, `position` equal to the tile it
        was handed) — and `src/ui/casino.test.ts` is **unchanged**
        (`git diff --stat src/ui/casino.test.ts` empty).
  - [ ] `[unit]` **Nothing outside the exclusive paths was touched:**
        `git diff --name-only main...task-117` lists no `src/i18n/**`, no
        `src/data/casino.ts`, no `src/ui/casinoReels.ts`, no `src/ui/npcPanel.ts`, no
        `src/ui/mapView.ts` and no `src/engine/battle/**`.
  - [ ] `[live]` **The machine is an NPC's, in the running game.** What to read: the
        rocket's sprite on the route screen and the machine card it opens. The procedure
        is deterministic because every piece of it is a shipped pure function:
        1. **Headless, before the browser:** find a `(seed, mapIndex, roomId)` triple
           whose floor's first trainer room rolls the rocket — `roomNpc(seed, roomId,
           mapIndex)` (`src/engine/routes/npcs.ts`) returning `row.id === 'rocket'` —
           and then its tile through `npcSpot(route, roomId, seed, 'rocket')`, where
           `route` is the room `buildRoute` builds for that plan room. Write the triple
           and the tile in the QA report.
        2. **In the game:** `npm run dev -- --port <free> --strictPort`, type that seed in
           the starter picker's seed prompt (`S`), pick a starter, then use the dev
           overlay (`src/dev/debugMenu.ts`: `onTeleportFloor`, `onTeleportRoom`) to reach
           that floor and room.
        3. **Read, over CDP at 1280×800, with `renderer.snapshotArea` + `getImageData`:**
           the sprite's rect — `x = tile.x * 24`, `y = tile.y * 24` and the sprite's foot
           at `tile.y * 24 + 24` — and the whole room rect around it.
        **PASS when** the sprite's rect differs from the same rect read in a trainer room
        of the same floor that carries no NPC (teleport one room over) in **≥ 40 %** of
        its pixels (a sprite stands there, not bare ground), **and** the interact key at
        that tile raises the machine card whose rect differs from the pre-press frame in
        **≥ 10 000** pixels with the card's own bounds at **460×220**. **A minimap glyph
        that is still a casino marker is a failure, not a skip:** read the minimap rect on
        every floor visited and compare its marker set against `plan.specials` — a
        `casino` kind there is red. If the dev server or CDP cannot run in the
        environment, report the criterion **not run** with the exact reason — never a
        pass.

## 📣 Coordination

- For the Architect: `[Task-117]`'s own label is **Batch 47c (filled)** and Batch 56
  retires with it; the plan's `47c` row and this entry already say so.
- For the next batch: `docs/maps-spec.md` §7's special-room table no longer carries a
  casino row, its NPC table carries the rocket row with the measured rate, and its
  `### The casino (the slot machine)` subsection is retitled as the rocket NPC's panel.
  `[Task-100]`'s bullet in the same §7 keeps its casino parenthetical **only** if that
  task is still open — it is merged, so check and correct the sentence rather than
  leaving a stale clause.
- For QA: the batch's other member (`[Task-120]`) never touches a scene, a data table or
  a doc; the combined tree's only shared risk is `TODO.md`, which neither task edits.

## ⛔ Out of scope

- The table and the economy (`[Task-115]`), the window and its animation (`[Task-116]`),
  the NPC framework and its roll (`[Task-91]`), the trainer rooms (`[Task-82]`) and the
  merchant (`[Task-92]`).
- Any change to `casinoSpin`, its seed formula, its marks, the Egg's hatch on
  `advanceMap` or the price table.
- Any new i18n key, any new save field, any repack of the overworld atlas.
- `docs/balance/route-curve.md` beyond the one quiet-room line, and any other `docs/`
  file than the five named above.
