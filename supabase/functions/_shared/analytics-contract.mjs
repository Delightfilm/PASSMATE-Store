export const REPORT_GROUPS = {
  overview: [], acquisition: ['channel','source','campaign'], pages:['landing','page'],
  qualifications:[], environment:['country','city','device','browser'], realtime:[],
};
export function propertyToday(now, timezone) {
  return new Intl.DateTimeFormat('en-CA', {timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
function invalid() { throw new Error('invalid_analytics_request'); }
export function validateAnalyticsRequest(input, now, timezone) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !Object.hasOwn(REPORT_GROUPS,input.report)) invalid();
  const keys = ['report','startDate','endDate','sourceMedium','qualificationSlug','device','groupBy'];
  if (Object.keys(input).some(key => !keys.includes(key))) invalid();
  if (input.report === 'realtime') { if (Object.keys(input).length !== 1) invalid(); return {report:'realtime'}; }
  for (const key of ['startDate','endDate']) {
    if (typeof input[key] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input[key])) invalid();
    const date = new Date(input[key] + 'T00:00:00Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== input[key]) invalid();
  }
  const days = (Date.parse(input.endDate)-Date.parse(input.startDate))/86400000 + 1;
  if (days < 1 || days > 90 || input.endDate > propertyToday(now, timezone)) invalid();
  if (input.device !== undefined && !['desktop','mobile','tablet'].includes(input.device)) invalid();
  if (input.sourceMedium !== undefined && (typeof input.sourceMedium !== 'string' || !input.sourceMedium.trim() || input.sourceMedium.length > 100 || /[\x00-\x1f]/.test(input.sourceMedium))) invalid();
  if (input.qualificationSlug !== undefined && (typeof input.qualificationSlug !== 'string' || !/^[\p{L}\p{N}-]{1,200}$/u.test(input.qualificationSlug))) invalid();
  if (input.groupBy !== undefined && !REPORT_GROUPS[input.report].includes(input.groupBy)) invalid();
  return Object.fromEntries(keys.filter(key => input[key] !== undefined).map(key => [key,input[key]]));
}
export function makeCacheKey(propertyId, request) {
  return JSON.stringify(['v1',propertyId,...['report','startDate','endDate','sourceMedium','qualificationSlug','device','groupBy'].map(key=>request[key]??null)]);
}
