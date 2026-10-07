// One-off: downloads canonical heights from PokeAPI and writes a compact table
// next to this script. The output is committed, so `npm run data:dex` never
// touches the network. Re-run only when the dex generation source changes.
//
//   node scripts/fetch-heights.mjs
//
// `pokemon.csv` carries one row per Pokémon *form*, in decimetres. A dex id
// matches a row by its normalised identifier (so `slowbogalar` finds
// `slowbro-galar`); anything else falls back to the species' default form by
// national dex number, so an unmapped forme inherits its base species' height.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE =
  'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon.csv';
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const OUT = join(SCRIPT_DIR, 'data', 'heights.json');
const SPECIES = join(SCRIPT_DIR, '..', 'src', 'data', 'dex', 'species.json');

const norm = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, '');

const response = await fetch(SOURCE);
if (!response.ok) throw new Error(`PokeAPI responded ${response.status}`);
const csv = await response.text();

const [, ...rows] = csv.trim().split('\n');
const byIdentifier = new Map();
const byDefault = new Map();
for (const row of rows) {
  const columns = row.split(',');
  const identifier = columns[1];
  const speciesNum = Number(columns[2]);
  const height = Number(columns[3]);
  const isDefault = columns[7] === '1';
  if (!Number.isFinite(height) || height <= 0) continue;
  if (!byIdentifier.has(norm(identifier))) byIdentifier.set(norm(identifier), height);
  if (isDefault && !byDefault.has(speciesNum)) byDefault.set(speciesNum, height);
}

const species = JSON.parse(await readFile(SPECIES, 'utf8'));
const heights = {};
let exact = 0;
let fallback = 0;
for (const entry of species) {
  const direct = byIdentifier.get(norm(entry.id));
  const height = direct ?? byDefault.get(entry.num);
  if (!Number.isFinite(height)) continue;
  if (direct !== undefined) exact++;
  else fallback++;
  // Decimetres to metres, one decimal as the games list it.
  heights[entry.id] = Math.round(height) / 10;
}

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, `${JSON.stringify(heights)}\n`);
console.log(
  `Wrote ${Object.keys(heights).length} heights to ${OUT} (${exact} exact, ${fallback} by base species)`,
);
