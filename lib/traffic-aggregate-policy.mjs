export const BASIC_CHOICE_KEY='passmate.analytics.basic.v1';
export function trafficPageKey(pathname,qualifications){
 try{
  if(typeof pathname!=='string'||!pathname.startsWith('/')||/[?#\\]/.test(pathname))return null;
  const path=decodeURIComponent(pathname).replace(/\/$/,'')||'/';
  if(path==='/')return 'home';if(path==='/cbt')return 'cbt';
  const m=path.match(/^\/cbt\/([^/]+)(?:\/exam\/[^/]+)?$/u);
  if(!m||!qualifications.some(q=>q.slug===m[1]))return null;
  return `${path.includes('/exam/')?'e':'q'}:${m[1]}`;
 }catch{return null;}
}
export function verifyTrafficPageKeys(packet,qualifications){
 const slugs=new Set(qualifications.map(q=>q.slug));
 return packet.pages.every(r=>['home','cbt'].includes(r.key)||(/^[qe]:/.test(r.key)&&slugs.has(r.key.slice(2))));
}
const domains={naver:['naver.com','naver.me'],google:['google.com','google.co.kr'],daum:['daum.net'],bing:['bing.com'],social:['facebook.com','instagram.com','youtube.com','youtu.be','twitter.com','x.com','t.co','threads.net','kakao.com']};
export function classifyTrafficSource(referrer,siteOrigin){
 try{
  const url=new URL(referrer);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.origin===siteOrigin)return 'unknown';
  const host=url.hostname.toLowerCase();
  for(const [source,hosts] of Object.entries(domains))if(hosts.some(d=>host===d||host.endsWith('.'+d)))return source;
  return 'other';
 }catch{return 'unknown';}
}
export function resolveTrafficChoice({legacyConsent=null,basicChoice=null,gpc=false,storageReadable=true}){
 if(gpc||!storageReadable||![null,'granted','denied'].includes(legacyConsent)||![null,'on','off'].includes(basicChoice)||basicChoice==='off')return {basic:false,ga4:false};
 return {basic:basicChoice==='on'||legacyConsent!=='denied',ga4:legacyConsent==='granted'};
}
