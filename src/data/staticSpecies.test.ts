import { describe, expect, it } from 'vitest';
import { LEVEL_BANDS } from './run';
import { GATE_KINDS } from './gates';
import {
  LEGENDARY_ROOM,
  LEGENDARY_SPECIES,
  STATIC_GATES,
  STATIC_ROOM,
  STATIC_SPECIES,
  type StaticGateKind,
} from './staticSpecies';
import { getAbility } from './dex/abilities';
import { getSpecies } from './dex/species';
import { isTypeName } from './dex/types';
import { speciesPool } from '../engine/run/pool';

describe('the static room table', () => {
  it('pins the leaf’s own roll: map 3 on, one in four', () => {
    expect(STATIC_ROOM).toEqual({ fromMap: 3, chance: 0.25 });
  });

  it('pins the legendary variant’s conditional roll: map 4 on, one in four', () => {
    expect(LEGENDARY_ROOM).toEqual({ fromMap: 4, chance: 0.25 });
  });
});

describe('STATIC_GATES', () => {
  it('is total over the shipped gate kinds, with both a type and a feature row', () => {
    for (const kind of GATE_KINDS) expect(STATIC_GATES[kind], kind).toBeDefined();
    const kinds: StaticGateKind[] = GATE_KINDS.map((kind) => STATIC_GATES[kind].kind);
    expect(kinds).toContain('type');
    expect(kinds).toContain('feature');
    for (const kind of GATE_KINDS) {
      expect(STATIC_GATES[kind].values.length, kind).toBeGreaterThan(0);
    }
  });

  it('opens every type row with real type names and every feature row with real abilities', () => {
    for (const kind of GATE_KINDS) {
      const gate = STATIC_GATES[kind];
      for (const value of gate.values) {
        if (gate.kind === 'type') expect(isTypeName(value), `${kind}: ${value}`).toBe(true);
        else expect(getAbility(value), `${kind}: ${value}`).toBeDefined();
      }
    }
  });

  it('pins the shipped rows verbatim', () => {
    expect(STATIC_GATES).toEqual({
      bush: { kind: 'type', values: ['Bug', 'Grass'] },
      rock: { kind: 'type', values: ['Rock', 'Fighting'] },
      water: { kind: 'feature', values: ['Water Absorb', 'Swift Swim', 'Storm Drain'] },
    });
  });
});

describe('the static species lists', () => {
  const lists: readonly [string, readonly string[]][] = [
    ['STATIC_SPECIES', STATIC_SPECIES],
    ['LEGENDARY_SPECIES', LEGENDARY_SPECIES],
  ];

  it('is non-empty, duplicate-free and resolvable through the dex', () => {
    for (const [name, list] of lists) {
      expect(list.length, name).toBeGreaterThan(0);
      expect(new Set(list).size, name).toBe(list.length);
      for (const id of list) expect(getSpecies(id)?.id, `${name}: ${id}`).toBe(id);
    }
  });

  it('carries no battle-only forme on either list', () => {
    for (const [name, list] of lists) {
      for (const id of list) expect(getSpecies(id)?.battleOnly, `${name}: ${id}`).toBeUndefined();
    }
  });

  it('never lets a legendary id into the ordinary wild pool', () => {
    for (const band of LEVEL_BANDS) {
      const pool = speciesPool(band, 'wild');
      for (const id of LEGENDARY_SPECIES) expect(pool, `${band.id}: ${id}`).not.toContain(id);
    }
  });
});
