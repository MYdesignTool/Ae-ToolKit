// Real host expression module in a VM with AE property fixtures; real offline panel/bridge UI.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const {root}=require('./helpers.cjs'),{data}=require('./motion.cjs'),{fixture,names}=require('./transform-host.cjs');
const output=path.join(root,'.artifacts','0.6.1');fs.mkdirSync(output,{recursive:true});
async function main(){
  const env=fixture([{existing:{opacity:'time*20'}},{threeD:true}]),selected=env.layers.slice(),calls=[];
  let settings=structuredClone(data.settings);
  Object.assign(env.ctx,{
    AELT_setModuleBase:()=>({ok:true}),AELT_loadSettings:()=>({ok:true,settings}),
    AELT_saveSettings:value=>{settings=JSON.parse(JSON.stringify(value));return{ok:true};},
    AELT_bootstrap:()=>({ok:true,...data}),AELT_loadOrganizerSchemes:()=>({ok:true,schemes:[data.rules]}),AELT_scanScripts:()=>data.scan,
    AELT_getSelectedPropertySummary:env.api.getSelectedPropertySummary,AELT_applyExpression:env.api.applyExpression,AELT_removeExpressions:env.api.removeExpressions
  });
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:626,height:870},reducedMotion:'reduce'}),errors=[];page.setDefaultTimeout(10000);
    page.on('pageerror',e=>errors.push(e.message));
    await page.exposeFunction('__transformBridge',script=>{calls.push(script);try{return JSON.stringify(env.call(script));}catch(error){return JSON.stringify({ok:false,messages:[String(error)]});}});
    await page.addInitScript(()=>{window.__adobe_cep__={evalScript(script,callback){window.__transformBridge(script).then(callback);}};});
    await require('./native-fixture.cjs').install(page);
    await page.goto(pathToFileURL(path.join(root,'extension/client/index.html')).href);await page.waitForFunction(()=>AELT.state.ready);
    await page.locator('[data-view=expressions]').click();await page.waitForFunction(()=>AELT.state.selection?.mode==='layers');
    const targets=page.locator('#transformTargetsBtn'),panel=page.locator('#transformTargetsPanel'),apply=page.locator('#applyExpressionBtn');
    async function code(text){await page.evaluate(text=>AELT.editor.setValue(text),text);}
    async function refresh(){await page.locator('#refreshSelectionBtn').click();await page.waitForFunction(()=>!AELT.state.expressionBusy);}
    async function choose(keys){
      if(!await panel.isVisible()){await page.locator('#expressionSearch').hover();await targets.hover();}await panel.waitFor();await page.locator('#transformTargetsNone').click();
      for(const key of keys)await page.locator('#transformTargetOptions input[value='+key+']').check();
      await page.waitForFunction(keys=>JSON.stringify(AELT.state.selection?.targets)===JSON.stringify(keys.slice().sort()),keys);
      if(keys.includes('orientation'))await page.screenshot({path:path.join(output,'expression-transform-picker-zh.png'),animations:'disabled'});
      await page.locator('#expressionSearch').hover();await panel.waitFor({state:'hidden'});
    }
    await code('value');assert.equal(await apply.textContent(),'应用到图层变换');assert.equal(await targets.textContent(),'变换目标（0）');
    assert.equal(await targets.evaluate(el=>el.parentElement.classList.contains('expression-actions')),true,'targets sit beside the bottom apply/remove actions');
    assert.equal(await apply.isDisabled(),true,'empty initial targets prevent applying to layers');
    assert.match(await page.locator('#selectionStatus').textContent(),/已选 2 个图层.*目标 0 个属性/);
    await page.evaluate(()=>AELT.editor.getInstance().focus());await targets.hover();await panel.waitFor();
    assert.equal(await page.evaluate(()=>AELT.editor.getInstance().hasFocus()),true,'hover opens without stealing editor focus');
    assert.equal(await panel.locator('input[type=checkbox]').count(),8);
    assert.equal(await panel.locator('input:checked').count(),0,'no transform is selected by default');
    assert.equal(await panel.getAttribute('aria-modal'),null,'target panel does not block the editor');
    assert.equal(await page.locator('#transformTargetsApply,#transformTargetsCancel').count(),0,'no confirmation step');
    const buttonBounds=await targets.boundingBox(),panelBounds=await panel.boundingBox();
    const gapY=panelBounds.y<buttonBounds.y?panelBounds.y+panelBounds.height+4:panelBounds.y-4;
    await page.mouse.move(buttonBounds.x+buttonBounds.width/2,gapY);await page.waitForTimeout(70);
    assert.equal(await panel.isVisible(),true,'crossing the button/panel gap does not dismiss');
    await panel.hover();await page.waitForTimeout(220);assert.equal(await panel.isVisible(),true,'moving into the popup cancels dismissal');
    await page.locator('#transformTargetsAll').click();await page.waitForFunction(()=>AELT.state.selection?.targets.length===8);
    await page.locator('#expressionSearch').hover();await panel.waitFor({state:'hidden'});
    await targets.hover();assert.equal(await panel.locator('input:checked').count(),8,'hover reopening retains this session’s choices');
    await page.locator('#expressionSearch').hover();await targets.hover();await page.waitForTimeout(220);
    assert.equal(await panel.isVisible(),true,'quick pointer return cancels pending close');
    await targets.click();assert.equal(await panel.isVisible(),true,'click after hover keeps the panel open for keyboard navigation');
    await page.keyboard.press('Escape');await panel.waitFor({state:'hidden'});assert.equal(await targets.evaluate(el=>document.activeElement===el),true);
    assert.equal(settings.expressionTransformTargets,undefined,'target choices do not write settings');
    await choose(['position','opacity','orientation']);assert.equal(await page.locator('#expressionCode').inputValue(),'value');
    assert.match(await page.locator('#selectionStatus').textContent(),/目标 5 个属性.*已有表达式 1 个.*跳过 1/);
    await page.screenshot({path:path.join(output,'expression-layer-targets-zh.png'),animations:'disabled'});
    await apply.click();await page.locator('#inputModal').waitFor();assert.equal(await page.locator('#inputModalTitle').textContent(),'覆盖表达式');
    await page.locator('#inputModalCancel').click();assert.equal(selected[0].props[names.position].writes,0);
    await apply.click();await page.locator('#inputModal').waitFor();env.comp.selectedLayers=[selected[1]];
    await page.locator('#inputModalOk').click();await page.waitForFunction(()=>!AELT.state.expressionBusy);
    assert.equal(env.undo.length,0,'changed selection cancels before undo or writes');assert.equal(selected[0].props[names.position].writes,0);
    env.comp.selectedLayers=selected;await refresh();await page.waitForFunction(()=>AELT.state.selection?.supported===5);
    await apply.click();await page.locator('#inputModalOk').click();await page.waitForFunction(()=>!AELT.state.expressionBusy&&document.getElementById('statusBar').textContent.includes('已应用 5 项'));
    assert.deepEqual(env.undo,['begin','end']);for(const layer of selected){assert.equal(layer.props[names.position].expression,'value');assert.equal(layer.props[names.opacity].expression,'value');assert.equal(layer.props[names.scale].expression,'');}
    assert.equal(selected[1].props[names.orientation].expression,'value');
    await choose([]);assert.equal(await apply.isDisabled(),true);assert.equal(await targets.textContent(),'变换目标（0）');
    await page.evaluate(()=>AELT.editor.getInstance().focus());await page.keyboard.press('Control+Enter');
    await page.waitForFunction(()=>document.querySelector('#toastContainer .toast.error')?.textContent==='请先勾选可用的图层变换目标。');
    await page.evaluate(()=>document.getElementById('toastContainer').textContent='');
    await choose(['opacity']);await page.locator('#removeExpressionBtn').click();await page.locator('#inputModal').waitFor();assert.match(await page.locator('#confirmMessage').textContent(),/图层变换目标上的 2/);
    await page.locator('#inputModalOk').click();await page.waitForFunction(()=>!AELT.state.expressionBusy&&document.getElementById('statusBar').textContent.includes('已移除 2 项'));
    for(const layer of selected){assert.equal(layer.props[names.opacity].expression,'');assert.equal(layer.props[names.position].expression,'value');}
    // Change AE selection without a browser focus event or a manual Refresh click.
    selected[0].selectedProperties=[selected[0].props[names.scale]];
    await page.waitForFunction(()=>AELT.state.selection?.mode==='properties');
    assert.equal(await targets.isVisible(),false);assert.equal(await apply.textContent(),'应用到选中属性');await code('time*10');await apply.click();await page.waitForFunction(()=>!AELT.state.expressionBusy);
    assert.equal(selected[0].props[names.scale].expression,'time*10');assert.equal(selected[1].props[names.scale].expression,'');
    selected[0].selectedProperties=[];env.comp.selectedProperties=[selected[1].props[names.scale]];
    await page.waitForFunction(()=>AELT.state.selection?.mode==='properties'&&AELT.state.selection.names[0].includes('图层 2'));
    assert.equal(await targets.isVisible(),false);assert.equal(await apply.textContent(),'应用到选中属性');
    env.comp.selectedProperties=[];await page.waitForFunction(()=>AELT.state.selection?.mode==='layers');
    await page.locator('[data-view=settings]').click();await page.locator('#languageSelect').selectOption('en');await page.locator('[data-view=expressions]').click();
    await page.waitForFunction(()=>AELT.state.selection?.mode==='layers');assert.equal(await apply.textContent(),'Apply to layer transforms');assert.equal(await targets.textContent(),'Targets (1)');
    for(const width of [360,626]){
      await page.setViewportSize({width,height:520});await targets.click();await panel.waitFor();
      const bounds=await panel.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width&&bounds.y>=0&&bounds.y+bounds.height<=520,JSON.stringify(bounds));
      for(const label of await panel.locator('.transform-target-options label').all()){
        assert.equal(await label.evaluate(el=>el.scrollWidth<=el.clientWidth),true,'target label fits without clipping');
        const box=await label.locator('input').boundingBox();assert.ok(box.width<=20&&box.height<=20,'checkbox does not inherit full-width text-input sizing');
      }
      assert.match(await page.locator('#transformTargetsTitle').textContent(),/layer transform/);assert.equal(await page.locator('#transformTargetOptions input[value=opacity]').isChecked(),true);
      await page.screenshot({path:path.join(output,'expression-transform-picker-en-'+width+'.png'),animations:'disabled'});
      await page.keyboard.press('Escape');await panel.waitFor({state:'hidden'});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      for(const button of [targets,apply,page.locator('#removeExpressionBtn')]){const rect=await button.boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=width&&rect.y+rect.height<=520,JSON.stringify(rect));}
    }
    await page.reload();await page.waitForFunction(()=>AELT.state.ready);await page.locator('[data-view=expressions]').click();await page.waitForFunction(()=>AELT.state.selection?.mode==='layers');
    assert.equal(await targets.textContent(),'Targets (0)');await code('value');assert.equal(await apply.isDisabled(),true);await targets.click();
    assert.equal(await panel.locator('input:checked').count(),0,'reload resets all targets to unchecked');
    assert.equal(await page.locator('#transformTargetOptions input[value=opacity]').isChecked(),false,'previous session choice is cleared');await page.locator('#transformTargetsClose').click();
    env.comp.selectedLayers=[];await refresh();await page.waitForFunction(()=>AELT.state.selection?.mode==='none');
    await page.evaluate(()=>{AELT.i18n.setLanguage('zh-CN',false);AELT.state.quietMode=true;});
    const writes=calls.filter(script=>script.startsWith('AELT_applyExpression(')).length;
    await apply.click();await page.waitForFunction(()=>document.querySelector('#toastContainer .toast.error')?.textContent==='请先选择可应用表达式的属性。');
    assert.equal(await page.locator('#statusBar').textContent(),'请先选择可应用表达式的属性。');
    assert.equal(calls.filter(script=>script.startsWith('AELT_applyExpression(')).length,writes,'empty selection never starts an apply batch');
    const alert=await page.locator('#toastContainer .toast.error').boundingBox();assert.ok(alert.x>=0&&alert.x+alert.width<=626&&alert.y>=0&&alert.y+alert.height<=520);
    await page.screenshot({path:path.join(output,'expression-empty-selection-error.png'),animations:'disabled'});
    assert.ok(calls.some(script=>script.startsWith('AELT_applyExpression(')&&script.includes('"orientation"')));assert.deepEqual(errors,[]);
    console.log('Layer transform browser checks passed: hover opening without focus theft, gap crossing and quick return, leave-to-close with retained choices, keyboard fallback, session memory and reload reset, no settings persistence, mixed 2D/3D, overwrite and changed-selection guard, scoped removal, property priority and bilingual 360/626px layout.');
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
