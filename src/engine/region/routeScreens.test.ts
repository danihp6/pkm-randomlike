import { describe, expect, it } from 'vitest';
import { isWalkable } from '../map';
import { createRunPokemon } from '../run/progression';
import { createRun } from '../run/state';
import { planNodeContent } from './content';
import { nodeOf, planRegion } from './plan';
import { inPoiRect } from './pois';
import { generateRoute } from './route/map';
import { bandAt, planRouteScreens, screenIndexOf, type RouteScreenPlan } from './routeScreens';
import { travel } from './travel';

const PLAN = planRegion('alpha');

/** The band identity the stack must carry exactly once, whatever screen holds it. */
function bandKey(band: {
  edge: string;
  neighbourKey: string;
  tiles: readonly { x: number; y: number }[];
}): string {
  return `${band.edge}:${band.neighbourKey}:${band.tiles.map((tile) => `${tile.x},${tile.y}`).join('.')}`;
}

/** Every band the stack carries, entry included. */
function stackedBands(screens: readonly RouteScreenPlan[]) {
  return screens.flatMap((screen) =>
    screen.entry === null ? screen.exits : [screen.entry, ...screen.exits],
  );
}

describe('planRouteScreens', () => {
  it('cuts the carve into screens of the region layout, contiguous and total', () => {
    const plan = planRouteScreens(PLAN, 'route:1');
    const map = generateRoute(PLAN, 'route:1');
    expect(plan.screens.length).toBe(map.screens.length);
    expect(plan.screens.length).toBeGreaterThanOrEqual(2);
    expect(plan.screens.length).toBeLessThanOrEqual(4);
    expect(plan.screens[0].top).toBe(0);
    expect(plan.screens[plan.screens.length - 1].bottom).toBe(plan.route.height - 1);
    plan.screens.forEach((screen, index) => {
      expect(screen.index).toBe(index);
      if (index + 1 < plan.screens.length) {
        expect(screen.bottom + 1).toBe(plan.screens[index + 1].top);
      }
    });
  });

  it('spawns every screen on its first row, and screen 0 on the carver entry', () => {
    const plan = planRouteScreens(PLAN, 'route:1');
    for (const screen of plan.screens) {
      expect(screen.spawn.y).toBe(screen.top);
      expect(isWalkable(plan.route.tiles, screen.spawn)).toBe(true);
    }
    expect(plan.screens[0].spawn).toEqual(generateRoute(PLAN, 'route:1').entry);
  });

  it('makes every seam crossable at its spawn column', () => {
    const plan = planRouteScreens(PLAN, 'route:1');
    for (let index = 1; index < plan.screens.length; index++) {
      const screen = plan.screens[index];
      const above = { x: screen.spawn.x, y: screen.top - 1 };
      expect(isWalkable(plan.route.tiles, screen.spawn)).toBe(true);
      expect(isWalkable(plan.route.tiles, above)).toBe(true);
      expect(screen.top - 1).toBe(plan.screens[index - 1].bottom);
    }
  });

  it('reads a row back to its screen, clamped at both ends', () => {
    const plan = planRouteScreens(PLAN, 'route:1');
    const last = plan.screens.length - 1;
    for (const screen of plan.screens) {
      expect(screenIndexOf(plan.screens, screen.top)).toBe(screen.index);
      expect(screenIndexOf(plan.screens, screen.bottom)).toBe(screen.index);
    }
    expect(screenIndexOf(plan.screens, -1)).toBe(0);
    expect(screenIndexOf(plan.screens, plan.route.height + 3)).toBe(last);
  });

  it('carries every band exactly once, and the entry only on screen 0', () => {
    const plan = planRouteScreens(PLAN, 'route:1');
    const stacked = stackedBands(plan.screens).map(bandKey).sort();
    const carved = generateRoute(PLAN, 'route:1').bands.map(bandKey).sort();
    expect(stacked).toEqual(carved);
    plan.screens.forEach((screen) => {
      if (screen.index === 0) expect(screen.entry).not.toBeNull();
      else expect(screen.entry).toBeNull();
    });
  });

  it("pins a forced three-screen geometry on alpha's first route", () => {
    const plan = planRouteScreens(PLAN, 'route:1', 3);
    expect(plan.screens).toHaveLength(3);
    expect(plan.screens[2].top).toBe(80);
    expect(plan.screens[2].bottom).toBe(159);
    const south = plan.route.bands.find((band) => band.edge === 'S');
    const east = plan.route.bands.find((band) => band.edge === 'E');
    const north = plan.route.bands.find((band) => band.edge === 'N');
    expect(south?.neighbourKey).toBe('city:1');
    expect(east?.neighbourKey).toBe('lateral:1');
    expect(north?.neighbourKey).toBe('town:1');
    expect(bandAt(plan.screens, south!.tiles[0])).toBe(south);
    expect(bandAt(plan.screens, east!.tiles[0])).toBe(east);
    expect(plan.screens[0].entry).toBe(north);
    expect(plan.screens[0].spawn).toEqual({ x: 51, y: 0 });
  });

  it('answers the band of any cell, and null off the border', () => {
    const plan = planRouteScreens(PLAN, 'route:1');
    for (const edge of ['N', 'S', 'E'] as const) {
      const band = plan.route.bands.find((candidate) => candidate.edge === edge);
      expect(band).toBeDefined();
      expect(bandAt(plan.screens, band!.tiles[0])).toBe(band);
    }
    expect(bandAt(plan.screens, { x: 0, y: 0 })).toBeNull();
  });

  it('walks a lateral into its terminus: one entry band, no exit, a POI zone', () => {
    const lateral = PLAN.nodes.find((node) => node.kind === 'lateral')!;
    const plan = planRouteScreens(PLAN, lateral.key);
    const last = plan.screens[plan.screens.length - 1];
    for (const screen of plan.screens) {
      expect(screen.exits).toEqual([]);
      if (screen.index > 0) expect(screen.entry).toBeNull();
    }
    expect(plan.screens[0].entry).not.toBeNull();
    expect(plan.poi).not.toBeNull();
    const poi = plan.poi!;
    expect(inPoiRect(poi.rect, poi.marker)).toBe(true);
    expect(poi.marker.y).toBeGreaterThanOrEqual(last.top);
    expect(poi.marker.y).toBeLessThanOrEqual(last.bottom);
    for (const trainer of plan.route.trainers) {
      expect(inPoiRect(poi.rect, trainer.position)).toBe(false);
    }
    for (const item of plan.route.items) {
      expect(inPoiRect(poi.rect, item.position)).toBe(false);
    }
  });

  it('keeps its content off the lane, off the bands and inside its own screen', () => {
    const node = nodeOf(PLAN, 'route:1')!;
    const plan = planRouteScreens(PLAN, 'route:1');
    const content = planNodeContent(PLAN, 'route:1', node.tier ?? 1);
    const spine = new Set(plan.route.spine.map((tile) => `${tile.x},${tile.y}`));
    expect(plan.route.trainers.length).toBeLessThanOrEqual(content.trainers);
    plan.route.trainers.forEach((trainer, index) => {
      expect(isWalkable(plan.route.tiles, trainer.position)).toBe(true);
      expect(spine.has(`${trainer.position.x},${trainer.position.y}`)).toBe(false);
      expect(bandAt(plan.screens, trainer.position)).toBeNull();
      expect(screenIndexOf(plan.screens, trainer.position.y)).toBe(index % plan.screens.length);
      expect(trainer.facing).toBe('N');
    });
    const ids = plan.route.trainers.map((trainer) => trainer.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(plan.route.items.length).toBeLessThanOrEqual(plan.screens.length - 1);
    for (const item of plan.route.items) {
      expect(isWalkable(plan.route.tiles, item.position)).toBe(true);
      expect(screenIndexOf(plan.screens, item.position.y)).toBeGreaterThanOrEqual(1);
    }
  });

  it('replays the same node, and draws a different one for another seed', () => {
    expect(planRouteScreens(PLAN, 'route:1')).toEqual(planRouteScreens(PLAN, 'route:1'));
    expect(planRouteScreens(planRegion('beta'), 'route:1')).not.toEqual(
      planRouteScreens(PLAN, 'route:1'),
    );
  });

  it('agrees with the travel seam on where a walk in lands', () => {
    const starter = createRunPokemon({
      id: 'starter',
      speciesId: 'charmander',
      level: 5,
      moves: ['scratch'],
    });
    const run = createRun({ seed: 'alpha', starter });
    const arrival = travel(PLAN, run, 'route:1', 'walk');
    expect(arrival.ok).toBe(true);
    if (!arrival.ok) return;
    expect(arrival.spawn).toEqual(planRouteScreens(PLAN, 'route:1').screens[0].spawn);
  });

  it('refuses a non-route key and a bad screen count', () => {
    expect(() => planRouteScreens(PLAN, 'city:1')).toThrow(/^not a route node: city:1$/);
    expect(() => planRouteScreens(PLAN, 'route:1', 5 as never)).toThrow(/^bad screen count: 5$/);
  });
});
