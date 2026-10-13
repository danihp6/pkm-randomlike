# `src/audio/` — the sound contract

## The cue table is the vocabulary

`src/audio/cues.ts` is the whole list of sounds the game can play: three music
beds and three one-shot cues. Each row is an id, its kind, whether it loops and
its `gain` — the per-cue share of the master volume (D22), which is the one knob
a balance pass turns.

A **cue id is the only name a scene may use**. No scene names a file, a texture
or sound key, a volume, or a source path; it calls `playMusic(this, 'route-music')`
or `playCue(this, 'faint')` and nothing else. Renaming an asset, re-encoding it or
swapping the whole set for CC0 audio never touches a call site.

| id             | kind  | loop  | gain |
| -------------- | ----- | ----- | ---- |
| `menu-music`   | music | true  | 0.5  |
| `route-music`  | music | true  | 0.5  |
| `battle-music` | music | true  | 0.5  |
| `faint`        | sfx   | false | 0.8  |
| `level-up`     | sfx   | false | 0.8  |
| `victory`      | sfx   | false | 0.9  |

**A hit and an encounter are not cues.** The original varies both: a hit plays
the move's own sound (`SE_M_*`, one per move) and an encounter is the appearing
Pokémon's cry, so one shared cue could only approximate either. Both are on the
backlog; until then the battle plays no hit sound and the route plays no
encounter sound.

## The Phaser half

`src/audio/audio.ts` is the only file that touches `Phaser.Sound`:

- `preloadAudio(scene)` loads every cue once, from `BootScene.preload()`. Phaser's
  audio key **is the cue id**.
- `playCue(scene, id)` plays a one-shot; a music id is ignored.
- `playMusic(scene, id)` owns the **single music channel** — one bed at a time.
  It is game-wide (`Scene.sound` is the game's manager), so a scene on top takes
  the bed over and the scene underneath takes it back when it resumes. `stopMusic()`
  is the way out.
- `syncAudioVolume(scene)` re-applies `Settings.volume` through `src/settings.ts`;
  the master volume stays the only audio knob (D22).
- `setMuted` / `isMuted` are the seam a settings row and the accessibility pass
  plug into.

A cue the browser's autoplay gate blocks is skipped silently, never a crash and
never a console error; the next `playMusic` re-arms it.

## The assets

`src/assets/audio/<cue-id>.wav` is one committed file per cue, shipped as 16-bit
PCM WAV, mono. They are **imported game rips** (local development only, like the
rest of the imported art — see `src/assets/README.md` and `docs/art-direction.md`)
and are built in two steps:

```sh
node scripts/frlg/render-frlg-audio.mjs
node scripts/frlg/build-audio.mjs
```

`render-frlg-audio.mjs` produces the raw cue under the gitignored
`sprite-sources/frlg-audio/<cue-id>.wav`. `pret/pokefirered` ships its soundtrack
as MIDI plus the instrument bank (`sound/voice_groups.inc`) and the DirectSound
samples, never as audio, so the renderer is `huderlem/poryaaaa` — an m4a engine
emulator that loads those files and mixes the song the way the GBA would. Both
the decomp (sparse checkout, `sound/` only) and the renderer are fetched into
`sprite-sources/` on the first run; a looping bed is then cut down to its loop
body, so the file Phaser loops is the song's own loop rather than a run back into
a one-time intro. Each row of the cue table names the FRLG song it renders; the
mapping is in that script's `CUES`.

`build-audio.mjs` packs the rendered file: it downmixes to mono, keeps the
source's sample rate and trims to the cue's cap (high enough for a bed to hold a
whole loop, and for a one-shot per cue so a fanfare is never cut mid-phrase). A
source that exists but is not a readable PCM WAV is a hard error, never a silent
placeholder; a cue with no rendered source at all falls back to a generated
fading sine with a warning. There is no `package.json` script: both steps are run
with `node`, like their siblings in `scripts/frlg/`.

A CC0 replacement set means dropping the renamed files in and re-running the
packer, not editing a scene — the renderer is only how the FRLG rip gets there
today.
