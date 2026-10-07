import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import sharp from 'sharp';
const path=new URL('../lib/question-image-server.ts',import.meta.url);
let media={};
if(fs.existsSync(path)) {const code=ts.transpile(fs.readFileSync(path,'utf8').replace('import sharp from "sharp";', 'const sharp = globalThis.testImageSharp;'),{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022});globalThis.testImageSharp=sharp;media=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));}
assert.equal(typeof media.normalizedImage,'function','image decoding/crop contract is not implemented');
const input=await sharp({create:{width:20,height:10,channels:4,background:'#ff0000'}}).png().toBuffer();
const cropped=await media.normalizedImage(input,{left:25,top:10,width:50,height:80});
const metadata=await sharp(cropped).metadata();assert.equal(metadata.width,10);assert.equal(metadata.height,8);assert.equal(metadata.format,'png');
for(const crop of [{left:-1,top:0,width:50,height:50},{left:90,top:0,width:50,height:50},{left:0,top:0,width:0,height:50},{left:0,top:0,width:NaN,height:50}])await assert.rejects(media.normalizedImage(input,crop),/invalid_crop/);
await assert.rejects(media.normalizedImage(Buffer.from('<svg><script>bad</script></svg>')),/invalid_image/);
await assert.rejects(media.normalizedImage(Buffer.alloc(4_000_001)),/image_too_large/);
console.log('Image processing PASS: real PNG decoding, bounded crop dimensions, malformed/SVG/oversize rejection');
