import Phaser from 'phaser';
import { getMove } from '../data/dex';
import { getItem, type ItemDef } from '../data/items';
import { legalMoveIndices, type Command } from '../engine/battle/commands';
import { createFighter, type BattleFighter, type StatusId } from '../engine/battle/fighter';
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
import { battleFrames, type FeedFrame } from '../ui/feed';
import { hpColorInt, hpFraction, statusAbbreviation } from '../ui/metrics';
import { drawGauge, drawPanel } from '../ui/panel';
import { BATTLE_MON_TEXTURE_KEY, BATTLE_PLATFORM_TEXTURE_KEY } from './BootScene';

const MESSAGE_HOLD_MS = 850;
const FAST_HOLD_MS = 45;
const MENU_ROWS = 4;
const DEMO_SEED = 20240929;

type Mode = 'feed' | 'menu' | 'moves' | 'bag' | 'party' | 'run' | 'over';

type MenuItem = Readonly<{ label: string; enabled: boolean; onSelect: () => void }>;

type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;

function itemDef(id: string): ItemDef {
  const item = getItem(id);
  if (!item) throw new Error(`Unknown item ${id}`);
  return item;
}

/**
 * The menu battle (Phase 5). It renders the engine's state — platforms, sprites,
 * HP readouts, status badges and the message box — and plays the event log back
 * one frame at a time. A fixed demo party stands in until the run (Phase 6)
 * hands the scene a real one; the four commands are wired straight to the engine.
 */
export class BattleScene extends Phaser.Scene {
  private state!: BattleState;
  private frames: readonly FeedFrame[] = [];
  private frameIndex = 0;
  private feedElapsed = 0;
  private logLength = 0;
  private afterFeed: (() => void) | null = null;
  private mode: Mode = 'feed';
  private forcedSwitch = false;

  private displayActive!: Record<SideId, BattleFighter>;
  private displayHp!: Record<SideId, number>;
  private displayStatus!: Record<SideId, StatusId | null>;

  private hud!: Phaser.GameObjects.Graphics;
  private messageText!: Phaser.GameObjects.Text;
  private nameText!: Record<SideId, Phaser.GameObjects.Text>;
  private statText!: Record<SideId, Phaser.GameObjects.Text>;
  private statusText!: Record<SideId, Phaser.GameObjects.Text>;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private foeSprite!: Phaser.GameObjects.Sprite;
  private playerPlatform!: Phaser.GameObjects.Image;
  private foePlatform!: Phaser.GameObjects.Image;
  private menuRows: Phaser.GameObjects.Text[] = [];

  private menuItems: readonly MenuItem[] = [];
  private menuIndex = 0;

  private keyZ!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('Battle');
  }

  create(): void {
    const wild = createFighter({
      id: 'wild',
      speciesId: 'bulbasaur',
      level: 10,
      moves: ['vinewhip', 'tackle', 'growl'],
    });
    this.state = createBattle({
      player: [
        createFighter({
          id: 'starter',
          speciesId: 'charmander',
          level: 12,
          moves: ['ember', 'scratch', 'growl'],
        }),
        createFighter({
          id: 'reserve',
          speciesId: 'squirtle',
          level: 10,
          moves: ['watergun', 'tackle', 'tailwhip'],
        }),
      ],
      enemy: [wild],
      rng: new Rng(DEMO_SEED),
      isWild: true,
      bag: [
        { item: itemDef('potion'), count: 2 },
        { item: itemDef('pokeball'), count: 3 },
        { item: itemDef('paralyzeheal'), count: 1 },
      ],
    });

    this.displayActive = {
      player: activeFighter(this.state, 'player'),
      enemy: activeFighter(this.state, 'enemy'),
    };
    this.displayHp = { player: this.displayActive.player.hp, enemy: this.displayActive.enemy.hp };
    this.displayStatus = { player: null, enemy: null };

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
    this.foeSprite = this.add.sprite(0, 0, BATTLE_MON_TEXTURE_KEY).setTint(0x9ad2a0).setScale(2.4);
    this.playerSprite = this.add
      .sprite(0, 0, BATTLE_MON_TEXTURE_KEY)
      .setTint(0xf3b17a)
      .setScale(2.4)
      .setFlipX(true);

    this.hud = this.add.graphics();

    const label = { fontFamily: 'monospace', fontSize: '20px', color: '#f8fafc' } as const;
    const small = { ...label, fontSize: '16px', color: '#cbd5f5' } as const;
    this.nameText = {
      enemy: this.add.text(0, 0, '', label),
      player: this.add.text(0, 0, '', label),
    };
    this.statText = {
      enemy: this.add.text(0, 0, '', small).setOrigin(1, 0),
      player: this.add.text(0, 0, '', small).setOrigin(1, 0),
    };
    this.statusText = {
      enemy: this.add.text(0, 0, '', { ...small, color: '#0b1220' }).setOrigin(0.5),
      player: this.add.text(0, 0, '', { ...small, color: '#0b1220' }).setOrigin(0.5),
    };

    this.messageText = this.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#f8fafc',
      lineSpacing: 6,
    });

    this.menuRows = Array.from({ length: MENU_ROWS }, () =>
      this.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '20px', color: '#f8fafc' }),
    );

    this.add
      .text(width - 16, 12, 'Z confirm (hold = skip)  ·  X cancel  ·  Esc route', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#94a3b8',
      })
      .setOrigin(1, 0);
  }

  private bindInput(): void {
    const keyboard = this.input.keyboard!;
    this.keyZ = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    const repeat = (handler: (event: KeyboardEvent) => void) => (event: KeyboardEvent) => {
      if (!event.repeat) handler(event);
    };
    const confirm = repeat(() => this.onConfirm());
    const cancel = repeat(() => this.onCancel());
    keyboard.on('keydown-Z', confirm);
    keyboard.on('keydown-SPACE', confirm);
    keyboard.on('keydown-ENTER', confirm);
    keyboard.on('keydown-X', cancel);
    const back = (event: KeyboardEvent) => {
      if (!event.repeat) this.moveMenu(-1);
    };
    const forward = (event: KeyboardEvent) => {
      if (!event.repeat) this.moveMenu(1);
    };
    keyboard.on('keydown-UP', back);
    keyboard.on('keydown-LEFT', back);
    keyboard.on('keydown-DOWN', forward);
    keyboard.on('keydown-RIGHT', forward);
    keyboard.on('keydown-ESC', () => this.scene.start('Route'));
  }

  private onConfirm(): void {
    if (this.mode === 'feed') {
      this.advanceFeed();
      return;
    }
    if (this.mode === 'over') return;
    this.confirmMenu();
  }

  private onCancel(): void {
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
    if (frame.message !== null) this.setMessage(frame.message);
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
          const fighter = this.state.sides[event.side].party.find((p) => p.id === event.fighterId);
          if (fighter) {
            this.displayActive[event.side] = fighter;
            this.displayHp[event.side] = fighter.hp;
            this.displayStatus[event.side] = fighter.status;
          }
          break;
        }
        case 'faint':
          this.displayHp[event.side] = 0;
          break;
        default:
          break;
      }
    }
  }

  private showOver(): void {
    this.mode = 'over';
    this.menuItems = [];
    const message =
      this.state.winner === 'player'
        ? 'You won the battle!'
        : this.state.winner === 'draw'
          ? 'Got away safely!'
          : 'You have no more Pokémon...';
    this.setMessage(`${message}  ·  Esc to leave`);
    this.refreshHud();
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
      const name = (move?.name ?? slot.moveId).padEnd(12, ' ');
      const type = (move?.type ?? '').toUpperCase().padEnd(8, ' ');
      const enabled = legal.length === 0 ? index === 0 : legal.includes(index);
      return {
        label: `${name}${type}PP ${slot.pp}/${slot.maxPp}`,
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
        (slot.item.kind !== 'ball' || this.state.isWild),
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

  private setMessage(text: string): void {
    this.messageText.setText(text);
  }

  private refreshHud(): void {
    const { width, height } = this.scale;
    const box: Rect = { x: 36, y: height - 156, w: width - 72, h: 130 };
    const foeInfo: Rect = { x: 36, y: 32, w: 380, h: 96 };
    const playerInfo: Rect = { x: width - 452, y: height - 286, w: 416, h: 118 };

    this.foeSprite.setPosition(width * 0.72, height * 0.28);
    this.foePlatform.setPosition(width * 0.72, height * 0.28 + 58);
    this.playerSprite.setPosition(width * 0.27, height * 0.6);
    this.playerPlatform.setPosition(width * 0.27, height * 0.6 + 62);
    this.foeSprite.setVisible(this.displayHp.enemy > 0);
    this.playerSprite.setVisible(this.displayHp.player > 0);

    this.hud.clear();
    this.drawSidePanel(foeInfo, 'enemy');
    this.drawSidePanel(playerInfo, 'player');
    drawPanel(this.hud, box.x, box.y, box.w, box.h, { fill: 0x141d31 });

    this.messageText.setPosition(box.x + 24, box.y + 18);
    this.messageText.setWordWrapWidth(box.w * 0.54);

    if (
      this.mode === 'menu' ||
      this.mode === 'moves' ||
      this.mode === 'bag' ||
      this.mode === 'party' ||
      this.mode === 'run'
    ) {
      this.renderMenu(box);
    } else {
      for (const row of this.menuRows) row.setVisible(false);
    }
  }

  private drawSidePanel(rect: Rect, side: SideId): void {
    drawPanel(this.hud, rect.x, rect.y, rect.w, rect.h);
    const fighter = this.displayActive[side];
    const hp = this.displayHp[side];
    const fraction = hpFraction(hp, fighter.maxHp);

    this.nameText[side].setText(`${fighter.name}  Lv${fighter.level}`).setPosition(rect.x + 18, rect.y + 12);
    this.statText[side]
      .setText(side === 'player' ? `${hp}/${fighter.maxHp}` : '')
      .setPosition(rect.x + rect.w - 16, rect.y + 16);

    const barX = rect.x + 18;
    const barY = rect.y + rect.h - 30;
    const barW = rect.w - 36;
    drawGauge(this.hud, barX, barY, barW, 12, fraction, hpColorInt(fraction));

    const status = statusAbbreviation(this.displayStatus[side]);
    this.statusText[side].setText(status ?? '');
    if (status) {
      this.hud.fillStyle(0x8b5cf6, 1);
      this.hud.fillRoundedRect(barX, barY - 24, 54, 20, 6);
      this.statusText[side].setPosition(barX + 27, barY - 23);
    }
  }

  private renderMenu(box: Rect): void {
    const startX = box.x + box.w * 0.58;
    const startY = box.y + 14;
    const count = this.menuItems.length;
    const windowStart = Math.max(0, Math.min(this.menuIndex - 1, count - MENU_ROWS));
    this.menuRows.forEach((row, i) => {
      const item = this.menuItems[windowStart + i];
      if (!item) {
        row.setVisible(false);
        return;
      }
      row
        .setText(`${windowStart + i === this.menuIndex ? '>' : ' '} ${item.label}`)
        .setAlpha(item.enabled ? 1 : 0.4)
        .setPosition(startX, startY + i * 30)
        .setVisible(true);
    });
  }

  override update(_time: number, delta: number): void {
    if (this.mode !== 'feed') return;
    this.feedElapsed += delta;
    const hold = this.keyZ.isDown ? FAST_HOLD_MS : MESSAGE_HOLD_MS;
    if (this.feedElapsed >= hold) this.advanceFeed();
  }
}
