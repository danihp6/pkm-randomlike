import Phaser from 'phaser';
import { biomeForRoute, getBiome } from '../data/biomes';
import { getMove, getSpecies, normalizeId, TYPE_NAMES } from '../data/dex';
import { GROUND_ITEM_TEXTURE_KEY } from '../data/groundItemSprite';
import { PROP_SIGN_FRAME, PROP_SIGN_SIZE, PROP_SIGN_TEXTURE_KEY } from '../data/tilesets/props';
import { type HudPanelId } from '../data/hudLayout';
import { FINITE_MAPS, levelCapForMap } from '../data/maps';
import { ITEM_ICON_TEXTURE_KEY, itemIconFrame } from '../data/itemIcons';
import { getItem } from '../data/items';
import {
  BERRY_TREE_ENEMY_BOOSTS,
  CURSE_ENEMY_BOOST,
  NPC_ROWS,
  TUTOR_MOVES,
  type NpcRow,
} from '../data/npcs';
import { keyLabel, type KeybindAction } from '../data/keybinds';
import { PORTRAIT_TEXTURE_KEY, portraitFor } from '../data/portraits';
import {
  PLAYER_SPRITE_TEXTURE_KEY,
  PLAYER_SPRITE_WIDTH,
  playerSpriteFrame,
  type PlayerFacing,
} from '../data/playerSprite';
import { pokemonOverworldSheet, type PokemonOverworldSheet } from '../data/pokemonOverworld';
import { playerWalkAnimKey, playerWalkTimeScale } from '../render/playerAnim';
import { followerAnimKey, followerAnims } from '../render/pokemonFollower';
import { ROUTE_LOOT } from '../data/loot';
import {
  ROOM_BATTLEFIELDS,
  type RoomBattlefield,
  type RoomConditionId,
  type RoomConditionKind,
} from '../data/battlefields';
import type { MapPassiveTrigger } from '../data/passives';
import { bossIsDouble, bossPartySize, type BossPartyKind } from '../data/bosses';
import {
  OVERWORLD_SPRITE_TEXTURE_KEY,
  OVERWORLD_SPRITE_WIDTH,
  overworldSpriteFrame,
} from '../data/overworldSprites';
import { trainerFacingPose, trainerWalkAnimKey } from '../render/trainerAnim';
import { getTrainerArchetype, TRAINER_ARCHETYPE_IDS } from '../data/trainers';
import { trainerLevel } from '../data/trainerLevels';
import { bandForLevel } from '../data/run';
import { IS_DEVELOP } from '../dev/env';
import { nextDebugPokemonId } from '../dev/ids';
import type {
  DebugPartyEdit,
  DebugPartyMember,
  DebugRouteContext,
  DebugRouteInput,
  DebugTeleportResult,
} from '../dev/debugMenu';
import { type BoostId, type FighterInput } from '../engine/battle';
import {
  BOSS_MONEY_MULTIPLIER,
  MAX_MOVES,
  POKEVIAL_MAX_CHARGES,
  addItem,
  addPokemon,
  adoptAtLevel,
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
  routeIndexForRoom,
  runBand,
  squadLevel,
  trainerMoney,
  trainerRoster,
  unequipHeldItem,
  updatePokemon,
  useCapture,
  xpForLevel,
  type BagCounts,
  type BattleLaunch,
  type BattleReturn,
  type BattleReward,
  type BattleTrigger,
  type RunPokemon,
  type RunState,
} from '../engine/run';
import {
  rerollAbility,
  rerollIvs,
  rerollNature,
  sacrifice,
  swapSpecies,
  teachMove,
  type MemberEdit,
  type MemberEditLine,
  type MemberEditRefusal,
} from '../engine/run/memberEdits';
import { ownedTmIds, useItemOn } from '../engine/run/items';
import { battleHpLoss, missionCompletedBy, missionForMap, recordHpLost } from '../engine/run/missions';
import {
  FORCED_FIELD_FLOORS,
  forcedFieldId,
  withCurse,
  withForcedField,
  withNextWildType,
  withoutCurse,
  withoutNextWildType,
  type RunModifiers,
} from '../engine/run/modifiers';
import { partyHasType } from '../engine/run/party';
import { wildExclusions } from '../engine/run/pool';
import { runPassives, type PassivePickup } from '../engine/run/passives';
import { COMMON_TEXTURE_KEY, TILESETS, type TilesetId, tilesetTextureKey } from '../data/tilesets';
import type { Tile } from '../engine/grid';
import {
  FLOOR,
  TALL_GRASS,
  WALL,
  isWalkable,
  mapPixelSize,
  mapSize,
  resolveMove,
  type TileMap,
} from '../engine/map';
import { hashSeed, randomSeed, Rng } from '../engine/rng';
import { clearRun, storeRun, type Settings } from '../engine/save';
import {
  DEFAULT_SHAPE,
  DEFAULT_TRAINER_SIGHT,
  RouteEncounters,
  bannedSpeciesOf,
  borderEdge,
  bossChamberTile,
  chefTrade,
  encounterTableFor,
  exitEdgeAt,
  gateId,
  guaranteedNpc,
  medicHeal,
  npcBerryHarvest,
  npcForcedField,
  npcPrize,
  npcRequirementMet,
  npcSpot,
  npcTrainerId,
  npcTreeWild,
  npcUseId,
  npcWildType,
  rollWildLevel,
  roomNpc,
  secretShopSealId,
  seesPlayer,
  sketchRoute,
  sketchRouteSteps,
  specialTrainerFor,
  staticGateId,
  trainerAt,
  trainerHidden,
  withForcedAbility,
  type ChefTradeRefusal,
  type Facing,
  type RouteItem,
  type RouteMap,
  type RouteRequest,
  type RouteShape,
  type RouteStep,
  type RouteTrainer,
} from '../engine/routes';
import {
  bossOpeningRoll,
  roomBattlefield,
  roomKindOf,
  type BossOpeningRoll,
} from '../engine/routes/battlefield';
import { bossRoomHeal, bossRoomSealed } from '../engine/routes/bossRoom';
import {
  OPPOSITE_EDGE,
  bossTrainerId,
  isFinalMap,
  miniBossTrainerId,
  planMap,
  roomAcross,
  roomView,
  type MapEdge,
  type MapPlan,
  type RoomView,
} from '../engine/maps';
import { COMMON_TILE_SIZE, TILE_SIZE } from '../engine/tileset';
import {
  resolveTileFrame,
  resolveGroundFrame,
  grassRustleFrames,
  grassTipKeys,
  hiddenItemFrame,
  isGrassStepTile,
  treeTipKeys,
  type TileFrame,
} from '../engine/tileFrames';
import { parseFrameMapExport, routeFromFrameMapExport, serializeFrameMap } from '../engine/frameMap';
import { type BagGridDebugState } from '../ui/bag';
import {
  dragTo,
  dropGrabbed,
  grabAt,
  initialPartyUi,
  partyInput,
  swapAcross,
  type PartyUiState,
  type PaneId,
} from '../ui/partyScreen';
import { addFrlgWindow } from '../ui/frlg';
import {
  catchToPcNotice,
  eggHatchNotice,
  itemPickupNotice,
  itemUsedNotice,
  missionCompleteNotice,
  type Notice,
} from '../ui/notice';
import { hatchEgg } from '../ui/casino';
import { levelUpBeats, type LevelUpBeat } from '../ui/beats';
import {
  RELEASE_HOLD_MS,
  RELEASE_INPUT_DELAY_MS,
  releaseBeats,
  type ReleaseBeat,
} from '../ui/permadeath';
import { FRLG_INK, addFrlgText } from '../ui/frlgFont';
import { openNpcPanel, NPC_MAX_CHOICES, type NpcPanelView } from '../ui/npcPanel';
import { openRocket } from '../ui/rocketPanel';
import { FRLG_ACCENT, FRLG_MUTED } from '../ui/frlg';
import { createTouchControls, type TouchControls } from '../ui/touchControls';
import { t, type TranslationKey } from '../i18n';
import { actionKeys, subscribeKeybinds } from '../input/input';
import { listenForBack } from '../input/backButton';
import { prefersTouchControls } from '../input/device';
import { playCue, playMusic } from '../audio/audio';
import { loadSettings } from '../settings';
import { browserStorage } from '../storage';
import { GRASS_TEXTURE_KEY, TRAINER_TEXTURE_KEY } from './BootScene';
import { collectDescriptors, type RoomRegistry } from './rooms/registry';
import { openMart } from './rooms/shop';
import type {
  RoomDescriptor,
  RoomDrop,
  RoomHost,
  RoomPanel,
  RoomRowDrag,
  RoomWildBattle,
} from './rooms/types';
import {
  HUD_DRAG_SLOP,
  applyHudBackground,
  applyStoredHudLayout as applyHudLayout,
  cancelPanelDrag,
  draggedItemFrom,
  draggedItemId,
  finishHud,
  grabMoved,
  hudMetrics,
  hudPanelAt,
  hudPanelIconAt,
  hudPanelOwnerAt,
  panelPoint,
  persistHudLayout as saveHudLayout,
  refreshPanelKeyLabels,
  registerHudOverlay,
  resetHudOverlays,
  setDraggedItem,
  setGrabMoved,
  setHudLevel,
  setPointerPhase,
  startPanelDrag,
  toggleHudPanel as togglePanelById,
  vialButtonAt,
} from './panels/hud';
import {
  clearPartyPortraitTints,
  hudPartyRowAt,
  paneMembers,
  partyHeldBadge,
  pointerInPartyPanel,
  setPartyPortraitTint,
} from './panels/party';
import {
  bagDebugState as bagStateOf,
  bagTextFieldFocused,
  hudDraggableStackAt,
  pointerInBagPanel,
  typeInBagSearch,
} from './panels/bag';
import { boxHeldBadge, hudBoxCellAt, pointerInBoxPanel, stepBoxPage } from './panels/pc';
import {
  cancelDetailDrags,
  cancelNicknameEdit,
  clearDetailInfo,
  closeLearnPopup,
  closeMemberDetail,
  detailHover,
  detailOpen,
  detailTextFieldFocused,
  dismissLearnPopup,
  learnPopupOpenNow,
  openMemberDetail,
  pointerInLearnBand,
  refreshDetail,
  scrollLearnset,
  showLearnPopup,
  typeInDetailSearch,
  typeInNickname,
} from './panels/detail';
import { showAreaPanel, showNotice as showPanelNotice } from './panels/notices';
import { closeMiniBossReward as closeRewardCard, openMiniBossReward } from './panels/rewards';
import {
  closePauseMenu,
  hideResetOverlay,
  openPauseMenu,
  pauseMenuOpenNow,
  updateReset as updateResetOverlay,
} from './panels/pause';
import { collectPanels, type PanelRegistry } from './panels/registry';
import type { HudMetrics, HudPanel, RoutePanelHost } from './panels/types';

/**
 * Every special room kind's descriptor module (`D47`), discovered from the folder
 * itself: a new room is a new file here and the scene is not edited. The negative
 * pattern keeps the folder's own tests out of the browser bundle.
 */
const ROOM_MODULES = import.meta.glob(['./rooms/*.ts', '!./rooms/*.test.ts'], { eager: true });

/**
 * Every route panel's descriptor module (`D47`'s shape, one folder over),
 * discovered from the folder itself: a new panel is a new file here and the scene
 * is not edited. The negative pattern keeps the folder's own tests out of the
 * browser bundle.
 */
const PANEL_MODULES = import.meta.glob(['./panels/*.ts', '!./panels/*.test.ts'], {
  eager: true,
});

/**
 * The world camera's zoom while walking a route: tiles read at 2x on a desktop
 * window. A touch screen has a much narrower viewport, so it pulls back a quarter
 * (`ROUTE_TOUCH_ZOOM_OUT`) to keep the same slice of the route on screen. Only
 * the route uses this camera; the menus and the battle are untouched.
 */
const ROUTE_CAMERA_ZOOM = 2;
const ROUTE_TOUCH_ZOOM_OUT = 0.75;
const routeCameraZoom = (): number =>
  ROUTE_CAMERA_ZOOM * (prefersTouchControls() ? ROUTE_TOUCH_ZOOM_OUT : 1);

/** The drag ghost a room row draws: above every panel, below nothing. */
const ROW_DRAG_DEPTH = 640;

/**
 * Render depth of a wall cell's walkable tip: above the actors so the character
 * passes **behind** the crown, below the grass overlay and the HUD.
 */
const TREE_TIP_DEPTH = 20;

/**
 * Render depth of a room's condition filter: over the tiles, the actors and the tree
 * tips, under the dev hover marker (30) and the HUD (150).
 */
const BATTLEFIELD_DEPTH = 25;

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

/** One frame of the player's own tall-grass rustle, in ms. */
const GRASS_STEP_MS = 70;
/** Over the actor band (`ACTOR_DEPTH` + foot-y step, 491-497), under `TREE_TIP_DEPTH`. */
const GRASS_STEP_DEPTH = 10;

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

/** The room's special NPC (`docs/maps-spec.md` §7): the row it rolled and its tile. */
type RoomNpc = Readonly<{ row: NpcRow; tile: Tile }>;

/** What one battle launch adds beyond the trigger: the guardian's boosts and its no-flee rule. */
type BattleExtras = Readonly<{
  noFlee?: boolean;
  enemyBoosts?: Partial<Record<BoostId, number>>;
  /** The fight rolls (or was told) two actives per side (`docs/battle-spec.md` §12). */
  double?: boolean;
}>;

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

/** How `transitionTo` places the player after the rebuild. */
type TransitionOptions = Readonly<{ keepPosition?: boolean }>;

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

/** "serious" -> "Serious", for the nature line. */
function capitalize(text: string): string {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}

/** The line an NPC card prints when a member edit refuses, by reason. */
const NPC_REFUSALS: Readonly<Record<MemberEditRefusal, TranslationKey>> = {
  'no-member': 'npc.refused.noMember',
  'no-slots': 'npc.refused.noSlots',
  'no-bag': 'npc.refused.noBag',
  'no-species': 'npc.refused.noSpecies',
  'no-ability': 'npc.refused.noAbility',
  'not-a-tutor-move': 'npc.refused.notTutorMove',
};

/** The line the chef's card prints when its trade refuses, by reason. */
const CHEF_REFUSALS: Readonly<Record<ChefTradeRefusal, TranslationKey>> = {
  'no-member': 'npc.refused.noMember',
  'already-held': 'npc.chef.alreadyHeld',
  'no-berries': 'npc.chef.noBerries',
};

/** True when `tile` is inside the playable map (the border included). */
function inBounds(map: TileMap, tile: Tile): boolean {
  return tile.y >= 0 && tile.y < map.length && tile.x >= 0 && tile.x < map[0].length;
}

// Until the starter pick lands, the scene seeds a run with a fixed demo starter
// and bag and walks its routes off one dev seed.
const DEV_SEED = 'dev-seed';

const DEMO_STARTER: FighterInput = {
  id: 'starter',
  speciesId: 'charmander',
  level: 5,
  moves: ['ember', 'scratch', 'growl'],
};
const DEMO_RESERVE: FighterInput = {
  id: 'reserve',
  speciesId: 'squirtle',
  level: 4,
  moves: ['watergun', 'tackle', 'tailwhip'],
};

const DEMO_BAG: readonly BagCounts[] = [];

/** One dev wild roll: what the room's live stream handed out on a step. */
export type DebugWildRoll = Readonly<{ speciesId: string; level: number; shiny: boolean }>;

export class RouteScene extends Phaser.Scene {
  private route!: RouteMap;
  private map!: TileMap;
  /** `map` for movement: a tree's walkable tip is passable even though it draws as wall. */
  private moveMap!: TileMap;
  /** The tiles `drawTiles` renders: the live map, or a dev generator step. */
  private renderTiles!: TileMap;
  private grassTipKeys: Set<string> = new Set();
  private generatorSteps: readonly RouteStep[] = [];
  private generatorStepIndex: number | null = null;
  private encounters!: RouteEncounters;
  private tilesetId: TilesetId = 'forest';
  private player: Tile = { x: 1, y: 1 };
  private playerSprite!: Phaser.GameObjects.Sprite;
  private tileSprites: Phaser.GameObjects.Image[][][] = [];
  private entitySprites: Phaser.GameObjects.GameObject[] = [];
  /** The one sprite the player's own grass rustle draws; hidden when out of grass. */
  private grassStep: Phaser.GameObjects.Sprite | null = null;
  /** The ground items on screen, so a pickup can hide one and a rebuild clear all. */
  private itemSprites: { item: RouteItem; sprite: Phaser.GameObjects.Image }[] = [];
  /** The trainers on screen, so a win can hide one and a rebuild clear all. */
  private trainerSprites: TrainerSpriteEntry[] = [];
  /** Which facing a spinning trainer is showing, so a turn only redraws on change. */
  private trainerSpinIndex = new Map<string, number>();
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
  /** The condition the room on screen rolled, or null when it rolled none. */
  private battlefield: RoomBattlefield | null = null;
  /** The boss room's opening (arena and the boss lead's stages), or null outside it. */
  private bossOpening: BossOpeningRoll | null = null;
  /** The room's condition filter (one tinted rectangle over the room), or null. */
  private battlefieldOverlay: Phaser.GameObjects.Rectangle | null = null;
  private settings!: Settings;
  private passThrough = false;
  private hoverInspect = false;
  /** Dev only: while true the tall grass rolls no wild encounter. */
  private ignoreEncounters = false;
  /** Dev only: while true no line of sight opens a trainer battle. */
  private ignoreTrainers = false;
  private hoverCell: Tile | null = null;
  private hoverMarker: Phaser.GameObjects.Rectangle | null = null;
  private hoverLabel: Phaser.GameObjects.BitmapText | null = null;
  private gameOver = false;
  private battleCounter = 0;
  private debugMonCounter = 0;
  private pendingBattle: BattleLaunch | null = null;
  /** The movement keys behind the current bindings (arrows plus WASD), watched every frame. */
  private moveKeys!: Record<MoveKey, Phaser.Input.Keyboard.Key[]>;
  /** The run key; held while walking, it speeds the step and the walk cycle. */
  private runKey: Phaser.Input.Keyboard.Key | null = null;
  /** The hold-to-reset key; the overlay that fills while it is down is the pause panel's. */
  private resetKey: Phaser.Input.Keyboard.Key | null = null;
  /** The on-screen pad + A / B, on a touch screen only. */
  private touch: TouchControls | null = null;
  private detachBack: (() => void) | null = null;
  private facing: PlayerFacing = 'down';
  /** The last cardinal the player faced, so the interact key can look ahead. */
  private facingDir: MoveKey = 'down';
  /** The in-flight step, while the sprite slides from one tile to the next. */
  private walkTween: Phaser.Tweens.Tween | null = null;
  private followerSprite: Phaser.GameObjects.Sprite | null = null;
  private followerSheet: PokemonOverworldSheet | null = null;
  private followerSpecies: string | null = null;
  /** The follower's own in-flight step, which trails the player's by one tile. */
  private followerTween: Phaser.Tweens.Tween | null = null;
  private hudRoot!: Phaser.GameObjects.Container;
  /** The draggable panels of the HUD, in draw order (the registry's own records). */
  private hudPanels: HudPanel[] = [];
  /** The panel widths for this window, clamped to the screen (`hudMetrics`). */
  private hud!: HudMetrics;
  /** The pinned HUD camera; a rebuild must teach it to ignore the new sprites. */
  private hudCamera: Phaser.Cameras.Scene2D.Camera | null = null;
  /** The HUD's party/box grab (the shared reducer's cursor). */
  private hudUi: PartyUiState = initialPartyUi();
  /** The avatar held in hand while a party/box member or an item is dragged. */
  private hudDragGhost!: Phaser.GameObjects.Image;
  private searchKeyStamps = new Set<number>();
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
  private releaseRoot: Phaser.GameObjects.Container | null = null;
  private releaseQueue: ReleaseBeat[] = [];
  private releaseOnDone: (() => void) | null = null;
  private releaseWait: Phaser.Time.TimerEvent | null = null;
  private releaseArmed = false;
  private releasePortrait!: Phaser.GameObjects.Image;
  private releaseText!: Phaser.GameObjects.BitmapText;
  /**
   * True while `buildRoom` rebuilds the scene. A `buildRoute` runs `applyRoute`,
   * which raises the area panel for the dev frame-map import; inside a room build
   * the greeting belongs to the room entry itself (`create` / `transitionTo`), or
   * the boss-fall rebuild and the gate's rebuild would greet a room the run never
   * left.
   */
  private buildingRoom = false;

  /** The counter tile the room's own fixture placed, or null in a room without one. */
  private shopCounter: Tile | null = null;
  private npc: RoomNpc | null = null;
  /** The NPC battle in flight, so its win can pay the row's prize. Cleared on the return. */
  private npcBattle: Readonly<{ row: NpcRow; mapIndex: number; roomId: number }> | null = null;
  /** Every special room kind's descriptor, indexed once per scene (`D47`). */
  private roomRegistry: RoomRegistry = collectDescriptors(ROOM_MODULES);
  /** The route's overlay panels, indexed once per scene (`D47`'s shape). */
  private panels: PanelRegistry = collectPanels(PANEL_MODULES);
  /** The port every panel descriptor draws through, built once per scene. */
  private panelHost!: RoutePanelHost;
  /** The room's own panel while it owns the keyboard, or null; the scene owns the slot. */
  private roomPanel: RoomPanel | null = null;
  /** The room row in hand: the scene owns its ghost and resolves its drop. */
  private roomRowDrag: RoomRowDrag | null = null;
  private roomRowGhostIcon: Phaser.GameObjects.Image | null = null;
  private roomRowGhostLabel: Phaser.GameObjects.BitmapText | null = null;

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
    // The room's geometry, trainers and loot seed off a **stable** per-room
    // index, not the run's moving counter, so walking back into a room shows the
    // same room (`docs/maps-spec.md` §9). The room's battle condition reads the
    // same index, so it too is the same on every visit.
    const roomIndex = routeIndexForRoom(plan, view.roomId);
    // The boss room always takes one of its two openings (`BOSS_OPENINGS`) and heals
    // the party and the box once per floor; every other room rolls at
    // `ROOM_BATTLEFIELD_CHANCE` or not at all. Both branches assign the opening, so no
    // stale boss stage survives a room change.
    const kind = roomKindOf(view);
    if (kind === 'boss') {
      const opening = bossOpeningRoll(this.run.seed, roomIndex);
      this.battlefield = opening.battlefield;
      this.bossOpening = opening;
      const healed = bossRoomHeal(this.run, view.mapIndex);
      if (healed !== this.run) {
        this.run = healed;
        this.persistRun();
      }
    } else {
      this.battlefield = roomBattlefield(this.run.seed, roomIndex, kind);
      this.bossOpening = null;
    }
    this.buildingRoom = true;
    this.buildRoute({
      seed: this.run.seed,
      routeIndex: roomIndex,
      shape: DEFAULT_SHAPE,
      width: view.width,
      height: view.height,
      grassPatches: biome.terrain.grassPatches,
      ledges: biome.terrain.ledges,
      room: view,
    });
    this.buildingRoom = false;
    if (view.boss && !this.run.bossDefeated) {
      const boss = this.bossTrainer(view);
      if (boss) this.route = { ...this.route, trainers: [...this.route.trainers, boss] };
    }
    // A special room injects its own content, off stable ids, so a revisit rebuilds
    // it identically and a beaten mini-boss stays beaten (`docs/maps-spec.md` §7).
    // The room's own descriptor places it; the counter is cleared first, so a room
    // without one leaves nothing of the last room's behind (`D47`).
    this.shopCounter = null;
    const fixture = this.specialDescriptor()?.fixture?.(this.roomHost());
    if (fixture?.trainers) {
      this.route = { ...this.route, trainers: [...this.route.trainers, ...fixture.trainers] };
    }
    if (fixture?.items) {
      this.route = { ...this.route, items: [...this.route.items, ...fixture.items] };
    }
    if (fixture && 'counter' in fixture) this.shopCounter = fixture.counter ?? null;
    // A room's own line rides the strip once its fixture is in place (the no-heal
    // leaf announces its rule this way).
    if (fixture?.notice) this.showNotice(fixture.notice);
    this.placeSpecialTrainer(roomIndex);
    this.rollRoomNpc();
    // Last: the filter needs `this.map`, which `buildRoute` → `applyRoute` sets.
    this.buildBattlefieldOverlay();
  }

  /**
   * Overrides the room's first trainer with a special trainer when this room's own roll
   * draws one (`docs/routes-spec.md` §2). Once per build, from `buildRoom`, **before**
   * `rollRoomNpc()`; reads its own stream, so the room's route, trainers, items and the
   * floor's NPC do not move.
   */
  private placeSpecialTrainer(roomIndex: number): void {
    const room = this.room;
    if (!room) return;
    const trainer = specialTrainerFor({
      route: this.route,
      seed: this.run.seed,
      roomIndex,
      role: room.role,
      quiet: room.entry || room.boss || room.special !== null,
      missionsCompleted: this.run.missionsCompleted,
    });
    if (!trainer) return;
    this.route = {
      ...this.route,
      trainers: this.route.trainers.map((entry) => (entry.id === trainer.id ? trainer : entry)),
    };
  }

  /**
   * Places the room's special NPC (`docs/maps-spec.md` §7): at most one, only in a
   * regular `trainers` room and once per build — never in `update`. The floor's
   * **guaranteed** row is tried first (a placement, not a roll: it reads the plan and
   * no RNG), then the rolled rows on the room's own stream, so no route, trainer,
   * item or battle draw moves. A row whose art the packed sheet lacks is dropped
   * whole: no sprite, no block and no interact, and no second room is tried.
   */
  private rollRoomNpc(): void {
    this.npc = null;
    const room = this.room;
    if (!room || room.special !== null || room.role !== 'trainers') return;
    if (this.generatorStepIndex !== null) return;
    const eligible = NPC_ROWS.filter((row) => npcRequirementMet(this.run, row.requires));
    const guaranteed = guaranteedNpc(this.plan!, room.roomId, room.mapIndex);
    const placement = guaranteed
      ? { row: guaranteed, roomIndex: room.roomId }
      : roomNpc(this.run.seed, room.roomId, room.mapIndex, eligible);
    if (!placement) return;
    const tile = npcSpot(this.route, room.roomId, this.run.seed, placement.row.id);
    if (!tile) return;
    if (overworldSpriteFrame(placement.row.spriteKey) === null) return;
    this.npc = { row: placement.row, tile };
  }

  /** The descriptor for the room on screen, or null when it has none (`D47`). */
  private specialDescriptor(): RoomDescriptor | null {
    const kind = this.room?.special;
    return kind ? (this.roomRegistry.byKind.get(kind) ?? null) : null;
  }

  /** The plan room on screen; `buildRoom` sets it before any descriptor runs. */
  private get view(): RoomView {
    const room = this.room;
    if (!room) throw new Error('route scene has no plan room');
    return room;
  }

  /**
   * The port a room descriptor draws through (`D47`): the scene's own surface, with
   * `run` and `view` read live so a trade the panel commits is visible to its next
   * call. The room mutates the scene only through these methods.
   */
  private roomHost(): RoomHost {
    const scene = this;
    return {
      scene,
      get run(): RunState {
        return scene.run;
      },
      get view(): RoomView {
        return scene.view;
      },
      route: () => scene.route,
      rebuildRoom: () => scene.rebuildRoom(),
      entryTile: () => scene.route.entry,
      counterTile: () => scene.shopCounter,
      farthestRoomTile: () => scene.farthestRoomTile(),
      facingFromTo: (from, to) => scene.facingFromTo(from, to),
      generatorStepActive: () => scene.generatorStepIndex !== null,
      commitRun: (run) => scene.commitRun(run),
      // The room port still names this hook; no HUD pane holds the keyboard since
      // the route HUD went pointer-first (D45), so there is nothing to release.
      releaseHudKeyboard: () => undefined,
      openPanel: (panel) => scene.openPanel(panel),
      closePanel: () => scene.closePanel(),
      panelOpen: () => scene.panelOpen(),
      startTrainerBattle: (trainer) => scene.startTrainerBattle(trainer),
      startWildBattle: (encounter) => scene.startRoomWildBattle(encounter),
      showNotice: (notice) => scene.showNotice(notice),
      beginRowDrag: (drag) => scene.beginRowDrag(drag),
    };
  }

  /**
   * The port a route panel draws through (`D47`'s shape, one folder over): the
   * scene's own surface, with the run, the settings and the HUD metrics read live
   * so a panel always paints the current ones. A panel mutates the scene only
   * through these methods, and never writes the run itself.
   */
  private buildPanelHost(): RoutePanelHost {
    const scene = this;
    const port: RoutePanelHost = {
      scene,
      run: () => scene.run,
      settings: () => scene.settings,
      hud: () => scene.hud,
      hudRoot: () => scene.hudRoot,
      panels: () => scene.hudPanels,
      registerPanel: (panel) => {
        scene.hudPanels.push(panel);
      },
      ui: () => scene.hudUi,
      setUi: (state) => {
        scene.hudUi = state;
      },
      hudPointer: (pointer) =>
        hudPanelOwnerAt(port, pointer) === null ? null : { x: pointer.x, y: pointer.y },
      commitRun: (run) => scene.commitRun(run),
      persistRun: () => scene.persistRun(),
      refreshHud: () => scene.refreshHud(),
      persistHudLayout: () => saveHudLayout(port),
      applyStoredHudLayout: () => applyHudLayout(port),
      releaseHudKeyboard: () => undefined,
      openPanel: (panel) => scene.openPanel(panel),
      closePanel: () => scene.closePanel(),
      panelOpen: () => scene.panelOpen(),
      showNotice: (notice) => scene.showNotice(notice),
      startWildBattle: (encounter) => scene.startRoomWildBattle(encounter),
      startTrainerBattle: (trainer) => scene.startTrainerBattle(trainer),
      route: () => scene.route,
      plan: () => scene.plan,
      rooms: () => scene.roomRegistry,
      beginRowDrag: (drag) => scene.beginRowDrag(drag),
      openSettings: () => scene.openSettings(),
      restartRun: () => scene.restartRun(),
    };
    return port;
  }

  /** Sets the scene's run, persists it and repaints the HUD (a Mart trade). */
  private commitRun(run: RunState): void {
    this.run = run;
    this.persistRun();
    this.refreshHud();
  }

  /**
   * Folds the room's map passives for `trigger` into the run
   * (`src/engine/run/passives.ts`, `docs/routes-spec.md` §2). Silent — no save, no
   * repaint — when nothing paid, which the rule reports by returning the same run.
   */
  private applyMapPassives(trigger: MapPassiveTrigger): readonly PassivePickup[] {
    const { run, picks } = runPassives(this.run, trigger);
    if (picks.length === 0) return picks;
    this.run = run;
    this.persistRun();
    return picks;
  }

  /** Floats the pickup notice for each payment, in the rule's own order. */
  private showPassivePickups(picks: readonly PassivePickup[]): void {
    for (const pick of picks) {
      this.showNotice(itemPickupNotice(getItem(pick.itemId)?.name ?? pick.itemId));
    }
  }

  /** Gives the keyboard to `panel` until `closePanel()`; the scene owns the slot. */
  private openPanel(panel: RoomPanel): void {
    this.roomPanel = panel;
  }

  /** Tears the open panel down (room change, battle, run over). */
  private closePanel(): void {
    const panel = this.roomPanel;
    this.roomPanel = null;
    panel?.close();
  }

  /** True while a room's own panel owns the screen. */
  private panelOpen(): boolean {
    return this.roomPanel !== null;
  }

  /** True while a room panel is **modal**: a floating one never gates the route. */
  private modalPanelOpen(): boolean {
    return this.roomPanel !== null && this.roomPanel.modal !== false;
  }

  /**
   * Paints the room's battle condition as one tinted rectangle over the whole room.
   * The filter is static — the roll and the paint happen once per room build — and
   * the world camera keeps it while the pinned HUD camera ignores it.
   */
  private buildBattlefieldOverlay(): void {
    if (this.battlefieldOverlay) {
      this.battlefieldOverlay.destroy();
      this.battlefieldOverlay = null;
    }
    if (!this.battlefield || !this.map) return;
    const size = mapPixelSize(this.map, TILE_SIZE);
    const overlay = this.add
      .rectangle(0, 0, size.width, size.height, this.battlefield.tint, this.battlefield.alpha)
      .setOrigin(0, 0)
      .setDepth(BATTLEFIELD_DEPTH);
    this.battlefieldOverlay = overlay;
    this.hudCamera?.ignore([overlay]);
  }

  /** The portal is open once the map's boss has fallen, except on the final map (D31). */
  private portalOpen(): boolean {
    return this.run.bossDefeated && !isFinalMap(this.run.mode, this.run.mapIndex);
  }

  /**
   * The map boss: a themed `ace` trainer standing in the room's centre chamber
   * (its tile farthest from the door), fielding a fixed six-member party (three on
   * map 1) at the map's `maxLevel`. It falls back to the room's farthest walkable
   * tile when the room carved no chamber. It stands only while the map's boss is
   * alive, so the portal stays sealed until it falls.
   */
  private bossTrainer(view: RoomView): RouteTrainer | null {
    const position = bossChamberTile(this.route) ?? this.farthestRoomTile();
    if (!position) return null;
    return {
      id: bossTrainerId(view.mapIndex),
      position,
      facing: this.facingFromTo(position, this.route.entry),
      sight: DEFAULT_TRAINER_SIGHT,
      archetypeId: 'ace',
      aggro: false,
    };
  }

  /**
   * The walkable tile farthest (BFS) from the room entry, skipping tiles a
   * trainer or a visible item already owns; null when only the entry is free.
   */
  private farthestRoomTile(): Tile | null {
    const from = this.route.entry;
    const occupied = new Set<string>();
    for (const trainer of this.route.trainers)
      occupied.add(`${trainer.position.x},${trainer.position.y}`);
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
    // The room that links into the boss room carries its sign (`docs/routes-spec.md`
    // §2). The edge is derived from the plan, never from the arrival's role, so the
    // sign's cell is the same whichever door the player walked in through.
    const signEdge = this.bossLinkEdge(params.room);
    const pattern = TILESETS[biome.tilesetId].config.wallPattern;
    const wall = pattern
      ? { cols: pattern.cols, minHeight: Math.max(2, pattern.rows.length - 2) }
      : undefined;
    const band = params.room
      ? bandForMap(params.room.mapIndex)
      : runBand(this.run.seed, params.routeIndex);
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
      lootExclude: ownedTmIds(this.run),
      hiddenChance: loot.hiddenChance,
      itemChance: loot.itemChance,
      ...(params.room ? { role: params.room.role } : {}),
      trainerArchetypes: TRAINER_ARCHETYPE_IDS,
      // The map's entry, boss and special rooms are **quiet**: no tall grass, no
      // ledges, no ground items and no trainers. The entry and boss are quiet
      // (`docs/maps-spec.md` §2/§6) and a special carries only its own content
      // (§7).
      quiet: params.room ? params.room.entry || params.room.boss || params.room.special !== null : false,
      // The boss room is a two-door line (its link plus the sealed portal), so its
      // centre chamber is asked for explicitly; the entry room and every leaf read
      // theirs off the opening set (`docs/maps-spec.md` §2/§6).
      ...(params.room?.boss === true ? { chamber: true } : {}),
      ...(signEdge ? { signEdge } : {}),
      // The gated room's vault is sealed until the floor's own mark says otherwise, so a
      // revisit and a reload draw exactly what the run has (`docs/maps-spec.md` §7). The
      // static and secret-shop leaves carve the same vault and read their own records.
      ...(params.room?.special === 'gated' ||
      params.room?.special === 'static' ||
      params.room?.special === 'secret-shop'
        ? {
            gate: isItemPicked(
              this.run,
              params.room.special === 'gated'
                ? gateId(params.room.mapIndex, params.room.roomId)
                : params.room.special === 'static'
                  ? staticGateId(params.room.mapIndex, params.room.roomId)
                  : secretShopSealId(params.room.mapIndex, params.room.roomId),
            )
              ? 'open'
              : 'sealed',
          }
        : {}),
      ...(wall ? { wall } : {}),
    };
    const route = sketchRoute(request);
    this.generatorSteps = IS_DEVELOP ? sketchRouteSteps(request) : [];
    this.applyRoute(route, params.room ?? null);
  }

  /**
   * The edge of `room` whose opening leads into the boss room, or undefined when
   * the room on screen has none: the boss room itself, the floor's entry, every
   * leaf and every route built without a plan (the dev generator, a frame-map
   * import). It walks **every** opening, the boss room's portal included — the
   * portal's `roomAcross` is undefined, so only a real link can match — and never
   * filters by `role === 'exit'`: the role belongs to the arrival and flips when
   * the player walks in from the boss room, while the sign's cell must not.
   */
  private bossLinkEdge(room: RoomView | undefined): MapEdge | undefined {
    const plan = this.plan;
    if (!room || !plan) return undefined;
    for (const opening of room.openings) {
      if (roomAcross(plan, room.roomId, opening.edge) === plan.bossRoom) return opening.edge;
    }
    return undefined;
  }

  /**
   * Points the scene at an already-built route: its tiles become the live and
   * render maps, and the tileset and encounter stream follow the route's biome.
   * Both `buildRoute` and the debug frame-map import go through here so they
   * cannot drift. `view` is the plan room on screen (null for an imported map or
   * the dev generator), which carries the map band and the floor's level cap.
   */
  private applyRoute(route: RouteMap, view: RoomView | null = null): void {
    // The boss room's portal is carved from the start but sealed until the boss
    // falls, so the room looks the same before and after it opens.
    if (view?.boss && !view.portalOpen && view.portalEdge) {
      route = this.sealEdge(route, view.portalEdge);
    }
    this.route = route;
    this.map = route.tiles;
    this.renderTiles = this.map;
    this.generatorStepIndex = null;
    const biome = getBiome(route.biomeId);
    const band = view ? bandForMap(view.mapIndex) : runBand(this.run.seed, route.routeIndex);
    const cap = band.maxLevel;
    this.tilesetId = biome.tilesetId;
    this.moveMap = this.movementMap(this.map);
    this.encounters = new RouteEncounters(
      encounterTableFor(bandForLevel(squadLevel(this.run))),
      new Rng(hashSeed(`${route.seed}:encounters:${route.routeIndex}`)),
      (rng) => rollWildLevel(rng, squadLevel(this.run), cap),
      undefined,
      // Shinies roll on their own stream, so they never shift the encounter
      // sequence a fixed seed already produced.
      new Rng(hashSeed(`${route.seed}:shiny:${route.routeIndex}`)),
      wildExclusions(this.run),
      // The magician's type, so a room rebuilt from a save still obeys it.
      this.run.modifiers.nextWildType,
    );
    // The dev frame-map import reaches this seam on its own (it builds no room);
    // a route built for a room is greeted once by the room entry that asked for it.
    if (!this.buildingRoom) showAreaPanel(this.panelHost);
  }

  create(): void {
    if (!this.run) {
      this.run = createRun({ seed: DEV_SEED, starter: createRunPokemon(DEMO_STARTER), bag: DEMO_BAG });
      this.run = addPokemon(this.run, createRunPokemon(DEMO_RESERVE));
    }
    this.persistRun();
    // A restart in place (`scene.start('Route', …)`) runs `create` again over the
    // previous room's arrays, whose objects Phaser already destroyed with the
    // scene, so the stale entries must go before the rebuild (#34).
    this.tileSprites = [];
    this.entitySprites = [];
    this.itemSprites = [];
    this.grassStep = null;
    this.hudPanels = [];
    this.trainerSprites = [];
    this.trainerSpinIndex.clear();
    this.trainerFacing.clear();
    this.chase = null;
    this.hudPress = null;
    this.passThrough = false;
    this.ignoreEncounters = false;
    this.ignoreTrainers = false;
    this.clearHoverInspect();
    this.gameOver = false;
    this.pendingBattle = null;
    this.releaseRoot = null;
    this.releaseQueue = [];
    this.releaseOnDone = null;
    this.releaseWait = null;
    this.releaseArmed = false;
    this.roomPanel = null;
    this.shopCounter = null;
    this.npc = null;
    this.roomRowDrag = null;
    this.roomRowGhostIcon = null;
    this.roomRowGhostLabel = null;
    this.facing = 'down';
    this.walkTween = null;
    this.followerSprite = null;
    this.followerSheet = null;
    this.followerSpecies = null;
    this.followerTween = null;
    this.settings = loadSettings();
    this.panelHost = this.buildPanelHost();

    this.buildRoom();

    this.drawTiles();
    this.drawEntities();
    this.drawItems();
    this.drawTrainers();
    this.drawRoomFixture();
    this.player = { ...this.route.entry };
    this.playerSprite = this.add
      .sprite(0, 0, PLAYER_SPRITE_TEXTURE_KEY, playerSpriteFrame('down'))
      .setOrigin(0.5, 1)
      .setScale(TILE_SIZE / PLAYER_SPRITE_WIDTH)
      .setDepth(actorDepth(0));
    this.movePlayerTo(this.player.x, this.player.y);
    this.refreshTrainerVisibility();

    const cameraBounds = mapPixelSize(this.map, TILE_SIZE);
    this.cameras.main.setBounds(0, 0, cameraBounds.width, cameraBounds.height);
    this.cameras.main.setZoom(routeCameraZoom());
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
        // A typed `b` belongs to the nickname field, not to the debug battle.
        if (this.textFieldFocused()) return;
        if (this.scene.isActive())
          this.startBattle({ kind: 'wild', speciesId: 'scatterbug', level: 5, key: 'dev' });
      });
      this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
        this.updateHoverInspect(pointer);
      });
      this.input.on('gameout', () => this.clearHoverInspect());
    }
    // Typed text is the only keystroke the route still reads directly: the two
    // in-panel fields consume it, and the level-up popup is dismissed by any key.
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      if (!this.scene.isActive()) return;
      // Auto-repeat is ignored, so a held key never types (or pages) twice; the
      // stamp guard drops the same event when the plugin re-delivers it.
      if (event.repeat || this.searchKeyStamps.has(event.timeStamp)) return;
      this.searchKeyStamps.add(event.timeStamp);
      if (this.searchKeyStamps.size > 64) this.searchKeyStamps.clear();
      if (learnPopupOpenNow()) {
        closeLearnPopup();
        return;
      }
      // The nickname field owns the keyboard while it is focused: it consumes every
      // key, so nothing typed there reaches the game underneath.
      if (typeInNickname(this.panelHost, event)) return;
      typeInDetailSearch(this.panelHost, event);
      typeInBagSearch(this.panelHost, event);
    });
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.handleHudPointerDown(pointer));
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.handleHudPointerMove(pointer));
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.handleHudPointerUp(pointer));
    // A drag whose button is released off the canvas (or that leaves the screen)
    // must let go, or the held panel/member keeps following a pointer that is gone.
    this.input.on('pointerupoutside', () => this.cancelHudDrags());
    this.input.on('gameout', () => {
      this.cancelHudDrags();
      clearDetailInfo(this.panelHost);
    });
    // The mouse wheel flips the PC box pages while the pointer is over it, and
    // scrolls the learnset band one row at a time while it is over that instead.
    // The box is tested first, so it wins where the two rects overlap.
    this.input.on(
      'wheel',
      (pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => {
        if (!this.scene.isActive()) return;
        if (pointerInBoxPanel(this.panelHost, pointer)) {
          stepBoxPage(this.panelHost, dy > 0 ? 1 : -1);
          return;
        }
        if (pointerInLearnBand(this.panelHost, pointer)) {
          scrollLearnset(this.panelHost, dy > 0 ? 1 : -1);
        }
      },
    );
    this.hud = hudMetrics(this.scale.width);
    this.hudRoot = this.add.container(0, 0).setDepth(150);
    // The pinned camera is built against an empty root, so every panel and card the
    // folder builds next lands on the HUD camera and only there.
    this.setupHudCamera();
    // The overlay registry is emptied before anything registers into it, and the
    // drag ghost is booked first, so `finishHud` adds it to the root at rank 0 —
    // above the panels' containers, below the learnset chip and the bag's card.
    resetHudOverlays();
    this.hudDragGhost = this.add.image(0, 0, PORTRAIT_TEXTURE_KEY, 0).setScale(0.9).setVisible(false);
    registerHudOverlay(this.hudDragGhost, 0);
    for (const panel of this.panels.all) panel.build(this.panelHost);
    finishHud(this.panelHost);
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
    // A stopped scene hands every panel its own teardown, in build order. Every
    // object a shipped panel owns already lives in the HUD root or a screen-space
    // root that Phaser destroys with the scene, so no panel needs a `close` today;
    // the walk is here so a later panel that owns something else has the hook.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const panel of this.panels.all) panel.close?.(this.panelHost);
    });
    // A battle pauses the route mid-walk; drop the pad's held direction so the
    // player does not keep stepping the moment the route comes back, and give up
    // an in-progress nickname edit rather than resuming into a focused field.
    this.events.on(Phaser.Scenes.Events.PAUSE, () => {
      this.touch?.release();
      cancelNicknameEdit(this.panelHost);
    });
    // The battle above took the music channel; the route takes it back.
    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      this.touch?.release();
      playMusic(this, 'route-music');
    });
    this.refreshHud();
    // The first room's greeting: the `applyRoute` of `buildRoom` ran before the
    // panel existed, so the banner is raised here instead.
    showAreaPanel(this.panelHost);
    refreshDetail(this.panelHost);
    playMusic(this, 'route-music');
  }

  /**
   * The player's intent behind one shared action, whatever drove it: a key from
   * the map or the on-screen A / B. While the pause menu is up it owns the input.
   */
  private handleAction(action: KeybindAction): void {
    if (!this.scene.isActive()) return;
    // The learnset search field and the nickname field own the keyboard while
    // either holds focus.
    if (this.textFieldFocused()) return;
    // The level-up popup is dismissed by any input.
    if (learnPopupOpenNow()) {
      closeLearnPopup();
      return;
    }
    // A room's own **modal** panel owns the input while it is open; the floating
    // Mart and the reward take no key, so the route's quick keys keep working.
    if (this.roomPanel && this.roomPanel.modal !== false) {
      this.roomPanel.handle?.(action);
      return;
    }
    if (pauseMenuOpenNow()) {
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
      case 'cancel':
        this.showPauseMenu();
        return;
      case 'party':
        this.toggleHudPanel('party');
        return;
      case 'bag':
        this.toggleHudPanel('bag');
        return;
      case 'map':
        this.toggleHudPanel('header');
        return;
      case 'box':
        this.toggleHudPanel('box');
        return;
      case 'settings':
        this.openSettings();
        return;
    }
  }

  /**
   * Opens or collapses the HUD panel a quick key points at, exactly as a click on
   * its collapse icon does. Ignored while another overlay (the pause menu, a
   * release beat) owns the input.
   *
   * A quick key is a plain toggle (D45): it never takes the keyboard, so the
   * arrows keep walking the route while a pane is open.
   */
  private toggleHudPanel(id: HudPanelId): void {
    if (this.gameOver || this.pendingBattle || this.releaseRoot || pauseMenuOpenNow()) return;
    togglePanelById(this.panelHost, id);
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
   * Repaints every panel from the run, in registry order, and keeps the party's
   * follower in step with its lead. One place decides the sequence, so a panel can
   * never paint out of order or half-way.
   */
  private refreshHud(): void {
    if (!this.hudRoot) return;
    for (const panel of this.panels.all) panel.refresh?.(this.panelHost);
    // The party's lead walks behind the player: a lead change loads its pair once
    // and rebuilds the follower, so nothing here runs per frame.
    this.refreshFollower();
  }

  /** True while any in-panel text field owns the keyboard. */
  private textFieldFocused(): boolean {
    return detailTextFieldFocused() || bagTextFieldFocused();
  }

  /**
   * HUD pointer input. A press goes to the panel layer first — every descriptor
   * whose panel owns the point — and only then runs the scene's own drag path: a
   * click on a party row or a box cell opens that member's detail panel (STATS /
   * MOVES), dragging instead picks the member up and reorders it live, and a
   * release over the other pane moves it between the party and the PC box. A press
   * on an equipment stack (or on a member's held badge) takes the item in hand.
   */
  private handleHudPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.scene.isActive()) return;
    // A room row's own press starts its drag; nothing under it sees the press.
    if (this.roomRowDrag) return;
    // A modal room panel's own zones own the pointer while it is up.
    if (this.modalPanelOpen()) return;
    // The level-up popup is modal: a click just dismisses it.
    if (learnPopupOpenNow()) {
      closeLearnPopup();
      return;
    }
    setPointerPhase('down');
    const panels = this.panels.all;
    for (let i = panels.length - 1; i >= 0; i--) {
      if (panels[i].pointer?.(this.panelHost, pointer) === true) return;
    }
    this.pressHudDrags(pointer);
  }

  /**
   * The scene's own drag path: what a press picks up once no panel control took it.
   * A stack (or a held badge) goes in hand, a member's row defers its grab until
   * the pointer moves, and a panel's empty interior moves that panel.
   */
  private pressHudDrags(pointer: Phaser.Input.Pointer): void {
    if (!this.hudUi.grabbed) {
      const badge = this.hudHeldBadgeAt(pointer);
      if (badge) {
        this.startHudItemDrag(badge.itemId, pointer, badge.memberId);
        return;
      }
      const itemId = hudDraggableStackAt(this.panelHost, pointer);
      if (itemId !== null) {
        this.startHudItemDrag(itemId, pointer);
        return;
      }
    }
    const target = this.hudTarget(pointer);
    const grabbed = this.hudUi.grabbed;
    if (!target) {
      if (grabbed) {
        this.dropHudGrab();
        return;
      }
      // Nothing interactive under the pointer: grab the panel's empty interior to
      // move it. The open detail is kept when its own empty space is grabbed, and
      // closed when the press is anywhere else.
      const owner = hudPanelOwnerAt(this.panelHost, pointer);
      if (owner?.id !== 'detail' && detailOpen()) closeMemberDetail(this.panelHost);
      if (owner && owner.expanded) {
        startPanelDrag(this.panelHost, owner, pointer);
        return;
      }
      return;
    }
    if (detailOpen()) closeMemberDetail(this.panelHost);
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
    this.hudPress = {
      pane: target.pane,
      index: target.index,
      memberId,
      originX: pointer.x,
      originY: pointer.y,
    };
    this.input.setDefaultCursor('pointer');
  }

  /**
   * The party or box/rip member whose held-item badge is under the pointer, if
   * any. Grabbing a badge picks the item up instead of the Pokémon, so it can be
   * moved to another member or dropped on the bag to unequip it.
   */
  private hudHeldBadgeAt(pointer: Phaser.Input.Pointer): { itemId: string; memberId: string } | null {
    const target = this.hudTarget(pointer);
    if (!target || target.pane === 'rip') return null;
    const member = paneMembers(this.panelHost, target.pane)[target.index];
    const itemId = member?.fighter.heldItem;
    if (!member || !itemId) return null;
    const badge = target.pane === 'party' ? partyHeldBadge(target.index) : boxHeldBadge(target.index);
    if (!badge || !badge.visible) return null;
    const point = panelPoint(this.panelHost, pointer, target.pane);
    const radius = Math.max(badge.displayWidth, badge.displayHeight) / 2;
    if (Math.hypot(point.x - badge.x, point.y - badge.y) > radius) return null;
    return { itemId, memberId: member.fighter.id };
  }

  /** Shows the grabbed member's avatar in hand, following the pointer. */
  private showHudGhost(pane: PaneId, index: number, pointer: Phaser.Input.Pointer): void {
    const member = paneMembers(this.panelHost, pane)[index];
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

  /**
   * Picks an equipment stack up so it can be dropped on a member to equip it: the
   * icon rides the pointer and leaves the bag list while in hand.
   */
  private startHudItemDrag(
    itemId: string,
    pointer: Phaser.Input.Pointer,
    from: string | null = null,
  ): void {
    const frame = itemIconFrame(itemId);
    if (frame === null) return;
    setDraggedItem(itemId, from);
    setGrabMoved(false);
    this.hudDragGhost
      .setTexture(ITEM_ICON_TEXTURE_KEY, frame)
      .setPosition(pointer.x, pointer.y)
      .setVisible(true);
    this.input.setDefaultCursor('grabbing');
    this.refreshHud();
  }

  /**
   * Starts a room row's drag (`D45`): the item icon or the row's own printed label
   * follows the pointer and the scene resolves the drop. A row never buys on press.
   */
  private beginRowDrag(drag: RoomRowDrag): void {
    this.endRowDrag();
    this.roomRowDrag = drag;
    this.ensureRowDragGhost();
    const frame = drag.itemId === null ? null : itemIconFrame(drag.itemId);
    if (frame !== null && this.roomRowGhostIcon) {
      this.roomRowGhostIcon.setFrame(frame).setPosition(drag.pointer.x, drag.pointer.y).setVisible(true);
      this.roomRowGhostLabel?.setVisible(false);
    } else {
      this.roomRowGhostIcon?.setVisible(false);
      this.roomRowGhostLabel
        ?.setPosition(drag.pointer.x, drag.pointer.y)
        .setText(drag.label)
        .setVisible(true);
    }
    this.input.setDefaultCursor('grabbing');
  }

  /** The two ghost objects, built once and reused by every room row drag. */
  private ensureRowDragGhost(): void {
    if (!this.roomRowGhostIcon) {
      this.roomRowGhostIcon = this.add
        .image(0, 0, ITEM_ICON_TEXTURE_KEY, 0)
        .setDepth(ROW_DRAG_DEPTH)
        .setVisible(false);
      this.cameras.main.ignore(this.roomRowGhostIcon);
    }
    if (!this.roomRowGhostLabel) {
      this.roomRowGhostLabel = addFrlgText(this, 0, 0, '', {
        size: 16,
        tint: FRLG_INK,
        origin: [0.5, 0.5],
      })
        .setDepth(ROW_DRAG_DEPTH)
        .setVisible(false);
      this.cameras.main.ignore(this.roomRowGhostLabel);
    }
  }

  /** Puts the ghost away and restores the cursor; says nothing about the drop. */
  private endRowDrag(): void {
    if (!this.roomRowDrag) return;
    this.roomRowDrag = null;
    this.roomRowGhostIcon?.setVisible(false);
    this.roomRowGhostLabel?.setVisible(false);
    this.input.setDefaultCursor('default');
  }

  /** Resolves a released row and calls its `onDrop` exactly once. */
  private dropRowDrag(pointer: Phaser.Input.Pointer): void {
    const drag = this.roomRowDrag;
    if (!drag) return;
    const drop = this.roomDropAt(pointer, drag);
    this.endRowDrag();
    drag.onDrop(drop);
  }

  /** The bag, a living party/box member, the party panel for a Pokémon row, or none. */
  private roomDropAt(pointer: Phaser.Input.Pointer, drag: RoomRowDrag): RoomDrop {
    if (pointerInBagPanel(this.panelHost, pointer)) return { onto: 'bag' };
    const target = this.hudTarget(pointer);
    const memberId = target && target.pane !== 'rip' ? this.memberIdAt(target) : null;
    if (memberId) return { onto: 'member', memberId };
    if (drag.itemId === null && pointerInPartyPanel(this.panelHost, pointer)) return { onto: 'party' };
    return { onto: 'none' };
  }

  private handleHudPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.scene.isActive()) return;
    // A room row in hand follows the pointer; the release decides its drop.
    if (this.roomRowDrag) {
      if (!pointer.isDown) {
        this.endRowDrag();
        return;
      }
      this.roomRowGhostIcon?.setPosition(pointer.x, pointer.y);
      this.roomRowGhostLabel?.setPosition(pointer.x, pointer.y);
      this.input.setDefaultCursor('grabbing');
      return;
    }
    if (learnPopupOpenNow() || this.modalPanelOpen()) return;
    // A button released off-screen never fired `pointerup`; let go on the next move.
    if (!pointer.isDown) this.cancelHudDrags();
    setPointerPhase('move');
    const panels = this.panels.all;
    for (let i = panels.length - 1; i >= 0; i--) {
      if (panels[i].pointer?.(this.panelHost, pointer) === true) return;
    }
    this.moveHudDrags(pointer);
  }

  /** The scene's own drags: the item in hand, the member press and its grab. */
  private moveHudDrags(pointer: Phaser.Input.Pointer): void {
    if (draggedItemId() !== null) {
      this.hudDragGhost.setPosition(pointer.x, pointer.y);
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
      this.hudPress = null;
      if (!next.ui.grabbed) {
        this.input.setDefaultCursor('default');
        return;
      }
      this.run = next.run;
      this.hudUi = next.ui;
      setGrabMoved(true);
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
    this.updateHudCursor(pointer);
  }

  /**
   * The hover cursor: the route's own hint at what a press would do under the
   * pointer. A panel reads its own controls; the frame layer reads the frames.
   */
  private updateHudCursor(pointer: Phaser.Input.Pointer): void {
    const overMember = this.hudTarget(pointer) !== null;
    const hover = detailHover(this.panelHost, pointer);
    const overItem = hudDraggableStackAt(this.panelHost, pointer) !== null;
    const overIcon = hudPanelIconAt(this.panelHost, pointer) !== null;
    // The Pokevial only reads as clickable with a full meter; a partial one does
    // nothing on click.
    const overVial =
      this.run.pokevialCharges >= POKEVIAL_MAX_CHARGES && vialButtonAt(this.panelHost, pointer);
    const overPanel =
      overMember || hover.overMove || overItem || hover.overEvolution || overVial
        ? false
        : hudPanelAt(this.panelHost, pointer) !== null;
    this.input.setDefaultCursor(
      hover.overInfo ||
        hover.overAbilityInfo ||
        overMember ||
        overIcon ||
        hover.overEvolution ||
        hover.overDetailName ||
        overVial
        ? 'pointer'
        : overItem || hover.overMove
          ? 'grab'
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
    if (this.roomRowDrag) {
      this.endRowDrag();
      return;
    }
    if (cancelPanelDrag(this.panelHost)) return;
    if (cancelDetailDrags(this.panelHost)) return;
    if (draggedItemId() !== null) {
      this.endHudItemDrag();
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
    // A room row's release resolves its drop before any panel gate: the Mart and
    // the reward are floating, so their rows work while they are open.
    if (this.roomRowDrag) {
      this.dropRowDrag(pointer);
      return;
    }
    if (learnPopupOpenNow()) {
      dismissLearnPopup(this.panelHost);
      return;
    }
    if (this.modalPanelOpen()) {
      this.cancelHudDrags();
      return;
    }
    setPointerPhase('up');
    const panels = this.panels.all;
    for (let i = panels.length - 1; i >= 0; i--) {
      if (panels[i].pointer?.(this.panelHost, pointer) === true) return;
    }
    this.releaseHudDrags(pointer);
  }

  /** Lands the scene's own drags: the item in hand, the press and the member. */
  private releaseHudDrags(pointer: Phaser.Input.Pointer): void {
    const itemId = draggedItemId();
    if (itemId !== null) {
      const from = draggedItemFrom();
      const target = this.hudTarget(pointer);
      const intoBag = pointerInBagPanel(this.panelHost, pointer);
      // The dead are not a drop target: a badge released on RIP goes back on its member.
      const targetId = target && target.pane !== 'rip' ? this.memberIdAt(target) : null;
      this.endHudItemDrag();
      if (targetId) {
        if (from === null) {
          const item = getItem(itemId);
          if (item && (item.kind === 'heal' || item.kind === 'status')) {
            const next = useItemOn(this.run, targetId, itemId);
            if (next !== this.run) {
              this.run = next;
              this.persistRun();
              this.refreshHud();
              this.showNotice(itemUsedNotice(item.name));
            }
          } else {
            this.equipHudItem(itemId, target);
          }
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
    // A member pressed and released without moving is a click: open its detail.
    if (this.hudPress) {
      const memberId = this.hudPress.memberId;
      this.hudPress = null;
      openMemberDetail(this.panelHost, memberId);
      return;
    }
    const grabbed = this.hudUi.grabbed;
    // A drag dropped over the other pane moves the member across; a drop on one
    // of its members swaps the two instead (so a full party can still take a
    // boxed member); otherwise it just drops where it last pointed. There is no
    // cancel.
    if (!grabbed || !grabMoved()) return;
    const across =
      grabbed.pane === 'party'
        ? pointerInBoxPanel(this.panelHost, pointer)
        : pointerInPartyPanel(this.panelHost, pointer);
    if (across) this.dropHudAcross(grabbed, this.hudTarget(pointer));
    else this.dropHudGrab();
  }

  /** Equips the dragged stack to the member under the drop, saving the swap. */
  private equipHudItem(itemId: string, target: { pane: PaneId; index: number } | null): void {
    if (!target) return;
    if (target.pane === 'rip') return;
    const member = paneMembers(this.panelHost, target.pane)[target.index];
    if (!member) return;
    const next = equipHeldItem(this.run, member.fighter.id, itemId);
    if (next === this.run) return;
    this.run = next;
    this.persistRun();
    this.refreshHud();
  }

  /** The id of the member at `target`, or null if that slot is empty. */
  private memberIdAt(target: { pane: PaneId; index: number }): string | null {
    const member = paneMembers(this.panelHost, target.pane)[target.index];
    return member?.fighter.id ?? null;
  }

  /** Puts the dragged stack down and clears the in-hand state. */
  private endHudItemDrag(): void {
    setDraggedItem(null, null);
    setGrabMoved(false);
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
  private dropHudAcross(
    grabbed: { pane: PaneId },
    target: { pane: PaneId; index: number } | null,
  ): void {
    if (target && target.pane !== grabbed.pane && target.pane !== 'rip') {
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
    setGrabMoved(false);
    this.hudDragGhost.setVisible(false);
    this.persistRun();
    this.refreshHud();
  }

  /** The party row or box/rip cell under the pointer, or null. */
  private hudTarget(pointer: Phaser.Input.Pointer): { pane: PaneId; index: number } | null {
    const row = hudPartyRowAt(this.panelHost, pointer);
    if (row !== null) return { pane: 'party', index: row };
    const cell = hudBoxCellAt(this.panelHost, pointer);
    if (cell !== null) return { pane: this.hudUi.pane === 'rip' ? 'rip' : 'box', index: cell };
    return null;
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
   * Advances the hold-to-reset progress while the key is down, or fades back in.
   * The overlay itself is the pause panel's; the scene owns whether the hold is
   * allowed and what a finished hold does.
   */
  private updateReset(delta: number): void {
    const allowed =
      !this.gameOver &&
      !this.pendingBattle &&
      !this.releaseRoot &&
      !this.modalPanelOpen() &&
      !pauseMenuOpenNow() &&
      // A held `R` while typing a name must not fill the ring and restart the run.
      !this.textFieldFocused() &&
      this.resetKey?.isDown === true;
    if (updateResetOverlay(this.panelHost, delta, allowed)) this.restartRun();
  }

  /** Starts a brand-new run with a fresh seed (nothing carries over). */
  private restartRun(): void {
    hideResetOverlay(this.panelHost);
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
    if (
      grassFrame !== undefined &&
      grassFrame !== config.frames[FLOOR] &&
      this.grassTipKeys.has(`${x},${y}`)
    ) {
      frames.push({ source: 'atlas', frame: grassFrame });
    }
    const frame = resolveTileFrame(this.renderTiles, x, y, config, true);
    if (frame && (frame.source !== ground.source || frame.frame !== ground.frame)) frames.push(frame);
    return frames;
  }

  /**
   * Returns `route` with its border opening on `edge` walled off, used to keep the
   * boss room's portal **sealed** until the boss falls. The interior lane that led
   * to it stays, ending at the solid border.
   */
  private sealEdge(route: RouteMap, edge: MapEdge): RouteMap {
    const tiles = route.tiles.map((row, y) =>
      row.map((value, x) =>
        borderEdge({ x, y }, route.width, route.height) === edge && value === FLOOR ? WALL : value,
      ),
    );
    return { ...route, tiles };
  }

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
    const config = TILESETS[this.tilesetId].config;
    // The player's own grass rustle: one hidden sprite, parked and played by
    // `refreshGrassStep` / `playGrassRustle` on the tile they occupy. It cycles the
    // field's own rustle frames when the tileset declares them and draws the
    // procedural tuft at one frame otherwise (`grassRustleFrames`).
    const rustle = grassRustleFrames(config);
    const rest = rustle[0];
    const step =
      rest === undefined
        ? this.add.sprite(0, 0, GRASS_TEXTURE_KEY)
        : this.add.sprite(0, 0, tilesetTextureKey(this.tilesetId), rest);
    step
      .setOrigin(0.5, 1) // was the default centre anchor
      .setScale(rest === undefined ? 1 : this.tileScale('atlas'))
      .setDepth(GRASS_STEP_DEPTH)
      .setTint(config.grassRustleTint ?? 0xffffff)
      .setVisible(false);
    // The atlas art's own first blade row is 6 on the parked cell but 0 on the closing one, so
    // the overlay is clipped to the cell's rows 6-15: no frame of the beat ever draws above the
    // player's hips (`docs/tileset-spec.md` §6). The procedural 24px tuft keeps its whole art.
    if (rest !== undefined) step.setCrop(0, 6, 16, 10);
    this.grassStep = step;
    this.entitySprites.push(step);
    created.push(step);
    // The FRLG fields draw tall grass as a real ground tile, so the procedural
    // tuft overlay is only for tilesets that still fall back to plain ground.
    const overlayGrass = config.frames[TALL_GRASS] === config.frames[FLOOR];
    if (!overlayGrass) {
      this.hudCamera?.ignore(created);
      return;
    }
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
   * Poke Ball, like the originals; a hidden one is the biome's own floor patch
   * (`hiddenItemFrame`), drawn exactly as the ground under it — same texture,
   * same cell, same scale — so only its frame gives it away up close. Items
   * already taken stay hidden. Only the live route has items, so a dev generator
   * phase draws none.
   */
  private drawItems(): void {
    if (this.generatorStepIndex !== null) return;
    const config = TILESETS[this.tilesetId].config;
    const created: Phaser.GameObjects.GameObject[] = [];
    for (const item of this.route.items) {
      const taken = isItemPicked(this.run, item.id);
      const sprite = item.hidden
        ? this.add
            .image(
              this.centerX(item.position.x),
              this.centerY(item.position.y),
              tilesetTextureKey(this.tilesetId),
              hiddenItemFrame(config),
            )
            .setScale(TILE_SIZE / config.atlas.tileSize)
            .setVisible(!taken)
            .setDepth(5)
        : this.add
            .image(this.centerX(item.position.x), this.centerY(item.position.y), GROUND_ITEM_TEXTURE_KEY)
            .setScale(1.5)
            .setVisible(!taken)
            .setDepth(5);
      this.itemSprites.push({ item, sprite });
      this.entitySprites.push(sprite);
      created.push(sprite);
    }
    this.hudCamera?.ignore(created);
    // The signs ride the same draw pass as the items on purpose: `drawItems` is the
    // last draw every rebuild runs (`create`, `transitionTo`, `rebuildRoom` and the
    // two debug rebuilds), so ending it here keeps the sign on screen everywhere.
    this.drawSigns();
  }

  /**
   * Draws the room's static signs (`docs/routes-spec.md` §2) on their cells: the
   * boss door's sign is one image of the 16x16 FRLG prop, scaled up to the 24px
   * world tile. A dev generator phase draws none, the same way it draws no items.
   */
  private drawSigns(): void {
    if (this.generatorStepIndex !== null) return;
    const created: Phaser.GameObjects.GameObject[] = [];
    for (const sign of this.route.signs ?? []) {
      const sprite = this.add
        .image(this.centerX(sign.x), this.centerY(sign.y), PROP_SIGN_TEXTURE_KEY, PROP_SIGN_FRAME)
        .setScale(TILE_SIZE / PROP_SIGN_SIZE)
        .setDepth(5);
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
    for (const trainer of this.route.trainers) this.drawTrainer(trainer, created);
    this.drawRoomNpc(created);
    this.hudCamera?.ignore(created);
  }

  /** Draws one trainer's sprite (the body of `drawTrainers`' loop), booking it into `created`. */
  private drawTrainer(trainer: RouteTrainer, created: Phaser.GameObjects.GameObject[]): void {
    if (isTrainerDefeated(this.run, trainer.id)) return;
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
            .sprite(
              this.centerX(trainer.position.x),
              this.centerY(trainer.position.y),
              TRAINER_TEXTURE_KEY,
            )
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

  /** Shows or hides every drawn trainer's sprite through the pure `trainerHidden` rule. */
  private refreshTrainerVisibility(): void {
    for (const entry of this.trainerSprites) {
      entry.sprite.setVisible(
        !trainerHidden(
          getTrainerArchetype(entry.trainer.archetypeId),
          entry.trainer.position,
          this.player,
        ),
      );
    }
  }

  /**
   * Draws the room's special NPC on its own free tile, off the packed overworld
   * atlas exactly as a trainer sprite is drawn. It never joins `trainerSprites`: it
   * has no sight, no spin, no chase and no roster.
   */
  private drawRoomNpc(created: Phaser.GameObjects.GameObject[]): void {
    const npc = this.npc;
    if (!npc) return;
    const frame = overworldSpriteFrame(npc.row.spriteKey);
    if (frame === null) return;
    const footY = this.centerY(npc.tile.y) + TILE_SIZE / 2;
    const sprite = this.add
      .sprite(this.centerX(npc.tile.x), footY, OVERWORLD_SPRITE_TEXTURE_KEY, frame)
      .setOrigin(0.5, 1)
      .setScale(TILE_SIZE / OVERWORLD_SPRITE_WIDTH)
      .setDepth(actorDepth(footY));
    this.entitySprites.push(sprite);
    created.push(sprite);
  }

  /**
   * Draws the room's own fixture, whatever kind it is (`D47`): the room's
   * descriptor creates the objects, and the scene books them into the route's
   * teardown list and keeps the pinned HUD camera off them.
   */
  private drawRoomFixture(): void {
    const descriptor = this.specialDescriptor();
    if (!descriptor?.drawFixture) return;
    const before = this.children.list.length;
    descriptor.drawFixture(this.roomHost());
    const created = this.children.list.slice(before);
    if (created.length === 0) return;
    for (const sprite of created) this.entitySprites.push(sprite);
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

  /** Snaps the sprite to a tile, without a step. */
  private movePlayerTo(x: number, y: number): void {
    this.player = { x, y };
    // The 16x32 FRLG frame stands with its feet on the tile's bottom edge, the
    // same placement the route's trainers use.
    this.playerSprite.setPosition(this.centerX(x), this.centerY(y) + TILE_SIZE / 2);
    this.playerSprite.setDepth(actorDepth(this.playerSprite.y));
    // A snap (a room change, a debug teleport) leaves the follower on the player's
    // own tile; it only trails once a step is taken.
    this.placeFollower(this.player.x, this.player.y);
    this.refreshGrassStep();
  }

  /** Parks the follower on a tile with no step, idling, when it has a sprite. */
  private placeFollower(tileX: number, tileY: number): void {
    const sprite = this.followerSprite;
    if (!sprite) return;
    sprite.setPosition(this.centerX(tileX), this.centerY(tileY) + TILE_SIZE / 2);
    sprite.setDepth(actorDepth(sprite.y));
    this.restFollower();
  }

  /**
   * Paints the player's own tall-grass rustle on the one sprite `drawEntities`
   * built: parked on the rest frame on the tile they occupy, hidden the moment they
   * leave the grass, so no other cell ever animates. Called from `movePlayerTo` and
   * the end of every step tween, never per frame.
   */
  private refreshGrassStep(): void {
    const sprite = this.grassStep;
    if (!sprite) return;
    sprite.anims.stop();
    if (!isGrassStepTile(this.map, this.player.x, this.player.y, this.grassTipKeys)) {
      sprite.setVisible(false);
      return;
    }
    const frames = grassRustleFrames(TILESETS[this.tilesetId].config);
    sprite
      .setPosition(this.centerX(this.player.x), this.centerY(this.player.y) + TILE_SIZE / 2)
      .setVisible(true);
    if (frames.length > 0) sprite.setFrame(frames[0]);
  }

  /**
   * The hit, once per step: the field's own rustle frames in order (`frames[1]` on),
   * `GRASS_STEP_MS` apart, then back to the rest frame the sequence parks on. The
   * cycle is a Phaser animation built once per sequence, so a beat costs no
   * allocation and nothing drives the sprite while the player stands still.
   */
  private playGrassRustle(): void {
    const sprite = this.grassStep;
    if (!sprite) return;
    const frames = grassRustleFrames(TILESETS[this.tilesetId].config);
    if (frames.length < 2) return;
    const key = `grass-rustle:${sprite.texture.key}:${frames.join('-')}`;
    if (!this.anims.exists(key)) {
      this.anims.create({
        key,
        frames: [...frames.slice(1), frames[0]].map((frame) => ({ key: sprite.texture.key, frame })),
        frameRate: 1000 / GRASS_STEP_MS,
        repeat: 0,
      });
    }
    sprite.anims.play(key);
  }

  /** Turns the sprite to face a direction, flipping the left-facing side frame. */
  private face(direction: MoveKey): void {
    this.facingDir = direction;
    this.facing = direction === 'up' ? 'up' : direction === 'down' ? 'down' : 'side';
    this.playerSprite.setFlipX(direction === 'right');
    this.followerSprite?.setFlipX(direction === 'right');
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
        this.refreshGrassStep();
        this.onTileEntered(direction);
      },
    });
    // The follower trails by exactly one tile: it steps onto the tile the player is
    // leaving, on the player's own cadence and run factor, so the two land together.
    this.followStep(running);
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
    this.restFollower();
  }

  /**
   * Keeps the follower in step with the party's lead: the pair is resolved and
   * loaded once per lead species, so a lead change pays one load and a re-lead
   * costs none. Called from `refreshHud`, never per frame.
   */
  private refreshFollower(): void {
    const leadId: string | null = this.run.party.length > 0 ? this.run.party[0].fighter.speciesId : null;
    if (leadId === this.followerSpecies) return;
    // A load already in flight must finish first: returning here keeps the guard
    // unconsumed, so the next HUD repaint retries and a lead change is not lost.
    if (this.load.isLoading()) return;
    const sheet = leadId === null ? null : pokemonOverworldSheet(leadId);
    if (sheet && !this.textures.exists(sheet.textureKey)) {
      this.queueFollowerLoad(sheet);
      return;
    }
    this.followerSpecies = leadId;
    this.buildFollower(sheet);
  }

  /** Queues a pair's spritesheet and builds the follower once the loader completes. */
  private queueFollowerLoad(sheet: PokemonOverworldSheet): void {
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.followerSpecies = sheet.speciesId;
      this.buildFollower(sheet);
    });
    this.load.spritesheet(sheet.textureKey, sheet.url, {
      frameWidth: sheet.size,
      frameHeight: sheet.size,
    });
    // A loader only starts itself inside a scene's `preload`, so a queue built at
    // run time (a lead change) is started by hand.
    this.load.start();
  }

  /**
   * Builds the follower sprite for a pair, snapped to the player's own tile, or
   * clears it for a lead the manifest carries no art for. The texture is
   * registered once per file id and the strips once per key, so a re-lead is free.
   */
  private buildFollower(sheet: PokemonOverworldSheet | null): void {
    this.destroyFollower();
    this.followerSheet = sheet;
    if (!sheet) return;
    this.registerFollowerAnims(sheet);
    const footY = this.centerY(this.player.y) + TILE_SIZE / 2;
    const sprite = this.add
      .sprite(this.centerX(this.player.x), footY, sheet.textureKey, 0)
      .setOrigin(0.5, 1)
      .setScale(TILE_SIZE / sheet.size)
      .setDepth(actorDepth(footY))
      .setFlipX(this.facingDir === 'right');
    this.followerSprite = sprite;
    this.entitySprites.push(sprite);
    this.hudCamera?.ignore([sprite]);
    this.restFollower();
  }

  /** Registers a pair's idle and walk strips, once per animation key. */
  private registerFollowerAnims(sheet: PokemonOverworldSheet): void {
    for (const anim of followerAnims(sheet)) {
      if (this.anims.exists(anim.key)) continue;
      this.anims.create({
        key: anim.key,
        frames: anim.frames.map((frame) => ({ key: sheet.textureKey, frame })),
        frameRate: anim.frameRate,
        repeat: anim.repeat,
      });
    }
  }

  /** Drops the follower sprite and its in-flight step, leaving the texture loaded. */
  private destroyFollower(): void {
    this.followerTween?.remove();
    this.followerTween = null;
    this.followerSprite?.destroy();
    this.followerSprite = null;
  }

  /**
   * Steps the follower onto the tile the player is leaving, over the player's own
   * step duration and at its run factor, so the two tweens start and end together.
   */
  private followStep(running: boolean): void {
    const sprite = this.followerSprite;
    const sheet = this.followerSheet;
    if (!sprite || !sheet) return;
    const key = followerAnimKey(sheet, this.facing, 'walk');
    sprite.anims.timeScale = playerWalkTimeScale(running, WALK_STEP_MS, RUN_STEP_MS);
    if (this.anims.exists(key)) sprite.play(key, true);
    this.followerTween?.remove();
    this.followerTween = this.tweens.add({
      targets: sprite,
      x: this.centerX(this.player.x),
      y: this.centerY(this.player.y) + TILE_SIZE / 2,
      duration: running ? RUN_STEP_MS : WALK_STEP_MS,
      ease: 'Linear',
      onComplete: () => {
        this.followerTween = null;
      },
    });
  }

  /**
   * Plays the follower's facing's looping idle strip, so it breathes while it stands
   * with the player. The strip is a loop, so re-entering rest does not restart it and
   * the walk path's run factor is dropped back to normal speed.
   */
  private restFollower(): void {
    const sprite = this.followerSprite;
    const sheet = this.followerSheet;
    if (!sprite || !sheet) return;
    sprite.anims.timeScale = 1;
    const key = followerAnimKey(sheet, this.facing, 'idle');
    if (this.anims.exists(key)) sprite.play(key, true);
  }

  private onTileEntered(direction: MoveKey): void {
    // A step re-paints the hidden archetypes' sprites before anything else: a
    // battle this step opens must not leave them drawn.
    this.refreshTrainerVisibility();
    // A door on the border changes room (or steps through the open portal).
    if (this.tryLeaveRoom(direction)) return;
    const grassy = isGrassStepTile(this.map, this.player.x, this.player.y, this.grassTipKeys);
    if (grassy && !this.ignoreEncounters) {
      // A step that lands in the grass plays the field's own rustle once.
      this.playGrassRustle();
      const encounter = this.encounters.step();
      if (encounter) {
        // A wild roll that actually happened spends the magician's type, so the
        // next grass step rolls the whole band again (`docs/routes-spec.md` §3).
        if (this.run.modifiers.nextWildType !== null) {
          this.run = { ...this.run, modifiers: withoutNextWildType(this.run.modifiers) };
          this.encounters.setTypeFilter(null);
          this.persistRun();
        }
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
   * open portal crosses to the next map (`advanceMap`, with its heal stop). Only a
   * step taken **toward** the border counts, so walking along the gap of a wide
   * opening (or spawning on it) never bounces back. The arrival door counts too,
   * so a room can always be walked back. The dev generator/import tools have no
   * plan, so they never transition.
   */
  private tryLeaveRoom(direction: MoveKey): boolean {
    const room = this.room;
    const plan = this.plan;
    if (!room || !plan) return false;
    const edge = this.doorEdgeAt(this.player, direction);
    if (!edge) return false;
    // The boss room's only door is the way in, and it stays barred while the boss
    // stands (`docs/maps-spec.md` §6): the step is not a room change, so nothing is
    // committed, persisted or re-rolled.
    if (bossRoomSealed(room.boss, this.run.bossDefeated)) return false;
    if (room.portalEdge !== null && room.portalOpen && edge === room.portalEdge) {
      const before = this.run;
      const advanced = advanceMap(before);
      const hatch = hatchEgg(advanced);
      const afterAdvance = hatch ? hatch.run : advanced;
      this.transitionTo(afterAdvance);
      const met = missionCompletedBy(before, afterAdvance);
      // One notice at a time, and the hatch is the rarer beat.
      if (hatch) this.showNotice(eggHatchNotice(this.memberName(hatch.member)));
      else if (met) this.showNotice(missionCompleteNotice(t(met.nameKey)));
      return true;
    }
    const next = roomAcross(plan, room.roomId, edge);
    if (next === undefined) return false;
    // Leave by `edge`, arrive by its opposite (`docs/maps-spec.md` §2).
    this.transitionTo(advanceRoute(this.run, next, OPPOSITE_EDGE[edge]));
    return true;
  }

  /**
   * The map edge a **door** cell exits through: a passable tile of the room's
   * opening on that edge (an opening is a gap a couple of tiles wide, so the player
   * can leave from any of its cells), when the step that landed on it was taken
   * toward that border. A wall, a decorative tree tip on the border or a step
   * along the gap is not a door. Null for a non-border cell.
   */
  private doorEdgeAt(tile: Tile, direction: MoveKey): MapEdge | null {
    const approach = MOVE_STEP[direction];
    const approachEdge = approach.x > 0 ? 'E' : approach.x < 0 ? 'W' : approach.y > 0 ? 'S' : 'N';
    const room = this.room;
    if (room) {
      const edges = room.openings.map((opening) => opening.edge);
      return exitEdgeAt(this.map, this.route.width, this.route.height, edges, tile, approachEdge);
    }
    // No plan (the dev generator/import tools): the seeded tiles are the only guide.
    const edge = borderEdge(tile, this.route.width, this.route.height);
    if (!edge || edge !== approachEdge) return null;
    const isDoor =
      (this.route.entry.x === tile.x && this.route.entry.y === tile.y) ||
      this.route.exits.some((exit) => exit.x === tile.x && exit.y === tile.y);
    return isDoor ? edge : null;
  }

  /**
   * Rebuilds the scene for the room the run just entered: build the plan room,
   * redraw its tiles, items and trainers and spawn the player on its entry tile.
   * The run's state already carries the new map position.
   */
  private transitionTo(run: RunState, options?: TransitionOptions): void {
    const fromRoom = this.room;
    const fromMap = this.run.mapIndex;
    const tile = { x: this.player.x, y: this.player.y };
    this.run = run;
    this.persistRun();
    this.stopWalking();
    this.closePanel();
    // The reward card is floating, so a player who walks out with it up must not
    // carry it into the next room; closing runs its stored callback exactly once.
    this.closeMiniBossReward();
    this.clearRouteSprites();
    this.buildRoom();
    this.drawTiles();
    this.drawEntities();
    this.drawItems();
    this.drawTrainers();
    this.drawRoomFixture();
    this.player = options?.keepPosition === true ? tile : { ...this.route.entry };
    this.movePlayerTo(this.player.x, this.player.y);
    this.refreshTrainerVisibility();
    const bounds = mapPixelSize(this.map, TILE_SIZE);
    this.cameras.main.setBounds(0, 0, bounds.width, bounds.height);
    const picks = this.applyMapPassives('room');
    this.showPassivePickups(picks);
    this.refreshHud();
    // One room entry, one banner: the boss-fall rebuild is the same room with its
    // portal now open, so it greets nobody, while every door and the portal do.
    const entered = !fromRoom || fromMap !== this.run.mapIndex || fromRoom.roomId !== this.room?.roomId;
    if (entered) showAreaPanel(this.panelHost);
  }

  /**
   * Redraws the room it is standing in after the run changed something the build reads
   * (the gate's opening): the room's build re-reads the `gate` flag, the player keeps
   * their tile and the room's **live** encounter sequence is carried over, so reopening
   * a seal can never restart the room's grass rolls.
   */
  private rebuildRoom(): void {
    if (!this.room) return;
    const tile = { x: this.player.x, y: this.player.y };
    const encounters = this.encounters;
    this.clearRouteSprites();
    this.buildRoom();
    this.encounters = encounters;
    this.drawTiles();
    this.drawEntities();
    this.drawItems();
    this.drawTrainers();
    this.drawRoomFixture();
    this.player = tile;
    this.movePlayerTo(tile.x, tile.y);
    this.refreshTrainerVisibility();
    this.refreshHud();
  }

  /**
   * Removes a beaten trainer's sprite and bookkeeping from the live route, so it
   * is never iterated again (a spinner's turn, a chase). Idempotent.
   */
  private removeTrainerSprite(trainerId: string): void {
    const index = this.trainerSprites.findIndex((entry) => entry.trainer.id === trainerId);
    if (index < 0) return;
    const [entry] = this.trainerSprites.splice(index, 1);
    this.tweens.killTweensOf(entry.sprite);
    const entityIndex = this.entitySprites.indexOf(entry.sprite);
    if (entityIndex >= 0) this.entitySprites.splice(entityIndex, 1);
    entry.sprite.destroy();
    this.trainerSpinIndex.delete(trainerId);
    this.trainerFacing.delete(trainerId);
  }

  /** The first undefeated trainer whose line of sight holds the player. */
  private trainerSpotted(): RouteTrainer | null {
    if (this.ignoreTrainers) return null;
    for (const trainer of this.route.trainers) {
      if (isTrainerDefeated(this.run, trainer.id)) continue;
      if (seesPlayer(this.route, this.effectiveTrainer(trainer), this.player, this.moveMap))
        return trainer;
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

  /** True when `tile` is the counter a room's fixture placed (a blocking fixture). */
  private shopCounterAt(tile: Tile): boolean {
    return this.shopCounter !== null && tile.x === this.shopCounter.x && tile.y === this.shopCounter.y;
  }

  /** True when the room's live special NPC stands on `tile`, so it blocks like an object. */
  private npcBlocks(tile: Tile): boolean {
    return this.npc !== null && tile.x === this.npc.tile.x && tile.y === this.npc.tile.y;
  }

  /** True when a static sign stands on `tile`, so it blocks like a fixture. */
  private signBlocks(tile: Tile): boolean {
    return (this.route.signs ?? []).some((sign) => sign.x === tile.x && sign.y === tile.y);
  }

  /**
   * Starts the classic "spotted you" beat: the trainer faces the player and
   * walks toward them tile by tile, then the battle opens. The player's input is
   * frozen while it happens, so the chase plays out like the originals.
   */
  private beginChase(trainer: RouteTrainer): void {
    if (this.chase || this.pendingBattle || this.gameOver) return;
    if (isTrainerDefeated(this.run, trainer.id)) return;
    const entry = this.trainerSprites.find((candidate) => candidate.trainer.id === trainer.id);
    if (!entry) {
      this.startTrainerBattle(trainer);
      return;
    }
    // Re-paint the sprites for the player's tile, then force the chased one on
    // screen: a ninja must be visible while it dashes in.
    this.refreshTrainerVisibility();
    entry.sprite.setVisible(true);
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
    const adjacent = Math.abs(here.x - this.player.x) + Math.abs(here.y - this.player.y) <= 1;
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
        ? [
            { x: Math.sign(dx), y: 0 },
            { x: 0, y: Math.sign(dy) },
          ]
        : [
            { x: 0, y: Math.sign(dy) },
            { x: Math.sign(dx), y: 0 },
          ];
    for (const step of order) {
      if (step.x === 0 && step.y === 0) continue;
      const next = { x: from.x + step.x, y: from.y + step.y };
      if (Math.abs(next.x - target.x) + Math.abs(next.y - target.y) >= Math.abs(dx) + Math.abs(dy)) {
        continue;
      }
      if (!inBounds(this.moveMap, next) || !isWalkable(this.moveMap, next)) continue;
      if (this.itemBlocks(next) || this.signBlocks(next)) continue;
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
    if (isTrainerDefeated(this.run, trainer.id)) return;
    const archetype = getTrainerArchetype(trainer.archetypeId);
    if (!archetype) return;
    const band = this.room
      ? bandForMap(this.room.mapIndex)
      : runBand(this.run.seed, this.route.routeIndex);
    const mapIndex = this.room ? this.room.mapIndex : null;
    const isBoss = mapIndex !== null && trainer.id === bossTrainerId(mapIndex);
    const isMiniBoss = mapIndex !== null && trainer.id === miniBossTrainerId(mapIndex);
    const kind: BossPartyKind | null = isBoss ? 'boss' : isMiniBoss ? 'miniboss' : null;
    // The map boss fields a fixed max-level party (six, three on map 1) and the
    // mini-boss a fixed band-level party (three, two on map 1), both allowed a Mega
    // Stone; a regular trainer keeps its band's size (`src/data/bosses.ts`).
    const rosterBand = isBoss ? { ...band, minLevel: band.maxLevel } : band;
    const key =
      isBoss && this.room
        ? `${this.run.seed}:boss:${this.room.mapIndex}`
        : isMiniBoss && this.room
          ? `${this.run.seed}:miniboss:${this.room.mapIndex}`
          : `${this.run.seed}:trainer:${this.route.routeIndex}:${trainer.id}`;
    const roster = trainerRoster(rosterBand, new Rng(hashSeed(key)), trainer.id, {
      allowMega: isBoss || isMiniBoss || archetype.carriesMega === true,
      boss: isBoss || isMiniBoss,
      ...(kind !== null && mapIndex !== null ? { count: bossPartySize(kind, mapIndex) } : {}),
      // A regular trainer's level is a percentage of the live squad level by its own
      // party size, capped at the floor's ceiling (`docs/maps-spec.md` §5, D35); the
      // boss and the mini-boss keep the band draw they shipped with.
      ...(kind === null
        ? { levelFor: (size: number) => trainerLevel(squadLevel(this.run), size, band.maxLevel) }
        : {}),
    });
    const roomKey = this.room ? `room:${this.room.roomId}` : '';
    this.startBattle(
      {
        kind: 'trainer',
        trainerId: trainer.id,
        trainerName: archetype.name,
        roster: withForcedAbility(roster, archetype),
        archetypeId: archetype.id,
      },
      {
        ...(kind !== null && mapIndex !== null
          ? { double: bossIsDouble(kind, this.run.seed, mapIndex, roomKey) }
          : {}),
      },
    );
  }

  /** Opens a room's own wild battle through the shipped wild path (`startBattle`). */
  private startRoomWildBattle(encounter: RoomWildBattle): void {
    this.startBattle({
      kind: 'wild',
      speciesId: encounter.speciesId,
      level: encounter.level,
      key: encounter.key,
    });
  }

  /** Fields the row's own trainer where the NPC stands (the Mega Stone keeper). */
  private startNpcBattle(row: NpcRow, mapIndex: number, roomId: number): void {
    const battle = row.battle;
    const tile = this.npc?.tile;
    if (!battle || !tile) return;
    this.npcBattle = { row, mapIndex, roomId };
    this.startTrainerBattle({
      id: npcTrainerId(mapIndex, roomId, row.id),
      position: tile,
      facing: 'S',
      sight: DEFAULT_TRAINER_SIGHT,
      archetypeId: battle.archetypeId,
    });
    if (!this.pendingBattle) this.npcBattle = null;
  }

  /**
   * The interact key (`E` by default): take the ground item the player faces, or
   * the one underfoot. Hidden items show only a faint sparkle, so this is how
   * they are found. Ignored while a battle or a beat owns the screen.
   */
  private tryInteract(): void {
    if (this.gameOver || this.pendingBattle || this.releaseRoot) return;
    const step = MOVE_STEP[this.facingDir];
    const ahead = { x: this.player.x + step.x, y: this.player.y + step.y };
    // A room that answers the interact key (a casino machine, a trade counter)
    // consumes it first.
    if (this.specialDescriptor()?.interact?.(this.roomHost(), ahead) === true) return;
    // The room's own special NPC answers next, before any trainer's sight.
    if (this.talkToNpc(ahead)) return;
    // The boss door's sign answers next, and its card carries no choice (`LEAVE`).
    if (this.talkToSign(ahead) || this.talkToSign(this.player)) return;
    // Talking to a trainer it is facing also opens the battle, like the originals.
    const trainer = this.liveTrainerAt(ahead);
    if (trainer) {
      this.startTrainerBattle(trainer);
      return;
    }
    if (!this.collectItemAt(ahead)) this.collectItemAt(this.player);
  }

  /**
   * Opens the special NPC's card when the player faces it, consuming the key.
   * False when no NPC stands there, so the key falls through to the trainer and
   * the ground-item checks unchanged.
   */
  private talkToNpc(tile: Tile): boolean {
    const npc = this.npc;
    if (!npc || npc.tile.x !== tile.x || npc.tile.y !== tile.y) return false;
    if (!this.panelOpen()) this.openNpcCard(npc);
    return true;
  }

  /**
   * Opens a static sign's card when the player faces it (or stands on it, which the
   * blocker already prevents), consuming the key. The card is the NPC card with no
   * choice: its title is the sign's own i18n key resolved **now**, so a locale
   * switch shows the new string. False when no sign stands there, so the key falls
   * through to the trainer and the ground-item checks unchanged.
   */
  private talkToSign(tile: Tile): boolean {
    const sign = (this.route.signs ?? []).find(
      (candidate) => candidate.x === tile.x && candidate.y === tile.y,
    );
    if (!sign) return false;
    if (!this.panelOpen()) {
      this.openNpcCardView({ title: t(sign.text as TranslationKey), paragraph: '' });
    }
    return true;
  }

  /**
   * Opens one NPC's card: its name, its greeting and its own rows plus `LEAVE`.
   * A one-shot row already used on this floor prints `npc.used` instead and offers
   * no choices, so only `LEAVE` remains; a `repeatable` row (the merchant) always
   * answers again. The **Team Rocket** grunt is the exception: it raises no card at
   * all and opens its slot machine straight away, so the interact key is one press.
   */
  private openNpcCard(npc: RoomNpc): void {
    const room = this.room;
    if (!room) return;
    if (npc.row.id === 'rocket') {
      openRocket(this.roomHost(), npc.tile);
      return;
    }
    const used =
      npc.row.repeatable !== true &&
      isItemPicked(this.run, npcUseId(room.mapIndex, room.roomId, npc.row.id));
    const choices = used
      ? []
      : (npc.row.choices ?? []).map((choice) => ({ id: choice.id, label: t(choice.label) }));
    this.openNpcCardView(
      {
        title: t(npc.row.nameKey),
        paragraph: used ? t('npc.used') : t(npc.row.greetingKey),
        choices,
      },
      (choiceId) => this.chooseNpc(npc.row, room.mapIndex, room.roomId, choiceId),
    );
  }

  /**
   * Opens one `npcPanel` card and keeps the scene's keyboard slot coherent: the
   * shell closes itself after firing a choice, and on `LEAVE` or `cancel` it closes
   * without one, so the slot is cleared on those too (`close()` is idempotent).
   */
  private openNpcCardView(view: NpcPanelView, onChoose?: (id: string) => void): void {
    let chosen = false;
    const panel = openNpcPanel(this, view, (id) => {
      chosen = true;
      onChoose?.(id);
    });
    this.openPanel({
      handle: (action) => {
        chosen = false;
        panel.handle(action);
        if (!chosen && (action === 'confirm' || action === 'interact' || action === 'cancel')) {
          this.closePanel();
        }
      },
      close: () => panel.close(),
    });
  }

  /**
   * Resolves the row the card accepted (`docs/maps-spec.md` §7). The **merchant**
   * opens the Mart and marks no use, so the merchant is there for the rest of the
   * floor; the **Team Rocket** grunt never reaches this switch, because its machine
   * opens straight from `openNpcCard`; the tutor opens its move card, the four
   * re-rolls open the member card and the sacrifice draws its own member. The four
   * run-modifier rows each commit one fact — the curse, the forced sky, the narrowed
   * wild type or the gate's item — beside their use mark. Every other row records
   * `npc-<mapIndex>-<roomId>-<id>` in `pickedItems`, which `advanceMap` clears, so a
   * revisit and a reload know the card was taken.
   */
  private chooseNpc(row: NpcRow, mapIndex: number, roomId: number, _choiceId: string): void {
    switch (row.id) {
      case 'merchant':
        this.closePanel();
        openMart(this.roomHost());
        return;
      case 'tutor':
        this.closePanel();
        this.openTutorMoves(row, mapIndex, roomId);
        return;
      case 'nature':
      case 'ability':
      case 'iv-judge':
      case 'species':
        this.closePanel();
        this.openMemberCard(row, mapIndex, roomId, null);
        return;
      case 'sacrifice':
        this.closePanel();
        this.applyMemberEdit(row, mapIndex, roomId, sacrifice(this.run, this.npcContext(row, roomId)));
        return;
      case 'exorcist':
        this.commitNpcModifiers(
          row,
          mapIndex,
          roomId,
          withCurse(this.run.modifiers),
          t('npc.exorcist.done'),
        );
        return;
      case 'weather-man': {
        const field = npcForcedField(this.run.seed, roomId, row.id);
        this.commitNpcModifiers(
          row,
          mapIndex,
          roomId,
          withForcedField(this.run.modifiers, field.id),
          t('npc.weather.done', { floors: FORCED_FIELD_FLOORS }),
        );
        return;
      }
      case 'magician': {
        const typeId = npcWildType(this.run.seed, roomId, row.id);
        // The room on screen obeys the new type at once, so the card's promise is
        // true before the next room rebuild reads the saved modifier.
        this.encounters.setTypeFilter(typeId);
        this.commitNpcModifiers(
          row,
          mapIndex,
          roomId,
          withNextWildType(this.run.modifiers, typeId),
          t('npc.magician.done', { type: this.typeName(typeId) }),
        );
        return;
      }
      case 'type-gate': {
        const grant = row.grant;
        if (!grant) return;
        if (!partyHasType(this.run, grant.types)) {
          this.showNpcResult(row, t('npc.gate.refused'));
          return;
        }
        this.commitNpcResult(
          row,
          mapIndex,
          roomId,
          addItem(this.run, grant.itemId, 1),
          t('npc.gate.granted', { item: getItem(grant.itemId)?.name ?? grant.itemId }),
        );
        return;
      }
      case 'medic': {
        const healed = medicHeal(this.run, mapIndex, roomId);
        this.closePanel();
        this.commitRun(healed);
        this.showNpcResult(row, t('npc.medic.done'));
        return;
      }
      case 'chef':
        this.closePanel();
        this.openMemberCard(row, mapIndex, roomId, null);
        return;
      case 'berry-tree': {
        const berries = npcBerryHarvest(this.run.seed, roomId, row.id);
        let run = this.run;
        for (const berry of berries) run = addItem(run, berry);
        run = markItemPicked(run, npcUseId(mapIndex, roomId, row.id));
        this.closePanel();
        this.commitRun(run);
        const band = bandForMap(mapIndex);
        const wild = npcTreeWild(run.seed, roomId, row.id, this.encounters.currentTable(), (rng) =>
          rollWildLevel(rng, squadLevel(run), band.maxLevel),
        );
        if (wild) {
          this.startBattle(
            {
              kind: 'wild',
              speciesId: wild.speciesId,
              level: wild.level,
              shiny: wild.shiny,
              key: `npc:${roomId}:${row.id}`,
            },
            { noFlee: true, enemyBoosts: BERRY_TREE_ENEMY_BOOSTS },
          );
        }
        return;
      }
      case 'mega-stone':
        this.closePanel();
        this.startNpcBattle(row, mapIndex, roomId);
        return;
      default:
        this.commitRun(markItemPicked(this.run, npcUseId(mapIndex, roomId, row.id)));
        this.closePanel();
    }
  }

  /** The room's own stream context, shared by every member-edit operation. */
  private npcContext(row: NpcRow, roomId: number): Readonly<{ roomIndex: number; npcId: string }> {
    return { roomIndex: roomId, npcId: row.id };
  }

  /** The tutor's move card: `TUTOR_MOVES` in table order, each name from the dex. */
  private openTutorMoves(row: NpcRow, mapIndex: number, roomId: number): void {
    this.openNpcCardView(
      {
        title: t(row.nameKey),
        paragraph: t(row.greetingKey),
        choices: TUTOR_MOVES.map((moveId) => ({
          id: moveId,
          label: getMove(moveId)?.name ?? moveId,
        })),
      },
      (moveId) => {
        this.closePanel();
        this.openMemberCard(row, mapIndex, roomId, moveId);
      },
    );
  }

  /**
   * The member card: the party only (never the box), one row per member. `moveId`
   * is the tutored move the tutor carried here; the other rows ignore it.
   */
  private openMemberCard(row: NpcRow, mapIndex: number, roomId: number, moveId: string | null): void {
    const members = this.run.party.slice(0, NPC_MAX_CHOICES);
    this.openNpcCardView(
      {
        title: t(row.nameKey),
        paragraph: t('npc.pickMember'),
        choices: members.map((member) => ({
          id: member.fighter.id,
          label: t('party.rowLabel', {
            name: this.memberName(member),
            level: member.fighter.level,
            status: '',
          }),
        })),
      },
      (memberId) => {
        this.closePanel();
        this.chooseMember(row, mapIndex, roomId, memberId, moveId);
      },
    );
  }

  /**
   * Applies the row's edit to the picked member, or opens the tutor's slot card
   * first when the member already holds four moves.
   */
  private chooseMember(
    row: NpcRow,
    mapIndex: number,
    roomId: number,
    memberId: string,
    moveId: string | null,
  ): void {
    const ctx = this.npcContext(row, roomId);
    const member = this.run.party.find((entry) => entry.fighter.id === memberId);
    if (!member) return;
    switch (row.id) {
      case 'tutor': {
        const move = moveId ?? '';
        if (member.fighter.moves.length >= MAX_MOVES) {
          this.openSlotCard(row, mapIndex, roomId, memberId, move);
          return;
        }
        this.applyMemberEdit(row, mapIndex, roomId, teachMove(this.run, memberId, move, null));
        return;
      }
      case 'nature':
        this.applyMemberEdit(row, mapIndex, roomId, rerollNature(this.run, memberId, ctx));
        return;
      case 'ability':
        this.applyMemberEdit(row, mapIndex, roomId, rerollAbility(this.run, memberId, ctx));
        return;
      case 'iv-judge':
        this.applyMemberEdit(row, mapIndex, roomId, rerollIvs(this.run, memberId, ctx));
        return;
      case 'species':
        this.applyMemberEdit(row, mapIndex, roomId, swapSpecies(this.run, memberId, ctx));
        return;
      case 'chef': {
        const trade = chefTrade(this.run, memberId);
        if (!trade.ok) {
          this.showNpcResult(row, t(CHEF_REFUSALS[trade.reason]));
          return;
        }
        const holder = this.memberById(trade.memberId);
        const name = holder ? this.memberName(holder) : t('common.unknownPokemon');
        this.commitRun(markItemPicked(trade.run, npcUseId(mapIndex, roomId, row.id)));
        this.showNpcResult(
          row,
          t('npc.chef.done', { name, item: getItem(trade.dishId)?.name ?? trade.dishId }),
        );
        return;
      }
      default:
        return;
    }
  }

  /** The tutor's four rows, when the member must forget one to hold the new move. */
  private openSlotCard(
    row: NpcRow,
    mapIndex: number,
    roomId: number,
    memberId: string,
    moveId: string,
  ): void {
    const member = this.run.party.find((entry) => entry.fighter.id === memberId);
    if (!member) return;
    const slots = member.fighter.moves.slice(0, MAX_MOVES);
    this.openNpcCardView(
      {
        title: t(row.nameKey),
        paragraph: t('npc.pickSlot'),
        choices: slots.map((slot, index) => ({
          id: String(index),
          label: getMove(slot.moveId)?.name ?? slot.moveId,
        })),
      },
      (choiceId) => {
        this.closePanel();
        const slot = Number.parseInt(choiceId, 10);
        this.applyMemberEdit(
          row,
          mapIndex,
          roomId,
          teachMove(this.run, memberId, moveId, Number.isInteger(slot) ? slot : null),
        );
      },
    );
  }

  /**
   * Commits a successful edit **plus** its use mark in one write, marks nothing on a
   * refusal, and prints the result or the refusal on the row's card.
   */
  private applyMemberEdit(row: NpcRow, mapIndex: number, roomId: number, edit: MemberEdit): void {
    if (!edit.ok) {
      this.showNpcResult(row, t(NPC_REFUSALS[edit.reason]));
      return;
    }
    const edited = this.memberById(edit.memberId);
    const name = edited ? this.memberName(edited) : t('common.unknownPokemon');
    this.commitRun(markItemPicked(edit.run, npcUseId(mapIndex, roomId, row.id)));
    this.showNpcResult(row, this.memberEditParagraph(edit.line, name));
  }

  /** The result card: the row's name as its title and one line, no choices. */
  private showNpcResult(row: NpcRow, paragraph: string): void {
    this.openNpcCardView({ title: t(row.nameKey), paragraph, choices: [] });
  }

  /**
   * Commits one run fact **plus** its use mark in one write and prints the row's
   * result card, so a modifier row leaves exactly one run write behind on its floor.
   */
  private commitNpcResult(
    row: NpcRow,
    mapIndex: number,
    roomId: number,
    run: RunState,
    paragraph: string,
  ): void {
    this.commitRun(markItemPicked(run, npcUseId(mapIndex, roomId, row.id)));
    this.showNpcResult(row, paragraph);
  }

  /** The same commit, for a row whose one fact is the run's `modifiers` record. */
  private commitNpcModifiers(
    row: NpcRow,
    mapIndex: number,
    roomId: number,
    modifiers: RunModifiers,
    paragraph: string,
  ): void {
    this.commitNpcResult(row, mapIndex, roomId, { ...this.run, modifiers }, paragraph);
  }

  /** The dex's own English name for a normalized type id, or the id itself. */
  private typeName(typeId: string): string {
    return TYPE_NAMES.find((name) => normalizeId(name) === typeId) ?? typeId;
  }

  /** The party or box member `memberId` names, in the run **before** the edit. */
  private memberById(memberId: string): RunPokemon | undefined {
    return (
      this.run.party.find((entry) => entry.fighter.id === memberId) ??
      this.run.box.find((entry) => entry.fighter.id === memberId)
    );
  }

  /** One `MemberEditLine` as the sentence the result card prints; names come from the dex. */
  private memberEditParagraph(line: MemberEditLine, name: string): string {
    switch (line.kind) {
      case 'tutor':
        return t('npc.result.tutor', {
          name,
          move: getMove(line.moveId)?.name ?? line.moveId,
        });
      case 'nature':
        return t('npc.result.nature', { name, nature: capitalize(line.nature) });
      case 'ability':
        return t('npc.result.ability', { name, ability: line.ability });
      case 'secondAbility':
        return t('npc.result.secondAbility', { name, ability: line.ability });
      case 'ivs':
        return t('npc.result.ivs', { name });
      case 'species':
        return t('npc.result.species', {
          name,
          species: getSpecies(line.speciesId)?.name ?? line.speciesId,
        });
      case 'sacrifice':
        return t('npc.result.sacrifice', {
          name,
          item: getItem(line.itemId)?.name ?? line.itemId,
          result: this.memberEditParagraph(line.reward, name),
        });
    }
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
    this.showNotice(itemPickupNotice(getItem(item.itemId)?.name ?? item.itemId));
    const sprite = this.itemSprites.find((entry) => entry.item.id === item.id);
    if (sprite) {
      this.tweens.killTweensOf(sprite.sprite);
      sprite.sprite.setVisible(false).setAlpha(0);
    }
    this.refreshHud();
    return true;
  }

  /** Opens the settings screen paused-on-top, like a battle (`Tab`). */
  private openSettings(): void {
    if (this.gameOver || this.pendingBattle || this.releaseRoot) return;
    this.scene.pause();
    this.scene.launch('Settings', { from: 'Route' });
  }

  /** Floats one transient notice through the route HUD's own strip. */
  private showNotice(notice: Notice): void {
    showPanelNotice(this.panelHost, notice);
  }

  /** The display name a notice uses: nickname, else species, the way `partyRow` reads it. */
  private memberName(member: RunPokemon): string {
    return (
      member.fighter.nickname ?? getSpecies(member.fighter.speciesId)?.name ?? member.fighter.speciesId
    );
  }

  /** Opens the pause menu: the route stops walking and gives up its text fields. */
  private showPauseMenu(): void {
    if (this.gameOver || this.pendingBattle || this.releaseRoot) return;
    this.settleMovement();
    this.touch?.release();
    openPauseMenu(this.panelHost);
  }

  /** The phone's Back gesture: closes the pause menu, or opens it when closed. */
  private onBackGesture(): void {
    if (!this.scene.isActive()) return;
    if (pauseMenuOpenNow()) closePauseMenu();
    else this.showPauseMenu();
  }

  /**
   * The pause menu's own key router. Its rows run the scene's own Settings screen
   * and the fresh-run restart, so the scene applies what the menu asked for.
   */
  private handlePauseMenuAction(action: KeybindAction): void {
    this.panels.byId.get('pause')?.key?.(this.panelHost, action);
  }

  /**
   * Called by `SettingsScene` before it closes: re-reads the preferences and
   * applies what changed (a rebind re-resolves the movement keys, and the
   * Transparent HUD option redraws the panels).
   */
  applySettings(): void {
    this.settings = loadSettings();
    // A rebind happened behind this screen; re-resolve the movement keys so the
    // new keys are live the moment the route resumes.
    this.refreshMoveKeys();
    refreshPanelKeyLabels(this.panelHost);
    // The Transparent HUD option may have changed.
    applyHudBackground(this.panelHost);
  }

  /** Pauses the route and rolls the battle on top of it (Phase 5 transition). */
  private startBattle(trigger: BattleTrigger, extras: BattleExtras = {}): void {
    if (this.gameOver || this.pendingBattle || this.releaseRoot) return;
    this.battleCounter += 1;
    const key =
      trigger.kind === 'wild' ? `${trigger.key}:${this.battleCounter}` : `trainer:${trigger.trainerId}`;
    // The room's capture is spent the moment its **first wild battle** starts,
    // whatever the outcome: catching, defeating or fleeing all close the window, so
    // only the first wild Pokémon that appears can be caught. The battle still
    // allows the catch (the flag is read before spending) and the route HUD and
    // minimap mark the room spent as soon as it is back.
    const captureAllowed = canCapture(this.run);
    const firstCatch = this.run.stats.catches === 0;
    if (trigger.kind === 'wild') {
      this.run = useCapture(this.run);
      this.persistRun();
    }
    const launch: BattleLaunch = {
      trigger,
      player: this.run.party.map((member) => member.fighter),
      xp: this.run.xp,
      bag: this.run.bag,
      seed: battleSeed(this.run.seed, this.run.routeIndex, key),
      runSeed: this.run.seed,
      routeIndex: this.run.routeIndex,
      canCapture: captureAllowed,
      firstCatch,
      // The difficulty the battle's AI reads from the launch (D46): the settings
      // are re-read whenever the options screen closes, so a change reaches the
      // next battle.
      aiLevel: this.settings.aiLevel,
      // The room's own condition, so every battle that starts here — trainers,
      // the boss and wilds alike — begins under it (`docs/maps-spec.md` §7). A sky
      // the weather man pinned replaces it for the floors it still covers.
      battlefield: this.forcedBattlefield() ?? this.battlefield,
      // The no-heal leaf's rule rides the launch too, so its trainer's battle and
      // any dev wild opened in the room both carry it.
      noHeal: this.room?.special === 'no-heal',
      // Whether this fight fields two actives per side is the fight's own roll
      // (`src/data/bosses.ts`), carried here through `BattleExtras`; every other
      // room's battles stay single.
      ...(extras.double === true ? { double: true } : {}),
      // The banned-species leaf's rule rides the launch the same way: every battle
      // the room opens bars the party's most-used species from being sent out.
      bannedSpecies: this.room?.special === 'banned' ? bannedSpeciesOf(this.run) : null,
      // The berry tree's guardian forbids the flight (`runAway.ts`), unless an
      // escape effect (Run Away, the Smoke Ball) grants it.
      ...(extras.noFlee ? { noFlee: true } : {}),
      // The exorcist's hex, the boss room's opening and the guardian's own boost are
      // separate data rows on purpose: their keys never collide (atk, spe and def),
      // so the spread needs no arithmetic.
      ...(extras.enemyBoosts || this.bossOpening || this.run.modifiers.curse
        ? {
            enemyBoosts: {
              ...(extras.enemyBoosts ?? {}),
              ...(this.bossOpening?.boosts ?? {}),
              ...(this.run.modifiers.curse ? CURSE_ENEMY_BOOST : {}),
            },
          }
        : {}),
    };
    if (this.run.modifiers.curse) {
      this.run = { ...this.run, modifiers: withoutCurse(this.run.modifiers) };
      this.persistRun();
    }
    this.pendingBattle = launch;
    this.scene.pause();
    this.scene.launch('Battle', launch);
  }

  /**
   * The condition a battle starts under when the run carries a forced sky: the
   * modifier's id resolved through `ROOM_BATTLEFIELDS`, or null for no sky and for
   * an id the table does not know.
   */
  private forcedBattlefield(): RoomBattlefield | null {
    const id = forcedFieldId(this.run.modifiers);
    if (id === null) return null;
    return ROOM_BATTLEFIELDS.find((row) => row.id === id) ?? null;
  }

  /**
   * Dev only: opens a battle against a chosen wild Pokémon from the debug menu.
   * Ignored while the route is paused behind another battle or the run is over.
   */
  startDebugWildBattle(speciesId: string, level: number): void {
    if (!IS_DEVELOP || this.gameOver || this.pendingBattle || this.releaseRoot || !this.scene.isActive())
      return;
    this.startBattle({ kind: 'wild', speciesId, level, key: `debug:${speciesId}` });
  }

  /**
   * Dev only: the condition filter the route is drawing for the room on screen — the
   * row it was rolled from and the tint/alpha the live overlay itself was painted
   * with — or null when the room rolled no condition.
   */
  debugBattlefieldOverlay(): Readonly<{
    id: RoomConditionId;
    kind: RoomConditionKind;
    tint: number;
    alpha: number;
    visible: boolean;
  }> | null {
    if (!IS_DEVELOP || !this.battlefield || !this.battlefieldOverlay) return null;
    return {
      id: this.battlefield.id,
      kind: this.battlefield.kind,
      tint: this.battlefieldOverlay.fillColor,
      alpha: this.battlefieldOverlay.fillAlpha,
      visible: this.battlefieldOverlay.visible,
    };
  }

  /**
   * Dev only: the bag grid as drawn, in canvas (pointer) coordinates. Null when
   * there is no live run.
   */
  bagDebugState(): BagGridDebugState | null {
    if (!IS_DEVELOP || !this.run || !this.hudRoot) return null;
    return bagStateOf(this.panelHost);
  }

  /**
   * Dev only: drops a chosen Pokémon into the run. It joins the party while
   * there is room and the PC box after that (the capture rule), then the save
   * and the HUD follow. Returns where it landed, or null with no live run.
   */
  addDebugPokemon(speciesId: string, level: number): 'party' | 'box' | null {
    if (!IS_DEVELOP || !this.run || this.gameOver) return null;
    // The counter resets on a reload, so scan the live ids to stay unique: a
    // duplicate would make the editor and `updatePokemon` hit several members.
    const used = [...this.run.party, ...this.run.box].map((member) => member.fighter.id);
    const { id, counter } = nextDebugPokemonId(speciesId, used, this.debugMonCounter);
    this.debugMonCounter = counter;
    // The squad shares one level, so the new member joins at that level rather
    // than the requested one; the dev level editor moves the whole squad.
    const pokemon = adoptAtLevel(
      createRunPokemon({
        id,
        speciesId,
        level,
        learnsetSeed: this.run.seed,
      }),
      squadLevel(this.run),
      this.run.seed,
    );
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
   * Dev only: rolls `count` wild encounters off the room's live stream, skipping
   * the chance misses and advancing that stream. Returns them in roll order, or
   * nothing with no live run, a finished run or no room on screen.
   */
  debugRollWildEncounters(count = 1): readonly DebugWildRoll[] {
    if (!IS_DEVELOP || !this.run || this.gameOver || !this.encounters) return [];
    const rolls = Math.max(1, Math.min(500, Math.floor(Number.isFinite(count) ? count : 1)));
    const result: DebugWildRoll[] = [];
    for (let tries = 0; tries < rolls * 64 && result.length < rolls; tries++) {
      const encounter = this.encounters.step();
      if (!encounter) continue;
      result.push({
        speciesId: encounter.speciesId,
        level: encounter.level,
        shiny: encounter.shiny,
      });
    }
    return result;
  }

  /**
   * Dev only: moves the whole squad — the party **and** the PC box — onto
   * `level`, since they share one level and one XP bar (D35). It parks the XP at
   * that level and re-levels every member. Returns false with no live run.
   */
  setDebugSquadLevel(level: number): boolean {
    if (!IS_DEVELOP || !this.run || this.gameOver) return false;
    const settle = (member: RunPokemon): RunPokemon => editRunPokemon(member, { level });
    const target = Math.max(1, Math.floor(level));
    this.run = {
      ...this.run,
      xp: xpForLevel(target),
      party: this.run.party.map(settle),
      box: this.run.box.map(settle),
    };
    this.persistRun();
    this.refreshHud();
    return true;
  }

  /**
   * Dev only: overrides a party member's moves, ability or nature (its level is
   * the squad's, set by `setDebugSquadLevel`), then resyncs the save and the
   * HUD. Returns false with no live run or a bad id.
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
    // What the battle took out of the party is the floor mission's progress; read
    // before the fold, because the fold swaps the snapshots.
    const hpLoss = battleHpLoss(this.run, result.player);
    const { run, released, capture, events } = resolveBattle(this.run, result, reward, {
      catchLocation: {
        biomeId: this.route.biomeId,
        mapIndex: this.run.mapIndex,
        routeInMap: this.run.routeInMap,
      },
    });
    this.run = run;
    this.run = recordHpLost(this.run, hpLoss);
    // The room's capture was already spent when the wild battle started
    // (`startBattle`); this keeps it spent even if a path ever skips that.
    if (pending.trigger.kind === 'wild') this.run = useCapture(this.run);
    // A catch narrows this room's table at once: the room is NOT rebuilt (`applyRoute`
    // would restart its encounter stream), only the live exclusion is re-read.
    this.encounters.setExclusions(wildExclusions(this.run));

    // The keeper's stone is paid **here**, never at battle start, so a lost or
    // reloaded battle pays nothing and a later talk finds the card spent.
    const npc = this.npcBattle;
    this.npcBattle = null;
    let npcPrizeId: string | null = null;
    if (
      npc &&
      pending.trigger.kind === 'trainer' &&
      pending.trigger.trainerId === npcTrainerId(npc.mapIndex, npc.roomId, npc.row.id) &&
      result.outcome === 'win'
    ) {
      const prize = npcPrize(this.run.seed, npc.roomId, npc.row.id, npc.row.battle?.prizeIds ?? []);
      if (prize) {
        this.run = markItemPicked(
          addItem(this.run, prize),
          npcUseId(npc.mapIndex, npc.roomId, npc.row.id),
        );
        npcPrizeId = prize;
      }
    }

    const bossId = this.room?.boss === true ? bossTrainerId(this.room.mapIndex) : null;
    const wonBoss =
      bossId !== null &&
      pending.trigger.kind === 'trainer' &&
      pending.trigger.trainerId === bossId &&
      isTrainerDefeated(this.run, bossId);
    if (wonBoss) this.run = markBossDefeated(this.run);
    // Beating the floor's mini-boss earns the item choice just below.
    const miniBossId = this.room?.special === 'mini-boss' ? miniBossTrainerId(this.room.mapIndex) : null;
    const wonMiniBoss =
      miniBossId !== null &&
      pending.trigger.kind === 'trainer' &&
      pending.trigger.trainerId === miniBossId &&
      isTrainerDefeated(this.run, miniBossId);
    const won = result.outcome === 'win' || result.outcome === 'capture';
    const picks = won ? this.applyMapPassives('win') : [];
    this.persistRun();
    this.refreshHud();

    // A beaten trainer leaves the route for good: drop its sprite and its entry,
    // so a spinner can never spot the player and open the battle again.
    if (pending.trigger.kind === 'trainer') {
      const trainerId = pending.trigger.trainerId;
      if (isTrainerDefeated(this.run, trainerId)) this.removeTrainerSprite(trainerId);
    }

    const over = !hasLivingParty(this.run);
    this.gameOver = over;
    const finish = (): void => {
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
        this.transitionTo(this.run, { keepPosition: true });
        return;
      }
      if (wonMiniBoss) {
        openMiniBossReward(this.panelHost, () =>
          this.playLevelUp(levelUpBeats(before, this.run.party, events)),
        );
        return;
      }
      this.playLevelUp(levelUpBeats(before, this.run.party, events));
    };

    this.playReleaseBeats(releaseBeats(released), () => {
      // Raised inside the callback, so a permadeath overlay and the notice never
      // share the screen, and it never delays `finish()`.
      this.showPassivePickups(picks);
      if (npcPrizeId) this.showNotice(itemPickupNotice(getItem(npcPrizeId)?.name ?? npcPrizeId));
      if (capture?.toPc) this.showNotice(catchToPcNotice(this.memberName(capture.member)));
      finish();
    });
  }

  /** Tears down the reward card and runs its callback (the level-up beat). */
  private closeMiniBossReward(): void {
    closeRewardCard();
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
    const panel = addFrlgWindow(this, x, y, panelW, panelH);
    this.releasePortrait = this.add.image(width / 2, y + 96, PORTRAIT_TEXTURE_KEY, 0).setScale(2);
    this.releaseText = addFrlgText(this, width / 2, y + 168, '', {
      align: 'center',
      tint: FRLG_INK,
      origin: 0.5,
    });
    this.releaseText.setMaxWidth(panelW - 48);
    const hint = addFrlgText(
      this,
      width / 2,
      y + panelH + 28,
      t('release.controls', { confirm: keyLabel(this.settings.keybinds.confirm) }),
      {
        size: 16,
        tint: FRLG_MUTED,
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
    this.releaseText.setText(t('route.released', { level: beat.level, name: beat.name }));
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
   * The level-up beat: the squad's shared level counts up in the party header
   * with a gold flash on every member that levelled, then the HUD resyncs
   * (Phase 5). Since all members share one level, the count is a single tween.
   */
  private playLevelUp(beats: readonly LevelUpBeat[]): void {
    if (beats.length === 0) return;
    playCue(this, 'level-up');
    const from = Math.min(...beats.map((beat) => beat.fromLevel));
    const to = Math.max(...beats.map((beat) => beat.toLevel));
    const counter = { level: from };
    const paint = (): void => {
      setHudLevel(Math.round(counter.level));
    };
    paint();
    for (const beat of beats) {
      const index = this.run.party.findIndex((member) => member.fighter.id === beat.id);
      setPartyPortraitTint(index, FRLG_ACCENT);
    }
    this.tweens.add({
      targets: counter,
      level: to,
      duration: 520,
      ease: 'Quad.easeOut',
      onUpdate: paint,
      onComplete: () => {
        clearPartyPortraitTints();
        this.refreshHud();
        showLearnPopup(this.panelHost, beats);
      },
    });
  }

  private rewardFor(trigger: BattleTrigger): BattleReward {
    if (trigger.kind === 'wild') return { enemyLevels: [trigger.level], isTrainer: false };
    // A beaten trainer drops Poké Dollars: its archetype's base + jitter, scaled
    // by the map's band and tripled for the floor boss (`docs/maps-spec.md` §7,
    // D33). The roll is keyed by the run, map and trainer, so a replay pays the
    // same (D11).
    const archetype = trigger.archetypeId ? getTrainerArchetype(trigger.archetypeId) : undefined;
    let money: number | undefined;
    if (archetype) {
      const isBoss = trigger.trainerId === bossTrainerId(this.run.mapIndex);
      const rng = new Rng(hashSeed(`${this.run.seed}:money:${this.run.mapIndex}:${trigger.trainerId}`));
      money = trainerMoney(
        archetype,
        bandForMap(this.run.mapIndex),
        rng,
        isBoss ? BOSS_MONEY_MULTIPLIER : 1,
      );
    }
    return {
      enemyLevels: trigger.roster.map((entry) => entry.level),
      isTrainer: true,
      trainerId: trigger.trainerId,
      ...(money !== undefined ? { money } : {}),
      ...(archetype?.reward !== undefined ? { item: archetype.reward } : {}),
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
    if (this.grassStep) this.grassStep.anims.stop();
    this.grassStep = null;
    this.destroyFollower();
    this.followerSheet = null;
    this.followerSpecies = null;
    for (const sprite of this.entitySprites) sprite.destroy();
    this.entitySprites = [];
    this.itemSprites = [];
    this.trainerSprites = [];
    this.npc = null;
    this.trainerSpinIndex.clear();
    this.trainerFacing.clear();
    this.chase = null;
    if (this.battlefieldOverlay) {
      this.battlefieldOverlay.destroy();
      this.battlefieldOverlay = null;
    }
    this.battlefield = null;
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
      mapIndex: this.run.mapIndex,
      roomInMap: this.run.routeInMap,
      roomCount: this.room ? this.room.roomCount : 0,
      tile: { x: this.player.x, y: this.player.y },
      ignoreEncounters: this.ignoreEncounters,
      ignoreTrainers: this.ignoreTrainers,
    };
  }

  /** Dev only: the trainers drawn on the route and whether each sprite is showing. */
  debugTrainerSprites(): readonly Readonly<{
    id: string;
    archetypeId: string;
    x: number;
    y: number;
    facing: Facing;
    /** Manhattan distance from the player's tile to the trainer's. */
    distance: number;
    visible: boolean;
  }>[] {
    if (!IS_DEVELOP) return [];
    return this.trainerSprites.map((entry) => ({
      id: entry.trainer.id,
      archetypeId: entry.trainer.archetypeId,
      x: entry.trainer.position.x,
      y: entry.trainer.position.y,
      facing: entry.trainer.facing,
      distance:
        Math.abs(entry.trainer.position.x - this.player.x) +
        Math.abs(entry.trainer.position.y - this.player.y),
      visible: entry.sprite.visible,
    }));
  }

  /**
   * Dev only: swaps the room's first undefeated trainer's archetype and redraws just that
   * sprite (`IS_DEVELOP` only). False with no trainer or an unknown id.
   */
  debugOverrideTrainer(archetypeId: string): boolean {
    if (!IS_DEVELOP) return false;
    const archetype = getTrainerArchetype(archetypeId);
    if (!archetype) return false;
    const trainer = this.route.trainers.find((entry) => !isTrainerDefeated(this.run, entry.id));
    if (!trainer) return false;
    const swapped: RouteTrainer = { ...trainer, archetypeId: archetype.id };
    this.route = {
      ...this.route,
      trainers: this.route.trainers.map((entry) => (entry.id === trainer.id ? swapped : entry)),
    };
    this.removeTrainerSprite(trainer.id);
    const created: Phaser.GameObjects.GameObject[] = [];
    this.drawTrainer(swapped, created);
    this.hudCamera?.ignore(created);
    this.refreshTrainerVisibility();
    return true;
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

  /** Debug only: while true the tall grass rolls no wild encounter. */
  setIgnoreEncounters(enabled: boolean): void {
    if (!IS_DEVELOP) return;
    this.ignoreEncounters = enabled;
  }

  /** Debug only: while true no line of sight opens a trainer battle. */
  setIgnoreTrainers(enabled: boolean): void {
    if (!IS_DEVELOP) return;
    this.ignoreTrainers = enabled;
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
        .rectangle(this.centerX(tile.x), this.centerY(tile.y), TILE_SIZE, TILE_SIZE, FRLG_ACCENT, 0.3)
        .setStrokeStyle(2, FRLG_ACCENT, 0.9)
        .setDepth(30);
      this.hoverLabel = addFrlgText(this, this.centerX(tile.x), this.centerY(tile.y), label, {
        size: 16,
        tint: FRLG_INK,
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
    this.shopCounter = null;
    this.npc = null;
    this.stopWalking();
    this.clearRouteSprites();
    this.buildRoute(params, attempt);
    this.drawTiles();
    this.drawEntities();
    this.drawItems();
    this.drawTrainers();
    this.drawRoomFixture();
    this.player = { ...this.route.entry };
    this.movePlayerTo(this.player.x, this.player.y);
    const cameraBounds = mapPixelSize(this.map, TILE_SIZE);
    this.cameras.main.setBounds(0, 0, cameraBounds.width, cameraBounds.height);
  }

  /**
   * Debug only: moves the run to `mapIndex`, clamped to the run's map range and
   * built exactly as `advanceMap` builds a new floor — except that it does **not**
   * heal (that is the map transition's own reward) and it resets the destination
   * floor's bookkeeping even when that floor is the one the run is already on.
   */
  teleportToFloor(mapIndex: number): DebugTeleportResult {
    if (!IS_DEVELOP || !this.run || this.gameOver || !this.scene.isActive()) {
      return { ok: false, error: t('dev.error.noRoute') };
    }
    const requested = Number.isFinite(mapIndex) ? Math.floor(mapIndex) : this.run.mapIndex;
    const floor =
      this.run.mode === 'finite'
        ? Math.max(1, Math.min(FINITE_MAPS, requested))
        : Math.max(1, requested);
    const plan = planMap(this.run.seed, floor);
    const run: RunState = {
      ...this.run,
      routeIndex: this.run.routeIndex + 1,
      mapIndex: floor,
      routeInMap: plan.entryRoom,
      arrivalEdge: plan.entryEdge,
      discoveredRooms: [plan.entryRoom],
      bossDefeated: false,
      entryDeparted: false,
      pcCatch: null,
      levelCap: levelCapForMap(floor),
      defeatedTrainers: [],
      pickedItems: [],
      capturedRooms: [],
      mission: missionForMap(this.run.seed, floor),
      hpLost: 0,
      floorCasualties: this.run.stats.casualties,
    };
    this.transitionTo(run);
    return { ok: true };
  }

  /**
   * Debug only: moves the run to a room of the current floor, clamped to the
   * plan. No arrival edge is passed, so `advanceRoute` derives a real door and the
   * destination is a room reached through one.
   */
  teleportToRoom(roomInMap: number): DebugTeleportResult {
    if (!IS_DEVELOP || !this.run || this.gameOver || !this.scene.isActive()) {
      return { ok: false, error: t('dev.error.noRoute') };
    }
    const plan = this.plan;
    if (!plan) return { ok: false, error: t('dev.error.noFloorPlan') };
    const requested = Number.isFinite(roomInMap) ? Math.floor(roomInMap) : this.run.routeInMap;
    const room = Math.max(0, Math.min(plan.rooms.length - 1, requested));
    this.transitionTo(advanceRoute(this.run, room));
    return { ok: true };
  }

  /**
   * Debug only: moves the player onto a tile of the current room, clamped to the
   * map. A solid tile is refused — the player would be stuck in it (tick *Pass
   * through obstacles* first). A teleport is a position change, not a step: it
   * rolls no encounter and runs no sight check on arrival.
   */
  teleportToTile(x: number, y: number): DebugTeleportResult {
    if (!IS_DEVELOP || !this.run || this.gameOver || !this.scene.isActive()) {
      return { ok: false, error: t('dev.error.noRoute') };
    }
    const size = mapSize(this.map);
    const tile = {
      x: Number.isFinite(x) ? Math.floor(x) : this.player.x,
      y: Number.isFinite(y) ? Math.floor(y) : this.player.y,
    };
    tile.x = Math.max(0, Math.min(size.width - 1, tile.x));
    tile.y = Math.max(0, Math.min(size.height - 1, tile.y));
    if (!isWalkable(this.moveMap, tile)) return { ok: false, error: t('dev.error.solidTile') };
    // The in-flight tween must not carry the sprite back to the old destination
    // and run `onTileEntered` there.
    this.stopWalking();
    this.movePlayerTo(tile.x, tile.y);
    // A teleport runs no sight check; it only re-paints the sprites' visibility.
    this.refreshTrainerVisibility();
    this.refreshHud();
    return { ok: true };
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
    if (!IS_DEVELOP || !this.scene.isActive()) return { ok: false, error: t('dev.error.noRoute') };
    let exported;
    try {
      exported = parseFrameMapExport(text);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : t('dev.error.invalidFrameMap'),
      };
    }
    this.stopWalking();
    this.clearRouteSprites();
    this.room = null;
    this.plan = null;
    this.shopCounter = null;
    this.npc = null;
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
    this.drawRoomFixture();
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
    if (this.followerSprite) this.followerSprite.setDepth(actorDepth(this.followerSprite.y));
    if (
      this.gameOver ||
      this.pendingBattle ||
      this.releaseRoot ||
      this.modalPanelOpen() ||
      pauseMenuOpenNow() ||
      this.chase
    ) {
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
    // A visible ground item, a live trainer or the room's special NPC blocks its
    // tile, like an object in the originals: the item is taken with the interact
    // key and the trainer is talked to. A hidden item can be walked over.
    if (
      !result ||
      this.itemBlocks(result.to) ||
      this.liveTrainerAt(result.to) ||
      this.shopCounterAt(result.to) ||
      this.npcBlocks(result.to) ||
      this.signBlocks(result.to)
    ) {
      this.faceIdle(direction);
      return;
    }
    this.walkStep(direction, result.to);
  }

  /** Turns every "spinning" trainer to the next facing on the shared timer. */
  private updateTrainerSpins(time: number): void {
    if (this.generatorStepIndex !== null) return;
    if (
      this.gameOver ||
      this.pendingBattle ||
      this.releaseRoot ||
      this.modalPanelOpen() ||
      pauseMenuOpenNow() ||
      this.chase
    )
      return;
    for (const entry of this.trainerSprites) {
      if (isTrainerDefeated(this.run, entry.trainer.id)) continue;
      const turns = entry.trainer.turns;
      if (!turns || turns.length < 2) continue;
      const index = Math.floor(time / TRAINER_TURN_MS) % turns.length;
      if (this.trainerSpinIndex.get(entry.trainer.id) === index) continue;
      this.trainerSpinIndex.set(entry.trainer.id, index);
      this.trainerFacing.set(entry.trainer.id, turns[index]);
      this.faceTrainerSprite(entry, turns[index]);
      // A spinner that swings its cone onto a player standing still still spots
      // them, the same as stepping into a fixed trainer's line of sight.
      if (
        !this.ignoreTrainers &&
        seesPlayer(this.route, this.effectiveTrainer(entry.trainer), this.player, this.moveMap)
      ) {
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
    if (this.textFieldFocused()) return null;
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
