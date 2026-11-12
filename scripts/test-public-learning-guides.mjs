import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadAnalyticsTs} from './helpers/load-analytics-ts.mjs';

process.env.__NEXT_TRAILING_SLASH='true';
assert.ok(fs.existsSync(new URL('../app/cbt/[certSlug]/guide/page.tsx',import.meta.url)), 'Public guides must have a server-rendered route');
const {learningGuides,learningGuideHref}=loadAnalyticsTs('lib/public-learning-guides.ts');
const route=loadAnalyticsTs('app/cbt/[certSlug]/guide/page.tsx');
const sitemap=loadAnalyticsTs('app/sitemap.ts').default();
const robots=loadAnalyticsTs('app/robots.ts').default();
assert.ok(Array.isArray(robots.rules),'Search and training crawler policies must be separate');
const trainer=robots.rules.find(rule=>rule.userAgent==='GPTBot');
const search=robots.rules.find(rule=>rule.userAgent==='OAI-SearchBot');
assert.equal(trainer?.disallow,'/');
assert.equal(search?.allow,'/');
assert.ok(search.disallow.includes('/api/') && search.disallow.includes('/admin/'),'Explicit search bot rule must retain private exclusions');
assert.equal(learningGuides.length,3);
assert.equal(new Set(learningGuides.flatMap(g=>g.examples.map(e=>e.id))).size,9);
for(const guide of learningGuides){
 const params=Promise.resolve({certSlug:encodeURIComponent(guide.slug)});
 const html=renderToStaticMarkup(await route.default({params}));
 const structured=[...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(match=>JSON.parse(match[1]));
 const breadcrumb=structured.find(item=>item['@type']==='BreadcrumbList');
 assert.ok(breadcrumb,'Visible learning-guide navigation needs a machine-readable breadcrumb');
 assert.equal(breadcrumb['@context'],'https://schema.org');
 assert.equal(breadcrumb.itemListElement.length,3);
 assert.deepEqual(Array.from(breadcrumb.itemListElement,item=>item.position),[1,2,3]);
 assert.ok(breadcrumb.itemListElement.every(item=>item['@type']==='ListItem' && item.name && item.item.startsWith('https://www.mypassmate.com/')));
 assert.equal(breadcrumb.itemListElement[0].item,'https://www.mypassmate.com/cbt/');
 assert.equal(breadcrumb.itemListElement[1].item,`https://www.mypassmate.com/cbt/${encodeURIComponent(guide.slug)}/`);
 assert.equal(breadcrumb.itemListElement[2].item,`https://www.mypassmate.com${learningGuideHref(guide.slug)}`);
 assert.equal(breadcrumb.itemListElement[2].name,'학습 안내');
 assert.ok(html.includes(`<h1>${guide.title}</h1>`));
 assert.ok(html.includes('자체 제작'));
 assert.ok(html.includes('2026-11-12'));
 assert.ok(html.includes(`/cbt/${encodeURIComponent(guide.slug)}/`),'Guide must lead to its actual practice page');
 assert.equal(guide.examples.length,3);
 for(const example of guide.examples){
  assert.ok(html.includes(`id="${example.id}"`));
  assert.ok(html.includes(example.answer));
  assert.ok(example.steps.length>=2);
  assert.ok(example.sourceIds.every(id=>guide.sources.some(s=>s.id===id)));
 }
 const meta=await route.generateMetadata({params});
 assert.equal(meta.alternates.canonical,`https://www.mypassmate.com${learningGuideHref(guide.slug)}`);
 assert.equal(sitemap.filter(e=>e.url===meta.alternates.canonical).length,1);
 assert.ok(!/noindex|문제 데이터를 불러오지 못/.test(html));
}
for(const slug of ['missing-guide','jo','제과기능사','%E0%A4%A']){
 await assert.rejects(route.default({params:Promise.resolve({certSlug:slug})}),e=>e.digest==='NEXT_HTTP_ERROR_FALLBACK;404');
}
// Independently recompute the authored examples, including units/ideal-model assumptions.
const values=Object.fromEntries(learningGuides.flatMap(g=>g.examples.map(e=>[e.id,e.result])));
for(const [id,value,unit] of [
 ['electric-ohm',120/20,'A'],['electric-parallel',1/(1/12+1/6),'Ω'],['electric-energy',(230**2/46)/1000*0.5,'kWh'],
 ['forklift-hydraulic',120*(10/2),'N'],['forklift-moment',100*2,'N·m'],['forklift-work',(1000*0.2)/5,'W'],
 ['audio-level',20*Math.log10(3),'dB'],['audio-sampling',48000-30000,'Hz'],['audio-delay',10.29/343*1000,'ms'],
]){assert.ok(Math.abs(values[id].value-value)<0.01,`${id}: independently checked value`);assert.equal(values[id].unit,unit);}
console.log('Public learning guides PASS: 3 cold-rendered guides, 9 examples, canonical/sitemap, real404 and numerical/unit cross-checks');
