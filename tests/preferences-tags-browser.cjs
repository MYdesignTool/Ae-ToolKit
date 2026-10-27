// Exercise the actual panel with a persistent mock bridge; no AE data is written.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const {root}=require('./helpers.cjs'),{data}=require('./motion.cjs');
const output=path.join(root,'.artifacts','preferences-tags');fs.mkdirSync(output,{recursive:true});
function bridge(data){
  let settings=JSON.parse(localStorage.getItem('preferences-tags')||'null')||{...data.settings,userExpressions:[
    {id:'user-legacy',name:'旧名称',code:'time * 12',category:'自定义',tags:['动画']},
    {id:'user-other',name:'Other',code:'time',tags:['Other']}
  ]};
  delete settings.animationScale; // Simulate upgrading an old preference document on initial load only.
  const stored=JSON.parse(localStorage.getItem('preferences-tags')||'null');if(stored)settings=stored;
  const api={
    AELT_setModuleBase:()=>({ok:true}),AELT_loadSettings:()=>({ok:true,settings}),
    AELT_saveSettings:value=>{if(window.__failSave)return{ok:false,messages:['disk full']};settings=value;localStorage.setItem('preferences-tags',JSON.stringify(value));return{ok:true};},
    AELT_bootstrap:()=>({ok:true,...data}),AELT_loadOrganizerSchemes:()=>({ok:true,schemes:[data.rules]}),AELT_scanScripts:()=>data.scan,
    AELT_getSelectedPropertySummary:()=>({ok:true,supported:0,existing:0,names:[],messages:[]})
  };
  Object.assign(window,api);window.__adobe_cep__={evalScript(script,cb){setTimeout(()=>{try{cb(JSON.stringify((0,eval)(script)));}catch(e){cb(JSON.stringify({ok:false,messages:[String(e)]}));}},0);}};
}
async function main(){
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:626,height:870},reducedMotion:'no-preference'}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(10000);
    await page.addInitScript(bridge,data);await require('./native-fixture.cjs').install(page);const url=pathToFileURL(path.join(root,'extension/client/index.html')).href;
    await page.goto(url);await page.waitForFunction(()=>AELT.state.ready);
    assert.equal(await page.evaluate(()=>AELT.state.animationScale),1);
    async function view(name){await page.locator('[data-view='+name+']').click();await page.waitForFunction(name=>document.getElementById(name+'View').classList.contains('active'),name);await page.evaluate(()=>document.getAnimations().filter(a=>a._aeltMotionScale).forEach(a=>a.finish()));}
    async function saved(){await page.waitForFunction(()=>!AELT.state.expressionBusy);}
    await view('settings');
    for(const [scale,duration] of [['2','0.14s'],['1','0.07s'],['0.5','0.035s'],['0','0s']]){
      await page.locator('#animationScaleSelect').selectOption(scale);
      assert.equal(await page.locator('.tab-indicator').evaluate(el=>getComputedStyle(el).transitionDuration.split(',')[0]),duration);
      if(scale!=='0'){
        const timing=await page.evaluate(()=>{const view=document.getElementById('settingsView');animateViewEntrance(view);const a=view._entranceAnimations[0];const result=a.effect.getTiming();view._entranceAnimations.slice().forEach(a=>a.finish());return result;});
        assert.equal(timing.duration,100*Number(scale));
      }
      await page.waitForFunction(scale=>JSON.parse(localStorage.getItem('preferences-tags')).animationScale===Number(scale),scale);
    }
    await page.reload();await page.waitForFunction(()=>AELT.state.ready);assert.equal(await page.evaluate(()=>AELT.state.animationScale),0);
    await view('scripts');await page.locator('.script-fav').first().click();assert.equal(await page.locator('.fav-burst').count(),0);
    assert.equal(await page.evaluate(()=>document.getElementById('scriptsView')._entranceAnimations.length),0);
    await view('settings');await page.locator('#animationScaleSelect').selectOption('2');
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.documentElement.dataset.motion==='off');
    await view('scripts');assert.equal(await page.evaluate(()=>document.getElementById('scriptsView')._entranceAnimations.length),0);
    await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>document.documentElement.dataset.motion==='on');
    // Disabling effects during an exit must still complete navigation.
    await page.evaluate(()=>{document.querySelector('[data-view=expressions]').click();setAnimationScale(0);});
    await page.waitForFunction(()=>document.getElementById('expressionsView').classList.contains('active')&&!document.querySelector('.is-exiting'));
    const select=page.locator('.expression-select');
    await select.selectOption('user-legacy');assert.ok((await page.locator('#expressionTags').textContent()).includes('自定义'));
    const tagInput=page.locator('#inputModalTags'),tagTokens=page.locator('#inputModalTagTokens');
    const tagSelect=page.locator('#inputModalTagSelect'),filter=page.locator('#expressionTagFilter'),filterTags=page.locator('#expressionFilterTags');
    async function clearTags(){while(await tagTokens.locator('button').count())await tagTokens.locator('button').first().click();}
    async function setFilters(tags){if(await filterTags.isVisible())await filterTags.locator('[data-filter-tags-clear]').click();for(const tag of tags)await filter.selectOption(tag);}
    await page.locator('#editExpressionTagsBtn').click();assert.equal(await tagInput.inputValue(),'');
    assert.deepEqual(await tagTokens.locator('.rule-tag-name').allTextContents(),['动画','自定义']);
    assert.ok((await tagSelect.locator('option').allTextContents()).includes('wiggle'),'built-in tags are available');
    assert.ok((await tagSelect.locator('option').allTextContents()).includes('Other'),'other custom expressions supply existing tags');
    await tagSelect.selectOption('wiggle');assert.deepEqual(await tagTokens.locator('.rule-tag-name').allTextContents(),['动画','自定义','wiggle']);
    assert.equal(await tagSelect.locator('option[value=wiggle]').count(),0,'chosen tags are excluded from existing choices');
    await page.getByRole('button',{name:'移除标签 wiggle',exact:true}).click();assert.equal(await tagSelect.locator('option[value=wiggle]').count(),1,'removed tags become selectable again');
    await tagInput.fill('discarded');await tagInput.press('Enter');assert.equal(await page.locator('#inputModal').isVisible(),true,'Enter adds a tag without saving the expression');
    assert.deepEqual(await tagTokens.locator('.rule-tag-name').allTextContents(),['动画','自定义','discarded']);
    await page.keyboard.press('Escape');assert.equal(await page.locator('#expressionCode').inputValue(),'time * 12');
    await page.locator('#editExpressionTagsBtn').click();await page.locator('#inputModalField').fill('位置 Motion');
    await clearTags();await tagSelect.selectOption('常用');await tagInput.fill('位置, 常用，位置, XSS <tag>');await tagInput.press('Enter');assert.equal(await tagInput.inputValue(),'');
    // Reorder by removing/re-adding the picked tag; typed and existing tags share one token list.
    await page.getByRole('button',{name:'移除标签 常用',exact:true}).click();await tagSelect.selectOption('常用');
    await page.getByRole('button',{name:'移除标签 XSS <tag>',exact:true}).click();await tagInput.fill('XSS <tag>');await tagInput.press('Enter');
    assert.deepEqual(await tagTokens.locator('.rule-tag-name').allTextContents(),['位置','常用','XSS <tag>']);assert.equal(await tagTokens.locator('tag').count(),0,'user tag text is not HTML');
    await tagInput.fill('xss <TAG>');await tagInput.press('Enter');assert.equal(await tagTokens.locator('.rule-tag').count(),3,'case-insensitive duplicates are ignored');
    await tagInput.fill('临时');await tagInput.press('Enter');await page.getByRole('button',{name:'移除标签 临时',exact:true}).click();assert.equal(await tagTokens.locator('.rule-tag').count(),3);
    await tagInput.fill('输入法');await tagInput.dispatchEvent('compositionstart');await tagInput.press('Enter');assert.equal(await tagTokens.locator('.rule-tag').count(),3,'IME Enter cannot create a tag');
    await tagInput.dispatchEvent('compositionend');await tagInput.fill('');
    await page.locator('#inputModalField').focus();for(let i=0;i<4;i++)await page.keyboard.press('Tab');assert.equal(await tagInput.evaluate(el=>el===document.activeElement),true,'focus trap includes tag removal controls');
    await page.keyboard.press('Tab');assert.equal(await tagSelect.evaluate(el=>AELT.selects.control(el)===document.activeElement),true,'existing tag chooser is keyboard reachable');await page.keyboard.press('Shift+Tab');
    await page.locator('#inputModalOk').click();await saved();
    let item=await page.evaluate(()=>AELT.state.expressions.find(item=>item.id==='user-legacy'));
    assert.deepEqual(item.tags,['位置','常用','XSS <tag>']);assert.equal(item.category,undefined);assert.equal(item.code,'time * 12');
    await page.locator('#expressionSearch').fill('motion');await setFilters(['位置','常用']);assert.equal(await select.locator('option').count(),2);
    assert.deepEqual(await filterTags.locator('.rule-tag-name').allTextContents(),['位置','常用']);assert.equal(await filter.locator('option[value="位置"]').count(),0,'selected filter tags cannot be duplicated');
    await filter.selectOption('Other');assert.equal(await select.locator('option').count(),1,'every selected tag is required, rather than any one tag');assert.equal(await page.locator('#expressionCode').inputValue(),'time * 12');
    await filterTags.getByRole('button',{name:'移除筛选标签 Other',exact:true}).click();assert.equal(await select.locator('option').count(),2);
    await setFilters(['Other']);await page.locator('#expressionSearch').fill('');assert.equal(await select.locator('option').count(),2);
    await setFilters([]);await page.locator('#expressionSearch').fill('随机');assert.equal(await select.locator('option').count(),1,'name search excludes tags and descriptions');
    await page.locator('#expressionSearch').fill('');await select.selectOption('user-legacy');
    // Failed metadata writes leave the selected preset and editor intact.
    await page.evaluate(()=>window.__failSave=true);await page.locator('#editExpressionTagsBtn').click();await page.locator('#inputModalTags').fill('Failed');await page.locator('#inputModalOk').click();await saved();
    assert.equal(await page.locator('#expressionTags').textContent(),'位置 · 常用 · XSS <tag>');await page.evaluate(()=>window.__failSave=false);
    await setFilters(['位置','常用']);await page.locator('#editExpressionTagsBtn').click();await clearTags();await page.locator('#inputModalOk').click();await saved();
    assert.equal(await page.locator('#expressionTags').textContent(),'无标签');
    assert.deepEqual(await page.evaluate(()=>expressionTagSelection),['常用'],'obsolete filters are removed when their last source tag disappears');await setFilters([]);
    // A blank editor saves without silently adding the old custom category/tag.
    await select.selectOption('');await page.evaluate(()=>AELT.editor.setValue('time * 24'));await page.locator('#saveExpressionBtn').click();
    assert.equal(await page.locator('#inputModalTags').inputValue(),'');await page.locator('#inputModalField').fill('New preset');await page.locator('#inputModalOk').click();await saved();
    item=await page.evaluate(()=>AELT.state.expressions.find(item=>item.id===AELT.state.selectedExpressionId));assert.deepEqual(item.tags,[]);assert.equal(item.category,undefined);
    await page.locator('#editExpressionTagsBtn').click();await tagInput.fill('Pending tag');await page.locator('#inputModalOk').click();await saved();
    item=await page.evaluate(()=>AELT.state.expressions.find(item=>item.id===AELT.state.selectedExpressionId));assert.deepEqual(item.tags,['Pending tag'],'Save retains the tag draft even without pressing Enter');
    await page.locator('#editExpressionTagsBtn').click();await tagSelect.selectOption('wiggle');await page.locator('#inputModalOk').click();await saved();
    item=await page.evaluate(()=>AELT.state.expressions.find(item=>item.id===AELT.state.selectedExpressionId));assert.deepEqual(item.tags,['Pending tag','wiggle'],'existing tag selection is saved with typed tags');
    await page.reload();await page.waitForFunction(()=>AELT.state.ready);await view('expressions');await select.selectOption('user-legacy');assert.equal(await page.locator('#expressionTags').textContent(),'无标签');
    assert.deepEqual(await page.evaluate(()=>AELT.state.expressions.find(item=>item.name==='New preset').tags),['Pending tag','wiggle'],'existing and typed tags survive reload together');
    await view('settings');await page.locator('#languageSelect').selectOption('en');await view('expressions');
    assert.equal(await page.locator('#expressionTagFilter option').first().textContent(),'All tags');assert.equal(await page.locator('#editExpressionTagsBtn').textContent(),'Name and tags');
    await page.locator('#editExpressionTagsBtn').click();assert.equal(await page.locator('#inputModalTags').getAttribute('aria-label'),'Expression tags');
    assert.equal(await tagSelect.getAttribute('aria-label'),'Choose an existing tag');
    await page.setViewportSize({width:360,height:520});await tagInput.fill('Animation, Favorites, Motion Graphics');await tagInput.press('Enter');
    await tagInput.fill('Very long tag '+ 'x'.repeat(160));await tagInput.press('Enter');
    assert.equal(await page.locator('#inputModalTagsEditor').evaluate(el=>el.scrollWidth<=el.clientWidth),true,'long tags wrap inside a compact dialog');
    for(const button of ['#inputModalOk','#inputModalCancel']){const box=await page.locator(button).boundingBox();assert.ok(box.x>=0&&box.x+box.width<=360&&box.y+box.height<=520,'save/cancel fit compact dialog');}
    await page.screenshot({path:path.join(output,'expression-tag-dialog-en-360.png'),animations:'disabled'});
    await page.keyboard.press('Escape');
    await view('settings');await page.locator('#languageSelect').selectOption('zh-CN');await view('expressions');await page.locator('#editExpressionTagsBtn').click();
    await tagInput.fill('常用, wiggle, 抖动, 随机');await tagInput.press('Enter');assert.equal(await page.locator('#inputModal').isVisible(),true);
    await page.screenshot({path:path.join(output,'expression-tag-dialog-zh-360.png'),animations:'disabled'});await page.keyboard.press('Escape');
    await view('settings');await page.locator('#languageSelect').selectOption('en');await view('expressions');
    await select.selectOption('wiggle-basic');assert.equal(await page.locator('#editExpressionTagsBtn').isVisible(),false);
    await setFilters(['常用','wiggle','抖动','随机']);assert.deepEqual(await page.evaluate(()=>expressionTagSelection),['常用','wiggle','抖动','随机']);
    assert.equal(await select.locator('option').count(),2);assert.equal(await select.inputValue(),'wiggle-basic','filter updates preserve selected expression');
    await page.setViewportSize({width:360,height:520});await page.screenshot({path:path.join(output,'expressions-en-360.png'),animations:'disabled'});
    for(const selector of ['#expressionSearch','#expressionTagFilter','#expressionFilterTags','.expression-select','.CodeMirror','#applyExpressionBtn']){
      const box=await page.locator(selector).boundingBox();assert.ok(box.x>=0&&box.x+box.width<=360,selector+' fits');
    }
    const editor=await page.locator('.CodeMirror').boundingBox(),status=await page.locator('#editorStatus').boundingBox(),actions=await page.locator('.expression-actions').boundingBox();
    assert.ok(editor.y+editor.height<=status.y&&status.y+status.height<=actions.y,'editor, syntax status and actions do not overlap');
    await page.locator('#applyExpressionBtn').scrollIntoViewIfNeeded();const applyBounds=await page.locator('#applyExpressionBtn').boundingBox();assert.ok(applyBounds.y>=0&&applyBounds.y+applyBounds.height<=520,'actions remain reachable when selected tags wrap');
    await view('settings');await page.locator('#languageSelect').selectOption('zh-CN');await page.locator('#animationScaleSelect').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'settings-zh-360.png'),animations:'disabled'});
    assert.ok(await page.locator('#animationScaleSelect').evaluate(el=>el.getBoundingClientRect().right<=innerWidth));
    await page.setViewportSize({width:626,height:870});await view('expressions');await page.locator('#expressionsView').evaluate(el=>el.scrollTop=0);
    await page.screenshot({path:path.join(output,'expression-multiple-filter-tags-zh.png'),animations:'disabled'});
    assert.deepEqual(await filterTags.locator('.rule-tag-name').allTextContents(),['常用','wiggle','抖动','随机']);
    await setFilters([]);await select.selectOption('user-legacy');
    await page.screenshot({path:path.join(output,'expressions-zh.png'),animations:'disabled'});await page.locator('#editExpressionTagsBtn').click();await page.screenshot({path:path.join(output,'tags-dialog-zh.png'),animations:'disabled'});
    assert.deepEqual(errors,[]);console.log('Preferences/tags passed: all scales, defaults/reload, CSS and WAAPI, mid-exit disable, reduced motion, legacy tags, metadata editing/cancel/failure, independent and combined filters, untagged presets, bilingual UI and 360px layout.');
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
