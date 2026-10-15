// Browser motion checks and a short recording using the production panel and optional local scripts.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');const {chromium}=require('playwright');const {root,source}=require('./helpers.cjs');const {scanDirectory}=require('./filesystem-host.cjs');
const output=process.env.ARTIFACT_DIR||path.join(root,'.artifacts','motion');fs.mkdirSync(output,{recursive:true});
const directory=process.argv[2],scan=directory?scanDirectory(directory):{ok:true,messages:[],scripts:Array.from({length:24},(_,i)=>({name:'图层工具 '+(i+1),relativePath:'Tool'+i+'.jsx',fsName:'C:/example/Tool'+i+'.jsx',iconPath:''}))};
const data={rules:JSON.parse(source('extension/data/organizer-rules.json')),expressions:JSON.parse(source('extension/data/default-expressions.json')).expressions,changelog:JSON.parse(source('extension/data/changelog.json')),settings:{...JSON.parse(source('extension/data/settings.default.json')),scriptFolder:directory||'C:/example'},scan};
function bridge(data){
 const settings=data.settings;window.__launches=0;
 const api={AELT_setModuleBase:()=>({ok:true}),AELT_loadSettings:()=>({ok:true,settings}),AELT_saveSettings:()=>({ok:true}),AELT_bootstrap:()=>({ok:true,...data}),AELT_loadOrganizerSchemes:()=>({ok:true,schemes:[data.rules]}),AELT_scanScripts:()=>data.scan,AELT_getSelectedPropertySummary:()=>({ok:true,supported:0,existing:0,names:[],messages:[]}),AELT_launchScript:()=>{window.__launches++;return{ok:true};}};
 Object.assign(window,api);window.__adobe_cep__={evalScript(script,callback){setTimeout(()=>callback(JSON.stringify((0,eval)(script))),0);}};
}
const panel=pathToFileURL(path.join(root,'extension/client/index.html')).href;
async function load(context){await context.addInitScript(bridge,data);const page=await context.newPage();await page.goto(panel);await page.waitForFunction(()=>AELT.state.ready&&AELT.state.scripts.length);return page;}
async function main(){
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
 const context=await browser.newContext({viewport:{width:626,height:900},reducedMotion:'no-preference'}),page=await load(context),errors=[];page.on('pageerror',error=>errors.push(String(error)));
 await page.evaluate(()=>{document.querySelector('[data-view=scripts]').click();document.getElementById('scriptsView')._entranceAnimations.forEach(a=>{a.pause();a.currentTime=72;});});
 const entrance=await page.evaluate(()=>{
  const view=document.getElementById('scriptsView'),rows=[...view.querySelectorAll('.script-item')],animations=view._entranceAnimations;
  return {count:animations.length,total:rows.length,end:Math.max(...animations.map(a=>a.effect.getComputedTiming().endTime)),opacity:rows.slice(0,11).map(row=>Number(getComputedStyle(row).opacity))};
 });
 assert.ok(entrance.count<entrance.total,'offscreen scripts are not animated');assert.ok(entrance.end<=280,'entrance stays quick');assert.ok(entrance.opacity[0]>entrance.opacity[entrance.opacity.length-1],'rows rise in sequence');await page.screenshot({path:path.join(output,'entry-072.png')});
 await page.evaluate(()=>document.getElementById('scriptsView')._entranceAnimations.forEach(a=>a.currentTime=144));await page.screenshot({path:path.join(output,'entry-144.png')});
 await page.evaluate(()=>[...document.getElementById('scriptsView')._entranceAnimations].forEach(a=>a.finish()));await page.waitForFunction(()=>document.getElementById('scriptsView')._entranceAnimations.length===0);
 await page.waitForFunction(()=>[...document.querySelectorAll('.script-item img')].slice(0,12).every(image=>image.complete));await page.screenshot({path:path.join(output,'compact-scripts.png')});
 await page.locator('.script-item').first().click();await page.evaluate(()=>{
  const row=document.querySelector('.script-item');row.dataset.retained='yes';row.querySelector('.script-fav').click();document.getAnimations().forEach(a=>{a.pause();a.currentTime=72;});
 });
 assert.equal(await page.locator('.script-fav').first().getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.script-item').first().getAttribute('data-retained'),'yes');assert.equal(await page.locator('.fav-particle').count(),7);assert.equal(await page.evaluate(()=>__launches),0);
 const star=await page.locator('.script-fav').first().boundingBox();await page.screenshot({path:path.join(output,'favorite-072.png'),clip:{x:star.x-28,y:star.y-22,width:84,height:72}});
 await page.evaluate(()=>{document.getAnimations().forEach(a=>a.finish());});await page.waitForFunction(()=>!document.querySelector('.fav-burst'));
 await page.evaluate(()=>{const button=document.querySelector('.script-fav');for(let i=0;i<8;i++)button.click();});assert.ok(await page.locator('.fav-burst').count()<=1);await page.waitForFunction(()=>!document.querySelector('.fav-burst'));
 await page.locator('#favFilterBtn').click();assert.equal(await page.locator('.script-item').count(),1);await page.locator('.script-fav').click();assert.equal(await page.locator('.script-item').count(),0);assert.equal(await page.evaluate(()=>__launches),0);await page.locator('#favFilterBtn').click();
 await page.locator('#scriptList').evaluate(list=>list.scrollTop=300);const before=await page.locator('#scriptList').evaluate(list=>list.scrollTop);const favorite=page.locator('.script-item').nth(7).locator('.script-fav');await favorite.click();assert.equal(await page.locator('#scriptList').evaluate(list=>list.scrollTop),before,'favoriting preserves scroll');await page.waitForFunction(()=>!document.querySelector('.fav-burst'));
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('[data-view=expressions]').click();await page.locator('[data-view=scripts]').click();await favorite.click();assert.equal(await page.locator('.fav-burst').count(),0);assert.equal(await page.evaluate(()=>document.getElementById('scriptsView')._entranceAnimations.length),0);assert.deepEqual(errors,[]);await context.close();
 if(process.env.RECORD_VIDEO==='1'){
 const demoContext=await browser.newContext({viewport:{width:626,height:900},reducedMotion:'no-preference',recordVideo:{dir:output,size:{width:626,height:900}}}),demo=await load(demoContext),video=demo.video();
 await demo.waitForTimeout(200);await demo.locator('[data-view=scripts]').click();await demo.waitForTimeout(400);await demo.locator('.script-fav').first().click();await demo.waitForTimeout(500);await demo.locator('.script-fav').first().click();await demo.waitForTimeout(250);await demo.locator('[data-view=expressions]').click();await demo.waitForTimeout(250);await demo.locator('[data-view=scripts]').click();await demo.waitForTimeout(350);await demo.locator('.script-item').nth(2).locator('.script-fav').click();await demo.waitForTimeout(500);await demoContext.close();await video.saveAs(path.join(output,'interaction-demo.webm'));await video.delete();
 }
 console.log('Motion passed: staggered visible rows under 280 ms, stable favorite DOM and scroll, seven transient particles, rapid-click cleanup, favorite filter, no script launch on star click, reduced-motion support.');
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
