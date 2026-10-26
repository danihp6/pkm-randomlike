# PokeRandomLike — Roadmap (TODO)

Browser Pokémon roguelike: procedural routes, classic menu battles, permanent
death. Backlog source of truth. One branch per task off `main` (`feature/...` or
`task-<ID>` for an agent batch).

Legend: `[ ]` open, `[~]` in progress, `[!]` **blocked** (the mark carries its
`BLOCKED: <reason>` in the item, and the cycle skips it — `docs/agent-ci.md` §Task states).
Only open work lives here; completed items
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

**Batch 5, Batch 5b, Batch 5c, Batch 5cb, Batch 5d, Batch 5e, Batch 5eb, Batch 5f, Batch 6,
Batch 6b and Batch 7 are
shipped and
archived.** Their
twenty-six
tasks merged
in ID order
behind the green gate (four, then five, then three, then one, then one, then one, then one, then
one, then four, then two, then three) and the
detail is
in
`CHANGELOG.md`'s
`## Unreleased`; Batch 5b is the batch that ended up packing the decomp's real FireRed grass
rustle, Batch 5c the one that re-planned the level curve and laid that overlay over the player's
legs, Batch 5cb the defect in front of 5d that fixed its colour and clipped its hit, Batch 5d
the on-ramp thinning, Batch 5e the fixed boss and mini-boss parties, Batch 5eb the debug
overlay's teleports and its two ignore toggles, Batch 5f the overworld sprite set, Batch 6
the balance pass, the Phase 9 docs, the battle SWITCH grid and the follower, and Batch 6b the
learnset band's one-row scroll and the trainer's Poké Ball row, and Batch 7 the G-Max
formes, the route-scoped catch swap and the main
menu's Continue row, and all
eleven are closed
below. The
eighteenth round below put the
follower back in Batch 6 and gave its art its own batch, 5f, ahead of it. Every
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
  and no two tasks in it create or modify the same path — **except a `docs/*.md`
  file, which two tasks may share when the Architect gives each a disjoint section**
  (`AGENTS.md`'s **Docs are claimed by section**). A batch is a label on the open
  items, not a rewrite of the backlog. Batches run in order: a task's branch is
  cut from `main` once every earlier batch is merged, and the Orchestrator merges one
  task at a time, in ID order. A cycle takes the lowest pending batch **whole** and
  **must attempt to fill** it with tasks from later batches under the same antichain
  rules (`AGENTS.md`'s **Parallelism is the default** and **Batch filling**), up to
  four: the cut is the floor, not the ceiling, so a one-task batch does not waste the
  other dev slots — and a slot that cannot be filled names the constraint that
  blocked it.
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
(Batch 5b), Task-70 (Batch 5d), Task-71 (Batch 5e), Task-41 (Batch 6, kept there by the eighteenth
round below), Task-31 (Batch 7), Task-39 (Batch 9), Task-40 (Batch 9b),
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
chrome as the dark glass card the human picked from `chrome-options.html`) claims
`src/scenes/RouteScene.ts` **and every other
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
reads the battle's own state — and the ninth and tenth rounds' **six** reports extend that
same `src/scenes/RouteScene.ts` queue into six new one-task batches, **Batch 21** to **Batch
26**, because every one of the six wants that one scene and Batch 20's Task-58 is its last
holder; none of the six adds a run field, so the chain stays **14 → 15 → 16 → 17 → 18**.
**This paragraph is the master list of that one scene's queue**: the eighteenth round below
leaves `Task-41` in **Batch 6**, where it was cut, so the queue runs 6 → 28 unbroken — the
round's new art task, `[Task-76]`, opens its own single-task **Batch 5f** in front of Batch 6
and claims no scene at all — and the per-entry lists written before that round still read
`6 Task-41`, which is correct as they stand. The twenty-seventh round extends that same queue one
task per batch to **Batch 50** and adds the plan's next five steps, and the twenty-eighth round
below adds the queue's last link, **Batch 51**, so it now runs 19 → 51 and the `SAVE_VERSION` chain
reads **14 → 15 → 16 → 17 → 18 → 19 → 20 → 21 → 22 → 23**; its own paragraph and table are below.
The **thirty-third round** (Phase 16, Batches 75–80) adds the queue's next four links — Batch 75's
`[Task-164]`, Batch 77's `[Task-176]`, Batch 79's `[Task-180]` and Batch 80's `[Task-179]` — so it
reads 19 → 51 → 75 → 77 → 79 → 80, and it adds **no** `SAVE_VERSION` step at all: `main` reads **25**
(`src/engine/save.ts` 77) and every one of the nineteen refuses a new run field on purpose — the last
of them **removes** two (`pcCatch`, `entryDeparted`) instead.

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
debug panel is dark with light text. **The look is no longer the overlay's own, though: it is
the `t-glass` card of `chrome-options.html`**, the dark glass direction the human picked over
the full debug match, the frame-only variant, the slate flat variant and Task-16's set — the
surface at **0.72**, a **1px hairline** instead of the overlay's 2px accent, an **11px** corner,
the accent kept for selection and controls only, and **no real blur** (Phaser has no
`backdrop-filter`; the tokens are frozen in `[Task-58]`'s entry). Every container the chrome
carries
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
check instead of re-running Task-08 — the one question of the eighth round that its answer did
not settle.

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

A **ninth round** of **three reports** arrived after that one, and between them they add **no
dependency edge** and **no `SAVE_VERSION` step**; what they add is **six more claims on
`src/scenes/RouteScene.ts`** and one on `src/scenes/BattleScene.ts`. The first is a **defect of
the boss win**, reproduced before it was written: `applyBattleResult` rebuilds the boss room
through the **room-change** path when the boss falls (`transitionTo`, 5107 → 4437-4454), which
repositions the player on the room's entry door (`this.player = { ...this.route.entry }`, 4449)
although the run's map position never moved — `[Task-61]`, the round's only defect and the one
report of the two rounds that is a bug rather than a wish. The other two are wishes against
shipped seams: a trainer or boss room's battle should be able to begin under a weather, a
terrain or a room condition, with dense fog (−20 accuracy), Gravity and Trick Room among them
and the route drawing an animation or filter for it (`[Task-62]`; the four effects except fog
all ship in `src/engine/battle/**` but `createBattle` seeds none of them, `state.ts` 159-162 /
`BattleSetup` 120-128), and a beaten mini-boss should also offer **three unidentifiable
Pokémon** beside its item rows, presented by their highest stat and their nature (`[Task-63]`;
the reward window is items only, `openMiniBossReward` 5715-5731 over `rewardChoices`,
`src/ui/rewards.ts` 10-32, while a run-seeded ability/moveset and the catch's own placement
already ship, D17). All three want `src/scenes/RouteScene.ts`, which **every** batch from 5 to
20 holds (5 Task-16, 5b Task-45, 6 Task-41, 6b Task-38, 7 Task-31, 8 Task-08's every-scene
sweep, 8b Task-35, 9 Task-39, 9b Task-40, 10 Task-26, 11 Task-29's ledger, 12 Task-30, 13
Task-44, 14 Task-48, 15 Task-49, 16 Task-50, 17 Task-52, 18 Task-55, 19 Task-56, 20 Task-58's
whole-chrome pass), so a batch can hold only one of them and they open **Batch 21**, **Batch
22** and **Batch 23**, one task each. `Task-62` additionally wants `src/scenes/BattleScene.ts`
(free after Batch 20, and held by 5, 5b, 6, 6b, 7, 8, 8b, 9, 9b, 10, 11, 12, 14, 17, 18 and 20
before that) and the battle engine's own setup seam, and `Task-63` wants `src/ui/rewards.ts`;
the two are also the round's only claims on `src/data/` (Task-62's condition table) and on the
`docs/` files (`docs/maps-spec.md` §6/§7 and `docs/battle-spec.md` §4), all free from Batch 21
on. Nothing here re-plans `Task-38`–`Task-60`, and Batch 4b is untouched: it is `cut`, so it can
gain no member.

A **tenth round** of **three reports** arrived after that one, and between them they add **no
dependency edge** and **no `SAVE_VERSION` step** either; what they add is **three more claims
on `src/scenes/RouteScene.ts`** and three on the **special-room layer** — `src/engine/maps/
plan.ts` (`MapRoomSpecial`, 70) and `src/ui/mapView.ts` (`MapRoomMarker`, 26). All three are
**wishes** rather than defects, and all three are new special rooms in the shop/mini-boss
mould (a dead-end leaf with only its own content, `docs/maps-spec.md` §7): a **casino** room
with a Team Rocket grunt, a pay-per-spin slot machine whose prizes are items and an **egg**
that yields a random Pokémon when the run advances a floor, and a chance of a battle that locks
the machine (`[Task-64]`); a **gated reward room** whose reward sits behind bushes, rocks or
water that only a party **of the right type** opens — Bug or Grass, Rock or Fighting, Water
(`[Task-65]`); and a **trade room** where a Pokémon is given for a random one (`[Task-66]`).
Because they share the route scene
**and** both halves of the special-room layer, no two can sit in a batch: they opened **Batch
24**, **Batch 25** and **Batch 26**, one batch apart. Batch 24 and 25 ran one task each; Batch
26 was **filled** with the NPC sprite packer and the out-of-battle abilities, so it shipped three
tasks wide. `Task-64` is the one of the
round that may repack the FRLG overworld/trainer atlases (a new `rocket` archetype's two
sprites), `Task-65` may add obstacle frames to the FRLG tileset atlases and the run's first
**party-predicate** module (`partyHasType`, which `[Task-91]`'s NPC gate extends), and `Task-66`
the run's first deliberate member **removal** beside
permadeath's — none of the three touches `src/engine/save.ts`, and the recommended reading of
the casino's per-floor lock and its egg is a bag item, so the chain stays **14 → 15 → 16 → 17 →
18**. Nothing here re-plans `Task-38`–`Task-63`, and Batch 4b is untouched: it is `cut`, so it
can gain no member.

An **eleventh round** of **one report** arrived after that one, and it adds **no dependency edge**
and **no `SAVE_VERSION` step**; what it adds is one more claim on `src/scenes/RouteScene.ts` and
one on `src/scenes/BattleScene.ts`. It is a **wish** rather than a defect: a room whose effect is
that the player cannot use items and cannot use healing moves (`[Task-67]`; the BAG is the
player's alone — `validateBag`, `src/engine/battle/commands.ts` 80-87 — and the healing moves the
engine models are named by id in its entry). It wants the two scenes together and the special-room
layer (`MapRoomSpecial`, `src/engine/maps/plan.ts` 70) that Task-64, Task-65 and Task-66 already
extend in the three batches before it, so it opens the plan's new **Batch 27**, one batch behind
Task-66 — and it cannot ride beside Task-62, which holds both scenes and the battle-start seam in
**Batch 22**. It adds no run field, so the chain stays **14 → 15 → 16 → 17 → 18**. Nothing here
re-plans `Task-38`–`Task-66`, and Batch 4b is untouched: it is `cut`, so it can gain no member.

A **twelfth round** of **one report** arrived after that one, and it adds **no dependency
edge** and **no `SAVE_VERSION` step**; what it adds is one more claim on
`src/scenes/RouteScene.ts`, one on `src/engine/run/learnset.ts` and one on the two docs that
record the MOVES tab's own operations. It is a **wish** rather than a defect: the route HUD's
MOVES tab should be able to **delete an equipped move** (`[Task-68]`; the tab is the detail
panel's `'moves'` mode — `DetailTab`, `src/ui/partyDetail.ts` 26, the `MOVES` label at
`RouteScene` 1911 — and its equip seam is a learnset-band cell dragged onto a slot,
`equipMove`, `src/engine/run/learnset.ts` 115-136). It wants `src/scenes/RouteScene.ts`,
which **every** batch from 5 to 27 holds (5 Task-16, 5b Task-45, 6 Task-41, 6b Task-38, 7
Task-31, 8 Task-08's every-scene sweep, 8b Task-35, 9 Task-39, 9b Task-40, 10 Task-26, 11
Task-29's ledger, 12 Task-30, 13 Task-44, 14 Task-48, 15 Task-49, 16 Task-50, 17 Task-52, 18
Task-55, 19 Task-56, 20 Task-58, 21 Task-61, 22 Task-62, 23 Task-63, 24 Task-64, 25 Task-65,
26 Task-66, 27 Task-67), so it opens the plan's new **Batch 28**, the first batch that leaves
the route scene free at all — and its second path, `src/engine/run/learnset.ts` with its test,
is Task-56's in Batch 19 and free from Batch 20 on. It runs **after** Task-56 (Batch 19),
whose rule makes the learnset the only equip path, so the slot it empties stays empty instead
of being refilled by the next level-up. It adds no run field — a member's moves are already
persisted — so the chain stays **14 → 15 → 16 → 17 → 18**. Nothing here re-plans
`Task-38`–`Task-67`, and Batch 4b is untouched: it is `cut`, so it can gain no member.

**The level curve is re-planned, and it is a decision rather than a report.** After a design
discussion the human chose the shape Batch 5c implements: a finite run becomes **eight maps
that end at level 55** instead of six that end at 40, with a first floor of **2–9** (cap 9,
which is +4 for the level-5 starter) and steps of seven levels narrowing to six as the levels
rise. The reason the alternative was rejected is arithmetic the repository already carries:
`xpForLevel` is `level³` (`src/engine/run/progression.ts` 47-50), so today's six floors need
91 / 1115 / 3582 / 8911 / 18944 / 31232 XP and the whole run to 40 is **64 000** — while a
constant ten-level step to 100 would spend **271 000 XP on its last floor alone**, nine times
today's entire run. The same decision answers the question `[Task-09]` had open about a floor
worth a single level (it is not the wanted shape) and hands Task-09 a curve to tune instead of
a curve to design; its entry records that. The rework landed in **Batch 5c**, now shipped, because
`docs/balance/route-curve.md` was Task-51's in 5b and the `docs/balance/` sheets are Task-09's
in Batch 6, and a second task — **Batch 5d**, the batch cut next at the time — thins maps 1-2 so the on-ramp is
gentler before
Task-09 reads it. `Task-70` runs one batch behind `Task-69` on purpose: it re-reads the walk
that task solved and re-pins it, and it writes the same `src/data/run.ts` rows and the same
`src/engine/run/curve.test.ts` — a batch is an antichain, so those two could not ride together,
which is why the re-plan went first.
Neither adds a run field or a rule the save carries, so the chain stays **14 → 15** (Task-13,
shipped) → **15 → 16** (Task-31, Batch 7) → **16 → 17** (Task-44, Batch 13) → **17 → 18**
(Task-52, Batch 17), and nothing here re-plans `Task-38`–`Task-68` or touches Batch 4b, which
is `cut` and can gain no member.

A **thirteenth round** of **two reports** arrived after that one, and **neither adds a dependency
edge** and **neither adds a `SAVE_VERSION` step**; between them they add one more claim on
`src/scenes/RouteScene.ts`, one on `src/engine/maps/plan.ts` and **a new batch, 5e**.
`Task-71` (a boss always fields six Pokémon and a mini-boss three, with map 1's own 2 and 3) is
the round's one new task: it wants the route scene — where the boss and mini-boss rosters are
built —
which `Task-70` holds in **5d**, and `docs/maps-spec.md` §6, which `Task-69` (§4/§5, **5c**) and
`Task-70` (§7, **5d**) already write in the two batches before it, so it cannot join either and
opens the plan's new **Batch 5e**, one batch behind 5d — still **before Batch 6**, so Task-09's
balance pass reads the fixed parties and Task-17's docs pass reads the settled `docs/maps-spec.md`
§6 and `docs/battle-spec.md` §7. It keeps its numbers out of `src/data/run.ts` and
`src/data/maps.ts` on purpose — both are `Task-69`'s in 5c — by putting them in a new
`src/data/bosses.ts` beside its test, plus a `count` option on `trainerRoster`
(`src/engine/run/roster.ts`): that is the arbitration that keeps three consecutive batches an
antichain. The round's **second** report — map 1 hangs fewer routes — is **folded into
`[Task-70]`**, which already owns that floor's on-ramp: it widens 5d's claim with
`src/engine/maps/plan.ts` + `plan.test.ts`, `src/ui/mapView.test.ts`, `docs/maps-spec.md` §7 and
`docs/design-spec.md` §7, and it takes the cheap reading the entry freezes — **map 1 hangs no
shop leaf** (a shop with no money is dead weight) — rather than dropping the regular room count,
which the guaranteed core does not allow. Nothing here re-plans `Task-38`–`Task-70`, both
batches are new so nothing already cut gains a member, and Batch 4b stays `cut`.

A **fourteenth round** of **one report** arrived after that one, and it adds **no dependency
edge** and **no `SAVE_VERSION` step**: `Task-72` (the battle panels' **type badges** bigger, on
both the active Pokémon's panel and the rival's) read the row the now-archived `[Task-53]`
shipped and changed only its drawn size, so it claimed `src/scenes/BattleScene.ts` alone — no
`src/data/**`, no `src/ui/**` module, no `docs/` line, no state. It took **the earliest batch
that left that file free**, and that was **Batch 5c**: its `Task-69` claimed no scene at
all, while 5d's `Task-70` held `src/scenes/RouteScene.ts` and 5e's `Task-71` held the battle
scene. So 5c took a second member and stayed an antichain — the two shared no path — and it
shipped with the batch. The two consequences the entry measured are why it was not a one-line
change: the band's growth took both panel heights with it (134 -> 150 and 168 -> 184 at the
default x2), and
the compact layout's clearance above the player panel is the same budget QA failed `[Task-53]` on
once, so the entry holds the 0-px invariant and names the knob. Nothing here re-plans
`Task-38`–`Task-71`, and Batch 4b stays `cut`.

A **fifteenth round** of **one report** arrived after that one, and it adds **no dependency edge**
and **no `SAVE_VERSION` step**: `Task-73` — «arregla animacion hierba sale por encima de
personaje», answered with **«igual que juego original»** — was the rustle the now-archived
`[Task-45]` shipped drawing **over the character** instead of at their feet. It claimed
`src/scenes/RouteScene.ts` alone, and that file was free in **Batch 5c** (whose
Task-69 owned `src/data/` and the docs and whose Task-72 owned `src/scenes/BattleScene.ts`) while
5d's `Task-70` and 5e's `Task-71` already held it — so **5c was the earliest batch that left
the file free**, and it took the task as its third member; all three still shared no path. It
needed three cuts and shipped in the batch (see the batch's summary above). Nothing
here re-plans `Task-38`–`Task-72`, and Batch 4b stays `cut`.

A **sixteenth round** of **one report** arrived after that one, and it is a **defect** rather than a
wish; it adds **no dependency edge** and **no `SAVE_VERSION` step**. `Task-74` — «nada mas
entrar el fondo se pone de otro color creo no se usa el fondo tile del bosque si no de prado por
eso es un verde mas claro» — is the tall grass's overlay painting the **outdoor palette's** blades
over the forest's dark tuft, and it is a **palette mismatch, not a wrong tileset**: the three
committed atlases decode to `78,160,99` (cell 5) in `outdoor` and `cave` against `59,125,76` in the
`forest`, while the rustle cells (6, 45-48) carry the **outdoor** numbers in all three fields, so
only the forest — the one biome `BIOME_ORDER` walks — shows it. The fix the entry freezes is a
**per-field `grassRustleTint`** in the tileset data (`0xC1D7EF` for the forest, none for the other
two, derived from the two means), applied by the scene to the one overlay sprite: no repack, only
the blades are tinted (the alpha still lets the field's own ground through), and the criterion is a
measured one on the committed cells (the parked cell no more than 6 lighter than that field's tuft
and no more than 30 darker; the four hit cells within ±30). The rejected reading — remapping the
five frames' palette per field in the packer — is named with its costs (a repack of the three
atlases and a per-field recolour map). Because the repo cuts a **defect in front** of the batch
behind it (`[Task-33]` was "the bug batch cut in front of Batch 4"), it opened **Batch 5cb**, the
letter following the batch it extends the way `4b` follows `4`, one batch ahead of **5d** — and it
**shipped** there. Its
paths were `src/engine/tileset.ts`, `src/data/tilesets/frlg.ts` + `frlg.test.ts`,
`src/scenes/RouteScene.ts` (two lines) and `docs/tileset-spec.md` §6 — all of them free there, since
the route scene is claimed by 5d and 5e only in the batches after it — so the batch was a single
task and an antichain. Nothing here re-plans `Task-38`–`Task-73`, and Batch 4b stays `cut`.

A **seventeenth round** of **one report** arrived after that one, and it is a **dev-tool** request
rather than a play report; it adds **no dependency edge**, **no run field** and **no
`SAVE_VERSION` step**. `Task-75` — «añade tarea para añadir a debug input para hacer tp entre pisos,
entre rutas y a posicion concreta en la ruta — y boolean que permite ignorar salvajes y otro para
ignorar entrenadores» — gives the debug overlay three teleports (floor, room, tile) and two
booleans (no wild encounters, no trainer sight). It claims `src/dev/debugMenu.ts` + its test,
`src/scenes/RouteScene.ts` and **`src/main.ts`** (every handler in this tree is wired there, not in
the scene), and it reuses the shipped transitions (`advanceMap`/`advanceRoute`, `transitionTo`,
`movePlayerTo`) instead of inventing a second way to change rooms. The route scene was held by
**5cb** (cut when this report landed, now shipped) and is held by **5d** and **5e**, so the earliest slot that leaves it free
is one behind 5e — the plan's new **Batch 5eb**, which takes the letter of the batch it follows the
way `4b` follows `4` and `5cb` follows `5c`. Because the toggles are dev-only and unsaved, a run
they are on no longer matches its seeded stream (a skipped roll spends no draw); the entry states
that plainly instead of pretending the stream is untouched, and it also freezes that the boss and
the mini-boss **are** trainers for the toggle's purposes — so the toggle stops their sight too, and
the portal stays sealed until the boss falls (D31). Nothing here re-plans `Task-38`–`Task-74`, and
Batch 4b stays `cut`.

An **eighteenth round** is **two decisions**, not reports: the human settled the two questions
the plan was still carrying, and neither of them is a bug. **`[Task-34]`'s grid is answered.**
The battle SWITCH window becomes **six rows of a fixed cell size that never stretches to fill the
panel**: one row per party member in a **single column**, each row exactly a sixth of the
window's content height, so a party of two draws two rows and leaves the rest of the panel
**empty** rather than two giant cells — and the row's contents (the avatar, the name and the HP
bar) scale **down to the row** instead of the row growing around them, because a sixth of the
menu panel's 192px content is only ~19px. The other reading the entry carried — the 3-column
avatar grid (`PARTY_COLS`) with its cell height merely capped at a sixth — is **rejected**, and
the question bullet it had below is gone. **`[Task-76]` is registered and gets its own batch in
front of `[Task-41]`.** The human wants overworld art for **every** species and form, so the
follower no longer
waits on "a lead with no sheet draws nothing" — it waits on a new **art** task that fetches the
PMDCollab packs into the gitignored `sprite-sources/` and packs the missing frames into the
committed `src/assets/pokemon/<id>.png` + `<id>.json` pairs (the 652 that ship today are dex
**nums 1-649** — some of them still the procedural placeholders `generate-pokemon.mjs` seeded —
**plus Castform's three Forecast formes** at `35101`-`35103`; the plan's older wording called
those three "Deoxys formes", and the repository's own table says otherwise), reusing the
dependency-free pipeline `scripts/legacy-art/` already carries (`fetch-pmdcollab.mjs`,
`zip-codec.mjs`, `pmdcollab-species.mjs`, `extract-real-sprites.mjs`), adapted to this repo's
paths, to argv-passed absolute source directories (the Legend's **Asset trees** rule) and to a
**coverage manifest** the follower resolves a species id through. **`Task-76` opens its own
single-task batch, the new `Batch 5f`, cut immediately in front of `Batch 6`** — one art task,
so the follower is written against art that has already merged rather than beside the task that
packs it. It shares no path with Task-09's `docs/balance/` sheets and its `golden.test.ts`
harness, with Task-17's five docs or with Task-34's `src/scenes/BattleScene.ts`, and it takes
`src/assets/README.md` plus `docs/art-direction.md`
for the provenance the repo records for its other imported art; it adds **no** `SAVE_VERSION`
step, so the chain stays **14 → 15 → 16 → 17 → 18**. **`Task-41` therefore stays in `Batch 6`,
where it was cut, as that batch's fourth task** — the slot its own art no longer needs — because
Batch 6 is already the first batch that leaves `src/scenes/RouteScene.ts` free (5c's Task-73,
5cb's Task-74, 5d's Task-70, 5e's Task-71 and 5eb's Task-75 each held it in the batches before),
and nobody in it claims its new `src/data/` accessor or its `src/render/` module. Its
dependency now points at `Task-76`'s committed pairs and coverage manifest **one batch earlier**,
so the question that
asked what a lead with no art draws becomes a **fallback for the ids that manifest lists as
missing** instead of the ordinary case for every Gen 6+ species. `src/assets/README.md` is
`Task-76`'s and `Task-41` must not claim it — the follower only **reads** the committed
`src/assets/pokemon/**`, which is Batch 5f's generated output and no Batch 6 task's path.
Nothing else in the plan moves,
no batch that is already `cut` gains a member, and the two decisions add no run field.

A **nineteenth round** of **one report** arrived after that one, and it adds **no dependency
edge** and **no `SAVE_VERSION` step**: «quita la barra de xp del contenedor de combate» — the
battle's player panel draws a **second, smaller bar** under the health bar, and it goes. It is
**presentation**, not a defect and not a rule: the row is `drawSidePanel`'s player branch
(`src/scenes/BattleScene.ts`, 1747-1760) — `drawGauge(this.hud, barX, barY + 36,
FRLG_HPBAR.width, 8, experienceFraction(this.xp, fighter.level), 0x60a5fa)` plus the
`` `XP ${this.xp}` `` label at `barY + 46` — and everything it reads is the scene's own: the
`xp` field (255-256, assigned from `launch.xp` at 448) and the `xpText` `BitmapText` (313, built
at 589), whose only other mention is the foe branch that hides it. Nothing under
`src/engine/**` moves: `experienceFraction` (`src/engine/run/progression.ts` 59) is what the
**route HUD** draws its own bar with (`RouteScene`, 2106-2107), and `D35`'s rule — the squad
shares **one** bar — is untouched, because the bar it means is the route HUD's. `[Task-77]`
claims `src/scenes/BattleScene.ts` and one clarifying line in `docs/design-spec.md` §4 (171-174,
the "one XP bar" bullet in the battle's own section: the rule stays and the sentence gains only
*where* that bar is drawn), and it takes **the earliest batch that leaves that scene free**:
Batch 6b is `cut` and can gain no member, and every batch from 7 to 14 holds the file (7
Task-18's Gigantamax, 8 Task-08's every-scene sweep, 8b Task-35, 9 Task-39, 9b Task-40, 10
Task-26's every-scene sweep, 11 Task-29's ledger — `src/scenes/BattleScene.ts` is line 140 of
`.prettierignore` — 12 Task-30, 13 Task-59, 14 Task-48), while 15's Task-49 claims the route
scene, the notice module, `docs/routes-spec.md` §2 and the i18n files instead. So **Batch 15**
takes a second member and stays an antichain, and its one doc line is free there too. The one
number the report does not settle is the panel's own height — `PLAYER_PANEL_H = 184` (88, "Tall
enough for the padded name row, the types band, the bar and the XP row") against the foe's 150,
which is the same content without that band — so the entry freezes the panel to **150** and the
question below carries the alternative. It lands **before** the scene's three later claimants,
so their own "free" lists lose 15: Task-60's (Batch 17) reads 13, 16, 17 and 19 from here and
its choice of 17 is unchanged, Task-55's (Batch 18) parenthetical reads "Task-48 held it in
Batch 14, Task-77 in 15 and Task-60 in 17", and Batch 18's shape paragraph lists 6b, 13, 16 and
17 as the batches that leave that scene alone. Nothing here re-plans `Task-38`–`Task-76`, and
Batch 4b stays `cut`.

A **twentieth round** is a **design discussion**, not a report, and it registers **six tasks** —
`[Task-78]`–`[Task-83]` — that no batch above contains; the Architect cuts their batch on the next
planning pass, so nothing is scheduled here yet. The human's play reading is that a floor is
**unfair at its edges**: a trainer's level is drawn uniformly across the map's whole band
(`trainerRoster`, `src/engine/run/roster.ts` 55), so map 1 drops a level-9 trainer on the level-5
starter and map 2 a level-16 on a squad entering at 9 — while the room ramp `docs/maps-spec.md` §5
already promises is honoured by **wild encounters** alone (`roomLevelForMap`, `RouteScene` 1294).
The round therefore makes the roster read its **room's** level with a party-size penalty
(`[Task-78]`), caps a **wild** encounter by the party's own level (`[Task-79]`), re-spaces the finite
ranges and starts map 1 at the starter's level (`[Task-80]`), gives a room its **size from its shape**
— a square `cross`, a wide or tall `corridor` (`[Task-81]`), replaces the population pass with a
**fixed number of trainer rooms per floor** (`[Task-82]`) and re-solves the XP curve against the new
floor budgets (`[Task-83]`). It adds **no `SAVE_VERSION` step** — every task is plan, data,
presentation or the award rule's own measurement, and none adds a run field — so the chain stays
**14 → 15 → 16 → 17 → 18**. `[Task-79]` is the one whose rule is not settled: whether a wild's cap
rides the lead's level or the party's highest, and by how much, is the open question the round
records in the Bugs section below. Nothing here re-plans `Task-38`–`Task-77`, and Batch 4b stays
`cut`.

A **twenty-first round** of **one report** arrived after that one, and it adds **no dependency edge**
and **no `SAVE_VERSION` step**: «al abrir panel pokemons las teclas de moverse mueven en el panel de
party no quiero eso que siga solo sirviendo para mover personaje» (`[Task-84]`). It is **not a
defect**: the arrows browsing a focused HUD pane is the shipped keyboard-play rule of
`docs/design-spec.md` §10.3 (the accessibility pass, `[Task-08]`), so the report is a **decision
change** — the movement keys must keep moving the character and never move a cursor inside the party
panel. It claims `src/scenes/RouteScene.ts` and no state, so the chain stays
**14 → 15 → 16 → 17 → 18**, and nothing here re-plans `Task-38`–`Task-83`. Its seam and the doc lines
that move with it are in its own entry below.

A **twenty-second round** of **one report** arrived after that one, and it adds **no dependency
edge** and **no `SAVE_VERSION` step**: the human wants the hidden item's faint sparkle replaced by a
**concrete floor tile per biome** (`[Task-85]`) — for the forest, **frame 41**, of the five frames the
forest floor draws (`0` base, `1`, `2`, `41` and the flowered `42`; preview
`sprite-sources/forest-floor-tiles.png`), removed from the normal floor mix. It claims
`src/engine/tileset.ts`, `src/data/tilesets/frlg.ts`, `src/scenes/RouteScene.ts` and
`src/scenes/BootScene.ts` (the sparkle texture it retires) and no state, so the chain stays
**14 → 15 → 16 → 17 → 18**, and nothing here re-plans `Task-38`–`Task-84`.

A **twenty-third round** is an **instruction** rather than a report, and it adds **no dependency edge**
and **no `SAVE_VERSION` step**: «elimina las habilidades de transformación de formas para pasar estos
pokes a Formas Independientes / Evoluciones (Directas o Ramificadas)», «Cramorant como formas,
Terapagos linea evo, Ogerpon formas», «elimina las habilidades que su funcion sea cambiar forma a x
poke» and «para Cherrim y Castform quiero que sus evos tenga un boost de stats». It registers
**`[Task-86]`**, a seventeen-species sweep: every species whose other forme is reached by a battle
ability — Eiscue, Palafin, Meloetta, Wishiwashi, Morpeko, Cherrim, Minior, Castform, Zygarde, Darmanitan
and Darmanitan-Galar, Aegislash, Mimikyu, Greninja, Cramorant, Terapagos and Ogerpon (Rotom already
ships as the template, `[Task-20]`) — gets its formes as hand-authored `forme` branches, the
forme-changing abilities are **deleted outright**, and Cherrim's and Castform's evolved formes gain a
stat boost. It claims `src/data/dex/**` (the `FORM_EVOLUTIONS` override), the ability registry,
`randomAbility.ts`, the dex build and the docs, and no state, so the chain stays
**14 → 15 → 16 → 17 → 18**. Nothing here re-plans `Task-38`–`Task-85`.

A **twenty-fourth round** is **two instructions**, and neither adds a dependency edge nor a
`SAVE_VERSION` step. `[Task-87]` — a consumable must be spendable on a member from the route HUD, and
only when it does something («una pocion sobre alguien con toda la vida no o uno que quita estado
quemado si no esta quemado no») — fixes a small existing defect on the way: a Potion dropped on a member
is **equipped as if it were a held item**, because neither `equipHudItem` nor `equipHeldItem` reads the
item's `kind`. `[Task-88]` — Gigantamax must be stone-gated, the stone named `<Base>ite G`
(«venusorita g») — turns today's free G-MAX button into an item-gated one, minting one stone per G-Max
forme beside `MEGA_STONES`. Both add no run field, so the chain stays **14 → 15 → 16 → 17 → 18**, and
nothing here re-plans `Task-38`–`Task-86`.

A **twenty-fifth round** is a **design pivot** that re-shapes `Task-78`, `Task-79` and `Task-80` in
place: the per-floor **level ranges** go, and content keys off the squad's **own** level and the floor's
**cap**. The human's words: «igual es mas simple si en vez de rangos por piso usamos solo el cap y el
nivel actual del usuario? por ejemplo salvajes rango entre un 60 y 75% de nivel actual, entrenadores si
tiene un poke nivel igual al del player si tiene mas a un porcentaje segun el numero, y boss al cap».
Settled: **wilds `[0.60, 0.75] × squadLevel`**, **trainers `floor(squadLevel × 100/90/80/70 %)` for
1/2/3/4 members**, **boss and mini-boss at the cap**, and the **species band follows the squad level**.
It fits here because the squad already has **one** level (`squadLevel`, `D35`) and the game grows by
**catching**, not levelling, so the rubber-banding costs nothing. The price is two amended decisions —
`D11`'s "a fixed seed reproduces the chain" and `D17`'s "levels never draw from the player" — plus a
fixed-`(seed, squadLevel)` regression test, and `[Task-83]` re-solves the XP curve against the new
budgets. No run field, so the chain stays **14 → 15 → 16 → 17 → 18**, and nothing here re-plans
`Task-38`–`Task-88`.

A **twenty-sixth round** is **one instruction plus one frozen reading**, and it adds no dependency edge
and no `SAVE_VERSION` step. `[Task-84]`'s reading is **frozen**: in the route scene the panels are
**pointer-first** and the **only** keyboard surface left is the pause menu («solo teclas para pausa»).
`[Task-89]` turns the Mart and the mini-boss reward into **floating panels** like the HUD's, where
taking an item is a **drag onto the bag or a member**: a reward row disappears with its ground object
and the panel (equipping it if it is equipable), and a shop row buys, spending money — with an
unaffordable row simply **not draggable** («mart al soltar sobre mochila o poke restar monedas si no
tiene monedas no puede arrastrar»). Both add no run field, so the chain stays
**14 → 15 → 16 → 17 → 18**, and nothing here re-plans `Task-38`–`Task-88`.

A **twenty-seventh round** is not a report but the **largest content wave** the backlog has
taken, and it registers **nineteen tasks**, `[Task-90]`–`[Task-108]`, at the end of Phase 9. It
also **schedules every ID the last rounds left unbatched** (`Task-78`–`Task-89`) and cuts
**Batch 29 to Batch 50** (the round below extends that cut to **Batch 51**); nothing earlier is re-planned except the two empty slots the wave fills
(`[Task-86]` into **Batch 21** and `[Task-88]` into **Batch 23**), and Batch 4b stays `cut`.

**What the wave registers, and what it folds.** The special-NPC layer is six tasks: the FRLG
sprite set (`[Task-90]`), the per-NPC roll inside the trainer rooms `[Task-82]` introduces
(`[Task-91]`) and the NPC content grouped by what an NPC does — it replaces a room (`[Task-92]`,
the merchant), edits a member (`[Task-93]`: the move tutor, the nature/ability/IV re-rolls, the
species swap and the sacrifice's second ability), writes a run fact (`[Task-94]`: the exorcist,
the weather man, the magician and the type gate) or hands out an item or a battle (`[Task-95]`:
the medic, the chef, the berry tree and the Mega Stone on a win). The rooms and set-pieces are
`[Task-96]` (the static-species room and its legendary variant), `[Task-97]` (the secret shop),
`[Task-98]` (the floor missions), `[Task-99]` (the special trainers), `[Task-100]` (the boss
room's forced opening, sealed door and free heal), `[Task-101]` (the banned most-used species)
and `[Task-102]` (the puzzles). The rules are `[Task-103]` (the item wave, infinite held items
included), `[Task-104]` (the damage-model abilities and the four team-type bonuses),
`[Task-105]` (the out-of-battle passives) and `[Task-106]` (the room-effect table's second half,
which **extends** `[Task-62]`'s table instead of duplicating it). The last two are the **2vs2
boss fight**, cut as its engine (`[Task-107]`) and its screen (`[Task-108]`), because one task
would carry the whole battle engine and the whole battle scene. The mini-boss reward, the
casino, the trade room and the no-items room are **not** re-registered: they are `[Task-63]`,
`[Task-64]`, `[Task-66]` and `[Task-67]`, and the wave's entries name them wherever an NPC row
would otherwise duplicate one.

**The shape: one scene per batch, 19 to 52.** `src/scenes/RouteScene.ts` is claimed by
**every batch from 19 to 52**, one task each, because the wave adds fourteen more claims on it
(`[Task-103]`, `[Task-104]`, `[Task-106]`, `[Task-107]` and `[Task-90]` alone do not) and the
twenty-eighth round's `[Task-109]` adds the last link, **Batch 51**, with `[Task-110]` (the bag grid)
right behind it in **Batch 52**. The new
batches are therefore cut with one scene
task and the **non-scene** tasks ride beside it, each on a path the scene task leaves free:
`[Task-90]` with 84, `[Task-81]` with 87, `[Task-104]` with 89, `[Task-80]` with 82,
`[Task-83]` with 98 and `[Task-103]` with 102 — and `[Task-106]` was **filled into Batch 28**,
which leaves Batch 32 as `[Task-85]` alone (the fill is recorded in that batch's section). The two 2vs2 halves close
the plan's scene queue, engine first, and two more follow them: the area-entry notice
(`[Task-109]`, Batch 51) and the bag grid (`[Task-110]`, Batch 52).

**Run fields.** Five new tasks add one, and they take the next `SAVE_VERSION` steps in batch
order: `[Task-98]` (the mission record) **18 → 19**, `[Task-93]` (`taughtMoves` and
`secondAbility`) **19 → 20**, `[Task-94]` (`RunState.modifiers`) **20 → 21**, `[Task-101]`
(`battlesUsed`) **21 → 22** and `[Task-103]` (the candy's `statTreats`) **22 → 23** — so the
chain reads **14 → 15 → 16 → 17 → 18 → 19 → 20 → 21 → 22 → 23**. The other fourteen add none,
and `[Task-96]`'s legendary room deliberately derives "once per run" from the mission record
rather than from a new field.

**Collisions the cut settles.** The NPC tasks share `src/data/npcs.ts`,
`src/engine/routes/npcs.ts` and `src/ui/npcPanel.ts`, so no two share a batch. `[Task-92]`,
`[Task-96]` and `[Task-97]` share `src/engine/maps/plan.ts` and `src/ui/mapView.ts`, and
`[Task-92]` must precede `[Task-97]` (the merchant deletes the shop room the secret shop
replaces). `[Task-100]` and `[Task-106]` share `src/data/battlefields.ts` and
`src/engine/routes/battlefield.ts`. `[Task-86]` and `[Task-88]` share `src/data/dex/**` and
`scripts/build-dex.mjs`; `[Task-64]` and `[Task-90]` share the packed overworld atlas;
`[Task-64]`, `[Task-87]`, `[Task-88]`, `[Task-95]` and `[Task-103]` share `src/data/items.ts`;
`[Task-104]`, `[Task-106]` and `[Task-107]` share `src/engine/battle/damage.ts`, `state.ts` and
`turn.ts`; `[Task-98]`, `[Task-93]`, `[Task-94]`, `[Task-101]` and `[Task-103]` share
`src/engine/save.ts`. Each pair is one batch apart below.

**Two stale records the wave repairs.** `[Task-80]`'s `*Dependencies:*` read "none", which
contradicted its own diagnosis: the ranges only become dead weight once `[Task-78]` and
`[Task-79]` stop reading them, and deleting them first would break the roster's read, so the
edge is written in. And `[Task-62]`'s entry now names `[Task-106]` as its second half, so nobody
re-registers the radiant zone, the auras, the type change, Endure and the +50 crit. `[Task-65]`'s
`partyHasType` module is the seam `[Task-91]` extends (`partyHasType`, plus the
`partyHasMove`/`partyHasAbility` predicates that join it — never a second module), and
`[Task-89]`'s keyboard removal is the reading `[Task-84]` freezes.

A **twenty-eighth round** is **one report plus a plan-wide review**, and it adds **no dependency edge**
and **no `SAVE_VERSION` step**. The report — «añadir panel flotante temporal al entrar en una ruta
como en los juegos originales» — registers **`[Task-109]`**, an **area-entry panel** raised from the
room-change paths as a boxed banner, with its copy an i18n key, its builder a fourth string in
`src/ui/notice.ts` (per that module's own convention) and its one open reading — every room, or only
when the area changes — given the written default **every room**. It claims
`src/scenes/RouteScene.ts`, so it opens the new **Batch 51**, one batch behind the 2vs2 pair, and the
scene queue now runs **19 → 51** unbroken.

The review then walked **every open item** (`Task-28`, `Task-56`, `Task-58`, `Task-61`–`Task-68`,
`Task-78`–`Task-89` and `Task-90`–`Task-109`) against the graph, the batch labels and the hot files,
and repaired **nine records** without moving a single batch label — eight bullets below, since the two
stale batch sections share one:

- **`[Task-89]` gained an edge to `[Task-63]`.** Its drag takes the three unidentifiable Pokémon rows
  that task produces in `src/ui/rewards.ts` (Batch 23), which its own entry already assumed; the edge
  was prose rather than graph.
- **`[Task-99]` gained an edge to `[Task-98]`.** Its secret-battle row reads the mission record, a
  file and a type that Batch 36 produces — the one genuinely missing edge of the plan.
- **`[Task-103]` gained an edge to `[Task-106]`.** The Tera Crystal's holder override and the field's
  all-types override are the same "wherever a fighter's types are read" reader, so the earlier task
  freezes the seam the later one extends.
- **`[Task-95]` lost an edge to `[Task-65]`.** None of its four rows is party-gated, so it never reads
  the party-predicate module (`partyHasType`); the predicate family reaches it through `[Task-91]`'s
  `requires` gate. This is the plan's only invented edge.
- **`[Task-98]` grew the run-scoped `missionsCompleted` counter** that `[Task-96]`'s "once per run"
  reads, and claims `src/ui/notice.ts` + test and the two i18n tables, which its own text already used;
  nothing else in Batch 36 wants either file.
- **`[Task-97]`'s gate is recorded as re-read**: the human's answer makes it a **blocked room opened by
  a party of a named type** (a sibling of `[Task-96]`'s room rather than of `[Task-65]`'s move gate),
  so its edges are `[Task-92]` + `[Task-91]` / `[Task-96]` — all three earlier batches, and its own
  slot stays **Batch 44**.
- **`[Task-65]` gained the `**Docs:**` line it never had** — the special-room table's gated row in
  `docs/maps-spec.md` §7, the two obstacle cells in `docs/tileset-spec.md` §2/§6 and the
  `docs/design-spec.md` §7 bullet — which is what makes `docs/maps-spec.md` §7's holder list below
  count sixteen, and it is the only one of the three special rooms whose entry did not name its docs.
  Its *Decision* no longer closes `docs/route-generator.md` §7's **O-R5**: the human's answer turned
  the gate into a **type** gate, which is not the Cut/Rock Smash field-move key/flag gate that row kept
  out of scope, so that row stays open and the entry says so.
- **Batches 21 and 23 gained their second member's hot files.** Both sections still read "one task,
  alone" from their own cut, but `[Task-86]` joined 21 and `[Task-88]` joined 23 in the
  twenty-seventh round; each section now names the second holder's set — `src/data/dex/**` +
  `scripts/build-dex.mjs`, the ability registry, `src/scenes/BattleScene.ts` and the generated
  `docs/balance/effect-coverage.md` in 21, and the generated `gmaxes.json`, `src/data/items.ts`,
  `src/engine/battle/gmax.ts` and the STATS row's module in 23 — and says the batch is still an
  antichain. Those two were the only batch sections whose record had gone stale against the labels.

Everything else verified clean, and the review's measurements are these. **Antichains.** All 33
batches (`19`–`51`) hold exactly one `src/scenes/RouteScene.ts` claim and no two tasks share any
other path: the nine two-task batches (`21`, `23`, `29`, `30`, `31`, `32`, `35`, `36`, `47`) pair a
scene task with an engine/data/doc set the scene task never touches, and the remaining
twenty-four are single tasks. **Ordering.** Every edge points at a strictly earlier batch, so the
graph is acyclic and no task is scheduled before anything it depends on. **Hot files.** `package.json`,
`src/main.ts` and `vite.config.ts` are nobody's among the scheduled tasks (the one task that would
touch the first, `[Task-28]`, is the plan's unscheduled ID);
the generated and multi-claimed files each have one holder per batch — `src/data/dex/**` and
`scripts/build-dex.mjs` (`[Task-86]` B21, `[Task-88]` B23), the packed FRLG atlases (`[Task-64]` the
overworld and trainer sheets, `[Task-65]` the three tilesets, `[Task-90]` the overworld),
`docs/balance/effect-coverage.md` (`[Task-86]` B21, `[Task-104]` B31), `src/data/items.ts`
(`[Task-64]`, `[Task-87]`, `[Task-88]`, `[Task-95]`, `[Task-103]`), `src/engine/save.ts`
(`[Task-98]`, `[Task-93]`, `[Task-94]`, `[Task-101]`, `[Task-103]`), `src/engine/battle/state.ts`
(`[Task-62]`, `[Task-67]`, `[Task-104]`, `[Task-106]`, `[Task-107]`) with `damage.ts` and `turn.ts`
shared by `[Task-104]`, `[Task-106]` and `[Task-107]`, `src/engine/maps/plan.ts` and
`src/ui/mapView.ts` (`[Task-64]`, `[Task-65]`, `[Task-66]`, `[Task-67]`, `[Task-81]`, `[Task-82]`,
`[Task-92]`, `[Task-96]`, `[Task-97]`, `[Task-102]`) and `src/data/battlefields.ts` +
`src/engine/routes/battlefield.ts` (`[Task-62]`, `[Task-106]`, `[Task-100]`), as do the docs a wave
rewrites (`docs/maps-spec.md` §7 above all, sixteen holders one batch apart). **The i18n key table**
is the one hot file this wave adds, and it is claimed by one new task per batch (each scene task that
introduces a player-facing string); no two share a batch.
**The version chain** stays gapless and ordered: 14 → 15 → 16 → 17 → 18 (shipped) → **19**
(`[Task-98]`, Batch 36) → **20** (`[Task-93]`, 39) → **21** (`[Task-94]`, 40) → **22**
(`[Task-101]`, 46) → **23** (`[Task-103]`, 47); `[Task-109]` adds none, and the one ID in no batch is
still `[Task-28]`, blocked upstream.

A **twenty-ninth round** of **one report** arrived after that one, and it adds **no dependency edge**
and **no `SAVE_VERSION` step**: «falta traducir mensajes de accion durante la batalla». The message
box still speaks English in the Spanish locale because the battle's action lines are not keys but
**sentences the engine composes** — `pushText` (`src/engine/battle/state.ts` 348-350) stores
`{ kind: 'text', text }` (107-110) and `battleFrames` (`src/ui/feed.ts` 19-31) prints that string as
it stands — **194** call sites in **twelve** files (`effects/abilities.ts` 68, `turn.ts` 55,
`effects/moves.ts` 41, `effects/items.ts` 10, `effects/apply.ts` and `effects/conditions.ts` and
`commands.ts` 4 each, `effects/terrain.ts` and `effects/weather.ts` and `state.ts` 2 each, `mega.ts`
and `gmax.ts` 1 each). The tables already carry **54** `battle.*` keys and every one of them is
chrome — the four command labels, the prompt, the five outcome lines, the panel name and the INFO
window — so this is a **named seam** rather than a missed sweep: `[Task-26]` (Batch 10, shipped)
moved literals and the engine's log is data, and `[Task-112]` (Batch 23a, shipped) localised the move
and ability copy without touching the sentence that embeds it. `D43` itself froze that cut — «a battle
reads half Spanish (its menu and prompts) and half English (the engine's `Charmander used Tackle!`
lines) — the intended cut, not an oversight» — so the report **reverses a recorded decision** rather
than repairing a defect, and `[Task-114]` turns the log into a **key plus params** and resolves it in
`src/ui/feed.ts` with `t()`: the engine keeps no locale and the golden log stays a headless artifact.
It claims no scene and no state.

**Why Batch 53.** Its two serial resources are the battle engine and the i18n key table, and neither
is free before the plan's tail: `src/engine/battle/commands.ts` is `[Task-101]`'s in **Batch 46**
(open), and `src/i18n/{en,es}.ts` is held by **Batch 36**'s `[Task-98]`, **Batch 51**'s `[Task-109]`
and **Batch 52**'s `[Task-110]` — Batch 25's shipped Task-65 is the last claimant merged — so the
engine alone would allow **Batch 47** and the key table pushes it six batches further. It therefore
opens the plan's new **Batch 53**, one batch behind `[Task-110]`, and it takes no
`src/scenes/RouteScene.ts` claim, so that scene's queue still ends at 52. It adds no run field and
draws no RNG (the keys are literals; the battle, its seed and its draws do not move), so the chain
stays **14 → 15 → 16 → 17 → 18 → 19 → 20 → 21 → 22 → 23**. Nothing here re-plans
`Task-38`–`Task-113`, and Batch 4b stays `cut`.

A **thirtieth round** is **four decisions plus one report** — one **amendment written in place**
and four new tasks, `[Task-115]`–`[Task-118]` — and it adds **no `SAVE_VERSION` step**: none of
the four adds a run field, so the chain stays
**14 → 15 → 16 → 17 → 18 → 19 → 20 → 21 → 22 → 23**. None of them claims
`src/scenes/RouteScene.ts`, so that scene's queue still ends at **52** (`[Task-110]`,
Batch 52): `[Task-116]` and `[Task-117]` hold `src/scenes/rooms/casino.ts` instead,
`[Task-118]` holds `src/scenes/BattleScene.ts`, and `[Task-115]` holds no scene at all.

**The shop's guarantee survives the merchant (`[Task-92]`, amended).** The human keeps the
guarantee the shop room carries even as the room dies: **one merchant per floor from map 2
on**. The decision is a **placement, not a roll** — the floor's first `trainers` room always
carries the merchant, and `roomNpc` is only asked for the trainer rooms after it, so
`roomNpc` keeps its `(seed, roomIndex, mapIndex)` signature and stays pure. One optional row
field (`guaranteedFromMap`) carries the floor gate, and the merchant's own row is `chance: 0`,
so it is never rolled and no floor holds two; the rejected alternative was a floor-scoped
`pickedItems` marker. A floor cannot lack a `trainers` room: `TRAINER_ROOMS_PER_MAP` is
**2,2,3,3,3,4,4,4** (`[Task-82]`).

**The machine's equipable row follows the Mart (`[Task-115]`, Batch 54).** The fixed held row
(`mid` Charcoal, `high` Expert Belt, `late` Life Orb, `end` Leftovers) becomes **one grouped
row** drawn from `SHOP_ROTATION[band]` filtered to non-consumed, modelled ids, so a new
equipable reaches the machine the day the Mart bands it — never a second balance table. The
group's extra `rng.int` lives **inside the spin's own stream**, so nothing else moves
(`D11`); `early` and `low` fall back to `mid`'s shelf, which is what keeps a Life Orb off map
1; and the measured recovery (early 63 %, low 108 %, mid 105 %, high 75 %, late 88 %, end
71 %) forces a **dilution** of `low` and `mid` back under break-even before shipping.

**The machine spins in its window (`[Task-116]`, Batch 55).** The 460×220 card becomes the
slot machine's own view — three **item** reels in the `src/ui/frlg.ts` style, with the Team
Rocket icon as the battle's face and never a prize; `SPIN` and `LEAVE` still the
two actions and the money readout kept; and the animation **only reveals a result the model has
already booked**: `casinoSpin` spends, marks and (on a battle) locks **before** the first
frame, so a reload or a room change mid-spin can neither re-roll nor refund, and the reels
land on the paid item, the Egg or the Rocket icon, never on a decorative face. It claims
`src/scenes/rooms/casino.ts` and a new pure `src/ui/casinoReels.ts`, and **no** setting: a
click or the interact key skips the 1.12 s reveal, so there is no reduced-motion switch to add.

**Team Rocket becomes an NPC (`[Task-117]`, Batch 56).** The human's words: «rocket no es
sala especial es npc especial» and «es npc que pagas para tirar de ruleta». The `'casino'`
kind leaves `MapRoomSpecial`, `planMap` loses its 30 % draw, and the room module and its
minimap glyph leave the registry; the rocket becomes an `[Task-91]` row found by the per-NPC
roll in a trainer room, its panel the **same slot machine** (115's table, 116's reels) behind the
grunt's sprite and `SPECIAL_ARCHETYPES`' `rocket` row. `casinoSpin`, its three mark families,
the floor lock, the Egg's hatch on `advanceMap`, the price table and the grunt battle do not
move.

**The capture beat keeps one clock (`[Task-118]`, Batch 57).** The human's report: «que mensaje
de captura y animación se sincronicen, la pokeball se agite según más cerca de capturar y el
mensaje vaya añadiendo puntos suspensivos según se agita y al final mostrar el mensaje de si se
ha capturado». The ball wobbles the **engine's** `shakes` (0-3, four on a catch) instead of the
clamped 1-3, and one pure `captureTimeline` gives the tween chain and the message the same
ticks: a `{name}…` line that gains a dot per wobble (capped at three), the break that opens the
ball, and the final line at `settle`, with the frame's dwell set to the beat. The count is the
proximity — nothing re-derives it in the scene — and no draw moves. It depends on
`[Task-114]` (the lines are keys by then), so it lands **after Batch 53** and opens **Batch
57**; it claims `src/ui/capture.ts` + test, `src/scenes/BattleScene.ts` and
`src/i18n/{en,es}.ts`, none of which 115-117 hold.

**Why four one-task batches.** `[Task-115]` shares no path with Batch 53's `[Task-114]` and
needs nothing it produces, so the Orchestrator's fill search may pull it into the 53 cycle;
as a cut it is **Batch 54**. `[Task-116]` is written against 115's grouped row, and
`[Task-117]` needs both and deletes the room 116 rewrote, so the tail is the chain
**115 → 116 → 117** and every empty slot names its blocker. They also share two code-folder
READMEs no two of them may hold in one batch — `src/ui/README.md` (all three: a code-folder
README, not a `docs/*.md`, so it cannot be split by section) and
`src/scenes/rooms/README.md` (116 and 117) — plus `docs/maps-spec.md` §7 (all three, split by
block in each entry).

**Hot files.** `[Task-115]` holds `src/data/casino.ts` + test and `src/ui/casino.ts` + test;
`[Task-116]` holds `src/scenes/rooms/casino.ts` + test and the new `src/ui/casinoReels.ts` +
test; `[Task-117]` holds `src/engine/maps/plan.ts` + test, `src/data/npcs.ts` + test,
`src/scenes/rooms/casino.ts` + test (deleted), `src/scenes/BootScene.ts` (the cabinet texture
retires with the room) and the new `src/ui/rocketPanel.ts` + test; `[Task-118]` holds
`src/ui/capture.ts` + test, `src/scenes/BattleScene.ts` and `src/i18n/{en,es}.ts`. No
`package.json`,
`src/main.ts`, `vite.config.ts` or `src/data/dex/**` is claimed by any of them, and none
claims `src/scenes/RouteScene.ts`.

**Fixed-seed re-pins.** `[Task-115]` re-reads `src/ui/casino.test.ts`'s `pkm-64` map 5 pins
(spin 3 was the fixed Life Orb and is now the grouped draw) and `src/data/casino.test.ts`'s
per-band counts, and records that a re-banding of `SHOP_ROTATION` now moves a fixed seed's
spin — a deliberate re-pin, not a defect. `[Task-117]` re-pins `plan.test.ts`'s specials from map
3 on (the gated, trade and no-heal draws shift by the chance roll the casino took on every map
from 2, plus its parent and two size draws where it hung a leaf, while the shop, mini-boss,
mega-stone and every regular room stay put) and the seeds that hung a casino leaf; `[Task-116]`
moves no draw at all, and `[Task-118]` moves none either (it reads the shakes the capture
already rolled). Nothing here re-plans `Task-38`–`Task-114`, and Batch 4b stays `cut`.

A **thirty-first round** is **one report** — «añade en todo lo antes posible tarea para revisar
logica de todos los ataques, ahora los de estado o daño relativo parecen no hacer nada la
mayoria o no funcionan exactamente igual» — registered as **three tasks, `[Task-119]`–`[Task-121]`**.
It adds **no dependency edge to the tail below it** and **no `SAVE_VERSION` step**: the three
touch the effect layer and its ledger, add no run field and move no draw of their own, so the chain
stays **14 → 15 → 16 → 17 → 18 → 19 → 20 → 21 → 22 → 23** and none of the three claims
`src/scenes/RouteScene.ts` — that scene's queue still ends at **52** (`[Task-110]`). Batch 47
is **cut and in QA** and gains nobody, so the work opens the plan's next batch as a **lettered
defect batch, `Batch 47b`**, the way 5cb answered 5c and 23a answered 22: `47b` is the first
batch a later cycle cuts **after 47** and therefore sits **in front of Batch 51**. Because all
three tasks hold `src/engine/battle/**` and **a batch cannot hold two tasks over that path**,
they run as **three consecutive one-task batches, 47b → 47c → 47d**, not as one batch and not as
three parallel devs.

**The defect, measured in the shipped code.** The ledger claims **835 moves — 786 `port`,
0 `no-op`, 49 `excluded`** (`docs/balance/effect-coverage.md` 356), and the claim is produced by
`portedMoveNote` (`scripts/effect-coverage.mjs` 188-210), whose last two fallbacks are
`move.basePower > 0` (207) and **`move.flags.protect` (208)**. `flags.protect` sits on nearly
every targeted move, so **76 rows are `port` for no reason but that flag**: the ledger's own note
says `data: flags.protect` and no line of `src/engine/battle/**` reads it. Those 76 carry the
report's «no hacen nada» half — `Attract`, `Disable`, `Trick`, `Soak`, `Seismic Toss`, `Super
Fang`, `Psywave`, the four OHKO moves and their neighbours — while the power-relative family it
also means (`Body Press`, `Foul Play`, `Eruption`) sits in the other column, `port` through a
`basePower` the engine never adjusts. `applyMoveEffects` (`src/engine/battle/turn.ts` 373-…) applies
`move.status` (419), `move.volatileStatus` (421 — and only through the 24-name `switch` of
`applyVolatileEffect`, 250-344, whose `default` returns false at 329-330), `move.boosts` (425),
`move.heal` (429), `wish` (443) and `move.self.boosts` (448); nothing else. Damage is gated
`if (activeMove.category !== 'Status' && activeMove.basePower > 0)` (947) and `computeDamage`
(`damage.ts` 95-161) reads `move.basePower` (134) alone, so a **`basePower 0` move never enters
the damage loop** and a **power-relative move deals its flat dex number** (`Eruption` 150 at 1 HP,
`Foul Play` 95 with the user's own Attack, `Body Press` 80 off `def`). The engine already knows
it cannot express them: `move.damage` and `move.ohko` are read **only** by
`randomLearnset.ts` — `FIXED_DAMAGE_IDS` (27-34), `isFixedDamage` (36-38), the `move.ohko` skip
(57), the fixed-damage pool (59), the `FIXED_DAMAGE_MIN_LEVEL = 20` gate (21) and `sortPower`
(79-82) — which **avoids** them instead of modelling them, and `fighter.ts` 412 (`hasOhko`) is
the AI's No-Guard guard (D17), not a damage path. The status side has the same shape: the
**readers and the fields exist and no move writes them** — `volatiles.attract` (`fighter.ts` 82)
is read by `beforeMoveVolatile` (`turn.ts` 834-837) and written only by Cute Charm,
`volatiles.disabledMove`/`disableTurns` (78-80) is read by `commands.ts` 74/100/251 and written
only by Cursed Body (`effects/abilities.ts` 1882-1891), so `Attract` and `Disable` — both on the
`flags.protect` list — print one line and change nothing. `move.forceSwitch` is read **nowhere**
in `src/` (only declared, `src/data/dex/moves.ts` 51) and `move.sideCondition` / `pseudoWeather`
reach the state only through the two hand tables `SIDE_CONDITION_MOVES` / `FIELD_CONDITION_MOVES`
(`effects/moves.ts` 61-80).

**The measurement, frozen (`[Task-119]`).** One new headless module and one test, on the seams
that already ship: `src/engine/battle/moveAudit.ts` exports `probeMove(moveId, setup?)`, which
builds a `createBattle` state from two `createFighter` dittos at level 50 (`ability: 'Run Away'`,
no held item, the player's only slot the probed move and the enemy's `splash`), runs **one**
`useMove(state, 'player', { type: 'fight', moveIndex: 0 })` (`turn.ts` 689-701) and returns a
`MoveProbe` snapshot — both HP, both primary status, both boost vectors in `BOOST_IDS` order,
both volatile key sets, both `SIDE_CONDITION_IDS` vectors, the `FIELD_CONDITION_IDS` vector and
the `state.log`'s non-text event kinds in order. `MOVE_AUDIT_ROWS` records, **per move id**, the
`expected` partial snapshot (the reference's delta: status, stat stage, volatile, screen, field,
heal, protect; and for the relative families the exact HP arithmetic, the OHKO's KO and the
counter's mirrored number) plus an optional `knownGap: true`, and `moveAudit.test.ts` runs
**one `it` per row** (`it.fails` for a `knownGap` row, so a gap is **green and visible** and the
fix task must delete the flag to keep it green) and two gates: **no row claims nothing**
(`expected` is never `{}`) and **the rows equal the ledger** — every move `moveCoverage` marks
`port` with a note other than `data: basePower` has a row, and no row names a move the ledger
calls `excluded`/`no-op`; the `data: basePower` verse is covered by a generated sweep (one
assertion each that the move deals ≥1 damage), so the harness owns **all 835** and a new handler
without a row fails. The same task repairs the classifier: `portedMoveNote` drops the
`flags.protect` fallback, treats `move.damage`, `move.ohko`, `sideCondition`, `pseudoWeather` and
`forceSwitch` as **not** ported unless a handler names them, and regenerates
`docs/balance/effect-coverage.md` + `src/data/moveCoverage.json` — so the ledger goes from
**0 `no-op`** to the honest count and the develop build's `[coverage]` warning (D16) finally
fires on a move that goes off and does nothing. Multi-turn families (Leech Seed, Yawn, perish,
Encore/Taunt decay, protection) are pinned through `scriptedBattle` (`harness.ts` 76-92) on seed
**2026**, and `golden.test.ts`'s inline log must stay **byte-identical** through all three tasks.
**Hazards are not a family here:** `Spikes`, `Toxic Spikes`, `Stealth Rock` and `Sticky Web` are
`excluded` by the ledger's own policy (254) and stay out.

**The split, and why not one task.** `[Task-119]` is the instrument and the honest ledger;
`[Task-120]` is the **status** half — the `flags.protect` moves that write a status, a stage, a
volatile, a screen, a field, a heal, a protection or a type/ability/stat swap, on the handlers,
fields and machinery that already exist; `[Task-121]` is the **relative-damage** half — fixed
damage (`Seismic Toss`, `Night Shade`, `Dragon Rage`, `Sonic Boom`), level-based (`Psywave`),
half-HP (`Super Fang`, `Nature's Madness`, `Ruination`), OHKO (`Fissure`, `Guillotine`,
`Horn Drill`, `Sheer Cold`), `Endeavor`, `Pain Split`, `Final Gambit`, `Present`, `Spit Up`,
`Crush Grip`, `Wring Out`, the counter family (verified, not assumed: `COUNTER_MOVES` `turn.ts`
623 and `useCounterMove` 629-668) and the **power-relative** family (`Body Press`, `Foul Play`,
`Eruption`, `Water Spout`, `Dragon Energy`, `Stored Power`, `Power Trip`, `Rage Fist`,
`Last Respects`, `Hex`, `Venoshock`, `Facade`, `Bolt Beak`, `Fishious Rend`, `Brine`, `Payback`,
`Avalanche`, `Revenge`, `Retaliate`, `Round`, `Echoed Voice`, `Expanding Force`,
`Rising Voltage`, `Grassy Glide`, `Psyblade`, `Flail`, `Reversal`, `Electro Ball`, `Gyro Ball`,
`Hard Press`, `Heat Crash`, `Heavy Slam`, `Low Kick`, `Grass Knot`). One task would carry the
instrument, ~50 handlers, both damage families and the ledger — the same reason `[Task-107]` and
`[Task-108]` were cut in two.

**Arbitration with `[Task-114]` (Batch 53).** The audit and the action-log task both hold
`src/engine/battle/**`, so they can never share a batch, and the audit is **ahead** of 114 by
construction (47b, 47c and 47d all precede 51): **the audit goes first and `[Task-114]` keeps its
label and slips nothing** — it was already later. What does go stale is 114's *measurement*:
its 194 call sites in twelve files, its nineteen assertions reading `event.text` and its golden
snapshot were counted against a tree without the audit's new handlers, so 114's record now says
they are **re-read at cut time**, and 114 stays the only task that ever writes
`src/ui/feed.ts`, `src/i18n/{en,es}.ts` and `src/engine/battle/commands.ts`. The audit claims
none of the three.

**The slots beside them.** Each of the three batches is one task because the audit holds
`src/engine/battle/**` whole, so **no** task claiming any part of that path can ride: `[Task-114]`
(Batch 53) and `[Task-118]` (Batch 57, written against 114) are out, and the same constraint
blocks any later battle task. What *can* ride is anything whose paths miss the engine:
`[Task-109]` (Batch 51 — `src/scenes/RouteScene.ts`, `src/ui/notice.ts` + test and the i18n
tables, `*Dependencies:*` none) and `[Task-117]` (Batch 56, its only dependency `[Task-116]`
shipped) are both legal already, so the Orchestrator's fill search may take either into 47b, 47c
or 47d — and the batch it empties then retires. The rest are named one by one so no slot is left
silently empty: `[Task-102]`, `[Task-103]` and `[Task-108]` are Batch 47's own and unmerged when
this was cut, `[Task-110]` is written against Batch 47's entry beat, `[Task-104]` and `[Task-113]`
are `[!]`, and `[Task-28]` is unscheduled by its own decision line. Every one of the three names
its holder of the **generated** coverage pair, because all three regenerate it: `[Task-119]` owns
`scripts/effect-coverage.mjs` and the generator's own rules, and 120 and 121 own the regeneration
their handlers force.

**Fixed-seed ledger.** `[Task-119]` moves no draw (a probe is a test, the classifier reads source
text) and `[Task-120]`'s handlers take the draws their reference takes, if any, from the battle's
one `Rng`; `[Task-121]` names each roll it adds — `Psywave`'s `0.5–1.5` multiplier, `Present`'s
heal-or-damage pick, the OHKO's accuracy-independent success roll — in the order it spends them,
and re-pins the new fixed-seed audit rows rather than the golden battle, which contains none of
those moves. Nothing here re-plans `Task-38`–`Task-118`, and Batch 4b stays `cut`.

The batches below carry at most one `src/scenes/RouteScene.ts` task each (the tail batches
47b–47d and 54–57 carry none) and name their hot-file holder; each entry's own
`*Dependencies:*` line stays the per-task record.

| Batch | Tasks | Hot files (the one holder each) |
| --- | --- | --- |
| 29 | 84, 90 | `src/scenes/RouteScene.ts` → 84; `src/assets/frlg/overworld.png` + `src/data/frlg/overworld.json` (generated) → 90 |
| 30 | 87, 81 | `src/scenes/RouteScene.ts`, `src/data/items.ts`, `src/data/frlg/item-icons.json` (generated) → 87; `src/engine/maps/plan.ts`, `src/data/maps.ts` → 81 |
| 31 | 89, 104 | `src/scenes/RouteScene.ts`, `src/ui/shop.ts`, `src/ui/rewards.ts` → 89; `docs/balance/effect-coverage.md` (generated) → 104 |
| 32 | 85 | `src/scenes/RouteScene.ts`, `src/scenes/BootScene.ts`, `src/engine/tileset.ts` → 85 |
| 33 | 78 | `src/scenes/RouteScene.ts`, `src/engine/run/roster.ts` → 78 |
| 34 | 79 | `src/scenes/RouteScene.ts` → 79 |
| 35 | 82, 80 | `src/scenes/RouteScene.ts`, `src/engine/maps/plan.ts`, `src/data/population.ts` → 82; `src/data/maps.ts`, `src/engine/run/floors.ts`, `docs/balance/route-curve.md` → 80 |
| 36 | 98, 83 | `src/scenes/RouteScene.ts`, `src/engine/run/state.ts`, `src/engine/save.ts` → 98; `src/data/run.ts`, `src/engine/run/progression.ts`, `src/engine/run/resolve.ts`, `src/engine/run/curve.test.ts`, `docs/balance/route-curve.md` → 83 |
| 37 | 91 | `src/scenes/RouteScene.ts`, `src/data/npcs.ts`, `src/engine/routes/npcs.ts`, `src/ui/npcPanel.ts` → 91 |
| 38 | 92 | `src/scenes/RouteScene.ts`, `src/engine/maps/plan.ts`, `src/ui/mapView.ts` → 92 |
| 39 | 93 | `src/scenes/RouteScene.ts`, `src/engine/save.ts`, `src/engine/run/progression.ts` → 93 |
| 40 | 94 | `src/scenes/RouteScene.ts`, `src/engine/save.ts` → 94 |
| 41 | 95 | `src/scenes/RouteScene.ts`, `src/data/items.ts`, `src/engine/battle/runAway.ts` → 95 |
| 42 | 99 | `src/scenes/RouteScene.ts`, `src/data/trainers.ts` → 99 |
| 43 | 96 | `src/scenes/RouteScene.ts`, `src/engine/maps/plan.ts`, `src/ui/mapView.ts` → 96 |
| 44 | 97 | `src/scenes/RouteScene.ts`, `src/engine/maps/plan.ts`, `src/ui/mapView.ts`, `src/data/shop.ts` → 97 |
| 45 | 100 | `src/scenes/RouteScene.ts`, `src/data/bosses.ts`, `src/engine/routes/battlefield.ts` → 100 |
| 46 | 101 | `src/scenes/RouteScene.ts`, `src/engine/save.ts`, `src/engine/battle/commands.ts` → 101 |
| 47 | 102, 103, 108 | `src/engine/maps/plan.ts` (+ 102's new modules, its notices and the i18n tables) → 102; `src/data/items.ts`, `src/data/dex/natures.ts`, `src/engine/save.ts`, the run/battle rules it edits and the generated coverage pair → 103; `src/scenes/RouteScene.ts`, `src/scenes/BattleScene.ts`, `src/engine/run/battleLink.ts`, `src/ui/partyGrid.ts`, `src/ui/beats.ts` → 108 |
| 47b | 119, 109 | the new `src/engine/battle/moveAudit.ts` + `moveAudit.test.ts`, `scripts/effect-coverage.mjs`, the generated `docs/balance/effect-coverage.md` + `src/data/moveCoverage.json`, `src/data/items.ts` (the doc comment only), `src/engine/README.md`, `docs/showdown-reuse.md` §3 and `docs/tech-decisions.md`'s `D16` → 119; `src/scenes/RouteScene.ts`, `src/ui/notice.ts` + `notice.test.ts`, `src/i18n/{en,es}.ts`, `docs/routes-spec.md` §6 and `docs/design-spec.md` §3 → 109 |
| 47c | 120, 117 | `src/engine/battle/{turn,volatile,fighter}.ts`, `src/engine/battle/effects/moves.ts` + their tests, the generated coverage pair (regenerated here) → 120; `src/scenes/RouteScene.ts` (the rocket's `chooseNpc` case), `src/scenes/BootScene.ts`, `src/engine/maps/plan.ts` + test, `src/data/npcs.ts` + test, `src/scenes/rooms/casino.ts` + test (deleted), the new `src/ui/rocketPanel.ts` + test, `src/ui/casino.ts` (comment only), `src/ui/README.md`, `src/scenes/rooms/README.md`, `docs/maps-spec.md` §7, `docs/design-spec.md` §7 and `docs/routes-spec.md` §2 → 117 |
| 47d | 121 | `src/engine/battle/{damage,turn,preview}.ts`, `src/engine/battle/effects/moves.ts` + their tests, the generated coverage pair (regenerated here) → 121 |
| 52 | 110 | `src/scenes/RouteScene.ts`, `src/scenes/BattleScene.ts`, `src/ui/bag.ts` + test, `src/i18n/{en,es}.ts` → 110 |
| 53 | 114 | `src/engine/battle/**`, `src/ui/feed.ts` + test, `src/i18n/{en,es}.ts` → 114 |
| 54 | 115 | `src/data/casino.ts` + test, `src/ui/casino.ts` + test → 115 |
| 55 | 116 | `src/scenes/rooms/casino.ts` + test, `src/ui/casinoReels.ts` + test → 116 |
| 57 | 118 | `src/ui/capture.ts` + test, `src/scenes/BattleScene.ts`, `src/i18n/{en,es}.ts` → 118 |

**Batch 39 was filled with `[Task-116]` (Batch 55) in this cycle.** The cut was
`[Task-93]` alone; the fill search pulled `[Task-116]` because `[Task-115]` is merged
and its paths — `src/scenes/rooms/casino.ts`, the new pure `src/ui/casinoReels.ts`,
the two folder READMEs and §7's casino window paragraph — are disjoint from Task-93's.
The two empty slots name their blockers: `[Task-94]` (Batch 40) shares
`src/engine/save.ts` with 93, and every other open task claims
`src/scenes/RouteScene.ts`, which 93 holds (`[Task-95]`, 96, 97, 99, 100, 101, 102,
108, 109, 110), or depends on an unmerged task (`[Task-114]` on 101, `[Task-117]` on
116, `[Task-118]` on 114); `[Task-103]` (Batch 47) also shares `save.ts` with 93.

**Batch 41 is `[Task-95]` alone: the fill search found no legal mate.** Its cut holds
`src/scenes/RouteScene.ts`, `src/data/npcs.ts` + test, `src/data/items.ts` + test,
`src/engine/routes/npcs.ts` + test, `src/engine/battle/runAway.ts` + test,
`src/engine/battle/state.ts`, `src/engine/battle/effects/items.ts` + test,
`src/engine/run/battleLink.ts`, `src/scenes/BattleScene.ts` (one line in its
`createBattle` call) and `src/i18n/{en,es}.ts` — the `noFlee` flag its entry requires
lives on `BattleSetup`/`BattleState` and on the launch, so the one-line record above
for 41 predates those four extra paths and the spec carries them. Nine open tasks
claim `RouteScene.ts`, which 95 holds: `[Task-96]`, 97, 99, 100, 101, 102, 108, 109
and 110. The rest are named one by one: `[Task-103]` (Batch 47) needs
`src/data/items.ts` **and** `[Task-95]`'s heal; `[Task-114]` (Batch 53) holds
`src/engine/battle/**` and `src/i18n/{en,es}.ts`, both paths 95 edits, and its own
record already puts it behind `[Task-101]`'s `commands.ts`; `[Task-117]` (Batch 56)
claims `src/data/npcs.ts` + test and edits the same §7 NPC table, and it is written
against the battle starter `[Task-95]`'s Mega Stone row ships; `[Task-118]` (Batch 57)
depends on `[Task-114]`; `[Task-28]` stays unscheduled by its own decision line. The
three empty slots name those constraints, so the batch runs as one dev wave and one
QA wave.

**Batch 42 is `[Task-99]` alone: the fill search found no legal mate.** Its cut holds
`src/scenes/RouteScene.ts`, `src/data/trainers.ts` + test,
`src/engine/routes/trainers.ts` + test, `src/engine/run/battleLink.ts` (the roster
entry's `ability`), `src/engine/run/resolve.ts` + test (the reward row pays inside the
fold's own `firstWin`) and the three docs' sections — `docs/routes-spec.md` §2/§5,
`docs/battle-spec.md` §9 and `docs/design-spec.md` §7 — so the one-line record above
for 42, which names only `RouteScene.ts` and `src/data/trainers.ts`, is narrower than
the spec's list (the way Batch 41's record predated its four extra paths), and the spec
carries the rest. Eight open tasks claim `RouteScene.ts`, which 99 holds: `[Task-96]`,
97, 100, 101, 102, 108, 109 and 110. The rest are named one by one: `[Task-114]`
(Batch 53) needs `[Task-101]`'s `commands.ts`, and `[Task-118]` (Batch 57) is written
against 114; `[Task-103]` (Batch 47) shares `docs/battle-spec.md` §9 — the bullet naming
the archetypes that may carry a stone — **and** the first-win block of
`src/engine/run/resolve.ts` 99 edits, so it collides twice; `[Task-117]` (Batch 56)
shares `docs/design-spec.md` §7's special-room list **and** `docs/routes-spec.md` §2,
where 99 writes the special-trainer paragraph beside the NPC paragraph 117 rewrites, and
neither a code path nor a section can be split between two tasks; `[Task-28]` stays
unscheduled by its own decision line. No `package.json`, `src/main.ts`,
`vite.config.ts` or `src/data/dex/**` is claimed by 99. The three empty slots name
those constraints, so the batch runs as one dev wave and one QA wave.

**Batch 43 is `[Task-96]` alone: the fill search found no legal mate.** Its cut holds
`src/scenes/RouteScene.ts`, `src/engine/maps/plan.ts` + `plan.test.ts` and — by type,
the record above predating it — no `src/ui/mapView.ts` at all (`MapRoomMarker` is an
alias of `MapRoomSpecial`, so the new plan value reaches the minimap without an edit),
plus the room layer's own paths (`src/scenes/rooms/types.ts`, `registry.test.ts`, the
new descriptor + test), the new pure module and table with their tests
(`src/engine/routes/staticSpecies.ts` + test, `src/data/staticSpecies.ts` + test),
`src/engine/routes/index.ts`, `src/ui/notice.ts` + test, `src/i18n/{en,es}.ts`, three
folder READMEs and the three docs' §7/§3/§6 blocks. Every other open task is blocked by
name: `[Task-97]` (Batch 44) shares `src/engine/maps/plan.ts` and the room layer **and**
depends on 96; `[Task-100]`, 101, 102, 108, 109 and 110 each claim
`src/scenes/RouteScene.ts`, which 96 holds; `[Task-103]` (Batch 47) claims no scene and
its own dependencies are merged (`[Task-87]`, 94, 95 and 106 all shipped), but its
`SAVE_VERSION` step is frozen at **22 → 23** by the plan's batch order after
`[Task-101]`'s 21 → 22 — the file reads **21** on `main` — so pulling it into 43 would
invert the chain and stale 101's own entry; `[Task-114]` (Batch 53) needs
`[Task-101]`'s `src/engine/battle/commands.ts` and `[Task-118]` (Batch 57) is written
against 114, so both wait on an unmerged dependency; `[Task-117]` (Batch 56) shares
`src/engine/maps/plan.ts` with 96; and `[Task-28]` stays unscheduled by its own decision
line. The three empty slots name those constraints, so the batch runs as one dev wave
and one QA wave — and, being one task, as a single QA pass that covers the integration
scope too.

**Batch 45 is `[Task-100]` alone: the fill search found no legal mate.** Its cut holds
`src/scenes/RouteScene.ts`, `src/data/bosses.ts` + test, `src/data/battlefields.ts` + test
(the retired `BOSS_BATTLEFIELD_CHANCE`), `src/engine/routes/battlefield.ts` + test, the new
`src/engine/routes/bossRoom.ts` + test, `src/engine/routes/index.ts`, the two folder
READMEs (`src/data/README.md`'s `bosses.ts` line and `src/engine/README.md`'s `routes/`
line) and the two docs' blocks — so the one-line record above for 45, which names only its
three headline files, is narrower than the spec's list (the way Batch 41's and 42's
records predate theirs), and the spec carries the rest. **The docs are single-writer
here:** `[Task-100]` owns `docs/maps-spec.md` §6 whole and **§7's first
`### A room's battle condition` bullet** — the one naming the boss's condition and the
quiet special leaves — and it rewrites only the **boss** clause, so that bullet's
`casino` parenthetical **stays** until the room retires; the rest of §7 (the
special-room table with its casino row, the rates paragraph, the NPC table and the
`### The casino (the slot machine)` subsection) is `[Task-117]`'s block and is nobody's
in this batch. `[Task-117]` (Batch 56) was the only legal candidate and it is **refused by
`src/scenes/RouteScene.ts`**: its rocket's machine cannot open without a branch in that
scene's `chooseNpc` id switch (5895-6010, whose `default` only writes the use mark and
closes), because `src/scenes/rooms/registry.ts` collects **room** descriptors only —
there is no NPC registry a data row could reach — so `src/scenes/rooms/casino.ts`'s
`openCasino(host)` cannot be re-homed as an NPC panel without editing the scene 100
holds, and a code path cannot be split by section the way a `docs/*.md` file can. The rest
are named one by one: `[Task-101]`, 102, 108, 109 and 110 each claim
`src/scenes/RouteScene.ts`, which 100 holds; `[Task-103]` (Batch 47) claims no scene and
its own dependencies are merged, but its `SAVE_VERSION` step is frozen at **22 → 23** by
the plan's batch order after `[Task-101]`'s 21 → 22 — the file reads **21** on `main` — so
pulling it into 45 would invert the chain and stale 101's own entry; `[Task-114]`
(Batch 53) needs `[Task-101]`'s `src/engine/battle/commands.ts` and `[Task-118]`
(Batch 57) is written against 114, so both wait on an unmerged dependency; `[Task-28]`
stays unscheduled by its own decision line and `[Task-104]`/`[Task-113]` are `[!]`. The
three empty slots name those constraints, so the batch runs as one dev wave and one QA
wave — and, being one task, as a single QA pass that covers the integration scope too.

**Batch 46 is `[Task-101]` alone: the fill search found no legal mate.** Its cut holds
`src/scenes/RouteScene.ts` (one property on the launch in `startBattle`),
`src/scenes/BattleScene.ts` (the setup, the party rows' `enabled` and the returned
`used`), `src/engine/save.ts` (the 21 → 22 step), `src/engine/run/{battleLink,progression,resolve}.ts`
+ `resolve.test.ts`, `src/engine/battle/{state,commands,turn}.ts` + the new
`banned.test.ts`, `src/engine/maps/plan.ts` + `plan.test.ts` (the ninth special kind,
on its own `${seed}:map:<floor>:banned-room` stream, last of the pass),
`src/engine/maps/progress.ts` + `progress.test.ts` (its stable trainer id), the new
`src/engine/routes/bannedRoom.ts` + test and the barrel line, the new
`src/data/bannedRoom.ts` + test, the new `src/scenes/rooms/banned.ts` + test and
`registry.test.ts`'s shipped-kind list, `src/ui/notice.ts` + test,
`src/i18n/{en,es}.ts`, the three folder READMEs, `docs/battle-spec.md` §2 and
`docs/maps-spec.md` §7's own new row and own new subsection — plus the two mechanical
re-pins a new leaf forces (`src/engine/run/curve.test.ts`'s `MEASURED_FILL`, and
`src/data/run.ts` + `docs/balance/route-curve.md` only if a floor leaves the window;
`src/engine/routes/battlefield.test.ts`'s `BOSS_PINS` on maps 4+), because a floor that
hangs a leaf holds one room more and `routeIndexForRoom` sums the floors before it.
So the one-line record above for 46, which names only its three headline files, is
narrower than the spec's list (the way Batch 41's, 42's, 43's and 45's records predate
theirs), and the spec carries the rest. No later task is a legal mate. `[Task-102]`
(Batch 47) claims `src/scenes/RouteScene.ts` **and** `src/engine/maps/plan.ts`, both 101's;
`[Task-103]` (Batch 47) claims no scene and its own dependencies are merged, but it
shares `src/engine/save.ts` and its `SAVE_VERSION` step is frozen at **22 → 23** after
101's 21 → 22 — the file reads **21** on `main` — so pulling it into 46 would invert the
chain and stale 101's own entry; `[Task-108]` (Batch 50) claims `RouteScene.ts` and
`BattleScene.ts`, both 101's; `[Task-109]` (Batch 51) claims `RouteScene.ts`,
`src/ui/notice.ts` and `src/i18n/{en,es}.ts`, all three 101's; `[Task-110]` (Batch 52)
claims `RouteScene.ts` and `BattleScene.ts`; `[Task-114]` (Batch 53) needs 101's
`src/engine/battle/commands.ts` (and shares `state.ts`, `turn.ts` and the i18n tables)
and `[Task-118]` (Batch 57) is written against 114, so both wait on an unmerged
dependency; `[Task-117]` (Batch 56) shares `src/engine/maps/plan.ts` with 101 and edits
the §7 table its row joins; `[Task-28]` stays unscheduled by its own decision line and
`[Task-104]`/`[Task-113]` are `[!]`. **The docs are single-writer by section here:**
`[Task-101]` writes only its own §7 table row and its own `###` subsection, so the
special-room table's casino row, the rates paragraph, the NPC table and the casino
subsection stay `[Task-117]`'s. The three empty slots name those constraints, so the
batch runs as one dev wave and one QA wave — and, being one task, as a single QA pass
that covers the integration scope too.

**Batch 47 is `[Task-102]`, `[Task-103]` and `[Task-108]`: the cut, plus one filled
slot.** The cut is the puzzle rooms and the item catalogue's fourth wave. Their paths
are disjoint and neither needs a file the other produces: **`[Task-102]`** claims
`src/engine/maps/plan.ts` + `plan.test.ts` (the tenth `MapRoomSpecial` kind and its own
minted `…:puzzle-room` draw, last of the special pass), the new
`src/engine/routes/puzzle.ts` + test and its barrel line, the new `src/data/puzzles.ts`
+ test, the new `src/scenes/rooms/puzzle.ts` + test, `registry.test.ts`'s
`SHIPPED_KINDS`, the three puzzle notices in `src/ui/notice.ts` + test, the
`src/i18n/{en,es}.ts` keys, the three folder READMEs and two docs blocks
(`docs/maps-spec.md` §7's own row, its own rates clause and its own `###` subsection,
`docs/routes-spec.md` §2's one paragraph); **`[Task-103]`** claims `src/data/items.ts` +
test, `src/data/dex/natures.ts` + test (`statAtLevel`'s sixth parameter),
`src/engine/battle/{fighter,mega,commands}.ts` + their tests and
`effects/items.ts` + test, `src/engine/run/{items,state,progression,memberEdits,resolve}.ts`
+ their tests, `src/engine/save.ts` + test, `src/ui/partyDetail.ts` + test, the
**generated** `docs/balance/effect-coverage.md` + `src/data/moveCoverage.json` and two
docs blocks (`docs/data-spec.md` §3 and `docs/battle-spec.md` §2/§3/§5/§9). **The hot
files:** `src/engine/maps/plan.ts` → 102; `src/data/items.ts`, `src/engine/save.ts`,
`src/data/dex/natures.ts` and the generated coverage pair → 103; `src/scenes/RouteScene.ts`
and `src/scenes/BattleScene.ts` → 108. **The docs are single-writer by section:**
`docs/battle-spec.md` is held by 103 in **§2/§3/§5/§9** and by 108 in **§12** only;
`docs/maps-spec.md` §7 is 102's own row/clause/subsection and nobody else's in this
batch. **The `SAVE_VERSION` step is 22 → 23 and `[Task-103]`'s alone** (`main` reads
**22** after `[Task-101]`); the migration writes the run's empty `discoveredCandy` and
leaves the members' optional `statTreats` to the decoder, so an old run starts with no
treats and an empty discovered set. Task-102's record in the table above needed one
correction: **it claims no `src/scenes/RouteScene.ts`** — the room layer carries the
whole room through the shipped `RoomHost` (`fixture`, `interact`, `drawFixture`,
`commitRun`, `rebuildRoom`, `showNotice`) and the reward is an ordinary ground item the
fixture places once the run's `pickedItems` mark says solved, so no build pass and no
scene edit is involved; the spec carries the full list, the way Batches 41, 42, 45 and
46's records predated theirs.

**The fill search pulled `[Task-108]` (Batch 50) and left one slot empty.**
`[Task-108]` is legal: its only dependency, `[Task-107]`, **shipped** (its entry is
`[x]` and its engine rules are in `src/engine/battle/state.ts`/`commands.ts`/`turn.ts`
with `BOSS_PARTY.boss.double`), and its paths — `src/scenes/RouteScene.ts`,
`src/scenes/BattleScene.ts`, the new `BattleLaunch.double` in
`src/engine/run/battleLink.ts`, `src/ui/partyGrid.ts`, `src/ui/beats.ts`,
`docs/battle-spec.md` §12 and `docs/design-spec.md` §4 — are disjoint from 102's and
103's union, with one shared **docs** file split by section (§12 against
§2/§3/§5/§9). It needs no file a batch-mate produces. The three used slots run as one
dev wave and one QA wave. The fourth slot names its blockers, task by task:
`[Task-105]` is **not open** — it shipped in Batch 26 (the plan's Batch 48 row is
stale and should be retired, not re-cut); `[Task-109]` (Batch 51) claims
`src/scenes/RouteScene.ts` (108's), `src/ui/notice.ts` (102's) **and**
`src/i18n/{en,es}.ts` (102's); `[Task-110]` (Batch 52) claims `src/scenes/RouteScene.ts`
and `src/scenes/BattleScene.ts` (108's) **and** `src/i18n/{en,es}.ts` (102's);
`[Task-114]` (Batch 53) claims `src/engine/battle/**`, which 103 edits
(`fighter.ts`, `mega.ts`, `commands.ts`, `effects/items.ts`), **and**
`src/i18n/{en,es}.ts`; `[Task-117]` (Batch 56) claims `src/engine/maps/plan.ts` and
`docs/maps-spec.md` §7, both 102's, and `src/scenes/rooms/casino.ts` beside a
`plan.test.ts` this batch re-pins; `[Task-118]` (Batch 57) is written against the
unmerged `[Task-114]`; `[Task-104]` and `[Task-113]` are `[!]` and `[Task-28]` is
unscheduled by its own decision line. No `package.json`, `src/main.ts`,
`vite.config.ts` or `src/data/dex/**` generated JSON is claimed by any of the three,
and no two tasks in the batch share a code, data or asset path. **The table's rows 48,
49 and 50 retire**: `[Task-105]` and `[Task-107]` are `[x]` (shipped) and `[Task-108]`
is captured here, so a later cycle cannot cut a shipped task or the same task twice;
Batches 48, 49 and 50 are now empty labels and the plan resumes at **Batch 51**
(`[Task-109]`, filled into 47b below). `[Task-108]`'s own entry keeps its prose and takes this batch's label.

**Batch 47b is `[Task-119]` and `[Task-109]`: the cut, plus one filled slot.** The cut is the
move audit and the honest coverage ledger — the instrument `[Task-120]` and `[Task-121]` are
judged by. `[Task-109]`, the area-entry panel, is the fill: its dependencies are all merged (the
notice module and its later rows, the chrome re-tune and the i18n table) and its paths are
disjoint from 119's, so the two run as one dev wave and one QA wave. **119** holds the new
`src/engine/battle/moveAudit.ts` + `moveAudit.test.ts`, `scripts/effect-coverage.mjs`, the
generated `docs/balance/effect-coverage.md` + `src/data/moveCoverage.json`, the one doc comment
this task repairs in `src/data/items.ts`, `src/engine/README.md`, `docs/showdown-reuse.md` §3 and
`docs/tech-decisions.md`'s `D16`; **109** holds `src/scenes/RouteScene.ts`, `src/ui/notice.ts` +
`notice.test.ts`, `src/i18n/{en,es}.ts`, `docs/routes-spec.md` §6 and `docs/design-spec.md` §3.
**The hot files:** the generated coverage pair and `src/data/items.ts` → 119;
`src/scenes/RouteScene.ts` and the two i18n tables → 109. **No `docs/*.md` file is shared**: 119
writes `docs/showdown-reuse.md` and `docs/tech-decisions.md`, 109 writes `docs/routes-spec.md` and
`docs/design-spec.md`, so this batch needs no section split. The two empty slots name their
blockers, task by task: `[Task-117]` **needs `src/scenes/RouteScene.ts`** — its entry no longer
denies it, because the rocket's panel has no data-driven dispatch and `chooseNpc` is a hard-coded
id switch — and that scene is 109's, so 117 fills **47c** beside `[Task-120]` instead;
`[Task-123]` (Batch 58) shares `src/ui/README.md` with 117, so the two can never share a batch and
123 stays with its own DOM-HUD round; `[Task-120]`, `[Task-121]` and `[Task-114]` all hold
`src/engine/battle/**`, which 119 holds; `[Task-110]` shares `src/scenes/RouteScene.ts` with 109;
`[Task-118]` is written against the unmerged `[Task-114]`; `[Task-122]` requires the Figma
single-session export in the Orchestrator's own session (`s52r`) and cannot be a parallel dev
worktree; `[Task-104]` and `[Task-113]` are `[!]` and `[Task-28]` stays unscheduled by its own
decision line. **47c and 47d keep one engine task each as their cut** — `[Task-120]` then
`[Task-121]` — and 117 rides 47c as its own fill. The table's rows **51 and 56 retire**
(`[Task-109]` is captured by 47b and `[Task-117]` by 47c), 47b's and 47c's rows carry the new
members, both of those entries keep their prose and take their new labels, and `[Task-119]`'s
entry keeps the *(Batch 47b)* it already reads.

**Batch 57 was filled with `[Task-124]` (Batch 59) in this cycle.** The cut was
`[Task-118]` alone — one task, written against a `[Task-114]` that has since merged. The fill
search pulled `[Task-124]` because its dependencies (`[Task-122]`, `[Task-123]`) are both
merged and its paths (`src/main.ts`, `src/ui/hud/mount.ts` + `shell.tsx` + `styles/root.css`,
`src/assets/fonts/**`) are disjoint from Task-118's (`src/ui/capture.ts`,
`src/scenes/BattleScene.ts`, the two i18n tables, `src/ui/README.md`). The two empty slots name
their blockers and nothing more: `[Task-126]` needs `src/main.ts`'s mount point, which
`[Task-124]` produces in this very batch, and `[Task-125]` needs the `preact` + JSX setup in
`package.json`/`tsconfig.json` that `[Task-124]` owns (one hot-file owner per batch), so both
wait for the next cycle together, beside `[Task-127]`. The shared document `src/ui/README.md` is
claimed by section: Task-118 rewrites the `capture.ts` line, Task-124 appends the `hud/` lines
after `hud/commands.ts`. Every Phase-12 migration from `[Task-129]` on still needs `[Task-127]`,
which needs `[Task-124]`-`[Task-126]`; `[Task-28]` stays unscheduled by its own decision line
and `[Task-104]`/`[Task-113]` are `[!]`.

**Batch 53 was filled with `[Task-128]` (Batch 58) in this cycle.** The cut was
`[Task-114]` alone; the fill search pulled `[Task-128]` because its dependencies are all merged
(none) and its paths — `src/scenes/RouteScene.ts`, the new `src/scenes/panels/**` and
`src/scenes/README.md` — are disjoint from Task-114's. The two empty slots name their blockers:
`[Task-122]` exports through the figma-edit channel's **single-session lock** in the Orchestrator's
own session, so it cannot be a parallel dev worktree, and `[Task-124]`, `[Task-125]` and
`[Task-126]` each need it; `[Task-118]` is written against `[Task-114]` itself, so it cannot ride
the same batch; every Phase-12 migration from `[Task-129]` on needs `[Task-127]`, which needs
`[Task-124]`–`[Task-126]`; `[Task-28]` stays unscheduled by its own decision line and
`[Task-104]`/`[Task-113]` are `[!]`. `[Task-128]` ships here, so **Batch 58 keeps `[Task-122]`
alone** — its `[Task-123]` and `[Task-128]` have both shipped — and the batch's own prose above
still lists it under 58 as the cut it was written for.

A **thirty-second round** is the human's decision on the prototype board: **the panels become a DOM
layer over an untouched canvas**, recorded as `D49` (`docs/tech-decisions.md`) and carried by
`docs/hud-dom-proposal.md`. The boundary is the whole point of it: the world, the camera, the route
tiles, the sprites, the battle background, the combatants, the effects, the shake, the flash and the
fades keep drawing exactly as they draw today — no atlas, palette or tileset moves — and what leaves
Phaser is the **chrome**: panels, boxes, menus, bars, chips, lists, dialogs and sheets, in the menus,
in the routes and in the battle. It adds **twenty-seven tasks, `[Task-122]` to `[Task-148]`**, a new
**Phase 12**, **no `SAVE_VERSION` step** (it adds no run field, moves no draw and only reads the state
the engine already keeps) and **no dependency edge to the tail above it**: `src/scenes/RouteScene.ts`
is claimed once, by `[Task-128]`, `src/scenes/BattleScene.ts` at most once per batch,
`package.json` and `vite.config.ts` once, by `[Task-122]`, and `src/main.ts` once, by `[Task-124]`.

**Why eight batches and not one per screen.** Phase 12 is cut **for parallelism**: the plan's
constraint on this work was never dependency depth — every panel task needs the same six files and
nothing else — it was the two hot scenes. `[Task-128]` takes the panel layer out of
`src/scenes/RouteScene.ts` (the `D47` shape the room layer took in Batch 23b) and `[Task-124]` gives
every panel its own subfolder under `src/ui/hud/panels/`, so from Batch 61 the eleven route panels
are **four per batch** in four different paths instead of one per batch against one scene, and the
battle lane interleaves its five into the same batches.

- **Batch 58 — `[Task-122]`, `[Task-123]`, `[Task-128]`.** The pipeline and the harness, the state
  projection, and the extraction. None needs the DOM to exist, so all three start together.
- **Batch 59 — `[Task-124]`, `[Task-125]`, `[Task-126]`.** The shell and the font, the kit, the
  fixture flag. `[Task-124]` owns both HUD folder maps (`src/ui/hud/README.md` and
  `src/ui/hud/panels/README.md`) and writes one line per planned subfolder, so the eleven migrations
  in Batches 61 to 64 add files only inside their own folder and never collide on a README.
- **Batch 60 — `[Task-127]` alone.** The spike **is** the gate (`D49`): if Options `02` cannot hold
  390×844 and 1280×800 inside 2 px and ΔE 2, the rest of the phase does not start and every screen
  keeps its Phaser version. One slot is empty on purpose and the constraint is this line.
- **Batches 61 to 64 — the route lane and the battle lane interleaved**, four tasks each:
  `61` 129/130/131 + 140, `62` 132/133/134 + 141, `63` 135/136/137 + 142, `64` 138/139 + 143 + 145.
  A route task owns only its own `src/scenes/panels/<name>.ts` and its own
  `src/ui/hud/panels/<name>/`; a battle task owns `src/scenes/BattleScene.ts`, so **one per batch**.
- **Batch 65 — `[Task-144]`, `[Task-147]`, `[Task-148]`.** The message box (the last
  `BattleScene.ts` slot, and the one that changes pacing), the starter and run over. `[Task-146]`
  was cut out of this batch on `2026-10-25`: it had no screen and no store to migrate, so it is now
  `[Task-152]` (the store) and `[Task-155]` (the screen) in Phase 13, and Batch 65 shipped three.

**What keeps this phase honest.** Every screen ships with a fixture and a diff, and a screen that
cannot pass keeps its Phaser version with the flag still pointing at it (`D49`); no batch closes
half-migrated. The engine is untouched: no `src/engine/**` path, no RNG stream and no save field is
claimed by any of the twenty-seven, which is why the phase adds no version step and re-pins no seed.
`[Task-139]` is the only decision left inside the phase — the touch pad — and it is decided last,
after the panels, when the bridge has proven it can take the presses.

**The one risk in the cut is `[Task-128]`.** Moving the panel layer out of a 7,400-line scene is the
largest pure move in the phase and it is the only reason Batches 61 to 64 can be four wide. If its
Task QA finds a behaviour change it cannot explain, it is reverted whole and the route lane falls back
to **one panel per batch** (`129`, `130`, ... against `src/scenes/RouteScene.ts`), which is the same
tasks with the batches merged: the cut is a label, so the backlog survives the fallback.

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

### Batch 5b — FireRed's grass step, a finished run's destination, the evolution curve, the battle panel's types and the Mart's four rows *(shipped, archived)*
Task-45, Task-46, Task-51, Task-53 and Task-54 merged in ID order behind the green gate; the
detail is in `CHANGELOG.md`'s `## Unreleased`, and QA validated the batch twice and reported it
fully green. The batch changed shape on the way, and that is what it shipped. **Task-45 ended up
packing the real FireRed rustle**: the decompilation's `graphics/field_effects/pics/tall_grass.png`
(five 16x16 frames) is stamped into atlas cells **6** and **45-48** of all three
`src/assets/frlg/*.png` by `scripts/frlg/build-tilesets.mjs`, which now takes **both** source
sheets on the command line (absolute paths, per the Legend's Asset trees rule), with the sequence
declared as `FRLG_GRASS_RUSTLE_FRAMES` in `src/data/tilesets/frlg.ts` and the only new contract a
single optional `TilesetConfig.grassRustle` frame list — and `RouteScene` **cycles those frames
once per step on the player's own tile** (~70 ms a frame, the sprite parked on the rest frame
between steps), which replaces the synthetic 2 px lift the plan first froze; `docs/art-direction.md`
gained the rip's provenance line beside its FRLG block, and no other tall-grass cell animates.
**Task-46** sends both a win and a loss to the main menu, the summary still reporting the win.
**Task-51** resolves every non-level evolution to the species' **BST band** (20 / 30 / 40) with the
**+10 floor** above the evolution that produced it and the map's cap kept, so a late stone line
waits. **Task-53** draws the active Pokémon's types under **both** HP panels and **needed a
correction round after QA**: the taller foe panel was hiding 33 px of the compact layout's foe
battler, so the platform is now pinned clear of it and the check reports **0 px**. **Task-54** gave
the Mart its four stock rows (a 10x ball pack, the band's potion rung and two held items at their
catalogue prices, with every cure and X-item gone from the buy list) and — as the entry recorded —
Task-22's per-band machine row is still appended last, so the shelf shows five rows. None of the
five added a run field or a `SAVE_VERSION` step, so the version chain stays
**14 → 15 → 16 → 17 → 18**, and none of them claimed `package.json`, `src/main.ts`,
`vite.config.ts`, `src/data/dex/**` or `src/engine/save.ts`. Its five IDs are retired: they keep
their place in the sequence and are never reused.

### Batch 5c — the level curve re-planned, the battle panels' type badges doubled, and the tall grass laid over the player's legs *(shipped, archived)*
Task-69, Task-72 and Task-73 merged in ID order behind the green gate (1369 tests, `npm test` +
`npm run build` after each merge — 1369 again) and the detail is in `CHANGELOG.md`'s
`## Unreleased`; QA validated the batch green twice, once whole and once focused after Task-73's
third cut. **Two of the three changed shape on the way, and that is what shipped.** **Task-69**
re-planned the level curve: a finite run is **eight maps, levels 2 → 55**, first floor **2–9**
(cap **9**, which is +4 for the level-5 starter), caps **9 / 16 / 23 / 30 / 37 / 43 / 49 / 55**,
`LEVEL_BANDS` re-spanned over `2..55` with `trainerXp` **re-solved** so the repo's own rule still
holds — `0.75 ×` a floor's trainers pays that floor's cap, every fill inside `1 – 1.5`
(**1.09-1.44**, the two early floors at **≥ 1.3** for the density pass behind it) — and the
`mapTuning` defect fixed so a map past the last row climbs at **both** ends and saturates at
`MAP_MAX_LEVEL` instead of settling into a widening 40–100 band; one line of
`src/engine/run/progression.test.ts` was re-pinned (`bandForLevel(10)`: `mid` → `low`) and the
floating-point identity its boundary loop pins constrained the solved multipliers (`late = 4.64`
fails it, `4.65` holds). **Task-72** drew the battle panels' type badges at **×2** — 64×28 badges
in a **36** px row, `FOE_PANEL.h` **150**, `PLAYER_PANEL_H` **184** and the fallback chip at
72×36 — and kept the compact invariant Task-53's correction round established: **0 px** of either
battler behind a panel at the `COMPACT_SIZE` threshold and on a 640-px-tall phone, with
`FOE_PLATFORM_CLEAR` left untouched. **Task-73** took **three cuts**: the first froze a scene
anchor and the dev proved it was not the blocker (the captures before and after are
pixel-identical); the second stopped the packer re-grounding the rip's frames, so the overlay
draws **only the blades**, with the rip's own alpha; and the third — on the human's ruling that
the still pose must cover about half too — parked the sprite on the rip's **settled frame**, so
standing still covers **13.5 of the player's 28.5 visible px (47 %)** and leaves **15 px** clear.
Its closing frame was opaque over the whole cell — correct against the rip, but it hid the
character's head (**816 px** over the player on the desktop, **864** on the compact layout), so the
shipped defect batch **5cb** (Task-74) crops the overlay at cell **row 6**
and no frame of the beat draws above the player's hips any more; that crop is the fix for the
follow-up report, not a change to 5c's own cells. Cells **6** and **45-48** of
the three FRLG atlases are the only art that moved, `docs/tileset-spec.md` §6 records the new
rule, and none of the three added a run field or a `SAVE_VERSION` step, so the version chain
stays **14 → 15 → 16 → 17 → 18**. Its three IDs are retired: they keep their place in the
sequence and are never reused.

### Batch 5cb — the forest's tall grass stops painting a lighter green over its dark tuft *(shipped, archived)*
Task-74 merged alone behind the green gate (**1372** tests, `npm test` + `npm run build`) and the
detail is in `CHANGELOG.md`'s `## Unreleased`; QA validated it green **twice**, once for the
per-field tint and once for the row-6 clip. It shipped in two halves, both **data plus one scene
line**, with no repack of any atlas. **(a) The tint.** The decompilation's effect art is the
**outdoor** palette's while the packer stamps the same five rustle cells in every field, so in the
forest — the only biome `BIOME_ORDER` walks — the parked overlay painted light blades
(`78,148,81`) over the field's own dark tuft (`59,125,76`), `+19/+23/+5` per channel. Each FRLG
field now declares a **`grassRustleTint`** in the tileset data (`0xC1D7EF` for the forest,
`0xffffff` for outdoor and cave, which share one config, derived as the per-channel ratio of the
two means) and `RouteScene` applies it to its single overlay sprite — `TilesetConfig` gained one
optional field and nothing else, the tint colours the blades **only** (the cells keep their alpha,
so the field's own ground still shows through), and the forest's parked overlay now measures
`59.4, 125.2, 76.7` against the neighbouring tuft's `59.8, 125.3, 76.4`. **(b) The clip.** With the
closing frame now wearing the ground's own colour it read as the background jumping on top of the
player: it was opaque over the whole cell (its art starts at row 0, so it covered the head —
**816 px** over the character on the desktop, **864** on the compact layout) and the hit "tapa todo
el personaje". The same sprite is now cropped to the cell's **rows 6-15**
(`setCrop(0, 6, 16, 10)`), so **no frame of the hit ever draws above cell row 6** and the parked
band still covers the lower half exactly as before; the beat, the anchor, the frame list and the
three atlases all stayed as Batch 5c shipped them. `src/data/tilesets/frlg.test.ts` pins both
halves to the art (the tinted means against each field's tuft, and the five cells' first opaque
rows `45 → 0, 46 → 2, 47 → 5, 6/48 → 6`), and `docs/tileset-spec.md` §6 records the per-field tint
rule and the row-6 clip in place of the sentence that said the closing frame closed over the cell.
The task added no run field, so **no `SAVE_VERSION`** step — the chain stays
**14 → 15 → 16 → 17 → 18** — and it drew no RNG. Its ID is retired: it keeps its place in the
sequence and is never reused.

### Batch 5d — the early floors thin out *(shipped, archived)*
Task-70 merged alone behind the green gate (**1382** tests, `npm test` + `npm run build`) and the
detail is in `CHANGELOG.md`'s `## Unreleased`; QA validated it green in both waves, its Task QA
driving a real seeded run. **It shipped as designed, and the spec's one discovery — that a smaller
map 1 shifts `routeIndexForRoom` (`src/engine/run/floors.ts`, 48-53) and re-rolls maps 2-8's
routes — is what shaped the result.** `src/data/population.ts` holds
`POPULATION: Record<BandId, BandPopulation>` (`early { -1, 0.5 }`, `low { -1, 0.75 }`, the four
later bands `{ 0, 1 }` and thus bit-identical to a request that passes none),
`RouteRequest.population?` threads it into `placeTrainers` (the spine guard is never thinned; a
pocket's guard spends one draw only when `0 < guardChance < 1`), and the scene passes
`population: POPULATION[band.id]` in `buildRoute` (one line). `ROUTE_LOOT`'s `early`/`low`
`itemChance` fall to **0.5 / 0.6**; `plan.ts` gains `SHOP_FROM_MAP = 2` and `hangsShop(mapIndex)`,
so **map 1 hangs no shop leaf** (six rooms, seven when its mini-boss rolls). The eight-floor walk
now measures floor 1 at **5.67 trainers** (was 12.00) and floor 2 at **6.33** (was 12.33), and
`trainerXp` re-solved **early 1.35 → 2.67** and **low 6.08 → 10.68** (no other row moved) so every
floor's fill sits inside `1 – 1.5`, maps 1-2 inside `1.20 – 1.35`. `docs/balance/route-curve.md`
is rewritten to the measurement, and `docs/maps-spec.md` §7, `docs/design-spec.md` §7,
`docs/route-generator.md` and `src/data/README.md` carry the new rule. It adds no run field, so
**no `SAVE_VERSION` step** — the chain stays **14 → 15 → 16 → 17 → 18** — and `src/ui/mapView.ts` /
`mapView.test.ts` closed **untouched** as the design predicted. Its ID is retired: it keeps its
place in the sequence and is never reused.

### Batch 5e — a boss fields six, a mini-boss three *(shipped, archived)*
Task-71 merged alone behind the green gate (**1394** tests, `npm test` + `npm run build`) and the
detail is in `CHANGELOG.md`'s `## Unreleased`; QA validated it green in both waves, its Task QA
walking a real seeded run through the doors into the boss's cone. `src/data/bosses.ts` is new and
holds `BOSS_PARTY: Record<BossPartyKind, { firstMap; size }>` (`boss { firstMap: 3, size: 6 }`,
`miniboss { firstMap: 2, size: 3 }`) plus the pure `bossPartySize(kind, mapIndex)`, and
`RosterOptions` gains an optional `count` (`Math.max(1, options.count ?? band.trainerSize)`), so
the two fights no longer derive their size from the band. The scene passes
`count: bossPartySize(kind, room.mapIndex)` for exactly the boss and mini-boss rosters, so a boss
always fields **six** and a mini-boss **three**, with **map 1** the exception at **three** and
**two**. The band default is untouched (the new `count` is optional, so the ordinary rosters and
every existing fixed-seed expectation stay as they were), and the task drew no RNG of its own — it
only changes how many draws the roster's existing stream spends. `docs/maps-spec.md` §6 and its §7
mini-boss row, `docs/battle-spec.md` §7, `docs/balance/route-curve.md`'s Exceptions bullet,
`docs/data-spec.md` and `src/data/README.md` carry the rule; the boss award is left **uncapped**
and recorded as a decision for Task-09 to weigh. It adds no run field, so **no `SAVE_VERSION`
step** — the chain stays **14 → 15 → 16 → 17 → 18**. Its ID is retired: it keeps its place in the
sequence and is never reused.

### Batch 5eb — dev teleports and the two ignore toggles *(shipped, archived)*
Task-75 merged alone behind the green gate (**1399** tests, `npm test` + `npm run build`) and the
detail is in `CHANGELOG.md`'s `## Unreleased`; QA validated it green, its Task QA exercising the
three teleports and both toggles on a live run and its Integration QA rehearsing the merge. The
debug overlay's Route tab gained a *Teleport* block (`Floor` / `Room` / `X`,`Y` inputs with `auto`
placeholders, three `Go` buttons, a `#debug-location` readout and its own `#debug-teleport-status`
line) and its General tab the two checkboxes; `src/main.ts` wires the five new handlers, the
pattern every handler in the tree already follows. `src/scenes/RouteScene.ts` adds
`teleportToFloor` / `teleportToRoom` / `teleportToTile` and `setIgnoreEncounters` /
`setIgnoreTrainers`, reusing the shipped `advanceMap`/`advanceRoute`, `transitionTo` and
`movePlayerTo` rather than inventing a second way to change rooms; `debugLocationLabel` is the new
pure helper (four exact strings, one test each). The **boss and mini-boss are trainers** for the
sight toggle, so it stops them too and the portal stays sealed until the boss falls (D31); the
floor teleport does **not** heal (the menu has its own *Heal*) and resets the destination floor's
per-floor bookkeeping exactly as `advanceMap` does. Both toggles are dev-only and unsaved — a run
they are on no longer matches its seeded stream, because a skipped roll spends no draw, and the
entry states that plainly — and the ignore-trainers gate covers **both** sight paths
(`trainerSpotted` and the spinning trainer's `seesPlayer` branch). It adds no run field, so **no
`SAVE_VERSION` step** — the chain stays **14 → 15 → 16 → 17 → 18**. Its ID is retired: it keeps
its place in the sequence and is never reused.

### Batch 5f — the overworld sprite set *(shipped, archived)*
Task-76 merged alone behind the green gate (**1404** tests, `npm test` + `npm run build`) and the
detail is in `CHANGELOG.md`'s `## Unreleased`; QA validated it in a single pass (a one-task batch)
with its `[live]` criterion comparing three hand-resolved formes against PMD Collab. The three
tools under `scripts/legacy-art/` were adapted from the sibling project's dependency-free pipeline
(`zip-codec.mjs` / `png-codec.mjs`, no new npm package), taking their source tree through
`--dest`/`--source` as an **absolute** path under the main checkout, never a tree linked into a
worktree (the Legend's **Asset trees** rule). The set now covers **1163 of the 1282 playable
species and formes** — the 637 shipped pairs that carried real animation plus **526 new pairs**
packed from PMD Collab — with the other **119** recorded in the new coverage manifest
`src/assets/pokemon/index.json`'s `missing` list: 15 nums below 650 whose committed pair is still a
`generate-pokemon.mjs` placeholder and which the server has no usable art for, and the rest Gen 6+
formes with no upstream pack. The manifest (`sprite` 32, `rows` 5, `dirRows`
`down/downright/up/upright/left`, `files` id → `fileId`, `missing` ids) is a **generated** file
(`node scripts/legacy-art/build-pokemon-index.mjs`, byte-reproducible) and is the frozen interface
`[Task-41]` reads. The 652 pairs that already carried `durationsMs` were **not re-cut** (the diff
is additions only; the three Castform pairs untouched), `src/assets/README.md` and
`docs/art-direction.md` record the tier's provenance, and it adds no run field, so **no
`SAVE_VERSION` step** — the chain stays **14 → 15 → 16 → 17 → 18**. Its ID is retired: it keeps
its place in the sequence and is never reused.

### Batch 6 — balance pass, Phase 9 docs, the battle SWITCH grid, the party's lead walks behind the player *(shipped, archived)*
The batch's four tasks merged in ID order behind the green gate (**1433** tests, `npm test` +
`npm run build` after each merge) and the detail is in `CHANGELOG.md`'s `## Unreleased`; QA
validated each task in its own lane and then the combined tree. **Task-09** ran the balance pass
over the shipped numbers and extracted the reusable `scriptedBattle()` harness beside
`golden.test.ts` — the golden log itself is byte-identical, only its source moved. **Task-17**
closed the Phase 9 docs: `docs/maps-spec.md`'s open questions became resolved records, the stale
counts were corrected against the tree (88 Megas, eight maps to level 55, the fixed boss parties,
the "from map 2 on" shop), and `AGENTS.md` gained the README convention, the two-wave QA loop and
the Asset-trees rule. **Task-34** redrew the battle SWITCH window as **six rows of a fixed cell
size** (the new pure `src/ui/partyGrid.ts` owns the geometry; the label is clipped, not wrapped,
and the arrows step member to member) — the cells no longer stretch to fill the panel. **Task-41**
put the party's lead behind the player on a route: `src/data/pokemonOverworld.ts` resolves a
species id through Task-76's manifest, `src/render/pokemonFollower.ts` registers the idle and walk
strips per facing, and `RouteScene` trails it one tile, flips it and rebuilds it on a lead or room
change — **with its idle looping while the player stands still** (a change the human asked for
after the first QA). None of the four added a run field, so **no `SAVE_VERSION` step** — the chain
stays **14 → 15 → 16 → 17 → 18**. Their four IDs are retired: they keep their place in the
sequence and are never reused.

### Batch 6b — the learnset band scrolls, and a trainer's remaining team sits under its panel *(shipped, archived)*
Task-38 and Task-57 merged in ID order behind the green gate (**1447** tests, `npm test` +
`npm run build` after each merge) and the detail is in `CHANGELOG.md`'s `## Unreleased`; QA
validated each task in its own lane and then the combined tree. **Task-38** replaced the band's
paging with a one-row **scroll**: the new pure `src/ui/scroll.ts` (`maxScrollTop` /
`clampScrollTop` / `scrollByRows` / `visibleRange`) owns the maths, the wheel, the `<` / `>`
controls and a drag on the band's own background all scroll it, the search field keeps the width
the glyphs occupied, and the `1/3` counter and the page-step are gone. Its `[live]`
band-background-drag criterion was **corrected in the spec** — its first press point fell inside
the panel's 12 px move ring (`HUD_PANEL_BORDER`), which is not a code defect — and the shipped
implementation was correct as written. **Task-57** draws a trainer's remaining team as **Poké
Balls under its HP panel**: the row is the **foe's alone**, a **wild** battle draws **none**, and
it is **fixed** — one ball per roster member with the fainted ones emptied, so it also says how
many the trainer started with — with the active ball dimmed in the same repaint that empties its
bar. Neither added a run field, so **no `SAVE_VERSION` step** — the chain stays
**14 → 15 → 16 → 17 → 18**. Their two IDs are retired: they keep their place in the sequence and
are never reused.

### Batch 7 — Gigantamax, route-scoped catch swap, the main menu's Continue row
**(shipped and archived)**: its three tasks merged in ID order behind the green gate
(`task-18`, `task-31`, `task-47`), the gate green after each merge, and the detail is
in `CHANGELOG.md`'s `## Unreleased`. What follows is the cut's own record.
- **Task-18** Gigantamax, in the Mega Evolution mould.
- **Task-31** A full party sends the catch to the PC, swappable only on that route.
- **Task-47** The main menu's Continue row shows the map, its biome and the party's icons.
- **Hot files:** `scripts/build-dex.mjs`, `scripts/anil/build-pokemon-sprites.mjs`,
  `src/data/dex/**` (the new `gmaxes.json`), `src/data/anil/pokemon-sprites.json`
  and the two regenerated portrait atlases `public/anil/portraits{,-shiny}.png`
  (the packer's own output for the new G-Max cells — the batch's one packed asset,
  see the correction below) and `src/scenes/BattleScene.ts` → Task-18;
  `src/scenes/RouteScene.ts`, `src/engine/run/state.ts` + `state.test.ts`,
  `src/engine/run/resolve.ts` + `resolve.test.ts`, `src/engine/save.ts` +
  `save.test.ts`, `src/ui/partyScreen.ts`, the new `src/ui/notice.ts` +
  `notice.test.ts`, `src/ui/README.md` (its `notice.ts` role line, the per-folder
  convention) and `docs/routes-spec.md` → Task-31; `src/scenes/MainMenuScene.ts`,
  `src/ui/runSummary.ts` + `runSummary.test.ts` and `docs/design-spec.md` §2 → Task-47.
  None of the three claims `package.json`, `src/main.ts` or `vite.config.ts`, and
  Task-18's own regeneration of the Añil manifest is what rewrites the two packed
  portrait atlases named above (the entry first read "or a packed asset": the
  manifest is written by its packer, so the atlases it packs go with it).
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
**(shipped and archived)**: its four tasks are closed — Task-14 alone in the first
end-to-end cycle (*solo existe el bosque*), then Task-08, Task-20 and Task-23 merged
in ID order behind the green gate (`task-08`, `task-20`, `task-23`; **1535** tests,
`npm test` + `npm run build` green after each merge), and the detail is in
`CHANGELOG.md`'s `## Unreleased`. Task-08 took `D45`; Task-20 needed **no** scene
change (the shipped click path carries the new branches) and left the generated dex
untouched; Task-23 regenerated the `D16` coverage table and moved no fixed seed.
Three `agent-review` issues carry the six `[live]` criteria this environment cannot
measure. What follows is the cut's own record.
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
**(shipped and archived)**: its one task is closed — Task-35 merged alone behind the
green gate (`task-35`; **1565** tests, `npm test` + `npm run build` green on the merge
commit), and the detail is in `CHANGELOG.md`'s `## Unreleased`. It shipped the
cartridge's AI flags as **data** on `TrainerArchetype.aiFlags`, a rewritten
`chooseAiCommand` whose tie-break draws from the battle's own `Rng` (the lowest index at
the default level), the wild's random-with-PP policy and one `Settings.aiLevel` row
(`Normal` / `Hard`, no `SAVE_VERSION` step — the chain stays 14 → 15 → 16 → 17 → 18).
One `agent-review` issue carries the one `[live]` criterion this environment cannot
measure. What follows is the cut's own record.
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

### Batch 9 — the STATS graph's Mega row, and the ⓘ's two dead hit tests **(shipped and archived)**
**(shipped and archived)**: its two tasks are closed — Task-21 and Task-39 merged in ID
order behind the green gate (`task-21`, `task-39`; **1577** tests, `npm test` + `npm run
build` green after each merge, 135 test files), and the detail is in `CHANGELOG.md`'s
`## Unreleased`. QA validated each task in its own lane (both green, on tips `d3331d2f` and
`57a5a510`) and then the combined tree: the eight paths of the union with no overlap, no hot
file, `src/engine/` byte-identical and the generated dex reproduced byte for byte, and both
merge orders conflict-free. Three findings the cut did not carry, recorded here because they
are what shipped: **(a)** Task-21 claimed a fifth path, `src/ui/partyDetail.test.ts`, to
**re-pin** its Charmander family expectation — the information rows hang off the node of the
species that owns the forme (`a row hanging off its base species`, read literally), so a
Charmander's panel lists Charizard's rows and that test's three ids became six; no batch-mate
held the path, so the batch stayed an antichain. **(b)** The row's clause is `Mega Evolves
**with** <stone>`, not the plan's `while holding`: measured against the shipped font, the long
form is 312 px against the 288 px box a depth-3 row has, the shipped one 267 px. **(c)** The
battle half's hover **could not be reproduced** as an arithmetic defect — on pristine `main`
the click and the hover were fed the same local point and the same rect, so the two
classifiers returned the same boolean — so Task-39 ships the duplicate's removal and the live
pointer classifier, and that hover is a `[live]` check rather than a proven fix. One
`agent-review` issue (#6) carries the batch's six `[live]` criteria. Their two IDs are
retired: they keep their place in the sequence and are never reused. What follows is the
cut's own record.
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
  planned: `src/ui/evolutionGraph.ts` is the file Task-20 rewrote in Batch 8, and Batch 7's
  Task-18 does **not** claim it (the G-Max formes reach the graph as Task-21's own sibling
  row, "the same kind of row", so Batch 7 leaves the file free and Task-21 is its first
  writer here). Task-39's file `src/ui/moveGrid.ts` is free here and stays free
  until Batch 11's reformat.

### Batch 9b — the battle's entry beat
**(shipped and archived)**: its one task is closed — Task-40 merged alone behind the
green gate (`task-40`; **1582** tests, `npm test` + `npm run build` green on the
merge commit) and the detail is in `CHANGELOG.md`'s `## Unreleased`. QA validated it
in the single pass a one-task batch collapses to — the task's plan, the two gates,
the cross-task audit and the merge rehearsal on one tree — with every `[unit]`
criterion green; the three `[live]` criteria cannot be measured on this browserless
runner and one `agent-review` issue carries them. It shipped as the spec froze it —
the beat's step order and timings as data in `src/ui/beats.ts` (`entryBeat` over the
seven `ENTRY_*` constants: a 320 ms black-out fade, one 220 ms camera flash, then the
foe's 300 ms drop or a trainer's 280 ms walk-in and a 260 ms send-out, the flash
dropping under **Reduce flashing**), the scene playing it and leaving the first feed
frame untouched — and the one deviation from the cut's own wording is recorded rather
than hidden: `src/scenes/RouteScene.ts` came out **unclaimed**, because the hand-off
already paints the cut black through the beat's own first step and a route-side
fade-out would have been the second full-screen change the Decision forbids, so the
batch's four paths are `src/ui/beats.ts`, `src/ui/beats.test.ts`,
`src/scenes/BattleScene.ts` and one bullet in `docs/design-spec.md` §4. Its ID is
retired: it keeps its place in the sequence and is never reused. What follows is the
cut's own record.
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
**(shipped and archived)**: its one task is closed — Task-26 merged alone behind the
green gate (`task-26`; **1627** tests, `npm test` + `npm run build` green on the
merge commit) and the detail is in `CHANGELOG.md`'s `## Unreleased`. QA validated it
in the single pass a one-task batch collapses to — the task's plan, the two gates,
the cross-task audit and the merge rehearsal on one tree — and it took **one
correction round**, which is what the merge carries: the eight `[unit]` criteria and
the three `[live]` criteria were green on the first tip, but QA's hunt for sweep
leftovers found two defects the spec's own gates cannot see — the permadeath
overlay's hint called `t('release.controls', { key })` where the key declares
`{confirm}`, so `buildReleaseOverlay()` **threw** the first time a party member fell
(`RouteScene` 6505, reached from `playReleaseBeats` with no `try`), and `dev.move` had
lost its index because its `en` value carried no `{n}` while the call site passed one
(`debugMenu` 823), so the dev panel rendered `Move` four times where `main` rendered
`Move 1`…`Move 4`. Both are fixed at the call site / in the two tables, and the class
of bug is now gated headlessly: `src/i18n/index.test.ts` gained a `describe('the call
sites')` that scans every `t('<key>', { … })` in `src/**` against
`translationParams(en[key])` in both directions (279 sites, 0 findings) and pins the
two interpolated results in both locales. Its declared limit: a call site whose key is
not a literal is skipped by the scan. The batch's one deviation from the cut's own
wording is recorded rather than hidden: the backlog asks for the settings line in
`docs/design-spec.md` §7, but §7 is "Special rooms & money", so the paragraph went to
**§8 (Settings)**, where the shipped knobs already live. Its ID is retired: it keeps
its place in the sequence and is never reused. What follows is the cut's own record.
- **Task-26** i18n module and the Spanish locale.
- **Hot files:** every `src/scenes/*.ts` → Task-26; `src/engine/save.ts` → Task-26.
- **Shape:** last on purpose. It moves every player-facing literal behind a key, so it
  must see the panels Task-12, Task-13 and Task-16 added, Task-31's catch notice, and
  the strings Batch 8's
  accessibility pass introduced.

### Batch 11 — the Prettier reformat pass (last of the planned backlog)
**(shipped and archived)**: its one task is closed — Task-29 merged alone behind the green
gate (`task-29`; **1627** tests, `npm test` + `npm run build` green on the merge commit
`e89b80a5`, and `npm run lint` green with it) and the detail is in `CHANGELOG.md`'s
`## Unreleased`. QA validated it in the single pass a one-task batch collapses to — the
task's plan, the two gates, the cross-task audit and the merge rehearsal on one tree — and
it spends **zero** browser budget, because every criterion of the task is `[unit]` and it
declares no `[live]` one: all eight came back green on the first tip, with the rehearsal's
`--no-ff` merge landing on the integration commit's own tree. **What shipped, and the
counts the cut got wrong:** the ledger's `src/**` block is **104** individual files, not the
105 the entry below claims, and the generated-data globs are **five** (`src/assets/**`,
`src/data/dex/**`, `src/data/frlg/**`, `src/data/anil/**`, `src/data/ui/**`), not four.
**103** of the 104 genuinely rewrote; `src/data/shop.ts` was already Prettier-clean, so it
stays byte-identical and the audited diff is **104 paths** (103 reformats plus
`.prettierignore`), one path fewer than the exclusive list. `docs/agent-ci.md` — a tracked
process doc the CI work added, which `prettier --check .` flagged and the ledger had never
listed — **joins the prose/process block** instead of being reformatted, so `npm run lint`
(`prettier --check .`) exits **0** with **no per-file escape hatch left under `src/**`**;
the obsolete "157 tracked files" block is gone and each surviving block says what it holds
and why. `.prettierignore` goes **132 → 29 entries** (51 lines). The reformat is provable
without reading its 4 144/1 644 lines: every changed byte is Prettier 3.9.10's own output
over the base revision (**103/103**), `tsc --noEmit` and the suite stay green, and the one
test that reads these sources as text — `src/i18n/index.test.ts`'s call-site scanner — sees
exactly what it saw before the reflow (170 files, 279 sites, same `(file, key, params)`
multiset; 25 assertions green in isolation). One criterion was **amended by the
Orchestrator before the pass**: the ledger check anchors at `^docs/agent-ci\.md$`, because
the byte-frozen prose block names that file in its own comment. Its ID is retired: it keeps
its place in the sequence and is never reused. What follows is the cut's own record.
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

### Batch 12 — a hit's sound, a cry *(shipped, archived)*
Task-30 merged alone behind the green gate (`task-30`; **1639** tests across 137 files,
`npm test` + `npm run build` green on the merge commit `0c2f5248`) and the detail is in
`CHANGELOG.md`'s `## Unreleased`; QA validated it in the single pass a one-task batch
collapses to — the task's plan, both gates, the cross-task audit and the merge rehearsal on
one tree — with every `[unit]` criterion green and both measurable `[live]` criteria
**measured** on a dev server over CDP (the vocabulary boots whole: 525 loaded keys against
525 table ids, 0 failed files; a wild encounter plays `cry-pikachu` exactly once; a turn
plays the move's own cue or `hit`); the third `[live]` criterion is a **listening**
judgement this runner cannot make, so it went to an `agent-review` issue (#9) and did not block
the merge. **What shipped, and the counts the cut got wrong.** The vocabulary grows from six
cues to **525** — the six that ship (byte-identical), the shared `hit`, **130** `move-*`
(one per `SE_M_*` MIDI) and **388** `cry-*` (one per cry sample) — committed as **519 new**
`src/assets/audio/*.wav` (13.1 MiB; the audio tree is 20.1 MiB) through the two existing
scripts, which now take their source, renderer and intermediate directories as **absolute**
paths through argv/env. Two **generated** tables drive it: `cries.json` **455** rows (every
species with `num ≤ 386`, resolved **by name**, not by `cry_tables.inc`'s row order — that
table is indexed by the game's *internal* species number, so a row-index mapping would be
wrong for every Gen 3 species) and `moveSounds.json` **295** rows (parsed from
`data/battle_anim_scripts.s`, whose per-move animation block names the cartridge's own
sound; the three cartridge renames — `VICE_GRIP`, `FAINT_ATTACK`, `HI_JUMP_KICK` — are a
hand-written alias table). **Two things the cut's own wording got wrong, measured and
corrected in the spec before the pass:** the block's sound is its first `playse`-family
command at the start of a line, `waitplaysewithpan` **included** (the numbers 297 blocks /
295 rows only fall out that way, and `HORN_DRILL`/`SKULL_BASH` are *not* skipped), and 27
of the 130 `se_m_*` lines **do** carry a `-V` in `midi.cfg`. The family gain moved to the
**packer**: the cry intermediates are the decompilation's verbatim 8-bit samples and the
move ones are stereo, so only a gain over packed mono PCM lands each family's loudest cue
on `0.85 × 32767`. One shipped cue is digital silence — `move-dizzy-punch`, whose own MIDI
mixes to zero at the voicegroup `midi.cfg` declares for it and which no table row
references — and `cues.test.ts` names it in a one-entry exception list rather than
loosening the check for the other 524. The cry plays in `BattleScene`'s entry beat, once
per battle, at whichever appearance step runs (a wild's `foe-appear`, a trainer's
`sendout`), so `src/scenes/RouteScene.ts` came out **unclaimed** — a cry at the hand-off
would have been doubled by the beat over the frame the fade is already cutting to black.
It adds no run field, so **no `SAVE_VERSION`** step — the chain stays
**14 → 15 → 16 → 17 → 18** — and it drew no RNG. Its ID is retired: it keeps its place in
the sequence and is never reused. What follows is the cut's own record.
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
**(shipped, archived)**: its two tasks merged in ID order behind the green gate
(`task-44`, `task-59`; **1650** tests across 137 files, `npm test` + `npm run build`
green after each merge) and the detail is in `CHANGELOG.md`'s `## Unreleased`; QA
validated each task in its own lane (Task QA) and then the combined tree (Integration
QA), and the Orchestrator **re-measured every `[live]` criterion itself** on the
combined commit with a dev server and a headless Chromium over CDP. **One spec defect
was found and corrected rather than hidden:** task-44's `[live]` veil clause aimed its
reference pixel at `hudBoxTabs[0]`, which with the spec's own seed is the *active* page
tab (`0x2f2c4d`), so its "at least 40 darker" threshold was unsatisfiable; the
corrected clause measures the declared composite `(108, 105, 128)` and proves it by
toggling the veil (`(207, 204, 226)` hidden, back to `(108, 105, 128)` — 99/channel),
and that task's QA re-ran the one clause green with its branch tip unmoved. **What
shipped.** **Task-44** stops deleting the fallen: `RunState.rip` (party-then-box order,
appended by `releaseFainted` beside `stats.casualties`), `SAVE_VERSION` **16 → 17** with
the step that defaults an old run's list to empty, `PaneId` a third wide with
`PANE_CYCLE`/`cyclePane`/`ripRows`, and the PC box's fixed **RIP** tab drawn at the
strip's right end under the locked cell's own veil (`HUD_BOX_MAX_PAGES` 8 → 7 to make
room) — the dead read-only everywhere (no grab, no deposit, no reorder, no revive, D5)
and their detail panel showing stats and moves with the rename field, the evolution
branches and the learnset pool hidden. **Task-59** gives each of the battle SWITCH
window's four move rows the HUD's ⓘ on a hit zone of its own (hover floats, a press
pins and is swallowed, so the member the window describes is never switched) and lifts
`MoveGrid`'s popup body into the exported pure `moveInfoContent(cell: MoveGridCell)`, so
the grid and the switch window cannot drift; the ability row's ⓘ keeps its hover-only
rule. Task-44 took the chain's **16 → 17** step and Task-59 added none, so the version
chain is **14 → 15 → 16 → 17 → 18**. Their two IDs are retired: they keep their place in
the sequence and are never reused. What follows is the cut's own record.
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
**(shipped, archived)**: its one task merged alone behind the green gate (`task-48`; **1658**
tests across 137 files, `npm test` + `npm run build` green on the merge commit) and the detail
is in `CHANGELOG.md`'s `## Unreleased`. QA validated it in the single pass a one-task batch
collapses to — the task's plan, both gates, the cross-task audit and the merge rehearsal on one
tree — with every `[unit]` criterion green, and its one `[live]` criterion was **measured
twice**, by QA on its own dev server and by the Orchestrator on the integration commit with a
dev server and a headless Chromium over CDP reading the live state: a fresh run hands the battle
`firstCatch true` and `attemptCapture` on a full-HP wild `charmander` with a plain ball returns
`{success: true, shakes: 4, value: 255}`, while the same battle after one `recordCatch` reads
`false` and returns `{success: false, value: 15}`. **What shipped.** **Task-48** carries the run
fact `stats.catches === 0` on the existing launch seam (`BattleLaunch.firstCatch` →
`BattleState.firstCatch`, defaulted `false` by `createBattle`) and resolves the roll through the
new pure `catchValueFor(fighter, ballBonus, firstCatch)`: while the flag is on the catch **value**
is the flat 255 `attemptCapture` already treats as an outright success, whatever the species, the
HP, the ball and the status; with it off the helper is the shipped formula byte for byte, so the
ball command, the shake loop and one draw per shake are untouched. One thing the cut's own
wording got wrong is recorded rather than hidden: the item's "flat 255" is applied as the
**value**, because a flat **rate** of 255 leaves a full-HP target at `255 × 1 / 3 = 85` — under
the threshold, failing about two thirds of its throws — so the item's own words ("ignores the
species", "cannot fail") only hold for the value. One `agent-review` issue carries that reading
for a human's confirmation. It adds no run field, so **no `SAVE_VERSION` step** — the chain stays
**14 → 15 → 16 → 17 → 18**. Its ID is retired: it keeps its place in the sequence and is never
reused. What follows is the cut's own record.
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

### Batch 15 — the item pickup popup, and the battle panel's XP bar
**(shipped, archived)**: its two tasks merged in ID order behind the green gate
(`task-49`, `task-77`; **1661** tests across 137 files, `npm test` + `npm run build` green after each
merge) and the detail is in `CHANGELOG.md`'s `## Unreleased`; QA validated each task in its own lane
(on tips `5ad49728` and `a70ab2cf`) and then the combined tree at `d676dd5a`, and the Orchestrator
**re-measured every `[live]` criterion itself** on that commit with its own dev server and a headless
Chromium over CDP. **What shipped.** **Task-49** gives the run's transient notice a second string:
`itemPickupNotice(name)` in the shipped `src/ui/notice.ts`, raised by the two otherwise-silent pickups
(the ground item and the mini-boss reward) through the HUD's existing strip, with the Mart keeping its
own in-window line and the new key `notice.itemObtained` authored in English and overlaid by Spanish.
**Task-77** removes the battle player panel's XP row — the gauge, the `XP n` label, the two fields
that existed only for them and the two imports — and drops `PLAYER_PANEL_H` **184 → 150** so the frame
hugs its content like the foe's, with `BattleLaunch.xp`, `experienceFraction`, `drawGauge` and the
route HUD's own bar (the one `D35` means) untouched. Neither added a run field, so **no
`SAVE_VERSION`** step — the chain stays **14 → 15 → 16 → 17 → 18** — and the two share no path. Two
things the cut's own wording left as questions were settled by their Decisions and are recorded in the
entries above: the player's panel takes **150**, and only the two silent pickups raise the notice.
Their two IDs are retired: they keep their place in the sequence and are never reused. What follows is
the cut's own record.

- **Task-49** Obtaining an item raises a temporary popup.
- **Task-77** The battle's HP panel loses its XP bar (registered by the nineteenth round; it
  takes this batch's free `src/scenes/BattleScene.ts`).
- **Hot files:** `src/scenes/RouteScene.ts` → Task-49; `src/ui/notice.ts` +
  `notice.test.ts` → Task-49 (the module Task-31 creates in Batch 7, extended here with
  the pickup notice); `docs/routes-spec.md` §2 (the ground-item bullet) and the i18n key
  table plus both locales (`src/i18n/**`, whose exact files are read from what Task-26
  ships) → Task-49; `src/scenes/BattleScene.ts` (the XP row alone: the gauge, the `XP n`
  label, the `xp`/`xpText` fields and the two imports that exist only for them) → Task-77,
  and the one clarifying clause in `docs/design-spec.md` §4 (171-174) is Task-77's too — it
  is free here because Task-49 holds `docs/routes-spec.md` §2 instead. Task-77 claims no
  `src/ui/**` file (`drawGauge` is left in place), no `src/engine/**` file, no `src/data/**`,
  no `package.json`, `src/main.ts`, `vite.config.ts` and no packed asset. Nothing else in the
  batch.
- **Shape:** two tasks that share no path, one batch after Batch 14. Task-49 is the second
  report of its round that owns `src/scenes/RouteScene.ts` — and after Batch 14 the scene is
  free of the whole 7–13 queue. Its dependency points backwards, not forwards: it **extends**
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
  module, N strings, one batch each. Task-77 is the batch's second member and takes the one
  free `src/scenes/BattleScene.ts` slot: that file is free here and nowhere earlier, because
  Batch 6b is `cut` (it can gain no member) and every batch from 7 to 14 holds it (7
  Task-18's Gigantamax, 8 Task-08's every-scene sweep, 8b Task-35, 9 Task-39, 9b Task-40, 10
  Task-26's every-scene sweep, 11 Task-29's ledger, 12 Task-30, 13 Task-59, 14 Task-48) —
  so this is the **first** batch that leaves the battle panel nobody's, and it is
  presentation only: it removes the squad's XP gauge and label from the player's panel, adds
  no run field, changes no rule and draws no RNG, so **no `SAVE_VERSION`** step. It edits a
  file Batch 11's reformat cleared, so it keeps it conforming (no new ledger line), the way
  Batch 12–14 do. It lands **before** the scene's three later claimants — Task-60 (Batch
  17), Task-55 (Batch 18) and Task-62 (Batch 22) — so none of them is re-planned; their own
  "free batch" lists lose 15 as the nineteenth round records.

### Batch 16 — the level-up popup
**(shipped, archived)**: its one task merged alone behind the green gate (`task-50`; **1664** tests
across 137 files, `npm test` + `npm run build` + `npm run lint` green on the merge commit `1e87ee7c`)
and the detail is in `CHANGELOG.md`'s `## Unreleased`. QA validated it in the single pass a one-task
batch collapses to — the task's plan, both gates, the cross-task audit and the merge rehearsal on the
integration commit `52d041db` — every `[unit]` criterion green, and the Orchestrator **measured every
`[live]` criterion itself** on that commit with a dev server and a headless Chromium over CDP.
**What shipped.** **Task-50** gives the run's transient notice a **third** string: `levelUpNotice(name,
level)` in the shipped `src/ui/notice.ts`, raised **once per level-up beat** from `playLevelUp`'s
`onComplete` — before `refreshHud()` and before `showLearnPopup(beats)` — so a level that crosses no
move is no longer silent, through the HUD's existing strip and with the new key `notice.levelUp`
authored in English and overlaid by Spanish. The key-dismissed `LEVEL UP` modal **stays** for the move
names, as the *Decision* froze: a crossed move raises both, in the same beat. Two beats **replace each
other** by `showNotice`'s shipped contract, so the last beat's line is the one that stays. The docs
clause went to §3's detail-panel bullet, where the modal sentence actually is (the cut's §5 pointer was
stale). It adds no run field and draws no RNG, so **no `SAVE_VERSION` step** — the chain stays
**14 → 15 → 16 → 17 → 18**. One spec defect is recorded rather than hidden: the self-dismiss
criterion's wall-clock probe was defeated by the headless frame rate (Phaser clamps the frame delta),
so it was re-measured on the game clock (`noticeTimer.delay` 2600; 2633 ms observed) plus a
`+4200` wall margin. Its ID is retired: it keeps its place in the sequence and is never reused. What
follows is the cut's own record.

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
**(shipped, archived)**: its two tasks merged in ID order behind the green gate
(`task-52`, `task-60`; **1700** tests across **138** files, `npm test` + `npm run build` green after
each merge — `29c13a24 → bdd74802 → 827ac729` — and `npm run lint` green with them) and the detail is
in `CHANGELOG.md`'s `## Unreleased`; QA validated each task in its own lane (Task QA green on tips
`e7d84fa9` and `27c8d9a4`) and then the combined tree at `3ca74bb3` (cross-task audit: 21 paths, no
overlap, one holder per hot file, generated dex untouched; both ordered merges rehearsed clean and
landing that same tree). The Orchestrator **re-measured every `[live]` criterion itself** on the
combined commit with a Vite dev server (`:5180`) and the runner's headless Chromium over CDP, reading
the live scene and the live canvas (`renderer.snapshotArea` + `getImageData`). **What shipped.**
**Task-52** gives the run a run-long record of what it caught: `RunState.caughtSpecies` (catch order,
deduped) written by `recordCatch(run, speciesId)` at the one catch fold in `resolveBattle`, so the list
and `stats.catches` can never disagree; `formeFamily` beside `evolutionFamily` (hand-authored, no
regeneration) and `wildExclusions(run)` beside `WILD_BANNED_TAGS` expand each id to its line and its
formes, and `encounterTableFor(band, excluded?)` narrows the band's table — the exclusion is applied
**before** the roll and draws nothing, so a fixed seed's draw count is unchanged; `RouteEncounters`
holds the live set (7th constructor argument, `currentTable()`/`setExclusions()`), falls back to the
unfiltered band when the exclusions would empty it, and the scene refreshes it in `applyBattleResult`
right after `useCapture`, so the room is **not** rebuilt. The starter is not tracked and the trainer
pools are untouched, as the *Decision* froze, and the save takes the plan's next step
**`SAVE_VERSION` 17 → 18** (an older run defaults to an empty record; the chain stays
14 → 15 → 16 → 17 → 18). **Task-60** gives the battle a fifth control reserved at the command window's
right edge on the column `MOVE_MEGA_COL` already reserves (62 px), so the FIGHT / BAG / SWITCH / RUN
2x2 keeps its geometry, and opens the battle's own state through it as a `mode` of its own: one new
pure module, `src/ui/battleInfo.ts` (`battleInfoRows`/`battleInfoLines`), lists the weather, the
terrain, every live field and side condition with its count, each side's active stat stages and each
active's non-volatile status — not the volatiles and not the entry hazards the engine does not model,
as the *Decision* froze — over 37 new i18n keys. Neither task adds a step beyond Task-52's, draws no
RNG outside the shipped streams, and neither claims `package.json`, `src/main.ts` or `vite.config.ts`.
Their two IDs are retired: they keep their place in the sequence and are never reused. What follows is
the cut's own record.

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
**(shipped, archived)**: its one task merged alone behind the green gate (`task-55`; **1710** tests
across **139** files, `npm test` + `npm run build` green on the merge commit, and `npm run lint` green
with them) and the detail is in `CHANGELOG.md`'s `## Unreleased`; QA validated it in the single pass a
one-task batch collapses to — the task's plan, both gates, the cross-task audit and the merge
rehearsal on the integration commit `d1b44b9` — with every `[unit]` criterion green and its five
`[live]` ones **measured** there with a Vite dev server (`:5273`) reading the live scene and the live
canvas: the HUD's four 202×70 containers with the fourth untinted and ⓘ-less, the `TM012 Low Kick`
drop that fills it while the bag's MT/MO counts read the same before and after, the battle's four
304×72 cells with zones `0, 1, -1, -1` where a click on 3 or 4 sends no turn, the keyboard's fourth
stop wearing the 3 px selected stroke, and the un-padded learnset band and SWITCH window. The one
anomalous `npm test` run the dev saw (`1 failed | 1709 passed`) was **not reproduced**: eight further
full runs (four in the dev's worktree, four in QA's) came back 139 files / 1710 tests, and the diff
adds no timer, RNG, I/O or `t()` call. **What shipped.** **Task-55** makes the shared `MoveGrid`
understand an **empty slot**: `MoveGridEmptyCell` (`{ empty: true }`), `MoveGridSlot` and a
`cells: readonly MoveGridSlot[]` option, five exported pure helpers (`isEmptySlot`,
`padMoveGridCells`, `moveGridCellRects`, `moveGridIndexAt`, `moveGridInfoAt`) pinned headlessly by the
new `src/ui/moveGrid.test.ts`, and `isEmpty(index)` on the class. `layout` now takes its `cellRects`
from `moveGridCellRects`, so a drawn cell and its hit rect can never diverge, and the empty container
is a rectangle plus its stroke and **nothing else** — no name, badges, PP/PWR/ACC or ⓘ — that
`indexAt`/`cellRect` answer for, that a press never `grabMove`s and whose ⓘ is always false.
`RouteScene`'s MOVES tab pads `detail.moves` to `MAX_MOVES` (a member with **zero** moves keeps the
`no moves` text and draws no containers), swallows the press on an empty container, no-ops an empty
`confirmDetailSlot` and gives the keyboard stops `slots: MAX_MOVES`, so both the drag and a keyboard
confirm land on slot 3 and reach the shipped `equipMove` that appends; `BattleScene`'s
`renderMoveMenu` pads the same way while `menuZones` keeps one zone per **real** move, so the battle's
spare containers are drawn, disabled and never under the ▶ cursor. The *Decision*'s both surfaces
shipped, and the cut's own two doc corrections are recorded rather than hidden: the "four slotted
moves" and "dragged onto a slot" sentences live in **§3 (The party)**, not §5 ("The route") as the
backlog read, and §4's moves-menu sentence gained the empty-container clause. It adds no run field, no
rule, no RNG draw and no new constant (`MAX_MOVES` is reused), so **no `SAVE_VERSION`** step — the
chain stays **14 → 15 → 16 → 17 → 18**. Its ID is retired: it keeps its place in the sequence and is
never reused. What follows is the cut's own record.

- **Task-55** The MOVES panel always draws four slots, so a TM move can be dragged into
  the empty one.
- **Hot files:** `src/scenes/RouteScene.ts` and `src/scenes/BattleScene.ts` → Task-55;
  `src/ui/moveGrid.ts` + the new `src/ui/moveGrid.test.ts` and the `src/ui/README.md` line
  (the folder already lists a role line per file) → Task-55; `docs/design-spec.md` §3's MOVES
  bullet (the four slotted moves and the drag onto a slot, 83-91) plus one clause of §4's
  moves-menu paragraph (202-212, the battle surface the frozen decision also covers) → Task-55;
  the earlier "§5" here was a section slip — §5 is "The route". It claims no `package.json`,
  `src/main.ts`, `vite.config.ts`, `src/data/**`, `src/engine/**`, `src/engine/save.ts` or
  packed asset, and no `docs/` file another batch holds: `docs/design-spec.md` §3 is Task-50's
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
**(shipped, archived)**: its one task merged alone behind the green gate (`task-56`; **1716** tests
across **139** files, `npm test` + `npm run build` green on the merge commit `bcd5a33`) and the detail
is in `CHANGELOG.md`'s `## Unreleased`; QA validated it in the single pass a one-task batch collapses
to — the task's plan, both gates, the cross-task audit and the merge rehearsal on the integration
commit `9684136` — with every `[unit]` criterion green and both `[live]` ones **measured** there with a
Vite dev server (`:5391`) reading the live scene and the live canvas. **What shipped.** **Task-56**
stops a level-up from equipping anything: `levelUpPokemon` keeps its `level` event and one `learn`
event per crossed move and no longer writes the four slots — no `moves.push`, no `moves.shift`, no
`forget` event ever — so the member's `moves` is returned untouched; the `learn` variant of
`ProgressionEvent` gains a required `memberId` (the one contract addition beyond the backlog's fix
shape, because a flat event list cannot be attributed to a member otherwise) and the now-unused
`moveSlot` helper is gone. The learnset band becomes the only equip path, so the OHKO/No Guard guard
moves there: `learnsetPool` never offers an OHKO move to a No Guard holder (and `equipMove` refuses it
for free through `poolEntry`, the defence in depth the spec froze). `levelUpBeats` takes the
resolution's `ProgressionEvent[]` as a required third argument and reads `learned` from the `learn`
events of the member that levelled instead of from a slot diff, so the modal and Task-50's transient
notice keep announcing the move; `LevelUpBeat.forgotten` is kept in shape and is always empty, and
`RouteScene.applyBattleResult` threads the fold's `events` (previously discarded) into the two
`playLevelUp` call sites. `docs/battle-spec.md` §7 gains the paragraph that a crossed move waits in the
band and that nothing is ever forgotten; `docs/design-spec.md` §5 already described the rule and stays
untouched. It adds no run field, draws no RNG and adds no rule the save carries, so **no
`SAVE_VERSION`** step — the chain stays **14 → 15 → 16 → 17 → 18**. Its ID is retired: it keeps its
place in the sequence and is never reused. What follows is the cut's own record.
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

### Batch 20 — the whole chrome goes dark glass (the debug panel's seed)
**(shipped, archived)**: its one task merged alone behind the green gate (`task-58`;
**1730** tests across **140** files, `npm test` + `npm run build` + `npm run lint` green
on the merge commit `6d321ab9`) and the detail is in `CHANGELOG.md`'s `## Unreleased`.
QA validated it in the single pass a one-task batch collapses to — the task's plan,
both gates, the cross-task audit and the merge rehearsal on the integration commit
`88947465` — with every `[unit]` criterion green, and the Orchestrator **re-measured
every `[live]` criterion itself** on that commit with its own Vite dev server and the
runner's headless Chromium over CDP (`renderer.snapshotArea` + `getImageData`). **What
shipped.** **Task-58** replaced the drawn light chrome with one dark glass card: a
`#10161f` surface at **0.72** (the battle's message box, the one `'textbox'` call site
left, at **0.80**), a **1px hairline** `rgba(255,255,255,0.16)` with an inset top
highlight and a 1px shadow ring, an **11px** corner on both skins, the accent `#7dd3fc`
reserved for selection and controls, `#f8fafc` body ink and `#94a3b8` for the secondary
tone, ordinary rows at `rgba(255,255,255,0.06)` over a `1px rgba(255,255,255,0.10)`
border and a selected row, cell or tab at the accent's `0.16` fill **plus** its 1px
outline. The packer writes the tokens into `src/data/ui/chrome.json`, `src/ui/frlg.ts`
exports them and `FRLG_INK` is now the **light** ink, so every existing `tint: FRLG_INK`
site flipped with one constant and the ad-hoc greys collapsed into the one muted tone.
The notice strip, the release overlay and `RunOverScene` draw the card skin, the MEGA
and G-MAX controls are icon-only, and **no real blur ships** (Phaser has no
`backdrop-filter`): the glass reads from the alpha, the hairline and the highlight. The
new `src/ui/frlg.test.ts` carries the contrast pass the task owes — `[Task-08]`'s audit
is not re-run, per the entry's *Decision* — over the composite of the surface over the
repo's own forest ground tones. One thing the cut's own wording left open is recorded
rather than hidden: the spec's `composite` formula had a typo (`fg + alpha·(fg − bg)`),
so the shipped test uses the standard `alpha·fg + (1 − alpha)·bg`, which reproduces
every measured value the spec carried. It adds no run field and no new dependency, so
**no `SAVE_VERSION` step** — the chain stays **14 → 15 → 16 → 17 → 18**. One
`agent-review` issue carries the residual subjective judgement (the semantic red's
4.23, the darkest canon type colours under the badge ink, and the one Mega glyph both
controls share). Its ID is retired: it keeps its place in the sequence and is never
reused. What follows is the cut's own record.

- **Task-58** Every panel becomes a **dark glass card**: one `#10161f` surface at **0.72**
  alpha, a **1px hairline** frame with an inset top highlight and a soft drop shadow, an
  **11px** corner, `#f8fafc` ink with `#94a3b8` for the secondary lines and the accent
  `#7dd3fc` **only** on selection and controls — in place of the drawn set's light windows and
  deep-black text. The direction is the **`t-glass` card of the untracked
  `chrome-options.html`** in the repo root, picked by the human over the four other cards, and
  it ships **without a real background blur** (Phaser has no `backdrop-filter`): the glass
  reads from the low alpha, the hairline and the highlight. The full token list, the caveat and
  the corner value live in `[Task-58]`'s entry below.
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
  its own contrast check instead of re-running Task-08 — the only question of the two that the
  eighth round raised and this batch still carries (the **direction** one is answered: the
  light-panel alternative is rejected and the task ships the `t-glass` card).

### Batch 21 — the boss win no longer moves the player
**(shipped, archived)**: its two tasks merged in ID order behind the green gate
(`task-61`, `task-86`; **1751** tests across **140** files, `npm test` + `npm run build`
green after each merge — 1730 then 1751) and the detail is in `CHANGELOG.md`'s
`## Unreleased`. QA validated each task in its own lane (both green, on tips `cee35fba`
and `f26f5b15`) and then the combined tree at `390818e8`: the two batch gates green there,
no path shared by the two tasks, one holder per hot file (`src/scenes/RouteScene.ts` →
Task-61, `src/scenes/BattleScene.ts` and `src/data/dex/**` → Task-86), `src/engine/`
still Phaser- and DOM-free, both generators idempotent, and the merge rehearsal
**sequence-independent** (either order yields the same tree, no conflict). The
Orchestrator **re-measured every `[live]` criterion itself** on that commit with its own
Vite dev server and the runner's headless Chromium over CDP, reading the live scene state.
**What shipped.** **Task-61** gives `transitionTo` an optional
`TransitionOptions { keepPosition?: boolean }` and passes it from the boss-win branch of
`applyBattleResult` alone — the **only** one of the five call sites that asks for it — so
the room is still rebuilt with its portal open and the tile the fight was triggered from
is restored instead of the door, while doors, portal steps and both dev teleports keep
today's respawn. It reads no RNG, adds no run field and changes no rule, so no
`SAVE_VERSION` step. **Task-86** deletes the twelve forme-changing abilities (registry,
handlers, helpers and `randomAbility` pool — `Ice Face` stays), turns their formes into
**data**: eighteen authored `FORM_EVOLUTIONS` rows (Palafin-Hero 48, Wishiwashi's School
20, Cherrim's Sunshine 40, Castform's Sun/Rain/Snow 40 branched, Cramorant's two 40,
Aegislash's Blade 55, Darumaka's and Darumaka-Galar's Zen splits 35/20, Ogerpon's three
masks 40, Zygarde 10% → 50% → Complete 50/60 and Terapagos → Terastal → Stellar 50/60),
an authored `+60` Sp. Atk on Castform's three promoted formes (BST 480) and `+30`/`+30` on
Cherrim's Sunshine (BST 510), and Greninja-Ash as Greninja's **second Mega** with the
stone `Greninjite Ash` (megas 88 → 89) — plus the seam the variant half of the decision
needed: `VARIANT_FORMES`, `variantSpecies(speciesId, rng)` and `Rng.split(salt)`, a
sibling stream drawn at the wild and trainer generation sites, so Eiscue, Morpeko and
Minior stay one pool entry each and their alternate forme rolls per individual without
moving a single existing stream. It adds no run field either, so the version chain stays
**14 → 15 → 16 → 17 → 18**. Records the cut's own claims got wrong, written here so the
next planning pass does not inherit them: the two-task batch's exclusive-path lists were
incomplete — `src/data/dex/learnsets.json` is forced because `build-dex.mjs` iterates the
**playable** set, and `src/assets/pokemon/index.json` because `index.test.ts` pins
`files ∪ missing === playableSpecies()`; both are their generator's own output, not hand
edits. The third Terapagos stage's real id is `terapagosstellar`, not the `terapagostellar`
this section's own round wrote. `scripts/effect-coverage.mjs` had drifted (two regexes made
five real multi-line ability rows read `no-op` and `King's Rock` read `excluded`) and was
repaired inside the task's paths, with both classifications reconstructed by QA to prove no
row moved silently. And Terapagos now **enters `starterCandidates()`** (the authored
two-stage line gives it `evolutionDepth` 2), a real player-facing consequence the spec did
not mention. No `agent-review` issue was needed: Task-61's `[live]` criteria are objective
and were measured, and Task-86's are all `[unit]`, so it owes no browser pass. What follows
is the cut's own record.
- **Task-61** Beating the map boss keeps the player where they stand instead of warping them
  to the room's door.
- **Hot files:** `src/scenes/RouteScene.ts` (the boss-win branch of `applyBattleResult`,
  5069-5108, and the `transitionTo` it calls, 4437-4454) → Task-61, which claims no
  `package.json`, `src/main.ts`, `vite.config.ts`, `src/data/**`, `src/engine/**`,
  `src/engine/save.ts`, packed asset or `docs/` file. **`[Task-86]` joined this batch in the
  twenty-seventh round**, so its set is the batch's second holder: `src/data/dex/**` (the
  `FORM_EVOLUTIONS` override and the regenerated files) with `scripts/build-dex.mjs`, the ability
  registry (`src/engine/battle/effects/abilities.ts` + its test) with
  `src/engine/battle/randomAbility.ts`, `src/scenes/BattleScene.ts`, the generated
  `docs/balance/effect-coverage.md` and the docs it records `D38`/`D16` in
  (`docs/tech-decisions.md`, `docs/battle-spec.md` §9/§11, `docs/design-spec.md` §3), plus the
  fixed-seed re-pins it owes — none of which Task-61 touches, so the batch is still an antichain.
- **Shape:** two tasks since the twenty-seventh round, and the first batch of the round because
  `[Task-61]` is the only **defect** of the six reports (the file's precedent: the bug batch was cut
  in front of Batch 4). It wants
  `src/scenes/RouteScene.ts`, which every batch from 5 to 20 holds (5 Task-16, 5b Task-45, 6
  Task-41, 6b Task-38, 7 Task-31, 8 Task-08's every-scene sweep, 8b Task-35, 9 Task-39, 9b
  Task-40, 10 Task-26, 11 Task-29's ledger, 12 Task-30, 13 Task-44, 14 Task-48, 15 Task-49, 16
  Task-50, 17 Task-52, 18 Task-55, 19 Task-56, 20 Task-58), so this is the first batch that
  leaves it free again — and the batch holds one **scene** task only, because a batch is an
  antichain and every other report of the two rounds wants that same file; `[Task-86]` is its second
  member since the twenty-seventh round precisely because it wants no scene at all. Task-61
  produces nothing another task
  reads, changes no rule (the portal still opens when the boss falls, D31), adds no run field,
  so **no `SAVE_VERSION`** step and no fixed-seed re-pin — it is pure scene behaviour, and its
  batch-mate adds none either.

### Batch 22 — a room's battle begins under a weather, a terrain or a room condition
**(shipped, archived)**: its single task merged behind the green gate (`task-62`; **1781**
tests across **142** files, `npm test` + `npm run build` green after the merge) and the detail
is in `CHANGELOG.md`'s `## Unreleased`. It stayed the one-task batch the cut made it, and it
holds: a plan room rolls a battle-start condition on its own stream keyed to the room's
**stable** index (15 % for a room that fields regular trainers, 30 % for the boss, nothing for
the entry or a special leaf), `src/engine/routes/battlefield.ts` is the pure roll and
`src/data/battlefields.ts` the eleven-row table with each row's filter tint and alpha, the
route paints one static tinted rectangle over the room, and `BattleLaunch.battlefield` →
`battlefieldSeeds` → `createBattle`'s new optional `weather`/`terrain`/`field`/`fog` seeds it
into **every** battle there, wilds included. Dense fog is the one new rule — a
`BattleState.fog` flag, not a weather, giving every move's own accuracy −20 before the stage
multiplier, clamped at 0, with a never-miss move unaffected. It adds no run field, so the chain
stays **14 → 15 → 16 → 17 → 18**. Three things the cut's own wording got wrong are recorded
rather than hidden, because the next planning pass must not inherit them. Its exclusive-path
list was one file pair short: `src/engine/battle/preview.ts` + `preview.test.ts` had to move
with `modifiers.ts`, or the MOVES menu would show the pre-fog odds while the engine rolls the
post-fog ones. The entry's *recommended* reading — `'fog'` joining `FieldConditionId` — is
**refused**: `FieldConditions` is a `Record<FieldConditionId, number>` and five unclaimed files
(`effects/conditions.ts`, `ui/battleInfo.ts` + its test, both i18n tables) would have to move,
and it would hand fog a turn counter the decision forbids, so fog ships as the boolean the
decision's own sentence describes. And the entry's claim that a fog battle "rolls the same turn
order and the same hit sequence as before the fog existed" is false by construction — a lower
chance turns some hits into misses — so only the part that holds was pinned: the fog term draws
no RNG. Two line-number sets in the entry were stale (`startBattle` is `RouteScene.ts:6183`,
not 4904; `BattleScene.create` is 545, not 390; `weatherChip` is `effects/weather.ts:70`, not
`turn.ts`), which the spec cites correctly. Everything objective was measured: the table, the
roll's purity, stream keying and both chance bounds, the eleven seed mappings, `createBattle`'s
seeding and its exact defaults, the fog arithmetic (95 → 0.75, 10/20 → 0, `true` → 1,
`60 + fog` → **0.53333** = `accuracyChance(40, …)`, fog + Gravity → 0.6667), `hitChance` and
`movePreview` each exactly 0.2 lower under fog, and all three `[live]` criteria on the combined
commit `aac7adb3` (the filter's own tint/alpha, a canvas differential of **14.47** at the
player's tile against a restore of **0**, a `null` control room and the identical revisit, and
a battle there opening with `field.gravity === 5`). No `agent-review` issue was needed: every
`[live]` criterion is a number or an equality, not a taste. What follows is the cut's own
record.
- **Task-62** A trainer or boss room may begin its battles under a weather, a terrain or a
  room condition (dense fog, Gravity, Trick Room), and the route draws an animation or filter
  for it.
- **Hot files:** `src/scenes/RouteScene.ts` (the room's roll and the map filter; `startBattle`
  4904-4931) and `src/scenes/BattleScene.ts` (`create`, 390-441) → Task-62; the new
  `src/engine/routes/battlefield.ts` + `battlefield.test.ts` (the pure roll) → Task-62;
  `src/engine/battle/state.ts` (`BattleSetup` 120-128 and `createBattle`'s seed, 159-162),
  `src/engine/battle/accuracy.ts` + `accuracy.test.ts` and `src/engine/battle/modifiers.ts`
  (the fog term), `src/engine/battle/effects/weather.ts`/`terrain.ts` only if a label moves,
  and `src/engine/run/battleLink.ts` (`BattleLaunch`, 45-57) → Task-62; the new condition
  table + chance in `src/data/` (a `src/data/battlefields.ts` beside its test) → Task-62;
  `docs/maps-spec.md` §6/§7 and `docs/battle-spec.md` §4 → Task-62. It claims no
  `package.json`, `src/main.ts`, `vite.config.ts`, `src/data/dex/**`, `src/engine/save.ts` or
  packed asset.
- **Shape:** one task, alone, and it needs the batch to be that wide: it is the only task of
  the two rounds that wants **both** scenes at once, and every batch from 5 to 20 holds
  `src/scenes/RouteScene.ts` while the battle scene is held by 5, 5b, 6, 6b, 7, 8, 8b, 9, 9b,
  10, 11, 12, 14, 17, 18 and 20 — so it opens the new **Batch 22**, one batch behind Task-61.
  It is the round's only engine rule: it adds the fog accuracy term and the setup seam, and it
  is written **against** the shipped weather/terrain/gravity/trick-room rules rather than
  re-porting them (the coverage table already marks all four `port`,
  `docs/balance/effect-coverage.md` 652/1133 and the terrain/weather rows). Its map filter is an
  overlay of its own (Batch 5b's Task-45 ships **no** tile-animation contract — only the tall
  grass's own frame list, `grassRustle`, which is its own art — so there is nothing to reuse
  and nothing to wait for).
  The roll owns a dedicated stream keyed to the room's **stable** index
  (`routeIndexForRoom`, 969-972), so no existing `map`/`encounters`/`battle` stream moves and a
  fixed seed reproduces every condition; it lands **before** no batch in particular, but it is
  placed here because the report is a wish against shipped rules and nothing blocks it.

### Batch 23 — the mini-boss reward offers three unidentifiable Pokémon
**(shipped and archived)**: its two tasks merged in ID order behind the green gate (`task-63`,
`task-88`; **1792** tests across **142** files after the first merge and **1807** across the
same **142** after the second, `npm test` + `npm run build` green after **each** merge) and the
detail is in `CHANGELOG.md`'s `## Unreleased`. It stayed the two-task batch the cut made it and
it is an antichain in fact, not only on paper: the two diffs share no path, `task-63` holds
`src/scenes/RouteScene.ts` and nothing else in `src/` moves twice. **Three things the cut's own
wording got wrong are recorded rather than hidden.** (a) `src/ui/rewards.test.ts` pinned its
stream-isolation case against `ROUTE_LOOT.late.pool`, and this batch's sibling grows that table
(36 → 40 rows), so Integration QA found `npm test` **red on the combined tree** — a cross-task
interaction the per-task waves cannot see by construction; `task-63` re-pinned the case against
the test file's own hand-written pool (`04008975`, one test-only file) and Task QA re-ran, green.
(b) `src/data/itemIcons.test.ts` and `src/data/dex/README.md` were missing from `task-88`'s
exclusive list: the first's "own icon for everything but the TMs and the Mega Stones" guard sees
the 34 new rows, and the second's folder map still said a G-Max forme is item-free; neither path
is a batch-mate's, so the batch stayed an antichain. (c) The spec pinned the stone's name as
`megaStoneName` **plus ` G`** and then listed derived examples that only stripping the whole
trailing vowel *run* produces; the dev followed the examples, and the corrective round restored
the **shipped** rule instead — so Eevee, Butterfree and Alcremie read `Eeveite G`,
`Butterfreite G` and `Alcremiite G`, the other 31 are unchanged, and `megas.json` is
byte-identical because no Mega ends in a vowel run. **QA**: two Task QAs in parallel, each from
its own integration worktree (tips `04008975` and `044a8d2c`, both green and both measured live
over CDP), then one Integration QA on the combined tree — red once on the item-chooser pin,
green on the second pass (`ce10ece1`: gates green, no shared path, one holder per hot file,
`src/engine/` pure, the generated dex reproducing byte for byte, and both merge orders
conflict-free and identical). The Orchestrator measured both `[live]` criteria itself on the
combined tree. **One follow-up is open**, carried by an `agent-review` issue rather than by this
batch: the longer G-Max row copy overruns the STATS band's row box on **five** of the 34 rows
(`butterfreegmax` 291, `corviknightgmax` 301, `grimmsnarlgmax` 291, `toxtricitylowkeygmax` 383,
`urshifurapidstrikegmax` 387 against a 288/322 px box), which needs a scene-side width or a
shorter clause and no new catalogue. `task-88`'s reach took the shipped precedents: a fixed
sixth Mart row at `late`/`end` (the `SHOP_TM` shape) and ground treasure at `late` 4 / `end` 6
(the `D37` Memories/Drives cadence), so no weighted rotation was diluted and no stone needs a new
atlas frame. What follows is the cut's own record.
- **Task-63** A beaten mini-boss offers, beside its item rows, three Pokémon the player cannot
  identify — no name, no sprite — each presented by its highest stat and its nature.
- **Hot files:** `src/scenes/RouteScene.ts` (the reward window, `openMiniBossReward` 5715-5731
  through `chooseMiniBossReward` 5838-5848) → Task-63; `src/ui/rewards.ts` +
  `src/ui/rewards.test.ts` (the new pure Pokémon chooser beside `rewardChoices`, 10-32) →
  Task-63, which claims no `package.json`, `src/main.ts`, `vite.config.ts`, `src/data/**`,
  `src/data/dex/**`, `src/engine/**`, `src/engine/save.ts` or packed asset — every primitive it
  composes is shipped (`createFighter` + `randomAbility`/`defaultMoveset`, D17; `speciesPool`,
  D39; `statAtLevel`; `addPokemon`); `docs/maps-spec.md` §7 (185) and
  `docs/design-spec.md` §7 (259-260) → Task-63. **`[Task-88]` joined this batch in the
  twenty-seventh round**, so its set is the second holder: the generated
  `src/data/dex/gmaxes.json` with `scripts/build-dex.mjs`, `src/data/items.ts` (one stone per
  G-Max forme beside `MEGA_STONES`), `src/engine/battle/gmax.ts`, the dex accessor
  (`src/data/dex/megas.ts`) and the STATS row's own module, `docs/tech-decisions.md` `D44`,
  `docs/battle-spec.md` §9 and `docs/data-spec.md` §1 — a disjoint set from Task-63's, so the
  batch is still an antichain.
- **Shape:** two tasks since the twenty-seventh round, because `[Task-63]` wants
  `src/scenes/RouteScene.ts` (held by every batch 5-20, Batch 20 last) and `src/ui/rewards.ts`,
  and no other report of the round claims that second file — so it could not ride beside Task-61
  or Task-62 and opens the new **Batch 23**,
  one batch behind Task-62. It is a **presentation + placement** task with no new rule: the
  chooser draws from its own stream (a sibling of `:reward:${mapIndex}`, 5721), so the item
  rows a fixed seed already produces do not move and the fixed-seed regression is that the
  three (stat, nature) pairs are stable. The chosen Pokémon lands through `addPokemon` at the
  squad's level, exactly as a catch does — it is not a catch, so it spends no room capture and
  bumps no `stats.catches` — and it adds no run field, so **no `SAVE_VERSION`** step. `[Task-88]`
  is the batch's second member (its own set is named above): it moves the generated `gmaxes.json`
  and the item catalogue, keeps the single chain intact, and adds no run field either.

### Batch 23a - the moves and the abilities speak Spanish
- **Task-112** The Spanish locale stops printing English move and ability copy: every move and
  ability the dex ships gets its **official Spanish name** and description, read from a generated
  content table with an English fallback.
- **Hot files:** new `src/data/i18n/es/*.json`, `src/i18n/content.ts` + test and
  `scripts/build-i18n-content.mjs` → Task-112; `src/ui/moveGrid.ts`, `src/ui/partyDetail.ts`,
  `src/ui/infoPopup.ts`, `src/scenes/BattleScene.ts` and `src/scenes/RouteScene.ts` (every site
  that prints a move's or an ability's name or description) → Task-112; `docs/tech-decisions.md`
  (`D43`) and `docs/data-spec.md` §1 → Task-112. It claims no `package.json`, `src/main.ts`,
  `vite.config.ts`, `src/data/dex/**` or packed asset.
- **Shape:** one task, **the first batch after Batch 23** (the human's priority), because it holds
  `RouteScene.ts` and `BattleScene.ts`, the two scenes the room wave wants. It is a content +
  presentation task: the dex keeps its English strings and stays pure; the Spanish table is
  generated once from PokeAPI's official `es` names and flavour text (the same strings the games
  ship), committed, and read through four accessors. It changes no rule, draws no RNG and adds no
  run field, so **no `SAVE_VERSION`** step. `D43` is amended for moves and abilities only:
  Pokémon species, items and biomes stay English.

### Batch 23a2 - the 61 descriptions the base-game dump does not carry *(closed — carried by `[Task-149]`)*
- [x] **[Task-113]** *(superseded by `[Task-149]` on `2026-10-25`: the human authorised Spanish authored
  in the repo; see the decision line in the item's own entry.)* `Task-112` left 18 moves and 43 abilities with an English description because
  PokeAPI's dump and the base Scarlet/Violet text have no Spanish for those DLC rows; fill them
  from the game's own Spanish text, never a machine translation, and empty `MISSING_ES`.
- **Hot files:** `src/data/i18n/es/moves.json`, `abilities.json` and `meta.json` →
  Task-113; `src/i18n/content.test.ts` → Task-113. It claims no scene, no UI, no
  `src/engine/**` and no packed asset.
- **Shape:** one task, **one batch behind Task-112** and before Batch 23b. The accessors,
  the UI wiring and the English fallback already ship; this is the content half only. The
  source is the official Spanish in-game text (the DLC text dump where it carries a row, else
  the official Spanish Pokédex copy), and the acceptance is that the two `meta.json`
  `missingDescriptions` lists shrink to zero and `MISSING_ES` becomes empty. No rule, RNG draw
  or run field moves, so **no `SAVE_VERSION`** step. It is **blocked** (see the item's own
  `BLOCKED` note), and nothing behind it waits on it: `[Task-111]`, in the batch after this
  one, reads only `[Task-112]`'s merged tables and accessors.

### Batch 23b - the special-room layer leaves the route scene
- **Task-111** `src/scenes/RouteScene.ts` stops owning every special room: each room kind becomes
  a descriptor module under `src/scenes/rooms/`, the scene keeps one auto-discovered registry and
  the shipped shop, mini-boss and Mega-stone rooms keep their exact behaviour.
- **Hot files:** `src/scenes/RouteScene.ts` (the registry's single call site and the hooks the
  descriptors use) → Task-111; the new `src/scenes/rooms/**` with its README and tests →
  Task-111; `src/ui/mapView.ts` + test (the marker comes from the descriptor) → Task-111;
  `docs/design-spec.md` §3 and `docs/tech-decisions.md` (the layering decision) → Task-111. It
  claims no `package.json`, `src/main.ts`, `vite.config.ts`, `src/data/**`, `src/data/dex/**`,
  `src/engine/**`, `src/scenes/BattleScene.ts` or packed asset - and no docs file another open
  batch holds (`docs/design-spec.md` §3 is free after Batch 20's Task-58).
- **Shape:** one task, **one batch behind Task-112** and **before Batch 24**, and the reason is
  the queue: 13 open tasks name `src/scenes/RouteScene.ts`, including every special room in
  Batches 24-27, so the batch rule turns them into four single-task batches. The extraction gives
  each room its own file (the registry is built with `import.meta.glob('./rooms/*.ts', { eager:
  true })`), so a new room no longer edits the scene; the only shared seams left are the one-line
  `plan.ts` kind and `mapView.ts` marker, which **batch filling** can pair with an unrelated later
  task. It is a pure refactor: no tile, marker, price, key, RNG draw or run field moves, so **no
  `SAVE_VERSION`** step and no fixed-seed re-pin. It edits files Batch 11's reformat cleared, so
  it keeps them conforming (no new ledger line).
- **Batch filling: checked, no member added (`2026-10-19`).** The candidate was **`[Task-81]`**
  (Batch 30, "a room's size follows its shape"), and its paths *are* disjoint from this batch's
  set — it claims `src/engine/maps/plan.ts` + `plan.test.ts`, `src/data/maps.ts`, `src/data/mapSize.ts`
  and `docs/maps-spec.md` §1/§4, none of which Task-111 touches, and it has no dependency. It was
  **refused on the second half of the rule** ("its re-pins cannot be bounded"): the frozen shape
  table (a `cross` 40×40, a `corridor` 52×30, and so on) changes every room's **area**, and a room's
  area is what `src/data/mapSize.ts`'s tiers key on — so `trainerBonusForSize`/`terrainScaleForSize`
  move for map 1's rooms and the trainer density of every floor moves with them. That lands on
  `src/engine/run/curve.test.ts`, whose shipped windows are numeric and tight (each floor's fill
  inside `1 – 1.5`, maps 1-2 inside `1.20 – 1.35`, and the on-ramp strictly below the recorded
  pre-thinning totals), on `docs/balance/route-curve.md`'s measurement, and — if the fill leaves
  its window — on `src/data/population.ts` (Task-82's) or `src/data/run.ts` (Task-83's), which are
  balance decisions and not re-pins. `src/data/maps.test.ts` (`routeSizeRangeForMap(FINITE_MAPS)`
  pinned to `{ min: 30, max: 48 }`, and the monotone-size walk) and `src/engine/maps/route.test.ts`
  (the two `mapTuning(n).size.max` tier pins) pin today's `size` range too, and the entry's
  `src/data/maps.ts` claim did not carry their tests. The entry's own wording — "scaled by the map
  index instead of the free roll" — also leaves the scale itself undefined, which is a decision and
  not something an Architect may invent. The set is therefore not writable from this batch, and
  Batch 23b stays **Task-111 alone**. (A second pass over the immediately following batches found
  no cleaner filler: `[Task-84]` B29, `[Task-87]` B30 and `[Task-89]` B31 all claim
  `src/scenes/RouteScene.ts`, i.e. this batch's own hot file, and `[Task-88]`/`[Task-104]` are a
  behaviour change to waves whose siblings merge ten batches later.)
- **Shipped (Task-111, `2026-10-19`).** Every special room kind is now its own descriptor module
  under `src/scenes/rooms/` — `types.ts` (the `RoomDescriptor`/`RoomHost`/`RoomPanel` contract),
  `registry.ts` (the pure collector, keyed by kind and by marker, a duplicate kind throwing with
  both module paths), `shop.ts`, `miniBoss.ts` and `megaStone.ts` — and `RouteScene.ts` keeps
  **one** auto-discovered registry built with
  `import.meta.glob(['./rooms/*.ts', '!./rooms/*.test.ts'], { eager: true })`, so a new room is a
  new file. The scene still owns *who holds the keyboard* (`roomPanel`) and *where the counter is*
  (`shopCounter`); the room owns what its panel looks like. The layer is recorded as **D47** and the
  route HUD's bullet in `docs/design-spec.md` §3 gained one line. It is a pure refactor: no tile,
  marker, price, key, RNG draw or run field moved, so **no `SAVE_VERSION`** step and no fixed-seed
  re-pin. **QA**: the batch is one task, so a single pass covered both scopes on the combined tree
  (`main` + `task-111`, merged with `--no-ff` and conflict-free) — 145 files / **1829 tests** and
  `npm run build` green, the diff's **12/12** paths inside the exclusive list, `src/engine/` and
  `src/data/` untouched, and the folded tests (`registry.test.ts` 7, `fixtures.test.ts` 11) green
  with the seed-`pkm-111` mega-stone literal pinned off the pre-change build. **Measured, not
  assumed:** QA drove its own server and browser, and the minimap rect and the open Mart rect are
  **0 differing pixels** between `main` and `task-111` at 1280x800 on the same seed and map (the
  minimap `8,8,216,250`, sha `0f37b968…`; the Mart `(320,130,640,540)`, sha `f56f0ca5…`), the ten
  rooms of map 5 dumping identical fixtures (shop counter `(14,24)`, `miniboss-5` at `(23,27)`
  facing `W` with `sight 5` and `ace`, `mega-5` → `dragoninite` at `(6,16)`), and the Mart still
  answering `E`/`Q`, `←`/`→`, `↑`/`↓` with the buy and sell deltas exact. Two honest notes:
  the pixel run used **map 5** rather than the spec's map 3, because seed `pkm-111`'s map 3 hangs
  only shop and mini-boss (mega-stone lands on 5 and 8), and `npm run lint` is **red on `main`
  already** — three files outside this task's diff (`src/i18n/content.ts`, `src/ui/partyDetail.ts`,
  `src/ui/evolutionGraph.test.ts`), four before this merge, because this task leaves
  `RouteScene.ts`'s Task-112 hunk prettier-clean; it is `main`'s own debt, not this batch's, and it
  owes a one-line chore.

### Batch 24 - the casino room
- **Task-64** A casino room: a Team Rocket grunt, a slot machine the player pays to spin, items
  and an egg among its prizes, and a chance of a battle that locks the machine.
- **Hot files:** `src/scenes/RouteScene.ts` (the two `RoomHost` hooks and the egg's hatch
  beat on `advanceMap`'s portal step) → Task-64;
  the new descriptor `src/scenes/rooms/casino.ts` + test, with `src/scenes/rooms/types.ts`
  and the stub in `fixtures.test.ts` → Task-64; `src/engine/maps/plan.ts` + `plan.test.ts`
  (the new `MapRoomSpecial` value and its placement) → Task-64; the new casino table
  (`src/data/casino.ts` + test) and the new `egg` entry in `src/data/items.ts` + its guard
  `src/data/items.test.ts` → Task-64 — the catalogue gains a `price: 0` row that is never
  sellable, so the "sells everything except the Master Ball and the Mega Stones" sweep has
  to learn its id (line 42);
  `src/data/trainers.ts` + test (the new `rocket` set-piece row) and
  `src/data/itemIcons.ts` + test (the Egg's icon fallback) → Task-64; the new pure model
  `src/ui/casino.ts` + test and the `eggHatchNotice` builder in `src/ui/notice.ts` + test →
  Task-64; `src/scenes/BootScene.ts` (the machine's drawn texture) → Task-64;
  `src/i18n/{en,es}.ts` (its eight keys) → Task-64; `docs/maps-spec.md` §7 and
  `docs/design-spec.md` §7 → Task-64. It claims no `package.json`, `src/main.ts`,
  `vite.config.ts`, `src/data/dex/**`, `src/engine/save.ts`, `src/ui/mapView.ts`, packed
  asset or packer.
- **Shape:** one task, alone, and it opens the new **Batch 24** for two independent reasons:
  `src/scenes/RouteScene.ts` is claimed by every batch from 5 to 23a (20's Task-58, 21's
  Task-61, 22's Task-62, 23's Task-63, 23a's Task-112), so the first batch that leaves it free is
  this one, and the special-room layer it extends (`MapRoomSpecial`,
  `src/engine/maps/plan.ts` 64) is claimed by Task-65 and Task-66 in the two batches after it —
  so no two of the three can share a batch.
- **Planned against the shipped code (`2026-10-19`), and the plan changed four ways.** (a) **The
  room is a descriptor module**, not a `buildRoom` branch: Task-111's `D47` shipped the layer,
  so the casino is `src/scenes/rooms/casino.ts` exporting `descriptor`, the kind rides
  `MapRoomSpecial` and the glyph comes from the descriptor's own `drawMarker` — so
  **`src/ui/mapView.ts` needs no edit** and leaves this batch's hot-file list. (b) **The port
  gains exactly two hooks**: the "starting a battle" edit `D47` itself names
  (`RoomHost.startTrainerBattle`) plus `RoomHost.showNotice`; money and items ride
  `host.commitRun` with the engine's own `spendMoney`/`addItem`, and the egg's beat on
  `advanceMap` is the scene's own portal step, so no third hook. (c) **The grunt is a
  set-piece archetype**: a new `SPECIAL_ARCHETYPES` table beside `TRAINER_ARCHETYPES`, merged
  only into `getTrainerArchetype`'s index — so the route's pool, its rolls and the four shipped
  atlas/animation invariants (`trainerSprites.test.ts`, `overworldSprites.test.ts`,
  `trainers.test.ts`, `trainerAnim.test.ts`) do not move and **no repack is forced**. (d) **The
  FRLG repack leaves this task**: the checked sources carry no Rocket
  grunt (`sprite-sources/frlg/overworld/` holds twelve files and none is one, the decomp clone
  has no `graphics/`, and only the battle sheet's Regular Trainers block is measured), so the
  archetype declares the keys `spriteKey`/`battleSprite: 'rocket'` and both surfaces fall back
  to the shipped placeholder; the batch loses the packed `overworld.png`/`trainers.png` claim
  and whoever cuts Batch 29 hands the `rocket` row to Task-90, whose entry currently excludes
  it. Its price and prize tables live in `src/data/casino.ts` (balance) and the spin draws its
  own stream — `${seed}:casino:${mapIndex}:${spins}`, minted from the run's own per-floor spin
  marks in `pickedItems`, so a reload continues the sequence — so a fixed seed's shop stock,
  reward picks and rosters do not move; the room adds **no** run field (the per-floor lock and
  the spin counter ride `pickedItems`, the egg is an ordinary bag item whose species rolls at
  hatch time), so **no `SAVE_VERSION`** step.
- **Batch filling: checked, no member added (`2026-10-19`).** The candidate was **`[Task-104]`**
  (Batch 31, the damage-model abilities and the four team-type bonuses). Its paths *are* disjoint
  from this batch's set — it claims `src/engine/battle/{damage,state,turn}.ts`, the ability
  registry, `docs/balance/effect-coverage.md` and `docs/battle-spec.md` §10/§11, none of which
  Task-64 touches, and the launch seam it reads is `battleLink`/`BattleSetup` rather than the
  route scene — its dependencies are merged and it needs no file a batch-mate produces, so the
  letter of the **filling** rule admits it. It was **refused on the wave rule**: it is one of the
  nineteen Phase-9 tasks (`[Task-90]`–`[Task-108]`) whose siblings share
  `src/engine/battle/damage.ts`, `state.ts` and `turn.ts` one batch apart (`[Task-106]` B32,
  `[Task-107]` B49), and shipping it here pulls a serial resource of that wave seven batches
  ahead of its own cut — Batch 23b refused the very same candidate on the same ground. Every
  other later task is disqualified outright: `[Task-65]`/`[Task-66]`/`[Task-67]` hold this same
  room layer, `[Task-84]`, `[Task-87]`, `[Task-89]`, `[Task-78]` and `[Task-79]` claim
  `src/scenes/RouteScene.ts`, `[Task-103]` and `[Task-87]` claim `src/data/items.ts`,
  `[Task-81]` and `[Task-82]` claim `src/engine/maps/plan.ts`, `[Task-85]` claims
  `src/scenes/BootScene.ts`, and `[Task-80]`, `[Task-83]`, `[Task-93]`–`[Task-101]` and
  `[Task-106]`–`[Task-108]` each depend on something that has not merged. Batch 24 stays
  **Task-64 alone**, and its spec is written (`.agent_specs/task-64.md`, `2026-10-19`).
- **Shipped (Task-64, `2026-10-19`).** The casino is the room layer's **first new kind since
  `D47`**: `src/scenes/rooms/casino.ts` exports `descriptor` and neither `RouteScene.ts`'s
  registry nor another room changed — the scene gained only the two port hooks the spec froze
  (`startTrainerBattle`, `showNotice`) and the egg's beat on the portal step. `MapRoomSpecial`
  gained `'casino'`, hung **last** in the special pass (`CASINO_CHANCE = 0.3`, from map 2), so the
  shop, the mini-boss and the mega-stone keep their ids, sizes and tiles; the minimap glyph comes
  from the descriptor (no `mapView.ts` edit); the machine's art is a drawn texture in
  `BootScene.ts`; the grunt is a `SPECIAL_ARCHETYPES` row (`rocket`) merged only into
  `getTrainerArchetype`'s index, so `TRAINER_ARCHETYPES`/`TRAINER_ARCHETYPE_IDS`/
  `TRAINER_WALK_ANIMS` and the four atlas/animation invariants did not move and **no packer ran**.
  The spin is the pure `casinoSpin(run)` in `src/ui/casino.ts` over
  `${seed}:casino:${mapIndex}:${spins}` — the counter read off the run's own per-floor
  `pickedItems` marks (`casino-spin-<map>-<n>`), so a reload continues the sequence — the lock
  is `casino-lock-<map>`, and the Egg is an ordinary bag item (`price: 0`, never sellable, the
  `luckyegg` icon frame) that `hatchEgg` turns into a member of the **new floor's** band at
  `squadLevel` on the portal step. **No run field**, so **no `SAVE_VERSION`** step, and the casino
  is hung **last** in the pass, so a fixed seed's three older specials do not move. **QA**
  was a single pass (one-task batch): the gates green on `main` + `task-64` (148 files / **1869
  tests**, twice, and `npm run build`), the diff's **27/27** paths inside the spec's list
  (`src/data/items.test.ts` included — the catalogue's never-sold sweep learned the Egg's id),
  `src/engine/` still free of Phaser/DOM and of new `Math.random`/`Date.now`, and
  `src/data/dex/**` untouched. **Measured, not assumed:** QA swept **12 seeds × maps 1–8** —
  at most one casino per floor, never on map 1, always a `dead-end`, never the entry or the boss,
  never farther than the boss — and diffed the plan against a **pre-change** module: across
  8 seeds × 8 maps the three older specials' `specials`, `links`, `entryRoom`/`bossRoom` and every
  `size` are **identical** (the only change on the 19 floors that gain a casino is the new parent's
  door). Live, over its own CDP tab at 1280×800 on seed `pkm-111`, map 5: the room's 96×96 box
  carries the cabinet `#4c2a6b` (1215 px), the roller window `#111827` (384), the lever `#e11d48`
  (91), the three reels `#f2c14e` (126) and the grunt placeholder `#c0392b` (273), the minimap
  draws its own glyph, the panel reads `SLOT MACHINE`/`MONEY ¥30000`/`SPIN ¥2000` in `en` and
  `TRAGAPERRAS`/`GIRAR ¥2000` in `es`, three paid spins take 30000 → 24000 with `Obtained Ultra
  Ball!`, `Obtained Full Restore!`, `Obtained Egg!`, a battle spin closes the window and launches
  `casino-grunt-5` (Team Rocket, Dhelmise 35 / Mr. Mime 32 / Roserade 32), the machine then answers
  `The machine is out of order.` with no money moved, and the next floor spins again; and walking
  the portal hatched the Egg into `Tangrowth L5` with `stats.catches`, `caughtSpecies`,
  `capturedRooms` and `pcCatch` all untouched. Three notes it carries rather than hides: the
  **`rocket` row still has no art** (no Rocket strip exists in the checked sources, so both
  surfaces use the shipped placeholder and the repack is handed to `[Task-90]`, whose entry
  currently excludes it — it must be widened when Batch 29 is cut); the `[live]` casino run used
  **map 5** because seed `pkm-111`'s first casino floor is 3 but only map 5 carries the pinned
  room; and the panel is keyboard-only, unlike the Mart's clickable rows (out of scope, not a
  defect).

### Batch 25 — the gated reward room
- **Task-65** A special room whose reward sits behind bushes, rocks or water that only a party
  Pokémon's **type** opens — Bug or Grass, Rock or Fighting, Water. It hangs a `dead-end` leaf at
  **20 % from map 3 on** (the measured placement; see the balance bullet below), and the report
  asked for a move (Cut / Rock Smash / Surf) while the human's answer (`2026-10-19`) made it a
  **type** gate, so no dex/TM data is touched and `cut` (absent from the build) is never needed.
  The room's spec is `.agent_specs/task-65.md`.
- **The seam it extends is the descriptor layer, and the casino is the descriptor precedent.**
  `[Task-111]` (Batch 23b, `D47`) shipped `RoomDescriptor` / `RoomHost` / `RoomPanel` in
  `src/scenes/rooms/types.ts`, the `import.meta.glob` registry (`registry.ts`) and four
  descriptors, so this room is **`src/scenes/rooms/gate.ts` exporting `descriptor`** — its `kind`,
  its `marker`, and a `fixture` / `interact` / `drawMarker` — and **not** a `buildRoom` branch.
  `[Task-64]` (Batch 24, shipped) is the module it copies: one new `MapRoomSpecial` value, a
  fixture that places its content off a **stable** id, `host.commitRun` for the run, and no scene
  state of its own.
- **Hot files:** `src/scenes/rooms/gate.ts` + `gate.test.ts`, `src/scenes/rooms/types.ts` (the two
  hooks the port gains), `src/scenes/rooms/fixtures.test.ts` (the shared stub) and
  `src/scenes/rooms/README.md` → Task-65; `src/scenes/RouteScene.ts` (the room's build flag, the
  reward's placement and the in-room rebuild after the gate opens) → Task-65; `src/engine/maps/plan.ts`
  + `plan.test.ts` (the new `MapRoomSpecial` value, line 64, and its placement) → Task-65; the new
  pure carve `src/engine/routes/gate.ts` + test, `src/engine/routes/routeMap.ts` (the `RouteGate`
  shape and the route's optional `gate`), `src/engine/routes/sketch.ts` + `sketch.test.ts` (the pass
  and the `expectGate` gate) and `src/engine/routes/validate.ts` + `validate.test.ts` (the
  `missingGate` finding), plus `src/engine/routes/index.ts` → Task-65; `src/engine/map.ts` +
  `map.test.ts` (the two obstacle tile values) and `src/data/tilesets/frlg.ts` + `frlg.test.ts`
  (their frames) → Task-65; the new predicate module `src/engine/run/party.ts` + test
  (`partyHasType`, the seam `[Task-91]` extends) and the obstacle→type table `src/data/gates.ts` +
  test → Task-65, with their lines in `src/engine/README.md` and `src/data/README.md` and the two
  barrels (`src/engine/routes/index.ts`, `src/engine/run/index.ts`); the packed
  `src/assets/frlg/{outdoor,forest,cave}.png` through `scripts/frlg/build-tilesets.mjs` (cells 49
  and 50, the only free ones) → Task-65; `src/ui/notice.ts` + `notice.test.ts` (the gate's two
  builders) and `src/i18n/{en,es}.ts` (its copy) → Task-65; `docs/maps-spec.md` §7,
  `docs/tileset-spec.md` §1/§2/§6, `docs/design-spec.md` §7,
  `docs/balance/route-curve.md` (the measured rows for maps 3-8, no re-base) and
  `docs/route-generator.md` §7 (**O-R5 is reworded, not closed**) → Task-65. It claims no
  `package.json`,
  `src/main.ts`, `vite.config.ts`, `src/data/dex/**`, `src/engine/save.ts`, `src/ui/mapView.ts`
  (the marker **is** `MapRoomSpecial`, the casino's own finding), `src/engine/run/{pool,state}.ts`,
  the move/TM data (`src/data/dex/moves.json`, `src/data/tms.ts`), `src/engine/battle/**` or any
  other packer.
- **Shape:** one task, alone: it wants `src/scenes/RouteScene.ts` (every batch 5-24, Batch 24's
  Task-64 last) **and** the special-room layer Task-64 extends one batch earlier and Task-66 one
  batch later, so it opens the new **Batch 25**. It deliberately claims **neither** `[Task-52]`'s
  pool file (`src/engine/run/pool.ts`) **nor** `[Task-31]`'s placement seam
  (`addCaughtPokemon`/`pcCatch`), so it cannot silently duplicate either: the reward it gates is an
  ordinary ground item placed off a stable room id (the `megaStoneItem` shape, `rooms/megaStone.ts`
  20-28), not a catch. The water seal reuses the shipped `WATER` value (already solid,
  `src/engine/map.ts` 11/16), so only the bush and the rock owe art and tile values; the opening is
  recorded per-floor, so a fixed seed's route geometry is unchanged and **no `SAVE_VERSION`**
  step is owed.
- **Planned against the shipped code (`2026-10-19`), and the cut changed seven ways.** (a) **The room
  is a descriptor module**, not a `buildRoom` branch — the casino's own finding — so
  **`src/ui/mapView.ts` needs no edit** and leaves the hot-file list (the earlier paragraph claimed
  it; the shipped `MapRoomMarker = MapRoomSpecial`, `mapView.ts` 26, made that unnecessary). (b)
  **The carve is a route-generator pass, not a fixture:** `RoomFixture` (`rooms/types.ts` 19-26)
  can only append trainers, items and a counter and cannot write tiles, and `validateRoute` gates
  on `strandedItems` (`routes/validate.ts` 231-233), so the seal must exist **inside** the build; it
  is a new `routes/gate.ts` pass wired into `attemptRoute` (after the branches, `cleanWalls` and the
  terrain pass), and its vault is **not** pushed into `route.pockets` (that list feeds `placeItems`
  1100-1120 and the `unreachablePockets` report 245-247); a gated build that finds no site is a
  **failed attempt** (`validateRoute`'s new `missingGate`, gated on the request), so the room can
  never ship without its gate. (c) **The opening is an input to the build**, not a scene flag:
  `RouteRequest.gate?: 'sealed' | 'open'`, read in `buildRoom` (1109-1150) from
  `isItemPicked(run, gateId(mapIndex, roomId))`, so a revisit and a reload both draw it open and the
  scene keeps no state. (d) **The seal is its own tile value** (`BUSH`/`ROCK`, with the shipped
  `WATER` reused for the third), so `isWalkable` refuses it through `SOLID` (`map.ts` 16) and
  `movementMap`'s tree-tip rule (`treeTipKeys`, `tileFrames.ts` 241-256) can never turn it walkable
  the way a plain `WALL` gate could. (e) **The kind rolls last** in the special pass, after the
  casino's block (`plan.ts` 455-460), so no shipped floor's specials move; the kind and the site
  come off two minted, module-local streams (`:gate:` and `:gate:site:`), so no shipped stream moves
  and a reroll keeps the kind. Its **placement is 20 % from map 3 on**, not the casino's 30 % from
  map 2 — the balance bullet below carries the measurement. (f) **The only free frames are 49 and 50**
  (`build-tilesets.mjs` 76-77), and `frlg.test.ts` 317-323 currently pins them blank, so that case
  flips to "stamps the two obstacle cells". (g) **The gate reads the party's types, not a move**
  (the human's answer): `src/engine/run/party.ts` holds `partyHasType`, the first of the party
  predicates `[Task-91]` extends, and `src/data/gates.ts` holds the three type rows — so the port
  needs **two** hooks (`route()` to read the seal and `rebuildRoom()` to redraw the room in place),
  the reward is placed by the descriptor off `route().gate.pocket`, and `rebuildRoom` keeps the live
  `RouteEncounters` instance so reopening the seal cannot restart the room's encounter sequence.
- **Balance: the leaf hangs at 20 % from map 3 on (`2026-10-19`), because the shipped `0.3` from
  map 2 is red.** The dev measured the real `curve.test.ts` seeds (`curve-a/b/c`) with `award`/
  `needed` fixed per band: **`0.3` from map 2** puts map 2 at **1.5135** (outside both `[1, 1.5]`
  and the on-ramp `[1.2, 1.35]`), map 4 at **1.5145** and map 7 at **0.9910** (below 1) — three
  floors red; **`0.2` from map 2** is green but lands map 2 at **1.3161**, 0.034 under the on-ramp
  ceiling; **`0.2` from map 3** is green with map 2 **untouched at 1.2503** (the leaf never rolls
  there), map 4 at **1.3631** and map 7 at **1.0382**, and `0.3` from map 3 still fails (map 4
  **1.5903**). The cause is the leaf's extra door shifting the `routeIndexForRoom` prefix from its
  start map on, which moves trainers ±15-20 % per floor. Map 3 also suits the room: by then the
  party can plausibly field the asked type, and map 3 is where the mega-stone leaf already starts.
  **`docs/balance/route-curve.md` is re-measured, not re-based:** the eight-floor budget table's
  rows for maps 3-8 move with the measurement (maps 1-2 do not), and **no tuning number changes** —
  `LEVEL_BANDS.trainerXp`, `MAP_TUNING` and `needed(m)` stay put. The spec freezes the numbers and
  the QA criterion: `curve.test.ts` 2/2, all eight fills inside their windows, map 7 the one to
  watch.
- **Batch filling: checked, no member added (`2026-10-19`).** Three later tasks pass the letter of
  the rule and are refused on the **wave rule** — the rule Batch 24 and Batch 23b applied to the
  Phase-9 wave: **`[Task-104]`** (B31, the damage-model abilities: `src/engine/battle/{damage,state,
  turn}.ts`, the ability registry, `docs/balance/effect-coverage.md` and `docs/battle-spec.md`
  §10/§11; deps merged, no batch-mate file needed), **`[Task-107]`** (B49, the double battle's
  engine half: `src/engine/battle/**`, `src/data/bosses.ts` and `docs/battle-spec.md`; deps merged,
  written "against every battle rule shipped so far") and **`[Task-90]`** (B29, the FRLG NPC
  overworld set: `src/assets/frlg/overworld.png`, `src/data/frlg/overworld.json`,
  `scripts/frlg/build-overworld-sprites.mjs`, `src/assets/README.md` and `docs/art-direction.md` —
  disjoint from this task's `forest.png` + `build-tilesets.mjs`; deps none). Each shares a serial
  resource with its own wave one batch apart — `[Task-104]` with `[Task-106]` (B32) and
  `[Task-107]` over `damage.ts`/`state.ts`/`turn.ts`, `[Task-107]` with `[Task-108]` (B50), and
  `[Task-90]` is the wave's **atlas owner**, whose manifest `[Task-89]`/`[Task-91]` read and which
  already owes `[Task-64]`'s deferred `rocket` row — so shipping any of them here pulls a serial
  resource of that wave **four, six and twenty-four** batches ahead of its own cut. Every other
  later task is disqualified outright: `[Task-66]`/`[Task-67]`/`[Task-68]` (B26-B28) hold
  `src/scenes/RouteScene.ts` and two of them `src/engine/maps/plan.ts`; `[Task-78]`, `[Task-79]`,
  `[Task-84]`, `[Task-87]`, `[Task-89]`, `[Task-91]`-`[Task-93]`, `[Task-95]`-`[Task-102]`,
  `[Task-105]`, `[Task-109]` and `[Task-110]` claim the route scene, the route carve or the
  special-room layer; `[Task-81]`/`[Task-82]` claim `plan.ts`; `[Task-106]` claims
  `docs/maps-spec.md` §7; `[Task-103]`/`[Task-87]` claim `src/data/items.ts`; `[Task-85]` claims
  `src/scenes/BootScene.ts` (and is **not** shipped); and `[Task-103]` and `[Task-108]` depend on
  something that has not merged. Batch 25 stays **Task-65 alone**, and its spec is written
  (`.agent_specs/task-65.md`, `2026-10-19`) on the type reading.
- **The move gate is answered and removed (`2026-10-19`).** The entry's report asked for Cut / Rock
  Smash / Surf and the shipped build cannot supply them: `cut` has no `"num":15` row in
  `src/data/dex/moves.json` (835 moves, so `getMove('cut')` is `undefined`) and a member's moves are
  the **randomized** learnset's (`D17`, `src/engine/battle/randomLearnset.ts` 51-64/154-177), drawn
  from `allMoves()`, so a move the dex lacks can never fill a slot. The human's answer replaced the
  move with a **type**: bush → Bug or Grass, rock → Rock or Fighting, water → Water. Rock Smash and
  Surf would have been reachable (both are in the damage pool, Surf also a TM), but the type reading
  needs neither, so **no dex, TM, `TM_COUNT`, shop or battle file is touched** and the room is
  openable by any party that carries the type. `docs/route-generator.md` §7's **O-R5** stays open:
  it is about Cut/Rock Smash **field-move** gates, which this is not.
- **Shipped (Task-65, `2026-10-19`).** The gated room is the room layer's **second descriptor**
  (`src/scenes/rooms/gate.ts`): the scene gained only the port's two new hooks — `route()` (the seal
  and its pocket) and `rebuildRoom()` (the in-place redraw that keeps the live `RouteEncounters`) —
  plus `buildRoom`'s gate flag, the reward's placement and the interact route. The **generator**
  carries the vault: `carveGatedVault` in the new `src/engine/routes/gate.ts` runs inside
  `attemptRoute` and returns the `RouteGate` (`kind`, `tile`, `pocket`); the vault is **not** pushed
  into `route.pockets`, and a request that asks for a gate but cannot carve one fails
  `validateRoute`'s new `missingGate` (gated on the request), so the room can never ship without its
  seal. `RouteRequest.gate` is `'sealed' | 'open'`, read in `buildRoom` from
  `isItemPicked(run, gateId(mapIndex, roomId))`, so a revisit and a reload draw the same room and the
  scene keeps no state. `BUSH = 10` and `ROCK = 11` join `SOLID`; the water seal reuses the shipped
  `WATER`; frames **49** and **50** are packed into all three FRLG atlases by `build-tilesets.mjs`
  (the only free cells; the `frlg.test.ts` blank case flipped) and tree tips cannot walk either
  value. `partyHasType` / `memberTypes` (`src/engine/run/party.ts`) read the party's **species** types
  (the box never counts) and `src/data/gates.ts` holds the three type rows — bush Bug/Grass, rock
  Rock/Fighting, water Water. The reward is one ordinary ground item off
  `gate-loot-<map>-<room>`; the opening is `gate-<map>-<room>` in `pickedItems` (cleared by
  `advanceMap`), so **no run field** and **no `SAVE_VERSION`** step. The kind hangs **20 % from map 3
  on**, drawn last in the special pass off two minted streams (`:gate:` and `:gate:site:`); four
  i18n keys, the room folder's README line, and the four docs rows (`maps-spec` §7, `tileset-spec`
  §1/§2/§6, `design-spec` §7, `route-generator` §3/§4/§7 with **O-R5 reworded, not closed**);
  `docs/balance/route-curve.md`'s measured rows for maps 3-8 were re-read with the harness and no
  tuning number moved. **QA** was a single pass (one-task batch): `npm test` green twice (**152 files
  / 1936 tests**), `npm run build` green, the diff's **40/41** paths inside the amended exclusive
  list — the one extra, `src/scenes/rooms/casino.test.ts`, is the casino stub's two `RoomHost`
  members (the widened port does not typecheck without them; QA judged it a gap in the spec's list,
  not a scope breach) — `src/engine/` pure, `src/data/dex/**` untouched, and the balance facts
  re-measured independently: the eight fills **1.2490 / 1.2503 / 1.1552 / 1.3631 / 1.3567 / 1.3290 /
  1.0382 / 1.1693**, the shipped route maps byte-identical across 10 seeds × 8 maps, and the three
  atlases re-packed byte-identically. **The five `[live]` criteria are not run**: this QA session
  had no browser (no browser MCP is configured and the role's toolset carries none), so the seal's
  canvas measurement, the locked/opened notices on screen, the keeps-open-and-only-for-the-floor
  walk and the minimap glyph are **degraded / unverified**, while their mechanics are covered
  headlessly on seed `pkm-111` (map 6 room 9 `rock`, map 7 room 9 `bush`: frame, reachability,
  notice text, `commitRun` + `rebuildRoom`, `pickedItems`, second interact refused). Whoever runs
  the live pass must compare the opened cell against the **drawn** ground frame, not the literal
  `FLOOR` frame 0 — the forest mix varies it.

### Batch 26 — the trade room, the NPC sprite set and the map passives *(shipped, archived)*
- **Task-66** A trade room: give one Pokémon, receive a random one.
- **Task-90 (filled)** The FRLG NPC overworld sprite set: the packer, the repacked
  `src/assets/frlg/overworld.png`, its generated manifest and the frozen sprite keys
  `[Task-91]` will name. It is dependency-free and claims no path Task-66 touches, so
  it rides here instead of waiting for Batch 29; its packed atlas and manifest are
  its own hot files.
- **Task-105 (filled)** The out-of-battle abilities: the passives table, the pure
  `run/passives.ts`, and the one scene seam that runs it on room entry and on a win.
  It is dependency-free and claims `RouteScene` (which Task-66's spec leaves
  byte-identical) plus code, a data table and doc sections Task-66 does not touch, so
  it rides here instead of waiting for Batch 48.
- **Hot files:** `src/scenes/RouteScene.ts` (the passives' room-entry and win seam)
  → Task-105 — Task-66's expected diff on it is **none**; `src/engine/maps/plan.ts` +
  `plan.test.ts` (the new `MapRoomSpecial` value and its placement) and
  `src/ui/mapView.ts` + `mapView.test.ts` (its marker) → Task-66; the
  deliberate-removal helper and its test under `src/engine/run/` (beside `perms.ts`,
  whose `releaseFainted` it must **not** change) and the received member's build →
  Task-66; `docs/maps-spec.md` §7 and `docs/routes-spec.md` §6's party/PC rule →
  Task-66; `scripts/frlg/build-overworld-sprites.mjs`,
  `src/assets/frlg/overworld.png`, `src/data/frlg/overworld.json` and
  `src/data/overworldSprites.ts` + test → Task-90; `src/engine/run/passives.ts` + test,
  its `src/data/` table + test, `src/engine/run/battleLink.ts`,
  `docs/battle-spec.md` §11, `docs/routes-spec.md` §2 and `docs/data-spec.md` →
  Task-105. No task claims a `package.json`, `src/main.ts`, `vite.config.ts`,
  `src/data/dex/**`, `src/engine/save.ts` or another packed asset; the two doc files
  Task-66 and Task-105 share are claimed by disjoint sections.
- **Shape:** the cut is Task-66, alone, and last of the round: it wants
  `src/scenes/RouteScene.ts` (every batch 5-20, Batch 20 last) and the special-room layer
  its two batch-mates extend one and two batches earlier, so it opens the new **Batch 26**.
  It is the round's only task that removes a **living** member on purpose, so it adds a
  helper that drops exactly one member and leaves `stats.casualties` alone — the
  permadeath path (`releaseFainted`, 17-29) counts a loss and is not the right seam. The
  received member is built and placed exactly as a catch is (`speciesPool` +
  `createFighter({ learnsetSeed: run.seed })`, D17, at the squad's level through
  `adoptAtLevel`, then `addPokemon`), the trade is one per room and refused on a
  single-member party, and the per-room used flag rides the run's existing per-floor
  bookkeeping — so **no `SAVE_VERSION`** step. **Filled** with Task-90 and Task-105:
  both are dependency-free and disjoint in code from Task-66, the gitignored
  `sprite-sources/frlg` tree is present at the runner, and Task-66's zero-diff seam
  frees `RouteScene` for Task-105 — so the batch runs three devs and three Task QAs
  in parallel.

### Batch 27 — the room that bars items and healing moves *(shipped, archived)*

Task-67 merged alone behind the green gate (**2047** tests across **158** files,
`npm test` + `npm run build` green on the merge commit `2e51e315`) and the detail
is in `CHANGELOG.md`'s `## Unreleased`; QA validated it in the single pass a
one-task batch collapses to — the task's plan, both gates, the cross-task audit
and the merge rehearsal on one tree — with every `[unit]` criterion green and
both `[live]` criteria **measured** on a dev server over CDP. **The six written
defaults were taken as the *Decision* froze them**: a special leaf with its own
trainer, the **player's** BAG and the 24 named healing moves only, a normal loss,
and the rule surfaced both in the battle menus and through the entrance notice.
**What shipped.** The seventh `MapRoomSpecial` kind, `no-heal`, hangs a dead-end
leaf with a **20 %** chance **from map 3 on**, as the **last** draw of the special
pass (after the trade leaf), so no shipped floor's rooms, sizes or specials moved —
the plan's existing `SHIPPED_SPECIALS`/`PLAN_PINS`/`TRADE_LEAVES` pins stayed
untouched and a new per-seed pin freezes where the new leaf hangs. The room's
**`psychic`** trainer stands on its farthest tile under the stable id
`noheal-<mapIndex>`, so a beaten room stays beaten; entering the leaf floats
`notice.noHealRoom` through `src/ui/notice.ts` (a new optional `RoomFixture.notice`
the scene shows once the fixture is applied). Every battle started there carries
`BattleLaunch.noHeal` → `BattleState.noHeal`: the feed's first line announces the
rule, the BAG row draws disabled, `src/data/noHeal.ts`'s 24 ids (six self-heals,
eight effect-handled heals, ten drains) are disabled in the MOVES grid and refused
by `validateCommand`, and a fighter whose only PP-legal move is barred resolves as
**Struggle**. The enemy's side, abilities, held items, residual heals, the Pokevial
and the PC are untouched, and no run field or `SAVE_VERSION` step was added. Its
ID is retired: it keeps its place in the sequence and is never reused. What follows
is the cut's own record.
- **Task-67** A special room whose battles bar the player's BAG items and healing moves.
- **Hot files:** `src/scenes/RouteScene.ts` (the launch flag and the fixture notice),
  `src/scenes/BattleScene.ts` (the disabled BAG and healing rows), the new
  `src/scenes/rooms/noHeal.ts` + test, `src/engine/maps/plan.ts` + test,
  `src/engine/maps/progress.ts` + test, `src/engine/battle/commands.ts` + test,
  `src/engine/battle/state.ts`, `src/engine/battle/turn.ts` + test,
  `src/engine/run/battleLink.ts`, `src/ui/notice.ts` + test, `src/data/noHeal.ts` +
  test, `src/i18n/en.ts` + `es.ts`, `docs/maps-spec.md` §7 and
  `docs/battle-spec.md` §2 → Task-67.
- **Shape:** one task, alone, and the batch is the only one that leaves its paths
  free: it wants `src/scenes/RouteScene.ts` **and** `src/scenes/BattleScene.ts`
  together, and the route scene is held by every batch from 5 to 26. It runs after
  Batch 11's reformat and edits files it cleared, so it keeps them conforming.

### Batch 28 — the MOVES tab deletes an equipped move, and the room-effect table's second half *(shipped, archived)*

Task-68 and Task-106 merged in ID order behind the green gate — **2053** tests after the first
merge (`2026-10-19`), and the combined tree measured **158 files / 2071 tests** with
`npm test` + `npm run build` green in Integration QA — and the detail is in `CHANGELOG.md`'s
`## Unreleased`. QA ran one Task QA per task, **in parallel**, each from its own integration
worktree (task branch merged onto `main`), and then one Integration QA on the combined tree; every
`[unit]` and `[live]` criterion was green and the live ones were measured on a dev server over CDP.
Task-68's four written defaults were taken as its *Decision* froze them — the route HUD's MOVES tab
alone, a one-move member refused, the drag onto the learnset band, no confirm — and Task-106's one
cut-time call was frozen in its spec (`ALL_TYPES_OVERRIDE = 'Normal'`, `ROOM_CRIT_STAGE = 1`).

**What shipped.** Task-68 adds `unequipMove(run, memberId, slot)` beside `equipMove`, the exact
inverse: the slot is dropped, the run comes back by reference for an unknown member, an
out-of-range/non-integer slot or a member holding a single move, and the freed slot stays an empty
container while the move returns to the derived band (`Lv##` / `TM###`) and can be dragged back
with fresh PP. The route scene stops reordering while the held move is over the band and folds the
release through the new helper, with no prompt; `docs/design-spec.md` §3 and `docs/tech-decisions.md`
D36 record the inverse. Task-106 appends the six room conditions — radiant zone, dark aura, fairy
aura, all-types change, Endure and +50 crit — to `ROOM_BATTLEFIELDS` (**seventeen** rows, the
shipped eleven untouched) and gives them `BattleState.roomField` (`RoomFieldEffects`, defaulted by
`emptyRoomField()` and seeded by `battlefieldSeeds`): the ability dispatcher skips abilities under
`abilitiesOff`, the damage model applies the two 1.33× auras and reads STAB/effectiveness against
`overrideType`, the turn loop clamps a lethal hit to 1 HP under `endure` and adds `critStage` to the
crit ratio. The route's existing overlay paints the new rows' tints, so no scene, art, i18n or
`SAVE_VERSION` line moved; `docs/maps-spec.md` §7 and `docs/battle-spec.md` §4 record the rules.

**Fill record.** Batch 28 was cut as Task-68 alone; it was filled with **Task-106** from Batch 32,
whose paths (`src/data/battlefields.ts`, `src/engine/routes/battlefield.ts`,
`src/engine/battle/{state,damage,turn}.ts`, the effects registry and its docs) are disjoint from
Task-68's and whose dependency (Task-62) is merged. Every other later task was disqualified:
`[Task-84]`, `[Task-87]`, `[Task-89]`, `[Task-78]`, `[Task-79]`, `[Task-80]`, `[Task-82]`,
`[Task-91]`–`[Task-103]`, `[Task-109]` and `[Task-110]` hold `src/scenes/RouteScene.ts`, the plan's
one-scene-per-batch queue; `[Task-104]` and `[Task-107]` share
`src/engine/battle/{damage,state,turn}.ts` with Task-106, so at most one of the three fits a batch;
`[Task-81]`'s claim is explicitly incomplete and its map-index scaling is still unfrozen; and
`[Task-80]`/`[Task-83]` depend on unmerged tasks. **Batch 32 is therefore `[Task-85]` alone.** Hot
files: `src/scenes/RouteScene.ts`, `src/engine/run/learnset.ts` + test and the two docs → Task-68;
`src/data/battlefields.ts` + test, `src/engine/routes/battlefield.ts` + test,
`src/engine/battle/{state,damage,turn}.ts` + their tests, the effects registry + test,
`docs/battle-spec.md` §4 and `docs/maps-spec.md` §7 → Task-106. No path is shared by the two and no
hot file has two holders.

### Batch 29 — the movement keys never browse a HUD pane *(shipped, archived)*

Task-84 merged with `--no-ff` behind the green gate — **158 files / 2071 tests** and
`npm run build` clean after the merge (`2026-10-19`) — and the detail is in
`CHANGELOG.md`'s `## Unreleased`. The batch has one task, so QA ran **one** pass
covering both scopes: the task's plan verbatim on its integration worktree
(`qa-84`, `task-84` merged onto `main`), both gates, the diff audit and the merge
rehearsal (`git merge-tree` reproduced the integration tree exactly). The `[live]`
criterion was measured over CDP twice — by QA and again by the Orchestrator on its
own server and browser: with the party panel **expanded**, a held `ArrowRight`
walked the player from `(15, 15)` to `(17, 15)` (**+2 tiles**) and `ArrowDown` ×3
reached `(17, 18)` (**+3**), while `hudUi.index` stayed `0` and `hudKeyboardPane`
no longer exists on the scene.

**What shipped.** `toggleHudPanel` is a plain toggle again — the quick key opens or
collapses its panel exactly like the icon click — and the whole pane-keyboard layer
is gone (`focusHudPane`, `handleHudKeyboard` and its member/bag/detail reducers,
`stepMemberCursor`, `releaseHudKeyboard`'s focus path, `hudKeyboardPane`,
`hudPartyHeaderFocus`, the cursor highlights and the raw `[`/`]` pocket keys): about
**560 lines deleted** from `src/scenes/RouteScene.ts`, with the walker's `update()`
gate no longer settling on a pane. Every route-HUD operation the keyboard used to
reach stays reachable by pointer (the shipped pointer zones; the task added none
that already existed). The Mart, the mini-boss reward, the pause menu, the release
beats and the two text fields keep their own paths unchanged — the Mart's lives in
`src/scenes/rooms/shop.ts` and was not touched. `docs/design-spec.md` §10.3 rewrites
the rule (route HUD pointer-first, arrows always walk, the pause menu the one kept
keyboard surface, the exceptions in one sentence) and `docs/tech-decisions.md`
`D45` carries the same amendment; the battle half of both is untouched. No run
field, no `SAVE_VERSION` step, no RNG draw, no new file.

**Fill record.** Batch 29 was cut as Task-84 alone (its planned mate `[Task-90]` was
filled into Batch 26 and shipped there). The fill search found no legal partner and
the constraint is the plan's own one-scene-per-batch queue: every remaining open task
holds `src/scenes/RouteScene.ts` — `[Task-78]` (whose `startTrainerBattle` computes
the level), `[Task-79]`, `[Task-85]`, `[Task-87]`, `[Task-89]`, `[Task-91]`–`[Task-103]`,
`[Task-109]` and `[Task-110]` — so the scene is the single hot file this batch's task
owns. `[Task-104]` is dependency-free and path-disjoint, but its two "dark" abilities
have no dex row: `randomAbilityPool` (`src/engine/battle/randomAbility.ts`) drops any
registry id `getAbility` cannot resolve, so an invented id would be a dead id a run
can never draw, and which ability it is (the plan leaves the second "named at cut
time") is content, not a path. `[Task-107]` is cut last by its own entry and shares
the battle files with `[Task-104]`; `[Task-81]`'s claim its entry marks **incomplete**
with its map-index scaling still unfrozen; `[Task-80]`, `[Task-83]` and
`[Task-93]`–`[Task-100]` depend on unmerged tasks. One dev slot and one QA slot were
therefore left empty, and the plan's cut is unchanged: **Batch 30 is `[Task-87]` +
`[Task-81]`**.

### Batch 30 — a consumable is spent from the route HUD, and a room's size follows its shape *(shipped, archived)*

Task-81 and Task-87 merged with `--no-ff` in ID order — **158 files / 2079 tests**
and build clean after Task-81, **159 files / 2099 tests** and build clean after
Task-87 (`2026-10-19`) — and the detail is in `CHANGELOG.md`'s `## Unreleased`.
Both Task QAs ran **in parallel**, each from its own integration worktree
(`qa-81` = `main` + `task-81`, `qa-87` = `main` + `task-87`), and both were green;
Integration QA ran one pass on the combined tree (`qa-batch30`, `task-81` then
`task-87` merged): the same two gates, no path shared by the two tasks, one holder
per hot file, `src/data/dex/**` untouched, each branch tip identical to the one its
own QA validated, and the merge rehearsal (`git merge-tree` in ID order) reproduced
the combined tree exactly. Task-87's `[live]` criterion was measured over CDP with
real pointer events by its Task QA and **again by the Orchestrator** on its own
server and browser: a `Potion` dragged from the bag onto a 10/21-HP `Bulbasaur`
took it to **21** (gain `11 = min(20, 21 − 10)`), the stack went `1 → 0` and the
`Used Potion.` notice showed; on a full-HP lead the same drag changed nothing, kept
the Potion and raised no notice.

**What shipped.** `src/engine/run/items.ts` is the pure use gate: `itemAppliesTo`
(heal applies only below `maxHp` or with a curable status; a status cure only with a
matching status; a fainted member never applies) and `useItemOn` (consumes one stack
and writes HP/status back, returning the same run reference for every no-op). The
route HUD spends a dropped `heal`/`status` item through it, raises the new
`itemUsedNotice`, and `equipHeldItem` now refuses everything whose `kind` is not
`held` — so a Potion can no longer become a member's held item. The three X-items
are gone from the game (catalogue, four loot rows, `'boost'` item kind, the Bag's
case and the icon map), the FRLG packer now takes its source directory through argv
or the environment and was rerun from `$ASSETS_ROOT` (atlas + manifest regenerated
byte-identically), and `docs/{design,routes,data,battle}-spec.md` carry the rule.
Task-81 replaced the free size roll with the frozen `ROOM_SHAPE_SIZES` table
(`cross`/`straight` 40×40, `tee` 40×48, `bend` 44×44, `corridor` 52×30 and the
north–south 30×52, `dead-end` 30×30) scaled by `mapTuning(n).size.max /
MAP_MAX_ROOM_SIZE`, with `MAP_MAX_ROOM_SIZE` and map 8's ceiling at **56**, every
entry/boss/special leaf pinned 30×30, and the old size draws kept in place so a
seed's topology and the on-ramp's balance windows did not move; `docs/maps-spec.md`
§1/§3/§4 and `docs/balance/route-curve.md` record it.

**Cut and corrective records.** Task-81's entry demanded its map-index scaling be
frozen before it ran, and it was, at cut: the frozen table is map 8 and every earlier
map scales it by its own `size.max / 56`, clamped to `[30, 56]`. Its entry's
"claim is incomplete" note was also completed at cut with the tests the change
re-pins, and one path was still missing — `src/engine/routes/doors.test.ts` — which
the first gate caught (`expected 30 to be 31` on a fixed-seed `bend` room); the spec
was amended, that pin and `docs/maps-spec.md` §3 went to the author, and the task
QA validated `1bd24de6` green. The batch could not be filled beyond its two planned
tasks: `[Task-104]` is still content-blocked (its two "dark" abilities have no dex
row and the second is unnamed — an invented id would be a dead id), `[Task-107]`
shares `src/engine/battle/{damage,state,turn}.ts` with it and is cut last, `[Task-80]`,
`[Task-83]` and `[Task-93]`–`[Task-100]` depend on unmerged tasks, and every other
later task holds `src/scenes/RouteScene.ts`, which Task-87 owns here. No run field,
no `SAVE_VERSION` step and no dex regeneration.

### Batch 32 — a hidden item is the biome's ground, and the double battle's engine rules *(shipped, archived)*

Task-85 and Task-107 merged with `--no-ff` in ID order — **160 files / 2114 tests** and
build clean after Task-85, **161 files / 2131 tests** and build clean after Task-107
(`2026-10-20`) — and the detail is in `CHANGELOG.md`'s `## Unreleased`. Both Task QAs
ran **in parallel**, each from its own integration worktree (`qa-85` = `main` +
`task-85`, `qa-107` = `main` + `task-107`), and both were green; Integration QA ran one
pass on the combined tree (`qa-batch32`, `task-85` then `task-107` merged): the same
two gates, no path shared by the two tasks, one holder per hot file
(`src/scenes/RouteScene.ts` and `src/scenes/BootScene.ts` → Task-85 only), `src/data/dex/**`
untouched, each branch tip identical to the one its own QA validated
(`task-85 = 3daa2dd4`, `task-107 = 4388619b`), and the merge rehearsal reproduced the
combined tree exactly.

**Fill record.** Batch 32 was cut as Task-85 alone (its planned mate Task-106 had been
filled into Batch 28 and shipped there). The fill search pulled **Task-107** forward from
Batch 49: its dependency line is `none` (Task-62 and Task-106, the battle seams it is
written against, are merged), and its paths (`src/engine/battle/{state,commands,order,turn,ai,modifiers}.ts`,
`src/data/bosses.ts`, `docs/battle-spec.md`) are disjoint from Task-85's
(`src/engine/tileset.ts`, `src/engine/tileFrames.ts`, `src/data/tilesets/frlg.ts`,
`src/scenes/{RouteScene,BootScene}.ts` and the three docs). Every other later task holds
`src/scenes/RouteScene.ts` — `[Task-78]`, `[Task-79]`, `[Task-82]` (it still passes
`POPULATION` from the scene), `[Task-91]`–`[Task-103]`, `[Task-109]` and `[Task-110]` —
so the scene's one-owner-per-batch queue is what blocks them here; `[Task-80]` and
`[Task-83]` depend on unmerged tasks, `[Task-81]`'s claim is still flagged incomplete,
`[Task-104]` is content-blocked, `[Task-108]` depends on Task-107 and needs
`BattleScene`, and `[Task-28]` is upstream-blocked and unscheduled. Two dev slots and
two QA slots were used.

**What shipped.** `TilesetConfig.hiddenItemFrame` plus the pure `hiddenItemFrame(tileset)`
resolver; the forest declares frame **41** and drops it from `FOREST_FLOOR_VARIANTS`
(the mix is now `0:8, 1:5, 2:4, 42:1`), `RouteScene.drawItems` draws a hidden item as
that atlas frame at the ground's own scale (no tint, no alpha, no tween), `BootScene`
loses `SPARKLE_TEXTURE_KEY` and its builder, and the reduce-flashing knob keeps only the
battle flash and the reset scrim. The battle engine gains `Slot` 0/1, `secondActiveIndex`,
targeted `FightCommand`s, `takeDoubleTurn` (with `takeTurn` delegating to it), a
four-entry `orderActions`, per-slot partner AI, slot-scoped switches/faints and the
`BOSS_PARTY` `double` flag with `DOUBLE_ACTIVES = 2`; the single-battle path and the
golden log are byte-identical. No run field, no `SAVE_VERSION` step, no RNG change and
no dex regeneration.

### Batch 33 — a regular trainer's level is a percentage of the live squad level *(shipped, archived)*

Task-78 merged with `--no-ff` — **162 files / 2144 tests** and build clean after the
merge (`2026-10-20`) — and the detail is in `CHANGELOG.md`'s `## Unreleased`. The batch
is a **one-task** batch, so its QA was **one single pass** on its own integration
worktree (`qa-78` = `main@69ffceeb` + `task-78@5be1429c`, merge `c16b6b82`): the task's
plan verbatim (both `[unit]` and `[live]`), the two batch gates, the path and purity
audit, and the merge rehearsal, green; the branch tip it validated is `5be1429c`, the
one `eec146dd` merges into `main`. The `[live]` measurement was executed twice
independently (the author's and QA's own dev servers), reading
`game.scene.getScene('Battle').launch.trigger.roster` after `teleportToFloor(4)` and
`setDebugSquadLevel(20)`: `[18, 18]` = `trainerLevel(20, 2, 30)`, with map 4's boss
still at `[30,30,30,30,30,30]`.

**Fill record.** Batch 33 was cut as Task-78 alone, and the fill search added no member:
`[Task-79]` (Batch 34) shares `src/scenes/RouteScene.ts` with it, which is the batch's
hot file; `[Task-80]` depends on the unmerged 78/79 and `[Task-83]` on 78/79/80/82;
`[Task-82]`, `[Task-98]`–`[Task-103]`, `[Task-108]`, `[Task-109]` and `[Task-110]` all
hold the route scene too; `[Task-91]`–`[Task-97]` depend on `[Task-82]` (and `[Task-99]`
on `[Task-98]`); `[Task-104]` is marked `[!]` and content-blocked, and `[Task-28]` is
unscheduled. One dev slot and one QA slot were used.

**What shipped.** The player-relative trainer level: a new
`src/data/trainerLevels.ts` (`TRAINER_LEVEL_PERCENT` `1 → 1`, `2 → 0.9`, `3 → 0.8`,
`4 → 0.7`, `trainerLevelPercent` clamping a size outside 1..4 to the nearest row, and
the pure `trainerLevel(squadLevel, size, cap)` = `clamp(floor(squadLevel × percent), 1,
cap)`), one optional `RosterOptions.levelFor?: (size: number) => number` in
`src/engine/run/roster.ts` (given, it replaces the band's level draw; absent, the shipped
draw is byte-identical), and one call site in `RouteScene.startTrainerBattle` that passes
it for a **regular** trainer only, capping at `band.maxLevel`. The **boss** and the
**mini-boss** keep the draws they shipped with: the boss's band is pinned to the floor's
cap, while the mini-boss draws across the whole map band — the cut's own wording said
both sat at the cap and only the boss ever did, so the spec froze the behaviour that is
true and left the mini-boss alone. `src/data/README.md` gains the file's role line, and
`docs/maps-spec.md` §5, `docs/routes-spec.md` §5 and the two `docs/tech-decisions.md`
addenda (`D11` "the seed fixes the draw, not the level", `D17` "the squad level may set a
level") record it. Removing the level draw shifts the draws after it in the same stream
(the Mega Stone pick), which `roster.test.ts` pins in both directions — a literal
`levelFor` roster beside the untouched control replay. No run field, no RNG added and
**no `SAVE_VERSION`** step.

### Batch 34 — a wild encounter's level is a fraction of the live squad level *(shipped, archived)*

Task-79 merged with `--no-ff` (`5b35eaf0`, `2026-10-20`) behind the green gate —
**163 files / 2156 tests** and build clean after the merge — and the detail is in
`CHANGELOG.md`'s `## Unreleased`. The batch is a **one-task** batch, so its QA was
**one single pass** on its own integration worktree (`qa-79` = `main@fcc82121` +
`task-79@62adc349`, merge `243b57c7`): the task's plan verbatim (the nine `[unit]`
and the three `[live]` criteria), the two batch gates, the path and purity audit,
and the merge rehearsal, 12/12 green on the tip it validated (`62adc349`, the one
`5b35eaf0` merges into `main`). The `[live]` criteria were measured twice
independently (the Orchestrator's and QA's own dev servers, both over CDP
`Runtime.evaluate`): on floor 4, `a` (squad 20) rolled levels `12..14` and `b`
(same room, squad clamped to 30) `18..22`, `min(b) > max(a)`; the squad-5 window
(species `early`) and the squad-30 window (species `late`) shared **no** species;
and the forced wild battle's trigger read `kind: 'wild'` with the same level the
roll produced. The batch holds the plan's **one** `src/scenes/RouteScene.ts` claim
(Task-79) and no other hot file; `package.json`, `src/main.ts`, `vite.config.ts`
and `src/data/dex/**` are nobody's. The docs sections Task-79 owns are
`docs/routes-spec.md` §3/§5, the wild-level clause of `docs/maps-spec.md` §5 and
two new `docs/tech-decisions.md` addendum blocks (`D11`, `D17`);
`docs/routes-spec.md` §2/§4 and `docs/maps-spec.md` §2/§7 stay free for a later
batch.

**Fill record.** Batch 34 was cut as Task-79 alone, and the fill search examined
**Task-82** (Batch 35, `*Dependencies:* none`, the obvious candidate) and did **not**
add it. Its own fix shape needs `src/scenes/RouteScene.ts`: the scene is what still
passes `POPULATION[band.id]` (`RouteScene` 1322) into the `RouteRequest` it builds
inline (`1309-1339`) and what hands the population pass its archetype pool, so
retiring `POPULATION` and gating trainers on a room's role both land on that file —
the batch's hot file, held by Task-79. The plan already knows this: row 35 binds the
route scene to Task-82, and Batch 32's own fill record says 82 "still passes
`POPULATION` from the scene". Filling it here would have put two writers on one
scene, so the batch stayed one task. The rest of the later backlog was examined and
rejected on its own line: `[Task-80]` depends on the unmerged Tasks 78/79 and
`[Task-83]` on 78/79/80/82; `[Task-91]`–`[Task-97]` depend on the unmerged Task-82
(and `[Task-99]` on 82 and 98) **and** hold `src/scenes/RouteScene.ts`;
`[Task-98]`–`[Task-102]` and `[Task-108]`–`[Task-110]` hold the scene too (Task-98
and Task-103 also want `src/engine/save.ts`, and Task-103 `src/data/items.ts` and
the i18n tables);
`[Task-104]` is marked `[!]` and content-blocked; `[Task-28]` is unscheduled
upstream. One dev slot
and one QA slot are used; the other three of each stay empty with the route scene's
one-owner-per-batch queue as their constraint. **For the next cut:** Task-82 is
legal only in a batch where nobody else holds `src/scenes/RouteScene.ts` — alone, or
beside an engine/data task that never touches the scene — so it cannot ride with
Task-80 until Task-79 has merged.

### Batch 35 — the cap-only floor and the trainer-room composition *(shipped, archived)*

Task-80 and Task-82 merged with `--no-ff` in ID order (`2026-10-20`) behind the green
gate — **163 files / 2158 tests** after Task-80, **2164** after Task-82, build clean
after each — and the detail is in `CHANGELOG.md`'s `## Unreleased`. Two Task QAs ran
together, one per task, each from its own integration tree (`qa-80` =
`main@363d3f21` + `task-80@cfcf63dd`, `qa-82` = `main@363d3f21` + `task-82@771168e4`),
and the integration pass ran on `qa-batch-35` = both merges (`d76ce6c5`). Task-80 is
**invisible by construction**: it removes `MapTuning.levels` and derives the floor
window from adjacent caps (`{ m <= 1 ? LEVEL_BANDS[0].minLevel : cap(m-1), cap(m) }`),
so `bandForMap`/`runBand` return byte-identical `LevelBand`s and
`src/scenes/RouteScene.ts` is untouched; every test that reads the curve, the roster,
progression, the level cap, the plan or the minimap stayed undiffed. Task-82 tags each
regular room `role: 'trainers' | 'wild'` from `TRAINER_ROOMS_PER_MAP` = 2,2,3,3,3,4,4,4,
appends the role draws after the last special draw, replaces `POPULATION` with
`TRAINERS_PER_ROOM` 1-2 and retires the map-size trainer bonus from the pass;
`wantsTrainers` gates the lane guard on `role !== 'wild'`. The scene holds the batch's
one `RouteScene.ts` claim and the one hot file; `package.json`, `src/main.ts`,
`vite.config.ts`, `src/data/dex/**` and every generated asset are nobody's. Docs shared
by section: `docs/maps-spec.md` (80 §1/§4/§5; 82 §2/§3/§7), `docs/routes-spec.md` (80
§5 bullet 1; 82 §2 step 4 and §5 bullets 4/6) and `docs/tech-decisions.md` (80 D29
addendum; 82 D30 addendum); Integration QA verified no lost line in the combined
files. The optional minimap trainer marker the entry allowed was dropped (it would
need a second, non-`D47` glyph path), so `src/ui/mapView.ts` is no longer row 35's.

**The XP re-solve and its one recorded deficit.** A floor's trainer budget collapses to
2-4 rooms × 1-2 trainers, so Task-82 re-solved `LEVEL_BANDS[*].trainerXp` by measurement
(`early 6.07, low 16.18, mid 8.59, high 12.70, late 10.86, end 7.96`) to keep
`curve.test.ts` green. Maps 6-8 share the single `end` band, and their caps demand
`needed` = 28854 / 38142 / 48726 (`needed(8)/needed(6) = 1.6887`), so one multiplier
cannot put all three inside `[1.05, 1.5]`: the measured column is
1.25/1.25/1.25/1.25/1.25/1.49/1.44/**0.96**, and floor 8 is pinned at 0.96 (its legal
band is `[0.95, 0.9623]`). The test states the arithmetic instead of hiding it, and
`[Task-83]` (Batch 36) owns the root-cause fix the cut froze: a per-floor factor
`TRAINER_XP_PER_MAP` / `trainerXpMultiplierForMap` threaded through `experienceAward`
(a fourth, defaulted parameter) and `resolveBattle`, deleting `SHARED_BAND_MIN_FILL`.
`docs/balance/route-curve.md`'s band and budget tables are knowingly one batch stale;
Task-83 re-pins them.

**Fill record.** Batch 35 was cut as Task-82 + Task-80 and the fill search examined
every later open task: `[Task-83]` depends on both members, `[Task-103]` on the
unmerged `[Task-94]`/`[Task-95]`, and every other candidate (`[Task-91]`–`[Task-102]`,
`[Task-108]`–`[Task-110]`) claims `src/scenes/RouteScene.ts`, held here by Task-82;
`[Task-104]` is `[!]` and `[Task-28]` unscheduled. Two dev slots and two QA slots are
used; the other two of each stay empty with the route scene's one-owner-per-batch queue
as their constraint. No task moved batch.

### Batch 36 — the per-floor trainer XP factor, and the floor's mission

**Cut (`2026-10-20`).** The batch's floor is the lowest pending cut of the plan:
`[Task-83]` (the XP curve re-solved against the new floor budgets) and `[Task-98]` (the
floor-mission framework). They share no path: 83 owns `src/data/run.ts` + its test,
`src/engine/run/progression.ts` + test, `src/engine/run/resolve.ts` + test,
`src/engine/run/curve.test.ts`, `docs/balance/route-curve.md` and one bullet of
`docs/battle-spec.md` §7; 98 owns the new `src/engine/run/missions.ts` and
`src/data/missions.ts` (each with its test and its folder README line),
`src/engine/run/state.ts` + test, `src/engine/save.ts` + test, `src/ui/notice.ts` + test,
`src/i18n/{en,es}.ts`, `src/scenes/RouteScene.ts` and `docs/routes-spec.md` §4/§6,
`docs/design-spec.md` §7 and `docs/maps-spec.md` §7. The batch holds the one
`src/scenes/RouteScene.ts` claim (98), and `package.json`, `src/main.ts`,
`vite.config.ts`, `src/data/dex/**` and every generated asset are nobody's. One correction
is recorded rather than hidden: the plan's own `[Task-98]` text put the floor's HP-loss
fact in the battle fold, but `src/engine/run/resolve.ts` is 83's — so the rule lives as a
pure helper in 98's `missions.ts` (`battleHpLoss`) and the scene only wires it; the batch
stays an antichain and the rule is unchanged.

**Fill record.** The fill search examined every later open task against the union above.
`[Task-91]`–`[Task-97]` all claim the NPC layer (`src/data/npcs.ts`,
`src/engine/routes/npcs.ts`, `src/ui/npcPanel.ts`) and the route scene, and every one of
them but 91 depends on an unmerged task (92 on 91; 93 on 91 and 98; 94 on 91; 95 on 91;
96 on 91 and 98; 97 on 92, 91 and 96). `[Task-99]` and `[Task-109]` depend on 98 itself
(the mission record and the `notice.ts` row this very batch adds) and 109 also claims
`src/ui/notice.ts` and `src/i18n/**`, which 98 holds. `[Task-100]` and `[Task-102]` claim
`docs/maps-spec.md` §7 (and 102 the route scene), which 98 holds. `[Task-101]` depends on
`[Task-94]`; `[Task-104]` is `[!]`; `[Task-108]` and `[Task-110]` claim the route scene;
`[Task-114]` depends on `[Task-101]`; `[Task-115]` claims `src/data/README.md` and
`docs/maps-spec.md` §7 with a model 98 does not, and `[Task-116]`/`[Task-117]`/`[Task-118]`
depend on the unmerged 115/91/114. `[Task-28]` is unscheduled. So two dev slots and two
QA slots are used and the other two of each stay empty with those constraints named; no
task moved batch.

**Shipped (Task-83, `2026-10-20`).** The award is now per floor: `TRAINER_XP_PER_MAP` =
`1, 1, 1, 1, 1, 0.84, 0.87, 1.31` (eight two-decimal factors) and
`trainerXpMultiplierForMap(mapIndex)` clamps at both ends and repeats its last row past
the last finite map; `experienceAward` takes the factor as a **fourth, defaulted**
argument, so the three-argument form every other call site uses is unchanged and a wild
award ignores it; `resolveBattle` passes `trainerXpMultiplierForMap(next.mapIndex)`.
`curve.test.ts` deletes `SHARED_BAND_MIN_FILL` and returns floor 8 to `MIN_FILL`, and the
walk measures **1.2493 / 1.2496 / 1.2493 / 1.2499 / 1.2496 / 1.2510 / 1.2527 / 1.2518**
over `curve-a`/`curve-b`/`curve-c` — every floor at 1.25, inside `1.05 – 1.5`.
`docs/balance/route-curve.md`'s band table was **stale against the code** (it still
carried the pre-Task-82 multipliers, 2.67/10.68/3.04/5.82/4.65/2.61); it now carries the
shipped 6.07/16.18/8.59/12.70/10.86/7.96, the new `Factor` column, and the measured
`A(m)`, budget and fill columns. **QA:** one Task QA from `qa-83` (`main@4b28f8a` +
`task-83@8a19872`; integration commit `68230b4`) — 8/8 `[unit]` criteria green, **2112**
tests, build clean, 10 diff paths (the 9 exclusive ones + the spec commit), and an
independent re-walk outside the pinned test reproduced **every cell** of the sheet and
the boss/mini-boss award figures; `docs/battle-spec.md`'s diff is one hunk inside §7.

**Shipped (Task-98, `2026-10-20`).** A floor now carries **one mission**, chosen from the
seed alone when the floor is built (`missionForMap`: one draw from
`Rng(hashSeed('${seed}:map:${mapIndex}:mission'))`, its own stream, so no layout,
encounter, roster or battle draw moves and a revisit or reload picks the same row), and
the run records whether it was met when the portal advances. The one kind that ships is
**`flawless`** — leave the floor with no HP lost and no casualty — and `MISSION_TABLE`
gives it the **fixed reward row** `{ kind: 'room' }` the later room tasks read. `RunState`
gains `mission`, `missionsCompleted` (run-long), `hpLost` and `floorCasualties` (both per
floor, both reset by `advanceMap`, which evaluates the floor being left before it heals),
so the schema steps **18 → 19** with its migration (an old run starts with no mission and
a zero counter). The HP the squad spent is a **pure helper in `missions.ts`**
(`battleHpLoss`) called by the scene before the fold — `src/engine/run/resolve.ts` stays
its batch-mate's — so a faint's whole remaining bar is counted and a casualty always fails
the mission. The route HUD draws the floor's mission as one line on its own card under the
transient-notice strip (360×32 at `(460, 76)`, depth 439 under the strip's 440), hidden
when a save carries no mission, and meeting one raises `missionCompleteNotice` through
`src/ui/notice.ts` with its `hud.mission`, `mission.flawless` and
`notice.missionComplete` keys in both locales. **QA:** one Task QA from
`qa-98` (`main@4b28f8a` + `task-98@07aae73`; integration commit `eee6d2e`) — 10/10
`[unit]` criteria green, **2148** tests, build clean, 19 diff paths (the 18 exclusive ones
plus the spec commit) with neither `src/engine/run/resolve.ts` nor `docs/battle-spec.md`
in it, and its one `[live]` criterion **measured** over CDP on the live canvas
(`renderer.snapshotArea` + `getImageData`, 1280×800, seed `pkm-111`, map 1, room 0): the
card's rect differed from `origin/main` in **11 420 of 11 520** pixels while the minimap
control rect differed in **0**.

### Batch 40 — the run-modifier NPCs *(shipped, archived)*

Task-94 merged alone behind the green gate (`2026-10-20`; **2338** tests, `npm test` +
`npm run build`) and the detail is in `CHANGELOG.md`'s `## Unreleased`. Because the batch
was **one** task, its QA was a single pass that covered both scopes (`qa-94` =
`main@6f08530` + `task-94@683d862`, integration `f03e10d`): 9/9 criteria green, the
`[live]` one measured over CDP on the live battle and on the route after it, and the
merge rehearsal confirming the spec commit is the only difference between the validated
tree and the merged one.

**Fill record.** The batch was cut as `[Task-94]` alone and the fill search examined every
later open task: `[Task-95]`, `[Task-96]`, `[Task-97]`, `[Task-99]`, `[Task-100]`,
`[Task-101]`, `[Task-102]` and `[Task-108]`-`[Task-110]` all claim
`src/scenes/RouteScene.ts`, held here by 94; `[Task-103]` shares `src/engine/save.ts` with
it and depends on the unmerged 94, 95 and 106; `[Task-114]` claims `src/i18n/{en,es}.ts`,
which the four new NPC rows need for their seventeen keys; `[Task-117]` shares
`src/data/npcs.ts` and §7's NPC table; `[Task-118]` depends on the unmerged 114;
`[Task-104]` is `[!]` and `[Task-28]` is unscheduled. One dev slot and one QA slot are
used, and the other three of each stay empty with those constraints named.

### Open questions for the human

Batch 4b's three reports added two more (the learnset band's is **answered** — the
`<` / `>` pair stays as a one-row scroll, frozen in `### Batch 6b` above — so its bullet
is gone), this second round of six added four, the third round of three adds three, a
fourth round of two adds two, the fifth round of two adds
four (three behind the wild-pool rule and one behind the battle panel's types) and the sixth
round of four adds three (two behind the four-row Mart and one behind the four containers) —
the sixth round's fourth report is a measurement rather than a question, and it is written into
`[Task-09]`'s entry instead — and the seventh round's single report adds two (both behind the
trainer's Poké Ball row, and **both answered** — the row is the foe's alone and it is
**fixed**, one ball per roster member with the fainted ones emptied, frozen in
`### Batch 6b` above, so their bullets are gone) — and the eighth round's three reports add
five (two behind the debug
panel's palette — **the panel direction is answered** with the `t-glass` card of
`chrome-options.html`, recorded in `[Task-58]`'s entry below, so that bullet is gone and only
whether the audit is re-run stays open — plus one behind the switch window's move ⓘ and two
behind the battle's info
window) — and Batch 5's own one (Task-42's catch HP: the number or the fraction) was
**answered with the fraction** and shipped, so its bullet is gone — and the ninth round's three
reports add six (one behind the boss win, three behind the room battle condition and two
behind the mini-boss reward) and the tenth round's three add eight (four behind the casino, two
behind the gated reward room — **answered and removed**, `2026-10-19`, including the key the round
never asked, below — and two behind the trade room) and the eleventh
round's single report adds six (all behind the no-items/no-heal room), **answered** by
Task-67's *Decision* — the six written defaults — and shipped with it, so their bullets are
gone, and the twelfth round's four (the surface, the last move, the gesture and the confirm, all
behind the MOVES tab's delete) were **answered by `[Task-68]`'s *Decision*** and shipped with it,
so their bullets are gone — and the **third round's Task-47 question is answered** (the human settled it when
Batch 7 was cut: the Continue row reads the route HUD's own string, `` `Map <n> · <biome>` ``,
with **no** third clause, frozen in `### Batch 7` above and in `.agent_specs/task-47.md`, so
its bullet is gone) — and the **eighteenth round's two decisions add no question at all**: they *answer* two
of them, so the grid's reading and the follower's missing-sheet case leave this list (both are
frozen in `[Task-34]`'s and `[Task-41]`'s entries and in the round's own paragraph above, and the
follower's bullet below is rewritten to the ids `[Task-76]`'s manifest lists as missing) — and the
**nineteenth round's single report adds one** (behind the battle panel's XP row, whose height the
report itself does not settle) — and every question here carries a written default rather than a
guess. **Batch 5b's seven are all
answered**, so their bullets are gone and the answers live in `### Batch 5b` above, archived, and
in its five specs: Task-45's two readings of the grass step (FireRed's own, on the player's tile —
and its art is the decomp's field effect, five frames packed into the atlases),
Task-46's destination (both outcomes to the main menu), Task-51's two calls (BST bands
20 / 30 / 40 over the `LevelBand.bst` windows with the +10 floor, and the cap kept so a late
line waits), Task-53's two panels (both, with the badge atlas and the chip fallback) and
Task-54's two (the four stock rows taken literally, and the catalogue price with no markup
table). Everything the first plan
raised is decided: the Añil art was materialised into the local clone, `Task-23` is unblocked
(the three moves ship, `D42`), `Task-24` is retired, the audio comes from the original
games' audio rips under `sprite-sources/frlg-audio/`, and the Plates are made obtainable
by `Task-07`. A question lands here only when the repository genuinely cannot answer it.
The **twenty-seventh round's three** were **answered after the cut** and are recorded in the
"Resolved since this table was written" note at the end of this list, so their bullets are gone; the
**twenty-eighth round adds one**, the area-entry panel's cadence, which is the last bullet above that
note. The one ID without a batch is not a question: `[Task-28]` waits on an upstream
`typescript-eslint` release.

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

- **`[Task-41]` (the follower, Batch 6): what does the follower show for an id the sprite set
  does not cover?** `[Task-76]` (Batch 5f) packs a pair for **every** species and form PMDCollab
  has — the shipped 652 pairs are extended, not replaced — and commits a coverage manifest whose
  `missing` list names the ids no pack was found for, so this is a fallback rather than the
  ordinary Gen 6+ case the bullet used to describe. The written default is: resolve the member's
  `speciesId` through that manifest and **draw nothing** when it is missing, so the follower
  simply is not there for those leads; the alternative is a base-species fallback (the
  `portraitFor` / `megaFormOf` shape, `src/data/portraits.ts` 28-36), which draws the base form's
  art for a forme that has none. Say which before Batch 6's branch is cut. Nothing else in the
  plan changes either way.

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

- **`[Task-77]` (the battle panel's XP bar, Batch 15): does the player's HP panel shrink to the
  foe's height, or keep its own?** The row this report removes is the panel's **last band**: the
  gauge sits at `barY + 36` (8 px tall, `FRLG_HPBAR.width` wide) and the `XP n` label at
  `barY + 46`, while the panel's content otherwise ends with the HP bar at
  `barY + FRLG_HPBAR.height` — so `PLAYER_PANEL_H = 184` (`BattleScene` 88) is the foe's 150 plus
  exactly that band, and with the row gone the frame would hold a ~38 px empty field at its foot.
  The written default is that the panel takes **150** and hugs its content the way the foe's does
  (4 px of slack each); it moves no sprite and no clearance — on the desktop the rect's bottom
  stays put (`y = box.y - 24 - PLAYER_PANEL_H`, 1597, so only the top drops by 34 px) and on the
  compact layout the rect's `y` is `Math.round(height * 0.46)` (1576) and never reads the height,
  so `FOE_PLATFORM_CLEAR` and the battlers' size caps are untouched — but the frame's own shape is
  a screen the human reads, so it is worth a word. The alternative is to keep **184**, which
  changes no geometry at all and leaves the band empty inside the frame. Say which before Batch
  15's branch is cut; nothing else in the plan changes either way, and the two readings share the
  same file, so neither re-cuts the batch.

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

- **`[Task-55]` (the four containers, Batch 18): does the battle's FIGHT menu draw them too?**
  "en moves" names the panel, and the MOVES **tab** is what the report's reason needs (a TM is
  dragged onto a slot only in the route HUD; the battle has no drag). The written default is
  **both surfaces**: the shared `MoveGrid` gets one empty-slot marker and both scenes draw the
  four containers, with the battle's empty ones disabled — there is no move to select — so a
  two-move Pokémon reads the same in battle as on the route. The alternative is the route HUD's
  MOVES tab alone, which leaves the battle's menu drawing one cell per move. Say which before
  Batch 18's branch is cut. Nothing else in the plan changes either way.

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

- **`[Task-61]` (the boss win, Batch 21): does the room get rebuilt, or is the portal un-sealed
  in place?** The portal is carved from the start and only **sealed** while the boss stands
  (`applyRoute`'s `sealEdge`, 1151-1153), so the two readings are: **rebuild** the room through
  `transitionTo` with the player's tile preserved (the written default — the un-sealed room is
  then exactly the room a revisit draws, portal art included), or **un-seal the single edge** on
  the live map and repaint (cheaper, no sprite churn, but it leaves the room built by the sealed
  pass). Either way the player stays on the tile they fought from; say which before Batch 21's
  branch is cut. Nothing else in the plan changes either way.

- **`[Task-62]` (the room battle condition, Batch 22): is dense fog a weather or a field
  condition?** The engine's weathers are `sun | rain | sand | snow` (`WeatherId`, `state.ts` 10)
  and its field conditions are `trickroom | gravity | magicroom | wonderroom | fairylock |
  mudsport | watersport` (`FieldConditionId`, 18-19). The written default is the **field
  condition**, because fog must not enter `weatherModifier`/`weatherChip` (`damage.ts` 51-67,
  `turn.ts` 985-998) and the field shape is the one Gravity and Trick Room already use; the
  alternative is `'fog'` joining `WeatherId` (the games' own shape, and the label table at
  `effects/weather.ts` 20-32 is the ready seam), which drags the damage and chip paths in.
  Say which before Batch 22's branch is cut. Nothing else in the plan changes either way.

- **`[Task-62]` (the room battle condition, Batch 22): does the −20 touch a never-miss move?**
  The report asks for a flat −20 accuracy on attacks, and `accuracyChance` short-circuits a move
  whose `accuracy` is `true` before any multiplier (`accuracy.ts`, 11). The written default is
  that a never-miss move (`true`) is **unaffected**, because fog bends aim rather than removing
  a move's guarantee; the alternative is to fold the −20 into the chance for every move,
  including the `true` ones, which would make Swift and Aerial Ace missable. Say which before
  Batch 22's branch is cut. Nothing else in the plan changes either way.

- **`[Task-62]` (the room battle condition, Batch 22): does a **wild** battle in that room start
  under it too?** The report names trainer rooms and the boss room, and a regular room can carry
  tall grass beside its trainers (`docs/routes-spec.md` §2). The written default is that the
  condition belongs to the **room**, so **every** battle that starts there begins with it, wild
  encounters included; the alternative is to gate it on the battle being a **trainer** battle
  (`trigger.kind === 'trainer'`, the launch's own field), so a wild encounter in the same room
  fights clean. Say which before Batch 22's branch is cut. Nothing else in the plan changes
  either way.

- **`[Task-63]` (the mini-boss reward, Batch 23): highest stat + nature, or the report's
  alternatives?** The report's primary ask is that each of the three be presented by its
  **highest stat and its nature**, with the name and the sprite hidden — that is the written
  default. The alternatives it floats are that the three read by their **rolled abilities**
  (which are random, D17, so never the species' own — the report's own words) or by their
  **random movesets**; either would show a different (and, for abilities, deliberately false)
  hint in the same three rows. Say which before Batch 23's branch is cut. Nothing else in the
  plan changes either way.

- **`[Task-63]` (the mini-boss reward, Batch 23): one window with two row kinds, or a first
  choice between items and Pokémon?** The report says the Pokémon options sit **beside** the
  item options («a parte de opciones de objeto»). The written default is **one** reward window
  whose three rows are the item rows and whose Pokémon options appear beside them (so the
  cursor, `E`/`Q` and the leave path stay one control, and a beaten mini-boss still always
  offers items); the alternative is a first pick — items or a Pokémon — followed by the three
  rows of whichever was chosen, which reads cleaner on a small screen but adds a second window
  and a second cursor. Say which before Batch 23's branch is cut. Nothing else in the plan
  changes either way.

- **`[Task-64]`'s four casino questions are answered and were removed (`2026-10-19`).** The
  machine locks the moment the grunt battle **triggers**, the egg hatches on the **map advance**,
  the egg is a **bag item** whose species rolls at hatch time (no run field, no `SAVE_VERSION`
  step) and the grunt battle is a **spin outcome** — the answers its own entry's `*Decision:*`
  line already carried, and the ones `Batch 24`'s spec freezes with exact names, streams and
  numbers. The one question the round did **not** ask, and which the cut turned up, is the
  grunt's **art**: no Rocket grunt exists in the local rip (the overworld source directory holds
  twelve strips and none is one, the `pokefirered` clone is partial and has no `graphics/`, and
  only the battle sheet's measured Regular Trainers block is documented), so
  `[Task-64]` ships the `rocket` keys over the **shipped placeholder** and the repack is left to
  the human's answer — drop the strips (`sprite-sources/frlg/overworld/rocket.png`, a 160x32
  nine-pose sheet) and name the grunt's cell on `trainers.png`, and whoever owns the atlas next
  (Batch 29's `[Task-90]`) packs both rows; or keep the stand-in. Nothing else in the plan
  changes either way, and Batch 24 is cut and its spec written on the placeholder reading.

- **`[Task-65]`'s three gated-reward questions are answered and were removed (`2026-10-19`), and the
  same answer rewrote the entry.** The first two the entry's `*Decision:*` line had already frozen:
  **any** party member opens the obstacle (the lead included, no special case, HP irrelevant — the
  report's «algun poke del party») and the opening is **permanent for the floor** (a stable
  room-scoped mark in `pickedItems`, `state.ts` 130-131, cleared by `advanceMap` at 217-235, so a
  revisit finds it open and a reload does too), so there is no run field and **no `SAVE_VERSION`**
  step. The third the round never asked, and the cut turned it up: **the key could not be a move.**
  `cut` has no row in the generated dex (835 moves; `getMove('cut')` is `undefined`) and a member's
  moves are the randomized learnset's (`D17`), drawn from `allMoves()`, so a bush keyed to Cut would
  be unopenable on every run. The human's answer (`2026-10-19`): **the obstacle is opened by a party
  Pokémon's TYPE** — bush → **Bug or Grass**, rock → **Rock or Fighting**, water → **Water** — so no
  dex/TM row changes, `src/engine/run/party.ts` ships `partyHasType` instead of a move accessor,
  and `docs/route-generator.md` §7's **O-R5** (Cut/Rock Smash field-move gates) stays **open**.
  Batch 25's spec carries all three verbatim.

- **`[Task-66]` (the trade room, Batch 26): is the trade optional, and can the player decline
  after seeing what is offered?** The report says «das un poke y te da otro random» and does not
  say the offer is visible first. The written default is that the trade is **optional** — the
  panel opens on the interact key, the player picks a member and takes the random one, and
  leaving with the cancel key grants nothing (the reward window's own `Q` path, `RouteScene`
  5830-5832) — and that the received Pokémon is **rolled on acceptance**, not previewed, so the
  gamble is the report's own. The alternative is that the panel first shows what it will give
  (species and level) and the player then accepts or declines, which turns the room into a
  straightforward upgrade. Say which before Batch 26's branch is cut. Nothing else in the plan
  changes either way.

- **`[Task-66]` (the trade room, Batch 26): what level does the received Pokémon join at?** The
  written default is the **squad's level** — the exact rule a catch already follows
  (`adoptAtLevel(keyed, squadLevel(run), run.seed)`, `resolve.ts` 96, `docs/battle-spec.md` §7)
  — so a trade is never a level loss or gain; the alternative is the **room's own band level**
  (`bandForMap(run.mapIndex)`, the roster's source), which makes a trade on a deep floor hand
  back a stronger Pokémon than the squad and on an early floor a weaker one. Say which before
  Batch 26's branch is cut. Nothing else in the plan changes either way.

- **`[Task-109]` (the area-entry panel, Batch 51): does the banner fire on every room, or only when the
  area changes?** The originals fire **once per area** — they have no per-room banner — while the
  report's words are «al entrar en una ruta» and a route is a room. The written default is **every
  room**: the panel is raised on each room change (`applyRoute` / `transitionTo`) and on the floor
  advance (`advanceMap`, where the number in the header moves too), so the player reads the area name
  as they read the header's. The alternative is the originals' own cadence — **only when the map
  changes**, one comparison of the new room's `mapIndex` against the previous one on the same seam —
  which is one beat fewer per room and never repeats itself inside a floor. Say which before Batch 51's
  branch is cut; nothing else in the plan changes either way.

- **Resolved since this table was written** (the human's answers): `[Task-97]`'s gate is a **blocked room
  whose obstacle is passed by a party of a named type** (a sibling of `[Task-96]`, not of `[Task-65]`'s
  move gate); `[Task-103]`'s candy **rolls its stat per run and reveals it only once a colour has been
  tried**, so its `SAVE_VERSION` step carries a discovered-colour set as well as the treats; and
  `[Task-101]` bans the **member**'s species, which is what the entry already reads. The three bullets
  that used to sit here are gone.

---

## Phase 0 — Repo & scaffolding

> Completed work for this phase is archived in `CHANGELOG.md`.

- [x] **[Task-28] Activate the ESLint half of `npm run lint`.** *(Closed `2026-10-25`: the half is
      dropped, not deferred — see the decision line.)* Task-01 shipped
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
      *Decision (`2026-10-25`): **the ESLint half is dropped for good** (`D51`).* The human chose one
      compiler over a second toolchain: native `typescript@7` stays the only TypeScript in the repo,
      `eslint.config.mjs` is deleted with this entry, and the lint gate is `prettier --check .` plus
      `tsc --noEmit`, which `npm run build` already runs. If a lint net is wanted again it must be a
      linter with no TypeScript API dependency as its own task — never this one.
      **Closed** (no batch).
- [x] **[Task-29] The Prettier reformat pass.** Task-01 shipped the format gate over a
      **ledger** rather than rewrite a file a batch-mate owned: `.prettierignore` was a
      132-entry file, and its `src/**` block is **104 individual files** (plus the five
      generated-data globs, which stay — the numbers the cut first carried, 105 and four,
      are corrected here) that Prettier would rewrite: 103 of them genuinely, since
      `src/data/shop.ts` was already conforming and only lost its line. This task pays that
      off: format every ledgered `src/**` file with the shipped `.prettierrc.json`
      (`npx prettier --write <file>`, never a retune of the options), confirm the file
      now passes `prettier --check`, and delete its ledger line. What stays is exactly
      what has a reason to stay: the generated/binary globs, the `scripts/**` packers
      and the prose files the ledger names (`AGENTS.md`, `CHANGELOG.md`, `TODO.md` and
      the `docs/*.md` it lists), which belong to the docs tasks and to the
      Orchestrator, and get a clearer comment than today's; `docs/agent-ci.md`, which
      the CI work added and the ledger never listed, joins that prose block. Owners: the ledgered `src/**` files and `.prettierignore`. Every task
      from here on keeps the ledger from growing — a new file conforms, and a task that
      edits a ledgered file never adds a line to hide it.
      *Dependencies:* none. *(Batch 11 — shipped)*

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

- [x] **[Task-52] The wild table never rolls a species the run has already caught, nor its
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
      *Decision:* All three written defaults: the starter is **not** tracked, the rule binds the **wild table only**, and a table the exclusions would empty **falls back to the unfiltered band**.
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

- [x] **[Task-35] Enemy AI: the cartridge's AI scripts, expected value, and the
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
- [x] **[Task-48] The run's first wild Pokémon is much easier to catch.** Reported in
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
      *Decision:* The boost is the run's first **successful** capture, live while `stats.catches === 0`, applied as a flat **255**. No new run field, so Task-52 keeps the `SAVE_VERSION` step 17 -> 18.
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

- [x] **[Task-119] The move audit, and a coverage ledger that counts evidence instead of a flag.** The
      human's report: «añade en todo lo antes posible tarea para revisar logica de todos los ataques, ahora
      los de estado o daño relativo parecen no hacer nada la mayoria o no funcionan exactamente igual».
      This is the **first** of the three tasks that answer it and it **changes no rule**: it builds the
      instrument the other two are judged by and repairs the table that hid the defect.
      **Why the table could not see it.** `docs/balance/effect-coverage.md` reads **835 moves — 786
      `port`, 0 `no-op`, 49 `excluded`** (356), and every row's note comes from `portedMoveNote`
      (`scripts/effect-coverage.mjs` 188-210), whose last two fallbacks are `move.basePower > 0` (207)
      and **`move.flags.protect` (208)**. `flags.protect` is set on nearly every targeted move, so
      **76 rows are `port` for that flag and nothing else** — the ledger prints `data: flags.protect`
      and no line of `src/engine/battle/**` reads it. They are the moves the report names: `Attract`,
      `Disable`, `Torment`, `Spite`, `Trick`, `Switcheroo`, `Skill Swap`, `Heart Swap`, `Power Swap`,
      `Guard Swap`, `Power Split`, `Guard Split`, `Speed Swap`, `Soak`, `Reflect Type`, `Mimic`,
      `Simple Beam`, `Worry Seed`, `Gastro Acid`, `Entrainment`, `Topsy-Turvy`, `Nightmare`,
      `Octolock`, `Spider Web`, `Telekinesis`, `Lock-On`, `Mind Reader`, `Foresight`, `Odor Sleuth`,
      `Defog`, `Heal Pulse`, `Floral Healing`, `Purify`, `Instruct`, `Quash`, `Electrify`, `Embargo`,
      `Spotlight`, `Psycho Shift`, `Magic Powder`, `Forest's Curse`, `Trick-or-Treat`, `Venom Drench`,
      `Bide`, `Beat Up`, `Seismic Toss`, `Night Shade`, `Dragon Rage`, `Sonic Boom`, `Psywave`,
      `Super Fang`, `Endeavor`, `Pain Split`, `Present`, `Spit Up`, `Wring Out`, `Crush Grip`,
      `Electro Ball`, `Flail`, `Reversal`, `Gyro Ball`, `Hard Press`, `Heat Crash`, `Heavy Slam`,
      `Low Kick`, `Grass Knot`, `Fissure`, `Guillotine`, `Horn Drill`, `Sheer Cold`,
      `Nature's Madness`, `Ruination`, `Strength Sap` and their neighbours. The other **232** rows ride
      `data: basePower`, which is true for `Tackle` and false for `Body Press`, `Foul Play`, `Eruption`,
      `Water Spout`, `Stored Power` and the rest of `[Task-121]`'s family, whose note cannot say so.
      **Fix shape (subtasks, in order).**
      1. **The probe.** New `src/engine/battle/moveAudit.ts` exports
        `probeMove(moveId: string, setup?: Partial<MoveAuditSetup>): MoveProbe`. It builds a
        `createBattle` state (`new Rng(2026)`, `isWild: true`) from two `createFighter` dittos at
        level 50 (`ability: 'Run Away'`, no
        held item, the player's only slot is the probed move, the enemy's is `splash`), runs **one**
        `useMove(state, 'player', { type: 'fight', moveIndex: 0 })` (`turn.ts` 689-701) and snapshots
        `MoveProbe`: `playerHp`, `enemyHp`, both primary statuses, both boost vectors in `BOOST_IDS`
        order (`fighter.ts` 22), both sorted volatile key sets that are truthy, both
        `SIDE_CONDITION_IDS` and the `FIELD_CONDITION_IDS` vectors (`effects/conditions.ts` 15/25) and
        `events`, the `state.log`'s non-text `BattleEvent['kind']` list in order (`state.ts` 108-133).
        `MoveAuditSetup` is `{ level?, playerSpecies?, enemySpecies?, playerHp?, enemyHp?,
        playerBoosts?, playerStatus?, weather?, terrain?, heldItem? }`, every field optional, and its
        defaults are the clean state above (`ditto` on both sides, level 50, `ability: 'Run Away'`,
        full HP, no status, no boosts, no weather or terrain, nothing held) — the species fields exist
        because a type- or immunity-sensitive row must be able to say who it stands opposite.
      2. **The table.** `MOVE_AUDIT_ROWS: readonly MoveAuditRow[]`, each
        `{ moveId, expected: Partial<MoveProbe>, setup?: Partial<MoveAuditSetup>, knownGap?: true }`,
        recording the reference's delta per move id: the primary status, the stat stage, the volatile,
        the screen, the field, the heal, the protection, and for `[Task-121]`'s families the exact HP
        arithmetic. `knownGap` marks a row the engine does not satisfy **today**.
      3. **The test.** New `src/engine/battle/moveAudit.test.ts` runs **one `it` per row**
        (`expect(probeMove(row)).toMatchObject(row.expected)`; a `knownGap` row runs as `it.fails`, so
        a gap is **green and visible** and the task that fixes it must delete the flag), plus three
        gates: no row claims nothing (`expected` is never `{}`), **the rows equal the ledger** — every
        move `moveCoverage(id)` marks `port` with a note other than `data: basePower` has a row and no
        row names an `excluded`/`no-op` move — and the `data: basePower` verse is swept with one
        generated assertion per move that it deals at least one point of damage. The suite therefore
        owns all **835** and a new handler without a row fails.
      4. **The classifier.** `portedMoveNote` loses the `flags.protect` fallback and stops calling
        `move.damage`, `move.ohko`, `sideCondition`, `pseudoWeather` and `forceSwitch` ported unless a
        handler names them; `MOVE_VOLATILES` is read off `applyVolatileEffect`'s cases rather than
        hand-copied. Regenerate the pair — the row count moves from **0 `no-op`** to the honest total,
        and D16's develop-build warning finally fires on a move that goes off and does nothing.
      5. **The multi-turn families** (Leech Seed, Yawn, perish, Encore/Taunt decay, protection) are
        pinned through `scriptedBattle` (`harness.ts` 76-92) on seed **2026**, one row each, in the
        same file.
      **Acceptance.** `[unit]` `npx vitest run src/engine/battle/moveAudit.test.ts` is green and its
      row count equals the ledger's non-`data: basePower` `port` rows; `[unit]` `npm run docs:coverage`
      leaves a **clean** `git diff` after the commit (the table is current) and the regenerated header
      reports a **non-zero** move `no-op` count; `[unit]` `npx vitest run src/engine/battle/golden.test.ts`
      still matches its inline snapshot byte for byte; `[unit]` `npm test` and `npm run build` are green.
      **Docs:** `docs/balance/effect-coverage.md` + `src/data/moveCoverage.json` (regenerated),
      `docs/showdown-reuse.md` §3 (a `port` row names a handler or a field the turn loop reads, and the
      audit proves it), `docs/tech-decisions.md` **`D16` amended**, not extended: "complete" now also
      means every modelled move has an audit row, and a flag is not evidence. No new `D` number.
      **Out of scope:** any rule change (every handler is `[Task-120]`'s and `[Task-121]`'s); the 311
      abilities and the 290 items; the UI, the scenes and the log's text (`[Task-114]`); the
      `excluded` families the ledger already refuses (entry hazards, doubles-only, forced switching).
      *Dependencies:* none — `createBattle`/`useMove`/`harness.ts` and the coverage script all ship. It
      adds no run field and draws no RNG. *(Batch 47b)*
- [x] **[Task-120] The status half of the audit: the moves that write a status, a stage, a volatile, a
      screen, a field, a heal or a protection.** The **76-row** set `[Task-119]`'s ledger exposes is two
      halves; this is the status one, and its defects have one shape: **the machinery and the readers
      ship, and the move never writes them.**
      **Measured.** `applyVolatileEffect` (`turn.ts` 250-344) is a `switch` over 24 names and
      `default: return false` (329-330), so a move whose `volatileStatus` is outside that list changes
      nothing; `applyMoveEffects` (373-448) reads `status`, `volatileStatus`, `boosts`, `heal`,
      `wish` and `self.boosts` and nothing else — no `sideCondition` field, no ability or type write, no
      PP or item touch. The fields already exist and only an ability writes them: `volatiles.attract`
      (`fighter.ts` 82) is read by `beforeMoveVolatile` (`turn.ts` 834-837) and set only by Cute Charm;
      `volatiles.disabledMove`/`disableTurns` (`fighter.ts` 78-80) is read by `commands.ts` 74/100/251
      and set only by Cursed Body (`effects/abilities.ts` 1882-1891). So `Attract` and `Disable` print
      `X used Attract!` and nothing happens — the report's «parecen no hacer nada».
      **Fix shape.** One handler per move in `src/engine/battle/effects/moves.ts`'s `MOVE_EFFECTS`
      table (683-725), on the hooks and fields that already ship, plus the volatile cases each needs in
      `applyVolatileEffect` and the fields in `fighter.ts`; where the reference is a plain data write,
      extend what `applyMoveEffects` reads rather than adding a handler. The families and their rules,
      each re-derived from its Showdown handler at cut time: **infatuation and move-locking**
      (`Attract`, `Disable`, `Torment`, `Encore`'s shape, `Imprison`'s), **residual volatiles**
      (`Nightmare`, `Curse`'s shape, `Octolock`, `Aqua Ring`'s shape), **trapping and grounding**
      (`Spider Web`, `Telekinesis`, and `Smack Down`'s missing grounded write on its own damage row),
      **accuracy locks** (`Lock-On`, `Mind Reader`), **type and identity writes** (`Soak`,
      `Reflect Type`, `Magic Powder`, `Forest's
      Curse`, `Trick-or-Treat`, `Camouflage`'s shape), **ability writes** (`Simple Beam`, `Worry Seed`,
      `Gastro Acid`, `Entrainment`, `Skill Swap`, `Role Play`'s shape), **stat and speed exchanges**
      (`Heart Swap`, `Power Swap`, `Guard Swap`, `Speed Swap`, `Power Split`, `Guard Split`, `Psych
      Up`'s shape), **heals aimed at the foe** (`Heal Pulse`, `Floral Healing`, `Purify`, `Strength
      Sap`), **status transfer** (`Psycho Shift`), **turn and priority control** (`Instruct`,
      `Quash`, `Electrify`), **items** (`Trick`, `Switcheroo`, `Embargo`, `Recycle`'s shape), **move
      copies** (`Mimic`, `Sketch` stays excluded), **PP** (`Spite`), **screens and fields** already
      tabled (`SIDE_CONDITION_MOVES` 61-69, `FIELD_CONDITION_MOVES` 72-80 — verified, not re-opened)
      and **protection** (`PROTECT_MOVES` 45-54 and `protectEffect`, verified). A member a **single**
      battle cannot honour — `Spotlight`'s redirect, and any row whose Showdown handler only matters
      with an ally — is **not** implemented: it moves to `excluded` with its reason in the ledger
      (`scripts/effect-coverage.mjs` 243-248's own policy), because a dead handler is worse than an
      honest exclusion.
      **Acceptance.** `[unit]` every row of this family in `src/engine/battle/moveAudit.test.ts` loses
      its `knownGap` and stays green (`npx vitest run src/engine/battle/moveAudit.test.ts`), and the
      file's remaining `knownGap` count equals `[Task-121]`'s family alone; `[unit]` `npm run
      docs:coverage` then a clean `git diff` (each fixed move's row now names its handler);
      `[unit]` `npx vitest run src/engine/battle/effects/moves.test.ts` and `npm test` are green;
      `[unit]` `npx vitest run src/engine/battle/golden.test.ts` is byte-identical.
      `[live]` in a wild battle a `Disable` bars the named move's row (the `MOVES` window draws it
      disabled and `validateCommand` refuses it) and an `Attract` makes the infatuated side lose a
      turn — measured by the drawn row and by the log's `can't bring itself to attack` line.
      **Docs:** `docs/battle-spec.md` **§4** (the volatiles and the two-way writes: which move writes
      what the engine already reads), `docs/balance/effect-coverage.md` + `src/data/moveCoverage.json`
      (regenerated).
      **Out of scope:** the damage families (`[Task-121]`); `Sketch` and the doubles-only redirects,
      which stay `excluded`; entry hazards; any rebalance of a move's numbers; the log's text
      (`[Task-114]`); `src/ui/**`.
      *Dependencies:* `[Task-119]` (the audit rows and the honest ledger) and `[Task-101]` (the shape
      of `turn.ts`/`commands.ts`/`state.ts` it edits; Batch 46 merges first). It adds no run field.
      *(Batch 47c)*
- [x] **[Task-121] The relative-damage half of the audit: the number the formula multiplies.** The
      second half of the report — «daño relativo … no funcionan exactamente igual» — is one missing
      concept in the damage model: **every damaging move in the engine is `move.basePower` through
      `baseDamage`** (`damage.ts` 51-53, 134), and the branch that runs it is gated
      `activeMove.basePower > 0` (`turn.ts` 947), so a `basePower 0` move **never deals damage** and a
      power-relative move **deals its flat dex number**.
      **The families, named so nobody shrinks them.** **Fixed damage** (`Seismic Toss`, `Night Shade`
      = the user's level; `Dragon Rage` = 40; `Sonic Boom` = 20); **level-based with a roll**
      (`Psywave` = level × 0.5–1.5); **half the target's current HP** (`Super Fang`,
      `Nature's Madness`, `Ruination`); **OHKO** (`Fissure`, `Guillotine`, `Horn Drill`, `Sheer Cold`
      — `move.ohko`, an accuracy-independent success roll and a straight KO when it lands);
      **HP-difference** (`Endeavor`, `Pain Split`, `Final Gambit`); **the counter family**
      (`Counter`, `Mirror Coat`, `Metal Burst`, `Comeuppance` — **verify, do not assume**:
      `COUNTER_MOVES` `turn.ts` 623 and `useCounterMove` 629-668 already ship); **stockpile and
      body-relative power** (`Spit Up`, `Crush Grip`, `Wring Out`, `Present`, `Flail`, `Reversal`,
      `Electro Ball`, `Gyro Ball`, `Hard Press`, `Heat Crash`, `Heavy Slam`, `Low Kick`,
      `Grass Knot`); **Bide**'s accumulation and **Beat Up**'s party-based power; and **the
      power-relative verse that rides `data: basePower` today** — `Body Press` (reads `def`),
      `Foul Play` (reads the target's `atk`), `Eruption`, `Water Spout`,
      `Dragon Energy` (scale with the user's HP), `Stored Power`, `Power Trip`, `Rage Fist`,
      `Last Respects` (scale with a counter), `Hex`, `Venoshock`, `Facade`, `Brine`, `Bolt Beak`,
      `Fishious Rend` (scale with the target's state), `Payback`, `Avalanche`, `Revenge`,
      `Retaliate`, `Round`, `Echoed Voice`, `Expanding Force`, `Rising Voltage`, `Grassy Glide`,
      `Psyblade` (scale with the field or the last turn).
      **Fix shape.** Two pure resolvers in `src/engine/battle/damage.ts` —
      `resolveBasePower(attacker, defender, move, context): number` and
      `fixedDamage(attacker, defender, move, rng): number | null` — read by `computeDamage` **and**
      `estimateDamage` (164-188), so the AI, the FIGHT preview (`preview.ts` 52-64, today `power =
      0` for a fixed-damage move) and the battle never disagree; `turn.ts` 947 widens from
      `basePower > 0` to "the move resolves to a damaging one" and applies the fixed amount without
      the 85–100 roll, the crit, STAB or the type multiplier, while still honouring Endure,
      Substitute, `applyDamage` and the faint path. `move.ohko` and `move.damage` stop being read
      only by `randomLearnset.ts`. The weight the weight-based members read (`Low Kick`,
      `Grass Knot`, `Heavy Slam`, `Heat Crash`, `Hard Press`) is **already in the data** —
      `Species.weightkg` (`src/data/dex/species.ts` 38, written by `scripts/build-dex.mjs` 291) read
      through `getSpecies(speciesId)` — so the ledger's generic "weight is not modelled" line (its
      legend, 21) stops applying to them and needs one corrected sentence, not a dex regeneration.
      **The reference is Showdown's**, not a cartridge quirk (`D4`/`D16`): where the two differ the
      Showdown handler wins, and where Showdown itself needs a mechanic the engine lacks the row
      becomes `excluded` with that reason rather than invented.
      **The draws, in order.** `Psywave` one `rng.int`, `Present` one `rng.int` (and the reference's
      heal-or-damage split), an OHKO its accuracy roll plus its success roll; no other member draws.
      The golden battle (`golden.test.ts`) contains none of them and must stay byte-identical; the
      new rows are pinned per family with seed **2026**.
      **Acceptance.** `[unit]` every row of this family loses its `knownGap` and the file reports
      **zero** `knownGap` rows (`npx vitest run src/engine/battle/moveAudit.test.ts`), with the exact
      HP arithmetic in the row: `Seismic Toss` at level 50 removes 50, `Super Fang` removes half the
      target's current HP, `Endeavor` leaves both sides equal, an OHKO removes the target's whole HP
      and `Counter` mirrors twice the physical damage taken; `[unit]` `npx vitest run
      src/engine/battle/golden.test.ts` and `npm test` are green and `npm run build` is clean;
      `[unit]` `npx vitest run src/engine/battle/damage.test.ts` pins `resolveBasePower` for the
      verse's named members against hand-computed values; `[unit]` `npm run docs:coverage` then a
      clean `git diff` with **no** move row left `no-op`.
      **Docs:** `docs/battle-spec.md` **§3** (the damage families: which moves bypass the formula,
      which resolve their own power, and that a fixed amount takes no roll), the legend's "weight"
      line in `docs/balance/effect-coverage.md` (21) and the regenerated coverage pair.
      **Out of scope:** `src/engine/battle/randomLearnset.ts` — `FIXED_DAMAGE_IDS`,
      `FIXED_DAMAGE_MIN_LEVEL = 20` and the `move.ohko` skip **keep** excluding these moves from
      randomized learnsets, because widening those pools re-rolls every randomized learnset in the
      game and would re-pin the whole roster family; lifting them is a balance task of its own, not
      this defect. Also out: `forceSwitch` (`Circle Throw`, `Dragon Tail`, `Roar`, `Whirlwind`, the
      ledger's `excluded` line 249-251), entry hazards, the status half (`[Task-120]`), the log's text
      (`[Task-114]`) and any rebalance of a move's numbers.
      *Dependencies:* `[Task-119]` (the audit rows) and `[Task-120]` (it edits the same `turn.ts` and
      `effects/moves.ts`, so it must land in the next batch), plus `[Task-101]` (their shape). It adds
      no run field. *(Batch 47d)*


## Phase 5 — Battle UI & presentation

> Completed work for this phase is archived in `CHANGELOG.md`.

- [x] **[Task-39] The ⓘ detail button is dead in two places.** Reported in play, in one
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
- [x] **[Task-40] A battle opens with an entry beat: one for a wild encounter, one for a
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
      *Decision:* One camera flash and one fade plus the trainer's own entrance beat before the send-out, and no second full-screen blink; skippable by any confirm or cancel press, or a click.
      Evolution flash, which is a battle beat already and stays one.
      *Dependencies:* Task-08 (Accessibility pass) — the reduced-flash preference it adds to
      `src/engine/save.ts` and its settings row is what a black-flash opening must obey, and
      it claims every `src/scenes/*.ts` in Batch 8, the batch before this one. If that task
      shipped no such preference, say so in the report rather than inventing a second knob.
      Batch order covers the rest: both scenes are free here and nowhere earlier, and this
      task runs before Batch 10's i18n sweep so its lines can be keyed with the rest.
      *(Batch 9b)*
- [x] **[Task-59] Each of the battle SWITCH window's move rows gets the HUD's ⓘ, on hover and
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
      *Decision:* The move info button gets a zone of its own sized to the button, swallowing the press and pinning the popup; the ability one keeps its hover-only rule (one new sentence in `docs/design-spec.md` section 4).
      classifier (Batch 9) and reuses the content builder that batch leaves in
      `src/ui/moveGrid.ts`; it needs `src/scenes/BattleScene.ts` (Task-39's in 9, Task-40's in 9b,
      Task-26's in 10, Task-30's in 12), `src/ui/moveGrid.ts` (Task-55's in 18) and
      `docs/design-spec.md` §4 free at once, and the first batch after Batch 9 that leaves all
      three is **Batch 13** — whose Task-44 wants `src/scenes/RouteScene.ts`, the save and the
      party panel instead, so the two share no path and the batch stays an antichain. It adds no
      run field and changes no rule, so **no `SAVE_VERSION`** step. *(Batch 13)*
- [x] **[Task-60] A battle ⓘ opens a window with the battle's own state: the weather, the
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
      *Decision:* A fifth control reserved at the right edge of the command window, listing weather and terrain with their counts, every side and field condition with its count, each side's active stat stages and each active's non-volatile status. **Not** the volatiles, and none of the entry hazards the engine does not model.
      `this.state`; the two questions below are calls, not edges. Batch order covers it:
      `src/scenes/BattleScene.ts` is free in 13, 15, 16, 17 and 19 (Task-39's in 9, Task-40's in
      9b, Task-26's in 10, Task-30's in 12, Task-48's in 14), and it takes **Batch 17** because
      that is the first of them whose i18n key table is free as well (Task-49 holds it in 15 and
      Task-50 in 16) — Batch 13's free `BattleScene.ts` slot is `[Task-59]`'s. It is the batch's
      second member beside Task-52, which claims none of its paths, and it is written with
      `[Task-53]`'s row and `[Task-57]`'s row already inside the panels it draws over. It adds no
      run field, so **no `SAVE_VERSION`** step — the chain stays 14 → 15 (Task-13) → 16
      (Task-31) → 17 (Task-44) → 18 (Task-52). *(Batch 17)*
- [x] **[Task-77] The battle's HP panel loses its XP bar.** Reported in play: «quita la barra de
      xp del contenedor de combate» — the player's HP panel in a battle draws a **second, smaller
      bar** under the health bar that shows the squad's experience, and the human wants it gone.
      **Today that row is the player's panel's last band, and it is the only thing in it.**
      `drawSidePanel` (`src/scenes/BattleScene.ts`, 1665-1761) is the one builder for both sides
      (called from `refreshHud`, 1645-1646) and it ends with the player-only branch at
      **1747-1760**: `drawGauge(this.hud, barX, barY + 36, FRLG_HPBAR.width, 8,
      experienceFraction(this.xp, fighter.level), 0x60a5fa)` and
      `` this.xpText.setText(`XP ${this.xp}`).setPosition(barX, barY + 46).setVisible(true) ``, with
      the foe's branch only hiding the label. The row's place is `barY`'s: `nameY = rect.y +
      FRLG_WINDOW_PADDING.top`, `typesY = nameY + PANEL_NAME_H` and `barY = typesY + PANEL_TYPES_H +
      PANEL_NAME_GAP` (1676-1679), so the gauge sits 36 px under the HP bar's top (8 px tall, the
      full `FRLG_HPBAR.width` of 268) and the label 10 px under the gauge — i.e. the band from
      `barY + 36` to the panel's own foot, while the panel's content otherwise ends with the HP bar
      at `barY + FRLG_HPBAR.height` (28).
      **Everything the row reads is the scene's own, and nothing else reads it.** The value is
      `private xp = 0` (255-256, "The squad's shared XP, drawn on the player's panel as the general
      bar"), assigned once in `init` from `launch.xp` (448); the label is `private xpText!:
      Phaser.GameObjects.BitmapText` (313), built once in `buildScene` (589,
      `addFrlgText(this, 0, 0, '', { size: 16, tint: 0x3b82f6 })`) and written nowhere else; and
      `drawGauge` (`src/ui/panel.ts`, 23-38) has this call site as its **only** consumer in the
      tree. The **level is not in this row** — the name row writes `` `${fighter.name}
      Lv${fighter.level}` `` (1681) and does not move — and neither is any rule: `experienceFraction`
      (`src/engine/run/progression.ts`, 59) is also what the **route HUD** fills its own bar with
      (`RouteScene`, 2106-2107), so the engine helper and `D35`'s rule ("the squad shares one level
      and one XP bar", `docs/tech-decisions.md` 505-511) both stay as they are; the bar that rule
      means is the route HUD's, which this task does not touch.
      **Expected:** the player's HP panel draws the name and level, the types row, the HP bar and
      the status badge and **nothing under the HP bar** — no gauge, no `XP n` label — in a wild
      battle and a trainer battle alike, on the wide desktop layout and the compact phone one. No
      other panel, window, menu or sprite moves, and nothing is lost: the level stays on the panel
      and the squad's XP stays on the route HUD's own bar.
      **Fix shape:** delete the row and everything that exists only for it. `drawSidePanel`'s player
      branch goes, and the foe branch's `setVisible(false)` goes with it because the object it hides
      no longer exists; the `xp` field and its `init` assignment go; the `xpText` field and its
      `buildScene` creation go; and the now-unused `experienceFraction` (imported at 28) and
      `drawGauge` (imported at 44) imports go with them. The one number the report does not settle is
      the panel's own height: `PLAYER_PANEL_H = 184` (88, "Tall enough for the padded name row, the
      types band, the bar and the XP row") against `FOE_PANEL.h = 150` (89), which is the same
      content without that band (the foe's content also ends at `barY + 28`, leaving the same 4 px of
      slack). The written reading is that the player's panel takes **150**, so the frame hugs its
      content instead of holding a ~38 px empty band; it moves no sprite and no clearance — on the
      desktop the rect's **bottom** stays where it is (`y = box.y - 24 - PLAYER_PANEL_H`, 1597, so
      the top drops by 34 px) and on the compact layout the rect's `y` is `Math.round(height * 0.46)`
      (1576) and does not read the height, so `FOE_PLATFORM_CLEAR` and the battlers' caps are
      untouched. The alternative — keep 184 and leave the band empty — is the open question below.
      `BattleLaunch.xp` (`src/engine/run/battleLink.ts`, set by `RouteScene` at 5173) **stays**: it
      is the launch's own field and dropping it would take two files the report does not name.
      **Docs:** `docs/design-spec.md` §4's bullet at 171-174 ("The **whole squad — party and PC —
      shares one level and one XP bar**: XP fills a single bar …") sits in the battle's own section,
      so it gains the clause that says **where** that one bar is drawn — the route HUD — with
      `D35`'s rule and the level-cap sentence unchanged; the panel's own contents are not described
      there today (the `Task-57` precedent), so this is a clarification rather than a rule change.
      The alternative — leave the file untouched, because the sentence states a rule and the battle
      panel's bar was never documented — is named and is **not** the default, and it costs no re-cut
      either way. `docs/battle-spec.md` §7 (108-110) states the same rule and **does not move**: it
      never says the battle draws the bar.
      **Tests:** none in the pure half — this is a scene's drawing, with no engine rule, no RNG draw
      and no run field (so no fixed-seed regression and **no `SAVE_VERSION`** step) — and the check
      is the browser one, the `Task-57` precedent: in `npm run dev` a battle's player panel shows no
      gauge and no `XP` line under the HP bar on the desktop layout and on a 640-px-tall phone, the
      route HUD's own XP bar still fills as the squad gains XP, and the compact layout still clears
      the foe's platform by the same margin it did before.
      Out of scope: the route HUD's XP bar and its `XP n` text (`RouteScene`, 2106-2107 and
      1542-1549 — the run's one bar, `D35`), `experienceFraction` and every XP/level rule,
      `BattleLaunch.xp`, the battle's outcome lines and its XP award, the party rows and the SWITCH
      window, `PLAYER_PANEL_W`, `FOE_PANEL`, the panel chrome and its paddings (`FRLG_WINDOW_PADDING`,
      Task-16's), the type badge row (`Task-53` / `Task-72`) and `Task-57`'s ball row, and
      `src/ui/panel.ts`'s helpers — `drawGauge` is **left in place**, because its sibling
      `drawPanel` already has no call site in the tree, so the module is the shared chrome-helper
      file and a dead-code sweep of it is not this task; the alternative, deleting `drawGauge` and
      `GAUGE_TRACK` with the `src/ui/README.md` role line (15) that names the gauge, is named and is
      free in this batch too, so it costs no re-cut.
      *Dependencies:* none — every symbol it removes is the scene's own and every rule it leaves
      *Decision:* The player's HP panel shrinks to **150**, hugging its content as the foe's panel does; no clearance invariant moves.
      behind is shipped. Batch order covers it: it wants `src/scenes/BattleScene.ts`, and Batch 6b is
      `cut` (so it can gain no member) while every batch from 7 to 14 holds that file (7 Task-18, 8
      Task-08's every-scene sweep, 8b Task-35, 9 Task-39, 9b Task-40, 10 Task-26's every-scene sweep,
      11 Task-29's ledger, 12 Task-30, 13 Task-59, 14 Task-48) — so **Batch 15** is the first batch
      that leaves it free, and its Task-49 claims the route scene, `src/ui/notice.ts`,
      `docs/routes-spec.md` §2 and the i18n files instead, so the two share no path. It is
      presentation only: no run field, no rule and no RNG, so **no `SAVE_VERSION`** step — the chain
      stays **14 → 15** (Task-13, shipped) → **15 → 16** (Task-31, Batch 7) → **16 → 17** (Task-44,
      Batch 13) → **17 → 18** (Task-52, Batch 17). *(Batch 15)*

## Phase 6 — Run structure, party & economy

> Completed work for this phase is archived in `CHANGELOG.md`.

      covers three facts: Task-13 (Batch 4) takes the next `SAVE_VERSION` (15) first, so
      this migration is the step after it (15 → 16 as the plan stands); Task-33 (Batch 3b)
      lands even earlier and mints the unique member id at the fold this task keeps, so
      `pcCatch.memberId` and the `[Task-27]` replay below both build on it; and it
      **supersedes the capture-screen half of Task-12** (Batch 3): the ability ⓘ
      Task-12 adds to the route HUD's detail panel and to the battle's SWITCH window
      stays, while the one it adds to the capture screen is deleted here with the
      modal it lives on, so this task's diff removes a Batch-3 feature on purpose.
      *(Batch 7)*
- [x] **[Task-44] The PC box gains a fixed RIP tab, listing the dead.** Reported in play:
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
- [x] **[Task-49] Obtaining an item raises a temporary popup.** Reported in play:
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
      *Decision:* Only the two otherwise-silent paths (the ground item and the mini-boss reward). The Mart keeps its own line and the string names the item only.
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

- [x] **[Task-50] A level-up raises a temporary popup.** Reported in play: «popup temporal
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
      *Decision:* Both: the notice fires on **every** level-up beat, so a level that crosses nothing is no longer silent, and the key-dismissed `LEVEL UP` modal stays for the move names.
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
- [x] **[Task-87] A consumable is spent on a party member from the route HUD, and only when it actually
      does something.** The human's rule: «objetos consumibles se deben poder gastar en menu de rutas
      sobre un poke si es que hace efecto por ejemplo una pocion sobre alguien con toda la vida no o uno
      que quita estado quemado si no esta quemado no». Two things are missing today, and one is a small
      defect:
      - **A non-held item dropped on a member is equipped as if it were held.** The drag's drop calls
        `equipHudItem` (`src/scenes/RouteScene.ts` 4306) → `equipHeldItem` (`src/engine/run/state.ts`
        598), and neither reads the item's `kind`, so a **Potion dropped on a member becomes that
        member's held item**. The battle is the only place a consumable can be spent (`useBagItem`,
        `src/engine/battle/commands.ts` 139-192, the `heal` / `status` / `boost` branches), and the route
        HUD has no use path at all.
      - **No effect gate exists** anywhere for a route use.
      **Fix shape.** A `held` item keeps equipping; a `heal` / `status` item **uses** on the member
      instead, and the use is a no-op unless it would change something. The gate is one pure predicate
      beside the run state (e.g. `itemAppliesTo(member, item)` in a new `src/engine/run/items.ts`),
      reusing the battle's own semantics: `heal` applies when HP is below max (`healAmount` /
      `healFraction`) **or** a curable status is present (`cures`), and `status` applies only when the
      member carries one the item cures. The **target is the party or the PC box** (the heal stop already
      reaches both). `useItemOn(run, memberId, itemId)` is the predicate plus `consumeItem` (`state.ts`
      573) plus the member's HP or status written back, and the scene routes the drop / confirm through it
      (`RouteScene` 3807-3819, `confirmMemberStop` 1711-1721), raising the shipped notice so the player
      sees what happened.
      **The X-items go with it.** The human's answer is «eliminar x items», so the three `kind: 'boost'`
      consumables — **X Attack, X Defense, X Speed** (`src/data/items.ts` 1113-1136) — are deleted from
      the game: out of the catalogue, the four loot rows (`src/data/loot.ts` 70/115/166/210), the icon map
      (`src/data/frlg/item-icons.json` 54-56), the `'boost'` member of `ItemKind` (`items.ts` 5) with the
      `case 'boost'` branches (`src/engine/battle/commands.ts` 180-187, `src/ui/bag.ts` 48) and the
      `items.test.ts` / `bag.test.ts` / `shop.test.ts` rows. The **battle's `boost` event**
      (`src/engine/battle/state.ts` 82) is a different thing — the pinch berries and the stat-raising
      moves keep using it, so the `ItemDef.boosts` field stays for them.
      **Docs:** the route HUD and bag in `docs/design-spec.md`, the healing stops and Pokevial in
      `docs/routes-spec.md` §6, the item catalogue in `docs/data-spec.md`, and the X-items' line in
      `docs/battle-spec.md`.
      *Dependencies:* none. No `SAVE_VERSION` step — the bag, the members and their statuses already
      persist. It opens **Batch 30** with `[Task-81]`: it claims `src/scenes/RouteScene.ts`,
      `src/data/items.ts` and the generated `src/data/frlg/item-icons.json`, none of which the
      room-size table 81 writes touches. *(Batch 30)*
- [x] **[Task-89] The Mart and the mini-boss reward become floating panels, and taking an item is a drag
      onto the bag or a member.** The human's rule: «pasar mart y recompensa a panel flotante como los
      existentes, recompensa al arrastrarlo a mochila o poke si es objeto equipable desaparece objeto de
      suelo y panel, mart al soltar sobre mochila o poke restar monedas si no tiene monedas no puede
      arrastrar».
      **Today** both are **modals**: the Mart (`RouteScene`'s shop counter) and the reward
      (`openMiniBossReward`, ~6584) take the keyboard off whatever pane held it and answer to
      `handleShopAction` / `handleMiniBossRewardAction` (arrows plus `confirm`). The shop panel exists only
      while the run stands in the shop room (`docs/maps-spec.md` §7). The HUD's own panels
      (party/bag/box/detail) already drag, and a bag stack is dropped onto a member by
      `handleHudPointerUp` → `equipHudItem` / `useItemOn` (`RouteScene` 3807-3819; `[Task-87]` is the
      consumable half).
      **Fix shape.** Both surfaces become **floating panels** built on the shipped chrome, moved by their
      header like any other (`HudLayout`) and **pointer-first**: their rows drag onto the bag panel or a
      member. A **reward** row taken this way **disappears** — the reward's own ground object and the panel
      go — and when the item is **equipable** it lands on the member it was dropped on. A **shop** row
      dragged onto the bag or a member **buys**: one unit leaves the shop and `spendMoney` runs; a row the
      run **cannot afford** is **not draggable** (no hand cursor, no ghost), so the drag itself is the
      price gate. The two surfaces' keyboard paths go, per `[Task-84]`'s rule that only the pause menu
      keeps keys in the route scene.
      **Docs:** the shop panel and the economy in `docs/maps-spec.md` §7, the route HUD's panels in
      `docs/design-spec.md` §3, and the mini-boss reward's row in `docs/maps-spec.md` §7.
      **The reward's Pokémon rows take the same drag** (the human's answer): if `[Task-63]` lands first,
      its three unidentifiable rows drag onto the party exactly like the item rows, and taking one removes
      its ground object and the panel just the same.
      *Dependencies:* `[Task-87]` — the drag's drop target is the `useItemOn` the consumable half
      ships, so a reward or shop row dropped on a member lands the same way — and `[Task-63]`, whose
      three unidentifiable Pokémon rows are the second row kind this drag must take (the reason the
      entry's own "if `[Task-63]` lands first" is true: Batch 23). It is written against
      `[Task-84]`'s pointer-first rule (Batch 29) and takes **Batch 31** as its first member, with
      `[Task-104]` (the damage-model abilities) beside it — that task claims no scene, no
      `src/ui/**` and no shop path. *(Batch 31)*

## Phase 7 — Persistence, meta & polish

> Completed work for this phase is archived in `CHANGELOG.md`.

- [x] **[Task-08]** Accessibility pass: colour-only information audited, HP bars
      readable without colour, full keyboard play, reduced-flash option. It absorbs the
      stale comment Task-15 parked: `src/scenes/StarterScene.ts` (~line 287) still
      claims the sheet has no Fairy badge, and the dead Fairy-fallback path in that
      method goes with it — this sweep owns every `src/scenes/*.ts`, so one line of
      dead code is not worth its own ID.
      *Dependencies:* none. Scheduled after Task-16 (Modernise the panel and menu
      chrome) so the contrast and colour audit runs once, against the final art.
      *(Batch 8)*
      it reads no file another open task produces. Batch order covers the doc: this is the
      first batch in which `src/scenes/MainMenuScene.ts` (nobody's until Batch 8's
      every-scene sweep) and `docs/design-spec.md` §2 (held by a batch-mate in every batch
      from 5 to 6b) are free together, so it lands in **Batch 7**; it is also three batches
      before Batch 10's i18n sweep, which therefore keys its string with the rest.
      *(Batch 7)*
- [x] **[Task-84] The movement keys never browse a HUD pane.** Reported in play: «al abrir panel
      pokemons las teclas de moverse mueven en el panel de party no quiero eso que siga solo sirviendo
      para mover personaje». This is the shipped keyboard-play rule of `docs/design-spec.md` §10.3 —
      "the arrows browse the focused pane instead of walking — the walk stays settled while a pane
      holds the keyboard" — landed by the accessibility pass (`[Task-08]`), and the human wants it
      **inverted for movement**: the arrows keep moving the character and never move a cursor inside
      the party panel.
      **Where it lives.** `RouteScene.toggleHudPanel` hands a pane the keyboard on a quick-key open
      (`focusHudPane`, 1590) and a second press takes it back (`1573-1581`); `handleHudKeyboard`
      (`1633`) routes `up`/`down`/`left`/`right` into the pane (`handleMemberKeyboard`, `1653`); and
      `update()` (`7237-7238`) settles the walker while `hudKeyboardPane !== null`, which is *why* the
      arrows stop walking the moment a panel is opened. The pointer path is already the wanted one:
      clicking a panel's icon is a plain toggle with no focus (`1569-1571`).
      **Fix shape (frozen).** Opening a HUD panel **never grabs the keyboard**: the quick key
      opens/collapses the panel and the arrows keep reaching the walker, so `focusHudPane` stops being
      called by `toggleHudPanel` (and `update()`'s gate stops reading `hudKeyboardPane`); the keyboard
      reach into the panes' content — party rows, reorder, Pokevial header, box, bag, detail tabs, move
      slots, learnset band — goes **pointer-first**. Across the route scene the **only** keyboard surface
      left is the **pause menu** (the human's «solo teclas para pausa»: `cancel` opens it, the arrows and
      `confirm` drive it). The Mart and the mini-boss reward follow this task's sibling `[Task-89]`, which
      turns them into floating panels; until then they are the two remaining keyboard-driven route
      surfaces and this task leaves them as they are.
      **Docs to move with it:** `docs/design-spec.md` §10.3's rule sentence and its table rows marked
      `keyboard (new)` for the route HUD panes, and the keyboard paragraph of the accessibility
      decision (`docs/tech-decisions.md`, referenced as `D45` in the scene).
      Out of scope: the battle's own keyboard paths (a different scene), the keybind vocabulary, the
      `P`/`I`/`M`/`O` quick keys themselves (which still open a panel) and the pause menu's own keys.
      *Dependencies:* none. Wants `src/scenes/RouteScene.ts`, the plan's most contended path, so it
      opens **Batch 29**; its planned mate `[Task-90]` was filled into Batch 26, so Batch 29 is
      re-filled when it is cut. *(Batch 29)*

## Phase 8 — Biomes & art assets

> The FRLG art pass (route interiors, ground vs path, exit art, ledge and route
> props, beach, animated portraits, FRLG move/attack FX replacing the PMD art,
> per-biome battle backgrounds) and the release chores are out of the backlog; what
> shipped stays in `CHANGELOG.md`.

**One biome exists: `forest`.** `BIOME_ORDER`, `BIOMES` and the tileset registry
each hold exactly one entry, so the run cycles the forest and nothing else ships a
field it cannot reach. The procedural sheet is not a biome: it survives as the
tests' fixture.

- [x] **[Task-14] One biome ships: the never-wired entries are pruned.** The human's
      decision was the inverse of the item's original text — **solo existe el bosque**,
      no new biome joins the cycle. So the four entries nothing could reach are gone
      (`D10`): `BIOMES` is `{ forest }`, `BiomeId` is the singleton `'forest'`,
      `BIOME_ORDER` stays `['forest']`, `TILESET_IDS`/`TILESET_NAMES`/`TILESETS` hold
      the forest field alone, and `wood`/`outdoor`/`cave` lost their registry rows,
      palettes and `src/data/tilesets/wood.ts`. `PLACEHOLDER_TILESET` stays as a
      **test-only fixture** (out of the registry, so `BootScene` no longer loads the
      procedural sheet), `FRLG_TILESET` stays as the shared field layout
      `FRLG_FOREST_TILESET` specialises, and `RouteScene`'s pre-route `tilesetId`
      default became the forest it preloads. Adding a biome later still follows the
      `D10` recipe against the now-single-entry registry, and owes the fixed-seed
      regression the original text asked for.
      *Dependencies:* none. *(Batch 8)*
- [x] **[Task-30] A hit plays the move's sound, and an encounter the Pokémon's
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
      *Decision:* Raw `cries/<species>.wav` samples plus one `SE_M_*` per move, one cue id per species/move (D22 addendum) and one hit cue: no `PokemonCrySong` replay, no effectiveness variants. **The Anil checkout carries no audio tree**, so the set is rendered from FRLG's `sound/` for now; the cue table makes the source swappable later without touching a call site.
      every move and species its own cue id or add one parameterised call that
      resolves a generated table — pick one and say why. Wire the hit into
      `BattleScene`'s damage event and the cry into `RouteScene.startBattle` (and the
      battle's send-out), keep `cues.test.ts`'s placeholder guard over whatever ships,
      and note that the original also varies a hit by effectiveness
      (`Cmd_effectivenesssound`: `SE_EFFECTIVE`, `SE_SUPER_EFFECTIVE`,
      `SE_NOT_EFFECTIVE`) if that is wanted too.
      *Dependencies:* none. *(Batch 12)*
- [x] **[Task-58] Every panel becomes a dark glass card (the `t-glass` direction).** Reported in
      play, while Batch 5 was in flight: «los paneles que sean estilo visual como el de debug» —
      the dev overlay is where the report points, and the look it seeded has now been rendered and
      chosen: the game's windows become one **dark, translucent** `#10161f` surface behind a
      **1px hairline** frame, one **light** ink, one muted secondary tone and one accent reserved
      for **controls and selection**, instead of the drawn set's light windows and deep-black
      text.
      **This is a follow-up to `[Task-16]`, and the edge is real.** The chrome it re-tunes is the
      set Task-16 is drawing in the batch in flight — `scripts/ui/build-chrome.mjs`, the generated
      `src/data/ui/chrome.json` and `src/data/ui/font.json`, the three `src/assets/ui/*.png`,
      `src/ui/frlg.ts` and `src/ui/frlgFont.ts` — none of which exists on `main` today, so this
      task cannot be written before that one ships; Batch 5 is **cut** (its four specs are written
      and its four branches are cut), so the contradicting report is registered here as the
      follow-up rather than folded into it, and this task's own spec is written when its batch is
      cut, by which time Task-16 has merged. The values it **starts from** are the ones Task-16
      ships (verified in its worktree today); the values it **ships** are the glass tokens below.
      **The direction is decided, and the debug panel is only its seed.** The report's "estilo
      visual como el de debug" was rendered before it was chosen: the untracked
      `chrome-options.html` in the repo root draws the candidates on the same mock panels, and
      the human picked its fourth card, **`t-glass` ("Glass oscuro")**, over (1) what Task-16
      ships today, (2) the full debug-panel match, (3) the frame-only variant and (5) the slate
      flat variant. This entry freezes that card's tokens; the spec is written against the
      rendering, so whoever cuts Batch 20 opens `chrome-options.html` beside it.
      **The frozen values, taken from the `t-glass` card (162-175).**
      - **Surface:** `#10161f` — the tone `docs/art-direction.md` line 14 already declares — at
        **alpha 0.72**, far more translucent than Task-16's light `#f8f8f8` windows (0.88) or
        its battle box (0.94).
      - **Frame:** a **1px hairline** `rgba(255,255,255,0.16)` at the panel's own edge — *not*
        the debug panel's 2px `#7dd3fc` accent — with an inset top highlight
        `rgba(255,255,255,0.14)` and a soft drop shadow under the card.
      - **Corner:** **11px** at runtime.
      - **Accent `#7dd3fc`, used sparingly:** only where something is selected or is a control —
        a selected move slot, the Mega control, the command cell under the cursor, the HP chip —
        and **never** as the border.
      - **Ink:** `#f8fafc` body, `#94a3b8` secondary; a selected cell is
        `rgba(125,211,252,0.16)` with an accent outline; ordinary rows are
        `rgba(255,255,255,0.06)` with a `1px rgba(255,255,255,0.10)` border; the HP and XP
        tracks are `rgba(255,255,255,0.12)` and the HP fill keeps its green gradient.
      - The card's **typeface** is not a token: it is HTML, its `ui-monospace` is a DOM font,
        and this task keeps the bitmap face (see *what stays*).
      **What Task-16 ships that this replaces, so the diff is concrete.** The drawn set goes the
      other way on every one of those tokens: `scripts/ui/build-chrome.mjs` draws
      `BEZEL = 0x0b0b10`, `KEYLINE = 0x3a3d52`, `FIELD_DARK = 0x11121a`, `HIGHLIGHT = 0xffffff`
      and `FRAME_SHADOW = 0x000000` (23-27) with the **light** window keeping the FRLG sheet's own
      dominant opaque colour (`dominantColour`, 59-77 — `#f8f8f8`), the nine-slice corners and
      alphas frozen in `src/data/ui/chrome.json` (window corner 20 / alpha 0.88, textbox corner
      24 / alpha 0.94) and the ink `FRLG_INK = 0x0b0b10` (`src/ui/frlgFont.ts`, 96) inking every
      string in the game. Task-16's own §4 sentence says it in words (`docs/design-spec.md`,
      worktree 203-207: the dark textbox, "the light **window** behind the HP panels … and the
      light windows ink their text with the deep-black `FRLG_INK`"). Four tokens move, and each
      is one place: the **surface**, the **frame**, the **corner** and the **text**.
      **The caveat this note exists for: the card's blur does not ship.** The card reads
      `background: rgba(11,18,32,.72); backdrop-filter: blur(9px) saturate(1.15)` (162-163), and
      **Phaser has no `backdrop-filter`**: a real blur behind a panel needs a render pipeline or
      a render-texture pass, and the panels are repainted every feed frame (`refreshHud`,
      1583-1585), which is exactly the hot path AGENTS.md forbids allocating in. The frozen
      default is **no real blur**: the glass reads from the **0.72 alpha** plus the **1px
      hairline** and the **inline top highlight**, with **no** per-panel blur pass, no new
      dependency and no post-FX pipeline. The rejected alternative is named and parked — a
      WebGL blur / render-texture pipeline is **out of scope for this task**, and if it is ever
      wanted it is a task of its own. One surface gets a written second value instead of a
      question: the battle **message box** is the one panel whose text sits over the busiest
      background, so if the same 0.72 reads badly there the task may hold **that one** skin at
      **0.80** — a data value in `chrome.json`, frozen by the spec and reported with the
      contrast check.
      **The corner is the one number to get right.** The card draws 11px, and the **packed
      corner is the runtime radius in this set**: `addFrlgWindow` hands `chrome.window.corner`
      straight to `setSlices` (`src/ui/frlg.ts`, 63-83) and the atlas is drawn 1:1, so the
      shipped 20 / 24 *are* 20px / 24px on screen and the manifest's `size: 4` is the packer's
      authoring note, which no runtime code reads. The packer must therefore draw **corner 11**
      for both skins (not 44), and the frame's own band moves with the shape: `frameBand` is
      `min(padding, corner)` (`build-chrome.mjs`, 101-107), so a 1px hairline at the panel's edge
      replaces the inset `KEYLINE_WIDTH = 2` keyline (121-133) and the window's *drawn* band
      clamps from 20 to 11 while the **content insets stay frozen** (`FRLG_WINDOW_PADDING`
      20/16/8, `FRLG_TEXTBOX_PADDING` 36/28/28) — the spec verifies the content still clears the
      ring on both skins and both layouts. Recorded so nobody mis-reads the direction: 11px is
      rounder than the card's own "today" preview (7px) but **less** round than what actually
      ships (20 / 24), and that is the card's look rather than an oversight.
      **Frozen from the panel mock (`panel-mock.html` and `sprite-sources/panel-mock.png`, drawn
      against the tokens above).** Five rules the sweep must keep:
      - the **transient notice strip** stops being a second look: it draws the **card** skin like every
        other panel (the `'textbox'` nine-slice the route floats today, `RouteScene.buildNotice`
        5889-5915, no longer has a route surface of its own — the battle's **message box** keeps the
        textbox skin, at the 0.80 value above if the contrast check asks for it);
      - the moves window's **MEGA and G-MAX controls lose their words** and become **icon-only** in that
        window's header, both drawn with the **Mega Evolution glyph** (a frame from a shipped atlas; if a
        distinct G-Max glyph ever ships, the second control takes it — the human's words are that both
        show the Mega icon). Today they are `MEGA` / `G-MAX +` `BitmapText` labels
        (`BattleScene.layoutMegaControl` / `layoutGmaxControl`, ~2854-2895);
      - the **type badges are full colour with dark ink**, never translucent;
      - the **selected row or cell** is the accent fill **plus** a 1px accent outline (both, not either);
      - the **area-entry panel** (`[Task-109]`) is the one card whose border is the **accent**.
      Everything else the mock shows (PARTY, BAG, DETAIL, the STATS/MOVES grid, the command grid, the
      switch rows, the HP bars) already reads the tokens above, which is why the mock is a check rather
      than a second source of truth.
      **Fix shape:** one re-tuned chrome set, one ink flip and one sweep of the containers. The
      packer's palette constants and `chrome.json` carry the new tokens (Task-16's own rule: a
      chrome value lives in `src/data/ui/chrome.json` through the packer, and **no scene
      re-derives one**), `src/ui/frlg.ts` exports whatever new token a scene needs (the accent,
      the muted tone and the hairline join `FRLG_WINDOW_PADDING` / `FRLG_WINDOW_ALPHA`),
      `FRLG_INK` becomes the light body ink so every existing `tint: FRLG_INK` draw site flips
      with one constant, and the containers whose fills were light move with it: an ordinary row
      or cell is `rgba(255,255,255,0.06)` over a `1px rgba(255,255,255,0.10)` border, the
      selected or primary one is the accent's `rgba(125,211,252,0.16)` with an accent outline,
      and the HP/XP tracks become `rgba(255,255,255,0.12)` with the HP fill's green gradient kept
      (`MoveGrid`'s cells, badges and info buttons, `src/ui/moveGrid.ts` 128-161;
      `AbilityInfoButton`, `src/ui/abilityInfo.ts` 51-52; the battle's command cells and bag
      tabs, `BattleScene` 481 and 600-604, 1704-1717; the HUD's rows and cells, `RouteScene`
      1525-1570 and 2618; the starter cards, `StarterScene` 253-277). Two things the task must
      freeze as data, because `FRLG_INK` cannot carry them: the sites that pair **two** tones —
      the four tab pairs in the route HUD (`RouteScene` 2131, 2161, 2364, 5599,
      `active ? 0xf8fafc : FRLG_INK`) and the battle's own (`BattleScene` 2104) — whose
      "selected" tone becomes the accent's fill plus outline rather than white, and the ad-hoc
      greys the scenes pass today (`0x6b6887`, `0x3a3956`, `0x94a3b8`), which collapse into the
      one exported muted tone `#94a3b8`. The **content insets do not move** —
      `FRLG_WINDOW_PADDING`, `FRLG_TEXTBOX_PADDING`, every panel rect and every layout stay
      exactly where they are, which is the whole reason Task-16 kept them.
      **What stays:** the nine-slice geometry and the frozen content insets, the glyph **shapes**
      and the bitmap face (the card's `ui-monospace` is a DOM font: adopting a typeface is a
      separate job, and Task-16's spec already rules it out of scope — this task keeps the face
      and moves only its tone and its halo), the HP bar and its green, the ▶ cursor, the type /
      status / category / item icons and their atlases, and every panel's layout. The one thing
      the task owes beyond the tones is the check the new pairing needs: it introduces the
      light-on-dark pairs itself (a selected cell against an unselected one, the HP track's white
      on the glass field, a dimmed ball or a faint status badge, the 0.72 surface against the
      route behind it), so it carries its own contrast pass — Batch 8's accessibility audit ran
      against Task-16's chrome and is not re-run (the open question below, which is the only one
      of the eighth round's two that survives).
      Files: `scripts/ui/build-chrome.mjs`, the generated `src/assets/ui/{window,textbox,font}.png`
      and `src/data/ui/{chrome,font}.json`, `src/ui/frlg.ts`, `src/ui/frlgFont.ts` +
      `frlgFont.test.ts`, `src/ui/README.md` and `src/assets/README.md`, every `src/scenes/*.ts`
      with a drawn string or fill (`BootScene` only if its loader derives a colour; the drawn
      texture keys do not move), every `src/ui/**` module that fills a container or inks text, and
      the two docs that describe the chrome — `docs/art-direction.md`'s §Palette paragraph and
      `docs/design-spec.md` §3's panel sentence **and §4's window list**, all three of which are
      **rewritten to describe the glass tones** (the dark surface, the hairline, the accent used
      only for selection, the light ink) instead of the deep-black-on-light-field set they state
      today. Tests: the packer's own determinism check (two
      runs byte-identical, as Task-16 lays it down), `src/ui/frlgFont.test.ts` for the ink and the
      manifest, and a contrast check over the new pairs — the pixel art itself is still validated
      by the smoke pass rather than by a Phaser unit test, the Task-16 precedent.
      Out of scope: the debug overlay itself (`src/dev/**` is dev-only and stays as it is — it is
      the seed of the look, not a consumer), **a real background blur** (a WebGL blur or a
      render-texture pass per panel), a different typeface or a webfont, any layout re-cut, the
      FRLG originals under `src/assets/frlg/**` and their packers, `src/engine/**` (no rule moves),
      *Decision:* Task-08 is **not** re-run: this task carries its own contrast pass over the pairs it introduces.
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

- [x] **[Task-85] A hidden item is a floor tile of its biome, not a floating sparkle.** Reported in
      play: the hidden item's faint sparkle should instead be a **concrete floor tile**, one per
      biome, so the tell is a patch of ground rather than a glint. For the **forest**, the human has
      picked **frame 41** (source cell `5,34`) from the preview
      `sprite-sources/forest-floor-tiles.png` (gitignored), which shows the five frames the forest
      floor draws — `0` (base, weight 8), `1` (weight 5), `2` (weight 4), `41` (weight 3) and `42`
      (the flowered ground, weight 1) — from `FOREST_FLOOR_VARIANTS` (`src/data/tilesets/frlg.ts`
      109-115).
      **Where it lives today.** A hidden item draws the procedural sparkle (`SPARKLE_TEXTURE_KEY`,
      built in `BootScene` 267-277) at a fixed `0.55` alpha with a slow shimmer over it, and never
      blocks its tile (`RouteScene.drawItems`, 5090-5123); the reduce-flashing preference stops the
      shimmer (the accessibility pass's one knob).
      **Fix shape.** `TilesetConfig` (`src/engine/tileset.ts` 172-220) gains a **`hiddenItemFrame`**
      per biome, resolved like `frames`; `drawItems` draws that frame on the item's tile instead of
      the sparkle sprite (still non-blocking, still under the player), and **frame 41 is removed from
      `FOREST_FLOOR_VARIANTS`** so it never occurs naturally — the remaining mix is `8/5/4/1` over
      frames `0/1/2/42`. If nothing else reads `SPARKLE_TEXTURE_KEY`, its texture builder goes with it,
      and the reduced-flash knob loses this surface.
      **Docs:** `docs/tileset-spec.md` §6 (the frame table), `docs/routes-spec.md` §2 step 4/§6 (a
      hidden item is a floor frame, not a glint) and the reduced-flash bullet in the accessibility
      section (`docs/tech-decisions.md` `D45`, `docs/design-spec.md` §10).
      Out of scope: the item's visibility/blocking rules, the loot roll (`hiddenChance`) and the Poke
      Ball sprite a visible item draws.
      *Dependencies:* none. Wants `src/scenes/RouteScene.ts` and a one-time edit of
      `FOREST_FLOOR_VARIANTS`. The frame is **41** — the human's pick from the preview above. It
      opens **Batch 32**, which is now `[Task-85]` alone: `[Task-106]` (the room-effect table's
      second half) was filled into Batch 28 and shipped there, and it claimed no scene, no tileset
      and no `BootScene`. *(Batch 32)*

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
- [x] **[Task-20] The Rotom appliances as evolutions.** Rotom's five appliance
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
- [x] **[Task-21] The Megas as information in the STATS graph.** The family graph
      draws evolutions only (`evolutionGraph`, `src/ui/evolutionGraph.ts`), and a
      Mega is not one: it is battle-only (`D34`, `src/engine/battle/mega.ts`) and
      entered from a stone. So a member whose species has a Mega shows no trace of
      it in the STATS tab. Add the Mega as an **information row** hanging off its
      base species:
      the forme's sprite and name plus "Mega Evolves while holding <stone>", drawn at
      the same indent as an evolution — and **never clickable**, with no pointer
      cursor and no `ready` node, because nothing about the member changes here. The
      data already exists: `megaFormsForBase` (`src/data/dex/megas.ts`) returns every
      *Decision:* The Mega row is **dimmed and always visible**, naming the stone; a row exists to be information (D34).
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
- [x] **[Task-61] Beating the map boss no longer teleports the player to the room's door.**
      Reported in play: «al derrotar boss esta teletransportando a puerta cuando no deberia» —
      when the map boss falls the player is warped back to the boss room's entry door.
      **Reproduced, and the defect is the boss-win rebuild.** `applyBattleResult`
      (`src/scenes/RouteScene.ts`, 5043-5128) marks the boss beaten (`markBossDefeated`, 5075)
      and, on every map but the final one, calls `this.transitionTo(this.run)` (5107) so the room
      is rebuilt with its portal now open. `transitionTo` (4437-4454) is the **room-change**
      path — the same one a door (`advanceRoute`, 4404) and a portal step (`advanceMap`, 4398)
      use — and it ends by **repositioning the player on the room's entry tile**:
      `this.player = { ...this.route.entry }` (4449) then
      `this.movePlayerTo(this.player.x, this.player.y)` (4450). That is right when the run's map
      position moved, and wrong here, because the run did **not** move: the player fought the
      boss at the room's farthest tile (`bossTrainer` places it with `farthestRoomTile`, 1015-1025
      / 1061-1090) and is put back on the door they walked in through. The portal itself is
      innocent: `portalOpen()` (1006-1008) only flips the flag, `applyRoute` seals the portal
      edge while the boss stands (1151-1153), and `tryLeaveRoom` steps through it only on a real
      step toward that border (4391-4406) — nothing moves the player onto the portal.
      **Fix shape:** rebuild the room **without** respawning. The boss-win branch asks for a
      rebuild that keeps the player's tile — the spec freezes the shape (a `keepPosition` option
      on `transitionTo`, or a `rebuildRoom()` that runs the same `buildRoom`/`drawTiles`/
      `drawEntities`/`drawItems`/`drawTrainers`/`drawShopCounter` chain and then re-applies the
      stored tile) — while the door and portal paths keep today's respawn. The stored tile is
      already in hand: the route scene is only **paused** behind a battle
      (`startBattle`'s `this.scene.pause()`, 4929), never stopped, so `this.player` still holds
      the tile the boss's sight triggered the fight from; the camera already follows the sprite
      (`startFollow`, 1244), so it re-centres on that same tile by itself.
      Out of scope: the portal's own rule (it still opens when the boss falls, D31, and the
      final boss still ends the run, 5103-5105), the mini-boss reward window, the room's
      regeneration, the boss's own roster and the `docs/` rules, none of which move.
      *Decision:* Rebuild through `transitionTo` with a `keepPosition` option, so the un-sealed room is exactly the room a revisit draws, portal art included.
      *Dependencies:* none. Batch order covers it: it wants `src/scenes/RouteScene.ts`, which
      **every** batch from 5 to 20 holds (5 Task-16, 5b Task-45, 6 Task-41, 6b Task-38, 7
      Task-31, 8 Task-08's every-scene sweep, 8b Task-35, 9 Task-39, 9b Task-40, 10 Task-26, 11
      Task-29's ledger, 12 Task-30, 13 Task-44, 14 Task-48, 15 Task-49, 16 Task-50, 17 Task-52,
      18 Task-55, 19 Task-56, 20 Task-58), so it opens the plan's new **Batch 21** — and it is
      the round's only defect, so it runs first. *(Batch 21)*
- [x] **[Task-62] A trainer or boss room's battle may begin under a weather, a terrain or a room
      condition, and the route draws it.** Reported in play: «en habitaciones de entrenadores y
      boss añadir una baja probabilidad de que la habitacion los combates empiezan con un clima o
      terreno, en el mapa debe aparecer animacion o filtro que representa el clima terreno», and
      extended with «a parte de probabilidad de combates con clima y terrenos añadir niebla densa
      ataques tienen menos 20 de precision, habitacion gravedad esta puesta el ataque gravedad,
      espacio raro los lentos van antes que los rapidos».
      **What the engine models today, verified.** All four of the report's named effects except
      fog already ship — and **none of them is set at battle start**:
      - **Weather** `sun | rain | sand | snow` with `weatherTurns` (`src/engine/battle/state.ts`,
        10, 97-98), set by the ported moves and abilities (`setWeather`,
        `src/engine/battle/effects/weather.ts`, 39-43, `WEATHER_TURNS = 5` at 10), read by the
        damage model (`weatherModifier`, `src/engine/battle/damage.ts`, 51-67) and the
        end-of-turn chip (`turn.ts`, 985-998).
      - **Terrain** `electric | grassy | misty | psychic` with `terrainTurns` (`state.ts`, 11,
        99-100), set by `setTerrain` (`src/engine/battle/effects/terrain.ts`), read by
        `terrainModifier` (`damage.ts`, 69-83) and the Grassy heal (`turn.ts`, 1000-1008).
      - **Gravity** is the field condition `state.field.gravity` (`state.ts`, 18-19, 36-46, 102),
        set by the move Gravity (`effects/moves.ts`; the coverage table marks it `port`,
        `docs/balance/effect-coverage.md` 652) and read by `accuracyChance`'s `gravity` flag,
        which bends every move's aim by 5/3 (`src/engine/battle/accuracy.ts`, 5-17), reached from
        `hitChance` (`src/engine/battle/modifiers.ts`, 21) and `preview.ts` (91).
      - **Trick Room** is the field condition `state.field.trickroom` (same lines), read by
        `orderActions` to invert the Speed order for the whole field
        (`src/engine/battle/order.ts`, 18, 27).
      - **Fog is not modelled at all** — no `fog` in `WeatherId`, `FieldConditionId` or anywhere
        under `src/engine/battle/**`; the only accuracy knob is Gravity's multiplier. Dense fog
        is therefore the one rule this task **adds**.
      **A battle start cannot set any of them today.** `createBattle(setup)` (`state.ts`, 130-…)
      hard-codes `weather: null`/`weatherTurns: 0`/`terrain: null`/`terrainTurns: 0` (159-162) and
      `emptyFieldConditions()` (36-46), and `BattleSetup` (120-128) carries player/enemy/rng/
      isWild/bag/names only. The seam that already carries run facts into a battle is
      `BattleLaunch` (`src/engine/run/battleLink.ts`, 45-57), set by `RouteScene.startBattle`
      (4918-4927) and consumed by `BattleScene.create` (395-405).
      **The call the plan takes: the condition belongs to the ROOM, not to the battle start.** It
      is rolled when the room is built, on a stream of its own keyed to the room's **stable**
      index — the key `buildRoute` already uses, `routeIndexForRoom(plan, view.roomId)`
      (RouteScene 969-972) — so a fixed seed reproduces it, a revisit shows the same room and the
      map filter is a room fact rather than a per-battle surprise; and the report's own words are
      plural («los combates empiezan»), so **every** battle that starts in that room begins with
      it. The alternative — a per-battle roll — would make the same room flip conditions on every
      entry and would put the roll inside `BattleScene`, the wrong owner: the battle scene takes
      no run state (`battleLink.ts`, 36-44).
      **The roll, as the recommended reading (rule in `src/engine/`, numbers in `src/data/`):** a
      pure `roomBattlefield(seed, roomIndex, kind)` in a new `src/engine/routes/battlefield.ts`
      with a co-located test, returning `null` for most rooms and a condition at a **low chance**
      for the rooms the report names (a room that fields regular trainers, and the boss room). It
      draws exactly **one** `rng.next()` for the chance and, on a hit, one `rng.int` for the
      table entry, from its own stream `Rng(hashSeed(`${seed}:battlefield:${roomIndex}`))`, so no
      existing `map`/`encounters`/roster stream moves (D11) and a fresh seed's geometry,
      encounters and rosters are unchanged. The table and the chance live in `src/data/` — a
      `ROOM_BATTLEFIELDS` list of `{ id, kind }` entries (a weather, a terrain, `fog`, `gravity`,
      `trickroom`) plus the chance constant, beside a test — never in the engine.
      **Dense fog is a new rule and the task must add it.** The report asks for a flat **−20**
      accuracy on attacks. The recommended home is the accuracy path: `accuracyChance`
      (`accuracy.ts`, 5-17) gains the fog term — the move's own accuracy drops by 20 before the
      stage multiplier, clamped at 0, and a move whose `accuracy` is `true` is **unaffected** —
      and `hitChance` (`modifiers.ts`, 17-23) passes the new flag beside `gravity`. Whether fog
      is a **weather** (`'fog'` joining `WeatherId`) or a **field condition** (`'fog'` joining
      `FieldConditionId`) is the call below; the recommended reading is the **field condition**,
      because fog must not enter `weatherModifier`/`weatherChip` and the field shape is the one
      Gravity and Trick Room already use.
      **Fix shape:** one pure roll, one launch field, one setup field, one added rule.
      `BattleSetup` and `createBattle` gain optional `weather`, `terrain` and `field`, defaulted
      to today's nulls so every existing test and the pure engine stay green; `BattleLaunch`
      (45-57) gains the same optional condition; `RouteScene.startBattle` (4918-4927) attaches
      the room's condition and `BattleScene.create` (395-405) hands it to `createBattle`; and the
      route draws the room's condition as an **overlay/filter** — the report's "animacion o
      filtro" — over the tiles (a tinted full-screen rectangle or a camera post-FX plus a light
      particle pass, drawn with the existing `TILE_SIZE`/`actorDepth` conventions and allocating
      nothing per frame). The engine's `setWeather`/`setTerrain`/`setFieldCondition` are **not**
      called from the route: the state is seeded through `createBattle`, so the battle's own log
      and turn counters stay the only writers. The filter is an overlay of its own (there is no
      tile-animation contract to reuse: Batch 5b's Task-45 draws its grass step as the scene's own
      overlay on the player's tile, from the tall grass's own frame list — no per-cell system and
      nothing to wait for).
      **Determinism (AGENTS.md's fixed-seed rule):** the roll is a pure function of the seed and
      the room index and draws from a dedicated stream; the fog/field term draws no RNG — so the
      regression is a fixed-seed walk: a seed's room conditions are identical on every rebuild, a
      room with no condition is still `null`, the roll never moves the `encounters`/`map`
      streams, and a fog battle rolls the same turn order and the same hit sequence as before the
      fog existed.
      **Docs:** the room condition is a map rule (`docs/maps-spec.md` §7's special-room table
      gains the condition rooms, and §6 the boss room's own chance) and the battle-start seeding
      is a battle rule (`docs/battle-spec.md` §4, whose side/field-condition paragraph is 57-62).
      No `D##` is owed: the rules are gameplay and the shape is `D31`/`D33`'s.
      Out of scope: the existing weather/terrain/gravity/trick-room rules and the moves that set
      them (they do not move), the info window `[Task-60]` (Batch 17) that lists the battle's own
      state, the encounter table, the room generator's geometry, and the trainer placement.
      **The table's second half is `[Task-106]`'s, one task of its own, filled into Batch 28 and
      shipped there.** The radiant
      zone, the two auras, the all-types change, Endure and the +50 crit are new **engine rules**
      rather than rows this task could carry, so the sibling extends the `ROOM_BATTLEFIELDS` table
      and the `BattleSetup` seam this task freezes and never duplicates the five conditions named
      here. `[Task-100]` (the boss room's own rules, Batch 45) is the third reader of the same
      table; `[Task-94]`'s forced field (Batch 40) is the fourth.
      *Decision:* Fog is a **field condition** (it never enters `weatherModifier`/`weatherChip`), a never-miss move is **unaffected**, and the condition belongs to the **room**, so every battle there, wilds included, begins with it.
      *Dependencies:* none — every rule it reads is shipped and the roll composes shipped
      primitives. Batch order covers it: it wants `src/scenes/RouteScene.ts` **and**
      `src/scenes/BattleScene.ts` together, and every batch from 5 to 20 holds the route scene
      while the battle scene is held by 5, 5b, 6, 6b, 7, 8, 8b, 9, 9b, 10, 11, 12, 14, 17, 18 and
      20 — so it opens the plan's new **Batch 22**, one batch behind Task-61. *(Batch 22)*
- [x] **[Task-63] A beaten mini-boss also offers three unidentifiable Pokémon beside its item
      rows.** Reported in play: «para que miniboss su recompensa a parte de opciones de objeto
      tambien esta la posibilidad de darte 3 opciones de pokemon pero sin saber su nombre o sprite,
      dado su estadistica más alta y su naturaleza o simplemente da 3 habilidades y eligues a
      partir de habilidades que no será la suya original porque son random o dado los moveset
      random de los tres, esas 3 opciones hay».
      **The reward seam today is items only.** `openMiniBossReward` (`src/scenes/RouteScene.ts`,
      5715-5731) draws `rewardChoices(ROUTE_LOOT[band.id].pool, MINI_BOSS_REWARD_CHOICES, rng)`
      from `Rng(hashSeed(`${seed}:reward:${mapIndex}`))` (5721) with
      `MINI_BOSS_REWARD_CHOICES = 3` (472); `buildMiniBossReward` (5744-5798) and
      `refreshMiniBossReward` (5800-5811) draw one row per item (icon, name, short description)
      and `chooseMiniBossReward` (5838-5848) folds the pick through `addItem`; `rewardChoices` is
      the pure chooser (`src/ui/rewards.ts`, 10-32). The window opens from the boss-win branch
      (5110-5113) and the cancel key leaves with nothing (5830-5832).
      **Every primitive the Pokémon half needs already ships.** A run-seeded ability and moveset
      is `createFighter({ id, speciesId, level, learnsetSeed })` (`src/engine/battle/fighter.ts`,
      480-…; the ability is `randomAbility(speciesId, seed, ['No Guard'] when the moveset carries
      an OHKO)`, `resolveAbility` 416-…, `src/engine/battle/randomAbility.ts`, and the moveset is
      `defaultMoveset`/`randomLevelUpMoves`, D17); a species is `speciesPool(band, 'wild' |
      'trainer')` (`src/engine/run/pool.ts`, 35-46, D39); a member is
      `runPokemonFromSnapshot`/`createRunPokemon` (`src/engine/run/progression.ts`, 94-103); the
      nature, IVs/EVs and the six stats are on the fighter, so the **highest stat** is one
      `Math.max` over `statAtLevel(species, level, nature, ivs, evs)` (`src/data/dex/natures.ts`,
      59-…); and the placement a catch already goes through is `addPokemon` (`src/engine/run/
      state.ts`, 257-…) with `adoptAtLevel` (`progression.ts`, 114-140) so the reward joins at the
      squad's level, exactly as `resolveBattle`'s fold does it (`src/engine/run/resolve.ts`,
      92-101).
      **Fix shape:** one chooser, one row kind, one placement. `src/ui/rewards.ts` gains the
      Pokémon chooser beside `rewardChoices` — a pure `pokemonRewardChoices(...)` returning the
      unidentifiable entries `{ speciesId, level, nature, topStat, ability, moves }` built from
      the shipped primitives (the spec freezes the exact names) — with its cases in
      `src/ui/rewards.test.ts`; `RouteScene`'s reward window gains a second **row kind** beside
      the item rows, whose label is the report's own presentation (the **highest stat and the
      nature**) and which **never** draws a name or a sprite, with `chooseMiniBossReward`
      branching to the Pokémon placement when the highlighted row is a Pokémon; the chosen one
      lands through `addPokemon` at the squad's level, so a full party sends it to the box. The
      reward stays **one** window with two row kinds, so the cursor, `E`/`Q` and the leave path
      stay one control.
      **The reading the entry freezes (the report's primary ask):** each option is presented by
      its **highest base stat** and its **nature**, and never by its name, sprite, types or
      moves, so the choice is a real gamble. The alternatives the report floats — the three read
      by their **rolled abilities** (random, D17, so never the species' own) or by their **random
      movesets** — are the open question below, with the highest-stat-plus-nature reading as the
      written default.
      **Determinism (AGENTS.md):** the chooser draws from its own stream (a sibling of
      `:reward:${mapIndex}`, 5721), so the item rows a fixed seed already produces do not move,
      and the regression is a fixed-seed test: the same seed offers the same three
      (stat, nature) pairs and the same item rows.
      **Docs:** the mini-boss row in `docs/maps-spec.md` §7 (185) and the mini-boss bullet in
      `docs/design-spec.md` §7 (259-260, "offers a choice of items") gain the Pokémon option.
      Out of scope: the item half (`rewardChoices`, the loot pools), the mini-boss's own roster
      and Mega Stone, the catch's own rules — this placement is **not** a catch, so it spends no
      room capture and bumps no `stats.catches` — the party/PC panel, and `[Task-52]`'s wild-pool
      exclusion (a different rule on the encounter table).
      *Decision:* One reward window whose item rows sit beside three Pokemon rows presented by **highest stat plus nature**, with the cursor, the page keys and the leave path staying one control.
      *Dependencies:* none — the chooser composes shipped primitives. Batch order covers it: it
      wants `src/scenes/RouteScene.ts` and `src/ui/rewards.ts`, and the route scene is held by
      every batch from 5 to 20 — so it opens the plan's new **Batch 23**, one batch behind
      Task-62. *(Batch 23)*
- [x] **[Task-111] The special-room layer leaves `RouteScene.ts`, and a new room is a new file.**
      **The bottleneck, measured.** `[Task-64]`-`[Task-67]` each claim
      `src/scenes/RouteScene.ts` (13 open tasks name it), so the batch rule serializes them:
      Batches 24-27 are four single-task batches. The room layer is the reason: `buildRoom`
      (1144), `drawShopCounter` (5334), `drawMapMarker` (3065) and the Mart's
      `openShop`/`buildShopPanel`/`refreshShop`/`activateShop` (6497-6772) live in the scene.
      **Fix shape:** one descriptor per special kind in `src/scenes/rooms/` (`shop.ts`,
      `miniBoss.ts`, `megaStone.ts` first) with `{ kind, marker, fixture, interact }`; the scene
      holds one registry built with `import.meta.glob('./rooms/*.ts', { eager: true })`, so a
      new room is a **new file** plus nothing else. `MapRoomSpecial` stays the plan's data; the
      marker the map draws comes from the descriptor. The shop's panel is the shared panel its
      descriptor opens, with the same rows and keys. **No behaviour change:** the same tiles,
      markers, prices, keys and interactions; no RNG draw added or reordered; no run field; no
      `SAVE_VERSION` step.
      **Acceptance:** the three shipped rooms are pixel-identical in the live game
      (`renderer.snapshotArea` before/after on the same seed), the shop opens and closes on the
      same keys, the registry test proves a new module is discovered without a `RouteScene.ts`
      edit, and `npm test` + `npm run build` are green.
      *Dependencies:* none. It claims `src/scenes/RouteScene.ts`, `src/ui/mapView.ts` and the new
      `src/scenes/rooms/**`; it runs **one batch behind `[Task-112]`** and **before `[Task-64]`**,
      so the room wave stops serializing. *(Batch 23b)*
- [x] **[Task-112] The moves and the abilities speak Spanish (the official copy).**
      **The gap.** `src/i18n/es.ts` overlays the UI chrome only; `D43` froze every dex name in
      English, so a Spanish run prints `Tackle`, `Blaze` and their English `desc`/`shortDesc` in
      the MOVES grid, the floating description, the ability popup, the learnset band and the
      level-up notice. The official games localize move and ability names and their
      descriptions, and those are the strings this task uses - never a literal translation.
      **Fix shape:** a new generated content table, `src/data/i18n/es/moves.json` and
      `abilities.json`, keyed by the dex id (normalised the way `getMove`/`getAbility` normalise),
      holding `name`, `description` and `shortDescription`; `scripts/build-i18n-content.mjs`
      fetches PokeAPI's `es` `names` and `flavor_text_entries` (the official strings, cleaned of
      form feeds and line breaks, latest version group first), matches by normalised id and
      writes the JSON; a pure `src/i18n/content.ts` exposes `moveName(id)`, `moveDescription(id)`,
      `abilityName(id)` and `abilityDescription(id)` with the English dex string as fallback and a
      `MISSING_ES` list for the rows PokeAPI does not carry. Every UI site that prints content
      reads those accessors: `src/ui/moveGrid.ts`, `src/ui/partyDetail.ts`,
      `src/ui/infoPopup.ts`, `src/scenes/BattleScene.ts` and `src/scenes/RouteScene.ts` (MOVES
      grid, INFO popup, learnset band, level-up notice and TM row).
      **The rule, frozen:** official Spanish names, not translations - `Tackle` -> `Placaje`,
      `Ember` -> `Ascuas`, `Growl` -> `Gruñido`, `Blaze` -> `Mar Llamas`, `Torrent` ->
      `Torrente`, `Overgrow` -> `Espesura`. Pokémon species, items and biomes stay English
      (`D43` amended for moves and abilities only); `en` keeps the dex's own strings.
      **Acceptance:** every move and ability in the dex has a Spanish row or is listed in
      `MISSING_ES` with its reason; the six spot-checks above are pinned; the live MOVES grid and
      the ability popup print the Spanish name and description under `language: es` and the
      English under `en`; no battle rule, RNG draw or run field changes, so **no `SAVE_VERSION`**
      step.
      *Dependencies:* none. It claims `src/data/i18n/**`, `scripts/build-i18n-content.mjs`,
      `src/i18n/content.ts` + test, `src/ui/moveGrid.ts`, `src/ui/partyDetail.ts`,
      `src/ui/infoPopup.ts`, `src/scenes/BattleScene.ts`, `src/scenes/RouteScene.ts`,
      `docs/tech-decisions.md` `D43` and `docs/data-spec.md` §1; it is **the first batch after
      Batch 23**, in **Batch 23a**, before Batch 24, because it holds the two scenes the room wave
      needs. *(Batch 23a)*
- [x] **[Task-113] The 61 descriptions the base-game dump does not carry.** *(Superseded by
      `[Task-149]` on `2026-10-25` — see the decision line at the end of this entry.)*
      **The gap.** `[Task-112]` shipped the official Spanish name of all 835 moves and 311
      abilities and the official description of 817 moves and 268 abilities. The remaining
      **18 moves** and **43 abilities** are DLC rows whose `move_flavor_text` /
      `ability_flavor_text` and base-game text dump have no `es` entry, so `MISSING_ES` falls
      back to English. Their names are already Spanish; only the descriptions are missing.
      **Fix shape:** fill `description` and `shortDescription` in
      `src/data/i18n/es/moves.json` / `abilities.json` for exactly the ids in `MISSING_ES`,
      from the game's own Spanish text (the DLC text dump where it carries the row, else the
      official Spanish Pokédex copy) - **never a machine translation** - regenerate
      `meta.json` so the two `missingDescriptions` lists shrink to zero, and add the DLC
      spot-checks to `src/i18n/content.test.ts` (e.g. `alluringvoice` = `Canto Encantador`,
      `dragoncheer` = `Bendición Dragón`, `malignantchain` = `Cadena Maligna`). No UI change:
      the accessors already read the table.
      *Dependencies:* `[Task-112]` (the tables and the accessors). It claims
      `src/data/i18n/es/**` and `src/i18n/content.test.ts`; it runs **one batch behind
      Task-112**, in **Batch 23a2**, before `[Task-111]`. *(Batch 23a2)*
      **BLOCKED (`2026-10-19`, on the run's own source check): the text does not exist in
      this repository or in any dump it can reach.** The 18 moves and 43 abilities the two
      `meta.json`
      `missingDescriptions` lists name are Scarlet/Violet **DLC** rows, and the rule above
      forbids a machine translation, so the task needs their official Spanish text:
      PokeAPI carries no `es` entry for them (`move_flavor_text` / `ability_flavor_text`, and
      `effect_entries` with no `es` row either), and the public `sv-text` dump the tables were
      built from is **v1.0.1 — base game, no DLC** — so it has no row to carry. There is no
      `sprite-sources/` tree with the DLC text and no other dump in the repo. It stays out of
      the backlog (`[!]`, the CI's blocked mark, `docs/agent-ci.md` §Task states) until a
      **DLC Spanish text dump** is available; then the two lists shrink to zero, `MISSING_ES`
      empties and the DLC spot-checks are added. Nothing else blocks it: the accessors, the UI
      wiring and the English fallback already ship, and no rule, RNG draw or run field moves,
      so there is still **no `SAVE_VERSION`** step.
      **Decision (`2026-10-25`): the 61 get Spanish authored in the repo (`D52`).** The human chose
      authored Spanish over waiting for a DLC dump, so `[Task-149]` fills the two lists and this entry
      closes as **superseded**. The "never a machine translation" rule stays intact for everything
      else: these 61 are written as content (from the dex's own English `desc`/`shortDesc`) and
      reviewed as content, never emitted by a generator, and the DLC dump remains welcome as a later
      correction if one appears.
- [x] **[Task-64] A casino room: a Team Rocket grunt, a slot machine the player pays to spin, and
      its prizes.** Reported in play: «añade tarea para añadir habitacion casino, aparece un sprite
      de un recluta team rocket, aparece una tragaperras y pagas por tiradas con posibilidad de
      huevo da un poke random se abre al pasar de piso, objetos, posibilidad de combate contra el
      recluta y ya no se puede tirar de la tragaperras».
      **What a special room is today (`D47`, after `[Task-111]`).** `MapRoomSpecial` is
      `'shop' | 'mini-boss' | 'mega-stone'` (`src/engine/maps/plan.ts`, 64), placed as **dead-end
      leaves** by `planMap`'s special pass (400-448): the guaranteed shop near the entry, the
      mini-boss at `MINI_BOSS_CHANCE = 0.5` (105) and the mega-stone at 0.15 from map 3 (108/111,
      445-448), each hung off a regular room that is neither the entry nor the boss (`freeParents`,
      406-415), listed in `plan.specials` (482-484) and found by `specialRoom(plan, kind)` (505-507).
      A room's content is now a **descriptor module** under `src/scenes/rooms/` — `types.ts` holds
      `RoomDescriptor` / `RoomHost` / `RoomPanel` / `RoomFixture`, `registry.ts` collects one
      `descriptor` per kind out of the folder and `RouteScene.buildRoom` calls
      `this.specialDescriptor()?.fixture?.(this.roomHost())` once per build (1133-1140), keeping the
      room's one interactable tile in `this.shopCounter` (the port's `counterTile()`), whose
      interact is `tryInteract`'s first branch (5865) and whose sprite the descriptor draws through
      `drawFixture` (5309-5318). The minimap glyph comes from the same descriptor's `drawMarker`
      (3064) and the marker type is the plan's own union (`MapRoomMarker = MapRoomSpecial`,
      `src/ui/mapView.ts`, 26), so **a new kind needs no `mapView.ts` edit**. `shop.ts` is the
      model for a room that owns a window (its module state, its keys and its `RoomPanel`).
      **What already exists for the machine's content.** Items are granted by `addItem`
      (`src/engine/run/state.ts`, 526-533) and drawn as rows from an item id (`itemIconFrame`,
      `getItem`, the reward window's own row shape, 5764-5769); money is spent by `spendMoney`
      (541-546) and read by the Mart's readout; a prize table is the loot pool's shape
      (`LootEntry`, `src/data/loot.ts`, picked by `rewardChoices`, `src/ui/rewards.ts`, 10-32); a
      random Pokémon from a band is `speciesPool(band, 'wild')` + `createFighter({ learnsetSeed:
      run.seed })` (D17) placed by `addPokemon` (`state.ts`, 257-…); and a trainer battle is
      `startTrainerBattle` (4587-4619) → `startBattle` (4904-4931), with a beaten trainer marked
      by `markTrainerDefeated`/`isTrainerDefeated` (`state.ts`, 501-509) — the same per-floor id
      list the boss and mini-boss use. **No egg exists**, and a floor advance is `advanceMap`
      (`state.ts`, 185-204), the portal step `tryLeaveRoom` calls at 4398; a room change is
      `advanceRoute` (161-175).
      **Fix shape, as the spec freezes it (`.agent_specs/task-64.md`, `2026-10-19`):**
      1. `MapRoomSpecial` gains `'casino'` (`plan.ts`, 64) and the special pass hangs it **last**,
         after the mega-stone, on `CASINO_CHANCE = 0.3` from map 2 on (`CASINO_FROM_MAP = 2`) —
         both module-private constants beside `MINI_BOSS_CHANCE`/`MEGA_STONE_CHANCE` — so no
         shipped leaf, room id or size moves. The room is a new descriptor module,
         `src/scenes/rooms/casino.ts` exporting `descriptor` with `kind`/`marker` `'casino'`, its
         own `drawMarker` glyph and its own window (the `shop.ts` pattern); `mapView.ts` is not
         edited and the scene's registry needs no change.
      2. Its `fixture` places **one** counter tile (`host.farthestRoomTile()`, the shop's rule) and
         `drawFixture` draws the machine's cabinet and the grunt's sprite **on that one tile** (the
         grunt `-14` px off its x, depth 6), so no second tile and no `RoomFixture` change is
         needed. The grunt is a new `rocket` row in a **new `SPECIAL_ARCHETYPES` table** beside
         `TRAINER_ARCHETYPES` (`src/data/trainers.ts`), merged only into `getTrainerArchetype`'s
         index: the route's own pool (`TRAINER_ARCHETYPE_IDS`) and its rolls are untouched, and so
         are the four shipped invariants that pin the two packed atlases and the walk-animation
         table to `TRAINER_ARCHETYPES.length` (`src/data/trainerSprites.test.ts`,
         `src/data/overworldSprites.test.ts`, `src/data/trainers.test.ts`,
         `src/render/trainerAnim.test.ts`) — which is what lets the row exist without the repack its
         art would otherwise force.
      3. The machine's **price, prize table and battle chance** live in the new
         `src/data/casino.ts` (`{ price: Record<BandId, number>, battleChance: number,
         prizes: Record<BandId, readonly { kind: 'item' | 'egg', itemId?, weight }[]> }`), and the
         roll is the new pure `casinoSpin(run)` in `src/ui/casino.ts` beside `rewardChoices`,
         which mints its **own stream** — `Rng(hashSeed(`${seed}:casino:${mapIndex}:${spins}`))`,
         `spins` read off the run's own per-floor spin marks — so the floor's shop stock, reward
         picks and rosters do not move (D11) and a reload continues the sequence.
      4. A spin spends `spendMoney`, marks `casino-spin-<map>-<n>` in the run's existing
         `pickedItems` and pays one outcome: an **item** lands through `addItem`; an **egg** lands
         as an ordinary bag item (a new `egg` row in `src/data/items.ts`, kind `valuable`, price 0,
         with the `luckyegg` icon fallback in `src/data/itemIcons.ts`) and **hatches on the map
         advance** — a new pure `hatchEgg(run)` the scene calls on the portal step
         (`tryLeaveRoom`, 5621-5624), not on `advanceRoute` — becoming a random Pokémon of the new
         floor's band (`speciesPool(band, 'wild')`, level = `squadLevel(run)`, the
         `createRunPokemon` → `adoptAtLevel` → `addPokemon` path `[Task-63]` shipped, so a full
         party sends it to the box). Rolling the species **at hatch time** keeps the egg a plain
         bag stack: **no new run field, no `SAVE_VERSION` step**.
      5. The **grunt battle** is a spin outcome and the machine **locks** the moment it triggers:
         `casinoSpin` marks `casino-lock-<map>` in the same per-floor `pickedItems` list (cleared by
         `advanceMap`, `state.ts` 199-201) and the descriptor then closes its window and calls a
         **new `RoomHost` hook**, `startTrainerBattle(trainer: RouteTrainer)`, with
         `id: 'casino-grunt-<map>'` and `archetypeId: 'rocket'`; the port gains one more hook,
         `showNotice(notice: Notice)`. Money and items need no hook (`host.commitRun` over the
         engine's own `spendMoney`/`addItem`), and the egg's beat on `advanceMap` is the scene's,
         not a room call.
      **The grunt's art is deferred, not invented.** No Rocket grunt source exists in the rip
      today — `sprite-sources/frlg/overworld/` holds twelve strips and none is one, the
      `pokefirered` clone is partial (no `graphics/`), and only `trainers.png`'s Regular Trainers
      block is measured — so the archetype declares `spriteKey`/`battleSprite: 'rocket'` and both
      surfaces draw the shipped placeholder until the human supplies the rip; the repack and the
      two atlas rows are **not** this task's paths (the open question below carries the choice).
      **`SAVE_VERSION` verdict:** the frozen reading adds **no** run field (the lock and the spin
      counter are per-floor ids and the egg is a bag item), so the chain stays 14 → … → 18; the
      alternative (an egg that remembers its species, or a dedicated per-floor list) is
      **rejected** — it would have taken the next step after Task-52's 17 → 18 and a migration.
      **Docs:** the special-room table and its content bullets in `docs/maps-spec.md` §7 and the
      special-rooms bullet in `docs/design-spec.md` §7 (251-262) gain the casino.
      Out of scope: the Mart and its stock, the mini-boss reward, the mega-stone, the loot pools,
      the money a trainer drops, and the battle rules themselves — the grunt fights through the
      existing trainer path.
      *Decision:* The machine locks the moment the battle **triggers**, the egg hatches on the **map advance**, the egg is a **bag item** whose species rolls at hatch time (no run field, no `SAVE_VERSION`), and the battle is a **spin outcome**.
      *Dependencies:* `[Task-111]` (the `RoomDescriptor`/`RoomHost` layer and the three shipped
      descriptors this room copies) and `[Task-63]` (the member-build path the Egg reuses,
      `chooseMiniBossReward`). Batch order covers the rest: it wants `src/scenes/RouteScene.ts`
      (claimed by every batch from 5 to 23a, 20's Task-58 and 23a's Task-112 among them) and the
      special-room layer `[Task-65]` and `[Task-66]` also extend, which is why the three cannot
      share a batch — so it opens the plan's new **Batch 24**, one batch behind Task-63.
      *(Batch 24)*
- [x] **[Task-65] A gated reward room: a reward behind a blocked path only a party of the right type opens.**
      Reported in play: «añade tarea habitacion especial que da recompensa pero el camino esta
      bloqueado y solo se puede entrar si algun poke del party conoce cierto movimiento por ejemplo
      corte y aparecen arbustos o rocas y necesitas golpe roca o agua y necesitas surf». The human's
      later answer (`2026-10-19`) replaced the move with a **type**: the obstacle is opened by a
      party Pokémon of the right **type** — a bush by Bug or Grass, a rock by Rock or Fighting,
      water by Water — so nothing is required to be known and no dex/TM row changes.
      **What the generator can already place.** A room's tiles are the route builder's
      (`sketchRoute`, `src/engine/routes/`), whose terrain pass carves tall grass and ledges and
      whose `WATER` is decoration only (`docs/route-generator.md`, 167; D18). The tile vocabulary
      is `FLOOR/WALL/EXIT/TRAP/CHEST/ITEM/WATER/CARPET/TALL_GRASS/LEDGE` (`src/engine/map.ts`,
      5-14), `isWalkable` refuses `WALL/WATER/LEDGE` (16-27) and `resolveMove`/`tileAt` are the
      step rules (57-77); this task adds `BUSH` (10) and `ROCK` (11) to both the vocabulary and
      `SOLID`, and reuses `WATER` for the third seal. A **ground item** is placed on a
      flood-fill-reachable pocket (the ground-item pass, `docs/route-generator.md` §"Items", 381) —
      which is exactly why the gated reward is placed by the room's **fixture after the build**
      instead: `validateRoute` fails a stranded item, and a sealed vault is stranded by design. A
      room's content is injected in `buildRoom` (`RouteScene`, 1109-1150) off stable ids — the
      mega-stone's `megaStoneItem` (`rooms/megaStone.ts`, 20-28) is the model for a room-scoped
      item. A special room kind is `MapRoomSpecial` (`plan.ts`, 64) with its minimap marker
      (`mapView.ts`, 26).
      **What "the party's type" can read.** A member's types are its **species'** types:
      `FighterSnapshot` (`src/engine/battle/fighter.ts`, 673-693) carries no `types` field, and
      `createFighter` stamps `types: species.types` (506) from `getSpecies(speciesId).types`
      (`src/data/dex/species.ts`, 26/76-78) — a battle-only forme (Mega, Transform, the room
      condition's all-types field) is reverted or never snapshotted, so the run's member always shows
      its base species' types. The party is `run.party` (`state.ts`, 102) and the box is separate.
      There is **no** party predicate today, so this task adds the first one: a `partyHasType`
      under `src/engine/run/` (its own module, general enough for `[Task-91]`'s
      `partyHasMove`/`partyHasAbility` to join it).
      **Fix shape:** one room kind, one obstacle kind, one gate rule. `MapRoomSpecial` gains a
      gated-reward kind, a **dead-end leaf at 20 % from map 3 on** (the measured placement in the
      paragraph below); the room's own **route build** carves a one-tile corridor to a sealed
      vault and places the reward on its far side — the cut settled that this is a **generator
      pass** (`src/engine/routes/gate.ts`, wired into `attemptRoute`), not a `buildRoom` tweak and
      not a fixture, because `RoomFixture` cannot write tiles and `validateRoute` gates on
      `strandedItems` — with the vault's reachability proven by the same flood-fill the generator
      already uses, and the seal passed in as `RouteRequest.gate: 'sealed' | 'open'` from the room's
      stable id (`gate-<map>-<roomId>` in `pickedItems`). The obstacle is opened by the party's
      **types** — a **bush** by Bug or Grass, a **rock** by Rock or Fighting, **water** by Water
      (the `WATER` tile already ships and is already solid, so the water seal needs no new tile) —
      and the interact key, facing the obstacle, opens it only when `partyHasType(run, row.types)`
      is true for any member, with the opening recorded per-floor (the `pickedItems`-with-a-stable-id
      shape, so it stays open on a revisit and clears on `advanceMap`, `state.ts` 130-131 and
      217-235).
      **The human's answer (`2026-10-19`) superseded the report's move gate:** the obstacle is not
      opened by Cut/Rock Smash/Surf but by a **party type**, so no dex/TM change is made, `cut`
      (absent from the build) is never needed, and the run gains a type predicate instead of a move
      accessor. **`docs/route-generator.md` §7's O-R5 is therefore *not* closed** — that row is about
      Cut/Rock Smash field-move key/flag gates, and a type gate is a different rule; the task
      rewords the row to say so and does not adopt it.
      New bush/rock frames go into the packed FRLG tileset atlas
      (`scripts/frlg/build-tilesets.mjs`, `src/assets/frlg/{outdoor,forest,cave}.png`, cells 49 and
      50, the only free ones), so this task holds the three packed sheets and the packer.
      **Placement, measured (`2026-10-19`).** The leaf's extra door shifts `routeIndexForRoom`'s
      prefix from its start map on, moving trainers ±15-20 % per floor, so the shipped `0.3` from
      map 2 is red on the real `curve.test.ts` seeds: map 2 **1.5135** (outside `[1, 1.5]` and the
      on-ramp `[1.2, 1.35]`), map 4 **1.5145**, map 7 **0.9910**. `0.2` from map 2 is green but
      leaves map 2 at **1.3161**, 0.034 under its ceiling; **`0.2` from map 3** is green with map 2
      **untouched (1.2503)**, map 4 **1.3631** and map 7 **1.0382**, which is the frozen reading
      (`0.3` from map 3 still fails: map 4 **1.5903**). By map 3 the party can field the asked type,
      and the mega-stone leaf already starts there. **No re-base:** `trainerXp`, `MAP_TUNING` and
      `needed(m)` do not move; `docs/balance/route-curve.md` is **re-measured** for maps 3-8 (1-2 do
      not change), and `curve.test.ts` must stay 2/2 with every floor inside its window.
      **The gating call the entry freezes:** **any** party member may open it (the report says
      «algun poke del party») with no lead special-case and no consideration of HP — the lead alone
      was the alternative this cut answered (`2026-10-19`, below). The task must not duplicate
      `[Task-52]`'s pool rule (a different rule on the encounter table) or `[Task-31]`'s placement
      seam (a catch's placement): it claims
      neither `src/engine/run/pool.ts` nor `addCaughtPokemon`/`pcCatch`, and the reward it gates
      is an ordinary ground item off a stable room id, not a catch.
      Out of scope: the wild pool, the catch placement, the route generator's geometry beyond the
      room's own carve, type changes and abilities (the party's types are the species' own), the
      party/PC panel, and the map filter `[Task-62]` draws.
      **Docs:** the special-room table and its content bullet in `docs/maps-spec.md` §7 gain the
      gated room and its type gate, `docs/tileset-spec.md` §1/§2/§6 gain the two new map values and
      their cells, `docs/design-spec.md` §7's special-rooms bullet names it, and
      `docs/balance/route-curve.md` re-measures its budget rows for maps 3-8 (no re-base).
      `docs/route-generator.md` §7's **O-R5** row is **reworded, not closed**: it keeps saying
      field-move gates are out of scope and adds that the gated room's **type** gate is not one.
      *Decision:* The obstacle is opened by a party **type** — bush: Bug or Grass, rock: Rock or Fighting, water: Water — **any** party member opens it (the lead included, no special case) and the opening is **permanent for the floor** (the `pickedItems`-with-a-stable-id shape, cleared by `advanceMap`). No move is required and no dex/TM data changes; `docs/route-generator.md` §7's **O-R5** (Cut/Rock Smash field-move gates) stays **open**, because a type gate is not that gate.
      *Dependencies:* none. Batch order covers it: it wants `src/scenes/RouteScene.ts` (every
      batch 5-24, Batch 24's Task-64 last) and `src/engine/maps/plan.ts` — and **not**
      `src/ui/mapView.ts`, because the shipped marker type is `MapRoomSpecial` itself (Batch 24's
      own finding) — so it opens the plan's new **Batch 25**, one batch behind Task-64, and it can
      share neither of the special-room files with Task-64 or Task-66. *(Batch 25)*
- [x] **[Task-78] A trainer's level is a percentage of the squad's own level, by its party size.** The
      human's re-shape — the **player-relative model**, the twenty-fifth round below — replaces the floor
      band with the squad level and the floor cap. The old rule rolled a trainer's level uniformly across
      the map's `minLevel..maxLevel` (`trainerRoster`, `src/engine/run/roster.ts` 55,
      `rng.int(band.minLevel, band.maxLevel)`), so the room beside a floor's entry could field the floor's
      **top** level — map 1 a level-9 trainer on the level-5 starter, map 2 a level-16 on a squad entering
      at 9.
      **Fix shape.** `level = clamp(floor(squadLevel(run) × percent[size]), 1, cap)`, with
      `percent = { 1: 1.00, 2: 0.90, 3: 0.80, 4: 0.70 }` and the **floor** the human asked for («redondeo
      hacia bajo»); `size` is the roster's own count (`LEVEL_BANDS.trainerSize`, or `bossPartySize` for the
      two hand-placed fights). `squadLevel` is the run's one shared level (`src/engine/run/state.ts` 249,
      `D35`), so a trainer scales with the player by construction. The **boss** and the **mini-boss** stay
      pinned to the floor's **cap** (the existing `rosterBand` `minLevel = band.maxLevel`, `RouteScene`
      5701, and their fixed party sizes), so a floor's top is its finale. `trainerRoster` takes the
      resolved level (a `levelFor` option) instead of reading `band.minLevel/maxLevel`, and
      `RouteScene.startTrainerBattle` computes it from the live run.
      **Docs/law:** `docs/maps-spec.md` §5, `docs/routes-spec.md` §5, and the `D11`/`D17` amendment the
      twenty-fifth round records.
      Out of scope: the species pool (Task-79 owns the band it draws), the party sizes, the wild table
      and the award rule (`experienceAward`, `D35`).
      *Dependencies:* none — every primitive it reads is shipped. It opens **Batch 33** as a single
      task: the room queue is what costs the width, and nothing else in the backlog that is free here
      wants `src/engine/run/roster.ts` or `docs/maps-spec.md` §5. *(Batch 33)*
- [x] **[Task-79] A wild encounter's level is a fraction of the squad's own level.** Reported in play:
      «quiero que los salvajes no esten tan alto de nivel por ejemplo que salga un nivel 5 cuando tu solo
      tienes uno al 5 o al subir de piso uno al 9 es injusto». The old rule drew the room's working level
      (`runRoomLevel`, `RouteScene` 1294-1295), which ramps to the floor's `maxLevel`, so map 1's deepest
      rooms fielded level 8-9 grass against a level-5 starter.
      **Fix shape.** A seeded roll lands a **fraction in `[0.60, 0.75]`**, and the level is
      `clamp(floor(squadLevel(run) × fraction), 1, cap)` — the human's «salvajes rango entre un 60 y 75%
      de nivel actual». The **species pool follows the squad level too**: the table draws from
      `bandForLevel(squadLevel)` (`src/data/run.ts`), so the BST window moves with the squad rather than
      the floor. The roll stays on the route's own stream (`D11`: the seed fixes the *draw*), while the
      level it yields is a function of the live `(seed, squadLevel)` — the `D17` amendment the
      twenty-fifth round records.
      Out of scope: the species bans (legendaries/mythicals), the BST windows themselves, the catch rules
      and the per-floor cap.
      *Dependencies:* none. Shares `src/scenes/RouteScene.ts` with Task-78, which is why it is one
      batch behind it — **Batch 34** — rather than beside it. *(Batch 34)*
- [x] **[Task-80] `MAP_TUNING` drops the level range and keeps only the cap.** The player-relative model
      (Tasks 78/79) makes a floor's `levels.minLevel`/`maxLevel` dead weight: the **cap** is the only
      anchor left, so `MapTuning.levels` collapses to a single `cap` and the eight tuned values stay
      **9 / 16 / 23 / 30 / 37 / 43 / 49 / 55** (`src/data/maps.ts`). `levelRangeForMap` and
      `levelCapForMap` become the cap alone, and `MAP_TUNING_STEP.levelStep` still grows it past the last
      row in infinite mode, saturating at `MAP_MAX_LEVEL` (100) — with one end gone, the step is one
      number. Its callers move to the squad-level model: `runBand` / `roomLevelForMap`
      (`src/engine/run/floors.ts`) and the encounter / roster paths (Tasks 78/79). `LEVEL_BANDS`
      (`src/data/run.ts`) keeps its own level windows — they are still the `level → BST window /
      trainerSize` map `bandForLevel` reads — and the six bands still tile `0..800` with no gap. Map 1's
      cap of 9 already sits +4 over the level-5 starter, so the old "start map 1 at the starter's level"
      concern is gone with the ranges.
      **Fixed-seed re-pin:** `src/data/maps.test.ts` (the boundary assertions lose their subject),
      `src/data/run.test.ts`'s `bandForLevel` pins and `docs/balance/route-curve.md`'s cap table.
      Out of scope: the room counts, the sizes (Task-81), the boss and mini-boss party sizes, and the
      multipliers (`trainerXp`, which Task-83 re-solves).
      *Dependencies:* `[Task-78]` and `[Task-79]` — the player-relative model is what makes the
      ranges dead weight, and deleting them first would leave the roster's `band.minLevel/maxLevel`
      read (`src/engine/run/roster.ts` 55) pointing at a field that no longer exists. It rides
      **Batch 35** beside `[Task-82]`, which wants `src/engine/maps/plan.ts` while this task wants
      `src/data/maps.ts` and `src/engine/run/floors.ts`. *(Batch 35)*
- [x] **[Task-81] A room's size follows its shape.** Today `planMap` rolls every room's width and
      height independently inside the map's size range (`src/engine/maps/plan.ts` 388-391,
      `rng.int(tuning.size.min, tuning.size.max)` twice), so the rooms come out roughly square and a
      `cross` reads the same as a `corridor`. The human wants the **shape to pick the aspect**: a
      `cross` a square, a `corridor` a long room, a `tee`/`bend` in between, and a `dead-end` leaf at the
      floor's 30×30 (entry, boss and specials are pinned there already, 453-455). **The table is frozen**:
      `cross` 40×40, `tee` 40×48, `bend` 44×44, `corridor` 52×30 east–west and 30×52 north–south, a
      `dead-end` 30×30.
      **Fix shape.** A `shape → { width, height }` table in `src/data/maps.ts` (or beside `SHAPES` in
      `src/engine/routes/layout.ts`), scaled by the map index instead of the free roll;
      `MAP_MAX_ROOM_SIZE` rises from 48 to **56** to admit the long corridor, while
      `MAP_MIN_ROOM_SIZE` (30) still floors every room. A corridor's width comes from its opening
      **axis**, so the size is derived after the opening set is known. The terrain/camera consequences
      are checked in the same task: `MAP_SIZE_TIERS` (`src/data/mapSize.ts`) reads the new areas and the
      room is still a single screen (`padMap`, camera bounds).
      **Fixed-seed re-pin:** `src/engine/maps/plan.test.ts` (every room's size) and
      `docs/maps-spec.md` §1/§4.
      Out of scope: the room **count** (Task-82) and the `MAP_TUNING` level ranges (Task-80).
      *Dependencies:* none. Its shape table, `src/engine/maps/plan.ts` and `src/data/mapSize.ts` are
      nobody's here, so it rides beside `[Task-87]` in **Batch 30** — a task that owns
      `src/scenes/RouteScene.ts` and the item catalogue and shares no path with it. *(Batch 30)*
      **Claim is incomplete — re-cut before it runs (`2026-10-19`, found while filling Batch 23b).**
      Changing every room's size changes its **area**, and `src/data/mapSize.ts`'s tiers are keyed
      by area, so `trainerBonusForSize`/`terrainScaleForSize` move for the same rooms and every
      floor's trainer density moves with them. The claim must therefore gain, at least:
      `src/data/maps.test.ts` (today it pins `routeSizeRangeForMap(FINITE_MAPS)` to `{ min: 30,
      max: 48 }` and walks the range upward) and `src/engine/maps/route.test.ts` (the two
      `mapTuning(n).size.max` tier pins), and the balance half the entry does not name:
      `src/engine/run/curve.test.ts` (its shipped windows are `1 – 1.5` per floor, `1.20 – 1.35`
      on maps 1-2 and strictly below the recorded pre-thinning totals) and
      `docs/balance/route-curve.md`. If the re-measured fill leaves its window, the fix is a
      balance change in `src/data/population.ts` (Task-82's) or `src/data/run.ts` (Task-83's) —
      which is why this entry also **freezes the map-index scaling** before it is cut: the table
      above is absolute, and "scaled by the map index" is a decision (a scale factor, or a
      per-map row) that must be written here, not invented by the dev.
- [x] **[Task-82] A floor holds a fixed number of trainer rooms.** Today the population pass puts a
      trainer on the main lane and one more per pocket, plus a map-size tier bonus
      (`docs/routes-spec.md` §2 step 4), so a floor fields 5-17 trainers and the band's `POPULATION`
      table (`src/data/population.ts`) is the only throttle. The human wants a **designed
      composition**: map 1 two rooms with trainers, rising to four on the later floors — «en piso 1 dos
      salas de entrenadores + inicial + boss + tienda e ir subiendo hasta 4 salas de entrenadore en
      pisos mas altos».
      **Fix shape.** The plan tags each regular room with a **role** (`trainers` or `wild`) on the map
      stream, from a new data table (`TRAINER_ROOMS_PER_MAP` = **`2,2,3,3,3,4,4,4`**, the human's pick,
      growing with the map index for infinite runs); the population pass places trainers **only** in a
      `trainers` room (1-2 each) and never in a `wild` one, and `POPULATION` (the band thinning) is
      retired.
      `src/ui/mapView.ts` may mark a trainer room with its own icon the way a special room is marked,
      and the minimap's discovery rule is unchanged.
      **The topology floor is the limit, not the wish:** the guaranteed entry leaf plus the 2x2 core
      makes a floor at least **six rooms** (`plan.ts` 385-387), so "2 trainer rooms on map 1" is the two
      core rooms, not a five-room floor; the shop (from map 2, `hangsShop`) is an extra leaf.
      **Fixed-seed re-pin:** `src/engine/maps/plan.test.ts`, the route population tests under
      `src/engine/routes/`, `src/ui/mapView.test.ts`, `docs/maps-spec.md` §2/§7 and
      `docs/routes-spec.md` §2/§5.
      Out of scope: the room sizes (Task-81) and the level ranges (Task-80).
      *Dependencies:* none. It opens **Batch 35** and `[Task-80]` rides beside it (that task is
      written against 78/79 and claims `src/data/maps.ts`, `src/engine/run/floors.ts` and the
      route-curve sheet instead of the plan). It
      is also what unblocks the NPC layer: `[Task-91]`'s roll reads the room's `role`, and
      `[Task-99]`'s trainer rows are placed by the same pass. *(Batch 35)*
- [x] **[Task-83] The XP curve is re-solved against the new floor budgets.** The rule that `75 %` of a
      floor's **trainers** pays its cap is solved into `LEVEL_BANDS.trainerXp` and measured by
      `src/engine/run/curve.test.ts` over three fixed seeds (`docs/balance/route-curve.md`). Under the
      player-relative model (Tasks 78/79) `A(m)` is no longer a per-floor band — a trainer's level is
      `squadLevel × percent(size)` and a wild's a fraction of it — so the budget the rule states becomes
      "the trainers a floor places carry the squad from the level it **enters** at to that floor's
      **cap**", and the six multipliers must be **re-solved by measuring first**: run the walk, then read
      the new `T̄(m)` and `A(m)` and set `trainerXp` so every floor's fill lands in the rule's `1 – 1.5`
      window. The boss's award and the wild pool stay outside the budget, as today.
      **Fixed-seed re-pin:** `src/engine/run/curve.test.ts`, `docs/balance/route-curve.md` (the band
      table, the cap table and the per-floor budget table) and any `trainerXp` pin in
      `src/data/run.test.ts` / `src/engine/run/progression.test.ts`.
      **Cut note (`2026-10-20`, recorded when Batch 35 shipped):** the six band multipliers
      cannot pay maps 6-8 at once — they share `end`, and their caps demand
      `needed(8)/needed(6) = 1.6887`, so Task-82 pinned floor 8 at `0.96` with a documented
      `SHARED_BAND_MIN_FILL`. The root-cause fix is this task's: a **per-floor factor**, not a
      seventh band. `src/data/run.ts` gains `TRAINER_XP_PER_MAP` (eight two-decimal factors, the
      last row repeating past the end) and `trainerXpMultiplierForMap(mapIndex)`;
      `experienceAward` gains a fourth, defaulted `floorMultiplier = 1`, so every existing call
      site and test is inert; `resolveBattle` passes
      `trainerXpMultiplierForMap(next.mapIndex)`; `curve.test.ts` deletes
      `SHARED_BAND_MIN_FILL` and returns floor 8 to `MIN_FILL = 1.05`, re-pinning
      `MEASURED_FILL` mid-window. `docs/battle-spec.md` §7's `experienceAward` bullet gains the
      clause. A seventh band is rejected: it still leaves floors 7-8 sharing one multiplier
      (ratio 1.507) and `BandId` is the key of `ROUTE_LOOT`, the shop, the casino and the
      trainer-money tables.
      *Dependencies:* Task-78 (the trainer's level rule), Task-79 (the wild's), Task-80 (the cap-only
      `MAP_TUNING`) and Task-82 (the trainer rooms) — it measures what they change and cannot be written
      before them. It takes **Batch 36**, one batch after the last of the four, beside `[Task-98]`
      (the floor-mission record), which claims `src/engine/run/state.ts`, `src/engine/save.ts` and the
      mission table and shares no path with this task's `src/data/run.ts` and
      `docs/balance/route-curve.md`. *(Batch 36)*

- [x] **[Task-86] The forme-changing abilities are removed; their formes become forms and evolution
      lines.** The human's instruction: «elimina las habilidades de transformación de formas para pasar
      estos pokes a Formas Independientes / Evoluciones (Directas o Ramificadas)», extended with
      «Cramorant como formas, Terapagos linea evo, Ogerpon formas» and «elimina las habilidades que su
      funcion sea cambiar forma a x poke». Today each of these species changes forme **inside a battle**
      through its ability, so its other formes are `battleOnly` (a few already independent) and
      unreachable in a run; the goal is that every forme is reached either as an **independent variant**
      or as a hand-authored branch, the way the game already reaches a Rotom appliance
      (`FORM_EVOLUTIONS`, `src/data/dex/evolutions.ts` 58-81, the template the shipped `[Task-20]`
      left), and the in-battle change is gone.
      **Decisions already taken (the human's answers).** Nothing is **reversible** — no branch walks
      back. **Eiscue, Morpeko and Minior are not evolutions**: each joins the pool as **one entry** and
      the game picks its variant **internally at generation**, like Vivillon's patterns (the dex's own
      `isCosmeticForme` rows), so the pool is never diluted. Every **branching** evolution fires at the
      species' **BST-band level** (`20/30/40`, `evolutionLevelForBst`), Eevee-style, so its siblings
      offer together and the player picks. **Mimikyu keeps only its standing form** (the busted one is
      not added). **Greninja-Ash is a second Mega of Greninja**, beside the `greninjamega` the tree
      already ships (`Greninjite`, 630), **with its own stone `Greninjite Ash`**, and `Battle Bond` is
      deleted. **Cherrim and Castform get a `+60` BST boost** on their evolved formes: **Castform `+60`
      Sp. Atk**, **Cherrim `+30` Sp. Atk and `+30` Sp. Def**. **Meloetta is left exactly as it is** (a
      Mythical, banned from the wild, so Pirouette is out of the task — and its ability is Serene Grace,
      never a forme ability). **Ice Face stays** (in this tree it is only a shield, never a forme change,
      so it is not deleted). The dex's **ability slots are left exactly as they are** (the run rolls
      every ability anyway, `D17`). A **three-stage line** steps **`+10` per stage** (`40 → 50 → 60`).
      The **internal variant roll fires in every appearance** — wild, trainer and starter alike.
      **The inventory (engine model → target).**

      | Species | Today | Target |
      | --- | --- | --- |
      | Eiscue | `Ice Face` sets a volatile only (**stays**: a shield here, not a forme change); `eiscuenoice` is never reached | **one pool entry**, variant rolled internally |
      | Palafin | `Zero to Hero` → `palafinhero` on switch-out | `Palafin-Hero` an evolution |
      | Meloetta | no handler at all (Relic Song unported); `meloettapirouette` unreachable | **left as it is** — out of the task |
      | Wishiwashi | `Schooling` → `wishiwashischool` above a quarter HP | `School` an evolution |
      | Morpeko | `Hunger Switch` → `morpekohangry` every turn | **one pool entry**, variant rolled internally |
      | Cherrim | `Flower Gift` → `cherrimsunshine` in the sun | `Sunshine` an evolution, **+30 Sp. Atk / +30 Sp. Def** |
      | Minior | `Shields Down` → `miniormeteor` / `minior` | **one pool entry** (Meteor + seven cores), colour rolled internally |
      | Castform | `Forecast` → sunny / rainy / snowy | Sun / Rain / Snow (branched, three), **+60 Sp. Atk** |
      | Zygarde | `Power Construct` **excluded**; `zygardecomplete` battle-only, `zygarde10` independent | a three-stage line 10% → 50% → Complete |
      | Darumaka → Darmanitan | `Zen Mode` → `darmanitanzen` | the level-35 branch splits Standard / Zen |
      | Darumaka-Galar → Darmanitan-Galar | `Zen Mode (Galar)` → `darmanitangalarzen` | the same split |
      | Aegislash | `Stance Change` → `aegislashblade` | Shield / Blade: a one-way branch |
      | Mimikyu | `Disguise` → `mimikyubusted` | the busted form is **not added**; only `Disguise` goes |
      | Greninja | `Battle Bond` → Ash-Greninja | **`Greninja-Ash` a second Mega**, stone **`Greninjite Ash`** |
      | Cramorant | `Gulp Missile` **excluded**; gulping / gorging battle-only | Gulping / Gorging as forms (the human's word) |
      | Terapagos | `Tera Shift` → `terapagosterastal`; `terapagostellar` battle-only | a three-stage line Terapagos → Terastal → Stellar (the human's word) |
      | Ogerpon | the three masks independent and item-gated, four `-Tera` battle-only | the masks as branches (the human's word); the `-Tera` formes **out of scope** (no Terastallization here) |
      | Rotom | shipped, `[Task-20]` — **the template** | no work |

      **The abilities go, not only their handlers.** `src/engine/battle/effects/abilities.ts`: the
      handlers `disguise` (1040), `zeroToHero` (1967), `schooling` (2018), `zenMode` (2023) with both
      its registry rows, `shieldsDown` (2028), `teraShift` (2037), `hungerSwitch` (2046), `forecast`
      (2057), `flowerGift` (2074), `stanceChange` (2084) and `battleBond`, with their registry rows
      (2622, 2734-2744) and the helpers only they use (`changeForm`, `revertForm`, `formReady`,
      `thresholdForm`, `FORM_MIN_LEVEL`). **`iceFace` (1385, registry 2663) stays**: the human's rule is
      an ability that **changes the holder's forme**, and this tree's `iceFace` only sets a volatile that
      blocks one physical hit — it never reaches `eiscuenoice` — so the shield is not a forme change, and
      `iceface` stays in the `randomAbility` pool. Eiscue reaches `eiscuenoice` through its **pool
      variant** instead. The human's rule is that an ability **whose only job is to change a Pokémon into
      forme X** is deleted outright — it leaves the registry and the `randomAbility` pool (the dex's own
      ability slot is left as it is: the run re-rolls the ability anyway, `D17`).
      `changeBattleForm` / `restoreBattleForm` **stay** — Mega Evolution (`D34`) and Gigantamax
      (`src/engine/battle/gmax.ts` 39) still call them. `randomAbility.test.ts` loses the ids (`iceface`
      stays); `docs/balance/effect-coverage.md` moves the twelve rows to `removed` and keeps Ice Face
      `port` (Gulp Missile and Power Construct were already `excluded`); `BattleScene`'s Zero-to-Hero
      sprite special case (1410) goes with them.
      **Cherrim and Castform get a real upgrade.** Their promoted formes are **stat-identical** to the
      base today (Cherrim 450 = Cherrim-Sunshine 450; Castform 420 = Sunny = Rainy = Snowy), so evolving
      into one would be a free forme flip. The human wants a **`+60` BST boost** (Castform `+60` Sp. Atk;
      Cherrim `+30` Sp. Atk and `+30` Sp. Def), authored as a hand override in `scripts/build-dex.mjs`.
      The band consequence is accepted: Castform's 480 lands in the `441-800` window, so its branch
      fires at that band's level (`40`), not `30`.
      **The formes become data.** An **independent variant** (Eiscue, Morpeko, Minior) is one pool entry
      whose alternative formes roll per individual **in every appearance** (wild, trainer, starter) — the
      dex's `isCosmeticForme` family is the shape
      (`formeFamily`, `src/data/dex/evolutions.ts` 199), so the generator fields nothing new. One
      caveat: these formes carry **different stats** (Eiscue-Noice trades Def for Speed; Minior's core
      trades Def/SpD for Atk/SpA/Spe), so the roll is mechanical where Vivillon's is cosmetic. A
      **branch** joins `FORM_EVOLUTIONS` at the species' BST-band level, Eevee-style; Castform's three,
      Cherrim's Sunshine, Palafin-Hero, Wishiwashi's School, Cramorant's two, Aegislash's Blade,
      Ogerpon's three masks and Darumaka's Zen split are the branch set. A **sequential** line (Zygarde
      10%→50%→Complete, Terapagos→Terastal→Stellar) cannot share that one level, so it carries an
      explicit stage level **`+10` a stage** (`40 → 50 → 60`) in the override. **Greninja-Ash is not a branch at all**:
      it joins the Mega table as a second Greninja Mega (a hand-authored row in `scripts/build-dex.mjs`'s
      mega pass, its stone `Greninjite Ash` beside `greninjamega`), so `mega.ts`, `MEGA_STONES`
      (`src/data/items.ts` 104) and the STATS graph take it with no new code.
      **Docs:** `docs/tech-decisions.md` (`D38`'s evolution rules and `D16`'s coverage),
      `docs/battle-spec.md` §9/§11, `docs/design-spec.md` §3 (the STATS graph draws any branch already)
      and `docs/balance/effect-coverage.md`.
      **Determinism:** adding branches changes `evolutionFamily`, which `wildExclusions` reads, so the
      caught line's species leave the wild table — fixed-seed encounter and roster tests re-pin. Removing
      handlers spends no battle draw, so the battle streams do not move. **No `SAVE_VERSION` step**: a
      member's `speciesId` is already persisted and `evolveMember` is the existing path.
      **Nothing is left open**: every reading this entry raised — the ability slot, the shield half, the
      stage levels and where the variant rolls — is answered in the decisions above.
      *Dependencies:* none. It claims `src/data/dex/**` (`FORM_EVOLUTIONS`), the ability registry,
      `randomAbility.ts`, `src/scenes/BattleScene.ts` and the docs — a batch of its own, and the
      Architect may split it (data / engine / docs). It takes **Batch 21** beside `[Task-61]`, which
      claims `src/scenes/RouteScene.ts` alone and shares none of those paths. *(Batch 21)*
- [x] **[Task-88] Gigantamax needs a stone, named `<Base>ite G`.** The human's rule: «los gigamax
      tambien necesitan piedra que se llamen por su nombre por ejemplo venusorita y se añade la letra g
      venusorita g». Today G-Max is **free**: any species with a G-Max forme may Gigantamax from the
      battle's G-MAX cell (`canGigantamax`, `src/engine/battle/gmax.ts` 15-19), and the STATS graph says
      so (`detail.gmaxNoStone` = "{forme} · Gigantamaxes with no stone"). A Mega, by contrast, is gated by
      a stone (`MEGA_STONES`, `src/data/items.ts` 104, built from `MEGA_FORMES`).
      **Fix shape.** Mint one stone per G-Max forme, named by the same rule as a Mega's with a **` G`**
      suffix — `megaStoneName` (`scripts/build-dex.mjs` 69-70) gives `Venusaurite`, so the G-Max stone is
      **`Venusaurite G`** (`stoneId` `venusauriteg`). `gmaxes.json` rows gain `stoneId` / `stoneName` the
      way `megas.json` rows carry them, the items catalogue gains the G-Max stone list beside
      `MEGA_STONES` (`MEGA_STONE_IDS` 116), `canGigantamax` requires the **holder's item** to be that
      forme's stone (`megaMatchesSpecies` is the matching shape, `src/data/dex/megas.ts`), and the STATS
      graph's G-Max row swaps `detail.gmaxNoStone` for the stone's name, exactly as the Mega row reads. A
      species with both a Mega and a G-Max (Charizard, and every other Mega that also has a G-Max forme)
      simply carries two stones, one per forme — a holder holds one.
      **Docs:** `docs/tech-decisions.md` `D44`, `docs/battle-spec.md` §9, `docs/data-spec.md` §1
      (`gmaxes.json`) and the item catalogue sheet.
      **Reach and cost, settled:** the stones turn up in the **loot pool and the shop**, like the Mega
      Stones, and a stone is **not spent** on use (a Mega Stone is not either — the holder keeps it and
      may Gigantamax again next battle).
      *Dependencies:* none. Adds no run field, so **no `SAVE_VERSION` step**, but it moves the generated
      `src/data/dex/gmaxes.json` and the item catalogue, which is why it shares no batch with
      `[Task-86]` (`src/data/dex/**` and `scripts/build-dex.mjs`) or `[Task-87]`
      (`src/data/items.ts`). It takes **Batch 23** beside `[Task-63]`, whose paths are the route scene,
      `src/ui/rewards.ts` and two doc sections and none of these. *(Batch 23)*

- [x] **[Task-91] The special-NPC framework: one NPC per trainer room, rolled per NPC.** The human's
      rule is that the special NPCs appear by a **per-NPC percentage inside the trainer rooms**
      `[Task-82]` introduces, each with its own chance, and that the chance rises with the floor.
      Nothing places an NPC in a regular room today: the only room-local fixture is the shop counter
      (`RouteScene.buildRoom` 961-1003, `shopCounter`, `drawShopCounter` 4266-4274), and a special
      room is a quiet leaf.
      **Fix shape.** One roll, one table, one panel, one interact.
      `src/engine/routes/npcs.ts` + test exports `roomNpc(seed, roomIndex, mapIndex)`: at most
      **one** NPC per trainer room, one `rng.next()` for the presence roll and, on a hit, one
      `rng.int` over the eligible rows, from its own stream
      `Rng(hashSeed(`${seed}:npc:${roomIndex}`))`, so no `map`/`encounters`/roster stream moves
      (D11) and a revisit shows the same NPC. `src/data/npcs.ts` + test holds the rows
      `{ id, name, spriteKey, chance, floorStep, requires? }` with
      `chance + floorStep × (mapIndex - 1)` clamped, and `requires` is the report's own "a certain
      type or feature of a party member": `partyHasMove` / `partyHasAbility` join the module
      `[Task-65]` creates, whose first predicate is `partyHasType` — never a second module.
      `src/ui/npcPanel.ts` + test is the panel shell every NPC fills
      (title, one paragraph, a column of choices, the leave path) and owes its `src/ui/README.md`
      line. `RouteScene` places the sprite on a free tile of the room, opens the panel on the
      interact key, and records the use per floor through the shipped `pickedItems` stable-id shape
      (`isItemPicked` and the pick beside it, 537-543), so no run field is added.
      **Docs:** `docs/maps-spec.md` §7, `docs/routes-spec.md` §2, `docs/design-spec.md` §7.
      Out of scope: every NPC's own effect (`[Task-92]`–`[Task-95]`), the trainer rooms' composition
      (`[Task-82]`) and the special rooms.
      *Dependencies:* `[Task-82]` (the room roles the roll reads), `[Task-90]` (the sprite rows) and
      `[Task-65]` (the party-predicate module — `partyHasType` — the other predicates join).
      *(Batch 37)*
- [x] **[Task-92] The merchant replaces the shop room.** The human's decision: the **merchant** is an
      NPC and the shop **room** goes. Today the shop is a special leaf (`MapRoomSpecial` `'shop'`,
      `hangsShop` / `SHOP_FROM_MAP = 2` in `src/engine/maps/plan.ts`), its counter (`shopCounter`)
      opens the Mart, and the panel exists only while the player stands in that room
      (`docs/maps-spec.md` §7).
      **Fix shape.** Delete the `'shop'` kind: `planMap`'s special pass loses the guaranteed leaf
      (and `hangsShop`), `src/ui/mapView.ts`'s `MapRoomMarker` loses its icon, and `buildRoom`
      loses the counter branch. The merchant becomes an `[Task-91]` row in `src/data/npcs.ts`
      placed by the guarantee below rather than by the per-NPC roll, and its panel opens the
      **floating Mart** `[Task-89]` ships — the same `src/ui/shop.ts` model, the same drag onto
      the bag or a member, the same `spendMoney` gate. The stock (`buildShop`'s four rows plus
      the TM) and the sell path do not move.
      **The guarantee stays (the human's reading, and the decision).** The shop room dies, but
      the run must still get **one merchant per floor from map 2 on**. The cheapest shape — and
      the decision — is a **placement, not a roll**: `src/data/npcs.ts` gains one optional field,
      **`guaranteedFromMap?: number`**, and the merchant row is
      `{ chance: 0, floorStep: 0, guaranteedFromMap: 2 }`. The scene, which already holds the plan
      and its `role`s, computes the floor's **first `trainers` room** — the lowest room id with
      `role: 'trainers'`, a pure `firstTrainerRoom(plan)` in `src/engine/maps/plan.ts` + test — and
      places the merchant there whenever `mapIndex >= guaranteedFromMap`; the per-NPC roll is then
      asked only for the trainer rooms **after** that one, so `roomNpc` keeps its
      `(seed, roomIndex, mapIndex)` signature and stays pure. A row whose effective chance is `0`
      is never picked by the roll — the eligible set `[Task-91]` defines is `chance > 0`, the same
      filter `[Task-117]`'s zero-chance rocket row relies on — so the merchant is never rolled and
      a floor never holds two. The rejected alternative was a **floor-scoped `pickedItems` marker**
      (say `merchant-<map>`) recording the placement and letting the roll guarantee "at least
      one": it adds a run fact for something the plan already decides. A floor cannot lack a
      `trainers` room — `TRAINER_ROOMS_PER_MAP` is **2,2,3,3,3,4,4,4** (`[Task-82]`) and the
      topology floor is six rooms — and **map 1 stays merchant-free**, exactly as it hangs no shop
      leaf today (`SHOP_FROM_MAP = 2`). The guarantee itself draws **no RNG**: the fixed-seed
      movement the shop leaf's removal causes (the specials drawn after it, and their sizes) is
      this task's own re-pin, not the guarantee's.
      **Docs:** `docs/maps-spec.md` §7 (the special-room table loses the shop row and the §7 NPC
      table gains the merchant, with the guarantee: one per floor from map 2 on, in the floor's
      first `trainers` room), `docs/design-spec.md` §7.
      Out of scope: the stock, the prices, `[Task-89]`'s drag itself, and the money a trainer drops.
      *Dependencies:* `[Task-89]` (the floating Mart panel this NPC opens), `[Task-91]` (the NPC
      layer, its panel and the roll the guarantee bypasses) and `[Task-82]` (the room roles and
      `TRAINER_ROOMS_PER_MAP` the guarantee reads). It adds no run field and draws no RNG.
      *(Batch 38)*
- [x] **[Task-93] The party-edit NPCs: the move tutor, the three re-rolls, the species swap and the
      sacrifice's second ability.** Five of the report's NPCs edit **a member**, and the run has the
      seams except the two facts they need to persist. A member is one `FighterSnapshot`
      (`RunPokemon`, `src/engine/run/progression.ts` 30-37); the edits are
      `editRunPokemon`/`updatePokemon`, `evolveMember` (`D38`), `equipMove` and the derived
      `learnsetPool` (`src/engine/run/learnset.ts` 66-86). What does **not** exist: a tutored move
      has nowhere to live — the pool is the level-up moves its species knows **at its level** plus
      the bag's TMs, so a move a tutor taught would vanish the moment it was unequipped — and a
      member carries one ability only.
      **Fix shape.** One member-edit transaction behind `[Task-91]`'s panel, one row per NPC, each
      drawing from the room's own `:npc:` stream and writing the snapshot:
      - **the move tutor** («artes marciales: enseña cierto movimiento») teaches one move from a
        data list, equipped into a free slot or replacing the chosen one.
      - **the nature re-roll**, **the ability re-roll** and **the IV re-roll** («cambiar naturaleza
        (random)», «cambiar habilidad (random)», «NPC de IVs») re-roll that field from the stream
        and rebuild the member's stats.
      - **the species swap** («mantiene habilidad y movimientos pero cambia de especie») keeps
        level, moves, ability, IVs, EVs and held item and re-derives stats and types.
      - **the sacrifice** — spawned by `[Task-98]`'s flawless mission — takes one random **bag
        stack** and grants one random row of the four above, the second-ability row writing
        `secondAbility` instead of re-rolling the first.
      Two persisted words are the price: `taughtMoves: string[]` joins `learnsetPool`, and
      `secondAbility: string | null` is read by the ability dispatcher beside `ability`. This is the
      plan's **next `SAVE_VERSION` step, 19 → 20**, after `[Task-98]`'s 18 → 19: an older save
      defaults to no taught moves and no second ability, the way every previous step does.
      **Docs:** `docs/design-spec.md` §3 (the panel's operations), `docs/routes-spec.md` §6,
      `docs/battle-spec.md` §7 (a tutored move and two abilities), `docs/tech-decisions.md`.
      Out of scope: the equip drag (`equipMove`), the level-up rule (`[Task-56]`, shipped), the
      evolution graph and the unequip (`[Task-68]`).
      *Dependencies:* `[Task-91]` (the panel and the roll) and `[Task-98]` (the sacrifice's
      flawless spawn). *(Batch 39)*
- [x] **[Task-94] The run-modifier NPCs: the exorcist, the weather man, the magician and the type
      gate.** Four NPCs write a fact that outlives the room, and the run keeps no record that does:
      the per-floor bookkeeping clears on `advanceMap` (`defeatedTrainers` / `pickedItems` /
      `capturedRooms`, `src/engine/run/state.ts` 102-107, 199-201) and nothing carries a curse, a
      forced field or a forced encounter type. `[Task-62]` ships the seam a battle-start condition
      rides (`BattleLaunch` → `BattleSetup` → `createBattle`), which three of the four need.
      **Fix shape.** One typed `RunState.modifiers` record:
      - `curse` — the exorcist's «el próximo combate enemigo empieza con 1 desventaja»: one negative
        stat stage on the enemy's lead, seeded through `BattleSetup`.
      - `forcedField` — «el del clima»: a weather, a terrain or a field id plus the floors left,
        seeded through the same setup; the id names a `ROOM_BATTLEFIELDS` row.
      - `nextWildType` — the magician's «elige el tipo del siguiente salvaje»: a type id consumed
        by the next wild roll, narrowing the band's table (`encounterTableFor`) **before** the
        draw, so a fixed seed's draw count does not move.
      The fourth row is the **type gate** («si tienes cierto tipo de Pokémon en party obtienes un
      objeto»): a party of the row's type earns an item through `[Task-91]`'s `partyHasType` and
      `addItem`, with no stored fact at all.
      This is the plan's **next `SAVE_VERSION` step, 20 → 21**, after `[Task-93]`'s 19 → 20.
      **Docs:** `docs/maps-spec.md` §7, `docs/battle-spec.md` §4, `docs/routes-spec.md` §3.
      Out of scope: the conditions themselves (`[Task-62]`, `[Task-106]`), the wild exclusion
      (`[Task-52]`), the level rule (`[Task-79]`) and the room a condition belongs to.
      *Dependencies:* `[Task-91]` (the panel and the roll), `[Task-62]` (the setup seam and the
      condition ids) and `[Task-79]` (the encounter resolution the type narrows). *(Batch 40)*
- [x] **[Task-95] The item-and-battle NPCs: the medic, the chef, the berry tree and the Mega Stone
      on a win.** Four NPCs whose content is an item or a battle, each needing one rule the tree
      does not have.
      **Fix shape.**
      - **the medic** («médico: cura 1 vez») heals party and box once through the shipped
        `src/engine/run/heal.ts`, recorded per floor through the `pickedItems` stable-id shape — no
        run field, and the record is what stops a second heal.
      - **the chef** («cambia cierto número de bayas por bufos temporales») trades a data number of
        berries for one **held** dish item in the new data row (`src/data/items.ts`) whose effect is
        the floor's buff: it rides the member like any held item, so no run field is added.
      - **the berry tree** («al sacudir da bayas hasta un límite random y aparece un salvaje con
        bufos que no se puede huir») rolls a data cap of berries, then fields a buffed wild through
        the normal encounter path with a `noFlee` flag on `BattleLaunch`/`BattleSetup` that
        `src/engine/battle/runAway.ts` reads; the Run Away ability and one data flee item are the
        two exceptions the report names.
      - **the Mega Stone on a win** («ganar combate da una megapiedra aleatoria») fields its own
        trainer and pays one stone from the shipped `MEGA_STONE_IDS` (`src/data/items.ts`) through
        `addItem` — it reads that list, it does not mint one.
      **Docs:** `docs/maps-spec.md` §7, `docs/battle-spec.md` §5 (the flight rule),
      `docs/routes-spec.md` §3.
      Out of scope: the item catalogue's own rows (`[Task-103]`), the Mart and the casino's egg.
      *Dependencies:* `[Task-91]` — the panel and the roll; none of these four rows is gated, so the
      party predicates never reach this task and it deliberately carries **no** edge to
      `[Task-65]` (the type gate is `[Task-94]`'s and the blocked rooms are `[Task-96]`/`[Task-97]`'s).
      *(Batch 41)*
- [x] **[Task-96] The static-species room, and the legendary room behind a flawless floor.**
      `[Task-65]` carves a gated pocket behind a **field move**; the human wants a room whose gate is
      a **party property** (a type or a feature) and whose prize is a **static species**, plus — on
      the same flawless trigger — a low-chance **legendary room**, once per run, from floor 4.
      **Fix shape.** One room kind built on `[Task-65]`'s carve/opening seam (`MapRoomSpecial` value,
      `mapView` marker, the per-floor opening record) and `[Task-91]`'s `partyHasType` /
      `partyHasAbility` for the gate; the far side holds one static species built at the squad's
      level with a run-seeded ability and moveset (`createFighter({ learnsetSeed: run.seed })`, D17)
      and fought through the normal wild path, so a catch spends the room's capture and `[Task-52]`'s
      record applies. The legendary room is the same kind with a `legendary` flag: it rolls only on
      a floor whose **flawless** mission completed (`[Task-98]`), only from map 4, and only while the
      run's completed-flawless count is one — which keeps "once per run" derivable from the mission
      record instead of a new field.
      **Docs:** `docs/maps-spec.md` §7, `docs/routes-spec.md` §3/§6, `docs/design-spec.md` §7.
      Out of scope: the catch's rules, the legendaries' ban (`WILD_BANNED_TAGS`), the obstacle art
      (`[Task-65]`) and `[Task-52]`'s exclusion.
      *Dependencies:* `[Task-65]` (the carve and opening seam), `[Task-91]` (the party predicates) and
      `[Task-98]` (the flawless mission's record). It adds no run field: "once per run" is the mission
      record's own completed count. *(Batch 43)*
- [x] **[Task-97] The secret shop: several held items and TMs behind a condition.** The human's row
      is «tienda secreta con varios equipables y MTs (condición por decidir)» — the content is
      settled, the gate is not.
      **Fix shape.** A special leaf whose counter stocks a data list of several held items and TMs
      (a `SECRET_SHOP` table beside `src/data/shop.ts`, prices from the catalogue), built on the
      Mart panel `[Task-89]` ships and the special-room layer `[Task-92]` leaves behind. **The gate is a
      blocked room, not a move gate** (the human's answer: «que sea una habitacion especial de las
      bloqueadas con obstaculo que se pasa si tienes cierto tipo de poke segun el obstaculo»): the leaf is
      carved with an obstacle whose **type** the row names, and it opens only while the party holds a
      member of that type — the same party predicate family `[Task-91]` adds and `[Task-96]` reuses, so
      the secret shop is a sibling of the static-species room rather than of `[Task-65]`'s own
      bush/rock/water leaf (which is also a type gate, one obstacle per room and one reward).
      **Docs:** `docs/maps-spec.md` §7, `docs/design-spec.md` §7.
      Out of scope: the Mart's four-row stock, the TM catalogue (`src/data/tms.ts`), and the
      merchant (`[Task-92]`).
      *Dependencies:* `[Task-92]` (the shop room it replaces is gone, so this task must be written
      after it) and `[Task-91]` / `[Task-96]` (the type-gated obstacle seam). It adds no run field.
      *(Batch 44)*
- [x] **[Task-98] The floor-mission framework.** The human wants floor missions whose completion
      pays a **fixed** reward — «cumplirlas da recompensa (fija: no perder vida → aparece una sala
      especial)» — and today a floor has no objective at all: the only per-floor facts are the
      bookkeeping lists (`src/engine/run/state.ts` 102-107, 199-201) and `advanceMap` (185-204).
      **Fix shape.** One pure `src/engine/run/missions.ts` + test and a `MISSION_TABLE` in
      `src/data/missions.ts` + test (+ its `src/data/README.md` line). The first kind is `flawless`:
      end the floor without losing HP, read from a per-floor HP-lost fact plus `stats.casualties`;
      the mission is chosen per floor from the `map` stream, evaluated on `advanceMap`, and
      `RunState.mission` (`{ id, progress, completed }`) plus the **run-scoped counter** of completed
      missions (`missionsCompleted`, the field `[Task-96]` reads for its "once per run") is this
      plan's **next `SAVE_VERSION` step, 18 → 19** — an older save starts with no mission and a zero
      counter. The HUD shows it in one line, and completion raises a beat through the shipped
      `src/ui/notice.ts` — a fourth string in that module, per its own one-module-N-strings
      convention, with its own `notice.test.ts` case and an i18n key in `src/i18n/en.ts` / `es.ts` —
      and the reward is a data row (`{ kind: 'room' | 'item' | 'money' }`) the room tasks read:
      `[Task-96]`'s legendary roll and `[Task-93]`'s sacrifice both hang off a completed `flawless`.
      **Docs:** `docs/routes-spec.md` §4/§6, `docs/design-spec.md` §7, `docs/maps-spec.md` §7.
      Out of scope: the missions' own rewards beyond the data row, and the rooms that consume them.
      *Dependencies:* none — the floor advance, the casualty counter and the notice module are shipped.
      It owns `src/engine/run/state.ts` + test, `src/engine/save.ts` + test, `src/ui/notice.ts` + test
      and the two i18n tables, none of which its Batch 36 mate `[Task-83]` touches. *(Batch 36)*
- [x] **[Task-99] The special trainers: invisible ninjas, the all-Impostor trainer and the
      conditional secret battle.** Three wishes that are a **spawn rule** and an **archetype
      override**, not new mechanics: trainers are placed by the population pass (`[Task-82]` makes
      the rooms) and their abilities are **rolled** (D17, `randomAbility`), while the engine already
      models Imposter/Transform (`transformInto`, `src/engine/battle/fighter.ts` 609-648; the
      handler at `effects/abilities.ts` 2180).
      **Fix shape.** `TrainerArchetype` (`src/data/trainers.ts` 31-56) gains the three fields the
      rows need — a sight mode (`invisible` for the ninja), a forced ability (`Imposter` for the
      training row, bypassing the roll) and a reward row — and `src/engine/routes/trainers.ts`
      places them under a condition: the ninja's room hides its sprite until it is adjacent, the
      Impostor trainer pays on defeat through `addItem`, and the **secret battle** is the third row
      (it appears only when `[Task-98]`'s mission record says the floor's condition holds). The
      Imposter battle reads today's transform path, so the task **adds no ability handler** and no
      coverage row.
      **Docs:** `docs/routes-spec.md` §2/§5, `docs/battle-spec.md` §9, `docs/design-spec.md` §7.
      Out of scope: the trainer rooms' composition (`[Task-82]`), the roster's levels (`[Task-78]`)
      and the ability registry.
      *Dependencies:* `[Task-82]` (the rooms the spawn rule reads) and `[Task-98]` — the secret
      battle's third row reads the mission record that task ships (Batch 36), so the edge is real
      rather than a batch-order note. It adds no run field. *(Batch 42)*
- [x] **[Task-100] The boss room's own rules: a forced opening condition, a sealed door and a free
      heal.** Three rows of the human's list are the boss room's: «el jefe siempre produce desventaja
      o ventaja inicial», «al entrar al jefe ya no se puede salir» and «te cura gratis». Today the
      boss room is a quiet leaf sealed at the portal (D31), the heal stop is the **map advance**
      (`advanceMap`) and the battle starts clean unless a room condition rolled (`[Task-62]`).
      **Fix shape.** A two-sided `BOSS_OPENINGS` row set in `src/data/bosses.ts` (one favouring the
      run, one the boss), the boss's launch always taking one through
      `src/engine/routes/battlefield.ts` (Task-62's file, extended) instead of rolling the ordinary
      chance; the **seal** as a room rule read by `tryLeaveRoom` — no field, because the boss's own
      `bossDefeated` flag is the key that reopens it; and **one** heal when the room is built,
      through the shipped `src/engine/run/heal.ts` (HP/PP only, never a resurrection, D5).
      **Docs:** `docs/maps-spec.md` §6/§7, `docs/battle-spec.md` §4.
      Out of scope: the boss's roster and its size (`[Task-71]`, shipped), the portal's own rule,
      and the conditions themselves (`[Task-62]`, `[Task-106]`).
      *Dependencies:* `[Task-62]` (the launch seam) and `[Task-106]` (the table rows it draws from).
      *(Batch 45)*
- [x] **[Task-101] The room that bans the squad's most-used species.** «Bloquea la especie más usada
      en una habitación o combate» needs a fact the run does not keep: which member has fought most.
      A member carries no counter (`RunPokemon` is `{ fighter, caughtAt? }`, `progression.ts` 30-37)
      and `RunStats` is run-wide.
      **Fix shape.** `battlesUsed` on the member, bumped by the battle fold (the same fold that
      resolves XP, `src/engine/run/resolve.ts`), as this plan's **next `SAVE_VERSION` step,
      21 → 22**, after `[Task-94]`'s 20 → 21; a special leaf whose `BattleLaunch` carries the ban
      (the run's most-used member's species id) and whose `BattleSetup` carries it into the battle,
      where the switch and send-out path refuses that species (`src/engine/battle/commands.ts`) while
      the room's battle runs. The ban never touches the run's party outside the room.
      **Docs:** `docs/battle-spec.md` §2, `docs/maps-spec.md` §7.
      Out of scope: the roster, the wild table and the party/PC panel.
      *Dependencies:* none — the fold, the launch and the special-room layer are shipped.
      *(Batch 46)*
- [x] **[Task-102] The puzzle rooms: the boss room's puzzle and the rooms that pay an item.** The
      human allows either («habitación de jefe con puzle, o habitaciones con puzles que dan
      objetos»), and no room holds a puzzle today: the tile vocabulary is `FLOOR/WALL/EXIT/...`
      (`src/engine/map.ts` 5-14) and the interact key walks entities.
      **Fix shape.** One pure `src/engine/routes/puzzle.ts` + test (a switch/plate/rock sequence the
      room is carved with, its solved predicate pure over the `RouteMap`) and a `PUZZLES` table in
      `src/data/puzzles.ts` + test (one row per puzzle, its reward item). The scene builds the
      room's puzzle on the special pass's shape (`MapRoomSpecial` value + `mapView` marker) or in
      the boss room, pays through the shipped ground-item path, and records the solve per floor with
      a stable room-scoped id through `pickedItems` — no run field. A wrong solve resets the
      sequence (data), so a fixed seed's room is still reproducible.
      **Docs:** `docs/maps-spec.md` §7, `docs/routes-spec.md` §2.
      Out of scope: the boss's own roster and condition (`[Task-100]`), the gated room
      (`[Task-65]`) and the obstacle art.
      *Dependencies:* none — the tiles, the special-room layer and the ground-item path are shipped.
      *(Batch 47)*
- [x] **[Task-103] The item catalogue's fourth wave: the Tera Crystal, infinite held items, the
      coloured candy and the three one-route consumables.** Four item wishes on one seam.
      **Fix shape.** Four rows.
      - **The Tera Crystal** («objeto equipable cristal teratipo: cambia el tipo») is a `held` item
        carrying a `teraType`; one handler in `src/engine/battle/effects/items.ts` replaces the
        holder's types at battle start, and the party detail reads the same override so the panel
        and the battle agree.
      - **Infinite held items** («equipables con uso: hacerlos infinitos»): a consumed held item
        must stop being destroyed by the fold. The battle's `spend` (`effects/items.ts` 228-269)
        stays as today — a berry fires once per battle — but `resolve.ts` keeps the run member's
        `heldItem` instead of taking the returned snapshot's `null`, so the item is back next
        battle. One line plus its test.
      - **The coloured candy** («caramelo de colores: da 1 stat random +1 o −1 permanente»): the
        human's answer is that **each run rolls which stat each colour raises**, and the player does
        **not** know it until they try that colour — once tried, the bag row's description names it
        («al probarlo en la descripcion del objeto sale ya que lo sabes»). So the mapping is a **per-run
        seeded table** (`Rng(seed : candy : <colour>)`) and the run keeps the set of colours
        **discovered** so far; the effect is a permanent ±1 read by `statAtLevel` from a new
        `FighterSnapshot.statTreats`. This is the plan's **next `SAVE_VERSION` step, 22 → 23**, after
        `[Task-101]`'s 21 → 22, and the step carries **both** the treats and the discovered-colour set.
      - **The three one-route consumables** («objeto que hace lo del exorcista / clima / médico como
        consumible de 1 ruta») are the exorcist's, the weather man's and the medic's effect in a
        bottle: they write `[Task-94]`'s modifiers or call `[Task-95]`'s heal, never a second
        implementation.
      **Docs:** `docs/data-spec.md` (the catalogue), `docs/battle-spec.md` §2/§5/§9.
      Out of scope: the ability waves (`[Task-104]`), the held-item catalogue Task-07 shipped and
      the shop's stock.
      *Dependencies:* `[Task-87]` (the route use path and `src/engine/run/items.ts`), `[Task-94]`
      (the modifiers the consumables write), `[Task-95]` (the heal they reuse) and `[Task-106]` — the
      Tera Crystal's holder override is the same "wherever a fighter's types are read" reader that
      task freezes (Batch 32), so the two cannot be written independently of each other. *(Batch 47)*
- [x] **[Task-104] The damage-model abilities: the type-chart-breaking pair, and the four team-type
      bonuses.** *(Split on `2026-10-25` into `[Task-150]`, `[Task-151]`, `[Task-153]` and
      `[Task-154]` — see the decision line at the end of this entry.)* Two rules the damage model cannot express. Nothing in `src/engine/battle/damage.ts`
      can ignore the type chart, and the run's party composition never reaches a battle
      (`BattleSetup` carries no team fact, `src/engine/battle/state.ts` 120-128).
      **Fix shape.** The **two abilities** the human asks for («pokes oscuros: habilidad que ignora
      la tabla de tipos (ni debilidades, ni resistencias, ni inmunidades) + otra»): the first reads
      before `typeEffectiveness` in `damage.ts` and returns neutral, the second is named at cut
      time from the same seam; both join `effects/abilities.ts` + the registry and regenerate
      `docs/balance/effect-coverage.md`. The **four team rules** are one rule over a team-type count:
      `BattleSetup.teamTypes` is filled by the launch from the party's **living** members, and two
      living Fire members give a Fire move **+10 %** damage and **+20 %** burn chance, with Ice
      (freeze), Electric (paralysis) and Poison (poison) the same. The status chance is one helper
      `turn.ts` shares with the existing secondary roll, so the two can never disagree.
      **Docs:** `docs/battle-spec.md` §10/§11, `docs/balance/effect-coverage.md` (regenerated).
      Out of scope: the room conditions (`[Task-62]`, `[Task-106]`) and the type chart itself.
      *Dependencies:* none — `damage.ts`, the registry and the coverage table are shipped. It adds no
      run field. *(Batch 31)*
      **BLOCKED (`2026-10-19`, on the plan's own content check): the two "dark" abilities have no
      dex row and the second has no name.** `randomAbilityPool`
      (`src/engine/battle/randomAbility.ts`, 31-40) only keeps a registry id that `getAbility`
      resolves, and `src/data/dex/abilities.json` is generated from `@pkmn/dex` by
      `npm run data:dex` — no Gen 9 row ignores the type chart, and this entry leaves the second
      ability "named at cut time". An invented id is therefore a dead id no run can ever draw,
      and which ability it is — plus where its row lives — is content, not a path: a human
      decision (the two names/ids/descriptions and the data seam: a hand-authored custom-ability
      table the generated dex accepts, or two existing ids with exact semantics). The same
      blocker is recorded in Batch 29's and Batch 30's fill records. The task stays out of the
      queue (`[!]`) until it is answered; its Batch 31 mate `[Task-89]` shipped alone.
      **Decision (`2026-10-25`): split, and the dark rule is two abilities, not one.** The human's
      wish is that a **dark Pokémon carries the type-chart-ignoring ability *and* a second, random
      one**, so the entry divides into `[Task-150]` (the four team-type bonuses — fully specified, no
      content gap), `[Task-151]` (the custom `darkmatter` row: one hand-authored ability table the
      generated dex accepts, with its `onModifyEffectiveness` handler), `[Task-153]` (the engine's
      second ability slot) and `[Task-154]` (the dark flag on the run's members, which is what makes
      the pair spawn). The four team rules ship first and nothing here waits on a dump or a name.
- [x] **[Task-107] The 2vs2 boss battle, engine half: the double-battle rules.** The human's last
      and largest wish — «Bosses 2vs2» — cannot ride on today's engine: every side is one active
      (`activeFighter(state, side)`, `src/engine/battle/state.ts`), a command carries no target and
      the order sorts two actives. It is cut as **two tasks**, this one pure and `[Task-108]` the
      screen, because a single task would carry the whole battle engine and the whole battle scene.
      **Fix shape (the subtasks, in order).**
      1. **Two actives per side.** The active slot becomes an ordered pair (one live index per slot)
        and the four accessors (`activeFighter`, `hasHealthy`, `switchIn`, `faint`) widen; every
        caller in `src/engine/battle/**` moves with them.
      2. **Targeting.** A `TargetRef = { side, slot }`, a `targets` field on `FightCommand`, and
        `chooseTarget` validating adjacency (a single-target move hits the opposite slot, a spread
        move both) from the dex's own `target`.
      3. **Order.** `orderActions` sorts four actives (Speed, priority, Trick Room) and the turn
        loop applies one command at a time.
      4. **Partner AI.** `chooseAiCommand` per enemy slot, with the partner's own target choice (the
        shipped scorer, D46, run once per slot).
      5. **Faints and switches.** A side fights while either slot lives; a switch fills the empty
        slot; a double faint ends the side; the run's permadeath fold stays as it is.
      6. **Data.** `src/data/bosses.ts` gains the boss's `double` flag and the double roster's size,
        so the rule is data and the single battles never move.
      The single-battle path stays the **default** (`BattleSetup.double` false), so no existing
      golden test or fixed seed changes; the double regressions are new fixed-seed battles.
      **Docs:** `docs/battle-spec.md` (a new section for the double battle).
      Out of scope: the screen (`[Task-108]`), the boss's roster (`[Task-71]`, shipped) and the
      room's condition (`[Task-100]`).
      *Dependencies:* none, but it is written **against** every battle rule shipped so far, so it
      is cut last: **Batch 49**. It adds no run field. *(Batch 49)*
- [x] **[Task-108] The 2vs2 boss battle, the screen: two actives on each side.** The visible half of
      the human's «Bosses 2vs2», written against `[Task-107]`'s shipped engine.
      **Fix shape (the subtasks).**
      1. the **second enemy battler** and its own HP panel, side by side on the foe's platform;
      2. the **player's second panel** beside the first, with the same layout budget
        (`PLAYER_PANEL_H` 150 after `[Task-77]`);
      3. the **target choice** on the FIGHT menu — a second step after the move grid, drawn with the
        shipped `src/ui/moveGrid.ts` helpers rather than a new grid;
      4. the **partner's command row** on the player's side, so the second active is commanded;
      5. the **switch window** (`src/ui/partyGrid.ts`) filling two slots;
      6. the **bag, run and the entry beat** on a double battle (`src/ui/beats.ts` gains the second
        send-out);
      7. the run's **launch** marking the boss's battle double (`src/scenes/RouteScene.ts`'s
        `startBattle`, from `[Task-107]`'s data flag).
      **Docs:** `docs/design-spec.md` §4 (the battle's windows), `docs/battle-spec.md`'s double
      section.
      Out of scope: the engine rules (`[Task-107]`), the boss's own condition (`[Task-100]`) and the
      battle's info window (`[Task-60]`, shipped).
      *Dependencies:* `[Task-107]`. It adds no run field. *(Batch 47, filled)*
- [x] **[Task-109] An area-entry panel: a temporary floating panel on entering a route.** Reported as
      «añadir panel flotante temporal al entrar en una ruta como en los juegos originales» — the
      originals greet an area with a **boxed banner** naming it, and this game already holds the
      string with no banner to wear it: the run's transient notices are one-line entries in
      `src/ui/notice.ts` (catch, pickup, level-up, `NOTICE_HOLD_MS`) drawn by
      `RouteScene.buildNotice` / `showNotice` as an FRLG **textbox** strip
      (`addFrlgWindow(..., 'textbox')` over `NOTICE_W` / `NOTICE_H` / `NOTICE_TOP`) on the pinned HUD
      camera, while the HUD header already prints the area through
      `t('route.mapTitle', { map, biome })` (`refreshHud`) with the biome's own name from
      `getBiome(biomeId).name` (`src/data/biomes.ts`).
      **Fix shape.** One **area panel**, raised from the room-change paths — `applyRoute`,
      `transitionTo` and `advanceMap` — that draws a **boxed** panel (`addFrlgWindow` with the
      `'window'` skin, *not* the notice strip's `'textbox'`) carrying the area's name in the
      originals' banner style and wearing the **accent border** the panel mock froze — the one card
      whose hairline is the accent rather than `rgba(255,255,255,0.16)` (`[Task-58]`, Batch 20) — and
      that **dismisses itself** after a hold of its own (a constant
      beside `NOTICE_HOLD_MS` in the same module) and takes no key, because the route scene's only
      keyboard surface is the pause menu (`[Task-84]`'s frozen rule, Batch 29).
      **The notice module gains the row.** Per its own convention — one module, N strings, "every
      later notice is a string in this module rather than a second transient window" —
      `src/ui/notice.ts` gains an `areaEntryNotice(...)` builder beside the three that ship (Batch 7,
      extended in 15 and 16) with its own case in `notice.test.ts`, and the copy is an **i18n key**
      authored in `src/i18n/en.ts` and overlaid by `src/i18n/es.ts`; the area's own name is the
      biome string the header already reads (the dex's names stay English, D43).
      **The one open reading, with its written default.** Does it fire on **every room** entered, or
      only when the **area (map) changes**? The originals fire **once per area** (they have no
      per-room banner), while the report's own words are «al entrar en una ruta» and a route is a
      room. The written default is therefore **every room**, raised on each room change
      (`applyRoute` / `transitionTo`) *and* on the floor advance (`advanceMap`, where the number in
      the header moves too); the alternative is the originals' own reading — **only when the map
      changes** — which is one comparison on the same seam (the room's `mapIndex` against the
      previous one) and one fewer beat per room. Say which before its branch is cut; nothing else in
      the plan changes either way.
      **Docs:** `docs/routes-spec.md` §6 (the transient notices) and `docs/design-spec.md`'s route HUD
      section.
      Out of scope: the three notices that ship, the battle scene's own beats
      (`src/ui/beats.ts`), the room's contents, and the HUD header's own area string.
      *Dependencies:* none — the notice module, the chrome (Batch 20's re-tune included) and the i18n
      table (Batch 10) are all shipped, and it is written **against** `[Task-84]`'s pointer-first rule
      (Batch 29) and the `notice.ts` row `[Task-98]` adds (Batch 36). It claims
      `src/scenes/RouteScene.ts`, so it opens the plan's new **Batch 51**, one batch behind the 2vs2
      pair — and it adds no run field. *(Batch 47b, filled)*
- [x] **[Task-110] The item bag is an icon grid, in the route HUD and in battle.** The human's rule:
      «la mochila de items y en combate pasen a ser grid». Both bag surfaces are **lists of rows** today:
      the route HUD draws up to `HUD_BAG_ROWS` (6) name rows with a pocket tab strip and the money line
      (`RouteScene`'s bag panel, `HUD_BAG_HEADER` / `HUD_BAG_ROW`), and the battle draws the active
      pocket's stacks as a list inside the menu window (`BattleScene.openBag` ~1719 and its bag render
      ~2898-2930), both over the same model (`src/ui/bag.ts`: `BAG_CATEGORIES`, `bagForCategory`,
      `bagCategoryFor`, `stepBagCursor`).
      **Fix shape.** One **grid renderer** both scenes draw: fixed-square cells holding the item's
      **icon** (`itemIconFrame`, the Añil 24px atlas, `src/data/itemIcons.ts`) with a small **count
      badge** in the corner, the pocket tabs above (the shipped `BagCategory` strip) and the money line
      (route) or the selection detail (battle) below. A selected cell is the shipped accent fill plus
      outline; an empty cell is a dim outline. The cursor steps by column and row (a pure
      `stepBagGrid` beside `stepBagCursor`, tested), a **click** selects a cell, and the confirm /
      interact applies it exactly as the row list does today (equip on a member, use on a member, throw
      a ball in battle); the pocket tabs and the ball pocket's wild-only rule do not change. The grid is
      **five fixed columns** (the human's pick) with cells that keep their aspect, sized from its panel.
      **The selected cell describes itself in a floating panel** (the human's pick): a small card beside
      the grid — the shared info-popup shape `src/ui/abilityInfo.ts` and the move ⓘ draw, never a line
      inside the bag — so the grid itself stays icon-only, showing the item's name and its catalogue
      description. For a **coloured candy** (`[Task-103]`, Batch 47) the card reads the run instead:
      when the colour is in `run.discoveredCandy` it prints the run's own stat through `candyTreat`
      (its i18n key is this task's), which is where «al probarlo en la descripción del objeto sale ya
      que lo sabes» lands.
      **The grid takes a filter field** (the human's rule: «añadir input texto para filtrar»): one text
      input above the grid, the same look and height as the MOVES tab's shipped search field
      (`RouteScene.hudSearchBg` / `hudSearchText` over `HUD_DETAIL_SEARCH_H`, `typeInDetailSearch`,
      `detail.searchMoves`), filtering the visible cells by the item's **name** (a case-insensitive
      substring) on both surfaces. The pure filter lives beside the bag model
      (`src/ui/bag.ts`'s `filterBagStacks(stacks, query)`, tested) so the scene only draws; a new i18n
      key (`hud.searchItems`) is authored in `src/i18n/en.ts` and overlaid by `es.ts`; and while the
      field has focus it owns the keyboard exactly as the two shipped fields do (`textFieldFocused`), so
      it adds no new input mode. **In battle the field is that scene's first text input**, so its own
      `keydown` handler (`BattleScene` ~996) must route typing to it while focused and keep the command
      shortcuts off — the one real cost the battle surface adds.
      **It draws with `[Task-58]`'s tokens** (surface, hairline, selected fill + accent outline), so it
      lands **after** the chrome re-tune, and it follows the fixed-cell precedent `[Task-34]` set for
      the battle SWITCH grid rather than reading it.
      **Docs:** `docs/design-spec.md` (the route HUD's bag and the battle's BAG) and `docs/data-spec.md`
      (the item icons).
      Out of scope: the bag's model and pockets (`src/ui/bag.ts`'s category rules), the item catalogue,
      the Mart and the reward panels (`[Task-89]`, floating cards whose rows stay rows), and the
      X-items' deletion (`[Task-87]`).
      *Dependencies:* `[Task-58]` (the tokens it draws with). It claims `src/scenes/RouteScene.ts`
      **and** `src/scenes/BattleScene.ts`, so it opens the plan's next batch after `[Task-109]` —
      **Batch 52** — and it adds no run field. *(Batch 52)*

- [x] **[Task-115] The casino's equipable row is one grouped row, and it follows the Mart's banded pool.**
      The human's rule: the machine's **fixed held item** becomes a **random one of that
      band**, so a newly shipped equipable reaches the machine the same way it reaches the
      Mart — by being banded in `SHOP_ROTATION` — with no second balance table and no edit to
      `CASINO`. The band's own shelf is the only ranking that exists: almost every competitive
      held row is a flat 4 000 (`src/data/items.ts`), so a price window could not separate a
      Wide Lens from a Life Orb. Today every band names its equipable outright (`mid` charcoal,
      `high` Expert Belt, `late` Life Orb, `end` Leftovers, `src/data/casino.ts`) — the table
      `[Task-64]` shipped — so a new equipable is invisible to the machine until someone edits the
      casino table, and `early` and `low` carry no equipable row at all.
      **Fix shape.** `CasinoPrize` gains a third kind, **`'held'`** — a row that names **no
      `itemId`**, exactly as `'egg'` does — and each band's fixed equipable row becomes that one
      grouped row at weight 1 (`early` and `low`, which have none, gain the row instead). The
      pick is made **inside the spin's own stream**: when the grouped row lands, `casinoSpin`
      takes **one extra `rng.int(0, pool.length - 1)`**, and nothing else moves, because the
      stream is `Rng(hashSeed(`${seed}:casino:${mapIndex}:${index}`))` — one per spin — and that
      draw is the spin's last. `casinoHeldPool(band)` (new, exported from `src/ui/casino.ts` +
      test) is `SHOP_ROTATION[band]` filtered to `getItem(id)?.consumed !== true` and to ids
      `UNMODELLED_ITEMS` (`src/engine/battle/effects/items.ts`) does not list, **in table
      order**; every listed equipable carries weight 1, so the pick is uniform over the pool in
      table order and the shelf's own weight column is not read. `early` and `low` have no
      non-consumable row, so the grouped row falls back to the **first band above with one** —
      `mid` today (charcoal, mysticwater, widelens, muscleband, wiseglasses, ironball,
      laggingtail) — which is what makes an equipable "possible but rare" on the on-ramp instead
      of exposing a Life Orb on map 1. `CasinoOutcome` does not change: a grouped row resolves to
      `{ kind: 'item', itemId }` before the spin returns, so every existing reader — and
      `[Task-116]`'s window — sees one paid item id.
      **The table, measured.** A row's absolute probability is `0.85 × weight / total`. With the
      fixed row replaced at weight 1 and every other row keeping its weight, the grouped row is
      **7.1 %** of spins at `early` (11 → 12 total), **8.5 %** at `low` (9 → 10), **12.1 %** at
      `mid` and `high`, **10.6 %** at `late` and `end`, and each equipable is ≈ 1.0–2.4 % of
      spins. Only those two totals move, so the other rows of `early` and `low` lose a little
      share (11 → 12 and 9 → 10) while every other band's rows keep theirs. One spin's expected
      recovery (expected resale plus the grunt's 15 % purse, over the price) becomes early
      **63 %**, low **108 %**, mid **105 %**, high **75 %**, late **88 %**,
      end **71 %** — the Nugget alone is 61 % of the price at `low` and `mid` (8.5 % / 12.1 % ×
      5 000). The two bands over break-even are therefore **diluted before shipping**: `low`
      becomes superpotion 4, greatball 4, oranberry 2, nugget 1, held 1, egg 1 (13 rows, grouped
      6.5 %, recovery ≈ 90 %) and `mid` hyperpotion 3, greatball 3, held 1, nugget 1, egg 1
      (9 rows, grouped 9.4 %, recovery ≈ 91 %); `early`, `high`, `late` and `end` ship the first
      table as measured. The removed fixed ids (charcoal, expertbelt, lifeorb, leftovers) still
      reach the machine through the pool.
      **Fixed-seed re-pin.** `src/ui/casino.test.ts` re-reads its `pkm-64` map 5 pins: spin 3
      was the fixed Life Orb and is now the grouped draw, so the test's comment records the new
      id the way the file already pins `nugget → ultraball → …`. The fourth spin (the Egg) and
      the reload rule do **not** move — each spin mints its own stream, so the extra draw cannot
      reach another spin — and the file records that a **re-banding of `SHOP_ROTATION` now moves
      a fixed seed's spin** — a deliberate re-pin, not a defect. `src/data/casino.test.ts`
      re-pins its counts (one Egg, one grouped row and the named items per band), and
      `src/ui/casino.test.ts` pins `casinoHeldPool` per band: the exact filtered list, non-empty
      for every band through the fallback, and every id modelled and non-consumed — so a new
      banded equipable changes the pool with no code edit.
      **Docs:** `docs/maps-spec.md` §7 — the room table's **casino row**, and the
      `### The casino (the slot machine)` **prize bullets** and **probability sentence** (a row's
      absolute chance, the grouped row's share, the Nugget's); `docs/balance/economy.md`'s new
      **The casino's spin** section after **Between-route rewards** (price, rows, grouped share
      and recovery per band); `src/data/README.md` (`casino.ts`'s row: the grouped kind) and
      `src/ui/README.md` (`casino.ts`'s model line: the pool and the extra draw).
      Out of scope: the animation (`[Task-116]`), the rocket's placement (`[Task-117]`), the
      Mart's own stock and `SHOP_ROTATION` itself (this task reads it), the price table
      (`CASINO.price` does not move) and the grunt battle.
      *Dependencies:* none — the model, the table, the shop rotation and the item catalogue are
      shipped. It adds no run field and no `SAVE_VERSION` step, and it claims no scene, so it
      extends no queue. *(Batch 54)*
- [x] **[Task-116] The casino window is the slot machine, and its three item reels spin.**
      The human's correction is explicit: the visual is a **slot machine whose reels show three
      drawn items** («mejor reescribe en vez de ruleta que el visual sea una maquina tragaperras
      con dibujo de tres items»), and **the Team Rocket icon is the battle's face** («icono team
      rocket es para el combate»). Today the window is a 460×220 `RoomPanel` with a title, the
      money line, two 44 px rows (`SPIN ¥<price>`, `LEAVE`) and one message line
      (`src/scenes/rooms/casino.ts`, `[Task-64]`'s window in the `D47` descriptor `[Task-111]`
      shipped); the minimap glyph already draws three reels, and that glyph's cabinet is the
      machine's face.
      **Fix shape.** The card becomes the machine's own view: a cabinet and **three reels** in the
      `src/ui/frlg.ts` style — **no wheel**: every face is a **drawn item** (`itemIconFrame`,
      `src/data/itemIcons.ts`), the paid item repeated on all three reels when the spin pays an
      item, the Egg's icon when it pays an Egg, and the **Team Rocket icon** on all three reels
      when the outcome is the grunt fight — the face comes from the `rocket` row of the packed
      overworld atlas (`overworldSpriteFrame('rocket')`, the same frame the room's own grunt
      sprite draws, its red tint fallback included), clipped to the reel window. `SPIN` and
      `LEAVE` stay the two actions and the money readout is kept; the two rows become
      **clickable** (the window's keys stay as they are — up/down, the interact key confirms,
      `Q`/cancel leaves), in line with `[Task-84]`'s pointer-first rule.
      One new **pure** module, `src/ui/casinoReels.ts` + test, holds the geometry and the
      schedule — `REEL_COUNT = 3`, `REEL_SPIN_MS = 800`, `REEL_STOP_STAGGER_MS = 160` (the last
      reel stops at **1 120 ms**), `reelFace(outcome)`, `reelStrips(band, outcome)` and
      `reelStopAt(reel)` — and the scene only draws it, so the reels are headless-testable and
      the scene keeps no arithmetic. The decoy faces are the band's own rows (the named prize
      ids and `casinoHeldPool(band)`), so every face has an icon and the strip never invents a
      face the machine cannot pay.
      **The rule that must not move.** `casinoSpin` resolves the outcome **before** any
      animation: it spends the price, writes the floor's spin mark and, on a battle, writes the
      floor lock, all in the run it returns. `host.commitRun(spin.run)` is therefore called
      **before the first frame**, and the animation is a **reveal of a result already booked** —
      it never calls `casinoSpin` again, so a reload or a room change mid-spin can neither
      re-roll nor refund. A reloaded run finds the spin marked and, on a battle, the machine
      locked, exactly as a reload after the battle starts does today; the grunt fight is not
      re-offered, and that is the accepted cost of the reveal, not a new fact to store. The final
      faces are the **outcome** — the paid item's icon, the Egg's icon, or the Team Rocket icon
      for the grunt fight — and the strip's passing faces are the band's own item icons,
      decorative only and never deciding a payout, so the reels cannot show a Potion and pay a
      Nugget, and the Rocket icon can only land on a fight.
      **Presentation pinned.** Input is **locked while spinning** (the rows, `LEAVE` and cancel
      are ignored; `SPIN` cannot be pressed twice); a **skip** — a click or the interact key —
      reveals the result instantly; the base spin is 800 ms and the reels stop **left to right**
      at 160 ms intervals, so the whole reveal is 1 120 ms (inside the 600–1 200 ms range); the
      result line reuses `notice.itemObtained` with the item's icon (`itemIconFrame`,
      `src/data/itemIcons.ts`) and name, so the panel speaks one string path; and the **battle**
      outcome closes the window at the end of the reveal and calls `startTrainerBattle` with the
      same `gruntFor(host)` as today, so the fight, its id and its lock do not move.
      **No setting.** `src/settings.ts` has no reduced-motion switch and this task adds none: the
      skip is the accessibility path, and a motion preference is out of scope.
      **Docs:** `docs/maps-spec.md` §7's `### The casino (the slot machine)` **window
      paragraph** (the title, the money, the two rows and the message line become the cabinet,
      the reels and the reveal); `docs/design-spec.md` §7's **casino bullet**;
      `src/scenes/rooms/README.md` (`casino.ts`'s line: the window is the reels and the reveal);
      `src/ui/README.md` (the new `casinoReels.ts` line).
      Out of scope: the table, the grouped row and the economy (`[Task-115]`), the rocket's
      placement and the room's retirement (`[Task-117]`), a reduced-motion setting, and any new
      player-facing string (`casino.*` and `notice.itemObtained` already carry the window's copy,
      so `src/i18n/` is untouched).
      *Dependencies:* `[Task-115]` — the grouped row is one of the faces the reels can land on,
      and the window is written against the table's final rows. It adds no run field, draws no
      new RNG (the reveal reads the booked outcome) and claims no
      `src/scenes/RouteScene.ts`. *(Batch 55)*
- [x] **[Task-117] Team Rocket is a special NPC who carries the slot machine, and the casino room retires.**
      The human's words: «rocket no es sala especial es npc especial» and «es npc que pagas para
      tirar de ruleta». Today the casino is a **special room**: `'casino'` in `MapRoomSpecial`
      (`src/engine/maps/plan.ts`), a 30 % leaf from map 2 drawn between the mega-stone and the
      gated leaves, a descriptor module that places the cabinet and the grunt and opens the
      window, and a minimap glyph. The move mirrors `[Task-92]`'s for the merchant: the **room**
      goes, the **NPC** stays; the descriptor layer is `[Task-111]`'s (`D47`), and every other
      leaf it carries — `[Task-97]`'s secret shop included — is untouched.
      **Fix shape.** The `'casino'` kind leaves `MapRoomSpecial`; `planMap` loses `CASINO_CHANCE`,
      `CASINO_FROM_MAP` and the `addSpecial('casino', …)` call, so the special pass runs shop →
      mini-boss → mega-stone → gated → trade → no-heal. Everything drawn **before** the casino's
      slot — the shop, the mini-boss, the mega-stone, every regular room, room id and size —
      stays put; the three leaves drawn **after** it (gated, trade, no-heal) consume the values
      the casino used to take, so their presence and parents move for a fixed seed and are
      **re-pinned**. The room module and its test leave `src/scenes/rooms/` — the
      window is **moved**, not rewritten: `src/scenes/rooms/casino.ts` becomes
      `src/ui/rocketPanel.ts` through a `git mv`, keeping `[Task-116]`'s machine, its reels and
      its reveal and dropping only the descriptor (`fixture`, `interact`, `drawFixture`,
      `drawMarker`), and `registry.test.ts` loses its casino fixture. `src/ui/mapView.ts` needs
      **no edit**: `MapRoomMarker` is `MapRoomSpecial`, and `RouteScene` draws a marker through
      the registry's `byMarker` lookup, never a per-kind switch, so the glyph and the type leave
      with the union member. The cabinet texture leaves with the room
      (`CASINO_MACHINE_TEXTURE_KEY` and its boot block), because the rocket is placed by the NPC
      layer and no room fixture draws the machine any more. The model's doc comment stops calling
      the machine a room (`src/ui/casino.ts`, comment only — no behaviour change).
      **The rocket.** One row in `src/data/npcs.ts` + test, found by `[Task-91]`'s per-NPC roll in
      a **trainer room**: id `rocket`, `spriteKey: 'rocket'` (the overworld atlas row Task-90
      ships), and the grunt battle is `SPECIAL_ARCHETYPES`' `rocket` row by id
      (`getTrainerArchetype('rocket')`), never a second archetype. Its row is `chance: 0`,
      `floorStep: 0.03` (read through the framework's clamp): the effective chance is **0 on map
      1** — a zero-chance row is not eligible, the same filter `[Task-92]`'s merchant relies on —
      then 3 % a trainer room at map 2 and 21 % at map 8, which with
      `TRAINER_ROOMS_PER_MAP` (**2,2,3,3,3,4,4,4**) is ≈ 6 % of floors at map 2 rising to ≈ 61 %
      at map 8 — **≈ 2.3 spins a run** against the 30 % leaf's 2.1. That number is read
      through `[Task-91]`'s presence roll, so it is a **re-read default**: re-measure it when 91
      is on main. The row is **repeatable**: its panel writes no per-NPC use mark, because the
      machine's own `casino-spin-*` and `casino-lock-*` marks are the record, so a revisit can
      spin again until the floor's lock. Its panel is the **same slot machine** — `[Task-115]`'s
      table and `[Task-116]`'s reels — with the same `SPIN`/`LEAVE`, money line, price, Egg and
      lock, built through the NPC panel's host (`commitRun`, `closePanel`, and the battle starter
      `[Task-95]`'s Mega Stone row already uses), and the grunt's `RouteTrainer` is built where
      the NPC stands, with `casinoGruntTrainerId(mapIndex)`, `DEFAULT_TRAINER_SIGHT` and
      `archetypeId: 'rocket'`.
      **What must survive untouched.** `casinoSpin` and its three mark families
      (`casino-spin-<map>-<n>`, `casino-lock-<map>`, `casino-grunt-<map>`), the floor-scoped
      lock, the Egg's hatch on `advanceMap` (`hatchEgg`), the price table (`CASINO.price`) and
      the grunt battle. The `casino.*` i18n keys stay too: the NPC panel reuses them, so
      `src/i18n/` is untouched.
      **Fixed-seed re-pin.** `src/engine/maps/plan.test.ts` re-pins the specials from map 3 on —
      the gated, trade and no-heal draws shift by the draws the casino used to take (its chance
      roll on every map from 2, plus its parent and two size draws whenever it hung a leaf), so
      their presence and parents are **re-read**, while the shop, mini-boss and mega-stone draws
      and every regular room, id and size do not move — plus the seeds that hung a casino leaf
      (one fewer leaf). `src/scenes/rooms/registry.test.ts` loses the fixture, and
      `src/data/npcs.test.ts` pins the row's fields. The spin streams do not move: `casinoSpin`,
      its seed formula and its marks are untouched.
      **Docs:** `docs/maps-spec.md` §7 — the **special-room table** (the casino row out), the
      **§7 NPC table** `[Task-91]` adds (the rocket row in, with its chance/floor rate), the
      **special-pass chance paragraph** (the 30 %/from-map-2 clause out and the pass's order
      re-worded), the `### The casino (the slot machine)` **subsection retitled** as the rocket
      NPC's panel, and the **battle-condition quiet list** (the casino leaves its parenthetical);
      `docs/design-spec.md` §7's **casino bullet** (the room becomes the NPC);
      `docs/routes-spec.md` §2's **NPC paragraph**; `src/ui/README.md` (`casino.ts`'s wording and
      the new `rocketPanel.ts` line); `src/scenes/rooms/README.md` (the two casino lines leave).
      Three one-line repairs ride along, because the room's removal makes them false:
      `docs/tech-decisions.md`'s `Task-90` addendum («the casino's grunt» → the rocket NPC),
      `docs/art-direction.md`'s atlas line, and `docs/balance/route-curve.md`'s quiet-room list.
      Out of scope: the table and the economy (`[Task-115]`), the window and its animation
      (`[Task-116]`), the NPC framework (`[Task-91]`), the trainer rooms (`[Task-82]`) and the
      merchant (`[Task-92]`).
      *Dependencies:* `[Task-91]` (the row, the roll, the panel shell and the battle host),
      `[Task-115]` (the table the machine reads) and `[Task-116]` (the view it re-homes). It
      adds no run field, so **no `SAVE_VERSION` step**. It **does** claim
      `src/scenes/RouteScene.ts`, which the entry above used to deny: the NPC panel has no
      data-driven dispatch — `chooseNpc` (5925-6040) is a hard-coded `switch (row.id)` whose
      `default` only writes the use mark and closes, and `src/scenes/rooms/registry.ts` collects
      **room** descriptors only, so the machine cannot open without a `case 'rocket'` beside the
      merchant's (5927-5930) that closes the card and calls `openRocket(this.roomHost())` from the
      moved `src/ui/rocketPanel.ts` (the `[Task-95]` Mega Stone row's own shape). That is why it
      fills **Batch 47c** beside `[Task-120]`, never 47b beside `[Task-109]` (which holds the
      scene), and why its own label moves with it. *(Batch 47c, filled)*
- [x] **[Task-118] The capture beat and its message tick together.** The human's report: «que
      mensaje de captura y animación se sincronicen, la pokeball se agite según más cerca de
      capturar y el mensaje vaya añadiendo puntos suspensivos según se agita y al final mostrar
      el mensaje de si se ha capturado». Today two unrelated clocks run the same beat. The
      engine already measures the proximity: `attemptCapture` (`src/engine/battle/capture.ts`
      36-52) returns `shakes` 0-4 and `success` exactly when it reaches four, and
      `captureMessage` (`src/engine/battle/commands.ts` 311-317) already grades the five cases.
      But `captureBeat` (`src/ui/capture.ts` 21-24) **clamps** a failed attempt to 1-3 wobbles,
      so a break on the first check still wobbles once and the count stops meaning what the
      engine measured; and the wobble chain (`BattleScene.playCapture` 1399-1432: throw 260 ms,
      drop 150 ms, then three 139 ms tweens per shake) runs on its own clock while the line is
      typed by the message box and held for `MESSAGE_HOLD_MS = 900` (`BattleScene.ts` 136), so a
      three-shake break lasts ≈ 1.66 s and the next line can print while the ball still rocks.
      **Fix shape.** `captureBeat` stops clamping: a failure keeps the engine's count (0-3) and a
      success keeps `CAPTURE_HELD_SHAKES`, so a 0-shake attempt is throw, drop and the ball
      opening with **no** wobble. `src/ui/capture.ts` grows the beat's **single clock**:
      `captureTimeline(shakes, success)` returns `{ throwMs, dropMs, stepMs, beats, totalMs }`,
      where `stepMs` still derives from `CAPTURE_SHAKE_SPEED`, `beats` lists one `shake` tick
      per wobble, a `break` tick after the last one on a failure and a `settle` tick at
      `totalMs`; the scene's tween chain and the text both read that schedule, so the scene
      keeps no arithmetic and the clock is headless-testable. The text follows the ticks: the
      in-progress line is a **new key** in the family `[Task-114]` creates — `battle.log.captureWait`,
      `{name}…` with **one dot per completed wobble, capped at three** — **set**, not typed, at
      each `shake` tick, and at `settle` the final line is the one 114 ships for that count
      (`broke free`, `appeared to be caught`, `almost had it`, `so close`, `caught`), so the
      message can never run ahead of the ball.
      **The frame dwell is the beat.** The `capture` frame holds for `timeline.totalMs` plus the
      shipped hold instead of `MESSAGE_HOLD_MS`, and its line bypasses the typewriter (it is
      punctuation, not prose) while every other frame keeps typing; input during the beat jumps
      the whole reveal to its final state — ball at rest, final line printed — never a partial
      one, and the frame then completes the way it does today. On a failed capture the ball
      **opens** at the `break` tick: a two-frame icon swap if the icon atlas carries an open
      ball, the shipped hide plus a short flash if it does not. On a success it stays on the
      field with the foe hidden (`this.captured`), exactly as today.
      **Proximity stays the engine's.** The wobble count is the number `attemptCapture` rolled,
      never re-derived from the catch value in the scene, and the amplitude is constant: the
      **count** is the signal. No RNG draw moves (`D11`), so a fixed seed plays the same number
      of wobbles it always paid for — this task makes them visible and legible.
      **Acceptance.** `[unit]` `captureTimeline` for 0-4 shakes: one `shake` tick per wobble,
      one `break` tick on a failure and none on a success, `settle` last, and `totalMs` equal to
      the sum of its phases; `[unit]` the dot line stops at three dots and the settle line is
      the count's own; `[unit]` `captureBeat(0, false)` plays zero wobbles; `[live]` with the
      dev build on a fixed seed, a 0-shake break shows no wobble (the ball drops and opens), a
      3-shake break wobbles three times while the dots grow to `…` and then prints the `so
      close` line as the ball opens, and a catch ends on the caught line with the ball resting
      on the field — measured by watching the ball's angle reach ±22 three times and reading the
      line at each stop.
      **Docs:** `docs/battle-spec.md` §6 gains the **beat paragraph** (the clock, the per-wobble
      line and the break); `src/i18n/en.ts` + `es.ts` (the one waiting key and its overlay);
      `src/ui/README.md` (`capture.ts`'s line becomes the beat clock).
      Out of scope: the catch formula and the five final lines (`[Task-114]`), the capture
      screen and the release beat (`docs/battle-spec.md` §6), the player's text-speed setting
      (it governs prose elsewhere and this line is not prose) and any sound cue.
      *Dependencies:* `[Task-114]` — the capture lines are keys by then and the waiting key is
      authored beside them. It adds no run field, so **no `SAVE_VERSION` step**, draws no RNG
      and claims no `src/scenes/RouteScene.ts`. *(Batch 57)*

## Phase 10 - Learnset, TMs & move typing

> The learnset panel, the TM catalogue and the effective-type rules shipped;
> these are the follow-ups (`D36`/`D37`).

- [x] **[Task-23] Item-driven move retypes: Multi-Attack, Techno Blast, Natural
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
- [x] **[Task-55] The MOVES panel draws four slots, and a TM can be learned into an empty
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
      and `docs/design-spec.md`: **§3** (The party — the section slipped to "§5" when this entry
      was written), line 83's "the four slotted moves" and 90-91's "A cell is dragged onto a slot
      to equip it (replacing what sits there)" become "an empty slot takes it and the move is
      appended", plus one clause of §4's moves-menu paragraph (202-212) for the battle surface the
      frozen decision covers. No engine rule, no RNG draw and no run field, so **no**
      `SAVE_VERSION` step and no fixed-seed test; the four slots are `MAX_MOVES`, not a new
      constant.
      *Decision:* Both surfaces: the shared `MoveGrid` gains one empty-slot marker and both scenes draw four containers, the battle's empty ones disabled.
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
      `docs/design-spec.md` §3 is Task-50's in Batch 16 and free here, and it is written against
      Task-38's scrolled band and Task-39's single ⓘ classifier. *(Batch 18)*
- [x] **[Task-56] A move learned on a level-up waits in the learnset; it is never equipped for
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

The chrome speaks both locales since `[Task-26]`, and the dex's move and ability copy
since `[Task-112]`. The battle's own **action log** is the one player-facing surface
still English, and `[Task-114]` below closes it.

- [x] **[Task-26] i18n module and the Spanish locale.** A pure, headless-tested
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

- [x] **[Task-114] The battle's action log speaks the locale.** The human's report:
      «falta traducir mensajes de accion durante la batalla». Every line the message box
      prints while a turn resolves — `Charmander used Ember!`, `Ember hit Bulbasaur! It's
      super effective!`, `A critical hit!`, `Bulbasaur fainted!`, the stat-stage lines, the
      ability and item triggers, the weather and terrain starts, the capture shakes and
      `Got away safely!` — is an English **sentence the engine composes**, never a key, so
      the Spanish locale draws its chrome in Spanish and the battle itself in English.
      **The gap, measured.** `pushText` (`src/engine/battle/state.ts` 348-350) pushes
      `{ kind: 'text', text }` (107-110) and `battleFrames` (`src/ui/feed.ts` 19-31) copies
      `text` straight into the frame the scene prints. There are **194** call sites in
      **twelve** files: `effects/abilities.ts` 68, `turn.ts` 55, `effects/moves.ts` 41,
      `effects/items.ts` 10, `effects/apply.ts` / `effects/conditions.ts` / `commands.ts` 4
      each, `effects/terrain.ts` / `effects/weather.ts` / `state.ts` 2 each, `mega.ts` and
      `gmax.ts` 1 each. The tables carry **54** `battle.*` keys and all 54 are chrome, so
      `[Task-26]` (Batch 10) was not wrong to stop there — it moved literals, and this log is
      data — and `[Task-112]` (Batch 23a) localised the move and ability **copy** without
      touching the sentence that embeds it. That is why the fix is a seam, not a sweep.
      **Fix shape.** The text event carries a **key and its params** instead of a rendered
      sentence: `Readonly<{ kind: 'text'; key: BattleTextKey; params?: BattleTextParams }>`,
      with `BattleTextKey = Extract<TranslationKey, \`battle.log.${string}\`>` and
      `BattleTextParams = Readonly<Record<string, string | number>>` beside `BattleEvent` in
      `state.ts` (no new module, so no README line, and the key type is a **type-only**
      import from `src/i18n/en.ts`, so the engine gains no runtime dependency and stays
      headless); `pushText(state, key, params?)` types every one of the 194 sites, and
      `src/ui/feed.ts` resolves the key with `t()` as it builds the frame. The engine
      therefore keeps no locale, no `t` and no `src/i18n` import, and the byte-pinned golden
      log stays a headless artifact. Keys are authored in `src/i18n/en.ts` under
      `battle.log.*` and overlaid by `es.ts` (`D43`'s source table), named for the rule they
      state rather than for one sentence: the damage line is **six whole keys** — `hit`,
      `hitCrit`, `hitSuper`, `hitCritSuper`, `hitWeak` and `hitCritWeak` — chosen from
      `DamageResult` (`turn.ts` 216-223), rather than one sentence with optional halves that
      each locale would have to reorder and the engine would have to re-derive. Params carry
      **ids** wherever the locale owns a table — a move's id, an ability's id, an item's id —
      and the feed resolves the
      official Spanish copy through `[Task-112]`'s accessors (`moveName`, `abilityName`,
      `src/i18n/content.ts` 52 / 76), so the log finally names a move the way the MOVES menu
      does; Pokémon and item names stay English, as `D43` ships them.
      **The tests that move with it.** **Nineteen** assertions read `event.text`
      (`effects/abilities.test.ts` 5, `effects/moves.test.ts` 5, `effects/items.test.ts` 4,
      `effects/weather.test.ts` 2, `commands.test.ts` / `turn.test.ts` /
      `effects/conditions.test.ts` 1 each) and re-pin to key plus params, which is a
      **stricter** assertion than the sentence was. `golden.test.ts`'s inline snapshot,
      `harness.test.ts`'s one-event-of-every-kind fixture (pushed at 138) and `feed.test.ts`'s
      two hand-built logs re-pin to the key form, and `formatBattleLog` (`harness.ts` 95-130)
      learns to render `key(param=value)` once, so both snapshots re-pin against the same
      seed and the same turn sequence (`D46`): no RNG draw moves, so the battle itself is
      unchanged. `src/i18n/index.test.ts`'s call-site scanner declares its own limit — a key
      that is not a literal is skipped — so the new coverage is a **render** test instead:
      the golden battle and the ability/item fixtures are walked through `battleFrames` in
      both locales, asserting no throw and no `{token}` left behind (only 27 of the 194 sites
      pass a literal string inline; the other 167 pass a template or a table entry, so a source
      scan cannot replace that test).
      **Acceptance.** `[unit]` the golden battle's **keys** match the re-pinned snapshot
      exactly; `[unit]` its frames render in `en` and in `es` with no unresolved `{token}`
      and no throw, the way `index.test.ts` renders the 279 swept sites today; `[unit]` the
      new Spanish lines clear the two shipped guards — every character is in the FRLG font
      and no line uses the em dash it cannot draw (`index.test.ts` 66 / 283); `[live]` in
      **es** a wild battle reads `Charmander`/species in English but the action in Spanish —
      a used move, a super-effective hit, a stat drop, an ability trigger and a faint, with
      the move named `Lanzallamas` rather than `Ember` — and in **en** the same five lines in
      English.
      **Docs:** `docs/battle-spec.md` §1 (the log is key plus params and the engine composes
      no language) and `docs/design-spec.md` §4 (one line: the message box speaks the locale,
      and the move and ability names inside it follow the content table);
      `docs/tech-decisions.md` `D43`'s **The boundary** paragraph is **amended, not
      extended**: the dex's names stay English, but the engine's log is keyed too, so the cut
      it froze («a battle reads half Spanish ... half English ... the intended cut, not an
      oversight») is retired, and its "the strings `golden.test.ts` pins byte for byte" reads
      "the keys it pins". No new `D` number.
      Out of scope: `validateCommand`'s refusals (`src/engine/battle/commands.ts` 192-226),
      which are **thrown** and never drawn (`turn.ts` 1494-1501 is the only reader, and it
      throws), the species and item names `D43` keeps English, and the 54 `battle.*` chrome
      keys, which already ship.
      *Dependencies:* none. It claims `src/engine/battle/**` (the twelve files plus their
      tests and `harness.ts`), `src/ui/feed.ts` + test, `src/i18n/{en,es}.ts` and the three
      doc lines, and it is **Batch 53** — the first batch that leaves the engine and the key
      table free at once, since `commands.ts` is `[Task-101]`'s in **Batch 46** and the table
      is held by **Batch 36**'s `[Task-98]`, **Batch 51**'s `[Task-109]` and **Batch 52**'s
      `[Task-110]`. It claims no scene, so it extends no queue. **Its measured baseline is re-read at
      cut time:** the 194 call sites in twelve files, the nineteen `event.text` assertions and the
      golden snapshot were counted on a tree without the audit's Batches **47b–47d** (`[Task-119]`–
      `[Task-121]`), which land **ahead** of this batch and add handlers, volatiles and log lines —
      this task's label does not move, and it stays the only writer of `src/ui/feed.ts`,
      `src/i18n/{en,es}.ts` and `commands.ts`, none of which the audit touches. No run field and no
      RNG draw, so **no `SAVE_VERSION`** step. *(Batch 53)*

---

## Phase 12 - The HUD is a DOM layer (`D49`)

The panels leave Phaser and become CSS over an untouched canvas. The world, the sprites, the battle
background and every effect stay exactly where they are; what moves is the chrome. Identity with the
prototype board is a `pixelmatch` gate, not a visual pass, and a screen that cannot pass keeps its
Phaser version. Design and rationale: `docs/hud-dom-proposal.md`. **The measurements every task
measures itself against — ten type sizes with their line boxes, the palette, the radii, the panel
geometry and the frame → node map — are in `docs/hud-fidelity.md`.**

- [x] **[Task-122] The board lands in the repo and the diff harness exists.** `design/` holds only
      the frames a migrated screen needs — `<slug>.svg` (1:1), `<slug>.png` (@2x, the diff's
      reference) and `<slug>.json` (the `node_info` tree) — exported through the figma-edit MCP by
      `scripts/design/export.mjs`, one frame at a time, never the whole board. `scripts/design/tokens.mjs`
      generates `design/tokens.json` from the file and `scripts/ui/build-chrome.mjs` reads it, so the
      direction is board → tokens → chrome + CSS vars and there is no second hand-typed copy of
      `#10161f`. `scripts/hud/diff.mjs` boots the preview, screenshots at 390×844 and 1280×800 with
      `deviceScaleFactor: 2` and runs `pixelmatch` against the frame's PNG, reporting **geometry**
      (edges, row pitch, radii, chips: ≤ 2 px) and **colour** (mean ΔE ≤ 2 on flat fills) apart, text
      measured on its box and colour. Claims `scripts/design/**`, `scripts/hud/**`, `design/**`,
      `package.json` (dev: `pixelmatch`, `pngjs`), `vite.config.ts` and `.gitignore`. Two things the
      live file already showed, and they belong in its spec: the SVG export **has no text** (Figma
      outlines it, so the strings, family, size and box come from `node_info`), and a panel's
      `stroke-width="2"` in the SVG is a centred stroke clipped by its mask, so the CSS border is
      1 px inside. The figma-edit channel is a **single-session lock**: this task's export runs in the
      Orchestrator's session, which holds `s52r`, not in a worktree beside it.
      *Dependencies:* none. *(Batch 58)*
- [x] **[Task-123] The HUD's state is one projection of the engine.** `src/ui/hud/state.ts`: the
      serialisable `HudState` snapshot (party, bag, money, route, battle, notice) built from
      `RunState` and the battle state, with no Phaser object and no value the HUD could compute a
      second way. `src/ui/hud/commands.ts`: the `HudCommand` union and the reducer that turns it into
      the action id a key or a pad press already produces, so rebinding keeps working and the HUD can
      never mutate the run. One emit point (`syncHud()`), never an ad-hoc `setState` from a scene.
      Tests cover the projection round trip and one command per action family. Claims both modules
      beside their tests and `src/ui/README.md`. *Dependencies:* none. *(Batch 58)*
- [x] **[Task-128] The route's panel layer leaves the route scene.** The ten route panels and the
      route HUD strip move out of `src/scenes/RouteScene.ts` into `src/scenes/panels/<name>.ts` behind
      **one auto-discovered registry**, the shape `D47` gave the room layer in Batch 23b: `bag`, `pc`,
      `party`, `detail`, `map`, `shop`, `trade`, `rewards`, `notices`, `pause` and `hud`. A pure move:
      no behaviour change, no RNG draw, no test re-pinned, the scene keeps the input dispatch and
      every module keeps drawing its frame exactly as today. It is the task that lets the eleven
      migrations run four at a time instead of one per batch, because each will own a module instead
      of the scene. Claims `src/scenes/RouteScene.ts`, `src/scenes/panels/**` and
      `src/scenes/README.md`. *Dependencies:* none. *(Batch 53, filled)*
- [x] **[Task-124] The HUD shell mounts once and owns no Phaser object.** `#hud` sits above the canvas
      from `src/main.ts`, `pointer-events: none`, each panel re-enabling it; `src/ui/hud/shell.tsx`,
      `mount.ts` and `styles/root.css` are the only DOM entry points. Silkscreen is vendored at
      `src/assets/fonts/silkscreen-{400,700}.woff2` (OFL, no CDN) with its `@font-face` and the
      board's type scale as CSS vars — the board is Silkscreen, so "identical to the board" and "same
      typeface" are one requirement. This task owns both HUD folder maps (`src/ui/hud/README.md` and
      `src/ui/hud/panels/README.md`) and writes one line per planned subfolder, so the migrations only
      ever add files inside their own folder. Claims `src/main.ts`, `src/ui/hud/**` (shell, mount,
      styles, both READMEs), `src/assets/fonts/**` and `src/assets/README.md`.
      *Dependencies:* `[Task-122]`, `[Task-123]`. *(Batch 59)*
- [x] **[Task-125] The panel kit the board is made of.** `src/ui/hud/kit/`: `Panel`, `Row`, `Chip`,
      `Sheet`, `PrimaryButton`, `Meta` and `TypeBadge` as Preact components with plain CSS driven by
      the tokens — integer pixels, `box-sizing: border-box`, the board's radius and borders, no shadow
      the board does not draw, ≥ 44 px touch targets and a focus ring. No component library and no
      CSS-in-JS: the diff has to be debuggable in devtools. Claims `src/ui/hud/kit/**` and its README.
      *Dependencies:* `[Task-122]`. *(Batch 59)*
- [x] **[Task-126] A fixture reproduces a frame exactly.** `?hud=dom` and `?hudFixture=<slug>` parsed
      in `src/dev/hudFlags.ts` with a test, and `src/ui/hud/fixtures/**` loading
      `design/fixtures/<slug>.json` into the store and holding the live run feed while the flag is
      on, so the diff compares like with like instead of a different party against the board. Claims
      `src/dev/hudFlags.ts` + test, `src/dev/README.md` and `src/ui/hud/fixtures/**`.
      *Dependencies:* `[Task-122]`, `[Task-123]`. *(Batch 59)*
- [x] **[Task-127] Options (`02`) is the spike, and the spike is the gate.** The first screen in DOM,
      behind the flag: `src/scenes/SettingsScene.ts` stops drawing its panel under `?hud=dom`,
      `src/ui/hud/panels/options/` renders it and `design/fixtures/02-options.json` carries the
      frame's own rows and values. It passes or Phase 12 does not start: no horizontal overflow at
      either size, geometry ≤ 2 px, mean ΔE ≤ 2, the world still walks outside the panel, keyboard
      focus in the panel does not leak into movement keys, and deleting the panel leaves the Phaser
      one untouched. Claims `src/scenes/SettingsScene.ts`, `src/ui/hud/panels/options/**` and
      `design/fixtures/02-options.json`. *Dependencies:* `[Task-124]`, `[Task-125]`, `[Task-126]`.
      *(Batch 60)*
- [x] **[Task-129] The bag panel is the HUD's.** `src/scenes/panels/bag.ts` loses its Phaser drawing
      and its input row handling under the flag; `src/ui/hud/panels/bag/` renders the pocket tabs, the
      rows and the description from `src/ui/bag.ts`'s view model, and `design/fixtures/<bag slug>.json`
      pins the frame. Deleting the DOM panel leaves the Phaser one working, and no engine, save or RNG
      path is touched. Claims `src/scenes/panels/bag.ts`, `src/ui/hud/panels/bag/**` and its fixture.
      *Dependencies:* `[Task-127]`, `[Task-128]`, `[Task-124]`, `[Task-125]`. *(Batch 61)*
- [x] **[Task-130] The PC panel is the HUD's.** Same shape for the box: `src/scenes/panels/pc.ts`,
      `src/ui/hud/panels/pc/`, the release and withdraw commands through `HudCommand`, and the
      fixture. The box's scroll and its search field become native. Claims `src/scenes/panels/pc.ts`,
      `src/ui/hud/panels/pc/**` and its fixture. *Dependencies:* `[Task-127]`, `[Task-128]`,
      `[Task-124]`, `[Task-125]`. *(Batch 61)*
- [x] **[Task-131] The party panel is the HUD's.** `src/scenes/panels/party.ts` and
      `src/ui/hud/panels/party/` render the six rows and their HP from `src/ui/partyScreen.ts`; the
      party order and the lead become commands. Claims `src/scenes/panels/party.ts`,
      `src/ui/hud/panels/party/**` and its fixture. *Dependencies:* `[Task-127]`, `[Task-128]`,
      `[Task-124]`, `[Task-125]`. *(Batch 61)*
- [x] **[Task-132] The party detail panel is the HUD's.** The biggest route panel goes to
      `src/ui/hud/panels/detail/` from `src/ui/partyDetail.ts` (stats, moves, ability, the evolution
      graph), with `src/scenes/panels/detail.ts` keeping only its open/close; the graph is SVG, not
      canvas, so it is diffable. Claims `src/scenes/panels/detail.ts`, `src/ui/hud/panels/detail/**`
      and its fixture. *Dependencies:* `[Task-127]`, `[Task-128]`, `[Task-124]`, `[Task-125]`.
      *(Batch 62)*
- [x] **[Task-133] The route map panel is the HUD's.** `src/ui/hud/panels/map/` renders the grid from
      `src/ui/mapView.ts`, the visited marks and the current room; panning and the room tooltip are
      CSS, not camera. Claims `src/scenes/panels/map.ts`, `src/ui/hud/panels/map/**` and its fixture.
      *Dependencies:* `[Task-127]`, `[Task-128]`, `[Task-124]`, `[Task-125]`. *(Batch 62)*
- [x] **[Task-134] The shop panel is the HUD's.** Buy and sell grids from `src/ui/shop.ts` in
      `src/ui/hud/panels/shop/`, with the quantity stepper and the money row; the purchase stays one
      command and one run transaction. Claims `src/scenes/panels/shop.ts`,
      `src/ui/hud/panels/shop/**` and its fixture. *Dependencies:* `[Task-127]`, `[Task-128]`,
      `[Task-124]`, `[Task-125]`. *(Batch 62)*
- [x] **[Task-135] The trade panel is the HUD's.** The two-column trade in
      `src/ui/hud/panels/trade/`, reading the room's proposal and answering accept or decline through
      the command channel; `src/scenes/rooms/trade.ts` keeps its rule and loses only the drawing.
      Claims `src/scenes/panels/trade.ts`, `src/ui/hud/panels/trade/**` and its fixture.
      *Dependencies:* `[Task-127]`, `[Task-128]`, `[Task-124]`, `[Task-125]`. *(Batch 63)*
- [x] **[Task-136] The mini-boss reward panel is the HUD's.** The item-and-Pokémon choice from
      `src/ui/rewards.ts` in `src/ui/hud/panels/rewards/`, one row per offer, the pick inert until it
      is committed. Claims `src/scenes/panels/rewards.ts`, `src/ui/hud/panels/rewards/**` and its
      fixture. *Dependencies:* `[Task-127]`, `[Task-128]`, `[Task-124]`, `[Task-125]`. *(Batch 63)*
- [x] **[Task-137] The notices strip and the mission line are the HUD's.** The transient notice
      (`src/ui/notice.ts`) and the floor's mission card become DOM text at the top of the screen,
      with the safe-area inset the canvas never respected (47 px top, 810 bottom), and the typewriter
      stays the same beat. Claims `src/scenes/panels/notices.ts`,
      `src/ui/hud/panels/notices/**` and its fixture. *Dependencies:* `[Task-127]`, `[Task-128]`,
      `[Task-124]`, `[Task-125]`. *(Batch 63)*
- [x] **[Task-138] The pause panel is the HUD's.** `src/ui/hud/panels/pause/` renders the pause card
      and its two rows; the scene keeps the pause itself and loses only the drawing. Claims
      `src/scenes/panels/pause.ts`, `src/ui/hud/panels/pause/**` and its fixture.
      *Dependencies:* `[Task-127]`, `[Task-128]`, `[Task-124]`, `[Task-125]`. *(Batch 64)*
- [x] **[Task-139] The route HUD strip is the HUD's, and the pad's fate is decided here.** The chips
      (26×26 letter badges, `M` map, `I` bag, `P` party, `C` pc, `S` stats), the party HP strip and
      the money row move to `src/ui/hud/panels/hud/`; the touch pad is either left in Phaser or moved,
      and the call is written into `docs/tech-decisions.md` as an addendum to `D49` with the reason.
      This is the screen where the mobile pain lives, so it is also the second diff that has to pass
      at 390×844. Claims `src/scenes/panels/hud.ts`, `src/ui/hud/panels/hud/**`, its fixture and the
      `D49` addendum. *Dependencies:* `[Task-127]`, `[Task-128]`, `[Task-124]`, `[Task-125]`.
      *(Batch 64)*
- [x] **[Task-140] The battle's HP boxes are the HUD's.** The four name-and-HP boxes (the two actives
      per side in a 2vs2) leave `src/scenes/BattleScene.ts` for
      `src/ui/hud/panels/battle-hp/`, reading the battle state and animating its own fill; the scene
      awaits `hud.play()` before the next frame, so the drop still lands with its line. The arena, the
      combatants, the shake and the effects are untouched. Claims `src/scenes/BattleScene.ts`,
      `src/ui/hud/panels/battle-hp/**` and its fixture. *Dependencies:* `[Task-127]`, `[Task-124]`,
      `[Task-125]`. *(Batch 61)*
- [x] **[Task-141] The battle's move menu is the HUD's.** The four-slot menu, its ⓘ and its type
      badges in `src/ui/hud/panels/battle-moves/`, from the same view model the canvas used; the
      selection still reaches `commands.ts`. Claims `src/scenes/BattleScene.ts`,
      `src/ui/hud/panels/battle-moves/**` and its fixture. *Dependencies:* `[Task-127]`,
      `[Task-124]`, `[Task-125]`. *(Batch 62)*
- [x] **[Task-142] The battle's bag is the HUD's.** The battle bag list and its use flow in
      `src/ui/hud/panels/battle-bag/`, one command per use, the same item rules. Claims
      `src/scenes/BattleScene.ts`, `src/ui/hud/panels/battle-bag/**` and its fixture.
      *Dependencies:* `[Task-127]`, `[Task-124]`, `[Task-125]`. *(Batch 63)*
- [x] **[Task-143] The battle's switch screen is the HUD's.** The party grid, its HP and its status
      marks in `src/ui/hud/panels/battle-switch/`, with the send-out beat still owned by the scene.
      Claims `src/scenes/BattleScene.ts`, `src/ui/hud/panels/battle-switch/**` and its fixture.
      *Dependencies:* `[Task-127]`, `[Task-124]`, `[Task-125]`. *(Batch 64)*
- [x] **[Task-144] The battle's message box is the HUD's, and its pacing is one clock.** The box and
      the typewriter move to `src/ui/hud/panels/battle-log/`, and the feed's frames
      (`src/ui/feed.ts`) drive it: each frame awaits the HUD's line before the next, so a "Critical
      hit!" still lands with the HP drop it describes. This is the pacing change `D49` names, and the
      one battle task that can move a visible rhythm: it re-pins no seed, but its spec must state the
      measured frame dwell. Claims `src/scenes/BattleScene.ts`,
      `src/ui/hud/panels/battle-log/**` and its fixture. *Dependencies:* `[Task-127]`, `[Task-124]`,
      `[Task-125]`, `[Task-140]`. *(Batch 65)*
- [x] **[Task-145] The main menu is the HUD's.** `01` and `01b`: the route window, the title, the
      CONTINUE/NEW rows, the party portraits and the stats footer move to
      `src/ui/hud/panels/main-menu/`, and `src/scenes/MainMenuScene.ts` keeps the scene and the
      navigation. Claims `src/scenes/MainMenuScene.ts`, `src/ui/hud/panels/main-menu/**` and its
      fixture. *Dependencies:* `[Task-127]`, `[Task-124]`, `[Task-125]`. *(Batch 64)*
- [x] **[Task-146] Stats and ranking are the HUD's.** *(Split on `2026-10-25` into `[Task-152]` and
      `[Task-155]` — see the decision line at the end of this entry.)* `08`, `08b`, `08c`, `09` and `09b` in
      `src/ui/hud/panels/stats/`, including the monthly global record row; the numbers stay the ones
      `src/ui/runSummary.ts` already derives. Claims `src/ui/hud/panels/stats/**` and its fixtures;
      `src/scenes/MainMenuScene.ts` only if the screens still live there, in which case
      `[Task-145]` runs first. *Dependencies:* `[Task-127]`, `[Task-124]`, `[Task-125]`,
      `[Task-145]`. *(Batch 65)*
      **The finding that blocked it:** there is no stats/ranking screen to migrate and no cross-run or
      per-Pokémon record to draw — `RunStats` is `{catches, casualties}` (`src/engine/run/state.ts`
      30-33), the save kept one run, and frames 08/08b/08c/09/09b need run history, playtime,
      per-species KOs/damage and a monthly ranking.
      **Decision (`2026-10-25`): split into a store and a screen.** `[Task-152]` adds the run-history
      store and the `SAVE_VERSION` 24 step (last 50 runs: seed, map reached, catches, casualties,
      playtime, per-species KOs and damage) with no UI; `[Task-155]` renders the five frames from it,
      with the monthly record kept locally. Phase 12's "no `SAVE_VERSION`" line was a property of the
      HUD cut, not a rule of the game, and the bump is routine: `save.ts` already carries 23
      migrations. Issue #51 closes with this decision.
- [x] **[Task-147] The starter picker is the HUD's.** `04`: the three cards, their types and the
      confirmation in `src/ui/hud/panels/starter/`, with `src/scenes/StarterScene.ts` keeping the
      pick. Claims `src/scenes/StarterScene.ts`, `src/ui/hud/panels/starter/**` and its fixture.
      *Dependencies:* `[Task-127]`, `[Task-124]`, `[Task-125]`. *(Batch 65)*
- [x] **[Task-148] Run over is the HUD's.** `06`, `07` and `07b`: the summary card, the fallen list
      and the victory variant in `src/ui/hud/panels/run-over/`, from `src/ui/runSummary.ts`, with the
      permadeath wording unchanged. Claims `src/scenes/RunOverScene.ts`,
      `src/ui/hud/panels/run-over/**` and its fixtures. *Dependencies:* `[Task-127]`, `[Task-124]`,
      `[Task-125]`. *(Batch 65)*

---

## Phase 13 - The dark Pokémon and the run history

The backlog the human decided on **`2026-10-25`**, cut out of the four `[!]` entries Phase 12 ended
on: the ESLint half is dropped (`[Task-28]`, `D51`), the 61 DLC descriptions are written in the repo
instead of waiting for a dump (`[Task-149]`, `D52`), and `[Task-104]` / `[Task-146]` are split so no
task waits on content it cannot get. The wish behind `[Task-104]` is the phase's spine: a **dark
Pokémon carries `darkmatter` and a second, random ability**, which takes a custom ability row
(`[Task-151]`), a second ability slot in the battle engine (`[Task-153]`) and a flag on the run's
members (`[Task-154]`). The run history (`[Task-152]`) and its screen (`[Task-155]`) close the last
Phase 12 screen without pretending a screen exists to migrate.

### Batch 66 - the queue restarts here

- **`[Task-149]`** owns `src/data/i18n/es/**` and `src/i18n/content.test.ts`: content, no code path.
- **`[Task-150]`** owns `src/engine/battle/{state,damage,turn}.ts` and `docs/battle-spec.md`.
- **`[Task-151]`** owns the custom row and its handler — `src/data/dex/**`,
  `src/engine/battle/effects/abilities.ts`, `docs/data-spec.md` and the regenerated coverage table —
  and **re-pins** the fixed-seed ability draw, which no other task in the batch reads.
- **`[Task-152]`** owns `src/engine/run/history.ts` and `src/engine/save.ts`, and is the batch's only
  `SAVE_VERSION` step (24). `[Task-154]` reads it later and takes 25.
- Four disjoint path sets, four dev slots and four QA slots; no task needs a file a batch-mate
  produces, so the batch runs as one wave.

### Batch 67 - the second ability slot and the stats screen

- **`[Task-153]` and `[Task-155]`.** The engine's second slot and the stats screen share nothing
  (`src/engine/battle/**` against `src/ui/hud/panels/stats/**` + `src/scenes/MainMenuScene.ts`), and
  `[Task-155]` needs only `[Task-152]`, which Batch 66 merged. Two slots.

### Batch 68 - the dark Pokémon

- **`[Task-154]` alone**, and the empty slots are a dependency, not a preference: it reads
  `[Task-151]`'s row and `[Task-153]`'s second slot, so it cannot start before Batch 67 lands. It is
  the last task of the phase and the reason the phase exists.

### Batch 69 - the double-battle roll

- **`[Task-156]` alone**, and it is a one-task batch on purpose: it rewrites the flag every battle
  reads (`BOSS_PARTY` and the launch), so no batch-mate may hold a battle path while it lands.

- [x] **[Task-149] The 61 DLC descriptions, authored in the repo.** Fill `description` and
      `shortDescription` in `src/data/i18n/es/moves.json` and `abilities.json` for exactly the 18
      moves and 43 abilities `MISSING_ES` names; regenerate `meta.json` so both `missingDescriptions`
      lists are empty and `MISSING_ES` is `[]`. **The text is written in the repo, in Spanish, from
      the dex's own English `desc`/`shortDesc`** — the human authorised authored Spanish over official
      text (`D52`) — so it is content review, never a generator, and every string must read as Spanish
      prose. Spot-checks in `src/i18n/content.test.ts` (`alluringvoice` = `Canto Encantador`,
      `dragoncheer` = `Bendición Dragón`, `malignantchain` = `Cadena Maligna`) plus one assertion per
      file that no English sentence survives. Claims `src/data/i18n/es/**` and
      `src/i18n/content.test.ts`. *Dependencies:* none — `D43`'s tables and accessors are shipped. It
      adds no run field and draws no RNG: **no `SAVE_VERSION`** step. *(Batch 66)*

- [x] **[Task-150] The four team-type bonuses.** `BattleSetup.teamTypes` (`src/engine/battle/state.ts`
      120-128) is filled by the launch from the party's **living** members; two living Fire members
      give a Fire move **+10 %** damage and **+20 %** burn chance, with Ice (freeze), Electric
      (paralysis) and Poison (poison) the same. The damage half multiplies inside `damage.ts` next to
      STAB, and the status half is one helper in `turn.ts` that the existing secondary roll also
      calls, so the two can never disagree. **Docs:** `docs/battle-spec.md` §10/§11. Claims
      `src/engine/battle/state.ts`, `src/engine/battle/damage.ts`, `src/engine/battle/turn.ts`, their
      tests and `docs/battle-spec.md`. *Dependencies:* none — `damage.ts` and the roll are shipped.
      *(Batch 66)*

- [x] **[Task-151] The custom ability row: `darkmatter`.** The generated dex has no Gen 9 row that
      ignores the type chart, so the repo gets **one hand-authored ability table the accessors
      accept**: `src/data/dex/customAbilities.ts` with `darkmatter` — EN *Dark Matter*, ES *Materia
      Oscura*, "The holder's moves ignore the type chart: no weaknesses, no resistances, no
      immunities." Its `onModifyEffectiveness` handler in `src/engine/battle/effects/abilities.ts`
      returns `1`, which `turn.ts` already dispatches before the chart is applied; `getAbility`
      resolves the row, `meta.json` counts it, `docs/data-spec.md` gets its line and
      `npm run docs:coverage` regenerates `docs/balance/effect-coverage.md`. Adding an id to
      `randomAbilityPool()` changes every draw, so the fixed-seed regression test is **re-pinned** in
      this task, never left stale. Claims `src/data/dex/customAbilities.ts`,
      `src/data/dex/abilities.ts`, `src/data/dex/meta.json`,
      `src/engine/battle/effects/abilities.ts`, `src/engine/battle/randomAbility.test.ts`,
      `docs/data-spec.md` and `docs/balance/effect-coverage.md`. *Dependencies:* none. *(Batch 66)*

- [x] **[Task-152] The run-history store.** `src/engine/run/history.ts`: one record per finished run
      — seed, map reached, catches, casualties, playtime, and per-species KOs and damage — appended
      to `save.history` and capped at the last 50, so a screen can show totals, the run list and the
      Pokémon table without reading a live run. `SAVE_VERSION` 24 with migration `23 → 24` seeding
      `history: []`; the round-trip, the cap and the migration's on-disk shape are unit-tested. No UI
      and no scene. Claims `src/engine/run/history.ts`, `src/engine/run/README.md`,
      `src/engine/save.ts`, `src/engine/save.test.ts`, `src/engine/README.md`. *Dependencies:* none.
      *(Batch 66)*

- [x] **[Task-153] The engine accepts a second ability.** `BattleFighter.secondAbility?: string` and
      one `hasAbility(fighter, id)` helper; `ownedEffects` (`src/engine/battle/effects/registry.ts`)
      yields both abilities' effects, and the handlers that compare `foe.ability === '...'` move to
      the helper so a fighter's second ability is never a no-op. The snapshot round-trip preserves it
      and a battle test proves its effect fires. Claims `src/engine/battle/fighter.ts`,
      `src/engine/battle/effects/registry.ts`, `src/engine/battle/effects/abilities.ts` and their
      tests. *Dependencies:* `[Task-151]` (the row it makes reachable). *(Batch 67)*

- [x] **[Task-154] The dark Pokémon.** A run member can be **dark** (`RunMember.dark`, `SAVE_VERSION`
      **25** with migration `24 → 25` seeding `false`): its ability is always `darkmatter` and its
      `secondAbility` is the random draw the rest of the run already makes, which `[Task-153]` reads.
      The encounter roll marks a share of wilds dark (`src/data/run.ts`), the catch keeps the flag, the
      party and the route show it (a tint, no new atlas), and the rule lands in `docs/design-spec.md`
      and `docs/battle-spec.md`. A dark member's panel shows both abilities. Claims
      `src/engine/run/state.ts`, `src/engine/run/roster.ts`, `src/engine/routes/encounters.ts`,
      `src/data/run.ts`, their tests, `docs/design-spec.md` and `docs/battle-spec.md`.
      *Dependencies:* `[Task-151]`, `[Task-153]`. *(Batch 68)*

- [x] **[Task-155] Stats and ranking are the HUD's.** `08`, `08b`, `08c`, `09` and `09b` in
      `src/ui/hud/panels/stats/`, read from `[Task-152]`'s store: the totals, the run list, the
      Pokémon table and the monthly local record, with empty states when the history is empty. The
      main menu's frame-only STATS row (`src/scenes/MainMenuScene.ts`) becomes live. Claims
      `src/ui/hud/panels/stats/**`, `src/scenes/MainMenuScene.ts`, `src/i18n/en.ts`, `src/i18n/es.ts`
      and its fixtures. *Dependencies:* `[Task-127]`, `[Task-124]`, `[Task-125]`, `[Task-145]`,
      `[Task-152]`. *(Batch 67)*

- [x] **[Task-156] The double-battle roll: 25 % for the boss, 10 % for the mini-boss.** Today
      `BOSS_PARTY` hard-codes `double: true` for the map boss and `false` for the mini-boss, and the
      launch only reads the room flag (`RouteScene` 3410), so a mini-boss never rolls one at all.
      **Decision (`2026-10-25`): both kinds roll, from the run's own seed** — **25 %** for the boss,
      **10 %** for the mini-boss. `BOSS_PARTY[kind].doubleChance` replaces `double`; one pure helper
      (`bossIsDouble(kind, seed, mapIndex, routeIndex, key)`, or a `rollDouble` beside it) draws from
      a stream of its own —
      `hashSeed(\`${seed}:double:${kind}:${mapIndex}:${routeKey}\`)` — so no existing draw moves and a
      replay rebuilds the same answer. The mini-boss trainer's launch (`isMiniBoss`, `RouteScene`
      2776) carries the flag the boss room already carries; the screen, the second slot, the target
      step and the AI need no change, because all of them read `BattleLaunch.double`.
      **Docs:** `docs/battle-spec.md` §12 (the "Data" bullet and its double-battle paragraph) and
      `docs/maps-spec.md` §6. **Tests:** the rate over 10 000 seeds lands within one point of 25 and
      10, and a fixed seed pins one double and one single answer. Claims `src/data/bosses.ts`,
      `src/data/bosses.test.ts`, the launch seam in `src/scenes/RouteScene.ts`, `src/engine/run/**`
      if the roll lives there, `docs/battle-spec.md` and `docs/maps-spec.md`. *Dependencies:* none —
      the `double` path ships end to end. *(Batch 69)*

---

## Phase 14 - The centre chamber

The human's room-shape decision of `2026-10-25`: the **entry room**, the **boss room** and every
**dead-end room** stop being a point or a bare stub and get one **central chamber** — a diamond that
is never perfect, grown from the room's centre **against its walls** and re-rolled per seed, so no
two rooms share an outline. Dead ends lose their optional branches, the boss room becomes a two-door
line with the chamber in the middle, and the player spawns **inside** the chamber instead of on a
bare centre tile.

### Batches 70 and 71 - the chamber, then what lives in it

- **Batch 70 — `[Task-157]` alone.** It owns the carve (`sketch.ts`), the shape table (`layout.ts`)
  and the wall guards, so no task that touches a room's floor may run beside it.
- **Batch 71 — `[Task-158]` alone**, and the empty slots are a dependency: it reads the chamber
  `[Task-157]` writes and moves the boss's cell and the entry's spawn, so it cannot start before
  Batch 70 lands.

- [x] **[Task-157] The centre chamber, and the dead ends lose their branches.** Every room with no
      through-lane — the entry, the boss and any `dead-end` — gets one **central chamber**: a
      diamond grown from the room's centre, **never a perfect one**. `ShapeSpec` gains
      `chamber: 'none' | 'diamond'`; the carve runs after the spine and before the terrain, from a
      stream of its own (`route:<room>:chamber`), and grows the outline row by row —
      `|dx| ≤ radius - |dy| * slope + jitter(row)`, the jitter seeded per room — then **stops at the
      walls**: the border band an opening owns, a carved ledge line, and any tile the biome's wall
      motif would turn into a stump are never bitten, which is what makes it fit the room instead of
      stamping a rhombus. The entry lane joins the chamber's nearest edge and the chamber joins the
      room's network, so connectivity and the hazard passes still see one floor.
      **Dead ends lose their optional branches**: `dead-end.branchCount` goes to `0`, and the loot
      and trainers those branches carried move **into the chamber's own pockets**, using the rule the
      branches' pockets already follow (the item sits on the deepest wall-hugging floor tile).
      **Docs:** `docs/routes-spec.md` §2 (the pipeline) and §4 (the shape table), `docs/maps-spec.md`
      §2. **Tests:** a fixed seed pins one chamber's outline; four seeds never repeat an outline; the
      chamber never touches the border band, a ledge or an opening; a dead-end room fields no branch
      and still holds its item; `validate.ts` stays green on every shape. Claims
      `src/engine/routes/{sketch,layout,walls,validate}.ts`, their tests and the two docs.
      *Dependencies:* none. *(Batch 70)*

- [x] **[Task-158] The boss room is a two-door line with the chamber, and the boss lives in it.**
      The boss room stops being a dead-end leaf: the plan gives it **two openings** — the incoming
      link and the **portal** — so its shape is `corridor`, and `[Task-157]`'s chamber sits in the
      middle of that line. The **boss is placed inside the chamber** (`bossTrainer`, `RouteScene`
      699) on every floor, never on a stub, and the **entry room spawns the player inside its own
      chamber** (the centre spawn at `sketch.ts` 1469 already puts the player at the centre; this
      task guarantees that centre is chamber floor). `bossRoomSealed` is untouched: the second
      opening exists in the plan, stays sealed until the boss falls, and the chamber keeps its lane
      to it. **Docs:** `docs/maps-spec.md` §2 (the shape table, the entry and boss rooms) and §6 (the
      boss room's door and the boss's cell). **Tests:** the boss's cell is inside the chamber on 20
      fixed seeds; the entry's spawn is inside its chamber; the boss room reads `corridor` and the
      portal is sealed. Claims `src/engine/maps/plan.ts`, `src/engine/routes/{sketch,validate}.ts`,
      `src/scenes/RouteScene.ts`, `src/engine/maps/plan.test.ts` and the two docs.
      *Dependencies:* `[Task-157]`. *(Batch 71)*

### Batch 74 - the boss door's sign

- **`[Task-161]` alone**, and it lands **after** `[Task-158]`: both edit the boss room's own layout
  and `RouteScene`, so they cannot share a batch even though neither needs the other.

- [x] **[Task-161] A sign at the door that leads into the boss room, and a popup that names it.** The
      route gets a **static sign** beside the opening that enters the boss room — on the approach
      side, where the player sees it before stepping through — drawn from **`tileset-2`**, cell
      **`(col 23, row 3)`**: in the source sheet that is `x = 1 + 23·17 = 392`, `y = 1 + 3·17 = 52`,
      a 16×16 cell, and **it already comes with a transparent background** (68 of its 256 pixels are
      `alpha 0`), so it is stamped as-is, with no colour key. It is solid, and it sits **one tile off
      the opening band** so the door stays passable. Interacting with it (the same `tryInteract` the
      ground items use, `RouteScene` 2839) opens a **popup** that says it is the boss room, one key in
      both locales (`boss.sign`), on the NPC card's own window, not a transient notice.
      **Fix shape:** the sign is **its own 16×16 texture**, not a biome-atlas frame — the FRLG atlas is
      **full** (`TILESET_COLS = 4` × `TILESET_ROWS = 13` = 52 frames, `FRAME_LEDGE = 51`), and growing
      it to a 14th row would re-pin the whole tileset contract and every fixture; `scripts/frlg/`
      gains a small packer that cuts that one cell into `src/assets/frlg/sign.png` (the same
      `decodePng`/`encodePng` the item icons use), `BootScene` loads it like the item atlas, and
      `src/data/tilesets/props.ts` names the texture and its one frame.
      `RouteMap` gains `signs: readonly RouteSign[]` (`{ x, y, text }`), filled by the room build
      that already knows the boss room and its link — **no RNG**, so a rebuilt room puts it in the
      same cell — and `RouteScene` draws it as a sprite and blocks the tile. The interact path checks
      a `sign` before a trainer and opens the card; walking away closes it like any other panel.
      **Docs:** `docs/routes-spec.md` §2 (the interactables), `docs/maps-spec.md` §6 (the boss room's
      door) and `docs/tileset-spec.md` §2 (a prop texture beside the tileset). **Tests:** the cut cell
      is 16×16 with its transparent corners; the sign lands beside the boss-room link on 20 fixed
      seeds and never on the band; the door still opens; the popup's text is the i18n key; the tile is
      solid from the four sides. Claims `scripts/frlg/` (the new packer), `src/assets/frlg/sign.png`,
      `src/data/tilesets/props.ts`, `src/engine/routes/{routeMap,layout}.ts`, `src/scenes/{BootScene,
      RouteScene}.ts`, `src/i18n/en.ts`, `src/i18n/es.ts` and the three docs.
      *Dependencies:* none, but it lands after `[Task-158]` (same files). *(Batch 74)*

---

## Phase 15 - Battle rules the audit cannot see

The move audit (`[Task-119]`–`[Task-121]`) counts a move as `port` when its handler exists and its
volatile lands; it cannot see a rule that has to **repeat** every turn. Trap moves are the proof:
they pass the ledger and deal no damage at all.

### Batch 72 - the trap moves

- **`[Task-159]` alone**: it owns `turn.ts`'s volatile case and the residual pass, the volatile's
  shape and the audit's expectations, so no other battle task may run beside it.

- [x] **[Task-159] Trap moves damage their target every turn, and the audit learns to see it.** Sand
      Tomb, Fire Spin, Whirlpool, Wrap, Bind, Infestation, Magma Storm, Thunder Cage, Snap Trap and
      Clamp all carry `volatileStatus: 'partiallytrapped'`, and the engine treats it as `trapped`:
      `turn.ts` 347-350 sends both ids to `applyTrap` (`volatile.ts` 39), which only sets a boolean,
      so the target cannot switch but **loses no HP on any later turn** and the state never expires.
      **Fix shape:** `volatiles.partiallyTrapped` becomes its own record — `{ turns, moveId }` — with
      the **4-5 turn** duration drawn from the battle's seeded `Rng` when the move lands, a new trap
      replacing the counter; the residual pass (`resolveResiduals`, `turn.ts` 1504) applies **1/8 of
      max HP** after the status/weather/ability passes, **1/6 with Binding Band**, which stops being
      a `no-op` item, with its own line in both locales; the volatile clears when the counter reaches
      zero (a switch is impossible while it holds, which is the same `isTrapped` the AI already
      reads). Ghost-type immunity to trapping is ported from Showdown and pinned by a test.
      **The audit half:** `moveAudit`'s expectation gains a `residual` field (what the move does on
      the following turn), so the ten rows stop being `port` on the strength of a volatile alone —
      and the whole "a handler exists but nothing happens" class is caught from then on.
      **Docs:** `docs/battle-spec.md` (status and volatiles) and the regenerated
      `docs/balance/effect-coverage.md`. **Tests:** a fixed seed pins the duration (one 4 and one 5),
      the 1/8 and the 1/6, the clear on the last turn, and a second trap resetting the counter. The
      duration draw is new, so the ten moves' fixed-seed regressions are re-pinned. Claims
      `src/engine/battle/{turn,volatile,fighter,status}.ts`, `src/engine/battle/moveAudit.ts`,
      `src/engine/battle/effects/items.ts`, the i18n keys and the two docs. *Dependencies:*
      `[Task-119]`. *(Batch 72)*

### Batch 73 - the per-hit roll

- **`[Task-160]` alone**: it owns the hit loop in `turn.ts` and the audit rows for the three
  `multiaccuracy` moves, so no other battle task may run beside it.

- [x] **[Task-160] Population Bomb and the two Triple moves check accuracy on every hit.** The dex
      marks three moves `multiaccuracy: true` — **Population Bomb** (10 hits, 90 %), **Triple Axel**
      and **Triple Kick** (3 hits, 90 %) — and the engine reads the flag **nowhere**: `useMove` rolls
      one `rollHitWith` per target (`turn.ts` 1054) and then runs the whole `for hit < hits` loop
      (`1127`), so all ten or three hits land on a single roll. **Fix shape:** when
      `move.multiaccuracy` is true the loop rolls `rollHitWith` before each hit and **stops the move
      on the first miss**, pushing one `battle.log.missed`; the same loop gives Triple Kick and Triple
      Axel their **ramp** — the hit's base power is `basePower × (hit + 1)`, 10/20/30 and 20/40/60 —
      which is the second half of the same bug and the reason their damage reads flat today. Skill
      Link keeps forcing the full count (it changes the number of hits, not the rolls), and Loaded
      Dice stays out of scope because the item is still `no-op`.
      **The audit half:** the three rows in `moveAudit.ts` (1146-1148, 808) stop asserting "three
      `damage` events" and instead pin a **miss stop** and the per-hit powers with a fixed seed, so a
      flat multi-hit cannot pass again. **Docs:** `docs/battle-spec.md` §3.
      **Tests:** a fixed seed where the second roll misses ends the move at one hit; a fixed seed
      where all three land reports 10/20/30 (Triple Kick) and 20/40/60 (Triple Axel); Population Bomb
      pins a 10-hit run and a stop at hit 4. The per-hit rolls are new draws, so those seeds are
      re-pinned. Claims `src/engine/battle/turn.ts`, `src/engine/battle/modifiers.ts`,
      `src/engine/battle/moveAudit.ts` and `docs/battle-spec.md`. *Dependencies:* none. *(Batch 73)*

---

## Phase 16 - The play-report round

The human's **nineteen play reports of `2026-10-26`** — the seventeen of the first sitting plus the
two that followed — registered as `[Task-162]`–`[Task-180]` and cut into **six batches, 75 to 80**.
**Every one is a defect** — no wishes in the set — and none duplicates a shipped task: each entry
names the shipped behaviour (and, where one exists, the task) it repairs (`[Task-21]`'s evolution
information rows, `[Task-50]`'s level-up notice, `[Task-161]`'s boss-door sign, `[Task-08]`'s keyboard
rule, `[Task-119]`'s move audit, `[Task-142]`/`[Task-143]`'s battle cards, `[Task-132]`'s detail card,
`[Task-52]`'s catch record, `[Task-31]`'s capture-screen removal) and registers only the residual
defect.

**The set adds no dependency edge at all** — no task needs a file a batch-mate produces, and no task
needs one a later batch produces — and **no `SAVE_VERSION` step**: `main` reads **25**
(`src/engine/save.ts` 77) and stays there. Three reports look like state and are not: the wild-table
exclusion re-reads the members the run already saves (`party`, `box`, `rip` and `caughtSpecies`), the
Mart's sold-out rows ride the shipped per-floor `pickedItems` marks
(`src/engine/run/state.ts` 588-595), and **the PC rule removes** two fields (`pcCatch`,
`entryDeparted`) instead of adding one, which needs no step because the decoder is field-by-field and
both keys are optional today (`save.test.ts` 545-549). Everything else is a rule, a data row or
presentation.

What serialises the work is **hot files, not depth**: `src/scenes/BattleScene.ts` four tasks (163,
168, 166, 169), `src/engine/battle/turn.ts` four (167, 168, 173, 174), `src/scenes/RouteScene.ts`
**four** (164 in 75, 176 in 77, 180 in 79, 179 in 80 — never two in one batch), `src/scenes/panels/detail.ts`
two (162, 171), `src/ui/partyDetail.ts` two (171, 177), the i18n pair two (162, 164), the generated
coverage pair twice, one per batch (167, 173), `docs/routes-spec.md` **§2** by 175 (75), 176 (77) and
180 (79), one batch apart, and its **§3/§6** by 179 (80), and once each `src/data/items.ts` (178), the
shop card (178), the sign packer (165), the NPC table (170) and `src/engine/save.ts` (179). Every batch
below is an antichain and names its holder for each. Batches run in priority order: the rules and
run-integrity defects first, the presentation and economy last.

### Batch 75 - a back press that orders a turn, a move that never fails, a duplicated line, a panel nobody wants

- **`[Task-163]`** claims `src/scenes/BattleScene.ts` (the batch's one) and
  `src/engine/battle/commands.ts` + test.
- **`[Task-167]`** claims `src/engine/battle/turn.ts`, `effects/registry.ts`, `effects/moves.ts` +
  tests, `src/engine/battle/moveAudit.ts` + test and the **generated** coverage pair — the batch's
  only claimant of that pair and of `src/engine/battle/turn.ts`.
- **`[Task-175]`** claims `src/engine/run/pool.ts` + test and `src/engine/routes/staticSpecies.ts` +
  test.
- **`[Task-164]`** claims `src/scenes/RouteScene.ts` (the batch's one), `src/ui/notice.ts` + test and
  the **i18n pair**.
- **Four disjoint path sets, four dev slots and four QA slots.** `docs/battle-spec.md` is held by
  **two** tasks **by section** — 167 writes **§3.3**, 163 writes **§4** — and by no one else; 175
  writes `docs/routes-spec.md` §2 and `docs/maps-spec.md` §7, 164 writes `docs/design-spec.md` §3.
  No `package.json`, `src/main.ts`, `vite.config.ts` or `src/data/dex/**` is claimed.
- **No `SAVE_VERSION` step**, and no task waits on another: the first batch depends on nothing and
  every task in it is fully specified at cut time.

- [x] **[Task-163] A back press never orders a turn the player did not order.** «al retroceder no
      deberia salir el move que utiliza el rival». When the lead faints the party grid is a **forced**
      switch (`finishFeed`, `src/scenes/BattleScene.ts` 1829-1834 sets `forcedSwitch` and calls
      `openParty()`), but both back paths route a `party` mode to `openMenu()` (`onBack` 5049-5051,
      `onCancel` 1661-1663) and `openMenu` (2417-2449) reads neither `forcedSwitch` nor
      `state.sides.player.awaitingReplacement`, so it opens a command grid with FIGHT enabled (2432).
      Confirming it reaches `submit` (2783-2804) and `takeDoubleTurn`'s validation **throws**
      (`validateCommand` 244 → `turn.ts` 1834-1841), and the scene has no `try`/`catch` anywhere: the
      press that escapes the forced switch is a dead end, and the turn the player is owed a
      replacement for can never be resolved cleanly. **Fix shape:** one rule,
      `replacementOwed(state)` in `src/engine/battle/commands.ts` (a one-line read of
      `state.sides.player.awaitingReplacement`, the field `needsReplacement` filters at `turn.ts`
      1950-1952 and `faint` sets at 855), and both entry points obey it: `onCancel` and `onBack`
      re-open the party grid and never `openMenu` while it holds, and `openMenu` returns to the grid
      instead of building a command menu — the grid is the only menu while a replacement is owed, so
      the press described in the report has nothing to fall into. The grid's `enabled` gate and the
      "no reserve → the run ends" path are untouched (`sideNeedsReplacement` answers false on a last
      Pokémon, `double.test.ts` 166). **Docs:** `docs/battle-spec.md` §4 (the forced-switch paragraph:
      a replacement comes before any command). **Tests:** `[unit]` `commands.test.ts` — a fainted lead
      leaves `replacementOwed` true and a completed switch clears it, on one board with a reserve and
      one without; `[unit]` the scene's decision exposed as a dev read (the
      `battleBagDrawnObjectCount` pattern, `BattleScene.ts` 5088-5094) answering the mode a back press
      opens while a replacement is owed against the mode it opens after the switch; `[live]` a wild
      battle: faint the lead, then Esc and ◀ three times — the switch grid stays up and no feed starts.
      Claims `src/scenes/BattleScene.ts`, `src/engine/battle/commands.ts`,
      `src/engine/battle/commands.test.ts`, `docs/battle-spec.md` §4. *Dependencies:* none.
      *Decision:* open — this forced-switch path is the one place the named gesture can break the
      turn, and it is the recommended reading; if the human instead means a **revealed move name**
      (the foe's move printed or floated on a back press) the fix moves to the message/log seam, so QA
      runs the repro before the dev starts and the batch does not depend on the answer. *(Batch 75)*

- [x] **[Task-167] Upper Hand fails unless the target is using a priority move.** «palma rauda debe
      fallar si no usa move prioridad». The move is **`upperhand`** (*Palma Rauda*,
      `src/data/i18n/es/moves.json` 3952-3956; dex name *Upper Hand*), and it ships as a data-only
      move: its ledger row is `port` on `data: secondaries` (`src/data/moveCoverage.json` 4751-4755)
      and `MOVE_AUDIT_ROWS` pins only `move` + `damage` + the two flinch volatiles
      (`src/engine/battle/moveAudit.ts` 1211-1217), so nothing reads the target's command and the
      punch always lands. The engine holds both halves it needs: the turn's commands are in hand at
      `takeDoubleTurn` (`turn.ts` 1829-1832, validated 1834-1841) and a move's effective priority is
      `runModifyPriority(ctx, move, move.priority)` (1904). **Fix shape:** a conditional-fail table
      beside the other move tables, keyed `upperhand`, answered from the target's command — a `fight`
      command whose move's `runModifyPriority` is **> 0** — reached through a new
      `EffectContext.commands` (`effects/registry.ts` 16-26, kept optional so no existing test
      changes); a failed read logs `battle.log.fail`, spends the PP and deals nothing, while the
      flinch stays the move's `secondaries` on a success. **Docs:** `docs/battle-spec.md` §3.3 (the
      conditional table gains the conditional **fail**) and the regenerated
      `docs/balance/effect-coverage.md`. **Tests:** `[unit]` `effects/moves.test.ts` — one turn with
      the foe picking `quickattack` lands damage and the flinch, one with the foe picking `tackle`
      logs the fail and leaves the foe at full HP; `[unit]` the audit row splits in two, so a move
      that never fails can no longer pass (`moveAudit.test.ts`); `[unit]` both turns pinned on fixed
      seeds, because the flinch roll is a draw (`npm test -- moves moveAudit`). Claims
      `src/engine/battle/turn.ts`, `src/engine/battle/effects/registry.ts`,
      `src/engine/battle/effects/moves.ts` + test, `src/engine/battle/moveAudit.ts` + test,
      `docs/battle-spec.md` §3.3 and the generated `docs/balance/effect-coverage.md` +
      `src/data/moveCoverage.json`. *Dependencies:* none — the command map and the priority hook ship.
      *(Batch 75)*

- [x] **[Task-175] No wild or static whose evolution line the run already holds.** «no debe salir como
      poke capturado estatico o salvaje uno que ya tienes a alguno de su linea evolutiva».
      `wildExclusions` (`src/engine/run/pool.ts` 32-39) already expands a recorded id to its whole
      line — `evolutionFamily` walks `prevo` up and `evos` down (`src/data/dex/evolutions.ts`
      225-252) and `formeFamily` adds the formes (261-267) — but it reads **only `run.caughtSpecies`**,
      which `recordCatch` writes on a catch alone (`src/engine/run/state.ts` 559-565). So the starter,
      a trade-in (`src/engine/run/trade.ts`), an egg and any member the run did not catch are
      invisible to it, and the static-species leaf never consults it at all: `staticRoomContent`
      draws straight off `STATIC_SPECIES` (`src/engine/routes/staticSpecies.ts` 70-72). **Fix shape:**
      `wildExclusions(run)` reads the run's **members** (`party`, `box` and `rip`
      `fighter.speciesId`) beside `caughtSpecies`, and `staticRoomContent` filters its list by that
      set before the draw — the filtered list keeps the roll shape, and an empty filter falls back to
      the unfiltered list so a late floor never fields nothing. No run field: party, box, RIP and
      `caughtSpecies` all ship and are saved, so **no `SAVE_VERSION` step**. **Docs:**
      `docs/routes-spec.md` §2 (the encounter table's exclusion rule) and `docs/maps-spec.md` §7 (the
      static room's species). **Tests:** `[unit]` `pool.test.ts` — a run holding `pikachu` excludes
      `pichu`, `pikachu`, `raichu` and `raichualola`, and a run whose **starter** is `charmander`
      excludes its line with no catch record at all; `[unit]` `staticSpecies.test.ts` — 20 seeds on a
      run holding `pikachu` never draw that line; `[unit]` a fixed seed still picks the same species
      when nothing is excluded (the draw is a filter, not a re-roll). Claims `src/engine/run/pool.ts`
      + test, `src/engine/routes/staticSpecies.ts` + test, `docs/routes-spec.md` §2,
      `docs/maps-spec.md` §7. *Dependencies:* none — `[Task-52]`'s record ships and is only extended.
      *(Batch 75)*

- [x] **[Task-164] A level-up that crossed no move shows no panel at all.** «no deberia salir panel sube
      de nivel, solo debe existir panel has aprendido nuevos movimientos». `playLevelUp`
      (`src/scenes/RouteScene.ts` 3909-3944) already gates the learn modal — `showLearnPopup` returns
      at `detail.ts` 1338 when no beat carries a learned id — but its tween completion raises a
      `levelUpNotice` for **every** beat (3933-3938), and that transient is the "sube de nivel" panel
      the human rejects. The line is `[Task-50]`'s (Batch 16) and its own comment says so ("Every
      level-up says so, not only the ones that crossed a move", 3931-3932), so the report reverses a
      decision rather than contradicting a defect. **Fix shape:** delete the notice loop and the
      `levelUpNotice` import from `RouteScene`; retire `levelUpNotice` (`src/ui/notice.ts` 73-82) and
      the `notice.levelUp` key in both locales if nothing else reads them (today `RouteScene` 3936
      and `notice.test.ts` are the only two readers); the level-counter tween, the portrait flash, the
      learn modal and the evolution popup all stay. **Docs:** `docs/design-spec.md` §3, lines 111-119
      — the "Every level-up also says so in a transient notice … holding 2.6 s" sentence goes, the
      modal's sentence stays. **Tests:** `[unit]` `notice.test.ts` and the i18n parity suite drop the
      retired key and function (`npm test -- notice i18n`); `[unit]` `beats.test.ts` keeps pinning
      `learned: []` for a move-less level-up and gains the assertion that the beat still reports
      `fromLevel`/`toLevel`, so the counter still animates; `[live]` one trainer win that levels with
      no move (silence — no notice, no modal) and one that crosses a move (the modal alone). Claims
      `src/scenes/RouteScene.ts`, `src/ui/notice.ts`, `src/ui/notice.test.ts`, `src/i18n/en.ts`,
      `src/i18n/es.ts`, `docs/design-spec.md` §3. *Dependencies:* none. *(Batch 75)*

### Batch 76 - the dodge the charge turn never had, the evolution rows' two columns, Dark Matter's gate, the sign's black square

- **`[Task-168]`** claims `src/scenes/BattleScene.ts` (the batch's one),
  `src/engine/battle/{turn,fighter,volatile,commands}.ts` + their tests and `docs/battle-spec.md`
  **§4** — the batch's only claimant of `src/engine/battle/turn.ts`.
- **`[Task-162]`** claims `src/scenes/panels/detail.ts`, `src/ui/evolutionGraph.ts` + test,
  `src/ui/hud/panels/detail/{evolution.ts,evolution.test.ts,detailPanel.tsx}`, the **i18n pair** and
  `docs/design-spec.md` **§3**.
- **`[Task-172]`** claims `src/engine/battle/randomAbility.ts` + test, `docs/data-spec.md` **§3** and
  `docs/battle-spec.md` **§11.1**.
- **`[Task-165]`** claims `scripts/frlg/build-sign.mjs`, `scripts/assets/build-placeholders.mjs`,
  `src/assets/placeholders/frlg/sign.png`, `src/data/tilesets/props.ts` + test,
  `src/scenes/BootScene.ts` and `docs/tileset-spec.md` **§2**.
- **The hot files:** `BattleScene.ts` and `turn.ts` → 168; `panels/detail.ts` and the i18n pair →
  162; `src/data/tilesets/props.ts` → 165. `docs/battle-spec.md` is split **by section** again (§4
  by 168, §11.1 by 172) and is the only shared document. No generated file, no `src/data/dex/**` and
  no `package.json` is claimed.
- **No `SAVE_VERSION` step**; the four slots are full and no two tasks share a path.

- [x] **[Task-168] Dig and Dive dodge on the charge turn, and the second turn never asks for a
      command.** «excavar, buceo deberia esquivar y ademas no poder usar el menu pasan dos turnos
      auto». The charge half ships: `move.flags.charge` sets `volatiles.charging = move.id` and
      returns after the charge line (`turn.ts` 1033-1044, the verbs at 731-745) and the next turn's
      command is discarded in favour of `lockedMove` (758-773). Two things never happen: the fighter
      is **hittable** on the charge turn — no flag is set or read, and neither `moveAims` nor the
      damage loop (1225-1263) asks — and the scene still opens the command menu on the second turn
      (`finishFeed` 1840 → `openMenu`), so the player picks a move the engine then throws away.
      **Fix shape:** `volatiles.semiInvulnerable: string | null` on `BattleFighter` (`fighter.ts`
      58-59 is the `charging` sibling), set on the charge turn for `dig`, `dive`, `fly`, `bounce`,
      `phantomforce` and `shadowforce` and cleared when the move fires; a move aimed at a
      semi-invulnerable target **misses** (`battle.log.missed`) except `earthquake`/`magnitude`
      against Dig and `gust`/`twister` against Fly/Bounce, which double, as the dex says; and one
      pure `chargingCommand(state, side)` in `commands.ts` lets `finishFeed` submit the locked move
      for a charging slot instead of opening the menu, so both turns run themselves. **Docs:**
      `docs/battle-spec.md` §4 (the volatile and the two-turn rule). **Tests:** `[unit]`
      `turn.test.ts` — a fixed seed where the foe's Tackle misses the Digging fighter on the charge
      turn and lands on the second; `[unit]` a fixed seed where the foe's `earthquake` still hits
      Dig; `[unit]` `commands.test.ts` — `chargingCommand` answers `dig` while `charging === 'dig'`
      and null otherwise; `[live]` Dig into a trainer and watch the menu never open on turn two.
      Claims `src/engine/battle/turn.ts`, `src/engine/battle/fighter.ts`,
      `src/engine/battle/volatile.ts`, `src/engine/battle/commands.ts` + their tests,
      `src/scenes/BattleScene.ts`, `docs/battle-spec.md` §4. *Dependencies:* none. *(Batch 76)*

- [x] **[Task-162] A Mega and a G-Max row read like a species row: name left, stone right.** «el texto
      de megas en panel evolucion debera ser izquierda nombre y derecha donde sale el nivel nombre
      piedra, igual para gigamax». `evolutionGraph` gives each battle-only row its whole copy as the
      **name**: `megaRowName` returns `t('detail.megaEvolvesWith', { stone })` — `'{stone}'` in both
      locales (`src/i18n/en.ts` 352-353, `src/i18n/es.ts` 355-356) — and `gmaxRowName` returns
      `'{forme} · {stone}'` (`src/ui/evolutionGraph.ts` 57-68), while `pushForme` leaves `level: null`
      (114-129). The row therefore prints the stone (Mega) or "Gigantamax X · stone" (G-Max) in the
      **left** column and nothing in the right one, which draws `''` for a null level in Phaser
      (`detail.ts` 607) and no `<text>` at all in the DOM (`detail/evolution.ts` 51,
      `detailPanel.tsx` 250-254). `[Task-21]` (Batch 9) put the copy there on purpose. **Fix shape:**
      `FamilyNode` gains `note: string | null` — the right column's text — with `name` = the forme's
      readable name (`formeDisplayName`, 48-55) and `note` = `mega.stoneName` / `gmax.stoneName`;
      both renderers print `node.level === null ? (node.note ?? '') : t('detail.evoLevel', { level })`
      right-aligned, so Mega, G-Max and species rows share one arithmetic. The two i18n keys shrink to
      the bare stone (or retire if the note carries it directly). **Docs:** `docs/design-spec.md` §3
      (the STATS tab's evolution bullet gains the two-column rule). **Tests:** `[unit]`
      `evolutionGraph.test.ts` — the two name expectations flip and a new one asserts name/note for
      Mega X, Mega Y and G-Max; `[unit]` `detail/evolution.test.ts` — a Mega row's right column is
      the stone, not null; `[live]` a Charizard's STATS tab at 390×844 with both rows legible and the
      stone right-aligned. Claims `src/ui/evolutionGraph.ts` + test, `src/scenes/panels/detail.ts`,
      `src/ui/hud/panels/detail/{evolution.ts,evolution.test.ts,detailPanel.tsx}`, `src/i18n/en.ts`,
      `src/i18n/es.ts`, `docs/design-spec.md` §3. *Dependencies:* none. *(Batch 76)*

- [ ] **[Task-172] Dark Matter is reachable only through a dark catch.** «me ha salido en hierba un poke
      con habilidad materia oscura, pero esta solo deberia salir con huevo oscuro del team rocket».
      `randomAbilityPool` (`src/engine/battle/randomAbility.ts` 31-40) is built from **every
      registered ability effect**, and `[Task-151]`'s hand-authored row registers `darkmatter` like any
      other (`onModifyEffectiveness` in `effects/abilities.ts`), so a plain wild rolls it; `BANNED`
      (15-22) is the only filter and does not name it. The dark path grants it explicitly and needs
      nothing from the pool (`asDark`, `src/engine/run/dark.ts` 31-45, `DARK_ABILITY` at 7). **Fix
      shape:** `darkmatter` joins `BANNED` with the reason written beside it ("the dark catch is the
      only grant"), and the pool's fixed-seed expectations are **re-pinned** in this task rather than
      left stale, as `[Task-151]`'s own entry demands. **Docs:** `docs/data-spec.md` §3 (the
      `customAbilities.ts` row gains the grant rule) and `docs/battle-spec.md` §11.1 (the pool
      paragraph, 699-716). **Tests:** `[unit]` `randomAbility.test.ts` — the pool holds no
      `darkmatter` and 10 000 seeds never yield it, while a seeded dark catch still carries it;
      `[unit]` `dark.test.ts` — `asDark` still gives `Dark Matter` plus its rolled second ability;
      `[unit]` the re-pinned draws (`npm test -- randomAbility dark`). Claims
      `src/engine/battle/randomAbility.ts` + test, `docs/data-spec.md` §3, `docs/battle-spec.md`
      §11.1. *Dependencies:* none — `[Task-151]`, `[Task-153]` and `[Task-154]` all shipped.
      *(Batch 76)*

- [ ] **[Task-165] The boss door's sign is never an opaque square.** «tarea cartel del boss el sprite
      sale mal sale cuadrado negro». `PROP_SIGN_URL` falls back to
      `src/assets/placeholders/frlg/sign.png` whenever the gitignored packed crop is absent
      (`src/data/tilesets/props.ts` 17-19), and the placeholder generator paints **every** atlas as
      one opaque `FILL` square with a lighter border and alpha 255
      (`scripts/assets/build-placeholders.mjs` 47-70) — and the sign is a 16×16 prop scaled to a 24px
      tile at depth 5 (`RouteScene.drawSigns`, 2143-2155), so a checkout whose pack predates
      `[Task-161]`'s new `assets:pack` step draws a solid slate-black block on the door. Nothing
      catches it: `build-sign.mjs` copies the cell as-is with no key and no uniformity check (32-40),
      and the only test is `describe.skipIf(!hasArt('frlg/sign.png'))` and counts alpha 0 alone
      (`props.test.ts` 21-40). **Fix shape:** (a) the placeholder generator grows a per-atlas branch
      for `frlg/sign.png` that writes a **transparent** 16×16 signboard-with-post silhouette (alpha 0
      outside it), so a clean clone can never paint a solid square; (b) `build-sign.mjs` fails loudly
      when the crop is flat — fewer than three distinct opaque colours, or more than 40 % near-black
      pixels — and prints the source cell it cut; (c) `props.test.ts`'s always-run half asserts the
      placeholder's four corners are alpha 0 and its opaque pixel count sits between 40 and 200, and
      the packed half keeps the 68-transparent-pixel pin *and* gains the colour-spread assertion.
      **Docs:** `docs/tileset-spec.md` §2 (the prop texture's alpha and its placeholder). **Tests:**
      `[unit]` `props.test.ts`'s two halves (`npm test -- props`), the packed half running only where
      the art exists and the placeholder half always; `[unit]` the packer's guard is a
      `node scripts/frlg/build-sign.mjs` gate QA runs against a synthetic flat cell; `[live]` the boss
      door's sign in a packed checkout, 16×16 with the ground visible at its corners. Claims
      `scripts/frlg/build-sign.mjs`, `scripts/assets/build-placeholders.mjs`,
      `src/assets/placeholders/frlg/sign.png`, `src/data/tilesets/props.ts` + `props.test.ts`,
      `src/scenes/BootScene.ts`, `docs/tileset-spec.md` §2. *Dependencies:* none — `[Task-161]`
      shipped; this repairs its prop. *(Batch 76)*

### Batch 77 - Rage Fist's climbing power, a TM that cannot be rolled twice, disabled rows the arrows can reach, a merchant on every floor

- **`[Task-173]`** claims `src/engine/battle/{turn,fighter,damage,preview,moveAudit}.ts` + their
  tests, the **generated** coverage pair and `docs/battle-spec.md` **§3.1** — the batch's only
  claimant of `src/engine/battle/turn.ts` and of the generated pair.
- **`[Task-176]`** claims `src/scenes/RouteScene.ts` (the batch's one),
  `src/engine/routes/sketch.ts` + test, `src/engine/run/items.ts` + test and
  `docs/routes-spec.md` **§2**.
- **`[Task-166]`** claims `src/scenes/BattleScene.ts` (the batch's one), `src/ui/moveGrid.ts` + test,
  `src/ui/partyGrid.ts` + test and `docs/design-spec.md` **§10.3** (the command and switch rows only).
- **`[Task-170]`** claims `src/data/npcs.ts` + `src/data/npcs.test.ts`,
  `src/engine/routes/npcs.test.ts` and `docs/maps-spec.md` **§7** (the guaranteed-NPC paragraph
  only).
- **The hot files:** `turn.ts` and the generated coverage pair → 173; `RouteScene.ts` → 176;
  `BattleScene.ts` → 166. Four disjoint path sets. `docs/routes-spec.md` §2 is 176's (175 took the
  same file in Batch 75, a different batch) and `docs/maps-spec.md` §7 is 170's paragraph only.
- **No `SAVE_VERSION` step**: the TM rule and the merchant guarantee both read shipped state and the
  plan. Four slots, four devs, no shared path.

- [ ] **[Task-173] Rage Fist's power climbs with the hits its user has taken, in the menu and in the
      damage.** «el move puño furia en menu no veo se actualice el poder al recibir golpe». The move is
      **`ragefist`** (*Puño Furia*, `src/data/i18n/es/moves.json` 2772-2776), and the engine treats it
      as its dex `basePower` 50: `resolveBasePower`'s switch has no `ragefist` case
      (`src/engine/battle/damage.ts` 190-260) and `MOVE_AUDIT_ROWS` only probes it against a Mew
      (`moveAudit.test.ts` 46), so nothing counts the hits; `preview.ts` calls the same
      `resolveBasePower` (82), so the battle's grid prints the flat number too. **Fix shape:**
      `volatiles.timesHit` on `BattleFighter`, incremented in the damage loop beside
      `physicalDamageTaken` (`turn.ts` 1276-1280, once per **hit**, capped at 6), and one
      `case 'ragefist': return Math.min(350, 50 + 50 * attacker.volatiles.timesHit)` in
      `resolveBasePower` — the single function the formula **and** `movePreview` read, so the menu can
      never disagree with the hit. The audit row gains the arithmetic: two hits taken → 150, six →
      350. **Docs:** `docs/battle-spec.md` §3.1 (the number the formula multiplies). **Tests:**
      `[unit]` `damage.test.ts` — 0/1/3/9 hits read 50/100/200/350; `[unit]` `preview.test.ts` — the
      preview's `basePower` after two hits is 150 in the same state the turn uses; `[unit]` a
      fixed-seed turn where the user is hit twice and then lands the 150-power punch; `[unit]` the
      audit row. Claims `src/engine/battle/fighter.ts`, `src/engine/battle/turn.ts`,
      `src/engine/battle/damage.ts`, `src/engine/battle/preview.ts`,
      `src/engine/battle/moveAudit.ts` + their tests, the generated
      `docs/balance/effect-coverage.md` + `src/data/moveCoverage.json`, `docs/battle-spec.md` §3.1.
      *Dependencies:* none. *(Batch 77)*

- [ ] **[Task-176] A TM is never generated twice as a ground item in one run.** «no debe poder salir
      una mt de objeto dos veces». The ground items are rolled from the band's pool with `pickWeighted`
      and no memory (`src/engine/routes/sketch.ts` 1264-1282), and a TM is a **reusable key**
      (`src/data/tms.ts` 10-13), so a second copy is dead weight: the pools carry two to four TM ids
      per band (`src/data/loot.ts` 50, 63, 77-78, 122-123, 173-174, 215-216) and the same id can be
      drawn on two rooms of a run or twice inside one room's item list. **Fix shape:** the sketch
      request gains `lootExclude?: readonly string[]` (the ids the run already owns) and the item pass
      threads a `taken` set that both seeds from it and drops an id from the weighted pool once used;
      `RouteScene`'s build site passes the bag's TM ids through a new pure `ownedTmIds(run)` in
      `src/engine/run/items.ts`. Only the TM subset is filtered — a second Potion stays legal — so the
      weighted table moves for TM-bearing pools alone. **Docs:** `docs/routes-spec.md` §2 (the loot
      rule gains "a TM is unique to the run"). **Tests:** `[unit]` `items.test.ts` — `ownedTmIds`
      reads `tm###` ids and nothing else; `[unit]` `sketch.test.ts` — 40 fixed seeds with the full TM
      pool never place one TM twice in a route; `[unit]` a **fixed-seed regression** pinning the
      route's item list before and after, because the filtered pool shifts the draw (the seed is
      re-pinned in this task, never left stale). Claims `src/engine/routes/sketch.ts` + test,
      `src/engine/run/items.ts` + test, `src/scenes/RouteScene.ts`, `docs/routes-spec.md` §2.
      *Dependencies:* none — a filter over the shipped pools, and `[Task-52]`'s `pickedItems` idiom
      ships. *(Batch 77)*

- [ ] **[Task-166] The arrows reach a disabled row instead of jumping over it.** «en menu combate con
      flechas deberias poder pasar por item menu aun que esta disabled, igual con pokes en switch».
      `moveMenu` (`src/scenes/BattleScene.ts` 2887-2896) advances until an `enabled` row, so the
      SWITCH grid skips a fainted party member, and `moveMenuGrid` (2922-2992) does the same at 2987,
      so the command grid skips a disabled BAG / SWITCH / RUN. Both skips are the shipped accessibility
      rule (`docs/design-spec.md` §10.3, `[Task-08]`) and `[Task-143]`'s switch card inherits it, so
      this is a decision change, not a regression: the cursor must stop on a dimmed row, and
      `confirmMenu`'s `item?.enabled` gate (3007-3008) already refuses it. **Fix shape:** the party
      list and the command grid step over **every** index; the moves grid keeps its skip (a 0 PP or
      barred move must not be reachable), expressed as one flag on the grid step
      (`skipDisabled: this.mode === 'moves'`), and the party list gets a pure
      `stepPartyCursor(index, delta, count)` in `src/ui/partyGrid.ts` that never skips. **Docs:**
      `docs/design-spec.md` §10.3, the **command grid** and **switch grid** rows only — each gains
      "the cursor visits a disabled row and `confirm` declines it". **Tests:** `[unit]`
      `partyGrid.test.ts` — a fainted row in the middle is reachable from both sides and the list
      wraps; `[unit]` `moveGrid.test.ts` — the grid step lands on index 1 even when it is disabled
      with the flag off and skips it with the flag on; `[live]` one screenshot with the cursor on a
      disabled BAG row and one on a fainted party row. Claims `src/scenes/BattleScene.ts`,
      `src/ui/moveGrid.ts` + test, `src/ui/partyGrid.ts` + test, `docs/design-spec.md` §10.3 (two
      rows). *Dependencies:* none. *(Batch 77)*

- [ ] **[Task-170] Every floor, map 1 included, posts one merchant.** «en todos los pisos deberia salir
      1 npc mercader que vende items». The framework ships and is honest about the gap: the merchant
      is the table's one guaranteed row with `guaranteedFromMap: 2` (`src/data/npcs.ts` 92-102) and
      `mapIndex` is **1-based** (`effectiveNpcChance` reads `mapIndex - 1`,
      `src/engine/routes/npcs.ts` 62-65), so floor 1 has none — and two tests pin exactly that
      (`npcs.test.ts` 169-186, "leaves map 1 merchant-free"; `src/data/npcs.test.ts` 63).
      `guaranteedNpc` places it in `firstTrainerRoom(plan)` (`routes/npcs.ts` 122-134,
      `plan.ts` 660-665), which every shipped floor holds because `TRAINER_ROOMS_PER_MAP` is 2+.
      **Fix shape:** `guaranteedFromMap: 1`, the two tests flipped, and the one silent failure the
      entry closes: `RouteScene.rollRoomNpc` drops the placement whole when the sprite is missing
      (`RouteScene` 774), so `npcs.test.ts` asserts `overworldSpriteFrame('merchant')` is not null at
      build time and the runtime skip stays a last resort. No run field and no state: the guarantee
      reads the plan, so **no `SAVE_VERSION` step**. **Docs:** `docs/maps-spec.md` §7 (the guaranteed
      NPC paragraph, "from map 2 on" becomes every floor). **Tests:** `[unit]` `npcs.test.ts` — maps
      1…8 all answer the merchant and map 1's room is still a `trainers` room on 20 seeds;
      `[unit]` `npcs.test.ts` — a table with one `fromMap 1` row and one `fromMap 3` row still
      resolves in table order; `[live]` a fresh run's first floor shows the merchant and its card opens
      the Mart. Claims `src/data/npcs.ts`, `src/data/npcs.test.ts`, `src/engine/routes/npcs.test.ts`,
      `docs/maps-spec.md` §7 (the guaranteed-NPC paragraph). *Dependencies:* none. *(Batch 77)*

### Batch 78 - the field that must break, the bag's keys and its click, Don Natural's power, the Mart's prices and its sold-out rows

- **`[Task-174]`** claims `src/engine/battle/{turn,fighter}.ts` + their tests, `docs/battle-spec.md`
  **§4** and `docs/maps-spec.md` **§7**'s `endure` row.
- **`[Task-169]`** claims `src/scenes/BattleScene.ts` (the batch's one), `src/ui/bag.ts` + test,
  `src/ui/hud/panels/battle-bag/{battleBagPanel.tsx,view.ts,view.test.ts}` and
  `docs/design-spec.md` **§10.3** (the bag row only).
- **`[Task-177]`** claims the new `src/engine/battle/movePower.ts` + test, `src/ui/partyDetail.ts` +
  `partyDetail.test.ts`, `src/engine/README.md` and `docs/battle-spec.md` **§2**.
- **`[Task-178]`** claims `src/data/items.ts` + test, `src/ui/shop.ts` + test,
  `src/scenes/rooms/shop.ts`, `src/scenes/panels/shop.ts`, `docs/balance/economy.md` and
  `docs/maps-spec.md` **§7**'s Mart-stock paragraph.
- **The hot files:** `turn.ts` → 174; `BattleScene.ts` → 169; `partyDetail.ts` → 177;
  `src/data/items.ts` and `docs/balance/economy.md` → 178. `docs/maps-spec.md` §7 is split **by
  block** — 174 the room-effect table's `endure` row, 178 the Mart stock paragraph — and
  `docs/battle-spec.md` by section (§4 by 174, §2 by 177); Integration QA reads the combined §7 for
  lost lines. No generated file, no `src/main.ts` and no `package.json` is claimed.
- **No `SAVE_VERSION` step**: the sold-out marks ride `pickedItems`, the field break is battle-local
  and the price is a data row. Four slots, four devs.

- [ ] **[Task-174] The room's Endure spares a hit only at full HP, and breaks when it does.** «el campo
      que hace resistir a 1 hp solo debe ser si tiene toda la vida es como tener 1 cinta aguante que se
      rompe». The effect is the **field** condition `endure` (`src/data/battlefields.ts` 15/61, a
      battlefield the route seeds into `state.roomField`; `src/data/bosses.ts` 94 names it among the
      boss-room fields) — not the move `Endure` and not Sturdy, whose own line is
      `battle.log.ability.sturdy`. `turn.ts` 1254-1263 clamps the damage when
      `state.roomField.endure && hitTarget.hp > 1`, i.e. at **any** HP above 1, and it re-arms on
      every hit of the whole battle. **Fix shape:** the gate becomes "the target entered the hit at
      full HP" (`hitTarget.hp === hitTarget.maxHp`) **and** the field has not already been spent by
      that fighter — a new `volatiles.roomEndureUsed` written where the clamp fires — so a second
      lethal hit KOs; the item twin is the shipped `survive` row (`src/data/items.ts` 466). The move
      and the ability are untouched. **Docs:** `docs/battle-spec.md` §4 (the room field's paragraph)
      and `docs/maps-spec.md` §7's **`endure` row only** (not the Mart paragraph beside it).
      **Tests:** `[unit]` `turn.test.ts` — a full-HP target survives a lethal hit at 1 and a second
      lethal hit KOs; a target at 70 % is KO'd by the first; `[unit]` a fixed seed pins the two lines'
      order and the exact 1 HP; `[live]` the boss arena breaks once per Pokémon. Claims
      `src/engine/battle/turn.ts` + `turn.test.ts`, `src/engine/battle/fighter.ts` +
      `fighter.test.ts`, `docs/battle-spec.md` §4, `docs/maps-spec.md` §7 (the `endure` row).
      *Dependencies:* none. *Decision:* resolved — the report says "el campo", the field is the only
      battle-long spare, and Sturdy already reads as its own ability line. *(Batch 78)*

- [ ] **[Task-169] The battle Bag's keys reach the pocket row, and a click picks a stack.** «en menu
      combate items con las teclas deberias poder subir a las categorias para moverte y seleccionar
      item con click ahora solo va con enter». Two seams: `navigateMenu`'s bag branch only steps the
      stack grid (`BattleScene` 2904-2910 → `stepBagGrid`, `src/ui/bag.ts` 188-208), so **no key
      reaches the pocket tabs** — they answer the pointer and `[`/`]` alone (2720-2729, 1545-1550) —
      and a canvas click on a stack only **selects** it (`selectBagCell` 2731-2739, whose comment says
      "It never submits"), while the DOM card arms and uses on a second press
      (`cellPressIntent`, `battle-bag/battleBagPanel.tsx` 47-52). **Fix shape:** one
      `bagFocus: 'tabs' | 'grid'` beside `bagCategory`, with a pure stepper in `src/ui/bag.ts`
      (`stepBagFocus(focus, index, action, count, columns)`) — `up` from the grid's top row moves to
      the tabs, `left`/`right` there cycle the pockets through the shipped `cycleBagTab`, `down`
      returns to the grid — and a click on a stack selects **and uses** it, so the canvas answers
      exactly as `confirm` does and `cellPressIntent` always answers `use` for a stack. The
      arm/use split and the disabled rows' rule stay. **Docs:** `docs/design-spec.md` §10.3, the
      **bag row** only. **Tests:** `[unit]` `bag.test.ts` — the focus walks grid → tabs → grid and
      the pocket cycle wraps; `[unit]` `battle-bag`'s view test — `cellPressIntent` answers `use` for
      a stack and `select` only for an empty cell; `[live]` arrows up into the tabs and switch
      pockets, then one click on a Potion spends it. Claims `src/scenes/BattleScene.ts`,
      `src/ui/bag.ts` + test, `src/ui/hud/panels/battle-bag/{battleBagPanel.tsx,view.ts,view.test.ts}`,
      `docs/design-spec.md` §10.3 (the bag row). *Dependencies:* none. *Decision:* the click is
      one-press here (the report says the click does nothing today); if the human wants the DOM's
      arm-then-use kept, only `cellPressIntent`'s line changes. *(Batch 78)*

- [ ] **[Task-177] Natural Gift's power follows its berry, not only its type.** «move don natural se
      actualiza tipo al llevar equipado baya pero deberia tambien actualizar poder». The move is
      **`naturalgift`** (*Don Natural*, `src/data/i18n/es/moves.json` 2342-2346). The type half ships
      twice — `effectiveMoveType` reads the berry's `naturalGift.type` (`src/engine/battle/moveType.ts`
      93-104) and the engine's own `onModifyMove` rewrites **both** type and `basePower`
      (`effects/items.ts` 389-412) — but the **panel** builds its power from the dex alone:
      `moveDetails` takes `basePower = move?.basePower ?? 0` and only the type through
      `effectiveMoveType` (`src/ui/partyDetail.ts` 142-167), so the MOVES tab prints Natural Gift's dex
      0 for a berry it has already retyped. **Fix shape:** a new pure
      `effectiveMovePower(ability, itemId, move, ivs)` beside `effectiveMoveType` (new
      `src/engine/battle/movePower.ts`) that applies the same held-item rows the type does —
      `naturalgift` → the berry's `naturalGift.basePower`, every other id unchanged — and `moveDetails`
      calls it for `basePower`/`power`; the engine's `onModifyMove` stays the in-battle authority, and
      one test asserts the two agree for the eleven hand-authored berries and for a berry-less holder.
      **Docs:** `docs/battle-spec.md` §2 (the item-retype table, `D37`) and `src/engine/README.md`'s
      `battle/` line for the new module. **Tests:** `[unit]` `movePower.test.ts` — `sitrusberry`
      gives Natural Gift its berry power and `null` leaves the dex value; `[unit]`
      `partyDetail.test.ts` — the detail's move row carries the berry power with the berry equipped;
      `[unit]` the agreement test against `runModifyMove`; `[live]` the MOVES tab with and without
      the berry. Claims `src/engine/battle/movePower.ts` (new) + test, `src/ui/partyDetail.ts` +
      `src/ui/partyDetail.test.ts`, `src/engine/README.md`, `docs/battle-spec.md` §2.
      *Dependencies:* none. *(Batch 78)*

- [ ] **[Task-178] A held berry costs what a held item costs, and a bought shop row leaves the shelf.**
      Two coupled fixes in the Mart. **Price:** «el precio de las bayas equipables deberia ser mas alto
      ya que ... no se consumen» — every berry the engine never spends is a permanent held slot at
      **200** (`NOOP_BERRY_ITEMS`, `src/data/items.ts` 772-785, the eleven ids the `mid`/`high`/`late`
      rotation sells, `src/data/shop.ts` 72-136), while a permanent held item costs 1000-4000 (Silk
      Scarf 1527-1534, Leftovers 1489-1496), so the rule freezes as "a `kind: 'held'` item without
      `consumed: true` costs at least the 1000 tier" and the eleven move to 1000; the **consumed**
      berries keep their 100-200 (Sitrus 1497-1506) because they are spent. **Shelf:** «al comprar 1
      objeto en la tienda ... deberia desaparecer de las opciones de compra» — `buyRows` renders the
      whole stock (`src/ui/shop.ts` 142-159) and `buyItem` (100-105) adds the units with no record, so
      the row returns on the next open of either card (`src/scenes/rooms/shop.ts` 144-182,
      `src/scenes/panels/shop.ts`). **Fix shape:** `buyItem(run, slot, floorKey)` marks
      `shop-<mapIndex>-<itemId>` through the shipped `markItemPicked` (`src/engine/run/state.ts`
      588-595) and `buyRows(run, stock, mapIndex)` drops the rows whose mark is set — the 10× pack and
      the potion rung as much as a held row — with both cards passing `host.run.mapIndex`. **No run
      field**: `pickedItems` is already saved, so **no `SAVE_VERSION` step**. **Docs:**
      `docs/balance/economy.md` (the held-tier floor and the sold-out rule) and `docs/maps-spec.md`
      §7's **Mart-stock paragraph only** (not the `endure` row beside it). **Tests:** `[unit]`
      `items.test.ts` — no `kind: 'held'` item without `consumed` costs under 1000; `[unit]`
      `shop.test.ts` — a purchase marks the row and the same floor's next `buyRows` drops it, a second
      floor keeps its own shelf, and the pack drops whole; `[live]` buy the 10× pack, close and reopen
      the Mart and the row is gone. Claims `src/data/items.ts` + `src/data/items.test.ts`,
      `src/ui/shop.ts` + `src/ui/shop.test.ts`, `src/scenes/rooms/shop.ts`, `src/scenes/panels/shop.ts`,
      `docs/balance/economy.md`, `docs/maps-spec.md` §7 (the Mart-stock paragraph).
      *Dependencies:* none. *(Batch 78)*

### Batch 79 - the MOVES tab stays, and the boss fights only when spoken to

- **`[Task-171]`** claims `src/scenes/panels/detail.ts`, `src/ui/partyDetail.ts` +
  `partyDetail.test.ts` and `docs/design-spec.md` **§3**.
- **`[Task-180]`** claims `src/scenes/RouteScene.ts` (the batch's one),
  `src/engine/routes/{routeMap,trainers}.ts` + `trainers.test.ts`,
  `src/engine/routes/sketch.test.ts` (the boss-tile adjacency pin, test-only),
  `src/scenes/rooms/miniBoss.ts` and `docs/routes-spec.md` **§2** + `docs/maps-spec.md` **§6**.
- **Why 180 rides here:** the round's last two reports both need
  `src/scenes/RouteScene.ts`, so they can never share a batch, and 79 is the **earliest pending
  batch that still has a free slot** with the scene free — 75 holds the scene (164) and 77 holds it
  (176), while 76 and 78 are **full** at four tasks each even though their scene slot is open. 180's
  paths are disjoint from 171's, so the batch is an antichain and runs as one dev wave and one QA
  wave. Folding it here fills the round's widest gap and keeps the boss fix in the **fifth** wave
  instead of a sixth.
- **The hot files:** `panels/detail.ts` and `partyDetail.ts` → 171; `RouteScene.ts` and
  `docs/routes-spec.md` → 180 (179 takes the same document's §3/§6 in Batch 80, a different batch).
  No generated file, no `src/data/dex/**` and no `package.json` is claimed.
- **No `SAVE_VERSION` step**: the tab is in-memory and the aggro flag is a route record, not a run
  field. Two slots, two devs, disjoint paths.

- [ ] **[Task-171] The MOVES tab survives a change of member.** «si estas en info poke en pestaña move y
      seleccionas otro poke mantenerte en tab move y no pasar a stats». `openMemberDetail` always
      builds the state with the default tab — `hudDetailState = openDetail(memberId)`
      (`src/scenes/panels/detail.ts` 1089-1108) and `openDetail(memberId, tab = 'stats')`
      (`src/ui/partyDetail.ts` 254-256) — so every pick snaps to STATS even when the panel is already
      open on MOVES. Both entry points funnel through it: the canvas row press (`RouteScene`
      1822-1827) and the DOM party row (`detail.ts` 1797-1812), and `[Task-132]`'s card is the one
      window either way. **Fix shape:** `openMemberDetail` keeps the tab it already has
      (`hudDetailState.memberId !== null ? hudDetailState.tab : 'stats'`) and passes it to
      `openDetail(memberId, tab)`; a closed panel still opens on STATS, and the drag, the search field,
      the query and the nickname edit still reset exactly as they do now. **Docs:**
      `docs/design-spec.md` §3 (the detail window's tab sentence gains "the tab belongs to the panel,
      so picking another member keeps it"). **Tests:** `[unit]` `partyDetail.test.ts` — the carried
      tab through a new `carriedDetailTab(state)` beside `openDetail` (`'moves'` stays `'moves'`, a
      closed state answers `'stats'`); `[unit]` the re-open keeps `grab: null` and the new member id;
      `[live]` MOVES → click another party row → MOVES is still selected, on `?hud=dom` and on the
      canvas card. Claims `src/scenes/panels/detail.ts`, `src/ui/partyDetail.ts` +
      `src/ui/partyDetail.test.ts`, `docs/design-spec.md` §3. *Dependencies:* none. *(Batch 79)*

- [ ] **[Task-180] The map boss and the mini-boss never open a battle by looking at the player.**
      «el boss y miniboss no tienen rango para iniciar combate es solo interactuando». Both are ordinary
      `RouteTrainer`s with a live line of sight, so both aggro: the boss is appended to
      `route.trainers` facing the door with `sight: DEFAULT_TRAINER_SIGHT` (`bossTrainer`,
      `src/scenes/RouteScene.ts` 954-964, appended at 703-706) and the mini-boss's fixture does the same
      (`src/scenes/rooms/miniBoss.ts` 16-29, `sight` at 26), while `trainerSpotted()` (2690-2699) scans
      **every** undefeated trainer through `seesPlayer` after each step (2547-2548) and the spinner tick
      repeats the check on a facing change (4452-4470); `seesPlayer` is the one gate
      (`src/engine/routes/trainers.ts` 61-75). The interact path already opens both: `tryInteract` →
      `liveTrainerAt` → `startTrainerBattle` (2907-2925), which resolves `boss`/`miniboss` by id
      (2835-2837). **Fix shape:** `RouteTrainer` gains `aggro?: boolean` (absent = true,
      `src/engine/routes/routeMap.ts` 35-46) and `seesPlayer` answers `false` when it is `false` — one
      gate for both triggers, `sightLine` and the placement validation untouched; `bossTrainer` and the
      mini-boss fixture set `aggro: false` and keep their `sight`, `facing` and ids byte-identical, so
      no seed, topology or validation moves. **The soft-lock guard the rule needs:** with the "it walks
      over" fallback gone, the sealed boss room must still be winnable, so the boss's tile keeps a
      walkable cardinal neighbour reachable from the room entry and the spec pins it on 20 seeds (the
      mini-boss's `farthestRoomTile()` is on the entry's BFS tree by construction, so its neighbour is
      free); the docs' anti-soft-lock argument is reworded from "it walks over" to "it can always be
      reached and spoken to". **Docs:** `docs/routes-spec.md` §2 (the line-of-sight paragraph, 116-133,
      gains "the map boss and the mini-boss never watch") and `docs/maps-spec.md` §6 (262-265: the
      sentence that says the boss "walks over and opens the fight on its own"). **Tests:** `[unit]`
      `trainers.test.ts` — a trainer facing the player one tile away answers `false` with `aggro: false`
      and `true` without it, and the same for a spun facing; `[unit]` `sketch.test.ts` — on 20 fixed
      seeds the boss's tile has a walkable cardinal neighbour on the entry's BFS tree; `[unit]` the
      mini-boss fixture answers `aggro === false` (`fixtures.test.ts`); `[live]` stand three tiles down
      the boss's lane for five seconds with no key (no battle, no chase), then press `E` facing it (the
      battle opens with the six/three-member roster); the same two steps on a mini-boss. Claims
      `src/engine/routes/routeMap.ts`, `src/engine/routes/trainers.ts` + `trainers.test.ts`,
      `src/engine/routes/sketch.test.ts`, `src/scenes/RouteScene.ts`,
      `src/scenes/rooms/miniBoss.ts`, `src/scenes/rooms/fixtures.test.ts` (its `toEqual` fixture gains
      the flag), `docs/routes-spec.md` §2, `docs/maps-spec.md` §6.
      *Dependencies:* none. *(Batch 79)*

### Batch 80 - the PC swaps only in the floor's entry room, and the capture-time swap is gone

- **`[Task-179]` alone**, and the constraint is the one this round cannot fill: every other pending
  task is already scheduled, and its hot file `src/scenes/RouteScene.ts` is **180's in Batch 79** and
  the two batches before that (164 in 75, 176 in 77), so no legal mate exists in 78 or 79 — 78 is full
  besides. It is the round's last task, and the only one that touches `src/engine/save.ts`.
- **The hot files:** `src/scenes/RouteScene.ts` (the debug teleport's two lines), `src/engine/save.ts`
  and `src/engine/run/state.ts`; `docs/routes-spec.md` §3 and §6 are free here (180 wrote §2 in 79),
  and `docs/design-spec.md` §3 is free too though 171 wrote its tab sentence in 79 and 162 its
  evolution bullet in 76 — 179 takes the **swap bullet** only.
- **No `SAVE_VERSION` step** — the task **removes** two run fields and adds none; the argument is in
  its entry's `*Decision:*` line.

- [ ] **[Task-179] The PC swaps only in the floor's entry room, always, and never as part of a catch.**
      «cambiar funcionamiento panel pc para que sea, solo se puede intercambiar pokes pc a party o
      viceversa en la sala de inicio de piso, quita lo de que al capturar se pueda hacer el cambio pero
      en sala inicial siempre se puede». The rule is two predicates in
      `src/engine/run/state.ts`: `pcFullyEditable` (527-529) refuses the entry room after a return
      because it also requires `!run.entryDeparted`, and `pcMemberEditable` (536-543) grants a second
      window to the room's own catch through `pcCatch` — the capture-time swap the report kills
      (recorded by `addCaughtPokemon`, 551-555; set by `advanceRoute` at 233-234; migrated from the v15
      `pcUnlocked` at `src/engine/save.ts` 390-400). Every gate reads those two functions: the DOM PC
      card (`src/scenes/panels/pc.ts` 276, 302, 381) and the canvas party/PC screen's `canGrab` /
      `canSwapAcross` (`src/ui/partyScreen.ts` 130-141), so no UI file owns the rule. **Fix shape:**
      `pcFullyEditable(run)` becomes `run.routeInMap === 0` (the documented entry id, 522-526) and
      `pcMemberEditable(run)` becomes exactly it — the `memberId` parameter retires, and each call site
      passes the run alone; a catch that lands in the PC is then withdrawable only from the entry room,
      on the first visit or a return. **Then the two fields retire with their last readers**, because
      "delete the seam" is this repo's rule (`[Task-31]` did it to the capture screen): `RunState.pcCatch`
      (83-88) and `RunState.entryDeparted` (77-82) leave the type, `createRun`/`advanceRoute`/`advanceMap`
      stop writing them (184-185, 233-234, 264-265), `dedupeMemberIds`'s `pcCatch` re-key (362-410) goes,
      the decoder stops reading both (`parsePcCatch` at `save.ts` 791, its two uses at 970/1007, the
      `entryDeparted` derivation at 967 and the `PcCatch` type's import at 26), the HUD view model drops
      `entryDeparted` (`src/ui/hud/state.ts` 57/213), and the two migrations that **seed** the fields stop
      writing them — step 10 (`save.ts` 237-243, `entryDeparted`) and the v16 `withPcCatch`
      (`save.ts` 278/395-400, `pcCatch`) — while keeping their other work, so no chain produces a key
      the run type cannot hold. **Docs:**
      `docs/routes-spec.md` **§6** (448-464: "two windows" becomes one room, always) and **§3**
      (356-361: the paragraph still promises a **capture screen** that `[Task-31]` deleted — it is
      rewritten to the shipped behaviour, party first, PC second, no swap on the spot), plus
      `docs/design-spec.md` §3's **swap bullet only** (68-73, which reads as an unconditional
      party/PC drag and gains "only in the floor's entry room"). **Tests:**
      `[unit]` `state.test.ts` — `pcFullyEditable` is true in the entry room on the first visit **and**
      on a return, false in any other room, true again on the next floor; `pcMemberEditable` answers the
      same for a boxed catch in the room it was caught in (false) and in the entry room (true);
      `[unit]` `save.test.ts` — a v16–v25 document carrying both keys still decodes, a document without
      them still decodes, and no field is emitted; `[unit]` `partyScreen.test.ts` — no across-swap
      outside the entry room and a full one inside it; `[live]` open the PC in the entry room (no veiled
      cell), walk one room away (every box cell veiled), catch with a full party (the caught cell is
      veiled in the room it was caught and un-veiled only back at the entry). Claims
      `src/engine/run/state.ts` + `state.test.ts`, `src/engine/save.ts` + `save.test.ts`,
      `src/engine/run/{resolve,trade}.ts` + `trade.test.ts` (the prose mention and its two assertions),
      `src/ui/hud/state.ts` + `state.test.ts`, `src/ui/hud/panels/party/view.test.ts` (fixture only),
      `src/ui/partyScreen.ts` + `partyScreen.test.ts`, `src/ui/casino.ts` + `casino.test.ts`,
      `src/scenes/panels/{pc,rewards}.ts`, `src/scenes/RouteScene.ts`, `docs/routes-spec.md` §3 and §6,
      `docs/design-spec.md` §3 (the swap bullet).
      *Dependencies:* none. *Decision:* resolved reading — the "capture-time swap" is the `pcCatch`
      window (no capture screen exists since `[Task-31]`), and the **no `SAVE_VERSION` step** follows
      from the decoder being field-by-field: both keys are optional today (`save.test.ts` 545-549), so
      an old save keeps decoding and a new one simply omits them. *(Batch 80)*






---

## Bugs

Reported in play, awaiting triage. A bug becomes a task in the batch plan, and the
fix is archived in `CHANGELOG.md`. `[PENDING FIXES]` below is a different list: what a
finished **task** still owes its Task QA — and a batch, its one Integration QA pass on
the combined tree.

**A doubles round (`2026-10-25`), from a boss fight.** Three reports and one question, parked
here because a batch was in flight when they arrived:

- **The player's two windows are stacked in the wrong order, and the two render paths disagree.**
  In a double battle the lead is the **left** sprite (`playerMonPos`) and the partner the right one
  (`playerMonPos2`), but the Phaser layout puts the partner's window **below** the lead's
  (`secondPlayerPanel`, `src/scenes/BattleScene.ts` 3256) while the HUD panel puts it **above**
  (`partnerBox`, `src/ui/hud/panels/battle-hp/view.ts` 93). The left Pokémon therefore wears the top
  window, which is what the human saw. Expected: **one rule for both paths — the partner's window
  above the lead's, the lead's the one nearest the menu** — plus a test that pins the pair's rects
  and which `data-hud-hp` id lands on each.
- **The target step must be visible, not merely implemented.** `chooseMove` → `openTargetStep`
  (`BattleScene` 2585/2613) already asks which foe a single-target damaging move hits, but it opens
  only with two live foe slots and no spread target, and no prompt says so. Fix shape: the prompt
  names the marked foe (one key in both locales), the marker reads at 390×844, the partner's own move
  (slot 1) takes the step, and a test walks four cases — two live foes (asks), one live foe (does
  not), spread (does not), status/self/ally (does not). No engine rule moves: `FightCommand.target`
  ships.
- **A move that catches the ally must say so.** `allAdjacent` already adds the user's own live
  partner and `all` covers every other fighter (`useMove`, `docs/battle-spec.md` §12), but the log
  never names the ally it hit. Expected: the ally's window drops and one log line names it; spread
  damage reduction, Helping Hand and redirection stay out of scope, as the spec says.
- **The partner's menu draws two buttons, and the grid reads as broken.** By design
  `openPartnerMenu` (`src/scenes/BattleScene.ts` 2455) offers slot 1 FIGHT and SWITCH only, because
  the Bag and RUN are the side's own actions; the human sees a half-empty command grid. Fix shape:
  draw the shipped **four** buttons with BAG and RUN **present and disabled** on slot 1 (with the
  disabled reason), so the grid never looks like a missing menu; letting the partner open the
  side-level bag would be its own decision, not a polish.
- **There is no way back to the partner's command.** Once slot 1 submits, `partnerCommand` is stored
  and slot 0's menu opens (`openMenu`, line 2421); `onCancel` (1643) only closes slot 0's own
  submenu — and `openMenu` re-enters slot 0 because `partnerCommand !== null` — so the partner's
  choice is final. Fix shape: a back action on the slot-0 command menu **and** on its move/switch
  submenus that clears `partnerCommand` and `commandSlot` and re-opens the partner's menu, wired to
  the same `?` arrow the submenus already draw plus Esc/Backspace and the pad's B; `onCancel` routes
  by `commandSlot` instead of resetting it to 0, and a test walks partner → lead → back → partner.
- **Answered, then changed by the human on the same day: the double battle is now a roll, not a
  rule.** Until `2026-10-25` the map boss was **always** double (`BOSS_PARTY.boss.double = true`) and
  the mini-boss **always** single; the human's decision that day is **25 % for the boss and 10 % for
  the mini-boss**, drawn from the run's seed. `[Task-156]` (Batch 69) carries it: `doubleChance`
  replaces `double`, the mini-boss's trainer launch starts reading the flag, and the docs follow.
  Wilds stay single, and a party of one on a double boss still degrades to the single layout
  (`secondActiveIndex = -1`).

**A HUD report (`2026-10-25`): the detail popup opens under the panel it came from.** Clicking a
party member — in the party panel or in the PC — opens that Pokémon's data panel **below** the panel
that spawned it, so it is covered instead of laid on top. `order` is build order only
(`src/scenes/panels/types.ts` 29; the detail is `order: 110`) and a panel raised or dragged afterwards
keeps painting above it, while the DOM HUD renders the popup as a sibling whose DOM position decides.
Fix shape: the detail popup is **raised when it opens** — `bringToTop` on its container and on the
info popup (`detail.ts` 1381) so it sits above party, PC, rewards and shop on every open — and in the
DOM HUD it renders in a top layer above every panel. One rule, two renderings, with a test that opens
the detail from the party and from the PC and asserts it is the topmost panel.

**A pacing report (`2026-10-25`): the HP bar drops before the line that explains it, and too fast.**
`showFrame` (`src/scenes/BattleScene.ts` 1798) applies the frame's events — the hit that lowers
`displayHp` — at the same instant it starts typing the message, and the bar's own animation is a
**300 ms** CSS transition (`HP_FILL_MS`, `src/ui/hud/panels/battle-hp/view.ts` 33). A 60 % hit
therefore snaps down while the line is still being typed, which is the opposite of the rhythm the
bar exists for. **Expected:** the line finishes first, then the bar drains at a readable cadence
(proportional to the fraction lost, with the number counting down), and the next frame waits for
both — one rule, the Phaser bar and the HUD panel alike. **Fix shape:** `showFrame` splits into
"type the line" and "apply the frame's events when the line completes"; `frameHoldMs` becomes
`line + drain + BATTLE_LOG_DWELL_MS`, so the 900 ms dwell starts after the drain; the drain gets its
own duration (a full bar in ~800-900 ms, a heal slower), shared by `battle-hp` (a CSS custom property)
and the Phaser bar's tween, and `HP_FILL_MS` stops being a one-size 300 ms. The `Critical hit!` line
keeps landing with the drop it describes, and the `battle-log` tests keep the 900 ms dwell after the
line.

**The audit of every move is a defect, and it is in the plan.** The report — «añade en todo lo
antes posible tarea para revisar logica de todos los ataques, ahora los de estado o daño relativo
parecen no hacer nada la mayoria o no funcionan exactamente igual» — is the thirty-first round's,
and it registered `[Task-119]`–`[Task-121]` in **Batches 47b–47d** (right after Batch 47's merge
and ahead of Batch 51), with the measurement it is judged by, the 76 moves the ledger calls
`port` for a flag nobody reads, and the families it must not shrink all written into their own
entries above. Nothing waits in this inbox.

**The level curve is re-planned, and it is not a report.** After a design discussion the human
chose the campaign's new shape — **eight maps, levels 2 → 55**, a 2–9 first floor, with the
per-floor step shrinking as the curve's cube bites — and it was registered as two tasks ahead of
the balance pass rather than as a bug: `[Task-69]` (Batch 5c, **shipped**) rewrote `MAP_TUNING`,
`FINITE_MAPS` and the level bands and fixed the infinite-run step that pinned a deep floor's
minimum at the last row's cap, and `[Task-70]` (Batch 5d) thins maps 1-2 — fewer trainers and
less loot — so the on-ramp is gentler, without touching geometry (a floor already needs six
rooms and 30x30 is already the room minimum, so the population pass and the loot table are the
only levers left). Both carry their evidence, their paths and their re-pins in their own
entries above, and neither adds a run field: the version chain stays **14 → 15 → 16 → 17 → 18**.

A **twentieth round** is a **design discussion** and is triaged in the same pass, so nothing waits
here: the human's reading is that a floor is unfair at its edges, and it registers **six tasks** —
`[Task-78]`–`[Task-83]` — that no batch contains yet. The measured cause is one asymmetry: a
trainer's level is drawn uniformly across a floor's whole band (`trainerRoster`,
`src/engine/run/roster.ts` 55), so map 1 drops a level-9 trainer on the level-5 starter and map 2 a
level-16 on a squad entering at 9, while the room ramp `docs/maps-spec.md` §5 promises is honoured
by **wild encounters** alone (`roomLevelForMap`, `RouteScene` 1294). The six tasks are the roster's
**room** level with a party-size penalty (`[Task-78]`), a **wild** level capped by the party's own
(`[Task-79]`), the finite ranges re-spaced with map 1 at the starter's level (`[Task-80]`), a room's
**size from its shape** (`[Task-81]`), a **fixed number of trainer rooms per floor** (`[Task-82]`)
and the XP curve re-solved against the new budgets (`[Task-83]`). None adds a run field, so the
chain stays **14 → 15 → 16 → 17 → 18**. The one rule the round does **not** settle is `[Task-79]`'s:
whether a wild's cap rides the lead's level or the party's highest, and by how much — the open
question recorded with that task.

A **thirteenth round** of **two reports** arrived after that one and is triaged in the same
pass, so nothing waits here either. Both are **wishes** rather than defects. One is a fixed
party size for the two fights that close a floor: «los minibosses tendran siempre 3 pokes y
bosses 6 menos en primer piso que es 2 y 3 relativamente» (`[Task-71]`) — today the size is the
band's `trainerSize` plus one, so map 1 is a 2-and-2 fight and a late floor a 5-and-5
(`RouteScene` 4597-4601 over `trainerRoster`'s `Math.max(1, band.trainerSize)`, `roster.ts` 41),
and the fix moves the numbers into a new `src/data/bosses.ts` with a `count` option on the
roster builder — the boss's award stays outside the floor budget, which the entry states and the
sheet records. The other is **fewer routes on map 1** (`[Task-70]`, which it widens): the
regular room count is already `max(5, roomCount - 1)` over the guaranteed entry + 2x2 core
(`plan.ts` 385 / 190-259), so the only free rooms are the special leaves and the floor drops its
**guaranteed shop leaf**, becoming six rooms — seven when the mini-boss rolls — instead of the
7-8 it holds today. Both carry their file-level diagnosis and their fix shape in their own
entries above.

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
the tileset cannot do today because `TilesetConfig` has no frame list to cycle and every cell
draws the one static frame 5 (`[Task-45]`; the human later chose the decomp's own field effect
— `graphics/field_effects/pics/tall_grass.png`, five frames — over a synthetic beat, so the
task repacks the three FRLG atlases with it).
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

A **ninth round** of **three reports** arrived together and is triaged in the same pass, so
nothing waits here either. One is a **defect of the boss win**: beating the map boss warps the
player back to the boss room's door, because the boss-win branch rebuilds the room through the
**room-change** path — `applyBattleResult` calls `transitionTo` (`src/scenes/RouteScene.ts`,
5107) and `transitionTo` respawns the player on the room's entry tile (`this.player = {
...this.route.entry }`, 4449) although the run's map position never moved (`[Task-61]`; the
portal itself is innocent — `portalOpen` 1006-1008, the seal at 1151-1153, the walk-through at
4397-4399). Two are **wishes** rather than defects: a trainer or boss room's battle should be
able to begin under a weather, a terrain or a room condition — dense fog (−20 accuracy),
Gravity and Trick Room among them — with the route drawing an animation or filter for it
(`[Task-62]`; the four effects except fog all ship in `src/engine/battle/**` — `state.ts`
97-100, `accuracy.ts` 5-17, `order.ts` 18/27 — but `createBattle` seeds none of them,
`state.ts` 159-162, and `BattleSetup` 120-128 carries no condition at all), and a beaten
mini-boss should also offer **three unidentifiable Pokémon** beside its item rows, presented by
their highest stat and their nature (`[Task-63]`; the reward window is items only,
`openMiniBossReward` 5715-5731 over `rewardChoices`, `src/ui/rewards.ts` 10-32, while a
run-seeded ability/moveset and the catch's own placement already ship, D17). Each carries its
repro, its file-level diagnosis and its fix shape in its own entry above.

A **tenth round** of **three reports** arrived together and is triaged in the same pass, so
nothing waits here either. All three are **wishes** rather than defects — three new special
rooms in the shop/mini-boss mould (a dead-end leaf with only its own content,
`docs/maps-spec.md` §7): a **casino** room with a Team Rocket grunt, a pay-per-spin slot machine
whose prizes are items and an **egg** that yields a random Pokémon when the run advances a
floor, and a chance of a battle that locks the machine (`[Task-64]`; the special-room layer is
`MapRoomSpecial`, `src/engine/maps/plan.ts` 64, placed by the special pass `planMap` 406-460, and
each room's content is its own descriptor module under `src/scenes/rooms/`, `D47`, with
`rooms/shop.ts` the fixture model); a **gated reward
room** whose reward sits behind bushes, rocks or water that only a party of the right **type**
opens — Bug or Grass, Rock or Fighting, Water (`[Task-65]`; the tile vocabulary is
`src/engine/map.ts` 5-14, gains `BUSH`/`ROCK` and reuses the already-solid `WATER` 11/16, and the
predicate is the new `partyHasType(run, types)` over `getSpecies(member.fighter.speciesId).types`,
since a `FighterSnapshot` carries no types); and a **trade
room** where a Pokémon is given for a random one (`[Task-66]`; a member is removed only by
`releaseFainted`, `perms.ts` 17-29, which counts a casualty, and a random one is
`speciesPool` + `createFighter({ learnsetSeed: run.seed })` placed as a catch is,
`resolve.ts` 92-101). All three extend the special-room layer and the route scene, which is why
they land one batch apart. Each carries its file-level diagnosis and its fix shape in its own
entry above.

An **eleventh round** of **one report** arrived together and is triaged in the same pass, so
nothing waits here either. It is a **wish** rather than a defect: a room whose effect is that the
player cannot use items and cannot use healing moves (`[Task-67]`; the BAG is the player's alone
— `validateBag`, `src/engine/battle/commands.ts` 80-87, over the `RunState.bag` the launch carries,
`battleLink.ts` 48 — and the healing moves the engine models are the fraction self-heals
(`turn.ts` 369-375), the effect-handled heals (`effects/moves.ts` 604-638) and the drain moves
(`turn.ts` 391-406), while `healblock` is `excluded`, moveCoverage 1919-1923, so there is nothing
to reuse). It wants the two scenes and the special-room layer (`MapRoomSpecial`,
`src/engine/maps/plan.ts` 70) the casino/gated/trade rooms already extend, which is why it lands
one batch behind them. It carries its file-level diagnosis and its fix shape in its own entry
above.

A **twelfth round** of **one report** arrived together and is triaged in the same pass, so
nothing waits here either. It is a **wish** rather than a defect: the MOVES menu should let the
player delete an equipped move (`[Task-68]`). The surface the report means is the route HUD's
**MOVES** tab — the detail panel's `'moves'` mode (`DetailTab`, `src/ui/partyDetail.ts` 26, the
`MOVES` label at `RouteScene` 1911), whose four slots are the shared `MoveGrid` (2411-2435) and
whose equip seam is a band cell dragged onto a slot (`startLearnDrag` 3262-3271 →
`detailMoveIndexAt` 3437-3441 → `equipMove`, `src/engine/run/learnset.ts` 115-136) — because
"equipped" is a fact about the run's member (`fighter.moves`, `src/engine/battle/fighter.ts`
144, capped at `MAX_MOVES`, `progression.ts` 40) while the battle's own moves menu is a per-turn
command menu over a restored snapshot. The learnset is **derived** (`learnsetPool`, 66-86), so a
deleted move reappears in the band for free and the freed slot stays empty — which is why the
task adds one pure inverse of `equipMove` and **no** run field, and therefore **no**
`SAVE_VERSION` step. A zero-move member is a state the tree already forbids three times over
(the save decoder drops it, `src/engine/save.ts` 442-449; `validateCommand` refuses every fight
index, `commands.ts` 103-105; the FIGHT menu would draw nothing, `BattleScene` 1235), so the
entry refuses to delete the last move unless the human says otherwise. It carries its
file-level diagnosis and its fix shape in its own entry above.

A **sixteenth round** of **one report** arrived after that one and is triaged in the same pass, so
nothing waits here: it is a **defect of the tall grass's overlay**, not a wish — «nada mas entrar el
fondo se pone de otro color creo no se usa el fondo tile del bosque si
no de prado por eso es un verde mas claro» (`[Task-74]`). The measured cause is a **palette
mismatch**: `forest`'s tall-grass ground averages `59,125,76` while the rustle cells carry the
`outdoor` art's numbers in all three fields, so the dark tuft is covered by light blades the moment
the player steps in (and the forest is the only biome `BIOME_ORDER` walks). It was fixed as a
per-field `grassRustleTint` in the tileset data plus a clip of the one overlay sprite at cell row 6,
and because the repo cuts a defect in front of the batch behind it, it opened **Batch 5cb** ahead of
5d and **shipped** there. Its measured table, its rejected reading and its fix shape are recorded in
that batch's archived summary above.

A **twenty-first round** of **one report** arrived after that one and is triaged in the same pass,
so nothing waits here: «al abrir panel pokemons las teclas de moverse mueven en el panel de party no
quiero eso que siga solo sirviendo para mover personaje» (`[Task-84]`). It is **not a defect** — the
arrows browsing a focused HUD pane is the shipped keyboard-play rule of `docs/design-spec.md` §10.3
(the accessibility pass, `[Task-08]`), so the report is a **decision change**: the movement keys must
keep moving the character and never move a cursor inside the party panel. Its seam
(`RouteScene.toggleHudPanel` → `focusHudPane`, `handleHudKeyboard`, the `update()` gate at 7237-7238),
its fix shape and the doc lines that move with it are in its own entry above. It claims
`src/scenes/RouteScene.ts` and no state, so the chain stays **14 → 15 → 16 → 17 → 18**, and nothing
here re-plans `Task-38`–`Task-83`.

A **twenty-second round** of **one report** arrived after that one and is triaged in the same pass, so
nothing waits here: the hidden item's faint sparkle should become a **concrete floor tile per biome**
(`[Task-85]`). For the forest, **frame 41** — of the five floor frames the field draws (`0` base, `1`,
`2`, `41` and the flowered `42`; preview `sprite-sources/forest-floor-tiles.png`, gitignored) — becomes
the hidden-item tile and leaves the normal mix. The task adds a `hiddenItemFrame` to `TilesetConfig`,
draws it from `RouteScene.drawItems` in place of `SPARKLE_TEXTURE_KEY`, retires the sparkle texture if
nothing else reads it, and drops the reduced-flash bullet that dimmed it. It adds no run field, so the
chain stays **14 → 15 → 16 → 17 → 18**, and nothing here re-plans `Task-38`–`Task-84`.

A **twenty-third round** is an **instruction** and is triaged in the same pass, so nothing waits here:
the human wants the forme-changing **abilities deleted** and every alternate forme reached as a form or
an evolution instead — «elimina las habilidades de transformación de formas», «Cramorant como formas,
Terapagos linea evo, Ogerpon formas», «elimina las habilidades que su funcion sea cambiar forma a x
poke» — and Cherrim's and Castform's evolved formes to carry a **stat boost** (they are stat-identical
to the base today: Cherrim 450 = Sunshine 450, Castform 420 for all four). It is **`[Task-86]`**, a
seventeen-species sweep; its inventory, its engine removal, the data seam and the open readings are in
its own entry above. It adds no run field, so the chain stays **14 → 15 → 16 → 17 → 18**, and nothing
here re-plans `Task-38`–`Task-85`.

A **twenty-fourth round** is **two instructions** and is triaged in the same pass, so nothing waits
here. A consumable must be spendable on a member from the route HUD **only when it has an effect**
(`[Task-87]`; it also fixes the existing defect that a Potion dropped on a member is equipped as if it
were a held item, because neither `equipHudItem` nor `equipHeldItem` reads the item's `kind`), and
Gigantamax must be **stone-gated**, its stone named `<Base>ite G` — `Venusaurite G` for Venusaur
(`[Task-88]`), minted per G-Max forme beside `MEGA_STONES`. Neither adds a run field, so the chain stays
**14 → 15 → 16 → 17 → 18**; their diagnoses are in their own entries above.

A **twenty-fifth round** is a **design pivot** and is triaged in the same pass, so nothing waits here:
the per-floor level ranges give way to a **player-relative** model — wilds at `60–75 %` of the squad's
level, trainers at `100/90/80/70 %` by party size (rounded down), the boss and mini-boss at the floor's
**cap**, and the species band following the squad level. It re-shapes `[Task-78]`, `[Task-79]` and
`[Task-80]` in place, amends `D11`/`D17` and hands `[Task-83]` a new budget to measure. It adds no run
field, so the chain stays **14 → 15 → 16 → 17 → 18**; the full reading is in the three entries above.

A **twenty-seventh round** is a **content wave** and is triaged in the same pass, so **nothing waits
here**: it registers **nineteen tasks**, `[Task-90]`–`[Task-108]`, and it schedules every ID the
previous rounds left unbatched, cutting **Batch 29 to Batch 50**. Nothing in it is a defect — the
list is the human's design session, and the only repair it carries is a **plan** one: `[Task-80]`'s
`*Dependencies:*` read "none" while its own diagnosis needs `[Task-78]` and `[Task-79]` first, so
the edge is written in, and `[Task-62]` now names `[Task-106]` as the second half of the room-effect
table so the six new conditions (the radiant zone, the two auras, the all-types change, Endure and
the +50 crit) are an **extension** of that table rather than a duplicate of it. The wave groups the
NPC list into a framework (`[Task-91]`) plus four self-contained content rows (`[Task-92]`–`[Task-95]`),
registers the rare rooms (`[Task-96]`, `[Task-97]`), the missions (`[Task-98]`), the special trainers
(`[Task-99]`), the boss room's rules (`[Task-100]`), the two remaining room rules (`[Task-101]`,
`[Task-102]`), the item and ability waves (`[Task-103]`–`[Task-105]`), the room-effect table's second
half (`[Task-106]`) and the 2vs2 boss fight as its engine (`[Task-107]`) and its screen
(`[Task-108]`). **Five of the nineteen add a run field**, and they take the next `SAVE_VERSION`
steps in batch order — `[Task-98]` **18 → 19**, `[Task-93]` **19 → 20**, `[Task-94]` **20 → 21**,
`[Task-101]` **21 → 22** and `[Task-103]` **22 → 23** — so the chain reads
**14 → 15 → 16 → 17 → 18 → 19 → 20 → 21 → 22 → 23**; the other fourteen add none. The wave's three
open readings were **answered after the cut** and are recorded with their entries — `[Task-97]`'s gate
is a **blocked room opened by a party of a named type** (a sibling of `[Task-96]`'s room, not of
`[Task-65]`'s move gate), `[Task-103]`'s candy **rolls each colour's stat per run and reveals it only
once that colour has been tried** (so its `SAVE_VERSION` step carries the discovered-colour set as
well as the treats) and `[Task-101]` bans the **member**'s species — and nothing here re-plans
`Task-38`–`Task-89`: the two slots it fills are Batch 21's and Batch 23's, and Batch 4b stays `cut`.

A **twenty-eighth round** is **one report plus a plan-wide review**, and it is triaged in the same
pass, so nothing waits here. The report is a **wish** rather than a defect — «añadir panel flotante
temporal al entrar en una ruta como en los juegos originales» (`[Task-109]`) — and it registers an
**area-entry panel**: a boxed banner raised from the room-change paths, its copy an i18n key, its
builder a fourth string in `src/ui/notice.ts`, dismissing itself, with its one open reading (every
room or only when the area changes) defaulted to **every room**. It claims `src/scenes/RouteScene.ts`,
so it opens **Batch 51**, one batch behind the 2vs2 pair, and adds **no** run field: the chain stays
**14 → 15 → 16 → 17 → 18 → 19 → 20 → 21 → 22 → 23**. The review that came with it walked every open
item against the graph, the batch labels and the hot files and repaired **nine records** — three
missing edges written in (`[Task-89]` → `[Task-63]`, `[Task-99]` → `[Task-98]`, `[Task-103]` →
`[Task-106]`), one invented edge removed (`[Task-95]` → `[Task-65]`), `[Task-98]`'s
`missionsCompleted` counter and its `src/ui/notice.ts` + i18n claims written down, `[Task-97]`'s
re-read gate recorded with its three earlier edges, `[Task-65]`'s missing `**Docs:**` line filled,
and **Batches 21's and 23's own section records brought level** with the second member each gained in
the twenty-seventh round (`[Task-86]`'s and `[Task-88]`'s hot files, both sections still reading "one
task, alone") — with **no batch label moved**, no cycle found, no
batch left outside the antichain rule and `[Task-28]` still the plan's only unscheduled ID. The full
measurement (per-batch path sets, hot-file holders and the version chain) is in the batch plan above.

A **thirty-third round** is **nineteen play reports from one sitting (`2026-10-26`)** — seventeen of
them in its first half and two more in its second — the largest defect round the backlog has taken,
and **every one is a defect**: none is a wish, and each was registered against the code that ships it,
as `[Task-162]`–`[Task-180]` in the new **Phase 16**, cut into **six batches, 75 to 80**. They group
by family. **Battle UI (five):** a Mega/G-Max row's name
and its stone swap columns (`[Task-162]`, against `[Task-21]`'s information rows, whose copy rides
`node.name`, `src/ui/evolutionGraph.ts` 57-68 / 114-129 and `detail.ts` 607); arrows that jump over a
disabled BAG row or a fainted party member (`[Task-166]`, `moveMenu` 2887-2896 and `moveMenuGrid`
2987, a decision change on `[Task-08]`'s §10.3 rule, with `confirmMenu` 3007-3008 already declining
them); a battle Bag whose keys never reach the pocket row and whose click does not use a stack
(`[Task-169]`, `navigateMenu`'s bag branch 2904-2910 and `selectBagCell` 2731-2739 against the DOM
card's arm-then-use `cellPressIntent`); a detail panel that snaps back to STATS when another member is
picked (`[Task-171]`, `openMemberDetail` 1089-1108 with `openDetail`'s default tab,
`partyDetail.ts` 254-256); and a boss-door sign drawn as a black square (`[Task-165]`, `[Task-161]`'s
prop falling to the placeholder that `scripts/assets/build-placeholders.mjs` 47-70 paints fully
opaque). **Battle rules (six):** Upper Hand never fails (`[Task-167]`; `upperhand` is `port` on
`data: secondaries`, `moveCoverage.json` 4751-4755, and the audit pins only damage + flinch,
`moveAudit.ts` 1211-1217); Dig and Dive neither dodge nor lock the menu (`[Task-168]`, `charging` is
set at `turn.ts` 1033-1044 but nothing is semi-invulnerable and `finishFeed` 1840 still opens the
menu); Rage Fist's power never climbs (`[Task-173]`, no case in `resolveBasePower`,
`damage.ts` 190-260, so `preview.ts` 82 prints the flat 50 too); the room's Endure spares any HP above
1 forever instead of only a full-HP hit once (`[Task-174]`, `turn.ts` 1254-1263); and Natural Gift's
type follows its berry while its power does not (`[Task-177]`, `effectiveMoveType` reads the berry,
`moveType.ts` 93-104, but `moveDetails` takes the dex power, `partyDetail.ts` 142-167); and the map
boss and the mini-boss aggro from their line of sight instead of waiting to be spoken to
(`[Task-180]`, both are ordinary `RouteTrainer`s with `sight: DEFAULT_TRAINER_SIGHT` —
`bossTrainer` `RouteScene` 954-964, appended at 703-706, and `rooms/miniBoss.ts` 16-29 — read by
`trainerSpotted` 2690-2699 and the spinner tick 4452-4470 through `seesPlayer`,
`routes/trainers.ts` 61-75). **World and economy (five):** a back press out of the forced switch lands
on a menu the engine refuses (`[Task-163]`,
`onBack` 5049-5051 / `onCancel` 1661-1663 into `openMenu` 2417-2449, whose FIGHT command
`validateCommand`'s replacement rule at `commands.ts` 244 then throws on); no merchant on floor 1
(`[Task-170]`,
`guaranteedFromMap: 2` in `src/data/npcs.ts` 92-102 with a 1-based `mapIndex`, pinned by
`npcs.test.ts` 169-186 — the test literally says "leaves map 1 merchant-free"); a level-up that crosses
no move still raises a transient panel (`[Task-164]`, `[Task-50]`'s notice loop,
`RouteScene` 3933-3938); and a Mart that sells never-consumed berries at 200 and re-stocks a row after
it is bought (`[Task-178]`, `NOOP_BERRY_ITEMS` `items.ts` 772-785 against the 1000+ held tier, and
`buyRows`/`buyItem` `ui/shop.ts` 100-159 writing no record); and the PC swaps only in the entry room on
the first visit, with the capture-time swap still open (`[Task-179]`, `pcFullyEditable` requires
`!entryDeparted` at `state.ts` 527-529 and `pcMemberEditable` grants the caught room a second window
through `pcCatch`, 536-543, recorded by `addCaughtPokemon` 551-555). **Data (three):** Dark Matter is in the
random ability pool although only a dark catch grants it (`[Task-172]`, `randomAbilityPool`
31-40 over every registered effect); a wild or static can be a species the run already holds the line
of, because `wildExclusions` reads only `caughtSpecies` and the static leaf reads nothing (`[Task-175]`,
`pool.ts` 32-39, `staticSpecies.ts` 70-72); and a TM can be rolled twice as a ground item
(`[Task-176]`, `sketch.ts` 1264-1282 draws with no memory over reusable keys, `tms.ts` 10-13).

**Five readings the round settles from the code, and one it leaves open.** The «campo que hace
resistir a 1 hp» is the **battlefield** `endure` and not the move or Sturdy (`battlefields.ts` 15/61,
`bosses.ts` 94, the clamp at `turn.ts` 1254-1263), so `[Task-174]` is written against the field and
says so. «Palma Rauda» is `upperhand` and «Don Natural» is `naturalgift`, both resolved by id from
`src/data/i18n/es/moves.json` (3952-3956 and 2342-2346) rather than from the Spanish name, with their
dex rows read for the rule (the target must be using a priority move; the berry supplies the power).
The Mart's second half is scoped **per floor** because each floor's stock is its own roll
(`buildShop`, `ui/shop.ts` 55-83, keyed `${seed}:${mapIndex}` at `rooms/shop.ts` 152-155), and both
halves of «bayas equipables … no se consumen» resolve to the **eleven no-op berries** the rotation
sells — the only `kind: 'held'` berries the engine never spends — which is why `[Task-178]` reprices
those and leaves the consumed ones alone. «quita lo de que al capturar se pueda hacer el cambio» is the
**`pcCatch` window**, not a screen: `[Task-31]` deleted the capture screen, so the only capture-time
swap left is the caught room's permission (`pcMemberEditable`, `state.ts` 536-543) and `[Task-179]`
removes that window — and the stale §3 paragraph still promising the screen with it. And «el boss y
miniboss no tienen rango» is read as **no aggro at all**: both keep the line of sight their placement
and validation use, but `seesPlayer` refuses them through `aggro: false`, which turns the sealed boss
room's anti-soft-lock argument from "it walks over" into a reachability guarantee pinned on 20 seeds.
**The one open reading is `[Task-163]`'s symptom:** the
forced-switch back path is a proven defect (a menu the engine refuses, then a throw), but the report's
«sale el move que utiliza el rival» could also name a *revealed* move; the entry carries the
forced-switch fix as the recommendation with `*Decision:*` open, and QA runs the repro before the dev
starts. **Nothing here adds a dependency edge or a `SAVE_VERSION` step** — `main` reads **25** and
stays there: the reports that look like state re-read what the run already saves
(`party`/`box`/`rip`/`caughtSpecies` and `pickedItems`), and the last state-shaped one **removes**
`pcCatch` and `entryDeparted` rather than adding a field, which the field-by-field decoder absorbs with
no step — the round claims `src/scenes/RouteScene.ts` **four times** (Batch 75's Task-164, 77's
Task-176, 79's Task-180 and 80's Task-179, so the scene's queue reads
19 → 51 → 75 → 77 → 79 → 80), `src/scenes/BattleScene.ts`, `src/engine/battle/turn.ts`,
`src/scenes/panels/detail.ts` and `src/ui/partyDetail.ts` once per batch, and nothing re-plans
`Task-38`–`Task-161`.

---

## [PENDING FIXES]

Written by QA. The format is fixed — one entry per task. Empty means nothing is red.

```markdown
- [ ] **[TASK-<ID>]:** <one-line description>
  - **Expected:** ...
  - **Actual / error log:** ...
  - **Affected path:** ...
```
