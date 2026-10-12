import { effectiveness, getMove, TYPE_NAMES, type Move } from '../../../data/dex';
import { getItem } from '../../../data/items';
import {
  applyDamage,
  applyHeal,
  BOOST_IDS,
  emptyBoosts,
  isGrounded,
  moveContacts,
  transformInto,
  type BattleFighter,
  type BoostId,
  type StatusId,
} from '../fighter';
import {
  SIDE_IDS,
  activeFighter,
  effectiveWeather,
  opponent,
  pushEvent,
  pushText,
  type BattleState,
  type FieldConditionId,
  type SideConditionId,
  type SideId,
} from '../state';
import { cureStatus } from '../status';
import { applyPerish, applyTrap } from '../volatile';
import { applyBoostEffect, applyStatusEffect } from './apply';
import { applyHeldItemEffect } from './items';
import {
  makeContext,
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
  kingsshield: { contactBoosts: { atk: -1 } },
  obstruct: { contactBoosts: { def: -1 } },
};

/**
 * Side-condition moves: the id they set on the user's side of the field. The
 * rules live in `effects/conditions.ts`; `damage.ts`, `order.ts` and
 * `accuracy.ts` read them where they apply.
 */
export const SIDE_CONDITION_MOVES: Readonly<Record<string, SideConditionId>> = {
  reflect: 'reflect',
  lightscreen: 'lightscreen',
  auroraveil: 'auroraveil',
  tailwind: 'tailwind',
  luckychant: 'luckychant',
  mist: 'mist',
  safeguard: 'safeguard',
};

/** Whole-field condition moves: the id they set on `BattleState.field`. */
export const FIELD_CONDITION_MOVES: Readonly<Record<string, FieldConditionId>> = {
  trickroom: 'trickroom',
  gravity: 'gravity',
  magicroom: 'magicroom',
  wonderroom: 'wonderroom',
  fairylock: 'fairylock',
  mudsport: 'mudsport',
  watersport: 'watersport',
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

// --- Status moves ported through a move effect ---------------------------------

function selfEffect(run: (ctx: EffectContext) => void): EffectHandlers {
  return {
    onAfterMove: (ctx) => {
      if (ctx.owner !== ctx.source) return;
      run(ctx);
    },
  };
}

function healHolder(ctx: EffectContext, amount: number): number {
  const healed = applyHeal(ctx.owner, amount);
  if (healed > 0) {
    pushEvent(ctx.state, { kind: 'heal', side: ctx.side, amount: healed, hp: ctx.owner.hp, maxHp: ctx.owner.maxHp });
  }
  return healed;
}

function acupressure(): EffectHandlers {
  return selfEffect((ctx) => {
    const stat = BOOST_IDS[ctx.rng.int(0, BOOST_IDS.length - 1)];
    applyBoostEffect(ctx.state, ctx.side, ctx.owner, { [stat]: 2 }, { self: true });
  });
}

/** Aromatherapy and Heal Bell: every healthy party member loses its status. */
function teamCure(message: string): EffectHandlers {
  return selfEffect((ctx) => {
    let cured = false;
    for (const member of ctx.state.sides[ctx.side].party) {
      if (member.hp <= 0) continue;
      const status = cureStatus(member);
      if (!status) continue;
      pushEvent(ctx.state, { kind: 'cure', side: ctx.side, status });
      cured = true;
    }
    pushText(ctx.state, cured ? message : 'But it failed!');
  });
}

function bellyDrum(): EffectHandlers {
  return selfEffect((ctx) => {
    const holder = ctx.owner;
    if (holder.hp <= Math.floor(holder.maxHp / 2) || holder.boosts.atk >= 6) {
      pushText(ctx.state, 'But it failed!');
      return;
    }
    const cost = Math.floor(holder.maxHp / 2);
    applyDamage(holder, cost);
    pushEvent(ctx.state, { kind: 'damage', side: ctx.side, amount: cost, hp: holder.hp, maxHp: holder.maxHp, effectiveness: 1, crit: false });
    applyBoostEffect(ctx.state, ctx.side, holder, { atk: 12 }, {
      self: true,
      message: `${holder.name} cut its own HP and maximized its Attack!`,
    });
  });
}

/** Block and Mean Look: the target can no longer switch out or flee. */
function trapMove(): EffectHandlers {
  return {
    onAfterMove: (ctx) => {
      if (ctx.owner !== ctx.source || !ctx.target || ctx.target.hp <= 0) return;
      applyTrap(ctx.target);
      pushText(ctx.state, `${ctx.target.name} can no longer escape!`);
    },
  };
}

const TERRAIN_TYPE: Readonly<Record<string, string>> = {
  electric: 'Electric',
  grassy: 'Grass',
  misty: 'Fairy',
  psychic: 'Psychic',
};

function camouflage(): EffectHandlers {
  return selfEffect((ctx) => {
    const type = ctx.state.terrain ? TERRAIN_TYPE[ctx.state.terrain] : 'Normal';
    ctx.owner.types = [type];
    pushText(ctx.state, `${ctx.owner.name} transformed into the ${type} type!`);
  });
}

function textMove(text: (name: string) => string): EffectHandlers {
  return selfEffect((ctx) => pushText(ctx.state, text(ctx.owner.name)));
}

function conversion(): EffectHandlers {
  return selfEffect((ctx) => {
    const first = ctx.owner.moves[0];
    const move = first ? getMove(first.moveId) : undefined;
    if (!move) {
      pushText(ctx.state, 'But it failed!');
      return;
    }
    ctx.owner.types = [move.type];
    pushText(ctx.state, `${ctx.owner.name} transformed into the ${move.type} type!`);
  });
}

function conversion2(): EffectHandlers {
  return selfEffect((ctx) => {
    const last = ctx.target?.lastMoveId ? getMove(ctx.target.lastMoveId) : undefined;
    const options = last ? TYPE_NAMES.filter((type) => effectiveness(last.type, [type]) < 1) : [];
    if (options.length === 0) {
      pushText(ctx.state, 'But it failed!');
      return;
    }
    const type = options[ctx.rng.int(0, options.length - 1)];
    ctx.owner.types = [type];
    pushText(ctx.state, `${ctx.owner.name} transformed into the ${type} type!`);
  });
}

/**
 * Curse is conditional: a Ghost user pays half its HP to curse the foe (a
 * residual 1/4 drain), any other user trades Speed for Attack and Defense.
 */
function curse(): EffectHandlers {
  return selfEffect((ctx) => {
    const user = ctx.owner;
    const target = ctx.target;
    if (!target || target.hp <= 0) {
      pushText(ctx.state, 'But it failed!');
      return;
    }
    if (!user.types.includes('Ghost')) {
      applyBoostEffect(ctx.state, ctx.side, user, { atk: 1, def: 1, spe: -1 }, {
        self: true,
        message: `${user.name} cursed itself and raised its Attack and Defense!`,
      });
      return;
    }
    if (target.volatiles.curse) {
      pushText(ctx.state, 'But it failed!');
      return;
    }
    const cost = Math.max(1, Math.floor(user.maxHp / 2));
    applyDamage(user, cost);
    pushEvent(ctx.state, { kind: 'damage', side: ctx.side, amount: cost, hp: user.hp, maxHp: user.maxHp, effectiveness: 1, crit: false });
    target.volatiles.curse = true;
    pushText(ctx.state, `${user.name} cut its own HP and laid a curse on ${target.name}!`);
    if (user.hp <= 0) {
      pushEvent(ctx.state, { kind: 'faint', side: ctx.side, fighterId: user.id });
      pushText(ctx.state, `${user.name} fainted!`);
    }
  });
}

/** Doodle: the target's ability becomes the user's. */
function doodle(): EffectHandlers {
  return {
    onAfterMove: (ctx) => {
      if (ctx.owner !== ctx.source || !ctx.target || ctx.target.hp <= 0) return;
      if (ctx.target.ability === ctx.owner.ability) {
        pushText(ctx.state, 'But it failed!');
        return;
      }
      ctx.target.ability = ctx.owner.ability;
      pushText(ctx.state, `${ctx.target.name}'s Ability became ${ctx.owner.ability}!`);
    },
  };
}

/** Role Play: the user copies the target's ability. */
function rolePlay(): EffectHandlers {
  return {
    onAfterMove: (ctx) => {
      if (ctx.owner !== ctx.source || !ctx.target || ctx.target.hp <= 0) return;
      if (ctx.owner.ability === ctx.target.ability) {
        pushText(ctx.state, 'But it failed!');
        return;
      }
      ctx.owner.ability = ctx.target.ability;
      pushText(ctx.state, `${ctx.owner.name} copied ${ctx.target.name}'s ${ctx.target.ability}!`);
    },
  };
}

/** Stockpile banks a charge (up to three) and raises Defense and Sp. Def. */
function stockpile(): EffectHandlers {
  return selfEffect((ctx) => {
    const holder = ctx.owner;
    if (holder.volatiles.stockpile >= 3) {
      pushText(ctx.state, 'But it failed!');
      return;
    }
    holder.volatiles.stockpile += 1;
    applyBoostEffect(ctx.state, ctx.side, holder, { def: 1, spd: 1 }, {
      self: true,
      message: `${holder.name} stockpiled ${holder.volatiles.stockpile}!`,
    });
  });
}

function haze(): EffectHandlers {
  return selfEffect((ctx) => {
    for (const side of SIDE_IDS) activeFighter(ctx.state, side).boosts = emptyBoosts();
    pushText(ctx.state, 'All stat changes were eliminated!');
  });
}

/** Jungle Healing and Lunar Blessing: heal a quarter and clear the status. */
function healAndCure(fraction: number, message: string): EffectHandlers {
  return selfEffect((ctx) => {
    const status = cureStatus(ctx.owner);
    if (status) pushEvent(ctx.state, { kind: 'cure', side: ctx.side, status });
    const healed = healHolder(ctx, Math.max(1, Math.floor(ctx.owner.maxHp * fraction)));
    pushText(ctx.state, healed > 0 || status ? message : 'But it failed!');
  });
}

function perishSong(): EffectHandlers {
  return selfEffect((ctx) => {
    let any = false;
    for (const side of SIDE_IDS) {
      const fighter = activeFighter(ctx.state, side);
      if (fighter.hp <= 0 || fighter.volatiles.perish > 0) continue;
      applyPerish(fighter);
      any = true;
    }
    pushText(ctx.state, any ? 'All Pokémon hearing the song will faint in three turns!' : 'But it failed!');
  });
}

function psychUp(): EffectHandlers {
  return {
    onAfterMove: (ctx) => {
      if (ctx.owner !== ctx.source || !ctx.target) return;
      ctx.owner.boosts = { ...ctx.target.boosts };
      pushText(ctx.state, `${ctx.owner.name} copied ${ctx.target.name}'s stat changes!`);
    },
  };
}

function refresh(): EffectHandlers {
  return selfEffect((ctx) => {
    const holder = ctx.owner;
    if (!holder.status || !['brn', 'psn', 'tox', 'par'].includes(holder.status)) {
      pushText(ctx.state, 'But it failed!');
      return;
    }
    const status = cureStatus(holder);
    if (status) pushEvent(ctx.state, { kind: 'cure', side: ctx.side, status });
    pushText(ctx.state, `${holder.name} became healthy!`);
  });
}

function rest(): EffectHandlers {
  return selfEffect((ctx) => {
    const holder = ctx.owner;
    if (holder.hp >= holder.maxHp || holder.status !== null) {
      pushText(ctx.state, 'But it failed!');
      return;
    }
    applyStatusEffect(ctx.state, ctx.side, holder, 'slp', `${holder.name} slept and became healthy!`);
    if (holder.status !== 'slp') return;
    holder.statusCounter = 2;
    healHolder(ctx, holder.maxHp);
  });
}

/** Rototiller and Flower Shield raise every grounded / Grass-type active. */
function fieldBoosts(
  boosts: Partial<Record<BoostId, number>>,
  applies: (fighter: BattleFighter) => boolean,
  message: string,
): EffectHandlers {
  return selfEffect((ctx) => {
    let any = false;
    for (const side of SIDE_IDS) {
      const fighter = activeFighter(ctx.state, side);
      if (fighter.hp <= 0 || !applies(fighter)) continue;
      applyBoostEffect(ctx.state, side, fighter, boosts, { self: true, message });
      any = true;
    }
    if (!any) pushText(ctx.state, 'But it failed!');
  });
}

/** Stuff Cheeks: eat the held Berry, then sharply raise Defense. */
function stuffCheeks(): EffectHandlers {
  return selfEffect((ctx) => {
    const holder = ctx.owner;
    const item = holder.heldItem ? getItem(holder.heldItem) : undefined;
    if (!item || item.kind !== 'held' || !item.consumed) {
      pushText(ctx.state, 'But it failed!');
      return;
    }
    applyHeldItemEffect(ctx, item, true);
    holder.heldItem = null;
    holder.lastItemId = item.id;
    applyBoostEffect(ctx.state, ctx.side, holder, { def: 2 }, {
      self: true,
      message: `${holder.name} ate its ${item.name} and raised its Defense!`,
    });
  });
}

function swallow(): EffectHandlers {
  return selfEffect((ctx) => {
    const holder = ctx.owner;
    const count = holder.volatiles.stockpile;
    if (count <= 0) {
      pushText(ctx.state, 'But it failed!');
      return;
    }
    const fraction = count === 1 ? 1 / 4 : count === 2 ? 1 / 2 : 1;
    holder.volatiles.stockpile = 0;
    healHolder(ctx, Math.max(1, Math.floor(holder.maxHp * fraction)));
    pushText(ctx.state, `${holder.name} swallowed its stockpile and regained health!`);
  });
}

/** Synthesis, Moonlight and Morning Sun heal more in the sun, less in weather. */
function sunHeal(): EffectHandlers {
  return selfEffect((ctx) => {
    const weather = effectiveWeather(ctx.state);
    const fraction = weather === 'sun' ? 2 / 3 : weather ? 1 / 4 : 1 / 2;
    const healed = healHolder(ctx, Math.max(1, Math.floor(ctx.owner.maxHp * fraction)));
    pushText(ctx.state, healed > 0 ? `${ctx.owner.name} regained health!` : 'But it failed!');
  });
}

/** Shore Up heals more in a sandstorm, less in any other weather. */
function shoreUp(): EffectHandlers {
  return selfEffect((ctx) => {
    const weather = effectiveWeather(ctx.state);
    const fraction = weather === 'sand' ? 2 / 3 : weather ? 1 / 4 : 1 / 2;
    const healed = healHolder(ctx, Math.max(1, Math.floor(ctx.owner.maxHp * fraction)));
    pushText(ctx.state, healed > 0 ? `${ctx.owner.name} regained health!` : 'But it failed!');
  });
}

function takeHeart(): EffectHandlers {
  return selfEffect((ctx) => {
    const status = cureStatus(ctx.owner);
    if (status) pushEvent(ctx.state, { kind: 'cure', side: ctx.side, status });
    applyBoostEffect(ctx.state, ctx.side, ctx.owner, { spa: 1, spd: 1 }, {
      self: true,
      message: `${ctx.owner.name} took heart and raised its Sp. Atk and Sp. Def!`,
    });
  });
}

/** Teatime: every active Pokémon eats its held Berry, forced past its HP gate. */
function teatime(): EffectHandlers {
  return selfEffect((ctx) => {
    let any = false;
    for (const side of SIDE_IDS) {
      const fighter = activeFighter(ctx.state, side);
      const item = fighter.heldItem ? getItem(fighter.heldItem) : undefined;
      if (!item || item.kind !== 'held' || !item.consumed) continue;
      const inner = makeContext(ctx.state, side, { source: fighter, target: opponent(ctx.state, side) });
      applyHeldItemEffect(inner, item, true);
      fighter.heldItem = null;
      fighter.lastItemId = item.id;
      any = true;
    }
    if (!any) pushText(ctx.state, 'But it failed!');
  });
}

/** Tidy Up raises Attack and Speed; the entry hazards it would clear are not modelled. */
function tidyUp(): EffectHandlers {
  return selfEffect((ctx) => {
    applyBoostEffect(ctx.state, ctx.side, ctx.owner, { atk: 1, spe: 1 }, {
      self: true,
      message: `${ctx.owner.name} tidied up and raised its Attack and Speed!`,
    });
  });
}

const MOVE_EFFECTS: Readonly<Record<string, EffectHandlers>> = {
  acupressure: acupressure(),
  aromatherapy: teamCure('A soothing aroma wafted through the area!'),
  bellydrum: bellyDrum(),
  block: trapMove(),
  camouflage: camouflage(),
  celebrate: textMove((name) => `Congratulations, ${name}!`),
  conversion: conversion(),
  conversion2: conversion2(),
  curse: curse(),
  doodle: doodle(),
  flowershield: fieldBoosts({ def: 1 }, (fighter) => fighter.types.includes('Grass'), 'The Defense of Grass-type Pokémon rose!'),
  haze: haze(),
  healbell: teamCure('A bell chimed and healed the team!'),
  junglehealing: healAndCure(1 / 4, 'The team was healed by the jungle!'),
  lunarblessing: healAndCure(1 / 4, 'The team was bathed in lunar light!'),
  meanlook: trapMove(),
  moonlight: sunHeal(),
  morningsun: sunHeal(),
  perishsong: perishSong(),
  psychup: psychUp(),
  refresh: refresh(),
  rest: rest(),
  roleplay: rolePlay(),
  rototiller: fieldBoosts({ atk: 1, spa: 1 }, (fighter) => fighter.types.includes('Grass') && isGrounded(fighter), 'The Attack and Sp. Atk of grounded Grass-type Pokémon rose!'),
  shoreup: shoreUp(),
  splash: textMove(() => 'But nothing happened!'),
  stockpile: stockpile(),
  stuffcheeks: stuffCheeks(),
  swallow: swallow(),
  synthesis: sunHeal(),
  takeheart: takeHeart(),
  teatime: teatime(),
  tidyup: tidyUp(),
};

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
  for (const [moveId, handlers] of Object.entries(MOVE_EFFECTS)) {
    defs.push({ id: moveId, kind: 'move', handlers });
  }
  return defs;
}

export function registerMoveEffects(): void {
  registerEffects(moveEffects());
}

registerMoveEffects();
