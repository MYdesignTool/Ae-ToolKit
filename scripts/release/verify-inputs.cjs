const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {check}=require('./version.cjs'),{sourceFingerprint}=require('../../native/build/source-fingerprint.cjs');
const repo=path.resolve(__dirname,'../..');
function sha(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function inputs(){const meta=check(),lock=JSON.parse(fs.readFileSync(path.join(repo,'native/release-inputs.json'),'utf8').replace(/^\uFEFF/,''));
 if(lock.format!==1||lock.version!==meta.version||lock.native.releaseTag!=='native-inputs-'+meta.tag||lock.native.assetName!==`aelt-native-${meta.tag}-windows-x64.zip`||lock.native.sourceSha256!==sourceFingerprint())throw Error('Controlled native inputs are missing or stale; prepare a reviewed native bundle for '+meta.tag);
 for(const row of [lock.native,lock.runtime,lock.nsis])if(!/^[a-f0-9]{64}$/.test(row.sha256))throw Error('A pinned SHA-256 is required for every release input');
 if(!lock.runtime.url.startsWith('https://msedge.sf.dl.delivery.mp.microsoft.com/')||!lock.nsis.url.startsWith('https://downloads.sourceforge.net/project/nsis/'))throw Error('Unexpected dependency download origin');return lock;
}
function verifyNative(root){const lock=inputs(),info=JSON.parse(fs.readFileSync(path.join(root,'build-info.json'),'utf8').replace(/^\uFEFF/,''));
 if(info.Version!==lock.version||info.DebugPort!==0||info.SourceSha256!==lock.native.sourceSha256||info.PluginSha256.toLowerCase()!==sha(path.join(root,'bin/AeltToolkitWebView2.aex')))throw Error('AEX version, debug mode, source fingerprint or integrity mismatch');return info;
}
module.exports={inputs,verifyNative,sha};if(require.main===module){if(process.argv[2]==='native')console.log(JSON.stringify(verifyNative(process.argv[3])));else console.log(JSON.stringify(inputs()));}
