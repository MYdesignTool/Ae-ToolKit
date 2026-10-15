// Browser checks for stable randomized artwork and responsive header placement.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const {root}=require('./helpers.cjs'),{bridge,data}=require('./motion.cjs');
async function main(){
 const fixture=JSON.parse(JSON.stringify(data));
 fixture.scan.scripts[0].iconPath='missing-banner.png';
 fixture.scan.scripts[1].iconPath=pathToFileURL(path.join(root,'extension/client/images/placeholder-ribbon.webp')).href;
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:626,height:900},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',error=>errors.push(String(error)));await page.addInitScript(bridge,fixture);
  // Deterministically exercise both random choices without a probabilistic assertion.
  await page.addInitScript(()=>{let n=0;Math.random=()=>++n%2?.2:.8;});
  await page.goto(pathToFileURL(path.join(root,'extension/client/index.html')).href);
  await page.waitForFunction(()=>AELT.state.ready&&AELT.state.scripts.length);
  await page.locator('[data-view=scripts]').click();
  async function imagesReady(){await page.locator('.script-icon-img').evaluateAll(images=>images.forEach(img=>img.loading='eager'));await page.waitForFunction(()=>[...document.querySelectorAll('.script-icon-img')].every(i=>i.complete&&i.naturalWidth>0));}
  await imagesReady();
  const sources=()=>page.locator('.script-item').evaluateAll(rows=>Object.fromEntries(rows.map(row=>[row.dataset.fsname,row.querySelector('img').src])));
  const before=await sources();
  const chosen=await page.locator('.script-icon.placeholder img').evaluateAll(images=>[...new Set(images.map(i=>i.src.split('/').pop()))].sort());
  assert.deepEqual(chosen,['placeholder-landscape.webp','placeholder-ribbon.webp']);
  assert.equal(await page.locator('.script-icon-img').first().getAttribute('data-fallback'),'true');
  assert.equal(await page.locator('.script-icon').nth(1).evaluate(el=>el.classList.contains('placeholder')),false,'a script image remains preferred');
  await page.locator('#scriptSearch').fill('图层工具 2');for(const [key,value] of Object.entries(await sources()))assert.equal(value,before[key]);
  await page.locator('#scriptSearch').fill('');await imagesReady();assert.deepEqual(await sources(),before);
  await page.locator('.script-fav').first().click();await page.locator('#favFilterBtn').click();assert.equal(await page.locator('.script-item').count(),1);await imagesReady();
  assert.equal((await sources())[fixture.scan.scripts[0].fsName],before[fixture.scan.scripts[0].fsName]);
  await page.locator('#favFilterBtn').click();await page.locator('#refreshScriptsBtn').click();await page.waitForFunction(()=>!AELT.state.scriptBusy);await imagesReady();assert.deepEqual(await sources(),before,'rescanning does not reshuffle placeholders');
  const output=process.env.ARTIFACT_DIR||path.join(root,'.artifacts','artwork');fs.mkdirSync(output,{recursive:true});
  for(const width of [626,360]){
   await page.setViewportSize({width,height:width===626?900:520});
   const header=await page.locator('.brand-art').evaluate(img=>{const r=img.getBoundingClientRect();return{loaded:img.complete&&img.naturalWidth>0,drag:img.draggable,alt:img.alt,left:r.left,right:r.right,bottom:r.bottom};});
   const version=await page.locator('#versionLabel').boundingBox(),tabs=await page.locator('.tabs').boundingBox();
   assert.equal(header.loaded,true);assert.equal(header.drag,false);assert.equal(header.alt,'AE工具箱');assert.ok(header.left>=0&&header.right<version.x&&header.bottom<=tabs.y);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.mouse.move(2,2);await page.screenshot({path:path.join(output,'artwork-'+width+'.png')});
  }
  assert.deepEqual(errors,[]);console.log('Artwork passed: both random banners, stable across search/filter/refresh, missing-image fallback, script-image priority, loaded header, and no overlap at 626/360 px.');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
