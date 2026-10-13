import {CONSENT_KEY,sanitizePage,sanitizeReferrer,sanitizeCampaign,sanitizeEvent} from './analytics-policy.mjs';

export function createAnalyticsCollector(deps, options) {
  const enabled = options.enabled && /^G-[A-Z0-9]+$/.test(options.measurementId);
  let consent = 'denied', page = null, referrer = '', campaign = {}, ready = false, disposed = false, loading = null, lastNavigation = '', navigation = '', sequence = 0;
  const sent = new Set(),pendingViews=new Map();
  try { if (deps.storage?.getItem(CONSENT_KEY) === 'granted') consent = 'granted'; } catch { /* Storage is optional. */ }
  const active = () => enabled && consent === 'granted' && page && !disposed;
  const safeSend = command => { try { deps.send(command); return true; } catch { return false; } };
  const pageParams = () => ({page_location:page.location,page_title:page.title,page_referrer:referrer});
  const campaignParams = () => Object.fromEntries(Object.entries(campaign).map(([key,value])=>[({utm_source:'campaign_source',utm_medium:'campaign_medium',utm_campaign:'campaign_name',utm_content:'campaign_content',utm_term:'campaign_term'})[key],value]));
  function sendPage() {
    if (!active() || !ready || lastNavigation === navigation) return;
    deps.setDisabled(false);
    safeSend(['set',pageParams()]);
    if (safeSend(['event','page_view',{...pageParams(),...campaignParams()}])) lastNavigation = navigation;
  }
  function ensureReady() {
    if (!active()) { deps.setDisabled(true); return; }
    if (ready) { sendPage(); return; }
    if (loading) return;
    try { loading = Promise.resolve(deps.loadTag()); } catch { deps.setDisabled(true); return; }
    loading.then(() => {
      // Re-read current consent/path; an earlier navigation is never replayed.
      if (!active()) return;
      deps.setDisabled(false);
      safeSend(['js',new Date()]);
      // Global context remains updatable; config-scope values would override it.
      safeSend(['set',pageParams()]);
      safeSend(['config',options.measurementId,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,...campaignParams()}]);
      ready = true;
      sendPage();
      for(const item of pendingViews.values())if(item.navigation===navigation)track(item.name,item.params,item.dedupeKey);
      pendingViews.clear();
      try{deps.onReady?.();}catch{/* Analytics never blocks the site. */}
    }).catch(() => { deps.setDisabled(true); }).finally(() => { loading = null; });
  }
  function track(name,params,dedupeKey) {
    if(!active())return false;
    const event=sanitizeEvent(name,params);
    if(!event||(name!=='sign_up'&&!options.publicQualifications.some(q=>q.slug===event.params.qualification_slug)))return false;
    if(name==='qualification_view'&&event.params.qualification_slug!==page.qualificationSlug)return false;
    const key=name==='qualification_view'?`${sequence}:${name}:${event.params.qualification_slug}`:dedupeKey?`${name}:${dedupeKey}`:null;
    if(key&&sent.has(key))return false;
    if(!ready){if(name==='qualification_view')pendingViews.set(key,{name,params:{...event.params},dedupeKey,navigation});return false;}
    const result=safeSend(['event',event.name,{...event.params,...pageParams()}]);
    if(result&&key){sent.add(key);if(sent.size>1000)sent.delete(sent.values().next().value);}
    return result;
  }
  deps.setDisabled(true);
  return {
    setConsent(value) {
      if (!['granted','denied'].includes(value) || disposed) return;
      consent = value;
      if (value === 'denied') { lastNavigation=''; sent.clear();pendingViews.clear(); deps.setDisabled(true); }
      try { deps.storage?.setItem(CONSENT_KEY,value); } catch { /* Do not affect learning. */ }
      ensureReady();
    },
    visit(rawUrl, rawReferrer) {
      const next = sanitizePage(rawUrl, options.publicQualifications);
      if (!next) { page=null; lastNavigation='';navigation='';pendingViews.clear(); deps.setDisabled(true); return; }
      const nextNavigation=decodeURIComponent(new URL(rawUrl).pathname).replace(/\/$/,'')||'/';
      if(nextNavigation!==navigation){sequence++;pendingViews.clear();}navigation=nextNavigation;
      page=next; referrer=sanitizeReferrer(rawReferrer); campaign=sanitizeCampaign(rawUrl);
      ensureReady();
    },
    track,
    dispose() { disposed=true; page=null; sent.clear();pendingViews.clear(); deps.setDisabled(true); },
  };
}
