import { t } from '../../../../i18n';
import type { RegionNodeKind } from '../../../../engine/region/plan';
import type { RegionMapEdge, RegionMapView } from '../../../regionMap';

/**
 * The region header card's layout model (`docs/region-spec.md` §5, `D64`): the plan's
 * node graph as data, read from the pure `regionMapView`. The card is a straight-line
 * graph in the shipped 216 × 250 rect, so this module only scales the plan's cells and
 * centres them in the band; every position, tone and state it emits is decided here and
 * pinned by `view.test.ts`, never by the card or its CSS.
 *
 * Every constant below is named after the Phaser constant it mirrors, so a drift
 * between the canvas and the DOM is a failing test rather than a diff nobody reads.
 */

export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;

/** A node's dot: panel-relative centre, radius and state. */
export type RegionMarkerView = Readonly<{
  key: string;
  kind: RegionNodeKind;
  name: string;
  cx: number;
  cy: number;
  r: number;
  visited: boolean;
  current: boolean;
}>;

export type RegionEdgeView = RegionMapEdge &
  Readonly<{ x1: number; y1: number; x2: number; y2: number }>;

export type MapPanelView = Readonly<{
  open: boolean;
  /** Viewport coordinates; every rect below is panel-relative (measured from `box.x`/`box.y`). */
  box: Rect;
  highlight: Rect;
  title: Readonly<{ text: string; box: Rect }>;
  /** The badge line, its text `${badges}/${badgeTotal}`, or null with no region. */
  badges: Readonly<{ text: string; box: Rect }> | null;
  /** `hud.noMap` in its own box while there is no region; null otherwise. */
  empty: Readonly<{ label: string; box: Rect }> | null;
  grid: Readonly<{
    box: Rect;
    width: number;
    height: number;
    scale: number;
    dx: number;
    dy: number;
  }>;
  edges: readonly RegionEdgeView[];
  /** One per marker, in `RegionMapView.markers` order. */
  nodes: readonly RegionMarkerView[];
}>;

/** The Phaser constants this panel mirrors, declared here so a test can pin them. */
export const MAP_PANEL_W = 216; // HUD_MAP_W / hudMetrics().mapW
export const MAP_PANEL_H = 250; // HUD_MAP_H
export const MAP_TITLE_H = 50; // HUD_MAP_TITLE_H = HUD_PAD_TOP 16 + 34
export const MAP_PAD_X = 20; // HUD_PAD_X
export const MAP_PAD_BOTTOM = 12; // HUD_PAD_BOTTOM
export const MAP_CONTENT_LEFT = 30; // HUD_CONTENT_LEFT
/** The card's own margins: `HUD_PANEL_MARGIN` 8, `HUD_TOP` 8, `hudMetrics().mapW`. */
export const MAP_MARGIN = 8;
export const MAP_MIN_W = 160;
/** The title line's height and the 1 px highlight 12 px inside the top edge. */
export const MAP_TITLE_LINE = 20;
export const MAP_HIGHLIGHT_INSET = 12;
/** The "no map" label sits this far under the title band (`HUD_MAP_TITLE_H + 56`). */
export const MAP_EMPTY_OFFSET_Y = 56;
/** The badge line's own 32 px column at the title band's right end. */
export const MAP_BADGE_W = 32;
/** The edge stroke's width, and a node dot's radius floor and ceiling. */
export const MAP_LINK_STROKE = 3;
export const MAP_NODE_MIN_R = 3;
export const MAP_NODE_MAX_R = 8;
/** The three dot tones: the node the run stands on, one it has entered, one it has not. */
export const MAP_CURRENT_FILL = '#f6d98a'; // HUD_MAP_CURRENT_FILL 0xf6d98a
export const MAP_CURRENT_STROKE = '#9a7a1f'; // HUD_MAP_CURRENT_STROKE 0x9a7a1f
export const MAP_VISITED_FILL = '#7dd3fc';
export const MAP_UNVISITED_FILL = '#94a3b8';

type Layout = Readonly<{ scale: number; dx: number; dy: number; width: number; height: number }>;

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/** The shipped rect: `x = 8`, `y = HUD_TOP 8`, `w = min(216, max(160, width − 16))`, `h = 250`. */
export function mapPanelBox(viewport: Viewport): Rect {
  const width = Math.max(0, finite(viewport.width, MAP_PANEL_W + MAP_MARGIN * 2));
  const mapW = Math.min(MAP_PANEL_W, Math.max(MAP_MIN_W, width - MAP_MARGIN * 2));
  return { x: MAP_MARGIN, y: MAP_MARGIN, w: mapW, h: MAP_PANEL_H };
}

/** The band's scale and centring: `min(band / extent)` per axis, then centred on both. */
function gridLayout(region: RegionMapView | null, area: Rect): Layout {
  if (region === null || !(region.width > 0) || !(region.height > 0)) {
    return { scale: 0, dx: area.x, dy: area.y, width: 0, height: 0 };
  }
  const scale = Math.min(area.w / region.width, area.h / region.height);
  return {
    scale,
    dx: area.x + (area.w - region.width * scale) / 2,
    dy: area.y + (area.h - region.height * scale) / 2,
    width: region.width * scale,
    height: region.height * scale,
  };
}

/**
 * The panel as data. Pure and total: `null` leaves the graph empty and prints
 * `hud.noMap`, and a viewport narrower than 160 px clamps the card instead of
 * overflowing it. `open` is the one field this pure function cannot know: the scene
 * stamps the panel record's collapse and the route's pause over it.
 */
export function mapPanelView(region: RegionMapView | null, viewport: Viewport): MapPanelView {
  const box = mapPanelBox(viewport);
  const area: Rect = {
    x: MAP_PAD_X,
    y: MAP_TITLE_H,
    w: box.w - MAP_PAD_X * 2,
    h: MAP_PANEL_H - MAP_TITLE_H - MAP_PAD_BOTTOM,
  };
  const layout = gridLayout(region, area);
  const contentW = box.w - MAP_CONTENT_LEFT - MAP_PAD_X;

  const nodes: RegionMarkerView[] =
    region === null
      ? []
      : region.markers.map((marker) => ({
          key: marker.key,
          kind: marker.kind,
          name: marker.name,
          cx: layout.dx + marker.x * layout.scale,
          cy: layout.dy + marker.y * layout.scale,
          r: Math.max(MAP_NODE_MIN_R, Math.min(layout.scale, MAP_NODE_MAX_R)),
          visited: marker.visited,
          current: marker.current,
        }));

  const centres = new Map<string, RegionMarkerView>();
  for (const node of nodes) centres.set(node.key, node);
  const edges: RegionEdgeView[] = [];
  for (const edge of region?.edges ?? []) {
    const from = centres.get(edge.from);
    const to = centres.get(edge.to);
    if (from === undefined || to === undefined) continue;
    edges.push({ from: edge.from, to: edge.to, x1: from.cx, y1: from.cy, x2: to.cx, y2: to.cy });
  }

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
      text: region === null ? '' : region.title,
      box: { x: MAP_CONTENT_LEFT, y: 16, w: contentW, h: MAP_TITLE_LINE },
    },
    badges:
      region === null
        ? null
        : {
            text: `${region.badges}/${region.badgeTotal}`,
            box: { x: box.w - MAP_PAD_X - MAP_BADGE_W, y: 16, w: MAP_BADGE_W, h: MAP_TITLE_LINE },
          },
    empty:
      region === null
        ? {
            label: t('hud.noMap'),
            box: {
              x: box.w / 2,
              y: MAP_TITLE_H + MAP_EMPTY_OFFSET_Y,
              w: box.w - 50,
              h: MAP_TITLE_LINE,
            },
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
    edges,
    nodes,
  };
}
