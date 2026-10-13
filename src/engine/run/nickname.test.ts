import { describe, expect, it } from 'vitest';
import { createRun, type RunState } from './state';
import { createRunPokemon } from './progression';
import { NICKNAME_MAX_LENGTH, normalizeNickname, renameMember } from './nickname';

const starter = createRunPokemon({
  id: 'p0',
  speciesId: 'charmander',
  level: 5,
  moves: ['ember', 'scratch'],
  heldItem: 'charcoal',
});

function runWith(): RunState {
  const boxed = {
    ...createRunPokemon({ id: 'b0', speciesId: 'sentret', level: 3 }),
    caughtAt: { biomeId: 'forest', mapIndex: 2, routeInMap: 1 },
  };
  return { ...createRun({ seed: 'nick-a', starter }), box: [boxed] };
}

describe('normalizeNickname', () => {
  it('keeps a plain name, trims it and collapses whitespace runs', () => {
    expect(normalizeNickname('Sparky')).toBe('Sparky');
    expect(normalizeNickname('  Sparky  ')).toBe('Sparky');
    expect(normalizeNickname('Bad\tName')).toBe('Bad Name');
    expect(normalizeNickname('a\nb')).toBe('a b');
    expect(normalizeNickname('a  \t b')).toBe('a b');
  });

  it('reads an empty or blank name as "no nickname"', () => {
    expect(normalizeNickname('')).toBeNull();
    expect(normalizeNickname('   ')).toBeNull();
    expect(normalizeNickname('\n')).toBeNull();
  });

  it('truncates to twelve code points', () => {
    expect(normalizeNickname('ABCDEFGHIJKLMNOP')).toBe('ABCDEFGHIJKL');
    expect(NICKNAME_MAX_LENGTH).toBe(12);
  });

  it('never cuts a surrogate pair in half', () => {
    const thirteen = '😀'.repeat(13);
    const twelve = normalizeNickname(thirteen);
    expect(twelve).toBe('😀'.repeat(12));
    expect(Array.from(twelve ?? '')).toHaveLength(12);
    for (const point of twelve ?? '') {
      expect(point.codePointAt(0)).toBeGreaterThan(0xffff);
    }
  });
});

describe('renameMember', () => {
  it('names a party member, keeping every other field', () => {
    const run = runWith();
    const before = run.party[0].fighter;
    const next = renameMember(run, 'p0', 'Sparky');
    const after = next.party[0].fighter;
    expect(after.nickname).toBe('Sparky');
    expect(after.level).toBe(before.level);
    expect(after.hp).toBe(before.hp);
    expect(after.heldItem).toBe('charcoal');
    expect(after.moves).toEqual(before.moves);
    expect(next.box).toBe(run.box);
  });

  it('names a box member and keeps its catch location', () => {
    const run = runWith();
    const next = renameMember(run, 'b0', 'Buddy');
    expect(next.box[0].fighter.nickname).toBe('Buddy');
    expect(next.box[0].caughtAt).toEqual({ biomeId: 'forest', mapIndex: 2, routeInMap: 1 });
    expect(next.party).toBe(run.party);
  });

  it('sanitises on the way in', () => {
    expect(renameMember(runWith(), 'p0', '  Sparky  ').party[0].fighter.nickname).toBe('Sparky');
    expect(renameMember(runWith(), 'p0', 'ABCDEFGHIJKLMNOP').party[0].fighter.nickname).toBe(
      'ABCDEFGHIJKL',
    );
  });

  it('clears the name with null, dropping the field rather than storing an empty one', () => {
    const named = renameMember(runWith(), 'p0', 'Sparky');
    const cleared = renameMember(named, 'p0', null);
    expect('nickname' in cleared.party[0].fighter).toBe(false);
    expect(renameMember(named, 'p0', '   ').party[0].fighter.nickname).toBeUndefined();
  });

  it('refuses a name that only repeats the species name, case-insensitively', () => {
    expect('nickname' in renameMember(runWith(), 'p0', 'charmander').party[0].fighter).toBe(false);
    expect('nickname' in renameMember(runWith(), 'b0', 'SENTRET').box[0].fighter).toBe(false);
    const named = renameMember(runWith(), 'p0', 'Sparky');
    expect('nickname' in renameMember(named, 'p0', 'Charmander').party[0].fighter).toBe(false);
  });

  it('is a miss for an unknown member, leaving the run object alone', () => {
    const run = runWith();
    expect(renameMember(run, 'nobody', 'Sparky')).toBe(run);
  });

  it('returns the same RunState when nothing changed', () => {
    const run = runWith();
    expect(renameMember(run, 'p0', null)).toBe(run);
    expect(renameMember(run, 'p0', 'charmander')).toBe(run);
    const named = renameMember(run, 'p0', 'Sparky');
    expect(renameMember(named, 'p0', 'Sparky')).toBe(named);
    expect(renameMember(named, 'p0', '  Sparky ')).toBe(named);
  });
});
