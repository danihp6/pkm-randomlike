import { describe, expect, it } from 'vitest';
import { FLOOR, WALL, tileAt, type TileMap } from '../map';
import { planMap, roomView } from '../maps';
import { borderEdge, exitEdgeAt } from './doors';
import type { AccessEdge } from './layout';
import { sketchRoute } from './sketch';

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
  it('opens the whole gap on every declared edge and nothing else', () => {
    for (const seed of SEEDS) {
      for (let mapIndex = 1; mapIndex <= 3; mapIndex++) {
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
          const openTiles = new Set<string>();
          for (let y = 0; y < route.height; y++) {
            for (let x = 0; x < route.width; x++) {
              const edge = borderEdge({ x, y }, route.width, route.height);
              if (!edge) continue;
              const walkable = tileAt(route.tiles, { x, y }) === FLOOR;
              const label = `${seed} map ${mapIndex} room ${room.id} ${x},${y}`;
              if (walkable && edges.includes(edge)) {
                expect(exitEdgeAt(route.tiles, route.width, route.height, edges, { x, y }), label).toBe(edge);
                openTiles.add(`${x},${y}`);
              } else {
                // A wall, a tip or an edge without an opening never exits.
                expect(exitEdgeAt(route.tiles, route.width, route.height, edges, { x, y }), label).toBeNull();
              }
            }
          }
          // Every declared opening has at least one walkable border cell.
          expect(openTiles.size, `${seed} map ${mapIndex} room ${room.id} openings`).toBeGreaterThan(0);
          for (const opening of view.openings) {
            const onEdge = [...openTiles].some((key) => {
              const [x, y] = key.split(',').map(Number);
              return borderEdge({ x, y }, route.width, route.height) === opening.edge;
            });
            expect(onEdge, `${seed} map ${mapIndex} room ${room.id} edge ${opening.edge}`).toBe(true);
          }
        }
      }
    }
  });
});
