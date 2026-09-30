// Minimal PNG decode/encode (8-bit, no external deps). Decode supports the
// color types/filters found in real-world PNGs (RGB, RGBA, palette+tRNS,
// grayscale); encode always writes RGBA (color type 6), matching
// generate-tileset.mjs's encodePng. Kept standalone so importing it has no
// side effects (unlike generate-tileset.mjs, which writes a file on import).
import { deflateSync, inflateSync } from 'node:zlib'

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

export function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('bad PNG signature')
  let off = 8
  let width, height, bitDepth, colorType
  const idat = []
  let palette = null
  let trns = null
  while (off < buf.length) {
    const len = buf.readUInt32BE(off)
    const type = buf.subarray(off + 4, off + 8).toString('ascii')
    const data = buf.subarray(off + 8, off + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'PLTE') palette = data
    else if (type === 'tRNS') trns = data
    off += 12 + len
    if (type === 'IEND') break
  }
  if (bitDepth !== 8 && !(bitDepth === 4 || bitDepth === 2 || bitDepth === 1)) {
    throw new Error('unsupported bit depth ' + bitDepth)
  }
  if (bitDepth !== 8 && colorType !== 3 && colorType !== 0) {
    throw new Error('sub-byte bit depth only supported for palette/grayscale PNGs')
  }
  const raw = inflateSync(Buffer.concat(idat))

  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType]
  const bpp = Math.max(1, Math.ceil((channels * bitDepth) / 8))
  const stride = Math.ceil((width * channels * bitDepth) / 8)
  const out = Buffer.alloc(height * stride)
  let inOff = 0
  let prevRow = Buffer.alloc(stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[inOff++]
    const rowData = raw.subarray(inOff, inOff + stride)
    inOff += stride
    const outRow = out.subarray(y * stride, y * stride + stride)
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? outRow[x - bpp] : 0
      const b = prevRow[x]
      const c = x >= bpp ? prevRow[x - bpp] : 0
      let val = rowData[x]
      if (filter === 1) val += a
      else if (filter === 2) val += b
      else if (filter === 3) val += Math.floor((a + b) / 2)
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        val += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      outRow[x] = val & 0xff
    }
    prevRow = outRow
  }

  const maxValue = (1 << bitDepth) - 1
  const sampleAt = (row, x) => {
    if (bitDepth === 8) return row[x * channels]
    const bitPos = x * bitDepth
    const shift = 8 - bitDepth - (bitPos & 7)
    return (row[bitPos >> 3] >> shift) & maxValue
  }

  const rgba = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y++) {
    const row = out.subarray(y * stride, y * stride + stride)
    for (let x = 0; x < width; x++) {
      const d = (y * width + x) * 4
      if (colorType === 6) {
        const s = y * stride + x * channels
        rgba.set(out.subarray(s, s + 4), d)
      } else if (colorType === 2) {
        const s = y * stride + x * channels
        rgba.set(out.subarray(s, s + 3), d)
        rgba[d + 3] = 255
      } else if (colorType === 3) {
        const idx = sampleAt(row, x)
        rgba[d] = palette[idx * 3]
        rgba[d + 1] = palette[idx * 3 + 1]
        rgba[d + 2] = palette[idx * 3 + 2]
        rgba[d + 3] = trns && idx < trns.length ? trns[idx] : 255
      } else if (colorType === 0) {
        const grey = bitDepth === 8 ? row[x] : Math.round((sampleAt(row, x) * 255) / maxValue)
        rgba[d] = rgba[d + 1] = rgba[d + 2] = grey
        rgba[d + 3] = 255
      } else if (colorType === 4) {
        const s = y * stride + x * channels
        rgba[d] = rgba[d + 1] = rgba[d + 2] = out[s]
        rgba[d + 3] = out[s + 1]
      }
    }
  }
  return { width, height, data: rgba }
}

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

export function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// PMD water-bank art (both the desert and wood source sheets) bakes a few
// magenta placeholder pixels straight into the base Water tiles - meant for
// the original game's runtime palette-cycling animation, meaningless to a
// static crop. Left as-is they show up as stray magenta specks in the
// atlas. Replaces every pixel matching `isBad` with the nearest non-bad
// pixel's color (expanding a square search radius until one is found),
// mutating `tile.data` in place.
export function inpaint(tile, isBad) {
  const { width, height, data } = tile
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4
      if (!isBad(data[o], data[o + 1], data[o + 2], data[o + 3])) continue
      for (let radius = 1; radius < Math.max(width, height); radius++) {
        let found = -1
        for (let dy = -radius; dy <= radius && found < 0; dy++) {
          const ny = y + dy
          if (ny < 0 || ny >= height) continue
          for (let dx = -radius; dx <= radius; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue
            const nx = x + dx
            if (nx < 0 || nx >= width) continue
            const no = (ny * width + nx) * 4
            if (!isBad(data[no], data[no + 1], data[no + 2], data[no + 3])) {
              found = no
              break
            }
          }
        }
        if (found >= 0) {
          data[o] = data[found]
          data[o + 1] = data[found + 1]
          data[o + 2] = data[found + 2]
          data[o + 3] = data[found + 3]
          break
        }
      }
    }
  }
}
