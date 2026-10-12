import {
  SIDE_IDS,
  pushText,
  type BattleState,
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

const SIDE_START: Readonly<Record<SideConditionId, (name: string) => string>> = {
  reflect: (name) => `${name} raised Reflect!`,
  lightscreen: (name) => `${name} raised Light Screen!`,
  auroraveil: (name) => `${name} raised Aurora Veil!`,
  tailwind: (name) => `The Tailwind blew from behind ${name}!`,
  luckychant: (name) => `${name} is cloaked in Lucky Chant!`,
  mist: (name) => `${name} became shrouded in mist!`,
  safeguard: (name) => `${name} became cloaked in a mystical veil!`,
};

const SIDE_END: Readonly<Record<SideConditionId, string>> = {
  reflect: 'Reflect wore off!',
  lightscreen: 'Light Screen wore off!',
  auroraveil: 'Aurora Veil wore off!',
  tailwind: 'The Tailwind petered out!',
  luckychant: 'The Lucky Chant wore off!',
  mist: 'The mist faded.',
  safeguard: 'The mystical veil disappeared.',
};

const FIELD_START: Readonly<Record<FieldConditionId, string>> = {
  trickroom: 'The dimensions were twisted!',
  gravity: 'Gravity intensified!',
  magicroom: 'It created a bizarre area in which held items lose their effects!',
  wonderroom: 'It created a bizarre area in which Defense and Sp. Def are swapped!',
  fairylock: 'Fairy Lock trapped all Pokémon on the field!',
  mudsport: 'Electricity is weakened!',
  watersport: 'Fire is weakened!',
};

const FIELD_END: Readonly<Record<FieldConditionId, string>> = {
  trickroom: 'The twisted dimensions returned to normal!',
  gravity: 'Gravity returned to normal!',
  magicroom: 'The bizarre area vanished!',
  wonderroom: 'The bizarre area vanished!',
  fairylock: 'The effects of Fairy Lock ended!',
  mudsport: 'The mud sport ended!',
  watersport: 'The water sport ended!',
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
  pushText(state, SIDE_START[id](state.sides[side].name));
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
