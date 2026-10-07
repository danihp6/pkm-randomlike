import manifest from './anil/pokemon-sprites.json';

/**
 * The battle sprites are Pokemon Anil's (`public/anil/`), copied verbatim
 * from the RPG Maker XP / Pokemon Essentials fangame by
 * `scripts/anil/build-pokemon-sprites.mjs`, which also writes the manifest read
 * here. Every sheet is a horizontal filmstrip whose frames are squares of the
 * sheet's own height (`frames = width / height`), the layout Anil's own
 * "Pokemon Animados para DBK" plugin reads, so a species animates without a
 * per-species atlas. Local-only art — see `docs/art-direction.md`.
 */
export type PokemonSpriteKind = 'front' | 'back' | 'icon';

/** `[file, frameSize, frameCount]`, the tuple the packer writes. */
type Sheet = readonly [file: string, size: number, frames: number];

type Variant =
  | 'front'
  | 'back'
  | 'icon'
  | 'frontShiny'
  | 'backShiny'
  | 'iconShiny'
  | 'frontFemale'
  | 'backFemale'
  | 'iconFemale'
  | 'frontShinyFemale'
  | 'backShinyFemale'
  | 'iconShinyFemale';

/** The asset folder each variant draws from, under `src/assets/anil/`. */
const FOLDERS: Readonly<Record<Variant, string>> = {
  front: 'front',
  back: 'back',
  icon: 'icons',
  frontShiny: 'front-shiny',
  backShiny: 'back-shiny',
  iconShiny: 'icons-shiny',
  frontFemale: 'front',
  backFemale: 'back',
  iconFemale: 'icons',
  frontShinyFemale: 'front-shiny',
  backShinyFemale: 'back-shiny',
  iconShinyFemale: 'icons-shiny',
};

const FRAMES = manifest.frames as unknown as Readonly<Record<string, Partial<Record<Variant, Sheet>>>>;

/**
 * The sheets are served straight out of `public/anil/` rather than bundled: at
 * ~9600 files, one asset module per sheet bloats the entry chunk into megabytes,
 * and the game only ever needs the handful a battle draws.
 */
function sheetUrl(folder: string, file: string): string {
  return `${import.meta.env.BASE_URL}anil/${folder}/${file}`;
}

export type PokemonSpriteSheet = Readonly<{
  /** Phaser texture key: unique per file, so a shared sheet loads once. */
  textureKey: string;
  url: string;
  /** Frame side in pixels (the sheet's height). */
  size: number;
  /** Frames in the strip. */
  frames: number;
}>;

/** How a fighter looks, for the sprite variants Anil ships. */
export type PokemonLook = Readonly<{ shiny?: boolean; female?: boolean }>;

const BASE: Readonly<Record<PokemonSpriteKind, Variant>> = {
  front: 'front',
  back: 'back',
  icon: 'icon',
};

/** The variants to try, best match first; a missing one falls back a step. */
function variantsFor(kind: PokemonSpriteKind, look: PokemonLook): readonly Variant[] {
  const base = BASE[kind];
  const shiny = `${base}Shiny` as Variant;
  const female = `${base}Female` as Variant;
  const shinyFemale = `${base}ShinyFemale` as Variant;
  if (look.shiny && look.female) return [shinyFemale, shiny, female, base];
  if (look.shiny) return [shiny, base];
  if (look.female) return [female, base];
  return [base];
}

/**
 * The sheet a species draws with, or null when the manifest has no entry (an
 * unknown id). A forme the Anil set does not name resolves to its base species
 * at pack time, so the lookup is already fallback-complete.
 */
export function pokemonSprite(
  speciesId: string,
  kind: PokemonSpriteKind,
  look: PokemonLook = {},
): PokemonSpriteSheet | null {
  const entry = FRAMES[speciesId];
  if (!entry) return null;
  for (const variant of variantsFor(kind, look)) {
    const sheet = entry[variant];
    if (!sheet) continue;
    const folder = FOLDERS[variant];
    const [file, size, frames] = sheet;
    return { textureKey: `${folder}:${file}`, url: sheetUrl(folder, file), size, frames };
  }
  return null;
}

/** The looping idle animation key for a loaded sheet. */
export function pokemonIdleAnimKey(sheet: PokemonSpriteSheet): string {
  return `anil-idle:${sheet.textureKey}`;
}
