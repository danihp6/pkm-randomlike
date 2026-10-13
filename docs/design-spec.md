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
- **Options** (the settings screen) lists a **step row** per preference — text
  speed, a **volume slider** (click or drag the bar), always-run and Transparent
  HUD — over one **keybind row** per action. A keybind row is hidden on a touch
  screen, where there is no keyboard to bind; keyboard, click and touch all drive
  the screen. The tileset is not a preference: a route always renders its biome's
  own (`D10`).
- A run is a chain of **maps** (floors), and a map is a **graph of routes**
  (rooms) laid out on a grid — Binding of Isaac's floors with rooms. Each route
  is a small top-down map: walls/trees, tall grass, trainers, items, openings. A
  map shares one **biome**, one **level range** and its route **sizes**; it is
  connected and closed into at least one cycle.
- Rooms join through openings: leaving by one edge enters the neighbour by the
  **opposite** edge, and a door lines up with the neighbour's. The **entry room**
  has no outward door — the run starts you at its **centre** — and the floor's
  farthest room is a **dead-end boss room** (one door, no tall grass, no regular
  trainers); beating its boss opens the **portal** to the next map
  (`docs/maps-spec.md`).
- A room with a single opening is a **dead-end** room; a straight two-opening
  passage is the **corridor** shape. Both carry the usual trainers, items and
  tall grass.
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
- The party and the PC box are managed outside battle from the route HUD:
  drag a member within the party or the box to reorder it, or
  across the two panels to move it between them. Dropping a member **onto** a
  member of the other panel **swaps** the two, so a boxed Pokémon can replace a
  party member even when the party is full (the one it replaces takes the box
  slot). A plain **click** on a member
  opens a **detail panel** (its own window) with **STATS** — HP, the five battle
  stats (the one a nature raises painted green, the one it lowers red), nature,
  ability, held item and the member's **evolution graph**: its whole family from
  the base form on down, one row per species indented by stage, each showing its
  sprite and the level it evolves at. The **ABILITY** row carries the same **ⓘ**
  control a move cell does, floating that ability's own one-line description over
  the panel on hover or a click. A branch the member's level already allows
  is green and a click evolves the member into it — Eevee's eight forms sit
  side by side and the player picks the one they want — and **MOVES**, where the four slotted
  moves can be dragged to reorder them (that order is what the battle menu lists)
  over a **learnset** band: a search field and a paged grid, spanning the window,
  of every move the member may equip — the level-up moves it has learned so far
  (minus the ones already in its four slots) and the moves a **TM in the bag** can
  teach it — each tagged `Lv##` or `TM###`; an empty pool reads `no moves to
  learn`. A cell is dragged onto a slot to
  equip it (replacing what sits there); teaching is free and a TM is
  **reusable** (D36). When the squad levels up a
  modal pops up announcing **"X learned Y!"** for every move a member crossed on
  the way, dismissed with any key or a click. The party is never left empty and
  the box is never required to be full.
- A member can be **named**: its name on the STATS tab is the rename control (a
  `click to name` hint sits beside its level), opening a small text field that
  starts on the current nickname, or the species name. The name the player types —
  up to **12 characters**, whitespace collapsed and trimmed — is shown **everywhere
  the member is named**: the party and PC rows, the detail window, the level-up and
  evolution popups, the capture screen, the release beat and the battle. Typing the
  **species name** again (in any case) or leaving the field empty **clears** the
  nickname back to the species name. It lives beside `fighter.name` — which keeps
  meaning "creation name, then the battle-only forme's" — so a nickname survives a
  save, an evolution, a Mega Evolution and every other forme change.
- **Held items** are equipped from the same HUD: drag an equipment stack from the
  bag onto a party or box member to give it the item (any item it already held
  returns to the bag, so an equip is a swap, never a loss). The held item shows as
  a badge on the avatar's lower-right corner; dragging **that badge** takes the
  item off the member (onto another member to pass it along, or onto the bag to
  unequip it). An item in hand is not listed in the bag until it is dropped.
- The **Pokevial** is a charged button in the party window's header (top-right),
  drawn as a **single bar** whose fill climbs through three colour stages with
  **POKEVIAL** written inside (no charge count): clicking it **only when the bar
  is full** rests the whole party **and** the PC box on the spot — HP and PP back
  to full and a primary status cured, though never a resurrection (D5) — and
  **empties** the meter. A charge is earned by beating a trainer (one each, up to
  the cap) and a floor's **boss** fills the bar to the top; the meter **carries
  over** between floors, and only a fresh run starts it full.
- The HUD panels — the route header, PARTY, the bag, the PC BOX and the member
  detail window — **move when grabbed**: by their frame or from any empty spot
  inside them that is not a control, while a click on a row, tab, cell or button
  still acts on it. The panels **overlap** freely: a dragged panel is **raised**
  over the rest, so the one in hand reads on top of the others, and a drag
  released off-screen lets go instead of following the pointer. A narrow screen
  clamps every panel to the window width (the detail window also drops its lateral
  padding), so nothing runs off the side on a phone. Each panel shows
  its own **icon** at the top-left: clicking it **collapses** the panel to just
  the icon, and clicking again **expands** it and raises it over the rest. On a
  keyboard screen the button is a small rectangle that prints, under the icon, the
  **quick key** that opens that panel (`P` party, `I` bag, `M` map, `O` PC box); a
  touch screen shows only the icon. The icon is also a **drag handle** — press and
  move to reposition the panel, and a press released without moving is the
  collapse/expand click. The detail window opens beside the PC box the first time
  and can then be moved freely. The positions and collapsed states are a global
  preference saved with the settings (D22), so they survive a reload and the next
  run; the **Transparent HUD** option (see the settings screen) hides every panel's
  window background so only its content shows over the map behind it, keeping a
  drawn **outline** around each panel and turning its **text white** so it stays
  legible. The HUD is
  **always on screen** — a quick key opens one panel, it does not show or hide the
  HUD — and a fresh save opens **only PARTY**, every other panel collapsed to its
  icon.
- The route **header is the floor minimap**: the map name over a Binding of Isaac-
  style grid of the rooms **discovered** so far, each drawn from the room's own
  width/height, its openings on the matching walls and a link drawn once **both**
  its ends are known. The current room, the boss, the open portal and any special
  room carry their own mark; a room stays hidden until it is entered
  (`docs/maps-spec.md` §8).
- You start a run by picking one of three starters drawn from the base forms of
  every evolution line with two consecutive evolutions ahead (itself plus two
  more in a chain), so every starter has room to grow; a branching line whose
  children are all final (Eevee, Scyther) is not offered. The starter cards work with the **mouse or
  touch**: hover highlights a card and a click or tap picks it, beside the
  keyboard cursor; on a phone (or any narrow or portrait stage) the three cards
  stack as full-width rows so the offer never runs off the screen. Each card shows
  the portrait, the name and the **type badges** (the selected portrait bobs
  gently); a type the FRLG badge sheet lacks (Fairy) falls back to its name.
- One capture per room of a floor, the classic way: weaken a wild Pokémon, throw a
  ball, it either clicks or breaks out. A room that spent its capture stays spent
  if you walk back into it; a different room of the floor can still catch.
- **Permadeath:** 0 HP is permanent. `0 HP = lost forever`, no Revive, no
  Pokémon Center resurrection, no box recovery.

## 4. The battle

Menu battle, one Pokémon per side on the field: **Fight / Bag / Pokémon / Run**.
Full rules in `docs/battle-spec.md`. In short:

- Gen 9 mechanics (types, stats, abilities, items, weather, terrain) driven by
  data extracted from Showdown at build time.
- The **whole squad — party and PC — shares one level and one XP bar**: XP fills
  a single bar, everyone levels together, and a catch joins at that level. A
  **level cap per map** (the map's `maxLevel`) keeps power coming from play, not
  grinding.
- Wild battles can be fled; trainer battles cannot. Fleeing is one press: RUN
  attempts the escape at once, with no yes/no prompt.
- The command menu takes the **mouse** as well as the keyboard: hovering a row
  moves the ▶ cursor and a click picks it, and a click advances the battle text.
  **FIGHT / BAG / SWITCH / RUN** is a 2x2 **grid**, and so is the **moves** menu
  (all four moves show at once, with no scrolling), which always reserves its full
  2x2 so a shorter list keeps one cell size: each move cell is tinted by the
  move's type and shows its name, the FRLG **type badge**, the official category
  **badge** (physical / special / status), its PP, its **effective power** (base
  power folded with STAB and the attacker's ability / item boosts) and its **hit
  chance** (the move's accuracy under the net accuracy / evasion stage and any
  ability). A power or hit chance that has risen reads **green**, one that has
  dropped reads **red**, and the hit chance carries an ↑ / ↓. A **ⓘ** button in
  each cell floats the move's type, status and **description** over the field on
  hover or click; the popup never moves the panels around it. **SWITCH** shows the
  party as a grid of **avatar** cells (face, name, level and an **HP bar**); the
  cell under the cursor opens a wide **detail window** above the grid with no tabs
  — the five battle stats, HP, nature, ability and held item in a left column, and
  the member's four moves in a 2x2 grid on the right. Both battle-side ability
  readers — this window and the **capture screen** — carry the same **ⓘ** a move
  cell does: hovering floats the ability's own one-line description and a press
  pins it. In the switch window the ⓘ is **hover only**, so a press there still
  selects the member under it. Every submenu puts the ◀
  back control centred on its left edge.
- The bag opens as pockets like the route HUD — **CONSUM** everywhere and
  **BALL** while a wild can still be caught; trainer battles offer only
  consumables.
- Every battle ends by itself: once the closing line has been read, a run, a
  catch, a win or a loss all return to the route with no confirm to press.
- On a wide screen the battle is a centred **square** (at most 900 px a side);
  a tall phone screen keeps the stacked, full-height layout, with both battlers
  drawn 25% smaller so they sit clear of the stacked panels.

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
- An **opening** joins the room to its neighbour: leaving by one edge enters the
  neighbour by the **opposite** edge, so the floor reads as one connected map. A
  room's shape follows from its openings: one opening is a **dead-end**, two
  opposite a **corridor** (a passage with no branches), two adjacent a `bend`,
  three a T and four a crossing.
- The **room farthest from the entry holds the boss** at the map's `maxLevel`.
  Its onward opening is sealed until the boss falls; then a **portal** opens and
  steps the run into the next map. (The end-of-route beat is disabled for now
  while the generator is in focus; the room shapes and the grid graph are Phase
  9.)
- Tilesets are **swappable per route** so the same map code renders a wood, a
  cave, a desert or a beach without touching the generator
  (`docs/tileset-spec.md`).

## 6. What a run looks like

```
starter pick -> map 1: route 1 -> route 2 -> ... -> boss -> portal
  -> map 2: route 1 -> ... -> boss -> portal -> ... -> final boss -> run won
```

Rewards between rooms are the run's only economy: catch, items, money and the PC
box are where the player's power comes from. A run ends on a score screen, win or
loss: routes cleared, Pokémon caught, Pokémon lost and the seed that reproduces
the run, as the raw seed and as the share string someone else could play
(`src/ui/runSummary.ts`, `D21`). A win clears its route; a loss does not, and
nothing carries over (D5).

## 7. Special rooms & money

Besides its regular rooms, a floor can hold **special rooms** — extra dead-end
leaves with only their own content (`docs/maps-spec.md` §7):

- a **shop**, always one per floor, near the entry: a counter whose interact key
  (`E`) opens a **Pokémon Mart-style shop panel in the HUD that only exists in
  that room**;
- a **mini-boss** room (50% chance): one strong trainer that, when beaten, offers a
  **choice of items**;
- a **mega-stone** room (15% chance, only from map 3 on): a random **Mega Stone**
  item, which lets its holder **Mega Evolve once per battle**.

**Money** is Poké Dollars, earned **only** by defeating trainers — a **fixed base
plus a random jitter** each, from its archetype/band — and the run starts with
none, so the economy stays tight (Binding of Isaac-style). The shop sells a core
of Balls and Potions that improves with the map's band plus one or two random
items from the map's pool at their catalogue price, and buys any item at
`sellPrice`, but only the **valuables** (Nugget, Pearl, …) that turn up in the
ground-item loot are worth real money. The run's money shows in the HUD's **bag
panel**.

## 8. Settings

The player's preferences outlive a run: text speed (how fast the battle message
box types itself out), master volume, **always run** (walk at running speed
without holding the run key; on by default), the **Transparent HUD** panels and
the **HUD layout** (where each panel of the route HUD sits and whether it is
collapsed). They live in the same save document as the run (D22), are stored the
moment they change and are edited from one screen (`Tab`, from the main menu, the
starter pick or the route HUD).

## 9. Out of scope (for now)

- Multiple save slots and cloud saves.
- Online play, trading, breeding, EVs/IV optimisation as a *goal* (stats and
  IVs exist because Showdown's data has them; the game never asks you to farm).
- Contests, berries as a farming loop, day/night, cutscenes.
