import { describe, expect, it } from 'vitest';
import { getBiome } from '../data/biomes';
import { biomeForMap } from '../engine/maps/plan';
import { createRun, createRunPokemon, type RunState, type RunStats } from '../engine/run';
import { runPositionLabel, runSummary, runSummaryLines } from './runSummary';

const starter = createRunPokemon({
  id: 'starter',
  speciesId: 'charmander',
  level: 5,
  moves: ['scratch'],
});

function run(
  routeIndex: number,
  stats: RunStats = { catches: 0, casualties: 0 },
  seed = 'seed-1',
): RunState {
  return { ...createRun({ seed, starter }), routeIndex, stats };
}

/** A run standing on the first room of `mapIndex`. */
function onMap(mapIndex: number, seed = 'seed-1'): RunState {
  return { ...createRun({ seed, starter }), mapIndex };
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
});

describe('runSummaryLines', () => {
  it('names the loss and shows the score', () => {
    const lines = runSummaryLines(runSummary(run(2, { catches: 1, casualties: 1 }, 'abc'), false));
    expect(lines[0]).toBe('You have no more Pokémon!');
    expect(lines).toContain('Routes cleared: 1');
    expect(lines).toContain('Pokémon caught: 1');
    expect(lines).toContain('Pokémon lost: 1');
    expect(lines).toContain('Seed: abc');
    expect(lines).toContain('Share: PKRL-1-f-abc');
  });

  it('turns the same screen into the win message', () => {
    const lines = runSummaryLines(runSummary(run(8, { catches: 5, casualties: 0 }, 'abc'), true));
    expect(lines[0]).toBe('The final route falls. You win!');
    expect(lines).toContain('Routes cleared: 8');
    expect(lines).toContain('Pokémon caught: 5');
    expect(lines).toContain('Pokémon lost: 0');
  });
});

describe('runPositionLabel', () => {
  it('names the map and its biome in the route HUD wording', () => {
    const state = onMap(3);
    const biome = getBiome(biomeForMap(state.seed, 3));
    expect(biome.name).toBe('Deep Forest');
    expect(runPositionLabel(state)).toBe(`Map 3 · ${biome.name}`);
    expect(runPositionLabel(state)).toBe('Map 3 · Deep Forest');
  });

  it('reports no route prefix and no room number', () => {
    const label = runPositionLabel({ ...onMap(3), routeIndex: 7, routeInMap: 2 });
    expect(label).toBe('Map 3 · Deep Forest');
    expect(label).not.toContain('Route');
    expect(label).not.toContain('7');
    expect(label).not.toContain('2');
  });

  it('reads the biome of its own map on the first floor', () => {
    const state = onMap(1, 'another-seed');
    expect(state.mapIndex).toBe(1);
    expect(runPositionLabel(state)).toBe(`Map 1 · ${getBiome(biomeForMap(state.seed, 1)).name}`);
    expect(runPositionLabel(state)).toBe('Map 1 · Deep Forest');
  });

  it('matches the route HUD title for the same run', () => {
    const state = onMap(4, 'hud-parity');
    expect(runPositionLabel(state)).toBe(
      `Map ${state.mapIndex} · ${getBiome(biomeForMap(state.seed, state.mapIndex)).name}`,
    );
  });

  it('keeps the biome the map plan rolls', () => {
    const state = onMap(5, 'biome-parity');
    expect(runPositionLabel(state)).toBe(`Map 5 · ${getBiome(biomeForMap(state.seed, 5)).name}`);
  });
});
