import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSV_BASE = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv';
const FILES = [
  'move_names.csv',
  'move_flavor_text.csv',
  'ability_names.csv',
  'ability_flavor_text.csv',
  'moves.csv',
  'abilities.csv',
];
const ES_LANGUAGES = new Set([7, 14]);
const LATEST_VERSION_GROUP = 25;

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};

async function sourceDir() {
  const explicit = arg('--source', process.env.POKEAPI_CSV_DIR);
  if (explicit) return path.resolve(explicit);
  const dir = path.join(os.tmpdir(), 'pokeapi-csv');
  fs.mkdirSync(dir, { recursive: true });
  for (const file of FILES) {
    const target = path.join(dir, file);
    if (fs.existsSync(target)) continue;
    const response = await fetch(`${CSV_BASE}/${file}`);
    if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
    fs.writeFileSync(target, Buffer.from(await response.arrayBuffer()));
  }
  return dir;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function table(text) {
  const [header, ...rows] = parseCsv(text);
  return rows
    .filter((row) => row.length === header.length)
    .map((row) => Object.fromEntries(header.map((key, index) => [key, row[index]])));
}

function clean(text) {
  return text
    .replace(/\r/g, ' ')
    .replace(/\f/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function namesById(rows, languageIds) {
  const byId = new Map();
  for (const row of rows) {
    const id = Number(row.move_id ?? row.ability_id);
    if (!languageIds.has(Number(row.local_language_id))) continue;
    if (!byId.has(id)) byId.set(id, row.name);
    else if (Number(row.local_language_id) === 7) byId.set(id, row.name);
  }
  return byId;
}

function descriptionsById(rows, maxVersion) {
  const best = new Map();
  for (const row of rows) {
    const id = Number(row.move_id ?? row.ability_id);
    if (!ES_LANGUAGES.has(Number(row.language_id))) continue;
    const version = Number(row.version_group_id);
    if (version > maxVersion) continue;
    const text = clean(row.flavor_text ?? row.effect ?? '');
    if (text.length === 0) continue;
    const current = best.get(id);
    if (!current || version > current.version || (version === current.version && row.language_id === '7')) {
      best.set(id, { version, text });
    }
  }
  return new Map([...best].map(([id, value]) => [id, value.text]));
}

function build(
  dexRows,
  names,
  descriptions,
  missingNames,
  missingDescriptions,
  fallback,
  pokeIdOf,
) {
  const out = {};
  for (const row of dexRows) {
    const pokeId = pokeIdOf(row);
    if (!pokeId) {
      missingNames.push(row.id);
      continue;
    }
    const name = names.get(pokeId);
    if (!name) {
      missingNames.push(row.id);
      continue;
    }
    const description = descriptions.get(pokeId) ?? fallback?.(pokeId) ?? '';
    out[row.id] = { name, description, shortDescription: description };
    if (!description) missingDescriptions.push(row.id);
  }
  return out;
}

const normalise = (id) => id.toLowerCase().replace(/[^a-z0-9]/g, '');

function identifierIndex(rows) {
  return new Map(rows.map((row) => [normalise(row.identifier), Number(row.id)]));
}

function svTextFallback(file) {
  if (!file) return null;
  const lines = fs.readFileSync(path.resolve(file), 'utf8').split(/\r?\n/);
  const anchor = (needle) => {
    const index = lines.findIndex((line) => line.includes(needle));
    if (index < 0) throw new Error(`SV text dump: anchor not found: ${needle}`);
    return index;
  };
  const moveAnchor = anchor('Embestida con todo el cuerpo.');
  const abilityAnchor = anchor('Potencia sus movimientos de tipo Fuego cuando le');
  const moveNamesStart = anchor('Text File : wazaname.dat');
  const abilityNamesStart = anchor('Text File : tokuseiinfo.dat');
  const clean = (line) =>
    (line ?? '')
      .replace(/\\n/g, ' ')
      .replace(/\r/g, ' ')
      .replace(/\f/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const read = (index, stop) => {
    if (index >= stop) return '';
    const text = clean(lines[index]);
    return /^[-\u2014\s]+$/.test(text) ? '' : text;
  };
  return {
    move: (num) => read(moveAnchor - 33 + num, moveNamesStart),
    ability: (num) => read(abilityAnchor - 66 + num, abilityNamesStart),
  };
}

const dir = await sourceDir();
const read = (file) => fs.readFileSync(path.join(dir, file), 'utf8');
const dexMoves = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/dex/moves.json'), 'utf8'));
const dexAbilities = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/data/dex/abilities.json'), 'utf8'),
);

const moveNames = namesById(table(read('move_names.csv')), ES_LANGUAGES);
const moveDescriptions = descriptionsById(table(read('move_flavor_text.csv')), LATEST_VERSION_GROUP);
const abilityNames = namesById(table(read('ability_names.csv')), ES_LANGUAGES);
const abilityDescriptions = descriptionsById(
  table(read('ability_flavor_text.csv')),
  LATEST_VERSION_GROUP,
);
const moveIds = identifierIndex(table(read('moves.csv')));
const abilityIds = identifierIndex(table(read('abilities.csv')));
const ID_ALIASES = {
  visegrip: 11,
  embodyaspectcornerstone: 303,
  embodyaspecthearthflame: 303,
  embodyaspectteal: 303,
  embodyaspectwellspring: 303,
  zenmodegalar: 161,
};
const movePokeId = (row) => moveIds.get(row.id) ?? ID_ALIASES[row.id] ?? 0;
const abilityPokeId = (row) => abilityIds.get(row.id) ?? ID_ALIASES[row.id] ?? 0;

const missingMoveNames = [];
const missingMoveDescriptions = [];
const missingAbilityNames = [];
const missingAbilityDescriptions = [];
const sv = svTextFallback(arg('--sv-text', process.env.SV_TEXT_DUMP));
const moves = build(
  dexMoves,
  moveNames,
  moveDescriptions,
  missingMoveNames,
  missingMoveDescriptions,
  sv?.move,
  movePokeId,
);
const abilities = build(
  dexAbilities,
  abilityNames,
  abilityDescriptions,
  missingAbilityNames,
  missingAbilityDescriptions,
  sv?.ability,
  abilityPokeId,
);

const outDir = path.join(ROOT, 'src/data/i18n/es');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'moves.json'), `${JSON.stringify(moves, null, 2)}\n`);
fs.writeFileSync(path.join(outDir, 'abilities.json'), `${JSON.stringify(abilities, null, 2)}\n`);
fs.writeFileSync(
  path.join(outDir, 'meta.json'),
  `${JSON.stringify(
    {
      source: 'PokeAPI CSV dump, data/v2/csv',
      language: 'es',
      fallbackLanguage: 'es-419',
      latestVersionGroup: LATEST_VERSION_GROUP,
      moves: {
        total: dexMoves.length,
        named: Object.keys(moves).length,
        described: Object.values(moves).filter((row) => row.description.length > 0).length,
        missingNames: missingMoveNames,
        missingDescriptions: missingMoveDescriptions,
      },
      abilities: {
        total: dexAbilities.length,
        named: Object.keys(abilities).length,
        described: Object.values(abilities).filter((row) => row.description.length > 0).length,
        missingNames: missingAbilityNames,
        missingDescriptions: missingAbilityDescriptions,
      },
    },
    null,
    2,
  )}\n`,
);

console.log(
  `moves ${Object.keys(moves).length}/${dexMoves.length} named, ` +
    `${Object.values(moves).filter((row) => row.description.length > 0).length} described`,
);
console.log(
  `abilities ${Object.keys(abilities).length}/${dexAbilities.length} named, ` +
    `${Object.values(abilities).filter((row) => row.description.length > 0).length} described`,
);
