// Writes the board's four artifact families: the token table, the board index, one screen spec per
// desktop frame and one PNG per viewport. Two modes feed the same pure projection: the REST API
// (`FIGMA_TOKEN` + `FIGMA_FILE_KEY`, how a fresh board arrives) and the committed snapshot
// (`--from <framesDir>`, no request and no token at all, how the repo verifies its own board).
// `--check` recomputes and compares byte for byte instead of writing, so a drifted artifact is a
// failure and a missing one is drift, never "nothing to do".
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildFileFromFrames, projectBoard } from './importer.mjs';

const API = 'https://api.figma.com';

const FATAL = ['frame_missing', 'mobile_missing', 'frame_duplicated'];

const asJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

function failure(message) {
  process.stderr.write(`${message}\n`);
  return { code: 2, wrote: [], drifted: [], problems: [] };
}

function report(problems) {
  for (const problem of problems) process.stderr.write(`${problem.code} ${problem.slug}: ${problem.detail}\n`);
}

async function readMap(root) {
  try {
    return { map: JSON.parse(await readFile(path.join(root, 'design', 'import.json'), 'utf8')), error: null };
  } catch (error) {
    return { map: null, error: `cannot read design/import.json: ${error.message}` };
  }
}

async function deliver({ root, artifacts, check, problems }) {
  if (check) {
    const drifted = [];
    for (const [relative, content] of artifacts) {
      let current;
      try {
        current = await readFile(path.join(root, relative));
      } catch {
        drifted.push(relative);
        continue;
      }
      const wanted = typeof content === 'string' ? Buffer.from(content) : content;
      if (!current.equals(wanted)) drifted.push(relative);
    }
    drifted.sort();
    for (const relative of drifted) process.stdout.write(`${relative}\n`);
    return { code: drifted.length ? 1 : 0, wrote: [], drifted, problems };
  }

  await mkdir(path.join(root, 'design', 'screens'), { recursive: true });
  await mkdir(path.join(root, 'design', 'exports'), { recursive: true });
  const wrote = [];
  for (const [relative, content] of artifacts) {
    await writeFile(path.join(root, relative), content);
    wrote.push(relative);
  }
  return { code: 0, wrote, drifted: [], problems };
}

/**
 * Offline mode: rebuilds the REST payload from the exporter's dumps and the committed desktop
 * rasters. Reads no environment variable and makes no request, so a rate-limited PAT cannot block
 * the repo from proving its committed board.
 */
async function importFromFrames({ root, from, check }) {
  const { map, error } = await readMap(root);
  if (error) return failure(error);
  const entries = Array.isArray(map.screens) ? map.screens : [];
  if (!entries.length) return failure('design/import.json maps 0 screens');

  let names;
  try {
    names = (await readdir(from)).filter((name) => name.endsWith('.json')).sort();
  } catch (error) {
    return failure(`cannot read ${from}: ${error.message}`);
  }

  const dumps = [];
  for (const name of names) {
    const file = path.join(from, name);
    try {
      dumps.push(JSON.parse(await readFile(file, 'utf8')));
    } catch (error) {
      return failure(`cannot read ${file}: ${error.message}`);
    }
  }

  const built = buildFileFromFrames(dumps, { page: map.page });
  const { screens, tokens, board, problems: projected } = projectBoard(built.file, map);
  const problems = [...built.problems, ...projected];
  report(problems);
  if (problems.some((problem) => FATAL.includes(problem.code))) {
    return { code: 1, wrote: [], drifted: [], problems };
  }

  const rasters = new Map();
  for (const screen of screens) {
    const source = path.join(from, '..', 'screens', `${screen.slug}.png`);
    let bytes;
    try {
      bytes = await readFile(source);
    } catch (error) {
      return failure(`cannot read ${source}: ${error.message}`);
    }
    rasters.set(screen.slug, bytes);
    screen.snapshot = {
      file: `design/exports/${screen.slug}.png`,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.length,
    };
  }

  const artifacts = [
    ['design/tokens.json', asJson(tokens)],
    ['design/board.json', asJson(board)],
  ];
  for (const screen of screens) artifacts.push([`design/screens/${screen.slug}.json`, asJson(screen)]);
  for (const screen of screens) artifacts.push([`design/exports/${screen.slug}.png`, rasters.get(screen.slug)]);

  return deliver({ root, artifacts, check, problems });
}

/**
 * @param {object} [options]
 * @param {string} [options.root]     where `design/import.json` and the artifacts live
 * @param {object} [options.env]
 * @param {Function} [options.fetch]
 * @param {boolean} [options.check]
 * @param {string|null} [options.from] a frames directory → offline; null → REST
 * @returns {Promise<{ code: 0|1|2, wrote: string[], drifted: string[], problems: object[] }>}
 */
export async function runImport({
  root = process.cwd(),
  env = process.env,
  fetch = globalThis.fetch,
  check = false,
  from = null,
} = {}) {
  if (typeof from === 'string') return importFromFrames({ root, from, check });

  const token = env.FIGMA_TOKEN;
  if (!token) return failure('missing FIGMA_TOKEN');
  const fileKey = env.FIGMA_FILE_KEY;
  if (!fileKey) return failure('missing FIGMA_FILE_KEY');

  const { map, error } = await readMap(root);
  if (error) return failure(error);
  const entries = Array.isArray(map.screens) ? map.screens : [];
  if (!entries.length) return failure('design/import.json maps 0 screens');

  const request = async (url, auth = true) => {
    const response = await (auth ? fetch(url, { headers: { 'X-Figma-Token': token } }) : fetch(url));
    if (!response.ok) throw new Error(`figma ${response.status} ${url}`);
    return response;
  };

  let index;
  try {
    index = await (await request(`${API}/v1/files/${fileKey}?depth=3`)).json();
  } catch (error) {
    return failure(error.message);
  }

  const page = (index.document?.children ?? []).find((node) => node.name === map.page) ?? null;
  const byName = new Map();
  for (const node of page?.children ?? []) {
    if (typeof node?.name === 'string' && !byName.has(node.name)) byName.set(node.name, node);
  }
  const idOf = (name) => byName.get(name)?.id ?? null;

  const ids = [];
  for (const entry of entries) {
    for (const id of [idOf(entry.caption), idOf(`M ${entry.caption}`)]) {
      if (id && !ids.includes(id)) ids.push(id);
    }
  }

  let nodesPayload = { err: null, nodes: {} };
  let imagesPayload = { err: null, images: {} };
  if (ids.length) {
    const query = ids.join(',');
    try {
      nodesPayload = await (await request(`${API}/v1/files/${fileKey}?ids=${query}&depth=30`)).json();
      imagesPayload = await (await request(`${API}/v1/images/${fileKey}?ids=${query}&format=png&scale=2`)).json();
    } catch (error) {
      return failure(error.message);
    }
  }

  const children = [];
  for (const id of ids) {
    const full = nodesPayload.nodes?.[id]?.document;
    if (full) children.push(full);
  }

  const file = {
    name: index.name,
    lastModified: index.lastModified,
    document: {
      id: '0:0',
      name: index.name,
      type: 'DOCUMENT',
      children: [
        {
          id: page?.id ?? '0:1',
          name: map.page,
          type: 'CANVAS',
          children,
        },
      ],
    },
  };

  const { screens, tokens, board, problems } = projectBoard(file, map);
  report(problems);
  if (problems.some((problem) => FATAL.includes(problem.code))) {
    return { code: 1, wrote: [], drifted: [], problems };
  }

  const snapshots = new Map();
  try {
    for (const screen of screens) {
      for (const viewport of [screen, screen.mobile]) {
        if (!viewport) continue;
        const url = imagesPayload.images?.[viewport.nodeId];
        if (!url) throw new Error(`no image for ${viewport.nodeId}`);
        if (snapshots.has(viewport.nodeId)) continue;
        const response = await request(url, false);
        snapshots.set(viewport.nodeId, Buffer.from(await response.arrayBuffer()));
      }
    }
  } catch (error) {
    return failure(error.message);
  }

  for (const screen of screens) {
    const bytes = snapshots.get(screen.nodeId);
    screen.snapshot = {
      file: `design/exports/${screen.slug}.png`,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.length,
    };
  }

  const artifacts = [
    ['design/tokens.json', asJson(tokens)],
    ['design/board.json', asJson(board)],
  ];
  for (const screen of screens) artifacts.push([`design/screens/${screen.slug}.json`, asJson(screen)]);
  for (const screen of screens) {
    artifacts.push([`design/exports/${screen.slug}.png`, snapshots.get(screen.nodeId)]);
    if (screen.mobile) artifacts.push([`design/exports/${screen.mobile.slug}.png`, snapshots.get(screen.mobile.nodeId)]);
  }

  return deliver({ root, artifacts, check, problems });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const argv = process.argv.slice(2);
  const value = (name, fallback) => {
    const index = argv.indexOf(name);
    return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
  };
  const from = value('--from', null);
  const result = await runImport({
    root: path.resolve(value('--root', process.cwd())),
    from: typeof from === 'string' ? path.resolve(from) : null,
    check: argv.includes('--check'),
  });
  process.exit(result.code);
}
