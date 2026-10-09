import { hashSeed, Rng } from '../rng';

/**
 * The RNG stream a map plan reads from (`docs/maps-spec.md` §3/§9). A plan is a
 * pure function of `(seed, mapIndex)` keyed `(seed, "map", mapIndex)`, exactly
 * like the per-route passes (`routes/streams.ts`): the biome, the room count, the
 * room sizes and every topology draw come off one stream, so a fixed seed always
 * reproduces the same floor.
 *
 * The stream is declared as a record even while it holds a single pass, so the
 * special-room rolls of a later step can join it without moving an existing draw.
 */
export type MapStreams = Readonly<{
  map: Rng;
}>;

export type MapStreamPass = keyof MapStreams;

export function mapStreams(seed: string, mapIndex: number): MapStreams {
  return {
    map: new Rng(hashSeed(`${seed}:map:${mapIndex}`)),
  };
}
