const {test}=require('node:test');const assert=require('node:assert/strict');const {context,run,storage,source}=require('./helpers.cjs');
function projectFixture(){
 const all=[];let root;
 class Base {constructor(name){this.name=name;this.parentFolder=root;all.push(this);}}
 class FolderItem extends Base {get numItems(){return all.filter(item=>item.parentFolder===this).length;}item(i){return all.filter(item=>item.parentFolder===this)[i-1];}remove(){assert.equal(this.numItems,0);all.splice(all.indexOf(this),1);}}
 class CompItem extends Base{};class SolidSource{};
 root=new FolderItem('ROOT');root.parentFolder=null;all.splice(0,1);
 const project={rootFolder:root,items:{addFolder:name=>new FolderItem(name)},get numItems(){return all.length;},item:i=>all[i-1]};
 const ctx=context({AELocalToolkit:{},app:{project,beginUndoGroup:()=>{},endUndoGroup:()=>{}},FolderItem,CompItem,SolidSource});run(ctx,'extension/host/modules/organizer.jsx');
 return {ctx,root,all,FolderItem,CompItem,SolidSource,Base};
}
test('organizer initializes without duplicated defaults and handles prototype-like folder names',()=>{
 const env=projectFixture();const image=new env.Base('image.png');image.file={name:'image.png'};const comp=new env.CompItem('Comp');const solid=new env.Base('Solid');solid.mainSource=new env.SolidSource();
 env.ctx.scheme={name:'test',fallbackPath:'Footage',rules:[{path:'__proto__',extensions:['PNG'],itemTypes:[]},{path:'constructor',extensions:[],itemTypes:['CompItem']},{path:'hasOwnProperty',extensions:[],itemTypes:['SolidSource']}]};
 env.ctx.schemeText=JSON.stringify(env.ctx.scheme);
 const result=require('node:vm').runInContext('AELocalToolkit.organizer.organizeProjectWithScheme(JSON.parse(schemeText))',env.ctx);
 assert.equal(result.ok,true);assert.equal(image.parentFolder.name,'__proto__');assert.equal(comp.parentFolder.name,'constructor');assert.equal(solid.parentFolder.name,'hasOwnProperty');assert.equal(result.moved,3);assert.equal(result.folders.length,3);
});

test('organizer matches complete ignored names with spaces, fuzzy mode, old lists and empty lists',()=>{
 for(const [names,fuzzy,expected] of [[['main comp'],false,1],[['main comp'],true,2],['Main,Intro',false,1],[[],true,0]]){
  const env=projectFixture(),comps=['Main Comp','Main Comp v2','Main'].map(name=>new env.CompItem(name));
  env.ctx.schemeText=JSON.stringify({name:'test',rules:[{path:'Comp',itemTypes:['CompItem'],extensions:[]}],fallbackPath:'Footage',ignoreMainComp:true,ignoreMainCompNames:names,ignoreMainCompFuzzy:fuzzy});
  const result=require('node:vm').runInContext('AELocalToolkit.organizer.organizeProjectWithScheme(JSON.parse(schemeText))',env.ctx);
  assert.equal(result.ok,true);assert.equal(result.ignoredMainComp||0,expected);assert.equal(comps.filter(comp=>comp.parentFolder===env.root).length,expected);
 }
});
function photoshopFootage(env,name,fsName){
 const item=new env.Base(name);item.file={name:fsName.replace(/\\/g,'/').split('/').pop(),fsName};return item;
}
function organizePhotoshop(env,rules=[{path:'PSD',extensions:['PSD','PSB']}]){
 env.ctx.schemeText=JSON.stringify({name:'Photoshop',fallbackPath:'Footage',rules});
 return require('node:vm').runInContext('AELocalToolkit.organizer.organizeProjectWithScheme(JSON.parse(schemeText))',env.ctx);
}

test('organizer groups PSD and PSB layers by source file, preserving compositions and other footage rules',()=>{
 const env=projectFixture(),oldFolder=new env.FolderItem('Imported Layers');
 const a=photoshopFootage(env,'renamed background','D:/Art/海报 100%20.psd');
 const b=photoshopFootage(env,'Foreground/海报','D:/Art/海报 100%20.psd');b.parentFolder=oldFolder;
 const c=photoshopFootage(env,'large layer','D:/Art/海报 100%20.psb');
 const d=photoshopFootage(env,'large layer 2','D:/Art/海报 100%20.psb');
 const image=photoshopFootage(env,'photo','D:/Art/photo.png'),comp=new env.CompItem('海报');
 const rules=[{path:'Assets/Photoshop',extensions:['PSD','PSB']},{path:'Images',extensions:['PNG']}];
 const result=organizePhotoshop(env,rules);
 assert.equal(result.ok,true);assert.equal(result.moved,6);assert.equal(result.errors,0);
 assert.equal(a.parentFolder,b.parentFolder);assert.equal(c.parentFolder,d.parentFolder);assert.notEqual(a.parentFolder,c.parentFolder);
 assert.equal(a.parentFolder.name,'海报 100%20.psd');assert.equal(c.parentFolder.name,'海报 100%20.psb');
 assert.equal(a.parentFolder.parentFolder.name,'Photoshop');assert.equal(a.parentFolder.parentFolder.parentFolder.name,'Assets');
 assert.equal(image.parentFolder.name,'Images');assert.equal(comp.parentFolder.name,'Comp');assert.ok(!env.all.includes(oldFolder));
 assert.equal(result.folders.find(folder=>folder.path==='Assets/Photoshop/海报 100%20.psd').count,2);
 const folders=env.all.filter(item=>item instanceof env.FolderItem),again=organizePhotoshop(env,rules);
 assert.equal(again.ok,true);assert.equal(again.moved,0);assert.equal(again.skipped,6);assert.deepEqual(env.all.filter(item=>item instanceof env.FolderItem),folders);
});

test('same-named Photoshop files at different paths stay separate and reuse their folders on subsequent runs',()=>{
 const env=projectFixture();
 const a=photoshopFootage(env,'A','D:/One/Design.psd'),b=photoshopFootage(env,'B','D:/Two/Design.psd');
 const a2=photoshopFootage(env,'A2','D:/One/Design.psd'),b2=photoshopFootage(env,'B2','D:/Two/Design.psd');
 assert.equal(organizePhotoshop(env).ok,true);
 assert.equal(a.parentFolder,a2.parentFolder);assert.equal(b.parentFolder,b2.parentFolder);assert.notEqual(a.parentFolder,b.parentFolder);
 assert.equal(a.parentFolder.name,'Design.psd');assert.equal(b.parentFolder.name,'Design.psd (2)');
 const original=b.parentFolder;
 // Removing the earlier source must not renumber the remaining group.
 env.all.splice(env.all.indexOf(a),1);env.all.splice(env.all.indexOf(a2),1);
 assert.equal(organizePhotoshop(env).moved,0);assert.equal(b.parentFolder,original);
 const b3=photoshopFootage(env,'new import','D:/Two/Design.psd');
 assert.equal(organizePhotoshop(env).moved,1);assert.equal(b3.parentFolder,original);
});

test('Photoshop source identity normalizes Windows paths but preserves macOS case and literal percent names',()=>{
 const env=projectFixture();env.ctx.$={os:'Windows 11'};
 const a=photoshopFootage(env,'A','D:\\Art\\Design.PSD'),b=photoshopFootage(env,'B','d:/art/design.psd');
 const percent=photoshopFootage(env,'literal','D:/Art/Design%20.psd'),space=photoshopFootage(env,'space','D:/Art/Design .psd');
 assert.equal(organizePhotoshop(env).ok,true);assert.equal(a.parentFolder,b.parentFolder);assert.notEqual(percent.parentFolder,space.parentFolder);
 const mac=projectFixture();mac.ctx.$={os:'Macintosh'};
 const upper=photoshopFootage(mac,'upper','/Art/Design.psb'),lower=photoshopFootage(mac,'lower','/art/Design.psb');
 assert.equal(organizePhotoshop(mac).ok,true);assert.notEqual(upper.parentFolder,lower.parentFolder);
});

test('Photoshop grouping respects fallback paths and protects reserved nested rule folders',()=>{
 const env=projectFixture(),a=photoshopFootage(env,'A','/Art/Design.psd'),b=photoshopFootage(env,'B','/Art/Design.psd');
 const image=photoshopFootage(env,'PNG','/Art/picture.png'),rules=[{path:'Footage/Design.psd',extensions:['PNG']}];
 const result=organizePhotoshop(env,rules);
 assert.equal(result.ok,true);assert.equal(a.parentFolder,b.parentFolder);assert.equal(a.parentFolder.name,'Design.psd (2)');
 assert.equal(a.parentFolder.parentFolder.name,'Footage');assert.equal(image.parentFolder.name,'Design.psd');assert.notEqual(a.parentFolder,image.parentFolder);
 assert.equal(organizePhotoshop(env,rules).moved,0);
});

test('Photoshop grouping avoids unrelated existing folder contents and safely falls back without a source path',()=>{
 const env=projectFixture(),item=photoshopFootage(env,'layer','/Art/Design.psd');
 const parent=new env.FolderItem('PSD'),existing=new env.FolderItem('Design.psd');existing.parentFolder=parent;
 const comp=new env.CompItem('nested composition');comp.parentFolder=existing;
 const unavailable=new env.Base('no source path');unavailable.file={name:'unknown.psb'};
 const result=organizePhotoshop(env);
 assert.equal(result.ok,true);assert.equal(item.parentFolder.name,'Design.psd (2)');assert.equal(unavailable.parentFolder,parent);assert.equal(comp.parentFolder.name,'Comp');
 assert.equal(organizePhotoshop(env).moved,0);
});

test('launcher accepts uppercase extensions, nested matching images and literal percent paths',()=>{
 const env=storage({decodeFilePaths:true});env.folders.add('/scripts');env.folders.add('/scripts/Sub');env.folders.add('/scripts/(ignore)');
 env.files.set('/scripts/Sub/Tool.JSX','');env.files.set('/scripts/Sub/Tool.jpg','image');env.files.set('/scripts/percent%20.jsx','');env.files.set('/scripts/(ignore)/hidden.jsx','');
 const launched=[];env.context.$={evalFile:file=>launched.push(file.fsName)};run(env.context,'extension/host/modules/launcher.jsx');
 const result=env.call('AELocalToolkit.launcher.scanScripts("/scripts")');assert.equal(result.ok,true);assert.equal(result.scripts.length,2);assert.ok(result.scripts.find(s=>s.name==='Tool').iconPath.endsWith('/Sub/Tool.jpg'));
 assert.equal(env.call('AELocalToolkit.launcher.launchScript("/scripts/percent%20.jsx").ok'),true);assert.equal(launched[0],'/scripts/percent%20.jsx');assert.equal(env.call('AELocalToolkit.launcher.launchScript("/unscanned.jsx").ok'),false);
});
test('old folder-format schemes are migrated only at the storage boundary',()=>{
 const env=storage();env.files.set('/extension/data/organizer-schemes/old.json','{"id":"scheme-v1","name":"v1","folders":[{"name":"Images","extensions":["PNG"]}]}');
 const result=env.call('AELocalToolkit.storage.listSchemes()');assert.equal(result.length,2);assert.equal(result[1].rules[0].path,'Images');
});
test('host loads ordered UTF-8 module text without evalFile path conversion',()=>{
 const env=storage();env.files.set('/extension/CSXS/manifest.xml','manifest');for(const file of ['default-expressions.json','changelog.json'])env.files.set('/extension/data/'+file,source('extension/data/'+file));
 const modules=['lib/json.jsx','modules/storage.jsx','modules/organizer.jsx','modules/expressions.jsx','modules/launcher.jsx'];for(const file of modules)env.files.set('/extension/host/'+file,source('extension/host/'+file));
 const reads=[],read=env.context.File.prototype.read;env.context.File.prototype.read=function(){if(this.fullName.includes('/host/')){assert.equal(this.encoding,'UTF-8');reads.push(this.fullName);}return read.call(this);};
 env.context.$={evalFile:()=>{throw Error('Cannot convert to encoded path');}};env.context.app={version:'24.0'};run(env.context,'extension/host/index.jsx');
 assert.equal(JSON.parse(env.call('AELT_setModuleBase("/extension")')).ok,true);assert.equal(reads.length,5);assert.equal(JSON.parse(env.call('AELT_bootstrap()')).expressions.length,2);assert.equal(JSON.parse(env.call('AELT_setModuleBase("/extension")')).ok,true);assert.equal(reads.length,5);
 env.context.AELocalToolkit.expressions={stale:true};
 assert.equal(JSON.parse(env.call('AELT_setModuleBase("/extension",true)')).ok,true);assert.equal(reads.length,10);
 assert.equal(typeof env.context.AELocalToolkit.expressions.getSelectedPropertySummary,'function','panel reload replaces cached host modules');
 env.context.AELocalToolkit.ready=false;env.files.set('/extension/host/modules/launcher.jsx','AELocalToolkit.launcher = null;');const failed=JSON.parse(env.call('AELT_setModuleBase("/extension")'));assert.equal(failed.ok,false);assert.match(failed.messages[0],/launcher.jsx/);assert.equal(env.context.AELocalToolkit.ready,false);
 env.context.badLoaderMessage="Bad \"quoted\" JSON loader\nline two";env.files.set('/extension/host/lib/json.jsx','throw new Error(badLoaderMessage);');
 const missingJson=JSON.parse(env.call('AELT_setModuleBase("/extension")'));assert.equal(missingJson.ok,false);assert.match(missingJson.messages[0],/lib\/json.jsx/);assert.ok(missingJson.messages[0].includes('quoted'));assert.equal(JSON.parse(env.call('AELT_ping()')).ok,false);
});

test('failed earlier save resolves newer waiters with failure instead of hanging the editor',()=>{
 const pending=[];const ctx=context({AELT:{},cloneData:v=>JSON.parse(JSON.stringify(v)),els:{},setStatus:()=>{},showToast:()=>{},clearTimeout:()=>{},setTimeout:()=>1,callHost:(name,args,cb)=>name==='AELT_loadSettings'?cb({ok:true,settings:{}}):pending.push(cb)});run(ctx,'extension/client/js/settings.js');
 require('node:vm').runInContext('AELT.settings.load(function(){});AELT.settings.set("folder","one");AELT.settings.persist();AELT.settings.set("folder","two");AELT.settings.persist(function(result){saved=result.ok;});',ctx);pending[0]({ok:false,messages:['disk full']});assert.equal(ctx.saved,false);
});
