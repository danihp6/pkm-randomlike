# Spec: Task-170 — Every floor, map 1 included, posts one merchant

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** data table + two test files + docs.
- **Role:** Dev.
- **Objective:** The Mart's merchant is guaranteed on **every** floor of a run,
  the first one included. The table's one guaranteed row moves from
  `guaranteedFromMap: 2` to `1`; the two shipped tests that pin "map 1 is
  merchant-free" are flipped; and the one silent failure the entry names is
  closed — `RouteScene.rollRoomNpc` drops a placement whole when the sprite is
  missing, so a test asserts at build time that `overworldSpriteFrame('merchant')`
  resolves, and the runtime skip stays a last resort. The docs that state the old
  "from map 2 on" rule are corrected.
- **Environment:** work only in your own worktree
  `/home/runner/work/pkm-randomlike/wt-pkm-170`, branch `task-170`, spec at
  `.agent_specs/task-170.md` inside it. Never work in
  `/home/runner/work/pkm-randomlike/pkm-randomlike` (that checkout is `main`) and
  never push to `main`.
- **Dependencies:** none. The table (`src/data/npcs.ts`), the placement
  (`src/engine/routes/npcs.ts`) and the overlay sprite manifest are already on
  `main`.

### Exclusive paths (single writer)

Nothing outside this list. No new file is created, so no folder `README.md`
changes.

- `src/data/npcs.ts`
- `src/data/npcs.test.ts`
- `src/engine/routes/npcs.test.ts` (the placement tests only — `npcs.ts` itself is
  **not** touched: `guaranteedNpc` already reads the table and needs no change)
- `docs/maps-spec.md` **§7 only**: the guarantee paragraph, the merchant's roll
  paragraph and the `O-M4` bullet — the three places that state "from map 2 on"
- `docs/design-spec.md`: **only** §2's maps bullet's last two lines about the
  shop leaf, and §7's two merchant sentences. **No other section of that file** —
  another task in this batch owns §10.3 of the same document.
- `docs/tech-decisions.md`: **only** `D33`'s one parenthetical "a guaranteed
  **shop** near the entry (from map 2 on)". Add no new decision and change nothing
  else in that file.

### Inputs (read-only)

- `src/engine/routes/npcs.ts` — `guaranteedNpc` (the placement; reads the table's
  `guaranteedFromMap` and `firstTrainerRoom`, no RNG), `roomNpc` (never picks a
  zero-weight row).
- `src/engine/maps/plan.ts` — `firstTrainerRoom`, `planMap` (the tests' plans).
- `src/data/overworldSprites.ts` — `overworldSpriteFrame(name)`; note
  `src/ui/rocketPanel.test.ts` already imports it in Vitest, so the import is
  supported headlessly.
- `src/scenes/RouteScene.ts` — read-only: `rollRoomNpc` (~761-780) is where a
  missing frame drops the placement, and the merchant's card (`openNpcCard`,
  ~2963) resolves the row's `mart` choice through `chooseNpc` (~3024).

## 🔒 Contract

### `src/data/npcs.ts`

```ts
{
  id: 'merchant',
  // ... unchanged ...
  chance: 0,
  floorStep: 0,
  guaranteedFromMap: 1, // was 2 — the Mart is on every floor (report: «en todos los pisos»)
  // ...
}
```

Nothing else in the table moves: the five member-edit rows and the sacrifice keep
their order, their chances, their gates and their `guaranteedFromMap` (absent).

### Tests

`src/data/npcs.test.ts`

- The merchant's shipped-fields test reads `guaranteedFromMap === 1`.
- One new assertion closes the silent failure:
  `expect(overworldSpriteFrame(MERCHANT.spriteKey)).not.toBeNull();` — imported
  from `../data/overworldSprites` (or the path `src/data/` tests use for their own
  module). This is the build-time check the entry asks for; no scene change.

`src/engine/routes/npcs.test.ts`

- "places the merchant in the floor's first trainer room from map 1 on": for the
  six shipped `MAP_SEEDS` and **every** `mapIndex` from **1 to 8**, the plan's
  `firstTrainerRoom(plan)` is `>= 0`, `guaranteedNpc(plan, room, mapIndex)` is the
  merchant row, and `plan.rooms[room].role === 'trainers'`.
- The "leaves map 1 merchant-free" test is **flipped**, not deleted: map 1's first
  trainer room is a `trainers` room and answers the merchant, on all six seeds.
- The table-order test keeps proving order rather than the smallest threshold: with
  a local table `[medic fromMap 3, merchant fromMap 1]`, map 1 answers the merchant
  and map 3 answers the merchant (first eligible row in table order); with the
  swapped order `[merchant fromMap 1, medic fromMap 3]` map 3 still answers the
  merchant; and a table whose earliest row is `fromMap 2` still answers `null` on
  map 1 (that keeps the null path tested now that the shipped row is eligible on
  map 1).
- Everything else in the file (no RNG read, no room but the first trainer room,
  the rolled rows never picking a guaranteed one) stays as it is and must stay
  green.

## 🧩 Data and configuration

No new key: `guaranteedFromMap` already exists and its meaning is unchanged
("this floor index and up"). The balance consequence is deliberate and is not a
number in this task: a floor-1 merchant sells the shipped band's stock with the
money the run has (the 10-ball pack the on-ramp already gives is not removed).
`no SAVE_VERSION` step: the guarantee reads the plan, adds no run field and draws
no RNG.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task
    changes.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-170` audit against the exclusive paths list;
    `git diff -U0 docs/design-spec.md` must show only §2's maps bullet and §7's two
    merchant sentences, and `git diff -U0 docs/maps-spec.md` only §7's three
    places.
  - `[live]`: a dev server plus CDP over the headless Chromium, as `docs/agent-ci.md`
    describes. Start your own `npm run dev -- --port <free> --strictPort`, stop it
    when done. Read the running scene's own state through
    `await import('/src/main.ts')` (that module exports `game`), not a screenshot.
    Say which method produced each piece of evidence.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `src/data/npcs.test.ts`: the merchant row ships
    `guaranteedFromMap: 1`, `chance: 0`, `floorStep: 0`, and
    `overworldSpriteFrame('merchant')` is not null.
  - [ ] `[unit]` `src/engine/routes/npcs.test.ts`: maps **1…8** all answer the
    merchant on the first trainer room, on all six seeds, and every one of those
    rooms has `role === 'trainers'`; the flipped map-1 test passes; the table-order
    test covers a `fromMap 1` row, a `fromMap 3` row and the leftover `null` case.
  - [ ] `[unit]` The rest of the NPC suite is untouched and green (the rolled rows,
    the requirements, the per-row fields).
  - [ ] `[live]` A fresh run's **first floor** places the merchant: on the running
    build, `game.scene.getScene('Route')` after the starter is picked reads
    `scene.run.mapIndex === 1` and `scene.npc !== null` with
    `scene.npc.row.id === 'merchant'`; the merchant's `scene.npc.tile` is a
    walkable tile inside the route (`scene.route.player`/`isWalkable`-equivalent
    read is optional — the equality on the row id is the criterion) and its first
    choice id is `'mart'`. A second floor (advance the run through the debug
    bridge or read a fresh seed at map 2) still places it, so the guarantee is not
    "floor 1 only".
  - [ ] `[unit]` `docs/maps-spec.md` §7 no longer says map 1 is merchant-free: the
    guarantee paragraph, the merchant's roll paragraph and `O-M4` all read "on
    every floor" / "from map 1 on", and no other line of the file changed.
  - [ ] `[unit]` `docs/design-spec.md` §2's bullet ("no floor hangs a shop leaf:
    the Mart is the floor's guaranteed merchant NPC …") and §7's two merchant
    sentences say the merchant stands on every floor; §10.3 and every other section
    is byte-identical (`git diff -U0` shows only those hunks).
  - [ ] `[unit]` `docs/tech-decisions.md` `D33`'s parenthetical reads that the
    guaranteed shop is on every floor; no other line of that file changed and no
    decision was added.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.

## 📣 Coordination

- For the next batch: the guarantee is now "one merchant per floor, map 1
  included", so any later task that measured "maps 2-8 carry the machine" or a
  floor's shop income reads this rule, not the retired one. The rocket grunt's own
  `floorStep` table is unchanged and still starts at zero on map 1.
- For the balance pass: floor 1 now has a counter; its stock is the `early` band's
  shipped rows and was not re-tuned here on purpose.

## ⛔ Out of scope

- `src/engine/routes/npcs.ts` (`guaranteedNpc` already does the right thing).
- `src/scenes/RouteScene.ts` — the runtime skip on a missing frame stays; this task
  only makes a missing merchant frame a **test** failure.
- The merchant's greeting, its `TRADE` label, the Mart's stock and prices, any i18n
  key.
- The other NPC rows' chances, gates and guarantees.
- Adding a run field, a `SAVE_VERSION` step or a new RNG draw.
