const {test}=require('node:test');
const assert=require('node:assert/strict');
const {storage,context,run}=require('./helpers.cjs');

test('duration preferences survive save/export/import and reject unsupported values without replacing data',()=>{
  const env=storage();env.call('AELocalToolkit.storage.loadSettings()');
  for(const scale of [0,0.5,1,2]){
    env.call(`AELocalToolkit.storage.saveSettings({animationScale:${scale}})`);
    assert.equal(JSON.parse(env.call('AELocalToolkit.storage.loadSettings()')).settings.animationScale,scale);
  }
  const before=env.files.get('/extension/data/user-data.json');
  for(const value of ['3','-1','"1"','null'])assert.throws(()=>env.call(`AELocalToolkit.storage.saveSettings({animationScale:${value}})`));
  assert.equal(env.files.get('/extension/data/user-data.json'),before);
  env.context.File.saveDialog=()=>new env.context.File('/export.json');
  assert.equal(JSON.parse(env.call('AELocalToolkit.storage.exportData()')).ok,true);
  env.call('AELocalToolkit.storage.saveSettings({animationScale:0})');
  env.context.File.openDialog=()=>new env.context.File('/export.json');
  assert.equal(JSON.parse(env.call('AELocalToolkit.storage.importData()')).ok,true);
  assert.equal(JSON.parse(env.call('AELocalToolkit.storage.loadSettings()')).settings.animationScale,2);
  env.call('AELocalToolkit.storage.saveSettings({quietMode:true})');
  assert.equal(JSON.parse(env.call('AELocalToolkit.storage.loadSettings()')).settings.animationScale,undefined,'old documents remain valid; the UI supplies its 1x default');
});

test('legacy categories become editable tags, preserving code and metadata through backup round trips',()=>{
  const env=storage();env.call('AELocalToolkit.storage.loadSettings()');
  env.call('AELocalToolkit.storage.saveSettings({userExpressions:[{id:"user-old",name:"旧预设",code:"time * 24",description:"保留描述",category:"自定义",tags:[" 动画 ","动画","ANIMATION","animation","", "__proto__"]}]})');
  const settings=JSON.parse(env.call('AELocalToolkit.storage.loadSettings()')).settings;
  const item=settings.userExpressions[0];
  assert.deepEqual(item.tags,['动画','ANIMATION','__proto__','自定义']);assert.equal(item.category,undefined);
  assert.equal(item.description,'保留描述');assert.equal(item.code,'time * 24');
  item.tags=[];env.context.settingText=JSON.stringify(settings);
  env.call('AELocalToolkit.storage.saveSettings(JSON.parse(settingText))');
  env.context.File.saveDialog=()=>new env.context.File('/export.json');env.call('AELocalToolkit.storage.exportData()');
  assert.deepEqual(JSON.parse(env.files.get('/export.json')).settings.userExpressions[0].tags,[]);
  env.context.File.openDialog=()=>new env.context.File('/export.json');env.call('AELocalToolkit.storage.importData()');
  const restored=JSON.parse(env.call('AELocalToolkit.storage.loadSettings()')).settings.userExpressions[0];
  assert.deepEqual(restored.tags,[]);assert.equal(restored.category,undefined);
});

test('invalid tag data cannot replace a good document',()=>{
  const env=storage();env.call('AELocalToolkit.storage.loadSettings()');
  const before=env.files.get('/extension/data/user-data.json');
  for(const suffix of ['tags:[1]','tags:[null]','tags:{}','category:42']){
    assert.throws(()=>env.call(`AELocalToolkit.storage.saveSettings({userExpressions:[{id:"user-bad",name:"Bad",code:"time",${suffix}}]})`));
    assert.equal(env.files.get('/extension/data/user-data.json'),before);
  }
});

test('ignored composition names support old text and new complete-name arrays through backups',()=>{
  const env=storage();env.call('AELocalToolkit.storage.loadSettings()');
  env.call('AELocalToolkit.storage.saveSettings({ignoreMainCompNames:"Main,Intro"})');
  assert.equal(JSON.parse(env.call('AELocalToolkit.storage.loadSettings()')).settings.ignoreMainCompNames,'Main,Intro');
  env.call('AELocalToolkit.storage.saveSettings({ignoreMainCompNames:["Main Comp","主 合成"]})');
  env.context.File.saveDialog=()=>new env.context.File('/export.json');env.call('AELocalToolkit.storage.exportData()');
  env.call('AELocalToolkit.storage.saveSettings({ignoreMainCompNames:[]})');
  assert.deepEqual(JSON.parse(env.call('AELocalToolkit.storage.loadSettings()')).settings.ignoreMainCompNames,[]);
  env.context.File.openDialog=()=>new env.context.File('/export.json');env.call('AELocalToolkit.storage.importData()');
  assert.deepEqual(JSON.parse(env.call('AELocalToolkit.storage.loadSettings()')).settings.ignoreMainCompNames,['Main Comp','主 合成']);
  const before=env.files.get('/extension/data/user-data.json');
  for(const value of ['[1]','[null]','{}','true'])assert.throws(()=>env.call(`AELocalToolkit.storage.saveSettings({ignoreMainCompNames:${value}})`));
  assert.equal(env.files.get('/extension/data/user-data.json'),before);
});

test('motion timing uses the original 2x baseline and immediately finishes active effects when disabled',()=>{
  const animations=[],root={style:{setProperty(){}},dataset:{}};
  const ctx=context({state:{animationScale:1},els:{animationScaleSelect:{}},window:{matchMedia:()=>({matches:false})},document:{getElementById:()=>null,documentElement:root,getAnimations:()=>animations,querySelectorAll:()=>[]}});
  run(ctx,'extension/client/js/ui.js');
  let options;
  const animation={finish(){this.finished=true;},updatePlaybackRate(value){this.rate=value;}};
  const element={animate(frames,value){options=value;animations.push(animation);return animation;}};
  ctx.animateMotion(element,[],{duration:200,delay:144});
  assert.equal(options.duration,100);assert.equal(options.delay,72);
  ctx.setAnimationScale(0.5);assert.equal(animation.rate,2);assert.equal(ctx.motionTime(200),50);
  ctx.setAnimationScale(2);assert.equal(animation.rate,0.5);assert.equal(ctx.motionTime(200),200);
  ctx.setAnimationScale(0);assert.equal(animation.finished,true);assert.equal(ctx.allowMotion(),false);assert.equal(root.dataset.motion,'off');
  ctx.setAnimationScale('bad');assert.equal(ctx.state.animationScale,1);
});
