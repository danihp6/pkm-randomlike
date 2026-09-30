import { describe, expect, it } from 'vitest';
import { createRunPokemon } from './progression';
import { encodeRunShare, decodeRunShare, RUN_SHARE_PREFIX, RUN_SHARE_VERSION } from './share';
import { createRun } from './state';

const SEEDS = [
  '1a2b3c',
  'daily-2026-09-30',
  'a seed with spaces',
  'PKRL-like-but-not',
  'ünïcode-✓',
  'x'.repeat(80),
  '100%',
  '+plus&and=equals',
];

describe('encodeRunShare', () => {
  it('stamps the prefix, the version and the mode letter', () => {
    expect(encodeRunShare({ seed: '1a2b3c', mode: 'finite' })).toBe(
      `${RUN_SHARE_PREFIX}-${RUN_SHARE_VERSION}-f-1a2b3c`,
    );
    expect(encodeRunShare({ seed: '1a2b3c', mode: 'infinite' })).toBe(
      `${RUN_SHARE_PREFIX}-${RUN_SHARE_VERSION}-i-1a2b3c`,
    );
  });

  it('escapes a hyphen in the seed so the fields stay separable', () => {
    expect(encodeRunShare({ seed: 'daily-2026-09-30', mode: 'finite' })).toBe('PKRL-1-f-daily%2D2026%2D09%2D30');
  });

  it('takes a whole run as well as a bare share', () => {
    const run = createRun({
      seed: 'abc',
      starter: createRunPokemon({ id: 'starter', speciesId: 'charmander', level: 5, moves: ['scratch'] }),
      mode: 'infinite',
    });
    expect(encodeRunShare(run)).toBe(encodeRunShare({ seed: run.seed, mode: run.mode }));
  });
});

describe('decodeRunShare', () => {
  it('round-trips every seed, both modes', () => {
    for (const seed of SEEDS) {
      for (const mode of ['finite', 'infinite'] as const) {
        expect(decodeRunShare(encodeRunShare({ seed, mode }))).toEqual({ seed, mode });
      }
    }
  });

  it('reads a bare seed as the seed itself', () => {
    expect(decodeRunShare('my seed')).toEqual({ seed: 'my seed', mode: 'finite' });
    expect(decodeRunShare('my seed', 'infinite')).toEqual({ seed: 'my seed', mode: 'infinite' });
  });

  it('trims the surrounding whitespace of a typed string', () => {
    expect(decodeRunShare('  abc  ')).toEqual({ seed: 'abc', mode: 'finite' });
    expect(decodeRunShare('  PKRL-1-i-abc\n')).toEqual({ seed: 'abc', mode: 'infinite' });
  });

  it('accepts a lower-case prefix and mode word', () => {
    expect(decodeRunShare('pkrl-1-i-abc')).toEqual({ seed: 'abc', mode: 'infinite' });
    expect(decodeRunShare('PkRl-1-FINITE-abc')).toEqual({ seed: 'abc', mode: 'finite' });
  });

  it('keeps a hand-typed hyphen inside a prefixed seed', () => {
    expect(decodeRunShare('PKRL-1-f-my-seed')).toEqual({ seed: 'my-seed', mode: 'finite' });
  });

  it('rejects an unknown version, an unknown mode and a missing seed', () => {
    expect(decodeRunShare('PKRL-2-f-abc')).toBeNull();
    expect(decodeRunShare('PKRL-1-x-abc')).toBeNull();
    expect(decodeRunShare('PKRL-1-f')).toBeNull();
    expect(decodeRunShare('PKRL-1-f-')).toBeNull();
    expect(decodeRunShare('PKRL-1-f-%zz')).toBeNull();
    expect(decodeRunShare('')).toBeNull();
    expect(decodeRunShare('   ')).toBeNull();
  });

  it('does not mistake a seed that merely starts like the prefix', () => {
    expect(decodeRunShare('PKRLX')).toEqual({ seed: 'PKRLX', mode: 'finite' });
  });

  it('reproduces the same run from a shared string', () => {
    const a = createRun({
      seed: 'shared-seed',
      starter: createRunPokemon({ id: 'starter', speciesId: 'squirtle', level: 5, moves: ['tackle'] }),
      mode: 'infinite',
    });
    const decoded = decodeRunShare(encodeRunShare(a));
    expect(decoded).not.toBeNull();
    const b = createRun({
      ...decoded!,
      starter: createRunPokemon({ id: 'starter', speciesId: 'squirtle', level: 5, moves: ['tackle'] }),
    });
    expect(b.seed).toBe(a.seed);
    expect(b.mode).toBe(a.mode);
  });
});
