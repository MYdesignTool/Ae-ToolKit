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
    await page.locator('#editExpressionTagsBtn').click();assert.equal(await page.locator('#inputModalTags').inputValue(),'动画, 自定义');
    await page.locator('#inputModalTags').fill('discarded');await page.keyboard.press('Escape');assert.equal(await page.locator('#expressionCode').inputValue(),'time * 12');
    await page.locator('#editExpressionTagsBtn').click();await page.locator('#inputModalField').fill('位置 Motion');
    await page.locator('#inputModalTags').fill('位置, 常用，位置, XSS <tag>');
    await page.locator('#inputModalField').focus();await page.keyboard.press('Tab');assert.equal(await page.locator('#inputModalTags').evaluate(el=>el===document.activeElement),true);
    await page.locator('#inputModalOk').click();await saved();
    let item=await page.evaluate(()=>AELT.state.expressions.find(item=>item.id==='user-legacy'));
    assert.deepEqual(item.tags,['位置','常用','XSS <tag>']);assert.equal(item.category,undefined);assert.equal(item.code,'time * 12');
    await page.locator('#expressionSearch').fill('motion');await page.locator('#expressionTagFilter').selectOption('位置');assert.equal(await select.locator('option').count(),2);
    await page.locator('#expressionTagFilter').selectOption('Other');assert.equal(await select.locator('option').count(),1);assert.equal(await page.locator('#expressionCode').inputValue(),'time * 12');
    await page.locator('#expressionSearch').fill('');assert.equal(await select.locator('option').count(),2);
    await page.locator('#expressionTagFilter').selectOption('');await page.locator('#expressionSearch').fill('随机');assert.equal(await select.locator('option').count(),1,'name search excludes tags and descriptions');
    await page.locator('#expressionSearch').fill('');await select.selectOption('user-legacy');
    // Failed metadata writes leave the selected preset and editor intact.
    await page.evaluate(()=>window.__failSave=true);await page.locator('#editExpressionTagsBtn').click();await page.locator('#inputModalTags').fill('Failed');await page.locator('#inputModalOk').click();await saved();
    assert.equal(await page.locator('#expressionTags').textContent(),'位置 · 常用 · XSS <tag>');await page.evaluate(()=>window.__failSave=false);
    await page.locator('#editExpressionTagsBtn').click();await page.locator('#inputModalTags').fill('');await page.locator('#inputModalOk').click();await saved();
    assert.equal(await page.locator('#expressionTags').textContent(),'无标签');
    // A blank editor saves without silently adding the old custom category/tag.
    await select.selectOption('');await page.evaluate(()=>AELT.editor.setValue('time * 24'));await page.locator('#saveExpressionBtn').click();
    assert.equal(await page.locator('#inputModalTags').inputValue(),'');await page.locator('#inputModalField').fill('New preset');await page.locator('#inputModalOk').click();await saved();
    item=await page.evaluate(()=>AELT.state.expressions.find(item=>item.id===AELT.state.selectedExpressionId));assert.deepEqual(item.tags,[]);assert.equal(item.category,undefined);
    await page.reload();await page.waitForFunction(()=>AELT.state.ready);await view('expressions');await select.selectOption('user-legacy');assert.equal(await page.locator('#expressionTags').textContent(),'无标签');
    await view('settings');await page.locator('#languageSelect').selectOption('en');await view('expressions');
    assert.equal(await page.locator('#expressionTagFilter option').first().textContent(),'All tags');assert.equal(await page.locator('#editExpressionTagsBtn').textContent(),'Name and tags');
    await page.locator('#editExpressionTagsBtn').click();assert.equal(await page.locator('#inputModalTags').getAttribute('aria-label'),'Expression tags');await page.keyboard.press('Escape');
    await select.selectOption('wiggle-basic');assert.equal(await page.locator('#editExpressionTagsBtn').isVisible(),false);
    await page.locator('#expressionTagFilter').selectOption('常用');assert.equal(await page.locator('#expressionTagFilter').inputValue(),'常用');
    await page.setViewportSize({width:360,height:520});await page.screenshot({path:path.join(output,'expressions-en-360.png'),animations:'disabled'});
    for(const selector of ['#expressionSearch','#expressionTagFilter','.expression-select','.CodeMirror','#applyExpressionBtn']){
      const box=await page.locator(selector).boundingBox();assert.ok(box.x>=0&&box.x+box.width<=360,selector+' fits');
    }
    const editor=await page.locator('.CodeMirror').boundingBox(),status=await page.locator('#editorStatus').boundingBox(),actions=await page.locator('.expression-actions').boundingBox();
    assert.ok(editor.y+editor.height<=status.y&&status.y+status.height<=actions.y,'editor, syntax status and actions do not overlap');
    await view('settings');await page.locator('#languageSelect').selectOption('zh-CN');await page.locator('#animationScaleSelect').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'settings-zh-360.png'),animations:'disabled'});
    assert.ok(await page.locator('#animationScaleSelect').evaluate(el=>el.getBoundingClientRect().right<=innerWidth));
    await page.setViewportSize({width:626,height:870});await view('expressions');await page.locator('#expressionTagFilter').selectOption('');await select.selectOption('user-legacy');
    await page.screenshot({path:path.join(output,'expressions-zh.png'),animations:'disabled'});await page.locator('#editExpressionTagsBtn').click();await page.screenshot({path:path.join(output,'tags-dialog-zh.png'),animations:'disabled'});
    assert.deepEqual(errors,[]);console.log('Preferences/tags passed: all scales, defaults/reload, CSS and WAAPI, mid-exit disable, reduced motion, legacy tags, metadata editing/cancel/failure, independent and combined filters, untagged presets, bilingual UI and 360px layout.');
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
