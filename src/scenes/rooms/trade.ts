import type Phaser from 'phaser';
import { keyLabel, type KeybindAction } from '../../data/keybinds';
import { getSpecies } from '../../data/dex/species';
import { canTrade, isItemPicked, tradeId, tradePokemon } from '../../engine/run';
import { TILE_SIZE } from '../../engine/tileset';
import { t } from '../../i18n';
import { loadSettings } from '../../settings';
import {
  FRLG_ACCENT,
  FRLG_MUTED,
  FRLG_SELECTED_FILL,
  FRLG_SELECTED_STROKE,
  addFrlgWindow,
} from '../../ui/frlg';
import { FRLG_INK, addFrlgText } from '../../ui/frlgFont';
import { SHOP_COUNTER_TEXTURE_KEY } from '../BootScene';
import type { RoomDescriptor, RoomHost, RoomPanel } from './types';

/**
 * The **trade** room (`docs/maps-spec.md` §7, `docs/routes-spec.md` §6, `D47`): a
 * counter whose interact key opens the room's own window. The window lists the
 * **party** and one `LEAVE` row; giving a member away rolls one random species from
 * the floor band's wild pool **on acceptance** and places it in the party at the
 * squad's level. The rule (and the roll) live in `src/engine/run/trade.ts`, so this
 * module only draws and reports.
 */

const TRADE_W = 640;
const TRADE_H = 540;
const TRADE_PAD = 24;
const TRADE_ROW_H = 44;
/** The party's six rows plus `LEAVE`. */
const TRADE_ROWS = 7;
/** The counter sprite's own pixel size and the depth the shop's counter uses. */
const TRADE_COUNTER_SIZE = 22;
const TRADE_COUNTER_DEPTH = 5;

type TradeRow = Readonly<{ kind: 'member'; memberId: string }> | Readonly<{ kind: 'leave' }>;

type TradeRowObjects = {
  highlight: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.BitmapText;
};

/** The host the open window belongs to, or null while no window is up. */
let panelHost: RoomHost | null = null;
/** The window: its root, the row objects it repaints and the line under them. */
let tradeRoot: Phaser.GameObjects.Container | null = null;
let tradeIndex = 0;
let tradeMessage = '';
let tradeRows: TradeRowObjects[] = [];
let tradeMessageText!: Phaser.GameObjects.BitmapText;

/** A route tile's centre in world pixels, the placement the scene draws entities at. */
const centerX = (tileX: number): number => tileX * TILE_SIZE + TILE_SIZE / 2;
const centerY = (tileY: number): number => tileY * TILE_SIZE + TILE_SIZE / 2;

/** The name a member reads by: its nickname, else the dex name, else the id. */
function memberName(member: RoomHost['run']['party'][number]): string {
  return (
    member.fighter.nickname ?? getSpecies(member.fighter.speciesId)?.name ?? member.fighter.speciesId
  );
}

/** A member row's label, the shipped `party.rowLabel` with an empty status. */
function memberLabel(host: RoomHost, memberId: string): string {
  const member = host.run.party.find((entry) => entry.fighter.id === memberId);
  if (!member) return '';
  return t('party.rowLabel', {
    name: memberName(member),
    level: member.fighter.level,
    status: '',
  });
}

/** The rows the window offers right now, rebuilt from the live run on every paint. */
function rows(host: RoomHost): readonly TradeRow[] {
  const used = isItemPicked(host.run, tradeId(host.view.mapIndex, host.view.roomId));
  if (used || !canTrade(host.run)) return [{ kind: 'leave' }];
  const members: TradeRow[] = host.run.party.map((member) => ({
    kind: 'member',
    memberId: member.fighter.id,
  }));
  return [...members, { kind: 'leave' }];
}

/** The line the window opens with, in the room's three states. */
function openingMessage(host: RoomHost): string {
  if (isItemPicked(host.run, tradeId(host.view.mapIndex, host.view.roomId))) {
    return t('trade.used');
  }
  return canTrade(host.run) ? t('trade.greeting') : t('trade.refused');
}

/**
 * Opens the trade window: only in a trade room, at the counter, and only while no
 * window is already up. It is modal, so it takes the keyboard off whatever HUD pane
 * held it.
 */
function openTrade(host: RoomHost): void {
  if (host.panelOpen()) return;
  host.releaseHudKeyboard();
  tradeIndex = 0;
  tradeMessage = openingMessage(host);
  panelHost = host;
  buildTradePanel(host);
  refreshTrade();
  host.openPanel(PANEL);
}

/** Tears the window down (the scene calls it when the room changes). */
function closeTrade(): void {
  if (!tradeRoot) return;
  tradeRoot.destroy(true);
  tradeRoot = null;
  tradeRows = [];
  panelHost = null;
}

/** Builds the window's static frame and its seven row objects once per open. */
function buildTradePanel(host: RoomHost): void {
  const scene = host.scene;
  const { width, height } = scene.scale;
  const x = (width - TRADE_W) / 2;
  const y = (height - TRADE_H) / 2;
  const left = x + TRADE_PAD;
  const right = x + TRADE_W - TRADE_PAD;
  const children: Phaser.GameObjects.GameObject[] = [
    scene.add.rectangle(0, 0, width, height, 0x05070c, 0.72).setOrigin(0, 0),
    addFrlgWindow(scene, x, y, TRADE_W, TRADE_H),
    addFrlgText(scene, left, y + 20, t('trade.title'), { size: 24, tint: FRLG_INK }),
  ];

  tradeRows = [];
  for (let i = 0; i < TRADE_ROWS; i++) {
    const rowY = y + 88 + i * TRADE_ROW_H;
    const highlight = scene.add
      .rectangle(
        left,
        rowY,
        TRADE_W - TRADE_PAD * 2,
        TRADE_ROW_H - 8,
        FRLG_SELECTED_FILL.colour,
        FRLG_SELECTED_FILL.alpha,
      )
      .setOrigin(0, 0)
      .setStrokeStyle(1, FRLG_SELECTED_STROKE.colour, FRLG_SELECTED_STROKE.alpha)
      .setVisible(false);
    const label = addFrlgText(scene, left + 16, rowY + 10, '', { size: 16, tint: FRLG_INK });
    const zone = scene.add
      .zone(left, rowY, TRADE_W - TRADE_PAD * 2, TRADE_ROW_H)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => {
      const open = panelHost;
      if (!open || i >= rows(open).length || i === tradeIndex) return;
      tradeIndex = i;
      refreshTrade();
    });
    zone.on('pointerdown', () => {
      const open = panelHost;
      if (!open || i >= rows(open).length) return;
      tradeIndex = i;
      refreshTrade();
      activateTradeRow(open);
    });
    tradeRows.push({ highlight, label });
    children.push(highlight, label, zone);
  }

  tradeMessageText = addFrlgText(scene, left, y + TRADE_H - 74, '', { size: 16, tint: FRLG_INK });
  children.push(
    tradeMessageText,
    addFrlgText(
      scene,
      right,
      y + TRADE_H - 42,
      t('trade.controls', {
        confirm: keyLabel(loadSettings().keybinds.confirm),
        cancel: keyLabel(loadSettings().keybinds.cancel),
      }),
      { size: 16, tint: FRLG_MUTED, origin: [1, 0] },
    ),
  );

  tradeRoot = scene.add.container(0, 0, children).setDepth(500);
  scene.cameras.main.ignore(tradeRoot);
}

/** Repaints the window for the live run, the cursor and the current line. */
function refreshTrade(): void {
  const host = panelHost;
  if (!tradeRoot || !host) return;
  const model = rows(host);
  tradeIndex = model.length === 0 ? 0 : Math.max(0, Math.min(tradeIndex, model.length - 1));
  tradeMessageText.setText(tradeMessage);
  tradeRows.forEach((rowObject, i) => {
    const row = model[i];
    const visible = row !== undefined;
    const selected = visible && i === tradeIndex;
    rowObject.highlight.setVisible(selected);
    rowObject.label.setVisible(visible);
    if (!row) {
      rowObject.label.setText('');
      return;
    }
    rowObject.label.setText(row.kind === 'member' ? memberLabel(host, row.memberId) : t('trade.leave'));
    rowObject.label.setTint(selected ? FRLG_ACCENT : FRLG_INK);
  });
}

/** The window's keys: move the cursor, trade/leave on `E`, close on `Q`. */
function handleTradeAction(host: RoomHost, action: KeybindAction): void {
  switch (action) {
    case 'up':
      moveTrade(-1);
      return;
    case 'down':
      moveTrade(1);
      return;
    case 'confirm':
    case 'interact':
      activateTradeRow(host);
      return;
    case 'cancel':
      host.closePanel();
      return;
    default:
      return;
  }
}

function moveTrade(delta: number): void {
  const host = panelHost;
  if (!host) return;
  const total = rows(host).length;
  if (total === 0) return;
  tradeIndex = (tradeIndex + delta + total) % total;
  refreshTrade();
}

/** Takes the highlighted row: a member trades, the leave row closes. */
function activateTradeRow(host: RoomHost): void {
  const row = rows(host)[tradeIndex];
  if (!row) return;
  if (row.kind === 'leave') {
    host.closePanel();
    return;
  }
  const result = tradePokemon(host.run, {
    memberId: row.memberId,
    mapIndex: host.view.mapIndex,
    roomId: host.view.roomId,
  });
  if (!result.ok) {
    tradeMessage =
      result.reason === 'used'
        ? t('trade.used')
        : result.reason === 'single-member'
          ? t('trade.refused')
          : t('trade.missing');
    refreshTrade();
    return;
  }
  host.commitRun(result.run);
  tradeMessage = t('trade.done', { name: memberName(result.received) });
  tradeIndex = 0;
  refreshTrade();
}

/** The window as the scene holds it: one panel, keyed while it owns the keyboard. */
const PANEL: RoomPanel = {
  handle(action) {
    const host = panelHost;
    if (!host) return;
    handleTradeAction(host, action);
  },
  close() {
    closeTrade();
  },
};

export const descriptor: RoomDescriptor = {
  kind: 'trade',
  marker: 'trade',
  // The counter is a fixture, so it sits on the room's farthest walkable tile and
  // the scene blocks movement on it (`D47`).
  fixture: (host) => ({ counter: host.farthestRoomTile() }),
  interact: (host, tile) => {
    const counter = host.counterTile();
    if (!counter || tile.x !== counter.x || tile.y !== counter.y) return false;
    // The window already owns the keyboard: a second press is the window's, so the
    // key is consumed without rebuilding it.
    if (host.panelOpen()) return true;
    openTrade(host);
    return true;
  },
  drawFixture: (host) => {
    if (host.generatorStepActive()) return;
    const counter = host.counterTile();
    if (!counter) return;
    host.scene.add
      .image(centerX(counter.x), centerY(counter.y), SHOP_COUNTER_TEXTURE_KEY)
      .setScale(TILE_SIZE / TRADE_COUNTER_SIZE)
      .setDepth(TRADE_COUNTER_DEPTH);
  },
  drawMarker: (graphics, cx, cy, radius) => {
    graphics.fillStyle(0x2f80ed, 1);
    graphics.fillRect(cx - radius, cy - radius * 0.6, radius * 2, radius * 0.5);
    graphics.fillTriangle(
      cx + radius * 0.2,
      cy - radius,
      cx + radius,
      cy - radius * 0.35,
      cx + radius * 0.2,
      cy + radius * 0.25,
    );
    graphics.fillStyle(0x56ccf2, 1);
    graphics.fillRect(cx - radius, cy + radius * 0.15, radius * 2, radius * 0.5);
    graphics.fillTriangle(
      cx - radius * 0.2,
      cy + radius,
      cx - radius,
      cy + radius * 0.35,
      cx - radius * 0.2,
      cy - radius * 0.25,
    );
  },
};
