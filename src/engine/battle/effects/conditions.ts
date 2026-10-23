import {
  SIDE_IDS,
  pushText,
  type BattleState,
  type BattleTextKey,
  type FieldConditionId,
  type SideConditionId,
  type SideId,
} from '../state';

/**
 * Side and field conditions (Reflect, Tailwind, Trick Room...) with their canon
 * durations. They live on `BattleSide.sideConditions` and `BattleState.field`
 * and are ticked in the residual pass, next to weather and terrain.
 */
export const SIDE_CONDITION_IDS: readonly SideConditionId[] = [
  'reflect',
  'lightscreen',
  'auroraveil',
  'tailwind',
  'luckychant',
  'mist',
  'safeguard',
];

export const FIELD_CONDITION_IDS: readonly FieldConditionId[] = [
  'trickroom',
  'gravity',
  'magicroom',
  'wonderroom',
  'fairylock',
  'mudsport',
  'watersport',
];

export const SIDE_CONDITION_TURNS: Readonly<Record<SideConditionId, number>> = {
  reflect: 5,
  lightscreen: 5,
  auroraveil: 5,
  tailwind: 4,
  luckychant: 5,
  mist: 5,
  safeguard: 5,
};

export const FIELD_CONDITION_TURNS: Readonly<Record<FieldConditionId, number>> = {
  trickroom: 5,
  gravity: 5,
  magicroom: 5,
  wonderroom: 5,
  fairylock: 2,
  mudsport: 5,
  watersport: 5,
};

const SIDE_START: Readonly<Record<SideConditionId, BattleTextKey>> = {
  reflect: 'battle.log.side.start.reflect',
  lightscreen: 'battle.log.side.start.lightscreen',
  auroraveil: 'battle.log.side.start.auroraveil',
  tailwind: 'battle.log.side.start.tailwind',
  luckychant: 'battle.log.side.start.luckychant',
  mist: 'battle.log.side.start.mist',
  safeguard: 'battle.log.side.start.safeguard',
};

const SIDE_END: Readonly<Record<SideConditionId, BattleTextKey>> = {
  reflect: 'battle.log.side.end.reflect',
  lightscreen: 'battle.log.side.end.lightscreen',
  auroraveil: 'battle.log.side.end.auroraveil',
  tailwind: 'battle.log.side.end.tailwind',
  luckychant: 'battle.log.side.end.luckychant',
  mist: 'battle.log.side.end.mist',
  safeguard: 'battle.log.side.end.safeguard',
};

const FIELD_START: Readonly<Record<FieldConditionId, BattleTextKey>> = {
  trickroom: 'battle.log.field.start.trickroom',
  gravity: 'battle.log.field.start.gravity',
  magicroom: 'battle.log.field.start.magicroom',
  wonderroom: 'battle.log.field.start.wonderroom',
  fairylock: 'battle.log.field.start.fairylock',
  mudsport: 'battle.log.field.start.mudsport',
  watersport: 'battle.log.field.start.watersport',
};

const FIELD_END: Readonly<Record<FieldConditionId, BattleTextKey>> = {
  trickroom: 'battle.log.field.end.trickroom',
  gravity: 'battle.log.field.end.gravity',
  magicroom: 'battle.log.field.end.magicroom',
  wonderroom: 'battle.log.field.end.wonderroom',
  fairylock: 'battle.log.field.end.fairylock',
  mudsport: 'battle.log.field.end.mudsport',
  watersport: 'battle.log.field.end.watersport',
};

export function sideConditionTurns(state: BattleState, side: SideId, id: SideConditionId): number {
  return state.sides[side].sideConditions[id];
}

export function setSideCondition(
  state: BattleState,
  side: SideId,
  id: SideConditionId,
  turns = SIDE_CONDITION_TURNS[id],
): void {
  state.sides[side].sideConditions[id] = turns;
  pushText(state, SIDE_START[id], { name: state.sides[side].name });
}

export function setFieldCondition(
  state: BattleState,
  id: FieldConditionId,
  turns = FIELD_CONDITION_TURNS[id],
): void {
  state.field[id] = turns;
  pushText(state, FIELD_START[id]);
}

/** Decrements every side and field condition, announcing the ones that expire. */
export function tickConditions(state: BattleState): void {
  for (const side of SIDE_IDS) {
    const conditions = state.sides[side].sideConditions;
    for (const id of SIDE_CONDITION_IDS) {
      if (conditions[id] <= 0) continue;
      conditions[id] -= 1;
      if (conditions[id] === 0) pushText(state, SIDE_END[id]);
    }
  }
  for (const id of FIELD_CONDITION_IDS) {
    if (state.field[id] <= 0) continue;
    state.field[id] -= 1;
    if (state.field[id] === 0) pushText(state, FIELD_END[id]);
  }
}
