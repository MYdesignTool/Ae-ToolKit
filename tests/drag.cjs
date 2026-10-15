// Exercise real mouse gestures against the production panel; no AE scripts are executed.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const {root}=require('./helpers.cjs'),{bridge,data}=require('./motion.cjs');
async function main(){
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:626,height:900},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',error=>errors.push(String(error)));await page.addInitScript(bridge,data);
  await page.goto(pathToFileURL(path.join(root,'extension/client/index.html')).href);
  await page.waitForFunction(()=>AELT.state.ready&&AELT.state.scripts.length);
  await page.locator('[data-view=scripts]').click();
  // Ctrl+A from panel chrome must not highlight navigation, labels, buttons or status text.
  await page.locator('[data-view=scripts]').focus();await page.keyboard.press('ControlOrMeta+A');
  assert.equal(await page.evaluate(()=>getSelection().toString()),'');
  const label=await page.locator('#scriptsView > .field > span').boundingBox(),status=await page.locator('#statusBar').boundingBox();
  await page.mouse.move(label.x+2,label.y+label.height/2);await page.mouse.down();await page.mouse.move(status.x+80,status.y+status.height/2,{steps:12});await page.mouse.up();
  assert.equal(await page.evaluate(()=>getSelection().toString()),'','dragging across the panel cannot select labels or status text');
  const list=page.locator('#scriptList'),scroll=()=>list.evaluate(el=>el.scrollTop);
  async function drag(selector,distance){
   const box=await page.locator(selector).boundingBox();
   await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
   await page.mouse.move(box.x+box.width/2,box.y+box.height/2-distance,{steps:12});await page.mouse.up();
  }
  // Start on text, move upward and release outside the list without selecting or launching a row.
  await drag('.script-item:nth-child(5) .script-name',180);
  assert.equal(await scroll(),180);assert.equal(await page.evaluate(()=>getSelection().toString()),'');
  assert.equal(await page.evaluate(()=>AELT.state.selectedScriptFsName),null);assert.equal(await page.evaluate(()=>__launches),0);
  assert.equal(await list.evaluate(el=>el.classList.contains('is-dragging')),false);
  await drag('.script-item:nth-child(8) img',100);assert.equal(await scroll(),280);
  assert.equal(await page.evaluate(()=>getSelection().toString()),'');
  assert.equal(await page.locator('img').first().evaluate(el=>el.draggable),false);
  assert.equal(await list.evaluate(el=>el.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true}))),false);
  // Downward dragging follows the pointer; wheel scrolling remains native.
  await drag('.script-item:nth-child(10) .script-name',-80);assert.equal(await scroll(),200);
  await list.hover();await page.mouse.wheel(0,90);await page.waitForFunction(()=>document.getElementById('scriptList').scrollTop>200);
  // A small hand tremor is still a click, and a deliberate double-click still runs once.
  await list.evaluate(el=>el.scrollTop=0);const name=page.locator('.script-name').first(),box=await name.boundingBox();
  await page.mouse.move(box.x+10,box.y+8);await page.mouse.down();await page.mouse.move(box.x+10,box.y+6);await page.mouse.up();
  assert.equal(await page.locator('.script-item.active').count(),1);assert.equal(await page.evaluate(()=>__launches),0);
  await page.waitForTimeout(550);await name.dblclick();await page.waitForFunction(()=>__launches===1&&!AELT.state.scriptBusy);
  await page.locator('.script-fav').first().click();assert.equal(await page.locator('.script-fav').first().getAttribute('aria-pressed'),'true');assert.equal(await page.evaluate(()=>__launches),1);
  // A drag starting on the star scrolls rather than toggles the favorite.
  await drag('.script-item:nth-child(5) .script-fav',80);assert.equal(await scroll(),80);assert.equal(await page.locator('.script-fav.favored').count(),1);
  // Cancellation clears capture/cursor; a subsequent click is usable.
  await page.evaluate(()=>document.getElementById('scriptList').addEventListener('pointerdown',e=>window.__pointer=e.pointerId,{once:true}));
  const fifth=await page.locator('.script-item:nth-child(5) .script-name').boundingBox();await page.mouse.move(fifth.x+10,fifth.y+8);await page.mouse.down();await page.mouse.move(fifth.x+10,fifth.y-40,{steps:5});
  assert.equal(await list.evaluate(el=>el.classList.contains('is-dragging')),true);
  await page.evaluate(()=>document.getElementById('scriptList').dispatchEvent(new PointerEvent('pointercancel',{pointerId:__pointer,bubbles:true})));
  assert.equal(await list.evaluate(el=>el.classList.contains('is-dragging')),false);await page.mouse.up();
  await list.evaluate(el=>el.scrollTop=0);await name.click();assert.equal(await page.locator('.script-item.active').first().getAttribute('data-fsname'),data.scan.scripts[0].fsName);
  // Selection stays available in editable controls.
  await page.locator('#scriptSearch').fill('Tool');await page.locator('#scriptSearch').press('ControlOrMeta+A');
  assert.equal(await page.locator('#scriptSearch').evaluate(el=>el.selectionEnd-el.selectionStart),4);await page.locator('#scriptSearch').fill('');
  await page.locator('[data-view=expressions]').click();await page.locator('#expressionCode').fill('time * 24');await page.locator('#expressionCode').press('ControlOrMeta+A');
  assert.equal(await page.locator('#expressionCode').evaluate(el=>el.selectionEnd-el.selectionStart),9);
  await page.locator('[data-view=scripts]').click();await list.evaluate(el=>el.scrollTop=0);await page.mouse.move(2,2);
  const output=process.env.ARTIFACT_DIR||path.join(root,'.artifacts','drag');fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,'compact-drag-scripts.png')});
  assert.deepEqual(errors,[]);console.log('Drag passed: text/image/star panning, outside release, no panel selection or accidental execution, threshold clicks, double-click, favorites, wheel, cancellation and editable text selection.');
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
