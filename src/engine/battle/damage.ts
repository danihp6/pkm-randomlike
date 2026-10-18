import { effectiveness, type Move } from '../../data/dex';
import type { Rng } from '../rng';
import { effectiveStat, isGrounded, stagedStat, type BattleFighter } from './fighter';
import type { TerrainId, WeatherId } from './state';

const CRIT_CHANCES: readonly number[] = [0, 1 / 24, 1 / 8, 1 / 2, 1];

export function critChance(critRatio: number): number {
  const index = Math.max(0, Math.min(CRIT_CHANCES.length - 1, Math.floor(critRatio)));
  return CRIT_CHANCES[index];
}

export function rollCrit(rng: Rng, critRatio: number): boolean {
  return rng.next() < critChance(critRatio);
}

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
}>;

export type DamageResult = Readonly<{
  damage: number;
  effectiveness: number;
  crit: boolean;
  stab: boolean;
}>;

export function baseDamage(level: number, power: number, attack: number, defense: number): number {
  return Math.floor((Math.floor((2 * level) / 5 + 2) * power * attack) / defense / 50) + 2;
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

/**
 * Gen 9 damage formula. The random 85-100% roll is the only RNG use, so a fixed
 * seed reproduces a whole battle (D11).
 */
export function computeDamage(
  attacker: BattleFighter,
  defender: BattleFighter,
  move: Move,
  rng: Rng,
  context: DamageContext = {},
): DamageResult {
  const physical = isPhysical(move);
  const attackStat = physical ? 'atk' : 'spa';
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
      ? Math.max(0, attacker.boosts[attackStat])
      : attacker.boosts[attackStat];
  const defenseStage = context.ignoreDefenseBoosts
    ? 0
    : context.critical
      ? Math.min(0, defender.boosts[defenseStat])
      : defender.boosts[defenseStat];

  const attack = Math.max(
    1,
    Math.floor(stagedStat(attacker.stats[attackStat], attackStage) * (context.attackMultiplier ?? 1)),
  );
  const defense = Math.max(
    1,
    Math.floor(stagedStat(defender.stats[defenseStat], defenseStage) * (context.defenseMultiplier ?? 1)),
  );

  const crit = context.critical ?? rollCrit(rng, move.critRatio);
  let damage = baseDamage(attacker.level, move.basePower, attack, defense);

  damage = Math.floor(damage * weatherModifier(context.weather, move.type));
  damage = Math.floor(damage * terrainModifier(attacker, defender, move, context.terrain));
  if (crit) damage = Math.floor(damage * 1.5);
  if (physical && (context.reflect || context.auroraVeil)) damage = Math.floor(damage * 0.5);
  if (!physical && (context.lightScreen || context.auroraVeil)) damage = Math.floor(damage * 0.5);
  damage = Math.floor((damage * rng.int(85, 100)) / 100);

  const stab = attacker.types.includes(move.type);
  if (stab) damage = Math.floor(damage * 1.5);

  const typeEffectiveness = context.effectiveness ?? effectiveness(move.type, defender.types);
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
): DamageResult {
  const physical = isPhysical(move);
  const attackStat = physical ? 'atk' : 'spa';
  const defenseStat = physical ? 'def' : 'spd';
  const attack = effectiveStat(attacker, attackStat);
  const defense = effectiveStat(defender, defenseStat);

  let damage = baseDamage(attacker.level, move.basePower, attack, defense);
  const stab = attacker.types.includes(move.type);
  if (stab) damage = Math.floor(damage * 1.5);
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
