import type { Tile } from './grid';
import { computeFov } from './fov';
import type { TileMap } from './map';

/**
 * Fog of war: `visible` is what the player sees right now, `explored` is
 * everything seen at least once. `revision` bumps on every recompute so a
 * renderer can cache its per-tile fog state without diffing the sets.
 */
export class Vision {
  readonly visible = new Set<string>();
  readonly explored = new Set<string>();
  revision = 0;
  private readonly radius: number;

  constructor(radius: number) {
    this.radius = radius;
  }

  recompute(map: TileMap, origin: Tile): void {
    this.visible.clear();
    for (const key of computeFov(map, origin, this.radius)) {
      this.visible.add(key);
      this.explored.add(key);
    }
    this.revision++;
  }
}
