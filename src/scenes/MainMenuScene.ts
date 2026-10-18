import Phaser from 'phaser';
import { playMusic } from '../audio/audio';
import { keyLabel, type KeybindAction } from '../data/keybinds';
import { PORTRAIT_SIZE, portraitFor } from '../data/portraits';
import { hasLivingParty, type RunState } from '../engine/run';
import { randomSeed } from '../engine/rng';
import { loadSave, type Settings } from '../engine/save';
import { subscribeKeybinds } from '../input/input';
import { t, type TranslationKey } from '../i18n';
import { loadSettings } from '../settings';
import { browserStorage } from '../storage';
import { addFrlgWindow } from '../ui/frlg';
import { FRLG_INK, addFrlgText } from '../ui/frlgFont';
import { runPositionLabel } from '../ui/runSummary';

/** The three things the menu can do; `continue` only exists with a saved run. */
type MenuAction = 'continue' | 'new' | 'options';

/** The row labels as keys: a table of translated strings would freeze the locale. */
const MENU_LABELS: Readonly<Record<MenuAction, TranslationKey>> = {
  continue: 'menu.continue',
  new: 'menu.new',
  options: 'menu.options',
};

function menuLabel(action: MenuAction): string {
  return t(MENU_LABELS[action]);
}

const PANEL_W = 460;
const ROW_H = 60;
const ROW_GAP = 2;
const ROW_TOP = 56;

/** The party portraits in the Continue row: pitch, drawn size and the gap to the value. */
const MENU_ICON_PITCH = 32;
const MENU_ICON_SCALE = 0.44; // a 64px portrait cell draws 28px
const MENU_ICON_VALUE_GAP = 10;
const MENU_ICON_DRAW = PORTRAIT_SIZE * MENU_ICON_SCALE;

type RowView = {
  highlight: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.BitmapText;
  value: Phaser.GameObjects.BitmapText;
  portraits: Phaser.GameObjects.Image[];
};

/**
 * The landing screen (Phase 7): the hub the game boots on. It offers a **new
 * run** (the starter pick, with a fresh seed), **continue** (the run left in
 * progress, shown only when the save holds one that still has a living party)
 * and the **options** (the settings screen, launched paused-on-top).
 *
 * The run is never cleared here; a new run only replaces the old one once its
 * starter is picked and the route writes itself to the save, so an accidental
 * "new run" is undone by cancelling at the starter pick. Keyboard and mouse both
 * pick a row, and the shared keybind map drives it so a rebind reaches it too.
 */
export class MainMenuScene extends Phaser.Scene {
  private run: RunState | null = null;
  private settings!: Settings;
  private items: MenuAction[] = [];
  private index = 0;
  private rows: RowView[] = [];
  private controls!: Phaser.GameObjects.BitmapText;

  constructor() {
    super('MainMenu');
  }

  create(): void {
    this.settings = loadSettings();
    const save = loadSave(browserStorage());
    this.run = save.run && hasLivingParty(save.run) ? save.run : null;
    // Offer "continue" first when there is a run to resume, then "new run".
    this.items = this.run ? ['continue', 'new', 'options'] : ['new', 'options'];
    this.index = 0;

    const { width, height } = this.scale;
    const panelH = ROW_TOP + this.items.length * (ROW_H + ROW_GAP) + 20;
    const x = (width - PANEL_W) / 2;
    const y = (height - panelH) / 2 + 24;

    this.add.rectangle(0, 0, width, height, 0x10161f).setOrigin(0, 0);
    addFrlgText(this, width / 2, y - 128, t('menu.title'), { size: 48, origin: 0.5 });
    addFrlgText(this, width / 2, y - 76, t('menu.subtitle'), {
      size: 16,
      tint: 0x94a3b8,
      origin: 0.5,
    });

    addFrlgWindow(this, x, y, PANEL_W, panelH);
    const rowX = x + 20;
    const rowW = PANEL_W - 40;
    this.rows = this.items.map((action, i) => {
      const rowY = y + ROW_TOP + i * (ROW_H + ROW_GAP);
      const highlight = this.add
        .rectangle(rowX, rowY, rowW, ROW_H - 6, 0xf2c14e, 0.28)
        .setOrigin(0, 0)
        .setVisible(false);
      const label = addFrlgText(this, rowX + 20, rowY + 14, menuLabel(action), {
        size: 24,
        tint: FRLG_INK,
      });
      const value = addFrlgText(this, rowX + rowW - 20, rowY + 20, this.rowValue(action), {
        size: 16,
        tint: 0x3a3956,
        origin: [1, 0],
      });
      // The party portraits ride between the label and the value, right-aligned
      // against it. The cell's centre (origin 0.5) sits half a drawn cell left of
      // the block's right edge, so `MENU_ICON_VALUE_GAP` is the gap the value
      // text's left edge actually measures. An empty slot is a member the atlas
      // has no cell for: it keeps its place so the party's order still reads.
      const portraits: Phaser.GameObjects.Image[] = [];
      const members = action === 'continue' && this.run ? this.run.party : [];
      const blockRight = value.x - value.width - MENU_ICON_VALUE_GAP;
      members.forEach((member, slot) => {
        const portrait = portraitFor(member.fighter.speciesId, member.fighter.shiny);
        if (!portrait) return;
        const iconX = blockRight - MENU_ICON_DRAW / 2 - (members.length - 1 - slot) * MENU_ICON_PITCH;
        portraits.push(
          this.add
            .image(iconX, rowY + ROW_H / 2, portrait.key, portrait.frame)
            .setScale(MENU_ICON_SCALE),
        );
      });
      // The row is a click target: hovering moves the highlight, clicking picks.
      const zone = this.add.zone(rowX, rowY, rowW, ROW_H).setOrigin(0, 0);
      zone.setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => {
        this.index = i;
        this.render();
      });
      zone.on('pointerdown', () => {
        this.index = i;
        this.choose();
      });
      return { highlight, label, value, portraits };
    });

    this.controls = addFrlgText(this, width / 2, y + panelH + 24, '', {
      size: 16,
      tint: 0xa8b3c7,
      origin: 0.5,
    });

    subscribeKeybinds(
      this,
      ({ action }) => this.handleAction(action),
      () => this.settings.keybinds,
    );
    // Coming back from the options: re-read them so a rebind refreshes the hints.
    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      this.settings = loadSettings();
      playMusic(this, 'menu-music');
      this.render();
    });
    playMusic(this, 'menu-music');
    this.render();
  }

  /** The right-hand value of a row: the map a saved run stands on and its biome. */
  private rowValue(action: MenuAction): string {
    if (action === 'continue' && this.run) return runPositionLabel(this.run);
    return '';
  }

  /** The player's intent behind one shared action, from a key or the touch pad. */
  private handleAction(action: KeybindAction): void {
    switch (action) {
      case 'up':
        this.move(-1);
        return;
      case 'down':
        this.move(1);
        return;
      case 'confirm':
        this.choose();
        return;
      case 'settings':
        this.openOptions();
        return;
    }
  }

  private move(delta: number): void {
    if (this.items.length === 0) return;
    this.index = (this.index + delta + this.items.length) % this.items.length;
    this.render();
  }

  private choose(): void {
    switch (this.items[this.index]) {
      case 'continue':
        if (this.run) this.scene.start('Route', { run: this.run });
        return;
      case 'new':
        // A fresh seed for the starter offer; the old run is replaced only once
        // the new one is written, so cancelling at the starter pick keeps it.
        this.scene.start('Starter', { seed: randomSeed() });
        return;
      case 'options':
        this.openOptions();
        return;
    }
  }

  /** Opens the settings screen paused-on-top; it resumes this scene on close. */
  private openOptions(): void {
    // A repeated press (or the settings key landing twice) must not pause a
    // scene that is already paused under the settings screen.
    if (this.scene.isPaused()) return;
    this.scene.pause();
    this.scene.launch('Settings', { from: 'MainMenu' });
  }

  private render(): void {
    this.rows.forEach((row, i) => row.highlight.setVisible(i === this.index));
    const { up, down, confirm, settings } = this.settings.keybinds;
    this.controls.setText(
      t('menu.controls', {
        up: keyLabel(up),
        down: keyLabel(down),
        confirm: keyLabel(confirm),
        settings: keyLabel(settings),
      }),
    );
  }
}
