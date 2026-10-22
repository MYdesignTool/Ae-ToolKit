// Validation only. No setup executable, ZIP, registry change or installation.
// Build the native candidate first with -OutputRoot .artifacts/installer-native.
const cp=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {root}=require('./helpers.cjs');
const before=fs.existsSync(path.join(root,'extension/installer/dist'))?fs.readdirSync(path.join(root,'extension/installer/dist')).sort():[];
const shell=process.env.AELT_POWERSHELL||'powershell.exe',env={...process.env};
// A test launched from pwsh must not load PowerShell 7 modules into Windows PS 5.
if(path.basename(shell).toLowerCase()==='powershell.exe')env.PSModulePath=path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/Modules');
const args=['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'extension/installer/build.ps1'),'-Platform','all'];if(process.argv[2])args.push('-CiInputsRoot',path.resolve(process.argv[2]));
const result=cp.spawnSync(shell,args,{cwd:root,env,encoding:'utf8',windowsHide:true,timeout:60000});
if(result.error)throw result.error;assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
const after=fs.existsSync(path.join(root,'extension/installer/dist'))?fs.readdirSync(path.join(root,'extension/installer/dist')).sort():[];
assert.deepEqual(after,before,'Validation must not create distribution files');
const match=result.stdout.match(/Validated separate platform payloads: ([^\r\n]+)/);assert.ok(match,'Validation must report its staging root');
const staged=match[1].trim(),windows=JSON.parse(fs.readFileSync(path.join(staged,'windows/package-manifest.json'))),mac=JSON.parse(fs.readFileSync(path.join(staged,'macos/package-manifest.json')));
assert.equal(windows.files.filter(file=>file.endsWith('.aex')).length,1);
assert.ok(!windows.files.some(file=>/\.exe$/i.test(file)),'Do not bundle the offline Runtime');
assert.ok(windows.files.includes('prerequisites/Ensure-WebView2.ps1'));
assert.ok(windows.files.includes('prerequisites/Discover-Ae.ps1'));
assert.ok(!mac.files.some(file=>/\.aex$|RuntimeInstaller|AeltInputProbe/i.test(file)));
for(const file of mac.files.filter(file=>file.startsWith('AeLocalToolkit/client/')||file.startsWith('AeLocalToolkit/host/'))){const relative=file.slice('AeLocalToolkit/'.length);assert.ok(fs.readFileSync(path.join(staged,'macos',file)).equals(fs.readFileSync(path.join(staged,'windows/AeltToolkitWebView2/extension',relative))),'Shared source bytes differ: '+relative);}
console.log(result.stdout.trim());
