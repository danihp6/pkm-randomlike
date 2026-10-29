// The board's four gates, all headless: no network, no token, no browser and no clock. Each name is
// one line of output and one entry of the report; `snapshot_hash_mismatch` and
// `colour_outside_tokens` are green before the operator's REST run and fatal after it.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const CHECK_NAMES = Object.freeze([
  'colour_outside_tokens',
  'frame_without_component',
  'snapshot_hash_mismatch',
  'variant_missing',
]);

const PANEL_PATTERN = /^[a-z][a-z0-9-]*$/;

const exists = (target) => existsSync(target);

const isFile = (target) => exists(target) && statSync(target).isFile();

const isDirectory = (target) => exists(target) && statSync(target).isDirectory();

function readJson(target) {
  return JSON.parse(readFileSync(target, 'utf8'));
}

function readJsonIfPresent(target) {
  return isFile(target) ? readJson(target) : null;
}

function tokenColours(tokens) {
  const literals = new Set();
  const add = (colour, alpha) => {
    if (typeof colour === 'string') literals.add(`${colour}@${alpha}`);
  };
  for (const entry of tokens.palette ?? []) add(entry.colour, entry.alpha);
  add(tokens.panel?.fill, tokens.panel?.alpha);
  add(tokens.panel?.border?.colour, tokens.panel?.border?.alpha);
  add(tokens.row?.fill?.colour, tokens.row?.fill?.alpha);
  add(tokens.row?.border?.colour, tokens.row?.border?.alpha);
  add(tokens.accent, 1);
  for (const colour of Object.values(tokens.text ?? {})) add(colour, 1);
  return literals;
}

function line(name, summary, violations) {
  if (!violations.length) return `${name}: ${summary}`;
  return `${name}: ${summary}; ${violations.join('; ')}`;
}

/**
 * @returns {{ code: 0|1, lines: string[], report: Record<string, string[]> }}
 */
export function runCheck({ root = process.cwd() } = {}) {
  const design = path.join(root, 'design');
  const map = readJson(path.join(design, 'import.json'));
  const board = readJson(path.join(design, 'board.json'));
  const tokens = readJson(path.join(design, 'tokens.json'));
  const entries = Array.isArray(map.screens) ? map.screens : [];
  const frames = board.frames ?? {};
  const specOf = (slug) => readJsonIfPresent(path.join(design, 'screens', `${slug}.json`));

  const report = {
    colour_outside_tokens: [],
    frame_without_component: [],
    snapshot_hash_mismatch: [],
    variant_missing: [],
  };

  const literals = tokenColours(tokens);
  let specScreens = 0;
  for (const entry of entries) {
    const spec = specOf(entry.slug);
    if (!spec) continue;
    specScreens += 1;
    for (const literal of spec.colours ?? []) {
      if (!literals.has(literal)) report.colour_outside_tokens.push(`${entry.slug}: ${literal}`);
    }
  }
  const colourSummary = specScreens
    ? `${specScreens} screens, ${report.colour_outside_tokens.length} violations`
    : '0 screens (run the import)';

  for (const entry of entries) {
    const scene = entry.scene ?? '';
    if (!exists(path.join(root, scene))) report.frame_without_component.push(`${entry.slug}: scene ${scene} is missing`);
    const panel = entry.panel ?? '';
    if (!PANEL_PATTERN.test(panel) || frames[entry.slug]?.panel !== panel) {
      report.frame_without_component.push(`${entry.slug}: panel does not match the board`);
    }
    const component =
      PANEL_PATTERN.test(panel) &&
      (isDirectory(path.join(root, 'src', 'ui', 'hud', 'panels', panel)) ||
        isFile(path.join(root, 'src', 'ui', `${panel}Panel.ts`)));
    if (!component) report.frame_without_component.push(`${entry.slug}: no component for panel ${panel}`);
  }

  let mismatched = 0;
  let pending = 0;
  for (const entry of entries) {
    if (entry.snapshot !== true) continue;
    const target = `design/exports/${entry.slug}.png`;
    const spec = specOf(entry.slug);
    const png = path.join(root, target);
    if (!spec || !isFile(png)) {
      pending += 1;
      continue;
    }
    const before = report.snapshot_hash_mismatch.length;
    const snapshot = spec.snapshot ?? {};
    const keys = Object.keys(snapshot).sort();
    if (keys.join(',') !== 'bytes,file,sha256') {
      report.snapshot_hash_mismatch.push(`${entry.slug}: snapshot keys are ${keys.join(',') || 'none'}, expected bytes, file, sha256`);
    } else {
      const found = createHash('sha256').update(readFileSync(png)).digest('hex');
      if (snapshot.file !== target) {
        report.snapshot_hash_mismatch.push(`${entry.slug}: snapshot.file is ${snapshot.file}, expected ${target}`);
      } else if (snapshot.sha256 !== found) {
        report.snapshot_hash_mismatch.push(
          `${entry.slug}: 1 byte moved (expected ${snapshot.sha256}, found ${found})`,
        );
      }
    }
    if (report.snapshot_hash_mismatch.length > before) mismatched += 1;
  }
  const snapshotSummary = `${mismatched} mismatched, ${pending} pending the import`;

  const known = new Set(Object.keys(frames));
  for (const row of Object.values(frames)) {
    for (const key of Object.keys(row.exports ?? {})) known.add(key);
  }
  for (const entry of entries) {
    const variants = [...(entry.states ?? [])];
    if (entry.mobile) variants.push(entry.mobile);
    for (const variant of variants) {
      if (!known.has(variant)) report.variant_missing.push(`${entry.slug}: ${variant} has no frame`);
    }
  }
  const variantSummary = `${entries.length} entries, ${report.variant_missing.length} unresolved (report-only)`;

  const lines = [
    line(CHECK_NAMES[0], colourSummary, report.colour_outside_tokens),
    line(CHECK_NAMES[1], `${entries.length} entries, ${report.frame_without_component.length} violations`, report.frame_without_component),
    line(CHECK_NAMES[2], snapshotSummary, report.snapshot_hash_mismatch),
    line(CHECK_NAMES[3], variantSummary, report.variant_missing),
  ];

  const fatalCount =
    report.colour_outside_tokens.length +
    report.frame_without_component.length +
    report.snapshot_hash_mismatch.length;

  return { code: fatalCount ? 1 : 0, lines, report };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const argv = process.argv.slice(2);
  const index = argv.indexOf('--root');
  const root = path.resolve(index >= 0 && argv[index + 1] ? argv[index + 1] : process.cwd());
  const result = runCheck({ root });
  for (const line of result.lines) process.stdout.write(`${line}\n`);
  process.exit(result.code);
}
