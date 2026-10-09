import { describe, expect, it } from 'vitest';
import { MAP_EDGES, OPPOSITE_EDGE, planMap, type MapPlan } from '../engine/maps';
import { MAP_VIEW_GAP, buildMapView, type MapViewRoom } from './mapView';

const SEEDS = ['map-view-a', 'map-view-b', 'map-view-c', 'map-view-d', 'map-view-e'];

function allRooms(plan: MapPlan): number[] {
  return plan.rooms.map((room) => room.id);
}

function overlaps(a: MapViewRoom, b: MapViewRoom): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

describe('buildMapView layout', () => {
  it('draws every discovered room sized from its plan size', () => {
    for (const seed of SEEDS) {
      for (let mapIndex = 1; mapIndex <= 4; mapIndex++) {
        const plan = planMap(seed, mapIndex);
        const view = buildMapView(plan, { discovered: allRooms(plan), currentRoom: plan.entryRoom });
        expect(view.rooms).toHaveLength(plan.rooms.length);
        expect(view.visible).toBe(true);
        for (const room of view.rooms) {
          const source = plan.rooms[room.id];
          expect(room.w).toBe(source.width);
          expect(room.h).toBe(source.height);
          expect(room.shape).toBe(source.shape);
          expect(Number.isFinite(room.x)).toBe(true);
          expect(Number.isFinite(room.y)).toBe(true);
        }
      }
    }
  });

  it('keeps a gap between every pair of rooms', () => {
    for (const seed of SEEDS) {
      const plan = planMap(seed, 3);
      const view = buildMapView(plan, { discovered: allRooms(plan), currentRoom: plan.entryRoom });
      for (let i = 0; i < view.rooms.length; i++) {
        for (let j = i + 1; j < view.rooms.length; j++) {
          expect(overlaps(view.rooms[i], view.rooms[j]), `${seed} ${i}/${j}`).toBe(false);
          const a = view.rooms[i];
          const b = view.rooms[j];
          const separatedX = a.x + a.w + MAP_VIEW_GAP <= b.x || b.x + b.w + MAP_VIEW_GAP <= a.x;
          const separatedY = a.y + a.h + MAP_VIEW_GAP <= b.y || b.y + b.h + MAP_VIEW_GAP <= a.y;
          expect(separatedX || separatedY).toBe(true);
        }
      }
    }
  });

  it('keeps the view bounds around every room and marks a single current room', () => {
    for (const seed of SEEDS) {
      const plan = planMap(seed, 2);
      const current = plan.rooms[Math.floor(plan.rooms.length / 2)].id;
      const view = buildMapView(plan, { discovered: allRooms(plan), currentRoom: current });
      for (const room of view.rooms) {
        expect(room.x + room.w).toBeLessThanOrEqual(view.width);
        expect(room.y + room.h).toBeLessThanOrEqual(view.height);
      }
      expect(view.rooms.filter((room) => room.current).map((room) => room.id)).toEqual([current]);
    }
  });

  it('places each opening on the matching wall with its midpoint', () => {
    for (const seed of SEEDS) {
      const plan = planMap(seed, 1);
      const view = buildMapView(plan, { discovered: allRooms(plan), currentRoom: plan.entryRoom });
      for (const room of view.rooms) {
        for (const opening of room.openings) {
          switch (opening.edge) {
            case 'N':
              expect(opening.y).toBe(room.y);
              expect(opening.x).toBe(room.x + room.w / 2);
              break;
            case 'S':
              expect(opening.y).toBe(room.y + room.h);
              expect(opening.x).toBe(room.x + room.w / 2);
              break;
            case 'W':
              expect(opening.x).toBe(room.x);
              expect(opening.y).toBe(room.y + room.h / 2);
              break;
            case 'E':
              expect(opening.x).toBe(room.x + room.w);
              expect(opening.y).toBe(room.y + room.h / 2);
              break;
          }
        }
      }
    }
  });

  it('draws one link per plan link, from wall to facing wall', () => {
    for (const seed of SEEDS) {
      const plan = planMap(seed, 4);
      const view = buildMapView(plan, { discovered: allRooms(plan), currentRoom: plan.entryRoom });
      expect(view.links).toHaveLength(plan.links.length);
      for (const link of view.links) {
        const from = view.rooms.find((room) => room.id === link.from)!;
        const to = view.rooms.find((room) => room.id === link.to)!;
        const startOnWall = from.openings.some(
          (opening) => opening.x === link.x1 && opening.y === link.y1,
        );
        const endOnWall = to.openings.some((opening) => opening.x === link.x2 && opening.y === link.y2);
        expect(startOnWall).toBe(true);
        expect(endOnWall).toBe(true);
      }
    }
  });
});

describe('buildMapView discovery fog (D32)', () => {
  it('reveals only the rooms that have been entered', () => {
    const plan = planMap('fog-seed', 1);
    const view = buildMapView(plan, { discovered: [plan.entryRoom], currentRoom: plan.entryRoom });
    expect(view.rooms).toHaveLength(1);
    expect(view.rooms[0].id).toBe(plan.entryRoom);
    expect(view.links).toHaveLength(0);
  });

  it('keeps a room in place no matter which neighbours are revealed', () => {
    const plan = planMap('fog-seed', 2);
    const full = buildMapView(plan, { discovered: allRooms(plan), currentRoom: plan.entryRoom });
    const few = buildMapView(plan, { discovered: [plan.entryRoom], currentRoom: plan.entryRoom });
    const anchored = full.rooms.find((room) => room.id === plan.entryRoom)!;
    expect(few.rooms[0].x).toBe(anchored.x);
    expect(few.rooms[0].y).toBe(anchored.y);
  });

  it('shows a link only once both ends are discovered', () => {
    const plan = planMap('fog-seed', 3);
    const [a, b] = plan.links[0];
    const half = buildMapView(plan, { discovered: [a], currentRoom: a });
    expect(half.links).toHaveLength(0);
    const both = buildMapView(plan, { discovered: [a, b], currentRoom: a });
    expect(both.links).toHaveLength(1);
    expect(both.links[0]).toMatchObject({ from: a, to: b });
  });

  it('is deterministic for the same input', () => {
    const plan = planMap('fog-seed', 5);
    const input = { discovered: allRooms(plan), currentRoom: plan.entryRoom, portalOpen: true };
    expect(buildMapView(plan, input)).toEqual(buildMapView(plan, input));
  });
});

describe('buildMapView boss, portal and specials', () => {
  it('marks the boss room and, only when open, its portal', () => {
    for (const seed of SEEDS) {
      const plan = planMap(seed, 1);
      const all = allRooms(plan);
      const sealed = buildMapView(plan, { discovered: all, currentRoom: plan.entryRoom });
      const open = buildMapView(plan, {
        discovered: all,
        currentRoom: plan.entryRoom,
        portalOpen: true,
      });

      const sealedBoss = sealed.rooms.find((room) => room.id === plan.bossRoom)!;
      const openBoss = open.rooms.find((room) => room.id === plan.bossRoom)!;
      expect(sealedBoss.boss).toBe(true);
      expect(sealedBoss.portal).toBe(false);
      expect(sealedBoss.openings.some((opening) => opening.kind === 'portal')).toBe(false);

      expect(openBoss.portal).toBe(true);
      const portal = openBoss.openings.filter((opening) => opening.kind === 'portal');
      expect(portal).toHaveLength(1);
      expect(open.rooms.filter((room) => room.portal)).toHaveLength(1);
      // The portal only ever opens on the boss room.
      for (const room of sealed.rooms) {
        if (room.id !== plan.bossRoom) expect(room.portal).toBe(false);
      }
    }
  });

  it('carries the entry opening and every link as openings', () => {
    for (const seed of SEEDS) {
      const plan = planMap(seed, 2);
      const view = buildMapView(plan, {
        discovered: allRooms(plan),
        currentRoom: plan.entryRoom,
        portalOpen: true,
      });
      for (const room of view.rooms) {
        const source = plan.rooms[room.id];
        const hasPortal = room.portal ? 1 : 0;
        expect(room.openings).toHaveLength(source.openings.length + hasPortal);
        const entry = room.openings.filter((opening) => opening.kind === 'entry');
        if (room.id === plan.entryRoom) {
          expect(entry).toHaveLength(1);
          expect(entry[0].edge).toBe(plan.entryEdge);
        } else {
          expect(entry).toHaveLength(0);
        }
      }
      // Every link is a grid neighbour, so each opening is on a distinct edge.
      for (const room of view.rooms) {
        const edges = room.openings.map((opening) => opening.edge);
        expect(new Set(edges).size).toBe(edges.length);
      }
    }
  });

  it('surfaces a special room marker only on the room it belongs to', () => {
    const plan = planMap('markers-seed', 3);
    const [shopRoom, miniBoss] = plan.rooms.map((room) => room.id);
    const view = buildMapView(plan, {
      discovered: allRooms(plan),
      currentRoom: plan.entryRoom,
      markers: { [shopRoom]: 'shop', [miniBoss]: 'mini-boss' },
    });
    expect(view.rooms.find((room) => room.id === shopRoom)!.marker).toBe('shop');
    expect(view.rooms.find((room) => room.id === miniBoss)!.marker).toBe('mini-boss');
    for (const room of view.rooms) {
      if (room.id !== shopRoom && room.id !== miniBoss) expect(room.marker).toBeNull();
    }
  });

  it('reports the floor hidden before any room is discovered', () => {
    const plan = planMap('empty-seed', 1);
    const view = buildMapView(plan, { discovered: [], currentRoom: plan.entryRoom });
    expect(view.rooms).toHaveLength(0);
    expect(view.links).toHaveLength(0);
    expect(view.visible).toBe(false);
    // The bounds still cover the whole floor, so the scale never jumps on reveal.
    expect(view.width).toBeGreaterThan(0);
    expect(view.height).toBeGreaterThan(0);
  });
});

describe('buildMapView links mirror the grid', () => {
  it('links opposite edges between the two rooms', () => {
    const plan = planMap('mirror-seed', 1);
    const view = buildMapView(plan, { discovered: allRooms(plan), currentRoom: plan.entryRoom });
    for (const link of view.links) {
      const from = plan.rooms[link.from];
      const to = plan.rooms[link.to];
      const dc = to.col - from.col;
      const dr = to.row - from.row;
      const edge = dc === 1 ? 'E' : dc === -1 ? 'W' : dr === 1 ? 'S' : 'N';
      expect(MAP_EDGES).toContain(edge);
      expect(OPPOSITE_EDGE[edge]).toBeDefined();
    }
  });
});
