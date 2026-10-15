const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const {run,context,storage,source}=require('./helpers.cjs');
test('strict ES3 JSON round trips controls, Unicode, percent signs and paths',()=>{
 const ctx=context({AELocalToolkit:{}});run(ctx,'extension/host/lib/json.jsx');
 for(const value of [null,true,false,0,-2.45,1e20,'中文\\脚本\u0000\b\f\n\t"%20',[1,'x',null],{code:'time%1',path:"C:/a'b/#素材.jsx",nested:{v:3}}]) {
   ctx.input=JSON.stringify(value);
   const out=vm.runInContext('AELocalToolkit.json.stringify(AELocalToolkit.json.parse(input))',ctx);
   assert.deepEqual(JSON.parse(out),value);
 }
});
test('invalid JSON never executes and malformed numbers/objects are rejected',()=>{
 const ctx=context({AELocalToolkit:{}});run(ctx,'extension/host/lib/json.jsx');
 for(const text of ['({x:1})','{"a":(globalThis.pwned=true)}','[1,]','{"x":1,}','01','1.','true x','"\n"','{"__proto__":{"x":1}}','{"a":undefined}','1e999']) {ctx.input=text;assert.throws(()=>vm.runInContext('AELocalToolkit.json.parse(input)',ctx),text);}
 assert.equal(ctx.pwned,undefined);
});
test('consolidate legacy settings in the extension without modifying the source',()=>{
 const env=storage();env.files.set('/extension/data/settings.json','{"compFolder":"原合成","userExpressions":[]}');
 const result=JSON.parse(env.call('AELocalToolkit.storage.loadSettings()'));assert.equal(result.ok,true);assert.equal(result.settings.compFolder,'原合成');assert.ok(env.files.has('/extension/data/user-data.json'));assert.ok(env.files.has('/extension/data/settings.json'));
});
test('invalid settings are preserved and not replaced with defaults',()=>{
 const env=storage();const target='/extension/data/user-data.json';env.files.set(target,'{broken');
 assert.equal(JSON.parse(env.call('AELocalToolkit.storage.loadSettings()')).ok,false);assert.equal(env.files.get(target),'{broken');
});
test('failed atomic replacement restores original data and later recovers backup',()=>{
 const env=storage(),target='/extension/data/user-data.json';env.call('AELocalToolkit.storage.loadSettings()');const original=env.files.get(target);
 env.fault.rename=p=>p===target;
 assert.throws(()=>env.call('AELocalToolkit.storage.saveSettings({compFolder:"NEW"})'));assert.equal(env.files.get(target),original);
 delete env.fault.rename;env.call('AELocalToolkit.storage.saveSettings({compFolder:"OK"})');assert.equal(JSON.parse(env.files.get(target)).settings.compFolder,'OK');assert.equal(env.files.get(target+'.bak'),original);
 env.files.delete(target);assert.equal(JSON.parse(env.call('AELocalToolkit.storage.loadSettings()')).settings.compFolder,'Comp');
});
test('failed temporary write leaves the existing settings untouched',()=>{
 const env=storage(),target='/extension/data/user-data.json';env.call('AELocalToolkit.storage.loadSettings()');const old=env.files.get(target);env.fault.write=true;
 assert.throws(()=>env.call('AELocalToolkit.storage.saveSettings({compFolder:"bad"})'));assert.equal(env.files.get(target),old);
});
test('migration runs once so deleting a migrated scheme does not resurrect it',()=>{
 const env=storage();env.files.set('/extension/data/organizer-schemes/old.json','{"id":"scheme-old","name":"旧方案","rules":[]}');
 assert.equal(env.call('AELocalToolkit.storage.listSchemes().length'),2);env.call('AELocalToolkit.storage.deleteScheme("scheme-old")');assert.equal(env.call('AELocalToolkit.storage.listSchemes().length'),1);
 assert.throws(()=>env.call('AELocalToolkit.storage.deleteScheme("../settings")'));
});
test('bridge uses a single literal encoding, including quotes and line separators',()=>{
 const host=context({AELT_applyExpression:(...args)=>JSON.stringify({ok:true,args})});
 const ctx=context({window:{__adobe_cep__:{evalScript:(script,callback)=>callback(vm.runInContext(script,host))}},state:{debugEntries:[]},els:{}});run(ctx,'extension/client/js/util.js');
 ctx.payload="C:\\中文\\a'b%20.jsx\n\";globalThis.pwned=true;//\u2028\u2029";ctx.result=null;
 vm.runInContext('callHost("AELT_applyExpression", [payload, false], function(r) {result=r;})',ctx);assert.equal(ctx.result.args[0],ctx.payload);assert.equal(host.pwned,undefined);
});
test('debug renders hostile filenames and error strings as text',()=>{
 const ctx=context({window:{},state:{debugEntries:[],debugMode:true},els:{debugLog:{innerHTML:''}}});run(ctx,'extension/client/js/util.js');
 vm.runInContext('addDebug("<img>", "<img src=x onerror=alert(1)>")',ctx);assert.ok(!ctx.els.debugLog.innerHTML.includes('<img'));assert.ok(ctx.els.debugLog.innerHTML.includes('&lt;img'));
});
test('settings saves serialize newer revisions after the older snapshot completes',()=>{
 const pending=[];const ctx=context({AELT:{},cloneData:v=>JSON.parse(JSON.stringify(v)),els:{},setStatus:()=>{},showToast:()=>{},clearTimeout:()=>{},setTimeout:()=>1,callHost:(name,args,cb)=>name==='AELT_loadSettings'?cb({ok:true,settings:{}}):pending.push({args,cb})});run(ctx,'extension/client/js/settings.js');
 vm.runInContext('AELT.settings.load(function(){});AELT.settings.set("folder","one");AELT.settings.persist();AELT.settings.set("folder","two");AELT.settings.persist();',ctx);
 assert.equal(pending.length,1);assert.equal(pending[0].args[0].folder,'one');pending[0].cb({ok:true});assert.equal(pending.length,2);assert.equal(pending[1].args[0].folder,'two');pending[1].cb({ok:true});
});
test('every source parses and manifest supports AE 2023 / CEP 11',()=>{
 const fs=require('node:fs'),path=require('node:path');const {root}=require('./helpers.cjs');
 function check(dir){for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const file=dir+'/'+entry.name;if(entry.isDirectory())check(file);else if(/\.(js|jsx)$/.test(file))assert.doesNotThrow(()=>new vm.Script(source(file),{filename:file}));}}
 check('extension/client');check('extension/host');check('assets/js');assert.match(source('extension/CSXS/manifest.xml'),/Version="\[23.0,99.9\]"/);assert.match(source('extension/CSXS/manifest.xml'),/Name="CSXS" Version="11.0"/);
});
