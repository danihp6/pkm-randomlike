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

**Batch 5, Batch 5b, Batch 5c, Batch 5cb, Batch 5d, Batch 5e, Batch 5eb, Batch 5f and Batch 6 are
shipped and
archived.** Their
twenty-one
tasks merged
in ID order
behind the green gate (four, then five, then three, then one, then one, then one, then one, then
one, then four) and the
detail is
in
`CHANGELOG.md`'s
`## Unreleased`; Batch 5b is the batch that ended up packing the decomp's real FireRed grass
rustle, Batch 5c the one that re-planned the level curve and laid that overlay over the player's
legs, Batch 5cb the defect in front of 5d that fixed its colour and clipped its hit, Batch 5d
the on-ramp thinning, Batch 5e the fixed boss and mini-boss parties, Batch 5eb the debug
overlay's teleports and its two ignore toggles, Batch 5f the overworld sprite set, and Batch 6
the balance pass, the Phase 9 docs, the battle SWITCH grid and the follower, and all
nine are closed
below. **Batch 6b is cut** — the learnset band scrolls and a trainer's remaining
team sits under its panel: its two specs are written (`.agent_specs/task-38.md`,
`.agent_specs/task-57.md`), it is an antichain and its two tasks share no path, and the
three open questions it carried are **answered and frozen in `### Batch 6b` below**. The
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
`6 Task-41`, which is correct as they stand.

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
water that only a party move opens — Cut, Rock Smash, Surf (`[Task-65]`); and a **trade room**
where a Pokémon is given for a random one (`[Task-66]`). Because they share the route scene
**and** both halves of the special-room layer, no two can sit in a batch: they open **Batch
24**, **Batch 25** and **Batch 26**, one task each, one batch apart. `Task-64` is the one of the
round that may repack the FRLG overworld/trainer atlases (a new `rocket` archetype's two
sprites), `Task-65` may add obstacle frames to the FRLG tileset atlases and the run's first
`knowsMove`-style accessor, and `Task-66` the run's first deliberate member **removal** beside
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

### Batch 6b — the learnset band scrolls, and a trainer's remaining team sits under its panel *(cut)*
Task-38 and Task-57 are the batch, one spec each (`.agent_specs/task-38.md`,
`.agent_specs/task-57.md`), and they share no path — the route scene, the new
`src/ui/scroll.ts` + its test, `src/ui/README.md` and the two doc files are Task-38's,
while `src/scenes/BattleScene.ts` is Task-57's — so the batch is an antichain. **All three
of its open questions are answered**, and their bullets are gone from the list below.
**Task-38's** reading is its written default: the `<` / `>` pair **stays as a one-row
scroll** (a control that reads "one row", so a keyboard or pad player can reach row five),
the search field keeps the ~78px those glyphs occupy, and the mouse wheel **and a drag on
the band's own background** scroll it too; the rejected reading (wheel and drag only, the
glyphs gone) is not what ships. **Task-57's** two are also their written defaults: the row
is on the **foe's panel alone** and a **wild** battle draws **no row at all**, and the row
is **fixed** — one ball per roster member with the fainted ones emptied, so it also says
how many the trainer started with — rather than a row that shrinks to the live count.
One correction is recorded against Task-38's spec: its `[live]` band-background-drag
criterion first froze its press point **4 px inside the band's left edge**, which the
panel's own `HUD_PANEL_BORDER` (12 px) move ring swallows — `hudPanelAt` →
`onPanelBorder` runs before `handleDetailPointerDown`, so that press moved the panel and
did not scroll the band. The point is re-frozen to the band's **row gutter at its
horizontal middle** (at least 12 px inside that edge); the shipped implementation was
correct as written and **no code changes**.

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

### Batch 20 — the whole chrome goes dark glass (the debug panel's seed)
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
- **Task-61** Beating the map boss keeps the player where they stand instead of warping them
  to the room's door.
- **Hot files:** `src/scenes/RouteScene.ts` (the boss-win branch of `applyBattleResult`,
  5069-5108, and the `transitionTo` it calls, 4437-4454) → Task-61. Nothing else is in the
  batch; it claims no `package.json`, `src/main.ts`, `vite.config.ts`, `src/data/**`,
  `src/engine/**`, `src/engine/save.ts`, packed asset or `docs/` file.
- **Shape:** one task, alone, and the first of the round because it is the only **defect** of
  the six reports (the file's precedent: the bug batch was cut in front of Batch 4). It wants
  `src/scenes/RouteScene.ts`, which every batch from 5 to 20 holds (5 Task-16, 5b Task-45, 6
  Task-41, 6b Task-38, 7 Task-31, 8 Task-08's every-scene sweep, 8b Task-35, 9 Task-39, 9b
  Task-40, 10 Task-26, 11 Task-29's ledger, 12 Task-30, 13 Task-44, 14 Task-48, 15 Task-49, 16
  Task-50, 17 Task-52, 18 Task-55, 19 Task-56, 20 Task-58), so this is the first batch that
  leaves it free again — and the batch holds only one task because a batch is an antichain and
  every other report of the two rounds wants the same file. It produces nothing another task
  reads, changes no rule (the portal still opens when the boss falls, D31), adds no run field,
  so **no `SAVE_VERSION`** step and no fixed-seed re-pin — it is pure scene behaviour.

### Batch 22 — a room's battle begins under a weather, a terrain or a room condition
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
- **Task-63** A beaten mini-boss offers, beside its item rows, three Pokémon the player cannot
  identify — no name, no sprite — each presented by its highest stat and its nature.
- **Hot files:** `src/scenes/RouteScene.ts` (the reward window, `openMiniBossReward` 5715-5731
  through `chooseMiniBossReward` 5838-5848) → Task-63; `src/ui/rewards.ts` +
  `src/ui/rewards.test.ts` (the new pure Pokémon chooser beside `rewardChoices`, 10-32) →
  Task-63; `docs/maps-spec.md` §7 (185) and `docs/design-spec.md` §7 (259-260) → Task-63. It
  claims no `package.json`, `src/main.ts`, `vite.config.ts`, `src/data/**`, `src/data/dex/**`,
  `src/engine/**`, `src/engine/save.ts` or packed asset — every primitive it composes is
  shipped (`createFighter` + `randomAbility`/`defaultMoveset`, D17; `speciesPool`, D39;
  `statAtLevel`; `addPokemon`).
- **Shape:** one task, alone, because it wants `src/scenes/RouteScene.ts` (held by every batch
  5-20, Batch 20 last) and `src/ui/rewards.ts`, and no other report of the round claims that
  second file — so it could not ride beside Task-61 or Task-62 and opens the new **Batch 23**,
  one batch behind Task-62. It is a **presentation + placement** task with no new rule: the
  chooser draws from its own stream (a sibling of `:reward:${mapIndex}`, 5721), so the item
  rows a fixed seed already produces do not move and the fixed-seed regression is that the
  three (stat, nature) pairs are stable. The chosen Pokémon lands through `addPokemon` at the
  squad's level, exactly as a catch does — it is not a catch, so it spends no room capture and
  bumps no `stats.catches` — and it adds no run field, so **no `SAVE_VERSION`** step.

### Batch 24 — the casino room
- **Task-64** A casino room: a Team Rocket grunt, a slot machine the player pays to spin, items
  and an egg among its prizes, and a chance of a battle that locks the machine.
- **Hot files:** `src/scenes/RouteScene.ts` (the room's fixtures, the spin and the egg's hatch
  beat on `advanceMap`) → Task-64; `src/engine/maps/plan.ts` + `plan.test.ts` (the new
  `MapRoomSpecial` value and its placement) and `src/ui/mapView.ts` + `mapView.test.ts` (its
  marker) → Task-64; the new casino table (price, prize weights, the battle chance) in
  `src/data/` beside its test, and the new `egg` entry in `src/data/items.ts` → Task-64;
  `src/data/trainers.ts` (the new `rocket`/`grunt` archetype) and the packed
  `src/assets/frlg/overworld.png`/`trainers.png` with `src/data/frlg/overworld.json`/
  `trainers.json` (the repack) → Task-64; `docs/maps-spec.md` §7 and `docs/design-spec.md` §7 →
  Task-64. It claims no `package.json`, `src/main.ts`, `vite.config.ts`, `src/data/dex/**` or
  `src/engine/save.ts`.
- **Shape:** one task, alone, and it opens the new **Batch 24** for two independent reasons:
  `src/scenes/RouteScene.ts` is held by every batch 5-20 (Batch 20's Task-58 last), and the
  special-room layer it extends (`src/engine/maps/plan.ts` 70, `src/ui/mapView.ts` 26) is
  claimed by Task-65 and Task-66 in the two batches after it — so no two of the three can share
  a batch. It is also the one task of the two rounds that repacks a generated asset (the FRLG
  overworld/trainer atlases), which alone would keep it from sharing a batch. Its money and
  prize tables live in `src/data/` (balance), the spin draws its own stream
  (`${seed}:casino:${mapIndex}`), so a fixed seed's shop stock, reward picks and rosters do not
  move; the recommended reading adds **no** run field (the machine's per-floor lock rides the
  run's existing per-floor bookkeeping and the egg is an ordinary bag item whose species rolls
  at hatch time), so **no `SAVE_VERSION`** step — the alternative is the open question below.

### Batch 25 — the gated reward room
- **Task-65** A special room whose reward sits behind bushes, rocks or water that only a party
  Pokémon's move opens — Cut, Rock Smash, Surf.
- **Hot files:** `src/scenes/RouteScene.ts` (the room's obstacle, the reward pocket and the
  interact gate) → Task-65; `src/engine/maps/plan.ts` + `plan.test.ts` (the new
  `MapRoomSpecial` value and its placement) and `src/ui/mapView.ts` + `mapView.test.ts` (its
  marker) → Task-65; the new `knowsMove`-style accessor beside its test under `src/engine/run/`
  and the obstacle→move mapping in `src/data/` → Task-65; the packed
  `src/assets/frlg/{outdoor,forest,cave}.png` (the new bush/rock frames, via
  `scripts/frlg/build-tilesets.mjs`) and `docs/maps-spec.md` §7 → Task-65. It claims no
  `package.json`, `src/main.ts`, `vite.config.ts`, `src/data/dex/**`, `src/engine/save.ts`,
  `src/engine/run/pool.ts` or `src/engine/run/state.ts`.
- **Shape:** one task, alone: it wants `src/scenes/RouteScene.ts` (every batch 5-20, Batch 20
  last) **and** the special-room layer Task-64 extends one batch earlier and Task-66 one batch
  later, so it opens the new **Batch 25**. It deliberately claims **neither** `[Task-52]`'s
  pool file (`src/engine/run/pool.ts`) **nor** `[Task-31]`'s placement seam
  (`addCaughtPokemon`/`pcCatch`), so it cannot silently duplicate either: the reward it gates is
  an ordinary ground item placed off a stable room id (the `megaStoneItem` shape, 1049-1055),
  not a catch. Surf's gate needs no new tile (the map already carries `WATER` and treats it as
  solid, `src/engine/map.ts` 11/16), so only the bush and the rock owe art; the opening is
  recorded per-floor, so a fixed seed's route geometry is unchanged and **no `SAVE_VERSION`**
  step is owed.

### Batch 26 — the trade room
- **Task-66** A trade room: give one Pokémon, receive a random one.
- **Hot files:** `src/scenes/RouteScene.ts` (the room's fixture and its panel) → Task-66;
  `src/engine/maps/plan.ts` + `plan.test.ts` (the new `MapRoomSpecial` value and its placement)
  and `src/ui/mapView.ts` + `mapView.test.ts` (its marker) → Task-66; the deliberate-removal
  helper and its test under `src/engine/run/` (beside `perms.ts`, whose `releaseFainted` it
  must **not** change) and the received member's build → Task-66; `docs/maps-spec.md` §7 and
  `docs/routes-spec.md` §6's party/PC rule → Task-66. It claims no `package.json`,
  `src/main.ts`, `vite.config.ts`, `src/data/dex/**`, `src/engine/save.ts`, packed asset or
  `src/engine/run/pool.ts`.
- **Shape:** one task, alone, and last of the round: it wants `src/scenes/RouteScene.ts` (every
  batch 5-20, Batch 20 last) and the special-room layer its two batch-mates extend one and two
  batches earlier, so it opens the new **Batch 26**. It is the round's only task that removes a
  **living** member on purpose, so it adds a helper that drops exactly one member and leaves
  `stats.casualties` alone — the permadeath path (`releaseFainted`, 17-29) counts a loss and is
  not the right seam. The received member is built and placed exactly as a catch is
  (`speciesPool` + `createFighter({ learnsetSeed: run.seed })`, D17, at the squad's level
  through `adoptAtLevel`, then `addPokemon`), the trade is one per room and refused on a
  single-member party, and the per-room used flag rides the run's existing per-floor
  bookkeeping — so **no `SAVE_VERSION`** step.

### Batch 27 — the room that bars items and healing moves
- **Task-67** A special room whose battles bar the player's BAG items and healing moves.
- **Hot files:** `src/scenes/RouteScene.ts` (the room's own trainer and the launch flag;
  `buildRoom` 961-1003, `startBattle` 4904-4931) and `src/scenes/BattleScene.ts` (the greyed BAG
  row and healing rows; `openMenu` 1204-1218, `openBag` 1273-1285, `openMoves` 1232-1271) →
  Task-67; `src/engine/maps/plan.ts` + `plan.test.ts` (the new `MapRoomSpecial` kind and its
  placement) and `src/ui/mapView.ts` + `mapView.test.ts` (its marker) → Task-67;
  `src/engine/battle/commands.ts` + `commands.test.ts` (the gate) → Task-67;
  `src/engine/battle/state.ts` (`BattleSetup`/`createBattle`) and `src/engine/run/battleLink.ts`
  (`BattleLaunch`) → Task-67; `src/ui/notice.ts` + `notice.test.ts` (the room's entrance beat,
  the module Task-31 ships in Batch 7) → Task-67; the new room/barred-move table in `src/data/`
  beside its test → Task-67; `docs/maps-spec.md` §7 and `docs/battle-spec.md` §2 → Task-67. It
  claims no `package.json`, `src/main.ts`, `vite.config.ts`, `src/data/dex/**`,
  `src/engine/save.ts` or packed asset.
- **Shape:** one task, alone, and the batch is the only one that leaves its paths free. It is the
  round's one report and it wants `src/scenes/RouteScene.ts` **and** `src/scenes/BattleScene.ts`
  together: the route scene is held by **every** batch from 5 to 26 (5 Task-16, 5b Task-45, 6
  Task-41, 6b Task-38, 7 Task-31, 8 Task-08's every-scene sweep, 8b Task-35, 9 Task-39, 9b
  Task-40, 10 Task-26, 11 Task-29's ledger, 12 Task-30, 13 Task-44, 14 Task-48, 15 Task-49, 16
  Task-50, 17 Task-52, 18 Task-55, 19 Task-56, 20 Task-58, 21 Task-61, 22 Task-62, 23 Task-63, 24
  Task-64, 25 Task-65, 26 Task-66), so no batch before this one leaves it free at all. It could
  not ride beside Task-62 in **Batch 22**, the batch that would otherwise fit: they share both
  scenes, the battle-start seam (`src/engine/battle/state.ts`, `src/engine/run/battleLink.ts`) and
  `docs/battle-spec.md` §4, and `docs/maps-spec.md` §7 is Task-62's there — so the batch would stop
  being an antichain. Nor can it join Task-64/65/66, whose special-room layer
  (`src/engine/maps/plan.ts`, `src/ui/mapView.ts`) it extends in the three batches before it. It
  therefore opens **Batch 27**, one batch behind Task-66, alone. It produces nothing another task
  reads, adds no run field and takes **no** `SAVE_VERSION` step — the room is a plan fact and the
  gate draws no RNG — so the chain stays **14 → 15 → 16 → 17 → 18**. It runs after Batch 11's
  reformat and edits files it cleared, so it keeps them conforming (no new ledger line), the way
  Batches 12–26 do.

### Batch 28 — the MOVES tab deletes an equipped move
- **Task-68** The route HUD's MOVES tab can delete an equipped move: the slot is dropped onto
  the learnset band, the slot becomes empty and the move waits in the band to be re-equipped.
- **Hot files:** `src/scenes/RouteScene.ts` (the MOVES tab's slot press, the live reorder and
  the release; `handleHudPointerMove` 2899-2943, `handleHudPointerUp` 3047-3115,
  `handleDetailPointerDown` 3223-3238, the band's own hit test beside `pointerInBagPanel`
  3638-3645) → Task-68; `src/engine/run/learnset.ts` + `learnset.test.ts` (the new pure
  inverse of `equipMove`, 115-136) → Task-68; `docs/design-spec.md` §3's MOVES paragraph
  (71-78) and `docs/tech-decisions.md` **D36** (520-530, the panel's own operation list) →
  Task-68. It claims no `package.json`, `src/main.ts`, `vite.config.ts`, `src/data/**`,
  `src/data/dex/**`, `src/engine/save.ts`, `src/scenes/BattleScene.ts`, `src/ui/moveGrid.ts`
  or packed asset — and no `docs/` file another batch holds: `docs/design-spec.md` §3 is
  Task-58's in Batch 20 and free here (Task-63 takes §7, not §3), and `docs/tech-decisions.md`
  is nobody's.
- **Shape:** one task, alone, and it is the first batch that leaves the route scene free at
  all: `src/scenes/RouteScene.ts` is held by **every** batch from 5 to 27 (5 Task-16, 5b
  Task-45, 6 Task-41, 6b Task-38, 7 Task-31, 8 Task-08's every-scene sweep, 8b Task-35, 9
  Task-39, 9b Task-40, 10 Task-26, 11 Task-29's ledger, 12 Task-30, 13 Task-44, 14 Task-48,
  15 Task-49, 16 Task-50, 17 Task-52, 18 Task-55, 19 Task-56, 20 Task-58, 21 Task-61, 22
  Task-62, 23 Task-63, 24 Task-64, 25 Task-65, 26 Task-66, 27 Task-67), so no batch before
  this one can host it, and the second path it wants — `src/engine/run/learnset.ts` with its
  test — is Task-56's in Batch 19 and free from Batch 20 on. It is written **against** Task-56's
  shipped state: with the learnset the only equip path, a deleted move stays learned and the
  slot it frees stays empty until the player drags something back, which is the rule this task
  completes rather than fights. The three other paths the report could reach are free in this
  batch too, so the open questions below can be answered either way without re-cutting it:
  `src/scenes/BattleScene.ts` (held by Task-67 in Batch 27), `src/ui/moveGrid.ts` (Task-58's
  in Batch 20) and `src/engine/run/progression.ts` (Task-56's in Batch 19) are all nobody's
  here — and the default reading touches none of them. It edits files Batch 11's reformat
  cleared, so it keeps them conforming (no new ledger line), the way Batches 12–27 do. It adds
  no run field and draws no RNG, so **no `SAVE_VERSION`** step and no fixed-seed re-pin.

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
behind the mini-boss reward) and the tenth round's three add eight (four behind the casino,
two behind the gated reward room and two behind the trade room) and the eleventh round's single
report adds six (all behind the no-items/no-heal room) and the twelfth round's single report
adds four (the surface, the last move, the gesture and the confirm, all behind the MOVES tab's
delete) — and the **eighteenth round's two decisions add no question at all**: they *answer* two
of them, so the grid's reading and the follower's missing-sheet case leave this list (both are
frozen in `[Task-34]`'s and `[Task-41]`'s entries and in the round's own paragraph above, and the
follower's bullet below is rewritten to the ids `[Task-76]`'s manifest lists as missing) — and every
question here carries a written default rather than a guess. **Batch 5b's seven are all
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
The one ID without a batch is not a question: `[Task-28]` waits on an upstream
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

- **`[Task-64]` (the casino, Batch 24): when does the machine lock — on the battle's trigger, or
  on a win?** The report's words are «posibilidad de combate contra el recluta y ya no se puede
  tirar de la tragaperras», which can be read either way. The written default is that the
  machine locks the moment the grunt battle **triggers** (the grunt stops the game whatever the
  outcome, and a loss ends or costs the run anyway); the alternative is that it locks only once
  the grunt is **beaten** (`isTrainerDefeated`, `state.ts` 501-503), which lets a player who
  flees or loses come back and spin again. Say which before Batch 24's branch is cut. Nothing
  else in the plan changes either way.

- **`[Task-64]` (the casino, Batch 24): does the egg open on a floor advance or on a room
  change?** «se abre al pasar de piso» names a **floor**, and the run has two advances: the map
  advance (`advanceMap`, `state.ts` 185-204, the portal step at `RouteScene` 4398) and the room
  change (`advanceRoute`, 161-175). The written default is the **map advance** — a floor is a
  map (`docs/maps-spec.md` §1) — so the egg hatches at the heal stop, at the same beat the run
  steps onto the next biome; the alternative is the room change, which hatches it almost
  immediately and makes the egg a delayed pickup rather than a floor promise. Say which before
  Batch 24's branch is cut. Nothing else in the plan changes either way.

- **`[Task-64]` (the casino, Batch 24): is the egg a bag item or a run field?** The recommended
  reading is a **bag item** (a new `egg` entry in `src/data/items.ts`) whose species rolls at
  hatch time from the new floor's band, so the egg is a plain stack the save already carries and
  the task adds **no** run field and **no** `SAVE_VERSION` step; the alternative is a run field
  that remembers the species (or the whole prize) at **spin** time, which fixes what the egg
  will be the moment it is won but takes the next `SAVE_VERSION` step (**18 → 19**, after
  Task-52's 17 → 18) and a migration. Say which before Batch 24's branch is cut. Nothing else in
  the plan changes either way.

- **`[Task-64]` (the casino, Batch 24): is the grunt battle a spin outcome, or the room's own
  entrance beat?** The report lists the battle among what the machine does. The written default
  is that it is a **spin outcome** — the prize table (or the machine's own chance) rolls it, so
  the player can spend a spin and get a fight instead of a prize — and the machine then locks
  (the question above); the alternative is that entering the room always opens the battle first,
  with the machine available only after it, which makes the grunt a gate rather than a gamble.
  Say which before Batch 24's branch is cut. Nothing else in the plan changes either way.

- **`[Task-65]` (the gated reward room, Batch 25): may any party member open it, or only the
  lead?** The report says «algun poke del party conoce cierto movimiento» — **some** Pokémon of
  the party — so the written default is **any** member, the lead included, with no
  lead special-case; the alternative is that only the lead's moveset is asked (the follower
  Pokémon the route already draws is the lead, `[Task-41]`), which reads as a visible
  requirement but silently ignores a move the rest of the party knows. Say which before Batch
  25's branch is cut. Nothing else in the plan changes either way.

- **`[Task-65]` (the gated reward room, Batch 25): does an opened obstacle stay open for the
  floor?** The written default is **permanent for the floor**: the opening is recorded like a
  taken ground item (`pickedItems` with a stable room-scoped id, `state.ts` 104-107), so a
  revisit finds it open and `advanceMap` clears it (199-201) — no run field and no
  `SAVE_VERSION` step. The alternative is that the obstacle closes again when the player leaves
  the room, which makes the reward a one-shot visit and needs no bookkeeping at all, but also
  lets a player who walked in, opened it and walked out re-open it for free. Say which before
  Batch 25's branch is cut. Nothing else in the plan changes either way.

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

- **`[Task-67]` (the no-items/no-heal room, Batch 27): is the room a special leaf, or a condition
  on a regular room?** The report says «habitacion con efecto», and the mould the casino, the
  gated reward room and the trade room all use is the special leaf (`MapRoomSpecial`,
  `src/engine/maps/plan.ts` 70). The written default is the **special leaf** — a new kind placed
  like the mini-boss, quiet, with its own trainer — because it is the same shape the three rooms
  just planned take and the special pass already exists. The alternative is a **condition on a
  regular room** (the `[Task-62]` shape), which lets any trainer or wild battle in that room begin
  barred and needs no new room kind, but makes the effect a property rather than a room the player
  recognises. Say which before Batch 27's branch is cut. Nothing else in the plan changes either
  way.

- **`[Task-67]` (the no-items/no-heal room, Batch 27): does the rule bind the player alone, or
  both sides?** The report's words are the player's («no se pueden usar objetos» is the player's
  bag, and `validateBag` already refuses every other side, `commands.ts` 81). The written default
  is the **player alone** — the room is a challenge for the player, and the enemy's own heals stay
  part of the fight. The alternative is **both sides**, which the enemy AI would also have to obey
  (Task-35's scorer weighs healing, so a barred heal must not be chosen) and which makes the room
  a clean no-heal duel. Say which before Batch 27's branch is cut. Nothing else in the plan
  changes either way.

- **`[Task-67]` (the no-items/no-heal room, Batch 27): does it bar the passive heals too —
  abilities, held items and the residual heals?** The engine models healing abilities
  (Regenerator, Water Absorb / Volt Absorb / Dry Skin, Ice Body / Rain Dish, Poison Heal;
  `src/engine/battle/effects/abilities.ts` 178 / 215 / 429 / 563 / 683), held-item heals
  (Leftovers, Black Sludge, the Berries; `effects/items.ts` 152 / 207) and the residual heals
  (Wish, Leech Seed, Aqua Ring / Ingrain, Grassy Terrain; `turn.ts` 1049-1097). The written
  default is **no** — the rule bars the BAG action and the named healing moves only, because those
  are the two things the report names and a full suppression is a Heal Block-sized rule the engine
  does not have (`healblock` is `excluded`, moveCoverage 1919-1923). The alternative is the **full
  Heal-Block reading**, which suppresses every HP restoration on the barred side and needs a term
  in each heal path. Say which before Batch 27's branch is cut. Nothing else in the plan changes
  either way.

- **`[Task-67]` (the no-items/no-heal room, Batch 27): does the room also bar healing outside the
  battle — the Pokevial and the PC?** The report names items and moves, both battle things, but
  the run heals outside battle too: `usePokevial` rests the party and the box
  (`src/engine/run/heal.ts` 62) and the map advance is the heal stop (`advanceMap`, `state.ts`
  185-204). The written default is **no** — the rule is a battle rule and the room only
  bars what the report names, so a Pokevial drunk in that room still works and the heal stop is
  untouched. The alternative is that the room **also refuses the Pokevial** (and the PC) while the
  player stands in it, which makes the effect a room-wide one. Say which before Batch 27's branch
  is cut. Nothing else in the plan changes either way.

- **`[Task-67]` (the no-items/no-heal room, Batch 27): what happens when the player's last Pokémon
  faints in a barred battle?** The report removes the ability to heal but says nothing about
  losing. The written default is the **normal rule**: the battle is lost, a wipe ends the run and
  permadeath applies (D5, `docs/battle-spec.md` §5), because the room changes what the player may
  do, not what a loss costs. The alternative is that the room's battle **cannot end the run** (a
  loss only retreats the player), which reads as a mercy the roguelike's own promise argues
  against. Say which before Batch 27's branch is cut. Nothing else in the plan changes either way.

- **`[Task-67]` (the no-items/no-heal room, Batch 27): how is the rule surfaced to the player?**
  The written default is **both**: the battle's own feed announces the room's effect when the
  battle opens, the BAG row and the healing rows are drawn disabled (`openMenu` 1210,
  `openMoves` 1235-1238), and the route raises a temporary notice on entering the room through the
  existing `src/ui/notice.ts` module Task-31 ships (Batch 7) — one module, N strings, the way
  Task-49 and Task-50 extend it. The alternatives are the battle-side controls alone (no entrance
  beat) or the entrance beat alone (the battle just refuses the command). Say which before Batch
  27's branch is cut. Nothing else in the plan changes either way.

- **`[Task-68]` (the MOVES tab's delete, Batch 28): which surface does "menu moves" mean?**
  The report names "menu moves" and the tree has three: the route HUD's **MOVES** tab (the
  detail panel's `'moves'` mode, the only place a move is ever equipped), the battle's **moves**
  menu (the per-turn FIGHT command menu, `docs/design-spec.md` §4 175-176) and the battle's
  SWITCH detail window (read-only rows). The written default is the **route HUD's MOVES tab
  alone** — "equipado" is a fact about the run's member, and the battle has no equip seam, no
  drag and only a restored snapshot of the member — which leaves `src/scenes/BattleScene.ts` and
  `src/ui/moveGrid.ts` untouched; the alternative is **both** surfaces, which adds a battle-time
  delete whose result would have to travel back through `BattleReturn` to reach the run and
  which puts `src/scenes/BattleScene.ts` in this task (free in Batch 28, so the batch would not
  have to be re-cut). Say which before Batch 28's branch is cut. Nothing else in the plan
  changes either way.

- **`[Task-68]` (the MOVES tab's delete, Batch 28): may the last remaining move be deleted?**
  The tree forbids a zero-move member in three places — the save decoder **drops** such a
  member (`parseFighter`, `src/engine/save.ts` 442-449), the fight branch of `validateCommand`
  refuses every index once the list is empty (`commands.ts` 103-105) and the FIGHT menu would
  draw nothing (`openMoves`, `BattleScene` 1235) — while the engine's Struggle fallback covers
  only a moveset whose moves are all **spent** (`selectedMove`, 52-66). The written default is
  that a **one-move member is refused**, so the invariant those three places already assume
  survives and the save decoder stays out of the task; the alternative is that the last move may
  go, which needs the decoder's guard relaxed (`parseFighter` 449) **and** a fight path for a
  move-less member — the battle's menu would have to offer Struggle, a rule `[Task-35]`'s AI
  also weighs — and takes `src/engine/save.ts` + `save.test.ts` and
  `src/engine/battle/commands.ts` into this task. Neither reading adds a run field, so **no
  `SAVE_VERSION`** step either way: relaxing a decoder's tolerance is a decode-time
  normalisation, the `[Task-33]` precedent. Say which before Batch 28's branch is cut. Nothing
  else in the plan changes either way.

- **`[Task-68]` (the MOVES tab's delete, Batch 28): how does the player delete — a drag back
  onto the band, or a control in the slot?** The report names no gesture. The written default is
  the **drag onto the learnset band**, the exact inverse of `[Task-55]`'s equip drag and the
  shape the tree already uses for the other equipped thing (a held-item badge dropped on the
  bag, `RouteScene` 3089-3105), which keeps the diff in `RouteScene` and the one engine helper;
  the alternative is a small **✕ control** drawn in each slot cell, which is more discoverable
  but adds a per-cell piece and a hit test to `src/ui/moveGrid.ts` (and the test `[Task-55]`
  creates) and would be drawn by the battle's grid too — free in Batch 28, so that reading costs
  no re-cut. A third reading, a key on a selected slot, needs a persistent cursor the MOVES tab
  does not have. Say which before Batch 28's branch is cut. Nothing else in the plan changes
  either way.

- **`[Task-68]` (the MOVES tab's delete, Batch 28): is the delete confirmed?** The report says
  nothing, and the action is **free and reversible** — the move stays in the band and teaching is
  free (D36), so a delete costs the player nothing but a drag back — while the gesture itself is
  a drag that ends on the band, which is also where a reorder drag may end by accident. The
  written default is **no prompt**: the delete lands on release and a mis-drop is undone by
  dragging the move back, the way a mis-dropped held item is; the alternative is a yes/no prompt
  on the drop, which guards the mis-drop but introduces the HUD's first confirm window (the
  capture prompt `[Task-31]` deletes is the only one the tree ever had). Say which before Batch
  28's branch is cut. Nothing else in the plan changes either way.

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
      **Inherited condition from the rustle's own work (Batch 5b, shipped; Task-73 in 5c,
      shipped) — closed, and what it means now.** The packer **no longer re-grounds** the
      rustle's frames: cells 6 and 45-48 carry the decomp's `tall_grass.png` frames **with their
      own alpha**, so the overlay is ground-neutral and no field's floor is ever composited into
      them. The condition the earlier note carried — a field whose tuft sat on a ground other than
      its floor needing its hit frames re-grounded onto the tuft — **no longer applies**: nothing
      is composited for those cells. What a new field still owes is the rest: its own
      **tall-grass ground tile** (cell 5, still stamped per field from that field's `tallGrass`
      source, `[7,0]` light / `[2,33]` dark) and its own `terrain.grassPatches` — the cave field
      is the one with `grassPatches: 0` today (`src/data/biomes.ts`, 48-54, and `BIOME_ORDER` is
      `['forest']`, line 58, so no route reaches the cave or the outdoor field), and it joins the
      cycle from this task alone. The overlay's five cells are shared by all fields and are
      correct on any ground.
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
- [ ] **[Task-58] Every panel becomes a dark glass card (the `t-glass` direction).** Reported in
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
- [ ] **[Task-61] Beating the map boss no longer teleports the player to the room's door.**
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
      *Dependencies:* none. Batch order covers it: it wants `src/scenes/RouteScene.ts`, which
      **every** batch from 5 to 20 holds (5 Task-16, 5b Task-45, 6 Task-41, 6b Task-38, 7
      Task-31, 8 Task-08's every-scene sweep, 8b Task-35, 9 Task-39, 9b Task-40, 10 Task-26, 11
      Task-29's ledger, 12 Task-30, 13 Task-44, 14 Task-48, 15 Task-49, 16 Task-50, 17 Task-52,
      18 Task-55, 19 Task-56, 20 Task-58), so it opens the plan's new **Batch 21** — and it is
      the round's only defect, so it runs first. *(Batch 21)*
- [ ] **[Task-62] A trainer or boss room's battle may begin under a weather, a terrain or a room
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
      *Dependencies:* none — every rule it reads is shipped and the roll composes shipped
      primitives. Batch order covers it: it wants `src/scenes/RouteScene.ts` **and**
      `src/scenes/BattleScene.ts` together, and every batch from 5 to 20 holds the route scene
      while the battle scene is held by 5, 5b, 6, 6b, 7, 8, 8b, 9, 9b, 10, 11, 12, 14, 17, 18 and
      20 — so it opens the plan's new **Batch 22**, one batch behind Task-61. *(Batch 22)*
- [ ] **[Task-63] A beaten mini-boss also offers three unidentifiable Pokémon beside its item
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
      *Dependencies:* none — the chooser composes shipped primitives. Batch order covers it: it
      wants `src/scenes/RouteScene.ts` and `src/ui/rewards.ts`, and the route scene is held by
      every batch from 5 to 20 — so it opens the plan's new **Batch 23**, one batch behind
      Task-62. *(Batch 23)*
- [ ] **[Task-64] A casino room: a Team Rocket grunt, a slot machine the player pays to spin, and
      its prizes.** Reported in play: «añade tarea para añadir habitacion casino, aparece un sprite
      de un recluta team rocket, aparece una tragaperras y pagas por tiradas con posibilidad de
      huevo da un poke random se abre al pasar de piso, objetos, posibilidad de combate contra el
      recluta y ya no se puede tirar de la tragaperras».
      **What a special room is today.** `MapRoomSpecial` is `'shop' | 'mini-boss' | 'mega-stone'`
      (`src/engine/maps/plan.ts`, 70), placed as **dead-end leaves** by `planMap`'s special pass
      (402-445): the guaranteed shop near the entry, the mini-boss at `MINI_BOSS_CHANCE = 0.5`
      (111) and the mega-stone at 0.15 from map 3 (114, 442-445), each hung off a regular room
      that is neither the entry nor the boss (404-413), listed in `plan.specials` (479-481) and
      found by `specialRoom(plan, kind)` (502-504). The route builds a special's content in
      `buildRoom` (`src/scenes/RouteScene.ts`, 986-1002): the mini-boss's trainer (987-992), the
      mega-stone's item (996-1002) and the shop's counter (`this.shopCounter = view.special ===
      'shop' ? this.farthestRoomTile() : null`, 995). That counter is the **model for a room-local
      fixture**: it is drawn by `drawShopCounter` (4266-4274), its interact key is `tryInteract`'s
      first branch (4630-4634 → `openShop`, 5456-5470), and its panel is the Mart
      (`buildShopPanel` 5482-…, `refreshShop` 5587-…, `activateShop` 5684-…), a HUD window that
      exists only in that room. `mapView` draws each special's own minimap icon (`MapRoomMarker`,
      `src/ui/mapView.ts`, 26) through `RouteScene.drawMapMarker` (2263-2297).
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
      **Fix shape, as the recommended reading (the spec freezes the names):**
      1. `MapRoomSpecial` gains `'casino'` (`plan.ts`, 70) and the special pass hangs it like the
         mini-boss, on a chance constant beside `MINI_BOSS_CHANCE`/`MEGA_STONE_CHANCE` drawn on
         the same `map` stream; `mapView`'s marker and `drawMapMarker` gain its own icon.
      2. `buildRoom` places the room's **two fixtures** — the slot machine and the grunt's
         overworld sprite — at the room's farthest free tiles (the `farthestRoomTile` helper,
         1061-1090, is the model). The grunt is a new `rocket`/`grunt` **archetype**
         (`src/data/trainers.ts`, the `TrainerArchetype` shape at 31-56), so its overworld frame
         and battle sprite come from the packed FRLG atlases (`src/data/frlg/overworld.json`,
         `src/data/frlg/trainers.json`, packed by `scripts/frlg/build-overworld-sprites.mjs` and
         `build-trainer-sprites.mjs`) — a repack, so this task holds those packed files.
      3. The machine's **price, prize table and odds** live in `src/data/` (a new table beside the
         shop's — `{ price, prizes: [{ kind: 'item' | 'egg', itemId?, weight }] }` plus the battle
         chance) and the roll is one pure chooser beside `rewardChoices` (`src/ui/rewards.ts`) or
         a sibling, on its **own stream** `Rng(hashSeed(`${seed}:casino:${mapIndex}`))`, so the
         floor's shop stock, reward picks and rosters do not move (D11).
      4. A spin costs `spendMoney` and rolls the prize table: an **item** lands through `addItem`;
         an **egg** lands as an ordinary bag item (a new `egg` entry in `src/data/items.ts`) and
         **hatches on a floor advance** — the beat is `advanceMap`'s, where the run steps onto the
         next floor, not `advanceRoute`'s — turning into a random Pokémon of the new floor's band
         (a pure `hatchEgg(...)` the scene calls after `transitionTo(advanceMap(...))`, placed by
         `addPokemon` so a full party sends it to the box). Rolling the species **at hatch time**
         rather than storing it keeps the egg a plain bag stack: **no new run field and no
         `SAVE_VERSION` step**.
      5. The **grunt battle** is a spin outcome; when it triggers the machine **locks**. The lock
         is per-floor, so it rides the run's existing per-floor bookkeeping rather than a new
         field: the spec freezes whether it reuses `pickedItems` with a stable room-scoped id
         (the `megaStoneItemId(view.mapIndex)` shape, 1049-1055) or adds a dedicated per-floor
         list; either way it clears on `advanceMap` like `defeatedTrainers`/`pickedItems`/
         `capturedRooms` (`state.ts`, 102-107, 199-201).
      **`SAVE_VERSION` verdict:** the recommended reading adds **no** run field (the lock is a
      per-floor id and the egg is a bag item), so the chain stays 14 → … → 18; the alternative
      (an egg that remembers its species, or a dedicated per-floor list) takes the next step,
      which is the open question below.
      **Docs:** the special-room table and its content bullets in `docs/maps-spec.md` §7 and the
      special-rooms bullet in `docs/design-spec.md` §7 (251-262) gain the casino.
      Out of scope: the Mart and its stock, the mini-boss reward, the mega-stone, the loot pools,
      the money a trainer drops, and the battle rules themselves — the grunt fights through the
      existing trainer path.
      *Dependencies:* none. Batch order covers it: it wants `src/scenes/RouteScene.ts` (held by
      every batch 5-20, Batch 20's Task-58 last), `src/engine/maps/plan.ts` and
      `src/ui/mapView.ts` — the special-room layer `[Task-65]` and `[Task-66]` also extend, which
      is why the three cannot share a batch — so it opens the plan's new **Batch 24**, one batch
      behind Task-63. *(Batch 24)*
- [ ] **[Task-65] A gated reward room: a reward behind a blocked path only a party move opens.**
      Reported in play: «añade tarea habitacion especial que da recompensa pero el camino esta
      bloqueado y solo se puede entrar si algun poke del party conoce cierto movimiento por ejemplo
      corte y aparecen arbustos o rocas y necesitas golpe roca o agua y necesitas surf».
      **What the generator can already place.** A room's tiles are the route builder's
      (`sketchRoute`, `src/engine/routes/`), whose terrain pass carves tall grass and ledges and
      whose `WATER` is decoration only (`docs/route-generator.md`, 167; D18). The tile vocabulary
      is `FLOOR/WALL/EXIT/TRAP/CHEST/ITEM/WATER/CARPET/TALL_GRASS/LEDGE` (`src/engine/map.ts`,
      5-14), `isWalkable` refuses `WALL/WATER/LEDGE` (16-27) and `resolveMove`/`tileAt` are the
      step rules (57-77). A **reward pocket** is an item placed on a flood-fill-reachable pocket
      (the ground-item pass, `docs/route-generator.md` §"Items", 381), and a room's content is
      injected in `buildRoom` (`RouteScene`, 986-1002) off stable ids — the mega-stone's
      `megaStoneItem` (1049-1055) is the model for a room-scoped item. A special room kind is
      `MapRoomSpecial` (`plan.ts`, 70) with its minimap marker (`mapView.ts`, 26).
      **What "the party knows this move" can read.** Every member carries its four slots:
      `member.fighter.moves` (`MoveSlot[]`, `src/engine/battle/fighter.ts`, 144) — a test is
      `member.fighter.moves.some((slot) => slot.moveId === moveId)`, the shape the engine's own
      OHKO guard already uses (`fighter.ts`, 419) — and the party and box are `run.party`/
      `run.box` (`state.ts`, 93-94). There is **no** `knowsMove` accessor today, so this task adds
      one (a pure helper under `src/engine/run/`, with a test).
      **Fix shape:** one room kind, one obstacle kind, one gate rule. `MapRoomSpecial` gains a
      gated-reward kind; `buildRoom` carves the room's obstacle across the only path to a reward
      pocket and places the reward on the far side — the room's tiles come from `buildRoute`'s
      request, so the spec freezes whether that is an `obstacle` field on the route params or a
      post-carve pass on the built `RouteMap`, with the pocket's reachability proven by the same
      flood-fill the generator already uses. The obstacle maps to the report's own moves — a
      **bush** for Cut, a **rock** for Rock Smash, **water** for Surf (the `WATER` tile already
      ships and is already solid, so Surf's gate needs no new tile) — and the interact key, facing
      the obstacle, opens it only when a party member knows the move, with the opening recorded
      per-floor (the `pickedItems`-with-a-stable-id shape, so it stays open on a revisit and
      clears on `advanceMap`, `state.ts`, 104-107, 199-201). New bush/rock frames go into the
      packed FRLG tileset atlases (`scripts/frlg/build-tilesets.mjs`, `src/assets/frlg/*.png`), so
      this task holds that packed file.
      **The gating call the entry freezes:** **any** party member may open it (the report says
      «algun poke del party») with no lead special-case; the alternative (the lead alone) is the
      open question below. The task must not duplicate `[Task-52]`'s pool rule (a different rule
      on the encounter table) or `[Task-31]`'s placement seam (a catch's placement): it claims
      neither `src/engine/run/pool.ts` nor `addCaughtPokemon`/`pcCatch`, and the reward it gates
      is an ordinary ground item off a stable room id, not a catch.
      Out of scope: the wild pool, the catch placement, the route generator's geometry beyond the
      room's own carve, the field moves' battle effects (Cut/Rock Smash/Surf as moves stay as they
      are), the party/PC panel, and the map filter `[Task-62]` draws.
      *Dependencies:* none. Batch order covers it: it wants `src/scenes/RouteScene.ts` (every
      batch 5-20, Batch 20 last), `src/engine/maps/plan.ts` and `src/ui/mapView.ts`, so it opens
      the plan's new **Batch 25**, one batch behind Task-64, and it can share neither of the
      special-room files with Task-64 or Task-66. *(Batch 25)*
- [ ] **[Task-66] A trade room: give a Pokémon, receive a random one.** Reported in play:
      «añade tarea habitacion intercambio pokemon donde das un poke y te da otro random».
      **What a member removal and addition may use.** A member is removed today only by
      permadeath: `releaseFainted` (`src/engine/run/perms.ts`, 17-29) filters every 0-HP member
      out of `party` and `box` and **bumps `stats.casualties`** — the wrong counter for a
      deliberate trade, so this task adds a removal helper that drops exactly one member and
      leaves `casualties` alone. A member is added by `addPokemon` (`state.ts`, 257-…, party then
      box) and a catch is placed by `addCaughtPokemon` (480-482, which also unlocks the box
      member); the PC box is `run.box` and the party/PC panel is `src/ui/partyScreen.ts`. A random
      member is `speciesPool(band, 'wild')` + `createFighter({ learnsetSeed: run.seed })` (D17) +
      `runPokemonFromSnapshot`, at the squad's level through `adoptAtLevel` (`progression.ts`,
      114-140) — exactly the catch's own fold (`resolve.ts`, 92-101).
      **Fix shape:** one room kind, one panel, one pure trade. `MapRoomSpecial` gains a trade kind
      (`plan.ts`, 70) with its marker (`mapView.ts`, 26); `buildRoom` places the room's fixture
      (the shop-counter model, `RouteScene` 995 / `drawShopCounter` 4266-4274); the interact key
      opens a room-local panel (the Mart's shape, `openShop` 5456-5470) that lists the party and
      takes one pick; choosing removes that member and adds a random one **at the squad's level**
      (the catch rule, `docs/battle-spec.md` §7). The trade is **optional** (leaving grants
      nothing, the reward window's `Q` path) and **one per room**, recorded per-floor like the
      gated room's opening, so a revisit finds it used and `advanceMap` clears it (`state.ts`,
      104-107, 199-201) — no new run field and **no `SAVE_VERSION`** step.
      **The calls the entry freezes:** optional (the report says "das un poke", not "you must"),
      one per room, and **refused when the party holds a single member** — a trade would leave the
      run with an empty party, which the run cannot represent (`hasLivingParty`, `RouteScene`
      5093); the received member joins the party, or the box when the party is full (it never is
      here, since one left). The received Pokémon's level is the squad's (the catch rule); the
      alternative (the room's band level) is the open question below.
      **Docs:** the special-room table in `docs/maps-spec.md` §7 and the party/PC rule in
      `docs/routes-spec.md` §6 (the one place a member is removed outside a battle) gain the
      trade.
      Out of scope: the catch's placement and its capture window, the permadeath rule and its
      release beat (`releaseFainted` is read, never changed), the party/PC panel's own layout and
      swap rules, the wild pool, and the other two new special rooms.
      *Dependencies:* none. Batch order covers it: it wants `src/scenes/RouteScene.ts` (every
      batch 5-20, Batch 20 last), `src/engine/maps/plan.ts` and `src/ui/mapView.ts` — the layer
      Task-64 and Task-65 also extend — so it opens the plan's new **Batch 26**, the last of the
      round. *(Batch 26)*
- [ ] **[Task-67] A room whose battles bar the player's items and healing moves.** Reported in
      play: «añadir habitacion con efecto no se pueden usar objetos ni movimientos de cura» — a
      room whose effect is that the player cannot use items and cannot use healing moves.
      **What "using an item" is today, verified.** The BAG is the **player's alone**:
      `validateBag` (`src/engine/battle/commands.ts`, 80-87) refuses any other side ("Only the
      player has a Bag.", 81) and `useBagItem` (131-184) is the single place a stack is spent —
      the heal branch at 157-168 (`healFraction`/`healAmount`, the Potion shape), the cures at
      169-171, the boosts at 172-179 and the ball at 144-155. The command is `BagCommand` (22),
      validated in `validateCommand`'s `case 'bag'` (121-122) and applied in
      `resolvePreMoveActions` (`turn.ts`, 127-128), both reached from `takeTurn` (1136-1138).
      The run's bag is `RunState.bag: readonly BagCounts[]` (`src/engine/run/state.ts`, 95),
      carried on `BattleLaunch.bag` (`src/engine/run/battleLink.ts`, 48), mapped into
      `BattleSetup.bag`/`BattleState.bag` (`BattleScene.create`, 401-404; `state.ts`, 105,
      120-128) and handed back on `BattleReturn.bag` (66). The scene side is `openMenu`'s BAG row
      (`enabled: this.usableBag().length > 0`, `BattleScene` 1210), `openBag` (1273-1285) and
      `usableBag` (1362-1370).
      **A "healing move" is frozen by id, split by the path that applies the heal** (the spec
      names them; nothing else is a healing move):
      - the **fraction self-heals** through the move's own `heal` field (`turn.ts`, 369-375):
        `recover`, `softboiled`, `slackoff`, `milkdrink`, `roost` and `lifedew` (each `port`,
        `data: heal` — `src/data/moveCoverage.json`, 3383 / 3995 / 3875 / 2645 / 3545 / 2381);
      - the **effect-handled heals** in `src/engine/battle/effects/moves.ts` (`MOVE_EFFECTS`,
        604-638): `synthesis` / `moonlight` / `morningsun` (`sunHeal`, 546-553, 621-622 / 634),
        `shoreup` (`shoreUp`, 556-563, 629), `rest` (626), `junglehealing` / `lunarblessing`
        (`healAndCure`, 618-619) and `swallow` (633);
      - the **drain moves** through `move.drain` (`turn.ts`, 391-406), which restore half the
        damage dealt or less: `absorb`, `megadrain`, `gigadrain`, `drainpunch`, `drainingkiss`,
        `dreameater`, `hornleech`, `leechlife`, `oblivionwing` and `paraboliccharge` (all `port`,
        `data: drain` — moveCoverage 5 / 2567 / 1709 / 1085 / 1091 / 1097 / 2021 / 2357 / 2879 /
        2951).
      **Excluded, and why.** `healpulse`, `floralhealing` and `healingwish` are `port` only
      through `data: flags.protect` (moveCoverage 1931-1935, 1529-1533, 1937-1941): the protect
      flag is data, but **no handler restores HP**, so they heal nothing today and the rule must
      not name them; `healorder` and `healblock` are `excluded` ("no playable species has it",
      1925-1929), so there is no Heal Block to reuse. `wish` (a delayed self-heal, `turn.ts`,
      1049-1061) and the **passive** heals — `leechseed` (1063-1076), `aquaring` / `ingrain`
      (1088-1097), `grassyterrain` (999-1011), the healing abilities (`effects/abilities.ts`,
      178 / 215 / 429 / 563 / 683) and the held-item heals (`effects/items.ts`, 152 / 207) — are
      not "moves the player uses", so the default rule leaves them alone (the open question below
      offers the full Heal-Block reading).
      **The room layer the other rooms use.** `MapRoomSpecial` is `'shop' | 'mini-boss' |
      'mega-stone'` (`src/engine/maps/plan.ts`, 70), placed as dead-end leaves by the special pass
      (402-445) and found by `specialRoom` (502-504); `mapView` draws each kind's own marker
      (`MapRoomMarker`, `src/ui/mapView.ts`, 26); `RouteScene.buildRoom` injects a special's
      content (961-1003) and `buildRoute` marks a special room **quiet** — no grass, no regular
      trainers, no ground items (1129-1133) — so a special that must hold a battle owes its own
      trainer the way the mini-boss does (986-992).
      **Fix shape, as the recommended reading (the spec freezes the names).**
      1. `MapRoomSpecial` gains a kind (e.g. `'no-heal'`) placed like the mini-boss, on its own
         chance constant beside `MINI_BOSS_CHANCE` / `MEGA_STONE_CHANCE` (111 / 114), with its
         marker in `mapView`.
      2. `buildRoom` fields the room's own trainer (the mini-boss's shape, 986-992), because a
         special room is quiet.
      3. `BattleLaunch` (`battleLink.ts`, 45-57) gains the room's flag, set by
         `RouteScene.startBattle` (4918-4927); `BattleSetup` / `createBattle` (`state.ts`,
         120-128, 130-174) carry it; `commands.ts` gates the BAG (`validateBag`, 80-87) and the
         healing moves (the fight branch of `validateCommand`, 101-120, reads the barred set);
         and `BattleScene`'s `openMenu` / `openBag` / `openMoves` (1204-1271) grey the BAG row and
         the healing rows while the feed announces the room's effect.
      4. The barred-move set and the room's own parameters live in `src/data/` (a new table beside
         the shop's and the loot's), never in the engine.
      **The reading the entry freezes:** the rule is the **player's** alone (the report's "no se
      pueden usar objetos" is the player's bag, and `validateBag` already refuses every other
      side) and it bars the **BAG action and the healing moves only** — not abilities, not held
      items and not the passive heals. Both halves are the open question below.
      **RNG (AGENTS.md's fixed-seed rule):** the recommended reading rolls the room on the
      existing `map` stream (the special pass's shape), so a fixed seed's floor plan **re-pins** —
      `src/engine/maps/plan.test.ts` and any fixed-seed expectation that reads the plan — and the
      draw is appended **after** the mega-stone chance, so only floors whose stream reaches it
      change. The alternative (a regular-room condition on its own stream keyed to
      `routeIndexForRoom`, the `[Task-62]` shape) moves nothing. The gate itself draws **no RNG**:
      a barred move or item is rejected before any roll, so no existing `battle` stream moves.
      **`SAVE_VERSION` verdict: no step.** The room is a plan fact (no run field) and its trainer's
      defeat rides the existing per-floor `defeatedTrainers` (`state.ts`, 102-103), so nothing new
      is persisted and the chain stays **14 → 15** (Task-13, shipped) → **15 → 16** (Task-31,
      Batch 7) → **16 → 17** (Task-44, Batch 13) → **17 → 18** (Task-52, Batch 17).
      **Docs:** the special-room table in `docs/maps-spec.md` §7 (182-193) gains the room, and the
      bag rule in `docs/battle-spec.md` §2 (26, "Trainer battles allow items") gains the room's
      exception.
      Out of scope: the Mart and the Pokevial, the PC, the catch and the ball branch, the enemy's
      own items (it carries none — `validateBag` refuses every other side), the healing abilities
      and the held items, and the field/weather conditions `[Task-62]` seeds.
      *Dependencies:* none — every primitive it reads is shipped. Batch order covers the rest: it
      wants `src/scenes/RouteScene.ts` **and** `src/scenes/BattleScene.ts` together, and every
      batch from 5 to 26 holds the route scene (5 Task-16, 5b Task-45, 6 Task-41, 6b Task-38, 7
      Task-31, 8 Task-08's every-scene sweep, 8b Task-35, 9 Task-39, 9b Task-40, 10 Task-26, 11
      Task-29's ledger, 12 Task-30, 13 Task-44, 14 Task-48, 15 Task-49, 16 Task-50, 17 Task-52,
      18 Task-55, 19 Task-56, 20 Task-58, 21 Task-61, 22 Task-62, 23 Task-63, 24 Task-64, 25
      Task-65, 26 Task-66) — so it opens the plan's new **Batch 27**, one batch behind Task-66.
      It could not ride beside Task-62 in **Batch 22**: they share both scenes, the battle-start
      seam (`src/engine/battle/state.ts`, `src/engine/run/battleLink.ts`) and
      `docs/battle-spec.md` §4, and `docs/maps-spec.md` §7 is Task-62's there — so the batch would
      stop being an antichain. Nor can it join Task-64/65/66, whose special-room layer
      (`src/engine/maps/plan.ts`, `src/ui/mapView.ts`) it extends in the three batches before it.
      *(Batch 27)*

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

- [ ] **[Task-68] The MOVES tab can delete an equipped move.** Reported in play: «añade tarea
      en menu moves permitir borrar un movimiento equipado» — the MOVES menu should let the
      player delete a move the member has equipped.
      **What "the MOVES menu" is today, in each of its three homes.** The **route HUD's MOVES
      tab** is the detail panel's `'moves'` mode (`DetailTab = 'stats' | 'moves'`,
      `src/ui/partyDetail.ts` 26; the tab's own label is `MOVES`, `RouteScene` 1911) and it
      stacks the three bands this report is about (the grid's height and the pool's page size,
      369-373): the four slotted moves drawn by the shared `MoveGrid` (`hudMoveGrid.layout`,
      2411-2435), a search field and the learnset band (`refreshLearnset`, 2676-2734, the pool
      sliced to one page at 2696-2699) — and it is the **only** one of the three with an equip
      seam: a press on a band cell picks that move up (`startLearnDrag`, 3262-3271, reached at
      3223-3227), the release asks `detailMoveIndexAt` (3437-3441) and folds the drop through
      `equipMove` (3069-3083). The **battle's moves menu** (`Mode` includes `'moves'`,
      `BattleScene` 174; `openMoves`, 1232-1271; `renderMoveMenu`, 1967-2038) draws the same
      grid, but it is the per-turn **command** menu: a cell spends the turn, there is no drag,
      and the fighter it lists is a **restored snapshot** built in `init` (364-375) from the
      launch — not the run's member, which only comes back through `applyBattleResult`. The
      third home is the battle's SWITCH detail window, whose 2x2 move rows are read-only
      (`partyDetailMoves`, 678-698, filled at 1886-1901) and are `[Task-59]`'s to give an ⓘ.
      **The report means the route HUD's MOVES tab**, and the reason is in the code: "equipado"
      is a fact about the run's member — `RunPokemon.fighter.moves` — and the tab is the only
      place a move is ever equipped; the battle has no equip, no drag and no persistent member,
      so a delete there would have to travel back through `BattleReturn` to mean anything. The
      consequence for each is written down rather than implied: the battle's menu needs **no**
      change (it lists whatever slots remain, in slot order, and a member keeps at least one
      move — the rule below — so its grid is never empty), and the SWITCH window's rows keep
      their read-only shape.
      **What a delete must do to a member.** A member's equipped moves are exactly
      `fighter.moves` (`MoveSlot[]`, `src/engine/battle/fighter.ts` 144) capped at
      `MAX_MOVES = 4` (`src/engine/run/progression.ts` 40), and the learnset is **derived**, not
      stored: `learnsetPool` (`src/engine/run/learnset.ts` 66-86) is the level-up moves the
      species knows at its level minus the equipped ones, plus the moves a TM **in the bag** can
      teach — so a move that leaves the slots reappears in the band **by itself**, as a `Lv##`
      entry when it is a level-up move and as a `TM###` one while the machine is still in the
      bag (TMs are reusable, `docs/tech-decisions.md` 513-518), and `equipMove` (115-136) is the
      only way back in. A delete therefore needs **one** new pure rule — the inverse of
      `equipMove`, an `unequipMove(run, memberId, slot)` beside it that drops slot `slot`
      and returns the run **untouched** (same reference) when the member is unknown, the slot is
      out of range or the member holds a single move, re-saving the member through
      `updatePokemon` (`src/engine/run/state.ts` 343-352) otherwise — with its cases in
      `learnset.test.ts` beside the `equipMove` ones (60-90, the tail-append at 79-82). Nothing
      else about the member moves: no XP, no PP, no ability and no stats.
      **What forbids an empty moveset today, and why the last move stays.** The tree holds a
      member to at least one move in three places, and this task does not open that door:
      `parseFighter` **drops** a member whose `moves` parse to an empty list
      (`if (moves.length === 0) return null;`, `src/engine/save.ts` 442-449, consumed by
      `parseMembers` 506-514), so a saved zero-move member would silently vanish on the next
      load; the fight branch of `validateCommand` refuses every index once `fighter.moves.length`
      is 0 (`src/engine/battle/commands.ts` 103-105) and `legalMoveIndices` (32-47) returns
      `[]`, so no move can be submitted at all; and `openMoves` builds one menu item per move
      (`BattleScene` 1235), so the FIGHT menu would draw nothing (`menuOpen`,
      `this.menuItems.length > 0`, 1506). The engine's Struggle fallback (`selectedMove`, 52-66,
      pinned by `commands.test.ts` 39-44) covers only a moveset whose moves are all **spent**,
      not an absent one, and `editRunPokemon` refuses to build an empty set too
      (`progression.ts` 170). The reading this entry freezes is therefore that **the last
      remaining move cannot be deleted** — a one-move member is refused — so the invariant the
      save, the validator and the battle menu all already assume survives and
      `src/engine/save.ts` stays out of this task entirely; the alternative (allow it, and give
      the empty member Struggle everywhere) is the open question below, and it is the only
      reading that would put the save decoder and `commands.ts` here.
      **The gesture, and the freed slot.** The delete is the **inverse of the equip drag**, and
      the tree already has that shape for the other equipped thing: a held item is taken off by
      dragging its badge onto the bag (`pointerInBagPanel`, `RouteScene` 3089-3105, over
      `unequipHeldItem`, `src/engine/run/state.ts` 581-586). So a slot cell released over the
      **learnset band** deletes that move: `handleHudPointerMove` (2899-2943) stops reordering
      while the pointer is over the band, and `handleHudPointerUp` (3047-3115) folds the release
      through `unequipMove` where it today folds a band drag through `equipMove` (3069-3083).
      The freed slot is **empty**: the four containers `[Task-55]` draws (Batch 18) already
      answer for a slot with no move, and `[Task-56]` (Batch 19) makes a short moveset the
      ordinary case, so nothing is refilled for the player — a slot that emptied by itself would
      also make the delete a swap rather than a delete. The deleted move stays in the band and
      comes back for free (teaching is free, D36), which is what makes the delete reversible
      rather than destructive, and why it needs **no** confirmation prompt. The spec freezes the
      band's own hit test (a `pointerInLearnBand`-style sibling of `pointerInDetailPanel` and
      `pointerInBagPanel`, 3381-3390 / 3638-3645) and the exact signature of the new helper.
      **The two tasks that own the seam.** `[Task-56]` (Batch 19) owns **learned vs equipped**:
      it stops a level-up from writing the slots, so the band becomes the only equip path and
      the OHKO / No Guard guard moves there. This task owns the **inverse of that path** — the
      unequip — and must not touch `levelUpPokemon`, `learnsetPool` or the guard. It runs one
      batch after it because pre-`Task-56` a level-up that crossed a move would refill the slot
      the player had just emptied (`moves.push`, `progression.ts` 284-289), which would make the
      delete read as broken.
      **No `SAVE_VERSION` step:** a member's moves are **already persisted** — `encodeSave`
      writes the run verbatim (`src/engine/save.ts` 272-278) and `parseFighter` reads the slots
      back (442-449) — so a delete edits an existing field and adds no run field. The chain
      stays **14 → 15** (Task-13, shipped) → **15 → 16** (Task-31, Batch 7) → **16 → 17**
      (Task-44, Batch 13) → **17 → 18** (Task-52, Batch 17). The only reading that would move it
      is the "last move may go" one below, and even that is a decode-time tolerance rather than
      a schema step (the `[Task-33]` precedent), so it would still add **no** version.
      **Files:** `src/scenes/RouteScene.ts` (the slot press, the live reorder's band guard and
      the release), `src/engine/run/learnset.ts` + `learnset.test.ts` (the new pure inverse),
      and the two records of the panel's own operations — `docs/design-spec.md` §3 (71-78, the
      paragraph that says "A cell is dragged onto a slot to equip it") and
      `docs/tech-decisions.md` **D36** (520-530, whose "A pool cell is dragged onto a slot to
      equip it, replacing what sat there" gains the inverse). No `D##` is owed beyond that
      amendment: the rule is the equip rule's inverse and no new decision is taken.
      **Tests.** `src/engine/run/learnset.test.ts`: the deleted move leaves the slots, the slot
      is empty and the pool offers the move again (a level-up move as `Lv##`, a bag TM as
      `TM###`); a one-move member is refused and the run comes back by reference; an unknown
      member and an out-of-range slot are no-ops; and a delete-then-re-equip round-trip restores
      the moveset with fresh PP. No RNG is involved, so no fixed-seed re-pin. QA reproduces the
      report in `npm run dev`: a member with three moves, drag a slot onto the learnset band →
      the tab draws three moves and one empty container, the deleted move is in the band,
      dragging it back restores it, and the battle's FIGHT menu lists the remaining moves.
      Out of scope: the equip rule itself and the band's pool (`learnsetPool`, `equipMove`,
      `[Task-56]`'s level-up rule), the four containers (`[Task-55]`), the ⓘ classifier
      (`[Task-39]`), the SWITCH window's move rows and their ⓘ (`[Task-59]`), the battle's
      FIGHT menu and its Struggle fallback, the party reorder, the nickname field, the dev
      menu's `editRunPokemon`, and the deleted move's own PP, which `equipMove` rebuilds fresh
      when it returns.
      *Dependencies:* none — the member's slots, the derived pool, the equip helper and the
      badge-onto-bag unequip are all shipped, and the two questions below are calls, not edges.
      Batch order covers it: it wants `src/scenes/RouteScene.ts`, which **every** batch from 5 to
      27 holds (5 Task-16, 5b Task-45, 6 Task-41, 6b Task-38, 7 Task-31, 8 Task-08's every-scene
      sweep, 8b Task-35, 9 Task-39, 9b Task-40, 10 Task-26, 11 Task-29's ledger, 12 Task-30, 13
      Task-44, 14 Task-48, 15 Task-49, 16 Task-50, 17 Task-52, 18 Task-55, 19 Task-56, 20
      Task-58, 21 Task-61, 22 Task-62, 23 Task-63, 24 Task-64, 25 Task-65, 26 Task-66, 27
      Task-67), and `src/engine/run/learnset.ts` with its test (Task-56's in Batch 19) — so it
      opens the plan's new **Batch 28**, the first batch that leaves the route scene free at all.
      It is written **against** `[Task-56]`'s shipped state and `[Task-55]`'s four containers,
      nine and ten batches earlier, so the slot it frees is a drawn, empty container rather than
      a missing cell. *(Batch 28)*

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
fix is archived in `CHANGELOG.md`. `[PENDING FIXES]` below is a different list: what a
finished **task** still owes its Task QA — and a batch, its one Integration QA pass on
the combined tree.

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
`MapRoomSpecial`, `src/engine/maps/plan.ts` 70, placed by `planMap` 402-445, and the room-local
fixture's model is the shop counter, `RouteScene` 995 / `openShop` 5456-5470); a **gated reward
room** whose reward sits behind bushes, rocks or water that only a party move opens — Cut, Rock
Smash, Surf (`[Task-65]`; the tile vocabulary is `src/engine/map.ts` 5-14 and `WATER` already
ships and is already solid, 11/16, while a "party knows this move" test is
`member.fighter.moves.some(...)`, `fighter.ts` 144/419, with no accessor today); and a **trade
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

---

## [PENDING FIXES]

Written by QA. The format is fixed — one entry per task. Empty means nothing is red.

```markdown
- [ ] **[TASK-<ID>]:** <one-line description>
  - **Expected:** ...
  - **Actual / error log:** ...
  - **Affected path:** ...
```
