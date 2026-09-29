import { describe, expect, it } from 'vitest';
import abilitiesData from './abilities.json';
import itemsData from './items.json';
import meta from './meta.json';
import movesData from './moves.json';
import naturesData from './natures.json';
import speciesData from './species.json';
import typesData from './types.json';
import { allMoves } from './moves';
import { learnsetOf } from './learnsets';
import { playableSpecies } from './species';
import { TYPE_NAMES, isTypeName } from './types';

const counts = (meta as { counts: Readonly<Record<string, number>> }).counts;

describe('generated dex integrity', () => {
  it('matches the row counts recorded in meta.json', () => {
    expect(speciesData.length).toBe(counts.species);
    expect(movesData.length).toBe(counts.moves);
    expect(abilitiesData.length).toBe(counts.abilities);
    expect(itemsData.length).toBe(counts.items);
    expect(naturesData.length).toBe(counts.natures);
    expect(typesData.length).toBe(counts.types);
    expect(playableSpecies().length).toBe(counts.species);
    expect(allMoves().length).toBe(counts.moves);
  });

  it('only references real moves from learnsets', () => {
    const moveIds = new Set((movesData as readonly { id: string }[]).map((move) => move.id));
    const dangling: string[] = [];
    for (const species of playableSpecies()) {
      const learnset = learnsetOf(species.id);
      if (!learnset) continue;
      for (const moveId of Object.keys(learnset)) {
        if (!moveIds.has(moveId)) dangling.push(`${species.id}:${moveId}`);
      }
    }
    expect(dangling).toEqual([]);
  });

  it('only evolves into real species', () => {
    const speciesIds = new Set(playableSpecies().map((species) => species.id));
    for (const species of playableSpecies()) {
      for (const evolution of species.evolutions) {
        expect(
          speciesIds.has(evolution.into),
          `${species.id} evolves into unknown ${evolution.into}`,
        ).toBe(true);
      }
    }
  });

  it('only uses the 18 battle types for species', () => {
    for (const species of playableSpecies()) {
      for (const type of species.types) {
        expect(isTypeName(type), `${species.id} has unknown type ${type}`).toBe(true);
      }
    }
  });

  it('only uses known types for moves', () => {
    const known = new Set([...TYPE_NAMES, 'Stellar']);
    for (const move of allMoves()) {
      expect(known.has(move.type), `${move.id} has unknown type ${move.type}`).toBe(true);
    }
  });

  it('gives every playable species a positive catch rate', () => {
    for (const species of playableSpecies()) {
      expect(
        Number.isInteger(species.catchRate) && species.catchRate > 0,
        `${species.id} has catchRate ${species.catchRate}`,
      ).toBe(true);
    }
  });
});
