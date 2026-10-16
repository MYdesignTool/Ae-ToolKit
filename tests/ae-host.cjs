// Explicit real-AE smoke check. Runs a separate instance and touches only its fixture.
// Usage: node tests/ae-host.cjs "D:/.../Support Files/AfterFX.exe" [extension-payload-root]
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {root}=require('./helpers.cjs');
(async()=>{
 const ae=process.argv[2];if(!ae||!fs.existsSync(ae))throw Error('Pass the full AfterFX.exe path explicitly');
 const payload=path.resolve(process.argv[3]||path.join(root,'extension'));
 const out=path.join(root,'.artifacts','ae-host-'+crypto.randomUUID());fs.mkdirSync(out,{recursive:true});
 const roots=['plain','Program Files (x86)','中文 #100%'].map(name=>{const target=path.join(out,name,'AeLocalToolkit');for(const part of ['host','CSXS','data'])fs.cpSync(path.join(payload,part),path.join(target,part),{recursive:true});return target.replace(/\\/g,'/');});
 const report=path.join(out,'result.txt'),script=path.join(out,'run.jsx');
 const jsx=`(function(){var output=new File(${JSON.stringify(report.replace(/\\/g,'/'))});output.encoding='UTF-8';output.open('w');
 try{output.writeln('AE='+app.version);var roots=${JSON.stringify(roots)};
 for(var i=0;i<roots.length;i++){try{var entry=new File(roots[i]+'/host/index.jsx');entry.encoding='UTF-8';entry.open('r');var code=entry.read();entry.close();eval(code);
 var loaded=AELT_setModuleBase(roots[i]);output.writeln('ROOT='+roots[i]);output.writeln('LOAD='+loaded);
 if(!AELocalToolkit.ready)continue;var boot=AELocalToolkit.json.parse(AELT_bootstrap());output.writeln('BOOT='+(boot.ok?'OK':'FAIL'));
 output.writeln('EXPR='+boot.expressions.length);
 }catch(e){output.writeln('ERROR='+String(e)+' line='+e.line);}}
 }catch(e){output.writeln('ERROR='+String(e));}finally{output.writeln('DONE');output.close();app.quit();}})();`;
 fs.writeFileSync(script,'\uFEFF'+jsx);
 const stdout=fs.openSync(path.join(out,'stdout.txt'),'w'),stderr=fs.openSync(path.join(out,'stderr.txt'),'w');
 const child=cp.spawn(ae,['-m','-r',script],{cwd:out,windowsHide:true,stdio:['ignore',stdout,stderr]});fs.closeSync(stdout);fs.closeSync(stderr);child.unref();let launchError;child.on('error',e=>{launchError=e;});
 let text='',finished=false;const start=Date.now();while(Date.now()-start<55000){if(launchError)throw launchError;if(fs.existsSync(report)){text=fs.readFileSync(report,'utf8');if(text.trimEnd().endsWith('DONE')){finished=true;break;}}await new Promise(r=>setTimeout(r,200));}
 assert.ok(finished,'AE did not complete the smoke check; inspect '+out);
 assert.equal((text.match(/"ok":true/g)||[]).length,3,text);assert.equal((text.match(/BOOT=OK/g)||[]).length,3,text);assert.ok(!text.includes('ERROR='),text);
 console.log(text.split(/\r?\n/)[0]+' passed: real Host module loading and defaults in ASCII, spaces/parentheses, and Chinese/percent paths. Report: '+report);
})().catch(e=>{console.error(e);process.exitCode=1;});
