import Phaser from 'phaser';
import { getMove, heightOf, normalizeId } from '../data/dex';
import { megaFormForItem } from '../data/dex/megas';
import { gmaxFormForBase } from '../data/dex/gmaxes';
import { getItem } from '../data/items';
import { ITEM_ICON_TEXTURE_KEY, itemIconFrame } from '../data/itemIcons';
import { type KeybindAction, type Keybinds } from '../data/keybinds';
import {
  pokemonIdleAnimKey,
  pokemonSprite,
  type PokemonSpriteKind,
  type PokemonSpriteSheet,
} from '../data/pokemonSprites';
import { getTrainerArchetype, type AiFlag } from '../data/trainers';
import { TRAINER_SPRITE_TEXTURE_KEY, trainerSpriteFrame } from '../data/trainerSprites';
import {
  barredMovesFor,
  legalMoveIndices,
  switchablePartyIndices,
  withLeadSlot,
  type Command,
} from '../engine/battle/commands';
import {
  createFighter,
  restoreFighter,
  snapshotFighter,
  type BattleFighter,
  type StatusId,
} from '../engine/battle/fighter';
import { canGigantamax, revertGigantamax } from '../engine/battle/gmax';
import { movePreview } from '../engine/battle/preview';
import { chooseAiCommand, type AiLevel } from '../engine/battle/ai';
import { canRun } from '../engine/battle/runAway';
import type { BagSlot, BattleEvent } from '../engine/battle/state';
import {
  SIDE_IDS,
  activeFighter,
  autoReplace,
  canMegaEvolve,
  createBattle,
  liveSlots,
  needsReplacement,
  performSwitch,
  takeDoubleTurn,
  takeTurn,
  type BattleState,
  type SideId,
  type Slot,
  type SlotCommands,
} from '../engine/battle';
import { Rng } from '../engine/rng';
import { battlefieldSeeds } from '../engine/routes/battlefield';
import {
  MAX_MOVES,
  MAX_PARTY_SIZE,
  type BattleLaunch,
  type BattleOutcome,
  type BattleReturn,
} from '../engine/run';
import { PORTRAIT_SIZE, PORTRAIT_TEXTURE_KEY, portraitFor } from '../data/portraits';
import { MOVE_FX_TEXTURE_KEY, moveFxAnimKey, moveFxFor, moveFxTrack } from '../render/moveFx';
import { spriteContentBounds, type SpriteBounds } from '../render/spriteBounds';
import { battleSpriteHeight, SPRITE_SIZE_MAX } from '../data/spriteSize';
import {
  ENTRY_FOE_DROP,
  ENTRY_TRAINER_WALK,
  FAINT_DROP,
  FAINT_MS,
  SWITCH_RECALL_MS,
  SWITCH_SENDOUT_MS,
  SWITCH_SHRINK,
  entryBeat,
  type EntryKind,
  type EntryStep,
} from '../ui/beats';
import {
  captureBeat,
  captureTimeline,
  captureWaitLine,
  type CaptureTick,
  type CaptureTimeline,
} from '../ui/capture';
import {
  BAG_GRID_COLS,
  BAG_GRID_GAP,
  bagCategoryLabel,
  bagCategoryForKind,
  bagGridLayout,
  filterBagStacks,
  stepBagCursor,
  stepBagGrid,
  type BagCategory,
  type BagGridDebugState,
  type BagGridMetrics,
  type BagGridRect,
} from '../ui/bag';
import { battleFrames, type FeedFrame } from '../ui/feed';
import {
  HP_CUE_GAP,
  hpColorInt,
  hpCueNotches,
  hpFraction,
  isLowHp,
  statusAbbreviation,
} from '../ui/metrics';
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
import { IS_DEVELOP } from '../dev/env';
import { actionKeys, subscribeKeybinds } from '../input/input';
import { playCry, playCue, playMoveSound, playMusic } from '../audio/audio';
import {
  addFrlgHpBar,
  addFrlgWindow,
  FRLG_CURSOR_KEY,
  FRLG_HPBAR,
  FRLG_HPBAR_KEY,
  FRLG_TEXTBOX_PADDING,
  FRLG_WINDOW_PADDING,
} from '../ui/frlg';
import {
  FRLG_ACCENT,
  FRLG_BADGE_INK,
  FRLG_MUTED,
  FRLG_ROW_FILL,
  FRLG_ROW_STROKE,
  FRLG_SELECTED_FILL,
  FRLG_SELECTED_STROKE,
  FRLG_SURFACE,
  badgeInkFor,
} from '../ui/frlg';
import { FRLG_INK, FRLG_FONT_SIZE, FRLG_LINE_HEIGHT, addFrlgText } from '../ui/frlgFont';
import { typeColor } from '../ui/typeColors';
import { TYPE_ICON_TEXTURE_KEY, TYPE_ICON_W, typeIconFrame } from '../data/typeIcons';
import { STATUS_ICON_TEXTURE_KEY, statusIconFrame } from '../data/statusIcons';
import {
  DETAIL_STATS,
  NATURE_DOWN_TINT,
  NATURE_UP_TINT,
  fighterDetail,
  natureEffect,
  statLabel,
  type MemberDetail,
} from '../ui/partyDetail';
import { MoveGrid, moveInfoContent, padMoveGridCells, type MoveGridCell } from '../ui/moveGrid';
import { battleInfoLines, battleInfoRows } from '../ui/battleInfo';
import { fitPartyLabel, partyGridFieldRows, partyGridLayout } from '../ui/partyGrid';
import {
  AbilityInfoButton,
  ABILITY_INFO_SIZE,
  abilityInfoContent,
  abilityInfoSpot,
} from '../ui/abilityInfo';
import { InfoPopup } from '../ui/infoPopup';
import { BATTLE_MON_TEXTURE_KEY, BATTLE_PLATFORM_TEXTURE_KEY } from './BootScene';
import { t } from '../i18n';
import { moveName, moveShortDescription } from '../i18n/content';
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
/** Tall enough for the padded name row, the types band and the bar; the foe's height. */
const PLAYER_PANEL_H = 150;
const FOE_PANEL = { w: PANEL_W, h: 150 } as const;
/**
 * A double battle draws a second window per side: the gap between the pair, how
 * far each enemy sprite stands from the foe platform's centre, and the clearance
 * the stacked player window keeps from the battle square's edge.
 */
const SLOT_PANEL_GAP = 12;
const FOE_PLATFORM_SPREAD = 96;
const SLOT_PANEL_EDGE = 8;
/**
 * The dex targets that skip the target step: they already hit every adjacent slot,
 * so asking which one would be a lie.
 */
const SPREAD_TARGETS: ReadonlySet<string> = new Set(['allAdjacentFoes', 'allAdjacent', 'all']);
/** The name row's height inside an HP panel, above the types band. */
const PANEL_NAME_H = 32;
/** How much bigger than the atlas frame a panel's type badge draws. */
const PANEL_TYPE_SCALE = 2;
/** The types band: the badge row between the name row and the HP-bar gap. */
const PANEL_TYPES_H = 36;
/** Gap between the name row and the HP bar inside an HP panel. */
const PANEL_NAME_GAP = 26;
/** The band's slots (a Pokémon has at most two types) and the gap after a badge. */
const PANEL_TYPE_SLOTS = 2;
const PANEL_TYPE_GAP = 4;
/** The fallback chip's box in the band: one badge's footprint plus its own padding. */
const PANEL_CHIP_W = TYPE_ICON_W * PANEL_TYPE_SCALE + 8;
const PANEL_CHIP_H = PANEL_TYPES_H;
/** The chip's label, one font step up from the panel text, clipped to the box. */
const PANEL_TYPE_LABEL_SIZE = 24;
/** The trainer's ball row: one Añil Poké Ball per roster member, under the foe panel. */
const FOE_BALL_SCALE = 0.75;
const FOE_BALL_PITCH = 22;
const FOE_BALL_GAP = 4;
const FOE_BALL_SPENT_TINT = 0x4b5563;
const FOE_BALL_SPENT_ALPHA = 0.45;
/** The engine's blank texture the badges start on, as `InfoPopup` does. */
const BLANK_TEXTURE_KEY = '__DEFAULT';
const ROW_H = 34;
/**
 * The Mega Evolution glyph both forme controls draw: the shipped Hard Stone frame
 * every Mega Stone already borrows (`src/data/itemIcons.ts`), read through the
 * atlas' own frame map so no new art is packed.
 */
const MEGA_CONTROL_FRAME = itemIconFrame('hardstone') ?? 0;
/** The battle plays inside a centred square, at most this many pixels a side. */
const MAX_BATTLE_SIZE = 900;
/** Below this square side the stacked, full-width phone layout is used. */
const COMPACT_SIZE = 700;
/** The bag panel's pocket tabs, drawn inside the menu window, as in the route HUD. */
const MENU_TAB_W = 120;
const MENU_TAB_H = 26;
const MENU_TAB_GAP = 4;
/** The bag grid: five fixed columns over two rows of square icon cells. */
const MENU_BAG_ROWS = 2;
const MENU_BAG_CELL_MAX = 56;
/** The selected stack's line under the grid, and the gap above it. */
const MENU_BAG_DETAIL_H = 20;
const MENU_BAG_DETAIL_GAP = 6;
const BAG_INFO_W = 320;
const BAG_INFO_GAP = 8;
const MENU_BAG_CAP = MENU_BAG_ROWS * BAG_GRID_COLS;
/** The FIGHT / BAG / SWITCH / RUN grid: 2 columns, one gap and one inset. */
const MENU_GRID_COLS = 2;
const MENU_GRID_GAP = 8;
/** Width reserved at the left of the command grid for the ◀ back control. */
const MOVE_BACK_COL = 64;
/** Width reserved at the right of the moves grid for the Mega control (D34). */
const MOVE_MEGA_COL = 62;
/** Width reserved at the right of the moves grid for the G-Max control (D44). */
const MOVE_GMAX_COL = 62;
const MOVE_GRID_INSET = 8;
/** How far above the menu the party detail window (and the info popup) sits. */
const MOVE_POPUP_GAP = 8;
/** The party (switch) grid: one fixed-size row per member. */
const PARTY_LABEL_SIZE = 16;
/** The largest avatar scale a switch row may use; the row geometry caps it further. */
const PARTY_AVATAR_SCALE = 0.9;
/** The largest HP-bar scale a switch row may use; the row geometry caps it further. */
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
/**
 * The clearance the compact stack leaves above the player panel for the foe's
 * own platform — the 50 px ellipse's half height at its 1.1 max scale — so the
 * taller panel never sinks the foe's feet and shadow behind it.
 */
const FOE_PLATFORM_CLEAR = 28;
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
  PARTY_DETAIL_MOVE_ROWS * PARTY_DETAIL_MOVE_ROW + (PARTY_DETAIL_MOVE_ROWS - 1) * PARTY_DETAIL_MOVE_GAP;
const PARTY_DETAIL_H =
  Math.max(PARTY_DETAIL_LEFT_H, PARTY_DETAIL_CONTENT_TOP + PARTY_DETAIL_MOVES_H) +
  FRLG_WINDOW_PADDING.bottom;

/** "serious" -> "Serious", for the nature line. */
function capitalize(text: string): string {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}

type Mode =
  'entry' | 'feed' | 'menu' | 'partner' | 'moves' | 'target' | 'bag' | 'party' | 'over' | 'info';

/** A sprite beat that owns the mon's position/scale until it completes. */
type BeatKind = 'faint' | 'switch';

/**
 * The objects one HP window draws into: a side's slot 0 uses the shipped set and
 * slot 1 its own, built the same way, so `drawPanel` paints both identically.
 */
type PanelKit = Readonly<{
  panel: Phaser.GameObjects.NineSlice;
  nameText: Phaser.GameObjects.BitmapText;
  statText: Phaser.GameObjects.BitmapText;
  statusText: Phaser.GameObjects.BitmapText;
  statusBadge: Phaser.GameObjects.Image;
  typeBadges: readonly Phaser.GameObjects.Image[];
  typeChipBgs: readonly Phaser.GameObjects.Rectangle[];
  typeChips: readonly Phaser.GameObjects.BitmapText[];
  hpBar: { fill: Phaser.GameObjects.Rectangle; bar: Phaser.GameObjects.Image };
}>;

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
  /** The saved reduce-flashing preference, read once in `create` (D45). */
  private reducedFlash = false;
  /** The difficulty the enemy AI thinks at, read from the launch (D46). */
  private aiLevel: AiLevel = 'normal';
  private logLength = 0;
  private afterFeed: (() => void) | null = null;
  private mode: Mode = 'feed';
  /** The steps of the opening beat still to play, and which one is running. */
  private entrySteps: readonly EntryStep[] = [];
  private entryIndex = 0;
  /** The appearing enemy's cry plays once, at the first step that shows it. */
  private cryPlayed = false;
  private entryTimer: Phaser.Time.TimerEvent | null = null;
  private forcedSwitch = false;
  /** The player armed the Mega control for the move about to be chosen (D34). */
  private megaIntent = false;
  /** The player armed the G-Max control for the move about to be chosen (D44). */
  private gmaxIntent = false;

  private displayActive!: Record<SideId, BattleFighter>;
  private displayHp!: Record<SideId, number>;
  private displayStatus!: Record<SideId, StatusId | null>;
  /**
   * Slot 1's display snapshots, read per side: `null` in a single battle or on a
   * side with an empty second slot. `displayActive`/`displayHp`/`displayStatus`
   * keep meaning slot 0, so every shipped single-battle path reads what it did.
   */
  private displayActive2: Record<SideId, BattleFighter | null> = { player: null, enemy: null };
  private displayHp2: Record<SideId, number | null> = { player: null, enemy: null };
  private displayStatus2: Record<SideId, StatusId | null> = { player: null, enemy: null };
  /** True once this battle's launch asked for a double battle (`BattleLaunch.double`). */
  private double = false;
  /** The slot whose command the open menu is collecting (0 outside a double battle). */
  private commandSlot: Slot = 0;
  /** Slot 1's command while slot 0 is being chosen (`null` outside a double battle). */
  private partnerCommand: Command | null = null;
  /** The foe slot the target step is pointing at, or null while it is closed. */
  private targetSlot: 0 | 1 | null = null;
  /** The move index the target step is submitting, while it is open. */
  private targetMoveIndex: number | null = null;
  /** Battle-sheet frame for the enemy trainer, or null for a wild battle. */
  private trainerFrame: number | null = null;
  /** The last ball thrown, so the capture beat can reuse its icon. */
  private lastBallId: string | null = null;
  /** The foe is inside a ball, so it stays hidden even at full HP. */
  private captured = false;
  /** How long the frame on screen is held before the feed advances. */
  private frameHoldMs = MESSAGE_HOLD_MS;
  /** The capture beat the feed frame is playing, and the timers that tick it. */
  private captureTiming: CaptureTimeline | null = null;
  private captureTimers: Phaser.Time.TimerEvent[] = [];
  private captureTweens: Phaser.Tweens.TweenChain | null = null;
  private captureFlash: Phaser.Tweens.Tween | null = null;
  /** The capture frame's own final line and the roll it settles on. */
  private captureFinalLine = '';
  private captureName = '';
  private captureHeld = false;
  private captureOpenFrame: number | null = null;
  /** A running faint/switch beat owns the mon's sprite until it completes. */
  private beat: Partial<Record<SideId, BeatKind | null>> = {};
  private foeMonPos = { x: 0, y: 0 };
  private playerMonPos = { x: 0, y: 0 };
  /** The same double-battle state for the second slot, which draws its own sprites. */
  private beat2: Partial<Record<SideId, BeatKind | null>> = {};
  private foeMonPos2 = { x: 0, y: 0 };
  private playerMonPos2 = { x: 0, y: 0 };
  /** The index of the entry step that sends the second lead out, or -1. */
  private entryPartnerStep = -1;
  /** The fighters the battle launched with, so `preload` knows which sheets to load. */
  private playerFighters: BattleFighter[] = [];
  private enemyFighters: BattleFighter[] = [];
  /** The sprite scale of each side's active sheet (the switch beat returns to it). */
  private monScale: Record<SideId, number> = { player: MON_SCALE, enemy: MON_SCALE };
  /** The tallest a side's sprite may draw, set by the layout (see `refreshHud`). */
  private monSizeCap: Record<SideId, number> = { player: SPRITE_SIZE_MAX, enemy: SPRITE_SIZE_MAX };
  /** The drawn height each side's sprite ended up at, so its platform can match. */
  private monDrawHeight: Record<SideId, number> = { player: SPRITE_SIZE_MAX, enemy: SPRITE_SIZE_MAX };
  /** Slot 1's own scale, cap and drawn height, kept apart from slot 0's. */
  private monScale2: Record<SideId, number> = { player: MON_SCALE, enemy: MON_SCALE };
  private monSizeCap2: Record<SideId, number> = { player: SPRITE_SIZE_MAX, enemy: SPRITE_SIZE_MAX };
  private monDrawHeight2: Record<SideId, number> = {
    player: SPRITE_SIZE_MAX,
    enemy: SPRITE_SIZE_MAX,
  };
  /** 1 on the desktop layout, `COMPACT_MON_SCALE` on the phone layout. */
  private monScaleFactor = 1;
  /** The sheets this battle loaded, dropped on shutdown so the texture cache cannot grow forever. */
  private loadedSheets: PokemonSpriteSheet[] = [];

  private hud!: Phaser.GameObjects.Graphics;
  /**
   * The non-hue marks that have to ride **over** an icon — a spent ball's slash and
   * the active bag pocket's underline. `this.hud` is built before the ball row and
   * the pocket tabs, so anything drawn there lands under them.
   */
  private marks!: Phaser.GameObjects.Graphics;
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
  private megaGlyph!: Phaser.GameObjects.Image;
  private megaZone!: Phaser.GameObjects.Zone;
  /** True while the keyboard cursor sits on the Mega control instead of a move. */
  private megaSelected = false;
  /** The G-MAX control, in the slot immediately inside the Mega one (D44). */
  private gmaxCell!: Phaser.GameObjects.Rectangle;
  private gmaxGlyph!: Phaser.GameObjects.Image;
  private gmaxZone!: Phaser.GameObjects.Zone;
  /** True while the keyboard cursor sits on the G-Max control instead of a move. */
  private gmaxSelected = false;
  /** The INFO control at the right edge of the command window: its cell, label and hit zone. */
  private infoCell!: Phaser.GameObjects.Rectangle;
  private infoText!: Phaser.GameObjects.BitmapText;
  private infoZone!: Phaser.GameObjects.Zone;
  /** True while the keyboard cursor sits on the INFO control instead of a command cell. */
  private infoSelected = false;
  private hpBars!: Record<SideId, { fill: Phaser.GameObjects.Rectangle; bar: Phaser.GameObjects.Image }>;
  private messageText!: Phaser.GameObjects.BitmapText;
  private nameText!: Record<SideId, Phaser.GameObjects.BitmapText>;
  private statText!: Record<SideId, Phaser.GameObjects.BitmapText>;
  private statusText!: Record<SideId, Phaser.GameObjects.BitmapText>;
  /** The FRLG status badge drawn in a panel instead of the text, when one exists. */
  private statusBadges!: Record<SideId, Phaser.GameObjects.Image>;
  /** One ball per enemy roster member; built once, positioned and dimmed per repaint. */
  private foeBallRow: Phaser.GameObjects.Image[] = [];
  /**
   * The live types row under each panel's name: one Añil badge per type, plus a
   * coloured chip (its box and label) standing in for a name the atlas lacks.
   * All three are built once in `buildScene` and only repositioned per repaint.
   */
  private typeBadges!: Record<SideId, Phaser.GameObjects.Image[]>;
  private typeChipBgs!: Record<SideId, Phaser.GameObjects.Rectangle[]>;
  private typeChips!: Record<SideId, Phaser.GameObjects.BitmapText[]>;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private foeSprite!: Phaser.GameObjects.Sprite;
  /** The second slot's sprites: hidden in a single battle, drawn on the same field. */
  private playerSprite2!: Phaser.GameObjects.Sprite;
  private foeSprite2!: Phaser.GameObjects.Sprite;
  /** The second foe window, beside the shipped one above the foe platform. */
  private foePanel2!: Phaser.GameObjects.NineSlice;
  /** The second player window, stacked with the shipped one. */
  private playerPanel2!: Phaser.GameObjects.NineSlice;
  /** The objects each HP window paints into: slot 0's shipped set and slot 1's own. */
  private panelKits!: Record<SideId, readonly [PanelKit, PanelKit]>;
  /** The cursor the target step marks a foe with, and the two foe hit zones. */
  private targetCursor!: Phaser.GameObjects.Image;
  private foeZones: Phaser.GameObjects.Zone[] = [];
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
  /** A reusable world point for the live-pointer hit test (no per-frame allocation). */
  private readonly hitPoint = new Phaser.Math.Vector2();

  /** The no-tab party detail popup shown above the party grid. */
  private partyDetail!: Phaser.GameObjects.Container;
  private partyDetailName!: Phaser.GameObjects.BitmapText;
  private partyDetailLevel!: Phaser.GameObjects.BitmapText;
  private partyDetailTypes: {
    bg: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.BitmapText;
  }[] = [];
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
  /** The ⓘ beside the detail window's ability row, its window and its hover zone. */
  private partyAbilityPopup!: InfoPopup;
  private partyAbilityButton!: AbilityInfoButton;
  private partyAbilityZone!: Phaser.GameObjects.Zone;
  private partyAbilityInfo = false;

  /** One ⓘ per move row of the switch detail window: its button, its label and its own hit zone. */
  private partyMoveInfoRows: {
    button: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.BitmapText;
    zone: Phaser.GameObjects.Zone;
  }[] = [];
  /** The description window the four move rows share. */
  private partyMoveInfoPopup!: InfoPopup;
  /** The move row whose description is floated, or null. */
  private partyMoveInfo: number | null = null;
  /** True while a press pinned the description, so leaving the button keeps it up. */
  private partyMoveInfoPinned = false;
  /** The member the floated description belongs to; a repaint for anyone else drops it. */
  private partyMoveInfoMember: string | null = null;

  private menuItems: readonly MenuItem[] = [];
  private menuIndex = 0;

  /** The bag's pockets (consumable, and balls while a wild can be caught). */
  private bagCategories: readonly BagCategory[] = ['consumable'];
  private bagCategory: BagCategory = 'consumable';
  private bagTabs: { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.BitmapText }[] = [];
  /** The pocket's drawn stacks (filtered, capped), which `menuIndex` walks. */
  private bagStacks: readonly BagSlot[] = [];
  private bagQuery = '';
  private bagSearchFocused = false;
  private bagSearchRect: BagGridRect = { x: 0, y: 0, w: 0, h: 0 };
  private bagSearchBg!: Phaser.GameObjects.Rectangle;
  private bagSearchText!: Phaser.GameObjects.BitmapText;
  private bagEmptyText!: Phaser.GameObjects.BitmapText;
  /** The selected stack's line in the band under the grid. */
  private bagDetailText!: Phaser.GameObjects.BitmapText;
  private bagCells: {
    bg: Phaser.GameObjects.Rectangle;
    icon: Phaser.GameObjects.Image;
    badgeBg: Phaser.GameObjects.Rectangle;
    badge: Phaser.GameObjects.BitmapText;
  }[] = [];
  private bagZones: Phaser.GameObjects.Zone[] = [];
  /** The floating description card the selected cell shows, and its last text. */
  private bagInfoLayer!: Phaser.GameObjects.Container;
  private bagInfoPopup!: InfoPopup;
  private bagInfoText = '';
  /** The grid's geometry for the current menu rect, or null with no bag open. */
  private bagGrid: BagGridMetrics | null = null;
  /** The grid band handed to `bagGridLayout`, in the square's own coordinates. */
  private bagGridBand: BagGridRect = { x: 0, y: 0, w: 0, h: 0 };

  /** The keys behind the confirm action, polled so holding one rushes the feed. */
  private confirmKeys: Phaser.Input.Keyboard.Key[] = [];
  private keybinds!: Keybinds;

  constructor() {
    super('Battle');
  }

  init(data?: BattleLaunch): void {
    this.launch = data ?? null;
    this.aiLevel = data?.aiLevel ?? 'normal';
    this.trainerFrame = null;
    this.lastBallId = null;
    this.captured = false;
    this.frameHoldMs = MESSAGE_HOLD_MS;
    this.captureTiming = null;
    this.captureTimers = [];
    this.captureTweens = null;
    this.captureFlash = null;
    this.captureFinalLine = '';
    this.captureName = '';
    this.captureHeld = false;
    this.captureOpenFrame = null;
    this.beat = {};
    this.cryPlayed = false;
    this.playerFighters = [];
    this.enemyFighters = [];
    this.loadedSheets = [];
    this.megaIntent = false;
    this.gmaxIntent = false;
    this.partyAbilityInfo = false;
    this.partyMoveInfo = null;
    this.partyMoveInfoPinned = false;
    this.partyMoveInfoMember = null;
    this.double = data?.double === true;
    this.displayActive2 = { player: null, enemy: null };
    this.displayHp2 = { player: null, enemy: null };
    this.displayStatus2 = { player: null, enemy: null };
    this.commandSlot = 0;
    this.partnerCommand = null;
    this.targetSlot = null;
    this.targetMoveIndex = null;
    this.beat2 = {};
    this.entryPartnerStep = -1;
    this.bagStacks = [];
    this.bagQuery = '';
    this.bagSearchFocused = false;
    this.bagInfoText = '';
    this.bagGrid = null;
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
    const battlefield = launch.battlefield ?? null;
    this.state = createBattle({
      player: this.playerFighters,
      enemy: this.enemyFighters,
      rng: new Rng(launch.seed),
      isWild: trigger.kind === 'wild',
      firstCatch: launch.firstCatch,
      enemyName: trigger.kind === 'trainer' ? trigger.trainerName : 'Foe',
      bag: launch.bag.flatMap((slot) => {
        const item = getItem(slot.itemId);
        return item && slot.count > 0 ? [{ item, count: slot.count }] : [];
      }),
      ...(battlefield ? battlefieldSeeds(battlefield) : {}),
      noHeal: launch.noHeal === true,
      noFlee: launch.noFlee === true,
      bannedSpecies: launch.bannedSpecies ?? null,
      ...(launch.enemyBoosts ? { enemyBoosts: launch.enemyBoosts } : {}),
      double: this.double,
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
    // Slot 1 exists only while the engine fields it: a one-member party on a
    // double launch answers `secondActiveIndex === -1` and the scene draws one panel.
    this.displayActive2 = {
      player: this.slotFighter('player', 1),
      enemy: this.slotFighter('enemy', 1),
    };
    this.displayHp2 = {
      player: this.displayActive2.player?.hp ?? null,
      enemy: this.displayActive2.enemy?.hp ?? null,
    };
    this.displayStatus2 = {
      player: this.displayActive2.player?.status ?? null,
      enemy: this.displayActive2.enemy?.status ?? null,
    };
    this.typing = beginTypewriter('');
    const settings = loadSettings();
    this.charMs = TEXT_SPEED_MS[settings.textSpeed];
    this.keybinds = settings.keybinds;
    this.reducedFlash = settings.reducedFlash;

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
      if (IS_DEVELOP) delete (globalThis as Record<string, unknown>).__pkmBattle;
    });
    // The battle owns a centred square; hide the paused route so the letterbox
    // around it stays clean instead of showing the overworld through it.
    this.scene.setVisible(false, 'Route');
    playMusic(this, 'battle-music');
    if (IS_DEVELOP) (globalThis as Record<string, unknown>).__pkmBattle = this;
    this.startEntry(trigger.kind);
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
    this.playerSprite = this.add.sprite(0, 0, BATTLE_MON_TEXTURE_KEY).setScale(MON_SCALE);
    this.foeSprite2 = this.add
      .sprite(0, 0, BATTLE_MON_TEXTURE_KEY)
      .setScale(MON_SCALE)
      .setVisible(false);
    this.playerSprite2 = this.add
      .sprite(0, 0, BATTLE_MON_TEXTURE_KEY)
      .setScale(MON_SCALE)
      .setVisible(false);

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
    // A double battle's second window per side. They are built here, before the
    // shared Graphics, so their HUD marks land above the card exactly as slot 0's.
    this.foePanel2 = addFrlgWindow(this, 0, 0, FOE_PANEL.w, FOE_PANEL.h).setVisible(false);
    this.playerPanel2 = addFrlgWindow(this, 0, 0, PLAYER_PANEL_W, PLAYER_PANEL_H).setVisible(false);
    this.messagePanel = addFrlgWindow(this, 0, 0, 100, 100, 'textbox');
    this.menuPanel = addFrlgWindow(this, 0, 0, MENU_W, 100);
    this.commandCells = Array.from({ length: MENU_ROWS }, () =>
      this.add
        .rectangle(0, 0, 10, 10, FRLG_ROW_FILL.colour, FRLG_ROW_FILL.alpha)
        .setOrigin(0, 0)
        .setStrokeStyle(1, FRLG_ROW_STROKE.colour, FRLG_ROW_STROKE.alpha)
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

    // The target step's cursor and the two foe hit zones: the cursor is placed on
    // whichever live slot the step points at, and a press on either foe picks it.
    // Both stay invisible and inert outside the step, so a click on a foe during
    // the feed still advances it.
    this.targetCursor = this.add.image(0, 0, FRLG_CURSOR_KEY).setOrigin(0, 0.5).setVisible(false);
    this.foeZones = [0, 1].map((slot) => {
      const zone = this.add.zone(0, 0, 10, 10).setOrigin(0.5);
      zone.setData('slot', slot);
      zone.setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.onFoeClick(slot === 1 ? 1 : 0));
      if (zone.input) zone.input.enabled = false;
      return zone;
    });

    // The MEGA control in the moves menu: a cell, the Mega Evolution glyph and a
    // hit zone. The glyph is the shipped Hard Stone frame — the icon every Mega
    // Stone already borrows (`MEGA_STONE_FALLBACK`), read through the atlas map,
    // so no new art is packed. It is only laid out and shown while the active
    // Pokémon can Mega Evolve (D34).
    this.megaCell = this.add
      .rectangle(0, 0, 10, 10, FRLG_ROW_FILL.colour, FRLG_ROW_FILL.alpha)
      .setOrigin(0, 0)
      .setStrokeStyle(1, FRLG_ROW_STROKE.colour, FRLG_ROW_STROKE.alpha)
      .setVisible(false);
    this.megaGlyph = this.add
      .image(0, 0, ITEM_ICON_TEXTURE_KEY, MEGA_CONTROL_FRAME)
      .setOrigin(0.5)
      .setVisible(false);
    this.megaZone = this.add.zone(0, 0, 10, 10).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.megaZone.on('pointerover', () => this.onMegaHover());
    this.megaZone.on('pointerdown', () => this.onMegaClick());

    // The G-MAX control, in the slot immediately inside the Mega one: the same
    // cell, glyph and hit zone, shown while the active Pokémon's own species has
    // a G-Max forme (D44). Both controls draw the same Mega glyph; a distinct
    // G-Max one would be a different frame on this very line.
    this.gmaxCell = this.add
      .rectangle(0, 0, 10, 10, FRLG_ROW_FILL.colour, FRLG_ROW_FILL.alpha)
      .setOrigin(0, 0)
      .setStrokeStyle(1, FRLG_ROW_STROKE.colour, FRLG_ROW_STROKE.alpha)
      .setVisible(false);
    this.gmaxGlyph = this.add
      .image(0, 0, ITEM_ICON_TEXTURE_KEY, MEGA_CONTROL_FRAME)
      .setOrigin(0.5)
      .setVisible(false);
    this.gmaxZone = this.add.zone(0, 0, 10, 10).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.gmaxZone.on('pointerover', () => this.onGmaxHover());
    this.gmaxZone.on('pointerdown', () => this.onGmaxClick());

    // The INFO control at the right edge of the command window, in the column the
    // moves menu reserves for MEGA. It is drawn only by the command menu, and a
    // press on it opens the battle's own state.
    this.infoCell = this.add
      .rectangle(0, 0, 10, 10, FRLG_ROW_FILL.colour, FRLG_ROW_FILL.alpha)
      .setOrigin(0, 0)
      .setStrokeStyle(1, FRLG_ROW_STROKE.colour, FRLG_ROW_STROKE.alpha)
      .setVisible(false);
    this.infoText = addFrlgText(this, 0, 0, t('battle.infoControl'), {
      size: 16,
      tint: FRLG_INK,
      origin: 0.5,
    }).setVisible(false);
    this.infoZone = this.add.zone(0, 0, 10, 10).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.infoZone.on('pointerdown', () => this.openInfo());

    this.nameText = {
      enemy: addFrlgText(this, 0, 0, '', { tint: FRLG_INK }),
      player: addFrlgText(this, 0, 0, '', { tint: FRLG_INK }),
    };
    this.statText = {
      enemy: addFrlgText(this, 0, 0, '', { size: 16, tint: FRLG_INK, origin: [1, 0] }),
      player: addFrlgText(this, 0, 0, '', { size: 16, tint: FRLG_INK, origin: [1, 0] }),
    };
    this.statusText = {
      enemy: addFrlgText(this, 0, 0, '', { size: 16, tint: FRLG_INK, origin: 0.5 }),
      player: addFrlgText(this, 0, 0, '', { size: 16, tint: FRLG_INK, origin: 0.5 }),
    };
    // The FRLG condition badges; drawn at 1.5x to match the panel text size.
    this.statusBadges = {
      enemy: this.add
        .image(0, 0, STATUS_ICON_TEXTURE_KEY, 0)
        .setOrigin(0, 0)
        .setScale(1.5)
        .setVisible(false),
      player: this.add
        .image(0, 0, STATUS_ICON_TEXTURE_KEY, 0)
        .setOrigin(0, 0)
        .setScale(1.5)
        .setVisible(false),
    };
    this.foeBallRow = Array.from({ length: MAX_PARTY_SIZE }, () =>
      this.add
        .image(0, 0, ITEM_ICON_TEXTURE_KEY, itemIconFrame('pokeball') ?? 0)
        .setOrigin(0, 0)
        .setScale(FOE_BALL_SCALE)
        .setVisible(false),
    );
    // The types row: one Añil badge per type, starting on the engine's blank
    // texture until `drawSidePanel` picks the frame, with the chip beside it as
    // the fallback for a name the atlas lacks.
    const typeBadgeRow = (): Phaser.GameObjects.Image[] =>
      Array.from({ length: PANEL_TYPE_SLOTS }, () =>
        this.add
          .image(0, 0, BLANK_TEXTURE_KEY)
          .setOrigin(0, 0)
          .setScale(PANEL_TYPE_SCALE)
          .setVisible(false),
      );
    const typeChipBoxRow = (): Phaser.GameObjects.Rectangle[] =>
      Array.from({ length: PANEL_TYPE_SLOTS }, () =>
        this.add
          .rectangle(0, 0, PANEL_CHIP_W, PANEL_CHIP_H, FRLG_MUTED)
          .setOrigin(0, 0)
          .setVisible(false),
      );
    const typeChipLabelRow = (): Phaser.GameObjects.BitmapText[] =>
      Array.from({ length: PANEL_TYPE_SLOTS }, () =>
        addFrlgText(this, 0, 0, '', {
          size: PANEL_TYPE_LABEL_SIZE,
          tint: FRLG_BADGE_INK,
          origin: [0.5, 0],
        })
          .setMaxWidth(PANEL_CHIP_W - 8)
          .setVisible(false),
      );
    this.typeBadges = { enemy: typeBadgeRow(), player: typeBadgeRow() };
    this.typeChipBgs = { enemy: typeChipBoxRow(), player: typeChipBoxRow() };
    this.typeChips = { enemy: typeChipLabelRow(), player: typeChipLabelRow() };

    // Slot 1's window content, built exactly like slot 0's and hidden until a
    // double battle draws it. `drawPanel` paints either kit, so the two windows
    // can never drift apart.
    const secondKit = (side: SideId): PanelKit => {
      const hpBar = addFrlgHpBar(this, 0, 0);
      hpBar.bar.setVisible(false);
      hpBar.fill.setVisible(false);
      return {
        panel: side === 'enemy' ? this.foePanel2 : this.playerPanel2,
        nameText: addFrlgText(this, 0, 0, '', { tint: FRLG_INK }).setVisible(false),
        statText: addFrlgText(this, 0, 0, '', { size: 16, tint: FRLG_INK, origin: [1, 0] }).setVisible(
          false,
        ),
        statusText: addFrlgText(this, 0, 0, '', {
          size: 16,
          tint: FRLG_INK,
          origin: 0.5,
        }).setVisible(false),
        statusBadge: this.add
          .image(0, 0, STATUS_ICON_TEXTURE_KEY, 0)
          .setOrigin(0, 0)
          .setScale(1.5)
          .setVisible(false),
        typeBadges: typeBadgeRow(),
        typeChipBgs: typeChipBoxRow(),
        typeChips: typeChipLabelRow(),
        hpBar,
      };
    };
    this.panelKits = {
      enemy: [
        {
          panel: this.foePanel,
          nameText: this.nameText.enemy,
          statText: this.statText.enemy,
          statusText: this.statusText.enemy,
          statusBadge: this.statusBadges.enemy,
          typeBadges: this.typeBadges.enemy,
          typeChipBgs: this.typeChipBgs.enemy,
          typeChips: this.typeChips.enemy,
          hpBar: this.hpBars.enemy,
        },
        secondKit('enemy'),
      ],
      player: [
        {
          panel: this.playerPanel,
          nameText: this.nameText.player,
          statText: this.statText.player,
          statusText: this.statusText.player,
          statusBadge: this.statusBadges.player,
          typeBadges: this.typeBadges.player,
          typeChipBgs: this.typeChipBgs.player,
          typeChips: this.typeChips.player,
          hpBar: this.hpBars.player,
        },
        secondKit('player'),
      ],
    };

    this.messageText = addFrlgText(this, 0, 0, '', { tint: FRLG_INK, lineSpacing: 4 });

    this.menuRows = Array.from({ length: MENU_ROWS }, () =>
      addFrlgText(this, 0, 0, '', { tint: FRLG_INK }),
    );
    // The party (switch) grid, built once and hidden until the party is open.
    this.partyCells = Array.from({ length: MAX_PARTY_SIZE }, () =>
      this.add
        .rectangle(0, 0, 10, 10, FRLG_ROW_FILL.colour, FRLG_ROW_FILL.alpha)
        .setOrigin(0, 0)
        .setStrokeStyle(1, FRLG_ROW_STROKE.colour, FRLG_ROW_STROKE.alpha)
        .setVisible(false),
    );
    this.partyAvatars = Array.from({ length: MAX_PARTY_SIZE }, () =>
      this.add.image(0, 0, PORTRAIT_TEXTURE_KEY, 0).setScale(PARTY_AVATAR_SCALE).setVisible(false),
    );
    this.partyLabels = Array.from({ length: MAX_PARTY_SIZE }, () =>
      addFrlgText(this, 0, 0, '', { size: PARTY_LABEL_SIZE, tint: FRLG_INK }).setVisible(false),
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
    // row, so the menu answers the mouse exactly like the keyboard. The moves
    // grid's own ⓘ button is classified from the live pointer, not from here.
    this.menuZones = Array.from({ length: MENU_ROWS }, () => {
      const zone = this.add.zone(0, 0, 10, 10).setOrigin(0, 0);
      zone.setData('item', -1);
      zone.setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => this.onMenuHover(zone));
      zone.on('pointerout', () => this.onMenuPointerOut(zone));
      zone.on('pointerdown', (_pointer: Phaser.Input.Pointer, x: number, y: number) =>
        this.onMenuClick(zone, x, y),
      );
      return zone;
    });

    // The bag's pocket tabs, drawn inside the menu window; at most two.
    this.bagTabs = Array.from({ length: 2 }, (_, slot) => {
      const bg = this.add
        .rectangle(0, 0, 10, 10, FRLG_ROW_FILL.colour, FRLG_ROW_FILL.alpha)
        .setOrigin(0, 0)
        .setStrokeStyle(1, FRLG_ROW_STROKE.colour, FRLG_ROW_STROKE.alpha)
        .setVisible(false);
      const label = addFrlgText(this, 0, 0, '', {
        size: 16,
        tint: FRLG_INK,
        origin: [0.5, 0],
      }).setVisible(false);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => this.selectBagTab(slot));
      return { bg, label };
    });

    // The overlay marks ride over the ball row and the pocket tabs built above.
    this.marks = this.add.graphics();

    // The bag's filter field, grid cells and selected line: built once, painted
    // and repositioned on every redraw because the menu rect moves with the stage.
    this.bagSearchBg = this.add
      .rectangle(0, 0, 10, 24, FRLG_ROW_FILL.colour, FRLG_ROW_FILL.alpha)
      .setOrigin(0, 0)
      .setStrokeStyle(1, FRLG_ROW_STROKE.colour, FRLG_ROW_STROKE.alpha)
      .setVisible(false);
    this.bagSearchText = addFrlgText(this, 0, 0, '', {
      size: 16,
      tint: FRLG_INK,
    })
      .setMaxWidth(1)
      .setVisible(false);
    this.bagEmptyText = addFrlgText(this, 0, 0, t('battle.noItems'), {
      size: 16,
      tint: FRLG_MUTED,
      origin: [0.5, 0],
    }).setVisible(false);
    this.bagDetailText = addFrlgText(this, 0, 0, '', { size: 16, tint: FRLG_INK }).setVisible(false);
    this.bagCells = Array.from({ length: MENU_BAG_CAP }, () => {
      const bg = this.add.rectangle(0, 0, 10, 10).setOrigin(0, 0).setVisible(false);
      const icon = this.add.image(0, 0, ITEM_ICON_TEXTURE_KEY, 0).setOrigin(0.5).setVisible(false);
      const badgeBg = this.add
        .rectangle(0, 0, 10, 16, FRLG_SURFACE, 0.85)
        .setOrigin(0, 0)
        .setVisible(false);
      const badge = addFrlgText(this, 0, 0, '', {
        size: 16,
        tint: FRLG_INK,
        origin: [1, 0],
      }).setVisible(false);
      return { bg, icon, badgeBg, badge };
    });
    // A click selects a cell; it never spends the stack the way a row click did.
    this.bagZones = Array.from({ length: MENU_BAG_CAP }, (_, index) => {
      const zone = this.add.zone(0, 0, 10, 10).setOrigin(0, 0);
      zone.setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.selectBagCell(index));
      if (zone.input) zone.input.enabled = false;
      return zone;
    });

    // The shared moves grid and its floating info popup, built last so the popup
    // rides over the menu and the battle behind it. Hidden until fights open it.
    this.moveGrid = new MoveGrid(this);

    this.buildPartyDetail();

    // The bag's own description card, above every window it floats over.
    this.bagInfoLayer = this.add.container(0, 0);
    this.bagInfoPopup = new InfoPopup(this, this.bagInfoLayer);
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
      tint: FRLG_MUTED,
      origin: [1, 0],
    });
    children.push(this.partyDetailName, this.partyDetailLevel);

    const chipY = padTop + 22;
    this.partyDetailTypes = [];
    for (let i = 0; i < 2; i++) {
      const chipX = padX + i * (PARTY_DETAIL_TYPE_W + 6);
      const bg = this.add
        .rectangle(chipX, chipY, PARTY_DETAIL_TYPE_W, 20, FRLG_MUTED)
        .setOrigin(0, 0)
        .setVisible(false);
      const label = addFrlgText(this, chipX + PARTY_DETAIL_TYPE_W / 2, chipY + 2, '', {
        size: 16,
        tint: FRLG_BADGE_INK,
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
      const label = addFrlgText(this, padX, rowY, statLabel(stat), { size: 16, tint: FRLG_MUTED });
      const value = addFrlgText(this, leftRight, rowY, '', { size: 16, tint: FRLG_INK, origin: [1, 0] });
      children.push(label, value);
      return { label, value };
    });
    const infoTop = statsTop + DETAIL_STATS.length * PARTY_DETAIL_STAT_ROW + 6;
    const nature = addFrlgText(this, padX, infoTop, '', { size: 16, tint: FRLG_MUTED });
    const ability = addFrlgText(this, padX, infoTop + PARTY_DETAIL_INFO_ROW, '', {
      size: 16,
      tint: FRLG_MUTED,
    });
    const held = addFrlgText(this, padX, infoTop + PARTY_DETAIL_INFO_ROW * 2, '', {
      size: 16,
      tint: FRLG_MUTED,
    });
    children.push(nature, ability, held);
    this.partyDetailStats = { hpText, rows, nature, ability, held };

    const cellW = (colW - PARTY_DETAIL_MOVE_GAP) / 2;
    const moveCellX = (i: number): number =>
      movesX + (i % PARTY_DETAIL_MOVE_COLS) * (cellW + PARTY_DETAIL_MOVE_GAP);
    const moveCellY = (i: number): number =>
      contentTop +
      Math.floor(i / PARTY_DETAIL_MOVE_COLS) * (PARTY_DETAIL_MOVE_ROW + PARTY_DETAIL_MOVE_GAP);
    this.partyDetailMoves = [];
    for (let i = 0; i < MAX_MOVES; i++) {
      const cell = this.add
        .rectangle(
          moveCellX(i),
          moveCellY(i),
          cellW,
          PARTY_DETAIL_MOVE_ROW,
          FRLG_ROW_FILL.colour,
          FRLG_ROW_FILL.alpha,
        )
        .setOrigin(0, 0)
        .setStrokeStyle(1, FRLG_ROW_STROKE.colour, FRLG_ROW_STROKE.alpha);
      const name = addFrlgText(this, moveCellX(i) + 8, moveCellY(i) + 4, '', {
        size: 16,
        tint: FRLG_INK,
      }).setMaxWidth(cellW - 8 - ABILITY_INFO_SIZE - 12);
      const pp = addFrlgText(this, moveCellX(i) + 8, moveCellY(i) + 18, '', {
        size: 16,
        tint: FRLG_INK,
      });
      this.partyDetailMoves.push({ cell, name, pp });
      children.push(cell, name, pp);
    }
    this.partyDetailEmpty = addFrlgText(this, movesX + colW / 2, contentTop + 20, t('detail.noMoves'), {
      size: 16,
      tint: FRLG_MUTED,
      origin: [0.5, 0],
    });
    children.push(this.partyDetailEmpty);

    this.partyDetail = this.add.container(0, 0, children).setVisible(false);
    // The ability row's ⓘ and the window it floats, built once the container
    // exists so both ride above the panel. The zone only watches hover: the party
    // cells under the window own the presses, and a press must not change the
    // member the window describes.
    this.partyAbilityPopup = new InfoPopup(this, this.partyDetail);
    this.partyAbilityButton = new AbilityInfoButton(this, this.partyAbilityPopup, this.partyDetail);
    this.partyAbilityZone = this.add.zone(0, 0, ABILITY_INFO_SIZE, ABILITY_INFO_SIZE).setOrigin(0, 0);
    this.partyAbilityZone.setInteractive({ useHandCursor: true });
    this.partyAbilityZone.on('pointerover', () => this.setPartyAbilityInfo(true));
    this.partyAbilityZone.on('pointerout', () => this.setPartyAbilityInfo(false));
    if (this.partyAbilityZone.input) this.partyAbilityZone.input.enabled = false;
    this.partyDetail.add(this.partyAbilityZone);
    // One ⓘ per move row, each on a hit zone of its own so a press is swallowed
    // at the button and never reaches the switch row under the panel.
    const moveInfoX = (i: number): number => moveCellX(i) + cellW - 8 - ABILITY_INFO_SIZE;
    const moveInfoY = (i: number): number =>
      moveCellY(i) + (PARTY_DETAIL_MOVE_ROW - ABILITY_INFO_SIZE) / 2;
    const moveInfoButtons = Array.from({ length: MAX_MOVES }, (_, i) => {
      const centerX = moveInfoX(i) + ABILITY_INFO_SIZE / 2;
      const centerY = moveInfoY(i) + ABILITY_INFO_SIZE / 2;
      const button = this.add
        .rectangle(
          centerX,
          centerY,
          ABILITY_INFO_SIZE,
          ABILITY_INFO_SIZE,
          FRLG_ROW_FILL.colour,
          FRLG_ROW_FILL.alpha,
        )
        .setStrokeStyle(1, FRLG_ROW_STROKE.colour, FRLG_ROW_STROKE.alpha)
        .setVisible(false);
      const label = addFrlgText(this, centerX, centerY, 'i', {
        size: 16,
        tint: FRLG_INK,
        origin: 0.5,
      }).setVisible(false);
      this.partyDetail.add([button, label]);
      return { button, label };
    });
    this.partyMoveInfoRows = moveInfoButtons.map(({ button, label }, i) => {
      const zone = this.add
        .zone(moveInfoX(i), moveInfoY(i), ABILITY_INFO_SIZE, ABILITY_INFO_SIZE)
        .setOrigin(0, 0);
      zone.setInteractive({ useHandCursor: true });
      zone.setData('move', i);
      zone.on('pointerover', () => this.setPartyMoveInfo(i));
      zone.on('pointerout', () => this.clearPartyMoveInfo(i));
      zone.on('pointerdown', () => this.togglePartyMoveInfo(i));
      if (zone.input) zone.input.enabled = false;
      this.partyDetail.add(zone);
      return { button, label, zone };
    });
    this.partyMoveInfoPopup = new InfoPopup(this, this.partyDetail);
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
      (pointer: Phaser.Input.Pointer, objects: Phaser.GameObjects.GameObject[]) =>
        this.onPointerDown(objects, pointer),
    );
    // The ⓘ hover is classified from the live pointer, so one scene-level listener
    // replaces the per-row zone's own move event; leaving the canvas drops an
    // unpinned popup.
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.onMoveInfoHover(pointer));
    this.input.on('gameout', () => this.clearMoveInfo());
    // `[` / `]` cycle the bag's pockets; while the filter field is focused they
    // are swallowed as text input instead.
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      if (this.mode !== 'bag') return;
      if (this.typeInBagSearch(event)) return;
      if (event.key === '[') this.cycleBagTab(-1);
      else if (event.key === ']') this.cycleBagTab(1);
    });
  }

  /**
   * The player's intent behind one shared action, from a key or from the touch
   * A / B and pad. The battle routes it the same way either way.
   */
  private handleAction(action: KeybindAction): void {
    // The bag's filter field owns every key while it is being typed into, so no
    // command shortcut (confirm included) fires under it.
    if (this.bagSearchFocused) return;
    switch (action) {
      case 'confirm':
        this.onConfirm();
        return;
      case 'cancel':
        this.onCancel();
        return;
      case 'run':
        // The secondary action toggles the focused move cell's ⓘ popup.
        if (this.mode === 'moves') this.toggleMoveInfo();
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
  private onPointerDown(
    objects: readonly Phaser.GameObjects.GameObject[],
    pointer: Phaser.Input.Pointer,
  ): void {
    // A press on the bag's filter field focuses it, as the route's field does.
    if (this.mode === 'bag' && this.pointerOnBagSearch(pointer)) {
      this.bagSearchFocused = true;
      this.refreshHud();
      return;
    }
    if (this.mode === 'entry') {
      this.finishEntry();
      return;
    }
    if (objects.length > 0) return;
    if (this.mode === 'target') {
      this.confirmTarget();
      return;
    }
    if (this.mode === 'feed') {
      this.onConfirm();
      return;
    }
    if (this.mode === 'info') {
      this.openMenu();
      return;
    }
    if (this.mode === 'over') this.returnToRoute();
  }

  private onConfirm(): void {
    if (this.mode === 'entry') {
      this.finishEntry();
      return;
    }
    if (this.mode === 'target') {
      this.confirmTarget();
      return;
    }
    if (this.mode === 'feed') {
      // A tap skips the capture beat whole, or reveals the rest of the line
      // before it moves the feed on.
      if (this.finishCaptureBeat()) return;
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
    if (this.mode === 'info') {
      this.openMenu();
      return;
    }
    this.confirmMenu();
  }

  private onCancel(): void {
    if (this.mode === 'entry') {
      this.finishEntry();
      return;
    }
    if (this.mode === 'target') {
      // Back to the move grid with nothing submitted.
      this.openMoves(this.commandSlot);
      return;
    }
    if (this.mode === 'over') {
      this.returnToRoute();
      return;
    }
    if (this.mode === 'info') {
      this.openMenu();
      return;
    }
    if (this.mode === 'moves' || this.mode === 'bag' || this.mode === 'party') {
      this.openMenu();
    }
  }

  // --- entry beat ---------------------------------------------------------

  /**
   * Opens the battle: lays the stage out, hides only what the beat brings in and
   * plays step 0, whose fade is what covers the route-to-battle cut.
   */
  private startEntry(kind: EntryKind): void {
    this.entrySteps = entryBeat(kind, this.reducedFlash, this.double);
    this.entryIndex = 0;
    this.entryTimer = null;
    this.mode = 'entry';
    // A double battle sends the second lead out on the beat's last step, so that
    // step animates the player's partner instead of the foe.
    this.entryPartnerStep = this.double ? this.entrySteps.length - 1 : -1;
    this.refreshHud();
    if (this.entrySteps.some((step) => step.kind === 'foe-appear' || step.kind === 'sendout')) {
      this.foeSprite.setAlpha(0);
      if (this.displayActive2.enemy) this.foeSprite2.setAlpha(0);
    }
    if (this.entryPartnerStep >= 0) this.playerSprite2.setAlpha(0);
    if (this.entrySteps.some((step) => step.kind === 'trainer-appear')) {
      this.foeTrainer.setAlpha(0);
    }
    this.playEntryStep();
  }

  private playEntryStep(): void {
    const step = this.entrySteps[this.entryIndex];
    if (!step) {
      this.finishEntry();
      return;
    }
    switch (step.kind) {
      case 'fade':
        this.cameras.main.fadeIn(step.ms, 0, 0, 0);
        break;
      case 'flash':
        this.cameras.main.flash(step.ms, 255, 255, 255);
        break;
      case 'foe-appear':
      case 'sendout':
        if (this.entryIndex === this.entryPartnerStep) {
          if (this.displayActive2.player) {
            this.appearSprite(this.playerSprite2, step.ms, 0, -ENTRY_FOE_DROP);
          }
          break;
        }
        this.appearSprite(this.foeSprite, step.ms, 0, -ENTRY_FOE_DROP);
        if (this.displayActive2.enemy) {
          this.appearSprite(this.foeSprite2, step.ms, 0, -ENTRY_FOE_DROP);
        }
        this.playEntryCry();
        break;
      case 'trainer-appear':
        this.appearSprite(this.foeTrainer, step.ms, ENTRY_TRAINER_WALK, 0);
        break;
    }
    this.entryTimer = this.time.delayedCall(step.ms, () => {
      this.entryIndex += 1;
      this.playEntryStep();
    });
  }

  /**
   * The appearing enemy's cry, once per battle: the first of the beat's two
   * appearance steps to run plays it (a wild opens with `foe-appear`, a trainer
   * with `sendout`). The enemy's own species is the wild's rolled one, or the
   * trainer's lead.
   */
  private playEntryCry(): void {
    if (this.cryPlayed) return;
    this.cryPlayed = true;
    const trigger = this.launch?.trigger ?? null;
    const speciesId =
      trigger?.kind === 'wild' ? trigger.speciesId : activeFighter(this.state, 'enemy').speciesId;
    playCry(this, speciesId);
  }

  /** The single exit from the beat, whether it ran out or a press cut it short. */
  private finishEntry(): void {
    if (this.mode !== 'entry') return;
    this.entryTimer?.remove();
    this.entryTimer = null;
    this.tweens.killTweensOf(this.foeSprite);
    this.tweens.killTweensOf(this.foeTrainer);
    this.cameras.main.resetFX();
    this.foeSprite.setAlpha(1);
    this.foeTrainer.setAlpha(1);
    if (this.double) {
      this.tweens.killTweensOf(this.foeSprite2);
      this.tweens.killTweensOf(this.playerSprite2);
      this.foeSprite2.setAlpha(1);
      this.playerSprite2.setAlpha(1);
    }
    this.entryIndex = 0;
    this.entrySteps = [];
    this.entryPartnerStep = -1;
    this.refreshHud();
    this.startFeed();
  }

  /** Brings a sprite in from an offset, at rest at the layout's position. */
  private appearSprite(
    target: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite,
    ms: number,
    offsetX: number,
    offsetY: number,
  ): void {
    const x = target.x;
    const y = target.y;
    target.setAlpha(0).setPosition(x + offsetX, y + offsetY);
    this.tweens.add({ targets: target, alpha: 1, x, y, duration: ms, ease: 'Quad.easeOut' });
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
    this.frameHoldMs = MESSAGE_HOLD_MS;
    const capturing = frame.events.some((event) => event.kind === 'capture');
    this.applyEvents(frame.events, capturing ? (frame.message ?? '') : null);
    if (frame.message !== null && !capturing) this.typeMessage(frame.message);
    this.refreshHud();
  }

  private advanceFeed(): void {
    this.finishCaptureBeat();
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

  private applyEvents(events: readonly BattleEvent[], captureLine: string | null = null): void {
    // A batched frame must not stack eight faints.
    let faintPlayed = false;
    for (const event of events) {
      switch (event.kind) {
        case 'damage':
        case 'heal': {
          // The event names no slot: the HP arithmetic against what each slot
          // already shows is what tells the two apart, since the engine's `amount`
          // is exactly the HP the slot lost or regained.
          const slot = this.hpEventSlot(
            event.side,
            event.amount,
            event.hp,
            event.maxHp,
            event.kind === 'heal',
          );
          this.setDisplayHp(event.side, slot, event.hp);
          break;
        }
        case 'status':
          this.setDisplayStatus(
            event.side,
            this.statusEventSlot(event.side, event.status, false),
            event.status,
          );
          break;
        case 'cure':
          this.setDisplayStatus(event.side, this.statusEventSlot(event.side, event.status, true), null);
          break;
        case 'switch': {
          const slot = this.fighterSlot(event.side, event.fighterId);
          const previous = this.displayHpAt(event.side, slot);
          const fighter = this.state.sides[event.side].party.find((p) => p.id === event.fighterId);
          if (fighter) {
            this.setDisplayActive(event.side, slot, fighter);
          }
          this.playSwitch(event.side, previous !== null && previous <= 0, slot);
          break;
        }
        case 'faint': {
          if (!faintPlayed) {
            faintPlayed = true;
            playCue(this, 'faint');
          }
          const slot = this.fighterSlot(event.side, event.fighterId);
          this.setDisplayHp(event.side, slot, 0);
          this.playFaint(event.side, slot);
          break;
        }
        case 'move':
          this.playMoveFx(event.side, event.moveId);
          playMoveSound(this, event.moveId);
          break;
        case 'mega':
          this.playMega(event.side, this.fighterSlot(event.side, event.fighterId));
          break;
        case 'gmax':
          this.playGmax(event.side, this.fighterSlot(event.side, event.fighterId));
          break;
        case 'forme': {
          const fighter = this.state.sides[event.side].party.find((p) => p.id === event.fighterId);
          if (fighter) {
            this.setDisplayFighter(event.side, this.fighterSlot(event.side, event.fighterId), fighter);
            this.syncMonSprites();
          }
          break;
        }
        case 'capture':
          this.playCapture(event.shakes, event.success, captureLine ?? '');
          break;
        default:
          break;
      }
    }
  }

  /** The slot a fighter fills on its side; a fighter off the field reads as slot 0. */
  private fighterSlot(side: SideId, fighterId: string): Slot {
    const battleSide = this.state.sides[side];
    const index = battleSide.party.findIndex((fighter) => fighter.id === fighterId);
    return index >= 0 && index === battleSide.secondActiveIndex ? 1 : 0;
  }

  /** The HP a slot is showing, or null when the side does not field it. */
  private displayHpAt(side: SideId, slot: Slot): number | null {
    return slot === 0 ? this.displayHp[side] : this.displayHp2[side];
  }

  private setDisplayHp(side: SideId, slot: Slot, hp: number): void {
    if (slot === 0) this.displayHp[side] = hp;
    else this.displayHp2[side] = hp;
  }

  private setDisplayStatus(side: SideId, slot: Slot, status: StatusId | null): void {
    if (slot === 0) this.displayStatus[side] = status;
    else this.displayStatus2[side] = status;
  }

  /** Points a slot at a fighter and refreshes what it shows (a switch-in). */
  private setDisplayActive(side: SideId, slot: Slot, fighter: BattleFighter): void {
    if (slot === 0) this.displayActive[side] = fighter;
    else this.displayActive2[side] = fighter;
    this.setDisplayHp(side, slot, fighter.hp);
    this.setDisplayStatus(side, slot, fighter.status);
  }

  /** Points a slot at a fighter without touching its HP or status (a forme change). */
  private setDisplayFighter(side: SideId, slot: Slot, fighter: BattleFighter): void {
    if (slot === 0) this.displayActive[side] = fighter;
    else this.displayActive2[side] = fighter;
  }

  /**
   * Which slot a damage/heal event belongs to. It carries no slot, so the slot
   * whose displayed HP moves by exactly `amount` onto `hp` is the one; when both
   * read alike, the event's `maxHp` separates them, and slot 0 wins the leftover
   * ambiguity, as it does in every single battle.
   */
  private hpEventSlot(side: SideId, amount: number, hp: number, maxHp: number, healed: boolean): Slot {
    const shown = this.displayHp2[side];
    if (shown === null) return 0;
    const delta = healed ? amount : -amount;
    const firstMatch = this.displayHp[side] + delta === hp;
    const secondMatch = shown + delta === hp;
    if (firstMatch !== secondMatch) return secondMatch ? 1 : 0;
    const active2 = this.displayActive2[side];
    if (active2 && active2.maxHp === maxHp && this.displayActive[side].maxHp !== maxHp) return 1;
    return 0;
  }

  /**
   * Which slot a status/cure event belongs to: it names no slot either, so the
   * live fighter that carries (or no longer carries) the status decides, and slot 0
   * keeps every ambiguous case.
   */
  private statusEventSlot(side: SideId, status: StatusId, cured: boolean): Slot {
    const fighter2 = this.slotFighter(side, 1);
    if (!fighter2) return 0;
    const shown2 = this.displayStatus2[side];
    const atSlot2 = cured
      ? shown2 === status && fighter2.status !== status
      : this.displayStatus[side] !== status && fighter2.status === status;
    return atSlot2 ? 1 : 0;
  }

  // --- battle presentation --------------------------------------------------

  /** A white flash and a fade-in for the side that just Mega Evolved (D34). */
  private playMega(side: SideId, slot: Slot = 0): void {
    if (!this.reducedFlash) this.cameras.main.flash(220, 255, 255, 255);
    const sprite = this.monSprite(side, slot);
    sprite.setAlpha(0.2);
    this.tweens.add({ targets: sprite, alpha: 1, duration: 280 });
    this.setDisplayFighter(side, slot, activeFighter(this.state, side, slot));
    this.syncMonSprites();
  }

  /** The same beat in G-Max red for the side that just Gigantamaxed (D44). */
  private playGmax(side: SideId, slot: Slot = 0): void {
    if (!this.reducedFlash) this.cameras.main.flash(220, 255, 96, 96);
    const sprite = this.monSprite(side, slot);
    sprite.setAlpha(0.2);
    this.tweens.add({ targets: sprite, alpha: 1, duration: 280 });
    this.setDisplayFighter(side, slot, activeFighter(this.state, side, slot));
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

  /**
   * The classic throw, wobble and result beat when a ball is used. One timeline
   * (`captureTimeline`) drives both the ball's tweens and the message box, so the
   * wobble count on screen is exactly the count the engine rolled.
   */
  private playCapture(shakes: number, success: boolean, line = ''): void {
    const beat = captureBeat(shakes, success);
    const timeline = captureTimeline(shakes, success);
    const frame = itemIconFrame(this.lastBallId ?? 'pokeball') ?? itemIconFrame('pokeball') ?? 0;
    const from = this.playerMonPos;
    const to = this.foeMonPos;
    this.captureTiming = timeline;
    this.captureHeld = beat.held;
    this.captureFinalLine = line;
    this.captureName = this.enemyFighters[0]?.name ?? '';
    this.captureOpenFrame = null;
    this.frameHoldMs = timeline.totalMs + MESSAGE_HOLD_MS;
    this.captureBall
      .setTexture(ITEM_ICON_TEXTURE_KEY, frame)
      .setPosition(from.x, from.y)
      .setAlpha(1)
      .setAngle(0)
      .setVisible(true);

    const wobble: Phaser.Types.Tweens.TweenBuilderConfig[] = [];
    for (let shake = 0; shake < beat.shakes; shake++) {
      wobble.push({ targets: this.captureBall, angle: 22, duration: timeline.stepMs });
      wobble.push({ targets: this.captureBall, angle: -22, duration: timeline.stepMs });
      wobble.push({ targets: this.captureBall, angle: 0, duration: timeline.stepMs });
    }

    this.captureTweens = this.tweens.chain({
      targets: this.captureBall,
      tweens: [
        {
          targets: this.captureBall,
          x: to.x,
          y: to.y - 28,
          duration: timeline.throwMs,
          ease: 'Quad.easeOut',
        },
        { targets: this.captureBall, y: to.y, duration: timeline.dropMs, ease: 'Quad.easeIn' },
        ...wobble,
      ],
    });
    this.captureTimers = timeline.beats.map((tick) =>
      this.time.delayedCall(tick.at, () => this.playCaptureTick(tick)),
    );
    // The line is set once the ball lands, not typed: the dots are punctuation and
    // bypass the player's text speed by design.
    this.captureTimers.push(
      this.time.delayedCall(timeline.throwMs + timeline.dropMs, () => this.showCaptureLine(0)),
    );
  }

  private playCaptureTick(tick: CaptureTick): void {
    if (this.captureTiming === null) return;
    if (tick.kind === 'shake') this.showCaptureLine(tick.index);
    else if (tick.kind === 'break') this.openCaptureBall();
    else this.settleCapture();
  }

  /** Replaces the wait line whole, with one dot per completed wobble. */
  private showCaptureLine(completed: number): void {
    this.setMessage(captureWaitLine(this.captureName, completed));
  }

  /** The frame's own line lands with the settle, and the ball comes to rest. */
  private settleCapture(): void {
    this.captured = this.captureHeld;
    this.captureBall.setAngle(0);
    if (this.captureHeld) this.captureBall.setAlpha(1).setVisible(true);
    else this.restBrokenBall();
    if (this.captureFinalLine !== '') this.setMessage(this.captureFinalLine);
    this.stopCaptureBeat();
    this.refreshHud();
  }

  /** A failed ball rests open when the atlas draws it, else it is gone from the field. */
  private restBrokenBall(): void {
    const open = this.captureOpenFrame;
    if (open === null) this.captureBall.setVisible(false);
    else
      this.captureBall.setPosition(this.foeMonPos.x, this.foeMonPos.y).setFrame(open).setVisible(true);
  }

  /** The ball bursts open: its atlas frame when there is one, a short flash otherwise. */
  private openCaptureBall(): void {
    const open = this.openBallFrame();
    if (open !== null) {
      this.captureOpenFrame = open;
      this.captureBall.setFrame(open).setAngle(0);
      return;
    }
    const step = this.captureTiming?.stepMs ?? 0;
    this.captureFlash = this.tweens.add({
      targets: this.captureBall,
      alpha: 0.2,
      duration: Math.round(step / 2),
      yoyo: true,
      onComplete: () => this.captureBall.setVisible(false),
    });
  }

  /** The item-icon frame for a ball that has burst open, when the atlas draws one. */
  private openBallFrame(): number | null {
    const ball = normalizeId(this.lastBallId ?? 'pokeball');
    return itemIconFrame(`${ball}open`) ?? itemIconFrame(`open${ball}`);
  }

  /**
   * A press while the beat plays skips it whole: ball at rest or hidden, the final
   * line printed, and the frame then holds like any other. Returns false when no
   * beat is playing, so the caller falls through to the feed's own rules.
   */
  private finishCaptureBeat(): boolean {
    if (this.captureTiming === null) return false;
    this.captured = this.captureHeld;
    this.captureBall.setAngle(0);
    if (this.captureHeld) {
      this.captureBall.setAlpha(1).setVisible(true).setPosition(this.foeMonPos.x, this.foeMonPos.y);
    } else {
      this.restBrokenBall();
    }
    if (this.captureFinalLine !== '') this.setMessage(this.captureFinalLine);
    this.stopCaptureBeat();
    this.frameHoldMs = MESSAGE_HOLD_MS;
    this.feedElapsed = 0;
    this.refreshHud();
    return true;
  }

  private stopCaptureBeat(): void {
    this.captureTiming = null;
    for (const timer of this.captureTimers) timer.remove(false);
    this.captureTimers = [];
    this.captureTweens?.stop();
    this.captureTweens = null;
    this.captureFlash?.stop();
    this.captureFlash = null;
  }

  /**
   * The sprite a side draws with: slot 0's shipped sprite or seat 1's own. Both
   * share the placeholder mon until O1, and a double battle's second active draws
   * with the shipped back/front sheet of its own species (no new art).
   */
  private monSprite(side: SideId, slot: Slot = 0): Phaser.GameObjects.Sprite {
    if (side === 'player') return slot === 0 ? this.playerSprite : this.playerSprite2;
    return slot === 0 ? this.foeSprite : this.foeSprite2;
  }

  /** Every sheet this battle draws: the foe's front, the party's back. */
  private battleSheets(): PokemonSpriteSheet[] {
    const sheets = new Map<string, PokemonSpriteSheet>();
    const add = (speciesId: string, shiny: boolean, female: boolean, kind: PokemonSpriteKind): void => {
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
      // A G-Max forme the species may take needs its sheet up front the same way.
      const gmax = gmaxFormForBase(fighter.speciesId);
      if (gmax) add(gmax.id, fighter.shiny, female, kind);
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
    const enemy2 = this.displayActive2.enemy;
    if (enemy2) this.showMon('enemy', enemy2, 'front', 1);
    const player2 = this.displayActive2.player;
    if (player2) this.showMon('player', player2, 'back', 1);
  }

  /**
   * Points a side's sprite at its sheet and plays the idle loop. Only a real
   * change touches the sprite, so a switch beat's tween is never fought over and
   * a mid-loop refresh does not restart the animation. Slot 1 keeps its own scale,
   * cap and drawn height, so neither slot's sizing moves the other's.
   */
  private showMon(side: SideId, fighter: BattleFighter, kind: PokemonSpriteKind, slot: Slot = 0): void {
    const sheet = pokemonSprite(fighter.speciesId, kind, {
      shiny: fighter.shiny,
      female: fighter.gender === 'female',
    });
    if (!sheet) return;
    const sprite = this.monSprite(side, slot);
    const anim = pokemonIdleAnimKey(sheet);
    const content = this.sheetContent(sheet);
    const cap = slot === 0 ? this.monSizeCap[side] : this.monSizeCap2[side];
    const target = Math.min(battleSpriteHeight(heightOf(fighter.speciesId)), cap) * this.monScaleFactor;
    const scale = target / (content?.height ?? sheet.size);
    if (slot === 0) {
      this.monScale[side] = scale;
      this.monDrawHeight[side] = target;
    } else {
      this.monScale2[side] = scale;
      this.monDrawHeight2[side] = target;
    }
    const beat = slot === 0 ? this.beat[side] : this.beat2[side];
    const sameSheet = sprite.texture.key === sheet.textureKey && sprite.anims.currentAnim?.key === anim;
    if (sameSheet) {
      // A live faint/switch beat owns the sprite; otherwise a resize just retargets it.
      if (!beat) sprite.setScale(scale);
      return;
    }
    if (content) sprite.setOrigin(content.anchorX / sheet.size, content.anchorY / sheet.size);
    else sprite.setOrigin(0.5, 0.5);
    sprite.setTexture(sheet.textureKey, 0).setScale(scale);
    sprite.play(anim);
  }

  /** The sheet's drawn box and feet, measured once per texture (`spriteBounds`). */
  private sheetContent(sheet: PokemonSpriteSheet): SpriteBounds | null {
    const source = this.textures.get(sheet.textureKey).getSourceImage();
    return spriteContentBounds(sheet.textureKey, source as CanvasImageSource, sheet.size, sheet.frames);
  }

  private monPos(side: SideId, slot: Slot = 0): { x: number; y: number } {
    if (side === 'player') return slot === 0 ? this.playerMonPos : this.playerMonPos2;
    return slot === 0 ? this.foeMonPos : this.foeMonPos2;
  }

  /** The defeated sprite sinks under its platform and fades, then the HUD hides it. */
  private playFaint(side: SideId, slot: Slot = 0): void {
    const sprite = this.monSprite(side, slot);
    if (!sprite.visible) return;
    const base = this.monPos(side, slot);
    this.setBeat(side, slot, 'faint');
    this.tweens.killTweensOf(sprite);
    this.tweens.add({
      targets: sprite,
      y: base.y + FAINT_DROP,
      alpha: 0,
      duration: FAINT_MS,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.setBeat(side, slot, null);
        sprite.setAlpha(1).setPosition(base.x, base.y);
        this.refreshHud();
      },
    });
  }

  /**
   * The withdraw/send-out beat. A replacement for a fainted partner has nothing
   * to withdraw, so it only pops the incoming sprite in.
   */
  private playSwitch(side: SideId, down: boolean, slot: Slot = 0): void {
    const sprite = this.monSprite(side, slot);
    const base = this.monPos(side, slot);
    const scale = slot === 0 ? this.monScale[side] : this.monScale2[side];
    this.setBeat(side, slot, 'switch');
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
        this.setBeat(side, slot, null);
        sprite.setScale(scale).setAlpha(1);
        this.refreshHud();
      },
    });
  }

  /** The sprite beat a slot is running, or null when it is at rest. */
  private setBeat(side: SideId, slot: Slot, beat: BeatKind | null): void {
    if (slot === 0) this.beat[side] = beat;
    else this.beat2[side] = beat;
  }

  private showOver(): void {
    this.mode = 'over';
    this.menuItems = [];
    const outcome = this.outcome();
    if (outcome === 'win' || outcome === 'capture') playCue(this, 'victory');
    // Every end of battle leaves on its own after the line is read — a run, a
    // catch, a win or a loss all need no confirm to get back to the route.
    this.setMessage(this.outcomeMessage(outcome));
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
    if (outcome === 'capture') return t('battle.outcomeCaught', { name: wild.name });
    if (outcome === 'win') {
      const trigger = this.launch?.trigger;
      return trigger?.kind === 'trainer'
        ? t('battle.outcomeDefeated', { name: trigger.trainerName })
        : t('battle.outcomeFainted', { name: wild.name });
    }
    if (outcome === 'run') return t('battle.outcomeRan');
    return t('battle.outcomeLost');
  }

  /** Hands the route the party and bag as they stand, then closes the battle. */
  private returnToRoute(): void {
    // A Gigantamax only lasts the battle, so both pools halve back before any
    // snapshot is taken: no doubled pool (a captured wild included) reaches the
    // run, and the snapshot's own HP is the base pool (D44).
    for (const side of SIDE_IDS) {
      for (const fighter of this.state.sides[side].party) revertGigantamax(fighter);
    }
    const outcome = this.outcome();
    const captured = outcome === 'capture' ? snapshotFighter(this.state.sides.enemy.party[0]) : null;
    const result: BattleReturn = {
      outcome,
      message: this.outcomeMessage(outcome),
      player: this.state.sides.player.party.map(snapshotFighter),
      bag: this.state.bag.map((slot) => ({ itemId: slot.item.id, count: slot.count })),
      captured,
      used: [...this.state.usedFighterIds],
    };
    const route = this.scene.get('Route') as RouteScene;
    this.scene.setVisible(true, 'Route');
    route.applyBattleResult(result);
    this.scene.resume('Route');
    this.scene.stop();
  }

  // --- menus --------------------------------------------------------------

  private openMenu(): void {
    this.commandSlot = 0;
    // A double battle commands slot 1 first: the partner's command waits in
    // `partnerCommand` while slot 0 picks, and a fainted or absent slot is skipped.
    if (this.double && this.partnerCommand === null && this.slotNeedsCommand(1)) {
      this.openPartnerMenu();
      return;
    }
    const player = activeFighter(this.state, 'player');
    if (!canMegaEvolve(this.state, 'player')) this.megaIntent = false;
    if (!canGigantamax(this.state, 'player')) this.gmaxIntent = false;
    this.megaSelected = false;
    this.gmaxSelected = false;
    this.infoSelected = false;
    this.menuItems = [
      { label: t('battle.command.fight'), enabled: true, onSelect: () => this.openMoves() },
      {
        label: t('battle.command.bag'),
        enabled: this.usableBag().length > 0,
        onSelect: () => this.openBag(),
      },
      { label: t('battle.command.switch'), enabled: this.hasBench(), onSelect: () => this.openParty() },
      {
        label: t('battle.command.run'),
        enabled: canRun(this.state, 'player'),
        onSelect: () => this.submit({ type: 'run' }),
      },
    ];
    this.menuIndex = 0;
    this.mode = 'menu';
    this.setMessage(t('battle.promptAction', { name: player.name }));
    this.refreshHud();
  }

  /**
   * The partner's command menu: FIGHT and SWITCH only, in the shipped command
   * grid — the Bag and RUN are the side's own actions and stay slot 0's.
   */
  private openPartnerMenu(): void {
    const partner = activeFighter(this.state, 'player', 1);
    if (!canMegaEvolve(this.state, 'player')) this.megaIntent = false;
    if (!canGigantamax(this.state, 'player')) this.gmaxIntent = false;
    this.megaSelected = false;
    this.gmaxSelected = false;
    this.infoSelected = false;
    this.menuItems = [
      { label: t('battle.command.fight'), enabled: true, onSelect: () => this.openMoves(1) },
      {
        label: t('battle.command.switch'),
        enabled: this.hasBench(),
        onSelect: () => this.openParty(1),
      },
    ];
    this.menuIndex = 0;
    this.mode = 'partner';
    this.setMessage(t('battle.promptAction', { name: partner.name }));
    this.refreshHud();
  }

  /** True while the player's `slot` exists and its occupant can still act. */
  private slotNeedsCommand(slot: Slot): boolean {
    const battleSide = this.state.sides.player;
    const index = slot === 0 ? battleSide.activeIndex : battleSide.secondActiveIndex;
    return index >= 0 && battleSide.party[index].hp > 0;
  }

  /** The live slot's fighter, or null when the side does not field that slot. */
  private slotFighter(side: SideId, slot: Slot): BattleFighter | null {
    const battleSide = this.state.sides[side];
    const index = slot === 0 ? battleSide.activeIndex : battleSide.secondActiveIndex;
    return index < 0 ? null : (battleSide.party[index] ?? null);
  }

  /** The opposing slots that are on the field and still standing. */
  private liveFoeSlots(): readonly Slot[] {
    const slots: Slot[] = [];
    for (const slot of liveSlots(this.state, 'enemy')) {
      if (activeFighter(this.state, 'enemy', slot).hp > 0) slots.push(slot);
    }
    return slots;
  }

  /** Opens the battle-state window: the model's lines as the list's items, in `mode = 'info'`. */
  private openInfo(): void {
    this.menuItems = battleInfoLines(battleInfoRows(this.state)).map((line) => ({
      label: line,
      enabled: true,
      onSelect: () => this.openMenu(),
    }));
    this.menuIndex = 0;
    this.infoSelected = false;
    this.mode = 'info';
    this.refreshHud();
  }

  /** True while the active Pokémon can still spend its Mega Stone this battle. */
  private megaAvailable(): boolean {
    return canMegaEvolve(this.state, 'player');
  }

  /** True while the active Pokémon's own species has a G-Max forme to take (D44). */
  private gmaxAvailable(): boolean {
    return canGigantamax(this.state, 'player');
  }

  /** Arms or disarms the Mega control; the next move spends it (D34). Only one control is ever armed. */
  private toggleMega(): void {
    if (!this.megaAvailable()) return;
    this.megaIntent = !this.megaIntent;
    this.gmaxIntent = false;
    this.refreshHud();
  }

  /** Arms or disarms the G-Max control; the next move spends it (D44). */
  private toggleGmax(): void {
    if (!this.gmaxAvailable()) return;
    this.gmaxIntent = !this.gmaxIntent;
    this.megaIntent = false;
    this.refreshHud();
  }

  private openMoves(slot: Slot = 0): void {
    this.commandSlot = slot;
    const player = activeFighter(this.state, 'player', slot);
    const barred = barredMovesFor(this.state, 'player');
    const legal = legalMoveIndices(player, barred);
    this.menuItems = player.moves.map((moveSlot, index) => {
      const move = getMove(moveSlot.moveId);
      const name = moveName(moveSlot.moveId);
      const enabled = legal.length === 0 ? index === 0 : legal.includes(index);
      // The preview folds the attacker's own stats in, so slot 1 is read with its
      // lead slot while the grid is built for it.
      const preview = withLeadSlot(this.state, 'player', slot, () =>
        movePreview(this.state, 'player', index),
      );
      return {
        label: name,
        enabled,
        onSelect: () => this.chooseMove(slot, index),
        move: {
          type: preview?.type ?? move?.type ?? '',
          category: move?.category ?? 'Status',
          pp: moveSlot.pp,
          maxPp: moveSlot.maxPp,
          desc: moveShortDescription(moveSlot.moveId),
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
    this.gmaxSelected = false;
    this.infoMove = null;
    this.infoPinned = false;
    this.mode = 'moves';
    this.refreshHud();
  }

  /**
   * The move grid's pick for `slot`: a single-target damaging move in a double
   * battle opens the target step, and every other move submits as it always has.
   */
  private chooseMove(slot: Slot, moveIndex: number): void {
    if (this.needsTargetStep(slot, moveIndex)) {
      this.openTargetStep(slot, moveIndex);
      return;
    }
    this.submit({
      type: 'fight',
      moveIndex,
      ...(slot === 1 ? { slot } : {}),
      ...(this.megaIntent ? { mega: true } : {}),
      ...(this.gmaxIntent ? { gmax: true } : {}),
    });
  }

  /**
   * True when the picked move must ask which live foe it hits: a double battle
   * with two standing foes, and a damaging move whose dex target is one slot.
   */
  private needsTargetStep(slot: Slot, moveIndex: number): boolean {
    if (!this.double || this.liveFoeSlots().length < 2) return false;
    const fighter = activeFighter(this.state, 'player', slot);
    const move = getMove(fighter.moves[moveIndex]?.moveId ?? '');
    if (!move || move.category === 'Status') return false;
    if (move.target === 'self' || move.target === 'ally') return false;
    return !SPREAD_TARGETS.has(move.target);
  }

  /** Opens the target step: the cursor marks the first live foe, ready to move. */
  private openTargetStep(slot: Slot, moveIndex: number): void {
    this.commandSlot = slot;
    this.targetMoveIndex = moveIndex;
    this.targetSlot = this.liveFoeSlots()[0] ?? 0;
    this.menuIndex = 0;
    this.menuItems = [];
    this.mode = 'target';
    this.refreshHud();
  }

  /** Steps the target cursor across the live opposing slots. */
  private moveTarget(delta: number): void {
    const live = this.liveFoeSlots();
    if (this.targetSlot === null || live.length < 2) return;
    const index = live.indexOf(this.targetSlot);
    this.targetSlot = live[(index + delta + live.length) % live.length];
    this.refreshHud();
  }

  /** The target step's confirm: the picked move, aimed at the marked foe slot. */
  private confirmTarget(): void {
    const moveIndex = this.targetMoveIndex;
    const target = this.targetSlot;
    if (moveIndex === null || target === null) {
      this.openMoves(this.commandSlot);
      return;
    }
    this.submit({
      type: 'fight',
      moveIndex,
      slot: this.commandSlot,
      target: { side: 'enemy', slot: target },
      ...(this.megaIntent ? { mega: true } : {}),
      ...(this.gmaxIntent ? { gmax: true } : {}),
    });
  }

  /** A press on a foe in the target step: it moves the cursor, or confirms it again. */
  private onFoeClick(slot: Slot): void {
    if (this.mode !== 'target') return;
    if (this.targetSlot === slot) {
      this.confirmTarget();
      return;
    }
    if (!this.liveFoeSlots().includes(slot)) return;
    this.targetSlot = slot;
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
    this.bagQuery = '';
    this.bagSearchFocused = false;
    this.mode = 'bag';
    this.menuIndex = 0;
    this.setBagItems(this.bagCategory);
  }

  /** Shows a pocket's stacks, as the grid the cursor and clicks drive. */
  private setBagItems(category: BagCategory): void {
    this.bagCategory = category;
    this.refreshBagItems();
  }

  /**
   * Rebuilds the drawn stacks from the pocket and the filter, and the menu items
   * that submit them. `filterBagStacks` owns the matching rule; the pocket keeps
   * its own order, so the grid reads in bag order like the shipped list did.
   */
  private refreshBagItems(): void {
    const pocket = this.usableBag().filter(
      (slot) => bagCategoryForKind(slot.item.kind) === this.bagCategory,
    );
    const counts = pocket.map((slot) => ({ itemId: slot.item.id, count: slot.count }));
    const kept = new Set(filterBagStacks(counts, this.bagQuery).map((stack) => stack.itemId));
    this.bagStacks = pocket.filter((slot) => kept.has(slot.item.id)).slice(0, MENU_BAG_CAP);
    this.menuItems =
      this.bagStacks.length === 0
        ? [{ label: t('battle.noItems'), enabled: false, onSelect: () => {} }]
        : this.bagStacks.map((slot) => ({
            label: `${slot.item.name} x${slot.count}`,
            enabled: true,
            onSelect: () => this.submit({ type: 'bag', itemId: slot.item.id }),
          }));
    this.menuIndex = stepBagCursor(this.menuIndex, 0, this.bagStacks.length);
    this.refreshHud();
  }

  /** Steps the bag to the next pocket, as `[` / `]` ask. */
  private cycleBagTab(delta: number): void {
    if (this.bagCategories.length < 2) return;
    const index = this.bagCategories.indexOf(this.bagCategory);
    const next = (index + delta + this.bagCategories.length) % this.bagCategories.length;
    this.bagQuery = '';
    this.bagSearchFocused = false;
    this.menuIndex = 0;
    this.setBagItems(this.bagCategories[next]);
  }

  /** A click on a pocket tab: shows that pocket's stacks. */
  private selectBagTab(slot: number): void {
    if (this.mode !== 'bag') return;
    const category = this.bagCategories[slot];
    if (!category || category === this.bagCategory) return;
    this.bagQuery = '';
    this.bagSearchFocused = false;
    this.menuIndex = 0;
    this.setBagItems(category);
  }

  /**
   * A click on a grid cell selects it. It never submits: the confirming gesture
   * stays the confirm action (or the ◀ back control's sibling rows).
   */
  private selectBagCell(index: number): void {
    if (index < 0 || index >= this.bagStacks.length) return;
    this.menuIndex = index;
    this.refreshHud();
  }

  private openParty(slot: Slot = 0): void {
    this.commandSlot = slot;
    const side = this.state.sides.player;
    this.menuItems = side.party.map((fighter, index) => {
      const status = statusAbbreviation(fighter.status);
      const statusText = status ? `  ${status}` : '';
      return {
        label: t('party.rowLabel', { name: fighter.name, level: fighter.level, status: statusText }),
        enabled: switchablePartyIndices(this.state, 'player').includes(index),
        onSelect: () => this.confirmParty(index),
      };
    });
    this.menuIndex = 0;
    this.mode = 'party';
    this.refreshHud();
  }

  private confirmParty(index: number): void {
    if (this.forcedSwitch) {
      // A double battle sends the replacement to the slot whose occupant fainted,
      // not to the lead; a single battle's one slot is slot 0 either way.
      performSwitch(this.state, 'player', index, this.emptiedPlayerSlot());
      if (needsReplacement(this.state).includes('enemy')) autoReplace(this.state);
      this.forcedSwitch = false;
      this.startFeed(() => this.finishFeed());
      return;
    }
    this.submit(
      this.commandSlot === 1
        ? { type: 'switch', partyIndex: index, slot: 1 }
        : { type: 'switch', partyIndex: index },
    );
  }

  /** The live player slot holding a fainted fighter, slot 0 first; 0 when none does. */
  private emptiedPlayerSlot(): Slot {
    for (const slot of liveSlots(this.state, 'player')) {
      if (activeFighter(this.state, 'player', slot).hp <= 0) return slot;
    }
    return 0;
  }

  private submit(command: Command): void {
    if (command.type === 'bag') {
      const item = getItem(command.itemId);
      if (item?.kind === 'ball') this.lastBallId = item.id;
    }
    if (this.double) {
      this.submitDouble(command);
      return;
    }
    this.displayHp = {
      player: activeFighter(this.state, 'player').hp,
      enemy: activeFighter(this.state, 'enemy').hp,
    };
    takeTurn(
      this.state,
      command,
      chooseAiCommand(this.state, 'enemy', { level: this.aiLevel, flags: this.aiFlags() }),
    );
    this.megaIntent = false;
    this.gmaxIntent = false;
    this.startFeed();
  }

  /**
   * A double battle's commands, collected in slot order: slot 1's waits in
   * `partnerCommand` while slot 0 picks, and the second command resolves both.
   */
  private submitDouble(command: Command): void {
    const slot: Slot = command.type === 'fight' || command.type === 'switch' ? (command.slot ?? 0) : 0;
    if (slot === 1) {
      this.partnerCommand = command;
      if (this.slotNeedsCommand(0)) {
        this.openMenu();
        return;
      }
      this.resolveDoubleTurn({ 1: command });
      return;
    }
    const commands: { 0?: Command; 1?: Command } = { 0: command };
    if (this.partnerCommand) commands[1] = this.partnerCommand;
    this.resolveDoubleTurn(commands);
  }

  /** Runs one double turn: both player commands and one AI command per live foe slot. */
  private resolveDoubleTurn(commands: SlotCommands): void {
    this.displayHp = {
      player: activeFighter(this.state, 'player').hp,
      enemy: activeFighter(this.state, 'enemy').hp,
    };
    const player2 = this.slotFighter('player', 1);
    const enemy2 = this.slotFighter('enemy', 1);
    this.displayActive2 = { player: player2, enemy: enemy2 };
    this.displayHp2 = { player: player2?.hp ?? null, enemy: enemy2?.hp ?? null };
    this.displayStatus2 = { player: player2?.status ?? null, enemy: enemy2?.status ?? null };
    const flags = this.aiFlags();
    const enemyLead = activeFighter(this.state, 'enemy');
    const enemyCommands: { 0?: Command; 1?: Command } = {};
    // A slot whose occupant has fainted with no reserve left keeps its fighter and
    // asks for nothing: the engine skips it, and asking would spend an AI draw on a
    // command the battle cannot accept.
    if (enemyLead.hp > 0) {
      enemyCommands[0] = chooseAiCommand(this.state, 'enemy', { level: this.aiLevel, flags });
    }
    if (enemy2 && enemy2.hp > 0) {
      enemyCommands[1] = chooseAiCommand(this.state, 'enemy', {
        level: this.aiLevel,
        flags,
        slot: 1,
      });
    }
    takeDoubleTurn(this.state, commands, enemyCommands);
    this.partnerCommand = null;
    this.commandSlot = 0;
    this.targetSlot = null;
    this.targetMoveIndex = null;
    this.megaIntent = false;
    this.gmaxIntent = false;
    this.startFeed();
  }

  /** The script flags the enemy thinks with (D46): its archetype's own. */
  private aiFlags(): readonly AiFlag[] {
    const trigger = this.launch?.trigger;
    return trigger?.kind === 'trainer' && trigger.archetypeId
      ? (getTrainerArchetype(trigger.archetypeId)?.aiFlags ?? [])
      : [];
  }

  private usableBag(): BagSlot[] {
    // The no-heal room refuses the Bag outright, so the BAG row draws disabled.
    if (this.state.noHeal) return [];
    return this.state.bag.filter(
      (slot) =>
        slot.count > 0 &&
        slot.item.kind !== 'held' &&
        slot.item.kind !== 'valuable' &&
        (slot.item.kind !== 'ball' || (this.state.isWild && this.launch?.canCapture === true)),
    );
  }

  private hasBench(): boolean {
    return switchablePartyIndices(this.state, 'player').length > 0;
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
    if (this.mode === 'target') {
      this.moveTarget(action === 'left' || action === 'up' ? -1 : 1);
      return;
    }
    if (this.mode === 'bag') {
      const next = stepBagGrid(this.menuIndex, action, this.bagStacks.length);
      if (next !== this.menuIndex) {
        this.menuIndex = next;
        this.refreshHud();
      }
      return;
    }
    if (this.mode === 'moves' || this.mode === 'menu' || this.mode === 'partner') {
      this.moveMenuGrid(action);
    } else this.moveMenu(action === 'up' || action === 'left' ? -1 : 1);
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
    const gmax = this.mode === 'moves' && this.gmaxAvailable();
    const info = this.mode === 'menu' || this.mode === 'partner';

    // The INFO control sits to the right of the command grid, in the column the
    // moves menu reserves for MEGA: `right` from the last column reaches it and
    // `left` walks back out into the grid.
    if (this.infoSelected) {
      if (action === 'left') {
        this.infoSelected = false;
        this.refreshHud();
      }
      return;
    }

    // The Mega and G-Max controls sit to the right of the grid, the G-Max one
    // innermost: `right` from the last column reaches them, and `left` walks back
    // out (D34, D44).
    if (this.megaSelected || this.gmaxSelected) {
      if (action === 'left') {
        if (this.megaSelected && gmax) {
          this.megaSelected = false;
          this.gmaxSelected = true;
        } else {
          this.megaSelected = false;
          this.gmaxSelected = false;
        }
        this.refreshHud();
        return;
      }
      if (action === 'right' && this.gmaxSelected && mega) {
        this.gmaxSelected = false;
        this.megaSelected = true;
        this.refreshHud();
      }
      return;
    }

    let index = this.menuIndex;
    for (let step = 0; step < count; step++) {
      const row = Math.floor(index / cols);
      const col = index % cols;
      if (action === 'right' && (mega || gmax) && (col === cols - 1 || index === count - 1)) {
        if (gmax) this.gmaxSelected = true;
        else this.megaSelected = true;
        this.refreshHud();
        return;
      }
      if (action === 'right' && info && (col === cols - 1 || index === count - 1)) {
        this.infoSelected = true;
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
    if (this.mode === 'menu' && this.infoSelected) {
      this.openInfo();
      return;
    }
    if (this.mode === 'moves' && this.megaSelected && this.megaAvailable()) {
      this.toggleMega();
      return;
    }
    if (this.mode === 'moves' && this.gmaxSelected && this.gmaxAvailable()) {
      this.toggleGmax();
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
      // its platform, so a titan is never clipped behind the panel — but the
      // compact stack must also keep that platform clear of the player panel
      // below, which is opaque and would hide the foe's feet (`foePanelBottom`
      // is the floor: the mon-size caps read the feet, so they cannot go above
      // it without squeezing the sprite to nothing).
      const foePanelBottom = foeInfo.y + foeInfo.h;
      foeY =
        Math.min(
          foePanelBottom + SPRITE_SIZE_MAX,
          Math.max(foePanelBottom, playerInfo.y - FOE_PLATFORM_CLEAR),
        ) - FOE_PLATFORM_OFFSET;
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

    // A double battle's second window per side: the foe's partner sits beside the
    // shipped window (clamped on the right edge of the square) and the player's
    // partner stacks with the shipped one — below it when the field above the menu
    // box has room, above it when it does not, so the pair never overlaps.
    const foeInfo2: Rect | null = this.displayActive2.enemy
      ? {
          x: Math.max(
            box.x,
            Math.min(foeInfo.x + foeInfo.w + SLOT_PANEL_GAP, width - box.x - FOE_PANEL.w),
          ),
          y: foeInfo.y,
          w: FOE_PANEL.w,
          h: FOE_PANEL.h,
        }
      : null;
    const playerInfo2: Rect | null = this.displayActive2.player
      ? this.secondPlayerPanel(playerInfo, box)
      : null;

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
    // Slot 1 draws under the same budget as slot 0 (its window sits on the same
    // row), so the pair is sized alike.
    this.monSizeCap2.enemy = this.monSizeCap.enemy;
    this.monSizeCap2.player = this.monSizeCap.player;
    this.syncMonSprites();
    // A double battle stands the two enemy sprites left and right of the foe
    // platform's centre, and the player's second active beside its lead.
    const foeSpread = this.displayActive2.enemy ? FOE_PLATFORM_SPREAD : 0;
    const playerSpread = this.displayActive2.player ? FOE_PLATFORM_SPREAD : 0;
    this.foeMonPos = { x: foeX - foeSpread, y: foePlatformY };
    this.foeMonPos2 = { x: foeX + foeSpread, y: foePlatformY };
    this.playerMonPos = { x: playerX, y: playerPlatformY };
    this.playerMonPos2 = { x: playerX + playerSpread, y: playerPlatformY };
    if (this.beat.enemy !== 'faint') this.foeSprite.setPosition(this.foeMonPos.x, foePlatformY);
    if (this.beat2.enemy !== 'faint') this.foeSprite2.setPosition(this.foeMonPos2.x, foePlatformY);
    this.foePlatform
      .setScale(platformScale(this.monDrawHeight.enemy))
      .setPosition(compact ? foeX : width * 0.72, foePlatformY);
    if (trainer) this.foeTrainer.setPosition((compact ? foeX : width * 0.72) - 70, foeY + 62);
    if (this.beat.player !== 'faint') this.playerSprite.setPosition(playerX, playerPlatformY);
    if (this.beat2.player !== 'faint') {
      this.playerSprite2.setPosition(this.playerMonPos2.x, playerPlatformY);
    }
    this.playerPlatform
      .setScale(platformScale(this.monDrawHeight.player))
      .setPosition(playerX, playerPlatformY);
    this.foeSprite.setVisible(
      (this.displayHp.enemy > 0 && !this.captured) || this.beat.enemy === 'faint',
    );
    this.playerSprite.setVisible(this.displayHp.player > 0 || this.beat.player === 'faint');
    this.foeSprite2.setVisible(
      this.displayActive2.enemy !== null &&
        this.displayHp2.enemy !== null &&
        (this.displayHp2.enemy > 0 || this.beat2.enemy === 'faint'),
    );
    this.playerSprite2.setVisible(
      this.displayActive2.player !== null &&
        this.displayHp2.player !== null &&
        (this.displayHp2.player > 0 || this.beat2.player === 'faint'),
    );

    this.hud.clear();
    this.marks.clear();
    this.drawSidePanel(foeInfo, 'enemy');
    this.drawSidePanel(playerInfo, 'player');
    this.drawSecondPanel(foeInfo2, 'enemy');
    this.drawSecondPanel(playerInfo2, 'player');
    this.messagePanel.setSlices(message.w, message.h).setPosition(message.x, message.y);
    this.menuPanel.setSlices(menu.w, menu.h).setPosition(menu.x, menu.y);
    this.messagePanel.setVisible(!menuOpen);
    this.messageText.setVisible(!menuOpen);

    this.messageText.setPosition(
      message.x + FRLG_TEXTBOX_PADDING.x,
      message.y + FRLG_TEXTBOX_PADDING.top,
    );
    this.messageText.setMaxWidth(message.w - FRLG_TEXTBOX_PADDING.x * 2);

    if (menuOpen) {
      if (this.mode === 'bag') this.renderBagMenu(menu);
      else if (this.mode === 'moves') this.renderMoveMenu(menu);
      else if (this.mode === 'menu' || this.mode === 'partner') this.renderCommandMenu(menu);
      else if (this.mode === 'info') this.renderInfoWindow(menu);
      else this.renderPartyGrid(menu);
    } else {
      this.hideMenu();
    }
    this.layoutTargetCursor();
  }

  /**
   * The second player window: directly below the shipped one when both fit above
   * the menu box, and above it when they do not. Either way the two never overlap
   * and the pair stays inside the battle square.
   */
  private secondPlayerPanel(playerInfo: Rect, box: Rect): Rect {
    const below = playerInfo.y + PLAYER_PANEL_H + SLOT_PANEL_GAP;
    const y =
      below + PLAYER_PANEL_H <= box.y - SLOT_PANEL_GAP
        ? below
        : Math.max(SLOT_PANEL_EDGE, playerInfo.y - PLAYER_PANEL_H - SLOT_PANEL_GAP);
    return { x: playerInfo.x, y, w: PLAYER_PANEL_W, h: PLAYER_PANEL_H };
  }

  /**
   * The target step's marker: the shipped cursor sits beside the marked foe, and
   * the two foe hit zones are armed only while the step is open, so a click on a
   * foe during the feed still advances the text.
   */
  private layoutTargetCursor(): void {
    const open = this.mode === 'target' && this.displayHp2.enemy !== null;
    this.foeZones.forEach((zone, slot) => {
      if (zone.input) zone.input.enabled = open;
      if (!open) return;
      const pos = this.monPos('enemy', slot === 1 ? 1 : 0);
      const height = slot === 1 ? this.monDrawHeight2.enemy : this.monDrawHeight.enemy;
      zone
        .setPosition(pos.x, pos.y - height / 2)
        .setSize(FOE_PLATFORM_SPREAD * 1.4, Math.max(60, height));
    });
    const target = open ? this.targetSlot : null;
    if (target === null) {
      this.targetCursor.setVisible(false);
      return;
    }
    const pos = this.monPos('enemy', target);
    const height = target === 0 ? this.monDrawHeight.enemy : this.monDrawHeight2.enemy;
    this.targetCursor
      .setFlipX(false)
      .setScale(1)
      .setPosition(pos.x - 30, pos.y - height * 0.5)
      .setVisible(true);
  }

  private drawSidePanel(rect: Rect, side: SideId): void {
    this.drawPanel(
      rect,
      side,
      this.panelKits[side][0],
      this.displayActive[side],
      this.displayHp[side],
      this.displayStatus[side],
    );

    if (side === 'enemy') {
      if (this.state.isWild) this.hideFoeBallRow();
      else this.drawFoeBallRow(rect);
    }
  }

  /**
   * The second slot's window on a side, or nothing when the battle does not field
   * it (the shipped single layout, reached through the same code).
   */
  private drawSecondPanel(rect: Rect | null, side: SideId): void {
    const fighter = this.displayActive2[side];
    const hp = this.displayHp2[side];
    if (rect === null || !fighter || hp === null) {
      this.hideSecondPanel(side);
      return;
    }
    this.drawPanel(rect, side, this.panelKits[side][1], fighter, hp, this.displayStatus2[side]);
  }

  /** Hides slot 1's window and everything it paints. */
  private hideSecondPanel(side: SideId): void {
    const kit = this.panelKits[side][1];
    kit.panel.setVisible(false);
    kit.nameText.setVisible(false);
    kit.statText.setVisible(false);
    kit.statusText.setVisible(false);
    kit.statusBadge.setVisible(false);
    for (const badge of kit.typeBadges) badge.setVisible(false);
    for (const chip of kit.typeChipBgs) chip.setVisible(false);
    for (const chip of kit.typeChips) chip.setVisible(false);
    kit.hpBar.bar.setVisible(false);
    kit.hpBar.fill.setVisible(false);
  }

  /**
   * One HP window: the card, the name row, the types band, the status mark and the
   * bar. It paints a side's slot 0 and slot 1 alike, from the kit the caller hands
   * it, so the two windows can never read differently.
   */
  private drawPanel(
    rect: Rect,
    side: SideId,
    kit: PanelKit,
    fighter: BattleFighter,
    hp: number,
    status: StatusId | null,
  ): void {
    kit.panel.setSlices(rect.w, rect.h).setPosition(rect.x, rect.y).setVisible(true);
    const fraction = hpFraction(hp, fighter.maxHp);

    // Content stays inside the FRLG window's baked border: the name drops below
    // the top frame, then the types row and the HP bar keep their gaps, so
    // nothing rides the bevel.
    const pad = FRLG_WINDOW_PADDING;
    const nameY = rect.y + pad.top;
    const barX = rect.x + pad.x;
    const typesY = nameY + PANEL_NAME_H;
    const barY = typesY + PANEL_TYPES_H + PANEL_NAME_GAP;

    kit.nameText
      .setText(t('battle.panelName', { name: fighter.name, level: fighter.level }))
      .setPosition(barX, nameY)
      .setVisible(true);

    // The row is the live fighter's own types, so a Mega Evolution or a form
    // change shows the forme's (`displayActive` follows both).
    const types = fighter.types;
    let typeX = barX;
    for (let i = 0; i < PANEL_TYPE_SLOTS; i++) {
      const type = types[i];
      const frame = type === undefined ? null : typeIconFrame(type);
      const badge = kit.typeBadges[i];
      const chipBg = kit.typeChipBgs[i];
      const chip = kit.typeChips[i];
      if (frame !== null && type !== undefined) {
        badge
          .setTexture(TYPE_ICON_TEXTURE_KEY, frame)
          .setPosition(typeX, typesY + 3)
          .setVisible(true);
        chipBg.setVisible(false);
        chip.setVisible(false);
        typeX += TYPE_ICON_W * PANEL_TYPE_SCALE + PANEL_TYPE_GAP;
      } else if (type !== undefined) {
        badge.setVisible(false);
        const colour = typeColor(type);
        chipBg
          .setPosition(typeX, typesY)
          .setSize(PANEL_CHIP_W, PANEL_CHIP_H)
          .setFillStyle(colour)
          .setVisible(true);
        chip
          .setText(type.toUpperCase())
          .setTint(badgeInkFor(colour))
          .setPosition(typeX + PANEL_CHIP_W / 2, typesY + 2)
          .setVisible(true);
        typeX += PANEL_CHIP_W + PANEL_TYPE_GAP;
      } else {
        badge.setVisible(false);
        chipBg.setVisible(false);
        chip.setVisible(false);
      }
    }

    kit.statText
      .setText(side === 'player' ? `${hp}/${fighter.maxHp}` : '')
      .setPosition(rect.x + rect.w - pad.x, barY - 23)
      .setVisible(true);

    // A badly poisoned Pokémon gets the `TOX` chip: the badge atlas maps `tox` and
    // `psn` onto one frame, so the badge alone cannot tell the two apart (§10.1).
    const statusFrame = status && status !== 'tox' ? statusIconFrame(status) : null;
    if (statusFrame !== null) {
      // The FRLG badge carries its own colours, so no chip is painted behind it.
      kit.statusBadge
        .setFrame(statusFrame)
        .setPosition(barX, barY - 22)
        .setVisible(true);
      kit.statusText.setVisible(false);
    } else {
      kit.statusBadge.setVisible(false);
      const abbreviation = statusAbbreviation(status);
      kit.statusText
        .setText(abbreviation ?? '')
        .setPosition(barX + 27, barY - 23)
        .setVisible(abbreviation !== null);
      if (abbreviation) {
        this.hud.fillStyle(0x8b5cf6, 1);
        this.hud.fillRoundedRect(barX, barY - 24, 54, 20, 6);
      }
    }

    const bar = kit.hpBar;
    bar.fill
      .setPosition(barX + FRLG_HPBAR.fill.x, barY + FRLG_HPBAR.fill.y)
      .setSize(Math.max(0, FRLG_HPBAR.fill.width * fraction), FRLG_HPBAR.fill.height)
      .setFillStyle(hpColorInt(fraction))
      .setVisible(true);
    bar.bar.setPosition(barX, barY).setVisible(true);

    // The danger band carries a shape as well as its hue: the fill is cut into
    // blocks by dark notches, so a low HP reads without colour (D45, §10.2).
    if (isLowHp(fraction)) {
      this.hud.fillStyle(FRLG_INK, 1);
      for (const dx of hpCueNotches(FRLG_HPBAR.fill.width * fraction)) {
        this.hud.fillRect(
          barX + FRLG_HPBAR.fill.x + dx - HP_CUE_GAP / 2,
          barY + FRLG_HPBAR.fill.y,
          HP_CUE_GAP,
          FRLG_HPBAR.fill.height,
        );
      }
    }
  }

  /**
   * The foe's remaining team as a fixed row of balls under its panel: one per
   * member the trainer brought, in roster order, with the fainted ones emptied.
   * The active member's ball follows the displayed HP, so it dims on the same
   * repaint that empties the HP bar.
   */
  private drawFoeBallRow(rect: Rect): void {
    const party = this.state.sides.enemy.party;
    const active = this.state.sides.enemy.activeIndex;
    const x = rect.x + FRLG_WINDOW_PADDING.x;
    const y = rect.y + rect.h + FOE_BALL_GAP;
    this.foeBallRow.forEach((ball, i) => {
      if (i >= party.length) {
        ball.setVisible(false);
        return;
      }
      const spent = i === active ? this.displayHp.enemy <= 0 : party[i].hp <= 0;
      ball
        .setPosition(x + i * FOE_BALL_PITCH, y)
        .setAlpha(spent ? FOE_BALL_SPENT_ALPHA : 1)
        .setVisible(true);
      if (spent) {
        ball.setTint(FOE_BALL_SPENT_TINT);
        // A spent ball reads as "out" without its tint too: a dark slash across
        // the icon's own box (§10.1). The dim tint stays as a second cue.
        this.marks.lineStyle(2, FRLG_INK, 1);
        this.marks.lineBetween(ball.x, ball.y, ball.x + ball.displayWidth, ball.y + ball.displayHeight);
      } else {
        ball.clearTint();
      }
    });
  }

  private hideFoeBallRow(): void {
    this.foeBallRow.forEach((ball) => ball.setVisible(false));
  }

  /**
   * The main battle commands (FIGHT / BAG / SWITCH / RUN) as a 2x2 grid, matching
   * the moves grid: a neutral cell each, the name centred and the cursor at the
   * selected cell's end.
   */
  private renderCommandMenu(menu: Rect): void {
    this.menuPanel.setVisible(true);
    this.hideBagChrome();
    this.hideMoveChrome();
    this.hidePartyGrid();
    this.layoutBackButton(menu, false);
    const pad = FRLG_WINDOW_PADDING;
    const count = this.menuItems.length;
    const cols = MENU_GRID_COLS;
    const rows = Math.max(1, Math.ceil(count / cols));
    const left = menu.x + pad.x + MOVE_GRID_INSET;
    const right = menu.x + menu.w - pad.x - MOVE_GRID_INSET - MOVE_MEGA_COL;
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
        .setTint(i === this.menuIndex ? FRLG_ACCENT : FRLG_INK)
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
        .setFillStyle(
          selected ? FRLG_SELECTED_FILL.colour : FRLG_ROW_FILL.colour,
          selected ? FRLG_SELECTED_FILL.alpha : FRLG_ROW_FILL.alpha,
        )
        .setStrokeStyle(
          1,
          selected ? FRLG_SELECTED_STROKE.colour : FRLG_ROW_STROKE.colour,
          selected ? FRLG_SELECTED_STROKE.alpha : FRLG_ROW_STROKE.alpha,
        )
        .setVisible(true);
    });
    this.menuZones.forEach((zone, i) => {
      const item = i < count ? this.menuItems[i] : undefined;
      zone.setData('item', item ? i : -1);
      if (zone.input) zone.input.enabled = Boolean(item);
      if (item) zone.setPosition(cellX(i), cellY(i)).setSize(cellW, cellH);
    });
    this.layoutInfoControl(menu, top, bottom);
    if (this.infoSelected) {
      this.menuCursor
        .setFlipX(true)
        .setScale(1)
        .setPosition(
          this.infoCell.x + this.infoCell.width - 12,
          this.infoCell.y + this.infoCell.height / 2,
        )
        .setVisible(true);
      return;
    }
    this.menuCursor
      .setFlipX(true)
      .setScale(1)
      .setPosition(cellX(this.menuIndex) + cellW - 48, cellY(this.menuIndex) + cellH / 2)
      .setVisible(count > 0);
  }

  /** A fifth control at the right edge of the command window, the column `MOVE_MEGA_COL` reserves in the moves menu. */
  private layoutInfoControl(menu: Rect, top: number, bottom: number): void {
    const x = menu.x + menu.w - FRLG_WINDOW_PADDING.x - MOVE_GRID_INSET - MOVE_MEGA_COL;
    const h = bottom - top;
    const selected = this.infoSelected;
    this.infoCell
      .setPosition(x, top)
      .setSize(MOVE_MEGA_COL, h)
      .setFillStyle(
        selected ? FRLG_SELECTED_FILL.colour : FRLG_ROW_FILL.colour,
        selected ? FRLG_SELECTED_FILL.alpha : FRLG_ROW_FILL.alpha,
      )
      .setStrokeStyle(
        1,
        selected ? FRLG_SELECTED_STROKE.colour : FRLG_ROW_STROKE.colour,
        selected ? FRLG_SELECTED_STROKE.alpha : FRLG_ROW_STROKE.alpha,
      )
      .setVisible(true);
    this.infoText
      .setText(t('battle.infoControl'))
      .setPosition(x + MOVE_MEGA_COL / 2, top + h / 2)
      .setVisible(true);
    this.infoZone.setPosition(x, top).setSize(MOVE_MEGA_COL, h);
    if (this.infoZone.input) this.infoZone.input.enabled = true;
  }

  /** Hides the info control's cell, label and hit zone. */
  private hideInfoControl(): void {
    this.infoCell.setVisible(false);
    this.infoText.setVisible(false);
    if (this.infoZone.input) this.infoZone.input.enabled = false;
  }

  /**
   * The battle-state window: the model's lines as the shipped list rows in the
   * shipped window — the weather and the terrain, the field and side conditions
   * with their counts and each active's stat stages and status.
   */
  private renderInfoWindow(menu: Rect): void {
    this.menuPanel.setVisible(true);
    this.hideBagChrome();
    this.hideMoveChrome();
    this.hidePartyGrid();
    this.hideInfoControl();
    this.layoutBackButton(menu, false);
    this.layoutMenuRows(
      menu,
      this.menuItems,
      menu.y + FRLG_WINDOW_PADDING.top + MOVE_GRID_INSET,
      MENU_ROWS,
      0,
    );
  }

  /**
   * The party (switch) menu as a single column of rows: one fixed-size row per
   * member — the same size whether the party holds two Pokémon or six — with the
   * portrait, name and HP bar scaled down into the row rather than the row
   * growing around them. The ◀ back control sits centred on the grid's left edge,
   * as in the moves menu.
   */
  private renderPartyGrid(menu: Rect): void {
    this.menuPanel.setVisible(true);
    this.hideBagChrome();
    this.hideMoveChrome();
    this.hideInfoControl();
    const party = this.state.sides.player.party;
    const count = this.menuItems.length;
    // The rows a double battle already has on the field carry the accent: those are
    // the ones the grid refuses, so the player can see which two are out.
    const fieldRows = this.double
      ? partyGridFieldRows(
          this.state.sides.player.activeIndex,
          this.state.sides.player.secondActiveIndex,
        )
      : [];
    const { rects, avatarScale, hpBarScale, labelMaxWidth } = partyGridLayout(menu, {
      padding: FRLG_WINDOW_PADDING,
      avatarScaleCap: PARTY_AVATAR_SCALE,
      hpBarScaleCap: PARTY_CELL_HPBAR_SCALE,
    });
    const avatarW = PORTRAIT_SIZE * avatarScale;
    const hpBarW = FRLG_HPBAR.width * hpBarScale;
    const hpBarH = FRLG_HPBAR.height * hpBarScale;
    const labelH = (FRLG_LINE_HEIGHT * PARTY_LABEL_SIZE) / FRLG_FONT_SIZE;

    // The ◀ back control, centred on the grid's left edge, as in the moves menu.
    const top = rects[0].y;
    const bottom = rects[rects.length - 1].y + rects[rects.length - 1].h;
    const backX = menu.x + FRLG_WINDOW_PADDING.x + 14;
    const backY = (top + bottom) / 2;
    this.backArrow.setVisible(true).setPosition(backX, backY);
    this.backZone.setPosition(backX - 12, backY - 18).setSize(48, 36);
    if (this.backZone.input) this.backZone.input.enabled = true;

    // The shared list rows are not used by the row grid.
    for (const row of this.menuRows) row.setVisible(false);
    for (const zone of this.menuZones) {
      zone.setData('item', -1);
      if (zone.input) zone.input.enabled = false;
    }

    this.partyCells.forEach((cell, i) => {
      const item = i < count ? this.menuItems[i] : undefined;
      const member = i < count ? party[i] : undefined;
      const rect = rects[i];
      if (!item || !member || !rect) {
        cell.setVisible(false);
        this.partyAvatars[i].setVisible(false);
        this.partyLabels[i].setVisible(false);
        this.partyHpBars[i].setVisible(false);
        this.partyHpFills[i].setVisible(false);
        return;
      }
      const selected = i === this.menuIndex;
      cell
        .setPosition(rect.x, rect.y)
        .setSize(rect.w, rect.h)
        .setFillStyle(
          selected ? FRLG_SELECTED_FILL.colour : FRLG_ROW_FILL.colour,
          selected ? FRLG_SELECTED_FILL.alpha : FRLG_ROW_FILL.alpha,
        )
        .setStrokeStyle(
          1,
          selected ? FRLG_SELECTED_STROKE.colour : FRLG_ROW_STROKE.colour,
          selected ? FRLG_SELECTED_STROKE.alpha : FRLG_ROW_STROKE.alpha,
        )
        .setVisible(true);
      const portrait = portraitFor(member.speciesId, member.shiny);
      this.partyAvatars[i]
        .setVisible(portrait !== null)
        .setAlpha(item.enabled ? 1 : 0.45)
        .setScale(avatarScale)
        .setPosition(rect.x + 8 + avatarW / 2, rect.y + rect.h / 2);
      if (portrait) this.partyAvatars[i].setTexture(portrait.key, portrait.frame);

      // The label is clipped to one line, never wrapped, and the HP bar sits at
      // the row's right edge, so a long nickname can never stretch the row.
      const labelX = rect.x + 8 + avatarW + 6;
      this.partyLabels[i]
        .setText(fitPartyLabel(item.label, labelMaxWidth, PARTY_LABEL_SIZE))
        .setTint(fieldRows.includes(i) ? FRLG_ACCENT : FRLG_INK)
        .setAlpha(item.enabled ? 1 : 0.45)
        .setOrigin(0, 0)
        .setPosition(labelX, rect.y + (rect.h - labelH) / 2)
        .setVisible(true);

      const barX = rect.x + rect.w - 8 - hpBarW;
      const barY = rect.y + (rect.h - hpBarH) / 2;
      const fraction = hpFraction(member.hp, member.maxHp);
      const alive = member.hp > 0;
      this.partyHpBars[i].setVisible(alive).setScale(hpBarScale).setPosition(barX, barY);
      this.partyHpFills[i]
        .setVisible(alive)
        .setPosition(barX + FRLG_HPBAR.fill.x * hpBarScale, barY + FRLG_HPBAR.fill.y * hpBarScale)
        .setSize(
          Math.max(0, FRLG_HPBAR.fill.width * hpBarScale * fraction),
          FRLG_HPBAR.fill.height * hpBarScale,
        )
        .setFillStyle(hpColorInt(fraction));
    });
    this.partyZones.forEach((zone, i) => {
      const item = i < count ? this.menuItems[i] : undefined;
      const rect = rects[i];
      zone.setData('item', item ? i : -1);
      if (zone.input) zone.input.enabled = Boolean(item);
      if (item && rect) zone.setPosition(rect.x, rect.y).setSize(rect.w, rect.h);
    });
    // The row is only a sixth of the panel, so the cursor shrinks to fit it.
    const cursorRow = rects[this.menuIndex];
    this.menuCursor
      .setFlipX(true)
      .setScale(Math.min(1, cursorRow.h / this.menuCursor.height))
      .setPosition(cursorRow.x + cursorRow.w - 48, cursorRow.y + cursorRow.h / 2)
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
      this.hidePartyAbilityInfo();
      this.hidePartyMoveInfo();
      return;
    }
    if (this.partyMoveInfoMember !== detail.id) this.hidePartyMoveInfo();
    const scale = Math.min(1, menu.w / PARTY_DETAIL_W);
    const height = PARTY_DETAIL_H * scale;
    const x = Math.max(0, Math.min(menu.x, menu.x * 2 + menu.w - PARTY_DETAIL_W * scale));
    const y = Math.max(0, menu.y - height - MOVE_POPUP_GAP);
    this.partyDetail.setScale(scale).setPosition(x, y).setVisible(true);

    this.partyDetailName.setText(detail.name);
    this.partyDetailLevel.setText(t('common.level', { level: detail.level }));
    this.partyDetailTypes.forEach((chip, i) => {
      const type = detail.types[i];
      chip.bg.setVisible(type !== undefined);
      chip.label.setVisible(type !== undefined);
      if (type === undefined) {
        chip.label.setText('');
        return;
      }
      const colour = typeColor(type);
      chip.bg.setFillStyle(colour);
      chip.label.setTint(badgeInkFor(colour));
      chip.label.setText(type.toUpperCase());
    });

    const { hpText, rows, nature, ability, held } = this.partyDetailStats;
    hpText.setText(t('detail.hp', { hp: detail.hp, max: detail.maxHp }));
    rows.forEach((row, i) => {
      const stat = DETAIL_STATS[i];
      row.value.setText(String(detail.stats[stat]));
      // Green for the stat a nature raises, red for the one it lowers.
      const effect = natureEffect(detail.nature, stat);
      const tint = effect === 'up' ? NATURE_UP_TINT : effect === 'down' ? NATURE_DOWN_TINT : FRLG_INK;
      row.value.setTint(tint);
      if (effect !== 'neutral') row.label.setTint(tint);
    });
    nature.setText(t('detail.nature', { nature: capitalize(detail.nature) }));
    ability.setText(t('detail.ability', { ability: detail.ability }));
    held.setText(t('detail.held', { held: detail.heldItemName ?? t('detail.none') }));
    this.renderPartyAbilityInfo(detail);

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
      row.cell
        .setFillStyle(FRLG_ROW_FILL.colour, FRLG_ROW_FILL.alpha)
        .setStrokeStyle(1, FRLG_ROW_STROKE.colour, FRLG_ROW_STROKE.alpha);
      row.name.setText(move.name);
      row.pp.setText(t('move.pp', { pp: move.pp, max: move.maxPp }));
    });
    this.renderPartyMoveInfo(detail);
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
    this.hidePartyAbilityInfo();
    this.hidePartyMoveInfo();
  }

  /**
   * The detail window's ability ⓘ: the spot comes from the ability text's own
   * width, and both the spot and the zone stay in the container's coordinates
   * (the panel is scaled and offset as a whole).
   */
  private renderPartyAbilityInfo(detail: MemberDetail): void {
    const ability = this.partyDetailStats.ability;
    const spot = abilityInfoSpot(ability.x + ability.width, ability.y);
    this.partyAbilityButton.layout(
      spot,
      this.partyAbilityInfo,
      abilityInfoContent(detail.ability, detail.abilityDesc),
    );
    this.partyAbilityZone.setPosition(spot.x, spot.y).setSize(spot.width, spot.height);
    if (this.partyAbilityZone.input) this.partyAbilityZone.input.enabled = true;
  }

  /** Redraws the ability ⓘ for the member the cursor is on. */
  private refreshPartyAbilityInfo(): void {
    const fighter = this.state.sides.player.party[this.menuIndex];
    if (!fighter || this.mode !== 'party') {
      this.hidePartyAbilityInfo();
      return;
    }
    this.renderPartyAbilityInfo(fighterDetail(fighter));
  }

  /** Shows or hides the ability window as the pointer reaches or leaves the ⓘ. */
  private setPartyAbilityInfo(over: boolean): void {
    if (over === this.partyAbilityInfo) return;
    this.partyAbilityInfo = over;
    this.refreshPartyAbilityInfo();
  }

  /** Hides the ability ⓘ, its window and its hover zone. */
  private hidePartyAbilityInfo(): void {
    this.partyAbilityInfo = false;
    this.partyAbilityButton.hide();
    if (this.partyAbilityZone.input) this.partyAbilityZone.input.enabled = false;
  }

  /** Lays the four ⓘ controls out for the described member and floats (or hides) the window. */
  private renderPartyMoveInfo(detail: MemberDetail): void {
    this.partyMoveInfoMember = detail.id;
    this.partyMoveInfoRows.forEach((row, i) => {
      const move = detail.moves[i];
      const visible = move !== undefined;
      row.button.setVisible(visible);
      row.label.setVisible(visible);
      if (row.zone.input) row.zone.input.enabled = visible;
      if (!move) return;
      const active = i === this.partyMoveInfo;
      row.button
        .setFillStyle(
          active ? FRLG_SELECTED_FILL.colour : FRLG_ROW_FILL.colour,
          active ? FRLG_SELECTED_FILL.alpha : FRLG_ROW_FILL.alpha,
        )
        .setStrokeStyle(
          1,
          active ? FRLG_SELECTED_STROKE.colour : FRLG_ROW_STROKE.colour,
          active ? FRLG_SELECTED_STROKE.alpha : FRLG_ROW_STROKE.alpha,
        );
    });
    const index = this.partyMoveInfo;
    const anchor = index === null ? undefined : this.partyDetailMoves[index];
    const move = index === null ? undefined : detail.moves[index];
    if (!anchor || !move || move.desc.length === 0) {
      this.partyMoveInfoPopup.hide();
      return;
    }
    const cell: MoveGridCell = {
      name: move.name,
      type: move.type,
      category: move.category,
      pp: move.pp,
      maxPp: move.maxPp,
      desc: move.desc,
      power: move.power,
      basePower: move.basePower,
      accuracy: move.accuracy,
      baseAccuracy: move.baseAccuracy,
      status: move.status,
      enabled: true,
    };
    const infoY = anchor.cell.y + 6;
    this.partyMoveInfoPopup.show(
      {
        x: FRLG_WINDOW_PADDING.x,
        width: PARTY_DETAIL_W - FRLG_WINDOW_PADDING.x * 2,
        above: infoY - MOVE_POPUP_GAP,
        below: infoY + ABILITY_INFO_SIZE + MOVE_POPUP_GAP,
      },
      moveInfoContent(cell),
    );
  }

  /** Redraws the ⓘ for the member the cursor is on. */
  private refreshPartyMoveInfo(): void {
    const fighter = this.state.sides.player.party[this.menuIndex];
    if (!fighter || this.mode !== 'party') {
      this.hidePartyMoveInfo();
      return;
    }
    this.renderPartyMoveInfo(fighterDetail(fighter));
  }

  /** Hovering the ⓘ of row `index` floats its description, unless one is pinned. */
  private setPartyMoveInfo(index: number): void {
    if (this.partyMoveInfoPinned || this.partyMoveInfo === index) return;
    this.partyMoveInfo = index;
    this.refreshPartyMoveInfo();
  }

  /** Leaving the ⓘ hides an unpinned description. */
  private clearPartyMoveInfo(index: number): void {
    if (this.partyMoveInfoPinned || this.partyMoveInfo !== index) return;
    this.partyMoveInfo = null;
    this.refreshPartyMoveInfo();
  }

  /** A press pins that description, or closes it when it is already pinned. */
  private togglePartyMoveInfo(index: number): void {
    if (this.partyMoveInfoPinned && this.partyMoveInfo === index) {
      this.partyMoveInfoPinned = false;
      this.partyMoveInfo = null;
    } else {
      this.partyMoveInfoPinned = true;
      this.partyMoveInfo = index;
    }
    this.refreshPartyMoveInfo();
  }

  /** Hides the four ⓘ controls, their zones and the window. */
  private hidePartyMoveInfo(): void {
    this.partyMoveInfo = null;
    this.partyMoveInfoPinned = false;
    this.partyMoveInfoMember = null;
    for (const row of this.partyMoveInfoRows) {
      row.button.setVisible(false);
      row.label.setVisible(false);
      if (row.zone.input) row.zone.input.enabled = false;
    }
    this.partyMoveInfoPopup.hide();
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
    this.hideBagChrome();
    this.hidePartyGrid();
    this.hideInfoControl();
    for (const row of this.menuRows) row.setVisible(false);
    for (const cell of this.commandCells) cell.setVisible(false);
    const pad = FRLG_WINDOW_PADDING;
    const count = this.menuItems.length;
    const left = menu.x + pad.x;
    const right = menu.x + menu.w - pad.x - MOVE_GRID_INSET;
    const top = menu.y + pad.top + MOVE_GRID_INSET;
    const bottom = menu.y + menu.h - pad.bottom - MOVE_GRID_INSET;
    // The Mega and G-Max controls take a column each on the right, but only while
    // they are usable.
    const mega = this.megaAvailable();
    const gmax = this.gmaxAvailable();
    if (!mega) this.megaSelected = false;
    if (!gmax) this.gmaxSelected = false;

    // The ◀ back control, centred in the grid's reserved left column.
    const backY = (top + bottom) / 2;
    const backW = this.backArrow.displayWidth;
    const backX = left + Math.round((MOVE_BACK_COL - backW) / 2);
    this.backArrow.setVisible(true).setPosition(backX, backY);
    this.backZone.setPosition(backX + backW / 2 - 24, backY - 18).setSize(48, 36);
    if (this.backZone.input) this.backZone.input.enabled = true;

    this.layoutMegaControl(right, top, bottom, mega);
    this.layoutGmaxControl(right, top, bottom, gmax, mega);

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
    // Four slots always: the member's moves, then an empty container each. The
    // empty ones draw no zone of their own, so they stay unselectable.
    const slots = cells.length > 0 ? padMoveGridCells(cells, MAX_MOVES) : [];
    this.moveGrid.layout({
      x: menu.x,
      y: menu.y,
      w: menu.w,
      h: menu.h,
      cells: slots,
      selected: this.megaSelected || this.gmaxSelected ? -1 : this.menuIndex,
      info: this.megaSelected || this.gmaxSelected ? null : this.infoMove,
      leftReserve: MOVE_BACK_COL,
      rightReserve: (mega ? MOVE_MEGA_COL : 0) + (gmax ? MOVE_GMAX_COL : 0),
    });

    this.menuZones.forEach((zone, i) => {
      const item = i < count ? this.menuItems[i] : undefined;
      zone.setData('item', item ? i : -1);
      if (zone.input) zone.input.enabled = Boolean(item);
      if (!item) return;
      const rect = this.moveGrid.cellRect(i);
      if (!rect) return;
      zone.setPosition(rect.x, rect.y).setSize(rect.w, rect.h);
    });
    // The moves grid marks its selection with the cell's highlight alone and a
    // dark ▶ cursor; the cursor jumps to whichever forme control is the target.
    const control = this.megaSelected ? this.megaCell : this.gmaxSelected ? this.gmaxCell : null;
    if (control) {
      this.menuCursor
        .setFlipX(true)
        .setScale(1)
        .setPosition(control.x + control.width - 12, control.y + control.height / 2)
        .setVisible(true);
      return;
    }
    const selectedCell = count > 0 ? this.moveGrid.cellRect(this.menuIndex) : null;
    if (selectedCell) {
      this.menuCursor
        .setFlipX(true)
        .setScale(1)
        .setPosition(selectedCell.x + selectedCell.w - 48, selectedCell.y + selectedCell.h / 2)
        .setVisible(true);
      return;
    }
    this.menuCursor.setVisible(false);
  }

  /**
   * Lays out the MEGA control at the right edge of the moves menu, or hides it
   * when the active Pokémon cannot Mega Evolve (D34). The cell paints as a
   * selected control while it is the cursor's target and while the evolution is
   * armed, and the glyph takes the accent then.
   */
  private layoutMegaControl(right: number, top: number, bottom: number, show: boolean): void {
    if (!show) {
      this.megaCell.setVisible(false);
      this.megaGlyph.setVisible(false);
      if (this.megaZone.input) this.megaZone.input.enabled = false;
      return;
    }
    const x = right - MOVE_MEGA_COL;
    const h = bottom - top;
    const armed = this.megaSelected || this.megaIntent;
    this.megaCell
      .setPosition(x, top)
      .setSize(MOVE_MEGA_COL, h)
      .setFillStyle(
        armed ? FRLG_SELECTED_FILL.colour : FRLG_ROW_FILL.colour,
        armed ? FRLG_SELECTED_FILL.alpha : FRLG_ROW_FILL.alpha,
      )
      .setStrokeStyle(
        1,
        armed ? FRLG_SELECTED_STROKE.colour : FRLG_ROW_STROKE.colour,
        armed ? FRLG_SELECTED_STROKE.alpha : FRLG_ROW_STROKE.alpha,
      )
      .setVisible(true);
    if (this.megaIntent) this.megaGlyph.setTint(FRLG_ACCENT);
    else this.megaGlyph.clearTint();
    this.megaGlyph.setPosition(x + MOVE_MEGA_COL / 2, top + h / 2).setVisible(true);
    this.megaZone.setPosition(x, top).setSize(MOVE_MEGA_COL, h);
    if (this.megaZone.input) this.megaZone.input.enabled = true;
  }

  /**
   * Lays out the G-MAX control in the slot immediately inside the Mega one, or
   * hides it when the active Pokémon's own species has no G-Max forme (D44). It
   * paints and arms exactly like the Mega control.
   */
  private layoutGmaxControl(
    right: number,
    top: number,
    bottom: number,
    show: boolean,
    mega: boolean,
  ): void {
    if (!show) {
      this.gmaxCell.setVisible(false);
      this.gmaxGlyph.setVisible(false);
      if (this.gmaxZone.input) this.gmaxZone.input.enabled = false;
      return;
    }
    const x = right - (mega ? MOVE_MEGA_COL : 0) - MOVE_GMAX_COL;
    const h = bottom - top;
    const armed = this.gmaxSelected || this.gmaxIntent;
    this.gmaxCell
      .setPosition(x, top)
      .setSize(MOVE_GMAX_COL, h)
      .setFillStyle(
        armed ? FRLG_SELECTED_FILL.colour : FRLG_ROW_FILL.colour,
        armed ? FRLG_SELECTED_FILL.alpha : FRLG_ROW_FILL.alpha,
      )
      .setStrokeStyle(
        1,
        armed ? FRLG_SELECTED_STROKE.colour : FRLG_ROW_STROKE.colour,
        armed ? FRLG_SELECTED_STROKE.alpha : FRLG_ROW_STROKE.alpha,
      )
      .setVisible(true);
    if (this.gmaxIntent) this.gmaxGlyph.setTint(FRLG_ACCENT);
    else this.gmaxGlyph.clearTint();
    this.gmaxGlyph.setPosition(x + MOVE_GMAX_COL / 2, top + h / 2).setVisible(true);
    this.gmaxZone.setPosition(x, top).setSize(MOVE_GMAX_COL, h);
    if (this.gmaxZone.input) this.gmaxZone.input.enabled = true;
  }

  /** Hides the grid and its popup: cells, badges, PP / power / accuracy, ⓘ and info. */
  private hideMoveChrome(): void {
    this.moveGrid.hide();
    for (const cell of this.commandCells) cell.setVisible(false);
    this.megaCell.setVisible(false);
    this.megaGlyph.setVisible(false);
    if (this.megaZone.input) this.megaZone.input.enabled = false;
    this.gmaxCell.setVisible(false);
    this.gmaxGlyph.setVisible(false);
    if (this.gmaxZone.input) this.gmaxZone.input.enabled = false;
    this.infoMove = null;
    this.infoPinned = false;
  }

  /** The bag: a pocket tab strip over the active pocket's stacks. */
  private renderBagMenu(menu: Rect): void {
    this.menuPanel.setVisible(true);
    this.hideMoveChrome();
    this.hidePartyGrid();
    this.hideInfoControl();
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
        .setFillStyle(
          active ? FRLG_SELECTED_FILL.colour : FRLG_ROW_FILL.colour,
          active ? FRLG_SELECTED_FILL.alpha : FRLG_ROW_FILL.alpha,
        )
        .setStrokeStyle(
          1,
          active ? FRLG_SELECTED_STROKE.colour : FRLG_ROW_STROKE.colour,
          active ? FRLG_SELECTED_STROKE.alpha : FRLG_ROW_STROKE.alpha,
        )
        .setVisible(true);
      if (active) {
        // The active pocket carries a shape, not only a fill inversion (§10.1).
        this.marks.fillStyle(FRLG_SELECTED_STROKE.colour, 1);
        this.marks.fillRect(x, tabY + MENU_TAB_H - 2, MENU_TAB_W, 2);
      }
      tab.label
        .setText(bagCategoryLabel(category))
        .setTint(active ? FRLG_ACCENT : FRLG_INK)
        .setPosition(x + MENU_TAB_W / 2, tabY + 5)
        .setVisible(true);
    });
    // The rows of the other modes are not this one's: keep their objects dark.
    for (const row of this.menuRows) row.setVisible(false);
    for (const zone of this.menuZones) {
      zone.setData('item', -1);
      if (zone.input) zone.input.enabled = false;
    }

    // The filter field under the tabs, the route's own box and height.
    const filterX = menu.x + pad.x;
    const filterY = tabY + MENU_TAB_H + 8;
    const filterW = menu.w - pad.x * 2;
    this.bagSearchRect = { x: filterX, y: filterY, w: filterW, h: 24 };
    this.bagSearchBg.setPosition(filterX, filterY).setSize(filterW, 24).setVisible(true);
    const placeholder =
      this.bagSearchFocused || this.bagQuery.length > 0 ? this.bagQuery : t('hud.searchItems');
    this.bagSearchText
      .setText(`${this.bagSearchFocused ? '>' : ' '} ${placeholder}`)
      .setTint(this.bagQuery.length === 0 && !this.bagSearchFocused ? FRLG_MUTED : FRLG_INK)
      .setPosition(filterX + 6, filterY + 4)
      .setMaxWidth(filterW - 78)
      .setVisible(true);

    // The grid band: whatever the filter and the selected line leave between them.
    // The menu rect moves with the stage, so the metrics are recomputed here; the
    // cells themselves were built once and are only repositioned and repainted.
    const gridY = filterY + 24 + 8;
    const grid: Rect = {
      x: filterX,
      y: gridY,
      w: filterW,
      h: menu.y + menu.h - pad.bottom - MENU_BAG_DETAIL_H - MENU_BAG_DETAIL_GAP - gridY,
    };
    this.bagGridBand = grid;
    this.bagGrid = bagGridLayout(grid, this.bagStacks.length, {
      rows: MENU_BAG_ROWS,
      gap: BAG_GRID_GAP,
      maxCell: MENU_BAG_CELL_MAX,
    });
    this.paintBagCells();
    this.bagEmptyText
      .setPosition(grid.x + grid.w / 2, grid.y + grid.h / 2 - 8)
      .setVisible(this.bagStacks.length === 0);

    const selected = this.bagStacks[this.menuIndex];
    this.bagDetailText
      .setText(selected ? `${selected.item.name} x${selected.count}` : t('battle.noItems'))
      .setPosition(menu.x + pad.x, menu.y + menu.h - pad.bottom - MENU_BAG_DETAIL_H)
      .setVisible(true);

    const text = selected ? `${selected.item.name}\n${selected.item.shortDesc}` : '';
    this.bagInfoText = text;
    if (selected) {
      this.bagInfoPopup.show(
        { x: menu.x + pad.x, width: BAG_INFO_W, above: grid.y - BAG_INFO_GAP, below: grid.y },
        { text },
      );
    } else {
      this.bagInfoPopup.hide();
    }

    // The ◀ back control sits centred on the grid band's left edge, as in the grids.
    const backX = menu.x + pad.x + 14;
    const backY = (gridY + menu.y + menu.h - pad.bottom) / 2;
    this.backArrow.setVisible(true).setPosition(backX, backY);
    this.backZone.setPosition(backX - 12, backY - 18).setSize(48, 36);
    if (this.backZone.input) this.backZone.input.enabled = true;
  }

  /** Paints the ten grid cells from the drawn stacks and the cursor, and squares the zones. */
  private paintBagCells(): void {
    const grid = this.bagGrid;
    if (!grid) return;
    this.bagCells.forEach((cell, i) => {
      const rect = grid.cells[i];
      if (rect === undefined) return;
      const slot = this.bagStacks[i];
      cell.bg.setPosition(rect.x, rect.y).setSize(rect.w, rect.h).setVisible(true);
      if (slot === undefined) {
        cell.bg
          .setFillStyle(FRLG_ROW_FILL.colour, 0)
          .setStrokeStyle(1, FRLG_ROW_STROKE.colour, FRLG_ROW_STROKE.alpha * 0.4);
        cell.icon.setVisible(false);
        cell.badgeBg.setVisible(false);
        cell.badge.setText('').setVisible(false);
        return;
      }
      const selected = i === this.menuIndex;
      const fill = selected ? FRLG_SELECTED_FILL : FRLG_ROW_FILL;
      const stroke = selected ? FRLG_SELECTED_STROKE : FRLG_ROW_STROKE;
      cell.bg.setFillStyle(fill.colour, fill.alpha).setStrokeStyle(1, stroke.colour, stroke.alpha);
      const frame = itemIconFrame(slot.item.id);
      cell.icon.setVisible(frame !== null).setPosition(rect.x + rect.w / 2, rect.y + rect.h / 2);
      if (frame !== null) cell.icon.setFrame(frame);
      const badgeW = cell.badge
        .setText(`x${slot.count}`)
        .setPosition(rect.x + rect.w - 4, rect.y + rect.h - 18)
        .setVisible(true)
        .getTextBounds().global.width;
      cell.badgeBg
        .setSize(badgeW + 6, 16)
        .setPosition(rect.x + rect.w - 4 - badgeW - 3, rect.y + rect.h - 18)
        .setFillStyle(FRLG_SURFACE, 0.85)
        .setVisible(true);
    });
    this.bagZones.forEach((zone, i) => {
      const rect = grid.cells[i];
      if (rect === undefined) return;
      zone.setPosition(rect.x, rect.y).setSize(rect.w, rect.h).setVisible(true);
      if (zone.input) zone.input.enabled = true;
    });
  }

  /** True when a press lands on the bag's filter field. */
  private pointerOnBagSearch(pointer: Phaser.Input.Pointer): boolean {
    const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y, this.hitPoint);
    const rect = this.bagSearchRect;
    return (
      point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h
    );
  }

  /**
   * Routes a key into the bag's filter field while it holds focus: the route's
   * own rule, redrawing the pocket instead of a HUD panel.
   */
  private typeInBagSearch(event: KeyboardEvent): boolean {
    if (!this.bagSearchFocused) return false;
    if (event.key === 'Escape' || event.key === 'Enter') {
      this.bagSearchFocused = false;
    } else if (event.key === 'Backspace') {
      if (this.bagQuery.length === 0) return true;
      this.bagQuery = this.bagQuery.slice(0, -1);
    } else if (event.key.length === 1 && /[a-z0-9 '-]/i.test(event.key)) {
      this.bagQuery += event.key;
    } else {
      return true;
    }
    event.preventDefault();
    this.refreshBagItems();
    return true;
  }

  /**
   * Dev only: the bag grid as drawn, in canvas (pointer) coordinates. Null when
   * no bag is on screen.
   */
  bagDebugState(): BagGridDebugState | null {
    if (!IS_DEVELOP || this.mode !== 'bag' || !this.bagGrid) return null;
    const camera = this.cameras.main;
    const shift = (x: number, y: number, w: number, h: number): BagGridRect => ({
      x: x + camera.x,
      y: y + camera.y,
      w,
      h,
    });
    const rectOf = (rect: Phaser.Geom.Rectangle): BagGridRect =>
      shift(rect.x, rect.y, rect.width, rect.height);
    const cells = this.bagCells.map((cell, index) => {
      const slot = this.bagStacks[index];
      const selected =
        slot !== undefined &&
        cell.bg.fillColor === FRLG_SELECTED_FILL.colour &&
        cell.bg.fillAlpha === FRLG_SELECTED_FILL.alpha;
      return {
        index,
        itemId: slot?.item.id ?? null,
        count: slot?.count ?? 0,
        badge: cell.badge.text,
        iconFrame: cell.icon.visible ? Number(cell.icon.frame.name) : null,
        selected,
        fill: cell.bg.fillColor,
        fillAlpha: cell.bg.fillAlpha,
        stroke: cell.bg.strokeColor,
        strokeAlpha: cell.bg.strokeAlpha,
        rect: rectOf(cell.bg.getBounds()),
      };
    });
    // `InfoPopup` builds its window first, so the layer's first child is the card
    // the scene handed `show`; reading its bounds measures what is on screen.
    const card = this.bagInfoLayer.list[0] as Phaser.GameObjects.NineSlice;
    const cardBounds = card.getBounds();
    return {
      category: this.bagCategory,
      query: this.bagQuery,
      focused: this.bagSearchFocused,
      columns: this.bagGrid.columns,
      rows: this.bagGrid.rows,
      cellW: this.bagGrid.cellW,
      cellH: this.bagGrid.cellH,
      gap: this.bagGrid.gap,
      search: rectOf(this.bagSearchBg.getBounds()),
      grid: shift(this.bagGridBand.x, this.bagGridBand.y, this.bagGridBand.w, this.bagGridBand.h),
      tabs: this.bagCategories.map((category, slot) => ({
        category,
        rect: rectOf(this.bagTabs[slot].bg.getBounds()),
      })),
      cells,
      info: {
        visible: this.bagInfoPopup.visible,
        text: this.bagInfoText,
        x: cardBounds.x + camera.x,
        width: cardBounds.width,
      },
      footer: this.bagDetailText.text,
    };
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
        .setTint(FRLG_INK)
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
        zone
          .setPosition(menu.x + 10 + leftInset, top + i * ROW_H - 4)
          .setSize(menu.w - 20 - leftInset, ROW_H);
      }
    });
    this.menuCursor
      .setFlipX(false)
      .setScale(1)
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
    this.hideBagChrome();
    this.hideInfoControl();
    this.backArrow.setVisible(false);
    if (this.backZone.input) this.backZone.input.enabled = false;
  }

  /** Hides every piece of the bag window: tabs, filter, grid, cells and card. */
  private hideBagChrome(): void {
    for (const tab of this.bagTabs) {
      tab.bg.setVisible(false);
      tab.label.setVisible(false);
    }
    this.bagSearchBg.setVisible(false);
    this.bagSearchText.setVisible(false);
    this.bagEmptyText.setVisible(false);
    this.bagDetailText.setVisible(false);
    for (const cell of this.bagCells) {
      cell.bg.setVisible(false);
      cell.icon.setVisible(false);
      cell.badgeBg.setVisible(false);
      cell.badge.setVisible(false);
    }
    for (const zone of this.bagZones) {
      zone.setVisible(false);
      if (zone.input) zone.input.enabled = false;
    }
    this.bagInfoPopup.hide();
    this.bagInfoText = '';
    this.bagGrid = null;
  }

  /** Hovering a row moves the cursor onto it, like the arrow keys. */
  private onMenuHover(zone: Phaser.GameObjects.Zone): void {
    const index = zone.getData('item');
    if (typeof index !== 'number' || index < 0) return;
    const changed =
      this.megaSelected || this.gmaxSelected || this.infoSelected || index !== this.menuIndex;
    this.megaSelected = false;
    this.gmaxSelected = false;
    this.infoSelected = false;
    if (!changed) return;
    this.menuIndex = index;
    this.refreshHud();
  }

  /** Clicking a row selects it; in the moves grid a press on its ⓘ opens the info. */
  private onMenuClick(zone: Phaser.GameObjects.Zone, localX = -1, localY = -1): void {
    const index = zone.getData('item');
    if (typeof index !== 'number' || index < 0) return;
    if (
      this.mode === 'moves' &&
      localX >= 0 &&
      localY >= 0 &&
      this.moveInfoAt(zone.x + localX, zone.y + localY) === index
    ) {
      this.onInfoClick(index);
      return;
    }
    const item = this.menuItems[index];
    if (!item?.enabled) return;
    this.menuIndex = index;
    this.confirmMenu();
  }

  /**
   * The index of the move cell whose ⓘ button holds a point in the grid's own space
   * (the space `MoveGrid.layout` was given), or null when the point is not on one.
   */
  private moveInfoAt(x: number, y: number): number | null {
    const index = this.moveGrid.indexAt(x, y);
    if (index === null) return null;
    const rect = this.moveGrid.cellRect(index);
    if (rect === null) return null;
    return this.moveGrid.infoAt(index, x - rect.x, y - rect.y) ? index : null;
  }

  /** Floats the popup for the ⓘ under the live pointer, or drops an unpinned one. */
  private onMoveInfoHover(pointer: Phaser.Input.Pointer): void {
    if (this.mode !== 'moves') return;
    const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y, this.hitPoint);
    const index = this.moveInfoAt(point.x, point.y);
    if (index !== null) {
      this.onInfoHover(index);
      return;
    }
    if (this.infoMove !== null) this.onInfoOut(this.infoMove);
  }

  /** Drops an unpinned popup when the pointer leaves the canvas. */
  private clearMoveInfo(): void {
    if (this.infoMove !== null) this.onInfoOut(this.infoMove);
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
    this.gmaxSelected = false;
    this.refreshHud();
  }

  /** Clicking the MEGA control arms or disarms it. */
  private onMegaClick(): void {
    if (this.mode !== 'moves' || !this.megaAvailable()) return;
    this.megaSelected = true;
    this.gmaxSelected = false;
    this.toggleMega();
  }

  /** Hovering the G-MAX control moves the keyboard cursor onto it. */
  private onGmaxHover(): void {
    if (this.mode !== 'moves' || this.gmaxSelected || !this.gmaxAvailable()) return;
    this.gmaxSelected = true;
    this.megaSelected = false;
    this.refreshHud();
  }

  /** Clicking the G-MAX control arms or disarms it. */
  private onGmaxClick(): void {
    if (this.mode !== 'moves' || !this.gmaxAvailable()) return;
    this.gmaxSelected = true;
    this.megaSelected = false;
    this.toggleGmax();
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

  /** The `run` key on the moves grid: toggles the focused cell's ⓘ popup. */
  private toggleMoveInfo(): void {
    if (this.megaSelected || this.gmaxSelected) return;
    this.onInfoClick(this.menuIndex);
  }

  /** The ◀ control: leaves a submenu the same way cancel does. */
  private onBack(): void {
    if (this.mode === 'moves' || this.mode === 'party' || this.mode === 'bag') this.openMenu();
  }

  override update(_time: number, delta: number): void {
    if (this.mode !== 'feed') return;
    const rush = this.confirmKeys.some((key) => key.isDown);
    // A held confirm skips the capture beat whole before it can rush the frame.
    if (rush && this.captureTiming !== null) {
      this.finishCaptureBeat();
      return;
    }
    if (rush) this.completeTyping();
    else this.tickTyping(delta);
    // The read hold only starts once the line is fully revealed.
    if (!typewriterDone(this.typing)) {
      this.feedElapsed = 0;
      return;
    }
    this.feedElapsed += delta;
    if (this.feedElapsed >= (rush ? FAST_HOLD_MS : this.frameHoldMs)) this.advanceFeed();
  }
}
