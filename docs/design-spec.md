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

- A run is a chain of **routes** (our word for the floors). Each route is a
  small top-down map: walls/trees, tall grass, trainers, items, an exit.
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
  across the two panels to move it between them. A plain **click** on a member
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
- XP, levels and evolution are classic, with a **level cap per route** so power
  always comes from play, not grinding.
- Wild battles can be fled; trainer battles cannot. Fleeing is one press: RUN
  attempts the escape at once, with no yes/no prompt.
- The command menu takes the **mouse** as well as the keyboard: hovering a row
  moves the ▶ cursor and a click picks it, and a click advances the battle text.
  The **moves** menu is a 2x2 **grid** so all four moves show at once, with no
  scrolling: each cell is tinted by the move's type and lists its type, category
  (physical / special / status) and PP, a popup above the menu describes the move
  under the cursor, and the ◀ back control sits at the start of the first row.
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
- **Trainers** have a line of sight: step in their cone and the battle starts.
- The exit opening ends the route (a floor position, no special tile; disabled for
  now while the generator is in focus).
- Tilesets are **swappable per route** so the same map code renders a wood, a
  cave, a desert or a beach without touching the generator
  (`docs/tileset-spec.md`).

## 6. What a run looks like

```
starter pick -> route 1 -> heal stop -> route 2 -> route 3 -> mini-boss
  -> ... -> boss -> route ... -> final boss -> run won
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
each biome, or one tileset is forced on every route) and **always run** (walk at
running speed without holding the run key; on by default). They live in the same
save document as the run (D22), are stored the moment they change and are edited
from one screen (`O`, from the starter pick or the route HUD).

## 8. Out of scope (for now)

- Multiple save slots and cloud saves.
- Online play, trading, breeding, EVs/IV optimisation as a *goal* (stats and
  IVs exist because Showdown's data has them; the game never asks you to farm).
- Contests, berries as a farming loop, day/night, cutscenes.
