const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {stage}=require('../extension/installer/package.cjs');
function fixture(run){const root=fs.mkdtempSync(path.join(os.tmpdir(),'aelt-package-'));try{run(root);}finally{const resolved=path.resolve(root);assert.equal(path.dirname(resolved),path.resolve(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('aelt-package-'));fs.rmSync(resolved,{recursive:true,force:true});}}
test('macOS payload contains a single shared CEP implementation and only clean default data',()=>fixture(root=>{
 const result=stage('macos',path.join(root,'mac'));assert.equal(result.installerGenerated,false);
 const names=result.files;assert.ok(names.includes('AeLocalToolkit/CSXS/manifest.xml'));assert.ok(names.includes('AeLocalToolkit/host/index.jsx'));
 const data=names.filter(name=>name.startsWith('AeLocalToolkit/data/'));assert.equal(data.length,4);
 assert.ok(!names.some(name=>/\.aex$|user-data|\.local-deps|AeltInputProbe|RuntimeInstaller|\.pdb$/i.test(name)));
 assert.throws(()=>stage('macos',path.join(root,'mac')),/existing contents/);
}));
test('Windows staging rejects debug candidates, changed binaries and stale native sources',()=>fixture(root=>{
 const build=path.join(root,'build');fs.mkdirSync(path.join(build,'bin'),{recursive:true});fs.writeFileSync(path.join(build,'bin/AeltToolkitWebView2.aex'),'test fixture, never distributed');
 const version=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../extension/data/changelog.json'))).version;
 const info={Version:version,DebugPort:8316,PluginSha256:crypto.createHash('sha256').update('test fixture, never distributed').digest('hex'),SourceSha256:require('../native/build/source-fingerprint.cjs').sourceFingerprint()};
 for(const [index,override] of [{},{DebugPort:0,PluginSha256:'bad'},{DebugPort:0,SourceSha256:'stale'}].entries()){fs.writeFileSync(path.join(build,'build-info.json'),JSON.stringify({...info,...override}));assert.throws(()=>stage('windows',path.join(root,'out'+index),build),/Reject debug, stale or mismatched/);}
}));
