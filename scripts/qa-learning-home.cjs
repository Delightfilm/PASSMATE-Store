const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const args = process.argv.slice(2);
const option = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const base = option('--base', 'http://127.0.0.1:3035');
const stage = option('--stage', 'after');
const engine = option('--browser', 'chromium');
const out = path.resolve(option('--out', '../reports/learning-home-release-20261005'));
const pages = option('--pages', '/,/store/,/products/,/products/computer-literacy-2/,/cbt/,/library/,/cart/,/checkout/,/account/login/').split(',');
const widths = option('--widths', '360,390,430,768,1280').split(',').map(Number);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await (engine === 'webkit' ? webkit.launch({ headless: true }) : chromium.launch({ channel: 'msedge', headless: true }));
  const report = [];
  for (const width of widths) for (const route of pages) {
    const context = await browser.newContext({ viewport: { width, height: 700 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const external = [], errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (!request.url().startsWith(base) && /^https?:/.test(request.url())) external.push(request.url().split('?')[0]); });
    await page.addInitScript(() => { window.__homeCLS = 0; window.__homeCLSSupported = !!window.PerformanceObserver?.supportedEntryTypes?.includes('layout-shift'); if(window.__homeCLSSupported) try { new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__homeCLS += entry.value; }).observe({ type: 'layout-shift', buffered: true }); } catch {} });
    if (new URL(base).hostname === '127.0.0.1') await page.route('**/*', async route => {
      const url = route.request().url();
      if (url.startsWith(base) || !/^https?:/.test(url)) return route.continue();
      // Local QA uses deliberate external failures; never writes a production service.
      return route.abort();
    });
    const response = await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('body').waitFor({ state: 'visible' });
    await page.waitForTimeout(1700);
    const metrics = await page.evaluate(() => {
      const shown = element => { const r = element.getBoundingClientRect(), s = getComputedStyle(element); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
      const learning = document.querySelector('.learning-home');
      const targets = [...document.querySelectorAll('.learning-home a,.learning-home input,.business-information a')].filter(shown);
      const text = [...document.querySelectorAll('.learning-home p,.learning-home span,.site-footer p')].filter(shown).filter(e => e.getBoundingClientRect().width > 2);
      const luminance = rgb => { const v = rgb.slice(0,3).map(n => { const c=n/255; return c<=.04045?c/12.92:((c+.055)/1.055)**2.4; }); return .2126*v[0]+.7152*v[1]+.0722*v[2]; };
      const rgb = color => (color.match(/[\d.]+/g)||[]).map(Number);
      const ratios = text.map(element => {
        const foreground = rgb(getComputedStyle(element).color); let ancestor = element, background;
        while(ancestor) { const color = rgb(getComputedStyle(ancestor).backgroundColor); if(color.length>=3 && (color.length===3||color[3]>=.99)) { background=color;break; } ancestor=ancestor.parentElement; }
        const a=luminance(foreground),b=luminance(background||[255,255,255]); return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
      });
      const cta = document.querySelector('.learning-store')?.getBoundingClientRect();
      return { overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth, cls: window.__homeCLS || 0, clsSupported: !!window.__homeCLSSupported,
        touchViolations: targets.filter(e => { const r = e.getBoundingClientRect(); return r.width < 43.5 || r.height < 43.5; }).map(e => e.textContent.trim()),
        smallText: text.filter(e => parseFloat(getComputedStyle(e).fontSize) < 14).map(e => ({ text: e.textContent.trim(), size: getComputedStyle(e).fontSize })),
        quickCards: learning ? [...document.querySelectorAll('.learning-quick-grid>a')].filter(shown).length : null,
        storeAboveFold: cta ? cta.bottom <= innerHeight : null, business: !!document.querySelector('.business-information'), contrastMinimum: ratios.length?Math.min(...ratios):null,
        footerHidden: !document.querySelector('.site-footer'), fontPending: document.documentElement.classList.contains('store-font-pending') };
    });
    const filename = `${stage}-${engine}-${route === '/' ? 'home' : route.replaceAll('/', '-').replace(/^-|-$/g, '')}-${width}.png`;
    await page.screenshot({ path: path.join(out, filename), fullPage: true });
    report.push({ route, width, status: response.status(), ...metrics, external, errors, capture: filename });
    await context.close();
  }
  fs.writeFileSync(path.join(out, `${stage}-${engine}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ stage, engine, cases: report.length, overflow: report.filter(x => x.overflow > 0).length, touch: report.filter(x => x.touchViolations.length).length, fonts: report.filter(x => x.smallText.length).length, errors: report.filter(x => x.errors.length).length, minimumContrast: Math.min(...report.map(x=>x.contrastMinimum??99)), maxCLS: Math.max(...report.map(x => x.cls)), home: report.filter(x => x.route === '/').map(x => ({ width:x.width, cls:x.cls, clsSupported:x.clsSupported, storeAboveFold:x.storeAboveFold, quickCards:x.quickCards, external:x.external })) }));
  await browser.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
