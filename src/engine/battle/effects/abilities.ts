import { applyDamage, applyHeal, stagedStat, type BoostId, type StatusId } from '../fighter';
import { cureStatus, statusName } from '../status';
import { opponentOf, pushEvent, pushText, type WeatherId } from '../state';
import { applyBoostEffect, applyStatusEffect, statLabel } from './apply';
import {
  registerEffects,
  type DamagePayload,
  type EffectContext,
  type EffectDefinition,
  type EffectHandlers,
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
      applyBoostEffect(ctx.state, opponentOf(ctx.side), foe, { atk: -1 }, {
        message: `${ctx.owner.name}'s Intimidate cut ${foe.name}'s Attack!`,
      });
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
      if (!payload.move.flags.contact) return;
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
      if (!payload.move.secondary && !payload.move.secondaries) return;
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
      if (payload.move.flags.contact) {
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

  ['toughclaws', outgoingMultiplier(1.3, (payload) => Boolean(payload.move.flags.contact) && payload.move.basePower > 0)],
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
];

export function abilityEffects(): readonly EffectDefinition[] {
  return ABILITIES.map(([id, handlers]) => ({ id, kind: 'ability', handlers }));
}

export function registerAbilityEffects(): void {
  registerEffects(abilityEffects());
}

registerAbilityEffects();
