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
const HEIGHTS_PATH = join(SCRIPT_DIR, 'data', 'heights.json');
const MIN_LEARNSET_GEN = 8;

// The game ships the **full National Dex** (`D40`): every real species with a
// number, including the `Past` ones the modern games dropped (Dexit). Only
// non-species are left out: CAP/fan entries, `Custom` (MissingNo, Pokéstar),
// LGPE's partner starters (no art), and the battle-only Gigantamax/Eternamax
// boss formes.
const isBattleBossForm = (entry) =>
  entry.forme === 'Gmax' || entry.forme === 'Eternamax' || /Gmax$/i.test(entry.name);
const isPlayable = (entry) =>
  entry.num > 0 &&
  entry.isMega !== true &&
  !isBattleBossForm(entry) &&
  entry.isNonstandard !== 'CAP' &&
  entry.isNonstandard !== 'Custom' &&
  entry.isNonstandard !== 'LGPE';

// Mega formes are battle-only, entered from a stone rather than spawned, so they
// are generated beside the playable set (`megas.json`) instead of inside it.
// `isMega` catches every Mega (the X/Y formes included); one whose base is a
// played species gets a stone.
const isMega = (entry) => entry.isNonstandard === 'Past' && entry.isMega === true;

// Rayquaza is the one Mega without a stone (it needs Dragon Ascent); the run's
// stone mechanic still needs one, so derive a name from the base species.
const megaStoneName = (entry, base) =>
  entry.requiredItem ?? `${base.name.replace(/[aeiou]$/i, '')}ite`;

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

// A Dexit species may have no gen-8 source at all (its newest learnset is
// older), so the floor drops to 0 for that species: it keeps its own newest
// learnset instead of shipping with no moves.
const hasModernSource = (learnset) =>
  Object.values(learnset.learnset ?? {}).some((sources) =>
    sources.some((source) => source[1] !== 'S' && Number(source[0]) >= MIN_LEARNSET_GEN),
  );

const learnsetOf = (learnset, moveIds) => {
  const floor = hasModernSource(learnset) ? MIN_LEARNSET_GEN : 0;
  const moves = {};
  for (const [moveId, sources] of Object.entries(learnset.learnset ?? {})) {
    // A source can name a move that no longer exists in gen 9, so the learnset
    // only keeps moves present in the generated moves.json.
    if (!moveIds.has(moveId)) continue;
    const kept = sources.filter((source) => source[1] !== 'S' && Number(source[0]) >= floor);
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

  // Canonical heights (metres), from PokeAPI's `pokemon.csv`; the battle scene
  // sizes a sprite from this so big Pokémon read big (see `src/data/spriteSize.ts`).
  const heights = JSON.parse(await readFile(HEIGHTS_PATH, 'utf8'));

  const species = Dex.species.all().filter(isPlayable).map((entry) => ({
    ...entry,
    catchRate: catchRateOf(entry.num),
    heightm: heights[entry.id] ?? 1,
    evolutions: evolutionOf(entry),
  }));

  const normalizeId = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Every Mega whose base species is in the playable set, each tied to its base
  // and its stone. A Mega whose base is not in Gen 9 has no holder in the run,
  // so it is skipped rather than shipped as a dead stone. The run only ever
  // reaches a Mega through `src/engine/battle/mega.ts`.
  const playableIds = new Set(species.map((entry) => entry.id));
  const megaFormes = Dex.species
    .all()
    .filter(isMega)
    .filter((entry) => playableIds.has(Dex.species.get(entry.baseSpecies).id))
    .map((entry) => {
      const base = Dex.species.get(entry.baseSpecies);
      const stoneName = megaStoneName(entry, base);
      return {
        ...entry,
        baseSpeciesId: base.id,
        stoneId: normalizeId(stoneName),
        stoneName,
        catchRate: catchRateOf(entry.num),
        heightm: heights[entry.id] ?? heights[base.id] ?? 1,
        evolutions: [],
      };
    });

  // `secondaries` is the resolved array (@pkmn/dex derives it from `secondary`),
  // so the raw `secondary` field is dropped: keeping both made the engine apply
  // single secondaries twice.
  const moves = Dex.moves
    .all()
    .filter((entry) => !entry.isNonstandard)
    .map((entry) => {
      const out = { ...entry };
      delete out.secondary;
      return out;
    });
  const moveIds = new Set(moves.map((entry) => entry.id));
  const abilities = Dex.abilities.all().filter((entry) => !entry.isNonstandard);
  const items = Dex.items.all().filter((entry) => !entry.isNonstandard);
  const natures = Dex.natures.all();
  const types = Dex.types.all();

  const learnsets = {};
  for (const entry of species) {
    // A forme has no learnset of its own in @pkmn/dex; it inherits the base
    // species' learnset.
    let learnset = await Dex.learnsets.get(entry.id);
    if (!learnset.learnset && entry.baseSpecies) {
      const base = Dex.species.get(entry.baseSpecies);
      if (base.exists && base.id !== entry.id) learnset = await Dex.learnsets.get(base.id);
    }
    const moves_ = learnsetOf(learnset, moveIds);
    if (Object.keys(moves_).length > 0) learnsets[entry.id] = moves_;
  }

  await writeJson('species.json', species);
  await writeJson('megas.json', megaFormes);
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
      megas: megaFormes.length,
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
