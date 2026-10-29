// Fetches the Figma file the map names and writes the board's four artifact families: the token
// table, the board index, one screen spec per desktop frame and one PNG per viewport. `--check`
// re-fetches, recomputes and compares byte for byte instead of writing, so a drifted artifact is a
// failure and a missing one is drift, never "nothing to do".
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectBoard } from './importer.mjs';

const API = 'https://api.figma.com';

/**
 * @returns {Promise<{ code: 0|1|2, wrote: string[], drifted: string[], problems: object[] }>}
 */
export async function runImport({ root = process.cwd(), env = process.env, fetch = globalThis.fetch, check = false } = {}) {
  const stop = (message) => {
    process.stderr.write(`${message}\n`);
    return { code: 2, wrote: [], drifted: [], problems: [] };
  };

  const token = env.FIGMA_TOKEN;
  if (!token) return stop('missing FIGMA_TOKEN');
  const fileKey = env.FIGMA_FILE_KEY;
  if (!fileKey) return stop('missing FIGMA_FILE_KEY');

  let map;
  try {
    map = JSON.parse(await readFile(path.join(root, 'design', 'import.json'), 'utf8'));
  } catch (error) {
    return stop(`cannot read design/import.json: ${error.message}`);
  }
  const entries = Array.isArray(map.screens) ? map.screens : [];
  if (!entries.length) return stop('design/import.json maps 0 screens');

  const request = async (url, auth = true) => {
    const response = await (auth ? fetch(url, { headers: { 'X-Figma-Token': token } }) : fetch(url));
    if (!response.ok) throw new Error(`figma ${response.status} ${url}`);
    return response;
  };

  let index;
  try {
    index = await (await request(`${API}/v1/files/${fileKey}?depth=3`)).json();
  } catch (error) {
    return stop(error.message);
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
      return stop(error.message);
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
  for (const problem of problems) {
    process.stderr.write(`${problem.code} ${problem.slug}: ${problem.detail}\n`);
  }
  if (problems.some((problem) => problem.code === 'frame_missing' || problem.code === 'mobile_missing')) {
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
    return stop(error.message);
  }

  for (const screen of screens) {
    const bytes = snapshots.get(screen.nodeId);
    screen.snapshot = {
      file: `design/exports/${screen.slug}.png`,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.length,
    };
  }

  const asJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
  const artifacts = [
    ['design/tokens.json', asJson(tokens)],
    ['design/board.json', asJson(board)],
  ];
  for (const screen of screens) artifacts.push([`design/screens/${screen.slug}.json`, asJson(screen)]);
  for (const screen of screens) {
    artifacts.push([`design/exports/${screen.slug}.png`, snapshots.get(screen.nodeId)]);
    if (screen.mobile) artifacts.push([`design/exports/${screen.mobile.slug}.png`, snapshots.get(screen.mobile.nodeId)]);
  }

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

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const argv = process.argv.slice(2);
  const value = (name, fallback) => {
    const index = argv.indexOf(name);
    return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
  };
  const result = await runImport({
    root: path.resolve(value('--root', process.cwd())),
    check: argv.includes('--check'),
  });
  process.exit(result.code);
}
