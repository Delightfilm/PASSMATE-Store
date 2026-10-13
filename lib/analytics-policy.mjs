const ORIGIN = 'https://www.mypassmate.com';
const TOKEN = /^[\p{L}\p{N}_.-]{1,100}$/u;
export const CONSENT_KEY = 'passmate.analytics.consent.v1';

export function sanitizePage(rawUrl, publicQualifications) {
  try {
    const url = new URL(rawUrl);
    if (url.origin !== ORIGIN || url.username || url.password) return null;
    const path = decodeURIComponent(url.pathname).replace(/\/$/, '') || '/';
    if (path === '/') return { location: `${ORIGIN}/`, title: 'PASSMATE' };
    if (path === '/cbt') return { location: `${ORIGIN}/cbt/`, title: 'PASSMATE 문제은행' };
    const match = path.match(/^\/cbt\/([^/]+)(?:\/exam\/([^/]+))?$/u);
    if (!match) return null;
    const qualification = publicQualifications.find(item => item.slug === match[1]);
    if (!qualification) return null;
    return { location: `${ORIGIN}/cbt/${encodeURIComponent(qualification.slug)}/${match[2] ? 'exam/' : ''}`, title: qualification.title + (match[2] ? ' 문제풀이' : ''), qualificationSlug: qualification.slug };
  } catch { return null; }
}

export function sanitizeReferrer(raw) {
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.origin === ORIGIN) return '';
    return url.origin + '/';
  } catch { return ''; }
}

export function sanitizeCampaign(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return Object.fromEntries(['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].flatMap(key => {
      const value = url.searchParams.get(key);
      return value && TOKEN.test(value) && !/\d{7,}/.test(value) ? [[key, value]] : [];
    }));
  } catch { return {}; }
}

export function sanitizeEvent(name, params) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return null;
  const allowed = name === 'sign_up' ? ['method'] : ['qualification_slug','qualification_field','qualification_grade','learning_method','question_count_bucket'];
  if (!['qualification_view','exam_start','exam_complete','sign_up'].includes(name) || Object.keys(params).some(key => !allowed.includes(key))) return null;
  if (name === 'sign_up') return ['email','google','kakao'].includes(params.method) ? {name,params:{method:params.method}} : null;
  if (typeof params.qualification_slug !== 'string' || !/^[\p{L}\p{N}-]{1,200}$/u.test(params.qualification_slug)) return null;
  if (params.learning_method !== undefined && !['past','mock','custom','retry'].includes(params.learning_method)) return null;
  if (params.question_count_bucket !== undefined && !['1-20','21-40','41-60','61-plus'].includes(params.question_count_bucket)) return null;
  if (params.qualification_field !== undefined && !['electrical','forklift','stage_audio','stage_machinery','stage_lighting','other'].includes(params.qualification_field)) return null;
  if (params.qualification_grade !== undefined && !['1','2','3','none'].includes(params.qualification_grade)) return null;
  return { name, params: { ...params } };
}
