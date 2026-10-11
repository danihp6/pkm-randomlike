import Phaser from 'phaser';
import { getMove, heightOf } from '../data/dex';
import { megaFormForItem } from '../data/dex/megas';
import { getItem } from '../data/items';
import { ITEM_ICON_TEXTURE_KEY, itemIconFrame } from '../data/itemIcons';
import { type KeybindAction, type Keybinds } from '../data/keybinds';
import { pokemonIdleAnimKey, pokemonSprite, type PokemonSpriteKind, type PokemonSpriteSheet } from '../data/pokemonSprites';
import { getTrainerArchetype } from '../data/trainers';
import { TRAINER_SPRITE_TEXTURE_KEY, trainerSpriteFrame } from '../data/trainerSprites';
import { legalMoveIndices, type Command } from '../engine/battle/commands';
import { createFighter, restoreFighter, snapshotFighter, type BattleFighter, type StatusId } from '../engine/battle/fighter';
import { movePreview } from '../engine/battle/preview';
import { chooseAiCommand } from '../engine/battle/ai';
import { canRun } from '../engine/battle/runAway';
import type { BattleEvent } from '../engine/battle/state';
import {
  activeFighter,
  autoReplace,
  canMegaEvolve,
  createBattle,
  needsReplacement,
  performSwitch,
  takeTurn,
  type BattleState,
  type SideId,
} from '../engine/battle';
import { Rng } from '../engine/rng';
import { MAX_MOVES, MAX_PARTY_SIZE, experienceFraction, type BattleLaunch, type BattleOutcome, type BattleReturn } from '../engine/run';
import { PORTRAIT_SIZE, PORTRAIT_TEXTURE_KEY, portraitFor } from '../data/portraits';
import { MOVE_FX_TEXTURE_KEY, moveFxAnimKey, moveFxFor, moveFxTrack } from '../render/moveFx';
import { spriteContentBounds, type SpriteBounds } from '../render/spriteBounds';
import { battleSpriteHeight, SPRITE_SIZE_MAX } from '../data/spriteSize';
import {
  FAINT_DROP,
  FAINT_MS,
  SWITCH_RECALL_MS,
  SWITCH_SENDOUT_MS,
  SWITCH_SHRINK,
} from '../ui/beats';
import { CAPTURE_SHAKE_SPEED, captureBeat } from '../ui/capture';
import { BAG_CATEGORY_LABELS, bagCategoryForKind, type BagCategory } from '../ui/bag';
import { battleFrames, type FeedFrame } from '../ui/feed';
import { hpColorInt, hpFraction, statusAbbreviation } from '../ui/metrics';
import { drawGauge } from '../ui/panel';
import {
  advanceTypewriter,
  beginTypewriter,
  revealAll,
  TEXT_SPEED_MS,
  typewriterDone,
  visibleText,
  type Typewriter,
} from '../ui/typewriter';
import { loadSettings } from '../settings';
import { actionKeys, subscribeKeybinds } from '../input/input';
import { addFrlgHpBar, addFrlgWindow, FRLG_CURSOR_KEY, FRLG_HPBAR, FRLG_HPBAR_KEY, FRLG_TEXTBOX_PADDING, FRLG_WINDOW_PADDING } from '../ui/frlg';
import { FRLG_INK, FRLG_FONT_SIZE, addFrlgText } from '../ui/frlgFont';
import { typeColor, typeTint } from '../ui/typeColors';
import { STATUS_ICON_TEXTURE_KEY, statusIconFrame } from '../data/statusIcons';
import {
  DETAIL_STATS,
  NATURE_DOWN_TINT,
  NATURE_UP_TINT,
  STAT_LABELS,
  fighterDetail,
  natureEffect,
} from '../ui/partyDetail';
import { MoveGrid, type MoveGridCell } from '../ui/moveGrid';
import { BATTLE_MON_TEXTURE_KEY, BATTLE_PLATFORM_TEXTURE_KEY } from './BootScene';
import type { RouteScene } from './RouteScene';

const MESSAGE_HOLD_MS = 900;
const FAST_HOLD_MS = 45;
/** How long the win / loss / catch line stays up before the battle closes itself. */
const OUTCOME_HOLD_MS = 1300;
const MENU_ROWS = 4;
const MENU_W = 540;
const MESSAGE_H = 124;
const PANEL_W = 320;
const PLAYER_PANEL_W = 320;
/** Tall enough for the padded name (16 + 32), the bar and the XP row. */
const PLAYER_PANEL_H = 148;
const FOE_PANEL = { w: PANEL_W, h: 114 } as const;
/** Gap between the padded name and the HP bar inside an HP panel. */
const PANEL_NAME_H = 32;
const PANEL_NAME_GAP = 26;
const ROW_H = 34;
/** The battle plays inside a centred square, at most this many pixels a side. */
const MAX_BATTLE_SIZE = 900;
/** Below this square side the stacked, full-width phone layout is used. */
const COMPACT_SIZE = 700;
/** The bag pocket tabs drawn inside the menu window, as in the route HUD. */
const MENU_TAB_W = 120;
const MENU_TAB_H = 26;
const MENU_TAB_GAP = 4;
/** Bag rows that fit under the tab strip in the 160px menu window. */
const MENU_BAG_ROWS = 3;
/** The FIGHT / BAG / SWITCH / RUN grid: 2 columns, one gap and one inset. */
const MENU_GRID_COLS = 2;
const MENU_GRID_GAP = 8;
/** Width reserved at the left of the command grid for the ◀ back control. */
const MOVE_BACK_COL = 64;
/** Width reserved at the right of the moves grid for the Mega control (D34). */
const MOVE_MEGA_COL = 62;
const MOVE_GRID_INSET = 8;
/** How far above the menu the party detail window (and the info popup) sits. */
const MOVE_POPUP_GAP = 8;
/** The party (switch) grid: 3 columns of avatar cells. */
const PARTY_COLS = 3;
const PARTY_AVATAR_SCALE = 0.9;
/** The HP bar drawn inside every switch cell; the detail popup carries the numbers. */
const PARTY_CELL_HPBAR_SCALE = 0.4;
/**
 * Fallback zoom for the placeholder mon and any sheet whose pixels cannot be
 * measured; a real sprite is sized from its species' canonical height instead
 * (see `src/data/spriteSize.ts`). The platform offsets put every sprite's feet
 * on the platform, whatever its size.
 */
const MON_SCALE = 2.2;
const FOE_PLATFORM_OFFSET = 76;
const PLAYER_PLATFORM_OFFSET = 80;
/** Space kept above a sprite's head so the largest mon never clips off-stage. */
const MON_TOP_MARGIN = 16;
/** On the phone (compact) layout the battlers draw this much smaller. */
const COMPACT_MON_SCALE = 0.75;

/**
 * The platform's width tracks its mon, so a titan gets a wide stand and a
 * Scatterbug a small one (the texture is `SPRITE_SIZE_MAX` wide at scale 1).
 */
function platformScale(drawHeight: number): number {
  return Math.min(1.1, Math.max(0.45, drawHeight / SPRITE_SIZE_MAX));
}
/** Frames per second for the idle loop; Anil animates at roughly 30ms a frame. */
const MON_ANIM_FPS = 30;
/**
 * The party (switch) detail popup: a wide window above the avatar grid for the
 * member under the cursor. No tabs: the five battle stats, nature, ability and
 * held item stack in a left column while the four moves sit in a 2x2 grid on the
 * right. HP is a plain line, since the bar lives in the switch cells.
 */
const PARTY_DETAIL_W = 600;
const PARTY_DETAIL_COL_GAP = 16;
const PARTY_DETAIL_CONTENT_TOP = 66;
const PARTY_DETAIL_STAT_ROW = 24;
const PARTY_DETAIL_INFO_ROW = 22;
const PARTY_DETAIL_TYPE_W = 74;
const PARTY_DETAIL_MOVE_COLS = 2;
const PARTY_DETAIL_MOVE_ROWS = Math.ceil(MAX_MOVES / PARTY_DETAIL_MOVE_COLS);
const PARTY_DETAIL_MOVE_ROW = 34;
const PARTY_DETAIL_MOVE_GAP = 6;
const PARTY_DETAIL_LEFT_H =
  PARTY_DETAIL_CONTENT_TOP +
  30 +
  DETAIL_STATS.length * PARTY_DETAIL_STAT_ROW +
  6 +
  3 * PARTY_DETAIL_INFO_ROW;
const PARTY_DETAIL_MOVES_H =
  PARTY_DETAIL_MOVE_ROWS * PARTY_DETAIL_MOVE_ROW +
  (PARTY_DETAIL_MOVE_ROWS - 1) * PARTY_DETAIL_MOVE_GAP;
const PARTY_DETAIL_H =
  Math.max(PARTY_DETAIL_LEFT_H, PARTY_DETAIL_CONTENT_TOP + PARTY_DETAIL_MOVES_H) +
  FRLG_WINDOW_PADDING.bottom;

/** "serious" -> "Serious", for the nature line. */
function capitalize(text: string): string {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}

type Mode = 'feed' | 'menu' | 'moves' | 'bag' | 'party' | 'over';

/** A sprite beat that owns the mon's position/scale until it completes. */
type BeatKind = 'faint' | 'switch';

/** Extra data a move grid cell draws: type, category, PP, power, accuracy, description. */
type MenuMove = Readonly<{
  type: string;
  category: string;
  pp: number;
  maxPp: number;
  desc: string;
  /** Effective power, base × ability/item × STAB (0 for a status move). */
  power: number;
  basePower: number;
  stab: boolean;
  /** Printed accuracy, or null when the move never misses. */
  baseAccuracy: number | null;
  /** Final hit chance in percent, or null when the move never misses. */
  accuracy: number | null;
  /** Net accuracy stage, so the popup can spell out an increase or reduction. */
  accuracyStage: number;
  /** Primary status the move inflicts, for the badge in the info popup. */
  status: string | null;
}>;

type MenuItem = Readonly<{ label: string; enabled: boolean; onSelect: () => void; move?: MenuMove }>;

type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;

/**
 * The menu battle (Phase 5). It renders the engine's state — platforms, sprites,
 * HP readouts, status badges and the message box — and plays the event log back
 * one frame at a time. The route (Phase 5 transition) launches it paused-on-top
 * with a `BattleLaunch` and gets a `BattleReturn` back from `returnToRoute`.
 */
export class BattleScene extends Phaser.Scene {
  private launch: BattleLaunch | null = null;
  private state!: BattleState;
  private frames: readonly FeedFrame[] = [];
  private frameIndex = 0;
  private feedElapsed = 0;
  /** Time not yet spent on a character, carried across frames (see `tickTyping`). */
  private typingRemainder = 0;
  /** The message box's typewriter, at the player's text speed (Phase 7). */
  private typing: Typewriter = beginTypewriter('');
  private charMs = TEXT_SPEED_MS.normal;
  private logLength = 0;
  private afterFeed: (() => void) | null = null;
  private mode: Mode = 'feed';
  private forcedSwitch = false;
  /** The player armed the Mega control for the move about to be chosen (D34). */
  private megaIntent = false;

  private displayActive!: Record<SideId, BattleFighter>;
  private displayHp!: Record<SideId, number>;
  private displayStatus!: Record<SideId, StatusId | null>;
  /** The squad's shared XP, drawn on the player's panel as the general bar. */
  private xp = 0;
  /** Battle-sheet frame for the enemy trainer, or null for a wild battle. */
  private trainerFrame: number | null = null;
  /** The last ball thrown, so the capture beat can reuse its icon. */
  private lastBallId: string | null = null;
  /** The foe is inside a ball, so it stays hidden even at full HP. */
  private captured = false;
  /** A running faint/switch beat owns the mon's sprite until it completes. */
  private beat: Partial<Record<SideId, BeatKind | null>> = {};
  private foeMonPos = { x: 0, y: 0 };
  private playerMonPos = { x: 0, y: 0 };
  /** The fighters the battle launched with, so `preload` knows which sheets to load. */
  private playerFighters: BattleFighter[] = [];
  private enemyFighters: BattleFighter[] = [];
  /** The sprite scale of each side's active sheet (the switch beat returns to it). */
  private monScale: Record<SideId, number> = { player: MON_SCALE, enemy: MON_SCALE };
  /** The tallest a side's sprite may draw, set by the layout (see `refreshHud`). */
  private monSizeCap: Record<SideId, number> = { player: SPRITE_SIZE_MAX, enemy: SPRITE_SIZE_MAX };
  /** The drawn height each side's sprite ended up at, so its platform can match. */
  private monDrawHeight: Record<SideId, number> = { player: SPRITE_SIZE_MAX, enemy: SPRITE_SIZE_MAX };
  /** 1 on the desktop layout, `COMPACT_MON_SCALE` on the phone layout. */
  private monScaleFactor = 1;
  /** The sheets this battle loaded, dropped on shutdown so the texture cache cannot grow forever. */
  private loadedSheets: PokemonSpriteSheet[] = [];

  private hud!: Phaser.GameObjects.Graphics;
  private bgTop!: Phaser.GameObjects.Rectangle;
  private bgBottom!: Phaser.GameObjects.Rectangle;
  private foePanel!: Phaser.GameObjects.NineSlice;
  private playerPanel!: Phaser.GameObjects.NineSlice;
  private messagePanel!: Phaser.GameObjects.NineSlice;
  private menuPanel!: Phaser.GameObjects.NineSlice;
  private menuCursor!: Phaser.GameObjects.Image;
  /** The clickable ◀ that backs out of the moves / switch / bag submenus. */
  private backArrow!: Phaser.GameObjects.Image;
  private backZone!: Phaser.GameObjects.Zone;
  /** The MEGA control shown at the right of the moves menu when a stone can be spent. */
  private megaCell!: Phaser.GameObjects.Rectangle;
  private megaText!: Phaser.GameObjects.BitmapText;
  private megaZone!: Phaser.GameObjects.Zone;
  /** True while the keyboard cursor sits on the Mega control instead of a move. */
  private megaSelected = false;
  private hpBars!: Record<SideId, { fill: Phaser.GameObjects.Rectangle; bar: Phaser.GameObjects.Image }>;
  private messageText!: Phaser.GameObjects.BitmapText;
  private nameText!: Record<SideId, Phaser.GameObjects.BitmapText>;
  private statText!: Record<SideId, Phaser.GameObjects.BitmapText>;
  private statusText!: Record<SideId, Phaser.GameObjects.BitmapText>;
  /** The FRLG status badge drawn in a panel instead of the text, when one exists. */
  private statusBadges!: Record<SideId, Phaser.GameObjects.Image>;
  private xpText!: Phaser.GameObjects.BitmapText;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private foeSprite!: Phaser.GameObjects.Sprite;
  private foeTrainer!: Phaser.GameObjects.Image;
  private moveFxSprite!: Phaser.GameObjects.Sprite;
  private captureBall!: Phaser.GameObjects.Image;
  private playerPlatform!: Phaser.GameObjects.Image;
  private foePlatform!: Phaser.GameObjects.Image;
  private menuRows: Phaser.GameObjects.BitmapText[] = [];
  /** One pointer zone per menu row, so a click picks it like a cursor press. */
  private menuZones: Phaser.GameObjects.Zone[] = [];
  /** The cells of the FIGHT / BAG / SWITCH / RUN grid, drawn behind its names. */
  private commandCells: Phaser.GameObjects.Rectangle[] = [];
  /** The shared moves grid and its floating info popup, drawn in the moves mode. */
  private moveGrid!: MoveGrid;
  /** The party (switch) grid: a cell, avatar, label, HP bar and hit zone per member. */
  private partyCells: Phaser.GameObjects.Rectangle[] = [];
  private partyAvatars: Phaser.GameObjects.Image[] = [];
  private partyLabels: Phaser.GameObjects.BitmapText[] = [];
  private partyHpBars: Phaser.GameObjects.Image[] = [];
  private partyHpFills: Phaser.GameObjects.Rectangle[] = [];
  private partyZones: Phaser.GameObjects.Zone[] = [];
  /** The move whose info popup is up, or null; `infoPinned` keeps it up on click. */
  private infoMove: number | null = null;
  private infoPinned = false;

  /** The no-tab party detail popup shown above the party grid. */
  private partyDetail!: Phaser.GameObjects.Container;
  private partyDetailName!: Phaser.GameObjects.BitmapText;
  private partyDetailLevel!: Phaser.GameObjects.BitmapText;
  private partyDetailTypes: { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.BitmapText }[] = [];
  private partyDetailStats!: {
    hpText: Phaser.GameObjects.BitmapText;
    rows: { label: Phaser.GameObjects.BitmapText; value: Phaser.GameObjects.BitmapText }[];
    nature: Phaser.GameObjects.BitmapText;
    ability: Phaser.GameObjects.BitmapText;
    held: Phaser.GameObjects.BitmapText;
  };
  private partyDetailMoves: {
    cell: Phaser.GameObjects.Rectangle;
    name: Phaser.GameObjects.BitmapText;
    pp: Phaser.GameObjects.BitmapText;
  }[] = [];
  private partyDetailEmpty!: Phaser.GameObjects.BitmapText;

  private menuItems: readonly MenuItem[] = [];
  private menuIndex = 0;

  /** The bag's pockets (consumable, and balls while a wild can be caught). */
  private bagCategories: readonly BagCategory[] = ['consumable'];
  private bagCategory: BagCategory = 'consumable';
  private bagTabs: { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.BitmapText }[] = [];

  /** The keys behind the confirm action, polled so holding one rushes the feed. */
  private confirmKeys: Phaser.Input.Keyboard.Key[] = [];
  private keybinds!: Keybinds;

  constructor() {
    super('Battle');
  }

  init(data?: BattleLaunch): void {
    this.launch = data ?? null;
    this.trainerFrame = null;
    this.lastBallId = null;
    this.captured = false;
    this.beat = {};
    this.playerFighters = [];
    this.enemyFighters = [];
    this.loadedSheets = [];
    this.megaIntent = false;
    const launch = this.launch;
    if (!launch) return;
    // The fighters are built here rather than in `create` so `preload` can load
    // exactly the sheets the battle draws: the foe's front, the party's back.
    this.playerFighters = launch.player.map(restoreFighter);
    const trigger = launch.trigger;
    this.enemyFighters =
      trigger.kind === 'wild'
        ? [
            createFighter({
              id: 'wild',
              speciesId: trigger.speciesId,
              level: trigger.level,
              shiny: trigger.shiny === true,
              learnsetSeed: launch.runSeed,
            }),
          ]
        : trigger.roster.map((input) => createFighter({ ...input, learnsetSeed: launch.runSeed }));
  }

  /** Loads the battle's mon sheets, skipping any already in the texture cache. */
  preload(): void {
    for (const sheet of this.battleSheets()) {
      if (this.textures.exists(sheet.textureKey)) continue;
      this.loadedSheets.push(sheet);
      this.load.spritesheet(sheet.textureKey, sheet.url, {
        frameWidth: sheet.size,
        frameHeight: sheet.size,
      });
    }
  }

  create(): void {
    const launch = this.launch;
    if (!launch) throw new Error('BattleScene requires a BattleLaunch from the route');

    const trigger = launch.trigger;
    this.state = createBattle({
      player: this.playerFighters,
      enemy: this.enemyFighters,
      rng: new Rng(launch.seed),
      isWild: trigger.kind === 'wild',
      enemyName: trigger.kind === 'trainer' ? trigger.trainerName : 'Foe',
      bag: launch.bag.flatMap((slot) => {
        const item = getItem(slot.itemId);
        return item && slot.count > 0 ? [{ item, count: slot.count }] : [];
      }),
    });

    this.displayActive = {
      player: activeFighter(this.state, 'player'),
      enemy: activeFighter(this.state, 'enemy'),
    };
    this.displayHp = { player: this.displayActive.player.hp, enemy: this.displayActive.enemy.hp };
    this.displayStatus = {
      player: this.displayActive.player.status,
      enemy: this.displayActive.enemy.status,
    };
    this.xp = launch.xp;
    this.typing = beginTypewriter('');
    const settings = loadSettings();
    this.charMs = TEXT_SPEED_MS[settings.textSpeed];
    this.keybinds = settings.keybinds;

    if (trigger.kind === 'trainer' && trigger.archetypeId) {
      const sprite = getTrainerArchetype(trigger.archetypeId)?.battleSprite ?? null;
      this.trainerFrame = sprite ? trainerSpriteFrame(sprite) : null;
    }

    this.buildMonAnimations();
    this.buildScene();
    this.bindInput();
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.onResize, this);
      this.scene.setVisible(true, 'Route');
      this.releaseMonSprites();
    });
    // The battle owns a centred square; hide the paused route so the letterbox
    // around it stays clean instead of showing the overworld through it.
    this.scene.setVisible(false, 'Route');
    this.startFeed();
  }

  /** Re-centres the square stage (and everything in it) when the window changes. */
  private onResize(): void {
    this.refreshHud();
  }

  // --- scene construction -------------------------------------------------

  private buildScene(): void {
    this.bgTop = this.add.rectangle(0, 0, 10, 10, 0x27324a).setOrigin(0, 0);
    this.bgBottom = this.add.rectangle(0, 0, 10, 10, 0x39424f).setOrigin(0, 0);

    this.foePlatform = this.add.image(0, 0, BATTLE_PLATFORM_TEXTURE_KEY).setTint(0x6f8f5f);
    this.playerPlatform = this.add.image(0, 0, BATTLE_PLATFORM_TEXTURE_KEY).setTint(0x6f8f5f);
    this.foeSprite = this.add.sprite(0, 0, BATTLE_MON_TEXTURE_KEY).setScale(MON_SCALE);
    this.playerSprite = this.add
      .sprite(0, 0, BATTLE_MON_TEXTURE_KEY)
      .setScale(MON_SCALE);

    this.foeTrainer = this.add
      .image(0, 0, TRAINER_SPRITE_TEXTURE_KEY, this.trainerFrame ?? 0)
      .setOrigin(0.5, 1)
      .setScale(1.7)
      .setDepth(1)
      .setVisible(this.trainerFrame !== null);

    this.moveFxSprite = this.add.sprite(0, 0, MOVE_FX_TEXTURE_KEY).setDepth(6).setVisible(false);
    this.moveFxSprite.on('animationcomplete', () => this.moveFxSprite.setVisible(false));
    this.captureBall = this.add
      .image(0, 0, ITEM_ICON_TEXTURE_KEY, itemIconFrame('pokeball') ?? 0)
      .setScale(2)
      .setDepth(7)
      .setVisible(false);

    // FRLG window chrome, behind the gauges and text the shared Graphics draws.
    this.foePanel = addFrlgWindow(this, 0, 0, FOE_PANEL.w, FOE_PANEL.h);
    this.playerPanel = addFrlgWindow(this, 0, 0, PLAYER_PANEL_W, PLAYER_PANEL_H);
    this.messagePanel = addFrlgWindow(this, 0, 0, 100, 100, 'textbox');
    this.menuPanel = addFrlgWindow(this, 0, 0, MENU_W, 100);
    this.commandCells = Array.from({ length: MENU_ROWS }, () =>
      this.add
        .rectangle(0, 0, 10, 10, 0xe6e3f2)
        .setOrigin(0, 0)
        .setStrokeStyle(2, 0xb9b4d0)
        .setVisible(false),
    );

    this.hpBars = {
      enemy: addFrlgHpBar(this, 0, 0),
      player: addFrlgHpBar(this, 0, 0),
    };

    this.hud = this.add.graphics();
    this.menuCursor = this.add.image(0, 0, FRLG_CURSOR_KEY).setOrigin(0, 0.5).setVisible(false);
    this.backArrow = this.add
      .image(0, 0, FRLG_CURSOR_KEY)
      .setOrigin(0, 0.5)
      .setFlipX(true)
      .setScale(0.7)
      .setVisible(false);
    this.backZone = this.add.zone(0, 0, 10, 10).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.backZone.setData('back', true);
    this.backZone.on('pointerdown', () => this.onBack());

    // The MEGA control in the moves menu: a cell, its label and a hit zone. It is
    // only laid out and shown while the active Pokémon can Mega Evolve (D34).
    this.megaCell = this.add
      .rectangle(0, 0, 10, 10, 0xe6e3f2)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x9a94b8)
      .setVisible(false);
    this.megaText = addFrlgText(this, 0, 0, 'MEGA', { size: 16, tint: FRLG_INK, origin: 0.5 }).setVisible(
      false,
    );
    this.megaZone = this.add.zone(0, 0, 10, 10).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.megaZone.on('pointerover', () => this.onMegaHover());
    this.megaZone.on('pointerdown', () => this.onMegaClick());

    this.nameText = {
      enemy: addFrlgText(this, 0, 0, '', { tint: FRLG_INK }),
      player: addFrlgText(this, 0, 0, '', { tint: FRLG_INK }),
    };
    this.statText = {
      enemy: addFrlgText(this, 0, 0, '', { size: 16, tint: FRLG_INK, origin: [1, 0] }),
      player: addFrlgText(this, 0, 0, '', { size: 16, tint: FRLG_INK, origin: [1, 0] }),
    };
    this.statusText = {
      enemy: addFrlgText(this, 0, 0, '', { size: 16, tint: 0xf8fafc, origin: 0.5 }),
      player: addFrlgText(this, 0, 0, '', { size: 16, tint: 0xf8fafc, origin: 0.5 }),
    };
    // The FRLG condition badges; drawn at 1.5x to match the panel text size.
    this.statusBadges = {
      enemy: this.add.image(0, 0, STATUS_ICON_TEXTURE_KEY, 0).setOrigin(0, 0).setScale(1.5).setVisible(false),
      player: this.add.image(0, 0, STATUS_ICON_TEXTURE_KEY, 0).setOrigin(0, 0).setScale(1.5).setVisible(false),
    };
    this.xpText = addFrlgText(this, 0, 0, '', { size: 16, tint: 0x3b82f6 });

    this.messageText = addFrlgText(this, 0, 0, '', { lineSpacing: 4 });

    this.menuRows = Array.from({ length: MENU_ROWS }, () =>
      addFrlgText(this, 0, 0, '', { tint: FRLG_INK }),
    );
    // The party (switch) grid, built once and hidden until the party is open.
    this.partyCells = Array.from({ length: MAX_PARTY_SIZE }, () =>
      this.add
        .rectangle(0, 0, 10, 10, 0xe6e3f2)
        .setOrigin(0, 0)
        .setStrokeStyle(2, 0x9a94b8)
        .setVisible(false),
    );
    this.partyAvatars = Array.from({ length: MAX_PARTY_SIZE }, () =>
      this.add.image(0, 0, PORTRAIT_TEXTURE_KEY, 0).setScale(PARTY_AVATAR_SCALE).setVisible(false),
    );
    this.partyLabels = Array.from({ length: MAX_PARTY_SIZE }, () =>
      addFrlgText(this, 0, 0, '', { size: 16, tint: FRLG_INK }).setVisible(false),
    );
    // A small HP bar in every cell; the fill is drawn over the baked track.
    this.partyHpBars = Array.from({ length: MAX_PARTY_SIZE }, () =>
      this.add
        .image(0, 0, FRLG_HPBAR_KEY)
        .setOrigin(0, 0)
        .setScale(PARTY_CELL_HPBAR_SCALE)
        .setVisible(false),
    );
    this.partyHpFills = Array.from({ length: MAX_PARTY_SIZE }, () =>
      this.add
        .rectangle(0, 0, 0, FRLG_HPBAR.fill.height * PARTY_CELL_HPBAR_SCALE, 0x58d080)
        .setOrigin(0, 0)
        .setVisible(false),
    );
    this.partyZones = Array.from({ length: MAX_PARTY_SIZE }, () => {
      const zone = this.add.zone(0, 0, 10, 10).setOrigin(0, 0);
      zone.setData('item', -1);
      zone.setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => this.onMenuHover(zone));
      zone.on('pointerdown', () => this.onMenuClick(zone));
      return zone;
    });

    // One invisible zone per row: hovering moves the cursor, clicking picks the
    // row, so the menu answers the mouse exactly like the keyboard. In the moves
    // grid the same zone also watches its ⓘ button for hover and click.
    this.menuZones = Array.from({ length: MENU_ROWS }, () => {
      const zone = this.add.zone(0, 0, 10, 10).setOrigin(0, 0);
      zone.setData('item', -1);
      zone.setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => this.onMenuHover(zone));
      zone.on('pointermove', (_pointer: Phaser.Input.Pointer, x: number, y: number) =>
        this.onMenuPointerMove(zone, x, y),
      );
      zone.on('pointerout', () => this.onMenuPointerOut(zone));
      zone.on('pointerdown', (_pointer: Phaser.Input.Pointer, x: number, y: number) =>
        this.onMenuClick(zone, x, y),
      );
      return zone;
    });

    // The bag's pocket tabs, drawn inside the menu window; at most two.
    this.bagTabs = Array.from({ length: 2 }, (_, slot) => {
      const bg = this.add
        .rectangle(0, 0, 10, 10, 0xcfcce2)
        .setOrigin(0, 0)
        .setVisible(false);
      const label = addFrlgText(this, 0, 0, '', { size: 16, tint: FRLG_INK, origin: [0.5, 0] })
        .setVisible(false);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => this.selectBagTab(slot));
      return { bg, label };
    });

    // The shared moves grid and its floating info popup, built last so the popup
    // rides over the menu and the battle behind it. Hidden until fights open it.
    this.moveGrid = new MoveGrid(this);

    this.buildPartyDetail();
  }

  /**
   * The party detail popup: the HUD's STATS / MOVES window, built once at a local
   * origin and moved over the avatar grid when the party is open. `renderPartyDetail`
   * fills it and `hidePartyGrid` hides it.
   */
  private buildPartyDetail(): void {
    const padX = FRLG_WINDOW_PADDING.x;
    const padTop = FRLG_WINDOW_PADDING.top;
    const colW = (PARTY_DETAIL_W - padX * 2 - PARTY_DETAIL_COL_GAP) / 2;
    const leftRight = padX + colW;
    const movesX = padX + colW + PARTY_DETAIL_COL_GAP;
    const children: Phaser.GameObjects.GameObject[] = [
      addFrlgWindow(this, 0, 0, PARTY_DETAIL_W, PARTY_DETAIL_H),
    ];

    this.partyDetailName = addFrlgText(this, padX, padTop, '', { size: 16, tint: FRLG_INK });
    this.partyDetailLevel = addFrlgText(this, PARTY_DETAIL_W - padX, padTop, '', {
      size: 16,
      tint: 0x3a3956,
      origin: [1, 0],
    });
    children.push(this.partyDetailName, this.partyDetailLevel);

    const chipY = padTop + 22;
    this.partyDetailTypes = [];
    for (let i = 0; i < 2; i++) {
      const chipX = padX + i * (PARTY_DETAIL_TYPE_W + 6);
      const bg = this.add
        .rectangle(chipX, chipY, PARTY_DETAIL_TYPE_W, 20, 0x9aa0b4)
        .setOrigin(0, 0)
        .setVisible(false);
      const label = addFrlgText(this, chipX + PARTY_DETAIL_TYPE_W / 2, chipY + 2, '', {
        size: 16,
        tint: 0xf8fafc,
        origin: [0.5, 0],
      }).setVisible(false);
      this.partyDetailTypes.push({ bg, label });
      children.push(bg, label);
    }

    const contentTop = PARTY_DETAIL_CONTENT_TOP;
    const hpText = addFrlgText(this, padX, contentTop, '', { size: 16, tint: FRLG_INK });
    children.push(hpText);

    const statsTop = contentTop + 30;
    const rows = DETAIL_STATS.map((stat, i) => {
      const rowY = statsTop + i * PARTY_DETAIL_STAT_ROW;
      const label = addFrlgText(this, padX, rowY, STAT_LABELS[stat], { size: 16, tint: 0x3a3956 });
      const value = addFrlgText(this, leftRight, rowY, '', { size: 16, tint: FRLG_INK, origin: [1, 0] });
      children.push(label, value);
      return { label, value };
    });
    const infoTop = statsTop + DETAIL_STATS.length * PARTY_DETAIL_STAT_ROW + 6;
    const nature = addFrlgText(this, padX, infoTop, '', { size: 16, tint: 0x3a3956 });
    const ability = addFrlgText(this, padX, infoTop + PARTY_DETAIL_INFO_ROW, '', { size: 16, tint: 0x3a3956 });
    const held = addFrlgText(this, padX, infoTop + PARTY_DETAIL_INFO_ROW * 2, '', { size: 16, tint: 0x3a3956 });
    children.push(nature, ability, held);
    this.partyDetailStats = { hpText, rows, nature, ability, held };

    const cellW = (colW - PARTY_DETAIL_MOVE_GAP) / 2;
    const moveCellX = (i: number): number => movesX + (i % PARTY_DETAIL_MOVE_COLS) * (cellW + PARTY_DETAIL_MOVE_GAP);
    const moveCellY = (i: number): number =>
      contentTop + Math.floor(i / PARTY_DETAIL_MOVE_COLS) * (PARTY_DETAIL_MOVE_ROW + PARTY_DETAIL_MOVE_GAP);
    this.partyDetailMoves = [];
    for (let i = 0; i < MAX_MOVES; i++) {
      const cell = this.add
        .rectangle(moveCellX(i), moveCellY(i), cellW, PARTY_DETAIL_MOVE_ROW, 0xe6e3f2)
        .setOrigin(0, 0)
        .setStrokeStyle(2, 0x9a94b8);
      const name = addFrlgText(this, moveCellX(i) + 8, moveCellY(i) + 4, '', {
        size: 16,
        tint: FRLG_INK,
      }).setMaxWidth(cellW - 16);
      const pp = addFrlgText(this, moveCellX(i) + 8, moveCellY(i) + 18, '', {
        size: 16,
        tint: 0x3a3956,
      });
      this.partyDetailMoves.push({ cell, name, pp });
      children.push(cell, name, pp);
    }
    this.partyDetailEmpty = addFrlgText(this, movesX + colW / 2, contentTop + 20, 'no moves', {
      size: 16,
      tint: 0x6b6887,
      origin: [0.5, 0],
    });
    children.push(this.partyDetailEmpty);

    this.partyDetail = this.add.container(0, 0, children).setVisible(false);
  }

  private bindInput(): void {
    this.confirmKeys = actionKeys(this, 'confirm', this.keybinds);
    subscribeKeybinds(
      this,
      ({ action }) => this.handleAction(action),
      () => this.keybinds,
    );
    // A click anywhere advances the feed (and leaves the result screen); the
    // per-row zones below handle the menus. A press that landed on a menu row or
    // a pocket tab is left to it, so picking an option never also taps the feed.
    this.input.on(
      'pointerdown',
      (_pointer: Phaser.Input.Pointer, objects: Phaser.GameObjects.GameObject[]) =>
        this.onPointerDown(objects),
    );
    // `[` / `]` cycle the bag's pockets, as in the route HUD.
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      if (this.mode !== 'bag') return;
      if (event.key === '[') this.cycleBagTab(-1);
      else if (event.key === ']') this.cycleBagTab(1);
    });
  }

  /**
   * The player's intent behind one shared action, from a key or from the touch
   * A / B and pad. The battle routes it the same way either way.
   */
  private handleAction(action: KeybindAction): void {
    switch (action) {
      case 'confirm':
        this.onConfirm();
        return;
      case 'cancel':
        this.onCancel();
        return;
      case 'up':
      case 'down':
      case 'left':
      case 'right':
        this.navigateMenu(action);
        return;
    }
  }

  /** A click on the scene: feed taps and the result screen answer it. */
  private onPointerDown(objects: readonly Phaser.GameObjects.GameObject[]): void {
    if (objects.length > 0) return;
    if (this.mode === 'feed') {
      this.onConfirm();
      return;
    }
    if (this.mode === 'over') this.returnToRoute();
  }

  private onConfirm(): void {
    if (this.mode === 'feed') {
      // A tap reveals the rest of the line before it moves the feed on.
      if (!typewriterDone(this.typing)) {
        this.completeTyping();
        return;
      }
      this.advanceFeed();
      return;
    }
    if (this.mode === 'over') {
      this.returnToRoute();
      return;
    }
    this.confirmMenu();
  }

  private onCancel(): void {
    if (this.mode === 'over') {
      this.returnToRoute();
      return;
    }
    if (this.mode === 'moves' || this.mode === 'bag' || this.mode === 'party') {
      this.openMenu();
    }
  }

  // --- feed playback ------------------------------------------------------

  private startFeed(after: (() => void) | null = null): void {
    const newEvents = this.state.log.slice(this.logLength);
    this.logLength = this.state.log.length;
    this.frames = battleFrames(newEvents);
    this.frameIndex = 0;
    this.feedElapsed = 0;
    this.afterFeed = after;
    this.mode = 'feed';
    this.menuItems = [];
    if (this.frames.length === 0) {
      this.finishFeed();
      return;
    }
    this.showFrame();
  }

  private showFrame(): void {
    const frame = this.frames[this.frameIndex];
    this.applyEvents(frame.events);
    if (frame.message !== null) this.typeMessage(frame.message);
    this.refreshHud();
  }

  private advanceFeed(): void {
    this.frameIndex += 1;
    this.feedElapsed = 0;
    if (this.frameIndex >= this.frames.length) {
      this.finishFeed();
      return;
    }
    this.showFrame();
  }

  private finishFeed(): void {
    const after = this.afterFeed;
    this.afterFeed = null;
    if (after) {
      after();
      return;
    }
    if (this.state.winner !== null) {
      this.showOver();
      return;
    }
    const pending = needsReplacement(this.state);
    if (pending.includes('player')) {
      this.forcedSwitch = true;
      this.openParty();
      return;
    }
    if (pending.includes('enemy')) {
      autoReplace(this.state);
      this.startFeed(() => this.finishFeed());
      return;
    }
    this.openMenu();
  }

  private applyEvents(events: readonly BattleEvent[]): void {
    for (const event of events) {
      switch (event.kind) {
        case 'damage':
        case 'heal':
          this.displayHp[event.side] = event.hp;
          break;
        case 'status':
          this.displayStatus[event.side] = event.status;
          break;
        case 'cure':
          this.displayStatus[event.side] = null;
          break;
        case 'switch': {
          const down = this.displayHp[event.side] <= 0;
          const fighter = this.state.sides[event.side].party.find((p) => p.id === event.fighterId);
          if (fighter) {
            this.displayActive[event.side] = fighter;
            this.displayHp[event.side] = fighter.hp;
            this.displayStatus[event.side] = fighter.status;
          }
          this.playSwitch(event.side, down);
          break;
        }
        case 'faint':
          this.displayHp[event.side] = 0;
          this.playFaint(event.side);
          break;
        case 'move':
          this.playMoveFx(event.side, event.moveId);
          break;
        case 'mega':
          this.playMega(event.side);
          break;
        case 'capture':
          this.playCapture(event.shakes, event.success);
          break;
        default:
          break;
      }
    }
  }

  // --- battle presentation --------------------------------------------------

  /** A white flash and a fade-in for the side that just Mega Evolved (D34). */
  private playMega(side: SideId): void {
    this.cameras.main.flash(220, 255, 255, 255);
    const sprite = side === 'player' ? this.playerSprite : this.foeSprite;
    sprite.setAlpha(0.2);
    this.tweens.add({ targets: sprite, alpha: 1, duration: 280 });
    this.displayActive[side] = activeFighter(this.state, side);
    this.syncMonSprites();
  }

  /** Plays the move's archetype FX over the side it hit. */
  private playMoveFx(side: SideId, moveId: string): void {
    const move = getMove(moveId);
    if (!move) return;
    const fx = moveFxFor(moveId, move.type, move.flags);
    const kind = move.category === 'Status' ? 'status' : 'damage';
    const track = moveFxTrack(kind, fx, {
      status: Boolean(move.status ?? move.volatileStatus),
    });
    if (!track) return;
    const target: SideId = side === 'player' ? 'enemy' : 'player';
    const pos = target === 'player' ? this.playerMonPos : this.foeMonPos;
    this.moveFxSprite
      .setPosition(pos.x, pos.y)
      .setFlipX(target === 'player')
      .setVisible(true)
      .play(moveFxAnimKey(track.fx), true);
  }

  /** The classic throw, wobble and result beat when a ball is used. */
  private playCapture(shakes: number, success: boolean): void {
    const beat = captureBeat(shakes, success);
    const frame = itemIconFrame(this.lastBallId ?? 'pokeball') ?? itemIconFrame('pokeball') ?? 0;
    const from = this.playerMonPos;
    const to = this.foeMonPos;
    this.captureBall
      .setTexture(ITEM_ICON_TEXTURE_KEY, frame)
      .setPosition(from.x, from.y)
      .setAlpha(1)
      .setAngle(0)
      .setVisible(true);

    const wobble: Phaser.Types.Tweens.TweenBuilderConfig[] = [];
    const step = Math.round(1000 / CAPTURE_SHAKE_SPEED / 3);
    for (let shake = 0; shake < beat.shakes; shake++) {
      wobble.push({ targets: this.captureBall, angle: 22, duration: step });
      wobble.push({ targets: this.captureBall, angle: -22, duration: step });
      wobble.push({ targets: this.captureBall, angle: 0, duration: step });
    }

    this.tweens.chain({
      targets: this.captureBall,
      tweens: [
        { targets: this.captureBall, x: to.x, y: to.y - 28, duration: 260, ease: 'Quad.easeOut' },
        { targets: this.captureBall, y: to.y, duration: 150, ease: 'Quad.easeIn' },
        ...wobble,
      ],
      onComplete: () => {
        this.captured = beat.held;
        if (!beat.held) this.captureBall.setVisible(false);
        this.refreshHud();
      },
    });
  }

  /** The sprite a side is drawn with; both share the placeholder mon until O1. */
  private monSprite(side: SideId): Phaser.GameObjects.Sprite {
    return side === 'player' ? this.playerSprite : this.foeSprite;
  }

  /** Every sheet this battle draws: the foe's front, the party's back. */
  private battleSheets(): PokemonSpriteSheet[] {
    const sheets = new Map<string, PokemonSpriteSheet>();
    const add = (
      speciesId: string,
      shiny: boolean,
      female: boolean,
      kind: PokemonSpriteKind,
    ): void => {
      const sheet = pokemonSprite(speciesId, kind, { shiny, female });
      if (sheet) sheets.set(sheet.textureKey, sheet);
    };
    const addFighter = (fighter: BattleFighter, kind: PokemonSpriteKind): void => {
      const female = fighter.gender === 'female';
      add(fighter.speciesId, fighter.shiny, female, kind);
      // A held Mega Stone needs its forme sheet loaded up front, or the swap
      // mid-battle has no texture to draw (D34).
      const mega = fighter.heldItem ? megaFormForItem(fighter.heldItem) : undefined;
      if (mega) add(mega.id, fighter.shiny, female, kind);
    };
    for (const fighter of this.playerFighters) addFighter(fighter, 'back');
    for (const fighter of this.enemyFighters) addFighter(fighter, 'front');
    return [...sheets.values()];
  }

  /** One looping idle animation per loaded sheet, off the strip's own frame count. */
  private buildMonAnimations(): void {
    for (const sheet of this.battleSheets()) {
      const key = pokemonIdleAnimKey(sheet);
      if (this.anims.exists(key)) continue;
      this.anims.create({
        key,
        frames: Array.from({ length: sheet.frames }, (_, frame) => ({ key: sheet.textureKey, frame })),
        frameRate: MON_ANIM_FPS,
        repeat: -1,
      });
    }
  }

  /** Drops the textures and animations this battle added, keeping the cache small. */
  private releaseMonSprites(): void {
    for (const sheet of this.loadedSheets) {
      this.anims.remove(pokemonIdleAnimKey(sheet));
      this.textures.remove(sheet.textureKey);
    }
    this.loadedSheets = [];
  }

  /** Swaps in the Anil front/back sheet for each side's active fighter. */
  private syncMonSprites(): void {
    this.showMon('enemy', this.displayActive.enemy, 'front');
    this.showMon('player', this.displayActive.player, 'back');
  }

  /**
   * Points a side's sprite at its sheet and plays the idle loop. Only a real
   * change touches the sprite, so a switch beat's tween is never fought over and
   * a mid-loop refresh does not restart the animation.
   */
  private showMon(side: SideId, fighter: BattleFighter, kind: PokemonSpriteKind): void {
    const sheet = pokemonSprite(fighter.speciesId, kind, {
      shiny: fighter.shiny,
      female: fighter.gender === 'female',
    });
    if (!sheet) return;
    const sprite = this.monSprite(side);
    const anim = pokemonIdleAnimKey(sheet);
    const content = this.sheetContent(sheet);
    const target =
      Math.min(battleSpriteHeight(heightOf(fighter.speciesId)), this.monSizeCap[side]) *
      this.monScaleFactor;
    this.monScale[side] = target / (content?.height ?? sheet.size);
    this.monDrawHeight[side] = target;
    const sameSheet = sprite.texture.key === sheet.textureKey && sprite.anims.currentAnim?.key === anim;
    if (sameSheet) {
      // A live faint/switch beat owns the sprite; otherwise a resize just retargets it.
      if (!this.beat[side]) sprite.setScale(this.monScale[side]);
      return;
    }
    if (content) sprite.setOrigin(content.anchorX / sheet.size, content.anchorY / sheet.size);
    else sprite.setOrigin(0.5, 0.5);
    sprite.setTexture(sheet.textureKey, 0).setScale(this.monScale[side]);
    sprite.play(anim);
  }

  /** The sheet's drawn box and feet, measured once per texture (`spriteBounds`). */
  private sheetContent(sheet: PokemonSpriteSheet): SpriteBounds | null {
    const source = this.textures.get(sheet.textureKey).getSourceImage();
    return spriteContentBounds(sheet.textureKey, source as CanvasImageSource, sheet.size, sheet.frames);
  }

  private monPos(side: SideId): { x: number; y: number } {
    return side === 'player' ? this.playerMonPos : this.foeMonPos;
  }

  /** The defeated sprite sinks under its platform and fades, then the HUD hides it. */
  private playFaint(side: SideId): void {
    const sprite = this.monSprite(side);
    if (!sprite.visible) return;
    const base = this.monPos(side);
    this.beat[side] = 'faint';
    this.tweens.killTweensOf(sprite);
    this.tweens.add({
      targets: sprite,
      y: base.y + FAINT_DROP,
      alpha: 0,
      duration: FAINT_MS,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.beat[side] = null;
        sprite.setAlpha(1).setPosition(base.x, base.y);
        this.refreshHud();
      },
    });
  }

  /**
   * The withdraw/send-out beat. A replacement for a fainted partner has nothing
   * to withdraw, so it only pops the incoming sprite in.
   */
  private playSwitch(side: SideId, down: boolean): void {
    const sprite = this.monSprite(side);
    const base = this.monPos(side);
    const scale = this.monScale[side];
    this.beat[side] = 'switch';
    const sendOut: Phaser.Types.Tweens.TweenBuilderConfig = {
      targets: sprite,
      scaleX: scale,
      scaleY: scale,
      alpha: 1,
      duration: SWITCH_SENDOUT_MS,
      ease: 'Back.easeOut',
    };
    const recall: Phaser.Types.Tweens.TweenBuilderConfig = {
      targets: sprite,
      scaleX: scale * SWITCH_SHRINK,
      scaleY: scale * SWITCH_SHRINK,
      alpha: 0.2,
      duration: SWITCH_RECALL_MS,
      ease: 'Quad.easeIn',
    };
    sprite.setPosition(base.x, base.y);
    this.tweens.killTweensOf(sprite);
    if (down) sprite.setScale(scale * SWITCH_SHRINK).setAlpha(0);
    else sprite.setScale(scale).setAlpha(1);
    this.tweens.chain({
      targets: sprite,
      tweens: down ? [sendOut] : [recall, sendOut],
      onComplete: () => {
        this.beat[side] = null;
        sprite.setScale(scale).setAlpha(1);
        this.refreshHud();
      },
    });
  }

  private showOver(): void {
    this.mode = 'over';
    this.menuItems = [];
    // Every end of battle leaves on its own after the line is read — a run, a
    // catch, a win or a loss all need no confirm to get back to the route.
    this.setMessage(this.outcomeMessage(this.outcome()));
    this.refreshHud();
    this.time.delayedCall(OUTCOME_HOLD_MS, () => this.returnToRoute());
  }

  /** Reads the finished battle's log to tell a catch, a win, a loss and a flee apart. */
  private outcome(): BattleOutcome {
    if (this.state.winner === 'player') {
      return this.state.log.some((event) => event.kind === 'capture' && event.success)
        ? 'capture'
        : 'win';
    }
    if (this.state.winner === 'enemy') return 'lose';
    return this.state.sides.player.party.some((fighter) => fighter.hp > 0) ? 'run' : 'lose';
  }

  private outcomeMessage(outcome: BattleOutcome): string {
    const wild = this.state.sides.enemy.party[0];
    if (outcome === 'capture') return `Gotcha! ${wild.name} was caught!`;
    if (outcome === 'win') {
      const trigger = this.launch?.trigger;
      return trigger?.kind === 'trainer' ? `${trigger.trainerName} was defeated!` : `The wild ${wild.name} fainted!`;
    }
    if (outcome === 'run') return 'Got away safely!';
    return 'Your last Pokémon fainted...';
  }

  /** Hands the route the party and bag as they stand, then closes the battle. */
  private returnToRoute(): void {
    const outcome = this.outcome();
    const captured = outcome === 'capture' ? snapshotFighter(this.state.sides.enemy.party[0]) : null;
    const result: BattleReturn = {
      outcome,
      message: this.outcomeMessage(outcome),
      player: this.state.sides.player.party.map(snapshotFighter),
      bag: this.state.bag.map((slot) => ({ itemId: slot.item.id, count: slot.count })),
      captured,
    };
    const route = this.scene.get('Route') as RouteScene;
    this.scene.setVisible(true, 'Route');
    route.applyBattleResult(result);
    this.scene.resume('Route');
    this.scene.stop();
  }

  // --- menus --------------------------------------------------------------

  private openMenu(): void {
    const player = activeFighter(this.state, 'player');
    if (!canMegaEvolve(this.state, 'player')) this.megaIntent = false;
    this.megaSelected = false;
    this.menuItems = [
      { label: 'FIGHT', enabled: true, onSelect: () => this.openMoves() },
      { label: 'BAG', enabled: this.usableBag().length > 0, onSelect: () => this.openBag() },
      { label: 'SWITCH', enabled: this.hasBench(), onSelect: () => this.openParty() },
      { label: 'RUN', enabled: canRun(this.state, 'player'), onSelect: () => this.submit({ type: 'run' }) },
    ];
    this.menuIndex = 0;
    this.mode = 'menu';
    this.setMessage(`What will ${player.name} do?`);
    this.refreshHud();
  }

  /** True while the active Pokémon can still spend its Mega Stone this battle. */
  private megaAvailable(): boolean {
    return canMegaEvolve(this.state, 'player');
  }

  /** Arms or disarms the Mega control; the next move spends it (D34). */
  private toggleMega(): void {
    if (!this.megaAvailable()) return;
    this.megaIntent = !this.megaIntent;
    this.refreshHud();
  }

  private openMoves(): void {
    const player = activeFighter(this.state, 'player');
    const legal = legalMoveIndices(player);
    this.menuItems = player.moves.map((slot, index) => {
      const move = getMove(slot.moveId);
      const name = move?.name ?? slot.moveId;
      const enabled = legal.length === 0 ? index === 0 : legal.includes(index);
      const preview = movePreview(this.state, 'player', index);
      return {
        label: name,
        enabled,
        onSelect: () =>
          this.submit({
            type: 'fight',
            moveIndex: index,
            ...(this.megaIntent ? { mega: true } : {}),
          }),
        move: {
          type: preview?.type ?? move?.type ?? '',
          category: move?.category ?? 'Status',
          pp: slot.pp,
          maxPp: slot.maxPp,
          desc: move?.shortDesc ?? move?.desc ?? '',
          power: preview?.power ?? 0,
          basePower: preview?.basePower ?? 0,
          stab: preview?.stab ?? false,
          baseAccuracy: preview?.baseAccuracy ?? null,
          accuracy: preview?.accuracy ?? null,
          accuracyStage: preview?.accuracyStage ?? 0,
          status: move?.status ?? null,
        },
      };
    });
    this.menuIndex = 0;
    this.megaSelected = false;
    this.infoMove = null;
    this.infoPinned = false;
    this.mode = 'moves';
    this.refreshHud();
  }

  private openBag(): void {
    // The pockets on offer: consumables everywhere, balls only while a wild is
    // still catchable. A trainer battle is therefore a single-tab bag.
    const canCatch = this.state.isWild && this.launch?.canCapture === true;
    this.bagCategories = canCatch ? ['consumable', 'ball'] : ['consumable'];
    const usable = this.usableBag();
    this.bagCategory =
      this.bagCategories.find((category) =>
        usable.some((slot) => bagCategoryForKind(slot.item.kind) === category),
      ) ?? this.bagCategories[0];
    this.mode = 'bag';
    this.setBagItems(this.bagCategory);
  }

  /** Rebuilds the bag list for a pocket, as a menu the cursor and clicks drive. */
  private setBagItems(category: BagCategory): void {
    this.bagCategory = category;
    const stacks = this.usableBag().filter(
      (slot) => bagCategoryForKind(slot.item.kind) === category,
    );
    this.menuItems =
      stacks.length === 0
        ? [{ label: 'No items', enabled: false, onSelect: () => {} }]
        : stacks.map((slot) => ({
            label: `${slot.item.name} x${slot.count}`,
            enabled: true,
            onSelect: () => this.submit({ type: 'bag', itemId: slot.item.id }),
          }));
    this.menuIndex = 0;
    this.refreshHud();
  }

  /** Steps the bag to the next pocket, as `[` / `]` or a tab click ask. */
  private cycleBagTab(delta: number): void {
    if (this.bagCategories.length < 2) return;
    const index = this.bagCategories.indexOf(this.bagCategory);
    const next = (index + delta + this.bagCategories.length) % this.bagCategories.length;
    this.setBagItems(this.bagCategories[next]);
  }

  /** A click on a pocket tab: shows that pocket's stacks. */
  private selectBagTab(slot: number): void {
    if (this.mode !== 'bag') return;
    const category = this.bagCategories[slot];
    if (!category || category === this.bagCategory) return;
    this.setBagItems(category);
  }

  private openParty(): void {
    const side = this.state.sides.player;
    this.menuItems = side.party.map((fighter, index) => {
      const status = statusAbbreviation(fighter.status);
      const statusText = status ? `  ${status}` : '';
      return {
        label: `${fighter.name}  Lv${fighter.level}${statusText}`,
        enabled: index !== side.activeIndex && fighter.hp > 0,
        onSelect: () => this.confirmParty(index),
      };
    });
    this.menuIndex = 0;
    this.mode = 'party';
    this.refreshHud();
  }

  private confirmParty(index: number): void {
    if (this.forcedSwitch) {
      performSwitch(this.state, 'player', index);
      if (needsReplacement(this.state).includes('enemy')) autoReplace(this.state);
      this.forcedSwitch = false;
      this.startFeed(() => this.finishFeed());
      return;
    }
    this.submit({ type: 'switch', partyIndex: index });
  }

  private submit(command: Command): void {
    if (command.type === 'bag') {
      const item = getItem(command.itemId);
      if (item?.kind === 'ball') this.lastBallId = item.id;
    }
    this.displayHp = {
      player: activeFighter(this.state, 'player').hp,
      enemy: activeFighter(this.state, 'enemy').hp,
    };
    takeTurn(this.state, command, chooseAiCommand(this.state, 'enemy'));
    this.megaIntent = false;
    this.startFeed();
  }

  private usableBag() {
    return this.state.bag.filter(
      (slot) =>
        slot.count > 0 &&
        slot.item.kind !== 'held' &&
        slot.item.kind !== 'valuable' &&
        (slot.item.kind !== 'ball' || (this.state.isWild && this.launch?.canCapture === true)),
    );
  }

  private hasBench(): boolean {
    const side = this.state.sides.player;
    return side.party.some((fighter, index) => index !== side.activeIndex && fighter.hp > 0);
  }

  private moveMenu(delta: number): void {
    if (this.menuItems.length === 0) return;
    let index = this.menuIndex;
    for (let step = 0; step < this.menuItems.length; step++) {
      index = (index + delta + this.menuItems.length) % this.menuItems.length;
      if (this.menuItems[index].enabled) break;
    }
    this.menuIndex = index;
    this.refreshHud();
  }

  /** Steps the cursor: the command and move grids move in 2D, other lists stay linear. */
  private navigateMenu(action: 'up' | 'down' | 'left' | 'right'): void {
    if (this.mode === 'moves' || this.mode === 'menu') this.moveMenuGrid(action);
    else this.moveMenu(action === 'up' || action === 'left' ? -1 : 1);
  }

  /**
   * Moves the cursor across the 2x2 moves grid, skipping disabled moves. A
   * direction that would leave a partial last row clamps back into it, so with
   * three moves `down` still lands on the third.
   */
  private moveMenuGrid(action: 'up' | 'down' | 'left' | 'right'): void {
    const count = this.menuItems.length;
    if (count === 0) return;
    const cols = MENU_GRID_COLS;
    const rows = Math.max(1, Math.ceil(count / cols));
    const mega = this.mode === 'moves' && this.megaAvailable();

    // The Mega control sits to the right of the grid: `right` from the last
    // column lands on it, and `left` returns to the moves (D34).
    if (mega && this.megaSelected) {
      if (action === 'left') {
        this.megaSelected = false;
        this.refreshHud();
      }
      return;
    }

    let index = this.menuIndex;
    for (let step = 0; step < count; step++) {
      const row = Math.floor(index / cols);
      const col = index % cols;
      if (action === 'right' && mega && (col === cols - 1 || index === count - 1)) {
        this.megaSelected = true;
        this.refreshHud();
        return;
      }
      let nextRow = row;
      let nextCol = col;
      if (action === 'up') nextRow = (row - 1 + rows) % rows;
      else if (action === 'down') nextRow = (row + 1) % rows;
      else if (action === 'left') nextCol = (col - 1 + cols) % cols;
      else nextCol = (col + 1) % cols;
      index = Math.min(nextRow * cols + nextCol, count - 1);
      if (this.menuItems[index].enabled) break;
    }
    if (index === this.menuIndex) return;
    this.menuIndex = index;
    this.refreshHud();
  }

  private confirmMenu(): void {
    if (this.mode === 'moves' && this.megaSelected && this.megaAvailable()) {
      this.toggleMega();
      return;
    }
    const item = this.menuItems[this.menuIndex];
    if (item?.enabled) item.onSelect();
  }

  // --- rendering ----------------------------------------------------------

  /** Shows a message whole: menus and prompts are not typed out. */
  private setMessage(text: string): void {
    this.typing = revealAll(beginTypewriter(text));
    this.messageText.setText(text);
  }

  /** Starts revealing a message at the player's text speed. */
  private typeMessage(text: string): void {
    this.typing = beginTypewriter(text);
    this.typingRemainder = 0;
    this.messageText.setText('');
  }

  /**
   * Reveals the characters the frame's elapsed time buys. The leftover time is
   * carried into the next frame, so a frame shorter than one character (a 60 Hz
   * or 120 Hz tick is) still reveals the line instead of stalling on the first.
   */
  private tickTyping(delta: number): void {
    this.typingRemainder += delta;
    const { typewriter, elapsed } = advanceTypewriter(this.typing, this.typingRemainder, this.charMs);
    this.typingRemainder = elapsed;
    if (typewriter === this.typing) return;
    this.typing = typewriter;
    this.messageText.setText(visibleText(typewriter));
  }

  /** Skips to the end of the line (a confirm tap, or confirm held). */
  private completeTyping(): void {
    if (typewriterDone(this.typing)) return;
    this.typing = revealAll(this.typing);
    this.messageText.setText(this.typing.text);
  }

  private refreshHud(): void {
    // The battle lives in a centred square (at most `MAX_BATTLE_SIZE`), so it
    // reads the same on a wide desktop and a phone. Everything below is laid out
    // in that square's own coordinates; the camera viewport places and clips it.
    const { width: canvasW, height: canvasH } = this.scale;
    // A wide screen gets a centred **square** stage capped at `MAX_BATTLE_SIZE`,
    // so the battle never stretches across a widescreen. A tall screen keeps its
    // full portrait stage: the stacked phone layout needs the height.
    const wide = canvasW > canvasH;
    const width = wide ? Math.min(canvasH, MAX_BATTLE_SIZE) : canvasW;
    const height = wide ? width : canvasH;
    this.cameras.main.setViewport(
      Math.round((canvasW - width) / 2),
      Math.round((canvasH - height) / 2),
      width,
      height,
    );
    this.bgTop.setPosition(0, 0).setSize(width, height * 0.52);
    this.bgBottom.setPosition(0, height * 0.52).setSize(width, height * 0.48);
    const trainer = this.foeTrainer.visible;
    const compact = width < COMPACT_SIZE;
    this.monScaleFactor = compact ? COMPACT_MON_SCALE : 1;
    const menuOpen = this.menuItems.length > 0;

    let box: Rect;
    let foeInfo: Rect;
    let playerInfo: Rect;
    let menu: Rect;
    let message: Rect;
    let foeX: number;
    let foeY: number;
    let playerX: number;
    let playerY: number;

    if (compact) {
      const pad = 16;
      const panelW = width - pad * 2;
      const boxH = 236;
      box = { x: pad, y: height - boxH - pad, w: panelW, h: boxH };
      foeInfo = { x: pad, y: pad, w: panelW, h: FOE_PANEL.h };
      playerInfo = { x: pad, y: Math.round(height * 0.46), w: panelW, h: PLAYER_PANEL_H };
      foeX = width * 0.72;
      // Leave the tallest possible sprite a full box between the foe panel and
      // its platform, so a titan is never clipped behind the panel.
      foeY = foeInfo.y + foeInfo.h + SPRITE_SIZE_MAX - FOE_PLATFORM_OFFSET;
      playerX = width * 0.32;
      playerY = playerInfo.y - 90;
    } else {
      box = { x: 36, y: height - 218, w: width - 72, h: 192 };
      foeInfo = { x: 36, y: 28, w: FOE_PANEL.w, h: FOE_PANEL.h };
      playerInfo = {
        x: width - 36 - PLAYER_PANEL_W,
        y: box.y - 24 - PLAYER_PANEL_H,
        w: PLAYER_PANEL_W,
        h: PLAYER_PANEL_H,
      };
      foeX = trainer ? width * 0.78 : width * 0.72;
      foeY = trainer ? height * 0.3 : height * 0.28;
      playerX = width * 0.27;
      playerY = height * 0.6;
    }

    // The move-detail popup floats over the field when the ⓘ button asks for
    // it, so it never moves the panels around it (see `MoveGrid`).

    // Both boxes span the full bottom width and share it: the choice menu owns
    // the whole box while it is open and the message window steps aside, so a
    // list is never squeezed next to the text (the same shape on phone and
    // desktop now).
    menu = { x: box.x, y: box.y, w: box.w, h: box.h };
    message = { x: box.x, y: box.y + box.h - MESSAGE_H, w: box.w, h: MESSAGE_H };

    const foePlatformY = foeY + FOE_PLATFORM_OFFSET;
    const playerPlatformY = playerY + PLAYER_PLATFORM_OFFSET;
    // Cap each sprite so its head clears the panel above it, and on a phone also
    // stays narrow enough for the two battlers to sit side by side.
    const panelBottom = foeInfo.y + foeInfo.h;
    const widthCap = Math.round(width * 0.44);
    this.monSizeCap.enemy = Math.min(
      SPRITE_SIZE_MAX,
      compact ? Math.min(foePlatformY - panelBottom, widthCap) : foePlatformY - MON_TOP_MARGIN,
    );
    this.monSizeCap.player = Math.min(
      SPRITE_SIZE_MAX,
      compact ? Math.min(playerPlatformY - panelBottom, widthCap) : playerPlatformY - MON_TOP_MARGIN,
    );
    this.syncMonSprites();
    this.foeMonPos = { x: foeX, y: foePlatformY };
    this.playerMonPos = { x: playerX, y: playerPlatformY };
    if (this.beat.enemy !== 'faint') this.foeSprite.setPosition(foeX, foePlatformY);
    this.foePlatform
      .setScale(platformScale(this.monDrawHeight.enemy))
      .setPosition(compact ? foeX : width * 0.72, foePlatformY);
    if (trainer) this.foeTrainer.setPosition((compact ? foeX : width * 0.72) - 70, foeY + 62);
    if (this.beat.player !== 'faint') this.playerSprite.setPosition(playerX, playerPlatformY);
    this.playerPlatform.setScale(platformScale(this.monDrawHeight.player)).setPosition(playerX, playerPlatformY);
    this.foeSprite.setVisible((this.displayHp.enemy > 0 && !this.captured) || this.beat.enemy === 'faint');
    this.playerSprite.setVisible(this.displayHp.player > 0 || this.beat.player === 'faint');

    this.hud.clear();
    this.drawSidePanel(foeInfo, 'enemy');
    this.drawSidePanel(playerInfo, 'player');
    this.messagePanel.setSlices(message.w, message.h).setPosition(message.x, message.y);
    this.menuPanel.setSlices(menu.w, menu.h).setPosition(menu.x, menu.y);
    this.messagePanel.setVisible(!menuOpen);
    this.messageText.setVisible(!menuOpen);

    this.messageText.setPosition(message.x + FRLG_TEXTBOX_PADDING.x, message.y + FRLG_TEXTBOX_PADDING.top);
    this.messageText.setMaxWidth(message.w - FRLG_TEXTBOX_PADDING.x * 2);

    if (menuOpen) {
      if (this.mode === 'bag') this.renderBagMenu(menu);
      else if (this.mode === 'moves') this.renderMoveMenu(menu);
      else if (this.mode === 'menu') this.renderCommandMenu(menu);
      else this.renderPartyGrid(menu);
    } else {
      this.hideMenu();
    }
  }

  private drawSidePanel(rect: Rect, side: SideId): void {
    const panel = side === 'player' ? this.playerPanel : this.foePanel;
    panel.setSlices(rect.w, rect.h).setPosition(rect.x, rect.y);
    const fighter = this.displayActive[side];
    const hp = this.displayHp[side];
    const fraction = hpFraction(hp, fighter.maxHp);

    // Content stays inside the FRLG window's baked border: the name drops below
    // the top frame and the bar keeps its gap, so nothing rides the bevel.
    const pad = FRLG_WINDOW_PADDING;
    const nameY = rect.y + pad.top;
    const barX = rect.x + pad.x;
    const barY = nameY + PANEL_NAME_H + PANEL_NAME_GAP;

    this.nameText[side].setText(`${fighter.name}  Lv${fighter.level}`).setPosition(barX, nameY);
    this.statText[side]
      .setText(side === 'player' ? `${hp}/${fighter.maxHp}` : '')
      .setPosition(rect.x + rect.w - pad.x, barY - 23);

    const status = this.displayStatus[side];
    const statusFrame = status ? statusIconFrame(status) : null;
    if (statusFrame !== null) {
      // The FRLG badge carries its own colours, so no chip is painted behind it.
      this.statusBadges[side].setFrame(statusFrame).setPosition(barX, barY - 22).setVisible(true);
      this.statusText[side].setVisible(false);
    } else {
      this.statusBadges[side].setVisible(false);
      const abbreviation = statusAbbreviation(status);
      this.statusText[side]
        .setText(abbreviation ?? '')
        .setPosition(barX + 27, barY - 23)
        .setVisible(abbreviation !== null);
      if (abbreviation) {
        this.hud.fillStyle(0x8b5cf6, 1);
        this.hud.fillRoundedRect(barX, barY - 24, 54, 20, 6);
      }
    }

    const bar = this.hpBars[side];
    bar.fill
      .setPosition(barX + FRLG_HPBAR.fill.x, barY + FRLG_HPBAR.fill.y)
      .setSize(Math.max(0, FRLG_HPBAR.fill.width * fraction), FRLG_HPBAR.fill.height)
      .setFillStyle(hpColorInt(fraction));
    bar.bar.setPosition(barX, barY);

    if (side === 'player') {
      drawGauge(
        this.hud,
        barX,
        barY + 36,
        FRLG_HPBAR.width,
        8,
        experienceFraction(this.xp, fighter.level),
        0x60a5fa,
      );
      this.xpText.setText(`XP ${this.xp}`).setPosition(barX, barY + 46).setVisible(true);
    } else {
      this.xpText.setVisible(false);
    }
  }

  /**
   * The main battle commands (FIGHT / BAG / SWITCH / RUN) as a 2x2 grid, matching
   * the moves grid: a neutral cell each, the name centred and the cursor at the
   * selected cell's end.
   */
  private renderCommandMenu(menu: Rect): void {
    this.menuPanel.setVisible(true);
    this.hideBagTabs();
    this.hideMoveChrome();
    this.hidePartyGrid();
    this.layoutBackButton(menu, false);
    const pad = FRLG_WINDOW_PADDING;
    const count = this.menuItems.length;
    const cols = MENU_GRID_COLS;
    const rows = Math.max(1, Math.ceil(count / cols));
    const left = menu.x + pad.x + MOVE_GRID_INSET;
    const right = menu.x + menu.w - pad.x - MOVE_GRID_INSET;
    const top = menu.y + pad.top + MOVE_GRID_INSET;
    const bottom = menu.y + menu.h - pad.bottom - MOVE_GRID_INSET;
    const cellW = (right - left - (cols - 1) * MENU_GRID_GAP) / cols;
    const cellH = (bottom - top - (rows - 1) * MENU_GRID_GAP) / rows;
    const cellX = (i: number): number => left + (i % cols) * (cellW + MENU_GRID_GAP);
    const cellY = (i: number): number => top + Math.floor(i / cols) * (cellH + MENU_GRID_GAP);

    this.menuRows.forEach((row, i) => {
      const item = i < count ? this.menuItems[i] : undefined;
      if (!item) {
        row.setVisible(false);
        return;
      }
      row
        .setText(item.label)
        .setAlpha(item.enabled ? 1 : 0.4)
        .setFontSize(FRLG_FONT_SIZE)
        .setMaxWidth(cellW - 32)
        .setOrigin(0.5, 0.5)
        .setPosition(cellX(i) + cellW / 2, cellY(i) + cellH / 2)
        .setVisible(true);
    });
    this.commandCells.forEach((cell, i) => {
      const item = i < count ? this.menuItems[i] : undefined;
      if (!item) {
        cell.setVisible(false);
        return;
      }
      const selected = i === this.menuIndex;
      cell
        .setPosition(cellX(i), cellY(i))
        .setSize(cellW, cellH)
        .setFillStyle(selected ? 0xf7e0a6 : 0xe6e3f2)
        .setStrokeStyle(selected ? 3 : 2, selected ? 0x2f2c4d : 0x9a94b8)
        .setVisible(true);
    });
    this.menuZones.forEach((zone, i) => {
      const item = i < count ? this.menuItems[i] : undefined;
      zone.setData('item', item ? i : -1);
      if (zone.input) zone.input.enabled = Boolean(item);
      if (item) zone.setPosition(cellX(i), cellY(i)).setSize(cellW, cellH);
    });
    this.menuCursor
      .setFlipX(true)
      .setPosition(cellX(this.menuIndex) + cellW - 48, cellY(this.menuIndex) + cellH / 2)
      .setVisible(count > 0);
  }

  /**
   * The party (switch) menu as an avatar grid: one cell per member, with its face,
   * name, level and HP. The ◀ back control sits centred on the grid's left edge,
   * as in the moves menu.
   */
  private renderPartyGrid(menu: Rect): void {
    this.menuPanel.setVisible(true);
    this.hideBagTabs();
    this.hideMoveChrome();
    const pad = FRLG_WINDOW_PADDING;
    const party = this.state.sides.player.party;
    const count = this.menuItems.length;
    const cols = PARTY_COLS;
    const rows = Math.max(1, Math.ceil(count / cols));
    const left = menu.x + pad.x;
    const right = menu.x + menu.w - pad.x - MOVE_GRID_INSET;
    const top = menu.y + pad.top + MOVE_GRID_INSET;
    const bottom = menu.y + menu.h - pad.bottom - MOVE_GRID_INSET;
    const gridLeft = left + MOVE_BACK_COL;
    const cellW = (right - gridLeft - (cols - 1) * MENU_GRID_GAP) / cols;
    const cellH = (bottom - top - (rows - 1) * MENU_GRID_GAP) / rows;
    const cellX = (i: number): number => gridLeft + (i % cols) * (cellW + MENU_GRID_GAP);
    const cellY = (i: number): number => top + Math.floor(i / cols) * (cellH + MENU_GRID_GAP);

    // The ◀ back control, centred on the grid's left edge, as in the moves menu.
    const backX = left + 14;
    const backY = (top + bottom) / 2;
    this.backArrow.setVisible(true).setPosition(backX, backY);
    this.backZone.setPosition(backX - 12, backY - 18).setSize(48, 36);
    if (this.backZone.input) this.backZone.input.enabled = true;

    // The shared list rows are not used by the avatar grid.
    for (const row of this.menuRows) row.setVisible(false);
    for (const zone of this.menuZones) {
      zone.setData('item', -1);
      if (zone.input) zone.input.enabled = false;
    }

    const avatarW = PORTRAIT_SIZE * PARTY_AVATAR_SCALE;
    this.partyCells.forEach((cell, i) => {
      const item = i < count ? this.menuItems[i] : undefined;
      const member = i < count ? party[i] : undefined;
      if (!item || !member) {
        cell.setVisible(false);
        this.partyAvatars[i].setVisible(false);
        this.partyLabels[i].setVisible(false);
        this.partyHpBars[i].setVisible(false);
        this.partyHpFills[i].setVisible(false);
        return;
      }
      const selected = i === this.menuIndex;
      cell
        .setPosition(cellX(i), cellY(i))
        .setSize(cellW, cellH)
        .setFillStyle(selected ? 0xf7e0a6 : 0xe6e3f2)
        .setStrokeStyle(selected ? 3 : 2, selected ? 0x2f2c4d : 0x9a94b8)
        .setVisible(true);
      const portrait = portraitFor(member.speciesId, member.shiny);
      this.partyAvatars[i]
        .setVisible(portrait !== null)
        .setAlpha(item.enabled ? 1 : 0.45)
        .setPosition(cellX(i) + 8 + avatarW / 2, cellY(i) + cellH / 2);
      if (portrait) this.partyAvatars[i].setTexture(portrait.key, portrait.frame);
      const labelX = cellX(i) + 8 + avatarW + 6;
      this.partyLabels[i]
        .setText(item.label)
        .setAlpha(item.enabled ? 1 : 0.45)
        .setMaxWidth(cellW - avatarW - 22)
        .setOrigin(0, 0)
        .setPosition(labelX, cellY(i) + 6)
        .setVisible(true);

      // The HP bar shrinks with the cell so it never runs into its neighbour.
      const barScale = Math.min(
        PARTY_CELL_HPBAR_SCALE,
        Math.max(24, cellW - avatarW - 22) / FRLG_HPBAR.width,
      );
      const fraction = hpFraction(member.hp, member.maxHp);
      const alive = member.hp > 0;
      const barY = cellY(i) + 30;
      this.partyHpBars[i]
        .setVisible(alive)
        .setScale(barScale)
        .setPosition(labelX, barY);
      this.partyHpFills[i]
        .setVisible(alive)
        .setPosition(labelX + FRLG_HPBAR.fill.x * barScale, barY + FRLG_HPBAR.fill.y * barScale)
        .setSize(
          Math.max(0, FRLG_HPBAR.fill.width * barScale * fraction),
          FRLG_HPBAR.fill.height * barScale,
        )
        .setFillStyle(hpColorInt(fraction));
    });
    this.partyZones.forEach((zone, i) => {
      const item = i < count ? this.menuItems[i] : undefined;
      zone.setData('item', item ? i : -1);
      if (zone.input) zone.input.enabled = Boolean(item);
      if (item) zone.setPosition(cellX(i), cellY(i)).setSize(cellW, cellH);
    });
    this.menuCursor
      .setFlipX(true)
      .setPosition(cellX(this.menuIndex) + cellW - 48, cellY(this.menuIndex) + cellH / 2)
      .setVisible(count > 0);
    this.renderPartyDetail(menu);
  }

  /**
   * The party detail window for the member under the cursor, floating above the
   * avatar grid. No tabs: the five battle stats, nature, ability and held item in
   * a left column, the four moves (tinted by type) in a 2x2 grid on the right. The
   * window scales down to fit a narrow stage.
   */
  private renderPartyDetail(menu: Rect): void {
    const fighter = this.state.sides.player.party[this.menuIndex];
    const detail = fighter ? fighterDetail(fighter) : null;
    if (!detail) {
      this.partyDetail.setVisible(false);
      return;
    }
    const scale = Math.min(1, menu.w / PARTY_DETAIL_W);
    const height = PARTY_DETAIL_H * scale;
    const x = Math.max(0, Math.min(menu.x, menu.x * 2 + menu.w - PARTY_DETAIL_W * scale));
    const y = Math.max(0, menu.y - height - MOVE_POPUP_GAP);
    this.partyDetail.setScale(scale).setPosition(x, y).setVisible(true);

    this.partyDetailName.setText(detail.name);
    this.partyDetailLevel.setText(`Lv${detail.level}`);
    this.partyDetailTypes.forEach((chip, i) => {
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

    const { hpText, rows, nature, ability, held } = this.partyDetailStats;
    hpText.setText(`HP  ${detail.hp}/${detail.maxHp}`);
    rows.forEach((row, i) => {
      const stat = DETAIL_STATS[i];
      row.value.setText(String(detail.stats[stat]));
      // Green for the stat a nature raises, red for the one it lowers.
      const effect = natureEffect(detail.nature, stat);
      const tint = effect === 'up' ? NATURE_UP_TINT : effect === 'down' ? NATURE_DOWN_TINT : FRLG_INK;
      row.value.setTint(tint);
      if (effect !== 'neutral') row.label.setTint(tint);
    });
    nature.setText(`NATURE  ${capitalize(detail.nature)}`);
    ability.setText(`ABILITY  ${detail.ability}`);
    held.setText(`HELD  ${detail.heldItemName ?? 'none'}`);

    this.partyDetailEmpty.setVisible(detail.moves.length === 0);
    this.partyDetailMoves.forEach((row, i) => {
      const move = detail.moves[i];
      const visible = move !== undefined;
      row.cell.setVisible(visible);
      row.name.setVisible(visible);
      row.pp.setVisible(visible);
      if (!move) {
        row.name.setText('');
        row.pp.setText('');
        return;
      }
      row.cell.setFillStyle(typeTint(move.type, 0.72));
      row.name.setText(move.name);
      row.pp.setText(`PP ${move.pp}/${move.maxPp}`);
    });
  }

  /** Hides the party grid's cells, avatars, labels, HP bars and hit zones. */
  private hidePartyGrid(): void {
    for (const cell of this.partyCells) cell.setVisible(false);
    for (const avatar of this.partyAvatars) avatar.setVisible(false);
    for (const label of this.partyLabels) label.setVisible(false);
    for (const bar of this.partyHpBars) bar.setVisible(false);
    for (const fill of this.partyHpFills) fill.setVisible(false);
    for (const zone of this.partyZones) {
      zone.setData('item', -1);
      if (zone.input) zone.input.enabled = false;
    }
    this.partyDetail.setVisible(false);
  }

  /**
   * The moves menu: the shared grid fills the window (the same component the route
   * HUD draws in its detail panel), the ◀ back control sits centred on the grid's
   * left edge and the MEGA control takes a column on the right while it is usable.
   * The grid's own popup floats the type and description of the move the cursor is
   * on.
   */
  private renderMoveMenu(menu: Rect): void {
    this.menuPanel.setVisible(true);
    this.hideBagTabs();
    this.hidePartyGrid();
    for (const row of this.menuRows) row.setVisible(false);
    for (const cell of this.commandCells) cell.setVisible(false);
    const pad = FRLG_WINDOW_PADDING;
    const count = this.menuItems.length;
    const left = menu.x + pad.x;
    const right = menu.x + menu.w - pad.x - MOVE_GRID_INSET;
    const top = menu.y + pad.top + MOVE_GRID_INSET;
    const bottom = menu.y + menu.h - pad.bottom - MOVE_GRID_INSET;
    // The Mega control takes a column on the right, but only while it is usable.
    const mega = this.megaAvailable();
    if (!mega) this.megaSelected = false;

    // The ◀ back control, centred in the grid's reserved left column.
    const backY = (top + bottom) / 2;
    const backW = this.backArrow.displayWidth;
    const backX = left + Math.round((MOVE_BACK_COL - backW) / 2);
    this.backArrow.setVisible(true).setPosition(backX, backY);
    this.backZone.setPosition(backX + backW / 2 - 24, backY - 18).setSize(48, 36);
    if (this.backZone.input) this.backZone.input.enabled = true;

    this.layoutMegaControl(right, top, bottom, mega);

    const cells: MoveGridCell[] = this.menuItems.map((item) => ({
      name: item.label,
      type: item.move?.type ?? '',
      category: item.move?.category ?? 'Status',
      pp: item.move?.pp ?? 0,
      maxPp: item.move?.maxPp ?? 0,
      desc: item.move?.desc ?? '',
      power: item.move?.power ?? 0,
      basePower: item.move?.basePower ?? 0,
      accuracy: item.move?.accuracy ?? null,
      baseAccuracy: item.move?.baseAccuracy ?? null,
      status: item.move?.status ?? null,
      enabled: item.enabled,
    }));
    this.moveGrid.layout({
      x: menu.x,
      y: menu.y,
      w: menu.w,
      h: menu.h,
      cells,
      selected: this.megaSelected ? -1 : this.menuIndex,
      info: this.megaSelected ? null : this.infoMove,
      leftReserve: MOVE_BACK_COL,
      rightReserve: mega ? MOVE_MEGA_COL : 0,
    });

    this.menuZones.forEach((zone, i) => {
      const item = i < count ? this.menuItems[i] : undefined;
      zone.setData('item', item ? i : -1);
      if (zone.input) zone.input.enabled = Boolean(item);
      if (!item) return;
      const rect = this.moveGrid.cellRect(i);
      const infoRect = this.moveGrid.infoRect(i);
      if (!rect || !infoRect) return;
      zone.setPosition(rect.x, rect.y).setSize(rect.w, rect.h).setData('infoRect', infoRect);
    });
    // The moves grid marks its selection with the cell's highlight alone; the
    // ▶ cursor only appears on the Mega control when that is the target.
    if (this.megaSelected) {
      this.menuCursor
        .setFlipX(true)
        .setPosition(this.megaCell.x + this.megaCell.width - 12, this.megaCell.y + this.megaCell.height / 2)
        .setVisible(true);
    } else {
      this.menuCursor.setVisible(false);
    }
  }

  /**
   * Lays out the MEGA control at the right edge of the moves menu, or hides it
   * when the active Pokémon cannot Mega Evolve (D34). The label shows a `+` while
   * the evolution is armed.
   */
  private layoutMegaControl(right: number, top: number, bottom: number, show: boolean): void {
    if (!show) {
      this.megaCell.setVisible(false);
      this.megaText.setVisible(false);
      if (this.megaZone.input) this.megaZone.input.enabled = false;
      return;
    }
    const x = right - MOVE_MEGA_COL;
    const h = bottom - top;
    const selected = this.megaSelected;
    this.megaCell
      .setPosition(x, top)
      .setSize(MOVE_MEGA_COL, h)
      .setFillStyle(selected ? 0xf7e0a6 : this.megaIntent ? 0xc7d2fe : 0xe6e3f2)
      .setStrokeStyle(selected ? 3 : 2, selected ? 0x2f2c4d : 0x9a94b8)
      .setVisible(true);
    this.megaText
      .setText(this.megaIntent ? 'MEGA +' : 'MEGA')
      .setPosition(x + MOVE_MEGA_COL / 2, top + h / 2)
      .setVisible(true);
    this.megaZone.setPosition(x, top).setSize(MOVE_MEGA_COL, h);
    if (this.megaZone.input) this.megaZone.input.enabled = true;
  }

  /** Hides the grid and its popup: cells, badges, PP / power / accuracy, ⓘ and info. */
  private hideMoveChrome(): void {
    this.moveGrid.hide();
    for (const cell of this.commandCells) cell.setVisible(false);
    this.megaCell.setVisible(false);
    this.megaText.setVisible(false);
    if (this.megaZone.input) this.megaZone.input.enabled = false;
    this.infoMove = null;
    this.infoPinned = false;
  }

  /** The bag: a pocket tab strip over the active pocket's stacks. */
  private renderBagMenu(menu: Rect): void {
    this.menuPanel.setVisible(true);
    this.hideMoveChrome();
    this.hidePartyGrid();
    const pad = FRLG_WINDOW_PADDING;
    const tabY = menu.y + pad.top;
    this.bagTabs.forEach((tab, slot) => {
      const category = this.bagCategories[slot];
      if (!category) {
        tab.bg.setVisible(false);
        tab.label.setVisible(false);
        return;
      }
      const x = menu.x + pad.x + slot * (MENU_TAB_W + MENU_TAB_GAP);
      const active = category === this.bagCategory;
      tab.bg
        .setPosition(x, tabY)
        .setSize(MENU_TAB_W, MENU_TAB_H)
        .setFillStyle(active ? 0x2f2c4d : 0xcfcce2)
        .setVisible(true);
      tab.label
        .setText(BAG_CATEGORY_LABELS[category])
        .setTint(active ? 0xf8fafc : FRLG_INK)
        .setPosition(x + MENU_TAB_W / 2, tabY + 5)
        .setVisible(true);
    });
    // The ◀ back control sits centred on the list's left edge, as in the grids.
    const rowsTop = tabY + MENU_TAB_H + 8;
    const backX = menu.x + pad.x + 14;
    const backY = (rowsTop + menu.y + menu.h - pad.bottom) / 2;
    this.backArrow.setVisible(true).setPosition(backX, backY);
    this.backZone.setPosition(backX - 12, backY - 18).setSize(48, 36);
    if (this.backZone.input) this.backZone.input.enabled = true;
    this.layoutMenuRows(menu, this.menuItems, rowsTop, MENU_BAG_ROWS, MOVE_BACK_COL);
  }

  /** Places the ◀ back control in the submenu header, or hides it. */
  private layoutBackButton(menu: Rect, visible: boolean): void {
    this.backArrow.setVisible(visible);
    if (this.backZone.input) this.backZone.input.enabled = visible;
    if (!visible) return;
    const x = menu.x + menu.w - FRLG_WINDOW_PADDING.x - 26;
    const y = menu.y + FRLG_WINDOW_PADDING.top + MENU_TAB_H / 2;
    this.backArrow.setPosition(x, y);
    this.backZone.setPosition(x - 12, y - 18).setSize(50, 36);
  }

  /** Draws a windowed list of rows and lines the click zones up with them. */
  private layoutMenuRows(
    menu: Rect,
    items: readonly MenuItem[],
    top: number,
    visibleRows: number,
    leftInset = 0,
  ): void {
    const count = items.length;
    const windowStart = Math.max(0, Math.min(this.menuIndex - 1, count - visibleRows));
    this.menuRows.forEach((row, i) => {
      const item = i < visibleRows ? items[windowStart + i] : undefined;
      if (!item) {
        row.setVisible(false);
        return;
      }
      row
        .setText(item.label)
        .setAlpha(item.enabled ? 1 : 0.4)
        .setFontSize(FRLG_FONT_SIZE)
        .setMaxWidth(menu.w - 80 - leftInset)
        .setOrigin(0, 0)
        .setPosition(menu.x + 58 + leftInset, top + i * ROW_H)
        .setVisible(true);
    });
    this.menuZones.forEach((zone, i) => {
      const item = i < visibleRows ? items[windowStart + i] : undefined;
      zone.setData('item', item ? windowStart + i : -1);
      if (zone.input) zone.input.enabled = Boolean(item);
      if (item) {
        zone.setPosition(menu.x + 10 + leftInset, top + i * ROW_H - 4).setSize(menu.w - 20 - leftInset, ROW_H);
      }
    });
    this.menuCursor
      .setFlipX(false)
      .setPosition(menu.x + 18 + leftInset, top + (this.menuIndex - windowStart) * ROW_H + 16)
      .setVisible(count > 0);
  }

  /** Hides every piece of the menu chrome when nothing is open. */
  private hideMenu(): void {
    this.menuPanel.setVisible(false);
    this.menuCursor.setVisible(false);
    for (const row of this.menuRows) row.setVisible(false);
    for (const zone of this.menuZones) {
      zone.setData('item', -1);
      if (zone.input) zone.input.enabled = false;
    }
    this.hideMoveChrome();
    this.hidePartyGrid();
    this.hideBagTabs();
    this.backArrow.setVisible(false);
    if (this.backZone.input) this.backZone.input.enabled = false;
  }

  private hideBagTabs(): void {
    for (const tab of this.bagTabs) {
      tab.bg.setVisible(false);
      tab.label.setVisible(false);
    }
  }

  /** Hovering a row moves the cursor onto it, like the arrow keys. */
  private onMenuHover(zone: Phaser.GameObjects.Zone): void {
    const index = zone.getData('item');
    if (typeof index !== 'number' || index < 0) return;
    const changed = this.megaSelected || index !== this.menuIndex;
    this.megaSelected = false;
    if (!changed) return;
    this.menuIndex = index;
    this.refreshHud();
  }

  /** Clicking a row selects it; in the moves grid a press on its ⓘ opens the info. */
  private onMenuClick(zone: Phaser.GameObjects.Zone, localX = -1, localY = -1): void {
    const index = zone.getData('item');
    if (typeof index !== 'number' || index < 0) return;
    if (this.mode === 'moves' && this.insideInfoButton(zone, localX, localY)) {
      this.onInfoClick(index);
      return;
    }
    const item = this.menuItems[index];
    if (!item?.enabled) return;
    this.menuIndex = index;
    this.confirmMenu();
  }

  /** True when a cell-local point falls inside that cell's ⓘ button. */
  private insideInfoButton(zone: Phaser.GameObjects.Zone, localX: number, localY: number): boolean {
    const rect = zone.getData('infoRect') as Rect | undefined;
    if (!rect || localX < 0 || localY < 0) return false;
    return localX >= rect.x && localX <= rect.x + rect.w && localY >= rect.y && localY <= rect.y + rect.h;
  }

  /** Moving over a moves cell watches its ⓘ button for hover. */
  private onMenuPointerMove(zone: Phaser.GameObjects.Zone, localX: number, localY: number): void {
    if (this.mode !== 'moves') return;
    const index = zone.getData('item');
    if (typeof index !== 'number' || index < 0) return;
    if (this.insideInfoButton(zone, localX, localY)) this.onInfoHover(index);
    else this.onInfoOut(index);
  }

  /** Leaving a moves cell hides an unpinned info popup. */
  private onMenuPointerOut(zone: Phaser.GameObjects.Zone): void {
    if (this.mode !== 'moves') return;
    const index = zone.getData('item');
    if (typeof index === 'number') this.onInfoOut(index);
  }

  /** Hovering the MEGA control moves the keyboard cursor onto it. */
  private onMegaHover(): void {
    if (this.mode !== 'moves' || this.megaSelected || !this.megaAvailable()) return;
    this.megaSelected = true;
    this.refreshHud();
  }

  /** Clicking the MEGA control arms or disarms it. */
  private onMegaClick(): void {
    if (this.mode !== 'moves' || !this.megaAvailable()) return;
    this.megaSelected = true;
    this.toggleMega();
  }

  /** Hovering a move's ⓘ button floats its info popup, unless one is pinned. */
  private onInfoHover(index: number): void {
    if (this.mode !== 'moves' || this.infoPinned || this.infoMove === index) return;
    this.infoMove = index;
    this.refreshHud();
  }

  /** Leaving the ⓘ button hides an unpinned popup. */
  private onInfoOut(index: number): void {
    if (this.infoPinned || this.infoMove !== index) return;
    this.infoMove = null;
    this.refreshHud();
  }

  /** Clicking the ⓘ button pins the popup open, or closes it when already pinned. */
  private onInfoClick(index: number): void {
    if (this.mode !== 'moves') return;
    if (this.infoPinned && this.infoMove === index) {
      this.infoPinned = false;
      this.infoMove = null;
    } else {
      this.infoPinned = true;
      this.infoMove = index;
    }
    this.refreshHud();
  }

  /** The ◀ control: leaves a submenu the same way cancel does. */
  private onBack(): void {
    if (this.mode === 'moves' || this.mode === 'party' || this.mode === 'bag') this.openMenu();
  }

  override update(_time: number, delta: number): void {
    if (this.mode !== 'feed') return;
    const rush = this.confirmKeys.some((key) => key.isDown);
    if (rush) this.completeTyping();
    else this.tickTyping(delta);
    // The read hold only starts once the line is fully revealed.
    if (!typewriterDone(this.typing)) {
      this.feedElapsed = 0;
      return;
    }
    this.feedElapsed += delta;
    if (this.feedElapsed >= (rush ? FAST_HOLD_MS : MESSAGE_HOLD_MS)) this.advanceFeed();
  }
}
