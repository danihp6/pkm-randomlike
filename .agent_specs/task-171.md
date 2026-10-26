# Spec: Task-171 — The MOVES tab survives a change of member

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene (`src/scenes/panels/detail.ts`) plus a pure state helper
  in `src/ui/partyDetail.ts`, plus one docs sentence.
- **Role:** Dev.
- **Objective:** The member detail window's tab becomes a property of the **panel**, not
  of the member. Today every pick of a party/PC row rebuilds the state from scratch on
  STATS, so a player reading a member's MOVES tab is thrown back to STATS the moment
  they click another member. After this task, picking another member while the panel
  stands on MOVES leaves it on MOVES; a **closed** panel still opens on STATS, and every
  other reset the opener already performs (search field, learnset query, scroll, cursor,
  info popup, nickname edit, learn drag, `grab`) is byte-identical to today. The rule is
  expressed once, as a pure function beside `openDetail`, so it is unit-testable
  headless, and it reaches both entry points (the canvas row press and the `?hud=dom`
  party row) because both funnel through `openMemberDetail`.
- **Environment:** worktree `../wt-pkm-171`, branch `task-171`.
- **Dependencies:** none. No earlier task produced a file this task reads, and the
  batch's other task (the boss/mini-boss aggro rule) touches disjoint paths — see
  Coordination.

### Exclusive paths (single writer)

The list of paths this task creates or modifies. **Nothing outside this list.**
No other task in the batch may claim the same path. Deleting a stray `.gitkeep`
from a directory this task populates is always allowed.

- `src/ui/partyDetail.ts`
- `src/ui/partyDetail.test.ts`
- `src/scenes/panels/detail.ts`
- `docs/design-spec.md` — **§3 only** (`## 3. The party`, lines 65–252). One sentence is
  added to the detail-panel bullet; **no other line of that file changes** and no other
  section may be touched (`[Task-179]` owns §3's swap bullet in another batch; that
  bullet is at lines 68–73 and this task must not rewrite it).

**No README is claimed, and that is deliberate:** this task adds, renames and deletes
**no file** — it edits two existing modules and their co-located test — so AGENTS.md's
folder-map rule owes no README edit. `detail.ts` already has its line in
`src/scenes/panels/README.md` (line 26) and `partyDetail.ts` its line in
`src/ui/README.md` (line 52); both role lines stay true and stay untouched.

### Inputs (read-only)

Files this task may read, and only these, beyond `AGENTS.md` itself.

- `docs/design-spec.md` (the file it edits — read §3 in full before touching it)
- `docs/agent-spec-template.md`
- `src/scenes/RouteScene.ts` — **only** the canvas row press that calls
  `openMemberDetail` (around lines 1822–1827) and its `hudPress` bookkeeping. This file
  is **not** edited by this task.
- `src/scenes/panels/hud.ts` — the panel record, `panelById`, `panelExpanded`,
  `makeHudPanel`, and the layout constants the live probe reads.
- `src/scenes/panels/pc.ts` — `boxLeft()`/`boxTop()`, which dock the detail window.
- `src/scenes/panels/party.ts` — the party row hit test and row geometry (live probe).
- `src/ui/hud/panels/detail/view.ts`, `src/ui/hud/panels/detail/view.test.ts`,
  `src/ui/hud/panels/detail/detailPanel.tsx` — the DOM card that paints the tab the
  state carries. **Read to understand; never edit.**
- `src/ui/frlg.ts` and `src/data/ui/chrome.json` — the two tab tones (`FRLG_SELECTED_STROKE`,
  `FRLG_ROW_STROKE`) and their hex values, which the canvas live probe reads.
- `src/ui/README.md`, `src/scenes/panels/README.md` — to confirm that no README edit is
  owed.

Nothing under `src/engine/`, `src/data/dex/`, `package.json`, `src/main.ts`,
`vite.config.ts` is read or written by this task.

## 🔒 Contract

The public surface other tasks will be written against in parallel. It is a
promise, not a suggestion. Write the exact exported names and signatures.

### TypeScript

`src/ui/partyDetail.ts` — **add** exactly one exported function, and change nothing
else in the file:

```ts
/**
 * The tab a newly opened member keeps: the panel's own tab while a member is shown,
 * STATS when the panel is closed. The tab belongs to the panel, so picking another
 * member never throws the reader back to STATS.
 */
export function carriedDetailTab(state: DetailState): DetailTab;
```

- Behaviour, exactly: `state.memberId === null ? 'stats' : state.tab`.
  - `carriedDetailTab(CLOSED_DETAIL)` → `'stats'`.
  - `carriedDetailTab({ memberId: 'x', tab: 'moves', grab: 2 })` → `'moves'`.
  - `carriedDetailTab({ memberId: 'x', tab: 'stats', grab: null })` → `'stats'`.
  - It is pure and total: it never inspects the run, the panel or the DOM, and it never
    allocates for a closed-or-open answer beyond the returned literal.
- **Unchanged and frozen** in the same file (other code and tests already call them):
  `DetailTab = 'stats' | 'moves'`; `DetailState = Readonly<{ memberId: string | null; tab:
  DetailTab; grab: number | null }>`; `CLOSED_DETAIL`; `openDetail(memberId: string, tab:
  DetailTab = 'stats'): DetailState` — **the default parameter stays `'stats'`**;
  `closeDetail`, `setDetailTab`, `DETAIL_TABS`, `nextDetailTab`, `detailStops`,
  `stepStop`, `grabMove`, `dropMove`, `reorderMoves`, `memberDetail`, `fighterDetail`,
  `DETAIL_STATS`, `STAT_LABELS`, `statLabel`, `natureEffect`, `NATURE_UP_TINT`,
  `NATURE_DOWN_TINT`, `typeColor` (re-export).

`src/scenes/panels/detail.ts` — `openMemberDetail` keeps its exact signature and its
whole body but for the state line:

```ts
export function openMemberDetail(host: RoutePanelHost, memberId: string): void;
```

- The state line becomes, in this order and as **one expression**:

  ```ts
  hudDetailState = openDetail(memberId, carriedDetailTab(hudDetailState));
  ```

  `carriedDetailTab` must read the state **before** it is overwritten, which is what the
  single expression guarantees. Import `carriedDetailTab` from `../../ui/partyDetail`
  beside the exports that module already provides.
- Everything else in `openMemberDetail` stays in the same order and with the same
  values: expand the panel (`panel.expanded = true` and `hudDetail?.setVisible(true)`
  when it was collapsed and exists), `resetDetailInfo()`, `hudLearnScrollTop = 0`,
  `hudLearnQuery = ''`, `hudSearchFocus = false`, `hudDetailCursor = -1`,
  `hudPoolCursor = -1`, `cancelNicknameEdit(host)`, `endLearnDrag(host)`,
  `refreshDetail(host)`, and `dockDetailPanelOnce(host)` last.
- `hudDetailState` remains a module-scope `let` in this file; no new module state, no
  new exported symbol from `detail.ts`, and `closeMemberDetail` still funnels through
  `closeDetail` (so a closed panel answers `'stats'` on the next open).
- Both entry points are already wired and are **not** edited: `RouteScene`'s canvas row
  release calls `openMemberDetail(this.panelHost, memberId)`, and the DOM card's
  delegated press (`installPartyOpener`) calls `openMemberDetail(host, memberId)`.
- **Determinism:** reads no RNG. No `Rng` stream is created, read or advanced; the tab is
  in-memory panel state and is **not** persisted, so no run field and no `SAVE_VERSION`
  step.

### Data

- No data key, no i18n key, no balancing value, no settings field, no save field. The two
  tab labels (`detail.tabStats`, `detail.tabMoves`) already exist in every locale.

## 🧩 Data and configuration

Nothing. This is one rule over already-frozen state; a shipped run, route, seed, save
document, `src/data/dex/**` fixture and the HUD layout preference are all unchanged.

## 🧪 Test and Validation Plan (for QA)

QA runs this verbatim. A criterion that cannot be executed by someone who has not
read the rest of the spec is not a criterion.

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-171` audited against the exclusive paths list.
  - This task has **two** `[live]` criteria (one per layout), so it owes a browser pass:
    a dev server (`npm run dev`) plus CDP over headless Chromium, as `docs/agent-ci.md`
    says. The canvas one reads the live canvas with `renderer.snapshotArea` +
    `getImageData`; the DOM one reads the page with a DOM query.
- **Acceptance criteria:** every one is tagged **`[unit]`** (a headless command, a
  decoded asset, a pinned number — seconds and deterministic) or **`[live]`** (it only
  exists in the running game: layering, overlap, a band, a beat, a colour on screen).
  QA runs them all, but its browser budget goes to the `[live]` ones, so an untagged
  criterion is a spec bug. A `[live]` criterion states its **measurement** — what to
  read, on which layout, against which bound — so QA reproduces it instead of
  inventing one.

  - [ ] `[unit]` It typechecks and builds clean (`npm run build`).
  - [ ] `[unit]` The declared tests exist and pass. In `src/ui/partyDetail.test.ts`
        (`carriedDetailTab` added to the existing `from './partyDetail'` import block,
        which already pulls `CLOSED_DETAIL`, `closeDetail`, `grabMove`, `openDetail` and
        `setDetailTab`), under a `describe` for the carried tab:
        (a) **`it('keeps the MOVES tab, and answers STATS for a closed panel')`** asserts
        `carriedDetailTab(CLOSED_DETAIL) === 'stats'`,
        `carriedDetailTab(setDetailTab(openDetail('starter'), 'moves')) === 'moves'`, and
        `carriedDetailTab(closeDetail(setDetailTab(openDetail('starter'), 'moves'))) ===
        'stats'`;
        (b) **`it('re-opens on another member keeping the tab and dropping the grab')`**
        asserts `openDetail('boxed', carriedDetailTab(grabMove(setDetailTab(
        openDetail('starter'), 'moves'), 1)))` `toEqual({ memberId: 'boxed', tab: 'moves',
        grab: null })`;
        (c) the existing `describe('detail state')` test that asserts
        `openDetail('starter')` `toEqual({ memberId: 'starter', tab: 'stats', grab: null })`
        still passes untouched, proving the default parameter did not move.
        `npx vitest run src/ui/partyDetail.test.ts` must list all three.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched: the diff is exactly
        `src/ui/partyDetail.ts`, `src/ui/partyDetail.test.ts`,
        `src/scenes/panels/detail.ts` and the one added sentence in `docs/design-spec.md`
        §3. `git diff --name-only main...task-171` prints no fourth code file, and
        `git diff main...task-171 -- docs/design-spec.md` shows one added sentence inside
        §3 and nothing else (no deleted lines, no changed lines in §1, §2, §4–§10).
  - [ ] `[live]` **DOM layout, `?hud=dom`.** Load the game with `?hud=dom` (any seed; a
        fresh default run is fine — the debug overlay's Route panel shows the seed, record
        it in the report) and give the party two members (debug menu → *Add Pokémon*).
        Open the party card, click member A's row, click the MOVES tab, then click member
        B's row. **Measurement (DOM query on `#hud`, at 1280×800):**
        `document.querySelector('[data-hud-detail-tab="moves"]')?.getAttribute('data-active')`
        must be `'true'`; `document.querySelector('[data-hud-detail-tab="stats"][data-active]')`
        must be `null`; `document.querySelector('[data-hud-detail="stats"]')!.hasAttribute('hidden')`
        must be `true`; `document.querySelector('[data-hud-detail="moves"]')!.hasAttribute('hidden')`
        must be `false`.
  - [ ] `[live]` **Canvas card, no `?hud=dom`.** Same page without the flag, viewport
        exactly **1280×800** and device pixel ratio 1, `localStorage.clear()` before the
        load (so the persisted HUD layout is the default one). Assert
        `(await import('/src/main.ts')).game.scale.width === 1280` (if it is not, the
        probe's coordinates are undefined — stop and report). Give the party two members
        (debug menu → *Add Pokémon*). The PARTY panel is open by default, its rows are 52
        px tall starting at y = 90 and it spans x 928–1178, so click **(1000, 116)** for
        member A, then the MOVES tab at **(444, 157)**, then member B at **(1000, 168)**.
        The detail window is docked at (108, 72), so its tab strip is y 144–170, STATS at
        x 128–336 and MOVES at x 340–548. **Measurement:** take
        `renderer.snapshotArea(128, 144, 208, 26)` and `renderer.snapshotArea(340, 144,
        208, 26)`, draw each into an offscreen 2D canvas and `getImageData` the whole
        rect; count the pixels whose RGB is within **±30** of `#7dd3fc` = (125, 211, 252)
        on every channel (that is `FRLG_SELECTED_STROKE`, which `paintTab` gives the
        **active** tab only; `FRLG_ROW_STROKE` is white at 0.1 alpha and never matches).
        Bound: the MOVES rect (x 340) counts **≥ 40** such pixels and the STATS rect
        (x 128) counts **exactly 0**. A stored HUD layout that moved the window is a
        harness error, not a pass: clear `localStorage` and reload.

## 📣 Coordination

Facts another role needs to know, and the shape of them. Anything another task
depends on that is not in the Contract above.

- **For the Architect:** this task frees nothing and blocks nothing in Batch 79 —
  `panels/detail.ts` and `partyDetail.ts` are the batch's hot files it holds, and its
  only document is `docs/design-spec.md` §3, which the batch's other task never touches.
  No `package.json`, `src/main.ts`, `vite.config.ts`, `src/data/dex/**` or generated file
  is claimed, and the batch needs no `SAVE_VERSION` step.
- **For the next batch (`[Task-179]`, Batch 80):** §3 is shared by section, not by
  paragraph. `[Task-179]` rewrites the **swap bullet** (lines 68–73, the sentence that
  reads "Dropping a member **onto** a member of the other panel **swaps** the two …")
  and must not rewrite the detail-panel bullet this task edits (lines 73–97), where the
  added sentence is: *"The tab belongs to the panel, so picking another member keeps it;
  a closed panel opens on STATS."* — appended immediately after
  "…that only takes a dragged move." and before "The slotted moves can be dragged to
  reorder them".
- **For any later task that opens the detail window:** `openDetail`'s second parameter
  keeps its `'stats'` default, so a brand-new caller that wants STATS can still call
  `openDetail(id)`; a caller that wants the panel's own tab calls
  `openDetail(id, carriedDetailTab(state))` exactly as `openMemberDetail` does.
- **For QA:** the canvas criterion's coordinates are functions of `game.scale.width =
  1280` and the default HUD layout only; do not "adjust" them — a mismatch is a
  harness/layout error to report, not a bound to loosen.

## ⛔ Out of scope

- The tab **not** surviving a **close**: `closeMemberDetail` keeps funnelling through
  `closeDetail`, so a closed panel still re-opens on STATS. That is the ruled behaviour,
  not a gap.
- Remembering the tab per member, persisting it in the save/settings, or adding a
  `SAVE_VERSION` step.
- Any change to the nickname edit, the learnset search field, the drag/reorder, the
  evolution popup, the ⓘ popups or the tab **keyboard** stops.
- Any change to `src/ui/hud/**` (the DOM card already paints `hudDetailState.tab` via
  `detailPanelView`), to the HUD layout/persistence, or to `docs/design-spec.md` §10.3's
  "Detail tabs STATS/MOVES" row.
- Editing `src/scenes/RouteScene.ts`, `src/scenes/panels/hud.ts`, `party.ts`, `pc.ts` — a
  needed edit there is a new task, never a quiet extra line in this one.
- Reflowing, rewrapping or "tidying" `docs/design-spec.md`; the diff of that file is one
  added sentence.
