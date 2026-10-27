const {test}=require('node:test');
const assert=require('node:assert/strict');
const {context,run,storage,source}=require('./helpers.cjs');
const acorn=require('../extension/client/vendor/acorn.js');
const ctx=context({acorn});run(ctx,'extension/client/js/expression-help.js');run(ctx,'extension/client/js/completion.js');
const complete=(code,manual=false,index=code.length)=>ctx.AELT.completion.suggestions(code,index,manual);
const names=(code,manual=false)=>Array.from(complete(code,manual)?.list||[],item=>item.name);

test('completion preferences default on with Enter, survive backup and reject invalid settings',()=>{
  const env=storage();
  assert.equal(JSON.parse(env.call('AELocalToolkit.storage.loadSettings()')).settings.expressionCompletion,true);
  assert.equal(JSON.parse(env.call('AELocalToolkit.storage.loadSettings()')).settings.expressionHelp,true);
  assert.equal(JSON.parse(env.call('AELocalToolkit.storage.loadSettings()')).settings.expressionCompletionKey,'Enter');
  env.call('AELocalToolkit.storage.saveSettings({expressionCompletion:true,expressionHelp:false,expressionCompletionKey:"Tab"})');
  assert.equal(JSON.parse(env.call('AELocalToolkit.storage.loadSettings()')).settings.expressionCompletion,true);
  env.context.File.saveDialog=()=>new env.context.File('/completion-backup.json');env.call('AELocalToolkit.storage.exportData()');
  env.call('AELocalToolkit.storage.saveSettings({expressionCompletion:false,expressionHelp:true,expressionCompletionKey:"Enter"})');
  assert.equal(JSON.parse(env.call('AELocalToolkit.storage.loadSettings()')).settings.expressionCompletion,false);
  env.context.File.openDialog=()=>new env.context.File('/completion-backup.json');env.call('AELocalToolkit.storage.importData()');
  assert.equal(JSON.parse(env.call('AELocalToolkit.storage.loadSettings()')).settings.expressionCompletion,true);
  assert.equal(JSON.parse(env.call('AELocalToolkit.storage.loadSettings()')).settings.expressionHelp,false);
  assert.equal(JSON.parse(env.call('AELocalToolkit.storage.loadSettings()')).settings.expressionCompletionKey,'Tab');
  const before=env.files.get('/extension/data/user-data.json');
  for(const key of ['expressionCompletion','expressionHelp'])for(const value of ['"true"','1','null','{}'])assert.throws(()=>env.call(`AELocalToolkit.storage.saveSettings({${key}:${value}})`));
  for(const value of ['"Space"','"enter"','"Enter/Tab"','true','null','1','{}'])assert.throws(()=>env.call(`AELocalToolkit.storage.saveSettings({expressionCompletionKey:${value}})`));
  assert.equal(env.files.get('/extension/data/user-data.json'),before);
  assert.doesNotThrow(()=>env.call('AELocalToolkit.storage.saveSettings({quietMode:true})'),'older settings remain valid');
});

test('every shipped built-in function has concise bilingual help for every argument',()=>{
  const ast=acorn.parse(source('extension/client/js/completion.js'),{ecmaVersion:2020});let checked=0;
  function walk(node){if(!node||typeof node!=='object')return;
    if(node.type==='CallExpression'&&node.callee.name==='methods'){
      const owner=node.arguments[0].value;
      for(const def of node.arguments[1].elements){const signature=def.value.split('|')[0],start=signature.indexOf('(');
        const entry={owner,name:signature.slice(0,start),params:signature.slice(start),kind:'function'};
        for(const language of ['zh-CN','en']){const help=ctx.AELT.expressionHelp.describe(entry,language);
          assert.ok(help,owner+'.'+entry.name);assert.ok(help.summary.length<180,'keep summaries concise');
          for(const param of help.parameters){assert.ok(param.type,entry.name+': '+param.name);assert.ok(param.description,entry.name+': '+param.name);}
          if(language==='en')assert.doesNotMatch(JSON.stringify(help),/[\u4e00-\u9fff]/);
        }checked++;
      }
    }
    for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);
  }walk(ast);assert.ok(checked>90);
  const wig=ctx.AELT.expressionHelp.describe(complete('wig').list[0],'zh-CN');
  assert.equal(wig.parameters.length,5);assert.equal(wig.parameters.filter(p=>!p.optional).length,2);
  assert.deepEqual(Array.from(wig.allowedCounts),[2,3,4,5]);assert.equal(wig.count,'可传 2–5 个参数');
  assert.match(wig.note,/末尾/);
  const sample=ctx.AELT.expressionHelp.describe(complete('thisLayer.sampleI').list[0],'zh-CN');assert.equal(sample.parameters.length,4);assert.equal(sample.parameters[1].defaultValue,'[.5,.5]');
  const random=ctx.AELT.expressionHelp.describe(complete('random',true).list.find(x=>x.name==='random'),'zh-CN');assert.match(random.count,/0 或 1 或 2/);
  const linear=ctx.AELT.expressionHelp.describe(complete('linear',true).list.find(x=>x.name==='linear'),'zh-CN');
  assert.deepEqual(Array.from(linear.allowedCounts),[3,5]);assert.equal(linear.count,'可传 3 或 5 个参数');
  assert.equal(ctx.AELT.expressionHelp.describe({kind:'variable',name:'wigglesPerSecond'},'zh-CN'),null);
});

test('AE globals, word-prefix matches and draft variables are ranked without executing code',()=>{
  assert.deepEqual(names('wig'),['wiggle','temporalWiggle']);
  assert.deepEqual(names('var wigglesPerSecond=5;\nwig'),['wiggle','wigglesPerSecond','temporalWiggle']);
  assert.ok(names('const 振幅=20;\n振',true).includes('振幅'));
  assert.ok(names('w').includes('wiggle'),'the first typed letter starts matching');
  assert.equal(complete(''),null,'an empty automatic session stays closed');
  assert.ok(names('w',true).includes('wiggle'));
  assert.ok(names('',true).includes('thisComp'));
  const entry=complete('wig').list[0];assert.match(entry.params,/freq, amp/);
  names('globalThis.shouldNeverExecute = true; wig');assert.equal(globalThis.shouldNeverExecute,undefined);
});

test('matching rejects arbitrary substrings and returns at most the seven best candidates',()=>{
  assert.deepEqual(names('ti').slice(0,4),['time','timeToCurrentFormat','timeToFrames','timeToTimecode']);
  for(const noise of ['active','audioActive','continue'])assert.ok(!names('ti').includes(noise));
  assert.deepEqual(names('thisLayer.au'),['audioActive','hasAudio']);
  assert.deepEqual(names('thisLayer.act'),['active','audioActive']);
  assert.deepEqual(names('wig'),['wiggle','temporalWiggle']);
  assert.deepEqual(names('var custom_time=1; ti').filter(name=>name==='custom_time'),['custom_time']);
  const code=Array.from({length:30},(_,i)=>'var prefix'+String(i).padStart(2,'0')+'=0;').join('\n')+'\npre';
  assert.deepEqual(names(code),Array.from({length:7},(_,i)=>'prefix'+String(i).padStart(2,'0')));
  assert.ok(complete('',true).list.length<=7);
});

test('every shipped property has meaningful bilingual help without a parameter count',()=>{
  const ast=acorn.parse(source('extension/client/js/completion.js'),{ecmaVersion:2020});let checked=0;
  function walk(node){if(!node||typeof node!=='object')return;
    if(node.type==='CallExpression'&&node.callee.name==='fields'){
      const owner=node.arguments[0].value;
      for(const name of node.arguments[1].value.split(' '))for(const language of ['zh-CN','en']){
        const help=ctx.AELT.expressionHelp.describe({owner,name,kind:'property'},language);
        assert.ok(help,owner+'.'+name);assert.ok(help.summary.length>5);assert.ok(help.summary.length<180);
        assert.deepEqual(Array.from(help.parameters),[]);assert.doesNotMatch(help.count,/参数|arguments/);
        if(language==='en')assert.doesNotMatch(JSON.stringify(help),/[\u4e00-\u9fff]/);
        checked++;
      }
    }
    for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);
  }walk(ast);assert.ok(checked>180);
  const audio=ctx.AELT.expressionHelp.describe(names('thisLayer.au').length&&complete('thisLayer.au').list[0],'zh-CN');
  assert.match(audio.summary,/音频开关.*入点.*出点/);assert.equal(audio.count,'类型：Boolean');
});

test('member completion follows known AE chains and does not mix unrelated namespaces',()=>{
  for(const code of ['thisComp.la','comp("Name.with.dots").la','(thisComp).la','comp("A").layer(1).source.la'])assert.deepEqual(names(code).slice(0,2),['layer','layerByComment'],code);
  for(const code of ['thisLayer.transform.po','thisComp.layer("Title").transform.po','thisComp\n  .layer(1)\n  .transform.po'])assert.equal(names(code)[0],'position',code);
  assert.ok(names('thisComp.').includes('frameDuration'));
  assert.ok(!names('thisComp.').includes('wiggle'));
  assert.deepEqual(names('Math.si').slice(0,2),['sign','sin']);
  assert.deepEqual(names('position.valueAt'),['valueAtTime']);
  assert.deepEqual(names('effect("Slider")("Slider").valueAt'),['valueAtTime']);
  assert.deepEqual(names('thisLayer.text.sourceText.style.setFontS'),['setFontSize']);
  assert.deepEqual(names('unknownObject.wig',true),[]);
  assert.deepEqual(names('thisComp.layer("A").unknown.wig',true),[]);
});

test('comments, literals, numbers and template text suppress completion while interpolation works',()=>{
  for(const code of ['// wig','value; // wig','/* wig','"wig',"'wig",'`wig','`hello ${time} wig','/wig','/wig/','23','1.23','// thisComp.'])assert.equal(complete(code,true),null,code);
  assert.deepEqual(names('`hello ${wig'),['wiggle','temporalWiggle']);
  assert.deepEqual(names('/* description */ wig'),['wiggle','temporalWiggle']);
  assert.deepEqual(names('if(time > 0) {\n wig'),['wiggle','temporalWiggle']);
});

test('replacement range covers a whole identifier but preserves adjacent code',()=>{
  const code='value + wiggle(5, 20)',result=complete(code,true,11);
  assert.equal(result.from,8);assert.equal(result.to,14);assert.equal(result.prefix,'wig');
  assert.equal(code.slice(0,result.from)+'wiggle'+code.slice(result.to),'value + wiggle(5, 20)');
  assert.equal(complete('x'.repeat(200001),true),null);
});
