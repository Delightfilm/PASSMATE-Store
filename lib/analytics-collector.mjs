import {CONSENT_KEY,sanitizePage,sanitizeReferrer,sanitizeCampaign,sanitizeEvent} from './analytics-policy.mjs';

export function createAnalyticsCollector(deps, options) {
  const enabled = options.enabled && /^G-[A-Z0-9]+$/.test(options.measurementId);
  let consent = 'denied', page = null, referrer = '', campaign = {}, ready = false, disposed = false, loading = null, lastLocation = '';
  const sent = new Set();
  try { if (deps.storage?.getItem(CONSENT_KEY) === 'granted') consent = 'granted'; } catch { /* Storage is optional. */ }
  const active = () => enabled && consent === 'granted' && page && !disposed;
  const safeSend = command => { try { deps.send(command); return true; } catch { return false; } };
  const pageParams = () => ({page_location:page.location,page_title:page.title,page_referrer:referrer});
  const campaignParams = () => Object.fromEntries(Object.entries(campaign).map(([key,value])=>[({utm_source:'campaign_source',utm_medium:'campaign_medium',utm_campaign:'campaign_name',utm_content:'campaign_content',utm_term:'campaign_term'})[key],value]));
  function sendPage() {
    if (!active() || !ready || lastLocation === page.location) return;
    deps.setDisabled(false);
    safeSend(['set',pageParams()]);
    if (safeSend(['event','page_view',{...pageParams(),...campaignParams()}])) lastLocation = page.location;
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
      safeSend(['config',options.measurementId,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,...pageParams(),...campaignParams()}]);
      ready = true;
      sendPage();
    }).catch(() => { deps.setDisabled(true); }).finally(() => { loading = null; });
  }
  deps.setDisabled(true);
  return {
    setConsent(value) {
      if (!['granted','denied'].includes(value) || disposed) return;
      consent = value;
      if (value === 'denied') { lastLocation=''; sent.clear(); deps.setDisabled(true); }
      try { deps.storage?.setItem(CONSENT_KEY,value); } catch { /* Do not affect learning. */ }
      ensureReady();
    },
    visit(rawUrl, rawReferrer) {
      const next = sanitizePage(rawUrl, options.publicQualifications);
      if (!next) { page=null; lastLocation=''; deps.setDisabled(true); return; }
      page=next; referrer=sanitizeReferrer(rawReferrer); campaign=sanitizeCampaign(rawUrl);
      ensureReady();
    },
    track(name, params, dedupeKey) {
      if (!active() || !ready) return false;
      const event = sanitizeEvent(name,params);
      if (!event || (name !== 'sign_up' && !options.publicQualifications.some(q=>q.slug === event.params.qualification_slug))) return false;
      const key = dedupeKey ? `${name}:${dedupeKey}` : null;
      if (key && sent.has(key)) return false;
      const result=safeSend(['event',event.name,{...event.params,...pageParams()}]);
      if (result && key) { sent.add(key); if (sent.size>1000) sent.delete(sent.values().next().value); }
      return result;
    },
    dispose() { disposed=true; page=null; sent.clear(); deps.setDisabled(true); },
  };
}
