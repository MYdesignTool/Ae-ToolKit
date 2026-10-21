const fs=require('node:fs'),path=require('node:path');
const repo=path.resolve(__dirname,'../..');
function metadata(){
 const data=JSON.parse(fs.readFileSync(path.join(repo,'extension/data/changelog.json'),'utf8'));
 if(!/^\d+\.\d+\.\d+$/.test(data.version)||data.entries[0]?.version!==data.version)throw Error('Changelog current version and newest entry differ');
 if(data.version.split('.').some(n=>Number(n)>65535))throw Error('Version exceeds Windows resource limits');
 return {version:data.version,tag:'v'+data.version,entry:data.entries[0]};
}
function check(tag){
 const meta=metadata(),read=file=>fs.readFileSync(path.join(repo,file),'utf8');
 const xml=read('extension/CSXS/manifest.xml'),html=read('extension/client/index.html');
 const versions=[xml.match(/ExtensionBundleVersion="([^"]+)"/)?.[1],xml.match(/<Extension Id="com\.local\.aetoolkit\.panel" Version="([^"]+)"/)?.[1],html.match(/id="versionLabel"[^>]*>([^<]+)</)?.[1],read('README.md').match(/当前版本 \*\*([^*]+)\*\*/)?.[1],read('extension/README.md').match(/版本 (\d+\.\d+\.\d+)。/)?.[1]];
 if(versions.some(v=>v!==meta.version))throw Error('Manifest, panel or README version differs from changelog: '+JSON.stringify(versions));
 if(tag&&tag!==meta.tag)throw Error('Release tag must exactly match '+meta.tag);
 if(!Array.isArray(meta.entry.changes)||!meta.entry.changes.length||!Array.isArray(meta.entry.changesEn)||meta.entry.changesEn.length!==meta.entry.changes.length)throw Error('Current release must have matching Chinese and English notes');
 return meta;
}
function resource(){const {version}=metadata();return `1 VERSIONINFO\n FILEVERSION ${version.replaceAll('.',',')},0\n PRODUCTVERSION ${version.replaceAll('.',',')},0\n FILEOS 0x40004\n FILETYPE 0x2\nBEGIN\n BLOCK "StringFileInfo"\n BEGIN\n  BLOCK "040904b0"\n  BEGIN\n   VALUE "ProductName", "AE Local Toolkit\\0"\n   VALUE "FileDescription", "AE Local Toolkit WebView2 Panel\\0"\n   VALUE "FileVersion", "${version}.0\\0"\n   VALUE "ProductVersion", "${version}\\0"\n  END\n END\n BLOCK "VarFileInfo"\n BEGIN\n  VALUE "Translation", 0x0409, 1200\n END\nEND\n`;}
module.exports={metadata,check,resource};
if(require.main===module){const [mode,arg]=process.argv.slice(2);if(mode==='resource')fs.writeFileSync(arg,resource());else{const meta=check(arg);if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`version=${meta.version}\ntag=${meta.tag}\n`);console.log(JSON.stringify(meta));}}
