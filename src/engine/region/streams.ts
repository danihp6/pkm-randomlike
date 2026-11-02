import { hashSeed, Rng } from '../rng';

/**
 * The four streams a region node's generator reads (`docs/region-spec.md` §2, D60).
 * `layout` carves the map, `content` places what it holds, `encounters` rolls its
 * wilds and `loot` its ground items. Each is keyed by the node's own `nodeKey`, so
 * no node's stream depends on how many nodes precede it: walking back into a node
 * replays it, and appending one cannot move another (D11).
 */
export type NodeStreams = Readonly<{
  layout: Rng;
  content: Rng;
  encounters: Rng;
  loot: Rng;
}>;

export type NodeStreamPass = keyof NodeStreams;

/** The region's own stream, `${seed}:region`; the plan and the names split off it. */
export function regionStream(seed: string): Rng {
  return new Rng(hashSeed(`${seed}:region`));
}

/** One node's four streams, `${seed}:node:<key>:<pass>`. */
export function nodeStreams(seed: string, key: string): NodeStreams {
  return {
    layout: new Rng(hashSeed(`${seed}:node:${key}:layout`)),
    content: new Rng(hashSeed(`${seed}:node:${key}:content`)),
    encounters: new Rng(hashSeed(`${seed}:node:${key}:encounters`)),
    loot: new Rng(hashSeed(`${seed}:node:${key}:loot`)),
  };
}
