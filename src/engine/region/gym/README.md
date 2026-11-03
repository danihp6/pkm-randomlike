# `src/engine/region/gym/` — the gym's puzzle: the stack, the ice room, the plan

A gym is four rooms, and its third one is a puzzle (`docs/region-spec.md` §7.4). This
folder holds the puzzle stack's accessors, one module per puzzle's geometry and rule, and
the gym plan that joins them to the interior generator. Pure by contract — no Phaser, no
DOM, no clock — and every draw comes off the gym's own sub-stream (`D11`, `D60`). Nothing
here draws, mutates the run or owns a scene: the gym screen of a later batch reads it.

## Layout

- `ice.ts` — the ice room: the cells of an ice floor, the holes and where they land, and
  the slide rule one step obeys, with no draw of its own.
- `ice.test.ts` — the slide on a hand-built floor in all four directions, a blocked step,
  a hole midway and a hole first; the planned floor's size, ring, hole count, landings,
  hole sites, replay and the floor too small to hold its holes.
- `stack.ts` — the stack accessors: the entries a gym of a badge may carry, in table
  order, and the stack's ids.
- `stack.test.ts` — the badge-1 start, the empty answer below the first badge, the prefix
  property on every badge, and the id list.
- `plan.ts` — the gym plan: the four rooms from the interior generator, the stack entry
  the node's badge rolls, the ice floor it lays, the solved key and the read of a run's
  marks.
- `plan.test.ts` — the rooms, the rolled entry, the floor against the puzzle room, the
  refused keys, the replay and a fixed seed's digest, the untouched content stream and the
  solved flag.
- `index.ts` — the barrel: it re-exports the three modules above, so a caller imports the
  folder and the region barrel stays untouched.
- `README.md` — this map: what a gym puzzle is, the files here and the rules they keep.

## Rules

1. No Phaser import, no DOM and no `localStorage`: a puzzle is geometry and a rule, and
   the scene does the drawing.
2. The stack is data (`src/data/puzzles.ts`); the numbers a gym rolls — the badge, the
   hole count, the room a hole drops into — come from that row and the plan, never from a
   constant here.
3. A new puzzle is a new stack row plus its own module; a shipped module never branches
   on another puzzle's id.
4. The entry is rolled off `<cityKey>/gym` and the floor off `<cityKey>/gym/puzzle`, so a
   gym cannot move the city's content draws and a revisit replays the same room.
5. A solved gym is one `pickedItems` key (`gym-solved:<cityKey>`) read off the run, never
   a regenerated flag.
6. Adding a module means adding its line here.
