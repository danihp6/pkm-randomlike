import { describe, expect, it } from 'vitest';
import { RUN_CHAIN } from '../../data/run';
import { chainLength, isFinalStage, routeStage, type RouteKind } from './chain';

function kindAt(index: number, mode: 'finite' | 'infinite' = 'finite'): RouteKind {
  return routeStage(index, mode).kind;
}

describe('routeStage cadence', () => {
  it('plays regular routes until the first mini-boss', () => {
    for (let index = 1; index < RUN_CHAIN.minibossEvery; index++) {
      expect(kindAt(index), `route ${index}`).toBe('route');
    }
    expect(kindAt(RUN_CHAIN.minibossEvery)).toBe('miniboss');
  });

  it('closes every block with a boss and keeps the mini-boss cadence inside it', () => {
    expect(kindAt(RUN_CHAIN.bossBlock)).toBe('boss');
    expect(kindAt(RUN_CHAIN.bossBlock - RUN_CHAIN.minibossEvery)).toBe('miniboss');
    expect(kindAt(RUN_CHAIN.bossBlock * 2)).toBe('boss');
    expect(kindAt(RUN_CHAIN.bossBlock * 2 - RUN_CHAIN.minibossEvery)).toBe('miniboss');
  });

  it('makes the last finite route the final boss even on a boss slot', () => {
    const last = RUN_CHAIN.finiteLength;
    expect(kindAt(last)).toBe('final');
    expect(isFinalStage(last)).toBe(true);
    expect(routeStage(last).slot).toBe(RUN_CHAIN.bossBlock);
    expect(routeStage(last - 1).isFinal).toBe(false);
  });

  it('reuses the cadence in infinite mode without a final boss', () => {
    const bossSlot = RUN_CHAIN.finiteLength;
    expect(kindAt(bossSlot, 'infinite')).toBe('boss');
    expect(kindAt(bossSlot + RUN_CHAIN.minibossEvery, 'infinite')).toBe('miniboss');
    expect(kindAt(bossSlot + RUN_CHAIN.bossBlock, 'infinite')).toBe('boss');
    expect(isFinalStage(bossSlot, 'infinite')).toBe(false);
    expect(isFinalStage(bossSlot * 100, 'infinite')).toBe(false);
  });

  it('locates each route in its block and slot', () => {
    const first = routeStage(1);
    expect(first).toMatchObject({ block: 1, slot: 1 });
    const boss = routeStage(RUN_CHAIN.bossBlock);
    expect(boss).toMatchObject({ block: 1, slot: RUN_CHAIN.bossBlock });
    const nextBlock = routeStage(RUN_CHAIN.bossBlock + 1);
    expect(nextBlock).toMatchObject({ block: 2, slot: 1 });
  });

  it('flags every special route as a boss', () => {
    expect(routeStage(1).isBoss).toBe(false);
    expect(routeStage(RUN_CHAIN.bossBlock).isBoss).toBe(true);
    expect(routeStage(RUN_CHAIN.minibossEvery).isBoss).toBe(true);
    expect(routeStage(RUN_CHAIN.finiteLength).isBoss).toBe(true);
  });

  it('clamps a non-positive index to the first route', () => {
    expect(routeStage(0)).toMatchObject({ index: 1, kind: 'route', block: 1, slot: 1 });
    expect(routeStage(-5)).toMatchObject({ index: 1, kind: 'route' });
    expect(routeStage(2.9)).toMatchObject({ index: 2, kind: 'route' });
  });
});

describe('chain length', () => {
  it('is fixed for a finite run and unbounded for an infinite one', () => {
    expect(chainLength('finite')).toBe(RUN_CHAIN.finiteLength);
    expect(chainLength('infinite')).toBe(Number.POSITIVE_INFINITY);
  });
});
