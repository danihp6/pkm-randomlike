import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { decodePng } from '../legacy-art/png-codec.mjs'
import { ATLASES } from './build-placeholders.mjs'
import { accentFor } from './placeholderAccent.mjs'

const PLACEHOLDERS = fileURLToPath(new URL('../../src/assets/placeholders/', import.meta.url))
const SIGN = 'frlg/sign.png'
const LEGACY_FILL = [58, 66, 82]
const LEGACY_BORDER = [120, 136, 160]

const distance = (a, b) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

const luminance = ([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255

const mean = ([r, g, b]) => (r + g + b) / 3

const decode = (path) => decodePng(readFileSync(PLACEHOLDERS + path))

const pixelAt = ({ width, data }, x, y) => {
  const i = (y * width + x) * 4
  return [data[i], data[i + 1], data[i + 2], data[i + 3]]
}

describe('accentFor', () => {
  it('answers the same pair for the same path', () => {
    const first = accentFor('frlg/forest.png')
    accentFor('frlg/cave.png')
    expect(accentFor('frlg/forest.png')).toEqual(first)
    expect(accentFor('frlg/forest.png')).toEqual(accentFor('frlg/forest.png'))
  })

  it('gives every atlas of the allow-list its own fill', () => {
    for (let i = 0; i < ATLASES.length; i += 1) {
      for (let j = 0; j < i; j += 1) {
        expect(accentFor(ATLASES[i]).fill, `${ATLASES[i]} vs ${ATLASES[j]}`).not.toEqual(
          accentFor(ATLASES[j]).fill,
        )
      }
    }
    expect(ATLASES).toHaveLength(20)
  })

  it('stays a dark blank, with the edge lighter than the interior', () => {
    for (const path of ATLASES) {
      const { fill, border } = accentFor(path)
      expect(luminance(fill), path).toBeLessThan(0.45)
      expect(mean(border), path).toBeGreaterThan(mean(fill))
    }
  })

  it('never repaints the old swatch pair', () => {
    for (const path of ATLASES) {
      const { fill, border } = accentFor(path)
      for (const colour of [fill, border]) {
        expect(distance(colour, LEGACY_FILL), path).toBeGreaterThanOrEqual(16)
        expect(distance(colour, LEGACY_BORDER), path).toBeGreaterThanOrEqual(16)
      }
    }
  })
})

describe('the committed blanks', () => {
  it('exist for every atlas of the allow-list', () => {
    for (const path of ATLASES) expect(existsSync(PLACEHOLDERS + path), path).toBe(true)
  })

  it('decode to their own accent: border on the edge, fill in the middle', () => {
    for (const path of ATLASES) {
      if (path === SIGN) continue
      const png = decode(path)
      const { fill, border } = accentFor(path)
      expect(pixelAt(png, 0, 0), path).toEqual([...border, 255])
      const centre = pixelAt(png, Math.floor(png.width / 2), Math.floor(png.height / 2))
      expect(centre, path).toEqual([...fill, 255])
    }
  })

  it('keep the sign a transparent board and post in its own accent', () => {
    const png = decode(SIGN)
    const { fill, border } = accentFor(SIGN)
    expect([png.width, png.height]).toEqual([16, 16])
    expect(pixelAt(png, 0, 0)[3]).toBe(0)
    expect(pixelAt(png, 15, 15)[3]).toBe(0)
    expect(pixelAt(png, 1, 5)[3]).toBe(0)
    for (let y = 3; y <= 8; y += 1) {
      for (let x = 2; x <= 13; x += 1) expect(pixelAt(png, x, y), `${x},${y}`).toEqual([...border, 255])
    }
    for (let y = 9; y <= 13; y += 1) {
      for (let x = 7; x <= 8; x += 1) expect(pixelAt(png, x, y), `${x},${y}`).toEqual([...fill, 255])
    }
  })
})
