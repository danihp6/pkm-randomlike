import Phaser from 'phaser';
import type { RunState } from '../engine/run';
import { addFrlgWindow } from '../ui/frlg';
import { addFrlgText } from '../ui/frlgFont';
import { RUN_OVER_INPUT_DELAY_MS, runOverLines, runOverSummary } from '../ui/permadeath';

/**
 * The end-of-run screen (Phase 5). The route hands over the run and whether it
 * was won; a lost run is the permadeath payoff — the party is gone and nothing
 * carries over, so this is where the run stops and a new one begins. The run
 * summary proper (catches, casualties) is still Phase 7.
 */
export class RunOverScene extends Phaser.Scene {
  private run!: RunState;
  private won = false;
  private leaving = false;
  private armed = false;

  constructor() {
    super('RunOver');
  }

  init(data: { run: RunState; won?: boolean }): void {
    this.run = data.run;
    this.won = data.won ?? false;
    this.leaving = false;
    this.armed = false;
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, 0x05070c).setOrigin(0, 0);

    const lines = runOverLines(runOverSummary(this.run, this.won));
    const panelW = 720;
    const panelH = 268;
    const x = (width - panelW) / 2;
    const y = (height - panelH) / 2 - 20;
    addFrlgWindow(this, x, y, panelW, panelH, 'textbox');
    addFrlgText(this, width / 2, y + 36, lines[0], { size: 32, origin: 0.5 });
    lines.slice(1).forEach((line, i) => {
      addFrlgText(this, x + 48, y + 104 + i * 40, line, { size: 16 });
    });
    addFrlgText(this, width / 2, height - 72, 'Z / Enter — start a new run', {
      size: 16,
      tint: 0x94a3b8,
      origin: 0.5,
    });

    const keyboard = this.input.keyboard!;
    const confirm = (event: KeyboardEvent) => {
      if (event.repeat || !this.armed) return;
      this.startNewRun();
    };
    keyboard.on('keydown-Z', confirm);
    keyboard.on('keydown-ENTER', confirm);
    keyboard.on('keydown-SPACE', confirm);
    this.time.delayedCall(RUN_OVER_INPUT_DELAY_MS, () => {
      this.armed = true;
    });
  }

  private startNewRun(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.start('Starter');
  }
}
