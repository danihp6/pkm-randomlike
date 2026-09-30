import { describe, expect, it } from 'vitest';
import { createRun, createRunPokemon, type RunState, type RunStats } from '../engine/run';
import { runSummary, runSummaryLines } from './runSummary';

const starter = createRunPokemon({ id: 'starter', speciesId: 'charmander', level: 5, moves: ['scratch'] });

function run(routeIndex: number, stats: RunStats = { catches: 0, casualties: 0 }, seed = 'seed-1'): RunState {
  return { ...createRun({ seed, starter }), routeIndex, stats };
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
});

describe('runSummaryLines', () => {
  it('names the loss and shows the score', () => {
    const lines = runSummaryLines(runSummary(run(2, { catches: 1, casualties: 1 }, 'abc'), false));
    expect(lines[0]).toBe('You have no more Pokémon!');
    expect(lines).toContain('Routes cleared: 1');
    expect(lines).toContain('Pokémon caught: 1');
    expect(lines).toContain('Pokémon lost: 1');
    expect(lines).toContain('Seed: abc');
  });

  it('turns the same screen into the win message', () => {
    const lines = runSummaryLines(runSummary(run(8, { catches: 5, casualties: 0 }, 'abc'), true));
    expect(lines[0]).toBe('The final route falls. You win!');
    expect(lines).toContain('Routes cleared: 8');
    expect(lines).toContain('Pokémon caught: 5');
    expect(lines).toContain('Pokémon lost: 0');
  });
});
