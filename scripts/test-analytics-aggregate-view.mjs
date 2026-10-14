import test from 'node:test';import assert from 'node:assert/strict';
const mod=await import('../lib/admin-traffic-aggregate-view.mjs').catch(()=>({}));
const request={startDate:'2026-10-01',endDate:'2026-10-14',dimension:'page'};
const now=new Date('2026-10-14T09:00:00Z');
const raw={enabled:true,measurementStartedAt:'2026-10-13T00:00:00Z',maintenanceHealthy:true,thresholded:true,totals:{pageViews:100,visitStarts:80,activeMs:600000},rows:[{key:'home',metrics:{pageViews:30,visitStarts:20,activeMs:60000}},{key:'small',metrics:{pageViews:3,visitStarts:1,activeMs:2000}}]};
test('report totals remain independent of top rows and errors never become zero',()=>{
 assert.equal(typeof mod.normalizeAggregateReport,'function');const reply=mod.normalizeAggregateReport(raw,request,now);assert.equal(reply.status,'ok');assert.equal(reply.data.totals.pageViews,100);assert.equal(reply.meta.thresholded,true);assert.equal(reply.meta.partialToday,true);assert.equal(reply.meta.rowLimit,100);
 assert.equal(mod.normalizeAggregateReport(null,request,now).status,'error');assert.equal(mod.normalizeAggregateReport({...raw,enabled:false},request,now).status,'notConfigured');assert.equal(mod.normalizeAggregateReport({...raw,measurementStartedAt:null},request,now).status,'noData');
 assert.equal(mod.normalizeAggregateReport(raw,{...request,endDate:'2026-10-12'},now).status,'noData');
 assert.equal(mod.normalizeAggregateReport({...raw,rows:Array(101).fill(raw.rows[0])},request,now).status,'error');
});
test('weighted time denominator and CSV retain scope, source, row limit and thresholds',()=>{
 assert.equal(typeof mod.formatAggregateTime,'function');assert.equal(mod.formatAggregateTime(60000,0),'—');assert.equal(mod.formatAggregateTime(60000,2),'30초');
 const csv=mod.buildAggregateCsv(mod.normalizeAggregateReport(raw,request,now),request);for(const text of ['firstParty','Asia/Seoul','2026-10-01','2026-10-14','100','조회당','소량'])assert.ok(csv.includes(text));
});
test('slower earlier report is cancelled and cannot replace the current period',async()=>{
 assert.equal(typeof mod.createAggregateReportLoader,'function');const waiting=[],seen=[];const loader=mod.createAggregateReportLoader((r,signal)=>new Promise(resolve=>waiting.push({r,signal,resolve})));
 const old=loader.load(request,v=>seen.push(v));const latest=loader.load({...request,dimension:'source'},v=>seen.push(v));assert.equal(waiting[0].signal.aborted,true);waiting[1].resolve('new');await latest;waiting[0].resolve('old');await old;assert.deepEqual(seen,['new']);loader.cancel();
});
