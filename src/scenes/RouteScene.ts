import Phaser from 'phaser';
import { biomeForRoute } from '../data/biomes';
import { getSpecies } from '../data/dex';
import { ITEM_ICON_TEXTURE_KEY, itemIconFrame } from '../data/itemIcons';
import { getItem } from '../data/items';
import { keyLabel } from '../data/keybinds';
import { PORTRAIT_TEXTURE_KEY, portraitFrameFor } from '../data/portraits';
import {
  PLAYER_SPRITE_TEXTURE_KEY,
  PLAYER_SPRITE_WIDTH,
  playerSpriteFrame,
  type PlayerFacing,
} from '../data/playerSprite';
import { playerWalkAnimKey, playerWalkTimeScale } from '../render/playerAnim';
import { bandForRoute } from '../data/run';
import { DEBUG_MENU_TOGGLE_KEY, IS_DEVELOP } from '../dev/env';
import type { DebugRouteContext, DebugRouteInput } from '../dev/debugMenu';
import { restoreFighter, type FighterInput } from '../engine/battle';
import {
  MAX_PARTY_SIZE,
  addItem,
  addPokemon,
  battleSeed,
  canCapture,
  createRun,
  createRunPokemon,
  equipHeldItem,
  hasLivingParty,
  resolveBattle,
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
import { FLOOR, TALL_GRASS, resolveMove, tileAt, type TileMap } from '../engine/map';
import { hashSeed, Rng } from '../engine/rng';
import { storeRun, type Settings } from '../engine/save';
import {
  DEFAULT_SHAPE,
  ROUTE_HEIGHT,
  ROUTE_WIDTH,
  RouteEncounters,
  sketchRoute,
  sketchRouteSteps,
  type RouteMap,
  type RouteShape,
  type RouteStep,
} from '../engine/routes';
import { COMMON_TILE_SIZE, TILE_SIZE } from '../engine/tileset';
import { resolveTileFrame, resolveGroundFrame, grassTipKeys, treeTipKeys, type TileFrame } from '../engine/tileFrames';
import {
  parseFrameMapExport,
  routeFromFrameMapExport,
  serializeFrameMap,
} from '../engine/frameMap';
import { BAG_CATEGORIES, BAG_CATEGORY_LABELS, bagForCategory, cycleBagCategory, type BagCategory } from '../ui/bag';
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
  type PartyUiState,
  type PaneId,
} from '../ui/partyScreen';
import { FRLG_HPBAR, FRLG_HPBAR_KEY, FRLG_WINDOW_PADDING, addFrlgWindow } from '../ui/frlg';
import { hpColorInt, hpFraction } from '../ui/metrics';
import { levelUpBeats, type LevelUpBeat } from '../ui/beats';
import { RELEASE_HOLD_MS, RELEASE_INPUT_DELAY_MS, releaseBeats, type ReleaseBeat } from '../ui/permadeath';
import { FRLG_INK, addFrlgText } from '../ui/frlgFont';
import { actionKeys, subscribeKeybinds } from '../input/input';
import { loadSettings } from '../settings';
import { browserStorage } from '../storage';
import { GRASS_TEXTURE_KEY } from './BootScene';

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
const HUD_PARTY_HEADER = HUD_PAD_TOP + 16 + 12;
const HUD_PARTY_ROW = 52;
/** The party avatar, enlarged to the row height so the held-item badge reads. */
const HUD_PARTY_PORTRAIT_SCALE = 1;
/** The held-item badge on an avatar's lower-right corner. */
const HUD_HELD_ICON_SCALE = 0.6;
const HUD_BOX_HELD_ICON_SCALE = 0.7;
/** Pointer travel (px) that turns a click into a drag while grabbing a member. */
const HUD_DRAG_SLOP = 4;
/** The bag pocket tabs: four across the window's padded inner width. */
const HUD_TAB_W = 73;
const HUD_TAB_H = 26;
const HUD_TAB_GAP = 4;
const HUD_BAG_HEADER = HUD_PAD_TOP + HUD_TAB_H + 8;
const HUD_BAG_ROW = 40;
/** The 268px FRLG HP bar at 0.75 still reads cleanly and leaves room for the numbers. */
const HUD_HPBAR_SCALE = 0.75;
/** The PC BOX window: a page tab strip over a grid of avatar cells. */
const HUD_BOX_PAD = 12;
const HUD_BOX_TAB_W = 36;
const HUD_BOX_TAB_GAP = 4;
const HUD_BOX_TABS_H = HUD_PAD_TOP + HUD_TAB_H + 8;
const HUD_BOX_CELL = 76;
const HUD_BOX_CELL_GAP = 4;
const HUD_BOX_GRID_H = BOX_ROWS * HUD_BOX_CELL + (BOX_ROWS - 1) * HUD_BOX_CELL_GAP;
const HUD_BOX_H = HUD_BOX_TABS_H + HUD_BOX_GRID_H + HUD_BOX_PAD;
const HUD_BOX_MAX_PAGES = 8;

/**
 * Render depth of a wall cell's walkable tip: above the player (`10`) so the
 * character passes **behind** the crown, below the grass overlay and the HUD.
 */
const TREE_TIP_DEPTH = 20;

/** The four directions, in the order the update loop tests them. */
type MoveKey = 'up' | 'down' | 'left' | 'right';

/** How long one tile takes to cross on foot, and with the run key held. */
const WALK_STEP_MS = 200;
const RUN_STEP_MS = 110;

const MOVE_STEP: Readonly<Record<MoveKey, Tile>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
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
  /** The inputs behind the route on screen; the debug reroll rebuilds from it. */
  private routeParams!: RouteParams;
  private run!: RunState;
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
  /** The four movement keys behind the current bindings, watched every frame. */
  private moveKeys!: Record<MoveKey, Phaser.Input.Keyboard.Key | null>;
  /** The run key; held while walking, it speeds the step and the walk cycle. */
  private runKey: Phaser.Input.Keyboard.Key | null = null;
  /** The direction the player faces, for the idle frame and the walk cycle. */
  private facing: PlayerFacing = 'down';
  /** The in-flight step, while the sprite slides from one tile to the next. */
  private walkTween: Phaser.Tweens.Tween | null = null;
  private hint!: Phaser.GameObjects.BitmapText;
  private hintBackdrop!: Phaser.GameObjects.Rectangle;
  private hudRoot!: Phaser.GameObjects.Container;
  private hudTitle!: Phaser.GameObjects.BitmapText;
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
  /** Where the grab started, so a small jitter still counts as a click, not a drag. */
  private hudGrabOrigin: Phaser.Math.Vector2 | null = null;
  /** The equipment stack in hand while a bag item is dragged; null otherwise. */
  private hudDragItem: string | null = null;
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
   * Builds the route for `params` (plus the debug reroll `attempt`) and points
   * the scene at it: map, render tiles, tileset and the encounter stream.
   * `create` and the debug "regenerate" both go through here so they cannot drift.
   */
  private buildRoute(params: RouteParams, attempt = 0): void {
    const biome = biomeForRoute(params.routeIndex);
    const seed = attempt > 0 ? `${params.seed}#r${attempt}` : params.seed;
    this.routeParams = params;
    const pattern = TILESETS[biome.tilesetId].config.wallPattern;
    const wall = pattern ? { cols: pattern.cols, minHeight: Math.max(2, pattern.rows.length - 2) } : undefined;
    const request = {
      seed,
      routeIndex: params.routeIndex,
      biomeId: biome.id,
      layout: biome.layout,
      shape: params.shape,
      width: params.width,
      height: params.height,
      grassPatches: params.grassPatches,
      ledges: params.ledges,
      ...(wall ? { wall } : {}),
    };
    const route = sketchRoute(request);
    this.generatorSteps = IS_DEVELOP ? sketchRouteSteps(request) : [];
    this.applyRoute(route);
  }

  /**
   * Points the scene at an already-built route: its tiles become the live and
   * render maps, and the tileset and encounter stream follow the route's biome.
   * Both `buildRoute` and the debug frame-map import go through here so they
   * cannot drift.
   */
  private applyRoute(route: RouteMap): void {
    this.route = route;
    this.map = route.tiles;
    this.renderTiles = this.map;
    this.generatorStepIndex = null;
    const biome = biomeForRoute(route.routeIndex);
    const band = bandForRoute(route.routeIndex);
    this.tilesetId = resolveTileset(this.settings.tileset, biome.tilesetId);
    this.moveMap = this.movementMap(this.map);
    this.encounters = new RouteEncounters(
      biome.encounters[band.id],
      band.minLevel,
      band.maxLevel,
      new Rng(hashSeed(`${route.seed}:encounters:${route.routeIndex}`)),
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
    this.hudVisible = false;
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
    this.settings = loadSettings();

    const routeIndex = this.run.routeIndex;
    const biome = biomeForRoute(routeIndex);
    this.buildRoute({
      seed: this.run.seed,
      routeIndex,
      shape: DEFAULT_SHAPE,
      width: ROUTE_WIDTH,
      height: ROUTE_HEIGHT,
      grassPatches: biome.terrain.grassPatches,
      ledges: biome.terrain.ledges,
    });

    this.drawTiles();
    this.drawEntities();
    this.player = { ...this.route.entry };
    this.playerSprite = this.add
      .sprite(0, 0, PLAYER_SPRITE_TEXTURE_KEY, playerSpriteFrame('down'))
      .setOrigin(0.5, 1)
      .setScale(TILE_SIZE / PLAYER_SPRITE_WIDTH)
      .setDepth(10);
    this.movePlayerTo(this.player.x, this.player.y);

    this.cameras.main.setBounds(0, 0, this.map[0].length * TILE_SIZE, this.map.length * TILE_SIZE);
    this.cameras.main.setZoom(2);
    this.cameras.main.startFollow(this.playerSprite, true, 0.2, 0.2);

    this.refreshMoveKeys();
    this.hintBackdrop = this.add
      .rectangle(8, 8, 780, 56, 0x000000, 0.6)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(99);
    this.hint = addFrlgText(this, 16, 14, '', {
      size: 16,
      align: 'left',
    })
      .setScrollFactor(0)
      .setDepth(100);
    this.hint.setMaxWidth(760);

    subscribeKeybinds(
      this,
      ({ action }) => {
        if (!this.scene.isActive()) return;
        switch (action) {
          case 'confirm':
            if (this.releaseRoot && this.releaseArmed) this.advanceRelease();
            return;
          case 'party':
          case 'hud':
            this.toggleHud();
            return;
          case 'settings':
            this.openSettings();
            return;
        }
      },
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
    this.hint.setDepth(200);
    this.setHint(this.defaultHint());
    this.refreshHud();
  }

  /** Resolves the movement keys from the shared map; re-run when it changes. */
  private refreshMoveKeys(): void {
    const bind = (action: MoveKey): Phaser.Input.Keyboard.Key | null =>
      actionKeys(this, action, this.settings.keybinds)[0] ?? null;
    this.moveKeys = { up: bind('up'), down: bind('down'), left: bind('left'), right: bind('right') };
    this.runKey = actionKeys(this, 'run', this.settings.keybinds)[0] ?? null;
  }

  /** The resting line, spelled with whatever keys the player has bound. */
  private defaultHint(): string {
    const { up, down, left, right, run, party, hud, settings } = this.settings.keybinds;
    return `Walk the route.  ${keyLabel(up)}${keyLabel(down)}${keyLabel(left)}${keyLabel(right)} move   ·   hold ${keyLabel(run)} run   ·   ${keyLabel(party)} party   ·   ${keyLabel(hud)} HUD   ·   ${keyLabel(settings)} settings`;
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
    const children: Phaser.GameObjects.GameObject[] = [];

    const header = addFrlgWindow(this, x, HUD_TOP, HUD_PANEL_W, HUD_HEADER_H);
    this.hudTitle = addFrlgText(this, left, HUD_TOP + HUD_PAD_TOP, '', { size: 16, tint: FRLG_INK });
    children.push(header, this.hudTitle);

    const partyY = HUD_TOP + HUD_HEADER_H + HUD_GAP;
    const partyH = HUD_PARTY_HEADER + MAX_PARTY_SIZE * HUD_PARTY_ROW + HUD_PAD_BOTTOM;
    this.hudX = x;
    this.hudPartyY = partyY;
    this.hudPartyH = partyH;
    children.push(addFrlgWindow(this, x, partyY, HUD_PANEL_W, partyH));
    children.push(addFrlgText(this, x + HUD_PAD_X, partyY + HUD_PAD_TOP, 'PARTY', { size: 16, tint: 0x3a3956 }));
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
        .image(portraitX + 18, rowY + 44, ITEM_ICON_TEXTURE_KEY, 0)
        .setScale(HUD_HELD_ICON_SCALE)
        .setVisible(false);
      const column = left + 52;
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
      children.push(highlight, portrait, held, name, level, bar, fill, hpText);
    }

    const bagY = partyY + partyH + HUD_GAP;
    const bagH = HUD_BAG_HEADER + HUD_BAG_ROWS * HUD_BAG_ROW + HUD_PAD_BOTTOM;
    this.hudBagY = bagY;
    this.hudBagH = bagH;
    children.push(addFrlgWindow(this, x, bagY, HUD_PANEL_W, bagH));

    // Pocket tabs across the window's head, FRLG style: the active one reads
    // dark-on-light, the rest stay a pale folder. Click or `[` / `]` to switch.
    this.hudBagTabs = [];
    BAG_CATEGORIES.forEach((category, i) => {
      const tabX = left + i * (HUD_TAB_W + HUD_TAB_GAP);
      const tabY = bagY + HUD_PAD_TOP;
      const bg = this.add.rectangle(tabX, tabY, HUD_TAB_W, HUD_TAB_H, 0xcfcce2).setOrigin(0, 0);
      const label = addFrlgText(this, tabX + HUD_TAB_W / 2, tabY + 5, BAG_CATEGORY_LABELS[category], {
        size: 16,
        tint: FRLG_INK,
        origin: [0.5, 0],
      });
      this.hudBagTabs.push({ category, bg, label });
      children.push(bg, label);
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
      children.push(icon, name, count);
    }

    this.hudBagEmpty = addFrlgText(this, x + HUD_PANEL_W / 2, bagY + HUD_BAG_HEADER + 36, 'no items', {
      size: 16,
      tint: 0x6b6887,
      origin: [0.5, 0],
    });
    children.push(this.hudBagEmpty);

    // The PC BOX window: a page tab strip over a grid of avatar cells, in a
    // second column to the left of the party/bag stack.
    const boxX = x - HUD_PANEL_W - HUD_GAP;
    const boxY = HUD_TOP + 64;
    this.hudBoxX = boxX;
    this.hudBoxY = boxY;
    this.hudBoxH = HUD_BOX_H;
    children.push(addFrlgWindow(this, boxX, boxY, HUD_PANEL_W, HUD_BOX_H));

    this.hudBoxTabs = [];
    for (let page = 0; page < HUD_BOX_MAX_PAGES; page++) {
      const tabX = boxX + HUD_BOX_PAD + page * (HUD_BOX_TAB_W + HUD_BOX_TAB_GAP);
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
      children.push(bg, label);
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
        .setScale(1.4)
        .setVisible(false);
      const held = this.add
        .image(cellX + 62, cellY + 62, ITEM_ICON_TEXTURE_KEY, 0)
        .setScale(HUD_BOX_HELD_ICON_SCALE)
        .setVisible(false);
      this.hudBoxCells.push({ highlight, bg, portrait, held });
      children.push(bg, highlight, portrait, held);
    }

    // The avatar held in hand while dragging, drawn last so it rides over the
    // panels and follows the pointer anywhere on screen.
    this.hudDragGhost = this.add
      .image(0, 0, PORTRAIT_TEXTURE_KEY, 0)
      .setScale(1.2)
      .setVisible(false);
    children.push(this.hudDragGhost);

    this.hudRoot = this.add.container(0, 0, children).setDepth(150).setVisible(this.hudVisible);
  }

  /** Shows or hides the route HUD overlay (route header, party, PC box and bag). Default hidden. */
  private toggleHud(): void {
    this.hudVisible = !this.hudVisible;
    if (!this.hudVisible) {
      this.hudUi = dropGrabbed(this.hudUi);
      this.hudGrabMoved = false;
      this.hudGrabOrigin = null;
      this.hudDragItem = null;
      this.hudDragGhost.setVisible(false);
      this.input.setDefaultCursor('default');
    }
    this.hudRoot.setVisible(this.hudVisible);
  }

  private refreshHud(): void {
    if (!this.hudRoot) return;
    this.hudTitle.setText(`Route ${this.run.routeIndex} · ${biomeForRoute(this.run.routeIndex).name}`);

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
      const frame = portraitFrameFor(member.fighter.speciesId);
      row.portrait.setVisible(frame !== null);
      if (frame !== null) row.portrait.setFrame(frame);
      const heldFrame = member.fighter.heldItem ? itemIconFrame(member.fighter.heldItem) : null;
      row.held.setVisible(heldFrame !== null);
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

    const bag = bagForCategory(this.run.bag, this.hudBagCategory).slice(0, HUD_BAG_ROWS);
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
      const frame = member ? portraitFrameFor(member.speciesId) : null;
      cell.portrait.setVisible(frame !== null);
      if (frame !== null) cell.portrait.setFrame(frame);
      const heldFrame = member?.heldItem ? itemIconFrame(member.heldItem) : null;
      cell.held.setVisible(heldFrame !== null);
      if (heldFrame !== null) cell.held.setFrame(heldFrame);
      cell.highlight.setVisible(this.hudUi.grabbed?.pane === 'box' && this.hudUi.index === index);
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
   * HUD pointer input. A press on a bag or box tab selects it; a press on a
   * party row or a box cell picks that member up (gold highlight), a drag over
   * the same pane reorders it live, and a release over the other pane moves it
   * between the party and the PC box. A press on an equipment stack picks the
   * item up and a release over a member equips it. A plain click also works:
   * pick a member, then click a slot. The cursor becomes a grab hand over a
   * member or an equippable stack.
   */
  private handleHudPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.scene.isActive() || !this.hudVisible) return;
    if (this.selectBagTab(pointer)) return;
    if (this.selectBoxTab(pointer)) return;
    if (!this.hudUi.grabbed) {
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
      return;
    }
    if (grabbed) {
      if (grabbed.pane === target.pane) {
        const next = dragTo(this.run, this.hudUi, target.index);
        this.run = next.run;
        this.hudUi = dropGrabbed(next.ui);
      } else {
        this.moveHudAcross(grabbed.pane);
        return;
      }
      this.finishHudGrab();
      return;
    }
    const next = grabAt(this.run, this.hudUi, target.pane, target.index);
    this.run = next.run;
    this.hudUi = next.ui;
    this.hudGrabMoved = false;
    this.hudGrabOrigin = new Phaser.Math.Vector2(pointer.x, pointer.y);
    this.showHudGhost(target.pane, target.index, pointer);
    this.refreshHud();
  }

  /** Shows the grabbed member's avatar in hand, following the pointer. */
  private showHudGhost(pane: PaneId, index: number, pointer: Phaser.Input.Pointer): void {
    const member = pane === 'party' ? this.run.party[index] : this.run.box[index];
    const frame = member ? portraitFrameFor(member.fighter.speciesId) : null;
    if (frame === null) {
      this.hudDragGhost.setVisible(false);
      return;
    }
    this.hudDragGhost
      .setTexture(PORTRAIT_TEXTURE_KEY, frame)
      .setPosition(pointer.x, pointer.y)
      .setVisible(true);
  }

  /** Picks an equipment stack up so it can be dropped on a member to equip it. */
  private startHudItemDrag(itemId: string, pointer: Phaser.Input.Pointer): void {
    const frame = itemIconFrame(itemId);
    if (frame === null) return;
    this.hudDragItem = itemId;
    this.hudGrabMoved = false;
    this.hudGrabOrigin = new Phaser.Math.Vector2(pointer.x, pointer.y);
    this.hudDragGhost
      .setTexture(ITEM_ICON_TEXTURE_KEY, frame)
      .setPosition(pointer.x, pointer.y)
      .setVisible(true);
    this.input.setDefaultCursor('grabbing');
  }

  private handleHudPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.scene.isActive()) return;
    if (!this.hudVisible) {
      this.input.setDefaultCursor('default');
      return;
    }
    if (this.hudDragItem !== null) {
      this.hudDragGhost.setPosition(pointer.x, pointer.y);
      this.input.setDefaultCursor('grabbing');
      return;
    }
    const target = this.hudTarget(pointer);
    const overItem = this.hudUi.grabbed === null && this.hudHeldStackAt(pointer) !== null;
    this.input.setDefaultCursor(
      this.hudUi.grabbed ? 'grabbing' : target || overItem ? 'grab' : 'default',
    );
    if (!this.hudUi.grabbed) return;
    this.hudDragGhost.setPosition(pointer.x, pointer.y);
    // Any real move turns the click into a drag, so releasing anywhere drops.
    if (
      this.hudGrabOrigin &&
      Math.hypot(pointer.x - this.hudGrabOrigin.x, pointer.y - this.hudGrabOrigin.y) > HUD_DRAG_SLOP
    ) {
      this.hudGrabMoved = true;
    }
    if (!target || target.pane !== this.hudUi.grabbed.pane) return;
    const next = dragTo(this.run, this.hudUi, target.index);
    if (next.run === this.run && next.ui === this.hudUi) return;
    this.run = next.run;
    this.hudUi = next.ui;
    this.refreshHud();
  }

  private handleHudPointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.hudDragItem !== null) {
      const target = this.hudTarget(pointer);
      const itemId = this.hudDragItem;
      this.endHudItemDrag();
      if (target) this.equipHudItem(itemId, target);
      return;
    }
    const grabbed = this.hudUi.grabbed;
    // A drag dropped over the other pane moves the member across; otherwise it
    // just drops where it last pointed. There is no cancel.
    if (!grabbed || !this.hudGrabMoved) return;
    const across = grabbed.pane === 'party' ? this.pointerInBoxPanel(pointer) : this.pointerInPartyPanel(pointer);
    if (across) this.moveHudAcross(grabbed.pane);
    else this.dropHudGrab();
  }

  /** Equips the dragged stack to the member under the drop, saving the swap. */
  private equipHudItem(itemId: string, target: { pane: PaneId; index: number }): void {
    const member = target.pane === 'party' ? this.run.party[target.index] : this.run.box[target.index];
    if (!member) return;
    const next = equipHeldItem(this.run, member.fighter.id, itemId);
    if (next === this.run) return;
    this.run = next;
    this.persistRun();
    this.refreshHud();
  }

  /** Puts the dragged stack down and clears the in-hand state. */
  private endHudItemDrag(): void {
    this.hudDragItem = null;
    this.hudGrabMoved = false;
    this.hudGrabOrigin = null;
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

  /** Drops the grabbed member where it stands, saves it and redraws the HUD. */
  private dropHudGrab(): void {
    this.hudUi = dropGrabbed(this.hudUi);
    this.finishHudGrab();
  }

  private finishHudGrab(): void {
    this.hudGrabMoved = false;
    this.hudGrabOrigin = null;
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
    const rowTop = this.hudPartyY + HUD_PARTY_HEADER;
    const slot = Math.floor((pointer.y - rowTop) / HUD_PARTY_ROW);
    if (pointer.y < rowTop || slot < 0 || slot >= MAX_PARTY_SIZE) return null;
    return slot < this.run.party.length ? slot : null;
  }

  /** The box index under the pointer, or null outside a filled cell. */
  private hudBoxCellAt(pointer: Phaser.Input.Pointer): number | null {
    const gridW = BOX_COLS * HUD_BOX_CELL + (BOX_COLS - 1) * HUD_BOX_CELL_GAP;
    const gridLeft = this.hudBoxX + HUD_BOX_PAD + (HUD_PANEL_W - HUD_BOX_PAD * 2 - gridW) / 2;
    const stride = HUD_BOX_CELL + HUD_BOX_CELL_GAP;
    const col = Math.floor((pointer.x - gridLeft) / stride);
    const row = Math.floor((pointer.y - (this.hudBoxY + HUD_BOX_TABS_H)) / stride);
    if (col < 0 || col >= BOX_COLS || row < 0 || row >= BOX_ROWS) return null;
    const index = boxCellIndex(this.hudBoxPage, col, row);
    return index < this.run.box.length ? index : null;
  }

  private pointerInPartyPanel(pointer: Phaser.Input.Pointer): boolean {
    return (
      pointer.x >= this.hudX &&
      pointer.x <= this.hudX + HUD_PANEL_W &&
      pointer.y >= this.hudPartyY &&
      pointer.y <= this.hudPartyY + this.hudPartyH
    );
  }

  private pointerInBoxPanel(pointer: Phaser.Input.Pointer): boolean {
    return (
      pointer.x >= this.hudBoxX &&
      pointer.x <= this.hudBoxX + HUD_PANEL_W &&
      pointer.y >= this.hudBoxY &&
      pointer.y <= this.hudBoxY + this.hudBoxH
    );
  }

  /** The bag stack under the pointer in the active pocket, or null. */
  private hudBagStackAt(pointer: Phaser.Input.Pointer): string | null {
    if (!this.pointerInBagPanel(pointer)) return null;
    const bag = bagForCategory(this.run.bag, this.hudBagCategory);
    const rowTop = this.hudBagY + HUD_BAG_HEADER;
    const slot = Math.floor((pointer.y - rowTop) / HUD_BAG_ROW);
    if (pointer.y < rowTop || slot < 0 || slot >= HUD_BAG_ROWS) return null;
    return bag[slot]?.itemId ?? null;
  }

  /** The equippable (held) bag stack under the pointer, or null. */
  private hudHeldStackAt(pointer: Phaser.Input.Pointer): string | null {
    const itemId = this.hudBagStackAt(pointer);
    return itemId !== null && getItem(itemId)?.kind === 'held' ? itemId : null;
  }

  private pointerInBagPanel(pointer: Phaser.Input.Pointer): boolean {
    return (
      pointer.x >= this.hudX &&
      pointer.x <= this.hudX + HUD_PANEL_W &&
      pointer.y >= this.hudBagY &&
      pointer.y <= this.hudBagY + this.hudBagH
    );
  }

  /** A press on a bag pocket tab selects it; true when it handled the press. */
  private selectBagTab(pointer: Phaser.Input.Pointer): boolean {
    const tab = this.hudBagTabs.find(
      (entry) =>
        pointer.x >= entry.bg.x &&
        pointer.x <= entry.bg.x + entry.bg.width &&
        pointer.y >= entry.bg.y &&
        pointer.y <= entry.bg.y + entry.bg.height,
    );
    if (!tab) return false;
    this.hudBagCategory = tab.category;
    this.refreshHud();
    return true;
  }

  /** A press on a PC box page tab selects it; true when it handled the press. */
  private selectBoxTab(pointer: Phaser.Input.Pointer): boolean {
    const tab = this.hudBoxTabs.find(
      (entry) =>
        entry.bg.visible &&
        pointer.x >= entry.bg.x &&
        pointer.x <= entry.bg.x + entry.bg.width &&
        pointer.y >= entry.bg.y &&
        pointer.y <= entry.bg.y + entry.bg.height,
    );
    if (!tab) return false;
    this.hudBoxPage = tab.page;
    this.refreshHud();
    return true;
  }

  /** Two cameras: one follows the world, one pins the HUD (hint + overlay) to the screen. */
  private setupHudCamera(): void {
    const hud = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    hud.setScroll(0, 0);
    const keep = new Set<Phaser.GameObjects.GameObject>([this.hint, this.hintBackdrop, this.hudRoot]);
    hud.ignore(this.children.list.filter((child) => !keep.has(child)));
    this.cameras.main.ignore([this.hint, this.hintBackdrop, this.hudRoot]);
    this.hudCamera = hud;
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
    this.setHint(`tileset: ${TILESETS[id].name}`);
  }

  /** Snaps the sprite to a tile, without a step. */
  private movePlayerTo(x: number, y: number): void {
    this.player = { x, y };
    // The 16x32 FRLG frame stands with its feet on the tile's bottom edge, the
    // same placement the route's trainers use.
    this.playerSprite.setPosition(this.centerX(x), this.centerY(y) + TILE_SIZE / 2);
  }

  /** Turns the sprite to face a direction, flipping the left-facing side frame. */
  private face(direction: MoveKey): void {
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
    const running = this.runKey?.isDown ?? false;
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

  /** Stands still and shows the resting frame, once no step is in flight. */
  private settleMovement(): void {
    if (this.walkTween || !this.playerSprite.anims.isPlaying) return;
    this.playerSprite.anims.stop();
    this.playerSprite.setFrame(playerSpriteFrame(this.facing));
  }

  private onTileEntered(): void {
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
          key: `grass:${this.player.x},${this.player.y}`,
          tile: { x: this.player.x, y: this.player.y },
        });
        return;
      }
    }
    this.setHint(this.defaultHint());
  }

  /** Opens the settings screen paused-on-top, like a battle (`O`). */
  private openSettings(): void {
    if (this.gameOver || this.pendingBattle || this.releaseRoot) return;
    this.scene.pause();
    this.scene.launch('Settings', { from: 'Route' });
  }

  /**
   * Called by `SettingsScene` before it closes: re-reads the preferences and
   * re-renders the route with the tileset they now ask for (D10 keeps the
   * biome's own tileset until the player forces another one).
   */
  applySettings(): void {
    this.settings = loadSettings();
    const wanted = resolveTileset(this.settings.tileset, biomeForRoute(this.run.routeIndex).tilesetId);
    if (wanted !== this.tilesetId) this.applyTileset(wanted);
    // A rebind happened behind this screen; re-resolve the movement keys and the
    // resting line so the new keys are live the moment the route resumes.
    this.refreshMoveKeys();
    this.setHint(this.defaultHint());
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

  /** Called by `BattleScene` before it stops: folds the result back into the run. */
  applyBattleResult(result: BattleReturn): void {
    const pending = this.pendingBattle;
    this.pendingBattle = null;
    if (!pending) return;

    const reward = this.rewardFor(pending.trigger);
    const before = this.run.party;
    const { run, released, events } = resolveBattle(this.run, result, reward);
    this.run = run;
    this.persistRun();
    this.refreshHud();

    const over = !hasLivingParty(this.run);
    this.gameOver = over;
    this.playReleaseBeats(releaseBeats(released), () => {
      if (over) {
        this.scene.start('RunOver', { run: this.run, won: false });
        return;
      }
      const notes: string[] = [result.message];
      if (events.some((event) => event.kind === 'level')) notes.push('Level up!');
      if (events.some((event) => event.kind === 'evolve')) notes.push('It evolved!');
      this.setHint(notes.join('  '));
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
    this.releasePortrait = this.add.image(width / 2, y + 96, PORTRAIT_TEXTURE_KEY, 0).setScale(3);
    this.releaseText = addFrlgText(this, width / 2, y + 168, '', { align: 'center', origin: 0.5 });
    this.releaseText.setMaxWidth(panelW - 48);
    const hint = addFrlgText(this, width / 2, y + panelH + 28, 'Z — continue', {
      size: 16,
      tint: 0x94a3b8,
      origin: 0.5,
    });
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
    const frame = portraitFrameFor(beat.speciesId);
    this.releasePortrait.setVisible(frame !== null);
    if (frame !== null) this.releasePortrait.setFrame(frame);
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
    for (const sprite of this.entitySprites) sprite.destroy();
    this.entitySprites = [];
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
      biomeName: biomeForRoute(this.routeParams.routeIndex).name,
      bandName: bandForRoute(this.routeParams.routeIndex).name,
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

    this.stopWalking();
    this.clearRouteSprites();
    this.buildRoute(params, attempt);
    this.drawTiles();
    this.drawEntities();
    this.player = { ...this.route.entry };
    this.movePlayerTo(this.player.x, this.player.y);
    this.cameras.main.setBounds(0, 0, this.map[0].length * TILE_SIZE, this.map.length * TILE_SIZE);
    this.setHint(`debug: re-generated route ${params.routeIndex} (attempt ${attempt})`);
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
    const route = routeFromFrameMapExport(exported);
    this.generatorSteps = [];
    this.applyRoute(route);
    const biome = biomeForRoute(route.routeIndex);
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
    this.player = { ...route.entry };
    this.movePlayerTo(this.player.x, this.player.y);
    this.cameras.main.setBounds(0, 0, this.map[0].length * TILE_SIZE, this.map.length * TILE_SIZE);
    this.setHint(`debug: imported map ${route.width}x${route.height}`);
    return { ok: true };
  }

  private setHint(text: string): void {
    const dev = IS_DEVELOP ? `  ·  B: random battle  ·  ${DEBUG_MENU_TOGGLE_KEY}: debug menu` : '';
    const { party, hud } = this.settings.keybinds;
    this.hint.setText(`${text}\nArrows: move  ·  ${keyLabel(party)}/${keyLabel(hud)}: HUD (party/PC)${dev}`);
  }

  override update(): void {
    if (this.gameOver || this.pendingBattle || this.releaseRoot) {
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
    if (!result) {
      this.faceIdle(direction);
      return;
    }
    this.walkStep(direction, result.to);
  }

  /**
   * The direction the player is pushing. A held key keeps walking; a fresh tap
   * counts even if it is released before the next frame, so a quick press still
   * moves a tile.
   */
  private heldDirection(): MoveKey | null {
    const { up, down, left, right } = this.moveKeys;
    const pressed = (key: Phaser.Input.Keyboard.Key | null): boolean =>
      key !== null && (key.isDown || Phaser.Input.Keyboard.JustDown(key));
    if (pressed(left)) return 'left';
    if (pressed(right)) return 'right';
    if (pressed(up)) return 'up';
    if (pressed(down)) return 'down';
    return null;
  }
}
