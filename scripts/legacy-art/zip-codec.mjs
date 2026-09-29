// Minimal, dependency-free ZIP reader — enough to unpack the flat,
// single-disk, non-zip64 archives PMDCollab serves (store or deflate
// compression, no encryption). Mirrors png-codec.mjs: hand-rolled parsing
// instead of pulling in a zip library.
import { inflateRawSync } from 'node:zlib'

const EOCD_SIG = 0x06054b50
const CENTRAL_SIG = 0x02014b50
const LOCAL_SIG = 0x04034b50

function findEOCD(buf) {
  // EOCD is a fixed 22-byte record plus a variable comment field at the very
  // end of the file — scan backwards for its signature.
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) return i
  }
  throw new Error('not a zip file (no end-of-central-directory record found)')
}

/** Reads a zip buffer, returning [{ name, data }] for every file entry (skips directories). */
export function readZip(buf) {
  const eocd = findEOCD(buf)
  const entryCount = buf.readUInt16LE(eocd + 10)
  let offset = buf.readUInt32LE(eocd + 16)

  const entries = []
  for (let i = 0; i < entryCount; i++) {
    if (buf.readUInt32LE(offset) !== CENTRAL_SIG) throw new Error(`bad central directory entry at ${offset}`)
    const method = buf.readUInt16LE(offset + 10)
    const compSize = buf.readUInt32LE(offset + 20)
    const nameLen = buf.readUInt16LE(offset + 28)
    const extraLen = buf.readUInt16LE(offset + 30)
    const commentLen = buf.readUInt16LE(offset + 32)
    const localOffset = buf.readUInt32LE(offset + 42)
    const name = buf.toString('utf8', offset + 46, offset + 46 + nameLen)
    entries.push({ name, method, compSize, localOffset })
    offset += 46 + nameLen + extraLen + commentLen
  }

  return entries
    .filter((e) => !e.name.endsWith('/'))
    .map(({ name, method, compSize, localOffset }) => {
      if (buf.readUInt32LE(localOffset) !== LOCAL_SIG) throw new Error(`bad local header at ${localOffset}`)
      const nameLen = buf.readUInt16LE(localOffset + 26)
      const extraLen = buf.readUInt16LE(localOffset + 28)
      const dataStart = localOffset + 30 + nameLen + extraLen
      const raw = buf.subarray(dataStart, dataStart + compSize)
      const data = method === 0 ? Buffer.from(raw) : method === 8 ? inflateRawSync(raw) : null
      if (!data) throw new Error(`unsupported compression method ${method} for ${name}`)
      return { name, data }
    })
}
