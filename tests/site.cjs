// Public-page layout, native feature illustrations and scroll-triggered rocket checks.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{root}=require('./helpers.cjs');
const out=process.env.ARTIFACT_DIR||path.join(root,'.artifacts','site-composition');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;const file=path.resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));if(file!==path.join(root,'index.html')&&!file.startsWith(path.join(root,'assets')+path.sep)){res.writeHead(404).end();return;}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':({'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream'}).end(b);});});
async function main(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://api.github.com/**',r=>r.fulfill({json:{tag_name:'v0.2.6'}}));await page.goto(base);await page.waitForFunction(()=>document.getElementById('particle-logo').dataset.renderer);
 const rocket=page.locator('#back-to-top');
 async function fit(){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');}
 async function shot(name,selector){if(selector)await page.locator(selector).evaluate(e=>scrollTo(0,e.getBoundingClientRect().top+scrollY-112));await page.waitForFunction(()=>[...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight&&getComputedStyle(i).visibility!=='hidden';}).every(i=>i.complete&&i.naturalWidth));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:path.join(out,name+'.png')});}
 async function returnTop(keyboard){await page.waitForFunction(()=>document.getElementById('back-to-top').classList.contains('is-visible'));if(keyboard){await rocket.focus();await page.keyboard.press('Enter');}else await rocket.click();await page.waitForFunction(()=>scrollY===0&&!document.getElementById('back-to-top').classList.contains('is-visible'));assert.equal(await page.evaluate(()=>document.activeElement.id),'hero-title');assert.equal(await rocket.evaluate(e=>e.inert),true);}
 assert.equal(await page.locator('#app-version').textContent(),'v0.3.1');assert.equal(await rocket.isVisible(),false);assert.equal(await rocket.getAttribute('aria-hidden'),'true');
 assert.equal(await page.locator('.feature-visual[role=img]').count(),3);assert.equal(await page.locator('.feature-card img,.preview-button,#image-preview').count(),0);assert.equal(await page.locator('.folder-row').count(),3);assert.equal(await page.locator('.property-fan > span').count(),3);assert.equal(await page.locator('.mini-script').count(),3);
 assert.equal(await page.locator('.install-heading .install-mascot img').count(),1);assert.equal(await page.locator('.install-note .guide-mascot').count(),0);
 for(const theme of ['light','dark']){
  if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#theme-toggle').click();await page.evaluate(()=>scrollTo(0,0));await fit();await shot('hero-'+theme+'-1440');
  await page.evaluate(()=>scrollTo(0,400));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));assert.equal(await rocket.isVisible(),false,'rocket stays hidden near the top');
  await page.evaluate(()=>scrollTo(0,900));await page.waitForFunction(()=>document.getElementById('back-to-top').classList.contains('is-visible'));const before=await rocket.boundingBox();assert.equal(await rocket.evaluate(e=>getComputedStyle(e).position),'fixed');assert.ok(before.x+before.width<=1440&&before.y+before.height<=1000);
  await page.evaluate(()=>scrollTo(0,1600));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));const after=await rocket.boundingBox();assert.ok(Math.abs(before.x-after.x)<1&&Math.abs(before.y-after.y)<1,'rocket is attached to the viewport');await returnTop(true);
  for(const name of ['features','updates','install']){await shot(name+'-'+theme+'-1440','#'+name);await fit();}
  const mask=await page.locator('.release-banner img').evaluate(e=>getComputedStyle(e).webkitMaskImage);assert.ok(mask.includes('linear-gradient'),'banner edge fades within its own margins');
 }
 await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 await page.locator('.code-tab[data-key=launcher]').click();assert.ok((await page.locator('#code-view').textContent()).includes('scanScripts'));
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(Error('denied'))}}));await page.locator('#code-copy').click();await page.waitForFunction(()=>document.getElementById('code-copy').textContent.includes('失败'));
 for(const width of [390,724,768]){
  await page.setViewportSize({width,height:884});await page.evaluate(()=>scrollTo(0,0));await fit();
  const overlap=await page.evaluate(()=>{const a=document.querySelector('.hero-title').getBoundingClientRect(),b=document.querySelector('#logo-particles').getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;});assert.ok(overlap,'particle backdrop overlaps the compact hero');
  assert.equal(await page.locator('.hero-stage').evaluate(e=>getComputedStyle(e).position),'absolute');
  for(const theme of ['light','dark']){if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#theme-toggle').click();for(const name of ['hero','features','updates','install']){await shot(name+'-'+theme+'-'+width,'#'+name);await fit();}}
  await page.locator('#mobile-toggle').click();assert.equal(await page.locator('#mobile-toggle').getAttribute('aria-expanded'),'true');await page.keyboard.press('Escape');assert.equal(await page.locator('#mobile-toggle').getAttribute('aria-expanded'),'false');
  await page.locator('#mobile-toggle').click();await page.locator('.nav-links a[href="#updates"]').click();assert.equal(await page.locator('#mobile-toggle').getAttribute('aria-expanded'),'false');await returnTop(false);await fit();
 }
 await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>scrollTo(0,1300));await returnTop(false);await shot('hero-normal-motion-768');
 assert.deepEqual(errors,[]);console.log('Site passed: native feature illustrations, theme persistence, fixed rocket threshold/position/focus and smooth return, desktop/mobile fit, layered hero, softened mascot edges, copy failure, menu and offline version.');await context.close();
 }finally{await browser.close();server.close();}
}
if(require.main===module)main().catch(e=>{console.error(e);server.close();process.exitCode=1;});
module.exports={server};
