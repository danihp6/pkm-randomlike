# `src/dev/` — dev-only tooling

Code that exists only while the developer gate is on: the debug menu, the coverage
nudge and the ids the debug panel mints. `env.ts` reads
`import.meta.env.ENVIRONMENT` — set by `.env.development`, exposed because
`vite.config.ts` lists `ENVIRONMENT` in `envPrefix` — and `IS_DEVELOP` is the one
switch the rest of the folder reads. Nothing here may be required by the shipping
game path, and nothing here may produce output when the gate is off.

## Layout

- `env.ts` — the gate: `ENVIRONMENT`, `IS_DEVELOP` and `DEBUG_MENU_TOGGLE_KEY` (the key that shows and hides the panel).
- `debugMenu.ts` — the DOM overlay: the species/item/move/ability/nature matchers, the party editor, the route and generator stepping tools, and `installDebugMenu`, which wires them to the handlers `src/main.ts` passes in. `src/main.ts` imports it dynamically, so it never enters the production entry chunk.
- `warnings.ts` — `warnUnportedEffect`: the once-per-effect console nudge when a battle meets an ability or held item with no ported handler (`D16`).
- `ids.ts` — `nextDebugPokemonId`: the stable `debug:<species>:<n>` ids the dev panel drops into a run, kept in its own small module so the route scene can use them without pulling the DOM menu into the bundle.

## Rules

1. A module that logs, draws or opens a window checks `IS_DEVELOP` first; with the gate off the code is inert.
2. The shipping path never imports this folder at the top level — `src/main.ts` reaches `debugMenu.ts` through a dynamic import.
3. A debug id is stable and unique per run (`ids.ts`), so a tool can address a member without guessing.
4. Adding a dev tool means adding its line here.
