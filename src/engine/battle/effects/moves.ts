import { effectiveness, getMove, TYPE_NAMES, type Move, type Stats } from '../../../data/dex';
import { getItem } from '../../../data/items';
import {
  addType,
  applyDamage,
  applyHeal,
  BOOST_IDS,
  effectiveStat,
  emptyBoosts,
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
  type FieldConditionId,
  type SideConditionId,
  type SideId,
} from '../state';
import { canApplyStatus, cureStatus, statusName } from '../status';
import { applyLockOn, applyPerish, applyQuash, applySmackDown, applyTrap } from '../volatile';
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
    applyStatusEffect(
      state,
      side,
      attacker,
      punish.contactStatus,
      `${attacker.name} was hurt by the protection!`,
    );
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
        message: `${holder.name} cut its own HP and maximized its Attack!`,
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
      applyBoostEffect(
        ctx.state,
        ctx.side,
        user,
        { atk: 1, def: 1, spe: -1 },
        {
          self: true,
          message: `${user.name} cursed itself and raised its Attack and Defense!`,
        },
      );
      return;
    }
    if (target.volatiles.curse) {
      pushText(ctx.state, 'But it failed!');
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
    applyBoostEffect(
      ctx.state,
      ctx.side,
      holder,
      { def: 1, spd: 1 },
      {
        self: true,
        message: `${holder.name} stockpiled ${holder.volatiles.stockpile}!`,
      },
    );
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
    pushText(
      ctx.state,
      any ? 'All Pokémon hearing the song will faint in three turns!' : 'But it failed!',
    );
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
    applyBoostEffect(
      ctx.state,
      ctx.side,
      holder,
      { def: 2 },
      {
        self: true,
        message: `${holder.name} ate its ${item.name} and raised its Defense!`,
      },
    );
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
    applyBoostEffect(
      ctx.state,
      ctx.side,
      ctx.owner,
      { spa: 1, spd: 1 },
      {
        self: true,
        message: `${ctx.owner.name} took heart and raised its Sp. Atk and Sp. Def!`,
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
    if (!any) pushText(ctx.state, 'But it failed!');
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
        message: `${ctx.owner.name} tidied up and raised its Attack and Speed!`,
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
  pushText(ctx.state, 'But it failed!');
}

/**
 * A move that pays a fraction of its own max HP before its data applies, and fails
 * when the user cannot afford it (Clangorous Soul, Fillet Away).
 */
function hpCost(denominator: number, message: (name: string) => string): EffectHandlers {
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
      pushText(ctx.state, message(user.name));
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
    pushText(ctx.state, `${target.name} transformed into the Water type!`);
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
    pushText(ctx.state, `${user.name} copied ${target.name}'s type!`);
  });
}

function magicPowder(): EffectHandlers {
  return targetEffect((ctx, target) => {
    if (target.types.length === 1 && target.types[0] === 'Psychic') {
      fail(ctx);
      return;
    }
    rewriteTypes(target, ['Psychic']);
    pushText(ctx.state, `${target.name} transformed into the Psychic type!`);
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
    pushText(ctx.state, `${target.name} became the ${type} type too!`);
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
    pushText(ctx.state, `${target.name}'s Ability became ${ability}!`);
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
    pushText(ctx.state, `${target.name}'s Ability became ${ctx.source.ability}!`);
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
    pushText(ctx.state, `${user.name} swapped Abilities with ${target.name}!`);
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
    pushText(ctx.state, `${user.name} switched stat changes with ${target.name}!`);
  });
}

/** Speed Swap trades the raw Speed stat, not its stage. */
function speedSwap(): EffectHandlers {
  return targetEffect((ctx, target) => {
    const user = ctx.source;
    const mine = user.stats.spe;
    user.stats = { ...user.stats, spe: target.stats.spe };
    target.stats = { ...target.stats, spe: mine };
    pushText(ctx.state, `${user.name} swapped Speed with ${target.name}!`);
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
    pushText(ctx.state, `${user.name} shared its stats with ${target.name}!`);
  });
}

/** Heal Pulse and Floral Healing restore the target's HP. */
function healTarget(
  fraction: (ctx: EffectContext, target: BattleFighter) => number,
  message: (name: string) => string,
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
    pushText(ctx.state, message(target.name));
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
    pushText(ctx.state, `${target.name} was purified!`);
  });
}

/** Strength Sap heals the user by the target's Attack, then drops it. */
function strengthSap(): EffectHandlers {
  return targetEffect((ctx, target) => {
    const attack = effectiveStat(target, 'atk');
    healHolder(ctx, attack);
    applyBoostEffect(ctx.state, opponentOf(ctx.side), target, { atk: -1 });
    pushText(ctx.state, `${ctx.source.name} sapped ${target.name}'s strength!`);
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
    pushText(ctx.state, `${user.name} shifted its ${statusName(status)} to ${target.name}!`);
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
    pushText(ctx.state, `${user.name} swapped items with ${target.name}!`);
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
    pushText(ctx.state, `${user.name} learned ${last.name}!`);
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
    pushText(ctx.state, `${target.name}'s ${last.name} lost ${lost} PP!`);
  });
}

/** Lock-On and Mind Reader make the user's next move a certain hit. */
function lockOn(): EffectHandlers {
  return selfEffect((ctx) => {
    applyLockOn(ctx.owner);
    pushText(ctx.state, `${ctx.owner.name} took aim at its foe!`);
  });
}

/** Quash pins the target to the back of this turn's order. */
function quash(): EffectHandlers {
  return targetEffect((ctx, target) => {
    if (!applyQuash(target)) {
      fail(ctx);
      return;
    }
    pushText(ctx.state, `${target.name} will act last this turn!`);
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
    pushText(ctx.state, `${ctx.source.name} blew away the field's effects!`);
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
      message: `${target.name}'s stat changes were inverted!`,
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
        message: `${target.name} was drenched and its stats fell!`,
      },
    );
  });
}

/** Smack Down knocks a flying target to the ground. */
function smackDown(): EffectHandlers {
  return targetEffect((ctx, target) => {
    if (!applySmackDown(target)) return;
    pushText(ctx.state, `${target.name} fell straight down!`);
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
      pushText(ctx.state, `${user.name} shed its tail and put in a substitute!`);
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
  aromatherapy: teamCure('A soothing aroma wafted through the area!'),
  bellydrum: bellyDrum(),
  block: trapMove(),
  camouflage: camouflage(),
  captivate: captivate(),
  celebrate: textMove((name) => `Congratulations, ${name}!`),
  clangoroussoul: hpCost(3, (name) => `${name} cut its own HP to raise all its stats!`),
  conversion: conversion(),
  conversion2: conversion2(),
  curse: curse(),
  darkvoid: signatureMove('darkrai'),
  defog: defog(),
  doodle: doodle(),
  dreameater: requiresSleep('target'),
  entrainment: entrainment(),
  filletaway: hpCost(2, (name) => `${name} cut its own HP to raise its Attack, Sp. Atk and Speed!`),
  floralhealing: healTarget(
    (ctx, target) => (ctx.state.terrain === 'grassy' && isGrounded(target) ? 2 / 3 : 1 / 2),
    (name) => `${name} regained health!`,
  ),
  flowershield: fieldBoosts(
    { def: 1 },
    (fighter) => fighter.types.includes('Grass'),
    'The Defense of Grass-type Pokémon rose!',
  ),
  forestscurse: addedTypeMove('Grass'),
  guardsplit: statSplit(['def', 'spd']),
  guardswap: stageSwap(['def', 'spd']),
  haze: haze(),
  healbell: teamCure('A bell chimed and healed the team!'),
  healpulse: healTarget(
    () => 1 / 2,
    (name) => `${name} regained health!`,
  ),
  heartswap: stageSwap(BOOST_IDS),
  hyperspacefury: signatureMove('hoopaunbound'),
  junglehealing: healAndCure(1 / 4, 'The team was healed by the jungle!'),
  lockon: lockOn(),
  lunarblessing: healAndCure(1 / 4, 'The team was bathed in lunar light!'),
  magicpowder: magicPowder(),
  meanlook: trapMove(),
  mimic: mimic(),
  mindreader: lockOn(),
  moonlight: sunHeal(),
  morningsun: sunHeal(),
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
    'The Attack and Sp. Atk of grounded Grass-type Pokémon rose!',
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
  splash: textMove(() => 'But nothing happened!'),
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
