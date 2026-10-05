const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const engine = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const base = process.env.PASSMATE_QA_BASE || 'http://127.0.0.1:3035';
const out = path.resolve('../reports/learning-home-release-20261005');
let browser;
(async () => {
  fs.mkdirSync(out, { recursive: true });
  browser = await (engine === 'webkit' ? webkit.launch({ headless:true }) : chromium.launch({ channel:'msedge', headless:true }));
  const results=[];
  for(const width of [360,390,430,1280]) {
    const context=await browser.newContext({ viewport:{width,height:700}, reducedMotion:'reduce' });
    const page=await context.newPage(); const external=[],writes=[];
    page.on('request', request => { if(/^https?:/.test(request.url())&&!request.url().startsWith(base)) external.push(request.url().split('?')[0]); if(!['GET','HEAD'].includes(request.method())) writes.push(request.url().split('?')[0]); });
    await page.route('**/*', route => { const url=route.request().url(); return url.endsWith('.woff2')||(/^https?:/.test(url)&&!url.startsWith(base))?route.abort():route.continue(); });
    const response=await page.goto(base+'/',{waitUntil:'load'});
    const html=await response.text();
    assert(html.includes('내 시험 기출부터')); assert(html.includes('876-59-00934')); assert(html.includes('href="/store/"'));
    await page.waitForFunction(()=>document.querySelector('.learning-home')&&getComputedStyle(document.body).visibility==='visible');
    assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('store-font-pending')),false);
    const input=page.getByRole('combobox',{name:'자격증 검색'});
    await input.click();
    for(const query of ['컴퓨터활용능력 2급','컴활2급','ㅋㅍㅌㅎㅇㄴㄹ2ㄱ']) {
      console.log(`Checking ${engine} ${width}: ${query}`);
      await input.fill(query); await page.getByRole('listbox').waitFor();
      const count=await page.getByRole('option').count(); assert(count>0&&count<=6,query);
    }
    await input.press('ArrowDown');
    const selected=page.locator('[role="option"][aria-selected="true"]');
    const target=await selected.getAttribute('href'); assert(target.startsWith('/cbt/'));
    await input.press('Escape'); assert.equal(await input.getAttribute('aria-expanded'),'false');
    const homeExternal = external.slice(); assert.equal(homeExternal.length,0);
    await input.press('ArrowDown'); await input.press('Enter');
    await page.waitForURL(url=>decodeURIComponent(url.pathname)===decodeURIComponent(new URL(target,base).pathname));
    assert(!page.url().includes('/exam/'));
    await page.goto(base+'/',{waitUntil:'load'});
    await input.click();
    await input.fill('없는자격증테스트999'); await page.getByText('검색 결과가 없어요.',{exact:false}).waitFor().catch(async error=>{console.error(JSON.stringify({width,value:await input.inputValue(),search:await page.locator('.learning-search').innerText()}));await page.screenshot({path:path.join(out,`failed-${engine}-${width}.png`)});throw error;});
    assert.equal(await page.getByRole('option').count(),0);
    await input.fill('');
    await page.screenshot({path:path.join(out,`font-blocked-${engine}-home-${width}.png`),fullPage:true});
    const missingPolicies=await page.locator('footer a[href="/terms/"],footer a[href="/privacy/"],footer a[href="/refund/"],footer a[href="/copyright/"]').count();
    assert.equal(missingPolicies,0);
    assert.equal(writes.length,0);
    // Every external request, if any, would have been blocked by the fixture above.
    results.push({width,keyboard:true,fullName:true,shortName:true,initialSearch:true,emptyResult:true,fontFailureVisible:true,serverBusiness:true,missingPolicyLinks:missingPolicies,writes,homeExternal,detailExternal:external});
    await context.close();
  }
  fs.writeFileSync(path.join(out,`flows-${engine}.json`),JSON.stringify(results,null,2));
  console.log(JSON.stringify({engine,results}));
  await browser.close();
})().catch(async error=>{console.error(error);await browser?.close();process.exitCode=1;});
