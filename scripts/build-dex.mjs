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

// A `Future` forme whose own `forme` names a Mega is a Mega the dex leaves
// `isMega` unset on (`Mega-Z`, `M-Mega`, `F-Mega`, `Original-Mega`, and the
// Tatsugiri ones): the games reach it from a stone, never from the grass, so it
// belongs beside `megas.json` rather than inside the playable set. It is *not*
// taken into `megas.json` either: three of them would share a stone
// (`meowsticite`, `magearnite`, `tatsugirinite`) that the one-stone-per-forme
// guard rejects.
const isUnflaggedMegaForme = (entry) =>
  entry.isNonstandard === 'Future' && /mega/i.test(entry.forme ?? '');

const isPlayable = (entry) =>
  entry.num > 0 &&
  entry.isMega !== true &&
  !isUnflaggedMegaForme(entry) &&
  !isBattleBossForm(entry) &&
  entry.isNonstandard !== 'CAP' &&
  entry.isNonstandard !== 'Custom' &&
  entry.isNonstandard !== 'LGPE';

// Mega formes are battle-only, entered from a stone rather than spawned, so they
// are generated beside the playable set (`megas.json`) instead of inside it. A
// Mega is a Mega in any edition: the `Past` ones the games already ran, and the
// `Future` ones Legends Z-A and Champions announced (the dex's own "announced,
// not released" tag). Everything else about a Mega is unchanged.
//
// The tag alone is not enough: the nine `Future` formes the dex leaves `isMega`
// unset on (`forme: 'Mega-Z'` for Absol/Garchomp/Lucario Z, `'M-Mega'`/`'F-Mega'`
// for Meowstic, `'Original-Mega'` for Magearna-Original, the three Tatsugiri)
// name the forme instead, so `isPlayable` drops them by name-shape and they ship
// in neither file — three of them share a stone, which `megas.json` refuses.
// `src/data/dex/README.md` records the tag.
const isMega = (entry) =>
  (entry.isNonstandard === 'Past' || entry.isNonstandard === 'Future') && entry.isMega === true;

// Rayquaza is the one Mega without a stone (it needs Dragon Ascent); the run's
// stone mechanic still needs one, so derive a name from the base species.
const megaStoneName = (entry, base) =>
  entry.requiredItem ?? `${base.name.replace(/[aeiou]$/i, '')}ite`;

// A Mega never changes HP: the battle keeps the holder's HP (`mega.ts` rewrites
// the stats but restores `hp`), so a row whose HP disagrees with its base
// species is wrong on the data side. `bst` is the dex's own sum of `baseStats`,
// so it is repaired by the same delta. The two `Future` rows the dex ships
// unreconciled (Mega Floette 74 vs 54, Mega Zygarde 216 vs 108) are normalised
// here; a `Past` row disagreeing would be a dex regression and stops the build.
const withBaseHp = (entry, base) => {
  const hp = base.baseStats.hp;
  if (entry.baseStats.hp === hp) return entry;
  if (entry.isNonstandard !== 'Future') {
    throw new Error(`Mega ${entry.id} changes HP: ${entry.baseStats.hp} vs ${base.id} ${hp}`);
  }
  return {
    ...entry,
    baseStats: { ...entry.baseStats, hp },
    bst: entry.bst - (entry.baseStats.hp - hp),
  };
};

/** The values appearing more than once, in first-seen order. */
const duplicates = (values) => {
  const seen = new Set();
  const repeated = new Set();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
};

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
  // and its stone. A Mega whose base the run cannot own has no holder, so it is
  // skipped rather than shipped as a dead stone. The run only ever reaches a
  // Mega through `src/engine/battle/mega.ts`.
  const playableIds = new Set(species.map((entry) => entry.id));
  let normalisedHp = 0;
  const megaFormes = Dex.species
    .all()
    .filter(isMega)
    .filter((entry) => playableIds.has(Dex.species.get(entry.baseSpecies).id))
    .map((entry) => {
      const base = Dex.species.get(entry.baseSpecies);
      const row = withBaseHp(entry, base);
      if (row !== entry) normalisedHp++;
      const stoneName = megaStoneName(row, base);
      return {
        ...row,
        baseSpeciesId: base.id,
        stoneId: normalizeId(stoneName),
        stoneName,
        catchRate: catchRateOf(row.num),
        heightm: heights[row.id] ?? heights[base.id] ?? 1,
        evolutions: [],
      };
    });

  // A duplicate id or stone would silently drop a forme (both are map keys), so
  // the generator refuses to write a dex that has one.
  const duplicateIds = duplicates(megaFormes.map((entry) => entry.id));
  if (duplicateIds.length > 0) {
    throw new Error(`two Mega formes share an id: ${duplicateIds.join(', ')}`);
  }
  const duplicateStones = duplicates(megaFormes.map((entry) => entry.stoneId));
  if (duplicateStones.length > 0) {
    throw new Error(`two Mega formes share a Mega Stone: ${duplicateStones.join(', ')}`);
  }
  const pastMegas = megaFormes.filter((entry) => entry.isNonstandard === 'Past').length;
  const futureMegas = megaFormes.filter((entry) => entry.isNonstandard === 'Future').length;

  // The whole move set (`D42`): every real move, the `Past` ones included, so a
  // Dexit species keeps its learnset (King's Shield, Aromatherapy...). Dynamax
  // (Max) and Z moves are dropped — the engine models neither — as are the CAP,
  // Future and Unobtainable entries. `secondaries` is the resolved array
  // (@pkmn/dex derives it from `secondary`), so the raw `secondary` field is
  // dropped: keeping both made the engine apply single secondaries twice.
  //
  // Hidden Power's 17 typings all share the id `hiddenpower`; the engine keys
  // moves by id and derives the type from the holder's IVs at battle time, so
  // only the first (Normal) entry survives and the rest are skipped.
  const moves = [];
  const seenMoveIds = new Set();
  for (const entry of Dex.moves.all()) {
    if (entry.isMax || entry.isZ) continue;
    if (['CAP', 'Gigantamax', 'Future', 'Unobtainable'].includes(entry.isNonstandard)) continue;
    if (seenMoveIds.has(entry.id)) continue;
    seenMoveIds.add(entry.id);
    const out = { ...entry };
    delete out.secondary;
    moves.push(out);
  }
  const moveIds = new Set(moves.map((entry) => entry.id));

  // Zen Mode has one dex entry but two formes (Darmanitan and its Galar forme),
  // and the generalised form abilities need one ability per forme (`D41`), so a
  // synthetic "Zen Mode (Galar)" rides beside the generated set.
  const extraAbilities = [
    {
      exists: true,
      id: 'zenmodegalar',
      name: 'Zen Mode (Galar)',
      shortDesc: 'Changes to Galar Zen Form at 1/2 HP or less.',
      desc: 'Changes to Galar Zen Form at 1/2 HP or less, and back when above it.',
      flags: {},
    },
  ];
  const abilities = [
    ...Dex.abilities.all().filter((entry) => !entry.isNonstandard),
    ...extraAbilities,
  ];
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

  // The Mega summary: `megas.json` is battle-only (`D34`), so how many formes it
  // carries and which dex tag they came in under is the line to read.
  console.log(
    `megas            ${String(megaFormes.length).padStart(4)} (${pastMegas} Past, ` +
      `${futureMegas} Future, ${normalisedHp} HP normalised)`,
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
