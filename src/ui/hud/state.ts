import { getBiome, type BiomeId } from '../../data/biomes';
import { getMove, type MoveCategory } from '../../data/dex';
import { getItem } from '../../data/items';
import { getMission } from '../../data/missions';
import { barredMovesFor, legalMoveIndices, switchablePartyIndices } from '../../engine/battle/commands';
import {
  BOOST_IDS,
  emptyBoosts,
  type BattleFighter,
  type BoostId,
  type Gender,
  type StatusId,
} from '../../engine/battle/fighter';
import {
  SIDE_IDS,
  activeFighter,
  liveSlots,
  slotActiveIndex,
  type BattleEvent,
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

/** One non-zero stat stage of an active, as the HUD prints it. */
export type HudStatStage = Readonly<{
  stat: BoostId;
  /** The chip's label: `t('battle.stage.<stat>')` — `ATK`, `SPA`, `ACC`, … */
  label: string;
  /** −6…+6, never 0 (a zero stage is not carried). */
  stage: number;
}>;

/** One live active: the row plus its slot, the moves its menu offers and its stages. */
export type HudBattleActive = Readonly<
  HudBattleFighter & { slot: Slot; moves: readonly HudBattleMove[]; stages: readonly HudStatStage[] }
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

/** One slot of the beat the boxes paint: the HP, status and stages a frame landed. */
export type HudBattleSlotDisplay = Readonly<{
  hp: number;
  maxHp: number;
  status: StatusId | null;
  boosts: Readonly<Record<BoostId, number>>;
}>;

/** Two slots per side, in field order; `null` is an empty slot. Plain data. */
export type HudBattleDisplay = Readonly<Record<SideId, readonly (HudBattleSlotDisplay | null)[]>>;

/** The screen a snapshot comes from: the only field a projection reads to branch. */
export type HudScreen = 'route' | 'battle';

/**
 * Everything the projection may read. A route emit needs the run; a battle emit
 * needs the battle state and the run's *launch-time* `canCapture`, because the
 * battle scene never holds a `RunState` (`BattleLaunch` carries that flag).
 */
export type HudProjection =
  | Readonly<{ screen: 'route'; run: RunState; notice: Notice | null }>
  | Readonly<{
      screen: 'battle';
      battle: BattleState;
      canCapture: boolean;
      /** The beat the boxes paint. Omitted ⇒ the live state (headless fixtures). */
      display?: HudBattleDisplay;
    }>;

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

/**
 * The fighter's stat stages as the HUD prints them: only the non-zero ones, in
 * `BOOST_IDS` order — which is the board's own order — each label resolved once.
 */
function hudStages(boosts: Readonly<Record<BoostId, number>>): readonly HudStatStage[] {
  const stages: HudStatStage[] = [];
  for (const stat of BOOST_IDS) {
    const stage = boosts[stat];
    if (stage === 0) continue;
    stages.push({ stat, label: t(`battle.stage.${stat}`), stage });
  }
  return stages;
}

// --- the beat the boxes paint ----------------------------------------------

/** The party index a side's slot holds, or -1 when the side does not field it. */
function slotPartyIndex(battle: BattleState, side: SideId, slot: Slot): number {
  const battleSide = battle.sides[side];
  return slot === 0 ? battleSide.activeIndex : battleSide.secondActiveIndex;
}

/** The live fighter a slot fields, or null when the side does not field that slot. */
function slotFighter(battle: BattleState, side: SideId, slot: Slot): BattleFighter | null {
  const index = slotPartyIndex(battle, side, slot);
  return index < 0 ? null : (battle.sides[side].party[index] ?? null);
}

function displaySlotOf(fighter: BattleFighter): HudBattleSlotDisplay {
  return {
    hp: fighter.hp,
    maxHp: fighter.maxHp,
    status: fighter.status,
    boosts: { ...fighter.boosts },
  };
}

/** The snapshot a battle starts from: each live slot's hp, status and boosts. */
export function battleDisplayOf(battle: BattleState): HudBattleDisplay {
  const slots = (side: SideId): readonly (HudBattleSlotDisplay | null)[] => {
    const live = slotFighter(battle, side, 0);
    const partner = slotFighter(battle, side, 1);
    return [
      live === null ? null : displaySlotOf(live),
      partner === null ? null : displaySlotOf(partner),
    ];
  };
  return { player: slots('player'), enemy: slots('enemy') };
}

/** The slot as it stands, or the live fighter's own when the display has none. */
function slotAt(
  battle: BattleState,
  display: HudBattleDisplay,
  side: SideId,
  slot: Slot,
): HudBattleSlotDisplay {
  const shown = display[side][slot] ?? null;
  if (shown !== null) return shown;
  const fighter = slotFighter(battle, side, slot);
  if (fighter !== null) return displaySlotOf(fighter);
  return { hp: 0, maxHp: 0, status: null, boosts: emptyBoosts() };
}

/** A copy of the beat with one slot replaced, so `advanceBattleDisplay` never mutates. */
function withSlot(
  display: HudBattleDisplay,
  side: SideId,
  slot: Slot,
  next: HudBattleSlotDisplay | null,
): HudBattleDisplay {
  const slots: (HudBattleSlotDisplay | null)[] = [display[side][0] ?? null, display[side][1] ?? null];
  slots[slot] = next;
  if (side === 'player') return { player: slots, enemy: display.enemy };
  return { player: display.player, enemy: slots };
}

/**
 * Which slot a damage/heal event belongs to. It carries no slot, so the slot whose
 * displayed HP moves by exactly `amount` onto `hp` is the one; when both read alike,
 * the event's `maxHp` separates them, and slot 0 wins the leftover ambiguity, as it
 * does in every single battle.
 */
function hpEventSlot(
  display: HudBattleDisplay,
  side: SideId,
  amount: number,
  hp: number,
  maxHp: number,
  healed: boolean,
): Slot {
  const first = display[side][0] ?? null;
  const second = display[side][1] ?? null;
  if (second === null) return 0;
  const delta = healed ? amount : -amount;
  const firstMatch = first !== null && first.hp + delta === hp;
  const secondMatch = second.hp + delta === hp;
  if (firstMatch !== secondMatch) return secondMatch ? 1 : 0;
  if (second.maxHp === maxHp && (first?.maxHp ?? -1) !== maxHp) return 1;
  return 0;
}

/**
 * Which slot a status/cure event belongs to: it names no slot either, so the live
 * fighter that carries (or no longer carries) the status decides, and slot 0 keeps
 * every ambiguous case.
 */
function statusEventSlot(
  battle: BattleState,
  display: HudBattleDisplay,
  side: SideId,
  status: StatusId,
  cured: boolean,
): Slot {
  const partner = slotFighter(battle, side, 1);
  if (partner === null) return 0;
  const shown = display[side][1] ?? null;
  const shownLead = display[side][0] ?? null;
  const atPartner = cured
    ? shown?.status === status && partner.status !== status
    : shownLead?.status !== status && partner.status === status;
  return atPartner ? 1 : 0;
}

/**
 * Which slot a boost event belongs to: it names no slot either, so the slot whose
 * live fighter carries the event's absolute stage and whose painted stage still
 * differs from it is the one, and slot 0 wins the leftover ambiguity.
 */
function boostEventSlot(
  battle: BattleState,
  display: HudBattleDisplay,
  side: SideId,
  stat: BoostId,
  stages: number,
): Slot {
  const second = display[side][1] ?? null;
  if (second === null) return 0;
  const first = display[side][0] ?? null;
  const firstMoved =
    (first?.boosts[stat] ?? 0) !== stages && slotFighter(battle, side, 0)?.boosts[stat] === stages;
  const secondMoved =
    second.boosts[stat] !== stages && slotFighter(battle, side, 1)?.boosts[stat] === stages;
  if (firstMoved !== secondMoved) return secondMoved ? 1 : 0;
  return 0;
}

/**
 * Which slot a switch/faint event belongs to: it names a fighter, so the slot the
 * display already paints as that fighter is the one, and the engine's own indices
 * decide when nothing matches (a switch-in still paints the fighter it replaces).
 */
function fighterEventSlot(
  battle: BattleState,
  display: HudBattleDisplay,
  side: SideId,
  fighterId: string,
): Slot {
  const battleSide = battle.sides[side];
  const index = battleSide.party.findIndex((fighter) => fighter.id === fighterId);
  if (index < 0) return 0;
  const fighter = battleSide.party[index];
  const painted: Slot[] = [];
  for (const slot of [0, 1] as const) {
    const shown = display[side][slot] ?? null;
    if (shown === null) continue;
    if (shown.hp !== fighter.hp || shown.maxHp !== fighter.maxHp) continue;
    if (shown.status !== fighter.status) continue;
    painted.push(slot);
  }
  if (painted.length === 1) return painted[0];
  return index === battleSide.secondActiveIndex ? 1 : 0;
}

/** One frame's events applied to the beat, in the order the engine wrote them. */
function applyEvent(
  battle: BattleState,
  display: HudBattleDisplay,
  event: BattleEvent,
): HudBattleDisplay {
  switch (event.kind) {
    case 'damage':
    case 'heal': {
      const slot = hpEventSlot(
        display,
        event.side,
        event.amount,
        event.hp,
        event.maxHp,
        event.kind === 'heal',
      );
      const shown = slotAt(battle, display, event.side, slot);
      return withSlot(display, event.side, slot, {
        ...shown,
        hp: event.hp,
        maxHp: event.maxHp,
      });
    }
    case 'status': {
      const slot = statusEventSlot(battle, display, event.side, event.status, false);
      return withSlot(display, event.side, slot, {
        ...slotAt(battle, display, event.side, slot),
        status: event.status,
      });
    }
    case 'cure': {
      const slot = statusEventSlot(battle, display, event.side, event.status, true);
      return withSlot(display, event.side, slot, {
        ...slotAt(battle, display, event.side, slot),
        status: null,
      });
    }
    case 'boost': {
      const slot = boostEventSlot(battle, display, event.side, event.stat, event.stages);
      const shown = slotAt(battle, display, event.side, slot);
      const boosts = { ...shown.boosts };
      boosts[event.stat] = event.stages;
      return withSlot(display, event.side, slot, { ...shown, boosts });
    }
    case 'faint': {
      const slot = fighterEventSlot(battle, display, event.side, event.fighterId);
      return withSlot(display, event.side, slot, {
        ...slotAt(battle, display, event.side, slot),
        hp: 0,
      });
    }
    case 'switch': {
      const fighter = battle.sides[event.side].party.find((entry) => entry.id === event.fighterId);
      if (!fighter) return display;
      const slot = fighterEventSlot(battle, display, event.side, event.fighterId);
      return withSlot(display, event.side, slot, displaySlotOf(fighter));
    }
    default:
      return display;
  }
}

function sameSlot(left: HudBattleSlotDisplay | null, right: HudBattleSlotDisplay | null): boolean {
  if (left === null || right === null) return left === right;
  if (left.hp !== right.hp || left.maxHp !== right.maxHp || left.status !== right.status) return false;
  return BOOST_IDS.every((stat) => left.boosts[stat] === right.boosts[stat]);
}

function sameDisplay(left: HudBattleDisplay, right: HudBattleDisplay): boolean {
  return SIDE_IDS.every(
    (side) =>
      sameSlot(left[side][0] ?? null, right[side][0] ?? null) &&
      sameSlot(left[side][1] ?? null, right[side][1] ?? null),
  );
}

/**
 * Applies one frame's events to the snapshot. Pure: never mutates `display`, and a
 * frame that changes neither HP, status nor a stage hands back `display` itself, so
 * the boxes are asked to paint nothing they already paint.
 */
export function advanceBattleDisplay(
  battle: BattleState,
  display: HudBattleDisplay,
  events: readonly BattleEvent[],
): HudBattleDisplay {
  let next = display;
  for (const event of events) next = applyEvent(battle, next, event);
  return sameDisplay(display, next) ? display : next;
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

function hudSide(
  battle: BattleState,
  side: SideId,
  display: HudBattleDisplay | undefined,
): HudBattleSide {
  const battleSide = battle.sides[side];
  const switchable = side === 'player' ? switchablePartyIndices(battle, side) : [];
  return {
    name: battleSide.name,
    party: battleSide.party.map((fighter, index) => hudBattleFighter(fighter, switchable, index)),
    actives: liveSlots(battle, side).map((slot) => {
      const fighter = activeFighter(battle, side, slot);
      const index = slotActiveIndex(battle, side, slot);
      const beat = display === undefined ? null : (display[side][slot] ?? null);
      return {
        ...hudBattleFighter(fighter, switchable, index),
        ...(beat === null
          ? {}
          : {
              hp: beat.hp,
              maxHp: beat.maxHp,
              hpFraction: hpFraction(beat.hp, beat.maxHp),
              status: beat.status,
              statusLabel: statusAbbreviation(beat.status),
            }),
        slot,
        moves: hudMoves(battle, side, fighter),
        stages: hudStages(beat === null ? fighter.boosts : beat.boosts),
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

function projectBattle(battle: BattleState, canCapture: boolean, display?: HudBattleDisplay): HudState {
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
      sides: {
        player: hudSide(battle, 'player', display),
        enemy: hudSide(battle, 'enemy', display),
      },
      bag: hudBattleBagRow(battle, canCapture),
    },
    notice: null,
  };
}

/** Builds the snapshot. Pure: same input (and locale) ⇒ deep-equal output, always. */
export function projectHud(input: HudProjection): HudState {
  return input.screen === 'route'
    ? projectRoute(input.run, input.notice)
    : projectBattle(input.battle, input.canCapture, input.display);
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
