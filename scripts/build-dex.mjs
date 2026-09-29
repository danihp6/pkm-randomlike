// Generates src/data/dex/*.json from @pkmn/dex. Run with `npm run data:dex`.
//
// The JSON is committed so the game never depends on the dex package at
// runtime. Functions are dropped by JSON.stringify, which is intentional: the
// data is metadata (stats, types, learnsets, descriptions) while behaviour
// (ability/item/move handlers) lives in src/engine/battle/effects.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Dex } from '@pkmn/dex';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(SCRIPT_DIR, '..', 'src', 'data', 'dex');
const CATCH_RATES_PATH = join(SCRIPT_DIR, 'data', 'catch-rates.json');
const MIN_LEARNSET_GEN = 8;

const isPlayable = (entry) => !entry.isNonstandard && entry.num > 0;

const writeJson = async (name, data) => {
  const path = join(OUT_DIR, name);
  await writeFile(path, `${JSON.stringify(data)}\n`);
  const kb = (JSON.stringify(data).length / 1024).toFixed(0);
  console.log(`${name.padEnd(16)} ${kb.padStart(7)} KB`);
};

const evolutionOf = (species) => {
  const evolutions = [];
  for (const name of species.evos ?? []) {
    const target = Dex.species.get(name);
    if (!target.exists) continue;
    evolutions.push({
      into: target.id,
      method: target.evoType ?? 'level',
      level: target.evoLevel ?? null,
      item: target.evoItem ?? null,
      move: target.evoMove ?? null,
      condition: target.evoCondition ?? null,
    });
  }
  return evolutions;
};

const learnsetOf = (learnset, moveIds) => {
  const moves = {};
  for (const [moveId, sources] of Object.entries(learnset.learnset ?? {})) {
    // A gen-8 source can name a move that no longer exists in gen 9, so the
    // learnset only keeps moves present in the generated moves.json.
    if (!moveIds.has(moveId)) continue;
    const kept = sources.filter((source) => source[1] !== 'S' && Number(source[0]) >= MIN_LEARNSET_GEN);
    if (kept.length > 0) moves[moveId] = kept;
  }
  return moves;
};

const main = async () => {
  await mkdir(OUT_DIR, { recursive: true });

  // @pkmn/dex has no catch rate; the committed table comes from PokeAPI's
  // `pokemon_species.csv` (see scripts/fetch-catch-rates.mjs), keyed by the
  // national dex number, defaulting to 255 for any id the table misses.
  const catchRates = JSON.parse(await readFile(CATCH_RATES_PATH, 'utf8'));
  const catchRateOf = (num) => catchRates[String(num)] ?? 255;

  const species = Dex.species.all().filter(isPlayable).map((entry) => ({
    ...entry,
    catchRate: catchRateOf(entry.num),
    evolutions: evolutionOf(entry),
  }));

  const moves = Dex.moves.all().filter((entry) => !entry.isNonstandard);
  const moveIds = new Set(moves.map((entry) => entry.id));
  const abilities = Dex.abilities.all().filter((entry) => !entry.isNonstandard);
  const items = Dex.items.all().filter((entry) => !entry.isNonstandard);
  const natures = Dex.natures.all();
  const types = Dex.types.all();

  const learnsets = {};
  for (const entry of species) {
    const learnset = await Dex.learnsets.get(entry.id);
    const moves_ = learnsetOf(learnset, moveIds);
    if (Object.keys(moves_).length > 0) learnsets[entry.id] = moves_;
  }

  await writeJson('species.json', species);
  await writeJson('moves.json', moves);
  await writeJson('abilities.json', abilities);
  await writeJson('items.json', items);
  await writeJson('learnsets.json', learnsets);
  await writeJson('natures.json', natures);
  await writeJson('types.json', types);
  await writeJson('meta.json', {
    source: '@pkmn/dex',
    generation: 9,
    minLearnsetGen: MIN_LEARNSET_GEN,
    catchRateSource: 'PokeAPI pokemon_species.csv',
    counts: {
      species: species.length,
      moves: moves.length,
      abilities: abilities.length,
      items: items.length,
      learnsets: Object.keys(learnsets).length,
      natures: natures.length,
      types: types.length,
    },
  });
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
