// Use the runner's standard Python zipfile module to inspect every archived file.
const cp=require('node:child_process'),path=require('node:path');
const script=`import sys,zipfile,json,hashlib,pathlib
root=pathlib.Path(sys.argv[2]); expected=json.loads((root/'package-manifest.json').read_text(encoding='utf-8'))['files']
with zipfile.ZipFile(sys.argv[1]) as z:
 names=[i.filename for i in z.infolist() if not i.is_dir()]
 if sorted(names)!=sorted(expected) or len(names)!=len(set(names)): raise RuntimeError('ZIP payload does not match the CEP whitelist')
 for name in names:
  if z.read(name)!=(root/name).read_bytes(): raise RuntimeError('ZIP bytes mismatch: '+name)
 if z.testzip(): raise RuntimeError('ZIP CRC failed')
print('CEP ZIP contents and bytes verified')`;
const result=cp.spawnSync(process.env.PYTHON||'python3',['-c',script,path.resolve(process.argv[2]),path.resolve('.artifacts/macos-stage')],{encoding:'utf8',windowsHide:true});if(result.error)throw result.error;if(result.status)throw Error(result.stderr);console.log(result.stdout.trim());
