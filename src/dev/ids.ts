/**
 * Ids for the Pokémon the dev panel drops into a run. Kept in its own tiny
 * module so the route scene can use it without pulling the whole DOM debug menu
 * into a production bundle.
 */

/**
 * The id for a dev-added Pokémon: `debug:<species>:<n>`, where `n` is the
 * smallest counter above `from` that no live member already uses. The counter is
 * scene state and resets on a reload, so the uniqueness scan — not the counter —
 * is what stops a re-added species from colliding with the one saved before,
 * which made the editor and `updatePokemon` hit every member with that id.
 */
export function nextDebugPokemonId(
  speciesId: string,
  used: Iterable<string>,
  from = 0,
): Readonly<{ id: string; counter: number }> {
  const taken = new Set(used);
  let counter = Math.max(0, Math.floor(from));
  let id: string;
  do {
    counter += 1;
    id = `debug:${speciesId}:${counter}`;
  } while (taken.has(id));
  return { id, counter };
}
