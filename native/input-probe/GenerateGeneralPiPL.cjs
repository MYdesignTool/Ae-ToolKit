// Limited encoder for this probe's five-property Windows General AEGP resource.
// Uses the PIProperty/PIPropertyList layout documented by the external SDK's
// SPPiPL.h and Windows PiPL version prefix. Not a general Adobe PiPL converter.
const fs=require('node:fs'),path=require('node:path');
function encode(source){
  const match=/^\s*resource\s+'PiPL'\s*\(\s*(\d+)\s*\)\s*\{\s*\{\s*Kind\s*\{\s*AEGP\s*\}\s*,\s*Name\s*\{\s*"([\x20-\x21\x23-\x5b\x5d-\x7e]+)"\s*\}\s*,\s*Category\s*\{\s*"([\x20-\x21\x23-\x5b\x5d-\x7e]+)"\s*\}\s*,\s*Version\s*\{\s*(\d+)\s*\}\s*,\s*CodeWin64X86\s*\{\s*"([A-Za-z_][A-Za-z_0-9]*)"\s*\}\s*,?\s*\}\s*\}\s*;\s*$/.exec(source);
  if(!match)throw Error('Only the exact five-property General AEGP declaration is supported');
  const [,id,name,category,version,entry]=match;
  if(+id<1||+id>65535||name.length>255||category.length>255||+version>0xffffffff)throw Error('PiPL field out of range');
  const u32=value=>{const out=Buffer.alloc(4);out.writeUInt32LE(value);return out;};
  const pad=value=>{const out=Buffer.alloc(Math.ceil(value.length/4)*4);value.copy(out);return out;};
  const pascal=value=>pad(Buffer.concat([Buffer.from([value.length]),Buffer.from(value,'ascii')]));
  const property=(key,data)=>Buffer.concat([Buffer.from('MIB8','ascii'),Buffer.from(key.split('').reverse().join(''),'ascii'),u32(0),u32(data.length),data]);
  const properties=[property('kind',Buffer.from('xgEA','ascii')),property('name',pascal(name)),property('catg',pascal(category)),property('vers',u32(+version)),property('8664',pad(Buffer.from(entry+'\0','ascii')))];
  return {id:+id,name,category,version:+version,entry,bytes:Buffer.concat([Buffer.from([1,0]),u32(0),u32(properties.length),...properties])};
}
module.exports=encode;
if(require.main===module){
  const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('Usage: GenerateGeneralPiPL.cjs preprocessed.rr output-directory');
  const result=encode(fs.readFileSync(input,'utf8'));fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,'ProbePiPL.bin'),result.bytes);
  fs.writeFileSync(path.join(output,'ProbePiPL.rc'),result.id+' PiPL DISCARDABLE "'+path.join(output,'ProbePiPL.bin').replaceAll('\\','\\\\')+'"\n');
  console.log('Encoded General AEGP PiPL: '+result.name+', entry '+result.entry);
}
