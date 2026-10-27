// Exercise visible animated dropdowns, rich expression rows and the native value bridge.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const {root}=require('./helpers.cjs'),{bridge,data}=require('./motion.cjs');
const output=path.join(root,'.artifacts','0.6.1');fs.mkdirSync(output,{recursive:true});
async function main(){
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:626,height:870},reducedMotion:'reduce'}),errors=[];page.setDefaultTimeout(10000);
    page.on('pageerror',error=>errors.push(error.message));
    const fixture=structuredClone(data);fixture.settings.userExpressions=[{id:'user-rich',name:'超长自定义 <tag>',code:'time * 5',tags:['wiggle','长标签'.repeat(25),'<img src=x>']}];
    await page.addInitScript(bridge,fixture);await require('./native-fixture.cjs').install(page);await page.goto(pathToFileURL(path.join(root,'extension/client/index.html')).href);await page.waitForFunction(()=>AELT.state.ready);
    const menu=page.locator('#aelt-select-menu'),trigger=id=>page.locator('[data-select-for="'+id+'"]');
    async function view(name){await page.locator('[data-view='+name+']').click();await page.waitForFunction(name=>document.getElementById(name+'View').classList.contains('active'),name);}
    async function choose(id,value){
      const index=await page.locator('#'+id).evaluate((select,value)=>Array.from(select.options).findIndex(option=>option.value===value),value);
      assert.ok(index>=0,id+': '+value);await trigger(id).click();await menu.locator('[data-option-index="'+index+'"]').click();await menu.waitFor({state:'hidden'});
    }
    await view('expressions');await trigger('expressionPresetSelect').click();await menu.waitFor();
    assert.equal(await menu.locator('[role=option]').count(),4);
    const wiggle=menu.locator('[data-option-index="1"]');
    assert.equal(await wiggle.locator('.select-name').textContent(),'基础抖动');assert.deepEqual(await wiggle.locator('.select-tag').allTextContents(),['常用','wiggle','抖动','随机']);
    for(const row of await menu.locator('.select-option:has(.select-tags)').all()){
      const bounds=await row.locator('.select-content').boundingBox(),name=await row.locator('.select-name').boundingBox(),tags=await row.locator('.select-tags').boundingBox();
      assert.ok(name.x+name.width<=tags.x,'name and tags occupy separate columns');assert.ok(Math.abs(tags.x+tags.width-bounds.x-bounds.width)<1,'tags align to the right edge');
    }
    assert.equal(await menu.locator('img,script').count(),0,'custom names/tags render as text');
    await page.screenshot({path:path.join(output,'expression-picker-zh-626.png'),animations:'disabled'});
    await wiggle.click();await menu.waitFor({state:'hidden'});assert.equal(await page.locator('.expression-select').inputValue(),'wiggle-basic');
    assert.equal(await page.locator('#expressionCode').inputValue(),'wiggle(5, 20)');
    assert.deepEqual(await trigger('expressionPresetSelect').locator('.select-tag').allTextContents(),['常用','wiggle','抖动','随机']);
    assert.equal(await page.locator('.expression-select option[value="wiggle-basic"]').textContent(),'基础抖动','native option no longer concatenates tags');
    await page.evaluate(()=>AELT.editor.setValue('value + 10'));await choose('expressionPresetSelect','blink-opacity');
    await page.locator('#inputModalCancel').click();assert.equal(await page.locator('.expression-select').inputValue(),'wiggle-basic');assert.equal(await page.locator('#expressionCode').inputValue(),'value + 10');
    await choose('expressionTagFilter','常用');await choose('expressionTagFilter','wiggle');assert.equal(await page.locator('#expressionFilterTags .rule-tag').count(),2);
    assert.equal(await page.locator('.expression-select option').count(),2);assert.equal(await page.locator('#expressionCode').inputValue(),'value + 10');
    await page.locator('#expressionFilterTags [data-filter-tags-clear]').click();
    // Existing-tag dropdown is portalled above the save dialog; Escape closes only this menu.
    await page.locator('#saveExpressionBtn').click();await trigger('inputModalTagSelect').click();await menu.waitFor();
    await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});assert.equal(await page.locator('#inputModal').isVisible(),true);
    await choose('inputModalTagSelect','opacity');assert.ok((await page.locator('#inputModalTagTokens .rule-tag-name').allTextContents()).includes('opacity'));
    assert.equal(await page.locator('#inputModalTags').evaluate(el=>el===document.activeElement),true);
    await page.locator('#inputModalCancel').click();
    // Keyboard navigation keeps focus on the combobox and never changes a value until accepted.
    await trigger('expressionPresetSelect').focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('End');
    assert.equal(await page.locator('.expression-select').inputValue(),'wiggle-basic');await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});
    await page.evaluate(()=>AELT.editor.setValue('wiggle(5, 20)'));await trigger('expressionPresetSelect').focus();await page.keyboard.press('Enter');await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
    assert.equal(await page.locator('.expression-select').inputValue(),'blink-opacity');assert.equal(await page.locator('#expressionCode').inputValue(),'Math.sin(time * 10) > 0 ? 100 : 0');
    await view('organizer');await trigger('schemeSelect').click();assert.ok(await menu.locator('.select-group').count()>0);await page.keyboard.press('Escape');
    await view('settings');await choose('languageSelect','en');await page.waitForFunction(()=>document.documentElement.lang==='en');
    assert.equal(await trigger('expressionCompletionKeySelect').getAttribute('aria-label'),'Accept suggestion key');await choose('expressionCompletionKeySelect','Tab');assert.equal(await page.evaluate(()=>AELT.settings.get('expressionCompletionKey')),'Tab');
    await page.setViewportSize({width:360,height:520});
    for(const id of ['languageSelect','animationScaleSelect','expressionCompletionKeySelect']){
      await trigger(id).scrollIntoViewIfNeeded();const bounds=await trigger(id).boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=360,'visible settings dropdown fits: '+id);
    }
    await page.setViewportSize({width:626,height:870});
    await view('expressions');
    for(const width of [360,626]){
      await page.setViewportSize({width,height:520});await trigger('expressionPresetSelect').click();await menu.waitFor();
      const bounds=await menu.boundingBox();assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width&&bounds.y+bounds.height<=520,JSON.stringify(bounds));
      assert.equal(await menu.evaluate(el=>el.scrollWidth<=el.clientWidth),true,'long tags wrap without horizontal overflow');
      await page.screenshot({path:path.join(output,'expression-picker-en-'+width+'.png'),animations:'disabled'});
      await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});
    }
    await page.setViewportSize({width:626,height:870});
    // Pause real animations for deterministic duration/interruption checks.
    await page.evaluate(()=>{const original=animateMotion;window.animateMotion=function(element,frames,options){const animation=original(element,frames,options);if(element.classList.contains('custom-select-menu'))animation.pause();return animation;};});
    await page.emulateMedia({reducedMotion:'no-preference'});
    async function timing(){return menu.evaluate(el=>({duration:el._popupAnimation.effect.getTiming().duration,state:el.dataset.popupMotion,pointer:getComputedStyle(el).pointerEvents}));}
    async function finish(state){await menu.evaluate(el=>el._popupAnimation.finish());await page.waitForFunction(state=>document.getElementById('aelt-select-menu').dataset.popupMotion===state,state);}
    for(const scale of [.5,1,2]){
      await page.evaluate(scale=>setAnimationScale(scale),scale);await trigger('expressionPresetSelect').click();assert.equal((await timing()).duration,140*scale);await finish('open');
      await trigger('expressionPresetSelect').click();assert.equal((await timing()).duration,110*scale);assert.equal((await timing()).pointer,'none');assert.equal(await trigger('expressionPresetSelect').getAttribute('aria-expanded'),'false');await finish('closed');await menu.waitFor({state:'hidden'});
    }
    await page.evaluate(()=>setAnimationScale(1));await trigger('expressionPresetSelect').click();await finish('open');await trigger('expressionPresetSelect').click();
    await menu.evaluate(el=>el._popupAnimation.currentTime=55);await trigger('expressionPresetSelect').click();assert.equal((await timing()).state,'opening');await finish('open');assert.equal(await menu.isVisible(),true,'reopening cancels stale exit');
    await trigger('expressionPresetSelect').click();await page.evaluate(()=>setAnimationScale(0));await menu.waitFor({state:'hidden'});
    await trigger('expressionPresetSelect').click();assert.equal(await menu.getAttribute('data-popup-motion'),'open');await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});
    await page.evaluate(()=>setAnimationScale(1));await page.emulateMedia({reducedMotion:'reduce'});await trigger('expressionPresetSelect').click();assert.equal(await menu.getAttribute('data-popup-motion'),'open');
    await page.locator('#expressionSearch').click();await menu.waitFor({state:'hidden'});assert.deepEqual(errors,[]);
    console.log('Visible dropdown checks passed: left names/right tag chips, safe text, native values, dirty cancellation, multi-tag filtering, modal tag choices, keyboard/optgroups, settings changes, bilingual 360/626px fit, 0.5x/1x/2x entry/exit, quick reopening, Off and reduced motion.');
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
