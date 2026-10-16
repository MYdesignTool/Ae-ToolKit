const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{server}=require('./site.cjs'),{root}=require('./helpers.cjs');
const out=path.join(root,'.artifacts/bilingual');fs.mkdirSync(out,{recursive:true});
async function main(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port+'/Ae-ToolKit';
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 const errors=[];
 try {
  // Test the public subdirectory too: production is /Ae-ToolKit/, not the origin root.
  for(const [locale,expected] of [['zh-CN','zh-CN'],['zh-TW','zh-CN'],['en-US','en'],['ja-JP','en'],['fr-FR','en']]){
   const c=await browser.newContext({locale,reducedMotion:'reduce'}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/?v=0.3.1&ui=lang-test#hero');await p.waitForFunction(lang=>document.documentElement.lang===lang,expected);await p.waitForLoadState('load');assert.equal(new URL(p.url()).searchParams.get('v'),'0.3.1');assert.equal(new URL(p.url()).hash,'#hero');
   if(expected==='en')assert.equal(new URL(p.url()).pathname,'/Ae-ToolKit/en/');await c.close();
  }
  const c=await browser.newContext({locale:'ja-JP',reducedMotion:'reduce',viewport:{width:1440,height:1000}}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
  const broken=[];p.on('response',r=>{if(r.status()>=400)broken.push(r.status()+' '+r.url());});
  await p.goto(base+'/?v=0.3.1#features');await p.waitForURL('**/en/**');await p.waitForLoadState('load');await p.waitForFunction(()=>document.getElementById('particle-logo').dataset.renderer==='webgl');assert.equal(await p.locator('html').getAttribute('lang'),'en');assert.ok((await p.locator('#code-view').textContent()).includes('Asset organization'));
  await p.locator('#theme-toggle').click();assert.equal(await p.locator('html').getAttribute('data-theme'),'dark');await p.locator('#updates').evaluate(e=>scrollTo(0,e.getBoundingClientRect().top+scrollY-112));await p.locator('[data-language-switch]').click();await p.waitForURL('**/?v=0.3.1&lang=zh#updates');assert.equal(await p.locator('html').getAttribute('lang'),'zh-CN');assert.equal(await p.locator('html').getAttribute('data-theme'),'dark');assert.equal(await p.evaluate(()=>localStorage.getItem('site-language')),'zh');
  await p.goto(base);assert.equal(await p.locator('html').getAttribute('lang'),'zh-CN','saved Chinese wins over Japanese browser');
  await p.locator('[data-language-switch]').click();await p.waitForURL('**/en/?lang=en');await p.goto(base);await p.waitForURL('**/en/');assert.equal(await p.evaluate(()=>localStorage.getItem('site-language')),'en');
  await p.locator('.code-tab[data-key=expressions]').click();assert.ok((await p.locator('#code-view').textContent()).includes('Keep existing expressions'));await p.locator('.code-tab[data-key=launcher]').click();assert.ok((await p.locator('#code-view').textContent()).includes('Scan the script folder'));
  await p.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(Error('denied'))}}));await p.locator('#code-copy').click();await p.waitForFunction(()=>document.getElementById('code-copy').textContent.includes('Copy failed'));
  for(const width of [320,390,768,1440]){
   await p.setViewportSize({width,height:width===1440?1000:884});
   for(const theme of ['light','dark']){
    if(await p.locator('html').getAttribute('data-theme')!==theme)await p.locator('#theme-toggle').click();
    await p.evaluate(()=>scrollTo(0,0));await p.waitForTimeout(80);
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow at '+width);
    const title=await p.locator('.hero-title').boundingBox();assert.ok(title.x>=0&&title.x+title.width<=width,'English title fits '+width);
    const nav=await p.locator('.nav').boundingBox(),controls=await p.locator('.language-toggle,.theme-toggle,.mobile-toggle').evaluateAll(es=>es.filter(e=>getComputedStyle(e).display!=='none').map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right};}));assert.ok(controls.every(r=>r.left>=nav.x&&r.right<=nav.x+nav.width),'navigation controls fit '+width);
    await p.screenshot({path:path.join(out,'en-hero-'+theme+'-'+width+'.png')});
    await p.locator('#features').scrollIntoViewIfNeeded();await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await p.screenshot({path:path.join(out,'en-features-'+theme+'-'+width+'.png')});
   }
  }
  const untranslated=await p.locator('body').evaluate(e=>{const copy=e.cloneNode(true);copy.querySelectorAll('script,style,[lang=zh-CN]').forEach(n=>n.remove());return (copy.textContent.match(/[\u3400-\u9fff]+/g)||[]);});assert.deepEqual(untranslated,[],'only the labeled Chinese AE menu path stays Chinese');
  await p.setViewportSize({width:320,height:884});await p.locator('#code-copy').click();await p.waitForFunction(()=>document.getElementById('code-copy').textContent.includes('Copy failed'));assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'English copy failure fits a narrow phone');
  await p.setViewportSize({width:1440,height:1000});
  await p.locator('#install').scrollIntoViewIfNeeded();await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(await p.locator('#install .step').count(),7);assert.equal(await p.locator('#install [lang=zh-CN]').count(),1);assert.ok((await p.locator('#install').innerText()).includes('Allow Scripts to Write Files and Access Network'));
  await p.screenshot({path:path.join(out,'en-install-1440.png')});
  await p.locator('#code-copy').click();await p.waitForFunction(()=>document.getElementById('code-copy').textContent.includes('Copy failed'));assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'copy error fits');
  await c.close();
  for(const url of ['/?lang=zh','/en/']){
   const c=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:884}}),p=await c.newPage();await p.goto(base+url);assert.equal(await p.locator('html').getAttribute('lang'),url.startsWith('/en')?'en':'zh-CN');assert.equal(await p.locator('[data-release-link]').count(),4);assert.ok((await p.locator('[data-language-switch]').getAttribute('href')).includes('lang='));assert.equal(await p.locator('.release-notes > div').count(),3);await c.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(broken,[]);console.log('Bilingual site passed: browser detection, saved preference, explicit URLs, query/hash and theme retention, English examples, 320–1440px layouts, static no-JS pages and resource loading.');
 } finally {await browser.close();server.close();}
}
main().catch(e=>{console.error(e);server.close();process.exitCode=1});
