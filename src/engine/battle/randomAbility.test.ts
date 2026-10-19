import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAbility } from '../../data/dex/abilities';
import { getSpecies } from '../../data/dex/species';
import { createFighter } from './fighter';
import { randomAbility, randomAbilityPool } from './randomAbility';
// Importing the ability table registers every implemented ability, the pool a
// running game draws from (the battle index does this at boot).
import './effects/abilities';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
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
});

describe('randomAbility', () => {
  it('is deterministic per (species, seed)', () => {
    expect(randomAbility('charmander', 'seed-1')).toEqual(randomAbility('charmander', 'seed-1'));
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
