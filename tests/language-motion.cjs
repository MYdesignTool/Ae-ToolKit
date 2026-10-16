const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{server}=require('./site.cjs'),{root}=require('./helpers.cjs');
const out=path.join(root,'.artifacts/language-motion');fs.mkdirSync(out,{recursive:true});
function observe(){
 window.__languageMotion={ready:[],finished:0,entries:[]};
 addEventListener('pagereveal',e=>{
  if(!e.viewTransition)return;
  e.viewTransition.ready.then(()=>{
   const r=document.documentElement,n=getComputedStyle(r,'::view-transition-new(root)'),o=getComputedStyle(r,'::view-transition-old(root)');
   window.__languageMotion.ready.push({direction:r.getAttribute('data-language-transition'),newName:n.animationName,oldName:o.animationName,duration:n.animationDuration,clip:n.clipPath,transform:n.transform,headerGroup:getComputedStyle(r,'::view-transition-group(language-header)').animationName});
  }).catch(()=>{});
  e.viewTransition.finished.then(()=>window.__languageMotion.finished++,()=>{});
 });
 const animate=Element.prototype.animate;
 Element.prototype.animate=function(frames,options){window.__languageMotion.entries.push({id:this.id,frames,duration:options.duration});return animate.call(this,frames,options);};
 const context=HTMLCanvasElement.prototype.getContext;
 HTMLCanvasElement.prototype.getContext=function(type,...args){const gl=context.call(this,type,...args);if(type!=='webgl'||!gl||this.id!=='logo-particles')return gl;const names=new Map(),get=gl.getUniformLocation.bind(gl),set=gl.uniform1f.bind(gl);gl.getUniformLocation=(p,n)=>{const l=get(p,n);names.set(l,n);return l};gl.uniform1f=(l,v)=>{if(names.get(l)==='u_intro'&&window.__firstIntro===undefined)window.__firstIntro=v;return set(l,v)};return gl;};
}
async function main(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port+'/Ae-ToolKit/';
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});const errors=[];
 try{
  const c=await browser.newContext({locale:'zh-CN',viewport:{width:1280,height:900}}),p=await c.newPage();await p.addInitScript(observe);p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'?lang=zh');await p.waitForFunction(()=>document.getElementById('particle-logo').dataset.renderer==='webgl');await p.waitForTimeout(1700);
  await p.locator('[data-language-switch]').click();await p.waitForFunction(()=>__languageMotion.ready.length>0);
  let trace=await p.evaluate(()=>__languageMotion.ready.at(-1));assert.equal(trace.newName,'language-in');assert.equal(trace.oldName,'language-out');assert.equal(trace.direction,'en');assert.equal(trace.clip,'none');assert.equal(trace.duration,'0.32s');assert.equal(trace.headerGroup,'none','navigation bar stays steady');
  await p.screenshot({path:path.join(out,'native-to-en-during.png'),animations:'allow'});
  await p.waitForFunction(()=>!document.documentElement.hasAttribute('data-language-transition'));await p.waitForFunction(()=>window.__firstIntro!==undefined);assert.equal(await p.evaluate(()=>__firstIntro),1,'language switch keeps the particle logo assembled');
  assert.equal(await p.locator('html').getAttribute('lang'),'en');assert.equal(await p.evaluate(()=>sessionStorage.getItem('language-transition')),null);assert.equal(await p.locator('html').getAttribute('data-language-arrival'),null);assert.equal(await p.locator('.site-header').evaluate(e=>e.style.viewTransitionName),'');
  await p.screenshot({path:path.join(out,'native-to-en-finished.png')});
  await p.locator('#updates').evaluate(e=>scrollTo(0,e.getBoundingClientRect().top+scrollY-112));await p.locator('[data-language-switch]').click();await p.waitForFunction(()=>__languageMotion.ready.some(t=>t.direction==='zh'));
  trace=await p.evaluate(()=>__languageMotion.ready.at(-1));assert.equal(trace.direction,'zh');assert.equal(trace.newName,'language-in');assert.equal(new URL(p.url()).hash,'#updates');
  await p.screenshot({path:path.join(out,'native-to-zh-during.png'),animations:'allow'});await p.waitForFunction(()=>!document.documentElement.hasAttribute('data-language-transition'));
  // A theme change after language navigation must still use its original circular reveal.
  await p.evaluate(()=>{const start=document.startViewTransition.bind(document);document.startViewTransition=fn=>{const t=start(fn);t.ready.then(()=>window.__themeAnimation=getComputedStyle(document.documentElement,'::view-transition-new(root)').animationName).catch(()=>{});return t;};});
  await p.locator('#theme-toggle').click();await p.waitForFunction(()=>window.__themeAnimation);assert.equal(await p.evaluate(()=>__themeAnimation),'theme-in');await p.waitForTimeout(650);
  assert.equal(await p.locator('html').getAttribute('data-theme'),'dark');await p.locator('[data-language-switch]').click();await p.waitForFunction(()=>document.documentElement.lang==='en');await p.waitForFunction(()=>!document.documentElement.hasAttribute('data-language-transition'));assert.equal(await p.locator('html').getAttribute('data-theme'),'dark');
  await p.goBack();await p.waitForFunction(()=>document.documentElement.lang==='zh-CN');await p.waitForFunction(()=>!document.documentElement.hasAttribute('data-language-transition'));await p.locator('[data-language-switch]').click();await p.waitForFunction(()=>document.documentElement.lang==='en');await p.waitForFunction(()=>!document.documentElement.hasAttribute('data-language-transition'));
  await c.close();
  // No navigation transition API: keep normal navigation and animate only the incoming content.
  const fallback=await browser.newContext({locale:'zh-CN',viewport:{width:390,height:884}}),f=await fallback.newPage();await f.addInitScript(()=>{Object.defineProperty(window,'PageSwapEvent',{value:undefined,configurable:true});});await f.addInitScript(observe);f.on('pageerror',e=>errors.push(e.message));await f.goto(base+'?lang=zh');await f.locator('[data-language-switch]').click();await f.waitForFunction(()=>document.documentElement.lang==='en'&&__languageMotion.entries.length>0);assert.ok(await f.evaluate(()=>__languageMotion.entries.some(e=>e.duration===320&&e.frames[0].transform==='translateX(22px)')));await f.waitForFunction(()=>!document.documentElement.hasAttribute('data-language-arrival'));assert.ok(await f.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await f.screenshot({path:path.join(out,'fallback-en-mobile.png')});await fallback.close();
  const reduced=await browser.newContext({locale:'zh-CN',reducedMotion:'reduce'}),r=await reduced.newPage();await r.addInitScript(observe);r.on('pageerror',e=>errors.push(e.message));await r.goto(base+'?lang=zh');await r.locator('[data-language-switch]').click();await r.waitForFunction(()=>document.documentElement.lang==='en');assert.deepEqual(await r.evaluate(()=>__languageMotion.entries),[]);assert.equal(await r.locator('html').getAttribute('data-language-transition'),null);assert.equal(await r.evaluate(()=>sessionStorage.getItem('language-transition')),null);await reduced.close();
  // Embedded browsers may expose the API but decline native transitions inside an iframe.
  const embedded=await browser.newContext({locale:'zh-CN'}),host=await embedded.newPage();await host.addInitScript(observe);host.on('pageerror',e=>errors.push(e.message));await host.setContent('<iframe src="'+base+'?lang=zh" style="width:390px;height:844px"></iframe>');let child=host.frames().find(frame=>frame.url().startsWith(base));assert.ok(child);await child.locator('[data-language-switch]').click();await child.waitForFunction(()=>document.documentElement.lang==='en'&&(__languageMotion.ready.length>0||__languageMotion.entries.length>0));await child.waitForFunction(()=>!document.documentElement.hasAttribute('data-language-arrival'));await embedded.close();
  assert.deepEqual(errors,[]);console.log('Language motion passed: native directional dissolve, no circular clip, assembled particle continuity, retained section/theme, back navigation and re-entry, mobile fallback, reduced motion and clean state.');
 }finally{await browser.close();server.close();}
}
main().catch(e=>{console.error(e);server.close();process.exitCode=1});
