// UI regression for the original dropdown/editor and double-click script workflows.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');const {root}=require('./helpers.cjs');
const artifacts=process.env.ARTIFACT_DIR||path.join(root,'.artifacts');fs.mkdirSync(artifacts,{recursive:true});
const load=name=>JSON.parse(fs.readFileSync(path.join(root,'extension/data/'+name),'utf8'));
const fixture={rules:load('organizer-rules.json'),expressions:load('default-expressions.json').expressions,settings:load('settings.default.json'),changelog:load('changelog.json')};
const server=http.createServer((request,response)=>{
 const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname),file=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
 if(!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}
 fs.readFile(file,(err,data)=>{if(err){response.writeHead(404).end();return;}const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'};response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});response.end(data);});
});
async function main(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
 const context=await browser.newContext({viewport:{width:626,height:870},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
 page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(String(error)));
 await page.addInitScript(data=>{
  let settings=data.settings;window.__calls=[];
  const api={
   AELT_setModuleBase:()=>({ok:true}),AELT_loadSettings:()=>({ok:true,settings,path:'C:/Users/示例用户/AppData/Roaming/Adobe/CEP/extensions/AeLocalToolkit/data/user-data.json'}),AELT_saveSettings:value=>{settings=value;return{ok:true};},
   AELT_bootstrap:()=>({ok:true,...data}),AELT_loadOrganizerSchemes:()=>({ok:true,schemes:[data.rules]}),AELT_getSelectedPropertySummary:()=>({ok:true,total:3,supported:3,existing:1,skipped:0,names:['标题 / 位置','图形 / 旋转','图形 / 缩放'],comp:'片头动画',selectionKey:'example'}),
   AELT_applyExpression:(code,overwrite)=>code==='bad'?({ok:false,applied:0,errors:3,skipped:0,messages:['表达式无效；原表达式已保留']}):({ok:true,applied:overwrite?3:2,errors:0,skipped:overwrite?0:1,messages:[]}),
   AELT_removeExpressions:()=>({ok:true,removed:1,errors:0,skipped:2,messages:[]}),AELT_ping:()=>({ok:true,appVersion:'模拟宿主'}),
   AELT_selectScriptFolder:()=>({ok:true,path:'C:/示例脚本'}),AELT_scanScripts:()=>({ok:true,scripts:[{name:'图层整理',relativePath:'图层整理.jsx',fsName:'C:/示例脚本/图层整理.jsx',iconPath:'missing-image.png'},{name:'缓动助手',relativePath:'缓动助手.jsx',fsName:'C:/示例脚本/缓动助手.jsx',iconPath:''},{name:'锚点对齐',relativePath:'锚点对齐.JSX',fsName:'C:/示例脚本/锚点对齐.JSX',iconPath:''}],messages:[]}),AELT_launchScript:()=>({ok:true})
  };
  Object.assign(window,api);window.__adobe_cep__={evalScript(script,callback){window.__calls.push(script);let result;try{result=(0,eval)(script);}catch(error){result={ok:false,messages:[String(error)]};}setTimeout(()=>callback(JSON.stringify(result)),5);}};
 },fixture);
 await require('./native-fixture.cjs').install(page);
 await page.goto(base+'/extension/client/index.html');await page.waitForFunction(()=>window.AELT&&AELT.state.ready);assert.ok(await page.locator('.rule-item').count()>0);
 async function setCode(code){await page.evaluate(value=>AELT.editor.getInstance().setValue(value),code);}
 await page.locator('[data-view=expressions]').click();
 for(const id of ['expressionLibraryBtn','expressionFilter','overwriteExpressions','expressionResult','selectionDetails','expressionName'])assert.equal(await page.locator('#'+id).count(),0,'unrequested control removed: '+id);
 await page.locator('.expression-select').selectOption('wiggle-basic');assert.equal(await page.locator('#expressionCode').inputValue(),'wiggle(5, 20)');
 await page.locator('#applyExpressionBtn').click();await page.locator('#inputModal').waitFor({state:'visible'});assert.equal(await page.locator('#inputModalTitle').textContent(),'覆盖表达式');
 await page.locator('#inputModalCancel').click();assert.equal(await page.evaluate(()=>__calls.filter(s=>s.startsWith('AELT_applyExpression')).length),0);
 await page.locator('#applyExpressionBtn').click();await page.locator('#inputModalOk').click();await page.waitForFunction(()=>document.getElementById('statusBar').textContent.includes('已应用 3'));assert.equal(await page.locator('#toastContainer .toast').count(),0);
 await setCode('bad');await page.locator('#applyExpressionBtn').click();await page.locator('#inputModalOk').click();await page.waitForFunction(()=>document.getElementById('statusBar').textContent.includes('失败 3'));assert.ok((await page.locator('#toastContainer').textContent()).includes('表达式无效'));
 await page.locator('.expression-select').selectOption('blink-opacity');await page.locator('#inputModalCancel').click();assert.equal(await page.locator('#expressionCode').inputValue(),'bad');assert.equal(await page.locator('.expression-select').inputValue(),'wiggle-basic');
 await setCode('time * 24');await page.locator('#saveExpressionBtn').click();await page.locator('#inputModalField').fill('我的表达式');await page.locator('#inputModalOk').click();await page.waitForFunction(()=>AELT.state.selectedExpressionId&&AELT.state.selectedExpressionId.startsWith('user-'));assert.equal(await page.locator('#updateExpressionBtn').isVisible(),true);assert.equal(await page.locator('#updateExpressionBtn').isDisabled(),true);
 await page.locator('#toastContainer .toast').waitFor({state:'detached'});await page.setViewportSize({width:360,height:520});for(const id of ['saveExpressionBtn','deleteExpressionBtn','updateExpressionBtn']){const bounds=await page.locator('#'+id).boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=360,'editor toolbar fits: '+id);}await page.screenshot({path:path.join(artifacts,'narrow-custom-expression.png')});await page.setViewportSize({width:626,height:870});
 await page.locator('#expressionSearch').fill('不存在的关键词');assert.equal(await page.locator('.expression-select option').count(),1);assert.equal(await page.locator('#expressionCode').inputValue(),'time * 24');await page.locator('#expressionSearch').fill('');
 await page.reload();await page.waitForFunction(()=>AELT.state.ready);await page.locator('[data-view=expressions]').click();await page.locator('.expression-select').selectOption('wiggle-basic');
 async function screenshot(name){await page.mouse.move(2,2);await page.screenshot({path:path.join(artifacts,name+'.png')});}
 await screenshot('expressions');
 await page.locator('.expression-select').selectOption('');await screenshot('empty-expression');await page.locator('.expression-select').selectOption('wiggle-basic');
 await page.locator('#removeExpressionBtn').click();await page.locator('#inputModal').waitFor({state:'visible'});for(const id of ['inputModalCancel','inputModalOk'])assert.ok((await page.locator('#'+id).boundingBox()).width>=76);assert.equal(await page.locator('#inputModalField').isVisible(),false);assert.equal(await page.locator('#applyExpressionBtn').textContent(),'应用到选中属性');await screenshot('confirm-remove');await page.locator('#inputModalCancel').click();
 await page.locator('[data-view=settings]').click();await page.locator('#scriptFolderBtn').click();await page.waitForFunction(()=>AELT.state.scripts.length===3);await page.locator('[data-view=scripts]').click();await page.waitForFunction(()=>document.querySelector('.script-icon-img').dataset.fallback==='true');
 assert.equal(await page.locator('#runScriptBtn').count(),0);assert.equal(await page.locator('.script-name').first().textContent(),'图层整理');assert.ok(!(await page.locator('#scriptList').textContent()).includes('.jsx'));
 await page.locator('.script-item').first().dblclick();await page.waitForFunction(()=>!AELT.state.scriptBusy);assert.equal(await page.evaluate(()=>__calls.filter(s=>s.startsWith('AELT_launchScript')).length),1);
 await page.locator('#scriptSearch').fill('缓动');assert.equal(await page.locator('.script-item').count(),1);await page.locator('#scriptSearch').fill('');await page.waitForTimeout(2800);await screenshot('scripts');
 await page.locator('[data-view=organizer]').click();await screenshot('organizer');
 for(const size of [{width:360,height:520},{width:626,height:870}]){
   await page.setViewportSize(size);for(const tab of ['organizer','expressions','scripts','settings']){await page.locator('[data-view='+tab+']').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no overflow: '+tab);if(tab==='expressions'){assert.ok((await page.locator('.CodeMirror').boundingBox()).height>=100);const button=await page.locator('#applyExpressionBtn').boundingBox();assert.ok(button.y+button.height<size.height,'apply remains visible');}}
 }
 await page.setViewportSize({width:360,height:520});await page.locator('[data-view=expressions]').click();await screenshot('narrow-expressions');await page.locator('#removeExpressionBtn').click();await page.locator('#inputModal').waitFor({state:'visible'});for(const id of ['inputModalCancel','inputModalOk'])assert.ok((await page.locator('#'+id).boundingBox()).width>=76);await screenshot('narrow-confirm');await page.locator('#inputModalCancel').click();
 await page.setViewportSize({width:800,height:800});await screenshot('wide-expressions');
 await page.route('https://api.github.com/**',route=>route.fulfill({status:503,body:'offline'}));await page.goto(base+'/');await page.locator('#features').scrollIntoViewIfNeeded();await screenshot('site-light');
 assert.equal(await page.locator('.feature-visual').count(),3);await page.locator('#theme-toggle').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('denied'))}});});await page.locator('#code-copy').click();await page.waitForFunction(()=>document.getElementById('code-copy').textContent.includes('失败'));
 await page.setViewportSize({width:390,height:844});await page.locator('#mobile-toggle').click();assert.equal(await page.locator('#mobile-toggle').getAttribute('aria-expanded'),'true');await page.keyboard.press('Escape');assert.equal(await page.locator('#mobile-toggle').getAttribute('aria-expanded'),'false');assert.deepEqual(errors,[]);
 console.log('Browser checks passed: original dropdown/editor, overwrite confirmation/cancel, save dialog, error feedback, double-click script list, responsive layout and dialog button widths.');await context.close();
 }finally{await browser.close();server.close();}
}
main().catch(error=>{console.error(error);server.close();process.exitCode=1;});
