import assert from 'node:assert/strict';
import {memberFixtureDatabase,fixtureMemberReport,adminId,memberId} from './fixtures/admin-members-db.mjs';
import {memberPeriod,normalizeMemberReport} from '../lib/admin-members.mjs';
const db=await memberFixtureDatabase();
try{
  const period=memberPeriod(30);
  const summary=await fixtureMemberReport(db,{view:'summary',...period});
  assert.equal(summary.totals.totalMembers,27);
  assert.equal(summary.totals.joinedInPeriod,27);
  assert.equal(normalizeMemberReport(summary,{view:'summary',...period}).data.trend.length,30);
  const list=await fixtureMemberReport(db,{view:'members',...period});
  assert.equal(list.total,27);assert.equal(list.rows.length,20);
  const next=await fixtureMemberReport(db,{view:'members',...period,page:2});
  assert.equal(next.rows.length,7);assert.equal(new Set([...list.rows,...next.rows].map(row=>row.id)).size,27);
  assert.equal((await fixtureMemberReport(db,{view:'members',...period,query:'_%'})).total,1);
  assert.equal((await fixtureMemberReport(db,{view:'members',...period,query:"' OR true --"})).total,0);
  const google=await fixtureMemberReport(db,{view:'members',...period,provider:'google'});
  assert.equal(google.total,13);assert.ok(google.rows.every(row=>row.providers.includes('google')));
  const oneDay=memberPeriod(1);const joined=await fixtureMemberReport(db,{view:'members',...oneDay,periodOnly:true});
  assert.equal(joined.total,summary.totals.joinedToday);
  const detail=await fixtureMemberReport(db,{view:'detail',...period,memberId});
  assert.equal(detail.learning.averageScore,80);assert.equal(detail.learning.starts,3);assert.equal(detail.learning.completed,2);
  assert.equal(detail.learning.wrongNotes,4);assert.equal(detail.learning.bookmarks,3);
  const nasOnly=list.rows.find(row=>row.id!==memberId&&row.id!==adminId).id;
  await db.query('insert into question_bank_user_question_state values($1,$2,1,true,false,$3)',[nasOnly,'nas:only','']);
  const nasDetail=await fixtureMemberReport(db,{view:'detail',...period,memberId:nasOnly});
  assert.equal(nasDetail.learning.wrongNotes,1);assert.equal(nasDetail.learning.bookmarks,1);
  assert.ok(!JSON.stringify(detail).includes('DO_NOT_EXPOSE'));
  assert.equal((await fixtureMemberReport(db,{view:'detail',...period,memberId:'00000000-0000-0000-0000-000000000000'})).member,null);
  await assert.rejects(()=>fixtureMemberReport(db,{view:'members',...period},memberId),/admin_required/);
  for(const role of ['anon','authenticated']){
    await db.exec('set role '+role);
    await assert.rejects(()=>fixtureMemberReport(db,{view:'members',...period}),/permission denied/);
    await db.exec('reset role');
  }
  await db.exec('set role service_role');
  assert.equal((await fixtureMemberReport(db,{view:'summary',...period},adminId)).totals.totalMembers,27);
  await db.exec('reset role');
  // Place a signup one millisecond before KST midnight; it must not count today.
  const yesterdayEnd=Date.parse(oneDay.endDate+'T00:00:00+09:00')-1;
  await db.query('update auth.users set created_at=$1 where id=$2',[new Date(yesterdayEnd).toISOString(),memberId]);
  const shifted=await fixtureMemberReport(db,{view:'summary',...period});
  assert.equal(shifted.totals.joinedToday,summary.totals.joinedToday-1);
  assert.equal(shifted.totals.joinedInPeriod,summary.totals.joinedInPeriod);
  console.log('PASS: actual PostgreSQL migration, current-member counts, KST midnight, literal search, linked providers, pagination, detail, no metadata leakage, guest/customer denial, designated-admin check, service-only permission. Local disposable fixtures only.');
}finally{await db.close();}
