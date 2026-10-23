# `src/ui/hud/panels/` — the panel migrations

One folder per screen the board defines, each holding that screen's Preact components and
its pure layout model with a co-located `*.test.ts`. A migration adds files here and deletes
its Phaser counterpart in the same task (`D49`).

## Screens

- `options/` — the options/settings screen: frame `02`, its rows, sliders and keycaps (`view.ts`, `view.test.ts`, `optionsPanel.tsx`, `options.css`, `mount.tsx`, `preview.ts`, `preview.test.ts`, `index.ts`).
- `bag/` — the bag: pockets, stacks and the item row.
- `pc/` — the box: the storage grid, paging and the party hand-off.
- `party/` — the party screen: the six rows, the cursor and drag/drop.
- `detail/` — the party detail popup: STATS/MOVES tabs, nature effects and move order.
- `map/` — the floor map: the room grid, its openings and the boss/portal markers.
- `shop/` — the Mart: stock, prices and the sell list.
- `trade/` — the trade screen: both sides' offers and the confirm step.
- `rewards/` — the win card: the item and anonymous-Pokémon choices.
- `notices/` — the transient notices: one at a time, with no input taken.
- `pause/` — the pause menu: the resume/save/options rows.
- `hud/` — the route strip: biome, level cap, money, the shared XP bar and the Pokevial meter.
- `battle-hp/` — the battle HP boxes: the two plates, the bar and the status chip.
- `battle-moves/` — the battle move menu: the four slots, PP and the description window.
- `battle-bag/` — the battle bag: the in-battle pocket and its use row.
- `battle-switch/` — the battle SWITCH window: one row per party member.
- `battle-log/` — the battle message box: the frame feed, the typewriter and the waiting beats.
- `main-menu/` — the title screen: the entries and the run seed prompt.
- `stats/` — the stats/ranking screen: the run's counters and lines.
- `starter/` — the starter pick: the three cards and the confirm.
- `run-over/` — the run-over summary, with the permadeath release beats.
