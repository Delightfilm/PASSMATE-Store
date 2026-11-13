import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {loadAnalyticsTs} from './helpers/load-analytics-ts.mjs';
const {NextRequest}=createRequire(import.meta.url)('next/server');
const {middleware,config}=loadAnalyticsTs('middleware.ts',{Headers});
const sha='a'.repeat(64),path=`/question-bank-content/bundles/jo.json.gz?v=${sha}`;
const request=(path,options={})=>new NextRequest(`https://www.mypassmate.com${path}`,options);
const privateOnly=middleware(request(path,{headers:{cookie:'synthetic-cookie',authorization:'synthetic-auth','x-account-id':'synthetic-private'}}));
assert.equal(privateOnly.headers.get('x-middleware-override-headers'),'accept','An empty header override is ignored by Next; a public default must ensure incoming private headers are removed');
const response=middleware(request(path,{headers:{cookie:'synthetic-cookie',authorization:'synthetic-auth',referer:'https://www.mypassmate.com/history/private',origin:'https://www.mypassmate.com','x-account-id':'synthetic-private','accept-encoding':'gzip, br','if-none-match':'"public-etag"'}}));
assert.equal(response.headers.get('x-middleware-rewrite'),`https://content.mypassmate.com/bundles/jo.json.gz?v=${sha}`,'A versioned public bundle should use the fixed NAS origin behind the site edge');
const override=response.headers.get('x-middleware-override-headers').split(',');
assert.deepEqual([...override].sort(),['accept','accept-encoding','if-none-match']);
assert.equal(response.headers.get('x-middleware-request-accept-encoding'),'gzip, br');
for(const privateName of ['cookie','authorization','referer','origin','x-account-id'])assert.equal(response.headers.get(`x-middleware-request-${privateName}`),null);
assert.equal(response.headers.get('x-vercel-enable-rewrite-caching'),'1');
assert.equal(response.headers.get('cache-control'),null,'Never force errors/private upstream responses into cache');
assert.equal(response.headers.get('x-robots-tag'),'noindex');
assert.equal(JSON.stringify(config.matcher),JSON.stringify(['/question-bank-content/:path*']));
for(const invalid of ['/question-bank-content/catalog.json','/question-bank-content/ai-cache/data',path+'&_retry=x',path+'&v='+sha,path+'&url=https://example.test',path.replace(sha,'legacy'),path.replace('jo.json.gz','jo.json.gz.br'),'/question-bank-content/bundles/%2e%2e%2fprivate.json.gz?v='+sha]){
 const denied=middleware(request(invalid));assert.equal(denied.status,404,invalid);assert.equal(denied.headers.get('cache-control'),'no-store');assert.equal(denied.headers.get('x-middleware-rewrite'),null);
}
assert.equal(middleware(request(path,{method:'POST',body:'synthetic'})).status,405);
assert.ok(middleware(request(path,{method:'HEAD'})).headers.get('x-middleware-rewrite'));
assert.equal(middleware(request('/account/')).headers.get('x-middleware-next'),'1','Unmatched routes retain their existing behavior');

const catalog={schemaVersion:'passmate.question-bank.catalog.v1',releaseId:'release',totals:{questions:0,qualifications:1},qualifications:[{code:'jo',title:'electric',bundle:'bundles/jo.json.gz',sha256:sha,questions:0,exams:0,images:0}]};
const body={schemaVersion:'passmate.question-bank.bundle.v1',releaseId:'release',qualification:{code:'jo'},subjects:[],exams:[],questions:[]};
function adapter(browser,status=200){
 const calls=[];
 const module=loadAnalyticsTs('lib/question-bank-content.ts',{Headers,TextDecoder,process:{env:{NEXT_PUBLIC_QUESTION_BANK_CONTENT_URL:'https://content.mypassmate.com'}},...(browser?{window:{location:{protocol:'https:',hostname:'www.mypassmate.com'}}}:{}),fetch:async(url,options)=>{calls.push({url:String(url),cache:options.cache});return options.cache==='no-store'?Response.json(body):status===200?Response.json(body):new Response('synthetic',{status});}});
 return {...module,calls};
}
const browser=adapter(true);await browser.loadContentBundle(catalog,'jo');assert.equal(browser.calls[0].url,path);
const server=adapter(false);await server.loadContentBundle(catalog,'jo');assert.equal(server.calls[0].url,`https://content.mypassmate.com/bundles/jo.json.gz?v=${sha}`);
const legacy=adapter(true);await legacy.loadContentBundle({...catalog,qualifications:[{...catalog.qualifications[0],sha256:'legacy'}]},'jo');assert.equal(legacy.calls[0].url,'https://content.mypassmate.com/bundles/jo.json.gz');
const fallback=adapter(true,503);await fallback.loadContentBundle(catalog,'jo');assert.equal(fallback.calls.length,2);assert.equal(fallback.calls[1].cache,'no-store');assert.ok(fallback.calls[1].url.startsWith(`https://content.mypassmate.com/bundles/jo.json.gz?v=${sha}&_retry=`));
for(const status of [401,403,429]){const blocked=adapter(true,status);await assert.rejects(blocked.loadContentBundle(catalog,'jo'),new RegExp(String(status)));assert.equal(blocked.calls.length,1);}
console.log('NAS bundle edge PASS: fixed origin, private-header isolation, strict public routing, server/legacy boundary and direct recovery');
