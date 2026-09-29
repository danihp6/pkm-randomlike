import { describe, expect, it } from 'vitest';
import { getMove } from '../../../data/dex';
import { Rng } from '../../rng';
import { createFighter, type BattleFighter } from '../fighter';
import { activeFighter, createBattle, opponentOf, type BattleState, type SideId } from '../state';
import {
  getEffect,
  makeContext,
  runAfterMove,
  runBoost,
  runModifyAccuracy,
  runModifyCrit,
  runModifyDamage,
  runModifyMultihit,
  runModifyPriority,
  runModifyRecoil,
  runModifySpe,
  runResidual,
  runTryEscape,
  runTryHit,
  runTrySubstitute,
  runTryVolatile,
  type EffectContext,
} from './registry';
import { applyBoostEffect, applyStatusEffect } from './apply';
import { abilityEffects } from './abilities';
import { performSwitch, takeTurn } from '../turn';
import { rollRun } from '../runAway';

function fighter(id: string, speciesId: string, ability: string, moves?: readonly string[]): BattleFighter {
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
    const state = makeBattle(fighter('player', 'ditto', 'Limber'), fighter('enemy', 'charmander', 'Blaze'));
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
    const state = makeBattle(fighter('player', 'gligar', 'Hyper Cutter'), fighter('enemy', 'charmander', 'Blaze'));
    const ctx = ctxOf(state, 'player');
    expect(runBoost(ctx, 'atk', -1, false)).toBe(false);
    expect(runBoost(ctx, 'def', -1, false)).toBe(true);
    expect(runBoost(ctx, 'atk', 1, false)).toBe(true);
    expect(runBoost(ctx, 'atk', -1, true)).toBe(true);
  });

  it('Keen Eye blocks accuracy drops only', () => {
    const state = makeBattle(fighter('player', 'hitmonchan', 'Keen Eye'), fighter('enemy', 'charmander', 'Blaze'));
    const ctx = ctxOf(state, 'player');
    expect(runBoost(ctx, 'accuracy', -1, false)).toBe(false);
    expect(runBoost(ctx, 'evasion', -1, false)).toBe(true);
  });

  it('Clear Body blocks every opposing drop', () => {
    const state = makeBattle(fighter('player', 'tentacool', 'Clear Body'), fighter('enemy', 'charmander', 'Blaze'));
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
    const thick = makeBattle(fighter('player', 'charmander', 'Blaze'), fighter('enemy', 'seel', 'Thick Fat'));
    expect(runModifyDamage(ctxOf(thick, 'player'), getMove('ember')!, 100)).toBe(50);
    expect(runModifyDamage(ctxOf(thick, 'player'), getMove('tackle')!, 100)).toBe(100);

    const scales = makeBattle(fighter('player', 'charmander', 'Blaze'), fighter('enemy', 'snom', 'Ice Scales'));
    expect(runModifyDamage(ctxOf(scales, 'player'), getMove('ember')!, 100)).toBe(50);
    expect(runModifyDamage(ctxOf(scales, 'player'), getMove('tackle')!, 100)).toBe(100);
  });

  it('Multiscale halves only at full HP and Filter only super-effective hits', () => {
    const multi = makeBattle(fighter('player', 'charmander', 'Blaze'), fighter('enemy', 'dragonite', 'Multiscale'));
    const dragonite = activeFighter(multi, 'enemy');
    expect(runModifyDamage(ctxOf(multi, 'player'), getMove('tackle')!, 100)).toBe(50);
    dragonite.hp -= 1;
    expect(runModifyDamage(ctxOf(multi, 'player'), getMove('tackle')!, 100)).toBe(100);

    const filter = makeBattle(fighter('player', 'charmander', 'Blaze'), fighter('enemy', 'necrozma', 'Prism Armor'));
    expect(runModifyDamage(ctxOf(filter, 'player'), getMove('tackle')!, 100, 2)).toBe(75);
    expect(runModifyDamage(ctxOf(filter, 'player'), getMove('tackle')!, 100, 1)).toBe(100);
  });

  it('Tough Claws, Strong Jaw and Huge Power boost the right moves', () => {
    const claws = makeBattle(fighter('player', 'meowthgalar', 'Tough Claws'), fighter('enemy', 'bulbasaur', 'Overgrow'));
    const ctx = ctxOf(claws, 'player');
    expect(runModifyDamage(ctx, getMove('tackle')!, 100)).toBe(130);
    expect(runModifyDamage(ctx, getMove('ember')!, 100)).toBe(100);

    const jaw = makeBattle(fighter('player', 'avalugghisui', 'Strong Jaw'), fighter('enemy', 'bulbasaur', 'Overgrow'));
    expect(runModifyDamage(ctxOf(jaw, 'player'), getMove('bite')!, 100)).toBe(150);

    const power = makeBattle(fighter('player', 'marill', 'Huge Power'), fighter('enemy', 'bulbasaur', 'Overgrow'));
    expect(runModifyDamage(ctxOf(power, 'player'), getMove('tackle')!, 100)).toBe(200);
    expect(runModifyDamage(ctxOf(power, 'player'), getMove('ember')!, 100)).toBe(100);
  });

  it('Intrepid Sword raises Attack on switch-in and Moxie on a KO', () => {
    const sword = makeBattle(fighter('player', 'zacian', 'Intrepid Sword'), fighter('enemy', 'bulbasaur', 'Overgrow'));
    expect(activeFighter(sword, 'player').boosts.atk).toBe(1);

    const moxie = makeBattle(fighter('player', 'gyarados', 'Moxie'), fighter('enemy', 'charmander', 'Blaze'));
    activeFighter(moxie, 'enemy').hp = 0;
    runAfterMove(ctxOf(moxie, 'player'), getMove('tackle')!);
    expect(activeFighter(moxie, 'player').boosts.atk).toBe(1);
  });

  it('Dry Skin absorbs Water, fears Fire and follows the weather', () => {
    const state = makeBattle(fighter('player', 'charmander', 'Blaze'), fighter('enemy', 'croagunk', 'Dry Skin'));
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
    const state = makeBattle(fighter('player', 'bulbasaur', 'Chlorophyll'), fighter('enemy', 'charmander', 'Blaze'));
    const ctx = ctxOf(state, 'player');
    expect(runModifySpe(ctx, 100)).toBe(100);
    state.weather = 'sun';
    expect(runModifySpe(ctx, 100)).toBe(200);
    state.weather = 'rain';
    expect(runModifySpe(ctx, 100)).toBe(100);

    state.weather = 'rain';
    const swim = makeBattle(fighter('player', 'poliwag', 'Swift Swim'), fighter('enemy', 'charmander', 'Blaze'));
    swim.weather = 'rain';
    expect(runModifySpe(ctxOf(swim, 'player'), 100)).toBe(200);

    const rush = makeBattle(fighter('player', 'drilbur', 'Sand Rush'), fighter('enemy', 'charmander', 'Blaze'));
    rush.weather = 'sand';
    expect(runModifySpe(ctxOf(rush, 'player'), 100)).toBe(200);
  });

  it('Quick Feet ignores the paralysis drop and is 1.5x while statused', () => {
    const state = makeBattle(fighter('player', 'jolteon', 'Quick Feet'), fighter('enemy', 'charmander', 'Blaze'));
    const jolteon = activeFighter(state, 'player');
    const ctx = ctxOf(state, 'player');
    expect(runModifySpe(ctx, 60)).toBe(60);
    jolteon.status = 'par';
    expect(runModifySpe(ctx, Math.floor(jolteon.stats.spe / 2))).toBe(Math.floor(jolteon.stats.spe * 1.5));
  });
});

describe('accuracy abilities (batch 3)', () => {
  it('Compound Eyes and Hustle move the hit chance', () => {
    const eyes = makeBattle(fighter('player', 'venonat', 'Compound Eyes'), fighter('enemy', 'charmander', 'Blaze'));
    expect(runModifyAccuracy(ctxOf(eyes, 'player'), 0.6)).toBeCloseTo(0.78);

    const hustle = makeBattle(fighter('player', 'combee', 'Hustle'), fighter('enemy', 'charmander', 'Blaze'));
    const ctx = ctxOf(hustle, 'player');
    expect(runModifyAccuracy(ctx, 0.8)).toBeCloseTo(0.64);
    expect(runModifyDamage(ctx, getMove('tackle')!, 100)).toBe(150);
    expect(runModifyDamage(ctx, getMove('ember')!, 100)).toBe(100);
  });

  it('Sand Veil and Snow Cloak lower the foe accuracy in their weather', () => {
    const veil = makeBattle(fighter('player', 'charmander', 'Blaze'), fighter('enemy', 'sandshrew', 'Sand Veil'));
    veil.weather = 'sand';
    expect(runModifyAccuracy(ctxOf(veil, 'player'), 0.8)).toBeCloseTo(0.64);

    const cloak = makeBattle(fighter('player', 'charmander', 'Blaze'), fighter('enemy', 'sandshrewalola', 'Snow Cloak'));
    cloak.weather = 'snow';
    expect(runModifyAccuracy(ctxOf(cloak, 'player'), 0.8)).toBeCloseTo(0.64);

    const clear = makeBattle(fighter('player', 'charmander', 'Blaze'), fighter('enemy', 'sandshrew', 'Sand Veil'));
    expect(runModifyAccuracy(ctxOf(clear, 'player'), 0.8)).toBeCloseTo(0.8);
  });
});

describe('damage abilities (batch 3)', () => {
  it('Adaptability makes a same-type move 2x instead of 1.5x', () => {
    const state = makeBattle(fighter('player', 'eevee', 'Adaptability'), fighter('enemy', 'charmander', 'Blaze'));
    const ctx = ctxOf(state, 'player');
    expect(runModifyDamage(ctx, getMove('tackle')!, 150)).toBe(200);
    expect(runModifyDamage(ctx, getMove('ember')!, 100)).toBe(100);
  });

  it('Tinted Lens doubles a not-very-effective hit', () => {
    const state = makeBattle(fighter('player', 'venonat', 'Tinted Lens'), fighter('enemy', 'charmander', 'Blaze'));
    const ctx = ctxOf(state, 'player');
    expect(runModifyDamage(ctx, getMove('tackle')!, 100, 0.5)).toBe(200);
    expect(runModifyDamage(ctx, getMove('tackle')!, 100, 1)).toBe(100);
  });

  it('Sheer Force boosts a move with a secondary and suppresses it', () => {
    const state = makeBattle(fighter('player', 'croconaw', 'Sheer Force'), fighter('enemy', 'charmander', 'Blaze'));
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
    expect(activeFighter(control, 'enemy').boosts.spe).toBeLessThan(0);
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
    expect(activeFighter(control, 'enemy').boosts.spe).toBeLessThan(0);
  });

  it('Reckless boosts recoil moves', () => {
    const state = makeBattle(fighter('player', 'hitmonlee', 'Reckless'), fighter('enemy', 'charmander', 'Blaze'));
    const ctx = ctxOf(state, 'player');
    expect(runModifyDamage(ctx, getMove('doubleedge')!, 100)).toBe(120);
    expect(runModifyDamage(ctx, getMove('tackle')!, 100)).toBe(100);
  });

  it('Punk Rock boosts sound moves out and dampens them in', () => {
    const state = makeBattle(fighter('player', 'toxtricity', 'Punk Rock'), fighter('enemy', 'charmander', 'Blaze'));
    expect(runModifyDamage(ctxOf(state, 'player'), getMove('boomburst')!, 100)).toBe(130);
    expect(runModifyDamage(ctxOf(state, 'enemy'), getMove('boomburst')!, 100)).toBe(50);
    expect(runModifyDamage(ctxOf(state, 'player'), getMove('tackle')!, 100)).toBe(100);
  });

  it('Water Bubble doubles Water out and halves Fire in', () => {
    const state = makeBattle(fighter('player', 'dewpider', 'Water Bubble'), fighter('enemy', 'charmander', 'Blaze'));
    expect(runModifyDamage(ctxOf(state, 'player'), getMove('watergun')!, 100)).toBe(200);
    expect(runModifyDamage(ctxOf(state, 'enemy'), getMove('ember')!, 100)).toBe(50);
    expect(runModifyDamage(ctxOf(state, 'player'), getMove('tackle')!, 100)).toBe(100);
  });

  it('Fluffy halves contact and doubles Fire damage taken', () => {
    const state = makeBattle(fighter('player', 'charmander', 'Blaze'), fighter('enemy', 'greavard', 'Fluffy'));
    const ctx = ctxOf(state, 'player');
    expect(runModifyDamage(ctx, getMove('tackle')!, 100)).toBe(50);
    expect(runModifyDamage(ctx, getMove('ember')!, 100)).toBe(200);
  });

  it('Flash Fire absorbs Fire and boosts the next Fire move', () => {
    const state = makeBattle(fighter('player', 'charmander', 'Blaze'), fighter('enemy', 'vulpix', 'Flash Fire'));
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
    const ice = makeBattle(fighter('player', 'seel', 'Ice Body'), fighter('enemy', 'charmander', 'Blaze'));
    const seel = activeFighter(ice, 'player');
    ice.weather = 'snow';
    seel.hp = Math.floor(seel.maxHp / 2);
    runResidual(ctxOf(ice, 'player'));
    expect(seel.hp).toBe(Math.floor(seel.maxHp / 2) + Math.floor(seel.maxHp / 16));
    expect(ice.log.some((event) => event.kind === 'heal' && event.side === 'player')).toBe(true);

    const rain = makeBattle(fighter('player', 'squirtle', 'Rain Dish'), fighter('enemy', 'charmander', 'Blaze'));
    const squirtle = activeFighter(rain, 'player');
    rain.weather = 'rain';
    squirtle.hp = Math.floor(squirtle.maxHp / 2);
    runResidual(ctxOf(rain, 'player'));
    expect(squirtle.hp).toBe(Math.floor(squirtle.maxHp / 2) + Math.floor(squirtle.maxHp / 16));
  });

  it('Hydration cures a status in the rain', () => {
    const state = makeBattle(fighter('player', 'seel', 'Hydration'), fighter('enemy', 'charmander', 'Blaze'));
    const seel = activeFighter(state, 'player');
    seel.status = 'brn';
    runResidual(ctxOf(state, 'player'));
    expect(seel.status).toBe('brn');
    state.weather = 'rain';
    runResidual(ctxOf(state, 'player'));
    expect(seel.status).toBeNull();
  });

  it('Leaf Guard blocks status only in the sun', () => {
    const state = makeBattle(fighter('player', 'chikorita', 'Leaf Guard'), fighter('enemy', 'charmander', 'Blaze'));
    const chikorita = activeFighter(state, 'player');
    applyStatusEffect(state, 'player', chikorita, 'brn');
    expect(chikorita.status).toBe('brn');

    const sun = makeBattle(fighter('player', 'chikorita', 'Leaf Guard'), fighter('enemy', 'charmander', 'Blaze'));
    sun.weather = 'sun';
    applyStatusEffect(sun, 'player', activeFighter(sun, 'player'), 'brn');
    expect(activeFighter(sun, 'player').status).toBeNull();
  });

  it('Own Tempo, Inner Focus, Oblivious and Aroma Veil block their volatiles', () => {
    const tempo = makeBattle(fighter('player', 'slowpoke', 'Own Tempo'), fighter('enemy', 'charmander', 'Blaze'));
    expect(runTryVolatile(ctxOf(tempo, 'player'), 'confusion')).toBe(false);
    expect(runTryVolatile(ctxOf(tempo, 'player'), 'taunt')).toBe(true);

    const focus = makeBattle(fighter('player', 'drowzee', 'Inner Focus'), fighter('enemy', 'charmander', 'Blaze'));
    expect(runTryVolatile(ctxOf(focus, 'player'), 'flinch')).toBe(false);

    const oblivious = makeBattle(fighter('player', 'slowpoke', 'Oblivious'), fighter('enemy', 'charmander', 'Blaze'));
    expect(runTryVolatile(ctxOf(oblivious, 'player'), 'taunt')).toBe(false);

    const veil = makeBattle(fighter('player', 'milcery', 'Aroma Veil'), fighter('enemy', 'charmander', 'Blaze'));
    expect(runTryVolatile(ctxOf(veil, 'player'), 'taunt')).toBe(false);
    expect(runTryVolatile(ctxOf(veil, 'player'), 'encore')).toBe(false);
    expect(runTryVolatile(ctxOf(veil, 'player'), 'confusion')).toBe(true);
  });

  it('Inner Focus is immune to Intimidate', () => {
    const state = makeBattle(fighter('player', 'growlithe', 'Intimidate'), fighter('enemy', 'drowzee', 'Inner Focus'));
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

    const cure = makeBattle(fighter('player', 'chansey', 'Natural Cure'), fighter('enemy', 'charmander', 'Blaze'));
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
    expect(state.log.some((event) => event.kind === 'text' && event.text.includes('Leftovers'))).toBe(true);
  });

  it('Anticipation warns about a super-effective foe move', () => {
    const state = createBattle({
      player: [createFighter({ id: 'p', speciesId: 'eevee', level: 20, ability: 'Anticipation' })],
      enemy: [createFighter({ id: 'e', speciesId: 'riolu', level: 20, moves: ['forcepalm'] })],
      rng: new Rng(1),
      isWild: true,
    });
    expect(state.log.some((event) => event.kind === 'text' && event.text.includes('Anticipation'))).toBe(true);
  });

  it('Download raises the higher-fitting offensive stat', () => {
    const physical = makeBattle(fighter('player', 'porygon', 'Download'), fighter('enemy', 'geodude', 'Sturdy'));
    expect(activeFighter(physical, 'player').boosts.atk).toBe(1);

    const special = makeBattle(fighter('player', 'porygon', 'Download'), fighter('enemy', 'gastly', 'Levitate'));
    expect(activeFighter(special, 'player').boosts.spa).toBe(1);
  });
});

describe('priority abilities (batch 4)', () => {
  it('Prankster adds priority to status moves only', () => {
    const state = makeBattle(fighter('player', 'murkrow', 'Prankster'), fighter('enemy', 'charmander', 'Blaze'));
    expect(runModifyPriority(moveCtxOf(state, 'player', 'taunt'), getMove('taunt')!, 0)).toBe(1);
    expect(runModifyPriority(moveCtxOf(state, 'player', 'tackle'), getMove('tackle')!, 0)).toBe(0);
  });

  it('Gale Wings adds priority to Flying moves at full HP', () => {
    const state = makeBattle(fighter('player', 'fletchling', 'Gale Wings'), fighter('enemy', 'charmander', 'Blaze'));
    expect(runModifyPriority(moveCtxOf(state, 'player', 'gust'), getMove('gust')!, 0)).toBe(1);
    expect(runModifyPriority(moveCtxOf(state, 'player', 'tackle'), getMove('tackle')!, 0)).toBe(0);

    activeFighter(state, 'player').hp -= 1;
    expect(runModifyPriority(moveCtxOf(state, 'player', 'gust'), getMove('gust')!, 0)).toBe(0);
  });
});

describe('reaction abilities (batch 4)', () => {
  it('Rattled raises Speed when hit by Bug, Dark or Ghost, and on Intimidate', () => {
    const state = makeBattle(fighter('player', 'charmander', 'Blaze'), fighter('enemy', 'magikarp', 'Rattled'));
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
      player: [createFighter({ id: 'p', speciesId: 'charmander', level: 20, ability: 'Blaze', heldItem: 'charcoal' })],
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
    const state = makeBattle(fighter('player', 'charmander', 'Blaze'), fighter('enemy', 'gible', 'Rough Skin'));
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
      const state = makeBattle(fighter('player', 'charmander', 'Blaze'), fighter('enemy', species, ability));
      expect(runModifyCrit(ctxOf(state, 'player'), getMove('tackle')!, true)).toBe(false);
      expect(runModifyCrit(ctxOf(state, 'player'), getMove('tackle')!, false)).toBe(false);
    }
  });

  it('Anger Point maxes Attack when hit by a critical hit', () => {
    const state = makeBattle(fighter('player', 'charmander', 'Blaze'), fighter('enemy', 'mankey', 'Anger Point'));
    const mankey = activeFighter(state, 'enemy');
    runModifyCrit(ctxOf(state, 'player'), getMove('tackle')!, true);
    expect(mankey.boosts.atk).toBe(6);
  });

  it('Skill Link forces the maximum number of hits', () => {
    const state = makeBattle(fighter('player', 'shellder', 'Skill Link'), fighter('enemy', 'charmander', 'Blaze'));
    expect(runModifyMultihit(moveCtxOf(state, 'player', 'bulletseed'), getMove('bulletseed')!, 2)).toBe(5);
    expect(runModifyMultihit(moveCtxOf(state, 'player', 'tackle'), getMove('tackle')!, 1)).toBe(1);
  });

  it('Infiltrator bypasses the foe substitute', () => {
    const state = makeBattle(fighter('player', 'hoppip', 'Infiltrator'), fighter('enemy', 'charmander', 'Blaze'));
    expect(runTrySubstitute(ctxOf(state, 'player'), getMove('tackle')!)).toBe(true);

    const normal = makeBattle(fighter('player', 'charmander', 'Blaze'), fighter('enemy', 'charmander', 'Blaze'));
    expect(runTrySubstitute(ctxOf(normal, 'player'), getMove('tackle')!)).toBe(false);
  });
});

describe('move-blocking and stat abilities (batch 4)', () => {
  it('Damp, Bulletproof and Soundproof block their moves', () => {
    const damp = makeBattle(fighter('player', 'charmander', 'Blaze'), fighter('enemy', 'psyduck', 'Damp'));
    expect(runTryHit(ctxOf(damp, 'player'), getMove('selfdestruct')!)).toBe(false);
    expect(runTryHit(ctxOf(damp, 'player'), getMove('tackle')!)).toBe(true);

    const bullet = makeBattle(fighter('player', 'charmander', 'Blaze'), fighter('enemy', 'chespin', 'Bulletproof'));
    expect(runTryHit(ctxOf(bullet, 'player'), getMove('shadowball')!)).toBe(false);
    expect(runTryHit(ctxOf(bullet, 'player'), getMove('ember')!)).toBe(true);

    const sound = makeBattle(fighter('player', 'charmander', 'Blaze'), fighter('enemy', 'voltorb', 'Soundproof'));
    expect(runTryHit(ctxOf(sound, 'player'), getMove('boomburst')!)).toBe(false);
    expect(runTryHit(ctxOf(sound, 'player'), getMove('ember')!)).toBe(true);
  });

  it('Defiant and Competitive boost after a foe-inflicted drop', () => {
    const defiant = makeBattle(fighter('player', 'charmander', 'Blaze'), fighter('enemy', 'mankey', 'Defiant'));
    const mankey = activeFighter(defiant, 'enemy');
    applyBoostEffect(defiant, 'enemy', mankey, { atk: -1 });
    expect(mankey.boosts.atk).toBe(1);

    const competitive = makeBattle(fighter('player', 'charmander', 'Blaze'), fighter('enemy', 'jigglypuff', 'Competitive'));
    const jigglypuff = activeFighter(competitive, 'enemy');
    applyBoostEffect(competitive, 'enemy', jigglypuff, { spa: -1 });
    expect(jigglypuff.boosts.spa).toBe(1);
  });

  it('Grass Pelt halves the physical damage taken on grassy terrain', () => {
    const state = makeBattle(fighter('player', 'charmander', 'Blaze'), fighter('enemy', 'skiddo', 'Grass Pelt'));
    const ctx = ctxOf(state, 'player');
    expect(runModifyDamage(ctx, getMove('tackle')!, 90)).toBe(90);
    state.terrain = 'grassy';
    expect(runModifyDamage(ctx, getMove('tackle')!, 90)).toBe(60);
    expect(runModifyDamage(ctx, getMove('ember')!, 90)).toBe(90);
  });

  it('Sweet Veil blocks sleep', () => {
    const state = makeBattle(fighter('player', 'bounsweet', 'Sweet Veil'), fighter('enemy', 'charmander', 'Blaze'));
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
    const state = makeBattle(fighter('player', 'grimer', 'Poison Touch'), fighter('enemy', 'charmander', 'Blaze'), 31);
    for (let i = 0; i < 100 && activeFighter(state, 'enemy').status === null; i++) {
      runAfterMove(ctxOf(state, 'player'), getMove('tackle')!);
    }
    expect(activeFighter(state, 'enemy').status).toBe('psn');
  });

  it('Gooey lowers the contact attacker Speed', () => {
    const state = makeBattle(fighter('player', 'charmander', 'Blaze'), fighter('enemy', 'goomy', 'Gooey'));
    runAfterMove(ctxOf(state, 'player'), getMove('tackle')!);
    expect(activeFighter(state, 'player').boosts.spe).toBe(-1);
  });

  it('Justified raises Attack when hit by a Dark move', () => {
    const state = makeBattle(fighter('player', 'charmander', 'Blaze'), fighter('enemy', 'growlithe', 'Justified'));
    runAfterMove(ctxOf(state, 'player'), getMove('bite')!);
    expect(activeFighter(state, 'enemy').boosts.atk).toBe(1);
  });

  it('Marvel Scale softens physical hits while statused', () => {
    const state = makeBattle(fighter('player', 'charmander', 'Blaze'), fighter('enemy', 'dratini', 'Marvel Scale'));
    const ctx = ctxOf(state, 'player');
    expect(runModifyDamage(ctx, getMove('tackle')!, 90)).toBe(90);
    activeFighter(state, 'enemy').status = 'brn';
    expect(runModifyDamage(ctx, getMove('tackle')!, 90)).toBe(60);
    expect(runModifyDamage(ctx, getMove('ember')!, 90)).toBe(90);
  });

  it('Sand Force boosts Rock, Ground and Steel moves in a sandstorm', () => {
    const state = makeBattle(fighter('player', 'diglett', 'Sand Force'), fighter('enemy', 'charmander', 'Blaze'));
    const ctx = ctxOf(state, 'player');
    expect(runModifyDamage(ctx, getMove('bulldoze')!, 100)).toBe(100);
    state.weather = 'sand';
    expect(runModifyDamage(ctx, getMove('bulldoze')!, 100)).toBe(130);
    expect(runModifyDamage(ctx, getMove('ember')!, 100)).toBe(100);
  });

  it('Earth Eater absorbs Ground and heals', () => {
    const state = makeBattle(fighter('player', 'charmander', 'Blaze'), fighter('enemy', 'orthworm', 'Earth Eater'));
    const orthworm = activeFighter(state, 'enemy');
    orthworm.hp = Math.floor(orthworm.maxHp / 2);
    const ctx = ctxOf(state, 'player');
    expect(runTryHit(ctx, getMove('bulldoze')!)).toBe(false);
    expect(orthworm.hp).toBe(Math.floor(orthworm.maxHp / 2) + Math.floor(orthworm.maxHp / 4));
    expect(runTryHit(ctx, getMove('ember')!)).toBe(true);
  });

  it('Thermal Exchange absorbs Fire, raises Attack and blocks burns', () => {
    const state = makeBattle(fighter('player', 'charmander', 'Blaze'), fighter('enemy', 'frigibax', 'Thermal Exchange'));
    const frigibax = activeFighter(state, 'enemy');
    expect(runTryHit(ctxOf(state, 'player'), getMove('ember')!)).toBe(false);
    expect(frigibax.boosts.atk).toBe(1);
    applyStatusEffect(state, 'enemy', frigibax, 'brn');
    expect(frigibax.status).toBeNull();
  });
});

describe('stat and reaction abilities (batch 5)', () => {
  it('Simple doubles and Contrary inverts stat changes', () => {
    const simple = makeBattle(fighter('player', 'numel', 'Simple'), fighter('enemy', 'charmander', 'Blaze'));
    const numel = activeFighter(simple, 'player');
    applyBoostEffect(simple, 'player', numel, { atk: 1 });
    expect(numel.boosts.atk).toBe(2);

    const contrary = makeBattle(fighter('player', 'snivy', 'Contrary'), fighter('enemy', 'charmander', 'Blaze'));
    const snivy = activeFighter(contrary, 'player');
    applyBoostEffect(contrary, 'player', snivy, { atk: -1 });
    expect(snivy.boosts.atk).toBe(1);
    applyBoostEffect(contrary, 'player', snivy, { spa: 1 }, { self: true });
    expect(snivy.boosts.spa).toBe(-1);
  });

  it('Synchronize passes burn, paralysis and poison back', () => {
    const state = makeBattle(fighter('player', 'espeon', 'Synchronize'), fighter('enemy', 'bulbasaur', 'Overgrow'));
    applyStatusEffect(state, 'player', activeFighter(state, 'player'), 'brn');
    expect(activeFighter(state, 'player').status).toBe('brn');
    expect(activeFighter(state, 'enemy').status).toBe('brn');
  });

  it('Steadfast raises Speed when it flinches', () => {
    const state = makeBattle(fighter('player', 'scyther', 'Steadfast'), fighter('enemy', 'charmander', 'Blaze'));
    expect(runTryVolatile(ctxOf(state, 'player'), 'flinch')).toBe(true);
    expect(activeFighter(state, 'player').boosts.spe).toBe(1);
  });

  it('Rock Head removes recoil damage', () => {
    const state = makeBattle(fighter('player', 'geodude', 'Rock Head'), fighter('enemy', 'charmander', 'Blaze'));
    expect(runModifyRecoil(ctxOf(state, 'player'), getMove('doubleedge')!, 30)).toBe(0);
  });

  it('Moody raises one stat and lowers another each turn', () => {
    const state = makeBattle(fighter('player', 'smeargle', 'Moody'), fighter('enemy', 'charmander', 'Blaze'), 41);
    runResidual(ctxOf(state, 'player'));
    const boosts = activeFighter(state, 'player').boosts;
    const raised = (['atk', 'def', 'spa', 'spd', 'spe'] as const).filter((stat) => boosts[stat] === 2);
    const lowered = (['atk', 'def', 'spa', 'spd', 'spe'] as const).filter((stat) => boosts[stat] === -1);
    expect(raised).toHaveLength(1);
    expect(lowered).toHaveLength(1);
  });

  it('Disguise absorbs the first damaging hit only', () => {
    const state = makeBattle(fighter('player', 'charmander', 'Blaze'), fighter('enemy', 'mimikyu', 'Disguise'));
    const ctx = ctxOf(state, 'player');
    expect(runTryHit(ctx, getMove('tackle')!)).toBe(false);
    expect(runTryHit(ctx, getMove('tackle')!)).toBe(true);
  });

  it('Overcoat blocks powder moves', () => {
    const state = makeBattle(fighter('player', 'charmander', 'Blaze'), fighter('enemy', 'pineco', 'Overcoat'));
    const ctx = ctxOf(state, 'player');
    expect(runTryHit(ctx, getMove('spore')!)).toBe(false);
    expect(runTryHit(ctx, getMove('tackle')!)).toBe(true);
  });

  it('Run Away guarantees a wild escape', () => {
    const state = makeBattle(fighter('player', 'oddish', 'Run Away'), fighter('enemy', 'charmander', 'Blaze'));
    expect(runTryEscape(ctxOf(state, 'player'))).toBe(true);
    expect(rollRun(state, 'player')).toBe(true);
  });

  it('Analytic and Stakeout boost against a foe that moved or switched', () => {
    const state = makeBattle(fighter('player', 'magnemite', 'Analytic'), fighter('enemy', 'tarountula', 'Stakeout'));
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
