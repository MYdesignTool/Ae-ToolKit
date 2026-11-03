const {test}=require('node:test'),assert=require('node:assert/strict');
const {storage,context,run}=require('./helpers.cjs');

test('default organizer can be deleted only after saving another scheme, including after restart and backup restore',()=>{
 const env=storage(),target='/extension/data/user-data.json';env.call('AELocalToolkit.storage.loadSettings()');
 const original=env.files.get(target);
 assert.throws(()=>env.call('AELocalToolkit.storage.deleteScheme("preset-default")'),/至少保留/);
 assert.equal(env.files.get(target),original);
 env.call('AELocalToolkit.storage.saveScheme({id:"scheme-mine",name:"Mine",rules:[]})');
 env.call('AELocalToolkit.storage.deleteScheme("preset-default")');
 assert.equal(env.call('AELocalToolkit.storage.listSchemes().length'),1);
 assert.equal(env.call('AELocalToolkit.storage.listSchemes()[0].id'),'scheme-mine');
 run(env.context,'extension/host/modules/storage.jsx');
 assert.equal(env.call('AELocalToolkit.storage.listSchemes()[0].id'),'scheme-mine');
 assert.throws(()=>env.call('AELocalToolkit.storage.deleteScheme("scheme-mine")'),/至少保留/);
 env.context.File.saveDialog=()=>new env.context.File('/backup.json');env.call('AELocalToolkit.storage.exportData()');
 const backup=JSON.parse(env.files.get('/backup.json'));assert.equal(backup.defaultSchemeDeleted,true);
 env.files.set('/old.json',JSON.stringify({format:'ae-local-toolkit',version:1,settings:{},schemes:[]}));
 env.context.File.openDialog=()=>new env.context.File('/old.json');env.call('AELocalToolkit.storage.importData()');
 assert.equal(env.call('AELocalToolkit.storage.listSchemes().length'),2);
 env.context.File.openDialog=()=>new env.context.File('/backup.json');env.call('AELocalToolkit.storage.importData()');
 assert.equal(env.call('AELocalToolkit.storage.listSchemes().length'),1);
});

test('failed default-scheme deletion and invalid import preserve the last saved scheme',()=>{
 const env=storage();env.call('AELocalToolkit.storage.saveScheme({id:"scheme-mine",name:"Mine",rules:[]})');
 env.fault.write=true;assert.throws(()=>env.call('AELocalToolkit.storage.deleteScheme("preset-default")'));
 delete env.fault.write;assert.equal(env.call('AELocalToolkit.storage.listSchemes().length'),2);
 env.files.set('/invalid.json',JSON.stringify({format:'ae-local-toolkit',version:1,settings:{},schemes:[],defaultSchemeDeleted:true}));
 env.context.File.openDialog=()=>new env.context.File('/invalid.json');assert.equal(JSON.parse(env.call('AELocalToolkit.storage.importData()')).ok,false);
 assert.equal(env.call('AELocalToolkit.storage.listSchemes().length'),2);
});

test('expression deletion records and edited replacements survive backup round trips and reject malformed records',()=>{
 const env=storage();env.call('AELocalToolkit.storage.saveSettings({hiddenBuiltinExpressions:["wiggle-basic","blink-opacity"],userExpressions:[{id:"user-edited",name:"Edited",code:"time * 2",tags:["Mine"]}]})');
 env.context.File.saveDialog=()=>new env.context.File('/backup.json');env.call('AELocalToolkit.storage.exportData()');
 env.call('AELocalToolkit.storage.saveSettings({})');
 env.context.File.openDialog=()=>new env.context.File('/backup.json');env.call('AELocalToolkit.storage.importData()');
 const restored=JSON.parse(env.call('AELocalToolkit.storage.loadSettings()')).settings;
 assert.deepEqual(restored.hiddenBuiltinExpressions,['wiggle-basic','blink-opacity']);assert.equal(restored.userExpressions[0].code,'time * 2');
 const before=env.files.get('/extension/data/user-data.json');
 for(const value of ['{}','[null]','[1]'])assert.throws(()=>env.call(`AELocalToolkit.storage.saveSettings({hiddenBuiltinExpressions:${value}})`));
 assert.equal(env.files.get('/extension/data/user-data.json'),before);
});

test('startup retries only confirmed non-execution, with bounded attempts and no overlapping calls',()=>{
 const timers=[],calls=[],ctx=context({window:{},document:{addEventListener(){}},setTimeout:(fn,delay)=>{const timer={fn,delay,cancelled:false};timers.push(timer);return timer;},clearTimeout:timer=>{timer.cancelled=true;},setStatus:()=>{},callHost:(name,args,cb)=>calls.push(cb)});
 run(ctx,'extension/client/js/app.js');let result;
 ctx.callStartupHost('AELT_bootstrap',[],value=>{result=value;});assert.equal(calls.length,1);
 calls.shift()({ok:false,error:{code:'host_timeout'}});assert.equal(result,undefined);assert.equal(calls.length,0);
 timers.find(timer=>timer.delay===1000).fn();assert.equal(calls.length,1);
 calls.shift()({ok:false,error:{code:'host_timeout'}});assert.equal(result.ok,false);
 assert.equal(timers.filter(timer=>timer.delay===1000).length,1);
 for(const code of ['host_busy','host_failed',undefined]){
  result=null;ctx.callStartupHost('AELT_bootstrap',[],value=>{result=value;});calls.shift()({ok:false,error:{code}});assert.equal(result.ok,false);
 }
});
