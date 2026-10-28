# `src/net/` — the browser's outbound calls

The one folder that talks to the network, kept apart from the scenes so every call is
headless, injectable and silent on failure. Nothing here imports Phaser, reads
`window`, draws, or reads a clock or an RNG: the caller supplies the month and the
device id, and the same arguments always build the same payload (`D11`, `D56`).

## Layout

- `ranking.ts` — the monthly ranking's client: the endpoint discovered from
  `ranking.json` (`RANKING_CONFIG_URL`), the payload builder and its two clamps
  (`buildRankingEntry`, `clampMapReached`, `clampPlaytimeMs`), the rotating anonymous
  device id under its own storage key (`rankingDeviceId`, `RANKING_DEVICE_KEY`), the
  submit (`submitRanking`) and the month's board (`fetchRanking`, `RANKING_TOP_N`).
  Every function takes its `fetch` as an argument and answers `null`/`false` instead of
  throwing.
- `ranking.test.ts` — the seven payload keys and the clamps, the minted and the stored
  device id, and both calls' happy paths plus every failure (a null endpoint, a bad
  month, a 500, a malformed body, an offline browser), headless.
- `README.md` — this map.

## Rules

1. **A failure is silence.** A finished run must never meet an error dialog: a missing
   endpoint, a blocked network or an unreadable answer all read as `null`/`false`, and
   no function here throws into a scene.
2. **The clamps are the contract.** `RANKING_MAX_MAP_REACHED` and
   `RANKING_MAX_PLAYTIME_MS` are the same two numbers `infra/lambda/ranking.mjs`
   re-applies as `MAX_MAP_REACHED` / `MAX_PLAYTIME_MS`; changing one side alone is a
   bug.
3. **The payload is a pure function.** No clock and no RNG: the month arrives as an
   argument (`recordMonthKey`) and the id as a value, so a test pins the bytes.
4. **The device id never enters the save.** It lives under `RANKING_DEVICE_KEY`, outside
   the save document, so it adds no `SAVE_VERSION` step and survives a new run.
