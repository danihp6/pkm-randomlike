import { getSpecies } from '../../data/dex/species';
import type { RunPokemon } from './progression';
import type { RunState } from './state';

/**
 * The party predicates the run rules ask of a member's **shape** (`D47`'s seam
 * family): what types, moves and abilities the party holds, so a gated room or a
 * special NPC can ask the party instead of a field move (`docs/maps-spec.md` §7).
 * Pure: no Phaser, no DOM, no RNG and no mutation.
 */

/**
 * One member's current types. A run member is a `FighterSnapshot`, which carries no
 * `types` field (`src/engine/battle/fighter.ts`); its types are its **species'**
 * own, the same values `createFighter` stamps from `getSpecies(speciesId).types`
 * (`src/data/dex/species.ts`). A battle-only forme (Mega, Transform, the room
 * condition's all-types field) never reaches the run: it is reverted before the
 * snapshot or the snapshot stores the base species. An unknown id has **no** types.
 */
export function memberTypes(member: RunPokemon): readonly string[] {
  return getSpecies(member.fighter.speciesId)?.types ?? [];
}

/**
 * True when at least one **party** member has any of `types`. The box is not asked
 * (`docs/maps-spec.md` §7: "some Pokémon of the party"). The comparison is
 * case-insensitive on both sides, so `'grass'` and `'Grass'` are the same type. An
 * empty list is `false`; a member's HP and status are irrelevant — a party member always
 * counts.
 */
export function partyHasType(run: RunState, types: readonly string[]): boolean {
  if (types.length === 0) return false;
  const wanted = new Set(types.map((type) => type.toLowerCase()));
  return run.party.some((member) => memberTypes(member).some((type) => wanted.has(type.toLowerCase())));
}

/**
 * True when a **party** member has any of `moveIds` equipped. Case-insensitive. The
 * box is not asked, an empty list is `false`, and a member at 0 HP still counts.
 */
export function partyHasMove(run: RunState, moveIds: readonly string[]): boolean {
  if (moveIds.length === 0) return false;
  const wanted = new Set(moveIds.map((moveId) => moveId.toLowerCase()));
  return run.party.some((member) =>
    member.fighter.moves.some((slot) => wanted.has(slot.moveId.toLowerCase())),
  );
}

/**
 * True when a **party** member has any of `abilityIds` as its ability. The box is
 * not asked, an empty list is `false`, and a member at 0 HP still counts.
 */
export function partyHasAbility(run: RunState, abilityIds: readonly string[]): boolean {
  if (abilityIds.length === 0) return false;
  const wanted = new Set(abilityIds.map((abilityId) => abilityId.toLowerCase()));
  return run.party.some((member) => wanted.has(member.fighter.ability.toLowerCase()));
}
