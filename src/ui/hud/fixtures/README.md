# `src/ui/hud/fixtures/` — the `?hudFixture=<slug>` store

The `design/fixtures/<slug>.json` payloads `?hudFixture=<slug>` pins the DOM HUD to: the
URL flags that ask for one, the build-time map of that folder, and the store that validates
a file into the snapshot the panels render. A missing, unknown or malformed fixture is inert,
so the HUD behaves exactly like a plain boot.

## Layout

- `flags.ts` — the URL flags read once: the always-true `dom` half delegated to the mount parser (`?hud=dom` is only an alias) and the `?hudFixture=<slug>` half normalised to a lower-kebab frame slug.
- `flags.test.ts` — the flag truth table, its agreement with the mount parser, and the slug normalisation, headless.
- `registry.ts` — the eager, build-time map of `design/fixtures/*.json` and the type of a module map; empty while the folder does not exist.
- `registry.test.ts` — the map is a plain object keyed by fixture paths even with the folder absent, headless.
- `index.ts` — the store: the `HudState` guard, the slug list, the lookup by slug (with the frame's `screen`), the fixture the URL asks for and the sink that holds a fixture's frame.
- `index.test.ts` — the guard, the lookup, the frame's `screen` beside the six-key state, the install rules and the held sink, headless.
- `README.md` — this map.

## Rules

1. The fixture is read from the URL once, at boot; nothing here fetches, reads a clock or draws a random number, and nothing imports Phaser.
2. `?hud=dom` has exactly one parser in the repo (`../mount.ts`); this folder delegates to it and never forks it.
3. A fixture only ever produces a `HudState`: a file that does not validate is dropped, warned about once per page load and never thrown.
4. A frame may also name the screen it draws (`screen`, beside `state`): a lower-kebab panel id, null when the file names none or names it malformed. It is read for the gate's report and never becomes a seventh state key.
