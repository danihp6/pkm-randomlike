import { describe, expect, it } from 'vitest';
import { Rng } from '../rng';
import { chooseAiCommand } from './ai';
import { legalMoveIndices, validateCommand } from './commands';
import { GMAX_HP_MULTIPLIER, canGigantamax, gigantamax, revertGigantamax } from './gmax';
import { formatBattleLog, scriptedBattle } from './harness';
import { activeFighter, createBattle, createFighter, snapshotFighter, type BattleState } from './index';
import { canMegaEvolve, megaEvolve } from './mega';
import { takeTurn } from './turn';

function battle(
  playerSpeciesId = 'gengar',
  playerHeldItem?: string,
  enemySpeciesId = 'bulbasaur',
): BattleState {
  return createBattle({
    player: [
      createFighter({
        id: 'player',
        speciesId: playerSpeciesId,
        level: 40,
        nature: 'serious',
        moves: ['shadowball'],
        ...(playerHeldItem ? { heldItem: playerHeldItem } : {}),
      }),
    ],
    enemy: [
      createFighter({
        id: 'enemy',
        speciesId: enemySpeciesId,
        level: 40,
        nature: 'serious',
        moves: ['tackle'],
      }),
    ],
    rng: new Rng(2026),
    isWild: true,
  });
}

describe('canGigantamax', () => {
  it('is true only while the species itself has a G-Max forme', () => {
    expect(canGigantamax(battle(), 'player')).toBe(true);
    expect(canGigantamax(battle('charizard'), 'player')).toBe(true);
    expect(canGigantamax(battle('bulbasaur'), 'player')).toBe(false);
    expect(canGigantamax(battle('gengarmega'), 'player')).toBe(false);
    expect(canGigantamax(battle('bulbasaur', undefined, 'gengar'), 'enemy')).toBe(true);
    expect(canGigantamax(battle('bulbasaur', undefined, 'charmander'), 'enemy')).toBe(false);
  });

  it('needs no held item, unlike the Mega', () => {
    const state = battle();
    expect(activeFighter(state, 'player').heldItem).toBeNull();
    expect(canGigantamax(state, 'player')).toBe(true);
  });

  it('is false for a fainted holder and once it has Gigantamaxed', () => {
    const state = battle();
    activeFighter(state, 'player').hp = 0;
    expect(canGigantamax(state, 'player')).toBe(false);

    const spent = battle();
    expect(gigantamax(spent, 'player')).toBe(true);
    expect(canGigantamax(spent, 'player')).toBe(false);
  });
});

describe('gigantamax', () => {
  it('takes the forme name and species, keeps the rest, and doubles the pool', () => {
    const state = battle('gengar', 'gengarite');
    const fighter = activeFighter(state, 'player');
    const before = {
      hp: fighter.hp,
      maxHp: fighter.maxHp,
      ability: fighter.ability,
      types: [...fighter.types],
      moves: fighter.moves.map((slot) => ({ ...slot })),
    };

    expect(gigantamax(state, 'player')).toBe(true);
    expect(fighter.gmax).toBe(true);
    expect(fighter.speciesId).toBe('gengargmax');
    expect(fighter.name).toBe('Gengar-Gmax');
    expect(fighter.ability).toBe(before.ability);
    expect(fighter.types).toEqual(before.types);
    expect(fighter.moves).toEqual(before.moves);
    expect(fighter.heldItem).toBe('gengarite');
    expect(fighter.maxHp).toBe(before.maxHp * GMAX_HP_MULTIPLIER);
    expect(fighter.hp).toBe(before.hp * GMAX_HP_MULTIPLIER);
    expect(fighter.stats.hp).toBe(fighter.maxHp);
    expect(state.log).toContainEqual({ kind: 'gmax', side: 'player', fighterId: 'player' });
    expect(state.log).toContainEqual({ kind: 'text', text: 'Gengar Gigantamaxed!' });
  });

  it('is once per battle, and refuses a species with no G-Max forme', () => {
    const state = battle();
    expect(gigantamax(state, 'player')).toBe(true);
    const doubled = activeFighter(state, 'player').hp;
    expect(gigantamax(state, 'player')).toBe(false);
    expect(activeFighter(state, 'player').hp).toBe(doubled);
    expect(state.log.filter((event) => event.kind === 'gmax')).toHaveLength(1);

    const plain = battle('bulbasaur');
    expect(gigantamax(plain, 'player')).toBe(false);
    expect(activeFighter(plain, 'player').speciesId).toBe('bulbasaur');
    expect(plain.log.filter((event) => event.kind === 'gmax')).toEqual([]);
  });

  it('reverts to the base shape with a base-sized pool', () => {
    const state = battle();
    const fighter = activeFighter(state, 'player');
    const basePool = fighter.maxHp;
    expect(gigantamax(state, 'player')).toBe(true);
    expect(fighter.maxHp).toBe(basePool * GMAX_HP_MULTIPLIER);

    expect(revertGigantamax(fighter)).toBe(true);
    expect(fighter.gmax).toBe(false);
    expect(fighter.speciesId).toBe('gengar');
    expect(fighter.name).toBe('Gengar');
    expect(fighter.maxHp).toBe(basePool);
    expect(fighter.stats.hp).toBe(basePool);
    expect(fighter.hp).toBeLessThanOrEqual(basePool);

    const snapshot = snapshotFighter(fighter);
    expect(snapshot.speciesId).toBe('gengar');
    expect(snapshot.hp).toBeLessThanOrEqual(basePool);
    expect(revertGigantamax(fighter)).toBe(false);
  });
});

describe('the two battle-only formes exclude each other (D44)', () => {
  it('leaves the G-Max forme in place when a Mega is commanded after it', () => {
    const state = battle('gengar', 'gengarite');
    expect(canMegaEvolve(state, 'player')).toBe(true);
    expect(gigantamax(state, 'player')).toBe(true);
    expect(canMegaEvolve(state, 'player')).toBe(false);
    expect(megaEvolve(state, 'player')).toBe(false);
    expect(activeFighter(state, 'player').speciesId).toBe('gengargmax');
  });

  it('refuses the Gigantamax once the fighter has Mega Evolved', () => {
    const state = battle('gengar', 'gengarite');
    expect(megaEvolve(state, 'player')).toBe(true);
    expect(canGigantamax(state, 'player')).toBe(false);
    expect(gigantamax(state, 'player')).toBe(false);
    expect(activeFighter(state, 'player').speciesId).toBe('gengarmega');
  });
});

describe('the gmax flag on a fight command', () => {
  it('is refused for a species with no G-Max forme', () => {
    const state = battle('bulbasaur');
    expect(validateCommand(state, 'player', { type: 'fight', moveIndex: 0, gmax: true })).toBe(
      'That Pokémon cannot Gigantamax.',
    );
  });

  it('is accepted while the forme is still available', () => {
    const state = battle();
    expect(validateCommand(state, 'player', { type: 'fight', moveIndex: 0, gmax: true })).toBeNull();
    expect(validateCommand(state, 'player', { type: 'fight', moveIndex: 0 })).toBeNull();
  });

  it('resolves on the turn it is commanded, before the move', () => {
    const state = battle();
    const basePool = activeFighter(state, 'player').maxHp;
    takeTurn(state, { type: 'fight', moveIndex: 0, gmax: true }, chooseAiCommand(state, 'enemy'));
    const fighter = activeFighter(state, 'player');
    expect(fighter.speciesId).toBe('gengargmax');
    expect(fighter.maxHp).toBe(basePool * GMAX_HP_MULTIPLIER);
    expect(state.log.some((event) => event.kind === 'move' && event.side === 'player')).toBe(true);
  });
});

describe('the AI spends the Gigantamax', () => {
  it('marks its first fight command with gmax, and never with mega', () => {
    const state = battle('bulbasaur', undefined, 'gengar');
    expect(chooseAiCommand(state, 'enemy')).toEqual({
      type: 'fight',
      moveIndex: expect.any(Number),
      gmax: true,
    });
  });

  it('leaves the command plain for a species with no G-Max forme', () => {
    const state = battle();
    expect(chooseAiCommand(state, 'enemy')).toEqual({
      type: 'fight',
      moveIndex: expect.any(Number),
    });
  });

  it('arms the stone, not the forme, when the holder can do both (a Mega resolves first)', () => {
    const state = battle('bulbasaur', undefined, 'gengar');
    activeFighter(state, 'enemy').heldItem = 'gengarite';
    expect(canMegaEvolve(state, 'enemy')).toBe(true);
    expect(canGigantamax(state, 'enemy')).toBe(true);
    expect(chooseAiCommand(state, 'enemy')).toEqual({
      type: 'fight',
      moveIndex: expect.any(Number),
      mega: true,
    });
  });
});

describe('the fixed-seed Gigantamax regression (D11)', () => {
  // The spec pins a policy that returns `gmax: true` on every turn. The flag is
  // spent on the first turn, so from the second on it would be a refused command —
  // `validateCommand` says 'That Pokémon cannot Gigantamax.' and `takeTurn` throws
  // on a refused command — and a fixed `moveIndex: 0` runs out of PP in a battle
  // that lasts longer than the slot's PP. The pinned teams, seed and levels are
  // kept, `moveIndex: 0` is kept while it is a legal index, and the flag is armed
  // while `canGigantamax` still allows it: the command shape the scene itself sends.
  const run = (): BattleState =>
    scriptedBattle({
      player: [{ id: 'player', speciesId: 'gengar', level: 30 }],
      enemy: [{ id: 'enemy', speciesId: 'bulbasaur', level: 18 }],
      seed: 2026,
      playerCommand: (state: BattleState) => {
        const legal = legalMoveIndices(activeFighter(state, 'player'));
        return {
          type: 'fight',
          moveIndex: legal.includes(0) || legal.length === 0 ? 0 : legal[0],
          ...(canGigantamax(state, 'player') ? { gmax: true } : {}),
        };
      },
    });

  it('refuses a flag that was already spent (the frozen once-per-battle rule)', () => {
    expect(() =>
      scriptedBattle({
        player: [{ id: 'player', speciesId: 'gengar', level: 30 }],
        enemy: [{ id: 'enemy', speciesId: 'bulbasaur', level: 18 }],
        seed: 2026,
        playerCommand: () => ({ type: 'fight', moveIndex: 0, gmax: true }),
      }),
    ).toThrow('That Pokémon cannot Gigantamax.');
  });

  it('reproduces the same log on a second run', () => {
    expect(formatBattleLog(run())).toBe(formatBattleLog(run()));
  });

  it('Gigantamaxes exactly once, whatever the turn count', () => {
    const log = formatBattleLog(run());
    expect(log.split('\n').filter((line) => line === '  = player gmax player')).toHaveLength(1);
    expect(log.split('\n').filter((line) => line.startsWith('# turn ')).length).toBeGreaterThan(1);
  });
});
