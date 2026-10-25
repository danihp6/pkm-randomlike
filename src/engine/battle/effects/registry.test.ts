import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMove } from '../../../data/dex';
import { Rng } from '../../rng';
import { createFighter } from '../fighter';
import {
  activeFighter,
  createBattle,
  type BattleState,
  type RoomFieldEffects,
} from '../state';
import { takeTurn } from '../turn';
import { abilityEffects } from './abilities';
import { itemEffects } from './items';
import {
  clearEffects,
  getEffect,
  makeContext,
  normalizeEffectId,
  registerEffect,
  registerEffects,
  runBoost,
  runModifyDamage,
  runModifyTrapDamage,
  runResidual,
  runStatus,
  runTryHit,
  type EffectDefinition,
  type EffectHandlers,
} from './registry';

function effect(
  id: string,
  handlers: EffectHandlers,
  kind: EffectDefinition['kind'] = 'ability',
): EffectDefinition {
  return { id, kind, handlers };
}

function battle(rngSeed = 4242): BattleState {
  return createBattle({
    player: [
      createFighter({
        id: 'player',
        speciesId: 'charmander',
        level: 20,
        ability: 'Blaze',
        moves: ['ember'],
      }),
    ],
    enemy: [
      createFighter({
        id: 'enemy',
        speciesId: 'bulbasaur',
        level: 18,
        ability: 'Overgrow',
        moves: ['tackle'],
      }),
    ],
    rng: new Rng(rngSeed),
    isWild: true,
  });
}

beforeEach(() => clearEffects());
afterEach(() => clearEffects());

describe('effect registry', () => {
  it('registers by normalized id and rejects duplicates', () => {
    registerEffect(effect('Overgrow', { onStart: () => {} }));
    expect(getEffect('over grow')).toBeDefined();
    expect(normalizeEffectId('Over-Grow!')).toBe('overgrow');
    expect(() => registerEffect(effect('overgrow', {}))).toThrow(/already registered/);
  });

  it('is empty again after clearEffects', () => {
    registerEffect(effect('overgrow', {}));
    clearEffects();
    expect(getEffect('overgrow')).toBeUndefined();
  });

  it('dispatches switch-in and start hooks for the source ability', () => {
    const seen: string[] = [];
    registerEffect(
      effect('overgrow', {
        onStart: () => seen.push('start'),
        onSwitchIn: () => seen.push('switch'),
      }),
    );

    battle();

    expect(seen).toEqual(['start', 'switch']);
  });

  it('threads damage through source then target handlers', () => {
    registerEffect(effect('blaze', { onModifyDamage: (_ctx, payload) => payload.damage + 10 }));
    registerEffect(effect('overgrow', { onModifyDamage: (_ctx, payload) => payload.damage * 2 }));

    const state = battle();
    const ctx = makeContext(state, 'player', {
      source: activeFighter(state, 'player'),
      target: activeFighter(state, 'enemy'),
    });

    expect(runModifyDamage(ctx, getMove('ember')!, 20)).toBe(60);
  });

  it('stops a boolean hook on the first block', () => {
    const calls: string[] = [];
    registerEffect(
      effect('blaze', {
        onTryHit: () => {
          calls.push('blaze');
          return false;
        },
      }),
    );
    registerEffect(
      effect('overgrow', {
        onTryHit: () => {
          calls.push('overgrow');
          return true;
        },
      }),
    );

    const state = battle();
    const ctx = makeContext(state, 'player', {
      source: activeFighter(state, 'player'),
      target: activeFighter(state, 'enemy'),
    });

    expect(runTryHit(ctx, getMove('ember')!)).toBe(false);
    expect(calls).toEqual(['blaze']);
  });

  it('dispatches the remaining hooks', () => {
    const calls: string[] = [];
    registerEffect(
      effect('blaze', {
        onResidual: () => calls.push('residual'),
        onStatus: () => {
          calls.push('status');
          return true;
        },
        onBoost: () => {
          calls.push('boost');
          return true;
        },
      }),
    );

    const state = battle();
    const ctx = makeContext(state, 'player', { source: activeFighter(state, 'player') });
    runResidual(ctx);
    runStatus(ctx, 'brn');
    runBoost(ctx, 'atk', 1);

    expect(calls).toEqual(['residual', 'status', 'boost']);
  });
});

describe('effect registry in the turn loop', () => {
  it('applies an ability damage modifier during a real turn', () => {
    const control = battle();
    takeTurn(control, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    const controlHp = activeFighter(control, 'enemy').hp;

    clearEffects();
    registerEffect(effect('blaze', { onModifyDamage: (_ctx, payload) => payload.damage + 5 }));
    const buffed = battle();
    takeTurn(buffed, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });

    expect(controlHp - activeFighter(buffed, 'enemy').hp).toBe(5);
  });

  it('skips damage when the move is blocked on try-hit', () => {
    registerEffect(effect('overgrow', { onTryHit: () => false }));

    const state = battle();
    const enemy = activeFighter(state, 'enemy');
    const before = enemy.hp;
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });

    expect(enemy.hp).toBe(before);
    expect(state.log.some((event) => event.kind === 'damage' && event.side === 'enemy')).toBe(false);
  });
});

describe('the radiant room turns the ability dispatcher off', () => {
  const registerReal = (): void => {
    registerEffects(abilityEffects());
    registerEffects(itemEffects());
  };

  const radiantBattle = (roomField?: Partial<RoomFieldEffects>): BattleState =>
    createBattle({
      player: [
        createFighter({
          id: 'player',
          speciesId: 'bulbasaur',
          level: 20,
          ability: 'Overgrow',
          moves: ['tackle'],
        }),
      ],
      enemy: [
        createFighter({
          id: 'enemy',
          speciesId: 'growlithe',
          level: 20,
          ability: 'Intimidate',
          moves: ['tackle'],
        }),
      ],
      rng: new Rng(4242),
      isWild: false,
      ...(roomField ? { roomField } : {}),
    });

  it('collects no ability handler: Intimidate never cuts the foe’s Attack', () => {
    registerReal();

    expect(activeFighter(radiantBattle(), 'player').boosts.atk).toBe(-1);
    expect(activeFighter(radiantBattle({ abilitiesOff: true }), 'player').boosts.atk).toBe(0);
  });

  it('keeps a held item working under the flag', () => {
    registerReal();
    const state = createBattle({
      player: [
        createFighter({
          id: 'player',
          speciesId: 'charmander',
          level: 20,
          ability: 'Blaze',
          heldItem: 'leftovers',
          moves: ['ember'],
        }),
      ],
      enemy: [
        createFighter({
          id: 'enemy',
          speciesId: 'bulbasaur',
          level: 20,
          ability: 'Overgrow',
          moves: ['tackle'],
        }),
      ],
      rng: new Rng(4242),
      isWild: false,
      roomField: { abilitiesOff: true },
    });
    const player = activeFighter(state, 'player');
    player.hp = Math.floor(player.maxHp / 2);
    const before = player.hp;

    runResidual(
      makeContext(state, 'player', { source: player, target: activeFighter(state, 'enemy') }),
    );

    expect(player.hp).toBe(before + Math.floor(player.maxHp / 16));
    expect(player.heldItem).toBe('leftovers');
  });
});

describe('trap damage modifiers (Task-159)', () => {
  it('reads the trapped fighter\'s own held item, and keeps its last numeric answer', () => {
    registerEffect(
      effect('trapband', { onModifyTrapDamage: (_ctx, damage) => damage * 2 }, 'item'),
    );

    const state = battle();
    const victim = activeFighter(state, 'enemy');
    const foe = activeFighter(state, 'player');
    victim.heldItem = 'trapband';

    const ctx = makeContext(state, 'enemy', { source: victim, target: foe });
    expect(runModifyTrapDamage(ctx, 6)).toBe(12);

    foe.heldItem = 'trapband';
    victim.heldItem = null;
    const foeHeld = makeContext(state, 'enemy', { source: victim, target: foe });
    expect(runModifyTrapDamage(foeHeld, 6)).toBe(6);
  });

  it('leaves the damage alone when no handler answers', () => {
    registerEffect(effect('silentband', { onModifyTrapDamage: () => {} }, 'item'));
    const state = battle();
    const victim = activeFighter(state, 'enemy');
    const ctx = makeContext(state, 'enemy', {
      source: victim,
      target: activeFighter(state, 'player'),
    });
    expect(runModifyTrapDamage(ctx, 7)).toBe(7);
  });
});

describe('the second ability slot (Task-153)', () => {
  it('dispatches one handler per slot, each owned by the fighter', () => {
    const seen: string[] = [];
    registerEffect(effect('Alpha', { onSwitchIn: (ctx) => seen.push(`alpha:${ctx.owner.id}`) }));
    registerEffect(effect('Beta', { onSwitchIn: (ctx) => seen.push(`beta:${ctx.owner.id}`) }));

    createBattle({
      player: [
        createFighter({
          id: 'player',
          speciesId: 'charmander',
          level: 20,
          ability: 'Alpha',
          secondAbility: 'Beta',
          moves: ['ember'],
        }),
      ],
      enemy: [
        createFighter({
          id: 'enemy',
          speciesId: 'bulbasaur',
          level: 18,
          ability: 'Overgrow',
          moves: ['tackle'],
        }),
      ],
      rng: new Rng(4242),
      isWild: true,
    });

    expect(seen).toEqual(['alpha:player', 'beta:player']);
  });

  it('runs a row named by both slots exactly once', () => {
    let calls = 0;
    registerEffect(effect('Alpha', { onSwitchIn: () => (calls += 1) }));
    const fighter = createFighter({
      id: 'player',
      speciesId: 'charmander',
      level: 20,
      ability: 'Alpha',
      moves: ['ember'],
    });
    // Both slots naming the same row: the dispatcher dedupes by effect id.
    fighter.secondAbility = 'alpha';

    createBattle({
      player: [fighter],
      enemy: [
        createFighter({
          id: 'enemy',
          speciesId: 'bulbasaur',
          level: 18,
          ability: 'Overgrow',
          moves: ['tackle'],
        }),
      ],
      rng: new Rng(4242),
      isWild: true,
    });

    expect(calls).toBe(1);
  });

  it('pages the coverage warning for an unregistered second ability beside a registered primary', async () => {
    vi.resetModules();
    vi.stubEnv('ENVIRONMENT', 'develop');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const registry = await import('./registry');
      const { createBattle: makeBattle } = await import('../state');
      const { createFighter: build } = await import('../fighter');
      const { Rng: Seed } = await import('../../rng');
      await import('./abilities');

      const player = build({
        id: 'player',
        speciesId: 'charmander',
        level: 20,
        ability: 'Blaze',
        secondAbility: 'Ball Fetch',
      });
      const enemy = build({ id: 'enemy', speciesId: 'squirtle', level: 18, ability: 'Torrent' });
      const state = makeBattle({
        player: [player],
        enemy: [enemy],
        rng: new Seed(1),
        isWild: true,
      });
      registry.runSwitchIn(registry.makeContext(state, 'player', { source: player }));

      expect(warn).toHaveBeenCalledWith('[coverage] ability "Ball Fetch" has no ported effect (D16).');
    } finally {
      warn.mockRestore();
      vi.unstubAllEnvs();
    }
  });
});
