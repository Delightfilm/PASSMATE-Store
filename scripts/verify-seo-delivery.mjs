import {canonicalOrigin,priorityPaths,fetchHtml,verifyMetadata,verifyNoIndex} from './seo-verification.mjs';
const base=process.env.SEO_BASE_URL;
if(!base)throw new Error('Set SEO_BASE_URL to the running local production build or an explicitly accessible deployment; this check never silently skips.');
const agents=['SEBot-WA','Yeti/1.1','Google-InspectionTool','Bingbot'];
let checks=0;
for(const agent of agents){for(const path of priorityPaths){
  const html=await fetchHtml(new URL(path,base),agent);verifyMetadata(html,new URL(path,canonicalOrigin));checks++;
}}
for(const path of ['/account/login/','/admin/','/cbt/history/','/cbt/bookmarks/','/cbt/wrong-notes/','/store/',`/cbt/${encodeURIComponent('전기기능사')}/exam/seo-release-check/`]){
  verifyNoIndex(await fetchHtml(new URL(path,base),'SEBot-WA'));checks++;
}
console.log(`SEO delivery PASS: ${checks} raw HTTP responses; 13 priority pages × 4 bots have head metadata; private/store noindex retained`);
