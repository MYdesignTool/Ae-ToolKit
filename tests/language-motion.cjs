// Language motion must keep the actual glass / GPU surfaces alive and never snapshot the header.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const {chromium} = require('playwright');
const {server} = require('./site.cjs');
const {root} = require('./helpers.cjs');
const out = path.join(root, '.artifacts/language-motion');
fs.mkdirSync(out, {recursive:true});
function observe() {
  window.__languageAnimations = [];
  const animate = Element.prototype.animate;
  Element.prototype.animate = function (frames, options) {
    const animation = animate.call(this, frames, options);
    window.__languageAnimations.push({element:this, frames, options, animation});
    if (window.__pauseEntry && options.duration === 300) { animation.pause(); animation.currentTime = 100; }
    return animation;
  };
}
async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = process.env.SITE_URL || 'http://127.0.0.1:' + server.address().port + '/Ae-ToolKit/';
  const browser = await chromium.launch({channel:'msedge', headless:true, args:['--enable-unsafe-swiftshader']});
  const errors = [];
  try {
    const context = await browser.newContext({locale:'zh-CN', viewport:{width:1280, height:900}});
    const page = await context.newPage();
    await page.addInitScript(observe);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + (base.includes('?') ? '&' : '?') + 'lang=zh');
    await page.waitForFunction(() => document.getElementById('particle-logo').dataset.renderer === 'webgl');
    await page.evaluate(() => {
      window.__surfaces = ['.site-header', '.page-bg', '#logo-particles', '.feature-card', '#glass-optics-0'].map(q => document.querySelector(q));
      window.__context = document.querySelector('#logo-particles').getContext('webgl');
    });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; localStorage.setItem('theme', theme); }, theme);
      await page.evaluate(() => scrollTo({top:0, behavior:'instant'}));
      await page.waitForTimeout(450);
      await page.screenshot({path:path.join(out, 'live-glass-' + theme + '-before.png')});
      await page.evaluate(() => window.__pauseEntry = true);
      await page.locator('[data-language-switch]').click();
      await page.waitForFunction(() => document.documentElement.lang === 'en');
      await page.screenshot({path:path.join(out, 'live-glass-' + theme + '-during.png'), animations:'allow'});
      const state = await page.evaluate(() => ({
        identities: ['.site-header', '.page-bg', '#logo-particles', '.feature-card', '#glass-optics-0'].map((q, i) => document.querySelector(q) === window.__surfaces[i]),
        gpu: document.querySelector('#logo-particles').getContext('webgl') === window.__context,
        snapshot: !!document.querySelector(':root').getAnimations().find(a => a.effect?.pseudoElement?.startsWith('::view-transition')),
        headerAnimations: window.__languageAnimations.filter(a => a.element.matches('.site-header, .brand, .page-bg, #logo-particles')).length,
        headerFilter: getComputedStyle(document.querySelector('.site-header')).filter,
        headerTransform: getComputedStyle(document.querySelector('.site-header')).transform,
        blurFrames: window.__languageAnimations.some(a => a.frames.some(f => f.filter)),
        title: document.querySelector('.title-line').childNodes[0].nodeValue,
        shine: document.querySelector('.title-shine').textContent,
        asset: document.querySelector('.logo-icon').src,
        example: document.querySelector('#code-view').textContent
      }));
      assert.ok(state.identities.every(Boolean), 'all original glass, background, canvas and refraction objects survive');
      assert.ok(state.gpu, 'the same WebGL context remains alive');
      assert.equal(state.snapshot, false); assert.equal(state.headerAnimations, 0);
      assert.equal(state.headerFilter, 'none');
      assert.equal(state.blurFrames, false); assert.equal(state.title, state.shine);
      assert.ok(state.asset.includes('/Ae-ToolKit/assets/')); assert.ok(state.example.includes('Asset organization'));
      await page.evaluate(() => { window.__pauseEntry = false; __languageAnimations.forEach(a => { if (a.animation.playState === 'paused') a.animation.play(); }); });
      await page.waitForFunction(() => !document.documentElement.hasAttribute('data-language-transition'));
      await page.locator('#updates').evaluate(el => scrollTo({top:el.getBoundingClientRect().top + scrollY - 112, behavior:'instant'}));
      await page.locator('[data-language-switch]').click();
      await page.waitForFunction(() => document.documentElement.lang === 'zh-CN' && !document.documentElement.hasAttribute('data-language-transition'));
      assert.equal(new URL(page.url()).hash, '#updates');
      assert.ok(Math.abs(await page.locator('#updates').evaluate(el => el.getBoundingClientRect().top) - 112) < 3, 'localized section keeps its viewport position');
      assert.ok((await page.locator('#code-view').textContent()).includes('素材整理'));
      await page.goBack();
      await page.waitForFunction(() => document.documentElement.lang === 'en' && !document.documentElement.hasAttribute('data-language-transition'));
      await page.goForward();
      await page.waitForFunction(() => document.documentElement.lang === 'zh-CN' && !document.documentElement.hasAttribute('data-language-transition'));
    }
    // Back during the incoming animation must not leave the URL and language out of sync.
    await page.evaluate(() => window.__pauseEntry = true);
    await page.locator('[data-language-switch]').click();
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    await page.goBack();
    await page.evaluate(() => { window.__pauseEntry = false; __languageAnimations.forEach(a => { if (a.animation.playState === 'paused') a.animation.play(); }); });
    await page.waitForFunction(() => document.documentElement.lang === 'zh-CN' && !document.documentElement.hasAttribute('data-language-transition'));
    assert.equal(new URL(page.url()).searchParams.get('lang'), 'zh');
    // Preserve the selected example, and translate its contents and copy status together.
    await page.locator('.code-tab[data-key=launcher]').click();
    await page.locator('[data-language-switch]').click();
    await page.waitForFunction(() => document.documentElement.lang === 'en' && !document.documentElement.hasAttribute('data-language-transition'));
    assert.ok((await page.locator('#code-view').textContent()).includes('Scan the script folder'));
    assert.equal(await page.locator('.code-tab.active').getAttribute('data-key'), 'launcher');
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {configurable:true, value:{writeText:() => Promise.reject(Error('denied'))}}));
    await page.locator('#code-copy').click();
    await page.waitForFunction(() => document.querySelector('#code-copy').textContent.includes('failed'));
    await page.locator('[data-language-switch]').click();
    await page.waitForFunction(() => document.documentElement.lang === 'zh-CN' && !document.documentElement.hasAttribute('data-language-transition'));
    assert.equal(await page.locator('#code-copy').textContent(), '复制');
    // Theme transitions retain their circular reveal after multiple in-place language changes.
    await page.evaluate(() => {
      const start = document.startViewTransition.bind(document);
      document.startViewTransition = callback => {
        const transition = start(callback);
        transition.ready.then(() => window.__themeAnimation = getComputedStyle(document.documentElement, '::view-transition-new(root)').animationName).catch(() => {});
        return transition;
      };
    });
    await page.locator('#theme-toggle').click();
    await page.waitForFunction(() => window.__themeAnimation);
    assert.equal(await page.evaluate(() => window.__themeAnimation), 'theme-in');
    await context.close();
    for (const reduced of [false, true]) {
      const mobile = await browser.newContext({locale:'zh-CN', viewport:{width:390, height:884}, reducedMotion:reduced ? 'reduce' : 'no-preference'});
      const p = await mobile.newPage();
      await p.addInitScript(observe); p.on('pageerror', error => errors.push(error.message));
      await p.goto(base + (base.includes('?') ? '&' : '?') + 'lang=zh');
      await p.locator('[data-language-switch]').click();
      await p.waitForFunction(() => document.documentElement.lang === 'en' && !document.documentElement.hasAttribute('data-language-transition'));
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (reduced) assert.deepEqual(await p.evaluate(() => __languageAnimations), []);
      else {
        assert.ok(await p.evaluate(() => __languageAnimations.some(a => a.options.duration === 300)));
        await p.screenshot({path:path.join(out, 'live-glass-mobile.png')});
      }
      await mobile.close();
    }
    if (!process.env.SITE_URL) {
      const fallback = await browser.newContext({locale:'zh-CN'}), p = await fallback.newPage();
      p.on('pageerror', error => errors.push(error.message));
      await p.goto(base + '?lang=zh'); await p.evaluate(() => window.__oldDocument = true);
      await p.route('**/en/**', route => route.request().resourceType() === 'fetch' ? route.abort() : route.continue());
      await p.locator('[data-language-switch]').click();
      await p.waitForFunction(() => document.documentElement.lang === 'en');
      assert.equal(await p.evaluate(() => window.__oldDocument), undefined, 'failed template fetch falls back to static English navigation');
      await fallback.close();
    }
    assert.deepEqual(errors, []);
    console.log('Language motion passed: original glass and GPU retained, no snapshots or blur, light/dark mid-animation captures, section position, back/forward, code state, theme reveal, mobile, reduced motion and network fallback.');
  } finally { await browser.close(); server.close(); }
}
main().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
