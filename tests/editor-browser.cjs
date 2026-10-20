// 0.3.2 regression. Mock the bridge; exercise the real offline UI.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const {root}=require('./helpers.cjs');
const {data}=require('./motion.cjs');
const output=path.join(root,'.artifacts','0.3.2');fs.mkdirSync(output,{recursive:true});
function bridge(data){
  let settings=JSON.parse(localStorage.getItem('test-settings')||'null')||data.settings;
  window.__calls=[];
  const api={
    AELT_setModuleBase:()=>({ok:true}), AELT_loadSettings:()=>({ok:true,settings}),
    AELT_saveSettings:value=>{settings=value;localStorage.setItem('test-settings',JSON.stringify(value));return{ok:true};},
    AELT_bootstrap:()=>({ok:true,...data}), AELT_loadOrganizerSchemes:()=>({ok:true,schemes:[data.rules]}),
    AELT_scanScripts:()=>data.scan,
    AELT_getSelectedPropertySummary:()=>window.__selectionError?{ok:false,messages:['Error: 请先打开合成，在时间线中选中需要处理的属性。']}:{ok:true,supported:2,existing:1,skipped:1,names:['中文图层 / Position'],comp:'中文合成',selectionKey:'test'},
    AELT_applyExpression:()=>({ok:true,applied:2,skipped:0,errors:0,messages:[]})
  };
  Object.assign(window,api);
  window.__adobe_cep__={evalScript(script,callback){window.__calls.push(script);setTimeout(()=>{try{callback(JSON.stringify((0,eval)(script)));}catch(e){callback(JSON.stringify({ok:false,messages:[String(e)]}));}},5);}};
}
async function main(){
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:626,height:870},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],remote=[];
    page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url()))remote.push(request.url());});
    await page.addInitScript(bridge,data);
    await page.goto(pathToFileURL(path.join(root,'extension/client/index.html')).href);await page.waitForFunction(()=>AELT.state.ready);
    assert.equal(await page.locator('#versionLabel').textContent(),'0.3.2');
    await page.locator('[data-view=expressions]').click();
    const source='// 中文注释\nconst amount=20;\nif(time>1){wiggle(5,amount)}else{thisComp.layer("中文图层").transform.position}';
    async function code(value){await page.evaluate(value=>AELT.editor.getInstance().setValue(value),value);}
    async function value(){return page.locator('#expressionCode').inputValue();}
    await code(source);await page.waitForFunction(()=>!document.getElementById('editorStatus').classList.contains('has-error'));
    for(const token of ['.cm-keyword','.cm-number','.cm-string','.cm-comment','.cm-variable','.cm-property'])assert.ok(await page.locator('.CodeMirror '+token).count(),token);
    assert.ok(await page.locator('.CodeMirror-linenumber').count()>=3);
    await page.locator('#formatExpressionBtn').click();const formatted=await value();assert.notEqual(formatted,source);assert.ok(formatted.includes('\n  wiggle(5, amount);'));
    await page.keyboard.press('Control+z');assert.equal(await value(),source,'format is one undo step');
    await page.keyboard.press('Control+Shift+z');assert.equal(await value(),formatted);
    await code('const amount = ;\nvalue');await page.waitForFunction(()=>document.getElementById('editorStatus').classList.contains('has-error'));
    assert.ok(await page.locator('.CodeMirror-lint-marker-error').count());
    const invalid=await value();await page.locator('#formatExpressionBtn').click();assert.equal(await value(),invalid,'invalid drafts stay unchanged');
    await page.locator('#editorStatus').click();assert.equal(await page.evaluate(()=>AELT.editor.getInstance().getCursor().line),0);
    await code('var text="unterminated');await page.waitForFunction(()=>document.getElementById('editorStatus').textContent.includes('字符串未闭合'));
    await code('');await page.evaluate(()=>AELT.editor.getInstance().focus());await page.keyboard.type('(');assert.equal(await value(),'()');await page.keyboard.type('value');await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');await page.keyboard.press('Tab');await page.keyboard.type('time');assert.ok((await value()).endsWith('\n  time'));
    await page.keyboard.press('Shift+Tab');assert.ok((await value()).endsWith('\ntime'));
    await code('if(time>1){\nvalue\n}');await page.evaluate(()=>AELT.editor.getInstance().focus());await page.keyboard.press('Shift+Alt+f');assert.ok((await value()).includes('  value;'));
    await page.keyboard.press('Control+Enter');await page.locator('#inputModal').waitFor({state:'visible'});assert.equal(await page.locator('#inputModalTitle').textContent(),'覆盖表达式');await page.locator('#inputModalCancel').click();
    await code(source);await page.evaluate(()=>{const cm=AELT.editor.getInstance();cm.clearHistory();cm.setCursor({line:1,ch:0});cm.replaceSelection('  ');window.__beforeLanguage=cm.getValue();});
    const draft=await value();
    await page.locator('[data-view=organizer]').click();await page.locator('[data-rule-path]').first().fill('用户路径/自定义');await page.locator('#schemeNameInput').fill('我的未保存方案');
    await page.locator('[data-view=settings]').click();await page.locator('#languageSelect').selectOption('en');await page.waitForFunction(()=>document.documentElement.lang==='en');
    assert.equal(await page.locator('[data-view=settings]').textContent(),'Settings');assert.equal(await page.locator('#applyExpressionBtn').textContent(),'Apply to selection');
    assert.equal(await page.locator('.brand-name').textContent(),'AE Toolkit');
    assert.equal(await value(),draft,'language switch keeps draft');
    await page.locator('[data-view=organizer]').click();assert.equal(await page.locator('[data-rule-path]').first().inputValue(),'用户路径/自定义');assert.equal(await page.locator('#schemeNameInput').inputValue(),'我的未保存方案');
    assert.equal(await page.locator('[data-i18n="文件夹路径"]').first().textContent(),'Folder path');
    await page.locator('[data-view=expressions]').click();await page.evaluate(()=>AELT.editor.getInstance().focus());await page.keyboard.press('Control+z');assert.equal(await value(),source,'language switch keeps undo history');
    await page.locator('#refreshSelectionBtn').click();await page.waitForFunction(()=>document.getElementById('selectionStatus').textContent.includes('2 properties selected'));
    assert.ok((await page.locator('.expression-select').textContent()).includes('Basic wiggle'));
    await page.locator('#expressionSearch').fill('wiggle');assert.equal(await page.locator('.expression-select option').count(),2);await page.locator('#expressionSearch').fill('');
    await page.locator('#saveExpressionBtn').click();assert.equal(await page.locator('#inputModalTitle').textContent(),'Save custom expression');await page.locator('#inputModalField').fill('中文自定义');await page.locator('#inputModalOk').click();await page.waitForFunction(()=>AELT.state.selectedExpressionId?.startsWith('user-'));
    assert.ok((await page.locator('.expression-select').textContent()).includes('中文自定义'));assert.ok((await page.locator('.expression-select').textContent()).includes('Custom'));await code(source+'\nvalue');
    await page.locator('#formatExpressionBtn').click();await page.waitForFunction(()=>document.getElementById('editorStatus').textContent.startsWith('Syntax OK'));
    await page.locator('#versionLabel').click();assert.ok(!(await page.locator('#changelogBody').textContent()).match(/[\u4e00-\u9fff]/));await page.locator('#closeChangelogBtn').click();
    for(const size of [{width:360,height:520},{width:626,height:870}]){
      await page.setViewportSize(size);for(const tab of ['organizer','scripts','settings','expressions']){
        await page.locator('[data-view='+tab+']').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no overflow: '+tab);
      }
      const brand=await page.locator('.brand').boundingBox(),version=await page.locator('#versionLabel').boundingBox();assert.ok(brand.x+brand.width<version.x,'English wordmark clears version at '+size.width);
      for(const id of ['formatExpressionBtn','saveExpressionBtn','deleteExpressionBtn','updateExpressionBtn','applyExpressionBtn']){const b=await page.locator('#'+id).boundingBox();assert.ok(b.x>=0&&b.x+b.width<=size.width&&b.y+b.height<=size.height,id+' fits '+size.width);}
      assert.ok((await page.locator('.CodeMirror').boundingBox()).height>=100);await page.mouse.move(1,1);await page.screenshot({path:path.join(output,'editor-en-'+size.width+'.png')});
    }
    await page.evaluate(()=>{window.__selectionError=true;});await page.locator('#refreshSelectionBtn').click();await page.waitForFunction(()=>document.getElementById('selectionStatus').textContent.startsWith('Open a composition'));
    await page.reload();await page.waitForFunction(()=>AELT.state.ready);assert.equal(await page.locator('#languageSelect').inputValue(),'en');assert.equal(await page.locator('[data-view=expressions]').textContent(),'Expressions');
    assert.equal(await page.locator('.brand-name').textContent(),'AE Toolkit');
    assert.ok((await page.locator('.expression-select').textContent()).includes('中文自定义'),'custom expression survives reopen');
    await page.locator('[data-view=settings]').click();await page.locator('#languageSelect').selectOption('zh-CN');await page.locator('[data-view=expressions]').click();await code(source);await page.locator('#formatExpressionBtn').click();await page.waitForFunction(()=>document.getElementById('editorStatus').textContent.includes('语法检查通过'));await page.screenshot({path:path.join(output,'editor-zh.png')});
    await page.reload();await page.waitForFunction(()=>AELT.state.ready);assert.equal(await page.locator('[data-view=settings]').textContent(),'设置');
    assert.equal(await page.locator('.brand-name').textContent(),'AE工具箱');
    assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);await context.close();
    console.log('0.3.2 browser checks passed: highlighting, diagnostics, bracket completion, indent, format/undo, apply shortcut, bilingual UI, draft/history preservation, persistent language and custom data, native offline loading, 360px layout.');
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
