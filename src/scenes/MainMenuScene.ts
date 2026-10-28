import Phaser from 'phaser';
import { playMusic } from '../audio/audio';
import type { KeybindAction } from '../data/keybinds';
import type { RunHistoryRecord } from '../engine/run/history';
import { hasLivingParty, type RunState } from '../engine/run';
import { randomSeed } from '../engine/rng';
import { loadSave, type Settings } from '../engine/save';
import { subscribeKeybinds } from '../input/input';
import { fetchRanking, loadRankingEndpoint, rankingDeviceId, type RankingBoard } from '../net/ranking';
import { loadSettings } from '../settings';
import { browserStorage } from '../storage';
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

/** The five things the menu can do; `continue` only exists with a saved run. */
type MenuAction = 'continue' | 'new' | 'options' | 'stats' | 'ranking';

/** The fixture previews mount on their own, before the scene is ever opened. */
installMainMenuPreview(typeof window === 'undefined' ? '' : window.location.search);
installStatsPreview(typeof window === 'undefined' ? '' : window.location.search);

/** The number of chrome display objects the menu draws: none, the panel is the screen. */
export function mainMenuDrawnObjectCount(_scene: Phaser.Scene): number {
  return 0;
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
 *
 * The menu is the `main-menu` panel (`D49`): the scene owns the save, the cursor,
 * the stats panel and every navigation, and the panel only paints what it is told.
 */
export class MainMenuScene extends Phaser.Scene {
  private run: RunState | null = null;
  private settings!: Settings;
  private items: MenuAction[] = [];
  private index = 0;
  /** The decorative route window's seed: drawn once per boot, never saved. */
  private previewSeed = '';
  /** The mounted DOM menu: the one emit point of the drawn menu. */
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

    this.createDom();

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

  /** The screen's one build: the same rows, no Phaser object, one panel in `#hud`. */
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
    if (this.statsOpen || typeof document === 'undefined') return;
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
    this.controller?.update(this.menuView());
  }
}
