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

export type Gender = 'male' | 'female' | 'genderless';

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
  /** Move id of the active protection (Protect and friends), or null. */
  protect: string | null;
  /** Consecutive successful protections, for the diminishing success odds. */
  protectStreak: number;
  /** Flash Fire absorbed a Fire move; its next Fire move is boosted. */
  flashFire: boolean;
  /** Disguise is intact and can absorb one damaging hit. */
  disguise: boolean;
  /** A charge move (Solar Beam, Fly...) is charging and will fire next turn. */
  charging: string | null;
  /** Physical damage taken since the turn started (Counter). */
  physicalDamageTaken: number;
  /** Special damage taken since the turn started (Mirror Coat). */
  specialDamageTaken: number;
  /** Turns left before Yawn puts this fighter to sleep (0 = none). */
  yawn: number;
  /** Slow Start halves Attack and Speed while above zero. */
  slowStart: number;
  /** Ice Face is intact and absorbs one physical hit. */
  iceFace: boolean;
  /** Supersweet Syrup only lowers the foe's evasiveness once per battle. */
  supersweetSyrup: boolean;
  /** Berserk / Anger Shell already fired since HP last sat above half. */
  pinchTriggered: boolean;
  /** Electromorphosis / Wind Power stored a Charge for the next Electric move. */
  charge: boolean;
  /** Protean / Libero already changed type since switching in (Gen 9 rule). */
  proteanUsed: boolean;
  /** Truant flips this each turn it takes one, so it loafs on the next. */
  truant: boolean;
  /** Move id disabled by Cursed Body, or null. */
  disabledMove: string | null;
  /** Turns left before a disabled move is usable again. */
  disableTurns: number;
  /** Attracted by Cute Charm; a coin flip can cost the turn. */
  attract: boolean;
  /** Battle Bond already boosted the holder (Greninja). */
  battleBond: boolean;
  /** Item id a Cud Chew holder still owes itself at the end of the turn. */
  cudChew: string | null;
  /** The holder has used Transform or been transformed by Imposter. */
  transformed: boolean;
  /** Illusion's disguise: the species id the foe sees, or null. */
  illusion: string | null;
};

/** The pre-Transform shape, restored when the holder leaves the field. */
export type TransformBackup = Readonly<{
  speciesId: string;
  name: string;
  types: readonly string[];
  stats: Stats;
  ability: string;
  moves: readonly MoveSlot[];
  gender: Gender;
}>;

export type BattleFighter = {
  id: string;
  speciesId: string;
  name: string;
  level: number;
  nature: string;
  ability: string;
  /** Gender, for Rivalry and flavour; the run assigns it in Phase 6. */
  gender: Gender;
  /** A shiny rolled the alternate-palette art; purely cosmetic. */
  shiny: boolean;
  /** Item id held in battle, or null; consumed berries clear it. */
  heldItem: string | null;
  /** Last item this fighter consumed, restorable by Recycle. */
  lastItemId: string | null;
  /** The shape Transform replaced, or null while untransformed. */
  transformBackup: TransformBackup | null;
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
  gender?: Gender;
  shiny?: boolean;
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
    protect: null,
    protectStreak: 0,
    flashFire: false,
    disguise: false,
    charging: null,
    physicalDamageTaken: 0,
    specialDamageTaken: 0,
    yawn: 0,
    slowStart: 0,
    iceFace: false,
    supersweetSyrup: false,
    pinchTriggered: false,
    charge: false,
    proteanUsed: false,
    truant: false,
    disabledMove: null,
    disableTurns: 0,
    attract: false,
    battleBond: false,
    cudChew: null,
    transformed: false,
    illusion: null,
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

/** A male- or female-only species is unambiguous; a mixed ratio waits for the run. */
function defaultGender(ratio: Readonly<{ M: number; F: number }>): Gender {
  if (ratio.M > 0 && ratio.F === 0) return 'male';
  if (ratio.F > 0 && ratio.M === 0) return 'female';
  return 'genderless';
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
    gender: input.gender ?? defaultGender(species.genderRatio),
    shiny: input.shiny ?? false,
    heldItem: input.heldItem ?? null,
    lastItemId: null,
    transformBackup: null,
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

/** A Pokémon on the ground is affected by terrain; Flying types and Levitate are not. */
export function isGrounded(fighter: BattleFighter): boolean {
  if (fighter.types.includes('Flying')) return false;
  return fighter.ability !== 'Levitate';
}

/** Long Reach strips the contact flag from its holder's moves. */
export function moveContacts(
  attacker: BattleFighter,
  move: Readonly<{ flags: Readonly<Record<string, number>> }>,
): boolean {
  if (attacker.ability === 'Long Reach') return false;
  return Boolean(move.flags.contact);
}

/** Magic Guard only takes damage from attacks; status, weather, recoil and the rest are ignored. */
export function takesIndirectDamage(fighter: BattleFighter): boolean {
  return fighter.ability !== 'Magic Guard';
}

/**
 * Arena Trap, Shadow Tag and Magnet Pull keep the foe from switching out or
 * fleeing. Each has its own immunity (Ghost types, ungrounded Pokémon, non-Steel
 * types); Neutralizing Gas on the victim switches the trap off.
 */
export function trappedBy(foe: BattleFighter, holder: BattleFighter): boolean {
  if (holder.ability === 'Neutralizing Gas') return false;
  if (foe.ability === 'Shadow Tag') return !holder.types.includes('Ghost');
  if (foe.ability === 'Arena Trap') return isGrounded(holder) && !holder.types.includes('Ghost');
  if (foe.ability === 'Magnet Pull') return holder.types.includes('Steel');
  return false;
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

/**
 * Transform (the move and Imposter) copies the target's battle shape: types,
 * stats (never HP), ability, gender, moves (5 PP each) and stat stages. The
 * original shape is kept so a switch-out restores it. The copied ability is not
 * re-triggered, which also keeps recursion-prone abilities like Imposter inert.
 */
export function transformInto(user: BattleFighter, target: BattleFighter): boolean {
  if (user === target || target.hp <= 0 || user.hp <= 0) return false;
  if (!user.transformBackup) {
    user.transformBackup = {
      speciesId: user.speciesId,
      name: user.name,
      types: user.types,
      stats: user.stats,
      ability: user.ability,
      moves: user.moves.map((slot) => ({ ...slot })),
      gender: user.gender,
    };
  }
  user.speciesId = target.speciesId;
  user.name = target.name;
  user.types = target.types;
  user.stats = { ...target.stats, hp: user.stats.hp };
  user.ability = target.ability;
  user.gender = target.gender;
  user.moves = target.moves.map((slot) => {
    const maxPp = getMove(slot.moveId)?.pp ?? slot.maxPp;
    return { moveId: slot.moveId, pp: Math.min(5, maxPp), maxPp };
  });
  user.boosts = { ...target.boosts };
  user.volatiles.transformed = true;
  return true;
}

/** Puts a transformed fighter back into its original shape (switch-out). */
export function restoreOriginalForm(fighter: BattleFighter): void {
  const backup = fighter.transformBackup;
  if (!backup) return;
  fighter.speciesId = backup.speciesId;
  fighter.name = backup.name;
  fighter.types = backup.types;
  fighter.stats = backup.stats;
  fighter.ability = backup.ability;
  fighter.moves = [...backup.moves];
  fighter.gender = backup.gender;
  fighter.transformBackup = null;
}

export function clearVolatiles(fighter: BattleFighter): void {
  fighter.volatiles = emptyVolatiles();
}

/** Clears battle-only state between battles while keeping HP, PP and status. */
export function resetBattleState(fighter: BattleFighter): void {
  restoreOriginalForm(fighter);
  fighter.boosts = emptyBoosts();
  fighter.lastMoveId = null;
  fighter.lastItemId = null;
  clearVolatiles(fighter);
}

/**
 * The run-persistent shape of a fighter: everything that survives a battle.
 * Volatiles, boosts and stat stages are battle-only and deliberately dropped,
 * so this is also the shape a save (Phase 7) and the run party (Phase 6) store.
 */
export type FighterSnapshot = Readonly<{
  id: string;
  speciesId: string;
  level: number;
  nature: string;
  ability: string;
  gender: Gender;
  shiny: boolean;
  heldItem: string | null;
  ivs: Stats;
  evs: Stats;
  moves: readonly MoveSlot[];
  hp: number;
  status: StatusId | null;
  statusCounter: number;
}>;

export function snapshotFighter(fighter: BattleFighter): FighterSnapshot {
  return {
    id: fighter.id,
    speciesId: fighter.speciesId,
    level: fighter.level,
    nature: fighter.nature,
    ability: fighter.ability,
    gender: fighter.gender,
    shiny: fighter.shiny,
    heldItem: fighter.heldItem,
    ivs: { ...fighter.ivs },
    evs: { ...fighter.evs },
    moves: fighter.moves.map((slot) => ({ ...slot })),
    hp: fighter.hp,
    status: fighter.status,
    statusCounter: fighter.statusCounter,
  };
}

/**
 * Rebuilds a fighter from its snapshot: stats come back from species + level +
 * nature + IVs/EVs, then HP, PP and status are reapplied, so a Pokémon enters
 * the next battle exactly as it left the last one.
 */
export function restoreFighter(snapshot: FighterSnapshot): BattleFighter {
  const base: FighterInput = {
    id: snapshot.id,
    speciesId: snapshot.speciesId,
    level: snapshot.level,
    nature: snapshot.nature,
    ability: snapshot.ability,
    gender: snapshot.gender,
    shiny: snapshot.shiny,
    ivs: snapshot.ivs,
    evs: snapshot.evs,
    moves: snapshot.moves.map((slot) => slot.moveId),
  };
  const fighter = createFighter(snapshot.heldItem ? { ...base, heldItem: snapshot.heldItem } : base);

  const known = new Set(fighter.moves.map((slot) => slot.moveId));
  fighter.moves = snapshot.moves.filter((slot) => known.has(slot.moveId)).map((slot) => ({ ...slot }));
  fighter.hp = Math.max(0, Math.min(fighter.maxHp, snapshot.hp));
  fighter.status = snapshot.status;
  fighter.statusCounter = snapshot.statusCounter;
  return fighter;
}
