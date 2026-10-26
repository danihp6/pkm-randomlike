import { describe, expect, it } from 'vitest';
import { getBiome } from '../../data/biomes';
import { ROUTE_LOOT } from '../../data/loot';
import { TRAINER_ARCHETYPE_IDS } from '../../data/trainers';
import { TILESETS } from '../../data/tilesets';
import { en } from '../../i18n/en';
import { es } from '../../i18n/es';
import type { Tile } from '../grid';
import { FLOOR, isWalkable, tileAt } from '../map';
import { linkedNeighbour, planMap, roomView, type MapEdge, type MapPlan } from '../maps';
import { routeIndexForRoom } from '../run';
import { borderEdge, openingBandCells } from './doors';
import type { AccessEdge } from './layout';
import { BOSS_SIGN_KEY, bossSign, inwardStep, type RouteSign } from './signs';
import { sketchRoute, type RouteRequest } from './sketch';
import type { RouteMap } from './routeMap';

const SEEDS = Array.from({ length: 20 }, (_, index) => `sign-seed-${index + 1}`);

/** The wall motif the route scene passes, so these builds carve what the game does. */
function wallFootprint(): Readonly<{ cols: number; minHeight: number }> | undefined {
  const pattern = TILESETS[getBiome('forest').tilesetId].config.wallPattern;
  if (!pattern) return undefined;
  return { cols: pattern.cols, minHeight: Math.max(2, pattern.rows.length - 2) };
}

/**
 * The room's route as the scene asks for it (`buildRoom`): the plan's opening set,
 * the room's own quiet rule and population, plus the sign edge when the room is the
 * one that links into the boss room.
 */
function requestFor(seed: string, plan: MapPlan, roomId: number, signEdge?: MapEdge): RouteRequest {
  const view = roomView(plan, roomId, true);
  const wall = wallFootprint();
  return {
    seed,
    routeIndex: routeIndexForRoom(plan, roomId),
    biomeId: view.biomeId,
    openings: view.openings,
    width: view.width,
    height: view.height,
    grassPatches: 4,
    ledges: 2,
    loot: ROUTE_LOOT.early.pool,
    hiddenChance: 0,
    itemChance: 1,
    role: view.role,
    trainerArchetypes: TRAINER_ARCHETYPE_IDS,
    quiet: view.entry || view.boss || view.special !== null,
    ...(view.boss ? { chamber: true } : {}),
    ...(signEdge ? { signEdge } : {}),
    ...(wall ? { wall } : {}),
  };
}

/** The room whose own opening links into the boss room: the boss leaf's parent. */
function approachRoom(plan: MapPlan): number {
  for (const room of plan.rooms) {
    if (room.id === plan.bossRoom) continue;
    for (const opening of room.openings) {
      if (linkedNeighbour(plan, room.id, opening.edge) === plan.bossRoom) return room.id;
    }
  }
  throw new Error(`map ${plan.mapIndex} hangs no room off its boss`);
}

/** The edge of `roomId` that steps into the boss room, the way the scene derives it. */
function bossLinkEdge(plan: MapPlan, roomId: number): MapEdge {
  for (const opening of plan.rooms[roomId].openings) {
    if (linkedNeighbour(plan, roomId, opening.edge) === plan.bossRoom) return opening.edge;
  }
  throw new Error(`room ${roomId} does not link into the boss room`);
}

function sameCell(a: Tile, b: Tile): boolean {
  return a.x === b.x && a.y === b.y;
}

function signOn(route: RouteMap): RouteSign {
  const signs = route.signs ?? [];
  expect(signs).toHaveLength(1);
  return signs[0];
}

describe('inwardStep', () => {
  it('steps one tile into the room from every edge', () => {
    expect(inwardStep('N')).toEqual({ x: 0, y: 1 });
    expect(inwardStep('S')).toEqual({ x: 0, y: -1 });
    expect(inwardStep('W')).toEqual({ x: 1, y: 0 });
    expect(inwardStep('E')).toEqual({ x: -1, y: 0 });
  });
});

describe('bossSign', () => {
  it('places the sign one tile inward from the opening anchor, for all four edges', () => {
    const opening = { x: 5, y: 7 };
    expect(bossSign('N', opening)).toEqual({ x: 5, y: 8, text: BOSS_SIGN_KEY });
    expect(bossSign('S', opening)).toEqual({ x: 5, y: 6, text: BOSS_SIGN_KEY });
    expect(bossSign('W', opening)).toEqual({ x: 6, y: 7, text: BOSS_SIGN_KEY });
    expect(bossSign('E', opening)).toEqual({ x: 4, y: 7, text: BOSS_SIGN_KEY });
  });

  it('never mutates the opening it is given', () => {
    const opening = { x: 1, y: 2 };
    bossSign('W', opening);
    expect(opening).toEqual({ x: 1, y: 2 });
  });
});

describe('the sign key', () => {
  it('is the key a route sign carries, never a translated string', () => {
    expect(BOSS_SIGN_KEY).toBe('boss.sign');
    expect(bossSign('W', { x: 0, y: 3 }).text).toBe(BOSS_SIGN_KEY);
  });

  it('reads a non-empty, different string in both locales', () => {
    expect(en['boss.sign'].length).toBeGreaterThan(0);
    expect(es['boss.sign'].length).toBeGreaterThan(0);
    expect(en['boss.sign']).not.toBe(es['boss.sign']);
  });
});

describe('a route that asks for no sign', () => {
  it('carries no signs at all, so every shipped route stays byte-identical', () => {
    const plan = planMap(SEEDS[0], 1);
    const view = roomView(plan, approachRoom(plan), true);
    const route = sketchRoute({
      seed: SEEDS[0],
      routeIndex: 1,
      biomeId: view.biomeId,
      openings: view.openings,
      width: view.width,
      height: view.height,
    });
    expect(route.signs).toBeUndefined();
  });

  it('draws no sign for an edge the room does not open on', () => {
    const route = sketchRoute({
      seed: SEEDS[0],
      routeIndex: 1,
      biomeId: 'forest',
      openings: [
        { edge: 'W', role: 'entry' },
        { edge: 'E', role: 'exit' },
      ],
      width: 32,
      height: 32,
      signEdge: 'N',
    });
    expect(route.signs).toBeUndefined();
  });
});

describe('on 20 fixed seeds', () => {
  const plans = SEEDS.map((seed) => ({ seed, plan: planMap(seed, 1) }));

  it('gives the room that links into the boss room exactly one sign, in the same cell', () => {
    for (const { seed, plan } of plans) {
      const roomId = approachRoom(plan);
      const edge = bossLinkEdge(plan, roomId);
      const first = sketchRoute(requestFor(seed, plan, roomId, edge));
      const second = sketchRoute(requestFor(seed, plan, roomId, edge));
      const sign = signOn(first);
      const again = signOn(second);
      const where = `${seed} room ${roomId}`;
      expect({ x: sign.x, y: sign.y }, where).toEqual({ x: again.x, y: again.y });
      expect(sign.text, where).toBe(BOSS_SIGN_KEY);
      expect(sign.x, where).toBeGreaterThanOrEqual(1);
      expect(sign.y, where).toBeGreaterThanOrEqual(1);
      expect(sign.x, where).toBeLessThan(first.width - 1);
      expect(sign.y, where).toBeLessThan(first.height - 1);
    }
  });

  it('stands the sign on walkable floor at the opening, off the border band', () => {
    for (const { seed, plan } of plans) {
      const roomId = approachRoom(plan);
      const edge = bossLinkEdge(plan, roomId);
      const route = sketchRoute(requestFor(seed, plan, roomId, edge));
      const sign = signOn(route);
      const where = `${seed} room ${roomId} edge ${edge}`;

      expect(isWalkable(route.tiles, sign), where).toBe(true);
      expect(tileAt(route.tiles, sign), where).toBe(FLOOR);

      // The anchor the sign steps in from is the opening's own border cell.
      const step = inwardStep(edge as AccessEdge);
      const anchor: Tile = { x: sign.x - step.x, y: sign.y - step.y };
      expect(borderEdge(anchor, route.width, route.height), where).toBe(edge);

      // The sign is off the opening's own band, and the lane's other half is walkable
      // all the way in, so the door can still be walked through beside it.
      const band = openingBandCells(edge as AccessEdge, anchor, route.width, route.height, 2);
      expect(band.length, where).toBe(2);
      expect(
        band.some((cell) => sameCell(cell, sign)),
        where,
      ).toBe(false);
      const free: Tile = { x: band[1].x + step.x, y: band[1].y + step.y };
      expect(isWalkable(route.tiles, band[1]), where).toBe(true);
      expect(isWalkable(route.tiles, free), where).toBe(true);
    }
  });

  it('leaves the sign tile free of trainers and ground items', () => {
    for (const { seed, plan } of plans) {
      const roomId = approachRoom(plan);
      const edge = bossLinkEdge(plan, roomId);
      const route = sketchRoute(requestFor(seed, plan, roomId, edge));
      const sign = signOn(route);
      const where = `${seed} room ${roomId}`;
      expect(
        route.trainers.some((trainer) => sameCell(trainer.position, sign)),
        where,
      ).toBe(false);
      expect(
        route.items.some((item) => sameCell(item.position, sign)),
        where,
      ).toBe(false);
    }
  });

  it('gives the boss room, the entry room and every leaf no sign', () => {
    for (const { seed, plan } of plans) {
      const entryRoom = plan.entryRoom;
      expect(approachRoom(plan), seed).not.toBe(entryRoom);
      const rooms = [plan.bossRoom, entryRoom];
      const leaf = plan.rooms.find(
        (room) =>
          room.id !== plan.bossRoom &&
          room.id !== entryRoom &&
          plan.links.filter(([a, b]) => a === room.id || b === room.id).length === 1,
      );
      if (leaf) rooms.push(leaf.id);
      for (const roomId of rooms) {
        const route = sketchRoute(requestFor(seed, plan, roomId));
        expect(route.signs, `${seed} room ${roomId}`).toBeUndefined();
      }
    }
  });
});
