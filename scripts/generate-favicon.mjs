import fs from 'node:fs/promises';
import sharp from 'sharp';

// The existing PassmateLogo mark and tokens, preserved in public/favicon.svg.
const svg = await fs.readFile(new URL('../public/favicon.svg', import.meta.url));
const sizes = [16, 32, 48, 64];
const frames = await Promise.all(sizes.map(size => sharp(svg).resize(size, size).png().toBuffer()));
const directory = Buffer.alloc(6 + sizes.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(sizes.length, 4);
let position = directory.length;
for (let i = 0; i < sizes.length; i++) {
  const entry = 6 + i * 16;
  directory[entry] = sizes[i];
  directory[entry + 1] = sizes[i];
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(frames[i].length, entry + 8);
  directory.writeUInt32LE(position, entry + 12);
  position += frames[i].length;
}
await fs.writeFile(new URL('../app/favicon.ico', import.meta.url), Buffer.concat([directory, ...frames]));
console.log('Generated app/favicon.ico from the existing PASSMATE brand mark');
