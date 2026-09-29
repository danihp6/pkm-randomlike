import { effectiveness, getMove } from '../../../data/dex';
import { getItem } from '../../../data/items';
import { applyDamage, applyHeal, isGrounded, stagedStat, type BattleFighter, type BoostId, type StatusId } from '../fighter';
import { cureStatus, statusName } from '../status';
import { opponentOf, pushEvent, pushText, type WeatherId } from '../state';
import { applyFlinch, applyConfusion } from '../volatile';
import { applyBoostEffect, applyStatusEffect, statLabel } from './apply';
import { setTerrain } from './terrain';
import { setWeather } from './weather';
import {
  registerEffects,
  runTryVolatile,
  runModifyPriority,
  runStart,
  runSwitchIn,
  makeContext,
  type DamagePayload,
  type EffectContext,
  type EffectDefinition,
  type EffectHandlers,
  type MovePayload,
} from './registry';

function intimidate(): EffectHandlers {
  return {
    onSwitchIn: (ctx) => {
      const foe = ctx.target;
      if (!foe || foe.hp <= 0) return;
      if (foe.ability === 'Inner Focus') {
        pushText(ctx.state, `${foe.name}'s Inner Focus prevents it from being intimidated!`);
        return;
      }
      if (foe.ability === 'Scrappy') {
        pushText(ctx.state, `${foe.name}'s Scrappy prevents it from being intimidated!`);
        return;
      }
      if (foe.ability === 'Guard Dog') {
        applyBoostEffect(ctx.state, opponentOf(ctx.side), foe, { atk: 1 }, {
          self: true,
          message: `${foe.name}'s Guard Dog raised its Attack!`,
        });
        return;
      }
      applyBoostEffect(ctx.state, opponentOf(ctx.side), foe, { atk: -1 }, {
        message: `${ctx.owner.name}'s Intimidate cut ${foe.name}'s Attack!`,
      });
      if (foe.ability === 'Rattled') {
        applyBoostEffect(ctx.state, opponentOf(ctx.side), foe, { spe: 1 }, {
          self: true,
          message: `${foe.name}'s Rattled raised its Speed!`,
        });
      }
    },
  };
}

function levitate(): EffectHandlers {
  return {
    onTryHit: (ctx, payload) => {
      if (ctx.owner !== ctx.target) return;
      if (payload.move.type !== 'Ground') return;
      pushText(ctx.state, `${ctx.owner.name} avoided the attack with Levitate!`);
      return false;
    },
  };
}

/** Sturdy: an attack cannot bring the holder from full HP straight to 0. */
function sturdy(): EffectHandlers {
  return {
    onModifyDamage: (ctx, payload) => {
      if (ctx.owner !== ctx.target) return;
      const holder = ctx.owner;
      if (holder.hp !== holder.maxHp) return;
      if (holder.volatiles.substitute > 0) return;
      if (payload.damage < holder.hp) return;
      pushText(ctx.state, `${holder.name} endured the hit with Sturdy!`);
      return Math.max(1, holder.hp - 1);
    },
  };
}

function statusImmunity(ability: string, blocked: readonly StatusId[]): EffectHandlers {
  return {
    onStatus: (ctx, payload) => {
      if (ctx.owner !== ctx.source) return;
      if (!blocked.includes(payload.status as StatusId)) return;
      pushText(
        ctx.state,
        `${ctx.owner.name}'s ${ability} prevents ${statusName(payload.status as StatusId)}!`,
      );
      return false;
    },
  };
}

/** Contact punish abilities: 30% to inflict a status on the attacker. */
function contactStatus(ability: string, status: StatusId): EffectHandlers {
  return {
    onAfterMove: (ctx, payload) => {
      if (ctx.owner !== ctx.target) return;
      const attacker = ctx.source;
      if (!payload.contact || !payload.hit) return;
      if (ctx.owner.hp <= 0 || attacker.hp <= 0) return;
      if (ctx.owner.volatiles.substitute > 0) return;
      if (ctx.rng.int(1, 100) > 30) return;
      applyStatusEffect(ctx.state, ctx.side, attacker, status, `${attacker.name} was hurt by ${ability}!`);
    },
  };
}

function pinchBoost(type: string): EffectHandlers {
  return {
    onModifyDamage: (ctx, payload) => {
      if (ctx.owner !== ctx.source) return;
      if (payload.move.type !== type) return;
      if (ctx.owner.hp * 3 > ctx.owner.maxHp) return;
      return Math.max(1, Math.floor(payload.damage * 1.5));
    },
  };
}

/** Guts ignores the burn Attack drop, so the burned multiplier replaces it. */
function guts(): EffectHandlers {
  return {
    onModifyDamage: (ctx, payload) => {
      if (ctx.owner !== ctx.source) return;
      if (payload.move.category !== 'Physical') return;
      if (!ctx.owner.status) return;
      const multiplier = ctx.owner.status === 'brn' ? 3 : 1.5;
      return Math.max(1, Math.floor(payload.damage * multiplier));
    },
  };
}

function technician(): EffectHandlers {
  return {
    onModifyDamage: (ctx, payload) => {
      if (ctx.owner !== ctx.source) return;
      if (payload.move.basePower <= 0 || payload.move.basePower > 60) return;
      return Math.max(1, Math.floor(payload.damage * 1.5));
    },
  };
}

function statGuard(stats: readonly BoostId[] | 'all'): EffectHandlers {
  return {
    onBoost: (ctx, payload) => {
      if (ctx.owner !== ctx.source) return;
      if (payload.self || payload.stages >= 0) return;
      if (stats !== 'all' && !stats.includes(payload.stat)) return;
      pushText(
        ctx.state,
        `${ctx.owner.name}'s ${ctx.owner.ability} prevents its ${statLabel(payload.stat)} from being lowered!`,
      );
      return false;
    },
  };
}

function shedSkin(): EffectHandlers {
  return {
    onResidual: (ctx) => {
      const holder = ctx.owner;
      if (holder.hp <= 0 || !holder.status) return;
      if (ctx.rng.next() >= 0.3) return;
      const cured = cureStatus(holder);
      if (!cured) return;
      pushEvent(ctx.state, { kind: 'cure', side: ctx.side, status: cured });
      pushText(ctx.state, `${holder.name} shed its skin and was cured!`);
    },
  };
}

function healHolder(ctx: EffectContext, denominator: number): void {
  const healed = applyHeal(ctx.owner, Math.max(1, Math.floor(ctx.owner.maxHp / denominator)));
  if (healed > 0) {
    pushEvent(ctx.state, {
      kind: 'heal',
      side: ctx.side,
      amount: healed,
      hp: ctx.owner.hp,
      maxHp: ctx.owner.maxHp,
    });
  }
}

function damageHolder(ctx: EffectContext, denominator: number): void {
  const dealt = applyDamage(ctx.owner, Math.max(1, Math.floor(ctx.owner.maxHp / denominator)));
  pushEvent(ctx.state, {
    kind: 'damage',
    side: ctx.side,
    amount: dealt,
    hp: ctx.owner.hp,
    maxHp: ctx.owner.maxHp,
    effectiveness: 1,
    crit: false,
  });
}

/** The absorb abilities: immune to a type, optionally healing or boosting. */
function typeImmunity(
  ability: string,
  type: string,
  effect: { healQuarter?: boolean; boost?: Partial<Record<BoostId, number>> } = {},
): EffectHandlers {
  return {
    onTryHit: (ctx, payload) => {
      if (ctx.owner !== ctx.target) return;
      if (payload.move.type !== type) return;
      pushText(ctx.state, `${ctx.owner.name}'s ${ability} absorbed the attack!`);
      if (effect.healQuarter) {
        const healed = applyHeal(ctx.owner, Math.max(1, Math.floor(ctx.owner.maxHp / 4)));
        if (healed > 0) {
          pushEvent(ctx.state, {
            kind: 'heal',
            side: opponentOf(ctx.side),
            amount: healed,
            hp: ctx.owner.hp,
            maxHp: ctx.owner.maxHp,
          });
        }
      }
      if (effect.boost) {
        applyBoostEffect(ctx.state, opponentOf(ctx.side), ctx.owner, effect.boost, { self: true });
      }
      return false;
    },
  };
}

function drySkin(): EffectHandlers {
  return {
    ...typeImmunity('Dry Skin', 'Water', { healQuarter: true }),
    onModifyDamage: (ctx, payload) => {
      if (ctx.owner !== ctx.target) return;
      if (payload.move.type !== 'Fire') return;
      return Math.max(1, Math.floor(payload.damage * 1.25));
    },
    onResidual: (ctx) => {
      if (ctx.owner.hp <= 0) return;
      if (ctx.state.weather === 'rain') {
        healHolder(ctx, 8);
        pushText(ctx.state, `${ctx.owner.name} absorbed water with Dry Skin!`);
      } else if (ctx.state.weather === 'sun') {
        damageHolder(ctx, 8);
        pushText(ctx.state, `${ctx.owner.name} was hurt by the harsh sunlight!`);
      }
    },
  };
}

function incomingMultiplier(
  multiplier: number,
  predicate: (ctx: EffectContext, payload: DamagePayload) => boolean,
): EffectHandlers {
  return {
    onModifyDamage: (ctx, payload) => {
      if (ctx.owner !== ctx.target) return;
      if (!predicate(ctx, payload)) return;
      return Math.max(1, Math.floor(payload.damage * multiplier));
    },
  };
}

function outgoingMultiplier(
  multiplier: number,
  predicate: (payload: DamagePayload) => boolean,
): EffectHandlers {
  return {
    onModifyDamage: (ctx, payload) => {
      if (ctx.owner !== ctx.source) return;
      if (!predicate(payload)) return;
      return Math.max(1, Math.floor(payload.damage * multiplier));
    },
  };
}

function switchInBoost(boosts: Partial<Record<BoostId, number>>): EffectHandlers {
  return {
    onSwitchIn: (ctx) => {
      if (ctx.owner.hp <= 0) return;
      applyBoostEffect(ctx.state, ctx.side, ctx.owner, boosts, { self: true });
    },
  };
}

function koBoost(boosts: Partial<Record<BoostId, number>>): EffectHandlers {
  return {
    onAfterMove: (ctx, payload) => {
      if (ctx.owner !== ctx.source) return;
      if (!ctx.target || ctx.target.hp > 0) return;
      if (payload.move.basePower <= 0) return;
      applyBoostEffect(ctx.state, ctx.side, ctx.owner, boosts, { self: true });
    },
  };
}

function weatherSpeed(weather: WeatherId, multiplier: number): EffectHandlers {
  return {
    onModifySpe: (ctx, speed) => {
      if (ctx.owner !== ctx.source) return;
      if (ctx.state.weather !== weather) return;
      return Math.max(1, Math.floor(speed * multiplier));
    },
  };
}

/** Quick Feet ignores the paralysis Speed drop and is 1.5x while statused. */
function quickFeet(): EffectHandlers {
  return {
    onModifySpe: (ctx) => {
      if (ctx.owner !== ctx.source) return;
      if (!ctx.owner.status) return;
      return Math.max(1, Math.floor(stagedStat(ctx.owner.stats.spe, ctx.owner.boosts.spe) * 1.5));
    },
  };
}

function scaledDamage(damage: number, ...multipliers: number[]): number {
  return Math.max(1, Math.floor(multipliers.reduce((value, factor) => value * factor, damage)));
}

function accuracyModifier(
  multiplier: number,
  applies: (ctx: EffectContext) => boolean,
): EffectHandlers {
  return {
    onModifyAccuracy: (ctx, chance) => {
      if (!applies(ctx)) return;
      return Math.min(1, chance * multiplier);
    },
  };
}

function hustle(): EffectHandlers {
  return {
    ...accuracyModifier(0.8, (ctx) => ctx.owner === ctx.source),
    onModifyDamage: (ctx, payload) => {
      if (ctx.owner !== ctx.source) return;
      if (payload.move.category !== 'Physical' || payload.move.basePower <= 0) return;
      return scaledDamage(payload.damage, 1.5);
    },
  };
}

function adaptability(): EffectHandlers {
  return {
    onModifyDamage: (ctx, payload) => {
      if (ctx.owner !== ctx.source) return;
      if (!ctx.owner.types.includes(payload.move.type)) return;
      return Math.max(1, Math.floor((payload.damage * 2) / 1.5));
    },
  };
}

function sheerForce(): EffectHandlers {
  return {
    onModifyDamage: (ctx, payload) => {
      if (ctx.owner !== ctx.source) return;
      if (payload.move.basePower <= 0) return;
      if (!payload.move.secondaries || payload.move.secondaries.length === 0) return;
      return scaledDamage(payload.damage, 1.3);
    },
  };
}

function punkRock(): EffectHandlers {
  return {
    onModifyDamage: (ctx, payload) => {
      if (!payload.move.flags.sound) return;
      if (ctx.owner === ctx.source) return scaledDamage(payload.damage, 1.3);
      if (ctx.owner === ctx.target) return scaledDamage(payload.damage, 0.5);
    },
  };
}

function waterBubble(): EffectHandlers {
  return {
    onModifyDamage: (ctx, payload) => {
      if (ctx.owner === ctx.source && payload.move.type === 'Water') return scaledDamage(payload.damage, 2);
      if (ctx.owner === ctx.target && payload.move.type === 'Fire') return scaledDamage(payload.damage, 0.5);
    },
  };
}

function fluffy(): EffectHandlers {
  return {
    onModifyDamage: (ctx, payload) => {
      if (ctx.owner !== ctx.target) return;
      let changed = false;
      let damage = payload.damage;
      if (payload.contact) {
        damage = scaledDamage(damage, 0.5);
        changed = true;
      }
      if (payload.move.type === 'Fire') {
        damage = scaledDamage(damage, 2);
        changed = true;
      }
      return changed ? damage : undefined;
    },
  };
}

function flashFire(): EffectHandlers {
  return {
    onTryHit: (ctx, payload) => {
      if (ctx.owner !== ctx.target) return;
      if (payload.move.type !== 'Fire') return;
      ctx.owner.volatiles.flashFire = true;
      pushText(ctx.state, `${ctx.owner.name}'s Flash Fire absorbed the attack!`);
      return false;
    },
    onModifyDamage: (ctx, payload) => {
      if (ctx.owner !== ctx.source) return;
      if (payload.move.type !== 'Fire' || !ctx.owner.volatiles.flashFire) return;
      return scaledDamage(payload.damage, 1.5);
    },
  };
}

function weatherHeal(weather: WeatherId, ability: string): EffectHandlers {
  return {
    onResidual: (ctx) => {
      if (ctx.owner.hp <= 0 || ctx.state.weather !== weather) return;
      const healed = applyHeal(ctx.owner, Math.max(1, Math.floor(ctx.owner.maxHp / 16)));
      if (healed <= 0) return;
      pushEvent(ctx.state, {
        kind: 'heal',
        side: ctx.side,
        amount: healed,
        hp: ctx.owner.hp,
        maxHp: ctx.owner.maxHp,
      });
      pushText(ctx.state, `${ctx.owner.name} restored a little HP with ${ability}!`);
    },
  };
}

function hydration(): EffectHandlers {
  return {
    onResidual: (ctx) => {
      const holder = ctx.owner;
      if (holder.hp <= 0 || holder.status === null || ctx.state.weather !== 'rain') return;
      const cured = cureStatus(holder);
      if (!cured) return;
      pushEvent(ctx.state, { kind: 'cure', side: ctx.side, status: cured });
      pushText(ctx.state, `${holder.name} cured its status with Hydration!`);
    },
  };
}

function leafGuard(): EffectHandlers {
  return {
    onStatus: (ctx, payload) => {
      if (ctx.owner !== ctx.source || ctx.state.weather !== 'sun') return;
      pushText(
        ctx.state,
        `${ctx.owner.name}'s Leaf Guard prevents ${statusName(payload.status as StatusId)}!`,
      );
      return false;
    },
  };
}

function shieldDust(): EffectHandlers {
  return {
    onTrySecondary: (ctx, payload) => {
      if (ctx.owner !== ctx.target) return;
      const effect = payload.effect;
      if (!effect.status && !effect.volatileStatus && !effect.boosts) return;
      pushText(ctx.state, `${ctx.owner.name}'s Shield Dust blocked the secondary effect!`);
      return false;
    },
  };
}

function volatileImmunity(ability: string, blocked: readonly string[]): EffectHandlers {
  return {
    onTryVolatile: (ctx, payload) => {
      if (ctx.owner !== ctx.source || !blocked.includes(payload.volatile)) return;
      pushText(ctx.state, `${ctx.owner.name}'s ${ability} prevents it!`);
      return false;
    },
  };
}

/** Contact punish abilities that may deal damage or steal an item. */
function contactReaction(apply: (ctx: EffectContext, attacker: BattleFighter) => void): EffectHandlers {
  return {
    onAfterMove: (ctx, payload) => {
      if (ctx.owner !== ctx.target) return;
      const attacker = ctx.source;
      if (!payload.contact || !payload.hit) return;
      if (ctx.owner.hp <= 0 || attacker.hp <= 0) return;
      if (ctx.owner.volatiles.substitute > 0) return;
      apply(ctx, attacker);
    },
  };
}

function effectSpore(): EffectHandlers {
  return contactReaction((ctx, attacker) => {
    const roll = ctx.rng.int(1, 100);
    if (roll > 30) return;
    const status: StatusId = roll <= 11 ? 'slp' : roll <= 21 ? 'par' : 'psn';
    applyStatusEffect(ctx.state, opponentOf(ctx.side), attacker, status, `${attacker.name} was afflicted by Effect Spore!`);
  });
}

function roughSkin(): EffectHandlers {
  return contactReaction((ctx, attacker) => {
    const dealt = applyDamage(attacker, Math.max(1, Math.floor(attacker.maxHp / 8)));
    pushEvent(ctx.state, {
      kind: 'damage',
      side: opponentOf(ctx.side),
      amount: dealt,
      hp: attacker.hp,
      maxHp: attacker.maxHp,
      effectiveness: 1,
      crit: false,
    });
    pushText(ctx.state, `${attacker.name} was hurt by ${ctx.owner.name}'s Rough Skin!`);
  });
}

function pickpocket(): EffectHandlers {
  return contactReaction((ctx, attacker) => {
    if (ctx.owner.heldItem || !attacker.heldItem) return;
    if (attacker.ability === 'Sticky Hold') {
      pushText(ctx.state, `${attacker.name} is holding on to its item with Sticky Hold!`);
      return;
    }
    const itemId = attacker.heldItem;
    const itemName = getItem(itemId)?.name ?? itemId;
    ctx.owner.heldItem = itemId;
    attacker.heldItem = null;
    pushText(ctx.state, `${ctx.owner.name} picked up ${attacker.name}'s ${itemName}!`);
  });
}

function rattled(): EffectHandlers {
  return {
    onAfterMove: (ctx, payload) => {
      if (ctx.owner !== ctx.target) return;
      if (ctx.owner.hp <= 0) return;
      if (!['Bug', 'Dark', 'Ghost'].includes(payload.move.type)) return;
      applyBoostEffect(ctx.state, opponentOf(ctx.side), ctx.owner, { spe: 1 }, {
        self: true,
        message: `${ctx.owner.name}'s Rattled raised its Speed!`,
      });
    },
  };
}

function regenerator(): EffectHandlers {
  return {
    onSwitchOut: (ctx) => {
      if (ctx.owner.hp <= 0) return;
      const healed = applyHeal(ctx.owner, Math.max(1, Math.floor(ctx.owner.maxHp / 3)));
      if (healed <= 0) return;
      pushEvent(ctx.state, { kind: 'heal', side: ctx.side, amount: healed, hp: ctx.owner.hp, maxHp: ctx.owner.maxHp });
      pushText(ctx.state, `${ctx.owner.name} restored HP with Regenerator!`);
    },
  };
}

function naturalCure(): EffectHandlers {
  return {
    onSwitchOut: (ctx) => {
      if (ctx.owner.hp <= 0) return;
      const cured = cureStatus(ctx.owner);
      if (!cured) return;
      pushEvent(ctx.state, { kind: 'cure', side: ctx.side, status: cured });
      pushText(ctx.state, `${ctx.owner.name} shed its status with Natural Cure!`);
    },
  };
}

function prankster(): EffectHandlers {
  return {
    onModifyPriority: (ctx, priority) => {
      if (ctx.owner !== ctx.source) return;
      if (ctx.move?.category !== 'Status') return;
      return priority + 1;
    },
  };
}

function galeWings(): EffectHandlers {
  return {
    onModifyPriority: (ctx, priority) => {
      if (ctx.owner !== ctx.source) return;
      if (ctx.move?.type !== 'Flying' || ctx.owner.hp !== ctx.owner.maxHp) return;
      return priority + 1;
    },
  };
}

function frisk(): EffectHandlers {
  return {
    onSwitchIn: (ctx) => {
      const foe = ctx.target;
      if (!foe || !foe.heldItem) return;
      pushText(ctx.state, `${ctx.owner.name} frisked ${foe.name} and found its ${getItem(foe.heldItem)?.name ?? foe.heldItem}!`);
    },
  };
}

function anticipation(): EffectHandlers {
  return {
    onSwitchIn: (ctx) => {
      const foe = ctx.target;
      if (!foe) return;
      const dangerous = foe.moves.some((slot) => {
        const move = getMove(slot.moveId);
        if (!move || move.category === 'Status' || move.basePower <= 0) return false;
        return effectiveness(move.type, ctx.owner.types) > 1;
      });
      if (dangerous) pushText(ctx.state, `${ctx.owner.name} shuddered with Anticipation!`);
    },
  };
}

function download(): EffectHandlers {
  return {
    onSwitchIn: (ctx) => {
      const foe = ctx.target;
      if (!foe) return;
      const raisesAttack = foe.stats.def >= foe.stats.spd;
      applyBoostEffect(ctx.state, ctx.side, ctx.owner, raisesAttack ? { atk: 1 } : { spa: 1 }, {
        self: true,
        message: `${ctx.owner.name}'s Download raised its ${raisesAttack ? 'Attack' : 'Sp. Atk'}!`,
      });
    },
  };
}

function defiant(): EffectHandlers {
  return {
    onBoost: (ctx, payload) => {
      if (ctx.owner !== ctx.source || payload.self || payload.stages >= 0) return;
      applyBoostEffect(ctx.state, ctx.side, ctx.owner, { atk: 2 }, {
        self: true,
        message: `${ctx.owner.name}'s Defiant raised its Attack!`,
      });
    },
  };
}

function competitive(): EffectHandlers {
  return {
    onBoost: (ctx, payload) => {
      if (ctx.owner !== ctx.source || payload.self || payload.stages >= 0) return;
      applyBoostEffect(ctx.state, ctx.side, ctx.owner, { spa: 2 }, {
        self: true,
        message: `${ctx.owner.name}'s Competitive raised its Sp. Atk!`,
      });
    },
  };
}

function grassPelt(): EffectHandlers {
  return {
    onModifyDamage: (ctx, payload) => {
      if (ctx.owner !== ctx.target) return;
      if (payload.move.category !== 'Physical') return;
      if (ctx.state.terrain !== 'grassy' || !isGrounded(ctx.owner)) return;
      return Math.max(1, Math.floor(payload.damage / 1.5));
    },
  };
}

function poisonHeal(): EffectHandlers {
  return {
    onResidual: (ctx) => {
      const holder = ctx.owner;
      if (holder.hp <= 0 || holder.hp >= holder.maxHp) return;
      if (holder.status !== 'psn' && holder.status !== 'tox') return;
      const healed = applyHeal(holder, Math.max(1, Math.floor(holder.maxHp / 8)));
      if (healed <= 0) return;
      pushEvent(ctx.state, { kind: 'heal', side: ctx.side, amount: healed, hp: holder.hp, maxHp: holder.maxHp });
      pushText(ctx.state, `${holder.name} restored HP with Poison Heal!`);
    },
  };
}

function sweetVeil(): EffectHandlers {
  return {
    onStatus: (ctx, payload) => {
      if (ctx.owner !== ctx.source || payload.status !== 'slp') return;
      pushText(ctx.state, `${ctx.owner.name}'s Sweet Veil prevents sleep!`);
      return false;
    },
  };
}

function battleArmor(): EffectHandlers {
  return {
    onModifyCrit: (ctx, willCrit) => {
      if (ctx.owner !== ctx.target || !willCrit) return;
      return false;
    },
  };
}

function angerPoint(): EffectHandlers {
  return {
    onModifyCrit: (ctx, willCrit) => {
      if (ctx.owner !== ctx.target || !willCrit || ctx.owner.hp <= 0) return;
      applyBoostEffect(ctx.state, opponentOf(ctx.side), ctx.owner, { atk: 12 }, {
        self: true,
        message: `${ctx.owner.name}'s Anger Point maxed its Attack!`,
      });
    },
  };
}

function infiltrator(): EffectHandlers {
  return {
    onTrySubstitute: (ctx) => {
      if (ctx.owner !== ctx.source) return;
      return true;
    },
  };
}

function skillLink(): EffectHandlers {
  return {
    onModifyMultihit: (ctx, hits) => {
      if (ctx.owner !== ctx.source) return;
      const range = ctx.move?.multihit;
      if (!range || typeof range === 'number') return hits;
      return range[range.length - 1];
    },
  };
}

function damp(): EffectHandlers {
  return {
    onTryHit: (ctx, payload) => {
      if (ctx.owner !== ctx.target || !payload.move.selfdestruct) return;
      pushText(ctx.state, `${ctx.owner.name}'s Damp prevented the explosion!`);
      return false;
    },
  };
}

function bulletproof(): EffectHandlers {
  return {
    onTryHit: (ctx, payload) => {
      if (ctx.owner !== ctx.target || !payload.move.flags.bullet) return;
      pushText(ctx.state, `${ctx.owner.name}'s Bulletproof blocked the move!`);
      return false;
    },
  };
}

function soundproof(): EffectHandlers {
  return {
    onTryHit: (ctx, payload) => {
      if (ctx.owner !== ctx.target || !payload.move.flags.sound) return;
      pushText(ctx.state, `${ctx.owner.name}'s Soundproof blocked the move!`);
      return false;
    },
  };
}

function poisonTouch(): EffectHandlers {
  return {
    onAfterMove: (ctx, payload) => {
      if (ctx.owner !== ctx.source || !ctx.target) return;
      if (!payload.contact) return;
      if (ctx.owner.hp <= 0 || ctx.target.hp <= 0) return;
      if (ctx.rng.int(1, 100) > 30) return;
      applyStatusEffect(ctx.state, opponentOf(ctx.side), ctx.target, 'psn', `${ctx.target.name} was poisoned by Poison Touch!`);
    },
  };
}

function gooey(): EffectHandlers {
  return contactReaction((ctx, attacker) => {
    applyBoostEffect(ctx.state, opponentOf(ctx.side), attacker, { spe: -1 }, {
      message: `${attacker.name}'s Speed was lowered by Gooey!`,
    });
  });
}

function justified(): EffectHandlers {
  return {
    onAfterMove: (ctx, payload) => {
      if (ctx.owner !== ctx.target || ctx.owner.hp <= 0) return;
      if (payload.move.type !== 'Dark') return;
      applyBoostEffect(ctx.state, opponentOf(ctx.side), ctx.owner, { atk: 1 }, {
        self: true,
        message: `${ctx.owner.name}'s Justified raised its Attack!`,
      });
    },
  };
}

function marvelScale(): EffectHandlers {
  return {
    onModifyDamage: (ctx, payload) => {
      if (ctx.owner !== ctx.target || !ctx.owner.status) return;
      if (payload.move.category !== 'Physical') return;
      return Math.max(1, Math.floor(payload.damage / 1.5));
    },
  };
}

function sandForce(): EffectHandlers {
  return {
    onModifyDamage: (ctx, payload) => {
      if (ctx.owner !== ctx.source || ctx.state.weather !== 'sand') return;
      if (!['Rock', 'Ground', 'Steel'].includes(payload.move.type)) return;
      return scaledDamage(payload.damage, 1.3);
    },
  };
}

function thermalExchange(): EffectHandlers {
  return {
    onTryHit: (ctx, payload) => {
      if (ctx.owner !== ctx.target || payload.move.type !== 'Fire') return;
      applyBoostEffect(ctx.state, opponentOf(ctx.side), ctx.owner, { atk: 1 }, {
        self: true,
        message: `${ctx.owner.name}'s Thermal Exchange raised its Attack!`,
      });
      pushText(ctx.state, `${ctx.owner.name}'s Thermal Exchange absorbed the heat!`);
      return false;
    },
    onStatus: (ctx, payload) => {
      if (ctx.owner !== ctx.source || payload.status !== 'brn') return;
      pushText(ctx.state, `${ctx.owner.name}'s Thermal Exchange prevents burns!`);
      return false;
    },
  };
}

function simple(): EffectHandlers {
  return {
    onModifyBoost: (ctx, payload) => {
      if (ctx.owner !== ctx.source) return;
      return payload.stages * 2;
    },
  };
}

function contrary(): EffectHandlers {
  return {
    onModifyBoost: (ctx, payload) => {
      if (ctx.owner !== ctx.source) return;
      return -payload.stages;
    },
  };
}

function synchronize(): EffectHandlers {
  return {
    onAfterStatus: (ctx, status) => {
      if (ctx.owner !== ctx.source || !ctx.target) return;
      if (!['brn', 'par', 'psn'].includes(status)) return;
      if (ctx.target.ability === 'Synchronize') return;
      applyStatusEffect(ctx.state, opponentOf(ctx.side), ctx.target, status, `${ctx.target.name} was afflicted by ${statusName(status as StatusId)} too!`);
    },
  };
}

function steadfast(): EffectHandlers {
  return {
    onTryVolatile: (ctx, payload) => {
      if (ctx.owner !== ctx.source || payload.volatile !== 'flinch') return;
      applyBoostEffect(ctx.state, ctx.side, ctx.owner, { spe: 1 }, {
        self: true,
        message: `${ctx.owner.name}'s Steadfast raised its Speed!`,
      });
    },
  };
}

function rockHead(): EffectHandlers {
  return {
    onModifyRecoil: (ctx) => {
      if (ctx.owner !== ctx.source) return;
      pushText(ctx.state, `${ctx.owner.name} took no recoil thanks to Rock Head!`);
      return 0;
    },
  };
}

function moody(): EffectHandlers {
  const stats: readonly BoostId[] = ['atk', 'def', 'spa', 'spd', 'spe'];
  return {
    onResidual: (ctx) => {
      if (ctx.owner.hp <= 0) return;
      const raise = stats[ctx.rng.int(0, stats.length - 1)];
      let lower = stats[ctx.rng.int(0, stats.length - 1)];
      if (lower === raise) lower = stats[(stats.indexOf(lower) + 1) % stats.length];
      applyBoostEffect(ctx.state, ctx.side, ctx.owner, { [raise]: 2, [lower]: -1 }, {
        self: true,
        message: `${ctx.owner.name}'s Moody heightened one stat and lowered another!`,
      });
    },
  };
}

function disguise(): EffectHandlers {
  return {
    onStart: (ctx) => {
      if (ctx.owner === ctx.source) ctx.owner.volatiles.disguise = true;
    },
    onTryHit: (ctx, payload) => {
      if (ctx.owner !== ctx.target || !ctx.owner.volatiles.disguise) return;
      if (payload.move.category === 'Status' || payload.move.basePower <= 0) return;
      ctx.owner.volatiles.disguise = false;
      pushText(ctx.state, `${ctx.owner.name}'s Disguise was busted!`);
      return false;
    },
  };
}

function overcoat(): EffectHandlers {
  return {
    onTryHit: (ctx, payload) => {
      if (ctx.owner !== ctx.target || !payload.move.flags.powder) return;
      pushText(ctx.state, `${ctx.owner.name}'s Overcoat blocked the powder!`);
      return false;
    },
  };
}

function runAway(): EffectHandlers {
  return {
    onTryEscape: (ctx) => {
      if (ctx.owner !== ctx.source) return;
      return true;
    },
  };
}

function analytic(): EffectHandlers {
  return {
    onModifyDamage: (ctx, payload) => {
      if (ctx.owner !== ctx.source) return;
      if (!ctx.state.movedSides.includes(opponentOf(ctx.side))) return;
      return scaledDamage(payload.damage, 1.3);
    },
  };
}

function stakeout(): EffectHandlers {
  return {
    onModifyDamage: (ctx, payload) => {
      if (ctx.owner !== ctx.source) return;
      if (!ctx.state.switchedSides.includes(opponentOf(ctx.side))) return;
      return scaledDamage(payload.damage, 2);
    },
  };
}

function damagingMove(payload: MovePayload): boolean {
  return payload.move.category !== 'Status' && payload.move.basePower > 0;
}

/** Fires when this fighter is the target of a move that actually connected. */
function hitReaction(
  applies: (ctx: EffectContext, payload: MovePayload) => boolean,
  apply: (ctx: EffectContext) => void,
): EffectHandlers {
  return {
    onAfterMove: (ctx, payload) => {
      if (ctx.owner !== ctx.target || ctx.owner.hp <= 0) return;
      if (!payload.hit) return;
      if (!applies(ctx, payload)) return;
      apply(ctx);
    },
  };
}

function selfBoost(
  ctx: EffectContext,
  boosts: Partial<Record<BoostId, number>>,
  message: string,
): void {
  applyBoostEffect(ctx.state, opponentOf(ctx.side), ctx.owner, boosts, { self: true, message });
}

function windRider(): EffectHandlers {
  return {
    onTryHit: (ctx, payload) => {
      if (ctx.owner !== ctx.target || !payload.move.flags.wind) return;
      pushText(ctx.state, `${ctx.owner.name}'s Wind Rider absorbed the attack!`);
      selfBoost(ctx, { atk: 1 }, `${ctx.owner.name}'s Wind Rider raised its Attack!`);
      return false;
    },
  };
}

function stamina(): EffectHandlers {
  return hitReaction((_ctx, payload) => damagingMove(payload), (ctx) => {
    selfBoost(ctx, { def: 1 }, `${ctx.owner.name}'s Stamina raised its Defense!`);
  });
}

function weakArmor(): EffectHandlers {
  return hitReaction(
    (_ctx, payload) => payload.move.category === 'Physical' && payload.move.basePower > 0,
    (ctx) => {
      selfBoost(
        ctx,
        { def: -1, spe: 2 },
        `${ctx.owner.name}'s Weak Armor lowered its Defense and raised its Speed!`,
      );
    },
  );
}

function steamEngine(): EffectHandlers {
  return hitReaction(
    (_ctx, payload) =>
      damagingMove(payload) && (payload.move.type === 'Fire' || payload.move.type === 'Water'),
    (ctx) => selfBoost(ctx, { spe: 6 }, `${ctx.owner.name}'s Steam Engine raised its Speed!`),
  );
}

function waterCompaction(): EffectHandlers {
  return hitReaction(
    (_ctx, payload) => damagingMove(payload) && payload.move.type === 'Water',
    (ctx) => selfBoost(ctx, { def: 2 }, `${ctx.owner.name}'s Water Compaction raised its Defense!`),
  );
}

function sniper(): EffectHandlers {
  return {
    onModifyDamage: (ctx, payload) => {
      if (ctx.owner !== ctx.source || !payload.crit) return;
      return scaledDamage(payload.damage, 1.5);
    },
  };
}

function superLuck(): EffectHandlers {
  return {
    onModifyCritRatio: (ctx, ratio) => {
      if (ctx.owner !== ctx.source) return;
      return ratio + 1;
    },
  };
}

function merciless(): EffectHandlers {
  return {
    onModifyCrit: (ctx) => {
      if (ctx.owner !== ctx.source || !ctx.target) return;
      if (ctx.target.status !== 'psn' && ctx.target.status !== 'tox') return;
      return true;
    },
  };
}

function solarPower(): EffectHandlers {
  return {
    onModifyDamage: (ctx, payload) => {
      if (ctx.owner !== ctx.source || payload.move.category !== 'Special') return;
      if (ctx.state.weather !== 'sun') return;
      return scaledDamage(payload.damage, 1.5);
    },
    onResidual: (ctx) => {
      if (ctx.owner.hp <= 0 || ctx.state.weather !== 'sun') return;
      damageHolder(ctx, 8);
      pushText(ctx.state, `${ctx.owner.name} is hurt by the harsh sunlight!`);
    },
  };
}

function flareBoost(): EffectHandlers {
  return {
    onModifyDamage: (ctx, payload) => {
      if (ctx.owner !== ctx.source) return;
      if (ctx.owner.status !== 'brn' || payload.move.category !== 'Special') return;
      return scaledDamage(payload.damage, 1.5);
    },
  };
}

function toxicBoost(): EffectHandlers {
  return {
    onModifyDamage: (ctx, payload) => {
      if (ctx.owner !== ctx.source) return;
      if (ctx.owner.status !== 'psn' && ctx.owner.status !== 'tox') return;
      if (payload.move.category !== 'Physical') return;
      return scaledDamage(payload.damage, 1.5);
    },
  };
}

const GOOD_AS_GOLD_TARGETS: readonly string[] = [
  'normal',
  'any',
  'allAdjacent',
  'allAdjacentFoes',
  'adjacentFoe',
  'randomNormal',
];

function goodAsGold(): EffectHandlers {
  return {
    onTryHit: (ctx, payload) => {
      if (ctx.owner !== ctx.target || payload.move.category !== 'Status') return;
      if (!GOOD_AS_GOLD_TARGETS.includes(payload.move.target)) return;
      pushText(ctx.state, `${ctx.owner.name}'s Good as Gold blocked the move!`);
      return false;
    },
  };
}

function purifyingSalt(): EffectHandlers {
  return {
    onStatus: (ctx) => {
      if (ctx.owner !== ctx.source) return;
      pushText(ctx.state, `${ctx.owner.name}'s Purifying Salt prevents status conditions!`);
      return false;
    },
    onModifyDamage: (ctx, payload) => {
      if (ctx.owner !== ctx.target || payload.move.type !== 'Ghost') return;
      return scaledDamage(payload.damage, 0.5);
    },
  };
}

function comatose(): EffectHandlers {
  return {
    onStatus: (ctx) => {
      if (ctx.owner !== ctx.source) return;
      pushText(
        ctx.state,
        `${ctx.owner.name}'s Comatose prevents it from being afflicted with a status condition!`,
      );
      return false;
    },
  };
}

function noGuard(): EffectHandlers {
  return {
    onModifyAccuracy: (ctx, chance) => {
      if (ctx.owner !== ctx.source && ctx.owner !== ctx.target) return chance;
      return 1;
    },
  };
}

function surgeSurfer(): EffectHandlers {
  return {
    onModifySpe: (ctx, speed) => {
      if (ctx.owner !== ctx.source || ctx.state.terrain !== 'electric') return;
      return Math.max(1, Math.floor(speed * 2));
    },
  };
}

function tangledFeet(): EffectHandlers {
  return accuracyModifier(
    0.5,
    (ctx) => ctx.owner === ctx.target && ctx.owner.volatiles.confusion > 0,
  );
}

function toxicChain(): EffectHandlers {
  return {
    onAfterMove: (ctx, payload) => {
      if (ctx.owner !== ctx.source || !ctx.target) return;
      if (!payload.hit || !damagingMove(payload)) return;
      if (ctx.owner.hp <= 0 || ctx.target.hp <= 0) return;
      if (ctx.rng.int(1, 100) > 30) return;
      applyStatusEffect(
        ctx.state,
        opponentOf(ctx.side),
        ctx.target,
        'psn',
        `${ctx.target.name} was poisoned by Toxic Chain!`,
      );
    },
  };
}

function stench(): EffectHandlers {
  return {
    onAfterMove: (ctx, payload) => {
      if (ctx.owner !== ctx.source || !ctx.target) return;
      if (!payload.hit || !damagingMove(payload)) return;
      if (ctx.owner.hp <= 0 || ctx.target.hp <= 0) return;
      if (ctx.rng.int(1, 100) > 10) return;
      const target = ctx.target;
      const targetCtx = makeContext(ctx.state, opponentOf(ctx.side), {
        source: target,
        target: ctx.owner,
      });
      if (!runTryVolatile(targetCtx, 'flinch')) return;
      applyFlinch(target);
    },
  };
}

function sandSpit(): EffectHandlers {
  return hitReaction((_ctx, payload) => damagingMove(payload), (ctx) => {
    if (ctx.state.weather === 'sand') return;
    setWeather(ctx.state, 'sand');
  });
}

function seedSower(): EffectHandlers {
  return hitReaction((_ctx, payload) => damagingMove(payload), (ctx) => {
    if (ctx.state.terrain === 'grassy') return;
    setTerrain(ctx.state, 'grassy');
  });
}

function furCoat(): EffectHandlers {
  return incomingMultiplier(0.5, (_ctx, payload) => payload.move.category === 'Physical');
}

function iceFace(): EffectHandlers {
  return {
    onStart: (ctx) => {
      if (ctx.owner === ctx.source) ctx.owner.volatiles.iceFace = true;
    },
    onTryHit: (ctx, payload) => {
      if (ctx.owner !== ctx.target || !ctx.owner.volatiles.iceFace) return;
      if (payload.move.category !== 'Physical' || payload.move.basePower <= 0) return;
      ctx.owner.volatiles.iceFace = false;
      pushText(ctx.state, `${ctx.owner.name}'s Ice Face was broken!`);
      return false;
    },
  };
}

function speedBoost(): EffectHandlers {
  return {
    onResidual: (ctx) => {
      if (ctx.owner !== ctx.source || ctx.owner.hp <= 0) return;
      applyBoostEffect(ctx.state, ctx.side, ctx.owner, { spe: 1 }, {
        self: true,
        message: `${ctx.owner.name}'s Speed Boost raised its Speed!`,
      });
    },
  };
}

function slowStart(): EffectHandlers {
  return {
    onStart: (ctx) => {
      if (ctx.owner.hp <= 0) return;
      ctx.owner.volatiles.slowStart = 5;
      pushText(ctx.state, `${ctx.owner.name} can't get it going!`);
    },
    onModifySpe: (ctx, speed) => {
      if (ctx.owner !== ctx.source || ctx.owner.volatiles.slowStart <= 0) return;
      return Math.max(1, Math.floor(speed / 2));
    },
    onModifyDamage: (ctx, payload) => {
      if (ctx.owner !== ctx.source || ctx.owner.volatiles.slowStart <= 0) return;
      if (payload.move.category !== 'Physical') return;
      return Math.max(1, Math.floor(payload.damage / 2));
    },
    onResidual: (ctx) => {
      if (ctx.owner !== ctx.source || ctx.owner.volatiles.slowStart <= 0) return;
      ctx.owner.volatiles.slowStart -= 1;
      if (ctx.owner.volatiles.slowStart === 0) {
        pushText(ctx.state, `${ctx.owner.name} finally got its act together!`);
      }
    },
  };
}

function unburden(): EffectHandlers {
  return {
    onModifySpe: (ctx, speed) => {
      if (ctx.owner !== ctx.source || ctx.owner.lastItemId === null) return;
      return Math.max(1, Math.floor(speed * 2));
    },
  };
}

function forewarn(): EffectHandlers {
  return {
    onSwitchIn: (ctx) => {
      const foe = ctx.target;
      if (!foe) return;
      let best: { name: string; power: number } | null = null;
      for (const slot of foe.moves) {
        const move = getMove(slot.moveId);
        if (!move) continue;
        if (!best || move.basePower > best.power) best = { name: move.name, power: move.basePower };
      }
      if (best) pushText(ctx.state, `${ctx.owner.name}'s Forewarn alerted it to ${best.name}!`);
    },
  };
}

function supersweetSyrup(): EffectHandlers {
  return {
    onSwitchIn: (ctx) => {
      if (ctx.owner.volatiles.supersweetSyrup) return;
      const foe = ctx.target;
      if (!foe || foe.hp <= 0) return;
      ctx.owner.volatiles.supersweetSyrup = true;
      applyBoostEffect(ctx.state, opponentOf(ctx.side), foe, { evasion: -1 }, {
        message: `${ctx.owner.name}'s Supersweet Syrup lowered ${foe.name}'s evasiveness!`,
      });
    },
  };
}

function magician(): EffectHandlers {
  return {
    onAfterMove: (ctx, payload) => {
      if (ctx.owner !== ctx.source || !ctx.target) return;
      if (!payload.hit || !damagingMove(payload)) return;
      if (ctx.owner.hp <= 0 || ctx.target.hp <= 0) return;
      if (ctx.owner.heldItem || !ctx.target.heldItem) return;
      if (ctx.target.ability === 'Sticky Hold') {
        pushText(ctx.state, `${ctx.target.name} is holding on to its item with Sticky Hold!`);
        return;
      }
      const itemId = ctx.target.heldItem;
      const itemName = getItem(itemId)?.name ?? itemId;
      ctx.owner.heldItem = itemId;
      ctx.target.heldItem = null;
      pushText(ctx.state, `${ctx.owner.name} stole ${ctx.target.name}'s ${itemName}!`);
    },
  };
}

function lingeringAroma(): EffectHandlers {
  return contactReaction((ctx, attacker) => {
    if (attacker.ability === 'Lingering Aroma') return;
    attacker.ability = 'Lingering Aroma';
    pushText(ctx.state, `${attacker.name}'s Ability became Lingering Aroma!`);
  });
}

function harvest(): EffectHandlers {
  return {
    onResidual: (ctx) => {
      const holder = ctx.owner;
      if (holder !== ctx.source || holder.hp <= 0) return;
      if (holder.heldItem || !holder.lastItemId) return;
      if (ctx.rng.next() >= 0.5) return;
      const itemId = holder.lastItemId;
      holder.heldItem = itemId;
      holder.lastItemId = null;
      pushText(ctx.state, `${holder.name} harvested its ${getItem(itemId)?.name ?? itemId}!`);
    },
  };
}

function pressure(): EffectHandlers {
  return {
    onSwitchIn: (ctx) => {
      if (ctx.owner.hp <= 0) return;
      pushText(ctx.state, `${ctx.owner.name} is exerting its Pressure!`);
    },
  };
}

/** The move targets Pressure cares about, reused by the anti-priority abilities. */
const FOE_TARGETS = new Set([
  'normal',
  'any',
  'allAdjacent',
  'allAdjacentFoes',
  'adjacentFoe',
  'randomNormal',
]);

/** Armor Tail, Dazzling and Queenly Majesty stop priority moves aimed at the holder. */
function priorityBlocker(ability: string): EffectHandlers {
  return {
    onTryHit: (ctx, payload) => {
      if (ctx.owner !== ctx.target) return;
      if (!FOE_TARGETS.has(payload.move.target)) return;
      const priority = runModifyPriority(
        makeContext(ctx.state, ctx.side, {
          source: ctx.source,
          target: ctx.owner,
          move: payload.move,
        }),
        payload.move,
        payload.move.priority,
      );
      if (priority <= 0) return;
      pushText(ctx.state, `${ctx.owner.name}'s ${ability} stopped the priority move!`);
      return false;
    },
  };
}

/** Triage gives healing moves +3 priority. */
function triage(): EffectHandlers {
  return {
    onModifyPriority: (ctx, priority) => {
      if (ctx.owner !== ctx.source) return;
      if (!ctx.move?.flags.heal) return;
      return priority + 3;
    },
  };
}

/** Serene Grace doubles the chance of a move's secondary effect. */
function sereneGrace(): EffectHandlers {
  return {
    onModifySecondaryChance: (ctx, chance) => {
      if (ctx.owner !== ctx.source) return;
      return chance * 2;
    },
  };
}

/** Wonder Skin halves the accuracy of status moves aimed at the holder. */
function wonderSkin(): EffectHandlers {
  return {
    onModifyAccuracy: (ctx, chance) => {
      if (ctx.owner !== ctx.target) return;
      if (ctx.move?.category !== 'Status') return;
      return chance * 0.5;
    },
  };
}

/** Mirror Armor sends a foe-caused stat drop back at the foe instead. */
let reflectingDrop = false;
function mirrorArmor(): EffectHandlers {
  return {
    onBoost: (ctx, payload) => {
      if (ctx.owner !== ctx.source || payload.self || payload.stages >= 0) return;
      if (reflectingDrop || !ctx.target || ctx.target.hp <= 0) return;
      pushText(
        ctx.state,
        `${ctx.owner.name}'s Mirror Armor reflected the ${statLabel(payload.stat)} drop!`,
      );
      reflectingDrop = true;
      try {
        applyBoostEffect(ctx.state, opponentOf(ctx.side), ctx.target, { [payload.stat]: payload.stages });
      } finally {
        reflectingDrop = false;
      }
      return false;
    },
  };
}

/** Opportunist copies whatever stat boost the foe just gained. */
function opportunist(): EffectHandlers {
  return {
    onBoost: (ctx, payload) => {
      if (ctx.owner !== ctx.target || payload.stages <= 0) return;
      if (ctx.owner.hp <= 0) return;
      applyBoostEffect(ctx.state, opponentOf(ctx.side), ctx.owner, { [payload.stat]: payload.stages }, {
        self: true,
        message: `${ctx.owner.name}'s Opportunist copied the stat boost!`,
      });
    },
  };
}

/** Tangling Hair lowers the Speed of a contact attacker, like Gooey. */
function tanglingHair(): EffectHandlers {
  return contactReaction((ctx, attacker) => {
    applyBoostEffect(ctx.state, opponentOf(ctx.side), attacker, { spe: -1 }, {
      message: `${attacker.name}'s Speed was lowered by Tangling Hair!`,
    });
  });
}

/** Aftermath deals a quarter of the contact attacker's max HP when the holder faints. */
function aftermath(): EffectHandlers {
  return {
    onAfterMove: (ctx, payload) => {
      if (ctx.owner !== ctx.target) return;
      if (!payload.contact || !payload.hit) return;
      if (ctx.owner.hp > 0) return;
      const attacker = ctx.source;
      if (attacker.hp <= 0) return;
      const dealt = applyDamage(attacker, Math.max(1, Math.floor(attacker.maxHp / 4)));
      pushEvent(ctx.state, {
        kind: 'damage',
        side: opponentOf(ctx.side),
        amount: dealt,
        hp: attacker.hp,
        maxHp: attacker.maxHp,
        effectiveness: 1,
        crit: false,
      });
      pushText(ctx.state, `${attacker.name} was hurt by ${ctx.owner.name}'s Aftermath!`);
    },
  };
}

/** Bad Dreams chips a sleeping foe every turn. */
function badDreams(): EffectHandlers {
  return {
    onResidual: (ctx) => {
      const foe = ctx.target;
      if (ctx.owner.hp <= 0 || !foe || foe.hp <= 0) return;
      if (foe.status !== 'slp') return;
      const dealt = applyDamage(foe, Math.max(1, Math.floor(foe.maxHp / 8)));
      pushEvent(ctx.state, {
        kind: 'damage',
        side: opponentOf(ctx.side),
        amount: dealt,
        hp: foe.hp,
        maxHp: foe.maxHp,
        effectiveness: 1,
        crit: false,
      });
      pushText(ctx.state, `${foe.name} is tormented by ${ctx.owner.name}'s Bad Dreams!`);
    },
  };
}

/** Poison Puppeteer confuses whatever it poisons. */
function poisonPuppeteer(): EffectHandlers {
  return {
    onAfterStatus: (ctx, status) => {
      if (ctx.owner !== ctx.target) return;
      if (status !== 'psn' && status !== 'tox') return;
      const victim = ctx.source;
      if (victim.hp <= 0) return;
      const volCtx = makeContext(ctx.state, ctx.side, { source: victim, target: ctx.owner });
      if (!runTryVolatile(volCtx, 'confusion')) return;
      if (applyConfusion(victim, ctx.rng)) {
        pushText(ctx.state, `${victim.name} was confused by Poison Puppeteer!`);
      }
    },
  };
}

/** Berserk / Anger Shell fire once when an attack drops the holder below half. */
function pinchDrop(ability: string, boosts: Partial<Record<BoostId, number>>): EffectHandlers {
  return {
    onAfterMove: (ctx, payload) => {
      const holder = ctx.owner;
      if (holder !== ctx.target || holder.hp <= 0) return;
      if (!payload.hit || payload.move.category === 'Status' || payload.move.basePower <= 0) return;
      if (holder.hp * 2 > holder.maxHp || holder.volatiles.pinchTriggered) return;
      holder.volatiles.pinchTriggered = true;
      applyBoostEffect(ctx.state, opponentOf(ctx.side), holder, boosts, {
        self: true,
        message: `${holder.name}'s ${ability} kicked in!`,
      });
    },
    onResidual: (ctx) => {
      if (ctx.owner.hp * 2 > ctx.owner.maxHp) ctx.owner.volatiles.pinchTriggered = false;
    },
  };
}

/** Supreme Overlord grows stronger for every fainted party member. */
function supremeOverlord(): EffectHandlers {
  return {
    onModifyDamage: (ctx, payload) => {
      if (ctx.owner !== ctx.source) return;
      const fallen = ctx.state.sides[ctx.side].party.filter((fighter) => fighter.hp <= 0).length;
      if (fallen <= 0) return;
      return scaledDamage(payload.damage, 1 + 0.1 * fallen);
    },
  };
}

/** Scrappy and Mind's Eye let Normal and Fighting moves hit Ghosts. */
function pierceGhostImmunity(): EffectHandlers {
  return {
    onModifyEffectiveness: (ctx, move, effectiveness) => {
      if (ctx.owner !== ctx.source || effectiveness !== 0) return;
      if (move.type !== 'Normal' && move.type !== 'Fighting') return;
      if (!ctx.target?.types.includes('Ghost')) return;
      return 1;
    },
  };
}

/** Abilities Trace may never copy (unknown, toggle or recursion-prone). */
const TRACE_BANNED = new Set([
  'Trace',
  'Illusion',
  'Imposter',
  'Neutralizing Gas',
  'Disguise',
  'Ice Face',
  'Zen Mode',
  'Shields Down',
  'Schooling',
  'Stance Change',
  'RKS System',
  'Comatose',
  'Multitype',
  'Battle Bond',
  'Power Construct',
  'Gulp Missile',
  'Mimicry',
  'Forecast',
  'Flower Gift',
  'Wonder Guard',
  'Hunger Switch',
  'Zero to Hero',
  'As One (Glastrier)',
  'As One (Spectrier)',
]);

/** Trace copies the foe's ability on entry and runs its entry effects. */
function trace(): EffectHandlers {
  return {
    onSwitchIn: (ctx) => {
      const foe = ctx.target;
      if (!foe || !foe.ability || foe.ability === ctx.owner.ability) return;
      if (TRACE_BANNED.has(foe.ability)) return;
      ctx.owner.ability = foe.ability;
      pushText(ctx.state, `${ctx.owner.name} traced ${foe.name}'s ${foe.ability}!`);
      const inner = makeContext(ctx.state, ctx.side, { source: ctx.owner, target: foe });
      runStart(inner);
      runSwitchIn(inner);
    },
  };
}

/** Electromorphosis and Wind Power store a Charge for the next Electric move. */
function chargeOnHit(ability: string, applies: (payload: MovePayload) => boolean): EffectHandlers {
  return {
    onAfterMove: (ctx, payload) => {
      if (ctx.owner !== ctx.target || ctx.owner.hp <= 0) return;
      if (!payload.hit || !applies(payload)) return;
      if (ctx.owner.volatiles.charge) return;
      ctx.owner.volatiles.charge = true;
      pushText(ctx.state, `${ctx.owner.name}'s ${ability} stored power!`);
    },
    onModifyDamage: (ctx, payload) => {
      if (ctx.owner !== ctx.source) return;
      if (payload.move.type !== 'Electric' || !ctx.owner.volatiles.charge) return;
      ctx.owner.volatiles.charge = false;
      return Math.max(1, Math.floor(payload.damage * 2));
    },
  };
}

/** Soul-Heart raises Sp. Atk whenever any Pokémon faints. */
function soulHeart(): EffectHandlers {
  return {
    onFaint: (ctx) => {
      if (ctx.owner !== ctx.source || ctx.owner.hp <= 0) return;
      applyBoostEffect(ctx.state, ctx.side, ctx.owner, { spa: 1 }, {
        self: true,
        message: `${ctx.owner.name}'s Soul-Heart raised its Sp. Atk!`,
      });
    },
  };
}

/** Quick Draw has a 30% chance to move first inside its priority bracket. */
function quickDraw(): EffectHandlers {
  return {
    onFractionalPriority: (ctx) => {
      if (ctx.owner !== ctx.source) return;
      return ctx.rng.next() < 0.3 ? 1 : 0;
    },
  };
}

/** Stall always moves last inside its priority bracket. */
function stall(): EffectHandlers {
  return {
    onFractionalPriority: (ctx) => {
      if (ctx.owner !== ctx.source) return;
      return -1;
    },
  };
}

const ABILITIES: readonly (readonly [string, EffectHandlers])[] = [
  ['intimidate', intimidate()],
  ['levitate', levitate()],
  ['sturdy', sturdy()],

  ['static', contactStatus('Static', 'par')],
  ['flamebody', contactStatus('Flame Body', 'brn')],
  ['poisonpoint', contactStatus('Poison Point', 'psn')],

  ['immunity', statusImmunity('Immunity', ['psn', 'tox'])],
  ['limber', statusImmunity('Limber', ['par'])],
  ['waterveil', statusImmunity('Water Veil', ['brn'])],
  ['insomnia', statusImmunity('Insomnia', ['slp'])],
  ['vitalspirit', statusImmunity('Vital Spirit', ['slp'])],
  ['magmaarmor', statusImmunity('Magma Armor', ['frz'])],

  ['overgrow', pinchBoost('Grass')],
  ['blaze', pinchBoost('Fire')],
  ['torrent', pinchBoost('Water')],
  ['swarm', pinchBoost('Bug')],

  ['guts', guts()],
  ['technician', technician()],

  ['clearbody', statGuard('all')],
  ['whitesmoke', statGuard('all')],
  ['hypercutter', statGuard(['atk'])],
  ['bigpecks', statGuard(['def'])],
  ['keeneye', statGuard(['accuracy'])],

  ['shedskin', shedSkin()],

  ['waterabsorb', typeImmunity('Water Absorb', 'Water', { healQuarter: true })],
  ['voltabsorb', typeImmunity('Volt Absorb', 'Electric', { healQuarter: true })],
  ['sapsipper', typeImmunity('Sap Sipper', 'Grass', { boost: { atk: 1 } })],
  ['lightningrod', typeImmunity('Lightning Rod', 'Electric', { boost: { spa: 1 } })],
  ['stormdrain', typeImmunity('Storm Drain', 'Water', { boost: { spa: 1 } })],
  ['motordrive', typeImmunity('Motor Drive', 'Electric', { boost: { spe: 1 } })],
  ['dryskin', drySkin()],

  ['thickfat', incomingMultiplier(0.5, (_ctx, payload) => payload.move.type === 'Fire' || payload.move.type === 'Ice')],
  ['heatproof', incomingMultiplier(0.5, (_ctx, payload) => payload.move.type === 'Fire')],
  ['icescales', incomingMultiplier(0.5, (_ctx, payload) => payload.move.category === 'Special')],
  ['multiscale', incomingMultiplier(0.5, (ctx) => ctx.owner.hp === ctx.owner.maxHp)],
  ['shadowshield', incomingMultiplier(0.5, (ctx) => ctx.owner.hp === ctx.owner.maxHp)],
  ['filter', incomingMultiplier(0.75, (_ctx, payload) => payload.effectiveness > 1)],
  ['solidrock', incomingMultiplier(0.75, (_ctx, payload) => payload.effectiveness > 1)],
  ['prismarmor', incomingMultiplier(0.75, (_ctx, payload) => payload.effectiveness > 1)],

  ['toughclaws', outgoingMultiplier(1.3, (payload) => payload.contact && payload.move.basePower > 0)],
  ['strongjaw', outgoingMultiplier(1.5, (payload) => Boolean(payload.move.flags.bite))],
  ['ironfist', outgoingMultiplier(1.2, (payload) => Boolean(payload.move.flags.punch))],
  ['sharpness', outgoingMultiplier(1.5, (payload) => Boolean(payload.move.flags.slicing))],
  ['hugepower', outgoingMultiplier(2, (payload) => payload.move.category === 'Physical' && payload.move.basePower > 0)],
  ['purepower', outgoingMultiplier(2, (payload) => payload.move.category === 'Physical' && payload.move.basePower > 0)],

  ['intrepidsword', switchInBoost({ atk: 1 })],
  ['dauntlessshield', switchInBoost({ def: 1 })],
  ['moxie', koBoost({ atk: 1 })],

  ['chlorophyll', weatherSpeed('sun', 2)],
  ['swiftswim', weatherSpeed('rain', 2)],
  ['sandrush', weatherSpeed('sand', 2)],
  ['quickfeet', quickFeet()],

  ['compoundeyes', accuracyModifier(1.3, (ctx) => ctx.owner === ctx.source)],
  ['hustle', hustle()],
  ['sandveil', accuracyModifier(0.8, (ctx) => ctx.owner === ctx.target && ctx.state.weather === 'sand')],
  ['snowcloak', accuracyModifier(0.8, (ctx) => ctx.owner === ctx.target && ctx.state.weather === 'snow')],

  ['adaptability', adaptability()],
  ['tintedlens', outgoingMultiplier(2, (payload) => payload.effectiveness < 1)],
  ['sheerforce', sheerForce()],
  ['reckless', outgoingMultiplier(1.2, (payload) => Boolean(payload.move.recoil))],
  ['punkrock', punkRock()],
  ['waterbubble', waterBubble()],
  ['fluffy', fluffy()],
  ['flashfire', flashFire()],

  ['icebody', weatherHeal('snow', 'Ice Body')],
  ['raindish', weatherHeal('rain', 'Rain Dish')],
  ['hydration', hydration()],

  ['leafguard', leafGuard()],
  ['shielddust', shieldDust()],
  ['owntempo', volatileImmunity('Own Tempo', ['confusion'])],
  ['innerfocus', volatileImmunity('Inner Focus', ['flinch'])],
  ['oblivious', volatileImmunity('Oblivious', ['taunt'])],
  ['aromaveil', volatileImmunity('Aroma Veil', ['taunt', 'encore'])],

  ['regenerator', regenerator()],
  ['naturalcure', naturalCure()],
  ['prankster', prankster()],
  ['galewings', galeWings()],
  ['frisk', frisk()],
  ['anticipation', anticipation()],
  ['download', download()],
  ['rattled', rattled()],
  ['pickpocket', pickpocket()],
  ['effectspore', effectSpore()],
  ['roughskin', roughSkin()],
  ['poisonheal', poisonHeal()],
  ['sweetveil', sweetVeil()],
  ['battlearmor', battleArmor()],
  ['shellarmor', battleArmor()],
  ['angerpoint', angerPoint()],
  ['infiltrator', infiltrator()],
  ['skilllink', skillLink()],
  ['damp', damp()],
  ['defiant', defiant()],
  ['competitive', competitive()],
  ['grasspelt', grassPelt()],
  ['bulletproof', bulletproof()],
  ['soundproof', soundproof()],

  ['poisontouch', poisonTouch()],
  ['gooey', gooey()],
  ['justified', justified()],
  ['marvelscale', marvelScale()],
  ['sandforce', sandForce()],
  ['eartheater', typeImmunity('Earth Eater', 'Ground', { healQuarter: true })],
  ['thermalexchange', thermalExchange()],
  ['simple', simple()],
  ['contrary', contrary()],
  ['synchronize', synchronize()],
  ['steadfast', steadfast()],
  ['rockhead', rockHead()],
  ['moody', moody()],
  ['disguise', disguise()],
  ['overcoat', overcoat()],
  ['runaway', runAway()],
  ['analytic', analytic()],
  ['stakeout', stakeout()],

  ['wellbakedbody', typeImmunity('Well-Baked Body', 'Fire', { boost: { def: 2 } })],
  ['windrider', windRider()],
  ['watercompaction', waterCompaction()],
  ['stamina', stamina()],
  ['weakarmor', weakArmor()],
  ['steamengine', steamEngine()],

  ['dragonsmaw', outgoingMultiplier(1.5, (payload) => payload.move.type === 'Dragon')],
  ['transistor', outgoingMultiplier(1.3, (payload) => payload.move.type === 'Electric')],
  ['rockypayload', outgoingMultiplier(1.5, (payload) => payload.move.type === 'Rock')],
  ['megalauncher', outgoingMultiplier(1.5, (payload) => Boolean(payload.move.flags.pulse))],
  ['sniper', sniper()],

  ['superluck', superLuck()],
  ['merciless', merciless()],
  ['solarpower', solarPower()],
  ['flareboost', flareBoost()],
  ['toxicboost', toxicBoost()],

  ['goodasgold', goodAsGold()],
  ['purifyingsalt', purifyingSalt()],
  ['comatose', comatose()],

  ['noguard', noGuard()],
  ['slushrush', weatherSpeed('snow', 2)],
  ['surgesurfer', surgeSurfer()],
  ['tangledfeet', tangledFeet()],

  ['toxicchain', toxicChain()],
  ['stench', stench()],
  ['sandspit', sandSpit()],
  ['seedsower', seedSower()],

  ['furcoat', furCoat()],
  ['iceface', iceFace()],
  ['speedboost', speedBoost()],
  ['slowstart', slowStart()],
  ['unburden', unburden()],
  ['forewarn', forewarn()],
  ['supersweetsyrup', supersweetSyrup()],
  ['magician', magician()],
  ['lingeringaroma', lingeringAroma()],
  ['harvest', harvest()],
  ['pressure', pressure()],

  ['armortail', priorityBlocker('Armor Tail')],
  ['dazzling', priorityBlocker('Dazzling')],
  ['queenlymajesty', priorityBlocker('Queenly Majesty')],
  ['triage', triage()],
  ['serenegrace', sereneGrace()],
  ['wonderskin', wonderSkin()],
  ['mirrorarmor', mirrorArmor()],
  ['opportunist', opportunist()],
  ['tanglinghair', tanglingHair()],
  ['aftermath', aftermath()],
  ['baddreams', badDreams()],
  ['poisonpuppeteer', poisonPuppeteer()],
  ['berserk', pinchDrop('Berserk', { spa: 1 })],
  ['angershell', pinchDrop('Anger Shell', { atk: 1, spa: 1, spe: 1, def: -1, spd: -1 })],
  ['chillingneigh', koBoost({ atk: 1 })],
  ['grimneigh', koBoost({ spa: 1 })],
  ['steelyspirit', outgoingMultiplier(1.5, (payload) => payload.move.type === 'Steel')],
  ['supremeoverlord', supremeOverlord()],
  ['fullmetalbody', statGuard('all')],
  ['klutz', {}],

  ['scrappy', pierceGhostImmunity()],
  ['mindseye', pierceGhostImmunity()],
  ['trace', trace()],
  ['electromorphosis', chargeOnHit('Electromorphosis', (payload) => payload.move.basePower > 0)],
  ['windpower', chargeOnHit('Wind Power', (payload) => Boolean(payload.move.flags.wind))],
  ['soulheart', soulHeart()],
  ['quickdraw', quickDraw()],
  ['stall', stall()],

  // Behaviour that lives at the call site: Magic Guard and Long Reach in the
  // turn loop and `fighter.ts`, Truant, Protean and Libero in `useMove`.
  ['magicguard', {}],
  ['longreach', {}],
  ['truant', {}],
  ['protean', {}],
  ['libero', {}],

  // Passive effects whose behaviour lives at the call site: Guard Dog in
  // Intimidate, Early Bird and Corrosion in status.ts, Liquid Ooze in the turn
  // loop, Sticky Hold in the theft handlers and the berry abilities in items.ts.
  ['guarddog', {}],
  ['earlybird', {}],
  ['corrosion', {}],
  ['liquidooze', {}],
  ['stickyhold', {}],
  ['ripen', {}],
  ['cheekpouch', {}],
  ['unnerve', {}],
];

export function abilityEffects(): readonly EffectDefinition[] {
  return ABILITIES.map(([id, handlers]) => ({ id, kind: 'ability', handlers }));
}

export function registerAbilityEffects(): void {
  registerEffects(abilityEffects());
}

registerAbilityEffects();
