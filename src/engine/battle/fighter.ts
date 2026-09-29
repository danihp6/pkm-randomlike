import {
  STAT_IDS,
  getMove,
  getSpecies,
  levelUpMoves,
  statAtLevel,
  type StatId,
  type Stats,
} from '../../data/dex';
import { MAX_IV } from '../../data/dex/natures';

export type StatusId = 'brn' | 'psn' | 'tox' | 'par' | 'slp' | 'frz';

export type BoostId = 'atk' | 'def' | 'spa' | 'spd' | 'spe' | 'accuracy' | 'evasion';

export const BOOST_IDS: readonly BoostId[] = [
  'atk',
  'def',
  'spa',
  'spd',
  'spe',
  'accuracy',
  'evasion',
];

export type Boosts = Record<BoostId, number>;

export type MoveSlot = {
  moveId: string;
  pp: number;
  maxPp: number;
};

export type Volatiles = {
  confusion: number;
  flinched: boolean;
  leechSeed: boolean;
  substitute: number;
  taunt: number;
  encore: number;
  encoreMove: string | null;
  trapped: boolean;
  perish: number;
};

export type BattleFighter = {
  id: string;
  speciesId: string;
  name: string;
  level: number;
  nature: string;
  ability: string;
  /** Item id held in battle, or null; consumed berries clear it. */
  heldItem: string | null;
  types: readonly string[];
  stats: Stats;
  ivs: Stats;
  evs: Stats;
  hp: number;
  maxHp: number;
  status: StatusId | null;
  /** Sleep turns left, or the toxic counter (1 when freshly poisoned). */
  statusCounter: number;
  moves: MoveSlot[];
  boosts: Boosts;
  volatiles: Volatiles;
  lastMoveId: string | null;
};

export type FighterInput = Readonly<{
  id: string;
  speciesId: string;
  level: number;
  nature?: string;
  ability?: string;
  heldItem?: string;
  ivs?: Partial<Stats>;
  evs?: Partial<Stats>;
  moves?: readonly string[];
  nickname?: string;
}>;

export function emptyBoosts(): Boosts {
  return { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 };
}

export function emptyVolatiles(): Volatiles {
  return {
    confusion: 0,
    flinched: false,
    leechSeed: false,
    substitute: 0,
    taunt: 0,
    encore: 0,
    encoreMove: null,
    trapped: false,
    perish: 0,
  };
}

export function clampBoost(stages: number): number {
  return Math.max(-6, Math.min(6, stages));
}

export function stageMultiplier(stage: number): number {
  const s = clampBoost(stage);
  return s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
}

export function accuracyStageMultiplier(stage: number): number {
  const s = clampBoost(stage);
  return s >= 0 ? (3 + s) / 3 : 3 / (3 - s);
}

function fullStats(partial: Partial<Stats> | undefined, fallback: number): Stats {
  const stats = {} as Record<StatId, number>;
  for (const stat of STAT_IDS) stats[stat] = partial?.[stat] ?? fallback;
  return stats;
}

/** The last four level-up moves a species knows at `level`, newest first. */
export function defaultMoveset(speciesId: string, level: number): readonly string[] {
  const ids = levelUpMoves(speciesId, level).map((entry) => entry.moveId);
  return ids.slice(Math.max(0, ids.length - 4));
}

function makeMoveSlot(moveId: string): MoveSlot | undefined {
  const move = getMove(moveId);
  if (!move) return undefined;
  return { moveId: move.id, pp: move.pp, maxPp: move.pp };
}

export function createFighter(input: FighterInput): BattleFighter {
  const species = getSpecies(input.speciesId);
  if (!species) throw new Error(`Unknown species "${input.speciesId}"`);

  const level = Math.max(1, Math.floor(input.level));
  const nature = input.nature ?? 'serious';
  const ivs = fullStats(input.ivs, MAX_IV);
  const evs = fullStats(input.evs, 0);
  const stats = statAtLevel(species, level, nature, ivs, evs);

  const abilityOptions = Object.values(species.abilities);
  const ability =
    input.ability && abilityOptions.includes(input.ability)
      ? input.ability
      : (abilityOptions[0] ?? '');

  const moveIds = input.moves ?? defaultMoveset(species.id, level);
  const moves: MoveSlot[] = [];
  for (const moveId of moveIds) {
    const slot = makeMoveSlot(moveId);
    if (slot) moves.push(slot);
  }

  return {
    id: input.id,
    speciesId: species.id,
    name: input.nickname ?? species.name,
    level,
    nature,
    ability,
    heldItem: input.heldItem ?? null,
    types: species.types,
    stats,
    ivs,
    evs,
    hp: stats.hp,
    maxHp: stats.hp,
    status: null,
    statusCounter: 0,
    moves,
    boosts: emptyBoosts(),
    volatiles: emptyVolatiles(),
    lastMoveId: null,
  };
}

export function stagedStat(base: number, stage: number): number {
  return Math.max(1, Math.floor(base * stageMultiplier(stage)));
}

export function effectiveStat(fighter: BattleFighter, stat: 'atk' | 'def' | 'spa' | 'spd'): number {
  return stagedStat(fighter.stats[stat], fighter.boosts[stat]);
}

export function effectiveSpeed(fighter: BattleFighter): number {
  const speed = stagedStat(fighter.stats.spe, fighter.boosts.spe);
  return fighter.status === 'par' ? Math.max(1, Math.floor(speed / 2)) : speed;
}

export function isFainted(fighter: BattleFighter): boolean {
  return fighter.hp <= 0;
}

export function applyDamage(fighter: BattleFighter, amount: number): number {
  const dealt = Math.min(fighter.hp, Math.max(0, Math.floor(amount)));
  fighter.hp -= dealt;
  return dealt;
}

export function applyHeal(fighter: BattleFighter, amount: number): number {
  const healed = Math.min(fighter.maxHp - fighter.hp, Math.max(0, Math.floor(amount)));
  fighter.hp += healed;
  return healed;
}

export type BoostChange = Readonly<{ stat: BoostId; stages: number }>;

export function applyBoosts(
  fighter: BattleFighter,
  boosts: Partial<Record<BoostId, number>>,
): readonly BoostChange[] {
  const changes: BoostChange[] = [];
  for (const stat of BOOST_IDS) {
    const delta = boosts[stat];
    if (!delta) continue;
    const before = fighter.boosts[stat];
    const after = clampBoost(before + delta);
    if (after === before) continue;
    fighter.boosts[stat] = after;
    changes.push({ stat, stages: after - before });
  }
  return changes;
}

export function clearVolatiles(fighter: BattleFighter): void {
  fighter.volatiles = emptyVolatiles();
}

/** Clears battle-only state between battles while keeping HP, PP and status. */
export function resetBattleState(fighter: BattleFighter): void {
  fighter.boosts = emptyBoosts();
  fighter.lastMoveId = null;
  clearVolatiles(fighter);
}
