# Spec: Task-161 — A sign at the door that leads into the boss room, and a popup that names it

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine placement + Phaser scene + asset packer + docs.
- **Role:** Dev.
- **Objective:** the room **whose link leads into the boss room** grows one static
  **sign** on the approach side, one tile inside that door's opening, drawn from a
  new 16×16 `tileset-2` crop. The sign is solid, blocks its tile, and the interact
  key opens the same card the special NPCs use, whose title is the one new i18n key
  `boss.sign`. Nothing else on the floor gets a sign; the room is rebuilt from the
  plan with **no RNG**, so the sign is in the same cell on every visit and on a
  reload.
- **Environment:** worktree `../wt-pkm-161`, branch `task-161`.
- **Dependencies:** none open. Already merged and read here: the boss room is a
  two-door `corridor` whose chamber holds the boss (Task-158), the centre chamber
  (Task-157), the room plan/`RoomView` seam (`src/engine/maps/plan.ts`,
  `src/engine/maps/progress.ts`) and the NPC card (`src/ui/npcPanel.ts`).

### Exclusive paths (single writer)

The list of paths this task creates or modifies. **Nothing outside this list.**

- `src/engine/routes/signs.ts` (new) and `src/engine/routes/signs.test.ts` (new)
- `src/engine/routes/routeMap.ts` (the `RouteSign` type and `RouteMap.signs`)
- `src/engine/routes/sketch.ts` (`RouteRequest.signEdge`, the placement pass)
- `src/engine/routes/index.ts` (export `./signs`)
- `src/engine/routes/sketch.test.ts` (only if a route-level case belongs there)
- `src/engine/README.md` (one line for `routes/signs.ts`)
- `src/data/tilesets/props.ts` (new) and `src/data/tilesets/props.test.ts` (new)
- `src/data/README.md` (the `tilesets/` line gains `props.ts`)
- `src/assets/placeholders/frlg/sign.png` (new, committed 16×16 blank)
- `src/assets/README.md` (one row for `frlg/sign.png`)
- `scripts/frlg/build-sign.mjs` (new packer)
- `scripts/assets/pack.mjs` (one step)
- `scripts/assets/build-placeholders.mjs` (one `ATLASES` entry)
- `src/scenes/BootScene.ts` (load the sign texture)
- `src/scenes/RouteScene.ts` (place, draw, block, interact, card)
- `src/i18n/en.ts` and `src/i18n/es.ts` (one key each)
- `docs/routes-spec.md` §2, `docs/maps-spec.md` §6, `docs/tileset-spec.md` §2

`src/assets/frlg/sign.png` is **gitignored** and is written by the packer; never
`git add` it. `src/assets/placeholders/frlg/sign.png` **is** committed.

### Inputs (read-only)

Beyond `AGENTS.md`: `src/engine/routes/{doors,layout,npcs,bossRoom}.ts`,
`src/engine/maps/{plan,progress}.ts`, `src/engine/tileset.ts`,
`src/scenes/rooms/types.ts`, `src/ui/npcPanel.ts`, `src/ui/frlg.ts`,
`src/ui/frlgFont.ts`, `src/data/groundItemSprite.ts`, `src/data/itemIcons.ts`,
`src/assets/optional.ts`, `src/assets/art.ts`,
`scripts/frlg/build-field-items.mjs`, `scripts/legacy-art/png-codec.mjs`,
`docs/routes-spec.md` §2, `docs/maps-spec.md` §6, `docs/tileset-spec.md` §2/§5/§6.

## 🔒 Contract

### TypeScript — `src/engine/routes/signs.ts` (new)

```ts
import type { Tile } from '../grid';
import type { AccessEdge } from './layout';

/** The one line a sign says. The scene resolves this key through `t(...)`. */
export const BOSS_SIGN_KEY = 'boss.sign';

/** A static sign: its route cell and the i18n key it says. */
export type RouteSign = Readonly<{ x: number; y: number; text: string }>;

/** The cardinal step from `edge` into the room (N -> y+1, S -> y-1, W -> x+1, E -> x-1). */
export function inwardStep(edge: AccessEdge): Tile;

/**
 * The sign's cell beside one opening: **one tile inward from the opening's own
 * anchor**, so it stands in the lane's mouth, off the border band, and the lane's
 * other half still lets the door be walked through. No RNG.
 */
export function bossSign(edge: AccessEdge, opening: Tile): RouteSign;
```

- `bossSign(edge, opening)` returns `{ x, y, text: BOSS_SIGN_KEY }` where
  `{x,y}` is `opening + inwardStep(edge)`.
- Pure: no Phaser, no DOM, no i18n import, no RNG.

### TypeScript — `src/engine/routes/routeMap.ts`

```ts
/**
 * The static signs the room drew: the boss door's own sign on the room that links
 * into the boss room (`docs/routes-spec.md` §2). Absent when the build was not
 * asked for one, so every shipped fixture stays valid.
 */
signs?: readonly RouteSign[];
```

`RouteSign` is imported from `./signs` (or re-exported there from `routeMap`) —
pick one direction and keep `index.ts` exporting both exactly once.

### TypeScript — `src/engine/routes/sketch.ts`

```ts
/** The edge of the room whose opening leads into the boss room, so it gets a sign. */
signEdge?: AccessEdge;
```

- In `attemptRoute`, after `placeAccess` has produced the opening anchors: if
  `request.signEdge` names an opening of the built `shape`, the route carries
  **exactly one** sign at `bossSign(edge, openings[index])`. A `signEdge` that is
  not in the opening set produces no sign rather than throwing.
- When the sign exists, its cell joins the hazard forbids exactly like the spine
  (`openKeys`/`grassForbid`/`ledgeForbid`): no tall grass, no ledge and no trainer
  or item may land on it. It is already on the spine by construction
  (`carveSquare` at the opening); add the assertion to the population pass if a
  guard is needed.
- `before`/`after` of the pass: **no existing draw moves**. Adds no `Rng` stream.
- `RouteMap.signs` is written only when a sign exists, so a route that asks for
  none is byte-identical to today's.

### TypeScript — `src/data/tilesets/props.ts` (new)

Follow `src/data/groundItemSprite.ts` exactly (`import.meta.glob` over the packed
path + `packedAtlasUrl` + the committed placeholder):

```ts
export const PROP_SIGN_TEXTURE_KEY = 'frlg:sign';
export const PROP_SIGN_URL: string;   // packed ../assets/frlg/sign.png, else the placeholder
export const PROP_SIGN_SIZE = 16;
export const PROP_SIGN_FRAME = 0;     // the single 16x16 cell
```

`BootScene` loads it as a **spritesheet** of one 16×16 frame
(`this.load.spritesheet(PROP_SIGN_TEXTURE_KEY, PROP_SIGN_URL, { frameWidth: PROP_SIGN_SIZE, frameHeight: PROP_SIGN_SIZE })`).
`RouteScene` draws `add.image(centerX(sign.x), centerY(sign.y), PROP_SIGN_TEXTURE_KEY, PROP_SIGN_FRAME)`.
No `src/data/dex/**` file is touched.

### Scene — `src/scenes/RouteScene.ts`

1. **Which edge.** A private helper on the room view already on screen:

   ```ts
   private bossLinkEdge(room: RoomView | undefined): MapEdge | undefined
   ```

   It walks **every** opening of `room` (`links` **and** the portal; the portal's
   `roomAcross` is `undefined`) and returns the first whose
   `roomAcross(this.plan, room.roomId, opening.edge) === this.plan.bossRoom`.
   Do **not** filter by `role === 'exit'`: the role is the arrival's and changes
   when the player walks in from the boss room, while the sign's cell must not.
   Returns `undefined` when there is no plan (dev generator, frame-map import) or
   no such link (the boss room itself, the entry, every leaf).
2. **Pass it.** `buildRoute` passes `...(signEdge ? { signEdge } : {})` in the
   `RouteRequest`. Nothing is added to `RouteParams`; the edge is derived.
3. **Draw.** A `drawSigns()` method (`if (this.generatorStepIndex !== null) return;`
   then one image per `this.route.signs ?? []`, depth `5`, centred, scale
   `TILE_SIZE / PROP_SIGN_SIZE` = 1.5, pushed to `entitySprites` and ignored by the
   HUD camera). Call it from the draw pass every rebuild already runs — the three
   live paths are `create`, `transitionTo` and `rebuildRoom`, plus the two debug
   rebuild paths; ending `drawItems()` with `this.drawSigns()` covers all of them
   and is the recommended seam (say so in the comment).
4. **Solid.** `signBlocks(tile)` true when a sign sits on `tile`; add it to both
   movement guards that already read `itemBlocks`/`npcBlocks` (the `update` step at
   ~4352 and the chase path at ~2748).
5. **Interact.** In `tryInteract`, after the special NPC and **before** the
   trainer: if the tile the player faces (or stands on, for a sign underfoot) holds
   a sign, open its card and return. The card is the NPC card, no choices:
   `openNpcCardView({ title: t(sign.text), paragraph: '' })`. `sign.text` is the
   i18n **key**; resolve it at open time so a locale switch shows the new string.
   The card closes on the same keys an NPC card does (`LEAVE`, interact, confirm,
   cancel) and the room teardown (`closePanel`) destroys it.
6. No run field, no `SAVE_VERSION` step, no `localStorage` change.

### Data

- `boss.sign` — English `'BOSS ROOM'`, Spanish `'SALA DEL JEFE'`; the card's
  title, and the only new key. Authored in `src/i18n/en.ts` first, overlaid in
  `src/i18n/es.ts` (D43).
- `RouteMap.signs[].text` holds the **key** `'boss.sign'`, never a translated
  string (the engine stays i18n-free).

### Packer — `scripts/frlg/build-sign.mjs` (new)

- Reads `assetPath('frlg/tileset-2.png')` (`scripts/assets/root.mjs`, so
  `ASSETS_ROOT` or an argv store; **never** a path inside the worktree).
- Cuts the 16×16 cell at `x = 1 + 23 * 17 = 392`, `y = 1 + 3 * 17 = 52` with
  `decodePng`/`encodePng` from `scripts/legacy-art/png-codec.mjs`, **copying RGBA
  as-is**: the cell already carries alpha (68 of its 256 pixels are transparent,
  all four corners among them), so there is **no colour key and no background
  sniffing**.
- Writes `src/assets/frlg/sign.png` (mkdir the directory first), 16×16.
- Add the step to `scripts/assets/pack.mjs` beside `frlg field items`:
  `{ name: 'frlg boss-room sign', script: 'scripts/frlg/build-sign.mjs',
  needs: requires(['frlg/tileset-2.png']), env: true }`.
- Add `'frlg/sign.png'` to `ATLASES` in `scripts/assets/build-placeholders.mjs`,
  and commit `src/assets/placeholders/frlg/sign.png` as a 16×16 blank in the
  script's own `FILL`/`BORDER` style (the whole point of the placeholder is that a
  clone without the store still loads a 16×16 texture).

### Docs

- `docs/routes-spec.md` §2: the sign as an interactable the room build places
  (beside the boss link, solid, no RNG, one per floor).
- `docs/maps-spec.md` §6: the boss room's door has a sign on the **approach**
  side — in the room that links into it, one tile inside the band.
- `docs/tileset-spec.md` §2: the sign is its **own** 16×16 prop texture
  (`src/assets/frlg/sign.png`, `src/data/tilesets/props.ts`), not a 14th atlas row.

## 🧩 Data and configuration

No balancing values. The only numbers are the source cell (`23,3` at a 17px pitch
and a 1px origin) and the 16×16 size, both named in `build-sign.mjs`/`props.ts`.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `node scripts/frlg/build-sign.mjs` **first** (`ASSETS_ROOT` is set in this
    environment; the output is gitignored) so the art test and the live pass see
    real art.
  - `npm test` — Vitest, headless; green, including the new tests.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-<ID>` audit against the exclusive paths list.
  - `[live]` runs on the dev server with headless Chromium over CDP. Reach the
    scene with the page's own module graph (`await import('/src/main.ts')` → the
    exported `game`), so the measurements read the live scene and the canvas
    (`renderer.snapshotArea` + `getImageData`), not a screenshot.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `bossSign` returns `opening + inward` for all four edges, and
        building the same room twice puts the sign in the same cell.
  - [ ] `[unit]` On 20 fixed seeds, the room that links into the boss room gets
        exactly one sign; it is walkable, it is **not** on
        `openingBandCells(edge, anchor, w, h, 2)`, the lane's other cell is
        walkable, and no trainer or visible item stands on it. The boss room
        itself, the entry room and every leaf get none.
  - [ ] `[unit]` The packed `src/assets/frlg/sign.png` is 16×16 with all four
        corners `alpha 0` and exactly 68 transparent pixels
        (`describe.skipIf(!hasArt('frlg/sign.png'))`).
  - [ ] `[unit]` `en['boss.sign']` and `es['boss.sign']` are non-empty,
        different strings, and a route sign's `text` is the key `'boss.sign'`.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` **Drawn in the approach room:** the room that links into the
        boss room has `route.signs.length === 1`; a display object with texture
        key `frlg:sign` exists at `(centerX(sign.x), centerY(sign.y))`, is
        `visible`, and `renderer.snapshotArea` over that 24×24 cell contains a
        pixel that is not the cell's floor colour (real art packed). The same
        read in the boss room and in the room's own previous/next room returns
        `0` signs.
  - [ ] `[live]` **Solid, door still passable:** standing on the lane's free cell
        and pressing the direction into the sign leaves `scene.player` on the same
        tile; pressing the direction along the free cell onto the border band
        reaches the band and transitions to `plan.bossRoom` within 2 s.
  - [ ] `[live]` **The popup:** facing the sign and pressing the interact key
        opens the room's card (`roomPanel !== null`) whose bitmap text is exactly
        `t('boss.sign')`, and the cancel/interact key closes it
        (`roomPanel === null`).

## 📣 Coordination

- For the Architect: `RouteMap.signs` is **optional** (`signs?:`) on purpose —
  every hand-built `RouteMap` fixture in `src/**` stays valid, the same way
  `gate?` and `chamber?` are optional. The plan's wording (`signs: readonly
  RouteSign[]`) is the shape, not a required field.
- For the next batch: the sign is one per floor, in the approach room, keyed
  `boss.sign`; it adds no state and no RNG stream.
- Asset trees: the packer reads `ASSETS_ROOT` through `assetPath`; no tree under
  `sprite-sources/` or the store is linked into the worktree.

## ⛔ Out of scope

- A sign anywhere else (the portal, the entry, special leaves), sign text other
  than `boss.sign`, more than one sign per floor.
- Growing the FRLG atlas to a 14th row, repacking the three tilesets, or re-pinning
  the `TILESET_COLS`/`TILESET_ROWS` contract.
- A new panel component, a transient notice, a run field, a save migration, or any
  change to `src/data/dex/**`.
- Ripped output in git: `src/assets/frlg/sign.png` stays gitignored.
