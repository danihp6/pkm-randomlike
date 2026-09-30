import Phaser from 'phaser';
import type { RunState } from '../engine/run';
import { clearRun } from '../engine/save';
import { browserStorage } from '../storage';
import { addFrlgWindow } from '../ui/frlg';
import { addFrlgText } from '../ui/frlgFont';
import { RUN_OVER_INPUT_DELAY_MS, runSummary, runSummaryLines } from '../ui/runSummary';

/**
 * The end-of-run score screen (Phase 7). The route hands over the run and
 * whether it was won; a lost run is the permadeath payoff — the party is gone
 * and nothing carries over, so this is where the run stops and a new one begins.
 * The summary reports the routes cleared, the catches, the casualties and the
 * seed, all from the run itself.
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
    // Permadeath (D5): the run is over for good, so the save slot forgets it.
    clearRun(browserStorage());
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, 0x05070c).setOrigin(0, 0);

    const lines = runSummaryLines(runSummary(this.run, this.won));
    const panelW = 720;
    const panelH = 356;
    const x = (width - panelW) / 2;
    const y = (height - panelH) / 2 - 16;
    addFrlgWindow(this, x, y, panelW, panelH, 'textbox');
    addFrlgText(this, width / 2, y + 44, lines[0], { size: 32, origin: 0.5 });
    addFrlgText(this, width / 2, y + 88, lines[1], { size: 16, tint: 0x94a3b8, origin: 0.5 });
    lines.slice(2).forEach((line, i) => {
      addFrlgText(this, x + 64, y + 140 + i * 44, line, { size: 16 });
    });
    addFrlgText(this, width / 2, y + panelH + 28, 'Z / Enter — start a new run', {
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
