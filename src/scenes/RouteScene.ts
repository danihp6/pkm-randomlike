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
  advanceRoute,
  battleSeed,
  canCapture,
  createRun,
  createRunPokemon,
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
/** The bag pocket tabs: four across the window's padded inner width. */
const HUD_TAB_W = 73;
const HUD_TAB_H = 26;
const HUD_TAB_GAP = 4;
const HUD_BAG_HEADER = HUD_PAD_TOP + HUD_TAB_H + 8;
const HUD_BAG_ROW = 40;
/** The 268px FRLG HP bar at 0.75 still reads cleanly and leaves room for the numbers. */
const HUD_HPBAR_SCALE = 0.75;

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
  /** What the party/PC screen was opened for, while it is open. */
  private pendingParty: 'field' | 'rest' | null = null;
  /** Set when the rest stop closes: advance the route on the next update. */
  private advanceAfterParty = false;
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
  private hudRows: {
    portrait: Phaser.GameObjects.Image;
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
    this.pendingParty = null;
    this.advanceAfterParty = false;
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
            this.openParty('field');
            return;
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
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.handleHudClick(pointer));
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
    children.push(addFrlgWindow(this, x, partyY, HUD_PANEL_W, partyH));
    children.push(addFrlgText(this, left, partyY + HUD_PAD_TOP, 'PARTY', { size: 16, tint: 0x3a3956 }));
    this.hudRows = [];
    for (let i = 0; i < MAX_PARTY_SIZE; i++) {
      const rowY = partyY + HUD_PARTY_HEADER + i * HUD_PARTY_ROW;
      const portrait = this.add
        .image(left + 14, rowY + 26, PORTRAIT_TEXTURE_KEY, 0)
        .setScale(0.7)
        .setVisible(false);
      const name = addFrlgText(this, left + 30, rowY + 6, '', { size: 16, tint: FRLG_INK });
      const level = addFrlgText(this, right, rowY + 6, '', {
        size: 16,
        tint: 0x3a3956,
        origin: [1, 0],
      });
      const bar = this.add
        .image(left + 30, rowY + 28, FRLG_HPBAR_KEY)
        .setOrigin(0, 0)
        .setScale(HUD_HPBAR_SCALE)
        .setVisible(false);
      const fill = this.add
        .rectangle(left + 30, rowY + 28, 0, FRLG_HPBAR.fill.height * HUD_HPBAR_SCALE, 0x58d080)
        .setOrigin(0, 0)
        .setVisible(false);
      const hpText = addFrlgText(this, right, rowY + 30, '', {
        size: 16,
        tint: FRLG_INK,
        origin: [1, 0],
      });
      this.hudRows.push({ portrait, name, level, hpText, bar, fill });
      children.push(portrait, name, level, bar, fill, hpText);
    }

    const bagY = partyY + partyH + HUD_GAP;
    const bagH = HUD_BAG_HEADER + HUD_BAG_ROWS * HUD_BAG_ROW + HUD_PAD_BOTTOM;
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

    this.hudRoot = this.add.container(0, 0, children).setDepth(150).setVisible(this.hudVisible);
  }

  /** Shows or hides the route HUD overlay (route header, party and bag). Default hidden. */
  private toggleHud(): void {
    this.hudVisible = !this.hudVisible;
    this.hudRoot.setVisible(this.hudVisible);
  }

  private refreshHud(): void {
    if (!this.hudRoot) return;
    this.hudTitle.setText(`Route ${this.run.routeIndex} · ${biomeForRoute(this.run.routeIndex).name}`);

    this.hudRows.forEach((row, i) => {
      const member = this.run.party[i];
      const visible = member !== undefined;
      const alive = member !== undefined && member.fighter.hp > 0;
      row.name.setVisible(visible);
      row.level.setVisible(visible);
      row.hpText.setVisible(visible);
      row.bar.setVisible(alive);
      row.fill.setVisible(alive);
      if (!member) {
        row.portrait.setVisible(false);
        row.name.setText('');
        row.level.setText('');
        row.hpText.setText('');
        return;
      }
      const frame = portraitFrameFor(member.fighter.speciesId);
      row.portrait.setVisible(frame !== null);
      if (frame !== null) row.portrait.setFrame(frame);
      const maxHp = restoreFighter(member.fighter).maxHp;
      const hp = member.fighter.hp;
      row.name.setText(getSpecies(member.fighter.speciesId)?.name ?? member.fighter.speciesId);
      row.level.setText(`Lv${member.fighter.level}`);
      row.hpText.setText(`${hp}/${maxHp}`);
      const fraction = hpFraction(hp, maxHp);
      row.fill
        .setPosition(
          row.bar.x + FRLG_HPBAR.fill.x * HUD_HPBAR_SCALE,
          row.bar.y + FRLG_HPBAR.fill.y * HUD_HPBAR_SCALE,
        )
        .setSize(
          Math.max(0, FRLG_HPBAR.fill.width * HUD_HPBAR_SCALE * fraction),
          FRLG_HPBAR.fill.height * HUD_HPBAR_SCALE,
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
  }

  /** Switches the bag's pocket by `offset` tabs and redraws the list. */
  private stepBagCategory(offset: number): void {
    this.hudBagCategory = cycleBagCategory(this.hudBagCategory, offset);
    this.refreshHud();
  }

  /** A click on a bag pocket tab selects it; only meaningful while the HUD shows. */
  private handleHudClick(pointer: Phaser.Input.Pointer): void {
    if (!this.scene.isActive() || !this.hudVisible) return;
    const tab = this.hudBagTabs.find(
      (entry) =>
        pointer.x >= entry.bg.x &&
        pointer.x <= entry.bg.x + entry.bg.width &&
        pointer.y >= entry.bg.y &&
        pointer.y <= entry.bg.y + entry.bg.height,
    );
    if (!tab) return;
    this.hudBagCategory = tab.category;
    this.refreshHud();
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

  /** Opens the party/PC screen paused-on-top, like a battle (party key, or the rest stop). */
  private openParty(mode: 'field' | 'rest'): void {
    if (this.gameOver || this.pendingBattle || this.pendingParty || this.releaseRoot) return;
    this.pendingParty = mode;
    this.scene.pause();
    this.scene.launch('Party', { run: this.run, mode });
  }

  /** Opens the settings screen paused-on-top, like the party screen (`O`). */
  private openSettings(): void {
    if (this.gameOver || this.pendingBattle || this.pendingParty || this.releaseRoot) return;
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

  /** Called by `PartyScene` before it stops: adopts the managed run. */
  applyPartyResult(run: RunState): void {
    if (!this.pendingParty) return;
    const mode = this.pendingParty;
    this.pendingParty = null;
    this.run = run;
    this.persistRun();
    if (mode === 'rest') {
      // The route advances on the next update, once the screen has closed.
      this.advanceAfterParty = true;
      return;
    }
    this.refreshHud();
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
    if (!this.scene.isActive() || this.gameOver || this.pendingBattle || this.pendingParty || this.releaseRoot) {
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
    this.hint.setText(`${text}\nArrows: move  ·  ${keyLabel(party)}: party/PC  ·  ${keyLabel(hud)}: HUD${dev}`);
  }

  override update(): void {
    if (this.advanceAfterParty) {
      this.advanceAfterParty = false;
      this.run = advanceRoute(this.run);
      this.persistRun();
      // Restart with the advanced run: Phaser reuses a scene's previous start
      // data on `restart()`, so without this the route would boot the old run.
      this.scene.restart({ run: this.run });
      return;
    }
    if (this.gameOver || this.pendingBattle || this.pendingParty || this.releaseRoot) {
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
