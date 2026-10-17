import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
assert.ok(fs.existsSync(new URL('./seo-verification.mjs',import.meta.url)), 'Public HTML and asset response validators must exist');
const { verifyMetadata, verifyNoIndex, extractAssets, verifyAsset, verifyNetworkLog, priorityPaths, expectedMetadata } = await import('./seo-verification.mjs');
const canonical='https://www.mypassmate.com/cbt/%EC%A0%84%EA%B8%B0%EA%B8%B0%EB%8A%A5%EC%82%AC/';
const expected=expectedMetadata(new URL(canonical).pathname);
const head=`<title>${expected.title}</title><meta content='${expected.description}' name='description'><link href='${canonical}' rel='canonical'>`;
test('raw head metadata is required; body-only, duplicate and wrong canonical fail',()=>{
  assert.doesNotThrow(()=>verifyMetadata(`<head>${head}</head><body>시험</body>`,canonical));
  assert.throws(()=>verifyMetadata(`<head></head><body>${head}</body>`,canonical),/title/);
  assert.throws(()=>verifyMetadata(`<head>${head}<title>duplicate</title></head>`,canonical),/title/);
  assert.throws(()=>verifyMetadata(`<head>${head}</head>`,canonical+'other/'),/canonical/);
  assert.throws(()=>verifyMetadata(`<head>${head.replace(expected.title,'PASSMATE')}</head>`,canonical),/page-specific title/);
  assert.throws(()=>verifyMetadata(`<head>${head.replace(expected.description,'generic')}</head>`,canonical),/page-specific description/);
  assert.throws(()=>verifyMetadata(`<head>${head}<meta name='robots' content='noindex'></head>`,canonical),/noindex/);
  assert.doesNotThrow(()=>verifyNoIndex(`<head><meta name='robots' content='noindex, follow'></head>`));
  assert.throws(()=>verifyNoIndex(`<head>${head}</head>`),/noindex/);
});
test('asset discovery includes flight-imported chunks, deduplicates and stays same-origin',()=>{
  const html=`<script src='/_next/static/a.js'></script><link href='/_next/static/a.css'>self.__next_f.push([1,'static/chunks/app/layout-abc.js']);<script src='/_next/static/a.js'></script>`;
  assert.deepEqual(extractAssets(html,'http://localhost:3134/'),['http://localhost:3134/_next/static/a.js','http://localhost:3134/_next/static/a.css','http://localhost:3134/_next/static/chunks/app/layout-abc.js']);
});
test('404 and successful HTML checkpoints are rejected rather than counted as JS success',()=>{
  assert.doesNotThrow(()=>verifyAsset({url:'https://example.test/x.js',status:200,mimeType:'application/javascript',body:'console.log(1)'}));
  assert.throws(()=>verifyAsset({url:'https://example.test/x.js',status:404,mimeType:'text/html',body:'missing'}),/404/);
  assert.throws(()=>verifyAsset({url:'https://example.test/x.js',status:200,mimeType:'text/html',body:'<html>Vercel Security Checkpoint</html>'}),/content type/);
  assert.throws(()=>verifyAsset({url:'https://example.test/x.css',status:200,mimeType:'text/css',body:'<!doctype html><html>error</html>'}),/HTML/);
});
test('network release evidence must cover every priority page and actual dynamic resources',()=>{
  const origin='https://www.mypassmate.com';
  const pages=priorityPaths.map(path=>({url:origin+path,documentStatus:200,resources:[{url:origin+'/_next/static/x.js',type:'Script',status:200,mimeType:'text/javascript',body:'console.log(1)',fromDiskCache:false,fromServiceWorker:false},{url:origin+'/_next/static/x.css',type:'Stylesheet',status:200,mimeType:'text/css',body:'body{}',fromDiskCache:false,fromServiceWorker:false}]}));
  assert.equal(verifyNetworkLog({origin,pages}).pages,13);
  assert.throws(()=>verifyNetworkLog({origin,pages:pages.slice(1)}),/coverage/);
  const bad=structuredClone(pages);bad[0].resources[0].status=404;
  assert.throws(()=>verifyNetworkLog({origin,pages:bad}),/404/);
  const cached=structuredClone(pages);cached[0].resources[0].fromDiskCache=true;
  assert.throws(()=>verifyNetworkLog({origin,pages:cached}),/cache/);
  const missing=structuredClone(pages);delete missing[0].resources[0].body;
  assert.throws(()=>verifyNetworkLog({origin,pages:missing}),/missing captured/);
  const absentFlags=structuredClone(pages);delete absentFlags[0].resources[0].fromDiskCache;
  assert.throws(()=>verifyNetworkLog({origin,pages:absentFlags}),/cache/);
  const disguised=structuredClone(pages);disguised[0].resources[0].body='<html>checkpoint</html>';
  assert.throws(()=>verifyNetworkLog({origin,pages:disguised}),/HTML/);
});
