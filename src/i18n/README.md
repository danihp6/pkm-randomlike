# `src/i18n/` — the keyed text tables and the resolver

Every player-facing string is a key, not a literal (`D43`) — except the dex's move and ability
names and descriptions and the **item descriptions**, which are **content** and live in the
tables under `src/data/i18n/es/` (the move and ability ones generated, `items.json`
hand-authored), read through `content.ts` (`D43` amended by `Task-112` and `Task-209`). The
English table is the **source
table**: the one place an English string is written, flat and dotted, grouped by the surface it
is drawn on. The Spanish table overlays it by key, so a missing Spanish line is a type error and
the parity test fails the build. The resolver reads the current locale, replaces the value's
`{token}` placeholders with the caller's params, and **throws** on a missing one — a silent
`{name}` on screen is worse than a loud test failure.

The module is a **leaf**: no Phaser, no DOM, no `localStorage`, no `navigator`, no RNG, no clock,
and no import from `src/engine/`, `src/data/` or `src/scenes/`. The browser's language tag is an
**argument**, so the tables are testable headless. Its initial locale is English, so a test that
never switches reads the source table.

Two rules a new string must follow:

- **Never resolve a key at module scope.** A translated string in a module-level constant freezes
  the locale at import and the in-place language switch would not work: a const table holds
  **keys** and a function resolves them, or the drawing site resolves them itself.
- **Add both lines in the same edit.** One line in the English table (the wording, authored there
  first) and the same key in the Spanish one, then `npm test`: the parity, interpolation, glyph
  and width tests are the gate. A value may only use characters the FRLG bitmap font can draw
  (`src/data/ui/font.json`) — Latin-1 accents, `¿`, `¡`, `·`, `…`, the curly quotes and the
  arrows, but **no em dash**.

## The `dev.*` group

The dev panel's labels are their own dotted group, one line per control it draws. The node-aware
block is what the region's debug menu is written against: where the run stands (`dev.node`,
`dev.teleportNode`, `dev.markVisited`, `dev.location.node`), the badge stretch (`dev.badge`,
`dev.badgeTitle`, `dev.badgePlaceholder`, `dev.grantBadge`), the tower streak (`dev.streak`,
`dev.streakTitle`, `dev.streakPlaceholder`, `dev.setStreak`), the mode labels (`dev.mode`,
`dev.modeLeague`, `dev.modeTower`), the status lines they answer with (`dev.status.unknownNode`,
`dev.status.badge`, `dev.status.streak`, `dev.status.visited`) and the node key's own title and
placeholder. `index.test.ts` pins the block as an exact sorted list with its English wording, so a
menu can be written against it and a later edit cannot drop a line silently.

`dev.status.teleported` is **not** part of that block and keeps its paramless `teleported` for the
floor, room and tile jumps: the dev panel's call site passes no params, so a `{node}` token there
would throw on the spot. The node teleport's line is `dev.status.teleportedTo` (`Teleported to
{node}`). When the old jumps go, the two can be merged into one.

## Pruning rule

A key is **dead** when none of these hold in the tree as it is on `main`:

1. it appears as a literal `t('<key>')` call site in a non-test file under `src/`;
2. it appears as a full quoted string in `src/data/**`, or in a `nameKey`/`lineKey`/`tag`/`labelKey`
   field of a shipped data table (the mission catalogue and the NPC rows resolve their names this
   way);
3. it belongs to a family a call site builds at runtime — `detail.stat.*`, `keybind.*`,
   `battle.stage.*`, `battle.log.*` and the other prefixes a template or a concatenation assembles;
4. it appears in a non-test `src/**` file in any other form (a lookup table, an array, a `switch`).

`src/scenes/RouteScene.ts` and `src/scenes/StarterScene.ts` are **excluded** from rules 1 and 4:
Batch 125 deletes both screens, so the keys only they read stay until then and die with them.
Delete only a key that fails all four; when in doubt keep it and list it under **Kept** below. The
node-aware `dev.*` block is the one exception a later sweep will meet: its call site is the region's
debug menu, rewritten after it, so the block is pinned in the gate rather than in `src/` and must not
be swept.

### Pruned

These failed all four rules on `main` and were deleted from both tables: `menu.controls`,
`menu.subtitle`, `starter.blurbCompact`, `settings.controls`, `settings.controlsTouch`,
`settings.hintPressKey`, `settings.hintRebind`, `settings.hintVolume`, `hud.evolveTitle`,
`hud.mission`, `hud.missionProgress`, `hud.missionsMap`, `route.evolved`, `reward.controls`,
`trade.controls`, `trade.leave`, `battle.panelName`, `battle.xp`. They are the old canvas screens'
control hints, the settings screen's capture hints (the options panel draws its own), the mission
line and its two card labels the rewritten missions card replaced, the evolution titles, the trade
and reward windows' hints, and the battle panel's `Name Lv##` line with the XP label the route HUD
took over. The gate in index.test.ts reads this list back and asserts neither table carries one.

### Kept for Batch 125

Only the two doomed screens read these, so they stay until the sweep deletes the screens and the
keys with them: `starter.controls`, `starter.controlsCompact`, `route.released`,
`release.controls`, `npc.exorcist.done`, `npc.weather.done`, `npc.magician.done`,
`npc.gate.refused`, `npc.gate.granted`, `npc.medic.done`, `npc.chef.done`, `npc.chef.noBerries`,
`npc.chef.alreadyHeld`, `npc.pickMember`, `npc.pickSlot`, `npc.result.tutor`, `npc.result.nature`,
`npc.result.ability`, `npc.result.secondAbility`, `npc.result.ivs`, `npc.result.species`,
`npc.result.sacrifice`, `npc.refused.noSlots`, `npc.refused.noAbility`, `npc.refused.noSpecies`,
`npc.refused.noBag`, `npc.refused.notTutorMove`, `npc.refused.noMember`, `dev.error.noFloorPlan`,
`dev.error.solidTile`, `dev.error.invalidFrameMap`. The gate in index.test.ts reads this list back
and asserts both tables still carry every one.

## Layout

- `en.ts` — the source table: every key with its English text, grouped by the surface it is drawn on.
- `es.ts` — the Spanish overlay: the same keys, one line each, glyph- and width-checked.
- `index.ts` - the locale state and the resolver: the shipped locales, the browser-tag rule, the token scanner and the interpolating lookup the whole game calls.
- `content.ts` - the content-localisation layer (`D43`, amended): the official Spanish move, ability and item-description copy, read from the tables under `src/data/i18n/es/` (the move/ability ones generated, `items.json` hand-authored) with the dex's English strings as fallback. Unlike `index.ts` it **is** allowed to read `src/data/`, because it resolves content, not a key.
- `index.test.ts` - the gate: key parity both ways, no unresolved placeholder, no Spanish param the English entry lacks, glyph coverage, the width guards, the detector and the resolver, the node-aware `dev` group pinned as a sorted list, the `t('<key>', { … })` call sites, and the pruning lists above read back against the tables.
- `content.test.ts` - the content gate: the official names and descriptions, the English fallback, the `MISSING_ES` list and the Spanish item table's coverage floor.
