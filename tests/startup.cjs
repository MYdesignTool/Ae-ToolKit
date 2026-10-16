// Real panel startup failures must be diagnosable before any settings can load.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');const {root}=require('./helpers.cjs');
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(path.join(root,'extension/client')+path.sep)){res.writeHead(404).end();return;}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png'})[path.extname(file)]||'application/octet-stream'}).end(b);});});
function bridge(fault){
 window.__calls=[];
 window.__adobe_cep__={evalScript(script,callback){
  const name=script.slice(0,script.indexOf('('));window.__calls.push(name);
  let result={ok:true};
  if(name==='AELT_setModuleBase'&&fault.stage==='host-loader')result={ok:false,messages:[fault.message],loadErrors:[fault.message]};
  if(name==='AELT_loadSettings')result=fault.stage==='settings'?{ok:false,messages:[fault.message]}:{ok:true,settings:{debugMode:false}};
  if(name==='AELT_bootstrap')result={ok:false,messages:[fault.message]};
  if(name==='AELT_ping')result={ok:false,messages:[fault.message],loadErrors:[fault.message]};
  setTimeout(()=>callback(fault.raw&&name==='AELT_setModuleBase'?fault.raw:JSON.stringify(result)),0);
 }};
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const b=await chromium.launch({channel:'msedge',headless:true});
 try{
  for(const fault of [
   {stage:'host-loader',message:'C:/Program Files (x86)/Adobe/CEP/extensions/AeLocalToolkit/host/modules/launcher.jsx\nTypeError: Cannot convert'},
   {stage:'settings',message:'data/user-data.json: access denied; permission to write is required'},
   {stage:'bootstrap',message:'organizer-rules.json: invalid JSON <img src=x onerror=alert(1)>'},
   {stage:'host-loader',message:'EvalScript error.',raw:'EvalScript error.'}
  ]){
   const c=await b.newContext({viewport:{width:626,height:870},reducedMotion:'reduce'}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(bridge,fault);await p.goto('http://127.0.0.1:'+server.address().port+'/extension/client/index.html');
   await p.waitForFunction(()=>AELT.state.startupError===true);
   assert.equal(await p.locator('.tab[data-view=debug]').isVisible(),true);assert.equal(await p.locator('#debugView').isVisible(),true);
   for(const line of fault.message.split('\n'))assert.ok((await p.locator('#debugLog').textContent()).includes(line));assert.ok((await p.locator('#debugLog').textContent()).includes(fault.stage));
   assert.equal(await p.locator('#debugLog img').count(),0);assert.equal(await p.evaluate(()=>AELT.state.debugMode),false);assert.equal(await p.evaluate(()=>AELT.state.ready),false);
   assert.ok(!(await p.evaluate(()=>__calls)).includes('AELT_saveSettings'),'diagnostics do not modify settings');
   await p.locator('#clearDebugBtn').click();await p.locator('#pingHostBtn').click();await p.waitForFunction(()=>document.getElementById('debugLog').textContent.includes('connection'));for(const line of fault.message.split('\n'))assert.ok((await p.locator('#debugLog').textContent()).includes(line));
   if(fault.stage==='host-loader'&&!fault.raw)await p.screenshot({path:path.join(root,'.artifacts/host-compat/startup-failure.png')});assert.deepEqual(errors,[]);await c.close();
  }
  console.log('Startup UI passed: host/bridge, settings and defaults failures expose full diagnostics without saved Debug preferences or writes.');
 }finally{await b.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
