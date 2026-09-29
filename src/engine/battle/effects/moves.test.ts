import { describe, expect, it } from 'vitest';
import { getMove } from '../../../data/dex';
import { Rng } from '../../rng';
import { createFighter, type BattleFighter } from '../fighter';
import { activeFighter, createBattle, type BattleState } from '../state';
import { autoReplace, needsReplacement, performSwitch, takeTurn, useMove } from '../turn';
import { getEffect } from './registry';
import { isProtectMove, moveEffects, protectBlocks } from './moves';

function fighter(id: string, speciesId: string, moves: readonly string[]): BattleFighter {
  return createFighter({ id, speciesId, level: 20, moves });
}

function battle(playerMoves: readonly string[], enemyMoves: readonly string[]): BattleState {
  return createBattle({
    player: [fighter('player', 'charmander', playerMoves)],
    enemy: [fighter('enemy', 'bulbasaur', enemyMoves)],
    rng: new Rng(11),
    isWild: true,
  });
}

describe('move effect registration', () => {
  it('registers the protect family and Recycle', () => {
    const ids = moveEffects().map((def) => def.id);
    expect(ids).toContain('protect');
    expect(ids).toContain('spikyshield');
    expect(ids).toContain('recycle');
    expect(ids).toContain('transform');
    for (const id of ids) expect(getEffect(id)?.kind).toBe('move');
    expect(isProtectMove('protect')).toBe(true);
    expect(isProtectMove('tackle')).toBe(false);
  });
});

describe('protect', () => {
  it('blocks the foe move for the turn and clears afterwards', () => {
    const state = battle(['protect', 'growl'], ['tackle']);
    const player = activeFighter(state, 'player');
    const before = player.hp;

    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });

    expect(activeFighter(state, 'player').hp).toBe(before);
    expect(state.log.some((event) => event.kind === 'text' && event.text.includes('protected itself'))).toBe(true);
    expect(activeFighter(state, 'player').volatiles.protect).toBeNull();
  });

  it('does not block field moves or the user', () => {
    const state = battle(['protect'], ['growl']);
    activeFighter(state, 'enemy').volatiles.protect = 'protect';
    expect(protectBlocks(state, 'player', getMove('raindance')!)).toBe(false);
  });

  it('Spiky Shield hurts a contact attacker, Baneful Bunker poisons it', () => {
    const spikes = battle(['tackle'], ['growl']);
    const spikesAttacker = activeFighter(spikes, 'player');
    activeFighter(spikes, 'enemy').volatiles.protect = 'spikyshield';
    expect(protectBlocks(spikes, 'player', getMove('tackle')!)).toBe(true);
    expect(spikesAttacker.hp).toBe(spikesAttacker.maxHp - Math.max(1, Math.floor(spikesAttacker.maxHp / 8)));

    const bunker = battle(['tackle'], ['growl']);
    activeFighter(bunker, 'enemy').volatiles.protect = 'banefulbunker';
    protectBlocks(bunker, 'player', getMove('tackle')!);
    expect(activeFighter(bunker, 'player').status).toBe('psn');

    const burning = createBattle({
      player: [fighter('player', 'bulbasaur', ['tackle'])],
      enemy: [fighter('enemy', 'charmander', ['growl'])],
      rng: new Rng(11),
      isWild: true,
    });
    activeFighter(burning, 'enemy').volatiles.protect = 'burningbulwark';
    protectBlocks(burning, 'player', getMove('tackle')!);
    expect(activeFighter(burning, 'player').status).toBe('brn');
  });

  it('Silk Trap lowers the contact attacker Speed', () => {
    const state = battle(['tackle'], ['growl']);
    activeFighter(state, 'enemy').volatiles.protect = 'silktrap';
    protectBlocks(state, 'player', getMove('tackle')!);
    expect(activeFighter(state, 'player').boosts.spe).toBe(-1);
  });
});

describe('Recycle', () => {
  it('restores the last consumed held item', () => {
    const state = battle(['recycle', 'growl'], ['growl']);
    const player = activeFighter(state, 'player');
    player.heldItem = null;
    player.lastItemId = 'sitrusberry';

    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });

    expect(activeFighter(state, 'player').heldItem).toBe('sitrusberry');
    expect(activeFighter(state, 'player').lastItemId).toBeNull();
  });

  it('fails when there is nothing to recycle', () => {
    const state = battle(['recycle', 'growl'], ['growl']);
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(state.log.some((event) => event.kind === 'text' && event.text === 'But it failed!')).toBe(true);
  });
});

describe('charge moves', () => {
  it('charges for a turn then releases, ignoring the next command', () => {
    const state = createBattle({
      player: [fighter('player', 'bulbasaur', ['solarbeam', 'growl'])],
      enemy: [fighter('enemy', 'charmander', ['growl'])],
      rng: new Rng(11),
      isWild: true,
    });
    const enemyHp = activeFighter(state, 'enemy').hp;

    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'player').volatiles.charging).toBe('solarbeam');
    expect(activeFighter(state, 'enemy').hp).toBe(enemyHp);

    takeTurn(state, { type: 'fight', moveIndex: 1 }, { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'player').volatiles.charging).toBeNull();
    expect(activeFighter(state, 'enemy').hp).toBeLessThan(enemyHp);
  });

  it('skips the charge in harsh sunlight', () => {
    const state = createBattle({
      player: [fighter('player', 'bulbasaur', ['solarbeam'])],
      enemy: [fighter('enemy', 'charmander', ['growl'])],
      rng: new Rng(11),
      isWild: true,
    });
    state.weather = 'sun';
    const enemyHp = activeFighter(state, 'enemy').hp;
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'player').volatiles.charging).toBeNull();
    expect(activeFighter(state, 'enemy').hp).toBeLessThan(enemyHp);
  });
});

describe('damage counters', () => {
  it('Counter pays back double the physical damage taken this turn', () => {
    const state = createBattle({
      player: [fighter('player', 'snorlax', ['counter', 'tackle'])],
      enemy: [fighter('enemy', 'charmander', ['tackle'])],
      rng: new Rng(13),
      isWild: true,
    });
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'enemy').hp).toBeLessThan(activeFighter(state, 'enemy').maxHp);
  });

  it('Counter fails when no physical damage was taken', () => {
    const state = createBattle({
      player: [fighter('player', 'snorlax', ['counter', 'tackle'])],
      enemy: [fighter('enemy', 'charmander', ['growl'])],
      rng: new Rng(13),
      isWild: true,
    });
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(state.log.some((event) => event.kind === 'text' && event.text === 'But it failed!')).toBe(true);
  });

  it('Mirror Coat answers special damage and is blocked by type immunity', () => {
    const state = createBattle({
      player: [fighter('player', 'snorlax', ['mirrorcoat', 'tackle'])],
      enemy: [fighter('enemy', 'charmander', ['ember'])],
      rng: new Rng(13),
      isWild: true,
    });
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'enemy').hp).toBeLessThan(activeFighter(state, 'enemy').maxHp);

    const ghost = createBattle({
      player: [fighter('player', 'snorlax', ['counter', 'tackle'])],
      enemy: [fighter('enemy', 'gastly', ['tackle'])],
      rng: new Rng(13),
      isWild: true,
    });
    takeTurn(ghost, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(ghost.log.some((event) => event.kind === 'text' && event.text.includes("doesn't affect"))).toBe(true);
  });
});

describe('Yawn and Wish', () => {
  it('Yawn puts the target to sleep after a turn', () => {
    const state = createBattle({
      player: [fighter('player', 'bulbasaur', ['yawn', 'growl'])],
      enemy: [fighter('enemy', 'charmander', ['growl'])],
      rng: new Rng(11),
      isWild: true,
    });
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'enemy').volatiles.yawn).toBe(1);

    takeTurn(state, { type: 'fight', moveIndex: 1 }, { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'enemy').status).toBe('slp');
  });

  it('Wish heals the active Pokémon two turns later', () => {
    const state = createBattle({
      player: [fighter('player', 'bulbasaur', ['wish', 'growl'])],
      enemy: [fighter('enemy', 'charmander', ['growl'])],
      rng: new Rng(11),
      isWild: true,
    });
    const player = activeFighter(state, 'player');
    player.hp = Math.floor(player.maxHp / 4);

    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'player').hp).toBe(Math.floor(player.maxHp / 4));

    takeTurn(state, { type: 'fight', moveIndex: 1 }, { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'player').hp).toBeGreaterThan(Math.floor(player.maxHp / 4));
  });
});

describe('switch moves', () => {
  it('U-turn asks for a replacement after damaging', () => {
    const state = createBattle({
      player: [
        fighter('p1', 'charmander', ['uturn', 'growl']),
        fighter('p2', 'squirtle', ['tackle']),
      ],
      enemy: [fighter('enemy', 'bulbasaur', ['growl'])],
      rng: new Rng(11),
      isWild: true,
    });
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'enemy').hp).toBeLessThan(activeFighter(state, 'enemy').maxHp);
    expect(needsReplacement(state)).toContain('player');

    autoReplace(state);
    expect(activeFighter(state, 'player').id).toBe('p2');
  });

  it('Baton Pass hands the stat boosts to the replacement', () => {
    const state = createBattle({
      player: [
        fighter('p1', 'charmander', ['swordsdance', 'batonpass']),
        fighter('p2', 'squirtle', ['tackle']),
      ],
      enemy: [fighter('enemy', 'bulbasaur', ['splash'])],
      rng: new Rng(11),
      isWild: true,
    });
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'player').boosts.atk).toBe(2);

    takeTurn(state, { type: 'fight', moveIndex: 1 }, { type: 'fight', moveIndex: 0 });
    expect(needsReplacement(state)).toContain('player');

    autoReplace(state);
    expect(activeFighter(state, 'player').id).toBe('p2');
    expect(activeFighter(state, 'player').boosts.atk).toBe(2);
  });
});

describe('transform', () => {
  it('copies the target shape but not HP', () => {
    const state = createBattle({
      player: [fighter('player', 'ditto', ['transform'])],
      enemy: [fighter('enemy', 'charizard', ['ember'])],
      rng: new Rng(11),
      isWild: true,
    });
    const ditto = activeFighter(state, 'player');
    const charizard = activeFighter(state, 'enemy');
    charizard.hp = charizard.maxHp - 7;

    useMove(state, 'player', { type: 'fight', moveIndex: 0 });

    expect(ditto.speciesId).toBe('charizard');
    expect(ditto.types).toEqual(charizard.types);
    expect(ditto.ability).toBe(charizard.ability);
    expect(ditto.stats.atk).toBe(charizard.stats.atk);
    expect(ditto.hp).toBe(ditto.maxHp);
    expect(ditto.moves.map((slot) => slot.moveId)).toEqual(['ember']);
    expect(ditto.volatiles.transformed).toBe(true);
  });

  it('reverts to the original shape on switch out', () => {
    const state = createBattle({
      player: [fighter('p1', 'ditto', ['transform']), fighter('p2', 'charmander', ['tackle'])],
      enemy: [fighter('enemy', 'charizard', ['splash'])],
      rng: new Rng(11),
      isWild: true,
    });
    const ditto = state.sides.player.party[0];
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    expect(ditto.speciesId).toBe('charizard');

    performSwitch(state, 'player', 1);
    expect(ditto.speciesId).toBe('ditto');
    expect(ditto.transformBackup).toBeNull();
    expect(ditto.volatiles.transformed).toBe(false);
  });
});
