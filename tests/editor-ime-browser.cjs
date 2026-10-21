// Text regression for the current CodeMirror input mode. OS candidate UI needs AE verification.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const {root}=require('./helpers.cjs'),{bridge,data}=require('./motion.cjs');
const output=path.join(root,'.artifacts','editor-ime');fs.mkdirSync(output,{recursive:true});
async function main(){
  // Headless Chromium uses MockInputMethod: this checks text editing, not the Windows IME UI.
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    // Match the original module's host guards; this does not reproduce the native CEF backend.
    const page=await browser.newPage({viewport:{width:626,height:870},reducedMotion:'reduce',userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36'}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(10000);
    await page.addInitScript(()=>Object.defineProperty(navigator,'platform',{get:()=> 'Win32'}));
    await page.addInitScript(bridge,data);await page.goto(pathToFileURL(path.join(root,'extension/client/index.html')).href);
    await page.waitForFunction(()=>AELT.state.ready);
    const rebind=await page.evaluate(async()=>{
      const box=document.createElement('div');box.innerHTML='<input><textarea></textarea>';document.body.appendChild(box);
      const settle=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))),results=[];
      for(const field of box.children){
        let focus=0,blur=0;field.value='English 中文';
        field.addEventListener('focus',()=>focus++);field.addEventListener('blur',()=>blur++);
        field.focus();field.setSelectionRange(1,4,'backward');await settle();
        results.push({focus,blur,value:field.value,start:field.selectionStart,end:field.selectionEnd,direction:field.selectionDirection});
      }
      box.remove();
      const cancelled=[];
      for(const kind of ['keydown','compositionstart','paste']){
        const field=document.createElement('input');document.body.appendChild(field);let blur=0;field.addEventListener('blur',()=>blur++);
        field.focus();field.dispatchEvent(new Event(kind,{bubbles:true}));
        if(kind==='compositionstart')field.dispatchEvent(new Event('compositionend',{bubbles:true}));
        await settle();cancelled.push(blur);field.remove();
      }
      const tag=document.querySelector('[data-rule-extensions]');tag.value='avif';tag.focus();await settle();
      const draft=tag.value;tag.value='';tag.blur();
      return{results,cancelled,draft};
    });
    for(const result of rebind.results)assert.deepEqual(result,{focus:2,blur:1,value:'English 中文',start:1,end:4,direction:'backward'});
    assert.deepEqual(rebind.cancelled,[0,0,0]);assert.equal(rebind.draft,'avif','focusing does not commit a tag draft');
    await page.locator('[data-view=expressions]').click();
    const session=await page.context().newCDPSession(page);
    async function value(){return page.locator('#expressionCode').inputValue();}
    async function draft(text,line,ch){
      await page.evaluate(({text,line,ch})=>{const cm=AELT.editor.getInstance();AELT.editor.setValue(text);cm.setCursor({line,ch});cm.focus();cm.scrollIntoView(cm.getCursor(),20);}, {text,line,ch});
      await page.waitForTimeout(30); // CodeMirror's WebKit focus reset runs after 20 ms.
      await caret();
    }
    async function caret(){
      const result=await page.evaluate(()=>{
        const cm=AELT.editor.getInstance(),field=cm.getInputField();
        return{tag:field.tagName,style:cm.getOption('inputStyle'),editable:field.isContentEditable,focused:document.activeElement===field};
      });
      assert.equal(result.tag,'TEXTAREA');assert.equal(result.style,'textarea');assert.ok(result.focused,'CodeMirror textarea input stays focused');
      return result;
    }
    async function compose(text){
      await session.send('Input.imeSetComposition',{text:'zhong',selectionStart:5,selectionEnd:5});
      await session.send('Input.imeSetComposition',{text,selectionStart:text.length,selectionEnd:text.length});
      await session.send('Input.insertText',{text});
      await page.waitForFunction(text=>document.getElementById('expressionCode').value.includes(text),text);
      await page.waitForFunction(()=>AELT.editor.getInstance().getValue()===document.getElementById('expressionCode').value);
      await page.waitForFunction(()=>!AELT.editor.getInstance().display.input.composing);
      await caret();
    }
    await draft('// ',0,3);await compose('中文输入');assert.equal(await value(),'// 中文输入');
    await page.keyboard.press('Control+z');await page.waitForFunction(()=>document.getElementById('expressionCode').value==='// ');
    await page.keyboard.press('Control+Shift+z');await page.waitForFunction(()=>document.getElementById('expressionCode').value==='// 中文输入');
    await draft('if (time > 1) {\n\n}',1,0);await page.keyboard.press('Tab');await page.keyboard.type('// ');await compose('缩进注释');
    assert.equal(await value(),'if (time > 1) {\n  // 缩进注释\n}');
    const lines=Array.from({length:70},(_,index)=>'// '+index+' '+('a'.repeat(160)));await draft(lines.join('\n'),50,140);
    await compose('滚动中文');assert.equal((await value()).split('\n')[50],lines[50].slice(0,140)+'滚动中文'+lines[50].slice(140));
    const scrolled=await page.evaluate(()=>AELT.editor.getInstance().getScrollInfo());assert.ok(scrolled.top>0&&scrolled.left>0,'both scroll axes exercised');
    // Moving away and back must restore an IME anchor without changing text or history.
    const before=await value();await page.locator('[data-view=settings]').click();await page.locator('[data-view=expressions]').click();
    await page.locator('.CodeMirror').click({position:{x:100,y:40}});await page.waitForTimeout(30);await caret();assert.equal(await value(),before);
    await page.setViewportSize({width:360,height:520});await draft('// ',0,3);await compose('窄面板');assert.equal(await value(),'// 窄面板');
    await page.screenshot({path:path.join(output,'ime-caret-360.png'),animations:'disabled'});
    // Regular shortcuts continue working once composition has ended.
    await page.keyboard.press('Enter');await page.keyboard.type('time');assert.ok((await value()).endsWith('\ntime'));
    await page.evaluate(()=>{AELT.state.expressionBusy=true;AELT.editor.sync();});const locked=await value();
    await session.send('Input.insertText',{text:'禁止写入'});await page.waitForTimeout(100);assert.equal(await value(),locked);
    await page.evaluate(()=>{AELT.state.expressionBusy=false;AELT.editor.sync();});
    await page.setViewportSize({width:626,height:870});await draft('var name = "";',0,12);await compose('日本語');assert.equal(await value(),'var name = "日本語";');
    await page.screenshot({path:path.join(output,'ime-caret-626.png'),animations:'disabled'});
    // Native fields share the host IME backend with CodeMirror. Create isolated,
    // temporary controls so these checks cannot change real organizer settings.
    await page.evaluate(()=>{
      const box=document.createElement('div');box.id='ime-native-fixture';
      box.style.cssText='position:fixed;left:20px;top:150px;right:20px;z-index:99999;background:#222;padding:16px';
      box.innerHTML='<input id="ime-test-input" aria-label="IME test input"><textarea id="ime-test-textarea" aria-label="IME test textarea"></textarea>';
      document.body.appendChild(box);
    });
    for(const id of ['ime-test-input','ime-test-textarea']){
      const field=page.locator('#'+id);
      await field.fill('');await field.focus();await page.keyboard.type('English 123 ');
      await session.send('Input.imeSetComposition',{text:'zhong',selectionStart:5,selectionEnd:5});
      await session.send('Input.imeSetComposition',{text:'中文',selectionStart:2,selectionEnd:2});
      await session.send('Input.insertText',{text:'中文'});assert.equal(await field.inputValue(),'English 123 中文');
      // Native Chromium may group the adjacent English and composition edits.
      await page.keyboard.press('Control+z');assert.notEqual(await field.inputValue(),'English 123 中文');
      await page.keyboard.press('Control+Shift+z');assert.equal(await field.inputValue(),'English 123 中文');
      // Input.insertText exercises replacement as a plain-text paste would, without
      // reading or replacing the user's real Windows clipboard.
      await page.keyboard.press('Control+a');await session.send('Input.insertText',{text:'粘贴 English'});
      assert.equal(await field.inputValue(),'粘贴 English');
      if(id==='ime-test-textarea'){await page.keyboard.press('Enter');await page.keyboard.type('second line');assert.equal(await field.inputValue(),'粘贴 English\nsecond line');}
    }
    await page.evaluate(()=>document.getElementById('ime-native-fixture').remove());
    await draft('// ',0,3);await page.keyboard.type('English ');
    await page.evaluate(()=>{
      const data=new DataTransfer();data.setData('text/plain','中文 paste\n// next');
      AELT.editor.getInstance().getInputField().dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));
    });
    assert.equal(await value(),'// English 中文 paste\n// next');
    await page.keyboard.press('Control+z');assert.equal(await value(),'// English ');
    await page.keyboard.press('Control+Shift+z');assert.equal(await value(),'// English 中文 paste\n// next');
    await page.evaluate(()=>{const cm=AELT.editor.getInstance();cm.setSelection({line:0,ch:3},{line:0,ch:10});});
    const selected=await page.evaluate(()=>{
      const field=AELT.editor.getInstance().getInputField();return field.value.slice(field.selectionStart,field.selectionEnd);
    });
    assert.equal(selected,'English','textarea exposes selected text for native copy');
    assert.deepEqual(errors,[]);console.log('Input regression passed: original focus rebind, native text/selection preservation, tag drafts, input/textarea and CodeMirror textarea, English, paste event path, undo/redo, scroll, resize and busy protection. Composition key guards are disabled in this variant. OS clipboard, real candidate keys and Windows candidate positioning still require Microsoft Pinyin verification in AE.');
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
