import Phaser from 'phaser';
import { getSpecies } from '../data/dex';
import { PORTRAIT_TEXTURE_KEY, portraitFrameFor } from '../data/portraits';
import { STARTER_POOL_SIZE, STARTING_BAG } from '../data/run';
import { createRun, createRunPokemon, rollStarterPool } from '../engine/run';
import { randomSeed, rngFromSeed } from '../engine/rng';
import { addFrlgWindow } from '../ui/frlg';
import { FRLG_INK, addFrlgText } from '../ui/frlgFont';

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
 */
export class StarterScene extends Phaser.Scene {
  private index = 0;
  private seed = '';
  private pool: readonly string[] = [];
  private cursor!: Phaser.GameObjects.BitmapText;

  constructor() {
    super('Starter');
  }

  create(): void {
    const { width, height } = this.scale;
    this.index = 0;
    this.seed = randomSeed();
    this.pool = rollStarterPool(rngFromSeed(`${this.seed}:starters`), STARTER_POOL_SIZE);
    this.add.rectangle(0, 0, width, height, 0x10161f).setOrigin(0, 0);

    addFrlgText(this, width / 2, 44, 'Choose your starter', { origin: 0.5 });
    addFrlgText(this, width / 2, 88, 'Your first Pokémon. Lose it and it is gone for good.', {
      size: 16,
      tint: 0x94a3b8,
      origin: 0.5,
    });

    this.pool.forEach((speciesId, i) => this.buildCard(speciesId, i));
    this.cursor = addFrlgText(this, 0, CARD_TOP + CARD_HEIGHT / 2, '▶', { origin: [0, 0.5] });

    addFrlgText(this, width / 2, height - 56, '←  →  choose      Z / Enter  confirm', {
      size: 16,
      tint: 0xcbd5f5,
      origin: 0.5,
    });

    const keyboard = this.input.keyboard!;
    const move = (delta: number) => {
      this.index = (this.index + delta + this.pool.length) % this.pool.length;
      this.render();
    };
    keyboard.on('keydown-LEFT', () => move(-1));
    keyboard.on('keydown-A', () => move(-1));
    keyboard.on('keydown-RIGHT', () => move(1));
    keyboard.on('keydown-D', () => move(1));
    keyboard.on('keydown-Z', () => this.confirm());
    keyboard.on('keydown-ENTER', () => this.confirm());
    keyboard.on('keydown-SPACE', () => this.confirm());

    this.render();
  }

  private cardX(index: number): number {
    const total = this.pool.length * CARD_WIDTH + (this.pool.length - 1) * CARD_GAP;
    return (this.scale.width - total) / 2 + index * (CARD_WIDTH + CARD_GAP);
  }

  private buildCard(speciesId: string, index: number): void {
    const x = this.cardX(index);
    const species = getSpecies(speciesId);
    const centerX = x + CARD_WIDTH / 2;

    addFrlgWindow(this, x, CARD_TOP, CARD_WIDTH, CARD_HEIGHT);

    const frame = portraitFrameFor(speciesId);
    this.add
      .image(centerX, CARD_TOP + 110, PORTRAIT_TEXTURE_KEY, frame ?? 0)
      .setScale(3)
      .setVisible(frame !== null);

    addFrlgText(this, centerX, CARD_TOP + 210, species?.name ?? speciesId, {
      tint: FRLG_INK,
      origin: 0.5,
    });
    addFrlgText(this, centerX, CARD_TOP + 252, (species?.types ?? []).join(' / '), {
      size: 16,
      tint: 0x3a3956,
      origin: 0.5,
    });
    addFrlgText(this, centerX, CARD_TOP + 284, `Lv ${START_LEVEL}`, {
      size: 16,
      tint: 0x3a3956,
      origin: 0.5,
    });
  }

  /** Moves the ▶ cursor to the highlighted card. */
  private render(): void {
    this.cursor.setPosition(this.cardX(this.index) - CURSOR_OFFSET, CARD_TOP + CARD_HEIGHT / 2);
  }

  private confirm(): void {
    const speciesId = this.pool[this.index];
    if (!speciesId) return;
    const starter = createRunPokemon({ id: 'starter', speciesId, level: START_LEVEL });
    const run = createRun({ seed: this.seed, starter, bag: STARTING_BAG });
    this.scene.start('Route', { run });
  }
}
