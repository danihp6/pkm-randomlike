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
- Beating a route's exit moves you to the next route, with a healing stop in
  between (heals HP and PP, never resurrects).
- Losing every Pokémon in the party ends the run.

## 3. The party

- Up to **6** Pokémon in the active party; extras go to the **PC box**.
- You start a run by picking one of three starters drawn from the base forms of
  every evolution line with at least three members (itself plus two others), so
  every starter has room to grow.
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
- Wild battles can be fled; trainer battles cannot.

## 5. The route

- Classic overworld movement on a tile grid, 24x24 tiles, camera follows.
- **Tall grass** is the only tile that rolls a wild encounter.
- **Trainers** have a line of sight: step in their cone and the battle starts.
- The exit tile ends the route.
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

## 7. Out of scope (for now)

- Multiple save slots and cloud saves.
- Online play, trading, breeding, EVs/IV optimisation as a *goal* (stats and
  IVs exist because Showdown's data has them; the game never asks you to farm).
- Contests, berries as a farming loop, day/night, cutscenes.
