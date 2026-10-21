import { describe, expect, it } from 'vitest';
import { Rng } from '../rng';
import { chooseAiCommand } from './ai';
import { validateCommand } from './commands';
import { activeFighter, createBattle, createFighter, snapshotFighter, type BattleState } from './index';
import { canMegaEvolve, megaEvolve } from './mega';
import { resetBattleState } from './fighter';
import { takeTurn } from './turn';
import { getSpecies, statAtLevel, type StatId } from '../../data/dex';

function battle(
  heldItem?: string,
  enemySpeciesId = 'bulbasaur',
  enemyHeldItem?: string,
  treats?: Readonly<Partial<Record<StatId, number>>>,
): BattleState {
  return createBattle({
    player: [
      createFighter({
        id: 'player',
        speciesId: 'gyarados',
        level: 40,
        nature: 'serious',
        moves: ['waterfall'],
        ...(heldItem ? { heldItem } : {}),
        ...(treats ? { treats } : {}),
      }),
    ],
    enemy: [
      createFighter({
        id: 'enemy',
        speciesId: enemySpeciesId,
        level: 40,
        nature: 'serious',
        moves: ['tackle'],
        ...(enemyHeldItem ? { heldItem: enemyHeldItem } : {}),
      }),
    ],
    rng: new Rng(2026),
    isWild: true,
  });
}

describe('canMegaEvolve', () => {
  it('is true only while the holder holds its matching stone', () => {
    expect(canMegaEvolve(battle('gyaradosite'), 'player')).toBe(true);
    expect(canMegaEvolve(battle(), 'player')).toBe(false);
    expect(canMegaEvolve(battle('charcoal'), 'player')).toBe(false);
    expect(canMegaEvolve(battle('venusaurite'), 'player')).toBe(false);
  });

  it('is false for a fainted holder', () => {
    const state = battle('gyaradosite');
    activeFighter(state, 'player').hp = 0;
    expect(canMegaEvolve(state, 'player')).toBe(false);
  });
});

describe('megaEvolve', () => {
  it('swaps stats, types and ability but keeps HP, item and moves', () => {
    const state = battle('gyaradosite');
    const fighter = activeFighter(state, 'player');
    const beforeHp = fighter.hp;
    const beforeMaxHp = fighter.maxHp;

    expect(megaEvolve(state, 'player')).toBe(true);
    expect(fighter.mega).toBe(true);
    expect(fighter.speciesId).toBe('gyaradosmega');
    expect(fighter.types).toEqual(['Water', 'Dark']);
    expect(fighter.ability).toBe('Mold Breaker');
    expect(fighter.stats.atk).toBeGreaterThan(0);
    expect(fighter.hp).toBe(beforeHp);
    expect(fighter.maxHp).toBe(beforeMaxHp);
    expect(fighter.heldItem).toBe('gyaradosite');
    expect(fighter.moves.map((slot) => slot.moveId)).toEqual(['waterfall']);
    expect(state.log.some((event) => event.kind === 'mega' && event.side === 'player')).toBe(true);

    // Once per battle: a second attempt changes nothing.
    expect(megaEvolve(state, 'player')).toBe(false);
    expect(canMegaEvolve(state, 'player')).toBe(false);
  });

  it('resolves on the turn it is commanded, before the move', () => {
    const state = battle('gyaradosite');
    takeTurn(state, { type: 'fight', moveIndex: 0, mega: true }, chooseAiCommand(state, 'enemy'));
    const fighter = activeFighter(state, 'player');
    expect(fighter.mega).toBe(true);
    expect(fighter.speciesId).toBe('gyaradosmega');
    expect(state.log.some((event) => event.kind === 'move' && event.side === 'player')).toBe(true);
  });

  it('is rejected without a matching stone', () => {
    const state = battle('charcoal');
    expect(validateCommand(state, 'player', { type: 'fight', moveIndex: 0, mega: true })).toBe(
      'That Pokémon cannot Mega Evolve.',
    );
  });

  it('survives a switch-out and returns to the base species in a snapshot', () => {
    const state = battle('gyaradosite');
    const fighter = activeFighter(state, 'player');
    megaEvolve(state, 'player');
    resetBattleState(fighter);
    expect(fighter.mega).toBe(true);
    expect(fighter.speciesId).toBe('gyaradosmega');
    expect(snapshotFighter(fighter).speciesId).toBe('gyarados');
    expect(snapshotFighter(fighter).ability).toBe('Intimidate');
  });

  it('keeps the nickname while the battle name follows the forme', () => {
    const state = createBattle({
      player: [
        createFighter({
          id: 'player',
          speciesId: 'gyarados',
          level: 40,
          nature: 'serious',
          moves: ['waterfall'],
          heldItem: 'gyaradosite',
          nickname: 'Nessie',
        }),
      ],
      enemy: [
        createFighter({
          id: 'enemy',
          speciesId: 'bulbasaur',
          level: 40,
          nature: 'serious',
          moves: ['tackle'],
        }),
      ],
      rng: new Rng(2026),
      isWild: true,
    });
    const fighter = activeFighter(state, 'player');
    expect(fighter.name).toBe('Nessie');

    expect(megaEvolve(state, 'player')).toBe(true);
    expect(fighter.nickname).toBe('Nessie');
    expect(fighter.name).not.toBe('Nessie');
    expect(snapshotFighter(fighter).nickname).toBe('Nessie');
    expect(snapshotFighter(fighter).speciesId).toBe('gyarados');
  });

  it('is deterministic for a fixed seed', () => {
    const run = (): BattleState => {
      const state = battle('gyaradosite');
      takeTurn(state, { type: 'fight', moveIndex: 0, mega: true }, chooseAiCommand(state, 'enemy'));
      return state;
    };
    const a = run();
    const b = run();
    expect(a.log).toEqual(b.log);
  });

  it('keeps the member’s permanent treats on the forme’s stats (Task-103)', () => {
    const state = battle('gyaradosite', 'bulbasaur', undefined, { atk: 3, spe: -1 });
    const fighter = activeFighter(state, 'player');
    const treats = { atk: 3, spe: -1 };
    const choice = statAtLevel(getSpecies('gyarados')!, 40, 'serious', fighter.ivs, fighter.evs, treats);
    expect(fighter.stats.atk).toBe(choice.atk);

    expect(megaEvolve(state, 'player')).toBe(true);
    const mega = statAtLevel(
      getSpecies('gyaradosmega')!,
      40,
      'serious',
      fighter.ivs,
      fighter.evs,
      treats,
    );
    expect(fighter.stats.atk).toBe(mega.atk);
    expect(fighter.stats.spe).toBe(mega.spe);
    expect(fighter.treats).toEqual(treats);
  });
});

describe('the AI spends its stone', () => {
  it('marks its first fight command with mega', () => {
    const state = battle(undefined, 'venusaur', 'venusaurite');
    const command = chooseAiCommand(state, 'enemy');
    expect(command).toEqual({ type: 'fight', moveIndex: expect.any(Number), mega: true });
  });

  it('does not mega without a stone', () => {
    const state = battle();
    expect(chooseAiCommand(state, 'enemy')).toEqual({
      type: 'fight',
      moveIndex: expect.any(Number),
    });
  });
});
