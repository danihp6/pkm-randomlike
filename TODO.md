# PokeRandomLike — Roadmap (TODO)

Browser Pokémon roguelike: procedural routes, classic menu battles, permanent
death. Backlog source of truth. One branch per task off `main` (`feature/...` or
`task-<ID>` for an agent batch).

Legend: `[ ]` open, `[~]` in progress. Only open work lives here; completed items
are archived in `CHANGELOG.md`, grouped by phase. Phases are ordered; a phase is
"playable" when every box in it is ticked.

**Vertical slice (decided, D8):** Phases 1-5 plus the party/economy half of Phase
6 — pick a starter, walk one generated route, fight one wild battle and one
trainer battle through the full menu (fight / bag / switch / run) with capture and
permadeath, take the exit and arrive at a second route. Everything after that is
run structure, presentation and polish.

**Framework established (D1-D19):** Phaser 3 + Vite + TS, pure logic in
`src/engine/`, dex generated from `@pkmn/dex`, own battle engine extending
Showdown's semantics, swappable tilesets, strict permadeath. Reuse of
`pkm-mystery-dungeon-like` is scoped in `docs/tech-decisions.md` (D14).

---

## Batch plan

**Batch 5 is shipped and archived.** Its four tasks merged in ID order behind the green
gate and the detail is in `CHANGELOG.md`'s `## Unreleased`; **Batch 5b is the next batch
cut**, with the reports that arrived while Batch 5 was in flight registered below. Every
batch from here follows the Legend's **Asset trees** rule: the Añil clone's absolute path
goes to the packer, and no tree under `sprite-sources/` is ever linked into a worktree
(Batch 3's junction is what emptied it once).

Legend:
- **IDs.** `[Task-NN]` is bound to a task only in this file; everywhere else a task
  is referenced by name. Two digits, in backlog order.
- **Retired IDs.** `[Task-24]` (a Move-Relearner screen for the bench) was retired:
  the learnset panel already covers its four slots, so the screen is not wanted, and
  `[Task-27]` (a catch that stacks a duplicate on top of itself) was retired into
  `[Task-31]`, which deletes the capture screen its repro needed and then owns the
  whole placement seam alone. A
  retired ID is **never reused** — new work takes the next unused number — so the
  sequence stays in backlog order but is no longer gapless.
- **Dependencies.** Every open item ends with `*Dependencies:*` — the authoritative
  graph. A dependency exists only when a task cannot be written without a file, type,
  generated asset or data table another task produces. Phase order is *not* a
  dependency.
- **Batches.** A batch is an antichain: no task in it depends on another task in it,
  and no two tasks in it create or modify the same path. A batch is a label on the
  open items, not a rewrite of the backlog. Batches run in order: a task's branch is
  cut from `main` once every earlier batch is merged, and the Orchestrator merges one
  task at a time, in ID order.
- **Hot files.** At most one task per batch claims `package.json`, `src/main.ts`,
  `vite.config.ts`, a given `src/scenes/*.ts`, `src/data/dex/**` or any other
  generated file (the packed atlases under `src/assets/`, `src/data/frlg/*.json`,
  `src/data/anil/*.json`, `docs/balance/effect-coverage.md`). Each batch names its
  holder below.
- **Asset trees.** A gitignored asset tree (`sprite-sources/**`) is **never** junctioned
  or symlinked into a worktree: Windows' `git worktree remove` follows the link and
  empties the link's **target**, which is how Batch 3 lost the Añil clone. A task that
  needs the clone passes its **absolute path** to the packer, and every packer takes its
  source directory through argv or the environment — none of them reads a path inside a
  worktree. The permanent copy of this rule belongs in `AGENTS.md`; `Task-17` holds that
  file in Batch 6.
- **Unscheduled.** An ID that appears in no batch is blocked outside this backlog,
  so it cannot be scheduled however empty the plan looks. `[Task-28]` (activate the
  ESLint half of `npm run lint`) is the only one: it waits on an upstream
  `typescript-eslint` release, not on a decision here.

**Critical path.** Dependency depth is two: with Batches 1 and 2 merged, the only chain
left is `Task-07 → Task-23`. What serialises the tail is a shared resource, not a
dependency: `Task-18`, `Task-19` and `Task-20` all regenerate `src/data/dex/**` through
`scripts/build-dex.mjs`, `Task-20` and `Task-21` both extend `src/ui/evolutionGraph.ts`,
and `Task-23` writes paths earlier tasks already hold — `src/data/items.ts` (`Task-07`,
`Task-19` and `Task-22`'s TM entries), `src/data/shop.ts` and `src/data/loot.ts`
(`Task-07`, `Task-22`), `src/engine/battle/effects/items.ts` (`Task-07`),
`src/engine/battle/moveType.ts` (`Task-25`, shipped in Batch 2), the `src/data/` numbers
(`Task-09`) and the generated `docs/balance/effect-coverage.md` (`Task-07`, `Task-09`) —
which is why it sits in Batch 8 rather than beside the item tasks it belongs to. Those
three dex tasks are dependency-free, so the Orchestrator may pull any of them into an
earlier batch whose paths leave `scripts/build-dex.mjs` and `src/data/dex/**` free.
`Task-29` (the Prettier reformat pass, Batch 11) is the other serial resource: it claims
every `src/**` path `.prettierignore` still ledgers, so it runs alone, and last.
`src/scenes/RouteScene.ts` and `SAVE_VERSION` are the two serial resources the second round
of reports adds to that list, and they are what fixes the tail of the plan: Task-45
(Batch 5b), Task-41 (Batch 6), Task-31 (Batch 7), Task-39 (Batch 9), Task-40 (Batch 9b),
Task-44 (Batch 13) and Task-30 (Batch 12) each want that one scene, so they line up one
batch apart — and the third round's Task-48 and Task-49, the two reports that want it after
every one of them, extend the same queue into the new **Batch 14** and **Batch 15** — and the
fourth round's Task-50 (the level-up popup) is the last claimant of that same scene and of
the notice module, so it opens the new **Batch 16** — and the fifth round's Task-52 (the wild
pool's exclusion) wants that scene again, so it opens **Batch 17**, one batch behind the
level-up popup, while its sibling report, Task-53 (the types under the battle panel's name),
takes the one `src/scenes/BattleScene.ts` slot Batch 5b leaves free — and the seventh round's
single report, Task-57 (a trainer's remaining team as Poké Balls under its panel), takes the next
one, in **Batch 6b**, whose Task-38 wants `src/scenes/RouteScene.ts` instead — and the sixth round's two
scene reports, Task-55 and Task-56, extend that same `src/scenes/RouteScene.ts` queue into the
new **Batch 18** and **Batch 19**, which changes nothing ahead of them — and the
eighth round's three reports land in three places behind them: `Task-58` (the whole
chrome in the debug panel's palette) claims `src/scenes/RouteScene.ts` **and every other
scene**, so it opens the new **Batch 20**; `Task-59` (the switch window's move ⓘ) takes
the one free `src/scenes/BattleScene.ts` in **Batch 13**, whose Task-44 wants the route
scene instead; and `Task-60` (the battle's info window) takes that same scene in
**Batch 17**, the first batch after 13 that leaves the scene *and* the i18n key table
free. The version chain gains
one more step from that same Task-52: it is **14 → 15** (Task-13, shipped) → **15 → 16**
(Task-31, Batch 7) → **16 → 17** (Task-44, Batch 13) → **17 → 18** (Task-52, Batch 17) — and the
sixth round's three tasks add **no** step at all (Task-54 is a shop table and a view model,
Task-55 reads and writes no state, Task-56 changes a rule and not a field) —
because none of the third round's three
adds a step — Task-47 reads what the save already holds, Task-48 reads the
saved `stats.catches` and Task-49 adds no run field at all — and neither does the fourth
round's Task-50 (no run field) or Task-51 (no state), nor the fifth round's Task-53 (no state
at all): the new step is Task-52's alone, and the eighth round's three add none either —
Task-58 is presentation and touches no state, Task-59 adds no run field and Task-60 only
reads the battle's own state.

The items registered since the first plan add one link each, and one batch that is not a
link at all. `Task-35` (the enemy AI, Batch 8b) reads the reusable scripted-battle
harness `Task-09` extracts beside `src/engine/battle/golden.test.ts` (Batch 6), so its
batch sits behind Batch 6 and behind the mechanics whose options the AI weighs — Gigantamax
(Batch 7) and the item-driven retypes (Batch 8). `Task-34` (the battle SWITCH grid) is
dependency-free and only waits for the scene to be free, which Batch 6 is. `Task-33` is
the bug batch cut in front of Batch 4.

`Task-36` and `Task-37` (Batch 4b, below) are what the four Batch-4 devs found: each waits
on exactly one Batch-4 task and on nothing else — `Task-36` on `Task-19`, `Task-37` on
`Task-32` — and they share no path, so that batch is an antichain one batch deep.

Three reports that arrived right after Batch 4b's cut add **no dependency edge at all** and
one serial resource between them. Every one of them needs `src/scenes/RouteScene.ts` — the
learnset band's host, where the panel's chrome, its search field and its pool all live —
and two of them need `src/scenes/BattleScene.ts` beside it, so **at most one of the three
can sit in any batch**: `Task-38` (the learnset band scrolls instead of paging) takes the
new **Batch 6b**, the first place its scene *and* the two docs that call the band "paged"
(`docs/design-spec.md` §3, `docs/tech-decisions.md` `D36`) are all free — Batch 5's
Task-16 holds the scene and writes `docs/design-spec.md` §3/§4, and Batch 6's Task-17
holds both doc files again;
`Task-39` (the ⓘ that is dead on hover in the battle's MOVES window and dead both ways in
the band) joins **Batch 9**, whose one task owns no scene at all; and `Task-40` (the
battle's entry beat) takes the new **Batch 9b**, because it wants `docs/design-spec.md` §4,
which Task-21 holds in Batch 9. Batch 4b is untouched: it is **cut**, both its specs are
written and its worktrees are in flight, so it can gain no member — a cut batch's tasks all
have specs at cut time, and the three new ones have none yet.

A second round of **six reports** arrived after that, and five of the six add no dependency
edge at all — two bug fixes, one wrong description and three wishes — but they do add
**two batches** and three more claims on `src/scenes/RouteScene.ts`. `Task-42` (a catch must
keep the HP it had in the wild) and `Task-43` (Run Away works; the text the ⓘ floats is the
dex's competitive blurb) are the two bug fixes, and each takes exactly one path Batch 5
leaves free — `src/engine/run/progression.ts` and `src/ui/partyDetail.ts` — so they join
**Batch 5**. `Task-45` (FireRed's tall-grass step animation) and `Task-46` (a finished run
returns to the main menu, not to the starter pick) take the new **Batch 5b**, the first
batch in which `src/scenes/RouteScene.ts` and `docs/design-spec.md` are free again after
Task-16 holds both in Batch 5. `Task-41` (the party's lead walks behind the player, idle
and running) wants the same scene, so it takes the **one free scene path in Batch 6**,
where its other files — a new `src/data/pokemonOverworld.ts` beside its test, a new
`src/render/pokemonFollower.ts` beside its test, and the two per-folder READMEs — are
nobody's. `Task-44` (a fixed RIP tab in the PC box, listing the dead) is the only late one,
and it is late for two independent reasons: it extends the very seam Task-31 rewrites in
Batch 7 and takes the **next** `SAVE_VERSION` step (**16 → 17**, after Task-31's 15 → 16),
and every batch from 8 to 12 reclaims `src/scenes/RouteScene.ts` or `src/engine/save.ts`,
so it opens the new **Batch 13**. Nothing here re-plans Batch 4b, and
none of the six adds a task to a batch that is already cut.

A third round of **three reports** arrived after that one, and **none of the three adds a
dependency edge**; between them they add one claim on `src/scenes/MainMenuScene.ts`, two
more on `src/scenes/RouteScene.ts` and **no** `SAVE_VERSION` step. `Task-47` (the main
menu's Continue row shows the map, its biome and the party's portraits instead of
`Route N`) is the one report of the three that does **not** want the route scene: it wants
`src/scenes/MainMenuScene.ts` and `docs/design-spec.md` §2's main-menu bullet, which are
both free for the first time in **Batch 7** — every batch from 5 to 6b holds that spec
file (Task-16's §3/§4, Task-46's §6, Task-17 whole, Task-38's §3) — and it opens **no**
`src/ui/` file, because a new file there owes the folder's `README.md` in the same task and
Task-31 holds that file in Batch 7 already (`notice.ts`); its label therefore joins the
run's existing text model, `src/ui/runSummary.ts`. `Task-48` (the run's first wild is much
easier to catch) and `Task-49` (a temporary popup when an item is obtained) both need
`src/scenes/RouteScene.ts`, which every batch from 7 to 13 already holds (7 Task-31, 8
Task-08's every-scene sweep, 8b Task-35, 9 Task-39, 9b Task-40, 10 Task-26, 11 Task-29's
ledger, 12 Task-30, 13 Task-44), so they open the two new batches at the plan's tail,
**Batch 14** and **Batch 15**, one batch apart because that one scene is what they share.
Task-49 additionally reads `src/ui/notice.ts`, which Task-31 creates. Neither tail task
bumps `SAVE_VERSION`: Task-48 reads the catches `RunState.stats.catches` already saves and
Task-49 adds no run field at all, so the version chain stays 14 → 15 (Task-13) → 16
(Task-31) → 17 (Task-44). Nothing here re-plans `Task-38`–`Task-46`, and none of the three
adds a task to a batch that is already cut.

A fourth round of **two reports** arrived after that one, and **neither adds a dependency
edge**; between them they add one more claim on `src/scenes/RouteScene.ts`, one on
`src/ui/notice.ts` and one on `src/data/dex/**`. `Task-50` (a temporary popup when a Pokémon
levels up) wants `src/scenes/RouteScene.ts` and `src/ui/notice.ts` together — the two paths
Batch 15's Task-49 already holds — so it opens the plan's new **Batch 16**, one batch behind
the pickup notice, sharing the module's third notice rather than a second window. `Task-51`
(the species whose real evolution is not a level-up take a **BST** level of 20/30/40, at
least **+10** above the evolution that produced them) is a balance/rules rework against
shipped data: it wants `src/data/dex/evolutions.ts` with its test, the re-pins in
`src/ui/evolutionGraph.test.ts` and `src/engine/run/progression.test.ts`, `docs/battle-spec.md`
§7, `docs/tech-decisions.md` `D38` and a `docs/balance/` sheet — and the first batch that
leaves all of those free at once is **Batch 5b**, whose Task-45 (the FRLG grass step) and
Task-46 (the score screen's destination) touch none of them. So the two reports land at
opposite ends of the plan on purpose: Task-51 near its front, because nothing blocks it and
every number it moves is already shipped, and Task-50 at the very tail, because the scene and
the notice module it extends are the plan's most contended paths. Neither bumps
`SAVE_VERSION`: Task-50 adds no run field and Task-51 adds no state, so the chain stays
14 → 15 (Task-13) → 16 (Task-31) → 17 (Task-44). Nothing here re-plans `Task-38`–`Task-49`,
and Batch 4b is untouched: it is `cut`, so it can gain no member.

A fifth round of **two reports** arrived after that one, and **neither adds a dependency
edge**; between them they add one more claim on `src/scenes/RouteScene.ts`, one on
`src/scenes/BattleScene.ts` and the plan's next `SAVE_VERSION` step. `Task-52` (the wild table
must never roll a species the run already caught — dead members included, and every evolution
and form of that species with it) is the one report of the round with **state** behind it: the
run keeps no record of the species it caught (`RunStats` is a count, `releaseFainted` deletes
the dead, `caughtAt` names a room rather than a species), so it adds `RunState.caughtSpecies`
and takes a migration step. `src/scenes/RouteScene.ts` is what makes it late — it is the
**only** construction site of the encounter table (`applyRoute`, 1163-1172) and every batch
from 5 to 16 holds that scene — while `src/engine/save.ts` is free again from Batch 14 on but
held by 7, 8b, 10 and 13, so the two serial resources meet in the new **Batch 17** and its
step lands **after** Task-44's, because it is the next one only once that batch has merged:
the chain becomes 14 → 15 (Task-13, shipped) → 15 → 16 (Task-31, Batch 7) → 16 → 17 (Task-44,
Batch 13) → **17 → 18** (Task-52, Batch 17). It also runs after Task-48 (Batch 14), which reads
the same roll for a different rule, and after Task-44 (Batch 13), whose RIP list holds the dead
**members** and is a different fact from this record. `Task-53` (the active Pokémon's types
under its name in the battle's HP panels) adds no edge and no state either: it is one
presentation row in `drawSidePanel` (`src/scenes/BattleScene.ts`, 1604-1663) whose data (the
live fighter's `types`) and art (Añil's badge atlas, `src/data/typeIcons.ts`) both already
ship. It takes the one `src/scenes/BattleScene.ts` slot **Batch 5b** leaves free — the first
batch whose scene is free after Task-16 (Batch 5) re-chromed the panels and settled
`FRLG_WINDOW_PADDING` — and it lands **before** Batch 8's accessibility audit and Batch 10's
i18n sweep on purpose, so the new row is contrast-audited and keyed with the rest. Nothing
here re-plans `Task-38`–`Task-51`, Batch 4b is untouched (it is `cut`, so it can gain no
member), and no earlier batch changes except **Batch 5b**, which gains a fourth member.

A sixth round of **four reports** arrived after that one. **Three of them become tasks and the
fourth becomes a measurement, not work.** The fourth is a playtest reading of the shipped XP
curve — floor 1, every trainer but the boss, one level gained — taken against `[Task-09]` (Balance
pass, Batch 6, **not yet run**): the shipped curve *does* reach the level cap it is measured
against (map 1's cap is **6** and a fresh starter is level **5**, so one level **is** that floor's
whole cap), so there is nothing to fix and no bug task to register — the numbers are written into
Task-09's own entry below as that pass's evidence, because the real question they raise (a floor
worth a single level) is a `MAP_TUNING`/`trainerXp` decision, which is exactly what Task-09 runs
to settle. **`[Task-09]` is not done: it is still open, in Batch 6, which has not run.** The
other three add **no dependency edge** and **no `SAVE_VERSION` step** between them.

`Task-54` (the Mart always stocks four rows: a 10× ball pack, a Potion and two held items) is the
one report of the round that needs **no scene**: its pack is a `ShopSlot` field and its label is
the shop model's own row (`buyRows`), so `src/scenes/RouteScene.ts` is untouched and the task
takes the first batch that leaves its three data/doc paths free at once — `src/data/shop.ts`
(Task-22 holds it in Batch 5, Task-23 in Batch 8), `docs/maps-spec.md` (Task-17's in Batch 6) and
`docs/balance/economy.md` (Task-09's in Batch 6) — which is **Batch 5b**, its fifth member, with
nothing but a `docs/balance/` **file** to arbitrate against Task-51's `route-curve.md` (different
file, same folder). It lands **before Batch 6** on purpose, so the balance pass tunes the stock
that is actually sold rather than the one it replaces, the way Task-51 lands there for the
evolution curve.

`Task-55` (the MOVES panel draws four slots even with three moves) and `Task-56` (a move learned
on a level-up waits in the learnset instead of being equipped) both want
`src/scenes/RouteScene.ts`, which **every** batch from 5 to 17 holds, so they open the plan's tail
— **Batch 18** and **Batch 19**, one batch apart, because that one scene is what they share and a
batch is an antichain. `Task-55` also takes `src/scenes/BattleScene.ts` (free in 18: Task-48 held
it in Batch 14 and nothing between 15 and 17 wants it) and `src/ui/moveGrid.ts` (Task-39's in
Batch 9, free after), which is why the four-container fix can ride in one task; `Task-56` takes
`src/engine/run/progression.ts` with its test (Task-42 holds them in Batch 5, Task-51 re-pins the
test in Batch 5b — both earlier) and `src/ui/beats.ts` with its test (Task-40's in Batch 9b).
`Task-55` runs first because its container is the **drop target** the human names as the
precondition ("you must be able to learn a TM move while you have three"), and once `Task-56`
stops filling all four slots short movesets become the common case rather than a corner one.
Neither re-plans `Task-38`–`Task-53`, and Batch 4b is untouched: it is `cut`, so it can gain no
member.

A **seventh round** of **one report** arrived after that one, and it adds **no dependency edge**:
`Task-57` (a trainer's remaining team drawn as Poké Balls under its panel) claims
`src/scenes/BattleScene.ts` for one row of icons and nothing else, so it joins **Batch 6b** as its
second member. It is scene-only for the same reasons `Task-53` is: the bench it counts is the
whole enemy roster the battle state already carries (`BattleSide.party`, `src/engine/battle/state.ts`
53-56, with a fainted fighter left in it at `hp = 0`, 217-219), the "is this a trainer at all" gate
is `BattleState.isWild` (set in `create`, `BattleScene` 395-399), and the ball frame is the packed
Añil item atlas's own (`itemIconFrame('pokeball')`, `src/data/itemIcons.ts` 14-16 / 29-36) — the
same frame the capture throw already draws (953-957) and the atlas `BootScene` loads once (144), so
no packer runs, no art is added and no `src/data/**` file is written. It opens no `src/ui/**`
module, takes no `docs/` line, adds no run field and changes no rule — so **no `SAVE_VERSION`**
step, and the plan's chain stays 14 → 15 (Task-13) → 16 (Task-31) → 17 (Task-44) → 18 (Task-52).
Batch 6b is the **first** batch after Batch 5's chrome pass whose free `BattleScene.ts` slot
exists: Task-53 takes it in 5b, Task-34 in Batch 6, and Batch 7's Task-18 reclaims it. It shares no
path with its batch-mate — Task-38 keeps `src/scenes/RouteScene.ts`, `src/ui/scroll.ts`,
`src/ui/README.md` and the two doc files — so the batch stays an antichain with two members while
its "alone" claim remains true of the route scene. Landing here also puts the row in front of Batch
8's accessibility sweep (a dimmed ball is colour-only information) and of Batch 10's i18n sweep,
the way Task-53 does. Nothing here re-plans `Task-38`–`Task-56`, and Batch 4b is untouched: it is
`cut`, so it can gain no member.

An **eighth round** of **three reports** arrived while Batch 5 (Task-16, Task-22, Task-42,
Task-43) was being devved. Between them they add **one dependency edge** and open the plan's
new **Batch 20**, and the first of the three is a report *against* the batch in flight, so it
is handled as a follow-up rather than folded into it: **Batch 5 is cut**, its four specs are
written and its four branches are cut, so it can gain no member and nothing in it is
re-planned — the contradicting report becomes the task below, written against Task-16's
shipped state.

`Task-58` (every panel takes the **debug** panel's visual style) is the round's one edge, and
it is a **whole-chrome** task rather than a small follow-up. The chrome it re-tunes is the set
`Task-16` is drawing in the batch in flight — `scripts/ui/build-chrome.mjs`,
`src/data/ui/chrome.json`, the three `src/assets/ui/*.png`, `src/ui/frlg.ts` and
`src/ui/frlgFont.ts`, none of which exists on `main` today — so the edge points at Task-16 and
this task's spec is written when its own batch is cut, by which time Task-16 has merged. It is
whole-chrome because the referent is the dev overlay's CSS (`src/dev/debugMenu.ts`, 296-299:
`background:#10161fe6`, `border:2px solid #7dd3fc`, `border-radius:8px`, `color:#e2e8f0`),
whose surface `#10161f` is the palette `docs/art-direction.md` line 14 already declares and
which Task-16's own set contradicts twice: its window keeps the FRLG light field (`#f8f8f8`
under the deep-black `FRLG_INK`, `0x0b0b10`) and its keyline is the slate `0x3a3d52`, where the
debug panel is dark with a bright accent and light text. Every container the chrome carries
pairs a **light** fill with that dark ink — `moveGrid`'s cells and info buttons,
`abilityInfo`'s button, the battle's command cells and bag tabs, the HUD's rows and cells, the
starter cards — so the re-tune reaches every `src/scenes/*.ts` and most of `src/ui/**`: the
**same shape as the reformat** (`Task-29`), and likewise **alone in its batch**, because every
batch from 5 to 19 holds at least one of its paths (5 Task-16's chrome set, 5b Task-45 and
Task-53, 6 Task-34 and Task-41, 6b Task-38 and Task-57, 7 Task-18, Task-31 and Task-47, 8
Task-08's every-scene sweep, 8b Task-35, 9 Task-39, 9b Task-40, 10 Task-26's every-scene
sweep, 11 Task-29's ledger, 12 Task-30, 13 Task-44 and Task-59, 14 Task-48, 15 Task-49, 16
Task-50, 17 Task-52 and Task-60, 18 Task-55, 19 Task-56). It therefore opens **Batch 20**, and
it runs after Batch 11's reformat so it edits cleared files and keeps them conforming, the way
Batches 12–19 do. One consequence is recorded with it rather than hidden: Batch 8's
accessibility audit runs against Task-16's chrome, so this task carries its own contrast
check instead of re-running Task-08, and the open question below offers the light-panel
alternative that would need none of that.

`Task-59` (the battle's SWITCH window gives each move row the HUD's ⓘ) and `Task-60` (a battle
**info** window with the weather, the terrain, the stat stages and the screens) are the round's
two battle reports, and they are **siblings rather than one task** with `Task-39` (Batch 9):
`Task-39` fixes a *classifier* on cells the MOVES window and the learnset band already draw and
takes no `docs/` line, while `Task-59` adds *rows* to a popup that has none and has to change
the switch window's own "hover only" rule — but both want `src/scenes/BattleScene.ts` **and**
`src/ui/moveGrid.ts`, so **at most one of them can sit in any batch**, and `Task-59` takes
**Batch 13**: the first batch after `Task-39` whose `BattleScene.ts` is free (`Task-40` holds it
in 9b, `Task-26` in 10, `Task-30` in 12), whose `src/ui/moveGrid.ts` is free (Task-55's in 18)
and whose `docs/design-spec.md` §4 is free — and the first in which it need not touch the i18n
key table, because its popup carries the move's own text and adds no literal. `Task-60` could
not ride beside it (they share both of those paths) and takes **Batch 17** as its second member:
`BattleScene.ts` is free there and so is the i18n table its own labels do need (Task-49 holds it
in 15, Task-50 in 16), while its batch-mate `Task-52` claims none of its paths. Neither adds a
run field and neither moves a rule.

None of the three takes a `SAVE_VERSION` step: `Task-58` is presentation and touches no state,
`Task-59` adds no field and changes no rule, and `Task-60` only *reads* the battle state the
engine already carries — so the chain stays **14 → 15** (Task-13, shipped) → **15 → 16**
(Task-31, Batch 7) → **16 → 17** (Task-44, Batch 13) → **17 → 18** (Task-52, Batch 17). Nothing
here re-plans `Task-38`–`Task-57`, and Batch 4b is untouched: it is `cut`, so it can gain no
member.

### Batch 1 — foundations *(shipped, archived)*
Task-01, Task-02, Task-03, Task-06, Task-10 and Task-11 merged in ID order behind the
green gate; the detail is in `CHANGELOG.md`'s `## Unreleased`. Two follow-ups it
parked are registered below: `[Task-28]` (activate the ESLint half, unscheduled) and
`[Task-29]` (the Prettier reformat pass, Batch 11).

### Batch 2 — docs pass, effect ports, Hidden Power *(shipped, archived)*
Task-04, Task-05 and Task-25 merged in ID order behind the green gate; the detail is in
`CHANGELOG.md`'s `## Unreleased`. The effect ports leave `unportedMoveIds()` empty, so
the coverage table names no `no-op` row, and the `moveType.ts` seam Task-25 shipped is
what Task-23 extends.

### Batch 3 — held items, ability popup *(shipped, archived)*
Task-07 and Task-12 merged in ID order behind the green gate; the detail is in
`CHANGELOG.md`'s `## Unreleased`. The run's held-item catalogue is now the whole
competitive set, with Añil's own 893-icon atlas packed at 24 px so no scene changed,
and every catalogue row is either a `port` or an honest `no-op`; the ability row reads
the dex's own text through the popup both tasks share. Task-07's paths — the one chain
left, `Task-07 → Task-23` — are free again for Batch 8. One casualty, recorded because
Batch 4 waits on it: the Orchestrator junctioned `sprite-sources/anil` into a worktree, and
Windows' `git worktree remove` followed the link and emptied the **clone**. No committed
output was lost — the packed atlas and every generated file are in the tree — but the
clone itself is empty and is being re-downloaded; the Legend's **Asset trees** rule is the
mitigation.

### Batch 3b — a catch's unique id *(shipped, archived)*
- **Task-33** The duplicate-Pokémon bug: every catch was minted with the same member id.
Task-33 merged alone behind the green gate; the detail is in `CHANGELOG.md`'s `## Unreleased`.
It took `src/engine/save.ts` **without** a version bump — repairing an old save is a
decode-time normalisation, like `parseDiscoveredRooms` — so Batch 4's Task-13 still takes the
14 → 15 step and Task-31's 15 → 16 in Batch 7 is unchanged. `docs/battle-spec.md` §7 is free
again for Task-13.

### Batch 4 — party data, badges, Legends Z-A Megas, the opening band *(shipped, archived)*
Task-13, Task-15, Task-19 and Task-32 merged in ID order behind the green gate; the detail is
in `CHANGELOG.md`'s `## Unreleased`. Task-13 took `src/engine/save.ts` 14 → 15 as planned, so
Task-31 (Batch 7) takes 15 → 16 next; Task-19 widened the dex's Mega set 48 → 88 and took
`scripts/build-dex.mjs` with it; Task-15 repacked the two badge atlases from Añil in place, at
their existing frame sizes; and Task-32 fixed the opening band in `src/engine/routes/**`,
re-pinning the generator's fixed-seed expectations — no other task read those. The findings
the devs left behind shipped as **Batch 4b** below, which is archived too.

### Batch 4b — follow-ups from Batch 4 *(shipped, archived)*
Task-36 and Task-37 merged in ID order behind the green gate; the detail is in
`CHANGELOG.md`'s `## Unreleased`. Both executed their spec's option 1. Task-36 dropped the
nine `Future` formes that name a Mega without setting `isMega`, so the playable set fell
**1291 → 1282** and `learnsets` **1290 → 1281** while `megas.json` stayed at 88 and the
three arbitrated re-pin files (`src/engine/run/pool.test.ts`, `roster.test.ts`,
`src/engine/routes/encounters.test.ts`) went **untouched** — no fixed-seed expectation
moved. `public/anil/**` did not move: the Añil clone is not materialised, and the sprite
manifest stays a harmless superset. Task-37 added `missingLaneGuard` to
`RouteValidation`, gated it behind the exported `wantsTrainers(request)` in
`sketchRoute`/`sketchRouteSteps` (a `RouteMap` alone cannot know a quiet room never
wanted a trainer), and made a lane-less seed re-roll inside the unchanged
`MAX_ATTEMPTS = 8`, so `docs/route-generator.md` §3.4's promise is now true and §4 names
both it and `borderBandGaps` — nine gated lists. Exactly one fixed seed changed its
shipped attempt (`sweep-b` in `src/engine/routes/validate.test.ts`: attempt 0 → 1,
0 → 4 trainers); QA re-measured it independently and found no seed that exhausts the
eight attempts. Task-36, not Task-37, would have held the dex hot files, which is why
`Task-17` (Batch 6) still writes `D40`'s Mega count afterwards.

### Batch 5 — panel chrome, TM acquisition, two shipped-work fixes *(shipped, archived)*
Task-16, Task-22, Task-42 and Task-43 merged in ID order behind the green gate; the
detail is in `CHANGELOG.md`'s `## Unreleased`. Task-16 replaced the ripped FRLG chrome
with a **drawn** set under `src/assets/ui/**` + `src/data/ui/**`, packed by the new
`scripts/ui/build-chrome.mjs` (`npm run data:ui`), keeping every exported name, padding
and corner value the scenes are written against and applying the set's own alpha once in
`addFrlgWindow`; its window field stayed light (`#f8f8f8`) so the frozen `FRLG_INK` stays
legible, and `hudTransparent` survived as the same boolean re-read as a degree. Task-22
gave the Mart a per-band TM slot, drawn **last** at the catalogue price, and resolved each
of the 171 machines to its move's own type art — the Añil atlas already carried the whole
`machine_<TYPE>` set, so no packer ran, no art was added and `package.json` stayed
Task-16's. Task-42 made a catch keep the **share** of health it had in the wild
(`adoptAtLevel`, the `evolvePokemon` shape, with a 1 HP floor), and Task-43 fixed Run
Away's copy through the new `src/data/abilityText.ts` override that `abilityDescription`
reads before the dex. None of the four added a run field or a `SAVE_VERSION` step, so the
version chain is unchanged, and each of its three declared re-pins needed none.

### Batch 5b — FireRed's grass step, a finished run's destination, the evolution curve, the battle panel's types and the Mart's four rows
- **Task-45** Tall grass rustles when the player steps through it, as in FireRed.
- **Task-46** A finished run returns to the main menu, not to the starter pick.
- **Task-51** The species whose real evolution is not a level-up take a BST level of
  20 / 30 / 40, at least +10 above the evolution that produced them.
- **Task-53** The battle panel shows the active Pokémon's types under its name.
- **Task-54** The Mart always stocks four rows: a 10× ball pack at a cheap price, a
  Potion at a middling one and two held items priced per item.
- **Hot files:** `scripts/frlg/build-tilesets.mjs`, the three packed
  `src/assets/frlg/{outdoor,forest,cave}.png`, `src/data/tilesets/frlg.ts` + its test,
  `src/engine/tileset.ts`, `src/engine/tileFrames.ts` + `tileFrames.test.ts`,
  `src/scenes/RouteScene.ts` and `docs/tileset-spec.md` → Task-45;
  `src/scenes/RunOverScene.ts` and `docs/design-spec.md` §6 → Task-46;
  `src/data/dex/evolutions.ts` + `evolutions.test.ts` (the hand-authored accessor only —
  **not** the generated `species.json`), the re-pins in `src/ui/evolutionGraph.test.ts` and
  `src/engine/run/progression.test.ts`, `docs/battle-spec.md` §7, `docs/tech-decisions.md`
  `D38` and `docs/balance/route-curve.md` → Task-51;
  `src/scenes/BattleScene.ts` → Task-53 (one row under each HP panel's name; it reads the
  Añil badge atlas `src/data/typeIcons.ts` and the live fighter's `types`, so it writes no
  `src/data/**` file, opens no `src/ui/**` module and takes no `docs/` line);
  `src/data/shop.ts` + `shop.test.ts`, `src/ui/shop.ts` + `shop.test.ts`,
  `docs/maps-spec.md` §7 and `docs/balance/economy.md` → Task-54 (the four-row stock: the
  pack table, the held-only rotation and the row's unit count all live in the shop model, so
  it claims no scene, no `package.json`, no generated file and no `docs/balance/` sheet
  another task writes — Task-51's is `route-curve.md`). Task-45, Task-46, Task-53 and
  Task-54 claim no
  `package.json`, `src/main.ts`, `vite.config.ts`, `src/data/dex/**` or
  `src/engine/save.ts`, and Task-51 takes the one `src/data/dex/**` slot for a
  **hand-authored** file — it regenerates nothing, runs no packer and touches no scene, no
  save and no build script. None of the five takes a second scene, and each takes exactly one
  `src/scenes/*.ts` at most: Task-45 the route, Task-46 the score screen, Task-53 the battle
  (Task-51 and Task-54 take none).
- **Shape:** five tasks that share no path, and the two original ones wait only for Batch 5
  to merge: the
  scene Task-16 holds there, the biome atlases and `docs/design-spec.md` are all free
  again the moment it lands — which is why this batch sits between 5 and 6 rather than at
  the tail. Task-45 takes the FRLG biome atlases (a generated file, so nothing else in
  the batch may) and the one tile-animation contract the tileset does not have yet;
  Task-46 takes the score screen's single destination and the one sentence
  `docs/design-spec.md` §6 needs. Task-51 is the third task and the only batch that can host
  it: every path it moves is free here and **nowhere earlier** — Batch 5's Task-42 holds
  `src/engine/run/progression.test.ts`, Batch 6's Task-17 holds `docs/battle-spec.md` and
  `docs/tech-decisions.md` while Task-09 holds the `docs/balance/` sheets, and Batch 6b's
  Task-38 holds `docs/tech-decisions.md` again — so a level rework that moves the numbers
  those three test files pin is blocked until this batch. Task-53 is the fourth and takes the
  one free scene path: `src/scenes/BattleScene.ts` is Task-16's in the batch before this one,
  Task-34's in the batch after, and then held again by Batches 7, 8, 8b, 9, 9b, 10, 12 and 14,
  so this is the first
  batch whose chrome is **settled** and its scene still free — which is what its row wants,
  because it draws inside the HP panels Task-16 re-chromed and reads the
  `FRLG_WINDOW_PADDING` Task-16 retuned. It produces nothing anyone in this batch reads, takes
  no `docs/` path (`docs/design-spec.md` is Task-46's here, and §4 does not describe the HP
  panels at all today), and adds no state, so it is the one task of the round that changes no
  number and no rule. Task-54 is the fifth, and the only report of the whole round that claims
  **no scene at all** — which is what puts it here rather than at the tail: it is a `ShopSlot`
  field (`count`), a pack table in `src/data/shop.ts`, a held-only rotation and the pack's own row
  label in `src/ui/shop.ts`, while the Mart panel already draws whatever `buyRows` returns
  (`row.name`, `¥row.price`, `x{owned}` — `refreshShop`, 5605-5625), so nothing in `RouteScene`
  moves. Its three data/doc paths are free here and in no earlier batch: `src/data/shop.ts` is
  Task-22's in Batch 5, `docs/maps-spec.md` is Task-17's and `docs/balance/economy.md` is
  Task-09's in Batch 6. It runs **before** Batch 6 on
  purpose, for three reasons now: Task-09's balance pass
  reads the new evolution curve, the new shop stock and the new pack prices rather than the ones
  they replace, and Task-17 rewrites that
  spec file there, so §6's new sentence (Task-46) is in place before the docs pass reads it
  and Task-09's balance numbers read the same scene. Every batch from Batch 6 on runs one
  batch later than this plan first said.

### Batch 6 — balance pass, Phase 9 docs, the battle SWITCH grid
- **Task-09** Balance pass.
- **Task-17** Step 14 — docs & migration pass.
- **Task-34** The battle SWITCH grid: one sixth per row, a name that cannot stretch it,
  arrows that move the cursor.
- **Task-41** The party's lead Pokémon walks behind the player on a route.
- **Hot files:** the sheets under `docs/balance/` → Task-09; `src/scenes/BattleScene.ts`
  → Task-34; `src/scenes/RouteScene.ts`, the new `src/data/pokemonOverworld.ts` +
  `pokemonOverworld.test.ts`, the new `src/render/pokemonFollower.ts` +
  `pokemonFollower.test.ts` and `src/assets/README.md` + `src/data/README.md` (and
  `BootScene` only if its dev preloads there instead of loading lazily in the scene)
  → Task-41.
- **Shape:** numbers, one harness and prose. Task-09 owns
  `src/engine/battle/golden.test.ts` and any harness module it extracts beside it —
  the only task allowed to restructure the golden log — over the numbers in
  `src/data/`. Task-17 takes `docs/design-spec.md`, `docs/battle-spec.md`,
  `docs/routes-spec.md`, `docs/tech-decisions.md` and `AGENTS.md`, so nothing else in
  the batch may — which is
  why the capture task registered as `[Task-31]` sits in Batch 7 instead of here: it
  must rewrite the PC rule in `docs/routes-spec.md` §6, and Task-17 holds that file
  in this batch. The bug it replaces, `[Task-27]` (Catching a Pokémon stacks a
  duplicate on top of it), was absorbed into `[Task-31]` and is retired — its live
  diagnosis is `[Task-33]`'s, which Batch 3b fixes before any of this.
  Task-34 is the third task and takes the one path the other two leave free: the
  party grid's geometry lives in `BattleScene` alone, and this is the first batch whose
  scene claims leave that file open — Batch 5's chrome pass owns it in the batch before,
  and Batch 7's Gigantamax and Batch 8's accessibility sweep own it after. It reads the
  long names Batch 4's nicknames (Task-13) make possible but produces nothing anyone in
  this batch reads, and it takes no `docs/` path: Task-17 holds every spec it could want
  a line in, and the row geometry changes no rule.
  `Task-38` (the learnset band scrolls) is **not** here even though its scene is:
  `src/scenes/RouteScene.ts` is free in this batch — Task-16 took it in the batch before
  and Task-34 takes a different file — but the task has to rewrite `docs/design-spec.md`
  §3's "a **paged** grid" and `docs/tech-decisions.md` `D36`'s "a paged, full-width grid",
  and Task-17 holds both files here. That is the same rule that sends Task-31 to Batch 7
  for `docs/routes-spec.md` §6, so the scroll takes the batch after this one, 6b.
  `Task-41` (the follower Pokémon) takes the one scene path this batch leaves free:
  Task-34 claims `src/scenes/BattleScene.ts`, so `src/scenes/RouteScene.ts` — free here,
  held by Task-45 in Batch 5b and by Task-38 in 6b — is Task-41's, and its one `src/data/`
  path is a **new** accessor (`src/data/pokemonOverworld.ts`) rather than one of the number
  tables Task-09 tunes, so the two never share a file; its art is the committed
  `src/assets/pokemon/**`, which no batch claims.

### Batch 6b — the learnset band scrolls, and a trainer's remaining team sits under its panel
- **Task-38** The learnset band scrolls instead of paging.
- **Task-57** A trainer's remaining team is drawn as Poké Balls under its HP panel.
- **Hot files:** `src/scenes/RouteScene.ts`, the new `src/ui/scroll.ts` (+ its test) and
  `src/ui/README.md` → Task-38; its two doc files, `docs/design-spec.md` §3 and
  `docs/tech-decisions.md` `D36`, are Task-38's too — both are free only now, after
  Task-16 (Batch 5) and Task-17 (Batch 6) wrote them. `src/scenes/BattleScene.ts` → Task-57
  (the ball row alone; it reads the packed Añil item atlas's own ball frame and the enemy bench
  the battle state already carries, so it writes no `src/data/**`, opens no `src/ui/**` module
  and takes no `docs/` line). Neither task claims `package.json`, `src/main.ts`,
  `vite.config.ts`, a `src/data/**` path or a packed asset, and no `docs/` file another batch
  still holds.
- **Shape:** two tasks that share no path, and the scroll is still alone in what it claims:
  Task-38 is the only open item that needs
  `src/scenes/RouteScene.ts`, and no batch that runs beside it claims that file — Batch 4b's
  two tasks own `scripts/build-dex.mjs`, `src/data/dex/**` and `src/engine/routes/**`,
  Batch 5's chrome pass and Batch 6's docs pass own the scene or its docs in the batches
  before, and Batch 7's Task-31 rewrites the same scene's capture path after it. It runs
  **after** Batch 5 so the band's search row and pool are re-laid out inside the new
  windows once, and **after** Batch 6 so Task-17's two doc files are its own to amend —
  which is exactly why the scroll cannot be one of Batch 6's tasks. Task-57 is the second
  member and takes the one free `src/scenes/BattleScene.ts` slot: Task-16 re-chromed that file
  in Batch 5, Task-53 takes it in 5b and Task-34 in Batch 6, and Batch 7's Task-18 reclaims it —
  so this is the first batch after the chrome pass whose battle panel is nobody's, and the row
  is drawn with the settled `FRLG_WINDOW_PADDING` and panel heights rather than against the
  chrome they replace. It shares no path with Task-38 (the route scene, the scroll module and
  the two doc files all stay Task-38's) and produces nothing the scroll reads, and it is placed
  here rather than at the plan's tail on purpose: Batch 8's accessibility sweep audits every
  scene and a dimmed ball is colour-only information, and Batch 10's i18n sweep keys every
  player-facing literal while this row carries no text at all.

### Batch 7 — Gigantamax, route-scoped catch swap, the main menu's Continue row
- **Task-18** Gigantamax, in the Mega Evolution mould.
- **Task-31** A full party sends the catch to the PC, swappable only on that route.
- **Task-47** The main menu's Continue row shows the map, its biome and the party's icons.
- **Hot files:** `scripts/build-dex.mjs`, `src/data/dex/**` (the new `gmaxes.json`),
  `src/data/anil/pokemon-sprites.json` and `src/scenes/BattleScene.ts` → Task-18;
  `src/scenes/RouteScene.ts`, `src/engine/run/state.ts` + `state.test.ts`,
  `src/engine/run/resolve.ts` + `resolve.test.ts`, `src/engine/save.ts` +
  `save.test.ts`, `src/ui/partyScreen.ts`, the new `src/ui/notice.ts` +
  `notice.test.ts`, `src/ui/README.md` (its `notice.ts` role line, the per-folder
  convention) and `docs/routes-spec.md` → Task-31; `src/scenes/MainMenuScene.ts`,
  `src/ui/runSummary.ts` + `runSummary.test.ts` and `docs/design-spec.md` §2 → Task-47.
  None of the three claims `package.json`, `src/main.ts`, `vite.config.ts` or a packed
  asset.
- **Shape:** three tasks that share no path: the battle engine and the generated dex on
  one side, the run save, the route scene and the PC rule on the other, and the landing
  screen's one row on the third. It is the
  first batch whose serial resources are all free for Task-31 — every earlier batch
  that touches `src/scenes/RouteScene.ts` (3, 5, 6, 6b, 8, 10) or `src/engine/save.ts`
  (3b, 4, 10) already claimed one, and Task-17 holds `docs/routes-spec.md` in Batch 6.
  Task-18 keeps `docs/tech-decisions.md` for its decision entry; Task-31 takes no
  `D##`, because its rule is a gameplay one and `docs/routes-spec.md` carries it.
  Running here also puts the new popup in front of Batch 8's accessibility sweep
  (Task-08 claims every `src/scenes/*.ts`) and Batch 10's i18n sweep.
  `Task-47` is the **first** report of any round that wants `src/scenes/MainMenuScene.ts`
  rather than the route scene, and it takes the batch's third slot because this is the
  first one in which its two real claims are free together: `MainMenuScene` is nobody's
  until Batch 8's every-scene sweep, and `docs/design-spec.md` is held by a batch-mate in
  every batch from 5 to 6b (Task-16's §3/§4, Task-46's §6, Task-17 whole, Task-38's §3),
  so §2's main-menu bullet can only be rewritten here. Its label goes into the run's
  existing text model rather than a new `src/ui/` module on purpose: a new file in that
  folder owes its `README.md` line in the same task, and `src/ui/README.md` is Task-31's
  in this very batch — the two would share a path and the batch would stop being an
  antichain. It is also the only task of this round that Batch 10's i18n sweep already
  sees, because it lands three batches before it.
  One more thing Task-31 owns here and two later batches extend, **one notice each**: the
  `src/ui/notice.ts` module and its `notice.test.ts` are the run's single transient-notice
  helper — one module, N strings — and Task-49 (Batch 15) adds the item pickup notice to it
  while Task-50 (Batch 16) adds the level-up notice, each in its own batch, so the three
  never share a path inside a batch and no second transient window is ever invented.

### Batch 8 — accessibility, new biomes, Rotom appliances, item retypes
- **Task-08** Accessibility pass.
- **Task-14** New biomes.
- **Task-20** The Rotom appliances as evolutions.
- **Task-23** Item-driven move retypes: Multi-Attack, Techno Blast, Natural Gift.
  Needs Task-07 merged, and builds on the `moveType.ts` seam Batch 2 shipped.
- **Hot files:** every `src/scenes/*.ts` → Task-08; `scripts/build-dex.mjs` and
  `src/data/dex/**` → Task-20; `package.json` and any new tileset atlas → Task-14; the
  generated `docs/balance/effect-coverage.md` → Task-23.
- **Shape:** Task-08 runs here so the contrast audit is done once, against the chrome
  Batch 5 shipped. Task-23 is late on purpose: Batch 5's Task-22 writes the same TM
  entries in `src/data/items.ts` and the shop rotation, and Batch 6's Task-09 balance
  pass owns the `src/data/` numbers and the `docs/balance/` sheets that Task-23 also
  touches — so this batch, whose tasks run over the scenes, the tilesets and the
  regenerated dex, is the first one that leaves Task-23's paths free.

### Batch 8b — the enemy AI, and the difficulty parameter
- **Task-35** Enemy AI: the cartridge's AI scripts for a known roster, expected value and
  a bounded search for a random one, and the difficulty knob on top.
- **Hot files:** `src/engine/battle/ai.ts` + `ai.test.ts`, `src/data/trainers.ts`,
  `src/scenes/BattleScene.ts`, `src/scenes/RouteScene.ts`, `src/scenes/SettingsScene.ts`,
  `src/ui/settingsScreen.ts`, `src/engine/save.ts`, `docs/tech-decisions.md` and
  `docs/battle-spec.md` → Task-35.
- **Shape:** one task, alone, and it needs the batch to be that wide: the AI's own module
  is free, but its difficulty parameter reaches the launch (`RouteScene`), the call site
  (`BattleScene`), the settings row (`src/ui/settingsScreen.ts` + `SettingsScene`) and the
  save (`src/engine/save.ts`) — no earlier batch leaves all four of those plus
  `docs/battle-spec.md` and `docs/tech-decisions.md` free at once, and Batch 8's own
  Task-08 claims **every** `src/scenes/*.ts` in the batch before. Running here also puts
  the AI after every mechanic whose options it weighs — Mega Evolution (D34, shipped),
  Gigantamax (Batch 7) and the item-driven move retypes (Batch 8) — and after Task-09's
  reusable scripted-battle harness (Batch 6), which its fixed-seed AI regressions run on.
  It is **before** Batch 9 on purpose: Task-21 writes `docs/battle-spec.md` §9 there.

### Batch 9 — the STATS graph's Mega row, and the ⓘ's two dead hit tests
- **Task-21** The Megas as information in the STATS graph.
- **Task-39** The ⓘ detail button is dead on hover in the battle's MOVES window and dead
  in both forms in the learnset band.
- **Hot files:** `src/scenes/BattleScene.ts`, `src/scenes/RouteScene.ts` and
  `src/ui/moveGrid.ts` → Task-39; the two docs Task-21 writes (`docs/design-spec.md`,
  `docs/battle-spec.md`) stay Task-21's alone, which is why Task-39 takes no `docs/` path
  at all. Nothing here claims `package.json`, `src/main.ts`, `vite.config.ts`,
  `src/data/**` or a packed asset (`src/ui/evolutionGraph.ts` is not a serial resource).
- **Shape:** two tasks that share no path, and the batch is the **first** whose two scenes
  are both free: every batch that touches `src/scenes/BattleScene.ts` (3, 5, 6, 7, 8, 8b,
  10, 12) or `src/scenes/RouteScene.ts` (3, 5, 6b, 7, 8, 8b, 10, 12) has claimed one
  before, and Batch 6b's Task-38 takes `RouteScene` three batches earlier — so the ⓘ fix
  waits until here. Task-21 still runs alone in its own file for the reason it was
  planned: `src/ui/evolutionGraph.ts` is the file Task-20 rewrote in Batch 8 and Task-18
  extends in Batch 7. Task-39's file `src/ui/moveGrid.ts` is free here and stays free
  until Batch 11's reformat.

### Batch 9b — the battle's entry beat
- **Task-40** A battle opens with an entry beat: one for a wild encounter, one for a
  trainer.
- **Hot files:** `src/scenes/BattleScene.ts`, `src/scenes/RouteScene.ts`,
  `src/ui/beats.ts` (+ `beats.test.ts`) and `docs/design-spec.md` §4 → Task-40. All four
  are free only now, and for two different reasons: the two scenes, because Batch 8's
  Task-08 claims every `src/scenes/*.ts`, Batch 8b's Task-35 takes both of them again and
  Batch 9's Task-39 takes them in the batch immediately before this one — and
  `docs/design-spec.md`, because Task-21 holds it in Batch 9.
- **Shape:** one task, and it needs the batch to be that wide for the same reason Task-39
  needed Batch 9: the entry beat *is* the `RouteScene.startBattle` → `BattleScene.create`
  seam, so it owns both scenes, and its timings go beside `FAINT_MS`/`SWITCH_*` in
  `src/ui/beats.ts` — the module whose own header says the beats read as data — with a
  test. Running **after** Batch 8 is deliberate: Task-08's reduced-flash preference is what
  a black-flash opening has to obey, and this task reads it rather than adding a second
  knob that Batch 8b's Task-35 (the settings rows and `src/engine/save.ts`) and Batch 10's
  Task-26 (every scene) would both have to see. It also sits **before** Batch 10 on
  purpose, like Task-31's notice: the opening's own player-facing lines have to exist
  before the i18n sweep keys them.

### Batch 10 — localisation
- **Task-26** i18n module and the Spanish locale.
- **Hot files:** every `src/scenes/*.ts` → Task-26; `src/engine/save.ts` → Task-26.
- **Shape:** last on purpose. It moves every player-facing literal behind a key, so it
  must see the panels Task-12, Task-13 and Task-16 added, Task-31's catch notice, and
  the strings Batch 8's
  accessibility pass introduced.

### Batch 11 — the Prettier reformat pass (last of the planned backlog)
- **Task-29** Format the files `.prettierignore` still ledgers, and delete their lines.
- **Hot files:** none of the serial resources — but the task claims **every `src/**`
  path the ledger names**, so no other task may run beside it.
- **Shape:** one task, alone in its batch, and last on purpose. Task-01 shipped the
  format gate over a ledger rather than rewrite a file a batch-mate owned, so the
  `src/**` block it lists is debt, and `[Task-29]` pays it off: `npm run lint` stops
  depending on the ledger and becomes a gate a new file cannot quietly slip past.
  This is a **batch-composition** constraint, not a dependency — the reformat needs
  nothing another task produces, it just cannot share a batch with anything that owns
  one of the ~105 files it rewrites, and every earlier batch owns at least one. Last,
  because its formatting is then the final word on those files: every task's own gate
  keeps the ledger from growing in the meantime, so nothing after it can un-format
  what it cleared or re-add a line. Re-planned from the ledger as it stands then.

### Batch 12 — a hit's sound, a cry (added after the audio pass)
- **Task-30** Per-move hit sounds and per-species cries.
- **Hot files:** `src/scenes/BattleScene.ts` and `RouteScene.ts` → Task-30; the packed
  `src/assets/audio/*.wav` and the two `scripts/frlg/` audio scripts → Task-30.
- **Shape:** one task, in its own batch, because it is the last of the plan whose scenes
  are free: every batch before it that touches `BattleScene.ts` or `RouteScene.ts` (5, 5b,
  6, 6b, 7, 8, 8b, 9, 9b, 10) has already claimed one, and every batch after it reclaims
  `RouteScene.ts` (13 for the PC's RIP tab, 14 for the first-catch rule, 15 for the item
  pickup popup and 16 for the level-up popup). It runs **after** Batch 11's reformat and keeps the
  two ledgered scenes conforming, so it adds no ledger debt — which is why the reformat is
  still the last of the *planned* backlog rather than the last thing to land; Batches 13,
  14, 15 and 16 edit
  the same ledgered files and carry the same obligation.

### Batch 13 — the PC's RIP tab, and the switch window's move ⓘ
- **Task-44** The PC box gains a fixed RIP tab listing the dead.
- **Task-59** Each of the switch window's move rows gets an ⓘ that floats the move's info,
  on hover or on click, as the route HUD's does.
- **Hot files:** `src/scenes/RouteScene.ts`, `src/engine/run/state.ts` + `state.test.ts`,
  `src/engine/run/perms.ts` + `perms.test.ts`, `src/engine/save.ts` + `save.test.ts`,
  `src/ui/partyScreen.ts` + `partyScreen.test.ts`, `src/ui/partyDetail.ts` and
  `docs/routes-spec.md` §6 → Task-44; `src/scenes/BattleScene.ts` and `src/ui/moveGrid.ts`
  (the shared popup-content builder it exports and the battle's ⓘ rows reuse), plus
  `docs/design-spec.md` §4's switch-window sentence → Task-59. Task-59 claims no new
  `src/ui/**` file (so no `src/ui/README.md` line), no i18n key — its popup carries the
  move's own text through the existing fallback — no `package.json`, `src/main.ts`,
  `vite.config.ts`, `src/data/**`, `src/engine/**`, `src/engine/save.ts` or packed asset.
  The two tasks share no path: `src/ui/partyDetail.ts` is Task-44's to **write** while
  Task-59 only reads its `MemberDetail`.
- **Shape:** two tasks. Task-44 opens a batch at the tail because its file set is the union
  of two serial resources: `src/scenes/RouteScene.ts` (free again only after Batch 12's
  audio work) and `src/engine/save.ts` (free after Batch 10). It could not sit before
  Batch 7 either, although both files were free in Batch 6: Task-17 holds
  `docs/routes-spec.md` §6 there, and Task-31 rewrites the exact seam this task extends —
  one placement helper, the route-scoped `pcCatch`, the same PC panel — so this task is
  written **against Task-31's shipped state** and takes the **next** `SAVE_VERSION` step,
  **16 → 17**, after Task-31's 15 → 16. Task-59 is the second member and takes the one free
  `src/scenes/BattleScene.ts` slot of the batch: that file is free in 13, 15, 16, 17 and 19
  because Task-39 held it in Batch 9, Task-40 in 9b, Task-26 in 10 and Task-30 in 12 — and
  this is the first of those five whose `src/ui/moveGrid.ts` (free after Task-39, Task-55's in
  18) and `docs/design-spec.md` §4 (free: Task-44 holds `docs/routes-spec.md` instead) are
  free too. It is written **against Task-39's shipped classifier**, three batches earlier, and
  it deliberately adds **no literal**, so the i18n key table Task-49 and Task-50 hold in the
  two batches after this one is nobody's here. Both tasks edit files Batch 11's reformat
  cleared, so they keep them conforming (no new ledger line), the way Batch 12 does for its
  two scenes. Neither adds a run field: Task-59 changes presentation only, so no
  `SAVE_VERSION` step.

### Batch 14 — the run's first wild catches easily
- **Task-48** The run's first wild Pokémon is much easier to catch.
- **Hot files:** `src/engine/battle/capture.ts` + `capture.test.ts`,
  `src/engine/battle/state.ts`, `src/engine/run/battleLink.ts`,
  `src/scenes/RouteScene.ts` and
  `src/scenes/BattleScene.ts` → Task-48; its two docs, `docs/battle-spec.md` §6 (the
  catch chance) and the capture bullet in `docs/routes-spec.md` §3, are Task-48's too.
  It claims no `package.json`, `src/main.ts`, `vite.config.ts`, `src/engine/save.ts`,
  `src/data/**`, `src/ui/**` or packed asset — and it **reads** the ball branch in
  `src/engine/battle/commands.ts` without editing it, because the flag rides the state
  `attemptCapture` already receives.
- **Shape:** one task, in its own batch, because the scene pair it needs is the widest
  serial resource in the plan: `src/scenes/RouteScene.ts` is held by every batch from 7 to
  13 (7 Task-31, 8 Task-08's every-scene sweep, 8b Task-35, 9 Task-39, 9b Task-40, 10
  Task-26, 11 Task-29's ledger, 12 Task-30, 13 Task-44) and `src/scenes/BattleScene.ts` by
  all of those except 13, so this is the first batch that leaves both free — Batch 6b's
  Task-38 takes `RouteScene` alone, and Task-49 and Task-50, the other two reports that want
  it, have to follow one batch apart each, because a batch is an antichain. It runs after Batch 7's Task-31
  on purpose: Task-31 settles the capture's placement and the single `addCaughtPokemon`
  path, and this task must not sit across a rewrite of the same catch. It edits files
  Batch 11's reformat cleared, so it keeps them conforming (no new ledger line), the way
  Batch 12 and Batch 13 do. It has **no** `SAVE_VERSION` step: the run fact it reads,
  `RunState.stats.catches`, is already saved.

### Batch 15 — the item pickup popup
- **Task-49** Obtaining an item raises a temporary popup.
- **Hot files:** `src/scenes/RouteScene.ts` → Task-49; `src/ui/notice.ts` +
  `notice.test.ts` → Task-49 (the module Task-31 creates in Batch 7, extended here with
  the pickup notice); `docs/routes-spec.md` §2 (the ground-item bullet) and the i18n key
  table plus both locales (`src/i18n/**`, whose exact files are read from what Task-26
  ships) → Task-49. Nothing else in the batch, and no `package.json`, `src/main.ts`,
  `vite.config.ts`, `src/data/**`, `src/engine/**` or packed asset.
- **Shape:** one task, one batch after Batch 14, because it is the second report in this
  round that owns `src/scenes/RouteScene.ts` — and after Batch 14 the scene is free of the
  whole 7–13 queue. Its dependency points backwards, not forwards: it **extends**
  `src/ui/notice.ts` and the HUD notice seam Task-31 ships in Batch 7 rather than inventing
  a second transient window, so it is written against Task-31's shipped state and takes the
  same seam, its copy and its hold time. It also has to work **through** Batch 10's i18n
  module rather than beside it, because its string is created after that sweep: the notice
  arrives with its own key and both locale entries, and `notice.ts` stays pure. It edits
  files Batch 11's reformat cleared, so it keeps them conforming (no new ledger line), the
  way Batch 12, 13 and 14 do. It adds no run field, so no `SAVE_VERSION` step. It is the
  **second of three notices** on `src/ui/notice.ts`: Task-31 (Batch 7) ships the module and
  the catch notice, this task adds the pickup notice, and Task-50 (Batch 16) adds the
  level-up notice one batch later because it wants the same scene and the same module — one
  module, N strings, one batch each.

### Batch 16 — the level-up popup
- **Task-50** A level-up raises a temporary popup.
- **Hot files:** `src/scenes/RouteScene.ts` → Task-50; `src/ui/notice.ts` +
  `notice.test.ts` → Task-50 (the module Task-31 creates in Batch 7 and Task-49 extends in
  Batch 15, extended here with the level-up notice); `docs/design-spec.md` §5 (the level-up
  sentence) and the i18n key table plus both locales (`src/i18n/**`, whose exact files are
  read from what Task-26 ships) → Task-50. It claims no `package.json`, `src/main.ts`,
  `vite.config.ts`, `src/data/**`, `src/engine/**`, `src/engine/save.ts` or packed asset.
- **Shape:** one task, one batch after Batch 15, because it is the **third** report in this
  round that owns `src/scenes/RouteScene.ts` and the second that owns `src/ui/notice.ts` —
  and a batch is an antichain, so two tasks that share a path cannot ride together. It is the
  plan's tail for the same reason Batch 14 and 15 are: `src/scenes/RouteScene.ts` is held by
  every batch from 7 to 15 (7 Task-31, 8 Task-08's every-scene sweep, 8b Task-35, 9 Task-39,
  9b Task-40, 10 Task-26, 11 Task-29's ledger, 12 Task-30, 13 Task-44, 14 Task-48, 15
  Task-49), so this is the first batch that leaves it free again, and `src/ui/notice.ts` is
  free here for the first time since Task-31 created it. Its dependency points backwards:
  it **extends** the module and the HUD notice seam Task-31 ships in Batch 7 rather than
  inventing a second transient window, so it is written against Task-31's (and Task-49's)
  shipped state. It also works **through** Batch 10's i18n module rather than beside it,
  because its string is created after that sweep. It edits files Batch 11's reformat cleared,
  so it keeps them conforming (no new ledger line), the way Batches 12–15 do. It adds no run
  field, so no `SAVE_VERSION` step.

### Batch 17 — the wild pool remembers what the run caught, and the battle's info window
- **Task-52** The wild table never offers a species the run has already caught — nor any of
  its evolutions, nor any of its forms (regional forms included), dead members included.
  **This is the plan's next `SAVE_VERSION` step: 17 → 18.**
- **Task-60** A battle ⓘ opens a window with the battle's own state: the weather and the
  terrain, each side's screens and the other conditions, and the active Pokémon's stat stages.
- **Hot files:** `src/scenes/RouteScene.ts` (the single construction site of the encounter
  table, `applyRoute` 1163-1172) → Task-52; `src/engine/routes/encounters.ts` +
  `encounters.test.ts` → Task-52; `src/engine/run/pool.ts` + `pool.test.ts` → Task-52;
  `src/engine/run/state.ts` + `state.test.ts` and `src/engine/run/resolve.ts` +
  `resolve.test.ts` → Task-52; `src/engine/save.ts` + `save.test.ts` → Task-52;
  `src/data/dex/evolutions.ts` + `evolutions.test.ts` (the family-plus-formes expansion) →
  Task-52; `docs/routes-spec.md` §3 (the wild-table bullet) → Task-52; `src/scenes/BattleScene.ts`,
  the new `src/ui/battleInfo.ts` + `battleInfo.test.ts`, the `src/ui/README.md` role line
  (the folder's per-file convention), `docs/design-spec.md` §4's window list and the i18n key
  table plus both locales (`src/i18n/**`, whose exact files are read from what Task-26 ships)
  → Task-60. Task-52 claims no `package.json`, `src/main.ts`, `vite.config.ts`,
  `src/data/dex/**` (the accessor it extends is hand-authored — nothing is regenerated and no
  packer runs), `src/ui/**` or packed asset; Task-60 claims no `package.json`, `src/main.ts`,
  `vite.config.ts`, `src/data/**`, `src/engine/**`, `src/engine/save.ts` or packed asset —
  and the two share no path.
- **Shape:** two tasks. Task-52 stays in its own batch because it needs the batch to be that
  wide for two independent reasons: `src/scenes/RouteScene.ts` is the **only** place the wild
  table is built and every batch from 5 to 16 holds it (5 Task-16, 5b Task-45, 6 Task-41, 6b
  Task-38, 7 Task-31, 8 Task-08's every-scene sweep, 8b Task-35, 9 Task-39, 9b Task-40, 10
  Task-26, 11 Task-29's ledger, 12 Task-30, 13 Task-44, 14 Task-48, 15 Task-49, 16 Task-50), and
  `src/engine/save.ts` is held by 7, 8b, 10 and 13 — so this is the first batch that leaves
  both of the resources the rule needs free at once. Its dependency points **backwards**,
  not forwards: it is written against Task-44's shipped `RunState` (Batch 13, whose RIP list
  holds the dead **members**, a different fact from this record) and Task-48's shipped catch
  roll (Batch 14, the same roll for a different rule), and it takes the **next**
  `SAVE_VERSION` step, **17 → 18**, after Task-44's 16 → 17, defaulting an older run's record
  to empty the way Task-13's and Task-44's steps do. It also runs after Batch 8's Task-20,
  which makes Rotom's appliances evolutions and so moves them inside the family walk this
  rule reads. Task-60 is the second member and takes the paths Task-52 leaves: `BattleScene.ts`
  is free here (13's Task-59 and 15's Task-49 and 16's Task-50 each hold only the route scene
  or the notice module), `src/ui/README.md` is free (Task-55 claims it in the batch after),
  `docs/design-spec.md` §4 is free (Task-52 holds `docs/routes-spec.md` §3) and so is the i18n
  key table its own labels need — free here for the first time since Task-26 wrote it, because
  Task-49 held it in 15 and Task-50 in 16. It shares no path with Task-52 and produces nothing
  Task-52 reads, so the batch stays an antichain while Task-52's own width claim is unchanged.
  It is a **reader** of the battle state and changes no engine rule, so it owes no
  `docs/battle-spec.md` line and **no** `SAVE_VERSION` step. Both tasks edit files Batch 11's
  reformat cleared, so they keep them conforming (no new ledger line), the way Batches 12–16
  do. Batch 4b is untouched — it is `cut`, so it can gain
  no member.

### Batch 18 — the MOVES panel draws four slots
- **Task-55** The MOVES panel always draws four slots, so a TM move can be dragged into
  the empty one.
- **Hot files:** `src/scenes/RouteScene.ts` and `src/scenes/BattleScene.ts` → Task-55;
  `src/ui/moveGrid.ts` + the new `src/ui/moveGrid.test.ts` and the `src/ui/README.md` line
  (the folder already lists a role line per file) → Task-55; `docs/design-spec.md` §5 (the
  four slotted moves and the drag onto a slot) → Task-55. It claims no `package.json`,
  `src/main.ts`, `vite.config.ts`, `src/data/**`, `src/engine/**`, `src/engine/save.ts` or
  packed asset, and no `docs/` file another batch holds: `docs/design-spec.md` §5 is Task-50's
  in Batch 16 and free here.
- **Shape:** one task, and it needs a batch of its own because the two scenes it touches are
  the two the whole tail queues on: `src/scenes/RouteScene.ts` is held by every batch from 5 to
  17 (5 Task-16, 5b Task-45, 6 Task-41, 6b Task-38, 7 Task-31, 8 Task-08's every-scene sweep,
  8b Task-35, 9 Task-39, 9b Task-40, 10 Task-26, 11 Task-29's ledger, 12 Task-30, 13 Task-44,
  14 Task-48, 15 Task-49, 16 Task-50, 17 Task-52) and `src/scenes/BattleScene.ts` by 5, 5b, 6, 7,
  8, 8b, 9, 9b, 10, 11, 12 and 14 — so 6b, 13, 15, 16 and 17 are the batches that leave that
  second scene alone, and this is the first batch that leaves **both** free at once — the
  reason it opens a new one rather than joining Batch 17. It is written **against** the module
  two earlier batches shipped rather than beside it: Task-38 (Batch 6b) made the learnset band a
  scroll window and Task-39 (Batch 9) gave the ⓘ one classifier and deleted `MoveGrid.infoRect`,
  so a container the ⓘ cannot hit is this task's to keep honest. Its sibling add of a test file
  owes the `src/ui/README.md` line, which no batch claims any more (Task-38's in 6b, Task-31's
  in 7). It edits files Batch 11's reformat cleared, so it keeps them conforming (no new ledger
  line), the way Batches 12–17 do. It adds no run field and no rule, so **no** `SAVE_VERSION`
  step — and the one number it freezes (the four slots) is `MAX_MOVES`, not a new constant.

### Batch 19 — a move learned on a level-up is not equipped for you
- **Task-56** A move crossed on a level-up waits in the learnset; the player equips it.
- **Hot files:** `src/scenes/RouteScene.ts` → Task-56; `src/engine/run/progression.ts` +
  `progression.test.ts` → Task-56; `src/engine/run/learnset.ts` + `learnset.test.ts` (the
  OHKO/No Guard guard moves to the equip path) → Task-56; `src/ui/beats.ts` + `beats.test.ts`
  (the beat's `learned` list is fed from the resolution's events) → Task-56;
  `docs/battle-spec.md` §7's level-up bullet, and `docs/design-spec.md` §5 only if its level-up
  sentence changes → Task-56. It claims no `package.json`, `src/main.ts`, `vite.config.ts`,
  `src/data/**`, `src/engine/save.ts` or packed asset.
- **Shape:** one task, one batch after Batch 18, because it wants `src/scenes/RouteScene.ts` —
  free for the first time in Batch 18 and Task-55's there — and three engine/UI paths whose
  earlier holders have all merged by now: `src/engine/run/progression.ts` with its test
  (Task-42's in Batch 5, which Task-51 re-pins in 5b), `src/engine/run/learnset.ts` (nobody's)
  and `src/ui/beats.ts` with its test (Task-40's in Batch 9b). Its dependency points
  **backwards**: it extends the module Task-40 shipped and the `learn`/`forget` events
  `resolveBattle` already returns, and it is written so that Task-50's transient level-up notice
  (Batch 16) and the key-dismissed `LEVEL UP` modal keep reading a populated `learned` list —
  the field's **meaning** does not move, only its source, which is why the two can ship in
  different batches. It is the only task of the round that changes a **rule**, and it adds
  **no** run field, so no `SAVE_VERSION` step: an existing save's members keep the moves they hold
  and simply stop receiving new ones for free. It edits files Batch 11's reformat cleared, so it
  keeps them conforming (no new ledger line), the way Batches 12–18 do.

### Batch 20 — the whole chrome takes the debug panel's palette
- **Task-58** Every panel is the debug panel's own visual style: one dark, translucent
  surface, one bright accent frame and one light ink, in place of the drawn set's light
  windows and deep-black text.
- **Hot files:** all of them, which is why the pick says the task runs **alone**:
  `scripts/ui/build-chrome.mjs` (the palette it draws with), the three generated
  `src/assets/ui/{window,textbox,font}.png`, the generated `src/data/ui/chrome.json` and
  `font.json`, `src/ui/frlg.ts`, `src/ui/frlgFont.ts` + `frlgFont.test.ts`,
  `src/ui/README.md` and `src/assets/README.md`, every `src/scenes/*.ts` (`BootScene` only
  if its loader derives a colour; the drawn keys do not move) and every `src/ui/**` module
  that fills a container or inks text (`moveGrid.ts`, `abilityInfo.ts`, `infoPopup.ts`,
  `panel.ts`, `partyScreen.ts`, `partyDetail.ts`, `capture.ts`, `settingsScreen.ts`,
  `bag.ts`, `rewards.ts`, `permadeath.ts`, `evolutionGraph.ts`, `mapView.ts`,
  `seedPrompt.ts`, `typewriter.ts` and `shop.ts` if its rows draw a chip) — plus
  `docs/art-direction.md` (the §Palette paragraph Task-16 rewrote) and `docs/design-spec.md`
  (§3's panel sentence and §4's window list). It claims no `package.json` (Task-16 ships the
  `data:ui` script), no `src/main.ts`, no `vite.config.ts`, no `src/data/dex/**`, no
  `src/engine/**`, no `src/engine/save.ts` and no art outside `src/assets/ui/**`.
- **Shape:** one task, **alone in its batch**, and that is the whole reason Batch 20 exists:
  the re-tune reaches every scene and most of `src/ui/**`, so every batch from 5 to 19 holds
  at least one path it rewrites (5 Task-16's chrome set, 5b Task-45's atlases and Task-53's
  battle scene, 6 Task-34's battle scene and Task-41's route scene, 6b Task-38's route scene
  and Task-57's battle scene, 7 Task-18's battle scene, Task-31's route scene and Task-47's
  main menu, 8 Task-08's every-scene sweep, 8b Task-35, 9 Task-39, 9b Task-40, 10 Task-26's
  every-scene sweep, 11 Task-29's `src/**` ledger, 12 Task-30, 13 Task-44 and Task-59, 14
  Task-48, 15 Task-49, 16 Task-50, 17 Task-52 and Task-60, 18 Task-55, 19 Task-56) — the same
  shape as the reformat (`Task-29`, Batch 11), and like it, **last**. It runs **after**
  Task-16 (whose chrome it re-tunes: the packer's palette constants, `chrome.json`'s alphas
  and corners, the three atlases, `frlg.ts`'s exports and `frlgFont.ts`'s `FRLG_INK`) and
  **after** Batch 11, so it edits reformat-cleared files and keeps them conforming (no new
  ledger line), the way Batches 12–19 do. One consequence is written into the entry rather
  than hidden: Batch 8's accessibility audit ran against Task-16's chrome, so this task owes
  its own contrast check instead of re-running Task-08, and the open question below offers
  the light-panel alternative that would need neither the extra check nor this batch.

### Open questions for the human

Batch 4b's three reports added two more, this second round of six added four, the third
round of three adds three, a fourth round of two adds two, the fifth round of two adds
four (three behind the wild-pool rule and one behind the battle panel's types) and the sixth
round of four adds three (two behind the four-row Mart and one behind the four containers) —
the sixth round's fourth report is a measurement rather than a question, and it is written into
`[Task-09]`'s entry instead — and the seventh round's single report adds two (both behind the
trainer's Poké Ball row) — and the eighth round's three reports add five (two behind the debug
panel's palette, one behind the switch window's move ⓘ and two behind the battle's info
window) — and Batch 5's own one (Task-42's catch HP: the number or the fraction) was
**answered with the fraction** and shipped, so its bullet is gone — and every
question here carries a written default rather than a guess. Everything the first plan
raised is decided: the Añil art was materialised into the local clone, `Task-23` is unblocked
(the three moves ship, `D42`), `Task-24` is retired, the audio comes from the original
games' audio rips under `sprite-sources/frlg-audio/`, and the Plates are made obtainable
by `Task-07`. A question lands here only when the repository genuinely cannot answer it.
The one ID without a batch is not a question: `[Task-28]` waits on an upstream
`typescript-eslint` release.

- **`[Task-34]` (the battle SWITCH grid, Batch 6): is "1/6" one row per member?** The
  request says the cells must occupy a sixth and that six party rows fill the panel, so
  the entry is written as **one row per member in a single column** — the classic party
  list — with the label clipped instead of wrapped and the arrow keys stepping member to
  member. The other reading is that the 3-column avatar grid (`PARTY_COLS`) stays and only
  its cell height is capped at a sixth of the window. The default is the first, because
  only that layout makes six rows fill the panel and makes a single-column cursor the
  right cursor; say so before Batch 6's branch is cut if the avatar grid is meant to stay.
  Nothing else in the plan changes either way.

- **`[Task-38]` (the learnset band, Batch 6b): does the band keep a control, or is the
  wheel alone enough?** The band is mouse-first today — its cells are dragged onto the
  four slots and its only other input is the search field — so the written default is: the
  `<` / `>` pair **stays as a one-row scroll** (a control that reads "one row" instead of
  "four cells"), so a keyboard or pad player, who has no wheel, can still reach row five,
  and the search field keeps the ~78px those glyphs occupy today. The other reading is that
  the band scrolls by wheel and drag only and the glyphs go, which frees that width on the
  search row and leaves a touch/TV player unable to see past the first two rows. Say so
  before Batch 6b's branch is cut if the arrows are meant to go; nothing else in the plan
  changes either way.

- **`[Task-40]` (the battle's entry beat, Batch 9b): how loud is the opening, and what
  does the trainer's own beat do?** "Parpadeos en negro o algo así" leaves the cadence
  open. The written default is **one** black-out and fade per battle — the camera's own
  flash and fade, which is also the single step the reduced-flash preference can cut —
  plus, for a trainer, the trainer sprite's own entrance before the send-out, and no
  second full-screen blink; the beat is short and **skippable**, so any confirm/cancel
  press or a click fast-forwards it to the first feed frame. The other reading is a
  multi-blink opening (two or three flashes, as the cartridges do) or no camera effect at
  all, with the difference carried entirely by the two entrance beats. Nothing else in the
  plan changes either way.

- **`[Task-41]` (the follower, Batch 6): what does the follower show for a species with no
  sheet?** `src/assets/pokemon/**` is 652 committed pairs — dex **nums 1-649** plus the
  three Deoxys formes (`35101`-`35103`) — while the playable set is much wider, so a lead
  whose species is Gen 6+ (or a forme with no sheet of its own) has no overworld art to
  draw. The written default is: resolve the member's `speciesId` through
  `getSpecies(id)?.num` (`speciesByNum`, `src/data/dex/species.ts`) and **draw nothing**
  when no sheet matches, so the follower simply is not there for those leads; the
  alternative is that this report also owes a sheet-extension job (a new `legacy-art`
  pack for the ids the clone does not cover), which is a task of its own and not this one.
  Say which before Batch 6's branch is cut. Nothing else in the plan changes either way.

- **`[Task-45]` (the grass step, Batch 5b): does the tile animate always, or only under the
  player?** `TilesetConfig` has no animation contract today, so the reading is free: the
  written default is FireRed's own — **every tall-grass cell sways continuously** on one
  shared timer, which is what "como en rojo fuego" describes — and the alternative is a
  rustle only on the tile the player stands on (a stepped beat, cheaper, but not what the
  cartridge does and it reads as a one-off). Say which before Batch 5b's branch is cut.
  Nothing else in the plan changes either way.

- **`[Task-46]` (the score screen, Batch 5b): does a *won* run also return to the main
  menu?** The report is only about losing, and one screen serves both outcomes
  (`RunOverScene`'s `won` flag). The written default is **both** — the run is over either
  way, the summary still reports the win, and the main menu is where a new run is started —
  and the alternative is that only `won: false` goes to the menu while a win keeps pushing
  the player into the starter pick. Say which before Batch 5b's branch is cut. Nothing else
  in the plan changes either way.

- **`[Task-47]` (the Continue row, Batch 7): `Map 3 · Deep Forest`, or the room as a third
  clause too?** The report asks for the map and the biome *instead of* the route string, and
  the route HUD's own title already reads `Map <n> · <biome>` (`RouteScene`, 2058). The
  written default is that exact string, so the menu and the HUD never disagree; the
  alternative is `Map 3 · Deep Forest · Route 2` in `partyDetail.ts`'s `catchLabel` order
  (biome first, then map, then room, 151-154), which keeps telling the player how far in they
  are. Say which before Batch 7's branch is cut if the room is wanted back. (The party
  strip's own scale and pick — `portraitFor` over the boot-loaded portrait atlas rather than
  the unused Añil icon strips or Task-41's overworld sheets — is written into the entry and
  is not a question.) Nothing else in the plan changes either way.

- **`[Task-48]` (the first catch, Batch 14): is the boost the run's first *success*, and is
  it a flat 255?** Two calls, both written as defaults. First: the boost belongs to the run's
  first **successful** capture, i.e. it is live while `stats.catches === 0`, so a failed
  throw or a wipe does not spend it and it needs **no** new run field; the alternative is the
  first *attempt* only, which needs a new persisted flag and therefore a `SAVE_VERSION` step
  (**17 → 18**, after Task-44's 16 → 17) and burns the gift on a mis-throw. Second: the
  override is a **flat 255**, which ignores the species and makes the first catch certain
  (`catchValue` 255 returns success outright, `capture.ts` 38, whatever the HP and the ball);
  the alternative is a merely generous fixed rate (say 200), which is "easier" but not
  "much easier" and can still fail on a full-HP target. Say which before Batch 14's branch is
  cut. Nothing else in the plan changes either way.

- **`[Task-49]` (the pickup popup, Batch 15): does the Mart's purchase raise it too?** The
  report says "when an item is obtained", and three paths put an item in the bag. The
  written default is the two that are otherwise **silent** — the ground item and the
  mini-boss reward — while the Mart keeps its own "Bought <name> for ¥<n>." line, because a
  transient popup on top of a window that already said what it sold is noise; the
  alternative is all three, Mart included. The default also names the item only
  (`Obtained <name>!`), since every path but the Mart grants one unit — say if a stack's
  count is wanted in the string. Say which before Batch 15's branch is cut. Nothing else in
  the plan changes either way.

- **`[Task-50]` (the level-up popup, Batch 16): does the temporary notice replace the
  learned-move modal, or sit beside it?** The route HUD already opens a *modal* on a
  level-up — the `LEVEL UP` window with one `X learned Y!` line per crossed move, dismissed
  with any key or a click (`buildLearnPopup`/`showLearnPopup`, `RouteScene` 4694-4738) — but
  it stays hidden when nothing was learned (`if (lines.length === 0) return;`, 4732), so a
  level with no new move is silent today; the report asks for a **temporary** popup in the
  style of Task-31's catch notice and Task-49's pickup notice. The written default is that
  the two **coexist**: the transient notice fires on **every** level-up beat (so a level
  with no new move is no longer silent) and the modal stays for the move names, because the
  notice carries no key, has no room for a four-move list and is the only place a learned
  move is ever named. The alternative is that the transient notice carries the learned-move
  lines too and the modal is deleted, which is less noise but loses the "press any key" beat
  `docs/design-spec.md` §5's own sentence describes. Say which before Batch 16's branch is
  cut. Nothing else in the plan changes either way.

- **`[Task-51]` (the evolution rework, Batch 5b): where do the BST bands sit, and how does
  the +10 rule round past the cap?** Two calls, both written as defaults. First: the bands
  are the dex's own `bst`, low → **20**, mid → **30**, high → **40**, anchored on the run's
  `LevelBand.bst` windows (`src/data/run.ts`, the windows `docs/balance/route-curve.md`
  records), so a species lands where its power says — Eevee (325) stays 20, Pikachu (320)
  rises to 30 by the +10 rule, Primeape (455, obtained at Mankey's 28) goes to 40; say if
  the thresholds should instead be flat cutoffs, or if a plain "band value" should override
  the +10 floor. Second: a species obtained above level 30 must now evolve at ≥ +10, and the
  six finite maps cap out at **40** (`levelCapForMap`), so the late stone lines the report
  does not name — Seadra (obtained at 32) wants ≥ 42 — only ever fire in infinite mode. The
  written default is to **keep the cap** and let such an evolution wait (the report's rule
  taken literally); the alternative is to clamp the rule to the last reachable level (40) so
  a late line still evolves inside a finite run. Say which before Batch 5b's branch is cut.
  Nothing else in the plan changes either way.

- **`[Task-52]` (the wild pool, Batch 17): does the run's own starter count as caught?** The
  report says "un poke ya capturado", and the starter was picked rather than caught: the
  record the task adds is written by the catch fold (`resolveBattle`, 92-101) and `createRun`
  seeds the starter straight into the party (`state.ts` 122-148), so nothing records it. The
  written default is that the **starter is not tracked** and the grass may still roll its line;
  the alternative is to seed the record with the starter's species at `createRun` (one line)
  so the player never meets its own first Pokémon again. Say which before Batch 17's branch is
  cut. Nothing else in the plan changes either way.

- **`[Task-52]` (the wild pool, Batch 17): does the rule bind trainer rosters too?** The report
  says "pokemon salvaje", and only the wild table is narrowed by the written default — a
  trainer, its Ace and its boss may still field a line the player owns, which keeps the
  "the enemy has what you have" beats and leaves `speciesPool(band, 'trainer')` and
  `src/engine/run/roster.ts` untouched. The alternative is to widen the rule to every roster,
  which makes a trainer's team read as "not already yours" but also empties the trainer pool of
  the families a long run has collected. Say which before Batch 17's branch is cut. Nothing
  else in the plan changes either way.

- **`[Task-52]` (the wild pool, Batch 17): what happens when the exclusions would empty a
  band's table?** A band's pool is a BST window over the whole playable dex (`LEVEL_BANDS`,
  `src/data/run.ts` 26-79), so catching every family of one band is a corner case rather than
  something a run reaches — but it has to have an answer. The written default is that the
  narrowed table **falls back to the unfiltered band**, because an empty table also skips the
  chance draw (`rollEncounter` line 55 short-circuits on `table.length === 0`), which would
  move the room's stream and leave that band with no encounters at all; the alternative is to
  honour the rule literally and let the grass go quiet there. Say which before Batch 17's
  branch is cut. Nothing else in the plan changes either way.

- **`[Task-53]` (the battle panel's types, Batch 5b): both panels, or only the player's?**
  The report says "panel de combate" and the two HP panels are one builder (`drawSidePanel`,
  `BattleScene` 1604-1663), so the written default is **both** — the foe's types are what the
  player reads to pick a move, exactly as the panel already shows the foe's HP and status. The
  alternative is the player's own panel alone. A second, smaller call travels with it: the
  badges are the Añil type atlas the move cells and the starter cards already draw
  (`src/data/typeIcons.ts`), with the text chip as the fallback for a name the atlas lacks —
  say if a plain coloured chip is wanted instead everywhere, which is one line. Say which
  before Batch 5b's branch is cut. Nothing else in the plan changes either way.

- **`[Task-54]` (the Mart's four rows, Batch 5b): do the cures and the X-items leave the buy
  list?** "Siempre … 4 objetos" is the whole stock, and the four rows it names are a ball pack,
  one potion and two held items — so every `kind: 'status'` cure and every X-item the core and
  the rotation carry today (Antidote, Full Heal, X Attack / Defense / Speed) can no longer be
  **bought**; they would reach a run from the ground loot and the mini-boss reward only. The
  written default is that the report is taken literally — exactly four rows, so the cures and the
  X-items leave the Mart — because a fifth row is the thing the human is asking to be rid of; the
  alternative is that the potion row becomes the band's cure row on the floors whose core carried
  one (`mid`/`high`/`late`/`end`), which keeps the cures purchasable but stops the second row
  being a Potion. Say which before Batch 5b's branch is cut. Nothing else in the plan changes
  either way.

- **`[Task-54]` (the Mart's four rows, Batch 5b): are cheap berry rows acceptable on the early
  floors?** The two held rows take their **catalogue** price, and the cheapest held rows in the
  catalogue are the berries (Oran 100, the status berries 200) — below the Potion's 300 on the
  `early` and `low` bands, while "ya mas caros segun el objeto" describes the intention. The
  written default is to **keep the catalogue price** and let the intent hold from `mid` on, where
  the 1000-class utility items and then the 4000-class competitive set enter the pools (so the
  two rows are the expensive ones exactly where the player has money); the alternative is a
  per-band held **markup** table beside `SHOP_BALL_PACK`, so every band's held rows sit above its
  own potion and the early floor sells berries at a premium. Say which before Batch 5b's branch is
  cut. Nothing else in the plan changes either way.

- **`[Task-55]` (the four containers, Batch 18): does the battle's FIGHT menu draw them too?**
  "en moves" names the panel, and the MOVES **tab** is what the report's reason needs (a TM is
  dragged onto a slot only in the route HUD; the battle has no drag). The written default is
  **both surfaces**: the shared `MoveGrid` gets one empty-slot marker and both scenes draw the
  four containers, with the battle's empty ones disabled — there is no move to select — so a
  two-move Pokémon reads the same in battle as on the route. The alternative is the route HUD's
  MOVES tab alone, which leaves the battle's menu drawing one cell per move. Say which before
  Batch 18's branch is cut. Nothing else in the plan changes either way.

- **`[Task-57]` (the trainer's balls, Batch 6b): one row per battle, or one on each panel?** The
  report names the **trainers** ("los entrenadores … debajo de su panel"), so the written default
  is the **foe's panel alone** — the trainer's team is the one fact the player does not already
  have, while their own team is one keypress away in SWITCH — and a **wild** battle, having no
  trainer, draws **no row at all** (the alternative there being a single dimmed ball, which says
  nothing the sprite on the field does not). The other reading is **both** panels, the player's row
  reading `state.sides.player.party` and gated on the party rather than on `isWild`, which is one
  more branch in the same builder and one more row to place on the player's taller panel
  (`PLAYER_PANEL_H = 148`, 86). Say which before Batch 6b's branch is cut. Nothing else in the plan
  changes either way.

- **`[Task-57]` (the trainer's balls, Batch 6b): how many balls are drawn — the team the trainer
  brought, or only the ones still standing?** The report's own words are "según la cantidad de
  pokes que le quedan", which reads either way: a **fixed** row of one ball per roster member with
  the fainted ones emptied (so a trainer with two left of three shows three balls, one of them
  spent, and "how many are left" is the filled ones), or a row that **shrinks**, drawing only the
  live members (so that same trainer shows two). The written default is the **fixed row** — the
  size is in the scene (`state.sides.enemy.party.length`, the fighters `init` builds at 364-375)
  and it is what the cartridges draw, and it is the only reading that also says how many the
  trainer started with; the alternative is the literal shrinking count, which is one fewer line
  (`take(liveCount)`) and never reveals the original team size. Say which before Batch 6b's branch
  is cut. Nothing else in the plan changes either way.

- **`[Task-58]` (the whole-chrome restyle, Batch 20): does the panel **interior** go dark, or
  only the frame?** The report says the panels should be "estilo visual como el de debug", and
  the debug panel is dark (`background:#10161fe6`, `src/dev/debugMenu.ts` 296-299) while
  Task-16's shipped set keeps the FRLG **light** window (`#f8f8f8` under the deep-black
  `FRLG_INK`) and only darkens its battle box. The written default is the **full match**: the
  interior becomes the palette's own `#10161f` at the panel's degree (~0.90), the 2px frame is
  the debug panel's accent `#7dd3fc`, the ink flips to the light body tone the palette already
  names (`docs/art-direction.md` 14: "UI text `#f8fafc`") with one muted tone for the
  secondary lines, and every light container fill that pairs with that ink moves with it
  (`moveGrid`'s cells, `abilityInfo`'s button, the command cells, the HUD's rows, the starter
  cards) — which is why the task claims every scene and most of `src/ui/**` and sits in
  **Batch 20**, behind every batch that owns one of those files. The alternative is the
  **frame-only** re-skin: the accent border, its 2px width, the corner and the ~0.90 alpha over
  the light interiors with `FRLG_INK` kept, which needs no ink flip and no container re-tint and
  would therefore fit in **Batch 5b**, right after Task-16 — but it leaves the panels light, so
  it is only "like debug" in their frame. Say which before Batch 20's branch is cut. Answering
  it the alternative way empties Batch 20 and moves this task to 5b; nothing else in the plan
  changes either way. (The panel's own type treatment is *not* a question: the debug overlay's
  `12px/1.4 monospace` is a DOM font, and adopting a typeface is a separate job Task-16 already
  ruled out of its own scope — this task keeps the bitmap face and moves only its tone and its
  halo.)

- **`[Task-58]` (the whole-chrome restyle, Batch 20): does the accessibility audit have to be
  re-run after it?** `[Task-08]` (Batch 8) audits contrast, colour-only information and
  reduced flash **against the chrome Batch 5 shipped**, and this task lands twelve batches
  later with a palette that flips every one of those relationships. The written default is that
  Task-08 is **not** re-run and this task carries its own contrast check (it is the task that
  introduces the new tones, so it is the one that owes the pairs that read as one on the new
  surface — the selected tab against the unselected one, the HP bar's green against the darker
  field, a dimmed ball or a faint status badge); the alternative is to treat the restyle as an
  accessibility change and re-open the sweep, which is a second `Task-08`-shaped task and not
  something this plan can schedule without the human saying so. Say which before Batch 20's
  branch is cut; nothing else in the plan changes either way.

- **`[Task-59]` (the switch window's move ⓘ, Batch 13): does a press on the ⓘ swallow the
  member selection?** `docs/design-spec.md` §4 states the rule the switch window's ⓘ lives
  today — "the ⓘ is **hover only**, so a press there still selects the member under it" (191-192,
  the ability row's rule and `partyAbilityZone`'s own comment, `BattleScene` 707-717) — and the
  report asks for a press as well as a hover on the **move** rows. The written default is that
  the move ⓘ gets a zone of its own sized to the button that **swallows** the press and pins its
  popup, so one control never both pins a description and re-selects the member underneath; the
  ability ⓘ keeps its hover-only rule unchanged, and a press anywhere else on the window still
  selects the member as it does today. The alternative is that the move ⓘ is **hover-only too**
  (the report's "o ponerse encima" taken alone), which needs no new press path and no §4
  sentence about presses but leaves a pad or touch player unable to pin a move's text. Say which
  before Batch 13's branch is cut. Nothing else in the plan changes either way.

- **`[Task-60]` (the battle's info window, Batch 17): where does the ⓘ button live?** The
  report says "un boton info en el combate" and names no control. The written default is a
  **fifth control reserved at the right edge of the command window**, the shape the moves menu
  already gives the Mega control (`MOVE_MEGA_COL`, `BattleScene` 108, laid out as a
  `rightReserve`), so the FIGHT / BAG / SWITCH / RUN 2x2 (`MENU_GRID_COLS = 2`, 103;
  `openMenu`, 1204-1218; `renderCommandMenu`, 1670-1728) keeps its geometry and the info window
  opens like any other menu; the alternatives are a **fifth `menuItems` cell**, which makes the
  grid three rows in the same 100px window, or a small control on the HP panels, which is
  colour-free but sits inside the panel `Task-53` (Batch 5b) and `Task-57` (Batch 6b) already
  fill. Say which before Batch 17's branch is cut. Nothing else in the plan changes either way.

- **`[Task-60]` (the battle's info window, Batch 17): how much of the battle state does the
  window list?** The engine carries four groups the report names — `state.weather` +
  `weatherTurns`, `state.terrain` + `terrainTurns` (`src/engine/battle/state.ts` 97-100), the
  seven per-side `sideConditions` (14-15, 21, 24-34, 65 — Reflect, Light Screen, Aurora Veil,
  Tailwind, Lucky Chant, Mist, Safeguard) and the seven whole-field conditions (18-19, 36-46,
  102 — Trick Room, Gravity, Magic Room, Wonder Room, Fairy Lock, Mud Sport, Water Sport) — plus
  the per-fighter `boosts` (`fighter.ts` 194, `BoostId` 20) and, beside them, a per-side
  `wishTurns` (60-61), each active's `status`/`statusCounter` (190-192) and its `volatiles`
  (195: confusion, Leech Seed, Substitute, Taunt, Encore, Perish Song and the rest). The written
  default is the report's own four groups **plus** each active's non-volatile status — weather,
  terrain, the field conditions with a count, each side's conditions with their counts, each
  side's stat stages — and **not** the volatiles, because a volatile is a per-fighter state the
  active Pokémon's own row already implies and the report asks for "contexts" rather than a
  combat log; the alternative is to list every non-zero volatile under each active too, which is
  more rows in the same window and one more pure-model case. Whatever is picked, the panel
  **says what the engine lacks**: the entry hazards (Stealth Rock, Spikes, Toxic Spikes, Sticky
  Web) are not modelled at all (`src/engine/battle/effects/moves.ts` 594 says so in the tree),
  so the window must not pretend to list them. Say which before Batch 17's branch is cut.
  Nothing else in the plan changes either way.

---

## Phase 0 — Repo & scaffolding

> Completed work for this phase is archived in `CHANGELOG.md`.

- [ ] **[Task-28] Activate the ESLint half of `npm run lint`.** Task-01 shipped
      `eslint.config.mjs` committed and **dormant**: the flat config for `src/**/*.ts`
      and `vite.config.ts` (plus `vite`/`infra`/`public`/`sprite-sources`/`coverage`/
      `.agent_specs`/`scripts` ignores), written so that switching it on is a
      dependency install and one script edit, with its header comment as the record.
      It cannot run today: the repo pins native `typescript@7.0.2`, which exposes no
      JavaScript API, and every `typescript-eslint` release up to **8.71.2** declares
      `typescript >=4.8.4 <6.1.0`, so `@typescript-eslint/parser` throws at import and
      `npx eslint .` exits 2. **Blocked outside this backlog.** It becomes schedulable
      when a `typescript-eslint` release declares a TypeScript 7 peer — or when the
      human decides to run the ESLint half on a separate, non-native TypeScript
      toolchain — and only then does it take a batch. The activation itself is:
      install `eslint`, `@eslint/js`, `typescript-eslint` and `eslint-config-prettier`
      (`package.json`, `package-lock.json`), chain `eslint . &&` in front of the frozen
      `prettier --check .`, and make it green on the tree **as it stands** — switch
      rules off in `eslint.config.mjs`, never edit a file it reports. Linting
      `scripts/**` stays out of scope: the config ignores them on purpose.
      *Dependencies:* none inside this repo — it waits on the upstream release.
      **Unscheduled** (no batch).
- [ ] **[Task-29] The Prettier reformat pass.** Task-01 shipped the format gate over a
      **ledger** rather than rewrite a file a batch-mate owned: `.prettierignore` is a
      132-entry file, and its `src/**` block is **105 individual files** (plus the four
      generated-data globs, which stay) that Prettier would rewrite — each verified
      non-conforming, so the ledger hides no clean file. This task pays that off:
      format every ledgered `src/**` file with the shipped `.prettierrc.json`
      (`npx prettier --write <file>`, never a retune of the options), confirm the file
      now passes `prettier --check`, and delete its ledger line. What stays is exactly
      what has a reason to stay: the generated/binary globs, the `scripts/**` packers
      and the prose files the ledger names (`AGENTS.md`, `CHANGELOG.md`, `TODO.md` and
      the `docs/*.md` it lists), which belong to the docs tasks and to the
      Orchestrator, and get a clearer comment than today's. Owners: the ledgered `src/**` files and `.prettierignore`. Every task
      from here on keeps the ledger from growing — a new file conforms, and a task that
      edits a ledgered file never adds a line to hide it.
      *Dependencies:* none. *(Batch 11)*

## Phase 1 — Dex accessors & data contracts

> Completed work for this phase is archived in `CHANGELOG.md`.

The generated dex is in `src/data/dex/`; this phase wraps it in typed, tested
accessors so the engine never touches raw JSON.

## Phase 2 — Route generation & exploration

> Completed work for this phase is archived in `CHANGELOG.md`.

The generator carves the shape's lanes out of a solid forest; trainers and ground
items are placed by the population pass (`docs/routes-spec.md` §2). The target
algorithm, its guarantees and its open questions are in
`docs/route-generator.md`; these are the steps to get there, one branch each,
most useful first. The art counterparts (a real tall-grass tile, the
floor/path split, props) stay in Phase 8 "Route generation & FRLG fields".

- [ ] **[Task-52] The wild table never rolls a species the run has already caught, nor its
      evolutions, nor its forms.** Reported in play: «para los pokemon salvaje no deberia
      aparecer un poke ya capturado aunque haya muerto, ninguna de sus evoluciones ni formas
      tampoco regionales» — the tall grass must not offer a species the run already caught,
      nor any of its evolutions, nor any of its forms (regional forms included), and "already
      caught" **includes a member that has since died**.
      **Today the table knows only the band, and the run remembers no species.** `applyRoute`
      builds the room's table as `new RouteEncounters(encounterTableFor(band), roomLevel,
      roomLevel, …)` with the encounter stream keyed on `(seed, "encounters", routeIndex)` and
      the shiny roll on a stream of its own (`src/scenes/RouteScene.ts`, 1163-1172), reached
      from `buildRoom` (959-977) through `buildRoute` (1105-1137); `encounterTableFor`
      (`src/engine/routes/encounters.ts`, 16-18) is exactly `speciesPool(band, 'wild')`
      (`src/engine/run/pool.ts`, 35-46, `D39`) minus the legendary/mythical tags
      (`WILD_BANNED_TAGS`, 13-17), every entry weighted the same, and **nothing else narrows
      it**. `rollEncounter` (47-62) spends one `rng.next()` for the 15% chance (55) and
      `pickWeighted` (37-45) a second one for the pick.
      **The run keeps no record of what it caught.** `RunStats` is `{ catches, casualties }`
      (`src/engine/run/state.ts`, 25-33) and `recordCatch` (496-499) bumps the count only; the
      run's lists are all **per floor** and cleared by `advanceMap` (185-204) — `pcUnlocked`
      (71-76), `defeatedTrainers` (102-103), `pickedItems` (104-105), `capturedRooms`
      (106-107); a member's `caughtAt` (`RunPokemon`, `src/engine/run/progression.ts`, 30-36;
      read back at `src/engine/save.ts`, 497-503) names a biome and a room and never a species;
      and `releaseFainted` (`src/engine/run/perms.ts`, 17-29) **deletes** a 0-HP member, so a
      catch that died leaves nothing behind but `stats.casualties`. Deriving the set from the
      party, the box or Task-44's RIP list is therefore neither enough nor wanted — the catch
      that died is exactly the case the report names — so **this task adds a run field and
      takes a `SAVE_VERSION` step.**
      **The rule, as decided (the spec freezes the names).** `RunState` gains
      `caughtSpecies: readonly string[]` — the species id of every **successful** catch, in
      catch order, deduped — written at the one place a catch is folded (`resolveBattle`,
      `src/engine/run/resolve.ts`, 92-101), where the species is already in hand: `recordCatch`
      grows a species argument (its only call site is line 100), so the list and
      `stats.catches` can never disagree. It is a **run-long** fact: `advanceRoute` and
      `advanceMap` never clear it, unlike the four per-floor lists above, and only a fresh run
      starts it empty. At **pool-build time** each recorded id is expanded to its line,
      deterministically: `evolutionFamily` (`src/data/dex/evolutions.ts`, 112-138 — walks
      `prevo` up and `evos` back down, so Raichu-Alola already sits inside Pikachu's family,
      `src/ui/evolutionGraph.test.ts` 29-37) **plus the formes**, which the family walk alone
      does not reach: an entry that is nobody's `evos` child and has no `prevo` — the alternate
      and cosmetic formes the build carries as species of their own (Rotom's five appliances
      until Task-20 makes them evolutions in Batch 8, busted/noice/pattern-style formes,
      `isCosmeticForme` entries and friends) — is reachable only through the entry's own
      national dex number. The JSON carries the field: every `src/data/dex/species.json` entry
      is the raw Showdown entry, so `num`, `forme` and `baseSpecies` are all present, while
      `Species` (`src/data/dex/species.ts`, 21-45) declares `num`, `forme`, `prevo`, `evos`
      and `isCosmeticForme` and **not** `baseSpecies` — and `BY_NUM` (56-64) keeps **one**
      species per number, so an "every species whose `num` is this one's" accessor does not
      exist yet and is part of this task. Recommended home: beside `evolutionFamily`, with its
      cases in `src/data/dex/evolutions.test.ts` (the alternative key, `baseSpecies`, needs a
      field the type does not declare and reads the same set). Expanding the **recorded ids**
      at read time rather than storing an expanded family at catch time keeps the record small
      and makes an evolution inside the line a no-op.
      **Fix shape:** one pure helper and one narrower table. `encounterTableFor` gains an
      **optional** excluded-id set (so every existing `encounterTableFor(band)` expectation
      stays green — `src/engine/run/pool.test.ts`, 97-114) and drops those ids from the table;
      the run-side helper that computes the set (`wildExclusions(run)`, the name the spec's)
      lives in `src/engine/run/pool.ts` beside `WILD_BANNED_TAGS` and the bans (13-26), and
      `RouteScene` passes it where it builds the table (1163-1172). The exclusion is applied
      **before** the roll and draws **nothing** (D11): `pickWeighted` still spends exactly one
      `rng.next()` and `rollEncounter` its own one, so a fixed seed's sequence keeps its shape;
      a fresh run's table is identical to today's, and only a run that has caught something
      narrows. **Where the exclusion is re-read is a real decision the spec must freeze:** the
      room's table and its `Rng` are built once per `applyRoute` and `applyBattleResult`
      (5042-5121) does **not** rebuild the room after a catch, so a table narrowed only at
      build time keeps rolling the family you just caught until the next door. The recommended
      reading is that `RouteEncounters` holds the live exclusion and re-filters per `step()`
      (71-86), the scene refreshing it when the run changes, i.e. after `resolveBattle`;
      rebuilding through `applyRoute` is the wrong tool, because the fresh `Rng` there restarts
      the room's encounter sequence.
      **What becomes empty.** A band's pool is a BST window over the whole playable dex
      (`LEVEL_BANDS`, `src/data/run.ts`, 26-79: 0-305, 306-355, 356-440, 441-490, 491-520,
      521-800), so exhausting one by exclusion is a corner case rather than a reachable one —
      the spec still has to say what happens, and the recommended reading is that a table the
      exclusions would empty **falls back to the unfiltered band**, because an empty table also
      skips the chance draw entirely (`table.length === 0` short-circuits line 55), which moves
      the room's stream and kills every encounter in that band altogether. The report says
      which reading shipped rather than hiding it.
      **Re-pins and tests.** The narrowed table changes which species a fixed seed rolls, so the
      expectations that read it are re-pinned and named file by file in the report:
      `src/engine/routes/encounters.test.ts` (the `RouteEncounters` sequence, 35-45 — the file
      Batch 4b's Task-36 already re-pins for its own reason, so this task re-pins it once more)
      and the new `encounterTableFor` cases. New fixed-seed regression, which AGENTS.md requires
      for anything touching the RNG or the generator: for a fixed seed a run with no catches
      rolls the **same** species sequence as before this change; a run that has caught a family
      never rolls that family — base form, every evolution and every forme — over a long walk;
      and the excluded run still spends exactly one draw per step.
      **Docs:** the wild-encounter table's own bullet in `docs/routes-spec.md` §3 (199-206,
      "The table is the route's band **BST pool** … weighted flat"), which names `D39` and
      stops there — one writer, and no batch from 5 to 16 holds that file any more.
      Decisions for the dev's spec, each with a recommended reading: **the record is written by
      a successful catch only** — a ball that fails, a run away and a lost battle add nothing,
      exactly as `stats.catches` counts them (`resolve.ts`, 92-101); **the starter is not a
      catch**, because `createRun` seeds the party directly (`state.ts`, 122-148) and
      `recordCatch` is the record's only writer, so the starter's own line stays in the pool
      (the open question below asks whether the human wants it excluded as well); **the rule
      binds the wild table only** — `speciesPool(band, 'trainer')` and every roster stay as they
      are, so a trainer may still field a line the player owns; and the dev-only
      `addDebugPokemon` / `startDebugWildBattle` paths (`RouteScene`) change nothing.
      Out of scope: the battle's own construction of a wild (its species is decided before
      `BattleScene` sees it), the room's capture window and the ball's odds, Task-48's
      first-catch override (a different rule on the same roll), the trainer roster pool and its
      bans, the starter pick's own offer, the dex's playable set, and `stats.catches` /
      `pcUnlocked` / `capturedRooms`, which this task reads and does not move.
      *Dependencies:* none — `evolutionFamily`, the `num`/`forme` fields and the run's save are
      all shipped. Batch order covers it: it needs `src/scenes/RouteScene.ts` and
      `src/engine/save.ts` at once, and `RouteScene` is held by every batch from 5 to 16 (5
      Task-16, 5b Task-45, 6 Task-41, 6b Task-38, 7 Task-31, 8 Task-08's every-scene sweep, 8b
      Task-35, 9 Task-39, 9b Task-40, 10 Task-26, 11 Task-29's ledger, 12 Task-30, 13 Task-44,
      14 Task-48, 15 Task-49, 16 Task-50) while `src/engine/save.ts` is held by 7, 8b, 10 and
      13 — so it opens the plan's new **Batch 17**. It also runs **after** Task-44 (Batch 13),
      whose RIP list holds the dead *members* and is a different fact from this record, and
      after Task-48 (Batch 14), which reads the same roll for a different rule.
      **`SAVE_VERSION`: 17 → 18**, the step after Task-44's 16 → 17, with the usual shape — an
      older run's record does not exist, so the step and the decoder add the empty list
      (`parseRun`, `src/engine/save.ts`, 574-657) — unless Task-48's open question is answered
      with its "first **attempt**" reading, which would take 17 → 18 in Batch 14 and push this
      step to 18 → 19. *(Batch 17)*

## Phase 3 — Battle engine core (pure, headless, tested)

> Completed work for this phase is archived in `CHANGELOG.md`.

The whole menu battle minus per-effect behaviour. Contract in
`docs/battle-spec.md`.

- [ ] **[Task-35] Enemy AI: the cartridge's AI scripts, expected value, and the
      difficulty knob.** The enemies think with one shallow scorer today: `chooseAiCommand`
      (`src/engine/battle/ai.ts`) takes `estimateDamage × accuracy`, adds 1000 when the hit
      would KO, 60 for a status that can land, 40 for a favourable boost, 50 for healing at
      low HP and 25 for a volatile, switches only when nothing it has can hurt the foe and a
      reserve can (`bestOffense`), spends its Mega at the first chance and breaks ties to the
      **lowest index with no Rng draw at all**. It is deterministic and hidden-information
      honest — it never reads the foe's unrevealed moves — and it is also blind to the
      situation: no item use, no predicted switch, no two-turn plan, no speed or hazard
      reasoning, and a wild fights exactly as well as an Ace. An archetype
      (`src/data/trainers.ts`) carries presentation, sprites, money and `carriesMega` and
      **no AI setting**, while a roster is the closed, known BST-pool list
      (`RosterOptions`, `speciesPool`, D39) and a wild's moveset and ability are rolled per
      run seed (D17) — so the game has both cases the request names: a side whose moves it
      can know and a side whose moves are random.
      **What to build it from**, best first:
      1. **The cartridges' own AI scripts (FRLG/Emerald), the recommendation.** Each move
         starts at 100 and each of the trainer's AI settings adds or subtracts points:
         *check bad move* (skip what fails or does nothing), *try to faint* (prefer the KO,
         on the game's own damage formula), *check viability* (heal at low HP, set up when
         safe, and the rest of the situation scores), *setup first turn*, *risky* (Explosion
         and friends), *prefer Baton Pass*; the **highest score wins and a tie is broken at
         random**; switching follows Emerald's rules (about to faint to Perish Song; the
         player's last move was Electric/Water/Fire and a bench absorbs it; no
         super-effective move and the bench has something the player cannot hurt) and a
         trapped Pokémon never switches; carried items are used **without randomness**
         (Full Restore and Potions below ¼ HP, cures on the matching status, X items on turn
         one); **wild Pokémon pick a random move that has PP left**; *Hard Mode* is nothing
         but "every trainer also gets check bad move, try to faint and check viability". The
         sources are `pret/pokefirered`'s AI script commands
         (`src/battle_ai_script_commands.c`) and the pkmn wiki's Battle AI page, which
         documents the settings, the switching rules, the item rules and Hard Mode.
         **Cost: low to moderate** — it is a closed list of checks over data we already
         have (`estimateDamage`, `canApplyStatus`, `legalMoveIndices`, `canMegaEvolve`), a
         flags field on the archetype, and one Rng-drawn tie-break; the port is faithful to
         the game this project is styling itself on (`D19`) and it makes the archetype the
         difficulty knob instead of a number.
      2. **A real one-ply expected-value layer.** Today's score is a damage estimate with no
         switch evaluation and no risk term. Expected damage over accuracy, crit and the
         85–100 roll, a status/boost value that accounts for the target's state, and a switch
         score that compares the bench's best offence against the active's — all data the
         engine already exposes. **Cost: low.** It is the *check viability* half of 1, and
         the two are the same code.
      3. **A bounded search over our own engine** — determinized minimax/expectimax or MCTS
         on cloned states, which is what the Showdown-lineage bots do (Showdown's own
         `battle-ai` search/eval module set is **not** in `smogon/pokemon-showdown`'s tree
         today, so read it from an archived copy before porting it; `pmariglia/foul-play`
         carries a heuristic eval plus `fp/search/` with an external engine bridge), and
         `pkmn/engine` exists exactly to make it fast (a battle simulator "optimized for
         performance", Zig with Node/WASM bindings). **Cost: high.** It needs a pure
         clone/rollout seam on `BattleState` (`takeTurn` mutates in place), a per-turn node
         or time budget, and its own determinism rule — every rollout seeded from a derived
         stream, never the battle's ambient draws.
      4. **Learned agents** (poke-env, Metagrok, AlphaMon, *Laplace* — determinized MCTS,
         2231 Elo in Gen 9 Random Battle — and the 2025 "Human-Level Competitive Pokémon via
         Scalable Offline RL" line): the strongest play by far and the wrong shape here —
         training infrastructure, model weights, no determinism story, and nothing a
         browser roguelike can ship in its bundle.
      **The run's shape, as recommended:** trainers think with the cartridge flag set
      (Youngster gets few, Ace/boss/mini-boss get all of them, and the carried items the
      engine already models are used by the cartridge's own rules), wilds keep the
      cartridge's random-with-PP policy at normal difficulty and may use the flagged scorer
      at the top one — a policy switch, not a second AI.
      **The difficulty parameter: yes, and discrete and visible rather than adaptive.** The
      cartridge ships one (Hard Mode above) and the roguelike canon prefers explicit tiers
      (Slay the Spire's Ascension, Hades' Heat, Isaac's unlock ladder), while the DDA
      literature is the argument against the hidden alternative: a rubber band that keeps
      every fight at the same perceived difficulty ruins pacing and reads as cheating in a
      game whose whole promise is that a loss is the player's. So one setting — a small
      `aiLevel`/`hardMode` — chooses the archetypes' default flag set, the wild
      policy and the tie-break's noise; the per-archetype flags stay data. It reaches
      `src/engine/save.ts` as a **settings** field (defaulted in `parseSettings`, so **no**
      `SAVE_VERSION` bump — the `Task-26` precedent), a row in `src/ui/settingsScreen.ts`
      drawn by `src/scenes/SettingsScene.ts`, and the launch: `RouteScene.startBattle` puts
      it on `BattleLaunch` and `BattleScene.submit`'s `chooseAiCommand(this.state, 'enemy')`
      reads it. This task owns all of those paths in its batch.
      **Determinism (D11):** the AI draws its tie-break from the **battle's own Rng**
      (`state.rng`), so the same seed replays the same battle; that draw moves the stream,
      which re-pins the fixed-seed expectations in `src/engine/battle/golden.test.ts` (and
      `ai.test.ts`, `mega.test.ts`) — Task-09 owns the golden log and extracts the reusable
      scripted-battle harness in Batch 6, so this task re-pins it after and runs its
      AI regressions on that harness.
      **Honesty:** keep the AI on information the player also has. A set-predicting AI needs
      a per-battle **revealed** record and `BattleState` tracks none today; adding one is
      allowed only if it stays honest.
      Needs a `D##` in `docs/tech-decisions.md` (the next free number when it runs; `D43` is
      Task-26's) and a section in `docs/battle-spec.md`. Fixed-seed tests for the flags, the
      scoring and the tie-break. Out of scope: doubles (the game has none), reading the
      foe's unrevealed set, and coaching or telegraphing the choice in the UI.
      *Dependencies:* Task-09 (Balance pass) — the reusable scripted-battle harness it
      extracts beside `src/engine/battle/golden.test.ts`, on which this task's fixed-seed AI
      regressions run. Batch order covers the rest: Mega Evolution is merged (D34),
      Gigantamax lands in Batch 7 and the item-driven retypes in Batch 8, so the AI weighs
      every option the rules have by the time it is written. *(Batch 8b)*
- [ ] **[Task-48] The run's first wild Pokémon is much easier to catch.** Reported in
      play: «el primer pokemon salvaje debe ser mucho mas facil de atrapar ignorar su
      dificultad segun el poke solo para esta primera captura» — for that first capture
      only, the species' own difficulty must not decide the throw.
      **Today the catch is species-based and nothing else.** `attemptCapture`
      (`src/engine/battle/capture.ts`, 28-44) reads the target's own rate,
      `catchRateOf(target.speciesId)` (`src/data/dex/species.ts`, 83 — PokeAPI's rate, the
      number the report wants ignored), and hands it to `catchValue` (13-20) with the
      ball bonus and the HP/status terms; a value of 255 or more succeeds outright (38),
      and a ball reaches it through `useBagItem`'s `case 'ball'`
      (`src/engine/battle/commands.ts`, 143-155, the `attemptCapture` call at 146).
      **The battle is pure and knows nothing about the run**, so a "first catch" flag
      cannot be read from a save inside the engine: `createBattle(setup)`
      (`src/engine/battle/state.ts`, 130) takes player/enemy/rng/isWild/bag/names only
      (`BattleSetup`, 120-128). The seam that already carries run facts into a battle is
      `BattleLaunch` (`src/engine/run/battleLink.ts`, 45-57): `canCapture` is set by
      `RouteScene.startBattle` (4901-4929, from `canCapture(this.run)` at 4911) and read
      by `BattleScene` at 1276 and 1368. **The fact itself already exists in the run and
      is already saved**: `RunStats.catches` (`src/engine/run/state.ts`, 25-33) counts
      successful captures, `recordCatch` (497-499) is the only thing that raises it and
      `resolveBattle` calls it exactly once per capture (`src/engine/run/resolve.ts`,
      93-101), and `src/engine/save.ts` writes and decodes `stats` (118, 404) — so
      `run.stats.catches === 0` is precisely "this run has not caught anything yet", with
      **no new run field and no `SAVE_VERSION` bump**.
      **Fix shape:** carry the fact from the launch into the roll. `BattleLaunch` gains
      `firstCatch: boolean`; `RouteScene.startBattle` sets it from
      `this.run.stats.catches === 0` beside `canCapture`; `BattleScene.create` passes it
      into `createBattle`; `BattleSetup`/`BattleState` carry it (`firstCatch: boolean`,
      defaulted `false` so every existing test and the pure engine stay unchanged); and
      the roll resolves the rate through it instead of always calling `catchRateOf` — the
      spec freezes whether that is a pure helper (`firstCatchRateOf` /
      `catchRateFor(speciesId, firstCatch)`) or an inline branch, but the
      rule lives in `src/engine/battle/capture.ts` either way, because that is where the
      roll is. The flag is read **off the state `attemptCapture` already receives**
      (`attemptCapture(state, targetSide, ballBonus, rng)`), so nothing in the ball branch
      of `src/engine/battle/commands.ts` (143-155) changes — the call site keeps passing a
      ball bonus and nothing else. With the flag set the effective rate is a **flat 255**,
      which ignores the species entirely and returns success outright at line 38, so the HP
      share, the ball and the status still pass through the same formula and simply cannot
      fail.
      Decisions for the dev's spec: the boost belongs to the run's first **successful**
      capture, so a throw that fails does not spend it and a party wipe does not either —
      that is what `stats.catches === 0` means, and it costs no new state, where the
      "first attempt only" reading needs a new persisted flag and a `SAVE_VERSION` step;
      and the override is a flat 255 rather than a multiplier or a merely generous fixed
      rate, because "ignore its species difficulty" is a species-independent rate and the
      cartridges guarantee their own first catch. Two consequences to record in the
      report: the dev wild battle (`startDebugWildBattle`, `RouteScene` 4935-4938) goes
      through the same launch and so gets the boost while the run has no catch, and once
      a capture lands (`stats.catches` 1) the very next wild is back to its species'
      rate.
      Tests: `src/engine/battle/capture.test.ts` — a fixed-seed regression that the same
      seed catches the first wild with a plain ball and does not catch an identical wild
      once the flag is off, plus the 255 early-return case; and the launch plumbing
      (`RouteScene` → `BattleScene`) is checked in the browser.
      Out of scope: the per-room capture window (`canCapture` / `useCapture` /
      `capturedRooms`, whose rule is unchanged), the ball items and their bonuses, the
      Gen 9 formula in `catchValue` itself, the capture's ball-shake presentation
      (`src/ui/capture.ts`), the ball row's visibility rules, and the deferred capture
      screen Task-31 deletes.
      *Dependencies:* none — everything it reads is shipped, and it adds no run field.
      Batch order covers it: it needs `src/scenes/RouteScene.ts` and
      `src/scenes/BattleScene.ts` together, and every batch from 7 to 13 holds one of them
      (7 Task-31/Task-18, 8 Task-08's every-scene sweep, 8b Task-35, 9 Task-39, 9b
      Task-40, 10 Task-26, 11 Task-29's ledger, 12 Task-30, 13 Task-44), so it opens
      **Batch 14**. It also runs after Task-31 (Batch 7), which settles the catch's
      placement and the single placement helper this rule must stay true through.
      *(Batch 14)*

## Phase 4 — Battle effects: abilities, items, weather, terrain

> Completed work for this phase is archived in `CHANGELOG.md`.

Ports of Showdown handlers, in batches, on the hook names in
`docs/showdown-reuse.md` §3.


## Phase 5 — Battle UI & presentation

> Completed work for this phase is archived in `CHANGELOG.md`.

- [ ] **[Task-34] The battle SWITCH grid: a sixth per row, a name that cannot stretch it,
      and arrows that move the cursor.** Reported in play, in the battle's SWITCH window.
      The builder is `renderPartyGrid` (`src/scenes/BattleScene.ts`) and the defect is its
      geometry. It lays the party out as `PARTY_COLS = 3` avatar cells and derives the cell
      height from the **member count**: `rows = Math.max(1, Math.ceil(count / PARTY_COLS))`,
      then `cellH = (bottom - top - (rows - 1) * MENU_GRID_GAP) / rows`. With one, two or
      three members `rows` is 1, so a single cell is the window's whole content height; the
      avatar, the label and the HP bar stay pinned at that box's top-left corner and the box
      grows around them, which is what "the cells must not grow their height" is about. The
      label is the second half: `openParty` builds one string for the cell (`name  LvN` plus
      the status abbreviation) and `renderPartyGrid` draws it with
      `setMaxWidth(cellW - avatarW - 22)`, so a long name **wraps** inside a cell that never
      accounted for a second line, while the HP bar is placed at a fixed `cellY + 30` under
      it and the label's own height is whatever the wrap made it. The third half is the
      cursor: `navigateMenu` sends every direction to `moveMenu(±1)` in `mode === 'party'` —
      linear previous/next — even though the cells sit in three columns, so `up`/`down`
      slides along the row and `left`/`right` skip the member that is actually beside the
      cursor.
      **Expected:** one row per member in a single column, each row exactly **1/6** of the
      window's content height (so a full party of six fills the panel and a party of two
      leaves the rest of the panel empty rather than two giant cells) — **confirmed by the
      human**, whose words for the bug are "with two Pokémon the two cells take the whole
      grid" — and the row's height
      **never** depends on what it draws: a name that overflows the row is clipped (an
      ellipsis is fine) and never wrapped or allowed to push the HP bar. The arrow keys move
      the selection **between party members** in the direction that matches that layout —
      `up`/`down` are previous/next, and `left`/`right` may do the same since a single column
      has no second axis — and the cursor still refuses to land on a fainted or already
      active member exactly as `moveMenu` does today. The ◀ back control, the per-cell HP
      bar (`PARTY_CELL_HPBAR_SCALE`, already scaled from the cell width so it never runs into
      a neighbour), `PARTY_AVATAR_SCALE` and the detail window `renderPartyDetail` keeps
      drawing above the grid all stay as they are. Six rows is `MAX_PARTY_SIZE`
      (`src/engine/run/state.ts`), not a new magic number; if the layout needs a pure helper
      (a row rect per index), it goes in `src/ui/` with a test, the way `moveGrid` and
      `mapView` do.
      Out of scope: the FIGHT/BAG/SWITCH/RUN command grid and the moves grid
      (`MENU_GRID_COLS`, `moveMenuGrid` — they are 2x2 and correct), the route HUD's
      party/PC list (`src/ui/partyScreen.ts`), and the detail window's own layout. Docs: none
      — the row geometry is presentation and changes no rule, and Task-17 holds
      `docs/battle-spec.md` in this batch.
      *Dependencies:* none. It reads the nicknames Task-13 (Batch 4) makes possible — a long
      name is what exposes the wrap — but needs nothing Task-13 produces. *(Batch 6)*
- [ ] **[Task-39] The ⓘ detail button is dead in two places.** Reported in play, in one
      breath: "al ponerse encima del boton i en moves no se abre modal solo al darle click
      y en los del learnset ninguna de las dos formas" — in the battle's **MOVES** window
      hovering the ⓘ floats nothing and only a **click** opens the popup, and in the
      **learnset band** the same ⓘ does nothing at all, hover or click. Two places, one
      button: the same `MoveGrid` cell, hit-tested two different ways.
      **The battle's half is a second classifier for one button.** `src/scenes/BattleScene.ts`
      wires one invisible `Zone` per move cell (`this.menuZones`, 584-597: `pointerover` →
      `onMenuHover`, `pointermove` → `onMenuPointerMove`, `pointerout` →
      `onMenuPointerOut`, `pointerdown` → `onMenuClick`) and classifies the ⓘ with its own
      copy of the grid's maths — `insideInfoButton(zone, localX, localY)` (2216-2221)
      against a cell-local rect stashed on the zone by `renderMoveMenu`
      (`zone.setData('infoRect', moveGrid.infoRect(i))`, 2019-2028). The **click** reaches
      `onInfoClick` (2202-2214 → 2267-2278, which pins the popup) and works; the **hover**
      goes through `onMenuPointerMove` → `onInfoHover`/`onInfoOut` (2223-2230, 2253-2265)
      and does not. What the code shows is that this is the tree's **only** hover driven by
      a sub-rect test inside `pointermove` on an already-over zone: every other hover —
      `partyAbilityZone` (715-716), the party grid's cells (`partyZones`, 572-579 →
      `onMenuHover`), `megaZone` (`onMegaHover`) and the capture screen's ability ⓘ
      (5256-5258) — rides `pointerover`/`pointerout` on a zone sized to
      the control itself, which cannot miss, and the route HUD's identical cell reaches the
      same button from the **live pointer** (`detailInfoAt`, 3441-3449 → `panelPoint` →
      `hudMoveGrid.cellRect(i)` + `hudMoveGrid.infoAt(i, x, y)`). It is also the **second**
      time this one button has been reported dead: `CHANGELOG.md` records the first
      (`MoveGrid.infoAt` compared a cell-local point against an absolute rect, so the HUD's
      ⓘ matched neither on hover nor on click; fixed in `src/ui/moveGrid.ts`).
      **The learnset's half was never wired at all.** `refreshLearnset` hard-codes
      `info: null` (2708), so the band's cells draw their ⓘ (`MoveGrid.layout` draws a
      button for every cell that exists) and can never float a popup; `detailInfoAt` asks
      only `this.hudMoveGrid` (3447), so the band is not hit-tested on hover; and
      `handleDetailPointerDown` tests `this.hudLearnGrid.indexAt(point)` **first**
      (3221-3226), so a press on a learned move's ⓘ picks that move up for a drag
      (`startLearnDrag`) and `toggleDetailInfo` is unreachable for the band. The band's
      cells already carry the popup's whole payload — `learnCell` fills
      `desc: move?.shortDesc`, type, category, power, accuracy and status (2651-2671) — so
      the ⓘ was meant to float, exactly as `docs/design-spec.md` §4 says a move cell's does
      ("floats the move's type, status and **description** over the field on **hover or
      click**"), and the report asks for both forms.
      **Fix shape:** one classifier for one button, on the pointer's own position. The ⓘ is
      hit-tested from the **live pointer** against `MoveGrid.cellRect(index)` +
      `MoveGrid.infoAt(index, localX, localY)` in both scenes — the route HUD's shape, which
      is already the one that works — or, if the dev keeps a zone, the ⓘ gets a zone of its
      **own** sized to the button (`ABILITY_INFO_SIZE`-style) so `pointerover`/`pointerout`
      drive it, like every other hover in the tree; what goes is the sub-rect test inside a
      per-cell `pointermove`. In `BattleScene` that deletes `insideInfoButton` and the
      `infoRect` stash — and `MoveGrid.infoRect`, whose only consumer that stash is, with
      them. In `RouteScene` the band gets its own info state: `hudDetailInfo`/
      `hudDetailInfoPinned` are **one** index shared by the two grids today (839-841) and
      must be tagged or split (`{ grid: 'moves' | 'learn'; index: number }`),
      `refreshLearnset` passes that index as `info`, a `detailLearnInfoAt` mirroring
      `detailInfoAt` answers the hover, and the press order flips so the ⓘ wins over the
      drag. Hover floats, a click pins, a press elsewhere / a tab switch / closing the panel
      / leaving the canvas drops it — the moves grid's own behaviour, now shared.
      **The task's first job is to reproduce and measure, not to guess.** The spec must
      carry the mechanism its dev measured on pristine `main` — whether `pointermove` never
      reaches the handler, or reaches it with a point that does not match the drawn button —
      and the report says which, because the fix above is the same either way but the
      regression is not: a hover that cannot be reproduced is not a fix. QA verifies
      against `npm run dev` with Playwright: with the pointer moved onto a battle move's ⓘ
      and left there **without a click**, the popup is visible; in the band a hover floats
      the move's description and a click pins it; and a press on the cell **beside** the ⓘ
      still picks that move up for a drag.
      Out of scope: the ability ⓘ (Task-12's — it works in all three of its homes), the
      STATS tab's name field and its evolution rows, `src/ui/infoPopup.ts` and the popup's
      own layout, the party grid's cell geometry (Task-34's, Batch 6) and every string
      (Task-26, Batch 10).
      *Dependencies:* none. It is written against Task-38's **scrolled** band — the ⓘ anchors
      to a visible pool row, not to a page index — but Task-38 lands in Batch 6b, three
      batches before this one, so the band is already a scroll window by the time this task
      reads it. *(Batch 9)*
- [ ] **[Task-40] A battle opens with an entry beat: one for a wild encounter, one for a
      trainer.** Reported in play as a wish rather than a defect — "parpadeos en negro o
      algo así" — for the original games' two encounter openings: the one when a wild
      Pokémon appears and the different one when a trainer spots you.
      **Today the hand-off is a single frame, and there is no transition of any kind.**
      `RouteScene.startBattle` (4901-4929) builds the `BattleLaunch`, `this.scene.pause()`s
      the route and `this.scene.launch('Battle', launch)`s the battle; `BattleScene.create`
      (390-441) hides the paused overworld outright (`this.scene.setVisible(false, 'Route')`,
      438), starts the battle music and goes straight into `startFeed()` (440), whose first
      frame is the engine's first log line. **The wild/trainer split the request asks for
      already exists at that seam and needs no engine work**: `BattleTrigger` is
      `{ kind: 'wild'; speciesId; level; shiny?; key }` or
      `{ kind: 'trainer'; trainerId; trainerName; roster; archetypeId }`
      (`src/engine/run/battleLink.ts`, built at 4905/4610), and `BattleScene` already
      branches on `trigger.kind` in `init` (364-375), in `create` (399-400) and for the
      trainer's battle sprite (422-425). What the tree offers to build on is small:
      `src/ui/beats.ts`, whose header says the timings live there "so the beats read as
      data" (`FAINT_DROP`/`FAINT_MS`, `SWITCH_SHRINK`/`SWITCH_RECALL_MS`/`SWITCH_SENDOUT_MS`),
      `src/ui/capture.ts` for a chained beat, and the one screen-level effect the battle
      already plays — `playMega`'s `this.cameras.main.flash(220, 255, 255, 255)` (921-929).
      Nothing in `src/render/` (`moveFx.ts`, `playerAnim.ts`, `trainerAnim.ts`) or
      `src/audio/` covers an opening.
      **Expected:** an entry beat in **two flavours**, chosen by `launch.trigger.kind` and
      played by `BattleScene.create` **before its first feed frame**, so the route→battle
      cut is a beat and not a jump: a wild opening and a trainer opening, each a short
      ordered list of steps (the black-out / fade as the stage replaces the route, the foe's
      appearing beat, and for a trainer the trainer's own entrance before the send-out),
      with the timings and the step order as **data** in `src/ui/beats.ts` beside the
      existing beats and a test over them, so the scene plays the beat and does not own it.
      The beat is **skippable** — any confirm/cancel press or a click fast-forwards to the
      first feed frame, so a replayed battle is never made slower — and it obeys Batch 8's
      **reduced-flash** preference instead of adding a knob of its own. The camera is the
      only thing that may flash, the beat allocates nothing per frame (the tween/camera
      shapes the two existing beats already use), and the battle's own menus stay down while
      it plays, as they already are in feed mode.
      **Files:** `src/scenes/BattleScene.ts` (the beat and its call in `create`),
      `src/scenes/RouteScene.ts` only if the hand-off itself needs a step (the pause and the
      launch stay where they are), `src/ui/beats.ts` + `beats.test.ts`, and one line in
      `docs/design-spec.md` §4, whose battle section is where a player's first sight of a
      battle belongs.
      Out of scope: **every sound** — the encounter cry and the send-out cue are Task-30's
      (Batch 12 owns `src/audio/cues.ts` and the two `scripts/frlg/` audio packers), and this
      task adds no cue id to `src/audio/cues.ts`; the battle→route return
      (`this.scene.setVisible(true, 'Route')` in the `shutdown` handler, 431-435, and
      `applyBattleResult`), which keeps its own end-of-battle beats; a second setting row
      (Batch 8's accessibility pass and Batch 8b's Task-35 own the settings); and the Mega
      Evolution flash, which is a battle beat already and stays one.
      *Dependencies:* Task-08 (Accessibility pass) — the reduced-flash preference it adds to
      `src/engine/save.ts` and its settings row is what a black-flash opening must obey, and
      it claims every `src/scenes/*.ts` in Batch 8, the batch before this one. If that task
      shipped no such preference, say so in the report rather than inventing a second knob.
      Batch order covers the rest: both scenes are free here and nowhere earlier, and this
      task runs before Batch 10's i18n sweep so its lines can be keyed with the rest.
      *(Batch 9b)*
- [ ] **[Task-53] The battle panel shows the Pokémon's types under its name.** Reported in
      play: «añadir tipos pokemon en panel de combate debajo del nombre» — the battle's HP/party
      panels should carry the active Pokémon's types under its name.
      **Today the field panels carry a name, a level, the HP bar and the status badge, and no
      type at all.** `drawSidePanel` (`src/scenes/BattleScene.ts`, 1604-1663) is the one builder
      for both sides — called by `refreshHud` at 1584-1585, which owns the two rects laid out at
      1523-1538 — and it writes the whole panel: the name and level at 1618, the HP/status row
      at 1623-1647 and the player's XP bar at 1649-1659. The band the name owns is
      `PANEL_NAME_H = 32` (89) with `PANEL_NAME_GAP = 26` (90) before the bar
      (`barY = nameY + PANEL_NAME_H + PANEL_NAME_GAP`, 1616); the panels are
      `FOE_PANEL = { w: 320, h: 114 }` (87) and `PLAYER_PANEL_W`/`PLAYER_PANEL_H = 320`/`148`
      (84-86), and the foe's panel is the tight one.
      **Every piece the row needs already exists.** The types are on the fighter the scene
      already displays: `displayActive[side].types` (the `BattleFighter` in
      `src/engine/battle/fighter.ts`, 184; declared 228, built 407-410, refreshed 881/905/927)
      — read from there
      and not from `getSpecies(...)`, because the form changes rewrite it
      (`changeBattleForm`, 440-452), so a Mega's or a G-Max forme's own types are what the panel
      shows. The art is Añil's badge atlas Task-15 repacked: `typeIconFrame` and
      `TYPE_ICON_TEXTURE_KEY` at 32x14 (`src/data/typeIcons.ts`, 13-23), loaded once at boot
      (`src/scenes/BootScene.ts`, 169-171), and every type the dex lists resolves there (Añil
      ships the Fairy badge, so the comment that says otherwise in `StarterScene` (287) is stale
      and Task-08 removes it in Batch 8). It is the same source the move cells already draw
      (`src/ui/moveGrid.ts`, 231-240) and the starter cards do (`StarterScene`, 285-317) — not
      the 64px Añil battle icons and not the overworld art Task-41 introduces. The fallback for
      a name the atlas lacks is a text chip, exactly as `MoveGrid`'s popup already draws it
      (`src/ui/moveGrid.ts`, 368-378, with `typeColor` from `src/ui/typeColors.ts`, 29-31), and
      the SWITCH window's own detail popup already draws type chips (built 642-657, filled
      1858-1868), so this row is a second reader of one pattern rather than a new one.
      **Fix shape:** one row inside `drawSidePanel`, built once with the panel and filled per
      side — one badge image per type (at most two) laid out under the name, falling back to the
      text chip when `typeIconFrame` returns null — and **no new module**: the images can be
      built in `buildScene` beside `nameText` (520-527) and hidden, positioned and framed in
      `drawSidePanel` the way `statusBadges` already is (533-536, 1623-1640), which keeps the
      diff in the one file the report names. If the row cannot fit without moving the bar, the
      panel's own height grows a few pixels and the field layout at 1523-1538 follows (same
      file, same task); the spec freezes which of the two absorbs it — the `PANEL_NAME_GAP` band
      or the panel height — with the compact phone layout at 1518-1530 checked either way.
      **One row per panel:** the two panels are one builder, so the foe's carries the foe's
      types too — that is the information the player chooses a move with; the open question
      below is only whether the human wants the player's panel alone.
      No `docs/` line: the battle panel's geometry is presentation and changes no rule (the
      precedent is Task-34, Batch 6), `docs/design-spec.md` §4 does not describe the HP panels
      at all today, and that file belongs to a batch-mate in this batch anyway.
      No engine rule, no RNG draw and no run field, so **no `SAVE_VERSION`** impact and no
      fixed-seed test; the row's text is the type names out of the data rather than a literal,
      so Batch 10's i18n sweep has nothing to key — but it lands **before** that sweep (and
      before Batch 8's accessibility pass, which audits every scene for colour-only
      information) on purpose.
      Out of scope: the route HUD's detail panel and the capture screen (they already draw their
      own type chips — `RouteScene` 2351-2358 and 5279-5283), the SWITCH cells themselves (the
      chips live in that window's detail popup), the starter cards' badges, the move cells' own
      type badge, the status badge, the ability ⓘ (Task-12's / Task-39's) and the entry beat
      (Task-40's).
      *Dependencies:* none — `displayActive`, the Añil badge atlas and the chip pattern are all
      shipped. Batch order covers it: its chrome is what Task-16 rewrote (Batch 5, which holds
      this scene and `src/ui/frlg.ts`, `FRLG_WINDOW_PADDING` included), and Batch 5b is the
      first batch after it whose three tasks — the route's grass animation, the score screen's
      destination and the evolution curve — leave `src/scenes/BattleScene.ts` entirely free.
      Every later batch that wants that scene does so for a different panel (Task-34's SWITCH
      grid, Task-39's ⓘ, Task-40's opening, Task-18's Gigantamax control, Task-08's
      accessibility sweep, Task-30's sounds), and none of them reworks `drawSidePanel`.
      *(Batch 5b)*
- [ ] **[Task-57] A trainer's remaining team sits under its HP panel as Poké Balls.** Reported in
      play: «los entrenadores debajo de su panel del pokemon que aparezcan dibujo de pokeballs
      segun la cantidad de pokes que le quedan» — in a trainer battle, **under the trainer's HP
      panel**, one Poké Ball drawing per Pokémon the trainer has left, the spent ones emptied or
      greyed as they faint, which is how the cartridges show the opponent's team.
      **Today the panel says nothing about the team behind the active Pokémon.** `drawSidePanel`
      (`src/scenes/BattleScene.ts`, 1604-1663) is the one builder for both sides — called by
      `refreshHud` at 1584-1585, which owns the two rects laid out at 1518-1544 — and it writes
      the name and level (1618), the HP/status row (1623-1647) and the player's XP bar (1649-1659)
      and then stops: the foe's box is `FOE_PANEL = { w: 320, h: 114 }` (87), placed at
      `{ x: 36, y: 28 }` on a wide screen and full width at `y: 16` on the compact phone layout
      (1523), and the space below it belongs to the battler sprite and its platform.
      **The bench the row counts is already in the scene.** `state.sides.enemy.party` is the whole
      enemy roster (`BattleSide.party`, `src/engine/battle/state.ts`, 53-56): built in `init`
      (364-375) from `trigger.roster` for a trainer, or as a single `'wild'` fighter for an
      encounter. A fainted fighter **stays in that array at `hp = 0`** — that is exactly what the
      engine reads for "can this side still fight" (`hasHealthy`, `state.ts` 217-219 —
      `party.some((fighter) => fighter.hp > 0)`) and what the AI's own tests set to force a
      replacement (`src/engine/battle/ai.test.ts`, 55-56) — so **what the report calls "how many
      are left" is `party.filter((fighter) => fighter.hp > 0).length`**: the roster minus the
      fainted, the active member included, because the row describes the whole team and not just
      its reserve. The row's **total** is `party.length`, i.e. the team the trainer brought, and
      `MAX_PARTY_SIZE = 6` (`src/engine/run/state.ts`, 17, already imported at `BattleScene` 28)
      is the bound on how many icons can ever exist. Nothing has to be added to the engine for any
      of this: the state and the launch are both in hand inside `drawSidePanel`.
      **A trainer whose roster is the one Pokémon on the field shows a single ball**, dimmed when
      it faints — the row describes the team, not the reserve, so there is no "no bench, no row"
      case; the only battle with **no row at all** is a **wild** one, because it has no trainer,
      and the fact that gates it is `state.isWild` (set in `create` from `trigger.kind === 'wild'`,
      395-399; the launch's `trigger.kind` says the same thing).
      **The art already ships.** The icon is the run's own Poke Ball frame in the packed Añil item
      atlas: `itemIconFrame('pokeball')` with `ITEM_ICON_TEXTURE_KEY` and `ITEM_ICON_SIZE = 24`
      (`src/data/itemIcons.ts`, 14-16 and 29-36) — the same frame the capture throw already draws
      (`BattleScene`, 953-957, its image built at 471) and the same atlas `BootScene` loads once
      (144). No new art, no packer and no `src/data/**` write. That sheet is Task-07's (Batch 3,
      shipped) and Task-22 **repacks** it with a machine icon in Batch 5, so this is a
      **coordinated read rather than a dependency**: the frame comes out of the manifest
      (`itemIconFrame`), so a repack that moves the frame indices cannot stale it, and Task-22 runs
      three batches before this one anyway. A spent ball has no art of its own in the atlas, so it
      is the same frame **emptied** — a dark tint and/or a reduced alpha, the way the cartridge's
      used ball reads.
      **Fix shape:** one row of at most `MAX_PARTY_SIZE` images, built once in `buildScene` beside
      the other panel chrome and positioned, framed, dimmed and hidden in `drawSidePanel` exactly
      the way `statusBadges` already is (built 533-536, drawn 1623-1640), so the whole diff stays
      in the one file the report names; only the foe's row is ever visible. It sits in the panel's
      own left padding (`FRLG_WINDOW_PADDING.x`, `src/ui/frlg.ts`, 34 — the constant Task-16
      settles in Batch 5) at the panel's foot, and the compact layout has to keep it clear of the
      battler: the sprite's own size cap is measured from the panel's floor (`foeInfo.y +
      foeInfo.h`, 1526-1528 and 1560-1569), so either the row takes a small band under the panel
      and that cap shrinks by it, or the row is drawn over the field with the sprite's top margin
      checked — the spec freezes which, with the desktop and the phone rects both verified. The row
      repaints with the panel, and `refreshHud` runs once per feed frame through `showFrame`
      (820-825), so a ball dims on the same repaint that empties the active member's HP bar
      (`applyEvents` sets `displayHp` to 0 on the faint event, 888-895, and `playFaint` sinks the
      sprite, 1090-1108).
      No engine rule, no RNG draw and no run field, so **no `SAVE_VERSION`** impact and no
      fixed-seed test; the row's own arithmetic is one `filter().length` over state the panel
      already reads, so **no `src/ui/**` module and no test file are owed** (the `Task-53`
      precedent), and it carries no text at all, so Batch 10's i18n sweep has nothing to key.
      **No `docs/` line:** the HP panels' geometry is presentation and changes no rule (the
      `Task-34` precedent), `docs/design-spec.md` §4 — the battle's own section — does not describe
      the HP panels at all today, and `docs/battle-spec.md` carries the battle's rules rather than
      its panels.
      Out of scope: the route HUD's party rows (they name the members already), the SWITCH window's
      own cells (`renderPartyGrid`) and its detail window, Task-53's types row inside the same
      panel, the capture beat's thrown ball (`BattleScene`, 950-990), the party-balls marker
      `src/ui/mapView.ts` draws on a map, and anything about the **player's** own team, which is
      one keypress away in SWITCH (the open question below asks whether the human wants it anyway).
      *Dependencies:* none — the enemy bench (`BattleSide.party`, with the `hp = 0` faint), the
      `isWild` gate and the ball frame are all shipped, and the two questions below are calls, not
      edges. Batch order covers it: `Task-16` (Batch 5) re-chromed this scene and set
      `FRLG_WINDOW_PADDING`, `Task-53` takes the scene in Batch 5b and `Task-34` in Batch 6 — so
      **Batch 6b** is the first batch after the chrome whose one free `BattleScene.ts` slot exists,
      its batch-mate `Task-38` claiming `src/scenes/RouteScene.ts`, `src/ui/scroll.ts`,
      `src/ui/README.md` and the two doc files instead. It lands **before** Batch 8's accessibility
      audit and Batch 10's i18n sweep on purpose, like Task-53: a dimmed ball is colour-only
      information a contrast pass has to see, and the sweeps are cheaper against a row that exists.
      *(Batch 6b)*
- [ ] **[Task-59] Each of the battle SWITCH window's move rows gets the HUD's ⓘ, on hover and
      on click.** Reported in play: «en combate panel de info en switch los moves deberian tener
      boton i que abre panel con info ataque al pulsar o ponsrse encima como el del hud» — in a
      battle, the SWITCH window's own info panel lists the member's moves with no control that
      explains them, while the route HUD's detail panel has floated a move's description from an
      ⓘ since Phase 6. It is a **sibling** of `[Task-39]` (Batch 9), not the same task: that one
      fixes the ⓘ **classifier** on cells that already exist, and this one adds rows to a window
      that has none — but the two want the same two files (`src/scenes/BattleScene.ts` and
      `src/ui/moveGrid.ts`), so a batch can hold only one of them.
      **Today the switch detail window draws the moves as plain rows, and its one ⓘ is the
      ability's.** `buildPartyDetail` (`src/scenes/BattleScene.ts`, 624-719) builds the window
      once — the name and the level (634-639), the two type chips (642-657), the HP line (660),
      the five stat rows (663-670), nature / ability / held (671-676) and a 2x2 of four move
      cells (`partyDetailMoves`, 678-698: a bare rectangle, a name and a `PP n/m` line) — and
      `renderPartyDetail` (1886-1901) fills them from `MemberDetail.moves`. That list is already
      the popup's whole payload: `MoveDetail` (`src/ui/partyDetail.ts`, 28-44) carries `moveId`,
      `name`, `type`, `category`, `pp`, `maxPp`, `desc`, `power`, `basePower`, `accuracy`,
      `baseAccuracy` and `status`, and `fighterDetail` (168-193) with `moveDetails` (112-137)
      builds it for a live battle fighter — so the scene reads the dex nowhere.
      **The ⓘ the window does have is hover-only on purpose.** `renderPartyAbilityInfo`
      (1924-1934) places `AbilityInfoButton` (`src/ui/abilityInfo.ts`, 41-116) from the ability
      text's own width (`abilityInfoSpot`, 27-34) and floats `abilityInfoContent` (37-39) in the
      shared `InfoPopup`; the zone it rides registers **only** `pointerover` / `pointerout`
      (713-717), and the comment says why — the party cells under the window own the presses, so
      "a press must not change the member the window describes" — which is exactly the rule
      `docs/design-spec.md` §4 states in words (186-193: "In the switch window the ⓘ is **hover
      only**, so a press there still selects the member under it").
      **What the HUD does, and what is reusable.** The route HUD floats on hover
      (`updateDetailInfo`, `RouteScene` 3309-3316), pins on a click (`toggleDetailInfo`,
      3318-3328), drops the popup on a press elsewhere or a panel change (`resetDetailInfo`,
      3358+), and is hit-tested from the live pointer against `MoveGrid.cellRect(index)` plus
      `MoveGrid.infoAt(index, …)` (`detailInfoAt`, 3441-3449). The content it floats is the shared
      builder in `MoveGrid.drawPopup` (`src/ui/moveGrid.ts`, 356-393) — the type badge, the
      status badge and the description, through `InfoPopup` (`src/ui/infoPopup.ts`, 23-28) — and
      that private method is what this task lifts into one **exported pure helper**
      (`MoveGridCell` and `MoveGridOptions` are exported already), so the grid and the switch
      window's rows can never drift.
      **Fix shape:** four ⓘs, one per move row, on the seam that already works. Each row gets an
      `AbilityInfoButton`-shaped control (the same 22x22 `ABILITY_INFO_SIZE` button,
      `src/ui/abilityInfo.ts` 14) beside its `PP` line, its content built by the exported helper,
      and **a zone of its own sized to the button** — the tree's only hover that cannot miss
      (`partyAbilityZone`, 713-717, and Task-39's own recommendation for the battle's MOVES
      window) — which drives `pointerover` / `pointerout` **and** a `pointerdown` that pins, since
      the press is the report's ask and the one thing the ability ⓘ does not do. A press anywhere
      else on the window keeps its current meaning. The dev's spec freezes the row and button
      geometry and whether the popup rides above or below its row through `InfoPopup`'s
      `above`/`below` pair, and it must **not** reintroduce a sub-rect classifier: the
      `insideInfoButton`-style test Task-39 deletes from the MOVES window (2216-2221) stays
      deleted.
      Out of scope: `[Task-39]`'s own two sites (Batch 9 — this task is written against its
      shipped state), the ability row's ⓘ and its hover-only rule, the capture screen's ability
      ⓘ, the route HUD's detail panel and its band, the avatar grid's cell geometry
      (`[Task-34]`, Batch 6) and its ball row (`[Task-57]`, Batch 6b), move reordering (the
      battle has no drag), `src/ui/infoPopup.ts`'s own layout, the move cells' own numbers, and
      every string — the popup carries the move's own text through the existing, already-keyed
      fallback, so **no i18n key** is owed and the key table Task-49 and Task-50 hold in the two
      batches after this one is nobody's here.
      *Dependencies:* none. Batch order covers it: it is written against `[Task-39]`'s shipped ⓘ
      classifier (Batch 9) and reuses the content builder that batch leaves in
      `src/ui/moveGrid.ts`; it needs `src/scenes/BattleScene.ts` (Task-39's in 9, Task-40's in 9b,
      Task-26's in 10, Task-30's in 12), `src/ui/moveGrid.ts` (Task-55's in 18) and
      `docs/design-spec.md` §4 free at once, and the first batch after Batch 9 that leaves all
      three is **Batch 13** — whose Task-44 wants `src/scenes/RouteScene.ts`, the save and the
      party panel instead, so the two share no path and the batch stays an antichain. It adds no
      run field and changes no rule, so **no `SAVE_VERSION`** step. *(Batch 13)*
- [ ] **[Task-60] A battle ⓘ opens a window with the battle's own state: the weather, the
      terrain, each side's screens and the active Pokémon's stat stages.** Reported in play:
      «añade tarea añadir un boton info en el combate que abre un panel de informacion con info
      del estado del combate como climas, los cambios de estadisticas en pokemons activos,
      terrenos, cosas como reflejo, pantalla luz y otros ataques que causan contextos» — one
      control that answers "what is going on right now" without opening the log.
      **Nothing in the battle draws any of it today, and the engine carries all of it.** A search
      for weather, terrain or `sideConditions` in `src/scenes/BattleScene.ts` finds nothing:
      `drawSidePanel` (1604-1663) draws the name, the HP bar, the status badge and the player's XP
      row, and the command window is the 2x2 of `MENU_ROWS = 4` (80) that `openMenu` fills
      (1204-1218) and `renderCommandMenu` lays out (1670-1728). The state behind the request:
      - **Weather and terrain:** `BattleState.weather: WeatherId | null` with `weatherTurns`, and
        `terrain: TerrainId | null` with `terrainTurns` (`src/engine/battle/state.ts`, 97-100; the
        two unions at 10-11 — `'sun' | 'rain' | 'sand' | 'snow'` and
        `'electric' | 'grassy' | 'misty' | 'psychic'`), set by the ported moves and abilities and
        already read by the damage model (`damage.ts`, 51-83).
      - **Reflect, Light Screen and the rest of the "contexts":** the seven per-side
        `SideConditions` (`state.ts`, 14-15, 21, 24-34) held per side
        (`BattleSide.sideConditions`, 65) — `reflect`, `lightscreen`, `auroraveil`, `tailwind`,
        `luckychant`, `mist`, `safeguard`, each a turn count — folded into the damage roll
        (`damage.ts`, 135-136) and into Speed (`src/engine/battle/modifiers.ts`, 13); plus the
        seven whole-field `FieldConditions` (`state.ts`, 18-19, 22, 36-46, 102) — `trickroom`,
        `gravity`, `magicroom`, `wonderroom`, `fairylock`, `mudsport`, `watersport`.
      - **The active Pokémon's stat changes:** `BattleFighter.boosts: Boosts` (`fighter.ts`, 194;
        `BoostId` at 20 is `atk`, `def`, `spa`, `spd`, `spe`, `accuracy`, `evasion`; `Boosts` at
        32, `emptyBoosts` 220-222), read per side off that side's active fighter.
      - **What the engine does not model, and the panel must not pretend to:** the entry hazards —
        Stealth Rock, Spikes, Toxic Spikes, Sticky Web — are absent from the whole engine, and
        `src/engine/battle/effects/moves.ts` line 594 says so ("the entry hazards it would clear
        are not modelled"). Everything else the report names exists in the tree.
      **Fix shape:** one control, one window and one pure model. The control is a fifth one
      reserved at the right edge of the command window — the column `MOVE_MEGA_COL` already
      reserves in the moves menu (108) — so the FIGHT / BAG / SWITCH / RUN 2x2 keeps its geometry;
      it opens the window as a `mode` of its own (like `'party'`), which never spends a turn and
      closes on any confirm/back press or a click. The window is `addFrlgWindow`, and its content
      comes from **one new pure module**, `src/ui/battleInfo.ts`: a computing-half view model
      whose `battleInfoRows(state)` returns a readonly list of grouped rows — the weather and its
      count, the terrain and its count, the field's live conditions, each side's live conditions
      and each side's active stat stages — plus the explicit "nothing is up" case, with its
      co-located test, so every row is asserted headless and the scene only draws. It reads
      `BattleState` and nothing else: no Phaser, no RNG draw (D11) and no engine change.
      Files: `src/scenes/BattleScene.ts` (the control, the mode and the window),
      `src/ui/battleInfo.ts` + `battleInfo.test.ts`, the `src/ui/README.md` role line (the
      folder's per-file convention), `docs/design-spec.md` §4 (the battle's own section, whose
      window list names every window a battle draws), and the i18n key table plus both locales
      (`src/i18n/**`, whose exact files are read from what Task-26 ships) — every label the
      window shows is a new player-facing literal created **after** the sweep, which is the
      Task-49 / Task-50 precedent and the reason this task takes the first batch after 13 whose
      i18n files are free.
      Out of scope: the engine's conditions themselves (`src/engine/battle/**` does not move, and
      the hazards it does not model are not invented here), the HP panels (`[Task-53]`'s types
      row, `[Task-57]`'s ball row), the move and ability ⓘs (`[Task-39]`'s and `[Task-59]`'s), the
      message box, the feed and the log, the capture screen, a weather or terrain **sprite** on
      the field, and `docs/battle-spec.md` — no rule changes and the window's geometry is
      presentation (the `[Task-34]`, `[Task-53]` and `[Task-57]` precedent).
      *Dependencies:* none — every field it reads is shipped and the scene already holds
      `this.state`; the two questions below are calls, not edges. Batch order covers it:
      `src/scenes/BattleScene.ts` is free in 13, 15, 16, 17 and 19 (Task-39's in 9, Task-40's in
      9b, Task-26's in 10, Task-30's in 12, Task-48's in 14), and it takes **Batch 17** because
      that is the first of them whose i18n key table is free as well (Task-49 holds it in 15 and
      Task-50 in 16) — Batch 13's free `BattleScene.ts` slot is `[Task-59]`'s. It is the batch's
      second member beside Task-52, which claims none of its paths, and it is written with
      `[Task-53]`'s row and `[Task-57]`'s row already inside the panels it draws over. It adds no
      run field, so **no `SAVE_VERSION`** step — the chain stays 14 → 15 (Task-13) → 16
      (Task-31) → 17 (Task-44) → 18 (Task-52). *(Batch 17)*

## Phase 6 — Run structure, party & economy

> Completed work for this phase is archived in `CHANGELOG.md`.

- [ ] **[Task-31] A full party sends the catch to the PC, swappable only on that
      route.** Catching a wild Pokémon with the party full today **defers** the
      placement and opens a full-screen modal: `RouteScene.applyBattleResult` calls
      `resolveBattle` with `placeCapture: false`, reads the deferred
      `BattleResolution.captured` and hands it to `openCapturePrompt`
      (`captureDetailChildren`, `refreshCapture`, `handleCaptureAction`,
      `chooseCaptureSwap`, `chooseCapturePc`, `closeCapturePrompt`, the `CAPTURE_*`
      constants and the `captureRoot` input guards, all in
      `src/scenes/RouteScene.ts`), which offers "swap it in" or "send it to the PC".
      Delete that whole path and the seam that exists only to feed it: `placeCapture`
      and `captured` in `src/engine/run/resolve.ts`, the `askCapture` branch in
      `applyBattleResult`, and `swapCaughtIntoParty` in `src/engine/run/state.ts`. A
      catch is then placed by `resolveBattle` itself, the classic way — into the
      party while it has room, into the PC box when it is full (`addPokemon` /
      `MAX_PARTY_SIZE`) — with `addCaughtPokemon` as the single placement helper
      every catch goes through.
      **The new rule:** the swap window is no longer the whole floor. A catch that
      went to the box is swappable only **while the run is still in the room it was
      caught in**; the first exit closes it, a door (`advanceRoute`) and the portal
      (`advanceMap`) alike. So the floor-scoped `pcUnlocked` becomes a route-scoped
      `pcCatch: { roomInMap: number; memberId: string } | null`, set by the placement
      when the catch landed in the box and cleared by both advances; `pcMemberEditable`
      reads it beside `pcFullyEditable`, so the HUD's box cells — whose lock veil
      `src/scenes/RouteScene.ts` already draws from it — lock the catch the moment
      the player walks out. Nothing new to build: the party/PC panel already performs
      the swap (`canGrab` / `canSwapAcross` → `swapAcross`, `swapPartyBox`,
      `withdrawToParty`, `depositToBox`, `BOX_PAGE_SIZE` in `src/ui/partyScreen.ts`).
      **The popup** replaces the modal with a temporary notice at the **top of the
      screen**, in English (D12): "Your party is full — <name> went to the PC. You
      can swap it in before you leave this route." It is raised when the catch is
      placed (inside `playReleaseBeats`' callback, so a permadeath overlay and the
      notice never share the screen), drawn by the pinned HUD camera on the
      `learnPopup` / release-overlay seam, and **auto-dismissed**: it takes no key,
      blocks no movement and carries no stats, because the detail panel and the PC box
      panel already show the Pokémon. Its copy and its hold time live in one pure
      helper, `src/ui/notice.ts`, with a test — one string for Task-26 to key.
      **Save and state:** the run gains a field, so this task bumps `SAVE_VERSION` and
      adds its step to `SAVE_MIGRATIONS` the way Task-13 does it: an old run's
      floor-scoped `pcUnlocked` cannot be re-scoped, so the step drops it and the
      decoder defaults `pcCatch` to `null`, leaving the party, the box and every other
      field untouched. Tests: `src/engine/run/state.test.ts` (a full party lands the
      catch in the box, it is editable there, and `advanceRoute` / `advanceMap` close
      the window), `src/engine/run/resolve.test.ts` (the `placeCapture` cases fall
      away with the option), `src/engine/save.test.ts` (the migration round-trip) and
      `src/ui/notice.test.ts`. Docs: the capture bullet in `docs/routes-spec.md` §3
      and the PC windows in §6.
      **`[Task-27]` is absorbed here** and retired: its repro — catch with a full
      party, take both choices, watch the party, the PC box and the HUD — must be
      re-run and reported gone, because with one placement path and no second copy of
      the catch there is nothing left to stack.
      **The live diagnosis, recorded here because Task-27's ID points at it:** the stacking
      was never the placement seam. Every wild fighter is built with a **constant** id
      (`createFighter({ id: 'wild' })`, `src/scenes/BattleScene.ts:368`), the encounter key
      behind it (`grass:x,y`, `src/scenes/RouteScene.ts:4183`) is not unique per run, and
      `memberById` (`src/ui/partyDetail.ts:106`) resolves a member by **first match** — so
      the party row drew correctly while its detail panel showed an earlier catch. That is
      `[Task-33]` (Batch 3b), which lands **before** this task and mints a unique id at the
      fold; this task's replay must therefore re-run the repro with `[Task-33]` merged and
      report the panel showing the clicked member, then re-check it again after the deferred
      placement path is deleted — the id mint is upstream of the placement, so it survives
      the removal of `placeCapture` unchanged, and `pcCatch.memberId` is free to hold the id
      `[Task-33]` mints.
      Out of scope: the party/PC panel's own UI and page size, the battle's ball-shake
      presentation (`src/ui/capture.ts` is the battle's, not this modal's — leave it
      alone), the entry room's free PC window (`pcFullyEditable` / `entryDeparted`),
      and localising the notice (Task-26, Batch 10).
      *Dependencies:* none — it needs nothing another open task produces. Batch order
      covers three facts: Task-13 (Batch 4) takes the next `SAVE_VERSION` (15) first, so
      this migration is the step after it (15 → 16 as the plan stands); Task-33 (Batch 3b)
      lands even earlier and mints the unique member id at the fold this task keeps, so
      `pcCatch.memberId` and the `[Task-27]` replay below both build on it; and it
      **supersedes the capture-screen half of Task-12** (Batch 3): the ability ⓘ
      Task-12 adds to the route HUD's detail panel and to the battle's SWITCH window
      stays, while the one it adds to the capture screen is deleted here with the
      modal it lives on, so this task's diff removes a Batch-3 feature on purpose.
      *(Batch 7)*
- [ ] **[Task-44] The PC box gains a fixed RIP tab, listing the dead.** Reported in play:
      "en pc un tab fijo de rip donde aparecen los pokes muertos sin poder meterlos en el
      party ni dejar pokes en rip" — a fixed RIP tab in the PC, showing the dead, with the
      dead unable to move into the party and a living member unable to be deposited into RIP.
      **Today a fallen Pokémon is deleted, not stored.** `releaseFainted`
      (`src/engine/run/perms.ts`, 17-29) filters every 0-HP member out of `party` and `box`,
      keeps them in the return value as `released` for the scene's overlay, and only bumps
      `stats.casualties`; `RunState` (`src/engine/run/state.ts`, 47-109) has **no field that
      remembers them**, and the end-of-run screen reports a count only
      (`src/ui/runSummary.ts`, `Pokémon lost: <n>`). The panel itself is a two-pane model:
      `PaneId = 'party' | 'box'` (`src/ui/partyScreen.ts`, 23) with `partyRows`/`boxRows`,
      `partyInput`'s grab/move/`canGrab`/`canSwapAcross`/`swapAcross` reducer, `windowStart`
      and the `BOX_COLS x BOX_ROWS` page maths (`BOX_PAGE_SIZE`, `boxCellIndex`); `RouteScene`
      draws those panes as cells (`hudBoxCells`, `pointerInBoxPanel`, `stepBoxPage`, the
      `'wheel'` handler at 1294-1301) and the box's tabs are **page numbers**
      (`hudBoxTabs`, `HUD_BOX_MAX_PAGES`, built at 1621-1635), not modes. So there is nothing
      to draw a dead Pokémon from and nowhere for the tab to live.
      **Fix shape:** remember them, then show them read-only. `RunState` gains a list of the
      fallen (a `rip` / `graveyard` field, in party-then-box order — the exact name is frozen
      in the spec), appended by `releaseFainted` in the same place casualties are counted, so
      the count and the list can never disagree. `PaneId` gains a third value (`'rip'`),
      `src/ui/partyScreen.ts` gains `ripRows(run)` and the reducer's rules — `left`/`right`
      cycle **three** panes, `canGrab` is false in RIP, `canSwapAcross` refuses a target of
      RIP (so nothing can be deposited **into** the dead list and nothing dead can be pulled
      out into the party), and a reorder inside RIP is a no-op — and `RouteScene` draws the
      RIP tab as a **fixed control beside the page tabs**, with the same lock styling the
      locked box cells already use, plus a read-only detail (the dead keep their stats; the
      STATS controls that mutate are hidden).
      Tests: `src/engine/run/perms.test.ts` / `state.test.ts` (a fainted member is recorded
      once, in party-then-box order, and the healthy are untouched),
      `src/ui/partyScreen.test.ts` (a grab in RIP is refused, a deposit into RIP is refused,
      the pane cycle is three-wide), `src/engine/save.test.ts` (the migration round-trip).
      **Save:** a new run field means this task **bumps `SAVE_VERSION` and adds its step to
      `SAVE_MIGRATIONS`**: **16 → 17**, the step immediately after Task-31's 15 → 16, whose
      `pcCatch` this step leaves alone; an older run's dead were never stored, so the step
      only defaults the list to empty, the way Task-13's did for its own field.
      **Docs:** the PC windows in `docs/routes-spec.md` §6 — one writer.
      Decisions for the dev's spec: the tab is a **third pane of the very panel the party and
      the box already share** (the human says "en pc un tab fijo"), not a modal on top of it;
      and the dead are **read-only everywhere** — no reorder, no item move, no revive (D5).
      Out of scope: reviving or healing the dead (permanent, D5), the run summary's own
      numbers (`src/ui/runSummary.ts` keeps counting casualties), the end-of-run screen,
      Task-31's route-scoped `pcCatch` rule for a *living* catch, and the panel's page size.
      *Dependencies:* Task-31 (A full party sends the catch to the PC, swappable only on that
      route) — it rewrites the same seam (the single placement helper, the route-scoped
      `pcCatch`, the party/PC panel and its tests) and takes `SAVE_VERSION` 15 → 16
      immediately before this task's 16 → 17 step, so this task is written against its
      shipped state. Batch order covers the rest: every batch that reclaims
      `src/scenes/RouteScene.ts` (Batch 8, 8b, 9, 9b, 10, 12) or `src/engine/save.ts`
      (8b, 10) does so before Batch 13. *(Batch 13)*
- [ ] **[Task-49] Obtaining an item raises a temporary popup.** Reported in play:
      «popup temporal cuando se obtiene un objeto» — the same shape as the notice Task-31
      adds: at the top of the screen, auto-dismissed, no key to press.
      **Today every pickup is silent, and two of the three paths say nothing at all.**
      The ground item is `collectItemAt` (`src/scenes/RouteScene.ts`, 4657-4675): it folds
      `markItemPicked(addItem(this.run, item.itemId), item.id)`, saves, hides the sprite and
      repaints the HUD, with no message of any kind. The mini-boss reward is
      `chooseMiniBossReward` (5836-5846): `addItem`, save, repaint, and the picker window
      that offered the choice closes behind it, so the name of what was taken goes with it.
      The Mart is `activateShop` (5681-5706 → `buyItem`, `src/ui/shop.ts`, 62-65), and it is
      the one path that speaks: it prints "Bought <name> for ¥<n>." into the Mart's own
      message line (5694). A fourth caller, the dev-only `addDebugItem` (4970-4976), is a
      dev tool and out of scope. Nothing in the tree draws a transient pickup message
      today, and **`src/ui/notice.ts` does not exist yet**: Task-31 creates it in Batch 7 as
      "one pure helper" holding the PC-catch notice's copy and its hold time, drawn by the
      pinned HUD camera on the `learnPopup` / release-overlay seam and auto-dismissed
      without taking a key — `buildLearnPopup` (4694-4718) is the container shape it
      reuses (a container at a fixed depth, `this.cameras.main.ignore(...)` at 4717, shown
      and hidden by a boolean rather than a modal input mode).
      **Expected:** an item landing in the bag raises that notice at the top of the screen
      with the item's name, holds for the module's own hold time and disappears on its own
      — it takes no key, blocks no movement, pauses nothing and carries no stats, exactly
      as Task-31's catch notice does. Two pickups in a row replace each other rather than
      stacking.
      **Fix shape:** one notice, one seam, no second window. `src/ui/notice.ts` gains the
      pickup notice beside Task-31's catch notice — the same hold time and the same
      builder shape (the spec freezes the exact exported names against the shipped file,
      since Task-31's module exists by then) — and `RouteScene` raises it at the moment the
      item lands: in `collectItemAt` (before the sprite is hidden, so the pickup and the
      message are one beat) and in `chooseMiniBossReward` (before the picker closes). The
      scene keeps one container built next to the learn popup and one "visible until" time;
      no new input mode and no key handler is added, because the notice is not a modal.
      Out of scope: the pickup rules themselves (`addItem`, `markItemPicked`, the ground
      item's own placement), the bag and its pockets, the Mart's rows, prices and its own
      "Bought …" line, the TM-learning flow, `addDebugItem`, the battle's item use, and
      Task-31's catch notice and its PC rule — this task adds a second notice, it does not
      redesign the first.
      Decisions for the dev's spec: the popup fires on the two pickups that are otherwise
      **silent** — the ground item and the mini-boss reward — while the Mart keeps its own
      in-window line, because a transient popup over a window that already says what it
      sold is noise; and the string names the item only (`Obtained <name>!`), since every
      path but the Mart grants one unit.
      **i18n, because this task lands after the sweep:** Task-26 (Batch 10) moves every
      literal behind a key four batches earlier, so this string is created *after* it and
      must be added through the shipped i18n module with its key in **both** locales and
      the parity test green — the one report of the three that has to write a key by hand.
      Tests: `src/ui/notice.test.ts` (the pickup builder's text and the shared hold time,
      beside Task-31's cases), the i18n parity test over the new key, and QA checks the
      corner of the screen in `npm run dev`: taking a ground item and picking a mini-boss
      reward each raise and self-dismiss the popup, and walking while it is up is
      unaffected.
      *Dependencies:* Task-31 (A full party sends the catch to the PC, swappable only on
      that route) — this task **extends** the `src/ui/notice.ts` helper and the HUD notice
      seam Task-31 creates in Batch 7, rather than inventing a second transient window, and
      it is written against that shipped state. Batch order covers the scene:
      `src/scenes/RouteScene.ts` is held by every batch from 7 to 13 and then by Batch 14's
      Task-48, so this is **Batch 15**, the plan's tail. It is after Batch 10 on purpose so
      its string goes through the shipped i18n module instead of beside it, and after
      Batch 11 so it edits reformat-cleared files and keeps them conforming. *(Batch 15)*

- [ ] **[Task-50] A level-up raises a temporary popup.** Reported in play: «popup temporal
      subida de nivel» — a temporary popup when a Pokémon levels up, the same shape as the
      catch notice Task-31 adds and the item pickup popup `[Task-49]` rather than the modal
      the route HUD opens today.
      **Today the level-up beat says nothing unless a move was learned.** `playLevelUp`
      (`src/scenes/RouteScene.ts`, 5936-5963) tweens the squad's shared level counter in the
      party header and, when it lands, calls `showLearnPopup(beats)` (5960). That popup is
      the modal built once by `buildLearnPopup` (4694-4718): a full-screen scrim, a centred
      window titled `LEVEL UP`, a body of one `X learned Y!` line per crossed move and a
      `press any key` hint, with a full-screen `zone` whose `pointerdown` calls
      `dismissLearnPopup` (4710-4712; the 250 ms guard at 4759 keeps the click that raised it
      from closing it). `showLearnPopup` (4721-4738) builds its lines only from
      `beat.learned` and returns with the window hidden when **no** member crossed a move
      (`if (lines.length === 0) return;`, 4732) — so a level that learns nothing is silent on
      the route and the only feedback is the counter tween. (`showEvoPopup`, 4744-4751,
      reuses the same window for a click-evolution.) The data the notice needs is already in
      hand: `LevelUpBeat` (`src/ui/beats.ts`, 19-28) carries `id`, `fromLevel`, `toLevel`,
      `evolvedInto`, `learned` and `forgotten`, and `levelUpBeats` (36-57) already reports
      one beat per member that levelled.
      **`src/ui/notice.ts` does not exist yet.** Task-31 (Batch 7) creates it as "one pure
      helper" holding the PC-catch notice's copy and its hold time, drawn at the top of the
      screen by the pinned HUD camera on the `learnPopup` / release-overlay seam and
      auto-dismissed with no key, and Task-49 (Batch 15) extends it with the item pickup
      notice.
      **Expected:** every level-up raises a **temporary** popup at the top of the screen,
      holding for the module's own hold time and disappearing on its own — no key, no
      movement block, no pause and no stats, exactly as Task-31's catch notice and Task-49's
      pickup notice do. It names the member (its nickname when it has one, else the species
      name, the same read the modal already makes at 4725-4727) and the level it reached
      (e.g. `Growlithe grew to Lv 21!`). When several members level in one battle the beats
      raise in order, and two beats replace each other rather than stacking.
      **Fix shape:** one more notice in the module, one more call in the beat.
      `src/ui/notice.ts` gains the level-up notice beside Task-31's catch notice and
      Task-49's pickup notice — the same hold time and the same builder shape, one module
      and N strings (the spec freezes the exact exported name and the string against the
      shipped file, since both earlier notices exist by the time this lands) — and
      `RouteScene` raises it from `playLevelUp`'s `onComplete` (5956-5961) for every beat,
      before `refreshHud` resyncs the rows. The scene keeps one container built next to the
      learn popup and one "visible until" time; no new input mode and no key handler is
      added, because the notice is not a modal.
      **Decision for the dev's spec:** the transient notice fires on **every** level-up beat,
      whether or not a move was learned, while the **existing** modal
      (`buildLearnPopup`/`showLearnPopup`, the key-dismissed `LEVEL UP` window with the move
      lines) **stays** for the learned-move announcement — it is the only place a learned
      move is named and the report asks for a popup, not for the old one's removal; the
      alternative reading, folding the move lines into the transient notice and deleting the
      modal, is the open question below.
      **i18n, because this task lands after the sweep:** Task-26 (Batch 10) moves every
      literal behind a key five batches earlier, so this string is created *after* it and
      must go through the shipped i18n module with its key in **both** locales and the parity
      test green.
      Docs: `docs/design-spec.md` §5's level-up sentence (79-81, the modal that announces
      "X learned Y!" and is dismissed with any key or a click) gains the temporary notice
      beside it. Tests: `src/ui/notice.test.ts` (the level-up builder's text and the shared
      hold time, beside Task-31's and Task-49's cases), the i18n parity test over the new
      key, and QA checks `npm run dev`: a battle that levels the squad with no move crossed
      raises and self-dismisses the notice, and a level-up that learned a move raises both
      the notice and the modal.
      Out of scope: the counter tween and the portrait flash themselves, the learned-move
      modal's layout and copy, `showEvoPopup`, the battle's own level-up presentation,
      Task-31's catch notice and Task-49's pickup notice — this task adds a third notice, it
      redesigns neither of the others.
      *Dependencies:* Task-31 (A full party sends the catch to the PC, swappable only on that
      route) — this task **extends** the `src/ui/notice.ts` helper and the HUD notice seam
      Task-31 creates in Batch 7 rather than inventing a third transient window, and it is
      written against that shipped state. Batch order covers the scene:
      `src/scenes/RouteScene.ts` is held by every batch from 7 to 13 and then by Batch 14's
      Task-48 and Batch 15's Task-49 (which also holds `src/ui/notice.ts`), so this is the
      new **Batch 16**, one batch after the pickup notice because the two share both of those
      paths and a batch is an antichain. It is after Batch 10 on purpose so its string goes
      through the shipped i18n module instead of beside it, and after Batch 11 so it edits
      reformat-cleared files and keeps them conforming. It adds no run field, so **no**
      `SAVE_VERSION` step. *(Batch 16)*
- [ ] **[Task-51] Evolution levels depend on the species' BST, at least +10 apart.**
      Reported in play: «rework ahora los niveles para evolucionar de pokes que por defecto no
      evolucionan por nivel son al 20 y al 30 si tienen 2 evos ... porque por ejemplo mankey
      evoluciona al 28 y enseguida evoluciona al 30 o idear otra formula que al menos la
      siguiente evo tenga +10lvl ajustando a numero redondo» — the species whose real
      evolution is a stone, a trade, friendship, an item or a conditional level-up are pinned
      to **20** (and to **30** when they have a second evolution), so a species can evolve
      again two levels after the evolution that produced it. The report wants the level to
      depend on the species' **BST** and to be **20 / 30 / 40**, and no evolution to sit less
      than **+10 levels** above the one before it, rounded to a round number.
      **Today's rule is a stage-indexed constant, not a curve — and it lives in the dex
      accessor, not in `learnset.ts`.** `speciesEvolutionLevel(species: Species)`
      (`src/data/dex/evolutions.ts`, 63-70) is the pure function the report is about (the
      report's pointer to `src/engine/run/learnset.ts` is wrong: that file is the learnset
      panel's move pool and holds no evolution logic). A canon level-up evolution keeps its
      own level (`isLevelEvolution`, 3-5: `method === 'level' && level !== null`); every
      other method takes `STAGE_EVOLUTION_LEVEL[stage]` —
      `const STAGE_EVOLUTION_LEVEL = [20, 30]` (49) — indexed by `evolutionStage` (25-40),
      the `prevo` chain length, so base forms read 20 and middle forms 30. `obtainedLevel`
      (52-61) then raises the result to `max(base, obtained + 1)`, so a species never evolves
      before the level its pre-evolution handed it over at.
      `evolutionLevel(speciesId, evolution)` (77-81) is the public accessor,
      `evolutionBranches` (91-99) resolves every branch, `availableEvolutions` (102-104)
      filters by level, the run reads them at `evolvePokemon`
      (`src/engine/run/progression.ts`, 225-228) and the STATS tab draws them at
      `evolutionGraph` (`src/ui/evolutionGraph.ts`, 63-64).
      **The crowding is real and readable from the code.** Mankey → Primeape is a canon
      level-up evolution at **28**; Primeape → Annihilape is not a plain level-up (its dex
      `evoLevel` is null, its `evoType` a conditional one, `scripts/build-dex.mjs` 96-103),
      so `speciesEvolutionLevel(primeape)` falls to `STAGE_EVOLUTION_LEVEL[1] = 30` — two
      levels after the evolution that produced it. The same shape hits every
      stone/trade/friendship line: Eevee's eight branches all fire at 20 (stage 0), Pikachu's
      Raichu at 30 (stage 1), Kirlia's two branches at 30, and Seadra's Kingdra at **33** —
      `obtained(32) + 1` — one level after Horsea's own evolution.
      **Which numbers move.** The `[20, 30]` constant and the `+1` step in `obtainedLevel`;
      what stays is a canon level-up evolution's own level. The recommended reading, as data
      in the same pure function:
      1. A canon level-up evolution keeps its level (Mankey's 28, Charmander's 16) — the
         report reworks only the species that do **not** evolve by level.
      2. Every other evolution takes a level from a **BST band**: low → **20**, mid → **30**,
         high → **40** (the thresholds are the dev's spec's to freeze; the natural anchor is
         the run's own `LevelBand.bst` windows, `src/data/run.ts`, `D39`, which
         `docs/balance/route-curve.md` records).
      3. The level is then raised to **at least +10 over the evolution that produced the
         species** — `obtainedLevel(species) + 10` — and **snapped up to a round number**, so
         Primeape (obtained at 28) reads **40** (≥ 38), Pikachu (obtained at 20) reads **30**
         (today's value, now earned by the rule rather than by the stage index) and Kirlia
         (obtained at 20) reads **30**. Seadra (obtained at 32) needs ≥ 42; the dev's spec
         freezes how that rounds and says what it means against the map caps.
      4. **Measure against the sheet.** `docs/balance/route-curve.md` records the level bands
         and the per-map caps (**6 / 11 / 17 / 24 / 32 / 40** for the six finite maps) and has
         **no evolution row today**; this task adds the resolved curve to that sheet (or to a
         new sheet under `docs/balance/`) and states, per map, which new levels are still
         reachable inside the cap — a level above 40 only ever fires in infinite mode, and
         that is a balance consequence to report, not to hide.
      **A balance model, so a fixed-seed regression.** AGENTS.md's rule is that any change to
      a balance model keeps a given seed reproducible and ships a fixed-seed regression; the
      function draws no RNG (D11), so the regression is a fixed-seed walk over the shipped
      evolution data: for a fixed seed every species resolves the same levels on every run,
      and every line whose stages are consecutive reads **≥ +10** between them (the report's
      own acceptance criterion). The task re-pins every test that pins the old numbers and
      says which it re-pinned: `src/data/dex/evolutions.test.ts` (Eevee's eight branches and
      `availableEvolutions('eevee', 20)`, 61-67 and 89; Pikachu 30; Kirlia `[30, 30]`;
      Slowpoke `[37, 37]`; Seadra 33 — 69-77), `src/ui/evolutionGraph.test.ts` (Eevee's eight
      ready at 20, 15-21; Pikachu's incoming edge and its ready set, 29-36) and
      `src/engine/run/progression.test.ts` (Eevee's branches ready at level 20, 150-159).
      Two tests pin canon levels and must stay green untouched — `evolutionGraph.test.ts`'s
      Charizard chain (16/36) and `progression.test.ts`'s Charmander cases — and
      `src/engine/run/curve.test.ts` does **not** read the evolution accessors at all (it
      rebuilds the trainer budget from `experienceAward`/`xpForLevel`), so it is not a
      re-pin; the report's assumption that it and `learnset.test.ts` pin these numbers is
      wrong and the report says so.
      Docs, both of which restate the rule and must move with the numbers:
      `docs/battle-spec.md` §7 (109-120, "otherwise a stage default (base forms at 20, middle
      forms at 30)") and `docs/tech-decisions.md` **D38** (551-564), the decision record for
      the level-only rule — one writer each. `docs/data-spec.md` (71-72) names the accessors
      and no number, so it stays.
      Out of scope: the evolution graph's layout and the click (`src/ui/evolutionGraph.ts`
      draws what `evolutionBranches` returns; only the levels move), `evolvePokemon`'s own
      rebuild and the manual-click rule (D38), the starter pick's `evolutionDepth` (counts
      chain length, not levels — `docs/design-spec.md` §5, 144-146), the per-map caps and
      `MAP_TUNING_STEP` (this task measures against them, it does not move them), the ability
      re-roll on evolution, and the dex regeneration (`evolutions.ts` is hand-authored: no
      packer and no `npm run data:dex`).
      *Dependencies:* none — the dex's `bst` field (`src/data/dex/species.ts`, 30-31, D39),
      the evolution accessors and the balance sheet are all shipped, and the task adds no
      state. Batch order covers it: it needs `src/data/dex/evolutions.ts`,
      `src/engine/run/progression.test.ts`, `docs/battle-spec.md` and
      `docs/tech-decisions.md` free at once, and Batch 5's Task-42 holds the test, Batch 6's
      Task-17 holds both docs while Task-09 holds the `docs/balance/` sheets, and Batch 6b's
      Task-38 holds `docs/tech-decisions.md` again — so the first batch that leaves all of
      them free is **Batch 5b**, whose Task-45 and Task-46 touch none of them. It runs
      **before** Batch 6 so the balance pass reads the new curve rather than the one it
      replaces. *(Batch 5b)*

## Phase 7 — Persistence, meta & polish

> Completed work for this phase is archived in `CHANGELOG.md`.

- [ ] **[Task-08]** Accessibility pass: colour-only information audited, HP bars
      readable without colour, full keyboard play, reduced-flash option. It absorbs the
      stale comment Task-15 parked: `src/scenes/StarterScene.ts` (~line 287) still
      claims the sheet has no Fairy badge, and the dead Fairy-fallback path in that
      method goes with it — this sweep owns every `src/scenes/*.ts`, so one line of
      dead code is not worth its own ID.
      *Dependencies:* none. Scheduled after Task-16 (Modernise the panel and menu
      chrome) so the contrast and colour audit runs once, against the final art.
      *(Batch 8)*
- [ ] **[Task-09]** Balance pass using `docs/balance/` sheets and the
      scripted-battle harness. The harness is `scriptedBattle()` inside
      `src/engine/battle/golden.test.ts` — the only one in the tree, called "the seed
      of the balance harness" in `CHANGELOG.md` — and this task may restructure that
      file into a **reusable harness** (export it, or lift it into a module beside the
      test, with the knobs the pass needs: seed, the two teams, a turn cap), keeping
      the fixed-seed golden log itself intact and green. It then tunes the numbers in
      `src/data/` against the sheets, with a fixed-seed regression for every rule it
      moves.
      **The XP/level-cap half is not done, and the sixth round's one playtest reading is
      already measured for it.** Reported in play: «se supone que la tarea de equilibrar
      experiencia para llegar al level cap esta ya? para piso 1 me he cargado todos los
      entrenadores menos el boss pero solo he subido 1 nivel». The reading is **not a defect of
      the shipped curve — it is that curve working at map 1** — and it is recorded here because
      the number it turns on is this pass's to tune:
      - **Map 1's cap is 6** (`levelCapForMap(1)`, `src/data/maps.ts` 104-106 over
        `MAP_TUNING[0]`, `levels: 2-6`, 56) and a fresh starter begins at level **5**
        (`START_LEVEL`, `src/scenes/StarterScene.ts` 27), so **one level is that floor's whole
        cap**: the bar from 5 to 6 is `xpForLevel(6) − xpForLevel(5)` = 216 − 125 = **91 XP**
        (`xpForLevel = level³`, `src/engine/run/progression.ts` 47-50) — which is the sheet's own
        `needed(1)`. A floor's designed level gain is therefore **1 / 5 / 6 / 7 / 8 / 8** across
        maps 1-6 (the cap chain 6 → 11 → 17 → 24 → 32 → 40), so the human's "+1 level" is the cap
        being **reached**, not missed.
      - **One map-1 trainer's roster member is worth 4-27 XP.** `experienceAward(level, 1,
        true)` = `floor(level × 5 × 1.5 × trainerXp)` (`src/engine/run/progression.ts` 71-80)
        reads the **defeated** Pokémon's band (`bandForLevel`, `src/data/run.ts` 97-103), so
        levels 2 / 3 / 4 pay Early's 0.3 (4 / 6 / 9 XP) and levels 5 / 6 pay Low's 0.6 (22 / 27
        XP). Mean over map 1's own range (2-6): **13.6**; over the Early band's range (2-5, the
        span `curve.test.ts` averages, 88-91): **10.25**. A floor's mean is `trainerSize` 1, so
        `A(1)` is one of those two — and the sheet prints **13.40**, which matches neither
        exactly, so **re-measure `A(1)` first**.
      - **What the curve delivers on floor 1.** With the sheet's `T̄(1) = 11.33` trainers, 75 %
        of them pay `0.75 × 11.33 × A(1)` = **87.1** (band-range `A`) or **115.6** (map-range
        `A`) against the **91** the cap needs, and a full clear (~11 trainers, what the human
        walked) pays **44-297 XP, typically ≈150**. So the cap is reached and the overflow is
        **parked at the ceiling**, not banked (`gainExperience`, `src/engine/run/state.ts`
        229-239, the `capped` event). Two readings straddling the lower edge of the `1 - 1.5`
        window is exactly the kind of thing this pass exists to settle; as shipped the numbers
        are **generous, not short**.
      - **What to decide here, then:** whether a floor worth a single level is the wanted shape.
        The knobs are `MAP_TUNING[0].levels` (map 1's cap and its 2-6 range) and the per-band
        `trainerXp` chain (`src/data/run.ts` 26-81), both balance data; whatever moves,
        `src/engine/run/curve.test.ts` re-pins it and `docs/balance/route-curve.md` records the
        new walk (its `A(m)` column should then agree with the test's own average).
      *Dependencies:* none — it reads `docs/balance/route-curve.md` and the per-band
      `trainerXp` rule Task-10 shipped (archived with Batch 1). It is also the
      producer of the reusable harness: a later task that wants to run a scripted
      battle depends on Task-09 — `Task-35`'s fixed-seed AI regressions do. *(Batch 6)*
- [ ] **[Task-46] A finished run returns to the main menu, not to the starter pick.**
      Reported in play: "al perder deberia volver a menu principal no a elegir starter".
      **Today the score screen's one confirm starts a new run.** `RunOverScene.create`
      draws the summary, arms itself after `RUN_OVER_INPUT_DELAY_MS` and shows one hint
      (`RunOverScene.ts`, line 57: `` `${keyLabel(confirm)} — start a new run` ``);
      `handleAction` answers only `confirm`, and `startNewRun()` calls
      `this.scene.start('Starter')` (line 79). The screen is reached from
      `RouteScene.applyBattleResult` once the party is dead
      (`this.scene.start('RunOver', { run, won: false })`, ~5095) and from the same place
      on a win (~5102) — **one screen, two outcomes** — and `create` clears the save
      (`clearRun`) before it draws, so whatever this screen does next, the run is gone.
      The main menu (`'MainMenu'`, `src/scenes/MainMenuScene.ts` 160-174) is where a run is
      actually started: **New run** (`scene.start('Starter', …)`), **Continue** (only while
      the save holds a run — now never, after `clearRun`) and **Options**.
      **Fix shape:** the score screen's confirm returns to `'MainMenu'` and the hint's copy
      follows, so a finished run lands where the three choices are instead of being pushed
      into the starter offer with a fresh seed. That is one destination and one string.
      **Decision for the dev's spec:** the report is about a loss, but the screen is shared —
      the recommended reading is that **both** outcomes go to the main menu (the run is over
      either way and the summary still reports the win); the alternative is that only
      `won: false` does and a win keeps the current behaviour. Docs: the sentence in
      `docs/design-spec.md` §6, whose paragraph already says "A run ends on a score screen,
      win or loss" and should name where it goes next.
      Out of scope: the summary's own lines and numbers (`src/ui/runSummary.ts`), the
      score screen's layout, and the death-to-screen transition (`[Task-40]`'s entry beat is
      the battle's opening, not this one).
      *Dependencies:* none. Batch order matters once: it sits in Batch 5b, the first batch
      after Task-16 releases `docs/design-spec.md` (Batch 5) and **before** Task-17 rewrites
      that file (Batch 6), so §6's new sentence is in place when the docs pass reads it.
      *(Batch 5b)*
- [ ] **[Task-47] The main menu's Continue row shows the map, its biome and the party's
      icons.** Reported in play: «en menu principal en continue el string ruta deberia
      salir que mapa y bioma y deberia salir el icono sprite de los pokes del party» —
      instead of the route string, the row should name the map and its biome, and it
      should also show the party's Pokémon as sprites.
      **Today the row counts rooms and nothing else.** `MainMenuScene.create` (56-128)
      builds one row per action; a row is a `RowView` (27-31) of a highlight rectangle, a
      left-hand `BitmapText` label (`MENU_LABELS`, 16-20) and a right-aligned value text
      drawn at `rowX + rowW - 20` (90-94) — and `rowValue` (130-134) is the whole of it:
      `Route ${this.run.routeIndex}`, the run's **global room counter**, for the continue
      row and `''` for the other two. So the menu tells the player how many rooms they
      have walked and nothing about where they are. Everything the report asks for is
      already in hand: the scene holds the whole `RunState` in `this.run` (45, 59), and
      `'continue'` only exists while that run has a living party.
      **Where the map and the biome come from.** `biomeForMap(run.seed, run.mapIndex)`
      (`src/engine/maps/plan.ts`, 166-173) recovers a floor's biome from the seed **without
      building the plan** — it walks the same `map` stream `planMap` does, so the two can
      never disagree — and `getBiome(id).name` (`src/data/biomes.ts`, 61-63) names it. That
      pair is exactly what the route HUD's own title draws (`src/scenes/RouteScene.ts`,
      2057-2058: `` `Map ${this.run.mapIndex} · ${biomeName}` ``), so the menu can show the
      string the player already reads on the map instead of a second dialect.
      **The party-icon accessor already exists, and it is not the art this report might
      suggest.** `portraitFor(speciesId, shiny)` (`src/data/portraits.ts`, 28-36) returns
      the `{ key, frame }` of the 64px portrait atlas (`PORTRAIT_SIZE`, `PORTRAIT_ATLAS_URL`,
      10-15) which `BootScene` loads at boot (`src/scenes/BootScene.ts`, 136-142), so
      `MainMenuScene` — which has no `preload` today — needs none. It is the identical call
      the party rows and cells already draw with (`RouteScene` 1517, 1651, 2082, 2166;
      `BattleScene` 1787, the battle's SWITCH grid). The two other candidate sources are
      the wrong ones and the report should say so: `src/data/pokemonSprites.ts`'s `icon`
      variant is Añil's 64px **battle** icon strip (`public/anil/icons/**`), which nothing
      in the tree draws today and which would need a per-species lazy load, and
      `src/assets/pokemon/**` is the overworld follower art Task-41 introduces (Batch 6) —
      neither is the party icon the HUD shows.
      **Fix shape:** the label as a pure helper, then one drawing pass. The string is a
      view model with no rule behind it, so it belongs in the computing half of `src/ui/`
      beside its test — and it goes into the run's **existing** text model,
      `src/ui/runSummary.ts`, as an exported `runPositionLabel(run: RunState): string`, with
      its cases in `src/ui/runSummary.test.ts`, rather than into a new `src/ui/*.ts` file:
      a new file in that folder owes a `README.md` line in the same task, and
      `src/ui/README.md` is Task-31's in this very batch, so a new module here would share
      a path with a batch-mate and break the antichain. `MainMenuScene` then draws it:
      `rowValue('continue')` returns that label, `RowView` gains the row's portrait images
      built in `create` from `portraitFor(member.fighter.speciesId, member.fighter.shiny)` in
      party order (the lead first, exactly as the party rows read), at a fixed scale the spec
      freezes so six icons fit the row's `ROW_H = 60` between the label and the right-aligned
      value, and hidden/updated in the same place the row's value text is today. A species
      the atlas has no cell for draws nothing in that slot (`portraitFor` returns null) — the
      alternative is a sheet-extension job, which is not this task.
      **The string, as the recommended reading:** `Map <mapIndex> · <biome name>` — the route
      HUD's own title, because the report asks for the map and the biome *instead of* the
      route string; the alternative keeps the room as a third clause
      (`… · Route <routeInMap + 1>`, the order `partyDetail.ts`'s `catchLabel` uses at 151-154)
      so the player still sees how far in they are, and it is the one question to settle
      before this batch's branch is cut.
      Out of scope: the row's key handling, the New run and Options rows, the save/load path,
      `RowView`'s highlight, the settings screen, any new art or atlas, and the run-over
      screen. Docs: the main menu bullet in `docs/design-spec.md` §2 (line 16-17, "it shows
      the route it is on" — the sentence this replaces).
      Tests: `src/ui/runSummary.test.ts` over `runPositionLabel` — a run on map 3 reads
      `Map 3 · <name>`, and the name is the one `biomeForMap(seed, 3)` resolves, so the label
      and the HUD cannot drift; plus the empty/edge case of the helper. QA checks the menu in
      `npm run dev` with a saved run: the Continue row shows the map and biome and one
      portrait per party member, and a rebind or an options round-trip redraws it unchanged.
      *Dependencies:* none — `portraitFor`, `biomeForMap` and `getBiome` are all shipped, and
      it reads no file another open task produces. Batch order covers the doc: this is the
      first batch in which `src/scenes/MainMenuScene.ts` (nobody's until Batch 8's
      every-scene sweep) and `docs/design-spec.md` §2 (held by a batch-mate in every batch
      from 5 to 6b) are free together, so it lands in **Batch 7**; it is also three batches
      before Batch 10's i18n sweep, which therefore keys its string with the rest.
      *(Batch 7)*

## Phase 8 — Biomes & art assets

> The FRLG art pass (route interiors, ground vs path, exit art, ledge and route
> props, beach, animated portraits, FRLG move/attack FX replacing the PMD art,
> per-biome battle backgrounds) and the release chores are out of the backlog; what
> shipped stays in `CHANGELOG.md`.

Only `forest` is in `BIOME_ORDER` even though `BIOMES` defines five, so the run
cycles one biome.

- [ ] **[Task-14] New biomes.** Decide which biomes join the cycle and add them: a
      tileset config and palette in `src/data/tilesets/`, a `BIOMES` entry with its
      `layout` and its `terrain` passes, and a slot in `BIOME_ORDER` (`D10`).
      Candidate list to decide: desert, prairie/plains, beach, autumn woods,
      marsh/rain, snow, volcano, ruins/power plant. Each new biome owes a fixed-seed
      generator regression.
      *Dependencies:* none. *(Batch 8)*
- [ ] **[Task-30] A hit plays the move's sound, and an encounter the Pokémon's
      cry.** Both moments were dropped from the cue table rather than faked with one
      shared sound, because the original varies them. The material is in
      `pret/pokefirered`: `sound/songs/midi/se_m_*.mid` carries one `SE_M_*` sound per
      move (`include/constants/songs.h`), and the 388 cries are
      `sound/direct_sound_samples/cries/<species>.wav`, with `gCryTable` in
      `sound/cry_tables.inc` mapping dex order to `Cry_<Species>` — the game plays a
      cry through a `PokemonCrySong` (`include/gba/m4a_internal.h`), not as a bare
      sample, so decide whether to reproduce that or ship the sample. The dex's own
      `species.json` carries no cry, so the species→cry map comes from that table or
      from the file names. `scripts/frlg/render-frlg-audio.mjs` already renders a MIDI
      through the m4a engine, so the move sounds extend it; the cries need their own
      seam. **The cue-table contract is the decision to take here**: a cue id is the
      only name a scene may use (`src/audio/cues.ts`, `D22` addendum), so either give
      every move and species its own cue id or add one parameterised call that
      resolves a generated table — pick one and say why. Wire the hit into
      `BattleScene`'s damage event and the cry into `RouteScene.startBattle` (and the
      battle's send-out), keep `cues.test.ts`'s placeholder guard over whatever ships,
      and note that the original also varies a hit by effectiveness
      (`Cmd_effectivenesssound`: `SE_EFFECTIVE`, `SE_SUPER_EFFECTIVE`,
      `SE_NOT_EFFECTIVE`) if that is wanted too.
      *Dependencies:* none. *(Batch 12)*
- [ ] **[Task-41] The party's lead Pokémon walks behind the player on a route, with its
      idle and its running animation.** Reported as a wish: "usar `assets/pokemon/` para que
      el primer poke del party vaya detrás del jugador con su animacion idle y correr".
      **Today the route draws exactly one actor.** `RouteScene.create` builds
      `this.playerSprite` from the FRLG player atlas (`PLAYER_SPRITE_TEXTURE_KEY`,
      `src/data/playerSprite.ts`) at 1232-1237 and drives it with `movePlayerTo` / `face` /
      `walkStep` / `settleMovement` (4302-4353): `walkStep` plays
      `playerWalkAnimKey(this.facing)` at `playerWalkTimeScale(running, WALK_STEP_MS,
      RUN_STEP_MS)` (so "running" is the same walk cycle at a higher `timeScale`, the
      FireRed rule of `D24`, `src/render/playerAnim.ts`) and tweens the sprite tile to tile;
      `onTileEntered` (4355-4378) rolls the encounter. **Nothing follows it, and the scene
      keeps no movement history** — `this.player = { x, y }` is the only position state, and
      `actorDepth` the only z-ordering.
      **The art exists, is committed, and nothing in `src/` reads it.**
      `src/assets/pokemon/<num>.png` + `<num>.json` is 652 pairs — dex **nums 1-649** plus
      the three Deoxys formes `35101`-`35103` — written by
      `scripts/legacy-art/extract-real-sprites.mjs` and seeded by
      `scripts/legacy-art/generate-pokemon.mjs`. Each sheet is variable-width but exactly
      **five direction rows of 32x32 frames**, in the fixed order `down, downRight, up,
      upRight, left` (the script's `ATLAS_DIR_ROW`), and each manifest carries `cols` plus
      `anims` for `idle`, `walk`, `attack`, `special` and `hurt`, each with `start`, `count`
      and `durationsMs` — **there is no `run` animation**, which is why "correr" is the walk
      strip played faster, exactly as the player does it. `src/assets/README.md` documents the
      sheets and `src/data/README.md` the accessor contract;
      `src/data/pokemonSprites.ts` is a *different* set (the Anil **battle** sprites under
      `public/anil/`), so it is a shape to copy, not to reuse.
      **Fix shape:** two new modules and the scene. `src/data/pokemonOverworld.ts` is the
      lazy accessor — `pokemonOverworldSheet(speciesId)` resolves
      `getSpecies(speciesId)?.num` (`speciesByNum`, `src/data/dex/species.ts`) to
      `src/assets/pokemon/<num>.png` + `<num>.json` through `import.meta.glob` and returns
      `{ textureKey, url, size, frames, rows, anims }`, or null when no sheet exists — with
      its own test; `src/render/pokemonFollower.ts` is the animation registry, the way
      `playerAnim.ts` and `trainerAnim.ts` are (an idle key, a walk key and the row for a
      facing, registered per species the way `PLAYER_WALK_ANIMS` is). `RouteScene` loads the
      sheet when `party[0]`'s species changes (a reorder, a catch that lands in the party, a
      permadeath release, `transitionTo` — never per frame), keeps a **bounded trail** of the
      player's last tiles, and steps the follower one tile behind with the same tween
      duration: idle while the player stands, the walk cycle while a step is in flight, and
      running reusing the player's `playerWalkTimeScale` factor. The three facings it needs
      are the player's (`down` / `up` / `side`, the left row flipped for right); the two
      diagonal rows go unused, as they do for the player. Measured constraints to honour: the
      follower occupies no tile (the movement map and `grassTipKeys` are untouched, and it
      never rolls an encounter or trips a trainer cone), it draws with `actorDepth` so a tree
      tip still passes over it, it is hidden in battle (`applyBattleResult` /
      `scene.pause`), and it allocates nothing per frame.
      **Decision for the dev's spec:** a species with **no** sheet (a dex num above 649, or a
      forme with no art of its own) — the recommended reading is to draw **nothing** for that
      lead and say so in the report; extending `src/assets/pokemon/**` is a separate job.
      Files: `src/data/pokemonOverworld.ts` + test, `src/render/pokemonFollower.ts` + test,
      `src/scenes/RouteScene.ts`, `src/data/README.md` and `src/assets/README.md` (the
      per-folder convention), and `src/scenes/BootScene.ts` **only** if the dev preloads
      there instead of loading from the scene. Docs: `docs/design-spec.md` §5 is where a
      route presentation line would go, and that file is Task-17's in this batch, so the spec
      either takes it from Task-17 or takes no doc line — the two READMEs above are the
      required ones.
      Out of scope: a queue of several followers (the report names the **first** party member
      only), the battle's own sprites, a new `run` animation in the sheets (the walk strip
      played faster is the rule), collision or interaction for the follower, and
      `docs/art-direction.md`.
      *Dependencies:* none. Batch order covers it: it takes the one free scene path in
      Batch 6 (`src/scenes/RouteScene.ts` is Task-16's in Batch 5, Task-45's in 5b, Task-38's
      in 6b and Task-31's in Batch 7) and its new `src/data/` file is not one of the number
      tables Task-09 tunes in the same batch. *(Batch 6)*
- [ ] **[Task-45] Tall grass moves when the player steps through it, FireRed-style.**
      Reported as a task: "añadir animacion pisar hierba como en rojo fuego".
      **Today the FRLG tall grass is one static frame, and there is no way to animate a tile
      at all.** The tile is `FRLG_TALL_GRASS = 5` (`src/data/tilesets/frlg.ts`, 71-76),
      stamped into the sheet's unused chest slot by `scripts/frlg/build-tilesets.mjs`, and a
      cell draws it through `resolveTileFrame` (`src/engine/tileFrames.ts`) and
      `RouteScene.tileFrames` (4086-4099); the old procedural tuft overlay only exists for
      tilesets whose `TALL_GRASS` frame *is* their floor frame (`drawEntities`, 4160-4177 —
      the FRLG fields deliberately opt out). Walking on one rolls the encounter
      (`onTileEntered`, 4358-4378) and changes nothing on screen. `TilesetConfig`
      (`src/engine/tileset.ts`, 172-209) carries frames, autotile rules, the wall pattern,
      ledge frames, variants and common frames — and **no animation contract**, so the scene
      has nothing to play even where the art exists. The FRLG sheets do have free cells:
      frame 6 sits unused beside the grass, and the wall-shape slots 45-50 are dead while
      `wallPattern` wins the wall resolution.
      **Fix shape:** an animation contract in the engine, frames in the packed atlas, and a
      player in the scene. `scripts/frlg/build-tilesets.mjs` stamps FireRed's tall-grass
      animation frames into unused cells of `src/assets/frlg/{outdoor,forest,cave}.png` (a
      generated file — one writer per batch); `TilesetConfig` gains
      `tileAnimations?: Readonly<Record<number, TileAnimation>>` of shape
      `{ frames: readonly number[]; frameMs: number }` (the spec freezes the exact names),
      plus one pure accessor beside `variantFrame` in `src/engine/` with a test;
      `src/data/tilesets/frlg.ts` declares the tall grass's sequence; and `RouteScene` drives
      it — **one** timer advancing every tall-grass cell's image, no per-frame allocation,
      and it must not fight the `TILE_SIZE / FRLG_TILE_SIZE` scaling, the two-layer
      `tileFrames` draw or `TREE_TIP_DEPTH`. Docs: `docs/tileset-spec.md` gets the animation
      slots and the rule (the atlas contract's own file).
      **Decision for the dev's spec:** FireRed animates **every** tall-grass cell
      continuously, which is what "como en rojo fuego" describes and is the recommended
      reading; the alternative is a one-shot rustle only on the tile the player stands on.
      Out of scope: a general animated-tile system for every biome (only the tall-grass
      frame is asked for), the encounter roll, the grass frame itself (`FRLG_TALL_GRASS`
      stays frame 5), the tilesets that still draw the procedural tuft, and per-move or
      per-weather effects.
      *Dependencies:* none. Batch order covers it: Batch 5b is the first batch in which
      `src/scenes/RouteScene.ts` (Task-16's in Batch 5) and the biome atlases are free, and
      it runs **before** Batch 6 so Task-17's docs pass reads a settled
      `docs/tileset-spec.md`. *(Batch 5b)*
- [ ] **[Task-58] Every panel takes the debug panel's own visual style.** Reported in play, while
      Batch 5 was in flight: «los paneles que sean estilo visual como el de debug» — the game's
      windows should read like the dev overlay's, which means one **dark** translucent surface,
      one **bright accent** frame, one **light** ink and the muted tone that goes with it, instead
      of the drawn set's light windows and deep-black text.
      **This is a follow-up to `[Task-16]`, and the edge is real.** The chrome it re-tunes is the
      set Task-16 is drawing in the batch in flight — `scripts/ui/build-chrome.mjs`, the generated
      `src/data/ui/chrome.json` and `src/data/ui/font.json`, the three `src/assets/ui/*.png`,
      `src/ui/frlg.ts` and `src/ui/frlgFont.ts` — none of which exists on `main` today, so this
      task cannot be written before that one ships; Batch 5 is **cut** (its four specs are written
      and its four branches are cut), so the contradicting report is registered here as the
      follow-up rather than folded into it, and this task's own spec is written when its batch is
      cut, by which time Task-16 has merged. The values it is written against are the ones Task-16
      ships, verified in its worktree today.
      **What the debug panel's style is, exactly.** `installDebugMenu` (`src/dev/debugMenu.ts`) is
      the tree's only debug panel and it is a **DOM overlay**, so its style is CSS, not a nine-slice
      (296-299): `position:fixed;right:8px;bottom:8px;z-index:9999;…;padding:10px;min-width:238px;`
      `background:#10161fe6;border:2px solid #7dd3fc;border-radius:8px;color:#e2e8f0;`
      `font:12px/1.4 monospace;`. Its parts are the palette: a bold accent title `#7dd3fc` (302-304,
      the `DEBUG · tools` line), a muted status tone `#94a3b8` (307), sunken fields
      `background:#0f172a;border:1px solid #334155;border-radius:5px` (317-318), ordinary buttons
      `background:#1e293b;border:1px solid #7dd3fc` (278-279) and primary actions
      `background:#0e7490;color:#f8fafc` (361, 463, 608, 630, 830, 905) with the heal control at
      `#166534` (833). Its surface is not invented either: `docs/art-direction.md` line 14 already
      declares "Background `#10161f`, UI text `#f8fafc` on `#000000aa`", and the overlay is that
      sentence's only implementation in the tree.
      **What Task-16 ships instead, so the task has something concrete to change.** The drawn set
      goes the other way on both counts: `scripts/ui/build-chrome.mjs` draws `BEZEL = 0x0b0b10`,
      `KEYLINE = 0x3a3d52`, `FIELD_DARK = 0x11121a`, `HIGHLIGHT = 0xffffff` and
      `FRAME_SHADOW = 0x000000` (23-27) with the **light** window keeping the FRLG sheet's own
      dominant opaque colour (`dominantColour`, 59-77 — `#f8f8f8`, per the worktree's
      `docs/art-direction.md` 17-20), the nine-slice corners and alphas frozen in
      `src/data/ui/chrome.json` (window corner 20 / alpha 0.88, textbox corner 24 / alpha 0.94) and
      the ink `FRLG_INK = 0x0b0b10` (`src/ui/frlgFont.ts`, 96) inking every string in the game.
      Task-16's own §4 sentence says it in words (`docs/design-spec.md`, worktree 203-207: the dark
      textbox, "the light **window** behind the HP panels … and the light windows ink their text
      with the deep-black `FRLG_INK`"). Four tokens therefore differ, and each is one place:
      **the surface** (a light `#f8f8f8` window against `#10161f` at the debug panel's ~0.90), **the
      frame** (a `#3a3d52` keyline against a 2px `#7dd3fc` accent), **the corner** (20/24 texels at
      the 4x canvas against an 8px radius) and **the text** (deep-black `FRLG_INK` against the
      light body tone `#f8fafc` with `#94a3b8` for the muted lines). The controls' own tones travel
      with them: the light fills that every container draws today (`MoveGrid`'s cells, badges and
      info buttons, `src/ui/moveGrid.ts` 128-161; `AbilityInfoButton`, `src/ui/abilityInfo.ts`
      51-52; the battle's command cells and bag tabs, `BattleScene` 481 and 600-604, 1704-1717; the
      HUD's rows and cells, `RouteScene` 1525-1570 and 2618; the starter cards, `StarterScene`
      253-277) become the overlay's own control tones — fill `#1e293b`, border `#334155`, sunken
      `#0f172a` for a field, the accent `#7dd3fc` and its `#0e7490` for the selected or primary
      one — which is exactly why this is a whole-chrome task and why it cannot share a batch with
      anything.
      **Fix shape:** one re-tuned chrome set, one ink flip and one sweep of the containers. The
      packer's palette constants and `chrome.json` carry the new tokens (Task-16's own rule: a
      chrome value lives in `src/data/ui/chrome.json` through the packer, and **no scene re-derives
      one**), `src/ui/frlg.ts` exports whatever new token a scene needs (the accent and the muted
      tone join `FRLG_WINDOW_PADDING` / `FRLG_WINDOW_ALPHA`), `FRLG_INK` becomes the body ink so
      every existing `tint: FRLG_INK` draw site flips with one constant, and the containers whose
      fills were light move with it. Two things the task must decide and freeze as data, because
      they are the only ones `FRLG_INK` cannot carry: the sites that pair **two** tones — the four
      tab pairs in the route HUD (`RouteScene` 2131, 2161, 2364, 5599, `active ? 0xf8fafc :
      FRLG_INK`) and the battle's own (`BattleScene` 2104) — whose "selected" tone becomes the
      accent rather than white, and the ad-hoc greys the scenes pass today (`0x6b6887`, `0x3a3956`,
      `0x94a3b8`), which collapse into the one exported muted tone. The corner is the one token
      that cannot grow freely: a nine-slice's band must fit inside the corner, and the window's
      band is its own `padding.x = 20` (the worktree's `scripts/ui/build-chrome.mjs` 96-107 clamps
      it), so the drawn radius grows at most to that and the **content insets do not move** —
      `FRLG_WINDOW_PADDING`, `FRLG_TEXTBOX_PADDING`, every panel rect and every layout stay exactly
      where they are, which is the whole reason Task-16 kept them.
      **What stays:** the nine-slice geometry and the frozen content insets, the glyph **shapes**
      and the bitmap face (the overlay's `monospace` is a DOM font: adopting a typeface is a
      separate job, and Task-16's spec already rules it out of scope), the HP bar, the ▶ cursor,
      the type / status / category / item icons and their atlases, and every panel's layout. The
      one thing the task owes beyond the tones is the check the new pairing needs: it introduces
      the light-on-dark pairs itself (a selected tab against an unselected one, the HP bar's green
      on a darker field, a dimmed ball or a faint status badge), so it carries its own contrast
      pass — Batch 8's accessibility audit ran against Task-16's chrome and is not re-run (the open
      question below).
      Files: `scripts/ui/build-chrome.mjs`, the generated `src/assets/ui/{window,textbox,font}.png`
      and `src/data/ui/{chrome,font}.json`, `src/ui/frlg.ts`, `src/ui/frlgFont.ts` +
      `frlgFont.test.ts`, `src/ui/README.md` and `src/assets/README.md`, every `src/scenes/*.ts`
      with a drawn string or fill (`BootScene` only if its loader derives a colour; the drawn
      texture keys do not move), every `src/ui/**` module that fills a container or inks text, and
      the two docs that describe the chrome (`docs/art-direction.md`, whose §Palette paragraph is
      Task-16's, and `docs/design-spec.md` §3/§4). Tests: the packer's own determinism check (two
      runs byte-identical, as Task-16 lays it down), `src/ui/frlgFont.test.ts` for the ink and the
      manifest, and a contrast check over the new pairs — the pixel art itself is still validated
      by the smoke pass rather than by a Phaser unit test, the Task-16 precedent.
      Out of scope: the debug overlay itself (`src/dev/**` is dev-only and stays as it is — it is
      the reference, not a consumer), a different typeface or a webfont, any layout re-cut, the
      FRLG originals under `src/assets/frlg/**` and their packers, `src/engine/**` (no rule moves),
      the settings model (`hudTransparent` keeps its id, its values and its meaning, as Task-16
      re-read it), and `Task-08`'s audit, which is not re-run.
      *Dependencies:* `Task-16` — the drawn chrome set this task re-tunes: the packer
      `scripts/ui/build-chrome.mjs`, the generated `src/data/ui/chrome.json` and the three
      `src/assets/ui/*.png`, and the `src/ui/frlg.ts` / `src/ui/frlgFont.ts` exports
      (`FRLG_INK`, `FRLG_WINDOW_ALPHA`, `FRLG_TEXTBOX_ALPHA`, the frozen paddings) whose values
      move. It adds no run field, so **no `SAVE_VERSION`** step and no change to the 14 → … → 18
      chain. Batch order covers the rest: it claims every scene and most of `src/ui/**`, so every
      batch from 5 to 19 holds at least one of its paths (5 Task-16's chrome set, 5b Task-45 and
      Task-53, 6 Task-34 and Task-41, 6b Task-38 and Task-57, 7 Task-18, Task-31 and Task-47, 8
      Task-08's every-scene sweep, 8b Task-35, 9 Task-39, 9b Task-40, 10 Task-26's every-scene
      sweep, 11 Task-29's `src/**` ledger, 12 Task-30, 13 Task-44 and Task-59, 14 Task-48, 15
      Task-49, 16 Task-50, 17 Task-52 and Task-60, 18 Task-55, 19 Task-56) — which is why it opens
      the new **Batch 20** on its own, the way the reformat opens Batch 11, and why it runs
      **after** Batch 11 so it edits reformat-cleared files and keeps them conforming. *(Batch 20)*

## Phase 9 — Maps (route groups), biomes & progression

> Completed work for this phase is archived in `CHANGELOG.md`.

A **map** is a Binding of Isaac-style floor: a grid of routes (rooms) of one
random biome, closed into at least one cycle, with its own level range, special
rooms (shop, mini-boss, mega-stone) and a boss on the room farthest from the entry
that opens the portal to the next map. This phase reworks the flat route chain
into these floors and adds the Poké Dollar economy. Source of truth:
`docs/maps-spec.md`; decisions D28–D33. Steps are ordered — each is one branch off
`main`, most useful first.

- [x] **Step 1 — Map tuning tables (`src/data/maps.ts`).** The per-map level
      range, route-count range and route-size range, with `mapTuning`,
      `levelRangeForMap`, `levelCapForMap`, `routeCountRangeForMap`,
      `routeSizeRangeForMap` and the `MAP_TUNING_STEP` extrapolation an infinite
      run walks past the last row. Data only; balancing never touches the
      generator (`docs/maps-spec.md` §4). Tests in `src/data/maps.test.ts`.
- [x] **Step 2 — `MapPlan` floor generator (`src/engine/maps/plan.ts` +
      `streams`).** `Plan(seed, mapIndex)` rolls the biome (never the previous
      map's), the room count and each room's width/height, grows the floor on a
      grid from the entry, closes **one or more cycles** (random, at least one),
      derives each room's opening
      set and shape, and marks the boss as the room farthest from the entry. New
      `map` stream keyed `(seed, "map", mapIndex)`; fixed-seed determinism,
      connectivity, cycle and no-dangling-opening tests.
- [x] **Step 3 — Route shapes from the opening set.** Add the `dead-end`,
      `corridor` and `tee` shapes to `layout.ts` beside `straight` / `bend` /
      `cross`, and let the route builder take the opening set from the plan
      instead of rolling a shape: every opening is the grid neighbour's
      **opposite** edge, aligned to the same border band. Per-shape and
      connection regression tests.
- [x] **Step 4 — Plan-driven route size.** `buildRoute` takes its width/height
      from the plan (the map's size range, rolled independently) instead of the
      fixed 20x20; confirm the terrain/branch tiers, the camera bounds and the
      beyond-edge margin (`padMap`) still hold. Fixed-seed regression per size.
- [x] **Step 5 — Per-map levels & cap.** Wild encounters and trainer rosters read
      the map band (rooms ramp `minLevel → maxLevel`); `levelCap` becomes the map
      cap (`levelCapForMap`) and the XP/evolution clamps follow it. Migrate the
      `bandForRoute` / `levelCapForRoute` callers; fixed-seed roster tests.
- [x] **Step 6 — Run state: floors & discovery.** `RunState` gains `mapIndex`,
      `routeInMap` and the discovered-room set beside the global `routeIndex`;
      `advanceRoute` vs `advanceMap` (heal stop per map) and a save migration
      (`SAVE_VERSION`). Pure tests, including the discovery rule.
- [x] **Step 7 — Boss & portal.** The room farthest from the entry fields the map
      boss at `maxLevel`; the boss room has no onward opening, and when the boss
      falls a **new opening appears with the portal** that advances to the next
      map (final boss ends a finite run). Pure guard/portal logic + `RouteScene`
      wiring.
- [x] **Step 8 — Route HUD minimap.** A HUD panel drawing the floor as a BoI-style
      grid of rooms — a cell per discovered room from its size and shape, its
      openings on the matching walls, links between known neighbours, the current
      room highlighted and the boss/portal and each special room marked with its
      **own icon**. Pure layout in `src/ui/mapView.ts` + tests; the scene only
      draws it (`docs/maps-spec.md` §8).
- [x] **Step 9 — Mega Evolution in battle (`D34`).** The prerequisite for the
      Mega Stones: a Pokémon holding its stone may Mega Evolve **once per battle**
      from a command-menu control (player and AI), changing stats/type/ability to
      the Mega forme for the battle. All dex Megas (formes may be nonstandard);
      only bosses, mini-bosses and the `ace` archetype carry stones. Engine +
      data + battle UI, fixed-seed tests.
- [ ] **[Task-17] Step 14 — Docs & migration pass.** Finish `docs/maps-spec.md`,
      update `design-spec.md` / `routes-spec.md` / `battle-spec.md` / `AGENTS.md`
      and the tech decision addenda, and archive the steps in `CHANGELOG.md`.
      **It also writes down the README convention the per-folder READMEs already
      follow (Task-02, Batch 1): a task that adds, renames or deletes a file updates
      that folder's `README.md` in the same task** — one role line per file, no
      exported names, so the folder's map never rots. `AGENTS.md` is where the
      convention belongs (a line in the Directory layout section), and Task-17 is the
      only task in the batch that owns it.
      **Two stale spots Batch 4 left behind ride here, because this task already owns
      both files (one writer each):** `docs/tech-decisions.md`'s `D40` still says "48
      Megas" after Task-19 shipped **88**, and `docs/battle-spec.md` §9's Mega section
      still reads as if the set were the classic ones. Write the counts as they stand
      when this task runs: Task-36 (Batch 4b) may move the species side again before
      it, and the stale line is the number, not the rule.
      *Dependencies:* none. *(Batch 6)*
- [ ] **[Task-18] Gigantamax, in the Mega Evolution mould.** Model Gigantamax the
      way the Megas work (`src/engine/battle/mega.ts`, `D34`): once per battle a
      holder may change to its G-Max forme, taking that forme's stats/types/ability
      **before any move**, and revert when the battle ends (`snapshotFighter` keeps
      the base species). The G-Max formes are **not in the build at all** today —
      `isBattleBossForm` in `scripts/build-dex.mjs` excludes every Gmax/Eternamax
      forme from the playable species — so they must be generated beside the
      playable set, a `gmaxes.json` next to `megas.json` (`src/data/dex/megas.ts`),
      with their art. **The stats are Añil's rule, not a
      G-Max stat table**: as in Sword/Shield, Gigantamax only **doubles HP** and
      leaves every other stat alone — which is what the dex's own G-Max formes
      encode (`charizardgmax` and `pikachugmax` carry `baseStats` identical to
      their base species; the ×2 lives in the Dynamax mechanic, never in the data).
      So a G-Max forme keeps the base species' stats, types and ability, and the
      doubling is applied by the mechanic the way Añil does it. Añil is also the
      source for the G-Max art and its sprite placement
      (`sprite-sources/anil/PBS/pokemon_metrics_gmax.txt` and the numbered form
      sprites `Graphics/Pokemon/Front/<SPECIES>_<n>.png`). Max moves stay unmodelled
      (`D42`): decide here whether a G-Max forme keeps its normal moves or the task
      also brings its G-Max move. Needs a decision entry, `docs/battle-spec.md`, and
      tests (fixed seed, once per battle, the HP doubling, the revert).
      *Dependencies:* none. *(Batch 7)*
- [ ] **[Task-20] The Rotom appliances as evolutions.** Rotom's five appliance
      formes are in the dex as species of their own — `rotomheat`, `rotomwash`,
      `rotomfrost`, `rotomfan`, `rotommow` in `src/data/dex/species.json`, each with
      its own stats,
      type and `Levitate` — but they carry no `prevo` and no `evolutions`, so the
      family graph never shows them (`evolutionFamily`, `src/data/dex/evolutions.ts`)
      and there is no way to reach one from a Rotom. Make them an evolution the
      player takes by click, the way every other one works (`D38`; the STATS tab
      graph, `src/ui/evolutionGraph.ts`): Rotom gains a branch per appliance and the
      click applies the forme change, keeping the member's level, nature, IVs/EVs,
      moves, PP, status and held item. **One-way, Eevee-style**: Rotom picks one
      appliance and keeps it, like Eevee's eight branches — the base form offers all
      five, a forme offers none. The branches take the base form's stage level
      (`speciesEvolutionLevel` → 20) through `evolutionLevel`, so there is no level
      left to decide. The forme data is hand-authored — `evolutionOf` in
      `scripts/build-dex.mjs` only reads the dex's `evos`, which is empty here — so
      the task says where that override lives. Keep the fixed-seed evolution tests
      green.
      *Dependencies:* none. *(Batch 8)*
- [ ] **[Task-21] The Megas as information in the STATS graph.** The family graph
      draws evolutions only (`evolutionGraph`, `src/ui/evolutionGraph.ts`), and a
      Mega is not one: it is battle-only (`D34`, `src/engine/battle/mega.ts`) and
      entered from a stone. So a member whose species has a Mega shows no trace of
      it in the STATS tab. Add the Mega as an **information row** hanging off its
      base species:
      the forme's sprite and name plus "Mega Evolves while holding <stone>", drawn at
      the same indent as an evolution — and **never clickable**, with no pointer
      cursor and no `ready` node, because nothing about the member changes here. The
      data already exists: `megaFormsForBase` (`src/data/dex/megas.ts`) returns every
      Mega of a species in dex order (Charizard's two included) and each carries
      `stoneName`, with the stone built per forme in `src/data/items.ts`. So the
      graph gains a node kind, not a new source. **Several Megas are several rows**,
      branching off the base species the way Eevee's eight evolutions do, so
      Charizard shows `Mega Charizard X` and `Mega Charizard Y` side by side, each
      with its own stone. One call left to make: how the row reads when the member
      does **not** hold the stone (dimmed with the same text, or hidden). A
      Gigantamax forme, if that task lands, is the same kind of row. Docs:
      `docs/design-spec.md` §3 and `docs/battle-spec.md` §9; graph tests for the new
      rows.
      *Dependencies:* none. Task-20 (The Rotom appliances as evolutions) rewrites
      `src/ui/evolutionGraph.ts` first, and Task-18 (Gigantamax) adds a row of the
      same kind in Batch 7. *(Batch 9)*
- [ ] **[Task-54] The Mart always stocks four rows: a 10× ball pack, a Potion and two held
      items.** Reported in play: «en la tienda siempre que hayan 4 objetos, un pack de 10x
      pokeballs precio asequible, 1 pocion precio medio asequible y 2 objetos equipables ya mas
      caros segun el objeto» — the shop must always show exactly four rows, in that order, with
      the pack cheap, the potion middling and the two **held** items priced by the item.
      **Today the stock is a fixed core plus a roll, and its size is 3 to 5.** `buildShop`
      (`src/ui/shop.ts`, 30-44) starts from `SHOP_CORE[band]` — two or three **fixed** ids per
      band, a ball, a potion and often a cure (`src/data/shop.ts`, 12-19: `mid` is
      `['greatball','superpotion','antidote']`, `end` is `['ultraball','fullrestore','fullheal']`)
      — then draws `rng.int(SHOP_ROTATION_COUNT.min, SHOP_ROTATION_COUNT.max)` = **one or two**
      (`SHOP_ROTATION_COUNT`, 137; drawn at 33) weighted picks without replacement from
      `SHOP_ROTATION[band]` (35-39, `weightedIndex` 47-56, one `rng.int(0, total - 1)` per pick),
      skipping ids the core already holds (32). So the panel shows **3, 4 or 5** rows, its
      rotation mixes held items, berries **and X-items/status cures** (the pools at 34-134:
      `early` is `antidote`, `oranberry`, `xattack`), and **no 10× pack exists anywhere**:
      `ShopSlot` is `{ itemId, price }` (`src/ui/shop.ts`, 23) with no unit count, `buyItem`
      (62-65) adds exactly one unit (`addItem(spendMoney(run, slot.price), slot.itemId)`), and
      `addItem` already takes a count (`src/engine/run/state.ts`, 526) — so a pack is one
      argument away, not an item row. Prices live on the catalogue: `ItemDef.price`
      (`src/data/items.ts`, 7-15, read by `buyPrice` 472-474): Poke Ball **200**, Great Ball
      **600**, Ultra Ball **1200**, Potion **300**, Super Potion **700**, Hyper Potion **1200**,
      Full Restore **3000**, and the held catalogue runs 100 (Oran Berry) to 4000 (the
      competitive held set).
      **The panel needs no change, and that is what makes this a balance task.**
      `refreshShop` (`src/scenes/RouteScene.ts`, 5585-5626) draws whatever `buyRows` returns —
      `row.name`, `¥row.price`, `x{row.owned}` — and `shopTotal()` (5677-5679) is
      `shopStock.length`, so a four-row stock with a pack label falls out of the model. The stock
      itself is rolled once per map on `new Rng(hashSeed(\`${seed}:shop:${mapIndex}\`))`
      (`openShop`, 5457-5461) and `shopStock` is **never saved**, so the draw shape may change
      with **no** `SAVE_VERSION` step and no migration — but a seed's stock changes, which is
      the fixed-seed subject below.
      **Fix shape, as the recommended reading** (the spec freezes the exact names):
      1. `SHOP_CORE` shrinks to the band's **ball and potion only** (a `{ ball, potion }` pair or
         a two-element list — freeze one). The potion row is the band's own heal rung, i.e. the
         `kind: 'heal'` core entry it already carries: `potion`, `superpotion`, `superpotion`,
         `hyperpotion`, `hyperpotion`, `fullrestore`. **Consequence to report:** every cure then
         leaves the buy list (Antidote, Full Heal, and Full Restore from `end`), so status cures
         reach a run from loot and mini-boss rewards alone — the open question below asks whether
         that is wanted.
      2. A new table beside it, `SHOP_BALL_PACK: Record<BandId, { itemId; count; price }>`, sells
         the band's own ball in a pack of **ten** at a discount. Recommended prices — ten ball at
         **half** price, snapped to a round hundred: **Poké Ball ¥1,000 / Great Ball ¥3,000 /
         Ultra Ball ¥6,000**. Measured against the income the report calls "asequible":
         `trainerMoney` (`src/engine/run/reward.ts`, 15-25) pays an archetype's base + jitter
         scaled by `TRAINER_MONEY_BAND_SCALE` (`src/data/trainers.ts`, 17-24), so an Early
         trainer pays **¥50-175** and map 1's ~11 trainers pay **≈¥550-1,900 on a full clear,
         typically ≈¥1,200** — one floor's money, so a ¥1,000 pack is a real trade-off rather
         than a formality. A steeper discount is
         the alternative; the sheet records whichever ships.
      3. `SHOP_ROTATION`'s pools keep only `kind === 'held'` rows — the berries and the held
         items they already list — so the X-items and the cures leave them, and **every band must
         keep at least two distinct held rows**: `early` lists only `oranberry` today (36-42), so
         it gains at least one more from the catalogue (the status berries at 200 are `held` rows
         already). `SHOP_ROTATION_COUNT` goes away, or is pinned to exactly **2** — freeze one.
      4. `buildShop` returns exactly **four** slots in a fixed order — pack, potion, held, held —
         and draws the two held rows as today's weighted picks **without replacement** over the
         held pool: two `rng.int(0, total - 1)` draws and the `rng.int(1, 2)` count draw gone.
      5. `ShopSlot` gains `count: number` (defaulted `1`, so every existing construction and test
         stays valid), `buyItem` adds `slot.count` units (`addItem(run, slot.itemId, slot.count)`),
         and `ShopRow`/`toRow` (86-109) carry the same `count` with the pack's label
         (`10x Poke Ball` — freeze the wording) while `owned` stays the bag's own count.
      **Tests.** `src/data/shop.test.ts`: the four rows per band, the pack table's ids/prices, the
      held-only rule, at least two held rows per band, and the re-pinned
      `SHOP_ROTATION_COUNT` case (44-46). `src/ui/shop.test.ts`: `buildShop`'s determinism and the
      fixed order (19-30 re-pinned), exactly four rows for every band, no repeat between the core
      rows and the two held ones, `buyItem` on the pack adding **ten** units and charging the pack
      price, and `buyRows`'s pack label (81-90). `src/data/loot.test.ts` (49-64) reads
      `SHOP_ROTATION` for reachability and for the `D16` no-op rule and **must stay green** —
      re-pin only if a pool row moves. Fixed-seed regression, which AGENTS.md requires for
      anything touching the RNG: for a fixed seed the stock is stable across calls and across
      band ids, is always four rows, and its two held rows are distinct and drawn from that
      band's held pool.
      **Docs:** the shop bullet in `docs/maps-spec.md` §7 (206-208: "a **fixed core** … plus
      **one or two random items**", and O-M5 at 264-266 if it names the core) becomes the four-row
      stock; and `docs/balance/economy.md` — the sheet that records the reasoning while the
      numbers live in `src/data/*` — gains the pack prices, the per-band potion rung, the held
      tiers and the note that the cures now come from the ground and the rewards only.
      Out of scope: the Mart panel's layout and input (`SHOP_ROWS`, the tabs, the cursor,
      `activateShop`'s own message — `RouteScene`), the **sell** side (`sellPrice`, `sellRows`,
      `sellableStacks`, unchanged), the money a trainer drops, the loot pools, the mini-boss
      reward, the TMs and their price (Task-22's), the Mega Stones, the valuables and the Plates
      (never sold), and `isForSale`'s `price > 0` rule.
      *Dependencies:* none — the shop model, the catalogue prices and the money streams are all
      shipped, and the task adds no state, so **no** `SAVE_VERSION` step. Batch order covers it:
      it needs `src/data/shop.ts`, `docs/maps-spec.md` and `docs/balance/economy.md` free at once,
      which is **Batch 5b** and nowhere earlier (Batch 5's Task-22 holds the shop table, Batch 6's
      Task-17 holds `docs/maps-spec.md` and Task-09 holds the `docs/balance/` sheets), and it runs
      **before Batch 6** so Task-09's balance pass tunes the stock that ships. *(Batch 5b)*

## Phase 10 - Learnset, TMs & move typing

> The learnset panel, the TM catalogue and the effective-type rules shipped;
> these are the follow-ups (`D36`/`D37`).

- [ ] **[Task-23] Item-driven move retypes: Multi-Attack, Techno Blast, Natural
      Gift.** Judgment and the seventeen Plates already hook `onModifyMoveType`
      (`plateHandler`, `src/engine/battle/effects/items.ts`) and show the same type in
      the FIGHT menu and in the party panel (`effectiveMoveType` and its `judgeType`
      helper, `src/engine/battle/moveType.ts`); the other three item-driven retypes are
      still unmodelled. **Their moves do exist in this build**: `multiattack`,
      `technoblast` and `naturalgift` are all in `src/data/dex/moves.json`, each
      `isNonstandard: "Past"` — `D42` ships every real move, the `Past` ones included —
      so nothing here waits on a future dex. Implement them on the Plates' seam: the
      held-item data in `src/data/items.ts` (Multi-Attack's Memories, Techno Blast's
      Drives, and the berry each Natural Gift reads), the handlers in
      `src/engine/battle/effects/items.ts` (a move-scoped type, as `plateHandler` has,
      with Natural Gift consuming the berry it read), the panel rule in
      `src/engine/battle/moveType.ts` so the panel agrees with the battle, their rows
      in `docs/balance/effect-coverage.md` (`D16`), and the tests in
      `src/engine/battle/moveType.test.ts` and `src/engine/battle/effects/items.test.ts`.
      Make the new entries obtainable the way Task-07 made the rest
      (`src/data/loot.ts`, `src/data/shop.ts`, `src/ui/rewards.ts`). Two data facts to
      work from: the **berries already carry** their type and power in
      `src/data/dex/items.json` (`naturalGift: {basePower, type}`, 53 berries), while
      the **Memories and Drives do not** — `scripts/build-dex.mjs` drops every
      nonstandard item — so their type mapping is hand-authored in the catalogue, with
      the names and icons Task-07 brings over from Añil
      (`sprite-sources/anil/PBS/items.txt`).
      Out of scope: **the Plates' own obtainability** — `Task-07` makes them drop
      as loot; this item only wires the retype they already hook.
      *Dependencies:* Task-07 (The competitive held items, with Añil's icons) — it
      settles the `ItemDef` fields and the handler registration in the two files this
      task extends. The `src/engine/battle/moveType.ts` seam is merged (Task-25, Batch
      2), so this task extends it rather than waits on it. The three moves' rows in
      `docs/balance/effect-coverage.md` are the generated table Task-06 shipped
      (Batch 1) — read, not waited on. *(Batch 8)*
- [ ] **[Task-38] The learnset band scrolls instead of paging.** Reported in play, in the
      detail window's MOVES tab: the pool under the search field moves in **pages** — four
      cells at a time, with a `<` / `>` pair and a `1/3` counter on the search row — and the
      human wants it to **scroll continuously** instead. The band itself shipped in Phase 10
      (archived: "The MOVES tab gains a learnset band: search, learned moves and bag TMs,
      dragged onto the four slots"), and the paging is exactly what that task built: this is
      a follow-up on shipped work, not a new rule.
      **Today's code, all in `src/scenes/RouteScene.ts`:** `HUD_DETAIL_LEARN_PAGE_SIZE = 4`
      (370) is the page size and `HUD_DETAIL_MOVES_H = 560` (371) the panel height that
      fits the band; `refreshLearnset` (2673-2732) slices the filtered pool to one page
      (`pool.slice(this.hudLearnPage * HUD_DETAIL_LEARN_PAGE_SIZE, (this.hudLearnPage + 1) *
      HUD_DETAIL_LEARN_PAGE_SIZE)`), hands that slice to `hudLearnGrid.layout({ cells, info:
      null, popupAtCell: true })` and stores it in `hudLearnPageEntries` (declared 861-862,
      read only by the drag at 3221-3226); the controls are `hudLearnPrev`/`hudLearnNext`
      (the `<`/`>` `BitmapText`s built 2021-2022) plus `hudLearnPageText`, laid out on the
      search row right-aligned (2712-2728) — which is why the search field's `setMaxWidth`
      reserves 78px (2687); `learnNavAt` (3239-3248) hit-tests them within 16px of the glyph
      and `handleDetailPointerDown` tests them **before** the field (3173-3180) →
      `stepLearnPage(±1)` (3250-3257); the counter reads `${this.hudLearnPage + 1}/${pages}`;
      and `hudLearnPage` is reset in `openMemberDetail` (3142), clamped in `refreshLearnset`
      (2693) and zeroed by every search keystroke (`typeInDetailSearch`, 3297/3300). The one
      scroll in the HUD today is the **PC box's wheel**: the `'wheel'` handler at 1294-1301
      gates on `pointerInBoxPanel(pointer)` and calls `stepBoxPage(dy > 0 ? 1 : -1)`.
      **Expected:** the pool is a **window that moves**, not a page that flips: no page
      counter and no page-step; the offset re-clamped whenever the filtered pool shrinks (a
      search that leaves three entries must not leave the window past its end); the last row
      reachable and the whole pool reachable without a second control. The band keeps the
      shared `MoveGrid`'s 2x2 cells and their rects, so the window is a whole number of the
      grid's own rows: the offset is in **rows of two cells**, the view shows two of them,
      and the clamp is `max(0, ceil(pool.length / LEARN_COLS) - LEARN_ROWS)`; the mouse wheel
      over the band scrolls it, mirroring the PC box's handler and its
      `pointerIn…Panel`-style gate. The clamp is the off-by-one-prone half, so it goes in a
      pure helper with a test — `src/ui/scroll.ts` (`maxScrollTop`, `clampScrollTop`,
      `scrollByRows`, names frozen in the spec), the way `moveGrid` and `mapView` carry
      their own geometry — and the pool's own model (`src/engine/run/learnset.ts`) does not
      change: the pool is and stays a flat list.
      **Files:** `src/scenes/RouteScene.ts`, the new `src/ui/scroll.ts` + `scroll.test.ts`
      with its one role line in `src/ui/README.md` (the per-folder convention Task-02
      froze: a new file updates that folder's README in the same task),
      `docs/design-spec.md` §3 (line 73's "a search field and a **paged** grid") and
      `docs/tech-decisions.md` `D36` (line ~520, "a search field and a paged, full-width
      grid") — one writer each, and both say the band scrolls with a clamped offset once
      this lands. `hudLearnPageEntries` is renamed to the visible window.
      Out of scope: the battle's moves menu (`docs/design-spec.md` §4's "all four moves show
      at once, with no scrolling" is about its four slots, not this pool), the search
      field's filter semantics, the clicked-cell drag's own behaviour (Task-39 anchors the
      band's ⓘ to a visible row), and the PC box's paging, which keeps its tabs.
      *Dependencies:* none. Batch order covers it: Batch 5's Task-16 restyles the band's
      windows and Batch 6's Task-17 writes both doc files, so the band is re-chromed and
      re-documented once **before** this task moves its window — which is why it sits in
      Batch 6b rather than beside them. *(Batch 6b)*
- [ ] **[Task-55] The MOVES panel draws four slots, and a TM can be learned into an empty
      one.** Reported in play: «en moves añadir los 4 contenedores aunque no tenga 4 moves porque
      se debe poder aprender un move de mt teniendo 3 moves actualmente si arrastras al hueco lo
      debe aprender» — the MOVES panel must always draw **four** slots even when the member has
      fewer than four moves, so a learnset cell dragged onto an **empty** slot teaches the move
      there.
      **Today the grid draws one cell per move, and the engine is already ahead of it.** The
      shared `MoveGrid` (`src/ui/moveGrid.ts`) is fixed at `GRID_CELLS = 4` **objects** (67-68)
      and `layout` (184-306) hides every piece past the cell list (`if (!cell) { this.hidePiece(i);
      continue; }`, 210-217) and **only pushes a rect for a cell that exists** (`cellRects.push`,
      218) — so `cellRects` is as long as the list, and `indexAt` (316-322), `cellRect` (325-327)
      and `infoAt` (330-336) answer for the real moves alone. The route HUD's MOVES tab passes
      `cells: detail.moves.map(...)` (`src/scenes/RouteScene.ts`, 2403-2433) — one cell per move —
      and the learnset drag's release asks `detailMoveIndexAt` → `hudMoveGrid.indexAt`
      (3434-3439), then calls `equipMove` (3066-3082, the call at 3073). With a three-move member
      a cell dropped on the fourth container therefore hits **nothing**: `indexAt` returns null
      and `equipMove` is never reached. The model half is already shipped —
      `equipMove` (`src/engine/run/learnset.ts`, 115-136) **appends** when `slot >= moves.length`
      ("A drop on the tail (an empty slot past a short moveset) appends", 131-134) and
      `src/engine/run/learnset.test.ts` (79-82) already pins it — and what a member may equip is
      derived, not stored: `learnsetPool` (66-86) lists every level-up move its species knows at
      its level minus the four slots, plus the bag TMs. `MAX_MOVES` is 4
      (`src/engine/run/progression.ts`, 40).
      **A short moveset is reachable today and becomes common one batch later.**
      `defaultMoveset` (`src/engine/battle/fighter.ts`, 380-393) pads to four only at or below
      `FULL_MOVESET_BY_LEVEL = 5` (311) through `padMoveset` (346-373), so above level 5 a species
      whose learnset knows fewer than four moves gets that many; `adoptAtLevel`, `editRunPokemon`
      and the dev menu produce short lists too; and Task-56 (the batch after this one) stops the
      level-up from filling all four, so the empty container becomes the ordinary case.
      **Fix shape:** a slot model, not a cell list.
      - `MoveGridCell` gains an `empty?: true` marker (or `MoveGridOptions` gains a `slots: 4`
        count — freeze one), and `layout` draws an empty container: the cell rectangle and its
        stroke, **no** name, badges, PP/PWR/ACC or ⓘ, and its rect pushed into `cellRects` so
        `indexAt`/`cellRect` answer for it. The empty container is a **drop target only**: a press
        on it must not `grabMove` (there is nothing to reorder, and `reorderMoves` clamps to
        `moves.length - 1`, `src/ui/partyDetail.ts` 232-245) and it must not float the ⓘ.
      - The route HUD passes four cells always — `detail.moves` padded with empty ones to
        `MAX_MOVES` — so the release path above lands on slot 3 and `equipMove` appends; a drop on
        an occupied slot keeps replacing it, which already works. The `no moves` text stays for a
        member with **no** moves at all (`src/scenes/RouteScene.ts`, 2404).
      - The battle's FIGHT menu is the same grid: `openMoves` (`src/scenes/BattleScene.ts`,
        1232-1264) builds one item per move and `renderMoveMenu` (1967-2038) one cell per item
        (its zone is disabled for an index past the list, 2019-2028), so a two-move Pokémon shows
        a two-cell menu. The written reading is that it draws the four containers too, with the
        empty ones **unselectable** (there is no move to use); the alternative — the route HUD's
        MOVES tab alone — is the open question below.
      **Files:** `src/scenes/RouteScene.ts`, `src/scenes/BattleScene.ts`, `src/ui/moveGrid.ts`,
      the **new** `src/ui/moveGrid.test.ts` (the file does not exist today, so this task creates it
      and owes its one role line in `src/ui/README.md`, the per-folder convention Task-02 froze),
      and `docs/design-spec.md` §5: line 71's "the four slotted moves" and 77-78's "A cell is
      dragged onto a slot to equip it (replacing what sits there)" become "an empty slot takes it
      and the move is appended". No engine rule, no RNG draw and no run field, so **no**
      `SAVE_VERSION` step and no fixed-seed test; the four slots are `MAX_MOVES`, not a new
      constant.
      **Tests.** `src/ui/moveGrid.test.ts` covers the pure half: four rects for a short list,
      `indexAt` inside an empty container, no hit outside the four, and the empty cell drawing no
      ⓘ. QA reproduces the report in `npm run dev`: a member with three moves and a matching TM
      in the bag, drag the learned cell onto the fourth container → the slots show four moves, the
      new one is there, and the TM is still in the bag (reusable, D36).
      Out of scope: the learnset band's window and its paging/scroll ([Task-38], Batch 6b — shipped
      by the time this runs), its ⓘ ([Task-39], Batch 9 — which deleted `MoveGrid.infoRect` and
      left one classifier), the STATS tab and its evolution rows, `equipMove`'s own rule, the
      reorder clamp, the level-up rule ([Task-56], the batch after this one), and the battle's
      empty containers becoming selectable.
      *Dependencies:* none — `equipMove`'s append, `MAX_MOVES` and the shared `MoveGrid` are all
      shipped. Batch order covers it: it needs `src/scenes/RouteScene.ts` and
      `src/scenes/BattleScene.ts` together, and every batch from 5 to 17 holds the route scene
      (and all but 6b and 17 hold both), so it opens the plan's new **Batch 18**; its
      `docs/design-spec.md` §5 is Task-50's in Batch 16 and free here, and it is written against
      Task-38's scrolled band and Task-39's single ⓘ classifier. *(Batch 18)*
- [ ] **[Task-56] A move learned on a level-up waits in the learnset; it is never equipped for
      you.** Reported in play: «al subir nivel y aprender ataque no se debe equipar en los 4
      actuales debe quedarse en learnset y si quiere jugador se lo pone» — a move crossed on a
      level-up must **not** go into the four slots; it stays available in the learnset band and the
      player equips it if they want.
      **Today a level-up equips the move and, when the slots are full, forgets the oldest.**
      `levelUpPokemon` (`src/engine/run/progression.ts`, 256-283) is the whole rule: for every move
      crossed (`gainedMoves`, 184-203) it skips one already slotted, drops a move the No Guard
      guard forbids (269-270: "No Guard makes every move hit, so it must never pair with an OHKO
      move"), **shifts the oldest out** when `moves.length >= MAX_MOVES` and reports it (`forget`
      event, 273-276), then pushes the new move into the slots and reports `learn` (277-279). What
      "equip" means in the data is exactly that: the member carries a fixed four-slot array,
      `fighter.moves: MoveSlot[]` (`src/engine/battle/fighter.ts`, 144; cap `MAX_MOVES = 4`,
      `progression.ts` 40) and **no separate known pool is stored** — the pool is derived at read
      time, so a move that stops being auto-equipped appears in the band by itself (`learnsetPool`,
      `src/engine/run/learnset.ts` 66-86) and `equipMove` (115-136) is the only way into a slot.
      `docs/design-spec.md` §5 (77-78) already describes the band that way.
      **The one coupling this rule change has: the level-up modal reads the slots, not the
      events.** `levelUpBeats` (`src/ui/beats.ts`, 36-57) builds `learned` as the moves present
      after but not before and `forgotten` as the reverse (45-53), and `src/ui/beats.test.ts`
      (64-70) pins that diff. `resolveBattle` already returns the resolution's `learn`/`forget`
      events (`src/engine/run/resolve.ts` 79-90, from `gainExperience`, `src/engine/run/state.ts`
      229-250), but `RouteScene.applyBattleResult` destructures only `{ run, released, captured }`
      (5054-5061) and throws them away. So with the slots untouched that diff is empty: the modal
      would stop announcing the move (`showLearnPopup` builds its lines from `beat.learned` alone,
      4721-4738) — and Task-50's transient level-up notice (Batch 16) reads the same beat.
      `LevelUpBeat.learned` therefore **keeps its meaning** ("the moves crossed on the way up")
      and only its **source** moves.
      **Fix shape:**
      1. `levelUpPokemon` stops writing the slots — it keeps its `level` event and pushes one
         `learn` event per crossed move, with **no** `moves.push`, **no** `moves.shift` and so
         **no** `forget` event ever; the member's `moves` is returned untouched, so a level-up
         never changes what the battle menu lists.
      2. The band becomes the only equip path, so the **OHKO/No Guard guard moves there**:
         `learnsetPool` must not offer an OHKO move to a No Guard holder (or `equipMove` must
         refuse it) — otherwise the pair the engine forbids becomes reachable by dragging.
      3. The beat is fed from the events: `levelUpBeats` gains the resolution's
         `readonly ProgressionEvent[]` (a third argument, or the scene folds them — freeze the
         signature) and fills `learned` from the `learn` events of the members that levelled;
         `forgotten` is always empty — keep the field (recommended, so nothing that reads the
         shape moves) or delete it, and re-pin `beats.test.ts` either way.
      4. `applyBattleResult` passes the events through to `playLevelUp`'s beat list (5054-5061,
         5109 and 5112).
      The modal's copy is a decision, not a question: recommended is the same `X learned Y!` line,
      because the move really was learned and the player must open MOVES to use it — and Task-50's
      own open question already settles that the modal stays beside the transient notice.
      **Tests.** `src/engine/run/progression.test.ts` re-pins the two cases at 68-103: a level-up
      learns its move, the four slots are **unchanged**, no `forget` event is emitted, and the
      full-slots case no longer forgets anything. `src/engine/run/learnset.test.ts` gains the two
      band cases: a move crossed on a level-up is offered by the band and is equipped only through
      `equipMove`; a No Guard holder is not offered an OHKO move. `src/ui/beats.test.ts` re-pins
      `learned` from the events and adds the empty case (a level-up with no `learn` event reads
      `learned: []`). `src/engine/run/resolve.test.ts` is re-pinned only if it asserts a member's
      moves after a fold. No RNG is involved, so no stream moves and no fixed-seed re-pin.
      **Docs:** `docs/battle-spec.md` §7 (106-108, "every member levels with it, learning the moves
      the learnset says at that level") gains the sentence that a crossed move joins the learnset
      band and the player equips it, and that nothing is ever forgotten; `docs/design-spec.md`
      §5's level-up sentence changes only if the copy does (free here).
      Out of scope: `defaultMoveset`'s padding at level 5 and below and the catch's rebuild
      (`adoptAtLevel` — a catch still arrives with a full moveset, the "a catch joins at the squad's
      level and power" rule, `docs/battle-spec.md` §7 121-123), the learnset band's window
      ([Task-38]) and its ⓘ ([Task-39]), the four containers ([Task-55], the batch before this
      one), the modal's own layout and the transient notice ([Task-50]), the dev menu's edit path,
      and the evolution rule (D38).
      *Dependencies:* none — the events, the derived pool and the beat are all shipped. Batch order
      covers it: it wants `src/scenes/RouteScene.ts` (free only from Batch 18 on, and Task-55's
      there), `src/engine/run/progression.ts` with its test (Task-42's in Batch 5, re-pinned by
      Task-51 in Batch 5b), `src/engine/run/learnset.ts` (nobody's) and `src/ui/beats.ts` with its
      test (Task-40's in Batch 9b), so it opens the plan's new **Batch 19**; it is written
      **against** Task-40's beat and Task-50's notice rather than beside them, and it adds no run
      field — an older save's members keep the moves they hold — so **no** `SAVE_VERSION` step.
      *(Batch 19)*

## Phase 11 — Localisation (i18n)

> English is the source table; a locale overlays it by key. New decision `D43`.

No player-facing string is translated today: every one is a literal in a scene or
a UI helper. The target is English plus Spanish.

- [ ] **[Task-26] i18n module and the Spanish locale.** A pure, headless-tested
      locale layer (`src/i18n/`: a typed key table, `en` as the source, `es` as an
      overlay, and a `t(key, params)` with named interpolation, no Phaser import),
      plus the sweep that moves every literal behind a key: the main menu, the
      starter pick, the settings screen, the run-over screen, the route HUD (party,
      bag, PC box, detail, pause, capture, Mart, reward), the battle menus and
      messages, and the dev panel. A `language` setting in `src/engine/save.ts` —
      defaulting from the browser locale and applied without a `SAVE_VERSION`
      bump, like `alwaysRun` —
      with its row in `src/ui/settingsScreen.ts`. Tests: `en`/`es` key parity both
      ways, no unresolved interpolation, and the settings round-trip. Scope call to
      take here: **the dex's own names stay English** (`@pkmn/dex` ships English
      only), so localising Pokémon, move, ability and item names is a separate and
      much larger job. Needs `D43` in `docs/tech-decisions.md` and a line in
      `docs/design-spec.md` §7; `AGENTS.md`'s "game text in English" convention
      becomes "English is the source table, a locale overlays by key".
      *Dependencies:* none. Scheduled last: it moves every player-facing literal
      behind a key, so it must see the panels Task-12, Task-13 and Task-16 add.
      *(Batch 10)*

---

## Bugs

Reported in play, awaiting triage. A bug becomes a task in the batch plan, and the
fix is archived in `CHANGELOG.md`. `[PENDING FIXES]` below is a different list: what
a finished batch still owes QA.

Three reports arrived in one sitting and were triaged into the plan in the same pass, so
nothing waits here: the learnset band's page controls (`[Task-38]`; the report itself is
"must scroll, not paginate", against the band Phase 10 shipped), the ⓘ that is dead on
hover in the battle's MOVES window and dead both ways in the learnset band (`[Task-39]`;
the same button was reported dead once before and the fix is recorded in `CHANGELOG.md`),
and the battle's missing entry beat (`[Task-40]`, a wish rather than a defect — one opening
for a wild encounter, another for a trainer). Each carries its repro, its file-level
diagnosis and its fix shape in its own entry above, and nothing is left in this inbox.

Six more arrived together and were triaged in the same pass, so nothing waits here either.
Four are defects of what already shipped: a **catch is healed** on the way into the run,
because the fold rebuilds the member at full HP (`[Task-42]`; the location is
`adoptAtLevel`, `src/engine/run/progression.ts`, and the battle's own snapshot is innocent —
it carries the wild's real HP); the ability **Run Away works but its ⓘ lies**, floating the
dex's competitive-play blurb ("No competitive use.") over a port the coverage table marks
`port` (`[Task-43]`; `abilityDescription` reads the dex text and never a game-side one); the
PC box has **no place for the dead at all**, because surrender deletes them and keeps only a
counter (`[Task-44]`; `releaseFainted` filters them away and `RunState` remembers nothing);
and a lost run lands on the **starter pick** instead of the main menu (`[Task-46]`;
`RunOverScene`'s one confirm calls `scene.start('Starter')`). Two are wishes rather than
defects: the party's **lead should walk behind the player** with its idle and its running
animation, from the committed `src/assets/pokemon/**` sheets nothing reads yet (`[Task-41]`),
and the **tall grass should move when the player steps through it**, FireRed-style, which
the tileset cannot do today because `TilesetConfig` has no animation contract (`[Task-45]`).
Each carries its repro, its file-level diagnosis and its fix shape in its own entry above.

Three more arrived together and were triaged in the same pass, so nothing waits here either.
One is a defect of what the main menu shows: the Continue row prints `Route <n>`, the run's
global room counter, where the player asked for the **map and its biome** — and the party's
own portraits are missing from the row (`[Task-47]`; the string is built by `rowValue`,
`MainMenuScene` 130-134, while `biomeForMap` and `portraitFor` are both shipped). Two are
balance/UX wishes rather than defects: the run's **first wild Pokémon should be much easier
to catch**, ignoring its species' own catch rate for that first capture (`[Task-48]`; the
rate is read straight off the dex in `attemptCapture`, `capture.ts` 35, and the run already
knows whether it has caught anything through `stats.catches`), and **obtaining an item should
raise a temporary popup** like the catch notice Task-31 adds, top of the screen and
self-dismissing (`[Task-49]`; every pickup is silent today — `collectItemAt` and
`chooseMiniBossReward` just fold the item in and repaint — and `src/ui/notice.ts` does not
exist until Task-31 creates it). Each carries its repro, its file-level diagnosis and its fix
shape in its own entry above.

A fourth round of **two reports** arrived together and was triaged in the same pass, so
nothing waits here either. One is a **defect of the level-up feedback**: a level-up that
crosses no move shows nothing on the route, because the popup only builds lines from
`beat.learned` and returns hidden otherwise (`[Task-50]`; `showLearnPopup`, `RouteScene`
4721-4738, returns early at 4732) — and the popup it *does* open is a key-dismissed modal,
not the temporary notice the report asks for. The other is a **balance/rules rework**, not a
bug: the species whose real evolution is not a level-up are pinned to a constant 20 / 30 by
`speciesEvolutionLevel` (`src/data/dex/evolutions.ts` 63-70, `STAGE_EVOLUTION_LEVEL =
[20, 30]`), so Primeape — obtained at Mankey's own 28 — evolves again at 30 (`[Task-51]`);
the report wants the level to follow the species' **BST**, at 20 / 30 / 40, with at least
**+10 levels** between one evolution and the next. Each carries its repro, its file-level
diagnosis and its fix shape in its own entry above.

A fifth round of **two reports** arrived together and was triaged in the same pass, so nothing
waits here either. One is a **rule the wild table is missing**: the tall grass can roll a
species the run has already caught — including one that has since died, because
`releaseFainted` (17-29) deletes the member and the run keeps no record of the species at all
(`[Task-52]`; `RunStats` is only a counter, `state.ts` 25-33, `recordCatch` 496-499, and the
table is the band's BST pool alone, `encounterTableFor` → `speciesPool`, `encounters.ts`
16-18 / `pool.ts` 35-46, built at `RouteScene` 1163-1172) — and the report wants it never to
roll that species, nor any of its evolutions, nor any of its forms (regional forms included);
the fix adds a run record and therefore a `SAVE_VERSION` step. The other is a **presentation
wish**, not a defect: the battle's HP panels show a name, a level, the bar and the status
badge and no type (`[Task-53]`; `drawSidePanel`, `BattleScene` 1604-1663, writes all of it and
puts the name the last row before the bar at 1616-1618), while the Añil badge atlas the
starter cards and the move cells already draw (`typeIconFrame`, `src/data/typeIcons.ts` 13-23)
is loaded for the whole game and the fighter the panel shows already carries live `types`.
Each carries its repro, its file-level diagnosis and its fix shape in its own entry above.

A sixth round of **four reports** arrived together, and **three of them wait here only as
registered tasks**: nothing is left in this inbox. One is an **economy defect of what the Mart
sells** — the stock is a fixed core plus a roll, so a floor shows **3 to 5** rows with no 10× pack
anywhere (`[Task-54]`; `buildShop`, `src/ui/shop.ts` 30-44, `SHOP_CORE` 12-19 and
`SHOP_ROTATION_COUNT` 137 over a rotation that mixes held items with X-items and cures, while
`ShopSlot` has no unit count and `buyItem` 62-65 adds exactly one). One is a **defect of the MOVES
panel**: with fewer than four moves the grid draws fewer cells, so the fourth **container does not
exist** and a TM cell dragged onto it is never learned (`[Task-55]`; `MoveGrid.layout` 184-306
only pushes a rect for a cell that exists, so `indexAt`/`cellRect` answer for the real moves alone
— `cellRects.push`, 218 — and the drop path is `RouteScene.detailMoveIndexAt` 3434-3439 →
`equipMove` 3066-3082, while `equipMove` itself already **appends** into an empty slot,
`src/engine/run/learnset.ts` 131-134). The other is a **rules complaint about the level-up**: a
move crossed on a level-up is pushed straight into the four slots and, when they are full, the
oldest is **forgotten** (`[Task-56]`; `levelUpPokemon`, `src/engine/run/progression.ts` 267-279,
the `moves.shift()` at 273-276) where the report wants it left in the learnset for the player to
equip. Each carries its repro, its file-level diagnosis and its fix shape in its own entry above.

The round's **fourth report is not a bug and not a task**: «…para piso 1 me he cargado todos los
entrenadores menos el boss pero solo he subido 1 nivel» is a **measurement against a task that has
not run yet** — `[Task-09]` (Balance pass) is open in Batch 6 — and the shipped curve is doing what
it says: map 1's cap is **6** (`levelCapForMap`, `src/data/maps.ts` 104-106) and a fresh starter
is level **5** (`START_LEVEL`, `StarterScene` 27), so **one level is that floor's whole cap**, whose
bar is 91 XP (`xpForLevel = level³`). The measured numbers — XP per trainer at band 1, what a floor
delivers, and the sheet's own `A(1)` disagreeing with `curve.test.ts`'s average — are written into
`[Task-09]`'s entry, which is where the decision they raise belongs.

A seventh round of **one report** arrived after that and is triaged in the same pass, so nothing
waits here either. It is a **presentation wish**, not a defect: a trainer battle shows nothing
about the team behind the active Pokémon, because the HP panel builder draws the name and level,
the HP bar and the status badge and then stops (`[Task-57]`; `drawSidePanel`,
`src/scenes/BattleScene.ts` 1604-1663) — the report wants a Poké Ball drawing under that panel for
every Pokémon the trainer has left, emptied as they faint, the way the cartridges show the
opponent's team. Every piece it needs already ships: the enemy bench is `BattleSide.party` with a
fainted fighter left in it at `hp = 0` (`src/engine/battle/state.ts` 53-56, read as "still
fighting" by `hasHealthy` 217-219), `BattleState.isWild` says whether there is a trainer at all,
and the ball frame is the packed Añil item atlas's own (`itemIconFrame('pokeball')`,
`src/data/itemIcons.ts` 14-16 / 29-36), already drawn by the capture throw at 950-990. It carries
its repro, its file-level diagnosis and its fix shape in its own entry above.

---

## [PENDING FIXES]

Written by QA. The format is fixed — one entry per task. Empty means nothing is red.

```markdown
- [ ] **[TASK-<ID>]:** <one-line description>
  - **Expected:** ...
  - **Actual / error log:** ...
  - **Affected path:** ...
```
