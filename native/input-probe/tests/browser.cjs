const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:650,height:900}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      const listeners=[];window.chrome=window.chrome||{};
      window.chrome.webview={addEventListener(name,listener){if(name==='message')listeners.push(listener);},postMessage(request){setTimeout(()=>listeners.forEach(listener=>listener({data:{channel:request.channel,id:request.id,result:JSON.stringify({ok:true,echo:request.payload})}})),0);}};
    });
    const root=path.resolve(__dirname,'../../../.artifacts/webview2-probe/bin/content');
    await page.goto(pathToFileURL(path.join(root,'index.html')).href);
    await page.waitForFunction(()=>document.getElementById('connection').textContent.includes('已连接'));
    await page.locator('#plain-input').fill('English 中文');assert.equal(await page.locator('#plain-input').inputValue(),'English 中文');
    await page.locator('#plain-input').press('Control+a');await page.locator('#plain-input').press('Backspace');await page.keyboard.type('abc');await page.keyboard.press('Control+z');await page.keyboard.press('Control+y');
    assert.equal(await page.locator('#plain-input').inputValue(),'abc');
    await page.locator('#plain-textarea').fill('中文第一行\nEnglish second line');assert.ok((await page.locator('#plain-textarea').inputValue()).includes('\n'));
    await page.evaluate(()=>{inputProbe.editor.setValue('');inputProbe.editor.focus();});
    const session=await page.context().newCDPSession(page);
    await session.send('Input.imeSetComposition',{text:'zhongwen',selectionStart:8,selectionEnd:8});
    await session.send('Input.insertText',{text:'中文'});
    await page.waitForFunction(()=>inputProbe.editor.getValue()==='中文');
    await page.keyboard.press('Control+Enter');assert.match(await page.locator('#shortcut-status').textContent(),/已响应/);
    await page.keyboard.type('abc');await page.keyboard.press('Control+z');await page.keyboard.press('Control+y');assert.equal(await page.evaluate(()=>inputProbe.editor.getValue()),'中文abc');
    await page.locator('#ping').click();await page.waitForFunction(()=>document.getElementById('connection').textContent.includes('已连接'));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:path.join(root,'../../input-probe.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('PASS: probe page, host protocol, input/textarea/CodeMirror edits, simulated composition, undo/redo and editor shortcut. Native IME/clipboard require real AE.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
