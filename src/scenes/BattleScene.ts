import Phaser from 'phaser';

/**
 * Placeholder for the menu battle (attack / bag / switch / run). Phase 2 builds
 * the real thing on top of `src/engine/battle/`.
 */
export class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  create(): void {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, 'Battle scene (Phase 2)', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#f8fafc',
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height / 2 + 32, 'Esc: back to the route', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#94a3b8',
      })
      .setOrigin(0.5);
    this.input.keyboard!.once('keydown-ESC', () => this.scene.start('Route'));
  }
}
