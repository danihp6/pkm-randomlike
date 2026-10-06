import Phaser from 'phaser';
import { getSpecies } from '../data/dex';
import { PORTRAIT_TEXTURE_KEY, portraitFrameFor } from '../data/portraits';
import { STARTER_POOL_SIZE, STARTING_BAG } from '../data/run';
import {
  createRun,
  createRunPokemon,
  rollStarterPool,
  encodeRunShare,
  type RunMode,
  type RunShare,
} from '../engine/run';
import { randomSeed, rngFromSeed } from '../engine/rng';
import { keyLabel } from '../data/keybinds';
import { subscribeKeybinds } from '../input/input';
import { addFrlgWindow } from '../ui/frlg';
import { FRLG_INK, addFrlgText } from '../ui/frlgFont';
import { closeSeedPrompt, openSeedPrompt } from '../ui/seedPrompt';
import { loadSettings } from '../settings';

const CARD_WIDTH = 260;
const CARD_HEIGHT = 320;
const CARD_GAP = 32;
const CARD_TOP = 176;
const CURSOR_OFFSET = 44;
const START_LEVEL = 5;

/**
 * The run opener: rolls three starter candidates (base forms of evolution lines
 * of at least three, `docs/design-spec.md` §3) from the run seed, then hands the
 * seeded run to the route once one is picked. Cards are FRLG windows with
 * PMDCollab faces (`docs/art-direction.md`); selection is keyboard-only.
 *
 * The seed is on screen as the share string that reproduces the run (D21), and
 * `S` opens the seed prompt to type a seed or paste a friend's share string
 * (which also carries their mode), rerolling the cards from there.
 */
export class StarterScene extends Phaser.Scene {
  private index = 0;
  private seed = '';
  private mode: RunMode = 'finite';
  private pool: readonly string[] = [];
  private cards: Phaser.GameObjects.GameObject[] = [];
  private cursor!: Phaser.GameObjects.BitmapText;
  private shareText!: Phaser.GameObjects.BitmapText;

  constructor() {
    super('Starter');
  }

  init(data: { seed?: string; mode?: RunMode }): void {
    this.seed = data.seed ?? randomSeed();
    this.mode = data.mode ?? 'finite';
  }

  create(): void {
    const { width, height } = this.scale;
    this.index = 0;
    this.pool = rollStarterPool(rngFromSeed(`${this.seed}:starters`), STARTER_POOL_SIZE);
    this.add.rectangle(0, 0, width, height, 0x10161f).setOrigin(0, 0);

    addFrlgText(this, width / 2, 44, 'Choose your starter', { origin: 0.5 });
    addFrlgText(this, width / 2, 88, 'Your first Pokémon. Lose it and it is gone for good.', {
      size: 16,
      tint: 0x94a3b8,
      origin: 0.5,
    });

    this.cards = this.pool.flatMap((speciesId, i) => this.buildCard(speciesId, i));
    this.cursor = addFrlgText(this, 0, CARD_TOP + CARD_HEIGHT / 2, '▶', { origin: [0, 0.5] });

    this.shareText = addFrlgText(this, width / 2, height - 104, '', {
      size: 16,
      tint: 0x64748b,
      origin: 0.5,
    });
    const keys = loadSettings().keybinds;
    addFrlgText(
      this,
      width / 2,
      height - 56,
      `${keyLabel(keys.left)}  ${keyLabel(keys.right)}  choose      ${keyLabel(keys.confirm)}  confirm      S  seed      ${keyLabel(keys.settings)}  settings`,
      {
        size: 16,
        tint: 0xcbd5f5,
        origin: 0.5,
      },
    );

    const move = (delta: number) => {
      this.index = (this.index + delta + this.pool.length) % this.pool.length;
      this.render();
    };
    subscribeKeybinds(this, ({ action }) => {
      switch (action) {
        case 'left':
          move(-1);
          return;
        case 'right':
          move(1);
          return;
        case 'confirm':
          this.confirm();
          return;
        case 'settings':
          this.openSettings();
          return;
      }
    });
    // The seed prompt stays a fixed key: it opens a DOM field, not a game action.
    this.input.keyboard!.on('keydown-S', (event: KeyboardEvent) => {
      // The key that opens the prompt must not also type itself into the field.
      event.preventDefault();
      this.promptForSeed();
    });
    this.events.once('shutdown', () => closeSeedPrompt());

    this.renderSeed();
    this.render();
  }

  private cardX(index: number): number {
    const total = this.pool.length * CARD_WIDTH + (this.pool.length - 1) * CARD_GAP;
    return (this.scale.width - total) / 2 + index * (CARD_WIDTH + CARD_GAP);
  }

  private buildCard(speciesId: string, index: number): Phaser.GameObjects.GameObject[] {
    const x = this.cardX(index);
    const species = getSpecies(speciesId);
    const centerX = x + CARD_WIDTH / 2;

    const window = addFrlgWindow(this, x, CARD_TOP, CARD_WIDTH, CARD_HEIGHT);
    const frame = portraitFrameFor(speciesId);
    const portrait = this.add
      .image(centerX, CARD_TOP + 110, PORTRAIT_TEXTURE_KEY, frame ?? 0)
      .setScale(3)
      .setVisible(frame !== null);
    const name = addFrlgText(this, centerX, CARD_TOP + 210, species?.name ?? speciesId, {
      tint: FRLG_INK,
      origin: 0.5,
    });
    const types = addFrlgText(this, centerX, CARD_TOP + 252, (species?.types ?? []).join(' / '), {
      size: 16,
      tint: 0x3a3956,
      origin: 0.5,
    });
    const level = addFrlgText(this, centerX, CARD_TOP + 284, `Lv ${START_LEVEL}`, {
      size: 16,
      tint: 0x3a3956,
      origin: 0.5,
    });
    // The whole card is a click target: hovering highlights it, clicking picks it
    // (the same as moving the cursor there and confirming).
    const zone = this.add.zone(x, CARD_TOP, CARD_WIDTH, CARD_HEIGHT).setOrigin(0, 0);
    zone.setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => {
      this.index = index;
      this.render();
    });
    zone.on('pointerdown', () => {
      this.index = index;
      this.confirm();
    });
    return [zone, window, portrait, name, types, level];
  }

  /** Moves the ▶ cursor to the highlighted card. */
  private render(): void {
    this.cursor.setPosition(this.cardX(this.index) - CURSOR_OFFSET, CARD_TOP + CARD_HEIGHT / 2);
  }

  /** Shows the seed as the share string someone else could play (D21). */
  private renderSeed(): void {
    this.shareText.setText(`Share: ${encodeRunShare({ seed: this.seed, mode: this.mode })}`);
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
    for (const card of this.cards) card.destroy();
    this.cards = this.pool.flatMap((speciesId, i) => this.buildCard(speciesId, i));
    this.children.bringToTop(this.cursor);
    this.renderSeed();
    this.render();
  }

  private confirm(): void {
    const speciesId = this.pool[this.index];
    if (!speciesId) return;
    const starter = createRunPokemon({ id: 'starter', speciesId, level: START_LEVEL });
    const run = createRun({ seed: this.seed, mode: this.mode, starter, bag: STARTING_BAG });
    this.scene.start('Route', { run });
  }
}
