import { signal, type Signal } from '@preact/signals';
import type Phaser from 'phaser';
import type { HudPanelId, HudPanelLayout } from '../../data/hudLayout';
import { FRLG_HPBAR, FRLG_WINDOW_PADDING } from '../../ui/frlg';
import type { HudCommand } from '../../ui/hud/commands';
import {
  frameLabel,
  mountHudStrip,
  stripView,
  type PanelFrameMount,
  type StripSlot,
  type StripView,
} from '../../ui/hud/panels/hud';
import type { HudMetrics, RoutePanelDescriptor, RoutePanelHost } from './types';

/**
 * The HUD's frame: the panel widths every card lays itself out from and the edge
 * strip a collapsed card leaves behind. The cards are the Preact panels in
 * `src/ui/hud/panels/`, so this module owns no drawing at all: it holds the metrics,
 * the strip's mount and the one predicate every card asks about its own open state.
 *
 * The drag, its clamp and the saved placement are the cards' own frame
 * (`panels/hud/panelFrame`): this module only hands a card its record and receives
 * the offset the frame clamped, which is persisted by the scene's settings. A
 * collapsed badge drags through the same frame host, so the strip is a second
 * gesture over one writer, never a second writer of the layout.
 */

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
export const HUD_XP_BAR_INSET = 12;
export const HUD_XP_BAR_H = 8;
export const HUD_XP_BAR_Y = HUD_PAD_TOP + 16 + 6;
export const HUD_VIAL_Y = HUD_XP_BAR_Y + HUD_XP_BAR_H + 8;

/** Gap (px) a card keeps from the screen edge. */
export const HUD_PANEL_MARGIN = 8;

/**
 * The rail pitch of a collapsed chip: the board's 26 px badge plus the HUD gap. The
 * cards no longer carry a dock of their own, so the right column stacks them.
 */
const HUD_CHIP_PITCH = 34;

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

/** Whether a card is open (expanded) rather than collapsed to its edge chip. */
export function panelExpanded(host: RoutePanelHost, id: HudPanelId): boolean {
  return host.hudCardOpen(id);
}

/**
 * Opens or collapses the card a quick key points at. A quick key is a plain toggle
 * (D45): it never takes the keyboard, so the arrows keep walking the route.
 */
export function toggleHudPanel(host: RoutePanelHost, id: HudPanelId): void {
  host.setHudCardOpen(id, !host.hudCardOpen(id));
}

/**
 * A card's dock on a wide window, which is where its collapsed chip rides. The
 * header keeps the free top-left corner and the party/bag/box rail stacks down the
 * right column; a phone ignores these and takes the board's own slots.
 */
export function defaultHudDock(host: RoutePanelHost, id: HudPanelId): { x: number; y: number } {
  if (id === 'header') return { x: HUD_PANEL_MARGIN, y: HUD_TOP };
  const column = hudColumnLeft(host);
  const row = id === 'party' ? 0 : id === 'bag' ? 1 : id === 'box' ? 2 : 3;
  return { x: column, y: HUD_TOP + row * HUD_CHIP_PITCH };
}

/**
 * A card's frame as the DOM sees it: the live record of its id, the panel's quick key
 * and the two callbacks. `open` and `layout` are getters on purpose — a paint and a
 * drag commit read the record the scene holds *now*, never a snapshot taken at build,
 * so a collapse the route persisted is never overwritten by a stale `collapsed` flag.
 */
export type PanelFrameHost = Readonly<{
  id: HudPanelId;
  open: boolean;
  layout: HudPanelLayout;
  /** The quick key's own toggle: `toggleHudPanel(host, id)`. */
  onToggle(): void;
  /** Clamped, persisted through the scene's settings, and the strip repaints. */
  onLayout(next: HudPanelLayout): void;
}>;

/** One card's frame: its live record plus the chip's accessible name. */
export function panelFrameHost(host: RoutePanelHost, id: HudPanelId): PanelFrameHost {
  return {
    id,
    get open() {
      return host.hudCardOpen(id);
    },
    get layout() {
      return host.hudLayout()[id];
    },
    onToggle() {
      toggleHudPanel(host, id);
    },
    onLayout(next) {
      host.setHudLayout({ ...host.hudLayout(), [id]: next });
    },
  };
}

/** What a mount hands the frame: the host above and the strip's own label for it. */
export function panelFrameMount(host: RoutePanelHost, id: HudPanelId): PanelFrameMount {
  return {
    host: panelFrameHost(host, id),
    get label() {
      return frameLabel(id, host.settings().keybinds);
    },
  };
}

/** The card's dock plus its saved drag offset: the strip's chip rides on it. */
export function draggedDock(host: RoutePanelHost, id: HudPanelId): Readonly<{ x: number; y: number }> {
  const dock = defaultHudDock(host, id);
  const { dx, dy } = host.hudLayout()[id];
  return { x: dock.x + dx, y: dock.y + dy };
}

/** The canvas strip's own display objects: none, the chips are the DOM panel's. */
export function hudDrawnObjectCount(): number {
  return 0;
}

/** The retired canvas strip's reporter, kept so the count contract's call sites compile. */
export function noteHudDrawnObjects(_count: number): void {}

/**
 * `Phaser.Scenes.Events.PAUSE` / `RESUME`, spelled out because this folder imports
 * Phaser type-only: the route stops under a battle or the Settings screen and comes
 * back from it on these two.
 */
const SCENE_PAUSE = 'pause';
const SCENE_RESUME = 'resume';

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

/** The chip slots: every HUD card at its dragged dock, with the offset the badge drag commits. */
function panelsAsSlots(host: RoutePanelHost): readonly StripSlot[] {
  return (['header', 'party', 'bag', 'box', 'detail'] as const).map((id) => {
    const dock = draggedDock(host, id);
    const { dx, dy } = host.hudLayout()[id];
    return { id, x: dock.x, y: dock.y, dx, dy, collapsed: !host.hudCardOpen(id) };
  });
}

/**
 * The strip as data, recomputed on every `refresh`: a collapse, a new open state and
 * a resize all reach the chips without a hook of their own.
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
 * A chip press is its panel's quick key and nothing else: the same `toggleHudPanel`
 * an `M` / `O` / `P` / `I` press runs. A chip **drag** never arrives here — it goes
 * through the same frame host a card's chip writes, so the layout has one writer. A
 * press while paused never reaches a panel behind the screen that covers the route.
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
 * Mounts the chips into the `#hud` layer, after the cards have mounted so the first
 * paint already knows which of them are collapsed. A missing layer mounts nothing.
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
    stripDispose = mountHudStrip(layer, view, {
      onCommand: (command) => handleStripCommand(host, command),
      // One writer for the whole layout: a badge drag commits through the card's own
      // frame host, so the two gestures cannot drift apart.
      onLayout: (id, next) => panelFrameHost(host, id).onLayout(next),
    });
  }
  scene.events.on(SCENE_PAUSE, pauseStrip);
  scene.events.on(SCENE_RESUME, resumeStrip);
  stripScene = scene;
}

export const descriptor: RoutePanelDescriptor = {
  id: 'hud',
  order: 30,
  build(host: RoutePanelHost): void {
    mountStrip(host);
  },
  refresh(): void {
    repaintStrip();
  },
  close(): void {
    disposeStrip();
  },
};
