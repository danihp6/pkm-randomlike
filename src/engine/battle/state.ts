import type { ItemDef } from '../../data/items';
import type { Rng } from '../rng';
import { makeContext, runStart, runSwitchIn } from './effects/registry';
import { trappedBy, type BattleFighter, type BoostId, type StatusId } from './fighter';

export type SideId = 'player' | 'enemy';

export const SIDE_IDS: readonly SideId[] = ['player', 'enemy'];

export type WeatherId = 'sun' | 'rain' | 'sand' | 'snow';
export type TerrainId = 'electric' | 'grassy' | 'misty' | 'psychic';

export type BagSlot = {
  item: ItemDef;
  count: number;
};

export type BattleSide = {
  id: SideId;
  name: string;
  party: BattleFighter[];
  activeIndex: number;
  /** The active Pokémon fainted; a replacement is required before the next turn. */
  awaitingReplacement: boolean;
  /** Turns left before Wish heals the active Pokémon (0 = none). */
  wishTurns: number;
  /** Boosts Baton Pass hands to the incoming Pokémon, consumed on switch-in. */
  batonPassBoosts: Partial<Record<BoostId, number>> | null;
};

export type BattleEvent =
  | Readonly<{ kind: 'turn'; turn: number }>
  | Readonly<{ kind: 'text'; text: string }>
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
  | Readonly<{ kind: 'item'; side: SideId; itemId: string }>
  | Readonly<{ kind: 'capture'; success: boolean; fighterId: string; shakes: number }>
  | Readonly<{ kind: 'run'; side: SideId; success: boolean }>
  | Readonly<{ kind: 'end'; winner: SideId | 'draw' }>;

export type BattleState = {
  sides: Record<SideId, BattleSide>;
  turn: number;
  weather: WeatherId | null;
  weatherTurns: number;
  terrain: TerrainId | null;
  terrainTurns: number;
  rng: Rng;
  log: BattleEvent[];
  bag: BagSlot[];
  isWild: boolean;
  winner: SideId | 'draw' | null;
  /** Failed run attempts this battle, feeding the classic escape odds. */
  escapeAttempts: number;
  /** Sides that have already used a move this turn (Analytic). */
  movedSides: SideId[];
  /** Sides that switched a Pokémon in this turn (Stakeout). */
  switchedSides: SideId[];
  /** The attacker whose move ignores the target's ability (Mold Breaker and friends). */
  abilityPierce: BattleFighter | null;
};

export type BattleSetup = Readonly<{
  player: readonly BattleFighter[];
  enemy: readonly BattleFighter[];
  rng: Rng;
  isWild: boolean;
  bag?: readonly Readonly<{ item: ItemDef; count: number }>[];
  playerName?: string;
  enemyName?: string;
}>;

export function createBattle(setup: BattleSetup): BattleState {
  if (setup.player.length === 0 || setup.enemy.length === 0) {
    throw new Error('A battle needs at least one Pokémon per side');
  }

  const state: BattleState = {
    sides: {
      player: {
        id: 'player',
        name: setup.playerName ?? 'Player',
        party: [...setup.player],
        activeIndex: 0,
        awaitingReplacement: false,
        wishTurns: 0,
        batonPassBoosts: null,
      },
      enemy: {
        id: 'enemy',
        name: setup.enemyName ?? 'Foe',
        party: [...setup.enemy],
        activeIndex: 0,
        awaitingReplacement: false,
        wishTurns: 0,
        batonPassBoosts: null,
      },
    },
    turn: 0,
    weather: null,
    weatherTurns: 0,
    terrain: null,
    terrainTurns: 0,
    rng: setup.rng,
    log: [],
    bag: (setup.bag ?? []).map((slot) => ({ item: slot.item, count: slot.count })),
    isWild: setup.isWild,
    winner: null,
    escapeAttempts: 0,
    movedSides: [],
    switchedSides: [],
    abilityPierce: null,
  };

  for (const side of SIDE_IDS) {
    const fighter = activeFighter(state, side);
    const ctx = makeContext(state, side, { source: fighter, target: opponent(state, side) });
    runStart(ctx);
    runSwitchIn(ctx);
  }

  return state;
}

export function opponentOf(side: SideId): SideId {
  return side === 'player' ? 'enemy' : 'player';
}

export function activeFighter(state: BattleState, side: SideId): BattleFighter {
  return state.sides[side].party[state.sides[side].activeIndex];
}

export function opponent(state: BattleState, side: SideId): BattleFighter {
  return activeFighter(state, opponentOf(side));
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
  return trappedBy(opponent(state, side), holder);
}

export function pushEvent(state: BattleState, event: BattleEvent): void {
  state.log.push(event);
}

export function pushText(state: BattleState, text: string): void {
  pushEvent(state, { kind: 'text', text });
}

export function finishBattle(state: BattleState, winner: SideId | 'draw'): void {
  if (state.winner !== null) return;
  state.winner = winner;
  pushEvent(state, { kind: 'end', winner });
}
