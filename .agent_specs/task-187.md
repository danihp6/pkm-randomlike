# Spec: Task-187 — Every pack-less placeholder carries its own accent

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** tooling + generated assets + docs.
- **Role:** Dev.
- **Objective:** on a tree **without** the packed art (every clone, and every agent
  worktree), each fallback atlas under `src/assets/placeholders/` paints **its own**
  colour instead of the one uniform swatch pair that ships today
  (`#3A4252` fill / `#7888A0` border, `scripts/assets/build-placeholders.mjs`
  50-52). That uniform pair is why a whole-screen criterion like "no 24×24 square of
  the placeholder's paint" could never hold: a tileset placeholder matched the rule
  four runs out of ten, 90 px away from the object under test (issue #68). After
  this task the accent is a **stable function of the atlas path**, the committed
  blanks are regenerated, and the rule is written down where the contract lives.
- **Environment:** repository `/home/runner/work/pkm-randomlike/pkm-randomlike`,
  worktree `../wt-pkm-187`, branch `task-187`. Work only inside the worktree.
- **Dependencies:** none.

### Exclusive paths (single writer)

Nothing outside this list:

- `scripts/assets/build-placeholders.mjs` (the existing generator)
- `scripts/assets/placeholderAccent.mjs` (**new**: the pure accent rule)
- `scripts/assets/placeholderAccent.test.mjs` (**new**: its test)
- `src/assets/placeholders/**` (the committed blanks, **regenerated**, never
  hand-edited)
- `src/assets/README.md` (the placeholders row / the rules list)

Do not touch `src/assets/placeholders/audio/silence.wav`, `scripts/assets/pack.mjs`,
`package.json`, any `src/**/*.ts` source, or any atlas outside `placeholders/`.

### Inputs (read-only)

- `AGENTS.md` (the **Asset trees** rule)
- `scripts/legacy-art/png-codec.mjs` (`decodePng` / `encodePng` — already the
  generator's own codec)
- `src/assets/README.md` (the whole file, before you edit it)
- `package.json` (`assets:placeholders` already runs the script)

## 🔒 Contract

### TypeScript/JS surface

`scripts/assets/placeholderAccent.mjs` is pure Node (no `fs`, no `process`, no
clock) and exports:

```js
/**
 * The two colours one placeholder paints with, derived only from its atlas path.
 * Deterministic: the same path always answers the same pair, across runs and
 * machines, so a committed blank and its criterion never disagree.
 */
export function accentFor(path: string): {
  fill: readonly [number, number, number];
  border: readonly [number, number, number];
};
```

Rules the function and its test must satisfy:

1. **Stable per path.** `accentFor('frlg/forest.png')` twice → deep-equal pairs.
2. **Distinct across the set.** All twenty paths in `ATLASES`
   (`scripts/assets/build-placeholders.mjs` 27-48) get **pairwise different** fills.
   A hash into a small palette is fine only if it has at least twenty entries and
   collides on none of those twenty paths; a hash-derived hue is fine too.
3. **Readable as a blank, never as the old one.** `fill` and `border` stay in the
   same dark range the current pair lives in (fill luminance below 45 %, border
   lighter than fill), and both are at least **16** away (Euclidean distance over
   RGB) from the two legacy colours `(58, 66, 82)` and `(120, 136, 160)`, so a
   screen-wide scan for the old fill can return zero.
4. **The sign keeps its silhouette.** `frlg/sign.png` still paints a transparent
   board-and-post (alpha 0 at its corners, the board band and the post where they
   are today), using **its own** accent for the board's border and the post's fill.
   Task-165's fix is not undone and the shape never changes.

### The generator

`scripts/assets/build-placeholders.mjs` keeps its interface
(`node scripts/assets/build-placeholders.mjs [atlas…]`, the `ATLASES` allow-list
and its error on an unknown name) and changes only how a blank is painted:

- Every atlas takes `accentFor(path)` instead of the two module constants; the
  edge keeps `border`, the interior keeps `fill`, the alpha stays `255`.
- **Size source.** The real atlas is read when it exists
  (`src/assets/<path>`, gitignored). When it does not — as in this worktree, where
  `src/assets/frlg/`, `src/assets/anil/` and the biome sheets are absent — the
  generator takes the **pixel size from the committed placeholder it is replacing**
  (`src/assets/placeholders/<path>`, decoded with `decodePng`) and rewrites that
  file with the new accent. This keeps `src/assets/README.md`'s contract (a blank
  carries the real file's pixel size) without needing the store, and makes the
  script runnable and idempotent on any clone. Log which source the size came from.
- The sign branch keeps its 16×16 geometry and its transparency; only its two
  colours come from `accentFor`.
- Rerunning the script on an already regenerated tree writes **identical bytes**
  (no timestamps, no random, no map iteration order dependence).

Regenerate the committed blanks by running the script in the worktree and
committing its output. The diff must show colour changes only: **no PNG changes
dimensions** and no file is added or removed.

## 🧩 Data and configuration

- No new data key and no balancing value. The twenty atlas paths stay the allow-list
  the generator already carries.
- `src/assets/README.md` gains the one rule the contract was missing, next to the
  existing placeholders row/rules: *one accent per placeholder, derived from its
  path and stable across runs, so a criterion can be measured screen-wide; the sign
  keeps its silhouette and its own accent; a blank still carries the real file's
  pixel size.*

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green. Vitest already collects
    `*.test.mjs` (see `scripts/agent/recon.test.mjs`), so the new test runs under it
    with no config change.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-187` against the exclusive paths above.
  - `node scripts/assets/build-placeholders.mjs` twice, then
    `git status --porcelain src/assets/placeholders` must be empty.
  - Browser pass for the one `[live]` criterion, on a **pack-less** tree (this
    worktree is one: `ls src/assets/frlg` is empty), reading the canvas with
    `renderer.snapshotArea` + `getImageData` — never a screenshot.
- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` typechecks and builds clean.
  - [ ] `[unit]` `accentFor(path)` is stable: the same path twice is deep-equal.
  - [ ] `[unit]` the twenty `ATLASES` paths have pairwise different `fill` values
        (a nested loop over the real list, no hand-copied array).
  - [ ] `[unit]` every accent's `fill` and `border` are ≥ 16 (RGB Euclidean) from
        `(58, 66, 82)` and `(120, 136, 160)`.
  - [ ] `[unit]` each committed blank **decodes** to its own accent: with
        `decodePng(readFileSync('src/assets/placeholders/' + path))`, the pixel at
        `(0, 0)` is the accent's `border` and the centre pixel is its `fill` — for
        every path except the sign.
  - [ ] `[unit]` the sign decodes to alpha 0 at `(0, 0)`, to its accent's `border`
        inside the board band and to its accent's `fill` on the post — so its
        silhouette survived.
  - [ ] `[unit]` `node scripts/assets/build-placeholders.mjs` run twice leaves
        `git status --porcelain src/assets/placeholders` empty (idempotent), and the
        commit changes no PNG's width or height (decode the file at `main` and at
        the branch tip and compare sizes).
  - [ ] `[unit]` `git diff --name-only main...task-187` lists only the exclusive
        paths — no `src/assets/placeholders/audio/**`, no atlas outside
        `placeholders/`, no `package.json`.
  - [ ] `[live]` On a pack-less dev server, start a run and stand on the first
        route. Read the canvas (`renderer.snapshotArea` over the whole canvas, then
        `getImageData`): **0 px** equal to the old fill `(58, 66, 82)`, **≥ 500 px**
        equal to `accentFor('frlg/forest.png').fill` and **≥ 500 px** equal to the
        fill of a second atlas the route draws (`frlg/overworld.png` or
        `frlg/ground-item.png`, whichever the screen paints; name which one you
        measured and where). Report the counts and the rectangle you sampled.

## 📣 Coordination

- **For the Architect:** the generator gained a size fallback (`placeholders/`
  itself) so it runs without the store; `[Task-184]`'s injectable-packer note and
  any future "regenerate the blanks" task can rely on that.
- **For the next batch:** a screen-wide placeholder criterion is measurable from now
  on, because two different atlases never share a fill. `[Task-188]`/`[Task-189]`
  in this same batch do not touch `src/assets/**`.
- **Path note:** the entry claimed `scripts/assets/build-placeholders.mjs`,
  `src/assets/placeholders/**` and `src/assets/README.md`; the pure accent rule and
  its test are two new files in the same folder, added here so the rule is testable
  headlessly instead of only through the script's side effects.

## ⛔ Out of scope

- Do not repack, recolour or regenerate any **real** atlas, and do not run
  `npm run assets:pack`.
- Do not change the placeholder pixel sizes, the `ATLASES` contents, or the
  `audio/silence.wav` blank.
- Do not add a runtime module under `src/**`, a manifest, or a `package.json`
  script.
- Do not turn the accents into a data file: the palette stays in
  `placeholderAccent.mjs`.

## 📦 Delivery protocol (read this last, then execute it)

1. `npm ci --prefer-offline --no-audit --no-fund` once in the worktree.
2. Implement, regenerate the blanks, then run `npm test` and `npm run build`. Both
   must be green before you commit.
3. Commit in English, imperative; commit the regenerated PNGs **with** the script
   change (a reader must never see the new rule with the old blanks).
4. Leave the branch tip as an **empty** commit:
   `git commit --allow-empty -m "dev: done task-187"`, then
   `git push origin task-187`.
5. Report: what you changed per file, the two gate results, the number of
   placeholders rewritten, and the exact `git rev-parse HEAD` sha of the tip you
   pushed. If a gate is red and you cannot fix it, say so plainly and do not push a
   `dev: done`.
