# `src/dev/` — dev-only tooling

Code that exists only while the developer gate is on: the debug menu, the coverage nudge and the
ids the debug panel mints. The gate is the Vite `develop` mode that `.env.development` sets and
`vite.config.ts` exposes through its `envPrefix`. Nothing here may be required by the shipping
game path, and nothing here may produce output when the gate is off.

## Layout

- `env.ts` — the gate: which build this is, the flag derived from it and the key that shows and
  hides the debug menu.
- `debugMenu.ts` — the DOM overlay: the species/item/move/ability/nature matchers, the party
  editor, the route and generator stepping tools, and the installer that wires them to the
  handlers `src/main.ts` passes in. `src/main.ts` imports it dynamically, so it never enters the
  production entry chunk.
- `warnings.ts` — the once-per-page console nudge when a battle meets a rule handler that has not
  been ported yet (`D16`).
- `ids.ts` — mints the stable, unique ids for the Pokémon a dev tool drops into a run, kept in its
  own small module so the route scene can use it without pulling the DOM menu into the bundle.

## Rules

1. A module that logs, draws or opens a window checks the developer gate first; with the gate off
   the code is inert.
2. The shipping path never imports this folder at the top level — `src/main.ts` reaches
   `debugMenu.ts` through a dynamic import.
3. A debug id is stable and unique per run, so a tool can address a member without guessing.
4. Adding a dev tool means adding its line here.
