import Phaser from 'phaser';
import { PORTRAIT_TEXTURE_KEY, portraitFrameFor } from '../data/portraits';
import { MAX_PARTY_SIZE, type RunState } from '../engine/run';
import { subscribeKeybinds } from '../input/input';
import { FRLG_WINDOW_PADDING, addFrlgWindow } from '../ui/frlg';
import { FRLG_INK, addFrlgText } from '../ui/frlgFont';
import { hpColorInt, hpFraction } from '../ui/metrics';
import {
  boxRows,
  initialPartyUi,
  partyInput,
  partyRows,
  windowStart,
  type PartyInput,
  type PartyRow,
  type PartyUiState,
  type PaneId,
} from '../ui/partyScreen';
import type { RouteScene } from './RouteScene';

type Mode = 'field' | 'rest';

const PANEL_Y = 104;
const PANEL_H = 404;
const ROW_H = 58;
const VISIBLE_ROWS = 6;
const ROW_TOP = 44;
const PANEL_W = { party: 560, box: 604 } as const;
const PANEL_X = { party: 36, box: 640 } as const;
const STATUS_COLOURS: Readonly<Record<string, number>> = {
  BRN: 0xef4444,
  PSN: 0xa855f7,
  TOX: 0xa855f7,
  PAR: 0xf59e0b,
  SLP: 0x64748b,
  FRZ: 0x38bdf8,
};

type RowView = {
  highlight: Phaser.GameObjects.Rectangle;
  portrait: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.BitmapText;
  stats: Phaser.GameObjects.BitmapText;
  status: Phaser.GameObjects.BitmapText;
};

type PaneView = {
  cursor: Phaser.GameObjects.BitmapText;
  rows: RowView[];
};

/**
 * The party/PC screen (Phase 6). Opened from the route HUD (`P`) or as the
 * between-route healing stop; the pure `ui/partyScreen.ts` reducer owns the
 * cursor and the moves, this only draws it and feeds it keys. `Z` picks a member
 * up, `up`/`down` reorders it and `left`/`right` sends it to the other pane;
 * `X` puts it back or leaves the screen (which advances the route at a stop).
 */
export class PartyScene extends Phaser.Scene {
  private run!: RunState;
  private mode: Mode = 'field';
  private ui: PartyUiState = initialPartyUi();
  private views!: Record<PaneId, PaneView>;
  private title!: Phaser.GameObjects.BitmapText;
  private note!: Phaser.GameObjects.BitmapText;
  private footer?: Phaser.GameObjects.BitmapText;

  constructor() {
    super('Party');
  }

  init(data: { run: RunState; mode?: Mode }): void {
    this.run = data.run;
    this.mode = data.mode ?? 'field';
    this.ui = initialPartyUi();
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, 0x10161f).setOrigin(0, 0);
    this.title = addFrlgText(this, PANEL_X.party, 40, '');
    this.note = addFrlgText(this, width - PANEL_X.party, 40, '', { size: 16, tint: 0x94a3b8, origin: [1, 0] });

    this.views = { party: this.buildPane('party'), box: this.buildPane('box') };
    this.footer = addFrlgText(this, PANEL_X.party, PANEL_Y + PANEL_H + 32, '', { size: 16, tint: 0x94a3b8 });
    this.bindInput();
    this.render();
  }

  private buildPane(pane: PaneId): PaneView {
    const x = PANEL_X[pane];
    const width = PANEL_W[pane];
    addFrlgWindow(this, x, PANEL_Y, width, PANEL_H);
    addFrlgText(this, x + FRLG_WINDOW_PADDING.x, PANEL_Y + FRLG_WINDOW_PADDING.top, pane === 'party' ? 'PARTY' : 'PC BOX', {
      size: 16,
      tint: 0x3a3956,
    });
    const rows: RowView[] = [];
    for (let slot = 0; slot < VISIBLE_ROWS; slot++) {
      const rowY = PANEL_Y + ROW_TOP + slot * ROW_H;
      const highlight = this.add
        .rectangle(x + FRLG_WINDOW_PADDING.x, rowY, width - FRLG_WINDOW_PADDING.x * 2, ROW_H - 6, 0xf2c14e, 0.28)
        .setOrigin(0, 0)
        .setVisible(false);
      const portrait = this.add
        .image(x + 40, rowY + ROW_H / 2 - 2, PORTRAIT_TEXTURE_KEY, 0)
        .setScale(0.9)
        .setVisible(false);
      const name = addFrlgText(this, x + 68, rowY + 4, '', { size: 16, tint: FRLG_INK });
      const stats = addFrlgText(this, x + 68, rowY + 26, '', { size: 16, tint: FRLG_INK });
      const status = addFrlgText(this, x + width - FRLG_WINDOW_PADDING.x, rowY + 16, '', {
        size: 16,
        origin: [1, 0],
      });
      rows.push({ highlight, portrait, name, stats, status });
    }
    const cursor = addFrlgText(this, x + FRLG_WINDOW_PADDING.x, PANEL_Y + ROW_TOP + ROW_H / 2 - 8, '▶', {
      size: 16,
      origin: [0, 0],
    });
    return { cursor, rows };
  }

  private bindInput(): void {
    subscribeKeybinds(this, ({ action }) => {
      // The party screen uses the six menu actions and ignores the ones that
      // only mean something on the route.
      if (action === 'party' || action === 'hud' || action === 'settings' || action === 'run') return;
      const input: PartyInput = action;
      if (input === 'cancel' && this.ui.grabbed === null) {
        this.close();
        return;
      }
      const next = partyInput(this.run, this.ui, input);
      this.run = next.run;
      this.ui = next.ui;
      this.render();
    });
  }

  /** Hands the route the run as it stands, then closes the screen. */
  private close(): void {
    const route = this.scene.get('Route') as RouteScene;
    route.applyPartyResult(this.run);
    this.scene.resume('Route');
    this.scene.stop();
  }

  private render(): void {
    const party = partyRows(this.run);
    const box = boxRows(this.run);
    this.title.setText(this.mode === 'rest' ? 'REST STOP' : 'PARTY & PC');
    this.note.setText(
      this.mode === 'rest'
        ? `Route ${this.run.routeIndex + 1} ahead  ·  healed`
        : `Route ${this.run.routeIndex}`,
    );
    this.renderPane('party', party);
    this.renderPane('box', box);
    this.renderFooter(party.length, box.length);
  }

  private renderPane(pane: PaneId, members: readonly PartyRow[]): void {
    const view = this.views[pane];
    const active = this.ui.pane === pane;
    const grabbed = this.ui.grabbed !== null && this.ui.grabbed.pane === pane;
    // An inactive pane shows from its top: the shared cursor index only means
    // something in the pane it is in.
    const start = active ? windowStart(members.length, this.ui.index, VISIBLE_ROWS) : 0;
    view.rows.forEach((row, slot) => {
      const member = members[start + slot];
      if (!member) {
        row.highlight.setVisible(false);
        row.portrait.setVisible(false);
        row.name.setText('');
        row.stats.setText('');
        row.status.setText('');
        return;
      }
      const isCursor = active && this.ui.index === start + slot;
      row.highlight.setVisible(isCursor && grabbed);
      const frame = portraitFrameFor(member.speciesId);
      row.portrait.setVisible(frame !== null);
      if (frame !== null) row.portrait.setFrame(frame);
      row.name.setText(`${member.name}  Lv${member.level}`).setAlpha(active ? 1 : 0.7);
      const fraction = hpFraction(member.hp, member.maxHp);
      row.stats
        .setText(`HP ${member.hp}/${member.maxHp}`)
        .setTint(member.hp > 0 ? hpColorInt(fraction) : 0x94a3b8)
        .setAlpha(active ? 1 : 0.7);
      row.status.setText(member.statusLabel ?? '').setTint(STATUS_COLOURS[member.statusLabel ?? ''] ?? 0x64748b);
    });
    view.cursor.setVisible(active && members.length > 0);
    view.cursor.setY(PANEL_Y + ROW_TOP + (this.ui.index - start) * ROW_H + ROW_H / 2 - 8);
  }

  private renderFooter(partyCount: number, boxCount: number): void {
    const grabbable = this.ui.grabbed === null ? 'Z pick up' : 'Z drop';
    const footer = [
      '↑↓ select',
      grabbable,
      '←→ party / box',
      this.mode === 'rest' ? 'X / Enter continue' : 'X leave',
    ].join('   ·   ');
    this.footer?.setText(`${footer}\nParty ${partyCount}/${MAX_PARTY_SIZE}   ·   Box ${boxCount}`);
  }
}
