const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {check}=require('./version.cjs'),{sourceFingerprint}=require('../../native/build/source-fingerprint.cjs');
const repo=path.resolve(__dirname,'../..');
function sha(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function inputs(){const meta=check(),lock=JSON.parse(fs.readFileSync(path.join(repo,'native/release-inputs.json'),'utf8').replace(/^\uFEFF/,''));
 if(lock.format!==2||Object.hasOwn(lock,'version')||lock.native.mode!=='source'||lock.native.dependencies!=='native/ci-dependencies.json')throw Error('Native builds must use the current source and reviewed SDK lock');
 const sdk=JSON.parse(fs.readFileSync(path.join(repo,lock.native.dependencies),'utf8'));
 for(const row of [sdk.adobe,sdk.webview2,lock.nsis])if(!/^[a-f0-9]{64}$/.test(row.sha256))throw Error('A pinned SHA-256 is required for every external build input');
 if(sdk.format!==1||sdk.adobe.format!=='brotli-json-headers-v1'||sdk.adobe.partCharacters!==30000||!Number.isInteger(sdk.adobe.parts)||sdk.adobe.parts<1||sdk.adobe.parts>8||!Number.isInteger(sdk.adobe.files)||sdk.adobe.files<4||sdk.adobe.files>256||!Number.isInteger(sdk.adobe.bytes)||sdk.adobe.bytes>8*1024*1024||sdk.adobe.bytes<1||sdk.toolchain.visualStudioMajor!==17||sdk.toolchain.windowsSdkVersion!=='10.0.26100.0'||sdk.webview2.url!==`https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/${sdk.webview2.version}/microsoft.web.webview2.${sdk.webview2.version}.nupkg`)throw Error('Unexpected native SDK or toolchain policy');
 if(typeof lock.nsis.releaseTag!=='string'||!/^[-\w.]+$/.test(lock.nsis.releaseTag)||typeof lock.nsis.assetName!=='string'||!/^[-\w.]+$/.test(lock.nsis.assetName))throw Error('NSIS must be delivered as a named controlled build-tool asset');
 if(lock.runtime.mode!=='evergreen-online'||lock.runtime.url!=='https://go.microsoft.com/fwlink/p/?LinkId=2124703'||!lock.nsis.url.startsWith('https://downloads.sourceforge.net/project/nsis/'))throw Error('Unexpected dependency download origin');return {...lock,version:meta.version};
}
function verifyNative(root){const lock=inputs(),info=JSON.parse(fs.readFileSync(path.join(root,'build-info.json'),'utf8').replace(/^\uFEFF/,''));
 const binary=path.join(root,'bin/AeltToolkitWebView2.aex');
 if(info.Version!==lock.version||info.DebugPort!==0||info.BuildMode!=='source'||info.SourceSha256!==sourceFingerprint()||info.BuildInputsSha256!==sha(path.join(repo,lock.native.dependencies))||!/^[a-f0-9]{40}$/.test(info.GitCommit)||info.PluginSha256.toLowerCase()!==sha(binary)||(process.env.GITHUB_ACTIONS==='true'&&info.GitCommit!==process.env.GITHUB_SHA))throw Error('AEX version, debug mode, source provenance or integrity mismatch');
 const pe=fs.readFileSync(binary);if(pe.length<256||pe.readUInt16LE(0)!==0x5a4d)throw Error('Invalid AEX PE');const offset=pe.readUInt32LE(0x3c);if(offset+26>pe.length||pe.readUInt32LE(offset)!==0x4550||pe.readUInt16LE(offset+4)!==0x8664||pe.readUInt16LE(offset+24)!==0x20b||!(pe.readUInt16LE(offset+22)&0x2000))throw Error('AEX must be an x64 PE32+ DLL');return info;
}
module.exports={inputs,verifyNative,sha};if(require.main===module){if(process.argv[2]==='native')console.log(JSON.stringify(verifyNative(process.argv[3])));else console.log(JSON.stringify(inputs()));}
