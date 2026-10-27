# Spec: Task-186 — The eleven no-op berries reach a run from three seams, and the spec says one

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** docs.
- **Role:** Dev.
- **Objective:** After this task, `docs/maps-spec.md` §7's **held-tier bullet** no
  longer claims that the eleven berry-class no-op berries reach a run from the `mid`
  ground-loot pool **alone**. That one sentence attributes each of the eleven to
  every seam that actually hands it to a run — the `mid` ground-loot pool, the
  berry-tree NPC's shake, and a Honey Gather party member's battle win — while the
  operative claim it protects (`no band's Mart stocks one, so this is a repricing
  and not a restock`) and the pricing rule around it stay **byte-identical**. No
  code, no data table, no test and no other document changes.
- **Environment:** worktree `../wt-pkm-186`, branch `task-186`.
- **Dependencies:** none. Everything this bullet describes already ships on `main`:
  the eleven rows and their 1000 price (`src/data/items.ts` 778-788), the `mid`
  ground-loot pool (`src/data/loot.ts` 79-89), `BERRY_IDS` with `leppaberry`
  (`src/data/npcs.ts` 245-260), the berry-tree shake (`npcBerryHarvest`,
  `src/engine/routes/npcs.ts` 258-266, wired at `src/scenes/RouteScene.ts` 3107-3130)
  and the Honey Gather row (`src/data/passives.ts` 32-36, folded by `runPassives` at
  `src/scenes/RouteScene.ts` 3769).

### Exclusive paths (single writer)

This task writes **one** path, and only one part of it:

- `docs/maps-spec.md` — **§7 only** (`## 7. Special rooms & the economy (D33)`,
  line 308 to line 882 on `main`), and inside §7 **only the held-tier bullet** under
  `### The economy (Poké Dollars)`: the bullet that starts
  `- **A held berry the engine never spends costs the held tier (1000)**` (lines
  860-868 on `main`).

Nothing else. In particular: no other bullet or paragraph of §7, no §6, no §8, no
§10, no other `docs/*.md` (a batch-mate owns `docs/design-spec.md` §2 and another
owns §3 — do not open them), no `README.md`, no `TODO.md`, no `CHANGELOG.md`, no
`.agent_specs/`, and no `src/**` file of any kind.

### Inputs (read-only)

Beyond `AGENTS.md` itself:

- `docs/maps-spec.md` — §7's held-tier bullet (the text to change), and, for backing
  only, the §7 NPC table row for `berry-tree` (line 615) and the cures/X-items
  sentence (lines 853-856) **which you must not touch**.
- `src/data/npcs.ts` — `BERRY_IDS` (245-260; `leppaberry` at 259), `BERRY_TREE_MIN` /
  `BERRY_TREE_CAP` (269-270), the `berry-tree` NPC row (223-231).
- `src/engine/routes/npcs.ts` — `npcBerryHarvest` (258-266): the species roll.
- `src/scenes/RouteScene.ts` — the berry-tree handler (3107-3130: `npcBerryHarvest`
  then `addItem` per berry), `applyMapPassives` (884-891) and the win site (3769).
- `src/data/passives.ts` — `MAP_PASSIVES`, the `honeygather` row (32-36).
- `src/engine/run/passives.ts` — `runPassives` (55-78): the item roll and `addItem`.
- `src/data/loot.ts` — `ROUTE_LOOT.mid.pool` (66-…; the eleven at 79-89).
- `src/data/shop.ts` — `SHOP_ROTATION` (61-152).
- `src/data/items.ts` — the eleven rows (778-788).
- `src/data/items.test.ts` (180-214), `src/data/loot.test.ts` (130-170),
  `src/data/shop.test.ts` — the shipped pins this bullet must not contradict.

### Measured state before the task (recon ran on `main`, 2026-10-27)

**1. The sentence to change.** `docs/maps-spec.md`, §7, bullet at lines 860-868. The
last sentence of the bullet is (lines 866-868, verbatim, two-space continuation
indent):

```
  its 100–200 (Oran, Sitrus, Lum and the cure, pinch and resist berries). Those
  eleven reach a run from the `mid` **ground-loot** pool alone and no band's Mart
  stocks one, so this is a repricing and not a restock.
```

Only the words that make the `mid` pool the **only** seam are wrong; the pricing
rule above it ("**no for-sale held item without `consumed: true` is priced under
1000**", lines 863-865) and the operative claim ("no band's Mart stocks one, so this
is a repricing and not a restock", lines 867-868) are correct and stay verbatim.

**2. Seam one — the `mid` ground-loot pool.** All eleven ids sit in
`ROUTE_LOOT.mid.pool` (`src/data/loot.ts` 79-89: `custapberry`, `enigmaberry`,
`jabocaberry`, `keeberry`, `lansatberry`, `leppaberry`, `marangaberry`,
`persimberry`, `rowapberry`, `starfberry`, `tamatoberry`) and in no other band's
pool (11 hits in the whole file), which `src/data/loot.test.ts` 130-170 pins
byte-for-byte.

**3. Seam two — the berry-tree NPC (Leppa Berry).** `BERRY_IDS`
(`src/data/npcs.ts` 245-260) has 14 rows and **`leppaberry` is one of them** (line
259); of the eleven it is the only one. It is reachable in practice:
`npcBerryHarvest` (`src/engine/routes/npcs.ts` 258-266) draws
`Rng.int(BERRY_TREE_MIN, BERRY_TREE_CAP)` berries (1-4) and then one
`Rng.int(0, BERRY_IDS.length - 1)` **per berry on the same stream**, i.e. uniform
over all 14 ids with no filtering, so each given berry is Leppa with probability
1/14. The handler `RouteScene` 3107-3130 folds the list into the run with
`addItem(run, berry)` (one unit each) and marks the NPC used, so one shake per
berry tree per floor. `BERRY_IDS` is also the chef's list (`chefTrade`), where the
berries are **spent**, not given: it is not a reach seam.

**4. Seam three — Honey Gather (Leppa Berry and Persim Berry).** `MAP_PASSIVES`'s
`honeygather` row (`src/data/passives.ts` 32-36) is
`{ chance: 0.5, itemIds: ['sitrusberry', 'leppaberry', 'persimberry'] }`, trigger
`win`. `runPassives` (`src/engine/run/passives.ts` 55-78) folds it when a **party**
member holds the ability, rolls the chance, draws one id uniformly and adds it with
`addItem`, and `RouteScene` calls it on every won battle
(`applyMapPassives('win')`, line 3769, for `outcome === 'win' | 'capture'`). So two
of the eleven — Leppa and Persim — reach a run from this seam too, at 1/6 per
qualifying win.

The plan entry for this task says "two seams"; the tree has **three**. The spec
below pins the three-seam sentence, because a two-seam sentence would still be a
half-truth about Leppa/Persim. See Coordination.

**5. The operative claim is true and unchanged.** Reading all six bands of
`SHOP_ROTATION` (`src/data/shop.ts` 61-152: `early`, `low`, `mid`, `high`, `late`,
`end`) turns up **no** id of the eleven — the marts stock Oran/Cheri/Chesto/Sitrus/
Pecha/Rawst/Aspear/Figy/Wiki/Mago/Aguav/Iapapa/Lum/Liechi/Ganlon/Petaya/Apicot/
Salac/Micle/Occa/Passho/Wacan/Rindo/Yache/Chople/Kebia/Shuca/Coba/Payapa/Tanga/
Charti/Kasib/Haban/Colbur/Babiri/Roseli/Chilan berries, plus held items — so the
shelf never restocks one and the change is a repricing. Note that this absence is
**not** pinned by a named test: `src/data/items.test.ts` 180-214 pins the eleven ids
and their `1000` / buy `1000` / sell `500` prices, `src/data/loot.test.ts` pins the
`mid` pool, and `src/data/shop.test.ts` pins only generic rotation invariants. The
absence is verified by the command in criterion 8.

## 🔒 Contract

This task creates no TypeScript surface, no data key and no asset. The only public
surface it freezes is **prose**, and it is frozen here byte-for-byte.

### TypeScript

None. This task exports nothing, imports nothing and touches no `.ts` file. No Phaser,
no RNG, no allocation budget: the change is text inside one markdown paragraph.

### The frozen replacement (the whole of the change)

In `docs/maps-spec.md`, inside the held-tier bullet, replace these **three** lines
(lines 866-868 on `main`):

```
  its 100–200 (Oran, Sitrus, Lum and the cure, pinch and resist berries). Those
  eleven reach a run from the `mid` **ground-loot** pool alone and no band's Mart
  stocks one, so this is a repricing and not a restock.
```

with these **five** lines:

```
  its 100–200 (Oran, Sitrus, Lum and the cure, pinch and resist berries).
  Those eleven reach a run from the `mid` **ground-loot** pool, the berry-tree NPC's
  shake (Leppa Berry) and a Honey Gather party member's battle win (Leppa Berry,
  Persim Berry), and no band's Mart stocks one, so this is a repricing and not a
  restock.
```

Rules that come with it:

- The continuation indent is **two spaces**, exactly as the rest of the bullet.
- The first line carries an **en dash** (`–`, U+2013) inside `100–200`; the bullet
  also carries an em dash (`—`) earlier and an arrow (`→`) at "200 → 1000". Copy the
  untouched lines from the file; never retype a dash.
- The sentence `Those eleven reach a run from …` starts a **source line of its own**
  (it used to start mid-line) so the paragraph stays greppable; it is the same
  paragraph, no blank line is added or removed anywhere.
- Nothing else in the bullet moves: the opening sentence
  (`**A held berry the engine never spends costs the held tier (1000)**`), the pricing
  rule that follows it (`are the only rows that broke the rule — no for-sale held item
  without consumed: true is priced under 1000 —`, whose `consumed: true` keeps its
  backticks in the file) and `and they move 200 → 1000` stay byte-identical.
- The bullet must grow from **9** lines to **11** lines (3 removed, 5 added) and the
  whole file diff is that one hunk.
- Word ban: the bullet must not contain `alone` anywhere, and the reach sentence must
  not contain `alone` or `only`. The pricing sentence's `the only rows that broke the
  rule` **stays** — that is the single legitimate `only` of the bullet.

### Data

- No key, no JSON, no default. The numbers the bullet quotes — `1000`, `100–200`,
  `200 → 1000` — are quotes of `src/data/items.ts` and must not change; the prices
  themselves are out of scope.

## 🧩 Data and configuration

None. No `src/data/` file, no `docs/balance/` spreadsheet, no locale key: the
corrected sentence names existing tables (`BERRY_IDS`, `MAP_PASSIVES`,
`ROUTE_LOOT.mid`, `SHOP_ROTATION`) in prose only.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green. **No test is added by this task**;
    the suites that already pin the claims must stay green (`src/data/items.test.ts`
    "the held tier (Task-178)", `src/data/loot.test.ts` "leaves the four earlier
    shelves byte-identical", `src/data/shop.test.ts`).
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-186` and `git diff -U0 main...task-186 -- docs/maps-spec.md`
    audited against the exclusive paths list and the frozen block above.
  - The bullet extractor used by criteria 6 and 8 (and by the `wc -l` check):
    ```sh
    awk '/^- \*\*A held berry the engine never spends/{f=1;print;next} f && /^- /{exit} f' docs/maps-spec.md > /tmp/b186.txt
    ```
    It prints exactly the held-tier bullet and nothing else; `wc -l /tmp/b186.txt`
    must print `11`.
  - A task whose criteria are all `[unit]` owes **no** browser pass — and this is one:
    **no browser pass is owed, and none must be run**, because nothing this task
    changes is visible in the game. Do not open the game for this task.
- **Acceptance criteria:** every one is `[unit]`; there is no `[live]` criterion.
  - [ ] `[unit]` `npm run build` exits 0 (`tsc --noEmit && vite build`).
  - [ ] `[unit]` `npm test` exits 0, with no test file added or edited — the price
        rule, the `mid` pool and the shop rotation suites that shipped on `main` are
        still green.
  - [ ] `[unit]` `git diff --name-only main...task-186` prints exactly one path:
        `docs/maps-spec.md`. Nothing else — no code, no data, no README, no
        `TODO.md`, no `CHANGELOG.md`, no `.agent_specs/`.
  - [ ] `[unit]` The change is one hunk confined to the held-tier bullet:
        `git diff -U0 main...task-186 -- docs/maps-spec.md | grep -c '^@@'` prints
        `1`, the hunk's `-` lines are exactly the three pinned lines and its `+`
        lines exactly the five pinned lines (byte-for-byte, en dash included), and
        `git diff --numstat main...task-186 -- docs/maps-spec.md` prints
        `5	3	docs/maps-spec.md` (5 added, 3 removed, same file). No line of §8, of
        the `### The economy (Poké Dollars)` heading, or of any other §7 bullet
        appears in the diff.
  - [ ] `[unit]` The corrected sentence names all three seams:
        `grep -nF 'Those eleven reach a run from the `mid` **ground-loot** pool, the berry-tree NPC' docs/maps-spec.md`
        prints one line;
        `grep -nF 'shake (Leppa Berry) and a Honey Gather party member' docs/maps-spec.md`
        prints one line; and
        `grep -nF 'Persim Berry), and no band's Mart stocks one, so this is a repricing and not a restock.' docs/maps-spec.md`
        prints one line.
  - [ ] `[unit]` The exclusivity claim is gone: `grep -c 'alone' /tmp/b186.txt` prints
        `0`; `grep -c 'only' /tmp/b186.txt` prints exactly `1`, and that one hit is
        the retained pricing sentence
        (`grep -c 'are the only rows' /tmp/b186.txt` prints `1`, and its line is the
        pricing sentence that starts `Lansat, Leppa, Maranga, Persim, Rowap, Starf and
        Tamato Berry)`);
        `grep -c 'reach a run.*only' /tmp/b186.txt` prints `0` and
        `grep -c 'reach a run.*alone' /tmp/b186.txt` prints `0`. (`grep -c` prints
        `0` and exits 1 on no match — the printed `0` is the result.) The rest of the
        bullet is unchanged: `/tmp/b186.txt` still contains
        `**A held berry the engine never spends costs the held tier (1000)**` and
        `and they move 200 → 1000`.
  - [ ] `[unit]` The three seams still exist in the tree, so the new sentence is
        true and not a guess:
        `sed -n '/^  mid: {/,/^  },/p' src/data/loot.ts | grep -cE "entry\('(custapberry|enigmaberry|jabocaberry|keeberry|lansatberry|leppaberry|marangaberry|persimberry|rowapberry|starfberry|tamatoberry)'"`
        prints `11`;
        `grep -c "'leppaberry'," src/data/npcs.ts` prints `1` inside `BERRY_IDS`;
        `grep -cF "itemIds: ['sitrusberry', 'leppaberry', 'persimberry']" src/data/passives.ts`
        prints `1`; and
        `grep -cF 'BERRY_IDS[rng.int(0, BERRY_IDS.length - 1)]' src/engine/routes/npcs.ts`
        prints `1`.
  - [ ] `[unit]` The operative claim it protects is still true and untouched:
        `sed -n '/^export const SHOP_ROTATION/,/^};/p' src/data/shop.ts | grep -cE "e\('(custapberry|enigmaberry|jabocaberry|keeberry|lansatberry|leppaberry|marangaberry|persimberry|rowapberry|starfberry|tamatoberry)'"`
        prints `0` (prints `0`, exits 1 — the printed `0` is the result), and
        `grep -c 'stocks one' /tmp/b186.txt` prints `1`.
  - [ ] `[unit]` No other document drifted: `git diff --name-only main...task-186`
        contains `docs/design-spec.md` **zero** times (§2 and §3 belong to other tasks
        in this batch) and `docs/maps-spec.md` exactly once, and `docs/maps-spec.md`
        was not reformatted elsewhere — criterion 4's single hunk of 3 removed and 5
        added lines is the proof.

## 📣 Coordination

- **For the Architect:** the plan entry's title and fix shape say the sentence must
  name **two** seams. The recon above found **three** — the `BERRY_IDS` berry tree
  (Leppa Berry) *and* the `honeygather` row of `MAP_PASSIVES`, folded on every won
  battle, which hands out Leppa Berry or Persim Berry. The spec pins the three-seam
  sentence; a two-seam sentence would still have been a half-truth. If the batch
  ledger or the changelog line quotes a count, it should say three, and the `TODO.md`
  wording stays the Orchestrator's to fix (this task edits no backlog file). The
  plan's other two facts are correct as written: `BERRY_IDS` carries `leppaberry`,
  and `SHOP_ROTATION` stocks none of the eleven. The fourth claim — that the shop
  rotation is pinned by `src/data/items.test.ts` — is **not** correct: that file
  pins the eleven ids and the 1000/1000/500 price triple (180-214) but never
  mentions `SHOP_ROTATION`; the absence is checked by criterion 8 instead, and no
  test is added here because this task owns no test path.
- **For the batch ledger:** this task's whole diff is `docs/maps-spec.md` +5/−3 in one
  hunk, so Integration QA can merge it without touching the `docs/design-spec.md`
  sections claimed by the other two doc-touching tasks.
- **For the next batch:** the bullet now names `BERRY_IDS`, the berry-tree NPC and
  Honey Gather as the reach seams. Any later change to `BERRY_IDS`, to the
  `honeygather` row's `itemIds`, or to `ROUTE_LOOT.mid.pool` must update this bullet
  in the same task, exactly as the `docs/` rule asks. A future task may want to pin
  the eleven's absence from `SHOP_ROTATION` with a one-line assertion in
  `src/data/shop.test.ts` (this task does not — it owns no code path).
- **Sibling statement:** the §7 NPC table row for `berry-tree` (line 615) already
  says the shake gives 1-4 berries off `BERRY_IDS`; after this task the two
  statements agree. Do not edit line 615.

## ⛔ Out of scope

- Any change to `src/**` — code, data, tests, i18n, scenes, assets. The eleven's
  price (`1000`), `consumed`, `BERRY_IDS`, `MAP_PASSIVES`, `ROUTE_LOOT.mid.pool` and
  `SHOP_ROTATION` are all correct and stay as they are.
- Adding a test, a table, or a constant. This task owes **no** test.
- The cures/X-items sentence at lines 853-856 ("they reach a run from **ground loot**
  and the **mini-boss reward** alone") — a different bullet, out of this task, even
  though it also says "alone".
- The `### A room's battle condition`, `### The economy`'s other bullets, §6, §8,
  §9, §10 and every other `docs/*.md` (a batch-mate owns `docs/design-spec.md` §2 and
  another owns §3).
- Editing the `berry-tree` NPC table row (line 615), fixing prose style elsewhere,
  re-wrapping the bullet for width, or rewording the pricing rule.
- `TODO.md`, `CHANGELOG.md`, `.agent_specs/`: the Orchestrator owns the tick and the
  changelog entry; this task owns neither.
