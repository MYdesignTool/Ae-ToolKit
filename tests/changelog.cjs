// Check merged release notes and the illustrated modal on wide and narrow panels.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const {root}=require('./helpers.cjs'),{bridge,data}=require('./motion.cjs');
async function main(){
 assert.equal(data.changelog.version,'0.3.1');assert.equal(data.changelog.entries[0].version,'0.3.1');assert.equal(data.changelog.entries[0].changes.length,6);assert.ok(!data.changelog.entries.some(e=>e.version==='0.3.0'));assert.equal(data.changelog.entries[1].version,'0.2.6');
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:626,height:900},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.addInitScript(bridge,data);
  await page.goto(pathToFileURL(path.join(root,'extension/client/index.html')).href);await page.waitForFunction(()=>AELT.state.ready);
  const output=process.env.ARTIFACT_DIR||path.join(root,'.artifacts','changelog');fs.mkdirSync(output,{recursive:true});
  for(const width of [626,360]){
   await page.setViewportSize({width,height:width===626?900:520});await page.locator('[data-view=scripts]').focus();await page.locator('#versionLabel').click();
   await page.waitForFunction(()=>{const i=document.querySelector('.changelog-intro img');return i.complete&&i.naturalWidth>0;});
   assert.equal(await page.locator('#changelogModal [role=dialog]').getAttribute('aria-labelledby'),'changelogTitle');assert.equal(await page.locator('.changelog-current li').count(),6);assert.ok(!(await page.locator('#changelogBody').textContent()).includes('v0.3.0'));
   const bounds=await page.locator('#changelogModal .modal-content').boundingBox(),close=await page.locator('#closeChangelogBtn').boundingBox();
   assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width);assert.ok(bounds.y>=0&&bounds.y+bounds.height<=page.viewportSize().height);assert.ok(close.y>=0&&close.y+close.height<=page.viewportSize().height);
   assert.equal(await page.locator('#changelogBody').evaluate(el=>el.scrollWidth>el.clientWidth),false);await page.mouse.move(2,2);await page.screenshot({path:path.join(output,'changelog-'+width+'.png')});
   await page.locator('#changelogBody').evaluate(el=>el.scrollTop=el.scrollHeight);assert.ok(await page.locator('#changelogBody').evaluate(el=>el.scrollTop)>0,'history is scrollable');
   await page.locator('#changelogBody').focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'openRepoBtn');await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'changelogBody');
   await page.keyboard.press('Escape');assert.equal(await page.locator('#changelogModal').isVisible(),false);assert.equal(await page.locator('#versionLabel').evaluate(el=>el===document.activeElement),true);
   await page.locator('#versionLabel').click();assert.equal(await page.locator('#changelogBody').evaluate(el=>el.scrollTop),0);await page.locator('#closeChangelogBtn').click();
  }
  assert.deepEqual(errors,[]);console.log('Changelog passed: merged six-point 0.3.1, no invented version, prior history retained, local team image, 626/360px layout, scrolling, focus containment, Escape and reopen reset.');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
