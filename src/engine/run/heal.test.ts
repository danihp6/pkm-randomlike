import { describe, expect, it } from 'vitest';
import { restoreFighter } from '../battle/fighter';
import { createRunPokemon, type RunPokemon } from './progression';
import {
  autoPokevial,
  chargePokevial,
  fillPokevial,
  fullHealMember,
  healParty,
  needsHealing,
  pokevialReady,
  serviceHeal,
  POKEVIAL_MAX_CHARGES,
} from './heal';
import { addPokemon, createRun, type RunState } from './state';

const starter = createRunPokemon({
  id: 'starter',
  speciesId: 'charmander',
  level: 5,
  moves: ['scratch', 'ember'],
});
const starterMaxHp = restoreFighter(starter.fighter).maxHp;

function damaged(pokemon: RunPokemon, hp: number, pp: number): RunPokemon {
  return {
    ...pokemon,
    fighter: {
      ...pokemon.fighter,
      hp,
      moves: pokemon.fighter.moves.map((slot) => ({ ...slot, pp })),
    },
  };
}

/** Full HP and PP, with one PP point spent on the first move. */
function sapped(pokemon: RunPokemon): RunPokemon {
  return {
    ...pokemon,
    fighter: {
      ...pokemon.fighter,
      moves: pokemon.fighter.moves.map((slot, index) =>
        index === 0 ? { ...slot, pp: slot.pp - 1 } : slot,
      ),
    },
  };
}

function boxed(tag: string, status: 'brn' | 'par' | null = null): RunPokemon {
  const base = createRunPokemon({ id: tag, speciesId: 'sentret', level: 4 });
  return status ? { ...base, fighter: { ...base.fighter, status } } : base;
}

function dead(pokemon: RunPokemon): RunPokemon {
  return { ...pokemon, fighter: { ...pokemon.fighter, hp: 0 } };
}

describe('healParty', () => {
  it('restores HP and PP but keeps status', () => {
    const hurt = damaged({ ...starter, fighter: { ...starter.fighter, status: 'psn' as const } }, 3, 1);
    const run = createRun({ seed: 's', starter: hurt });
    const healed = healParty(run).party[0].fighter;
    expect(healed.hp).toBe(starterMaxHp);
    expect(healed.moves.every((slot) => slot.pp === slot.maxPp)).toBe(true);
    expect(healed.status).toBe('psn');
  });

  it('does not resurrect a fainted member (D5)', () => {
    const run = createRun({ seed: 's', starter: damaged(starter, 0, 1) });
    expect(healParty(run).party[0].fighter.hp).toBe(0);
  });

  it('heals the box too', () => {
    const hurtBox = damaged(createRunPokemon({ id: 'boxed', speciesId: 'sentret', level: 4 }), 2, 0);
    const full: RunState = { ...createRun({ seed: 's', starter }), party: Array(6).fill(starter) };
    const healed = healParty(addPokemon(full, hurtBox));
    expect(healed.box[0].fighter.hp).toBeGreaterThan(2);
    expect(healed.box[0].fighter.moves.every((slot) => slot.pp === slot.maxPp)).toBe(true);
  });
});

describe('needsHealing', () => {
  it('is false for a whole squad', () => {
    expect(needsHealing(createRun({ seed: 's', starter }))).toBe(false);
  });

  it('reads a short bar, a short PP and a primary status', () => {
    const hurt = damaged(starter, 3, 1);
    expect(needsHealing(createRun({ seed: 's', starter: hurt }))).toBe(true);
    expect(needsHealing(createRun({ seed: 's', starter: sapped(starter) }))).toBe(true);
    const sick = { ...starter, fighter: { ...starter.fighter, status: 'par' as const } };
    expect(needsHealing(createRun({ seed: 's', starter: sick }))).toBe(true);
  });

  it('reads the box too, and a member with no moves is not missing PP', () => {
    const run = createRun({ seed: 's', starter });
    expect(needsHealing({ ...run, box: [sapped(boxed('boxed'))] })).toBe(true);
    const moveless = { ...starter, fighter: { ...starter.fighter, moves: [] } };
    expect(needsHealing({ ...run, box: [moveless] })).toBe(false);
  });

  it('never treats a 0-HP member as a reason (D5)', () => {
    const run = createRun({ seed: 's', starter });
    expect(needsHealing({ ...run, box: [damaged(dead(boxed('dead')), 0, 0)] })).toBe(false);
  });
});

describe('pokevialReady', () => {
  it('needs both a full meter and something to cure', () => {
    const hurt = damaged(starter, 3, 1);
    expect(pokevialReady(createRun({ seed: 's', starter: hurt }))).toBe(true);
    expect(pokevialReady({ ...createRun({ seed: 's', starter: hurt }), pokevialCharges: 2 })).toBe(
      false,
    );
    expect(pokevialReady(createRun({ seed: 's', starter }))).toBe(false);
  });
});

describe('autoPokevial', () => {
  it('drinks a full meter on missing HP, resting the party and the box and curing status', () => {
    const hurt = damaged(
      { ...starter, fighter: { ...starter.fighter, status: 'psn' as const, statusCounter: 1 } },
      3,
      1,
    );
    const hurtBox = damaged(boxed('boxed', 'brn'), 2, 0);
    const before = addPokemon(
      { ...createRun({ seed: 's', starter: hurt }), party: Array(6).fill(hurt) },
      hurtBox,
    );
    const drunk = autoPokevial(before);
    expect(drunk).not.toBe(before);
    expect(drunk.pokevialCharges).toBe(0);
    expect(drunk.party[0].fighter.hp).toBe(starterMaxHp);
    expect(drunk.party[0].fighter.moves.every((slot) => slot.pp === slot.maxPp)).toBe(true);
    expect(drunk.party[0].fighter.status).toBeNull();
    expect(drunk.party[0].fighter.statusCounter).toBe(0);
    expect(drunk.box[0].fighter.hp).toBeGreaterThan(2);
    expect(drunk.box[0].fighter.moves.every((slot) => slot.pp === slot.maxPp)).toBe(true);
    expect(drunk.box[0].fighter.status).toBeNull();
  });

  it('returns the same object with a full meter and nothing to cure', () => {
    const healthy = createRun({ seed: 's', starter });
    expect(autoPokevial(healthy)).toBe(healthy);
  });

  it('returns the same object on a partial meter', () => {
    const partial = {
      ...createRun({ seed: 's', starter: damaged(starter, 3, 1) }),
      pokevialCharges: POKEVIAL_MAX_CHARGES - 1,
    };
    expect(autoPokevial(partial)).toBe(partial);
  });

  it('drinks on a missing status alone, with HP and PP full', () => {
    const sick = {
      ...starter,
      fighter: { ...starter.fighter, status: 'par' as const, statusCounter: 3 },
    };
    const run = { ...createRun({ seed: 's', starter: sick }), box: [boxed('boxed', 'brn')] };
    const drunk = autoPokevial(run);
    expect(drunk).not.toBe(run);
    expect(drunk.pokevialCharges).toBe(0);
    expect(drunk.party[0].fighter.hp).toBe(starterMaxHp);
    expect(drunk.party[0].fighter.status).toBeNull();
    expect(drunk.box[0].fighter.status).toBeNull();
  });

  it('drinks when only a boxed member is missing PP', () => {
    const run = { ...createRun({ seed: 's', starter }), box: [sapped(boxed('boxed'))] };
    const drunk = autoPokevial(run);
    expect(drunk).not.toBe(run);
    expect(drunk.pokevialCharges).toBe(0);
    expect(drunk.box[0].fighter.moves.every((slot) => slot.pp === slot.maxPp)).toBe(true);
  });

  it('never heals or revives a 0-HP member, and never drinks for one (D5)', () => {
    const hurt = damaged(starter, 3, 1);
    const fallen = dead(boxed('dead'));
    const run = { ...createRun({ seed: 's', starter: hurt }), party: [hurt, fallen] };
    const drunk = autoPokevial(run);
    expect(drunk.pokevialCharges).toBe(0);
    expect(drunk.party[0].fighter.hp).toBe(starterMaxHp);
    expect(drunk.party[1].fighter.hp).toBe(0);

    const alone = { ...createRun({ seed: 's', starter }), party: [starter, fallen] };
    expect(autoPokevial(alone)).toBe(alone);
  });
});

describe('chargePokevial', () => {
  it('adds a charge per beaten trainer and clamps at the cap', () => {
    const empty = { ...createRun({ seed: 's', starter }), pokevialCharges: 0 };
    const one = chargePokevial(empty);
    expect(one.pokevialCharges).toBe(1);
    const full = chargePokevial(chargePokevial(one));
    expect(full.pokevialCharges).toBe(POKEVIAL_MAX_CHARGES);
    expect(chargePokevial(full)).toBe(full);
  });

  it('treats a non-positive amount as a no-op', () => {
    const empty = { ...createRun({ seed: 's', starter }), pokevialCharges: 0 };
    expect(chargePokevial(empty, 0)).toBe(empty);
  });
});

describe('fillPokevial', () => {
  it('tops the meter up and is a no-op when already full', () => {
    const spent = { ...createRun({ seed: 's', starter }), pokevialCharges: 1 };
    expect(fillPokevial(spent).pokevialCharges).toBe(POKEVIAL_MAX_CHARGES);
    const full = fillPokevial(spent);
    expect(fillPokevial(full)).toBe(full);
  });
});

describe('fullHealMember', () => {
  it('restores HP, PP and status, and revives a fainted member', () => {
    const hurt = damaged({ ...starter, fighter: { ...starter.fighter, status: 'psn' as const } }, 0, 0);
    const healed = fullHealMember(hurt).fighter;
    expect(healed.hp).toBe(starterMaxHp);
    expect(healed.status).toBeNull();
    expect(healed.moves.every((slot) => slot.pp === slot.maxPp)).toBe(true);
  });
});

describe('serviceHeal', () => {
  it('restores HP and PP across the party and the box', () => {
    const hurt = damaged(starter, 3, 1);
    const hurtBox = damaged(boxed('boxed'), 2, 0);
    const stacked: RunState = { ...createRun({ seed: 's', starter: hurt }), party: Array(6).fill(hurt) };
    const healed = serviceHeal(addPokemon(stacked, hurtBox));
    expect(healed.party.every((member) => member.fighter.hp === starterMaxHp)).toBe(true);
    expect(
      healed.party.every((member) => member.fighter.moves.every((slot) => slot.pp === slot.maxPp)),
    ).toBe(true);
    expect(healed.box[0].fighter.hp).toBe(restoreFighter(hurtBox.fighter).maxHp);
    expect(healed.box[0].fighter.moves.every((slot) => slot.pp === slot.maxPp)).toBe(true);
  });

  it('leaves a primary status in place, where the Pokevial would cure it', () => {
    const sick = damaged({ ...starter, fighter: { ...starter.fighter, status: 'psn' as const } }, 3, 1);
    const healed = serviceHeal(createRun({ seed: 's', starter: sick }));
    expect(healed.party[0].fighter.status).toBe('psn');
    expect(healed.party[0].fighter.hp).toBe(starterMaxHp);
  });

  it('never revives a member at 0 HP (D5)', () => {
    const fallen = dead(starter);
    const run = { ...createRun({ seed: 's', starter }), party: [starter, fallen] };
    const healed = serviceHeal(run);
    expect(healed.party[1].fighter.hp).toBe(0);
    expect(healed.party[0].fighter.hp).toBe(starterMaxHp);
  });

  it('returns the same object when nothing is missing', () => {
    const whole = createRun({ seed: 's', starter });
    expect(serviceHeal(whole)).toBe(whole);
  });
});
