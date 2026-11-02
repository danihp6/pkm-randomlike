# `src/engine/region/city/` — the settlement generator

A settlement is a tile square of manzanas, plazas and buildings with a Centre, a gym and
a grass corner, sized off `CITY_TIERS` / `TOWN_SIZE` (`src/data/region.ts`) and laid out
off `nodeStreams(seed, key).layout`. The starting town is the same generator without a
Centre. Nothing lives here yet: `plan.ts` and its barrel land with their own task, and
this README holds the folder until then.
