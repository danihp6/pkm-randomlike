// Packs every derived atlas, sheet and audio cue from the private asset store
// (the `pkrl-assets` repository, or a local `sprite-sources/` checkout).
//
//   node scripts/assets/pack.mjs [store]
//   npm run assets:pack              # ASSETS_ROOT, or ./sprite-sources
//
// The store is never linked into the checkout (AGENTS.md, "Asset trees"): the
// script passes absolute paths and ASSETS_ROOT, and the packers read from it.
// Outputs are gitignored; a clone without the store runs against the committed
// blanks in `src/assets/placeholders/`.
import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_STORE = fileURLToPath(new URL('../../sprite-sources/', import.meta.url))
const STORE = resolve(process.argv[2] ?? process.env.ASSETS_ROOT ?? DEFAULT_STORE)
const REPO = fileURLToPath(new URL('../../', import.meta.url))

if (!existsSync(STORE)) {
  console.error(`error: the asset store does not exist: ${STORE}`)
  console.error('       pass one as argv[2], set ASSETS_ROOT, or clone pkrl-assets into sprite-sources/')
  process.exit(1)
}

/** A source the step cannot run without; `optional` ones only warn. */
const requires = (paths, optional = false) => ({ paths, optional })

const STEPS = [
  {
    name: 'anil battle sprites',
    script: 'scripts/anil/build-pokemon-sprites.mjs',
    needs: requires(['anil/Graphics/Pokemon']),
    args: (p) => [p('anil/Graphics/Pokemon')],
  },
  {
    name: 'anil item icons',
    script: 'scripts/anil/build-item-icons.mjs',
    needs: requires(['anil/Graphics/Items']),
    args: (p) => [p('anil/Graphics/Items')],
  },
  {
    name: 'frlg tilesets',
    script: 'scripts/frlg/build-tilesets.mjs',
    needs: requires(['frlg/tileset-2.png', 'frlg/tall_grass.png']),
    args: (p) => [p('frlg/tileset-2.png'), p('frlg/tall_grass.png')],
  },
  {
    name: 'frlg trainer sprites',
    script: 'scripts/frlg/build-trainer-sprites.mjs',
    needs: requires(['frlg/trainers.png']),
    env: true,
  },
  {
    name: 'frlg overworld sprites',
    script: 'scripts/frlg/build-overworld-sprites.mjs',
    needs: requires(['frlg/overworld']),
    args: (p) => [p('frlg/overworld')],
  },
  {
    name: 'frlg player sprite',
    script: 'scripts/frlg/build-player-sprite.mjs',
    needs: requires(['frlg/overworld/red_normal.png']),
    args: (p) => [p('frlg/overworld/red_normal.png')],
  },
  {
    name: 'frlg battle ui',
    script: 'scripts/frlg/build-battle-ui.mjs',
    needs: requires(['frlg-ui/hpbars-menu.png']),
    env: true,
  },
  {
    name: 'frlg font',
    script: 'scripts/frlg/build-font.mjs',
    needs: requires(['frlg-ui/fonts/latin_normal.png', 'frlg-ui/fonts/charmap.txt']),
    env: true,
  },
  {
    name: 'frlg category icons',
    script: 'scripts/frlg/build-category-icons.mjs',
    needs: requires(['frlg-ui/category']),
    env: true,
  },
  {
    name: 'frlg field items',
    script: 'scripts/frlg/build-field-items.mjs',
    needs: requires(['frlg/tileset.png']),
    env: true,
  },
  {
    name: 'frlg type icons',
    script: 'scripts/frlg/build-type-icons.mjs',
    needs: requires(['anil/Graphics/UI/types.png']),
    args: (p) => [p('anil/Graphics/UI/types.png')],
  },
  {
    name: 'frlg status icons',
    script: 'scripts/frlg/build-status-icons.mjs',
    needs: requires(['anil/Graphics/UI/statuses.png']),
    args: (p) => [p('anil/Graphics/UI/statuses.png')],
  },
  {
    name: 'frlg item icons',
    script: 'scripts/frlg/build-item-icons.mjs',
    needs: requires(['frlg-ui/item-icons']),
    args: (p) => [p('frlg-ui/item-icons')],
  },
  {
    name: 'audio cue set',
    script: 'scripts/frlg/build-audio.mjs',
    needs: requires(['frlg-audio']),
    args: (p) => ['--rendered', p('frlg-audio')],
  },
  {
    name: 'overworld pokemon pairs',
    script: 'scripts/legacy-art/extract-real-sprites.mjs',
    needs: requires(['pokemons'], true),
    args: (p) => [`--source=${p('pokemons')}`],
  },
]

const path = (relative) => resolve(STORE, relative)
const missing = (step) => step.needs.paths.filter((relative) => !existsSync(path(relative)))
const failures = []

for (const [index, step] of STEPS.entries()) {
  const absent = missing(step)
  const progress = `[${index + 1}/${STEPS.length}] ${step.name}`
  if (absent.length > 0) {
    const detail = absent.join(', ')
    if (step.needs.optional) {
      console.warn(`${progress}: skipped (the store has no ${detail})`)
      continue
    }
    failures.push(`${step.name}: the store has no ${detail}`)
    console.error(`${progress}: FAILED (the store has no ${detail})`)
    continue
  }
  const env = step.env ? { ...process.env, ASSETS_ROOT: STORE } : { ...process.env }
  const args = step.args ? step.args(path) : []
  execFileSync(process.execPath, [resolve(REPO, step.script), ...args], {
    cwd: REPO,
    env,
    stdio: 'inherit',
  })
  console.log(`${progress}: done`)
}

if (failures.length > 0) {
  console.error(`\n${failures.length} step(s) could not run:`)
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}
console.log(`\npacked from ${STORE}`)
