import { effectiveness, getSpecies, type Move } from '../../data/dex';
import type { Rng } from '../rng';
import {
  BOOST_IDS,
  effectiveSpeed,
  effectiveStat,
  isGrounded,
  stagedStat,
  type BattleFighter,
} from './fighter';
import type { TerrainId, WeatherId } from './state';

const CRIT_CHANCES: readonly number[] = [0, 1 / 24, 1 / 8, 1 / 2, 1];

export function critChance(critRatio: number): number {
  const index = Math.max(0, Math.min(CRIT_CHANCES.length - 1, Math.floor(critRatio)));
  return CRIT_CHANCES[index];
}

export function rollCrit(rng: Rng, critRatio: number): boolean {
  return rng.next() < critChance(critRatio);
}

/** The two ways a damaging move gets its number. */
export type DamageResolver = 'fixed' | 'power';

/**
 * Every move whose amount is not a dex `basePower` at all: no data field and no dex
 * number can express it, so the engine owns it outright. `'fixed'` — `fixedDamage`
 * returns the amount and the formula is bypassed. `'power'` — `resolveBasePower`
 * computes the power the formula multiplies from scratch.
 * The ledger parses this table as its evidence (`scripts/effect-coverage.mjs`), so
 * adding an id here is adding an audit row.
 */
export const DAMAGE_RESOLVERS: Readonly<Record<string, DamageResolver>> = {
  beatup: 'power',
  crushgrip: 'power',
  dragonrage: 'fixed',
  electroball: 'power',
  endeavor: 'fixed',
  finalgambit: 'fixed',
  fissure: 'fixed',
  flail: 'power',
  frustration: 'power',
  grassknot: 'power',
  guillotine: 'fixed',
  gyroball: 'power',
  hardpress: 'power',
  heatcrash: 'power',
  heavyslam: 'power',
  horndrill: 'fixed',
  lowkick: 'power',
  naturesmadness: 'fixed',
  nightshade: 'fixed',
  present: 'power',
  psywave: 'fixed',
  ragefist: 'power',
  reversal: 'power',
  return: 'power',
  ruination: 'fixed',
  seismictoss: 'fixed',
  sheercold: 'fixed',
  sonicboom: 'fixed',
  spitup: 'power',
  superfang: 'fixed',
  wringout: 'power',
};

export type DamageContext = Readonly<{
  weather?: WeatherId | null;
  terrain?: TerrainId | null;
  critical?: boolean;
  /** Overrides the type chart, for abilities that pierce an immunity (Scrappy). */
  effectiveness?: number;
  /** Unaware: ignore the attacker's offensive stages. */
  ignoreAttackBoosts?: boolean;
  /** Unaware: ignore the defender's defensive stages. */
  ignoreDefenseBoosts?: boolean;
  /** Stat auras (the Ruin quartet) as a multiplier on the final stat. */
  attackMultiplier?: number;
  defenseMultiplier?: number;
  /** Reflect / Aurora Veil halve physical damage; Light Screen the special one. */
  reflect?: boolean;
  lightScreen?: boolean;
  auroraVeil?: boolean;
  /** Wonder Room swaps the defensive stats a hit reads. */
  wonderRoom?: boolean;
  /** The room's all-types change: every fighter's types are this one type. */
  overrideType?: string | null;
  /** Dark Aura: Dark moves deal 1.33× on both sides. */
  darkAura?: boolean;
  /** Fairy Aura: Fairy moves deal 1.33× on both sides. */
  fairyAura?: boolean;
  /** The user's side party, in slot order. Beat Up's hit count, Last Respects' count. */
  party?: readonly BattleFighter[];
  /** The target's side has already used a move this turn (Payback, Bolt Beak, Fishious Rend). */
  targetMovedFirst?: boolean;
  /** The user has been hit by a damaging move this turn (Avalanche, Revenge). */
  userDamagedThisTurn?: boolean;
  /** The player's repeated party types (the four team-type bonuses). */
  teamTypes?: readonly string[];
}>;

/** The damage multiplier a repeated party type adds to a move of that type. */
export const TEAM_TYPE_DAMAGE = 1.1;

/**
 * The multiplier a move of `moveType` earns from `teamTypes`: `TEAM_TYPE_DAMAGE`
 * when the type is listed, `1` otherwise. Never reads the RNG.
 */
export function teamTypeDamageMultiplier(moveType: string, teamTypes: readonly string[]): number {
  return teamTypes.includes(moveType) ? TEAM_TYPE_DAMAGE : 1;
}

export type DamageResult = Readonly<{
  damage: number;
  effectiveness: number;
  crit: boolean;
  stab: boolean;
}>;

export function baseDamage(level: number, power: number, attack: number, defense: number): number {
  return Math.floor((Math.floor((2 * level) / 5 + 2) * power * attack) / defense / 50) + 2;
}

/** True when the move deals damage at all — including a move whose dex power is 0. */
export function resolvesToDamage(move: Move): boolean {
  return move.category !== 'Status' && (move.basePower > 0 || move.id in DAMAGE_RESOLVERS);
}

/** True when the move's amount bypasses the formula. */
export function isFixedDamageMove(move: Move): boolean {
  return move.category !== 'Status' && DAMAGE_RESOLVERS[move.id] === 'fixed';
}

/** Return and Frustration both read the reference's maximum, 255 / 2.5. */
const MAX_HAPPINESS_POWER = 102;

function speciesWeight(fighter: BattleFighter): number {
  return getSpecies(fighter.speciesId)?.weightkg ?? 0;
}

/** Flail and Reversal: the lower the user's remaining HP, the harder the hit. */
function pinchPower(attacker: BattleFighter): number {
  const ratio = attacker.hp / attacker.maxHp;
  if (ratio > 0.6875) return 20;
  if (ratio > 0.5417) return 40;
  if (ratio > 0.3542) return 80;
  if (ratio > 0.2083) return 100;
  return 150;
}

function speedPower(attacker: BattleFighter, defender: BattleFighter): number {
  const user = effectiveSpeed(attacker);
  const foe = effectiveSpeed(defender);
  if (user >= 4 * foe) return 150;
  if (user >= 3 * foe) return 120;
  if (user >= 2 * foe) return 80;
  if (user > foe) return 60;
  return 40;
}

/** Low Kick and Grass Knot read the defender's weight in kilograms. */
function weightPower(defender: BattleFighter): number {
  const weight = speciesWeight(defender);
  if (weight >= 200) return 120;
  if (weight >= 100) return 100;
  if (weight >= 50) return 80;
  if (weight >= 25) return 60;
  if (weight >= 10) return 40;
  return 20;
}

/** Heat Crash and Heavy Slam read the two weights' ratio. */
function weightRatioPower(attacker: BattleFighter, defender: BattleFighter): number {
  const ratio = Math.max(0.1, speciesWeight(attacker)) / Math.max(0.1, speciesWeight(defender));
  if (ratio >= 5) return 120;
  if (ratio >= 4) return 100;
  if (ratio >= 3) return 80;
  if (ratio >= 2) return 60;
  return 40;
}

/** The power the formula multiplies. `move.basePower` for every unresolved move. */
export function resolveBasePower(
  attacker: BattleFighter,
  defender: BattleFighter,
  move: Move,
  context: DamageContext = {},
): number {
  switch (move.id) {
    case 'beatup': {
      const baseAttack = getSpecies(attacker.speciesId)?.baseStats.atk ?? 0;
      return 10 + Math.floor(baseAttack / 10);
    }
    case 'crushgrip':
    case 'wringout':
      return Math.max(1, Math.floor((120 * defender.hp) / defender.maxHp));
    case 'hardpress':
      return Math.max(1, Math.floor((100 * defender.hp) / defender.maxHp));
    case 'flail':
    case 'reversal':
      return pinchPower(attacker);
    case 'electroball':
      return speedPower(attacker, defender);
    case 'gyroball':
      return Math.min(150, Math.floor((25 * effectiveSpeed(defender)) / effectiveSpeed(attacker)) + 1);
    case 'lowkick':
    case 'grassknot':
      return weightPower(defender);
    case 'heatcrash':
    case 'heavyslam':
      return weightRatioPower(attacker, defender);
    case 'return':
    case 'frustration':
      return MAX_HAPPINESS_POWER;
    case 'present':
      return move.basePower > 0 ? move.basePower : 40;
    case 'spitup':
      return 100 * attacker.volatiles.stockpile;
    case 'ragefist':
      // The reference's own numbers: 50, +50 per hit the user has taken, six hits at
      // most (docs/battle-spec.md §3.3).
      return Math.min(350, 50 + 50 * attacker.volatiles.timesHit);
    case 'eruption':
    case 'waterspout':
    case 'dragonenergy':
      return Math.max(1, Math.floor((150 * attacker.hp) / attacker.maxHp));
    case 'storedpower':
    case 'powertrip': {
      let stages = 0;
      for (const stat of BOOST_IDS) stages += Math.max(0, attacker.boosts[stat]);
      return 20 + 20 * stages;
    }
    case 'lastrespects': {
      const party = context.party ?? [attacker];
      return 50 + 50 * party.filter((fighter) => fighter.hp <= 0).length;
    }
    case 'hex':
      return defender.status !== null ? 130 : 65;
    case 'venoshock':
      return defender.status === 'psn' || defender.status === 'tox' ? 130 : 65;
    case 'facade':
      return attacker.status !== null ? 140 : 70;
    case 'brine':
      return defender.hp * 2 <= defender.maxHp ? 130 : 65;
    case 'payback':
      return context.targetMovedFirst === true ? 100 : 50;
    case 'avalanche':
    case 'revenge':
      return context.userDamagedThisTurn === true ? 120 : 60;
    case 'boltbeak':
    case 'fishiousrend':
      return context.targetMovedFirst !== true ? 170 : 85;
    case 'expandingforce':
      return context.terrain === 'psychic' ? 120 : 80;
    case 'risingvoltage':
      return context.terrain === 'electric' && isGrounded(defender) ? 140 : 70;
    case 'grassyglide':
      return context.terrain === 'grassy' ? 70 : 55;
    case 'psyblade':
      return context.terrain === 'electric' ? 120 : 80;
    default:
      return move.basePower;
  }
}

/** A straight KO: the OHKO roll, or the whole of the defender's HP when it lands. */
function ohkoDamage(attacker: BattleFighter, defender: BattleFighter, rng: Rng | null): number {
  if (attacker.level < defender.level) return 0;
  if (rng === null) return defender.hp;
  const chance = Math.min(100, 30 + (attacker.level - defender.level));
  return rng.int(1, 100) <= chance ? defender.hp : 0;
}

/**
 * The amount the move deals outside the formula, or null when it goes through it.
 * `rng === null` is the deterministic estimate (AI / preview): no draw, no roll.
 */
export function fixedDamage(
  attacker: BattleFighter,
  defender: BattleFighter,
  move: Move,
  rng: Rng | null,
): number | null {
  if (move.category === 'Status') return null;
  switch (move.id) {
    case 'seismictoss':
    case 'nightshade':
      return attacker.level;
    case 'dragonrage':
      return 40;
    case 'sonicboom':
      return 20;
    case 'superfang':
    case 'naturesmadness':
    case 'ruination':
      return Math.max(1, Math.floor(defender.hp / 2));
    case 'endeavor':
      return Math.max(0, defender.hp - attacker.hp);
    case 'finalgambit':
      return attacker.hp;
    case 'psywave':
      return rng === null
        ? attacker.level
        : Math.max(1, Math.floor((attacker.level * rng.int(5, 15)) / 10));
    case 'fissure':
    case 'guillotine':
    case 'horndrill':
      return ohkoDamage(attacker, defender, rng);
    case 'sheercold':
      return defender.types.includes('Ice') ? 0 : ohkoDamage(attacker, defender, rng);
    default:
      return move.damage === 'level' ? attacker.level : null;
  }
}

function weatherModifier(weather: WeatherId | null | undefined, moveType: string): number {
  if (weather === 'sun') {
    if (moveType === 'Fire') return 1.5;
    if (moveType === 'Water') return 0.5;
  }
  if (weather === 'rain') {
    if (moveType === 'Water') return 1.5;
    if (moveType === 'Fire') return 0.5;
  }
  return 1;
}

function isPhysical(move: Move): boolean {
  return move.category === 'Physical';
}

const GRASSY_HALVED_MOVES = new Set(['earthquake', 'bulldoze']);

function terrainModifier(
  attacker: BattleFighter,
  defender: BattleFighter,
  move: Move,
  terrain: TerrainId | null | undefined,
): number {
  if (!terrain || move.category === 'Status' || move.basePower <= 0) return 1;
  let multiplier = 1;
  if (isGrounded(attacker)) {
    if (terrain === 'electric' && move.type === 'Electric') multiplier *= 1.3;
    if (terrain === 'grassy' && move.type === 'Grass') multiplier *= 1.3;
    if (terrain === 'psychic' && move.type === 'Psychic') multiplier *= 1.3;
  }
  if (terrain === 'grassy' && GRASSY_HALVED_MOVES.has(move.id)) multiplier *= 0.5;
  if (terrain === 'misty' && isGrounded(defender) && move.type === 'Dragon') multiplier *= 0.5;
  return multiplier;
}

/** Which fighter's stat the hit reads, and which stat: Body Press and Foul Play swap it. */
type AttackSource = Readonly<{ fighter: BattleFighter; stat: 'atk' | 'def' | 'spa' }>;

function attackSourceOf(attacker: BattleFighter, defender: BattleFighter, move: Move): AttackSource {
  if (move.id === 'bodypress') return { fighter: attacker, stat: 'def' };
  if (move.id === 'foulplay') return { fighter: defender, stat: 'atk' };
  return { fighter: attacker, stat: isPhysical(move) ? 'atk' : 'spa' };
}

/**
 * Gen 9 damage formula. The random 85-100% roll is the only RNG use, so a fixed
 * seed reproduces a whole battle (D11); a fixed-damage move bypasses the formula
 * entirely and takes no roll.
 */
export function computeDamage(
  attacker: BattleFighter,
  defender: BattleFighter,
  move: Move,
  rng: Rng,
  context: DamageContext = {},
): DamageResult {
  const fixed = fixedDamage(attacker, defender, move, rng);
  if (fixed !== null) {
    return { damage: fixed, effectiveness: 1, crit: false, stab: false };
  }

  const physical = isPhysical(move);
  const source = attackSourceOf(attacker, defender, move);
  // Wonder Room swaps which defense the hit reads.
  const defenseStat = physical
    ? context.wonderRoom
      ? 'spd'
      : 'def'
    : context.wonderRoom
      ? 'def'
      : 'spd';

  const attackStage = context.ignoreAttackBoosts
    ? 0
    : context.critical
      ? Math.max(0, source.fighter.boosts[source.stat])
      : source.fighter.boosts[source.stat];
  const defenseStage = context.ignoreDefenseBoosts
    ? 0
    : context.critical
      ? Math.min(0, defender.boosts[defenseStat])
      : defender.boosts[defenseStat];

  const attack = Math.max(
    1,
    Math.floor(
      stagedStat(source.fighter.stats[source.stat], attackStage) * (context.attackMultiplier ?? 1),
    ),
  );
  const defense = Math.max(
    1,
    Math.floor(stagedStat(defender.stats[defenseStat], defenseStage) * (context.defenseMultiplier ?? 1)),
  );

  const crit = context.critical ?? rollCrit(rng, move.critRatio);
  let damage = baseDamage(
    attacker.level,
    resolveBasePower(attacker, defender, move, context),
    attack,
    defense,
  );

  damage = Math.floor(damage * weatherModifier(context.weather, move.type));
  damage = Math.floor(damage * terrainModifier(attacker, defender, move, context.terrain));
  if (context.darkAura && move.type === 'Dark') damage = Math.floor(damage * 1.33);
  if (context.fairyAura && move.type === 'Fairy') damage = Math.floor(damage * 1.33);
  if (crit) damage = Math.floor(damage * 1.5);
  if (physical && (context.reflect || context.auroraVeil)) damage = Math.floor(damage * 0.5);
  if (!physical && (context.lightScreen || context.auroraVeil)) damage = Math.floor(damage * 0.5);
  damage = Math.floor((damage * rng.int(85, 100)) / 100);

  const attackerTypes = context.overrideType ? [context.overrideType] : attacker.types;
  const defenderTypes = context.overrideType ? [context.overrideType] : defender.types;
  const stab = attackerTypes.includes(move.type);
  if (stab) damage = Math.floor(damage * 1.5);
  damage = Math.floor(damage * teamTypeDamageMultiplier(move.type, context.teamTypes ?? []));

  const typeEffectiveness = context.effectiveness ?? effectiveness(move.type, defenderTypes);
  damage = Math.floor(damage * typeEffectiveness);

  if (physical && attacker.status === 'brn') damage = Math.floor(damage * 0.5);

  return {
    damage: typeEffectiveness === 0 ? 0 : Math.max(1, damage),
    effectiveness: typeEffectiveness,
    crit,
    stab,
  };
}

/** Deterministic best-case damage for AI comparison; never rolls. */
export function estimateDamage(
  attacker: BattleFighter,
  defender: BattleFighter,
  move: Move,
  context: DamageContext = {},
): DamageResult {
  const fixed = fixedDamage(attacker, defender, move, null);
  if (fixed !== null) {
    return { damage: fixed, effectiveness: 1, crit: false, stab: false };
  }

  const physical = isPhysical(move);
  const source = attackSourceOf(attacker, defender, move);
  const defenseStat = physical ? 'def' : 'spd';
  const attack = effectiveStat(source.fighter, source.stat);
  const defense = effectiveStat(defender, defenseStat);

  let damage = baseDamage(
    attacker.level,
    resolveBasePower(attacker, defender, move, context),
    attack,
    defense,
  );
  const stab = attacker.types.includes(move.type);
  if (stab) damage = Math.floor(damage * 1.5);
  damage = Math.floor(damage * teamTypeDamageMultiplier(move.type, context.teamTypes ?? []));
  const typeEffectiveness = effectiveness(move.type, defender.types);
  damage = Math.floor(damage * typeEffectiveness);
  if (physical && attacker.status === 'brn') damage = Math.floor(damage * 0.5);

  return {
    damage: typeEffectiveness === 0 ? 0 : Math.max(1, damage),
    effectiveness: typeEffectiveness,
    crit: false,
    stab,
  };
}

/** Confusion self-hit: a typeless 40-power physical move against itself. */
export function confusionDamage(fighter: BattleFighter, rng: Rng): number {
  const raw = baseDamage(
    fighter.level,
    40,
    effectiveStat(fighter, 'atk'),
    effectiveStat(fighter, 'def'),
  );
  return Math.max(1, Math.floor((raw * rng.int(85, 100)) / 100));
}
