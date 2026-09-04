import { describe, expect, it } from 'vitest';
import { createStoreZip } from './zip';

describe('store ZIP writer', () => {
  it('creates a ZIP with local, central and end signatures', () => {
    const zip = createStoreZip([{ name: 'hello.txt', data: new TextEncoder().encode('hello') }]);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(Array.from(zip).some((_byte, index) => index + 3 < zip.length && view.getUint32(index, true) === 0x06054b50)).toBe(true);
  });

  it('rejects duplicate names and path traversal', () => {
    const data = new Uint8Array([1]);
    expect(() => createStoreZip([{ name: 'a.txt', data }, { name: 'a.txt', data }])).toThrow(/Duplicate/);
    expect(() => createStoreZip([{ name: '../', data }])).toThrow();
  });
});
