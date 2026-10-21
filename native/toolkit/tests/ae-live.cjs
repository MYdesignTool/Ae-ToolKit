// Real development WebView2 + AE bridge regression. Does not modify an AE project.
// Writes only isolated toolkit settings/schemes and fixtures in this worktree.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
async function main(){
 const targets=await(await fetch('http://127.0.0.1:8316/json/list')).json();
 const target=targets.find(item=>item.type==='page'&&decodeURI(item.url).replaceAll('\\','/').includes('/webview2-toolkit/bin/extension/client/index.html'));
 if(!target)throw Error('Full toolkit development target is not open');
 const socket=new WebSocket(target.webSocketDebuggerUrl),pending=new Map();let serial=0;
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 socket.addEventListener('message',event=>{const row=JSON.parse(event.data);if(row.id&&pending.has(row.id)){const task=pending.get(row.id);pending.delete(row.id);clearTimeout(task.timer);row.error?task.reject(Error(JSON.stringify(row.error))):task.resolve(row.result);}});
 function send(method,params){const id=++serial;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP request timeout'));},20000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});}
 async function evaluate(expression){const out=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(out.exceptionDetails)throw Error(out.exceptionDetails.text+': '+out.result.description);return out.result.value;}
 async function call(method,args=[]){return evaluate(`new Promise(resolve=>AeltNativeBridge.callHost(${JSON.stringify(method)},${JSON.stringify(args)},resolve))`);}
 const artifact=path.resolve(__dirname,'../../../.artifacts/webview2-toolkit'),fixture=path.join(artifact,'fixtures','脚本 %20 #');
 let settings,schemeId,scriptFolder;
 try {
  const ready=await evaluate('({ready:!!(window.AELT&&AELT.state.ready),native:!!window.AeltNativeBridge,cep:!!window.__adobe_cep__,root:window.AeltNativeBridge&&AeltNativeBridge.extensionRoot,error:window.AELT&&AELT.state.startupError})');
  assert.equal(ready.ready,true,JSON.stringify(ready));assert.equal(ready.native,true);assert.equal(ready.cep,false);
  assert.equal(ready.root.replaceAll('\\','/'),path.join(artifact,'bin/extension').replaceAll('\\','/'));
  assert.equal((await call('AELT_ping')).ok,true);assert.equal((await call('AELT_bootstrap')).ok,true);
  const loaded=await call('AELT_loadSettings');assert.equal(loaded.ok,true);settings=loaded.settings;scriptFolder=settings.scriptFolder||'';
  assert.ok(loaded.path.replaceAll('\\','/').includes('/webview2-toolkit/bin/extension/data/user-data.json'));
  const testSettings=JSON.parse(JSON.stringify(settings));testSettings.nativeMigrationTest='中文 %20 "\n';
  assert.equal((await call('AELT_saveSettings',[testSettings])).ok,true);assert.equal((await call('AELT_loadSettings')).settings.nativeMigrationTest,testSettings.nativeMigrationTest);
  assert.equal((await call('AELT_saveSettings',[settings])).ok,true);settings=null;
  schemeId='scheme-native-test-'+Date.now();const scheme={id:schemeId,name:'原生中文 %20 " 测试',fallbackPath:'Footage',rules:[{path:'图片/测试',extensions:['PNG'],itemTypes:[]}]};
  assert.equal((await call('AELT_saveOrganizerScheme',[scheme])).ok,true);
  assert.equal((await call('AELT_loadOrganizerSchemes')).schemes.find(item=>item.id===schemeId).name,scheme.name);
  assert.equal((await call('AELT_deleteOrganizerScheme',[schemeId])).ok,true);schemeId=null;
  fs.mkdirSync(fixture,{recursive:true});const script=path.join(fixture,'中文脚本.jsx'),marker=path.join(fixture,'executed.txt'),token='native bridge executed '+Date.now();
  fs.writeFileSync(script,'(function(){var file=new File('+JSON.stringify(marker.replaceAll('\\','/').replaceAll('%','%25'))+');file.encoding="UTF-8";if(!file.open("w"))throw new Error("fixture write failed");file.write('+JSON.stringify(token)+');file.close();})();');
  fs.writeFileSync(path.join(fixture,'中文脚本.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64'));
  const scan=await call('AELT_scanScripts',[fixture]);assert.equal(scan.ok,true,JSON.stringify(scan));assert.equal(scan.scripts.length,1);assert.ok(scan.scripts[0].iconPath.includes('%2520'),JSON.stringify(scan.scripts[0]));
  assert.equal(scan.scripts[0].iconPath,pathToFileURL(path.join(fixture,'中文脚本.png')).href);
  assert.equal(await evaluate(`new Promise(resolve=>{var image=new Image();image.onload=()=>resolve(image.naturalWidth>0);image.onerror=()=>resolve(false);image.src=${JSON.stringify(scan.scripts[0].iconPath)};})`),true,'Local script image must render');
  assert.equal((await call('AELT_launchScript',[script])).ok,true);assert.equal(fs.readFileSync(marker,'utf8'),token);
  const summary=await call('AELT_getSelectedPropertySummary');assert.equal(summary.ok,true);
  const rejected=await call('AELT_nonexistentMethod');assert.equal(rejected.ok,false);
  const report={time:new Date().toISOString(),target:target.url,bridge:'real WebView2 + AEGP',checks:['startup','private runtime root','ping','bootstrap','settings save/reload/restore','scheme save/list/delete','Unicode and literal-percent paths','local PNG loading','script scan and harmless fixture launch','selection read','method rejection'],projectModified:false,nativeCandidatePosition:'requires user observation'};
  fs.writeFileSync(path.join(artifact,'ae-live-results.json'),JSON.stringify(report,null,2));console.log('PASS: real AE/WebView2 startup, settings, schemes, Unicode images, script launch, selection and method policy. AE project was not modified.');
 }finally{
  if(settings)await call('AELT_saveSettings',[settings]).catch(()=>{});
  if(schemeId)await call('AELT_deleteOrganizerScheme',[schemeId]).catch(()=>{});
  if(scriptFolder)await call('AELT_scanScripts',[scriptFolder]).catch(()=>{});
  else await call('AELT_scanScripts',[path.join(fixture,'does-not-exist')]).catch(()=>{});
  socket.close();
 }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
