const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function sourceFingerprint(){
 const repo=path.resolve(__dirname,'../..'),parts=[];
 for(const directory of ['native/panel-host','native/toolkit'])for(const name of fs.readdirSync(path.join(repo,directory)).sort())if(/\.(cpp|hpp|r)$/.test(name)){const file=directory+'/'+name;parts.push(file+'\0'+crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,file))).digest('hex'));}
 return crypto.createHash('sha256').update(parts.join('\n')).digest('hex');
}
module.exports={sourceFingerprint};if(require.main===module)console.log(sourceFingerprint());
