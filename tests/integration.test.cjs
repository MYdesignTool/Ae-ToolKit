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
test('launcher accepts uppercase extensions, nested matching images and literal percent paths',()=>{
 const env=storage();env.folders.add('/scripts');env.folders.add('/scripts/Sub');env.folders.add('/scripts/(ignore)');
 env.files.set('/scripts/Sub/Tool.JSX','');env.files.set('/scripts/Sub/Tool.jpg','image');env.files.set('/scripts/percent%20.jsx','');env.files.set('/scripts/(ignore)/hidden.jsx','');
 const launched=[];env.context.$={evalFile:file=>launched.push(file.fsName)};run(env.context,'extension/host/modules/launcher.jsx');
 const result=env.call('AELocalToolkit.launcher.scanScripts("/scripts")');assert.equal(result.ok,true);assert.equal(result.scripts.length,2);assert.ok(result.scripts.find(s=>s.name==='Tool').iconPath.endsWith('/Sub/Tool.jpg'));
 assert.equal(env.call('AELocalToolkit.launcher.launchScript("/scripts/percent%20.jsx").ok'),true);assert.equal(launched[0],'/scripts/percent%20.jsx');assert.equal(env.call('AELocalToolkit.launcher.launchScript("/unscanned.jsx").ok'),false);
});
test('old folder-format schemes are migrated only at the storage boundary',()=>{
 const env=storage();env.files.set('/extension/data/organizer-schemes/old.json','{"id":"scheme-v1","name":"v1","folders":[{"name":"Images","extensions":["PNG"]}]}');
 const result=env.call('AELocalToolkit.storage.listSchemes()');assert.equal(result.length,2);assert.equal(result[1].rules[0].path,'Images');
});
test('the actual host bootstrap loads exactly one ordered copy of each module',()=>{
 const env=storage();env.files.set('/extension/CSXS/manifest.xml','manifest');for(const file of ['default-expressions.json','changelog.json'])env.files.set('/extension/data/'+file,source('extension/data/'+file));
 const modules=['lib/json.jsx','modules/storage.jsx','modules/organizer.jsx','modules/expressions.jsx','modules/launcher.jsx'];for(const file of modules)env.files.set('/extension/host/'+file,'module');
 let loads=0;env.context.$={evalFile:file=>{loads++;run(env.context,file.fullName.replace('/extension/','extension/'));}};env.context.app={version:'23.0'};run(env.context,'extension/host/index.jsx');
 assert.equal(JSON.parse(env.call('AELT_setModuleBase("/extension")')).ok,true);assert.equal(loads,5);assert.equal(JSON.parse(env.call('AELT_bootstrap()')).expressions.length,2);assert.equal(JSON.parse(env.call('AELT_setModuleBase("/extension")')).ok,true);assert.equal(loads,5);
 env.context.AELocalToolkit.ready=false;env.context.$.evalFile=()=>{};assert.equal(JSON.parse(env.call('AELT_setModuleBase("/extension")')).ok,false);assert.equal(env.context.AELocalToolkit.ready,false);
});
test('failed earlier save resolves newer waiters with failure instead of hanging the editor',()=>{
 const pending=[];const ctx=context({AELT:{},cloneData:v=>JSON.parse(JSON.stringify(v)),els:{},setStatus:()=>{},showToast:()=>{},clearTimeout:()=>{},setTimeout:()=>1,callHost:(name,args,cb)=>name==='AELT_loadSettings'?cb({ok:true,settings:{}}):pending.push(cb)});run(ctx,'extension/client/js/settings.js');
 require('node:vm').runInContext('AELT.settings.load(function(){});AELT.settings.set("folder","one");AELT.settings.persist();AELT.settings.set("folder","two");AELT.settings.persist(function(result){saved=result.ok;});',ctx);pending[0]({ok:false,messages:['disk full']});assert.equal(ctx.saved,false);
});
