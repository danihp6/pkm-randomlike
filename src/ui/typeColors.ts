/**
 * The canon Pokémon type colours, shared by every UI that colour-codes a type
 * (the party detail chips, the battle move grid). Kept pure and free of Phaser
 * so both the route and the battle read the same palette. These are *content*
 * tones — a type badge's own colour — so they stay off the glass chrome's own
 * tokens; the ink drawn on them is `FRLG_BADGE_INK`.
 */

const TYPE_COLORS: Readonly<Record<string, number>> = {
  normal: 0xa8a878,
  fire: 0xf08030,
  water: 0x6890f0,
  electric: 0xf8d030,
  grass: 0x78c850,
  ice: 0x98d8d8,
  fighting: 0xc03028,
  poison: 0xa040a0,
  ground: 0xe0c068,
  flying: 0xa890f0,
  psychic: 0xf85888,
  bug: 0xa8b820,
  rock: 0xb8a038,
  ghost: 0x705898,
  dragon: 0x7038f8,
  dark: 0x705848,
  steel: 0xb8b8d0,
  fairy: 0xee99ac,
};

/** The type's canonical colour, or a neutral grey for an unknown type. */
export function typeColor(type: string): number {
  return TYPE_COLORS[type.toLowerCase()] ?? 0x9aa0b4;
}
