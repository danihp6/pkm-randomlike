// Projects the board from two inputs: a Figma REST file payload and the hand-authored
// `design/import.json` map. It returns one screen spec per mapped desktop frame, the token table
// measured from the mapped viewports, and the board index. Pure: no fetch, no fs, no clock, no RNG,
// so the same two arguments always produce the same bytes and `import.mjs --check` can trust the
// comparison.
const ROLES = {
  ink: '#f8fafc',
  primary: '#f1f5f9',
  secondary: '#cbd5e1',
  muted: '#94a3b8',
  faint: '#475569',
  accent: '#7dd3fc',
  warning: '#fbbf24',
};

const TYPE_ROLES = {
  tag: 8,
  meta: 9,
  body: 10,
  chip: 11,
  name: 12,
  section: 14,
  readout: 16,
  title: 18,
  display: 20,
  hero: 24,
  pad: 32,
};

const SAFE_AREA = { top: 47, bottom: 810, source: 'docs/hud-fidelity.md §5, not drawn on the board' };

/** The board's own lower-kebab: `'03 Route HUD'` → `'03-route-hud'`. */
export function slugOf(name) {
  return name
    .toLowerCase()
    .replace(/·/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const round2 = (value) => Math.round(value * 100) / 100;
const propsOf = (node) => node.properties ?? node;

function hexOf(color) {
  if (!color || typeof color !== 'object') return null;
  const channels = [color.r, color.g, color.b];
  if (channels.some((channel) => typeof channel !== 'number')) return null;
  return `#${channels.map((channel) => Math.round(clamp01(channel) * 255).toString(16).padStart(2, '0')).join('')}`;
}

const alphaOf = (paint) =>
  typeof paint.opacity === 'number' ? paint.opacity : typeof paint.a === 'number' ? paint.a : 1;

function literalOf(paint) {
  if (!paint || paint.type !== 'SOLID') return null;
  const hex = hexOf(paint.color);
  return hex === null ? null : `${hex}@${alphaOf(paint)}`;
}

function extentOf(node) {
  const props = propsOf(node);
  const bounds = props.absoluteBoundingBox;
  const read = (key) => {
    const fromBounds = bounds && typeof bounds === 'object' ? bounds[key] : undefined;
    if (typeof fromBounds === 'number') return round2(fromBounds);
    return typeof props[key] === 'number' ? round2(props[key]) : 0;
  };
  return { x: read('x'), y: read('y'), width: read('width'), height: read('height') };
}

const radiusOf = (node) => propsOf(node).cornerRadius ?? 0;

function paintsOf(node, key) {
  const paints = propsOf(node)[key];
  return Array.isArray(paints) ? paints : [];
}

function firstVisibleLiteral(node, key) {
  for (const paint of paintsOf(node, key)) {
    if (paint.visible === false) continue;
    const literal = literalOf(paint);
    if (literal !== null) return literal;
  }
  return null;
}

const fontNameOf = (node) => {
  const props = propsOf(node);
  return props.fontName ?? props.style?.fontFamily ?? null;
};

const fontSizeOf = (node) => {
  const props = propsOf(node);
  return props.fontSize ?? props.style?.fontSize ?? null;
};

function walk(node, visit) {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

function boxOf(node) {
  const extent = extentOf(node);
  return {
    id: node.id ?? null,
    name: node.name ?? null,
    type: node.type ?? null,
    x: extent.x,
    y: extent.y,
    width: extent.width,
    height: extent.height,
    radius: radiusOf(node),
    fill: firstVisibleLiteral(node, 'fills'),
    stroke: firstVisibleLiteral(node, 'strokes'),
  };
}

function textOf(node) {
  const extent = extentOf(node);
  return {
    id: node.id ?? null,
    name: node.name ?? null,
    characters: propsOf(node).characters ?? '',
    fontName: fontNameOf(node),
    fontSize: fontSizeOf(node),
    x: extent.x,
    y: extent.y,
    width: extent.width,
    height: extent.height,
    fill: firstVisibleLiteral(node, 'fills'),
  };
}

function screenOf(entry, desktop, twin) {
  const extent = extentOf(desktop);
  const boxes = [];
  const text = [];
  for (const child of desktop.children ?? []) {
    walk(child, (node) => {
      if ((node.type ?? null) === 'TEXT') text.push(textOf(node));
      else boxes.push(boxOf(node));
    });
  }
  const colours = [
    ...new Set(
      [...boxes.map((box) => box.fill), ...boxes.map((box) => box.stroke), ...text.map((line) => line.fill)].filter(
        (literal) => literal !== null,
      ),
    ),
  ].sort();
  return {
    slug: entry.slug,
    caption: entry.caption,
    nodeId: desktop.id ?? null,
    viewport: { width: extent.width, height: extent.height },
    mobile: twin ? { slug: entry.mobile ?? `m${entry.slug}`, nodeId: twin.id ?? null } : null,
    states: [...(entry.states ?? [])],
    boxes,
    text,
    colours,
    snapshot: { file: `design/exports/${entry.slug}.png` },
  };
}

function bump(counts, key, amount = 1) {
  counts.set(key, (counts.get(key) ?? 0) + amount);
}

function topOne(counts) {
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return entries.length ? entries[0][0] : null;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  return sorted[Math.floor(sorted.length / 2)];
}

const parseLiteral = (literal) => {
  const [colour, alpha] = literal.split('@');
  return { colour, alpha: Number(alpha) };
};

function variantsOf(counts) {
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));
}

function boxFor(size, textBoxes) {
  const candidates = [...textBoxes.entries()].filter(([key]) => key.startsWith(`${size}:`)).sort((a, b) => b[1] - a[1]);
  if (!candidates.length) return null;
  const [key, count] = candidates[0];
  return { size, box: Number(key.split(':')[1]), count };
}

function compareColours(a, b) {
  if (a.colour !== b.colour) return a.colour < b.colour ? -1 : 1;
  return a.alpha - b.alpha;
}

function measure(roots) {
  const colours = new Map();
  const radii = new Map();
  const sizes = new Map();
  const textBoxes = new Map();
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

  for (const { node, mobile } of roots) {
    const root = extentOf(node);
    (mobile ? mobileX : desktopX).push(root.x);

    walk(node, (current) => {
      const extent = extentOf(current);
      const radius = radiusOf(current);
      const isRoot = current === node;
      const isPanel = !isRoot && radius >= 10 && radius <= 12 && extent.width >= 200 && extent.height >= 80;
      const isRow = !isRoot && radius >= 4 && radius <= 9 && extent.width >= 120;

      for (const paint of paintsOf(current, 'fills')) {
        const literal = literalOf(paint);
        if (literal === null) continue;
        bump(colours, literal);
        if (isPanel) {
          bump(radii, radius);
          bump(panelFills, literal);
          if (mobile) bump(panelWidths, Math.round(extent.width));
          if (mobile) bump(panelOffsets, Math.round(extent.x));
        }
        if (isRow) {
          bump(rowRadii, radius);
          bump(rowFills, literal);
        }
      }
      for (const paint of paintsOf(current, 'strokes')) {
        const literal = literalOf(paint);
        if (literal === null) continue;
        bump(colours, literal);
        if (isPanel) bump(panelStrokes, literal);
        if (isRow) bump(rowStrokes, literal);
      }
      if (mobile && isPanel) {
        topEdge.push(Math.round(extent.y));
        bottomEdge.push(Math.round(extent.y + extent.height));
      }
      if ((current.type ?? null) === 'TEXT') {
        const size = fontSizeOf(current);
        const height = Math.round(extent.height);
        if (size && height) {
          bump(sizes, size);
          bump(textBoxes, `${size}:${height}`);
        }
      }
    });
  }

  const panelPaint = parseLiteral(topOne(panelFills) ?? '#000000@1');
  const panelBorder = parseLiteral(topOne(panelStrokes) ?? '#ffffff@0.16');
  const rowPaint = parseLiteral(topOne(rowFills) ?? '#ffffff@0.03');
  const rowBorder = parseLiteral(topOne(rowStrokes) ?? '#ffffff@0.08');
  const panelRadius = topOne(radii);
  const rowRadius = topOne(rowRadii);
  const panelVariants = variantsOf(panelWidths);
  const gutterVariants = variantsOf(panelOffsets);
  const preferredWidth = panelVariants.find((entry) => entry.value === 374) ?? panelVariants[0];
  const preferredGutter = gutterVariants.find((entry) => entry.value === 8) ?? gutterVariants[0];
  const typeRoles = Object.fromEntries(
    Object.entries(TYPE_ROLES)
      .filter(([, size]) => sizes.has(size))
      .map(([role, size]) => [role, size]),
  );
  const drawn = new Set([...colours.keys()].map((literal) => literal.split('@')[0]));
  const missing = Object.entries(ROLES)
    .filter(([, colour]) => !drawn.has(colour))
    .map(([role]) => role);
  const alphas = [...new Set([...panelFills.keys()].map((literal) => parseLiteral(literal).alpha))].sort(
    (a, b) => a - b,
  );

  return {
    panel: {
      fill: panelPaint.colour,
      alpha: panelPaint.alpha,
      alphas,
      border: { colour: panelBorder.colour, alpha: panelBorder.alpha },
      radius: panelRadius ?? 11,
    },
    row: {
      fill: { colour: rowPaint.colour, alpha: rowPaint.alpha },
      border: { colour: rowBorder.colour, alpha: rowBorder.alpha },
      radius: rowRadius ?? 8,
    },
    accent: ROLES.accent,
    text: {
      primary: ROLES.primary,
      secondary: ROLES.secondary,
      muted: ROLES.muted,
      faint: ROLES.faint,
      ink: ROLES.ink,
      warning: ROLES.warning,
    },
    type: typeRoles,
    scale: [...sizes.keys()]
      .sort((a, b) => a - b)
      .map((size) => boxFor(size, textBoxes))
      .filter(Boolean),
    panelWidth: preferredWidth ? preferredWidth.value : 374,
    gutter: preferredGutter ? preferredGutter.value : 8,
    panelWidthVariants: panelVariants,
    gutterVariants,
    safeArea: { top: SAFE_AREA.top, bottom: SAFE_AREA.bottom, source: SAFE_AREA.source },
    panelBounds: { top: Math.min(...topEdge), bottom: Math.max(...bottomEdge) },
    grid: {
      pitch: median(desktopX.slice(1).map((x, index) => x - desktopX[index])),
      mobileOffset: median(mobileX.map((x, index) => x - desktopX[index]).filter((value) => Number.isFinite(value))),
    },
    palette: [...colours.entries()]
      .map(([literal, count]) => ({ ...parseLiteral(literal), count }))
      .sort((a, b) => b.count - a.count || compareColours(a, b)),
    source: { frames: roots.length, textSizes: sizes.size },
    warnings: missing.length ? [`roles the board no longer draws: ${missing.join(', ')}`] : [],
  };
}

function knownVariants(frames) {
  const known = new Set(Object.keys(frames));
  for (const row of Object.values(frames)) {
    for (const key of Object.keys(row.exports ?? {})) known.add(key);
  }
  return known;
}

const TEXT_KEYS = ['characters', 'fontName', 'fontSize'];

function indexById(node, byId = new Map()) {
  if (!node || typeof node !== 'object') return byId;
  if (typeof node.id === 'string' && !byId.has(node.id)) byId.set(node.id, node);
  for (const child of node.children ?? []) indexById(child, byId);
  return byId;
}

function textKeysOf(textNode) {
  if (!textNode) return null;
  const properties = textNode.properties ?? textNode;
  const picked = {};
  for (const key of TEXT_KEYS) {
    if (key in properties) picked[key] = properties[key];
  }
  return Object.keys(picked).length ? picked : null;
}

function mergeText(node, byId) {
  if (!node || typeof node !== 'object') return node;
  const picked = textKeysOf(byId.get(node.id) ?? null);
  const children = node.children?.length ? node.children.map((child) => mergeText(child, byId)) : null;
  if (!picked && !children) return node;
  const merged = { ...node };
  if (picked) merged.properties = { ...(node.properties ?? {}), ...picked };
  if (children) merged.children = children;
  return merged;
}

const bySlug = (a, b) => {
  const left = String(a?.slug ?? '');
  const right = String(b?.slug ?? '');
  return left < right ? -1 : left > right ? 1 : 0;
};

/**
 * Rebuilds the REST file payload from the exporter's committed dumps, so the same
 * `projectBoard` projection runs with no request and no token.
 *
 * @param {object[]} frames  parsed `design/frames/*.json` dumps
 *        (`{ slug, nodeId, exportedAt, geometry: [root], text: [root] }`)
 * @param {{ page?: string, name?: string }} [options]
 * @returns {{
 *   file: { name: string, lastModified: string|null, document: object },
 *   problems: { code: string, slug: string, detail: string }[]
 * }}
 */
export function buildFileFromFrames(frames, { page = 'Page 1', name = 'pkm-randomlike' } = {}) {
  const children = [];
  const problems = [];
  const captions = new Set();
  let lastModified = null;

  for (const dump of [...(frames ?? [])].sort(bySlug)) {
    const exportedAt = dump?.exportedAt;
    if (typeof exportedAt === 'string' && (lastModified === null || exportedAt > lastModified)) lastModified = exportedAt;

    const root = dump?.geometry?.[0] ?? null;
    if (!root) continue;
    const caption = typeof root.name === 'string' ? root.name : '';
    if (captions.has(caption)) {
      problems.push({ code: 'frame_duplicated', slug: dump.slug, detail: caption });
      continue;
    }
    captions.add(caption);
    children.push(mergeText(root, indexById(dump?.text?.[0] ?? null)));
  }

  return {
    file: {
      name,
      lastModified,
      document: {
        id: '0:0',
        name,
        type: 'DOCUMENT',
        children: [{ id: '0:1', name: page, type: 'CANVAS', children }],
      },
    },
    problems,
  };
}

/**
 * @param {object} file   a `GET /v1/files/:key` payload: `{ name, lastModified, document }`
 * @param {object} map    the parsed contents of `design/import.json`
 * @returns {{ screens: object[], tokens: object, board: object, problems: object[] }}
 */
export function projectBoard(file, map) {
  const page = (file?.document?.children ?? []).find((node) => node.name === map.page) ?? null;
  const byName = new Map();
  for (const node of page?.children ?? []) {
    if (typeof node?.name === 'string' && !byName.has(node.name)) byName.set(node.name, node);
  }

  const screens = [];
  const frames = {};
  const problems = [];
  const roots = [];

  for (const entry of map.screens ?? []) {
    const desktop = byName.get(entry.caption) ?? null;
    if (!desktop) {
      problems.push({ code: 'frame_missing', slug: entry.slug, detail: entry.caption });
      continue;
    }
    const twin = byName.get(`M ${entry.caption}`) ?? null;
    if (!twin) problems.push({ code: 'mobile_missing', slug: entry.slug, detail: `M ${entry.caption}` });
    const twinSlug = entry.mobile ?? `m${entry.slug}`;

    screens.push(screenOf(entry, desktop, twin));
    frames[entry.slug] = {
      name: desktop.name ?? entry.caption,
      panel: entry.panel,
      scene: entry.scene,
      desktop: desktop.id ?? null,
      mobile: twin ? (twin.id ?? null) : null,
      exports: twin
        ? { [entry.slug]: { nodeId: desktop.id ?? null }, [twinSlug]: { nodeId: twin.id ?? null } }
        : { [entry.slug]: { nodeId: desktop.id ?? null } },
    };
    roots.push({ node: desktop, mobile: false });
    if (twin) roots.push({ node: twin, mobile: true });
  }

  const known = knownVariants(frames);
  for (const entry of map.screens ?? []) {
    if (!frames[entry.slug]) continue;
    for (const state of entry.states ?? []) {
      if (!known.has(state)) problems.push({ code: 'variant_missing', slug: entry.slug, detail: state });
    }
  }

  return { screens, tokens: measure(roots), board: { page: map.page, frames }, problems };
}
