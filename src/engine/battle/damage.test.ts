import { describe, expect, it } from 'vitest';
import { effectiveness, getMove, type Move } from '../../data/dex';
import { Rng } from '../rng';
import {
  DAMAGE_RESOLVERS,
  computeDamage,
  estimateDamage,
  fixedDamage,
  isFixedDamageMove,
  resolveBasePower,
  resolvesToDamage,
  teamTypeDamageMultiplier,
  type DamageContext,
} from './damage';
import { createFighter, type BattleFighter } from './fighter';

const fighter = (speciesId: string, level = 20): BattleFighter =>
  createFighter({ id: speciesId, speciesId, level, nature: 'serious' });

const move = (id: string): Move => getMove(id)!;

const hit = (
  attacker: BattleFighter,
  defender: BattleFighter,
  moveId: string,
  seed = 1,
  critical = false,
) => computeDamage(attacker, defender, move(moveId), new Rng(seed), { critical });

const special = (speciesId: string, level = 50): BattleFighter => fighter(speciesId, level);

const power = (
  attacker: BattleFighter,
  defender: BattleFighter,
  moveId: string,
  context: DamageContext = {},
): number => resolveBasePower(attacker, defender, move(moveId), context);

describe('computeDamage', () => {
  it('deals nothing when the type is immune', () => {
    const result = hit(fighter('pikachu'), fighter('geodude'), 'thundershock');
    expect(result.effectiveness).toBe(0);
    expect(result.damage).toBe(0);
  });

  it('adds STAB on a matching attacker type', () => {
    const attacker = fighter('charmander');
    const defender = fighter('sentret');
    expect(hit(attacker, defender, 'ember').damage).toBeGreaterThan(
      hit(attacker, defender, 'watergun').damage,
    );
    expect(hit(attacker, defender, 'ember').stab).toBe(true);
    expect(hit(attacker, defender, 'watergun').stab).toBe(false);
  });

  it('scales with type effectiveness', () => {
    const attacker = fighter('charmander');
    const neutral = fighter('sentret');
    const weak = fighter('squirtle');
    const vsNeutral = hit(attacker, neutral, 'vinewhip', 5);
    const vsWeak = hit(attacker, weak, 'vinewhip', 5);
    expect(vsWeak.effectiveness).toBeGreaterThan(1);
    expect(vsWeak.damage).toBeGreaterThan(vsNeutral.damage);
  });

  it('hits harder on a critical hit', () => {
    const attacker = fighter('charmander');
    const defender = fighter('sentret');
    expect(hit(attacker, defender, 'ember', 9, true).damage).toBeGreaterThan(
      hit(attacker, defender, 'ember', 9, false).damage,
    );
  });

  it('never drops below 1 on a connecting hit', () => {
    const attacker = fighter('sentret', 1);
    const defender = fighter('magnemite', 50);
    expect(hit(attacker, defender, 'tackle').damage).toBeGreaterThanOrEqual(1);
  });
});

describe('estimateDamage', () => {
  it('is deterministic and never rolls', () => {
    const attacker = fighter('charmander');
    const defender = fighter('sentret');
    const first = estimateDamage(attacker, defender, move('ember'));
    const second = estimateDamage(attacker, defender, move('ember'));
    expect(first).toEqual(second);
    expect(first.crit).toBe(false);
  });
});

describe('the room’s whole-field damage rules', () => {
  // Seed 24's first draw (0.332) is no crit and its 85-100 roll is exactly 100,
  // so the control hit is the raw base damage and the ×1.33 term is exact.
  const AURA_SEED = 24;

  const hitWith = (
    attacker: BattleFighter,
    defender: BattleFighter,
    moveId: string,
    context: Parameters<typeof computeDamage>[4] = {},
  ) => computeDamage(attacker, defender, move(moveId), new Rng(AURA_SEED), context);

  it('boosts a Dark move by the ×1.33 floor under Dark Aura only', () => {
    const attacker = fighter('charmander');
    const defender = fighter('sentret');
    const control = hitWith(attacker, defender, 'bite');
    const dark = hitWith(attacker, defender, 'bite', { darkAura: true });

    expect(control.crit).toBe(false);
    expect(control.stab).toBe(false);
    expect(control.effectiveness).toBe(1);
    expect(dark.damage).toBe(Math.floor(control.damage * 1.33));
    expect(hitWith(attacker, defender, 'bite', { fairyAura: true }).damage).toBe(control.damage);
  });

  it('boosts a Fairy move by the ×1.33 floor under Fairy Aura only', () => {
    const attacker = fighter('charmander');
    const defender = fighter('sentret');
    const control = hitWith(attacker, defender, 'moonblast');
    const fairy = hitWith(attacker, defender, 'moonblast', { fairyAura: true });

    expect(control.crit).toBe(false);
    expect(control.stab).toBe(false);
    expect(control.effectiveness).toBe(1);
    expect(fairy.damage).toBe(Math.floor(control.damage * 1.33));
    expect(hitWith(attacker, defender, 'moonblast', { darkAura: true }).damage).toBe(control.damage);
  });
});

describe('the room’s all-types change', () => {
  it('gives a Normal-type attacker STAB on a Fire move', () => {
    const attacker = fighter('sentret');
    const defender = fighter('bulbasaur');
    const plain = hit(attacker, defender, 'ember', 3);
    const overridden = computeDamage(attacker, defender, move('ember'), new Rng(3), {
      critical: false,
      overrideType: 'Fire',
    });

    expect(plain.stab).toBe(false);
    expect(overridden.stab).toBe(true);
  });

  it('reads both fighters as the one type for the chart', () => {
    const attacker = fighter('sentret');
    const defender = fighter('bulbasaur');
    const plain = hit(attacker, defender, 'ember', 3);
    const overridden = computeDamage(attacker, defender, move('ember'), new Rng(3), {
      critical: false,
      overrideType: 'Fire',
    });

    expect(plain.effectiveness).toBe(2);
    expect(overridden.effectiveness).toBe(effectiveness('Fire', ['Fire']));
    expect(overridden.effectiveness).toBe(0.5);
  });

  it('lets a caller pass the chart read against the overridden types', () => {
    const attacker = fighter('charmander');
    const defender = fighter('bulbasaur');
    const result = computeDamage(attacker, defender, move('ember'), new Rng(3), {
      critical: false,
      overrideType: 'Fire',
      effectiveness: effectiveness('Fire', ['Fire']),
    });
    expect(result.stab).toBe(true);
    expect(result.effectiveness).toBe(0.5);
  });
});

describe('the four team-type damage bonuses', () => {
  const ember = (teamTypes?: readonly string[]) =>
    computeDamage(fighter('charmander', 30), fighter('sentret', 20), move('ember'), new Rng(24), {
      critical: false,
      ...(teamTypes ? { teamTypes } : {}),
    });

  it('gives a listed type ×1.1 and every other type nothing', () => {
    expect(teamTypeDamageMultiplier('Fire', ['Fire'])).toBe(1.1);
    expect(teamTypeDamageMultiplier('Fire', [])).toBe(1);
    expect(teamTypeDamageMultiplier('Fire', ['Ice'])).toBe(1);
  });

  it('floors the ×1.1 number once, right after STAB', () => {
    // Seed 24's only hit draw is the 85-100 roll and it comes out at exactly 100,
    // so the plain number is the STAB figure and the ×1.1 term is the only change.
    const plain = ember();
    const boosted = ember(['Fire']);
    expect(plain).toMatchObject({ crit: false, stab: true, effectiveness: 1 });
    expect(plain.damage).toBe(27);
    expect(boosted.damage).toBe(29);
    expect(boosted.damage).toBe(Math.floor(27 * 1.1));
    expect(ember(['Ice']).damage).toBe(27);
    expect(ember([]).damage).toBe(27);
  });

  it('applies the same multiplier on the AI’s deterministic estimate', () => {
    const attacker = fighter('charmander', 30);
    const defender = fighter('sentret', 20);
    expect(estimateDamage(attacker, defender, move('ember')).damage).toBe(31);
    expect(estimateDamage(attacker, defender, move('ember'), { teamTypes: ['Fire'] }).damage).toBe(34);
  });
});

describe('the relative-damage predicates', () => {
  it('never calls a status move damaging, nor fixed', () => {
    for (const id of ['growl', 'splash', 'painsplit']) {
      expect(resolvesToDamage(move(id)), id).toBe(false);
      expect(isFixedDamageMove(move(id)), id).toBe(false);
    }
  });

  it('tells a fixed amount from a resolved power and from plain damage', () => {
    expect(resolvesToDamage(move('seismictoss'))).toBe(true);
    expect(isFixedDamageMove(move('seismictoss'))).toBe(true);
    expect(resolvesToDamage(move('beatup'))).toBe(true);
    expect(isFixedDamageMove(move('beatup'))).toBe(false);
    expect(resolvesToDamage(move('tackle'))).toBe(true);
    expect(isFixedDamageMove(move('tackle'))).toBe(false);
  });
});

describe('resolveBasePower — the resolved powers', () => {
  const user = special('ditto');
  const foe = special('ditto');

  it('reads the target’s remaining HP (Crush Grip, Wring Out, Hard Press)', () => {
    expect(power(user, foe, 'crushgrip')).toBe(120);
    expect(power(user, foe, 'wringout')).toBe(120);
    expect(power(user, foe, 'hardpress')).toBe(100);
    const hurt = special('ditto');
    hurt.hp = 61;
    expect(power(user, hurt, 'crushgrip')).toBe(59);
    expect(power(user, hurt, 'wringout')).toBe(59);
    expect(power(user, hurt, 'hardpress')).toBe(49);
  });

  it('scales Flail and Reversal with the user’s lost HP', () => {
    expect(power(user, foe, 'flail')).toBe(20);
    expect(power(user, foe, 'reversal')).toBe(20);
    const hurt = special('ditto');
    hurt.hp = 49;
    expect(power(hurt, foe, 'reversal')).toBe(80);
    const spent = special('ditto');
    spent.hp = 1;
    expect(power(spent, foe, 'flail')).toBe(150);
  });

  it('reads Speed for Electro Ball and Gyro Ball', () => {
    expect(power(user, foe, 'electroball')).toBe(40);
    expect(power(user, foe, 'gyroball')).toBe(26);
    const fast = special('ditto');
    fast.boosts.spe = 2;
    expect(power(fast, foe, 'electroball')).toBe(80);
    fast.boosts.spe = 6;
    expect(power(fast, foe, 'electroball')).toBe(150);
    const slow = special('ditto');
    slow.boosts.spe = -6;
    expect(power(slow, foe, 'gyroball')).toBe(101);
  });

  it('reads the weights (Low Kick, Grass Knot, Heat Crash, Heavy Slam)', () => {
    expect(power(user, special('onix'), 'lowkick')).toBe(120);
    expect(power(user, special('aron'), 'lowkick')).toBe(80);
    expect(power(user, special('blissey'), 'grassknot')).toBe(60);
    expect(power(user, special('gastly'), 'lowkick')).toBe(20);
    expect(power(special('snorlax'), special('togepi'), 'heatcrash')).toBe(120);
    expect(power(special('snorlax'), special('onix'), 'heavyslam')).toBe(60);
    expect(power(special('gastly'), special('aggron'), 'heatcrash')).toBe(40);
  });

  it('gives Return and Frustration the reference’s maximum, 102', () => {
    expect(power(user, foe, 'return')).toBe(102);
    expect(power(user, foe, 'frustration')).toBe(102);
  });

  it('reads Beat Up’s base Attack off the user’s species', () => {
    expect(power(user, foe, 'beatup')).toBe(14);
  });

  it('gives Present its dex power when the loop has not rolled one', () => {
    expect(power(user, foe, 'present')).toBe(40);
    expect(power(user, foe, 'present', {})).toBe(40);
    expect(resolveBasePower(user, foe, { ...move('present'), basePower: 80 })).toBe(80);
  });

  it('turns stockpile charges into Spit Up’s power', () => {
    expect(power(user, foe, 'spitup')).toBe(0);
    user.volatiles.stockpile = 1;
    expect(power(user, foe, 'spitup')).toBe(100);
    user.volatiles.stockpile = 3;
    expect(power(user, foe, 'spitup')).toBe(300);
    user.volatiles.stockpile = 0;
  });

  it('leaves every straight-damage move on its dex number', () => {
    expect(power(user, foe, 'tackle')).toBe(40);
    expect(power(user, foe, 'thunderbolt')).toBe(90);
  });

  it('adds 50 to Rage Fist for every hit its user has taken, up to six', () => {
    const taker = special('ditto');
    expect(power(taker, foe, 'ragefist')).toBe(50);
    const steps: readonly (readonly [number, number])[] = [
      [1, 100],
      [2, 150],
      [3, 200],
      [6, 350],
      [9, 350],
    ];
    for (const [hits, value] of steps) {
      taker.volatiles.timesHit = hits;
      expect(power(taker, foe, 'ragefist'), `${hits} hits`).toBe(value);
    }
  });

  it('owns Rage Fist’s amount in the engine table, not the dex number', () => {
    expect(DAMAGE_RESOLVERS.ragefist).toBe('power');
  });
});

describe('resolveBasePower — the multiplicative exceptions', () => {
  const user = special('ditto');
  const foe = special('ditto');

  it('scales Eruption and friends with the user’s HP', () => {
    const half = special('ditto');
    half.maxHp = 100;
    half.hp = 50;
    expect(power(half, foe, 'eruption')).toBe(75);
    expect(power(half, foe, 'waterspout')).toBe(75);
    expect(power(half, foe, 'dragonenergy')).toBe(75);
    expect(power(user, foe, 'eruption')).toBe(150);
  });

  it('counts the user’s positive stages for Stored Power and Power Trip', () => {
    const boosted = special('ditto');
    boosted.boosts.atk = 2;
    boosted.boosts.spa = 1;
    boosted.boosts.def = -1;
    expect(power(boosted, foe, 'storedpower')).toBe(80);
    expect(power(boosted, foe, 'powertrip')).toBe(80);
    expect(power(user, foe, 'storedpower')).toBe(20);
  });

  it('counts the party’s fainted for Last Respects', () => {
    const fallen = special('ditto');
    fallen.hp = 0;
    const alive = special('ditto');
    expect(power(user, foe, 'lastrespects')).toBe(50);
    expect(power(user, foe, 'lastrespects', { party: [user, fallen, fallen] })).toBe(150);
    expect(power(user, foe, 'lastrespects', { party: [user, alive] })).toBe(50);
  });

  it('reads the target’s status for Hex, Venoshock and Brine', () => {
    expect(power(user, foe, 'hex')).toBe(65);
    expect(power(user, foe, 'venoshock')).toBe(65);
    const poisoned = special('ditto');
    poisoned.status = 'psn';
    expect(power(user, poisoned, 'hex')).toBe(130);
    expect(power(user, poisoned, 'venoshock')).toBe(130);
    poisoned.status = 'tox';
    expect(power(user, poisoned, 'venoshock')).toBe(130);
    poisoned.status = 'brn';
    expect(power(user, poisoned, 'venoshock')).toBe(65);
    expect(power(user, foe, 'brine')).toBe(65);
    const hurt = special('ditto');
    hurt.hp = 61;
    expect(power(user, hurt, 'brine')).toBe(130);
  });

  it('doubles Facade while its user carries a status', () => {
    expect(power(user, foe, 'facade')).toBe(70);
    const burned = special('ditto');
    burned.status = 'brn';
    expect(power(burned, foe, 'facade')).toBe(140);
  });

  it('reads the turn’s order and damage for Payback, Avalanche and the biting heads', () => {
    expect(power(user, foe, 'payback')).toBe(50);
    expect(power(user, foe, 'payback', { targetMovedFirst: true })).toBe(100);
    expect(power(user, foe, 'avalanche')).toBe(60);
    expect(power(user, foe, 'avalanche', { userDamagedThisTurn: true })).toBe(120);
    expect(power(user, foe, 'revenge', { userDamagedThisTurn: true })).toBe(120);
    expect(power(user, foe, 'boltbeak')).toBe(170);
    expect(power(user, foe, 'boltbeak', { targetMovedFirst: true })).toBe(85);
    expect(power(user, foe, 'fishiousrend')).toBe(170);
    expect(power(user, foe, 'fishiousrend', { targetMovedFirst: true })).toBe(85);
  });

  it('reads the terrain for Expanding Force, Rising Voltage, Grassy Glide and Psyblade', () => {
    expect(power(user, foe, 'expandingforce')).toBe(80);
    expect(power(user, foe, 'expandingforce', { terrain: 'psychic' })).toBe(120);
    expect(power(user, foe, 'risingvoltage')).toBe(70);
    expect(power(user, foe, 'risingvoltage', { terrain: 'electric' })).toBe(140);
    expect(power(user, special('pidgey'), 'risingvoltage', { terrain: 'electric' })).toBe(70);
    expect(power(user, foe, 'grassyglide')).toBe(55);
    expect(power(user, foe, 'grassyglide', { terrain: 'grassy' })).toBe(70);
    expect(power(user, foe, 'psyblade')).toBe(80);
    expect(power(user, foe, 'psyblade', { terrain: 'electric' })).toBe(120);
  });
});

describe('the two stat swaps', () => {
  it('Body Press reads the user’s Defense and its stage', () => {
    const user = special('ditto');
    const foe = special('ditto');
    expect(estimateDamage(user, foe, move('bodypress')).damage).toBe(74);
    user.boosts.def = 2;
    expect(estimateDamage(user, foe, move('bodypress')).damage).toBe(144);
    user.boosts.def = 0;
    expect(computeDamage(user, foe, move('bodypress'), new Rng(5), { critical: false }).damage).toBe(70);
  });

  it('Foul Play reads the target’s Attack through the target’s stages', () => {
    const user = special('gastly');
    const foe = special('snorlax');
    expect(estimateDamage(user, foe, move('foulplay')).damage).toBe(65);
    foe.boosts.atk = 2;
    expect(estimateDamage(user, foe, move('foulplay')).damage).toBe(129);
    user.boosts.atk = 6;
    expect(estimateDamage(user, foe, move('foulplay')).damage).toBe(129);
    expect(
      computeDamage(special('gastly'), special('snorlax'), move('foulplay'), new Rng(5), {
        critical: false,
      }).damage,
    ).toBe(62);
  });
});

describe('fixedDamage — the fixed amounts', () => {
  const user = special('ditto');
  const foe = special('ditto');

  it('pins the level and the two printed numbers', () => {
    expect(fixedDamage(user, foe, move('seismictoss'), null)).toBe(50);
    expect(fixedDamage(user, foe, move('nightshade'), null)).toBe(50);
    expect(fixedDamage(user, foe, move('dragonrage'), null)).toBe(40);
    expect(fixedDamage(user, foe, move('sonicboom'), null)).toBe(20);
  });

  it('halves the target’s remaining HP, never below one', () => {
    for (const id of ['superfang', 'naturesmadness', 'ruination']) {
      expect(fixedDamage(user, foe, move(id), null), id).toBe(61);
      const nearlyOut = special('ditto');
      nearlyOut.hp = 1;
      expect(fixedDamage(user, nearlyOut, move(id), null), id).toBe(1);
    }
  });

  it('leaves Endeavor at the HP gap and zero when the user is not behind', () => {
    const low = special('ditto');
    low.hp = 40;
    const foeHp = special('ditto');
    foeHp.hp = 100;
    expect(fixedDamage(low, foeHp, move('endeavor'), null)).toBe(60);
    expect(fixedDamage(low, low, move('endeavor'), null)).toBe(0);
    const ahead = special('ditto');
    ahead.hp = 100;
    expect(fixedDamage(ahead, low, move('endeavor'), null)).toBe(0);
  });

  it('gives Final Gambit the user’s whole HP', () => {
    const gambler = special('ditto');
    gambler.hp = 87;
    expect(fixedDamage(gambler, foe, move('finalgambit'), null)).toBe(87);
  });

  it('rolls Psywave once and estimates it at the level', () => {
    expect(fixedDamage(user, foe, move('psywave'), null)).toBe(50);
    expect(fixedDamage(user, foe, move('psywave'), new Rng(7))).toBe(25);
    expect(fixedDamage(user, foe, move('psywave'), new Rng(1))).toBeGreaterThan(0);
  });

  it('fails the OHKO moves against a higher level without drawing', () => {
    const veteran = special('ditto', 60);
    const stream = new Rng(3);
    for (const id of ['fissure', 'guillotine', 'horndrill', 'sheercold']) {
      expect(fixedDamage(user, veteran, move(id), stream), id).toBe(0);
    }
    expect(stream.next()).toBe(new Rng(3).next());
    for (const id of ['fissure', 'guillotine', 'horndrill', 'sheercold']) {
      expect(fixedDamage(user, foe, move(id), null), id).toBe(123);
    }
  });

  it('refuses Sheer Cold on an Ice-type target, rolled or not', () => {
    const ice = special('lapras');
    expect(fixedDamage(user, ice, move('sheercold'), null)).toBe(0);
    expect(fixedDamage(user, ice, move('sheercold'), new Rng(1))).toBe(0);
  });

  it('returns null for a formula move and for a status move', () => {
    expect(fixedDamage(user, foe, move('tackle'), null)).toBeNull();
    expect(fixedDamage(user, foe, move('growl'), null)).toBeNull();
  });
});

describe('a fixed amount takes no roll', () => {
  const advance = (moveId: string, seed: number): number => {
    const stream = new Rng(seed);
    computeDamage(special('ditto'), special('ditto'), move(moveId), stream);
    return stream.next();
  };

  it('leaves the stream where it was for a non-drawing fixed move', () => {
    for (const id of ['dragonrage', 'superfang', 'endeavor', 'seismictoss', 'finalgambit']) {
      expect(advance(id, 11), id).toBe(new Rng(11).next());
    }
  });

  it('consumes exactly one draw for Psywave', () => {
    const fresh = new Rng(11);
    fresh.next();
    expect(advance('psywave', 11)).toBe(fresh.next());
  });

  it('reports a fixed hit as neutral, uncritical and never STAB', () => {
    const result = computeDamage(special('ditto'), special('ditto'), move('seismictoss'), new Rng(5));
    expect(result).toEqual({ damage: 50, effectiveness: 1, crit: false, stab: false });
  });
});
