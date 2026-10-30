# Spec: Task-231 — A walker's size is the species' own, like Anil's, on the route and in the main menu

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** data table (pure) + Phaser-side render helper + HUD value model + one
  scene call.
- **Role:** Dev.
- **Objective:** The party's follower on the route and the walkers in the main menu's
  decorative route window stop drawing every species at one fixed height. After this
  task one pure function, `overworldScale(speciesId)`, turns a species' canonical
  height into a scale inside a frozen `0.8..1.6` band of a 24 px tile, through the
  battle sprite's own power curve — so a titan fills its tile and a small species
  keeps headroom — and both places read it: the route follower draws at
  `TILE_SIZE × overworldScale` with its feet on the tile's bottom edge, and the main
  menu's walker keeps its 24 px box and draws the pair inside it at the species' own
  cell height. The animation cadence does not change: `FOLLOWER_FRAME_RATE` for every
  species. No card moves, no rect changes, no RNG draw, no run field, no engine file.
- **Environment:** worktree `../wt-pkm-231`, branch `task-231`, cut from `main`.
  Work only inside that worktree.
- **Dependencies:** **none.** Every seam this task builds on is already merged:
  - `battleSpriteHeight` / `SPRITE_SIZE_EXPONENT` / `SPRITE_SIZE_REF_HEIGHT` in
    `src/data/spriteSize.ts` (the battle's power curve, reused here).
  - `heightOf(speciesId)` in `src/data/dex/species.ts` (canonical height in metres,
    re-exported by `src/data/dex/index.ts`).
  - `PokemonOverworldSheet` in `src/data/pokemonOverworld.ts` (a 32 px cell, five
    direction rows, `speciesId`, `size`, `cols`, `rows`).
  - `buildFollower` in `src/scenes/RouteScene.ts` — already `.setOrigin(0.5, 1)` with
    `footY = centerY(tile) + TILE_SIZE / 2`, so the feet anchor ships; only the scale
    is fixed.
  - `walkerPaint` in `src/ui/hud/panels/main-menu/routeWindow.ts` — its
    `pairCellScale(sheet) = PREVIEW_TILE / sheet.size` is the one fixed height to
    replace.

### Exclusive paths (single writer)

**Nothing outside this list.** No other task in the batch claims any of them.

- `src/data/overworldSize.ts` — **new**: the species → overworld scale table.
- `src/data/overworldSize.test.ts` — **new**: its tests.
- `src/render/pokemonFollower.ts` — add `FollowerFit` + `followerFit(sheet)`.
- `src/render/pokemonFollower.test.ts` — its tests.
- `src/ui/hud/panels/main-menu/routeWindow.ts` — the walker's cell height.
- `src/ui/hud/panels/main-menu/routeWindow.test.ts` — its tests.
- `src/scenes/RouteScene.ts` — **`buildFollower` only** (the `footY` line and the
  `setScale` call).
- `src/render/README.md` — one sentence on the `pokemonFollower.ts` bullet.
- `src/ui/hud/panels/main-menu/README.md` — one sentence on the `routeWindow.ts`
  bullet and one on rule 6.
- `src/data/README.md` — one bullet in `## Layout` for the new file. *(This path is not
  in the Orchestrator's frozen list; it is required by `AGENTS.md`'s "a task that
  adds a file updates that folder's `README.md` in the same task". It collides with no
  other task in the batch — the plan records it as an Architect addition.)*
- `docs/design-spec.md` — **§2 and §5 only**, and inside them only the two blocks
  named below.

Explicitly **not** yours: `src/engine/routes/preview.ts` and
`src/ui/hud/panels/main-menu/main-menu.css` (both Task-232's, next cycle),
`mainMenuPanel.tsx`, `mount.tsx`, `preview.ts`, `src/data/spriteSize.ts`
(read-only import — it does **not** carry a canonical-height table, so the new file is
the right home), `src/data/dex/**`, `src/i18n/**`, `src/engine/**`, `package.json`,
`src/main.ts`, `vite.config.ts`, any packed asset.

### Inputs (read-only)

- `AGENTS.md`.
- `docs/design-spec.md` — §2 (the main menu's run bullet whose long sentence describes
  the "live route" window) and §5 (the route's bullet list). You edit only those two
  blocks, per the exact wording below.
- `src/data/spriteSize.ts` — `SPRITE_SIZE_REF_HEIGHT` (1), `SPRITE_SIZE_EXPONENT`
  (0.5), `SPRITE_SIZE_BASE`, `SPRITE_SIZE_MIN`/`MAX` and `battleSpriteHeight`, the
  curve this task compresses into the overworld band.
- `src/data/dex/species.ts` — `heightOf(speciesId): number`, canonical metres, `1`
  for an unknown id.
- `src/data/pokemonOverworld.ts` — `PokemonOverworldSheet` and `pokemonOverworldSheet`
  (`size` is the manifest's 32 px cell; `speciesId` is the dex id the sheet was
  resolved for).
- `src/render/pokemonFollower.ts` + `.test.ts` — the registry you extend. Note the
  test's `describe.skipIf(!hasArt('pokemon/1.png'))`: your new tests must **not** go
  inside a skipped block, so build a synthetic sheet literal (as
  `routeWindow.test.ts` does with its `SHEET` constant) instead of loading committed
  art.
- `src/engine/tileset.ts` — `TILE_SIZE = 24`.
- `src/ui/hud/panels/main-menu/routeWindow.ts` + `.test.ts` — `PREVIEW_TILE`,
  `previewWalkerBox`, `walkerPaint` and its `WalkerPaint` shape, the `SHEET` fixture
  and every existing expectation you must re-derive.
- `src/ui/hud/panels/main-menu/mainMenuPanel.tsx` — **read only**, to confirm the
  contract: it feeds `walkerPaint`'s `box` to `boxPaint` (inline `left`/`top`/
  `width`/`height`) and its `backgroundImage`/`backgroundPosition`/`backgroundSize`
  to the element's own style. Because `box` keeps its 24 × 24 rect and both
  background values are plain CSS strings, **this file does not change**.
- `src/ui/hud/panels/main-menu/main-menu.css` — **read only**: `.main-menu__walker`
  is a 24 px absolutely positioned box whose backgrounds are clipped to it, and its
  transition covers `left`/`top` only (never the background), which is why a species'
  size can change the paint without smearing the slide.
- `src/scenes/RouteScene.ts` — `buildFollower` (around line 1843), `restFollower`
  (around 1700), `stepFollower` (around 1882) and `refreshFollower` (around 1808,
  which already rebuilds the follower on a lead species change).
- **Board input.** The imported board specs `design/screens/<slug>.json` and their
  exports `design/exports/<slug>.png` **are not on `main`** (they are the operator's
  blocked import, `[Task-223]`/`[Task-224]`), so they are not inputs and no criterion
  depends on them. The committed artifacts below are the **geometry of record**, and
  QA reads fidelity from them and never from a screenshot diff (`D57`):
  - Route HUD — `design/frames/03-route-hud.json` (caption **`03 Route HUD`**) and
    `design/screens/03-route-hud.png`.
  - Main menu — `design/frames/01-main-menu.json` (caption **`01 Main menu`**) and
    `design/screens/01-main-menu.png`, plus the phone twins
    `design/frames/m01-main-menu.json` and `design/screens/m01-main-menu.png`.
  This task moves **no** measured rect: the window, the 24 px cells, the title, the
  card and the footer are untouched. It changes only the scale of the pair drawn
  inside a walker's cell and of the follower's sprite.

## 🔒 Contract

The public surface other tasks will be written against. It is a promise.

### TypeScript

**New — `src/data/overworldSize.ts`** (pure: no Phaser, no DOM, no clock, no RNG, no
locale; imports only `./dex` and `./spriteSize`):

```ts
import { SPRITE_SIZE_EXPONENT, SPRITE_SIZE_REF_HEIGHT } from './spriteSize';

/** The battle curve's exponent, reused verbatim: `height ** 0.5`. */
export const OVERWORLD_SCALE_EXPONENT = SPRITE_SIZE_EXPONENT; // 0.5
/** The height (m) that maps to a scale of 1: the 1 m reference species. */
export const OVERWORLD_SCALE_REF_HEIGHT = SPRITE_SIZE_REF_HEIGHT; // 1
/** The frozen band a species' overworld height lives in, as a fraction of its cell. */
export const OVERWORLD_SCALE_MIN = 0.8;
export const OVERWORLD_SCALE_MAX = 1.6;

/**
 * A species' overworld scale: `clamp((max(0.1, heightOf(id)) / REF) ** EXPONENT,
 * MIN, MAX)`. Monotonic in canonical height, floored at 0.8, capped at 1.6, and
 * `1` for an unknown id (whose `heightOf` is 1).
 */
export function overworldScale(speciesId: string): number;

/** The drawn height in px of a species' overworld sprite in a `cellPx` cell. */
export function overworldDrawHeight(speciesId: string, cellPx: number): number;
// === cellPx * overworldScale(speciesId)

/**
 * The height in px a species draws inside a `cellPx` cell so that even the tallest
 * (`OVERWORLD_SCALE_MAX`) fits it: `max(1, round(cellPx * overworldScale(id) /
 * OVERWORLD_SCALE_MAX))`. At `cellPx = 24` this is an integer 12…24, which keeps
 * pixel art crisp and the walker inside its tile.
 */
export function overworldCellHeight(speciesId: string, cellPx: number): number;
```

Published values (pinned by the tests; `TILE_SIZE`/`PREVIEW_TILE` = 24):

| species | `heightm` | `overworldScale` | drawn px at 24 | `overworldCellHeight(…, 24)` |
| --- | --- | --- | --- | --- |
| `diglett` | 0.2 | `0.8` (floor) | 19.2 | 12 |
| `pikachu` | 0.4 | `0.8` (floor) | 19.2 | 12 |
| `bulbasaur` | 0.7 | `0.836660…` | 20.08 | 13 |
| `charizard` | 1.7 | `1.303840…` | 31.29 | 20 |
| `snorlax` | 2.1 | `1.449138…` | 34.78 | 22 |
| `wailord` | 14.5 | `1.6` (cap) | 38.4 | 24 |

**Changed — `src/render/pokemonFollower.ts`** (keep every existing export and value:
`FOLLOWER_FRAME_RATE`, `FOLLOWER_ANIMS`, `FollowerFacing`, `followerDirRowName`,
`followerDirRow`, `followerFrame`, `followerIdleFrame`, `followerAnimKey`,
`FollowerAnim`, `followerAnims`):

```ts
/** The route follower's own geometry for a lead's pair. */
export type FollowerFit = Readonly<{
  /** The sprite scale that draws `sheet.size` px of art as `TILE_SIZE × overworldScale`. */
  scale: number;
  /** Distance from the tile's centre to its bottom edge, where the sprite's feet sit. */
  feetOffset: number;
}>;

/**
 * The fit a follower draws with: `scale = overworldDrawHeight(sheet.speciesId,
 * TILE_SIZE) / sheet.size` and `feetOffset = TILE_SIZE / 2`. Pure and total; reads
 * no RNG, no clock, no locale, no save.
 */
export function followerFit(sheet: PokemonOverworldSheet): FollowerFit;
```

**Changed — `src/ui/hud/panels/main-menu/routeWindow.ts`** (keep every existing
export and value: `ROUTE_PREVIEW_STEP_MS`, `WALK_STEP_MS`, `WALK_FRAME_MS`,
`previewRoomFor`, `previewOrigin`, `previewTileBox`, `previewWalkerBox`,
`tileBackground`, `WalkerPaint`, `walkerPaint`). `pairCellScale(sheet)` is replaced by
a species-aware cell, and `walkerPaint`'s returned shape does **not** change — still
`{ box, backgroundImage, backgroundPosition, backgroundSize, transform, transitionMs,
frame }`, with `box` still exactly `previewWalkerBox(...)`:

```ts
// inside walkerPaint, for a sheet with a frame:
const cell = overworldCellHeight(sheet.speciesId, PREVIEW_TILE); // 12…24, integer
const scale = cell / sheet.size;                                 // the sheet's own scale
const dx = Math.floor((PREVIEW_TILE - cell) / 2);                // horizontal centring
const dy = PREVIEW_TILE - cell;                                  // feet on the box's bottom
// ...
backgroundSize: `${sheet.cols * cell}px ${sheet.rows * cell}px`,
backgroundPosition: `${-col * cell + dx}px ${-row * cell + dy}px`,
```

The drawn cell therefore occupies `[dx, dx + cell] × [dy, dy + cell]` inside the
24 × 24 box, i.e. always inside it, always bottom-centred. `transform`,
`transitionMs`, `frame`, the `backgroundImage` URL and the portrait fallback path are
unchanged.

**Changed — `src/scenes/RouteScene.ts`, `buildFollower` only:**

```ts
// was: const footY = this.centerY(this.player.y) + TILE_SIZE / 2;
const fit = followerFit(sheet);
const footY = this.centerY(this.player.y) + fit.feetOffset;
const sprite = this.add
  .sprite(this.centerX(this.player.x), footY, sheet.textureKey, 0)
  .setOrigin(0.5, 1)
  .setScale(fit.scale)   // was TILE_SIZE / sheet.size
  // ... the rest of the chain unchanged (depth, flip, entitySprites, restFollower)
```

`stepFollower` and `restFollower` keep their `centerY(...) + TILE_SIZE / 2`: it equals
`feetOffset` and a test pins that equality. Do not touch any other member.

- **Determinism:** **reads no RNG.** `overworldScale`, `overworldDrawHeight`,
  `overworldCellHeight`, `followerFit` and `walkerPaint` are pure functions of their
  arguments; the render helper reads no clock and no DOM. The follower's frame rate
  stays `FOLLOWER_FRAME_RATE` (5 fps) for every species — the report's «animaciones»
  is read as cadence, never as a per-species speed.
- Rules: `src/engine/` stays Phaser-free and deterministic (it is not touched at all);
  `src/render/` imports no Phaser (rule 1 of its README); balance and the species
  table live in `src/data/`, never in a scene.

### Data

- `src/data/overworldSize.ts` introduces the four constants and the three functions
  above. No new JSON, no new manifest key, no i18n key, no default that a save reads,
  no `SAVE_VERSION` step.

## 🧩 Data and configuration

| Key | Shape | Unit | Default |
| --- | --- | --- | --- |
| `OVERWORLD_SCALE_EXPONENT` | `number` (== `SPRITE_SIZE_EXPONENT`) | exponent | `0.5` |
| `OVERWORLD_SCALE_REF_HEIGHT` | `number` (== `SPRITE_SIZE_REF_HEIGHT`) | metres | `1` |
| `OVERWORLD_SCALE_MIN` | `number` | fraction of the cell | `0.8` |
| `OVERWORLD_SCALE_MAX` | `number` | fraction of the cell | `1.6` |

Meaning: a species of `OVERWORLD_SCALE_REF_HEIGHT` metres draws its cell at 1× that
cell; the band is the frozen 0.8–1.6 of the tile; the exponent is the battle sprite's
own compression, so the two surfaces agree about who is big. A route follower's drawn
height is `TILE_SIZE × overworldScale` (19.2 … 38.4 px); a main-menu walker's drawn
cell is `overworldCellHeight(id, 24)` (12 … 24 px) inside its unchanged 24 px tile.

### Docs edits (verbatim anchors)

Append the clauses below; do not rewrite the surrounding sentences, do not reflow the
paragraph and do not touch any other section.

1. `docs/design-spec.md` **§2**, in the main-menu bullet's "live route" sentence —
   immediately after the words "(the `idle` strip while it stands)" and before
   "and, where the pair's local art is absent":
   `" at the species' own height inside its 24 px tile (`overworldScale`,
   `src/data/overworldSize.ts`: the tallest fills the cell and the smallest keeps
   headroom),"`.
2. `docs/design-spec.md` **§5**, one **new last bullet** of the section:
   `"- **The follower is the lead's own size.** The party's lead follows you drawn
   from its own overworld pair at the species' canonical height, never at one fixed
   tile height: `overworldScale` compresses the 0.1–20 m range into a frozen
   `0.8..1.6` of the 24 px tile through the battle sprite's own power curve, the
   sprite is anchored at the feet (bottom-centre of the tile) so a titan grows upward
   and never off its tile, and the cadence is the same `FOLLOWER_FRAME_RATE` for
   every species — the size differs, the rhythm does not."`
3. `src/render/README.md`, on the `pokemonFollower.ts` bullet, after "Running is the
   walk strip played with the player's own time scale (`D24`).":
   `" The follower's own fit is `followerFit`: the pair drawn at
   `TILE_SIZE × overworldScale(speciesId)` with its feet on the tile's bottom edge."`
4. `src/ui/hud/panels/main-menu/README.md`, on the `routeWindow.ts` bullet, after
   "…a flip and a transition length.":
   `" The cell a walker draws is the species' own height inside its 24 px box
   (`overworldScale`, `src/data/overworldSize.ts`), bottom-centred, so a taller
   species draws bigger and the box never moves."`
5. `src/ui/hud/panels/main-menu/README.md`, rule 6, after "playing the pair's `walk`
   strip while it moves and its `idle` strip while it stands;":
   `" the cell it draws is the species' own height inside the 24 px box
   (`overworldCellHeight`), so a Wailord fills the tile and a Diglett keeps
   headroom;"`
6. `src/data/README.md`, one **new bullet** in `## Layout`, directly after the
   `pokemonOverworld.ts` bullet:
   `"- `overworldSize.ts` — the overworld size table: `overworldScale(speciesId)`
   compresses a species' canonical height into the frozen `0.8..1.6` band of its
   tile through the battle sprite's own power curve (`spriteSize.ts`), with
   `overworldDrawHeight` and `overworldCellHeight` for the follower and the main
   menu's walkers (`docs/design-spec.md` §2/§5)."`


## 🧪 Test and Validation Plan (for QA)

QA runs this verbatim. **The dev runs `npm test` and `npm run build` before
`dev: done`; QA re-runs both in its own integration worktree** (this branch merged
onto the batch base) and audits the diff.

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-231` — must list exactly the eleven exclusive
    paths (the two new files show as added).
  - No test in this task may depend on the committed art: the follower and walker
    tests build a synthetic `PokemonOverworldSheet` literal (32 px cell) instead of
    calling `pokemonOverworldSheet`, so they run in a clone without
    `src/assets/pokemon/`.
  - One `[live]` criterion needs a browser (`npm run dev` + CDP over headless
    Chromium at 1280×800). The `[unit]` criteria owe no browser pass.

### Acceptance criteria

- [ ] `[unit]` **It typechecks and builds clean.** `npm run build` exits `0`.
- [ ] `[unit]` **The declared tests exist and pass.** `npm test` exits `0`, and
  `npx vitest run src/data/overworldSize.test.ts src/render/pokemonFollower.test.ts
  src/ui/hud/panels/main-menu/routeWindow.test.ts` names all of:
  `overworldScale is monotonic in canonical height`, `overworldScale is floored at
  0.8 and capped at 1.6`, `the curve is the battle sprite's power curve`, `a decade
  apart lands in the band and differs`, `the drawn height and the cell height are
  the scale's own`, `followerFit's scale and feet come from one call`, `followerFit
  keeps the follower's feet on the tile's bottom edge`, `a walker keeps its 24 px box
  and draws the species inside it`, `a taller pair draws a bigger cell in the same
  box`, `walkerPaint still answers with no RNG and no clock`.
- [ ] `[unit]` **Nothing outside the exclusive paths was touched.**
  `git diff --name-only main...task-231` prints exactly: `docs/design-spec.md`,
  `src/data/README.md`, `src/data/overworldSize.test.ts`,
  `src/data/overworldSize.ts`, `src/render/README.md`,
  `src/render/pokemonFollower.test.ts`, `src/render/pokemonFollower.ts`,
  `src/scenes/RouteScene.ts`, `src/ui/hud/panels/main-menu/README.md`,
  `src/ui/hud/panels/main-menu/routeWindow.test.ts`,
  `src/ui/hud/panels/main-menu/routeWindow.ts`. In particular `src/data/spriteSize.ts`,
  `main-menu.css`, `mainMenuPanel.tsx`, `src/engine/routes/preview.ts` and the
  `src/data/dex/` files appear **not at all**.
- [ ] `[unit]` **`overworldScale` is monotonic, floored and capped** — two tests. In
  `overworldScale is monotonic in canonical height`: over
  `['joltik','diglett','pikachu','bulbasaur','charizard','snorlax','onix','wailord']`
  in ascending `heightOf` order, every consecutive pair satisfies
  `overworldScale(later) >= overworldScale(earlier)`, and every value is in
  `[OVERWORLD_SCALE_MIN, OVERWORLD_SCALE_MAX]`. In `overworldScale is floored at 0.8
  and capped at 1.6` the two ends are exact:
  `expect(overworldScale('diglett')).toBe(OVERWORLD_SCALE_MIN)` and
  `expect(overworldScale('wailord')).toBe(OVERWORLD_SCALE_MAX)`.
- [ ] `[unit]` **The curve is the battle sprite's power curve.**
  `expect(OVERWORLD_SCALE_EXPONENT).toBe(SPRITE_SIZE_EXPONENT)` and
  `expect(OVERWORLD_SCALE_REF_HEIGHT).toBe(SPRITE_SIZE_REF_HEIGHT)`, and the in-band
  pair `bulbasaur` (0.7 m) / `snorlax` (2.1 m) satisfies
  `expect(overworldScale('snorlax') / overworldScale('bulbasaur')).toBeCloseTo(
  Math.sqrt(2.1 / 0.7), 9)` — i.e. `sqrt(3) = 1.732050808`, the curve's own ratio,
  with no clamp in play.
- [ ] `[unit]` **A decade apart lands in the band and differs.**
  `overworldScale('diglett')` and `overworldScale('wailord')` are a decade-plus apart
  in `heightOf` (0.2 m vs 14.5 m), both sit inside the band, and
  `overworldScale('wailord') / overworldScale('diglett') === OVERWORLD_SCALE_MAX /
  OVERWORLD_SCALE_MIN === 2`.
- [ ] `[unit]` **The drawn height and the cell height are the scale's own.**
  For `diglett` and `wailord`: `overworldDrawHeight(id, 24) === 24 *
  overworldScale(id)`; `overworldCellHeight(id, 24)` is an integer, `>= 1`, and
  `<= 24`; `overworldCellHeight('diglett', 24) === 12` and
  `overworldCellHeight('wailord', 24) === 24`. An unknown id
  (`overworldScale('not-a-species')`) is `1`, because `heightOf` answers `1`.
- [ ] `[unit]` **The follower's scale and its feet `y` come from the same call.** With
  a synthetic sheet `{ ...SHEET, size: 32, speciesId: 'diglett' }` and the same sheet
  with `speciesId: 'wailord'`: `followerFit(diglett)` is `{ scale: 0.6, feetOffset:
  12 }` and `followerFit(wailord)` is `{ scale: 1.2, feetOffset: 12 }` (to 10
  decimals); `scale * sheet.size` is `19.2` and `38.4`, both inside
  `[TILE_SIZE * 0.8, TILE_SIZE * 1.6]`.
- [ ] `[unit]` **The follower's feet sit on the tile's bottom edge.**
  `followerFit(sheet).feetOffset === TILE_SIZE / 2` for both species, and the same
  for a sheet whose `size` is not 32 (e.g. 16), because the feet line does not depend
  on the art.
- [ ] `[unit]` **A walker keeps its 24 px box and draws the species inside it.**
  For the `diglett` and `wailord` sheets (built as `{ ...SHEET, speciesId: 'diglett' }`
  and `{ ...SHEET, speciesId: 'wailord' }`, as the follower test does) at the existing
  `DESK` window and the existing `WALKER`: `paint.box` deep-equals
  `previewWalkerBox(DESK, room, WALKER)` (`{ x: 52, y: 82, w: 24, h: 24 }`) for both,
  `paint.backgroundSize` is `336px 60px` (diglett: `28 × 12`, `5 × 12`) and
  `672px 120px` (wailord: `28 × 24`, `5 × 24`), and the drawn cell lies inside the
  box: with `cell = overworldCellHeight(id, 24)`, `dx = Math.floor((24 - cell) / 2)`
  and `dy = 24 - cell`, `dx >= 0`, `dx + cell <= 24`, `dy >= 0`, `dy + cell <= 24`.
- [ ] `[unit]` **A taller pair draws a bigger cell in the same box, and the sheet cut
  still lands on the named frame.** The existing `walkerPaint` expectations are
  re-derived, not deleted: with the `SHEET` fixture (`pikachu`, `0.4 m`, floored to
  `0.8`, so `cell = 12`) the south `walk` step-1 frame is still `frame === 4` with
  `backgroundPosition === '-42px 12px'` and `backgroundSize === '336px 60px'`, the
  idle frame is still `frame === 0` with `backgroundPosition === '6px 12px'`, the
  `E`/`W` side row is still `frame === 116` with `-42px -36px` and `scaleX(-1)` only
  for `W`, `transitionMs` is still `WALK_STEP_MS` on a step and `0` on `instant`, and
  the portrait fallback still returns `frame === null`, a portrait `backgroundImage`,
  `box === { x: 52, y: 82, w: 24, h: 24 }` and a `backgroundSize` untouched by the
  species.
- [ ] `[unit]` **`walkerPaint` answers with no RNG and no clock.** Calling
  `walkerPaint(...)`, `followerFit(...)` and `overworldScale(...)` twice on the same
  arguments deep-equals the first answer, and the three modules import no Phaser, no
  `Math.random`, no `Date` and no DOM (`scripts`-free `expect` on the source is not
  needed: `npm run build` plus the existing lint-free typecheck and the headless test
  run prove it by running at all).
- [ ] `[live]` **At 1× screen scale two species a decade apart both stand on their
  tile's bottom edge and their drawn heights differ inside the band.** Measurement,
  at viewport 1280×800 with `window.devicePixelRatio === 1` (so one world px is one
  screen px; the route's own `cameras.main.zoom` is 2 on a desk profile and does not
  enter this read, because `displayHeight`, `originY` and `y` are world-space), on a
  dev server over CDP:
  1. Boot `http://localhost:5173/?hud=dom`, start a run and reach the route.
  2. In `Runtime.evaluate` (awaitPromise): `const { game } = await
     import('/src/main.ts'); const route = game.scene.getScene('Route');
     route.addDebugPokemon('diglett', 5); route.addDebugPokemon('wailord', 5);`
     — the two members land at the end of the party.
  3. Open the party card from the route strip's PARTY badge, then drag the
     `[data-hud-party-member]` row of `diglett` onto the first row with
     `Input.dispatchMouseEvent` (`mousePressed` → a few `mouseMoved` → `mouseReleased`
     on row 0). The drag reorders the party, so `diglett` becomes the lead and
     `refreshFollower` rebuilds the follower.
  4. Read in the page, in the same evaluation:
     `const R = (await import('/src/main.ts')).game.scene.getScene('Route');
     const s = R.followerSprite; return { species: R.run.party[0].fighter.speciesId,
     x: s.x, y: s.y, originY: s.originY, displayHeight: s.displayHeight,
     foot: R.centerY(R.player.y) + 12, zoom: R.cameras.main.zoom };`
     (`private` is a compile-time modifier; these fields are readable at runtime, the
     same way the battle gates read `BattleScene`.)
  5. Repeat steps 3–4 with the `wailord` row.
  6. **Pass** when, for **both** reads: `species` is `diglett` then `wailord`;
     `originY === 1`; `Math.abs(y - foot) <= 0.5` (the sprite stands on its tile's
     bottom edge); `Math.abs(displayHeight - 24 * overworldScale(species)) <= 0.5`
     with `overworldScale` imported from `src/data/overworldSize.ts` in the same
     evaluation; and `displayHeight / 24` is inside `[0.8, 1.6]`. And across the
     pair: `displayHeight(wailord) / displayHeight(diglett) === 1.6 / 0.8 === 2`
     within `± 0.01`, i.e. exactly the band's ratio. Nothing is read from a
     screenshot (`D57`). Precondition: the checkout has the packed pair art
     (`src/assets/pokemon/*.png`, rebuilt by `npm run assets:pack`); with no art the
     follower is `null` and this criterion is **not-run**, never failed.

## 📣 Coordination

- **For the Architect:** the fill of Batch 98 holds. This task's paths are disjoint
  from `[Task-227]`'s (which owns `src/scenes/BattleScene.ts`,
  `src/ui/hud/panels/battle-log/**` and `docs/battle-spec.md` §3); the two share no
  file, no hot file and no data file. One addition was made to the frozen list:
  `src/data/README.md`, required by `AGENTS.md`'s folder-map rule for the new file.
- **For the next batch (`[Task-232]`, the walkers' stride and lit tile):** this task
  changes only `walkerPaint`'s `backgroundSize`/`backgroundPosition` and leaves
  `box`, `transitionMs`, `frame` and the whole model alone; `main-menu.css` and
  `mainMenuPanel.tsx` are untouched, so Task-232 is free to change the tick, the
  plate and the trail on top of it. **If Task-232 wants a walker to draw outside its
  tile**, it must give the walker element a larger box (the component's
  `boxPaint`) — today the element is the 24 px tile and its backgrounds are clipped
  to it, which is exactly why the species' size shows as the sheet's scale inside
  the cell.
- **For the next batch:** `overworldScale` is the one place a species' overworld
  size is decided. Any new overworld surface (a second follower, a party member drawn
  on the map) reads it, never `sheet.size` arithmetic of its own.
- **For the docs:** `docs/design-spec.md` §5 gains the follower's size bullet and §2
  gains the walker clause; the two are one `[Task-231]` block. No other section of
  that file is edited.
- **No run state, no save:** no field on `RunState`, no `SAVE_VERSION` step, no RNG
  draw — a replayed fixed seed draws the same routes, rosters and battles.

## ⛔ Out of scope

- Do **not** touch `src/engine/**`, `src/engine/routes/preview.ts` or the preview
  model: the walkers' stride, rest and trail belong to Task-232.
- Do **not** touch `main-menu.css`, `mainMenuPanel.tsx`, the mount or the preview:
  the walker's element stays the 24 px tile.
- Do **not** extend `src/data/spriteSize.ts` (it takes a height in metres and owns no
  species table) — import its two curve constants and leave the file alone.
- Do **not** change the player's own sprite scale
  (`TILE_SIZE / PLAYER_SPRITE_WIDTH`), the trainers' or the NPCs' sprite scales, or
  the battle's `battleSpriteHeight` path.
- Do **not** add a per-species frame rate, a per-species walk speed, an animation
  retime or a tween change: `FOLLOWER_FRAME_RATE` and `WALK_FRAME_MS` keep their
  values.
- Do **not** re-layout anything: no rect in `design/frames/03-route-hud.json` or
  `design/frames/01-main-menu.json` moves, no card resizes, no new asset, no new
  dependency, no `package.json`, `src/main.ts` or `vite.config.ts` edit.
- No new i18n key, no new JSON manifest and no regeneration of the dex.
