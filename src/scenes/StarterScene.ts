import Phaser from 'phaser';
import { createRun, createRunPokemon, starterOffer, type RunMode, type RunShare } from '../engine/run';
import { STARTING_BAG } from '../data/run';
import { randomSeed } from '../engine/rng';
import { keyLabel, type KeybindAction } from '../data/keybinds';
import { subscribeKeybinds } from '../input/input';
import {
  installStarterPreview,
  liveStarterView,
  mountStarter,
  starterPreviewRequested,
  type StarterHandle,
  type StarterIntent,
  type StarterView,
} from '../ui/hud/panels/starter';
import { closeSeedPrompt, openSeedPrompt } from '../ui/seedPrompt';
import { t } from '../i18n';
import { loadSettings } from '../settings';

const START_LEVEL = 5;

/** Below this width (or in any portrait window) the phone list layout is used. */
const COMPACT_WIDTH = 700;

/**
 * The fixture preview mounts on its own, even before the scene is ever opened, so
 * `?hudFixture=04-starter-pick` can be screenshotted without walking the game.
 */
installStarterPreview(typeof window === 'undefined' ? '' : window.location.search);

/** The number of chrome display objects the picker draws: none, the panel is the screen. */
export function starterDrawnObjectCount(_scene: Phaser.Scene): number {
  return 0;
}

/**
 * The run opener: rolls three starter candidates (base forms with two
 * consecutive evolutions ahead, `docs/design-spec.md` §3) from the run seed,
 * then hands the seeded run to the route once one is picked.
 *
 * The seed is on screen as the share string that reproduces the run (D21), and
 * `S` opens the seed prompt to type a seed or paste a friend's share string
 * (which also carries their mode), rerolling the cards from there. `R` throws
 * the offer away for the next one drawn from a fresh random seed, the same path
 * a brand-new run takes.
 *
 * The picker is the `starter` panel (`D49`): the scene keeps every rule and the
 * offer, and the panel paints the same three candidates.
 */
export class StarterScene extends Phaser.Scene {
  private index = 0;
  private seed = '';
  private mode: RunMode = 'finite';
  private pool: readonly string[] = [];
  /** Whether the stage shows the stacked phone rows instead of the wide cards. */
  private compact = false;
  /** The controls line, which is also the DOM panel's footer hint. */
  private hint = '';
  /** The mounted DOM picker: the one emit point of the drawn offer. */
  private controller: StarterHandle | null = null;

  constructor() {
    super('Starter');
  }

  init(data: { seed?: string; mode?: RunMode }): void {
    this.seed = data.seed ?? randomSeed();
    this.mode = data.mode ?? 'finite';
  }

  create(): void {
    this.index = 0;
    this.pool = starterOffer(this.seed);
    const { width, height } = this.scale;
    this.compact = width < COMPACT_WIDTH || height >= width;
    this.hint = this.controlsCopy();
    this.createDom();

    subscribeKeybinds(this, ({ action }) => this.handleAction(action));
    // The seed prompt stays a fixed key: it opens a DOM field, not a game action.
    this.input.keyboard!.on('keydown-S', (event: KeyboardEvent) => {
      // The key that opens the prompt must not also type itself into the field.
      event.preventDefault();
      this.promptForSeed();
    });
    this.events.once('shutdown', () => closeSeedPrompt());

    this.render();
  }

  /**
   * The offer's one build: the same rules, no Phaser object, one panel in `#hud`.
   * A fixture preview owns the layer, so the scene then steps aside instead of
   * mounting a second picker on top of the frame's.
   */
  private createDom(): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    if (starterPreviewRequested(window.location.search)) return;
    const host = document.getElementById('hud');
    if (host === null) return;
    this.disposePanel();
    this.controller = mountStarter(host, this.view(), (intent) => this.handleIntent(intent));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.disposePanel());
  }

  private view(): StarterView {
    return liveStarterView(this.pool, this.index, this.seed, this.mode, this.hint);
  }

  private disposePanel(): void {
    if (this.controller === null) return;
    this.controller.dispose();
    this.controller = null;
  }

  /** The footer copy: the shipped controls line for the layout in use. */
  private controlsCopy(): string {
    const keys = loadSettings().keybinds;
    return this.compact
      ? t('starter.controlsCompact', {
          left: keyLabel(keys.left),
          right: keyLabel(keys.right),
          confirm: keyLabel(keys.confirm),
          reroll: keyLabel(keys.reroll),
          cancel: keyLabel(keys.cancel),
        })
      : t('starter.controls', {
          left: keyLabel(keys.left),
          right: keyLabel(keys.right),
          confirm: keyLabel(keys.confirm),
          reroll: keyLabel(keys.reroll),
          settings: keyLabel(keys.settings),
          cancel: keyLabel(keys.cancel),
        });
  }

  /**
   * The player's intent behind one shared action, from a key. Left and right move
   * the pick, A (confirm) takes it, R (reroll) draws a new seed's offer, and the
   * settings key opens the options.
   */
  private handleAction(action: KeybindAction): void {
    switch (action) {
      case 'left':
        this.move(-1);
        return;
      case 'right':
        this.move(1);
        return;
      case 'confirm':
        this.confirm();
        return;
      case 'reroll':
        this.rerollOffer();
        return;
      case 'cancel':
        // Back to the hub: the run in progress is untouched, so it can still be
        // continued from the main menu.
        this.scene.start('MainMenu');
        return;
      case 'settings':
        this.openSettings();
        return;
    }
  }

  /**
   * The panel's intents, one per pointer or focus gesture. A chosen card is the
   * one-click pick: move the cursor there and confirm in the same press.
   */
  private handleIntent(intent: StarterIntent): void {
    switch (intent.type) {
      case 'select':
        this.index = this.clampIndex(intent.index);
        this.render();
        return;
      case 'choose':
        this.index = this.clampIndex(intent.index);
        this.render();
        this.confirm();
        return;
      case 'seed-prompt':
        this.promptForSeed();
        return;
      case 'cancel':
        this.scene.start('MainMenu');
        return;
      case 'settings':
        this.openSettings();
        return;
    }
  }

  private clampIndex(index: number): number {
    if (!Number.isFinite(index) || this.pool.length === 0) return 0;
    return Math.min(Math.max(0, Math.trunc(index)), this.pool.length - 1);
  }

  /** Wraps the picked card by `delta`. */
  private move(delta: number): void {
    this.index = (this.index + delta + this.pool.length) % this.pool.length;
    this.render();
  }

  /** The one emit point of the panel: the scene owns the offer, the panel paints it. */
  private render(): void {
    this.controller?.update(this.view());
  }

  private promptForSeed(): void {
    openSeedPrompt({
      initial: { seed: this.seed, mode: this.mode },
      onConfirm: (share) => this.applyShare(share),
    });
  }

  /** Opens the settings screen paused-on-top; it resumes this scene on close. */
  private openSettings(): void {
    this.scene.pause();
    this.scene.launch('Settings', { from: 'Starter' });
  }

  /** Adopts a typed seed or a pasted share string and rerolls the offer. */
  private applyShare(share: RunShare): void {
    this.seed = share.seed;
    this.mode = share.mode;
    this.index = 0;
    this.pool = starterOffer(this.seed);
    this.render();
  }

  /**
   * Throws the current offer away for the next one: a reroll is a fresh random
   * seed and nothing else, the same path a brand-new run takes, so the mode and
   * the unconfirmed run stay untouched. Only `confirm` writes a save.
   */
  private rerollOffer(): void {
    this.seed = randomSeed();
    this.index = 0;
    this.pool = starterOffer(this.seed);
    this.render();
  }

  private confirm(): void {
    const speciesId = this.pool[this.index];
    if (!speciesId) return;
    const starter = createRunPokemon({
      id: 'starter',
      speciesId,
      level: START_LEVEL,
      learnsetSeed: this.seed,
    });
    const run = createRun({
      seed: this.seed,
      mode: this.mode,
      starter,
      bag: STARTING_BAG,
      startedAt: new Date().toISOString(),
    });
    this.scene.start('Route', { run });
  }
}
