import test from 'node:test';import assert from 'node:assert/strict';
const proxyModule=await import('../lib/traffic-aggregate-server.mjs').catch(()=>({}));
const edgeModule=await import('../supabase/functions/_shared/traffic-aggregate-handlers.mjs').catch(()=>({}));
const m={pageViews:1,visitStarts:1,activeMs:1000};
const p={version:1,nonce:'12345678-1234-4123-8123-123456789012',totals:m,sources:[{key:'unknown',metrics:m}],pages:[{key:'home',metrics:m}]};
const cfg={enabled:true,supabaseUrl:'https://example.supabase.co',apiKey:'publishable',ingestToken:'test-server-only',allowedOrigins:['https://www.mypassmate.com']};
const request=(body=p,headers={})=>new Request('https://www.mypassmate.com/api/analytics/aggregate',{method:'POST',headers:{origin:'https://www.mypassmate.com','content-type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)});
function setup(){assert.equal(typeof proxyModule.createTrafficAggregateProxy,'function');const sent=[];const proxy=proxyModule.createTrafficAggregateProxy({getConfig:()=>cfg,publicQualifications:[{slug:'전기기능사'}],forward:async(url,options)=>{sent.push({url,...options});return new Response(null,{status:204});}});return {proxy,sent};}
test('rejects origin, fetch-site, content type, private fields and noncatalog pages before upstream',async()=>{
 const {proxy,sent}=setup();
 for(const [req,status] of [[request(p,{origin:''}),403],[request(p,{origin:'https://evil.test'}),403],[request(p,{'sec-fetch-site':'cross-site'}),403],[request(p,{'content-type':'text/plain'}),415],[request({...p,email:'hidden'}),400],[request({...p,pages:[{key:'q:미등록',metrics:m}]}),400],[request('x'.repeat(8193)),413]])assert.equal((await proxy(req)).status,status);
 assert.equal(sent.length,0);
});
test('forwards only aggregate payload and scoped server headers without client identity',async()=>{
 const {proxy,sent}=setup();const r=await proxy(request(p,{cookie:'secret','authorization':'Bearer member','referer':'https://private.test','x-forwarded-for':'1.2.3.4','user-agent':'private'}));
 assert.equal(r.status,204);assert.equal(r.headers.has('set-cookie'),false);
 assert.deepEqual(Object.keys(sent[0].headers).sort(),['Content-Type','apikey','x-passmate-aggregate-token'].sort());
 assert.deepEqual(JSON.parse(sent[0].body),p);assert.equal(sent[0].credentials,'omit');assert.equal(sent[0].referrerPolicy,'no-referrer');
});
test('unavailable upstream cannot expose response body or silently claim success',async()=>{
 assert.equal(typeof proxyModule.createTrafficAggregateProxy,'function');const proxy=proxyModule.createTrafficAggregateProxy({getConfig:()=>cfg,publicQualifications:[],forward:async()=>new Response('secret',{status:500})});const r=await proxy(request());assert.equal(r.status,503);assert.equal(await r.text(),'');
});
test('Edge authenticates scoped token before RPC and hashes nonce without storing payload metadata',async()=>{
 assert.equal(typeof edgeModule.createTrafficIngestHandler,'function');const calls=[];const handler=edgeModule.createTrafficIngestHandler({getConfig:()=>cfg,sha256:async n=>'hashed:'+n,ingest:async(d,packet)=>{calls.push({d,packet});return true;}});
 assert.equal((await handler(request())).status,403);assert.equal(calls.length,0);
 assert.equal((await handler(request(p,{'x-passmate-aggregate-token':cfg.ingestToken}))).status,204);assert.equal(calls.length,1);assert.equal(calls[0].d,'hashed:'+p.nonce);
});
test('stream limit is enforced even when content-length is absent',async()=>{
 const {proxy,sent}=setup();const req=new Request('https://www.mypassmate.com/api/analytics/aggregate',{method:'POST',headers:{origin:'https://www.mypassmate.com','content-type':'application/json'},duplex:'half',body:new ReadableStream({start(c){c.enqueue(new Uint8Array(4000));c.enqueue(new Uint8Array(5000));c.close();}})});
 assert.equal((await proxy(req)).status,413);assert.equal(sent.length,0);
});
