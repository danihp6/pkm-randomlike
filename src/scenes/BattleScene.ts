import Phaser from 'phaser';
import { getMove } from '../data/dex';
import { getItem } from '../data/items';
import { ITEM_ICON_TEXTURE_KEY, itemIconFrame } from '../data/itemIcons';
import { type Keybinds } from '../data/keybinds';
import { POKEMON_SPRITE_SHEETS, pokemonSpriteFrame } from '../data/pokemonSprites';
import { getTrainerArchetype } from '../data/trainers';
import { TRAINER_SPRITE_TEXTURE_KEY, trainerSpriteFrame } from '../data/trainerSprites';
import { legalMoveIndices, type Command } from '../engine/battle/commands';
import { createFighter, restoreFighter, snapshotFighter, type BattleFighter, type StatusId } from '../engine/battle/fighter';
import { chooseAiCommand } from '../engine/battle/ai';
import { canRun } from '../engine/battle/runAway';
import type { BattleEvent } from '../engine/battle/state';
import {
  activeFighter,
  autoReplace,
  createBattle,
  needsReplacement,
  performSwitch,
  takeTurn,
  type BattleState,
  type SideId,
} from '../engine/battle';
import { Rng } from '../engine/rng';
import { MAX_PARTY_SIZE, experienceFraction, type BattleLaunch, type BattleOutcome, type BattleReturn } from '../engine/run';
import { PORTRAIT_SIZE, PORTRAIT_TEXTURE_KEY, portraitFrameFor } from '../data/portraits';
import { MOVE_FX_TEXTURE_KEY, moveFxAnimKey, moveFxFor, moveFxTrack } from '../render/moveFx';
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
import { addFrlgHpBar, addFrlgWindow, FRLG_CURSOR_KEY, FRLG_HPBAR, FRLG_TEXTBOX_PADDING, FRLG_WINDOW_PADDING } from '../ui/frlg';
import { FRLG_INK, FRLG_FONT_SIZE, addFrlgText } from '../ui/frlgFont';
import { typeColor, typeTint } from '../ui/typeColors';
import { BATTLE_MON_TEXTURE_KEY, BATTLE_PLATFORM_TEXTURE_KEY } from './BootScene';
import {
  MOVE_CATEGORY_ICON_W,
  MOVE_CATEGORY_TEXTURE_KEY,
  categoryIconFrame,
} from '../data/moveCategoryIcons';
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
/** The moves menu is a grid so all four moves show at once, with no scrolling. */
const MENU_GRID_COLS = 2;
const MENU_GRID_GAP = 8;
/** Width reserved at the left of the moves grid for the ◀ back control. */
const MOVE_BACK_COL = 46;
/** Inner padding of a moves cell, and the inset of the whole grid in the window. */
const MOVE_CELL_PAD = 14;
const MOVE_GRID_INSET = 8;
/** The move description popup that sits above the moves menu. */
const MOVE_POPUP_MIN_H = 56;
const MOVE_POPUP_GAP = 8;
const MOVE_POPUP_TYPE_W = 88;
/** The category badge is 32x14; 1.5x reads clearly beside the 16px cell text. */
const MOVE_CATEGORY_ICON_SCALE = 1.5;
/** The party (switch) grid: 3 columns of avatar cells. */
const PARTY_COLS = 3;
const PARTY_AVATAR_SCALE = 1.15;
/** Placeholder mon sprite scale; the switch beat returns the sprite to it. */
const MON_SCALE = 2.4;

type Mode = 'feed' | 'menu' | 'moves' | 'bag' | 'party' | 'over';

/** A sprite beat that owns the mon's position/scale until it completes. */
type BeatKind = 'faint' | 'switch';

/** Extra data a move grid cell draws: its type, category, PP and description. */
type MenuMove = Readonly<{
  type: string;
  category: string;
  pp: number;
  maxPp: number;
  desc: string;
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

  private displayActive!: Record<SideId, BattleFighter>;
  private displayHp!: Record<SideId, number>;
  private displayStatus!: Record<SideId, StatusId | null>;
  private experience = new Map<string, number>();
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
  private hpBars!: Record<SideId, { fill: Phaser.GameObjects.Rectangle; bar: Phaser.GameObjects.Image }>;
  private messageText!: Phaser.GameObjects.BitmapText;
  private nameText!: Record<SideId, Phaser.GameObjects.BitmapText>;
  private statText!: Record<SideId, Phaser.GameObjects.BitmapText>;
  private statusText!: Record<SideId, Phaser.GameObjects.BitmapText>;
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
  /** The cells of the moves grid, drawn behind its text so the 2x2 reads as a grid. */
  private moveCells: Phaser.GameObjects.Rectangle[] = [];
  /** The category badge and PP text of each moves-grid cell. */
  private moveCategoryIcons: Phaser.GameObjects.Image[] = [];
  private movePpText: Phaser.GameObjects.BitmapText[] = [];
  /** The party (switch) grid: a cell, avatar, label and hit zone per member. */
  private partyCells: Phaser.GameObjects.Rectangle[] = [];
  private partyAvatars: Phaser.GameObjects.Image[] = [];
  private partyLabels: Phaser.GameObjects.BitmapText[] = [];
  private partyZones: Phaser.GameObjects.Zone[] = [];
  /** The description popup shown while the moves menu is open. */
  private movePopup!: Phaser.GameObjects.NineSlice;
  private movePopupType!: Phaser.GameObjects.Rectangle;
  private movePopupTypeText!: Phaser.GameObjects.BitmapText;
  private movePopupText!: Phaser.GameObjects.BitmapText;

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
  }

  create(): void {
    const launch = this.launch;
    if (!launch) throw new Error('BattleScene requires a BattleLaunch from the route');

    const trigger = launch.trigger;
    const enemy =
      trigger.kind === 'wild'
        ? [createFighter({ id: 'wild', speciesId: trigger.speciesId, level: trigger.level })]
        : trigger.roster.map((input) => createFighter(input));

    this.state = createBattle({
      player: launch.player.map(restoreFighter),
      enemy,
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
    for (const entry of launch.experience) this.experience.set(entry.id, entry.xp);
    this.typing = beginTypewriter('');
    const settings = loadSettings();
    this.charMs = TEXT_SPEED_MS[settings.textSpeed];
    this.keybinds = settings.keybinds;

    if (trigger.kind === 'trainer' && trigger.archetypeId) {
      const sprite = getTrainerArchetype(trigger.archetypeId)?.battleSprite ?? null;
      this.trainerFrame = sprite ? trainerSpriteFrame(sprite) : null;
    }

    this.buildScene();
    this.bindInput();
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.onResize, this);
      this.scene.setVisible(true, 'Route');
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
    this.moveCells = Array.from({ length: MENU_ROWS }, () =>
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
    this.xpText = addFrlgText(this, 0, 0, '', { size: 16, tint: 0x3b82f6 });

    this.messageText = addFrlgText(this, 0, 0, '', { lineSpacing: 4 });

    this.menuRows = Array.from({ length: MENU_ROWS }, () =>
      addFrlgText(this, 0, 0, '', { tint: FRLG_INK }),
    );
    // The moves grid's per-cell category badge and PP line, hidden with the cells.
    this.moveCategoryIcons = Array.from({ length: MENU_ROWS }, () =>
      this.add
        .image(0, 0, MOVE_CATEGORY_TEXTURE_KEY, 0)
        .setOrigin(0, 0)
        .setScale(MOVE_CATEGORY_ICON_SCALE)
        .setVisible(false),
    );
    this.movePpText = Array.from({ length: MENU_ROWS }, () =>
      addFrlgText(this, 0, 0, '', { size: 16, tint: FRLG_INK }).setVisible(false),
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
    this.partyZones = Array.from({ length: MAX_PARTY_SIZE }, () => {
      const zone = this.add.zone(0, 0, 10, 10).setOrigin(0, 0);
      zone.setData('item', -1);
      zone.setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => this.onMenuHover(zone));
      zone.on('pointerdown', () => this.onMenuClick(zone));
      return zone;
    });

    // One invisible zone per row: hovering moves the cursor, clicking picks the
    // row, so the menu answers the mouse exactly like the keyboard.
    this.menuZones = Array.from({ length: MENU_ROWS }, () => {
      const zone = this.add.zone(0, 0, 10, 10).setOrigin(0, 0);
      zone.setData('item', -1);
      zone.setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => this.onMenuHover(zone));
      zone.on('pointerdown', () => this.onMenuClick(zone));
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

    // The move description popup, built last so it rides over the menu and the
    // battle behind it. Hidden unless the moves menu is open. The type chip sits
    // at its left, the description (larger) beside it.
    this.movePopup = addFrlgWindow(this, 0, 0, 300, MOVE_POPUP_MIN_H).setVisible(false);
    this.movePopupType = this.add.rectangle(0, 0, MOVE_POPUP_TYPE_W, 24, 0x9aa0b4).setOrigin(0, 0).setVisible(false);
    this.movePopupTypeText = addFrlgText(this, 0, 0, '', {
      size: 16,
      tint: 0xf8fafc,
      origin: [0.5, 0],
    }).setVisible(false);
    this.movePopupText = addFrlgText(this, 0, 0, '', {
      tint: FRLG_INK,
      lineSpacing: 4,
    }).setVisible(false);
  }

  private bindInput(): void {
    this.confirmKeys = actionKeys(this, 'confirm', this.keybinds);
    subscribeKeybinds(
      this,
      ({ action }) => {
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
      },
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
    // `[` / `]` cycle the bag's pockets while it is open, as in the route HUD.
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      if (this.mode !== 'bag') return;
      if (event.key === '[') this.cycleBagTab(-1);
      else if (event.key === ']') this.cycleBagTab(1);
    });
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
        case 'capture':
          this.playCapture(event.shakes, event.success);
          break;
        default:
          break;
      }
    }
  }

  // --- battle presentation --------------------------------------------------

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

  /** Swaps in the FRLG front/back sprite for each side's active fighter. */
  private syncMonSprites(): void {
    const foeFrame = pokemonSpriteFrame(this.displayActive.enemy.speciesId);
    if (foeFrame !== null) {
      this.foeSprite.setTexture(POKEMON_SPRITE_SHEETS.front.key, foeFrame).setTint(0xffffff);
    }
    const playerFrame = pokemonSpriteFrame(this.displayActive.player.speciesId);
    if (playerFrame !== null) {
      this.playerSprite.setTexture(POKEMON_SPRITE_SHEETS.back.key, playerFrame).setTint(0xffffff);
    }
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
    const scale = MON_SCALE;
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

  private openMoves(): void {
    const player = activeFighter(this.state, 'player');
    const legal = legalMoveIndices(player);
    this.menuItems = player.moves.map((slot, index) => {
      const move = getMove(slot.moveId);
      const name = move?.name ?? slot.moveId;
      const enabled = legal.length === 0 ? index === 0 : legal.includes(index);
      return {
        label: name,
        enabled,
        onSelect: () => this.submit({ type: 'fight', moveIndex: index }),
        move: {
          type: move?.type ?? '',
          category: move?.category ?? 'Status',
          pp: slot.pp,
          maxPp: slot.maxPp,
          desc: move?.shortDesc ?? move?.desc ?? '',
        },
      };
    });
    this.menuIndex = 0;
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
      const statusText = status ? ` ${status}` : '';
      return {
        label: `${fighter.name}  Lv${fighter.level}\n${fighter.hp}/${fighter.maxHp}${statusText}`,
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
    this.startFeed();
  }

  private usableBag() {
    return this.state.bag.filter(
      (slot) =>
        slot.count > 0 &&
        slot.item.kind !== 'held' &&
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
    let index = this.menuIndex;
    for (let step = 0; step < count; step++) {
      let row = Math.floor(index / cols);
      let col = index % cols;
      if (action === 'up') row = (row - 1 + rows) % rows;
      else if (action === 'down') row = (row + 1) % rows;
      else if (action === 'left') col = (col - 1 + cols) % cols;
      else col = (col + 1) % cols;
      index = Math.min(row * cols + col, count - 1);
      if (this.menuItems[index].enabled) break;
    }
    if (index === this.menuIndex) return;
    this.menuIndex = index;
    this.refreshHud();
  }

  private confirmMenu(): void {
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
    this.syncMonSprites();
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
      const boxH = 204;
      box = { x: pad, y: height - boxH - pad, w: panelW, h: boxH };
      foeInfo = { x: pad, y: pad, w: panelW, h: FOE_PANEL.h };
      playerInfo = { x: pad, y: Math.round(height * 0.46), w: panelW, h: PLAYER_PANEL_H };
      foeX = width * 0.72;
      foeY = height * 0.18;
      playerX = width * 0.32;
      playerY = playerInfo.y - 90;
    } else {
      box = { x: 36, y: height - 186, w: width - 72, h: 160 };
      foeInfo = { x: 36, y: 28, w: FOE_PANEL.w, h: FOE_PANEL.h };
      playerInfo = {
        x: width - 36 - PLAYER_PANEL_W,
        y: height - 186 - 24 - PLAYER_PANEL_H,
        w: PLAYER_PANEL_W,
        h: PLAYER_PANEL_H,
      };
      foeX = trainer ? width * 0.78 : width * 0.72;
      foeY = trainer ? height * 0.3 : height * 0.28;
      playerX = width * 0.27;
      playerY = height * 0.6;
    }

    // The move-detail popup sits above the menu; while it is up, lift the
    // player's data panel so the popup never covers it.
    const movePopupH = menuOpen && this.mode === 'moves' ? this.movePopupHeight(box.w) : 0;
    if (movePopupH > 0) {
      playerInfo = { ...playerInfo, y: playerInfo.y - movePopupH - MOVE_POPUP_GAP };
      if (compact) playerY -= movePopupH + MOVE_POPUP_GAP;
    }

    // Both boxes span the full bottom width and share it: the choice menu owns
    // the whole box while it is open and the message window steps aside, so a
    // list is never squeezed next to the text (the same shape on phone and
    // desktop now).
    menu = { x: box.x, y: box.y, w: box.w, h: box.h };
    message = { x: box.x, y: box.y + box.h - MESSAGE_H, w: box.w, h: MESSAGE_H };

    this.foeMonPos = { x: foeX, y: foeY };
    this.playerMonPos = { x: playerX, y: playerY };
    if (this.beat.enemy !== 'faint') this.foeSprite.setPosition(foeX, foeY);
    this.foePlatform.setPosition(compact ? foeX : width * 0.72, foeY + 58);
    if (trainer) this.foeTrainer.setPosition((compact ? foeX : width * 0.72) - 70, foeY + 62);
    if (this.beat.player !== 'faint') this.playerSprite.setPosition(playerX, playerY);
    this.playerPlatform.setPosition(playerX, playerY + 62);
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

    const status = statusAbbreviation(this.displayStatus[side]);
    this.statusText[side].setText(status ?? '').setPosition(barX + 27, barY - 23);
    if (status) {
      this.hud.fillStyle(0x8b5cf6, 1);
      this.hud.fillRoundedRect(barX, barY - 24, 54, 20, 6);
    }

    const bar = this.hpBars[side];
    bar.fill
      .setPosition(barX + FRLG_HPBAR.fill.x, barY + FRLG_HPBAR.fill.y)
      .setSize(Math.max(0, FRLG_HPBAR.fill.width * fraction), FRLG_HPBAR.fill.height)
      .setFillStyle(hpColorInt(fraction));
    bar.bar.setPosition(barX, barY);

    if (side === 'player') {
      const xp = this.experience.get(fighter.id) ?? 0;
      drawGauge(
        this.hud,
        barX,
        barY + 36,
        FRLG_HPBAR.width,
        8,
        experienceFraction(xp, fighter.level),
        0x60a5fa,
      );
      this.xpText.setText(`XP ${xp}`).setPosition(barX, barY + 46).setVisible(true);
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
    this.moveCells.forEach((cell, i) => {
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
      if (!item) {
        cell.setVisible(false);
        this.partyAvatars[i].setVisible(false);
        this.partyLabels[i].setVisible(false);
        return;
      }
      const selected = i === this.menuIndex;
      cell
        .setPosition(cellX(i), cellY(i))
        .setSize(cellW, cellH)
        .setFillStyle(selected ? 0xf7e0a6 : 0xe6e3f2)
        .setStrokeStyle(selected ? 3 : 2, selected ? 0x2f2c4d : 0x9a94b8)
        .setVisible(true);
      const frame = party[i] ? portraitFrameFor(party[i].speciesId) : null;
      this.partyAvatars[i]
        .setVisible(frame !== null)
        .setAlpha(item.enabled ? 1 : 0.45)
        .setPosition(cellX(i) + 8 + avatarW / 2, cellY(i) + cellH / 2);
      if (frame !== null) this.partyAvatars[i].setFrame(frame);
      this.partyLabels[i]
        .setText(item.label)
        .setAlpha(item.enabled ? 1 : 0.45)
        .setMaxWidth(cellW - avatarW - 22)
        .setOrigin(0, 0)
        .setPosition(cellX(i) + 8 + avatarW + 6, cellY(i) + 8)
        .setVisible(true);
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
  }

  /** Hides the party grid's cells, avatars, labels and hit zones. */
  private hidePartyGrid(): void {
    for (const cell of this.partyCells) cell.setVisible(false);
    for (const avatar of this.partyAvatars) avatar.setVisible(false);
    for (const label of this.partyLabels) label.setVisible(false);
    for (const zone of this.partyZones) {
      zone.setData('item', -1);
      if (zone.input) zone.input.enabled = false;
    }
  }

  /**
   * The moves menu as a 2-column grid, so all four moves show at once with no
   * scrolling. The ◀ back control sits centred on the grid's left edge; each cell
   * is tinted by the move's type and shows its name, a category badge and its PP,
   * while the popup above the menu lists the type and description of the move the
   * cursor is on.
   */
  private renderMoveMenu(menu: Rect): void {
    this.menuPanel.setVisible(true);
    this.hideBagTabs();
    this.hidePartyGrid();
    const pad = FRLG_WINDOW_PADDING;
    const count = this.menuItems.length;
    const cols = MENU_GRID_COLS;
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

    // The ◀ back control, centred on the grid's left edge between the two rows.
    const backX = left + 14;
    const backY = (top + bottom) / 2;
    this.backArrow.setVisible(true).setPosition(backX, backY);
    this.backZone.setPosition(backX - 12, backY - 18).setSize(48, 36);
    if (this.backZone.input) this.backZone.input.enabled = true;

    this.menuRows.forEach((row, i) => {
      const item = i < count ? this.menuItems[i] : undefined;
      if (!item) {
        row.setVisible(false);
        return;
      }
      row
        .setText(item.label)
        .setAlpha(item.enabled ? 1 : 0.4)
        .setFontSize(16)
        .setMaxWidth(cellW - MOVE_CELL_PAD * 2 - 40)
        .setOrigin(0, 0)
        .setPosition(cellX(i) + MOVE_CELL_PAD, cellY(i) + MOVE_CELL_PAD)
        .setVisible(true);
    });
    this.moveCategoryIcons.forEach((icon, i) => {
      const item = i < count ? this.menuItems[i] : undefined;
      const frame = item?.move ? categoryIconFrame(item.move.category) : null;
      if (!item || frame === null) {
        icon.setVisible(false);
        return;
      }
      icon
        .setFrame(frame)
        .setAlpha(item.enabled ? 1 : 0.4)
        .setPosition(cellX(i) + MOVE_CELL_PAD, cellY(i) + MOVE_CELL_PAD + 20)
        .setVisible(true);
    });
    this.movePpText.forEach((text, i) => {
      const item = i < count ? this.menuItems[i] : undefined;
      if (!item?.move) {
        text.setVisible(false);
        return;
      }
      text
        .setText(`PP ${item.move.pp}/${item.move.maxPp}`)
        .setAlpha(item.enabled ? 1 : 0.4)
        .setPosition(
          cellX(i) + MOVE_CELL_PAD + MOVE_CATEGORY_ICON_W * MOVE_CATEGORY_ICON_SCALE + 6,
          cellY(i) + MOVE_CELL_PAD + 24,
        )
        .setVisible(true);
    });
    this.moveCells.forEach((cell, i) => {
      const item = i < count ? this.menuItems[i] : undefined;
      if (!item) {
        cell.setVisible(false);
        return;
      }
      const type = item.move?.type ?? '';
      const selected = i === this.menuIndex;
      cell
        .setPosition(cellX(i), cellY(i))
        .setSize(cellW, cellH)
        .setFillStyle(typeTint(type, selected ? 0.35 : 0.72))
        .setStrokeStyle(selected ? 3 : 2, selected ? 0x2f2c4d : 0x9a94b8)
        .setVisible(true);
    });
    this.menuZones.forEach((zone, i) => {
      const item = i < count ? this.menuItems[i] : undefined;
      zone.setData('item', item ? i : -1);
      if (zone.input) zone.input.enabled = Boolean(item);
      if (item) zone.setPosition(cellX(i), cellY(i)).setSize(cellW, cellH);
    });
    // The cursor sits at the end of the selected cell, pointing back at its text.
    this.menuCursor
      .setFlipX(true)
      .setPosition(cellX(this.menuIndex) + cellW - 48, cellY(this.menuIndex) + cellH / 2)
      .setVisible(count > 0);
    this.showMovePopup(menu);
  }

  /** The popup's description font: large on a full-width menu, small on a phone. */
  private movePopupFontSize(width: number): number {
    return width >= 500 ? FRLG_FONT_SIZE : 16;
  }

  /** The popup height, measured from the current move's wrapped description. */
  private movePopupHeight(width: number): number {
    const move = this.menuItems[this.menuIndex]?.move;
    if (!move || move.desc.length === 0) return 0;
    const pad = FRLG_WINDOW_PADDING;
    this.movePopupText
      .setFontSize(this.movePopupFontSize(width))
      .setText(move.desc)
      .setMaxWidth(width - pad.x * 2 - MOVE_POPUP_TYPE_W - 12);
    return Math.max(MOVE_POPUP_MIN_H, pad.top + Math.max(24, this.movePopupText.height) + pad.bottom);
  }

  /**
   * The details popup above the menu: a type chip at its left and the move's
   * description (larger than the grid text) beside it.
   */
  private showMovePopup(menu: Rect): void {
    const move = this.menuItems[this.menuIndex]?.move;
    if (!move || move.desc.length === 0) {
      this.movePopup.setVisible(false);
      this.movePopupText.setVisible(false);
      this.movePopupType.setVisible(false);
      this.movePopupTypeText.setVisible(false);
      return;
    }
    const pad = FRLG_WINDOW_PADDING;
    const size = this.movePopupFontSize(menu.w);
    const height = this.movePopupHeight(menu.w);
    const x = menu.x;
    const y = menu.y - height - MOVE_POPUP_GAP;
    const chipY = y + pad.top;
    this.movePopup.setSlices(menu.w, height).setPosition(x, y).setVisible(true);
    this.movePopupType
      .setPosition(x + pad.x, chipY)
      .setFillStyle(typeColor(move.type))
      .setVisible(true);
    this.movePopupTypeText
      .setText(move.type.toUpperCase())
      .setPosition(x + pad.x + MOVE_POPUP_TYPE_W / 2, chipY + 2)
      .setVisible(true);
    this.movePopupText
      .setText(move.desc)
      .setFontSize(size)
      .setMaxWidth(menu.w - pad.x * 2 - MOVE_POPUP_TYPE_W - 12)
      .setPosition(x + pad.x + MOVE_POPUP_TYPE_W + 12, chipY + Math.max(0, (24 - size) / 2))
      .setVisible(true);
  }

  /** Hides every grid piece: the cells, category badges, PP and the popup. */
  private hideMoveChrome(): void {
    for (const cell of this.moveCells) cell.setVisible(false);
    for (const icon of this.moveCategoryIcons) icon.setVisible(false);
    for (const text of this.movePpText) text.setVisible(false);
    this.movePopup.setVisible(false);
    this.movePopupText.setVisible(false);
    this.movePopupType.setVisible(false);
    this.movePopupTypeText.setVisible(false);
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
    if (typeof index !== 'number' || index < 0 || index === this.menuIndex) return;
    this.menuIndex = index;
    this.refreshHud();
  }

  /** Clicking a row selects it: the same as moving the cursor there and confirming. */
  private onMenuClick(zone: Phaser.GameObjects.Zone): void {
    const index = zone.getData('item');
    if (typeof index !== 'number' || index < 0) return;
    const item = this.menuItems[index];
    if (!item?.enabled) return;
    this.menuIndex = index;
    this.confirmMenu();
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
