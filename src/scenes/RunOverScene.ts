import Phaser from 'phaser';
import { keyLabel, type KeybindAction } from '../data/keybinds';
import type { RunState } from '../engine/run';
import { clearRun } from '../engine/save';
import { subscribeKeybinds } from '../input/input';
import { loadSettings } from '../settings';
import { browserStorage } from '../storage';
import { t } from '../i18n';
import { addFrlgWindow, FRLG_MUTED } from '../ui/frlg';
import { FRLG_INK, addFrlgText } from '../ui/frlgFont';
import { parseHudFlags } from '../ui/hud/fixtures';
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
import { RUN_OVER_INPUT_DELAY_MS, runSummary, runSummaryLines } from '../ui/runSummary';

/**
 * `?hud=dom` read once (`D49`): with it on this scene draws no Phaser object and
 * mounts the Preact score screen in the `#hud` layer instead. The fixture preview
 * mounts on its own, even before the scene is ever opened, so
 * `?hudFixture=06-run-over-defeat` can be screenshotted without walking a run.
 */
const DOM_HUD = typeof window === 'undefined' ? false : parseHudFlags(window.location.search).dom;
installRunOverPreview(typeof window === 'undefined' ? '' : window.location.search);

/** The number of display objects the score screen draws right now: 0 under `?hud=dom`. */
export function runOverDrawnObjectCount(scene: Phaser.Scene): number {
  return scene.children.length;
}

/**
 * The end-of-run score screen (Phase 7). The route hands over the run and
 * whether it was won; a lost run is the permadeath payoff — the party is gone
 * and nothing carries over, so this is where the run stops. A win and a loss
 * both end here, and the confirm returns to the main menu, where a new run is
 * started. The summary reports the routes cleared, the catches, the casualties
 * and the seed, all from the run itself.
 *
 * Under `?hud=dom` the same screen is the `run-over` panel: the scene keeps the
 * permadeath rule (it clears the save), the input delay, the tab it owns and the
 * return to the main menu; the panel only paints the view it is handed.
 */
export class RunOverScene extends Phaser.Scene {
  private run!: RunState;
  private won = false;
  private leaving = false;
  private armed = false;
  /** True on the DOM path, so `render` repaints the panel instead of the canvas. */
  private dom = false;
  /** The tab the scene owns; `'totals'` at create, switched by a press or left/right. */
  private tab: RunOverTab = 'totals';
  /** The mounted DOM panel (`?hud=dom`): the one paint point of the drawn screen. */
  private controller: RunOverHandle | null = null;

  constructor() {
    super('RunOver');
  }

  init(data: { run: RunState; won?: boolean }): void {
    this.run = data.run;
    this.won = data.won ?? false;
    this.leaving = false;
    this.armed = false;
    this.dom = DOM_HUD;
    this.tab = 'totals';
  }

  create(): void {
    // Permadeath (D5): the run is over for good, so the save slot forgets it.
    clearRun(browserStorage());

    if (DOM_HUD) {
      this.createDom();
    } else {
      this.draw();
    }

    subscribeKeybinds(this, ({ action }) => this.handleAction(action));
    this.time.delayedCall(RUN_OVER_INPUT_DELAY_MS, () => {
      this.armed = true;
    });
  }

  /** The flag-on build: the same screen, no Phaser object, one panel in `#hud`. */
  private createDom(): void {
    // The fixture preview paints the frame's own copy and owns the layer; the
    // scene then steps aside instead of mounting a second screen on top of it.
    if (runOverPreviewRequested(window.location.search)) return;
    this.mountPanel();
    if (this.controller === null) return;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.disposePanel());
  }

  /** The shipped drawing: the panel, its headline, its blurb and the summary lines. */
  private draw(): void {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, 0x05070c).setOrigin(0, 0);

    const lines = runSummaryLines(runSummary(this.run, this.won));
    const panelW = 720;
    const panelH = 356;
    const x = (width - panelW) / 2;
    const y = (height - panelH) / 2 - 16;
    addFrlgWindow(this, x, y, panelW, panelH);
    addFrlgText(this, width / 2, y + 44, lines[0], { size: 32, tint: FRLG_INK, origin: 0.5 });
    addFrlgText(this, width / 2, y + 88, lines[1], { size: 16, tint: FRLG_MUTED, origin: 0.5 });
    lines.slice(2).forEach((line, i) => {
      addFrlgText(this, x + 64, y + 140 + i * 44, line, { size: 16, tint: FRLG_INK });
    });
    addFrlgText(
      this,
      width / 2,
      y + panelH + 28,
      t('runOver.return', { key: keyLabel(loadSettings().keybinds.confirm) }),
      {
        size: 16,
        tint: FRLG_MUTED,
        origin: 0.5,
      },
    );
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
    if (!this.dom) return;
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
    if (!this.dom) return;
    this.controller?.update(this.view());
  }

  private returnToMenu(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.start('MainMenu');
  }
}
