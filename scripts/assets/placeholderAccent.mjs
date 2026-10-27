// One accent per placeholder atlas, derived only from its path, so a tree without
// the packed art paints every fallback in its own colour instead of one shared
// swatch pair: a screen-wide criterion can then be measured, because no two
// atlases ever answer the same fill.
//
// The palette is a hash-derived hue over one fixed saturation/value pair for the
// interior and a lighter one for the edge. The pairs are picked so every hue in
// the circle stays inside the blank's dark range (fill luminance 0.414 at most)
// and at least 16 apart, in RGB Euclidean distance, from both colours this
// generator used to paint (`#3A4252` fill / `#7888A0` border).
const HUE_STEPS = 360
const FILL_SATURATION = 0.5
const FILL_VALUE = 0.44
const BORDER_SATURATION = 0.35
const BORDER_VALUE = 0.78

const hashPath = (path) => {
  let hash = 0x811c9dc5
  for (let i = 0; i < path.length; i += 1) {
    hash ^= path.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

const hsvToRgb = (hue, saturation, value) => {
  const chroma = value * saturation
  const sector = (((hue % 360) + 360) % 360) / 60
  const second = chroma * (1 - Math.abs((sector % 2) - 1))
  const base = value - chroma
  const [r, g, b] =
    sector < 1
      ? [chroma, second, 0]
      : sector < 2
        ? [second, chroma, 0]
        : sector < 3
          ? [0, chroma, second]
          : sector < 4
            ? [0, second, chroma]
            : sector < 5
              ? [second, 0, chroma]
              : [chroma, 0, second]
  return [
    Math.round((r + base) * 255),
    Math.round((g + base) * 255),
    Math.round((b + base) * 255),
  ]
}

/**
 * The two colours one placeholder paints with, derived only from its atlas path.
 * Deterministic: the same path always answers the same pair, across runs and
 * machines, so a committed blank and its criterion never disagree.
 *
 * @param {string} path the atlas path inside `src/assets/`, e.g. `frlg/forest.png`
 * @returns {{ fill: readonly [number, number, number], border: readonly [number, number, number] }}
 */
export function accentFor(path) {
  const hue = ((hashPath(path) % HUE_STEPS) * 360) / HUE_STEPS
  return Object.freeze({
    fill: Object.freeze(hsvToRgb(hue, FILL_SATURATION, FILL_VALUE)),
    border: Object.freeze(hsvToRgb(hue, BORDER_SATURATION, BORDER_VALUE)),
  })
}
