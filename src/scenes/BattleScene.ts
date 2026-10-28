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
  chargingCommand,
  legalMoveIndices,
  replacementOwed,
  switchablePartyIndices,
  targetStepFor,
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
  battleTallies,
  launchTeamTypes,
  type BattleLaunch,
  type BattleOutcome,
  type BattleReturn,
} from '../engine/run';
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
  bagCategoryLabel,
  bagCategoryForKind,
  filterBagStacks,
  stepBagCursor,
  stepBagFocus,
  stepBagTab,
  type BagCategory,
  type BagFocus,
} from '../ui/bag';
import { battleFrames, type FeedFrame } from '../ui/feed';
import { statusAbbreviation } from '../ui/metrics';
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
import {
  battleBagBox,
  mountBattleBag,
  type BattleBagController,
  type BattleBagInput,
  type BattleBagIntent,
} from '../ui/hud/panels/battle-bag';
import {
  battleCommandBox,
  mountBattleCommand,
  type BattleCommandController,
  type BattleCommandInput,
  type BattleCommandIntent,
  type BattleCommandRowId,
} from '../ui/hud/panels/battle-command';
import { mountBattleHp, type BattleHpController } from '../ui/hud/panels/battle-hp';
import {
  battleMovesBox,
  mountBattleMoves,
  type BattleMovesController,
  type BattleMovesInput,
  type BattleMovesIntent,
} from '../ui/hud/panels/battle-moves';
import {
  battleSwitchBox,
  installBattleSwitchPreview,
  mountBattleSwitch,
  type BattleSwitchController,
  type BattleSwitchInput,
  type BattleSwitchIntent,
} from '../ui/hud/panels/battle-switch';
import {
  BATTLE_LOG_DWELL_MS,
  battleLogPreviewRequested,
  feedStep,
  installBattleLogPreview,
  liveBattleLogView,
  mountBattleLog,
  type BattleLogHandle,
} from '../ui/hud/panels/battle-log';
import { syncHud } from '../ui/hud/state';
import { actionKeys, subscribeKeybinds } from '../input/input';
import { playCry, playCue, playMoveSound, playMusic } from '../audio/audio';
import { battleInfoLines, battleInfoRows } from '../ui/battleInfo';
import { MoveGrid, padMoveGridCells, stepMoveGridCursor, type MoveGridCell } from '../ui/moveGrid';
import { partyGridFieldRows, stepPartyCursor } from '../ui/partyGrid';
import { BATTLE_MON_TEXTURE_KEY, BATTLE_PLATFORM_TEXTURE_KEY } from './BootScene';
import { t } from '../i18n';
import { moveName, moveShortDescription } from '../i18n/content';
import type { RouteScene } from './RouteScene';

/** How long the win / loss / catch line stays up before the battle closes itself. */
const OUTCOME_HOLD_MS = 1300;
const PANEL_W = 320;
const PLAYER_PANEL_W = 320;
/** Tall enough for the padded name row, the types band and the bar; the foe's height. */
const PLAYER_PANEL_H = 150;
const FOE_PANEL = { w: PANEL_W, h: 150 } as const;
const FOE_PLATFORM_SPREAD = 96;
/** The battle plays inside a centred square, at most this many pixels a side. */
const MAX_BATTLE_SIZE = 900;
/** Below this square side the stacked, full-width phone layout is used. */
const COMPACT_SIZE = 700;
/** The bag grid: five fixed columns over two rows of square icon cells. */
const MENU_BAG_ROWS = 2;
const MENU_BAG_CAP = MENU_BAG_ROWS * BAG_GRID_COLS;
/** The FIGHT / BAG / SWITCH / RUN grid: 2 columns, one gap and one inset. */
const MENU_GRID_COLS = 2;
/**
 * The command each row of `menuItems` is, by the mode that built the list: the lead
 * offers four and the partner only FIGHT and SWITCH. Keyed by mode, never matched
 * against a translated label, so a locale can never reorder the intent channel.
 */
const COMMAND_IDS: Readonly<Record<'menu' | 'partner', readonly BattleCommandRowId[]>> = {
  menu: ['fight', 'bag', 'switch', 'run'],
  partner: ['fight', 'switch'],
};
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

/** A move slot index clamped into `0 … count - 1`, or null when there is no slot. */
function moveIndexIn(value: number, count: number): number | null {
  if (!Number.isFinite(value) || count <= 0) return null;
  return Math.min(Math.max(0, Math.trunc(value)), count - 1);
}
/** Frames per second for the idle loop; Anil animates at roughly 30ms a frame. */
const MON_ANIM_FPS = 30;
/**
 * The frame indices one sheet's idle loop draws: the manifest row's frames,
 * clamped to the frames the loaded texture actually has. `0` available frames is
 * a texture that never loaded (a tree without the pack), and answers an empty
 * list so no animation is registered for it — a frame-less Phaser animation
 * throws when it is played (`Animation.getFirstTick`).
 */
export function monIdleFrames(manifestFrames: number, textureFrameTotal: number): readonly number[] {
  const wanted = Math.trunc(manifestFrames);
  const available = Math.trunc(textureFrameTotal);
  if (!Number.isFinite(wanted) || !Number.isFinite(available)) return [];
  if (wanted < 1 || available < 1) return [];
  return Array.from({ length: Math.min(wanted, available) }, (_, frame) => frame);
}

installBattleSwitchPreview(typeof window === 'undefined' ? '' : window.location.search);
installBattleLogPreview(typeof window === 'undefined' ? '' : window.location.search);

type Mode =
  'entry' | 'feed' | 'menu' | 'partner' | 'moves' | 'target' | 'bag' | 'party' | 'over' | 'info';

/** A sprite beat that owns the mon's position/scale until it completes. */
type BeatKind = 'faint' | 'switch';

/**
 * The objects one HP window draws into: a side's slot 0 uses the shipped set and
 * slot 1 its own, built the same way, so `drawPanel` paints both identically.
 */
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
  private frameHoldMs: number = BATTLE_LOG_DWELL_MS;
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

  private bgTop!: Phaser.GameObjects.Rectangle;
  private bgBottom!: Phaser.GameObjects.Rectangle;
  /** True while the keyboard cursor sits on the Mega control instead of a move. */
  private megaSelected = false;
  /** True while the keyboard cursor sits on the G-Max control instead of a move. */
  private gmaxSelected = false;
  /** True while the keyboard cursor sits on the INFO control instead of a command cell. */
  private infoSelected = false;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private foeSprite!: Phaser.GameObjects.Sprite;
  /** The second slot's sprites: hidden in a single battle, drawn on the same field. */
  private playerSprite2!: Phaser.GameObjects.Sprite;
  private foeSprite2!: Phaser.GameObjects.Sprite;
  /** The mounted DOM HP boxes (`?hud=dom`) and the controller `refreshHud` pushes to. */
  private hpController: BattleHpController | null = null;
  /** The mounted DOM move menu (`?hud=dom`) and the controller `refreshHud` pushes to. */
  private movesController: BattleMovesController | null = null;
  /** The mounted DOM command window (`?hud=dom`) and the controller `refreshHud` pushes to. */
  private commandController: BattleCommandController | null = null;
  /** The mounted DOM bag (`?hud=dom`) and the controller `refreshHud` pushes to. */
  private bagController: BattleBagController | null = null;
  /** The mounted DOM switch grid (`?hud=dom`) and the controller `refreshHud` pushes to. */
  private switchController: BattleSwitchController | null = null;
  /** The mounted DOM message box (`?hud=dom`) and the line `refreshHud` pushes to it. */
  private logController: BattleLogHandle | null = null;
  private foeTrainer!: Phaser.GameObjects.Image;
  private moveFxSprite!: Phaser.GameObjects.Sprite;
  private captureBall!: Phaser.GameObjects.Image;
  private playerPlatform!: Phaser.GameObjects.Image;
  private foePlatform!: Phaser.GameObjects.Image;
  /** The shared moves grid and its floating info popup, drawn in the moves mode. */
  private moveGrid!: MoveGrid;
  /** The move whose info popup is up, or null; `infoPinned` keeps it up on click. */
  private infoMove: number | null = null;
  private infoPinned = false;
  /** A reusable world point for the live-pointer hit test (no per-frame allocation). */
  private readonly hitPoint = new Phaser.Math.Vector2();

  private menuItems: readonly MenuItem[] = [];
  private menuIndex = 0;

  /** The bag's pockets (consumable, and balls while a wild can be caught). */
  private bagCategories: readonly BagCategory[] = ['consumable'];
  private bagCategory: BagCategory = 'consumable';
  /** Where the bag's cursor sits: the pocket row or the stack grid. */
  private bagFocus: BagFocus = 'grid';
  /** The pocket's drawn stacks (filtered, capped), which `menuIndex` walks. */
  private bagStacks: readonly BagSlot[] = [];
  private bagQuery = '';
  private bagSearchFocused = false;

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
    this.frameHoldMs = BATTLE_LOG_DWELL_MS;
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
      teamTypes: launchTeamTypes(launch),
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
      this.disposeHpPanel();
      this.disposeMovesPanel();
      this.disposeCommandPanel();
      this.disposeBagPanel();
      this.disposeSwitchPanel();
      this.disposeBattleLogPanel();
      if (IS_DEVELOP) delete (globalThis as Record<string, unknown>).__pkmBattle;
    });
    this.mountHpPanel();
    this.mountMovesPanel();
    this.mountBattleCommandPanel();
    this.mountBagPanel();
    this.mountSwitchPanel();
    this.mountBattleLogPanel();
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

  /** Which sides field a second active right now — the same fields the second window reads. */
  private doublesInPlay(): Readonly<{ enemy: boolean; player: boolean }> {
    return {
      enemy: this.displayActive2.enemy !== null,
      player: this.displayActive2.player !== null,
    };
  }

  /** Mounts the DOM HP boxes into the HUD layer, once per battle (`?hud=dom`). */
  private mountHpPanel(): void {
    if (typeof document === 'undefined') return;
    const host = document.getElementById('hud');
    if (host === null) return;
    this.disposeHpPanel();
    this.hpController = mountBattleHp(host, this.doublesInPlay(), {
      width: this.scale.width,
      height: this.scale.height,
    });
  }

  private disposeHpPanel(): void {
    if (this.hpController === null) return;
    this.hpController.dispose();
    this.hpController = null;
  }

  /** Mounts the DOM move menu into the HUD layer, once per battle (`?hud=dom`). */
  private mountMovesPanel(): void {
    if (typeof document === 'undefined') return;
    const host = document.getElementById('hud');
    if (host === null) return;
    this.disposeMovesPanel();
    this.movesController = mountBattleMoves(host, (intent) => this.onBattleMoveIntent(intent));
  }

  private disposeMovesPanel(): void {
    if (this.movesController === null) return;
    this.movesController.dispose();
    this.movesController = null;
  }

  /** Mounts the DOM command window into the HUD layer, once per battle (`?hud=dom`). */
  private mountBattleCommandPanel(): void {
    if (typeof document === 'undefined') return;
    const host = document.getElementById('hud');
    if (host === null) return;
    this.disposeCommandPanel();
    this.commandController = mountBattleCommand(host, (intent) => this.onBattleCommandIntent(intent));
  }

  private disposeCommandPanel(): void {
    if (this.commandController === null) return;
    this.commandController.dispose();
    this.commandController = null;
  }

  /** Mounts the DOM bag into the HUD layer, once per battle (`?hud=dom`). */
  private mountBagPanel(): void {
    if (typeof document === 'undefined') return;
    const host = document.getElementById('hud');
    if (host === null) return;
    this.disposeBagPanel();
    this.bagController = mountBattleBag(host, (intent) => this.onBattleBagIntent(intent));
  }

  private disposeBagPanel(): void {
    if (this.bagController === null) return;
    this.bagController.dispose();
    this.bagController = null;
  }

  /** Mounts the DOM switch grid into the HUD layer, once per battle (`?hud=dom`). */
  private mountSwitchPanel(): void {
    if (typeof document === 'undefined') return;
    const host = document.getElementById('hud');
    if (host === null) return;
    this.disposeSwitchPanel();
    this.switchController = mountBattleSwitch(host, (intent) => this.onBattleSwitchIntent(intent));
  }

  private disposeSwitchPanel(): void {
    if (this.switchController === null) return;
    this.switchController.dispose();
    this.switchController = null;
  }

  /** Mounts the DOM message box into the HUD layer, once per battle (`?hud=dom`). */
  private mountBattleLogPanel(): void {
    if (typeof document === 'undefined') return;
    // The fixture preview paints its own frame and owns the layer; the scene steps aside.
    if (battleLogPreviewRequested(window.location.search)) return;
    const host = document.getElementById('hud');
    if (host === null) return;
    this.disposeBattleLogPanel();
    this.logController = mountBattleLog(host, liveBattleLogView(false, null));
  }

  private disposeBattleLogPanel(): void {
    if (this.logController === null) return;
    this.logController.dispose();
    this.logController = null;
  }

  /**
   * Pushes the line the typewriter is revealing to the DOM message box. The box is
   * the canvas `messagePanel`'s visibility rule exactly: open while no menu owns it,
   * and the closed box carries no line.
   */
  private updateBattleLog(): void {
    const controller = this.logController;
    if (controller === null) return;
    const menuOpen = this.menuItems.length > 0;
    controller.update(liveBattleLogView(!menuOpen, menuOpen ? null : visibleText(this.typing)));
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
  private onPointerDown(objects: readonly Phaser.GameObjects.GameObject[]): void {
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
      this.onGridBack();
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
    this.frameHoldMs = BATTLE_LOG_DWELL_MS;
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
    // A charging fighter answers its own second turn: the engine locks the move and
    // discards a command anyway, so no menu is opened for it.
    if (!this.double) {
      const locked = chargingCommand(this.state, 'player');
      if (locked) {
        this.submit(locked);
        return;
      }
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
    this.frameHoldMs = timeline.totalMs + BATTLE_LOG_DWELL_MS;
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
    this.frameHoldMs = BATTLE_LOG_DWELL_MS;
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

  /**
   * One looping idle animation per loaded sheet, off the strip's own frame count.
   * The frames are clamped to the texture's real `frameTotal`: a sheet whose URL
   * 404s (a tree without the pack) is absent from the texture cache and gets no
   * animation at all, because a frame-less Phaser animation throws when played.
   */
  private buildMonAnimations(): void {
    for (const sheet of this.battleSheets()) {
      const key = pokemonIdleAnimKey(sheet);
      if (this.anims.exists(key)) continue;
      const available = this.textures.exists(sheet.textureKey)
        ? this.textures.get(sheet.textureKey).frameTotal
        : 0;
      const frames = monIdleFrames(sheet.frames, available);
      if (frames.length === 0) continue;
      this.anims.create({
        key,
        frames: frames.map((frame) => ({ key: sheet.textureKey, frame })),
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
    if (!this.textures.exists(sheet.textureKey)) return;
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
    if (!this.anims.exists(anim)) return;
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
      tallies: battleTallies(this.state.log, this.state.sides.player.party),
    };
    const route = this.scene.get('Route') as RouteScene;
    this.scene.setVisible(true, 'Route');
    route.applyBattleResult(result);
    this.scene.resume('Route');
    this.scene.stop();
  }

  // --- menus --------------------------------------------------------------

  /**
   * The mode a back press opens from the scene's grids, without performing it: the
   * switch grid while the player owes a replacement, the command grid otherwise.
   */
  backPressMode(): Mode {
    if (this.mode !== 'moves' && this.mode !== 'bag' && this.mode !== 'party') return this.mode;
    return replacementOwed(this.state) ? 'party' : 'menu';
  }

  /** The one path both back controls take out of a grid (Esc and ◀). */
  private onGridBack(): void {
    if (this.backPressMode() === 'party') {
      this.forcedSwitch = true;
      this.openParty();
      return;
    }
    this.openMenu();
  }

  private openMenu(): void {
    // A replacement is owed: the switch grid is the only menu a back press can
    // reach, so no command grid is built before the send-out.
    if (replacementOwed(this.state)) {
      this.forcedSwitch = true;
      this.openParty();
      return;
    }
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
    const fighter = activeFighter(this.state, 'player', slot);
    const move = getMove(fighter.moves[moveIndex]?.moveId ?? '') ?? null;
    if (targetStepFor(this.state, 'player', move)) {
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
    this.bagFocus = 'grid';
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
   * A click on a grid cell selects it and spends it, exactly as `confirm` does on
   * the selected stack: one press, one use. A press on an empty cell — past the
   * last stack — only does nothing.
   */
  private selectBagCell(index: number): void {
    if (index < 0 || index >= this.bagStacks.length) return;
    this.menuIndex = index;
    const item = this.menuItems[index];
    if (item?.enabled) {
      item.onSelect();
      return;
    }
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

  /**
   * Steps the cursor: the command and move grids move in 2D, other lists stay
   * linear. A disabled command or switch row is reachable and `confirm` refuses
   * it; only the moves grid's skip keeps a disabled move out of reach.
   */
  private navigateMenu(action: 'up' | 'down' | 'left' | 'right'): void {
    if (this.mode === 'target') {
      this.moveTarget(action === 'left' || action === 'up' ? -1 : 1);
      return;
    }
    if (this.mode === 'bag') {
      const step = stepBagFocus(this.bagFocus, this.menuIndex, action, this.bagStacks.length);
      this.bagFocus = step.focus;
      this.menuIndex = step.index;
      // On the pocket row a sideways press cycles the pockets on offer, wrapping;
      // `selectBagTab` resets the grid cursor to the first stack it can show.
      if (step.focus === 'tabs' && (action === 'left' || action === 'right')) {
        const category = stepBagTab(this.bagCategories, this.bagCategory, action);
        const slot = this.bagCategories.indexOf(category);
        if (slot >= 0 && category !== this.bagCategory) {
          this.selectBagTab(slot);
          return;
        }
      }
      this.refreshHud();
      return;
    }
    if (this.mode === 'moves' || this.mode === 'menu' || this.mode === 'partner') {
      this.moveMenuGrid(action);
      return;
    }
    if (this.mode === 'party') {
      const next = stepPartyCursor(
        this.menuIndex,
        action === 'up' || action === 'left' ? -1 : 1,
        this.menuItems.length,
      );
      if (next !== this.menuIndex) {
        this.menuIndex = next;
        this.refreshHud();
      }
      return;
    }
    this.moveMenu(action === 'up' || action === 'left' ? -1 : 1);
  }

  /**
   * Moves the cursor across the 2x2 moves grid, skipping disabled moves; the
   * command and partner grids step onto a disabled cell and leave the refusal to
   * `confirm`. A direction that would leave a partial last row clamps back into
   * it, so with three moves `down` still lands on the third.
   */
  private moveMenuGrid(action: 'up' | 'down' | 'left' | 'right'): void {
    const count = this.menuItems.length;
    if (count === 0) return;
    const cols = MENU_GRID_COLS;
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

    const col = this.menuIndex % cols;
    if (action === 'right' && (mega || gmax) && (col === cols - 1 || this.menuIndex === count - 1)) {
      if (gmax) this.gmaxSelected = true;
      else this.megaSelected = true;
      this.refreshHud();
      return;
    }
    if (action === 'right' && info && (col === cols - 1 || this.menuIndex === count - 1)) {
      this.infoSelected = true;
      this.refreshHud();
      return;
    }

    const next = stepMoveGridCursor(
      this.menuIndex,
      action,
      this.menuItems.map((item) => item.enabled),
      MENU_GRID_COLS,
      this.mode === 'moves',
    );
    if (next === this.menuIndex) return;
    this.menuIndex = next;
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
    this.updateBattleLog();
  }

  /** Starts revealing a message at the player's text speed. */
  private typeMessage(text: string): void {
    this.typing = beginTypewriter(text);
    this.typingRemainder = 0;
    this.updateBattleLog();
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
    this.updateBattleLog();
  }

  /** Skips to the end of the line (a confirm tap, or confirm held). */
  private completeTyping(): void {
    if (typewriterDone(this.typing)) return;
    this.typing = revealAll(this.typing);
    this.updateBattleLog();
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

    let box: Rect;
    let foeInfo: Rect;
    let playerInfo: Rect;
    let menu: Rect;
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

    menu = { x: box.x, y: box.y, w: box.w, h: box.h };

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

    // The one emit point (`D49`): the DOM boxes paint the snapshot while the canvas
    // keeps the arena. It runs after the whole layout, because the combatants' caps
    // and positions above are read by the arena, not by the boxes.
    syncHud(
      { screen: 'battle', battle: this.state, canCapture: this.launch?.canCapture === true },
      (next) => this.hpController?.update(next),
    );
    this.movesController?.update(this.battleMovesInput(menu));
    this.commandController?.update(this.battleCommandInput(menu));
    this.bagController?.update(this.battleBagInput(menu));
    this.switchController?.update(this.battleSwitchInput(menu));
    this.updateBattleLog();
  }

  /**
   * The second slot's window on a side, or nothing when the battle does not field
   * it (the shipped single layout, reached through the same code).
   */

  /** Counts the visible objects of the four HP kits: the `?hud=dom` flag contract's probe. */
  hpDrawnObjectCount(): number {
    return 0;
  }

  /**
   * Counts the visible objects the move menu owns: the window, the ◀, the two forme
   * columns and the grid's laid-out cells. The `?hud=dom` flag contract's probe.
   */
  movesDrawnObjectCount(): number {
    return 0;
  }

  /**
   * Counts the visible objects the bag owns: the ◀, the filter field, the selected
   * line and the pocket's tabs and cells. The `?hud=dom` flag contract's probe.
   */
  bagDrawnObjectCount(): number {
    return 0;
  }

  /**
   * Counts the message box's visible objects: the glass window and its text. The
   * `?hud=dom` flag contract's probe.
   */
  logDrawnObjectCount(): number {
    return 0;
  }

  /**
   * Counts the visible objects the switch grid owns: the window, the ◀, the cells,
   * avatars, labels, bars, fills and the detail window with its contents. The
   * `?hud=dom` flag contract's probe.
   */
  switchDrawnObjectCount(): number {
    return 0;
  }

  /**
   * The DOM command window's state: the card `battleCommandBox` derives from the
   * viewport the camera viewport sits in, and the commands this scene offers.
   */
  private battleCommandInput(menu: Rect): BattleCommandInput {
    // `battleMovesBox` already folds the camera viewport's origin into the card, so
    // it reads the canvas the camera is placed in, never the stage square it centres.
    const derived = battleCommandBox({ width: this.scale.width, height: this.scale.height });
    // Before the first layout the stage has no size; the canvas's own rect is then
    // the only card there is, and an open window must still land somewhere.
    const card = derived.w > 0 && derived.h > 0 ? derived : menu;
    const ids = COMMAND_IDS[this.mode === 'partner' ? 'partner' : 'menu'];
    return {
      open: this.mode === 'menu' || this.mode === 'partner',
      card: { x: card.x, y: card.y, w: card.w, h: card.h },
      rows: this.menuItems.map((item, index) => ({
        id: ids[index] ?? 'fight',
        label: item.label,
        enabled: item.enabled,
      })),
      selected: this.menuIndex,
      infoSelected: this.infoSelected,
      infoLabel: t('battle.infoControl'),
    };
  }

  /**
   * The DOM command window's only receiver: hover moves the cursor exactly as
   * `onMenuHover` does, and a press lands on the `confirmMenu` the canvas row's
   * click already takes — a dimmed row is accepted here and refused there.
   */
  private onBattleCommandIntent(intent: BattleCommandIntent): void {
    if (this.mode !== 'menu' && this.mode !== 'partner') return;
    switch (intent.type) {
      case 'hover': {
        const index = moveIndexIn(intent.index, this.menuItems.length);
        if (index === null) return;
        const changed =
          this.megaSelected || this.gmaxSelected || this.infoSelected || index !== this.menuIndex;
        this.megaSelected = false;
        this.gmaxSelected = false;
        this.infoSelected = false;
        if (!changed) return;
        this.menuIndex = index;
        this.refreshHud();
        return;
      }
      case 'press': {
        const index = moveIndexIn(intent.index, this.menuItems.length);
        if (index === null) return;
        this.menuIndex = index;
        this.infoSelected = false;
        this.confirmMenu();
        return;
      }
      case 'info': {
        this.infoSelected = true;
        this.openInfo();
        return;
      }
    }
  }

  /**
   * The moves menu's four slots as the canvas's own cells, built once so the DOM
   * card and the grid can never read different data.
   */
  private moveCells(): readonly MoveGridCell[] {
    return this.menuItems.map((item) => ({
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
  }

  /**
   * The DOM card's state: the card `battleMovesBox` derives from the viewport the
   * camera viewport sits in, and the cells and indices this scene already owns.
   */
  private battleMovesInput(menu: Rect): BattleMovesInput {
    const derived = battleMovesBox({ width: this.scale.width, height: this.scale.height });
    // Before the first layout the stage has no size; the canvas's own rect is then
    // the only card there is, and an open menu must still land somewhere.
    const card = derived.w > 0 && derived.h > 0 ? derived : menu;
    return {
      open: this.mode === 'moves' || this.mode === 'target',
      target:
        this.mode === 'target' && this.targetSlot !== null
          ? (this.slotFighter('enemy', this.targetSlot)?.name ?? null)
          : null,
      card,
      cells: padMoveGridCells(this.moveCells(), MAX_MOVES),
      selected: this.megaSelected || this.gmaxSelected ? -1 : this.menuIndex,
      info: this.infoMove,
      mega: this.megaAvailable(),
      gmax: this.gmaxAvailable(),
      megaArmed: this.megaIntent,
      gmaxArmed: this.gmaxIntent,
    };
  }

  /**
   * The DOM card's only receiver: every intent lands on the call the canvas already
   * made, so a press and a key reach the same engine command.
   */
  private onBattleMoveIntent(intent: BattleMovesIntent): void {
    switch (intent.type) {
      case 'move': {
        if (this.mode !== 'moves') return;
        const index = moveIndexIn(intent.moveIndex, this.menuItems.length);
        if (index === null || !this.menuItems[index]?.enabled) return;
        this.menuIndex = index;
        this.chooseMove(this.commandSlot, index);
        return;
      }
      case 'info': {
        if (this.mode !== 'moves') return;
        const index =
          intent.moveIndex === null ? null : moveIndexIn(intent.moveIndex, this.menuItems.length);
        this.infoMove = index;
        this.infoPinned = index !== null;
        this.refreshHud();
        return;
      }
      case 'mega': {
        this.toggleMega();
        this.refreshHud();
        return;
      }
      case 'gmax': {
        this.toggleGmax();
        this.refreshHud();
        return;
      }
      case 'back': {
        this.onBack();
        return;
      }
    }
  }

  /**
   * The DOM bag's state: the card `battleBagBox` derives from the viewport the
   * camera viewport sits in, and the pockets, stacks and cursor this scene owns.
   */
  private battleBagInput(menu: Rect): BattleBagInput {
    const derived = battleBagBox({ width: this.scale.width, height: this.scale.height });
    // Before the first layout the stage has no size; the canvas's own rect is then
    // the only card there is, and an open bag must still land somewhere.
    const card = derived.w > 0 && derived.h > 0 ? derived : menu;
    const selected = this.bagStacks[this.menuIndex];
    return {
      open: this.mode === 'bag',
      card,
      tabs: this.bagCategories.map((category) => ({
        category,
        label: bagCategoryLabel(category),
        active: category === this.bagCategory,
      })),
      query: this.bagQuery,
      focused: this.bagSearchFocused,
      rows: this.bagStacks.map((slot) => ({
        itemId: slot.item.id,
        name: slot.item.name,
        count: slot.count,
      })),
      selected: this.menuIndex,
      detail: selected ? `${selected.item.name} x${selected.count}` : t('battle.noItems'),
      info: selected ? { text: `${selected.item.name}\n${selected.item.shortDesc}` } : null,
      empty: this.bagStacks.length === 0 ? t('battle.noItems') : null,
    };
  }

  /**
   * The DOM bag's only receiver: every intent lands on the call the canvas already
   * made, so a press and a key reach the same engine command.
   */
  private onBattleBagIntent(intent: BattleBagIntent): void {
    switch (intent.type) {
      case 'tab': {
        if (this.mode !== 'bag') return;
        this.selectBagTab(this.bagCategories.indexOf(intent.category));
        return;
      }
      case 'select': {
        if (this.mode !== 'bag') return;
        this.selectBagCell(intent.index);
        return;
      }
      case 'use': {
        if (this.mode !== 'bag') return;
        const index = this.bagStacks.findIndex((slot) => slot.item.id === intent.itemId);
        if (index < 0) return;
        if (!this.usableBag().some((slot) => slot.item.id === intent.itemId)) return;
        this.menuIndex = index;
        this.submit({ type: 'bag', itemId: intent.itemId });
        return;
      }
      case 'search': {
        if (this.mode !== 'bag') return;
        this.bagQuery = intent.query;
        this.refreshBagItems();
        return;
      }
      case 'focus': {
        this.bagSearchFocused = intent.focused;
        this.refreshHud();
        return;
      }
      case 'scroll': {
        if (this.mode !== 'bag') return;
        this.menuIndex = stepBagCursor(this.menuIndex, intent.delta, this.bagStacks.length);
        this.refreshHud();
        return;
      }
      case 'back': {
        this.onBack();
        return;
      }
    }
  }

  /**
   * The DOM switch grid's state: the card `battleSwitchBox` derives, and the party this
   * scene owns — one plain row per member, never a `BattleFighter`.
   */
  private battleSwitchInput(menu: Rect): BattleSwitchInput {
    const derived = battleSwitchBox({ width: this.scale.width, height: this.scale.height });
    // Before the first layout the stage has no size; the canvas' own rect is then
    // the only card there is, and an open grid must still land somewhere.
    const card = derived.w > 0 && derived.h > 0 ? derived : menu;
    if (this.mode !== 'party') return { open: false, card, rows: [], selected: 0 };
    const side = this.state.sides.player;
    const switchable = switchablePartyIndices(this.state, 'player');
    const fieldRows = this.double ? partyGridFieldRows(side.activeIndex, side.secondActiveIndex) : [];
    return {
      open: true,
      card,
      selected: this.menuIndex,
      rows: side.party.slice(0, MAX_PARTY_SIZE).map((fighter, index) => ({
        name: fighter.name,
        level: fighter.level,
        hp: fighter.hp,
        maxHp: fighter.maxHp,
        statusLabel: statusAbbreviation(fighter.status),
        enabled: switchable.includes(index),
        field: fieldRows.includes(index),
      })),
    };
  }

  /**
   * The DOM switch grid's only receiver: every intent lands on the call the canvas
   * already made, so a press and a key reach the same engine command — and the
   * send-out beat stays the feed's (`playSwitch`), never the card's.
   */
  private onBattleSwitchIntent(intent: BattleSwitchIntent): void {
    switch (intent.type) {
      case 'switch': {
        if (this.mode !== 'party') return;
        const index = moveIndexIn(intent.index, this.state.sides.player.party.length);
        if (index === null) return;
        if (!switchablePartyIndices(this.state, 'player').includes(index)) return;
        this.menuIndex = index;
        this.confirmParty(index);
        return;
      }
      case 'back': {
        if (this.mode !== 'party') return;
        this.onBack();
        return;
      }
    }
  }

  /**
   * Swallows every key while the bag's field holds focus: the native input owns
   * the text, so nothing typed here reaches the battle underneath.
   */
  private typeInBagSearch(event: KeyboardEvent): boolean {
    if (!this.bagSearchFocused) return false;
    if (event.key === 'Escape' || event.key === 'Enter') this.bagSearchFocused = false;
    return true;
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
    if (this.mode === 'moves' || this.mode === 'party' || this.mode === 'bag') this.onGridBack();
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
    // The read hold only starts once the line is fully revealed, and a held confirm
    // advances on the 45 ms floor instead of the frame's own dwell.
    const step = feedStep(typewriterDone(this.typing), this.feedElapsed, this.frameHoldMs, rush, delta);
    this.feedElapsed = step.elapsedMs;
    if (step.advance) this.advanceFeed();
  }
}

/**
 * The number of display objects the HP boxes draw right now: 0 under `?hud=dom`,
 * where the four kits are built but never shown. The live flag contract reads it
 * with `(await import('/src/scenes/BattleScene.ts')).battleHpDrawnObjectCount(...)`.
 */
export function battleHpDrawnObjectCount(scene: BattleScene): number {
  return scene.hpDrawnObjectCount();
}

/**
 * The number of display objects the move menu draws right now: 0 under `?hud=dom`,
 * where the card is the DOM one and the grid, the ◀ and the forme columns are dark.
 */
export function battleMovesDrawnObjectCount(scene: BattleScene): number {
  return scene.movesDrawnObjectCount();
}

/** The display objects the bag draws right now: 0 under `?hud=dom`. */
export function battleBagDrawnObjectCount(scene: BattleScene): number {
  return scene.bagDrawnObjectCount();
}

/** The display objects the switch grid draws right now: 0 under `?hud=dom`. */
export function battleSwitchDrawnObjectCount(scene: BattleScene): number {
  return scene.switchDrawnObjectCount();
}

/**
 * The mode a back press opens from the scene's current mode, without performing
 * it: `'party'` while the player owes a replacement, `'menu'` otherwise. The live
 * flag contract reads it with
 * `(await import('/src/scenes/BattleScene.ts')).battleBackPressMode(...)`.
 */
export function battleBackPressMode(scene: BattleScene): string {
  return scene.backPressMode();
}

/**
 * The number of display objects the message box draws right now: 0 under `?hud=dom`,
 * where the box is the `battle-log` card. The live flag contract reads it with
 * `(await import('/src/scenes/BattleScene.ts')).battleLogDrawnObjectCount(...)`.
 */
export function battleLogDrawnObjectCount(scene: BattleScene): number {
  return scene.logDrawnObjectCount();
}
