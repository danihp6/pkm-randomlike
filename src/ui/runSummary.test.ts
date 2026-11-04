import { describe, expect, it } from 'vitest';
import { biomeForRoute } from '../data/biomes';
import { nodeKey } from '../engine/region/plan';
import { createRun, createRunPokemon, runNode, type RunState, type RunStats } from '../engine/run';
import { en, es } from '../i18n';
import {
  RUN_SUMMARY_EM_DASH,
  recordedCount,
  runPositionLabel,
  runSummary,
  runSummaryLines,
} from './runSummary';

const starter = createRunPokemon({
  id: 'starter',
  speciesId: 'charmander',
  level: 5,
  moves: ['scratch'],
});

/** The nodes a run that walked `routes` main routes has entered, in order. */
function routeChain(routes: number): string[] {
  const keys: string[] = [nodeKey('town', 1)];
  for (let index = 1; index <= routes; index += 1) {
    keys.push(nodeKey('route', index));
    if (index < routes) keys.push(nodeKey('city', index));
  }
  return keys;
}

/** A run whose visited nodes hold `routes` route-kind nodes. */
function run(
  routes: number,
  stats: RunStats = { catches: 0, casualties: 0 },
  seed = 'seed-1',
): RunState {
  const visitedNodes = routeChain(routes);
  return {
    ...createRun({ seed, starter }),
    nodeKey: visitedNodes[visitedNodes.length - 1],
    visitedNodes,
    stats,
  };
}

/** A run standing on the route of `badge`. */
function onBadge(badge: number, seed = 'seed-1'): RunState {
  return { ...createRun({ seed, starter }), nodeKey: nodeKey('route', badge) };
}

describe('runSummary', () => {
  it('counts the routes cleared before a lost route', () => {
    expect(runSummary(run(3), false).routesCleared).toBe(2);
  });

  it('counts the final route as cleared on a win', () => {
    expect(runSummary(run(9), true).routesCleared).toBe(9);
  });

  it('never reports a negative count when the first route is lost', () => {
    expect(runSummary(run(1), false).routesCleared).toBe(0);
  });

  it('carries the seed and the run counters', () => {
    const summary = runSummary(run(4, { catches: 3, casualties: 2 }, 'abc-def'), false);
    expect(summary.seed).toBe('abc-def');
    expect(summary.catches).toBe(3);
    expect(summary.casualties).toBe(2);
  });

  it('also carries the share string that starts the run again', () => {
    expect(runSummary(run(1, { catches: 0, casualties: 0 }, 'abc'), false).share).toBe('PKRL-1-f-abc');
  });

  it('carries the enemies the run fainted, and a recorded zero as zero', () => {
    expect(runSummary(run(2, { catches: 1, casualties: 0, faints: 23 }), false).faints).toBe(23);
    expect(runSummary(run(2, { catches: 1, casualties: 0, faints: 0 }), false).faints).toBe(0);
  });

  it('reports no faint figure for a run that never recorded one', () => {
    expect(runSummary(run(2), false).faints).toBeNull();
    expect(runSummary(run(2, { catches: 1, casualties: 0 }), false).faints).toBeNull();
    expect(runSummary(run(2, { catches: 1, casualties: 0, faints: NaN }), false).faints).toBeNull();
    expect(runSummary(run(2, { catches: 1, casualties: 0, faints: Infinity }), false).faints).toBeNull();
  });
});

describe('recordedCount', () => {
  it('reads a recorded zero as zero and never as unknown', () => {
    expect(recordedCount(0)).toBe(0);
  });

  it('truncates toward zero and clamps at zero', () => {
    expect(recordedCount(7.9)).toBe(7);
    expect(recordedCount(-4)).toBe(0);
    expect(recordedCount(-0.5)).toBe(0);
  });

  it('reads undefined, NaN and Infinity as unrecorded', () => {
    expect(recordedCount(undefined)).toBeNull();
    expect(recordedCount(NaN)).toBeNull();
    expect(recordedCount(Infinity)).toBeNull();
    expect(recordedCount(-Infinity)).toBeNull();
  });
});

describe('runSummaryLines', () => {
  it('names the loss and shows the score', () => {
    const lines = runSummaryLines(runSummary(run(2, { catches: 1, casualties: 1 }, 'abc'), false));
    expect(lines[0]).toBe('You have no more Pokémon!');
    expect(lines).toContain('Routes cleared: 1');
    expect(lines).toContain('Pokémon caught: 1');
    expect(lines).toContain(`Pokémon lost: 1 · Enemies fainted: ${RUN_SUMMARY_EM_DASH}`);
    expect(lines).toContain('Seed: abc');
    expect(lines).toContain('Share: PKRL-1-f-abc');
  });

  it('turns the same screen into the win message', () => {
    const lines = runSummaryLines(runSummary(run(8, { catches: 5, casualties: 0 }, 'abc'), true));
    expect(lines[0]).toBe('The final route falls. You win!');
    expect(lines).toContain('Routes cleared: 8');
    expect(lines).toContain('Pokémon caught: 5');
    expect(lines).toContain(`Pokémon lost: 0 · Enemies fainted: ${RUN_SUMMARY_EM_DASH}`);
  });

  it('prints the run’s own faint count on the lost line, seven lines in all', () => {
    const lines = runSummaryLines(
      runSummary(run(5, { catches: 9, casualties: 6, faints: 23 }, 'pkm-148'), false),
    );

    expect(lines).toHaveLength(7);
    expect(lines[0]).toBe('You have no more Pokémon!');
    expect(lines[1]).toBe('The run is over — nothing carries over.');
    expect(lines[2]).toBe('Routes cleared: 4');
    expect(lines[3]).toBe('Pokémon caught: 9');
    expect(lines[4]).toBe('Pokémon lost: 6 · Enemies fainted: 23');
    expect(lines[5]).toBe('Seed: pkm-148');
    expect(lines[6]).toBe('Share: PKRL-1-f-pkm%2D148');
  });

  it('keeps the em dash for a run written before the faint counter existed', () => {
    const lines = runSummaryLines(runSummary(run(5, { catches: 9, casualties: 6 }, 'pkm-148'), false));

    expect(lines).toHaveLength(7);
    expect(lines[4]).toBe(`Pokémon lost: 6 · Enemies fainted: ${RUN_SUMMARY_EM_DASH}`);
    expect(lines[4]).toBe('Pokémon lost: 6 · Enemies fainted: \u2014');
  });
});

describe('the run-over copy', () => {
  it('pins the fainted line in both locales with its two tokens', () => {
    expect(en['runOver.lostFainted']).toBe('Pokémon lost: {lost} · Enemies fainted: {fainted}');
    expect(es['runOver.lostFainted']).toBe('Pokémon perdidos: {lost} · Enemigos debilitados: {fainted}');
  });

  it('leaves the TOTALS label where it was', () => {
    expect(en['runOver.enemiesFainted']).toBe('ENEMIES FAINTED');
    expect(es['runOver.enemiesFainted']).toBe('ENEMIGOS DEBILITADOS');
  });
});

describe('runPositionLabel', () => {
  it('names the node’s badge and its biome in the route HUD wording', () => {
    const state = onBadge(3);
    const node = runNode(state);
    const biome = biomeForRoute(node.id);
    expect(node.badge).toBe(3);
    expect(biome.name).toBe('Deep Forest');
    expect(runPositionLabel(state)).toBe(`Map ${node.badge} · ${biome.name}`);
    expect(runPositionLabel(state)).toBe('Map 3 · Deep Forest');
  });

  it('reports no route prefix and no room number', () => {
    const label = runPositionLabel({ ...onBadge(3), visitedNodes: routeChain(7) });
    expect(label).toBe('Map 3 · Deep Forest');
    expect(label).not.toContain('Route');
    expect(label).not.toContain('7');
  });

  it('reads the biome of its own node on the first stretch', () => {
    const state = onBadge(1, 'another-seed');
    expect(runNode(state).badge).toBe(1);
    expect(runPositionLabel(state)).toBe(`Map 1 · ${biomeForRoute(runNode(state).id).name}`);
    expect(runPositionLabel(state)).toBe('Map 1 · Deep Forest');
  });

  it('matches the route HUD title for the same run', () => {
    const state = onBadge(4, 'hud-parity');
    const node = runNode(state);
    expect(runPositionLabel(state)).toBe(`Map ${node.badge} · ${biomeForRoute(node.id).name}`);
  });

  it('answers the same label for the same seed and node', () => {
    expect(runPositionLabel(onBadge(5, 'biome-parity'))).toBe(
      runPositionLabel(onBadge(5, 'biome-parity')),
    );
  });
});
