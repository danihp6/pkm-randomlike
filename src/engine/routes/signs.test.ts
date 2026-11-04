import { describe, expect, it } from 'vitest';
import { getBiome } from '../../data/biomes';
import { ROUTE_LOOT } from '../../data/loot';
import { TRAINER_ARCHETYPE_IDS } from '../../data/trainers';
import { TILESETS } from '../../data/tilesets';
import { en } from '../../i18n/en';
import { es } from '../../i18n/es';
import type { Tile } from '../grid';
import { FLOOR, isWalkable, tileAt } from '../map';
import { borderEdge, openingBandCells } from './doors';
import type { AccessEdge } from './layout';
import { BOSS_SIGN_KEY, bossSign, inwardStep, type RouteSign } from './signs';
import { sketchRoute, type RouteRequest } from './sketch';
import type { RouteMap } from './routeMap';

const SEEDS = Array.from({ length: 20 }, (_, index) => `sign-seed-${index + 1}`);

/** The four door edges, in the cardinally ordered set every screen opens on. */
const EDGES: readonly AccessEdge[] = ['N', 'E', 'S', 'W'];

/** The wall motif the route scene passes, so these builds carve what the game does. */
function wallFootprint(): Readonly<{ cols: number; minHeight: number }> | undefined {
  const pattern = TILESETS[getBiome('forest').tilesetId].config.wallPattern;
  if (!pattern) return undefined;
  return { cols: pattern.cols, minHeight: Math.max(2, pattern.rows.length - 2) };
}

/**
 * The request the room whose opening leads into the boss room makes: a 30x30 room
 * with its entry on one edge and its exit — the door that watches the boss room — on
 * `edge`, plus the sign that door carries. A sign needs only the opening set, so the
 * room is synthesized rather than walked out of a plan.
 */
function approachRequest(seed: string, edge: AccessEdge, quiet = false): RouteRequest {
  const entry: AccessEdge = edge === 'S' ? 'W' : 'S';
  const wall = wallFootprint();
  return {
    seed,
    routeIndex: EDGES.indexOf(edge) + 1,
    biomeId: 'forest',
    openings: [
      { edge: entry, role: 'entry' },
      { edge, role: 'exit' },
    ],
    width: 30,
    height: 30,
    grassPatches: 4,
    ledges: 2,
    loot: ROUTE_LOOT.early.pool,
    hiddenChance: 0,
    itemChance: 1,
    role: 'trainers',
    trainerArchetypes: TRAINER_ARCHETYPE_IDS,
    quiet,
    signEdge: edge,
    ...(wall ? { wall } : {}),
  };
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
    const { signEdge, ...request } = approachRequest(SEEDS[0], 'E');
    void signEdge;
    expect(sketchRoute(request).signs).toBeUndefined();
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

describe('on 20 fixed seeds and every door edge', () => {
  const rooms = SEEDS.flatMap((seed) => EDGES.map((edge) => ({ seed, edge })));

  it('gives the room that links into the boss room exactly one sign, in the same cell', () => {
    for (const { seed, edge } of rooms) {
      const first = sketchRoute(approachRequest(seed, edge));
      const second = sketchRoute(approachRequest(seed, edge));
      const sign = signOn(first);
      const again = signOn(second);
      const where = `${seed} edge ${edge}`;
      expect({ x: sign.x, y: sign.y }, where).toEqual({ x: again.x, y: again.y });
      expect(sign.text, where).toBe(BOSS_SIGN_KEY);
      expect(sign.x, where).toBeGreaterThanOrEqual(1);
      expect(sign.y, where).toBeGreaterThanOrEqual(1);
      expect(sign.x, where).toBeLessThan(first.width - 1);
      expect(sign.y, where).toBeLessThan(first.height - 1);
    }
  });

  it('stands the sign on walkable floor at the opening, off the border band', () => {
    for (const { seed, edge } of rooms) {
      const route = sketchRoute(approachRequest(seed, edge));
      const sign = signOn(route);
      const where = `${seed} edge ${edge}`;

      expect(isWalkable(route.tiles, sign), where).toBe(true);
      expect(tileAt(route.tiles, sign), where).toBe(FLOOR);

      // The anchor the sign steps in from is the opening's own border cell.
      const step = inwardStep(edge);
      const anchor: Tile = { x: sign.x - step.x, y: sign.y - step.y };
      expect(borderEdge(anchor, route.width, route.height), where).toBe(edge);

      // The sign is off the opening's own band, and the lane's other half is walkable
      // all the way in, so the door can still be walked through beside it.
      const band = openingBandCells(edge, anchor, route.width, route.height, 2);
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
    for (const { seed, edge } of rooms) {
      const route = sketchRoute(approachRequest(seed, edge));
      const sign = signOn(route);
      const where = `${seed} edge ${edge}`;
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
    for (const { seed, edge } of rooms) {
      const { signEdge, ...request } = approachRequest(seed, edge, true);
      void signEdge;
      expect(sketchRoute(request).signs, `${seed} edge ${edge}`).toBeUndefined();
    }
  });
});
