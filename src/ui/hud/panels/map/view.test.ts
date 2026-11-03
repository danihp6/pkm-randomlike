import { describe, expect, it } from 'vitest';
import { t } from '../../../../i18n';
import type { RegionMapView } from '../../../regionMap';
import {
  MAP_BADGE_W,
  MAP_CONTENT_LEFT,
  MAP_CURRENT_FILL,
  MAP_CURRENT_STROKE,
  MAP_EMPTY_OFFSET_Y,
  MAP_HIGHLIGHT_INSET,
  MAP_LINK_STROKE,
  MAP_MARGIN,
  MAP_MIN_W,
  MAP_NODE_MAX_R,
  MAP_NODE_MIN_R,
  MAP_PAD_BOTTOM,
  MAP_PAD_X,
  MAP_PANEL_H,
  MAP_PANEL_W,
  MAP_TITLE_H,
  MAP_TITLE_LINE,
  MAP_UNVISITED_FILL,
  MAP_VISITED_FILL,
  mapPanelBox,
  mapPanelView,
} from './view';

const DESKTOP = { width: 1280, height: 800 } as const;
const PHONE = { width: 390, height: 844 } as const;
/** The grid band at the shipped 216 px card. */
const AREA = { x: 20, y: 50, w: 176, h: 188 } as const;

/** The graph the card has to lay out: three nodes of a 6 × 3 plan, one edge. */
function region(overrides: Partial<RegionMapView> = {}): RegionMapView {
  return {
    width: 6,
    height: 3,
    title: 'Misty Peak',
    badges: 0,
    badgeTotal: 8,
    markers: [
      { key: 'town:1', kind: 'town', name: 'Misty Peak', x: 0, y: 0, visited: true, current: true },
      { key: 'route:1', kind: 'route', name: 'Route 1', x: 3, y: 2, visited: false, current: false },
      { key: 'city:1', kind: 'city', name: 'Frozen Vale', x: 5, y: 0, visited: false, current: false },
    ],
    edges: [
      { from: 'town:1', to: 'route:1' },
      { from: 'route:1', to: 'city:1' },
    ],
    ...overrides,
  };
}

const SCALE = Math.min(AREA.w / 6, AREA.h / 3);
const DX = AREA.x + (AREA.w - 6 * SCALE) / 2;
const DY = AREA.y + (AREA.h - 3 * SCALE) / 2;

describe('mapPanelBox', () => {
  it('is the shipped 216 × 250 card one margin in, at both sizes', () => {
    expect(mapPanelBox(DESKTOP)).toEqual({ x: 8, y: 8, w: 216, h: 250 });
    expect(mapPanelBox(PHONE)).toEqual({ x: 8, y: 8, w: 216, h: 250 });
  });

  it('clamps the card on a window narrower than the 216 px one', () => {
    expect(mapPanelBox({ width: 200, height: 800 }).w).toBe(184);
    expect(mapPanelBox({ width: 100, height: 800 }).w).toBe(160);
  });
});

describe('mapPanelView', () => {
  it('lays the title, the badge line and the grid band out on the shipped rect', () => {
    const view = mapPanelView(region(), DESKTOP);
    expect(view.open).toBe(true);
    expect(view.box).toEqual({ x: 8, y: 8, w: 216, h: 250 });
    expect(view.highlight).toEqual({ x: 12, y: 12, w: 192, h: 1 });
    expect(view.title.text).toBe('Misty Peak');
    expect(view.title.box).toEqual({ x: 30, y: 16, w: 166, h: 20 });
    expect(view.badges!.box).toEqual({ x: 164, y: 16, w: 32, h: 20 });
    expect(view.grid.box).toEqual({ x: 20, y: 50, w: 176, h: 188 });
    expect(view.empty).toBeNull();
  });

  it('scales the graph to min(band / extent) and centres it inside the band', () => {
    const view = mapPanelView(region(), DESKTOP);
    expect(view.grid.scale).toBeCloseTo(Math.min(176 / 6, 188 / 3), 12);
    expect(view.grid.width).toBeCloseTo(176, 10);
    expect(view.grid.height).toBeCloseTo(3 * SCALE, 10);
    expect(view.grid.dx).toBeCloseTo(20, 10);
    expect(view.grid.dy).toBeCloseTo(50 + (188 - 3 * SCALE) / 2, 10);
  });

  it('centres a graph the other axis bounds', () => {
    const tall = region({ width: 2, height: 20 });
    const view = mapPanelView(tall, DESKTOP);
    expect(view.grid.scale).toBeCloseTo(188 / 20, 12);
    expect(view.grid.width).toBeCloseTo(2 * (188 / 20), 10);
    expect(view.grid.dx).toBeCloseTo(20 + (176 - 2 * (188 / 20)) / 2, 10);
    expect(view.grid.dy).toBeCloseTo(50, 10);
  });

  it('draws one node per marker, in marker order and state', () => {
    const view = mapPanelView(region(), DESKTOP);
    expect(view.nodes).toHaveLength(3);
    expect(view.nodes.map((node) => node.key)).toEqual(['town:1', 'route:1', 'city:1']);
    expect(view.nodes.map((node) => node.kind)).toEqual(['town', 'route', 'city']);
    expect(view.nodes.map((node) => node.name)).toEqual(['Misty Peak', 'Route 1', 'Frozen Vale']);
    expect(view.nodes.map((node) => node.current)).toEqual([true, false, false]);
    expect(view.nodes.map((node) => node.visited)).toEqual([true, false, false]);
  });

  it('places a node at dx + x·scale, dy + y·scale, with a capped radius', () => {
    const view = mapPanelView(region(), DESKTOP);
    view.nodes.forEach((node, index) => {
      const marker = region().markers[index]!;
      expect(node.cx).toBeCloseTo(DX + marker.x * SCALE, 10);
      expect(node.cy).toBeCloseTo(DY + marker.y * SCALE, 10);
      expect(node.r).toBeCloseTo(Math.max(MAP_NODE_MIN_R, Math.min(SCALE, MAP_NODE_MAX_R)), 10);
    });
    const sparse = mapPanelView(region({ width: 120, height: 10 }), DESKTOP);
    expect(sparse.nodes[0]!.r).toBe(MAP_NODE_MIN_R);
    expect(view.nodes[0]!.r).toBe(MAP_NODE_MAX_R);
  });

  it('draws an edge between its two markers\u2019 centres', () => {
    const view = mapPanelView(region(), DESKTOP);
    expect(view.edges).toHaveLength(2);
    for (const edge of view.edges) {
      const from = view.nodes.find((node) => node.key === edge.from)!;
      const to = view.nodes.find((node) => node.key === edge.to)!;
      expect(edge.x1).toBeCloseTo(from.cx, 10);
      expect(edge.y1).toBeCloseTo(from.cy, 10);
      expect(edge.x2).toBeCloseTo(to.cx, 10);
      expect(edge.y2).toBeCloseTo(to.cy, 10);
    }
    expect(view.edges[0]).toMatchObject({ from: 'town:1', to: 'route:1' });
  });

  it('prints the badge line as a bare figure of the ladder width', () => {
    expect(mapPanelView(region(), DESKTOP).badges!.text).toBe('0/8');
    expect(mapPanelView(region({ badges: 3 }), DESKTOP).badges!.text).toBe('3/8');
    expect(mapPanelView(region({ badges: 8 }), DESKTOP).badges!.text).toBe('8/8');
  });

  it('prints hud.noMap, with no node and no edge, while there is no region', () => {
    const empty = mapPanelView(null, DESKTOP);
    expect(empty.nodes).toEqual([]);
    expect(empty.edges).toEqual([]);
    expect(empty.badges).toBeNull();
    expect(empty.title.text).toBe('');
    expect(empty.empty).not.toBeNull();
    expect(empty.empty!.label).toBe(t('hud.noMap'));
    expect(empty.empty!.box).toEqual({
      x: MAP_PANEL_W / 2,
      y: MAP_TITLE_H + MAP_EMPTY_OFFSET_Y,
      w: MAP_PANEL_W - 50,
      h: MAP_TITLE_LINE,
    });
    expect(empty.grid.scale).toBe(0);
    expect(empty.grid.width).toBe(0);
  });

  it('is pure: the same input deep-equals and nothing is mutated', () => {
    const input = region({ badges: 2 });
    const before = JSON.stringify(input);
    const first = mapPanelView(input, DESKTOP);
    const second = mapPanelView(input, DESKTOP);
    expect(second).toEqual(first);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe('the mirrored constants', () => {
  it('keep their shipped values', () => {
    expect(MAP_PANEL_W).toBe(216);
    expect(MAP_PANEL_H).toBe(250);
    expect(MAP_TITLE_H).toBe(50);
    expect(MAP_PAD_X).toBe(20);
    expect(MAP_PAD_BOTTOM).toBe(12);
    expect(MAP_CONTENT_LEFT).toBe(30);
    expect(MAP_MARGIN).toBe(8);
    expect(MAP_MIN_W).toBe(160);
    expect(MAP_TITLE_LINE).toBe(20);
    expect(MAP_HIGHLIGHT_INSET).toBe(12);
    expect(MAP_EMPTY_OFFSET_Y).toBe(56);
    expect(MAP_BADGE_W).toBe(32);
    expect(MAP_LINK_STROKE).toBe(3);
    expect(MAP_NODE_MIN_R).toBe(3);
    expect(MAP_NODE_MAX_R).toBe(8);
    expect(MAP_CURRENT_FILL).toBe('#f6d98a');
    expect(MAP_CURRENT_STROKE).toBe('#9a7a1f');
    expect(MAP_VISITED_FILL).toBe('#7dd3fc');
    expect(MAP_UNVISITED_FILL).toBe('#94a3b8');
  });

  it('derive the grid band from the card, and the card from the window', () => {
    expect(MAP_PAD_X * 2 + AREA.w).toBe(MAP_PANEL_W);
    expect(MAP_TITLE_H + AREA.h + MAP_PAD_BOTTOM).toBe(MAP_PANEL_H);
    expect(MAP_CONTENT_LEFT + 166 + MAP_PAD_X).toBe(MAP_PANEL_W);
    expect(mapPanelBox(DESKTOP).w).toBe(MAP_PANEL_W);
  });
});
