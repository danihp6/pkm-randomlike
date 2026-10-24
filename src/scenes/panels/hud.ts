import { signal, type Signal } from '@preact/signals';
import type Phaser from 'phaser';
import { keyLabel, type KeybindAction } from '../../data/keybinds';
import type { HudPanelId } from '../../data/hudLayout';
import { POKEVIAL_MAX_CHARGES, experienceFraction, squadLevel, usePokevial } from '../../engine/run';
import { t } from '../../i18n';
import { prefersTouchControls } from '../../input/device';
import { saveSettings } from '../../settings';
import {
  FRLG_HPBAR,
  FRLG_MUTED,
  FRLG_TRACK,
  FRLG_WINDOW_ALPHA,
  FRLG_WINDOW_PADDING,
} from '../../ui/frlg';
import { FRLG_INK, addFrlgText } from '../../ui/frlgFont';
import type { HudCommand } from '../../ui/hud/commands';
import { parseHudFlags } from '../../ui/hud/fixtures';
import { mountHudStrip, stripView, type StripSlot, type StripView } from '../../ui/hud/panels/hud';
import { PANEL_ICON_SIZE } from '../BootScene';
import type { HudMetrics, HudPanel, RoutePanelDescriptor, RoutePanelHost } from './types';

/**
 * The HUD's frame machinery (`D47`'s shape): the draggable panel records, their
 * collapse icons, the drag/clamp/persist rules, the Transparent HUD repaint and the
 * party header's shared level, XP and Pokevial bar. Every other panel builds its
 * window through `makeHudPanel`, so the frame, its z-order and its saved layout have
 * exactly one owner.
 *
 * With `?hud=dom` (`D49`) the header paints nothing here — the party card owns the
 * level, XP and Pokevial readouts — and the one piece of route chrome a collapsed
 * DOM card loses, the edge chips, is the strip in `src/ui/hud/panels/hud/`.
 */

/** `?hud=dom`, read once: the canvas draws no HUD chrome at all. */
const DOM_HUD = typeof window === 'undefined' ? false : parseHudFlags(window.location.search).dom;
/**
 * `Phaser.Scenes.Events.PAUSE` / `RESUME`, spelled out because this folder imports
 * Phaser type-only: the route stops under a battle or the Settings screen and comes
 * back from it on these two (the same pair `map.ts` listens to).
 */
const SCENE_PAUSE = 'pause';
const SCENE_RESUME = 'resume';

/** The panel widths the metrics clamp: the fixed design sizes. */
export const HUD_PANEL_W = 344;
export const HUD_PARTY_W = 250;
export const HUD_DETAIL_W = 460;
export const HUD_MAP_W = 216;
/** The party row's portrait column, which the HP bar starts after. */
export const HUD_PARTY_COLUMN = 56;

export const HUD_TOP = 8;
export const HUD_GAP = 8;
/** Content stays inside the FRLG window's baked border (`FRLG_WINDOW_PADDING`). */
export const HUD_PAD_X = FRLG_WINDOW_PADDING.x;
export const HUD_PAD_TOP = FRLG_WINDOW_PADDING.top;
export const HUD_PAD_BOTTOM = FRLG_WINDOW_PADDING.bottom + 4;

/** The bag and PC-box pocket/page tab strips: one FRLG folder per tab. */
export const HUD_TAB_W = 55;
export const HUD_TAB_H = 26;
export const HUD_TAB_GAP = 4;
/** The one filter/search field the bag and the detail panel share. */
export const HUD_SEARCH_H = 24;

/** The Pokevial bar centred under the party header's level/XP line: its size in px. */
export const HUD_VIAL_W = 100;
export const HUD_VIAL_H = 20;
/**
 * The Pokevial fill colour at 1, 2 and 3 charges. A single bar that grows and
 * changes shade as it fills, so the three steps read as one meter topping up.
 */
const HUD_VIAL_FILL_COLORS = [0xfde68a, 0xfbbf24, 0xf97316];
export const HUD_XP_BAR_INSET = 12;
export const HUD_XP_BAR_H = 8;
export const HUD_XP_BAR_Y = HUD_PAD_TOP + 16 + 6;
export const HUD_VIAL_Y = HUD_XP_BAR_Y + HUD_XP_BAR_H + 8;

/** The frame band (px) of a HUD panel that grabs it instead of its content. */
const HUD_PANEL_BORDER = 12;
/** How far (px) past a panel's frame the grab band reaches, to cover the seam. */
const HUD_PANEL_GRAB_PAD = 4;
/** Gap (px) a moved panel keeps from the screen edge. */
export const HUD_PANEL_MARGIN = 8;
/** The collapse-icon button at a panel's top-left, flush with the corner. */
const HUD_ICON = PANEL_ICON_SIZE;
const HUD_ICON_INSET = 0;
/** Alpha of a panel's window background when the Transparent HUD option is on. */
const HUD_BG_TRANSPARENT_ALPHA = 0;
/**
 * With the window hidden, each panel keeps a drawn outline so its edge still
 * reads, and its text turns to the card's ink to stay legible over the map
 * behind it. The outline is the muted tone (`scripts/ui/build-chrome.mjs`), so
 * the Transparent HUD still matches the card it stands in for.
 */
const HUD_BG_BORDER = FRLG_MUTED;
const HUD_BG_BORDER_WIDTH = 3;
const HUD_BG_BORDER_RADIUS = 12;
const HUD_BG_BORDER_ALPHA = 0.9;
const HUD_BG_TEXT = FRLG_INK;
/** Height of the key-hint band the button adds under the icon on a keyboard. */
const HUD_KEY_H = 16;
/** The key letter's text size, so it sits centred in that band. */
const HUD_KEY_TEXT = 16;
/** Where a panel's header/content starts, leaving room for the icon button. */
export const HUD_CONTENT_LEFT = HUD_ICON_INSET + HUD_ICON + 6;

/** Pointer travel (px) that turns a click into a drag while grabbing a member. */
export const HUD_DRAG_SLOP = 4;

/**
 * The quick key that opens each panel (`P` party, `I` bag, `M` map, `O` PC box).
 * The member detail popup has none, so its button stays a plain icon square.
 */
export const PANEL_KEY_ACTIONS: Readonly<Partial<Record<HudPanelId, KeybindAction>>> = {
  header: 'map',
  party: 'party',
  bag: 'bag',
  box: 'box',
};

/** The seven objects the party header adds (vial bg/fill/label, level, XP bg/fill/text). */
export const HUD_HEADER_OBJECTS = 7;

/** The HUD's panel widths for the current window, clamped to the screen. */
export function hudMetrics(width: number): HudMetrics {
  const max = Math.max(160, width - HUD_PANEL_MARGIN * 2);
  const partyW = Math.min(HUD_PARTY_W, max);
  const detailW = Math.min(HUD_DETAIL_W, max);
  return {
    panelW: Math.min(HUD_PANEL_W, max),
    partyW,
    detailW,
    mapW: Math.min(HUD_MAP_W, max),
    partyHpBarScale: (partyW - HUD_PAD_X * 2 - HUD_PARTY_COLUMN) / FRLG_HPBAR.width,
    xpBarW: partyW - HUD_PAD_X * 2 - HUD_XP_BAR_INSET * 2,
    // A clamped detail panel has little room, so it drops its lateral padding.
    detailPadX: detailW < HUD_DETAIL_W ? 12 : HUD_PAD_X,
  };
}

/** The right-hand HUD column's left edge: the party/bag/box stack's own x. */
export function hudColumnLeft(host: RoutePanelHost): number {
  return host.scene.scale.width - host.hud().panelW - HUD_PANEL_MARGIN;
}

/**
 * The phase the scene is dispatching: the descriptor's `pointer` carries no event
 * kind (`D47`'s port is frozen), so the scene names the phase before it walks the
 * registry and a panel reads it back here.
 */
export type PointerPhase = 'down' | 'move' | 'up';
let currentPhase: PointerPhase = 'move';

export function setPointerPhase(next: PointerPhase): void {
  currentPhase = next;
}

export function pointerPhase(): PointerPhase {
  return currentPhase;
}

/** The panel being dragged (pointer start + its offset at grab time), or null. */
let hudPanelDrag: {
  id: HudPanelId;
  pointerStart: { x: number; y: number };
  offsetStart: { x: number; y: number };
} | null = null;
/**
 * A press on a collapse icon waiting to become a click (toggle) or a drag
 * (once the pointer passes the slop), or null.
 */
let hudIconPress: { id: HudPanelId; originX: number; originY: number } | null = null;
/** Each panel text's own tint, so Transparent HUD can turn it white and back. */
let hudTextTints = new Map<Phaser.GameObjects.BitmapText, number>();
/** Whether the detail panel has been placed once (it is not re-docked after). */
let hudDetailPlaced = false;
/**
 * The objects that ride above every panel: the drag ghosts and the bag's
 * description card. `rank` keeps their shipped z-order whatever the build order.
 */
let overlays: { rank: number; object: Phaser.GameObjects.GameObject }[] = [];

/** The Pokevial bar in the party header: its charged fill and the label inside. */
let hudVialFill!: Phaser.GameObjects.Rectangle;
let hudVialLabel!: Phaser.GameObjects.BitmapText;
/** The squad's shared level and XP bar in the party header. */
let hudLevelText!: Phaser.GameObjects.BitmapText;
let hudXpFill!: Phaser.GameObjects.Rectangle;
let hudXpText!: Phaser.GameObjects.BitmapText;
/**
 * The equipment stack in hand while a bag item is dragged and the member whose
 * badge it came from — read by the bag, the party and the box so none of them
 * paints the item that is already in hand — plus whether the grab has moved.
 */
let hudDragItem: string | null = null;
let hudDragItemFrom: string | null = null;
let hudGrabMoved = false;

export function draggedItemId(): string | null {
  return hudDragItem;
}

export function draggedItemFrom(): string | null {
  return hudDragItemFrom;
}

export function setDraggedItem(itemId: string | null, from: string | null): void {
  hudDragItem = itemId;
  hudDragItemFrom = from;
}

export function grabMoved(): boolean {
  return hudGrabMoved;
}

export function setGrabMoved(moved: boolean): void {
  hudGrabMoved = moved;
}

/**
 * The port hands over the live panel records read-only, but raising a panel is a
 * reorder of that same array (draw order and hit order stay one list).
 */
function panelList(host: RoutePanelHost): HudPanel[] {
  return host.panels() as HudPanel[];
}

/** The panel with `id`, or undefined before the HUD is built. */
export function panelById(host: RoutePanelHost, id: HudPanelId): HudPanel | undefined {
  return host.panels().find((panel) => panel.id === id);
}

/** Whether a panel is expanded (content shown); a missing panel reads expanded. */
export function panelExpanded(host: RoutePanelHost, id: HudPanelId): boolean {
  return panelById(host, id)?.expanded ?? true;
}

/** A panel's layout rect before the drag offset: the window, or its icon. */
function panelBase(panel: HudPanel): { x: number; y: number; w: number; h: number } {
  if (!panel.expanded) {
    return {
      x: panel.x + HUD_ICON_INSET,
      y: panel.y + HUD_ICON_INSET,
      w: panel.iconW,
      h: panel.iconH,
    };
  }
  return { x: panel.x, y: panel.y, w: panel.w, h: panel.h };
}

/** A panel's current on-screen rect: its layout rect plus the drag offset. */
function panelRect(panel: HudPanel): { x: number; y: number; w: number; h: number } {
  const base = panelBase(panel);
  return { x: base.x + panel.dx, y: base.y + panel.dy, w: base.w, h: base.h };
}

/** The collapse-icon button's current on-screen rect. */
function panelIconRect(panel: HudPanel): { x: number; y: number; w: number; h: number } {
  return {
    x: panel.x + HUD_ICON_INSET + panel.dx,
    y: panel.y + HUD_ICON_INSET + panel.dy,
    w: panel.iconW,
    h: panel.iconH,
  };
}

/** The pointer in a panel's own (layout) coordinates, undoing its drag offset. */
export function panelPoint(
  host: RoutePanelHost,
  pointer: Phaser.Input.Pointer,
  id: HudPanelId,
): { x: number; y: number } {
  const panel = panelById(host, id);
  if (!panel) return { x: pointer.x, y: pointer.y };
  return { x: pointer.x - panel.dx, y: pointer.y - panel.dy };
}

/**
 * The topmost visible panel whose rect contains the pointer: the panel that owns
 * a click there. Overlapping panels stack, so only the one on top answers.
 */
export function hudPanelOwnerAt(host: RoutePanelHost, pointer: Phaser.Input.Pointer): HudPanel | null {
  const panels = host.panels();
  for (let i = panels.length - 1; i >= 0; i--) {
    const panel = panels[i];
    if (!panel.container.visible) continue;
    const base = panelRect(panel);
    const pad = panel.expanded ? HUD_PANEL_GRAB_PAD : 0;
    if (
      pointer.x >= base.x - pad &&
      pointer.x <= base.x + base.w + pad &&
      pointer.y >= base.y - pad &&
      pointer.y <= base.y + base.h + pad
    ) {
      return panel;
    }
  }
  return null;
}

/**
 * True when `pointer` is on a panel's frame: inside the window (plus a small
 * pad, so the seam between two panels is grabbable) but outside its inner,
 * interactive area. The header has nothing interactive, so all of it grabs.
 */
function onPanelBorder(panel: HudPanel, pointer: Phaser.Input.Pointer): boolean {
  const rect = panelRect(panel);
  const pad = HUD_PANEL_GRAB_PAD;
  const inside =
    pointer.x >= rect.x - pad &&
    pointer.x <= rect.x + rect.w + pad &&
    pointer.y >= rect.y - pad &&
    pointer.y <= rect.y + rect.h + pad;
  if (!inside) return false;
  if (panel.id === 'header') return true;
  const inset = HUD_PANEL_BORDER;
  const inner =
    pointer.x >= rect.x + inset &&
    pointer.x <= rect.x + rect.w - inset &&
    pointer.y >= rect.y + inset &&
    pointer.y <= rect.y + rect.h - inset;
  return !inner;
}

/**
 * The panel whose frame band is under the pointer. Only the topmost panel that
 * owns the point can be grabbed, so a border hidden behind another panel cannot
 * steal the drag.
 */
export function hudPanelAt(host: RoutePanelHost, pointer: Phaser.Input.Pointer): HudPanel | null {
  const owner = hudPanelOwnerAt(host, pointer);
  if (!owner) return null;
  return onPanelBorder(owner, pointer) ? owner : null;
}

/** The panel whose collapse icon is under the pointer; the topmost one wins. */
export function hudPanelIconAt(host: RoutePanelHost, pointer: Phaser.Input.Pointer): HudPanel | null {
  const owner = hudPanelOwnerAt(host, pointer);
  if (!owner) return null;
  const rect = panelIconRect(owner);
  if (
    pointer.x >= rect.x &&
    pointer.x <= rect.x + rect.w &&
    pointer.y >= rect.y &&
    pointer.y <= rect.y + rect.h
  ) {
    return owner;
  }
  return null;
}

/** Raises a panel over the rest, in both the draw order and the hit order. */
export function raisePanel(host: RoutePanelHost, panel: HudPanel): void {
  const panels = panelList(host);
  const index = panels.indexOf(panel);
  if (index >= 0 && index < panels.length - 1) {
    panels.splice(index, 1);
    panels.push(panel);
  }
  const root = host.hudRoot();
  root.bringToTop(panel.container);
  // The held member/item ghosts and the bag's card still ride above every panel.
  const ranked = [...overlays].sort((a, b) => a.rank - b.rank);
  for (const overlay of ranked) root.bringToTop(overlay.object);
}

/** Starts dragging `panel` from the pointer, raising it over the rest. */
export function startPanelDrag(
  host: RoutePanelHost,
  panel: HudPanel,
  pointer: Phaser.Input.Pointer,
): void {
  hudPanelDrag = {
    id: panel.id,
    pointerStart: { x: pointer.x, y: pointer.y },
    offsetStart: { x: panel.dx, y: panel.dy },
  };
  raisePanel(host, panel);
  host.scene.input.setDefaultCursor('grabbing');
}

/** Moves the dragged panel to follow the pointer; it overlaps the others freely. */
function updatePanelDrag(host: RoutePanelHost, pointer: Phaser.Input.Pointer): void {
  const drag = hudPanelDrag;
  if (!drag) return;
  const panel = panelById(host, drag.id);
  if (!panel) return;
  panel.dx = drag.offsetStart.x + (pointer.x - drag.pointerStart.x);
  panel.dy = drag.offsetStart.y + (pointer.y - drag.pointerStart.y);
  clampPanel(host, panel);
  applyPanelPositions(host);
}

function endPanelDrag(host: RoutePanelHost): void {
  hudPanelDrag = null;
  host.scene.input.setDefaultCursor('default');
  persistHudLayout(host);
}

/**
 * Lets go of a panel drag or an icon press without acting on it: the panel keeps
 * the position it reached. True when there was one to cancel.
 */
export function cancelPanelDrag(host: RoutePanelHost): boolean {
  if (hudPanelDrag) {
    endPanelDrag(host);
    return true;
  }
  if (hudIconPress) {
    hudIconPress = null;
    host.scene.input.setDefaultCursor('default');
    return true;
  }
  return false;
}

/**
 * Collapses a panel to its icon or expands it again. The panel keeps its place
 * and is raised over the others, so a panel opened over another reads on top.
 */
export function togglePanel(host: RoutePanelHost, panel: HudPanel): void {
  if (panel.expanded) {
    panel.expanded = false;
    panel.body.setVisible(false);
    applyPanelPositions(host);
    persistHudLayout(host);
    // The repaint is what takes a hidden panel's text field off the keyboard.
    host.refreshHud();
    return;
  }
  panel.expanded = true;
  panel.body.setVisible(true);
  clampPanel(host, panel);
  raisePanel(host, panel);
  applyPanelPositions(host);
  persistHudLayout(host);
  host.refreshHud();
}

/**
 * Opens or collapses the HUD panel a quick key points at, exactly as a click on
 * its collapse icon does. A quick key is a plain toggle (D45).
 */
export function toggleHudPanel(host: RoutePanelHost, id: HudPanelId): void {
  const panel = panelById(host, id);
  if (!panel) return;
  togglePanel(host, panel);
}

/** Pushes every panel's drag offset onto its container. */
export function applyPanelPositions(host: RoutePanelHost): void {
  for (const panel of host.panels()) panel.container.setPosition(panel.dx, panel.dy);
}

/** Keeps a panel fully on screen. */
export function clampPanel(host: RoutePanelHost, panel: HudPanel): void {
  const base = panelBase(panel);
  const maxX = Math.max(HUD_PANEL_MARGIN, host.scene.scale.width - base.w - HUD_PANEL_MARGIN);
  const maxY = Math.max(HUD_PANEL_MARGIN, host.scene.scale.height - base.h - HUD_PANEL_MARGIN);
  panel.dx = Math.max(HUD_PANEL_MARGIN - base.x, Math.min(maxX - base.x, panel.dx));
  panel.dy = Math.max(HUD_PANEL_MARGIN - base.y, Math.min(maxY - base.y, panel.dy));
}

/** Saves the current panel offsets and collapsed flags as a global preference. */
export function persistHudLayout(host: RoutePanelHost): void {
  if (host.panels().length === 0) return;
  const hudLayout = { ...host.settings().hudLayout };
  for (const panel of host.panels()) {
    hudLayout[panel.id] = { dx: panel.dx, dy: panel.dy, collapsed: !panel.expanded };
  }
  saveSettings({ ...host.settings(), hudLayout });
}

/** Applies the saved HUD layout to freshly built panels (D22 keeps settings). */
export function applyStoredHudLayout(host: RoutePanelHost): void {
  const layout = host.settings().hudLayout;
  for (const panel of host.panels()) {
    const stored = layout[panel.id];
    if (!stored) continue;
    panel.dx = stored.dx;
    panel.dy = stored.dy;
    panel.expanded = !stored.collapsed;
    panel.body.setVisible(panel.expanded);
  }
  applyHudBackground(host);
  // A resize can leave a stored layout off-screen; keep every panel reachable.
  // Overlaps are allowed, so the panels are just clamped, never pushed apart.
  for (const panel of host.panels()) clampPanel(host, panel);
  applyPanelPositions(host);
  hudDetailPlaced =
    host.settings().hudLayout.detail.dx !== 0 || host.settings().hudLayout.detail.dy !== 0;
}

/** Places the detail panel just left of the PC box the first time it opens. */
export function dockDetailPanel(host: RoutePanelHost): void {
  const detail = panelById(host, 'detail');
  const box = panelById(host, 'box');
  if (!detail || !box) return;
  const boxRect = panelRect(box);
  detail.dx = boxRect.x - HUD_GAP - host.hud().detailW - detail.x;
  detail.dy = boxRect.y - detail.y;
  clampPanel(host, detail);
  applyPanelPositions(host);
  persistHudLayout(host);
}

/**
 * Docks the detail panel the first time a member opens it; after that it stays
 * wherever the player dragged it.
 */
export function dockDetailPanelOnce(host: RoutePanelHost): void {
  if (hudDetailPlaced) return;
  hudDetailPlaced = true;
  dockDetailPanel(host);
}

/**
 * Fades every panel's window chrome in or out to match the Transparent HUD
 * option; the content stays fully drawn either way. With the window hidden each
 * panel keeps a drawn outline and its text turns to the card's ink, so it still
 * reads over the map behind it.
 */
export function applyHudBackground(host: RoutePanelHost): void {
  const transparent = host.settings().hudTransparent;
  const alpha = transparent ? HUD_BG_TRANSPARENT_ALPHA : FRLG_WINDOW_ALPHA;
  for (const panel of host.panels()) {
    panel.window.setAlpha(alpha);
    panel.border.setVisible(transparent);
    recolorPanelText(panel.body, transparent);
  }
}

/**
 * Turns every text inside a panel white (or restores its own colour). The
 * original tint is remembered the first time each text is seen, so a toggle
 * back and forth is lossless; a piece that re-tints itself (the move grid)
 * simply overrides this on its next refresh.
 */
function recolorPanelText(container: Phaser.GameObjects.Container, white: boolean): void {
  for (const child of container.list) {
    if (child.type === 'BitmapText') {
      const text = child as Phaser.GameObjects.BitmapText;
      if (!hudTextTints.has(text)) hudTextTints.set(text, text.tintTopLeft);
      text.setTint(white ? HUD_BG_TEXT : hudTextTints.get(text)!);
    } else if (child.type === 'Container') {
      recolorPanelText(child as Phaser.GameObjects.Container, white);
    }
  }
}

/** Re-prints the quick-key letters after a rebind (see `applySettings`). */
export function refreshPanelKeyLabels(host: RoutePanelHost): void {
  for (const panel of host.panels()) {
    if (panel.keyLabel && panel.key) {
      panel.keyLabel.setText(keyLabel(host.settings().keybinds[panel.key]));
    }
  }
}

/** Paints the party header's shared level line; the level-up beat counts it up. */
export function setHudLevel(level: number): void {
  // Under `?hud=dom` the party card paints the level and the header is never built.
  if (!hudLevelText) return;
  hudLevelText.setText(t('hud.level', { level }));
}

/** True when the pointer is on the Pokevial button in the party header. */
export function vialButtonAt(host: RoutePanelHost, pointer: Phaser.Input.Pointer): boolean {
  if (!panelExpanded(host, 'party')) return false;
  const point = panelPoint(host, pointer, 'party');
  const left = hudColumnLeft(host) + (host.hud().partyW - HUD_VIAL_W) / 2;
  const top = HUD_TOP + HUD_VIAL_Y;
  return (
    point.x >= left && point.x <= left + HUD_VIAL_W && point.y >= top && point.y <= top + HUD_VIAL_H
  );
}

/**
 * Drinks a full Pokevial: rests the whole party and box (clearing status) and
 * empties the meter. A partial or empty vial is a no-op, so a click never
 * changes the run.
 */
function drinkPokevial(host: RoutePanelHost): void {
  const run = host.run();
  const next = usePokevial(run);
  if (next === run) return;
  host.commitRun(next);
}

/**
 * One HUD panel: its body container plus the collapse button at its corner, booked
 * into the scene's panel records and the HUD root.
 */
export function makeHudPanel(
  host: RoutePanelHost,
  id: HudPanelId,
  x: number,
  y: number,
  w: number,
  h: number,
  body: Phaser.GameObjects.Container,
  window: Phaser.GameObjects.NineSlice,
  iconTexture: string,
  key: KeybindAction | null,
): HudPanel {
  const { icon, label, w: iconW, h: iconH } = buildPanelIcon(host, x, y, iconTexture, key);
  // Under `?hud=dom` the DOM cards own every chip and every press, so the Phaser
  // icon is provably unpainted from one place (the record still carries it).
  if (DOM_HUD) icon.setVisible(false);
  // The outline that stands in for the window while Transparent HUD is on. It
  // lives in the body, so collapsing the panel hides it with the content.
  const border = host.scene.add.graphics().setVisible(false);
  border.lineStyle(HUD_BG_BORDER_WIDTH, HUD_BG_BORDER, HUD_BG_BORDER_ALPHA);
  border.strokeRoundedRect(x, y, w, h, HUD_BG_BORDER_RADIUS);
  body.add(border);
  const container = host.scene.add.container(0, 0, [body, icon]);
  const panel: HudPanel = {
    id,
    container,
    body,
    icon,
    key,
    keyLabel: label,
    iconW,
    iconH,
    window,
    border,
    x,
    y,
    w,
    h,
    dx: 0,
    dy: 0,
    expanded: true,
  };
  host.registerPanel(panel);
  host.hudRoot().add(container);
  return panel;
}

/**
 * The dark button with a white glyph that collapses its panel, flush with the
 * panel's top-left corner. When the panel has a quick key and this is a keyboard
 * screen, it grows into a rectangle and prints that key's letter under the icon,
 * so the shortcut is discoverable; a touch screen shows only the icon.
 */
function buildPanelIcon(
  host: RoutePanelHost,
  x: number,
  y: number,
  textureKey: string,
  key: KeybindAction | null,
): {
  icon: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.BitmapText | null;
  w: number;
  h: number;
} {
  const scene = host.scene;
  const showKey = key !== null && !prefersTouchControls();
  const h = HUD_ICON + (showKey ? HUD_KEY_H : 0);
  const bg = scene.add.rectangle(x, y, HUD_ICON, h, FRLG_TRACK.colour, FRLG_TRACK.alpha).setOrigin(0, 0);
  const image = scene.add.image(x + HUD_ICON / 2, y + HUD_ICON / 2, textureKey);
  const children: Phaser.GameObjects.GameObject[] = [bg, image];
  let label: Phaser.GameObjects.BitmapText | null = null;
  if (showKey && key !== null) {
    label = addFrlgText(
      scene,
      x + HUD_ICON / 2,
      y + HUD_ICON + (HUD_KEY_H - HUD_KEY_TEXT) / 2,
      keyLabel(host.settings().keybinds[key]),
      { size: HUD_KEY_TEXT, tint: FRLG_INK, origin: [0.5, 0] },
    );
    children.push(label);
  }
  return { icon: scene.add.container(0, 0, children), label, w: HUD_ICON, h };
}

/**
 * Clears the overlay registry for a fresh HUD build. The scene calls it **before**
 * it registers its own drag ghost and before the build walk, so the list is empty
 * for a new scene and every later `registerHudOverlay` survives the walk.
 */
export function resetHudOverlays(): void {
  overlays = [];
}

/**
 * Records an object that must ride above every panel (the drag ghosts, the bag's
 * description card). `rank` is its fixed stacking slot, so the build order of the
 * folder can never reorder them. Registering never adds to the root itself: the
 * build walk's tail (`finishHud`) does, once every panel exists.
 */
export function registerHudOverlay(object: Phaser.GameObjects.GameObject, rank: number): void {
  overlays.push({ rank, object });
}

/**
 * The build walk's tail: adds the registered overlays to the HUD root in their
 * ranked order and applies the stored panel layout, exactly as the old `buildHud`
 * did once every panel existed.
 */
export function finishHud(host: RoutePanelHost): void {
  const root = host.hudRoot();
  for (const { object } of [...overlays].sort((a, b) => a.rank - b.rank)) root.add(object);
  applyStoredHudLayout(host);
}

/** The canvas strip's own display objects, so the flag contract has one counter. */
let hudDrawnObjects = 0;
/** The mounted strip: its view, its disposer, the host and the scene it follows. */
let stripSignal: Signal<StripView> | null = null;
let stripDispose: (() => void) | null = null;
let stripHost: RoutePanelHost | null = null;
let stripScene: Phaser.Scene | null = null;
/**
 * True while the route is paused under another screen. `#hud` is a DOM layer
 * **above** the canvas, so a paused route's chips would float over the battle
 * covering it; the mount stays and the view simply goes closed.
 */
let routePaused = false;

/** The route strip's own display objects in Phaser: 0 under `?hud=dom`. */
export function hudDrawnObjectCount(): number {
  return DOM_HUD ? 0 : hudDrawnObjects;
}

/** The canvas builder reports what it added; 0 under the flag. */
export function noteHudDrawnObjects(count: number): void {
  hudDrawnObjects = DOM_HUD ? 0 : Math.max(0, count);
}

/**
 * The docked panel records as the strip reads them: each panel's `x`/`y` plus the
 * drag offset it carries, and whether it is collapsed to a chip.
 */
function panelsAsSlots(host: RoutePanelHost): readonly StripSlot[] {
  return host.panels().map((panel) => ({
    id: panel.id,
    x: panel.x + panel.dx,
    y: panel.y + panel.dy,
    collapsed: !panel.expanded,
  }));
}

/**
 * The strip as data, recomputed on every `refresh`: a collapse, a drag, the stored
 * layout and a resize all reach the chips without a hook of their own.
 */
function stripViewOf(host: RoutePanelHost): StripView {
  return stripView(
    { open: !routePaused, slots: panelsAsSlots(host), keybinds: host.settings().keybinds },
    { width: host.scene.scale.width, height: host.scene.scale.height },
  );
}

/** Repaints the mounted strip from the live host, or nothing before the first mount. */
function repaintStrip(): void {
  if (stripSignal === null || stripHost === null) return;
  stripSignal.value = stripViewOf(stripHost);
}

/** A battle or the Settings screen covers the route: the chips go with the paused HUD. */
function pauseStrip(): void {
  routePaused = true;
  repaintStrip();
}

/** The route is the screen on top again: the chips return as they were left. */
function resumeStrip(): void {
  routePaused = false;
  repaintStrip();
}

/**
 * A chip press is its panel's quick key and nothing else: the same
 * `toggleHudPanel` an `M` / `O` / `P` / `I` press runs. A press while paused never
 * reaches a panel behind the screen that covers the route.
 */
function handleStripCommand(host: RoutePanelHost, command: HudCommand): void {
  if (routePaused || command.type !== 'panel') return;
  toggleHudPanel(host, command.panel);
}

function disposeStrip(): void {
  if (stripScene !== null) {
    stripScene.events.off(SCENE_PAUSE, pauseStrip);
    stripScene.events.off(SCENE_RESUME, resumeStrip);
    stripScene = null;
  }
  routePaused = false;
  stripHost = null;
  if (stripDispose !== null) {
    stripDispose();
    stripDispose = null;
  }
  stripSignal = null;
}

/**
 * Mounts the chips into the `#hud` layer. The strip builds at order 30, after the
 * header and the party and before the bag and the box, so it paints whatever docks
 * exist and the first `refreshHud()` of the build walk completes the rail. A
 * missing layer mounts nothing.
 */
function mountStrip(host: RoutePanelHost): void {
  disposeStrip();
  const scene = host.scene;
  routePaused = scene.sys.isPaused();
  const view = signal(stripViewOf(host));
  stripSignal = view;
  stripHost = host;
  const layer = typeof document === 'undefined' ? null : document.getElementById('hud');
  if (layer !== null) {
    stripDispose = mountHudStrip(layer, view, (command) => handleStripCommand(host, command));
  }
  scene.events.on(SCENE_PAUSE, pauseStrip);
  scene.events.on(SCENE_RESUME, resumeStrip);
  stripScene = scene;
}

function buildPartyHeader(host: RoutePanelHost): void {
  const { partyW, xpBarW } = host.hud();
  const x = hudColumnLeft(host);
  const partyY = HUD_TOP;
  const partyLeft = x + HUD_PAD_X;
  const partyRight = x + partyW - HUD_PAD_X;
  // The Pokevial bar, centred under the level/XP line: a single meter that
  // grows and changes shade as it fills (one fill step per charge), with its
  // name written inside. Clicking a charged bar rests the whole party and box.
  const vialX = x + (partyW - HUD_VIAL_W) / 2;
  const vialY = partyY + HUD_VIAL_Y;
  const vialBg = host.scene.add
    .rectangle(vialX, vialY, HUD_VIAL_W, HUD_VIAL_H, FRLG_TRACK.colour, FRLG_TRACK.alpha)
    .setOrigin(0, 0);
  hudVialFill = host.scene.add
    .rectangle(vialX, vialY, 0, HUD_VIAL_H, HUD_VIAL_FILL_COLORS[0])
    .setOrigin(0, 0);
  hudVialLabel = addFrlgText(host.scene, vialX + HUD_VIAL_W / 2, vialY + 3, t('hud.vial'), {
    size: 16,
    tint: FRLG_INK,
    origin: [0.5, 0],
  });
  // The squad's shared level and XP bar: every member levels together off this
  // one bar (`docs/battle-spec.md` §7).
  const xpBarY = partyY + HUD_XP_BAR_Y;
  const xpBarX = partyLeft + HUD_XP_BAR_INSET;
  hudLevelText = addFrlgText(host.scene, xpBarX, partyY + HUD_PAD_TOP, '', {
    size: 16,
    tint: FRLG_INK,
  });
  const xpBg = host.scene.add
    .rectangle(xpBarX, xpBarY, xpBarW, HUD_XP_BAR_H, FRLG_TRACK.colour, FRLG_TRACK.alpha)
    .setOrigin(0, 0);
  hudXpFill = host.scene.add.rectangle(xpBarX, xpBarY, 0, HUD_XP_BAR_H, 0x60a5fa).setOrigin(0, 0);
  hudXpText = addFrlgText(host.scene, partyRight - HUD_XP_BAR_INSET, partyY + HUD_PAD_TOP, '', {
    size: 16,
    tint: FRLG_MUTED,
    origin: [1, 0],
  });
  // The header belongs to the party window's body (`build` runs after it), so it
  // rides the panel; it is inserted right under the window, above the rows.
  const party = panelById(host, 'party');
  if (!party) return;
  [vialBg, hudVialFill, hudVialLabel, hudLevelText, xpBg, hudXpFill, hudXpText].forEach((object, i) => {
    party.body.addAt(object, 1 + i);
  });
}

function refreshHudPanel(host: RoutePanelHost): void {
  if (!hudLevelText) return;
  const run = host.run();
  // The shared bar: the level everyone sits at and the progress to the next.
  const level = squadLevel(run);
  setHudLevel(level);
  hudXpFill.setSize(host.hud().xpBarW * experienceFraction(run.xp, level), HUD_XP_BAR_H);
  hudXpText.setText(t('hud.xp', { xp: run.xp }));
  // The Pokevial bar: its fill grows with the charges and takes the shade of
  // the charge it is at, so the meter reads as filling up.
  const charges = run.pokevialCharges;
  hudVialFill
    .setSize((HUD_VIAL_W * charges) / POKEVIAL_MAX_CHARGES, HUD_VIAL_H)
    .setFillStyle(HUD_VIAL_FILL_COLORS[charges - 1] ?? HUD_VIAL_FILL_COLORS[0]);
}

function pointerAt(host: RoutePanelHost, pointer: Phaser.Input.Pointer): boolean {
  if (pointerPhase() === 'down') {
    // The collapse icon sits in the frame band, so it is tested before the drag.
    const icon = hudPanelIconAt(host, pointer);
    if (icon) {
      hudIconPress = { id: icon.id, originX: pointer.x, originY: pointer.y };
      host.scene.input.setDefaultCursor('pointer');
      return true;
    }
    // The Pokevial only drinks with a full meter: it rests the party and the box
    // (and clears status), then empties.
    if (host.run().pokevialCharges >= POKEVIAL_MAX_CHARGES && vialButtonAt(host, pointer)) {
      drinkPokevial(host);
      return true;
    }
    // Grabbing a panel's frame moves it (raising it over the rest); its inner
    // area stays live for rows, tabs and cells.
    const panel = hudPanelAt(host, pointer);
    if (panel) {
      startPanelDrag(host, panel, pointer);
      return true;
    }
    return false;
  }
  if (pointerPhase() === 'move') {
    // A press on a collapse icon becomes a panel drag once it passes the slop.
    if (hudIconPress && !hudPanelDrag) {
      const press = hudIconPress;
      if (Math.hypot(pointer.x - press.originX, pointer.y - press.originY) > HUD_DRAG_SLOP) {
        const panel = panelById(host, press.id);
        hudIconPress = null;
        if (panel) startPanelDrag(host, panel, pointer);
      }
    }
    // A panel drag follows the pointer and overlaps the others freely.
    if (hudPanelDrag) {
      updatePanelDrag(host, pointer);
      return true;
    }
    return false;
  }
  // A press on an icon released without moving is the collapse/expand click.
  if (hudIconPress) {
    const press = hudIconPress;
    hudIconPress = null;
    const panel = panelById(host, press.id);
    if (panel) togglePanel(host, panel);
    return true;
  }
  if (hudPanelDrag) {
    endPanelDrag(host);
    return true;
  }
  return false;
}

export const descriptor: RoutePanelDescriptor = {
  id: 'hud',
  order: 30,
  build(host: RoutePanelHost): void {
    hudPanelDrag = null;
    hudIconPress = null;
    hudDetailPlaced = false;
    if (DOM_HUD) {
      mountStrip(host);
      noteHudDrawnObjects(0);
      return;
    }
    buildPartyHeader(host);
    noteHudDrawnObjects(HUD_HEADER_OBJECTS);
  },
  refresh(host: RoutePanelHost): void {
    if (DOM_HUD) {
      repaintStrip();
      return;
    }
    refreshHudPanel(host);
  },
  pointer(host: RoutePanelHost, pointer: Phaser.Input.Pointer): boolean {
    // The DOM owns every press under the flag: an invisible canvas spot must never
    // answer with the Pokevial or a panel drag.
    if (DOM_HUD) return false;
    return pointerAt(host, pointer);
  },
  close(): void {
    if (DOM_HUD) disposeStrip();
  },
};
