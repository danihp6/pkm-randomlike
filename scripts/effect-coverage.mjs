// Regenerates docs/balance/effect-coverage.md (D16). The `port` set is derived
// from the source of truth — the registered abilities and the run item
// catalogue — so a new port only needs the code change, then `npm run
// docs:coverage`. The exclusions are the one hand-curated part.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const text = (path) => readFileSync(join(root, path), 'utf8');
const norm = (id) => id.toLowerCase().replace(/[^a-z0-9]/g, '');

const abilities = read('src/data/dex/abilities.json');
const items = read('src/data/dex/items.json');
const abilitySources = [
  'src/engine/battle/effects/abilities.ts',
  'src/engine/battle/effects/weather.ts',
  'src/engine/battle/effects/terrain.ts',
];
const itemsSrc = text('src/data/items.ts');

const portedAbilities = new Set(
  abilitySources.flatMap((path) =>
    [...text(path).matchAll(/^  \['([a-z0-9]+)',/gm)].map((match) => match[1]),
  ),
);

const catalogue = new Map();
for (const match of itemsSrc.matchAll(/item\(\{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)'/g)) {
  catalogue.set(norm(match[1]), match[2]);
}

// Abilities no playable species can ever have, so a run can never meet them.
const UNREACHABLE = new Set(
  'aerilate aurabreak ballfetch beastboost colorchange cottondown darkaura defeatist deltastream desolateland emergencyexit fairyaura flowergift forecast gorillatactics innardsout ironbarbs mimicry mummy neuroforce normalize parentalbond pastelveil perishbody powerconstruct primordialsea refrigerate rkssystem schooling screencleaner stancechange steelworker victorystar wanderingspirit wimpout wonderguard zenmode'.split(
    ' ',
  ),
);

const EXCLUDED_ABILITIES = new Map();
for (const id of UNREACHABLE) EXCLUDED_ABILITIES.set(id, 'no playable species has it');
for (const id of [
  'battery', 'costar', 'friendguard', 'healer', 'hospitality', 'minus', 'plus',
  'powerofalchemy', 'powerspot', 'receiver', 'symbiosis', 'telepathy', 'commander',
  'flowerveil',
]) {
  EXCLUDED_ABILITIES.set(id, 'doubles/ally only');
}
for (const id of [
  'terashell', 'terashift', 'teraformzero', 'embodyaspectteal',
  'embodyaspectcornerstone', 'embodyaspecthearthflame', 'embodyaspectwellspring',
]) {
  EXCLUDED_ABILITIES.set(id, 'Terastal mechanic (cut)');
}
for (const id of ['asoneglastrier', 'asonespectrier']) {
  EXCLUDED_ABILITIES.set(id, 'fused forme (cut)');
}

const abilityRows = [...abilities]
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((ability) => {
    if (portedAbilities.has(ability.id)) return [ability.name, 'port', 'ported in `effects/abilities.ts`'];
    if (EXCLUDED_ABILITIES.has(ability.id)) return [ability.name, 'excluded', EXCLUDED_ABILITIES.get(ability.id)];
    return [ability.name, 'no-op', 'reachable, not ported yet'];
  });

const itemNames = new Map(items.map((item) => [norm(item.id), item.name]));
for (const [id, name] of catalogue) if (!itemNames.has(id)) itemNames.set(id, name);

const itemRows = [...itemNames.entries()]
  .sort((a, b) => a[1].localeCompare(b[1]))
  .map(([id, name]) =>
    catalogue.has(id)
      ? [name, 'port', 'in the run catalogue (`src/data/items.ts`)']
      : [name, 'excluded', 'not in the run catalogue'],
  );

const count = (rows, status) => rows.filter((row) => row[1] === status).length;

const table = (rows) =>
  ['| Effect | Status | Note |', '| --- | --- | --- |', ...rows.map((row) => `| ${row[0]} | \`${row[1]}\` | ${row[2]} |`)].join('\n');

const doc = `# Effect coverage

Tracks every battle ability and item so "Gen 9 complete" is a claim this table
backs up (\`D16\` in \`docs/tech-decisions.md\`). Notes only: nothing here is read
by the game. Regenerate with \`npm run docs:coverage\`.

## Legend

- \`port\` — behaviour implemented. Abilities live in
  \`src/engine/battle/effects/abilities.ts\`; battle items in the Bag
  (\`commands.ts\`) and held items in \`effects/items.ts\`.
- \`no-op\` — an effect a run can actually meet but that is not implemented yet.
  A develop build (the \`src/dev\` gate) warns once per effect when a battle
  meets one, so a gap cannot hide during playtests.
- \`excluded\` — deliberately out of scope: no playable species has it, it only
  works with allies, or it needs a cut mechanic (Mega/Z/Dynamax/Terastal/forme
  change). Excluded effects are never a coverage gap.

The run only ever hands out the items in \`src/data/items.ts\`, so a dex item that
is not in that catalogue is \`excluded\` by definition: adding it later is a
catalogue row, not engine code.

## Abilities — ${abilityRows.length} total (${count(abilityRows, 'port')} port, ${count(abilityRows, 'no-op')} no-op, ${count(abilityRows, 'excluded')} excluded)

${table(abilityRows)}

## Items — ${itemRows.length} total (${count(itemRows, 'port')} port, ${count(itemRows, 'no-op')} no-op, ${count(itemRows, 'excluded')} excluded)

${table(itemRows)}
`;

writeFileSync(join(root, 'docs/balance/effect-coverage.md'), doc);
console.log(
  `coverage: ${abilityRows.length} abilities, ${itemRows.length} items ` +
    `(${count(abilityRows, 'port') + count(itemRows, 'port')} port)`,
);
