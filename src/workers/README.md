# `src/workers/` — the off-thread half of a scene's node preload

One worker per file, reached **by URL only**: a scene starts it with
`new Worker(new URL('../workers/nodeWorker.ts', import.meta.url), { type: 'module' })`, so Vite
emits it as a chunk of its own instead of inlining it into the entry. A worker holds no state
and no game rule — it answers a message with a pure engine call, so the same function runs on
the main thread when the worker is unavailable.

## Layout

- `nodeWorker.ts` — the node worker: it answers every node request with the engine's
  `answerNodeRequest` and posts the reply back, which is how a node's map and its two frame
  meshes are built without blocking the frame.

## Rules

1. A worker imports only `src/engine/` — never Phaser, never `src/render/`, never
   `src/scenes/`, and never a `src/data/tilesets/index.ts` (its packed atlas URLs belong to the
   main bundle).
2. Its request and reply types are the engine's own (`src/engine/region/preload.ts`), so both
   sides of the postMessage agree by construction.
3. Nothing imports a worker by value: a value import makes Vite inline it and the worker stops
   being a separate chunk.
