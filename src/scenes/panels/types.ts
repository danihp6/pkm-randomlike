import type Phaser from 'phaser';
import type { KeybindAction } from '../../data/keybinds';
import type { HudPanelId } from '../../data/hudLayout';
import type { MapPlan } from '../../engine/maps';
import type { RouteMap, RouteTrainer } from '../../engine/routes/routeMap';
import type { RunState } from '../../engine/run/state';
import type { Settings } from '../../engine/save';
import type { Notice } from '../../ui/notice';
import type { PartyUiState } from '../../ui/partyScreen';
import type { RoomRegistry } from '../rooms/registry';
import type { RoomPanel, RoomRowDrag } from '../rooms/types';

/**
 * The route's overlay-panel layer (`D47`'s shape, one folder over): one module per
 * panel, discovered by `RouteScene`'s registry. A panel owns what it draws and how
 * it reads; the scene owns the keyboard slot, the pointer dispatch, the run and the
 * route it hands over. `Phaser` is a **type-only** import here, so the descriptor
 * surface stays testable headless.
 */

/** The route's overlay panels, one descriptor each, in `order` sequence. */
export type RoutePanelId =
  'map' | 'party' | 'hud' | 'bag' | 'pc' | 'notices' | 'rewards' | 'shop' | 'trade' | 'pause' | 'detail';

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

/**
 * The hooks a panel descriptor may use from the scene. `RouteScene` satisfies it;
 * nothing else does. It is read-only: a panel mutates the scene only through these
 * methods, and reads the run through `run()` so a panel always sees the live one.
 */
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
  /** The route on screen, so the header can name the biome it reads. */
  route(): RouteMap;
  /** The floor plan on screen, or null off a planned room (the dev tools). */
  plan(): MapPlan | null;
  /** Every special room kind's descriptor, for the minimap's own markers (`D47`). */
  rooms(): RoomRegistry;
  /** Starts a row drag the scene owns (the mini-boss reward's own rows). */
  beginRowDrag(drag: RoomRowDrag): void;
  /** Opens the Settings screen paused on top of the route (the pause menu's row). */
  openSettings(): void;
  /** Starts a brand-new run with a fresh seed (the pause menu's Reset row). */
  restartRun(): void;
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

/**
 * One draggable HUD panel. Its window chrome and content live in `body` and its
 * collapse button in `icon`; both are children of `container`. `x`/`y`/`w`/`h`
 * are the expanded layout rect and `dx`/`dy` the drag displacement; `expanded` is
 * false when the panel is collapsed to its icon. The current on-screen rect is
 * the layout rect (or the icon's) shifted by the offset, which is what the drag
 * and the hit tests read. Panels overlap freely and the one in hand rides on top.
 */
export type HudPanel = {
  id: HudPanelId;
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Container;
  icon: Phaser.GameObjects.Container;
  /** The quick-key action that opens this panel, or null for the detail popup. */
  key: KeybindAction | null;
  /** The key letter under the icon (null on a touch screen or without a key). */
  keyLabel: Phaser.GameObjects.BitmapText | null;
  /** The button's size: a square, or a rectangle when it shows the key letter. */
  iconW: number;
  iconH: number;
  /** The window chrome, faded when the Transparent HUD option is on. */
  window: Phaser.GameObjects.NineSlice;
  /** The outline drawn in its place while the window is hidden. */
  border: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  w: number;
  h: number;
  dx: number;
  dy: number;
  expanded: boolean;
};
