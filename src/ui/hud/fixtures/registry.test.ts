import { describe, expect, it } from 'vitest';
import { FIXTURE_MODULES } from './registry';

describe('FIXTURE_MODULES', () => {
  it('is a plain module map, even while design/fixtures/ does not exist', () => {
    expect(typeof FIXTURE_MODULES).toBe('object');
    expect(FIXTURE_MODULES).not.toBeNull();
    expect(Array.isArray(FIXTURE_MODULES)).toBe(false);
    expect(() => Object.keys(FIXTURE_MODULES)).not.toThrow();
  });

  it('keys every entry by a design/fixtures path', () => {
    for (const path of Object.keys(FIXTURE_MODULES)) {
      expect(path, path).toMatch(/design\/fixtures\/[^/]+\.json$/);
    }
  });
});
