import { describe, expect, it } from 'vitest';
import { getMove, getSpecies, levelUpMoves, statAtLevel } from '../../data/dex';
import {
  accuracyStageMultiplier,
  addType,
  applyBoosts,
  clampBoost,
  clearVolatiles,
  createFighter,
  defaultMoveset,
  effectiveSpeed,
  effectiveStat,
  emptyVolatiles,
  fighterAbilities,
  hasAbility,
  isGrounded,
  resetBattleState,
  restoreFighter,
  rewriteTypes,
  snapshotFighter,
  stageMultiplier,
} from './fighter';
import { randomLevelUpMoves } from './randomLearnset';

const level = 20;

describe('createFighter', () => {
  it('computes stats exactly at the level', () => {
    const fighter = createFighter({ id: 'c', speciesId: 'charmander', level, nature: 'serious' });
    const expected = statAtLevel(getSpecies('charmander')!, level, 'serious');
    expect(fighter.stats).toEqual(expected);
    expect(fighter.hp).toBe(expected.hp);
    expect(fighter.maxHp).toBe(expected.hp);
    expect(fighter.types).toEqual(['Fire']);
  });

  it('defaults to the species ability and a full-PP moveset', () => {
    const fighter = createFighter({ id: 'c', speciesId: 'charmander', level });
    expect(fighter.ability).not.toBe('');
    expect(fighter.moves.length).toBeGreaterThan(0);
    for (const slot of fighter.moves) {
      expect(slot.pp).toBe(slot.maxPp);
      expect(slot.pp).toBeGreaterThan(0);
    }
  });

  it('trusts a provided ability outside the species options', () => {
    const fighter = createFighter({ id: 'c', speciesId: 'charmander', level, ability: 'Levitate' });
    expect(fighter.ability).toBe('Levitate');
    expect(snapshotFighter(fighter).ability).toBe('Levitate');
    expect(restoreFighter(snapshotFighter(fighter)).ability).toBe('Levitate');
  });

  it('keeps only moves that exist in the dex', () => {
    const fighter = createFighter({
      id: 'c',
      speciesId: 'charmander',
      level,
      moves: ['ember', 'not-a-move', 'growl'],
    });
    expect(fighter.moves.map((slot) => slot.moveId)).toEqual(['ember', 'growl']);
  });

  it('rejects an unknown species', () => {
    expect(() => createFighter({ id: 'x', speciesId: 'missingno', level: 5 })).toThrow();
  });
});

describe('defaultMoveset', () => {
  it('takes the newest four level-up moves', () => {
    const moves = defaultMoveset('charmander', 30);
    expect(moves.length).toBeLessThanOrEqual(4);
    expect(moves.length).toBeGreaterThan(0);
  });

  it('pads a level-1 moveset to four moves with at least one damaging', () => {
    const moves = defaultMoveset('charmander', 1);
    expect(moves).toHaveLength(4);
    expect(new Set(moves).size).toBe(4);
    expect(moves.some((moveId) => getMove(moveId)?.category !== 'Status')).toBe(true);
  });

  it('pads every level up to five, and leaves level six untouched', () => {
    for (let level = 1; level <= 5; level++) {
      expect(defaultMoveset('charmander', level)).toHaveLength(4);
    }
    const learned = levelUpMoves('charmander', 6).map((entry) => entry.moveId);
    expect(defaultMoveset('charmander', 6)).toEqual(learned.slice(Math.max(0, learned.length - 4)));
  });

  it('is a pure function of the seed on the randomized path', () => {
    const a = defaultMoveset('charmander', 1, 'run-1');
    const b = defaultMoveset('charmander', 1, 'run-1');
    const c = defaultMoveset('charmander', 1, 'run-2');
    expect(a).toEqual(b);
    expect(a).toHaveLength(4);
    expect(new Set(a).size).toBe(4);
    expect(c).not.toEqual(a);
  });

  it('never duplicates moves and keeps a damaging move when one exists', () => {
    for (const speciesId of ['pidgey', 'rattata', 'magikarp', 'sentret', 'charmander', 'bulbasaur']) {
      for (let level = 1; level <= 5; level++) {
        const moves = defaultMoveset(speciesId, level, 'run-1');
        expect(new Set(moves).size).toBe(moves.length);
        expect(moves.length).toBeLessThanOrEqual(4);
        expect(moves.some((moveId) => getMove(moveId)?.category !== 'Status')).toBe(true);
      }
    }
  });

  it('gives a one-move species only what it can legally learn', () => {
    expect(defaultMoveset('unown', 1)).toEqual(['hiddenpower']);
    expect(defaultMoveset('ditto', 1)).toEqual(['transform']);
  });

  it('still falls back to Tackle when the level grants no moves and has no seed', () => {
    // Pidgey's level-up moves ship as Virtual Console sources the accessor does
    // not read as level moves, so a high-level set is empty on the canon path.
    expect(defaultMoveset('pidgey', 30)).toEqual(['tackle']);
  });

  it('feeds randomized level-up moves through the same padding', () => {
    const learned = randomLevelUpMoves('charmander', 1, 'run-1').map((entry) => entry.moveId);
    expect(learned.length).toBeLessThan(4);
    expect(defaultMoveset('charmander', 1, 'run-1').slice(0, learned.length)).toEqual(learned);
  });
});

describe('stat stages', () => {
  it('clamps to -6..+6 and only reports real changes', () => {
    const fighter = createFighter({ id: 'c', speciesId: 'charmander', level });
    expect(clampBoost(9)).toBe(6);
    expect(clampBoost(-9)).toBe(-6);
    expect(applyBoosts(fighter, { atk: 2 })).toEqual([{ stat: 'atk', stages: 2 }]);
    expect(applyBoosts(fighter, { atk: 10 })).toEqual([{ stat: 'atk', stages: 4 }]);
    expect(fighter.boosts.atk).toBe(6);
    expect(applyBoosts(fighter, { atk: 1 })).toEqual([]);
  });

  it('uses the classic stage multipliers', () => {
    expect(stageMultiplier(0)).toBe(1);
    expect(stageMultiplier(2)).toBe(2);
    expect(stageMultiplier(-2)).toBe(0.5);
    expect(accuracyStageMultiplier(0)).toBe(1);
    expect(accuracyStageMultiplier(3)).toBe(2);
    expect(accuracyStageMultiplier(-3)).toBe(0.5);
  });

  it('applies stages to effective stats', () => {
    const fighter = createFighter({ id: 'c', speciesId: 'charmander', level });
    const base = effectiveStat(fighter, 'atk');
    applyBoosts(fighter, { atk: 1 });
    expect(effectiveStat(fighter, 'atk')).toBe(Math.floor(base * 1.5));
  });

  it('halves effective speed when paralyzed', () => {
    const fighter = createFighter({ id: 'c', speciesId: 'charmander', level });
    const base = effectiveSpeed(fighter);
    fighter.status = 'par';
    expect(effectiveSpeed(fighter)).toBe(Math.max(1, Math.floor(base / 2)));
  });
});

describe('fighter snapshots', () => {
  it('round-trips HP, PP, status and identity', () => {
    const fighter = createFighter({
      id: 'buddy',
      speciesId: 'charmander',
      level,
      moves: ['ember', 'scratch', 'growl'],
      heldItem: 'charcoal',
    });
    fighter.hp = 7;
    fighter.moves[0].pp -= 3;
    fighter.status = 'brn';
    fighter.statusCounter = 4;
    applyBoosts(fighter, { atk: 2 });

    const restored = restoreFighter(snapshotFighter(fighter));

    expect(restored.id).toBe('buddy');
    expect(restored.speciesId).toBe('charmander');
    expect(restored.hp).toBe(7);
    expect(restored.maxHp).toBe(fighter.maxHp);
    expect(restored.heldItem).toBe('charcoal');
    expect(restored.status).toBe('brn');
    expect(restored.statusCounter).toBe(4);
    expect(restored.moves).toEqual(fighter.moves);
    // Battle-only state never survives a snapshot.
    expect(restored.boosts.atk).toBe(0);
  });

  it('keeps a fainted fighter at 0 HP', () => {
    const fighter = createFighter({ id: 'fallen', speciesId: 'charmander', level });
    fighter.hp = 0;
    expect(restoreFighter(snapshotFighter(fighter)).hp).toBe(0);
  });

  it('round-trips a nickname and names an unnamed member from its species', () => {
    const named = createFighter({ id: 'buddy', speciesId: 'charmander', level, nickname: 'Sparky' });
    expect(named.nickname).toBe('Sparky');
    expect(named.name).toBe('Sparky');
    const snapshot = snapshotFighter(named);
    expect(snapshot.nickname).toBe('Sparky');
    const restored = restoreFighter(snapshot);
    expect(restored.nickname).toBe('Sparky');
    expect(restored.name).toBe('Sparky');
    expect(restored.speciesId).toBe('charmander');
  });

  it('carries no nickname key for a member that never had one', () => {
    const plain = createFighter({ id: 'plain', speciesId: 'charmander', level });
    expect(plain.nickname).toBeNull();
    expect(plain.name).toBe('Charmander');
    const snapshot = snapshotFighter(plain);
    expect('nickname' in snapshot).toBe(false);
    const restored = restoreFighter(snapshot);
    expect(restored.nickname).toBeNull();
    expect(restored.name).toBe('Charmander');
  });
});

describe('the permanent treats (Task-103)', () => {
  const species = getSpecies('charmander')!;

  it('stamps the input treats on the fighter and its stats', () => {
    const fighter = createFighter({
      id: 'c',
      speciesId: 'charmander',
      level,
      nature: 'serious',
      treats: { atk: 2, spe: -1 },
    });
    expect(fighter.treats).toEqual({ atk: 2, spe: -1 });
    expect(fighter.stats).toEqual(statAtLevel(species, level, 'serious', undefined, undefined, { atk: 2, spe: -1 }));
  });

  it('starts a fighter with no treats on the shipped formula and an empty record', () => {
    const fighter = createFighter({ id: 'c', speciesId: 'charmander', level, nature: 'serious' });
    expect(fighter.treats).toEqual({});
    expect(fighter.stats).toEqual(statAtLevel(species, level, 'serious'));
    expect('statTreats' in snapshotFighter(fighter)).toBe(false);
  });

  it('round-trips the treats through the snapshot, and keeps the treated stat', () => {
    const fighter = createFighter({
      id: 'c',
      speciesId: 'charmander',
      level,
      nature: 'serious',
      treats: { atk: 1, spe: -1 },
    });
    const snapshot = snapshotFighter(fighter);
    expect(snapshot.statTreats).toEqual({ atk: 1, spe: -1 });
    const restored = restoreFighter(snapshot);
    expect(restored.treats).toEqual({ atk: 1, spe: -1 });
    expect(restored.stats.atk).toBe(statAtLevel(species, level, 'serious').atk + 1);
    expect(restored.stats.spe).toBe(statAtLevel(species, level, 'serious').spe - 1);
  });
});

describe('the semi-invulnerable field', () => {
  it('starts empty and rides on a fighter built by createFighter', () => {
    expect(emptyVolatiles().semiInvulnerable).toBeNull();
    const fighter = createFighter({ id: 'c', speciesId: 'charmander', level });
    expect(fighter.volatiles.semiInvulnerable).toBeNull();
    expect('semiInvulnerable' in fighter.volatiles).toBe(true);
  });

  it('is battle-only: a reset and a snapshot both drop it', () => {
    const fighter = createFighter({ id: 'c', speciesId: 'charmander', level, moves: ['dig'] });
    fighter.volatiles.charging = 'dig';
    fighter.volatiles.semiInvulnerable = 'dig';
    expect('volatiles' in snapshotFighter(fighter)).toBe(false);
    resetBattleState(fighter);
    expect(fighter.volatiles.semiInvulnerable).toBeNull();
    expect(fighter.volatiles.charging).toBeNull();
  });
});

describe('the room’s Endure flag', () => {
  it('starts unspent on a fresh volatile set', () => {
    expect(emptyVolatiles().roomEndureUsed).toBe(false);
    const fighter = createFighter({ id: 'c', speciesId: 'charmander', level });
    expect(fighter.volatiles.roomEndureUsed).toBe(false);
    expect('roomEndureUsed' in fighter.volatiles).toBe(true);
  });

  it('re-arms a spent flag when the fighter leaves the field', () => {
    const fighter = createFighter({ id: 'c', speciesId: 'charmander', level });
    fighter.volatiles.roomEndureUsed = true;
    clearVolatiles(fighter);
    expect(fighter.volatiles.roomEndureUsed).toBe(false);
    expect('volatiles' in snapshotFighter(fighter)).toBe(false);
  });
});

describe('type writes and grounding', () => {
  it('rewriteTypes keeps the shape a switch-out restores', () => {
    const fighter = createFighter({ id: 'c', speciesId: 'charizard', level });
    rewriteTypes(fighter, ['Water']);
    expect(fighter.types).toEqual(['Water']);
    resetBattleState(fighter);
    expect(fighter.types).toEqual(['Fire', 'Flying']);
  });

  it('addType appends one type and replaces the type a previous add left', () => {
    const fighter = createFighter({ id: 'c', speciesId: 'ditto', level });
    addType(fighter, 'Grass');
    expect(fighter.types).toEqual(['Normal', 'Grass']);
    addType(fighter, 'Ghost');
    expect(fighter.types).toEqual(['Normal', 'Ghost']);
    resetBattleState(fighter);
    expect(fighter.types).toEqual(['Normal']);
  });

  it('Smack Down and Telekinesis both decide grounding', () => {
    const flyer = createFighter({ id: 'f', speciesId: 'pidgey', level });
    expect(isGrounded(flyer)).toBe(false);
    flyer.volatiles.grounded = true;
    expect(isGrounded(flyer)).toBe(true);

    const grounded = createFighter({ id: 'g', speciesId: 'ditto', level });
    expect(isGrounded(grounded)).toBe(true);
    grounded.volatiles.telekinesis = 3;
    expect(isGrounded(grounded)).toBe(false);
  });
});

describe('the second ability (Task-153)', () => {
  it('keeps a granted second ability across create, snapshot and restore', () => {
    const fighter = createFighter({
      id: 'c',
      speciesId: 'charmander',
      level,
      ability: 'Blaze',
      secondAbility: 'Intimidate',
    });
    expect(fighter.ability).toBe('Blaze');
    expect(fighter.secondAbility).toBe('Intimidate');
    expect(fighterAbilities(fighter)).toEqual(['Blaze', 'Intimidate']);
    expect(hasAbility(fighter, 'blaze')).toBe(true);
    expect(hasAbility(fighter, 'intimidate')).toBe(true);
    expect(hasAbility(fighter, 'overgrow')).toBe(false);

    const snapshot = snapshotFighter(fighter);
    expect(snapshot.secondAbility).toBe('Intimidate');
    const restored = restoreFighter(snapshot);
    expect(restored.ability).toBe('Blaze');
    expect(restored.secondAbility).toBe('Intimidate');
    expect(hasAbility(restored, 'Intimidate')).toBe(true);
  });

  it('drops an empty or duplicated second ability and writes no snapshot key', () => {
    for (const secondAbility of ['', '   ', 'Blaze', 'blaze', 'BLAZE!']) {
      const fighter = createFighter({
        id: 'c',
        speciesId: 'charmander',
        level,
        ability: 'Blaze',
        secondAbility,
      });
      expect(fighter.secondAbility).toBeUndefined();
      expect('secondAbility' in fighter).toBe(false);
      expect('secondAbility' in snapshotFighter(fighter)).toBe(false);
    }
  });

  it('compares ability ids case- and punctuation-insensitively in both slots', () => {
    const fighter = createFighter({
      id: 'c',
      speciesId: 'charmander',
      level,
      ability: 'Dark Matter',
      secondAbility: 'Levitate',
    });
    expect(hasAbility(fighter, 'darkmatter')).toBe(true);
    expect(hasAbility(fighter, 'DARK-MATTER')).toBe(true);
    expect(hasAbility(fighter, 'Levitate')).toBe(true);
    expect(hasAbility(fighter, '')).toBe(false);
    expect(fighterAbilities(fighter)).toEqual(['Dark Matter', 'Levitate']);
  });

  it('reads a fighter with no abilities as an empty list', () => {
    const fighter = createFighter({ id: 'c', speciesId: 'charmander', level });
    fighter.ability = '';
    expect(fighterAbilities(fighter)).toEqual([]);
    expect(hasAbility(fighter, 'Blaze')).toBe(false);
  });
});
