const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {context,run,source,storage}=require('./helpers.cjs');
const acorn=require('../extension/client/vendor/acorn.js');
const prettier=require('../extension/client/vendor/prettier.js');
const babel=require('../extension/client/vendor/parser-babel.js');
function editor(){const ctx=context({acorn,prettier,prettierPlugins:[babel]});run(ctx,'extension/client/js/editor.js');return ctx.AELT.editor;}

test('syntax checks locate malformed drafts without treating AE globals as undefined',()=>{
  const e=editor();
  for(const code of ['', 'wiggle(5,20)', 'thisComp.layer("标题").transform.position', 'return value', 'var x=/[{}]/g; value', '`hello ${time}`'])assert.equal(e.check(code),null,code);
  for(const code of ['const x = ;','if (time > 1) {','"missing','/* missing', 'var x = /unterminated'])assert.ok(e.check(code),code);
  assert.equal(e.check('var x = 1;\nconst y = ;').line,1);
  assert.equal(e.check('var x = 1;\nconst y = ;').ch,10);
  assert.equal(e.check('globalThis.shouldNeverExecute = true; value'),null);
  assert.equal(globalThis.shouldNeverExecute,undefined);
});

test('formatting preserves syntax trees, comments, strings, regexes and ASI-sensitive returns',()=>{
  const e=editor();
  const cases=[
    'if(time>1){value+[10,20]}else{wiggle(5,20)}',
    'function f(){return\n[1,2]}\nf();',
    'var x="中文 // { } %20"; // keep this\nvar regex=/https?:\\/\\//g;\nvalue',
    'for(var i=0;i<5;i++){value+=i}\nvalue',
    'var obj={a:1,b:{c:2}};\nobj.b.c',
    'var x=`hello ${time}`;\nx',
    'var ratio=time/2/3; value*ratio',
    'return value'
  ];
  function ast(code){return JSON.parse(JSON.stringify(acorn.parse(code,{ecmaVersion:2020,allowReturnOutsideFunction:true}),(key,value)=>['start','end','raw'].includes(key)?undefined:value));}
  for(const code of cases){const formatted=e.formatCode(code);assert.deepEqual(ast(formatted),ast(code));assert.equal(e.formatCode(formatted),formatted);}
  const original=cases[2];assert.match(e.formatCode(original),/keep this/);assert.match(e.formatCode(original),/中文 \/\/ \{ \} %20/);
  assert.throws(()=>e.formatCode('const bad = ;'));
});

test('language settings survive save, export and import, with older data remaining valid',()=>{
  const env=storage();env.call('AELocalToolkit.storage.loadSettings()');
  env.call('AELocalToolkit.storage.saveSettings({language:"en",compFolder:"自定义",userExpressions:[]})');
  assert.equal(JSON.parse(env.call('AELocalToolkit.storage.loadSettings()')).settings.language,'en');
  env.context.File.saveDialog=()=>new env.context.File('/export.json');
  assert.equal(JSON.parse(env.call('AELocalToolkit.storage.exportData("en")')).ok,true);
  assert.equal(JSON.parse(env.files.get('/export.json')).settings.language,'en');
  env.call('AELocalToolkit.storage.saveSettings({language:"zh-CN"})');
  env.context.File.openDialog=()=>new env.context.File('/export.json');
  assert.equal(JSON.parse(env.call('AELocalToolkit.storage.importData("en")')).ok,true);
  assert.equal(JSON.parse(env.call('AELocalToolkit.storage.loadSettings()')).settings.language,'en');
  assert.throws(()=>env.call('AELocalToolkit.storage.saveSettings({language:"fr"})'));
  assert.doesNotThrow(()=>env.call('AELocalToolkit.storage.saveSettings({compFolder:"Legacy"})'));
});

test('English copy covers every translated source key and historical changelog entry',()=>{
  const ctx=context();run(ctx,'extension/client/js/translations.js');const dict=ctx.AELT.translations.en;
  const fs=require('node:fs'),path=require('node:path');
  for(const file of fs.readdirSync(path.join(__dirname,'../extension/client/js')).filter(f=>!['translations.js','i18n.js'].includes(f))){
    const ast=acorn.parse(source('extension/client/js/'+file),{ecmaVersion:2020});
    function walk(n){if(!n||typeof n!=='object')return;
      if(n.type==='CallExpression'&&n.callee.name==='t'){
        const arg=n.arguments[0],keys=arg?.type==='Literal'?[arg.value]:arg?.type==='ConditionalExpression'?[arg.consequent.value,arg.alternate.value]:[];
        for(const key of keys)if(typeof key==='string')assert.ok(dict[key],file+': '+key);
      }
      for(const value of Object.values(n))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);
    }walk(ast);
  }
  for(const entry of JSON.parse(source('extension/data/changelog.json')).entries){const copy=entry.changesEn||ctx.AELT.changelogTranslations[entry.version];assert.equal(copy.length,entry.changes.length,entry.version);for(const text of copy)assert.ok(text&&!/[\u4e00-\u9fff]/.test(text));}
});
