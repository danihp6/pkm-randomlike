# `src/audio/` — the sound contract

## The cue table is the vocabulary

`src/audio/cues.ts` is the whole list of sounds the game can play: the three music
beds and three one-shot cues it always had, plus a shared `hit` and one cue per
move sound and per cry the decompilation carries — **525 rows**, one per
committed `src/assets/audio/<cue-id>.wav`. Each row is an id, its kind, whether it
loops and its `gain` — the per-cue share of the master volume (D22), which is the
one knob a balance pass turns.

A **cue id is the only name a scene may use**. No scene names a file, a texture
or sound key, a volume, or a source path; it calls `playMusic(this, 'route-music')`
or `playCue(this, 'faint')` and nothing else. Renaming an asset, re-encoding it or
swapping the whole set for CC0 audio never touches a call site.

| family      | ids                                                                         | rows | gain                              |
| ----------- | --------------------------------------------------------------------------- | ---- | --------------------------------- |
| hand rows   | `menu-music`, `route-music`, `battle-music`, `faint`, `level-up`, `victory` | 6    | 0.5 / 0.5 / 0.5 / 0.8 / 0.8 / 0.9 |
| shared hit  | `hit`                                                                       | 1    | 0.85                              |
| move sounds | `move-<se>`, from `se_m_*.mid`                                              | 130  | 0.85                              |
| cries       | `cry-<file>`, from `cries/<file>.wav`                                       | 388  | 0.8                               |

The table's **order is the shipped order**: the six hand rows, then `hit`, then
the move cues and the cry cues in id order. The rows come from the packed asset
folder in one `import.meta.glob`: a cue whose file was never packed cannot be
played, and `audioCue(id)` throws `unknown audio cue: <id>` for a typo. The
folder is gitignored (`npm run assets:pack`), so a clone without the private
store simply has no cues.

## The Phaser half

`src/audio/audio.ts` is the only file that touches `Phaser.Sound`:

- `preloadAudio(scene)` loads every cue once, from `BootScene.preload()`. Phaser's
  audio key **is the cue id**.
- `playCue(scene, id)` plays a one-shot; a music id is ignored.
- `playCry(scene, speciesId)` plays the appearing species' cry, through
  `src/data/audio/cries.json`; a species the decompilation carries no sample for
  stays **silent** (a stand-in would be a lie about an id the rip never had) and
  the call answers false.
- `playMoveSound(scene, moveId)` plays the move's own sound
  (`src/data/audio/moveSounds.json`), or the shared `hit` when the move has none.
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
PCM WAV, mono, at its source's own rate — 22050 Hz for the rendered music, move
and hand cues, and the decompilation's own 10512 Hz for the cries. They are
**imported game rips** (local development only, like the rest of the imported art
— see `src/assets/README.md` and `docs/art-direction.md`) and are built in two
steps:

```sh
node scripts/frlg/render-frlg-audio.mjs --source <decomp> --out <rip dir> --renderer <poryaaaa>
node scripts/frlg/build-audio.mjs --rendered <rip dir>
```

`render-frlg-audio.mjs` rips the raw cue under the gitignored
`sprite-sources/frlg-audio/<cue-id>.wav` and writes the two generated tables of
`src/data/audio/`. `pret/pokefirered` ships its soundtrack as MIDI plus the
instrument bank (`sound/voice_groups.inc`) and the DirectSound samples, never as
audio, so the renderer is `huderlem/poryaaaa` — an m4a engine emulator that loads
those files and mixes the song the way the GBA would; a move sound takes its
voicegroup and master volume from the decomp's own `midi.cfg`. The Pokémon cries
need no renderer: they are already per-species samples, copied in as they are. A
looping bed is then cut down to its loop body, so the file Phaser loops is the
song's own loop rather than a run back into a one-time intro.

`build-audio.mjs` packs them: the rip directory's file list **is** the cue set. It
downmixes to mono, keeps the source's sample rate and trims to the cue's cap
(120 s for a `-music` bed, 8 s for `level-up`, 20 s for `victory`, 6 s for the
rest), then applies **one gain per ripped family** — the 131 move cues together,
the 388 cries together — so each family's loudest cue sits at 0.85 of full scale.
The six hand rows keep the gain the render step already applied over their own six
files, so their bytes never move. A source that exists but is not a readable PCM
WAV is a hard error, never a silent placeholder; a hand row with no rendered
source at all falls back to a generated fading sine with a warning, while a
missing cue of a ripped family is a hard error — the whole point of the rip is
that the file is real. There is no `package.json` script: both steps are run with
`node`, like their siblings in `scripts/frlg/`, and both take their source tree as
an absolute `--source`/`--out`/`--rendered` path (the Asset trees rule).

A CC0 replacement set means dropping the renamed files in and re-running the
packer, not editing a scene — the renderer is only how the FRLG rip gets there
today.
