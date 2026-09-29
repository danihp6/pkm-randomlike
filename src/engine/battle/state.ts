import type { ItemDef } from '../../data/items';
import type { Rng } from '../rng';
import { makeContext, runStart, runSwitchIn } from './effects/registry';
import type { BattleFighter, BoostId, StatusId } from './fighter';

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
      },
      enemy: {
        id: 'enemy',
        name: setup.enemyName ?? 'Foe',
        party: [...setup.enemy],
        activeIndex: 0,
        awaitingReplacement: false,
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

export function hasHealthy(state: BattleState, side: SideId): boolean {
  return state.sides[side].party.some((fighter) => fighter.hp > 0);
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
