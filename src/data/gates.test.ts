import { describe, expect, it } from 'vitest';
import { BUSH, ROCK, WATER } from '../engine/map';
import { isTypeName } from './dex/types';
import { GATES, GATE_KINDS, gateRow, type GateKind } from './gates';
import { FRLG_TILESET } from './tilesets/frlg';

describe('the gate table', () => {
  it('lists the three kinds in the generator pick order', () => {
    expect(GATE_KINDS).toEqual(['bush', 'rock', 'water']);
    expect(GATE_KINDS).toHaveLength(3);
  });

  it('keys every kind', () => {
    for (const kind of GATE_KINDS) {
      expect(gateRow(kind), kind).toBe(GATES[kind]);
    }
  });

  it('carries the party types that open each obstacle, in data', () => {
    expect(GATES.bush.types).toEqual(['Bug', 'Grass']);
    expect(GATES.rock.types).toEqual(['Rock', 'Fighting']);
    expect(GATES.water.types).toEqual(['Water']);
  });

  it('spells every type the way the dex does', () => {
    for (const kind of GATE_KINDS) {
      for (const type of GATES[kind].types) {
        expect(isTypeName(type), `${kind}: ${type}`).toBe(true);
      }
    }
  });

  it('stamps each kind as its own map value, never a wall', () => {
    expect(GATES.bush.tile).toBe(BUSH);
    expect(GATES.rock.tile).toBe(ROCK);
    expect(GATES.water.tile).toBe(WATER);
  });

  it('draws each kind through the frame its map value resolves to', () => {
    for (const kind of GATE_KINDS) {
      expect(FRLG_TILESET.frames[GATES[kind].tile], kind).toBe(GATES[kind].frame);
    }
  });

  it('uses the two dedicated seal cells and the shared water interior cell', () => {
    const frames = GATE_KINDS.map((kind: GateKind) => GATES[kind].frame);
    expect(new Set(frames).size).toBe(GATE_KINDS.length);
    expect(GATES.water.frame).toBe(FRLG_TILESET.frames[WATER]);
  });
});
