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
  holds a run with a living party, and it shows the map it stands on, that map's
  biome and the party's own portraits — the CONTINUE row paints one portrait cell per
  member, in party order, and only an unnamed species falls back to an empty box),
  **Options** (the settings screen) and **STATS** (the stats and ranking screen).
  Starting a new run only replaces the saved one once its starter is picked, so
  cancelling at the starter pick returns to the menu with the run in progress intact.
  **STATS** opens over the menu on the history of every finished run — the totals
  across every run, the run list, the Pokémon table and the local monthly record, each
  with its own empty state — and **BACK** returns to the menu; the DOM HUD draws the
  row, the canvas fallback keeps its three. The records footer under the menu prints
  three **live** figures — **WINS** (every finished run won), **MAX ELITE STRIKE** (the
  deepest floor a finite run reached) and **MONTHLY MAX STRIKE** (the deepest floor a
  finite run reached in the current UTC month, that month printed under the figure) —
  as `0` on a fresh profile, never blank; an infinite run raises neither strike. The
  build stamps its own version line `v<version> · PHASE <phase>` bottom-right; it is
  build metadata, so it is not translated while the three labels are keys. The window
  behind the title is a **live route** — a route generated from a fresh random seed on
  every boot (never the run's),
  drawn with the first map's biome tileset, with two or three Pokémon wandering it — and
  it is **decoration**: no encounters, no player, no input and no save write. On a phone
  the records footer under the menu wraps its figures into two rows, so the three blocks
  never collide on the narrow column, and the phone frames draw no version line.
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
  trainers; a fixed party of **six**, **three** on map 1); beating its boss opens
  the **portal** to the next map
  (`docs/maps-spec.md`).
- A room with a single opening is a **dead-end** room; a straight two-opening
  passage is the **corridor** shape. Both carry the usual trainers, items and
  tall grass.
- The chain is fixed-length by default: a finite run walks **eight maps**
  (`FINITE_MAPS`), and the levels climb **2 → 55** — the first floor is **2–9**,
  the cap a level-5 starter lives under. Maps 1-2 are the on-ramp: they field
  **two trainer rooms** where the late floors field four
  (`src/data/population.ts`), and no floor hangs a shop leaf: the Mart is the
  floor's guaranteed merchant NPC on every floor, map 1 included. Each map's boss closes it and
  opens the **portal** to the next, and the **last map's final boss** wins the
  run. An **infinite mode** reuses the same
  generator without the finish line.
- A run is defined by one **seed**: the starter screen shows it as a share
  string and `S` opens a prompt to type a seed or paste a friend's share string,
  so the same seed always plays the same run (`D11`, `D21`). The share string
  carries the seed and the mode, not the progress, so a shared run starts on
  route 1. `R` (`reroll`) throws the offer away and draws the next one from a
  **fresh random seed**, the path a brand-new run takes: a reroll is a new seed
  and nothing else, the mode is kept, and the share line follows the seed it just
  drew. `reset` keeps its name and moves to `Backspace`, so `R` answers `reroll`
  alone.
- Beating a map's boss opens its **portal** and steps the run into the next map,
  with a healing stop in between (heals HP and PP, never resurrects).
- Losing every Pokémon in the party ends the run: the run writes **one** record to
  the history — its seed, the floor reached, the catches, the casualties, the
  playtime counted from the instant it began, and the per-species KOs and damage its
  battles produced — so STATS lists it from then on. A run that reaches the end seam
  twice records nothing more.

## 3. The party

- Up to **6** Pokémon in the active party; extras go to the **PC box**.
- The party and the PC box are managed outside battle from the route HUD:
  drag a member within the party or the box to reorder it, or
  across the two panels to move it between them. Dropping a member **onto** a
  member of the other panel **swaps** the two, so a boxed Pokémon can replace a
  party member even when the party is full (the one it replaces takes the box
  slot). On the route's DOM party card every row paints that member's own
  **portrait cell** — the empty box is only the fallback for a species the atlas
  does not name — dragging one row **onto** another **swaps** the two, and since
  index 0 opens the next battle the drop decides who leads; an HP bar's fill
  starts at the track's **left edge**, so a full bar paints edge to edge and a
  fractional one starts flush. Crossing between the two panels is allowed **only
  in the floor's entry room**, on every visit (`docs/routes-spec.md` §6):
  everywhere else both directions are refused and the boxed members read as
  locked. A plain **click**
  on a member
  opens a **detail panel** (its own window) with **STATS** — HP, the five battle
  stats (the one a nature raises painted green, the one it lowers red), nature,
  ability, held item and the member's **evolution graph**: its whole family from
  the base form on down, one row per species indented by stage, each showing its
  sprite and the level it evolves at. The band draws **ten** rows at a time — the
  tallest family is exactly ten, an Eevee's (its eight evolutions, the Eevee row
  itself and its Gigantamax row) — and its window ends on the card's own inner
  bottom edge; a family longer than that scrolls a row at a time through a `<` / `>`
  pair on the band's title row, drawn only when there is more than the window holds,
  and the band's pool keeps **eleven** rows so a future forme has a cell without
  another layout pass. Besides the species rows the graph lists one
  **information row** per battle-only forme of every species of the family that has
  one, hanging off that species' own row: a Mega — dimmed and **never clickable**,
  the forme's sprite and readable name in the row's left column
  (`Mega Charizard X`), and the stone it needs right-aligned in the column where a
  species row prints the level it evolves at (`Charizardite X`) — and a Gigantamax
  (`Gigantamax Charizard`, `Charizardite G`), both
  **always shown**, whether or not the stone is held (`D34`, `D44`).
  A forme a deleted form-change ability used to reach (`D41`) arrives the same way
  every other one does: as an ordinary **branch** of the graph — a clickable
  evolution row keyed by the species that promotes (`D38`) — or, for Greninja's Ash
  forme, as a **second Mega information row** beside `Mega Greninja`, so "one
  information row per battle-only forme" still holds.
  The **ABILITY** row carries the same **ⓘ**
  control a move cell does, floating that ability's own one-line description over
  the panel on hover or a click. A branch the member's level already allows
  is green and a click evolves the member into it — Eevee's eight forms sit
  side by side and the player picks the one they want — and **MOVES**, which
  always draws its **four slots** — an empty one is an empty container, with no
  name and no **ⓘ**, that only takes a dragged move. The tab belongs to the panel,
  so picking another member keeps it; a closed panel opens on STATS. The slotted
  moves can be dragged to reorder them (that order is what the battle menu lists)
  over a **learnset** band: a search field and a full-width grid the wheel, the
  `<` / `>` pair or a drag on the band's own background scrolls a row at a time,
  of every move the member may equip — the level-up moves it has learned so far
  (minus the ones already in its four slots) and the moves a **TM in the bag** can
  teach it — each tagged `Lv##` or `TM###`; an empty pool reads `no moves to
  learn`. A cell is dragged onto a slot to equip it: an occupied slot replaces what
  sits there and an empty slot takes the move, so a three-move member can learn a
  fourth; teaching is free and a TM is
  **reusable** (D36). A slotted move dragged back onto the band is **unequipped**:
  the slot stays an empty container and the move returns to the band, tagged
  `Lv##` or `TM###` as it was; a member's **last remaining move cannot be removed**,
  and no confirmation is asked because the delete is free and reversible.
  A member with **no** moves at all reads `no moves` and draws
  no container. When the squad levels up the **only** panel it raises is a
  modal announcing **"X learned Y!"** for every move a member crossed on
  the way, dismissed with any key or a click — a level-up that crossed no move
  raises no panel at all. The party is never left empty and
  the box is never required to be full.
- A member can also be **edited by a special NPC** (`docs/maps-spec.md` §7): a
  **tutor** teaches one move of its six, and the move waits in the MOVES tab's band
  tagged `Tutor` — equipped the same way as a level-up one, and back in the band
  after an unequip; a **nature**, **ability** or **IV** reader re-rolls that one
  fact; and a **species swapper** trades the body for another of the floor's wild
  pool, keeping level, moves, abilities, IVs/EVs, held item, status and nickname.
  The sacrifice pays one whole bag stack for one of four of those rows. Every row is
  one use per floor unless it is `repeatable`, and two member words persist in the
  save: `taughtMoves` and `secondAbility`, both written only when they carry
  something.
- A member can be **named**: the name row on the STATS tab **is** an editable field
  (a bordered box with a `click to name` hint at its right end, drawn inside the
  detail panel's own window — there is no separate window). A click focuses it and it
  starts on the name the row shows — the nickname when there is one, else the species
  name — with a `>` mark printed while it is being typed; **Enter commits, Escape
  cancels** and Backspace erases one character at a time. The name the player types —
  up to **12 characters**, whitespace collapsed and trimmed — is shown **everywhere
  the member is named**: the party and PC rows, the detail window, the level-up and
  evolution popups, the capture screen, the release beat and the battle. Typing the
  **species name** again (in any case) or clearing the field to nothing **clears** the
  nickname back to the species name, while a click elsewhere in the panel, a tab
  switch, closing or collapsing the panel and the battle that interrupts a route all
  **discard** an unconfirmed edit. It lives beside `fighter.name` — which keeps
  meaning "creation name, then the battle-only forme's" — so a nickname survives a
  save, an evolution, a Mega Evolution and every other forme change. The field is
  keyboard-only, like the MOVES tab's learnset search, so a touch player cannot name a
  member yet.
- **Held items** are equipped from the same HUD: drag an equipment stack from the
  bag onto a party or box member to give it the item (any item it already held
  returns to the bag, so an equip is a swap, never a loss). The held item shows as
  a badge on the avatar's lower-right corner; dragging **that badge** takes the
  item off the member (onto another member to pass it along, or onto the bag to
  unequip it). An item in hand is not listed in the bag until it is dropped.
- A **consumable** — a heal or a status cure — is spent the same way: drag its bag
  stack onto a party or PC member, and it applies **only when it would change
  something**. A Potion on a full-HP member, a Burn Heal on an unburnt one or any
  item on a fainted member does nothing (no stack is spent, no notice, and the item
  never becomes a held item); when it does apply the stack leaves the bag and the
  HUD flashes `Used Potion.` for 2.6 s.
- The bag window is an **icon grid**: **five fixed columns** of square cells over
  three rows (fifteen stacks) under the pocket tab strip, each cell the item's own
  Añil icon with a small `xN` count badge in its lower-right corner — a stack whose
  atlas has no icon still gets its cell and its badge. The **selected** cell wears
  the accent fill and the accent 1-px outline and an **empty** slot is the dim 1-px
  outline only, so the grid's shape reads even when the pocket is nearly empty; a
  click selects a cell and the shipped **drag** — a stack onto a member, an item
  back onto the bag — is unchanged. A **filter** field between the tabs and the grid
  narrows the cells by name as it is typed (case-insensitive, matching the
  catalogue's own English name in every locale, `D43`), and the fifteen-stack cap
  drops the overflow: the filter is the way to the rest. Beside the grid floats the
  shared description card: it names the selected item and prints its catalogue
  description, or, for a **coloured candy** the run has already discovered, the
  stat and sign **this run** gave it (`docs/data-spec.md` §3). The card is the grid's
  own selection, not a button — there is no ⓘ in the bag.
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
  run; every panel's window is the same **dark glass card** at its own
  translucency, so
  the map reads through it, and the **Transparent HUD** option (see the settings
  screen) drops that window altogether — only the panel's content shows over the
  map behind it — keeping a drawn **outline** around each panel (the muted tone)
  and turning its **text to the card's own ink** so it stays legible. The HUD is
  **always on screen** — a quick key opens one panel, it does not show or hide the
  HUD — and a fresh save opens **only PARTY**, every other panel collapsed to its
  icon.
- The route **header is the floor minimap**: the map name over a Binding of Isaac-
  style grid of the rooms **discovered** so far, each drawn from the room's own
  width/height, its openings on the matching walls and a link drawn once **both**
  its ends are known. The current room, the boss, the open portal and any special
  room carry their own mark; a room stays hidden until it is entered
  (`docs/maps-spec.md` §8).
- Entering a **room** raises an **area banner**: a boxed card under the mission
  line that names the biome the run has walked into (`Deep Forest`), holding 3 s
  before it dismisses itself. It takes no key, blocks no movement and leaves the
  notice strip and the mission line where they are; it is raised on **every** room
  entry (not only when the floor changes), and the boss room's rebuild as its
  portal opens is not a room entry and raises none. The name is the biome's own,
  so it reads the same in every locale (`D43`).
- A **special room's** own content — the fixture it places, the window it opens and the
  marker the minimap draws for it — comes from that room's **descriptor module**
  (`src/scenes/rooms/`); the route keeps **one auto-discovered registry** of them, so a
  new room kind is a new file and not a scene edit (`D47`).
- The **Mart** and the **mini-boss reward** are **floating cards** drawn above the
  HUD, not modal windows: each is moved by its own header and closed from its own
  drawn ✕, neither takes a key (the quick keys, the pause menu and the arrows keep
  working while it is up), neither is persisted and neither pauses the walker. They
  are **pointer-only** and **drag-driven** — a row is taken by dragging it onto the
  bag or a living member, and the reward's Pokémon rows onto the party — so the
  route HUD's pointer-first rule holds for them too.
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
- A caught wild can be **dark** — one in twenty catches (`DARK_CHANCE`,
  `src/data/run.ts`), rolled once at the catch from a stream of its own so the same
  run seed, map, room and catch id always answer the same way. A dark member always
  fields **Dark Matter** as its primary ability and keeps the ability the wild had
  rolled as its **second** slot, so both work in battle; its portrait cell wears the
  mark — the violet hairline (`#8b5cf6`) over a near-black cell — and the detail
  panel's ABILITY row prints both names joined by ` / `, the second one reusing the
  same line. The mark is paint only: no text of its own, and the PC box and RIP panes
  do not wear it yet.
- **Permadeath:** 0 HP is permanent. `0 HP = lost forever`, no Revive, no
  Pokémon Center resurrection, no box recovery.

## 4. The battle

Menu battle, one Pokémon per side on the field: **Fight / Bag / Pokémon / Run**.
Full rules in `docs/battle-spec.md`. In short:

- Gen 9 mechanics (types, stats, abilities, items, weather, terrain) driven by
  data extracted from Showdown at build time.
- The **whole squad — party and PC — shares one level and one XP bar**: XP fills
  a single bar, the **route HUD**'s own one — the battle's HP panels draw no XP
  row — everyone levels together, and a catch joins at that level. A
  **level cap per map** (the map's `maxLevel`) keeps power coming from play, not
  grinding.
- Wild battles can be fled; trainer battles cannot. Fleeing is one press: RUN
  attempts the escape at once, with no yes/no prompt.
- A battle **opens with an entry beat**: one black-out fade covers the
  route-to-battle cut, one white camera flash marks the encounter, and the foe drops
  onto its platform — a trainer battle walks the trainer in first and its **send-out**
  brings the partner out after. Any confirm or cancel press, or a click, skips the
  beat to the first line, and **Reduce flashing** drops the flash and keeps the fade
  and the appearance beats.
- The command menu takes the **mouse** as well as the keyboard: hovering a row
  moves the ▶ cursor and a click picks it, and a click advances the battle text.
  **FIGHT / BAG / SWITCH / RUN** is a 2x2 **grid**, which also reserves a fifth
  **INFO** control at that grid's right edge — the same column the moves menu keeps
  for **MEGA** and **G-MAX** (each of those two controls draws the shipped Mega
  Evolution glyph, the Hard Stone icon every Mega Stone borrows, never a word; an
  armed one reads as the accent fill plus the accent outline), so the 2x2 keeps its
  shape — and so is the **moves** menu
  (all four moves show at once, with no scrolling), which always reserves its full
  2x2 so a shorter list keeps one cell size and draws its spare slots as empty containers,
  which take no press and float no **ⓘ**: each move cell is a glass row that shows
  its name, the FRLG **type badge**, the official category
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
  Each of the window's four **move** rows carries the same **ⓘ** on a hit zone of
  its own, sized to the button: hovering one floats that move's own description and
  a press on it **pins** the description open — the press is swallowed there, so
  the member the window describes is not switched.
  The arrows reach the **INFO** control from the command grid's last column, and a
  confirm or a press on it opens the battle's **own state** in a window of its own:
  the weather and the terrain, each live field condition and each side's own
  conditions with their counts, each active's stat stages and its non-volatile
  status. Any confirm or back press or a click closes it and it spends no turn. The
  engine models no **entry hazards** (Stealth Rock, Spikes, Toxic Spikes and Sticky
  Web are absent from the whole engine — `Tidy Up`'s handler in
  `src/engine/battle/effects/moves.ts` says so) and keeps the per-fighter
  **volatiles** hidden, so the window lists neither.
- The bag opens as pockets like the route HUD — **CONSUM** everywhere and
  **BALL** while a wild can still be caught; trainer battles offer only
  consumables. The pocket is the same **icon grid** as the route's, two rows of
  the five fixed columns (ten stacks) under the tabs, with its own **filter**
  field: a click or the `[` / `]` keys change pockets, the arrows walk the cells,
  `confirm` uses the stack the cell holds — a click only selects — and a
  selected stack's line and description card sit under and above the grid.
- Every battle ends by itself: once the closing line has been read, a run, a
  catch, a win or a loss all return to the route with no confirm to press.
- On a wide screen the battle is a centred **square** (at most 900 px a side);
  a tall phone screen keeps the stacked, full-height layout, with both battlers
  drawn 25% smaller so they sit clear of the stacked panels.
- The battle's windows are the drawn chrome: the **message box** behind the
  message text is the shipped `textbox` card (the one stage that draws it), and
  every other window — the HP panels, the command and moves
  menus, the battle-state window the **INFO** control opens and the switch grid's
  detail window — is the default card skin, each at its own degree of translucency
  so the field stays readable
  through it, and they ink their text with the light `FRLG_INK`. The line the message
  box prints is the engine's own `battle.log.*` key resolved in the active locale
  (`src/ui/feed.ts`), so a Spanish run reads its action log in Spanish while the log
  itself, and every fixed seed, stays language-free.

- The map boss's battle — and only it — is the engine's **double battle** on
  screen (`docs/battle-spec.md` §12): two actives per side, so the foe's platform
  carries **two** enemy sprites with **two** HP windows above them and the player's
  side shows **two** panels stacked, the second beside the shipped one (or above it
  when the field has no room below), drawn with the shipped panel and sprite
  construction. Both leads are commanded: slot 1 first with **FIGHT** and
  **SWITCH** only (the Bag and RUN stay the lead's side-level actions), then slot 0
  with the full four rows, and both commands resolve in one turn in Speed order. A
  single-target damaging move adds a **target step** after the move grid — the
  shipped ▶ cursor marks one live foe and `left`/`right` (or a click on either foe)
  move it before `confirm` sends the legal `target` command; a spread or status move
  submits as it always has, with no cursor. The entry beat sends the second lead out
  after the first (one extra `sendout`), and a wild battle, a regular trainer, the
  mini-boss and every special room's set piece keep the shipped one-active screen,
  command flow and beat.

## 5. The route

- Classic overworld movement on a tile grid, 24x24 tiles, camera follows.
- **Ground items** sit on the pockets against a wall (a corner where they can);
  a visible one is a Poke Ball that blocks its tile, a hidden one is a patch of the
  biome's own ground — a real floor frame of the route's tileset, not a sprite —
  that you can walk over and pick up underfoot (`E`).
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
  steps the run into the next map.
- Tilesets are **swappable per route** so the same map code renders a wood, a
  cave, a desert or a beach without touching the generator
  (`docs/tileset-spec.md`).

## 6. What a run looks like

```
starter pick -> map 1: route 1 -> route 2 -> ... -> boss -> portal
  -> map 2: route 1 -> ... -> boss -> portal -> ... -> final boss -> run won
```

A finite run walks **eight maps** (`FINITE_MAPS`), the levels climbing **2 → 55**
— one tuned row per map (`src/data/maps.ts`) — and the **last map's final boss**
wins it.

Rewards between rooms are the run's only economy: catch, items, money and the PC
box are where the player's power comes from. A run ends on a score screen, win or
loss: routes cleared, Pokémon caught, Pokémon lost, the enemies the run fainted
and, member by member, the KOs it scored and the damage it dealt and took, plus
the seed that reproduces the run, as the raw seed and as the share string someone
else could play (`src/ui/runSummary.ts`, `D21`). Both a win and a loss end on the
score screen, and its confirm returns to the main menu, where a new run is
started. A win clears its route; a loss does not, and nothing carries over (D5).
Every figure on the board is the run's own; a counter the run never recorded (a
save written before the counters existed) prints the em dash, never a zero. Both
cards carry the TOTALS / POKEMON tabs and the same board geometry at every width
— the phone defeat card is not a shorter, tab-less variant.

## 7. Special rooms & money

Besides its regular rooms, a floor can hold **special rooms** — extra dead-end
leaves with only their own content (`docs/maps-spec.md` §7):

- the **Mart**, carried by the floor's **merchant** special NPC (one per floor, the
  on-ramp's first floor included, selling the shipped early band's stock with the
  money the run has): the merchant stands in the floor's first trainer room and its
  `TRADE` row opens a **Pokémon Mart-style shop panel in the HUD**, which closes
  back onto the route and can be opened again on the same floor;
- a **mini-boss** room (50% chance): one strong trainer fielding a fixed party of
  **three** (**two** on map 1) that, when beaten, offers **one window of six
  rows**: three **items** and three **Pokémon presented only by their highest stat
  and their nature**, so the choice is a real gamble;
- a **mega-stone** room (15% chance, only from map 3 on): a random **Mega Stone**
  item, which lets its holder **Mega Evolve once per battle**;
- a **gated** room (20% chance, only from map 3 on): a one-tile **vault** behind a
  bush, a rock or a pond, holding one ordinary ground item. The interact key opens
  it when **any party member has the obstacle's type** — Bug or Grass / Rock or
  Fighting / Water — so the party the run built is the key, and the opening lasts
  the rest of the floor.
- a **static-species** room (25% chance, only from map 3 on): a one-tile **vault**
  behind a bush, a rock or a pond, just like the gated room, but the party property
  that opens it is either a **type** (Bug or Grass, Rock or Fighting) or an
  **ability** (the pond yields to Water Absorb, Swift Swim or Storm Drain), and the
  far side holds **one Pokémon** — the first stage of a pseudo-legendary line, at
  the squad's level — fought and caught as a normal wild, so the room's single
  capture is spent. While the run has completed **exactly one** floor mission and the
  floor it stands on is map 4 or later and flawless, the same room may hold a
  **legendary** instead (25%), so a run gets at most one floor of them.
- a **secret-shop** room (20% chance, only from map 3 on): the same one-tile
  **vault** behind a bush, a rock or a pond, opened by a party member of the
  obstacle's **type**; behind it a **counter** whose interact key opens the Mart card
  on the room's **own fixed shelf** — four held items (Leftovers, Life Orb, Choice
  Band, Focus Sash) and two TMs (Swords Dance, Shadow Ball) at catalogue price, the
  late-band gear the Mart withholds, so a run that finds the leaf can buy it early.
- a **special NPC** in a regular trainer room, at most one: the **merchant** (the
  row that ships) and, later, a medic, an exorcist, a berry tree. It stands on a
  free tile as an ordinary overworld sprite and blocks it; the interact key opens
  **one modal card** — the NPC's name as its title, one paragraph, a column of at
  most six choices and a `LEAVE` row — the same shell every NPC uses. A chosen row
  is recorded for the rest of the floor, so a revisit knows it was taken; the
  merchant is the floor's one **guaranteed** NPC (on every floor, map 1 included,
  in the floor's first trainer room, never rolled) and its `TRADE` row opens the Mart instead of
  recording a use. The **Team Rocket grunt** is the second row that carries a room's
  content: rolled from map 2 on (3 % per trainer room, +3 points a floor), it stands
  in a trainer room and its one row opens the **slot machine** — a cabinet with
  **three reels** whose faces are the band's own prizes and, on the fight, the
  grunt's Rocket icon. One spin costs the floor band's price and pays an item, an
  **Egg** (an ordinary bag item that hatches into a new party member at the squad's
  level when the run takes the portal) or the **battle against the grunt** — which
  locks the machine for the rest of the floor. The outcome is **booked before the
  reels turn**, so the spin is a reveal, never a re-roll, and `SPIN` / `LEAVE`
  answer the pointer as well as the keys. It is the run's one money-for-anything
  gamble, and no room holds it any more.
- a **special trainer** in a regular trainer room, at most one per room and
  replacing that room's first trainer rather than standing beside it, with three
  faces: the **ninja** (its sprite is hidden until the player stands adjacent, but
  it watches its lane and opens the battle all the same), the **Impostor** trainer
  (its whole team starts with the Imposter ability, and beating it pays an
  **Ability Shield**) and the **secret battle** (it only joins the draw once the
  run has met a floor mission, `missionsCompleted >= 1`). The three chances are
  `ninja` 0.1, `impostor` 0.08 and `secret` 0.2: 18 % of trainer rooms field one
  before the run's first met mission, 38 % afterwards.

Every floor is also given one **mission**, shown in one line of the HUD. The one
kind that ships is `flawless`: leave the floor having lost **no HP** and without a
casualty. Meeting it bumps a **run-long counter**, and its reward is a **special
room** — a reward row the room tasks hang off a completed mission — so a floor the
run leaves untouched pays, and the mission is judged when the run takes the portal
(`docs/routes-spec.md` §4).

**Money** is Poké Dollars, earned **only** by defeating trainers — a **fixed base
plus a random jitter** each, from its archetype/band — and the run starts with
none, so the economy stays tight (Binding of Isaac-style). The shop always stocks
the same **four rows** — a **10× pack** of the band's own ball at half the
catalogue price, the band's **potion rung**, and **two** held items from the
band's weighted pool at their catalogue price — with the band's **one TM**
— and, at `late` and `end` only, its **one G-Max Stone** — appended after them,
and buys any item at `sellPrice`, but only the **valuables**
(Nugget, Pearl, …) that turn up in the ground-item loot are worth real money. The
run's money shows in the HUD's **bag panel**.

## 8. Settings

The player's preferences outlive a run: text speed (how fast the battle message
box types itself out), master volume, **always run** (walk at running speed
without holding the run key; on by default), the **Transparent HUD** panels, the
**Reduce flashing** option (drop the full-screen flashes a beat would play and
release the hold-to-reset scrim at once; off by default, §10), the **HUD layout**
(where each panel of the route HUD sits and whether it is collapsed) and the
**language**. They live in the same
save document as the run (D22), are stored the moment they change and are edited
from one screen (`Tab`, from the main menu, the starter pick or the route HUD).

The game ships English and Spanish (`src/i18n/`, D43). English is the **source
table** and a locale overlays it by key, so the language defaults from the
browser's tag the first time and is switched from this screen **without a
restart** — the options screen re-resolves every string it draws from the new
locale on the next frame. The dex's own names (Pokémon, moves, abilities, items,
biomes) stay English in every locale: they are content, not chrome.

## 9. Out of scope (for now)

- Multiple save slots and cloud saves.
- Online play, trading, breeding, EVs/IV optimisation as a *goal* (stats and
  IVs exist because Showdown's data has them; the game never asks you to farm).
- Contests, berries as a farming loop, day/night, cutscenes.

## 10. Accessibility

The game is playable on a keyboard alone, from the first menu to the run-over
screen, and no rule it teaches ever rides on colour only. One preference guards
the flashing: **Reduce flashing** (`settings.reducedFlash`, off by default, `D45`),
which drops the battle's full-screen flash and releases the hold-to-reset scrim at
once. A hidden ground item is a floor frame, not a glint, so it has no flashing
surface left to reduce.

### 10.1 Colour is never the only carrier

**The rule:** wherever a state is told apart by hue, a second, non-colour carrier
tells it apart too — a shape, a stroke width, a mark or a printed value. The audit
below lists every surface where this task found a hue-only reading, and each was
fixed at a named seam:

1. **A spent trainer ball** (`BattleScene.drawFoeBallRow`) was dimmed and tinted
   only; it now also carries a 2-px dark slash across the icon's box. The dim tint
   stays as a secondary cue.
2. **Badly poisoned and poisoned** shared one badge frame — `src/data/statusIcons.ts`
   maps both `psn` and `tox` onto the same `psn` art — so `tox` now takes the
   abbreviation chip and prints `TOX` instead. `brn` / `psn` / `par` / `slp` /
   `frz` keep their badge art.
3. **The battle's FIGHT window** (`BattleScene.renderMoveMenu`) marked its
   selection with the cell's fill and stroke alone; the FRLG ▶ cursor now rides the
   selected cell, exactly as the command grid and the switch grid already do.
4. **The battle's bag pockets** (`BattleScene.renderBagMenu`) inverted the active
   tab's fill only; it also carries a 2-px dark underline along its bottom edge.
5. **A disabled move** (`src/ui/moveGrid.ts`) was a luminance-only state (alpha
   `0.4`); it keeps the alpha and gains a 3-px dark stroke, and the cursor already
   skips it, so two carriers say "cannot be picked".
6. **Type badges.** Recorded as **adequate**, with reasons: wherever a type rides
   on a hue, a badge rides with it. Both battle panels and both move windows draw
   the Añil type badge (`src/data/typeIcons.test.ts` measures non-empty art for
   every `TYPE_NAMES` entry, Fairy included), the move info popup draws the badge
   or the type's upper-case name chip, and the route's detail window prints the
   type names. The one hue-only reading left is a move cell's tinted background,
   which always carries one of those badges inside it (see `D45`).

### 10.2 HP is readable without colour

The two big battle panels keep their green / yellow / red fill, and say the same
thing three other ways:

- the **player's** panel prints `hp/maxHp` as numbers, unchanged, in the same slot
  at the same size;
- a living Pokémon at or below **one fifth** (`LOW_HP_FRACTION`, `src/ui/metrics.ts`)
  has its bar's fill **cut into four blocks** by three 2-px dark notches
  (`hpCueNotches`), so the danger band reads at a glance with no hue at all;
- a fill under 16 px is left whole rather than striped into nothing, and a fainted
  Pokémon (fraction 0) gets no cue — it is not low, it is gone.

The cue is a pure function of the fraction: it reads no RNG, no run and no battle
state. It applies to the two big panels only; the battle's switch-window HP bars
(`partyHpFills`) keep their plain fill.

### 10.3 Keyboard play

**The rule:** the route is walked on the keyboard and its **HUD is pointer-first**.
The four movement keys always walk, whatever panel is open, so no pane ever takes
the arrows and the character moves from the first frame after a panel opens. The
four panel quick keys (`party` / `bag` / `map` / `box`, the shipped vocabulary in
`src/data/keybinds.ts`, unchanged) are plain toggles: one press expands a panel or
collapses it again, exactly as a click on its collapse icon does, and a pane never
answers to a key. Every route-HUD operation is reached with the **pointer**, and
each pane draws its own highlight for the member, stack or move in hand. **The
pause menu is the one keyboard surface the route keeps** (`cancel`, arrows,
`confirm`); the Mart and the mini-boss reward are **pointer-only floating cards**
that take no key at all, and a focused text field — the nickname, the learnset
search field and the bag's filter — receives typed characters and swallows the
arrows while it is being typed into, which is text editing, not pane browsing. The
release overlay and the level-up popup keep `confirm`. The battle, the menus, the settings and the
run-over screen stay fully keyboard playable, as the table's rows below say; only
the route HUD changed.

| Surface | File | Keyboard / pointer path | Verdict |
| --- | --- | --- | --- |
| Route HUD panel enter / leave / hide | `RouteScene.togglePanel` | pointer: click the panel's collapse icon (`hudPanelIconAt` / `handleHudPointerUp`); the quick keys mirror that click and never focus the pane | pointer |
| Party rows | `RouteScene.openMemberDetail` | pointer: click a row (`hudPress`, released without a drag) | pointer |
| Party row reorder / deposit / withdraw | `RouteScene.dropHudAcross` | pointer: drag a row onto another (reorder) or onto the PC box / party (deposit / withdraw) | pointer |
| Party header / Pokevial | `RouteScene.drinkPokevial` | pointer: click the vial with a full meter (`vialButtonAt`) | pointer |
| PC box cells and pages | `RouteScene.stepBoxPage` | pointer: click a cell or a page tab, wheel over the window | pointer |
| Bag stacks | `RouteScene.hudDraggableStackAt` | pointer: click a cell to select it (its description card floats beside the grid) and press-drag a held stack or a heal/status consumable onto a member (`equipHudItem`) — the route's grid takes no arrow key | pointer |
| Bag pockets | `RouteScene.selectBagTab` | pointer: click a pocket tab | pointer |
| Bag filter | `RouteScene.handleHudPointerDown` | pointer: click the field, then type; it swallows every key while focused | pointer |
| Detail tabs STATS/MOVES | `RouteScene.detailTabAt` | pointer: click a tab | pointer |
| Detail nickname field | `RouteScene.beginNicknameEdit` | pointer: click the name row, then type | pointer |
| Detail ability info | `RouteScene.abilityInfoAt` | pointer: hover or click the ⓘ | pointer |
| Detail evolution rows | `RouteScene.evolutionAt` | pointer: click a ready branch | pointer |
| Detail search field | `RouteScene.handleDetailPointerDown` | pointer: click the field, then type | pointer |
| Detail move slots / ⓘ | `RouteScene.detailInfoAt` | pointer: drag a slot onto another to reorder, click the ⓘ | pointer |
| Learnset pool + scroll | `RouteScene.scrollLearnset` | pointer: the wheel, the `<` / `>` arrows or a drag on the band; drop a pool move on a slot | pointer |
| Panel drag | `RouteScene.startPanelDrag` | none: a layout affordance, persisted in `HudLayout` | pointer-only by intent |
| Reset hold ring | `RouteScene.updateReset` | `reset` held (Backspace by default) | keyboard |
| Mart panel | `RouteScene.beginRowDrag` | pointer: drag a BUY row onto the bag or a member; a SELL row is a click; move the card by its header, close it from its ✕ | pointer |
| Mini-boss reward | `RouteScene.takeMiniBossReward` | pointer: drag an item row onto the bag or a member and a Pokémon row onto the party; close the card from its ✕ | pointer |
| Pause menu | `RouteScene.handlePauseMenuAction` | `cancel`, arrows, `confirm` | keyboard |
| Release overlay / level-up popup | `RouteScene.playReleaseBeats` | `confirm` advances, any input dismisses | keyboard |
| Battle feed / result screen | `BattleScene.onConfirm` | `confirm` (click only advances) | keyboard |
| Battle command grid | `BattleScene.moveMenuGrid` | arrows, `confirm`, `cancel`; the cursor **visits** a dimmed row (BAG with nothing usable, SWITCH with no bench, RUN when the battle cannot be fled) instead of hopping over it, and `confirm` declines it | keyboard |
| Battle moves grid + ⓘ | `BattleScene.renderMoveMenu` | arrows, `confirm`, `run` toggles the ⓘ | keyboard (new) |
| Battle MEGA / G-MAX cells | `BattleScene.moveMenuGrid` | `right` reaches them, `confirm` toggles | keyboard |
| Battle bag list and pockets | `BattleScene.handleAction` | arrows walk the bag's five-column grid; `up` from its top row reaches the pocket row, `left`/`right` there cycle the pockets on offer (wrapping) and `down` returns to the grid's first stack; `confirm`, or a click on a stack, uses it (an empty cell only picks itself), `[` / `]` or a tab click change pockets too; the filter field takes typed text and keeps every command shortcut off | keyboard (new) |
| Battle switch grid and its detail | `BattleScene.renderPartyGrid` | `up`/`down`, `confirm`, `cancel`, `run` toggles the ability ⓘ; the cursor **visits** a dimmed row (a fainted member, or one already on the field) instead of hopping over it, and `confirm` declines it | keyboard (new) |
| Battle back control | `BattleScene.onCancel` | `cancel` | keyboard |
| Main menu rows | `MainMenuScene` | `up`/`down`/`confirm`/`settings` (with the STATS overlay open, only `cancel`, and it closes the overlay) | keyboard |
| Starter cards and seed prompt | `StarterScene` | `left`/`right`/`confirm`/`cancel`, `S` opens the prompt, `R` rerolls the offer from a fresh seed | keyboard |
| Settings rows and volume | `SettingsScene` | arrows, `confirm`, `cancel`; volume steps with `left`/`right` | keyboard |
| Run-over screen | `RunOverScene` | `confirm` | keyboard |
| Boot | `BootScene` | no input | keyboard |
