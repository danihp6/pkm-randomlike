import type { MapRoomSpecial } from '../../../../engine/maps';
import { t } from '../../../../i18n';
import type { MapView, MapViewRoom } from '../../../mapView';

/**
 * The route header's layout model (`D49`, `docs/maps-spec.md` §8, `D32`): the floor
 * minimap as data, mirroring the shipped geometry of `src/scenes/panels/map.ts`.
 * `buildMapView` stays the only owner of the reveal rules and of every position it
 * emits; this module only scales what it returns and places the room markers.
 *
 * Every constant below is named after the Phaser constant it mirrors, so a drift
 * between the canvas and the DOM is a failing test rather than a diff nobody reads.
 */

export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;

/** The card's paint tokens, as CSS-ready strings: no colour is retyped in CSS. */
export type MapTone = Readonly<{ fill: string; stroke: string }>;

export type MapRoomView = Readonly<{
  id: number;
  /** Panel-relative, already scaled and centred inside the grid band. */
  box: Rect;
  current: boolean;
  /** The markers this room carries, in draw order. */
  markers: readonly MapMarkerView[];
  /** One segment per opening; `edge` follows the plan's cardinal order. */
  openings: readonly Readonly<{
    edge: 'N' | 'E' | 'S' | 'W';
    kind: 'entry' | 'link' | 'portal';
    d: string;
  }>[];
}>;

export type MapMarkerView =
  | Readonly<{ kind: 'boss'; cx: number; cy: number; r: number }>
  | Readonly<{ kind: 'capture'; cx: number; cy: number; r: number }>
  | Readonly<{ kind: 'portal'; cx: number; cy: number; r: number }>
  | Readonly<{
      kind: 'special';
      special: MapRoomSpecial;
      cx: number;
      cy: number;
      r: number;
      fill: string;
    }>;

export type MapPanelView = Readonly<{
  /** False while the header panel is collapsed or the route is paused. */
  open: boolean;
  /** Viewport coordinates. */
  box: Rect;
  /** Every rect below is panel-relative, i.e. measured from `box.x`/`box.y`. */
  highlight: Rect;
  title: Readonly<{ text: string; box: Rect }>;
  /** `hud.noMap` in its own box, or null while a floor is on screen. */
  empty: Readonly<{ label: string; box: Rect }> | null;
  grid: Readonly<{
    box: Rect;
    width: number;
    height: number;
    scale: number;
    dx: number;
    dy: number;
  }>;
  links: readonly Readonly<{
    from: number;
    to: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }>[];
  rooms: readonly MapRoomView[];
}>;

/** The Phaser constants this panel mirrors, declared here so a test can pin them. */
export const MAP_PANEL_W = 216; // HUD_MAP_W / hudMetrics().mapW
export const MAP_PANEL_H = 250; // HUD_MAP_H
export const MAP_TITLE_H = 50; // HUD_MAP_TITLE_H = HUD_PAD_TOP 16 + 34
export const MAP_PAD_X = 20; // HUD_PAD_X
export const MAP_PAD_BOTTOM = 12; // HUD_PAD_BOTTOM
export const MAP_CONTENT_LEFT = 30; // HUD_CONTENT_LEFT
export const MAP_LINK_STROKE = 3; // the shipped link line width
export const MAP_ROOM_STROKE = 2; // the shipped room outline width
export const MAP_OPENING_STROKE = 4; // the shipped opening tick width
/** The minimap's current-room gold: a content marker, not a chrome tone. */
export const MAP_CURRENT_FILL = '#f6d98a'; // HUD_MAP_CURRENT_FILL 0xf6d98a
export const MAP_CURRENT_STROKE = '#9a7a1f'; // HUD_MAP_CURRENT_STROKE 0x9a7a1f
export const MAP_PORTAL_STROKE = '#3fa9f5'; // the shipped portal tick and ring
export const MAP_ENTRY_STROKE = '#4ad15c'; // the shipped entry tick
export const MAP_BOSS_FILL = '#b0304a'; // the shipped boss dot
export const MAP_CAPTURE_FILL = '#e2554e'; // the shipped spent-capture ball

/** The one colour a special room's dot takes; the kind's identity is its letter. */
export const MAP_SPECIAL_TONES: Readonly<Record<MapRoomSpecial, string>> = {
  'mini-boss': '#7dd3fc',
  'mega-stone': '#c084fc',
  gated: '#fbbf24',
  trade: '#4ad15c',
  'no-heal': '#e2554e',
  static: '#f8fafc',
  'secret-shop': '#22d3ee',
  banned: '#94a3b8',
  puzzle: '#a3e635',
};

/** The card's own margins: `HUD_PANEL_MARGIN` 8, `HUD_TOP` 8, `hudMetrics().mapW`. */
const MAP_MARGIN = 8;
const MAP_MIN_W = 160;
/** The title line's height and the 1 px highlight 12 px inside the top edge. */
const MAP_TITLE_LINE = 20;
const MAP_HIGHLIGHT_INSET = 12;
/** The "no map" label sits this far under the title band (`HUD_MAP_TITLE_H + 56`). */
const MAP_EMPTY_OFFSET_Y = 56;
/** An opening tick's half-length: `max(2.5, min(w, h) × 0.18)`. */
const MAP_OPENING_MIN_GAP = 2.5;
const MAP_OPENING_GAP_RATIO = 0.18;
/** A marker's radius floor and its share of the room's shorter side. */
const MAP_MARKER_MIN_R = 3;
const MAP_MARKER_RATIO = 0.18;
/** The open portal's ring, drawn 1.4 × the boss/capture dot's radius. */
const MAP_PORTAL_RATIO = 1.4;

type Layout = Readonly<{ scale: number; dx: number; dy: number; width: number; height: number }>;

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/** A coordinate in the grid band, rounded so a `d`/`x` attribute stays readable. */
function n(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

/** The scaled midpoint of an opening, as the one segment the DOM paints there. */
function openingPath(edge: 'N' | 'E' | 'S' | 'W', x: number, y: number, gap: number): string {
  if (edge === 'N' || edge === 'S') return `M ${n(x - gap)} ${n(y)} H ${n(x + gap)}`;
  return `M ${n(x)} ${n(y - gap)} V ${n(y + gap)}`;
}

function markerRadius(w: number, h: number): number {
  return Math.max(MAP_MARKER_MIN_R, Math.min(w, h) * MAP_MARKER_RATIO);
}

/** The shipped rect: `x = 8`, `y = HUD_TOP 8`, `w = min(216, max(160, width − 16))`, `h = 250`. */
export function mapPanelBox(viewport: Viewport): Rect {
  const width = Math.max(0, finite(viewport.width, MAP_PANEL_W + MAP_MARGIN * 2));
  const mapW = Math.min(MAP_PANEL_W, Math.max(MAP_MIN_W, width - MAP_MARGIN * 2));
  return { x: MAP_MARGIN, y: MAP_MARGIN, w: mapW, h: MAP_PANEL_H };
}

/** The grid band's scale and centring, exactly the arithmetic `refreshMapView` does. */
function gridLayout(view: MapView | null, area: Rect): Layout {
  if (view === null || !view.visible || !(view.width > 0) || !(view.height > 0)) {
    return { scale: 0, dx: area.x, dy: area.y, width: 0, height: 0 };
  }
  const scale = Math.min(area.w / view.width, area.h / view.height);
  return {
    scale,
    dx: area.x + (area.w - view.width * scale) / 2,
    dy: area.y + (area.h - view.height * scale) / 2,
    width: view.width * scale,
    height: view.height * scale,
  };
}

/**
 * One room's icons, in draw order. The boss and a spent capture are mutually
 * exclusive (the boss room wins), a special room's dot rides with either of them,
 * and the open portal is the ring over the dot, as the canvas paints it.
 */
function markerViews(room: MapViewRoom, box: Rect): MapMarkerView[] {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const r = markerRadius(box.w, box.h);
  const markers: MapMarkerView[] = [];
  if (room.boss) markers.push({ kind: 'boss', cx, cy, r });
  else if (room.captureSpent) markers.push({ kind: 'capture', cx, cy, r });
  if (room.marker !== null) {
    markers.push({
      kind: 'special',
      special: room.marker,
      cx,
      cy,
      r,
      fill: MAP_SPECIAL_TONES[room.marker],
    });
  }
  if (room.portal) markers.push({ kind: 'portal', cx, cy, r: r * MAP_PORTAL_RATIO });
  return markers;
}

function roomView(room: MapViewRoom, layout: Layout): MapRoomView {
  const box: Rect = {
    x: layout.dx + room.x * layout.scale,
    y: layout.dy + room.y * layout.scale,
    w: room.w * layout.scale,
    h: room.h * layout.scale,
  };
  const gap = Math.max(MAP_OPENING_MIN_GAP, Math.min(box.w, box.h) * MAP_OPENING_GAP_RATIO);
  return {
    id: room.id,
    box,
    current: room.current,
    markers: markerViews(room, box),
    openings: room.openings.map((opening) => ({
      edge: opening.edge,
      kind: opening.kind,
      d: openingPath(
        opening.edge,
        layout.dx + opening.x * layout.scale,
        layout.dy + opening.y * layout.scale,
        gap,
      ),
    })),
  };
}

/**
 * The panel as data. Pure and total: `null` and an undiscovered floor both leave
 * the grid empty and print `hud.noMap`, and a viewport narrower than 160 px clamps
 * the card instead of overflowing it. `open` is the one field this pure function
 * cannot know: the scene stamps the panel record's collapse and the route's pause
 * over it.
 */
export function mapPanelView(view: MapView | null, title: string, viewport: Viewport): MapPanelView {
  const box = mapPanelBox(viewport);
  const area: Rect = {
    x: MAP_PAD_X,
    y: MAP_TITLE_H,
    w: box.w - MAP_PAD_X * 2,
    h: MAP_PANEL_H - MAP_TITLE_H - MAP_PAD_BOTTOM,
  };
  const layout = gridLayout(view, area);
  const floor = view !== null && view.visible ? view : null;
  const contentW = box.w - MAP_CONTENT_LEFT - MAP_PAD_X;
  return {
    open: true,
    box,
    highlight: {
      x: MAP_HIGHLIGHT_INSET,
      y: MAP_HIGHLIGHT_INSET,
      w: box.w - MAP_HIGHLIGHT_INSET * 2,
      h: 1,
    },
    title: {
      text: title,
      box: { x: MAP_CONTENT_LEFT, y: 16, w: contentW, h: MAP_TITLE_LINE },
    },
    empty:
      floor === null
        ? {
            label: t('hud.noMap'),
            box: { x: box.w / 2, y: MAP_TITLE_H + MAP_EMPTY_OFFSET_Y, w: contentW, h: MAP_TITLE_LINE },
          }
        : null,
    grid: {
      box: area,
      width: layout.width,
      height: layout.height,
      scale: layout.scale,
      dx: layout.dx,
      dy: layout.dy,
    },
    links:
      floor === null
        ? []
        : floor.links.map((link) => ({
            from: link.from,
            to: link.to,
            x1: layout.dx + link.x1 * layout.scale,
            y1: layout.dy + link.y1 * layout.scale,
            x2: layout.dx + link.x2 * layout.scale,
            y2: layout.dy + link.y2 * layout.scale,
          })),
    rooms: floor === null ? [] : floor.rooms.map((room) => roomView(room, layout)),
  };
}
