# `src/engine/region/interior/` — the building interior generator

A building's inside is one screen of `INTERIOR_SIZE` tiles (`src/data/region.ts`) — a
counter, a bench or a healing spot, with the door that leads back to the city — and a gym's
inside is a run of rooms of `GYM_SIZE` with the leader's chamber at the end. Nothing lives
here yet: the generator lands with its own task, and this README holds the folder until
then.
