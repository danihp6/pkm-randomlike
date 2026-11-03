# `src/engine/region/` — the region's plan, its names and its streams

One run is one **region**: the starting town, the eight gym cities in badge order, one
long main route per stretch plus its optional laterals, the Victory Road, the League and
the endless tower. This folder holds the contract every later batch reads and nothing
that draws: the plan, the settlement names and the per-node streams. Pure by contract —
no Phaser, no DOM, no clock — and every random draw comes off the run seed (`D11`).

## Layout

- `index.ts` — the barrel: it re-exports `plan`, `names` and `streams` only, so the three
  generator folders can join without touching a shared file.
- `plan.ts` — the whole world out of the run seed: the spine, the laterals, and each node's
  key, kind, name, badge, cap, gym distance, position and edges (`planRegion`, `nodeKey`,
  `parseNodeKey`, `nodeOf`).
- `plan.test.ts` — the plan's invariants on eight seeds, the key round trip, the name
  stability and a fixed seed's plan digest.
- `names.ts` — the settlement names (`Adjective Noun`, unique per region) and a route's
  number.
- `names.test.ts` — the draw order, the uniqueness, the title case and the stability of the
  names.
- `streams.ts` — the region's own stream and a node's four (`layout`, `content`,
  `encounters`, `loot`), keyed by `nodeKey`.
- `streams.test.ts` — the stream keys, the replay and the fact no node's stream depends on
  another.
- `content.ts` — what a node holds: its NPCs, its special NPCs, its grass, its shops, its
  posted trainers and a lateral's point of interest, all off the node's `content` stream
  (`planNodeContent`, `PoiKind`, `ShopKind`, `POI_KINDS`).
- `content.test.ts` — the tier counts, the lateral-only POI, the replay and a fixed seed's
  content digest.
- `preload.ts` — one node resolved to everything a scene draws and walks: the plan names it, its
  own generator carves it, and it comes back as its tile map, its two frame meshes (the tiles'
  and the floor under them) and its spawn. It also holds the worker's request and reply and the
  resolver that answers one without throwing (`preloadNode`, `buildNodeMeshes`,
  `answerNodeRequest`, `NodeWorld`, `NodeMeshes`).
- `preload.test.ts` — a fixed seed's route mesh against the generator's own `buildFrameMesh`, the
  settlement's spawn and tileset, the nulls (unknown key, malformed key, no generator yet) and the
  worker reply's shape.
- `route/` — the long route generator; its README holds the folder until its batch lands.
- `city/` — the settlement generator; its README holds the folder until its batch lands.
- `interior/` — the building-interior generator; its README holds the folder until its
  batch lands.
- `gym/` — the gym's puzzle stack and the rooms it fills; its README holds the folder.

## Rules

1. No Phaser import, no DOM and no `localStorage`; a rule that needs any of them belongs
   outside `src/engine/`.
2. Every draw comes from a stream split from the run seed, never `Math.random()`.
3. No node's stream depends on how many nodes precede it (`D60`): a node replays alone.
4. Sizes, caps, building counts and name lists live in `src/data/region.ts`; an engine file
   never hard-codes one.
5. Adding a module means adding its line here.
