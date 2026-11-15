import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';

const base = process.argv[2];
let bytes;
if (base) {
  const response = await fetch(new URL('/favicon.ico', base), {
    redirect: 'error', signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 200, '/favicon.ico must serve an image, not a missing-page response');
  assert.match(response.headers.get('content-type') || '', /^image\/(?:x-icon|vnd\.microsoft\.icon)(?:;|$)/);
  bytes = Buffer.from(await response.arrayBuffer());
  const head = await fetch(new URL('/favicon.ico', base), { method: 'HEAD', redirect: 'error' });
  assert.equal(head.status, 200, 'favicon HEAD must also succeed');
  const home = await fetch(new URL('/', base));
  assert.equal(home.status, 200);
  assert.match(await home.text(), /<link[^>]+href="\/favicon\.ico(?:\?[^"]*)?"/,
    'Next metadata must expose the canonical favicon');
} else {
  bytes = await fs.readFile(new URL('../app/favicon.ico', import.meta.url));
}

assert.equal(bytes.readUInt16LE(0), 0, 'ICO reserved field');
assert.equal(bytes.readUInt16LE(2), 1, 'ICO image type');
const count = bytes.readUInt16LE(4);
assert.equal(count, 4, 'provide small browser and larger search-icon representations');
const sizes = [];
for (let i = 0; i < count; i++) {
  const offset = 6 + i * 16;
  const width = bytes[offset] || 256;
  const height = bytes[offset + 1] || 256;
  const length = bytes.readUInt32LE(offset + 8);
  const start = bytes.readUInt32LE(offset + 12);
  assert.equal(width, height, 'favicon representations must be square');
  assert.ok(start >= 6 + count * 16 && start + length <= bytes.length, 'ICO frame lies within the file');
  const frame = bytes.subarray(start, start + length);
  const decoded = await sharp(frame).metadata();
  assert.equal(decoded.format, 'png');
  assert.equal(decoded.width, width);
  assert.equal(decoded.height, height);
  assert.equal(decoded.hasAlpha, true);
  const pixels = await sharp(frame).raw().toBuffer({ resolveWithObject: true });
  assert.equal(pixels.info.width, width, 'PNG pixels must fully decode');
  assert.equal(pixels.info.height, height);
  sizes.push(width);
}
assert.deepEqual(sizes, [16, 32, 48, 64]);
console.log(`Favicon PASS: ${base || 'source'}; valid square ICO frames ${sizes.join('/')}; ${bytes.length} bytes`);
