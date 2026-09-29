import type { BoostId, StatusId } from '../fighter';
import { cureStatus, statusName } from '../status';
import { opponentOf, pushEvent, pushText } from '../state';
import { applyBoostEffect, applyStatusEffect, statLabel } from './apply';
import {
  registerEffects,
  type EffectDefinition,
  type EffectHandlers,
} from './registry';

function intimidate(): EffectHandlers {
  return {
    onSwitchIn: (ctx) => {
      const foe = ctx.target;
      if (!foe || foe.hp <= 0) return;
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
];

export function abilityEffects(): readonly EffectDefinition[] {
  return ABILITIES.map(([id, handlers]) => ({ id, kind: 'ability', handlers }));
}

export function registerAbilityEffects(): void {
  registerEffects(abilityEffects());
}

registerAbilityEffects();
