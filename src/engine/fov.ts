import type { Tile } from './grid';
import { WALL, type TileMap } from './map';

type Octant = readonly [number, number, number, number];

const OCTANTS: readonly Octant[] = [
  [1, 0, 0, 1],
  [0, 1, 1, 0],
  [0, -1, 1, 0],
  [-1, 0, 0, 1],
  [-1, 0, 0, -1],
  [0, -1, -1, 0],
  [0, 1, -1, 0],
  [1, 0, 0, -1],
];

function isOpaque(map: TileMap, x: number, y: number): boolean {
  if (y < 0 || y >= map.length) return true;
  const row = map[y];
  if (x < 0 || x >= row.length) return true;
  return row[x] === WALL;
}

function castLight(
  map: TileMap,
  cx: number,
  cy: number,
  row: number,
  start: number,
  end: number,
  radius: number,
  octant: Octant,
  visible: Set<string>,
): void {
  if (start < end) return;
  const [xx, xy, yx, yy] = octant;
  const radius2 = radius * radius;
  let newStart = 0;
  for (let i = row; i <= radius; i++) {
    const dy = -i;
    let blocked = false;
    for (let dx = -i; dx <= 0; dx++) {
      const X = cx + dx * xx + dy * xy;
      const Y = cy + dx * yx + dy * yy;
      const lSlope = (dx - 0.5) / (dy + 0.5);
      const rSlope = (dx + 0.5) / (dy - 0.5);
      if (start < rSlope) continue;
      if (end > lSlope) break;
      if (dx * dx + dy * dy < radius2) {
        visible.add(`${X},${Y}`);
      }
      if (blocked) {
        if (isOpaque(map, X, Y)) {
          newStart = rSlope;
          continue;
        }
        blocked = false;
        start = newStart;
      } else if (isOpaque(map, X, Y)) {
        blocked = true;
        castLight(map, cx, cy, i + 1, start, lSlope, radius, octant, visible);
        newStart = rSlope;
      }
    }
    if (blocked) break;
  }
}

export function computeFov(map: TileMap, origin: Tile, radius: number): Set<string> {
  const visible = new Set<string>([`${origin.x},${origin.y}`]);
  for (const octant of OCTANTS) {
    castLight(map, origin.x, origin.y, 1, 1, 0, radius, octant, visible);
  }
  return visible;
}
