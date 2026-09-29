import { describe, expect, it } from 'vitest';
import { getMove } from '../../../data/dex';
import { Rng } from '../../rng';
import { createFighter, type BattleFighter } from '../fighter';
import { activeFighter, createBattle, type BattleState } from '../state';
import { takeTurn } from '../turn';
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
