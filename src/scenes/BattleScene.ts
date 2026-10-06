import Phaser from 'phaser';
import { getMove } from '../data/dex';
import { getItem } from '../data/items';
import { ITEM_ICON_TEXTURE_KEY, itemIconFrame } from '../data/itemIcons';
import { keyLabel, type Keybinds } from '../data/keybinds';
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
import { experienceFraction, type BattleLaunch, type BattleOutcome, type BattleReturn } from '../engine/run';
import { MOVE_FX_TEXTURE_KEY, moveFxAnimKey, moveFxFor, moveFxTrack } from '../render/moveFx';
import {
  FAINT_DROP,
  FAINT_MS,
  SWITCH_RECALL_MS,
  SWITCH_SENDOUT_MS,
  SWITCH_SHRINK,
} from '../ui/beats';
import { CAPTURE_SHAKE_SPEED, captureBeat } from '../ui/capture';
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
import { FRLG_INK, addFrlgText } from '../ui/frlgFont';
import { BATTLE_MON_TEXTURE_KEY, BATTLE_PLATFORM_TEXTURE_KEY } from './BootScene';
import type { RouteScene } from './RouteScene';

const MESSAGE_HOLD_MS = 450;
const FAST_HOLD_MS = 45;
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
/** Placeholder mon sprite scale; the switch beat returns the sprite to it. */
const MON_SCALE = 2.4;

type Mode = 'feed' | 'menu' | 'moves' | 'bag' | 'party' | 'run' | 'over';

/** A sprite beat that owns the mon's position/scale until it completes. */
type BeatKind = 'faint' | 'switch';

type MenuItem = Readonly<{ label: string; enabled: boolean; onSelect: () => void }>;

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
  private foePanel!: Phaser.GameObjects.NineSlice;
  private playerPanel!: Phaser.GameObjects.NineSlice;
  private messagePanel!: Phaser.GameObjects.NineSlice;
  private menuPanel!: Phaser.GameObjects.NineSlice;
  private menuCursor!: Phaser.GameObjects.Image;
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

  private menuItems: readonly MenuItem[] = [];
  private menuIndex = 0;

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
    this.startFeed();
  }

  // --- scene construction -------------------------------------------------

  private buildScene(): void {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, 0x27324a).setOrigin(0, 0);
    this.add.rectangle(0, height * 0.52, width, height * 0.48, 0x39424f).setOrigin(0, 0);

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

    this.hpBars = {
      enemy: addFrlgHpBar(this, 0, 0),
      player: addFrlgHpBar(this, 0, 0),
    };

    this.hud = this.add.graphics();
    this.menuCursor = this.add.image(0, 0, FRLG_CURSOR_KEY).setOrigin(0, 0.5).setVisible(false);

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

    addFrlgText(
      this,
      width - 16,
      12,
      `${keyLabel(this.keybinds.confirm)} confirm (hold = skip)  ·  ${keyLabel(this.keybinds.cancel)} cancel`,
      {
        size: 16,
        tint: 0x94a3b8,
        origin: [1, 0],
      },
    );
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
          case 'left':
            this.moveMenu(-1);
            return;
          case 'down':
          case 'right':
            this.moveMenu(1);
            return;
        }
      },
      () => this.keybinds,
    );
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
    if (this.mode === 'moves' || this.mode === 'bag' || this.mode === 'party' || this.mode === 'run') {
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
    const message = this.outcomeMessage(this.outcome());
    this.setMessage(`${message}  ·  Z / Esc to leave`);
    this.refreshHud();
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
      { label: 'RUN', enabled: canRun(this.state, 'player'), onSelect: () => this.openRunConfirm() },
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
      const type = (move?.type ?? '').toUpperCase();
      const enabled = legal.length === 0 ? index === 0 : legal.includes(index);
      return {
        label: `${name}  ${type}   PP ${slot.pp}/${slot.maxPp}`,
        enabled,
        onSelect: () => this.submit({ type: 'fight', moveIndex: index }),
      };
    });
    this.menuIndex = 0;
    this.mode = 'moves';
    this.refreshHud();
  }

  private openBag(): void {
    const usable = this.usableBag();
    this.menuItems =
      usable.length === 0
        ? [{ label: 'No items', enabled: false, onSelect: () => {} }]
        : usable.map((slot) => ({
            label: `${slot.item.name} x${slot.count}`,
            enabled: true,
            onSelect: () => this.submit({ type: 'bag', itemId: slot.item.id }),
          }));
    this.menuIndex = 0;
    this.mode = 'bag';
    this.refreshHud();
  }

  private openParty(): void {
    const side = this.state.sides.player;
    this.menuItems = side.party.map((fighter, index) => {
      const status = statusAbbreviation(fighter.status);
      const statusText = status ? ` ${status}` : '';
      return {
        label: `${fighter.name} Lv${fighter.level} ${fighter.hp}/${fighter.maxHp}${statusText}`,
        enabled: index !== side.activeIndex && fighter.hp > 0,
        onSelect: () => this.confirmParty(index),
      };
    });
    this.menuIndex = 0;
    this.mode = 'party';
    this.refreshHud();
  }

  private openRunConfirm(): void {
    this.menuItems = [
      { label: 'YES', enabled: true, onSelect: () => this.submit({ type: 'run' }) },
      { label: 'NO', enabled: true, onSelect: () => this.openMenu() },
    ];
    this.menuIndex = 0;
    this.mode = 'run';
    this.setMessage('Run away from the battle?');
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
    this.messageText.setText('');
  }

  /** Reveals the characters the frame's elapsed time buys. */
  private tickTyping(delta: number): void {
    const { typewriter } = advanceTypewriter(this.typing, delta, this.charMs);
    if (typewriter === this.typing) return;
    this.typing = typewriter;
    this.messageText.setText(visibleText(typewriter));
  }

  /** Skips to the end of the line (a confirm tap, or Z held). */
  private completeTyping(): void {
    if (typewriterDone(this.typing)) return;
    this.typing = revealAll(this.typing);
    this.messageText.setText(this.typing.text);
  }

  private refreshHud(): void {
    this.syncMonSprites();
    const { width, height } = this.scale;
    const box: Rect = { x: 36, y: height - 186, w: width - 72, h: 160 };
    const foeInfo: Rect = { x: 36, y: 28, w: FOE_PANEL.w, h: FOE_PANEL.h };
    const playerInfo: Rect = {
      x: width - 36 - PLAYER_PANEL_W,
      y: height - 186 - 24 - PLAYER_PANEL_H,
      w: PLAYER_PANEL_W,
      h: PLAYER_PANEL_H,
    };
    const menu: Rect = { x: box.x + box.w - MENU_W, y: box.y, w: MENU_W, h: box.h };
    const message: Rect = {
      x: box.x,
      y: box.y + box.h - MESSAGE_H,
      w: box.w - MENU_W - 12,
      h: MESSAGE_H,
    };

    const trainer = this.foeTrainer.visible;
    const foeX = trainer ? width * 0.78 : width * 0.72;
    const foeY = trainer ? height * 0.3 : height * 0.28;
    this.foeMonPos = { x: foeX, y: foeY };
    this.playerMonPos = { x: width * 0.27, y: height * 0.6 };
    if (this.beat.enemy !== 'faint') this.foeSprite.setPosition(foeX, foeY);
    this.foePlatform.setPosition(width * 0.72, height * 0.28 + 58);
    if (trainer) this.foeTrainer.setPosition(width * 0.72 - 70, height * 0.28 + 62);
    if (this.beat.player !== 'faint') this.playerSprite.setPosition(this.playerMonPos.x, this.playerMonPos.y);
    this.playerPlatform.setPosition(width * 0.27, height * 0.6 + 62);
    this.foeSprite.setVisible((this.displayHp.enemy > 0 && !this.captured) || this.beat.enemy === 'faint');
    this.playerSprite.setVisible(this.displayHp.player > 0 || this.beat.player === 'faint');

    this.hud.clear();
    this.drawSidePanel(foeInfo, 'enemy');
    this.drawSidePanel(playerInfo, 'player');
    this.messagePanel.setSlices(message.w, message.h).setPosition(message.x, message.y);
    this.menuPanel.setSlices(menu.w, menu.h).setPosition(menu.x, menu.y);

    this.messageText.setPosition(message.x + FRLG_TEXTBOX_PADDING.x, message.y + FRLG_TEXTBOX_PADDING.top);
    this.messageText.setMaxWidth(message.w - FRLG_TEXTBOX_PADDING.x * 2);

    if (this.menuItems.length > 0) {
      this.renderMenu(menu);
    } else {
      this.menuPanel.setVisible(false);
      this.menuCursor.setVisible(false);
      for (const row of this.menuRows) row.setVisible(false);
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

  private renderMenu(menu: Rect): void {
    this.menuPanel.setVisible(true);
    const startX = menu.x + 58;
    const startY = menu.y + FRLG_WINDOW_PADDING.top;
    const count = this.menuItems.length;
    const windowStart = Math.max(0, Math.min(this.menuIndex - 1, count - MENU_ROWS));
    this.menuRows.forEach((row, i) => {
      const item = this.menuItems[windowStart + i];
      if (!item) {
        row.setVisible(false);
        return;
      }
      row
        .setText(item.label)
        .setAlpha(item.enabled ? 1 : 0.4)
        .setPosition(startX, startY + i * ROW_H)
        .setVisible(true);
    });
    this.menuCursor
      .setPosition(menu.x + 20, startY + (this.menuIndex - windowStart) * ROW_H + 16)
      .setVisible(true);
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
