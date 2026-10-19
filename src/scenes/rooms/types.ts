import type Phaser from 'phaser';
import type { Tile } from '../../engine/grid';
import type { MapRoomSpecial, RoomView } from '../../engine/maps';
import type { Facing, RouteItem, RouteMap, RouteTrainer } from '../../engine/routes/routeMap';
import type { RunState } from '../../engine/run/state';
import type { KeybindAction } from '../../data/keybinds';
import type { MapRoomMarker } from '../../ui/mapView';
import type { Notice } from '../../ui/notice';

/**
 * The special-room layer (`D47`): one descriptor module per `MapRoomSpecial` kind,
 * discovered by `RouteScene`'s registry. A room owns what it places and how it
 * reads; the scene owns the keyboard slot, the counter tile and the route it hands
 * over. `Phaser` is a **type-only** import here, so the descriptor surface stays
 * testable headless.
 */

/** What a room's fixture adds to the room's route, after `buildRoute` has run. */
export type RoomFixture = Readonly<{
  /** Trainers this room adds, appended after the boss's own entry. */
  trainers?: readonly RouteTrainer[];
  /** Ground items this room adds, appended after the generator's own. */
  items?: readonly RouteItem[];
  /** The room's interactable counter tile, or null when the room has none. */
  counter?: Tile | null;
  /** A transient notice the scene floats once the fixture is applied. */
  notice?: Notice;
}>;

/** What the pointer was over when a room row was released. */
export type RoomDrop =
  | Readonly<{ onto: 'bag' }>
  | Readonly<{ onto: 'member'; memberId: string }>
  | Readonly<{ onto: 'party' }>
  | Readonly<{ onto: 'none' }>;

/** One row the scene drags: the room starts it, the scene owns ghost and drop. */
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

/** The route scene's own panel, owned by the room that opened it. */
export type RoomPanel = Readonly<{
  /** Every keybind action, while this panel is modal. Absent for a floating panel. */
  handle?: (action: KeybindAction) => void;
  /** `false` for a floating, non-modal panel. Omitted means modal (`true`). */
  modal?: boolean;
  /** Destroys the panel's own objects. Called by the scene, never by the panel. */
  close(): void;
}>;

/**
 * The hooks a room descriptor may use from the scene. `RouteScene` satisfies it;
 * nothing else does. It is read-only: a room mutates the scene only through these
 * methods.
 */
export type RoomHost = Readonly<{
  /** The route scene itself: `add`, `scale`, `cameras`, `tweens`, `time`. */
  scene: Phaser.Scene;
  /** The run as the room is built. */
  run: RunState;
  /** The room being built (`roomView`). */
  view: RoomView;
  /** The room's route as `buildRoom` built it, so a room can read its own tiles. */
  route(): RouteMap;
  /**
   * Redraws the current room from its run **without leaving it**: re-runs the room's
   * build (so a `RouteRequest.gate` input that reads the run is re-read), keeps the
   * player on their tile and keeps the room's live encounter sequence. Called after a
   * change the build reads.
   */
  rebuildRoom(): void;
  /** The room's route entry tile. */
  entryTile(): Tile;
  /** The counter tile this room's fixture placed, or null. */
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
  /** Tears the open panel down (room change, battle, run over). */
  closePanel(): void;
  /** True while a room's own panel owns the screen. */
  panelOpen(): boolean;
  /**
   * Opens the menu battle against `trainer` through the scene's own trainer path
   * (`startTrainerBattle`): the roster is seeded for that id, the band is the room's
   * map and a win marks the id beaten. Called by a set-piece that rolls a fight
   * instead of a prize.
   */
  startTrainerBattle(trainer: RouteTrainer): void;
  /** Floats one transient notice through the route HUD's own strip (`src/ui/notice.ts`). */
  showNotice(notice: Notice): void;
  /** Starts a row drag the scene owns. Optional so headless stubs need not fake it. */
  beginRowDrag?: (drag: RoomRowDrag) => void;
}>;

/** One special room kind: what it is, what it places and how it reads. */
export type RoomDescriptor = Readonly<{
  /** The plan's own kind (`MapRoomSpecial`); one descriptor per kind. */
  kind: MapRoomSpecial;
  /** The minimap marker this room draws. */
  marker: MapRoomMarker;
  /** The room's content, applied once per room build. */
  fixture?: (host: RoomHost) => RoomFixture | null;
  /** The interact key while the player faces `tile`; true when consumed. */
  interact?: (host: RoomHost, tile: Tile) => boolean;
  /** The room's fixture sprite(s), drawn where the scene draws entities. */
  drawFixture?: (host: RoomHost) => void;
  /** This room's minimap glyph, inside the cell of radius `radius`. */
  drawMarker?: (graphics: Phaser.GameObjects.Graphics, cx: number, cy: number, radius: number) => void;
}>;
