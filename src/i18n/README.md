# `src/i18n/` — the keyed text tables and the resolver

Every player-facing string is a key, not a literal (`D43`) — except the dex's move and ability
names and descriptions, which are **content** and live in the generated tables under
`src/data/i18n/es/`, read through `content.ts` (`D43` amended by `Task-112`). The English table is the **source
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

## Layout

- `en.ts` — the source table: every key with its English text, grouped by the surface it is drawn on.
- `es.ts` — the Spanish overlay: the same keys, one line each, glyph- and width-checked.
- `index.ts` - the locale state and the resolver: the shipped locales, the browser-tag rule, the token scanner and the interpolating lookup the whole game calls.
- `content.ts` - the content-localisation layer (`D43`, amended): the official Spanish move and ability names and descriptions, read from the generated tables under `src/data/i18n/es/` with the dex's English strings as fallback. Unlike `index.ts` it **is** allowed to read `src/data/`, because it resolves content, not a key.
- `index.test.ts` - the gate: key parity both ways, no unresolved placeholder, no Spanish param the English entry lacks, glyph coverage, the width guards, the detector and the resolver.
- `content.test.ts` - the content gate: the official names and descriptions, the English fallback, and the `MISSING_ES` list.
