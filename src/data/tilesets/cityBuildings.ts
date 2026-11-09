import placeholderUrl from '../../assets/placeholders/frlg/city-buildings.png';
import { packedAtlasUrl } from '../../assets/optional';
import type { BuildingKind } from '../../engine/region/city/plan';
import manifest from '../frlg/city-buildings.json';

const CITY_BUILDING_ATLASES = import.meta.glob('../../assets/frlg/city-buildings.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Readonly<Record<string, string>>;

/**
 * The settlement buildings atlas: one whole-house sprite per `BuildingKind`,
 * packed by `scripts/frlg/build-city-buildings.mjs` from the buildings
 * compendium `sprite-sources/frlg/tileset-1.png` (`docs/tileset-spec.md` §2b).
 * The city screen draws one frame over a building's 5x6 footprint, and the plan
 * puts the walkable `DOOR` tile on the frame's own door column. Local-only art —
 * see `docs/art-direction.md`.
 */
export const CITY_BUILDINGS_TEXTURE_KEY = 'frlg:city-buildings';
/** One frame in the map's 16 px units: 5 tiles wide by 6 tall. */
export const CITY_BUILDING_W = 80;
export const CITY_BUILDING_H = 96;
export const CITY_BUILDING_COLS = 4;
export const CITY_BUILDING_ROWS = 1;
export const CITY_BUILDINGS_ATLAS_URL: string = packedAtlasUrl(
  CITY_BUILDING_ATLASES,
  '../../assets/frlg/city-buildings.png',
  placeholderUrl,
);

export type CityBuildingSprite = Readonly<{
  kind: BuildingKind;
  /** The door's tile column inside the frame, 0..4. */
  door: number;
}>;

export const CITY_BUILDING_SPRITES: readonly CityBuildingSprite[] = manifest.frames.map((frame) => ({
  kind: frame.kind as BuildingKind,
  door: frame.door,
}));

/** The frame's own width in tiles: the door column a manifest entry names. */
const FRAME_TILES_WIDE = 5;

/** Every frame whose door column is inside the frame, with its atlas index. */
const DRAWABLE: readonly (CityBuildingSprite & Readonly<{ frame: number }>)[] =
  CITY_BUILDING_SPRITES.map((sprite, frame) => ({ ...sprite, frame })).filter(
    (sprite) => Number.isInteger(sprite.door) && sprite.door >= 0 && sprite.door < FRAME_TILES_WIDE,
  );

/**
 * The frame a building of `kind` draws: the frames the manifest gives that kind,
 * wrapped by `index` so the house kind can carry more than one variant, and the
 * first house frame for a kind the atlas does not carry (the casino). A frame
 * whose door column is outside the frame is never answered.
 */
export function buildingFrameFor(kind: BuildingKind, index: number): number {
  const own = DRAWABLE.filter((sprite) => sprite.kind === kind);
  const houses = DRAWABLE.filter((sprite) => sprite.kind === 'house');
  const frames = own.length > 0 ? own : houses.length > 0 ? houses : DRAWABLE;
  if (frames.length === 0) return 0;
  const wrapped = ((Math.trunc(index) % frames.length) + frames.length) % frames.length;
  return frames[wrapped].frame;
}
