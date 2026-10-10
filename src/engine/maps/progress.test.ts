import { describe, expect, it } from 'vitest';
import { FINITE_MAPS } from '../../data/maps';
import { TALL_GRASS } from '../map';
import { sketchRoute } from '../routes/sketch';
import { validateRoute } from '../routes/validate';
import { MAP_EDGES, OPPOSITE_EDGE, arrivalEdgeFor, linkedNeighbour, planMap, type MapEdge } from './plan';
import {
  bossTrainerId,
  isFinalMap,
  portalEdgeFor,
  roomAcross,
  roomView,
} from './progress';

const SEEDS = ['progress-a', 'progress-b', 'progress-c', 'progress-d'];

describe('isFinalMap', () => {
  it('ends a finite run on its last map and never an infinite one', () => {
    expect(isFinalMap('finite', 1)).toBe(false);
    expect(isFinalMap('finite', FINITE_MAPS)).toBe(true);
    expect(isFinalMap('finite', FINITE_MAPS + 3)).toBe(true);
    expect(isFinalMap('infinite', FINITE_MAPS)).toBe(false);
  });
});

describe('arrivalEdgeFor / roomView', () => {
  it('gives the entry room no outward door (it spawns at its centre)', () => {
    for (const seed of SEEDS) {
      const plan = planMap(seed, 1);
      const view = roomView(plan, plan.entryRoom, false);
      expect(view.entryEdge).toBeNull();
      expect(view.openings.some((opening) => opening.role === 'entry')).toBe(false);
      const links = plan.rooms[plan.entryRoom].openings
        .filter((opening) => opening.kind === 'link')
        .map((opening) => opening.edge)
        .sort((a, b) => MAP_EDGES.indexOf(a) - MAP_EDGES.indexOf(b));
      expect(view.openings.map((opening) => opening.edge)).toEqual(links);
    }
  });

  it('enters every other room through one of its links', () => {
    for (const seed of SEEDS) {
      for (let mapIndex = 1; mapIndex <= 6; mapIndex++) {
        const plan = planMap(seed, mapIndex);
        for (const room of plan.rooms) {
          const view = roomView(plan, room.id, false);
          const entry = view.openings.find((opening) => opening.role === 'entry');
          if (room.id === plan.entryRoom) {
            // The map entry spawns at its centre: no arrival door.
            expect(view.entryEdge).toBeNull();
            expect(entry).toBeUndefined();
          } else {
            expect(entry, `${seed} map ${mapIndex} room ${room.id}`).toBeDefined();
            expect(linkedNeighbour(plan, room.id, view.entryEdge!)).toBeDefined();
          }
          // Every opening is a real link, never a wall (the portal is a free wall).
          for (const opening of view.openings) {
            if (opening.edge === view.portalEdge) continue;
            expect(linkedNeighbour(plan, room.id, opening.edge)).toBeDefined();
          }
        }
      }
    }
  });

  it('mirrors the room size and marks the boss room', () => {
    for (const seed of SEEDS) {
      const plan = planMap(seed, 2);
      for (const room of plan.rooms) {
        const view = roomView(plan, room.id, false);
        expect(view.width).toBe(room.width);
        expect(view.height).toBe(room.height);
        expect(view.roomCount).toBe(plan.rooms.length);
        expect(view.boss).toBe(room.id === plan.bossRoom);
      }
    }
  });

  it('carries each room\'s special kind through to its view', () => {
    for (const seed of SEEDS) {
      const plan = planMap(seed, 4);
      for (const room of plan.rooms) {
        expect(roomView(plan, room.id, false).special).toBe(room.special);
      }
    }
  });

  it('spawns at the door it is told arrived through, and falls back on a wall', () => {
    for (const seed of SEEDS) {
      const plan = planMap(seed, 1);
      const room = plan.rooms.find((candidate) => candidate.id !== plan.entryRoom)!;
      const link = MAP_EDGES.find((edge) => linkedNeighbour(plan, room.id, edge) !== undefined)!;
      const view = roomView(plan, room.id, false, link);
      const entry = view.openings.find((opening) => opening.role === 'entry');
      expect(view.entryEdge).toBe(link);
      expect(entry?.edge).toBe(link);

      const wall = MAP_EDGES.find((edge) => linkedNeighbour(plan, room.id, edge) === undefined);
      if (wall) {
        // A wall is not a door: the plan-derived arrival is used instead.
        expect(roomView(plan, room.id, false, wall).entryEdge).toBe(arrivalEdgeFor(plan, room.id));
      }
    }
  });

  it('carves the entry room from the same openings, spawning at its centre from outside and at the door from a link', () => {
    for (const seed of SEEDS) {
      const plan = planMap(seed, 2);
      const fresh = roomView(plan, plan.entryRoom, false);
      const edges = fresh.openings.map((opening) => opening.edge);
      // A fresh (outside) arrival has no door and spawns at the centre.
      expect(fresh.entryEdge).toBeNull();
      expect(fresh.openings.some((opening) => opening.role === 'entry')).toBe(false);
      const freshRoute = sketchRoute({
        seed,
        routeIndex: 1,
        biomeId: fresh.biomeId,
        openings: fresh.openings,
        width: fresh.width,
        height: fresh.height,
      });
      for (const edge of MAP_EDGES) {
        if (linkedNeighbour(plan, plan.entryRoom, edge) === undefined) continue;
        const fromLink = roomView(plan, plan.entryRoom, false, edge);
        // The same opening edges, so the lanes stay put...
        expect(fromLink.openings.map((opening) => opening.edge)).toEqual(edges);
        // ...the carved geometry is identical (only the spawn moves)...
        const linkRoute = sketchRoute({
          seed,
          routeIndex: 1,
          biomeId: fromLink.biomeId,
          openings: fromLink.openings,
          width: fromLink.width,
          height: fromLink.height,
        });
        expect(linkRoute.tiles).toEqual(freshRoute.tiles);
        // ...but walking back in through the link spawns at that link.
        expect(fromLink.entryEdge).toBe(edge);
        expect(fromLink.openings.find((opening) => opening.role === 'entry')?.edge).toBe(edge);
      }
    }
  });

  it('seeds the same trainers for the entry room however it is entered', () => {
    for (const seed of SEEDS) {
      const plan = planMap(seed, 3);
      const view = roomView(plan, plan.entryRoom, false, plan.entryEdge);
      const request = {
        seed,
        routeIndex: 1,
        biomeId: view.biomeId,
        width: view.width,
        height: view.height,
      };
      const base = sketchRoute({ ...request, openings: view.openings });
      for (const edge of MAP_EDGES) {
        if (linkedNeighbour(plan, plan.entryRoom, edge) === undefined) continue;
        const viaLink = roomView(plan, plan.entryRoom, false, edge);
        const other = sketchRoute({ ...request, openings: viaLink.openings });
        expect(other.trainers.map((trainer) => trainer.id)).toEqual(
          base.trainers.map((trainer) => trainer.id),
        );
        expect(other.trainers.map((trainer) => `${trainer.position.x},${trainer.position.y}`)).toEqual(
          base.trainers.map((trainer) => `${trainer.position.x},${trainer.position.y}`),
        );
      }
    }
  });

  it('arrives through the opposite door and can walk straight back', () => {
    for (const seed of SEEDS) {
      for (let mapIndex = 1; mapIndex <= 4; mapIndex++) {
        const plan = planMap(seed, mapIndex);
        for (const from of plan.rooms) {
          for (const edge of MAP_EDGES) {
            const to = linkedNeighbour(plan, from.id, edge);
            if (to === undefined) continue;
            // Leave by `edge`, so the next room is entered by its opposite —
            // except the map entry, which always spawns at its centre.
            const arrival = OPPOSITE_EDGE[edge];
            const view = roomView(plan, to, false, arrival);
            // Every room — the map entry included — spawns at the link it is
            // entered through when the player walks back in.
            expect(view.entryEdge, `${seed} ${from.id}->${to} by ${edge}`).toBe(arrival);
            // The door the player arrives through leads straight back.
            expect(linkedNeighbour(plan, to, view.entryEdge!)).toBe(from.id);
          }
        }
      }
    }
  });
});

describe('portal', () => {
  it('only the boss room has a portal edge', () => {
    for (const seed of SEEDS) {
      for (let mapIndex = 1; mapIndex <= 8; mapIndex++) {
        const plan = planMap(seed, mapIndex);
        for (const room of plan.rooms) {
          if (room.id === plan.bossRoom) continue;
          expect(portalEdgeFor(plan, room.id), `${seed} map ${mapIndex} room ${room.id}`).toBeNull();
          expect(roomView(plan, room.id, false).portalEdge).toBeNull();
        }
      }
    }
  });

  it('opens the portal on a free wall of the boss room', () => {
    for (const seed of SEEDS) {
      for (let mapIndex = 1; mapIndex <= 8; mapIndex++) {
        const plan = planMap(seed, mapIndex);
        const edge = portalEdgeFor(plan, plan.bossRoom);
        expect(edge, `${seed} map ${mapIndex}`).not.toBeNull();
        // A free wall: no link there, else the portal would not be an exit.
        expect(linkedNeighbour(plan, plan.bossRoom, edge as MapEdge)).toBeUndefined();
      }
    }
  });

  it('carves the portal from the start and only opens it when the boss falls', () => {
    const plan = planMap('progress-a', 3);
    const sealed = roomView(plan, plan.bossRoom, false);
    const open = roomView(plan, plan.bossRoom, true);
    expect(open.portalEdge).toBe(portalEdgeFor(plan, plan.bossRoom));
    expect(sealed.portalEdge).toBe(open.portalEdge);
    // The geometry is the same sealed or open, so the room never re-rolls.
    expect(sealed.openings.map((opening) => opening.edge)).toEqual(
      open.openings.map((opening) => opening.edge),
    );
    expect(sealed.openings.some((opening) => opening.edge === open.portalEdge && opening.role === 'exit')).toBe(
      true,
    );
    expect(sealed.portalOpen).toBe(false);
    expect(open.portalOpen).toBe(true);
  });

  it('builds a valid route for the boss room with its portal open', () => {
    for (const seed of SEEDS) {
      for (const mapIndex of [1, 4, 6]) {
        const plan = planMap(seed, mapIndex);
        const view = roomView(plan, plan.bossRoom, true);
        const route = sketchRoute({
          seed,
          routeIndex: 1,
          biomeId: view.biomeId,
          openings: view.openings,
          width: view.width,
          height: view.height,
        });
        expect(validateRoute(route).ok, `${seed} map ${mapIndex}`).toBe(true);
      }
    }
  });

  it('is a quiet dead-end: one usable exit, no trainers and no tall grass', () => {
    for (const seed of SEEDS) {
      for (let mapIndex = 1; mapIndex <= 6; mapIndex++) {
        const plan = planMap(seed, mapIndex);
        const view = roomView(plan, plan.bossRoom, false);
        // One link plus the sealed portal.
        const links = view.openings.filter((opening) => opening.edge !== view.portalEdge);
        expect(links, `${seed} map ${mapIndex}`).toHaveLength(1);
        expect(view.portalOpen).toBe(false);
        const route = sketchRoute({
          seed,
          routeIndex: 1,
          biomeId: view.biomeId,
          openings: view.openings,
          width: view.width,
          height: view.height,
          grassPatches: 0,
          trainerArchetypes: [],
        });
        expect(validateRoute(route).ok).toBe(true);
        expect(route.trainers).toHaveLength(0);
        expect(route.tiles.some((row) => row.includes(TALL_GRASS))).toBe(false);
      }
    }
  });
});

describe('roomAcross', () => {
  it('follows every link to its neighbour and the entry edge to nothing', () => {
    const plan = planMap('progress-a', 1);
    for (const room of plan.rooms) {
      for (const edge of MAP_EDGES) {
        const neighbour = linkedNeighbour(plan, room.id, edge);
        expect(roomAcross(plan, room.id, edge)).toBe(neighbour);
        if (room.id === plan.entryRoom && edge === plan.entryEdge) {
          expect(neighbour).toBeUndefined();
        }
      }
    }
  });

  it('returns the predecessor across the arrival edge', () => {
    const plan = planMap('progress-b', 2);
    for (const room of plan.rooms) {
      if (room.id === plan.entryRoom) continue;
      const arrival = roomView(plan, room.id, false).entryEdge!;
      const from = roomAcross(plan, room.id, arrival);
      expect(from).toBeDefined();
      // Leaving the predecessor through the opposite door reaches this room again.
      expect(roomAcross(plan, from as number, OPPOSITE_EDGE[arrival])).toBe(room.id);
    }
  });
});

describe('bossTrainerId', () => {
  it('is stable per map', () => {
    expect(bossTrainerId(3)).toBe('boss-3');
    expect(bossTrainerId(3)).toBe(bossTrainerId(3));
  });
});
