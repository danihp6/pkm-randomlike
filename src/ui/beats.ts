import type { RunPokemon } from '../engine/run';

/**
 * Battle presentation beats (Phase 5). The capture and move-FX beats already
 * live in `capture.ts`/`render/moveFx.ts`; these are the three the scene still
 * lacked: the faint drop, the switch in/out and the level-up flourish. The
 * timings are here, not in the scene, so the beats read as data.
 */

/** The defeated Pokémon sinks under its platform and fades out. */
export const FAINT_DROP = 46;
export const FAINT_MS = 420;

/** Switching out is a withdraw (shrink + fade); switching in pops back. */
export const SWITCH_SHRINK = 0.3;
export const SWITCH_RECALL_MS = 220;
export const SWITCH_SENDOUT_MS = 280;

export type LevelUpBeat = Readonly<{
  /** The run member's id, so the HUD finds the row to animate. */
  id: string;
  fromLevel: number;
  toLevel: number;
  /** The species it evolved into, or null when it kept its species. */
  evolvedInto: string | null;
  learned: readonly string[];
  forgotten: readonly string[];
}>;

/**
 * The level-up beats for a party: what changed for each member between the run
 * before the battle and the run after `resolveBattle`. A member that gained
 * only XP, a released Pokémon and a fresh catch (a new id) produce nothing, so
 * the route HUD animates exactly the rows that levelled.
 */
export function levelUpBeats(
  before: readonly RunPokemon[],
  after: readonly RunPokemon[],
): LevelUpBeat[] {
  const previous = new Map(before.map((member) => [member.fighter.id, member]));
  const beats: LevelUpBeat[] = [];
  for (const member of after) {
    const old = previous.get(member.fighter.id);
    if (!old || member.fighter.level <= old.fighter.level) continue;
    const moves = member.fighter.moves.map((slot) => slot.moveId);
    const oldMoves = old.fighter.moves.map((slot) => slot.moveId);
    beats.push({
      id: member.fighter.id,
      fromLevel: old.fighter.level,
      toLevel: member.fighter.level,
      evolvedInto: member.fighter.speciesId === old.fighter.speciesId ? null : member.fighter.speciesId,
      learned: moves.filter((moveId) => !oldMoves.includes(moveId)),
      forgotten: oldMoves.filter((moveId) => !moves.includes(moveId)),
    });
  }
  return beats;
}

/** Which opening to play: a wild encounter or a trainer's. */
export type EntryKind = 'wild' | 'trainer';

export type EntryStepKind = 'fade' | 'flash' | 'foe-appear' | 'trainer-appear' | 'sendout';

/** One step of the opening beat. The scene plays it and waits `ms` before the next. */
export type EntryStep = Readonly<{ kind: EntryStepKind; ms: number }>;

export const ENTRY_FADE_MS = 320;
export const ENTRY_FLASH_MS = 220;
export const ENTRY_FOE_APPEAR_MS = 300;
export const ENTRY_TRAINER_APPEAR_MS = 280;
export const ENTRY_SENDOUT_MS = 260;
/** How far above its resting y the incoming enemy sprite starts, in px. */
export const ENTRY_FOE_DROP = 26;
/** How far right of its resting x the trainer starts its walk, in px. */
export const ENTRY_TRAINER_WALK = 22;

/**
 * The opening beat for a battle, with the flash dropped under reduce flashing
 * (D45). The fade carries the route-to-battle cut and is always first; the rest
 * of the beat differs only in who the encounter brings in.
 */
export function entryBeat(kind: EntryKind, reducedFlash: boolean): readonly EntryStep[] {
  const steps: EntryStep[] = [{ kind: 'fade', ms: ENTRY_FADE_MS }];
  if (!reducedFlash) steps.push({ kind: 'flash', ms: ENTRY_FLASH_MS });
  if (kind === 'wild') {
    steps.push({ kind: 'foe-appear', ms: ENTRY_FOE_APPEAR_MS });
    return steps;
  }
  steps.push(
    { kind: 'trainer-appear', ms: ENTRY_TRAINER_APPEAR_MS },
    { kind: 'sendout', ms: ENTRY_SENDOUT_MS },
  );
  return steps;
}
