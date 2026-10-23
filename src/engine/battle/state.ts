import { getSpecies } from '../../data/dex';
import type { ItemDef } from '../../data/items';
import type { TranslationKey } from '../../i18n/en';
import type { Rng } from '../rng';
import { makeContext, runStart, runSwitchIn } from './effects/registry';
import { applyBoosts, trappedBy, type BattleFighter, type BoostId, type StatusId } from './fighter';

export type SideId = 'player' | 'enemy';

export const SIDE_IDS: readonly SideId[] = ['player', 'enemy'];

/** An active slot on one side: 0 is the lead, 1 the partner of a double battle. */
export type Slot = 0 | 1;

/** The two slots a double battle fields per side, in acting order. */
export const SLOTS: readonly Slot[] = [0, 1];

/** One active on one side: the unit a single-target command names. */
export type TargetRef = Readonly<{ side: SideId; slot: Slot }>;

export type WeatherId = 'sun' | 'rain' | 'sand' | 'snow';
export type TerrainId = 'electric' | 'grassy' | 'misty' | 'psychic';

/** Per-side conditions a move can set (Reflect, Tailwind...), with turns left. */
export type SideConditionId =
  'reflect' | 'lightscreen' | 'auroraveil' | 'tailwind' | 'luckychant' | 'mist' | 'safeguard';

/** Whole-field conditions a move can set (Trick Room, Gravity...), with turns left. */
export type FieldConditionId =
  'trickroom' | 'gravity' | 'magicroom' | 'wonderroom' | 'fairylock' | 'mudsport' | 'watersport';

export type SideConditions = Record<SideConditionId, number>;
export type FieldConditions = Record<FieldConditionId, number>;

/** The whole-field rules a room condition seeds (Task-106). */
export type RoomFieldEffects = Readonly<{
  /** The radiant zone: no ability handler runs for either side. */
  abilitiesOff: boolean;
  /** Dark moves deal 1.33× on both sides. */
  darkAura: boolean;
  /** Fairy moves deal 1.33× on both sides. */
  fairyAura: boolean;
  /** Every fighter's types are this one type (STAB and effectiveness follow). */
  overrideType: string | null;
  /** A lethal hit leaves the target at exactly 1 HP. */
  endure: boolean;
  /** Added to every move's crit ratio before the roll. */
  critStage: number;
}>;

export function emptyRoomField(): RoomFieldEffects {
  return {
    abilitiesOff: false,
    darkAura: false,
    fairyAura: false,
    overrideType: null,
    endure: false,
    critStage: 0,
  };
}

export function emptySideConditions(): SideConditions {
  return {
    reflect: 0,
    lightscreen: 0,
    auroraveil: 0,
    tailwind: 0,
    luckychant: 0,
    mist: 0,
    safeguard: 0,
  };
}

export function emptyFieldConditions(): FieldConditions {
  return {
    trickroom: 0,
    gravity: 0,
    magicroom: 0,
    wonderroom: 0,
    fairylock: 0,
    mudsport: 0,
    watersport: 0,
  };
}

export type BagSlot = {
  item: ItemDef;
  count: number;
};

export type BattleSide = {
  id: SideId;
  name: string;
  party: BattleFighter[];
  /** The lead's party index (slot 0). */
  activeIndex: number;
  /** Slot 1's party index; `-1` when the battle is single or the slot is empty. */
  secondActiveIndex: number;
  /** A live slot holds a fainted fighter and a healthy reserve is left to send. */
  awaitingReplacement: boolean;
  /** Turns left before Wish heals the active Pokémon (0 = none). */
  wishTurns: number;
  /** Boosts Baton Pass hands to the incoming Pokémon, consumed on switch-in. */
  batonPassBoosts: Partial<Record<BoostId, number>> | null;
  /** Screens, Tailwind and the other side conditions, with turns left. */
  sideConditions: SideConditions;
};

/** Every key the battle log may name: the `battle.log.` family of the source table. */
export type BattleTextKey = Extract<TranslationKey, `battle.log.${string}`>;

/** The values a log line interpolates. Ids, never rendered words, where a table owns them. */
export type BattleTextParams = Readonly<Record<string, string | number>>;

/** One log line as the engine emits it: a key plus its params, never a sentence. */
export type BattleText = Readonly<{ key: BattleTextKey; params?: BattleTextParams }>;

export type BattleEvent =
  | Readonly<{ kind: 'turn'; turn: number }>
  | Readonly<{ kind: 'text'; key: BattleTextKey; params?: BattleTextParams }>
  | Readonly<{ kind: 'move'; side: SideId; moveId: string }>
  | Readonly<{
      kind: 'damage';
      side: SideId;
      amount: number;
      hp: number;
      maxHp: number;
      effectiveness: number;
      crit: boolean;
    }>
  | Readonly<{ kind: 'heal'; side: SideId; amount: number; hp: number; maxHp: number }>
  | Readonly<{ kind: 'boost'; side: SideId; stat: BoostId; stages: number }>
  | Readonly<{ kind: 'status'; side: SideId; status: StatusId }>
  | Readonly<{ kind: 'cure'; side: SideId; status: StatusId }>
  | Readonly<{ kind: 'faint'; side: SideId; fighterId: string }>
  | Readonly<{ kind: 'switch'; side: SideId; fighterId: string }>
  | Readonly<{ kind: 'mega'; side: SideId; fighterId: string }>
  | Readonly<{ kind: 'gmax'; side: SideId; fighterId: string }>
  | Readonly<{ kind: 'forme'; side: SideId; fighterId: string }>
  | Readonly<{ kind: 'item'; side: SideId; itemId: string }>
  | Readonly<{ kind: 'capture'; success: boolean; fighterId: string; shakes: number }>
  | Readonly<{ kind: 'run'; side: SideId; success: boolean }>
  | Readonly<{ kind: 'end'; winner: SideId | 'draw' }>;

export type BattleState = {
  sides: Record<SideId, BattleSide>;
  /** True when both sides field two active slots (the map boss's fight). */
  double: boolean;
  turn: number;
  weather: WeatherId | null;
  weatherTurns: number;
  terrain: TerrainId | null;
  terrainTurns: number;
  /** Whole-field conditions (Trick Room, Gravity...), with turns left. */
  field: FieldConditions;
  /**
   * Dense fog over the field (a room condition, never a weather): every move loses
   * `FOG_ACCURACY_PENALTY` of its own accuracy, clamped at 0, and a move that cannot
   * miss is unaffected. No move sets it and it carries no turn count.
   */
  fog: boolean;
  /**
   * The room's whole-field rules (Task-106): no abilities, the two auras, one
   * all-types override, Endure and the crit-stage bonus. They last the whole
   * battle, carry no turn count and draw no RNG.
   */
  roomField: RoomFieldEffects;
  rng: Rng;
  log: BattleEvent[];
  bag: BagSlot[];
  isWild: boolean;
  /** True while the run that launched this battle has caught nothing yet (Task-48). */
  firstCatch: boolean;
  winner: SideId | 'draw' | null;
  /** Failed run attempts this battle, feeding the classic escape odds. */
  escapeAttempts: number;
  /** Sides that have already used a move this turn (Analytic). */
  movedSides: SideId[];
  /** Sides that switched a Pokémon in this turn (Stakeout). */
  switchedSides: SideId[];
  /** The attacker whose move ignores the target's ability (Mold Breaker and friends). */
  abilityPierce: BattleFighter | null;
  /** The last move id used this battle, for Copycat. */
  lastMove: string | null;
  /**
   * The no-heal room's rule (`docs/maps-spec.md` §7): the player's Bag and the
   * moves of `BARRED_HEALING_MOVES` are refused. The enemy's side, abilities,
   * held items and residual heals are untouched.
   */
  noHeal: boolean;
  /** The wild cannot be fled: `canRun` refuses unless an `onTryEscape` effect grants it. */
  noFlee: boolean;
  /** The species the room bars the player from sending out, or null (Task-101). */
  bannedSpecies: string | null;
  /**
   * The player's fighter ids that took the field this battle, in the order they
   * appeared and deduped: the live slots at battle start, then every switch-in.
   * The post-battle fold reads it (Task-101); it draws no RNG.
   */
  usedFighterIds: string[];
};

export type BattleSetup = Readonly<{
  player: readonly BattleFighter[];
  enemy: readonly BattleFighter[];
  rng: Rng;
  isWild: boolean;
  /** The run that launched this battle has not caught anything yet (Task-48). */
  firstCatch?: boolean;
  bag?: readonly Readonly<{ item: ItemDef; count: number }>[];
  playerName?: string;
  enemyName?: string;
  /** A room condition: the weather the battle starts under and the turns it has left. */
  weather?: Readonly<{ id: WeatherId; turns: number }> | null;
  /** A room condition: the terrain the battle starts under and the turns it has left. */
  terrain?: Readonly<{ id: TerrainId; turns: number }> | null;
  /** A room condition: field conditions to seed, with their turns left. */
  field?: Partial<FieldConditions>;
  /** A room condition: dense fog over the field. */
  fog?: boolean;
  /** A room condition: the whole-field rules the room seeds (Task-106). */
  roomField?: Partial<RoomFieldEffects>;
  /** The room bars the player's Bag and healing moves (the no-heal leaf). */
  noHeal?: boolean;
  /** The wild cannot be fled (default `false`). */
  noFlee?: boolean;
  /** The room bars this species from being sent out. Default `null`. */
  bannedSpecies?: string | null;
  /** A double battle: two active slots per side. Default `false`. */
  double?: boolean;
  /** Stat stages the enemy's lead starts with (the exorcist's curse). */
  enemyBoosts?: Partial<Record<BoostId, number>>;
}>;

/**
 * The player's two active indices when the battle opens: the shipped `0` (and `1`
 * in a double battle) unless the room bars a species. With a ban the order is
 * every living unbarred member ascending, then every remaining index ascending, so
 * the lead is the first member the room allows to be sent out (Task-101).
 */
function playerLeadIndices(
  party: readonly BattleFighter[],
  bannedSpecies: string | null,
  double: boolean,
): Readonly<{ activeIndex: number; secondActiveIndex: number }> {
  if (bannedSpecies === null) {
    return { activeIndex: 0, secondActiveIndex: double && party.length > 1 ? 1 : -1 };
  }
  const legal: number[] = [];
  const rest: number[] = [];
  for (let index = 0; index < party.length; index++) {
    const fighter = party[index];
    if (fighter.hp > 0 && fighter.speciesId !== bannedSpecies) legal.push(index);
    else rest.push(index);
  }
  const order = [...legal, ...rest];
  return {
    activeIndex: order[0] ?? 0,
    secondActiveIndex: double && order.length > 1 ? order[1] : double && party.length > 1 ? 1 : -1,
  };
}

export function createBattle(setup: BattleSetup): BattleState {
  if (setup.player.length === 0 || setup.enemy.length === 0) {
    throw new Error('A battle needs at least one Pokémon per side');
  }

  const double = setup.double ?? false;
  const bannedSpecies = setup.bannedSpecies ?? null;
  const lead = playerLeadIndices(setup.player, bannedSpecies, double);
  const state: BattleState = {
    sides: {
      player: {
        id: 'player',
        name: setup.playerName ?? 'Player',
        party: [...setup.player],
        activeIndex: lead.activeIndex,
        secondActiveIndex: lead.secondActiveIndex,
        awaitingReplacement: false,
        wishTurns: 0,
        batonPassBoosts: null,
        sideConditions: emptySideConditions(),
      },
      enemy: {
        id: 'enemy',
        name: setup.enemyName ?? 'Foe',
        party: [...setup.enemy],
        activeIndex: 0,
        secondActiveIndex: double && setup.enemy.length > 1 ? 1 : -1,
        awaitingReplacement: false,
        wishTurns: 0,
        batonPassBoosts: null,
        sideConditions: emptySideConditions(),
      },
    },
    double,
    turn: 0,
    weather: setup.weather?.id ?? null,
    weatherTurns: setup.weather?.turns ?? 0,
    terrain: setup.terrain?.id ?? null,
    terrainTurns: setup.terrain?.turns ?? 0,
    field: { ...emptyFieldConditions(), ...(setup.field ?? {}) },
    fog: setup.fog ?? false,
    roomField: { ...emptyRoomField(), ...(setup.roomField ?? {}) },
    rng: setup.rng,
    log: [],
    bag: (setup.bag ?? []).map((slot) => ({ item: slot.item, count: slot.count })),
    isWild: setup.isWild,
    firstCatch: setup.firstCatch ?? false,
    winner: null,
    escapeAttempts: 0,
    movedSides: [],
    switchedSides: [],
    abilityPierce: null,
    lastMove: null,
    noHeal: setup.noHeal ?? false,
    noFlee: setup.noFlee ?? false,
    bannedSpecies,
    usedFighterIds: [],
  };

  // The exorcist's curse: the enemy's lead starts a stage down, applied once its
  // fighter exists and before any start hook reads its stages. No event is logged:
  // the card the NPC opened already announced it.
  if (setup.enemyBoosts) applyBoosts(state.sides.enemy.party[0], setup.enemyBoosts);

  // The room's rule is the battle feed's first line, ahead of any start hook.
  if (state.noHeal) pushText(state, 'battle.log.roomNoHeal');

  // The banned room's line follows the no-heal one, before any start hook.
  if (state.bannedSpecies !== null) {
    pushText(state, 'battle.log.roomBanned', {
      name: getSpecies(state.bannedSpecies)?.name ?? state.bannedSpecies,
    });
  }

  // The sends are booked before the start hooks run, so the fold always sees a
  // battle that fielded somebody — even one that ends on the opening turn.
  for (const slot of liveSlots(state, 'player')) {
    const id = activeFighter(state, 'player', slot).id;
    if (!state.usedFighterIds.includes(id)) state.usedFighterIds.push(id);
  }

  for (const side of SIDE_IDS) {
    for (const slot of liveSlots(state, side)) {
      const fighter = activeFighter(state, side, slot);
      const ctx = makeContext(state, side, { source: fighter, target: opponent(state, side) });
      runStart(ctx);
      runSwitchIn(ctx);
    }
  }

  return state;
}

export function opponentOf(side: SideId): SideId {
  return side === 'player' ? 'enemy' : 'player';
}

/** The party index a slot holds; slot 1 throws when the battle has no second active. */
export function slotActiveIndex(state: BattleState, side: SideId, slot: Slot): number {
  const battleSide = state.sides[side];
  const index = slot === 0 ? battleSide.activeIndex : battleSide.secondActiveIndex;
  if (index < 0) throw new Error('There is no second active Pokémon.');
  return index;
}

export function activeFighter(state: BattleState, side: SideId, slot: Slot = 0): BattleFighter {
  return state.sides[side].party[slotActiveIndex(state, side, slot)];
}

/** The slots a side fields, ascending: `[0]` in a single battle, `[0, 1]` in a double one. */
export function liveSlots(state: BattleState, side: SideId): readonly Slot[] {
  return state.sides[side].secondActiveIndex >= 0 ? SLOTS : [0];
}

/** Every active of a side, ascending by slot; a fainted occupant still fills its slot. */
export function activeFighters(state: BattleState, side: SideId): readonly BattleFighter[] {
  return liveSlots(state, side).map((slot) => activeFighter(state, side, slot));
}

export function opponent(state: BattleState, side: SideId, slot: Slot = 0): BattleFighter {
  return activeFighter(state, opponentOf(side), slot);
}

/** The slots of the other side, ascending. */
export function opposingSlots(state: BattleState, side: SideId): readonly Slot[] {
  return liveSlots(state, opponentOf(side));
}

export function isOver(state: BattleState): boolean {
  return state.winner !== null;
}

/** Air Lock and Cloud Nine nullify weather effects while their holder is active. */
export function weatherSuppressed(state: BattleState): boolean {
  return SIDE_IDS.some((side) => {
    const fighter = activeFighter(state, side);
    if (fighter.ability !== 'Air Lock' && fighter.ability !== 'Cloud Nine') return false;
    const foe = activeFighter(state, opponentOf(side));
    return foe.ability !== 'Neutralizing Gas';
  });
}

/** The weather as far as its effects are concerned (null under Air Lock / Cloud Nine). */
export function effectiveWeather(state: BattleState): WeatherId | null {
  return weatherSuppressed(state) ? null : state.weather;
}

export function hasHealthy(state: BattleState, side: SideId): boolean {
  return state.sides[side].party.some((fighter) => fighter.hp > 0);
}

/** True while `side`'s active Pokémon cannot switch out or flee (trap volatile or ability). */
export function isTrapped(state: BattleState, side: SideId): boolean {
  const holder = activeFighter(state, side);
  if (holder.volatiles.trapped) return true;
  if (holder.volatiles.ingrain) return true;
  if (state.field.fairylock > 0) return true;
  return trappedBy(opponent(state, side), holder);
}

export function pushEvent(state: BattleState, event: BattleEvent): void {
  state.log.push(event);
}

export function pushText(state: BattleState, key: BattleTextKey, params?: BattleTextParams): void {
  if (params === undefined) pushEvent(state, { kind: 'text', key });
  else pushEvent(state, { kind: 'text', key, params });
}

export function finishBattle(state: BattleState, winner: SideId | 'draw'): void {
  if (state.winner !== null) return;
  state.winner = winner;
  pushEvent(state, { kind: 'end', winner });
}
