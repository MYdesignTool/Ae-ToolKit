// Publish only a verified complete set. Failed uploads remain a draft.
const fs=require('node:fs'),path=require('node:path');const {check}=require('./version.cjs'),{checksum}=require('./checksums.cjs'),{sha}=require('./verify-inputs.cjs');
async function publish(root,env=process.env){
 const meta=check(env.RELEASE_TAG),names=[...checksum(root,true),'SHA256SUMS.txt'];
 if(!/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY)||!env.GH_TOKEN||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA))throw Error('Missing trusted GitHub release context');
 const marker=`<!-- aelt-release:${meta.tag}:${env.GITHUB_SHA} -->`,headers={Authorization:'Bearer '+env.GH_TOKEN,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'};
 async function api(uri,options={}){const response=await fetch('https://api.github.com'+uri,{...options,headers:{...headers,...options.headers}});if(response.status===404)return null;if(!response.ok)throw Error('GitHub release API failed: '+response.status+' '+await response.text());return response.status===204?{}:response.json();}
 const base='/repos/'+env.GITHUB_REPOSITORY;
 let ref=(await api(base+'/git/ref/tags/'+encodeURIComponent(meta.tag)))?.object;
 for(let depth=0;ref?.type==='tag'&&depth<5;depth++)ref=(await api(base+'/git/tags/'+ref.sha))?.object;
 if(ref?.type!=='commit'||ref.sha!==env.GITHUB_SHA)throw Error('Release tag moved or does not resolve to the tested commit');
 let release=await api(base+'/releases/tags/'+encodeURIComponent(meta.tag));
 if(release&&(!release.draft||!release.body?.includes(marker)))throw Error('Refusing to replace a published release or someone else’s draft');
 if(!release)release=await api(base+'/releases',{method:'POST',body:JSON.stringify({tag_name:meta.tag,target_commitish:env.GITHUB_SHA,name:'AE Local Toolkit '+meta.version,draft:true,body:fs.readFileSync(path.join(root,'release-notes.md'),'utf8')+'\n'+marker})});
 for(const name of names){const old=release.assets?.find(a=>a.name===name);if(old)await api(base+'/releases/assets/'+old.id,{method:'DELETE'});
  const response=await fetch(release.upload_url.replace(/\{.*$/,'')+'?name='+encodeURIComponent(name),{method:'POST',headers:{...headers,'Content-Type':'application/octet-stream'},body:fs.readFileSync(path.join(root,name))});if(!response.ok)throw Error('Upload failed; release remains draft: '+name);
  const asset=await response.json();let uploadedHash=asset.digest;
  if(!uploadedHash){const downloaded=await fetch('https://api.github.com'+base+'/releases/assets/'+asset.id,{headers:{...headers,Accept:'application/octet-stream'}});if(!downloaded.ok)throw Error('Cannot verify uploaded draft asset');uploadedHash='sha256:'+require('node:crypto').createHash('sha256').update(Buffer.from(await downloaded.arrayBuffer())).digest('hex');}
  if(uploadedHash!=='sha256:'+sha(path.join(root,name)))throw Error('Uploaded asset integrity mismatch; draft retained: '+name);
 }
 release=await api(base+'/releases/'+release.id);if(release.assets.length!==names.length||names.some(n=>!release.assets.find(a=>a.name===n)))throw Error('Release asset set is incomplete or contains extra files');
 await api(base+'/releases/'+release.id,{method:'PATCH',body:JSON.stringify({draft:false,prerelease:false,make_latest:'true'})});
 if(env.GITHUB_OUTPUT)fs.appendFileSync(env.GITHUB_OUTPUT,'published=true\n');console.log('Published complete verified release '+meta.tag);
}
module.exports={publish};if(require.main===module)publish(path.resolve(process.argv[2])).catch(e=>{console.error(e.message);process.exitCode=1;});
