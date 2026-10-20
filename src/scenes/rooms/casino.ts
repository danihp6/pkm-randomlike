import type Phaser from 'phaser';
import { CASINO, EGG_ITEM_ID } from '../../data/casino';
import { ITEM_ICON_SIZE, ITEM_ICON_TEXTURE_KEY, itemIconFrame } from '../../data/itemIcons';
import { getItem } from '../../data/items';
import { keyLabel, type KeybindAction } from '../../data/keybinds';
import {
  OVERWORLD_SPRITE_HEIGHT,
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
import { casinoGruntTrainerId, casinoSpin, type CasinoOutcome } from '../../ui/casino';
import {
  CASINO_CARD_H,
  CASINO_CARD_W,
  REEL_BAND_LEFT,
  REEL_BAND_TOP,
  REEL_COUNT,
  REEL_GAP,
  REEL_H,
  REEL_TICK_MS,
  REEL_W,
  reelFace,
  reelFaceIndex,
  reelRects,
  reelRestFace,
  reelStopAt,
  reelStrips,
  type ReelFace,
} from '../../ui/casinoReels';
import {
  FRLG_ACCENT,
  FRLG_MUTED,
  FRLG_ROW_FILL,
  FRLG_ROW_STROKE,
  FRLG_SELECTED_FILL,
  FRLG_SELECTED_STROKE,
  FRLG_TRACK,
  addFrlgWindow,
} from '../../ui/frlg';
import { FRLG_INK, addFrlgText } from '../../ui/frlgFont';
import { CASINO_MACHINE_TEXTURE_KEY, TRAINER_TEXTURE_KEY } from '../BootScene';
import type { RoomDescriptor, RoomHost, RoomPanel } from './types';

/**
 * The **casino** room (`docs/maps-spec.md` §7, D33, D47): the Team Rocket grunt's
 * slot machine. The window is the machine itself — a cabinet with three reels
 * whose faces are the band's drawn prizes, or the grunt's Rocket icon when the
 * booked outcome is the fight. `SPIN` and `LEAVE` answer the keys and the pointer.
 * The whole model is `src/ui/casino.ts` (the spin) and `src/ui/casinoReels.ts` (the
 * geometry, the faces and the schedule), so this module only draws the reveal of an
 * outcome that is already committed: no reload can re-roll or refund it.
 */

/** The window's chrome: 24 px padding, two 44 px rows under the reel band. */
const CASINO_PAD = 24;
const CASINO_ROW_H = 44;
const CASINO_ROWS = 2;
const CASINO_ROW_TOP = REEL_BAND_TOP + REEL_H + 16;

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

/** The three face images, the masks that clip them and the graphics those hold. */
let casinoReels: Phaser.GameObjects.Image[] = [];
let casinoMasks: Phaser.Display.Masks.GeometryMask[] = [];
let casinoMaskGraphics: Phaser.GameObjects.Graphics[] = [];

/** The booked outcome being revealed, its strips and where each reel has got to. */
let spinOutcome: CasinoOutcome | null = null;
let spinStrips: readonly (readonly ReelFace[])[] = [];
let spinShown: number[] = [];
let spinStopped: boolean[] = [];
let spinStartedAt = 0;
let spinning = false;
/** Every timer the reveal owns, removed on its end, a skip or the window's close. */
let spinTimers: Phaser.Time.TimerEvent[] = [];

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
  clearSpinTimers();
  spinning = false;
  spinOutcome = null;
  host.releaseHudKeyboard();
  casinoIndex = 0;
  casinoMessage = '';
  panelHost = host;
  buildCasinoPanel(host);
  refreshCasino();
  host.openPanel(PANEL);
}

/** Tears the window down: every timer, mask and the root, then the module state. */
function closeCasino(): void {
  clearSpinTimers();
  spinning = false;
  spinOutcome = null;
  spinStrips = [];
  spinShown = [];
  spinStopped = [];
  spinStartedAt = 0;
  for (const mask of casinoMasks) mask.destroy();
  for (const graphics of casinoMaskGraphics) graphics.destroy();
  casinoMasks = [];
  casinoMaskGraphics = [];
  casinoReels = [];
  casinoRows = [];
  panelHost = null;
  if (!casinoRoot) return;
  casinoRoot.destroy(true);
  casinoRoot = null;
}

/** Removes every timer the reveal scheduled, so a late callback paints nothing. */
function clearSpinTimers(): void {
  for (const timer of spinTimers) timer.remove();
  spinTimers = [];
}

/** Paints one reel's face: an item icon filling its window, or the Rocket sprite. */
function paintFace(reel: number, face: ReelFace): void {
  const image = casinoReels[reel];
  if (!image) return;
  if (face.kind === 'rocket') {
    const frame = overworldSpriteFrame('rocket');
    if (frame !== null) {
      image
        .setTexture(OVERWORLD_SPRITE_TEXTURE_KEY, frame)
        .setScale(REEL_H / OVERWORLD_SPRITE_HEIGHT)
        .clearTint();
    } else {
      image
        .setTexture(TRAINER_TEXTURE_KEY)
        .setScale(REEL_H / OVERWORLD_SPRITE_HEIGHT)
        .setTint(CASINO_GRUNT_COLOUR);
    }
    return;
  }
  const frame = itemIconFrame(face.itemId);
  if (frame !== null) image.setTexture(ITEM_ICON_TEXTURE_KEY, frame);
  else image.setTexture(ITEM_ICON_TEXTURE_KEY);
  image.setScale(REEL_W / ITEM_ICON_SIZE).clearTint();
}

/** Builds the window's static frame: the cabinet, its three clipped reels and the rows. */
function buildCasinoPanel(host: RoomHost): void {
  const scene = host.scene;
  const { width, height } = scene.scale;
  const cardX = (width - CASINO_CARD_W) / 2;
  const cardY = (height - CASINO_CARD_H) / 2;
  const left = cardX + CASINO_PAD;
  const right = cardX + CASINO_CARD_W - CASINO_PAD;
  const band = bandForMap(host.run.mapIndex).id;
  const children: Phaser.GameObjects.GameObject[] = [
    scene.add.rectangle(0, 0, width, height, 0x05070c, 0.72).setOrigin(0, 0),
    addFrlgWindow(scene, cardX, cardY, CASINO_CARD_W, CASINO_CARD_H),
    addFrlgText(scene, cardX + CASINO_PAD, cardY + 16, t('casino.title'), {
      size: 24,
      tint: FRLG_INK,
    }),
  ];

  casinoMoneyText = addFrlgText(scene, right, cardY + 20, '', {
    size: 16,
    tint: FRLG_MUTED,
    origin: [1, 0],
  });
  children.push(casinoMoneyText);

  // The cabinet: one recessed field behind the three windows, then the windows
  // themselves. Only chrome tones fill or stroke them (`src/ui/README.md` rule 3).
  const bandX = cardX + REEL_BAND_LEFT;
  const bandY = cardY + REEL_BAND_TOP;
  const fieldW = REEL_COUNT * REEL_W + (REEL_COUNT - 1) * REEL_GAP + 16;
  children.push(
    scene.add
      .rectangle(bandX - 8, bandY - 8, fieldW, REEL_H + 16, FRLG_TRACK.colour, FRLG_TRACK.alpha)
      .setOrigin(0, 0)
      .setStrokeStyle(1, FRLG_ROW_STROKE.colour, FRLG_ROW_STROKE.alpha),
  );

  casinoReels = [];
  casinoMasks = [];
  casinoMaskGraphics = [];
  const rects = reelRects(cardX, cardY);
  for (let reel = 0; reel < REEL_COUNT; reel++) {
    const rect = rects[reel];
    children.push(
      scene.add
        .rectangle(rect.x, rect.y, rect.w, rect.h, FRLG_ROW_FILL.colour, FRLG_ROW_FILL.alpha)
        .setOrigin(0, 0)
        .setStrokeStyle(1, FRLG_ROW_STROKE.colour, FRLG_ROW_STROKE.alpha),
    );
    const image = scene.add.image(rect.x, rect.y, ITEM_ICON_TEXTURE_KEY).setOrigin(0, 0);
    const maskGraphics = scene.make.graphics();
    maskGraphics.fillRect(rect.x, rect.y, rect.w, rect.h);
    const mask = maskGraphics.createGeometryMask();
    image.setMask(mask);
    casinoMaskGraphics.push(maskGraphics);
    casinoMasks.push(mask);
    casinoReels.push(image);
    children.push(image);
    paintFace(reel, reelRestFace(band, reel));
  }

  // A press anywhere on the card skips a running reveal; the two row zones below
  // sit over it, so an idle press still lands on its own row.
  const cardZone = scene.add
    .zone(cardX, cardY, CASINO_CARD_W, CASINO_CARD_H)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });
  cardZone.on('pointerdown', () => {
    if (spinning) skipReveal(host);
  });
  children.push(cardZone);

  casinoRows = [];
  const rowW = CASINO_CARD_W - CASINO_PAD * 2;
  for (let i = 0; i < CASINO_ROWS; i++) {
    const rowY = cardY + CASINO_ROW_TOP + i * CASINO_ROW_H;
    const highlight = scene.add
      .rectangle(left, rowY, rowW, CASINO_ROW_H - 6, FRLG_SELECTED_FILL.colour, FRLG_SELECTED_FILL.alpha)
      .setOrigin(0, 0)
      .setStrokeStyle(1, FRLG_SELECTED_STROKE.colour, FRLG_SELECTED_STROKE.alpha)
      .setVisible(false);
    const label = addFrlgText(scene, left + 16, rowY + 10, '', { size: 16, tint: FRLG_INK });
    const zone = scene.add
      .zone(left, rowY, rowW, CASINO_ROW_H)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => {
      if (spinning || casinoIndex === i) return;
      casinoIndex = i;
      refreshCasino();
    });
    zone.on('pointerdown', () => pressRow(host, i));
    casinoRows.push({ highlight, label });
    children.push(highlight, label, zone);
  }

  casinoMessageText = addFrlgText(scene, left, cardY + CASINO_CARD_H - 68, '', {
    size: 16,
    tint: FRLG_INK,
  });
  children.push(
    casinoMessageText,
    addFrlgText(
      scene,
      right,
      cardY + CASINO_CARD_H - 38,
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
    const selected = !spinning && i === casinoIndex;
    row.highlight.setVisible(selected);
    row.label.setText(i === 0 ? t('casino.spin', { price }) : t('casino.leave'));
    row.label.setTint(spinning ? FRLG_MUTED : selected ? FRLG_ACCENT : FRLG_INK);
  });
  casinoMessageText.setText(casinoMessage);
}

/** The window's keys: move the cursor, spin/leave on `E`, close on `Q`. */
function handleCasinoAction(host: RoomHost, action: KeybindAction): void {
  if (spinning) {
    if (action === 'confirm' || action === 'interact') skipReveal(host);
    return;
  }
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

/** A row's own press: while a reveal runs it is the skip, otherwise it takes the row. */
function pressRow(host: RoomHost, index: number): void {
  if (spinning) {
    skipReveal(host);
    return;
  }
  casinoIndex = index;
  refreshCasino();
  activateCasinoRow(host);
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
 * One spin, in the order that makes a reload harmless: the model decides, the run
 * is **committed before the first frame**, then the three strips and their timers
 * are laid over the freshly booked run. A refusal paints its reason and leaves no
 * timer and no committed run behind.
 */
function spinCasino(host: RoomHost): void {
  if (spinning) return;
  const spin = casinoSpin(host.run);
  if (!spin.ok || !spin.outcome) {
    casinoMessage = spin.reason === 'locked' ? t('casino.locked') : t('casino.noMoney');
    refreshCasino();
    return;
  }
  host.commitRun(spin.run);
  const scene = host.scene;
  const outcome = spin.outcome;
  casinoMessage = '';
  casinoIndex = 0;
  spinOutcome = outcome;
  spinStrips = reelStrips(bandForMap(host.run.mapIndex).id, outcome);
  spinShown = new Array<number>(REEL_COUNT).fill(0);
  spinStopped = new Array<boolean>(REEL_COUNT).fill(false);
  spinStartedAt = scene.time.now;
  spinning = true;
  refreshCasino();

  for (let reel = 0; reel < REEL_COUNT; reel++) {
    paintFace(reel, spinStrips[reel][0]);
  }
  for (let reel = 0; reel < REEL_COUNT; reel++) {
    spinTimers.push(scene.time.delayedCall(reelStopAt(reel), () => stopReel(host, reel)));
  }
  spinTimers.push(
    scene.time.addEvent({
      delay: REEL_TICK_MS,
      loop: true,
      callback: () => tickReveal(host),
    }),
  );
}

/** One tick of the reveal: each unstoppered reel steps only when its face changes. */
function tickReveal(host: RoomHost): void {
  if (!spinning || !casinoRoot) return;
  const elapsed = host.scene.time.now - spinStartedAt;
  for (let reel = 0; reel < REEL_COUNT; reel++) {
    if (spinStopped[reel]) continue;
    const index = reelFaceIndex(reel, elapsed);
    if (index === spinShown[reel]) continue;
    spinShown[reel] = index;
    paintFace(reel, spinStrips[reel][index]);
  }
}

/** One reel's stop: it freezes on the outcome, and the last stop ends the reveal. */
function stopReel(host: RoomHost, reel: number): void {
  if (!spinning || !casinoRoot) return;
  const strip = spinStrips[reel];
  if (!strip) return;
  spinStopped[reel] = true;
  const index = strip.length - 1;
  spinShown[reel] = index;
  paintFace(reel, strip[index]);
  if (reel === REEL_COUNT - 1) finishReveal(host);
}

/** The skip: every reel freezes on the booked face and the reveal ends at once. */
function skipReveal(host: RoomHost): void {
  if (!spinning) return;
  clearSpinTimers();
  if (spinOutcome) {
    const face = reelFace(spinOutcome);
    for (let reel = 0; reel < REEL_COUNT; reel++) {
      spinStopped[reel] = true;
      spinShown[reel] = spinStrips[reel].length - 1;
      paintFace(reel, face);
    }
  }
  finishReveal(host);
}

/**
 * Ends the reveal: an item or the Egg names what the bag just gained, the fight
 * closes the window **before** the battle opens, exactly the shipped grunt path.
 */
function finishReveal(host: RoomHost): void {
  if (!spinning) return;
  spinning = false;
  clearSpinTimers();
  const outcome = spinOutcome;
  spinOutcome = null;
  spinStrips = [];
  spinShown = [];
  spinStopped = [];
  if (!outcome) {
    refreshCasino();
    return;
  }
  if (outcome.kind === 'battle') {
    // The machine is out of order from here on, which is the line the reopened
    // window would print; the window goes first so the battle takes the screen.
    casinoMessage = t('casino.locked');
    const machine = machineOf(host);
    host.closePanel();
    if (machine) host.startTrainerBattle(gruntFor(host, machine));
    return;
  }
  const itemId = outcome.kind === 'item' ? outcome.itemId : EGG_ITEM_ID;
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
