import assert from 'node:assert/strict';

export const canonicalOrigin='https://www.mypassmate.com';
export const priorityPaths=['/','/cbt/',...['전기기능사','지게차운전기능사',...['무대음향','무대기계','무대조명'].flatMap(field=>[1,2,3].map(grade=>`${field}-${grade}급`))].map(slug=>`/cbt/${encodeURIComponent(slug)}/`)];
const decode=value=>value.replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
const attributes=tag=>Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(m=>[m[1].toLowerCase(),decode(m[2]??m[3]??m[4])]));
const headOf=html=>{const m=html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);assert.ok(m,'Response has no head');return m[1];};
const metas=head=>[...head.matchAll(/<meta\b[^>]*>/gi)].map(m=>attributes(m[0]));
export function expectedMetadata(path){
  if(path==='/')return {title:'CBT 문제은행·자격증 기출문제 풀어보기 | PASSMATE',description:'전기기능사, 지게차운전기능사, 무대예술전문인 등 시험을 선택해 기출문제를 풀어보세요. PASSMATE CBT 문제은행에서 회차별 문제풀이와 모의시험, 오답 복습으로 학습을 이어가세요.'};
  if(path==='/cbt/')return {title:'자격증 CBT 기출문제·문제은행 | PASSMATE',description:'전기기능사·지게차운전기능사와 무대음향·무대기계·무대조명 급수별 기출문제를 찾아보세요. PASSMATE CBT 문제은행에서 회차를 선택해 기출문제 풀어보기, 모의시험과 오답 복습을 시작할 수 있습니다.'};
  assert.ok(priorityPaths.includes(path),'Metadata expectation is not approved for this path');
  const slug=decodeURIComponent(path.split('/')[2]),name=slug.replace(/-([123]급)$/,' $1');
  const years=slug==='전기기능사'?'2002–2016':slug==='지게차운전기능사'?'2004–2011':'2008–2026';
  return {title:`${name}${/기능사$/.test(name)?' 필기':''} 기출문제·CBT 문제은행 | PASSMATE`,description:`${name} ${years}년 기출문제를 회차별로 풀어보세요. CBT 모의시험으로 점검하고 정답 확인과 오답 복습을 이어갈 수 있습니다.`};
}
export function verifyMetadata(html,canonical){
  const head=headOf(html), titles=[...head.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)];
  assert.equal(titles.length,1,'Expected exactly one title in head');
  const title=decode(titles[0][1]).trim();assert.ok(title.includes('PASSMATE'),'Expected PASSMATE page title');
  const descriptions=metas(head).filter(m=>m.name?.toLowerCase()==='description');
  assert.equal(descriptions.length,1,'Expected one description in head');assert.ok(descriptions[0].content?.trim(),'Description is empty');
  const canonicals=[...head.matchAll(/<link\b[^>]*>/gi)].map(m=>attributes(m[0])).filter(m=>m.rel?.toLowerCase()==='canonical');
  assert.equal(canonicals.length,1,'Expected one canonical in head');
  assert.equal(new URL(canonicals[0].href).href,new URL(canonical).href,'Wrong canonical URL');
  const expected=expectedMetadata(new URL(canonical).pathname);
  assert.equal(title,expected.title,'Wrong page-specific title');
  assert.equal(descriptions[0].content,expected.description,'Wrong page-specific description');
  assert.ok(!metas(head).some(m=>m.name?.toLowerCase()==='robots'&&/\bnoindex\b/i.test(m.content??'')),'Public page is noindex');
  return {title,description:descriptions[0].content,canonical:canonicals[0].href};
}
export function verifyNoIndex(html){assert.ok(metas(headOf(html)).some(m=>m.name?.toLowerCase()==='robots'&&/\bnoindex\b/i.test(m.content??'')),'Private page must remain noindex');}
export function extractAssets(html,base){
  const origin=new URL(base).origin, found=new Set();
  // Include chunks referenced by streamed Flight imports, not just script elements.
  for(const m of html.matchAll(/((?:\/_next\/)?static\/[^"'\s<>\\]+?\.(?:js|css))(?:\?[^"'\s<>\\]*)?/g)){
    const path=m[0].startsWith('/_next/')?m[0]:`/_next/${m[0]}`;
    found.add(new URL(decode(path),origin).href);
  }
  return [...found];
}
export function verifyAsset({url,status,mimeType,body}){
  assert.ok((status>=200&&status<300)||status===304,`${url}: HTTP ${status}`);
  const css=new URL(url).pathname.endsWith('.css');
  assert.ok(css?/^text\/css(?:;|$)/i.test(mimeType??''):/^(?:application|text)\/(?:javascript|x-javascript|ecmascript)(?:;|$)/i.test(mimeType??''),`${url}: wrong content type ${mimeType}`);
  assert.equal(typeof body,'string',`${url}: missing captured response body`);
  assert.ok(!/^\s*(?:<!doctype html|<html)/i.test(body),`${url}: HTML returned as asset`);
}
export function verifyNetworkLog(log){
  const origin=new URL(log.origin).origin, paths=new Set();let resources=0;
  for(const page of log.pages??[]){
    const url=new URL(page.url);assert.equal(url.origin,origin,'Wrong page origin');
    assert.equal(page.documentStatus,200,`${url.pathname}: document is not 200`);paths.add(url.pathname);
    const assets=(page.resources??[]).filter(r=>new URL(r.url).origin===origin&&['Script','Stylesheet'].includes(r.type));
    assert.ok(assets.some(r=>r.type==='Script')&&assets.some(r=>r.type==='Stylesheet'),`${url.pathname}: missing observed scripts/styles`);
    for(const r of assets){assert.ok(r.fromDiskCache===false&&r.fromServiceWorker===false,`${r.url}: explicit fresh browser cache flags required`);verifyAsset(r);resources++;}
  }
  for(const path of priorityPaths)assert.ok(paths.has(path),`Missing page coverage: ${path}`);
  return {pages:paths.size,resources};
}
export async function fetchHtml(url,userAgent){
  const response=await fetch(url,{headers:{'User-Agent':userAgent},signal:AbortSignal.timeout(30000),redirect:'error'});
  assert.equal(response.status,200,`${url}: HTTP ${response.status}`);
  assert.match(response.headers.get('content-type')??'',/text\/html/i,`${url}: not HTML`);
  return response.text();
}
