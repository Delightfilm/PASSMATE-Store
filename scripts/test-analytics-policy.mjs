import test from 'node:test';
import assert from 'node:assert/strict';

const policy = await import('../lib/analytics-policy.mjs').catch(() => ({}));
const contract = await import('../supabase/functions/_shared/analytics-contract.mjs').catch(() => ({}));
const catalog = [{slug:'전기기능사',title:'전기기능사'},{slug:'무대음향-1급',title:'무대음향 1급'}];
const base = 'https://www.mypassmate.com';
function api(mod, name) { assert.equal(typeof mod[name], 'function', `${name} must implement the safety contract`); return mod[name]; }

test('policy rejects private and malformed paths without leaking original URL', () => {
  const sanitize = api(policy,'sanitizePage');
  for (const path of ['/admin/','/account/oauth-callback/?code=secret','/api/cbt/','/cbt/history/','/cbt/bookmarks/','/cbt/wrong-notes/','/cbt/unknown/','/cbt/%E0%A4%A/']) assert.equal(sanitize(base+path,catalog),null,path);
  assert.equal(sanitize('https://other.test/',catalog),null);
  assert.equal(sanitize('javascript:alert(1)',catalog),null);
});
test('policy normalizes exam paths and removes attempt IDs, queries and fragments', () => {
  const sanitize = api(policy,'sanitizePage');
  const slug=encodeURIComponent('전기기능사');
  assert.deepEqual(sanitize(`${base}/cbt/${slug}/exam/attempt-secret/?email=secret#token`,catalog),{location:`${base}/cbt/${slug}/exam/`,title:'전기기능사 문제풀이',qualificationSlug:'전기기능사'});
  assert.deepEqual(sanitize(`${base}/cbt/전기기능사/?tab=mock`,catalog),{location:`${base}/cbt/${slug}/`,title:'전기기능사',qualificationSlug:'전기기능사'});
  assert.equal(sanitize(base+'/%2Fadmin/',catalog),null);
});
test('campaign and referrer filtering discards sensitive arbitrary text', () => {
  const campaign=api(policy,'sanitizeCampaign'), referrer=api(policy,'sanitizeReferrer');
  assert.deepEqual(campaign(base+'/?utm_source=naver&utm_campaign=무대1급&utm_term=test%40example.com&utm_content=01012345678&code=token'),{utm_source:'naver',utm_campaign:'무대1급'});
  assert.equal(referrer('https://search.naver.com/search?q=email#code'),'https://search.naver.com/');
  assert.equal(referrer(base+'/account/?code=secret'),'');
  assert.equal(referrer('not-a-url'),'');
});
test('events reject unknown names and extra PII instead of passing through', () => {
  const event=api(policy,'sanitizeEvent');
  assert.equal(event('exam_start',{qualification_slug:'전기기능사',email:'test@example.com'}),null);
  assert.equal(event('arbitrary_event',{}),null);
  assert.equal(event('exam_start',{qualification_slug:'전기기능사',question_count_bucket:'0'}),null);
  assert.deepEqual(event('exam_start',{qualification_slug:'전기기능사',learning_method:'past',question_count_bucket:'41-60'}),{name:'exam_start',params:{qualification_slug:'전기기능사',learning_method:'past',question_count_bucket:'41-60'}});
});
test('server validates actual calendar bounds, report filters and forbidden provider inputs', () => {
  const validate=api(contract,'validateAnalyticsRequest');
  const now=new Date('2026-10-13T12:00:00Z');
  const valid={report:'overview',startDate:'2026-10-01',endDate:'2026-10-13'};
  assert.deepEqual(validate(valid,now,'Asia/Seoul'),valid);
  for(const bad of [{...valid,startDate:'2026-02-30'},{...valid,endDate:'2026-10-14'},{...valid,startDate:'2026-01-01'},{...valid,propertyId:'other'},{...valid,metrics:['secret']},{report:'realtime',device:'mobile'},{...valid,groupBy:'country'},{...valid,device:'watch'}]) assert.throws(()=>validate(bad,now,'Asia/Seoul'),/invalid/i);
  assert.deepEqual(validate({report:'realtime'},now,'Asia/Seoul'),{report:'realtime'});
});
test('cache keys isolate property and filters but normalize input ordering', () => {
  const key=api(contract,'makeCacheKey');
  const a={report:'overview',startDate:'2026-10-01',endDate:'2026-10-13'};
  assert.equal(key('123',a),key('123',{endDate:a.endDate,report:a.report,startDate:a.startDate}));
  assert.notEqual(key('123',a),key('456',a));
  assert.notEqual(key('123',a),key('123',{...a,device:'mobile'}));
});
