import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => {
  class Scene {
    constructor(_key?: string) {}
  }
  return {
    default: {
      Scene,
      Scenes: { Events: { SHUTDOWN: 'shutdown' } },
      Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'camerafadeoutcomplete' } } },
      Input: { Keyboard: { KeyCodes: {} } },
    },
  };
});

import { cutsCorner, mapFromSketch, type TileMap } from '../engine/map';
import { planCity } from '../engine/region/city/plan';
import { nodeOf, planRegion } from '../engine/region/plan';
import { doorAt, exitBandAt, interiorSceneKey } from './CityScene';
import { canWalkStep } from './walker';

const SEED = 'alpha';

/** A street with one door, so a wall, a path and a door sit on one map. */
const STREET: TileMap = mapFromSketch(['#######', '#PPDPP#', '#P.P.P#', '#P.P.P#', '#######']);

/** The corner-cut geometry from (1, 1): the diagonal's east flank is a wall. */
const PINCH: TileMap = mapFromSketch(['#####', '#P#.#', '#P#.#', '#####']);

/** The same geometry with both flanks open. */
const OPEN: TileMap = mapFromSketch(['#####', '#PPP#', '#PPP#', '#####']);

function city(key = 'city:1') {
  const plan = planRegion(SEED);
  const node = nodeOf(plan, key);
  expect(node).toBeDefined();
  return planCity(plan, key);
}

describe('canWalkStep', () => {
  it('allows the walkable vocabulary: path, floor, door and plaza', () => {
    expect(canWalkStep(STREET, { x: 1, y: 1 }, 'right')).toBe(true);
    expect(canWalkStep(STREET, { x: 3, y: 2 }, 'up')).toBe(true);
    expect(canWalkStep(STREET, { x: 2, y: 1 }, 'right')).toBe(true);
  });

  it("refuses a wall cell and the map's own edge", () => {
    expect(canWalkStep(STREET, { x: 1, y: 2 }, 'left')).toBe(false);
    expect(canWalkStep(STREET, { x: 1, y: 1 }, 'up')).toBe(false);
    expect(canWalkStep(STREET, { x: 0, y: 1 }, 'left')).toBe(false);
  });

  it('reads the corner a diagonal would cut, and refuses the step into its wall', () => {
    expect(cutsCorner(PINCH, { x: 1, y: 1 }, { x: 1, y: 1 })).toBe(true);
    expect(canWalkStep(PINCH, { x: 1, y: 1 }, 'right')).toBe(false);
    expect(canWalkStep(PINCH, { x: 1, y: 1 }, 'down')).toBe(true);
    // Both flanks open is no corner at all, so both orthogonal steps are free.
    expect(cutsCorner(OPEN, { x: 1, y: 1 }, { x: 1, y: 1 })).toBe(false);
    expect(canWalkStep(OPEN, { x: 1, y: 1 }, 'right')).toBe(true);
    expect(canWalkStep(OPEN, { x: 1, y: 1 }, 'down')).toBe(true);
  });
});

describe('doorAt', () => {
  it('finds exactly the building whose door the tile is, at every door of city:1', () => {
    const settlement = city();
    for (const building of settlement.buildings) {
      expect(doorAt(settlement, building.door)).toBe(building);
    }
  });

  it('answers null on a street tile', () => {
    const settlement = city();
    expect(doorAt(settlement, settlement.spawn)).toBeNull();
    for (const building of settlement.buildings) {
      expect(doorAt(settlement, { x: building.door.x, y: building.door.y - 1 })).toBeNull();
    }
  });
});

describe('exitBandAt', () => {
  it('maps every band tile back to its own neighbour', () => {
    const settlement = city();
    expect(settlement.exits.length).toBeGreaterThan(0);
    for (const band of settlement.exits) {
      for (const tile of band.tiles) {
        expect(exitBandAt(settlement, tile)).toBe(band);
      }
    }
  });

  it('answers null in the plaza', () => {
    expect(exitBandAt(city(), city().spawn)).toBeNull();
  });
});

describe('interiorSceneKey', () => {
  it('names the scene a door opens', () => {
    expect(interiorSceneKey('centre')).toBe('Centre');
    expect(interiorSceneKey('gym')).toBe('Gym');
    expect(interiorSceneKey('lab')).toBe('Lab');
    expect(interiorSceneKey('casino')).toBe('Casino');
    expect(interiorSceneKey('house:2')).toBe('House');
    expect(interiorSceneKey('house')).toBe('House');
  });

  it('is stable for a repeated key', () => {
    expect(interiorSceneKey('house:11')).toBe(interiorSceneKey('house:11'));
  });
});
