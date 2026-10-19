# `src/scenes/rooms/` — the special-room descriptors

One module per special room kind (`MapRoomSpecial`): what the room places, how it answers the
interact key, what its window looks like and which minimap marker it draws. `RouteScene` collects
them once through its `import.meta.glob` registry and hands the room a `RoomHost`; the scene keeps
the keyboard slot, the counter tile and the route, and the room owns its own content.

## Layout

- `types.ts` — the descriptor surface: the fixture a room adds to the route, the modal panel it
  opens, the hooks it reaches the scene through and the four optional descriptor fields.
- `registry.ts` — the folder's collector: one descriptor per kind from the module map, the
  duplicate-kind error and the marker index the minimap reads.
- `registry.test.ts` — the collection rules: discovery, a kind the folder never had, the duplicate
  error's message and the modules without a descriptor export.
- `shop.ts` — the Mart room: its counter, its stock, its BUY / SELL window and its keys.
- `miniBoss.ts` — the mini-boss room: its `ace` trainer on the room's farthest tile.
- `megaStone.ts` — the mega-stone room: its one Mega Stone on the room's farthest tile.
- `casino.ts` — the casino room: its slot machine, the grunt beside it, the spin
  window and the `rocket` fight a spin may roll.
- `casino.test.ts` — the casino's own surface: the counter, the window's rows and
  spin path (including the grunt call after the panel closes) and the marker.
- `fixtures.test.ts` — the shipped rooms' fixtures, pinned by id, tile and (for the stone)
  the exact item the fixed seed rolls.

## Rules

1. A new room kind is a new file here that exports `descriptor`; the scene is not edited. It also
   needs its `MapRoomSpecial` value and its `docs/maps-spec.md` §7 row.
2. A descriptor never touches the scene's internals: it draws through `host.scene` and mutates the
   run only through `host.commitRun`, so the folder stays testable headless.
3. A room's ids are stable per floor (`miniBossTrainerId`, `megaStoneItemId`), so a revisit finds
   the room it left behind and a beaten trainer stays beaten.
