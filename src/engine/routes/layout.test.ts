import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUT, LAYOUTS, isLayoutStyle } from './layout';

describe('layout registry', () => {
  it('covers every style and keeps the default among them', () => {
    expect(Object.keys(LAYOUTS).sort()).toEqual(['forest']);
    expect(LAYOUTS[DEFAULT_LAYOUT]).toBeDefined();
  });

  it('declares opposite entry and exit edges for every style', () => {
    for (const spec of Object.values(LAYOUTS)) {
      expect(spec.startEdge).not.toBe(spec.exitEdge);
      expect(spec.pathWidth).toBeGreaterThanOrEqual(1);
    }
  });

  it('recognises only the declared styles', () => {
    expect(isLayoutStyle('forest')).toBe(true);
    expect(isLayoutStyle('route')).toBe(false);
    expect(isLayoutStyle('cavern')).toBe(false);
    expect(isLayoutStyle(undefined)).toBe(false);
  });
});
