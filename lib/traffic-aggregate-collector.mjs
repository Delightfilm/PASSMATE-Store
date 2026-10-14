import {mergeMetrics,splitAggregateBuffer} from '../supabase/functions/_shared/traffic-aggregate-contract.mjs';
import {trafficPageKey,classifyTrafficSource} from './traffic-aggregate-policy.mjs';
const zero=()=>({pageViews:0,visitStarts:0,activeMs:0});
const empty=()=>({totals:zero(),sources:[],pages:[]});
export function createTrafficAggregateCollector({now,send,randomNonce,onError=()=>{}},{enabled,publicQualifications,choice}){
 let allowed=enabled&&choice.basic,disposed=false,page=null,source=null,visible=false,focused=false,observed=now(),lastActivity=null,buffer=empty(),bufferSince=null,queue=[],flight=null,generation=0;
 const running=()=>allowed&&!disposed;
 function clear(){buffer=empty();bufferSince=null;queue=[];page=null;lastActivity=null;generation++;}
 function expire(){if(bufferSince!==null&&now()-bufferSince>300000){buffer=empty();bufferSince=null;}queue=queue.filter(q=>now()-q.at<=300000);}
 function add(delta){
  if(!running()||!page)return;expire();
  let row=buffer.pages.find(r=>r.key===page);
  if(!row&&buffer.pages.length>=20){void flush();return;}
  bufferSince??=now();if(!row){row={key:page,metrics:zero()};buffer.pages.push(row);}
  let referral=buffer.sources.find(r=>r.key===source);if(!referral){referral={key:source||'unknown',metrics:zero()};buffer.sources.push(referral);}
  row.metrics=mergeMetrics(row.metrics,delta);referral.metrics=mergeMetrics(referral.metrics,delta);buffer.totals=mergeMetrics(buffer.totals,delta);
 }
 function sample(){
  const time=now(),delta=time-observed;observed=time;
  if(running()&&page&&visible&&focused&&delta>=0&&delta<=10000){const ms=Math.floor(delta);if(ms>0)add({pageViews:0,visitStarts:0,activeMs:ms});lastActivity=time;}
 }
 function newView(){const start=lastActivity===null||now()-lastActivity>=1800000;add({pageViews:1,visitStarts:start?1:0,activeMs:0});lastActivity=now();}
 function navigate(pathname,referrer){
  sample();source??=classifyTrafficSource(referrer,'https://www.mypassmate.com');
  const next=running()?trafficPageKey(pathname,publicQualifications):null;
  if(next===page)return;void flush();page=next;if(page)newView();observed=now();
 }
 function setActivity(activity){
  const was=visible&&focused;sample();visible=activity.visible;focused=activity.focused;
  if(!was&&visible&&focused&&running()&&page&&lastActivity!==null&&now()-lastActivity>=1800000)newView();
  observed=now();
 }
 function setChoice(next){const nextAllowed=enabled&&next.basic;if(!nextAllowed){allowed=false;clear();}else if(!allowed){allowed=true;observed=now();}}
 async function flush(){
  sample();expire();if(!running())return;if(flight)return flight;
  if(!queue.length&&bufferSince!==null){
   try{queue=splitAggregateBuffer(buffer).map(b=>({packet:{version:1,nonce:randomNonce(),...b},at:bufferSince}));}catch{onError();}
   buffer=empty();bufferSince=null;
  }
  if(!queue.length)return;
  const currentGeneration=generation;let successful=false;
  flight=(async()=>{
   while(queue.length&&running()&&currentGeneration===generation){
    const item=queue[0];if(now()-item.at>300000){queue.shift();continue;}
    let ok=false;try{ok=await send(structuredClone(item.packet));}catch{onError();}
    if(!running()||currentGeneration!==generation)return;
    if(!ok)return;queue.shift();successful=true;
   }
  })();
  try{await flight;}finally{flight=null;}
  if(successful&&running()&&currentGeneration===generation&&!queue.length&&bufferSince!==null)await flush();
 }
 return {navigate,setActivity,setChoice,tick:sample,flush,dispose(){allowed=false;disposed=true;clear();}};
}
