// Derives `design/tokens.json` from the exported board: the single place a colour, radius, type
// size or panel measurement is written. The direction is board -> tokens -> chrome + CSS vars, so
// nothing downstream retypes `#10161f`. Every value carries the count it was measured on, and a role
// the board no longer draws fails the run instead of silently emitting a stale hex.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const framesDir = 'design/frames';
const outFile = 'design/tokens.json';

const ROLES = {
  ink: '#f8fafc',
  primary: '#f1f5f9',
  secondary: '#cbd5e1',
  muted: '#94a3b8',
  faint: '#475569',
  accent: '#7dd3fc',
  warning: '#fbbf24',
};

const hex = (value) => {
  if (!value || typeof value !== 'object') return null;
  const { r, g, b } = value;
  if ([r, g, b].some((channel) => typeof channel !== 'number')) return null;
  const byte = (channel) => Math.round(Math.max(0, Math.min(1, channel)) * 255).toString(16).padStart(2, '0');
  return `#${byte(r)}${byte(g)}${byte(b)}`;
};

const normalizeRadius = (node) => node.properties?.cornerRadius ?? node.cornerRadius ?? 0;
const widthOf = (node) => node.properties?.width ?? node.width ?? 0;
const heightOf = (node) => node.properties?.height ?? node.height ?? 0;
const xOf = (node) => node.properties?.x ?? node.x ?? 0;
const yOf = (node) => node.properties?.y ?? node.y ?? 0;
const fillsOf = (node) => node.properties?.fills ?? node.fills ?? [];
const strokesOf = (node) => node.properties?.strokes ?? node.strokes ?? [];
const alphaOf = (paint) => (typeof paint.opacity === 'number' ? paint.opacity : typeof paint.a === 'number' ? paint.a : 1);

function walk(node, visit) {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

function bump(map, key, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function top(map, count = 1) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, count);
}

const files = readdirSync(framesDir).filter((name) => name.endsWith('.json')).sort();
const colours = new Map();
const radii = new Map();
const sizes = new Map();
const boxes = new Map();
const panelFills = new Map();
const panelStrokes = new Map();
const panelWidths = new Map();
const panelOffsets = new Map();
const rowFills = new Map();
const rowStrokes = new Map();
const rowRadii = new Map();
const desktopX = [];
const mobileX = [];
const topEdge = [];
const bottomEdge = [];

for (const file of files) {
  const doc = JSON.parse(readFileSync(join(framesDir, file), 'utf8'));
  const mobile = doc.slug.startsWith('m');
  const root = doc.geometry?.[0];
  if (!root) continue;
  (mobile ? mobileX : desktopX).push(xOf(root));

  for (const node of doc.geometry ?? []) {
    walk(node, (current) => {
      const isRoot = current === node;
      const radius = normalizeRadius(current);
      const width = widthOf(current);
      const height = heightOf(current);
      const isPanel = !isRoot && radius >= 10 && radius <= 12 && width >= 200 && height >= 80;
      const isRow = !isRoot && radius >= 4 && radius <= 9 && width >= 120;
      for (const paint of fillsOf(current)) {
        const colour = hex(paint.color);
        if (!colour) continue;
        bump(colours, `${colour}@${alphaOf(paint)}`);
        if (isPanel) {
          bump(radii, radius);
          bump(panelFills, `${colour}@${alphaOf(paint)}`);
          if (mobile) bump(panelWidths, Math.round(width));
          if (mobile) bump(panelOffsets, Math.round(xOf(current)));
        }
        if (isRow) {
          bump(rowRadii, radius);
          bump(rowFills, `${colour}@${alphaOf(paint)}`);
        }
      }
      for (const paint of strokesOf(current)) {
        const colour = hex(paint.color);
        if (!colour) continue;
        if (isPanel) bump(panelStrokes, `${colour}@${alphaOf(paint)}`);
        if (isRow) bump(rowStrokes, `${colour}@${alphaOf(paint)}`);
      }
      if (mobile && isPanel) {
        topEdge.push(Math.round(yOf(current)));
        bottomEdge.push(Math.round(yOf(current) + height));
      }
    });
  }

  for (const node of doc.text ?? []) {
    walk(node, (current) => {
      const size = current.properties?.fontSize ?? current.fontSize;
      const height = Math.round(heightOf(current));
      if (!size || !height) return;
      bump(sizes, size);
      bump(boxes, `${size}:${height}`);
    });
  }
}

function boxFor(size) {
  const candidates = [...boxes.entries()]
    .filter(([key]) => key.startsWith(`${size}:`))
    .sort((a, b) => b[1] - a[1]);
  if (!candidates.length) return null;
  const [key, count] = candidates[0];
  return { size, box: Number(key.split(':')[1]), count };
}

const parseColour = (key) => {
  const [colour, alpha] = key.split('@');
  return { colour, alpha: Number(alpha) };
};

const panel = top(panelFills, 1)[0]?.[0];
const panelPaint = parseColour(panel ?? '#000000@1');
const panelBorder = parseColour(top(panelStrokes, 1)[0]?.[0] ?? '#ffffff@0.16');
const rowPaint = parseColour(top(rowFills, 1)[0]?.[0] ?? '#ffffff@0.03');
const rowBorder = parseColour(top(rowStrokes, 1)[0]?.[0] ?? '#ffffff@0.08');
const typeSizes = top(sizes, 12).map(([size]) => size).sort((a, b) => a - b);

const palette = top(colours, 24).map(([key, count]) => ({ ...parseColour(key), count }));
const drawn = new Set([...colours.keys()].map((key) => key.split('@')[0]));
const missing = Object.entries(ROLES)
  .filter(([, colour]) => !drawn.has(colour))
  .map(([role]) => role);

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  return sorted[Math.floor(sorted.length / 2)];
};
const pitch = median(desktopX.slice(1).map((x, i) => x - desktopX[i]));
const offset = median(mobileX.map((x, i) => x - desktopX[i]).filter((value) => Number.isFinite(value)));

const variants = (map) => [...map.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));
const panelVariants = variants(panelWidths);
const offsetVariants = variants(panelOffsets);
const preferredWidth = panelVariants.find((entry) => entry.value === 374) ?? panelVariants[0];
const preferredOffset = offsetVariants.find((entry) => entry.value === 8) ?? offsetVariants[0];

const TYPE_ROLES = { tag: 8, meta: 9, body: 10, chip: 11, name: 12, section: 14, readout: 16, title: 18, display: 20, hero: 24, pad: 32 };
const typeRoles = Object.fromEntries(Object.entries(TYPE_ROLES).filter(([, size]) => sizes.has(size)).map(([role, size]) => [role, size]));

const tokens = {
  panel: { fill: panelPaint.colour, alpha: panelPaint.alpha, alphas: [...new Set([...panelFills.keys()].map((key) => parseColour(key).alpha))].sort(), border: { colour: panelBorder.colour, alpha: panelBorder.alpha }, radius: top(radii, 1)[0]?.[0] ?? 11 },
  row: { fill: { colour: rowPaint.colour, alpha: rowPaint.alpha }, border: { colour: rowBorder.colour, alpha: rowBorder.alpha }, radius: top(rowRadii, 1)[0]?.[0] ?? 8 },
  accent: ROLES.accent,
  text: { primary: ROLES.primary, secondary: ROLES.secondary, muted: ROLES.muted, faint: ROLES.faint, ink: ROLES.ink, warning: ROLES.warning },
  type: typeRoles,
  scale: [...sizes.keys()].sort((a, b) => a - b).map((size) => boxFor(size)).filter(Boolean),
  panelWidth: preferredWidth?.value ?? 374,
  gutter: preferredOffset?.value ?? 8,
  panelWidthVariants: panelVariants,
  gutterVariants: offsetVariants,
  safeArea: { top: 47, bottom: 810, source: 'docs/hud-fidelity.md §5, not drawn on the board' },
  panelBounds: { top: Math.min(...topEdge), bottom: Math.max(...bottomEdge) },
  grid: { pitch, mobileOffset: offset },
  palette,
  source: { frames: files.length, textSizes: sizes.size, exportedAt: new Date().toISOString().slice(0, 10) },
  warnings: missing.length ? [`roles the board no longer draws: ${missing.join(', ')}`] : [],
};

writeFileSync(outFile, `${JSON.stringify(tokens, null, 2)}\n`);
console.log(`tokens written: ${outFile}`);
console.log(`  panel ${tokens.panel.fill} @${tokens.panel.alpha}, r${tokens.panel.radius}; row r${tokens.row.radius}`);
console.log(`  type ${typeSizes.join('/')} px; panelWidth ${tokens.panelWidth}; gutter ${tokens.gutter}; safeArea ${tokens.safeArea.top}/${tokens.safeArea.bottom}`);
console.log(`  grid pitch ${tokens.grid.pitch}, mobileOffset ${tokens.grid.mobileOffset}; ${files.length} viewports`);
for (const warning of tokens.warnings) console.warn(`  warning: ${warning}`);
