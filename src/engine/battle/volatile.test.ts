import { describe, expect, it, vi } from 'vitest';
import { Rng } from '../rng';
import './effects/items';
import { makeContext, runModifyTrapDamage } from './effects/registry';
import { createFighter } from './fighter';
import { activeFighter, createBattle, type BattleState } from './state';
import {
  absorbWithSubstitute,
  applyConfusion,
  applyDisable,
  applyEmbargo,
  applyFlinch,
  applyLeechSeed,
  applyNightmare,
  applyNoRetreat,
  applyOctolock,
  applyPartialTrap,
  applyQuash,
  applyTaunt,
  applyTelekinesis,
  beforeMoveVolatile,
  endOfTurnVolatile,
  hasSubstitute,
  leechSeedDamage,
  makeSubstitute,
  nightmareDamage,
  PARTIAL_TRAP_FRACTION,
  PARTIAL_TRAP_TURNS,
  RESIDUAL_VOLATILES,
  tickPartialTrap,
  tickPerish,
} from './volatile';

const make = (speciesId = 'charmander', level = 20) =>
  createFighter({ id: speciesId, speciesId, level });

describe('confusion', () => {
  it('lasts 2-5 turns and snaps out at zero', () => {
    const fighter = make();
    expect(applyConfusion(fighter, new Rng(3))).toBe(true);
    expect(fighter.volatiles.confusion).toBeGreaterThanOrEqual(2);
    expect(fighter.volatiles.confusion).toBeLessThanOrEqual(5);
    expect(applyConfusion(fighter, new Rng(3))).toBe(false);
    fighter.volatiles.confusion = 1;
    expect(beforeMoveVolatile(fighter, new Rng(1))).toEqual({ confusionEnded: true });
  });

  it('clears flinch once consumed', () => {
    const fighter = make();
    applyFlinch(fighter);
    expect(beforeMoveVolatile(fighter, new Rng(1))).toEqual({ flinched: true });
    expect(fighter.volatiles.flinched).toBe(false);
  });
});

describe('leech seed', () => {
  it('drains an eighth of max HP', () => {
    const fighter = make();
    expect(applyLeechSeed(fighter)).toBe(true);
    expect(applyLeechSeed(fighter)).toBe(false);
    expect(leechSeedDamage(fighter)).toBe(Math.max(1, Math.floor(fighter.maxHp / 8)));
  });
});

describe('substitute', () => {
  it('costs a quarter of max HP and absorbs damage', () => {
    const fighter = make();
    const cost = makeSubstitute(fighter);
    expect(cost).toBe(Math.max(1, Math.floor(fighter.maxHp / 4)));
    expect(fighter.hp).toBe(fighter.maxHp - cost);
    expect(hasSubstitute(fighter)).toBe(true);

    expect(absorbWithSubstitute(fighter, cost - 1)).toBe(true);
    expect(hasSubstitute(fighter)).toBe(true);
    absorbWithSubstitute(fighter, 2);
    expect(hasSubstitute(fighter)).toBe(false);
  });

  it('fails when too low to pay the cost', () => {
    const fighter = make();
    fighter.hp = 1;
    expect(makeSubstitute(fighter)).toBe(0);
  });
});

describe('timed volatiles', () => {
  it('counts perish down and clears taunt at end of turn', () => {
    const fighter = make();
    fighter.volatiles.perish = 1;
    expect(tickPerish(fighter)).toBe(true);
    applyTaunt(fighter);
    endOfTurnVolatile(fighter);
    expect(fighter.volatiles.taunt).toBe(2);
  });
});

describe('the status-half volatiles', () => {
  it('Disable locks a move for four turns and clears the lock at zero', () => {
    const fighter = make();
    expect(applyDisable(fighter, 'tackle')).toBe(true);
    expect(applyDisable(fighter, 'growl')).toBe(false);
    expect(fighter.volatiles.disabledMove).toBe('tackle');
    expect(fighter.volatiles.disableTurns).toBe(4);
    for (let pass = 0; pass < 4; pass++) endOfTurnVolatile(fighter);
    expect(fighter.volatiles.disabledMove).toBeNull();
  });

  it('Telekinesis and Embargo tick down each pass while Quash lasts one turn', () => {
    const fighter = make();
    applyTelekinesis(fighter);
    applyEmbargo(fighter);
    applyQuash(fighter);
    expect(fighter.volatiles.telekinesis).toBe(3);
    expect(fighter.volatiles.embargo).toBe(5);
    endOfTurnVolatile(fighter);
    expect(fighter.volatiles.telekinesis).toBe(2);
    expect(fighter.volatiles.embargo).toBe(4);
    expect(fighter.volatiles.quash).toBe(false);
  });

  it('Nightmare only chips a sleeping holder', () => {
    const fighter = make();
    applyNightmare(fighter);
    expect(nightmareDamage(fighter)).toBe(0);
    fighter.status = 'slp';
    expect(nightmareDamage(fighter)).toBe(Math.max(1, Math.floor(fighter.maxHp / 4)));
  });

  it('Octolock and No Retreat trap their holder', () => {
    const octolocked = make();
    expect(applyOctolock(octolocked)).toBe(true);
    expect(octolocked.volatiles.trapped).toBe(true);
    expect(applyOctolock(octolocked)).toBe(false);

    const vowed = make();
    expect(applyNoRetreat(vowed)).toBe(true);
    expect(vowed.volatiles.trapped).toBe(true);
  });
});

/** A battle whose enemy lead holds `heldItem`, so the residual context has a board. */
function trapBoard(heldItem?: string): BattleState {
  return createBattle({
    player: [createFighter({ id: 'player', speciesId: 'charmander', level: 20, moves: ['tackle'] })],
    enemy: [
      createFighter({
        id: 'enemy',
        speciesId: 'squirtle',
        level: 20,
        moves: ['splash'],
        ...(heldItem ? { heldItem } : {}),
      }),
    ],
    rng: new Rng(1),
    isWild: true,
  });
}

describe('partial trapping', () => {
  it('draws 4-5 turns from the battle stream, in exactly one draw', () => {
    const four = make();
    const fourRng = new Rng(7);
    const draws = vi.spyOn(fourRng, 'next');
    expect(applyPartialTrap(four, 'bind', fourRng)).toBe(true);
    expect(four.volatiles.partiallyTrapped).toEqual({ turns: 4, moveId: 'bind' });
    expect(draws).toHaveBeenCalledTimes(1);

    const five = make();
    applyPartialTrap(five, 'wrap', new Rng(1));
    expect(five.volatiles.partiallyTrapped).toEqual({ turns: 5, moveId: 'wrap' });

    expect(PARTIAL_TRAP_TURNS).toEqual({ min: 4, max: 5 });
  });

  it('pays an eighth of max HP, and a sixth through Binding Band', () => {
    expect(RESIDUAL_VOLATILES).toContain('partiallytrapped');
    expect(PARTIAL_TRAP_FRACTION).toBe(8);

    const bare = trapBoard();
    const victim = activeFighter(bare, 'enemy');
    expect(victim.maxHp).toBe(53);
    const base = Math.max(1, Math.floor(victim.maxHp / PARTIAL_TRAP_FRACTION));
    expect(base).toBe(6);
    const bareCtx = makeContext(bare, 'enemy', {
      source: victim,
      target: activeFighter(bare, 'player'),
    });
    expect(runModifyTrapDamage(bareCtx, base)).toBe(6);

    const banded = trapBoard('bindingband');
    const bandedVictim = activeFighter(banded, 'enemy');
    expect(bandedVictim.maxHp).toBe(53);
    const bandedCtx = makeContext(banded, 'enemy', {
      source: bandedVictim,
      target: activeFighter(banded, 'player'),
    });
    expect(runModifyTrapDamage(bandedCtx, base)).toBe(8);
  });

  it('counts four ticks down and releases the trap at zero', () => {
    const fighter = make();
    applyPartialTrap(fighter, 'bind', new Rng(7));
    expect(tickPartialTrap(fighter)).toBe(3);
    expect(tickPartialTrap(fighter)).toBe(2);
    expect(tickPartialTrap(fighter)).toBe(1);
    expect(fighter.volatiles.trapped).toBe(true);
    expect(tickPartialTrap(fighter)).toBe(0);
    expect(fighter.volatiles.partiallyTrapped).toBeNull();
    expect(fighter.volatiles.trapped).toBe(false);
    expect(tickPartialTrap(fighter)).toBe(0);
  });

  it('keeps the holder trapped while Octolock or No Retreat still holds it', () => {
    const octolocked = make();
    applyOctolock(octolocked);
    applyPartialTrap(octolocked, 'bind', new Rng(7));
    for (let tick = 0; tick < 4; tick++) tickPartialTrap(octolocked);
    expect(octolocked.volatiles.partiallyTrapped).toBeNull();
    expect(octolocked.volatiles.trapped).toBe(true);

    const vowed = make();
    applyNoRetreat(vowed);
    applyPartialTrap(vowed, 'sandtomb', new Rng(7));
    for (let tick = 0; tick < 4; tick++) tickPartialTrap(vowed);
    expect(vowed.volatiles.partiallyTrapped).toBeNull();
    expect(vowed.volatiles.trapped).toBe(true);
  });

  it('replaces a trap already holding the fighter instead of stacking', () => {
    const fighter = make();
    applyPartialTrap(fighter, 'bind', new Rng(1));
    expect(fighter.volatiles.partiallyTrapped).toEqual({ turns: 5, moveId: 'bind' });
    tickPartialTrap(fighter);
    tickPartialTrap(fighter);
    expect(fighter.volatiles.partiallyTrapped).toEqual({ turns: 3, moveId: 'bind' });

    applyPartialTrap(fighter, 'wrap', new Rng(7));
    expect(fighter.volatiles.partiallyTrapped).toEqual({ turns: 4, moveId: 'wrap' });
  });
});
