# Spec: Task-128 — The route's panel layer leaves the route scene

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene (a structural move, no rule change).
- **Role:** Dev.
- **Objective:** `src/scenes/RouteScene.ts` (8184 lines) stops being the place
  where the route's overlay chrome lives. Each of the route's eleven panels
  becomes one module under `src/scenes/panels/`, exporting a single `descriptor`
  that a registry collects from the folder itself — the shape `D47` gave the
  special-room layer (`src/scenes/rooms/types.ts` + `registry.ts` +
  `import.meta.glob(..., { eager: true })`). The scene keeps the input dispatch
  and calls the registry; no panel's frame, string, colour, geometry, order or
  repaint changes. After this task a Phase-12 migration edits one file
  (`src/scenes/panels/<name>.ts`) instead of an 8000-line scene.
- **Environment:** worktree `../wt-pkm-128`, branch `task-128`.
- **Dependencies:** none. It reads `src/scenes/rooms/{types,registry}.ts` and
  `docs/tech-decisions.md` `D47` as the pattern to copy, and
  `src/data/hudLayout.ts` (`HudPanelId`, `HUD_PANEL_IDS`, `HudLayout`) as data it
  must not change.

### It is a move, and this is what "move" means here

- **No behaviour change:** every panel draws the same frame at the same place,
  with the same text, colour, z-order, hit box and drag behaviour, on the same
  key and on the same pointer press, and the scene still walks while a pane is
  open (a quick key is a plain toggle, `D45`).
- **No RNG draw:** the panel layer reads no `Rng` stream and no roll moves; the
  route/map/encounter seeds are untouched.
- **No test re-pinned:** not one existing `*.test.ts` changes. If an existing test
  fails, the move is wrong — fix the move, never the test.
- **No save change:** no field added to `Settings`, `RunState` or the HUD layout,
  so no `SAVE_VERSION` step.
- **The scene keeps:** the keyboard (`handleAction`, the pause menu's own
  handler, the nickname/search text fields), movement and `onTileEntered`, the
  interact key, trainer sight and the chase, room transitions, the room-panel
  slot (`openPanel`/`closePanel`/`panelOpen`/`modalPanelOpen`), the dev overlay
  hooks, and the pointer *listeners* (`pointerdown`/`pointermove`/`pointerup`)
  that hand each event to the registry in order.
- **The scene loses:** the panel fields, the panel construction, the panel
  repaint bodies and the panel hit tests. Every one of them moves to its module.

### Exclusive paths (single writer)

Nothing outside this list. It is the batch's only claim on `src/scenes/`.

- `src/scenes/RouteScene.ts`
- `src/scenes/panels/types.ts` *(new)*
- `src/scenes/panels/registry.ts` *(new)*
- `src/scenes/panels/registry.test.ts` *(new)*
- `src/scenes/panels/hud.ts` *(new)*
- `src/scenes/panels/bag.ts` *(new)*
- `src/scenes/panels/pc.ts` *(new)*
- `src/scenes/panels/party.ts` *(new)*
- `src/scenes/panels/detail.ts` *(new)*
- `src/scenes/panels/map.ts` *(new)*
- `src/scenes/panels/shop.ts` *(new)*
- `src/scenes/panels/trade.ts` *(new)*
- `src/scenes/panels/rewards.ts` *(new)*
- `src/scenes/panels/notices.ts` *(new)*
- `src/scenes/panels/pause.ts` *(new)*
- `src/scenes/panels/README.md` *(new — the folder map the new folder owes)*
- `src/scenes/README.md` (the `panels/` line and the `RouteScene.ts` role line)

`src/scenes/rooms/**`, `src/ui/**`, `src/data/**`, `src/main.ts`,
`package.json`, `vite.config.ts` and every test outside `panels/` are **not**
yours.

### Inputs (read-only)

- `docs/tech-decisions.md` `D47` (the descriptor + registry + host-port shape),
  `D45` (the quick key is a toggle, never a keyboard grab), `D32` (the minimap).
- `src/scenes/rooms/types.ts`, `src/scenes/rooms/registry.ts`,
  `src/scenes/rooms/registry.test.ts`, `src/scenes/rooms/README.md` (the pattern).
- `src/data/hudLayout.ts` (`HudPanelId`, `HUD_PANEL_IDS`, `HudLayout`).
- `src/ui/` — the panel helpers the modules call (`frlg.ts`, `frlgFont.ts`,
  `floatingPanel.ts`, `notice.ts`, `partyScreen.ts`, `partyDetail.ts`, `bag.ts`,
  `shop.ts`, `mapView.ts`, `rewards.ts`, `settingsScreen.ts`) and the view models
  they read. Read, do not edit.
- `docs/design-spec.md` §5 (the route's HUD), `docs/maps-spec.md` §8 (the minimap).
- `src/scenes/RouteScene.ts` itself, before and after.

## 🔒 Contract

### `src/scenes/panels/types.ts`

```ts
import type Phaser from 'phaser';
import type { KeybindAction } from '../../data/keybinds';
import type { HudPanelId } from '../../data/hudLayout';
import type { RouteTrainer } from '../../engine/routes/routeMap';
import type { RunState } from '../../engine/run/state';
import type { Settings } from '../../engine/save';
import type { Notice } from '../../ui/notice';
import type { PartyUiState } from '../../ui/partyScreen';
import type { RoomPanel } from '../rooms/types';

/** The route's overlay panels, one descriptor each, in `order` sequence. */
export type RoutePanelId =
  | 'map'
  | 'party'
  | 'hud'
  | 'bag'
  | 'pc'
  | 'notices'
  | 'rewards'
  | 'shop'
  | 'trade'
  | 'pause'
  | 'detail';

/** One panel: what it is, when it paints and what it owns. */
export type RoutePanelDescriptor = Readonly<{
  /** The panel's id; one descriptor per id, and the registry throws on a second. */
  id: RoutePanelId;
  /** Build order and initial depth, low first. Unique across the folder. */
  order: number;
  /** The panel's saved HUD slot, when it is one of the draggable HUD panels. */
  hudPanel?: HudPanelId;
  /** Builds the panel's own objects once, inside the HUD root, and nothing else. */
  build(host: RoutePanelHost): void;
  /** Repaints the panel from the run and the ui state. Absent: nothing to repaint. */
  refresh?(host: RoutePanelHost): void;
  /** The pointer, while the panel is visible: true when this panel consumed it. */
  pointer?(host: RoutePanelHost, pointer: Phaser.Input.Pointer): boolean;
  /** A keybind action while the panel is focused: true when consumed. */
  key?(host: RoutePanelHost, action: KeybindAction): boolean;
  /** Destroys the panel's own objects. Called by the scene, never by the panel. */
  close?(host: RoutePanelHost): void;
}>;
```

`RoutePanelHost` is the frozen **minimum** port. `RouteScene` satisfies it, and a
panel reaches the scene only through it:

```ts
export type RoutePanelHost = Readonly<{
  /** The scene itself: `add`, `scale`, `cameras`, `time`, `tweens`, `input`. */
  scene: Phaser.Scene;
  /** The live run — a function, so a panel always reads the current one. */
  run(): RunState;
  /** The live settings. */
  settings(): Settings;
  /** The HUD metrics the panels lay themselves out from (`hudMetrics`). */
  hud(): HudMetrics;
  /** The container every panel's objects live in. */
  hudRoot(): Phaser.GameObjects.Container;
  /** The panel records the frame machinery registers; one array per scene. */
  panels(): readonly HudPanel[];
  registerPanel(panel: HudPanel): void;
  /** The HUD's drag/grab state, read and replaced (never mutated in place). */
  ui(): PartyUiState;
  setUi(state: PartyUiState): void;
  /** The pointer in HUD-container space, or null when it is over the route. */
  hudPointer(pointer: Phaser.Input.Pointer): { x: number; y: number } | null;
  /** Persists the run and repaints the HUD (a panel never writes the run itself). */
  commitRun(run: RunState): void;
  persistRun(): void;
  /** Asks the scene to repaint every panel once, after a change. */
  refreshHud(): void;
  /** Persists the HUD panel layout after a drag or a collapse. */
  persistHudLayout(): void;
  /** Applies the stored `HudLayout` to the panel records. */
  applyStoredHudLayout(): void;
  /** Takes the keyboard off whichever HUD pane holds it (before a modal panel). */
  releaseHudKeyboard(): void;
  /** The room-panel slot, unchanged (`D47`). */
  openPanel(panel: RoomPanel): void;
  closePanel(): void;
  panelOpen(): boolean;
  /** The transient notice strip. */
  showNotice(notice: Notice): void;
  /** The scene's own battle paths, for a panel that starts one. */
  startWildBattle(encounter: Readonly<{ speciesId: string; level: number; key: string }>): void;
  startTrainerBattle(trainer: RouteTrainer): void;
}>;
```

`HudMetrics` and `HudPanel` are **declared inside `RouteScene.ts` today**
(`HudMetrics` 580, `HudPanel` 739). They move to `src/scenes/panels/types.ts`
**verbatim** (same fields, same numbers, same defaults) and every panel imports
them from there. `hudMetrics(width)` (`RouteScene.ts` 590) moves to
`src/scenes/panels/hud.ts` and is re-exported; the scene imports it from there.

### `src/scenes/panels/registry.ts`

```ts
import type { RoutePanelDescriptor, RoutePanelId } from './types';

/** A Vite module map: what `import.meta.glob(..., { eager: true })` returns. */
export type PanelModules = Readonly<Record<string, unknown>>;

/** The route's panels, indexed once per scene. */
export type PanelRegistry = Readonly<{
  /** Every descriptor, keyed by the id it claims. */
  byId: ReadonlyMap<RoutePanelId, RoutePanelDescriptor>;
  /** Every descriptor, ascending by `order` — the build, raise and close sequence. */
  all: readonly RoutePanelDescriptor[];
}>;

/** Collects the `descriptor` each module exports. Throws on a duplicate id or order. */
export function collectPanels(modules: PanelModules): PanelRegistry;
```

Rules, copied from `collectDescriptors` (`D47`) exactly:

- A module contributes its named `descriptor` only when that export is an object
  with a string `id` in `RoutePanelId`. Every other module (`types.ts`,
  `registry.ts`, a helper) is skipped silently, so the folder may hold
  non-descriptor files.
- Two descriptors claiming **one id throw**, naming both module paths in
  module-map key order:
  `two panel descriptors claim the id ${id}: ${first}, ${second}`.
- Two descriptors claiming **one order throw** the same way:
  `two panel descriptors claim the order ${order}: ${first}, ${second}` — the
  z-order may never depend on glob order.
- `all` is sorted by ascending `order`. Nothing else sorts, dedupes or filters.
- `registry.ts` imports Phaser **not at all**, not even as a type, so the
  collection rules are unit-tested headless.

### The module convention (what a panel file is)

Every `src/scenes/panels/<name>.ts`:

- exports **exactly one** `export const descriptor: RoutePanelDescriptor` whose
  `id` is its own `<name>` (one exception, `hud.ts`, which also exports the shared
  frame helpers below);
- imports **no** scene module: never `../RouteScene`, never `../../main`; a panel
  reaches the scene through `RoutePanelHost` only;
- imports Phaser **type-only** (`import type Phaser from 'phaser'`), like
  `rooms/types.ts`, so the folder imports cleanly in a headless test. Drawing goes
  through `host.scene.add`, `addFrlgWindow`/`addFrlgText` (`src/ui/frlg*`) and the
  `src/ui/` helpers, never through a new Phaser import;
- keeps its own state (cursors, open tabs, drag ghosts) at module scope the way
  `src/scenes/rooms/shop.ts` keeps its shop state (`D47`), not on the scene;
- carries one role line in `src/scenes/panels/README.md`.

### The eleven descriptors (frozen ids, order, and what each owns)

| id | order | owns (moved out of `RouteScene.ts` unless noted) |
| --- | --- | --- |
| `map` | 10 | the route header/minimap window: `hudTitle`, `hudMapGraphics`, `hudMapEmpty`, `hudCamera`, `setupHudCamera`, `refreshMapView`, `drawMapMarker`, `drawCaptureBall`, and the `HUD_MAP_*`/`HUD_CONTENT_LEFT` geometry it reads |
| `party` | 20 | the party window and its six rows: `hudRows`, portraits, held icons, status badges, HP bars, `hudPartyRowAt`, `paneMembers`, `pointerInPartyPanel`, `hudPartyY/H/H…` |
| `hud` | 30 | the frame machinery and the strip: `makeHudPanel`, `buildPanelIcon`, `refreshPanelKeyLabels`, `hudMetrics`, `panelById`, `panelExpanded`, `panelBase`, `panelRect`, `panelIconRect`, `hudPanelAt`, `onPanelBorder`, `hudPanelIconAt`, `hudPanelOwnerAt`, `togglePanel`, `raisePanel`, `startPanelDrag`/`updatePanelDrag`/`endPanelDrag`, `applyPanelPositions`, `clampPanel`, `persistHudLayout`, `applyStoredHudLayout`, `dockDetailPanel`, `applyHudBackground`, `recolorPanelText`, plus the Pokevial bar (`hudVialFill`, `hudVialLabel`, `drinkPokevial`, `vialButtonAt`), the shared level/XP line (`hudLevelText`, `hudXpFill`, `hudXpText`) and the money row (`hudMoneyText`). The `HudPanel` and `HudMetrics` types live in `types.ts`; `hud.ts` re-exports `hudMetrics` |
| `bag` | 40 | the bag window: `hudBagTabs`, `hudBagCategory`, `hudBagQuery`, `hudBagSearchFocus`, `hudBagSearchBg/Text/Rect`, `hudBagCells`, `hudBagEmpty`, `bagGrid`, `hudBagGridRect`, `hudBagStacks`, `refreshBagGrid`, `bagInfoFor`, `bagInfoPopup`, `bagInfoLayer`, `paintTab`, `hudBagCellAt`, `focusBagSearch`, `selectBagTab`, `pointerInBagPanel`, `typeInBagSearch`, `hudDraggableStackAt` |
| `pc` | 50 | the box window: `hudBoxTabs`, `hudBoxRip`, `hudBoxCells`, `hudBoxPage`, `stepBoxPage`, `setHudBoxPane` (`hudUi.pane` via `setUi`), `selectBoxTab`, `selectRipTab`, `hudBoxCellAt`, `pointerInBoxPanel` |
| `notices` | 60 | the transient notice strip and the floor's cards: `buildNotice`, `showNotice`, `noticeRoot`, `noticeText`, `noticeTimer`, `buildAreaPanel`, `showAreaPanel`, `areaPanelRoot`, `areaPanelText`, `areaPanelTimer`, `buildMissionLine`, `missionRoot`, `hudMissionText` |
| `rewards` | 70 | the mini-boss reward card: `openMiniBossReward`, `closeMiniBossReward`, `buildMiniBossReward`, `miniBossRewardPanel`, `miniBossRewardRoot`, `miniBossRewardOnDone` |
| `shop` | 80 | **entry point only.** The Mart's drawing already lives in `src/scenes/rooms/shop.ts` (`openMart`, `D33`/`D47`). The descriptor's `build`/`refresh` are absent and it exposes the panel as `open(host)` delegating to `openMart(host)`, so the registry can name it and a later migration owns moving the drawing. No drawing moves into this file. |
| `trade` | 90 | **entry point only**, the same shape as `shop`: the trade card's drawing lives in `src/scenes/rooms/trade.ts`. The descriptor delegates to it; nothing is moved or copied here. |
| `pause` | 100 | the pause menu and the reset dialog: `buildPauseMenu`, `openPauseMenu`, `closePauseMenu`, `handlePauseMenuAction`, `refreshPauseMenu`, `pauseMenu`, `pauseMenuRows`, `pauseMenuOpen`, and the reset overlay (`buildResetOverlay`, `updateReset`, `drawResetOverlay`, `fadeResetOverlayIn`, `hideResetOverlay`, `resetScrim`, `resetRing`) with `restartRun` staying in the scene |
| `detail` | 110 | the member detail window and everything it owns: `buildDetailPanel`, `hudDetail*`, `hudNickname*`, `hudDetailEvo*`, `hudMoveGrid`, `hudLearnGrid`, `hudLearnWindow`, `hudLear*`/`hudLearn*`, `learnPopup*`, `hudAbilityPopup`, `hudAbilityInfoButton`, `openMemberDetail`, `closeMemberDetail`, `handleDetailPointerDown`, `refreshDetail`, `refreshDetailEvolutions`, `refreshNicknameField`, `detailMember`, `deadDetail`, `learnPool`, `learnCell`, `refreshLearnset`, `detailSlotCursor`, `learnWindowCursor`, all `learn*` scroll/drag methods, `typeInDetailSearch`, `updateDetailInfo`, `toggleDetailInfo`, `updateAbilityInfo`, `toggleAbilityInfo`, `unpinAbilityInfo`, `resetDetailInfo`, `clearDetailInfo`, `dropLearnInfo`, `pointerInDetailPanel`, `detailTabAt`, `evolutionAt`, `evolveOpenMember`, `detailMoveIndexAt`, `detailInfoAt`, `detailLearnInfoAt`, `abilityInfoAt` |

A member this table does not name stays in the scene (the NPC card
`openNpcCard`/`openNpcCardView`/`showNpcResult`, the Mart's counter tile, the drop
ghost, the room drag, the battle launch, the dev overlay). Where a named member is
used by more than one panel (`hudPartyRowAt` by `party` and the drag path,
`paneMembers` by `party` and `pc`), it moves to the module that **owns** the
panel and the other module calls it through an exported helper of that module —
never through a copy.

### How the scene uses the registry

```ts
import { collectPanels } from './panels/registry';
import type { PanelRegistry } from './panels/registry';
import type { RoutePanelHost } from './panels/types';

const PANEL_MODULES = import.meta.glob(['./panels/*.ts', '!./panels/*.test.ts'], { eager: true });
// one per scene instance, built once in `create`:
private panels: PanelRegistry = collectPanels(PANEL_MODULES);
```

- **Build:** iterate `this.panels.all` and call `build(host)` in that order,
  inside the same `create`/`buildHud` sequence as today, after `hudRoot` exists.
- **Repaint:** `refreshHud()` becomes: the scene's own state read (level, XP,
  money, title) then `for (const panel of this.panels.all) panel.refresh?.(host)`,
  in the same order and at the same call sites as today.
- **Pointer:** the existing `pointerdown`/`pointermove`/`pointerup` handlers stay
  on the scene and walk `this.panels.all` from the top (`order` descending),
  calling `pointer?.(host, pointer)` and stopping at the first `true`. A panel
  that is not open returns `false` without touching the pointer.
- **Keys:** `handleAction` keeps its switch. The panels that need a key union
  (`pause`, `detail`) are reached through their descriptor's `key?.(host, action)`.
- **Close:** `shutdown`/`transitionTo` walk `this.panels.all` ascending and call
  `close?.(host)`.
- `panels()`/`registerPanel()` are how `makeHudPanel` (in `hud.ts`) records a
  panel; the array is the one the drag, raise and layout code already iterates.

## 🧩 Data and configuration

None. No new key, no new table, no new dependency, no `package.json` change. The
panel ids and orders above are code, not data: `HudPanelId` and `HUD_PANEL_IDS`
stay in `src/data/hudLayout.ts` untouched, and a panel's `hudPanel` field is an
alias to one of them.

## 🧪 Test and Validation Plan (for QA)

**This task owes no browser pass.** Every criterion below is `[unit]`: the move
changes no pixel, no string, no geometry and no seed, and its proof is that the
suite, the type checker and the path audit all stay green with the *existing*
tests byte-identical.

- **Method:**
  - `npm test` — Vitest, headless.
  - `npm run build` — `tsc --noEmit && vite build` (`noUnusedLocals` and
    `noUnusedParameters` are on, so a member or import left behind by a
    half-done move fails the build).
  - `git diff --name-only main...task-128` — audit against the exclusive paths.
  - `git diff main...task-128 -- '*.test.ts' ':(exclude)src/scenes/panels/registry.test.ts'`
    — must be empty.
  - No browser, no screenshot, no manual walk.

- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean: `npm run build`. This is also
        the completeness proof of the move: a panel member left in the scene with
        no reader, or an import the move orphaned, fails `noUnusedLocals`.
  - [ ] `[unit]` Every existing test is unchanged and green: `npm test` passes,
        and the diff command above prints nothing.
  - [ ] `[unit]` `src/scenes/panels/registry.test.ts` collects the folder it is
        handed (the real `import.meta.glob(['./*.ts', '!./*.test.ts'], { eager: true })`,
        the same call the scene makes) and asserts: `collectPanels(MODULES).all`
        has exactly **11** entries; their `id`s in `order` sequence are exactly
        `map, party, hud, bag, pc, notices, rewards, shop, trade, pause, detail`;
        their `order`s are exactly `10 20 30 40 50 60 70 80 90 100 110`;
        `byId.get(id)` is the descriptor whose `id` is `id` for all eleven; a
        module map with two descriptors on one id throws
        `two panel descriptors claim the id bag: ./panels/a.ts, ./panels/b.ts`;
        a module map with two descriptors on one order throws the `order` form;
        and `{ types: {}, helper: {} }`-style non-descriptor modules are skipped.
        `npm test -- panels/registry` passes.
  - [ ] `[unit]` The folder's own convention holds, asserted from raw sources in
        the same test (`import.meta.glob('./*.ts', { eager: true, query: '?raw',
        import: 'default' })`): each non-test module of `src/scenes/panels/`
        except `types.ts`, `registry.ts` and `registry.test.ts` contains exactly
        one `export const descriptor`; no panel source contains
        `from '../RouteScene'` or `from './RouteScene'`; no panel source contains
        `import Phaser from 'phaser'` (a runtime import — `import type Phaser`
        is allowed). If a panel needs a `BootScene` texture key, mock
        `../BootScene` exactly as `src/scenes/rooms/registry.test.ts` does.
  - [ ] `[unit]` The scene keeps the input dispatch: `src/scenes/RouteScene.ts`
        still declares and routes `handleAction`, `onTileEntered`, `tryInteract`,
        `handleHudPointerDown`, `handleHudPointerMove`, `handleHudPointerUp`,
        `modalPanelOpen`, `openPanel`, `closePanel`, and the `pointerdown`/
        `pointermove`/`pointerup` registrations
        (`grep -n "private handleAction\|private onTileEntered\|private tryInteract\|private handleHudPointer\|pointerdown\|pointermove\|pointerup" src/scenes/RouteScene.ts`
        shows all of them).
  - [ ] `[unit]` The scene got smaller and the layer is real: every one of the
        eleven modules exists, and `src/scenes/RouteScene.ts` no longer declares
        the panel fields it handed over —
        `grep -n "private hudBagCells\|private hudBoxCells\|private hudDetail\b\|private learnPopup\|private pauseMenuRows\|private miniBossRewardRoot\|private noticeRoot\|private areaPanelRoot" src/scenes/RouteScene.ts`
        returns nothing, while those names appear in `src/scenes/panels/`.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched:
        `git diff --name-only main...task-128` lists only files from the list
        above, and `git diff main...task-128 -- src/data src/ui src/scenes/rooms src/main.ts package.json vite.config.ts`
        is empty.
  - [ ] `[unit]` The folder map is not rotten: `src/scenes/panels/README.md`
        carries one role line per file of the folder (twelve modules plus the test
        and the README itself), and `src/scenes/README.md` names `panels/` and
        describes `RouteScene.ts` without the panel list it now delegates.

## 📣 Coordination

- **For the Architect / the human — one discrepancy in the backlog entry.** The
  entry says the ten route panels *move out of `RouteScene.ts`*. Two of the
  eleven do not live there today: the Mart window is `src/scenes/rooms/shop.ts`
  (RouteScene only does `import { openMart } from './rooms/shop'`, line 331, and
  calls `openMart(this.roomHost())`, line 6199), and the trade card is
  `src/scenes/rooms/trade.ts`. This spec therefore freezes `shop` and `trade` as
  **entry-point descriptors** that delegate to those room modules and move no
  drawing; their Phase-12 migrations (`Task-134`, `Task-135`) own moving the
  drawing. Everything else — nine modules — moves real code.
- **For Phase 12:** a migration owns exactly one `src/scenes/panels/<name>.ts`
  plus its `src/ui/hud/panels/<name>/**`. It edits its module's `build`,
  `refresh`, `pointer`, `key` and `close` and nothing else; the registry, the
  port and the other ten modules need no edit. Adding a panel is a new file plus
  a row in `README.md`; the scene needs no edit unless the panel needs a port
  member it does not have, and that is a scene edit the migration must claim.
- **For the next batch:** `RoutePanelHost` and `RoutePanelDescriptor` are the
  frozen surface; `types.ts` also owns the `HudMetrics`/`HudPanel` declarations
  and `hud.ts` re-exports `hudMetrics`, so the scene and the other panels share
  one definition of each.
- **Order values** are the frozen build/z sequence above. If `buildHud`'s real
  creation sequence differs for one panel, set that descriptor's `order` to its
  true position and record it here rather than leaving glob order to decide.

## ⛔ Out of scope

- Any behaviour, wording, colour, geometry, key, hit box, animation or dwell
  change. A panel that "looks slightly off afterwards" is a failed move.
- Moving a panel to the DOM, adding a flag, a fixture or a diff — that is
  Phase 12.
- The room layer (`src/scenes/rooms/**`) and `D47`: read it, do not refactor it.
- `src/ui/**` view models, `src/data/**` (including `hudLayout.ts`), the run, the
  save, the RNG, `src/main.ts`'s scene list.
- The NPC card, the Mart counter tile, the drag ghost and the room-row drag: they
  stay in the scene.
- No new dependency, no bundler change, no `SAVE_VERSION` step.
