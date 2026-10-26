import { describe, expect, it } from 'vitest';
import { getMove } from '../../../data/dex';
import { Rng } from '../../rng';
import { legalMoveIndices } from '../commands';
import { createFighter, isGrounded, type BattleFighter } from '../fighter';
import { activeFighter, createBattle, type BattleState } from '../state';
import { autoReplace, needsReplacement, performSwitch, takeTurn, useMove } from '../turn';
import { movePreview } from '../preview';
import { getEffect } from './registry';
import { isProtectMove, moveEffects, protectBlocks } from './moves';
import { setTerrain } from './terrain';
import { setWeather } from './weather';

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
    expect(
      state.log.some((event) => event.kind === 'text' && event.key === 'battle.log.protectedItself'),
    ).toBe(true);
    expect(activeFighter(state, 'player').volatiles.protect).toBeNull();
  });

  it('does not block field moves or the user', () => {
    const state = battle(['protect'], ['growl']);
    activeFighter(state, 'enemy').volatiles.protect = 'protect';
    expect(protectBlocks(state, 'player', getMove('raindance')!)).toBe(false);
  });

  it('lets Unseen Fist break protection from the second ability slot', () => {
    const state = createBattle({
      player: [
        createFighter({
          id: 'player',
          speciesId: 'charmander',
          level: 20,
          ability: 'Blaze',
          secondAbility: 'Unseen Fist',
          moves: ['tackle'],
        }),
      ],
      enemy: [fighter('enemy', 'bulbasaur', ['growl'])],
      rng: new Rng(11),
      isWild: true,
    });
    activeFighter(state, 'enemy').volatiles.protect = 'protect';
    expect(protectBlocks(state, 'player', getMove('tackle')!)).toBe(false);
  });

  it('Spiky Shield hurts a contact attacker, Baneful Bunker poisons it', () => {
    const spikes = battle(['tackle'], ['growl']);
    const spikesAttacker = activeFighter(spikes, 'player');
    activeFighter(spikes, 'enemy').volatiles.protect = 'spikyshield';
    expect(protectBlocks(spikes, 'player', getMove('tackle')!)).toBe(true);
    expect(spikesAttacker.hp).toBe(
      spikesAttacker.maxHp - Math.max(1, Math.floor(spikesAttacker.maxHp / 8)),
    );

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
    expect(state.log.some((event) => event.kind === 'text' && event.key === 'battle.log.fail')).toBe(
      true,
    );
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
    expect(state.log.some((event) => event.kind === 'text' && event.key === 'battle.log.fail')).toBe(
      true,
    );
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
    expect(ghost.log.some((event) => event.kind === 'text' && event.key === 'battle.log.noEffect')).toBe(
      true,
    );
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
      player: [fighter('p1', 'charmander', ['uturn', 'growl']), fighter('p2', 'squirtle', ['tackle'])],
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

describe('variable-type moves', () => {
  it('Weather Ball follows the weather', () => {
    const state = battle(['weatherball'], ['tackle']);
    expect(movePreview(state, 'player', 0)?.type).toBe('Normal');
    setWeather(state, 'sun');
    expect(movePreview(state, 'player', 0)?.type).toBe('Fire');
    setWeather(state, 'rain');
    expect(movePreview(state, 'player', 0)?.type).toBe('Water');
    setWeather(state, 'sand');
    expect(movePreview(state, 'player', 0)?.type).toBe('Rock');
    setWeather(state, 'snow');
    expect(movePreview(state, 'player', 0)?.type).toBe('Ice');
  });

  it('Terrain Pulse follows the terrain', () => {
    const state = battle(['terrainpulse'], ['tackle']);
    expect(movePreview(state, 'player', 0)?.type).toBe('Normal');
    setTerrain(state, 'electric');
    expect(movePreview(state, 'player', 0)?.type).toBe('Electric');
    setTerrain(state, 'grassy');
    expect(movePreview(state, 'player', 0)?.type).toBe('Grass');
    setTerrain(state, 'misty');
    expect(movePreview(state, 'player', 0)?.type).toBe('Fairy');
    setTerrain(state, 'psychic');
    expect(movePreview(state, 'player', 0)?.type).toBe('Psychic');
  });

  it('Revelation Dance takes the user primary type', () => {
    const state = createBattle({
      player: [fighter('player', 'oricoriopompom', ['revelationdance'])],
      enemy: [fighter('enemy', 'bulbasaur', ['tackle'])],
      rng: new Rng(11),
      isWild: true,
    });
    expect(movePreview(state, 'player', 0)?.type).toBe('Electric');
  });

  it('Aura Wheel is Dark for a Hangry Morpeko, Electric otherwise', () => {
    const hangry = createBattle({
      player: [fighter('player', 'morpekohangry', ['aurawheel'])],
      enemy: [fighter('enemy', 'bulbasaur', ['tackle'])],
      rng: new Rng(11),
      isWild: true,
    });
    expect(movePreview(hangry, 'player', 0)?.type).toBe('Dark');
    const full = createBattle({
      player: [fighter('player', 'morpeko', ['aurawheel'])],
      enemy: [fighter('enemy', 'bulbasaur', ['tackle'])],
      rng: new Rng(11),
      isWild: true,
    });
    expect(movePreview(full, 'player', 0)?.type).toBe('Electric');
  });
});

describe('call-a-move seam', () => {
  const run = (playerMoves: readonly string[], enemyMoves: readonly string[], seed = 11): BattleState =>
    createBattle({
      player: [fighter('player', 'charmander', playerMoves)],
      enemy: [fighter('enemy', 'bulbasaur', enemyMoves)],
      rng: new Rng(seed),
      isWild: true,
    });

  it('Metronome is seed-stable and calls a real move', () => {
    const a = run(['metronome', 'growl'], ['growl']);
    const b = run(['metronome', 'growl'], ['growl']);
    takeTurn(a, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    takeTurn(b, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(a.log).toEqual(b.log);
    const moves = a.log.flatMap((event) => (event.kind === 'move' ? [event.moveId] : []));
    expect(moves[0]).toBe('metronome');
    expect(moves.length).toBeGreaterThan(1);
  });

  it('Copycat repeats the last move used', () => {
    const state = run(['growl', 'copycat'], ['tackle']);
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    takeTurn(state, { type: 'fight', moveIndex: 1 }, { type: 'fight', moveIndex: 0 });
    expect(
      state.log.some(
        (event) => event.kind === 'move' && event.side === 'player' && event.moveId === 'tackle',
      ),
    ).toBe(true);
  });

  it('Mirror Move copies the foe last move', () => {
    const state = run(['growl', 'mirrormove'], ['tackle']);
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    takeTurn(state, { type: 'fight', moveIndex: 1 }, { type: 'fight', moveIndex: 0 });
    expect(
      state.log.some(
        (event) => event.kind === 'move' && event.side === 'player' && event.moveId === 'tackle',
      ),
    ).toBe(true);
  });

  it('Assist draws a move from the bench', () => {
    const state = createBattle({
      player: [fighter('p1', 'charmander', ['assist']), fighter('p2', 'squirtle', ['watergun'])],
      enemy: [fighter('enemy', 'bulbasaur', ['growl'])],
      rng: new Rng(11),
      isWild: true,
    });
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(
      state.log.some(
        (event) => event.kind === 'move' && event.side === 'player' && event.moveId === 'watergun',
      ),
    ).toBe(true);
  });

  it('Nature Power calls the terrain move', () => {
    const state = run(['naturepower'], ['growl']);
    setTerrain(state, 'electric');
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(
      state.log.some(
        (event) => event.kind === 'move' && event.side === 'player' && event.moveId === 'thunderbolt',
      ),
    ).toBe(true);
  });

  it('Sleep Talk only fires while asleep', () => {
    const state = run(['sleeptalk', 'growl'], ['growl']);
    const player = activeFighter(state, 'player');
    player.status = 'slp';
    player.statusCounter = 3;
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    const moves = state.log.flatMap((event) =>
      event.kind === 'move' && event.side === 'player' ? [event.moveId] : [],
    );
    expect(moves[0]).toBe('sleeptalk');
    expect(moves.length).toBeGreaterThan(1);
  });
});

describe('ported status moves', () => {
  it('Reflect sets a side condition on the user side', () => {
    const state = battle(['reflect', 'growl'], ['growl']);
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(state.sides.player.sideConditions.reflect).toBeGreaterThan(0);
  });

  it('Trick Room twists the dimensions', () => {
    const state = battle(['trickroom', 'growl'], ['growl']);
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(state.field.trickroom).toBeGreaterThan(0);
  });

  it('Aqua Ring restores HP at the end of the turn', () => {
    const state = battle(['aquaring', 'growl'], ['growl']);
    const player = activeFighter(state, 'player');
    player.hp = Math.floor(player.maxHp / 2);
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(player.volatiles.aquaRing).toBe(true);
    expect(player.hp).toBeGreaterThan(Math.floor(player.maxHp / 2));
  });

  it('Endure survives the hit at 1 HP', () => {
    const state = battle(['endure', 'growl'], ['tackle']);
    const player = activeFighter(state, 'player');
    player.hp = 1;
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(player.hp).toBe(1);
    expect(
      state.log.some((event) => event.kind === 'text' && event.key === 'battle.log.enduredHit'),
    ).toBe(true);
  });

  it('Focus Energy raises the crit ratio for the rest of the battle', () => {
    const state = battle(['focusenergy', 'growl'], ['growl']);
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'player').volatiles.focusEnergy).toBe(true);
  });

  it('Haze clears both sides stat changes', () => {
    const state = battle(['swordsdance', 'haze'], ['tackle']);
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'player').boosts.atk).toBe(2);
    takeTurn(state, { type: 'fight', moveIndex: 1 }, { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'player').boosts.atk).toBe(0);
  });

  it('Block traps the target', () => {
    const state = battle(['block', 'growl'], ['growl']);
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'enemy').volatiles.trapped).toBe(true);
  });

  it('Stockpile banks charges and Swallow spends them', () => {
    const state = battle(['stockpile', 'swallow'], ['growl']);
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    const player = activeFighter(state, 'player');
    expect(player.volatiles.stockpile).toBe(1);
    expect(player.boosts.def).toBe(1);
    player.hp = Math.floor(player.maxHp / 2);
    takeTurn(state, { type: 'fight', moveIndex: 1 }, { type: 'fight', moveIndex: 0 });
    expect(player.volatiles.stockpile).toBe(0);
    expect(player.hp).toBeGreaterThan(Math.floor(player.maxHp / 2));
  });

  it('Conversion takes the type of the first move', () => {
    const state = battle(['conversion', 'growl'], ['growl']);
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'player').types).toEqual(['Normal']);
  });

  it('Camouflage follows the terrain', () => {
    const state = battle(['camouflage', 'growl'], ['growl']);
    setTerrain(state, 'electric');
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'player').types).toEqual(['Electric']);
  });

  it('Rest heals to full and sleeps for two turns', () => {
    const state = battle(['rest', 'growl'], ['growl']);
    const player = activeFighter(state, 'player');
    player.hp = 1;
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(player.hp).toBe(player.maxHp);
    expect(player.status).toBe('slp');
    expect(player.statusCounter).toBe(2);
  });

  it('Tidy Up raises Attack and Speed', () => {
    const state = battle(['tidyup', 'growl'], ['tackle']);
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'player').boosts.atk).toBe(1);
    expect(activeFighter(state, 'player').boosts.spe).toBe(1);
  });

  it('Gravity grounds the field', () => {
    const state = battle(['gravity', 'growl'], ['growl']);
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(state.field.gravity).toBeGreaterThan(0);
  });

  it('Destiny Bond drags the attacker down', () => {
    const state = createBattle({
      player: [fighter('player', 'gastly', ['destinybond'])],
      enemy: [fighter('enemy', 'charmander', ['ember'])],
      rng: new Rng(11),
      isWild: true,
    });
    activeFighter(state, 'player').hp = 1;
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'enemy').hp).toBe(0);
  });
});

/** A battle with the given held items, for the item and ability families. */
function heldBattle(
  playerMoves: readonly string[],
  enemyMoves: readonly string[],
  held: Readonly<{ player?: string; enemy?: string }> = {},
): BattleState {
  return createBattle({
    player: [
      createFighter({
        id: 'player',
        speciesId: 'charmander',
        level: 20,
        moves: playerMoves,
        ...(held.player ? { heldItem: held.player } : {}),
      }),
    ],
    enemy: [
      createFighter({
        id: 'enemy',
        speciesId: 'bulbasaur',
        level: 20,
        moves: enemyMoves,
        ...(held.enemy ? { heldItem: held.enemy } : {}),
      }),
    ],
    rng: new Rng(11),
    isWild: true,
  });
}

/** The battle's text lines, in order. */
function texts(state: BattleState): readonly string[] {
  return state.log.flatMap((event) => (event.kind === 'text' ? [event.key] : []));
}

/** A battle against a plain Normal-type target, for the type and identity writes. */
function normalBattle(playerMoves: readonly string[]): BattleState {
  return createBattle({
    player: [createFighter({ id: 'player', speciesId: 'charmander', level: 20, moves: playerMoves })],
    enemy: [createFighter({ id: 'enemy', speciesId: 'ditto', level: 20, moves: ['splash'] })],
    rng: new Rng(11),
    isWild: true,
  });
}

describe('the status half — infatuation and the move lock', () => {
  it('Attract infatuates an opposite-gender foe and spends no draw of its own', () => {
    class CountingRng extends Rng {
      draws = 0;
      override next(): number {
        this.draws += 1;
        return super.next();
      }
    }
    const rng = new CountingRng(11);
    const state = createBattle({
      player: [createFighter({ id: 'player', speciesId: 'miltank', level: 20, moves: ['attract'] })],
      enemy: [createFighter({ id: 'enemy', speciesId: 'tauros', level: 20, moves: ['tackle'] })],
      rng,
      isWild: true,
    });
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'enemy').volatiles.attract).toBe(true);
    // The turn's coin flip lives in `beforeMoveVolatile`; Attract adds no draw.
    expect(rng.draws).toBe(0);
  });

  it('Attract writes nothing between two genderless fighters', () => {
    const state = battle(['attract'], ['tackle']);
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'enemy').volatiles.attract).toBe(false);
  });

  it('Disable writes disabledMove and disableTurns and legalMoveIndices drops it', () => {
    const state = battle(['disable'], ['tackle', 'growl']);
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    const enemy = activeFighter(state, 'enemy');
    const locked = enemy.volatiles.disabledMove;
    expect(locked).not.toBeNull();
    expect(enemy.volatiles.disableTurns).toBe(4);
    const index = enemy.moves.findIndex((slot) => slot.moveId === locked);
    expect(legalMoveIndices(enemy)).not.toContain(index);
  });

  it('Torment records the repeat bar and refuses the same move twice in a row', () => {
    const state = battle(['torment'], ['tackle']);
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    const enemy = activeFighter(state, 'enemy');
    expect(enemy.volatiles.torment).toBe(true);

    enemy.lastMoveId = 'tackle';
    const before = activeFighter(state, 'player').hp;
    useMove(state, 'enemy', { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'player').hp).toBe(before);
    expect(texts(state)).toContain('battle.log.encoreLocked');
  });

  it('Encore records the move it locks', () => {
    const state = battle(['encore'], ['tackle', 'growl']);
    const enemy = activeFighter(state, 'enemy');
    enemy.lastMoveId = 'growl';
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    expect(enemy.volatiles.encoreMove).toBe('growl');
    expect(enemy.volatiles.encore).toBe(3);
  });

  it('Imprison writes the volatile that seals the foe moves', () => {
    const state = battle(['imprison'], ['tackle']);
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'player').volatiles.imprison).toBe(true);
  });
});

describe('the status half — residual volatiles', () => {
  it('Nightmare chips a sleeping target for a quarter of its max HP', () => {
    const state = battle(['nightmare', 'growl'], ['splash']);
    const enemy = activeFighter(state, 'enemy');
    enemy.status = 'slp';
    enemy.statusCounter = 3;
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(enemy.volatiles.nightmare).toBe(true);
    expect(enemy.hp).toBe(enemy.maxHp - Math.max(1, Math.floor(enemy.maxHp / 4)));
  });

  it('Nightmare refuses a target that is awake', () => {
    const state = battle(['nightmare'], ['splash']);
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'enemy').volatiles.nightmare).toBe(false);
  });

  it('Octolock traps the target and drops its Defense and Sp. Def each pass', () => {
    const state = battle(['octolock'], ['splash']);
    const enemy = activeFighter(state, 'enemy');
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(enemy.volatiles.octolock).toBe(true);
    expect(enemy.volatiles.trapped).toBe(true);
    expect(enemy.boosts.def).toBe(-1);
    expect(enemy.boosts.spd).toBe(-1);
  });

  it('Curse from a non-Ghost trades Speed for Attack and Defense', () => {
    const state = battle(['curse'], ['splash']);
    const player = activeFighter(state, 'player');
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    expect(player.boosts.atk).toBe(1);
    expect(player.boosts.def).toBe(1);
    expect(player.boosts.spe).toBe(-1);
    expect(player.volatiles.curse).toBe(false);
  });

  it('Aqua Ring heals the holder each residual pass', () => {
    const state = battle(['aquaring'], ['splash']);
    const player = activeFighter(state, 'player');
    player.hp = Math.floor(player.maxHp / 2);
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(player.volatiles.aquaRing).toBe(true);
    expect(player.hp).toBeGreaterThan(Math.floor(player.maxHp / 2));
  });
});

describe('the status half — trapping and grounding', () => {
  it('Spider Web traps the foe', () => {
    const state = battle(['spiderweb'], ['splash']);
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'enemy').volatiles.trapped).toBe(true);
  });

  it('Telekinesis lifts the target off the ground for three turns', () => {
    const state = battle(['telekinesis'], ['splash']);
    const enemy = activeFighter(state, 'enemy');
    expect(isGrounded(enemy)).toBe(true);
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    expect(enemy.volatiles.telekinesis).toBe(3);
    expect(isGrounded(enemy)).toBe(false);
  });

  it('Smack Down knocks a Flying target to the ground', () => {
    const state = createBattle({
      player: [createFighter({ id: 'player', speciesId: 'aerodactyl', level: 5, moves: ['smackdown'] })],
      enemy: [createFighter({ id: 'enemy', speciesId: 'skarmory', level: 30, moves: ['splash'] })],
      rng: new Rng(11),
      isWild: true,
    });
    const enemy = activeFighter(state, 'enemy');
    expect(isGrounded(enemy)).toBe(false);
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    expect(enemy.volatiles.grounded).toBe(true);
    expect(isGrounded(enemy)).toBe(true);
  });
});

describe('the status half — accuracy locks', () => {
  it('Lock-On and Mind Reader mark the user sure to hit', () => {
    for (const moveId of ['lockon', 'mindreader']) {
      const state = battle([moveId], ['splash']);
      useMove(state, 'player', { type: 'fight', moveIndex: 0 });
      expect(activeFighter(state, 'player').volatiles.lockOn, moveId).toBe(true);
    }
  });

  it('Lock-On is spent by the next damaging move', () => {
    const state = battle(['lockon', 'tackle'], ['splash']);
    const player = activeFighter(state, 'player');
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    expect(player.volatiles.lockOn).toBe(true);
    useMove(state, 'player', { type: 'fight', moveIndex: 1 });
    expect(player.volatiles.lockOn).toBe(false);
  });
});

describe('the status half — type and identity writes', () => {
  it('Soak sets both of a dual-type target types to Water', () => {
    const state = createBattle({
      player: [createFighter({ id: 'player', speciesId: 'charmander', level: 20, moves: ['soak'] })],
      enemy: [createFighter({ id: 'enemy', speciesId: 'charizard', level: 20, moves: ['splash'] })],
      rng: new Rng(11),
      isWild: true,
    });
    const enemy = activeFighter(state, 'enemy');
    expect(enemy.types).toEqual(['Fire', 'Flying']);
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    expect(enemy.types).toEqual(['Water']);
  });

  it('Soak types come back on switch out', () => {
    const state = createBattle({
      player: [createFighter({ id: 'player', speciesId: 'charmander', level: 20, moves: ['soak'] })],
      enemy: [
        createFighter({ id: 'e1', speciesId: 'charizard', level: 20, moves: ['splash'] }),
        createFighter({ id: 'e2', speciesId: 'bulbasaur', level: 20, moves: ['splash'] }),
      ],
      rng: new Rng(11),
      isWild: true,
    });
    const enemy = activeFighter(state, 'enemy');
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    expect(enemy.types).toEqual(['Water']);
    performSwitch(state, 'enemy', 1);
    expect(enemy.types).toEqual(['Fire', 'Flying']);
  });

  it('Reflect Type copies the target types onto the user', () => {
    const state = createBattle({
      player: [
        createFighter({ id: 'player', speciesId: 'charmander', level: 20, moves: ['reflecttype'] }),
      ],
      enemy: [createFighter({ id: 'enemy', speciesId: 'pikachu', level: 20, moves: ['splash'] })],
      rng: new Rng(11),
      isWild: true,
    });
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'player').types).toEqual(['Electric']);
  });

  it('Magic Powder turns the target Psychic', () => {
    const state = battle(['magicpowder'], ['splash']);
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'enemy').types).toEqual(['Psychic']);
  });

  it("Forest's Curse and Trick-or-Treat add a type to the target", () => {
    const grass = normalBattle(['forestscurse']);
    useMove(grass, 'player', { type: 'fight', moveIndex: 0 });
    expect(activeFighter(grass, 'enemy').types).toEqual(['Normal', 'Grass']);

    const ghost = normalBattle(['trickortreat']);
    useMove(ghost, 'player', { type: 'fight', moveIndex: 0 });
    expect(activeFighter(ghost, 'enemy').types).toEqual(['Normal', 'Ghost']);
  });

  it('the second added type replaces the first', () => {
    const state = normalBattle(['forestscurse', 'trickortreat']);
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    useMove(state, 'player', { type: 'fight', moveIndex: 1 });
    expect(activeFighter(state, 'enemy').types).toEqual(['Normal', 'Ghost']);
  });
});

describe('the status half — ability writes', () => {
  it('Simple Beam and Worry Seed hand the target Insomnia', () => {
    for (const moveId of ['simplebeam', 'worryseed']) {
      const state = battle([moveId], ['splash']);
      useMove(state, 'player', { type: 'fight', moveIndex: 0 });
      expect(activeFighter(state, 'enemy').ability, moveId).toBe('Insomnia');
    }
  });

  it('Gastro Acid writes the volatile that suppresses the ability', () => {
    const state = battle(['gastroacid'], ['splash']);
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'enemy').volatiles.gastroAcid).toBe(true);
  });

  it('Entrainment copies the user ability onto the target', () => {
    const state = battle(['entrainment'], ['splash']);
    const player = activeFighter(state, 'player');
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'enemy').ability).toBe(player.ability);
  });

  it('Skill Swap swaps both abilities', () => {
    const state = battle(['skillswap'], ['splash']);
    const player = activeFighter(state, 'player');
    const enemy = activeFighter(state, 'enemy');
    const mine = player.ability;
    const theirs = enemy.ability;
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    expect(player.ability).toBe(theirs);
    expect(enemy.ability).toBe(mine);
  });
});

describe('the status half — stat and speed exchanges', () => {
  it('Heart Swap trades every stat stage', () => {
    const state = battle(['heartswap'], ['splash']);
    const player = activeFighter(state, 'player');
    const enemy = activeFighter(state, 'enemy');
    player.boosts.atk = 2;
    enemy.boosts.spd = -1;
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    expect(player.boosts.spd).toBe(-1);
    expect(player.boosts.atk).toBe(0);
    expect(enemy.boosts.atk).toBe(2);
  });

  it('Power Swap and Guard Swap trade only their own pair of stages', () => {
    const power = battle(['powerswap'], ['splash']);
    const powerPlayer = activeFighter(power, 'player');
    const powerEnemy = activeFighter(power, 'enemy');
    powerPlayer.boosts.atk = 1;
    powerEnemy.boosts.spa = 2;
    powerEnemy.boosts.def = 2;
    useMove(power, 'player', { type: 'fight', moveIndex: 0 });
    expect(powerPlayer.boosts.spa).toBe(2);
    expect(powerEnemy.boosts.atk).toBe(1);
    expect(powerEnemy.boosts.def).toBe(2);

    const guard = battle(['guardswap'], ['splash']);
    const guardPlayer = activeFighter(guard, 'player');
    const guardEnemy = activeFighter(guard, 'enemy');
    guardPlayer.boosts.def = 1;
    guardEnemy.boosts.spd = 3;
    useMove(guard, 'player', { type: 'fight', moveIndex: 0 });
    expect(guardPlayer.boosts.spd).toBe(3);
    expect(guardEnemy.boosts.def).toBe(1);
  });

  it('Speed Swap trades the raw Speed stat', () => {
    const state = battle(['speedswap'], ['splash']);
    const player = activeFighter(state, 'player');
    const enemy = activeFighter(state, 'enemy');
    const mine = player.stats.spe;
    const theirs = enemy.stats.spe;
    expect(mine).not.toBe(theirs);
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    expect(player.stats.spe).toBe(theirs);
    expect(enemy.stats.spe).toBe(mine);
  });

  it('Power Split and Guard Split hand both fighters the average stat', () => {
    const power = battle(['powersplit'], ['splash']);
    const powerPlayer = activeFighter(power, 'player');
    const powerEnemy = activeFighter(power, 'enemy');
    const atkAverage = Math.floor((powerPlayer.stats.atk + powerEnemy.stats.atk) / 2);
    useMove(power, 'player', { type: 'fight', moveIndex: 0 });
    expect(powerPlayer.stats.atk).toBe(atkAverage);
    expect(powerEnemy.stats.atk).toBe(atkAverage);

    const guard = battle(['guardsplit'], ['splash']);
    const guardPlayer = activeFighter(guard, 'player');
    const guardEnemy = activeFighter(guard, 'enemy');
    const defAverage = Math.floor((guardPlayer.stats.def + guardEnemy.stats.def) / 2);
    useMove(guard, 'player', { type: 'fight', moveIndex: 0 });
    expect(guardPlayer.stats.def).toBe(defAverage);
    expect(guardEnemy.stats.def).toBe(defAverage);
  });
});

describe('the status half — heals aimed at the foe', () => {
  it('Heal Pulse restores half of the target max HP', () => {
    const state = battle(['healpulse'], ['splash']);
    const enemy = activeFighter(state, 'enemy');
    enemy.hp = 10;
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    expect(enemy.hp).toBe(10 + Math.max(1, Math.floor(enemy.maxHp / 2)));
  });

  it('Floral Healing heals the target and more under Grassy Terrain', () => {
    const plain = battle(['floralhealing'], ['splash']);
    const plainEnemy = activeFighter(plain, 'enemy');
    plainEnemy.hp = 10;
    useMove(plain, 'player', { type: 'fight', moveIndex: 0 });
    const plainHeal = plainEnemy.hp - 10;

    const grassy = battle(['floralhealing'], ['splash']);
    setTerrain(grassy, 'grassy');
    const grassyEnemy = activeFighter(grassy, 'enemy');
    grassyEnemy.hp = 10;
    useMove(grassy, 'player', { type: 'fight', moveIndex: 0 });
    expect(plainHeal).toBe(Math.floor(plainEnemy.maxHp / 2));
    expect(grassyEnemy.hp - 10).toBeGreaterThan(plainHeal);
  });

  it('Purify cures the target and heals the user by half', () => {
    const state = battle(['purify'], ['splash']);
    const player = activeFighter(state, 'player');
    const enemy = activeFighter(state, 'enemy');
    player.hp = 10;
    enemy.status = 'brn';
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    expect(enemy.status).toBeNull();
    expect(player.hp).toBe(10 + Math.max(1, Math.floor(player.maxHp / 2)));
  });

  it('Strength Sap heals by the target Attack and lowers it', () => {
    const state = battle(['strengthsap'], ['splash']);
    const player = activeFighter(state, 'player');
    const enemy = activeFighter(state, 'enemy');
    player.hp = 10;
    const attack = enemy.stats.atk;
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    expect(player.hp).toBe(10 + attack);
    expect(enemy.boosts.atk).toBe(-1);
  });
});

describe('the status half — status transfer', () => {
  it('Psycho Shift hands the user status to the target', () => {
    const state = battle(['psychoshift'], ['splash']);
    const player = activeFighter(state, 'player');
    const enemy = activeFighter(state, 'enemy');
    player.status = 'par';
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    expect(player.status).toBeNull();
    expect(enemy.status).toBe('par');
  });

  it('Psycho Shift fails without a status of its own', () => {
    const state = battle(['psychoshift'], ['splash']);
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'enemy').status).toBeNull();
  });
});

describe('the status half — items, moves and PP', () => {
  it('Trick and Switcheroo trade the two held items', () => {
    for (const moveId of ['trick', 'switcheroo']) {
      const state = heldBattle([moveId], ['splash'], { player: 'oranberry', enemy: 'sitrusberry' });
      useMove(state, 'player', { type: 'fight', moveIndex: 0 });
      expect(activeFighter(state, 'player').heldItem, moveId).toBe('sitrusberry');
      expect(activeFighter(state, 'enemy').heldItem, moveId).toBe('oranberry');
    }
  });

  it('Trick fails when neither side holds an item', () => {
    const state = battle(['trick'], ['splash']);
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    expect(texts(state)).toContain('battle.log.fail');
  });

  it('Embargo writes its five-turn volatile', () => {
    const state = battle(['embargo'], ['splash']);
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'enemy').volatiles.embargo).toBe(5);
  });

  it('Mimic copies the target last move into its own slot', () => {
    const state = battle(['mimic', 'growl'], ['tackle']);
    const enemy = activeFighter(state, 'enemy');
    enemy.lastMoveId = 'tackle';
    const player = activeFighter(state, 'player');
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    expect(player.moves[0].moveId).toBe('tackle');
    expect(player.moves[0].pp).toBe(Math.min(5, getMove('tackle')!.pp));
  });

  it('Spite drains four PP from the move the target last used', () => {
    const state = battle(['spite'], ['tackle']);
    const enemy = activeFighter(state, 'enemy');
    enemy.lastMoveId = 'tackle';
    const before = enemy.moves[0].pp;
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    expect(enemy.moves[0].pp).toBe(before - 4);
  });
});

describe('Pain Split', () => {
  it('shares the average of the two HP pools, the user first', () => {
    const state = battle(['painsplit'], ['splash']);
    const player = activeFighter(state, 'player');
    const enemy = activeFighter(state, 'enemy');
    enemy.hp = 23;
    const average = Math.floor((player.hp + enemy.hp) / 2);

    useMove(state, 'player', { type: 'fight', moveIndex: 0 });

    expect(player.hp).toBe(average);
    expect(enemy.hp).toBe(average);
    const kinds = state.log.flatMap((event) =>
      event.kind === 'heal' || event.kind === 'damage' ? [event.kind] : [],
    );
    expect(kinds).toEqual(['damage', 'heal']);
    expect(state.log.some((event) => event.kind === 'text' && event.key === 'battle.log.fail')).toBe(
      false,
    );
  });

  it('heals a hurt user and damages a healthy target toward the average', () => {
    const state = battle(['painsplit'], ['splash']);
    const player = activeFighter(state, 'player');
    const enemy = activeFighter(state, 'enemy');
    player.hp = 10;
    const average = Math.floor((10 + enemy.hp) / 2);

    useMove(state, 'player', { type: 'fight', moveIndex: 0 });

    expect(player.hp).toBe(average);
    expect(enemy.hp).toBe(average);
    const kinds = state.log.flatMap((event) =>
      event.kind === 'heal' || event.kind === 'damage' ? [event.kind] : [],
    );
    expect(kinds).toEqual(['heal', 'damage']);
  });
});

/**
 * Upper Hand is the first move whose outcome reads the **turn's commands**: the
 * foe's own pick decides whether the punch lands. A flinch is spent either when it
 * blocks the foe's move (`beforeMoveVolatile`) or on the end-of-turn pass, so the
 * volatile itself is only observable on a board where the foe has not acted yet.
 */
describe('Upper Hand', () => {
  const fight = { type: 'fight', moveIndex: 0 } as const;
  const commands = { player: { 0: fight }, enemy: { 0: fight } };

  it('lands and leaves the foe flinched when the foe picked a priority move', () => {
    const state = battle(['upperhand'], ['quickattack']);
    const enemy = activeFighter(state, 'enemy');
    const before = enemy.hp;

    useMove(state, 'player', fight, commands);

    expect(enemy.hp).toBeLessThan(before);
    expect(enemy.volatiles.flinched).toBe(true);
    expect(state.log.some((event) => event.kind === 'text' && event.key === 'battle.log.fail')).toBe(
      false,
    );
  });

  it('costs the foe its own priority move on the turn it flinches', () => {
    const state = battle(['upperhand'], ['quickattack']);
    const enemy = activeFighter(state, 'enemy');
    const before = enemy.hp;
    const playerHp = activeFighter(state, 'player').hp;

    takeTurn(state, fight, fight);

    expect(enemy.hp).toBeLessThan(before);
    expect(activeFighter(state, 'player').hp).toBe(playerHp);
    expect(
      state.log.some((event) => event.kind === 'text' && event.key === 'battle.log.flinched'),
    ).toBe(true);
  });

  it('fails, spends the PP and deals nothing when the foe picked a plain move', () => {
    const state = battle(['upperhand'], ['tackle']);
    const player = activeFighter(state, 'player');
    const enemy = activeFighter(state, 'enemy');
    const pp = player.moves[0].pp;

    takeTurn(state, fight, fight);

    expect(player.moves[0].pp).toBe(pp - 1);
    expect(
      state.log.filter((event) => event.kind === 'text' && event.key === 'battle.log.fail'),
    ).toHaveLength(1);
    expect(state.log.some((event) => event.kind === 'damage' && event.side === 'enemy')).toBe(false);
    expect(enemy.hp).toBe(enemy.maxHp);
    expect(enemy.volatiles.flinched).toBe(false);
  });
});
