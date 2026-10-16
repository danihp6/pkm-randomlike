import indexManifest from '../assets/pokemon/index.json';

/**
 * The party's overworld art (`[Task-76]`): one 5-row, 32px-cell sheet per species
 * (`src/assets/pokemon/<fileId>.png` + `<fileId>.json`), indexed by
 * `src/assets/pokemon/index.json`. The route resolves the party's lead through
 * `pokemonOverworldSheet` and loads the pair only when the lead changes, so a boot
 * never pays for the whole set. Local-only art — see `docs/art-direction.md`.
 */

/** The five direction rows a pair carries, in the sheet's own top-to-bottom order. */
export type PokemonOverworldDirRow = 'down' | 'downright' | 'up' | 'upright' | 'left';

/** The pair's own animation slots. */
export type PokemonOverworldAnimId = 'idle' | 'walk' | 'attack' | 'special' | 'hurt';

export interface PokemonOverworldAnim {
  /** The pair manifest's `start`: a row-0 column offset, not a flat frame index. */
  readonly start: number;
  readonly count: number;
  readonly durationsMs: readonly number[];
  readonly hitFrame?: number;
}

export interface PokemonOverworldSheet {
  /** The dex id the manifest keys on. */
  readonly speciesId: string;
  /** The numeric file id of the committed pair (`<fileId>.png` + `<fileId>.json`). */
  readonly fileId: number;
  /** The Phaser texture key the sheet must be registered under: `pokemon:<fileId>`. */
  readonly textureKey: string;
  /** The committed PNG's URL, for `this.load.spritesheet`. */
  readonly url: string;
  /** The frame cell size in px — the manifest's `sprite` (32). */
  readonly size: number;
  /** The direction row count — the manifest's `rows` (5). */
  readonly rows: number;
  /** The sheet's column count — the pair manifest's `cols`. */
  readonly cols: number;
  /** The direction rows in the sheet's own order — the manifest's `dirRows`. */
  readonly dirRows: readonly PokemonOverworldDirRow[];
  /** The five animation blocks exactly as the pair manifest carries them. */
  readonly anims: Readonly<Record<PokemonOverworldAnimId, PokemonOverworldAnim>>;
}

/** The coverage manifest, cast to a typed local shape as `portraits.ts` does. */
type OverworldIndex = Readonly<{
  sprite: number;
  rows: number;
  dirRows: readonly PokemonOverworldDirRow[];
  files: Readonly<Record<string, number>>;
  missing: readonly string[];
}>;

const INDEX = indexManifest as unknown as OverworldIndex;

const PNG_URLS = import.meta.glob('../assets/pokemon/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as unknown as Readonly<Record<string, string>>;

const PAIR_MANIFESTS = import.meta.glob('../assets/pokemon/*.json', {
  eager: true,
  import: 'default',
}) as unknown as Readonly<Record<string, unknown>>;

const ANIM_IDS: readonly PokemonOverworldAnimId[] = ['idle', 'walk', 'attack', 'special', 'hurt'];

/** The manifest's own frame cell size, read from `index.json` (32). */
export const POKEMON_OVERWORLD_SPRITE: number = INDEX.sprite;
/** The manifest's own direction row count (5). */
export const POKEMON_OVERWORLD_ROWS: number = INDEX.rows;
/** The manifest's own direction rows, in the sheet's order. */
export const POKEMON_OVERWORLD_DIR_ROWS: readonly PokemonOverworldDirRow[] = INDEX.dirRows;

/** The Phaser texture key a pair is registered under. */
export function pokemonOverworldTextureKey(fileId: number): string {
  return `pokemon:${fileId}`;
}

/** One `anims` block, or null when it lacks a numeric `start` / `count`. */
function readAnim(block: unknown): PokemonOverworldAnim | null {
  if (typeof block !== 'object' || block === null) return null;
  const record = block as Readonly<Record<string, unknown>>;
  if (typeof record.start !== 'number' || typeof record.count !== 'number') return null;
  const durationsMs = Array.isArray(record.durationsMs)
    ? record.durationsMs.filter((value): value is number => typeof value === 'number')
    : [];
  const anim: PokemonOverworldAnim = { start: record.start, count: record.count, durationsMs };
  return typeof record.hitFrame === 'number' ? { ...anim, hitFrame: record.hitFrame } : anim;
}

/** The five animation blocks a pair carries, or null when one is malformed. */
function readAnims(
  manifest: Readonly<Record<string, unknown>>,
): Readonly<Record<PokemonOverworldAnimId, PokemonOverworldAnim>> | null {
  const blocks = manifest.anims;
  if (typeof blocks !== 'object' || blocks === null) return null;
  const source = blocks as Readonly<Record<string, unknown>>;
  const anims = {} as Record<PokemonOverworldAnimId, PokemonOverworldAnim>;
  for (const id of ANIM_IDS) {
    const anim = readAnim(source[id]);
    if (!anim) return null;
    anims[id] = anim;
  }
  return anims;
}

/**
 * The committed pair for a species id, or null: null for an id the manifest lists
 * in `missing` and for an id the manifest does not carry at all (an unknown or
 * Mega-only id).
 */
export function pokemonOverworldSheet(speciesId: string): PokemonOverworldSheet | null {
  if (INDEX.missing.includes(speciesId)) return null;
  const fileId = INDEX.files[speciesId];
  if (fileId === undefined) return null;
  const manifest = PAIR_MANIFESTS[`../assets/pokemon/${fileId}.json`];
  const url = PNG_URLS[`../assets/pokemon/${fileId}.png`];
  if (typeof manifest !== 'object' || manifest === null || url === undefined) return null;
  const record = manifest as Readonly<Record<string, unknown>>;
  if (typeof record.cols !== 'number') return null;
  const anims = readAnims(record);
  if (!anims) return null;
  return {
    speciesId,
    fileId,
    textureKey: pokemonOverworldTextureKey(fileId),
    url,
    size: INDEX.sprite,
    rows: INDEX.rows,
    cols: record.cols,
    dirRows: INDEX.dirRows,
    anims,
  };
}

/**
 * The atlas frame index of step `step` of `anim` in direction row `row`:
 * `row * sheet.cols + anims[anim].start + step`. `step` is clamped into
 * `0 … count - 1`; a `row` outside `0 … rows - 1` returns `-1` (a caller that gets
 * `-1` draws nothing).
 */
export function pokemonOverworldFrame(
  sheet: PokemonOverworldSheet,
  anim: PokemonOverworldAnimId,
  row: number,
  step: number,
): number {
  if (row < 0 || row >= sheet.rows) return -1;
  const block = sheet.anims[anim];
  const clamped = Math.max(0, Math.min(block.count - 1, Math.floor(step)));
  return row * sheet.cols + block.start + clamped;
}
