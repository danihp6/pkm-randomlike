import { getItem } from '../../../data/items';
import { effectiveness, getMove } from '../../../data/dex';
import {
  applyDamage,
  applyHeal,
  hasAbility,
  isGrounded,
  stagedStat,
  transformInto,
  type BattleFighter,
  type BoostId,
  type StatusId,
} from '../fighter';
import { cureStatus } from '../status';
import {
  opponentOf,
  pushEvent,
  pushText,
  effectiveWeather,
  SIDE_IDS,
  activeFighter,
  type BattleText,
  type BattleTextKey,
  type WeatherId,
} from '../state';
import { applyFlinch, applyConfusion, applyAttract, applyPerish } from '../volatile';
import { abilityMoveType } from '../moveType';
import { applyBoostEffect, applyStatusEffect } from './apply';
import { applyHeldItemEffect } from './items';
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

const STAT_GUARD: Readonly<Record<BoostId, BattleTextKey>> = {
  atk: 'battle.log.ability.statGuard.atk',
  def: 'battle.log.ability.statGuard.def',
  spa: 'battle.log.ability.statGuard.spa',
  spd: 'battle.log.ability.statGuard.spd',
  spe: 'battle.log.ability.statGuard.spe',
  accuracy: 'battle.log.ability.statGuard.accuracy',
  evasion: 'battle.log.ability.statGuard.evasion',
};

const MIRROR_ARMOR: Readonly<Record<BoostId, BattleTextKey>> = {
  atk: 'battle.log.ability.mirrorArmor.atk',
  def: 'battle.log.ability.mirrorArmor.def',
  spa: 'battle.log.ability.mirrorArmor.spa',
  spd: 'battle.log.ability.mirrorArmor.spd',
  spe: 'battle.log.ability.mirrorArmor.spe',
  accuracy: 'battle.log.ability.mirrorArmor.accuracy',
  evasion: 'battle.log.ability.mirrorArmor.evasion',
};

const BEAST_BOOST: Readonly<Record<BoostId, BattleTextKey>> = {
  atk: 'battle.log.ability.beastBoost.atk',
  def: 'battle.log.ability.beastBoost.def',
  spa: 'battle.log.ability.beastBoost.spa',
  spd: 'battle.log.ability.beastBoost.spd',
  spe: 'battle.log.ability.beastBoost.spe',
  accuracy: 'battle.log.ability.beastBoost.accuracy',
  evasion: 'battle.log.ability.beastBoost.evasion',
};

const LEAF_GUARD: Readonly<Record<StatusId, BattleTextKey>> = {
  brn: 'battle.log.ability.leafGuard.brn',
  psn: 'battle.log.ability.leafGuard.psn',
  tox: 'battle.log.ability.leafGuard.tox',
  par: 'battle.log.ability.leafGuard.par',
  slp: 'battle.log.ability.leafGuard.slp',
  frz: 'battle.log.ability.leafGuard.frz',
};

const SYNCHRONIZE: Readonly<Partial<Record<StatusId, BattleTextKey>>> = {
  brn: 'battle.log.ability.synchronize.brn',
  psn: 'battle.log.ability.synchronize.psn',
  par: 'battle.log.ability.synchronize.par',
};

function intimidate(): EffectHandlers {
  return {
    onSwitchIn: (ctx) => {
      const foe = ctx.target;
      if (!foe || foe.hp <= 0) return;
      if (hasAbility(foe, 'Inner Focus')) {
        pushText(ctx.state, 'battle.log.ability.innerFocus', { name: foe.name });
        return;
      }
      if (hasAbility(foe, 'Scrappy')) {
        pushText(ctx.state, 'battle.log.ability.scrappy', { name: foe.name });
        return;
      }
      if (hasAbility(foe, 'Guard Dog')) {
        applyBoostEffect(
          ctx.state,
          opponentOf(ctx.side),
          foe,
          { atk: 1 },
          {
            self: true,
            message: { key: 'battle.log.ability.guardDog', params: { name: foe.name } },
          },
        );
        return;
      }
      applyBoostEffect(
        ctx.state,
        opponentOf(ctx.side),
        foe,
        { atk: -1 },
        {
          message: {
            key: 'battle.log.ability.intimidate',
            params: { name: ctx.owner.name, target: foe.name },
          },
        },
      );
      if (hasAbility(foe, 'Rattled')) {
        applyBoostEffect(
          ctx.state,
          opponentOf(ctx.side),
          foe,
          { spe: 1 },
          {
            self: true,
            message: { key: 'battle.log.ability.rattled', params: { name: foe.name } },
          },
        );
      }
    },
  };
}

function levitate(): EffectHandlers {
  return {
    onTryHit: (ctx, payload) => {
      if (ctx.owner !== ctx.target) return;
      if (payload.move.type !== 'Ground') return;
      pushText(ctx.state, 'battle.log.ability.levitate', { name: ctx.owner.name });
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
      pushText(ctx.state, 'battle.log.ability.sturdy', { name: holder.name });
      return Math.max(1, holder.hp - 1);
    },
  };
}

function statusImmunity(blocked: readonly (readonly [StatusId, BattleTextKey])[]): EffectHandlers {
  const keys = new Map<StatusId, BattleTextKey>(blocked);
  return {
    onStatus: (ctx, payload) => {
      if (ctx.owner !== ctx.source) return;
      const key = keys.get(payload.status as StatusId);
      if (key === undefined) return;
      pushText(ctx.state, key, { name: ctx.owner.name });
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
      applyStatusEffect(ctx.state, ctx.side, attacker, status, {
        key: 'battle.log.ability.contactStatus',
        params: { name: attacker.name, ability },
      });
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
      pushText(ctx.state, STAT_GUARD[payload.stat], {
        name: ctx.owner.name,
        ability: ctx.owner.ability,
      });
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
      pushText(ctx.state, 'battle.log.ability.shedSkin', { name: holder.name });
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
      pushText(ctx.state, 'battle.log.ability.typeImmunity', { name: ctx.owner.name, ability });
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
      if (effectiveWeather(ctx.state) === 'rain') {
        healHolder(ctx, 8);
        pushText(ctx.state, 'battle.log.ability.drySkin.absorbed', { name: ctx.owner.name });
      } else if (effectiveWeather(ctx.state) === 'sun') {
        damageHolder(ctx, 8);
        pushText(ctx.state, 'battle.log.ability.drySkin.sunHurt', { name: ctx.owner.name });
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
      if (effectiveWeather(ctx.state) !== weather) return;
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

function accuracyModifier(multiplier: number, applies: (ctx: EffectContext) => boolean): EffectHandlers {
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
      if (ctx.owner === ctx.source && payload.move.type === 'Water')
        return scaledDamage(payload.damage, 2);
      if (ctx.owner === ctx.target && payload.move.type === 'Fire')
        return scaledDamage(payload.damage, 0.5);
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
      pushText(ctx.state, 'battle.log.ability.flashFire', { name: ctx.owner.name });
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
      pushText(ctx.state, 'battle.log.ability.weatherHeal', { name: ctx.owner.name, ability });
    },
  };
}

function hydration(): EffectHandlers {
  return {
    onResidual: (ctx) => {
      const holder = ctx.owner;
      if (holder.hp <= 0 || holder.status === null || effectiveWeather(ctx.state) !== 'rain') return;
      const cured = cureStatus(holder);
      if (!cured) return;
      pushEvent(ctx.state, { kind: 'cure', side: ctx.side, status: cured });
      pushText(ctx.state, 'battle.log.ability.hydration', { name: holder.name });
    },
  };
}

function leafGuard(): EffectHandlers {
  return {
    onStatus: (ctx, payload) => {
      if (ctx.owner !== ctx.source || effectiveWeather(ctx.state) !== 'sun') return;
      pushText(ctx.state, LEAF_GUARD[payload.status as StatusId], { name: ctx.owner.name });
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
      pushText(ctx.state, 'battle.log.ability.shieldDust', { name: ctx.owner.name });
      return false;
    },
  };
}

function volatileImmunity(ability: string, blocked: readonly string[]): EffectHandlers {
  return {
    onTryVolatile: (ctx, payload) => {
      if (ctx.owner !== ctx.source || !blocked.includes(payload.volatile)) return;
      pushText(ctx.state, 'battle.log.ability.volatileImmunity', { name: ctx.owner.name, ability });
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
    applyStatusEffect(ctx.state, opponentOf(ctx.side), attacker, status, {
      key: 'battle.log.ability.effectSpore',
      params: { name: attacker.name },
    });
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
    pushText(ctx.state, 'battle.log.ability.roughSkin', { name: attacker.name, target: ctx.owner.name });
  });
}

function pickpocket(): EffectHandlers {
  return contactReaction((ctx, attacker) => {
    if (ctx.owner.heldItem || !attacker.heldItem) return;
    if (hasAbility(attacker, 'Sticky Hold')) {
      pushText(ctx.state, 'battle.log.ability.stickyHold', { name: attacker.name });
      return;
    }
    const itemId = attacker.heldItem;
    ctx.owner.heldItem = itemId;
    attacker.heldItem = null;
    pushText(ctx.state, 'battle.log.ability.pickpocket', {
      name: ctx.owner.name,
      target: attacker.name,
      item: itemId,
    });
  });
}

function rattled(): EffectHandlers {
  return {
    onAfterMove: (ctx, payload) => {
      if (ctx.owner !== ctx.target) return;
      if (ctx.owner.hp <= 0) return;
      if (!['Bug', 'Dark', 'Ghost'].includes(payload.move.type)) return;
      applyBoostEffect(
        ctx.state,
        opponentOf(ctx.side),
        ctx.owner,
        { spe: 1 },
        {
          self: true,
          message: { key: 'battle.log.ability.rattled', params: { name: ctx.owner.name } },
        },
      );
    },
  };
}

function regenerator(): EffectHandlers {
  return {
    onSwitchOut: (ctx) => {
      if (ctx.owner.hp <= 0) return;
      const healed = applyHeal(ctx.owner, Math.max(1, Math.floor(ctx.owner.maxHp / 3)));
      if (healed <= 0) return;
      pushEvent(ctx.state, {
        kind: 'heal',
        side: ctx.side,
        amount: healed,
        hp: ctx.owner.hp,
        maxHp: ctx.owner.maxHp,
      });
      pushText(ctx.state, 'battle.log.ability.regenerator', { name: ctx.owner.name });
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
      pushText(ctx.state, 'battle.log.ability.naturalCure', { name: ctx.owner.name });
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
      pushText(ctx.state, 'battle.log.ability.frisk', {
        name: ctx.owner.name,
        target: foe.name,
        item: foe.heldItem,
      });
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
      if (dangerous) pushText(ctx.state, 'battle.log.ability.anticipation', { name: ctx.owner.name });
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
        message: {
          key: raisesAttack ? 'battle.log.ability.download.atk' : 'battle.log.ability.download.spa',
          params: { name: ctx.owner.name },
        },
      });
    },
  };
}

function defiant(): EffectHandlers {
  return {
    onBoost: (ctx, payload) => {
      if (ctx.owner !== ctx.source || payload.self || payload.stages >= 0) return;
      applyBoostEffect(
        ctx.state,
        ctx.side,
        ctx.owner,
        { atk: 2 },
        {
          self: true,
          message: { key: 'battle.log.ability.defiant', params: { name: ctx.owner.name } },
        },
      );
    },
  };
}

function competitive(): EffectHandlers {
  return {
    onBoost: (ctx, payload) => {
      if (ctx.owner !== ctx.source || payload.self || payload.stages >= 0) return;
      applyBoostEffect(
        ctx.state,
        ctx.side,
        ctx.owner,
        { spa: 2 },
        {
          self: true,
          message: { key: 'battle.log.ability.competitive', params: { name: ctx.owner.name } },
        },
      );
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
      pushEvent(ctx.state, {
        kind: 'heal',
        side: ctx.side,
        amount: healed,
        hp: holder.hp,
        maxHp: holder.maxHp,
      });
      pushText(ctx.state, 'battle.log.ability.poisonHeal', { name: holder.name });
    },
  };
}

function sweetVeil(): EffectHandlers {
  return {
    onStatus: (ctx, payload) => {
      if (ctx.owner !== ctx.source || payload.status !== 'slp') return;
      pushText(ctx.state, 'battle.log.ability.sweetVeil', { name: ctx.owner.name });
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
      applyBoostEffect(
        ctx.state,
        opponentOf(ctx.side),
        ctx.owner,
        { atk: 12 },
        {
          self: true,
          message: { key: 'battle.log.ability.angerPoint', params: { name: ctx.owner.name } },
        },
      );
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
      pushText(ctx.state, 'battle.log.ability.damp', { name: ctx.owner.name });
      return false;
    },
  };
}

function bulletproof(): EffectHandlers {
  return {
    onTryHit: (ctx, payload) => {
      if (ctx.owner !== ctx.target || !payload.move.flags.bullet) return;
      pushText(ctx.state, 'battle.log.ability.bulletproof', { name: ctx.owner.name });
      return false;
    },
  };
}

function soundproof(): EffectHandlers {
  return {
    onTryHit: (ctx, payload) => {
      if (ctx.owner !== ctx.target || !payload.move.flags.sound) return;
      pushText(ctx.state, 'battle.log.ability.soundproof', { name: ctx.owner.name });
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
      applyStatusEffect(ctx.state, opponentOf(ctx.side), ctx.target, 'psn', {
        key: 'battle.log.ability.poisonTouch',
        params: { name: ctx.target.name },
      });
    },
  };
}

function gooey(): EffectHandlers {
  return contactReaction((ctx, attacker) => {
    applyBoostEffect(
      ctx.state,
      opponentOf(ctx.side),
      attacker,
      { spe: -1 },
      {
        message: { key: 'battle.log.ability.gooey', params: { name: attacker.name } },
      },
    );
  });
}

function justified(): EffectHandlers {
  return {
    onAfterMove: (ctx, payload) => {
      if (ctx.owner !== ctx.target || ctx.owner.hp <= 0) return;
      if (payload.move.type !== 'Dark') return;
      applyBoostEffect(
        ctx.state,
        opponentOf(ctx.side),
        ctx.owner,
        { atk: 1 },
        {
          self: true,
          message: { key: 'battle.log.ability.justified', params: { name: ctx.owner.name } },
        },
      );
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
      if (ctx.owner !== ctx.source || effectiveWeather(ctx.state) !== 'sand') return;
      if (!['Rock', 'Ground', 'Steel'].includes(payload.move.type)) return;
      return scaledDamage(payload.damage, 1.3);
    },
  };
}

function thermalExchange(): EffectHandlers {
  return {
    onTryHit: (ctx, payload) => {
      if (ctx.owner !== ctx.target || payload.move.type !== 'Fire') return;
      applyBoostEffect(
        ctx.state,
        opponentOf(ctx.side),
        ctx.owner,
        { atk: 1 },
        {
          self: true,
          message: {
            key: 'battle.log.ability.thermalExchange.raisedAttack',
            params: { name: ctx.owner.name },
          },
        },
      );
      pushText(ctx.state, 'battle.log.ability.thermalExchange.absorbed', { name: ctx.owner.name });
      return false;
    },
    onStatus: (ctx, payload) => {
      if (ctx.owner !== ctx.source || payload.status !== 'brn') return;
      pushText(ctx.state, 'battle.log.ability.thermalExchange.preventsBurns', { name: ctx.owner.name });
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
      if (hasAbility(ctx.target, 'Synchronize')) return;
      const key = SYNCHRONIZE[status as StatusId];
      if (key === undefined) return;
      applyStatusEffect(ctx.state, opponentOf(ctx.side), ctx.target, status, {
        key,
        params: { name: ctx.target.name },
      });
    },
  };
}

function steadfast(): EffectHandlers {
  return {
    onTryVolatile: (ctx, payload) => {
      if (ctx.owner !== ctx.source || payload.volatile !== 'flinch') return;
      applyBoostEffect(
        ctx.state,
        ctx.side,
        ctx.owner,
        { spe: 1 },
        {
          self: true,
          message: { key: 'battle.log.ability.steadfast', params: { name: ctx.owner.name } },
        },
      );
    },
  };
}

function rockHead(): EffectHandlers {
  return {
    onModifyRecoil: (ctx) => {
      if (ctx.owner !== ctx.source) return;
      pushText(ctx.state, 'battle.log.ability.rockHead', { name: ctx.owner.name });
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
      applyBoostEffect(
        ctx.state,
        ctx.side,
        ctx.owner,
        { [raise]: 2, [lower]: -1 },
        {
          self: true,
          message: { key: 'battle.log.ability.moody', params: { name: ctx.owner.name } },
        },
      );
    },
  };
}

function overcoat(): EffectHandlers {
  return {
    onTryHit: (ctx, payload) => {
      if (ctx.owner !== ctx.target || !payload.move.flags.powder) return;
      pushText(ctx.state, 'battle.log.ability.overcoat', { name: ctx.owner.name });
      return false;
    },
  };
}

/**
 * Reworked Wonder Guard: from the moment the holder enters the field it absorbs
 * the **first** damaging hit as long as that hit is not super effective. The
 * shield is spent on that first damaging hit even when a super-effective move
 * pierces it, so it is one protected hit per entry — the second hits normally.
 * A move the holder is outright immune to never spends the shield.
 */
function wonderGuard(): EffectHandlers {
  return {
    onStart: (ctx) => {
      if (ctx.owner === ctx.source) ctx.owner.volatiles.wonderGuard = true;
    },
    onTryHit: (ctx, payload) => {
      if (ctx.owner !== ctx.target || !ctx.owner.volatiles.wonderGuard) return;
      const move = payload.move;
      if (move.category === 'Status' || move.basePower <= 0) return;
      const chart = effectiveness(move.type, ctx.owner.types);
      if (chart <= 0) return;
      ctx.owner.volatiles.wonderGuard = false;
      if (chart > 1) return;
      pushText(ctx.state, 'battle.log.ability.wonderGuard', { name: ctx.owner.name });
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
  text: BattleText,
): void {
  applyBoostEffect(ctx.state, opponentOf(ctx.side), ctx.owner, boosts, {
    self: true,
    message: text,
  });
}

function windRider(): EffectHandlers {
  return {
    onTryHit: (ctx, payload) => {
      if (ctx.owner !== ctx.target || !payload.move.flags.wind) return;
      pushText(ctx.state, 'battle.log.ability.windRider', { name: ctx.owner.name });
      selfBoost(
        ctx,
        { atk: 1 },
        {
          key: 'battle.log.ability.windRider.raisedAttack',
          params: { name: ctx.owner.name },
        },
      );
      return false;
    },
  };
}

function stamina(): EffectHandlers {
  return hitReaction(
    (_ctx, payload) => damagingMove(payload),
    (ctx) => {
      selfBoost(
        ctx,
        { def: 1 },
        {
          key: 'battle.log.ability.stamina.raisedDefense',
          params: { name: ctx.owner.name },
        },
      );
    },
  );
}

function weakArmor(): EffectHandlers {
  return hitReaction(
    (_ctx, payload) => payload.move.category === 'Physical' && payload.move.basePower > 0,
    (ctx) => {
      selfBoost(
        ctx,
        { def: -1, spe: 2 },
        {
          key: 'battle.log.ability.weakArmor',
          params: { name: ctx.owner.name },
        },
      );
    },
  );
}

function steamEngine(): EffectHandlers {
  return hitReaction(
    (_ctx, payload) =>
      damagingMove(payload) && (payload.move.type === 'Fire' || payload.move.type === 'Water'),
    (ctx) =>
      selfBoost(
        ctx,
        { spe: 6 },
        {
          key: 'battle.log.ability.steamEngine.raisedSpeed',
          params: { name: ctx.owner.name },
        },
      ),
  );
}

function waterCompaction(): EffectHandlers {
  return hitReaction(
    (_ctx, payload) => damagingMove(payload) && payload.move.type === 'Water',
    (ctx) =>
      selfBoost(
        ctx,
        { def: 2 },
        {
          key: 'battle.log.ability.waterCompaction.raisedDefense',
          params: { name: ctx.owner.name },
        },
      ),
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
      if (effectiveWeather(ctx.state) !== 'sun') return;
      return scaledDamage(payload.damage, 1.5);
    },
    onResidual: (ctx) => {
      if (ctx.owner.hp <= 0 || effectiveWeather(ctx.state) !== 'sun') return;
      damageHolder(ctx, 8);
      pushText(ctx.state, 'battle.log.ability.solarPower.sunHurt', { name: ctx.owner.name });
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
      pushText(ctx.state, 'battle.log.ability.goodAsGold', { name: ctx.owner.name });
      return false;
    },
  };
}

function purifyingSalt(): EffectHandlers {
  return {
    onStatus: (ctx) => {
      if (ctx.owner !== ctx.source) return;
      pushText(ctx.state, 'battle.log.ability.purifyingSalt', { name: ctx.owner.name });
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
      pushText(ctx.state, 'battle.log.ability.comatose', { name: ctx.owner.name });
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
  return accuracyModifier(0.5, (ctx) => ctx.owner === ctx.target && ctx.owner.volatiles.confusion > 0);
}

function toxicChain(): EffectHandlers {
  return {
    onAfterMove: (ctx, payload) => {
      if (ctx.owner !== ctx.source || !ctx.target) return;
      if (!payload.hit || !damagingMove(payload)) return;
      if (ctx.owner.hp <= 0 || ctx.target.hp <= 0) return;
      if (ctx.rng.int(1, 100) > 30) return;
      applyStatusEffect(ctx.state, opponentOf(ctx.side), ctx.target, 'psn', {
        key: 'battle.log.ability.toxicChain',
        params: { name: ctx.target.name },
      });
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
  return hitReaction(
    (_ctx, payload) => damagingMove(payload),
    (ctx) => {
      if (ctx.state.weather === 'sand') return;
      setWeather(ctx.state, 'sand');
    },
  );
}

function seedSower(): EffectHandlers {
  return hitReaction(
    (_ctx, payload) => damagingMove(payload),
    (ctx) => {
      if (ctx.state.terrain === 'grassy') return;
      setTerrain(ctx.state, 'grassy');
    },
  );
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
      pushText(ctx.state, 'battle.log.ability.iceFace', { name: ctx.owner.name });
      return false;
    },
  };
}

function speedBoost(): EffectHandlers {
  return {
    onResidual: (ctx) => {
      if (ctx.owner !== ctx.source || ctx.owner.hp <= 0) return;
      applyBoostEffect(
        ctx.state,
        ctx.side,
        ctx.owner,
        { spe: 1 },
        {
          self: true,
          message: { key: 'battle.log.ability.speedBoost', params: { name: ctx.owner.name } },
        },
      );
    },
  };
}

function slowStart(): EffectHandlers {
  return {
    onStart: (ctx) => {
      if (ctx.owner.hp <= 0) return;
      ctx.owner.volatiles.slowStart = 5;
      pushText(ctx.state, 'battle.log.ability.slowStart', { name: ctx.owner.name });
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
        pushText(ctx.state, 'battle.log.ability.slowStart.ready', { name: ctx.owner.name });
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
      let best: { id: string; power: number } | null = null;
      for (const slot of foe.moves) {
        const move = getMove(slot.moveId);
        if (!move) continue;
        if (!best || move.basePower > best.power) best = { id: move.id, power: move.basePower };
      }
      if (best)
        pushText(ctx.state, 'battle.log.ability.forewarn', {
          name: ctx.owner.name,
          move: best.id,
        });
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
      applyBoostEffect(
        ctx.state,
        opponentOf(ctx.side),
        foe,
        { evasion: -1 },
        {
          message: {
            key: 'battle.log.ability.supersweetSyrup',
            params: { name: ctx.owner.name, target: foe.name },
          },
        },
      );
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
      if (hasAbility(ctx.target, 'Sticky Hold')) {
        pushText(ctx.state, 'battle.log.ability.stickyHold', { name: ctx.target.name });
        return;
      }
      const itemId = ctx.target.heldItem;
      ctx.owner.heldItem = itemId;
      ctx.target.heldItem = null;
      pushText(ctx.state, 'battle.log.ability.magician', {
        name: ctx.owner.name,
        target: ctx.target.name,
        item: itemId,
      });
    },
  };
}

function lingeringAroma(): EffectHandlers {
  return contactReaction((ctx, attacker) => {
    if (hasAbility(attacker, 'Lingering Aroma')) return;
    attacker.ability = 'Lingering Aroma';
    pushText(ctx.state, 'battle.log.abilityBecame', {
      name: attacker.name,
      ability: 'Lingering Aroma',
    });
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
      pushText(ctx.state, 'battle.log.ability.harvest', { name: holder.name, item: itemId });
    },
  };
}

function pressure(): EffectHandlers {
  return {
    onSwitchIn: (ctx) => {
      if (ctx.owner.hp <= 0) return;
      pushText(ctx.state, 'battle.log.ability.pressure', { name: ctx.owner.name });
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
      pushText(ctx.state, 'battle.log.ability.priorityBlocker', { name: ctx.owner.name, ability });
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
      pushText(ctx.state, MIRROR_ARMOR[payload.stat], { name: ctx.owner.name });
      reflectingDrop = true;
      try {
        applyBoostEffect(ctx.state, opponentOf(ctx.side), ctx.target, {
          [payload.stat]: payload.stages,
        });
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
      applyBoostEffect(
        ctx.state,
        opponentOf(ctx.side),
        ctx.owner,
        { [payload.stat]: payload.stages },
        {
          self: true,
          message: { key: 'battle.log.ability.opportunist', params: { name: ctx.owner.name } },
        },
      );
    },
  };
}

/** Tangling Hair lowers the Speed of a contact attacker, like Gooey. */
function tanglingHair(): EffectHandlers {
  return contactReaction((ctx, attacker) => {
    applyBoostEffect(
      ctx.state,
      opponentOf(ctx.side),
      attacker,
      { spe: -1 },
      {
        message: { key: 'battle.log.ability.tanglingHair', params: { name: attacker.name } },
      },
    );
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
      pushText(ctx.state, 'battle.log.ability.aftermath', {
        name: attacker.name,
        target: ctx.owner.name,
      });
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
      pushText(ctx.state, 'battle.log.ability.badDreams', { name: foe.name, target: ctx.owner.name });
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
        pushText(ctx.state, 'battle.log.ability.poisonPuppeteer', { name: victim.name });
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
        message: { key: 'battle.log.ability.pinchDrop', params: { name: holder.name, ability } },
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

/**
 * Dark Matter (a hand-authored row, `src/data/dex/customAbilities.ts`): the
 * holder's moves ignore the type chart, so every hit is neutral — a 0x immunity
 * included, which the turn loop applies *after* this hook.
 */
function darkmatter(): EffectHandlers {
  return {
    onModifyEffectiveness: (ctx) => (ctx.owner === ctx.source ? 1 : undefined),
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
  'Tera Shift',
  'Zen Mode (Galar)',
]);

/** Trace copies the foe's ability on entry and runs its entry effects. */
function trace(): EffectHandlers {
  return {
    onSwitchIn: (ctx) => {
      const foe = ctx.target;
      if (!foe || !foe.ability || foe.ability === ctx.owner.ability) return;
      if (TRACE_BANNED.has(foe.ability)) return;
      ctx.owner.ability = foe.ability;
      pushText(ctx.state, 'battle.log.ability.trace', {
        name: ctx.owner.name,
        target: foe.name,
        ability: foe.ability,
      });
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
      pushText(ctx.state, 'battle.log.ability.chargeOnHit', { name: ctx.owner.name, ability });
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
      applyBoostEffect(
        ctx.state,
        ctx.side,
        ctx.owner,
        { spa: 1 },
        {
          self: true,
          message: { key: 'battle.log.ability.soulHeart', params: { name: ctx.owner.name } },
        },
      );
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

/** Mycelium Might forces the holder's status moves last inside their bracket. */
function myceliumMight(): EffectHandlers {
  return {
    onFractionalPriority: (ctx) => {
      if (ctx.owner !== ctx.source || ctx.move?.category !== 'Status') return;
      return -1;
    },
  };
}

/**
 * The abilities that retype the holder's moves (`-ate` set, Liquid Voice,
 * Normalize). The rule lives in `../moveType`, so the FIGHT menu, the party
 * panel and the damage calc all read the same type.
 */
function typeChangeAbility(): EffectHandlers {
  return {
    onModifyMoveType: (ctx, move) => {
      if (ctx.owner !== ctx.source) return;
      const type = abilityMoveType(ctx.owner.ability, move);
      return type === move.type ? undefined : type;
    },
  };
}

/** Cursed Body disables the contact attacker's last move 30% of the time. */
function cursedBody(): EffectHandlers {
  return contactReaction((ctx, attacker) => {
    if (ctx.rng.int(1, 100) > 30) return;
    const moveId = attacker.lastMoveId;
    if (!moveId || attacker.volatiles.disabledMove === moveId) return;
    attacker.volatiles.disabledMove = moveId;
    attacker.volatiles.disableTurns = 4;
    pushText(ctx.state, 'battle.log.ability.cursedBody', { name: attacker.name, move: moveId });
  });
}

/** Cute Charm infatuates the contact attacker 30% of the time. */
function cuteCharm(): EffectHandlers {
  return contactReaction((ctx, attacker) => {
    if (ctx.rng.int(1, 100) > 30) return;
    if (applyAttract(attacker)) {
      pushText(ctx.state, 'battle.log.ability.cuteCharm', {
        name: attacker.name,
        target: ctx.owner.name,
      });
    }
  });
}

/** Cud Chew gives a consumed berry one more bite at the end of the next turn. */
function cudChew(): EffectHandlers {
  return {
    onResidual: (ctx) => {
      const itemId = ctx.owner.volatiles.cudChew;
      if (!itemId) return;
      ctx.owner.volatiles.cudChew = null;
      if (ctx.owner.hp <= 0) return;
      const item = getItem(itemId);
      if (!item) return;
      pushText(ctx.state, 'battle.log.ability.cudChew', { name: ctx.owner.name });
      applyHeldItemEffect(ctx, item, true);
    },
  };
}

/** Hadron Engine sets Electric Terrain and powers up its Special moves there. */
function hadronEngine(): EffectHandlers {
  return {
    onSwitchIn: (ctx) => {
      if (ctx.owner.hp > 0) setTerrain(ctx.state, 'electric');
    },
    onModifyDamage: (ctx, payload) => {
      if (ctx.owner !== ctx.source || payload.move.category !== 'Special') return;
      if (ctx.state.terrain !== 'electric') return;
      return scaledDamage(payload.damage, 4 / 3);
    },
  };
}

/** Orichalcum Pulse sets harsh sunlight and powers up its physical moves there. */
function orichalcumPulse(): EffectHandlers {
  return {
    onSwitchIn: (ctx) => {
      if (ctx.owner.hp > 0) setWeather(ctx.state, 'sun');
    },
    onModifyDamage: (ctx, payload) => {
      if (ctx.owner !== ctx.source || payload.move.category !== 'Physical') return;
      if (effectiveWeather(ctx.state) !== 'sun') return;
      return scaledDamage(payload.damage, 4 / 3);
    },
  };
}

type ParadoxStat = 'atk' | 'def' | 'spa' | 'spd' | 'spe';

const PARADOX_ORDER: readonly ParadoxStat[] = ['atk', 'def', 'spa', 'spd', 'spe'];

/** Protosynthesis and Quark Drive boost the holder's highest stat. */
function highestStat(fighter: BattleFighter): ParadoxStat {
  let best = PARADOX_ORDER[0];
  for (const stat of PARADOX_ORDER) {
    if (fighter.stats[stat] > fighter.stats[best]) best = stat;
  }
  return best;
}

function paradox(active: (ctx: EffectContext) => boolean): EffectHandlers {
  return {
    onModifySpe: (ctx, speed) => {
      if (ctx.owner !== ctx.source || !active(ctx)) return;
      if (highestStat(ctx.owner) !== 'spe') return;
      return Math.max(1, Math.floor(speed * 1.5));
    },
    onModifyDamage: (ctx, payload) => {
      if (!active(ctx)) return;
      const stat = highestStat(ctx.owner);
      const physical = payload.move.category === 'Physical';
      if (ctx.owner === ctx.source) {
        if ((stat === 'atk' && physical) || (stat === 'spa' && !physical)) {
          return scaledDamage(payload.damage, 1.3);
        }
      } else if (ctx.owner === ctx.target) {
        if ((stat === 'def' && physical) || (stat === 'spd' && !physical)) {
          return Math.max(1, Math.floor(payload.damage / 1.3));
        }
      }
    },
  };
}

function protosynthesis(): EffectHandlers {
  return paradox((ctx) => effectiveWeather(ctx.state) === 'sun');
}

function quarkDrive(): EffectHandlers {
  return paradox((ctx) => ctx.state.terrain === 'electric');
}

/** Rivalry is stronger against the same gender and weaker against the opposite. */
function rivalry(): EffectHandlers {
  return {
    onModifyDamage: (ctx, payload) => {
      if (ctx.owner !== ctx.source || !ctx.target) return;
      const gender = ctx.owner.gender;
      const foe = ctx.target.gender;
      if (gender === 'genderless' || foe === 'genderless') return;
      return scaledDamage(payload.damage, gender === foe ? 1.25 : 0.75);
    },
  };
}

/** Imposter transforms into the foe as soon as the holder switches in. */
function imposter(): EffectHandlers {
  return {
    onSwitchIn: (ctx) => {
      const foe = ctx.target;
      if (!foe || foe.hp <= 0 || ctx.owner.hp <= 0) return;
      if (ctx.owner.volatiles.transformed) return;
      const userName = ctx.owner.name;
      const foeName = foe.name;
      if (transformInto(ctx.owner, foe)) {
        pushText(ctx.state, 'battle.log.move.transform', { name: userName, target: foeName });
      }
    },
  };
}

/** Illusion wears the last healthy party member as a disguise until it is hit. */
function illusion(): EffectHandlers {
  return {
    onSwitchIn: (ctx) => {
      const side = ctx.state.sides[ctx.side];
      const candidates = side.party.filter(
        (fighter, index) => index !== side.activeIndex && fighter.hp > 0,
      );
      const last = candidates[candidates.length - 1];
      if (last) ctx.owner.volatiles.illusion = last.speciesId;
    },
    onAfterMove: (ctx, payload) => {
      if (ctx.owner !== ctx.target || !payload.hit || payload.move.basePower <= 0) return;
      if (ctx.owner.volatiles.illusion === null) return;
      ctx.owner.volatiles.illusion = null;
      pushText(ctx.state, 'battle.log.ability.illusion', { name: ctx.owner.name });
    },
  };
}

/** The aura abilities power up one type for every Pokémon on the field. */
function aura(type: string): EffectHandlers {
  return {
    onModifyDamage: (ctx, payload) => {
      if (payload.move.type !== type) return;
      const broken = SIDE_IDS.some((side) => hasAbility(activeFighter(ctx.state, side), 'Aura Break'));
      return scaledDamage(payload.damage, broken ? 0.75 : 4 / 3);
    },
  };
}

/** Defeatist halves Attack and Sp. Atk once the holder is at or below half HP. */
function defeatist(): EffectHandlers {
  return {
    onModifyDamage: (ctx, payload) => {
      if (ctx.owner !== ctx.source) return;
      if (ctx.owner.hp * 2 > ctx.owner.maxHp) return;
      if (payload.move.category === 'Status' || payload.move.basePower <= 0) return;
      return Math.max(1, Math.floor(payload.damage / 2));
    },
  };
}

/** Beast Boost raises the holder's highest stat after a knockout. */
function beastBoost(): EffectHandlers {
  return {
    onAfterMove: (ctx, payload) => {
      if (ctx.owner !== ctx.source || !ctx.target) return;
      if (ctx.target.hp > 0 || payload.move.basePower <= 0) return;
      const stat = highestStat(ctx.owner);
      applyBoostEffect(
        ctx.state,
        ctx.side,
        ctx.owner,
        { [stat]: 1 },
        {
          self: true,
          message: { key: BEAST_BOOST[stat], params: { name: ctx.owner.name } },
        },
      );
    },
  };
}

/** Color Change makes the holder take on the type of the move that hit it. */
function colorChange(): EffectHandlers {
  return {
    onAfterMove: (ctx, payload) => {
      if (ctx.owner !== ctx.target || ctx.owner.hp <= 0) return;
      if (payload.move.category === 'Status' || payload.move.basePower <= 0) return;
      if (ctx.owner.types.length === 1 && ctx.owner.types[0] === payload.move.type) return;
      ctx.owner.types = [payload.move.type];
      pushText(ctx.state, 'battle.log.ability.colorChange', {
        name: ctx.owner.name,
        type: payload.move.type,
      });
    },
  };
}

/** Cotton Down lowers the Speed of whatever hits the holder. */
function cottonDown(): EffectHandlers {
  return {
    onAfterMove: (ctx, payload) => {
      if (ctx.owner !== ctx.target || ctx.owner.hp <= 0) return;
      if (!payload.hit || payload.move.category === 'Status' || payload.move.basePower <= 0) return;
      if (ctx.owner.volatiles.substitute > 0) return;
      applyBoostEffect(
        ctx.state,
        opponentOf(ctx.side),
        ctx.source,
        { spe: -1 },
        {
          message: { key: 'battle.log.ability.cottonDown', params: { name: ctx.source.name } },
        },
      );
    },
  };
}

/** Gorilla Tactics boosts Attack but locks the holder into its first move. */
function gorillaTactics(): EffectHandlers {
  return {
    onModifyDamage: (ctx, payload) => {
      if (ctx.owner !== ctx.source) return;
      if (payload.move.category !== 'Physical' || payload.move.basePower <= 0) return;
      return scaledDamage(payload.damage, 1.5);
    },
    onAfterMove: (ctx, payload) => {
      if (ctx.owner !== ctx.source) return;
      if (ctx.owner.volatiles.gorillaTactics !== null) return;
      if (payload.move.category === 'Status' || payload.move.basePower <= 0) return;
      ctx.owner.volatiles.gorillaTactics = payload.move.id;
    },
  };
}

/** Innards Out deals back the HP the holder had before the hit that fainted it. */
function innardsOut(): EffectHandlers {
  return {
    onAfterMove: (ctx) => {
      if (ctx.owner !== ctx.target || ctx.owner.hp > 0) return;
      const damage = ctx.owner.volatiles.lastDamageTaken;
      if (damage <= 0) return;
      const attacker = ctx.source;
      if (attacker.hp <= 0) return;
      const dealt = applyDamage(attacker, damage);
      pushEvent(ctx.state, {
        kind: 'damage',
        side: opponentOf(ctx.side),
        amount: dealt,
        hp: attacker.hp,
        maxHp: attacker.maxHp,
        effectiveness: 1,
        crit: false,
      });
      pushText(ctx.state, 'battle.log.ability.innardsOut', {
        name: attacker.name,
        target: ctx.owner.name,
      });
    },
  };
}

/** Iron Barbs punishes a contact attacker with an eighth of its max HP. */
function ironBarbs(): EffectHandlers {
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
    pushText(ctx.state, 'battle.log.ability.ironBarbs', { name: attacker.name, target: ctx.owner.name });
  });
}

/** Mimicry retypes the holder to match the active terrain. */
function mimicry(): EffectHandlers {
  const typeFor = (ctx: EffectContext): string => {
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
  };
  const evaluate = (ctx: EffectContext): void => {
    if (ctx.owner !== ctx.source || ctx.owner.hp <= 0) return;
    const type = typeFor(ctx);
    if (ctx.owner.types.length === 1 && ctx.owner.types[0] === type) return;
    ctx.owner.types = [type];
  };
  return { onStart: evaluate, onResidual: evaluate };
}

/** Mummy overwrites the ability of whatever makes contact with the holder. */
function mummy(): EffectHandlers {
  return contactReaction((ctx, attacker) => {
    if (hasAbility(attacker, 'Mummy')) return;
    attacker.ability = 'Mummy';
    pushText(ctx.state, 'battle.log.abilityBecame', { name: attacker.name, ability: 'Mummy' });
  });
}

/** Neuroforce powers up super-effective moves. */
function neuroforce(): EffectHandlers {
  return {
    onModifyDamage: (ctx, payload) => {
      if (ctx.owner !== ctx.source) return;
      if (payload.effectiveness <= 1) return;
      return scaledDamage(payload.damage, 1.25);
    },
  };
}

/** Pastel Veil shields the holder from poison. */
function pastelVeil(): EffectHandlers {
  return {
    onStatus: (ctx, payload) => {
      if (ctx.owner !== ctx.source) return;
      if (payload.status !== 'psn' && payload.status !== 'tox') return;
      pushText(ctx.state, 'battle.log.ability.pastelVeil', { name: ctx.owner.name });
      return false;
    },
  };
}

/** Perish Body puts a perish count on both the holder and the contact attacker. */
function perishBody(): EffectHandlers {
  return contactReaction((ctx, attacker) => {
    if (ctx.owner.volatiles.perish > 0 && attacker.volatiles.perish > 0) return;
    applyPerish(ctx.owner);
    applyPerish(attacker);
    pushText(ctx.state, 'battle.log.ability.perishBody', { name: ctx.owner.name });
  });
}

/** Screen Cleaner wipes Reflect, Light Screen and Aurora Veil on entry. */
function screenCleaner(): EffectHandlers {
  return {
    onSwitchIn: (ctx) => {
      if (ctx.owner.hp <= 0) return;
      let cleared = false;
      for (const side of SIDE_IDS) {
        const conditions = ctx.state.sides[side].sideConditions;
        if (conditions.reflect > 0 || conditions.lightscreen > 0 || conditions.auroraveil > 0)
          cleared = true;
        conditions.reflect = 0;
        conditions.lightscreen = 0;
        conditions.auroraveil = 0;
      }
      if (cleared) pushText(ctx.state, 'battle.log.ability.screenCleaner', { name: ctx.owner.name });
    },
  };
}

/** Wandering Spirit swaps the holder's ability with a contact attacker's. */
function wanderingSpirit(): EffectHandlers {
  return contactReaction((ctx, attacker) => {
    if (attacker.ability === ctx.owner.ability) return;
    const mine = ctx.owner.ability;
    ctx.owner.ability = attacker.ability;
    attacker.ability = mine;
    pushText(ctx.state, 'battle.log.ability.wanderingSpirit', {
      name: ctx.owner.name,
      target: attacker.name,
    });
  });
}

/** Wimp Out and Emergency Exit ask for a switch once HP drops to half or below. */
function escapeBelowHalf(ability: string): EffectHandlers {
  return hitReaction(
    (ctx, payload) => {
      if (!damagingMove(payload)) return false;
      if (ctx.owner.hp <= 0 || ctx.owner.hp * 2 > ctx.owner.maxHp) return false;
      if (ctx.owner.volatiles.wimpOut) return false;
      // With no healthy bench member the holder simply stays.
      const side = ctx.state.sides[opponentOf(ctx.side)];
      return side.party.some((member, index) => index !== side.activeIndex && member.hp > 0);
    },
    (ctx) => {
      ctx.owner.volatiles.wimpOut = true;
      ctx.state.sides[opponentOf(ctx.side)].awaitingReplacement = true;
      pushText(ctx.state, 'battle.log.ability.escapeBelowHalf', {
        name: ctx.owner.name,
        ability,
      });
    },
  );
}

const ABILITIES: readonly (readonly [string, EffectHandlers])[] = [
  ['intimidate', intimidate()],
  ['levitate', levitate()],
  ['sturdy', sturdy()],

  ['static', contactStatus('Static', 'par')],
  ['flamebody', contactStatus('Flame Body', 'brn')],
  ['poisonpoint', contactStatus('Poison Point', 'psn')],

  [
    'immunity',
    statusImmunity([
      ['psn', 'battle.log.ability.immunity.preventsPoison'],
      ['tox', 'battle.log.ability.immunity.preventsBadPoison'],
    ]),
  ],
  ['limber', statusImmunity([['par', 'battle.log.ability.limber']])],
  ['waterveil', statusImmunity([['brn', 'battle.log.ability.waterVeil']])],
  ['insomnia', statusImmunity([['slp', 'battle.log.ability.insomnia']])],
  ['vitalspirit', statusImmunity([['slp', 'battle.log.ability.vitalSpirit']])],
  ['magmaarmor', statusImmunity([['frz', 'battle.log.ability.magmaArmor']])],

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

  [
    'thickfat',
    incomingMultiplier(
      0.5,
      (_ctx, payload) => payload.move.type === 'Fire' || payload.move.type === 'Ice',
    ),
  ],
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
  [
    'hugepower',
    outgoingMultiplier(
      2,
      (payload) => payload.move.category === 'Physical' && payload.move.basePower > 0,
    ),
  ],
  [
    'purepower',
    outgoingMultiplier(
      2,
      (payload) => payload.move.category === 'Physical' && payload.move.basePower > 0,
    ),
  ],

  ['intrepidsword', switchInBoost({ atk: 1 })],
  ['dauntlessshield', switchInBoost({ def: 1 })],
  ['moxie', koBoost({ atk: 1 })],

  ['chlorophyll', weatherSpeed('sun', 2)],
  ['swiftswim', weatherSpeed('rain', 2)],
  ['sandrush', weatherSpeed('sand', 2)],
  ['quickfeet', quickFeet()],

  ['compoundeyes', accuracyModifier(1.3, (ctx) => ctx.owner === ctx.source)],
  ['hustle', hustle()],
  [
    'sandveil',
    accuracyModifier(0.8, (ctx) => ctx.owner === ctx.target && effectiveWeather(ctx.state) === 'sand'),
  ],
  [
    'snowcloak',
    accuracyModifier(0.8, (ctx) => ctx.owner === ctx.target && effectiveWeather(ctx.state) === 'snow'),
  ],

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
  ['wonderguard', wonderGuard()],
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

  // Ability suppression lives in `registry.ts` (abilityActive) and the damage
  // context: Mold Breaker and friends pierce, Neutralizing Gas switches off.
  ['moldbreaker', {}],
  ['teravolt', {}],
  ['turboblaze', {}],
  ['neutralizinggas', {}],
  ['unaware', {}],
  ['swordofruin', {}],
  ['tabletsofruin', {}],
  ['beadsofruin', {}],
  ['vesselofruin', {}],
  ['myceliummight', myceliumMight()],

  ['aerilate', typeChangeAbility()],
  ['galvanize', typeChangeAbility()],
  ['pixilate', typeChangeAbility()],
  ['refrigerate', typeChangeAbility()],
  ['normalize', typeChangeAbility()],
  ['liquidvoice', typeChangeAbility()],
  ['cursedbody', cursedBody()],
  ['cutecharm', cuteCharm()],

  ['cudchew', cudChew()],
  ['hadronengine', hadronEngine()],
  ['orichalcumpulse', orichalcumPulse()],
  ['protosynthesis', protosynthesis()],
  ['quarkdrive', quarkDrive()],
  ['rivalry', rivalry()],
  // Illuminate's Gen 9 effect is an immunity to accuracy drops (v1.3.2+).
  ['illuminate', statGuard(['accuracy'])],

  // Trapping, Dancer, Gluttony and Magic Bounce act at their call sites:
  // `trappedBy`/`isTrapped` in fighter.ts and state.ts, Dancer and Magic Bounce
  // in the turn loop, Gluttony in effects/items.ts.
  ['arenatrap', {}],
  ['shadowtag', {}],
  ['magnetpull', {}],
  ['dancer', {}],
  ['gluttony', {}],
  ['magicbounce', {}],

  ['imposter', imposter()],
  ['illusion', illusion()],

  // Air Lock / Cloud Nine and Unseen Fist act at the call site (effectiveWeather,
  // protectBlocks).
  ['airlock', {}],
  ['cloudnine', {}],
  ['unseenfist', {}],

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

  // Ported in the "reachable but unported" pass.
  // No battle effect exists in the cartridge: both act outside battle only. The run
  // reads them on the map (`src/engine/run/passives.ts`); the row is what puts them
  // in the ability pool a run draws from (`randomAbilityPool`, D16).
  ['honeygather', {}],
  ['pickup', {}],
  ['aurabreak', {}],
  ['beastboost', beastBoost()],
  ['colorchange', colorChange()],
  ['cottondown', cottonDown()],
  ['darkaura', aura('Dark')],
  ['defeatist', defeatist()],
  ['emergencyexit', escapeBelowHalf('Emergency Exit')],
  ['fairyaura', aura('Fairy')],
  ['gorillatactics', gorillaTactics()],
  ['innardsout', innardsOut()],
  ['ironbarbs', ironBarbs()],
  ['mimicry', mimicry()],
  ['mummy', mummy()],
  ['neuroforce', neuroforce()],
  ['pastelveil', pastelVeil()],
  ['perishbody', perishBody()],
  ['screencleaner', screenCleaner()],
  ['steelworker', outgoingMultiplier(1.5, (payload) => payload.move.type === 'Steel')],
  ['victorystar', accuracyModifier(1.1, (ctx) => ctx.owner === ctx.source)],
  ['wanderingspirit', wanderingSpirit()],
  ['wimpout', escapeBelowHalf('Wimp Out')],

  // The hand-authored rows the generated dex does not carry (`customAbilities.ts`).
  ['darkmatter', darkmatter()],
];

export function abilityEffects(): readonly EffectDefinition[] {
  return ABILITIES.map(([id, handlers]) => ({ id, kind: 'ability', handlers }));
}

export function registerAbilityEffects(): void {
  registerEffects(abilityEffects());
}

registerAbilityEffects();
