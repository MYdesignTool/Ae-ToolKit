// Private, real copies of build inputs. Never follows links or downloads on build.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../..'),base=path.join(repo,'.local-deps'),lockFile=path.join(repo,'native/dependencies.lock.json');
function fingerprint(root){
 const rows=[];let bytes=0;
 function visit(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en'))){const file=path.join(dir,item.name);if(item.isSymbolicLink())throw Error('Dependency links are not allowed: '+file);if(item.isDirectory())visit(file);else if(item.isFile()){const data=fs.readFileSync(file);bytes+=data.length;rows.push(path.relative(root,file).replaceAll('\\','/')+'\0'+crypto.createHash('sha256').update(data).digest('hex'));}}}
 visit(root);return {files:rows.length,bytes,sha256:crypto.createHash('sha256').update(rows.join('\n')).digest('hex')};
}
function verify(names){
 const lock=JSON.parse(fs.readFileSync(lockFile,'utf8').replace(/^\uFEFF/,''));for(const item of lock.components){if(names&&!names.includes(item.id))continue;const target=path.resolve(base,item.directory);if(path.dirname(target)!==base)throw Error('Dependency path escaped the workspace');const actual=fingerprint(target);if(actual.sha256!==item.sha256||actual.files!==item.files)throw Error('Local dependency changed: '+item.id);}
 return lock;
}
function freeze(plan,resume=false){
 if(fs.existsSync(lockFile))throw Error('A lock already exists; updating dependencies requires an explicit new snapshot.');
 for(const item of plan)for(const part of item.parts)if(!fs.existsSync(part.source))throw Error('Missing dependency source: '+part.source);
 fs.mkdirSync(base,{recursive:true});const components=[];
 for(const item of plan){const target=path.resolve(base,item.directory);if(path.dirname(target)!==base)throw Error('Invalid dependency directory');if(fs.existsSync(target)&&!resume)throw Error('Refused to overwrite dependency snapshot: '+target);fs.mkdirSync(target,{recursive:true});
  for(const part of item.parts){const destination=path.resolve(target,part.destination||'.');if(destination!==target&&!destination.startsWith(target+path.sep))throw Error('Invalid dependency destination');fs.mkdirSync(path.dirname(destination),{recursive:true});if(path.resolve(part.source)!==destination)fs.cpSync(part.source,destination,{recursive:true,dereference:false});}
  components.push({id:item.id,directory:item.directory,version:item.version,scope:item.scope||'private build input; excluded from product packages',...fingerprint(target)});
 }
 const lock={format:1,created:new Date().toISOString(),components};fs.writeFileSync(lockFile,JSON.stringify(lock,null,2)+'\n');return lock;
}
module.exports={fingerprint,verify,freeze,base};
if(require.main===module){const [action,arg]=process.argv.slice(2);if(action==='freeze'||action==='freeze-resume')console.log(JSON.stringify(freeze(JSON.parse(fs.readFileSync(arg,'utf8')),action==='freeze-resume'),null,2));else if(action==='verify'){verify(arg?arg.split(','):undefined);console.log('Local dependency snapshots match native/dependencies.lock.json');}else throw Error('Use freeze <explicit-plan.json> or verify [ids]');}
