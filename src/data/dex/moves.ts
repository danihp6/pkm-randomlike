import movesData from './moves.json';

export type MoveCategory = 'Physical' | 'Special' | 'Status';

/** Battle stats a move can raise or lower, with the accuracy/evasion pair. */
export type MoveBoosts = Readonly<
  Partial<Record<'atk' | 'def' | 'spa' | 'spd' | 'spe' | 'accuracy' | 'evasion', number>>
>;

export type MoveEffect = Readonly<{
  chance?: number;
  status?: string;
  volatileStatus?: string;
  boosts?: MoveBoosts;
  self?: MoveEffect;
}>;

export type Move = Readonly<{
  id: string;
  num: number;
  name: string;
  type: string;
  category: MoveCategory;
  basePower: number;
  accuracy: number | true;
  pp: number;
  priority: number;
  target: string;
  flags: Readonly<Record<string, number>>;
  critRatio: number;
  desc: string;
  shortDesc: string;
  /** OHKO moves (Fissure, Sheer Cold...); their power ignores the damage formula. */
  ohko?: boolean;
  /** Fixed-damage kind (`'level'`, ...), set on Seismic Toss and Night Shade. */
  damage?: string;
  drain?: readonly number[];
  recoil?: readonly number[];
  struggleRecoil?: boolean;
  multihit?: number | readonly number[];
  /** Set by the dex on the moves that roll accuracy on every hit (`multiaccuracy`). */
  multiaccuracy?: boolean;
  secondaries?: readonly MoveEffect[];
  self?: MoveEffect;
  boosts?: MoveBoosts;
  status?: string;
  volatileStatus?: string;
  weather?: string;
  terrain?: string;
  heal?: readonly number[];
  selfSwitch?: boolean | string;
  selfdestruct?: string;
  forceSwitch?: boolean;
  sideCondition?: string;
  pseudoWeather?: string;
  condition?: Readonly<Record<string, unknown>>;
}>;

// The generated JSON is cast once here; `dex.test.ts` guards the shape.
const ALL_MOVES = movesData as unknown as readonly Move[];

const BY_ID = new Map<string, Move>(ALL_MOVES.map((move) => [move.id, move]));

const BY_TYPE = new Map<string, Move[]>();
for (const move of ALL_MOVES) {
  const key = move.type.toLowerCase();
  const bucket = BY_TYPE.get(key);
  if (bucket) bucket.push(move);
  else BY_TYPE.set(key, [move]);
}

export function getMove(id: string): Move | undefined {
  return BY_ID.get(id.toLowerCase().replace(/[^a-z0-9]/g, ''));
}

export function allMoves(): readonly Move[] {
  return ALL_MOVES;
}

export function moveByType(type: string): readonly Move[] {
  return BY_TYPE.get(type.toLowerCase()) ?? [];
}

export function isDamaging(move: Move): boolean {
  return move.category !== 'Status';
}
