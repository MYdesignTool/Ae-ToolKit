// Run existing UI scenarios through the native transport, preserving fake AE APIs.
exports.install=async function(page){
 if(process.env.AELT_TEST_NATIVE!=='1')return;
 await page.addInitScript(()=>{
  let legacy=window.__adobe_cep__;const listeners=[];
  Object.defineProperty(window,'__adobe_cep__',{configurable:true,get(){return undefined;},set(value){legacy=value;}});
  window.__aeltToolkitNative={channel:'org.aelocaltoolkit.toolkit/1',extensionRoot:'C:/native-ui-test/extension'};
  window.chrome=window.chrome||{};
  window.chrome.webview={addEventListener(name,callback){if(name==='message')listeners.push(callback);},postMessage(message){
   function reply(raw){setTimeout(()=>listeners.forEach(callback=>callback({data:{channel:message.channel,id:message.id,result:raw}})),0);}
   if(message.method==='native.openExternal'){reply('{"ok":true}');return;}
   const args=JSON.parse(message.payload),script=message.method+'('+args.map(value=>JSON.stringify(value).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')).join(',')+')';
   if(!legacy)throw Error('Fake AE backend unavailable');legacy.evalScript(script,reply);
  }};
 });
};
