const {test}=require('node:test');const assert=require('node:assert/strict');const {storage,run}=require('./helpers.cjs');
test('selected-root image folder takes precedence, including uppercase image extensions',()=>{
 const env=storage();for(const dir of ['/a','/a/image','/b','/b/image'])env.folders.add(dir);
 env.files.set('/a/Tool.jsx','');env.files.set('/a/Tool.png','sibling');env.files.set('/a/image/Tool.PNG','central');env.files.set('/b/Other.jsx','');env.files.set('/b/image/Other.jpg','other');
 run(env.context,'extension/host/modules/launcher.jsx');const first=env.call('AELocalToolkit.launcher.scanScripts("/a")');assert.equal(first.scripts[0].iconPath,'file:///a/image/Tool.PNG');
 const second=env.call('AELocalToolkit.launcher.scanScripts("/b")');assert.equal(second.scripts[0].iconPath,'file:///b/image/Other.jpg');
});
test('browser image URLs preserve native Chinese, drive, percent and hash characters',()=>{
 const env=storage({decodeFilePaths:true});const root='Q:/Adobe 2023/素材%20 #1';env.folders.add(root);env.folders.add(root+'/image');env.files.set(root+'/旋转%25 #2.jsxbin','');env.files.set(root+'/image/旋转%25 #2.png','image');
 run(env.context,'extension/host/modules/launcher.jsx');env.context.selectedRoot=root;const result=env.call('AELocalToolkit.launcher.scanScripts(selectedRoot)');assert.equal(result.ok,true);assert.equal(result.scripts[0].name,'旋转%25 #2');
 const url=new URL(result.scripts[0].iconPath);assert.equal(url.protocol,'file:');assert.equal(url.hash,'');assert.equal(decodeURIComponent(url.pathname),'/'+root+'/image/旋转%25 #2.png');assert.equal(result.scripts[0].iconPath.startsWith('file:///Q:/'),true);
});
test('image assets are excluded from script discovery and relative image folders disambiguate names',()=>{
 const env=storage();for(const dir of ['/scripts','/scripts/Sub','/scripts/image','/scripts/image/Sub'])env.folders.add(dir);
 env.files.set('/scripts/Tool.jsx','');env.files.set('/scripts/Sub/Tool.jsx','');env.files.set('/scripts/image/Tool.png','flat');env.files.set('/scripts/image/Sub/Tool.png','nested');env.files.set('/scripts/image/not-a-tool.jsx','');
 run(env.context,'extension/host/modules/launcher.jsx');const result=env.call('AELocalToolkit.launcher.scanScripts("/scripts")');assert.equal(result.scripts.length,2);assert.equal(result.scripts.find(s=>s.relativePath==='Sub/Tool.jsx').iconPath,'file:///scripts/image/Sub/Tool.png');
});
