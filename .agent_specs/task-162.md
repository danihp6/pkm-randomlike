# Spec: Task-162 — A Mega and a G-Max row read like a species row: name left, stone right

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** UI view model + two renderers + i18n + docs.
- **Role:** Dev.
- **Objective:** the STATS tab's evolution graph prints an information row (a Mega or
  a Gigantamax) the way it prints a species row: the **name in the left column** and
  the **stone in the right column, where the species row puts its level**. Today
  `FamilyNode.name` carries the whole clause — `megaRowName` returns
  `t('detail.megaEvolvesWith', { stone })` and `gmaxRowName` returns
  `'{forme} · {stone}'` (`src/ui/evolutionGraph.ts` 57-68) — while `level` stays
  `null` on those rows, so the left column shows the stone (or "Gigantamax X · stone")
  and the right column draws `''` in Phaser (`src/scenes/panels/detail.ts` 607) and no
  `<text>` at all in the DOM (`src/ui/hud/panels/detail/evolution.ts` 51,
  `detailPanel.tsx` 250-254). After this task `FamilyNode` carries a `note` — the
  right column's own text — `name` is the forme's readable name, and both renderers
  get their right column from **one** shared function, so the two never drift.
- **Environment:** worktree `../wt-pkm-162`, branch `task-162`.
- **Dependencies:** none. Everything read is merged on `main` @ `f211850`: the graph
  (`src/ui/evolutionGraph.ts`), the two renderers, the i18n pair and the dex forme
  accessors (`megaFormsForBase`, `gmaxFormForBase`).

### Exclusive paths (single writer)

Nothing outside this list. No other task in the batch claims any of these.

- `src/ui/evolutionGraph.ts`
- `src/ui/evolutionGraph.test.ts`
- `src/scenes/panels/detail.ts`
- `src/ui/hud/panels/detail/evolution.ts`
- `src/ui/hud/panels/detail/evolution.test.ts`
- `src/ui/hud/panels/detail/detailPanel.tsx` — claimed, and it may be left
  **untouched**: the plan allows the edit, it does not require it (see the Contract
  and the note on `level` below).
- `src/i18n/en.ts` — the batch's only claimant, and only the two key lines named
  below.
- `src/i18n/es.ts` — the batch's only claimant, only the same two keys.
- `docs/design-spec.md` **§3 only** ("The party", today lines 65-251, ending before
  `## 4. The battle`). No other task in the batch touches `docs/design-spec.md`.

No file is added, renamed or deleted, so no folder `README.md` changes.

Two files are **read-only even though they look involved** — do not edit them:
`src/ui/hud/panels/detail/view.ts` (it declares `DetailEvolutionRowView`, whose
`level: string | null` is reused as the right column's text) and
`src/ui/hud/panels/detail/detail.css` (`.detail__evo-level` already carries
`text-anchor: end`, today line 347, so the right column is already right-aligned).

### Inputs (read-only)

- `AGENTS.md`.
- `docs/design-spec.md` §3 (the STATS tab's evolution bullet, today lines 76-89); read
  only that section, and only the part you rewrite.
- `docs/hud-fidelity.md` §4-§5 if a paint question comes up.
- `src/ui/evolutionGraph.ts`, `src/scenes/panels/detail.ts`,
  `src/ui/hud/panels/detail/{evolution.ts,detailPanel.tsx,view.ts,detail.css}`.
- `src/ui/partyDetail.ts` (it re-exports `FamilyNode[]` as `evolutions`; it reads no
  field this task changes, so it must stay untouched).
- `src/data/dex/megas.ts` (`MegaForm.id`, `.name`, `.stoneName`,
  `megaFormsForBase`), `src/data/dex/gmaxes.ts` (`GmaxForm`, `gmaxFormForBase`),
  `src/data/portraits.ts`.
- `src/i18n/index.ts` (`t`), `src/i18n/index.test.ts` (read it to see what the i18n
  parity suite pins — it pins neither of the two keys being retired).

Rules: no new dependency, no new i18n key, no `SAVE_VERSION` change (nothing is
persisted).

## 🔒 Contract

### TypeScript

`src/ui/evolutionGraph.ts` — `FamilyNode` gains exactly one field and loses none:

```ts
export type FamilyNode = Readonly<{
  id: string;
  /** The left column: the species name, or the forme's readable name (`formeDisplayName`). */
  name: string;
  /**
   * The right column's text on an information row: the stone the forme needs.
   * `null` on every species row, whose right column is its `level` instead.
   */
  note: string | null;
  depth: number;
  row: number;
  level: number | null;
  parent: number | null;
  current: boolean;
  ready: boolean;
  kind: FamilyNodeKind;
}>;
```

- A **species** node: `name: species.name`, `note: null` (unchanged otherwise).
- A **mega** node: `name: formeDisplayName(mega.name)`, `note: mega.stoneName`.
- A **gmax** node: `name: formeDisplayName(gmax.name)`, `note: gmax.stoneName`.
- `megaRowName` and `gmaxRowName` are **deleted** (they are module-private, so
  deleting them is invisible). `formeDisplayName` (today 48-55) stays exported and
  unchanged, and is the only name builder. The local `pushForme` helper (today
  114-126) grows a fourth parameter so its call sites read
  `pushForme('mega', mega.id, formeDisplayName(mega.name), mega.stoneName)` and
  `pushForme('gmax', gmax.id, formeDisplayName(gmax.name), gmax.stoneName)`; its
  `level: null`, `current: false` and `ready: false` stay as they are.

One new exported function, the single arithmetic both renderers call:

```ts
/**
 * The right column of a graph row: the level a species row evolves at, or the stone
 * an information row needs. Empty for a row that has neither (a base form).
 */
export function evolutionRowNote(node: FamilyNode): string {
  return node.level === null
    ? (node.note ?? '')
    : t('detail.evoLevel', { level: node.level });
}
```

`src/scenes/panels/detail.ts` (Phaser renderer) — line 607 becomes

```ts
cell.level.setText(evolutionRowNote(node));
```

and the file's existing import at line 14 (`import { type FamilyNode } from
'../../ui/evolutionGraph';`) gains `evolutionRowNote`. Nothing else in that file
moves: the cell's `level` text object is already built with `origin: [1, 0]` at
`x = right` (today 1548-1552), so it is already right-aligned.

`src/ui/hud/panels/detail/evolution.ts` (DOM view model) — line 51 becomes

```ts
level: evolutionRowNote(node) || null,
```

The `|| null` keeps the shipped `null` for a row with neither a level nor a note (a
base form draws **no** `<text>` at all, as today), and
`src/ui/hud/panels/detail/detailPanel.tsx`'s existing
`row.level === null ? null : <text …>` (today 250-254) then prints the stone
right-aligned through the CSS already in place. **If** the dev finds a reason to edit
`detailPanel.tsx` anyway, the only permitted edit is inside that same 250-254 block;
do not change `DetailEvolutionRowView` (it lives in `view.ts`, which is out of
bounds).

`src/i18n/en.ts` and `src/i18n/es.ts` — **retire both keys**; the note carries the
stone directly, so nothing reads them any more (`src/ui/evolutionGraph.ts` is the only
call site today):

- `en.ts` line 352 `'detail.megaEvolvesWith': '{stone}',`
- `en.ts` line 353 `'detail.gmaxEvolvesWith': '{forme} · {stone}',`
- `es.ts` line 355 `'detail.megaEvolvesWith': '{stone}',`
- `es.ts` line 356 `'detail.gmaxEvolvesWith': '{forme} · {stone}',`

Delete those four lines and nothing else. `detail.evoLevel` (`en.ts` 348, `es.ts`
351) **stays**. Both tables must keep the same key set (`src/i18n/index.test.ts` 37
pins that both ways), and the source-table wording pin (`index.test.ts` 314-346) does
not name either key, so no other i18n file needs a change.

**Determinism:** reads no RNG, no clock, no DOM in the view model; the graph stays a
pure function of `(speciesId, level)` and the string tables.

### Data

- One new `FamilyNode` key: `note: string | null`, default `null`, unit "a dex stone
  name, verbatim English in every locale" (dex names stay English per `AGENTS.md`).
- No JSON, no balancing value, no save field, `SAVE_VERSION` stays **25**.

## 🧩 Data and configuration

No data table changes: the stone names come from the generated
`src/data/dex/megas.ts` / `gmaxes.ts` rows that already ship. The only configuration
is the i18n retirement above; `detail.evoLevel` keeps its two strings (`'Lv {level}'`
/ `'Nv {level}'`) and they now serve Mega, G-Max and species rows alike.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-162` audited against the exclusive paths list.
  - One `[live]` criterion, so QA owes one browser pass.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean (`npm run build`).
  - [ ] `[unit]` `npm test -- evolutionGraph` proves, for **every** row of
        `MEGA_FORMES` and `GMAX_FORMES`, `name === formeDisplayName(forme.name)`,
        `note === forme.stoneName`, and `level === null`; and, for the Charizard
        family at level 36, the pinned rows: `['Mega Charizard X', 'Charizardite X']`,
        `['Mega Charizard Y', 'Charizardite Y']`,
        `['Gigantamax Charizard', 'Charizardite G']` as `[name, note]` pairs; and
        `['Gigantamax Toxtricity Low Key', 'Toxtricity-Low-Keyite G']` for the
        `toxtricitylowkey` G-Max row. Every species row in the same graphs has
        `note === null`. The explicit literals at today's lines 76 and 237-242 are
        rewritten in the same pass: after this task no expectation in the suite may
        still hold a `'X · Y'` information-row name.
  - [ ] `[unit]` The same suite keeps the information-row width walk and measures the
        two columns **together**: for every information row, the drawn width of
        `name + ' · ' + note` (the same string the row used to carry alone) stays inside
        `min(evoBoxWidth(row.depth), HUD_DETAIL_EVO_MAX_WIDTH)` — the same bound and
        the same helper the suite already uses (today 302-343), read on the
        concatenation so a long stone cannot silently overrun the row.
  - [ ] `[unit]` `evolutionRowNote` is pinned directly: `''` for a node with
        `level: null, note: null`; the note for `level: null, note: 'Charizardite X'`;
        `'Lv 36'` (English locale) for `level: 36, note: null`; and the **level wins**
        when a node carries both (`level: 36, note: 'Charizardite X'` still prints
        `'Lv 36'`).
  - [ ] `[unit]` `npm test -- detail/evolution` proves a Mega row's right column is
        the stone and not `null`: the view rows for `charizardmegax`,
        `charizardmegay` and `charizardgmax` carry
        `['Charizardite X', 'Charizardite Y', 'Charizardite G']` in `level`, a
        species row still reads `'Lv 16'` / `'Lv 36'`, and a base-form row stays
        `null`.
  - [ ] `[unit]` `npm test -- i18n` is green with both keys gone
        (`grep -c "megaEvolvesWith\|gmaxEvolvesWith" src/i18n/*.ts` prints `0` for
        both files), and `grep -rn "EvolvesWith" src/` returns nothing.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched
        (`git diff --name-only main...task-162`), in particular not
        `src/ui/hud/panels/detail/view.ts`, `detail.css` or `src/ui/partyDetail.ts`.
  - [ ] `[live]` **The two columns on a real Charizard's STATS tab.** Measurement, at
        viewport **390×844**, dev server (`npm run dev -- --port <free>
        --strictPort`), URL with `?hud=dom` (the DOM HUD, `src/ui/hud/mount.ts`
        `hudRequested`): start a run, give the party a `charizard` at level 36 through
        the dev-only `#debug-menu` (add-Pokémon control), open that member's detail
        card and click `[data-hud-detail-tab="stats"]`. The graph of a Charizard at
        level 36 has six rows in this order — `charmander`, `charmeleon`, `charizard`,
        `charizardmegax`, `charizardmegay`, `charizardgmax` — so the three information
        rows are `3`, `4` and `5`. In the page, for each `i` of `3, 4, 5`, read three
        elements (note the DOM split — the level `<text>` is **inside** the row's
        `<g>`, the name is a **sibling** span in `.detail__evo-names`, so index it
        separately):

        ```js
        const row = document.querySelector('[data-hud-detail-evo-row="' + i + '"]');
        const level = row.querySelector('.detail__evo-level');            // may be null
        const name = document.querySelectorAll('.detail__evo-names .detail__evo-name')[i];
        ```

        Pass when all three hold: (a) all three `level` elements exist and their
        `textContent` are exactly `Charizardite X`, `Charizardite Y`,
        `Charizardite G`, and the three `name` elements read `Mega Charizard X`,
        `Mega Charizard Y`, `Gigantamax Charizard`; (b) each level's
        `getBoundingClientRect()` satisfies
        `rowRight - 16 <= level.right <= rowRight`, where `rowRight` is the row `<g>`'s
        own `getBoundingClientRect().right` (the stone ends within 16 px of the row's
        right edge); (c) `name.right <= level.left` on each of the three rows (the two
        columns do not overlap). Report the six rects per row with the verdict.
        Whether the row also *looks* right inside a 390 px card is the agent-review
        residue, not a pass condition.

## 📣 Coordination

- **For the next batch:** the right column of a graph row is
  `evolutionRowNote(node)` and nothing else; any new battle-only row (another
  information kind) sets `note` and never composes copy into `name`. The two retired
  i18n keys are gone — do not re-add them, and do not build a new key for a stone
  name (dex names stay English, `AGENTS.md`).
- **For Task QA / Integration QA:** `src/ui/hud/panels/detail/view.ts` is deliberately
  untouched. `DetailEvolutionRowView.level` is documented in `evolution.ts` as "the
  right column's text", which is why the stone rides that field; that is a decision of
  this spec, not a mistake.
- **For the Orchestrator:** `detailPanel.tsx` is claimed but may end up unchanged; the
  Task QA audit must accept a diff that omits it.

## ⛔ Out of scope

- No change to `DetailEvolutionRowView`, `detail.css`, `view.ts`, `partyDetail.ts` or
  the SVG edge arithmetic (`edgePath`, `EVO_*` constants).
- No new i18n key, no Spanish translation of a stone or forme name (dex names stay
  English), no change to `detail.evoLevel`.
- No new information row kind, no clickability change (`ready`/`current` untouched),
  no row-count or `EVO_MAX_ROWS` change.
- No `src/data/**`, `package.json`, `docs/` file other than `docs/design-spec.md` §3,
  and nothing in another task's list (`src/engine/battle/*`, `docs/battle-spec.md`,
  `src/data/tilesets/props.ts`, `src/scenes/BattleScene.ts`).
