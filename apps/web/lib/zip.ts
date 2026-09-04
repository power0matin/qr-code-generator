export interface ZipEntry {
  readonly name: string;
  readonly data: Uint8Array;
}

const encoder = new TextEncoder();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number): Uint8Array {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function u32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

function safeEntryName(name: string): string {
  const value = name.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\.\.(?:\/|$)/g, '').slice(0, 240);
  if (!value || value.endsWith('/')) throw new Error('ZIP entry filename is invalid.');
  return value;
}

export function createStoreZip(entries: readonly ZipEntry[]): Uint8Array {
  if (entries.length === 0) throw new Error('ZIP requires at least one file.');
  if (entries.length > 1000) throw new Error('ZIP file count exceeds the local safety limit.');

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;
  const seen = new Set<string>();

  for (const entry of entries) {
    const name = safeEntryName(entry.name);
    if (seen.has(name)) throw new Error(`Duplicate ZIP filename “${name}”.`);
    seen.add(name);
    const nameBytes = encoder.encode(name);
    const data = entry.data;
    const crc = crc32(data);
    const localHeader = concat([
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(crc), u32(data.byteLength), u32(data.byteLength), u16(nameBytes.byteLength), u16(0), nameBytes,
    ]);
    localParts.push(localHeader, data);

    const central = concat([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(crc), u32(data.byteLength), u32(data.byteLength), u16(nameBytes.byteLength), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(localOffset), nameBytes,
    ]);
    centralParts.push(central);
    localOffset += localHeader.byteLength + data.byteLength;
  }

  const centralDirectory = concat(centralParts);
  const end = concat([
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(centralDirectory.byteLength), u32(localOffset), u16(0),
  ]);
  return concat([...localParts, centralDirectory, end]);
}
