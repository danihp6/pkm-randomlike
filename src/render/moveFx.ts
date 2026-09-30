/**
 * Move-effect animation registry (D20). The rows of `src/assets/moves.png` are
 * shipped by the donor project's `extract-move-fx.mjs`, which keeps its
 * `MOVE_FX_ROWS` list in this order; the frame counts below are measured from
 * the committed atlas (trailing blank frames of a strip are trimmed) by
 * `moveFxFrameCounts.test.ts`, so a re-extract cannot silently shift them.
 *
 * A move picks a row by animation archetype, never per move id: a burned body,
 * a poison cloud, contact sparks and a rock drop each cover a family of moves.
 */
export type MoveFxId = 'ember' | 'cross_poison' | 'poison_gas' | 'fire_punch' | 'rock_slide' | 'ancient_power';

export const MOVE_FX_TEXTURE_KEY = 'fx:moves';
export const MOVE_FX_FRAME_SIZE = 32;
export const MOVE_FX_COLUMNS = 18;
/** Asset row per fx id; the order `extract-move-fx.mjs` writes the atlas in. */
export const MOVE_FX_ROW: Readonly<Record<MoveFxId, number>> = {
  ember: 0,
  cross_poison: 1,
  poison_gas: 2,
  fire_punch: 3,
  rock_slide: 4,
  ancient_power: 5,
};
export const MOVE_FX_FRAMES: Readonly<Record<MoveFxId, number>> = {
  ember: 6,
  cross_poison: 18,
  poison_gas: 13,
  fire_punch: 12,
  rock_slide: 5,
  ancient_power: 11,
};

/**
 * The move's own animation archetype: the burn body (Ember burns, Fire Punch
 * hits) and the Poison Gas cloud must beat the plain type beat, so they come
 * first in the chain; everything else falls back to its type.
 */
export function moveFxFor(moveId: string, type: string, flags: Readonly<Record<string, number>>): MoveFxId {
  if (moveId === 'ember') return 'ember';
  if (type === 'Fire') return flags['punch'] ? 'fire_punch' : 'ember';
  if (moveId === 'poisongas' || moveId === 'poisonpowder') return 'poison_gas';
  if (type === 'Poison') return 'cross_poison';
  if (type === 'Rock') return 'rock_slide';
  if (type === 'Ground') return 'ancient_power';
  if (type === 'Flying') return 'cross_poison';
  if (type === 'Water') return 'ancient_power';
  if (type === 'Electric') return 'ember';
  if (type === 'Ice') return 'ancient_power';
  if (type === 'Grass') return 'poison_gas';
  if (type === 'Psychic') return 'ember';
  if (type === 'Ghost') return 'ember';
  if (type === 'Dragon') return 'ember';
  if (type === 'Dark') return 'cross_poison';
  if (type === 'Fairy') return 'ancient_power';
  if (type === 'Fighting') return 'fire_punch';
  if (type === 'Bug') return 'poison_gas';
  if (type === 'Steel') return 'rock_slide';
  return 'ember';
}

/** Every fx row, in atlas order. */
export const MOVE_FX_IDS: readonly MoveFxId[] = [
  'ember',
  'cross_poison',
  'poison_gas',
  'fire_punch',
  'rock_slide',
  'ancient_power',
];

/** Playback rate for a strip; the donor art reads at roughly a dozen-plus fps. */
export const MOVE_FX_FRAME_RATE = 24;

/** The Phaser animation key for an fx strip, created once the atlas is loaded. */
export function moveFxAnimKey(fx: MoveFxId): string {
  return `move-fx:${fx}`;
}

/** The atlas frame for a strip frame: row-major, one strip per atlas row. */
export function moveFxFrame(fx: MoveFxId, frame: number): number {
  const row = MOVE_FX_ROW[fx];
  const index = ((frame % MOVE_FX_FRAMES[fx]) + MOVE_FX_FRAMES[fx]) % MOVE_FX_FRAMES[fx];
  return row * MOVE_FX_COLUMNS + index;
}

/** The atlas frame range for a strip, for `generateFrameNames`-style consumers. */
export function moveFxFrames(fx: MoveFxId): readonly number[] {
  return Array.from({ length: MOVE_FX_FRAMES[fx] }, (_, frame) => moveFxFrame(fx, frame));
}

export type MoveFxTrack = Readonly<{ fx: MoveFxId; frames: readonly number[] }>;

export type MoveFxKind = 'damage' | 'status';

/**
 * The animation for a move event's message: a damaging move plays its archetype
 * scaled by how effective the hit was; a status move plays the cloud beat only
 * for the moves that announce one.
 */
export function moveFxTrack(
  kind: MoveFxKind,
  fx: MoveFxId,
  options: Readonly<{ effectiveness?: number; status?: boolean }> = {},
): MoveFxTrack | null {
  const frames = moveFxFrames(fx);
  if (kind === 'status') {
    return options.status ? { fx, frames } : null;
  }
  const effectiveness = options.effectiveness ?? 1;
  if (effectiveness <= 0) return null;
  const full = effectiveness > 1;
  return { fx, frames: full ? frames : frames.slice(0, Math.min(5, frames.length)) };
}
