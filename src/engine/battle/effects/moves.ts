import type { Move } from '../../../data/dex';
import { applyDamage, moveContacts, transformInto, type BoostId, type StatusId } from '../fighter';
import {
  activeFighter,
  effectiveWeather,
  opponent,
  pushEvent,
  pushText,
  type BattleState,
  type SideId,
} from '../state';
import { applyBoostEffect, applyStatusEffect } from './apply';
import {
  registerEffects,
  type EffectContext,
  type EffectDefinition,
  type EffectHandlers,
} from './registry';

export type ProtectPunish = Readonly<{
  contactBoosts?: Partial<Record<BoostId, number>>;
  contactStatus?: StatusId;
  contactDamageDenominator?: number;
}>;

const PROTECT_MOVES: Readonly<Record<string, ProtectPunish>> = {
  protect: {},
  detect: {},
  spikyshield: { contactDamageDenominator: 8 },
  banefulbunker: { contactStatus: 'psn' },
  burningbulwark: { contactStatus: 'brn' },
  silktrap: { contactBoosts: { spe: -1 } },
};

const FOE_TARGETS = new Set(['normal', 'any', 'adjacentFoe']);

export function isProtectMove(moveId: string): boolean {
  return moveId in PROTECT_MOVES;
}

/**
 * True when the opponent's active protection stops `move`. Handles the block
 * message and any contact punishment (Spiky Shield damage, Baneful Bunker...).
 */
export function protectBlocks(state: BattleState, side: SideId, move: Move): boolean {
  const attacker = activeFighter(state, side);
  const defender = opponent(state, side);
  const protectMove = defender.volatiles.protect;
  if (!protectMove) return false;
  if (!move.flags.protect) return false;
  if (!FOE_TARGETS.has(move.target)) return false;

  // Unseen Fist lets contact moves break through protection (unless suppressed).
  if (
    attacker.ability === 'Unseen Fist' &&
    defender.ability !== 'Neutralizing Gas' &&
    moveContacts(attacker, move)
  ) {
    pushText(state, `${attacker.name} broke through the protection!`);
    return false;
  }

  pushText(state, `${defender.name} protected itself!`);
  const punish = PROTECT_MOVES[protectMove];
  if (!punish || !moveContacts(attacker, move) || state.winner !== null) return true;

  if (punish.contactBoosts) {
    applyBoostEffect(state, side, attacker, punish.contactBoosts);
  }
  if (punish.contactStatus) {
    applyStatusEffect(state, side, attacker, punish.contactStatus, `${attacker.name} was hurt by the protection!`);
  }
  if (punish.contactDamageDenominator) {
    const dealt = applyDamage(attacker, Math.max(1, Math.floor(attacker.maxHp / punish.contactDamageDenominator)));
    pushEvent(state, { kind: 'damage', side, amount: dealt, hp: attacker.hp, maxHp: attacker.maxHp, effectiveness: 1, crit: false });
    pushText(state, `${attacker.name} was hurt by the protection!`);
  }
  return true;
}

function protectEffect(moveId: string): EffectHandlers {
  return {
    onAfterMove: (ctx) => {
      if (ctx.owner !== ctx.source) return;
      const fighter = ctx.owner;
      const chance = 1 / 3 ** fighter.volatiles.protectStreak;
      if (ctx.rng.next() < chance) {
        fighter.volatiles.protect = moveId;
        fighter.volatiles.protectStreak += 1;
        pushText(ctx.state, `${fighter.name} protected itself!`);
      } else {
        fighter.volatiles.protectStreak = 0;
        pushText(ctx.state, `${fighter.name}'s protection failed!`);
      }
    },
  };
}

function recycleEffect(): EffectHandlers {
  return {
    onAfterMove: (ctx) => {
      if (ctx.owner !== ctx.source) return;
      const fighter = ctx.owner;
      if (!fighter.lastItemId || fighter.heldItem) {
        pushText(ctx.state, 'But it failed!');
        return;
      }
      const itemId = fighter.lastItemId;
      fighter.heldItem = itemId;
      fighter.lastItemId = null;
      pushText(ctx.state, `${fighter.name} recycled its item!`);
    },
  };
}

/** Transform copies the target's battle shape; Imposter runs the same routine. */
function transformEffect(): EffectHandlers {
  return {
    onAfterMove: (ctx) => {
      if (ctx.owner !== ctx.source || !ctx.target) return;
      const userName = ctx.owner.name;
      const targetName = ctx.target.name;
      if (transformInto(ctx.owner, ctx.target)) {
        pushText(ctx.state, `${userName} transformed into ${targetName}!`);
      } else {
        pushText(ctx.state, 'But it failed!');
      }
    },
  };
}

/**
 * Moves whose type follows the battle situation rather than the dex: Weather
 * Ball reads the weather, Terrain Pulse the terrain, Revelation Dance the user's
 * primary type and Aura Wheel the user's Morpeko form. Registered as move effects
 * so their `onModifyMoveType` reaches both the damage calc and the FIGHT menu's
 * preview; items that retype a move (Plates, Drives, Memories) are not in this
 * build's catalogue, so Judgment and friends keep their dexed type.
 */
const VARIABLE_TYPE_MOVES: Readonly<Record<string, (ctx: EffectContext) => string>> = {
  weatherball: (ctx) => {
    switch (effectiveWeather(ctx.state)) {
      case 'sun':
        return 'Fire';
      case 'rain':
        return 'Water';
      case 'sand':
        return 'Rock';
      case 'snow':
        return 'Ice';
      default:
        return 'Normal';
    }
  },
  terrainpulse: (ctx) => {
    switch (ctx.state.terrain) {
      case 'electric':
        return 'Electric';
      case 'grassy':
        return 'Grass';
      case 'misty':
        return 'Fairy';
      case 'psychic':
        return 'Psychic';
      default:
        return 'Normal';
    }
  },
  revelationdance: (ctx) => ctx.source.types[0] ?? 'Normal',
  aurawheel: (ctx) => (ctx.source.speciesId === 'morpekohangry' ? 'Dark' : 'Electric'),
};

function variableTypeEffect(typeFor: (ctx: EffectContext) => string): EffectHandlers {
  return {
    onModifyMoveType: (ctx, move) => {
      if (ctx.owner !== ctx.source) return;
      const type = typeFor(ctx);
      return type === move.type ? undefined : type;
    },
  };
}

export function moveEffects(): readonly EffectDefinition[] {
  const defs: EffectDefinition[] = Object.keys(PROTECT_MOVES).map((moveId) => ({
    id: moveId,
    kind: 'move' as const,
    handlers: protectEffect(moveId),
  }));
  defs.push({ id: 'recycle', kind: 'move', handlers: recycleEffect() });
  defs.push({ id: 'transform', kind: 'move', handlers: transformEffect() });
  for (const [moveId, typeFor] of Object.entries(VARIABLE_TYPE_MOVES)) {
    defs.push({ id: moveId, kind: 'move', handlers: variableTypeEffect(typeFor) });
  }
  return defs;
}

export function registerMoveEffects(): void {
  registerEffects(moveEffects());
}

registerMoveEffects();
