const DAY=86400000;
const isoDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const count=value=>Number.isSafeInteger(value)&&value>=0;
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const providers=['email','google','kakao'];
export function memberPeriod(days,now=new Date()){
  const endDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  return {startDate:new Date(Date.parse(endDate)-(days-1)*DAY).toISOString().slice(0,10),endDate};
}
export function parseMemberRequest(raw,now=new Date()){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!['view','startDate','endDate','query','provider','page','periodOnly','memberId'].includes(k)))return null;
  const {view,startDate,endDate}=raw;
  if(!['summary','members','detail'].includes(view)||!isoDate(startDate)||!isoDate(endDate)||endDate<startDate||endDate>memberPeriod(1,now).endDate||Date.parse(endDate)-Date.parse(startDate)>89*DAY)return null;
  if(raw.query!==undefined&&(typeof raw.query!=='string'||raw.query.length>100||/[\u0000-\u001f]/.test(raw.query)))return null;
  if(raw.provider!==undefined&&!['all',...providers].includes(raw.provider))return null;
  if(raw.page!==undefined&&(!Number.isInteger(raw.page)||raw.page<1||raw.page>100000))return null;
  if(raw.periodOnly!==undefined&&typeof raw.periodOnly!=='boolean')return null;
  if(view==='detail'&&!uuid(raw.memberId))return null;
  return {view,startDate,endDate,query:raw.query?.trim()||'',provider:raw.provider||'all',page:raw.page||1,periodOnly:raw.periodOnly||false,...(view==='detail'?{memberId:raw.memberId}:{})};
}
function member(raw){
  if(!raw||!uuid(raw.id)||typeof raw.displayName!=='string'||[...raw.displayName].length>200||!(raw.email===null||typeof raw.email==='string'&&raw.email.length<=320)||!Number.isFinite(Date.parse(raw.createdAt))||!(raw.lastSignInAt===null||Number.isFinite(Date.parse(raw.lastSignInAt)))||typeof raw.emailConfirmed!=='boolean'||!Array.isArray(raw.providers)||raw.providers.some(p=>typeof p!=='string'||p.length>50))throw Error('invalid_member');
  return {id:raw.id,displayName:raw.displayName,email:raw.email,createdAt:raw.createdAt,lastSignInAt:raw.lastSignInAt,providers:[...new Set(raw.providers)],emailConfirmed:raw.emailConfirmed};
}
export function normalizeMemberReport(raw,request,now=new Date()){
  let data;
  if(request.view==='summary'){
    const keys=['totalMembers','joinedToday','joined7Days','joinedInPeriod','confirmedMembers'];
    if(!raw?.totals||keys.some(k=>!count(raw.totals[k])||raw.totals[k]>raw.totals.totalMembers)||!Array.isArray(raw.trend)||raw.trend.length>90)throw Error('invalid_summary');
    const byDate=new Map();for(const row of raw.trend){if(!isoDate(row.date)||row.date<request.startDate||row.date>request.endDate||!count(row.count)||byDate.has(row.date))throw Error('invalid_trend');byDate.set(row.date,row.count);}
    if([...byDate.values()].reduce((a,b)=>a+b,0)!==raw.totals.joinedInPeriod)throw Error('invalid_trend_total');
    const trend=[];for(let date=Date.parse(request.startDate);date<=Date.parse(request.endDate);date+=DAY){const key=new Date(date).toISOString().slice(0,10);trend.push({date:key,count:byDate.get(key)||0});}
    data={totals:Object.fromEntries(keys.map(k=>[k,raw.totals[k]])),trend};
  }else if(request.view==='members'){
    if(!raw||!count(raw.total)||!Number.isInteger(raw.page)||raw.page!==(request.page||1)||!Array.isArray(raw.rows)||raw.rows.length>20||raw.rows.length>raw.total)throw Error('invalid_list');
    data={total:raw.total,page:raw.page,pageSize:20,rows:raw.rows.map(member)};
  }else{
    if(raw?.member===null)data={member:null,learning:null};
    else{
      const keys=['starts','completed','wrongNotes','bookmarks'];
      if(!raw?.learning||keys.some(k=>!count(raw.learning[k]))||raw.learning.completed>raw.learning.starts||!(raw.learning.averageScore===null||Number.isFinite(raw.learning.averageScore)&&raw.learning.averageScore>=0&&raw.learning.averageScore<=100))throw Error('invalid_learning');
      const safeMember=member(raw.member);if(safeMember.id!==request.memberId)throw Error('invalid_member_id');
      data={member:safeMember,learning:{...Object.fromEntries(keys.map(k=>[k,raw.learning[k]])),averageScore:raw.learning.averageScore}};
    }
  }
  return {status:'ok',view:request.view,data,meta:{timezone:'Asia/Seoul',fetchedAt:now.toISOString()}};
}
