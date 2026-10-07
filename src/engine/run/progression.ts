import { evolutionFor } from '../../data/dex/evolutions';
import { levelUpMoves } from '../../data/dex/learnsets';
import { getMove } from '../../data/dex/moves';
import { statAtLevel } from '../../data/dex/natures';
import { getSpecies } from '../../data/dex/species';
import {
  createFighter,
  snapshotFighter,
  type FighterInput,
  type FighterSnapshot,
  type MoveSlot,
} from '../battle/fighter';
import { capForRoute, clampToCap } from './levelCap';

/** A run party/box member: a battle snapshot plus the XP it carries between battles. */
export type RunPokemon = Readonly<{
  fighter: FighterSnapshot;
  xp: number;
}>;

export const MAX_LEVEL = 100;
export const MAX_MOVES = 4;

/**
 * Total XP for a level, on the classic medium-fast curve (`level^3`). The dex
 * carries no base-experience yield, so the curve is level-driven; `experienceAward`
 * then scales with the defeated Pokémon's level (docs/battle-spec.md §7).
 */
export function xpForLevel(level: number): number {
  const capped = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  return capped ** 3;
}

/** The highest level a total-XP figure reaches. */
export function levelForXp(xp: number): number {
  const clamped = Math.max(1, Math.min(xpForLevel(MAX_LEVEL), Math.floor(xp)));
  return Math.max(1, Math.min(MAX_LEVEL, Math.floor(Math.cbrt(clamped))));
}

/** Progress towards the next level, for the XP bar (0..1). */
export function experienceFraction(xp: number, level: number): number {
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  if (next <= base) return 0;
  return Math.max(0, Math.min(1, (xp - base) / (next - base)));
}

/**
 * XP for defeating a level-`defeatedLevel` Pokémon: a band-scaled base, split
 * across the participants and boosted for trainers. No RNG, so a replay awards
 * the same XP.
 */
export function experienceAward(
  defeatedLevel: number,
  participants = 1,
  isTrainer = false,
): number {
  const base = Math.max(1, Math.floor(defeatedLevel)) * 5;
  const multiplier = isTrainer ? 1.5 : 1;
  return Math.max(1, Math.floor((base * multiplier) / Math.max(1, Math.floor(participants))));
}

export type ProgressionEvent =
  | Readonly<{ kind: 'xp'; amount: number; xp: number }>
  | Readonly<{ kind: 'level'; level: number }>
  | Readonly<{ kind: 'learn'; moveId: string }>
  | Readonly<{ kind: 'forget'; moveId: string }>
  | Readonly<{ kind: 'evolve'; from: string; into: string }>
  | Readonly<{ kind: 'capped'; level: number }>;

export type ProgressionResult = Readonly<{
  pokemon: RunPokemon;
  events: readonly ProgressionEvent[];
}>;

/** A run member built from a species, level and moveset, with XP set to its level. */
export function createRunPokemon(input: FighterInput): RunPokemon {
  const fighter = createFighter(input);
  return { fighter: snapshotFighter(fighter), xp: xpForLevel(fighter.level) };
}

/** A run member adopted from a battle snapshot (a caught Pokémon), XP set to its level. */
export function runPokemonFromSnapshot(fighter: FighterSnapshot): RunPokemon {
  return { fighter, xp: xpForLevel(fighter.level) };
}

/** A partial override of a run member; a missing field is kept as-is. */
export type RunPokemonEdit = Readonly<{
  level?: number;
  nature?: string;
  ability?: string;
  moves?: readonly string[];
}>;

/**
 * Rebuilds a run member with the given fields overridden: level, nature and
 * ability are re-resolved, the moveset is re-read from the dex (unknown ids and
 * duplicates dropped) and XP follows the new level like `createRunPokemon`. A
 * level change heals to the new maximum; any other edit keeps the current HP
 * (clamped). Used by the dev menu only; the battle and run rules never call it.
 */
export function editRunPokemon(pokemon: RunPokemon, edit: RunPokemonEdit): RunPokemon {
  const fighter = pokemon.fighter;
  const requested = edit.level;
  const rawLevel = requested !== undefined && Number.isFinite(requested) ? Math.floor(requested) : fighter.level;
  const level = Math.max(1, Math.min(MAX_LEVEL, rawLevel));
  const nature = edit.nature ?? fighter.nature;
  const source = edit.moves ?? fighter.moves.map((slot) => slot.moveId);
  const moves: MoveSlot[] = [];
  for (const moveId of source) {
    const move = getMove(moveId);
    if (!move || moves.some((slot) => slot.moveId === move.id)) continue;
    moves.push({ moveId: move.id, pp: move.pp, maxPp: move.pp });
  }
  if (moves.length === 0) moves.push(...fighter.moves.map((slot) => ({ ...slot })));
  const species = getSpecies(fighter.speciesId);
  const maxHp = species ? statAtLevel(species, level, nature, fighter.ivs, fighter.evs).hp : fighter.hp;
  // A level change heals to the new maximum (a debug bump is meant to be
  // usable); any other edit keeps the current HP, clamped to the new maximum.
  const hp = level !== fighter.level ? maxHp : Math.max(0, Math.min(maxHp, fighter.hp));
  return {
    fighter: {
      ...fighter,
      level,
      nature,
      ability: edit.ability ?? fighter.ability,
      moves,
      hp,
    },
    xp: xpForLevel(level),
  };
}

function moveSlot(moveId: string): MoveSlot | undefined {
  const move = getMove(moveId);
  if (!move) return undefined;
  return { moveId: move.id, pp: move.pp, maxPp: move.pp };
}

/** The moves learned between two levels, oldest first and deduplicated. */
function gainedMoves(speciesId: string, fromLevel: number, toLevel: number): readonly string[] {
  const seen = new Set<string>();
  const moves: string[] = [];
  for (const learn of levelUpMoves(speciesId, toLevel)) {
    if (learn.level > fromLevel && !seen.has(learn.moveId)) {
      seen.add(learn.moveId);
      moves.push(learn.moveId);
    }
  }
  return moves;
}

/**
 * Evolves a run member if its level meets a level-up evolution and the route
 * cap allows it. Exposed so the heal stop can apply an evolution that the cap
 * was blocking (D9).
 */
export function evolveIfReady(pokemon: RunPokemon, routeIndex: number): ProgressionResult {
  const level = pokemon.fighter.level;
  if (level > capForRoute(routeIndex)) return { pokemon, events: [] };
  const evolution = evolutionFor(pokemon.fighter.speciesId, level);
  if (!evolution) return { pokemon, events: [] };
  return {
    pokemon: { ...pokemon, fighter: { ...pokemon.fighter, speciesId: evolution.into } },
    events: [{ kind: 'evolve', from: pokemon.fighter.speciesId, into: evolution.into }],
  };
}

/**
 * Adds a raw XP amount: clamps at the route cap, levels up on the threshold,
 * learns the level-up moves it crossed (forgetting the oldest when the fourth
 * slot is full) and evolves if the cap allows it. Pure and deterministic: no RNG.
 */
export function addExperience(
  pokemon: RunPokemon,
  amount: number,
  routeIndex: number,
): ProgressionResult {
  const events: ProgressionEvent[] = [];
  const gain = Math.max(0, Math.floor(amount));
  const rawXp = pokemon.xp + gain;
  const rawLevel = levelForXp(rawXp);
  let xp = rawXp;
  const level = clampToCap(rawLevel, routeIndex);
  if (rawLevel > level) {
    // The cap clamps gain: park at the ceiling instead of banking overflow.
    xp = xpForLevel(level);
    events.push({ kind: 'capped', level });
  }
  events.push({ kind: 'xp', amount: gain, xp });

  let fighter = pokemon.fighter;
  if (level > fighter.level) {
    events.push({ kind: 'level', level });
    const moves = fighter.moves.map((slot) => ({ ...slot }));
    for (const moveId of gainedMoves(fighter.speciesId, fighter.level, level)) {
      if (moves.some((slot) => slot.moveId === moveId)) continue;
      const slot = moveSlot(moveId);
      if (!slot) continue;
      if (moves.length >= MAX_MOVES) {
        const forgotten = moves.shift();
        if (forgotten) events.push({ kind: 'forget', moveId: forgotten.moveId });
      }
      moves.push(slot);
      events.push({ kind: 'learn', moveId });
    }
    fighter = { ...fighter, level, moves };
  }

  const evolved = evolveIfReady({ fighter, xp }, routeIndex);
  return { pokemon: evolved.pokemon, events: [...events, ...evolved.events] };
}

/**
 * Awards XP for defeating an opponent: the award is split across participants
 * and boosted for trainers, then applied through `addExperience`.
 */
export function awardExperience(
  pokemon: RunPokemon,
  defeatedLevel: number,
  routeIndex: number,
  options: Readonly<{ participants?: number; isTrainer?: boolean }> = {},
): ProgressionResult {
  return addExperience(
    pokemon,
    experienceAward(defeatedLevel, options.participants ?? 1, options.isTrainer ?? false),
    routeIndex,
  );
}
