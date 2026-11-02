# `src/engine/region/route/` — the long route generator

A route is two to four screens of one biome stitched into a single map `ROUTE_WIDTH`
tiles wide and one of `ROUTE_HEIGHTS` tall (`src/data/region.ts`), carved off
`nodeStreams(seed, key).layout` and read off the node's `edges` for its entry and exit
bands. Nothing lives here yet: the generator itself (`layout.ts`, `map.ts`, `streams.ts`,
`index.ts`) lands with its own task, and this README holds the folder until then.
