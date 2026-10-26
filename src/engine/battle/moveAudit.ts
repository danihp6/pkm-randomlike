import { FIELD_CONDITION_IDS, SIDE_CONDITION_IDS } from './effects/conditions';
import {
  BOOST_IDS,
  createFighter,
  emptyBoosts,
  type BattleFighter,
  type BoostId,
  type StatusId,
} from './fighter';
import { Rng } from '../rng';
import {
  activeFighter,
  createBattle,
  type BattleEvent,
  type BattleState,
  type FieldConditionId,
  type SideConditionId,
  type SideId,
  type TerrainId,
  type WeatherId,
} from './state';
import { useMove, takeTurn, type SlotCommands } from './turn';

/**
 * The headless instrument the move ledger is judged by: one move against a clean
 * level-50 board, one seeded `Rng`, one snapshot of what changed. A row's
 * `expected` is what Showdown's reference does for that move (`D4`/`D16`); the
 * probe is only the measurement. Nothing in the game imports this module — it is
 * the artefact `[Task-120]` and `[Task-121]` are verified with.
 */

/** The knobs a row may turn before the single move runs. Every field is optional. */
export interface MoveAuditSetup {
  /** Both sides' level. Default `50`. */
  level?: number;
  /** Default `'ditto'` on both sides. */
  playerSpecies?: string;
  enemySpecies?: string;
  /** The player's starting HP, clamped to `1..maxHp`. Default: full. */
  playerHp?: number;
  /** The enemy's starting HP, clamped to `1..maxHp`. Default: full. */
  enemyHp?: number;
  playerBoosts?: Partial<Record<BoostId, number>>;
  enemyBoosts?: Partial<Record<BoostId, number>>;
  /** Default `null`. `'slp'` and `'tox'` also set `statusCounter` to 1. */
  playerStatus?: StatusId | null;
  enemyStatus?: StatusId | null;
  /** The player's held item. Default: nothing held. */
  heldItem?: string;
  /** The enemy's held item. Default: nothing held. */
  enemyHeldItem?: string;
  /** The moves the enemy's board holds. Default `['splash']`. */
  enemyMoves?: readonly string[];
  /**
   * The slot whose command the enemy issues this turn, which is what a
   * conditional-fail move reads (`Task-167`). Default `0`.
   */
  enemyMoveIndex?: number;
  /** The battle starts under it with 5 turns left. Default `null`. */
  weather?: WeatherId | null;
  /** The battle starts under it with 5 turns left. Default `null`. */
  terrain?: TerrainId | null;
  /** Stockpile charges the player starts with, clamped to `0..3`. Default `0`. */
  playerStockpile?: number;
}

/** One snapshot of the board after the single move has resolved. */
export interface MoveProbe {
  playerHp: number;
  enemyHp: number;
  playerStatus: StatusId | null;
  enemyStatus: StatusId | null;
  /** `BOOST_IDS` order (`atk, def, spa, spd, spe, accuracy, evasion`), always length 7. */
  playerBoosts: readonly number[];
  enemyBoosts: readonly number[];
  /** Truthy `Volatiles` keys, sorted lexicographically; `0`, `false` and `null` drop. */
  playerVolatiles: readonly string[];
  enemyVolatiles: readonly string[];
  /** `SIDE_CONDITION_IDS` order, always the full length. */
  playerSideConditions: readonly number[];
  enemySideConditions: readonly number[];
  /** `FIELD_CONDITION_IDS` order, always the full length. */
  fieldConditions: readonly number[];
  weather: WeatherId | null;
  terrain: TerrainId | null;
  playerTypes: readonly string[];
  enemyTypes: readonly string[];
  playerAbility: string;
  enemyAbility: string;
  playerItem: string | null;
  enemyItem: string | null;
  /** The player's move slots' current PP, in slot order. */
  playerPp: readonly number[];
  /** The enemy's move slots' current PP, in slot order. */
  enemyPp: readonly number[];
  /** `state.log`'s non-`text` kinds, in order. */
  events: readonly BattleEvent['kind'][];
  /** The `key` of every `text` event in `state.log`, in order. */
  texts: readonly string[];
  /** The `amount` of every `damage` event in `state.log`, in order. */
  damageAmounts: readonly number[];
}

/** One reference expectation. `expected` is a partial snapshot, never `{}`. */
export interface MoveAuditRow {
  moveId: string;
  expected: Partial<MoveProbe>;
  /**
   * What the move does on the **following** turn (`Task-159`): a binding move pays its
   * residual there, so a row that only writes a volatile can no longer pass as `port`.
   */
  residual?: Partial<MoveProbe>;
  /**
   * A second board the same row is judged on (`Task-167`): its own `setup` overrides
   * the row's, so a move whose success is pinned above also has to answer for the
   * case that makes it fail. `upperhand` carries the foe on a plain move here, which
   * must log the fail and deal nothing.
   */
  scenario?: Readonly<{ setup?: Partial<MoveAuditSetup>; expected: Partial<MoveProbe> }>;
  setup?: Partial<MoveAuditSetup>;
  /** The engine does not satisfy this row today. */
  knownGap?: true;
}

const DEFAULT_LEVEL = 50;
const DEFAULT_SPECIES = 'ditto';
const PROBE_SEED = 2026;
const PROBE_WEATHER_TURNS = 5;
const PROBE_TERRAIN_TURNS = 5;

function withBoosts(overrides: Partial<Record<BoostId, number>> | undefined): BattleFighter['boosts'] {
  return { ...emptyBoosts(), ...(overrides ?? {}) };
}

function withStatus(fighter: BattleFighter, status: StatusId | null): void {
  fighter.status = status;
  fighter.statusCounter = status === 'slp' || status === 'tox' ? 1 : 0;
}

function clampHp(value: number, maxHp: number): number {
  return Math.max(1, Math.min(maxHp, Math.floor(value)));
}

function volatilesOf(fighter: BattleFighter): readonly string[] {
  return Object.entries(fighter.volatiles)
    .filter(([, value]) => Boolean(value))
    .map(([key]) => key)
    .sort();
}

function boostsOf(fighter: BattleFighter): readonly number[] {
  return BOOST_IDS.map((stat) => fighter.boosts[stat]);
}

export function boostsVector(stages?: Partial<Record<BoostId, number>>): readonly number[] {
  return BOOST_IDS.map((stat) => stages?.[stat] ?? 0);
}

export function sideConditionsVector(
  turns?: Partial<Record<SideConditionId, number>>,
): readonly number[] {
  return SIDE_CONDITION_IDS.map((id) => turns?.[id] ?? 0);
}

export function fieldConditionsVector(
  turns?: Partial<Record<FieldConditionId, number>>,
): readonly number[] {
  return FIELD_CONDITION_IDS.map((id) => turns?.[id] ?? 0);
}

/**
 * Builds the clean board. The probe reads exactly one stream, `new Rng(PROBE_SEED)`,
 * created inside the call, so two calls with the same setup return the same board.
 */
function probeBoard(setup: Partial<MoveAuditSetup>, playerMoves: readonly string[]): BattleState {
  const level = setup.level ?? DEFAULT_LEVEL;
  const player = createFighter({
    id: 'audit-player',
    speciesId: setup.playerSpecies ?? DEFAULT_SPECIES,
    level,
    ability: 'Run Away',
    ...(setup.heldItem ? { heldItem: setup.heldItem } : {}),
    moves: [...playerMoves],
  });
  const enemy = createFighter({
    id: 'audit-enemy',
    speciesId: setup.enemySpecies ?? DEFAULT_SPECIES,
    level,
    ...(setup.enemyHeldItem ? { heldItem: setup.enemyHeldItem } : {}),
    moves: [...(setup.enemyMoves ?? ['splash'])],
  });

  if (setup.playerHp !== undefined) player.hp = clampHp(setup.playerHp, player.maxHp);
  if (setup.enemyHp !== undefined) enemy.hp = clampHp(setup.enemyHp, enemy.maxHp);
  player.boosts = withBoosts(setup.playerBoosts);
  enemy.boosts = withBoosts(setup.enemyBoosts);
  withStatus(player, setup.playerStatus ?? null);
  withStatus(enemy, setup.enemyStatus ?? null);
  player.volatiles.stockpile = Math.max(0, Math.min(3, Math.floor(setup.playerStockpile ?? 0)));

  const weather = setup.weather ?? null;
  const terrain = setup.terrain ?? null;
  return createBattle({
    player: [player],
    enemy: [enemy],
    rng: new Rng(PROBE_SEED),
    isWild: true,
    ...(weather ? { weather: { id: weather, turns: PROBE_WEATHER_TURNS } } : {}),
    ...(terrain ? { terrain: { id: terrain, turns: PROBE_TERRAIN_TURNS } } : {}),
  });
}

function snapshotState(state: BattleState): MoveProbe {
  const playerAfter = activeFighter(state, 'player');
  const enemyAfter = activeFighter(state, 'enemy');
  return {
    playerHp: playerAfter.hp,
    enemyHp: enemyAfter.hp,
    playerStatus: playerAfter.status,
    enemyStatus: enemyAfter.status,
    playerBoosts: boostsOf(playerAfter),
    enemyBoosts: boostsOf(enemyAfter),
    playerVolatiles: volatilesOf(playerAfter),
    enemyVolatiles: volatilesOf(enemyAfter),
    playerSideConditions: SIDE_CONDITION_IDS.map((id) => state.sides.player.sideConditions[id]),
    enemySideConditions: SIDE_CONDITION_IDS.map((id) => state.sides.enemy.sideConditions[id]),
    fieldConditions: FIELD_CONDITION_IDS.map((id) => state.field[id]),
    weather: state.weather,
    terrain: state.terrain,
    playerTypes: [...playerAfter.types],
    enemyTypes: [...enemyAfter.types],
    playerAbility: playerAfter.ability,
    enemyAbility: enemyAfter.ability,
    playerItem: playerAfter.heldItem,
    enemyItem: enemyAfter.heldItem,
    playerPp: playerAfter.moves.map((slot) => slot.pp),
    enemyPp: enemyAfter.moves.map((slot) => slot.pp),
    events: state.log.filter((event) => event.kind !== 'text').map((event) => event.kind),
    texts: state.log.flatMap((event) => (event.kind === 'text' ? [event.key] : [])),
    damageAmounts: state.log.flatMap((event) => (event.kind === 'damage' ? [event.amount] : [])),
  };
}

/** The commands both sides issue on the probe's turn: slot 0, one move each. */
function probeCommands(setup: Partial<MoveAuditSetup>): Readonly<Record<SideId, SlotCommands>> {
  return {
    player: { 0: { type: 'fight', moveIndex: 0 } },
    enemy: { 0: { type: 'fight', moveIndex: setup.enemyMoveIndex ?? 0 } },
  };
}

/**
 * Builds the clean board, runs one move and snapshots it. The probe reads exactly
 * one stream, `new Rng(PROBE_SEED)`, created inside the call, so two calls with
 * the same move and setup return the same snapshot.
 */
export function probeMove(moveId: string, setup: Partial<MoveAuditSetup> = {}): MoveProbe {
  const state = probeBoard(setup, [moveId]);
  useMove(state, 'player', { type: 'fight', moveIndex: 0 }, probeCommands(setup));
  return snapshotState(state);
}

/**
 * `probeMove` plus one more full turn: the player holds `splash` in slot 1, the audited
 * move runs from slot 0, then `takeTurn` runs the player's `splash` and the enemy's,
 * which is where the residual pass pays. Same seed, same board, same snapshot shape.
 */
export function probeResidual(moveId: string, setup: Partial<MoveAuditSetup> = {}): MoveProbe {
  const state = probeBoard(setup, [moveId, 'splash']);
  useMove(state, 'player', { type: 'fight', moveIndex: 0 }, probeCommands(setup));
  takeTurn(state, { type: 'fight', moveIndex: 1 }, { type: 'fight', moveIndex: 0 });
  return snapshotState(state);
}

/**
 * The reference table, sorted by `moveId`, one entry per id, no duplicates.
 *
 * `expected` is the delta Showdown's handler produces on the probe's board, never
 * the value `probeMove` returned. A chance-based secondary is not derivable from
 * the dex, so those rows pin the outcome seed `PROBE_SEED` produces; a row the
 * engine does not satisfy today carries `knownGap` and its test runs as
 * `it.fails`, so closing the gap turns the suite red until the flag goes.
 */
export const MOVE_AUDIT_ROWS: readonly MoveAuditRow[] = [
  { moveId: 'absorb', setup: { playerHp: 40 }, expected: { events: ['move', 'damage', 'heal'] } },
  { moveId: 'acid', expected: { events: ['move', 'damage'] } },
  { moveId: 'acidarmor', expected: { playerBoosts: [0, 2, 0, 0, 0, 0, 0] } },
  {
    moveId: 'acidspray',
    expected: { events: ['move', 'damage', 'boost'], enemyBoosts: [0, 0, 0, -2, 0, 0, 0] },
  },
  {
    moveId: 'acupressure',
    expected: { playerBoosts: [0, 0, 0, 2, 0, 0, 0], events: ['move', 'boost'] },
  },
  { moveId: 'agility', expected: { playerBoosts: [0, 0, 0, 0, 2, 0, 0] } },
  { moveId: 'airslash', expected: { events: ['move', 'damage'] } },
  { moveId: 'amnesia', expected: { playerBoosts: [0, 0, 0, 2, 0, 0, 0] } },
  { moveId: 'ancientpower', expected: { events: ['move', 'damage'] } },
  {
    moveId: 'appleacid',
    expected: { events: ['move', 'damage', 'boost'], enemyBoosts: [0, 0, 0, -1, 0, 0, 0] },
  },
  { moveId: 'aquaring', expected: { playerVolatiles: ['aquaRing'] } },
  {
    moveId: 'aquastep',
    expected: { events: ['move', 'damage', 'boost'], playerBoosts: [0, 0, 0, 0, 1, 0, 0] },
  },
  { moveId: 'armorcannon', expected: { playerBoosts: [0, -1, 0, -1, 0, 0, 0] } },
  { moveId: 'armthrust', expected: { events: ['move', 'damage', 'damage', 'damage'] } },
  {
    moveId: 'aromatherapy',
    setup: { playerStatus: 'brn' },
    expected: { playerStatus: null, events: ['move', 'cure'] },
  },
  { moveId: 'aromaticmist', expected: { events: ['move'] } },
  { moveId: 'assist', expected: { events: ['move'] } },
  { moveId: 'astonish', expected: { events: ['move'] } },
  {
    moveId: 'attract',
    setup: { playerSpecies: 'miltank', enemySpecies: 'tauros' },
    expected: { enemyVolatiles: ['attract'], events: ['move'] },
  },
  {
    moveId: 'aurawheel',
    expected: {
      playerBoosts: [0, 0, 0, 0, 1, 0, 0],
      enemyVolatiles: ['lastDamageTaken', 'physicalDamageTaken'],
    },
  },
  { moveId: 'aurorabeam', expected: { events: ['move', 'damage'] } },
  {
    moveId: 'auroraveil',
    setup: { weather: 'snow' },
    expected: { playerSideConditions: [0, 0, 5, 0, 0, 0, 0], events: ['move'] },
  },
  { moveId: 'autotomize', expected: { playerBoosts: [0, 0, 0, 0, 2, 0, 0] } },
  { moveId: 'axekick', expected: { events: ['move', 'damage'] } },
  { moveId: 'babydolleyes', expected: { enemyBoosts: [-1, 0, 0, 0, 0, 0, 0] } },
  {
    moveId: 'banefulbunker',
    expected: { playerVolatiles: ['protect', 'protectStreak'], events: ['move'] },
  },
  { moveId: 'barbbarrage', expected: { events: ['move', 'damage'] } },
  { moveId: 'barrage', expected: { events: ['move', 'damage', 'damage', 'damage'] } },
  { moveId: 'barrier', expected: { playerBoosts: [0, 2, 0, 0, 0, 0, 0] } },
  { moveId: 'batonpass', expected: { events: ['move'] } },
  { moveId: 'beatup', expected: { events: ['move', 'damage'] } },
  {
    moveId: 'bellydrum',
    expected: { playerHp: 62, playerBoosts: [6, 0, 0, 0, 0, 0, 0], events: ['move', 'damage', 'boost'] },
  },
  {
    moveId: 'bind',
    expected: {
      enemyVolatiles: ['lastDamageTaken', 'partiallyTrapped', 'physicalDamageTaken', 'trapped'],
    },
    residual: { enemyHp: 98 },
  },
  { moveId: 'bite', expected: { events: ['move', 'damage'] } },
  { moveId: 'bitterblade', setup: { playerHp: 40 }, expected: { events: ['move', 'damage', 'heal'] } },
  { moveId: 'bittermalice', expected: { events: ['move'] } },
  { moveId: 'blazekick', expected: { events: ['move', 'damage'] } },
  { moveId: 'bleakwindstorm', expected: { events: ['move', 'damage'] } },
  { moveId: 'blizzard', expected: { events: ['move', 'damage'] } },
  { moveId: 'block', expected: { enemyVolatiles: ['trapped'], events: ['move'] } },
  { moveId: 'blueflare', expected: { events: ['move', 'damage'] } },
  { moveId: 'bodyslam', expected: { events: ['move', 'damage'] } },
  { moveId: 'boltstrike', expected: { events: ['move', 'damage'] } },
  { moveId: 'boneclub', expected: { events: ['move', 'damage'] } },
  { moveId: 'bonemerang', expected: { events: ['move', 'damage', 'damage'] } },
  { moveId: 'bonerush', expected: { events: ['move', 'damage', 'damage', 'damage'] } },
  { moveId: 'bounce', expected: { events: ['move'] } },
  { moveId: 'bravebird', expected: { events: ['move', 'damage', 'damage'] } },
  {
    moveId: 'breakingswipe',
    expected: { events: ['move', 'damage', 'boost'], enemyBoosts: [-1, 0, 0, 0, 0, 0, 0] },
  },
  { moveId: 'bubble', expected: { events: ['move', 'damage'] } },
  { moveId: 'bubblebeam', expected: { events: ['move', 'damage'] } },
  { moveId: 'bugbuzz', expected: { events: ['move', 'damage'] } },
  { moveId: 'bulkup', expected: { playerBoosts: [1, 1, 0, 0, 0, 0, 0] } },
  {
    moveId: 'bulldoze',
    expected: { events: ['move', 'damage', 'boost'], enemyBoosts: [0, 0, 0, 0, -1, 0, 0] },
  },
  { moveId: 'bulletseed', expected: { events: ['move', 'damage', 'damage', 'damage'] } },
  {
    moveId: 'burningbulwark',
    expected: { playerVolatiles: ['protect', 'protectStreak'], events: ['move'] },
  },
  { moveId: 'calmmind', expected: { playerBoosts: [0, 0, 1, 1, 0, 0, 0] } },
  {
    moveId: 'camouflage',
    setup: { terrain: 'electric' },
    expected: { playerTypes: ['Electric'], events: ['move'] },
  },
  { moveId: 'captivate', expected: { events: ['move'] } },
  { moveId: 'celebrate', expected: { events: ['move'] } },
  {
    moveId: 'charge',
    expected: { playerVolatiles: ['charge'], playerBoosts: [0, 0, 0, 1, 0, 0, 0] },
  },
  { moveId: 'chargebeam', expected: { events: ['move', 'damage', 'boost'] } },
  { moveId: 'charm', expected: { enemyBoosts: [-2, 0, 0, 0, 0, 0, 0] } },
  {
    moveId: 'chatter',
    expected: {
      events: ['move', 'damage'],
      enemyVolatiles: ['confusion', 'lastDamageTaken', 'specialDamageTaken'],
    },
  },
  {
    moveId: 'chillingwater',
    expected: { events: ['move', 'damage', 'boost'], enemyBoosts: [-1, 0, 0, 0, 0, 0, 0] },
  },
  { moveId: 'chillyreception', expected: { weather: 'snow', events: ['move'] } },
  {
    moveId: 'clamp',
    expected: {
      enemyVolatiles: ['lastDamageTaken', 'partiallyTrapped', 'physicalDamageTaken', 'trapped'],
    },
    residual: { enemyHp: 92 },
  },
  {
    moveId: 'clangoroussoul',
    expected: {
      playerHp: 82,
      playerBoosts: [1, 1, 1, 1, 1, 0, 0],
      events: ['move', 'damage', 'boost', 'boost', 'boost', 'boost', 'boost'],
    },
  },
  { moveId: 'closecombat', expected: { playerBoosts: [0, -1, 0, -1, 0, 0, 0] } },
  { moveId: 'coaching', expected: { events: ['move'] } },
  { moveId: 'coil', expected: { playerBoosts: [1, 1, 0, 0, 0, 1, 0] } },
  { moveId: 'cometpunch', expected: { events: ['move', 'damage', 'damage', 'damage'] } },
  { moveId: 'comeuppance', expected: { events: ['move'] } },
  { moveId: 'confide', expected: { enemyBoosts: [0, 0, -1, 0, 0, 0, 0] } },
  { moveId: 'confuseray', expected: { enemyVolatiles: ['confusion'] } },
  { moveId: 'confusion', expected: { events: ['move', 'damage'] } },
  { moveId: 'constrict', expected: { events: ['move', 'damage'] } },
  { moveId: 'conversion', expected: { playerTypes: ['Normal'], events: ['move'] } },
  { moveId: 'conversion2', expected: { events: ['move'] } },
  { moveId: 'copycat', expected: { events: ['move'] } },
  { moveId: 'cosmicpower', expected: { playerBoosts: [0, 1, 0, 1, 0, 0, 0] } },
  { moveId: 'cottonguard', expected: { playerBoosts: [0, 3, 0, 0, 0, 0, 0] } },
  { moveId: 'cottonspore', expected: { enemyBoosts: [0, 0, 0, 0, -2, 0, 0] } },
  { moveId: 'counter', expected: { events: ['move'] } },
  { moveId: 'crosspoison', expected: { events: ['move', 'damage'] } },
  { moveId: 'crunch', expected: { events: ['move', 'damage'] } },
  { moveId: 'crushclaw', expected: { events: ['move', 'damage'] } },
  { moveId: 'crushgrip', expected: { events: ['move', 'damage'] } },
  {
    moveId: 'curse',
    expected: { playerBoosts: [1, 1, 0, 0, -1, 0, 0], events: ['move', 'boost', 'boost', 'boost'] },
  },
  { moveId: 'darkpulse', expected: { events: ['move', 'damage'] } },
  { moveId: 'darkvoid', expected: { events: ['move'] } },
  { moveId: 'decorate', expected: { enemyBoosts: [2, 0, 2, 0, 0, 0, 0] } },
  { moveId: 'defendorder', expected: { playerBoosts: [0, 1, 0, 1, 0, 0, 0] } },
  { moveId: 'defensecurl', expected: { playerBoosts: [0, 1, 0, 0, 0, 0, 0] } },
  { moveId: 'defog', expected: { enemyBoosts: [0, 0, 0, 0, 0, 0, -1], events: ['move', 'boost'] } },
  { moveId: 'destinybond', expected: { playerVolatiles: ['destinyBond'] } },
  { moveId: 'detect', expected: { playerVolatiles: ['protect', 'protectStreak'], events: ['move'] } },
  { moveId: 'diamondstorm', expected: { playerBoosts: [0, 2, 0, 0, 0, 0, 0] } },
  { moveId: 'dig', expected: { playerVolatiles: ['charging'], events: ['move'] } },
  {
    moveId: 'disable',
    expected: { enemyVolatiles: ['disableTurns', 'disabledMove'], events: ['move'] },
  },
  { moveId: 'discharge', expected: { events: ['move', 'damage'] } },
  { moveId: 'dive', expected: { playerVolatiles: ['charging'], events: ['move'] } },
  { moveId: 'dizzypunch', expected: { events: ['move', 'damage'] } },
  { moveId: 'doodle', expected: { enemyAbility: 'Run Away', events: ['move'] } },
  { moveId: 'doubleedge', expected: { events: ['move', 'damage', 'damage'] } },
  { moveId: 'doublehit', expected: { events: ['move', 'damage', 'damage'] } },
  { moveId: 'doubleironbash', expected: { events: ['move', 'damage', 'damage'] } },
  { moveId: 'doublekick', expected: { events: ['move', 'damage', 'damage'] } },
  { moveId: 'doubleslap', expected: { events: ['move', 'damage', 'damage', 'damage'] } },
  { moveId: 'doubleteam', expected: { playerBoosts: [0, 0, 0, 0, 0, 0, 1] } },
  { moveId: 'dracometeor', expected: { playerBoosts: [0, 0, -2, 0, 0, 0, 0] } },
  { moveId: 'dragonascent', expected: { playerBoosts: [0, -1, 0, -1, 0, 0, 0] } },
  { moveId: 'dragonbreath', expected: { events: ['move', 'damage'] } },
  { moveId: 'dragoncheer', expected: { enemyVolatiles: [] } },
  { moveId: 'dragondance', expected: { playerBoosts: [1, 0, 0, 0, 1, 0, 0] } },
  { moveId: 'dragondarts', expected: { events: ['move', 'damage', 'damage'] } },
  { moveId: 'dragonrage', expected: { enemyHp: 83, events: ['move', 'damage'] } },
  { moveId: 'dragonrush', expected: { events: ['move', 'damage'] } },
  { moveId: 'drainingkiss', setup: { playerHp: 40 }, expected: { events: ['move', 'damage', 'heal'] } },
  { moveId: 'drainpunch', setup: { playerHp: 40 }, expected: { events: ['move', 'damage', 'heal'] } },
  { moveId: 'dreameater', expected: { events: ['move'] } },
  {
    moveId: 'drumbeating',
    expected: { events: ['move', 'damage', 'boost'], enemyBoosts: [0, 0, 0, 0, -1, 0, 0] },
  },
  { moveId: 'dualchop', expected: { events: ['move', 'damage', 'damage'] } },
  { moveId: 'dualwingbeat', expected: { events: ['move', 'damage', 'damage'] } },
  {
    moveId: 'dynamicpunch',
    expected: {
      events: ['move', 'damage'],
      enemyVolatiles: ['confusion', 'lastDamageTaken', 'physicalDamageTaken'],
    },
  },
  { moveId: 'earthpower', expected: { events: ['move', 'damage'] } },
  { moveId: 'eerieimpulse', expected: { enemyBoosts: [0, 0, -2, 0, 0, 0, 0] } },
  { moveId: 'electricterrain', expected: { terrain: 'electric' } },
  { moveId: 'electrify', expected: { enemyVolatiles: ['electrify'], events: ['move'] } },
  { moveId: 'electroball', expected: { events: ['move', 'damage'] } },
  {
    moveId: 'electroshot',
    expected: {
      playerVolatiles: ['charging'],
      playerBoosts: [0, 0, 1, 0, 0, 0, 0],
      events: ['move', 'boost'],
    },
  },
  {
    moveId: 'electroweb',
    expected: { events: ['move', 'damage', 'boost'], enemyBoosts: [0, 0, 0, 0, -1, 0, 0] },
  },
  { moveId: 'embargo', expected: { enemyVolatiles: ['embargo'], events: ['move'] } },
  { moveId: 'ember', expected: { events: ['move', 'damage'] } },
  { moveId: 'encore', expected: { enemyVolatiles: [], events: ['move'] } },
  {
    moveId: 'endeavor',
    setup: { playerHp: 40 },
    expected: { playerHp: 40, enemyHp: 40, events: ['move', 'damage'] },
  },
  { moveId: 'endure', expected: { playerVolatiles: ['endure'] } },
  { moveId: 'energyball', expected: { events: ['move', 'damage'] } },
  { moveId: 'entrainment', expected: { enemyAbility: 'Run Away', events: ['move'] } },
  {
    moveId: 'esperwing',
    expected: { events: ['move', 'damage', 'boost'], playerBoosts: [0, 0, 0, 0, 1, 0, 0] },
  },
  {
    moveId: 'explosion',
    expected: { playerHp: 0, enemyHp: 0, events: ['move', 'damage', 'faint', 'faint'] },
  },
  { moveId: 'extrasensory', expected: { events: ['move', 'damage'] } },
  { moveId: 'fairylock', expected: { fieldConditions: [0, 0, 0, 0, 2, 0, 0], events: ['move'] } },
  {
    moveId: 'fakeout',
    expected: {
      events: ['move', 'damage'],
      enemyVolatiles: ['flinched', 'lastDamageTaken', 'physicalDamageTaken'],
    },
  },
  { moveId: 'faketears', expected: { enemyBoosts: [0, 0, 0, -2, 0, 0, 0] } },
  { moveId: 'featherdance', expected: { enemyBoosts: [-2, 0, 0, 0, 0, 0, 0] } },
  { moveId: 'fierydance', expected: { events: ['move', 'damage'] } },
  { moveId: 'fierywrath', expected: { events: ['move', 'damage'] } },
  {
    moveId: 'filletaway',
    expected: {
      playerHp: 62,
      playerBoosts: [2, 0, 2, 0, 2, 0, 0],
      events: ['move', 'damage', 'boost', 'boost', 'boost'],
    },
  },
  {
    moveId: 'finalgambit',
    expected: { playerHp: 0, enemyHp: 0, events: ['move', 'damage', 'faint', 'faint'] },
  },
  { moveId: 'fireblast', expected: { events: ['move', 'damage'] } },
  { moveId: 'firefang', expected: { events: ['move', 'damage'] } },
  {
    moveId: 'firelash',
    expected: { events: ['move', 'damage', 'boost'], enemyBoosts: [0, -1, 0, 0, 0, 0, 0] },
  },
  { moveId: 'firepunch', expected: { events: ['move', 'damage'] } },
  {
    moveId: 'firespin',
    expected: {
      enemyVolatiles: ['lastDamageTaken', 'partiallyTrapped', 'specialDamageTaken', 'trapped'],
    },
    residual: { enemyHp: 92 },
  },
  {
    moveId: 'fissure',
    setup: { playerBoosts: { accuracy: 6 } },
    expected: { events: ['move'] },
  },
  { moveId: 'flail', expected: { events: ['move', 'damage'] } },
  {
    moveId: 'flamecharge',
    expected: { events: ['move', 'damage', 'boost'], playerBoosts: [0, 0, 0, 0, 1, 0, 0] },
  },
  { moveId: 'flamethrower', expected: { events: ['move', 'damage'] } },
  { moveId: 'flamewheel', expected: { events: ['move', 'damage'] } },
  { moveId: 'flareblitz', expected: { events: ['move', 'damage', 'damage'] } },
  { moveId: 'flash', expected: { enemyBoosts: [0, 0, 0, 0, 0, -1, 0] } },
  { moveId: 'flashcannon', expected: { events: ['move', 'damage'] } },
  { moveId: 'flatter', expected: { enemyVolatiles: ['confusion'], enemyBoosts: [0, 0, 1, 0, 0, 0, 0] } },
  { moveId: 'fleurcannon', expected: { playerBoosts: [0, 0, -2, 0, 0, 0, 0] } },
  { moveId: 'flipturn', expected: { events: ['move', 'damage'] } },
  { moveId: 'floralhealing', setup: { enemyHp: 40 }, expected: { events: ['move', 'heal'] } },
  { moveId: 'flowershield', expected: { events: ['move'] } },
  { moveId: 'fly', expected: { playerVolatiles: ['charging'], events: ['move'] } },
  { moveId: 'focusblast', expected: { events: ['move', 'damage'] } },
  { moveId: 'focusenergy', expected: { playerVolatiles: ['focusEnergy'] } },
  { moveId: 'forcepalm', expected: { events: ['move', 'damage'] } },
  { moveId: 'foresight', expected: { enemyVolatiles: ['foresight'], events: ['move'] } },
  { moveId: 'forestscurse', expected: { enemyTypes: ['Normal', 'Grass'], events: ['move'] } },
  { moveId: 'freezedry', expected: { events: ['move', 'damage'] } },
  { moveId: 'freezeshock', expected: { events: ['move'] } },
  { moveId: 'freezingglare', expected: { events: ['move', 'damage'] } },
  { moveId: 'frustration', expected: { events: ['move', 'damage'] } },
  { moveId: 'furyattack', expected: { events: ['move', 'damage', 'damage', 'damage'] } },
  { moveId: 'furyswipes', expected: { events: ['move', 'damage', 'damage', 'damage'] } },
  { moveId: 'gastroacid', expected: { enemyVolatiles: ['gastroAcid'], events: ['move'] } },
  { moveId: 'geargrind', expected: { events: ['move', 'damage', 'damage'] } },
  { moveId: 'geomancy', expected: { playerVolatiles: ['charging'], events: ['move'] } },
  { moveId: 'gigadrain', setup: { playerHp: 40 }, expected: { events: ['move', 'damage', 'heal'] } },
  {
    moveId: 'glaciate',
    expected: { events: ['move', 'damage', 'boost'], enemyBoosts: [0, 0, 0, 0, -1, 0, 0] },
  },
  { moveId: 'glare', expected: { enemyStatus: 'par', events: ['move', 'status'] } },
  { moveId: 'grassknot', expected: { events: ['move', 'damage'] } },
  { moveId: 'grasswhistle', expected: { enemyStatus: 'slp', events: ['move', 'status'] } },
  { moveId: 'grassyterrain', expected: { terrain: 'grassy' } },
  {
    moveId: 'gravapple',
    expected: { events: ['move', 'damage', 'boost'], enemyBoosts: [0, -1, 0, 0, 0, 0, 0] },
  },
  { moveId: 'gravity', expected: { fieldConditions: [0, 5, 0, 0, 0, 0, 0], events: ['move'] } },
  { moveId: 'growl', expected: { enemyBoosts: [-1, 0, 0, 0, 0, 0, 0] } },
  { moveId: 'growth', expected: { playerBoosts: [1, 0, 1, 0, 0, 0, 0] } },
  { moveId: 'grudge', expected: { playerVolatiles: ['grudge'] } },
  { moveId: 'guardsplit', expected: { events: ['move'] } },
  {
    moveId: 'guardswap',
    setup: { enemyBoosts: { def: 2 } },
    expected: { playerBoosts: [0, 2, 0, 0, 0, 0, 0], events: ['move'] },
  },
  {
    moveId: 'guillotine',
    setup: { playerBoosts: { accuracy: 6 } },
    expected: { events: ['move'] },
  },
  { moveId: 'gunkshot', expected: { events: ['move', 'damage'] } },
  { moveId: 'gyroball', expected: { events: ['move', 'damage'] } },
  { moveId: 'hail', expected: { weather: 'snow' } },
  { moveId: 'hammerarm', expected: { playerBoosts: [0, 0, 0, 0, -1, 0, 0] } },
  { moveId: 'harden', expected: { playerBoosts: [0, 1, 0, 0, 0, 0, 0] } },
  { moveId: 'hardpress', expected: { events: ['move', 'damage'] } },
  {
    moveId: 'haze',
    setup: { playerBoosts: { atk: 2 }, enemyBoosts: { def: 2 } },
    expected: {
      playerBoosts: [0, 0, 0, 0, 0, 0, 0],
      enemyBoosts: [0, 0, 0, 0, 0, 0, 0],
      events: ['move'],
    },
  },
  { moveId: 'headbutt', expected: { events: ['move', 'damage'] } },
  { moveId: 'headcharge', expected: { events: ['move', 'damage', 'damage'] } },
  { moveId: 'headlongrush', expected: { playerBoosts: [0, -1, 0, -1, 0, 0, 0] } },
  { moveId: 'headsmash', expected: { events: ['move', 'damage', 'damage'] } },
  {
    moveId: 'healbell',
    setup: { playerStatus: 'brn' },
    expected: { playerStatus: null, events: ['move', 'cure'] },
  },
  { moveId: 'healingwish', expected: { playerHp: 0, events: ['move', 'faint'] } },
  { moveId: 'healpulse', setup: { enemyHp: 40 }, expected: { enemyHp: 101, events: ['move', 'heal'] } },
  {
    moveId: 'heartswap',
    setup: { enemyBoosts: { atk: 2 } },
    expected: { playerBoosts: [2, 0, 0, 0, 0, 0, 0], events: ['move'] },
  },
  { moveId: 'heatcrash', expected: { events: ['move', 'damage'] } },
  { moveId: 'heatwave', expected: { events: ['move', 'damage'] } },
  { moveId: 'heavyslam', expected: { events: ['move', 'damage'] } },
  { moveId: 'honeclaws', expected: { playerBoosts: [1, 0, 0, 0, 0, 1, 0] } },
  { moveId: 'horndrill', setup: { playerBoosts: { accuracy: 6 } }, expected: { events: ['move'] } },
  { moveId: 'hornleech', setup: { playerHp: 40 }, expected: { events: ['move', 'damage', 'heal'] } },
  { moveId: 'howl', expected: { playerBoosts: [1, 0, 0, 0, 0, 0, 0] } },
  { moveId: 'hurricane', expected: { events: ['move', 'damage'] } },
  { moveId: 'hyperfang', expected: { events: ['move', 'damage'] } },
  { moveId: 'hyperspacefury', expected: { events: ['move'] } },
  { moveId: 'hypnosis', expected: { enemyStatus: 'slp', events: ['move', 'status'] } },
  { moveId: 'icebeam', expected: { events: ['move', 'damage'] } },
  { moveId: 'iceburn', expected: { events: ['move'] } },
  { moveId: 'icefang', expected: { events: ['move', 'damage'] } },
  { moveId: 'icehammer', expected: { playerBoosts: [0, 0, 0, 0, -1, 0, 0] } },
  { moveId: 'icepunch', expected: { events: ['move', 'damage'] } },
  { moveId: 'iciclecrash', expected: { events: ['move', 'damage'] } },
  { moveId: 'iciclespear', expected: { events: ['move', 'damage', 'damage', 'damage'] } },
  {
    moveId: 'icywind',
    expected: { events: ['move', 'damage', 'boost'], enemyBoosts: [0, 0, 0, 0, -1, 0, 0] },
  },
  { moveId: 'imprison', expected: { playerVolatiles: ['imprison'] } },
  { moveId: 'infernalparade', expected: { events: ['move'] } },
  { moveId: 'inferno', expected: { events: ['move', 'damage', 'status'], enemyStatus: 'brn' } },
  {
    moveId: 'infestation',
    expected: {
      enemyVolatiles: ['lastDamageTaken', 'partiallyTrapped', 'specialDamageTaken', 'trapped'],
    },
    residual: { enemyHp: 100 },
  },
  { moveId: 'ingrain', expected: { playerVolatiles: ['ingrain'] } },
  { moveId: 'instruct', expected: { events: ['move'] } },
  { moveId: 'irondefense', expected: { playerBoosts: [0, 2, 0, 0, 0, 0, 0] } },
  { moveId: 'ironhead', expected: { events: ['move', 'damage'] } },
  { moveId: 'irontail', expected: { events: ['move', 'damage'] } },
  { moveId: 'judgment', expected: { enemyVolatiles: ['lastDamageTaken', 'specialDamageTaken'] } },
  {
    moveId: 'junglehealing',
    setup: { playerHp: 60, playerStatus: 'brn' },
    expected: { playerStatus: null, events: ['move', 'cure', 'heal'] },
  },
  { moveId: 'kinesis', expected: { enemyBoosts: [0, 0, 0, 0, 0, -1, 0] } },
  {
    moveId: 'kingsshield',
    expected: { playerVolatiles: ['protect', 'protectStreak'], events: ['move'] },
  },
  { moveId: 'laserfocus', expected: { playerVolatiles: ['laserFocus'] } },
  { moveId: 'lavaplume', expected: { events: ['move', 'damage'] } },
  { moveId: 'leafstorm', expected: { playerBoosts: [0, 0, -2, 0, 0, 0, 0] } },
  { moveId: 'leaftornado', expected: { events: ['move', 'damage'] } },
  { moveId: 'leechlife', setup: { playerHp: 40 }, expected: { events: ['move', 'damage', 'heal'] } },
  { moveId: 'leechseed', expected: { enemyVolatiles: ['leechSeed'] } },
  { moveId: 'leer', expected: { enemyBoosts: [0, -1, 0, 0, 0, 0, 0] } },
  { moveId: 'lick', expected: { events: ['move'] } },
  { moveId: 'lifedew', setup: { playerHp: 1 }, expected: { events: ['move', 'heal'] } },
  { moveId: 'lightofruin', expected: { events: ['move', 'damage', 'damage'] } },
  { moveId: 'lightscreen', expected: { playerSideConditions: [0, 5, 0, 0, 0, 0, 0], events: ['move'] } },
  { moveId: 'liquidation', expected: { events: ['move', 'damage'] } },
  { moveId: 'lockon', expected: { playerVolatiles: ['lockOn'], events: ['move'] } },
  { moveId: 'lovelykiss', expected: { enemyStatus: 'slp', events: ['move', 'status'] } },
  { moveId: 'lowkick', expected: { events: ['move', 'damage'] } },
  {
    moveId: 'lowsweep',
    expected: { events: ['move', 'damage', 'boost'], enemyBoosts: [0, 0, 0, 0, -1, 0, 0] },
  },
  { moveId: 'luckychant', expected: { playerSideConditions: [0, 0, 0, 0, 5, 0, 0], events: ['move'] } },
  {
    moveId: 'luminacrash',
    expected: { events: ['move', 'damage', 'boost'], enemyBoosts: [0, 0, 0, -2, 0, 0, 0] },
  },
  {
    moveId: 'lunarblessing',
    setup: { playerHp: 60, playerStatus: 'brn' },
    expected: { playerStatus: null, events: ['move', 'cure', 'heal'] },
  },
  { moveId: 'lunardance', expected: { playerHp: 0, events: ['move', 'faint'] } },
  {
    moveId: 'lunge',
    expected: { events: ['move', 'damage', 'boost'], enemyBoosts: [-1, 0, 0, 0, 0, 0, 0] },
  },
  { moveId: 'lusterpurge', expected: { events: ['move', 'damage'] } },
  { moveId: 'magiccoat', expected: { playerVolatiles: ['magicCoat'] } },
  { moveId: 'magicpowder', expected: { enemyTypes: ['Psychic'], events: ['move'] } },
  { moveId: 'magicroom', expected: { fieldConditions: [0, 0, 5, 0, 0, 0, 0], events: ['move'] } },
  {
    moveId: 'magmastorm',
    expected: {
      enemyVolatiles: ['lastDamageTaken', 'partiallyTrapped', 'specialDamageTaken', 'trapped'],
    },
    residual: { enemyHp: 65 },
  },
  { moveId: 'magnetrise', expected: { playerVolatiles: ['magnetRise'] } },
  { moveId: 'makeitrain', expected: { playerBoosts: [0, 0, -1, 0, 0, 0, 0] } },
  { moveId: 'malignantchain', expected: { events: ['move', 'damage'] } },
  { moveId: 'matchagotcha', expected: { events: ['move', 'damage'] } },
  { moveId: 'meanlook', expected: { enemyVolatiles: ['trapped'], events: ['move'] } },
  { moveId: 'meditate', expected: { playerBoosts: [1, 0, 0, 0, 0, 0, 0] } },
  { moveId: 'megadrain', setup: { playerHp: 40 }, expected: { events: ['move', 'damage', 'heal'] } },
  { moveId: 'memento', expected: { enemyBoosts: [-2, 0, -2, 0, 0, 0, 0], playerHp: 0 } },
  { moveId: 'metalburst', expected: { events: ['move'] } },
  { moveId: 'metalclaw', expected: { events: ['move', 'damage'] } },
  { moveId: 'metalsound', expected: { enemyBoosts: [0, 0, 0, -2, 0, 0, 0] } },
  {
    moveId: 'meteorbeam',
    expected: {
      playerVolatiles: ['charging'],
      playerBoosts: [0, 0, 1, 0, 0, 0, 0],
      events: ['move', 'boost'],
    },
  },
  { moveId: 'meteormash', expected: { events: ['move', 'damage'] } },
  {
    moveId: 'metronome',
    expected: { enemyBoosts: [0, 0, 0, 0, 0, -1, 0], events: ['move', 'move', 'boost'] },
  },
  { moveId: 'milkdrink', setup: { playerHp: 1 }, expected: { events: ['move', 'heal'] } },
  { moveId: 'mimic', expected: { events: ['move'] } },
  { moveId: 'mindreader', expected: { playerVolatiles: ['lockOn'], events: ['move'] } },
  { moveId: 'minimize', expected: { playerBoosts: [0, 0, 0, 0, 0, 0, 2] } },
  { moveId: 'mirrorcoat', expected: { events: ['move'] } },
  { moveId: 'mirrormove', expected: { events: ['move'] } },
  { moveId: 'mirrorshot', expected: { events: ['move', 'damage'] } },
  { moveId: 'mist', expected: { playerSideConditions: [0, 0, 0, 0, 0, 5, 0], events: ['move'] } },
  { moveId: 'mistball', expected: { events: ['move', 'damage'] } },
  { moveId: 'mistyexplosion', expected: { playerHp: 0, events: ['move', 'damage', 'faint'] } },
  { moveId: 'mistyterrain', expected: { terrain: 'misty' } },
  { moveId: 'moonblast', expected: { events: ['move', 'damage'] } },
  { moveId: 'moonlight', setup: { playerHp: 1 }, expected: { events: ['move', 'heal'] } },
  { moveId: 'morningsun', setup: { playerHp: 1 }, expected: { events: ['move', 'heal'] } },
  { moveId: 'mortalspin', expected: { events: ['move', 'damage', 'status'], enemyStatus: 'psn' } },
  { moveId: 'mountaingale', expected: { events: ['move', 'damage'] } },
  { moveId: 'mudbomb', expected: { events: ['move', 'damage'] } },
  { moveId: 'muddywater', expected: { events: ['move', 'damage'] } },
  {
    moveId: 'mudshot',
    expected: { events: ['move', 'damage', 'boost'], enemyBoosts: [0, 0, 0, 0, -1, 0, 0] },
  },
  {
    moveId: 'mudslap',
    expected: { events: ['move', 'damage', 'boost'], enemyBoosts: [0, 0, 0, 0, 0, -1, 0] },
  },
  { moveId: 'mudsport', expected: { fieldConditions: [0, 0, 0, 0, 0, 5, 0], events: ['move'] } },
  { moveId: 'multiattack', expected: { enemyVolatiles: ['lastDamageTaken', 'physicalDamageTaken'] } },
  {
    moveId: 'mysticalfire',
    expected: { events: ['move', 'damage', 'boost'], enemyBoosts: [0, 0, -1, 0, 0, 0, 0] },
  },
  {
    moveId: 'mysticalpower',
    expected: { events: ['move', 'damage', 'boost'], playerBoosts: [0, 0, 1, 0, 0, 0, 0] },
  },
  { moveId: 'nastyplot', expected: { playerBoosts: [0, 0, 2, 0, 0, 0, 0] } },
  { moveId: 'naturalgift', expected: { events: ['move'] } },
  { moveId: 'naturepower', expected: { events: ['move', 'move', 'damage'] } },
  { moveId: 'naturesmadness', expected: { enemyHp: 62, events: ['move', 'damage'] } },
  { moveId: 'nightdaze', expected: { events: ['move', 'damage'] } },
  {
    moveId: 'nightmare',
    setup: { enemyStatus: 'slp' },
    expected: { enemyVolatiles: ['nightmare'], events: ['move'] },
  },
  { moveId: 'nightshade', expected: { enemyHp: 73, events: ['move', 'damage'] } },
  { moveId: 'nobleroar', expected: { enemyBoosts: [-1, 0, -1, 0, 0, 0, 0] } },
  {
    moveId: 'noretreat',
    expected: {
      playerVolatiles: ['noretreat', 'trapped'],
      playerBoosts: [1, 1, 1, 1, 1, 0, 0],
    },
  },
  { moveId: 'nuzzle', expected: { events: ['move', 'damage', 'status'], enemyStatus: 'par' } },
  { moveId: 'oblivionwing', setup: { playerHp: 40 }, expected: { events: ['move', 'damage', 'heal'] } },
  { moveId: 'obstruct', expected: { playerVolatiles: ['protect', 'protectStreak'], events: ['move'] } },
  { moveId: 'octazooka', expected: { events: ['move', 'damage'] } },
  { moveId: 'octolock', expected: { enemyVolatiles: ['octolock', 'trapped'], events: ['move'] } },
  { moveId: 'odorsleuth', expected: { enemyVolatiles: ['foresight'], events: ['move'] } },
  { moveId: 'ominouswind', expected: { events: ['move'] } },
  { moveId: 'overheat', expected: { playerBoosts: [0, 0, -2, 0, 0, 0, 0] } },
  {
    moveId: 'painsplit',
    setup: { playerHp: 40 },
    expected: { playerHp: 81, enemyHp: 81, events: ['move', 'heal', 'damage'] },
  },
  {
    moveId: 'paraboliccharge',
    setup: { playerHp: 40 },
    expected: { events: ['move', 'damage', 'heal'] },
  },
  { moveId: 'partingshot', expected: { enemyBoosts: [-1, 0, -1, 0, 0, 0, 0] } },
  {
    moveId: 'perishsong',
    expected: { playerVolatiles: ['perish'], enemyVolatiles: ['perish'], events: ['move'] },
  },
  { moveId: 'phantomforce', expected: { playerVolatiles: ['charging'], events: ['move'] } },
  { moveId: 'pinmissile', expected: { events: ['move', 'damage', 'damage', 'damage'] } },
  { moveId: 'playnice', expected: { enemyBoosts: [-1, 0, 0, 0, 0, 0, 0] } },
  { moveId: 'playrough', expected: { events: ['move', 'damage'] } },
  { moveId: 'poisonfang', expected: { events: ['move', 'damage'] } },
  { moveId: 'poisongas', expected: { enemyStatus: 'psn', events: ['move', 'status'] } },
  { moveId: 'poisonjab', expected: { events: ['move', 'damage'] } },
  { moveId: 'poisonpowder', expected: { enemyStatus: 'psn', events: ['move', 'status'] } },
  { moveId: 'poisonsting', expected: { events: ['move', 'damage'] } },
  { moveId: 'poisontail', expected: { events: ['move', 'damage'] } },
  {
    moveId: 'populationbomb',
    expected: {
      events: ['move', 'damage', 'damage', 'damage', 'damage', 'damage', 'damage', 'damage', 'damage'],
      damageAmounts: [13, 12, 12, 13, 12, 13, 19, 15],
    },
  },
  {
    moveId: 'pounce',
    expected: { events: ['move', 'damage', 'boost'], enemyBoosts: [0, 0, 0, 0, -1, 0, 0] },
  },
  { moveId: 'powdersnow', expected: { events: ['move', 'damage'] } },
  { moveId: 'powersplit', expected: { events: ['move'] } },
  {
    moveId: 'powerswap',
    setup: { enemyBoosts: { atk: 2 } },
    expected: { playerBoosts: [2, 0, 0, 0, 0, 0, 0], events: ['move'] },
  },
  { moveId: 'powertrick', expected: { playerVolatiles: ['powerTrick'] } },
  {
    moveId: 'poweruppunch',
    expected: { events: ['move', 'damage', 'boost'], playerBoosts: [1, 0, 0, 0, 0, 0, 0] },
  },
  {
    moveId: 'present',
    setup: { enemyHp: 40 },
    expected: { enemyHp: 15, events: ['move', 'damage'] },
  },
  { moveId: 'protect', expected: { playerVolatiles: ['protect', 'protectStreak'], events: ['move'] } },
  { moveId: 'psybeam', expected: { events: ['move', 'damage'] } },
  { moveId: 'psychic', expected: { events: ['move', 'damage'] } },
  { moveId: 'psychicterrain', expected: { terrain: 'psychic' } },
  { moveId: 'psychoboost', expected: { playerBoosts: [0, 0, -2, 0, 0, 0, 0] } },
  {
    moveId: 'psychoshift',
    setup: { playerStatus: 'brn' },
    expected: { playerStatus: null, enemyStatus: 'brn', events: ['move', 'cure', 'status'] },
  },
  {
    moveId: 'psychup',
    setup: { enemyBoosts: { atk: 3 } },
    expected: { playerBoosts: [3, 0, 0, 0, 0, 0, 0], events: ['move'] },
  },
  {
    moveId: 'psyshieldbash',
    expected: { events: ['move', 'damage', 'boost'], playerBoosts: [0, 1, 0, 0, 0, 0, 0] },
  },
  { moveId: 'psywave', expected: { enemyHp: 73, events: ['move', 'damage'] } },
  {
    moveId: 'purify',
    setup: { playerHp: 40, enemyStatus: 'brn' },
    expected: { enemyStatus: null, events: ['move', 'cure', 'heal'] },
  },
  { moveId: 'pyroball', expected: { events: ['move', 'damage'] } },
  { moveId: 'quash', expected: { enemyVolatiles: ['quash'], events: ['move'] } },
  { moveId: 'quiverdance', expected: { playerBoosts: [0, 0, 1, 1, 1, 0, 0] } },
  { moveId: 'raindance', expected: { weather: 'rain' } },
  {
    moveId: 'rapidspin',
    expected: { events: ['move', 'damage', 'boost'], playerBoosts: [0, 0, 0, 0, 1, 0, 0] },
  },
  { moveId: 'razorshell', expected: { events: ['move', 'damage'] } },
  { moveId: 'razorwind', expected: { playerVolatiles: ['charging'], events: ['move'] } },
  { moveId: 'recover', setup: { playerHp: 1 }, expected: { events: ['move', 'heal'] } },
  { moveId: 'recycle', expected: { events: ['move'] } },
  { moveId: 'reflect', expected: { playerSideConditions: [5, 0, 0, 0, 0, 0, 0], events: ['move'] } },
  {
    moveId: 'reflecttype',
    setup: { enemySpecies: 'pikachu' },
    expected: { playerTypes: ['Electric'], events: ['move'] },
  },
  {
    moveId: 'refresh',
    setup: { playerStatus: 'brn' },
    expected: { playerStatus: null, events: ['move', 'cure'] },
  },
  { moveId: 'relicsong', expected: { events: ['move', 'damage'] } },
  {
    moveId: 'rest',
    setup: { playerHp: 40 },
    expected: { playerStatus: 'slp', playerHp: 123, events: ['move', 'status', 'heal'] },
  },
  { moveId: 'return', expected: { events: ['move', 'damage'] } },
  { moveId: 'revelationdance', expected: { enemyVolatiles: ['lastDamageTaken', 'specialDamageTaken'] } },
  { moveId: 'reversal', expected: { events: ['move', 'damage'] } },
  { moveId: 'revivalblessing', expected: { events: ['move'] } },
  { moveId: 'rockblast', expected: { events: ['move', 'damage', 'damage', 'damage'] } },
  { moveId: 'rockclimb', expected: { events: ['move', 'damage'] } },
  { moveId: 'rockpolish', expected: { playerBoosts: [0, 0, 0, 0, 2, 0, 0] } },
  { moveId: 'rockslide', expected: { events: ['move', 'damage'] } },
  { moveId: 'rocksmash', expected: { events: ['move', 'damage'] } },
  {
    moveId: 'rocktomb',
    expected: { events: ['move', 'damage', 'boost'], enemyBoosts: [0, 0, 0, 0, -1, 0, 0] },
  },
  { moveId: 'roleplay', expected: { playerAbility: 'Limber', events: ['move'] } },
  { moveId: 'rollingkick', expected: { events: ['move', 'damage'] } },
  { moveId: 'roost', setup: { playerHp: 1 }, expected: { events: ['move', 'heal'] } },
  { moveId: 'rototiller', expected: { events: ['move'] } },
  { moveId: 'ruination', expected: { enemyHp: 62, events: ['move', 'damage'] } },
  { moveId: 'sacredfire', expected: { events: ['move', 'damage'] } },
  { moveId: 'safeguard', expected: { playerSideConditions: [0, 0, 0, 0, 0, 0, 5], events: ['move'] } },
  { moveId: 'sandattack', expected: { enemyBoosts: [0, 0, 0, 0, 0, -1, 0] } },
  { moveId: 'sandsearstorm', expected: { events: ['move', 'damage'] } },
  { moveId: 'sandstorm', expected: { weather: 'sand' } },
  {
    moveId: 'sandtomb',
    expected: {
      enemyVolatiles: ['lastDamageTaken', 'partiallyTrapped', 'physicalDamageTaken', 'trapped'],
    },
    residual: { enemyHp: 92 },
  },
  { moveId: 'scald', expected: { events: ['move', 'damage'] } },
  { moveId: 'scaleshot', expected: { events: ['move', 'damage', 'damage', 'damage'] } },
  { moveId: 'scaryface', expected: { enemyBoosts: [0, 0, 0, 0, -2, 0, 0] } },
  { moveId: 'scorchingsands', expected: { events: ['move', 'damage'] } },
  { moveId: 'screech', expected: { enemyBoosts: [0, -2, 0, 0, 0, 0, 0] } },
  { moveId: 'searingshot', expected: { events: ['move', 'damage'] } },
  { moveId: 'secretpower', expected: { events: ['move', 'damage'] } },
  { moveId: 'seedflare', expected: { events: ['move', 'damage'] } },
  { moveId: 'seismictoss', expected: { enemyHp: 73, events: ['move', 'damage'] } },
  { moveId: 'selfdestruct', expected: { playerHp: 0, events: ['move', 'damage', 'faint'] } },
  { moveId: 'shadowball', expected: { events: ['move'] } },
  { moveId: 'shadowbone', expected: { events: ['move'] } },
  { moveId: 'shadowforce', expected: { playerVolatiles: ['charging'], events: ['move'] } },
  { moveId: 'sharpen', expected: { playerBoosts: [1, 0, 0, 0, 0, 0, 0] } },
  { moveId: 'shedtail', expected: { playerHp: 62, playerVolatiles: ['substitute'] } },
  {
    moveId: 'sheercold',
    setup: { playerBoosts: { accuracy: 6 } },
    expected: { events: ['move'] },
  },
  { moveId: 'shellsidearm', expected: { events: ['move', 'damage'] } },
  { moveId: 'shellsmash', expected: { playerBoosts: [2, -1, 2, -1, 2, 0, 0] } },
  { moveId: 'shelter', expected: { playerBoosts: [0, 2, 0, 0, 0, 0, 0] } },
  { moveId: 'shiftgear', expected: { playerBoosts: [1, 0, 0, 0, 2, 0, 0] } },
  { moveId: 'shoreup', setup: { playerHp: 1 }, expected: { events: ['move', 'heal'] } },
  { moveId: 'signalbeam', expected: { events: ['move', 'damage'] } },
  { moveId: 'silktrap', expected: { playerVolatiles: ['protect', 'protectStreak'], events: ['move'] } },
  { moveId: 'silverwind', expected: { events: ['move', 'damage'] } },
  { moveId: 'simplebeam', expected: { enemyAbility: 'Insomnia', events: ['move'] } },
  { moveId: 'sing', expected: { enemyStatus: 'slp', events: ['move', 'status'] } },
  {
    moveId: 'skillswap',
    expected: { playerAbility: 'Limber', enemyAbility: 'Run Away', events: ['move'] },
  },
  {
    moveId: 'skittersmack',
    expected: { events: ['move', 'damage', 'boost'], enemyBoosts: [0, 0, -1, 0, 0, 0, 0] },
  },
  {
    moveId: 'skullbash',
    expected: {
      playerVolatiles: ['charging'],
      playerBoosts: [0, 1, 0, 0, 0, 0, 0],
      events: ['move', 'boost'],
    },
  },
  { moveId: 'skyattack', expected: { events: ['move'] } },
  { moveId: 'skydrop', expected: { playerVolatiles: ['charging'], events: ['move'] } },
  { moveId: 'slackoff', setup: { playerHp: 1 }, expected: { events: ['move', 'heal'] } },
  { moveId: 'sleeppowder', expected: { enemyStatus: 'slp', events: ['move', 'status'] } },
  { moveId: 'sleeptalk', expected: { events: ['move'] } },
  { moveId: 'sludge', expected: { events: ['move', 'damage'] } },
  { moveId: 'sludgebomb', expected: { events: ['move', 'damage'] } },
  { moveId: 'sludgewave', expected: { events: ['move', 'damage'] } },
  {
    moveId: 'smackdown',
    expected: {
      enemyVolatiles: ['grounded', 'lastDamageTaken', 'physicalDamageTaken'],
      events: ['move', 'damage'],
    },
  },
  { moveId: 'smog', expected: { events: ['move', 'damage'] } },
  { moveId: 'smokescreen', expected: { enemyBoosts: [0, 0, 0, 0, 0, -1, 0] } },
  {
    moveId: 'snaptrap',
    expected: {
      enemyVolatiles: ['lastDamageTaken', 'partiallyTrapped', 'physicalDamageTaken', 'trapped'],
    },
    residual: { enemyHp: 93 },
  },
  {
    moveId: 'snarl',
    expected: { events: ['move', 'damage', 'boost'], enemyBoosts: [0, 0, -1, 0, 0, 0, 0] },
  },
  { moveId: 'snatch', expected: { playerVolatiles: ['snatch'] } },
  { moveId: 'snore', expected: { events: ['move'] } },
  { moveId: 'snowscape', expected: { weather: 'snow' } },
  { moveId: 'soak', expected: { enemyTypes: ['Water'], events: ['move'] } },
  { moveId: 'softboiled', setup: { playerHp: 1 }, expected: { events: ['move', 'heal'] } },
  { moveId: 'solarbeam', expected: { playerVolatiles: ['charging'], events: ['move'] } },
  { moveId: 'solarblade', expected: { playerVolatiles: ['charging'], events: ['move'] } },
  { moveId: 'sonicboom', expected: { enemyHp: 103, events: ['move', 'damage'] } },
  { moveId: 'spark', expected: { events: ['move', 'damage'] } },
  { moveId: 'speedswap', expected: { events: ['move'] } },
  { moveId: 'spicyextract', expected: { enemyBoosts: [2, -2, 0, 0, 0, 0, 0] } },
  { moveId: 'spiderweb', expected: { enemyVolatiles: ['trapped'], events: ['move'] } },
  { moveId: 'spikecannon', expected: { events: ['move', 'damage', 'damage', 'damage'] } },
  {
    moveId: 'spikyshield',
    expected: { playerVolatiles: ['protect', 'protectStreak'], events: ['move'] },
  },
  { moveId: 'spinout', expected: { playerBoosts: [0, 0, 0, 0, -2, 0, 0] } },
  {
    moveId: 'spiritbreak',
    expected: { events: ['move', 'damage', 'boost'], enemyBoosts: [0, 0, -1, 0, 0, 0, 0] },
  },
  { moveId: 'spite', expected: { events: ['move'] } },
  {
    moveId: 'spitup',
    setup: { playerStockpile: 1 },
    expected: { enemyHp: 63, events: ['move', 'damage'] },
  },
  { moveId: 'splash', expected: { events: ['move'] } },
  { moveId: 'spore', expected: { enemyStatus: 'slp', events: ['move', 'status'] } },
  { moveId: 'springtidestorm', expected: { events: ['move', 'damage'] } },
  { moveId: 'steameruption', expected: { events: ['move', 'damage'] } },
  { moveId: 'steelwing', expected: { events: ['move', 'damage'] } },
  {
    moveId: 'stockpile',
    expected: {
      playerVolatiles: ['stockpile'],
      playerBoosts: [0, 1, 0, 1, 0, 0, 0],
      events: ['move', 'boost', 'boost'],
    },
  },
  { moveId: 'stomp', expected: { events: ['move', 'damage'] } },
  { moveId: 'strangesteam', expected: { events: ['move', 'damage'] } },
  {
    moveId: 'strengthsap',
    setup: { playerHp: 40 },
    expected: { enemyBoosts: [-1, 0, 0, 0, 0, 0, 0], events: ['move', 'heal', 'boost'] },
  },
  { moveId: 'stringshot', expected: { enemyBoosts: [0, 0, 0, 0, -2, 0, 0] } },
  { moveId: 'struggle', expected: { playerHp: 93, events: ['move', 'damage', 'damage'] } },
  {
    moveId: 'strugglebug',
    expected: { events: ['move', 'damage', 'boost'], enemyBoosts: [0, 0, -1, 0, 0, 0, 0] },
  },
  {
    moveId: 'stuffcheeks',
    setup: { heldItem: 'sitrusberry' },
    expected: { playerItem: null, playerBoosts: [0, 2, 0, 0, 0, 0, 0] },
  },
  { moveId: 'stunspore', expected: { enemyStatus: 'par', events: ['move', 'status'] } },
  { moveId: 'submission', expected: { events: ['move', 'damage', 'damage'] } },
  { moveId: 'substitute', expected: { playerVolatiles: ['substitute'] } },
  { moveId: 'sunnyday', expected: { weather: 'sun' } },
  { moveId: 'superfang', expected: { enemyHp: 62, events: ['move', 'damage'] } },
  { moveId: 'superpower', expected: { playerBoosts: [-1, -1, 0, 0, 0, 0, 0] } },
  { moveId: 'supersonic', expected: { enemyVolatiles: ['confusion'] } },
  { moveId: 'surgingstrikes', expected: { events: ['move', 'damage', 'damage', 'damage'] } },
  { moveId: 'swagger', expected: { enemyVolatiles: ['confusion'], enemyBoosts: [2, 0, 0, 0, 0, 0, 0] } },
  { moveId: 'swallow', expected: { events: ['move'] } },
  { moveId: 'sweetkiss', expected: { enemyVolatiles: ['confusion'] } },
  { moveId: 'sweetscent', expected: { enemyBoosts: [0, 0, 0, 0, 0, 0, -2] } },
  {
    moveId: 'switcheroo',
    setup: { heldItem: 'oranberry', enemyHeldItem: 'sitrusberry' },
    expected: { playerItem: 'sitrusberry', enemyItem: 'oranberry', events: ['move'] },
  },
  { moveId: 'swordsdance', expected: { playerBoosts: [2, 0, 0, 0, 0, 0, 0] } },
  { moveId: 'synthesis', setup: { playerHp: 1 }, expected: { events: ['move', 'heal'] } },
  { moveId: 'tachyoncutter', expected: { events: ['move', 'damage', 'damage'] } },
  { moveId: 'tailglow', expected: { playerBoosts: [0, 0, 3, 0, 0, 0, 0] } },
  { moveId: 'tailslap', expected: { events: ['move', 'damage', 'damage', 'damage'] } },
  { moveId: 'tailwhip', expected: { enemyBoosts: [0, -1, 0, 0, 0, 0, 0] } },
  { moveId: 'tailwind', expected: { playerSideConditions: [0, 0, 0, 4, 0, 0, 0], events: ['move'] } },
  { moveId: 'takedown', expected: { events: ['move', 'damage', 'damage'] } },
  {
    moveId: 'takeheart',
    expected: { playerBoosts: [0, 0, 1, 1, 0, 0, 0], events: ['move', 'boost', 'boost'] },
  },
  { moveId: 'tarshot', expected: { enemyBoosts: [0, 0, 0, 0, -1, 0, 0] } },
  { moveId: 'taunt', expected: { enemyVolatiles: ['taunt'] } },
  { moveId: 'tearfullook', expected: { enemyBoosts: [-1, 0, -1, 0, 0, 0, 0] } },
  { moveId: 'teatime', setup: { heldItem: 'sitrusberry' }, expected: { playerItem: null } },
  { moveId: 'technoblast', expected: { enemyVolatiles: ['lastDamageTaken', 'specialDamageTaken'] } },
  { moveId: 'teeterdance', expected: { enemyVolatiles: ['confusion'] } },
  { moveId: 'telekinesis', expected: { enemyVolatiles: ['telekinesis'], events: ['move'] } },
  { moveId: 'teleport', expected: { events: ['move'] } },
  { moveId: 'terrainpulse', expected: { enemyVolatiles: ['lastDamageTaken', 'specialDamageTaken'] } },
  { moveId: 'thunder', expected: { events: ['move', 'damage'] } },
  { moveId: 'thunderbolt', expected: { events: ['move', 'damage'] } },
  {
    moveId: 'thundercage',
    expected: {
      enemyVolatiles: ['lastDamageTaken', 'partiallyTrapped', 'specialDamageTaken', 'trapped'],
    },
    residual: { enemyHp: 73 },
  },
  { moveId: 'thunderfang', expected: { events: ['move', 'damage'] } },
  {
    moveId: 'thunderouskick',
    expected: { events: ['move', 'damage', 'boost'], enemyBoosts: [0, -1, 0, 0, 0, 0, 0] },
  },
  { moveId: 'thunderpunch', expected: { events: ['move', 'damage'] } },
  { moveId: 'thundershock', expected: { events: ['move', 'damage'] } },
  { moveId: 'thunderwave', expected: { enemyStatus: 'par', events: ['move', 'status'] } },
  { moveId: 'tickle', expected: { enemyBoosts: [-1, -1, 0, 0, 0, 0, 0] } },
  {
    moveId: 'tidyup',
    expected: { playerBoosts: [1, 0, 0, 0, 1, 0, 0], events: ['move', 'boost', 'boost'] },
  },
  {
    moveId: 'topsyturvy',
    setup: { enemyBoosts: { atk: 2, def: -1 } },
    expected: { enemyBoosts: [-2, 1, 0, 0, 0, 0, 0], events: ['move', 'boost', 'boost'] },
  },
  {
    moveId: 'torchsong',
    expected: { events: ['move', 'damage', 'boost'], playerBoosts: [0, 0, 1, 0, 0, 0, 0] },
  },
  { moveId: 'torment', expected: { enemyVolatiles: ['torment'], events: ['move'] } },
  { moveId: 'toxic', expected: { enemyStatus: 'tox', events: ['move', 'status'] } },
  {
    moveId: 'toxicthread',
    expected: { enemyStatus: 'psn', enemyBoosts: [0, 0, 0, 0, -1, 0, 0] },
  },
  {
    moveId: 'trailblaze',
    expected: { events: ['move', 'damage', 'boost'], playerBoosts: [0, 0, 0, 0, 1, 0, 0] },
  },
  {
    moveId: 'transform',
    expected: { playerVolatiles: ['transformed'], playerAbility: 'Limber', events: ['move'] },
  },
  {
    moveId: 'trick',
    setup: { heldItem: 'oranberry', enemyHeldItem: 'sitrusberry' },
    expected: { playerItem: 'sitrusberry', enemyItem: 'oranberry', events: ['move'] },
  },
  { moveId: 'trickortreat', expected: { enemyTypes: ['Normal', 'Ghost'], events: ['move'] } },
  { moveId: 'trickroom', expected: { fieldConditions: [5, 0, 0, 0, 0, 0, 0], events: ['move'] } },
  { moveId: 'triplearrows', expected: { events: ['move', 'damage'] } },
  {
    moveId: 'tripleaxel',
    expected: {
      events: ['move', 'damage', 'damage', 'damage'],
      damageAmounts: [9, 16, 24],
    },
  },
  { moveId: 'tripledive', expected: { events: ['move', 'damage', 'damage', 'damage'] } },
  {
    moveId: 'triplekick',
    expected: {
      events: ['move', 'damage', 'damage', 'damage'],
      damageAmounts: [10, 16, 26],
    },
  },
  {
    moveId: 'tropkick',
    expected: { events: ['move', 'damage', 'boost'], enemyBoosts: [-1, 0, 0, 0, 0, 0, 0] },
  },
  { moveId: 'twinbeam', expected: { events: ['move', 'damage', 'damage'] } },
  { moveId: 'twineedle', expected: { events: ['move', 'damage', 'damage', 'status'] } },
  { moveId: 'twister', expected: { events: ['move', 'damage'] } },
  {
    moveId: 'upperhand',
    setup: { enemyMoves: ['quickattack', 'tackle'] },
    expected: {
      events: ['move', 'damage'],
      enemyVolatiles: ['flinched', 'lastDamageTaken', 'physicalDamageTaken'],
    },
    scenario: {
      setup: { enemyMoveIndex: 1 },
      expected: {
        events: ['move'],
        damageAmounts: [],
        enemyVolatiles: [],
        playerPp: [14],
        texts: ['battle.log.used', 'battle.log.fail'],
      },
    },
  },
  { moveId: 'uturn', expected: { events: ['move', 'damage'] } },
  {
    moveId: 'venomdrench',
    setup: { enemyStatus: 'psn' },
    expected: { enemyBoosts: [-1, 0, -1, 0, -1, 0, 0], events: ['move', 'boost', 'boost', 'boost'] },
  },
  { moveId: 'victorydance', expected: { playerBoosts: [1, 1, 0, 0, 1, 0, 0] } },
  { moveId: 'voltswitch', expected: { events: ['move', 'damage'] } },
  { moveId: 'volttackle', expected: { events: ['move', 'damage', 'damage'] } },
  { moveId: 'waterfall', expected: { events: ['move', 'damage'] } },
  { moveId: 'waterpulse', expected: { events: ['move', 'damage'] } },
  { moveId: 'watershuriken', expected: { events: ['move', 'damage', 'damage', 'damage'] } },
  { moveId: 'watersport', expected: { fieldConditions: [0, 0, 0, 0, 0, 0, 5], events: ['move'] } },
  { moveId: 'wavecrash', expected: { events: ['move', 'damage', 'damage'] } },
  { moveId: 'weatherball', expected: { enemyVolatiles: ['lastDamageTaken', 'specialDamageTaken'] } },
  {
    moveId: 'whirlpool',
    expected: {
      enemyVolatiles: ['lastDamageTaken', 'partiallyTrapped', 'specialDamageTaken', 'trapped'],
    },
    residual: { enemyHp: 92 },
  },
  { moveId: 'wildboltstorm', expected: { events: ['move', 'damage'] } },
  { moveId: 'wildcharge', expected: { events: ['move', 'damage', 'damage'] } },
  { moveId: 'willowisp', expected: { enemyStatus: 'brn', events: ['move', 'status'] } },
  { moveId: 'wish', expected: { events: ['move'] } },
  { moveId: 'withdraw', expected: { playerBoosts: [0, 1, 0, 0, 0, 0, 0] } },
  { moveId: 'wonderroom', expected: { fieldConditions: [0, 0, 0, 5, 0, 0, 0], events: ['move'] } },
  { moveId: 'woodhammer', expected: { events: ['move', 'damage', 'damage'] } },
  { moveId: 'workup', expected: { playerBoosts: [1, 0, 1, 0, 0, 0, 0] } },
  { moveId: 'worryseed', expected: { enemyAbility: 'Insomnia', events: ['move'] } },
  {
    moveId: 'wrap',
    expected: {
      enemyVolatiles: ['lastDamageTaken', 'partiallyTrapped', 'physicalDamageTaken', 'trapped'],
    },
    residual: { enemyHp: 98 },
  },
  { moveId: 'wringout', expected: { events: ['move', 'damage'] } },
  { moveId: 'yawn', expected: { enemyVolatiles: ['yawn'] } },
  { moveId: 'zapcannon', expected: { events: ['move', 'damage', 'status'], enemyStatus: 'par' } },
  { moveId: 'zenheadbutt', expected: { events: ['move', 'damage'] } },
  { moveId: 'zingzap', expected: { events: ['move', 'damage'] } },
];
