// Shared source, separate platform payloads; never copies development data.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../..');
const defaults=['settings.default.json','organizer-rules.json','default-expressions.json','changelog.json'];
function files(root){const out=[];function walk(dir){for(const row of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,row.name);if(row.isSymbolicLink())throw Error('Package must not contain links: '+full);if(row.isDirectory())walk(full);else if(row.isFile())out.push(path.relative(root,full).replaceAll('\\','/'));}}walk(root);return out.sort();}
function stage(platform,output,nativeBuild,options={}){
 if(!['windows','macos'].includes(platform))throw Error('Choose windows or macos');
 output=path.resolve(output);if(fs.existsSync(output))throw Error('Use a new staging directory; existing contents are never merged into a release payload');
 const version=JSON.parse(fs.readFileSync(path.join(repo,'extension/data/changelog.json'),'utf8')).version;
 const product=path.join(output,platform==='windows'?'AeltToolkitWebView2':'AeLocalToolkit');
 const extension=platform==='windows'?path.join(product,'extension'):product;
 fs.mkdirSync(extension,{recursive:true});
 for(const name of ['client','host','CSXS'])fs.cpSync(path.join(repo,'extension',name),path.join(extension,name),{recursive:true,filter:file=>path.basename(file)!=='.gitkeep'});
 fs.mkdirSync(path.join(extension,'data'));for(const name of defaults)fs.copyFileSync(path.join(repo,'extension/data',name),path.join(extension,'data',name));
 for(const name of ['License.md','README.md'])fs.copyFileSync(path.join(repo,'extension',name),path.join(extension,name));
 if(platform==='windows'){
  if(!nativeBuild)throw Error('Windows requires a fresh native build with build-info.json');
  const info=JSON.parse(fs.readFileSync(path.join(nativeBuild,'build-info.json'),'utf8').replace(/^\uFEFF/,''));
  const binary=path.join(nativeBuild,'bin/AeltToolkitWebView2.aex');
  const hash=crypto.createHash('sha256').update(fs.readFileSync(binary)).digest('hex');
  const {sourceFingerprint}=require('../../native/build/source-fingerprint.cjs');
  if(info.DebugPort!==0||info.Version!==version||info.PluginSha256.toLowerCase()!==hash||info.SourceSha256!==sourceFingerprint())throw Error('Reject debug, stale or mismatched native candidate');
  fs.copyFileSync(binary,path.join(product,'AeltToolkitWebView2.aex'));
  fs.copyFileSync(path.join(repo,'extension/installer/Manage-Installation.ps1'),path.join(product,'Manage-Installation.ps1'));
  const readme=path.join(extension,'README.md');
  fs.writeFileSync(readme,'# Windows AEGP + WebView2\n\n从 AE「窗口」菜单打开 AE Local Toolkit (WebView2)。本目录位于 Support Files/Plug-ins/AeltToolkitWebView2；不复制到 CEP。个人数据在 extension/data/user-data.json；更新前备份，保留 data。浏览器缓存位于当前用户 LocalAppData/AE Local Toolkit/WebView2/profile。\n\n'+fs.readFileSync(readme,'utf8'));
  fs.writeFileSync(path.join(product,'aelt-native-install.json'),JSON.stringify({product:'org.aelocaltoolkit.webview2.toolkit',version,platform:'windows-x64'},null,2));
  fs.mkdirSync(path.join(product,'licenses'));
  for(const name of ['LICENSE','NOTICE.md'])fs.copyFileSync(path.join(repo,'native/panel-host',name),path.join(product,'licenses','panel-host-'+name));
  for(const name of ['WebView2-LICENSE.txt','WebView2-NOTICE.txt'])fs.copyFileSync(path.join(repo,'native/third-party',name),path.join(product,'licenses',name));
  let runtime=options.runtime;
  if(!runtime){const {verify,base}=require('../../native/build/dependencies.cjs');const lock=verify(['webview2-runtime-x64']);runtime=path.join(base,lock.components.find(x=>x.id==='webview2-runtime-x64').directory,'MicrosoftEdgeWebView2RuntimeInstallerX64.exe');}
  const installed=files(product).filter(name=>name!=='aelt-native-install.json'&&!name.startsWith('extension/data/')).map(name=>({path:name,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(product,name))).digest('hex')}));
  fs.writeFileSync(path.join(product,'installed-files.json'),JSON.stringify({product:'org.aelocaltoolkit.webview2.toolkit',version,files:installed,writePaths:[...files(product),'installed-files.json','uninstall.exe']},null,2));
  fs.mkdirSync(path.join(output,'prerequisites'));fs.copyFileSync(runtime,path.join(output,'prerequisites',path.basename(runtime)));
 }
 const list=files(output);
 for(const file of list){if(/(?:^|\/)(?:user-data\.json(?:\.bak)?|settings\.json|before-import\.json|last-import\.json|backups|profile|fixtures|\.local-deps|\.git)(?:\/|$)/i.test(file)||/AeltInputProbe|\.pdb$|\.lib$|\.exp$/i.test(file))throw Error('Private or development file in package: '+file);}
 if(platform==='macos'&&list.some(file=>/\.aex$|WebView2RuntimeInstaller|panel-host-/i.test(file)))throw Error('Native Windows component in macOS package');
 const manifest={platform,version,product,files:list,installerGenerated:false};fs.writeFileSync(path.join(output,'package-manifest.json'),JSON.stringify(manifest,null,2));return manifest;
}
module.exports={stage,files,defaults};
if(require.main===module){const [platform,output,nativeBuild,runtime]=process.argv.slice(2);console.log(JSON.stringify(stage(platform,output,nativeBuild,{runtime}),null,2));}
