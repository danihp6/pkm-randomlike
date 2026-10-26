import type { Tile } from '../grid';
import type { AccessEdge } from './layout';

/**
 * The one static sign a floor draws (`docs/routes-spec.md` §2, `docs/maps-spec.md`
 * §6): the room that links into the boss room carries a sign at that door's mouth,
 * one tile inside the opening's own anchor, so it stands in the lane's mouth off the
 * border band and the lane's other half still lets the door be walked through. It is
 * placed from the plan and no RNG, so it sits in the same cell on every visit and on
 * a reload. Pure: no Phaser, no DOM, no i18n and no storage.
 */

/** The one line a sign says. The scene resolves this key through `t(...)`. */
export const BOSS_SIGN_KEY = 'boss.sign';

/** A static sign: its route cell and the i18n key it says. */
export type RouteSign = Readonly<{ x: number; y: number; text: string }>;

/** The cardinal step from `edge` into the room (N -> y+1, S -> y-1, W -> x+1, E -> x-1). */
export function inwardStep(edge: AccessEdge): Tile {
  switch (edge) {
    case 'N':
      return { x: 0, y: 1 };
    case 'S':
      return { x: 0, y: -1 };
    case 'W':
      return { x: 1, y: 0 };
    case 'E':
      return { x: -1, y: 0 };
  }
}

/**
 * The sign's cell beside one opening: **one tile inward from the opening's own
 * anchor**, so it stands in the lane's mouth, off the border band, and the lane's
 * other half still lets the door be walked through. No RNG.
 */
export function bossSign(edge: AccessEdge, opening: Tile): RouteSign {
  const step = inwardStep(edge);
  return { x: opening.x + step.x, y: opening.y + step.y, text: BOSS_SIGN_KEY };
}
