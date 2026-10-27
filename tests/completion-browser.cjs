// Persisted settings, native typing, keyboard routing, IME and popup fit.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const {root}=require('./helpers.cjs'),{bridge,data}=require('./motion.cjs');
const output=path.join(root,'.artifacts','0.6.1');fs.mkdirSync(output,{recursive:true});
async function main(){
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:626,height:870},reducedMotion:'reduce'}),errors=[],remote=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))remote.push(r.url());});
    await page.addInitScript(bridge,data);
    await page.addInitScript(()=>{
      let settings=JSON.parse(localStorage.getItem('completion-test-settings')||'null')||window.AELT_loadSettings().settings;
      if(!localStorage.getItem('completion-test-settings'))delete settings.expressionCompletionKey; // Upgrade from an older preferences document.
      window.AELT_loadSettings=()=>({ok:true,settings});
      window.AELT_saveSettings=value=>{settings=value;localStorage.setItem('completion-test-settings',JSON.stringify(value));return{ok:true};};
    });
    await require('./native-fixture.cjs').install(page);
    await page.goto(pathToFileURL(path.join(root,'extension/client/index.html')).href);
    await page.waitForFunction(()=>AELT.state.ready);await page.locator('[data-view=expressions]').click();
    const popup=page.locator('.expression-completion'),options=popup.locator('[role=option]'),toggle=page.locator('#expressionCompletionToggle'),helpToggle=page.locator('#expressionHelpToggle');
    const keySelect=page.locator('#expressionCompletionKeySelect');
    async function draft(text='',index=text.length){
      await page.evaluate(({text,index})=>{const cm=AELT.editor.getInstance();AELT.editor.setValue(text);cm.setCursor(cm.posFromIndex(index));cm.clearHistory();cm.focus();},{text,index});
      await page.waitForTimeout(40);
    }
    async function value(){return page.locator('#expressionCode').inputValue();}
    async function hidden(){await popup.waitFor({state:'hidden'});}
    async function setEnabled(enabled){
      await page.locator('[data-view=settings]').click();
      if((await toggle.isChecked())!==enabled)await toggle.locator('..').click();
      assert.equal(await toggle.isChecked(),enabled);
      await page.waitForFunction(enabled=>AELT.settings.get('expressionCompletion',false)===enabled,enabled);
      await page.locator('[data-view=expressions]').click();
    }
    async function setHelpEnabled(enabled){
      await page.locator('[data-view=settings]').click();
      if((await helpToggle.isChecked())!==enabled)await helpToggle.locator('..').click();
      assert.equal(await helpToggle.isChecked(),enabled);
      await page.waitForFunction(enabled=>AELT.settings.get('expressionHelp',true)===enabled,enabled);
      await page.locator('[data-view=expressions]').click();
    }
    async function setAcceptKey(key){
      await page.locator('[data-view=settings]').click();await keySelect.selectOption(key);
      await page.waitForFunction(key=>JSON.parse(localStorage.getItem('completion-test-settings')).expressionCompletionKey===key,key);
      await page.locator('[data-view=expressions]').click();
    }
    assert.equal(await page.locator('#completeExpressionBtn').count(),0,'no toolbar button');
    assert.equal(await toggle.isChecked(),true,'completion defaults to on');
    assert.equal(await helpToggle.isChecked(),true,'function help defaults to on');
    assert.equal(await keySelect.inputValue(),'Enter','older settings default to Enter');
    assert.equal(await page.locator('#expressionEditorSettings #expressionCompletionToggle,#expressionEditorSettings #expressionHelpToggle,#expressionEditorSettings #expressionCompletionKeySelect').count(),3);
    const headings=await page.locator('#settingsView .section-head h2').allTextContents();
    assert.ok(headings.indexOf('工程整理设置')<headings.indexOf('表达式编辑设置')&&headings.indexOf('表达式编辑设置')<headings.indexOf('脚本文件夹'));
    await setEnabled(false);
    await draft();await page.keyboard.type('wig');await page.waitForTimeout(180);await hidden();
    for(const key of ['Control+Space','Meta+Space']){await page.keyboard.press(key);await page.waitForTimeout(120);await hidden();}
    await setEnabled(true);assert.equal(await value(),'wig','preference keeps the draft');
    await draft('var wigglesPerSecond=5;\n');await page.keyboard.type('wig');await popup.waitFor();
    assert.deepEqual(await options.locator('.completion-name').allTextContents(),['wiggle()','wigglesPerSecond','temporalWiggle()']);
    assert.match(await popup.locator('.completion-detail').textContent(),/wiggle\(freq, amp/);
    assert.equal(await popup.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(32, 32, 32)');
    assert.doesNotMatch(await popup.locator('.completion-help').textContent(),/Esc|Space/);
    assert.match(await popup.locator('.completion-help').textContent(),/Enter/);assert.doesNotMatch(await popup.locator('.completion-help').textContent(),/Tab/);
    assert.equal(await popup.locator('.completion-count').textContent(),'可传 2–5 个参数');
    assert.match(await popup.locator('.completion-note').textContent(),/末尾/);
    assert.equal(await popup.locator('.completion-argument').count(),5);
    assert.match(await popup.locator('.completion-argument').first().textContent(),/freq.*每秒/);
    assert.match(await popup.locator('.completion-argument').nth(2).textContent(),/默认：1/);
    const initialBox=await popup.locator('.completion-list').boundingBox();
    await page.keyboard.press('ArrowDown');assert.equal(await popup.locator('.completion-summary').count(),0,'draft variable clears stale function help');
    const variableBox=await popup.locator('.completion-list').boundingBox();assert.equal(variableBox.y,initialBox.y,'selection keeps the list anchored');
    await page.keyboard.press('ArrowDown');assert.match(await popup.locator('.completion-summary').textContent(),/采样时间/);
    await page.keyboard.press('ArrowUp');await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Escape');assert.ok(await popup.isVisible(),'Escape no longer dismisses suggestions');
    await page.screenshot({path:path.join(output,'completion-zh-626.png'),animations:'disabled'});
    await page.keyboard.press('Enter');assert.equal(await value(),'var wigglesPerSecond=5;\nwiggle()');
    assert.equal(await page.evaluate(()=>AELT.editor.getInstance().getCursor().ch),7);
    await page.keyboard.press('Control+z');assert.equal(await value(),'var wigglesPerSecond=5;\nwig');
    await page.keyboard.press('Control+Shift+z');assert.equal(await value(),'var wigglesPerSecond=5;\nwiggle()');
    await draft();await page.keyboard.type('t');await popup.waitFor();
    assert.ok(await options.count()<=7,'one-letter input opens at most seven suggestions');
    await page.keyboard.type('i');await page.waitForFunction(()=>document.querySelectorAll('.completion-item').length<=7&&document.querySelector('.completion-name')?.textContent==='time');
    const filtered=await options.locator('.completion-name').allTextContents();
    for(const noise of ['active','audioActive','continue'])assert.ok(!filtered.includes(noise));
    assert.match(await popup.locator('.completion-summary').textContent(),/合成时间.*秒/);
    assert.ok((await popup.locator('.completion-detail').boundingBox()).height<110,'short property help has no blank panel');
    await page.screenshot({path:path.join(output,'completion-ti-filtered.png'),animations:'disabled'});
    await draft('thisLayer.');await page.keyboard.type('au');await popup.waitFor();
    assert.deepEqual(await options.locator('.completion-name').allTextContents(),['audioActive','hasAudio']);
    assert.match(await popup.locator('.completion-summary').textContent(),/音频开关.*入点.*出点/);
    assert.equal(await popup.locator('.completion-count').textContent(),'类型：Boolean');
    await page.screenshot({path:path.join(output,'completion-property-help.png'),animations:'disabled'});
    // Deleting back into a matching prefix reopens and refreshes suggestions.
    await draft();await page.keyboard.type('wigz');await page.waitForTimeout(150);await hidden();
    await page.keyboard.press('Backspace');await popup.waitFor();assert.equal(await value(),'wig');
    assert.deepEqual(await options.locator('.completion-name').allTextContents(),['wiggle()','temporalWiggle()']);
    await page.keyboard.press('Backspace');await page.waitForFunction(()=>document.querySelector('.completion-name')?.textContent==='width');
    assert.equal(await value(),'wi');assert.deepEqual(await options.locator('.completion-name').allTextContents(),['width','wiggle()','temporalWiggle()']);
    await page.keyboard.press('Backspace');await page.waitForFunction(()=>document.querySelector('.completion-name strong')?.textContent==='w');
    assert.equal(await value(),'w');assert.ok(await options.count()<=7);
    await page.keyboard.press('Backspace');await page.waitForTimeout(150);await hidden();assert.equal(await value(),'');
    await draft('wigz',3);await page.keyboard.press('Delete');await popup.waitFor();assert.equal(await value(),'wig');
    assert.deepEqual(await options.locator('.completion-name').allTextContents(),['wiggle()','temporalWiggle()']);
    await draft('thisComp.layXYZer');await page.evaluate(()=>AELT.editor.getInstance().setSelection({line:0,ch:12},{line:0,ch:15}));
    await page.keyboard.press('Backspace');await popup.waitFor();assert.equal(await value(),'thisComp.layer');
    assert.equal(await options.locator('.completion-name').first().textContent(),'layer()');
    await page.keyboard.press('Enter');assert.equal(await value(),'thisComp.layer()');
    await page.keyboard.press('Control+a');await page.keyboard.press('Backspace');await page.waitForTimeout(150);await hidden();
    await draft();await page.keyboard.type('wig');await popup.waitFor();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');assert.equal(await value(),'temporalWiggle()');
    await draft('wiggle(5, 20)',2);await page.keyboard.type('g');await popup.waitFor();await page.keyboard.press('Enter');assert.equal(await value(),'wiggle(5, 20)');
    await draft();await page.keyboard.type('thisComp.');await popup.waitFor();assert.ok((await options.allTextContents()).some(s=>s.includes('layer')));
    await page.keyboard.type('la');await page.waitForFunction(()=>document.querySelector('.completion-name')?.textContent==='layer()');
    await page.keyboard.press('Enter');assert.equal(await value(),'thisComp.layer()');
    await draft('thisComp.layer("Title").transform.');await page.keyboard.type('po');await popup.waitFor();
    await options.filter({hasText:/^pposition$/}).click();assert.equal(await value(),'thisComp.layer("Title").transform.position');
    await draft('value');await page.keyboard.press('Enter');assert.equal(await value(),'value\n');
    await draft('wig');await page.keyboard.press('Tab');assert.equal(await value(),'wig  ');
    await draft();await page.keyboard.type('wig');await popup.waitFor();await page.keyboard.press('Tab');assert.equal(await value(),'wig  ','unselected Tab key keeps indentation while suggestions are visible');await hidden();
    await setAcceptKey('Tab');await draft();await page.keyboard.type('wig');await popup.waitFor();
    assert.match(await popup.locator('.completion-help').textContent(),/Tab/);assert.doesNotMatch(await popup.locator('.completion-help').textContent(),/Enter/);
    await page.keyboard.press('Enter');assert.equal(await value(),'wig\n','unselected Enter key keeps newline behavior');await hidden();
    await draft();await page.keyboard.type('wig');await popup.waitFor();await page.keyboard.press('Tab');assert.equal(await value(),'wiggle()');
    await page.keyboard.press('Control+z');assert.equal(await value(),'wig','Tab completion is still one undo step');
    await page.reload();await page.waitForFunction(()=>AELT.state.ready);assert.equal(await keySelect.inputValue(),'Tab','acceptance key survives reload');
    await page.locator('[data-view=expressions]').click();await draft();await page.keyboard.type('wig');await popup.waitFor();await page.keyboard.press('Tab');assert.equal(await value(),'wiggle()');
    await setAcceptKey('Enter');
    await draft();await page.keyboard.type('wig');await popup.waitFor();await page.keyboard.press('ArrowLeft');await hidden();
    await draft();await page.keyboard.type('wig');await page.keyboard.press('ArrowLeft');await page.waitForTimeout(150);await hidden();
    await draft();await page.keyboard.type('thisComp.');await popup.waitFor();
    assert.ok(await options.count()<=7);for(let i=0;i<6;i++)await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(40);assert.ok(await popup.isVisible(),'scrolling keeps completion open');
    assert.ok(await popup.locator('.completion-list').evaluate(el=>el.scrollTop>0));await page.locator('#expressionSearch').click();await hidden();
    for(const text of ['// ','"','`','/']){await draft(text);await page.keyboard.type('wig');await page.waitForTimeout(150);await hidden();}
    await draft();await page.keyboard.type('wig');await popup.waitFor();
    const session=await page.context().newCDPSession(page);
    await session.send('Input.imeSetComposition',{text:'zhong',selectionStart:5,selectionEnd:5});await hidden();
    await session.send('Input.imeSetComposition',{text:'中文',selectionStart:2,selectionEnd:2});await hidden();
    await session.send('Input.insertText',{text:'中文'});await page.waitForTimeout(200);await hidden();assert.ok((await value()).includes('中文'));
    await draft();await page.keyboard.type('wig');await popup.waitFor();
    await page.evaluate(()=>AELT.editor.getInstance().getInputField().dispatchEvent(new KeyboardEvent('keydown',{key:'Process',keyCode:229,bubbles:true})));await hidden();assert.equal(await value(),'wig');
    await draft();await page.keyboard.type('wig');await popup.waitFor();
    await page.evaluate(()=>{AELT.state.expressionBusy=true;AELT.editor.sync();});await hidden();
    await page.keyboard.type('x');await page.keyboard.press('Backspace');assert.equal(await value(),'wig');await hidden();
    await page.evaluate(()=>{AELT.state.expressionBusy=false;AELT.editor.sync();});
    await setEnabled(false);await draft();await page.keyboard.type('wig');await page.waitForTimeout(180);await hidden();
    await page.keyboard.press('Backspace');await page.waitForTimeout(150);await hidden();assert.equal(await value(),'wi');
    await page.reload();await page.waitForFunction(()=>AELT.state.ready);assert.equal(await toggle.isChecked(),false,'off survives reopening');
    await setEnabled(true);await page.waitForFunction(()=>JSON.parse(localStorage.getItem('completion-test-settings')).expressionCompletion===true);
    await page.reload();await page.waitForFunction(()=>AELT.state.ready);assert.equal(await toggle.isChecked(),true,'on survives reopening');
    await setHelpEnabled(false);await draft();await page.keyboard.type('wig');await popup.waitFor();
    assert.equal(await popup.locator('.completion-summary').count(),0);assert.equal(await popup.locator('.completion-argument').count(),0);
    assert.match(await popup.locator('.completion-signature').textContent(),/wiggle/);
    await page.reload();await page.waitForFunction(()=>AELT.state.ready);assert.equal(await helpToggle.isChecked(),false,'help preference survives reopening');
    assert.equal(await toggle.isChecked(),true,'help toggle does not disable completion');
    await setHelpEnabled(true);
    await page.locator('[data-view=settings]').click();await toggle.locator('..').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(output,'completion-settings-zh.png'),animations:'disabled'});
    await page.setViewportSize({width:360,height:520});await page.locator('#expressionEditorSettings').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(output,'completion-settings-zh-360.png'),animations:'disabled'});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.setViewportSize({width:626,height:870});
    await page.locator('#languageSelect').selectOption('en');
    assert.equal(await toggle.getAttribute('aria-label'),'Expression code completion');assert.equal(await toggle.isChecked(),true);
    assert.equal(await helpToggle.getAttribute('aria-label'),'Expression function help');assert.equal(await helpToggle.isChecked(),true);
    assert.equal(await page.locator('#expressionEditorSettingsHeading').textContent(),'Expression editor settings');
    assert.equal(await keySelect.getAttribute('aria-label'),'Accept suggestion key');
    await toggle.locator('..').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'completion-settings-en.png'),animations:'disabled'});
    await page.setViewportSize({width:360,height:520});await page.locator('#expressionEditorSettings').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(output,'completion-settings-en-360.png'),animations:'disabled'});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.locator('[data-view=expressions]').click();
    for(const width of [360,626]){
      await page.setViewportSize({width,height:520});
      await draft('// '+('line\n// '.repeat(30))+'\n'+(' '.repeat(100)));await page.keyboard.type('wig');await popup.waitFor();
      const box=await popup.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width&&box.y>=0&&box.y+box.height<=520,JSON.stringify(box));
      assert.match(await popup.locator('.completion-help').textContent(),/select/);
      assert.equal(await popup.locator('.completion-count').textContent(),'Accepts 2–5 arguments');
      assert.doesNotMatch(await popup.locator('.completion-detail').textContent(),/[\u4e00-\u9fff]/);
      await popup.locator('.completion-detail').evaluate(el=>{el.scrollTop=el.scrollHeight;});await page.waitForTimeout(30);
      assert.ok(await popup.isVisible(),'help can scroll without closing the menu');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      const state=await page.evaluate(()=>{const f=AELT.editor.getInstance().getInputField();return{focused:document.activeElement===f,expanded:f.getAttribute('aria-expanded'),active:document.getElementById(f.getAttribute('aria-activedescendant'))?.getAttribute('aria-selected')};});
      assert.deepEqual(state,{focused:true,expanded:'true',active:'true'});
      await page.screenshot({path:path.join(output,'completion-en-'+width+'.png'),animations:'disabled'});
    }
    await page.evaluate(()=>AELT.editor.setValue('time'));await hidden();
    assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
    console.log('Completion browser checks passed: separate editor settings section, configurable Enter/Tab acceptance (default Enter), persisted settings/reload, normal non-accepting newline/indent, no toolbar/Space/Escape bindings, function/parameter help, undo, IME, bilingual UI and 360/626px fit.');
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
