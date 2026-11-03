# `src/engine/region/city/` — the settlement generator

A settlement is one tile square laid out as a street grid of blocks: one plaza with the
spawn at its centre, one grass corner in the bottom-right block, and a building on each of
the lots it needs — a city's Centre, its gym, its laboratory and, from badge 3, its casino,
then its houses. The starting town runs the same generator with a laboratory and one house
and no Centre. Sizes and building counts come from the city ladder and the town's own row
in `src/data/region.ts`; the map is carved off the node's `layout` stream and nothing else.

## Layout

- `index.ts` — the barrel: it re-exports `plan.ts` and nothing else, and it is not wired
  into the region's own barrel.
- `plan.ts` — the whole settlement off the run seed: the square, the street grid, the plaza
  and its spawn, the grass corner, the buildings with their doors and interior keys, one
  border exit band per neighbour, the types the city screen and the interior generator
  read, and the refusal of a key that is not a settlement.
- `plan.test.ts` — the plan's own invariants on eight seeds: the size and the building count
  of every tier, the Centre, the gym and the laboratory, every door and its street, the
  bands' reachability from the spawn, the grass corner, the town, every cell resolving in the
  city tileset, a fixed seed's nine settlement digests and the non-settlement refusal.
- `README.md` — this map.

## Rules

1. No Phaser import, no DOM and no `localStorage`; the generator is headless or it belongs
   outside `src/engine/`.
2. Every draw comes off the node's `layout` stream, in the generator's one fixed order
   (the lots' shuffle, then each door's column), so no other pass can move a wall.
3. The map holds engine map values, never atlas frames, and a door's north neighbour is
   always `PATH` so every building is reachable.
4. A size or a building count is read from `src/data/region.ts`; the geometry constants
   (ring, street pitch, street width, block, building, band) live beside the generator.
5. Adding a module means adding its line here.
