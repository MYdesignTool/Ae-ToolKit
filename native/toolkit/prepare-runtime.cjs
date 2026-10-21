const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../..');
function rebaseSettings(settings,source){
  const resolve=value=>typeof value==='string'&&value.startsWith('./')?path.resolve(source,value.slice(2)):value;
  if(settings.scriptFolder)settings.scriptFolder=resolve(settings.scriptFolder);
  if(Array.isArray(settings.scriptFavorites))settings.scriptFavorites=settings.scriptFavorites.map(resolve);
  return settings;
}
function prepare(output,seedRoot){
  const root=path.join(output,'extension');fs.mkdirSync(root,{recursive:true});
  for(const directory of ['client','host','CSXS'])fs.cpSync(path.join(repo,'extension',directory),path.join(root,directory),{recursive:true});
  const data=path.join(root,'data');fs.mkdirSync(data,{recursive:true});
  for(const name of ['settings.default.json','organizer-rules.json','default-expressions.json','changelog.json'])fs.copyFileSync(path.join(repo,'extension/data',name),path.join(data,name));
  const target=path.join(data,'user-data.json');let seeded=false;
  if(seedRoot&&!fs.existsSync(target)){
    seedRoot=path.resolve(seedRoot);const sourceData=path.join(seedRoot,'data');
    const sourceFile=[path.join(sourceData,'user-data.json'),path.join(sourceData,'user-data.json.bak')].find(file=>fs.existsSync(file));
    if(sourceFile){
      const text=fs.readFileSync(sourceFile,'utf8'),document=JSON.parse(text.replace(/^\uFEFF/,''));
      if(document.format!=='ae-local-toolkit'||document.version!==1||!document.settings||!Array.isArray(document.schemes))throw Error('CEP data format is invalid; source was not modified');
      rebaseSettings(document.settings,seedRoot);fs.writeFileSync(target,JSON.stringify(document,null,2));seeded=true;
      fs.writeFileSync(path.join(path.dirname(output),'cep-seed.json'),JSON.stringify({source:sourceFile,sha256:crypto.createHash('sha256').update(text).digest('hex'),time:new Date().toISOString(),originalModified:false},null,2));
    }else{
      const old=path.join(sourceData,'settings.json');if(fs.existsSync(old)){const settings=JSON.parse(fs.readFileSync(old,'utf8').replace(/^\uFEFF/,''));fs.writeFileSync(path.join(data,'settings.json'),JSON.stringify(rebaseSettings(settings,seedRoot)));seeded=true;}
      const schemes=path.join(sourceData,'organizer-schemes');if(fs.existsSync(schemes))fs.cpSync(schemes,path.join(data,'organizer-schemes'),{recursive:true});
    }
  }
  return {root,seeded};
}
module.exports={prepare,rebaseSettings};
if(require.main===module){const [output,seed]=process.argv.slice(2);if(!output)throw Error('Output directory required');console.log(JSON.stringify(prepare(path.resolve(output),seed)));}
