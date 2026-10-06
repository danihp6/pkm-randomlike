/**
 * The canon Pokémon type colours, shared by every UI that colour-codes a type
 * (the party detail chips, the battle move grid). Kept pure and free of Phaser
 * so both the route and the battle read the same palette.
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

/**
 * `typeColor` blended toward white by `amount` (0 = the colour, 1 = white), so a
 * type chip can sit behind dark text without losing its identity.
 */
export function typeTint(type: string, amount: number): number {
  const color = typeColor(type);
  const mix = (channel: number): number => Math.round(channel + (255 - channel) * amount);
  const r = mix((color >> 16) & 0xff);
  const g = mix((color >> 8) & 0xff);
  const b = mix(color & 0xff);
  return (r << 16) | (g << 8) | b;
}
