// Regenerates docs/balance/effect-coverage.md and src/data/moveCoverage.json
// (D16). The `port` sets are derived from the source of truth — the registered
// effect sources, the turn loop and the data fields the engine reads — so a new
// port only needs the code change, then `npm run docs:coverage`. The exclusions
// are the one curated part; the move ones are seeded from the dex, exactly as
// the ability table derives "no playable species has it".
//
// The move classification is written twice from this single authority: the doc
// keeps its "notes only" promise, the JSON is what the develop build reads.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const text = (path) => readFileSync(join(root, path), 'utf8');
const norm = (id) => id.toLowerCase().replace(/[^a-z0-9]/g, '');

const abilities = read('src/data/dex/abilities.json');
const items = read('src/data/dex/items.json');
const moves = read('src/data/dex/moves.json');
const learnsets = read('src/data/dex/learnsets.json');
const abilitySources = [
  'src/engine/battle/effects/abilities.ts',
  'src/engine/battle/effects/weather.ts',
  'src/engine/battle/effects/terrain.ts',
];
const itemsSrc = text('src/data/items.ts');

// A registry row reads either `['id', handler],` on one line or — the shape the
// ledger reformat left five rows in — as a multi-line entry whose id sits alone
// on the next line, so both shapes count as ported.
const registeredIds = (source) => [
  ...[...source.matchAll(/^  \['([a-z0-9]+)',/gm)].map((match) => match[1]),
  ...[...source.matchAll(/^  \[\n    '([a-z0-9]+)',$/gm)].map((match) => match[1]),
];

const portedAbilities = new Set(abilitySources.flatMap((path) => registeredIds(text(path))));

// The run's own catalogue, read as text. A name carrying an apostrophe is written
// with double quotes (`King's Rock`), so both quote styles count — otherwise the
// row reads "not in the run catalogue" while it is one.
const catalogue = new Map();
for (const match of itemsSrc.matchAll(/item\(\{\s*id:\s*'([^']+)',\s*name:\s*['"]([^'"]+)['"]/g)) {
  catalogue.set(norm(match[1]), match[2]);
}

// Abilities no species in the shipped dex can have, so a run can never meet
// them. Derived from the dex (now the full National Dex, `D40`) rather than a
// hand-kept list, so a new dex entry never leaves a stale reason behind.
const holders = new Set();
for (const species of read('src/data/dex/species.json')) {
  for (const name of Object.values(species.abilities)) holders.add(norm(name));
}

const EXCLUDED_ABILITIES = new Map();
for (const ability of abilities) {
  if (!holders.has(norm(ability.name))) EXCLUDED_ABILITIES.set(ability.id, 'no playable species has it');
}
for (const id of [
  'battery', 'costar', 'friendguard', 'healer', 'hospitality', 'minus', 'plus',
  'powerofalchemy', 'powerspot', 'receiver', 'symbiosis', 'telepathy', 'commander',
  'flowerveil', 'curiousmedicine', 'propellertail', 'stalwart',
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
for (const id of ['gulpmissile', 'multitype', 'powerconstruct', 'rkssystem']) {
  EXCLUDED_ABILITIES.set(id, 'forme change (cut)');
}
for (const id of ['honeygather', 'pickup']) {
  EXCLUDED_ABILITIES.set(id, 'out of battle only');
}
for (const id of ['heavymetal', 'lightmetal']) {
  EXCLUDED_ABILITIES.set(id, 'weight is not modelled');
}
EXCLUDED_ABILITIES.set('suctioncups', 'no forced-switch mechanic');
EXCLUDED_ABILITIES.set('toxicdebris', 'entry hazards are not modelled');
// Ball Fetch only fires between battles (it retrieves a thrown Ball), so a
// single battle can never honour it.
EXCLUDED_ABILITIES.set('ballfetch', 'out of battle only');

// Deleted from the engine because the mechanic became **data** (`D38`): the forme
// each of these used to reach is now a hand-authored evolution branch, a variant
// family drawn at generation or a hand-authored Mega. A future deletion records
// itself here; the classification below reads this list after `portedAbilities`,
// so a registry row that lingered would still read `port` rather than hide.
const REMOVED_ABILITIES = new Set([
  'battlebond',
  'disguise',
  'flowergift',
  'forecast',
  'hungerswitch',
  'schooling',
  'shieldsdown',
  'stancechange',
  'terashift',
  'zerotohero',
  'zenmode',
  'zenmodegalar',
]);

const abilityRows = [...abilities]
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((ability) => {
    if (portedAbilities.has(ability.id)) return [ability.name, 'port', 'ported in `effects/abilities.ts`'];
    if (REMOVED_ABILITIES.has(ability.id)) {
      return [ability.name, 'removed', 'forme-changing ability removed (D38)'];
    }
    if (EXCLUDED_ABILITIES.has(ability.id)) return [ability.name, 'excluded', EXCLUDED_ABILITIES.get(ability.id)];
    return [ability.name, 'no-op', 'reachable, not ported yet'];
  });

// --- Moves -------------------------------------------------------------------
// Port: the move is a registered effect. The registration sites are
// `src/engine/battle/effects/moves.ts` (the `PROTECT_MOVES` and
// `VARIABLE_TYPE_MOVES` tables plus the single `defs.push({ id: ... })`
// entries) and `src/engine/battle/effects/items.ts` (the Plates' Judgment).
const movesEffectSrc = text('src/engine/battle/effects/moves.ts');
const itemsEffectSrc = text('src/engine/battle/effects/items.ts');

const tableKeys = (source, name) => {
  const start = source.indexOf(`const ${name}`);
  if (start < 0) return [];
  const end = source.indexOf('\n};', start);
  return [...source.slice(start, end).matchAll(/^ {2}([a-z0-9]+):/gm)].map((match) => match[1]);
};

const registeredMoves = new Map();
for (const id of [
  ...tableKeys(movesEffectSrc, 'PROTECT_MOVES'),
  ...tableKeys(movesEffectSrc, 'VARIABLE_TYPE_MOVES'),
  ...tableKeys(movesEffectSrc, 'SIDE_CONDITION_MOVES'),
  ...tableKeys(movesEffectSrc, 'FIELD_CONDITION_MOVES'),
  ...tableKeys(movesEffectSrc, 'MOVE_EFFECTS'),
  ...[...movesEffectSrc.matchAll(/defs\.push\(\{ id: '([a-z0-9]+)'/g)].map((match) => match[1]),
]) {
  registeredMoves.set(id, 'effects/moves.ts');
}
for (const match of itemsEffectSrc.matchAll(/move\.id !== '([a-z0-9]+)'/g)) {
  registeredMoves.set(match[1], 'effects/items.ts');
}

// Port: ids `src/engine/battle/turn.ts` special-cases outside the registry —
// Wish's delayed heal, the four counter moves and the call-a-move seam.
const TURN_LOOP_MOVES = new Set([
  'wish', 'counter', 'mirrorcoat', 'metalburst', 'comeuppance',
  'metronome', 'copycat', 'mirrormove', 'assist', 'sleeptalk', 'naturepower',
]);

// Port: data fields the battle reads. The status ids are `STATUS_IDS`
// (`src/engine/battle/status.ts`), the volatiles are the cases of
// `applyVolatileEffect`'s switch (`src/engine/battle/turn.ts` — anything else
// falls to `default: return false`), the weather/terrain ids are `MOVE_WEATHER`
// (`effects/weather.ts`) and `MOVE_TERRAIN` (`effects/terrain.ts`).
const MOVE_STATUSES = new Set(['brn', 'psn', 'tox', 'par', 'slp', 'frz']);
const MOVE_VOLATILES = new Set([
  'confusion', 'leechseed', 'taunt', 'encore', 'trapped', 'partiallytrapped',
  'perishsong', 'perish', 'flinch', 'yawn', 'substitute',
  'aquaring', 'ingrain', 'destinybond', 'dragoncheer', 'focusenergy', 'laserfocus',
  'endure', 'grudge', 'imprison', 'magiccoat', 'snatch', 'magnetrise', 'powertrick',
]);
const MOVE_WEATHERS = new Set(['sunnyday', 'raindance', 'sandstorm', 'snowscape', 'hail']);
const MOVE_TERRAINS = new Set(['electricterrain', 'grassyterrain', 'mistyterrain', 'psychicterrain']);

/** A secondary only counts when the engine applies something inside it. */
const hasReadSecondary = (move) =>
  (move.secondaries ?? []).some(
    (secondary) =>
      MOVE_STATUSES.has(secondary.status) ||
      MOVE_VOLATILES.has(secondary.volatileStatus) ||
      Boolean(secondary.boosts) ||
      MOVE_STATUSES.has(secondary.self?.status) ||
      Boolean(secondary.self?.boosts),
  );

/**
 * The seam the move is ported through, or null when nothing models it. The
 * generic damage branch is the fallback and `flags.protect` the last resort, so
 * a move with a specific seam (Absorb's drain, Solar Beam's charge) names that
 * seam while plain damage (Tackle) names the branch it rides.
 */
const portedMoveNote = (move) => {
  if (registeredMoves.has(move.id)) return `registry: ${registeredMoves.get(move.id)}`;
  if (TURN_LOOP_MOVES.has(move.id)) return 'turn loop: turn.ts';
  if (MOVE_STATUSES.has(move.status)) return 'data: status';
  if (MOVE_VOLATILES.has(move.volatileStatus)) return 'data: volatileStatus';
  if (move.boosts) return 'data: boosts';
  if (move.self?.boosts) return 'data: self.boosts';
  if (MOVE_STATUSES.has(move.self?.status)) return 'data: self.status';
  if (hasReadSecondary(move)) return 'data: secondaries';
  if (move.heal) return 'data: heal';
  if (move.drain) return 'data: drain';
  if (move.recoil) return 'data: recoil';
  if (move.struggleRecoil) return 'data: struggleRecoil';
  if (move.multihit) return 'data: multihit';
  if (move.selfdestruct) return 'data: selfdestruct';
  if (move.selfSwitch) return 'data: selfSwitch';
  if (MOVE_WEATHERS.has(norm(move.weather ?? ''))) return 'data: weather';
  if (MOVE_TERRAINS.has(norm(move.terrain ?? ''))) return 'data: terrain';
  if (move.flags.charge) return 'data: flags.charge';
  if (move.category !== 'Status' && move.basePower > 0) return 'data: basePower';
  if (move.flags.protect) return 'data: flags.protect';
  return null;
};

// Excluded: no learnset in the shipped dex grants the move (the ability table's
// "no playable species has it" rule, derived rather than listed — `D40`/`D42`),
// so a moveset the run generates can never contain it.
const grantedByALearnset = new Set();
for (const learnset of Object.values(learnsets)) {
  for (const moveId of Object.keys(learnset)) grantedByALearnset.add(moveId);
}

// The one move the engine hands out itself: Struggle replaces a spent moveset
// (`src/engine/battle/commands.ts`), so it is reachable with no learnset and is
// never an exclusion — `turn.ts` reads its `struggleRecoil`.
const ENGINE_MOVES = new Set(['struggle']);

const EXCLUDED_MOVES = new Map();
for (const move of moves) {
  if (!grantedByALearnset.has(move.id) && !ENGINE_MOVES.has(move.id)) {
    EXCLUDED_MOVES.set(move.id, 'no playable species has it');
  }
}

// Cut mechanics: `scripts/build-dex.mjs` already drops every Z-Move, Max Move,
// CAP/Future/Unobtainable and Gigantamax entry, and the moves a cut mechanic
// leaves behind (Tera Blast, Dynamax Cannon, Behemoth Blade...) still deal plain
// damage through the generic branch, so they come out `port` — the engine models
// what the run can actually meet. A new cut mechanic (a Terastal-shaped rule)
// names its moves here with the mechanic.
const CUT_MECHANIC_MOVES = new Map();
for (const [id, reason] of CUT_MECHANIC_MOVES) EXCLUDED_MOVES.set(id, reason);

// Deliberately out of scope for a single battle: the reason names the missing
// mechanic or situation the engine does not model.
for (const id of [
  'afteryou', 'allyswitch', 'craftyshield', 'followme', 'gearup', 'helpinghand',
  'magneticflux', 'quickguard', 'ragepowder', 'wideguard',
]) {
  EXCLUDED_MOVES.set(id, 'doubles/ally only');
}
for (const id of ['roar', 'whirlwind']) {
  EXCLUDED_MOVES.set(id, 'no forced-switch mechanic');
}
for (const id of ['spikes', 'toxicspikes', 'stealthrock', 'stickyweb', 'courtchange']) {
  EXCLUDED_MOVES.set(id, 'entry hazards are not modelled');
}
EXCLUDED_MOVES.set('sketch', 'needs a permanent move copy');

const moveEntries = [...moves]
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((move) => {
    if (EXCLUDED_MOVES.has(move.id)) {
      return { id: move.id, name: move.name, status: 'excluded', note: EXCLUDED_MOVES.get(move.id) };
    }
    const note = portedMoveNote(move);
    if (note) return { id: move.id, name: move.name, status: 'port', note };
    return { id: move.id, name: move.name, status: 'no-op', note: 'reachable, not ported yet' };
  });

const moveRows = moveEntries.map((entry) => [entry.name, entry.status, entry.note]);

const itemNames = new Map(items.map((item) => [norm(item.id), item.name]));
for (const [id, name] of catalogue) if (!itemNames.has(id)) itemNames.set(id, name);

// Held items a run can meet that `effects/items.ts` does not model yet (`D16`
// `no-op`). `UNMODELLED_ITEMS` in that file is the source of truth; it is read as
// text, like the move tables above.
const unmodelledItems = (() => {
  const start = itemsEffectSrc.indexOf('const UNMODELLED_ITEMS');
  if (start < 0) return new Set();
  const end = itemsEffectSrc.indexOf('\n];', start);
  return new Set([...itemsEffectSrc.slice(start, end).matchAll(/'([a-z0-9]+)'/g)].map((m) => m[1]));
})();

const itemRows = [...itemNames.entries()]
  .sort((a, b) => a[1].localeCompare(b[1]))
  .map(([id, name]) => {
    if (!catalogue.has(id)) return [name, 'excluded', 'not in the run catalogue'];
    if (unmodelledItems.has(id)) return [name, 'no-op', 'reachable, not modelled yet'];
    return [name, 'port', 'in the run catalogue (`src/data/items.ts`)'];
  });

const count = (rows, status) => rows.filter((row) => row[1] === status).length;

const table = (rows) =>
  ['| Effect | Status | Note |', '| --- | --- | --- |', ...rows.map((row) => `| ${row[0]} | \`${row[1]}\` | ${row[2]} |`)].join('\n');

const doc = `# Effect coverage

Tracks every battle ability and item so "Gen 9 complete" is a claim this table
backs up (\`D16\` in \`docs/tech-decisions.md\`). Notes only: nothing here is read
by the game. Regenerate with \`npm run docs:coverage\`.
The same classification is written to \`src/data/moveCoverage.json\`, which is what
the develop-build warning reads, so a move that goes off and does nothing cannot
hide during playtests.

## Legend

- \`port\` — behaviour implemented. Abilities live in
  \`src/engine/battle/effects/abilities.ts\`; battle items in the Bag
  (\`commands.ts\`) and held items in \`effects/items.ts\`.
- \`no-op\` — an effect a run can actually meet but that is not implemented yet.
  A develop build (the \`src/dev\` gate) warns once per effect when a battle
  meets one, so a gap cannot hide during playtests.
- \`excluded\` — deliberately out of scope: no playable species has it, it only
  works with allies, it needs a cut mechanic (Mega/Z/Dynamax/Terastal/forme
  change), or it needs a mechanic the engine does not model (weight, entry
  hazards, forced switching, out-of-battle effects). Excluded effects are never
  a coverage gap.
- \`removed\` — the engine no longer carries it because its mechanic became
  **data** (\`D38\`): the forme-changing abilities whose forme is now an evolution
  branch, a variant drawn at generation or a hand-authored Mega. The deletion is
  the change; the row records it so the table never claims a port for code that
  is gone. Removals are listed in \`REMOVED_ABILITIES\` in
  \`scripts/effect-coverage.mjs\`.
- For a move, \`port\` means a registered handler, an id the turn loop
  special-cases, or a data-driven field the engine reads; \`no-op\` means a run
  can meet the move and nothing happens.
- For an item, \`port\` means the held item registers a handler
  (\`effects/items.ts\`) or the Bag item is one \`commands.ts\` reads; \`no-op\`
  means a run can meet the item and nothing happens.

The run only ever hands out the items in \`src/data/items.ts\`, so a dex item that
is not in that catalogue is \`excluded\` by definition: adding it later is a
catalogue row, not engine code.

## Abilities — ${abilityRows.length} total (${count(abilityRows, 'port')} port, ${count(abilityRows, 'no-op')} no-op, ${count(abilityRows, 'excluded')} excluded, ${count(abilityRows, 'removed')} removed)

${table(abilityRows)}

## Moves — ${moveRows.length} total (${count(moveRows, 'port')} port, ${count(moveRows, 'no-op')} no-op, ${count(moveRows, 'excluded')} excluded)

${table(moveRows)}

## Items — ${itemRows.length} total (${count(itemRows, 'port')} port, ${count(itemRows, 'no-op')} no-op, ${count(itemRows, 'excluded')} excluded)

${table(itemRows)}
`;

writeFileSync(join(root, 'docs/balance/effect-coverage.md'), doc);
writeFileSync(
  join(root, 'src/data/moveCoverage.json'),
  `${JSON.stringify({ source: 'scripts/effect-coverage.mjs', moves: moveEntries }, null, 2)}\n`,
);
console.log(
  `coverage: ${abilityRows.length} abilities, ${moveRows.length} moves, ${itemRows.length} items ` +
    `(${count(abilityRows, 'port') + count(moveRows, 'port') + count(itemRows, 'port')} port)`,
);
