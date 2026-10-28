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
import type { RoomPanel } from '../rooms/types';

/**
 * The route's overlay-panel layer (`D47`'s shape, one folder over): one module per
 * panel, discovered by `RouteScene`'s registry. A panel owns the card it mounts and
 * how it reads; the scene owns the keyboard slot, the run and the route it hands
 * over. `Phaser` is a **type-only** import here, so the descriptor surface stays
 * testable headless.
 *
 * Every panel is a **render-free controller** (`D49` amended): it mounts its card
 * into `#hud` and forwards intents, and it draws no Phaser object at all.
 */

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
 * The hooks a panel descriptor may use from the scene. `RouteScene` satisfies it;
 * nothing else does. It is read-only: a panel mutates the scene only through these
 * methods, and reads the run through `run()` so a panel always sees the live one.
 */
export type RoutePanelHost = Readonly<{
  /** The scene itself: `scale`, `cameras`, `time`, `tweens`, `input`. */
  scene: Phaser.Scene;
  /** The live run — a function, so a panel always reads the current one. */
  run(): RunState;
  /** The live settings. */
  settings(): Settings;
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
  /** The route on screen, so the header can name the biome it reads. */
  route(): RouteMap;
  /** The floor plan on screen, or null off a planned room (the dev tools). */
  plan(): MapPlan | null;
  /** Every special room kind's descriptor, for the minimap's own markers (`D47`). */
  rooms(): RoomRegistry;
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
