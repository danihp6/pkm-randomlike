import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LAYOUT,
  DEFAULT_SHAPE,
  LAYOUTS,
  ROUTE_SHAPES,
  SHAPES,
  entryAccess,
  entryIndex,
  isLayoutStyle,
  isRouteShape,
  linksForEdges,
  shapeForEdges,
  specForOpenings,
  type ShapeSpec,
} from './layout';

describe('layout registry', () => {
  it('covers every style and keeps the default among them', () => {
    expect(Object.keys(LAYOUTS).sort()).toEqual(['forest']);
    expect(LAYOUTS[DEFAULT_LAYOUT]).toBeDefined();
  });

  it('recognises only the declared styles', () => {
    expect(isLayoutStyle('forest')).toBe(true);
    expect(isLayoutStyle('route')).toBe(false);
    expect(isLayoutStyle('cavern')).toBe(false);
    expect(isLayoutStyle(undefined)).toBe(false);
  });
});

describe('shape registry', () => {
  it('covers every shape and keeps the default among them', () => {
    expect(Object.keys(SHAPES).sort()).toEqual([...ROUTE_SHAPES].sort());
    expect(SHAPES[DEFAULT_SHAPE]).toBeDefined();
  });

  it('recognises only the declared shapes', () => {
    expect(isRouteShape('straight')).toBe(true);
    expect(isRouteShape('bend')).toBe(true);
    expect(isRouteShape('cross')).toBe(true);
    expect(isRouteShape('dead-end')).toBe(true);
    expect(isRouteShape('corridor')).toBe(true);
    expect(isRouteShape('tee')).toBe(true);
    expect(isRouteShape('forest')).toBe(false);
    expect(isRouteShape(undefined)).toBe(false);
  });

  it('declares exactly one entry and valid links for every shape', () => {
    for (const [name, spec] of Object.entries(SHAPES) as [string, ShapeSpec][]) {
      const entries = spec.openings.filter((opening) => opening.role === 'entry');
      expect(entries, name).toHaveLength(1);
      expect(spec.openings.length, name).toBeGreaterThanOrEqual(1);
      const entry = entryIndex(spec);
      expect(entryAccess(spec), name).toBe(spec.openings[entry]);
      if (spec.openings.length === 1) {
        // A dead-end has nothing to link to.
        expect(spec.links, name).toHaveLength(0);
      } else {
        expect(spec.links.length, name).toBeGreaterThanOrEqual(1);
        expect(
          spec.links.some((pair) => pair.includes(entry)),
          `${name} joins its entry`,
        ).toBe(true);
      }
      for (const [a, b] of spec.links) {
        expect(a, name).toBeGreaterThanOrEqual(0);
        expect(b, name).toBeGreaterThanOrEqual(0);
        expect(a, name).toBeLessThan(spec.openings.length);
        expect(b, name).toBeLessThan(spec.openings.length);
        expect(a, name).not.toBe(b);
      }
      expect(spec.pathWidth, name).toBeGreaterThanOrEqual(1);
      expect(spec.jitter, name).toBeGreaterThanOrEqual(0);
      expect(spec.branchCount, name).toBeGreaterThanOrEqual(0);
      expect(spec.branchMin, name).toBeLessThanOrEqual(spec.branchMax);
    }
  });

  it('matches the blueprint: opposite for straight, adjacent for bend, both axes for cross', () => {
    const edges = (shape: keyof typeof SHAPES): string[] =>
      SHAPES[shape].openings.map((opening) => opening.edge);
    expect(edges('straight')).toEqual(['W', 'E']);
    expect(edges('bend')).toEqual(['W', 'N']);
    expect(edges('cross')).toEqual(['W', 'E', 'N', 'S']);
    expect(SHAPES.cross.links).toHaveLength(2);
  });
});

describe('opening sets', () => {
  it('names the shape an opening set reads as', () => {
    expect(shapeForEdges(['W'])).toBe('dead-end');
    expect(shapeForEdges(['W', 'E'])).toBe('corridor');
    expect(shapeForEdges(['N', 'S'])).toBe('corridor');
    expect(shapeForEdges(['W', 'N'])).toBe('bend');
    expect(shapeForEdges(['W', 'E', 'N'])).toBe('tee');
    expect(shapeForEdges(['W', 'E', 'N', 'S'])).toBe('cross');
    expect(() => shapeForEdges([])).toThrow();
  });

  it('links an opening set so every opening is joined', () => {
    expect(linksForEdges(['W'])).toEqual([]);
    expect(linksForEdges(['W', 'E'])).toEqual([[0, 1]]);
    expect(linksForEdges(['W', 'N', 'S'])).toEqual([
      [0, 1],
      [0, 2],
    ]);
    // A cross pairs each opening with its opposite, whatever the edge order.
    expect(linksForEdges(['N', 'E', 'S', 'W'])).toEqual([
      [0, 2],
      [1, 3],
    ]);
  });

  it('builds a spec from the actual edges, keeping the template feel', () => {
    const spec = specForOpenings([
      { edge: 'N', role: 'entry' },
      { edge: 'S', role: 'exit' },
    ]);
    expect(spec.openings.map((opening) => opening.edge)).toEqual(['N', 'S']);
    expect(spec.links).toEqual([[0, 1]]);
    expect(spec).toMatchObject({ pathWidth: SHAPES.corridor.pathWidth, branchCount: 0 });
  });
});
