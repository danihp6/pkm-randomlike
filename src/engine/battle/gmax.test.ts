import { describe, expect, it } from 'vitest';
import { gmaxFormForBase } from '../../data/dex/gmaxes';
import { Rng } from '../rng';
import { chooseAiCommand } from './ai';
import { legalMoveIndices, validateCommand } from './commands';
import { GMAX_HP_MULTIPLIER, canGigantamax, gigantamax, revertGigantamax } from './gmax';
import { formatBattleLog, scriptedBattle } from './harness';
import { activeFighter, createBattle, createFighter, snapshotFighter, type BattleState } from './index';
import { canMegaEvolve, megaEvolve } from './mega';
import { takeTurn } from './turn';

/** The G-Max Stone of a species, or undefined when it has no G-Max forme. */
function stoneOf(speciesId: string): string | undefined {
  return gmaxFormForBase(speciesId)?.stoneId;
}

/**
 * A held item is **explicit** here, unlike the shipped helper patterns: a Mega
 * Stone may be a *wrong* stone. `undefined` means "the species' own G-Max Stone",
 * `null` means "holds nothing", a string is that exact item.
 */
function battle(
  playerSpeciesId = 'gengar',
  playerHeldItem?: string | null,
  enemySpeciesId = 'bulbasaur',
  enemyHeldItem?: string | null,
): BattleState {
  const held = (speciesId: string, item?: string | null): string | undefined =>
    item === null ? undefined : (item ?? stoneOf(speciesId));
  const playerItem = held(playerSpeciesId, playerHeldItem);
  const enemyItem = held(enemySpeciesId, enemyHeldItem);
  return createBattle({
    player: [
      createFighter({
        id: 'player',
        speciesId: playerSpeciesId,
        level: 40,
        nature: 'serious',
        moves: ['shadowball'],
        ...(playerItem ? { heldItem: playerItem } : {}),
      }),
    ],
    enemy: [
      createFighter({
        id: 'enemy',
        speciesId: enemySpeciesId,
        level: 40,
        nature: 'serious',
        moves: ['tackle'],
        ...(enemyItem ? { heldItem: enemyItem } : {}),
      }),
    ],
    rng: new Rng(2026),
    isWild: true,
  });
}

describe('canGigantamax', () => {
  it('is stone-gated: only the holder of the matching G-Max Stone may', () => {
    expect(canGigantamax(battle('gengar'), 'player')).toBe(true);
    expect(canGigantamax(battle('charizard'), 'player')).toBe(true);

    expect(canGigantamax(battle('gengar', null), 'player')).toBe(false);
    expect(canGigantamax(battle('gengar', 'gengarite'), 'player')).toBe(false);
    expect(canGigantamax(battle('gengar', 'venusauriteg'), 'player')).toBe(false);
    expect(canGigantamax(battle('gengar', 'leftovers'), 'player')).toBe(false);
    expect(canGigantamax(battle('bulbasaur', 'venusauriteg'), 'player')).toBe(false);
    expect(canGigantamax(battle('bulbasaur'), 'player')).toBe(false);
    expect(canGigantamax(battle('gengarmega'), 'player')).toBe(false);
    expect(canGigantamax(battle('gengargmax'), 'player')).toBe(false);

    expect(canGigantamax(battle('bulbasaur', null, 'gengar'), 'enemy')).toBe(true);
    expect(canGigantamax(battle('bulbasaur', null, 'charmander'), 'enemy')).toBe(false);
  });

  it('needs the stone, unlike the species alone', () => {
    const state = battle('gengar');
    expect(activeFighter(state, 'player').heldItem).toBe('gengariteg');
    expect(canGigantamax(state, 'player')).toBe(true);

    const bare = battle('gengar', null);
    expect(activeFighter(bare, 'player').heldItem).toBeNull();
    expect(canGigantamax(bare, 'player')).toBe(false);
  });

  it('is false for a fainted holder and once it has Gigantamaxed', () => {
    const state = battle('gengar');
    activeFighter(state, 'player').hp = 0;
    expect(canGigantamax(state, 'player')).toBe(false);

    const spent = battle('gengar');
    expect(gigantamax(spent, 'player')).toBe(true);
    expect(canGigantamax(spent, 'player')).toBe(false);
  });

  it('is false for a Mega-Evolved holder', () => {
    // One item can no longer reach this state (a holder carries one stone, and
    // the stone that arms the Mega is not the G-Max one), so the mutual-exclusion
    // flag is pinned directly.
    const evolved = battle('gengar');
    activeFighter(evolved, 'player').mega = true;
    expect(canGigantamax(evolved, 'player')).toBe(false);
    expect(gigantamax(evolved, 'player')).toBe(false);
    expect(activeFighter(evolved, 'player').speciesId).toBe('gengar');
  });
});

describe('gigantamax', () => {
  it('takes the forme name and species, keeps the rest, and doubles the pool', () => {
    const state = battle('gengar');
    const fighter = activeFighter(state, 'player');
    const before = {
      hp: fighter.hp,
      maxHp: fighter.maxHp,
      ability: fighter.ability,
      types: [...fighter.types],
      moves: fighter.moves.map((slot) => ({ ...slot })),
    };

    expect(gigantamax(state, 'player')).toBe(true);
    expect(fighter.gmax).toBe(true);
    expect(fighter.speciesId).toBe('gengargmax');
    expect(fighter.name).toBe('Gengar-Gmax');
    expect(fighter.ability).toBe(before.ability);
    expect(fighter.types).toEqual(before.types);
    expect(fighter.moves).toEqual(before.moves);
    expect(fighter.heldItem).toBe('gengariteg');
    expect(fighter.maxHp).toBe(before.maxHp * GMAX_HP_MULTIPLIER);
    expect(fighter.hp).toBe(before.hp * GMAX_HP_MULTIPLIER);
    expect(fighter.stats.hp).toBe(fighter.maxHp);
    expect(state.log).toContainEqual({ kind: 'gmax', side: 'player', fighterId: 'player' });
    expect(state.log).toContainEqual({
      kind: 'text',
      key: 'battle.log.gigantamaxed',
      params: { name: 'Gengar' },
    });
  });

  it('is once per battle, and changes nothing without the stone', () => {
    const state = battle('gengar');
    expect(gigantamax(state, 'player')).toBe(true);
    const doubled = activeFighter(state, 'player').hp;
    expect(gigantamax(state, 'player')).toBe(false);
    expect(activeFighter(state, 'player').hp).toBe(doubled);
    expect(state.log.filter((event) => event.kind === 'gmax')).toHaveLength(1);

    for (const item of [null, 'gengarite', 'venusauriteg', 'leftovers'] as const) {
      const refused = battle('gengar', item);
      const fighter = activeFighter(refused, 'player');
      const pool = fighter.maxHp;
      expect(gigantamax(refused, 'player'), String(item)).toBe(false);
      expect(fighter.speciesId, String(item)).toBe('gengar');
      expect(fighter.gmax, String(item)).toBe(false);
      expect(fighter.maxHp, String(item)).toBe(pool);
      expect(
        refused.log.filter((event) => event.kind === 'gmax'),
        String(item),
      ).toEqual([]);
    }

    const plain = battle('bulbasaur');
    expect(gigantamax(plain, 'player')).toBe(false);
    expect(activeFighter(plain, 'player').speciesId).toBe('bulbasaur');
    expect(plain.log.filter((event) => event.kind === 'gmax')).toEqual([]);
  });

  it('leaves the stone in the holder: it is never spent on use', () => {
    const state = battle('gengar');
    expect(gigantamax(state, 'player')).toBe(true);
    const snapshot = snapshotFighter(activeFighter(state, 'player'));
    expect(snapshot.speciesId).toBe('gengar');
    expect(snapshot.heldItem).toBe('gengariteg');
    expect(revertGigantamax(activeFighter(state, 'player'))).toBe(true);
    expect(activeFighter(state, 'player').heldItem).toBe('gengariteg');
  });

  it('reverts to the base shape with a base-sized pool', () => {
    const state = battle('gengar');
    const fighter = activeFighter(state, 'player');
    const basePool = fighter.maxHp;
    expect(gigantamax(state, 'player')).toBe(true);
    expect(fighter.maxHp).toBe(basePool * GMAX_HP_MULTIPLIER);

    expect(revertGigantamax(fighter)).toBe(true);
    expect(fighter.gmax).toBe(false);
    expect(fighter.speciesId).toBe('gengar');
    expect(fighter.name).toBe('Gengar');
    expect(fighter.maxHp).toBe(basePool);
    expect(fighter.stats.hp).toBe(basePool);
    expect(fighter.hp).toBeLessThanOrEqual(basePool);

    const snapshot = snapshotFighter(fighter);
    expect(snapshot.speciesId).toBe('gengar');
    expect(snapshot.hp).toBeLessThanOrEqual(basePool);
    expect(revertGigantamax(fighter)).toBe(false);
  });
});

describe('the two battle-only formes exclude each other (D44)', () => {
  it('leaves the G-Max forme in place when a Mega is commanded after it', () => {
    const state = battle('gengar');
    expect(gigantamax(state, 'player')).toBe(true);
    expect(canMegaEvolve(state, 'player')).toBe(false);
    expect(megaEvolve(state, 'player')).toBe(false);
    expect(activeFighter(state, 'player').speciesId).toBe('gengargmax');
  });

  it('lets one stone arm only its own forme, never both', () => {
    const megaStone = battle('gengar', 'gengarite');
    expect(canMegaEvolve(megaStone, 'player')).toBe(true);
    expect(canGigantamax(megaStone, 'player')).toBe(false);
    expect(megaEvolve(megaStone, 'player')).toBe(true);
    expect(activeFighter(megaStone, 'player').speciesId).toBe('gengarmega');
    expect(canGigantamax(megaStone, 'player')).toBe(false);

    const gmaxStone = battle('gengar');
    expect(canGigantamax(gmaxStone, 'player')).toBe(true);
    expect(canMegaEvolve(gmaxStone, 'player')).toBe(false);
  });
});

describe('the gmax flag on a fight command', () => {
  it('is refused without the stone', () => {
    const state = battle('gengar', null);
    expect(validateCommand(state, 'player', { type: 'fight', moveIndex: 0, gmax: true })).toBe(
      'That Pokémon cannot Gigantamax.',
    );
  });

  it('is refused for a species with no G-Max forme', () => {
    const state = battle('bulbasaur');
    expect(validateCommand(state, 'player', { type: 'fight', moveIndex: 0, gmax: true })).toBe(
      'That Pokémon cannot Gigantamax.',
    );
  });

  it('is accepted while the forme is still available', () => {
    const state = battle('gengar');
    expect(validateCommand(state, 'player', { type: 'fight', moveIndex: 0, gmax: true })).toBeNull();
    expect(validateCommand(state, 'player', { type: 'fight', moveIndex: 0 })).toBeNull();
  });

  it('resolves on the turn it is commanded, before the move', () => {
    const state = battle('gengar');
    const basePool = activeFighter(state, 'player').maxHp;
    takeTurn(state, { type: 'fight', moveIndex: 0, gmax: true }, chooseAiCommand(state, 'enemy'));
    const fighter = activeFighter(state, 'player');
    expect(fighter.speciesId).toBe('gengargmax');
    expect(fighter.maxHp).toBe(basePool * GMAX_HP_MULTIPLIER);
    expect(state.log.some((event) => event.kind === 'move' && event.side === 'player')).toBe(true);
  });
});

describe('the AI spends the Gigantamax', () => {
  it('marks its first fight command with gmax when its holder carries the stone', () => {
    const state = battle('bulbasaur', null, 'gengar');
    expect(activeFighter(state, 'enemy').heldItem).toBe('gengariteg');
    expect(chooseAiCommand(state, 'enemy')).toEqual({
      type: 'fight',
      moveIndex: expect.any(Number),
      gmax: true,
    });
  });

  it('leaves the command plain without the stone', () => {
    const state = battle('bulbasaur', null, 'gengar', null);
    expect(chooseAiCommand(state, 'enemy')).toEqual({
      type: 'fight',
      moveIndex: expect.any(Number),
    });
  });

  it('arms the Mega Stone, not the forme, when its holder carries a Mega Stone', () => {
    const state = battle('bulbasaur', null, 'gengar', 'gengarite');
    expect(canMegaEvolve(state, 'enemy')).toBe(true);
    expect(canGigantamax(state, 'enemy')).toBe(false);
    expect(chooseAiCommand(state, 'enemy')).toEqual({
      type: 'fight',
      moveIndex: expect.any(Number),
      mega: true,
    });
  });
});

describe('the fixed-seed Gigantamax regression (D11)', () => {
  // The spec pins a policy that returns `gmax: true` on every turn. The flag is
  // spent on the first turn, so from the second on it would be a refused command —
  // `validateCommand` says 'That Pokémon cannot Gigantamax.' and `takeTurn` throws
  // on a refused command — and a fixed `moveIndex: 0` runs out of PP in a battle
  // that lasts longer than the slot's PP. The pinned team, stone, seed and levels
  // are kept, `moveIndex: 0` is kept while it is a legal index, and the flag is
  // armed while `canGigantamax` still allows it: the command shape the scene sends.
  const run = (): BattleState =>
    scriptedBattle({
      player: [{ id: 'player', speciesId: 'gengar', level: 30, heldItem: 'gengariteg' }],
      enemy: [{ id: 'enemy', speciesId: 'bulbasaur', level: 18 }],
      seed: 2026,
      playerCommand: (state: BattleState) => {
        const legal = legalMoveIndices(activeFighter(state, 'player'));
        return {
          type: 'fight',
          moveIndex: legal.includes(0) || legal.length === 0 ? 0 : legal[0],
          ...(canGigantamax(state, 'player') ? { gmax: true } : {}),
        };
      },
    });

  it('refuses a flag that was already spent (the frozen once-per-battle rule)', () => {
    expect(() =>
      scriptedBattle({
        player: [{ id: 'player', speciesId: 'gengar', level: 30, heldItem: 'gengariteg' }],
        enemy: [{ id: 'enemy', speciesId: 'bulbasaur', level: 18 }],
        seed: 2026,
        playerCommand: () => ({ type: 'fight', moveIndex: 0, gmax: true }),
      }),
    ).toThrow('That Pokémon cannot Gigantamax.');
  });

  it('reproduces the same log on a second run', () => {
    expect(formatBattleLog(run())).toBe(formatBattleLog(run()));
  });

  it('Gigantamaxes exactly once, whatever the turn count', () => {
    const log = formatBattleLog(run());
    expect(log.split('\n').filter((line) => line === '  = player gmax player')).toHaveLength(1);
    expect(log.split('\n').filter((line) => line.startsWith('# turn ')).length).toBeGreaterThan(1);
  });
});
