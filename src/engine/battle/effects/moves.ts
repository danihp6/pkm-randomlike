import { effectiveness, getMove, TYPE_NAMES, type Move, type Stats } from '../../../data/dex';
import { getItem } from '../../../data/items';
import {
  addType,
  applyDamage,
  applyHeal,
  BOOST_IDS,
  effectiveStat,
  emptyBoosts,
  hasAbility,
  isGrounded,
  moveContacts,
  rewriteTypes,
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
  opponentOf,
  pushEvent,
  pushText,
  type BattleState,
  type BattleText,
  type BattleTextKey,
  type FieldConditionId,
  type SideConditionId,
  type SideId,
} from '../state';
import { canApplyStatus, cureStatus } from '../status';
import { applyLockOn, applyPerish, applyQuash, applySmackDown, applyTrap } from '../volatile';
import { applyBoostEffect, applyStatusEffect } from './apply';
import { applyHeldItemEffect } from './items';
import {
  makeContext,
  registerEffects,
  runModifyPriority,
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

/**
 * The two-turn moves that raise a stat as they charge. The dex keeps the raise in
 * Showdown's `onTryMove` handler rather than in a data field, so the table lives
 * here beside the other move tables and the charge turn reads it.
 */
export const CHARGE_SELF_BOOSTS: Readonly<Record<string, Partial<Record<BoostId, number>>>> = {
  meteorbeam: { spa: 1 },
  electroshot: { spa: 1 },
  skullbash: { def: 1 },
};

/**
 * The moves that can fail outright, keyed by move id (`Task-167`). A predicate
 * answers `true` when the move must fail this turn: the turn loop logs
 * `battle.log.fail` where `Spit Up` already does — PP already spent, nothing
 * aimed — and returns before any damage, secondary or after-move hook. A
 * predicate reads the turn's commands, never the RNG.
 */
export const CONDITIONAL_FAILS: Readonly<Record<string, (ctx: EffectContext) => boolean>> = {
  /**
   * Upper Hand only catches a target already winding up: the foe's own command
   * must be a damaging move whose effective priority (Prankster and friends
   * included) is above zero. A missing command map, a Bag item, a switch, a run
   * or a plain move all fail it.
   */
  upperhand: (ctx) => {
    const foeSide = opponentOf(ctx.side);
    const command = ctx.commands?.[foeSide]?.[0];
    if (!command || command.type !== 'fight') return true;
    const foe = activeFighter(ctx.state, foeSide);
    const chosen = foe.moves[command.moveIndex];
    const chosenMove = chosen ? getMove(chosen.moveId) : undefined;
    if (!chosenMove || chosenMove.category === 'Status') return true;
    const foeCtx = makeContext(ctx.state, foeSide, {
      source: foe,
      target: ctx.source,
      move: chosenMove,
    });
    return runModifyPriority(foeCtx, chosenMove, chosenMove.priority) <= 0;
  },
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
    hasAbility(attacker, 'Unseen Fist') &&
    !hasAbility(defender, 'Neutralizing Gas') &&
    moveContacts(attacker, move)
  ) {
    pushText(state, 'battle.log.brokeProtection', { name: attacker.name });
    return false;
  }

  pushText(state, 'battle.log.protectedItself', { name: defender.name });
  const punish = PROTECT_MOVES[protectMove];
  if (!punish || !moveContacts(attacker, move) || state.winner !== null) return true;

  if (punish.contactBoosts) {
    applyBoostEffect(state, side, attacker, punish.contactBoosts);
  }
  if (punish.contactStatus) {
    applyStatusEffect(state, side, attacker, punish.contactStatus, {
      key: 'battle.log.hurtByProtection',
      params: { name: attacker.name },
    });
  }
  if (punish.contactDamageDenominator) {
    const dealt = applyDamage(
      attacker,
      Math.max(1, Math.floor(attacker.maxHp / punish.contactDamageDenominator)),
    );
    pushEvent(state, {
      kind: 'damage',
      side,
      amount: dealt,
      hp: attacker.hp,
      maxHp: attacker.maxHp,
      effectiveness: 1,
      crit: false,
    });
    pushText(state, 'battle.log.hurtByProtection', { name: attacker.name });
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
        pushText(ctx.state, 'battle.log.protectedItself', { name: fighter.name });
      } else {
        fighter.volatiles.protectStreak = 0;
        pushText(ctx.state, 'battle.log.protectionFailed', { name: fighter.name });
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
        pushText(ctx.state, 'battle.log.fail');
        return;
      }
      const itemId = fighter.lastItemId;
      fighter.heldItem = itemId;
      fighter.lastItemId = null;
      pushText(ctx.state, 'battle.log.move.recycle', { name: fighter.name });
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
        pushText(ctx.state, 'battle.log.move.transform', { name: userName, target: targetName });
        pushEvent(ctx.state, { kind: 'forme', side: ctx.side, fighterId: ctx.owner.id });
      } else {
        pushText(ctx.state, 'battle.log.fail');
      }
    },
  };
}

/**
 * Moves whose type follows the battle situation rather than the dex: Weather
 * Ball reads the weather, Terrain Pulse the terrain, Revelation Dance the user's
 * primary type and Aura Wheel the user's Morpeko form. Registered as move effects
 * so their `onModifyMoveType` reaches both the damage calc and the FIGHT menu's
 * preview; a held item's own retype (a Plate's Judgment, a Memory's Multi-Attack,
 * a Drive's Techno Blast, a berry's Natural Gift) is registered in
 * `effects/items.ts` instead.
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
    pushEvent(ctx.state, {
      kind: 'heal',
      side: ctx.side,
      amount: healed,
      hp: ctx.owner.hp,
      maxHp: ctx.owner.maxHp,
    });
  }
  return healed;
}

function acupressure(): EffectHandlers {
  return selfEffect((ctx) => {
    const stat = BOOST_IDS[ctx.rng.int(0, BOOST_IDS.length - 1)];
    applyBoostEffect(ctx.state, ctx.side, ctx.owner, { [stat]: 2 }, { self: true });
  });
}

const STATUS_SHIFTED: Readonly<Record<StatusId, BattleTextKey>> = {
  brn: 'battle.log.statusShifted.brn',
  psn: 'battle.log.statusShifted.psn',
  tox: 'battle.log.statusShifted.tox',
  par: 'battle.log.statusShifted.par',
  slp: 'battle.log.statusShifted.slp',
  frz: 'battle.log.statusShifted.frz',
};

/** Aromatherapy and Heal Bell: every healthy party member loses its status. */
function teamCure(message: BattleTextKey): EffectHandlers {
  return selfEffect((ctx) => {
    let cured = false;
    for (const member of ctx.state.sides[ctx.side].party) {
      if (member.hp <= 0) continue;
      const status = cureStatus(member);
      if (!status) continue;
      pushEvent(ctx.state, { kind: 'cure', side: ctx.side, status });
      cured = true;
    }
    pushText(ctx.state, cured ? message : 'battle.log.fail');
  });
}

function bellyDrum(): EffectHandlers {
  return selfEffect((ctx) => {
    const holder = ctx.owner;
    if (holder.hp <= Math.floor(holder.maxHp / 2) || holder.boosts.atk >= 6) {
      pushText(ctx.state, 'battle.log.fail');
      return;
    }
    const cost = Math.floor(holder.maxHp / 2);
    applyDamage(holder, cost);
    pushEvent(ctx.state, {
      kind: 'damage',
      side: ctx.side,
      amount: cost,
      hp: holder.hp,
      maxHp: holder.maxHp,
      effectiveness: 1,
      crit: false,
    });
    applyBoostEffect(
      ctx.state,
      ctx.side,
      holder,
      { atk: 12 },
      {
        self: true,
        message: { key: 'battle.log.move.bellydrum', params: { name: holder.name } },
      },
    );
  });
}

/** Block and Mean Look: the target can no longer switch out or flee. */
function trapMove(): EffectHandlers {
  return {
    onAfterMove: (ctx) => {
      if (ctx.owner !== ctx.source || !ctx.target || ctx.target.hp <= 0) return;
      applyTrap(ctx.target);
      pushText(ctx.state, 'battle.log.move.trapped', { name: ctx.target.name });
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
    pushText(ctx.state, 'battle.log.typeChanged', { name: ctx.owner.name, type });
  });
}

function textMove(text: (name: string) => BattleText): EffectHandlers {
  return selfEffect((ctx) => {
    const line = text(ctx.owner.name);
    pushText(ctx.state, line.key, line.params);
  });
}

function conversion(): EffectHandlers {
  return selfEffect((ctx) => {
    const first = ctx.owner.moves[0];
    const move = first ? getMove(first.moveId) : undefined;
    if (!move) {
      pushText(ctx.state, 'battle.log.fail');
      return;
    }
    ctx.owner.types = [move.type];
    pushText(ctx.state, 'battle.log.typeChanged', { name: ctx.owner.name, type: move.type });
  });
}

function conversion2(): EffectHandlers {
  return selfEffect((ctx) => {
    const last = ctx.target?.lastMoveId ? getMove(ctx.target.lastMoveId) : undefined;
    const options = last ? TYPE_NAMES.filter((type) => effectiveness(last.type, [type]) < 1) : [];
    if (options.length === 0) {
      pushText(ctx.state, 'battle.log.fail');
      return;
    }
    const type = options[ctx.rng.int(0, options.length - 1)];
    ctx.owner.types = [type];
    pushText(ctx.state, 'battle.log.typeChanged', { name: ctx.owner.name, type });
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
      pushText(ctx.state, 'battle.log.fail');
      return;
    }
    if (!user.types.includes('Ghost')) {
      applyBoostEffect(
        ctx.state,
        ctx.side,
        user,
        { atk: 1, def: 1, spe: -1 },
        {
          self: true,
          message: { key: 'battle.log.move.curseSelf', params: { name: user.name } },
        },
      );
      return;
    }
    if (target.volatiles.curse) {
      pushText(ctx.state, 'battle.log.fail');
      return;
    }
    const cost = Math.max(1, Math.floor(user.maxHp / 2));
    applyDamage(user, cost);
    pushEvent(ctx.state, {
      kind: 'damage',
      side: ctx.side,
      amount: cost,
      hp: user.hp,
      maxHp: user.maxHp,
      effectiveness: 1,
      crit: false,
    });
    target.volatiles.curse = true;
    pushText(ctx.state, 'battle.log.move.curse', { name: user.name, target: target.name });
    if (user.hp <= 0) {
      pushEvent(ctx.state, { kind: 'faint', side: ctx.side, fighterId: user.id });
      pushText(ctx.state, 'battle.log.fainted', { name: user.name });
    }
  });
}

/** Doodle: the target's ability becomes the user's. */
function doodle(): EffectHandlers {
  return {
    onAfterMove: (ctx) => {
      if (ctx.owner !== ctx.source || !ctx.target || ctx.target.hp <= 0) return;
      if (ctx.target.ability === ctx.owner.ability) {
        pushText(ctx.state, 'battle.log.fail');
        return;
      }
      ctx.target.ability = ctx.owner.ability;
      pushText(ctx.state, 'battle.log.abilityBecame', {
        name: ctx.target.name,
        ability: ctx.owner.ability,
      });
    },
  };
}

/** Role Play: the user copies the target's ability. */
function rolePlay(): EffectHandlers {
  return {
    onAfterMove: (ctx) => {
      if (ctx.owner !== ctx.source || !ctx.target || ctx.target.hp <= 0) return;
      if (ctx.owner.ability === ctx.target.ability) {
        pushText(ctx.state, 'battle.log.fail');
        return;
      }
      ctx.owner.ability = ctx.target.ability;
      pushText(ctx.state, 'battle.log.move.roleplay', {
        name: ctx.owner.name,
        target: ctx.target.name,
        ability: ctx.target.ability,
      });
    },
  };
}

/** Stockpile banks a charge (up to three) and raises Defense and Sp. Def. */
function stockpile(): EffectHandlers {
  return selfEffect((ctx) => {
    const holder = ctx.owner;
    if (holder.volatiles.stockpile >= 3) {
      pushText(ctx.state, 'battle.log.fail');
      return;
    }
    holder.volatiles.stockpile += 1;
    applyBoostEffect(
      ctx.state,
      ctx.side,
      holder,
      { def: 1, spd: 1 },
      {
        self: true,
        message: {
          key: 'battle.log.move.stockpile',
          params: { name: holder.name, count: holder.volatiles.stockpile },
        },
      },
    );
  });
}

function haze(): EffectHandlers {
  return selfEffect((ctx) => {
    for (const side of SIDE_IDS) activeFighter(ctx.state, side).boosts = emptyBoosts();
    pushText(ctx.state, 'battle.log.move.haze');
  });
}

/** Jungle Healing and Lunar Blessing: heal a quarter and clear the status. */
function healAndCure(fraction: number, message: BattleTextKey): EffectHandlers {
  return selfEffect((ctx) => {
    const status = cureStatus(ctx.owner);
    if (status) pushEvent(ctx.state, { kind: 'cure', side: ctx.side, status });
    const healed = healHolder(ctx, Math.max(1, Math.floor(ctx.owner.maxHp * fraction)));
    pushText(ctx.state, healed > 0 || status ? message : 'battle.log.fail');
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
    pushText(ctx.state, any ? 'battle.log.move.perishsong' : 'battle.log.fail');
  });
}

function psychUp(): EffectHandlers {
  return {
    onAfterMove: (ctx) => {
      if (ctx.owner !== ctx.source || !ctx.target) return;
      ctx.owner.boosts = { ...ctx.target.boosts };
      pushText(ctx.state, 'battle.log.move.psychup', {
        name: ctx.owner.name,
        target: ctx.target.name,
      });
    },
  };
}

function refresh(): EffectHandlers {
  return selfEffect((ctx) => {
    const holder = ctx.owner;
    if (!holder.status || !['brn', 'psn', 'tox', 'par'].includes(holder.status)) {
      pushText(ctx.state, 'battle.log.fail');
      return;
    }
    const status = cureStatus(holder);
    if (status) pushEvent(ctx.state, { kind: 'cure', side: ctx.side, status });
    pushText(ctx.state, 'battle.log.move.refresh', { name: holder.name });
  });
}

function rest(): EffectHandlers {
  return selfEffect((ctx) => {
    const holder = ctx.owner;
    if (holder.hp >= holder.maxHp || holder.status !== null) {
      pushText(ctx.state, 'battle.log.fail');
      return;
    }
    applyStatusEffect(ctx.state, ctx.side, holder, 'slp', {
      key: 'battle.log.move.rest',
      params: { name: holder.name },
    });
    if (holder.status !== 'slp') return;
    holder.statusCounter = 2;
    healHolder(ctx, holder.maxHp);
  });
}

/** Rototiller and Flower Shield raise every grounded / Grass-type active. */
function fieldBoosts(
  boosts: Partial<Record<BoostId, number>>,
  applies: (fighter: BattleFighter) => boolean,
  message: BattleTextKey,
): EffectHandlers {
  return selfEffect((ctx) => {
    let any = false;
    for (const side of SIDE_IDS) {
      const fighter = activeFighter(ctx.state, side);
      if (fighter.hp <= 0 || !applies(fighter)) continue;
      applyBoostEffect(ctx.state, side, fighter, boosts, {
        self: true,
        message: { key: message, params: { name: fighter.name } },
      });
      any = true;
    }
    if (!any) pushText(ctx.state, 'battle.log.fail');
  });
}

/** Stuff Cheeks: eat the held Berry, then sharply raise Defense. */
function stuffCheeks(): EffectHandlers {
  return selfEffect((ctx) => {
    const holder = ctx.owner;
    const item = holder.heldItem ? getItem(holder.heldItem) : undefined;
    if (!item || item.kind !== 'held' || !item.consumed) {
      pushText(ctx.state, 'battle.log.fail');
      return;
    }
    applyHeldItemEffect(ctx, item, true);
    holder.heldItem = null;
    holder.lastItemId = item.id;
    applyBoostEffect(
      ctx.state,
      ctx.side,
      holder,
      { def: 2 },
      {
        self: true,
        message: {
          key: 'battle.log.move.stuffcheeks',
          params: { name: holder.name, item: item.id },
        },
      },
    );
  });
}

function swallow(): EffectHandlers {
  return selfEffect((ctx) => {
    const holder = ctx.owner;
    const count = holder.volatiles.stockpile;
    if (count <= 0) {
      pushText(ctx.state, 'battle.log.fail');
      return;
    }
    const fraction = count === 1 ? 1 / 4 : count === 2 ? 1 / 2 : 1;
    holder.volatiles.stockpile = 0;
    healHolder(ctx, Math.max(1, Math.floor(holder.maxHp * fraction)));
    pushText(ctx.state, 'battle.log.move.swallow', { name: holder.name });
  });
}

/** Synthesis, Moonlight and Morning Sun heal more in the sun, less in weather. */
function sunHeal(): EffectHandlers {
  return selfEffect((ctx) => {
    const weather = effectiveWeather(ctx.state);
    const fraction = weather === 'sun' ? 2 / 3 : weather ? 1 / 4 : 1 / 2;
    const healed = healHolder(ctx, Math.max(1, Math.floor(ctx.owner.maxHp * fraction)));
    pushText(ctx.state, healed > 0 ? 'battle.log.regainedHealth' : 'battle.log.fail', {
      name: ctx.owner.name,
    });
  });
}

/** Shore Up heals more in a sandstorm, less in any other weather. */
function shoreUp(): EffectHandlers {
  return selfEffect((ctx) => {
    const weather = effectiveWeather(ctx.state);
    const fraction = weather === 'sand' ? 2 / 3 : weather ? 1 / 4 : 1 / 2;
    const healed = healHolder(ctx, Math.max(1, Math.floor(ctx.owner.maxHp * fraction)));
    pushText(ctx.state, healed > 0 ? 'battle.log.regainedHealth' : 'battle.log.fail', {
      name: ctx.owner.name,
    });
  });
}

function takeHeart(): EffectHandlers {
  return selfEffect((ctx) => {
    const status = cureStatus(ctx.owner);
    if (status) pushEvent(ctx.state, { kind: 'cure', side: ctx.side, status });
    applyBoostEffect(
      ctx.state,
      ctx.side,
      ctx.owner,
      { spa: 1, spd: 1 },
      {
        self: true,
        message: { key: 'battle.log.move.takeheart', params: { name: ctx.owner.name } },
      },
    );
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
    if (!any) pushText(ctx.state, 'battle.log.fail');
  });
}

/** Tidy Up raises Attack and Speed; the entry hazards it would clear are not modelled. */
function tidyUp(): EffectHandlers {
  return selfEffect((ctx) => {
    applyBoostEffect(
      ctx.state,
      ctx.side,
      ctx.owner,
      { atk: 1, spe: 1 },
      {
        self: true,
        message: { key: 'battle.log.move.tidyup', params: { name: ctx.owner.name } },
      },
    );
  });
}

/** Runs on the move's target, once, after the move has resolved. */
function targetEffect(run: (ctx: EffectContext, target: BattleFighter) => void): EffectHandlers {
  return {
    onAfterMove: (ctx) => {
      if (ctx.owner !== ctx.source || !ctx.target || ctx.target.hp <= 0) return;
      run(ctx, ctx.target);
    },
  };
}

function fail(ctx: EffectContext): void {
  pushText(ctx.state, 'battle.log.fail');
}

/**
 * A move that pays a fraction of its own max HP before its data applies, and fails
 * when the user cannot afford it (Clangorous Soul, Fillet Away).
 */
function hpCost(denominator: number, message: (name: string) => BattleText): EffectHandlers {
  return {
    onTryHit: (ctx) => {
      if (ctx.owner !== ctx.source) return;
      const user = ctx.source;
      const cost = Math.max(1, Math.floor(user.maxHp / denominator));
      if (user.hp <= cost) {
        fail(ctx);
        return false;
      }
      const dealt = applyDamage(user, cost);
      pushEvent(ctx.state, {
        kind: 'damage',
        side: ctx.side,
        amount: dealt,
        hp: user.hp,
        maxHp: user.maxHp,
        effectiveness: 1,
        crit: false,
      });
      const line = message(user.name);
      pushText(ctx.state, line.key, line.params);
      return undefined;
    },
  };
}

/**
 * A move only its own species may use (Dark Void, Hyperspace Fury). Anything else
 * fails before the move touches the board.
 */
function signatureMove(speciesId: string): EffectHandlers {
  return {
    onTryHit: (ctx) => {
      if (ctx.owner !== ctx.source) return;
      if (ctx.source.speciesId === speciesId) return;
      fail(ctx);
      return false;
    },
  };
}

/** Dream Eater needs a sleeping target; Snore needs a sleeping user. */
function requiresSleep(who: 'source' | 'target'): EffectHandlers {
  return {
    onTryHit: (ctx) => {
      if (ctx.owner !== ctx.source) return;
      const fighter = who === 'source' ? ctx.source : ctx.target;
      if (fighter && fighter.status === 'slp') return;
      fail(ctx);
      return false;
    },
  };
}

/** Captivate only works on a target of the opposite, non-genderless gender. */
function captivate(): EffectHandlers {
  return {
    onTryHit: (ctx) => {
      if (ctx.owner !== ctx.source) return;
      const target = ctx.target;
      if (!target) return;
      if (ctx.source.gender === 'genderless' || target.gender === 'genderless') {
        fail(ctx);
        return false;
      }
      if (ctx.source.gender === target.gender) {
        fail(ctx);
        return false;
      }
      return undefined;
    },
  };
}

/** Soak, Reflect Type and Magic Powder rewrite the whole type list. */
function soak(): EffectHandlers {
  return targetEffect((ctx, target) => {
    if (target.types.length === 1 && target.types[0] === 'Water') {
      fail(ctx);
      return;
    }
    rewriteTypes(target, ['Water']);
    pushText(ctx.state, 'battle.log.typeChanged', { name: target.name, type: 'Water' });
  });
}

function reflectType(): EffectHandlers {
  return targetEffect((ctx, target) => {
    const user = ctx.source;
    const same =
      user.types.length === target.types.length &&
      user.types.every((type, index) => type === target.types[index]);
    if (same) {
      fail(ctx);
      return;
    }
    rewriteTypes(user, target.types);
    pushText(ctx.state, 'battle.log.move.reflecttype', { name: user.name, target: target.name });
  });
}

function magicPowder(): EffectHandlers {
  return targetEffect((ctx, target) => {
    if (target.types.length === 1 && target.types[0] === 'Psychic') {
      fail(ctx);
      return;
    }
    rewriteTypes(target, ['Psychic']);
    pushText(ctx.state, 'battle.log.typeChanged', { name: target.name, type: 'Psychic' });
  });
}

/** Forest's Curse and Trick-or-Treat add one type to the target. */
function addedTypeMove(type: string): EffectHandlers {
  return targetEffect((ctx, target) => {
    if (target.types.includes(type)) {
      fail(ctx);
      return;
    }
    addType(target, type);
    pushText(ctx.state, 'battle.log.typeAdded', { name: target.name, type });
  });
}

/** Simple Beam and Worry Seed hand the target Insomnia. */
function grantAbility(ability: string): EffectHandlers {
  return targetEffect((ctx, target) => {
    if (target.ability === ability) {
      fail(ctx);
      return;
    }
    target.ability = ability;
    pushText(ctx.state, 'battle.log.abilityBecame', { name: target.name, ability });
  });
}

/** Entrainment copies the user's ability onto the target. */
function entrainment(): EffectHandlers {
  return targetEffect((ctx, target) => {
    if (target.ability === ctx.source.ability) {
      fail(ctx);
      return;
    }
    target.ability = ctx.source.ability;
    pushText(ctx.state, 'battle.log.abilityBecame', {
      name: target.name,
      ability: ctx.source.ability,
    });
  });
}

/** Skill Swap trades both abilities. */
function skillSwap(): EffectHandlers {
  return targetEffect((ctx, target) => {
    const user = ctx.source;
    if (user.ability === target.ability) {
      fail(ctx);
      return;
    }
    const swapped = user.ability;
    user.ability = target.ability;
    target.ability = swapped;
    pushText(ctx.state, 'battle.log.move.skillswap', { name: user.name, target: target.name });
  });
}

/** Heart Swap, Power Swap and Guard Swap trade the named stat stages. */
function stageSwap(stats: readonly BoostId[]): EffectHandlers {
  return targetEffect((ctx, target) => {
    const user = ctx.source;
    if (stats.every((stat) => user.boosts[stat] === target.boosts[stat])) {
      fail(ctx);
      return;
    }
    for (const stat of stats) {
      const mine = user.boosts[stat];
      user.boosts[stat] = target.boosts[stat];
      target.boosts[stat] = mine;
    }
    pushText(ctx.state, 'battle.log.move.stageswap', { name: user.name, target: target.name });
  });
}

/** Speed Swap trades the raw Speed stat, not its stage. */
function speedSwap(): EffectHandlers {
  return targetEffect((ctx, target) => {
    const user = ctx.source;
    const mine = user.stats.spe;
    user.stats = { ...user.stats, spe: target.stats.spe };
    target.stats = { ...target.stats, spe: mine };
    pushText(ctx.state, 'battle.log.move.speedswap', { name: user.name, target: target.name });
  });
}

/** Power Split and Guard Split hand both fighters the average of two stats. */
function statSplit(stats: readonly (keyof Stats)[]): EffectHandlers {
  return targetEffect((ctx, target) => {
    const user = ctx.source;
    const averaged: Partial<Record<keyof Stats, number>> = {};
    for (const stat of stats) averaged[stat] = Math.floor((user.stats[stat] + target.stats[stat]) / 2);
    user.stats = { ...user.stats, ...averaged };
    target.stats = { ...target.stats, ...averaged };
    pushText(ctx.state, 'battle.log.move.statsplit', { name: user.name, target: target.name });
  });
}

/** Heal Pulse and Floral Healing restore the target's HP. */
function healTarget(
  fraction: (ctx: EffectContext, target: BattleFighter) => number,
  message: (name: string) => BattleText,
): EffectHandlers {
  return targetEffect((ctx, target) => {
    const healed = applyHeal(target, Math.max(1, Math.floor(target.maxHp * fraction(ctx, target))));
    if (healed <= 0) {
      fail(ctx);
      return;
    }
    pushEvent(ctx.state, {
      kind: 'heal',
      side: opponentOf(ctx.side),
      amount: healed,
      hp: target.hp,
      maxHp: target.maxHp,
    });
    const line = message(target.name);
    pushText(ctx.state, line.key, line.params);
  });
}

/** Purify cures the target and heals the user by half its max HP. */
function purify(): EffectHandlers {
  return targetEffect((ctx, target) => {
    const status = target.status;
    if (!status) {
      fail(ctx);
      return;
    }
    cureStatus(target);
    pushEvent(ctx.state, { kind: 'cure', side: opponentOf(ctx.side), status });
    healHolder(ctx, Math.max(1, Math.floor(ctx.source.maxHp / 2)));
    pushText(ctx.state, 'battle.log.move.purify', { name: target.name });
  });
}

/** Strength Sap heals the user by the target's Attack, then drops it. */
function strengthSap(): EffectHandlers {
  return targetEffect((ctx, target) => {
    const attack = effectiveStat(target, 'atk');
    healHolder(ctx, attack);
    applyBoostEffect(ctx.state, opponentOf(ctx.side), target, { atk: -1 });
    pushText(ctx.state, 'battle.log.move.strengthsap', {
      name: ctx.source.name,
      target: target.name,
    });
  });
}

/** Psycho Shift hands the user's status to the target. */
function psychoShift(): EffectHandlers {
  return targetEffect((ctx, target) => {
    const user = ctx.source;
    const status = user.status;
    if (!status || target.status !== null || !canApplyStatus(target, status)) {
      fail(ctx);
      return;
    }
    cureStatus(user);
    pushEvent(ctx.state, { kind: 'cure', side: ctx.side, status });
    applyStatusEffect(ctx.state, opponentOf(ctx.side), target, status);
    pushText(ctx.state, STATUS_SHIFTED[status as StatusId], {
      name: user.name,
      target: target.name,
    });
  });
}

/** Trick and Switcheroo trade the two held items. */
function itemSwap(): EffectHandlers {
  return targetEffect((ctx, target) => {
    const user = ctx.source;
    if (!user.heldItem && !target.heldItem) {
      fail(ctx);
      return;
    }
    const mine = user.heldItem;
    user.heldItem = target.heldItem;
    target.heldItem = mine;
    pushText(ctx.state, 'battle.log.move.itemswap', { name: user.name, target: target.name });
  });
}

/** Mimic copies the target's last move into the slot Mimic itself fills. */
function mimic(): EffectHandlers {
  return targetEffect((ctx, target) => {
    const user = ctx.source;
    const last = target.lastMoveId ? getMove(target.lastMoveId) : undefined;
    const slot = user.moves.find((entry) => entry.moveId === 'mimic');
    if (!last || !slot || user.moves.some((entry) => entry.moveId === last.id)) {
      fail(ctx);
      return;
    }
    slot.moveId = last.id;
    slot.maxPp = last.pp;
    slot.pp = Math.min(5, last.pp);
    pushText(ctx.state, 'battle.log.move.mimic', { name: user.name, move: last.id });
  });
}

/** Spite drains four PP from the move the target last used. */
function spite(): EffectHandlers {
  return targetEffect((ctx, target) => {
    const last = target.lastMoveId ? getMove(target.lastMoveId) : undefined;
    const slot = last ? target.moves.find((entry) => entry.moveId === last.id) : undefined;
    if (!last || !slot || slot.pp <= 0) {
      fail(ctx);
      return;
    }
    const lost = Math.min(4, slot.pp);
    slot.pp -= lost;
    pushText(ctx.state, 'battle.log.move.spite', {
      name: target.name,
      move: last.id,
      pp: lost,
    });
  });
}

/** Lock-On and Mind Reader make the user's next move a certain hit. */
function lockOn(): EffectHandlers {
  return selfEffect((ctx) => {
    applyLockOn(ctx.owner);
    pushText(ctx.state, 'battle.log.move.lockon', { name: ctx.owner.name });
  });
}

/** Moves one fighter toward `targetHp`, logging the heal or the damage it dealt. */
function moveToward(ctx: EffectContext, fighter: BattleFighter, targetHp: number): void {
  if (fighter.hp < targetHp) {
    const healed = applyHeal(fighter, targetHp - fighter.hp);
    if (healed > 0) {
      pushEvent(ctx.state, {
        kind: 'heal',
        side: fighter === ctx.source ? ctx.side : opponentOf(ctx.side),
        amount: healed,
        hp: fighter.hp,
        maxHp: fighter.maxHp,
      });
    }
    return;
  }
  if (fighter.hp <= targetHp) return;
  const dealt = applyDamage(fighter, fighter.hp - targetHp);
  pushEvent(ctx.state, {
    kind: 'damage',
    side: fighter === ctx.source ? ctx.side : opponentOf(ctx.side),
    amount: dealt,
    hp: fighter.hp,
    maxHp: fighter.maxHp,
    effectiveness: 1,
    crit: false,
  });
}

/** Pain Split shares the average of the two HP pools, the user first. */
function painSplit(): EffectHandlers {
  return targetEffect((ctx, target) => {
    const average = Math.floor((ctx.source.hp + target.hp) / 2);
    moveToward(ctx, ctx.source, average);
    moveToward(ctx, target, average);
  });
}

/** Quash pins the target to the back of this turn's order. */
function quash(): EffectHandlers {
  return targetEffect((ctx, target) => {
    if (!applyQuash(target)) {
      fail(ctx);
      return;
    }
    pushText(ctx.state, 'battle.log.move.quash', { name: target.name });
  });
}

/** Parting Shot lowers both of the target's attacking stats before the user leaves. */
function partingShot(): EffectHandlers {
  return targetEffect((ctx, target) => {
    applyBoostEffect(ctx.state, opponentOf(ctx.side), target, { atk: -1, spa: -1 });
  });
}

/** Defog drops the target's evasiveness, its screens and the field's terrain. */
function defog(): EffectHandlers {
  return targetEffect((ctx, target) => {
    const foeSide = opponentOf(ctx.side);
    const conditions = ctx.state.sides[foeSide].sideConditions;
    for (const id of ['reflect', 'lightscreen', 'auroraveil', 'safeguard', 'mist'] as const) {
      conditions[id] = 0;
    }
    if (ctx.state.terrain) {
      ctx.state.terrain = null;
      ctx.state.terrainTurns = 0;
    }
    applyBoostEffect(ctx.state, foeSide, target, { evasion: -1 });
    pushText(ctx.state, 'battle.log.move.defog', { name: ctx.source.name });
  });
}

/** Topsy-Turvy inverts every stat stage the target has. */
function topsyTurvy(): EffectHandlers {
  return targetEffect((ctx, target) => {
    const inverted: Partial<Record<BoostId, number>> = {};
    let any = false;
    for (const stat of BOOST_IDS) {
      if (target.boosts[stat] === 0) continue;
      inverted[stat] = -2 * target.boosts[stat];
      any = true;
    }
    if (!any) {
      fail(ctx);
      return;
    }
    applyBoostEffect(ctx.state, opponentOf(ctx.side), target, inverted, {
      message: { key: 'battle.log.move.topsyturvy', params: { name: target.name } },
    });
  });
}

/** Venom Drench drops a poisoned target's Attack, Sp. Atk and Speed. */
function venomDrench(): EffectHandlers {
  return targetEffect((ctx, target) => {
    if (target.status !== 'psn' && target.status !== 'tox') {
      fail(ctx);
      return;
    }
    applyBoostEffect(
      ctx.state,
      opponentOf(ctx.side),
      target,
      { atk: -1, spa: -1, spe: -1 },
      {
        message: { key: 'battle.log.move.venomdrench', params: { name: target.name } },
      },
    );
  });
}

/** Smack Down knocks a flying target to the ground. */
function smackDown(): EffectHandlers {
  return targetEffect((ctx, target) => {
    if (!applySmackDown(target)) return;
    pushText(ctx.state, 'battle.log.move.smackdown', { name: target.name });
  });
}

/**
 * Shed Tail pays half the user's max HP, leaves a substitute and hands the turn to
 * the bench. The cost and the substitute are one rule, so the handler owns the
 * whole move and vetoes the generic path.
 */
function shedTail(): EffectHandlers {
  return {
    onTryHit: (ctx) => {
      if (ctx.owner !== ctx.source) return;
      const user = ctx.source;
      const cost = Math.max(1, Math.floor(user.maxHp / 2));
      if (user.hp <= cost) {
        fail(ctx);
        return false;
      }
      const dealt = applyDamage(user, cost);
      pushEvent(ctx.state, {
        kind: 'damage',
        side: ctx.side,
        amount: dealt,
        hp: user.hp,
        maxHp: user.maxHp,
        effectiveness: 1,
        crit: false,
      });
      user.volatiles.substitute = Math.max(1, Math.floor(user.maxHp / 4));
      pushText(ctx.state, 'battle.log.move.shedtail', { name: user.name });
      const battleSide = ctx.state.sides[ctx.side];
      const active = battleSide.party.indexOf(user);
      const hasBench = battleSide.party.some((fighter, index) => index !== active && fighter.hp > 0);
      if (hasBench) battleSide.awaitingReplacement = true;
      return false;
    },
  };
}

/** The status half's handlers, keyed by move id; `moveEffects()` registers them. */
export const MOVE_EFFECTS: Readonly<Record<string, EffectHandlers>> = {
  acupressure: acupressure(),
  aromatherapy: teamCure('battle.log.move.aromatherapy'),
  bellydrum: bellyDrum(),
  block: trapMove(),
  camouflage: camouflage(),
  captivate: captivate(),
  celebrate: textMove((name) => ({ key: 'battle.log.move.celebrate', params: { name } })),
  clangoroussoul: hpCost(3, (name) => ({
    key: 'battle.log.move.clangoroussoul',
    params: { name },
  })),
  conversion: conversion(),
  conversion2: conversion2(),
  curse: curse(),
  darkvoid: signatureMove('darkrai'),
  defog: defog(),
  doodle: doodle(),
  dreameater: requiresSleep('target'),
  entrainment: entrainment(),
  filletaway: hpCost(2, (name) => ({
    key: 'battle.log.move.filletaway',
    params: { name },
  })),
  floralhealing: healTarget(
    (ctx, target) => (ctx.state.terrain === 'grassy' && isGrounded(target) ? 2 / 3 : 1 / 2),
    (name) => ({ key: 'battle.log.regainedHealth', params: { name } }),
  ),
  flowershield: fieldBoosts(
    { def: 1 },
    (fighter) => fighter.types.includes('Grass'),
    'battle.log.move.flowershield',
  ),
  forestscurse: addedTypeMove('Grass'),
  guardsplit: statSplit(['def', 'spd']),
  guardswap: stageSwap(['def', 'spd']),
  haze: haze(),
  healbell: teamCure('battle.log.move.healbell'),
  healpulse: healTarget(
    () => 1 / 2,
    (name) => ({ key: 'battle.log.regainedHealth', params: { name } }),
  ),
  heartswap: stageSwap(BOOST_IDS),
  hyperspacefury: signatureMove('hoopaunbound'),
  junglehealing: healAndCure(1 / 4, 'battle.log.move.junglehealing'),
  lockon: lockOn(),
  lunarblessing: healAndCure(1 / 4, 'battle.log.move.lunarblessing'),
  magicpowder: magicPowder(),
  meanlook: trapMove(),
  mimic: mimic(),
  mindreader: lockOn(),
  moonlight: sunHeal(),
  morningsun: sunHeal(),
  painsplit: painSplit(),
  partingshot: partingShot(),
  perishsong: perishSong(),
  powersplit: statSplit(['atk', 'spa']),
  powerswap: stageSwap(['atk', 'spa']),
  psychoshift: psychoShift(),
  psychup: psychUp(),
  purify: purify(),
  quash: quash(),
  reflecttype: reflectType(),
  refresh: refresh(),
  rest: rest(),
  roleplay: rolePlay(),
  rototiller: fieldBoosts(
    { atk: 1, spa: 1 },
    (fighter) => fighter.types.includes('Grass') && isGrounded(fighter),
    'battle.log.move.rototiller',
  ),
  shedtail: shedTail(),
  shoreup: shoreUp(),
  simplebeam: grantAbility('Insomnia'),
  skillswap: skillSwap(),
  smackdown: smackDown(),
  snore: requiresSleep('source'),
  soak: soak(),
  speedswap: speedSwap(),
  spite: spite(),
  spiderweb: trapMove(),
  splash: textMove(() => ({ key: 'battle.log.move.splash' })),
  stockpile: stockpile(),
  strengthsap: strengthSap(),
  stuffcheeks: stuffCheeks(),
  swallow: swallow(),
  switcheroo: itemSwap(),
  synthesis: sunHeal(),
  takeheart: takeHeart(),
  teatime: teatime(),
  tidyup: tidyUp(),
  topsyturvy: topsyTurvy(),
  trick: itemSwap(),
  trickortreat: addedTypeMove('Ghost'),
  venomdrench: venomDrench(),
  worryseed: grantAbility('Insomnia'),
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
