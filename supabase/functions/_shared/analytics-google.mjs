const TRAFFIC=['totalUsers','sessions','screenPageViews','userEngagementDuration'];
const EVENTS=['qualification_view','exam_start','exam_complete','sign_up'];
const DIMENSION={channel:'sessionDefaultChannelGroup',source:'sessionSourceMedium',campaign:'sessionCampaignName',landing:'landingPage',page:'pagePath',country:'country',city:'city',device:'deviceCategory',browser:'browser'};
const requestQueue=[];let activeRequests=0;
function limited(task){return new Promise((resolve,reject)=>{requestQueue.push({task,resolve,reject});drain();});}
function drain(){while(activeRequests<2&&requestQueue.length){const item=requestQueue.shift();activeRequests++;Promise.resolve().then(item.task).then(item.resolve,item.reject).finally(()=>{activeRequests--;drain();});}}
function fail(code){throw Object.assign(new Error(`analytics_${code}`),{code});}
export function assertReportCompatible(requested,reply){
  for(const [key,entries,metadata]of [['dimensions',reply.dimensionCompatibilities||[],'dimensionMetadata'],['metrics',reply.metricCompatibilities||[],'metricMetadata']]){
    for(const field of requested[key]||[]){const match=entries.find(item=>item[metadata]?.apiName===field.name);if(match?.compatibility!=='COMPATIBLE')fail('incompatible');}
  }
}
function b64(bytes){return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
function encoded(value){return b64(new TextEncoder().encode(JSON.stringify(value)));}

export function createGoogleAnalyticsClient(config) {
  if(!/^\d+$/.test(config.propertyId)||!config.serviceAccount?.client_email?.endsWith('.gserviceaccount.com'))fail('configuration');
  let token=null,tokenPending=null;
  async function fetchJson(url,init) {
    try {
      return await limited(async()=>{
        const response=await config.fetch(url,{...init,signal:AbortSignal.timeout(10000)});
        if(!response.ok)fail(response.status===401||response.status===403?'permission':response.status===429?'quota':response.status===400?'incompatible':'network');
        return await response.json();
      });
    }catch(error){if(error?.code)throw error;fail('network');}
  }
  async function accessToken() {
    if(token && token.expires>config.now().getTime()+60000)return token.value;
    if(tokenPending)return tokenPending;
    tokenPending=(async()=>{
      try{
        const pem=config.serviceAccount.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,'');
        const key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(pem),x=>x.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
        const iat=Math.floor(config.now().getTime()/1000);
        const message=`${encoded({alg:'RS256',typ:'JWT'})}.${encoded({iss:config.serviceAccount.client_email,scope:'https://www.googleapis.com/auth/analytics.readonly',aud:'https://oauth2.googleapis.com/token',iat,exp:iat+3600})}`;
        const assertion=`${message}.${b64(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(message)))}`;
        const reply=await fetchJson('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}).toString()});
        if(typeof reply.access_token!=='string'||!Number.isFinite(Number(reply.expires_in)))fail('configuration');
        token={value:reply.access_token,expires:config.now().getTime()+Number(reply.expires_in)*1000};return token.value;
      }catch(error){if(error?.code)throw error;fail('configuration');}
    })();
    try{return await tokenPending;}finally{tokenPending=null;}
  }
  async function call(method,body) {
    const value=await accessToken();
    const metadata=method==='metadata';
    return fetchJson(`https://analyticsdata.googleapis.com/v1beta/properties/${config.propertyId}${metadata?'/metadata':':'+method}`,{method:metadata?'GET':'POST',headers:{Authorization:`Bearer ${value}`,'Content-Type':'application/json'},...(metadata?{}:{body:JSON.stringify(body)})});
  }
  return {runReport:body=>call('runReport',body),runRealtimeReport:body=>call('runRealtimeReport',body),getMetadata:()=>call('metadata'),checkCompatibility:body=>call('checkCompatibility',body)};
}

export function buildReportRequests(request) {
  if(request.report==='realtime')return [{kind:'realtime',body:{metrics:[{name:'activeUsers'}],minuteRanges:[{startMinutesAgo:29,endMinutesAgo:0}]}}];
  const filters=[];
  if(request.sourceMedium)filters.push({filter:{fieldName:'sessionSourceMedium',stringFilter:{matchType:'EXACT',value:request.sourceMedium}}});
  if(request.device)filters.push({filter:{fieldName:'deviceCategory',stringFilter:{matchType:'EXACT',value:request.device}}});
  if(request.qualificationSlug){const slug=encodeURIComponent(request.qualificationSlug);filters.push({orGroup:{expressions:[{filter:{fieldName:'pagePath',stringFilter:{matchType:'EXACT',value:`/cbt/${slug}/`}}},{filter:{fieldName:'pagePath',stringFilter:{matchType:'EXACT',value:`/cbt/${slug}/exam/`}}}]}});}
  const base={dateRanges:[{startDate:request.startDate,endDate:request.endDate}]};
  const standard=(dims,metrics,event=false,limit=100)=>{
    const expressions=[...filters];if(event)expressions.push({filter:{fieldName:'eventName',inListFilter:{values:EVENTS}}});
    const dimensionFilter=expressions.length?{andGroup:{expressions}}:undefined;
    return {kind:'standard',body:{...base,dimensions:dims.map(name=>({name})),metrics:metrics.map(name=>({name})),...(dimensionFilter?{dimensionFilter}:{}),limit:String(limit),...(dims.length?{orderBys:[dims.includes('date')?{dimension:{dimensionName:'date'}}:{metric:{metricName:metrics.includes('sessions')?'sessions':metrics[0]},desc:true}]}:{})}};
  };
  if(request.report==='qualifications')return [standard(['customEvent:qualification_slug','eventName'],['eventCount'],true,1500),standard(['eventName'],['eventCount'],true,10)];
  const dimension=request.report==='overview'?'date':request.report==='acquisition'?DIMENSION[request.groupBy||'source']:request.report==='pages'?DIMENSION[request.groupBy||'page']:DIMENSION[request.groupBy||'country'];
  const rows=standard([dimension],TRAFFIC);
  const totals=standard([],TRAFFIC);
  const events=standard([dimension,'eventName'],['eventCount'],true,1000);
  if(request.report==='overview'){
    const count=(Date.parse(request.endDate)-Date.parse(request.startDate))/86400000+1;
    const end=new Date(Date.parse(request.startDate)-86400000).toISOString().slice(0,10);
    const start=new Date(Date.parse(request.startDate)-count*86400000).toISOString().slice(0,10);
    const previous=standard([],TRAFFIC);previous.body.dateRanges=[{startDate:start,endDate:end}];
    return [rows,totals,events,previous];
  }
  return [rows,totals,events,standard(['eventName'],['eventCount'],true,10)];
}

function decodedRows(reply) {
  return (reply?.rows||[]).map(row=>({dimensions:Object.fromEntries((reply.dimensionHeaders||[]).map((header,i)=>[header.name,row.dimensionValues?.[i]?.value||'(not set)'])),metrics:Object.fromEntries((reply.metricHeaders||[]).map((header,i)=>{const value=Number(row.metricValues?.[i]?.value||0);return [header.name,Number.isFinite(value)?value:0];}))}));
}
export function normalizeReports(request,replies,meta) {
  for(const reply of replies){meta.thresholded||=Boolean(reply?.metadata?.subjectToThresholding);meta.dataLossFromOtherRow||=Boolean(reply?.metadata?.dataLossFromOtherRow);if(reply?.metadata?.timeZone)meta.timezone=reply.metadata.timeZone;}
  if(request.report==='realtime')return {rows:[],totals:decodedRows(replies[0])[0]?.metrics||{activeUsers:0}};
  const rows=new Map(),totals=request.report==='qualifications'?{}:decodedRows(replies[1])[0]?.metrics||{};
  function mergeEvents(reply,intoTotals=false) {
    for(const row of decodedRows(reply)) {
      const name=row.dimensions.eventName;if(!EVENTS.includes(name)||(name==='sign_up'&&!meta.signupSupported))continue;
      const dimensions={...row.dimensions};delete dimensions.eventName;
      if(intoTotals)totals[name]=(totals[name]||0)+(row.metrics.eventCount||0);
      else {const key=JSON.stringify(dimensions);if(request.report!=='qualifications'&&!rows.has(key))continue;const item=rows.get(key)||{dimensions,metrics:{}};item.metrics[name]=(item.metrics[name]||0)+(row.metrics.eventCount||0);rows.set(key,item);}
    }
  }
  if(request.report==='qualifications'){mergeEvents(replies[0]);mergeEvents(replies[1],true);}
  else {
    for(const row of decodedRows(replies[0]))rows.set(JSON.stringify(row.dimensions),row);
    mergeEvents(replies[2]);
    if(request.report==='overview')for(const row of decodedRows(replies[2])){const name=row.dimensions.eventName;if(EVENTS.includes(name)&&(name!=='sign_up'||meta.signupSupported))totals[name]=(totals[name]||0)+(row.metrics.eventCount||0);}
    else mergeEvents(replies[3],true);
  }
  const eventReply=replies[request.report==='qualifications'?0:2];
  const eventLimited=Number(eventReply?.rowCount??eventReply?.rows?.length??0)>(eventReply?.rows?.length||0);
  meta.eventCountsLimited=eventLimited;
  if(!eventLimited)for(const row of rows.values())for(const event of EVENTS)if(event!=='sign_up'||meta.signupSupported)row.metrics[event]??=0;
  const sorted=[...rows.values()];if(request.report!=='overview')sorted.sort((a,b)=>request.report==='qualifications'?(b.metrics.exam_start||b.metrics.qualification_view||0)-(a.metrics.exam_start||a.metrics.qualification_view||0):(b.metrics.sessions??0)-(a.metrics.sessions??0));
  return {rows:sorted.slice(0,100),totals,...(request.report==='overview'?{previousTotals:decodedRows(replies[3])[0]?.metrics||{}}:{})};
}
