# Spec: Task-202 — The party panel draws its Pokémon, drags them to reorder, and its HP bar has no gap

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule (one reorder seam) + DOM panel + docs.
- **Role:** Dev.
- **Objective:** three defects of the route HUD’s party card go away in one pass.
  (a) Every row’s `party__portrait` cell paints that member’s portrait cell from the
  shared portrait seam, and only an unnamed species keeps the empty box. (b) A row can
  be dragged onto another row and the two members swap through the run engine, so the
  lead rule (index 0 opens the next battle) follows the drop. (c) The HP fill starts
  at the track’s own left edge, so a full bar paints edge to edge and a fractional one
  starts flush.
- **Environment:** worktree `../wt-pkm-202` (a sibling of this repo, never a junction),
  branch `task-202` off `main`. The Orchestrator has already pushed the spec as
  `spec: task-202`; commit on that tip. When `npm test` and `npm run build` are green,
  leave an **empty** commit `dev: done task-202` on the tip and push `task-202` — the
  QA wave validates that tip. Never commit to `main`, never merge, never create another
  branch. `$ASSETS_ROOT` is `/home/runner/work/_temp/assets/store`: never symlink or
  junction it into the worktree, and pass absolute paths to any packer.
- **Dependencies:** none must be merged first. Builds on the shipped party card
  (`src/ui/hud/panels/party/`), the portrait seam (`src/ui/hud/portrait.ts`,
  `docs/hud-fidelity.md` §9) and the run’s reorder helpers
  (`src/engine/run/state.ts`).

### Exclusive paths (single writer)

The list of paths this task creates or modifies. **Nothing outside this list.**
No other task in the batch may claim the same path. Deleting a stray `.gitkeep`
from a directory this task populates is always allowed.

- `src/ui/hud/panels/party/**` — every file in the folder, including `view.ts`,
  `view.test.ts`, `partyPanel.tsx`, `party.css`, `mount.tsx`, `index.ts`, `README.md`
- `src/ui/hud/portrait.ts`
- `src/ui/hud/portrait.test.ts`
- `src/engine/run/state.ts`
- `src/engine/run/state.test.ts`
- `src/scenes/panels/party.ts` — **the command receiver** (see Coordination; the TODO’s
  `Claims` line omits it and the drag cannot reach the run without it)
- `docs/design-spec.md` — **§3 only** (“The party”)
- `docs/hud-fidelity.md` — **§9 only** (“Portraits in the DOM HUD”). Append one
  paragraph; leave the existing paragraphs and §5/§6 byte-identical

Do not edit `docs/design-spec.md` §2 (`Task-198` holds it), `docs/hud-fidelity.md` §5
(`Task-196`) or §6 (`Task-204`).

### Inputs (read-only)

Files this task may read, and only these, beyond `AGENTS.md` itself.

- `docs/design-spec.md` — §3 is the party’s rules (including “drag a member … to
  reorder it” and the lead rule).
- `docs/hud-fidelity.md` — §9 is the portrait seam; §5 carries the party card’s rects.
- `docs/agent-spec-template.md`
- `src/ui/hud/state.ts` — `HudState`, `HudPartyRow`, `HudRoute`.
- `src/ui/partyScreen.ts` — `PartyRow` (carries `speciesId` and `shiny`).
- `src/ui/hud/commands.ts` — `HudCommand` (read-only here: no new variant is added).
- `src/engine/run/state.ts` — `RunState`, `moveInParty`, `MAX_PARTY_SIZE`.
- `src/ui/hud/portrait.ts` — `portraitCrop`, `portraitBackground`, `PortraitCrop`.
- `src/data/portraits.ts` — `PORTRAIT_SIZE`, `PORTRAIT_COLS`, `portraitFor`.
- `src/dev/debugMenu.ts` — the `Add` control the QA recipe uses (not edited here).

## 🔒 Contract

The public surface other tasks will be written against in parallel. It is a
promise, not a suggestion. Write the exact exported names and signatures.

### TypeScript

**1. The engine seam, `src/engine/run/state.ts`:**

```ts
/**
 * Swaps two party slots. Index 0 is the lead (it opens the next battle), so a
 * swap with 0 changes who leads. A same-index or out-of-range swap is a no-op and
 * returns the run it was given.
 */
export function reorderParty(run: RunState, from: number, to: number): RunState;
```

- Pure: no RNG, no clock, no Phaser, no DOM. `reorderParty(run, 1, 0)` makes the
  member at 1 the lead; `reorderParty(run, 0, 2)` on `[a, b, c]` answers `[c, b, a]`
  (a **swap**, unlike `moveInParty`’s remove-and-insert).
- `reorderParty(run, i, i)` and any index outside `0 … party.length - 1` return the
  **same object** (`toBe`), as `moveInParty` does.
- `src/engine/run/index.ts` already re-exports `./state`, so the barrel needs no edit.

**2. The panel’s row view, `src/ui/hud/panels/party/view.ts`:**

```ts
import type { PortraitCrop } from '../../portrait';

export type PartyRowView = Readonly<{
  // …the shipped fields unchanged: memberId, name, level, hpText, hpFraction,
  // statusLabel, heldItemName, dark, selected, row, portrait, hpBar
  /** The member’s portrait cell, or null when the atlas names none. */
  portraitImage: PortraitCrop | null;
}>;
```

- `portraitImage` is `portraitCrop(member.speciesId, member.shiny)`; it is `null` for
  an empty or unknown species id, and the cell keeps its shipped 45 × 45 box.
  (`portrait` stays the **box**; `portraitImage` is the **source**.)
- `PARTY_HP_FILL_RATIO` is **removed** (with its `index.ts` export and its tests):
  the fill’s width is now `hpFraction × hpBar.w`, exactly the track’s own width at
  100 %.

**3. The panel’s component, `src/ui/hud/panels/party/partyPanel.tsx`:**

```ts
export type PartyPanelProps = Readonly<{
  view: PartyPanelView;
  onCommand?: ((command: HudCommand) => void) | undefined;
  /** A completed drag: the row picked up and the row it was dropped on. */
  onReorder?: ((from: number, to: number) => void) | undefined;
}>;
```

- Each row is the shipped `<button type="button">` with `data-hud-party-member`, and
  its portrait cell now carries the inline `portraitBackground(portraitImage, 45)`
  style merged with its box style; a `null` source paints no background (the box).
- **Drag is pointer-driven** (no HTML5 `draggable`, no `drop` event):
  `onPointerDown` on a row records that row’s index; `onPointerUp` on a **different**
  row emits `onReorder(from, to)` once and suppresses the click that would otherwise
  follow (a `useRef` flag); `onPointerUp` on the same row leaves the shipped
  `{ type: 'member', memberId }` click intact; `onPointerCancel` and a pointer-up
  outside every row clear the drag.
- The held row carries `data-dragging="true"`; no other attribute changes.
- The HP fill keeps its own hook: `<span class="party__hp-fill" data-hud-party-hp-fill style={{ width: `${row.hpFraction * row.hpBar.w}px` }} />`.

**4. The mount, `src/ui/hud/panels/party/mount.tsx`:**

```ts
export function mountPartyPanel(
  host: Element,
  view: Signal<PartyPanelView>,
  onCommand?: ((command: HudCommand) => void) | undefined,
  onReorder?: ((from: number, to: number) => void) | undefined,
): () => void;
```

The barrel `index.ts` gains no new name beyond `PartyPanelProps`’ shape (it already
exports the mount and the view types).

**5. The command receiver, `src/scenes/panels/party.ts`:**

- `mountDomPanel` passes a fourth argument:
  `(from, to) => runPanelReorder(host, from, to)`.
- New function beside `runPanelCommand`:

```ts
function runPanelReorder(host: RoutePanelHost, from: number, to: number): void {
  if (routePaused) return;
  const run = host.run();
  const next = reorderParty(run, from, to);
  if (next !== run) host.commitRun(next);
}
```

- `reorderParty` is imported from `'../../engine/run'` (the barrel already
  re-exports `./state`). The shipped press path (`{ type: 'member' }` → `moveInParty`)
  is untouched.

### Data

None: no i18n key, no JSON, no `SAVE_VERSION` step. The HP colours, the chip and the
row rects stay the shipped tokens.

### Docs (the two sections this task owns)

- `docs/design-spec.md` **§3**: extend the party bullet that already says “drag a
  member within the party or the box to reorder it” with: the party card’s rows paint
  each member’s **portrait cell**, dragging one row **onto** another **swaps** the two
  (and index 0 still leads the next battle), and an HP bar’s fill starts at the track’s
  left edge, so a full bar paints edge to edge.
- `docs/hud-fidelity.md` **§9**: append one paragraph as the **last** paragraph of §9
  (after the main-menu footer and CONTINUE-row paragraphs; do not rewrite them),
  titled “**The party card’s rows.**”, stating: the
  row’s `party__portrait` cell is **45 px** and uses the same
  `portraitCrop`/`portraitBackground` arithmetic as the 26 px desk and 22 px phone
  cells, so the sheet scales to `<32 × 45>px auto`; only a species the atlas does not
  name (or a row with no id) keeps the empty 4 % box, and the dark mark keeps its
  violet hairline. The row’s HP fill starts at the track’s left edge — the baked FRLG
  track’s 34.5 px inset retired — so a full bar paints edge to edge and a fractional
  one starts flush.

## 🧩 Data and configuration

- Portrait cell: 45 px (`PARTY_PORTRAIT`), `portraitBackground`’s own arithmetic
  (`background-size: <cols × 45>px auto`), no fetch and no Phaser texture read.
- HP fill: 0 inset on both axes and the track’s height; the shipped 2 px fill radius
  and `--party-hp-fill` colour are kept.

## 🧪 Test and Validation Plan (for QA)

QA runs this verbatim. A criterion that cannot be executed by someone who has not
read the rest of the spec is not a criterion.

- **Method:**
  - `npm ci --prefer-offline --no-audit --no-fund` once in the worktree.
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-202` audit against the exclusive paths list.
  - This task has `[live]` criteria, so QA owes a browser pass: `npm run dev --
    --port <free> --strictPort`, its own tab, Chromium over CDP, DOM rect arithmetic
    and `getComputedStyle`. Stop the server when done. The art is the gitignored
    portrait atlas: the criteria read **`backgroundImage`/`backgroundPosition`** and
    never require the PNG to be non-empty.
- **Acceptance criteria:** every one is tagged **`[unit]`** or **`[live]`**; a `[live]`
  one states its measurement.
  - [ ] `[unit]` It typechecks and builds clean (`npm run build`).
  - [ ] `[unit]` The declared tests exist and pass (`npm test`): the three reorder
        cases, the row’s portrait source, the drag mapping and the flush fill.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched
        (`git diff --name-only main...task-202` lists only them).
  - [ ] `[unit]` The row view returns a portrait source per member and `null` without
        a sheet: `partyPanelView` on a `pikachu` row has a non-empty
        `portraitImage.url` and the `col`/`row` `portraitFor` derives, and a row whose
        `speciesId` is `''` or `missingno` has `portraitImage === null` while its
        `portrait` box is still `{ x: 22, y: 86, w: 45, h: 45 }`.
  - [ ] `[unit]` The drop target maps to one `reorderParty` and the lead follows:
        `reorderParty(run, 1, 0).party` starts with the member that was at 1;
        `reorderParty(run, 0, 2)` on `[a, b, c]` is `[c, b, a]`;
        `reorderParty(run, 1, 1)` and `reorderParty(run, 0, 9)` are `toBe(run)`.
  - [ ] `[unit]` The panel emits exactly one `onReorder(from, to)` for a pointer-down
        on row `from` and a pointer-up on row `to`, emits none for a same-row release,
        and suppresses the `member` command in the drag case (walk the Preact props and
        call the handlers, the `battleMoves.test.ts` pattern).
  - [ ] `[unit]` A full bar’s fill box equals its track’s at the left: at
        `hpFraction === 1`, the fill’s inline width is `${hpBar.w}px` and
        `PARTY_HP_FILL_RATIO` is no longer exported; `party.css`’s
        `--party-hp-inset-x`, `--party-hp-inset-y` and `--party-hp-fill-height` are
        gone and `.party__hp-fill` declares `left: 0; top: 0; height: 100%`.
  - [ ] `[unit]` `portrait.test.ts` pins the 45 px party cell: the same crop scaled to
        45 gives `backgroundSize: "${PORTRAIT_COLS * 45}px auto"` and
        `backgroundPosition: "${-col * 45}px ${-row * 45}px"`.
  - [ ] `[live]` **A party of three shows three sprites and swaps by drag.** On the dev
        server at 1280×800 with `/?hud=dom`: start a run, press `F`, open the PARTY
        tab, type `pidgey` and press **Add**, type `rattata` and press **Add** (party
        of three), close the menu and press `P` so `[data-hud-panel="party"]` is open.
        Measure: three `[data-hud-party-member]` rows in DOM order; every
        `[data-hud-party-portrait]` has a `getComputedStyle(...).backgroundImage`
        matching `/^url\(/`, and at least two of them carry different
        `backgroundPosition` values; then `Input.dispatchMouseEvent` (mousePressed at
        the second row’s centre, mouseMoved to the first row’s centre, mouseReleased
        there) and re-read the DOM order: the dragged id is now first, and
        `JSON.parse(localStorage.getItem('pokerandomlike.save')).run.party[0].fighter.id`
        (`SAVE_KEY` in `src/engine/save.ts`) equals it.
  - [ ] `[live]` **Every HP bar starts flush at both widths.** At 1280×800 and again at
        390×844, for every `[data-hud-party-hp]`, compare its
        `getBoundingClientRect()` with the `[data-hud-party-hp-fill]` inside it:
        `fill.left === track.left` (±0.5) and, for a bar whose
        `aria-valuenow="100"`, `fill.width === track.width` (±0.5). On the phone the
        card’s rect is 250 px wide at x 38 and no fill may start right of the track’s
        left edge.

## 📣 Coordination

Facts another role needs to know, and the shape of them. Anything another task
depends on that is not in the Contract above.

- For the Architect: this task holds the batch’s only `party/**`,
  `src/ui/hud/portrait.ts`, `src/engine/run/state.ts`, `docs/design-spec.md` **§3**
  and `docs/hud-fidelity.md` **§9**. §5 belongs to `Task-196` and §6 to `Task-204`;
  both must be byte-identical in this branch.
- Deviation from the TODO’s `Claims` line, forced by the code: the DOM card is mounted
  by `src/scenes/panels/party.ts` (`mountPartyPanel(layer, view, command => runPanelCommand(host, command))`),
  and that file — not `party/**` — owns the `host`/`commitRun` pair a reorder needs.
  Without it the drop cannot reach the run. It is added as the receiver and is the
  only file this task touches outside the TODO’s list.
- Deviation from the TODO’s wording, forced by the code: the shared portrait source is
  `PortraitCrop` (an atlas URL plus a cell, §9’s rule), not a data URI;
  `portraitBackground` turns it into the background arithmetic at 45 px. The engine’s
  reorder helper is introduced as `reorderParty` **beside** `moveInParty` because the
  TODO’s drop is a swap and `moveInParty` is a remove-and-insert; the canvas party
  grid keeps using `moveInParty`, and aligning the two drags is a later task.
- For the next batch: `Task-203` does not touch this folder; `Task-206`’s command
  window and `Task-207`’s strip are separate panels. `Task-199`’s shared helper lands
  in `stats/**`, not here.
- For QA: the party card is only mounted under `?hud=dom`; the canvas path draws its
  own party window and is out of this task’s scope. The asset store is at
  `$ASSETS_ROOT=/home/runner/work/_temp/assets/store`; never symlink it into the
  worktree.

## ⛔ Out of scope

- No change to the party’s rules: `moveInParty`, `depositToBox`, `withdrawToParty`,
  `swapPartyBox`, the PC card and the RIP list stay as shipped.
- No new `HudCommand` variant, no `src/ui/hud/commands.ts` edit, no keyboard reorder,
  no drag between the party and the box (that is the canvas grid’s and the PC card’s
  behaviour), no toast or confirmation.
- No layout change: the card stays 250 px wide at the right column with six 52 px rows,
  the header (chip, level, XP, Pokevial) and the row rects are untouched.
- No dependency, no `package.json`, no `SAVE_VERSION` step, no dex or fixture edit, no
  new i18n key, no restyling of the chip/rows/vial.
