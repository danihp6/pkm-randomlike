import type Phaser from 'phaser';
import { CASINO, EGG_ITEM_ID } from '../../data/casino';
import { getItem } from '../../data/items';
import { keyLabel, type KeybindAction } from '../../data/keybinds';
import {
  OVERWORLD_SPRITE_TEXTURE_KEY,
  OVERWORLD_SPRITE_WIDTH,
  overworldSpriteFrame,
} from '../../data/overworldSprites';
import type { Tile } from '../../engine/grid';
import type { RouteTrainer } from '../../engine/routes';
import { DEFAULT_TRAINER_SIGHT } from '../../engine/routes';
import { bandForMap } from '../../engine/run';
import { TILE_SIZE } from '../../engine/tileset';
import { t } from '../../i18n';
import { trainerFacingPose } from '../../render/trainerAnim';
import { loadSettings } from '../../settings';
import {
  FRLG_ACCENT,
  FRLG_MUTED,
  FRLG_SELECTED_FILL,
  FRLG_SELECTED_STROKE,
  addFrlgWindow,
} from '../../ui/frlg';
import { FRLG_INK, addFrlgText } from '../../ui/frlgFont';
import { casinoGruntTrainerId, casinoSpin } from '../../ui/casino';
import { CASINO_MACHINE_TEXTURE_KEY, TRAINER_TEXTURE_KEY } from '../BootScene';
import type { RoomDescriptor, RoomHost, RoomPanel } from './types';

/**
 * The **casino** room (`docs/maps-spec.md` §7, D33, D47): the Team Rocket grunt's
 * slot machine. Paying a spin spends the floor band's price and pays an item, an
 * Egg or the fight against the grunt — which locks the machine for the floor. The
 * counter fixture is the room's own tile, the window is this module's own
 * `RoomPanel` (the Mart's pattern) and the whole model is `src/ui/casino.ts`, so
 * the scene is not edited beyond the two `RoomHost` hooks the port gains.
 */

/** The window's own geometry: two rows of 44 px inside a 460x220 card. */
const CASINO_W = 460;
const CASINO_H = 220;
const CASINO_PAD = 24;
const CASINO_ROW_H = 44;
const CASINO_ROWS = 2;

/** The machine texture's own pixel size, and the depth the two sprites draw at. */
const CASINO_MACHINE_SIZE = 22;
const CASINO_CABINET_DEPTH = 5;
const CASINO_GRUNT_DEPTH = 6;

/** The grunt stands on the machine's tile, `-14` px left so it overlaps the cabinet. */
const CASINO_GRUNT_OFFSET_X = -14;
/** The Rocket grunt's own red, the placeholder's tint until the atlas carries it. */
const CASINO_GRUNT_COLOUR = 0xc0392b;

/** The machine's own glyph: a cabinet outline with three reels. */
const CASINO_MARKER_INK = 0x0f766e;
const CASINO_MARKER_REEL = 0x2ec4b6;

type CasinoRowObjects = {
  highlight: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.BitmapText;
};

/** The host the open machine belongs to, or null while no window is up. */
let panelHost: RoomHost | null = null;
/** The window: its root, the row objects it repaints and the line under them. */
let casinoRoot: Phaser.GameObjects.Container | null = null;
let casinoIndex = 0;
let casinoMessage = '';
let casinoRows: CasinoRowObjects[] = [];
let casinoMoneyText!: Phaser.GameObjects.BitmapText;
let casinoMessageText!: Phaser.GameObjects.BitmapText;

/** A route tile's centre in world pixels, the placement the scene draws entities at. */
const centerX = (tileX: number): number => tileX * TILE_SIZE + TILE_SIZE / 2;
const centerY = (tileY: number): number => tileY * TILE_SIZE + TILE_SIZE / 2;

/** The machine's tile: the room's fixture counter, or null when there is none. */
function machineOf(host: RoomHost): Tile | null {
  return host.counterTile();
}

/**
 * Opens the machine's window: only in a casino room, at the counter, and only
 * while no window is already up. It is modal, so it takes the keyboard off
 * whatever HUD pane held it. A **locked** machine opens too — that is where the
 * `out of order` line lives; it is the spin the model refuses, not the window.
 */
function openCasino(host: RoomHost): void {
  if (host.panelOpen()) return;
  host.releaseHudKeyboard();
  casinoIndex = 0;
  casinoMessage = '';
  panelHost = host;
  buildCasinoPanel(host);
  refreshCasino();
  host.openPanel(PANEL);
}

/** Tears the window down (the scene calls it when the room changes or a battle opens). */
function closeCasino(): void {
  if (!casinoRoot) return;
  casinoRoot.destroy(true);
  casinoRoot = null;
  casinoRows = [];
  panelHost = null;
}

/** Builds the window's static frame and its two rows once per open. */
function buildCasinoPanel(host: RoomHost): void {
  const scene = host.scene;
  const { width, height } = scene.scale;
  const x = (width - CASINO_W) / 2;
  const y = (height - CASINO_H) / 2;
  const left = x + CASINO_PAD;
  const right = x + CASINO_W - CASINO_PAD;
  const children: Phaser.GameObjects.GameObject[] = [
    scene.add.rectangle(0, 0, width, height, 0x05070c, 0.72).setOrigin(0, 0),
    addFrlgWindow(scene, x, y, CASINO_W, CASINO_H),
    addFrlgText(scene, left, y + 16, t('casino.title'), { size: 24, tint: FRLG_INK }),
  ];
  casinoMoneyText = addFrlgText(scene, right, y + 20, '', {
    size: 16,
    tint: FRLG_MUTED,
    origin: [1, 0],
  });
  children.push(casinoMoneyText);

  casinoRows = [];
  for (let i = 0; i < CASINO_ROWS; i++) {
    const rowY = y + 60 + i * CASINO_ROW_H;
    const highlight = scene.add
      .rectangle(
        left,
        rowY,
        CASINO_W - CASINO_PAD * 2,
        CASINO_ROW_H - 6,
        FRLG_SELECTED_FILL.colour,
        FRLG_SELECTED_FILL.alpha,
      )
      .setOrigin(0, 0)
      .setStrokeStyle(1, FRLG_SELECTED_STROKE.colour, FRLG_SELECTED_STROKE.alpha)
      .setVisible(false);
    const label = addFrlgText(scene, left + 16, rowY + 10, '', { size: 16, tint: FRLG_INK });
    casinoRows.push({ highlight, label });
    children.push(highlight, label);
  }

  casinoMessageText = addFrlgText(scene, left, y + CASINO_H - 62, '', { size: 16, tint: FRLG_INK });
  children.push(
    casinoMessageText,
    addFrlgText(
      scene,
      right,
      y + CASINO_H - 34,
      t('casino.controls', {
        confirm: keyLabel(loadSettings().keybinds.confirm),
        cancel: keyLabel(loadSettings().keybinds.cancel),
      }),
      { size: 16, tint: FRLG_MUTED, origin: [1, 0] },
    ),
  );

  casinoRoot = scene.add.container(0, 0, children).setDepth(500);
  scene.cameras.main.ignore(casinoRoot);
}

/** Repaints the window for the run's own money, the floor's price and the cursor. */
function refreshCasino(): void {
  const host = panelHost;
  if (!casinoRoot || !host) return;
  const price = CASINO.price[bandForMap(host.run.mapIndex).id];
  casinoMoneyText.setText(t('casino.money', { amount: host.run.money }));
  casinoRows.forEach((row, i) => {
    const selected = i === casinoIndex;
    row.highlight.setVisible(selected);
    row.label.setText(i === 0 ? t('casino.spin', { price }) : t('casino.leave'));
    row.label.setTint(selected ? FRLG_ACCENT : FRLG_INK);
  });
  casinoMessageText.setText(casinoMessage);
}

/** The window's keys: move the cursor, spin/leave on `E`, close on `Q`. */
function handleCasinoAction(host: RoomHost, action: KeybindAction): void {
  switch (action) {
    case 'up':
      moveCasino(-1);
      return;
    case 'down':
      moveCasino(1);
      return;
    case 'confirm':
    case 'interact':
      activateCasinoRow(host);
      return;
    case 'cancel':
      host.closePanel();
      return;
    default:
      return;
  }
}

function moveCasino(delta: number): void {
  casinoIndex = (casinoIndex + delta + CASINO_ROWS) % CASINO_ROWS;
  refreshCasino();
}

/** Takes the highlighted row: the spin pays, the leave row closes. */
function activateCasinoRow(host: RoomHost): void {
  if (casinoIndex !== 0) {
    host.closePanel();
    return;
  }
  spinCasino(host);
}

/**
 * One spin: the model decides, the window only reports. A refusal sets the reason
 * and repaints. A paying spin commits the run, and the outcome names the prize —
 * or, for the fight, closes the window **before** the battle opens, so no window
 * survives into it.
 */
function spinCasino(host: RoomHost): void {
  const spin = casinoSpin(host.run);
  if (!spin.ok) {
    casinoMessage = spin.reason === 'locked' ? t('casino.locked') : t('casino.noMoney');
    refreshCasino();
    return;
  }
  host.commitRun(spin.run);
  const outcome = spin.outcome;
  if (outcome?.kind === 'battle') {
    // The machine is out of order from here on, which is the line the reopened
    // window would print; the window goes first so the battle takes the screen.
    casinoMessage = t('casino.locked');
    const machine = machineOf(host);
    host.closePanel();
    if (machine) host.startTrainerBattle(gruntFor(host, machine));
    return;
  }
  const itemId = outcome?.kind === 'item' ? outcome.itemId : EGG_ITEM_ID;
  casinoMessage = t('notice.itemObtained', { name: getItem(itemId)?.name ?? itemId });
  refreshCasino();
}

/**
 * The grunt the machine may serve: the floor's own stable id, standing on the
 * machine's tile. It is a **set-piece**, so it is never appended to the route's
 * trainers — it has no sight, it never chases and it never blocks a tile — and
 * `startTrainerBattle` re-checks `isTrainerDefeated`, so a beaten grunt cannot be
 * fought twice on a floor.
 */
function gruntFor(host: RoomHost, machine: Tile): RouteTrainer {
  return {
    id: casinoGruntTrainerId(host.view.mapIndex),
    position: machine,
    facing: host.facingFromTo(machine, host.entryTile()),
    sight: DEFAULT_TRAINER_SIGHT,
    archetypeId: 'rocket',
  };
}

/** The window as the scene holds it: one panel, keyed while it owns the keyboard. */
const PANEL: RoomPanel = {
  handle(action) {
    const host = panelHost;
    if (!host) return;
    handleCasinoAction(host, action);
  },
  close() {
    closeCasino();
  },
};

/** Draws the machine's cabinet and the grunt beside it, each at its own depth. */
function drawMachine(host: RoomHost, machine: Tile): void {
  const scene = host.scene;
  scene.add
    .image(centerX(machine.x), centerY(machine.y), CASINO_MACHINE_TEXTURE_KEY)
    .setScale(TILE_SIZE / CASINO_MACHINE_SIZE)
    .setDepth(CASINO_CABINET_DEPTH);
  const x = centerX(machine.x) + CASINO_GRUNT_OFFSET_X;
  const footY = centerY(machine.y) + TILE_SIZE / 2;
  const frame = overworldSpriteFrame('rocket');
  const sprite =
    frame !== null
      ? scene.add
          .sprite(x, footY, OVERWORLD_SPRITE_TEXTURE_KEY, frame)
          .setOrigin(0.5, 1)
          .setScale(TILE_SIZE / OVERWORLD_SPRITE_WIDTH)
      : scene.add.sprite(x, footY, TRAINER_TEXTURE_KEY).setOrigin(0.5, 1).setTint(CASINO_GRUNT_COLOUR);
  const pose = trainerFacingPose(host.facingFromTo(machine, host.entryTile()));
  sprite.setFlipX(pose.flipX);
  if (frame !== null) {
    const posed = overworldSpriteFrame('rocket', pose.facing);
    if (posed !== null) sprite.setFrame(posed);
  }
  sprite.setDepth(CASINO_GRUNT_DEPTH);
}

export const descriptor: RoomDescriptor = {
  kind: 'casino',
  marker: 'casino',
  // The machine is a fixture, so it sits on the room's farthest walkable tile and
  // the scene blocks movement on it (`D47`).
  fixture: (host) => ({ counter: host.farthestRoomTile() }),
  interact: (host, tile) => {
    const machine = machineOf(host);
    if (!machine || tile.x !== machine.x || tile.y !== machine.y) return false;
    // The window already owns the keyboard: a second press is the window's, so the
    // key is consumed without rebuilding it.
    if (host.panelOpen()) return true;
    openCasino(host);
    return true;
  },
  drawFixture: (host) => {
    if (host.generatorStepActive()) return;
    const machine = machineOf(host);
    if (!machine) return;
    drawMachine(host, machine);
  },
  drawMarker: (graphics, cx, cy, radius) => {
    graphics.lineStyle(2, CASINO_MARKER_INK, 1);
    graphics.strokeRect(cx - radius, cy - radius, radius * 2, radius * 2);
    graphics.fillStyle(CASINO_MARKER_REEL, 1);
    graphics.fillCircle(cx - radius * 0.62, cy, radius * 0.34);
    graphics.fillCircle(cx, cy, radius * 0.34);
    graphics.fillCircle(cx + radius * 0.62, cy, radius * 0.34);
  },
};
