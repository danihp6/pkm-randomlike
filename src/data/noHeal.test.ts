import { describe, expect, it } from 'vitest';
import { getMove } from './dex';
import { BARRED_HEALING_MOVES, NO_HEAL_ROOM, isBarredHealingMove } from './noHeal';

/** The six moves that restore HP to their own user. */
const SELF_HEALS = ['recover', 'softboiled', 'slackoff', 'milkdrink', 'roost', 'lifedew'] as const;

/** The heals the engine resolves from the move's own effect data. */
const EFFECT_HEALS = [
  'synthesis',
  'moonlight',
  'morningsun',
  'shoreup',
  'rest',
  'junglehealing',
  'lunarblessing',
  'swallow',
] as const;

/** The draining attacks: they heal their user by the damage they deal. */
const DRAINS = [
  'absorb',
  'megadrain',
  'gigadrain',
  'drainpunch',
  'drainingkiss',
  'dreameater',
  'hornleech',
  'leechlife',
  'oblivionwing',
  'paraboliccharge',
] as const;

/** Moves that restore no HP in this engine, or act passively: never barred. */
const EXCLUDED = [
  'healbell',
  'aromatherapy',
  'healpulse',
  'floralhealing',
  'healingwish',
  'wish',
  'leechseed',
  'aquaring',
  'ingrain',
  'grassyterrain',
  'healorder',
  'healblock',
] as const;

describe('NO_HEAL_ROOM', () => {
  it('is offered from map 3 on, a fifth of the time, with the psychic trainer', () => {
    expect(NO_HEAL_ROOM).toEqual({ fromMap: 3, chance: 0.2, archetypeId: 'psychic' });
  });
});

describe('BARRED_HEALING_MOVES', () => {
  it('lists the three groups in order, one id each', () => {
    expect([...BARRED_HEALING_MOVES]).toEqual([...SELF_HEALS, ...EFFECT_HEALS, ...DRAINS]);
    expect(new Set(BARRED_HEALING_MOVES).size).toBe(BARRED_HEALING_MOVES.length);
  });

  it('names only moves the dex resolves', () => {
    for (const moveId of BARRED_HEALING_MOVES) expect(getMove(moveId), moveId).toBeDefined();
  });

  it('holds exactly the six self-heals, the effect heals and the drains', () => {
    expect(BARRED_HEALING_MOVES.filter((id) => (SELF_HEALS as readonly string[]).includes(id))).toEqual([
      ...SELF_HEALS,
    ]);
    expect(
      BARRED_HEALING_MOVES.filter((id) => (EFFECT_HEALS as readonly string[]).includes(id)),
    ).toEqual([...EFFECT_HEALS]);
    expect(BARRED_HEALING_MOVES.filter((id) => (DRAINS as readonly string[]).includes(id))).toEqual([
      ...DRAINS,
    ]);
    expect(BARRED_HEALING_MOVES).toHaveLength(SELF_HEALS.length + EFFECT_HEALS.length + DRAINS.length);
  });

  it('leaves every move that restores no HP, or acts passively, legal', () => {
    for (const moveId of EXCLUDED) {
      expect(BARRED_HEALING_MOVES, moveId).not.toContain(moveId);
      expect(isBarredHealingMove(moveId), moveId).toBe(false);
    }
  });
});

describe('isBarredHealingMove', () => {
  it('answers for every listed id and for anything else', () => {
    for (const moveId of BARRED_HEALING_MOVES) expect(isBarredHealingMove(moveId)).toBe(true);
    expect(isBarredHealingMove('tackle')).toBe(false);
    expect(isBarredHealingMove('')).toBe(false);
  });
});
