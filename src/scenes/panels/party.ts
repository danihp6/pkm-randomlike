import type Phaser from 'phaser';
import { ITEM_ICON_TEXTURE_KEY, itemIconFrame } from '../../data/itemIcons';
import { PORTRAIT_TEXTURE_KEY, portraitFor } from '../../data/portraits';
import { STATUS_ICON_TEXTURE_KEY, STATUS_ICON_W, statusIconFrame } from '../../data/statusIcons';
import { getSpecies } from '../../data/dex';
import { restoreFighter } from '../../engine/battle';
import { MAX_PARTY_SIZE, type RunPokemon } from '../../engine/run';
import {
  FRLG_HPBAR,
  FRLG_HPBAR_KEY,
  FRLG_SELECTED_FILL,
  FRLG_SELECTED_STROKE,
  addFrlgWindow,
} from '../../ui/frlg';
import { FRLG_INK, addFrlgText } from '../../ui/frlgFont';
import { hpColorInt, hpFraction } from '../../ui/metrics';
import type { PaneId } from '../../ui/partyScreen';
import { PANEL_ICON_KEYS } from '../BootScene';
import {
  HUD_PAD_BOTTOM,
  HUD_PAD_X,
  HUD_PARTY_COLUMN,
  HUD_TOP,
  HUD_VIAL_H,
  HUD_VIAL_Y,
  PANEL_KEY_ACTIONS,
  draggedItemFrom,
  hudColumnLeft,
  makeHudPanel,
  panelExpanded,
  panelPoint,
} from './hud';
import type { RoutePanelDescriptor, RoutePanelHost } from './types';

/**
 * The party window: the squad's six rows (portrait, name, status badge and HP bar)
 * under the shared level/XP line and the Pokevial bar the frame layer paints. A row
 * is a hit target for the scene's drag path; it repaints from the run, never per
 * frame.
 */

const HUD_PARTY_ROW = 52;
/** The party avatar, enlarged to the row height so the held-item badge reads. */
const HUD_PARTY_PORTRAIT_SCALE = 0.7;
/** The status badge at the right of a party row's name line (the detail header shares it). */
export const HUD_PARTY_STATUS_SCALE = 1.5;
/** Gap (px) kept between the row name and its status badge. */
const HUD_PARTY_STATUS_GAP = 4;
/** The held-item icon on an avatar's lower-right corner. */
const HUD_HELD_ICON_SCALE = 0.85;
/** The party header's band: the level line, the XP bar and the vial, over the rows. */
const HUD_PARTY_HEADER = HUD_VIAL_Y + HUD_VIAL_H + 8;

let hudRows: {
  highlight: Phaser.GameObjects.Rectangle;
  portrait: Phaser.GameObjects.Image;
  held: Phaser.GameObjects.Image;
  status: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.BitmapText;
  bar: Phaser.GameObjects.Image;
  fill: Phaser.GameObjects.Rectangle;
}[] = [];
/** The party window's own top and height, which the bag window stacks under. */
let hudPartyY = 0;
let hudPartyH = 0;

/** The members a pane shows: the party, the PC box, or the fallen. */
export function paneMembers(host: RoutePanelHost, pane: PaneId): readonly RunPokemon[] {
  const run = host.run();
  if (pane === 'party') return run.party;
  return pane === 'rip' ? run.rip : run.box;
}

/** The party window's bottom edge, so the bag window can stack under it. */
export function partyBottom(): number {
  return hudPartyY + hudPartyH;
}

/** True when the pointer is on the party window's frame. */
export function pointerInPartyPanel(host: RoutePanelHost, pointer: Phaser.Input.Pointer): boolean {
  if (!panelExpanded(host, 'party')) return false;
  const point = panelPoint(host, pointer, 'party');
  const x = hudColumnLeft(host);
  return (
    point.x >= x &&
    point.x <= x + host.hud().partyW &&
    point.y >= hudPartyY &&
    point.y <= hudPartyY + hudPartyH
  );
}

/** The party index under the pointer, or null outside a filled row. */
export function hudPartyRowAt(host: RoutePanelHost, pointer: Phaser.Input.Pointer): number | null {
  if (!pointerInPartyPanel(host, pointer)) return null;
  const point = panelPoint(host, pointer, 'party');
  const rowTop = hudPartyY + HUD_PARTY_HEADER;
  const slot = Math.floor((point.y - rowTop) / HUD_PARTY_ROW);
  if (point.y < rowTop || slot < 0 || slot >= MAX_PARTY_SIZE) return null;
  return slot < host.run().party.length ? slot : null;
}

/** A party row's held-item badge, so the drag path can take the item in hand. */
export function partyHeldBadge(index: number): Phaser.GameObjects.Image | undefined {
  return hudRows[index]?.held;
}

/** Paints one party portrait for the level-up beat, and clears it afterwards. */
export function setPartyPortraitTint(index: number, tint: number): void {
  hudRows[index]?.portrait.setTint(tint);
}

export function clearPartyPortraitTints(): void {
  for (const row of hudRows) row.portrait.clearTint();
}

function refreshParty(host: RoutePanelHost): void {
  if (hudRows.length === 0) return;
  const run = host.run();
  const ui = host.ui();
  const x = hudColumnLeft(host);
  hudRows.forEach((row, i) => {
    const member = run.party[i];
    const visible = member !== undefined;
    const alive = member !== undefined && member.fighter.hp > 0;
    row.highlight.setVisible(ui.grabbed?.pane === 'party' && ui.index === i);
    row.name.setVisible(visible);
    row.bar.setVisible(alive);
    row.fill.setVisible(alive);
    if (!member) {
      row.portrait.setVisible(false);
      row.held.setVisible(false);
      row.status.setVisible(false);
      row.name.setText('');
      return;
    }
    const portrait = portraitFor(member.fighter.speciesId, member.fighter.shiny);
    row.portrait.setVisible(portrait !== null);
    if (portrait) row.portrait.setTexture(portrait.key, portrait.frame);
    const statusFrame = member.fighter.status ? statusIconFrame(member.fighter.status) : null;
    row.status.setVisible(statusFrame !== null);
    if (statusFrame !== null) row.status.setFrame(statusFrame);
    const heldFrame = member.fighter.heldItem ? itemIconFrame(member.fighter.heldItem) : null;
    const inHand = draggedItemFrom() === member.fighter.id;
    row.held.setVisible(heldFrame !== null && !inHand);
    if (heldFrame !== null) row.held.setFrame(heldFrame);
    const maxHp = restoreFighter(member.fighter).maxHp;
    const hp = member.fighter.hp;
    row.name.setText(
      member.fighter.nickname ?? getSpecies(member.fighter.speciesId)?.name ?? member.fighter.speciesId,
    );
    row.name.setMaxWidth(
      x +
        host.hud().partyW -
        HUD_PAD_X -
        row.name.x -
        (statusFrame !== null ? STATUS_ICON_W * HUD_PARTY_STATUS_SCALE + HUD_PARTY_STATUS_GAP : 0),
    );
    const fraction = hpFraction(hp, maxHp);
    const barScale = row.bar.scaleX;
    row.fill
      .setPosition(row.bar.x + FRLG_HPBAR.fill.x * barScale, row.bar.y + FRLG_HPBAR.fill.y * barScale)
      .setSize(
        Math.max(0, FRLG_HPBAR.fill.width * barScale * fraction),
        FRLG_HPBAR.fill.height * barScale,
      )
      .setFillStyle(hpColorInt(fraction));
  });
}

export const descriptor: RoutePanelDescriptor = {
  id: 'party',
  order: 20,
  hudPanel: 'party',
  build(host: RoutePanelHost): void {
    const scene = host.scene;
    const x = hudColumnLeft(host);
    const { partyW, partyHpBarScale } = host.hud();
    const partyChildren: Phaser.GameObjects.GameObject[] = [];
    const partyY = HUD_TOP;
    const partyH = HUD_PARTY_HEADER + MAX_PARTY_SIZE * HUD_PARTY_ROW + HUD_PAD_BOTTOM;
    hudPartyY = partyY;
    hudPartyH = partyH;
    const partyWindow = addFrlgWindow(scene, x, partyY, partyW, partyH);
    partyChildren.push(partyWindow);
    const partyLeft = x + HUD_PAD_X;
    const partyRight = x + partyW - HUD_PAD_X;
    hudRows = [];
    for (let i = 0; i < MAX_PARTY_SIZE; i++) {
      const rowY = partyY + HUD_PARTY_HEADER + i * HUD_PARTY_ROW;
      const highlight = scene.add
        .rectangle(
          partyLeft,
          rowY,
          partyRight - partyLeft,
          HUD_PARTY_ROW - 4,
          FRLG_SELECTED_FILL.colour,
          FRLG_SELECTED_FILL.alpha,
        )
        .setOrigin(0, 0)
        .setStrokeStyle(1, FRLG_SELECTED_STROKE.colour, FRLG_SELECTED_STROKE.alpha)
        .setVisible(false);
      const portraitX = partyLeft + 24;
      const portrait = scene.add
        .image(portraitX, rowY + 26, PORTRAIT_TEXTURE_KEY, 0)
        .setScale(HUD_PARTY_PORTRAIT_SCALE)
        .setVisible(false);
      const held = scene.add
        .image(portraitX + 15, rowY + 39, ITEM_ICON_TEXTURE_KEY, 0)
        .setScale(HUD_HELD_ICON_SCALE)
        .setVisible(false);
      const column = partyLeft + HUD_PARTY_COLUMN;
      const name = addFrlgText(scene, column, rowY + 6, '', { size: 16, tint: FRLG_INK }).setMaxWidth(
        partyRight - column,
      );
      const status = scene.add
        .image(partyRight, rowY + 5, STATUS_ICON_TEXTURE_KEY, 0)
        .setOrigin(1, 0)
        .setScale(HUD_PARTY_STATUS_SCALE)
        .setVisible(false);
      const bar = scene.add
        .image(column, rowY + 28, FRLG_HPBAR_KEY)
        .setOrigin(0, 0)
        .setScale(partyHpBarScale)
        .setVisible(false);
      const fill = scene.add
        .rectangle(column, rowY + 28, 0, FRLG_HPBAR.fill.height * partyHpBarScale, 0x58d080)
        .setOrigin(0, 0)
        .setVisible(false);
      hudRows.push({ highlight, portrait, held, status, name, bar, fill });
      partyChildren.push(highlight, portrait, held, name, status, bar, fill);
    }
    makeHudPanel(
      host,
      'party',
      x,
      partyY,
      partyW,
      partyH,
      scene.add.container(0, 0, partyChildren),
      partyWindow,
      PANEL_ICON_KEYS.party,
      PANEL_KEY_ACTIONS.party ?? null,
    );
  },
  refresh: refreshParty,
};
