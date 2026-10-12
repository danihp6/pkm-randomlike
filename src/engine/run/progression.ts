import { evolutionBranches } from '../../data/dex/evolutions';
import { levelUpMoves } from '../../data/dex/learnsets';
import { getMove } from '../../data/dex/moves';
import { statAtLevel } from '../../data/dex/natures';
import { getSpecies } from '../../data/dex/species';
import { bandForLevel } from '../../data/run';
import { randomAbility } from '../battle/randomAbility';
import { randomLevelUpMoves } from '../battle/randomLearnset';
import {
  createFighter,
  snapshotFighter,
  type FighterInput,
  type FighterSnapshot,
  type MoveSlot,
} from '../battle/fighter';

/** Where a caught Pokémon was found: its biome and the room it was caught in. */
export type CatchLocation = Readonly<{
  biomeId: string;
  mapIndex: number;
  routeInMap: number;
}>;

/**
 * A run party/box member: the battle snapshot the run keeps between battles.
 * XP and level are **not** per-member — the whole squad shares one bar on the
 * run (`RunState.xp`), so a member only carries its own shape (species, stats,
 * moves, HP/PP). See `docs/battle-spec.md` §7.
 */
export type RunPokemon = Readonly<{
  fighter: FighterSnapshot;
  /**
   * Set for a Pokémon caught on a route (its biome and room, shown in the STATS
   * tab); absent for the starter and for a member from a save that predates it.
   */
  caughtAt?: CatchLocation;
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
 * across the participants and multiplied for trainers. No RNG, so a replay awards
 * the same XP.
 */
export function experienceAward(
  defeatedLevel: number,
  participants = 1,
  isTrainer = false,
): number {
  const level = Math.max(1, Math.floor(defeatedLevel));
  const base = level * 5;
  const scale = isTrainer ? 1.5 * bandForLevel(level).trainerXp : 1;
  return Math.max(1, Math.floor((base * scale) / Math.max(1, Math.floor(participants))));
}

export type ProgressionEvent =
  | Readonly<{ kind: 'xp'; amount: number; xp: number }>
  | Readonly<{ kind: 'level'; level: number }>
  | Readonly<{ kind: 'learn'; moveId: string }>
  | Readonly<{ kind: 'forget'; moveId: string }>
  | Readonly<{ kind: 'capped'; level: number }>;

export type ProgressionResult = Readonly<{
  pokemon: RunPokemon;
  events: readonly ProgressionEvent[];
}>;

/** A run member built from a species, level and moveset. */
export function createRunPokemon(input: FighterInput): RunPokemon {
  return { fighter: snapshotFighter(createFighter(input)) };
}

/** A run member adopted from a battle snapshot (a caught Pokémon). */
export function runPokemonFromSnapshot(fighter: FighterSnapshot, caughtAt?: CatchLocation): RunPokemon {
  const base = { fighter };
  return caughtAt ? { ...base, caughtAt } : base;
}

/**
 * Rebuilds a member at `level`: stats and moveset come from the species at that
 * level, so a Pokémon caught at a lower or higher level than the squad joins at
 * the squad's own power. HP is set to the new maximum (a catch arrives whole).
 * Evolution is never automatic (it is the player's click in the STATS tab), so
 * the caught species is kept as-is. Used when a catch is folded into the run.
 */
export function adoptAtLevel(pokemon: RunPokemon, level: number, learnsetSeed?: string): RunPokemon {
  const f = pokemon.fighter;
  const target = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  const fighter = createFighter({
    id: f.id,
    speciesId: f.speciesId,
    level: target,
    nature: f.nature,
    ability: f.ability,
    gender: f.gender,
    shiny: f.shiny,
    ivs: f.ivs,
    evs: f.evs,
    ...(f.heldItem ? { heldItem: f.heldItem } : {}),
    ...(learnsetSeed ? { learnsetSeed } : {}),
  });
  return { ...pokemon, fighter: snapshotFighter(fighter) };
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
 * duplicates dropped). A level change heals to the new maximum; any other edit
 * keeps the current HP (clamped). Used by the dev menu only; the battle and run
 * rules never call it.
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
    ...pokemon,
    fighter: {
      ...fighter,
      level,
      nature,
      ability: edit.ability ?? fighter.ability,
      moves,
      hp,
    },
  };
}

function moveSlot(moveId: string): MoveSlot | undefined {
  const move = getMove(moveId);
  if (!move) return undefined;
  return { moveId: move.id, pp: move.pp, maxPp: move.pp };
}

/** The moves learned between two levels, oldest first and deduplicated. */
function gainedMoves(
  speciesId: string,
  fromLevel: number,
  toLevel: number,
  learnsetSeed?: string,
): readonly string[] {
  const seen = new Set<string>();
  const moves: string[] = [];
  const learned = learnsetSeed
    ? randomLevelUpMoves(speciesId, toLevel, learnsetSeed)
    : levelUpMoves(speciesId, toLevel);
  for (const learn of learned) {
    if (learn.level > fromLevel && !seen.has(learn.moveId)) {
      seen.add(learn.moveId);
      moves.push(learn.moveId);
    }
  }
  return moves;
}

/**
 * Evolves a run member into `into` when that branch is ready at its level (every
 * evolution is a level evolution now, `docs/battle-spec.md` §7). The member
 * keeps its level, nature, IVs/EVs, moves, PP, status and held item; stats and
 * types come from the new species and the **missing** HP is carried across, so
 * an evolution heals the difference in maximum HP rather than the whole bar. A
 * branch the level does not allow, or an unknown id, is a no-op. When
 * `abilitySeed` is given the ability is **re-rolled** from the new species' pool
 * under that seed (`D17`); without it the ability is kept when the new species
 * has it and the species' first one is used otherwise. Pure, like the rest of
 * the run (D11).
 */
export function evolvePokemon(
  pokemon: RunPokemon,
  into: string,
  abilitySeed?: string,
): RunPokemon {
  const fighter = pokemon.fighter;
  const target = getSpecies(into);
  if (!target) return pokemon;
  const ready = evolutionBranches(fighter.speciesId).some(
    (branch) => branch.into === target.id && branch.level <= fighter.level,
  );
  if (!ready) return pokemon;
  const source = getSpecies(fighter.speciesId);
  const oldMaxHp = source
    ? statAtLevel(source, fighter.level, fighter.nature, fighter.ivs, fighter.evs).hp
    : fighter.hp;
  const maxHp = statAtLevel(target, fighter.level, fighter.nature, fighter.ivs, fighter.evs).hp;
  const missing = Math.max(0, oldMaxHp - fighter.hp);
  const abilities = Object.values(target.abilities);
  const kept = abilities.includes(fighter.ability) ? fighter.ability : (abilities[0] ?? fighter.ability);
  const ability = abilitySeed ? (randomAbility(target.id, abilitySeed)?.name ?? kept) : kept;
  return {
    ...pokemon,
    fighter: {
      ...fighter,
      speciesId: target.id,
      ability,
      hp: Math.max(0, Math.min(maxHp, maxHp - missing)),
    },
  };
}

/**
 * Raises a member to `targetLevel` (already clamped to the map cap), learning
 * the level-up moves it crossed and forgetting the oldest when the fourth slot
 * is full. Evolution is **not** applied here: it waits for the player's click in
 * the STATS tab. A member already at or above the target is left alone. Pure and
 * deterministic: no RNG.
 */
export function levelUpPokemon(
  pokemon: RunPokemon,
  targetLevel: number,
  learnsetSeed?: string,
): ProgressionResult {
  const events: ProgressionEvent[] = [];
  const level = Math.max(1, Math.min(MAX_LEVEL, Math.floor(targetLevel)));
  let fighter = pokemon.fighter;
  if (level > fighter.level) {
    events.push({ kind: 'level', level });
    const moves = fighter.moves.map((slot) => ({ ...slot }));
    for (const moveId of gainedMoves(fighter.speciesId, fighter.level, level, learnsetSeed)) {
      if (moves.some((slot) => slot.moveId === moveId)) continue;
      // No Guard makes every move hit, so it must never pair with an OHKO move.
      if (fighter.ability === 'No Guard' && getMove(moveId)?.ohko) continue;
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
  return { pokemon: fighter === pokemon.fighter ? pokemon : { ...pokemon, fighter }, events };
}
