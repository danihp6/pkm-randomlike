# Spec: Task-149 — The 61 DLC descriptions, authored in the repo

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** data / content (no engine rule, no scene).
- **Role:** Dev.
- **Objective:** the Spanish content table under `src/data/i18n/es/` stops having
  holes. Exactly the **18 moves** and **43 abilities** that
  `src/data/i18n/es/meta.json` lists in `missingDescriptions` get a real
  `description` and `shortDescription`, **authored in the repo, in Spanish**, from the
  dex's own English `desc` / `shortDesc`. `meta.json` is then recomputed so both
  `missingDescriptions` lists are `[]` and `src/i18n/content.ts`'s `MISSING_ES`
  resolves to `[]`. `src/i18n/content.test.ts` flips from "these ids are missing" to
  "nothing is missing, and the authored text is Spanish prose".
- **Environment:** worktree `../wt-pkm-149`, branch `task-149`.
- **Dependencies:** none. `D43`'s tables and accessors are shipped.

### Exclusive paths (single writer)

Nothing outside this list. Do not create a new file.

- `src/data/i18n/es/moves.json`
- `src/data/i18n/es/abilities.json`
- `src/data/i18n/es/meta.json`
- `src/i18n/content.test.ts`

### Inputs (read-only)

- `src/data/dex/moves.json`, `src/data/dex/abilities.json` — the English `desc` /
  `shortDesc` each authored string is written from.
- `src/i18n/content.ts` — read `MISSING_ES` and the accessors; do not edit it.
- `docs/data-spec.md`, `AGENTS.md`.

## 🔒 Contract

This task exports nothing new and changes no accessor. The contract it must not
break is `src/i18n/content.ts`'s:

```ts
export const MISSING_ES: readonly string[]; // must become []
moveName(id: string): string;               // unchanged
moveDescription(id: string): string;        // now non-empty for the 18
abilityName(id: string): string;
abilityDescription(id: string): string;     // now non-empty for the 43
```

- **Determinism:** reads no RNG and writes no run field. **No `SAVE_VERSION` step.**
- The dex's own strings (`src/data/dex/**`) stay English and are never touched.

### The language rule (read this twice)

`D43`/`D52`: a move's or an ability's **name** is the official Spanish string and it is
**already in these tables** — never rewrite a name. Only the two **description**
fields are authored here.

The backlog entry quotes three names as spot-check targets with values that are
**literal translations, not the shipped official ones**. The shipped rows win (they
come from PokeAPI's official Spanish strings); assert what the table already holds:

| id | shipped `name` (assert this) |
|---|---|
| `alluringvoice` | `Canto Encantador` |
| `dragoncheer` | `Bramido Dragón` |
| `malignantchain` | `Cadena Virulenta` |

## 🧩 Data and configuration

The 18 moves are exactly `meta.json`'s `moves.missingDescriptions`; the 43 abilities,
`abilities.missingDescriptions`. After the work: `moves.described` = **835**,
`abilities.described` = **311**, both `missingDescriptions` = `[]`,
`missingNames` stay `[]`, `total`/`named` unchanged.

Every one of the 61 rows already exists with a name and two empty strings, e.g.

```json
"alluringvoice": { "name": "Canto Encantador", "description": "", "shortDescription": "" }
```

Write both fields for each of them:

- `description`: 1–2 Spanish sentences, **15–200 characters**, paraphrasing the English
  `desc` (fall back to the English `shortDesc` when `desc` is empty). Plain prose, no
  English words, no ids, no code.
- `shortDescription`: one Spanish clause, **10–80 characters**, the same effect in
  fewer words. It may equal `description` when the long one is already one short
  sentence (that is how the shipped `tackle` row reads).

Keep the JSON shape and formatting: 2-space indent, keys in their current order, no
reordering, no new/removed keys. `JSON.parse` + `JSON.stringify(value, null, 2)` +
trailing newline preserves order for these non-numeric ids and is the safest edit path.

### Regenerating `meta.json` — do it locally, **not** with the generator

**Never run `node scripts/build-i18n-content.mjs`** in this task. It re-downloads the
PokeAPI CSV dump and rewrites `moves.json`/`abilities.json` from it, which would
**overwrite every string you just authored with the empty dump value** (that is
exactly why the 61 were empty). Nothing in `scripts/` is in your paths.

Recompute `meta.json` from the authored files with this exact one-off, from the
worktree root, once the 61 rows are filled:

```bash
node -e "
const fs=require('fs');
const dir='src/data/i18n/es';
const m=JSON.parse(fs.readFileSync(dir+'/moves.json','utf8'));
const a=JSON.parse(fs.readFileSync(dir+'/abilities.json','utf8'));
const meta=JSON.parse(fs.readFileSync(dir+'/meta.json','utf8'));
meta.moves.described=Object.values(m).filter(r=>r.description.length>0).length;
meta.moves.missingDescriptions=Object.keys(m).filter(id=>!(m[id].description.length>0));
meta.abilities.described=Object.values(a).filter(r=>r.description.length>0).length;
meta.abilities.missingDescriptions=Object.keys(a).filter(id=>!(a[id].description.length>0));
fs.writeFileSync(dir+'/meta.json', JSON.stringify(meta,null,2)+'\n');
"
```

It must print nothing and leave `described` at 835/311 with both lists `[]`.

## 🧪 Test and Validation Plan (for QA)

All criteria are `[unit]`. **No browser pass is owed by this task** — it changes JSON
content and a headless test only.

- **Method:**
  - `npm test` — Vitest, headless; green, including the rewritten `content.test.ts`.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-149` audit against the four exclusive paths.

Rewrite `src/i18n/content.test.ts` so it asserts the new truth (the current file
asserts the opposite):

- `MISSING_ES` is `[]`.
- `meta.moves.described` is `835`, `meta.abilities.described` is `311`,
  `meta.moves.missingNames` and `meta.abilities.missingNames` are `[]`.
- Keep the existing "official names, not literal translations" cases and add the
  three rows from the table above.
- Add, for each of the two tables, a test that walks the whole table and asserts:
  (a) every `description` and `shortDescription` is non-empty and within the length
  bounds above; (b) **no row's `description` equals, case-insensitively and trimmed,
  the English `desc` or `shortDesc` of the same id from `src/data/dex/{moves,abilities}.json`**;
  (c) no row's description contains any of these English tokens, lowercased:
  `" the "`, `" and "`, `" with "`, `" this "`, `" move "`, `" damage "`, `" power "`,
  `" user "`, `" target "` (pad the string with spaces before searching so a
  sentence-initial word is caught).
- Keep the `en`-locale half of the existing suite untouched (English strings intact).

### Acceptance criteria

- [ ] `[unit]` `npm run build` is clean (`tsc --noEmit` + `vite build`).
- [ ] `[unit]` `npm test` is green, including the rewritten `content.test.ts`.
- [ ] `[unit]` `MISSING_ES` is `[]` and `meta.json` says `described` 835 / 311 with
      both `missingDescriptions` `[]` — checked by the test, not by eye.
- [ ] `[unit]` All 61 rows carry a `description` of 15–200 chars and a
      `shortDescription` of 10–80 chars, and no description is an English echo of the
      dex row (the table-walking test above).
- [ ] `[unit]` The three spot-check names read `Canto Encantador`, `Bramido Dragón`,
      `Cadena Virulenta`.
- [ ] `[unit]` `git diff --name-only main...task-149` lists only the four exclusive
      paths.

## 📣 Coordination

- For the Architect: the backlog's three spot-check values were literal translations;
  the shipped official names (`Bramido Dragón`, `Cadena Virulenta`) are asserted
  instead and the entry's wording should be corrected in `TODO.md`.
- For the Architect: `scripts/build-i18n-content.mjs` still overwrites authored rows.
  A follow-up (outside this batch) should make it merge instead of overwrite, so this
  hole never reopens.
- For the next batch: after this task, any new dex ability needs a row here too —
  `[Task-151]`'s `darkmatter` is **not** part of this table (its Spanish copy lives in
  its own hand-authored row), so `total`/`named` stay 311.

## ⛔ Out of scope

- Rewriting any `name`.
- Teaching the generator to preserve authored rows (a `scripts/` change).
- The English source table, the engine, the scenes, `SAVE_VERSION`.
- Adding `darkmatter` or any id that is not already a key in the two tables.
