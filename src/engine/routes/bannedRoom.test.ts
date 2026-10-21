import { describe, expect, it } from 'vitest';
import { createRun, createRunPokemon, type RunPokemon, type RunState } from '../run';
import { bannedSpeciesOf } from './bannedRoom';

const member = (id: string, speciesId: string, battlesUsed?: number): RunPokemon => {
  const base = createRunPokemon({ id, speciesId, level: 10, moves: ['tackle'] });
  return battlesUsed === undefined ? base : { ...base, battlesUsed };
};

const runWith = (party: readonly RunPokemon[], box: readonly RunPokemon[] = []): RunState => ({
  ...createRun({ seed: 'pkm-101', starter: party[0] ?? member('member-0', 'caterpie') }),
  party,
  box,
});

describe('bannedSpeciesOf', () => {
  it('names the party member with the highest counter', () => {
    const run = runWith([member('a', 'pidgey', 2), member('b', 'geodude', 7), member('c', 'abra', 1)]);
    expect(bannedSpeciesOf(run)).toBe('geodude');
  });

  it('breaks a tie by party order', () => {
    const run = runWith([member('a', 'pidgey', 4), member('b', 'geodude', 4)]);
    expect(bannedSpeciesOf(run)).toBe('pidgey');
  });

  it('reads no absent counter as zero', () => {
    const run = runWith([member('a', 'pidgey'), member('b', 'geodude', 1)]);
    expect(bannedSpeciesOf(run)).toBe('geodude');
  });

  it('never lets a boxed veteran name the ban', () => {
    const run = runWith([member('a', 'pidgey', 1)], [member('z', 'mewtwo', 99)]);
    expect(bannedSpeciesOf(run)).toBe('pidgey');
  });

  it('answers a one-member party with that member’s species', () => {
    expect(bannedSpeciesOf(runWith([member('a', 'caterpie')]))).toBe('caterpie');
  });
});
