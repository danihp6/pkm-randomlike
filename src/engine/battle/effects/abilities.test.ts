import { describe, expect, it } from 'vitest';
import { getMove } from '../../../data/dex';
import { Rng } from '../../rng';
import { createFighter, snapshotFighter, type BattleFighter } from '../fighter';
import {
  activeFighter,
  createBattle,
  effectiveWeather,
  isTrapped,
  opponentOf,
  type BattleState,
  type SideId,
} from '../state';
import {
  getEffect,
  makeContext,
  runAfterMove,
  runBoost,
  runModifyAccuracy,
  runModifyCrit,
  runModifyCritRatio,
  runModifyDamage,
  runModifyEffectiveness,
  runFractionalPriority,
  runModifyMoveType,
  runModifyMultihit,
  runModifyPriority,
  runModifyRecoil,
  runModifySecondaryChance,
  runModifySpe,
  runResidual,
  runStart,
  runSwitchIn,
  runTryEscape,
  runTryHit,
  runTrySubstitute,
  runTryVolatile,
  type EffectContext,
} from './registry';
import { applyBoostEffect, applyStatusEffect } from './apply';
import { abilityEffects } from './abilities';
import { performSwitch, takeTurn, useMove } from '../turn';
import { canRun, rollRun } from '../runAway';
import { hitChance } from '../modifiers';
import { protectBlocks } from './moves';
import { setTerrain } from './terrain';
import { legalMoveIndices, validateCommand } from '../commands';
import { beforeMoveVolatile } from '../volatile';

function fighter(
  id: string,
  speciesId: string,
  ability: string,
  moves?: readonly string[],
): BattleFighter {
  return createFighter({
    id,
    speciesId,
    level: 20,
    ability,
    ...(moves ? { moves } : {}),
  });
}

function makeBattle(player: BattleFighter, enemy: BattleFighter, seed = 1234): BattleState {
  return createBattle({ player: [player], enemy: [enemy], rng: new Rng(seed), isWild: true });
}

function ctxOf(state: BattleState, side: SideId): EffectContext {
  return makeContext(state, side, {
    source: activeFighter(state, side),
    target: activeFighter(state, opponentOf(side)),
  });
}

function moveCtxOf(state: BattleState, side: SideId, moveId: string): EffectContext {
  return makeContext(state, side, {
    source: activeFighter(state, side),
    target: activeFighter(state, opponentOf(side)),
    move: getMove(moveId)!,
  });
}

describe('ability registration', () => {
  it('registers the batch 1 abilities', () => {
    const ids = abilityEffects().map((def) => def.id);
    expect(ids).toContain('intimidate');
    expect(ids).toContain('levitate');
    expect(ids).toContain('sturdy');
    for (const id of ids) expect(getEffect(id)?.kind).toBe('ability');
  });
});

describe('entry and immunity abilities', () => {
  it('Intimidate lowers the foe Attack on switch-in', () => {
    const state = makeBattle(
      fighter('player', 'growlithe', 'Intimidate'),
      fighter('enemy', 'bulbasaur', 'Overgrow'),
    );
    expect(activeFighter(state, 'enemy').boosts.atk).toBe(-1);
    expect(activeFighter(state, 'player').boosts.atk).toBe(0);
  });

  it('Levitate blocks Ground moves but nothing else', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'gastly', 'Levitate'),
    );
    const ctx = ctxOf(state, 'player');
    expect(runTryHit(ctx, getMove('earthquake')!)).toBe(false);
    expect(runTryHit(ctx, getMove('tackle')!)).toBe(true);
  });

  it('Sturdy leaves the holder at 1 HP from full', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'geodude', 'Sturdy'),
    );
    const geodude = activeFighter(state, 'enemy');
    const ctx = ctxOf(state, 'player');

    expect(runModifyDamage(ctx, getMove('tackle')!, geodude.maxHp)).toBe(geodude.hp - 1);

    geodude.hp -= 1;
    expect(runModifyDamage(ctx, getMove('tackle')!, geodude.maxHp)).toBe(geodude.maxHp);
  });
});

describe('contact punish abilities', () => {
  it('Static eventually paralyzes a contact attacker', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze', ['tackle']),
      fighter('enemy', 'pikachu', 'Static'),
      11,
    );
    const ctx = ctxOf(state, 'player');
    const move = getMove('tackle')!;
    for (let i = 0; i < 50 && activeFighter(state, 'player').status === null; i++) {
      runAfterMove(ctx, move);
    }
    expect(activeFighter(state, 'player').status).toBe('par');
  });

  it('Static ignores non-contact moves', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze', ['ember']),
      fighter('enemy', 'pikachu', 'Static'),
      11,
    );
    const ctx = ctxOf(state, 'player');
    const move = getMove('ember')!;
    for (let i = 0; i < 50; i++) runAfterMove(ctx, move);
    expect(activeFighter(state, 'player').status).toBeNull();
  });

  it('Flame Body burns a contact attacker', () => {
    const state = makeBattle(
      fighter('player', 'bulbasaur', 'Overgrow', ['tackle']),
      fighter('enemy', 'magmar', 'Flame Body'),
      12,
    );
    const ctx = ctxOf(state, 'player');
    const move = getMove('tackle')!;
    for (let i = 0; i < 50 && activeFighter(state, 'player').status === null; i++) {
      runAfterMove(ctx, move);
    }
    expect(activeFighter(state, 'player').status).toBe('brn');
  });
});

describe('status immune abilities', () => {
  it('Immunity blocks poison but not paralysis', () => {
    const state = makeBattle(
      fighter('player', 'snorlax', 'Immunity'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const snorlax = activeFighter(state, 'player');

    applyStatusEffect(state, 'player', snorlax, 'psn');
    expect(snorlax.status).toBeNull();

    applyStatusEffect(state, 'player', snorlax, 'par');
    expect(snorlax.status).toBe('par');
  });

  it('Limber blocks paralysis', () => {
    const state = makeBattle(
      fighter('player', 'ditto', 'Limber'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const ditto = activeFighter(state, 'player');
    applyStatusEffect(state, 'player', ditto, 'par');
    expect(ditto.status).toBeNull();
  });
});

describe('pinch, guts and technician', () => {
  it('Overgrow boosts Grass only while at or below one third HP', () => {
    const state = makeBattle(
      fighter('player', 'bulbasaur', 'Overgrow', ['vinewhip', 'tackle']),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const bulbasaur = activeFighter(state, 'player');
    const ctx = ctxOf(state, 'player');

    expect(runModifyDamage(ctx, getMove('vinewhip')!, 100)).toBe(100);
    bulbasaur.hp = Math.floor(bulbasaur.maxHp / 3);
    expect(runModifyDamage(ctx, getMove('vinewhip')!, 100)).toBe(150);
    expect(runModifyDamage(ctx, getMove('tackle')!, 100)).toBe(100);
  });

  it('Guts boosts physical moves while statused, ignoring burn', () => {
    const state = makeBattle(
      fighter('player', 'heracross', 'Guts', ['tackle', 'ember']),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const heracross = activeFighter(state, 'player');
    const ctx = ctxOf(state, 'player');

    expect(runModifyDamage(ctx, getMove('tackle')!, 100)).toBe(100);
    heracross.status = 'par';
    expect(runModifyDamage(ctx, getMove('tackle')!, 100)).toBe(150);
    expect(runModifyDamage(ctx, getMove('ember')!, 100)).toBe(100);
    heracross.status = 'brn';
    expect(runModifyDamage(ctx, getMove('tackle')!, 100)).toBe(300);
  });

  it('Technician boosts moves of 60 power or less', () => {
    const state = makeBattle(
      fighter('player', 'meowth', 'Technician', ['tackle', 'flamethrower']),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const ctx = ctxOf(state, 'player');
    expect(runModifyDamage(ctx, getMove('tackle')!, 100)).toBe(150);
    expect(runModifyDamage(ctx, getMove('flamethrower')!, 100)).toBe(100);
  });
});

describe('stat guard abilities', () => {
  it('Hyper Cutter blocks Attack drops but not Defence drops or self drops', () => {
    const state = makeBattle(
      fighter('player', 'gligar', 'Hyper Cutter'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const ctx = ctxOf(state, 'player');
    expect(runBoost(ctx, 'atk', -1, false)).toBe(false);
    expect(runBoost(ctx, 'def', -1, false)).toBe(true);
    expect(runBoost(ctx, 'atk', 1, false)).toBe(true);
    expect(runBoost(ctx, 'atk', -1, true)).toBe(true);
  });

  it('Keen Eye blocks accuracy drops only', () => {
    const state = makeBattle(
      fighter('player', 'hitmonchan', 'Keen Eye'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const ctx = ctxOf(state, 'player');
    expect(runBoost(ctx, 'accuracy', -1, false)).toBe(false);
    expect(runBoost(ctx, 'evasion', -1, false)).toBe(true);
  });

  it('Clear Body blocks every opposing drop', () => {
    const state = makeBattle(
      fighter('player', 'tentacool', 'Clear Body'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const ctx = ctxOf(state, 'player');
    expect(runBoost(ctx, 'spe', -2, false)).toBe(false);
  });
});

describe('damage and immunity abilities (batch 2)', () => {
  it('Water Absorb blocks a Water move and heals a quarter', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze', ['watergun', 'ember']),
      fighter('enemy', 'poliwag', 'Water Absorb'),
    );
    const poliwag = activeFighter(state, 'enemy');
    poliwag.hp = Math.floor(poliwag.maxHp / 2);
    const ctx = ctxOf(state, 'player');

    expect(runTryHit(ctx, getMove('watergun')!)).toBe(false);
    expect(poliwag.hp).toBe(Math.floor(poliwag.maxHp / 2) + Math.floor(poliwag.maxHp / 4));
    expect(runTryHit(ctx, getMove('ember')!)).toBe(true);
  });

  it('Sap Sipper blocks Grass and raises Attack; Motor Drive blocks Electric and raises Speed', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'marill', 'Sap Sipper'),
    );
    const marill = activeFighter(state, 'enemy');
    const ctx = ctxOf(state, 'player');

    expect(runTryHit(ctx, getMove('vinewhip')!)).toBe(false);
    expect(marill.boosts.atk).toBe(1);

    const drive = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'electivire', 'Motor Drive'),
    );
    const electivire = activeFighter(drive, 'enemy');
    expect(runTryHit(ctxOf(drive, 'player'), getMove('thunderbolt')!)).toBe(false);
    expect(electivire.boosts.spe).toBe(1);
  });

  it('Thick Fat and Ice Scales reduce the right incoming moves', () => {
    const thick = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'seel', 'Thick Fat'),
    );
    expect(runModifyDamage(ctxOf(thick, 'player'), getMove('ember')!, 100)).toBe(50);
    expect(runModifyDamage(ctxOf(thick, 'player'), getMove('tackle')!, 100)).toBe(100);

    const scales = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'snom', 'Ice Scales'),
    );
    expect(runModifyDamage(ctxOf(scales, 'player'), getMove('ember')!, 100)).toBe(50);
    expect(runModifyDamage(ctxOf(scales, 'player'), getMove('tackle')!, 100)).toBe(100);
  });

  it('Multiscale halves only at full HP and Filter only super-effective hits', () => {
    const multi = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'dragonite', 'Multiscale'),
    );
    const dragonite = activeFighter(multi, 'enemy');
    expect(runModifyDamage(ctxOf(multi, 'player'), getMove('tackle')!, 100)).toBe(50);
    dragonite.hp -= 1;
    expect(runModifyDamage(ctxOf(multi, 'player'), getMove('tackle')!, 100)).toBe(100);

    const filter = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'necrozma', 'Prism Armor'),
    );
    expect(runModifyDamage(ctxOf(filter, 'player'), getMove('tackle')!, 100, 2)).toBe(75);
    expect(runModifyDamage(ctxOf(filter, 'player'), getMove('tackle')!, 100, 1)).toBe(100);
  });

  it('Tough Claws, Strong Jaw and Huge Power boost the right moves', () => {
    const claws = makeBattle(
      fighter('player', 'meowthgalar', 'Tough Claws'),
      fighter('enemy', 'bulbasaur', 'Overgrow'),
    );
    const ctx = ctxOf(claws, 'player');
    expect(runModifyDamage(ctx, getMove('tackle')!, 100)).toBe(130);
    expect(runModifyDamage(ctx, getMove('ember')!, 100)).toBe(100);

    const jaw = makeBattle(
      fighter('player', 'avalugghisui', 'Strong Jaw'),
      fighter('enemy', 'bulbasaur', 'Overgrow'),
    );
    expect(runModifyDamage(ctxOf(jaw, 'player'), getMove('bite')!, 100)).toBe(150);

    const power = makeBattle(
      fighter('player', 'marill', 'Huge Power'),
      fighter('enemy', 'bulbasaur', 'Overgrow'),
    );
    expect(runModifyDamage(ctxOf(power, 'player'), getMove('tackle')!, 100)).toBe(200);
    expect(runModifyDamage(ctxOf(power, 'player'), getMove('ember')!, 100)).toBe(100);
  });

  it('Intrepid Sword raises Attack on switch-in and Moxie on a KO', () => {
    const sword = makeBattle(
      fighter('player', 'zacian', 'Intrepid Sword'),
      fighter('enemy', 'bulbasaur', 'Overgrow'),
    );
    expect(activeFighter(sword, 'player').boosts.atk).toBe(1);

    const moxie = makeBattle(
      fighter('player', 'gyarados', 'Moxie'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    activeFighter(moxie, 'enemy').hp = 0;
    runAfterMove(ctxOf(moxie, 'player'), getMove('tackle')!);
    expect(activeFighter(moxie, 'player').boosts.atk).toBe(1);
  });

  it('Dry Skin absorbs Water, fears Fire and follows the weather', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'croagunk', 'Dry Skin'),
    );
    const croagunk = activeFighter(state, 'enemy');
    croagunk.hp = Math.floor(croagunk.maxHp / 2);
    const ctx = ctxOf(state, 'player');

    expect(runTryHit(ctx, getMove('watergun')!)).toBe(false);
    expect(croagunk.hp).toBe(Math.floor(croagunk.maxHp / 2) + Math.floor(croagunk.maxHp / 4));
    expect(runModifyDamage(ctx, getMove('ember')!, 100)).toBe(125);

    state.weather = 'rain';
    croagunk.hp = Math.floor(croagunk.maxHp / 2);
    runResidual(ctxOf(state, 'enemy'));
    expect(croagunk.hp).toBe(Math.floor(croagunk.maxHp / 2) + Math.floor(croagunk.maxHp / 8));
  });
});

describe('residual abilities', () => {
  it('Shed Skin eventually cures a status', () => {
    const state = makeBattle(
      fighter('player', 'ekans', 'Shed Skin'),
      fighter('enemy', 'charmander', 'Blaze'),
      13,
    );
    const ekans = activeFighter(state, 'player');
    ekans.status = 'brn';
    for (let i = 0; i < 50 && ekans.status !== null; i++) {
      runResidual(ctxOf(state, 'player'));
    }
    expect(ekans.status).toBeNull();
  });
});

describe('speed abilities (batch 3)', () => {
  it('Chlorophyll, Swift Swim and Sand Rush double Speed only in their weather', () => {
    const state = makeBattle(
      fighter('player', 'bulbasaur', 'Chlorophyll'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const ctx = ctxOf(state, 'player');
    expect(runModifySpe(ctx, 100)).toBe(100);
    state.weather = 'sun';
    expect(runModifySpe(ctx, 100)).toBe(200);
    state.weather = 'rain';
    expect(runModifySpe(ctx, 100)).toBe(100);

    state.weather = 'rain';
    const swim = makeBattle(
      fighter('player', 'poliwag', 'Swift Swim'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    swim.weather = 'rain';
    expect(runModifySpe(ctxOf(swim, 'player'), 100)).toBe(200);

    const rush = makeBattle(
      fighter('player', 'drilbur', 'Sand Rush'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    rush.weather = 'sand';
    expect(runModifySpe(ctxOf(rush, 'player'), 100)).toBe(200);
  });

  it('Quick Feet ignores the paralysis drop and is 1.5x while statused', () => {
    const state = makeBattle(
      fighter('player', 'jolteon', 'Quick Feet'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const jolteon = activeFighter(state, 'player');
    const ctx = ctxOf(state, 'player');
    expect(runModifySpe(ctx, 60)).toBe(60);
    jolteon.status = 'par';
    expect(runModifySpe(ctx, Math.floor(jolteon.stats.spe / 2))).toBe(
      Math.floor(jolteon.stats.spe * 1.5),
    );
  });
});

describe('accuracy abilities (batch 3)', () => {
  it('Compound Eyes and Hustle move the hit chance', () => {
    const eyes = makeBattle(
      fighter('player', 'venonat', 'Compound Eyes'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runModifyAccuracy(ctxOf(eyes, 'player'), 0.6)).toBeCloseTo(0.78);

    const hustle = makeBattle(
      fighter('player', 'combee', 'Hustle'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const ctx = ctxOf(hustle, 'player');
    expect(runModifyAccuracy(ctx, 0.8)).toBeCloseTo(0.64);
    expect(runModifyDamage(ctx, getMove('tackle')!, 100)).toBe(150);
    expect(runModifyDamage(ctx, getMove('ember')!, 100)).toBe(100);
  });

  it('Sand Veil and Snow Cloak lower the foe accuracy in their weather', () => {
    const veil = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'sandshrew', 'Sand Veil'),
    );
    veil.weather = 'sand';
    expect(runModifyAccuracy(ctxOf(veil, 'player'), 0.8)).toBeCloseTo(0.64);

    const cloak = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'sandshrewalola', 'Snow Cloak'),
    );
    cloak.weather = 'snow';
    expect(runModifyAccuracy(ctxOf(cloak, 'player'), 0.8)).toBeCloseTo(0.64);

    const clear = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'sandshrew', 'Sand Veil'),
    );
    expect(runModifyAccuracy(ctxOf(clear, 'player'), 0.8)).toBeCloseTo(0.8);
  });
});

describe('damage abilities (batch 3)', () => {
  it('Adaptability makes a same-type move 2x instead of 1.5x', () => {
    const state = makeBattle(
      fighter('player', 'eevee', 'Adaptability'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const ctx = ctxOf(state, 'player');
    expect(runModifyDamage(ctx, getMove('tackle')!, 150)).toBe(200);
    expect(runModifyDamage(ctx, getMove('ember')!, 100)).toBe(100);
  });

  it('Tinted Lens doubles a not-very-effective hit', () => {
    const state = makeBattle(
      fighter('player', 'venonat', 'Tinted Lens'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const ctx = ctxOf(state, 'player');
    expect(runModifyDamage(ctx, getMove('tackle')!, 100, 0.5)).toBe(200);
    expect(runModifyDamage(ctx, getMove('tackle')!, 100, 1)).toBe(100);
  });

  it('Sheer Force boosts a move with a secondary and suppresses it', () => {
    const state = makeBattle(
      fighter('player', 'croconaw', 'Sheer Force'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const ctx = ctxOf(state, 'player');
    expect(runModifyDamage(ctx, getMove('bulldoze')!, 100)).toBe(130);
    expect(runModifyDamage(ctx, getMove('tackle')!, 100)).toBe(100);

    const sheer = makeBattle(
      fighter('player', 'croconaw', 'Sheer Force', ['bulldoze']),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const control = makeBattle(
      fighter('player', 'croconaw', 'Torrent', ['bulldoze']),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    takeTurn(control, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    takeTurn(sheer, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(activeFighter(control, 'enemy').boosts.spe).toBe(-1);
    expect(activeFighter(sheer, 'enemy').boosts.spe).toBe(0);
  });

  it('Shield Dust blocks the secondary effect of a move', () => {
    const dust = makeBattle(
      fighter('player', 'croconaw', 'Torrent', ['bulldoze']),
      fighter('enemy', 'scatterbug', 'Shield Dust'),
    );
    const control = makeBattle(
      fighter('player', 'croconaw', 'Torrent', ['bulldoze']),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    takeTurn(dust, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    takeTurn(control, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(activeFighter(dust, 'enemy').boosts.spe).toBe(0);
    expect(activeFighter(control, 'enemy').boosts.spe).toBe(-1);
  });

  it('Reckless boosts recoil moves', () => {
    const state = makeBattle(
      fighter('player', 'hitmonlee', 'Reckless'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const ctx = ctxOf(state, 'player');
    expect(runModifyDamage(ctx, getMove('doubleedge')!, 100)).toBe(120);
    expect(runModifyDamage(ctx, getMove('tackle')!, 100)).toBe(100);
  });

  it('Punk Rock boosts sound moves out and dampens them in', () => {
    const state = makeBattle(
      fighter('player', 'toxtricity', 'Punk Rock'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runModifyDamage(ctxOf(state, 'player'), getMove('boomburst')!, 100)).toBe(130);
    expect(runModifyDamage(ctxOf(state, 'enemy'), getMove('boomburst')!, 100)).toBe(50);
    expect(runModifyDamage(ctxOf(state, 'player'), getMove('tackle')!, 100)).toBe(100);
  });

  it('Water Bubble doubles Water out and halves Fire in', () => {
    const state = makeBattle(
      fighter('player', 'dewpider', 'Water Bubble'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runModifyDamage(ctxOf(state, 'player'), getMove('watergun')!, 100)).toBe(200);
    expect(runModifyDamage(ctxOf(state, 'enemy'), getMove('ember')!, 100)).toBe(50);
    expect(runModifyDamage(ctxOf(state, 'player'), getMove('tackle')!, 100)).toBe(100);
  });

  it('Fluffy halves contact and doubles Fire damage taken', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'greavard', 'Fluffy'),
    );
    const ctx = ctxOf(state, 'player');
    expect(runModifyDamage(ctx, getMove('tackle')!, 100)).toBe(50);
    expect(runModifyDamage(ctx, getMove('ember')!, 100)).toBe(200);
  });

  it('Flash Fire absorbs Fire and boosts the next Fire move', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'vulpix', 'Flash Fire'),
    );
    const vulpix = activeFighter(state, 'enemy');
    const incoming = ctxOf(state, 'player');
    expect(runTryHit(incoming, getMove('ember')!)).toBe(false);
    expect(vulpix.volatiles.flashFire).toBe(true);
    expect(runTryHit(incoming, getMove('tackle')!)).toBe(true);
    expect(runModifyDamage(ctxOf(state, 'enemy'), getMove('ember')!, 100)).toBe(150);
  });
});

describe('weather and immunity abilities (batch 3)', () => {
  it('Ice Body and Rain Dish heal in their weather', () => {
    const ice = makeBattle(
      fighter('player', 'seel', 'Ice Body'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const seel = activeFighter(ice, 'player');
    ice.weather = 'snow';
    seel.hp = Math.floor(seel.maxHp / 2);
    runResidual(ctxOf(ice, 'player'));
    expect(seel.hp).toBe(Math.floor(seel.maxHp / 2) + Math.floor(seel.maxHp / 16));
    expect(ice.log.some((event) => event.kind === 'heal' && event.side === 'player')).toBe(true);

    const rain = makeBattle(
      fighter('player', 'squirtle', 'Rain Dish'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const squirtle = activeFighter(rain, 'player');
    rain.weather = 'rain';
    squirtle.hp = Math.floor(squirtle.maxHp / 2);
    runResidual(ctxOf(rain, 'player'));
    expect(squirtle.hp).toBe(Math.floor(squirtle.maxHp / 2) + Math.floor(squirtle.maxHp / 16));
  });

  it('Hydration cures a status in the rain', () => {
    const state = makeBattle(
      fighter('player', 'seel', 'Hydration'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const seel = activeFighter(state, 'player');
    seel.status = 'brn';
    runResidual(ctxOf(state, 'player'));
    expect(seel.status).toBe('brn');
    state.weather = 'rain';
    runResidual(ctxOf(state, 'player'));
    expect(seel.status).toBeNull();
  });

  it('Leaf Guard blocks status only in the sun', () => {
    const state = makeBattle(
      fighter('player', 'chikorita', 'Leaf Guard'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const chikorita = activeFighter(state, 'player');
    applyStatusEffect(state, 'player', chikorita, 'brn');
    expect(chikorita.status).toBe('brn');

    const sun = makeBattle(
      fighter('player', 'chikorita', 'Leaf Guard'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    sun.weather = 'sun';
    applyStatusEffect(sun, 'player', activeFighter(sun, 'player'), 'brn');
    expect(activeFighter(sun, 'player').status).toBeNull();
  });

  it('Own Tempo, Inner Focus, Oblivious and Aroma Veil block their volatiles', () => {
    const tempo = makeBattle(
      fighter('player', 'slowpoke', 'Own Tempo'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runTryVolatile(ctxOf(tempo, 'player'), 'confusion')).toBe(false);
    expect(runTryVolatile(ctxOf(tempo, 'player'), 'taunt')).toBe(true);

    const focus = makeBattle(
      fighter('player', 'drowzee', 'Inner Focus'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runTryVolatile(ctxOf(focus, 'player'), 'flinch')).toBe(false);

    const oblivious = makeBattle(
      fighter('player', 'slowpoke', 'Oblivious'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runTryVolatile(ctxOf(oblivious, 'player'), 'taunt')).toBe(false);

    const veil = makeBattle(
      fighter('player', 'milcery', 'Aroma Veil'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runTryVolatile(ctxOf(veil, 'player'), 'taunt')).toBe(false);
    expect(runTryVolatile(ctxOf(veil, 'player'), 'encore')).toBe(false);
    expect(runTryVolatile(ctxOf(veil, 'player'), 'confusion')).toBe(true);
  });

  it('Inner Focus is immune to Intimidate', () => {
    const state = makeBattle(
      fighter('player', 'growlithe', 'Intimidate'),
      fighter('enemy', 'drowzee', 'Inner Focus'),
    );
    expect(activeFighter(state, 'enemy').boosts.atk).toBe(0);
  });
});

describe('switch abilities (batch 4)', () => {
  it('Regenerator heals a third on switch out and Natural Cure clears status', () => {
    const regen = makeBattle(
      fighter('player', 'slowpoke', 'Regenerator'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const slowpoke = activeFighter(regen, 'player');
    slowpoke.hp = Math.floor(slowpoke.maxHp / 2);
    regen.sides.player.party.push(fighter('player2', 'charmander', 'Blaze'));
    performSwitch(regen, 'player', 1);
    expect(slowpoke.hp).toBe(Math.floor(slowpoke.maxHp / 2) + Math.floor(slowpoke.maxHp / 3));

    const cure = makeBattle(
      fighter('player', 'chansey', 'Natural Cure'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const chansey = activeFighter(cure, 'player');
    chansey.status = 'brn';
    cure.sides.player.party.push(fighter('player2', 'charmander', 'Blaze'));
    performSwitch(cure, 'player', 1);
    expect(chansey.status).toBeNull();
  });

  it('Frisk reveals the foe held item on switch-in', () => {
    const state = createBattle({
      player: [createFighter({ id: 'p', speciesId: 'wigglytuff', level: 20, ability: 'Frisk' })],
      enemy: [createFighter({ id: 'e', speciesId: 'charmander', level: 20, heldItem: 'leftovers' })],
      rng: new Rng(1),
      isWild: true,
    });
    expect(state.log.some((event) => event.kind === 'text' && event.text.includes('Leftovers'))).toBe(
      true,
    );
  });

  it('Anticipation warns about a super-effective foe move', () => {
    const state = createBattle({
      player: [createFighter({ id: 'p', speciesId: 'eevee', level: 20, ability: 'Anticipation' })],
      enemy: [createFighter({ id: 'e', speciesId: 'riolu', level: 20, moves: ['forcepalm'] })],
      rng: new Rng(1),
      isWild: true,
    });
    expect(state.log.some((event) => event.kind === 'text' && event.text.includes('Anticipation'))).toBe(
      true,
    );
  });

  it('Download raises the higher-fitting offensive stat', () => {
    const physical = makeBattle(
      fighter('player', 'porygon', 'Download'),
      fighter('enemy', 'geodude', 'Sturdy'),
    );
    expect(activeFighter(physical, 'player').boosts.atk).toBe(1);

    const special = makeBattle(
      fighter('player', 'porygon', 'Download'),
      fighter('enemy', 'gastly', 'Levitate'),
    );
    expect(activeFighter(special, 'player').boosts.spa).toBe(1);
  });
});

describe('priority abilities (batch 4)', () => {
  it('Prankster adds priority to status moves only', () => {
    const state = makeBattle(
      fighter('player', 'murkrow', 'Prankster'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runModifyPriority(moveCtxOf(state, 'player', 'taunt'), getMove('taunt')!, 0)).toBe(1);
    expect(runModifyPriority(moveCtxOf(state, 'player', 'tackle'), getMove('tackle')!, 0)).toBe(0);
  });

  it('Gale Wings adds priority to Flying moves at full HP', () => {
    const state = makeBattle(
      fighter('player', 'fletchling', 'Gale Wings'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runModifyPriority(moveCtxOf(state, 'player', 'gust'), getMove('gust')!, 0)).toBe(1);
    expect(runModifyPriority(moveCtxOf(state, 'player', 'tackle'), getMove('tackle')!, 0)).toBe(0);

    activeFighter(state, 'player').hp -= 1;
    expect(runModifyPriority(moveCtxOf(state, 'player', 'gust'), getMove('gust')!, 0)).toBe(0);
  });
});

describe('reaction abilities (batch 4)', () => {
  it('Rattled raises Speed when hit by Bug, Dark or Ghost, and on Intimidate', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'magikarp', 'Rattled'),
    );
    runAfterMove(ctxOf(state, 'player'), getMove('bite')!);
    expect(activeFighter(state, 'enemy').boosts.spe).toBe(1);

    const intimidate = makeBattle(
      fighter('player', 'growlithe', 'Intimidate'),
      fighter('enemy', 'magikarp', 'Rattled'),
    );
    expect(activeFighter(intimidate, 'enemy').boosts.atk).toBe(-1);
    expect(activeFighter(intimidate, 'enemy').boosts.spe).toBe(1);
  });

  it('Pickpocket steals the contact attacker item', () => {
    const state = createBattle({
      player: [
        createFighter({
          id: 'p',
          speciesId: 'charmander',
          level: 20,
          ability: 'Blaze',
          heldItem: 'charcoal',
        }),
      ],
      enemy: [createFighter({ id: 'e', speciesId: 'sneasel', level: 20, ability: 'Pickpocket' })],
      rng: new Rng(1),
      isWild: true,
    });
    runAfterMove(ctxOf(state, 'player'), getMove('tackle')!);
    expect(activeFighter(state, 'enemy').heldItem).toBe('charcoal');
    expect(activeFighter(state, 'player').heldItem).toBeNull();
  });

  it('Effect Spore eventually afflicts a contact attacker', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'shroomish', 'Effect Spore'),
      21,
    );
    for (let i = 0; i < 100 && activeFighter(state, 'player').status === null; i++) {
      runAfterMove(ctxOf(state, 'player'), getMove('tackle')!);
    }
    expect(['slp', 'par', 'psn']).toContain(activeFighter(state, 'player').status);
  });

  it('Rough Skin chips the contact attacker', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'gible', 'Rough Skin'),
    );
    const attacker = activeFighter(state, 'player');
    const before = attacker.hp;
    runAfterMove(ctxOf(state, 'player'), getMove('tackle')!);
    expect(attacker.hp).toBe(before - Math.max(1, Math.floor(attacker.maxHp / 8)));
  });
});

describe('crit, multihit and substitute abilities (batch 4)', () => {
  it('Battle Armor and Shell Armor block critical hits', () => {
    for (const [species, ability] of [
      ['perrserker', 'Battle Armor'],
      ['shellder', 'Shell Armor'],
    ] as const) {
      const state = makeBattle(
        fighter('player', 'charmander', 'Blaze'),
        fighter('enemy', species, ability),
      );
      expect(runModifyCrit(ctxOf(state, 'player'), getMove('tackle')!, true)).toBe(false);
      expect(runModifyCrit(ctxOf(state, 'player'), getMove('tackle')!, false)).toBe(false);
    }
  });

  it('Anger Point maxes Attack when hit by a critical hit', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'mankey', 'Anger Point'),
    );
    const mankey = activeFighter(state, 'enemy');
    runModifyCrit(ctxOf(state, 'player'), getMove('tackle')!, true);
    expect(mankey.boosts.atk).toBe(6);
  });

  it('Skill Link forces the maximum number of hits', () => {
    const state = makeBattle(
      fighter('player', 'shellder', 'Skill Link'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runModifyMultihit(moveCtxOf(state, 'player', 'bulletseed'), getMove('bulletseed')!, 2)).toBe(
      5,
    );
    expect(runModifyMultihit(moveCtxOf(state, 'player', 'tackle'), getMove('tackle')!, 1)).toBe(1);
  });

  it('Infiltrator bypasses the foe substitute', () => {
    const state = makeBattle(
      fighter('player', 'hoppip', 'Infiltrator'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runTrySubstitute(ctxOf(state, 'player'), getMove('tackle')!)).toBe(true);

    const normal = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runTrySubstitute(ctxOf(normal, 'player'), getMove('tackle')!)).toBe(false);
  });
});

describe('move-blocking and stat abilities (batch 4)', () => {
  it('Damp, Bulletproof and Soundproof block their moves', () => {
    const damp = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'psyduck', 'Damp'),
    );
    expect(runTryHit(ctxOf(damp, 'player'), getMove('selfdestruct')!)).toBe(false);
    expect(runTryHit(ctxOf(damp, 'player'), getMove('tackle')!)).toBe(true);

    const bullet = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'chespin', 'Bulletproof'),
    );
    expect(runTryHit(ctxOf(bullet, 'player'), getMove('shadowball')!)).toBe(false);
    expect(runTryHit(ctxOf(bullet, 'player'), getMove('ember')!)).toBe(true);

    const sound = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'voltorb', 'Soundproof'),
    );
    expect(runTryHit(ctxOf(sound, 'player'), getMove('boomburst')!)).toBe(false);
    expect(runTryHit(ctxOf(sound, 'player'), getMove('ember')!)).toBe(true);
  });

  it('Defiant and Competitive boost after a foe-inflicted drop', () => {
    const defiant = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'mankey', 'Defiant'),
    );
    const mankey = activeFighter(defiant, 'enemy');
    applyBoostEffect(defiant, 'enemy', mankey, { atk: -1 });
    expect(mankey.boosts.atk).toBe(1);

    const competitive = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'jigglypuff', 'Competitive'),
    );
    const jigglypuff = activeFighter(competitive, 'enemy');
    applyBoostEffect(competitive, 'enemy', jigglypuff, { spa: -1 });
    expect(jigglypuff.boosts.spa).toBe(1);
  });

  it('Grass Pelt halves the physical damage taken on grassy terrain', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'skiddo', 'Grass Pelt'),
    );
    const ctx = ctxOf(state, 'player');
    expect(runModifyDamage(ctx, getMove('tackle')!, 90)).toBe(90);
    state.terrain = 'grassy';
    expect(runModifyDamage(ctx, getMove('tackle')!, 90)).toBe(60);
    expect(runModifyDamage(ctx, getMove('ember')!, 90)).toBe(90);
  });

  it('Sweet Veil blocks sleep', () => {
    const state = makeBattle(
      fighter('player', 'bounsweet', 'Sweet Veil'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const bounsweet = activeFighter(state, 'player');
    applyStatusEffect(state, 'player', bounsweet, 'slp');
    expect(bounsweet.status).toBeNull();
    applyStatusEffect(state, 'player', bounsweet, 'brn');
    expect(bounsweet.status).toBe('brn');
  });

  it('Poison Heal heals instead of taking poison damage', () => {
    const state = makeBattle(
      fighter('player', 'shroomish', 'Poison Heal', ['tackle']),
      fighter('enemy', 'charmander', 'Blaze', ['growl']),
    );
    const shroomish = activeFighter(state, 'player');
    shroomish.hp = Math.floor(shroomish.maxHp / 2);
    shroomish.status = 'psn';
    const before = shroomish.hp;
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(shroomish.hp).toBeGreaterThan(before);
    expect(state.log.some((event) => event.kind === 'heal' && event.side === 'player')).toBe(true);
  });
});

describe('contact and damage abilities (batch 5)', () => {
  it('Poison Touch eventually poisons the contact target', () => {
    const state = makeBattle(
      fighter('player', 'grimer', 'Poison Touch'),
      fighter('enemy', 'charmander', 'Blaze'),
      31,
    );
    for (let i = 0; i < 100 && activeFighter(state, 'enemy').status === null; i++) {
      runAfterMove(ctxOf(state, 'player'), getMove('tackle')!);
    }
    expect(activeFighter(state, 'enemy').status).toBe('psn');
  });

  it('Gooey lowers the contact attacker Speed', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'goomy', 'Gooey'),
    );
    runAfterMove(ctxOf(state, 'player'), getMove('tackle')!);
    expect(activeFighter(state, 'player').boosts.spe).toBe(-1);
  });

  it('Justified raises Attack when hit by a Dark move', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'growlithe', 'Justified'),
    );
    runAfterMove(ctxOf(state, 'player'), getMove('bite')!);
    expect(activeFighter(state, 'enemy').boosts.atk).toBe(1);
  });

  it('Marvel Scale softens physical hits while statused', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'dratini', 'Marvel Scale'),
    );
    const ctx = ctxOf(state, 'player');
    expect(runModifyDamage(ctx, getMove('tackle')!, 90)).toBe(90);
    activeFighter(state, 'enemy').status = 'brn';
    expect(runModifyDamage(ctx, getMove('tackle')!, 90)).toBe(60);
    expect(runModifyDamage(ctx, getMove('ember')!, 90)).toBe(90);
  });

  it('Sand Force boosts Rock, Ground and Steel moves in a sandstorm', () => {
    const state = makeBattle(
      fighter('player', 'diglett', 'Sand Force'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const ctx = ctxOf(state, 'player');
    expect(runModifyDamage(ctx, getMove('bulldoze')!, 100)).toBe(100);
    state.weather = 'sand';
    expect(runModifyDamage(ctx, getMove('bulldoze')!, 100)).toBe(130);
    expect(runModifyDamage(ctx, getMove('ember')!, 100)).toBe(100);
  });

  it('Earth Eater absorbs Ground and heals', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'orthworm', 'Earth Eater'),
    );
    const orthworm = activeFighter(state, 'enemy');
    orthworm.hp = Math.floor(orthworm.maxHp / 2);
    const ctx = ctxOf(state, 'player');
    expect(runTryHit(ctx, getMove('bulldoze')!)).toBe(false);
    expect(orthworm.hp).toBe(Math.floor(orthworm.maxHp / 2) + Math.floor(orthworm.maxHp / 4));
    expect(runTryHit(ctx, getMove('ember')!)).toBe(true);
  });

  it('Thermal Exchange absorbs Fire, raises Attack and blocks burns', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'frigibax', 'Thermal Exchange'),
    );
    const frigibax = activeFighter(state, 'enemy');
    expect(runTryHit(ctxOf(state, 'player'), getMove('ember')!)).toBe(false);
    expect(frigibax.boosts.atk).toBe(1);
    applyStatusEffect(state, 'enemy', frigibax, 'brn');
    expect(frigibax.status).toBeNull();
  });
});

describe('stat and reaction abilities (batch 5)', () => {
  it('Simple doubles and Contrary inverts stat changes', () => {
    const simple = makeBattle(
      fighter('player', 'numel', 'Simple'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const numel = activeFighter(simple, 'player');
    applyBoostEffect(simple, 'player', numel, { atk: 1 });
    expect(numel.boosts.atk).toBe(2);

    const contrary = makeBattle(
      fighter('player', 'snivy', 'Contrary'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const snivy = activeFighter(contrary, 'player');
    applyBoostEffect(contrary, 'player', snivy, { atk: -1 });
    expect(snivy.boosts.atk).toBe(1);
    applyBoostEffect(contrary, 'player', snivy, { spa: 1 }, { self: true });
    expect(snivy.boosts.spa).toBe(-1);
  });

  it('Synchronize passes burn, paralysis and poison back', () => {
    const state = makeBattle(
      fighter('player', 'espeon', 'Synchronize'),
      fighter('enemy', 'bulbasaur', 'Overgrow'),
    );
    applyStatusEffect(state, 'player', activeFighter(state, 'player'), 'brn');
    expect(activeFighter(state, 'player').status).toBe('brn');
    expect(activeFighter(state, 'enemy').status).toBe('brn');
  });

  it('Steadfast raises Speed when it flinches', () => {
    const state = makeBattle(
      fighter('player', 'scyther', 'Steadfast'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runTryVolatile(ctxOf(state, 'player'), 'flinch')).toBe(true);
    expect(activeFighter(state, 'player').boosts.spe).toBe(1);
  });

  it('Rock Head removes recoil damage', () => {
    const state = makeBattle(
      fighter('player', 'geodude', 'Rock Head'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runModifyRecoil(ctxOf(state, 'player'), getMove('doubleedge')!, 30)).toBe(0);
  });

  it('Moody raises one stat and lowers another each turn', () => {
    const state = makeBattle(
      fighter('player', 'smeargle', 'Moody'),
      fighter('enemy', 'charmander', 'Blaze'),
      41,
    );
    runResidual(ctxOf(state, 'player'));
    const boosts = activeFighter(state, 'player').boosts;
    const raised = (['atk', 'def', 'spa', 'spd', 'spe'] as const).filter((stat) => boosts[stat] === 2);
    const lowered = (['atk', 'def', 'spa', 'spd', 'spe'] as const).filter((stat) => boosts[stat] === -1);
    expect(raised).toHaveLength(1);
    expect(lowered).toHaveLength(1);
  });

  it('Disguise absorbs the first damaging hit only', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'mimikyu', 'Disguise'),
    );
    const ctx = ctxOf(state, 'player');
    expect(runTryHit(ctx, getMove('tackle')!)).toBe(false);
    expect(runTryHit(ctx, getMove('tackle')!)).toBe(true);
  });

  it('Overcoat blocks powder moves', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'pineco', 'Overcoat'),
    );
    const ctx = ctxOf(state, 'player');
    expect(runTryHit(ctx, getMove('spore')!)).toBe(false);
    expect(runTryHit(ctx, getMove('tackle')!)).toBe(true);
  });

  it('Run Away guarantees a wild escape', () => {
    const state = makeBattle(
      fighter('player', 'oddish', 'Run Away'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runTryEscape(ctxOf(state, 'player'))).toBe(true);
    expect(rollRun(state, 'player')).toBe(true);
  });

  it('Analytic and Stakeout boost against a foe that moved or switched', () => {
    const state = makeBattle(
      fighter('player', 'magnemite', 'Analytic'),
      fighter('enemy', 'tarountula', 'Stakeout'),
    );
    const ctx = ctxOf(state, 'player');
    expect(runModifyDamage(ctx, getMove('tackle')!, 100)).toBe(100);
    state.movedSides = ['enemy'];
    expect(runModifyDamage(ctx, getMove('tackle')!, 100)).toBe(130);

    const stake = ctxOf(state, 'enemy');
    state.movedSides = [];
    state.switchedSides = ['player'];
    expect(runModifyDamage(stake, getMove('tackle')!, 100)).toBe(200);
  });
});

describe('type and hit-reaction abilities (batch 6)', () => {
  it('Well-Baked Body absorbs Fire and raises Defense', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'dachsbun', 'Well-Baked Body'),
    );
    const dachsbun = activeFighter(state, 'enemy');
    expect(runTryHit(ctxOf(state, 'player'), getMove('ember')!)).toBe(false);
    expect(dachsbun.boosts.def).toBe(2);
    expect(runTryHit(ctxOf(state, 'player'), getMove('tackle')!)).toBe(true);
  });

  it('Wind Rider absorbs wind moves and raises Attack', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'shiftry', 'Wind Rider'),
    );
    const shiftry = activeFighter(state, 'enemy');
    expect(runTryHit(ctxOf(state, 'player'), getMove('gust')!)).toBe(false);
    expect(shiftry.boosts.atk).toBe(1);
    expect(runTryHit(ctxOf(state, 'player'), getMove('tackle')!)).toBe(true);
  });

  it('Stamina raises Defense after a hit, but not on a whiffed hit flag', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'mudbray', 'Stamina'),
    );
    runAfterMove(ctxOf(state, 'player'), getMove('tackle')!, false);
    expect(activeFighter(state, 'enemy').boosts.def).toBe(0);
    runAfterMove(ctxOf(state, 'player'), getMove('tackle')!);
    expect(activeFighter(state, 'enemy').boosts.def).toBe(1);
  });

  it('Weak Armor trades Defense for Speed on a physical hit', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'magcargo', 'Weak Armor'),
    );
    runAfterMove(ctxOf(state, 'player'), getMove('tackle')!);
    expect(activeFighter(state, 'enemy').boosts.def).toBe(-1);
    expect(activeFighter(state, 'enemy').boosts.spe).toBe(2);
  });

  it('Steam Engine maxes Speed on Fire or Water', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'rolycoly', 'Steam Engine'),
    );
    runAfterMove(ctxOf(state, 'player'), getMove('ember')!);
    expect(activeFighter(state, 'enemy').boosts.spe).toBe(6);
  });

  it('Water Compaction raises Defense on Water', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'sandygast', 'Water Compaction'),
    );
    runAfterMove(ctxOf(state, 'player'), getMove('watergun')!);
    expect(activeFighter(state, 'enemy').boosts.def).toBe(2);
  });

  it('Sand Spit and Seed Sower set the weather and terrain when hit', () => {
    const sand = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'silicobra', 'Sand Spit'),
    );
    runAfterMove(ctxOf(sand, 'player'), getMove('tackle')!);
    expect(sand.weather).toBe('sand');

    const seed = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'arboliva', 'Seed Sower'),
    );
    runAfterMove(ctxOf(seed, 'player'), getMove('tackle')!);
    expect(seed.terrain).toBe('grassy');
  });
});

describe('damage and crit abilities (batch 6)', () => {
  it("Dragon's Maw, Transistor and Rocky Payload boost their type", () => {
    const maw = makeBattle(
      fighter('player', 'regidrago', "Dragon's Maw"),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runModifyDamage(ctxOf(maw, 'player'), getMove('dragonbreath')!, 100)).toBe(150);
    expect(runModifyDamage(ctxOf(maw, 'player'), getMove('tackle')!, 100)).toBe(100);

    const transistor = makeBattle(
      fighter('player', 'regieleki', 'Transistor'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runModifyDamage(ctxOf(transistor, 'player'), getMove('thunderbolt')!, 100)).toBe(130);

    const payload = makeBattle(
      fighter('player', 'bombirdier', 'Rocky Payload'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runModifyDamage(ctxOf(payload, 'player'), getMove('rockthrow')!, 100)).toBe(150);
  });

  it('Mega Launcher boosts pulse moves', () => {
    const state = makeBattle(
      fighter('player', 'clawitzer', 'Mega Launcher'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runModifyDamage(ctxOf(state, 'player'), getMove('waterpulse')!, 100)).toBe(150);
    expect(runModifyDamage(ctxOf(state, 'player'), getMove('tackle')!, 100)).toBe(100);
  });

  it('Sniper raises critical-hit damage', () => {
    const state = makeBattle(
      fighter('player', 'horsea', 'Sniper'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runModifyDamage(ctxOf(state, 'player'), getMove('tackle')!, 100, 1, false)).toBe(100);
    expect(runModifyDamage(ctxOf(state, 'player'), getMove('tackle')!, 100, 1, true)).toBe(150);
  });

  it('Super Luck raises the crit ratio and Merciless forces crits on poison', () => {
    const luck = makeBattle(
      fighter('player', 'murkrow', 'Super Luck'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runModifyCritRatio(ctxOf(luck, 'player'), getMove('tackle')!, 0)).toBe(1);

    const merciless = makeBattle(
      fighter('player', 'mareanie', 'Merciless'),
      fighter('enemy', 'bulbasaur', 'Overgrow'),
    );
    expect(runModifyCrit(ctxOf(merciless, 'player'), getMove('tackle')!, false)).toBe(false);
    activeFighter(merciless, 'enemy').status = 'psn';
    expect(runModifyCrit(ctxOf(merciless, 'player'), getMove('tackle')!, false)).toBe(true);
  });

  it('Solar Power, Flare Boost and Toxic Boost reward sun, burn and poison', () => {
    const solar = makeBattle(
      fighter('player', 'charmander', 'Solar Power'),
      fighter('enemy', 'bulbasaur', 'Overgrow'),
    );
    expect(runModifyDamage(ctxOf(solar, 'player'), getMove('ember')!, 100)).toBe(100);
    solar.weather = 'sun';
    expect(runModifyDamage(ctxOf(solar, 'player'), getMove('ember')!, 100)).toBe(150);
    const before = activeFighter(solar, 'player').hp;
    runResidual(ctxOf(solar, 'player'));
    expect(activeFighter(solar, 'player').hp).toBe(
      before - Math.max(1, Math.floor(activeFighter(solar, 'player').maxHp / 8)),
    );

    const flare = makeBattle(
      fighter('player', 'drifloon', 'Flare Boost'),
      fighter('enemy', 'bulbasaur', 'Overgrow'),
    );
    activeFighter(flare, 'player').status = 'brn';
    expect(runModifyDamage(ctxOf(flare, 'player'), getMove('shadowball')!, 100)).toBe(150);
    expect(runModifyDamage(ctxOf(flare, 'player'), getMove('tackle')!, 100)).toBe(100);

    const toxic = makeBattle(
      fighter('player', 'zangoose', 'Toxic Boost'),
      fighter('enemy', 'bulbasaur', 'Overgrow'),
    );
    activeFighter(toxic, 'player').status = 'psn';
    expect(runModifyDamage(ctxOf(toxic, 'player'), getMove('tackle')!, 100)).toBe(150);
    expect(runModifyDamage(ctxOf(toxic, 'player'), getMove('ember')!, 100)).toBe(100);
  });
});

describe('status and accuracy abilities (batch 6)', () => {
  it('Good as Gold blocks foe-targeting status moves but not self moves', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'gholdengo', 'Good as Gold'),
    );
    const ctx = ctxOf(state, 'player');
    expect(runTryHit(ctx, getMove('toxic')!)).toBe(false);
    expect(runTryHit(ctx, getMove('swordsdance')!)).toBe(true);
    expect(runTryHit(ctx, getMove('tackle')!)).toBe(true);
  });

  it('Purifying Salt blocks status and halves Ghost damage', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'garganacl', 'Purifying Salt'),
    );
    const garganacl = activeFighter(state, 'enemy');
    applyStatusEffect(state, 'enemy', garganacl, 'brn');
    expect(garganacl.status).toBeNull();
    expect(runModifyDamage(ctxOf(state, 'player'), getMove('shadowball')!, 100)).toBe(50);
    expect(runModifyDamage(ctxOf(state, 'player'), getMove('tackle')!, 100)).toBe(100);
  });

  it('Comatose cannot be statused', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'komala', 'Comatose'),
    );
    const komala = activeFighter(state, 'enemy');
    applyStatusEffect(state, 'enemy', komala, 'par');
    expect(komala.status).toBeNull();
  });

  it('No Guard makes both sides always hit', () => {
    const attacking = makeBattle(
      fighter('player', 'golett', 'No Guard'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runModifyAccuracy(ctxOf(attacking, 'player'), 0.5)).toBe(1);
    const defending = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'golett', 'No Guard'),
    );
    expect(runModifyAccuracy(ctxOf(defending, 'player'), 0.5)).toBe(1);
  });

  it('Tangled Feet halves accuracy while confused', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'doduo', 'Tangled Feet'),
    );
    expect(runModifyAccuracy(ctxOf(state, 'player'), 1)).toBe(1);
    activeFighter(state, 'enemy').volatiles.confusion = 2;
    expect(runModifyAccuracy(ctxOf(state, 'player'), 1)).toBe(0.5);
  });
});

describe('speed and on-hit abilities (batch 6)', () => {
  it('Slush Rush and Surge Surfer double Speed in snow and Electric Terrain', () => {
    const slush = makeBattle(
      fighter('player', 'sandshrewalola', 'Slush Rush'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runModifySpe(ctxOf(slush, 'player'), 100)).toBe(100);
    slush.weather = 'snow';
    expect(runModifySpe(ctxOf(slush, 'player'), 100)).toBe(200);

    const surge = makeBattle(
      fighter('player', 'raichualola', 'Surge Surfer'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runModifySpe(ctxOf(surge, 'player'), 100)).toBe(100);
    surge.terrain = 'electric';
    expect(runModifySpe(ctxOf(surge, 'player'), 100)).toBe(200);
  });

  it('Toxic Chain eventually poisons on a damaging hit', () => {
    const state = makeBattle(
      fighter('player', 'okidogi', 'Toxic Chain'),
      fighter('enemy', 'charmander', 'Blaze'),
      17,
    );
    for (let i = 0; i < 200 && activeFighter(state, 'enemy').status === null; i++) {
      runAfterMove(ctxOf(state, 'player'), getMove('tackle')!);
    }
    expect(activeFighter(state, 'enemy').status).toBe('psn');
  });

  it('Stench eventually flinches on a damaging hit', () => {
    const state = makeBattle(
      fighter('player', 'grimer', 'Stench'),
      fighter('enemy', 'charmander', 'Blaze'),
      23,
    );
    for (let i = 0; i < 200 && !activeFighter(state, 'enemy').volatiles.flinched; i++) {
      runAfterMove(ctxOf(state, 'player'), getMove('tackle')!);
    }
    expect(activeFighter(state, 'enemy').volatiles.flinched).toBe(true);
  });
});

describe('defensive and entry abilities (batch 7)', () => {
  it('Fur Coat halves physical damage only', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'persianalola', 'Fur Coat'),
    );
    const ctx = ctxOf(state, 'player');
    expect(runModifyDamage(ctx, getMove('tackle')!, 100)).toBe(50);
    expect(runModifyDamage(ctx, getMove('ember')!, 100)).toBe(100);
  });

  it('Ice Face absorbs one physical hit, not special', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'eiscue', 'Ice Face'),
    );
    const ctx = ctxOf(state, 'player');
    expect(runTryHit(ctx, getMove('ember')!)).toBe(true);
    expect(runTryHit(ctx, getMove('tackle')!)).toBe(false);
    expect(runTryHit(ctx, getMove('tackle')!)).toBe(true);
  });

  it('Speed Boost raises Speed each residual', () => {
    const state = makeBattle(
      fighter('player', 'yanma', 'Speed Boost'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    runResidual(ctxOf(state, 'player'));
    expect(activeFighter(state, 'player').boosts.spe).toBe(1);
  });

  it('Slow Start halves Attack and Speed until it wears off', () => {
    const state = makeBattle(
      fighter('player', 'regigigas', 'Slow Start'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runModifySpe(ctxOf(state, 'player'), 100)).toBe(50);
    expect(runModifyDamage(ctxOf(state, 'player'), getMove('tackle')!, 100)).toBe(50);
    for (let i = 0; i < 5; i++) runResidual(ctxOf(state, 'player'));
    expect(runModifySpe(ctxOf(state, 'player'), 100)).toBe(100);
  });

  it('Unburden doubles Speed once the held item is gone', () => {
    const state = makeBattle(
      fighter('player', 'hitmonlee', 'Unburden'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runModifySpe(ctxOf(state, 'player'), 100)).toBe(100);
    activeFighter(state, 'player').lastItemId = 'sitrusberry';
    expect(runModifySpe(ctxOf(state, 'player'), 100)).toBe(200);
  });

  it('Forewarn names the foe strongest move on entry', () => {
    const state = makeBattle(
      fighter('player', 'drowzee', 'Forewarn'),
      fighter('enemy', 'charmander', 'Blaze', ['ember']),
    );
    expect(state.log.some((event) => event.kind === 'text' && event.text.includes('Forewarn'))).toBe(
      true,
    );
  });

  it('Supersweet Syrup lowers the foe evasiveness on entry', () => {
    const state = makeBattle(
      fighter('player', 'dipplin', 'Supersweet Syrup'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(activeFighter(state, 'enemy').boosts.evasion).toBe(-1);
  });

  it('Guard Dog raises Attack when Intimidated', () => {
    const state = makeBattle(
      fighter('player', 'mabosstiff', 'Guard Dog'),
      fighter('enemy', 'growlithe', 'Intimidate'),
    );
    expect(activeFighter(state, 'player').boosts.atk).toBe(1);
  });

  it('Magician steals the foe item on a hit, blocked by Sticky Hold', () => {
    const state = makeBattle(
      fighter('player', 'fennekin', 'Magician'),
      fighter('enemy', 'bulbasaur', 'Overgrow'),
    );
    activeFighter(state, 'enemy').heldItem = 'sitrusberry';
    runAfterMove(ctxOf(state, 'player'), getMove('tackle')!);
    expect(activeFighter(state, 'player').heldItem).toBe('sitrusberry');
    expect(activeFighter(state, 'enemy').heldItem).toBeNull();

    const sticky = makeBattle(
      fighter('player', 'fennekin', 'Magician'),
      fighter('enemy', 'grimer', 'Sticky Hold'),
    );
    activeFighter(sticky, 'enemy').heldItem = 'sitrusberry';
    runAfterMove(ctxOf(sticky, 'player'), getMove('tackle')!);
    expect(activeFighter(sticky, 'player').heldItem).toBeNull();
    expect(activeFighter(sticky, 'enemy').heldItem).toBe('sitrusberry');
  });

  it('Lingering Aroma changes a contact attacker ability', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'oinkologne', 'Lingering Aroma'),
    );
    runAfterMove(ctxOf(state, 'player'), getMove('tackle')!);
    expect(activeFighter(state, 'player').ability).toBe('Lingering Aroma');
  });

  it('Harvest eventually restores the last berry', () => {
    const state = makeBattle(
      fighter('player', 'exeggutor', 'Harvest'),
      fighter('enemy', 'charmander', 'Blaze'),
      29,
    );
    const player = activeFighter(state, 'player');
    player.heldItem = null;
    player.lastItemId = 'sitrusberry';
    for (let i = 0; i < 100 && player.heldItem === null; i++) runResidual(ctxOf(state, 'player'));
    expect(player.heldItem).toBe('sitrusberry');
  });

  it('Pressure announces itself on entry', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'dusclops', 'Pressure'),
    );
    expect(state.log.some((event) => event.kind === 'text' && event.text.includes('Pressure'))).toBe(
      true,
    );
  });
});

describe('priority, accuracy and secondary abilities (batch 8)', () => {
  it('Armor Tail, Dazzling and Queenly Majesty block priority moves', () => {
    for (const [species, ability] of [
      ['farigiraf', 'Armor Tail'],
      ['bruxish', 'Dazzling'],
      ['tsareena', 'Queenly Majesty'],
    ] as const) {
      const state = makeBattle(
        fighter('player', 'charmander', 'Blaze'),
        fighter('enemy', species, ability),
      );
      expect(runTryHit(ctxOf(state, 'player'), getMove('quickattack')!)).toBe(false);
      expect(runTryHit(ctxOf(state, 'player'), getMove('tackle')!)).toBe(true);
    }
  });

  it('Queenly Majesty also stops a Prankster-boosted status move', () => {
    const state = makeBattle(
      fighter('player', 'sableye', 'Prankster'),
      fighter('enemy', 'tsareena', 'Queenly Majesty'),
    );
    expect(runTryHit(ctxOf(state, 'player'), getMove('thunderwave')!)).toBe(false);
  });

  it('Triage gives healing moves +3 priority', () => {
    const state = makeBattle(
      fighter('player', 'comfey', 'Triage'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runModifyPriority(moveCtxOf(state, 'player', 'recover'), getMove('recover')!, 0)).toBe(3);
    expect(runModifyPriority(moveCtxOf(state, 'player', 'tackle'), getMove('tackle')!, 0)).toBe(0);
  });

  it('Wonder Skin halves the accuracy of status moves only', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'venomoth', 'Wonder Skin'),
    );
    expect(runModifyAccuracy(moveCtxOf(state, 'player', 'thunderwave'), 100)).toBe(50);
    expect(runModifyAccuracy(moveCtxOf(state, 'player', 'tackle'), 100)).toBe(100);
  });

  it('Serene Grace doubles a secondary effect chance', () => {
    const state = makeBattle(
      fighter('player', 'chansey', 'Serene Grace'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runModifySecondaryChance(moveCtxOf(state, 'player', 'flamethrower'), 10)).toBe(20);
  });

  it('Full Metal Body blocks stat drops', () => {
    const state = makeBattle(
      fighter('player', 'solgaleo', 'Full Metal Body'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    applyBoostEffect(state, 'player', activeFighter(state, 'player'), { atk: -1 });
    expect(activeFighter(state, 'player').boosts.atk).toBe(0);
  });

  it('Mirror Armor sends a stat drop back at the foe', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'corviknight', 'Mirror Armor'),
    );
    applyBoostEffect(state, 'enemy', activeFighter(state, 'enemy'), { atk: -1 });
    expect(activeFighter(state, 'enemy').boosts.atk).toBe(0);
    expect(activeFighter(state, 'player').boosts.atk).toBe(-1);
  });

  it('Opportunist copies the foe stat boost', () => {
    const state = makeBattle(
      fighter('player', 'espathra', 'Opportunist'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    applyBoostEffect(state, 'enemy', activeFighter(state, 'enemy'), { spa: 1 }, { self: true });
    expect(activeFighter(state, 'player').boosts.spa).toBe(1);
  });
});

describe('contact and residual abilities (batch 8)', () => {
  it('Tangling Hair lowers the contact attacker Speed', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze', ['tackle']),
      fighter('enemy', 'dugtrioalola', 'Tangling Hair'),
    );
    runAfterMove(ctxOf(state, 'player'), getMove('tackle')!);
    expect(activeFighter(state, 'player').boosts.spe).toBe(-1);
  });

  it('Aftermath hurts the contact attacker when the holder faints', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze', ['tackle']),
      fighter('enemy', 'voltorb', 'Aftermath'),
    );
    const attacker = activeFighter(state, 'player');
    activeFighter(state, 'enemy').hp = 0;
    runAfterMove(ctxOf(state, 'player'), getMove('tackle')!);
    expect(attacker.hp).toBe(attacker.maxHp - Math.max(1, Math.floor(attacker.maxHp / 4)));
  });

  it('Bad Dreams chips a sleeping foe each residual', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'darkrai', 'Bad Dreams'),
    );
    const foe = activeFighter(state, 'player');
    foe.status = 'slp';
    runResidual(ctxOf(state, 'enemy'));
    expect(foe.hp).toBe(foe.maxHp - Math.max(1, Math.floor(foe.maxHp / 8)));
  });

  it('Poison Puppeteer confuses whatever it poisons', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'pecharunt', 'Poison Puppeteer'),
    );
    const victim = activeFighter(state, 'player');
    applyStatusEffect(state, 'player', victim, 'psn');
    expect(victim.status).toBe('psn');
    expect(victim.volatiles.confusion).toBeGreaterThan(0);
  });
});

describe('pinch and KO abilities (batch 8)', () => {
  it('Berserk raises Sp. Atk once below half', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze', ['tackle']),
      fighter('enemy', 'moltresgalar', 'Berserk'),
    );
    const holder = activeFighter(state, 'enemy');
    holder.hp = Math.floor(holder.maxHp / 2);
    runAfterMove(ctxOf(state, 'player'), getMove('tackle')!);
    expect(holder.boosts.spa).toBe(1);
    runAfterMove(ctxOf(state, 'player'), getMove('tackle')!);
    expect(holder.boosts.spa).toBe(1);
  });

  it('Anger Shell boosts offenses and drops defenses below half', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze', ['tackle']),
      fighter('enemy', 'klawf', 'Anger Shell'),
    );
    const holder = activeFighter(state, 'enemy');
    holder.hp = Math.floor(holder.maxHp / 2);
    runAfterMove(ctxOf(state, 'player'), getMove('tackle')!);
    expect(holder.boosts.atk).toBe(1);
    expect(holder.boosts.spa).toBe(1);
    expect(holder.boosts.spe).toBe(1);
    expect(holder.boosts.def).toBe(-1);
    expect(holder.boosts.spd).toBe(-1);
  });

  it('Chilling Neigh and Grim Neigh raise a stat on a knock out', () => {
    const physical = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'glastrier', 'Chilling Neigh'),
    );
    activeFighter(physical, 'player').hp = 0;
    runAfterMove(ctxOf(physical, 'enemy'), getMove('tackle')!);
    expect(activeFighter(physical, 'enemy').boosts.atk).toBe(1);

    const special = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'spectrier', 'Grim Neigh'),
    );
    activeFighter(special, 'player').hp = 0;
    runAfterMove(ctxOf(special, 'enemy'), getMove('tackle')!);
    expect(activeFighter(special, 'enemy').boosts.spa).toBe(1);
  });

  it('Steely Spirit powers up Steel moves', () => {
    const state = makeBattle(
      fighter('player', 'perrserker', 'Steely Spirit'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runModifyDamage(ctxOf(state, 'player'), getMove('ironhead')!, 100)).toBe(150);
    expect(runModifyDamage(ctxOf(state, 'player'), getMove('tackle')!, 100)).toBe(100);
  });

  it('Supreme Overlord grows with every fallen party member', () => {
    const king = fighter('king', 'kingambit', 'Supreme Overlord');
    const fallen = fighter('fallen', 'charmander', 'Blaze');
    fallen.hp = 0;
    const state = createBattle({
      player: [king, fallen],
      enemy: [fighter('enemy', 'charmander', 'Blaze')],
      rng: new Rng(1),
      isWild: true,
    });
    expect(runModifyDamage(ctxOf(state, 'player'), getMove('tackle')!, 100)).toBe(110);
  });
});

describe('item suppression (batch 8)', () => {
  it('Klutz suppresses the holder held item', () => {
    const state = makeBattle(
      fighter('player', 'golett', 'Klutz'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const holder = activeFighter(state, 'player');
    holder.heldItem = 'leftovers';
    holder.hp = holder.maxHp - 50;
    runResidual(ctxOf(state, 'player'));
    expect(holder.hp).toBe(holder.maxHp - 50);
  });
});

describe('piercing and indirect-damage abilities (batch 9)', () => {
  it('Scrappy lets Normal and Fighting moves hit Ghosts, and blocks Intimidate', () => {
    const state = makeBattle(
      fighter('player', 'decidueyehisui', 'Scrappy'),
      fighter('enemy', 'gastly', 'Levitate'),
    );
    expect(runModifyEffectiveness(moveCtxOf(state, 'player', 'tackle'), getMove('tackle')!, 0)).toBe(1);
    expect(runModifyEffectiveness(moveCtxOf(state, 'player', 'ember'), getMove('ember')!, 0)).toBe(0);

    const intimidated = makeBattle(
      fighter('player', 'decidueyehisui', 'Scrappy'),
      fighter('enemy', 'growlithe', 'Intimidate'),
    );
    expect(activeFighter(intimidated, 'player').boosts.atk).toBe(0);
  });

  it("Mind's Eye pierces Ghost immunity and ignores the foe evasiveness", () => {
    const state = makeBattle(
      fighter('player', 'ursalunabloodmoon', "Mind's Eye"),
      fighter('enemy', 'gastly', 'Levitate'),
    );
    expect(runModifyEffectiveness(moveCtxOf(state, 'player', 'tackle'), getMove('tackle')!, 0)).toBe(1);

    activeFighter(state, 'enemy').boosts.evasion = 6;
    const control = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'gastly', 'Levitate'),
    );
    activeFighter(control, 'enemy').boosts.evasion = 6;
    expect(hitChance(state, 'player', getMove('tackle')!)).toBeGreaterThan(
      hitChance(control, 'player', getMove('tackle')!),
    );
  });

  it('Magic Guard ignores indirect damage but not attacks', () => {
    const state = makeBattle(
      fighter('player', 'clefairy', 'Magic Guard', ['growl']),
      fighter('enemy', 'blissey', 'Natural Cure', ['growl']),
    );
    const holder = activeFighter(state, 'player');
    holder.status = 'psn';
    holder.statusCounter = 1;
    const before = holder.hp;
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(holder.status).toBe('psn');
    expect(holder.hp).toBe(before);
  });
});

describe('type-change and turn-shape abilities (batch 9)', () => {
  it('Protean changes type once per switch-in', () => {
    const state = makeBattle(
      fighter('player', 'greninja', 'Protean', ['ember', 'watergun']),
      fighter('enemy', 'blissey', 'Natural Cure', ['growl']),
    );
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'player').types).toEqual(['Fire']);
    takeTurn(state, { type: 'fight', moveIndex: 1 }, { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'player').types).toEqual(['Fire']);
  });

  it('Libero changes type to the used move', () => {
    const state = makeBattle(
      fighter('player', 'cinderace', 'Libero', ['ember']),
      fighter('enemy', 'blissey', 'Natural Cure', ['growl']),
    );
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'player').types).toEqual(['Fire']);
  });

  it('Truant loafs on every other turn', () => {
    const state = makeBattle(
      fighter('player', 'slaking', 'Truant', ['tackle']),
      fighter('enemy', 'blissey', 'Natural Cure', ['growl']),
    );
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(
      state.log.some((event) => event.kind === 'text' && event.text.includes('loafing around')),
    ).toBe(true);
  });

  it('Trace copies the foe ability and runs its entry effects', () => {
    const state = makeBattle(
      fighter('player', 'porygon', 'Trace'),
      fighter('enemy', 'growlithe', 'Intimidate'),
    );
    expect(activeFighter(state, 'player').ability).toBe('Intimidate');
    expect(activeFighter(state, 'enemy').boosts.atk).toBe(-1);
  });

  it('Long Reach stops the holder moves from making contact', () => {
    const state = makeBattle(
      fighter('player', 'rowlet', 'Long Reach', ['tackle']),
      fighter('enemy', 'pikachu', 'Static'),
    );
    for (let i = 0; i < 100; i++) runAfterMove(ctxOf(state, 'player'), getMove('tackle')!);
    expect(activeFighter(state, 'player').status).toBeNull();
  });
});

describe('charge, faint and order abilities (batch 9)', () => {
  it('Electromorphosis stores a Charge for the next Electric move', () => {
    const state = makeBattle(
      fighter('player', 'bellibolt', 'Electromorphosis'),
      fighter('enemy', 'charmander', 'Blaze', ['tackle']),
    );
    runAfterMove(ctxOf(state, 'enemy'), getMove('tackle')!);
    expect(activeFighter(state, 'player').volatiles.charge).toBe(true);
    expect(runModifyDamage(ctxOf(state, 'player'), getMove('thunderbolt')!, 100)).toBe(200);
    expect(activeFighter(state, 'player').volatiles.charge).toBe(false);
  });

  it('Wind Power only charges from a wind move', () => {
    const state = makeBattle(
      fighter('player', 'wattrel', 'Wind Power'),
      fighter('enemy', 'charmander', 'Blaze', ['tackle']),
    );
    runAfterMove(ctxOf(state, 'enemy'), getMove('tackle')!);
    expect(activeFighter(state, 'player').volatiles.charge).toBe(false);
    runAfterMove(ctxOf(state, 'enemy'), getMove('gust')!);
    expect(activeFighter(state, 'player').volatiles.charge).toBe(true);
  });

  it('Soul-Heart raises Sp. Atk when any Pokémon faints', () => {
    const state = makeBattle(
      fighter('player', 'magearna', 'Soul-Heart', ['tackle']),
      fighter('enemy', 'charmander', 'Blaze', ['growl']),
    );
    activeFighter(state, 'enemy').hp = 1;
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'player').boosts.spa).toBe(1);
  });

  it('Quick Draw sometimes wins the fractional tie-break', () => {
    const state = makeBattle(
      fighter('player', 'slowbrogalar', 'Quick Draw'),
      fighter('enemy', 'charmander', 'Blaze'),
      7,
    );
    const values = new Set<number>();
    for (let i = 0; i < 50; i++) values.add(runFractionalPriority(ctxOf(state, 'player')));
    expect(values.has(1)).toBe(true);
    expect(values.has(0)).toBe(true);
  });

  it('Stall always loses the fractional tie-break', () => {
    const state = makeBattle(
      fighter('player', 'sableye', 'Stall'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runFractionalPriority(ctxOf(state, 'player'))).toBe(-1);
  });
});

describe('ability suppression and auras (batch 10)', () => {
  function hpLost(state: BattleState): number {
    const foe = activeFighter(state, 'enemy');
    const before = foe.hp;
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    return before - foe.hp;
  }

  it('Mold Breaker, Teravolt and Turboblaze pierce the foe ability', () => {
    for (const [species, ability] of [
      ['cranidos', 'Mold Breaker'],
      ['zekrom', 'Teravolt'],
      ['reshiram', 'Turboblaze'],
    ] as const) {
      const state = makeBattle(
        fighter('player', species, ability),
        fighter('enemy', 'gastly', 'Levitate'),
      );
      state.abilityPierce = activeFighter(state, 'player');
      expect(runTryHit(ctxOf(state, 'player'), getMove('earthquake')!)).toBe(true);
      state.abilityPierce = null;
      expect(runTryHit(ctxOf(state, 'player'), getMove('earthquake')!)).toBe(false);
    }
  });

  it('Mold Breaker lets a Ground move hurt a Levitate foe, then stops piercing', () => {
    const state = makeBattle(
      fighter('player', 'cranidos', 'Mold Breaker', ['earthquake']),
      fighter('enemy', 'gastly', 'Levitate', ['growl']),
    );
    expect(hpLost(state)).toBeGreaterThan(0);
    expect(state.abilityPierce).toBeNull();

    const control = makeBattle(
      fighter('player', 'charmander', 'Blaze', ['earthquake']),
      fighter('enemy', 'gastly', 'Levitate', ['growl']),
    );
    expect(hpLost(control)).toBe(0);
  });

  it('Neutralizing Gas suppresses the opposing ability', () => {
    const state = makeBattle(
      fighter('player', 'gastly', 'Levitate'),
      fighter('enemy', 'koffing', 'Neutralizing Gas'),
    );
    expect(runTryHit(ctxOf(state, 'enemy'), getMove('earthquake')!)).toBe(true);

    const control = makeBattle(
      fighter('player', 'gastly', 'Levitate'),
      fighter('enemy', 'koffing', 'Stench'),
    );
    expect(runTryHit(ctxOf(control, 'enemy'), getMove('earthquake')!)).toBe(false);
  });

  it('Mycelium Might sends status moves last and pierces the foe ability', () => {
    const state = makeBattle(
      fighter('player', 'toedscruel', 'Mycelium Might'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runFractionalPriority(moveCtxOf(state, 'player', 'spore'))).toBe(-1);
    expect(runFractionalPriority(moveCtxOf(state, 'player', 'tackle'))).toBe(0);

    const sleep = makeBattle(
      fighter('player', 'toedscruel', 'Mycelium Might', ['spore']),
      fighter('enemy', 'bounsweet', 'Sweet Veil', ['growl']),
    );
    takeTurn(sleep, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(activeFighter(sleep, 'enemy').status).toBe('slp');

    const blocked = makeBattle(
      fighter('player', 'charmander', 'Blaze', ['spore']),
      fighter('enemy', 'bounsweet', 'Sweet Veil', ['growl']),
    );
    takeTurn(blocked, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(activeFighter(blocked, 'enemy').status).toBeNull();
  });

  it('Unaware ignores the foe stat stages on offense and defense', () => {
    const defended = makeBattle(
      fighter('player', 'charmander', 'Blaze', ['tackle']),
      fighter('enemy', 'clefable', 'Unaware', ['growl']),
      42,
    );
    const defendedOff = makeBattle(
      fighter('player', 'charmander', 'Blaze', ['tackle']),
      fighter('enemy', 'clefable', 'Unaware', ['growl']),
      42,
    );
    activeFighter(defended, 'player').boosts.atk = 6;
    activeFighter(defendedOff, 'player').boosts.atk = 6;
    activeFighter(defendedOff, 'enemy').ability = 'Blaze';
    expect(hpLost(defended)).toBeLessThan(hpLost(defendedOff));

    const attacked = makeBattle(
      fighter('player', 'clefable', 'Unaware', ['tackle']),
      fighter('enemy', 'blissey', 'Natural Cure', ['growl']),
      42,
    );
    const attackedOff = makeBattle(
      fighter('player', 'clefable', 'Unaware', ['tackle']),
      fighter('enemy', 'blissey', 'Natural Cure', ['growl']),
      42,
    );
    activeFighter(attacked, 'enemy').boosts.def = 6;
    activeFighter(attackedOff, 'enemy').boosts.def = 6;
    activeFighter(attackedOff, 'player').ability = 'Blaze';
    expect(hpLost(attacked)).toBeGreaterThan(hpLost(attackedOff));
  });

  it('the Ruin auras shift damage through the holder stats', () => {
    const sword = makeBattle(
      fighter('player', 'chienpao', 'Sword of Ruin', ['tackle']),
      fighter('enemy', 'blissey', 'Natural Cure', ['growl']),
      42,
    );
    const swordOff = makeBattle(
      fighter('player', 'chienpao', 'Sword of Ruin', ['tackle']),
      fighter('enemy', 'blissey', 'Natural Cure', ['growl']),
      42,
    );
    activeFighter(swordOff, 'player').ability = 'Blaze';
    expect(hpLost(sword)).toBeGreaterThan(hpLost(swordOff));

    const tablets = makeBattle(
      fighter('player', 'charmander', 'Blaze', ['tackle']),
      fighter('enemy', 'wochien', 'Tablets of Ruin', ['growl']),
      42,
    );
    const tabletsOff = makeBattle(
      fighter('player', 'charmander', 'Blaze', ['tackle']),
      fighter('enemy', 'wochien', 'Tablets of Ruin', ['growl']),
      42,
    );
    activeFighter(tabletsOff, 'enemy').ability = 'Blaze';
    expect(hpLost(tablets)).toBeLessThan(hpLost(tabletsOff));

    const beads = makeBattle(
      fighter('player', 'chiyu', 'Beads of Ruin', ['ember']),
      fighter('enemy', 'blissey', 'Natural Cure', ['growl']),
      42,
    );
    const beadsOff = makeBattle(
      fighter('player', 'chiyu', 'Beads of Ruin', ['ember']),
      fighter('enemy', 'blissey', 'Natural Cure', ['growl']),
      42,
    );
    activeFighter(beadsOff, 'player').ability = 'Blaze';
    expect(hpLost(beads)).toBeGreaterThan(hpLost(beadsOff));

    const vessel = makeBattle(
      fighter('player', 'charmander', 'Blaze', ['ember']),
      fighter('enemy', 'tinglu', 'Vessel of Ruin', ['growl']),
      42,
    );
    const vesselOff = makeBattle(
      fighter('player', 'charmander', 'Blaze', ['ember']),
      fighter('enemy', 'tinglu', 'Vessel of Ruin', ['growl']),
      42,
    );
    activeFighter(vesselOff, 'enemy').ability = 'Blaze';
    expect(hpLost(vessel)).toBeLessThan(hpLost(vesselOff));
  });
});

describe('weather and type abilities (batch 11)', () => {
  it('Air Lock and Cloud Nine nullify weather effects', () => {
    const airLock = makeBattle(
      fighter('player', 'rayquaza', 'Air Lock', ['growl']),
      fighter('enemy', 'blissey', 'Natural Cure', ['growl']),
    );
    airLock.weather = 'sand';
    airLock.weatherTurns = 5;
    const before = activeFighter(airLock, 'player').hp;
    takeTurn(airLock, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(activeFighter(airLock, 'player').hp).toBe(before);
    expect(effectiveWeather(airLock)).toBeNull();

    const cloud = makeBattle(
      fighter('player', 'psyduck', 'Cloud Nine', ['growl']),
      fighter('enemy', 'blissey', 'Natural Cure', ['growl']),
    );
    cloud.weather = 'sand';
    cloud.weatherTurns = 5;
    expect(effectiveWeather(cloud)).toBeNull();
    expect(cloud.weather).toBe('sand');
  });

  it('Air Lock removes the weather damage modifier', () => {
    const on = makeBattle(
      fighter('player', 'rayquaza', 'Air Lock', ['ember']),
      fighter('enemy', 'blissey', 'Natural Cure', ['growl']),
      42,
    );
    const off = makeBattle(
      fighter('player', 'rayquaza', 'Air Lock', ['ember']),
      fighter('enemy', 'blissey', 'Natural Cure', ['growl']),
      42,
    );
    activeFighter(off, 'player').ability = 'Blaze';
    for (const state of [on, off]) {
      state.weather = 'sun';
      state.weatherTurns = 5;
    }
    const foeOn = activeFighter(on, 'enemy');
    const foeOff = activeFighter(off, 'enemy');
    const beforeOn = foeOn.hp;
    const beforeOff = foeOff.hp;
    takeTurn(on, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    takeTurn(off, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(beforeOn - foeOn.hp).toBeLessThan(beforeOff - foeOff.hp);
  });
});

describe('type-changing and contact volatiles (batch 11)', () => {
  it('Galvanize, Pixilate and Liquid Voice retype the move', () => {
    const galvanize = makeBattle(
      fighter('player', 'geodudealola', 'Galvanize'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runModifyMoveType(moveCtxOf(galvanize, 'player', 'tackle'), getMove('tackle')!)).toBe(
      'Electric',
    );

    const pixilate = makeBattle(
      fighter('player', 'sylveon', 'Pixilate'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runModifyMoveType(moveCtxOf(pixilate, 'player', 'tackle'), getMove('tackle')!)).toBe('Fairy');

    const voice = makeBattle(
      fighter('player', 'primarina', 'Liquid Voice'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    expect(runModifyMoveType(moveCtxOf(voice, 'player', 'hypervoice'), getMove('hypervoice')!)).toBe(
      'Water',
    );
    expect(runModifyMoveType(moveCtxOf(voice, 'player', 'tackle'), getMove('tackle')!)).toBe('Normal');
  });

  it('Galvanize makes a Normal move Electric, so Ground is immune', () => {
    const galvanize = makeBattle(
      fighter('player', 'geodudealola', 'Galvanize', ['tackle']),
      fighter('enemy', 'sandshrew', 'Sand Veil', ['growl']),
    );
    const neutral = makeBattle(
      fighter('player', 'geodudealola', 'Galvanize', ['tackle']),
      fighter('enemy', 'sandshrew', 'Sand Veil', ['growl']),
    );
    activeFighter(neutral, 'player').ability = 'Sturdy';
    const foeG = activeFighter(galvanize, 'enemy');
    const foeN = activeFighter(neutral, 'enemy');
    const beforeG = foeG.hp;
    const beforeN = foeN.hp;
    takeTurn(galvanize, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    takeTurn(neutral, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(beforeG - foeG.hp).toBe(0);
    expect(beforeN - foeN.hp).toBeGreaterThan(0);
  });

  it('Unseen Fist breaks through contact protection', () => {
    const state = makeBattle(
      fighter('player', 'urshifu', 'Unseen Fist', ['tackle', 'watergun']),
      fighter('enemy', 'blissey', 'Natural Cure'),
    );
    activeFighter(state, 'enemy').volatiles.protect = 'protect';
    expect(protectBlocks(state, 'player', getMove('tackle')!)).toBe(false);
    expect(protectBlocks(state, 'player', getMove('watergun')!)).toBe(true);

    const control = makeBattle(
      fighter('player', 'charmander', 'Blaze', ['tackle']),
      fighter('enemy', 'blissey', 'Natural Cure'),
    );
    activeFighter(control, 'enemy').volatiles.protect = 'protect';
    expect(protectBlocks(control, 'player', getMove('tackle')!)).toBe(true);
  });

  it('Cursed Body disables the contact attacker last move', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze', ['tackle', 'ember']),
      fighter('enemy', 'gengar', 'Cursed Body'),
      13,
    );
    const attacker = activeFighter(state, 'player');
    attacker.lastMoveId = 'tackle';
    for (let i = 0; i < 50 && !attacker.volatiles.disabledMove; i++) {
      runAfterMove(ctxOf(state, 'player'), getMove('tackle')!);
    }
    expect(attacker.volatiles.disabledMove).toBe('tackle');
    expect(legalMoveIndices(attacker)).toEqual([1]);
  });

  it('Cute Charm infatuates the contact attacker', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze', ['tackle']),
      fighter('enemy', 'clefairy', 'Cute Charm'),
      14,
    );
    const attacker = activeFighter(state, 'player');
    for (let i = 0; i < 50 && !attacker.volatiles.attract; i++) {
      runAfterMove(ctxOf(state, 'player'), getMove('tackle')!);
    }
    expect(attacker.volatiles.attract).toBe(true);

    let sawAttracted = false;
    for (let seed = 0; seed < 20 && !sawAttracted; seed++) {
      const victim = fighter('probe', 'charmander', 'Blaze');
      victim.volatiles.attract = true;
      const check = beforeMoveVolatile(victim, new Rng(seed));
      if (check && 'attracted' in check) sawAttracted = true;
    }
    expect(sawAttracted).toBe(true);
  });
});

describe('trapping, dance and entry abilities (batch 12)', () => {
  it('registers the batch 12 abilities', () => {
    const ids = abilityEffects().map((def) => def.id);
    for (const id of [
      'arenatrap',
      'shadowtag',
      'magnetpull',
      'battlebond',
      'cudchew',
      'dancer',
      'gluttony',
      'hadronengine',
      'orichalcumpulse',
      'protosynthesis',
      'quarkdrive',
      'magicbounce',
      'rivalry',
      'illuminate',
    ]) {
      expect(ids).toContain(id);
    }
  });

  it('Arena Trap, Shadow Tag and Magnet Pull trap the right foes', () => {
    const arena = makeBattle(
      fighter('player', 'sandshrew', 'Sand Veil'),
      fighter('enemy', 'diglett', 'Arena Trap'),
    );
    expect(isTrapped(arena, 'player')).toBe(true);

    const arenaFlyer = makeBattle(
      fighter('player', 'starly', 'Keen Eye'),
      fighter('enemy', 'diglett', 'Arena Trap'),
    );
    expect(isTrapped(arenaFlyer, 'player')).toBe(false);

    const tag = makeBattle(
      fighter('player', 'sandshrew', 'Sand Veil'),
      fighter('enemy', 'gothita', 'Shadow Tag'),
    );
    expect(isTrapped(tag, 'player')).toBe(true);

    const tagGhost = makeBattle(
      fighter('player', 'gastly', 'Levitate'),
      fighter('enemy', 'gothita', 'Shadow Tag'),
    );
    expect(isTrapped(tagGhost, 'player')).toBe(false);

    const magnet = makeBattle(
      fighter('player', 'magnemite', 'Magnet Pull'),
      fighter('enemy', 'magnemite', 'Magnet Pull'),
    );
    expect(isTrapped(magnet, 'player')).toBe(true);

    const noSteel = makeBattle(
      fighter('player', 'sandshrew', 'Sand Veil'),
      fighter('enemy', 'magnemite', 'Magnet Pull'),
    );
    expect(isTrapped(noSteel, 'player')).toBe(false);
  });

  it('trapping blocks switching and fleeing', () => {
    const state = createBattle({
      player: [fighter('player', 'sandshrew', 'Sand Veil'), fighter('bench', 'charmander', 'Blaze')],
      enemy: [fighter('enemy', 'diglett', 'Arena Trap')],
      rng: new Rng(1),
      isWild: true,
    });
    expect(validateCommand(state, 'player', { type: 'switch', partyIndex: 1 })).toContain(
      'cannot be switched',
    );
    expect(canRun(state, 'player')).toBe(false);
  });

  it('Battle Bond boosts the holder once after a knock out', () => {
    const state = makeBattle(
      fighter('player', 'greninja', 'Battle Bond', ['watergun']),
      fighter('enemy', 'blissey', 'Natural Cure'),
    );
    activeFighter(state, 'enemy').hp = 0;
    const ctx = ctxOf(state, 'player');
    runAfterMove(ctx, getMove('watergun')!);
    const user = activeFighter(state, 'player');
    expect([user.boosts.atk, user.boosts.spa, user.boosts.spe]).toEqual([1, 1, 1]);

    runAfterMove(ctx, getMove('watergun')!);
    expect([user.boosts.atk, user.boosts.spa, user.boosts.spe]).toEqual([1, 1, 1]);
  });

  it('Cud Chew eats a consumed berry a second time', () => {
    const state = makeBattle(
      fighter('player', 'farigiraf', 'Cud Chew'),
      fighter('enemy', 'blissey', 'Natural Cure'),
    );
    const holder = activeFighter(state, 'player');
    holder.heldItem = 'sitrusberry';
    holder.hp = Math.floor(holder.maxHp / 2);
    runResidual(ctxOf(state, 'player'));
    expect(holder.heldItem).toBeNull();
    expect(holder.volatiles.cudChew).toBe('sitrusberry');

    holder.hp = 1;
    runResidual(ctxOf(state, 'player'));
    expect(holder.hp).toBeGreaterThan(1);
    expect(holder.volatiles.cudChew).toBeNull();
  });

  it('Dancer copies a dance move the foe uses', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze', ['swordsdance']),
      fighter('enemy', 'oricorio', 'Dancer'),
    );
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'player').boosts.atk).toBe(2);
    expect(activeFighter(state, 'enemy').boosts.atk).toBe(2);
  });

  it('Hadron Engine and Orichalcum Pulse set their field and boost', () => {
    const hadron = makeBattle(
      fighter('player', 'miraidon', 'Hadron Engine'),
      fighter('enemy', 'blissey', 'Natural Cure'),
    );
    expect(hadron.terrain).toBe('electric');
    expect(runModifyDamage(ctxOf(hadron, 'player'), getMove('thunderbolt')!, 100)).toBe(133);

    const pulse = makeBattle(
      fighter('player', 'koraidon', 'Orichalcum Pulse'),
      fighter('enemy', 'blissey', 'Natural Cure'),
    );
    expect(pulse.weather).toBe('sun');
    expect(runModifyDamage(ctxOf(pulse, 'player'), getMove('tackle')!, 100)).toBe(133);
  });

  it('Protosynthesis and Quark Drive boost the highest stat in their field', () => {
    const sun = makeBattle(
      fighter('player', 'greattusk', 'Protosynthesis'),
      fighter('enemy', 'blissey', 'Natural Cure'),
    );
    const noSun = makeBattle(
      fighter('player', 'greattusk', 'Protosynthesis'),
      fighter('enemy', 'blissey', 'Natural Cure'),
    );
    sun.weather = 'sun';
    sun.weatherTurns = 5;
    noSun.weather = 'rain';
    expect(runModifyDamage(ctxOf(sun, 'player'), getMove('tackle')!, 100)).toBe(130);
    expect(runModifyDamage(ctxOf(noSun, 'player'), getMove('tackle')!, 100)).toBe(100);

    const terrain = makeBattle(
      fighter('player', 'ironhands', 'Quark Drive'),
      fighter('enemy', 'blissey', 'Natural Cure'),
    );
    terrain.terrain = 'electric';
    expect(runModifyDamage(ctxOf(terrain, 'player'), getMove('tackle')!, 100)).toBe(130);
  });

  it('Magic Bounce reflects a status move back at its user', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze', ['toxic']),
      fighter('enemy', 'espeon', 'Magic Bounce'),
    );
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'player').status).toBe('tox');
    expect(activeFighter(state, 'enemy').status).toBeNull();
  });

  it('Rivalry is stronger against the same gender', () => {
    const same = makeBattle(
      fighter('player', 'luxray', 'Rivalry'),
      fighter('enemy', 'blissey', 'Natural Cure'),
    );
    const opposite = makeBattle(
      fighter('player', 'luxray', 'Rivalry'),
      fighter('enemy', 'blissey', 'Natural Cure'),
    );
    activeFighter(same, 'player').gender = 'male';
    activeFighter(same, 'enemy').gender = 'male';
    activeFighter(opposite, 'player').gender = 'male';
    activeFighter(opposite, 'enemy').gender = 'female';
    expect(runModifyDamage(ctxOf(same, 'player'), getMove('tackle')!, 100)).toBe(125);
    expect(runModifyDamage(ctxOf(opposite, 'player'), getMove('tackle')!, 100)).toBe(75);
  });

  it('Illuminate blocks accuracy drops', () => {
    const state = makeBattle(
      fighter('player', 'chinchou', 'Illuminate'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const holder = activeFighter(state, 'player');
    applyBoostEffect(state, 'player', holder, { accuracy: -1 });
    expect(holder.boosts.accuracy).toBe(0);
  });
});

describe('transform and illusion abilities (batch 13)', () => {
  it('Imposter transforms into the foe on switch-in', () => {
    const state = makeBattle(
      fighter('player', 'ditto', 'Imposter'),
      fighter('enemy', 'charizard', 'Blaze'),
    );
    const ditto = activeFighter(state, 'player');
    const foe = activeFighter(state, 'enemy');
    expect(ditto.speciesId).toBe('charizard');
    expect(ditto.volatiles.transformed).toBe(true);
    expect(ditto.moves.map((slot) => slot.moveId)).toEqual(foe.moves.map((slot) => slot.moveId));
    expect(ditto.hp).toBe(ditto.maxHp);
  });

  it('Illusion disguises the holder as the last healthy party member until hit', () => {
    const state = createBattle({
      player: [fighter('zoroark', 'zoroark', 'Illusion'), fighter('buddy', 'charmander', 'Blaze')],
      enemy: [fighter('enemy', 'bulbasaur', 'Overgrow')],
      rng: new Rng(1),
      isWild: true,
    });
    const zoroark = activeFighter(state, 'player');
    expect(zoroark.volatiles.illusion).toBe('charmander');

    const tackle = getMove('tackle')!;
    const ctx = makeContext(state, 'enemy', {
      source: activeFighter(state, 'enemy'),
      target: zoroark,
      move: tackle,
    });
    runAfterMove(ctx, tackle);
    expect(zoroark.volatiles.illusion).toBeNull();
  });
});

describe('reworked random-ability picks', () => {
  it('Wonder Guard absorbs the first non-super-effective hit, then lets the next land', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'snom', 'Wonder Guard'),
    );
    const ctx = ctxOf(state, 'player');
    // Tackle (Normal) is neutral on Snom (Ice/Bug), so the shield blocks it.
    expect(runTryHit(ctx, getMove('tackle')!)).toBe(false);
    // The second hit lands normally.
    expect(runTryHit(ctx, getMove('tackle')!)).toBe(true);
  });

  it('Wonder Guard lets a super-effective hit through and spends the shield', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'snom', 'Wonder Guard'),
    );
    const ctx = ctxOf(state, 'player');
    // Ember (Fire) is super effective on Snom, so it pierces the shield.
    expect(runTryHit(ctx, getMove('ember')!)).toBe(true);
    // The shield is spent, so a later neutral hit lands too.
    expect(runTryHit(ctx, getMove('tackle')!)).toBe(true);
  });

  it('Zero to Hero turns any holder into Palafin-Hero on switch-out, battle only', () => {
    const state = makeBattle(
      fighter('player', 'eevee', 'Zero to Hero'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const eevee = activeFighter(state, 'player');
    state.sides.player.party.push(fighter('buddy', 'charmander', 'Blaze'));
    performSwitch(state, 'player', 1);
    expect(eevee.speciesId).toBe('palafinhero');
    expect(eevee.types).toEqual(['Water']);
    // The run snapshot keeps the base species and the ability.
    const snapshot = snapshotFighter(eevee);
    expect(snapshot.speciesId).toBe('eevee');
    expect(snapshot.ability).toBe('Zero to Hero');
  });
});

describe('generalised form abilities (batch 14)', () => {
  it('Schooling holds School Form above a quarter HP and drops it below', () => {
    const state = makeBattle(
      fighter('player', 'eevee', 'Schooling'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const holder = activeFighter(state, 'player');
    runStart(ctxOf(state, 'player'));
    expect(holder.speciesId).toBe('wishiwashischool');
    holder.hp = Math.floor(holder.maxHp / 4);
    runResidual(ctxOf(state, 'player'));
    expect(holder.speciesId).toBe('eevee');
  });

  it('does nothing below level 20', () => {
    const low = createFighter({ id: 'player', speciesId: 'eevee', level: 19, ability: 'Schooling' });
    const state = makeBattle(low, fighter('enemy', 'charmander', 'Blaze'));
    runStart(ctxOf(state, 'player'));
    expect(activeFighter(state, 'player').speciesId).toBe('eevee');
  });

  it('Zen Mode and Zen Mode (Galar) reach their own forme at half HP and keep the ability', () => {
    const plain = makeBattle(
      fighter('player', 'eevee', 'Zen Mode'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const zen = activeFighter(plain, 'player');
    zen.hp = Math.floor(zen.maxHp / 2);
    runStart(ctxOf(plain, 'player'));
    expect(zen.speciesId).toBe('darmanitanzen');
    expect(zen.ability).toBe('Zen Mode');

    const galar = makeBattle(
      fighter('player', 'eevee', 'Zen Mode (Galar)'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const gzen = activeFighter(galar, 'player');
    gzen.hp = Math.floor(gzen.maxHp / 2);
    runStart(ctxOf(galar, 'player'));
    expect(gzen.speciesId).toBe('darmanitangalarzen');
    expect(gzen.ability).toBe('Zen Mode (Galar)');
  });

  it('Shields Down breaks to the Core forme at half HP', () => {
    const state = makeBattle(
      fighter('player', 'eevee', 'Shields Down'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const holder = activeFighter(state, 'player');
    runStart(ctxOf(state, 'player'));
    expect(holder.speciesId).toBe('miniormeteor');
    holder.hp = 1;
    runResidual(ctxOf(state, 'player'));
    expect(holder.speciesId).toBe('minior');
  });

  it('Tera Shift enters Terastal Form as it takes the field', () => {
    const state = makeBattle(
      fighter('player', 'eevee', 'Tera Shift'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    runStart(ctxOf(state, 'player'));
    expect(activeFighter(state, 'player').speciesId).toBe('terapagosterastal');
  });

  it('Hunger Switch alternates the Hangry forme every turn', () => {
    const state = makeBattle(
      fighter('player', 'eevee', 'Hunger Switch'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const holder = activeFighter(state, 'player');
    runResidual(ctxOf(state, 'player'));
    expect(holder.speciesId).toBe('morpekohangry');
    runResidual(ctxOf(state, 'player'));
    expect(holder.speciesId).toBe('eevee');
  });

  it('Forecast follows the weather', () => {
    const state = makeBattle(
      fighter('player', 'eevee', 'Forecast'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const holder = activeFighter(state, 'player');
    state.weather = 'rain';
    runStart(ctxOf(state, 'player'));
    expect(holder.speciesId).toBe('castformrainy');
    state.weather = null;
    runResidual(ctxOf(state, 'player'));
    expect(holder.speciesId).toBe('eevee');
  });

  it('Flower Gift opens to Sunshine Form in the sun', () => {
    const state = makeBattle(
      fighter('player', 'eevee', 'Flower Gift'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const holder = activeFighter(state, 'player');
    state.weather = 'sun';
    runStart(ctxOf(state, 'player'));
    expect(holder.speciesId).toBe('cherrimsunshine');
  });

  it('Stance Change reaches Blade Forme on a damaging move and reverts on King\u2019s Shield', () => {
    const state = makeBattle(
      fighter('player', 'eevee', 'Stance Change', ['tackle', 'kingsshield']),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const holder = activeFighter(state, 'player');
    runAfterMove(ctxOf(state, 'player'), getMove('tackle')!);
    expect(holder.speciesId).toBe('aegislashblade');
    runAfterMove(ctxOf(state, 'player'), getMove('kingsshield')!);
    expect(holder.speciesId).toBe('eevee');
  });

  it('Disguise absorbs the first damaging hit and leaves the holder Busted', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'eevee', 'Disguise'),
    );
    const mimic = activeFighter(state, 'enemy');
    runStart(makeContext(state, 'enemy', { source: mimic }));
    const ctx = ctxOf(state, 'player');
    expect(runTryHit(ctx, getMove('tackle')!)).toBe(false);
    expect(mimic.speciesId).toBe('mimikyubusted');
    // The disguise is spent, so the next hit lands.
    expect(runTryHit(ctx, getMove('tackle')!)).toBe(true);
  });
});

describe('ported reachable abilities', () => {
  it('Dark Aura boosts Dark moves and Aura Break reverses it', () => {
    const move = getMove('bite')!;
    const of = (state: BattleState): number =>
      runModifyDamage(moveCtxOf(state, 'player', 'bite'), move, 100, 1, false);
    const plain = makeBattle(
      fighter('p', 'umbreon', 'Synchronize'),
      fighter('e', 'snorlax', 'Immunity'),
    );
    const aura = makeBattle(fighter('p', 'umbreon', 'Dark Aura'), fighter('e', 'snorlax', 'Immunity'));
    const broken = makeBattle(
      fighter('p', 'umbreon', 'Dark Aura'),
      fighter('e', 'snorlax', 'Aura Break'),
    );
    expect(of(aura)).toBeGreaterThan(of(plain));
    expect(of(broken)).toBeLessThan(of(plain));
  });

  it('Beast Boost raises the holder highest stat after a knockout', () => {
    const state = makeBattle(
      fighter('p', 'kartana', 'Beast Boost', ['tackle']),
      fighter('e', 'bulbasaur', 'Overgrow', ['tackle']),
    );
    activeFighter(state, 'enemy').hp = 0;
    runAfterMove(moveCtxOf(state, 'player', 'tackle'), getMove('tackle')!);
    const player = activeFighter(state, 'player');
    const best = (['atk', 'def', 'spa', 'spd', 'spe'] as const).reduce((a, b) =>
      player.stats[a] >= player.stats[b] ? a : b,
    );
    expect(player.boosts[best]).toBe(1);
  });

  it('Defeatist halves damage at or below half HP', () => {
    const state = makeBattle(
      fighter('p', 'archen', 'Defeatist', ['tackle']),
      fighter('e', 'snorlax', 'Immunity'),
    );
    const ctx = moveCtxOf(state, 'player', 'tackle');
    const move = getMove('tackle')!;
    const full = runModifyDamage(ctx, move, 100, 1, false);
    activeFighter(state, 'player').hp = 1;
    expect(runModifyDamage(ctx, move, 100, 1, false)).toBeLessThan(full);
  });

  it('Color Change takes the type of the move that hit the holder', () => {
    const state = makeBattle(
      fighter('p', 'charmander', 'Blaze', ['ember']),
      fighter('e', 'kecleon', 'Color Change'),
    );
    runAfterMove(moveCtxOf(state, 'player', 'ember'), getMove('ember')!);
    expect(activeFighter(state, 'enemy').types).toEqual(['Fire']);
  });

  it('Mimicry retypes the holder to the terrain', () => {
    const state = makeBattle(fighter('p', 'charmander', 'Blaze'), fighter('e', 'stunfisk', 'Mimicry'));
    setTerrain(state, 'grassy');
    runResidual(ctxOf(state, 'enemy'));
    expect(activeFighter(state, 'enemy').types).toEqual(['Grass']);
  });

  it('Cotton Down lowers the Speed of whatever hits the holder', () => {
    const state = makeBattle(
      fighter('p', 'charmander', 'Blaze', ['tackle']),
      fighter('e', 'cufant', 'Cotton Down'),
    );
    runAfterMove(moveCtxOf(state, 'player', 'tackle'), getMove('tackle')!);
    expect(activeFighter(state, 'player').boosts.spe).toBe(-1);
  });

  it('Iron Barbs hurts a contact attacker', () => {
    const state = makeBattle(
      fighter('p', 'charmander', 'Blaze', ['tackle']),
      fighter('e', 'ferrothorn', 'Iron Barbs'),
    );
    const before = activeFighter(state, 'player').hp;
    runAfterMove(moveCtxOf(state, 'player', 'tackle'), getMove('tackle')!);
    expect(activeFighter(state, 'player').hp).toBeLessThan(before);
  });

  it('Mummy overwrites a contact attacker ability', () => {
    const state = makeBattle(
      fighter('p', 'charmander', 'Blaze', ['tackle']),
      fighter('e', 'cacturne', 'Mummy'),
    );
    runAfterMove(moveCtxOf(state, 'player', 'tackle'), getMove('tackle')!);
    expect(activeFighter(state, 'player').ability).toBe('Mummy');
  });

  it('Wandering Spirit swaps abilities on contact', () => {
    const state = makeBattle(
      fighter('p', 'charmander', 'Blaze', ['tackle']),
      fighter('e', 'cacturne', 'Wandering Spirit'),
    );
    runAfterMove(moveCtxOf(state, 'player', 'tackle'), getMove('tackle')!);
    expect(activeFighter(state, 'player').ability).toBe('Wandering Spirit');
    expect(activeFighter(state, 'enemy').ability).toBe('Blaze');
  });

  it('Perish Body puts a perish count on both Pokémon', () => {
    const state = makeBattle(
      fighter('p', 'charmander', 'Blaze', ['tackle']),
      fighter('e', 'corsola', 'Perish Body'),
    );
    runAfterMove(moveCtxOf(state, 'player', 'tackle'), getMove('tackle')!);
    expect(activeFighter(state, 'player').volatiles.perish).toBe(3);
    expect(activeFighter(state, 'enemy').volatiles.perish).toBe(3);
  });

  it('Pastel Veil blocks poison', () => {
    const state = makeBattle(fighter('p', 'ponyta', 'Pastel Veil'), fighter('e', 'charmander', 'Blaze'));
    const holder = activeFighter(state, 'player');
    applyStatusEffect(state, 'player', holder, 'psn');
    expect(holder.status).toBeNull();
  });

  it('Screen Cleaner wipes the screens on entry', () => {
    const state = makeBattle(fighter('p', 'charmander', 'Blaze'), fighter('e', 'snorlax', 'Immunity'));
    state.sides.player.sideConditions.reflect = 5;
    state.sides.enemy.sideConditions.lightscreen = 5;
    activeFighter(state, 'player').ability = 'Screen Cleaner';
    runSwitchIn(ctxOf(state, 'player'));
    expect(state.sides.player.sideConditions.reflect).toBe(0);
    expect(state.sides.enemy.sideConditions.lightscreen).toBe(0);
  });

  it('Steelworker powers up Steel moves', () => {
    const move = getMove('gyroball')!;
    const steel = makeBattle(
      fighter('p', 'dhelmise', 'Steelworker', ['gyroball']),
      fighter('e', 'snorlax', 'Immunity'),
    );
    const plain = makeBattle(
      fighter('p', 'dhelmise', 'Synchronize', ['gyroball']),
      fighter('e', 'snorlax', 'Immunity'),
    );
    expect(runModifyDamage(moveCtxOf(steel, 'player', 'gyroball'), move, 100, 1, false)).toBeGreaterThan(
      runModifyDamage(moveCtxOf(plain, 'player', 'gyroball'), move, 100, 1, false),
    );
  });

  it('Victory Star raises accuracy', () => {
    const state = makeBattle(
      fighter('p', 'victini', 'Victory Star'),
      fighter('e', 'snorlax', 'Immunity'),
    );
    expect(runModifyAccuracy(moveCtxOf(state, 'player', 'tackle'), 0.75)).toBeCloseTo(0.825);
  });

  it('Innards Out deals back the fainting hit', () => {
    const state = makeBattle(
      fighter('p', 'charmander', 'Blaze', ['tackle']),
      fighter('e', 'pyukumuku', 'Innards Out'),
    );
    const enemy = activeFighter(state, 'enemy');
    enemy.hp = 0;
    enemy.volatiles.lastDamageTaken = 5;
    const before = activeFighter(state, 'player').hp;
    runAfterMove(moveCtxOf(state, 'player', 'tackle'), getMove('tackle')!);
    expect(activeFighter(state, 'player').hp).toBe(before - 5);
  });

  it('Wimp Out asks for a switch below half HP', () => {
    const state = createBattle({
      player: [fighter('p', 'charmander', 'Blaze', ['tackle'])],
      enemy: [fighter('e1', 'crabrawler', 'Wimp Out'), fighter('e2', 'bulbasaur', 'Overgrow')],
      rng: new Rng(1),
      isWild: true,
    });
    const enemy = activeFighter(state, 'enemy');
    enemy.hp = Math.floor(enemy.maxHp / 2);
    runAfterMove(moveCtxOf(state, 'player', 'tackle'), getMove('tackle')!);
    expect(state.sides.enemy.awaitingReplacement).toBe(true);
  });

  it('Gorilla Tactics boosts Attack and locks the holder into its move', () => {
    const state = makeBattle(
      fighter('p', 'charmander', 'Gorilla Tactics', ['tackle', 'growl']),
      fighter('e', 'snorlax', 'Immunity'),
    );
    const move = getMove('tackle')!;
    expect(runModifyDamage(moveCtxOf(state, 'player', 'tackle'), move, 100, 1, false)).toBeGreaterThan(
      100,
    );
    runAfterMove(moveCtxOf(state, 'player', 'tackle'), move);
    expect(activeFighter(state, 'player').volatiles.gorillaTactics).toBe('tackle');
    expect(legalMoveIndices(activeFighter(state, 'player'))).toEqual([0]);
  });

  it('Desolate Land sets harsh sunlight', () => {
    const state = makeBattle(
      fighter('p', 'groudon', 'Desolate Land'),
      fighter('e', 'snorlax', 'Immunity'),
    );
    expect(effectiveWeather(state)).toBe('sun');
  });

  it('Primordial Sea sets rain', () => {
    const state = makeBattle(
      fighter('p', 'kyogre', 'Primordial Sea'),
      fighter('e', 'snorlax', 'Immunity'),
    );
    expect(effectiveWeather(state)).toBe('rain');
  });
});
