// Persistent fake host: exercise the production UI through CEP or WebView2.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const {root}=require('./helpers.cjs'),{data}=require('./motion.cjs');
function bridge(data){
 let settings=JSON.parse(localStorage.getItem('lifecycle-settings')||'null')||{...data.settings,scriptFolder:''};
 let schemes=JSON.parse(localStorage.getItem('lifecycle-schemes')||'null')||[data.rules];
 window.__startupCalls=0;window.__failSave=false;
 Object.assign(window,{
  AELT_setModuleBase:()=>{window.__startupCalls++;return window.__failStartup?{ok:false,messages:['loader unavailable']}:{ok:true};},
  AELT_loadSettings:()=>({ok:true,settings}),
  AELT_saveSettings:value=>{if(window.__failSave)return {ok:false,messages:['disk full']};settings=value;localStorage.setItem('lifecycle-settings',JSON.stringify(value));return {ok:true};},
  AELT_bootstrap:()=>({ok:true,...data}),AELT_loadOrganizerSchemes:()=>({ok:true,schemes}),
  AELT_saveOrganizerScheme:scheme=>{if(window.__failSave)return {ok:false,messages:['disk full']};schemes=schemes.filter(item=>item.id!==scheme.id).concat([scheme]);localStorage.setItem('lifecycle-schemes',JSON.stringify(schemes));return {ok:true};},
  AELT_deleteOrganizerScheme:id=>{if(window.__failSave)return {ok:false,messages:['disk full']};schemes=schemes.filter(item=>item.id!==id);localStorage.setItem('lifecycle-schemes',JSON.stringify(schemes));return {ok:true};},
  AELT_scanScripts:()=>data.scan,AELT_getSelectedPropertySummary:()=>({ok:true,supported:0,existing:0,names:[],messages:[]})
 });
 window.__adobe_cep__={evalScript(script,callback){
  const first=script.startsWith('AELT_setModuleBase(')&&!sessionStorage.getItem('lifecycle-delayed');
  if(first){sessionStorage.setItem('lifecycle-delayed','1');window.__startupCalls++;setTimeout(()=>callback(JSON.stringify({ok:false,error:{code:'host_timeout'},messages:['The request expired without executing.']})),1800);return;}
  setTimeout(()=>{try{callback(JSON.stringify((0,eval)(script)));}catch(error){callback(JSON.stringify({ok:false,messages:[String(error)]}));}},0);
 }};
}
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:626,height:870},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(10000);
  await page.addInitScript(bridge,data);await require('./native-fixture.cjs').install(page);
  await page.goto(pathToFileURL(path.join(root,'extension/client/index.html')).href);
  await page.waitForFunction(()=>document.getElementById('statusBar').textContent.includes('正在等待 AE 就绪'));
  assert.equal(await page.evaluate(()=>AELT.state.startupError),false);
  async function ready(){await page.waitForFunction(()=>AELT.state.ready&&document.getElementById('statusBar').textContent.includes('已加载整理方案'));}
  await ready();assert.equal(await page.evaluate(()=>__startupCalls),2);
  async function view(name){await page.locator('[data-view='+name+']').click();await page.waitForFunction(name=>document.getElementById(name+'View').classList.contains('active'),name);}
  async function name(value){await page.locator('#inputModalField').fill(value);await page.locator('#inputModalOk').click();}
  async function select(id){await page.evaluate(id=>selectExpression(id),id);}
  async function settled(){await page.waitForFunction(()=>!AELT.state.expressionBusy);}
  await view('expressions');await select('wiggle-basic');
  assert.equal(await page.locator('#editExpressionTagsBtn').isVisible(),true);assert.equal(await page.locator('#deleteExpressionBtn').isVisible(),true);
  await page.evaluate(()=>{__failSave=true;AELT.editor.setValue('wiggle(2, 8)');});
  await page.locator('#updateExpressionBtn').click();await name('修改失败');await settled();
  assert.equal(await page.evaluate(()=>selectedExpression().id),'wiggle-basic');
  assert.deepEqual(await page.evaluate(()=>AELT.settings.get('hiddenBuiltinExpressions',[])),[]);
  assert.equal(await page.locator('#expressionCode').inputValue(),'wiggle(2, 8)');
  await page.evaluate(()=>__failSave=false);await page.locator('#updateExpressionBtn').click();await name('我的抖动');await settled();
  assert.equal(await page.evaluate(()=>AELT.state.expressions.filter(item=>item.id==='wiggle-basic').length),0);
  assert.equal(await page.evaluate(()=>selectedExpression().name),'我的抖动');
  await select('blink-opacity');await page.locator('#deleteExpressionBtn').click();await page.locator('#inputModalCancel').click();
  assert.equal(await page.evaluate(()=>selectedExpression().id),'blink-opacity');
  await page.evaluate(()=>__failSave=true);await page.locator('#deleteExpressionBtn').click();await page.locator('#inputModalOk').click();await settled();
  assert.equal(await page.evaluate(()=>selectedExpression().id),'blink-opacity');
  await page.evaluate(()=>__failSave=false);await page.locator('#deleteExpressionBtn').click();await page.locator('#inputModalOk').click();await settled();
  await page.reload();await ready();assert.equal(await page.evaluate(()=>AELT.state.expressions.length),1);
  assert.equal(await page.evaluate(()=>AELT.state.expressions[0].code),'wiggle(2, 8)');
  await page.locator('#schemeMenuBtn').click();assert.equal(await page.locator('#deleteSchemeBtn').isDisabled(),true);
  await page.locator('#newSchemeBtn').click();await name('我的整理');
  const personal=await page.evaluate(()=>AELT.state.selectedSchemeId);
  await page.evaluate(()=>selectOrganizerScheme('preset-default'));
  await page.locator('#inputModalOk').click(); // Confirm discarding the unsaved draft.
  await page.locator('#schemeMenuBtn').click();assert.equal(await page.locator('#deleteSchemeBtn').isDisabled(),true);
  await page.locator('#newSchemeBtn').click();await name('已保存整理');
  await page.locator('#saveSchemeBtn').click();await page.waitForFunction(()=>!organizerSaving);
  const saved=await page.evaluate(()=>AELT.state.selectedSchemeId);assert.notEqual(saved,personal);
  await page.evaluate(()=>selectOrganizerScheme('preset-default'));
  await page.locator('#schemeMenuBtn').click();assert.equal(await page.locator('#deleteSchemeBtn').isEnabled(),true);
  await page.evaluate(()=>__failSave=true);await page.locator('#deleteSchemeBtn').click();await page.locator('#inputModalOk').click();await page.waitForFunction(()=>!organizerSaving);
  assert.equal(await page.evaluate(()=>AELT.state.organizerSchemes.some(item=>item.id==='preset-default')),true);
  await page.evaluate(()=>__failSave=false);await page.locator('#schemeMenuBtn').click();await page.locator('#deleteSchemeBtn').click();await page.locator('#inputModalOk').click();await page.waitForFunction(()=>!organizerSaving);
  await page.reload();await ready();assert.deepEqual(await page.evaluate(()=>AELT.state.organizerSchemes.map(item=>item.id)),[saved]);
  await page.locator('#schemeMenuBtn').click();assert.equal(await page.locator('#deleteSchemeBtn').isDisabled(),true);
  const output=path.join(root,'.artifacts/0.6.2');fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,'last-scheme-protected.png')});
  await page.evaluate(()=>{__failStartup=true;AELT.app.retryStartup();});await page.waitForFunction(()=>AELT.state.startupError&&!AELT.state.startupPending);
  await page.evaluate(()=>__failStartup=false);const calls=await page.evaluate(()=>__startupCalls);
  await page.evaluate(()=>{pingHost();pingHost();});await ready();
  assert.equal(await page.evaluate(()=>__startupCalls),calls+1,'manual reconnect does not overlap or bind UI events again');
  assert.equal(await page.evaluate(()=>AELT.state.startupError),false);
  assert.equal(await page.locator('[data-view=debug]').isVisible(),false);
  assert.deepEqual(await page.evaluate(()=>AELT.state.organizerSchemes.map(item=>item.id)),[saved]);
  assert.deepEqual(errors,[]);console.log('Preset lifecycle passed: startup delay/retry, expression edits/deletion/rollback/reload, saved-scheme minimum and default deletion.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
