import { describe, expect, it } from 'vitest';
import { POI_KINDS, type PoiKind } from '../engine/region/content';
import { BANNED_ROOM } from './bannedRoom';
import { GATE_KINDS } from './gates';
import { BARRED_HEALING_MOVES, NO_HEAL_ROOM } from './noHeal';
import { POI_ROWS, POI_ZONE_HEIGHT, POI_ZONE_WIDTH, poiRow, type PoiRow } from './pois';
import { PUZZLE_STACK } from './puzzles';
import { SECRET_SHOP } from './shop';
import { LEGENDARY_ROOM, LEGENDARY_SPECIES, STATIC_ROOM, STATIC_SPECIES } from './staticSpecies';

describe('the POI table folds the legacy room tables by reference', () => {
  it('vaults the gated room’s seals', () => {
    expect(POI_ROWS.vault.gateKinds).toBe(GATE_KINDS);
  });

  it('folds the no-heal room’s rule and the moves it bars', () => {
    expect(POI_ROWS['no-heal'].room).toBe(NO_HEAL_ROOM);
    expect(POI_ROWS['no-heal'].barredMoves).toBe(BARRED_HEALING_MOVES);
  });

  it('folds the banned-species room’s row', () => {
    expect(POI_ROWS.banned.room).toBe(BANNED_ROOM);
  });

  it('folds the static’s and the legendary’s room and species lists', () => {
    expect(POI_ROWS.static.room).toBe(STATIC_ROOM);
    expect(POI_ROWS.static.species).toBe(STATIC_SPECIES);
    expect(POI_ROWS.legendary.room).toBe(LEGENDARY_ROOM);
    expect(POI_ROWS.legendary.species).toBe(LEGENDARY_SPECIES);
    expect(LEGENDARY_SPECIES).not.toBe(STATIC_SPECIES);
  });

  it('folds the secret shop and the shelf its held and machine rows make', () => {
    expect(POI_ROWS['secret-shop'].shop).toBe(SECRET_SHOP);
    expect(POI_ROWS['secret-shop'].shelf).toEqual([...SECRET_SHOP.held, ...SECRET_SHOP.tm]);
  });

  it('folds the puzzle stack', () => {
    expect(POI_ROWS.puzzle.stack).toBe(PUZZLE_STACK);
  });
});

describe('the POI table is the nine kinds', () => {
  it('holds one row per PoiKind, in POI_KINDS order', () => {
    expect(Object.keys(POI_ROWS)).toEqual(POI_KINDS);
  });

  it('answers every kind’s own row, once for once', () => {
    for (const kind of POI_KINDS) {
      expect(poiRow(kind), kind).toBe(POI_ROWS[kind]);
      expect(poiRow(kind).kind, kind).toBe(kind);
    }
  });

  it('carries the two zone sizes as whole tiles', () => {
    expect(POI_ZONE_WIDTH).toBe(7);
    expect(POI_ZONE_HEIGHT).toBe(5);
    expect(Number.isInteger(POI_ZONE_WIDTH)).toBe(true);
    expect(Number.isInteger(POI_ZONE_HEIGHT)).toBe(true);
  });

  it('invents no odds and no counters: a row with no table carries no field', () => {
    const ROW_KEYS: Readonly<Record<PoiKind, readonly string[]>> = {
      vault: ['kind', 'gateKinds'],
      miniboss: ['kind'],
      trade: ['kind'],
      'no-heal': ['kind', 'room', 'barredMoves'],
      static: ['kind', 'room', 'species'],
      'secret-shop': ['kind', 'shop', 'shelf'],
      banned: ['kind', 'room'],
      puzzle: ['kind', 'stack'],
      legendary: ['kind', 'room', 'species'],
    };
    for (const kind of POI_KINDS) {
      expect(Object.keys(poiRow(kind)).sort(), kind).toEqual([...ROW_KEYS[kind]].sort());
    }
  });
});

describe('the POI rows narrow on their own kind', () => {
  it('answers a PoiRow for every kind the content pass can draw', () => {
    const rows: readonly PoiRow[] = POI_KINDS.map((kind) => poiRow(kind));
    expect(rows).toHaveLength(POI_KINDS.length);
    expect(new Set(rows.map((row) => row.kind))).toEqual(new Set(POI_KINDS));
  });
});
