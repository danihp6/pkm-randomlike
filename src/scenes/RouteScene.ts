import Phaser from 'phaser';
import { biomeForRoute, getBiome } from '../data/biomes';
import { getSpecies } from '../data/dex';
import { GROUND_ITEM_TEXTURE_KEY } from '../data/groundItemSprite';
import type { HudPanelId } from '../data/hudLayout';
import { getItem } from '../data/items';
import { CURSE_ENEMY_BOOST } from '../data/npcs';
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
import { followerAnimKey, followerAnims, followerFit } from '../render/pokemonFollower';
import { ROUTE_LOOT } from '../data/loot';
import type { MapPassiveTrigger } from '../data/passives';
import {
  OVERWORLD_SPRITE_TEXTURE_KEY,
  OVERWORLD_SPRITE_WIDTH,
  overworldSpriteFrame,
} from '../data/overworldSprites';
import { trainerFacingPose, trainerWalkAnimKey } from '../render/trainerAnim';
import { getTrainerArchetype, TRAINER_ARCHETYPE_IDS } from '../data/trainers';
import { trainerLevel } from '../data/trainerLevels';
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
  addFaints,
  addItem,
  addPokemon,
  adoptAtLevel,
  battleSeed,
  canCapture,
  createRun,
  createRunPokemon,
  editRunPokemon,
  fullHealMember,
  hasLivingParty,
  isItemPicked,
  isTrainerDefeated,
  markItemPicked,
  memberById,
  resolveBattle,
  runBand,
  squadLevel,
  trainerMoney,
  trainerRoster,
  updatePokemon,
  useCapture,
  withMemberTally,
  xpForLevel,
  type BagCounts,
  type BattleLaunch,
  type BattleReturn,
  type BattleReward,
  type BattleTrigger,
  type MemberTally,
  type RunPokemon,
  type RunState,
} from '../engine/run';
import { ownedTmIds } from '../engine/run/items';
import { bandForNode } from '../engine/run/levelCurve';
import { battleHpLoss, recordHpLost } from '../engine/run/missions';
import { forcedFieldId, withoutCurse, withoutNextWildType } from '../engine/run/modifiers';
import { livingTeamTypes } from '../engine/run/party';
import { wildExclusions } from '../engine/run/pool';
import { runPassives, type PassivePickup } from '../engine/run/passives';
import { TILESETS, type TilesetId, tilesetTextureKey } from '../data/tilesets';
import type { Tile } from '../engine/grid';
import { FLOOR, TALL_GRASS, isWalkable, mapSize, resolveMove, type TileMap } from '../engine/map';
import { hashSeed, randomSeed, Rng } from '../engine/rng';
import { clearRun, loadSave, storeHistory, storeRun, type Settings } from '../engine/save';
import { emptyEndLog, endRun, type RunEndLog, type RunHistoryRecord } from '../engine/run/history';
import {
  RouteEncounters,
  seesPlayer,
  sketchRoute,
  sketchRouteSteps,
  trainerAt,
  trainerHidden,
  withForcedAbility,
  type AccessEdge,
  type Facing,
  type RouteItem,
  type RouteMap,
  type RouteRequest,
  type RouteShape,
  type RouteStep,
  type RouteTrainer,
} from '../engine/routes';
import { TILE_SIZE } from '../engine/tileset';
import {
  grassRustleFrames,
  grassTipKeys,
  hiddenItemFrame,
  isGrassStepTile,
  treeTipKeys,
} from '../engine/tileFrames';
import { parseFrameMapExport, routeFromFrameMapExport, serializeFrameMap } from '../engine/frameMap';
import { buildNodeMeshes } from '../engine/region/preload';
import { NODE_ENCOUNTER_CHANCE, nodeEncounterTable, nodeWildLevel } from '../engine/region/encounters';
import { nodeOf, planRegion, type RegionNode, type RegionNodeKind } from '../engine/region/plan';
import { inPoiRect, poiBattleRules, poiRect, type NodePoi } from '../engine/region/pois';
import { isRouteKind } from '../engine/region/route';
import {
  bandAt,
  planRouteScreens,
  screenIndexOf,
  type RouteNodePlan,
  type RouteScreenPlan,
} from '../engine/region/routeScreens';
import { travel, type TravelMode } from '../engine/region/travel';
import { addFrlgWindow } from '../ui/frlg';
import { catchToPcNotice, itemPickupNotice, type Notice } from '../ui/notice';
import { levelUpBeats, type LevelUpBeat } from '../ui/beats';
import {
  RELEASE_HOLD_MS,
  RELEASE_INPUT_DELAY_MS,
  releaseBeats,
  type ReleaseBeat,
} from '../ui/permadeath';
import { FRLG_INK, addFrlgText } from '../ui/frlgFont';
import { FRLG_ACCENT, FRLG_MUTED } from '../ui/frlg';
import { createTouchControls, type TouchControls } from '../ui/touchControls';
import { t } from '../i18n';
import { actionKeys, subscribeKeybinds } from '../input/input';
import { listenForBack } from '../input/backButton';
import { playCue, playMusic } from '../audio/audio';
import { buildRankingEntry, loadRankingEndpoint, rankingDeviceId, submitRanking } from '../net/ranking';
import { loadSettings } from '../settings';
import { browserStorage } from '../storage';
import type { RoomBattlefield } from '../data/battlefields';
import { ROOM_BATTLEFIELDS } from '../data/battlefields';
import { GRASS_TEXTURE_KEY, TRAINER_TEXTURE_KEY } from './BootScene';
import { actorDepth, WorldScene, WORLD_ARRIVED } from './WorldScene';
import { RUN_STEP_MS, WALK_STEP_MS } from './walker';
import { drawPoi } from './pois';
import { poiCounterOf } from './npcs';
import { bagTextFieldFocused, typeInBagSearch } from './panels/bag';
import {
  cancelNicknameEdit,
  clearDetailInfo,
  closeLearnPopup,
  detailTextFieldFocused,
  learnPopupOpenNow,
  refreshDetail,
  showLearnPopup,
  typeInDetailSearch,
  typeInNickname,
} from './panels/detail';
import { showAreaPanel, showNotice as showPanelNotice } from './panels/notices';
import { openTradeCard } from './panels/trade';
import {
  closePauseMenu,
  hideResetOverlay,
  openPauseMenu,
  pauseMenuOpenNow,
  updateReset as updateResetOverlay,
} from './panels/pause';
import type { PanelSceneSource } from './panels/host';
import type {
  RoomPanel,
  RoomWildBattle,
  RoutePanelHost,
  RoutePanelId,
} from './panels/types';

/**
 * The cards this scene mounts: every panel of the folder. The route is the only
 * screen with a minimap, a floor HUD, a box and a notice strip, so it takes the
 * twelve while a node screen takes `NODE_PANEL_IDS`.
 */
const ROUTE_PANEL_IDS: readonly RoutePanelId[] = [
  'map',
  'party',
  'hud',
  'bag',
  'pc',
  'notices',
  'missions',
  'rewards',
  'shop',
  'trade',
  'pause',
  'detail',
];

/** The four directions, in the order the update loop tests them. */
type MoveKey = 'up' | 'down' | 'left' | 'right';

/**
 * The kinds whose own scene plays them and which have no map to walk: the League and
 * the endless tower. Every other kind is drawn by this scene or by the city screen.
 */
const SCENE_ONLY_SCENES: Readonly<Partial<Record<RegionNodeKind, string>>> = {
  league: 'League',
  tower: 'League',
};

/** The band direction a held move key pushes toward, for the route's exit rule. */
const OUTWARD: Readonly<Record<AccessEdge, MoveKey>> = {
  N: 'up',
  S: 'down',
  W: 'left',
  E: 'right',
};

/** One frame of the player's own tall-grass rustle, in ms. */
const GRASS_STEP_MS = 70;
/** Over the actor band (`ACTOR_DEPTH` + foot-y step, 491-497), under the dev hover marker (30). */
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
}>;

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

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

/** One dev wild roll: what the node's live stream handed out on a step. */
export type DebugWildRoll = Readonly<{ speciesId: string; level: number; shiny: boolean }>;

export class RouteScene extends WorldScene {
  /** The node's route in both shipped shapes, so one object serves every seam. */
  private route!: RouteNodePlan['route'];
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
  /** The screens of the route on screen, top to bottom; empty while a dev preview draws. */
  private screens: readonly RouteScreenPlan[] = [];
  /** The lateral's point of interest, or null on a main-chain route and on a preview. */
  private poi: NodePoi | null = null;
  /**
   * False while the player was just placed and true once a step has landed, so
   * standing on a border band never bounces a fresh spawn straight back out.
   */
  private bandArmed = false;
  /** True once a node's screens are built and drawn; false for a node with none. */
  private nodeBuilt = false;
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
  /** True while a region travel is fading between nodes, so one click travels once. */
  private travelling = false;
  /** The transitions started and the travels committed, for the dev browser pass. */
  private travelFades = 0;
  private travelCommits = 0;
  /** The run-history log the end seam writes through; built from the loaded save. */
  private endLog: RunEndLog | null = null;
  /** The monthly ranking's endpoint, resolved once; `undefined` = not asked yet. */
  private rankingEndpoint: string | null | undefined;
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
  private searchKeyStamps = new Set<number>();
  private releaseRoot: Phaser.GameObjects.Container | null = null;
  private releaseQueue: ReleaseBeat[] = [];
  private releaseOnDone: (() => void) | null = null;
  private releaseWait: Phaser.Time.TimerEvent | null = null;
  private releaseArmed = false;
  private releasePortrait!: Phaser.GameObjects.Image;
  private releaseText!: Phaser.GameObjects.BitmapText;
  /** The room's own panel while it owns the keyboard, or null; the scene owns the slot. */
  private roomPanel: RoomPanel | null = null;

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
   * The region's one travel seam (`docs/region-spec.md` §4 and §5): asks the pure
   * `travel` rule, takes the already-preloaded node (or asks the worker for it) and
   * plays the one fade-and-swap. Returns false — with the run, the save and the map
   * untouched — while a battle, a release beat, the run-over screen, the pause menu,
   * another travel or a stopped scene owns the moment, and when the rule refuses or
   * the node has no world.
   *
   * The guard is taken **before** the preload's `await`: on a cold node that window is
   * about half a second, and a second press inside it must not commit a second run for
   * the one transition. Every exit path clears it.
   */
  async travelToNode(toKey: string, mode: TravelMode = 'walk'): Promise<boolean> {
    if (this.travelling || !this.run) return false;
    if (this.pendingBattle || this.releaseRoot || this.gameOver) return false;
    if (pauseMenuOpenNow() || !this.scene.isActive()) return false;

    const seed = this.run.seed;
    const result = travel(planRegion(seed), this.run, toKey, mode);
    if (!result.ok) return false;

    this.travelling = true;
    try {
      const world = this.cachedWorld(seed, toKey) ?? (await this.preload(seed, toKey));
      if (world === null) {
        // The League and the tower have no carver, so no map can be swapped in: they
        // are handed to their own scene exactly as `onNodeArrived` hands a drawn world
        // over, and the run is committed first so that scene reads the node it entered.
        const target = nodeOf(planRegion(seed), toKey);
        const sceneKey = target === undefined ? null : (SCENE_ONLY_SCENES[target.kind] ?? null);
        if (sceneKey === null || this.scene.manager.getScene(sceneKey) === null) return false;
        this.run = result.run;
        this.travelCommits += 1;
        this.persistRun();
        this.scene.start(sceneKey, { run: this.run, spawn: result.spawn });
        return true;
      }

      this.run = result.run;
      this.travelCommits += 1;
      this.persistRun();
      const arrived = new Promise<void>((resolve) => {
        this.events.once(WORLD_ARRIVED, () => resolve());
      });
      this.travelFades += 1;
      this.transitionToNode(world, result.spawn);
      await arrived;
      return true;
    } finally {
      this.travelling = false;
    }
  }

  /**
   * The base scene swapped the map and hands the spawn over: rebuild the node's own
   * screens, content and entities from the seam, place the player on `spawn` and play
   * the node's own bed — the route's theme on a route, a lateral and the Victory Road,
   * the menu theme in a settlement. A settlement the region offers a scene of its own
   * is handed over instead of drawn here.
   */
  protected override onNodeArrived(key: string, spawn: Tile): void {
    const node = nodeOf(planRegion(this.run.seed), key);
    const arrivalScene = node ? this.arrivalSceneFor(node.kind) : null;
    if (arrivalScene !== null && this.scene.manager.getScene(arrivalScene) !== null) {
      // The arrival's own spawn travels with the hand-off: a flight lands on the
      // settlement's Centre door and the city screen must stand there, not on the
      // plaza its plan calls a spawn (`docs/region-spec.md` §5).
      this.scene.start(arrivalScene, { run: this.run, spawn });
      return;
    }
    this.stopWalking();
    this.closePanel();
    this.clearRouteSprites();
    if (!this.buildNode()) return;
    this.drawRoute();
    this.nodeBuilt = true;
    this.movePlayerTo(spawn.x, spawn.y);
    this.refreshTrainerVisibility();
    const picks = this.applyMapPassives('room');
    this.showPassivePickups(picks);
    this.refreshHud();
    showAreaPanel(this.panelHost);
    const route = node !== undefined && isRouteKind(node.kind);
    playMusic(this, route ? 'route-music' : 'menu-music');
  }

  /**
   * The scene a node of `kind` belongs to, or null while this scene keeps it: a
   * settlement is the city screen's, the League's and the tower's are the League
   * scene's, and a route, a lateral and the Victory Road are drawn here until
   * their scenes exist.
   */
  private arrivalSceneFor(kind: RegionNodeKind): string | null {
    if (kind === 'town' || kind === 'city') return 'City';
    return SCENE_ONLY_SCENES[kind] ?? null;
  }

  /**
   * The region node the run stands on: the plan's node for its `nodeKey`, or the
   * starting town when a hand-edited save names one the plan does not hold. The
   * grass table, the wild level and the band are the node's, so every screen of one
   * node rolls the same pool and spends the same single catch
   * (`docs/region-spec.md` §7.9).
   */
  private regionNode(): RegionNode {
    const plan = planRegion(this.run.seed);
    return nodeOf(plan, this.run.nodeKey) ?? nodeOf(plan, plan.townKey)!;
  }

  /**
   * Builds the node on screen from the one seam (`docs/region-spec.md` §7.12): the
   * plan names the node, `planRouteScreens` cuts its own carve into screens and
   * populates them, and the scene takes every value it draws and walks from that
   * one answer. A node with no screens — the League and the tower — is warned once
   * and draws nothing, the way `CityScene` degrades.
   */
  private buildNode(): boolean {
    const plan = planRegion(this.run.seed);
    const node = nodeOf(plan, this.run.nodeKey);
    this.screens = [];
    this.poi = null;
    if (node === undefined || !isRouteKind(node.kind)) {
      console.warn(`route: no screens for ${this.run.nodeKey}`);
      return false;
    }
    const planned = planRouteScreens(plan, node.key);
    const route = planned.route;
    const biome = getBiome(route.biomeId);
    this.screens = planned.screens;
    this.poi = planned.poi;
    this.tilesetId = biome.tilesetId;
    // The grass rolls the **node**, never a room (`src/engine/region/encounters.ts`),
    // and its stream is keyed by the node key, so walking back replays it (D11).
    this.encounters = new RouteEncounters(
      nodeEncounterTable(node, this.run),
      new Rng(hashSeed(`${this.run.seed}:encounters:${node.key}`)),
      (rng) => nodeWildLevel(node, this.run, rng),
      NODE_ENCOUNTER_CHANCE,
      new Rng(hashSeed(`${this.run.seed}:shiny:${node.key}`)),
      undefined,
      this.run.modifiers.nextWildType,
    );
    this.routeParams = {
      seed: this.run.seed,
      routeIndex: node.id,
      shape: 'straight',
      width: route.width,
      height: route.height,
      grassPatches: biome.terrain.grassPatches,
      ledges: biome.terrain.ledges,
    };
    this.applyRoute(route, route);
    return true;
  }

  /** Draws everything the node on screen holds, over its two tile layers. */
  private drawRoute(): void {
    this.drawTiles();
    this.drawEntities();
    this.drawItems();
    this.drawTrainers();
    this.drawPointOfInterest();
  }

  /** The tile the player stands on: the arrival's own spawn, else screen 0's. */
  private spawnTile(): Tile {
    const arrival = this.arrival();
    if (arrival !== null && arrival.key === this.run.nodeKey) return { ...arrival.spawn };
    const first = this.screens[0];
    return first === undefined ? { x: 1, y: 1 } : { ...first.spawn };
  }

  /**
   * Draws the lateral's point of interest and its zone with the other entities, so
   * `clearRouteSprites` takes them down with the rest of the node's content.
   */
  private drawPointOfInterest(): void {
    const poi = this.poi;
    if (poi === null || this.generatorStepIndex !== null) return;
    for (const object of drawPoi(this, this.route, poi, TILE_SIZE)) {
      this.entitySprites.push(object);
    }
  }

  /**
   * The source the shared panel layer answers from (`./panels/host.ts`): the scene's
   * own run, settings and route, read live so a panel always paints the current ones;
   * its panel slot; and the layer's twelve cards. A panel mutates the scene only
   * through these methods, and never writes the run itself.
   */
  protected override panelSource(): PanelSceneSource {
    return {
      scene: this,
      run: () => this.run,
      settings: () => this.settings,
      route: () => this.route,
      slot: {
        open: (panel) => this.openPanel(panel),
        close: () => this.closePanel(),
        isOpen: () => this.panelOpen(),
      },
      actions: {
        showNotice: (notice) => this.showNotice(notice),
        startWildBattle: (encounter) => this.startRoomWildBattle(encounter),
        startTrainerBattle: (trainer) => this.startTrainerBattle(trainer),
        openSettings: () => this.openSettings(),
        restartRun: () => this.restartRun(),
        flyToNode: (key) => {
          void this.travelToNode(key, 'fly');
        },
        commitRun: (run) => this.commitRun(run),
        persistRun: () => this.persistRun(),
      },
    };
  }

  /** The route mounts every card the folder holds, not only a node's seven. */
  protected override panelSelection(): readonly RoutePanelId[] {
    return ROUTE_PANEL_IDS;
  }

  /** The port every card draws through; `create` mounts the layer before anything reads it. */
  protected override get panelHost(): RoutePanelHost {
    const host = this.panelLayer === null ? null : this.panelLayer.host;
    if (host === null) throw new Error('route: the panel layer is not built');
    return host;
  }

  /** Sets the scene's run, persists it and repaints the HUD (a Mart trade). */
  private commitRun(run: RunState): void {
    this.run = run;
    this.persistRun();
    this.refreshHud();
  }

  /**
   * Folds the map passives for `trigger` into the run
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

  /** True while a panel owns the screen. */
  private panelOpen(): boolean {
    return this.roomPanel !== null;
  }

  /** True while a panel is **modal**: a floating one never gates the route. */
  private modalPanelOpen(): boolean {
    return this.roomPanel !== null && this.roomPanel.modal !== false;
  }

  /**
   * Builds the free-standing carver preview for `params` (plus the debug reroll
   * `attempt`) and points the scene at it. It is the dev generator's and the frame
   * importer's own map, not a region node: it carves a rolled shape, so it goes
   * through the shipped `sketchRoute` unchanged.
   */
  private buildRoute(params: RouteParams, attempt = 0): void {
    const biome = biomeForRoute(params.routeIndex);
    const seed = attempt > 0 ? `${params.seed}#r${attempt}` : params.seed;
    this.routeParams = params;
    const pattern = TILESETS[biome.tilesetId].config.wallPattern;
    const wall = pattern
      ? { cols: pattern.cols, minHeight: Math.max(2, pattern.rows.length - 2) }
      : undefined;
    const loot = ROUTE_LOOT[runBand(this.run.seed, params.routeIndex).id];
    const request: RouteRequest = {
      seed,
      routeIndex: params.routeIndex,
      biomeId: biome.id,
      layout: biome.layout,
      shape: params.shape,
      width: params.width,
      height: params.height,
      grassPatches: params.grassPatches,
      ledges: params.ledges,
      loot: loot.pool,
      lootExclude: ownedTmIds(this.run),
      hiddenChance: loot.hiddenChance,
      itemChance: loot.itemChance,
      trainerArchetypes: TRAINER_ARCHETYPE_IDS,
      ...(wall ? { wall } : {}),
    };
    const route = sketchRoute(request);
    this.generatorSteps = IS_DEVELOP ? sketchRouteSteps(request) : [];
    this.applyRoute(route);
  }

  /**
   * Points the scene at an already-built route: its tiles become the live and render
   * maps and the tileset follows the route's biome. `buildNode` (the region node) and
   * the two dev tools (the carver preview and a frame-map import) go through here so
   * they cannot drift.
   *
   * `nodeRoute` is the seam's own answer for a region node; a dev preview has no
   * bands and no screens, so it is widened to the same shape with empty ones.
   *
   * The grass stream is **not** built here: it is the node's, so `buildNode` sets it
   * before this call and a dev preview leaves the last node's stream alone.
   */
  private applyRoute(route: RouteMap, nodeRoute?: RouteNodePlan['route']): void {
    this.route = nodeRoute ?? { ...route, key: this.run.nodeKey, screens: [], bands: [] };
    this.map = route.tiles;
    this.renderTiles = this.map;
    this.generatorStepIndex = null;
    this.tilesetId = getBiome(route.biomeId).tilesetId;
    this.moveMap = this.movementMap(this.map);
  }

  override create(): void {
    if (!this.run) {
      this.run = createRun({
        seed: DEV_SEED,
        starter: createRunPokemon(DEMO_STARTER),
        bag: DEMO_BAG,
        startedAt: new Date().toISOString(),
      });
      this.run = addPokemon(this.run, createRunPokemon(DEMO_RESERVE));
    }
    // The end seam writes over the stored history, so it opens from the slot the
    // run was resumed from, never from a list the scene invents (`Task-181`).
    this.endLog = emptyEndLog(loadSave(browserStorage()).history);
    this.persistRun();
    // A run standing on a settlement is drawn by the node's own scene, never here:
    // the city scene walks the streets and hands any other node straight back.
    const arrival = nodeOf(planRegion(this.run.seed), this.run.nodeKey);
    const arrivalScene = arrival ? this.arrivalSceneFor(arrival.kind) : null;
    if (arrivalScene !== null && this.scene.manager.getScene(arrivalScene) !== null) {
      // A transition that already resolved this run's spawn (a flight onto a door)
      // hands it over too, so the city screen lands where the travel rule said. A
      // stale arrival of another node is not this run's spawn and is not passed.
      const last = this.arrival();
      const spawn = last !== null && last.key === this.run.nodeKey ? last.spawn : null;
      this.scene.start(arrivalScene, spawn ? { run: this.run, spawn } : { run: this.run });
      return;
    }
    // A restart in place (`scene.start('Route', …)`) runs `create` again over the
    // previous room's arrays, whose objects Phaser already destroyed with the
    // scene, so the stale entries must go before the rebuild (#34).
    this.entitySprites = [];
    this.itemSprites = [];
    this.grassStep = null;
    this.trainerSprites = [];
    this.trainerSpinIndex.clear();
    this.trainerFacing.clear();
    this.chase = null;
    this.passThrough = false;
    this.ignoreEncounters = false;
    this.ignoreTrainers = false;
    this.clearHoverInspect();
    this.gameOver = false;
    this.pendingBattle = null;
    this.travelling = false;
    this.travelFades = 0;
    this.travelCommits = 0;
    this.releaseRoot = null;
    this.releaseQueue = [];
    this.releaseOnDone = null;
    this.releaseWait = null;
    this.releaseArmed = false;
    this.roomPanel = null;
    this.facing = 'down';
    this.walkTween = null;
    this.followerSprite = null;
    this.followerSheet = null;
    this.followerSpecies = null;
    this.followerTween = null;
    this.nodeBuilt = false;
    this.bandArmed = false;
    this.settings = loadSettings();
    // The shared panel layer (the twelve cards) is mounted by the base scene's
    // `create` before the node exists; `buildNode` and the node arrivals read
    // `this.panelHost` from it.
    super.create();

    if (!this.buildNode()) return;

    this.drawRoute();
    this.nodeBuilt = true;
    this.player = this.spawnTile();
    this.playerSprite = this.add
      .sprite(0, 0, PLAYER_SPRITE_TEXTURE_KEY, playerSpriteFrame('down'))
      .setOrigin(0.5, 1)
      .setScale(TILE_SIZE / PLAYER_SPRITE_WIDTH)
      .setDepth(actorDepth(0));
    this.movePlayerTo(this.player.x, this.player.y);
    this.refreshTrainerVisibility();

    this.followCamera(this.playerSprite);

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
    // The board owns every press over its own cards: the route keeps no pointer
    // path of its own, so the canvas only ever answers the world.
    this.input.on('gameout', () => {
      clearDetailInfo(this.panelHost);
    });
    // The touch pad lives on a screen-space root the zoomed world camera ignores.
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
    // The node's greeting: the banner is raised once per node entry, here in
    // `create` and in `onNodeArrived`, never inside `applyRoute`.
    showAreaPanel(this.panelHost);
    refreshDetail(this.panelHost);
    playMusic(this, 'route-music');
    // Dev only: the browser pass reaches the run's end seam through the scene
    // itself, the way `__pkmBattle` exposes a battle (`Task-181`).
    if (IS_DEVELOP) {
      (globalThis as Record<string, unknown>).__pkmRoute = this;
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (globalThis as Record<string, unknown>).__pkmRoute;
      });
    }
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
   * Opens or collapses the HUD card a quick key points at, exactly as a press on
   * its edge chip or its own key chip does. Ignored while another overlay (the
   * pause menu, a release beat) owns the input.
   *
   * A quick key is a plain toggle (D45): it never takes the keyboard, so the
   * arrows keep walking the route while a card is open.
   */
  private toggleHudPanel(id: HudPanelId): void {
    if (this.gameOver || this.pendingBattle || this.releaseRoot || pauseMenuOpenNow()) return;
    const host = this.panelHost;
    host.setHudCardOpen(id, !host.hudCardOpen(id));
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
   * Repaints every card from the run, in registry order, and keeps the party's
   * follower in step with its lead. One place decides the sequence, so a panel can
   * never paint out of order or half-way.
   */
  private refreshHud(): void {
    this.panelLayer?.refresh();
    // The party's lead walks behind the player: a lead change loads its pair once
    // and rebuilds the follower, so nothing here runs per frame.
    this.refreshFollower();
  }

  /** True while any in-panel text field owns the keyboard. */
  private textFieldFocused(): boolean {
    return detailTextFieldFocused() || bagTextFieldFocused();
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
    this.scene.start('Lab', { seed: randomSeed() });
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

  /**
   * Draws the map on screen as the base scene's two culled layers. Every caller
   * (`create`, `onNodeArrived`, the frame-map import and the dev generator step)
   * keeps calling it after it changed `renderTiles`.
   */
  private drawTiles(): void {
    const meshes = buildNodeMeshes(this.renderTiles, TILESETS[this.tilesetId].config);
    this.drawWorld({ tiles: this.renderTiles, meshes, tilesetId: this.tilesetId });
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
      .setScale(rest === undefined ? 1 : TILE_SIZE / config.atlas.tileSize)
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
  }

  /**
   * Draws the ground items the node placed on its own screens. A visible item is the
   * FRLG Poke Ball, like the originals; a hidden one is the biome's own floor patch
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

  /** Snaps the sprite to a tile, without a step. */
  private movePlayerTo(x: number, y: number): void {
    this.player = { x, y };
    // A placement is not a step: the band rule waits for the next landed step.
    this.bandArmed = false;
    // The 16x32 FRLG frame stands with its feet on the tile's bottom edge, the
    // same placement the route's trainers use.
    this.playerSprite.setPosition(this.centerX(x), this.centerY(y) + TILE_SIZE / 2);
    this.playerSprite.setDepth(actorDepth(this.playerSprite.y));
    // A snap (a node arrival, a debug teleport) leaves the follower on the player's
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
        this.onTileEntered();
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
    const fit = followerFit(sheet);
    const footY = this.centerY(this.player.y) + fit.feetOffset;
    const sprite = this.add
      .sprite(this.centerX(this.player.x), footY, sheet.textureKey, 0)
      .setOrigin(0.5, 1)
      .setScale(fit.scale)
      .setDepth(actorDepth(footY))
      .setFlipX(this.facingDir === 'right');
    this.followerSprite = sprite;
    this.entitySprites.push(sprite);
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

  private onTileEntered(): void {
    // A landed step arms the band rule: standing on a border band and pressing
    // outward hands the run back to the region's travel seam.
    this.bandArmed = true;
    // A step re-paints the hidden archetypes' sprites before anything else: a
    // battle this step opens must not leave them drawn.
    this.refreshTrainerVisibility();
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

  /** Opens the menu battle against a trainer, with a roster seeded for that node. */
  private startTrainerBattle(trainer: RouteTrainer): void {
    if (this.gameOver || this.pendingBattle || this.releaseRoot) return;
    if (isTrainerDefeated(this.run, trainer.id)) return;
    const archetype = getTrainerArchetype(trainer.archetypeId);
    if (!archetype) return;
    // The roster is the node's band and its cap (`bandForNode`, `docs/region-spec.md`
    // §3), keyed by the node and the trainer, so a node replays its own roster (D11).
    const node = this.regionNode();
    const band = bandForNode(node);
    const key = `${this.run.seed}:trainer:${node.key}:${trainer.id}`;
    const roster = trainerRoster(band, new Rng(hashSeed(key)), trainer.id, {
      allowMega: archetype.carriesMega === true,
      // A regular trainer's level is a percentage of the live squad level by its own
      // party size, capped at the node's ceiling (`docs/maps-spec.md` §5, D35).
      levelFor: (size: number) => trainerLevel(squadLevel(this.run), size, band.maxLevel),
    });
    this.startBattle({
      kind: 'trainer',
      trainerId: trainer.id,
      trainerName: archetype.name,
      roster: withForcedAbility(roster, archetype),
      archetypeId: archetype.id,
    });
  }

  /** Opens a wild battle a panel asked for through the shipped wild path (`startBattle`). */
  private startRoomWildBattle(encounter: RoomWildBattle): void {
    this.startBattle({
      kind: 'wild',
      speciesId: encounter.speciesId,
      level: encounter.level,
      key: encounter.key,
    });
  }

  /**
   * The interact key (`E` by default): take the ground item the player faces, or the
   * one underfoot; a zone of a point of interest on the facing tile opens its own
   * counter when that kind has one. Hidden items show only a faint sparkle, so this
   * is how they are found. Ignored while a battle or a beat owns the screen.
   */
  private tryInteract(): void {
    if (this.gameOver || this.pendingBattle || this.releaseRoot) return;
    const step = MOVE_STEP[this.facingDir];
    const ahead = { x: this.player.x + step.x, y: this.player.y + step.y };
    // Talking to a trainer it is facing also opens the battle, like the originals.
    const trainer = this.liveTrainerAt(ahead);
    if (trainer) {
      this.startTrainerBattle(trainer);
      return;
    }
    if (this.collectItemAt(ahead)) return;
    if (this.collectItemAt(this.player)) return;
    this.openPoiCounter(ahead);
  }

  /**
   * Opens the counter a point of interest's zone holds (`docs/region-spec.md` §7.8):
   * a `trade` terminus answers its card while the player stands on its zone, and every
   * other kind stays inert. It marks nothing spent — a second press reopens the card —
   * and it yields while any other counter owns the panel slot.
   */
  private openPoiCounter(tile: Tile): void {
    const poi = this.poi;
    if (poi === null || poiCounterOf(poi.kind) !== 'trade') return;
    if (!inPoiRect(poiRect(this.route), tile)) return;
    if (this.panelOpen()) return;
    openTradeCard(this.panelHost);
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
    this.panelLayer?.registry.byId.get('pause')?.key?.(this.panelHost, action);
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
  }

  /** Pauses the route and rolls the battle on top of it (Phase 5 transition). */
  private startBattle(trigger: BattleTrigger, extras: BattleExtras = {}): void {
    if (this.gameOver || this.pendingBattle || this.releaseRoot) return;
    this.battleCounter += 1;
    const node = this.regionNode();
    const key =
      trigger.kind === 'wild' ? `${trigger.key}:${this.battleCounter}` : `trainer:${trigger.trainerId}`;
    // The node's one catch is spent the moment its **first wild battle** starts,
    // whatever the outcome: catching, defeating or fleeing all close the window, so
    // only the first wild Pokémon that appears can be caught. The battle still
    // allows the catch (the flag is read before spending) and the route HUD and
    // minimap mark the node spent as soon as it is back.
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
      // Both battle figures are the **node's**, never a room's: `hashSeed(nodeKey)` is
      // a stable per-node number, so a node replays its own fights (D11).
      seed: battleSeed(this.run.seed, hashSeed(node.key), key),
      runSeed: this.run.seed,
      canCapture: captureAllowed,
      firstCatch,
      // The difficulty the battle's AI reads from the launch (D46): the settings
      // are re-read whenever the options screen closes, so a change reaches the
      // next battle.
      aiLevel: this.settings.aiLevel,
      // A sky the weather man pinned still covers the nodes it was bought for.
      battlefield: this.forcedBattlefield(),
      // The lateral's point of interest rules the fight it holds (`pois.ts`): the
      // no-heal terminus bars the Bag and healing moves for it.
      noHeal: poiBattleRules(this.poi ? [this.poi] : [], this.player).noHeal,
      // The fight's own roll (`src/data/bosses.ts`) carried through `BattleExtras`;
      // every other battle stays single.
      ...(extras.double === true ? { double: true } : {}),
      // The living party's repeated types (§13): a type needs two living holders.
      teamTypes: livingTeamTypes(this.run),
      // The berry tree's guardian forbids the flight (`runAway.ts`), unless an
      // escape effect (Run Away, the Smoke Ball) grants it.
      ...(extras.noFlee ? { noFlee: true } : {}),
      // The exorcist's hex and the guardian's own boost are separate data rows on
      // purpose: their keys never collide (atk, spe and def), so the spread needs no
      // arithmetic.
      ...(extras.enemyBoosts || this.run.modifiers.curse
        ? {
            enemyBoosts: {
              ...(extras.enemyBoosts ?? {}),
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
   * Dev only: the catch and the wild roll the node on screen is playing — the live
   * `nodeKey`, whether that node's one catch is still unspent, the keys already spent
   * and the chance a grass step rolls at. Every field is read off the live run at call
   * time, never off a snapshot taken in `create`.
   */
  debugWildState(): {
    nodeKey: string;
    canCapture: boolean;
    capturedNodes: readonly string[];
    encounterChance: number;
  } {
    return {
      nodeKey: this.run.nodeKey,
      canCapture: canCapture(this.run),
      capturedNodes: this.run.capturedNodes,
      encounterChance: NODE_ENCOUNTER_CHANCE,
    };
  }

  /**
   * Dev only: rolls `count` wild encounters off the node's live stream, skipping
   * the chance misses and advancing that stream. Returns them in roll order, or
   * nothing with no live run, a finished run or no node on screen.
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

    // The battle's own figures land before the fold, so a member that faints in
    // this same battle still carries what it did, and the run's faint counter
    // grows by the KOs it reported (`Task-181`).
    this.run = this.bookTallies(result.tallies);
    const reward = this.rewardFor(pending.trigger);
    const before = this.run.party;
    // What the battle took out of the party is the floor mission's progress; read
    // before the fold, because the fold swaps the snapshots.
    const hpLoss = battleHpLoss(this.run, result.player);
    const { run, released, capture, events } = resolveBattle(this.run, result, reward, {
      // The detail card prints `Map <badge> · <biome> · Route <screen+1>`: the badge is
      // the node's, the screen is the one the catch happened on.
      catchLocation: {
        biomeId: this.route.biomeId,
        mapIndex: this.regionNode().badge,
        routeInMap: screenIndexOf(this.screens, this.player.y),
      },
    });
    this.run = run;
    this.run = recordHpLost(this.run, hpLoss);
    // The node's capture was already spent when the wild battle started
    // (`startBattle`); this keeps it spent even if a path ever skips that.
    if (pending.trigger.kind === 'wild') this.run = useCapture(this.run);
    // A catch narrows this node's table at once: the node is NOT rebuilt (`buildNode`
    // would restart its encounter stream), only the live exclusion is re-read.
    this.encounters.setExclusions(wildExclusions(this.run));

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
        this.endRun(false);
        return;
      }
      this.playLevelUp(levelUpBeats(before, this.run.party, events));
    };

    this.playReleaseBeats(releaseBeats(released), () => {
      // Raised inside the callback, so a permadeath overlay and the notice never
      // share the screen, and it never delays `finish()`.
      this.showPassivePickups(picks);
      if (capture?.toPc) this.showNotice(catchToPcNotice(this.memberName(capture.member)));
      finish();
    });
  }

  /**
   * Books the battle's per-member tallies onto the run: each entry's `kos`,
   * `damage` and `damageTaken` go onto the party or box member that carries its
   * `memberId`, and `stats.faints` grows by the sum of the KOs. An absent list is
   * an old caller and books nothing (`Task-181`).
   */
  private bookTallies(tallies: readonly MemberTally[] | undefined): RunState {
    if (!tallies || tallies.length === 0) return this.run;
    let run = this.run;
    let kos = 0;
    for (const tally of tallies) {
      if (tally.kos > 0) kos += tally.kos;
      const member = memberById(run, tally.memberId);
      if (member) run = updatePokemon(run, withMemberTally(member, tally));
    }
    return addFaints(run, kos);
  }

  /**
   * Ends the run once: writes its record, then opens the board. The instant is the
   * scene's (the engine reads no clock, `D11`): a run with no `startedAt` — one
   * resumed from a v25 save — reports a playtime of 0 rather than a guess, and a
   * log that already ended writes nothing, so a second arrival appends no second
   * record (`Task-181`).
   */
  private endRun(won: boolean): void {
    if (!this.run) return;
    const startedAt = this.run.startedAt;
    const started = startedAt === '' ? Number.NaN : Date.parse(startedAt);
    const playtimeMs = Number.isNaN(started) ? 0 : Math.max(0, Date.now() - started);
    const log = this.endLog ?? emptyEndLog(loadSave(browserStorage()).history);
    const next = endRun(log, this.run, {
      endedAt: new Date().toISOString(),
      playtimeMs,
      won,
    });
    this.endLog = next;
    if (next.history !== log.history) storeHistory(browserStorage(), next.history);
    const record = next.history[0];
    if (!log.ended && record !== undefined) void this.submitFinishedRun(record);
    this.scene.start('RunOver', { run: this.run, won });
  }

  /**
   * The finished run's one submission to the monthly ranking (`D56`). Fire and
   * forget: the record is already in the save, so no failure here may reach the
   * player, and the endpoint is resolved once per scene.
   */
  private async submitFinishedRun(record: RunHistoryRecord): Promise<void> {
    try {
      if (this.rankingEndpoint === undefined) {
        this.rankingEndpoint = await loadRankingEndpoint();
      }
      const endpoint = this.rankingEndpoint;
      if (endpoint === null || endpoint === undefined) return;
      await submitRanking(buildRankingEntry(record, rankingDeviceId(browserStorage())), endpoint);
    } catch {
      this.rankingEndpoint = null;
    }
  }

  /**
   * Dev only: ends the run through the real seam, so the browser pass can measure
   * it. False with no run, a finished run, or a log that already ended.
   */
  debugEndRun(won: boolean): boolean {
    if (!IS_DEVELOP || !this.run || this.gameOver || this.endLog?.ended === true) return false;
    this.gameOver = true;
    this.endRun(won);
    return true;
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
   * The level-up beat: the cue, a repaint of the cards (the party card reads the
   * squad's shared level from the run) and the learn popup (Phase 5).
   */
  private playLevelUp(beats: readonly LevelUpBeat[]): void {
    if (beats.length === 0) return;
    playCue(this, 'level-up');
    this.refreshHud();
    showLearnPopup(this.panelHost, beats);
  }

  private rewardFor(trigger: BattleTrigger): BattleReward {
    if (trigger.kind === 'wild') return { enemyLevels: [trigger.level], isTrainer: false };
    // A beaten trainer drops Poké Dollars: its archetype's base + jitter, scaled by
    // the node's band (`docs/region-spec.md` §3, D33). The roll is keyed by the run,
    // the node and the trainer, so a replay pays the same (D11).
    const archetype = trigger.archetypeId ? getTrainerArchetype(trigger.archetypeId) : undefined;
    let money: number | undefined;
    if (archetype) {
      const node = this.regionNode();
      const rng = new Rng(hashSeed(`${this.run.seed}:money:${node.key}:${trigger.trainerId}`));
      money = trainerMoney(archetype, bandForNode(node), rng);
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

  /** Destroys the route's entity overlays before a rebuild. */
  private clearRouteSprites(): void {
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
    const node = this.regionNode();
    return {
      seed: this.routeParams.seed,
      routeIndex: this.routeParams.routeIndex,
      mode: this.run.mode,
      biomeName: getBiome(this.route.biomeId).name,
      bandName: bandForNode(node).name,
      shape: this.routeParams.shape,
      width: this.routeParams.width,
      height: this.routeParams.height,
      passThrough: this.passThrough,
      hoverInspect: this.hoverInspect,
      tile: { x: this.player.x, y: this.player.y },
      ignoreEncounters: this.ignoreEncounters,
      ignoreTrainers: this.ignoreTrainers,
    };
  }

  /**
   * Dev only: the route node on screen, its screens and the screen the player stands
   * on, as plain data. Null when not developing, when the scene is not active, or
   * while a dev preview (generator step or frame-map import) is on screen.
   */
  debugRouteScreen(): Readonly<{
    nodeKey: string;
    index: number;
    tile: { x: number; y: number };
    screens: readonly Readonly<{
      index: number;
      top: number;
      bottom: number;
      spawn: { x: number; y: number };
      bands: readonly Readonly<{
        edge: 'N' | 'E' | 'S' | 'W';
        role: 'entry' | 'exit';
        neighbourKey: string;
        tiles: readonly { x: number; y: number }[];
      }>[];
    }>[];
  }> | null {
    if (!IS_DEVELOP || !this.run || !this.scene.isActive()) return null;
    if (this.screens.length === 0) return null;
    return {
      nodeKey: this.run.nodeKey,
      index: screenIndexOf(this.screens, this.player.y),
      tile: { x: this.player.x, y: this.player.y },
      screens: this.screens.map((screen) => ({
        index: screen.index,
        top: screen.top,
        bottom: screen.bottom,
        spawn: { x: screen.spawn.x, y: screen.spawn.y },
        bands: (screen.entry === null ? screen.exits : [screen.entry, ...screen.exits]).map((band) => ({
          edge: band.edge,
          role: band.role,
          neighbourKey: band.neighbourKey,
          tiles: band.tiles.map((tile) => ({ x: tile.x, y: tile.y })),
        })),
      })),
    };
  }

  /**
   * Dev only: where the last travel left the run, and how many transitions started
   * (`fades`) against travels committed (`travels`). A browser pass reads it to prove
   * the screen fades once per travel.
   */
  debugTravelState(): Readonly<{
    nodeKey: string;
    tile: { x: number; y: number };
    fades: number;
    travels: number;
  }> | null {
    if (!IS_DEVELOP || !this.run || !this.scene.isActive()) return null;
    return {
      nodeKey: this.run.nodeKey,
      tile: { x: this.player.x, y: this.player.y },
      fades: this.travelFades,
      travels: this.travelCommits,
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
   * Dev only: swaps the first undefeated trainer's archetype and redraws just that
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

    // The dev generator builds a rolled shape, not a region node: it owns no screens
    // and no point of interest, so the seam's band rule stays inert on its preview.
    this.screens = [];
    this.poi = null;
    this.stopWalking();
    this.clearRouteSprites();
    this.buildRoute(params, attempt);
    this.drawTiles();
    this.drawEntities();
    this.drawItems();
    this.drawTrainers();
    this.player = { ...this.route.entry };
    this.movePlayerTo(this.player.x, this.player.y);
  }

  /**
   * Debug only: moves the player onto a tile of the map on screen, clamped to it. A
   * solid tile is refused — the player would be stuck in it (tick *Pass through
   * obstacles* first). A teleport is a position change, not a step: it rolls no
   * encounter and runs no sight check on arrival, and it arms the band rule.
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
    // A teleport is a landed placement for the band rule, so a browser pass can stand
    // on a band and press outward without walking onto it first.
    this.bandArmed = true;
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
    this.screens = [];
    this.poi = null;
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
    return { ok: true };
  }

  override update(time: number, delta: number): void {
    // The hold-to-reset runs whatever the route is doing (a battle pauses the
    // scene, so it never fires behind another screen).
    this.updateReset(delta);
    if (!this.nodeBuilt) return;
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
    // The route's whole exit rule: a landed step onto a border band plus the key that
    // pushes outward hands the run back to the region's travel seam, before any step
    // is resolved. A fresh spawn never bounces, because the flag is only armed by a
    // landed step or a debug teleport.
    const band = this.bandArmed ? bandAt(this.screens, this.player) : null;
    if (band !== null && OUTWARD[band.edge] === direction) {
      void this.travelToNode(band.neighbourKey, 'walk');
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
    // A visible ground item or a live trainer blocks its tile, like an object in the
    // originals: the item is taken with the interact key and the trainer is talked
    // to. A hidden item can be walked over.
    if (!result || this.itemBlocks(result.to) || this.liveTrainerAt(result.to)) {
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
