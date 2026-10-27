import Phaser from 'phaser';
import { getSpecies } from '../data/dex';
import { PORTRAIT_SIZE, PORTRAIT_TEXTURE_KEY, portraitFor } from '../data/portraits';
import { STARTER_POOL_SIZE, STARTING_BAG } from '../data/run';
import { TYPE_ICON_TEXTURE_KEY, TYPE_ICON_W, typeIconFrame } from '../data/typeIcons';
import {
  createRun,
  createRunPokemon,
  rollStarterPool,
  encodeRunShare,
  type RunMode,
  type RunShare,
} from '../engine/run';
import { randomSeed, rngFromSeed } from '../engine/rng';
import { keyLabel, type KeybindAction } from '../data/keybinds';
import { subscribeKeybinds } from '../input/input';
import { addFrlgWindow, FRLG_ACCENT, FRLG_MUTED, FRLG_SURFACE } from '../ui/frlg';
import { FRLG_INK, addFrlgText } from '../ui/frlgFont';
import { parseHudFlags } from '../ui/hud/fixtures';
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

const CARD_WIDTH = 260;
const CARD_HEIGHT = 320;
const CARD_GAP = 32;
const CARD_TOP = 176;
const CURSOR_OFFSET = 44;
const START_LEVEL = 5;

/** The card row's outer margin and the space the footer keeps at the bottom. */
const SIDE_MARGIN = 24;
const BOTTOM_RESERVE = 140;
/** A full-width phone row: portrait on the left, the name and types beside it. */
const ROW_WIDTH = 340;
const ROW_HEIGHT = 104;
const ROW_GAP = 12;
const ROW_TOP = 118;
const ROW_SIDE = 16;
/** Below this width (or in any portrait window) the phone list layout is used. */
const COMPACT_WIDTH = 700;
/** The selected Pokémon's portrait bobs by this many px, once each way per beat. */
const BOB_AMPLITUDE = 6;
const BOB_DURATION = 420;

/**
 * `?hud=dom` read once (`D49`): with it on this scene draws no Phaser object and
 * mounts the Preact picker in the `#hud` layer instead. The fixture preview mounts
 * on its own, even before the scene is ever opened, so
 * `?hudFixture=04-starter-pick` can be screenshotted without walking the game.
 */
const DOM_HUD = typeof window === 'undefined' ? false : parseHudFlags(window.location.search).dom;
installStarterPreview(typeof window === 'undefined' ? '' : window.location.search);

/** The number of display objects the picker draws right now: 0 under `?hud=dom`. */
export function starterDrawnObjectCount(scene: Phaser.Scene): number {
  return scene.children.length;
}

/**
 * One card's placement for the current stage. `cardW`/`cardH`/`gap` are screen
 * px (already scaled); the card itself is built at its native size and scaled by
 * `scale`, so the text and portraits shrink with it.
 */
type StarterLayout = Readonly<{
  compact: boolean;
  scale: number;
  cardW: number;
  cardH: number;
  gap: number;
  x0: number;
  top: number;
  cursorOffset: number;
}>;

/**
 * The run opener: rolls three starter candidates (base forms with two
 * consecutive evolutions ahead, `docs/design-spec.md` §3) from the run seed,
 * then hands the seeded run to the route once one is picked. Cards are FRLG
 * windows with PMDCollab faces (`docs/art-direction.md`); keyboard, mouse and
 * touch all pick.
 *
 * A wide stage shows the three cards side by side; a narrow or portrait one (a
 * phone) stacks them as full-width rows instead, so the offer never runs off the
 * screen.
 *
 * The seed is on screen as the share string that reproduces the run (D21), and
 * `S` opens the seed prompt to type a seed or paste a friend's share string
 * (which also carries their mode), rerolling the cards from there.
 *
 * The scene keeps every rule under `?hud=dom` and loses only its drawing: the
 * pick panel in `src/ui/hud/panels/starter/` paints the same offer.
 */
export class StarterScene extends Phaser.Scene {
  private index = 0;
  private seed = '';
  private mode: RunMode = 'finite';
  private pool: readonly string[] = [];
  private cards: Phaser.GameObjects.Container[] = [];
  /** Each card's portrait, indexed like `cards`, for the selection bob. */
  private portraits: Phaser.GameObjects.Image[] = [];
  private cursor!: Phaser.GameObjects.BitmapText;
  private shareText!: Phaser.GameObjects.BitmapText;
  private layout!: StarterLayout;
  /** The controls line, which is also the DOM panel's footer hint. */
  private hint = '';
  /** True on the DOM path, so `render` repaints the panel instead of the cards. */
  private dom = false;
  /** The mounted DOM picker (`?hud=dom`): the one emit point of the drawn offer. */
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
    this.pool = rollStarterPool(rngFromSeed(`${this.seed}:starters`), STARTER_POOL_SIZE);
    const { width, height } = this.scale;
    this.layout = this.computeLayout(width, height);
    this.hint = this.controlsCopy();
    this.dom = DOM_HUD;
    if (this.dom) {
      this.createDom();
    } else {
      this.draw();
    }

    subscribeKeybinds(this, ({ action }) => this.handleAction(action));
    // The seed prompt stays a fixed key: it opens a DOM field, not a game action.
    this.input.keyboard!.on('keydown-S', (event: KeyboardEvent) => {
      // The key that opens the prompt must not also type itself into the field.
      event.preventDefault();
      this.promptForSeed();
    });
    this.events.once('shutdown', () => closeSeedPrompt());

    if (!this.dom) this.renderSeed();
    this.render();
  }

  /** The shipped drawing: the surface, the title and blurb, the cards and the footers. */
  private draw(): void {
    const { width, height } = this.scale;
    const compact = this.layout.compact;

    this.add.rectangle(0, 0, width, height, FRLG_SURFACE).setOrigin(0, 0);

    addFrlgText(this, width / 2, compact ? 34 : 44, t('starter.title'), { tint: FRLG_INK, origin: 0.5 });
    addFrlgText(
      this,
      width / 2,
      compact ? 76 : 88,
      compact ? t('starter.blurbCompact') : t('starter.blurb'),
      { size: 16, tint: FRLG_MUTED, origin: 0.5 },
    );

    this.portraits = [];
    this.cards = this.pool.map((speciesId, i) => this.buildCard(speciesId, i));
    this.cursor = addFrlgText(this, 0, 0, '▶', { tint: FRLG_ACCENT, origin: [0, 0.5] });
    this.shareText = addFrlgText(this, width / 2, height - 104, '', {
      size: 16,
      tint: FRLG_MUTED,
      origin: 0.5,
    });
    addFrlgText(this, width / 2, height - 56, this.hint, {
      size: 16,
      tint: FRLG_MUTED,
      origin: 0.5,
    });
  }

  /**
   * The flag-on build: the same offer, no Phaser object, one panel in `#hud`. A
   * fixture preview owns the layer, so the scene then steps aside instead of
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
    return this.layout.compact
      ? t('starter.controlsCompact', {
          left: keyLabel(keys.left),
          right: keyLabel(keys.right),
          confirm: keyLabel(keys.confirm),
          cancel: keyLabel(keys.cancel),
        })
      : t('starter.controls', {
          left: keyLabel(keys.left),
          right: keyLabel(keys.right),
          confirm: keyLabel(keys.confirm),
          settings: keyLabel(keys.settings),
          cancel: keyLabel(keys.cancel),
        });
  }

  /**
   * Where the cards sit on a `width` x `height` stage. A narrow or portrait
   * window uses the stacked phone list; anything wider keeps the side-by-side
   * cards, shrunk only if the stage is too short for them.
   */
  private computeLayout(width: number, height: number): StarterLayout {
    const compact = width < COMPACT_WIDTH || height >= width;
    const n = this.pool.length;
    if (compact) {
      const scale = Math.min(1, (width - ROW_SIDE * 2) / ROW_WIDTH);
      const cardW = ROW_WIDTH * scale;
      const cardH = ROW_HEIGHT * scale;
      const listH = n * cardH + (n - 1) * ROW_GAP;
      const availH = height - BOTTOM_RESERVE - ROW_TOP;
      return {
        compact: true,
        scale,
        cardW,
        cardH,
        gap: ROW_GAP,
        x0: (width - cardW) / 2,
        top: ROW_TOP + Math.max(0, (availH - listH) / 2),
        cursorOffset: 22,
      };
    }
    const totalNativeW = n * CARD_WIDTH + (n - 1) * CARD_GAP;
    const availW = width - SIDE_MARGIN * 2;
    const availH = height - BOTTOM_RESERVE - CARD_TOP;
    const scale = Math.min(1, availW / totalNativeW, availH / CARD_HEIGHT);
    const cardW = CARD_WIDTH * scale;
    const cardH = CARD_HEIGHT * scale;
    const gap = CARD_GAP * scale;
    const totalW = n * cardW + (n - 1) * gap;
    return {
      compact: false,
      scale,
      cardW,
      cardH,
      gap,
      x0: (width - totalW) / 2,
      top: CARD_TOP,
      cursorOffset: CURSOR_OFFSET * scale,
    };
  }

  /** The top-left corner of card `index` for the current layout. */
  private cardPos(index: number): { x: number; y: number } {
    const { compact, x0, top, cardW, cardH, gap } = this.layout;
    return compact
      ? { x: x0, y: top + index * (cardH + gap) }
      : { x: x0 + index * (cardW + gap), y: top };
  }

  /**
   * The player's intent behind one shared action, from a key. Left and right move
   * the pick, A (confirm) takes it, and the settings key opens the options.
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
   * canvas's one-click pick: move the cursor there and confirm in the same press.
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

  private buildCard(speciesId: string, index: number): Phaser.GameObjects.Container {
    return this.layout.compact
      ? this.buildRow(speciesId, index)
      : this.buildPortraitCard(speciesId, index);
  }

  /** A side-by-side card: the tall portrait window kept for wide stages. */
  private buildPortraitCard(speciesId: string, index: number): Phaser.GameObjects.Container {
    const species = getSpecies(speciesId);
    const look = portraitFor(speciesId);
    const centerX = CARD_WIDTH / 2;
    const portraitY = 110;
    const portrait = this.add
      .image(centerX, portraitY, look?.key ?? PORTRAIT_TEXTURE_KEY, look?.frame ?? 0)
      .setScale(2)
      .setVisible(look !== null);
    portrait.setData('baseY', portraitY);
    this.portraits.push(portrait);
    const children: Phaser.GameObjects.GameObject[] = [
      addFrlgWindow(this, 0, 0, CARD_WIDTH, CARD_HEIGHT),
      portrait,
      addFrlgText(this, centerX, 214, species?.name ?? speciesId, { tint: FRLG_INK, origin: 0.5 }),
      ...this.typeBadges(species?.types ?? [], centerX, 258, 2),
    ];
    return this.finishCard(children, index, CARD_WIDTH, CARD_HEIGHT);
  }

  /** A phone row: a short full-width window with the portrait on the left. */
  private buildRow(speciesId: string, index: number): Phaser.GameObjects.Container {
    const species = getSpecies(speciesId);
    const look = portraitFor(speciesId);
    const pScale = Math.min(2, (ROW_HEIGHT - 24) / PORTRAIT_SIZE);
    const portraitX = 12 + (PORTRAIT_SIZE * pScale) / 2;
    const portraitY = ROW_HEIGHT / 2;
    const textLeft = 12 + PORTRAIT_SIZE * pScale + 14;
    const portrait = this.add
      .image(portraitX, portraitY, look?.key ?? PORTRAIT_TEXTURE_KEY, look?.frame ?? 0)
      .setScale(pScale)
      .setVisible(look !== null);
    portrait.setData('baseY', portraitY);
    this.portraits.push(portrait);
    const children: Phaser.GameObjects.GameObject[] = [
      addFrlgWindow(this, 0, 0, ROW_WIDTH, ROW_HEIGHT),
      portrait,
      addFrlgText(this, textLeft, ROW_HEIGHT * 0.34, species?.name ?? speciesId, {
        tint: FRLG_INK,
        origin: [0, 0.5],
      }),
      ...this.typeBadges(species?.types ?? [], textLeft, ROW_HEIGHT * 0.74, 2, 'left'),
    ];
    return this.finishCard(children, index, ROW_WIDTH, ROW_HEIGHT);
  }

  /**
   * A species' type badges, laid out as a centred row (or from a left edge). Every
   * battle type has a badge (`src/data/typeIcons.test.ts`), so the row is always art.
   */
  private typeBadges(
    types: readonly string[],
    x: number,
    y: number,
    scale: number,
    align: 'center' | 'left' = 'center',
  ): Phaser.GameObjects.GameObject[] {
    if (types.length === 0) return [];
    const w = TYPE_ICON_W * scale;
    const gap = Math.round(6 * scale);
    const total = types.length * w + (types.length - 1) * gap;
    const startX = align === 'left' ? x + w / 2 : x - total / 2 + w / 2;
    return types.map((type, i) =>
      this.add
        .image(startX + i * (w + gap), y, TYPE_ICON_TEXTURE_KEY, typeIconFrame(type) ?? 0)
        .setScale(scale)
        .setOrigin(0.5),
    );
  }

  /**
   * Wraps a card's parts in a clickable container at its placed corner. The whole
   * card is a target: hovering highlights it, clicking picks it (the same as
   * moving the cursor there and confirming).
   */
  private finishCard(
    children: Phaser.GameObjects.GameObject[],
    index: number,
    nativeW: number,
    nativeH: number,
  ): Phaser.GameObjects.Container {
    const zone = this.add
      .zone(0, 0, nativeW, nativeH)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => {
      this.index = index;
      this.render();
    });
    zone.on('pointerdown', () => {
      this.index = index;
      this.confirm();
    });
    children.unshift(zone);
    const pos = this.cardPos(index);
    return this.add.container(pos.x, pos.y, children).setScale(this.layout.scale);
  }

  /** Moves the ▶ cursor to the highlighted card and bobs that card's portrait. */
  private render(): void {
    if (this.dom) {
      this.controller?.update(this.view());
      return;
    }
    const pos = this.cardPos(this.index);
    this.cursor.setPosition(pos.x - this.layout.cursorOffset, pos.y + this.layout.cardH / 2);
    this.animateSelection();
  }

  /**
   * Restarts the selected Pokémon's portrait on a gentle up-and-down bob, and
   * settles every other portrait back to rest. Runs on every selection change, so
   * the bob follows the keyboard cursor and the hovered card alike.
   */
  private animateSelection(): void {
    for (const portrait of this.portraits) {
      this.tweens.killTweensOf(portrait);
      portrait.y = portrait.getData('baseY') as number;
    }
    const selected = this.portraits[this.index];
    if (!selected) return;
    const baseY = selected.getData('baseY') as number;
    this.tweens.add({
      targets: selected,
      y: baseY - BOB_AMPLITUDE,
      duration: BOB_DURATION,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** Shows the seed as the share string someone else could play (D21). */
  private renderSeed(): void {
    this.shareText.setText(
      t('starter.share', { share: encodeRunShare({ seed: this.seed, mode: this.mode }) }),
    );
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
    this.pool = rollStarterPool(rngFromSeed(`${this.seed}:starters`), STARTER_POOL_SIZE);
    if (this.dom) {
      this.render();
      return;
    }
    for (const portrait of this.portraits) this.tweens.killTweensOf(portrait);
    for (const card of this.cards) card.destroy();
    this.portraits = [];
    this.cards = this.pool.map((speciesId, i) => this.buildCard(speciesId, i));
    this.children.bringToTop(this.cursor);
    this.renderSeed();
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
