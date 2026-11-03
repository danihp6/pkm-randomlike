# `src/engine/region/interior/` — the building interior generator

Every door a settlement emits opens onto one small indoor map built from the building's
own key — `centre`, `gym`, `lab`, `casino`, `house` or `house:<n>` — and the settlement
it belongs to. A house, a laboratory, a casino or a Pokémon Centre is one room of
`INTERIOR_SIZE` tiles (`src/data/region.ts`); a gym is four rooms of `GYM_SIZE` in a
fixed order, joined by a door between each consecutive pair. The map is emitted in the
engine's own values, so this folder never learns about Phaser, the atlas or the screen.

## Layout

- `plan.ts` — the room generator: the key's kind, the ringed floor, the one return door,
  the furniture and host slots, and the gym's four joined rooms, all off the city
  sub-key's `layout` stream.
- `plan.test.ts` — the entry and its return, the slots per kind, the gym's four rooms and
  three inner doors, the two sizes, the flood fill, the tileset frames, a fixed seed's
  digest and the stream's own replay.
- `index.ts` — the barrel: it re-exports the generator only, so a later batch can lift
  it into the region barrel without editing this folder.
- `README.md` — this map: what a room is, the files here and the rules they keep.

## Rules

1. No Phaser import, no DOM and no `localStorage`: the plan is a map, a door and a slot
   list, and the scene does the drawing.
2. The geometry comes off the city node's `layout` sub-stream and nothing else: an
   interior replays on its own, no two interiors share a stream, and the city's own draws
   never move one (`D11`, `D60`).
3. Sizes live in `src/data/region.ts`; the room's own geometry (the ring, the 2×2 split,
   the counter run) lives here.
4. A slot is a position and a role. What stands there — an NPC, a trainer's roster, a
   shop's stock — is content, and belongs to another task.
5. Adding a module means adding its line here.
