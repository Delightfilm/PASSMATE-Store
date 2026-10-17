import fs from 'node:fs';
import assert from 'node:assert/strict';
import {priorityPaths,fetchHtml,extractAssets,verifyAsset,verifyNetworkLog} from './seo-verification.mjs';
if(process.env.SEO_NETWORK_LOG){
  const result=verifyNetworkLog(JSON.parse(fs.readFileSync(process.env.SEO_NETWORK_LOG,'utf8')));
  console.log(`Public asset network proof PASS: ${result.pages} pages; ${result.resources} actual same-origin script/style responses`);
}else{
  const base=process.env.SEO_BASE_URL;if(!base)throw new Error('Set SEO_BASE_URL for HTML/Flight asset checks, or SEO_NETWORK_LOG for observed browser network proof. No implicit skip.');
  const assets=new Set();
  for(const path of priorityPaths){const found=extractAssets(await fetchHtml(new URL(path,base),'PASSMATE-Release-Check'),base);assert.ok(found.length,`${path}: no asset references`);found.forEach(url=>assets.add(url));}
  assert.ok(assets.size<=1000,'Unexpected asset expansion');
  for(const url of assets){const r=await fetch(url,{signal:AbortSignal.timeout(30000),redirect:'error'});verifyAsset({url,status:r.status,mimeType:r.headers.get('content-type'),body:await r.text()});}
  console.log(`Public asset HTML/Flight reference check PASS: 13 pages; ${assets.size} unique assets. Browser network proof is a separate release gate.`);
}
