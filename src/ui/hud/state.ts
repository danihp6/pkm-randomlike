import { getBiome, type BiomeId } from '../../data/biomes';
import { getMove, type MoveCategory } from '../../data/dex';
import { getItem } from '../../data/items';
import { getMission } from '../../data/missions';
import { barredMovesFor, legalMoveIndices, switchablePartyIndices } from '../../engine/battle/commands';
import type { BattleFighter, Gender, StatusId } from '../../engine/battle/fighter';
import {
  activeFighter,
  liveSlots,
  slotActiveIndex,
  type BattleState,
  type SideId,
  type Slot,
  type TerrainId,
  type WeatherId,
} from '../../engine/battle/state';
import { biomeForMap } from '../../engine/maps/plan';
import { POKEVIAL_MAX_CHARGES } from '../../engine/run/heal';
import { missionMet } from '../../engine/run/missions';
import { experienceFraction } from '../../engine/run/progression';
import { squadLevel, type RunMode, type RunState, type RunStats } from '../../engine/run/state';
import { t } from '../../i18n';
import { bagCategoryFor, bagCategoryForKind, type BagCategory } from '../bag';
import { hpFraction, statusAbbreviation } from '../metrics';
import type { Notice } from '../notice';
import { partyRow, type PartyRow } from '../partyScreen';

/** One party row: the shipped party/PC row plus the bar's fraction, derived once. */
export type HudPartyRow = Readonly<PartyRow & { hpFraction: number }>;

/** One bag stack. `category` is null for an item id the catalogue does not know. */
export type HudBagRow = Readonly<{
  itemId: string;
  name: string;
  count: number;
  category: BagCategory | null;
}>;

/** The floor's mission: its id, its display name and whether the floor has met it. */
export type HudMission = Readonly<{ id: string; name: string; met: boolean }>;

/** The route's own chrome: the header line, the shared XP bar and the Pokevial meter. */
export type HudRoute = Readonly<{
  mode: RunMode;
  mapIndex: number;
  routeInMap: number;
  routeIndex: number;
  biomeId: BiomeId;
  biomeName: string;
  levelCap: number;
  squadLevel: number;
  xp: number;
  xpFraction: number;
  pokevialCharges: number;
  pokevialMax: number;
  bossDefeated: boolean;
  discoveredRooms: readonly number[];
  mission: HudMission | null;
  missionsCompleted: number;
  stats: RunStats;
}>;

/** One move cell of the battle's move menu. */
export type HudBattleMove = Readonly<{
  moveId: string;
  name: string;
  type: string;
  category: MoveCategory;
  pp: number;
  maxPp: number;
  /** The move's base power (`getMove().basePower`), 0 for a status move. */
  power: number;
  /** The move's printed accuracy; null when it never misses (`Move.accuracy === true`). */
  accuracy: number | null;
  desc: string;
  /** True when `legalMoveIndices` offers this slot right now. */
  usable: boolean;
}>;

/** One member of a battle side, as a row the switch screen lists. */
export type HudBattleFighter = Readonly<{
  fighterId: string;
  speciesId: string;
  name: string;
  level: number;
  gender: Gender;
  shiny: boolean;
  hp: number;
  maxHp: number;
  hpFraction: number;
  status: StatusId | null;
  statusLabel: string | null;
  /** The player's side: `switchablePartyIndices` offers this row. The enemy's: always false. */
  canSwitchTo: boolean;
}>;

/** One live active: the row plus its slot and the moves its menu offers. */
export type HudBattleActive = Readonly<
  HudBattleFighter & { slot: Slot; moves: readonly HudBattleMove[] }
>;

export type HudBattleSide = Readonly<{
  name: string;
  party: readonly HudBattleFighter[];
  actives: readonly HudBattleActive[];
  awaitingReplacement: boolean;
}>;

/** One row of the battle bag. `usable` is the battlefield's own enablement. */
export type HudBattleBagRow = Readonly<{
  itemId: string;
  name: string;
  count: number;
  category: BagCategory;
  usable: boolean;
}>;

/** The battle chrome's whole input: the four HP boxes, the move menu and the bag. */
export type HudBattle = Readonly<{
  turn: number;
  double: boolean;
  isWild: boolean;
  winner: SideId | 'draw' | null;
  weather: WeatherId | null;
  weatherTurns: number;
  terrain: TerrainId | null;
  terrainTurns: number;
  fog: boolean;
  noHeal: boolean;
  noFlee: boolean;
  bannedSpecies: string | null;
  sides: Readonly<Record<SideId, HudBattleSide>>;
  bag: readonly HudBattleBagRow[];
}>;

/**
 * The one snapshot the HUD renders. Plain data: JSON round-trips it unchanged.
 * On the route `route` is set and `battle` is null; in battle it is the other way
 * round (`battle !== null` is the single test for "a battle is up").
 */
export type HudState = Readonly<{
  party: readonly HudPartyRow[];
  bag: readonly HudBagRow[];
  /** The run's Poké Dollars on the route, null in battle. */
  money: number | null;
  route: HudRoute | null;
  battle: HudBattle | null;
  notice: Notice | null;
}>;

/** The screen a snapshot comes from: the only field a projection reads to branch. */
export type HudScreen = 'route' | 'battle';

/**
 * Everything the projection may read. A route emit needs the run; a battle emit
 * needs the battle state and the run's *launch-time* `canCapture`, because the
 * battle scene never holds a `RunState` (`BattleLaunch` carries that flag).
 */
export type HudProjection =
  | Readonly<{ screen: 'route'; run: RunState; notice: Notice | null }>
  | Readonly<{ screen: 'battle'; battle: BattleState; canCapture: boolean }>;

/** The one consumer the HUD installs. It is handed a value; it never gets the engine. */
export type HudSink = (state: HudState) => void;

function hudPartyRow(member: RunState['party'][number]): HudPartyRow {
  const row = partyRow(member);
  return { ...row, hpFraction: hpFraction(row.hp, row.maxHp) };
}

function hudBagRow(stack: RunState['bag'][number]): HudBagRow {
  return {
    itemId: stack.itemId,
    name: getItem(stack.itemId)?.name ?? stack.itemId,
    count: stack.count,
    category: bagCategoryFor(stack.itemId),
  };
}

function hudMission(run: RunState): HudMission | null {
  const mission = run.mission;
  if (mission === null) return null;
  const row = getMission(mission.id);
  return {
    id: mission.id,
    name: row ? t(row.nameKey) : mission.id,
    met: missionMet(run),
  };
}

function projectRoute(run: RunState, notice: Notice | null): HudState {
  const level = squadLevel(run);
  const biomeId = biomeForMap(run.seed, run.mapIndex);
  return {
    party: run.party.map(hudPartyRow),
    bag: run.bag.map(hudBagRow),
    money: run.money,
    route: {
      mode: run.mode,
      mapIndex: run.mapIndex,
      routeInMap: run.routeInMap,
      routeIndex: run.routeIndex,
      biomeId,
      biomeName: getBiome(biomeId).name,
      levelCap: run.levelCap,
      squadLevel: level,
      xp: run.xp,
      xpFraction: experienceFraction(run.xp, level),
      pokevialCharges: run.pokevialCharges,
      pokevialMax: POKEVIAL_MAX_CHARGES,
      bossDefeated: run.bossDefeated,
      discoveredRooms: [...run.discoveredRooms],
      mission: hudMission(run),
      missionsCompleted: run.missionsCompleted,
      stats: { ...run.stats },
    },
    battle: null,
    notice,
  };
}

function hudMoves(battle: BattleState, side: SideId, fighter: BattleFighter): readonly HudBattleMove[] {
  if (side !== 'player') return [];
  const legal = legalMoveIndices(fighter, barredMovesFor(battle, side));
  return fighter.moves.map((slot, index) => {
    const move = getMove(slot.moveId);
    return {
      moveId: slot.moveId,
      name: move?.name ?? slot.moveId,
      type: move?.type ?? '',
      category: move?.category ?? 'Status',
      pp: slot.pp,
      maxPp: slot.maxPp,
      power: move?.basePower ?? 0,
      accuracy: move === undefined || move.accuracy === true ? null : move.accuracy,
      desc: move?.desc ?? '',
      usable: legal.includes(index),
    };
  });
}

function hudBattleFighter(
  fighter: BattleFighter,
  switchable: readonly number[],
  index: number,
): HudBattleFighter {
  return {
    fighterId: fighter.id,
    speciesId: fighter.speciesId,
    name: fighter.name,
    level: fighter.level,
    gender: fighter.gender,
    shiny: fighter.shiny,
    hp: fighter.hp,
    maxHp: fighter.maxHp,
    hpFraction: hpFraction(fighter.hp, fighter.maxHp),
    status: fighter.status,
    statusLabel: statusAbbreviation(fighter.status),
    canSwitchTo: switchable.includes(index),
  };
}

function hudSide(battle: BattleState, side: SideId): HudBattleSide {
  const battleSide = battle.sides[side];
  const switchable = side === 'player' ? switchablePartyIndices(battle, side) : [];
  return {
    name: battleSide.name,
    party: battleSide.party.map((fighter, index) => hudBattleFighter(fighter, switchable, index)),
    actives: liveSlots(battle, side).map((slot) => {
      const fighter = activeFighter(battle, side, slot);
      const index = slotActiveIndex(battle, side, slot);
      return {
        ...hudBattleFighter(fighter, switchable, index),
        slot,
        moves: hudMoves(battle, side, fighter),
      };
    }),
    awaitingReplacement: battleSide.awaitingReplacement,
  };
}

function hudBattleBagRow(battle: BattleState, canCapture: boolean): readonly HudBattleBagRow[] {
  return battle.bag.map((slot) => ({
    itemId: slot.item.id,
    name: slot.item.name,
    count: slot.count,
    category: bagCategoryForKind(slot.item.kind),
    usable:
      !battle.noHeal &&
      slot.count > 0 &&
      slot.item.kind !== 'held' &&
      slot.item.kind !== 'valuable' &&
      (slot.item.kind !== 'ball' || (battle.isWild && canCapture)),
  }));
}

function projectBattle(battle: BattleState, canCapture: boolean): HudState {
  return {
    party: [],
    bag: [],
    money: null,
    route: null,
    battle: {
      turn: battle.turn,
      double: battle.double,
      isWild: battle.isWild,
      winner: battle.winner,
      weather: battle.weather,
      weatherTurns: battle.weatherTurns,
      terrain: battle.terrain,
      terrainTurns: battle.terrainTurns,
      fog: battle.fog,
      noHeal: battle.noHeal,
      noFlee: battle.noFlee,
      bannedSpecies: battle.bannedSpecies,
      sides: { player: hudSide(battle, 'player'), enemy: hudSide(battle, 'enemy') },
      bag: hudBattleBagRow(battle, canCapture),
    },
    notice: null,
  };
}

/** Builds the snapshot. Pure: same input (and locale) ⇒ deep-equal output, always. */
export function projectHud(input: HudProjection): HudState {
  return input.screen === 'route'
    ? projectRoute(input.run, input.notice)
    : projectBattle(input.battle, input.canCapture);
}

/**
 * The one emit point (`D49`). Builds the snapshot, calls `sink(next)` **once**,
 * and returns `next`. It holds no cache, no last value, no subscription: a
 * notification, never a mutation.
 */
export function syncHud(input: HudProjection, sink: HudSink): HudState {
  const next = projectHud(input);
  sink(next);
  return next;
}
