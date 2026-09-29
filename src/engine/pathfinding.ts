import type { Tile } from './grid';
import { cutsCorner, isWalkable, type TileMap } from './map';

const NEIGHBORS: readonly Tile[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
];

type Node = { key: string; f: number };

class MinHeap {
  private readonly items: Node[] = [];

  get size(): number {
    return this.items.length;
  }

  push(node: Node): void {
    this.items.push(node);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].f <= this.items[i].f) break;
      const tmp = this.items[parent];
      this.items[parent] = this.items[i];
      this.items[i] = tmp;
      i = parent;
    }
  }

  pop(): Node | undefined {
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0 && last !== undefined) {
      this.items[0] = last;
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let smallest = i;
        if (left < this.items.length && this.items[left].f < this.items[smallest].f) smallest = left;
        if (right < this.items.length && this.items[right].f < this.items[smallest].f) smallest = right;
        if (smallest === i) break;
        const tmp = this.items[smallest];
        this.items[smallest] = this.items[i];
        this.items[i] = tmp;
        i = smallest;
      }
    }
    return top;
  }
}

/** Chebyshev distance - admissible for a king-move grid where diagonal steps cost the same as cardinal ones. */
function heuristic(a: Tile, b: Tile): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function findPath(
  map: TileMap,
  start: Tile,
  goal: Tile,
  isBlocked?: (tile: Tile) => boolean,
): Tile[] {
  const startKey = `${start.x},${start.y}`;
  const goalKey = `${goal.x},${goal.y}`;
  if (startKey === goalKey) return [];

  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[startKey, 0]]);
  const open = new MinHeap();
  const closed = new Set<string>();
  open.push({ key: startKey, f: heuristic(start, goal) });

  let found = false;
  while (open.size > 0) {
    const current = open.pop()!;
    if (closed.has(current.key)) continue;
    if (current.key === goalKey) {
      found = true;
      break;
    }
    closed.add(current.key);
    const [cx, cy] = current.key.split(',').map(Number);
    const g = gScore.get(current.key)!;
    for (const offset of NEIGHBORS) {
      const next = { x: cx + offset.x, y: cy + offset.y };
      const nextKey = `${next.x},${next.y}`;
      if (nextKey === startKey) continue;
      if (!isWalkable(map, next)) continue;
      if (cutsCorner(map, { x: cx, y: cy }, offset)) continue;
      if (nextKey !== goalKey && isBlocked?.(next)) continue;
      const tentative = g + 1;
      if (tentative >= (gScore.get(nextKey) ?? Infinity)) continue;
      cameFrom.set(nextKey, current.key);
      gScore.set(nextKey, tentative);
      open.push({ key: nextKey, f: tentative + heuristic(next, goal) });
    }
  }

  if (!found) return [];
  const path: Tile[] = [];
  let current: string | undefined = goalKey;
  while (current !== undefined && current !== startKey) {
    const [x, y] = current.split(',').map(Number);
    path.push({ x, y });
    current = cameFrom.get(current);
  }
  path.reverse();
  return path;
}
