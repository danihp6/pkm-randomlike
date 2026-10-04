import { RUN_CHAIN } from '../../data/run';
import type { RunMode } from './state';

export type RouteKind = 'route' | 'miniboss' | 'boss' | 'final';

/**
 * What a route index plays as, from the cadence in `docs/routes-spec.md` §4.
 * `kind` is what the route *is*: a regular route, the mini-boss that lands every
 * `minibossEvery` routes, the boss closing each `bossBlock`, or the finite run's
 * final boss. `block`/`slot` locate the route inside that cadence.
 */
export type RouteStage = Readonly<{
  index: number;
  kind: RouteKind;
  /** 1-based block this route belongs to (`bossBlock` routes each). */
  block: number;
  /** 1-based position inside the block, from `1` to `bossBlock`. */
  slot: number;
  /** True for the last route of a finite run; always false in infinite mode. */
  isFinal: boolean;
  /** True when the route fields a mini-boss, a boss or the final boss. */
  isBoss: boolean;
}>;

/** The number of routes in the chain: fixed for a finite run, unbounded otherwise. */
export function chainLength(mode: RunMode): number {
  return mode === 'finite' ? RUN_CHAIN.finiteLength : Number.POSITIVE_INFINITY;
}

/**
 * The stage for a route index (1-based, clamped). A finite run's final route is
 * `final` even when it also lands on a boss slot, so the last beat always reads
 * as the end of the chain; infinite mode reuses the same cadence without the
 * finish line, so the boss slot is a plain boss.
 */
export function routeStage(routeIndex: number, mode: RunMode = 'finite'): RouteStage {
  const index = Math.max(1, Math.floor(routeIndex));
  const block = Math.floor((index - 1) / RUN_CHAIN.bossBlock) + 1;
  const slot = index - (block - 1) * RUN_CHAIN.bossBlock;
  const isFinal = mode === 'finite' && index >= RUN_CHAIN.finiteLength;
  const kind = kindFor(index, slot, isFinal);
  return { index, kind, block, slot, isFinal, isBoss: kind !== 'route' };
}

function kindFor(index: number, slot: number, isFinal: boolean): RouteKind {
  if (isFinal) return 'final';
  if (slot === RUN_CHAIN.bossBlock) return 'boss';
  if (index % RUN_CHAIN.minibossEvery === 0) return 'miniboss';
  return 'route';
}

/** True when clearing this route wins a finite run (it is the final boss). */
export function isFinalStage(routeIndex: number, mode: RunMode = 'finite'): boolean {
  return routeStage(routeIndex, mode).isFinal;
}
