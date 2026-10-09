import Phaser from 'phaser';
import { biomeForRoute, getBiome } from '../data/biomes';
import { getSpecies } from '../data/dex';
import { GROUND_ITEM_TEXTURE_KEY } from '../data/groundItemSprite';
import { type HudPanelId } from '../data/hudLayout';
import { ITEM_ICON_TEXTURE_KEY, itemIconFrame } from '../data/itemIcons';
import { getItem } from '../data/items';
import { keyLabel, type KeybindAction } from '../data/keybinds';
import { PORTRAIT_TEXTURE_KEY, portraitFor } from '../data/portraits';
import {
  PLAYER_SPRITE_TEXTURE_KEY,
  PLAYER_SPRITE_WIDTH,
  playerSpriteFrame,
  type PlayerFacing,
} from '../data/playerSprite';
import { playerWalkAnimKey, playerWalkTimeScale } from '../render/playerAnim';
import { ROUTE_LOOT } from '../data/loot';
import {
  OVERWORLD_SPRITE_TEXTURE_KEY,
  OVERWORLD_SPRITE_WIDTH,
  overworldSpriteFrame,
} from '../data/overworldSprites';
import { trainerFacingPose, trainerWalkAnimKey } from '../render/trainerAnim';
import { getTrainerArchetype, TRAINER_ARCHETYPE_IDS } from '../data/trainers';
import { IS_DEVELOP } from '../dev/env';
import type { DebugPartyEdit, DebugPartyMember, DebugRouteContext, DebugRouteInput } from '../dev/debugMenu';
import { restoreFighter, type FighterInput } from '../engine/battle';
import {
  MAX_PARTY_SIZE,
  MAX_MOVES,
  addItem,
  addPokemon,
  advanceMap,
  advanceRoute,
  bandForMap,
  battleSeed,
  canCapture,
  createRun,
  createRunPokemon,
  editRunPokemon,
  equipHeldItem,
  fullHealMember,
  hasLivingParty,
  isItemPicked,
  isTrainerDefeated,
  markBossDefeated,
  markItemPicked,
  resolveBattle,
  roomLevelForMap,
  routeIndexForRoom,
  runBand,
  runRoomLevel,
  trainerRoster,
  unequipHeldItem,
  updatePokemon,
  type BagCounts,
  type BattleLaunch,
  type BattleReturn,
  type BattleReward,
  type BattleTrigger,
  type RunState,
} from '../engine/run';
import {
  COMMON_TEXTURE_KEY,
  TILESETS,
  resolveTileset,
  type TilesetId,
  tilesetTextureKey,
} from '../data/tilesets';
import type { Tile } from '../engine/grid';
import { FLOOR, TALL_GRASS, isWalkable, mapPixelSize, resolveMove, tileAt, type TileMap } from '../engine/map';
import { hashSeed, randomSeed, Rng } from '../engine/rng';
import { clearRun, storeRun, type Settings } from '../engine/save';
import {
  DEFAULT_SHAPE,
  DEFAULT_TRAINER_SIGHT,
  RouteEncounters,
  seesPlayer,
  sketchRoute,
  sketchRouteSteps,
  trainerAt,
  type Facing,
  type RouteItem,
  type RouteMap,
  type RouteRequest,
  type RouteShape,
  type RouteStep,
  type RouteTrainer,
} from '../engine/routes';
import {
  OPPOSITE_EDGE,
  bossTrainerId,
  isFinalMap,
  planMap,
  roomAcross,
  roomView,
  type MapEdge,
  type MapPlan,
  type RoomView,
} from '../engine/maps';
import { COMMON_TILE_SIZE, TILE_SIZE } from '../engine/tileset';
import { resolveTileFrame, resolveGroundFrame, grassTipKeys, treeTipKeys, type TileFrame } from '../engine/tileFrames';
import {
  parseFrameMapExport,
  routeFromFrameMapExport,
  serializeFrameMap,
} from '../engine/frameMap';
import { BAG_CATEGORIES, BAG_CATEGORY_LABELS, bagForCategory, cycleBagCategory, type BagCategory } from '../ui/bag';
import { buildMapView, type MapViewRoom } from '../ui/mapView';
import {
  BOX_COLS,
  BOX_PAGE_SIZE,
  BOX_ROWS,
  boxCellIndex,
  boxPageCount,
  boxRows,
  dragTo,
  dropGrabbed,
  grabAt,
  initialPartyUi,
  partyInput,
  swapAcross,
  type PartyUiState,
  type PaneId,
} from '../ui/partyScreen';
import {
  CLOSED_DETAIL,
  DETAIL_STATS,
  STAT_LABELS,
  closeDetail,
  dropMove,
  grabMove,
  memberDetail,
  openDetail,
  reorderMoves,
  setDetailTab,
  typeColor,
  type DetailState,
  type DetailTab,
  type MemberDetail,
} from '../ui/partyDetail';
import { FRLG_HPBAR, FRLG_HPBAR_KEY, FRLG_WINDOW_PADDING, addFrlgWindow } from '../ui/frlg';
import { hpColorInt, hpFraction } from '../ui/metrics';
import { levelUpBeats, type LevelUpBeat } from '../ui/beats';
import { RELEASE_HOLD_MS, RELEASE_INPUT_DELAY_MS, releaseBeats, type ReleaseBeat } from '../ui/permadeath';
import { FRLG_INK, addFrlgText } from '../ui/frlgFont';
import { createTouchControls, type TouchControls } from '../ui/touchControls';
import { actionKeys, subscribeKeybinds } from '../input/input';
import { listenForBack } from '../input/backButton';
import { loadSettings, saveSettings } from '../settings';
import { browserStorage } from '../storage';
import {
  GRASS_TEXTURE_KEY,
  PANEL_ICON_KEYS,
  PANEL_ICON_SIZE,
  SPARKLE_TEXTURE_KEY,
  TRAINER_TEXTURE_KEY,
} from './BootScene';

/** Item stacks the route HUD's bag window shows before it drops the rest. */
const HUD_BAG_ROWS = 6;

/**
 * The route HUD is one FRLG window per concern, stacked down the right edge: a
 * slim route header, then the party (portrait, name, level and HP bar) and the
 * bag (pocket tabs over the active pocket's icon, name and count). The widths
 * are shared so the three stack flush.
 */
const HUD_PANEL_W = 344;
const HUD_TOP = 8;
const HUD_GAP = 8;
/** Content stays inside the FRLG window's baked border (`FRLG_WINDOW_PADDING`). */
const HUD_PAD_X = FRLG_WINDOW_PADDING.x;
const HUD_PAD_TOP = FRLG_WINDOW_PADDING.top;
const HUD_PAD_BOTTOM = FRLG_WINDOW_PADDING.bottom + 4;
const HUD_HEADER_H = HUD_PAD_TOP + 16 + HUD_PAD_BOTTOM;
/** The minimap window: a compact square in the free top-left corner. */
const HUD_MAP_X = 8;
const HUD_MAP_Y = HUD_TOP;
const HUD_MAP_W = 208;
const HUD_MAP_H = 236;
const HUD_MAP_HEADER = HUD_PAD_TOP + 16 + 8;
const HUD_PARTY_HEADER = HUD_PAD_TOP + 16 + 12;
const HUD_PARTY_ROW = 52;
/** The party avatar, enlarged to the row height so the held-item badge reads. */
const HUD_PARTY_PORTRAIT_SCALE = 0.7;
/** The held-item icon on an avatar's lower-right corner. */
const HUD_HELD_ICON_SCALE = 0.85;
const HUD_BOX_HELD_ICON_SCALE = 1;
/** Pointer travel (px) that turns a click into a drag while grabbing a member. */
const HUD_DRAG_SLOP = 4;
/** The bag pocket tabs: four across the window's padded inner width. */
const HUD_TAB_W = 68;
const HUD_TAB_H = 26;
const HUD_TAB_GAP = 4;
const HUD_BAG_HEADER = HUD_PAD_TOP + HUD_TAB_H + 8;
const HUD_BAG_ROW = 40;
/** The 268px FRLG HP bar at 0.75 still reads cleanly and leaves room for the numbers. */
const HUD_HPBAR_SCALE = 0.75;
/** The PC BOX window: a page tab strip over a grid of avatar cells. */
const HUD_BOX_PAD = 12;
const HUD_BOX_TAB_W = 32;
const HUD_BOX_TAB_GAP = 4;
const HUD_BOX_TABS_H = HUD_PAD_TOP + HUD_TAB_H + 8;
const HUD_BOX_CELL = 76;
const HUD_BOX_CELL_GAP = 4;
const HUD_BOX_GRID_H = BOX_ROWS * HUD_BOX_CELL + (BOX_ROWS - 1) * HUD_BOX_CELL_GAP;
const HUD_BOX_H = HUD_BOX_TABS_H + HUD_BOX_GRID_H + HUD_BOX_PAD;
const HUD_BOX_MAX_PAGES = 8;

/** The frame band (px) of a HUD panel that grabs it instead of its content. */
const HUD_PANEL_BORDER = 12;
/** How far (px) past a panel's frame the grab band reaches, to cover the seam. */
const HUD_PANEL_GRAB_PAD = 4;
/** Gap (px) a moved panel keeps from the screen edge. */
const HUD_PANEL_MARGIN = 8;
/** Solver passes when the panels are pushed apart. */
const HUD_PANEL_PUSH_PASSES = 16;
/** How far (px) the dragged panel advances per sub-step while pushing others. */
const HUD_PANEL_STEP = 8;
/** Cap on the sub-steps one pointer move may take, so a jump cannot loop. */
const HUD_PANEL_MAX_SUBSTEPS = 80;
/** The collapse-icon button at a panel's top-left, and its inset from the corner. */
const HUD_ICON = PANEL_ICON_SIZE;
const HUD_ICON_INSET = 4;
/** Where a panel's header/content starts, leaving room for the icon button. */
const HUD_CONTENT_LEFT = HUD_ICON_INSET + HUD_ICON + 6;

/** The pause menu (ESC / left-edge swipe): a centred window with two rows. */
const PAUSE_MENU_W = 360;
const PAUSE_MENU_ROW_H = 56;
const PAUSE_MENU_ITEMS = ['settings', 'reset'] as const;
const PAUSE_MENU_LABELS = ['Settings', 'Reset run'] as const;

/**
 * The member detail panel: a click on a party or PC-box member opens it to the
 * left of the box. A header (name, level, types) sits over two tabs — STATS and
 * MOVES — and the MOVES list can be dragged to reorder the member's moves.
 */
const HUD_DETAIL_H = HUD_BOX_H;
const HUD_DETAIL_TAB_H = 26;
const HUD_DETAIL_TABS_TOP = 72;
const HUD_DETAIL_CONTENT_TOP = HUD_DETAIL_TABS_TOP + HUD_DETAIL_TAB_H + 10;
const HUD_DETAIL_ROW = 40;
const HUD_DETAIL_STAT_ROW = 26;
const HUD_DETAIL_HPBAR_SCALE = 0.5;
const HUD_DETAIL_TYPE_W = 74;

/**
 * Render depth of a wall cell's walkable tip: above the actors so the character
 * passes **behind** the crown, below the grass overlay and the HUD.
 */
const TREE_TIP_DEPTH = 20;

/**
 * Ground actors (the player and the trainers) sort by their foot position, so a
 * lower tile draws in front: a player standing north of a trainer passes behind
 * it. The whole band stays between the ground items (`5`) and the tree tips
 * (`20`), so layering above the map is untouched.
 */
const ACTOR_DEPTH = 8;
const ACTOR_DEPTH_STEP = 0.0001;

/** The render depth of a ground actor standing with its feet at `footY`. */
function actorDepth(footY: number): number {
  return ACTOR_DEPTH + footY * ACTOR_DEPTH_STEP;
}

/** The four directions, in the order the update loop tests them. */
type MoveKey = 'up' | 'down' | 'left' | 'right';

/** How long one tile takes to cross on foot, and with the run key held. */
const WALK_STEP_MS = 200;
const RUN_STEP_MS = 110;

/** Hold the reset key this long to start a fresh run: a filling ring + a fade. */
const RESET_HOLD_MS = 1600;
const RESET_RADIUS = 22;
const RESET_FADE_IN_MS = 260;

/** How long a "spinning" trainer holds a facing before it turns to the next. */
const TRAINER_TURN_MS = 1400;
/** How long one chase step takes while a trainer walks toward the player. */
const TRAINER_CHASE_STEP_MS = 170;

const MOVE_STEP: Readonly<Record<MoveKey, Tile>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** The cardinal a tile step moves toward, for a trainer's walk pose. */
function stepFacing(from: Tile, to: Tile): Facing {
  if (to.x > from.x) return 'E';
  if (to.x < from.x) return 'W';
  if (to.y < from.y) return 'N';
  return 'S';
}

/** A trainer drawn on the route, with its atlas key when it has a decomp sprite. */
type TrainerSpriteEntry = {
  trainer: RouteTrainer;
  sprite: Phaser.GameObjects.Sprite;
  spriteKey: string | null;
};

/**
 * One draggable HUD panel. Its window chrome and content live in `body` and its
 * collapse button in `icon`; both are children of `container`. `x`/`y`/`w`/`h`
 * are the expanded layout rect and `dx`/`dy` the drag displacement; `expanded` is
 * false when the panel is collapsed to its icon. The current on-screen rect is
 * the layout rect (or the icon's) shifted by the offset, which is what the drag
 * and the push solver read.
 */
type HudPanel = {
  id: HudPanelId;
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Container;
  icon: Phaser.GameObjects.Container;
  x: number;
  y: number;
  w: number;
  h: number;
  dx: number;
  dy: number;
  expanded: boolean;
};

/** The base inputs of the route on screen, before the debug reroll nonce. */
type RouteParams = Readonly<{
  seed: string;
  routeIndex: number;
  shape: RouteShape;
  width: number;
  height: number;
  grassPatches: number;
  ledges: number;
  /** The plan-driven room (normal play); absent for the dev generator/import tools. */
  room?: RoomView;
}>;

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

/** "serious" -> "Serious", for the nature line. */
function capitalize(text: string): string {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}

/** True when `tile` is inside the playable map (the border included). */
function inBounds(map: TileMap, tile: Tile): boolean {
  return tile.y >= 0 && tile.y < map.length && tile.x >= 0 && tile.x < map[0].length;
}

// Until the starter pick lands, the scene seeds a run with a fixed demo starter
// and bag and walks its routes off one dev seed.
const DEV_SEED = 'dev-seed';

const DEMO_STARTER: FighterInput = { id: 'starter', speciesId: 'charmander', level: 5, moves: ['ember', 'scratch', 'growl'] };
const DEMO_RESERVE: FighterInput = { id: 'reserve', speciesId: 'squirtle', level: 4, moves: ['watergun', 'tackle', 'tailwhip'] };

const DEMO_BAG: readonly BagCounts[] = [];

export class RouteScene extends Phaser.Scene {
  private route!: RouteMap;
  private map!: TileMap;
  /** `map` for movement: a tree's walkable tip is passable even though it draws as wall. */
  private moveMap!: TileMap;
  /** The tiles `drawTiles` renders: the live map, or a dev generator step. */
  private renderTiles!: TileMap;
  /** Tree tips a grass patch shares: grass drawn under the crown, encounter on step. */
  private grassTipKeys: Set<string> = new Set();
  /** Dev only: the build-phase snapshots of the route on screen. */
  private generatorSteps: readonly RouteStep[] = [];
  private generatorStepIndex: number | null = null;
  private encounters!: RouteEncounters;
  private tilesetId: TilesetId = 'wood';
  private player: Tile = { x: 1, y: 1 };
  private playerSprite!: Phaser.GameObjects.Sprite;
  private tileSprites: Phaser.GameObjects.Image[][][] = [];
  /** Tall-grass overlays and any future entities, so a rebuild can clear them. */
  private entitySprites: Phaser.GameObjects.GameObject[] = [];
  /** The ground items on screen, so a pickup can hide one and a rebuild clear all. */
  private itemSprites: { item: RouteItem; sprite: Phaser.GameObjects.Image }[] = [];
  /** The trainers on screen, so a win can hide one and a rebuild clear all. */
  private trainerSprites: TrainerSpriteEntry[] = [];
  /** Which facing a spinning trainer is showing, so a turn only redraws on change. */
  private trainerSpinIndex = new Map<string, number>();
  /** The facing each trainer is currently using, so a spinner's cone turns too. */
  private trainerFacing = new Map<string, Facing>();
  /** The trainer walking toward a player it spotted, until the battle opens. */
  private chase: {
    entry: TrainerSpriteEntry;
    position: Tile;
  } | null = null;
  /** The inputs behind the route on screen; the debug reroll rebuilds from it. */
  private routeParams!: RouteParams;
  private run!: RunState;
  /** The floor plan and the room it is playing, for map navigation and the portal. */
  private plan: MapPlan | null = null;
  private room: RoomView | null = null;
  private settings!: Settings;
  /** Dev only: walk through solid tiles so a route can be inspected quickly. */
  private passThrough = false;
  /** Dev only: color the cell under the mouse and show its tile coordinates. */
  private hoverInspect = false;
  private hoverCell: Tile | null = null;
  private hoverMarker: Phaser.GameObjects.Rectangle | null = null;
  private hoverLabel: Phaser.GameObjects.BitmapText | null = null;
  private gameOver = false;
  private battleCounter = 0;
  /** Dev only: unique ids for Pokémon dropped in from the debug menu. */
  private debugMonCounter = 0;
  private pendingBattle: BattleLaunch | null = null;
  /** The movement keys behind the current bindings (arrows plus WASD), watched every frame. */
  private moveKeys!: Record<MoveKey, Phaser.Input.Keyboard.Key[]>;
  /** The run key; held while walking, it speeds the step and the walk cycle. */
  private runKey: Phaser.Input.Keyboard.Key | null = null;
  /** Hold-to-reset: the key, the progress toward restarting and the overlay. */
  private resetKey: Phaser.Input.Keyboard.Key | null = null;
  /** The on-screen pad + A / B, on a touch screen only. */
  private touch: TouchControls | null = null;
  /** Detaches the phone's Back-gesture listener (the pause-menu opener). */
  private detachBack: (() => void) | null = null;
  /** The pause menu (ESC, or a left-edge swipe on mobile): Settings and Reset. */
  private pauseMenu!: Phaser.GameObjects.Container;
  private pauseMenuOpen = false;
  private pauseMenuIndex = 0;
  /** Reset is two-press: the first arms it, the second starts the new run. */
  private pauseMenuArmed = false;
  private pauseMenuRows: { highlight: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.BitmapText }[] = [];
  private resetHold = 0;
  private resetScrim!: Phaser.GameObjects.Rectangle;
  private resetRing!: Phaser.GameObjects.Graphics;
  /** The direction the player faces, for the idle frame and the walk cycle. */
  private facing: PlayerFacing = 'down';
  /** The last cardinal the player faced, so the interact key can look ahead. */
  private facingDir: MoveKey = 'down';
  /** The in-flight step, while the sprite slides from one tile to the next. */
  private walkTween: Phaser.Tweens.Tween | null = null;
  private hudRoot!: Phaser.GameObjects.Container;
  /** The draggable panels of the HUD, in draw order. */
  private hudPanels: HudPanel[] = [];
  /** The panel being dragged (pointer start + its offset at grab time), or null. */
  private hudPanelDrag: {
    id: HudPanelId;
    pointerStart: { x: number; y: number };
    offsetStart: { x: number; y: number };
  } | null = null;
  /**
   * A press on a collapse icon waiting to become a click (toggle) or a drag
   * (once the pointer passes the slop), or null.
   */
  private hudIconPress: { id: HudPanelId; originX: number; originY: number } | null = null;
  /** Whether the detail panel has been placed once (it is not re-docked after). */
  private hudDetailPlaced = false;
  private hudTitle!: Phaser.GameObjects.BitmapText;
  /** The floor minimap panel: its graphics and the "no map" label. */
  private hudMapGraphics!: Phaser.GameObjects.Graphics;
  private hudMapEmpty!: Phaser.GameObjects.BitmapText;
  /** Whether the route HUD overlay (route header, party and bag) is shown; hidden by default. */
  private hudVisible = false;
  /** The pinned HUD camera; a rebuild must teach it to ignore the new sprites. */
  private hudCamera: Phaser.Cameras.Scene2D.Camera | null = null;
  private hudBagRows: {
    icon: Phaser.GameObjects.Image;
    name: Phaser.GameObjects.BitmapText;
    count: Phaser.GameObjects.BitmapText;
  }[] = [];
  /** The bag pocket tabs (FRLG strip) and which pocket is showing. */
  private hudBagTabs: {
    category: BagCategory;
    bg: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.BitmapText;
  }[] = [];
  private hudBagCategory: BagCategory = 'equipment';
  private hudBagEmpty!: Phaser.GameObjects.BitmapText;
  /** The HUD's party/box grab (the shared reducer's cursor), and whether it moved. */
  private hudUi: PartyUiState = initialPartyUi();
  private hudGrabMoved = false;
  /** The equipment stack in hand while a bag item is dragged; null otherwise. */
  private hudDragItem: string | null = null;
  /** The member a badge grab came from, so a stray drop puts the item back. */
  private hudDragItemFrom: string | null = null;
  /** The HUD's left edge, and the PARTY, bag and PC BOX windows' geometry. */
  private hudX = 0;
  private hudPartyY = 0;
  private hudPartyH = 0;
  private hudBagY = 0;
  private hudBagH = 0;
  private hudBoxX = 0;
  private hudBoxY = 0;
  private hudBoxH = 0;
  /** The box's current page, its page tabs and its avatar cells. */
  private hudBoxPage = 0;
  private hudBoxTabs: {
    page: number;
    bg: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.BitmapText;
  }[] = [];
  private hudBoxCells: {
    highlight: Phaser.GameObjects.Rectangle;
    bg: Phaser.GameObjects.Rectangle;
    portrait: Phaser.GameObjects.Image;
    held: Phaser.GameObjects.Image;
  }[] = [];
  /** The avatar held "in hand" while a party/box member is being dragged. */
  private hudDragGhost!: Phaser.GameObjects.Image;
  private hudRows: {
    highlight: Phaser.GameObjects.Rectangle;
    portrait: Phaser.GameObjects.Image;
    held: Phaser.GameObjects.Image;
    name: Phaser.GameObjects.BitmapText;
    level: Phaser.GameObjects.BitmapText;
    hpText: Phaser.GameObjects.BitmapText;
    bar: Phaser.GameObjects.Image;
    fill: Phaser.GameObjects.Rectangle;
  }[] = [];
  /** The member detail panel (STATS / MOVES) and the state behind it. */
  private hudDetail!: Phaser.GameObjects.Container;
  private hudDetailState: DetailState = CLOSED_DETAIL;
  private hudDetailView: MemberDetail | null = null;
  private hudDetailX = 0;
  private hudDetailY = 0;
  private hudDetailName!: Phaser.GameObjects.BitmapText;
  private hudDetailLevel!: Phaser.GameObjects.BitmapText;
  private hudDetailTypes: {
    bg: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.BitmapText;
  }[] = [];
  private hudDetailTabs: {
    tab: DetailTab;
    bg: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.BitmapText;
  }[] = [];
  private hudDetailStats!: {
    hpBar: Phaser.GameObjects.Image;
    hpFill: Phaser.GameObjects.Rectangle;
    hpText: Phaser.GameObjects.BitmapText;
    rows: { label: Phaser.GameObjects.BitmapText; value: Phaser.GameObjects.BitmapText }[];
    nature: Phaser.GameObjects.BitmapText;
    ability: Phaser.GameObjects.BitmapText;
    held: Phaser.GameObjects.BitmapText;
  };
  private hudDetailMoves: {
    highlight: Phaser.GameObjects.Rectangle;
    name: Phaser.GameObjects.BitmapText;
    typeBg: Phaser.GameObjects.Rectangle;
    typeLabel: Phaser.GameObjects.BitmapText;
    pp: Phaser.GameObjects.BitmapText;
  }[] = [];
  private hudDetailEmpty!: Phaser.GameObjects.BitmapText;
  /**
   * A member press waiting to become a click or a drag: a release without
   * movement opens the detail panel, a move past the slop grabs and reorders.
   */
  private hudPress: {
    pane: PaneId;
    index: number;
    memberId: string;
    originX: number;
    originY: number;
  } | null = null;
  /** The "was released" overlay while a beat sequence is playing. */
  private releaseRoot: Phaser.GameObjects.Container | null = null;
  private releaseQueue: ReleaseBeat[] = [];
  private releaseOnDone: (() => void) | null = null;
  private releaseWait: Phaser.Time.TimerEvent | null = null;
  private releaseArmed = false;
  private releasePortrait!: Phaser.GameObjects.Image;
  private releaseText!: Phaser.GameObjects.BitmapText;

  constructor() {
    super('Route');
  }

  init(data?: { run?: RunState }): void {
    if (data?.run) this.run = data.run;
  }

  /** Writes the run to the save slot (Phase 7), so a reload resumes it. */
  private persistRun(): void {
    storeRun(browserStorage(), this.run);
  }

  /**
   * Builds the run's current room from the map plan and points the scene at it:
   * its plan size and opening set, the biome's terrain and — in the boss room —
   * the map boss. The dev generator and the frame-map importer build a route
   * directly instead, without a room, so they keep the rolled shape.
   */
  private buildRoom(): void {
    const plan = planMap(this.run.seed, this.run.mapIndex);
    const view = roomView(plan, this.run.routeInMap, this.portalOpen(), this.run.arrivalEdge);
    this.plan = plan;
    this.room = view;
    const biome = getBiome(view.biomeId);
    this.buildRoute({
      seed: this.run.seed,
      // The room's geometry, trainers and loot seed off a **stable** per-room
      // index, not the run's moving counter, so walking back into a room shows the
      // same room (`docs/maps-spec.md` §9).
      routeIndex: routeIndexForRoom(plan, view.roomId),
      shape: DEFAULT_SHAPE,
      width: view.width,
      height: view.height,
      grassPatches: biome.terrain.grassPatches,
      ledges: biome.terrain.ledges,
      room: view,
    });
    if (view.boss && !this.run.bossDefeated) {
      const boss = this.bossTrainer(view);
      if (boss) this.route = { ...this.route, trainers: [...this.route.trainers, boss] };
    }
  }

  /** The portal is open once the map's boss has fallen, except on the final map (D31). */
  private portalOpen(): boolean {
    return this.run.bossDefeated && !isFinalMap(this.run.mode, this.run.mapIndex);
  }

  /**
   * The map boss: a themed `ace` trainer at the room's farthest walkable tile,
   * fielding a max-level party. It stands only while the map's boss is alive, so
   * the portal stays sealed until it falls.
   */
  private bossTrainer(view: RoomView): RouteTrainer | null {
    const position = this.farthestRoomTile();
    if (!position) return null;
    return {
      id: bossTrainerId(view.mapIndex),
      position,
      facing: this.facingFromTo(position, this.route.entry),
      sight: DEFAULT_TRAINER_SIGHT,
      archetypeId: 'ace',
    };
  }

  /**
   * The walkable tile farthest (BFS) from the room entry, skipping tiles a
   * trainer or a visible item already owns; null when only the entry is free.
   */
  private farthestRoomTile(): Tile | null {
    const from = this.route.entry;
    const occupied = new Set<string>();
    for (const trainer of this.route.trainers) occupied.add(`${trainer.position.x},${trainer.position.y}`);
    for (const item of this.route.items) occupied.add(`${item.position.x},${item.position.y}`);
    const startKey = `${from.x},${from.y}`;
    const seen = new Set<string>([startKey]);
    const queue: Tile[] = [{ ...from }];
    let farthest: Tile | null = null;
    const deltas: readonly Tile[] = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];
    for (let head = 0; head < queue.length; head++) {
      const current = queue[head];
      if (`${current.x},${current.y}` !== startKey && !occupied.has(`${current.x},${current.y}`)) {
        farthest = current;
      }
      for (const delta of deltas) {
        const next = { x: current.x + delta.x, y: current.y + delta.y };
        const key = `${next.x},${next.y}`;
        if (seen.has(key) || !isWalkable(this.moveMap, next)) continue;
        seen.add(key);
        queue.push(next);
      }
    }
    return farthest;
  }

  /** The cardinal direction from `from` to `to` (the boss faces the door it guards). */
  private facingFromTo(from: Tile, to: Tile): Facing {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (dx === 0 && dy === 0) return 'S';
    if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'E' : 'W';
    return dy > 0 ? 'S' : 'N';
  }

  /**
   * Builds the route for `params` (plus the debug reroll `attempt`) and points
   * the scene at it: map, render tiles, tileset and the encounter stream.
   * `create`, a room change and the debug "regenerate" all go through here so
   * they cannot drift.
   */
  private buildRoute(params: RouteParams, attempt = 0): void {
    const biome = params.room ? getBiome(params.room.biomeId) : biomeForRoute(params.routeIndex);
    const seed = attempt > 0 ? `${params.seed}#r${attempt}` : params.seed;
    this.routeParams = params;
    const pattern = TILESETS[biome.tilesetId].config.wallPattern;
    const wall = pattern ? { cols: pattern.cols, minHeight: Math.max(2, pattern.rows.length - 2) } : undefined;
    const band = params.room ? bandForMap(params.room.mapIndex) : runBand(this.run.seed, params.routeIndex);
    const loot = ROUTE_LOOT[band.id];
    const request: RouteRequest = {
      seed,
      routeIndex: params.routeIndex,
      biomeId: biome.id,
      layout: biome.layout,
      ...(params.room
        ? { openings: params.room.openings, width: params.room.width, height: params.room.height }
        : { shape: params.shape, width: params.width, height: params.height }),
      grassPatches: params.grassPatches,
      ledges: params.ledges,
      loot: loot.pool,
      hiddenChance: loot.hiddenChance,
      itemChance: loot.itemChance,
      trainerArchetypes: TRAINER_ARCHETYPE_IDS,
      ...(wall ? { wall } : {}),
    };
    const route = sketchRoute(request);
    this.generatorSteps = IS_DEVELOP ? sketchRouteSteps(request) : [];
    this.applyRoute(route, params.room ?? null);
  }

  /**
   * Points the scene at an already-built route: its tiles become the live and
   * render maps, and the tileset and encounter stream follow the route's biome.
   * Both `buildRoute` and the debug frame-map import go through here so they
   * cannot drift. `view` is the plan room on screen (null for an imported map or
   * the dev generator), which carries the map band and the room's ramp level.
   */
  private applyRoute(route: RouteMap, view: RoomView | null = null): void {
    this.route = route;
    this.map = route.tiles;
    this.renderTiles = this.map;
    this.generatorStepIndex = null;
    const biome = getBiome(route.biomeId);
    const band = view ? bandForMap(view.mapIndex) : runBand(this.run.seed, route.routeIndex);
    const roomLevel = view
      ? roomLevelForMap(view.mapIndex, view.roomId, view.roomCount)
      : runRoomLevel(this.run.seed, route.routeIndex);
    this.tilesetId = resolveTileset(this.settings.tileset, biome.tilesetId);
    this.moveMap = this.movementMap(this.map);
    this.encounters = new RouteEncounters(
      biome.encounters[band.id],
      roomLevel,
      roomLevel,
      new Rng(hashSeed(`${route.seed}:encounters:${route.routeIndex}`)),
      undefined,
      // Shinies roll on their own stream, so they never shift the encounter
      // sequence a fixed seed already produced.
      new Rng(hashSeed(`${route.seed}:shiny:${route.routeIndex}`)),
    );
  }

  create(): void {
    if (!this.run) {
      this.run = createRun({ seed: DEV_SEED, starter: createRunPokemon(DEMO_STARTER), bag: DEMO_BAG });
      this.run = addPokemon(this.run, createRunPokemon(DEMO_RESERVE));
    }
    this.persistRun();
    this.tileSprites = [];
    this.hudRows = [];
    this.hudBagRows = [];
    this.hudPanels = [];
    this.hudPanelDrag = null;
    this.hudIconPress = null;
    this.hudDetailPlaced = false;
    this.trainerSprites = [];
    this.trainerSpinIndex.clear();
    this.trainerFacing.clear();
    this.chase = null;
    this.hudVisible = false;
    this.hudDetailState = CLOSED_DETAIL;
    this.hudDetailView = null;
    this.hudPress = null;
    this.passThrough = false;
    this.clearHoverInspect();
    this.gameOver = false;
    this.pendingBattle = null;
    this.releaseRoot = null;
    this.releaseQueue = [];
    this.releaseOnDone = null;
    this.releaseWait = null;
    this.releaseArmed = false;
    this.facing = 'down';
    this.walkTween = null;
    this.resetHold = 0;
    this.settings = loadSettings();

    this.buildRoom();

    this.drawTiles();
    this.drawEntities();
    this.drawItems();
    this.drawTrainers();
    this.player = { ...this.route.entry };
    this.playerSprite = this.add
      .sprite(0, 0, PLAYER_SPRITE_TEXTURE_KEY, playerSpriteFrame('down'))
      .setOrigin(0.5, 1)
      .setScale(TILE_SIZE / PLAYER_SPRITE_WIDTH)
      .setDepth(actorDepth(0));
    this.movePlayerTo(this.player.x, this.player.y);

    const cameraBounds = mapPixelSize(this.map, TILE_SIZE);
    this.cameras.main.setBounds(0, 0, cameraBounds.width, cameraBounds.height);
    this.cameras.main.setZoom(2);
    this.cameras.main.startFollow(this.playerSprite, true, 0.2, 0.2);

    this.refreshMoveKeys();

    subscribeKeybinds(
      this,
      ({ action }) => this.handleAction(action),
      // The route holds the run, so it keeps its own settings snapshot rather
      // than re-reading the whole save on every key; `applySettings` refreshes it.
      () => this.settings.keybinds,
    );
    if (IS_DEVELOP) {
      this.input.keyboard!.on('keydown-B', () => {
        if (this.scene.isActive()) this.startBattle({ kind: 'wild', speciesId: 'scatterbug', level: 5, key: 'dev' });
      });
      this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
        this.updateHoverInspect(pointer);
      });
      this.input.on('gameout', () => this.clearHoverInspect());
    }
    // Bag pocket tabs: `[` / `]` cycle them, a click picks one. Both are inert
    // until the HUD is on screen, so they never fight the movement keys.
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      if (!this.scene.isActive() || !this.hudVisible) return;
      if (event.key === '[') this.stepBagCategory(-1);
      else if (event.key === ']') this.stepBagCategory(1);
    });
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.handleHudPointerDown(pointer));
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.handleHudPointerMove(pointer));
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.handleHudPointerUp(pointer));
    // A drag whose button is released off the canvas (or that leaves the screen)
    // must let go, or the held panel/member keeps following a pointer that is gone.
    this.input.on('pointerupoutside', () => this.cancelHudDrags());
    this.input.on('gameout', () => this.cancelHudDrags());
    // The mouse wheel flips the PC box pages while the HUD is open.
    this.input.on(
      'wheel',
      (pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => {
        if (!this.scene.isActive() || !this.hudVisible || !this.pointerInBoxPanel(pointer)) return;
        this.stepBoxPage(dy > 0 ? 1 : -1);
      },
    );
    this.buildHud();
    this.setupHudCamera();
    // The touch pad and the pause menu live on the pinned HUD camera (screen
    // space) and are ignored by the zoomed world camera, like the HUD.
    this.touch = createTouchControls(this, {
      onAction: (action) => this.handleAction(action),
    });
    this.cameras.main.ignore(this.touch.root);
    // On a touch screen the phone's own Back gesture opens the pause menu (the
    // browser hands it to us as a history pop); a keyboard uses Esc instead.
    if (this.touch.enabled) {
      this.detachBack = listenForBack(() => this.onBackGesture());
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.detachBack?.());
    }
    // A battle pauses the route mid-walk; drop the pad's held direction so the
    // player does not keep stepping the moment the route comes back.
    this.events.on(Phaser.Scenes.Events.PAUSE, () => this.touch?.release());
    this.events.on(Phaser.Scenes.Events.RESUME, () => this.touch?.release());
    this.buildResetOverlay();
    this.buildPauseMenu();
    this.refreshHud();
    this.refreshDetail();
  }

  /**
   * The player's intent behind one shared action, whatever drove it: a key from
   * the map or the on-screen A / B. While the pause menu is up it owns the input.
   */
  private handleAction(action: KeybindAction): void {
    if (!this.scene.isActive()) return;
    if (this.pauseMenuOpen) {
      this.handlePauseMenuAction(action);
      return;
    }
    switch (action) {
      case 'confirm':
        // `E` is the accept key: it moves a release beat on, and otherwise
        // doubles as the overworld interact (the shared default for both).
        if (this.releaseRoot) {
          if (this.releaseArmed) this.advanceRelease();
          return;
        }
        this.tryInteract();
        return;
      case 'interact':
        this.tryInteract();
        return;
      case 'hud':
        this.toggleHud();
        return;
      case 'cancel':
        if (this.hudVisible) this.toggleHud();
        else this.openPauseMenu();
        return;
      case 'settings':
        this.openSettings();
        return;
    }
  }

  /** Resolves the movement keys from the shared map; re-run when it changes. */
  private refreshMoveKeys(): void {
    const bind = (action: MoveKey): Phaser.Input.Keyboard.Key[] =>
      actionKeys(this, action, this.settings.keybinds);
    this.moveKeys = { up: bind('up'), down: bind('down'), left: bind('left'), right: bind('right') };
    this.runKey = actionKeys(this, 'run', this.settings.keybinds)[0] ?? null;
    this.resetKey = actionKeys(this, 'reset', this.settings.keybinds)[0] ?? null;
  }

  /**
   * The persistent overlay: a slim route header plus a party window (portrait,
   * name, level and HP bar) and a bag window (pocket tabs over the active
   * pocket's icon, name and count), each its own FRLG nine-slice so the two
   * never share a panel.
   */
  private buildHud(): void {
    const x = this.scale.width - HUD_PANEL_W - 8;
    const left = x + HUD_PAD_X;
    const right = x + HUD_PANEL_W - HUD_PAD_X;
    const headerChildren: Phaser.GameObjects.GameObject[] = [];
    const mapChildren: Phaser.GameObjects.GameObject[] = [];
    const partyChildren: Phaser.GameObjects.GameObject[] = [];
    const bagChildren: Phaser.GameObjects.GameObject[] = [];
    const boxChildren: Phaser.GameObjects.GameObject[] = [];

    const header = addFrlgWindow(this, x, HUD_TOP, HUD_PANEL_W, HUD_HEADER_H);
    this.hudTitle = addFrlgText(this, x + HUD_CONTENT_LEFT, HUD_TOP + HUD_PAD_TOP, '', {
      size: 16,
      tint: FRLG_INK,
    });
    headerChildren.push(header, this.hudTitle);

    // The floor minimap: the grid of discovered rooms, drawn on a Graphics so a
    // room change can clear and redraw it. The layout itself is the pure
    // `buildMapView`; this panel only scales and paints it (`docs/maps-spec.md` §8).
    mapChildren.push(addFrlgWindow(this, HUD_MAP_X, HUD_MAP_Y, HUD_MAP_W, HUD_MAP_H));
    mapChildren.push(
      addFrlgText(this, HUD_MAP_X + HUD_CONTENT_LEFT, HUD_MAP_Y + HUD_PAD_TOP, 'MAP', {
        size: 16,
        tint: FRLG_INK,
      }),
    );
    this.hudMapGraphics = this.add.graphics();
    this.hudMapEmpty = addFrlgText(
      this,
      HUD_MAP_X + HUD_MAP_W / 2,
      HUD_MAP_Y + HUD_MAP_HEADER + 56,
      'no map',
      { size: 16, tint: 0x6b6887, origin: [0.5, 0] },
    );
    mapChildren.push(this.hudMapGraphics, this.hudMapEmpty);

    const partyY = HUD_TOP + HUD_HEADER_H + HUD_GAP;
    const partyH = HUD_PARTY_HEADER + MAX_PARTY_SIZE * HUD_PARTY_ROW + HUD_PAD_BOTTOM;
    this.hudX = x;
    this.hudPartyY = partyY;
    this.hudPartyH = partyH;
    partyChildren.push(addFrlgWindow(this, x, partyY, HUD_PANEL_W, partyH));
    partyChildren.push(
      addFrlgText(this, x + HUD_CONTENT_LEFT, partyY + HUD_PAD_TOP, 'PARTY', { size: 16, tint: 0x3a3956 }),
    );
    this.hudRows = [];
    for (let i = 0; i < MAX_PARTY_SIZE; i++) {
      const rowY = partyY + HUD_PARTY_HEADER + i * HUD_PARTY_ROW;
      const highlight = this.add
        .rectangle(left, rowY, right - left, HUD_PARTY_ROW - 4, 0xf2c14e, 0.32)
        .setOrigin(0, 0)
        .setVisible(false);
      const portraitX = left + 24;
      const portrait = this.add
        .image(portraitX, rowY + 26, PORTRAIT_TEXTURE_KEY, 0)
        .setScale(HUD_PARTY_PORTRAIT_SCALE)
        .setVisible(false);
      const held = this.add
        .image(portraitX + 15, rowY + 39, ITEM_ICON_TEXTURE_KEY, 0)
        .setScale(HUD_HELD_ICON_SCALE)
        .setVisible(false);
      const column = left + 56;
      const name = addFrlgText(this, column, rowY + 6, '', { size: 16, tint: FRLG_INK });
      const level = addFrlgText(this, right, rowY + 6, '', {
        size: 16,
        tint: 0x3a3956,
        origin: [1, 0],
      });
      const bar = this.add
        .image(column, rowY + 28, FRLG_HPBAR_KEY)
        .setOrigin(0, 0)
        .setScale(HUD_HPBAR_SCALE)
        .setVisible(false);
      const fill = this.add
        .rectangle(column, rowY + 28, 0, FRLG_HPBAR.fill.height * HUD_HPBAR_SCALE, 0x58d080)
        .setOrigin(0, 0)
        .setVisible(false);
      const hpText = addFrlgText(this, right, rowY + 30, '', {
        size: 16,
        tint: FRLG_INK,
        origin: [1, 0],
      });
      this.hudRows.push({ highlight, portrait, held, name, level, hpText, bar, fill });
      partyChildren.push(highlight, portrait, held, name, level, bar, fill, hpText);
    }

    const bagY = partyY + partyH + HUD_GAP;
    const bagH = HUD_BAG_HEADER + HUD_BAG_ROWS * HUD_BAG_ROW + HUD_PAD_BOTTOM;
    this.hudBagY = bagY;
    this.hudBagH = bagH;
    bagChildren.push(addFrlgWindow(this, x, bagY, HUD_PANEL_W, bagH));

    // Pocket tabs across the window's head, FRLG style: the active one reads
    // dark-on-light, the rest stay a pale folder. Click or `[` / `]` to switch.
    this.hudBagTabs = [];
    BAG_CATEGORIES.forEach((category, i) => {
      const tabX = x + HUD_CONTENT_LEFT + i * (HUD_TAB_W + HUD_TAB_GAP);
      const tabY = bagY + HUD_PAD_TOP;
      const bg = this.add.rectangle(tabX, tabY, HUD_TAB_W, HUD_TAB_H, 0xcfcce2).setOrigin(0, 0);
      const label = addFrlgText(this, tabX + HUD_TAB_W / 2, tabY + 5, BAG_CATEGORY_LABELS[category], {
        size: 16,
        tint: FRLG_INK,
        origin: [0.5, 0],
      });
      this.hudBagTabs.push({ category, bg, label });
      bagChildren.push(bg, label);
    });

    this.hudBagRows = [];
    for (let i = 0; i < HUD_BAG_ROWS; i++) {
      const rowY = bagY + HUD_BAG_HEADER + i * HUD_BAG_ROW;
      const icon = this.add
        .image(left + 10, rowY + 20, ITEM_ICON_TEXTURE_KEY, 0)
        .setScale(0.75)
        .setVisible(false);
      const name = addFrlgText(this, left + 28, rowY + 12, '', { size: 16, tint: FRLG_INK });
      const count = addFrlgText(this, right, rowY + 12, '', {
        size: 16,
        tint: 0x3a3956,
        origin: [1, 0],
      });
      this.hudBagRows.push({ icon, name, count });
      bagChildren.push(icon, name, count);
    }

    this.hudBagEmpty = addFrlgText(this, x + HUD_PANEL_W / 2, bagY + HUD_BAG_HEADER + 36, 'no items', {
      size: 16,
      tint: 0x6b6887,
      origin: [0.5, 0],
    });
    bagChildren.push(this.hudBagEmpty);

    // The PC BOX window: a page tab strip over a grid of avatar cells, in a
    // second column to the left of the party/bag stack.
    const boxX = x - HUD_PANEL_W - HUD_GAP;
    const boxY = HUD_TOP + 64;
    this.hudBoxX = boxX;
    this.hudBoxY = boxY;
    this.hudBoxH = HUD_BOX_H;
    boxChildren.push(addFrlgWindow(this, boxX, boxY, HUD_PANEL_W, HUD_BOX_H));

    this.hudBoxTabs = [];
    for (let page = 0; page < HUD_BOX_MAX_PAGES; page++) {
      const tabX = boxX + HUD_CONTENT_LEFT + page * (HUD_BOX_TAB_W + HUD_BOX_TAB_GAP);
      const bg = this.add
        .rectangle(tabX, boxY + HUD_PAD_TOP, HUD_BOX_TAB_W, HUD_TAB_H, 0xcfcce2)
        .setOrigin(0, 0)
        .setVisible(false);
      const label = addFrlgText(this, tabX + HUD_BOX_TAB_W / 2, boxY + HUD_PAD_TOP + 5, String(page + 1), {
        size: 16,
        tint: FRLG_INK,
        origin: [0.5, 0],
      }).setVisible(false);
      this.hudBoxTabs.push({ page, bg, label });
      boxChildren.push(bg, label);
    }

    const gridW = BOX_COLS * HUD_BOX_CELL + (BOX_COLS - 1) * HUD_BOX_CELL_GAP;
    const gridLeft = boxX + HUD_BOX_PAD + (HUD_PANEL_W - HUD_BOX_PAD * 2 - gridW) / 2;
    this.hudBoxCells = [];
    for (let i = 0; i < BOX_PAGE_SIZE; i++) {
      const col = i % BOX_COLS;
      const row = Math.floor(i / BOX_COLS);
      const cellX = gridLeft + col * (HUD_BOX_CELL + HUD_BOX_CELL_GAP);
      const cellY = boxY + HUD_BOX_TABS_H + row * (HUD_BOX_CELL + HUD_BOX_CELL_GAP);
      const bg = this.add.rectangle(cellX, cellY, HUD_BOX_CELL, HUD_BOX_CELL, 0xe6e3f2).setOrigin(0, 0);
      const highlight = this.add
        .rectangle(cellX, cellY, HUD_BOX_CELL, HUD_BOX_CELL, 0xf2c14e, 0.45)
        .setOrigin(0, 0)
        .setVisible(false);
      const portrait = this.add
        .image(cellX + HUD_BOX_CELL / 2, cellY + HUD_BOX_CELL / 2, PORTRAIT_TEXTURE_KEY, 0)
        .setScale(1)
        .setVisible(false);
      const held = this.add
        .image(cellX + 62, cellY + 62, ITEM_ICON_TEXTURE_KEY, 0)
        .setScale(HUD_BOX_HELD_ICON_SCALE)
        .setVisible(false);
      this.hudBoxCells.push({ highlight, bg, portrait, held });
      boxChildren.push(bg, highlight, portrait, held);
    }

    // The member detail panel, drawn over the box's left; hidden until a member
    // is clicked. It goes before the drag ghost so the ghost still rides on top.
    this.hudDetail = this.buildDetailPanel();

    // Each panel is its own container holding a body (the window and its content)
    // and an icon button; a drag moves the whole panel, the push solver shoves the
    // containers apart, and clicking the icon hides the body to collapse it.
    this.hudPanels = [
      this.makeHudPanel(
        'header',
        x,
        HUD_TOP,
        HUD_PANEL_W,
        HUD_HEADER_H,
        this.add.container(0, 0, headerChildren),
        PANEL_ICON_KEYS.header,
      ),
      this.makeHudPanel(
        'map',
        HUD_MAP_X,
        HUD_MAP_Y,
        HUD_MAP_W,
        HUD_MAP_H,
        this.add.container(0, 0, mapChildren),
        PANEL_ICON_KEYS.map,
      ),
      this.makeHudPanel(
        'party',
        x,
        partyY,
        HUD_PANEL_W,
        partyH,
        this.add.container(0, 0, partyChildren),
        PANEL_ICON_KEYS.party,
      ),
      this.makeHudPanel(
        'bag',
        x,
        bagY,
        HUD_PANEL_W,
        bagH,
        this.add.container(0, 0, bagChildren),
        PANEL_ICON_KEYS.bag,
      ),
      this.makeHudPanel(
        'box',
        boxX,
        boxY,
        HUD_PANEL_W,
        HUD_BOX_H,
        this.add.container(0, 0, boxChildren),
        PANEL_ICON_KEYS.box,
      ),
      this.makeHudPanel(
        'detail',
        this.hudDetailX,
        this.hudDetailY,
        HUD_PANEL_W,
        HUD_DETAIL_H,
        this.hudDetail,
        PANEL_ICON_KEYS.detail,
      ),
    ];

    // The avatar held in hand while dragging, drawn last so it rides over the
    // panels and follows the pointer anywhere on screen.
    this.hudDragGhost = this.add
      .image(0, 0, PORTRAIT_TEXTURE_KEY, 0)
      .setScale(0.9)
      .setVisible(false);

    this.hudRoot = this.add
      .container(0, 0, [...this.hudPanels.map((panel) => panel.container), this.hudDragGhost])
      .setDepth(150)
      .setVisible(this.hudVisible);

    this.applyStoredHudLayout();
  }

  /** One HUD panel: its body container plus the collapse button at its corner. */
  private makeHudPanel(
    id: HudPanelId,
    x: number,
    y: number,
    w: number,
    h: number,
    body: Phaser.GameObjects.Container,
    iconTexture: string,
  ): HudPanel {
    const icon = this.buildPanelIcon(x, y, iconTexture);
    const container = this.add.container(0, 0, [body, icon]);
    return { id, container, body, icon, x, y, w, h, dx: 0, dy: 0, expanded: true };
  }

  /** The small dark button with a white glyph that collapses its panel. */
  private buildPanelIcon(x: number, y: number, textureKey: string): Phaser.GameObjects.Container {
    const bg = this.add
      .rectangle(x + HUD_ICON_INSET, y + HUD_ICON_INSET, HUD_ICON, HUD_ICON, 0x2f2c4d)
      .setOrigin(0, 0);
    const image = this.add.image(
      x + HUD_ICON_INSET + HUD_ICON / 2,
      y + HUD_ICON_INSET + HUD_ICON / 2,
      textureKey,
    );
    return this.add.container(0, 0, [bg, image]);
  }

  /**
   * The member detail window: a header (name, level and type chips) over two
   * tabs, then either the STATS readout or the draggable MOVES list. Built once;
   * `refreshDetail` fills it in and shows or hides the whole container.
   */
  private buildDetailPanel(): Phaser.GameObjects.Container {
    const x = this.hudBoxX - HUD_PANEL_W - HUD_GAP;
    const y = this.hudBoxY;
    this.hudDetailX = x;
    this.hudDetailY = y;
    const left = x + HUD_PAD_X;
    const right = x + HUD_PANEL_W - HUD_PAD_X;
    const innerW = HUD_PANEL_W - HUD_PAD_X * 2;
    const children: Phaser.GameObjects.GameObject[] = [addFrlgWindow(this, x, y, HUD_PANEL_W, HUD_DETAIL_H)];

    this.hudDetailName = addFrlgText(this, x + HUD_CONTENT_LEFT, y + HUD_PAD_TOP, '', { size: 16, tint: FRLG_INK });
    this.hudDetailLevel = addFrlgText(this, right, y + HUD_PAD_TOP, '', {
      size: 16,
      tint: 0x3a3956,
      origin: [1, 0],
    });
    children.push(this.hudDetailName, this.hudDetailLevel);

    const chipY = y + HUD_PAD_TOP + 22;
    this.hudDetailTypes = [];
    for (let i = 0; i < 2; i++) {
      const chipX = left + i * (HUD_DETAIL_TYPE_W + 6);
      const bg = this.add
        .rectangle(chipX, chipY, HUD_DETAIL_TYPE_W, 20, 0x9aa0b4)
        .setOrigin(0, 0)
        .setVisible(false);
      const label = addFrlgText(this, chipX + HUD_DETAIL_TYPE_W / 2, chipY + 2, '', {
        size: 16,
        tint: 0xf8fafc,
        origin: [0.5, 0],
      }).setVisible(false);
      this.hudDetailTypes.push({ bg, label });
      children.push(bg, label);
    }

    const tabY = y + HUD_DETAIL_TABS_TOP;
    const tabW = (innerW - HUD_TAB_GAP) / 2;
    this.hudDetailTabs = [];
    (['stats', 'moves'] as DetailTab[]).forEach((tab, i) => {
      const tabX = left + i * (tabW + HUD_TAB_GAP);
      const bg = this.add.rectangle(tabX, tabY, tabW, HUD_DETAIL_TAB_H, 0xcfcce2).setOrigin(0, 0);
      const label = addFrlgText(this, tabX + tabW / 2, tabY + 5, tab === 'stats' ? 'STATS' : 'MOVES', {
        size: 16,
        tint: FRLG_INK,
        origin: [0.5, 0],
      });
      this.hudDetailTabs.push({ tab, bg, label });
      children.push(bg, label);
    });

    const contentTop = y + HUD_DETAIL_CONTENT_TOP;
    const hpBar = this.add
      .image(left, contentTop, FRLG_HPBAR_KEY)
      .setOrigin(0, 0)
      .setScale(HUD_DETAIL_HPBAR_SCALE);
    const hpFill = this.add
      .rectangle(
        left + FRLG_HPBAR.fill.x * HUD_DETAIL_HPBAR_SCALE,
        contentTop + FRLG_HPBAR.fill.y * HUD_DETAIL_HPBAR_SCALE,
        0,
        FRLG_HPBAR.fill.height * HUD_DETAIL_HPBAR_SCALE,
        0x58d080,
      )
      .setOrigin(0, 0);
    const hpText = addFrlgText(this, right, contentTop + 6, '', {
      size: 16,
      tint: FRLG_INK,
      origin: [1, 0],
    });
    children.push(hpBar, hpFill, hpText);

    const statsTop = contentTop + 30;
    const rows = DETAIL_STATS.map((stat, i) => {
      const rowY = statsTop + i * HUD_DETAIL_STAT_ROW;
      const label = addFrlgText(this, left, rowY, STAT_LABELS[stat], { size: 16, tint: 0x3a3956 });
      const value = addFrlgText(this, right, rowY, '', {
        size: 16,
        tint: FRLG_INK,
        origin: [1, 0],
      });
      children.push(label, value);
      return { label, value };
    });
    const infoTop = statsTop + DETAIL_STATS.length * HUD_DETAIL_STAT_ROW + 6;
    const nature = addFrlgText(this, left, infoTop, '', { size: 16, tint: 0x3a3956 });
    const ability = addFrlgText(this, left, infoTop + 22, '', { size: 16, tint: 0x3a3956 });
    const held = addFrlgText(this, left, infoTop + 44, '', { size: 16, tint: 0x3a3956 });
    children.push(nature, ability, held);
    this.hudDetailStats = { hpBar, hpFill, hpText, rows, nature, ability, held };

    this.hudDetailMoves = [];
    for (let i = 0; i < MAX_MOVES; i++) {
      const rowY = contentTop + i * HUD_DETAIL_ROW;
      const highlight = this.add
        .rectangle(left, rowY + 2, innerW, HUD_DETAIL_ROW - 4, 0xf2c14e, 0.32)
        .setOrigin(0, 0)
        .setVisible(false);
      const name = addFrlgText(this, left, rowY + 6, '', { size: 16, tint: FRLG_INK }).setMaxWidth(138);
      const typeBg = this.add
        .rectangle(left + 144, rowY + 8, HUD_DETAIL_TYPE_W, 20, 0x9aa0b4)
        .setOrigin(0, 0)
        .setVisible(false);
      const typeLabel = addFrlgText(this, left + 144 + HUD_DETAIL_TYPE_W / 2, rowY + 10, '', {
        size: 16,
        tint: 0xf8fafc,
        origin: [0.5, 0],
      }).setVisible(false);
      const pp = addFrlgText(this, right, rowY + 6, '', {
        size: 16,
        tint: 0x3a3956,
        origin: [1, 0],
      });
      this.hudDetailMoves.push({ highlight, name, typeBg, typeLabel, pp });
      children.push(highlight, name, typeBg, typeLabel, pp);
    }
    this.hudDetailEmpty = addFrlgText(this, x + HUD_PANEL_W / 2, contentTop + 40, 'no moves', {
      size: 16,
      tint: 0x6b6887,
      origin: [0.5, 0],
    });
    children.push(this.hudDetailEmpty);

    return this.add.container(0, 0, children).setVisible(false);
  }

  /** Shows or hides the route HUD overlay (route header, party, PC box and bag). Default hidden. */
  private toggleHud(): void {
    this.hudVisible = !this.hudVisible;
    if (!this.hudVisible) {
      this.hudUi = dropGrabbed(this.hudUi);
      this.hudPress = null;
      this.hudDetailState = closeDetail(this.hudDetailState);
      this.hudGrabMoved = false;
      this.hudDragItem = null;
      this.hudDragItemFrom = null;
      this.hudPanelDrag = null;
      this.hudIconPress = null;
      this.hudDragGhost.setVisible(false);
      this.input.setDefaultCursor('default');
    }
    this.hudRoot.setVisible(this.hudVisible);
    this.refreshDetail();
  }

  private refreshHud(): void {
    if (!this.hudRoot) return;
    const biomeName = this.route ? getBiome(this.route.biomeId).name : '';
    this.hudTitle.setText(`Map ${this.run.mapIndex} · ${biomeName}`);
    this.refreshMapView();

    this.hudRows.forEach((row, i) => {
      const member = this.run.party[i];
      const visible = member !== undefined;
      const alive = member !== undefined && member.fighter.hp > 0;
      row.highlight.setVisible(this.hudUi.grabbed?.pane === 'party' && this.hudUi.index === i);
      row.name.setVisible(visible);
      row.level.setVisible(visible);
      row.hpText.setVisible(visible);
      row.bar.setVisible(alive);
      row.fill.setVisible(alive);
      if (!member) {
        row.portrait.setVisible(false);
        row.held.setVisible(false);
        row.name.setText('');
        row.level.setText('');
        row.hpText.setText('');
        return;
      }
      const portrait = member ? portraitFor(member.fighter.speciesId, member.fighter.shiny) : null;
      row.portrait.setVisible(portrait !== null);
      if (portrait) row.portrait.setTexture(portrait.key, portrait.frame);
      const heldFrame = member.fighter.heldItem ? itemIconFrame(member.fighter.heldItem) : null;
      const inHand = this.hudDragItemFrom === member.fighter.id;
      row.held.setVisible(heldFrame !== null && !inHand);
      if (heldFrame !== null) row.held.setFrame(heldFrame);
      const maxHp = restoreFighter(member.fighter).maxHp;
      const hp = member.fighter.hp;
      row.name.setText(getSpecies(member.fighter.speciesId)?.name ?? member.fighter.speciesId);
      row.level.setText(`Lv${member.fighter.level}`);
      row.hpText.setText(`${hp}/${maxHp}`);
      const fraction = hpFraction(hp, maxHp);
      const barScale = row.bar.scaleX;
      row.fill
        .setPosition(
          row.bar.x + FRLG_HPBAR.fill.x * barScale,
          row.bar.y + FRLG_HPBAR.fill.y * barScale,
        )
        .setSize(
          Math.max(0, FRLG_HPBAR.fill.width * barScale * fraction),
          FRLG_HPBAR.fill.height * barScale,
        )
        .setFillStyle(hpColorInt(fraction));
    });

    // An item taken from the bag is not in the bag while it is being dragged.
    const bagInHand = this.hudDragItemFrom === null ? this.hudDragItem : null;
    const bag = bagForCategory(this.run.bag, this.hudBagCategory)
      .filter((stack) => stack.itemId !== bagInHand)
      .slice(0, HUD_BAG_ROWS);
    this.hudBagTabs.forEach((tab) => {
      const active = tab.category === this.hudBagCategory;
      tab.bg.setFillStyle(active ? 0x2f2c4d : 0xcfcce2);
      tab.label.setTint(active ? 0xf8fafc : FRLG_INK);
    });
    this.hudBagEmpty.setVisible(bag.length === 0);
    this.hudBagRows.forEach((row, i) => {
      const stack = bag[i];
      const frame = stack ? itemIconFrame(stack.itemId) : null;
      const visible = stack !== undefined && frame !== null;
      row.icon.setVisible(visible);
      row.name.setVisible(visible);
      row.count.setVisible(visible);
      if (!stack || frame === null) {
        row.name.setText('');
        row.count.setText('');
        return;
      }
      row.icon.setFrame(frame);
      row.name.setText(getItem(stack.itemId)?.name ?? stack.itemId);
      row.count.setText(`x${stack.count}`);
    });

    const box = boxRows(this.run);
    const pageCount = boxPageCount(box.length);
    if (this.hudBoxPage >= pageCount) this.hudBoxPage = pageCount - 1;
    this.hudBoxTabs.forEach((tab, i) => {
      const visible = i < pageCount;
      tab.bg.setVisible(visible);
      tab.label.setVisible(visible);
      const active = i === this.hudBoxPage;
      tab.bg.setFillStyle(active ? 0x2f2c4d : 0xcfcce2);
      tab.label.setTint(active ? 0xf8fafc : FRLG_INK);
    });
    this.hudBoxCells.forEach((cell, i) => {
      const index = boxCellIndex(this.hudBoxPage, i % BOX_COLS, Math.floor(i / BOX_COLS));
      const member = box[index];
      const portrait = member ? portraitFor(member.speciesId, member.shiny) : null;
      cell.portrait.setVisible(portrait !== null);
      if (portrait) cell.portrait.setTexture(portrait.key, portrait.frame);
      const heldFrame = member?.heldItem ? itemIconFrame(member.heldItem) : null;
      const inHand = member !== undefined && this.hudDragItemFrom === member.id;
      cell.held.setVisible(heldFrame !== null && !inHand);
      if (heldFrame !== null) cell.held.setFrame(heldFrame);
      cell.highlight.setVisible(this.hudUi.grabbed?.pane === 'box' && this.hudUi.index === index);
    });

    this.refreshDetail();
  }

  /**
   * Redraws the floor minimap from the plan and the run's discovery (`docs/maps-
   * spec.md` §8, D32): the discovered rooms sized from their plan width/height,
   * their openings on the matching walls, the links between two known neighbours
   * and the boss/portal/special markers. Only the drawing happens here; every
   * position and reveal rule comes from the pure `buildMapView`.
   */
  private refreshMapView(): void {
    if (!this.hudMapGraphics) return;
    const graphics = this.hudMapGraphics;
    graphics.clear();
    const plan = this.plan;
    if (!plan) {
      this.hudMapEmpty.setVisible(true);
      return;
    }
    const view = buildMapView(plan, {
      discovered: this.run.discoveredRooms,
      currentRoom: this.run.routeInMap,
      portalOpen: this.portalOpen(),
    });
    this.hudMapEmpty.setVisible(!view.visible);
    if (!view.visible) return;

    const areaX = HUD_MAP_X + HUD_PAD_X;
    const areaY = HUD_MAP_Y + HUD_MAP_HEADER;
    const areaW = HUD_MAP_W - HUD_PAD_X * 2;
    const areaH = HUD_MAP_H - HUD_MAP_HEADER - HUD_PAD_BOTTOM;
    const scale = Math.min(areaW / view.width, areaH / view.height);
    const offsetX = areaX + (areaW - view.width * scale) / 2;
    const offsetY = areaY + (areaH - view.height * scale) / 2;
    const px = (value: number): number => offsetX + value * scale;
    const py = (value: number): number => offsetY + value * scale;

    // Links first, so the room cells paint over the corridor seams.
    graphics.lineStyle(3, 0x8b88a6, 1);
    for (const link of view.links) {
      graphics.lineBetween(px(link.x1), py(link.y1), px(link.x2), py(link.y2));
    }

    for (const room of view.rooms) {
      const rx = px(room.x);
      const ry = py(room.y);
      const rw = room.w * scale;
      const rh = room.h * scale;
      graphics.fillStyle(room.current ? 0xf6d98a : 0xe6e3f2, 1);
      graphics.fillRect(rx, ry, rw, rh);
      graphics.lineStyle(2, room.current ? 0x9a7a1f : 0x3a3956, 1);
      graphics.strokeRect(rx, ry, rw, rh);

      const gap = Math.max(2.5, Math.min(rw, rh) * 0.18);
      for (const opening of room.openings) {
        const ox = px(opening.x);
        const oy = py(opening.y);
        graphics.lineStyle(
          4,
          opening.kind === 'portal' ? 0x3fa9f5 : opening.kind === 'entry' ? 0x4ad15c : 0x2f2c4d,
          1,
        );
        if (opening.edge === 'N' || opening.edge === 'S') {
          graphics.lineBetween(ox - gap, oy, ox + gap, oy);
        } else {
          graphics.lineBetween(ox, oy - gap, ox, oy + gap);
        }
      }

      this.drawMapMarker(graphics, room, rx + rw / 2, ry + rh / 2, Math.min(rw, rh));
    }
  }

  /** One room's minimap icon: a special marker, the boss, and the open portal ring. */
  private drawMapMarker(
    graphics: Phaser.GameObjects.Graphics,
    room: MapViewRoom,
    cx: number,
    cy: number,
    size: number,
  ): void {
    const radius = Math.max(3, size * 0.18);
    if (room.marker === 'shop') {
      graphics.fillStyle(0xf2c14e, 1);
      graphics.fillCircle(cx, cy, radius);
      graphics.lineStyle(2, 0x8a6d1f, 1);
      graphics.strokeCircle(cx, cy, radius);
    } else if (room.marker === 'mini-boss') {
      graphics.fillStyle(0xd9534f, 1);
      graphics.fillTriangle(cx, cy - radius, cx + radius, cy + radius * 0.8, cx - radius, cy + radius * 0.8);
    } else if (room.marker === 'mega-stone') {
      graphics.fillStyle(0x9b6bff, 1);
      graphics.fillTriangle(cx, cy - radius, cx + radius, cy, cx, cy + radius);
      graphics.fillTriangle(cx, cy - radius, cx - radius, cy, cx, cy + radius);
    } else if (room.boss) {
      graphics.fillStyle(0xb0304a, 1);
      graphics.fillCircle(cx, cy, radius);
      graphics.fillStyle(0xf8fafc, 1);
      graphics.fillCircle(cx - radius * 0.4, cy - radius * 0.15, radius * 0.22);
      graphics.fillCircle(cx + radius * 0.4, cy - radius * 0.15, radius * 0.22);
    }
    if (room.portal) {
      graphics.lineStyle(2, 0x3fa9f5, 1);
      graphics.strokeCircle(cx, cy, radius * 1.4);
    }
  }

  /**
   * Fills the detail panel from the run and shows the active tab, or hides it
   * when no member is open (or the member has left the run).
   */
  private refreshDetail(): void {
    if (!this.hudDetail) return;
    const panel = this.panelById('detail');
    const memberId = this.hudDetailState.memberId;
    const detail = memberId === null ? null : memberDetail(this.run, memberId);
    this.hudDetailView = detail;
    if (!detail) {
      this.hudDetailState = CLOSED_DETAIL;
      if (panel) panel.container.setVisible(false);
      return;
    }
    // The panel decides whether it is on screen; the body follows its state.
    this.hudDetail.setVisible(panel?.expanded ?? true);
    if (panel) panel.container.setVisible(true);
    this.hudDetailName.setText(detail.name);
    this.hudDetailLevel.setText(`Lv${detail.level}`);
    this.hudDetailTypes.forEach((chip, i) => {
      const type = detail.types[i];
      chip.bg.setVisible(type !== undefined);
      chip.label.setVisible(type !== undefined);
      if (type === undefined) {
        chip.label.setText('');
        return;
      }
      chip.bg.setFillStyle(typeColor(type));
      chip.label.setText(type.toUpperCase());
    });
    this.hudDetailTabs.forEach((tab) => {
      const active = tab.tab === this.hudDetailState.tab;
      tab.bg.setFillStyle(active ? 0x2f2c4d : 0xcfcce2);
      tab.label.setTint(active ? 0xf8fafc : FRLG_INK);
    });

    const stats = this.hudDetailState.tab === 'stats';
    const { hpBar, hpFill, hpText, rows, nature, ability, held } = this.hudDetailStats;
    hpBar.setVisible(stats);
    hpFill.setVisible(stats);
    hpText.setVisible(stats);
    const fraction = hpFraction(detail.hp, detail.maxHp);
    hpText.setText(`${detail.hp}/${detail.maxHp}`);
    hpFill
      .setSize(
        Math.max(0, FRLG_HPBAR.fill.width * hpBar.scaleX * fraction),
        FRLG_HPBAR.fill.height * hpBar.scaleX,
      )
      .setFillStyle(hpColorInt(fraction));
    rows.forEach((row, i) => {
      row.label.setVisible(stats);
      row.value.setVisible(stats);
      row.value.setText(String(detail.stats[DETAIL_STATS[i]]));
    });
    nature.setText(`NATURE  ${capitalize(detail.nature)}`);
    ability.setText(`ABILITY  ${detail.ability}`);
    held.setText(`HELD  ${detail.heldItemName ?? 'none'}`);
    nature.setVisible(stats);
    ability.setVisible(stats);
    held.setVisible(stats);

    const moves = this.hudDetailState.tab === 'moves';
    this.hudDetailEmpty.setVisible(moves && detail.moves.length === 0);
    this.hudDetailMoves.forEach((row, i) => {
      const move = detail.moves[i];
      const visible = moves && move !== undefined;
      row.highlight.setVisible(visible && this.hudDetailState.grab === i);
      row.name.setVisible(visible);
      row.typeBg.setVisible(visible);
      row.typeLabel.setVisible(visible);
      row.pp.setVisible(visible);
      if (!move) {
        row.name.setText('');
        row.typeLabel.setText('');
        row.pp.setText('');
        return;
      }
      row.name.setText(move.name);
      row.typeBg.setFillStyle(typeColor(move.type));
      row.typeLabel.setText(move.type.toUpperCase());
      row.pp.setText(`PP ${move.pp}/${move.maxPp}`);
    });
  }

  /** Steps the PC BOX to another page and redraws. */
  private stepBoxPage(delta: number): void {
    const pageCount = boxPageCount(this.run.box.length);
    this.hudBoxPage = Math.max(0, Math.min(pageCount - 1, this.hudBoxPage + delta));
    this.refreshHud();
  }

  /** Switches the bag's pocket by `offset` tabs and redraws the list. */
  private stepBagCategory(offset: number): void {
    this.hudBagCategory = cycleBagCategory(this.hudBagCategory, offset);
    this.refreshHud();
  }

  /**
   * HUD pointer input. A click on a party row or a box cell opens that member's
   * detail panel (STATS / MOVES); dragging instead picks the member up (gold
   * highlight), reorders it live over the same pane and a release over the other
   * pane moves it between the party and the PC box. A press on an equipment
   * stack picks the item up (it leaves the bag while in hand) and a release over
   * a member equips it; a press on a member's held badge takes that item in hand
   * instead of the Pokémon, to pass it to another member or drop it on the bag
   * to unequip it. A press inside the open detail panel drives its tabs and the
   * draggable move list; a press anywhere else closes it.
   */
  private handleHudPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.scene.isActive() || !this.hudVisible) return;
    // The collapse icon sits in the frame band, so it is tested before the drag.
    // A press on it waits: a release without movement toggles the panel, a move
    // past the slop drags the panel from the icon (see pointermove).
    const icon = this.hudPanelIconAt(pointer);
    if (icon) {
      this.hudIconPress = { id: icon.id, originX: pointer.x, originY: pointer.y };
      this.input.setDefaultCursor('pointer');
      return;
    }
    // Grabbing a panel's frame moves it (and shoves the others aside); its inner
    // area stays live for rows, tabs and cells.
    const panel = this.hudPanelAt(pointer);
    if (panel) {
      this.startPanelDrag(panel, pointer);
      return;
    }
    if (this.hudDetailState.memberId !== null && this.pointerInDetailPanel(pointer)) {
      this.handleDetailPointerDown(pointer);
      return;
    }
    if (this.selectBagTab(pointer)) return;
    if (this.selectBoxTab(pointer)) return;
    if (!this.hudUi.grabbed) {
      const badge = this.hudHeldBadgeAt(pointer);
      if (badge) {
        this.startHudItemDrag(badge.itemId, pointer, badge.memberId);
        return;
      }
      const itemId = this.hudHeldStackAt(pointer);
      if (itemId !== null) {
        this.startHudItemDrag(itemId, pointer);
        return;
      }
    }
    const target = this.hudTarget(pointer);
    const grabbed = this.hudUi.grabbed;
    if (!target) {
      if (grabbed) this.dropHudGrab();
      else if (this.hudDetailState.memberId !== null) this.closeMemberDetail();
      return;
    }
    if (this.hudDetailState.memberId !== null) this.closeMemberDetail();
    if (grabbed) {
      if (grabbed.pane === target.pane) {
        const next = dragTo(this.run, this.hudUi, target.index);
        this.run = next.run;
        this.hudUi = dropGrabbed(next.ui);
      } else {
        this.dropHudAcross(grabbed, target);
        return;
      }
      this.finishHudGrab();
      return;
    }
    // Defer the grab: a release without movement is a click that opens the detail
    // panel, a move past the slop is a drag that reorders (see pointermove).
    const memberId = this.memberIdAt(target);
    if (memberId === null) return;
    this.hudPress = { pane: target.pane, index: target.index, memberId, originX: pointer.x, originY: pointer.y };
    this.input.setDefaultCursor('pointer');
  }

  /** Shows the grabbed member's avatar in hand, following the pointer. */
  private showHudGhost(pane: PaneId, index: number, pointer: Phaser.Input.Pointer): void {
    const member = pane === 'party' ? this.run.party[index] : this.run.box[index];
    const portrait = member ? portraitFor(member.fighter.speciesId, member.fighter.shiny) : null;
    if (!portrait) {
      this.hudDragGhost.setVisible(false);
      return;
    }
    this.hudDragGhost
      .setTexture(portrait.key, portrait.frame)
      .setPosition(pointer.x, pointer.y)
      .setVisible(true);
  }

  /** Picks an equipment stack up so it can be dropped on a member to equip it. */
  private startHudItemDrag(itemId: string, pointer: Phaser.Input.Pointer, from: string | null = null): void {
    const frame = itemIconFrame(itemId);
    if (frame === null) return;
    this.hudDragItem = itemId;
    this.hudDragItemFrom = from;
    this.hudGrabMoved = false;
    this.hudDragGhost
      .setTexture(ITEM_ICON_TEXTURE_KEY, frame)
      .setPosition(pointer.x, pointer.y)
      .setVisible(true);
    this.input.setDefaultCursor('grabbing');
    this.refreshHud();
  }

  private handleHudPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.scene.isActive()) return;
    if (!this.hudVisible) {
      this.input.setDefaultCursor('default');
      return;
    }
    // A button released off-screen never fired `pointerup`; let go on the next move.
    if (!pointer.isDown) this.cancelHudDrags();
    // A press on a collapse icon becomes a panel drag once it passes the slop.
    if (this.hudIconPress && !this.hudPanelDrag) {
      const press = this.hudIconPress;
      if (Math.hypot(pointer.x - press.originX, pointer.y - press.originY) > HUD_DRAG_SLOP) {
        const panel = this.panelById(press.id);
        this.hudIconPress = null;
        if (panel) this.startPanelDrag(panel, pointer);
      }
    }
    // A panel drag follows the pointer and pushes the others out of the way.
    if (this.hudPanelDrag) {
      this.updatePanelDrag(pointer);
      return;
    }
    if (this.hudDragItem !== null) {
      this.hudDragGhost.setPosition(pointer.x, pointer.y);
      this.input.setDefaultCursor('grabbing');
      return;
    }
    // A held move reorders live as the pointer crosses another row.
    if (this.hudDetailState.grab !== null) {
      const row = this.detailMoveRowAt(pointer);
      if (row !== null) {
        const next = reorderMoves(this.run, this.hudDetailState, row);
        if (next.run !== this.run || next.state !== this.hudDetailState) {
          this.run = next.run;
          this.hudDetailState = next.state;
          this.refreshDetail();
          this.refreshHud();
        }
      }
      this.input.setDefaultCursor('grabbing');
      return;
    }
    // A pending member press turns into a grab once the pointer passes the slop.
    if (this.hudPress && !this.hudUi.grabbed) {
      const press = this.hudPress;
      if (Math.hypot(pointer.x - press.originX, pointer.y - press.originY) <= HUD_DRAG_SLOP) {
        this.input.setDefaultCursor('pointer');
        return;
      }
      const next = grabAt(this.run, this.hudUi, press.pane, press.index);
      this.run = next.run;
      this.hudUi = next.ui;
      this.hudGrabMoved = true;
      this.hudPress = null;
      this.showHudGhost(press.pane, press.index, pointer);
      this.refreshHud();
    }
    if (this.hudUi.grabbed) {
      this.hudDragGhost.setPosition(pointer.x, pointer.y);
      this.input.setDefaultCursor('grabbing');
      const target = this.hudTarget(pointer);
      if (!target || target.pane !== this.hudUi.grabbed.pane) return;
      const next = dragTo(this.run, this.hudUi, target.index);
      if (next.run === this.run && next.ui === this.hudUi) return;
      this.run = next.run;
      this.hudUi = next.ui;
      this.refreshHud();
      return;
    }
    const overMember = this.hudTarget(pointer) !== null;
    const overMove = this.detailMoveRowAt(pointer) !== null;
    const overItem = this.hudHeldStackAt(pointer) !== null;
    const overIcon = this.hudPanelIconAt(pointer) !== null;
    const overPanel = overMember || overMove || overItem ? false : this.hudPanelAt(pointer) !== null;
    this.input.setDefaultCursor(
      overItem || overMove
        ? 'grab'
        : overMember || overIcon
          ? 'pointer'
          : overPanel
            ? 'move'
            : 'default',
    );
  }

  /**
   * Lets go of any drag in progress without acting on the drop: used when the
   * pointer leaves the canvas or its button is released off-screen. A dragged
   * panel keeps the position it reached; a member or an item simply goes back.
   */
  private cancelHudDrags(): void {
    if (this.hudPanelDrag) {
      this.endPanelDrag();
      return;
    }
    if (this.hudIconPress) {
      this.hudIconPress = null;
      this.input.setDefaultCursor('default');
      return;
    }
    if (this.hudDragItem !== null) {
      this.endHudItemDrag();
      return;
    }
    if (this.hudDetailState.grab !== null) {
      this.hudDetailState = dropMove(this.hudDetailState);
      this.persistRun();
      this.refreshDetail();
      return;
    }
    if (this.hudPress) {
      this.hudPress = null;
      this.input.setDefaultCursor('default');
      return;
    }
    if (this.hudUi.grabbed) this.dropHudGrab();
  }

  private handleHudPointerUp(pointer: Phaser.Input.Pointer): void {
    // A press on an icon released without moving is the collapse/expand click.
    if (this.hudIconPress) {
      const press = this.hudIconPress;
      this.hudIconPress = null;
      const panel = this.panelById(press.id);
      if (panel) this.togglePanel(panel);
      return;
    }
    if (this.hudPanelDrag) {
      this.endPanelDrag();
      return;
    }
    if (this.hudDragItem !== null) {
      const itemId = this.hudDragItem;
      const from = this.hudDragItemFrom;
      const target = this.hudTarget(pointer);
      const intoBag = this.pointerInBagPanel(pointer);
      const targetId = target ? this.memberIdAt(target) : null;
      this.endHudItemDrag();
      if (targetId) {
        if (from === null) {
          this.equipHudItem(itemId, target);
        } else if (targetId !== from) {
          this.run = equipHeldItem(unequipHeldItem(this.run, from), targetId, itemId);
          this.persistRun();
          this.refreshHud();
        }
      } else if (from !== null && intoBag) {
        // A badge dropped on the bag takes the item off for good.
        this.run = unequipHeldItem(this.run, from);
        this.persistRun();
        this.refreshHud();
      }
      // A badge dropped anywhere else just goes back on its member (nothing to do).
      return;
    }
    // A released move just drops where it last landed.
    if (this.hudDetailState.grab !== null) {
      this.hudDetailState = dropMove(this.hudDetailState);
      this.persistRun();
      this.refreshDetail();
      return;
    }
    // A member pressed and released without moving is a click: open its detail.
    if (this.hudPress) {
      const memberId = this.hudPress.memberId;
      this.hudPress = null;
      this.openMemberDetail(memberId);
      return;
    }
    const grabbed = this.hudUi.grabbed;
    // A drag dropped over the other pane moves the member across; a drop on one
    // of its members swaps the two instead (so a full party can still take a
    // boxed member); otherwise it just drops where it last pointed. There is no
    // cancel.
    if (!grabbed || !this.hudGrabMoved) return;
    const across = grabbed.pane === 'party' ? this.pointerInBoxPanel(pointer) : this.pointerInPartyPanel(pointer);
    if (across) this.dropHudAcross(grabbed, this.hudTarget(pointer));
    else this.dropHudGrab();
  }

  /** Opens the detail panel on `memberId` (STATS tab) and draws it. */
  private openMemberDetail(memberId: string): void {
    // Opening a member always shows the window, even if it was left collapsed.
    const panel = this.panelById('detail');
    if (panel && !panel.expanded) {
      panel.expanded = true;
      this.hudDetail.setVisible(true);
    }
    this.hudDetailState = openDetail(memberId);
    this.refreshDetail();
    // The first open docks the panel beside the PC box; after that it stays
    // wherever the player dragged it.
    if (!this.hudDetailPlaced) {
      this.hudDetailPlaced = true;
      this.dockDetailPanel();
    }
  }

  /** Closes the detail panel. */
  private closeMemberDetail(): void {
    if (this.hudDetailState.memberId === null) return;
    this.hudDetailState = closeDetail(this.hudDetailState);
    this.refreshDetail();
  }

  /** A press inside the panel: switch tab, or pick a move up to reorder it. */
  private handleDetailPointerDown(pointer: Phaser.Input.Pointer): void {
    const tab = this.detailTabAt(pointer);
    if (tab !== null) {
      this.hudDetailState = setDetailTab(this.hudDetailState, tab);
      this.refreshDetail();
      return;
    }
    if (this.hudDetailState.tab !== 'moves') return;
    const row = this.detailMoveRowAt(pointer);
    if (row === null) return;
    this.hudDetailState = grabMove(this.hudDetailState, row);
    this.hudGrabMoved = false;
    this.refreshDetail();
  }

  /** True when the pointer is over the open detail panel. */
  private pointerInDetailPanel(pointer: Phaser.Input.Pointer): boolean {
    if (this.hudDetailState.memberId === null || !this.panelExpanded('detail')) return false;
    const point = this.panelPoint(pointer, 'detail');
    return (
      point.x >= this.hudDetailX &&
      point.x <= this.hudDetailX + HUD_PANEL_W &&
      point.y >= this.hudDetailY &&
      point.y <= this.hudDetailY + HUD_DETAIL_H
    );
  }

  /** The detail tab under the pointer, or null. */
  private detailTabAt(pointer: Phaser.Input.Pointer): DetailTab | null {
    if (!this.pointerInDetailPanel(pointer)) return null;
    const point = this.panelPoint(pointer, 'detail');
    const tab = this.hudDetailTabs.find(
      (entry) =>
        point.x >= entry.bg.x &&
        point.x <= entry.bg.x + entry.bg.width &&
        point.y >= entry.bg.y &&
        point.y <= entry.bg.y + entry.bg.height,
    );
    return tab?.tab ?? null;
  }

  /** The move row under the pointer in the MOVES tab, or null outside a move. */
  private detailMoveRowAt(pointer: Phaser.Input.Pointer): number | null {
    if (!this.pointerInDetailPanel(pointer) || this.hudDetailState.tab !== 'moves') return null;
    const point = this.panelPoint(pointer, 'detail');
    const rowTop = this.hudDetailY + HUD_DETAIL_CONTENT_TOP;
    const slot = Math.floor((point.y - rowTop) / HUD_DETAIL_ROW);
    const count = this.hudDetailView?.moves.length ?? 0;
    return slot >= 0 && slot < count ? slot : null;
  }

  /** Equips the dragged stack to the member under the drop, saving the swap. */
  private equipHudItem(itemId: string, target: { pane: PaneId; index: number } | null): void {
    if (!target) return;
    const member = target.pane === 'party' ? this.run.party[target.index] : this.run.box[target.index];
    if (!member) return;
    const next = equipHeldItem(this.run, member.fighter.id, itemId);
    if (next === this.run) return;
    this.run = next;
    this.persistRun();
    this.refreshHud();
  }

  /** The id of the member at `target`, or null if that slot is empty. */
  private memberIdAt(target: { pane: PaneId; index: number }): string | null {
    const member = target.pane === 'party' ? this.run.party[target.index] : this.run.box[target.index];
    return member?.fighter.id ?? null;
  }

  /** Puts the dragged stack down and clears the in-hand state. */
  private endHudItemDrag(): void {
    this.hudDragItem = null;
    this.hudDragItemFrom = null;
    this.hudGrabMoved = false;
    this.hudDragGhost.setVisible(false);
    this.input.setDefaultCursor('default');
    this.refreshHud();
  }

  /** Moves the grabbed member to the other pane (deposit / withdraw). */
  private moveHudAcross(from: PaneId): void {
    const input = from === 'party' ? 'right' : 'left';
    const next = partyInput(this.run, this.hudUi, input);
    this.run = next.run;
    this.hudUi = next.ui;
    this.finishHudGrab();
  }

  /**
   * Drops the grabbed member over the other pane. A drop on one of its members
   * swaps the two (so a boxed member can join a full party); a drop on empty
   * space falls back to the plain deposit/withdraw.
   */
  private dropHudAcross(grabbed: { pane: PaneId }, target: { pane: PaneId; index: number } | null): void {
    if (target && target.pane !== grabbed.pane) {
      const next = swapAcross(this.run, this.hudUi, target.index);
      if (next.run !== this.run) {
        this.run = next.run;
        this.hudUi = next.ui;
        this.finishHudGrab();
        return;
      }
    }
    this.moveHudAcross(grabbed.pane);
  }

  /** Drops the grabbed member where it stands, saves it and redraws the HUD. */
  private dropHudGrab(): void {
    this.hudUi = dropGrabbed(this.hudUi);
    this.finishHudGrab();
  }

  private finishHudGrab(): void {
    this.hudGrabMoved = false;
    this.hudDragGhost.setVisible(false);
    this.persistRun();
    this.refreshHud();
  }

  /** The party row or box cell under the pointer, or null. */
  private hudTarget(pointer: Phaser.Input.Pointer): { pane: PaneId; index: number } | null {
    const row = this.hudPartyRowAt(pointer);
    if (row !== null) return { pane: 'party', index: row };
    const cell = this.hudBoxCellAt(pointer);
    if (cell !== null) return { pane: 'box', index: cell };
    return null;
  }

  /** The party index under the pointer, or null outside a filled row. */
  private hudPartyRowAt(pointer: Phaser.Input.Pointer): number | null {
    if (!this.pointerInPartyPanel(pointer)) return null;
    const point = this.panelPoint(pointer, 'party');
    const rowTop = this.hudPartyY + HUD_PARTY_HEADER;
    const slot = Math.floor((point.y - rowTop) / HUD_PARTY_ROW);
    if (point.y < rowTop || slot < 0 || slot >= MAX_PARTY_SIZE) return null;
    return slot < this.run.party.length ? slot : null;
  }

  /** The box index under the pointer, or null outside a filled cell. */
  private hudBoxCellAt(pointer: Phaser.Input.Pointer): number | null {
    const point = this.panelPoint(pointer, 'box');
    const gridW = BOX_COLS * HUD_BOX_CELL + (BOX_COLS - 1) * HUD_BOX_CELL_GAP;
    const gridLeft = this.hudBoxX + HUD_BOX_PAD + (HUD_PANEL_W - HUD_BOX_PAD * 2 - gridW) / 2;
    const stride = HUD_BOX_CELL + HUD_BOX_CELL_GAP;
    const col = Math.floor((point.x - gridLeft) / stride);
    const row = Math.floor((point.y - (this.hudBoxY + HUD_BOX_TABS_H)) / stride);
    if (col < 0 || col >= BOX_COLS || row < 0 || row >= BOX_ROWS) return null;
    const index = boxCellIndex(this.hudBoxPage, col, row);
    return index < this.run.box.length ? index : null;
  }

  private pointerInPartyPanel(pointer: Phaser.Input.Pointer): boolean {
    if (!this.panelExpanded('party')) return false;
    const point = this.panelPoint(pointer, 'party');
    return (
      point.x >= this.hudX &&
      point.x <= this.hudX + HUD_PANEL_W &&
      point.y >= this.hudPartyY &&
      point.y <= this.hudPartyY + this.hudPartyH
    );
  }

  private pointerInBoxPanel(pointer: Phaser.Input.Pointer): boolean {
    if (!this.panelExpanded('box')) return false;
    const point = this.panelPoint(pointer, 'box');
    return (
      point.x >= this.hudBoxX &&
      point.x <= this.hudBoxX + HUD_PANEL_W &&
      point.y >= this.hudBoxY &&
      point.y <= this.hudBoxY + this.hudBoxH
    );
  }

  /** The bag stack under the pointer in the active pocket, or null. */
  private hudBagStackAt(pointer: Phaser.Input.Pointer): string | null {
    if (!this.pointerInBagPanel(pointer)) return null;
    const point = this.panelPoint(pointer, 'bag');
    const bag = bagForCategory(this.run.bag, this.hudBagCategory);
    const rowTop = this.hudBagY + HUD_BAG_HEADER;
    const slot = Math.floor((point.y - rowTop) / HUD_BAG_ROW);
    if (point.y < rowTop || slot < 0 || slot >= HUD_BAG_ROWS) return null;
    return bag[slot]?.itemId ?? null;
  }

  /** The equippable (held) bag stack under the pointer, or null. */
  private hudHeldStackAt(pointer: Phaser.Input.Pointer): string | null {
    const itemId = this.hudBagStackAt(pointer);
    return itemId !== null && getItem(itemId)?.kind === 'held' ? itemId : null;
  }

  /**
   * The held-item badge under the pointer, if any. Grabbing a badge picks the
   * item up instead of the Pokémon, so it can be moved to another member or
   * dropped on the bag to unequip it.
   */
  private hudHeldBadgeAt(pointer: Phaser.Input.Pointer): { itemId: string; memberId: string } | null {
    const target = this.hudTarget(pointer);
    if (!target) return null;
    const member = target.pane === 'party' ? this.run.party[target.index] : this.run.box[target.index];
    const itemId = member?.fighter.heldItem;
    if (!member || !itemId) return null;
    const badge =
      target.pane === 'party'
        ? this.hudRows[target.index]?.held
        : this.hudBoxCells[target.index - this.hudBoxPage * BOX_PAGE_SIZE]?.held;
    if (!badge || !badge.visible) return null;
    const point = this.panelPoint(pointer, target.pane);
    const radius = Math.max(badge.displayWidth, badge.displayHeight) / 2;
    if (Math.hypot(point.x - badge.x, point.y - badge.y) > radius) return null;
    return { itemId, memberId: member.fighter.id };
  }

  private pointerInBagPanel(pointer: Phaser.Input.Pointer): boolean {
    if (!this.panelExpanded('bag')) return false;
    const point = this.panelPoint(pointer, 'bag');
    return (
      point.x >= this.hudX &&
      point.x <= this.hudX + HUD_PANEL_W &&
      point.y >= this.hudBagY &&
      point.y <= this.hudBagY + this.hudBagH
    );
  }

  /** A press on a bag pocket tab selects it; true when it handled the press. */
  private selectBagTab(pointer: Phaser.Input.Pointer): boolean {
    if (!this.panelExpanded('bag')) return false;
    const point = this.panelPoint(pointer, 'bag');
    const tab = this.hudBagTabs.find(
      (entry) =>
        point.x >= entry.bg.x &&
        point.x <= entry.bg.x + entry.bg.width &&
        point.y >= entry.bg.y &&
        point.y <= entry.bg.y + entry.bg.height,
    );
    if (!tab) return false;
    this.hudBagCategory = tab.category;
    this.refreshHud();
    return true;
  }

  /** A press on a PC box page tab selects it; true when it handled the press. */
  private selectBoxTab(pointer: Phaser.Input.Pointer): boolean {
    if (!this.panelExpanded('box')) return false;
    const point = this.panelPoint(pointer, 'box');
    const tab = this.hudBoxTabs.find(
      (entry) =>
        entry.bg.visible &&
        point.x >= entry.bg.x &&
        point.x <= entry.bg.x + entry.bg.width &&
        point.y >= entry.bg.y &&
        point.y <= entry.bg.y + entry.bg.height,
    );
    if (!tab) return false;
    this.hudBoxPage = tab.page;
    this.refreshHud();
    return true;
  }

  /** The panel whose frame band is under the pointer; the topmost one wins. */
  private hudPanelAt(pointer: Phaser.Input.Pointer): HudPanel | null {
    for (let i = this.hudPanels.length - 1; i >= 0; i--) {
      const panel = this.hudPanels[i];
      if (!panel.container.visible) continue;
      if (this.onPanelBorder(panel, pointer)) return panel;
    }
    return null;
  }

  /**
   * True when `pointer` is on a panel's frame: inside the window (plus a small
   * pad, so the seam between two panels is grabbable) but outside its inner,
   * interactive area. The header has nothing interactive, so all of it grabs.
   */
  private onPanelBorder(panel: HudPanel, pointer: Phaser.Input.Pointer): boolean {
    const rect = this.panelRect(panel);
    const pad = HUD_PANEL_GRAB_PAD;
    const inside =
      pointer.x >= rect.x - pad &&
      pointer.x <= rect.x + rect.w + pad &&
      pointer.y >= rect.y - pad &&
      pointer.y <= rect.y + rect.h + pad;
    if (!inside) return false;
    if (panel.id === 'header') return true;
    const inset = HUD_PANEL_BORDER;
    const inner =
      pointer.x >= rect.x + inset &&
      pointer.x <= rect.x + rect.w - inset &&
      pointer.y >= rect.y + inset &&
      pointer.y <= rect.y + rect.h - inset;
    return !inner;
  }

  /** The panel with `id`, or undefined before the HUD is built. */
  private panelById(id: HudPanelId): HudPanel | undefined {
    return this.hudPanels.find((panel) => panel.id === id);
  }

  /** Whether a panel is expanded (content shown); a missing panel reads expanded. */
  private panelExpanded(id: HudPanelId): boolean {
    return this.panelById(id)?.expanded ?? true;
  }

  /** A panel's layout rect before the drag offset: the window, or its icon. */
  private panelBase(panel: HudPanel): { x: number; y: number; w: number; h: number } {
    if (!panel.expanded) {
      return { x: panel.x + HUD_ICON_INSET, y: panel.y + HUD_ICON_INSET, w: HUD_ICON, h: HUD_ICON };
    }
    return { x: panel.x, y: panel.y, w: panel.w, h: panel.h };
  }

  /** A panel's current on-screen rect: its layout rect plus the drag offset. */
  private panelRect(panel: HudPanel): { x: number; y: number; w: number; h: number } {
    const base = this.panelBase(panel);
    return { x: base.x + panel.dx, y: base.y + panel.dy, w: base.w, h: base.h };
  }

  /** The collapse-icon button's current on-screen rect. */
  private panelIconRect(panel: HudPanel): { x: number; y: number; w: number; h: number } {
    return {
      x: panel.x + HUD_ICON_INSET + panel.dx,
      y: panel.y + HUD_ICON_INSET + panel.dy,
      w: HUD_ICON,
      h: HUD_ICON,
    };
  }

  /** The panel whose collapse icon is under the pointer; the topmost one wins. */
  private hudPanelIconAt(pointer: Phaser.Input.Pointer): HudPanel | null {
    for (let i = this.hudPanels.length - 1; i >= 0; i--) {
      const panel = this.hudPanels[i];
      if (!panel.container.visible) continue;
      const rect = this.panelIconRect(panel);
      if (
        pointer.x >= rect.x &&
        pointer.x <= rect.x + rect.w &&
        pointer.y >= rect.y &&
        pointer.y <= rect.y + rect.h
      ) {
        return panel;
      }
    }
    return null;
  }

  /**
   * Collapses a panel to its icon or expands it again. Expanding always opens and
   * shoves the others (a collapsed icon included) out of the way; if the pinned
   * push cannot clear them, the panel gives way too, so the two never overlap.
   */
  private togglePanel(panel: HudPanel): void {
    if (panel.expanded) {
      panel.expanded = false;
      panel.body.setVisible(false);
      this.applyPanelPositions();
      this.persistHudLayout();
      return;
    }
    panel.expanded = true;
    panel.body.setVisible(true);
    this.clampPanel(panel);
    if (this.resolvePanelCollisions(panel.id)) {
      this.resolvePanelCollisions(null);
    }
    this.applyPanelPositions();
    this.persistHudLayout();
  }

  /** The pointer in a panel's own (layout) coordinates, undoing its drag offset. */
  private panelPoint(pointer: Phaser.Input.Pointer, id: HudPanelId): { x: number; y: number } {
    const panel = this.hudPanels.find((entry) => entry.id === id);
    if (!panel) return { x: pointer.x, y: pointer.y };
    return { x: pointer.x - panel.dx, y: pointer.y - panel.dy };
  }

  /** Starts dragging `panel` from the pointer, keeping it on top of the rest. */
  private startPanelDrag(panel: HudPanel, pointer: Phaser.Input.Pointer): void {
    this.hudPanelDrag = {
      id: panel.id,
      pointerStart: { x: pointer.x, y: pointer.y },
      offsetStart: { x: panel.dx, y: panel.dy },
    };
    this.hudRoot.bringToTop(panel.container);
    // The member/item ghost must still ride above every panel.
    this.hudRoot.bringToTop(this.hudDragGhost);
    this.input.setDefaultCursor('grabbing');
  }

  /** Moves the dragged panel toward the pointer, in steps, and settles the rest. */
  private updatePanelDrag(pointer: Phaser.Input.Pointer): void {
    const drag = this.hudPanelDrag;
    if (!drag) return;
    const panel = this.hudPanels.find((entry) => entry.id === drag.id);
    if (!panel) return;
    const targetX = drag.offsetStart.x + (pointer.x - drag.pointerStart.x);
    const targetY = drag.offsetStart.y + (pointer.y - drag.pointerStart.y);
    this.movePanelTowards(panel, targetX, targetY);
    this.applyPanelPositions();
  }

  /**
   * Walks the dragged panel toward (`targetX`, `targetY`) in small steps, pushing
   * the others aside at each one. A step that cannot settle (the chain of pushes
   * hit the screen edge) is rolled back, so the panel simply stops rather than
   * overlapping: the panels are never allowed to cover each other.
   */
  private movePanelTowards(panel: HudPanel, targetX: number, targetY: number): void {
    const steps = HUD_PANEL_MAX_SUBSTEPS;
    for (let i = 0; i < steps; i++) {
      const dx = targetX - panel.dx;
      const dy = targetY - panel.dy;
      const distance = Math.hypot(dx, dy);
      if (distance <= HUD_PANEL_STEP) {
        if (this.tryPanelStep(panel, targetX, targetY)) return;
        return;
      }
      const nextX = panel.dx + (dx / distance) * HUD_PANEL_STEP;
      const nextY = panel.dy + (dy / distance) * HUD_PANEL_STEP;
      if (!this.tryPanelStep(panel, nextX, nextY)) return;
    }
  }

  /**
   * Tries one drag step: moves `panel` to the position, pushes the others clear
   * and, if any overlap could not be resolved, restores every offset and reports
   * false so the caller stops the drag there.
   */
  private tryPanelStep(panel: HudPanel, x: number, y: number): boolean {
    const snapshot = this.hudPanels.map((entry) => ({ id: entry.id, dx: entry.dx, dy: entry.dy }));
    panel.dx = x;
    panel.dy = y;
    this.clampPanel(panel);
    const blocked = this.resolvePanelCollisions(panel.id);
    if (!blocked) return true;
    for (const saved of snapshot) {
      const entry = this.hudPanels.find((candidate) => candidate.id === saved.id);
      if (entry) {
        entry.dx = saved.dx;
        entry.dy = saved.dy;
      }
    }
    return false;
  }

  private endPanelDrag(): void {
    this.hudPanelDrag = null;
    this.input.setDefaultCursor('default');
    this.persistHudLayout();
  }

  /** Pushes every panel's drag offset onto its container. */
  private applyPanelPositions(): void {
    for (const panel of this.hudPanels) panel.container.setPosition(panel.dx, panel.dy);
  }

  /** Keeps a panel fully on screen. */
  private clampPanel(panel: HudPanel): void {
    const base = this.panelBase(panel);
    const maxX = Math.max(HUD_PANEL_MARGIN, this.scale.width - base.w - HUD_PANEL_MARGIN);
    const maxY = Math.max(HUD_PANEL_MARGIN, this.scale.height - base.h - HUD_PANEL_MARGIN);
    panel.dx = Math.max(HUD_PANEL_MARGIN - base.x, Math.min(maxX - base.x, panel.dx));
    panel.dy = Math.max(HUD_PANEL_MARGIN - base.y, Math.min(maxY - base.y, panel.dy));
  }

  /** Saves the current panel offsets and collapsed flags as a global preference. */
  private persistHudLayout(): void {
    if (this.hudPanels.length === 0) return;
    const hudLayout = { ...this.settings.hudLayout };
    for (const panel of this.hudPanels) {
      hudLayout[panel.id] = { dx: panel.dx, dy: panel.dy, collapsed: !panel.expanded };
    }
    this.settings = { ...this.settings, hudLayout };
    saveSettings(this.settings);
  }

  /** Applies the saved HUD layout to freshly built panels (D22 keeps settings). */
  private applyStoredHudLayout(): void {
    const layout = this.settings.hudLayout;
    for (const panel of this.hudPanels) {
      const stored = layout[panel.id];
      if (!stored) continue;
      panel.dx = stored.dx;
      panel.dy = stored.dy;
      panel.expanded = !stored.collapsed;
      panel.body.setVisible(panel.expanded);
    }
    // A resize can leave a stored layout overlapping; settle it back apart. No
    // panel is pinned, so the solver just spreads them.
    for (const panel of this.hudPanels) this.clampPanel(panel);
    this.resolvePanelCollisions(null);
    this.applyPanelPositions();
    this.hudDetailPlaced =
      this.settings.hudLayout.detail.dx !== 0 || this.settings.hudLayout.detail.dy !== 0;
  }

  /**
   * Pushes the visible panels out of each other, so they never overlap. The
   * dragged panel (`pinnedId`) holds its place and shoves the rest; a pushed
   * panel can in turn shove the next one. Returns true when some overlap could
   * not be resolved (a panel was pressed against the screen edge).
   */
  private resolvePanelCollisions(pinnedId: HudPanelId | null): boolean {
    const panels = this.hudPanels;
    for (let pass = 0; pass < HUD_PANEL_PUSH_PASSES; pass++) {
      let changed = false;
      for (let i = 0; i < panels.length; i++) {
        if (!panels[i].container.visible) continue;
        for (let j = i + 1; j < panels.length; j++) {
          if (!panels[j].container.visible) continue;
          if (!this.panelsOverlap(panels[i], panels[j])) continue;
          if (this.separatePair(panels[i], panels[j], pinnedId)) changed = true;
        }
      }
      if (!changed) break;
    }
    for (let i = 0; i < panels.length; i++) {
      if (!panels[i].container.visible) continue;
      for (let j = i + 1; j < panels.length; j++) {
        if (!panels[j].container.visible) continue;
        if (this.panelsOverlap(panels[i], panels[j])) return true;
      }
    }
    return false;
  }

  /**
   * Separates one overlapping pair. The pinned panel never moves while it can
   * push the other; when it cannot (the other is clamped) it is left to the
   * caller to roll the step back. With neither pinned, the first that can move
   * takes the push.
   */
  private separatePair(a: HudPanel, b: HudPanel, pinnedId: HudPanelId | null): boolean {
    const push = this.pushVector(a, b);
    if (push.x === 0 && push.y === 0) return false;
    if (a.id === pinnedId) return this.applyPanelPush(b, push);
    if (b.id === pinnedId) return this.applyPanelPush(a, { x: -push.x, y: -push.y });
    if (this.applyPanelPush(b, push)) return true;
    return this.applyPanelPush(a, { x: -push.x, y: -push.y });
  }

  /** Applies `push` to a panel and reports whether it fit without clamping. */
  private applyPanelPush(panel: HudPanel, push: { x: number; y: number }): boolean {
    const beforeX = panel.dx;
    const beforeY = panel.dy;
    panel.dx += push.x;
    panel.dy += push.y;
    this.clampPanel(panel);
    return (
      Math.abs(panel.dx - beforeX - push.x) < 0.01 &&
      Math.abs(panel.dy - beforeY - push.y) < 0.01
    );
  }

  /** The minimum translation that moves `to` clear of `from`, along one axis. */
  private pushVector(from: HudPanel, to: HudPanel): { x: number; y: number } {
    const a = this.panelRect(from);
    const b = this.panelRect(to);
    const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (overlapX <= 0 || overlapY <= 0) return { x: 0, y: 0 };
    if (overlapX < overlapY) {
      const dir = b.x + b.w / 2 >= a.x + a.w / 2 ? 1 : -1;
      return { x: dir * overlapX, y: 0 };
    }
    const dir = b.y + b.h / 2 >= a.y + a.h / 2 ? 1 : -1;
    return { x: 0, y: dir * overlapY };
  }

  private panelsOverlap(a: HudPanel, b: HudPanel): boolean {
    const ra = this.panelRect(a);
    const rb = this.panelRect(b);
    return ra.x < rb.x + rb.w && rb.x < ra.x + ra.w && ra.y < rb.y + rb.h && rb.y < ra.y + ra.h;
  }

  /** Places the detail panel just left of the PC box the first time it opens. */
  private dockDetailPanel(): void {
    const detail = this.panelById('detail');
    const box = this.panelById('box');
    if (!detail || !box) return;
    const snapshot = this.hudPanels.map((entry) => ({ id: entry.id, dx: entry.dx, dy: entry.dy }));
    const boxRect = this.panelRect(box);
    detail.dx = boxRect.x - HUD_GAP - HUD_PANEL_W - detail.x;
    detail.dy = boxRect.y - detail.y;
    this.clampPanel(detail);
    // If the box was moved into the way, nudge it (and the rest) clear of the
    // detail; if there is no room at all, keep the detail at its layout spot.
    if (this.resolvePanelCollisions('detail')) {
      for (const saved of snapshot) {
        const entry = this.panelById(saved.id);
        if (entry) {
          entry.dx = saved.dx;
          entry.dy = saved.dy;
        }
      }
    }
    this.applyPanelPositions();
    this.persistHudLayout();
  }

  /** Two cameras: one follows the world, one pins the HUD overlay to the screen. */
  private setupHudCamera(): void {
    const hud = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    hud.setScroll(0, 0);
    const keep = new Set<Phaser.GameObjects.GameObject>([this.hudRoot]);
    hud.ignore(this.children.list.filter((child) => !keep.has(child)));
    this.cameras.main.ignore([this.hudRoot]);
    this.hudCamera = hud;
  }

  /**
   * The hold-to-reset overlay: a full-screen scrim that fades the whole screen
   * out and a small ring that fills. Screen-space, built after the HUD camera
   * exists, so the world camera ignores it and only the pinned camera draws it.
   */
  private buildResetOverlay(): void {
    const { width, height } = this.scale;
    this.resetScrim = this.add
      .rectangle(0, 0, width, height, 0x05070c, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(400);
    this.resetRing = this.add.graphics().setScrollFactor(0).setDepth(401);
    this.cameras.main.ignore([this.resetScrim, this.resetRing]);
  }

  /** Advances the hold-to-reset progress while the key is down, or fades back in. */
  private updateReset(delta: number): void {
    const allowed =
      !this.gameOver &&
      !this.pendingBattle &&
      !this.releaseRoot &&
      !this.hudVisible &&
      !this.pauseMenuOpen &&
      this.resetKey?.isDown === true;
    if (!allowed) {
      if (this.resetHold !== 0) {
        this.resetHold = 0;
        this.fadeResetOverlayIn();
      }
      return;
    }
    this.resetHold = Math.min(RESET_HOLD_MS, this.resetHold + delta);
    const progress = this.resetHold / RESET_HOLD_MS;
    this.drawResetOverlay(progress);
    if (progress >= 1) this.restartRun();
  }

  /** Paints the screen fade-out and the small pie that fills as the hold advances. */
  private drawResetOverlay(progress: number): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    this.tweens.killTweensOf(this.resetScrim);
    this.tweens.killTweensOf(this.resetRing);
    this.resetScrim.setAlpha(progress).setVisible(true);
    this.resetRing.clear();
    this.resetRing.fillStyle(0x10161f, 0.5).fillCircle(cx, cy, RESET_RADIUS);
    this.resetRing.fillStyle(0xf2c14e, 0.9);
    this.resetRing.slice(
      cx,
      cy,
      RESET_RADIUS,
      Phaser.Math.DegToRad(-90),
      Phaser.Math.DegToRad(-90 + progress * 360),
      false,
    );
    this.resetRing.fillPath();
    this.resetRing.lineStyle(2, 0xffffff, 0.5).strokeCircle(cx, cy, RESET_RADIUS);
    this.resetRing.setAlpha(1);
  }

  /** Releasing the key fades the dark scrim and the ring back out. */
  private fadeResetOverlayIn(): void {
    this.tweens.killTweensOf([this.resetScrim, this.resetRing]);
    this.tweens.add({
      targets: [this.resetScrim, this.resetRing],
      alpha: 0,
      duration: RESET_FADE_IN_MS,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.resetRing.clear();
        this.resetScrim.setAlpha(0);
      },
    });
  }

  private hideResetOverlay(): void {
    this.tweens.killTweensOf([this.resetScrim, this.resetRing]);
    this.resetRing.clear();
    this.resetScrim.setAlpha(0);
  }

  /** Starts a brand-new run with a fresh seed (nothing carries over). */
  private restartRun(): void {
    this.resetHold = 0;
    this.hideResetOverlay();
    clearRun(browserStorage());
    this.scene.start('Starter', { seed: randomSeed() });
  }

  /**
   * A tile's display scale so every atlas lands on the same `TILE_SIZE` world
   * cell: the biome sheet's own cell (`D18`) or the 24px common sheet.
   */
  private tileScale(source: 'atlas' | 'common'): number {
    if (source === 'common') return TILE_SIZE / COMMON_TILE_SIZE;
    return TILE_SIZE / TILESETS[this.tilesetId].config.atlas.tileSize;
  }

  private tileImage(x: number, y: number, frame: TileFrame): Phaser.GameObjects.Image {
    const key = frame.source === 'common' ? COMMON_TEXTURE_KEY : tilesetTextureKey(this.tilesetId);
    return this.add
      .image(x * TILE_SIZE, y * TILE_SIZE, key, frame.frame)
      .setOrigin(0, 0)
      .setScale(this.tileScale(frame.source));
  }

  /**
   * The frames a cell draws: the floor under everything, then the tile itself
   * when it differs. The FRLG tree keeps a transparent ground, so the floor
   * (with its wall-edge variant) shows through instead of a baked flat colour.
   */
  private tileFrames(x: number, y: number): TileFrame[] {
    const config = TILESETS[this.tilesetId].config;
    const ground = resolveGroundFrame(this.renderTiles, x, y, config);
    const frames: TileFrame[] = [ground];
    // A tree tip a grass patch shares draws the grass frame under its crown; the
    // tilesets that fall back to the procedural tuft draw it in `drawEntities`.
    const grassFrame = config.frames[TALL_GRASS];
    if (grassFrame !== undefined && grassFrame !== config.frames[FLOOR] && this.grassTipKeys.has(`${x},${y}`)) {
      frames.push({ source: 'atlas', frame: grassFrame });
    }
    const frame = resolveTileFrame(this.renderTiles, x, y, config, true);
    if (frame && (frame.source !== ground.source || frame.frame !== ground.frame)) frames.push(frame);
    return frames;
  }

  /**
   * The map movement runs on. A wall cell that draws as a tree's **pure top row**
   * (its walkable tip, `treeTipKeys`) is turned into floor, so the player walks
   * under the crown while the tile still renders as the wall motif, drawn over the
   * player (`TREE_TIP_DEPTH`).
   */
  private movementMap(map: TileMap): TileMap {
    const config = TILESETS[this.tilesetId].config;
    const tips = treeTipKeys(map, config);
    this.grassTipKeys = grassTipKeys(map, config);
    if (tips.size === 0) return map;
    const copy = map.map((row) => row.slice());
    for (const key of tips) {
      const [x, y] = key.split(',').map(Number);
      copy[y][x] = FLOOR;
    }
    return copy;
  }

  private drawTiles(): void {
    const tips = treeTipKeys(this.renderTiles, TILESETS[this.tilesetId].config);
    const created: Phaser.GameObjects.GameObject[] = [];
    for (let y = 0; y < this.renderTiles.length; y++) {
      const row: Phaser.GameObjects.Image[][] = [];
      for (let x = 0; x < this.renderTiles[y].length; x++) {
        const tip = tips.has(`${x},${y}`);
        row.push(
          this.tileFrames(x, y).map((frame, index, all) => {
            const image = this.tileImage(x, y, frame);
            // Only the wall motif of a walkable tip goes over the player; its
            // ground - and a shared grass frame - stay under, so the player still
            // shows standing on the tile and walking through the grass.
            if (tip && index === all.length - 1) image.setDepth(TREE_TIP_DEPTH);
            created.push(image);
            return image;
          }),
        );
      }
      this.tileSprites.push(row);
    }
    // At create time the HUD camera does not exist yet and ignores everything
    // afterwards; on a rebuild it must ignore only the freshly drawn cells.
    this.hudCamera?.ignore(created);
  }

  private drawEntities(): void {
    const created: Phaser.GameObjects.GameObject[] = [];
    // The FRLG fields draw tall grass as a real ground tile, so the procedural
    // tuft overlay is only for tilesets that still fall back to plain ground.
    const config = TILESETS[this.tilesetId].config;
    const overlayGrass = config.frames[TALL_GRASS] === config.frames[FLOOR];
    if (!overlayGrass) return;
    for (let y = 0; y < this.renderTiles.length; y++) {
      for (let x = 0; x < this.renderTiles[y].length; x++) {
        // A tree tip a grass patch shares gets the tuft too, under its crown.
        if (this.renderTiles[y][x] !== TALL_GRASS && !this.grassTipKeys.has(`${x},${y}`)) continue;
        const image = this.add.image(this.centerX(x), this.centerY(y), GRASS_TEXTURE_KEY).setDepth(1);
        this.entitySprites.push(image);
        created.push(image);
      }
    }
    this.hudCamera?.ignore(created);
  }

  /**
   * Draws the ground items on the route's pockets. A visible item is the FRLG
   * Poke Ball, like the originals; a hidden one is a faint sparkle that only
   * gives itself away up close. Items already taken stay hidden. Only the live
   * route has items, so a dev generator phase draws none.
   */
  private drawItems(): void {
    if (this.generatorStepIndex !== null) return;
    const created: Phaser.GameObjects.GameObject[] = [];
    for (const item of this.route.items) {
      const taken = isItemPicked(this.run, item.id);
      const sprite = item.hidden
        ? this.add
            .image(this.centerX(item.position.x), this.centerY(item.position.y), SPARKLE_TEXTURE_KEY)
            .setScale(1.1)
            .setAlpha(taken ? 0 : 0.55)
            .setTint(0xfff3b0)
            .setDepth(5)
        : this.add
            .image(this.centerX(item.position.x), this.centerY(item.position.y), GROUND_ITEM_TEXTURE_KEY)
            .setScale(1.5)
            .setVisible(!taken)
            .setDepth(5);
      if (item.hidden && !taken) {
        // A slow, shallow shimmer so it reads as a glint, not a beacon.
        this.tweens.add({
          targets: sprite,
          alpha: { from: 0.3, to: 0.7 },
          duration: 900,
          yoyo: true,
          repeat: -1,
        });
      }
      this.itemSprites.push({ item, sprite });
      this.entitySprites.push(sprite);
      created.push(sprite);
    }
    this.hudCamera?.ignore(created);
  }

  /**
   * Draws the route's trainers on their tiles, off the FRLG overworld atlas when
   * the archetype has a decomp sprite and the procedural stand-in otherwise. A
   * defeated trainer is gone for the route, so it is not drawn. The facing picks
   * the resting pose (down, up or the left-facing side, flipped for east), and a
   * spinning trainer's pose is refreshed on its timer in `update`.
   */
  private drawTrainers(): void {
    if (this.generatorStepIndex !== null) return;
    const created: Phaser.GameObjects.GameObject[] = [];
    for (const trainer of this.route.trainers) {
      if (isTrainerDefeated(this.run, trainer.id)) continue;
      const archetype = getTrainerArchetype(trainer.archetypeId);
      const spriteKey = archetype?.spriteKey ?? null;
      const frame = spriteKey ? overworldSpriteFrame(spriteKey) : null;
      const footY = this.centerY(trainer.position.y) + TILE_SIZE / 2;
      const sprite =
        frame !== null
          ? this.add
              .sprite(this.centerX(trainer.position.x), footY, OVERWORLD_SPRITE_TEXTURE_KEY, frame)
              .setOrigin(0.5, 1)
              .setScale(TILE_SIZE / OVERWORLD_SPRITE_WIDTH)
              .setDepth(actorDepth(footY))
          : this.add
              .sprite(this.centerX(trainer.position.x), this.centerY(trainer.position.y), TRAINER_TEXTURE_KEY)
              .setTint(archetype?.colour ?? 0xffffff)
              .setDepth(actorDepth(footY));
      const entry: TrainerSpriteEntry = {
        trainer,
        sprite,
        spriteKey: frame !== null ? spriteKey : null,
      };
      this.faceTrainerSprite(entry, trainer.facing);
      this.trainerFacing.set(trainer.id, trainer.facing);
      this.trainerSprites.push(entry);
      this.entitySprites.push(sprite);
      created.push(sprite);
    }
    this.hudCamera?.ignore(created);
  }

  /** Poses a resting trainer: the facing's idle frame, flipped for the right side. */
  private faceTrainerSprite(entry: TrainerSpriteEntry, facing: Facing): void {
    const pose = trainerFacingPose(facing);
    entry.sprite.setFlipX(pose.flipX);
    entry.sprite.anims.stop();
    if (!entry.spriteKey) return;
    const frame = overworldSpriteFrame(entry.spriteKey, pose.facing);
    if (frame !== null) entry.sprite.setFrame(frame);
  }

  /** Plays a walking trainer's cycle for a step direction, keeping its flip. */
  private playTrainerWalk(entry: TrainerSpriteEntry, facing: Facing): void {
    const pose = trainerFacingPose(facing);
    entry.sprite.setFlipX(pose.flipX);
    if (!entry.spriteKey) return;
    const key = trainerWalkAnimKey(entry.spriteKey, pose.facing);
    if (this.anims.exists(key)) entry.sprite.play(key, true);
  }

  /** A route tile's centre in world pixels. */
  private centerX(tileX: number): number {
    return tileX * TILE_SIZE + TILE_SIZE / 2;
  }

  private centerY(tileY: number): number {
    return tileY * TILE_SIZE + TILE_SIZE / 2;
  }

  private applyTileset(id: TilesetId): void {
    this.tilesetId = id;
    // A tileset can add or drop the shared grass frame on a tree tip (its wall
    // pattern decides the tips), so the cell frame count changes: rebuild the
    // tiles and overlays instead of retexturing the old sprites in place.
    this.stopWalking();
    this.clearRouteSprites();
    this.moveMap = this.movementMap(this.map);
    this.drawTiles();
    this.drawEntities();
    this.drawItems();
    this.drawTrainers();
  }

  /** Snaps the sprite to a tile, without a step. */
  private movePlayerTo(x: number, y: number): void {
    this.player = { x, y };
    // The 16x32 FRLG frame stands with its feet on the tile's bottom edge, the
    // same placement the route's trainers use.
    this.playerSprite.setPosition(this.centerX(x), this.centerY(y) + TILE_SIZE / 2);
    this.playerSprite.setDepth(actorDepth(this.playerSprite.y));
  }

  /** Turns the sprite to face a direction, flipping the left-facing side frame. */
  private face(direction: MoveKey): void {
    this.facingDir = direction;
    this.facing = direction === 'up' ? 'up' : direction === 'down' ? 'down' : 'side';
    this.playerSprite.setFlipX(direction === 'right');
  }

  /** Pushes into a blocked tile: turn to face it and stand. */
  private faceIdle(direction: MoveKey): void {
    this.face(direction);
    this.settleMovement();
  }

  /** Plays the direction's walk cycle while a step is in flight. */
  private walkStep(direction: MoveKey, to: Tile): void {
    this.face(direction);
    const running = this.settings.alwaysRun || (this.runKey?.isDown ?? false);
    this.playerSprite.anims.timeScale = playerWalkTimeScale(running, WALK_STEP_MS, RUN_STEP_MS);
    this.playerSprite.play(playerWalkAnimKey(this.facing), true);
    this.walkTween = this.tweens.add({
      targets: this.playerSprite,
      x: this.centerX(to.x),
      y: this.centerY(to.y) + TILE_SIZE / 2,
      duration: running ? RUN_STEP_MS : WALK_STEP_MS,
      ease: 'Linear',
      onComplete: () => {
        this.walkTween = null;
        this.player = { x: to.x, y: to.y };
        this.onTileEntered();
      },
    });
  }

  /**
   * Stands still and shows the resting frame of the current facing. Runs even
   * while the walk cycle is idle, so pushing into a blocked tile still turns the
   * sprite toward it instead of leaving the previous pose.
   */
  private settleMovement(): void {
    if (this.walkTween) return;
    if (this.playerSprite.anims.isPlaying) this.playerSprite.anims.stop();
    this.playerSprite.setFrame(playerSpriteFrame(this.facing));
  }

  private onTileEntered(): void {
    // A door on the border changes room (or steps through the open portal).
    if (this.tryLeaveRoom()) return;
    const grassy =
      tileAt(this.map, this.player) === TALL_GRASS ||
      this.grassTipKeys.has(`${this.player.x},${this.player.y}`);
    if (grassy) {
      const encounter = this.encounters.step();
      if (encounter) {
        this.startBattle({
          kind: 'wild',
          speciesId: encounter.speciesId,
          level: encounter.level,
          shiny: encounter.shiny,
          key: `grass:${this.player.x},${this.player.y}`,
          tile: { x: this.player.x, y: this.player.y },
        });
        return;
      }
    }
    // Stepping into a trainer's cone makes it walk over and start the battle.
    const spotter = this.trainerSpotted();
    if (spotter) this.beginChase(spotter);
  }

  /**
   * Leaving the room through a door (`docs/maps-spec.md` §2): a link enters the
   * grid neighbour by its opposite edge (`advanceRoute`), and the boss room's
   * open portal crosses to the next map (`advanceMap`, with its heal stop). The
   * arrival door counts too, so a room can always be walked back. The dev
   * generator/import tools have no plan, so they never transition.
   */
  private tryLeaveRoom(): boolean {
    const room = this.room;
    const plan = this.plan;
    if (!room || !plan) return false;
    const edge = this.doorEdgeAt(this.player);
    if (!edge) return false;
    if (room.portalEdge !== null && edge === room.portalEdge) {
      this.transitionTo(advanceMap(this.run));
      return true;
    }
    const next = roomAcross(plan, room.roomId, edge);
    if (next === undefined) return false;
    // Leave by `edge`, arrive by its opposite (`docs/maps-spec.md` §2).
    this.transitionTo(advanceRoute(this.run, next, OPPOSITE_EDGE[edge]));
    return true;
  }

  /**
   * The map edge a **door** tile sits on: a route exit (a link or the open
   * portal) or the room's arrival tile. A border tile that is not a door (a wall,
   * reachable only with the dev noclip) returns null.
   */
  private doorEdgeAt(tile: Tile): MapEdge | null {
    const isDoor =
      this.route.exits.some((exit) => exit.x === tile.x && exit.y === tile.y) ||
      (this.route.entry.x === tile.x && this.route.entry.y === tile.y);
    if (!isDoor) return null;
    if (tile.x === 0) return 'W';
    if (tile.x === this.route.width - 1) return 'E';
    if (tile.y === 0) return 'N';
    if (tile.y === this.route.height - 1) return 'S';
    return null;
  }

  /**
   * Rebuilds the scene for the room the run just entered: build the plan room,
   * redraw its tiles, items and trainers and spawn the player on its entry tile.
   * The run's state already carries the new map position.
   */
  private transitionTo(run: RunState): void {
    this.run = run;
    this.persistRun();
    this.stopWalking();
    this.clearRouteSprites();
    this.buildRoom();
    this.drawTiles();
    this.drawEntities();
    this.drawItems();
    this.drawTrainers();
    this.player = { ...this.route.entry };
    this.movePlayerTo(this.player.x, this.player.y);
    const bounds = mapPixelSize(this.map, TILE_SIZE);
    this.cameras.main.setBounds(0, 0, bounds.width, bounds.height);
    this.refreshHud();
  }

  /** The first undefeated trainer whose line of sight holds the player. */
  private trainerSpotted(): RouteTrainer | null {
    for (const trainer of this.route.trainers) {
      if (isTrainerDefeated(this.run, trainer.id)) continue;
      if (seesPlayer(this.route, this.effectiveTrainer(trainer), this.player, this.moveMap)) return trainer;
    }
    return null;
  }

  /** The trainer as the scene currently poses it (a spinner's live facing). */
  private effectiveTrainer(trainer: RouteTrainer): RouteTrainer {
    const facing = this.trainerFacing.get(trainer.id);
    return facing && facing !== trainer.facing ? { ...trainer, facing } : trainer;
  }

  /** The trainer on `tile`, unless it has already been beaten on this route. */
  private liveTrainerAt(tile: Tile): RouteTrainer | undefined {
    const trainer = trainerAt(this.route, tile);
    return trainer && !isTrainerDefeated(this.run, trainer.id) ? trainer : undefined;
  }

  /**
   * Starts the classic "spotted you" beat: the trainer faces the player and
   * walks toward them tile by tile, then the battle opens. The player's input is
   * frozen while it happens, so the chase plays out like the originals.
   */
  private beginChase(trainer: RouteTrainer): void {
    if (this.chase || this.pendingBattle || this.gameOver) return;
    const entry = this.trainerSprites.find((candidate) => candidate.trainer.id === trainer.id);
    if (!entry) {
      this.startTrainerBattle(trainer);
      return;
    }
    this.stopWalking();
    this.touch?.release();
    this.chase = { entry, position: { ...trainer.position } };
    this.stepChase(0);
  }

  /** One chase step: walk closer, or open the battle once adjacent/stuck. */
  private stepChase(steps: number): void {
    const chase = this.chase;
    if (!chase) return;
    const here = chase.position;
    const adjacent =
      Math.abs(here.x - this.player.x) + Math.abs(here.y - this.player.y) <= 1;
    if (adjacent || steps > chase.entry.trainer.sight + 2) {
      this.finishChase();
      return;
    }
    const next = this.chaseStep(here, this.player);
    if (!next) {
      this.finishChase();
      return;
    }
    chase.position = next;
    this.playTrainerWalk(chase.entry, stepFacing(here, next));
    chase.entry.sprite.setDepth(actorDepth(this.centerY(next.y) + TILE_SIZE / 2));
    this.tweens.add({
      targets: chase.entry.sprite,
      x: this.centerX(next.x),
      y: this.centerY(next.y) + TILE_SIZE / 2,
      duration: TRAINER_CHASE_STEP_MS,
      ease: 'Linear',
      onComplete: () => this.stepChase(steps + 1),
    });
  }

  /** The next tile toward `target`, avoiding walls, items and other trainers. */
  private chaseStep(from: Tile, target: Tile): Tile | null {
    const dx = target.x - from.x;
    const dy = target.y - from.y;
    const order: Tile[] =
      Math.abs(dx) >= Math.abs(dy)
        ? [{ x: Math.sign(dx), y: 0 }, { x: 0, y: Math.sign(dy) }]
        : [{ x: 0, y: Math.sign(dy) }, { x: Math.sign(dx), y: 0 }];
    for (const step of order) {
      if (step.x === 0 && step.y === 0) continue;
      const next = { x: from.x + step.x, y: from.y + step.y };
      if (Math.abs(next.x - target.x) + Math.abs(next.y - target.y) >= Math.abs(dx) + Math.abs(dy)) {
        continue;
      }
      if (!inBounds(this.moveMap, next) || !isWalkable(this.moveMap, next)) continue;
      if (this.itemBlocks(next)) continue;
      if (this.liveTrainerAt(next) || (next.x === target.x && next.y === target.y)) continue;
      return next;
    }
    return null;
  }

  /** Ends the chase: the trainer faces the player and the battle opens. */
  private finishChase(): void {
    const chase = this.chase;
    if (!chase) return;
    this.chase = null;
    const facing: Facing =
      this.player.x < chase.position.x
        ? 'W'
        : this.player.x > chase.position.x
          ? 'E'
          : this.player.y < chase.position.y
            ? 'N'
            : 'S';
    this.trainerFacing.set(chase.entry.trainer.id, facing);
    this.faceTrainerSprite(chase.entry, facing);
    this.startTrainerBattle(chase.entry.trainer);
  }

  /** Opens the menu battle against a trainer, with a roster seeded for that id. */
  private startTrainerBattle(trainer: RouteTrainer): void {
    if (this.gameOver || this.pendingBattle || this.releaseRoot) return;
    const archetype = getTrainerArchetype(trainer.archetypeId);
    if (!archetype) return;
    const band = this.room ? bandForMap(this.room.mapIndex) : runBand(this.run.seed, this.route.routeIndex);
    const isBoss = this.room !== null && trainer.id === bossTrainerId(this.room.mapIndex);
    // The map boss fields a max-level party one size larger than its band.
    const rosterBand = isBoss
      ? { ...band, minLevel: band.maxLevel, trainerSize: band.trainerSize + 1 }
      : band;
    const key =
      isBoss && this.room
        ? `${this.run.seed}:boss:${this.room.mapIndex}`
        : `${this.run.seed}:trainer:${this.route.routeIndex}:${trainer.id}`;
    const roster = trainerRoster(archetype, rosterBand, new Rng(hashSeed(key)), trainer.id);
    this.startBattle({
      kind: 'trainer',
      trainerId: trainer.id,
      trainerName: archetype.name,
      roster,
      archetypeId: archetype.id,
    });
  }

  /**
   * The interact key (`E` by default): take the ground item the player faces, or
   * the one underfoot. Hidden items show only a faint sparkle, so this is how
   * they are found. Ignored while the HUD, a battle or a beat owns the screen.
   */
  private tryInteract(): void {
    if (this.gameOver || this.pendingBattle || this.releaseRoot || this.hudVisible) return;
    const step = MOVE_STEP[this.facingDir];
    const ahead = { x: this.player.x + step.x, y: this.player.y + step.y };
    // Talking to a trainer it is facing also opens the battle, like the originals.
    const trainer = this.liveTrainerAt(ahead);
    if (trainer) {
      this.startTrainerBattle(trainer);
      return;
    }
    if (!this.collectItemAt(ahead)) this.collectItemAt(this.player);
  }

  /**
   * True when a **visible** unpicked ground item occupies `tile`, so movement is
   * blocked. Hidden items (the faint sparkle) never block: they are walked over
   * and picked up underfoot with the interact key.
   */
  private itemBlocks(tile: Tile): boolean {
    return this.route.items.some(
      (item) =>
        item.position.x === tile.x &&
        item.position.y === tile.y &&
        !item.hidden &&
        !isItemPicked(this.run, item.id),
    );
  }

  /** Takes the unpicked ground item on `tile`, saving it to the run's bag. */
  private collectItemAt(tile: Tile): boolean {
    const item = this.route.items.find(
      (candidate) =>
        candidate.position.x === tile.x &&
        candidate.position.y === tile.y &&
        !isItemPicked(this.run, candidate.id),
    );
    if (!item) return false;
    this.run = markItemPicked(addItem(this.run, item.itemId), item.id);
    this.persistRun();
    const sprite = this.itemSprites.find((entry) => entry.item.id === item.id);
    if (sprite) {
      this.tweens.killTweensOf(sprite.sprite);
      sprite.sprite.setVisible(false).setAlpha(0);
    }
    this.refreshHud();
    return true;
  }

  /** Opens the settings screen paused-on-top, like a battle (`O`). */
  private openSettings(): void {
    if (this.gameOver || this.pendingBattle || this.releaseRoot) return;
    this.scene.pause();
    this.scene.launch('Settings', { from: 'Route' });
  }

  /**
   * The pause menu (ESC, or a left-edge swipe on a touch screen): a centred
   * window dimming the route with a Settings row and a Reset row. It does not
   * pause the scene — the route's update stops walking while it is up — so the
   * pad and A / B still drive it: up/down to pick, A to choose, B to close.
   */
  private buildPauseMenu(): void {
    const { width, height } = this.scale;
    const panelH = 88 + PAUSE_MENU_ITEMS.length * PAUSE_MENU_ROW_H;
    const x = (width - PAUSE_MENU_W) / 2;
    const y = (height - panelH) / 2;
    const rowX = x + 24;
    const rowW = PAUSE_MENU_W - 48;

    const scrim = this.add.rectangle(0, 0, width, height, 0x05070c, 0.55).setOrigin(0, 0);
    const panel = addFrlgWindow(this, x, y, PAUSE_MENU_W, panelH);
    const title = addFrlgText(this, x + 24, y + 20, 'MENU', { size: 32, tint: FRLG_INK });

    const children: Phaser.GameObjects.GameObject[] = [scrim, panel, title];
    this.pauseMenuRows = PAUSE_MENU_ITEMS.map((_item, i) => {
      const rowY = y + 76 + i * PAUSE_MENU_ROW_H;
      const highlight = this.add
        .rectangle(rowX, rowY, rowW, PAUSE_MENU_ROW_H - 8, 0xf2c14e, 0.32)
        .setOrigin(0, 0)
        .setVisible(false);
      const label = addFrlgText(this, rowX + 16, rowY + 12, PAUSE_MENU_LABELS[i], {
        size: 16,
        tint: FRLG_INK,
      });
      const zone = this.add.zone(rowX, rowY, rowW, PAUSE_MENU_ROW_H).setOrigin(0, 0);
      zone.setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        this.pauseMenuIndex = i;
        this.pauseMenuArmed = false;
        this.activatePauseMenu();
      });
      children.push(highlight, label, zone);
      return { highlight, label };
    });

    this.pauseMenu = this.add.container(0, 0, children).setDepth(450).setVisible(false);
    this.cameras.main.ignore(this.pauseMenu);
  }

  private openPauseMenu(): void {
    if (this.pauseMenuOpen || this.gameOver || this.pendingBattle || this.releaseRoot) return;
    this.pauseMenuOpen = true;
    this.pauseMenuIndex = 0;
    this.pauseMenuArmed = false;
    this.settleMovement();
    this.touch?.release();
    this.pauseMenu.setVisible(true);
    this.refreshPauseMenu();
  }

  private closePauseMenu(): void {
    this.pauseMenuOpen = false;
    this.pauseMenuArmed = false;
    this.pauseMenu.setVisible(false);
  }

  /** The phone's Back gesture: closes the pause menu, or opens it when closed. */
  private onBackGesture(): void {
    if (!this.scene.isActive()) return;
    if (this.pauseMenuOpen) this.closePauseMenu();
    else this.openPauseMenu();
  }

  private handlePauseMenuAction(action: KeybindAction): void {
    switch (action) {
      case 'up':
        this.movePauseMenu(-1);
        return;
      case 'down':
        this.movePauseMenu(1);
        return;
      case 'confirm':
        this.activatePauseMenu();
        return;
      case 'cancel':
        this.closePauseMenu();
        return;
    }
  }

  private movePauseMenu(delta: number): void {
    const count = PAUSE_MENU_ITEMS.length;
    this.pauseMenuIndex = (this.pauseMenuIndex + delta + count) % count;
    this.pauseMenuArmed = false;
    this.refreshPauseMenu();
  }

  /** Runs the chosen row: Settings pauses onto it; Reset arms, then starts over. */
  private activatePauseMenu(): void {
    const item = PAUSE_MENU_ITEMS[this.pauseMenuIndex];
    if (item === 'settings') {
      this.closePauseMenu();
      this.openSettings();
      return;
    }
    if (!this.pauseMenuArmed) {
      this.pauseMenuArmed = true;
      this.refreshPauseMenu();
      return;
    }
    this.closePauseMenu();
    this.restartRun();
  }

  private refreshPauseMenu(): void {
    this.pauseMenuRows.forEach((row, i) => {
      row.highlight.setVisible(i === this.pauseMenuIndex);
      const reset = PAUSE_MENU_ITEMS[i] === 'reset';
      row.label.setText(
        reset && this.pauseMenuArmed ? 'Reset run - press again' : PAUSE_MENU_LABELS[i],
      );
    });
  }

  /**
   * Called by `SettingsScene` before it closes: re-reads the preferences and
   * re-renders the route with the tileset they now ask for (D10 keeps the
   * biome's own tileset until the player forces another one).
   */
  applySettings(): void {
    this.settings = loadSettings();
    const wanted = resolveTileset(this.settings.tileset, getBiome(this.route.biomeId).tilesetId);
    if (wanted !== this.tilesetId) this.applyTileset(wanted);
    // A rebind happened behind this screen; re-resolve the movement keys so the
    // new keys are live the moment the route resumes.
    this.refreshMoveKeys();
  }

  /** Pauses the route and rolls the battle on top of it (Phase 5 transition). */
  private startBattle(trigger: BattleTrigger): void {
    if (this.gameOver || this.pendingBattle || this.releaseRoot) return;
    this.battleCounter += 1;
    const key = trigger.kind === 'wild' ? `${trigger.key}:${this.battleCounter}` : `trainer:${trigger.trainerId}`;
    const launch: BattleLaunch = {
      trigger,
      player: this.run.party.map((member) => member.fighter),
      experience: this.run.party.map((member) => ({ id: member.fighter.id, xp: member.xp })),
      bag: this.run.bag,
      seed: battleSeed(this.run.seed, this.run.routeIndex, key),
      runSeed: this.run.seed,
      routeIndex: this.run.routeIndex,
      canCapture: canCapture(this.run),
    };
    this.pendingBattle = launch;
    this.scene.pause();
    this.scene.launch('Battle', launch);
  }

  /**
   * Dev only: opens a battle against a chosen wild Pokémon from the debug menu.
   * Ignored while the route is paused behind another battle or the run is over.
   */
  startDebugWildBattle(speciesId: string, level: number): void {
    if (!IS_DEVELOP || this.gameOver || this.pendingBattle || this.releaseRoot || !this.scene.isActive()) return;
    this.startBattle({ kind: 'wild', speciesId, level, key: `debug:${speciesId}` });
  }

  /**
   * Dev only: drops a chosen Pokémon into the run. It joins the party while
   * there is room and the PC box after that (the capture rule), then the save
   * and the HUD follow. Returns where it landed, or null with no live run.
   */
  addDebugPokemon(speciesId: string, level: number): 'party' | 'box' | null {
    if (!IS_DEVELOP || !this.run || this.gameOver) return null;
    this.debugMonCounter += 1;
    const pokemon = createRunPokemon({
      id: `debug:${speciesId}:${this.debugMonCounter}`,
      speciesId,
      level,
      learnsetSeed: this.run.seed,
    });
    this.run = addPokemon(this.run, pokemon);
    this.persistRun();
    this.refreshHud();
    return this.run.party.some((member) => member.fighter.id === pokemon.fighter.id) ? 'party' : 'box';
  }

  /** Dev only: adds `count` of an item to the run's bag and resyncs the HUD. */
  addDebugItem(itemId: string, count: number): void {
    if (!IS_DEVELOP || !this.run || this.gameOver) return;
    this.run = addItem(this.run, itemId, count);
    this.persistRun();
    this.refreshHud();
  }

  /** Dev only: the party members the editor can target, with their live shape. */
  debugParty(): readonly DebugPartyMember[] {
    if (!IS_DEVELOP || !this.run) return [];
    return this.run.party.map((member) => ({
      id: member.fighter.id,
      speciesId: member.fighter.speciesId,
      name: getSpecies(member.fighter.speciesId)?.name ?? member.fighter.speciesId,
      level: member.fighter.level,
      nature: member.fighter.nature,
      ability: member.fighter.ability,
      moves: member.fighter.moves.map((slot) => slot.moveId),
    }));
  }

  /**
   * Dev only: overrides a party member's level, moves, ability or nature, then
   * resyncs the save and the HUD. Returns false with no live run or a bad id.
   */
  editDebugPokemon(memberId: string, edit: DebugPartyEdit): boolean {
    if (!IS_DEVELOP || !this.run || this.gameOver) return false;
    const member = this.run.party.find((candidate) => candidate.fighter.id === memberId);
    if (!member) return false;
    this.run = updatePokemon(this.run, editRunPokemon(member, edit));
    this.persistRun();
    this.refreshHud();
    return true;
  }

  /**
   * Dev only: fully restores a party member — HP and PP to full, status cleared
   * and a 0-HP member revived. Returns false with no live run or a bad id.
   */
  healDebugPokemon(memberId: string): boolean {
    if (!IS_DEVELOP || !this.run || this.gameOver) return false;
    const member = this.run.party.find((candidate) => candidate.fighter.id === memberId);
    if (!member) return false;
    this.run = updatePokemon(this.run, fullHealMember(member));
    this.persistRun();
    this.refreshHud();
    return true;
  }

  /** Called by `BattleScene` before it stops: folds the result back into the run. */
  applyBattleResult(result: BattleReturn): void {
    const pending = this.pendingBattle;
    this.pendingBattle = null;
    if (!pending) return;

    const reward = this.rewardFor(pending.trigger);
    const before = this.run.party;
    const { run, released } = resolveBattle(this.run, result, reward);
    this.run = run;

    const bossId = this.room?.boss === true ? bossTrainerId(this.room.mapIndex) : null;
    const wonBoss =
      bossId !== null &&
      pending.trigger.kind === 'trainer' &&
      pending.trigger.trainerId === bossId &&
      isTrainerDefeated(this.run, bossId);
    if (wonBoss) this.run = markBossDefeated(this.run);
    this.persistRun();
    this.refreshHud();

    // A beaten trainer leaves the route: hide its sprite so the tile is free.
    if (pending.trigger.kind === 'trainer') {
      const trainerId = pending.trigger.trainerId;
      const entry = this.trainerSprites.find((candidate) => candidate.trainer.id === trainerId);
      if (entry && isTrainerDefeated(this.run, trainerId)) {
        entry.sprite.setVisible(false);
        this.trainerSpinIndex.delete(trainerId);
        this.trainerFacing.delete(trainerId);
      }
    }

    const over = !hasLivingParty(this.run);
    this.gameOver = over;
    this.playReleaseBeats(releaseBeats(released), () => {
      if (over) {
        this.scene.start('RunOver', { run: this.run, won: false });
        return;
      }
      if (wonBoss) {
        // The final boss ends a finite run; every other map opens its portal, so
        // rebuild the room with the new door and let the player walk through.
        if (isFinalMap(this.run.mode, this.run.mapIndex)) {
          this.scene.start('RunOver', { run: this.run, won: true });
          return;
        }
        this.transitionTo(this.run);
        return;
      }
      this.playLevelUp(levelUpBeats(before, this.run.party));
    });
  }

  /**
   * Permadeath feedback (Phase 5): one beat per fallen Pokémon — a scrim, its
   * portrait and "<name> was released." — then `onDone`. With nothing to show it
   * calls back straight away, so the caller keeps one code path.
   */
  private playReleaseBeats(beats: readonly ReleaseBeat[], onDone: () => void): void {
    if (beats.length === 0) {
      onDone();
      return;
    }
    this.releaseQueue = [...beats];
    this.releaseOnDone = onDone;
    this.releaseArmed = false;
    this.buildReleaseOverlay();
    this.time.delayedCall(RELEASE_INPUT_DELAY_MS, () => {
      this.releaseArmed = true;
    });
    this.showReleaseBeat();
  }

  private buildReleaseOverlay(): void {
    const { width, height } = this.scale;
    const panelW = 460;
    const panelH = 264;
    const x = (width - panelW) / 2;
    const y = (height - panelH) / 2 - 24;
    const scrim = this.add.rectangle(0, 0, width, height, 0x05070c, 0.72).setOrigin(0, 0);
    const panel = addFrlgWindow(this, x, y, panelW, panelH, 'textbox');
    this.releasePortrait = this.add.image(width / 2, y + 96, PORTRAIT_TEXTURE_KEY, 0).setScale(2);
    this.releaseText = addFrlgText(this, width / 2, y + 168, '', { align: 'center', origin: 0.5 });
    this.releaseText.setMaxWidth(panelW - 48);
    const hint = addFrlgText(
      this,
      width / 2,
      y + panelH + 28,
      `${keyLabel(this.settings.keybinds.confirm)} — continue`,
      {
        size: 16,
        tint: 0x94a3b8,
        origin: 0.5,
      },
    );
    // The HUD camera was told to ignore everything that existed at setup, not
    // this, so the overlay lives there; the world camera must drop it.
    this.releaseRoot = this.add
      .container(0, 0, [scrim, panel, this.releasePortrait, this.releaseText, hint])
      .setDepth(300);
    this.cameras.main.ignore(this.releaseRoot);
  }

  private showReleaseBeat(): void {
    const beat = this.releaseQueue[0];
    if (!beat || !this.releaseRoot) {
      this.finishReleaseBeats();
      return;
    }
    const portrait = portraitFor(beat.speciesId, beat.shiny);
    this.releasePortrait.setVisible(portrait !== null);
    if (portrait) this.releasePortrait.setTexture(portrait.key, portrait.frame);
    this.releaseText.setText(`Lv${beat.level} ${beat.name}\nwas released.`);
    this.releaseWait?.remove(false);
    this.releaseWait = this.time.delayedCall(RELEASE_HOLD_MS, () => this.advanceRelease());
  }

  private advanceRelease(): void {
    if (this.releaseQueue.length === 0) return;
    this.releaseWait?.remove(false);
    this.releaseWait = null;
    this.releaseQueue.shift();
    this.showReleaseBeat();
  }

  private finishReleaseBeats(): void {
    this.releaseWait?.remove(false);
    this.releaseWait = null;
    this.releaseQueue = [];
    this.releaseRoot?.destroy();
    this.releaseRoot = null;
    const done = this.releaseOnDone;
    this.releaseOnDone = null;
    done?.();
  }

  /**
   * The level-up beat: each row that levelled counts its level up from the old
   * value with a gold flash on the portrait, then the HUD resyncs (Phase 5).
   */
  private playLevelUp(beats: readonly LevelUpBeat[]): void {
    for (const beat of beats) {
      const index = this.run.party.findIndex((member) => member.fighter.id === beat.id);
      const row = this.hudRows[index];
      if (index < 0 || !row) continue;
      const member = this.run.party[index];
      const name = getSpecies(member.fighter.speciesId)?.name ?? member.fighter.speciesId;
      const maxHp = restoreFighter(member.fighter).maxHp;
      const counter = { level: beat.fromLevel };
      const paint = () => {
        row.name.setText(name);
        row.level.setText(`Lv${Math.round(counter.level)}`);
        row.hpText.setText(`${member.fighter.hp}/${maxHp}`);
      };
      paint();
      row.portrait.setTint(0xf2c14e);
      this.tweens.add({
        targets: counter,
        level: beat.toLevel,
        duration: 520,
        ease: 'Quad.easeOut',
        onUpdate: paint,
        onComplete: () => {
          row.portrait.clearTint();
          this.refreshHud();
        },
      });
    }
  }

  private rewardFor(trigger: BattleTrigger): BattleReward {
    if (trigger.kind === 'wild') return { enemyLevels: [trigger.level], isTrainer: false };
    return {
      enemyLevels: trigger.roster.map((entry) => entry.level),
      isTrainer: true,
      trainerId: trigger.trainerId,
    };
  }

  /** Cancels a step in flight, so a rebuild can move the player cleanly. */
  private stopWalking(): void {
    this.walkTween?.stop();
    this.walkTween = null;
    this.playerSprite?.anims.stop();
  }

  /** Destroys the route's tiles and entity overlays before a rebuild. */
  private clearRouteSprites(): void {
    for (const row of this.tileSprites) {
      for (const cell of row) {
        for (const image of cell) image.destroy();
      }
    }
    this.tileSprites = [];
    for (const entry of this.itemSprites) this.tweens.killTweensOf(entry.sprite);
    for (const entry of this.trainerSprites) this.tweens.killTweensOf(entry.sprite);
    for (const sprite of this.entitySprites) sprite.destroy();
    this.entitySprites = [];
    this.itemSprites = [];
    this.trainerSprites = [];
    this.trainerSpinIndex.clear();
    this.trainerFacing.clear();
    this.chase = null;
    this.clearHoverInspect();
  }

  /**
   * Debug only: the inputs behind the route on screen and its derived biome and
   * band, for the debug menu's "Route" panel. Null when no route is active.
   */
  debugRouteContext(): DebugRouteContext | null {
    if (!IS_DEVELOP || !this.run || !this.routeParams || !this.scene.isActive()) return null;
    return {
      seed: this.routeParams.seed,
      routeIndex: this.routeParams.routeIndex,
      mode: this.run.mode,
      biomeName: this.room
        ? getBiome(this.room.biomeId).name
        : biomeForRoute(this.routeParams.routeIndex).name,
      bandName: this.room
        ? bandForMap(this.room.mapIndex).name
        : runBand(this.run.seed, this.routeParams.routeIndex).name,
      shape: this.routeParams.shape,
      width: this.routeParams.width,
      height: this.routeParams.height,
      passThrough: this.passThrough,
      hoverInspect: this.hoverInspect,
    };
  }

  /** Debug only: toggles walking through solid tiles (walls, water, ledges). */
  setPassThrough(enabled: boolean): void {
    if (!IS_DEVELOP) return;
    this.passThrough = enabled;
  }

  /** Debug only: toggles the hovered-cell highlight and its x,y label. */
  setHoverInspect(enabled: boolean): void {
    if (!IS_DEVELOP) return;
    this.hoverInspect = enabled;
    if (!enabled) {
      this.clearHoverInspect();
      return;
    }
    // The pointer is already over a cell: show it without waiting for a move.
    this.updateHoverInspect(this.input.activePointer);
  }

  /**
   * Debug only: colors the route cell under the pointer and labels its `x,y`.
   * It is recomputed on every pointer move; the marker is reused until the
   * pointer lands on another cell, and dropped entirely when the setting is off.
   */
  private updateHoverInspect(pointer: Phaser.Input.Pointer): void {
    if (!this.hoverInspect || !this.scene.isActive() || !this.map) {
      this.clearHoverInspect();
      return;
    }
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const tile: Tile = { x: Math.floor(world.x / TILE_SIZE), y: Math.floor(world.y / TILE_SIZE) };
    if (!inBounds(this.map, tile)) {
      this.clearHoverInspect();
      return;
    }
    if (this.hoverCell && this.hoverCell.x === tile.x && this.hoverCell.y === tile.y) return;
    this.hoverCell = tile;
    const label = `${tile.x},${tile.y}`;
    if (!this.hoverMarker) {
      this.hoverMarker = this.add
        .rectangle(this.centerX(tile.x), this.centerY(tile.y), TILE_SIZE, TILE_SIZE, 0x7dd3fc, 0.3)
        .setStrokeStyle(2, 0x7dd3fc, 0.9)
        .setDepth(30);
      this.hoverLabel = addFrlgText(this, this.centerX(tile.x), this.centerY(tile.y), label, {
        size: 16,
        origin: 0.5,
      })
        .setScale(0.5)
        .setDepth(31);
      // Both cameras render every object unless told otherwise; the pinned HUD
      // camera would otherwise draw a second marker at the unscrolled position.
      this.hudCamera?.ignore([this.hoverMarker, this.hoverLabel]);
      return;
    }
    this.hoverMarker.setPosition(this.centerX(tile.x), this.centerY(tile.y));
    this.hoverLabel?.setPosition(this.centerX(tile.x), this.centerY(tile.y)).setText(label);
  }

  /** Debug only: removes the hovered-cell highlight, if any. */
  private clearHoverInspect(): void {
    this.hoverCell = null;
    this.hoverMarker?.destroy();
    this.hoverMarker = null;
    this.hoverLabel?.destroy();
    this.hoverLabel = null;
  }

  /**
   * Debug only: the generator phase currently rendered. `index` is 0-based and
   * `index === total - 1` is the live map. Null when no route is active.
   */
  generatorStepInfo(): { index: number; total: number; label: string } | null {
    if (!IS_DEVELOP || this.generatorSteps.length === 0) return null;
    const index = this.generatorStepIndex ?? this.generatorSteps.length - 1;
    return { index, total: this.generatorSteps.length, label: this.generatorSteps[index].label };
  }

  /** Debug only: render the previous/next generator phase (wraps the live map). */
  stepGenerator(delta: number): void {
    if (!IS_DEVELOP || this.generatorSteps.length === 0) return;
    const last = this.generatorSteps.length - 1;
    const next =
      this.generatorStepIndex === null
        ? delta < 0
          ? last
          : 0
        : Math.max(0, Math.min(last, this.generatorStepIndex + delta));
    this.showGeneratorStep(next === last ? null : next);
  }

  /** Debug only: leave the stepper and render the live route again. */
  resetGeneratorStep(): void {
    if (!IS_DEVELOP) return;
    this.showGeneratorStep(null);
  }

  private showGeneratorStep(step: number | null): void {
    if (!this.scene.isActive()) return;
    this.generatorStepIndex = step;
    this.renderTiles = step === null ? this.map : this.generatorSteps[step].tiles;
    this.stopWalking();
    this.clearRouteSprites();
    this.drawTiles();
    this.drawEntities();
  }

  /**
   * Debug only: rebuilds the route from the panel's inputs without touching the
   * run. `attempt` rerolls the same base inputs reproducibly (D11).
   */
  regenerateRoute(input: DebugRouteInput): void {
    if (!IS_DEVELOP || !this.run || !this.routeParams) return;
    if (!this.scene.isActive() || this.gameOver || this.pendingBattle || this.releaseRoot) {
      return;
    }

    const params: RouteParams = {
      seed: input.seed.trim() ? input.seed.trim() : this.routeParams.seed,
      routeIndex: Math.max(1, Math.floor(input.routeIndex)),
      shape: input.shape,
      width: clampInt(input.width, 16, 128),
      height: clampInt(input.height, 16, 96),
      grassPatches: this.routeParams.grassPatches,
      ledges: this.routeParams.ledges,
    };
    const attempt = Math.max(0, Math.floor(input.attempt));

    // The dev generator builds a rolled shape, not a plan room: no map doors.
    this.room = null;
    this.plan = null;
    this.stopWalking();
    this.clearRouteSprites();
    this.buildRoute(params, attempt);
    this.drawTiles();
    this.drawEntities();
    this.drawItems();
    this.drawTrainers();
    this.player = { ...this.route.entry };
    this.movePlayerTo(this.player.x, this.player.y);
    const cameraBounds = mapPixelSize(this.map, TILE_SIZE);
    this.cameras.main.setBounds(0, 0, cameraBounds.width, cameraBounds.height);
  }

  /**
   * Debug only: the on-screen route described cell by cell (tile value, resolved
   * atlas frame, wall-pattern row/column and the whole-object tree each cell
   * belongs to), as JSON for the menu's "Map" tab. Null when no route is active.
   */
  exportFrameMap(): string | null {
    if (!IS_DEVELOP || !this.route || !this.scene.isActive()) return null;
    const config = TILESETS[this.tilesetId].config;
    return JSON.stringify(serializeFrameMap(this.route, config), null, 2);
  }

  /**
   * Debug only: rebuild the route from an exported frame map and show it. It does
   * not touch the run, so an imported map is only for inspection; the route
   * params follow it so the panel keeps describing what is on screen.
   */
  importFrameMap(text: string): { ok: boolean; error?: string } {
    if (!IS_DEVELOP || !this.scene.isActive()) return { ok: false, error: 'no active route' };
    let exported;
    try {
      exported = parseFrameMapExport(text);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'invalid frame map' };
    }
    this.stopWalking();
    this.clearRouteSprites();
    this.room = null;
    this.plan = null;
    const route = routeFromFrameMapExport(exported);
    this.generatorSteps = [];
    this.applyRoute(route);
    const biome = getBiome(route.biomeId);
    this.routeParams = {
      seed: route.seed,
      routeIndex: route.routeIndex,
      shape: route.shape,
      width: route.width,
      height: route.height,
      grassPatches: biome.terrain.grassPatches,
      ledges: biome.terrain.ledges,
    };
    this.drawTiles();
    this.drawEntities();
    this.drawItems();
    this.drawTrainers();
    this.player = { ...route.entry };
    this.movePlayerTo(this.player.x, this.player.y);
    const cameraBounds = mapPixelSize(this.map, TILE_SIZE);
    this.cameras.main.setBounds(0, 0, cameraBounds.width, cameraBounds.height);
    return { ok: true };
  }

  override update(time: number, delta: number): void {
    // The hold-to-reset runs whatever the route is doing (a battle pauses the
    // scene, so it never fires behind another screen).
    this.updateReset(delta);
    this.updateTrainerSpins(time);
    // The player sorts against the trainers by its foot row every frame, so the
    // depth follows a step in flight instead of snapping when it lands.
    this.playerSprite.setDepth(actorDepth(this.playerSprite.y));
    if (this.gameOver || this.pendingBattle || this.releaseRoot || this.pauseMenuOpen || this.chase) {
      this.settleMovement();
      return;
    }
    const direction = this.heldDirection();
    if (!direction) {
      this.settleMovement();
      return;
    }
    // A step is still sliding; the next one starts when it lands.
    if (this.walkTween) return;
    const step = MOVE_STEP[direction];
    // Dev noclip: step onto any in-bounds tile, solid or not.
    const direct = { x: this.player.x + step.x, y: this.player.y + step.y };
    if (this.passThrough && inBounds(this.map, direct)) {
      this.walkStep(direction, direct);
      return;
    }
    const result = resolveMove(this.moveMap, this.player, step);
    // A visible ground item or a live trainer blocks its tile, like an object in
    // the originals: the item is taken with the interact key and the trainer is
    // talked to. A hidden item can be walked over.
    if (!result || this.itemBlocks(result.to) || this.liveTrainerAt(result.to)) {
      this.faceIdle(direction);
      return;
    }
    this.walkStep(direction, result.to);
  }

  /** Turns every "spinning" trainer to the next facing on the shared timer. */
  private updateTrainerSpins(time: number): void {
    if (this.generatorStepIndex !== null) return;
    if (this.gameOver || this.pendingBattle || this.releaseRoot || this.pauseMenuOpen || this.chase) return;
    for (const entry of this.trainerSprites) {
      const turns = entry.trainer.turns;
      if (!turns || turns.length < 2) continue;
      const index = Math.floor(time / TRAINER_TURN_MS) % turns.length;
      if (this.trainerSpinIndex.get(entry.trainer.id) === index) continue;
      this.trainerSpinIndex.set(entry.trainer.id, index);
      this.trainerFacing.set(entry.trainer.id, turns[index]);
      this.faceTrainerSprite(entry, turns[index]);
      // A spinner that swings its cone onto a player standing still still spots
      // them, the same as stepping into a fixed trainer's line of sight.
      if (seesPlayer(this.route, this.effectiveTrainer(entry.trainer), this.player, this.moveMap)) {
        this.beginChase(entry.trainer);
        return;
      }
    }
  }

  /**
   * The direction the player is pushing. A held key keeps walking; a fresh tap
   * counts even if it is released before the next frame, so a quick press still
   * moves a tile. The on-screen pad answers after the keyboard, so the two never
   * fight over a direction.
   */
  private heldDirection(): MoveKey | null {
    const { up, down, left, right } = this.moveKeys;
    const pressed = (keys: Phaser.Input.Keyboard.Key[]): boolean =>
      keys.some((key) => key.isDown || Phaser.Input.Keyboard.JustDown(key));
    if (pressed(left)) return 'left';
    if (pressed(right)) return 'right';
    if (pressed(up)) return 'up';
    if (pressed(down)) return 'down';
    return this.touch?.heldDirection() ?? null;
  }
}
