import { describe, expect, it } from 'vitest';
import { getMove } from '../../data/dex';
import { abilityMoveType, effectiveMoveType } from './moveType';

const tackle = getMove('tackle')!;
const ember = getMove('ember')!;
const hypervoice = getMove('hypervoice')!;
const judgment = getMove('judgment')!;

describe('abilityMoveType', () => {
  it('retypes a Normal move for the -ate abilities', () => {
    expect(abilityMoveType('Refrigerate', tackle)).toBe('Ice');
    expect(abilityMoveType('Aerilate', tackle)).toBe('Flying');
    expect(abilityMoveType('Galvanize', tackle)).toBe('Electric');
    expect(abilityMoveType('Pixilate', tackle)).toBe('Fairy');
    // A move that is not Normal is left alone.
    expect(abilityMoveType('Refrigerate', ember)).toBe('Fire');
  });

  it('Normalize makes every move Normal, even a typed one', () => {
    expect(abilityMoveType('Normalize', ember)).toBe('Normal');
    expect(abilityMoveType('Normalize', tackle)).toBe('Normal');
  });

  it('Liquid Voice only retypes sound moves', () => {
    expect(abilityMoveType('Liquid Voice', hypervoice)).toBe('Water');
    expect(abilityMoveType('Liquid Voice', tackle)).toBe('Normal');
  });

  it('leaves a move unchanged for any other or missing ability', () => {
    expect(abilityMoveType('Blaze', ember)).toBe('Fire');
    expect(abilityMoveType(null, ember)).toBe('Fire');
    expect(abilityMoveType(undefined, tackle)).toBe('Normal');
  });
});

describe('effectiveMoveType', () => {
  it('a held Plate gives Judgment its type', () => {
    expect(effectiveMoveType('Multitype', 'flameplate', judgment)).toBe('Fire');
    expect(effectiveMoveType('Multitype', 'pixieplate', judgment)).toBe('Fairy');
    expect(effectiveMoveType('Multitype', null, judgment)).toBe('Normal');
    // A non-Plate item does not retype it.
    expect(effectiveMoveType('Multitype', 'charcoal', judgment)).toBe('Normal');
  });

  it('still applies the ability and leaves other moves alone', () => {
    expect(effectiveMoveType('Refrigerate', 'flameplate', tackle)).toBe('Ice');
    expect(effectiveMoveType('Blaze', null, ember)).toBe('Fire');
  });
});
