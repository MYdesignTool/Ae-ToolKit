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
 const errors=[];const context=await browser.newContext({locale:'zh-CN',viewport:{width:1440,height:1000}});
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
 assert.equal(await p.evaluate(()=>__gpu.values['u_ripples[0]'][3]),.625);
 await p.screenshot({path:path.join(out,'ripple.png')});
 for(let i=0;i<9;i++)await p.mouse.click(x,y);
 assert.equal(await p.evaluate(()=>__gpu.values['u_ripples[0]'].length),16,'ripple slots are bounded');
 await p.mouse.move(2,2);await p.waitForFunction(()=>__gpu.values.u_pointer[2]<.003);
 await p.locator('#particle-logo').focus();await p.keyboard.press('Enter');await p.waitForTimeout(40);
 assert.ok(await p.evaluate(()=>{const r=__gpu.values['u_ripples[0]'];return [0,4,8,12].some(i=>r[i]===0&&r[i+1]===0&&r[i+3]===.625);}), 'keyboard ripple starts at the center');
 // Dragging updates a connected path, while the click-ripple buffer remains untouched.
 const clickState=await p.evaluate(()=>__gpu.values['u_ripples[0]']);
 await p.mouse.move(x,y);await p.mouse.down();
 for(let i=1;i<=6;i++){await p.waitForTimeout(30);await p.mouse.move(x+i*14,y+Math.sin(i)*14);}
 await p.waitForTimeout(40);
 const flowPath=await p.evaluate(()=>__gpu.values['u_flow[0]']);assert.equal(flowPath.length,32,'the path has bounded storage');
 assert.ok(flowPath[3]>0&&flowPath[3]===flowPath[7]&&flowPath[0]>flowPath[4],'the live endpoint connects to its previous anchor');
 assert.deepEqual(await p.evaluate(()=>__gpu.values['u_ripples[0]']),clickState,'dragging emits no click rings');
 await p.mouse.move(x+75,y+60);await p.waitForTimeout(40);
 const turned=await p.evaluate(()=>__gpu.values['u_flow[0]']);assert.ok(turned[1]>flowPath[1]+30,'the live endpoint follows a turn within one short movement');
 await p.screenshot({path:path.join(out,'drag-water.png')});
 await p.mouse.up();await p.waitForTimeout(80);assert.deepEqual(await p.evaluate(()=>__gpu.values['u_ripples[0]']),clickState,'release does not trigger a click ripple');
 assert.deepEqual(await p.evaluate(()=>__gpu.values['u_flow[0]']),turned,'the last path fades without emitting new samples');
 await p.mouse.move(x+110,y+40);await p.waitForTimeout(80);assert.deepEqual(await p.evaluate(()=>__gpu.values['u_flow[0]']),turned,'hover after release stops updating the path');
 // Starting elsewhere keeps the old wake but creates no connecting segment between strokes.
 await p.mouse.move(x-35,y+80);await p.mouse.down();await p.waitForTimeout(40);
 const restarted=await p.evaluate(()=>__gpu.values['u_flow[0]']);
 assert.equal(restarted[3],restarted[7]);assert.notEqual(restarted[3],turned[3]);
 assert.equal(restarted[0],restarted[4]);assert.equal(restarted[1],restarted[5]);
 assert.ok(restarted.slice(8).some((v,i)=>i%4===3&&v===turned[3]),'the previous path retains its own stroke identity');
 await p.mouse.up();
 await p.locator('#theme-toggle').click();await p.waitForFunction(()=>document.documentElement.dataset.theme==='dark');await p.waitForTimeout(700);
 assert.equal(await p.evaluate(()=>__gpu.values.u_dark),1);await p.screenshot({path:path.join(out,'hero-dark.png')});
 // Three rapid toggles must finish in light, including a click during an existing transition.
 await p.evaluate(()=>{const b=document.getElementById('theme-toggle');b.click();b.click();b.click();});await p.waitForFunction(()=>document.documentElement.dataset.theme==='light');await p.waitForTimeout(700);
 assert.equal(await p.locator('#theme-toggle').getAttribute('aria-pressed'),'false');
 await p.locator('#install').scrollIntoViewIfNeeded();await p.waitForTimeout(150);let n=await p.evaluate(()=>__gpu.frames);await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>__gpu.frames),n,'offscreen logo stops drawing');
 await p.evaluate(()=>scrollTo(0,0));await p.waitForFunction(n=>__gpu.frames>n,n);
 await p.emulateMedia({reducedMotion:'reduce'});await p.waitForTimeout(150);n=await p.evaluate(()=>__gpu.frames);await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>__gpu.frames),n,'reduced motion has a static logo');
 assert.equal(await p.evaluate(()=>__gpu.values.u_motion),0,'reduced motion disables the shader disturbance');
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
 // Entry, sudden direction changes and rapid re-entry all preserve the current reflection.
 await p.emulateMedia({reducedMotion:'no-preference'});
 const card=p.locator('.feature-card').first();await card.scrollIntoViewIfNeeded();const cr=await card.boundingBox();
 const right={x:cr.x+cr.width*.8,y:cr.y+cr.height*.65},left={x:cr.x+cr.width*.15,y:cr.y+cr.height*.35};
 async function light(){return card.evaluate(e=>({x:parseFloat(e.style.getPropertyValue('--mx')),alpha:parseFloat(e.style.getPropertyValue('--sheen-opacity'))}));}
 await p.mouse.move(right.x,right.y);await p.waitForTimeout(700);
 const initialLight=await light();assert.ok(initialLight.x>65&&initialLight.x<80,'reflection travels a shorter distance than the pointer');
 await p.mouse.move(left.x,left.y);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const crossing=await light();assert.ok(crossing.x>27&&crossing.x<initialLight.x-1,'a sudden crossing passes through intermediate positions');
 await p.waitForTimeout(650);await p.mouse.move(2,2);await p.waitForTimeout(25);const departing=await light();
 await p.mouse.move(right.x,right.y);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const reentry=await light();assert.ok(Math.abs(reentry.x-departing.x)<20&&reentry.x<48,'re-entry continues from the departing reflection');
 await p.waitForTimeout(650);await p.mouse.move(2,2);assert.notEqual(await card.evaluate(e=>e.style.getPropertyValue('--mx')),'','reflection is retained on leave');
 await p.waitForTimeout(140);const middleLight=await light();assert.ok(middleLight.x>30&&middleLight.x<initialLight.x&&middleLight.alpha>0&&middleLight.alpha<.7,'reflection fades while returning');
 await p.waitForFunction(()=>document.querySelector('.feature-card').style.getPropertyValue('--mx')==='');
 assert.equal(await card.evaluate(e=>getComputedStyle(e,'::before').opacity),'0');
 // Every feature card responds at its corners without an inherited entrance delay.
 for(const feature of await p.locator('.feature-card').all()){
  await feature.scrollIntoViewIfNeeded();const r=await feature.boundingBox();
  await p.mouse.move(r.x+r.width*.82,r.y+r.height*.25);await p.waitForTimeout(90);
  assert.ok(await feature.evaluate(e=>getComputedStyle(e).transitionDelay.split(',').every(v=>parseFloat(v)===0)));
  assert.ok(await feature.evaluate(e=>parseFloat(e.style.getPropertyValue('--tilt-y'))>1),'all three cards receive pointer tilt');
  assert.notEqual(await feature.evaluate(e=>getComputedStyle(e).transform),'none');
  await p.mouse.move(2,2);
 }
 for(const panel of await p.locator('.release-card,.code-panel,.step,.site-header').all()){
  await panel.scrollIntoViewIfNeeded();const r=await panel.boundingBox();
  const header=await panel.evaluate(e=>e.classList.contains('site-header'));
  await p.mouse.move(r.x+r.width*.75,header?r.y+r.height*.4:Math.max(100,Math.min(900,r.y+r.height*.4)));await p.waitForTimeout(80);
  assert.ok(await panel.evaluate(e=>Math.abs(parseFloat(e.style.getPropertyValue('--tilt-y')))>0),'glass surface receives tilt: '+await panel.getAttribute('class'));
  assert.notEqual(await panel.evaluate(e=>getComputedStyle(e).transform),'none');
  await p.mouse.move(2,2);
 }
 const staticPage=await context.newPage();staticPage.on('pageerror',e=>errors.push(e.message));
 await staticPage.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return t==='webgl'?null:get.call(this,t,...a);};});await staticPage.goto(base);await staticPage.waitForFunction(()=>document.querySelector('#particle-logo').dataset.renderer==='fallback');assert.equal(await staticPage.locator('.particle-fallback').evaluate(e=>e.complete&&e.naturalWidth>0),true);await staticPage.close();
 const touch=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});await touch.route('https://api.github.com/**',r=>r.fulfill({status:503,body:''}));
 const mobile=await touch.newPage();mobile.on('pageerror',e=>errors.push(e.message));await mobile.addInitScript(instrument);await mobile.goto(base);await mobile.locator('#particle-logo').scrollIntoViewIfNeeded();await mobile.waitForFunction(()=>window.__gpu&&__gpu.values.u_intro===1);
 const touchLogo=await mobile.locator('#particle-logo').boundingBox();assert.equal(await mobile.locator('#particle-logo').evaluate(e=>getComputedStyle(e).touchAction),'pan-y');
 await mobile.touchscreen.tap(touchLogo.x+touchLogo.width/2,touchLogo.y+touchLogo.height/2);await mobile.waitForFunction(()=>__gpu.values['u_ripples[0]'][3]===.625);assert.equal(await mobile.locator('.title-shine').first().evaluate(e=>getComputedStyle(e).display),'none');
 const cdp=await touch.newCDPSession(mobile),start=await mobile.evaluate(()=>scrollY),tx=touchLogo.x+touchLogo.width/2,ty=Math.min(720,touchLogo.y+touchLogo.height*.8);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:tx,y:ty}]});for(let i=1;i<=5;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:tx,y:ty-i*30}]});await mobile.waitForTimeout(20);}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await mobile.waitForTimeout(150);assert.ok(await mobile.evaluate(()=>scrollY)>start,'dragging the logo can scroll the mobile page');await touch.close();
 assert.deepEqual(errors,[]);console.log('Visuals passed: GPU formation, pointer repulsion, continuous directional drag paths, continuous soft reflections, three-card tilt, keyboard ripples, theme transitions, letter light, offscreen/reduced-motion pause, context recovery, WebGL fallback, responsive glass and native touch scrolling.');
 }finally{await context.close();await browser.close();server.close();}
}
main().catch(e=>{console.error(e);server.close();process.exitCode=1;});
