// Verify GPU input, pause/recovery, local letter light and static/touch fallbacks in the real browser.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{server}=require('./site.cjs'),{root}=require('./helpers.cjs');
const out=path.join(root,'.artifacts/interactive-glass');fs.mkdirSync(out,{recursive:true});
function instrument(){
 const original=HTMLCanvasElement.prototype.getContext;
 HTMLCanvasElement.prototype.getContext=function(type,...args){
  const gl=original.call(this,type,...args);if(type!=='webgl'||!gl||this.id!=='logo-particles')return gl;
  if(window.__gpu)return gl;
  const stats=window.__gpu={frames:0,values:{},errors:[]},names=new Map();window.__logoGL=gl;
  const location=gl.getUniformLocation.bind(gl);gl.getUniformLocation=(p,n)=>{const l=location(p,n);names.set(l,n);return l;};
  for(const method of ['uniform1f','uniform3fv','uniform4fv']){const call=gl[method].bind(gl);gl[method]=(l,v)=>{stats.values[names.get(l)]=typeof v==='number'?v:Array.from(v);call(l,v);};}
  const draw=gl.drawArrays.bind(gl);gl.drawArrays=(...a)=>{draw(...a);stats.frames++;const e=gl.getError();if(e)stats.errors.push(e);};return gl;
 };
}
async function main(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 const errors=[];const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.route('https://api.github.com/**',r=>r.fulfill({status:503,body:''}));
 const base='http://127.0.0.1:'+server.address().port;
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(instrument);
 try{
 await p.goto(base);await p.waitForFunction(()=>document.querySelector('#particle-logo').dataset.renderer==='webgl');
 assert.ok(Number(await p.locator('#particle-logo').getAttribute('data-particles'))>15000);
 const marks=await p.locator('.brand img,.logo-sm,.particle-fallback').evaluateAll(els=>els.map(e=>new URL(e.src).pathname));
 assert.equal(marks.length,3);assert.ok(marks.every(s=>s==='/assets/img/logo.svg'),'navigation, footer and particles use one brand mark');
 assert.ok((await p.locator('link[rel=icon]').getAttribute('href')).startsWith('assets/img/logo.svg'));

 await p.waitForFunction(()=>__gpu.values.u_intro===1);await p.screenshot({path:path.join(out,'hero-light.png')});
 const title=await p.locator('.hero-title').boundingBox();
 await p.mouse.move(title.x+105,title.y+50);await p.waitForFunction(()=>Number(document.querySelector('.hero-title').style.getPropertyValue('--title-light'))>.8);
 assert.equal(await p.locator('.title-lens').count(),0);
 assert.equal(await p.locator('.title-shine').first().evaluate(e=>getComputedStyle(e).backgroundClip),'text');
 await p.screenshot({path:path.join(out,'title-light.png')});
 await p.mouse.move(title.x+205,title.y+130);await p.waitForTimeout(180);
 const lightX=await p.locator('.title-line').first().evaluate(e=>parseFloat(e.style.getPropertyValue('--title-x')));assert.ok(Math.abs(lightX-205)<3,'letter highlight catches the pointer without accumulating lag');
 await p.mouse.move(2,2);await p.waitForFunction(()=>document.querySelector('.hero-title').style.getPropertyValue('--title-light')==='0');
 const logo=await p.locator('#particle-logo').boundingBox(),x=logo.x+logo.width*.42,y=logo.y+logo.height*.5;
 await p.mouse.move(x,y);await p.waitForFunction(()=>__gpu.values.u_pointer[2]>.95);
 await p.screenshot({path:path.join(out,'hover.png')});
 await p.mouse.click(x,y);await p.mouse.move(2,2);await p.waitForTimeout(120);
 assert.equal(await p.evaluate(()=>__gpu.values['u_ripples[0]'][3]),1);
 await p.screenshot({path:path.join(out,'ripple.png')});
 for(let i=0;i<9;i++)await p.mouse.click(x,y);
 assert.equal(await p.evaluate(()=>__gpu.values['u_ripples[0]'].length),16,'ripple slots are bounded');
 await p.mouse.move(2,2);await p.waitForFunction(()=>__gpu.values.u_pointer[2]<.003);
 await p.locator('#particle-logo').focus();await p.keyboard.press('Enter');await p.waitForTimeout(40);
 assert.ok(await p.evaluate(()=>{const r=__gpu.values['u_ripples[0]'];return [0,4,8,12].some(i=>r[i]===0&&r[i+1]===0&&r[i+3]===1);}), 'keyboard ripple starts at the center');
 await p.locator('#theme-toggle').click();await p.waitForFunction(()=>document.documentElement.dataset.theme==='dark');await p.waitForTimeout(700);
 assert.equal(await p.evaluate(()=>__gpu.values.u_dark),1);await p.screenshot({path:path.join(out,'hero-dark.png')});
 // Three rapid toggles must finish in light, including a click during an existing transition.
 await p.evaluate(()=>{const b=document.getElementById('theme-toggle');b.click();b.click();b.click();});await p.waitForFunction(()=>document.documentElement.dataset.theme==='light');await p.waitForTimeout(700);
 assert.equal(await p.locator('#theme-toggle').getAttribute('aria-pressed'),'false');
 await p.locator('#install').scrollIntoViewIfNeeded();await p.waitForTimeout(150);let n=await p.evaluate(()=>__gpu.frames);await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>__gpu.frames),n,'offscreen logo stops drawing');
 await p.evaluate(()=>scrollTo(0,0));await p.waitForFunction(n=>__gpu.frames>n,n);
 await p.emulateMedia({reducedMotion:'reduce'});await p.waitForTimeout(150);n=await p.evaluate(()=>__gpu.frames);await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>__gpu.frames),n,'reduced motion has a static logo');
 await p.mouse.move(title.x+105,title.y+50);assert.equal(await p.locator('.title-shine').first().evaluate(e=>getComputedStyle(e).display),'none');
 const before=await p.evaluate(()=>__gpu.values['u_ripples[0]']);await p.locator('#particle-logo').click();await p.waitForTimeout(40);assert.deepEqual(await p.evaluate(()=>__gpu.values['u_ripples[0]']),before,'reduced motion does not introduce ripples');
 // Losing GPU context restores the SVG; restoring context rebuilds GPU state.
 await p.evaluate(()=>{window.__lost=__logoGL.getExtension('WEBGL_lose_context');__lost.loseContext();});await p.waitForFunction(()=>document.querySelector('#particle-logo').dataset.renderer==='fallback');
 assert.equal(await p.locator('.particle-fallback').evaluate(e=>getComputedStyle(e).opacity),'1');
 await p.evaluate(()=>__lost.restoreContext());await p.waitForFunction(()=>document.querySelector('#particle-logo').dataset.renderer==='webgl');
 assert.deepEqual(await p.evaluate(()=>__gpu.errors),[]);
 for(const width of [390,768,1440]){await p.setViewportSize({width,height:width===1440?1000:844});await p.waitForTimeout(100);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'viewport fits '+width);await p.screenshot({path:path.join(out,'viewport-'+width+'.png')});}
 assert.ok(await p.locator('.site-header[data-refracted=true]').count());
 await p.locator('#features').scrollIntoViewIfNeeded();await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await p.screenshot({path:path.join(out,'glass-features.png')});
 const staticPage=await context.newPage();staticPage.on('pageerror',e=>errors.push(e.message));
 await staticPage.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return t==='webgl'?null:get.call(this,t,...a);};});await staticPage.goto(base);await staticPage.waitForFunction(()=>document.querySelector('#particle-logo').dataset.renderer==='fallback');assert.equal(await staticPage.locator('.particle-fallback').evaluate(e=>e.complete&&e.naturalWidth>0),true);await staticPage.close();
 const touch=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});await touch.route('https://api.github.com/**',r=>r.fulfill({status:503,body:''}));
 const mobile=await touch.newPage();mobile.on('pageerror',e=>errors.push(e.message));await mobile.addInitScript(instrument);await mobile.goto(base);await mobile.locator('#particle-logo').scrollIntoViewIfNeeded();await mobile.waitForFunction(()=>window.__gpu&&__gpu.values.u_intro===1);
 const touchLogo=await mobile.locator('#particle-logo').boundingBox();assert.equal(await mobile.locator('#particle-logo').evaluate(e=>getComputedStyle(e).touchAction),'pan-y');
 await mobile.touchscreen.tap(touchLogo.x+touchLogo.width/2,touchLogo.y+touchLogo.height/2);await mobile.waitForFunction(()=>__gpu.values['u_ripples[0]'][3]===1);assert.equal(await mobile.locator('.title-shine').first().evaluate(e=>getComputedStyle(e).display),'none');
 const cdp=await touch.newCDPSession(mobile),start=await mobile.evaluate(()=>scrollY),tx=touchLogo.x+touchLogo.width/2,ty=Math.min(720,touchLogo.y+touchLogo.height*.8);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:tx,y:ty}]});for(let i=1;i<=5;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:tx,y:ty-i*30}]});await mobile.waitForTimeout(20);}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await mobile.waitForTimeout(150);assert.ok(await mobile.evaluate(()=>scrollY)>start,'dragging the logo can scroll the mobile page');await touch.close();
 assert.deepEqual(errors,[]);console.log('Visuals passed: GPU formation, pointer repulsion, bounded and keyboard ripples, theme transitions, letter light, offscreen/reduced-motion pause, context recovery, WebGL fallback, responsive glass and native touch scrolling.');
 }finally{await context.close();await browser.close();server.close();}
}
main().catch(e=>{console.error(e);server.close();process.exitCode=1;});
