// Real panel navigation: directional batches, interrupted transitions, retained scroll and reduced motion.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');const {root}=require('./helpers.cjs'),{bridge,data}=require('./motion.cjs');
async function main(){
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:626,height:900},reducedMotion:'no-preference'}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));await page.addInitScript(bridge,data);await page.goto(pathToFileURL(path.join(root,'extension/client/index.html')).href);
  await page.waitForFunction(()=>AELT.state.ready&&AELT.state.scripts.length);
  const output=process.env.ARTIFACT_DIR||path.join(root,'.artifacts','navigation');fs.mkdirSync(output,{recursive:true});
  async function active(name){await page.waitForFunction(name=>document.getElementById(name+'View').classList.contains('active')&&!document.querySelector('.is-exiting'),name);}
  async function finishEntrance(){await page.evaluate(()=>{const view=document.querySelector('.view.active');(view._entranceAnimations||[]).slice().forEach(a=>a.finish());});await page.waitForFunction(()=>!document.querySelector('.view.active')._entranceAnimations.length);}
  async function finishExit(){await page.evaluate(()=>document.querySelector('.is-exiting')._exitAnimations.slice().forEach(a=>a.finish()));}
  await page.locator('[data-view=scripts]').click();await active('scripts');await finishEntrance();
  await page.locator('#scriptList').evaluate(el=>el.scrollTop=200);
  await page.evaluate(()=>{document.querySelector('[data-view=expressions]').click();document.getElementById('scriptsView')._exitAnimations.forEach(a=>{a.pause();a.currentTime=55;});});
  const right=await page.evaluate(()=>{const view=document.getElementById('scriptsView'),animations=view._exitAnimations;return{pointer:getComputedStyle(view).pointerEvents,hidden:view.getAttribute('aria-hidden'),count:animations.length,all:document.querySelectorAll('.script-item').length,end:Math.max(...animations.map(a=>a.effect.getComputedTiming().endTime)),delays:animations.map(a=>a.effect.getTiming().delay),targets:animations.map(a=>a.effect.getKeyframes().at(-1).transform),shift:new DOMMatrix(getComputedStyle(animations[0].effect.target).transform).m41};});
  assert.equal(right.pointer,'none');assert.equal(right.hidden,'true');assert.ok(right.count<right.all);assert.ok(right.end<=160);assert.ok(right.targets.every(t=>t==='translateX(-12px)'));assert.ok(right.shift<0);
  assert.equal(right.delays[0],right.delays[2]);assert.ok(right.delays[3]>right.delays[2],'cards leave in batches');await page.screenshot({path:path.join(output,'exit-to-right-055.png')});
  await finishExit();await active('expressions');await finishEntrance();
  await page.evaluate(()=>{document.querySelector('[data-view=scripts]').click();document.getElementById('expressionsView')._exitAnimations.forEach(a=>{a.pause();a.currentTime=55;});});
  assert.ok(await page.evaluate(()=>document.getElementById('expressionsView')._exitAnimations.every(a=>a.effect.getKeyframes().at(-1).transform==='translateX(12px)')));await page.screenshot({path:path.join(output,'exit-to-left-055.png')});
  await finishExit();await active('scripts');assert.equal(await page.locator('#scriptList').evaluate(el=>el.scrollTop),200);
  // Reverse while the new page is still entering; exit starts exactly at the current pose.
  const continuity=await page.evaluate(()=>{
   const view=document.getElementById('scriptsView');view._entranceAnimations.forEach(a=>{a.pause();a.currentTime=80;});
   const target=view._entranceAnimations[0].effect.target,style=getComputedStyle(target),before={opacity:style.opacity,transform:style.transform};
   document.querySelector('[data-view=expressions]').click();view._exitAnimations.forEach(a=>{a.pause();a.currentTime=0;});
   return {before,after:{opacity:getComputedStyle(target).opacity,transform:getComputedStyle(target).transform}};
  });assert.deepEqual(continuity.after,continuity.before);await finishExit();await active('expressions');await finishEntrance();
  await page.evaluate(()=>['settings','organizer','settings','scripts'].forEach(name=>document.querySelector('[data-view='+name+']').click()));
  await active('scripts');await page.waitForTimeout(400);
  assert.equal(await page.locator('.view.active').getAttribute('id'),'scriptsView');assert.equal(await page.locator('.view.active').count(),1);assert.equal(await page.locator('.view[aria-hidden=true]').count(),0);
  assert.equal(await page.evaluate(()=>Array.from(document.querySelectorAll('.view')).some(v=>(v._exitAnimations||[]).length)),false);
  assert.equal(await page.locator('.tab[aria-selected=true]').getAttribute('data-view'),'scripts');assert.equal(await page.locator('#scriptList').evaluate(el=>el.scrollTop),200);
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('[data-view=expressions]').click();await active('expressions');assert.equal(await page.evaluate(()=>document.querySelector('.view.active')._entranceAnimations.length),0);
  await page.locator('[data-view=expressions]').focus();await page.keyboard.press('ArrowLeft');await active('scripts');assert.equal(await page.locator('.is-exiting').count(),0);assert.equal(await page.evaluate(()=>__launches),0);
  assert.deepEqual(errors,[]);console.log('Navigation passed: left/right exits, visible cards in batches under 160ms, pose continuity, rapid retargeting, one active view, scroll preserved, keyboard and reduced-motion support.');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
