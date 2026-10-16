const {test}=require('node:test');const assert=require('node:assert/strict');const {storage}=require('./helpers.cjs');
const canonical='/extension/data/user-data.json';
const doc=env=>JSON.parse(env.files.get(canonical));
function seed(env,path,data){env.files.set(path,JSON.stringify(data));}
function custom(name){return {id:'scheme-custom',name,rules:[{path:'Image',extensions:['PNG'],itemTypes:[]}]};}

test('previous profile data migrates once; canonical portable data wins on subsequent loads',()=>{
 const env=storage();env.folders.add('/user/AE Local Toolkit/organizer-schemes');
 seed(env,'/extension/data/settings.json',{compFolder:'legacy'});
 seed(env,'/user/AE Local Toolkit/settings.json',{compFolder:'recent',quietMode:true,userExpressions:[{id:'user-one',name:'One',code:'time'}]});
 seed(env,'/extension/data/organizer-schemes/old.json',custom('legacy'));
 seed(env,'/user/AE Local Toolkit/organizer-schemes/custom.json',custom('recent'));
 const previous=[...env.files];
 assert.equal(JSON.parse(env.call('AELocalToolkit.storage.loadSettings()')).settings.compFolder,'recent');
 assert.equal(doc(env).schemes[0].name,'recent');
 for(const [path,bytes] of previous)assert.equal(env.files.get(path),bytes,'migration preserves source bytes');
 env.call('AELocalToolkit.storage.deleteScheme("scheme-custom")');
 seed(env,'/user/AE Local Toolkit/settings.json',{compFolder:'other-profile'});
 assert.equal(JSON.parse(env.call('AELocalToolkit.storage.loadSettings()')).settings.compFolder,'recent');
 assert.equal(env.call('AELocalToolkit.storage.listSchemes().length'),1);
});

test('copying the extension preserves all settings and presets and rebases its internal script paths',()=>{
 const env=storage();env.call('AELocalToolkit.storage.loadSettings()');
 env.call('AELocalToolkit.storage.saveSettings({quietMode:true,ignoreMainComp:true,ignoreMainCompNames:"Main,Intro",scriptFolder:"/extension/scripts",scriptFavorites:["/extension/scripts/Tool.jsx"],userExpressions:[{id:"user-demo",name:"Demo",code:"time * 24"}]})');
 env.call('AELocalToolkit.storage.saveScheme({id:"scheme-custom",name:"分类",rules:[]})');
 assert.equal(doc(env).settings.scriptFolder,'./scripts');assert.deepEqual(doc(env).settings.scriptFavorites,['./scripts/Tool.jsx']);
 const moved=storage({root:'/another-computer/工具箱'});
 for(const [path,bytes] of env.files)if(path.startsWith('/extension/'))moved.files.set(path.replace('/extension/','/another-computer/工具箱/'),bytes);
 seed(moved,'/user/AE Local Toolkit/settings.json',{quietMode:false});
 const settings=JSON.parse(moved.call('AELocalToolkit.storage.loadSettings()')).settings;
 assert.equal(settings.quietMode,true);assert.equal(settings.ignoreMainCompNames,'Main,Intro');assert.equal(settings.userExpressions[0].code,'time * 24');
 assert.equal(settings.scriptFolder,'/another-computer/工具箱/scripts');assert.deepEqual(settings.scriptFavorites,['/another-computer/工具箱/scripts/Tool.jsx']);assert.equal(moved.call('AELocalToolkit.storage.listSchemes()[1].name'),'分类');
});

test('saving settings or presets preserves the other half of the unified document',()=>{
 const env=storage();env.call('AELocalToolkit.storage.loadSettings()');
 env.call('AELocalToolkit.storage.saveScheme({id:"scheme-one",name:"One",rules:[]})');
 env.call('AELocalToolkit.storage.saveSettings({compFolder:"Saved",scriptFolder:"/external/scripts",scriptFavorites:["/external/scripts/A.jsx"]})');
 env.call('AELocalToolkit.storage.saveScheme({id:"scheme-two",name:"Two",rules:[]})');
 assert.equal(doc(env).settings.compFolder,'Saved');assert.equal(doc(env).settings.scriptFolder,'/external/scripts');assert.equal(doc(env).schemes.length,2);
 env.call('AELocalToolkit.storage.deleteScheme("scheme-one")');assert.equal(doc(env).settings.compFolder,'Saved');assert.deepEqual(doc(env).schemes.map(s=>s.id),['scheme-two']);
});

test('import merges in one atomic replacement and preserves the full previous document on failure',()=>{
 const env=storage();env.call('AELocalToolkit.storage.loadSettings()');env.call('AELocalToolkit.storage.saveScheme({id:"scheme-existing",name:"Old",rules:[]})');
 const before=env.files.get(canonical);
 seed(env,'/incoming.json',{format:'ae-local-toolkit',version:1,settings:{compFolder:'Imported'},schemes:[custom('Imported')]});
 env.context.File.openDialog=()=>new env.context.File('/incoming.json');env.fault.rename=path=>path===canonical;
 assert.equal(JSON.parse(env.call('AELocalToolkit.storage.importData()')).ok,false);assert.equal(env.files.get(canonical),before);assert.equal(env.files.get('/extension/data/before-import.json'),before);
 delete env.fault.rename;assert.equal(JSON.parse(env.call('AELocalToolkit.storage.importData()')).ok,true);assert.equal(doc(env).settings.compFolder,'Imported');assert.equal(doc(env).schemes.length,2);
});

test('recovering a missing portable file restores settings and presets together',()=>{
 const env=storage();env.call('AELocalToolkit.storage.loadSettings()');env.call('AELocalToolkit.storage.saveScheme({id:"scheme-one",name:"One",rules:[]})');
 env.call('AELocalToolkit.storage.saveSettings({compFolder:"Changed"})');env.files.delete(canonical);
 assert.equal(JSON.parse(env.call('AELocalToolkit.storage.loadSettings()')).settings.compFolder,'Comp');assert.equal(doc(env).schemes[0].id,'scheme-one');
});

test('a read-only extension never silently moves its data elsewhere',()=>{
 const env=storage();env.fault.open=(path,mode)=>mode==='w';
 const result=JSON.parse(env.call('AELocalToolkit.storage.loadSettings()'));assert.equal(result.ok,false);assert.match(result.messages[0],/无法写入/);assert.ok(!env.files.has('/user/AE Local Toolkit/settings.json'));assert.ok(!env.files.has(canonical));
});

test('invalid legacy data stops migration without replacing it with defaults',()=>{
 const env=storage();env.files.set('/extension/data/settings.json','{broken');assert.equal(JSON.parse(env.call('AELocalToolkit.storage.loadSettings()')).ok,false);assert.ok(!env.files.has(canonical));assert.equal(env.files.get('/extension/data/settings.json'),'{broken');
});

test('exported backups contain settings and presets in the same portable format',()=>{
 const env=storage();env.call('AELocalToolkit.storage.loadSettings()');env.call('AELocalToolkit.storage.saveScheme({id:"scheme-one",name:"One",rules:[]})');env.context.File.saveDialog=()=>new env.context.File('/export.json');
 assert.equal(JSON.parse(env.call('AELocalToolkit.storage.exportData()')).ok,true);assert.equal(env.files.get('/export.json'),env.files.get(canonical));
});

test('explicit import can recover from corrupt legacy data without modifying the source',()=>{
 const env=storage();env.files.set('/extension/data/settings.json','{broken');assert.equal(JSON.parse(env.call('AELocalToolkit.storage.loadSettings()')).ok,false);
 seed(env,'/incoming.json',{format:'ae-local-toolkit',version:1,settings:{compFolder:'Recovered'},schemes:[]});env.context.File.openDialog=()=>new env.context.File('/incoming.json');
 assert.equal(JSON.parse(env.call('AELocalToolkit.storage.importData()')).ok,true);assert.equal(doc(env).settings.compFolder,'Recovered');assert.equal(env.files.get('/extension/data/settings.json'),'{broken');
});

test('a valid imported .bak survives even if replacing the corrupt canonical file fails',()=>{
 const env=storage();const valid={format:'ae-local-toolkit',version:1,settings:{compFolder:'Recovered'},schemes:[]};
 env.files.set(canonical,'{broken');seed(env,canonical+'.bak',valid);env.context.File.openDialog=()=>new env.context.File(canonical+'.bak');env.fault.rename=path=>path===canonical;
 assert.equal(JSON.parse(env.call('AELocalToolkit.storage.importData()')).ok,false);assert.deepEqual(JSON.parse(env.files.get('/extension/data/last-import.json')),valid);assert.equal(env.files.get(canonical),'{broken');
 delete env.fault.rename;env.context.File.openDialog=()=>new env.context.File('/extension/data/last-import.json');assert.equal(JSON.parse(env.call('AELocalToolkit.storage.importData()')).ok,true);assert.equal(doc(env).settings.compFolder,'Recovered');
});
