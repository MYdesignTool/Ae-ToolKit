const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {source}=require('./helpers.cjs');
test('native bridge preserves requests, resolves replies once and stops on document close',()=>{
  const sent=[],listeners={},timers=new Map();let serial=0;
  const window={__aeltToolkitNative:{channel:'native/1',extensionRoot:'C:/中文%20/extension'},chrome:{webview:{postMessage:value=>sent.push(value),addEventListener:(name,fn)=>{listeners[name]=fn;}}},addEventListener:(name,fn)=>{listeners[name]=fn;}};
  const context={window,setTimeout:fn=>{timers.set(++serial,fn);return serial;},clearTimeout:id=>timers.delete(id)};
  vm.runInNewContext(source('extension/client/js/native-bridge.js'),context);
  const results=[];window.AeltNativeBridge.callHost('AELT_saveSettings',[{value:'中文 " %20\n'}],result=>results.push(result));
  assert.equal(sent[0].method,'AELT_saveSettings');assert.deepEqual(JSON.parse(sent[0].payload),[{value:'中文 " %20\n'}]);
  listeners.message({data:{channel:'wrong',id:sent[0].id,result:'{"ok":true}'}});assert.equal(results.length,0);
  const reply={data:{channel:'native/1',id:sent[0].id,result:'{"ok":true}'}};listeners.message(reply);listeners.message(reply);assert.equal(results.length,1);assert.equal(timers.size,0);
  window.AeltNativeBridge.callHost('AELT_ping',[],result=>results.push(result));listeners.pagehide();assert.equal(results.length,2);assert.equal(results[1].ok,false);
  window.AeltNativeBridge.callHost('AELT_ping',[],result=>results.push(result));assert.equal(sent.length,2);assert.equal(results[2].ok,false);
});
test('native bridge stays absent in CEP and normalizes native queue failures',()=>{
  const absent={window:{},setTimeout,clearTimeout};vm.runInNewContext(source('extension/client/js/native-bridge.js'),absent);assert.equal(absent.window.AeltNativeBridge,undefined);
  let receive,request;const window={__aeltToolkitNative:{channel:'c',extensionRoot:'r'},chrome:{webview:{addEventListener:(n,fn)=>{receive=fn;},postMessage:value=>{request=value;}}},addEventListener:()=>{}};
  vm.runInNewContext(source('extension/client/js/native-bridge.js'),{window,setTimeout,clearTimeout});let result;
  window.AeltNativeBridge.callHost('AELT_ping',[],value=>{result=value;});receive({data:{channel:'c',id:request.id,result:'{"ok":false,"error":{"message":"queue full"}}'}});assert.equal(result.messages[0],'queue full');
});
test('native runtime seeds CEP state once, rebases portable paths and never changes original data',()=>{
  const {prepare}=require('../native/toolkit/prepare-runtime.cjs');const root=fs.mkdtempSync(path.join(os.tmpdir(),'aelt-native-seed-'));
  try {
    const cep=path.join(root,'CEP'),output=path.join(root,'native/bin');fs.mkdirSync(path.join(cep,'data'),{recursive:true});
    const original=JSON.stringify({format:'ae-local-toolkit',version:1,settings:{scriptFolder:'./scripts',scriptFavorites:['./scripts/tool.jsx'],language:'en'},schemes:[]});
    fs.writeFileSync(path.join(cep,'data/user-data.json'),original);
    assert.equal(prepare(output,cep).seeded,true);const target=path.join(output,'extension/data/user-data.json');const seeded=JSON.parse(fs.readFileSync(target,'utf8'));assert.equal(seeded.settings.scriptFolder,path.join(cep,'scripts'));assert.equal(fs.readFileSync(path.join(cep,'data/user-data.json'),'utf8'),original);
    seeded.settings.language='zh-CN';fs.writeFileSync(target,JSON.stringify(seeded));assert.equal(prepare(output,cep).seeded,false);assert.equal(JSON.parse(fs.readFileSync(target,'utf8')).settings.language,'zh-CN');
  } finally {const target=path.resolve(root);assert.ok(target.startsWith(path.join(path.resolve(os.tmpdir()),'aelt-native-seed-'))&&path.dirname(target)===path.resolve(os.tmpdir()));fs.rmSync(target,{recursive:true,force:true});}
});
