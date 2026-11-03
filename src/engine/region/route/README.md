# `src/engine/region/route/` — the long route generator

A route is two, three or four **screens** of one biome stitched into a single map
`ROUTE_WIDTH` (60) tiles wide and one of `ROUTE_HEIGHTS` (120, 160 or 200) tall
(`src/data/region.ts`), carved off `nodeStreams(seed, key).layout` and read off the
node's `edges` for its entry and exit bands. One carve for the whole route, no internal
transition, no interior door: every connection is plain floor on the map's own border.

## Layout

- `layout.ts` — the geometry off the plan: the route's screen count, its height, its one
  biome and one border opening per neighbour, plus the carver's spine split per screen.
- `layout.test.ts` — the screen stack, the opening set and its `N` entry, a forced screen
  count that moves nothing, the per-screen spine split, and the invalid key and count.
- `map.ts` — the single whole-route carve and the opening bands cut off the carver's own
  entry and exits, so a scene draws and walks one map.
- `map.test.ts` — the 60-wide stack at every height, the bands' reachability, the absence
  of stranded floor, the border and no-door rules, the tileset frames and a fixed seed's
  digest.
- `streams.ts` — the folder's re-export of a node's four streams, so the route's surface
  arrives from one place.
- `index.ts` — the barrel: the layout, the map and the streams, nothing else.
- `README.md` — this map.

## Rules

1. No Phaser import, no DOM and no `localStorage`; a rule that needs any of them belongs
   outside `src/engine/`.
2. Every draw comes off the node's `layout` stream, and exactly two of them: the screen
   count and the carve seed. Nothing else here rolls.
3. A route is one biome, one carve and one map — no room pipeline and no seam.
4. The carver is called once with the route's whole height; one slice per screen is not
   an option while an opening's border column cannot be forced.
5. Adding a module means adding its line here.
