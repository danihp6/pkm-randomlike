import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LOCALE, setLocale } from '../../i18n/index';
import {
  abilityDescription,
  abilityDescriptionFromEnglish,
  abilityName,
  abilityNameFromEnglish,
} from '../../i18n/content';
import meta from '../../data/dex/meta.json';
import {
  allAbilities,
  allAbilitiesWithCustom,
  getAbility,
  getCustomAbility,
} from '../../data/dex/abilities';
import { getSpecies } from '../../data/dex/species';
import { Rng } from '../rng';
import { createFighter } from './fighter';
import { randomAbility, randomAbilityPool } from './randomAbility';
import { createBattle, type BattleState, type BattleEvent } from './state';
import { takeTurn } from './turn';
// Importing the ability table registers every implemented ability, the pool a
// running game draws from (the battle index does this at boot).
import './effects/abilities';

const counts = (meta as { counts: Readonly<Record<string, number>> }).counts;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.doUnmock('../../data/dex/customAbilities');
  vi.resetModules();
  setLocale(DEFAULT_LOCALE);
});

describe('randomAbilityPool', () => {
  it('holds the implemented set and drops the forme-locked ids', () => {
    const ids = randomAbilityPool().map((ability) => ability.id);
    expect(ids).toContain('blaze');
    expect(ids).toContain('levitate');
    // Implemented generically, so it is fair game.
    expect(ids).toContain('wonderguard');
    // Both out-of-battle item abilities are registered as empty ports, so a run can
    // hold them and `src/engine/run/passives.ts` can read them on the map.
    expect(ids).toContain('pickup');
    expect(ids).toContain('honeygather');
    // The Ice Face shield stays; every forme-changing ability was deleted and
    // its formes became data (`D38`).
    expect(ids).toContain('iceface');
    for (const id of [
      'battlebond',
      'disguise',
      'flowergift',
      'forecast',
      'hungerswitch',
      'schooling',
      'shieldsdown',
      'stancechange',
      'terashift',
      'zerotohero',
      'zenmode',
      'zenmodegalar',
    ]) {
      expect(ids, id).not.toContain(id);
    }
    // Still forme-locked: never handed out.
    expect(ids).not.toContain('powerconstruct');
    expect(ids).not.toContain('multitype');
    expect(ids).not.toContain('gulpmissile');
    expect(ids.length).toBeGreaterThan(200);
  });

  it('carries the custom row exactly once', () => {
    const ids = randomAbilityPool().map((ability) => ability.id);
    expect(ids.filter((id) => id === 'darkmatter')).toHaveLength(1);
  });
});

describe('randomAbility', () => {
  it('is deterministic per (species, seed)', () => {
    expect(randomAbility('charmander', 'seed-1')).toEqual(randomAbility('charmander', 'seed-1'));
  });

  it('draws the same fixed-seed ability, pinned with the custom row in the pool', () => {
    expect(randomAbility('charmander', 'run-1')?.id).toBe('dragonsmaw');
  });

  it('only ever hands out an ability from the pool', () => {
    const allowed = new Set(randomAbilityPool().map((ability) => ability.id));
    for (let i = 0; i < 200; i++) {
      const ability = randomAbility('charmander', `seed-${i}`);
      expect(ability).toBeDefined();
      expect(allowed.has(ability!.id)).toBe(true);
      expect(getAbility(ability!.id)).toBeDefined();
    }
  });

  it('varies across seeds', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(randomAbility('charmander', `seed-${i}`)!.id);
    expect(seen.size).toBeGreaterThan(1);
  });

  it('drops an excluded ability from the roll', () => {
    for (let i = 0; i < 100; i++) {
      expect(randomAbility('charmander', `seed-${i}`, ['No Guard'])?.id).not.toBe('noguard');
    }
  });
});

describe('the custom ability row', () => {
  it('resolves darkmatter by id, name and punctuation', () => {
    const row = getAbility('darkmatter');
    expect(row?.id).toBe('darkmatter');
    expect(row?.name).toBe('Dark Matter');
    expect(row?.desc).toBe(
      "The holder's moves ignore the type chart: no weaknesses, no resistances, no immunities.",
    );
    expect(row?.shortDesc).toBe("The holder's moves ignore the type chart.");
    expect(getAbility('Dark Matter')?.id).toBe('darkmatter');
    expect(getAbility('DARK-MATTER')?.id).toBe('darkmatter');
    expect(getAbility('not-an-ability')).toBeUndefined();
  });

  it('keeps the generated set at 311 and counts the custom row apart', () => {
    expect(allAbilities().length).toBe(counts.abilities);
    expect(allAbilities().length).toBe(311);
    expect(allAbilitiesWithCustom().length).toBe(312);
    expect(counts.customAbilities).toBe(1);
    expect(allAbilities().some((ability) => ability.id === 'darkmatter')).toBe(false);
    expect(allAbilitiesWithCustom().some((ability) => ability.id === 'darkmatter')).toBe(true);
  });

  it('carries its own Spanish copy', () => {
    const custom = getCustomAbility('Dark Matter');
    expect(custom?.id).toBe('darkmatter');
    expect(custom?.nameEs).toBe('Materia Oscura');
    expect(custom?.descEs).toContain('ignoran la tabla de tipos');
    expect(custom?.shortDescEs).toBe('Los movimientos de quien la posee ignoran la tabla de tipos.');
    expect(getCustomAbility('levitate')).toBeUndefined();
  });

  it('lets a generated row win when an id appears in both sets', async () => {
    vi.resetModules();
    vi.doMock('../../data/dex/customAbilities', () => ({
      CUSTOM_ABILITIES: [
        {
          id: 'levitate',
          name: 'Stub Levitate',
          desc: 'stub',
          shortDesc: 'stub',
          nameEs: 'stub',
          descEs: 'stub',
          shortDescEs: 'stub',
        },
      ],
    }));
    const accessors = await import('../../data/dex/abilities');
    expect(accessors.getAbility('levitate')?.name).toBe('Levitate');
    expect(accessors.getCustomAbility('Levitate')?.name).toBe('Stub Levitate');
    expect(accessors.allAbilitiesWithCustom().length).toBe(312);
  });

  it('prints its Spanish and English copy through the content layer', () => {
    setLocale('es');
    expect(abilityName('darkmatter')).toBe('Materia Oscura');
    expect(abilityNameFromEnglish('Dark Matter')).toBe('Materia Oscura');
    expect(abilityDescription('darkmatter')).toContain('sin debilidades');
    expect(abilityDescriptionFromEnglish('Dark Matter')).toContain('sin debilidades');

    setLocale('en');
    expect(abilityName('darkmatter')).toBe('Dark Matter');
    expect(abilityNameFromEnglish('Dark Matter')).toBe('Dark Matter');
    expect(abilityDescription('darkmatter')).toBe("The holder's moves ignore the type chart.");
  });
});

describe('createFighter ability resolution', () => {
  it('rolls a deterministic ability from the pool when a seed is given', () => {
    const a = createFighter({ id: 'a', speciesId: 'charmander', level: 20, learnsetSeed: 'run-1' });
    const b = createFighter({ id: 'b', speciesId: 'charmander', level: 20, learnsetSeed: 'run-1' });
    expect(a.ability).toBe(b.ability);
    expect(a.ability).toBe(randomAbility('charmander', 'run-1')?.name);
  });

  it('falls back to the species first ability without a seed', () => {
    const fighter = createFighter({ id: 'a', speciesId: 'charmander', level: 20 });
    expect(fighter.ability).toBe(Object.values(getSpecies('charmander')!.abilities)[0]);
  });

  it('never pairs No Guard with an OHKO move', () => {
    for (let i = 0; i < 200; i++) {
      const fighter = createFighter({
        id: 'x',
        speciesId: 'charmander',
        level: 20,
        moves: ['fissure'],
        learnsetSeed: `run-${i}`,
      });
      expect(fighter.moves.some((slot) => slot.moveId === 'fissure')).toBe(true);
      expect(fighter.ability).not.toBe('No Guard');
    }
  });

  it('keeps a provided out-of-battle ability as-is', () => {
    for (const ability of ['Pickup', 'Honey Gather']) {
      const fighter = createFighter({ id: ability, speciesId: 'charmander', level: 20, ability });
      expect(fighter.ability).toBe(ability);
    }
  });
});

const fight = (moveIndex = 0) => ({ type: 'fight', moveIndex }) as const;

function darkMatterBattle(ability: string, defenderId: string, defenderLevel = 5): BattleState {
  const attacker = createFighter({
    id: 'p',
    speciesId: 'charmander',
    level: 30,
    ability,
    moves: ['tackle'],
  });
  const defender = createFighter({
    id: 'e',
    speciesId: defenderId,
    level: defenderLevel,
    moves: ['splash'],
  });
  return createBattle({ player: [attacker], enemy: [defender], rng: new Rng(7), isWild: true });
}

function enemyHits(state: BattleState): readonly Extract<BattleEvent, { kind: 'damage' }>[] {
  return state.log.filter(
    (event): event is Extract<BattleEvent, { kind: 'damage' }> =>
      event.kind === 'damage' && event.side === 'enemy',
  );
}

describe('darkmatter in a battle', () => {
  it('pierces a 0x immunity, so a Normal move hits a Ghost', () => {
    const state = darkMatterBattle('darkmatter', 'gastly');
    takeTurn(state, fight(), fight());
    const hits = enemyHits(state);
    expect(hits).toHaveLength(1);
    expect(hits[0].effectiveness).toBe(1);
    expect(state.sides.enemy.party[0].hp).toBeLessThan(state.sides.enemy.party[0].maxHp);
  });

  it('leaves the same hit immune without the ability', () => {
    const state = darkMatterBattle('Blaze', 'gastly');
    takeTurn(state, fight(), fight());
    expect(enemyHits(state)).toHaveLength(0);
    expect(state.sides.enemy.party[0].hp).toBe(state.sides.enemy.party[0].maxHp);
    expect(state.log.some((event) => event.kind === 'text' && event.key === 'battle.log.noEffect')).toBe(
      true,
    );
  });

  it('turns a resisted hit neutral', () => {
    const withAbility = darkMatterBattle('darkmatter', 'geodude', 30);
    takeTurn(withAbility, fight(), fight());
    expect(enemyHits(withAbility)[0].effectiveness).toBe(1);

    const withoutAbility = darkMatterBattle('Blaze', 'geodude', 30);
    takeTurn(withoutAbility, fight(), fight());
    expect(enemyHits(withoutAbility)[0].effectiveness).toBe(0.5);
  });
});

describe('the out-of-battle abilities in a battle', () => {
  it('never pages the coverage warning for a fighter that holds one', async () => {
    vi.resetModules();
    vi.stubEnv('ENVIRONMENT', 'develop');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { IS_DEVELOP } = await import('../../dev/env');
    expect(IS_DEVELOP).toBe(true);
    const registry = await import('./effects/registry');
    const { createBattle } = await import('./state');
    const { createFighter: build } = await import('./fighter');
    const { Rng } = await import('../rng');
    await import('./effects/abilities');

    const switchIn = (ability: string): void => {
      const player = build({ id: 'p', speciesId: 'charmander', level: 20, ability });
      const enemy = build({ id: 'e', speciesId: 'squirtle', level: 20 });
      const state = createBattle({ player: [player], enemy: [enemy], rng: new Rng(1), isWild: true });
      registry.runSwitchIn(registry.makeContext(state, 'player', { source: player }));
    };

    switchIn('Pickup');
    switchIn('Honey Gather');
    expect(warn).not.toHaveBeenCalled();

    // The control: an ability with no registry row still warns, so the assertion
    // above proves the two rows and not a silent gate.
    switchIn('Ball Fetch');
    expect(warn).toHaveBeenCalledWith('[coverage] ability "Ball Fetch" has no ported effect (D16).');
  });
});
