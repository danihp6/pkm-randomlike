import Phaser from 'phaser';
import { playMusic } from '../audio/audio';
import { keyLabel, type KeybindAction } from '../data/keybinds';
import { PORTRAIT_SIZE, portraitFor } from '../data/portraits';
import type { RunHistoryRecord } from '../engine/run/history';
import { hasLivingParty, type RunState } from '../engine/run';
import { randomSeed } from '../engine/rng';
import { loadSave, type Settings } from '../engine/save';
import { subscribeKeybinds } from '../input/input';
import { t, type TranslationKey } from '../i18n';
import { fetchRanking, loadRankingEndpoint, rankingDeviceId, type RankingBoard } from '../net/ranking';
import { loadSettings } from '../settings';
import { browserStorage } from '../storage';
import {
  addFrlgWindow,
  FRLG_MUTED,
  FRLG_SELECTED_FILL,
  FRLG_SELECTED_STROKE,
  FRLG_SURFACE,
} from '../ui/frlg';
import { FRLG_INK, addFrlgText } from '../ui/frlgFont';
import { parseHudFlags } from '../ui/hud/fixtures';
import {
  EMPTY_MAIN_MENU_RECORDS,
  MAIN_MENU_ACTIONS,
  installMainMenuPreview,
  liveMainMenuView,
  mainMenuPreviewRequested,
  mainMenuRecords,
  menuVersionLabel,
  mountMainMenu,
  type MainMenuAction,
  type MainMenuHandle,
  type MainMenuIntent,
  type MainMenuRecords,
  type MainMenuView,
} from '../ui/hud/panels/main-menu';
import {
  installStatsPreview,
  liveStatsView,
  mountStats,
  statsMonths,
  statsPreviewRequested,
  type StatsHandle,
  type StatsIntent,
  type StatsMode,
  type StatsView,
} from '../ui/hud/panels/stats';
import { runPositionLabel } from '../ui/runSummary';

/** The five things the menu can do; `continue` only exists with a saved run. */
type MenuAction = 'continue' | 'new' | 'options' | 'stats' | 'ranking';

/** The row labels as keys: a table of translated strings would freeze the locale. */
const MENU_LABELS: Readonly<Record<MenuAction, TranslationKey>> = {
  continue: 'menu.continue',
  new: 'menu.new',
  options: 'menu.options',
  stats: 'menu.stats',
  ranking: 'stats.actionRanking',
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
 * `?hud=dom` read once (`D49`): with it on this scene draws no Phaser object and
 * mounts the Preact menu in the `#hud` layer instead. The fixture preview mounts
 * on its own, even before the scene is ever opened, so `?hudFixture=01-main-menu`
 * can be screenshotted without walking the game.
 */
const DOM_HUD = typeof window === 'undefined' ? false : parseHudFlags(window.location.search).dom;
installMainMenuPreview(typeof window === 'undefined' ? '' : window.location.search);
installStatsPreview(typeof window === 'undefined' ? '' : window.location.search);

/** The number of display objects the menu draws right now: 0 under `?hud=dom`. */
export function mainMenuDrawnObjectCount(scene: Phaser.Scene): number {
  return scene.children.length;
}

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
  /** True on the DOM path, so `render` paints the panel instead of the rows. */
  private dom = false;
  /** The decorative route window's seed: drawn once per boot, never saved. */
  private previewSeed = '';
  /** The mounted DOM menu (`?hud=dom`): the one emit point of the drawn menu. */
  private controller: MainMenuHandle | null = null;
  /** The finished runs the stats panel draws, read from the save on `create`. */
  private history: readonly RunHistoryRecord[] = [];
  /** The footer's live figures, read from the same history once on `create`. */
  private records: MainMenuRecords = EMPTY_MAIN_MENU_RECORDS;
  /** The build's version line, assembled once; a repaint never rebuilds it. */
  private versionLabel: string = menuVersionLabel();
  /** The mounted stats panel and the mode and month it is drawn for. */
  private stats: StatsHandle | null = null;
  private statsOpen = false;
  private statsMode: StatsMode = 'totals';
  private statsMonth: string | null = null;
  /** The month's global board the ranking view draws; null is the device's own record. */
  private globalRanking: RankingBoard | null = null;
  /** The endpoint `ranking.json` named, resolved once; `undefined` = not asked yet. */
  private rankingEndpoint: string | null | undefined;

  constructor() {
    super('MainMenu');
  }

  create(): void {
    this.settings = loadSettings();
    this.previewSeed = randomSeed();
    const save = loadSave(browserStorage());
    this.run = save.run && hasLivingParty(save.run) ? save.run : null;
    this.history = save.history;
    this.records = mainMenuRecords(this.history, new Date());
    // Offer "continue" first when there is a run to resume, then "new run".
    this.items = this.run ? ['continue', 'new', 'options'] : ['new', 'options'];
    this.index = 0;

    if (DOM_HUD) {
      this.dom = true;
      this.createDom();
    } else {
      this.draw();
    }

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

  /** The live view both the mount and every repaint read, so the panel cannot drift. */
  private menuView(): MainMenuView {
    return liveMainMenuView(this.run, this.index, this.previewSeed, this.records, this.versionLabel);
  }

  /** The flag-on build: the same rows, no Phaser object, one panel in `#hud`. */
  private createDom(): void {
    const view = this.menuView();
    this.items = MAIN_MENU_ACTIONS.filter((id) => view.rows.some((row) => row.id === id));
    this.index = 0;
    // Either fixture preview paints its own frame and owns the layer; the scene then
    // steps aside instead of mounting a second panel on top of it.
    if (
      mainMenuPreviewRequested(window.location.search) ||
      statsPreviewRequested(window.location.search)
    ) {
      return;
    }
    this.mountPanel(view);
    if (this.controller === null) return;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.disposePanel());
  }

  /** The shipped drawing: the panel, its rows, the portraits and the controls line. */
  private draw(): void {
    const { width, height } = this.scale;
    const panelH = ROW_TOP + this.items.length * (ROW_H + ROW_GAP) + 20;
    const x = (width - PANEL_W) / 2;
    const y = (height - panelH) / 2 + 24;

    this.add.rectangle(0, 0, width, height, FRLG_SURFACE).setOrigin(0, 0);
    addFrlgText(this, width / 2, y - 128, t('menu.title'), { size: 48, tint: FRLG_INK, origin: 0.5 });
    addFrlgText(this, width / 2, y - 76, t('menu.subtitle'), {
      size: 16,
      tint: FRLG_MUTED,
      origin: 0.5,
    });

    addFrlgWindow(this, x, y, PANEL_W, panelH);
    const rowX = x + 20;
    const rowW = PANEL_W - 40;
    this.rows = this.items.map((action, i) => {
      const rowY = y + ROW_TOP + i * (ROW_H + ROW_GAP);
      const highlight = this.add
        .rectangle(rowX, rowY, rowW, ROW_H - 6, FRLG_SELECTED_FILL.colour, FRLG_SELECTED_FILL.alpha)
        .setOrigin(0, 0)
        .setStrokeStyle(1, FRLG_SELECTED_STROKE.colour, FRLG_SELECTED_STROKE.alpha)
        .setVisible(false);
      const label = addFrlgText(this, rowX + 20, rowY + 14, menuLabel(action), {
        size: 24,
        tint: FRLG_INK,
      });
      const value = addFrlgText(this, rowX + rowW - 20, rowY + 20, this.rowValue(action), {
        size: 16,
        tint: FRLG_MUTED,
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
      tint: FRLG_MUTED,
      origin: 0.5,
    });
  }

  /** Mounts the panel in the HUD layer; a missing layer mounts nothing. */
  private mountPanel(view: MainMenuView): void {
    if (typeof document === 'undefined') return;
    const host = document.getElementById('hud');
    if (host === null) return;
    this.disposePanel();
    this.controller = mountMainMenu(host, view, (intent) => this.handleIntent(intent));
  }

  private disposePanel(): void {
    this.disposeStats();
    if (this.controller === null) return;
    this.controller.dispose();
    this.controller = null;
  }

  private disposeStats(): void {
    if (this.stats === null) return;
    this.stats.dispose();
    this.stats = null;
  }

  /**
   * Swaps the menu panel for the stats one, opened on `mode` and the newest month.
   * The menu's save, its history and every navigation stay here: the panel only
   * paints the view and answers an intent.
   */
  private openStats(mode: StatsMode = 'totals'): void {
    if (!this.dom || this.statsOpen || typeof document === 'undefined') return;
    const host = document.getElementById('hud');
    if (host === null) return;
    this.disposePanel();
    this.statsMode = mode;
    this.statsMonth = statsMonths(this.history, new Date())[0]?.key ?? null;
    this.stats = mountStats(host, this.statsView(), (intent) => this.handleStatsIntent(intent));
    this.statsOpen = true;
    this.loadGlobalRanking();
  }

  /**
   * Fetches the selected month's global board, once per opening (`D56`): the endpoint
   * from `ranking.json` is resolved once and cached, and a missing file, an offline
   * browser or an unreadable answer all leave the panel on the device's own record.
   */
  private loadGlobalRanking(): void {
    void (async (): Promise<void> => {
      if (this.rankingEndpoint === undefined) {
        this.rankingEndpoint = await loadRankingEndpoint();
      }
      const endpoint = this.rankingEndpoint;
      if (endpoint === null || endpoint === undefined) {
        this.globalRanking = null;
        return;
      }
      const month = this.statsMonth;
      const board = month === null ? null : await fetchRanking(month, endpoint);
      // A month step while this was in flight owns the state: its own fetch answers.
      if (this.statsMonth !== month) return;
      this.globalRanking =
        board === null || month === null
          ? null
          : { ...board, month, ownDeviceId: rankingDeviceId(browserStorage()) };
      if (this.statsOpen) this.stats?.update(this.statsView());
    })();
  }

  /** Drops the stats panel and puts the menu back where it was. */
  private closeStats(): void {
    if (!this.statsOpen) return;
    this.disposeStats();
    this.statsOpen = false;
    this.mountPanel(this.menuView());
  }

  /** The live panel's view for the mode and month this scene holds. */
  private statsView(): StatsView {
    return liveStatsView(this.history, this.statsMode, this.statsMonth, new Date(), this.globalRanking);
  }

  /** A tab, an action or a month step: the scene owns the mode and the month. */
  private handleStatsIntent(intent: StatsIntent): void {
    switch (intent.type) {
      case 'tab':
        this.statsMode = intent.mode;
        break;
      case 'action':
        switch (intent.id) {
          case 'back':
            this.closeStats();
            return;
          case 'ranking':
          case 'ranking-players':
            this.statsMode = 'ranking';
            break;
          case 'ranking-pokemon':
            this.statsMode = 'ranking-pokemon';
            break;
        }
        break;
      case 'month': {
        const months = statsMonths(this.history, new Date());
        const at = months.findIndex((month) => month.key === this.statsMonth);
        const from = at < 0 ? 0 : at;
        const next = Math.min(Math.max(0, from + intent.delta), months.length - 1);
        this.statsMonth = months[next]?.key ?? null;
        // The new month has no board yet: the local record paints first, then the fetch.
        this.globalRanking = null;
        break;
      }
    }
    this.stats?.update(this.statsView());
    if (intent.type === 'month') this.loadGlobalRanking();
  }

  /** The right-hand value of a row: the map a saved run stands on and its biome. */
  private rowValue(action: MenuAction): string {
    if (action === 'continue' && this.run) return runPositionLabel(this.run);
    return '';
  }

  /** The player's intent behind one shared action, from a key or the touch pad. */
  private handleAction(action: KeybindAction): void {
    // The stats panel owns the layer: only cancel leaves it, and no movement key
    // may walk the menu that is hidden under it.
    if (this.statsOpen) {
      if (action === 'cancel') this.closeStats();
      return;
    }
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

  /** A press, a tap or Enter on a row: the same destinations, chosen by the row's id. */
  private handleIntent(intent: MainMenuIntent): void {
    switch (intent.type) {
      case 'continue':
        this.pickRow('continue');
        return;
      case 'new-run':
        this.pickRow('new');
        return;
      case 'options':
        this.pickRow('options');
        return;
      case 'stats':
        this.openStats();
        return;
      case 'ranking':
        this.openStats('ranking');
        return;
    }
  }

  private pickRow(action: MainMenuAction): void {
    const at = this.items.indexOf(action);
    if (at < 0) return;
    this.index = at;
    this.render();
    this.choose();
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
      case 'stats':
        this.openStats();
        return;
      case 'ranking':
        this.openStats('ranking');
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
    // The stats panel owns the layer while it is open; the menu behind it is gone.
    if (this.statsOpen) return;
    if (this.dom) {
      this.controller?.update(this.menuView());
      return;
    }
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
