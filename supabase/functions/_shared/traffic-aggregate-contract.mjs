export const TRAFFIC_SOURCES = ['naver','google','daum','bing','social','other','unknown'];
const fields=['pageViews','visitStarts','activeMs'];
const exact=(o,keys)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const validMetrics=m=>exact(m,fields)&&fields.every(k=>Number.isSafeInteger(m[k])&&m[k]>=0)&&m.visitStarts<=m.pageViews;
export function mergeMetrics(a,b){
 const m=Object.fromEntries(fields.map(k=>[k,a[k]+b[k]]));
 if(!validMetrics(m))throw new RangeError('Invalid aggregate counters');return m;
}
const zero=()=>({pageViews:0,visitStarts:0,activeMs:0});
const sum=rows=>rows.reduce((m,r)=>mergeMetrics(m,r.metrics),zero());
const same=(a,b)=>fields.every(k=>a[k]===b[k]);
const pageKey=k=>typeof k==='string'&&(/^(home|cbt)$/.test(k)||/^[qe]:[\p{L}\p{N}-]{1,200}$/u.test(k));
export function parseAggregatePacket(raw,byteLength){
 try{
  if(!Number.isSafeInteger(byteLength)||byteLength<=0||byteLength>8192||!exact(raw,['version','nonce','totals','sources','pages']))return null;
  if(raw.version!==1||typeof raw.nonce!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(raw.nonce)||!validMetrics(raw.totals))return null;
  if(raw.totals.pageViews>20||raw.totals.activeMs>60000||fields.every(k=>raw.totals[k]===0))return null;
  for(const [rows,limit,keyCheck] of [[raw.sources,7,k=>TRAFFIC_SOURCES.includes(k)],[raw.pages,20,pageKey]]){
   if(!Array.isArray(rows)||!rows.length||rows.length>limit||new Set(rows.map(r=>r?.key)).size!==rows.length)return null;
   if(rows.some(r=>!exact(r,['key','metrics'])||!keyCheck(r.key)||!validMetrics(r.metrics)))return null;
   if(!same(sum(rows),raw.totals))return null;
  }
  return structuredClone(raw);
 }catch{return null;}
}
const dateValue=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s?Date.parse(s):NaN;
export function validateAggregateRequest(raw,today){
 if(!exact(raw,['startDate','endDate','dimension'])||!['date','source','page'].includes(raw.dimension))return null;
 const start=dateValue(raw.startDate),end=dateValue(raw.endDate),day=dateValue(today);
 if(![start,end,day].every(Number.isFinite)||start>end||end>day||start<day-89*86400000)return null;
 return {...raw};
}
// Split marginal counters independently to the same target totals. No joint records.
export function splitAggregateBuffer(buffer){
 if(!validMetrics(buffer.totals)||!same(sum(buffer.sources),buffer.totals)||!same(sum(buffer.pages),buffer.totals))throw new RangeError('Invalid aggregate buffer');
 const remaining=structuredClone(buffer),result=[];
 const take=(rows,target)=>{
  const out=[];
  for(const row of rows){
   const m=zero();
   // Starts travel with views; preserve visitStarts <= pageViews in each row.
   m.visitStarts=Math.min(row.metrics.visitStarts,target.visitStarts);m.pageViews=m.visitStarts;
   row.metrics.visitStarts-=m.visitStarts;row.metrics.pageViews-=m.pageViews;target.visitStarts-=m.visitStarts;target.pageViews-=m.pageViews;
   out.push({key:row.key,metrics:m});
  }
  for(let i=0;i<rows.length;i++){
   const available=rows[i].metrics.pageViews-rows[i].metrics.visitStarts;
   const n=Math.min(available,target.pageViews);out[i].metrics.pageViews+=n;rows[i].metrics.pageViews-=n;target.pageViews-=n;
   const ms=Math.min(rows[i].metrics.activeMs,target.activeMs);out[i].metrics.activeMs+=ms;rows[i].metrics.activeMs-=ms;target.activeMs-=ms;
  }
  return out.filter(r=>fields.some(k=>r.metrics[k]>0));
 };
 while(fields.some(k=>remaining.totals[k]>0)){
  const totals={pageViews:Math.min(20,remaining.totals.pageViews),visitStarts:Math.min(20,remaining.totals.visitStarts),activeMs:Math.min(60000,remaining.totals.activeMs)};
  const sources=take(remaining.sources,{...totals}),pages=take(remaining.pages,{...totals});
  const part={totals,sources,pages};
  if(pages.length>20||new TextEncoder().encode(JSON.stringify({version:1,nonce:'00000000-0000-4000-8000-000000000000',...part})).length>8192)throw new RangeError('Aggregate key capacity exceeded');
  result.push(part);for(const k of fields)remaining.totals[k]-=totals[k];
 }
 return result;
}
