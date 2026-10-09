# PokeRandomLike — Design Spec

Gameplay source of truth. If this file and the code disagree, this file wins and
the code is the bug (unless a `D##` in `docs/tech-decisions.md` supersedes it).

## 1. Pitch

A browser Pokémon roguelike. You walk a procedural **route** with a starter and
catch one Pokémon per route the classic way. Trainers on the map see you and
open the menu battle; tall grass rolls wild encounters. Every Pokémon you lose
is lost **forever**. When your last Pokémon falls, the run ends and nothing
carries over.

## 2. The run

- The game opens on a **main menu**: **New run**, **Continue** (only when the save
  holds a run with a living party, and it shows the route it is on) and
  **Options** (the settings screen). Starting a new run only replaces the saved
  one once its starter is picked, so cancelling at the starter pick returns to
  the menu with the run in progress intact.
- A run is a chain of **maps**, and a map is a short chain of **routes** (our
  word for the floors). Each route is a small top-down map: walls/trees, tall
  grass, trainers, items, an exit. A map shares one **biome**, one **level
  range** and its route **sizes**, and its last route holds the **boss**; beating
  the boss opens a **portal** to the next map (`docs/maps-spec.md`).
- Routes match their neighbours: a route's exit edge is the next route's entry
  edge, opposite it, so the chain reads as one continuous path. A straight
  passage between two routes is the **corridor** shape — one entry, one exit, no
  branches.
- The chain is fixed-length by default (see `docs/routes-spec.md`): a
  **mini-boss** every few routes, a **boss** to close each block, a **final
  boss** at the end. An **infinite mode** reuses the same generator without the
  finish line.
- A run is defined by one **seed**: the starter screen shows it as a share
  string and `S` opens a prompt to type a seed or paste a friend's share string,
  so the same seed always plays the same run (`D11`, `D21`). The share string
  carries the seed and the mode, not the progress, so a shared run starts on
  route 1.
- Beating a route's exit moves you to the next route, with a healing stop in
  between (heals HP and PP, never resurrects).
- Losing every Pokémon in the party ends the run.

## 3. The party

- Up to **6** Pokémon in the active party; extras go to the **PC box**.
- The party and the PC box are managed outside battle from the route HUD
  (`I` / `P`): drag a member within the party or the box to reorder it, or
  across the two panels to move it between them. Dropping a member **onto** a
  member of the other panel **swaps** the two, so a boxed Pokémon can replace a
  party member even when the party is full (the one it replaces takes the box
  slot). A plain **click** on a member
  opens a **detail panel** (its own window) with **STATS** — HP, the five battle
  stats, nature, ability and held item — and **MOVES**, where the moves can be
  dragged to reorder them (that order is what the battle menu lists). The party
  is never left empty and the box is never required to be full.
- **Held items** are equipped from the same HUD: drag an equipment stack from the
  bag onto a party or box member to give it the item (any item it already held
  returns to the bag, so an equip is a swap, never a loss). The held item shows as
  a badge on the avatar's lower-right corner; dragging **that badge** takes the
  item off the member (onto another member to pass it along, or onto the bag to
  unequip it). An item in hand is not listed in the bag until it is dropped.
- The HUD panels — the route header, PARTY, the bag, the PC BOX and the member
  detail window — can be **dragged by their frame** (the interior stays live for
  rows, tabs and cells, so a click there still acts). A dragged panel **pushes**
  the others clear, so two panels never overlap; when a push chain reaches the
  screen edge the dragged panel stops rather than covering another, and a drag
  released off-screen lets go instead of following the pointer. Each panel shows
  its own **icon** at the top-left: clicking it **collapses** the panel to just
  the icon, and clicking again **expands** it and pushes the rest (a collapsed
  icon included) clear. The icon is also a **drag handle** — press and move to
  reposition the panel, and a press released without moving is the
  collapse/expand click. The detail window opens beside the PC box the first time
  and can then be moved freely. The positions and collapsed states are a global
  preference saved with the settings (D22), so they survive a reload and the next
  run.
- You start a run by picking one of three starters drawn from the base forms of
  every evolution line with at least three members (itself plus two others), so
  every starter has room to grow. The starter cards work with the **mouse**: hover
  highlights a card and a click picks it, beside the keyboard cursor.
- One capture per route, the classic way: weaken a wild Pokémon, throw a ball,
  it either clicks or breaks out.
- **Permadeath:** 0 HP is permanent. `0 HP = lost forever`, no Revive, no
  Pokémon Center resurrection, no box recovery.

## 4. The battle

Menu battle, one Pokémon per side on the field: **Fight / Bag / Pokémon / Run**.
Full rules in `docs/battle-spec.md`. In short:

- Gen 9 mechanics (types, stats, abilities, items, weather, terrain) driven by
  data extracted from Showdown at build time.
- XP, levels and evolution are classic, with a **level cap per map** (the map's
  `maxLevel`) so power always comes from play, not grinding.
- Wild battles can be fled; trainer battles cannot. Fleeing is one press: RUN
  attempts the escape at once, with no yes/no prompt.
- The command menu takes the **mouse** as well as the keyboard: hovering a row
  moves the ▶ cursor and a click picks it, and a click advances the battle text.
  **FIGHT / BAG / SWITCH / RUN** is a 2x2 **grid**, and so is the **moves** menu
  (all four moves show at once, with no scrolling): each move cell is tinted by
  the move's type and shows its name, the official category **badge** (physical /
  special / status) and its PP. A popup above the menu lists the move's type and
  **description** for the move under the cursor and lifts the Pokémon's data panel
  clear of it. **SWITCH** shows the party as a grid of **avatar** cells (face,
  name, level and an **HP bar**); the cell under the cursor opens a wide **detail
  window** above the grid with no tabs — the five battle stats, HP, nature,
  ability and held item in a left column, and the member's four moves in a 2x2
  grid on the right. Every submenu puts the ◀ back control centred on its left edge.
- The bag opens as pockets like the route HUD — **CONSUM** everywhere and
  **BALL** while a wild can still be caught; trainer battles offer only
  consumables.
- Every battle ends by itself: once the closing line has been read, a run, a
  catch, a win or a loss all return to the route with no confirm to press.
- On a wide screen the battle is a centred **square** (at most 900 px a side);
  a tall phone screen keeps the stacked, full-height layout.

## 5. The route

- Classic overworld movement on a tile grid, 24x24 tiles, camera follows.
- **Ground items** sit on the pockets against a wall (a corner where they can);
  a visible one is a Poke Ball that blocks its tile, a hidden one is a faint
  sparkle you can walk over and pick up underfoot (`E`).
- **Tall grass** is the only tile that rolls a wild encounter.
- **Trainers** have a line of sight: step into their line (a straight cardinal
  beam of 5 tiles, stopped by anything impassable — a wall, a ledge or water — and
  by other trainers; a walkable tree tip counts as open) and they walk over, then
  the battle starts (talking to one starts it too). A beaten trainer leaves the
  route. Some look around on a timer, so their line turns with them and can catch
  you even while you stand still. A trainer never spawns already watching the tile
  you arrive on, never stands next to another, and never blocks a passage.
- The exit opening ends the route and leads into the next route of the map; the
  next route's entry lines up opposite the exit, so the chain reads as one path.
  A route's shape is fixed by its entry/exit pair: opposite edges carve the
  **corridor** (one entry, one exit, no branches), adjacent edges a `bend`.
- The **last route of a map holds the boss** at the map's `maxLevel`. Its exit is
  sealed until the boss falls; then a **portal** opens and steps the run into the
  next map. (The end-of-route beat is disabled for now while the generator is in
  focus; the corridor shape and the matching openings are Phase 9.)
- Tilesets are **swappable per route** so the same map code renders a wood, a
  cave, a desert or a beach without touching the generator
  (`docs/tileset-spec.md`).

## 6. What a run looks like

```
starter pick -> map 1: route 1 -> route 2 -> ... -> boss -> portal
  -> map 2: route 1 -> ... -> boss -> portal -> ... -> final boss -> run won
```

Rewards between routes are the run's only economy: catch, items, and the PC box
are where the player's power comes from.

A run ends on a score screen, win or loss: routes cleared, Pokémon caught,
Pokémon lost and the seed that reproduces the run, as the raw seed and as the
share string someone else could play (`src/ui/runSummary.ts`, `D21`). A
win clears its route; a loss does not, and nothing carries over (D5).

## 7. Settings

The player's preferences outlive a run: text speed (how fast the battle message
box types itself out), master volume, the tileset preference (`auto` follows
each biome, or one tileset is forced on every route), **always run** (walk at
running speed without holding the run key; on by default) and the **HUD layout**
(where each panel of the `I` overlay sits and whether it is collapsed). They live
in the same save document as the run (D22), are stored the moment they change and
are edited from one screen (`O`, from the main menu, the starter pick or the
route HUD).

## 8. Out of scope (for now)

- Multiple save slots and cloud saves.
- Online play, trading, breeding, EVs/IV optimisation as a *goal* (stats and
  IVs exist because Showdown's data has them; the game never asks you to farm).
- Contests, berries as a farming loop, day/night, cutscenes.
