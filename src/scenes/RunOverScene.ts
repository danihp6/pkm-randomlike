import Phaser from 'phaser';
import { keyLabel, type KeybindAction } from '../data/keybinds';
import type { RunState } from '../engine/run';
import { clearRun } from '../engine/save';
import { subscribeKeybinds } from '../input/input';
import { loadSettings } from '../settings';
import { browserStorage } from '../storage';
import {
  RUN_OVER_TABS,
  installRunOverPreview,
  liveRunOverView,
  mountRunOver,
  runOverPreviewRequested,
  type RunOverHandle,
  type RunOverIntent,
  type RunOverTab,
  type RunOverView,
} from '../ui/hud/panels/run-over';
import { RUN_OVER_INPUT_DELAY_MS } from '../ui/runSummary';

/**
 * The fixture preview mounts on its own, even before the scene is ever opened, so
 * `?hudFixture=06-run-over-defeat` can be screenshotted without walking a run.
 */
installRunOverPreview(typeof window === 'undefined' ? '' : window.location.search);

/** The number of chrome display objects the score screen draws: none, the panel is the screen. */
export function runOverDrawnObjectCount(_scene: Phaser.Scene): number {
  return 0;
}

/**
 * The end-of-run score screen (Phase 7). The route hands over the run and
 * whether it was won; a lost run is the permadeath payoff — the party is gone
 * and nothing carries over, so this is where the run stops. A win and a loss
 * both end here, and the confirm returns to the main menu, where a new run is
 * started. The summary reports the routes cleared, the catches, the casualties
 * and the seed, all from the run itself.
 *
 * The screen is the `run-over` panel (`D49`): the scene keeps the permadeath rule
 * (it clears the save), the input delay, the tab it owns and the return to the
 * main menu; the panel only paints the view it is handed.
 */
export class RunOverScene extends Phaser.Scene {
  private run!: RunState;
  private won = false;
  private leaving = false;
  private armed = false;
  /** The tab the scene owns; `'totals'` at create, switched by a press or left/right. */
  private tab: RunOverTab = 'totals';
  /** The mounted DOM panel: the one paint point of the drawn screen. */
  private controller: RunOverHandle | null = null;

  constructor() {
    super('RunOver');
  }

  init(data: { run: RunState; won?: boolean }): void {
    this.run = data.run;
    this.won = data.won ?? false;
    this.leaving = false;
    this.armed = false;
    this.tab = 'totals';
  }

  create(): void {
    // Permadeath (D5): the run is over for good, so the save slot forgets it.
    clearRun(browserStorage());

    this.createDom();

    subscribeKeybinds(this, ({ action }) => this.handleAction(action));
    this.time.delayedCall(RUN_OVER_INPUT_DELAY_MS, () => {
      this.armed = true;
    });
  }

  /** The screen's one build: the same rules, no Phaser object, one panel in `#hud`. */
  private createDom(): void {
    // The fixture preview paints the frame's own copy and owns the layer; the
    // scene then steps aside instead of mounting a second screen on top of it.
    if (runOverPreviewRequested(window.location.search)) return;
    this.mountPanel();
    if (this.controller === null) return;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.disposePanel());
  }

  /** Mounts the panel in the HUD layer; a missing layer mounts nothing. */
  private mountPanel(): void {
    if (typeof document === 'undefined') return;
    const host = document.getElementById('hud');
    if (host === null) return;
    this.disposePanel();
    this.controller = mountRunOver(host, this.view(), (intent) => this.handleIntent(intent));
  }

  private disposePanel(): void {
    if (this.controller === null) return;
    this.controller.dispose();
    this.controller = null;
  }

  /** The live view the panel paints: `runSummary`'s figures, the run's rows, this tab. */
  private view(): RunOverView {
    return liveRunOverView(this.run, this.won, this.tab, keyLabel(loadSettings().keybinds.confirm));
  }

  /** The one shared action this screen answers: A / confirm returns to the main menu. */
  private handleAction(action: KeybindAction): void {
    if (action === 'confirm' && this.armed) {
      this.returnToMenu();
      return;
    }
    if (action === 'left' || action === 'right') {
      const at = RUN_OVER_TABS.indexOf(this.tab);
      const step = action === 'right' ? 1 : -1;
      const next = RUN_OVER_TABS[(at + step + RUN_OVER_TABS.length) % RUN_OVER_TABS.length];
      if (next !== undefined) this.setTab(next);
    }
  }

  /** A press, a tap or Enter on a tab or on the one action. */
  private handleIntent(intent: RunOverIntent): void {
    if (intent.type === 'tab') {
      this.setTab(intent.tab);
      return;
    }
    if (this.armed) this.returnToMenu();
  }

  private setTab(tab: RunOverTab): void {
    if (tab === this.tab) return;
    this.tab = tab;
    this.render();
  }

  private render(): void {
    this.controller?.update(this.view());
  }

  private returnToMenu(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.start('MainMenu');
  }
}
