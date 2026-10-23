import { describe, expect, it } from 'vitest';
import type { MapRoomSpecial } from '../../../../engine/maps';
import { t } from '../../../../i18n';
import type { MapView, MapViewRoom } from '../../../mapView';
import {
  MAP_BOSS_FILL,
  MAP_CAPTURE_FILL,
  MAP_CONTENT_LEFT,
  MAP_CURRENT_FILL,
  MAP_CURRENT_STROKE,
  MAP_ENTRY_STROKE,
  MAP_LINK_STROKE,
  MAP_OPENING_STROKE,
  MAP_PAD_BOTTOM,
  MAP_PAD_X,
  MAP_PANEL_H,
  MAP_PANEL_W,
  MAP_PORTAL_STROKE,
  MAP_ROOM_STROKE,
  MAP_SPECIAL_TONES,
  MAP_TITLE_H,
  mapPanelBox,
  mapPanelView,
} from './view';

const DESKTOP = { width: 1280, height: 800 } as const;
const PHONE = { width: 390, height: 844 } as const;
/** The grid band at the shipped 216 px card, and the 15 × 11 floor's scale. */
const AREA = { x: 20, y: 50, w: 176, h: 188 } as const;
const SCALE = Math.min(AREA.w / 15, AREA.h / 11);
const DX = AREA.x + (AREA.w - 15 * SCALE) / 2;
const DY = AREA.y + (AREA.h - 11 * SCALE) / 2;

const SPECIALS: readonly MapRoomSpecial[] = [
  'mini-boss',
  'mega-stone',
  'gated',
  'trade',
  'no-heal',
  'static',
  'secret-shop',
  'banned',
  'puzzle',
];

function room(overrides: Partial<MapViewRoom> = {}): MapViewRoom {
  return {
    id: 0,
    col: 0,
    row: 0,
    shape: 'dead-end',
    x: 0,
    y: 0,
    w: 6,
    h: 6,
    current: false,
    boss: false,
    portal: false,
    marker: null,
    captureSpent: false,
    openings: [],
    ...overrides,
  };
}

function floor(rooms: readonly MapViewRoom[], links: MapView['links'] = []): MapView {
  return { width: 15, height: 11, rooms, links, visible: rooms.length > 0 };
}

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
  it('lays the title and the grid band out on the shipped rect', () => {
    const view = mapPanelView(floor([room({ current: true })]), 'Map 1 · Viridian Forest', DESKTOP);
    expect(view.open).toBe(true);
    expect(view.box).toEqual({ x: 8, y: 8, w: 216, h: 250 });
    expect(view.highlight).toEqual({ x: 12, y: 12, w: 192, h: 1 });
    expect(view.title.text).toBe('Map 1 · Viridian Forest');
    expect(view.title.box).toEqual({ x: 30, y: 16, w: 166, h: 20 });
    expect(view.grid.box).toEqual({ x: 20, y: 50, w: 176, h: 188 });
    expect(view.empty).toBeNull();
  });

  it('scales the floor to min(band / extent) and centres it inside the band', () => {
    const view = mapPanelView(floor([room({ current: true })]), '', DESKTOP);
    expect(view.grid.scale).toBeCloseTo(Math.min(176 / 15, 188 / 11), 12);
    expect(view.grid.width).toBeCloseTo(176, 10);
    expect(view.grid.height).toBeCloseTo((11 * 176) / 15, 10);
    expect(view.grid.dx).toBeCloseTo(20, 10);
    expect(view.grid.dy).toBeCloseTo(50 + (188 - (11 * 176) / 15) / 2, 10);
  });

  it('places a room at dx + x·scale, scaled by its own plan size', () => {
    const view = mapPanelView(floor([room({ id: 4, x: 2, y: 3, w: 6, h: 6 })]), '', DESKTOP);
    const [cell] = view.rooms;
    expect(cell!.id).toBe(4);
    expect(cell!.box.x).toBeCloseTo(DX + 2 * SCALE, 10);
    expect(cell!.box.y).toBeCloseTo(DY + 3 * SCALE, 10);
    expect(cell!.box.w).toBeCloseTo(6 * SCALE, 10);
    expect(cell!.box.h).toBeCloseTo(6 * SCALE, 10);
    expect(cell!.current).toBe(false);
  });

  it('scales a link between two rooms the same way', () => {
    const view = mapPanelView(
      floor(
        [room({ id: 0 }), room({ id: 1, col: 1, x: 8 })],
        [{ from: 0, to: 1, x1: 6, y1: 3, x2: 8, y2: 3 }],
      ),
      '',
      DESKTOP,
    );
    expect(view.links).toHaveLength(1);
    expect(view.links[0]).toMatchObject({ from: 0, to: 1 });
    expect(view.links[0]!.x1).toBeCloseTo(DX + 6 * SCALE, 10);
    expect(view.links[0]!.y1).toBeCloseTo(DY + 3 * SCALE, 10);
    expect(view.links[0]!.x2).toBeCloseTo(DX + 8 * SCALE, 10);
    expect(view.links[0]!.y2).toBeCloseTo(DY + 3 * SCALE, 10);
  });

  it('prints hud.noMap, with no room and no link, while no floor is up', () => {
    const empty = mapPanelView(null, 'Map 1 · Viridian Forest', DESKTOP);
    expect(empty.rooms).toEqual([]);
    expect(empty.links).toEqual([]);
    expect(empty.empty).not.toBeNull();
    expect(empty.empty!.label).toBe(t('hud.noMap'));
    expect(empty.empty!.box.x).toBe(MAP_PANEL_W / 2);
    expect(empty.empty!.box.y).toBe(MAP_TITLE_H + 56);
    expect(empty.grid.scale).toBe(0);
  });

  it('treats an undiscovered floor exactly like a missing one', () => {
    const hidden: MapView = {
      width: 15,
      height: 11,
      rooms: [room({ current: true })],
      links: [],
      visible: false,
    };
    const view = mapPanelView(hidden, 'Map 1', DESKTOP);
    expect(view.rooms).toEqual([]);
    expect(view.links).toEqual([]);
    expect(view.empty!.label).toBe(t('hud.noMap'));
  });

  it('is pure: the same input deep-equals and nothing is mutated', () => {
    const input = floor(
      [room({ id: 0, boss: true, portal: true }), room({ id: 1, captureSpent: true })],
      [{ from: 0, to: 1, x1: 6, y1: 3, x2: 8, y2: 3 }],
    );
    const before = JSON.stringify(input);
    const first = mapPanelView(input, 'Map 1', DESKTOP);
    const second = mapPanelView(input, 'Map 1', DESKTOP);
    expect(second).toEqual(first);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe('the room markers', () => {
  it('draws the boss dot on the boss room and nowhere else', () => {
    const view = mapPanelView(floor([room({ id: 0, boss: true }), room({ id: 1 })]), '', DESKTOP);
    const boss = view.rooms[0]!.markers;
    expect(boss).toHaveLength(1);
    expect(boss[0]).toMatchObject({ kind: 'boss' });
    expect(boss[0]!.cx).toBeCloseTo(view.rooms[0]!.box.x + view.rooms[0]!.box.w / 2, 10);
    expect(boss[0]!.cy).toBeCloseTo(view.rooms[0]!.box.y + view.rooms[0]!.box.h / 2, 10);
    expect(boss[0]!.r).toBeCloseTo(Math.max(3, Math.min(6 * SCALE, 6 * SCALE) * 0.18), 10);
    expect(view.rooms[1]!.markers).toEqual([]);
  });

  it('draws the capture ball only on a room whose capture is spent', () => {
    const view = mapPanelView(
      floor([room({ id: 0, captureSpent: true }), room({ id: 1 })]),
      '',
      DESKTOP,
    );
    expect(view.rooms[0]!.markers.map((marker) => marker.kind)).toEqual(['capture']);
    expect(view.rooms[1]!.markers).toEqual([]);
  });

  it('lets the boss win over a spent capture', () => {
    const view = mapPanelView(floor([room({ boss: true, captureSpent: true })]), '', DESKTOP);
    expect(view.rooms[0]!.markers.map((marker) => marker.kind)).toEqual(['boss']);
  });

  it('draws the portal ring at 1.4 × the dot radius, only when the portal is open', () => {
    const closed = mapPanelView(floor([room({ id: 0, boss: true })]), '', DESKTOP);
    expect(closed.rooms[0]!.markers.map((marker) => marker.kind)).toEqual(['boss']);
    const open = mapPanelView(floor([room({ id: 0, boss: true, portal: true })]), '', DESKTOP);
    const kinds = open.rooms[0]!.markers.map((marker) => marker.kind);
    expect(kinds).toEqual(['boss', 'portal']);
    const [boss, portal] = open.rooms[0]!.markers;
    expect(portal!.r).toBeCloseTo(boss!.r * 1.4, 10);
  });

  it('draws one special dot per room marker, in its own tone', () => {
    for (const special of SPECIALS) {
      const view = mapPanelView(floor([room({ marker: special })]), '', DESKTOP);
      const [marker] = view.rooms[0]!.markers;
      expect(marker).toMatchObject({ kind: 'special', special, fill: MAP_SPECIAL_TONES[special] });
      expect(view.rooms[0]!.markers).toHaveLength(1);
    }
  });
});

describe('the opening ticks', () => {
  it('draws N/S horizontally and E/W vertically, at the opening midpoint', () => {
    const view = mapPanelView(
      floor([
        room({
          openings: [
            { edge: 'N', kind: 'entry', x: 3, y: 0 },
            { edge: 'S', kind: 'link', x: 3, y: 6 },
            { edge: 'E', kind: 'entry', x: 6, y: 3 },
            { edge: 'W', kind: 'link', x: 0, y: 3 },
          ],
        }),
      ]),
      '',
      DESKTOP,
    );
    const openings = view.rooms[0]!.openings;
    expect(openings.map((opening) => opening.edge)).toEqual(['N', 'S', 'E', 'W']);
    expect(openings.map((opening) => opening.kind)).toEqual(['entry', 'link', 'entry', 'link']);
    expect(openings[0]!.d).toBe('M 42.528 79.467 H 67.872');
    expect(openings[1]!.d).toBe('M 42.528 149.867 H 67.872');
    expect(openings[2]!.d).toBe('M 90.4 101.995 V 127.339');
    expect(openings[3]!.d).toBe('M 20 101.995 V 127.339');
  });

  it('floors the tick half-length at 2.5 px on a tiny room', () => {
    const view = mapPanelView(
      floor([room({ w: 1, h: 1, openings: [{ edge: 'N', kind: 'link', x: 0.5, y: 0 }] })]),
      '',
      DESKTOP,
    );
    expect(view.rooms[0]!.box.w).toBeLessThan(14);
    expect(view.rooms[0]!.openings[0]!.d).toBe(
      `M ${String(Math.round((DX + 0.5 * SCALE - 2.5) * 1000) / 1000)} ${String(
        Math.round((DY + 0) * 1000) / 1000,
      )} H ${String(Math.round((DX + 0.5 * SCALE + 2.5) * 1000) / 1000)}`,
    );
  });
});

describe('the mirrored Phaser constants', () => {
  it('keep their shipped values', () => {
    expect(MAP_PANEL_W).toBe(216);
    expect(MAP_PANEL_H).toBe(250);
    expect(MAP_TITLE_H).toBe(50);
    expect(MAP_PAD_X).toBe(20);
    expect(MAP_PAD_BOTTOM).toBe(12);
    expect(MAP_CONTENT_LEFT).toBe(30);
    expect(MAP_LINK_STROKE).toBe(3);
    expect(MAP_ROOM_STROKE).toBe(2);
    expect(MAP_OPENING_STROKE).toBe(4);
    expect(MAP_CURRENT_FILL).toBe('#f6d98a');
    expect(MAP_CURRENT_STROKE).toBe('#9a7a1f');
    expect(MAP_PORTAL_STROKE).toBe('#3fa9f5');
    expect(MAP_ENTRY_STROKE).toBe('#4ad15c');
    expect(MAP_BOSS_FILL).toBe('#b0304a');
    expect(MAP_CAPTURE_FILL).toBe('#e2554e');
  });

  it('cover every special room kind with its documented tone', () => {
    expect(Object.keys(MAP_SPECIAL_TONES).sort()).toEqual([...SPECIALS].sort());
    expect(MAP_SPECIAL_TONES).toEqual({
      'mini-boss': '#7dd3fc',
      'mega-stone': '#c084fc',
      gated: '#fbbf24',
      trade: '#4ad15c',
      'no-heal': '#e2554e',
      static: '#f8fafc',
      'secret-shop': '#22d3ee',
      banned: '#94a3b8',
      puzzle: '#a3e635',
    });
  });

  it('derive the grid band from the card, and the card from the window', () => {
    expect(MAP_PAD_X * 2 + AREA.w).toBe(MAP_PANEL_W);
    expect(MAP_TITLE_H + AREA.h + MAP_PAD_BOTTOM).toBe(MAP_PANEL_H);
    expect(MAP_CONTENT_LEFT + 166 + MAP_PAD_X).toBe(MAP_PANEL_W);
  });
});
