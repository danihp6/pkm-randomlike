import { describe, expect, it } from 'vitest';
import { getMove, getSpecies, levelUpMoves, statAtLevel } from '../../data/dex';
import { LEVEL_BANDS, bandForLevel } from '../../data/run';
import '../battle/effects/abilities';
import { restoreFighter } from '../battle/fighter';
import { randomAbility } from '../battle/randomAbility';
import {
  MAX_LEVEL,
  adoptAtLevel,
  createRunPokemon,
  editRunPokemon,
  evolvePokemon,
  experienceAward,
  experienceFraction,
  levelForXp,
  levelUpPokemon,
  xpForLevel,
  type RunPokemon,
} from './progression';

describe('xp curve', () => {
  it('is the medium-fast cubic curve', () => {
    expect(xpForLevel(1)).toBe(1);
    expect(xpForLevel(5)).toBe(125);
    expect(xpForLevel(16)).toBe(4096);
    expect(xpForLevel(MAX_LEVEL)).toBe(1_000_000);
  });

  it('round-trips a level through its XP', () => {
    for (const level of [1, 2, 5, 16, 40, 100]) {
      expect(levelForXp(xpForLevel(level))).toBe(level);
      expect(levelForXp(xpForLevel(level) - 1)).toBe(Math.max(1, level - 1));
    }
  });

  it('fractions the progress towards the next level and clamps', () => {
    expect(experienceFraction(xpForLevel(5), 5)).toBe(0);
    expect(experienceFraction(xpForLevel(6), 5)).toBe(1);
    expect(experienceFraction(xpForLevel(5) - 1, 5)).toBe(0);
    expect(experienceFraction(xpForLevel(6) + 1000, 5)).toBe(1);
    const mid = (xpForLevel(5) + xpForLevel(6)) / 2;
    expect(experienceFraction(mid, 5)).toBeCloseTo(0.5);
  });
});

describe('experienceAward', () => {
  it('scales with the defeated level and splits across participants', () => {
    expect(experienceAward(4)).toBe(20);
    expect(experienceAward(4, 2)).toBe(10);
    expect(experienceAward(4, 3)).toBe(6);
    expect(experienceAward(0)).toBe(5);
  });

  it('pays the band multiplier of the defeated level to a trainer battle', () => {
    for (const band of LEVEL_BANDS) {
      // The level bands meet at their boundaries and the higher one owns the
      // shared level, so the award follows `bandForLevel`, not the map's band.
      for (const level of [band.minLevel, band.maxLevel]) {
        const owner = bandForLevel(level);
        expect(experienceAward(level, 1, true), `${band.id} @${level} (${owner.id})`).toBe(
          Math.floor(level * 5 * 1.5 * owner.trainerXp),
        );
      }
    }
    expect(bandForLevel(10).id).toBe('low');
    expect(experienceAward(10, 1, true)).toBeGreaterThan(experienceAward(10));
  });

  it('leaves the three-argument trainer award on the band rate for every level', () => {
    for (let level = 1; level <= 100; level++) {
      expect(experienceAward(level, 1, true), `level ${level}`).toBe(
        Math.floor(level * 5 * 1.5 * bandForLevel(level).trainerXp),
      );
    }
  });

  it("multiplies a trainer award by the floor's factor and never touches a wild one", () => {
    for (let level = 1; level <= 100; level++) {
      expect(experienceAward(level, 1, true, 1), `level ${level}`).toBe(experienceAward(level, 1, true));
      expect(experienceAward(level, 1, true, 1.31), `level ${level}`).toBe(
        Math.floor(level * 5 * 1.5 * bandForLevel(level).trainerXp * 1.31),
      );
      expect(experienceAward(level, 1, false, 3), `level ${level}`).toBe(experienceAward(level));
    }
  });
});

describe('levelUpPokemon', () => {
  it('levels up, reports the move it crossed and leaves the four slots alone', () => {
    const pokemon = createRunPokemon({
      id: 'ember',
      speciesId: 'charmander',
      level: 1,
      moves: ['scratch'],
    });
    const grown = levelUpPokemon(pokemon, 4);
    expect(grown.pokemon.fighter.level).toBe(4);
    expect(grown.events).toContainEqual({ kind: 'level', level: 4 });
    expect(grown.events).toContainEqual({ kind: 'learn', moveId: 'ember', memberId: 'ember' });
    expect(grown.pokemon.fighter.moves.map((slot) => slot.moveId)).toEqual(['scratch']);
  });

  it('leaves a member already at the target alone', () => {
    const pokemon = createRunPokemon({ id: 'c', speciesId: 'charmander', level: 8, moves: ['ember'] });
    const same = levelUpPokemon(pokemon, 8);
    expect(same.pokemon).toBe(pokemon);
    expect(same.events).toEqual([]);
  });

  it('never evolves on level-up: evolution waits for the player', () => {
    const ready = createRunPokemon({ id: 'c', speciesId: 'charmander', level: 15, moves: ['ember'] });
    const grown = levelUpPokemon(ready, 16);
    expect(grown.pokemon.fighter.level).toBe(16);
    expect(grown.pokemon.fighter.speciesId).toBe('charmander');
  });

  it('keeps the four slots when a level-up crosses a fifth move and never forgets', () => {
    const pokemon = createRunPokemon({
      id: 'four',
      speciesId: 'charmander',
      level: 1,
      moves: ['scratch', 'growl', 'smokescreen', 'dragonbreath'],
    });
    const result = levelUpPokemon(pokemon, 4);
    expect(result.pokemon.fighter.level).toBe(4);
    expect(result.pokemon.fighter.moves.map((slot) => slot.moveId)).toEqual([
      'scratch',
      'growl',
      'smokescreen',
      'dragonbreath',
    ]);
    expect(result.events).toContainEqual({ kind: 'learn', moveId: 'ember', memberId: 'four' });
    expect(result.events.some((event) => event.kind === 'forget')).toBe(false);
  });

  it('does not report a crossed move that already sits in a slot', () => {
    const pokemon = createRunPokemon({
      id: 'slotted',
      speciesId: 'charmander',
      level: 1,
      moves: ['ember'],
    });
    const result = levelUpPokemon(pokemon, 4);
    expect(result.events).toContainEqual({ kind: 'level', level: 4 });
    expect(result.events.some((event) => event.kind === 'learn')).toBe(false);
    expect(result.pokemon.fighter.moves.map((slot) => slot.moveId)).toEqual(['ember']);
  });

  it('reports no learn event for an OHKO move a No Guard holder cannot equip', () => {
    // The premise first, so a data move fails loudly instead of passing vacuously.
    expect(levelUpMoves('diglett', 44)).toContainEqual({ moveId: 'fissure', level: 44 });
    expect(getMove('fissure')?.ohko).toBe(true);
    const pokemon = createRunPokemon({
      id: 'digger',
      speciesId: 'diglett',
      level: 43,
      ability: 'No Guard',
      moves: ['scratch'],
    });
    const result = levelUpPokemon(pokemon, 44);
    expect(result.events).toEqual([{ kind: 'level', level: 44 }]);
    expect(result.pokemon.fighter.moves.map((slot) => slot.moveId)).toEqual(['scratch']);
  });
});

describe('adoptAtLevel', () => {
  it('rebuilds a catch at the squad level with fresh stats and moves', () => {
    const caught = createRunPokemon({
      id: 'wild',
      speciesId: 'charmander',
      level: 3,
      moves: ['scratch'],
    });
    const adopted = adoptAtLevel(caught, 10);
    expect(adopted.fighter.level).toBe(10);
    const expected = statAtLevel(
      getSpecies('charmander')!,
      10,
      caught.fighter.nature,
      caught.fighter.ivs,
      caught.fighter.evs,
    );
    expect(adopted.fighter.hp).toBe(expected.hp);
    expect(adopted.fighter.moves.length).toBeGreaterThan(0);
  });

  it('keeps the caught species even at an evolution level', () => {
    const caught = createRunPokemon({ id: 'wild', speciesId: 'charmander', level: 3 });
    const adopted = adoptAtLevel(caught, 20);
    expect(adopted.fighter.speciesId).toBe('charmander');
  });

  it('carries the caught share of HP onto the new maximum, on a level up and a level down', () => {
    const cases = [
      { speciesId: 'charmander', caughtLevel: 5, adoptLevel: 12 },
      { speciesId: 'squirtle', caughtLevel: 20, adoptLevel: 8 },
    ];
    for (const { speciesId, caughtLevel, adoptLevel } of cases) {
      const caught = createRunPokemon({ id: 'wild', speciesId, level: caughtLevel });
      const f = caught.fighter;
      const oldMax = statAtLevel(getSpecies(speciesId)!, caughtLevel, f.nature, f.ivs, f.evs).hp;
      const h = Math.max(1, Math.floor(oldMax / 3));
      const damaged = { ...caught, fighter: { ...f, hp: h } };
      const adopted = adoptAtLevel(damaged, adoptLevel);
      const newMax = statAtLevel(getSpecies(speciesId)!, adoptLevel, f.nature, f.ivs, f.evs).hp;
      expect(adopted.fighter.hp, `${speciesId} @${caughtLevel}->${adoptLevel}`).toBe(
        Math.max(1, Math.round((h / oldMax) * newMax)),
      );
      expect(adopted.fighter.hp).toBeLessThanOrEqual(newMax);
    }
  });

  it('leaves a full-HP catch at exactly the new maximum (the dev path)', () => {
    const caught = createRunPokemon({ id: 'wild', speciesId: 'charmander', level: 5 });
    const f = caught.fighter;
    const adopted = adoptAtLevel(caught, 15);
    expect(adopted.fighter.hp).toBe(
      statAtLevel(getSpecies('charmander')!, 15, f.nature, f.ivs, f.evs).hp,
    );
  });

  it('floors a catch at 1 HP, so a 0-HP snapshot never arrives fainted', () => {
    const caught = createRunPokemon({ id: 'wild', speciesId: 'charmander', level: 5 });
    const f = caught.fighter;
    const newMax = statAtLevel(getSpecies('charmander')!, 15, f.nature, f.ivs, f.evs).hp;
    const zero = adoptAtLevel({ ...caught, fighter: { ...f, hp: 0 } }, 15);
    expect(zero.fighter.hp).toBe(1);
    const one = adoptAtLevel({ ...caught, fighter: { ...f, hp: 1 } }, 15);
    expect(one.fighter.hp).toBeGreaterThanOrEqual(1);
    expect(one.fighter.hp).toBeLessThanOrEqual(newMax);
  });

  it('rebuilds every other field exactly as before and mutates nothing', () => {
    const caught = createRunPokemon({
      id: 'wild',
      speciesId: 'charmander',
      level: 5,
      moves: ['scratch'],
    });
    const damaged = { ...caught, fighter: { ...caught.fighter, hp: 4, heldItem: 'oran-berry' } };
    const before = JSON.stringify(damaged);
    const adopted = adoptAtLevel(damaged, 12, 'run-1');
    expect(JSON.stringify(damaged)).toBe(before);
    expect(adopted).not.toBe(damaged);
    expect(adopted.fighter).not.toBe(damaged.fighter);
    const f = damaged.fighter;
    const rebuilt = createRunPokemon({
      id: f.id,
      speciesId: f.speciesId,
      level: 12,
      nature: f.nature,
      ability: f.ability,
      gender: f.gender,
      shiny: f.shiny,
      ivs: f.ivs,
      evs: f.evs,
      heldItem: 'oran-berry',
      learnsetSeed: 'run-1',
    });
    expect(adopted.fighter).toEqual({ ...rebuilt.fighter, hp: adopted.fighter.hp });
    expect(adopted.fighter.hp).toBe(
      Math.max(
        1,
        Math.round(
          (4 / statAtLevel(getSpecies('charmander')!, 5, f.nature, f.ivs, f.evs).hp) *
            rebuilt.fighter.hp,
        ),
      ),
    );
  });
});

describe('evolvePokemon', () => {
  it('evolves into a branch the level allows, rebuilding stats', () => {
    const ready = createRunPokemon({ id: 'c', speciesId: 'charmander', level: 16, moves: ['ember'] });
    const evolved = evolvePokemon(ready, 'charmeleon');
    expect(evolved.fighter.speciesId).toBe('charmeleon');
    const expected = statAtLevel(
      getSpecies('charmeleon')!,
      16,
      'serious',
      ready.fighter.ivs,
      ready.fighter.evs,
    );
    expect(evolved.fighter.hp).toBe(expected.hp);
  });

  it('carries the missing HP across, so a full member stays full', () => {
    const ready = createRunPokemon({ id: 'c', speciesId: 'charmander', level: 16, moves: ['ember'] });
    const evolved = evolvePokemon(ready, 'charmeleon');
    expect(evolved.fighter.hp).toBe(
      statAtLevel(getSpecies('charmeleon')!, 16, 'serious', ready.fighter.ivs, ready.fighter.evs).hp,
    );
  });

  it('re-rolls the ability from the new species when given a seed', () => {
    const ready = createRunPokemon({ id: 'c', speciesId: 'charmander', level: 16, moves: ['ember'] });
    const evolved = evolvePokemon(ready, 'charmeleon', 'run-1');
    expect(evolved.fighter.ability).toBe(randomAbility('charmeleon', 'run-1')?.name);
  });

  it('ignores a branch whose level is not met', () => {
    const early = createRunPokemon({ id: 'c', speciesId: 'charmander', level: 10, moves: ['ember'] });
    expect(evolvePokemon(early, 'charmeleon')).toBe(early);
  });

  it('picks any ready branch of a split line', () => {
    const eevee = createRunPokemon({ id: 'e', speciesId: 'eevee', level: 20 });
    expect(evolvePokemon(eevee, 'vaporeon').fighter.speciesId).toBe('vaporeon');
    expect(evolvePokemon(eevee, 'espeon').fighter.speciesId).toBe('espeon');
  });

  it('ignores an unknown or non-branch species', () => {
    const eevee = createRunPokemon({ id: 'e', speciesId: 'eevee', level: 20 });
    expect(evolvePokemon(eevee, 'not-a-species')).toBe(eevee);
    expect(evolvePokemon(eevee, 'pikachu')).toBe(eevee);
  });
});

/** The hand-authored Rotom appliances behave as any other evolution branch (`D38`). */
describe('evolvePokemon across a rotom appliance', () => {
  const APPLIANCES: readonly string[] = ['rotomheat', 'rotomwash', 'rotomfrost', 'rotomfan', 'rotommow'];
  const LEVEL = 30;

  function rotom(): RunPokemon {
    return createRunPokemon({
      id: 'r',
      speciesId: 'rotom',
      level: LEVEL,
      nickname: 'Sparky',
      nature: 'modest',
      ability: 'Levitate',
      gender: 'male',
      shiny: true,
      heldItem: 'oran-berry',
      moves: ['thunderbolt'],
    });
  }

  it('keeps every field of the member and only swaps the species', () => {
    const base = rotom();
    const damaged: RunPokemon = {
      ...base,
      fighter: {
        ...base.fighter,
        hp: base.fighter.hp - 5,
        status: 'par',
        statusCounter: 1,
        moves: [{ moveId: 'thunderbolt', pp: 3, maxPp: 15 }],
      },
    };
    const evolved = evolvePokemon(damaged, 'rotomheat');
    expect(evolved.fighter.speciesId).toBe('rotomheat');
    expect(evolved.fighter.level).toBe(LEVEL);
    expect(evolved.fighter.nickname).toBe('Sparky');
    expect(evolved.fighter.nature).toBe('modest');
    expect(evolved.fighter.gender).toBe('male');
    expect(evolved.fighter.shiny).toBe(true);
    expect(evolved.fighter.heldItem).toBe('oran-berry');
    expect(evolved.fighter.ivs).toEqual(damaged.fighter.ivs);
    expect(evolved.fighter.evs).toEqual(damaged.fighter.evs);
    expect(evolved.fighter.status).toBe('par');
    expect(evolved.fighter.statusCounter).toBe(1);
    expect(evolved.fighter.moves).toEqual(damaged.fighter.moves);
    expect(evolved.fighter).toEqual({
      ...damaged.fighter,
      speciesId: 'rotomheat',
      ability: 'Levitate',
      hp: evolved.fighter.hp,
    });
    const f = evolved.fighter;
    const applianceSpa = statAtLevel(getSpecies('rotomheat')!, LEVEL, f.nature, f.ivs, f.evs).spa;
    expect(restoreFighter(f).stats.spa).toBe(applianceSpa);
    expect(applianceSpa).not.toBe(statAtLevel(getSpecies('rotom')!, LEVEL, f.nature, f.ivs, f.evs).spa);
  });

  it('carries the missing HP across and keeps the maximum, for all five appliances', () => {
    const base = rotom();
    const f = base.fighter;
    const oldMax = statAtLevel(getSpecies('rotom')!, LEVEL, f.nature, f.ivs, f.evs).hp;
    const damaged: RunPokemon = { ...base, fighter: { ...f, hp: oldMax - 5 } };
    for (const into of APPLIANCES) {
      const target = getSpecies(into)!;
      expect(target.baseStats.hp, into).toBe(getSpecies('rotom')!.baseStats.hp);
      const evolved = evolvePokemon(damaged, into);
      const newMax = statAtLevel(target, LEVEL, f.nature, f.ivs, f.evs).hp;
      expect(newMax, into).toBe(oldMax);
      expect(evolved.fighter.hp, into).toBe(newMax - 5);
    }
  });

  it('keeps Levitate without a seed and re-rolls it deterministically with one', () => {
    expect(Object.values(getSpecies('rotom')!.abilities)).toContain('Levitate');
    expect(Object.values(getSpecies('rotomheat')!.abilities)).toContain('Levitate');
    const base = rotom();
    expect(evolvePokemon(base, 'rotomheat').fighter.ability).toBe('Levitate');
    const rolled = evolvePokemon(base, 'rotomheat', 'run-1');
    expect(rolled.fighter.ability).toBe(randomAbility('rotomheat', 'run-1')?.name);
    expect(evolvePokemon(base, 'rotomheat', 'run-1')).toEqual(rolled);
  });

  it('ignores a click below the resolved level and one from an appliance back', () => {
    const early = createRunPokemon({ id: 'r', speciesId: 'rotom', level: LEVEL - 1 });
    expect(evolvePokemon(early, 'rotomheat')).toBe(early);
    const appliance = createRunPokemon({ id: 'r', speciesId: 'rotomheat', level: LEVEL });
    expect(evolvePokemon(appliance, 'rotom')).toBe(appliance);
    expect(evolvePokemon(appliance, 'rotomwash')).toBe(appliance);
  });
});

describe('editRunPokemon', () => {
  it('changes the level, keeping the moveset', () => {
    const pokemon = createRunPokemon({ id: 'c', speciesId: 'charmander', level: 5, moves: ['ember'] });
    const edited = editRunPokemon(pokemon, { level: 20 });
    expect(edited.fighter.level).toBe(20);
    expect(edited.fighter.moves.map((slot) => slot.moveId)).toEqual(['ember']);
  });

  it('clamps the level to 1..MAX and keeps it on a non-finite value', () => {
    const pokemon = createRunPokemon({ id: 'c', speciesId: 'charmander', level: 5 });
    expect(editRunPokemon(pokemon, { level: 0 }).fighter.level).toBe(1);
    expect(editRunPokemon(pokemon, { level: 999 }).fighter.level).toBe(MAX_LEVEL);
    expect(editRunPokemon(pokemon, { level: Number.NaN }).fighter.level).toBe(5);
  });

  it('sets moves from the dex, dropping unknown ids and duplicates', () => {
    const pokemon = createRunPokemon({ id: 'c', speciesId: 'charmander', level: 5, moves: ['scratch'] });
    const edited = editRunPokemon(pokemon, { moves: ['ember', 'not-a-move', 'ember', 'growl'] });
    expect(edited.fighter.moves.map((slot) => slot.moveId)).toEqual(['ember', 'growl']);
    for (const slot of edited.fighter.moves) expect(slot.pp).toBe(slot.maxPp);
  });

  it('keeps the moveset when every proposed move is unknown', () => {
    const pokemon = createRunPokemon({ id: 'c', speciesId: 'charmander', level: 5, moves: ['scratch'] });
    const edited = editRunPokemon(pokemon, { moves: ['not-a-move'] });
    expect(edited.fighter.moves.map((slot) => slot.moveId)).toEqual(['scratch']);
  });

  it('sets an off-species ability and a nature', () => {
    const pokemon = createRunPokemon({ id: 'c', speciesId: 'charmander', level: 10 });
    const edited = editRunPokemon(pokemon, { ability: 'Levitate', nature: 'adamant' });
    expect(edited.fighter.ability).toBe('Levitate');
    expect(edited.fighter.nature).toBe('adamant');
  });

  it('heals to the new maximum on a level change and keeps HP else', () => {
    const pokemon = createRunPokemon({ id: 'c', speciesId: 'charmander', level: 5, moves: ['ember'] });
    const hurt = { ...pokemon, fighter: { ...pokemon.fighter, hp: 1 } };
    const bumped = editRunPokemon(hurt, { level: 20 });
    const maxHp = statAtLevel(
      getSpecies('charmander')!,
      20,
      hurt.fighter.nature,
      hurt.fighter.ivs,
      hurt.fighter.evs,
    ).hp;
    expect(bumped.fighter.hp).toBe(maxHp);
    expect(editRunPokemon(hurt, { moves: ['growl'] }).fighter.hp).toBe(1);
  });
});
