import { getSpecies } from '../../data/dex';
import type { FighterSnapshot } from '../battle/fighter';
import { updatePokemon, type RunState } from './state';

/**
 * Nicknames (Phase 4): the player's own name for a run member, kept beside the
 * battle's `fighter.name` so no forme change can rewrite it. Pure, like the rest
 * of the run (`D11`): the sanitiser and the run edit draw no randomness and touch
 * no storage.
 */

/** The longest nickname the field, the panel and the classic games allow. */
export const NICKNAME_MAX_LENGTH = 12;

/** Whitespace runs and control characters collapse into one space. */
const SEPARATOR = /[\s\u0000-\u001f\u007f-\u009f]+/g;

/**
 * The one sanitiser, used by the scene on every confirm: control characters and
 * whitespace runs become a single space, the result is trimmed, truncated to
 * `NICKNAME_MAX_LENGTH` **code points** (never a lone surrogate), and an empty
 * result is null - which is how a nickname is cleared.
 */
export function normalizeNickname(input: string): string | null {
  const collapsed = input.replace(SEPARATOR, ' ').trim();
  if (collapsed.length === 0) return null;
  const points = Array.from(collapsed);
  return points.length > NICKNAME_MAX_LENGTH ? points.slice(0, NICKNAME_MAX_LENGTH).join('') : collapsed;
}

/** The snapshot without a nickname; the field is optional, so clearing omits it. */
function withoutNickname(fighter: FighterSnapshot): FighterSnapshot {
  const { nickname: _cleared, ...rest } = fighter;
  return rest;
}

/**
 * Names a party or box member, or clears its name with `null`. A miss, or a name
 * that only repeats the species name (case-insensitively, the classic rule), leaves
 * the member unnamed. Pure: a new `RunState`, or the same one when nothing changed.
 */
export function renameMember(run: RunState, memberId: string, nickname: string | null): RunState {
  const member =
    run.party.find((entry) => entry.fighter.id === memberId) ??
    run.box.find((entry) => entry.fighter.id === memberId);
  if (!member) return run;

  const speciesName = getSpecies(member.fighter.speciesId)?.name;
  const cleaned = nickname === null ? null : normalizeNickname(nickname);
  const next =
    cleaned !== null && speciesName !== undefined && cleaned.toLowerCase() === speciesName.toLowerCase()
      ? null
      : cleaned;
  if ((member.fighter.nickname ?? null) === next) return run;

  const fighter: FighterSnapshot =
    next === null
      ? withoutNickname(member.fighter)
      : { ...withoutNickname(member.fighter), nickname: next };
  return updatePokemon(run, { ...member, fighter });
}
