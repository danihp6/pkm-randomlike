import { describe, expect, it } from 'vitest';
import { nextDebugPokemonId } from './ids';

describe('nextDebugPokemonId', () => {
  it('counts up from the given counter', () => {
    expect(nextDebugPokemonId('eevee', [], 0)).toEqual({ id: 'debug:eevee:1', counter: 1 });
    expect(nextDebugPokemonId('eevee', [], 4)).toEqual({ id: 'debug:eevee:5', counter: 5 });
  });

  it('skips ids a live member already uses', () => {
    // The scene counter reset on a reload, but the save still holds :1 and :2.
    const used = ['debug:eevee:1', 'debug:eevee:2', 'starter'];
    expect(nextDebugPokemonId('eevee', used, 0)).toEqual({ id: 'debug:eevee:3', counter: 3 });
  });

  it('only guards the id it is about to build', () => {
    expect(nextDebugPokemonId('pikachu', ['debug:eevee:1'], 0)).toEqual({
      id: 'debug:pikachu:1',
      counter: 1,
    });
  });
});
