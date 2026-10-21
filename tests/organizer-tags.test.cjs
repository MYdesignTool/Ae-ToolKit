const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {context,run}=require('./helpers.cjs');
function setup(){const ctx=context();run(ctx,'extension/client/js/util.js');run(ctx,'extension/client/js/organizer.js');return ctx;}
test('path input normalizes separators and preserves Unicode, spaces and repeated folder names',()=>{
  const ctx=setup();assert.deepEqual(Array.from(ctx.parseRuleTags(' 素材\\Image / Image / My Folder ', 'path')),['素材','Image','Image','My Folder']);
  for(const name of ['..','.','bad\nname','A/B','A\\B'])assert.equal(ctx.validRuleTag(name,'path'),false);
  for(const name of ['素材','My Folder','__proto__','constructor'])assert.equal(ctx.validRuleTag(name,'path'),true);
  assert.equal(ctx.normalizeRulePath(' 素材＼ Image ／ My Folder '),'素材/Image/My Folder');
  for(const path of ['', '素材/../Image', './Image', '素材\n/Image'])assert.equal(ctx.validRulePath(path),false);
  assert.equal(ctx.validRulePath('素材/Image/My Folder'),true);
});
test('extension tags accept pasted lists and wildcard dots but reject invalid suffixes and conflicts',()=>{
  const ctx=setup();assert.deepEqual(Array.from(ctx.parseRuleTags('*.png, jpg，EXR; psd；mov\n .aif','extensions')),['PNG','JPG','EXR','PSD','MOV','AIF']);
  ctx.schemeText=JSON.stringify({rules:[{path:'素材/Image',extensions:['PNG','JPG']},{path:'素材/Video',extensions:['MOV']}]});
  assert.equal(vm.runInContext('validateScheme(JSON.parse(schemeText)).ok',ctx),true);
  for(const extension of ['PNG','BAD?','*','中文','TAR.GZ']){
    ctx.ext=extension;assert.equal(vm.runInContext('var scheme=JSON.parse(schemeText);scheme.rules[1].extensions.push(ext);validateScheme(scheme).ok',ctx),false);
  }
});

test('folder tree preserves complete hierarchy, repeated names and safe object-like folder names',()=>{
  const ctx=setup();run(ctx,'extension/client/js/organizer-paths.js');
  ctx.paths=['素材/Image/Image','Video/Image','素材/Image','__proto__/constructor','素材/../bad'];
  const nodes=JSON.parse(vm.runInContext('JSON.stringify(buildRulePathNodes(paths))',ctx));
  assert.deepEqual(nodes.find(node=>node.path==='素材/Image/Image'),{path:'素材/Image/Image',name:'Image',parent:'素材/Image',depth:3});
  assert.equal(nodes.filter(node=>node.name==='Image').length,3);assert.equal(nodes.filter(node=>node.path==='素材/Image').length,1);
  assert.ok(nodes.some(node=>node.path==='__proto__/constructor'));assert.ok(!nodes.some(node=>node.name==='..'));
});

test('ignored name tags migrate legacy text but preserve complete names and explicit empty lists',()=>{
  const ctx=setup();
  assert.deepEqual(Array.from(ctx.parseIgnoreNameTags(' Main,主合成；Intro\nMAIN ')),['Main','主合成','Intro']);
  assert.deepEqual(Array.from(ctx.parseIgnoreNameTags([' Main Comp ','main comp','总 合成',''])),['Main Comp','总 合成']);
  assert.deepEqual(Array.from(ctx.parseIgnoreNameTags([])),[]);
});

test('folder search matches path words and normalized separators, ranking exact folder names first',()=>{
  const ctx=setup();run(ctx,'extension/client/js/organizer-paths.js');
  ctx.paths=['Assets/Image','Image/Archive','素材库/角色/立绘','__proto__/Image'];
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(searchRulePathNodes(buildRulePathNodes(paths), "素材库 立绘").map(function(n){return n.path;}))',ctx)),['素材库/角色/立绘']);
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(searchRulePathNodes(buildRulePathNodes(paths), "素材库＼角色").map(function(n){return n.path;}))',ctx)),['素材库/角色','素材库/角色/立绘']);
  assert.equal(vm.runInContext('searchRulePathNodes(buildRulePathNodes(paths), "IMAGE")[0].path',ctx),'Image');
  assert.equal(vm.runInContext('searchRulePathNodes(buildRulePathNodes(paths), "不存在").length',ctx),0);
});
