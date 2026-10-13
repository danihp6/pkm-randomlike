import { describe, expect, it } from 'vitest';
import { FLOOR, WALL, tileAt, type TileMap } from '../map';
import { planMap, roomView } from '../maps';
import { borderEdge, exitEdgeAt, openingBandCells } from './doors';
import { SHAPES, type AccessEdge } from './layout';
import { sketchRoute } from './sketch';
import { validateRoute } from './validate';

const SEEDS = ['doors-a', 'doors-b', 'doors-c', 'doors-d'];

describe('borderEdge', () => {
  it('names the border edge of a cell, and null off the border', () => {
    expect(borderEdge({ x: 0, y: 3 }, 8, 8)).toBe('W');
    expect(borderEdge({ x: 7, y: 3 }, 8, 8)).toBe('E');
    expect(borderEdge({ x: 3, y: 0 }, 8, 8)).toBe('N');
    expect(borderEdge({ x: 3, y: 7 }, 8, 8)).toBe('S');
    expect(borderEdge({ x: 4, y: 4 }, 8, 8)).toBeNull();
  });
});

describe('openingBandCells', () => {
  it('lists the lane cross-section from the anchor: +y for W/E, +x for N/S', () => {
    expect(openingBandCells('W', { x: 0, y: 3 }, 8, 8, 2)).toEqual([
      { x: 0, y: 3 },
      { x: 0, y: 4 },
    ]);
    expect(openingBandCells('E', { x: 7, y: 3 }, 8, 8, 2)).toEqual([
      { x: 7, y: 3 },
      { x: 7, y: 4 },
    ]);
    expect(openingBandCells('N', { x: 3, y: 0 }, 8, 8, 2)).toEqual([
      { x: 3, y: 0 },
      { x: 4, y: 0 },
    ]);
    expect(openingBandCells('S', { x: 3, y: 7 }, 8, 8, 2)).toEqual([
      { x: 3, y: 7 },
      { x: 4, y: 7 },
    ]);
  });

  it('returns one cell per lane width', () => {
    expect(openingBandCells('W', { x: 0, y: 3 }, 8, 8, 1)).toEqual([{ x: 0, y: 3 }]);
    expect(openingBandCells('E', { x: 7, y: 3 }, 8, 8, 1)).toEqual([{ x: 7, y: 3 }]);
    expect(openingBandCells('N', { x: 3, y: 0 }, 8, 8, 1)).toEqual([{ x: 3, y: 0 }]);
    expect(openingBandCells('S', { x: 3, y: 7 }, 8, 8, 1)).toEqual([{ x: 3, y: 7 }]);
    expect(openingBandCells('N', { x: 1, y: 0 }, 8, 8, 3)).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
  });

  it('returns the anchor alone when the lane width is below one', () => {
    expect(openingBandCells('W', { x: 0, y: 3 }, 8, 8, 0)).toEqual([{ x: 0, y: 3 }]);
    expect(openingBandCells('E', { x: 7, y: 3 }, 8, 8, -1)).toEqual([{ x: 7, y: 3 }]);
  });

  it('drops a cell past the far corner and keeps the anchor on the ring', () => {
    expect(openingBandCells('W', { x: 0, y: 7 }, 8, 8, 2)).toEqual([{ x: 0, y: 7 }]);
    expect(openingBandCells('E', { x: 7, y: 7 }, 8, 8, 2)).toEqual([{ x: 7, y: 7 }]);
    expect(openingBandCells('N', { x: 7, y: 0 }, 8, 8, 2)).toEqual([{ x: 7, y: 0 }]);
    expect(openingBandCells('S', { x: 7, y: 7 }, 8, 8, 2)).toEqual([{ x: 7, y: 7 }]);
  });
});

describe('exitEdgeAt', () => {
  function map(rows: string[]): TileMap {
    return rows.map((row) => [...row].map((cell) => (cell === '.' ? FLOOR : WALL)));
  }

  it('counts every passable cell of an opening, not just the seeded one', () => {
    // A west wall with a two-cell gap at y 2-3 and a wall cell at y 1.
    const tiles = map([
      '#####',
      '#...#',
      '.##.#',
      '.##.#',
      '#####',
    ]);
    const edges: AccessEdge[] = ['W'];
    expect(exitEdgeAt(tiles, 5, 5, edges, { x: 0, y: 2 })).toBe('W');
    expect(exitEdgeAt(tiles, 5, 5, edges, { x: 0, y: 3 })).toBe('W');
    // A wall cell, even on the opening edge, is not a door.
    expect(exitEdgeAt(tiles, 5, 5, edges, { x: 0, y: 1 })).toBeNull();
    // A border cell of an edge with no opening is not a door.
    expect(exitEdgeAt(tiles, 5, 5, ['E'], { x: 0, y: 2 })).toBeNull();
    // An interior cell is not a door.
    expect(exitEdgeAt(tiles, 5, 5, edges, { x: 2, y: 2 })).toBeNull();
  });

  it('exits only on a step taken toward the border, so a wide gap cannot loop', () => {
    const tiles = map(['#####', '#...#', '.##.#', '.##.#', '#####']);
    const edges: AccessEdge[] = ['W'];
    // Stepping West onto either cell of the gap exits.
    expect(exitEdgeAt(tiles, 5, 5, edges, { x: 0, y: 2 }, 'W')).toBe('W');
    expect(exitEdgeAt(tiles, 5, 5, edges, { x: 0, y: 3 }, 'W')).toBe('W');
    // Walking along the wall onto the other gap cell does not.
    expect(exitEdgeAt(tiles, 5, 5, edges, { x: 0, y: 3 }, 'N')).toBeNull();
    expect(exitEdgeAt(tiles, 5, 5, edges, { x: 0, y: 3 }, 'S')).toBeNull();
  });

  it('reads the raw map, so a tree tip (WALL, walkable only in the movement copy) is not a door', () => {
    // The raw map keeps a border tree as WALL; only the movement map opens tips.
    const raw = map(['###', '#.#', '###']);
    expect(tileAt(raw, { x: 0, y: 1 })).toBe(WALL);
    expect(exitEdgeAt(raw, 3, 3, ['W', 'N'], { x: 0, y: 1 })).toBeNull();
  });
});

describe('exitEdgeAt on real room openings', () => {
  it('opens every declared opening’s whole band and nothing else', () => {
    for (const seed of SEEDS) {
      for (let mapIndex = 1; mapIndex <= 6; mapIndex++) {
        const plan = planMap(seed, mapIndex);
        for (const room of plan.rooms) {
          const view = roomView(plan, room.id, false);
          const route = sketchRoute({
            seed,
            routeIndex: 1,
            biomeId: view.biomeId,
            openings: view.openings,
            width: view.width,
            height: view.height,
          });
          const edges = view.openings.map((opening) => opening.edge);
          const where = `${seed} map ${mapIndex} room ${room.id}`;
          for (let y = 0; y < route.height; y++) {
            for (let x = 0; x < route.width; x++) {
              const edge = borderEdge({ x, y }, route.width, route.height);
              if (!edge) continue;
              const walkable = tileAt(route.tiles, { x, y }) === FLOOR;
              const label = `${where} ${x},${y}`;
              if (walkable && edges.includes(edge)) {
                expect(
                  exitEdgeAt(route.tiles, route.width, route.height, edges, { x, y }),
                  label,
                ).toBe(edge);
              } else {
                // A wall, a tip or an edge without an opening never exits.
                expect(
                  exitEdgeAt(route.tiles, route.width, route.height, edges, { x, y }),
                  label,
                ).toBeNull();
              }
            }
          }
          // Every cell of a declared opening's band is a door, not just one of them.
          const lane = SHAPES[route.shape].pathWidth;
          for (const anchor of [route.entry, ...route.exits]) {
            const edge = borderEdge(anchor, route.width, route.height);
            if (!edge) continue;
            const band = openingBandCells(edge, anchor, route.width, route.height, lane);
            for (const cell of band) {
              const label = `${where} band ${cell.x},${cell.y}`;
              expect(tileAt(route.tiles, cell), label).toBe(FLOOR);
              expect(
                exitEdgeAt(route.tiles, route.width, route.height, edges, cell),
                label,
              ).toBe(edge);
            }
          }
          const validation = validateRoute(route);
          expect(validation.borderBandGaps, `${where} band gaps`).toEqual([]);
          expect(validation.ok, `${where} ok`).toBe(true);
        }
      }
    }
  }, 30_000);
});

describe('the border band of a fixed-seed room', () => {
  it('opens the E band of doors-c map 4 room 3, whose (30,20) was a wall', () => {
    // Frozen on `main` (e4604c0): this room's E opening is seeded at (30,19) and the
    // generator left its band cell (30,20) a WALL, so the two-cell door was one cell
    // wide. The band cell (30,20) is the exact coordinate the fix had to open.
    const seed = 'doors-c';
    const mapIndex = 4;
    const roomId = 3;
    const anchor = { x: 30, y: 19 };
    const plan = planMap(seed, mapIndex);
    const view = roomView(plan, roomId, false);
    const route = sketchRoute({
      seed,
      routeIndex: 1,
      biomeId: view.biomeId,
      openings: view.openings,
      width: view.width,
      height: view.height,
    });
    const edges = view.openings.map((opening) => opening.edge);
    expect(route.width).toBe(31);
    expect(route.height).toBe(30);
    expect(route.shape).toBe('bend');
    expect(borderEdge(anchor, route.width, route.height)).toBe('E');
    expect(route.exits.some((exit) => exit.x === anchor.x && exit.y === anchor.y)).toBe(true);
    const band = openingBandCells('E', anchor, route.width, route.height, SHAPES[route.shape].pathWidth);
    expect(band).toEqual([
      { x: 30, y: 19 },
      { x: 30, y: 20 },
    ]);
    for (const cell of band) {
      const label = `${cell.x},${cell.y}`;
      expect(tileAt(route.tiles, cell), label).toBe(FLOOR);
      expect(exitEdgeAt(route.tiles, route.width, route.height, edges, cell), label).toBe('E');
    }
    expect(validateRoute(route).borderBandGaps).toEqual([]);
  });
});
