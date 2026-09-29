import Phaser from 'phaser';
import { getSpecies } from '../data/dex';
import { PORTRAIT_TEXTURE_KEY, portraitFrameFor } from '../data/portraits';
import { STARTER_POOL, STARTING_BAG } from '../data/run';
import { createRun, createRunPokemon } from '../engine/run';
import { randomSeed } from '../engine/rng';
import { PANEL_FILL, PANEL_STROKE, drawPanel } from '../ui/panel';

const CARD_WIDTH = 240;
const CARD_HEIGHT = 320;
const CARD_GAP = 32;
const CARD_TOP = 170;
const START_LEVEL = 5;
const SELECTED_STROKE = 0xfbbf24;

/**
 * The run opener: pick a starter from the pool, then hand the seeded run to the
 * route. Portraits are the PMDCollab faces loaded by `BootScene`
 * (`docs/art-direction.md`); selection is keyboard-only, like the rest.
 */
export class StarterScene extends Phaser.Scene {
  private index = 0;
  private panel!: Phaser.GameObjects.Graphics;

  constructor() {
    super('Starter');
  }

  create(): void {
    const { width, height } = this.scale;
    this.index = 0;
    this.add.rectangle(0, 0, width, height, 0x10161f).setOrigin(0, 0);

    this.add
      .text(width / 2, 56, 'Choose your starter', {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: '#f8fafc',
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 104, 'Your first Pokémon. Lose it and it is gone for good.', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#94a3b8',
      })
      .setOrigin(0.5);

    this.panel = this.add.graphics();
    STARTER_POOL.forEach((speciesId, i) => this.buildCard(speciesId, i));

    this.add
      .text(width / 2, height - 64, '←  →  choose      Z / Enter  confirm', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#cbd5f5',
      })
      .setOrigin(0.5);

    const keyboard = this.input.keyboard!;
    const move = (delta: number) => {
      this.index = (this.index + delta + STARTER_POOL.length) % STARTER_POOL.length;
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
    const total = STARTER_POOL.length * CARD_WIDTH + (STARTER_POOL.length - 1) * CARD_GAP;
    return (this.scale.width - total) / 2 + index * (CARD_WIDTH + CARD_GAP);
  }

  private buildCard(speciesId: string, index: number): void {
    const x = this.cardX(index);
    const species = getSpecies(speciesId);
    const centerX = x + CARD_WIDTH / 2;

    const frame = portraitFrameFor(speciesId);
    this.add
      .image(centerX, CARD_TOP + 110, PORTRAIT_TEXTURE_KEY, frame ?? 0)
      .setScale(3)
      .setVisible(frame !== null);

    this.add
      .text(centerX, CARD_TOP + 214, species?.name ?? speciesId, {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#f8fafc',
      })
      .setOrigin(0.5);
    this.add
      .text(centerX, CARD_TOP + 248, (species?.types ?? []).join(' / '), {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#93c5fd',
      })
      .setOrigin(0.5);
    this.add
      .text(centerX, CARD_TOP + 284, `Lv ${START_LEVEL}`, {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#94a3b8',
      })
      .setOrigin(0.5);
  }

  /** Redraws the selection frame; cards are static otherwise. */
  private render(): void {
    this.panel.clear();
    for (let i = 0; i < STARTER_POOL.length; i++) {
      const x = this.cardX(i);
      const selected = i === this.index;
      drawPanel(this.panel, x, CARD_TOP, CARD_WIDTH, CARD_HEIGHT, {
        fill: selected ? 0x243252 : PANEL_FILL,
        stroke: selected ? SELECTED_STROKE : PANEL_STROKE,
        radius: 16,
      });
    }
  }

  private confirm(): void {
    const speciesId = STARTER_POOL[this.index];
    if (!speciesId) return;
    const starter = createRunPokemon({ id: 'starter', speciesId, level: START_LEVEL });
    const run = createRun({ seed: randomSeed(), starter, bag: STARTING_BAG });
    this.scene.start('Route', { run });
  }
}
