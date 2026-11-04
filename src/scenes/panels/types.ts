import type Phaser from 'phaser';
import type { KeybindAction } from '../../data/keybinds';
import type { HudLayout, HudPanelId } from '../../data/hudLayout';
import type { Tile } from '../../engine/grid';
import type { Facing, RouteMap, RouteTrainer } from '../../engine/routes/routeMap';
import type { RunState } from '../../engine/run/state';
import type { Settings } from '../../engine/save';
import type { Notice } from '../../ui/notice';
import type { PartyUiState } from '../../ui/partyScreen';

/**
 * The node screens' overlay-panel layer (`D47`'s shape, one folder over): one module
 * per panel, discovered by the folder's `host.ts`. A panel owns the card it mounts and
 * how it reads; the scene owns the keyboard slot, the run and the route it hands
 * over. `Phaser` is a **type-only** import here, so the descriptor surface stays
 * testable headless.
 *
 * Every panel is a **controller** (`D49` amended): it builds no HUD chrome of its own —
 * its card is DOM, and the folder's two canvas overlays are listed in this folder's README.
 *
 * The room-panel types a counter opens (the trade card, the Team Rocket machine and the
 * minimap rewards) live in this module too: the node screens share one panel slot, so
 * its **shape** is a panel concept, not a property of the road generator.
 */

/** The route screen's own panel, owned by whatever opened it. */
export type RoomPanel = Readonly<{
  /** Every keybind action, while this panel is modal. Absent for a floating panel. */
  handle?: (action: KeybindAction) => void;
  /** `false` for a floating, non-modal panel. Omitted means modal (`true`). */
  modal?: boolean;
  /** Destroys the panel's own objects. Called by the scene, never by the panel. */
  close(): void;
}>;

/** One wild battle a counter starts through the scene's own wild path. */
export type RoomWildBattle = Readonly<{
  speciesId: string;
  level: number;
  /** The battle's own entity key; the scene appends its own counter. */
  key: string;
}>;

/** What the pointer was over when a counter's row was released. */
export type RoomDrop =
  | Readonly<{ onto: 'bag' }>
  | Readonly<{ onto: 'member'; memberId: string }>
  | Readonly<{ onto: 'party' }>
  | Readonly<{ onto: 'none' }>;

/** One row the scene drags: the counter starts it, the scene owns ghost and drop. */
export type RoomRowDrag = Readonly<{
  /** The item the row offers, or `null` for a mini-boss Pokémon row. */
  itemId: string | null;
  /** The row's own printed label; the Pokémon ghost draws this, never a sprite. */
  label: string;
  /** Screen-space pointer at the press. */
  pointer: Readonly<{ x: number; y: number }>;
  /** Called exactly once, on release, with the resolved target. */
  onDrop: (drop: RoomDrop) => void;
}>;

/** Where a counter's host stands: the run's own position, as the panel reads it. */
export type RoomHostView = Readonly<{
  mapIndex: number;
  roomId: number;
}>;

/**
 * The hooks a counter (a Mart, the Team Rocket machine, the trade card) may use from
 * the scene that opened it. It is read-only: a counter mutates the scene only through
 * these methods.
 */
export type RoomHost = Readonly<{
  /** The route scene itself: `add`, `scale`, `cameras`, `tweens`, `time`. */
  scene: Phaser.Scene;
  /** The run as the counter is opened. */
  run: RunState;
  /** The position the panel reads its band and its own ids from. */
  view: RoomHostView;
  /** The route the counter stands in, so a counter can read its own tiles. */
  route(): RouteMap;
  /** Redraws the current screen from its run without leaving it. */
  rebuildRoom(): void;
  /** The route's entry tile. */
  entryTile(): Tile;
  /** The counter tile this panel placed, or null. */
  counterTile(): Tile | null;
  /** The walkable tile farthest from the entry that no trainer or item owns. */
  farthestRoomTile(): Tile | null;
  /** The facing that looks from `from` towards `to`. */
  facingFromTo(from: Tile, to: Tile): Facing;
  /** True while the dev generator phases own the screen (no counter is drawn). */
  generatorStepActive(): boolean;
  /** Sets the scene's run, persists it and repaints the HUD (a Mart trade). */
  commitRun(run: RunState): void;
  /** Takes the keyboard off whichever HUD pane held it (before a modal panel). */
  releaseHudKeyboard(): void;
  /** Gives the keyboard to `panel` until `closePanel()`; the scene owns the slot. */
  openPanel(panel: RoomPanel): void;
  /** Tears the open panel down (screen change, battle, run over). */
  closePanel(): void;
  /** True while a counter's own panel owns the screen. */
  panelOpen(): boolean;
  /** Opens the menu battle against `trainer` through the scene's own trainer path. */
  startTrainerBattle(trainer: RouteTrainer): void;
  /** Opens a menu battle against one wild Pokémon through the scene's wild path. */
  startWildBattle?: (encounter: RoomWildBattle) => void;
  /** Floats one transient notice through the route HUD's own strip (`src/ui/notice.ts`). */
  showNotice(notice: Notice): void;
  /** Starts a row drag the scene owns. Optional so headless stubs need not fake it. */
  beginRowDrag?: (drag: RoomRowDrag) => void;
}>;

/** The overlay panels, one descriptor each, in `order` sequence. */
export type RoutePanelId =
  | 'map'
  | 'party'
  | 'hud'
  | 'bag'
  | 'pc'
  | 'notices'
  | 'missions'
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
  /** The panel's own HUD card, when it is one of the collapsible ones. */
  hudPanel?: HudPanelId;
  /** Mounts the panel's own card once into `#hud`, and nothing else. */
  build(host: RoutePanelHost): void;
  /** Repaints the panel from the run and the ui state. Absent: nothing to repaint. */
  refresh?(host: RoutePanelHost): void;
  /** A keybind action while the panel is focused: true when consumed. */
  key?(host: RoutePanelHost, action: KeybindAction): boolean;
  /** Unmounts the panel's own card. Called by the scene, never by the panel. */
  close?(host: RoutePanelHost): void;
}>;

/**
 * The hooks a panel descriptor may use from the scene. Every node screen builds one
 * through `createScenePanels`; nothing mounts by itself. It is read-only: a panel
 * mutates the scene only through these methods, and reads the run through `run()` so
 * a panel always sees the live one.
 */
export type RoutePanelHost = Readonly<{
  /** The scene itself: `scale`, `cameras`, `time`, `tweens`, `input`. */
  scene: Phaser.Scene;
  /** The live run — a function, so a panel always reads the current one. */
  run(): RunState;
  /** The live settings. */
  settings(): Settings;
  /** The saved HUD layout: every card's drag offset and collapsed flag (D22). */
  hudLayout(): HudLayout;
  /** Replaces the HUD layout and persists it with the settings, then repaints. */
  setHudLayout(layout: HudLayout): void;
  /** The HUD metrics the cards lay themselves out from (`hudMetrics`). */
  hud(): HudMetrics;
  /** Whether a HUD card is open rather than collapsed to its edge chip. */
  hudCardOpen(id: HudPanelId): boolean;
  /** Opens or collapses a HUD card; the quick keys and the strip both land here. */
  setHudCardOpen(id: HudPanelId, open: boolean): void;
  /** The HUD's grab/cursor state, read and replaced (never mutated in place). */
  ui(): PartyUiState;
  setUi(state: PartyUiState): void;
  /** Persists the run and repaints the HUD (a panel never writes the run itself). */
  commitRun(run: RunState): void;
  persistRun(): void;
  /** Asks the scene to repaint every panel once, after a change. */
  refreshHud(): void;
  /** The room-panel slot, unchanged (`D47`). */
  openPanel(panel: RoomPanel): void;
  closePanel(): void;
  panelOpen(): boolean;
  /** The transient notice strip. */
  showNotice(notice: Notice): void;
  /** The scene's own battle paths, for a panel that starts one. */
  startWildBattle(encounter: Readonly<{ speciesId: string; level: number; key: string }>): void;
  startTrainerBattle(trainer: RouteTrainer): void;
  /** The route on screen, so the header can name the biome it reads; null off a route. */
  route(): RouteMap | null;
  /** Opens the Settings screen paused on top of the route (the pause menu's row). */
  openSettings(): void;
  /** Starts a brand-new run with a fresh seed (the pause menu's Reset row). */
  restartRun(): void;
  /** Flies the run to a visited settlement from the region card; the scene refuses one it may not. */
  flyToNode(key: string): void;
}>;

/**
 * The HUD's panel widths for the current window: the fixed design sizes, clamped
 * so no panel grows past the screen (a phone shows them nearly full-width, and the
 * panels overlap since they no longer fit side by side). Everything derived from a
 * width — the HP bar scale, the XP bar and the detail panel's lateral padding —
 * is computed here too, so one place decides the layout.
 */
export type HudMetrics = Readonly<{
  panelW: number;
  partyW: number;
  detailW: number;
  mapW: number;
  partyHpBarScale: number;
  xpBarW: number;
  detailPadX: number;
}>;
