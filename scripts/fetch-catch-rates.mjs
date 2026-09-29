// One-off: downloads canonical catch rates from PokeAPI and writes a compact
// table next to this script. The output is committed, so `npm run data:dex`
// never touches the network. Re-run only when the dex generation source changes.
//
//   node scripts/fetch-catch-rates.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE =
  'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species.csv';
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'data', 'catch-rates.json');

const response = await fetch(SOURCE);
if (!response.ok) throw new Error(`PokeAPI responded ${response.status}`);
const csv = await response.text();

const [, ...rows] = csv.trim().split('\n');
const rates = {};
for (const row of rows) {
  const columns = row.split(',');
  const num = Number(columns[0]);
  const catchRate = Number(columns[9]);
  if (Number.isFinite(num) && Number.isFinite(catchRate)) rates[num] = catchRate;
}

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, `${JSON.stringify(rates)}\n`);
console.log(`Wrote ${Object.keys(rates).length} catch rates to ${OUT}`);
