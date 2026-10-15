// Runs a registry-free build of the actual NSIS installer inside a temporary fixture.
// Usage: node tests/installer.cjs [path-to-makensis.exe]
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto');const {root}=require('./helpers.cjs');
const compiler=process.argv[2]||'C:/Program Files (x86)/NSIS/makensis.exe';
const sandbox=path.join(root,'.artifacts','upgrade-'+crypto.randomUUID()),installed=path.join(sandbox,'installed','AeLocalToolkit'),legacy=path.join(sandbox,'legacy-user','AeLocalToolkit');
const put=(file,bytes)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);};
const run=(exe,args)=>{const result=cp.spawnSync(exe,args,{timeout:45000,encoding:'utf8',windowsHide:true});if(result.error)throw result.error;assert.equal(result.status,0,result.stdout+'\n'+result.stderr);};
const text=file=>fs.readFileSync(file,'utf8');
fs.mkdirSync(sandbox,{recursive:true});
const version=JSON.parse(text(path.join(root,'extension/data/changelog.json'))).version;
cp.execFileSync(compiler,['/DVERSION='+version,'/DTEST_ROOT='+sandbox,path.join(root,'extension/installer/aetoolkit.nsi')],{encoding:'utf8',windowsHide:true,stdio:'pipe'});
const setup=path.join(sandbox,'setup.exe'),manifest='<ExtensionManifest ExtensionBundleId="com.local.aetoolkit" />';
const oldSettings='{"compFolder":"旧合成","quietMode":true}',oldScheme='{"id":"scheme-custom","name":"旧方案","rules":[]}';
put(path.join(legacy,'CSXS/manifest.xml'),manifest);put(path.join(legacy,'data/settings.json'),oldSettings);put(path.join(legacy,'data/organizer-schemes/custom.json'),oldScheme);
const foreign=path.join(sandbox,'legacy64','AeLocalToolkit','CSXS','manifest.xml');put(foreign,'<ExtensionManifest ExtensionBundleId="someone.else" />');
run(setup,['/S']);
assert.equal(text(path.join(installed,'data/settings.json')),oldSettings);assert.equal(text(path.join(installed,'data/organizer-schemes/custom.json')),oldScheme);assert.equal(text(path.join(legacy,'data/settings.json')),oldSettings);
assert.equal(fs.existsSync(path.join(legacy,'CSXS/manifest.xml')),false);assert.ok(fs.readdirSync(path.join(legacy,'CSXS')).some(name=>name.startsWith('manifest.xml.before-')),'old copy disabled reversibly');
assert.ok(fs.existsSync(path.join(installed,'CSXS/manifest.xml')));
const aclScript = "$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value; $rights=[Security.AccessControl.FileSystemRights]::Modify; [bool]([IO.Directory]::GetAccessControl('"+path.join(installed,'data').replace(/'/g,"''")+"').Access | Where-Object { $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -eq $sid -and ($_.FileSystemRights -band $rights) -eq $rights -and -not $_.IsInherited })";
const acl=cp.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',aclScript],{encoding:'utf8',windowsHide:true});assert.equal(acl.trim(),'True','the installing user can modify portable data without elevation');
const userData=JSON.stringify({format:'ae-local-toolkit',version:1,settings:{quietMode:true,userExpressions:[{id:'user-personal',name:'Personal',code:'time % 1'}]},schemes:[{id:'scheme-personal',name:'Personal',rules:[]}]});
put(path.join(installed,'data/user-data.json'),userData);put(path.join(installed,'data/user-data.json.bak'),'previous-data');put(path.join(installed,'data/extra-local.txt'),'keep-local');put(path.join(installed,'my-scripts/Tool.jsx'),'personal-script');put(path.join(installed,'client/js/app.js'),'old-program');
put(path.join(legacy,'CSXS/manifest.xml'),manifest);put(path.join(legacy,'data/settings.json'),'{"compFolder":"obsolete"}');
run(setup,['/S']);
assert.equal(text(path.join(installed,'data/user-data.json')),userData);assert.equal(text(path.join(installed,'data/user-data.json.bak')),'previous-data');assert.equal(text(path.join(installed,'data/settings.json')),oldSettings);assert.equal(text(path.join(installed,'data/extra-local.txt')),'keep-local');assert.equal(text(path.join(installed,'my-scripts/Tool.jsx')),'personal-script');
assert.equal(text(path.join(installed,'client/js/app.js')),text(path.join(root,'extension/client/js/app.js')),'program replaced');assert.equal(text(path.join(installed,'data/settings.default.json')),text(path.join(root,'extension/data/settings.default.json')),'defaults refreshed');
const backups=fs.readdirSync(path.join(installed,'backups'));assert.ok(backups.length>=2);assert.ok(backups.some(name=>fs.existsSync(path.join(installed,'backups',name,'user-data.json'))&&text(path.join(installed,'backups',name,'user-data.json'))===userData),'persistent pre-upgrade snapshot');
// Block the backup destination to verify that an update aborts before replacing files.
const savedBackups=path.join(installed,'backups-kept'),backupsPath=path.join(installed,'backups');
assert.ok(backupsPath.startsWith(sandbox+path.sep)&&savedBackups.startsWith(sandbox+path.sep));
fs.renameSync(backupsPath,savedBackups);put(backupsPath,'blocked-directory');put(path.join(installed,'client/js/app.js'),'unchanged-on-failure');
const failed=cp.spawnSync(setup,['/S'],{timeout:15000,encoding:'utf8',windowsHide:true});if(failed.error)throw failed.error;assert.notEqual(failed.status,0,'backup failure must fail the installer');assert.equal(text(path.join(installed,'client/js/app.js')),'unchanged-on-failure');assert.equal(text(path.join(installed,'data/user-data.json')),userData);
fs.unlinkSync(backupsPath);fs.renameSync(savedBackups,backupsPath);
run(path.join(installed,'uninstall.exe'),['/S','_?='+installed]);
assert.equal(fs.existsSync(path.join(installed,'client')),false);assert.equal(fs.existsSync(path.join(installed,'host')),false);assert.equal(fs.existsSync(path.join(installed,'CSXS')),false);assert.equal(text(path.join(installed,'data/user-data.json')),userData);assert.ok(fs.existsSync(path.join(installed,'backups')));assert.equal(text(path.join(installed,'my-scripts/Tool.jsx')),'personal-script');assert.ok(fs.existsSync(foreign),'unrelated extension left intact');
console.log('Installer passed: old-copy migration, reversible manifest disable, direct update, byte-for-byte user data retention, persistent backup, program replacement, backup-failure abort, uninstall data retention. Registry-free sandbox: '+sandbox);
