import { hashSeed, Rng } from '../rng';

/**
 * The per-pass RNG streams a route build reads from (`docs/route-generator.md`
 * §0). Each pass owns its own `Rng`, so adding or removing a roll in one pass can
 * never shift the values another pass draws: a fixed-seed regression test then
 * only fails where the behaviour really changed.
 *
 * `populate` is declared even while the population pass is off, so the stream
 * structure stays stable for when trainers and items return (Phase 2 steps 6-7).
 */
export type RouteStreams = Readonly<{
  layout: Rng;
  terrain: Rng;
  populate: Rng;
}>;

export type RouteStreamPass = keyof RouteStreams;

/**
 * Derives one independent `Rng` per build pass from `(seed, routeIndex, attempt)`.
 * The attempt is part of every stream key, so a reroll is a new deterministic map,
 * never a mutation of the previous one (D11).
 */
export function routeStreams(seed: string, routeIndex: number, attempt: number): RouteStreams {
  const base = `${seed}:route:${routeIndex}:${attempt}`;
  return {
    layout: new Rng(hashSeed(`${base}:layout`)),
    terrain: new Rng(hashSeed(`${base}:terrain`)),
    populate: new Rng(hashSeed(`${base}:populate`)),
  };
}
