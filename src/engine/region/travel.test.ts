import { describe, expect, it } from 'vitest';
import { createRunPokemon } from '../run/progression';
import { compatForNode, createRun, type RunState } from '../run/state';
import { exitGate } from '../run/gates';
import { planCity } from './city';
import { planRegion } from './plan';
import { generateRoute } from './route';
import { canTravel, travel } from './travel';

const SEED = 'task-283';
const PLAN = planRegion(SEED);

const starter = createRunPokemon({
  id: 'starter',
  speciesId: 'charmander',
  level: 5,
  moves: ['scratch'],
});

/** A run standing on `key`, with the compat floor fields that node implies. */
function runAt(key: string, visited: readonly string[], badges: readonly number[] = []): RunState {
  return {
    ...createRun({ seed: SEED, starter }),
    nodeKey: key,
    visitedNodes: visited,
    badges,
    ...compatForNode(SEED, key),
  };
}

/** The Centre-or-laboratory door `docs/region-spec.md` §5 places a flight on. */
function houseDoor(key: string) {
  return planCity(PLAN, key).buildings.find(
    (building) => building.kind === 'centre' || building.kind === 'lab',
  )!.door;
}

describe('travel', () => {
  it('refuses the node the run already stands on, in both modes', () => {
    const run = runAt('town:1', ['town:1']);
    const walk = travel(PLAN, run, 'town:1', 'walk');
    const fly = travel(PLAN, run, 'town:1', 'fly');
    expect(walk).toStrictEqual({ ok: false, reason: 'same-node', badge: null });
    expect(fly).toStrictEqual({ ok: false, reason: 'same-node', badge: null });
    expect(canTravel(PLAN, run, 'town:1', 'walk')).toStrictEqual(walk);
    // A refusal carries no run at all: nothing is cloned and the caller's save is clean.
    expect(Object.keys(walk).sort()).toStrictEqual(['badge', 'ok', 'reason']);
  });

  it('refuses a key the plan does not hold', () => {
    const run = runAt('town:1', ['town:1']);
    expect(travel(PLAN, run, 'nowhere:9', 'walk')).toStrictEqual({
      ok: false,
      reason: 'no-such-node',
      badge: null,
    });
    expect(travel(PLAN, run, 'city:99', 'fly')).toStrictEqual({
      ok: false,
      reason: 'no-such-node',
      badge: null,
    });
  });

  it('walks onto a route at the carver’s own entry', () => {
    const run = runAt('town:1', ['town:1']);
    const result = travel(PLAN, run, 'route:1', 'walk');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.key).toBe('route:1');
    expect(result.mode).toBe('walk');
    expect(result.spawn).toStrictEqual(generateRoute(PLAN, 'route:1').entry);
    expect(result.run.nodeKey).toBe('route:1');
    expect(result.run.visitedNodes).toStrictEqual(['town:1', 'route:1']);
  });

  it('walks onto a city at the settlement’s own spawn and refreshes its compat fields', () => {
    const run = runAt('route:1', ['town:1', 'route:1']);
    const result = travel(PLAN, run, 'city:1', 'walk');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.spawn).toStrictEqual(planCity(PLAN, 'city:1').spawn);
    expect(result.run.nodeKey).toBe('city:1');
    expect(result.run.mapIndex).toBe(compatForNode(SEED, 'city:1').mapIndex);
    expect(result.run.levelCap).toBe(compatForNode(SEED, 'city:1').levelCap);
    expect(result.run.arrivalEdge).toBe(compatForNode(SEED, 'city:1').arrivalEdge);
    expect(result.run.badges).toStrictEqual(run.badges);
    expect(result.run.party).toBe(run.party);
  });

  it('names a visited node once and keeps its first-entry order', () => {
    const town = runAt('town:1', ['town:1']);
    const out = travel(PLAN, town, 'route:1', 'walk');
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const back = travel(PLAN, out.run, 'town:1', 'walk');
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    const again = travel(PLAN, back.run, 'route:1', 'walk');
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.run.visitedNodes).toStrictEqual(['town:1', 'route:1']);
    expect(again.run.visitedNodes.filter((key) => key === 'route:1')).toHaveLength(1);
  });

  it('refuses a walk into a closed gate, naming the badge it asks for', () => {
    const run = runAt('city:1', ['town:1', 'route:1', 'city:1']);
    const gate = exitGate(PLAN, 'city:1', 'route:2', run.badges);
    expect(gate).not.toBeNull();
    expect(gate!.open).toBe(false);
    expect(travel(PLAN, run, 'route:2', 'walk')).toStrictEqual({
      ok: false,
      reason: 'gate',
      badge: gate!.badge,
    });
  });

  it('opens the gate once the badge is held', () => {
    const run = runAt('city:1', ['town:1', 'route:1', 'city:1'], [1]);
    const result = travel(PLAN, run, 'route:2', 'walk');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.spawn).toStrictEqual(generateRoute(PLAN, 'route:2').entry);
    expect(result.run.nodeKey).toBe('route:2');
  });

  it('never gates a step back or an edge that does not exist', () => {
    const forward = runAt('route:2', ['town:1', 'route:1', 'city:1', 'route:2']);
    const back = travel(PLAN, forward, 'city:1', 'walk');
    expect(back).toStrictEqual({
      ok: true,
      run: expect.anything(),
      key: 'city:1',
      spawn: planCity(PLAN, 'city:1').spawn,
      mode: 'walk',
    });

    const city = runAt('city:1', ['town:1', 'route:1', 'city:1']);
    expect(travel(PLAN, city, 'town:1', 'walk')).toStrictEqual({
      ok: false,
      reason: 'not-neighbour',
      badge: null,
    });
    expect(travel(PLAN, city, 'route:1', 'walk').ok).toBe(true);
  });

  it('lands a flight on the town’s laboratory door and a city’s Centre door', () => {
    const run = runAt('city:2', ['town:1', 'route:1', 'city:1', 'route:2', 'city:2']);
    const toTown = travel(PLAN, run, 'town:1', 'fly');
    expect(toTown.ok).toBe(true);
    if (!toTown.ok) return;
    expect(toTown.mode).toBe('fly');
    expect(toTown.spawn).toStrictEqual(houseDoor('town:1'));
    expect(toTown.spawn).toStrictEqual(
      planCity(PLAN, 'town:1').buildings.find((building) => building.kind === 'lab')!.door,
    );

    const toCity = travel(PLAN, run, 'city:1', 'fly');
    expect(toCity.ok).toBe(true);
    if (!toCity.ok) return;
    expect(toCity.spawn).toStrictEqual(houseDoor('city:1'));
    expect(toCity.spawn).toStrictEqual(
      planCity(PLAN, 'city:1').buildings.find((building) => building.kind === 'centre')!.door,
    );
  });

  it('refuses a flight to a settlement it has not visited, and to anything but a settlement', () => {
    const run = runAt('city:2', ['town:1', 'route:1', 'city:1', 'route:2', 'city:2']);
    expect(travel(PLAN, run, 'city:3', 'fly')).toStrictEqual({
      ok: false,
      reason: 'unvisited',
      badge: null,
    });
    expect(travel(PLAN, run, 'route:2', 'fly')).toStrictEqual({
      ok: false,
      reason: 'not-settlement',
      badge: null,
    });
    expect(travel(PLAN, run, 'victory-road:1', 'fly')).toStrictEqual({
      ok: false,
      reason: 'not-settlement',
      badge: null,
    });
  });

  it('flies free to a visited settlement behind a closed gate', () => {
    const run = runAt('city:2', ['town:1', 'route:1', 'city:1', 'route:2', 'city:2']);
    expect(exitGate(PLAN, 'city:1', 'route:2', run.badges)?.open).toBe(false);
    const result = travel(PLAN, run, 'city:1', 'fly');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.run.nodeKey).toBe('city:1');
  });

  it('answers the same travel twice the same way, reading no RNG and no clock', () => {
    const run = runAt('city:2', ['town:1', 'route:1', 'city:1', 'route:2', 'city:2']);
    const first = travel(PLAN, run, 'city:1', 'fly');
    const second = travel(planRegion(SEED), run, 'city:1', 'fly');
    expect(second).toStrictEqual(first);
    expect(travel(PLAN, run, 'town:1', 'walk')).toStrictEqual(travel(PLAN, run, 'town:1', 'walk'));
    expect(canTravel(PLAN, run, 'route:2', 'fly')).toStrictEqual(travel(PLAN, run, 'route:2', 'fly'));
  });
});
