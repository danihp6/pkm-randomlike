import {
  STAT_IDS,
  getMove,
  getSpecies,
  learnsetOf,
  levelUpMoves,
  statAtLevel,
  type Species,
  type StatId,
  type Stats,
} from '../../data/dex';
import { MAX_IV } from '../../data/dex/natures';
import { randomAbility } from './randomAbility';
import { randomLearnset, randomLevelUpMoves } from './randomLearnset';

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
  /**
   * Reworked Wonder Guard: intact from the moment the holder switches in until
   * the first damaging hit lands, and it absorbs a non-super-effective one.
   */
  wonderGuard: boolean;
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
  /** Aqua Ring restores 1/16 max HP each residual pass. */
  aquaRing: boolean;
  /** Cursed by Curse: loses 1/4 max HP each residual pass. */
  curse: boolean;
  /** Destiny Bond: fainting to a foe's move drags the foe down too. */
  destinyBond: boolean;
  /** Dragon Cheer raised the holder's crit ratio. */
  dragonCheer: boolean;
  /** Endure survives the turn's hits at 1 HP. */
  endure: boolean;
  /** Focus Energy raised the holder's crit ratio. */
  focusEnergy: boolean;
  /** Grudge: the move that faints the holder loses all its PP. */
  grudge: boolean;
  /** Imprison: the foe cannot use a move the holder knows. */
  imprison: boolean;
  /** Ingrain restores 1/16 max HP each residual pass and roots the holder. */
  ingrain: boolean;
  /** Laser Focus: the holder's next move always crits. */
  laserFocus: boolean;
  /** Magic Coat reflects a status move aimed at the holder. */
  magicCoat: boolean;
  /** Turns of Magnet Rise left (0 = none); a Ground immunity. */
  magnetRise: number;
  /** Power Trick swapped the holder's Attack and Defense. */
  powerTrick: boolean;
  /** Snatch steals the foe's next snatchable status move. */
  snatch: boolean;
  /** Stockpile count (0-3), spent by Swallow and Spit Up. */
  stockpile: number;
  /** Damage the last landed hit dealt to the holder (Innards Out). */
  lastDamageTaken: number;
  /** Wimp Out / Emergency Exit already asked for a switch this entry. */
  wimpOut: boolean;
  /** Gorilla Tactics locked the holder into this move, or null. */
  gorillaTactics: string | null;
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

/** The pre-Mega shape, kept so a snapshot after the battle stores the base species. */
export type MegaBackup = Readonly<{
  speciesId: string;
  name: string;
  types: readonly string[];
  stats: Stats;
  ability: string;
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
  /** True once the holder spent its Mega Stone this battle (D34). */
  mega: boolean;
  /** The pre-Mega shape, or null while not Mega Evolved. */
  megaBackup: MegaBackup | null;
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
  /**
   * The run seed the randomized learnset draws from (`D17`). Set for anything
   * built inside a run so wild/trainer/player movesets come from the same
   * per-run learnsets; omitted, the canonical dex learnset is used.
   */
  learnsetSeed?: string;
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
    wonderGuard: false,
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
    aquaRing: false,
    curse: false,
    destinyBond: false,
    dragonCheer: false,
    endure: false,
    focusEnergy: false,
    grudge: false,
    imprison: false,
    ingrain: false,
    laserFocus: false,
    magicCoat: false,
    magnetRise: 0,
    powerTrick: false,
    snatch: false,
    stockpile: 0,
    lastDamageTaken: 0,
    wimpOut: false,
    gorillaTactics: null,
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

/** A species whose whole learnset is absent from Gen 9 (Unown's Hidden Power) still fights. */
const FALLBACK_MOVE = 'tackle';

/** The moveset cap; mirrors `MAX_MOVES` in `run/progression.ts` without the import cycle. */
const MOVESET_SIZE = 4;

/**
 * By the time a Pokémon reaches level 5 it should already field a full moveset,
 * so a level-1 catch is never stuck with one or two moves (`docs/battle-spec.md`
 * §7.1). Below this level the moveset is padded up to `MOVESET_SIZE` from the
 * species' own learnset — a level-1 Pokémon therefore opens with four moves.
 */
const FULL_MOVESET_BY_LEVEL = 5;

/** Reads the whole level-up curve, past any real level, so the padding can reach forward. */
const ALL_LEVELS = 100;

function isDamaging(moveId: string): boolean {
  return (getMove(moveId)?.category ?? 'Status') !== 'Status';
}

/**
 * Every move the species can learn under this learnset: level-up moves first
 * (earliest level first, so the weakest come before the strong late ones) and
 * the TM/tutor/egg moves after, deduplicated and with unknown ids dropped. The
 * padding always prefers the move it would learn soonest.
 */
function learnableOrder(speciesId: string, learnsetSeed?: string): readonly string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();
  const push = (moveId: string): void => {
    if (seen.has(moveId) || !getMove(moveId)) return;
    seen.add(moveId);
    ordered.push(moveId);
  };
  const learned = learnsetSeed
    ? randomLevelUpMoves(speciesId, ALL_LEVELS, learnsetSeed)
    : levelUpMoves(speciesId, ALL_LEVELS);
  for (const entry of learned) push(entry.moveId);
  const learnset = learnsetSeed ? randomLearnset(speciesId, learnsetSeed) : learnsetOf(speciesId);
  if (learnset) {
    for (const moveId of Object.keys(learnset).sort()) push(moveId);
  }
  return ordered;
}

/**
 * Pads an under-full moveset up to `MOVESET_SIZE` from the species' learnset and
 * keeps at least one damaging move when it can (a species with fewer than four
 * legal moves just gets everything it has, never a duplicate).
 */
function padMoveset(
  speciesId: string,
  moves: readonly string[],
  learnsetSeed?: string,
): readonly string[] {
  if (moves.length >= MOVESET_SIZE) return moves;
  const pool = learnableOrder(speciesId, learnsetSeed);
  const chosen = [...moves];
  const have = new Set(chosen);
  for (const moveId of pool) {
    if (chosen.length >= MOVESET_SIZE) break;
    if (have.has(moveId)) continue;
    have.add(moveId);
    chosen.push(moveId);
  }
  if (!chosen.some(isDamaging)) {
    const damaging = pool.find((moveId) => !have.has(moveId) && isDamaging(moveId));
    if (damaging) {
      have.add(damaging);
      chosen[chosen.length - 1] = damaging;
    }
  }
  return chosen;
}

/**
 * The last four level-up moves a species knows at `level`, newest first. At or
 * below `FULL_MOVESET_BY_LEVEL` the set is topped up to four moves from the
 * species' own learnset, so every Pokémon starts with a full moveset.
 */
export function defaultMoveset(
  speciesId: string,
  level: number,
  learnsetSeed?: string,
): readonly string[] {
  const learned = learnsetSeed
    ? randomLevelUpMoves(speciesId, level, learnsetSeed)
    : levelUpMoves(speciesId, level);
  const ids = learned.map((entry) => entry.moveId);
  const known = ids.length === 0 ? [] : ids.slice(Math.max(0, ids.length - MOVESET_SIZE));
  const moves =
    level <= FULL_MOVESET_BY_LEVEL ? padMoveset(speciesId, known, learnsetSeed) : known;
  return moves.length > 0 ? moves : [FALLBACK_MOVE];
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

/**
 * The fighter's ability. A provided one is trusted as-is: the dex debug editor
 * can grant an off-species ability, and a snapshot round-trip must preserve it.
 * Otherwise a run seed rolls one from the implemented pool (`D17`) — No Guard
 * is dropped when the moveset carries an OHKO move, so the guaranteed-hit and
 * one-hit-KO pair never meets — and a blank pool or no seed falls back to the
 * species' own first ability.
 */
function resolveAbility(species: Species, moves: readonly MoveSlot[], input: FighterInput): string {
  if (input.ability?.trim()) return input.ability;
  if (input.learnsetSeed) {
    const hasOhko = moves.some((slot) => getMove(slot.moveId)?.ohko === true);
    const rolled = randomAbility(species.id, input.learnsetSeed, hasOhko ? ['No Guard'] : []);
    if (rolled) return rolled.name;
  }
  return Object.values(species.abilities)[0] ?? '';
}

/**
 * Swaps a fighter into a battle-only forme (Zero to Hero, Schooling...), reusing
 * the Mega backup so the run snapshot keeps the base species. A fighter already
 * in a forme keeps the first backup, so a Mega's base is never lost. `keepAbility`
 * keeps the holder's ability (a form-change ability stays itself); a Mega lets the
 * forme's own ability win. Returns false when the id is unknown or the fighter
 * already wears that forme.
 */
export function changeBattleForm(
  fighter: BattleFighter,
  formId: string,
  keepAbility = false,
): boolean {
  const form = getSpecies(formId);
  if (!form || fighter.speciesId === form.id) return false;
  if (!fighter.megaBackup) {
    fighter.megaBackup = {
      speciesId: fighter.speciesId,
      name: fighter.name,
      types: fighter.types,
      stats: fighter.stats,
      ability: fighter.ability,
    };
  }
  fighter.speciesId = form.id;
  fighter.name = form.name;
  fighter.types = form.types;
  fighter.stats = {
    ...statAtLevel(form, fighter.level, fighter.nature, fighter.ivs, fighter.evs),
    hp: fighter.stats.hp,
  };
  if (!keepAbility) fighter.ability = Object.values(form.abilities)[0] ?? fighter.ability;
  return true;
}

/**
 * Puts a fighter back into the shape it wore before a battle-only forme change
 * (`changeBattleForm`: Schooling, Zen Mode, Shields Down...): name, types, stats
 * and ability come from the stored backup while the **current HP is kept**, so a
 * threshold ability can flip back and forth. Returns false when there is nothing
 * to restore.
 */
export function restoreBattleForm(fighter: BattleFighter): boolean {
  const backup = fighter.megaBackup;
  if (!backup) return false;
  fighter.speciesId = backup.speciesId;
  fighter.name = backup.name;
  fighter.types = backup.types;
  fighter.stats = { ...backup.stats, hp: fighter.stats.hp };
  fighter.ability = backup.ability;
  fighter.megaBackup = null;
  return true;
}

export function createFighter(input: FighterInput): BattleFighter {
  const species = getSpecies(input.speciesId);
  if (!species) throw new Error(`Unknown species "${input.speciesId}"`);

  const level = Math.max(1, Math.floor(input.level));
  const nature = input.nature ?? 'serious';
  const ivs = fullStats(input.ivs, MAX_IV);
  const evs = fullStats(input.evs, 0);
  const stats = statAtLevel(species, level, nature, ivs, evs);

  const moveIds = input.moves ?? defaultMoveset(species.id, level, input.learnsetSeed);
  const moves: MoveSlot[] = [];
  for (const moveId of moveIds) {
    const slot = makeMoveSlot(moveId);
    if (slot) moves.push(slot);
  }

  // The ability is resolved after the moveset so the No Guard / OHKO guard can
  // read the moves the fighter actually carries.
  const ability = resolveAbility(species, moves, input);

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
    mega: false,
    megaBackup: null,
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
  if (fighter.volatiles.magnetRise > 0) return false;
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
  // Power Trick swapped the stats in place, so the swap is undone on the way out.
  if (fighter.volatiles.powerTrick) {
    fighter.stats = { ...fighter.stats, atk: fighter.stats.def, def: fighter.stats.atk };
  }
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
  // A Mega Evolution lasts only for the battle; the run keeps the base species,
  // so the snapshot reads the pre-Mega shape the battle stored.
  const mega = fighter.megaBackup;
  return {
    id: fighter.id,
    speciesId: mega?.speciesId ?? fighter.speciesId,
    level: fighter.level,
    nature: fighter.nature,
    ability: mega?.ability ?? fighter.ability,
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
