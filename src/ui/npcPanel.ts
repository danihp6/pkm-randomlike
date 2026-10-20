import type Phaser from 'phaser';
import type { KeybindAction } from '../data/keybinds';
import { t } from '../i18n';
import {
  FRLG_ACCENT,
  FRLG_ROW_FILL,
  FRLG_ROW_STROKE,
  FRLG_SELECTED_FILL,
  FRLG_SELECTED_STROKE,
  addFrlgWindow,
} from './frlg';
import { FRLG_INK, addFrlgText } from './frlgFont';
import { FLOATING_MARGIN, clampPanelOrigin, type PanelRect, type PanelViewport } from './floatingPanel';

/**
 * The one card every special NPC fills (`docs/maps-spec.md` §7,
 * `docs/design-spec.md` §7): a modal glass window with a title, one wrapped
 * paragraph, a column of choices and the shell's own `LEAVE` row. It draws and
 * reports; it owns no rule and no run state — the caller resolves the strings and
 * the chosen row's effect. The layout half is pure and headless.
 */

export const NPC_PANEL_W = 520;
export const NPC_PANEL_H = 360;
export const NPC_PANEL_PAD = 24;
export const NPC_CHOICE_H = 40;
export const NPC_CHOICE_GAP = 6;
/** A column of at most six choices above `LEAVE`; more are clamped. */
export const NPC_MAX_CHOICES = 6;

/** The title band, from the card's padding down. */
const NPC_TITLE_H = 28;
/** The band the wrapped paragraph may use under the title. */
const NPC_PARAGRAPH_H = 96;
/** The gap the title, the paragraph and the row column keep from each other. */
const NPC_BLOCK_GAP = 12;
/** The card's depth: a modal window, over the route HUD and every floating card. */
const NPC_PANEL_DEPTH = 500;
/** A row label's inset from its row's edge, and its own line's offset. */
const NPC_ROW_INSET = 16;
const NPC_ROW_LINE = 10;

export type NpcChoiceView = Readonly<{ id: string; label: string }>;

/** What the caller hands in: already-resolved strings (the caller owns `t`). */
export type NpcPanelView = Readonly<{
  title: string;
  paragraph: string;
  choices?: readonly NpcChoiceView[];
}>;

/** Where the card and its rows sit, in screen px. Pure and headless. */
export type NpcPanelLayout = Readonly<{
  x: number;
  y: number;
  w: number;
  h: number;
  choices: readonly PanelRect[];
  leave: PanelRect;
}>;

function clampedChoiceCount(count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.min(NPC_MAX_CHOICES, Math.floor(count));
}

/**
 * Centred, clamped inside `viewport`; `LEAVE` is always the last row. The card is
 * `NPC_PANEL_H` tall until the choice column stops fitting over the paragraph and
 * grows just enough to hold it, so a full column never rides into the title.
 */
export function npcPanelLayout(viewport: PanelViewport, choiceCount: number): NpcPanelLayout {
  const count = clampedChoiceCount(choiceCount);
  const w = Math.max(0, Math.min(NPC_PANEL_W, viewport.w - 2 * FLOATING_MARGIN));
  const rowsH = (count + 1) * NPC_CHOICE_H + count * NPC_CHOICE_GAP;
  const fitting =
    NPC_PANEL_PAD +
    NPC_TITLE_H +
    NPC_BLOCK_GAP +
    NPC_PARAGRAPH_H +
    NPC_BLOCK_GAP +
    rowsH +
    NPC_PANEL_PAD;
  const h = Math.max(0, Math.min(viewport.h - 2 * FLOATING_MARGIN, Math.max(NPC_PANEL_H, fitting)));
  const origin = clampPanelOrigin((viewport.w - w) / 2, (viewport.h - h) / 2, w, h, viewport);

  const left = origin.x + NPC_PANEL_PAD;
  const innerW = Math.max(0, w - NPC_PANEL_PAD * 2);
  const leaveTop = origin.y + h - NPC_PANEL_PAD - NPC_CHOICE_H;
  const choices: PanelRect[] = [];
  for (let i = 0; i < count; i++) {
    const y = leaveTop - (count - i) * (NPC_CHOICE_H + NPC_CHOICE_GAP);
    choices.push({ x: left, y, w: innerW, h: NPC_CHOICE_H });
  }

  return {
    x: origin.x,
    y: origin.y,
    w,
    h,
    choices,
    leave: { x: left, y: leaveTop, w: innerW, h: NPC_CHOICE_H },
  };
}

export type NpcPanel = Readonly<{
  close(): void;
  handle(action: KeybindAction): void;
}>;

type RowObjects = Readonly<{
  highlight: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.BitmapText;
}>;

/** Draws the rows a card prints: one per choice, then the shell's own `LEAVE`. */
function addRows(
  scene: Phaser.Scene,
  rects: readonly PanelRect[],
  labels: readonly string[],
  onPick: (index: number) => void,
  onHover: (index: number) => void,
  children: Phaser.GameObjects.GameObject[],
): RowObjects[] {
  const rows: RowObjects[] = [];
  rects.forEach((rect, index) => {
    const field = scene.add
      .rectangle(rect.x, rect.y, rect.w, rect.h, FRLG_ROW_FILL.colour, FRLG_ROW_FILL.alpha)
      .setOrigin(0, 0)
      .setStrokeStyle(1, FRLG_ROW_STROKE.colour, FRLG_ROW_STROKE.alpha);
    const highlight = scene.add
      .rectangle(rect.x, rect.y, rect.w, rect.h, FRLG_SELECTED_FILL.colour, FRLG_SELECTED_FILL.alpha)
      .setOrigin(0, 0)
      .setStrokeStyle(1, FRLG_SELECTED_STROKE.colour, FRLG_SELECTED_STROKE.alpha)
      .setVisible(false);
    const label = addFrlgText(scene, rect.x + NPC_ROW_INSET, rect.y + NPC_ROW_LINE, labels[index], {
      size: 16,
      tint: FRLG_INK,
    }).setMaxWidth(Math.max(0, rect.w - NPC_ROW_INSET * 2));
    const zone = scene.add
      .zone(rect.x, rect.y, rect.w, rect.h)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => onHover(index));
    zone.on('pointerdown', () => onPick(index));
    rows.push({ highlight, label });
    children.push(field, highlight, label, zone);
  });
  return rows;
}

/**
 * Draws the modal card and owns its keyboard until `close()`.
 * `onChoose` fires once per confirm on a choice row, then the card closes;
 * confirming `LEAVE` or `cancel` closes without firing it.
 */
export function openNpcPanel(
  scene: Phaser.Scene,
  view: NpcPanelView,
  onChoose?: (id: string) => void,
): NpcPanel {
  const choices: readonly NpcChoiceView[] = (view.choices ?? []).slice(0, NPC_MAX_CHOICES);
  const layout = npcPanelLayout({ w: scene.scale.width, h: scene.scale.height }, choices.length);
  const labels = [...choices.map((choice) => choice.label), t('npc.leave')];
  const rects = [...layout.choices, layout.leave];
  const total = rects.length;
  let index = 0;
  let closed = false;

  const children: Phaser.GameObjects.GameObject[] = [
    scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0x05070c, 0.72).setOrigin(0, 0),
    addFrlgWindow(scene, layout.x, layout.y, layout.w, layout.h),
    addFrlgText(scene, layout.x + NPC_PANEL_PAD, layout.y + NPC_PANEL_PAD, view.title, {
      size: 24,
      tint: FRLG_INK,
    }),
  ];
  const paragraph = addFrlgText(
    scene,
    layout.x + NPC_PANEL_PAD,
    layout.y + NPC_PANEL_PAD + NPC_TITLE_H + NPC_BLOCK_GAP,
    view.paragraph,
    { size: 16, tint: FRLG_INK },
  );
  paragraph.setMaxWidth(Math.max(0, layout.w - NPC_PANEL_PAD * 2));
  children.push(paragraph);

  const rows = addRows(
    scene,
    rects,
    labels,
    (picked) => {
      index = picked;
      paint();
      activate();
    },
    (hovered) => {
      if (hovered === index) return;
      index = hovered;
      paint();
    },
    children,
  );

  const root = scene.add.container(0, 0, children).setDepth(NPC_PANEL_DEPTH);
  scene.cameras.main.ignore(root);

  function paint(): void {
    rows.forEach((row, i) => {
      row.highlight.setVisible(i === index);
      row.label.setTint(i === index ? FRLG_ACCENT : FRLG_INK);
    });
  }

  function close(): void {
    if (closed) return;
    closed = true;
    root.destroy(true);
  }

  function activate(): void {
    if (closed) return;
    if (index >= choices.length) {
      close();
      return;
    }
    const chosen = choices[index];
    onChoose?.(chosen.id);
    close();
  }

  function handle(action: KeybindAction): void {
    if (closed) return;
    switch (action) {
      case 'up':
        index = (index - 1 + total) % total;
        paint();
        return;
      case 'down':
        index = (index + 1) % total;
        paint();
        return;
      case 'confirm':
      case 'interact':
        activate();
        return;
      case 'cancel':
        close();
        return;
      default:
        return;
    }
  }

  paint();
  return { close, handle };
}
