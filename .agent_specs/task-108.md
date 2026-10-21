# Spec: Task-108 — The 2vs2 boss battle, the screen: two actives on each side

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene + UI helpers + docs.
- **Role:** Dev.
- **Objective:** the map boss's fight **looks and plays** as the double battle its
  engine already runs (`[Task-107]`, shipped: `BattleSetup.double`, two live slots
  per side, `FightCommand.target`, `takeDoubleTurn`). After this task **the boss's
  own battle** opens with **two enemies on the foe's platform**, two enemy HP
  panels and two player panels, both player slots are commanded (slot 1 first, then
  slot 0), a single-target move asks **which** foe it hits, the entry beat sends
  out both leads, and the switch window keeps working with two active rows. Every
  other battle — a wild, a regular trainer, the mini-boss, the berry tree's
  guardian and every special room's set piece — draws and behaves **exactly** as it
  does today. (`BOSS_PARTY.boss.double` is `true` on **every** floor: the on-ramp
  boss fields **three** members on map 1 and six from map 2 on, and its fight is a
  double one either way.)
- **Environment:** worktree `../wt-pkm-108`, branch `task-108`.
- **Dependencies:** `[Task-107]` (shipped: `src/engine/battle/state.ts`'s `double`
  setup, the slot accessors, `takeDoubleTurn`, `chooseAiCommand({ slot })` and
  `src/data/bosses.ts`'s `BOSS_PARTY.boss.double` + `bossIsDouble`), `[Task-101]`
  (shipped: `switchablePartyIndices`, the party rows' `enabled`), `[Task-58]` (the
  chrome tokens the panels draw with) and `[Task-77]` (`PLAYER_PANEL_H = 150`).

### Exclusive paths (single writer)

The list of paths this task creates or modifies. **Nothing outside this list.**
Deleting a stray `.gitkeep` from a directory this task populates is always allowed.

- `src/engine/run/battleLink.ts` — `BattleLaunch.double`
- `src/engine/run/battleLink.test.ts`
- `src/scenes/RouteScene.ts` — one property on the launch in `startBattle`
- `src/scenes/BattleScene.ts` — the whole screen
- `src/ui/beats.ts` — the second send-out
- `src/ui/beats.test.ts`
- `src/ui/partyGrid.ts` — the field-rows helper
- `src/ui/partyGrid.test.ts`
- `docs/battle-spec.md` §12 — one paragraph (the screen); **§2/§3/§5/§9 belong to
  `[Task-103]` in this batch and must not move**
- `docs/design-spec.md` §4 — one paragraph (the battle's two-actives layout)

**This task adds no file**, so it updates no folder `README.md`, and it adds **no
i18n key**: every string it draws already ships (the four command labels, the
prompt, the party rows, `battle.promptAction`). If a new literal feels necessary,
reuse a shipped key — do not touch `src/i18n/`.

### Inputs (read-only)

Files this task may read, and only these, beyond `AGENTS.md` itself.

- `docs/agent-spec-template.md`, `docs/battle-spec.md` §1/§2/§5/§7/§12,
  `docs/design-spec.md` §4/§10, `docs/maps-spec.md` §6, `TODO.md`'s `[Task-108]`
  entry
- `src/engine/battle/state.ts`, `src/engine/battle/commands.ts`,
  `src/engine/battle/turn.ts`, `src/engine/battle/ai.ts`,
  `src/engine/battle/fighter.ts`, `src/engine/battle/double.test.ts`
- `src/engine/run/battleLink.ts`, `src/engine/run/resolve.ts`,
  `src/data/bosses.ts`, `src/data/keybinds.ts`
- `src/ui/beats.ts`, `src/ui/partyGrid.ts`, `src/ui/moveGrid.ts`, `src/ui/feed.ts`,
  `src/ui/frlg.ts`, `src/ui/frlgFont.ts`, `src/ui/metrics.ts`,
  `src/ui/typeColors.ts`, `src/scenes/BattleScene.ts`, `src/scenes/RouteScene.ts`
- `src/i18n/en.ts` (read the shipped keys; add none)

## 🔒 Contract

The public surface other tasks will be written against in parallel. It is a
promise, not a suggestion.

### TypeScript

```ts
// src/engine/run/battleLink.ts
export type BattleLaunch = Readonly<{
  // … every shipped field unchanged …
  /**
   * The boss's fight fields **two actives per side** (`[Task-107]`'s engine rule,
   * `[Task-108]`'s screen). Absent or `false` is every other battle: one active,
   * the shipped layout and the shipped command flow. Default `false`.
   */
  double?: boolean;
}>;
```

```ts
// src/ui/beats.ts
/**
 * The entry beat's steps. A single battle is exactly today's list; `double` adds
 * one `sendout` step at the end (the second active's ball), so the two leads
 * appear one after the other, each for `ENTRY_SENDOUT_MS`.
 */
export function entryBeat(
  kind: EntryKind,
  reducedFlash: boolean,
  double?: boolean,
): readonly EntryStep[];
```

```ts
// src/ui/partyGrid.ts
/**
 * The party rows a battle marks as **on the field**, in slot order: slot 0's index
 * first, slot 1's second, skipping `-1` and duplicates. A single battle answers
 * `[activeIndex]`; an empty side answers `[]`. The scene draws those rows with the
 * shipped accent (they are the ones `switchablePartyIndices` already refuses).
 */
export function partyGridFieldRows(
  activeIndex: number,
  secondActiveIndex: number,
): readonly number[];
```

### The scene's frozen shape (`src/scenes/BattleScene.ts`, private surface)

The scene keeps its shipped fields and adds these, named exactly:

```ts
/** Slot 1's display snapshots; null in a single battle or with an empty slot. */
private displayActive2: BattleFighter | null;
private displayHp2: number | null;
private displayStatus2: StatusId | null;
/** True once this battle's launch asked for a double battle. */
private double: boolean;
/** The second foe's sprite and window; hidden in a single battle. */
private foeSprite2!: Phaser.GameObjects.Sprite;
private foePanel2!: Phaser.GameObjects.NineSlice;
/** The second player window; hidden in a single battle. */
private playerPanel2!: Phaser.GameObjects.NineSlice;
/** Slot 1's command while slot 0 is being chosen (`null` outside a double battle). */
private partnerCommand: Command | null;
/** The foe slot the target step is pointing at, or null while it is closed. */
private targetSlot: 0 | 1 | null;
```

`displayActive`, `displayHp` and `displayStatus` keep meaning **slot 0**: nothing
that reads them changes meaning, so every shipped single-battle path is untouched.

- **`init`/`create`.** `this.double = data?.double === true`; `createBattle({ …,
  double: this.double })`. Slot 1's snapshots are read with
  `liveSlots(state, 'enemy')`/`activeFighter(state, 'enemy', 1)` and the same for
  the player, and are `null` whenever the slot does not exist. When a launch asks
  for a double battle but the party (or the roster) holds one member, the engine
  already answers `secondActiveIndex === -1`, so the scene draws **one** panel and
  skips the partner step — the single path, reached through the same code.
- **Layout.** `refreshHud` keeps its shipped numbers for slot 0 and lays slot 1
  out by mirroring them:
  - the two enemy windows sit side by side above the foe platform, each
    `FOE_PANEL.w × FOE_PANEL.h`, the left one where the shipped enemy window sits
    and the right one `FOE_PANEL.w + 12` to its right, both inside the battle
    square's content box (clamp on the right edge);
  - the two player windows sit stacked at the bottom-left, each
    `PLAYER_PANEL_W × PLAYER_PANEL_H`, the top one where the shipped player window
    sits and the second `PLAYER_PANEL_H + 12` **below** it, clamped to the box;
  - the two enemy sprites stand on the foe platform, left and right of its centre
    (`±FOE_PLATFORM_SPREAD`, a module constant of `TILE_SIZE`-free scene units —
    pick `96`), each keeping the shipped sprite size rule
    (`battleSpriteHeight`/`SPRITE_SIZE_MAX`);
  - the second sprite's and window's depth, tint, HP bar and status badge reuse the
    shipped objects' construction, created once in `buildScene` and only
    `setVisible(false)` in a single battle.

  The measurement this paragraph buys QA: with `double` false, **no** slot-1
  object is visible and every shipped coordinate is unchanged.
- **The command flow.** `mode` gains one member, `'partner'`, and one, `'target'`.
  The turn is collected in this order:
  1. `openMenu()` starts with **slot 1** in a double battle (`'partner'`), else
     slot 0 as today.
  2. The partner's menu draws **FIGHT** and **SWITCH** only (the Bag and Run are
     side-level actions and stay slot 0's; the shipped `MENU_COMMANDS` order is
     preserved for the two visible rows). A fainted or absent slot 1 skips the
     step.
  3. Choosing FIGHT on either slot opens the shipped move grid for **that slot's**
     fighter (`activeFighter(state, side, slot)`); choosing SWITCH opens the shipped
     party window and records `{ type: 'switch', partyIndex, slot }`.
  4. **The target step.** After a **single-target damaging** move is picked and it
     is not a spread move (the dex row's `target` is neither `allAdjacentFoes`,
     `allAdjacent` nor `all`), `targetSlot` becomes `0` and `mode` becomes
     `'target'`: the shipped `FRLG_CURSOR_KEY` image is placed on the foe the slot
     points at, `left`/`right` (and a click on either foe sprite) move it between
     the **live** opposing slots, `confirm` submits
     `{ type: 'fight', moveIndex, slot, target: { side: 'enemy', slot: targetSlot }, mega?, gmax? }`,
     and `cancel` returns to the move grid with nothing submitted. A spread move and
     a status/self-target move submit with no `target`, exactly as today.
  5. Slot 0's submission (or the partner's, when slot 0 is skipped) calls
     `takeDoubleTurn(this.state, { 0: cmd0, 1: cmd1 }, { 0: chooseAiCommand(…, { slot: 0 }), 1: chooseAiCommand(…, { slot: 1 }) })`
     in a double battle, and the shipped `takeTurn(state, command, ai)` in a single
     one. The enemy slot-1 command is asked **only** while the slot exists.
  6. `submit` stays the single funnel: every command the scene builds reaches the
     engine through it, so `validateCommand`'s refusal can never be bypassed.
- **The beats.** `startEntry` plays `entryBeat(kind, reducedFlash, this.double)` and
  animates one send-out per step; a `sendout` step animates the **slot 1** ball
  (the second player's mon) with the shipped `appearSprite`/`SWITCH_SENDOUT_MS`
  shape. A faint or a switch animates the sprite and panel of the **slot the event
  names** (`event.slot` where the engine carries one; `displayActive2` when the
  fainted fighter is slot 1), so a double faint plays two drops and one side still
  fights while the other slot lives.
- **Behaviour that must not move.** In a single battle `openMenu`, the four command
  rows, the bag (tabs, rows, back control), the FIGHT grid, the INFO window, the
  Mega/G-Max controls, the capture beat, the run command, the party window's rows
  and `returnToRoute`'s `BattleReturn` (including `used`) are **byte-identical**:
  the only new code a single battle executes is `this.double === false`'s checks.
- **Determinism (D11).** The scene draws **no RNG of its own**: the turn's rolls,
  the AI's and the capture's all come from `BattleState.rng`, whose draws the engine
  orders (`takeDoubleTurn` sorts four entries and asks the AI once per live slot).
  No seed, stream or key moves; the launch gains one boolean and nothing else.
- Rules: no new module, no Phaser import into `src/engine/` or `src/ui/`, no
  per-frame allocation (the slot-1 objects are created once in `buildScene`;
  `refreshHud` only reads).

### Data

- `BattleLaunch.double?: boolean` — absent on every shipped launch; `true` only for
  a boss battle whose data says so.
- `RouteScene.startBattle` adds one property, next to the shipped `noHeal` one:
  `...(this.room?.boss === true ? { double: bossIsDouble('boss') } : {})`, with
  `bossIsDouble` imported from `src/data/bosses.ts`. The boss room is the only room
  whose battles are the boss's own (it is a quiet leaf with no other trainer), so a
  wild, a regular trainer, a mini-boss and every set piece pass no `double`.
- `src/ui/partyGrid.ts`'s helper is pure and carries no new data.
- No `SAVE_VERSION` step, no run field, no i18n key, no new asset.

## 🧩 Data and configuration

- `FOE_PLATFORM_SPREAD = 96` and the slot-1 gap `12` px are **module constants** of
  `BattleScene.ts`, beside the shipped `PLAYER_PANEL_W`/`FOE_PANEL` numbers, so the
  layout is one place.
- The partner menu's two rows are the shipped `MENU_COMMANDS` entries for
  `fight`/`switch`, filtered — the labels stay `battle.command.fight` /
  `battle.command.switch`.
- `entryBeat`'s `double` parameter defaults to `false`, so every existing call keeps
  its list.

## 🧪 Test and Validation Plan (for QA)

### Method

- `npm test` — Vitest, headless; must be green, including the tests this task adds.
- `npm run build` — `tsc --noEmit && vite build`.
- `git diff --name-only main...task-108` audited against the exclusive paths list.
- Browser pass **is** required (four `[live]` criteria below): the double battle only
  exists on screen.

### Acceptance criteria

- [ ] `[unit]` It typechecks and builds clean: `npm run build`.
- [ ] `[unit]` The whole suite is green: `npm test` (the shipped engine double tests
  and the golden battle are untouched and green).
- [ ] `[unit]` Nothing outside the exclusive paths was touched:
  `git diff --name-only main...task-108`, and no folder `README.md` and no
  `src/i18n/*` file appears in it.
- [ ] `[unit]` The launch field is the frozen one: `npx vitest run src/engine/run/battleLink.test.ts`
  — a launch without `double` reads `undefined`, `battleSeed` is unchanged for the
  same `(runSeed, routeIndex, key)`, and `'double' in launch` is false unless it was
  set.
- [ ] `[unit]` The entry beat is the frozen list: `npx vitest run src/ui/beats.test.ts`
  — `entryBeat('trainer', false)` and `entryBeat('wild', true)` equal today's lists
  exactly, `entryBeat('trainer', false, true)` equals that list **plus one**
  `{ kind: 'sendout', ms: ENTRY_SENDOUT_MS }` at the end, and
  `entryBeat('trainer', false, false)` is the single list again.
- [ ] `[unit]` The field rows are the frozen ones: `npx vitest run src/ui/partyGrid.test.ts`
  — `partyGridFieldRows(0, -1)` is `[0]`, `partyGridFieldRows(2, 4)` is `[2, 4]`,
  `partyGridFieldRows(-1, -1)` is `[]`, and a repeated index appears once.
- [ ] `[unit]` The scene compiles against the shipped engine surface: `grep -n "takeDoubleTurn"
  src/scenes/BattleScene.ts` shows the double branch and `grep -n "createBattle({" -A 12
  src/scenes/BattleScene.ts` shows `double: this.double` inside the setup; the
  single battle's `takeTurn(` call is still present and is the one the
  `this.double === false` branch takes.
- [ ] `[unit]` No engine file changed: `git diff --name-only main...task-108 -- src/engine`
  lists only `src/engine/run/battleLink.ts` and its test.
- [ ] `[live]` A map-3 boss battle opens as a double battle.
  Measurement: `npm run dev`, start a run (any seed), open the debug menu (`F`), add
  a second party member, set floor **3** and press Go, then walk the minimap's boss
  glyph to the boss room and step into the boss: the foe platform shows **two**
  enemy sprites, **two** enemy HP windows above them and **two** player windows at
  the bottom-left, and the entry beat drops **two** balls one after the other; the
  battle's party window shows exactly **two** rows drawn disabled (the two actives).
- [ ] `[live]` Both slots are commanded, slot 1 first. Measurement: in that battle
  the first prompt asks slot 1's Pokémon (`battle.promptAction` names it) and its
  menu offers **FIGHT** and **SWITCH** only (no BAG, no RUN); after that command is
  chosen the prompt returns for slot 0 with all four rows; after slot 0's command
  the turn resolves **both** commands in one turn (two sets of feed lines, the
  order set by Speed).
- [ ] `[live]` The target step marks one foe and the move hits it. Measurement: in
  that battle choose FIGHT with slot 0, pick a **single-target** damaging move — a
  cursor appears on foe slot 0 and `left`/`right` move it to slot 1; confirming
  drops **only** that foe's HP bar and prints one hit line; choosing a **spread**
  move (`allAdjacentFoes`) skips the cursor and drops **both** enemy bars with two
  hit lines from one move.
- [ ] `[live]` A single battle is unchanged. Measurement: with the same run, start a
  wild battle (walk in tall grass), a regular trainer's battle (walk into a sight
  line in a trainer room) and the mini-boss's battle: each shows **one** enemy
  sprite, **one** enemy window, **one** player window, no target cursor on any
  single-target move, no partner prompt, and the entry beat is the shipped one; the
  FIGHT/BAG/SWITCH/RUN rows behave exactly as before.

## 📣 Coordination

- **For the Architect:** the plan's Batch-47 record for this task names
  `RouteScene.ts`, `BattleScene.ts`, `src/ui/partyGrid.ts` and `src/ui/beats.ts`;
  the real union also needs `src/engine/run/battleLink.ts` + its test (the launch
  boolean), which is **not** in the record and is free in the batch. The task adds
  no `SAVE_VERSION` step, no i18n key and no file.
- **For `[Task-103]` (the same batch):** that task owns
  `src/engine/battle/{fighter,mega,commands}.ts` and `docs/battle-spec.md`'s
  **§2/§3/§5/§9**; this task owns `docs/battle-spec.md`'s **§12** and
  `docs/design-spec.md`'s §4. Neither may edit the other's sections, and Integration
  QA reads the combined `docs/battle-spec.md` for lost lines.
- **For `[Task-109]` / `[Task-110]` (Batches 51/52):** they inherit a
  `RouteScene.startBattle` that already carries a `double` property and a
  `BattleScene` whose command flow has two extra modes (`'partner'`, `'target'`);
  their own scenes' edits must preserve both.
- **For `[Task-114]` (Batch 53):** the double battle adds **no** log line of its
  own — every line the screen prints comes from the engine's existing `pushText`
  calls, which its key sweep converts; this task's partner and target steps print
  nothing.
- **For the next batch:** a double battle is `BattleLaunch.double` plus the engine's
  own `BattleSetup.double`; nothing else in the run knows about it.
- **For QA:** the double battle needs a **party of two or more** (the engine fields
  slot 1 only then). That is why the recipe adds a member from the dev panel first;
  a one-member party on the same boss still draws the single layout, and that is the
  specified degradation, not a defect.

## ⛔ Out of scope

- The engine's double-battle rules (`[Task-107]`, shipped): no change to
  `src/engine/battle/**`, no new target/order/AI rule, no per-slot side conditions.
- Full Showdown doubles: Helping Hand, redirection, friend guard, spread damage
  reduction, two Megas or two Gigantamaxes.
- A second Pokémon **sprite pair** for the player (the party's second active draws
  with the shipped back sprite of its own species — no new art).
- The boss's condition, roster size or room rules (`[Task-100]`, shipped), and the
  boss's data row (`[Task-107]`).
- Any i18n key, any notice, any HUD change outside the battle scene, any asset
  regeneration, and the battle's info window or capture beat beyond what is frozen
  above.
- Any new dependency, any `package.json`/`vite.config.ts`/`src/main.ts` change, and
  any regeneration of `src/data/dex/**`.
