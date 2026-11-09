# Spec: Task-310 — The laboratory hands the starter by hand

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule (interior plan) + Phaser scene + menu routing.
- **Role:** Dev.
- **Objective:** A new run stands in the **laboratory** and sees the room, a
  three-cell table and three Poké Balls. The starter pick no longer mounts itself on
  entry: the player walks up to the table, presses the interact key, and the existing
  `04 Starter pick` panel opens over the room with the three portraits. Choosing a
  card takes the starter and drops the panel; cancel drops it without a gift; the
  player can walk away and come back. Continue on a run that has not taken its
  starter reopens the laboratory instead of starting `Route`.
- **Environment:** worktree `../wt-pkm-310`, branch `task-310`.
- **Dependencies:** the starter pick (`Task-287`, shipped), the node scenes
  (`Task-300`, shipped) and the item atlas (`src/assets/anil/item-icons.png`,
  shipped).

### Exclusive paths (single writer)

Nothing outside this list.

- `src/engine/region/interior/plan.ts`
- `src/engine/region/interior/plan.test.ts`
- `src/scenes/InteriorScene.ts`
- `src/scenes/interior.test.ts`
- `src/scenes/MainMenuScene.ts`
- `src/scenes/MainMenuScene.test.ts`
- `docs/region-spec.md` (§6 only)
- `docs/design-spec.md` (the starter-pick paragraph only)

### Inputs (read-only)

- `AGENTS.md`.
- `design/screens/04-starter-pick.json` and `design/exports/04-starter-pick.png`
  (caption `04 Starter pick`) — the panel the interaction opens.
- `src/engine/region/interior/plan.ts` and its test.
- `src/scenes/InteriorScene.ts`, `src/scenes/interior.test.ts`.
- `src/scenes/MainMenuScene.ts`, `src/scenes/MainMenuScene.test.ts`.
- `src/scenes/WorldScene.ts`, `src/scenes/walker.ts` (the walk and the tile getter).
- `src/scenes/CityScene.ts` (the NPC interaction pattern: `readNpcAction`, `JustDown`).
- `src/data/keybinds.ts` (`confirm`, `cancel`, `interact`).
- `src/data/itemIcons.ts` (`itemIconFrame`, `ITEM_ICON_TEXTURE_KEY`, `ITEM_ICON_SIZE`).
- `src/engine/map.ts` (`COUNTER`, `FLOOR`, `WALL`, `DOOR`).
- `src/engine/run/prologue.ts` (`takeStarter`, `isPrologue`, `STARTER_LEVEL`).
- `src/ui/hud/panels/starter/**` (the panel; do not edit it).
- `docs/region-spec.md` §6, `docs/design-spec.md` (the starter paragraph).

## 🔒 Contract

### TypeScript

`src/engine/region/interior/plan.ts`:

```ts
export type InteriorPlan = Readonly<{
  // ...the shipped fields...
  /** The lab's three Poké Ball tiles on its table; absent on every other kind. */
  starterBalls?: readonly Tile[];
}>;

/** True when `tile` shares an edge with one of the plan's starter balls. */
export function nextToStarterBalls(tile: Tile, plan: InteriorPlan): boolean;
```

The lab's table is a **three-cell `COUNTER` run** on the furniture row
(`furnitureRow(height)`, `middleOf(0, width)`), and `starterBalls` is those three
tiles in left-to-right order. The `professor` slot moves to a free side tile on the
same row (`centre - 4`, or `centre + 4` if that is outside the floor); it stays a
slot and is not drawn. Every other room kind is unchanged and has no `starterBalls`.

`src/scenes/InteriorScene.ts`:

- `create()` no longer mounts the panel. It sets the starter key set
  (`interact`, `confirm`, `cancel` through `actionKeys`), draws the three Poké Balls
  on the plan's `starterBalls` tiles and keeps the existing `runKey`/walker.
- `update()` reads the starter keys first. While the panel is mounted
  (`this.controller !== null`) it does not walk the player; `cancel` disposes the
  panel. When the panel is not mounted, `interact`/`confirm` on a tile that
  `nextToStarterBalls` accepts and a run that is still a prologue calls
  `openStarter()`, which mounts the existing panel (`mountStarter`).
- `confirm()` takes the starter, stores the run and **disposes** the panel; it never
  re-renders an empty offer.
- The `cancel` intent disposes the panel; the scene's `cancel` key does the same.
- The three Poké Balls are Phaser images of `ITEM_ICON_TEXTURE_KEY` frame
  `itemIconFrame('pokeball')`, one per `starterBalls` tile, centred on the tile and
  depth-sorted with the actors; they are removed with the scene.

`src/scenes/MainMenuScene.ts`:

```ts
// continue
if (isPrologue(run)) {
  this.scene.start('Lab', { run, cityKey: planRegion(run.seed).townKey, interiorKey: 'lab' });
} else {
  this.scene.start('Route', { run });
}
```

`isPrologue` comes from `../engine/run/prologue`. The `Lab` payload is exactly the
NEW RUN payload (`cityKey` is `planRegion(seed).townKey`, `interiorKey` is `'lab'`).

### Data

- `LAB_TABLE_RUN = 3` (a local constant in `plan.ts`; no data file).
- The table cells are `COUNTER`; the balls are a scene prop, not map values.
- No save step, no new run field, no new RNG draw.

## 🧩 Data and configuration

- The lab's plan keeps the shipped `INTERIOR_SIZE` (24×18), the entry door on the
  bottom row and the furniture row at `floor(height / 4)` (row 4). The table is the
  three cells `centre - 1 .. centre + 1` on that row; the player interacts from the
  adjacent floor tile.
- `nextToStarterBalls` is Manhattan distance 1, not diagonal.
- The panel is the shipped `04 Starter pick` (`starter`), mounted in `#hud`; do not
  restyle it.
- The ball art is the shipped Añil item atlas; do not repack it.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test`
  - `npm run build`
  - `git diff --name-only main...task-310` against the exclusive paths.
  - The live pass needs the packed region atlases. Run, with the store at
    `C:\Users\Dani\projects\pkm-randomlike\sprite-sources`:
    `node scripts/frlg/build-region-tilesets.mjs "C:\Users\Dani\projects\pkm-randomlike\sprite-sources\frlg\tileset.png" "C:\Users\Dani\projects\pkm-randomlike\sprite-sources\frlg\tileset-2.png"`
    before the browser pass. The item atlas is already packed.
- **Acceptance criteria:**
  - [ ] `[unit]` The lab plan stamps exactly three `COUNTER` cells on one row and
    `starterBalls` is those three tiles; every other room kind has no
    `starterBalls`; `nextToStarterBalls` is true for the tile directly below the
    middle ball and false for a tile two cells away (a new case in
    `plan.test.ts`); the lab's pinned digest is re-pinned.
  - [ ] `[unit]` `InteriorScene.create` does not call `createDom`; `update` names
    `nextToStarterBalls` and `openStarter`; `confirm` calls `disposePanel` and does
    not call `render` (source pins in `interior.test.ts`).
  - [ ] `[unit]` After a `choose`, the controller's `dispose` is called once and the
    run keeps the starter; the old "repaints the panel" test becomes "drops the
    panel".
  - [ ] `[unit]` Continue on a prologue starts `'Lab'` with `cityKey: 'town:1'` and
    `interiorKey: 'lab'`; Continue on a starter-taken run still starts `'Route'`
    (`MainMenuScene.test.ts`).
  - [ ] `[unit]` The suite and the build are green.
  - [ ] `[live]` At 1280×800 with the packed atlases: NEW RUN lands in the
    laboratory and the room is visible (the tilemap and the player, no full-screen
    panel); the table draws three Poké Ball sprites on one row; walking to the tile
    below the table and pressing the interact key mounts `[data-hud-starter]` with
    three cards and three portraits; clicking a card takes the starter and the panel
    disappears; reopening the run and pressing Continue reopens the laboratory (the
    prologue) or the town (after the starter). Read the scene's
    `debugInteriorState()` (`starterTaken`, `partySize`, `tile`) and the panel's
    `[data-hud-starter]` node.

## 📣 Coordination

- For the Architect: `InteriorPlan` gains an optional `starterBalls`; the lab's
  digest and the `professor` slot move.
- For the next batch: the starter pick is no longer auto-mounted; any future scene
  that wants the picker must call the scene's `openStarter`-shaped path, not
  `createDom` on entry.
- The panel itself is unchanged; the interaction is the scene's.

## ⛔ Out of scope

- No change to `src/ui/hud/panels/starter/**`, its CSS, its tests or its copy.
- No new save version, no new run field, no new RNG stream.
- No change to the town's exit rule (`canLeaveTown`) or the travel seam.
- No change to the other interiors (Centre, gym, house, casino).
- No change to the battle or the route.
