# `src/engine/region/` — the region's plan, its names and its streams

One run is one **region**: the starting town, the eight gym cities in badge order, one
long main route per stretch plus its optional laterals, the Victory Road, the League and
the endless tower. This folder holds the contract every later batch reads and nothing
that draws: the plan, the settlement names and the per-node streams. Pure by contract —
no Phaser, no DOM, no clock — and every random draw comes off the run seed (`D11`).

## Layout

- `index.ts` — the barrel: it re-exports `plan`, `names`, `streams`, `content`, `league` and
  `travel` only, so the generator folders can join without touching a shared file.
- `plan.ts` — the whole world out of the run seed: the spine, the laterals, and each node's
  key, kind, name, badge, cap, gym distance, position and edges (`planRegion`, `nodeKey`,
  `parseNodeKey`, `nodeOf`).
- `plan.test.ts` — the plan's invariants on eight seeds, the key round trip, the name
  stability and a fixed seed's plan digest.
- `names.ts` — the settlement names (`Adjective Noun`, unique per region) and a route's
  number.
- `names.test.ts` — the draw order, the uniqueness, the title case and the stability of the
  names.
- `streams.ts` — the region's own stream and a node's four (`layout`, `content`,
  `encounters`, `loot`), keyed by `nodeKey`.
- `streams.test.ts` — the stream keys, the replay and the fact no node's stream depends on
  another.
- `content.ts` — what a node holds: its NPCs, its special NPCs, its grass, its shops, its
  posted trainers (2-4 on every route kind, the Victory Road included) and a lateral's
  point of interest, all off the node's `content` stream (`planNodeContent`, `PoiKind`,
  `ShopKind`, `POI_KINDS`).
- `content.test.ts` — the tier counts, the lateral-only POI, the replay and a fixed seed's
  content digest.
- `encounters.ts` — a node's wild encounters: its band pool minus the run's exclusions, the
  level as the squad's own share clamped to the node's cap, and one step's roll at the shipped
  chance (`NODE_ENCOUNTER_CHANCE`, `nodeEncounterTable`, `nodeWildLevel`, `rollNodeEncounter`).
- `encounters.test.ts` — the table's exclusions and its node band, the 1 000-roll level band
  and its cap clamp, the replay and a fixed stream's pinned sequence.
- `npcs.ts` — the people a settlement stands: the generic rows its content pass rolled and the
  specials whose own draw passed, each on a free walkable tile off the node's own stream, with
  the card it opens and the once mark it leaves.
- `npcs.test.ts` — the placements of a pinned seed, the tier bands, the replay and the free
  tiles, and the once rule (the medic's heal and the chef's trade).
- `pois.ts` — the POI a lateral's terminus ends on and the zone rect a battle reads.
- `routeScreens.ts` — a route node as the screen that walks it: the node's one carve cut
  into its two-to-four vertical screens, each screen's spawn tile and border bands, and the
  content it holds (trainers, ground items, a lateral's POI), off the node's own streams
  (`planRouteScreens`, `screenIndexOf`, `bandAt`, `RouteScreenPlan`, `RouteNodePlan`).
- `routeScreens.test.ts` — a pinned seed's screen stack, its contiguous seams and crossable
  spawn columns, the band stack carried exactly once, the pinned three-screen geometry, the
  lateral's POI, the content invariants (off the lane and the bands, per screen), the replay
  across two seeds, the travel seam's own spawn and the two refusals.
- `preload.ts` — one node resolved to everything a scene draws and walks: the plan names it, its
  own generator carves it (a route, a lateral and the Victory Road), and it comes back as its
  tile map, its two frame meshes (the tiles' and the floor under them) and its spawn. It also
  holds the worker's request and reply and the resolver that answers one without throwing
  (`preloadNode`, `buildNodeMeshes`, `answerNodeRequest`, `NodeWorld`, `NodeMeshes`).
- `preload.test.ts` — a fixed seed's route mesh against the generator's own `buildFrameMesh`, the
  settlement's spawn and tileset, the nulls (unknown key, malformed key, no generator yet) and the
  worker reply's shape.
- `travel.ts` — the region's one travel seam: whether a run may walk an exit band (through the
  badge gate) or fly to a settlement it has visited (free, `D67`), and the next run state with its
  refreshed node-entry fields, its missions' `enter-node` reset and spawn tile — a settlement's own
  spawn or a route kind's carver entry (`canTravel`, `travel`, `TravelMode`, `TravelRefusal`,
  `TravelArrival`).
- `travel.test.ts` — the walk's own spawn per kind, the gate and its badge, walking back, the
  flight's Centre/laboratory door, the unvisited and non-settlement refusals, the visited-once
  order, the stretch reset an accepted travel opens, the untouched run a refusal leaves and the
  same answer twice.
- `missions.ts` — a node's mission stack: its stretch's automatic row, its city's fixed one and
  the random row an NPC of that city offers, each with the status the run's own persisted facts
  derive (`activeMissions`, `advanceMissions`, `MissionStatus`, `ActiveMission`, `MissionEvent`).
- `missions.test.ts` — the stack's order per node kind, the stretch failed/met rule, the city
  rows' completion, the random row's replay per seed and its other-seed difference, the
  `enter-node` reset and the no-op events.
- `league.ts` — the League's five fights as one rule: the next unbeaten row, the roster it
  fields off its own stream at `LEAGUE_LEVEL`, the heal between two of them that never
  revives, the mark a win leaves, the reward it folds and the fact the League is cleared
  only once the Champion has fallen (`leagueFoe`, `leagueNext`, `leagueProgress`,
  `leagueWin`, `leagueEnter`, `leagueReward`, `leagueIds`, `leagueTrainerId`, `LeagueFoe`).
- `league.test.ts` — the 1→5 walk and the prefix, the two-call replay and the per-row ids,
  the party size and levels, the seed's digest, the heal (and its no-op), the out-of-order
  refusal and the money the rows pay.
- `tower.ts` — the endless node behind the Champion: whether its door is open, the next
  fight at `LEAGUE_LEVEL` off its own rung stream, the streak a win steps, the heal
  between two fights and the fact a wipe is the only ending (`towerStep`, `towerWin`,
  `towerHeal`, `towerResolve`, `towerReward`, `towerOpen`, `TowerFoe`, `TowerResult`,
  `TOWER_NODE_KEY`).
- `tower.test.ts` — the door before and after the Champion, the five-at-60 leaderless
  roster and its replay, the pinned rung digest, the streak and the heal, the wipe that
  ends the run and the reward that pays no money.
- `route/` — the long route generator; its README holds the folder until its batch lands.
- `city/` — the settlement generator; its README holds the folder until its batch lands.
- `interior/` — the building-interior generator; its README holds the folder until its
  batch lands.
- `gym/` — the gym's puzzle stack and the rooms it fills; its README holds the folder.

## Rules

1. No Phaser import, no DOM and no `localStorage`; a rule that needs any of them belongs
   outside `src/engine/`.
2. Every draw comes from a stream split from the run seed, never `Math.random()`.
3. No node's stream depends on how many nodes precede it (`D60`): a node replays alone.
4. Sizes, caps, building counts and name lists live in `src/data/region.ts`; an engine file
   never hard-codes one.
5. Adding a module means adding its line here.
