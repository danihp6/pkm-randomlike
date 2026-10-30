# Spec: Task-234 — a press on a member opens its data panel; only a drag moves it

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene panels + HUD (Preact DOM).
- **Role:** Dev.
- **Objective:** in the party card a press on a row **moves** the member to the lead
  (and the detail window opens as a side effect); in the PC a press **withdraws** the
  member into the party and opens nothing. After this task one rule holds on both
  cards: **a press opens the member's data panel and nothing else**, and **moving a
  member is the drag and only the drag**, through the pure model that already ships
  (`grabAt`/`dragTo`/`swapAcross`/`dropGrabbed`). A party row dragged onto another
  row reorders; a box cell dragged onto another box cell reorders; a box cell dropped
  on the party card withdraws; a party row dropped on the PC card deposits; a drag
  released on nothing changes nothing. A locked PC cell takes the press for its data
  panel and never the drag. The keyboard bindings do not move.
- **Environment:** worktree `../wt-pkm-234`, branch `task-234`.
- **Dependencies:** none.

### Exclusive paths (single writer)

- `src/ui/hud/panels/party/partyPanel.tsx`
- `src/ui/hud/panels/party/partyPanel.test.ts`
- `src/ui/hud/panels/party/mount.tsx`
- `src/ui/hud/panels/pc/pcPanel.tsx`
- `src/ui/hud/panels/pc/pcPanel.test.ts`
- `src/ui/hud/panels/pc/mount.tsx`
- `src/scenes/panels/party.ts`
- `src/scenes/panels/pc.ts`
- `src/scenes/panels/detail.ts`
- `src/ui/partyScreen.ts` and `src/ui/partyScreen.test.ts` — **only if** a drop
  target needs one more exported function; prefer reusing the four that ship
- `src/ui/hud/panels/party/README.md`
- `src/ui/hud/panels/pc/README.md`
- `src/scenes/panels/README.md`
- `docs/design-spec.md` — **§3 only** (a batch-mate owns §2 and §4)

Nothing outside this list. No engine rule: all four moves are already exported by
`src/engine/run/state.ts` (`reorderParty`, `moveInBox`, `withdrawToParty`,
`depositToBox`) and the pointer model by `src/ui/partyScreen.ts`.

### Inputs (read-only)

- `src/engine/run/state.ts` 454-520 — the four shipped moves and `MAX_PARTY_SIZE`.
- `src/ui/partyScreen.ts` — `grabAt`, `dragTo`, `swapAcross`, `dropGrabbed`,
  `PartyUiState`, `PaneId`, `pcMemberEditable`, `boxRows`, `ripRows`.
- `src/scenes/panels/party.ts` — `runPanelCommand`, `runPanelReorder`,
  `commitRun`, `host.run()`, `host.ui()`.
- `src/scenes/panels/pc.ts` — `pressDomCell`, `setHudBoxPane`, `handleDomCommand`.
- `src/scenes/panels/detail.ts` 490-515 — `installPartyOpener`, `openMemberDetail`.
- `src/ui/hud/commands.ts` — `HudCommand` (`member`, `panel`).
- `design/frames/03b-panels-row-view.json` + `design/screens/03b-panels-row-view.png`
  — caption `03b Panels · row view`; `design/frames/m03b-panels-row-view.json` +
  `design/screens/m03b-panels-row-view.png` — caption `M 03b Panels · row view`;
  `design/frames/03c-panels-compress.json` + `design/screens/03c-panels-compress.png`
  — caption `03c Panels · compress`; `design/frames/03p-panels-pc-rip.json` +
  `design/screens/03p-panels-pc-rip.png` — caption `03p Panels · pc rip`;
  `design/frames/03m-panels-pokemon-moves.json` +
  `design/screens/03m-panels-pokemon-moves.png` — caption
  `03m Panels · pokemon moves`. Read-only: this task changes no geometry the board
  draws.

## 🔒 Contract

### The press

- `src/scenes/panels/party.ts`, `runPanelCommand`'s `member` branch: call
  `openMemberDetail(host, command.memberId)` and return. It never calls
  `moveInParty`; the row's press no longer re-leads the squad.
- `src/scenes/panels/pc.ts`, `pressDomCell(host, memberId)`: set the cursor and call
  `openMemberDetail(host, memberId)`; it never calls `withdrawToParty`. A locked cell
  (`pcMemberEditable(run) === false`) behaves the same: it opens its data panel and
  starts no drag.
- `src/scenes/panels/detail.ts`, `installPartyOpener`: one delegated listener on the
  `#hud` layer that resolves **both** `[data-hud-party-member]` and
  `[data-hud-pc-cell]` to a member id, over `[...run.party, ...run.box, ...run.rip]`,
  and calls `openMemberDetail`. It must not double-open when the card's own command
  already opened the same member (a press is one path, not two): make the cards' own
  `member` command the single path and keep the delegated opener only as the fallback
  for a DOM node whose card does not send one, or remove the delegated party opener
  and let the two cards send `member`; whichever you choose, **one press opens one
  detail window**.

### The drag

- Party rows keep their shipped pointer drag (`PartyRow`'s `onPointerDown`/`Up` →
  `onReorder` → `runPanelReorder` → `reorderParty`).
- PC cells gain the same gesture: `onPointerDown` records `{ pane, index }`,
  `onPointerUp` on another box cell reorders through `moveInBox` (via
  `runPanelReorder`'s PC sibling), and a drag released on nothing changes nothing.
- **Across the two cards:** a drag that ends over the other card commits the crossing:
  box cell → party card calls `withdrawToParty(run, boxIndex)`; party row → PC card
  calls `depositToBox(run, partyIndex)`. Resolve the drop by hit-testing the element
  under the pointer at `pointerup` (`[data-hud-panel="party"]` /
  `[data-hud-panel="box"]`) or by a shared drop zone the two cards own — no new
  engine rule and no second copy of a move.
- A locked cell (`pcMemberEditable(run) === false`) and the RIP pane start no drag.
- The keyboard's `partyInput` grab/drop keeps its behaviour: do not touch
  `src/ui/partyScreen.ts`'s `partyInput`.

### Data and state

- No new field, no key, no `SAVE_VERSION` step. `run.party`, `run.box` and `run.rip`
  keep their order semantics; a drag commits through `host.commitRun(next)` exactly as
  the shipped reorder does.
- **Determinism:** reads no RNG.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the updated
    `partyPanel.test.ts`, `pcPanel.test.ts` and `partyScreen.test.ts` if touched.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-234` audited against the exclusive paths.
- **Acceptance criteria:**
  - [ ] `[unit]` a party row's press sends `{ type: 'member' }` and never a reorder;
        the scene's receiver opens the detail and leaves `run.party` untouched (a
        test on the command path, not a screenshot).
  - [ ] `[unit]` a PC cell's press opens the detail and calls no `withdrawToParty`
        (assert the run is unchanged and the opener was called once).
  - [ ] `[unit]` a box cell dragged onto another box cell reorders the box once
        (`moveInBox`) and a party row dragged onto another party row swaps through
        `reorderParty` once.
  - [ ] `[unit]` a box cell dropped on the party card withdraws once (party +1, box
        −1) and a party row dropped on the PC card deposits once (party −1, box +1);
        a drag released on nothing changes no member's place.
  - [ ] `[unit]` a locked cell opens the detail and starts no drag; the RIP pane
        starts no drag.
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` at 1280×800 with a party of three and one boxed member (add them
        from the debug overlay): a click on the third party row opens
        `[data-hud-panel="detail"]` and the first row's
        `data-hud-party-member` is the same id as before the click; a drag of row 1
        onto row 3 swaps those two ids in the party card and leaves the lead rule to
        the drag; a drag of the box cell onto the party card moves that id into
        `[data-hud-panel="party"]` and the box cell becomes empty. Measured from DOM
        attributes and rects via CDP.
  - [ ] `[live]` at 390×844 the same tap on the third row opens the detail and the
        lead is unchanged; a tap on a PC cell opens its detail and the party does not
        grow.
- **A `[live]` that compares pixels is not a criterion** (`D57`): every check reads a
  DOM attribute or a rect, never a screenshot.

## 📣 Coordination

- For the next batch: the press/command contract is `member → openMemberDetail`, and
  the four moves stay the engine's exported pair; no new engine function is expected.
  If you had to add one to `src/ui/partyScreen.ts`, name it in your report.
- For the Architect: `src/scenes/panels/{party,pc,detail}.ts` and the two panel views
  change together; the folder READMEs record the one command path.
- No `SAVE_VERSION` step, no run field.

## ⛔ Out of scope

- No new panel, no new command type, no change to `HudCommand`'s shape.
- No change to the HUD layout, the pause menu, the battle scene or the route scene.
- No change to `src/engine/run/state.ts`: the four moves already ship.
