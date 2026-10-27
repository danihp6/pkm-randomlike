import { getSpecies } from '../../data/dex/species';
import { memberAbilities, type RunPokemon } from './progression';
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
 * The types the player's **living** party repeats: a type is listed when at least
 * two members whose `fighter.hp > 0` share it, in party order, deduped. A fainted
 * member contributes nothing; the box is never read. `[]` for an empty party.
 */
export function livingTeamTypes(run: RunState): readonly string[] {
  const holders = new Map<string, number>();
  for (const member of run.party) {
    if (member.fighter.hp <= 0) continue;
    for (const type of new Set(memberTypes(member))) {
      holders.set(type, (holders.get(type) ?? 0) + 1);
    }
  }
  const repeated: string[] = [];
  for (const [type, count] of holders) if (count >= 2) repeated.push(type);
  return repeated;
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
 * True when a **party** member has any of `abilityIds`, either as its primary
 * ability or as the second one a sacrifice granted (`memberAbilities`). The box is
 * not asked, an empty list is `false`, and a member at 0 HP still counts.
 */
export function partyHasAbility(run: RunState, abilityIds: readonly string[]): boolean {
  if (abilityIds.length === 0) return false;
  const wanted = new Set(abilityIds.map((abilityId) => abilityId.toLowerCase()));
  return run.party.some((member) =>
    memberAbilities(member).some((ability) => wanted.has(ability.toLowerCase())),
  );
}
