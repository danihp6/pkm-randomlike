# Spec: Task-209 — The bag's description card prints the item's text, in the player's language

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** data (one hand-authored locale table) + i18n seam + DOM panel + docs.
- **Role:** Dev.
- **Objective:** after this task the bag's floating description card prints the selected
  stack's own text instead of the empty string it passes today: one `itemText(id)` in
  `src/i18n/content.ts` resolves the player's locale from a new hand-authored
  `src/data/i18n/es/items.json` and falls back to the catalogue's English `shortDesc`, the
  card's height grows by the wrapped lines it prints, and the ball / heal / status
  catalogue rows — every consumable a run hands the player — are guaranteed a Spanish line
  by a test.
- **Environment:** worktree `../wt-pkm-209`, branch `task-209`.
- **Dependencies:** none to merge. It reads (never writes)
  `src/data/items.ts` (`ItemDef.shortDesc: string`, already filled by the `item()` helper
  from `getDexItem(def.id)?.shortDesc ?? def.name`; `ITEMS`, `getItem`),
  `src/i18n/index.ts` (`getLocale`, `setLocale`), `src/i18n/content.ts`
  (`moveShortDescription`'s shape is the model), `src/data/i18n/es/{moves,abilities}.json`
  (the generated tables' shape) and `src/ui/hud/panels/bag/view.ts` (`infoHeight`,
  `BAG_INFO_MIN_H = 56`, `BAG_INFO_LINE = 13`, `BAG_INFO_CHARS = 44`).

### Exclusive paths (single writer)

Nothing outside this list. No other task in Batch 87 claims any of these.

- `src/i18n/content.ts`
- `src/i18n/content.test.ts`
- `src/data/i18n/es/items.json` *(new)*
- `src/ui/hud/panels/bag/view.ts`
- `src/ui/hud/panels/bag/view.test.ts`
- `src/ui/hud/panels/bag/README.md`
- `src/data/README.md`
- `src/i18n/README.md`
- `docs/data-spec.md`
- `docs/tech-decisions.md` — **`D43` only** (the amendment), no other decision

**`src/data/items.ts` is not yours** — the field already exists. **`src/i18n/{en,es}.ts`
are not yours** (no key is added: the card's title is the item's name and its body is
content). `docs/design-spec.md` is explicitly **not** yours.

### Inputs (read-only)

Beyond `AGENTS.md`:

- `src/data/items.ts` (`ItemDef`, `ItemKind`, `ITEMS`, `getItem`), `src/data/README.md`
  (`i18n/es/`'s bullet), `src/data/i18n/es/{moves,abilities,meta}.json` (shape reference).
- `src/i18n/{index.ts,en.ts,es.ts,content.ts,README.md}`, `src/i18n/index.test.ts` (the
  glyph/width gate).
- `src/ui/hud/panels/bag/{view.ts,bagPanel.tsx,bag.css,mount.tsx}`.
- `src/data/ui/font.json` (the glyph set the FRLG bitmap font can draw).
- `docs/data-spec.md` §3/§5, `docs/tech-decisions.md` D43, `docs/design-spec.md` §5 (read
  only).
- `scripts/build-i18n-content.mjs` (why the move/ability tables are generated and items
  cannot be, without network).

## 🔒 Contract

### TypeScript — the locale seam (`src/i18n/content.ts`)

```ts
import itemsEs from '../data/i18n/es/items.json';

/**
 * An item's description in the current locale: the Spanish table's row when it has one,
 * the catalogue's own English `shortDesc` otherwise, `''` for an id the catalogue does
 * not know. Names stay English (`D43`): this returns the body only.
 */
export function itemText(id: string): string;
```

Frozen behaviour:

- `const english = getItem(id)?.shortDesc ?? '';`
- locale `en` ⇒ `english`.
- locale `es` ⇒ `itemsEs[id]` when it is a non-empty string after `.trim()`, else
  `english` — **never** `''` for an id the catalogue knows.
- an unknown id ⇒ `''` (the catalogue returns nothing, and the card prints its title only).
- Pure and total: reads only `getLocale()` (the same read `moveShortDescription` makes),
  the table and the catalogue. No clock, no RNG, no storage.

The table's shape is one flat object of id → description, **no `name` field** (item names
are English in every locale, `D43`):

```json
{
  "pokeball": "Dispositivo para capturar Pokémon salvajes.",
  "potion": "Restaura 20 PS."
}
```

### TypeScript — the bag view (`src/ui/hud/panels/bag/view.ts`)

- `bagPanelView` builds the card from the **selected stack's own id**:
  ```ts
  const text = selected === undefined || selected.itemId === null ? '' : itemText(selected.itemId);
  const height = infoHeight(text);
  const info = selected === undefined ? null : { title: selected.name, text, box: { … h: height } };
  ```
- `infoHeight` and `linesOf` are **unchanged** (`max(56, 48 + (lines − 1) × 13)`, 44
  characters a line per paragraph); the card now actually reaches them. An item with one
  line keeps the 56 px floor; an item the catalogue does not know (`itemId === null` or an
  unknown id) keeps the title-only height, exactly as today.
- Nothing else in the view changes: `box`, `highlight`, `chip`, `tabs`, `search`, `grid`,
  `tiles`, `footer` keep their rects, and the view still reads no `src/data/**` directly —
  the prose arrives through `itemText`, the same seam `t` is (amend the panel's README rule
  1 to say so).
- `bagPanel.tsx` needs **no change**: it already renders `<p class="bag-info__text">` when
  `view.info.text !== ''` and sets the card's `minHeight` from `view.info.box.h`.

### Data

`src/data/i18n/es/items.json` — hand-authored, committed, **not generated** (the generator
in `scripts/build-i18n-content.mjs` fetches PokeAPI's move/ability CSVs over the network
and has no item pass; extending it is a tooling task, not this one).

**The coverage floor, and the one line that justifies it:** the table must carry a row for
**every `ITEMS` entry whose `kind` is `ball`, `heal` or `status`** — 23 rows today
(`pokeball`, `premierball`, `greatball`, `ultraball`, `masterball`, `potion`, `superpotion`,
`hyperpotion`, `fullrestore`, `candyred`, `candyblue`, `candygreen`, `candyyellow`,
`candypink`, `exorcistbottle`, `weatherbottle`, `medicbottle`, `antidote`, `paralyzeheal`,
`awakening`, `burnheal`, `iceheal`, `fullheal`)
— because those are the stacks a run hands the player (the starting bag, the Mart, the
ground, the berry tree) and the ones whose text changes a decision; the held-item and
valuable prose stays English until a generated table exists.

Rules for every row:

- Official Spanish phrasing (PokeAPI/`es` canon), one sentence, **and** the same meaning as
  the catalogue's `shortDesc` — it is a translation, not new copy.
- Only characters `src/data/ui/font.json` carries: Latin-1 letters and accents
  (á/é/í/ó/ú/ü/ñ, ¿, ¡), `·`, `…`, the curly quotes and the arrows. **No em dash**, no `×`,
  no `→`.
- At most **132 characters** (three lines at the card's 44-character wrap).
- Two rows are pinned verbatim, because the tests and the QA pass read them:
  - `"pokeball": "Dispositivo para capturar Pokémon salvajes."` (41 chars → one line)
  - `"potion": "Restaura 20 PS."` (16 chars → one line)

No `meta.json` change (its `moves`/`abilities` audit blocks describe the generated tables
only). No `SAVE_VERSION` bump, no `src/data/items.ts` change.

## 🧩 Data and configuration

- `src/data/README.md`: the `i18n/es/` bullet says the folder is **generated** and holds
  move and ability copy. It now also holds the **hand-authored** `items.json`; say so, and
  say that item names stay English while the description is localised.
- `src/i18n/README.md`: `content.ts`'s line becomes "the official Spanish move, ability
  **and item-description** copy"; the folder's opening line ("except the dex's move and
  ability names and descriptions") gains the item description.
- `docs/data-spec.md`: the `src/data/i18n/es/` row (or the section that lists the
  generated tables) records the new hand-authored `items.json` and its coverage floor.
- `docs/tech-decisions.md` `D43`: one amendment paragraph — "an **item description** joins
  moves and abilities as content-localised (`itemText`, `src/data/i18n/es/items.json`,
  hand-authored); item **names** stay English as the boundary above says; an id the table
  does not carry falls back to the catalogue's English line, and every `ball`/`heal`/`status`
  row must carry one." Do not touch any other decision, and do not edit D52.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; green.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-209` audited against the exclusive-path list.
  - **Browser pass:** `npm run dev` (port **5175**), Chromium `/usr/bin/chromium`, the DOM
    HUD at `http://localhost:5175/?hud=dom`, viewports exactly **1280×800** and
    **390×844**, read over CDP (`getBoundingClientRect`, `textContent`, `getComputedStyle`).
    The asset store is at `$ASSETS_ROOT` and is never symlinked into the worktree; the bag
    card draws no art (the tiles' icons fall back to empty cells on a placeholders-only
    tree, which does not affect these criteria).
  - **Reaching the bag:** pick a starter, then on the route press `I` (the `bag` keybind's
    default, `src/data/keybinds.ts`). The panel opens on the **EQUIPMENT** pocket
    (`initialBagPanelUi()`), which a fresh run leaves empty, so click the **BALL** tab
    (`[data-hud-bag-tab="ball"]`): its first stack is the Poké Ball — the only stack every
    run starts with (`STARTING_BAG = [{ itemId: 'pokeball', count: 10 }]`) — and it is
    selected by the cursor, so the description card appears with no further press.
  - **Switching the locale:** launch Chromium with `--lang=es-ES` (or send
    `Emulation.setLocaleOverride { locale: 'es-ES' }` before navigating) on a **fresh
    profile** (empty `localStorage`), so `loadSettings` detects `es` and stores it; the
    same profile without the override reads `en`.
- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` clean.
  - [ ] `[unit]` `npm test` green.
  - [ ] `[unit]` `content.test.ts`: **every** `ITEMS` entry has a non-empty
        `shortDesc` (the catalogue's guarantee, now pinned) — one loop over `ITEMS`, no
        exceptions.
  - [ ] `[unit]` `content.test.ts`: every `ITEMS` entry whose `kind` is `ball`, `heal` or
        `status` has a row in `itemsEs` whose `.trim()` is non-empty (the 23 ids, asserted
        as a set so a new potion fails the test).
  - [ ] `[unit]` `content.test.ts`: `itemText('potion')` is `'Restaura 20 PS.'` under
        `es` and `getItem('potion')!.shortDesc` under `en`; `itemText('pokeball')` is
        `'Dispositivo para capturar Pokémon salvajes.'` under `es`;
        `itemText('leftovers')` under `es` equals its English `shortDesc` (no row ⇒
        fallback, never `''`); `itemText('nonsense')` is `''`. Restore
        `setLocale(DEFAULT_LOCALE)` after each case.
  - [ ] `[unit]` `content.test.ts`: every value in `itemsEs` draws in the FRLG font (each
        code point is in `font.json`'s glyphs), contains no `\u2014`, is ≤ 132 characters,
        and no key in the table is an id `getItem` does not know (a stale row is a bug).
  - [ ] `[unit]` `bag/view.test.ts`: the selected `potion` stack's `info.text` is
        `itemText('potion')` and its box height stays **56** (one line); the `superpotion`
        row's height is 56 too; a hand-built row with a 60-character description gets
        `h === 61` (`48 + 13`) and one with 120 characters `h === 74` (`48 + 2 × 13`); a
        `null` `itemId` keeps `text === ''` and `h === 56`; the card's `x`/`y`/`w` are
        unchanged from today's pins.
  - [ ] `[unit]` the bag test's existing `expect(panel.info!.box).toEqual({ x: 640, y: 504,
        w: BAG_INFO_W, h: 56 })` still passes (Potion is one line) — if it does not, the
        height formula was changed and that is a spec violation.
  - [ ] `[live]` **1280×800, English (`en`)**: press `I`; `[data-hud-bag-info]` exists; its
        `.bag-info__title` `textContent` is `Poké Ball` (English, unchanged) and its
        `.bag-info__text` `textContent` equals
        `A device for catching wild Pokémon.`; the card's `getBoundingClientRect()` height
        is ≥ 56 and equals the description's own box height from the view (56 ± 1 for this
        one-line row); the `<p>`'s rect lies inside the card's.
  - [ ] `[live]` **1280×800, Spanish (`--lang=es-ES` on a fresh profile)**: the same stack's
        `.bag-info__title` is still `Poké Ball` and `.bag-info__text` equals
        `Dispositivo para capturar Pokémon salvajes.` — i.e. the body follows the locale and
        the name does not (`D43`).
  - [ ] `[live]` **390×844** (either locale): the card sits at `x = 8`, `width = 280`,
        its text is the same string as at 1280, its height is ≥ 56 and its bottom edge is
        inside the 390×844 stage; the text is not clipped — measured as
        `element.scrollHeight <= Math.ceil(element.getBoundingClientRect().height)` on
        `[data-hud-bag-info]`.
  - [ ] `[live]` **growth, same page**: on an item whose description wraps (a 2-line row,
        e.g. the Hex Bottle bought at a Mart if the run has one, `h === 61`), the card's
        height exceeds 56 by exactly 13 per extra line — read the card's height and the
        `<p>`'s height and assert the difference. *(If no wrapping item is reachable in the
        run under test, this criterion is reported **not run** with that reason; the growth
        is already pinned `[unit]`.)*

## 📣 Coordination

**Premises of the task entry I corrected against the tree — read these first:**

1. **`ItemDef` already has its text field.** `src/data/items.ts` line 132 declares
   `shortDesc: string`, and the `item()` helper (line 138) fills it from
   `getDexItem(def.id)?.shortDesc ?? def.name` — so **every** catalogue row already carries
   a non-empty English line and `src/data/items.ts` needs **no edit at all**. The entry's
   "`ItemDef` has no text field at all, so item prose has no source" is stale.
2. **The card's body is `text: ''` but the panel already prints it.** `bagPanelView`
   builds `info: { title, text: '', box }` and `bagPanel.tsx` already renders
   `<p class="bag-info__text">` for a non-empty `text` with `minHeight` from the box. So
   this task changes the **view only** — no markup, no CSS. The line range the entry cites
   (182-195) is where `info` is built (`const height = infoHeight('')`, `text: ''`).
3. **`src/i18n/content.ts` carries moves and abilities only** — correct for
   `src/i18n/content.ts`; the data files it reads are `src/data/i18n/es/{moves,abilities}.json`,
   **generated** by `scripts/build-i18n-content.mjs` from PokeAPI CSVs over the network.
   There is no item pass, and the catalogue's ~500 rows (171 TMs, every Mega/G-Max stone,
   every held item) make hand-authoring all of them unreasonable: hence the coverage floor
   (ball/heal/status) and the English fallback.
4. **Do not invent a second text field**: `shortDesc` is the English source and
   `items.json` holds only the Spanish body; item names stay English (`D43`).
5. **The live check cannot use a Potion.** A fresh run's bag holds Poké Balls only
   (`STARTING_BAG`), so the browser pass reads the **Poké Ball** card; the Potion is pinned
   `[unit]` instead. Reaching the bag is the `I` key, not a menu row.
6. **`bag/view.test.ts` already builds its fixture from real ids** (`potion`,
   `superpotion`), so its `info` assertions start passing text the moment `itemText` lands —
   the height pin (56) must stay green, which is the cheapest proof the formula did not
   move.

- **For the Architect:** the entry claims `src/data/items.ts` + its test; neither is
  touched (the guarantee is tested from `content.test.ts` instead, where the table and the
  fallback live). The Spanish table is a **subset by kind**, not all 500 rows — the rule and
  its one-line justification are in the Contract; a full table needs the generator extended
  to PokeAPI's item CSVs, which is a tooling task.
- **For a later batch (not cut here):** two other surfaces print `ItemDef.shortDesc` and
  should read `itemText` when they are migrated — the reward card
  (`src/ui/rewards.ts` line 157, `description: item?.shortDesc`) and anything the battle bag
  shows. They are outside this task's paths.
- **For the next batch:** `itemText` is the one seam; a new item kind that needs Spanish
  prose adds a row to `items.json` and (if it is a consumable) the coverage test demands it
  without a code change.
- **Integration QA:** `docs/tech-decisions.md` is yours alone in this batch (199 and 206 own
  `docs/design-spec.md` §2/§4 and 203 `docs/hud-fidelity.md` §5/§6); confirm no other
  decision paragraph moved.

## ⛔ Out of scope

- No `src/data/items.ts` change, no `ItemDef` field, no second text field.
- No new i18n key in `en.ts`/`es.ts`: the title is the item's name, the body is content.
- No generated table, no `scripts/` change, no PokeAPI fetch, no `meta.json` edit.
- No change to the bag's markup, CSS or rects, to `bagPanel.tsx`, `mount.tsx` or the tiles.
- No `docs/design-spec.md` edit, no `docs/hud-fidelity.md` edit.
- No localisation of **item names**, of the reward card, of the battle bag or of any other
  panel; no `SAVE_VERSION` bump.
