// Inspect tracked publication inputs without printing possible secret values.
const fs=require('node:fs'),cp=require('node:child_process');
const files=cp.execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const privatePath=/(?:^|\/)(?:\.artifacts|\.local-deps|\.local-notes|node_modules)(?:\/|$)|(?:^|\/)(?:\.env(?:\..*)?|credentials\.json|secrets\.json)$|\.(?:log|trace|dmp|pem|key|pfx|p12)$|^docs\/(?:development-.*|audit|artwork|webview2-migration-assessment)\.md$|^extension\/docs\/ime-compatibility\.md$/i;
const patterns=[['OpenAI-style key',/\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}/g],['GitHub token',/\b(?:gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{30,})/g],['AWS key',/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],['Google key',/\bAIza[0-9A-Za-z_-]{35}\b/g],['Slack token',/\bxox[baprs]-[A-Za-z0-9-]{20,}/g],['Private key',/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],['Literal credential',/\b(?:api[_-]?key|client[_-]?secret|access[_-]?token|auth[_-]?token|password)\s*[:=]\s*['"]([^'"\r\n]{16,})['"]/gi]];
let failures=0;
for(const file of files){
 if(privatePath.test(file)){console.error('Private file must not be tracked: '+file);failures++;continue;}
 if(!fs.existsSync(file))continue;
 const data=fs.readFileSync(file);if(data.includes(0))continue;const text=data.toString('utf8');
 if(text.includes('ADOBE '+'CONFIDENTIAL')){console.error(file+': private SDK content must not be tracked');failures++;}
 for(const [kind,re] of patterns){re.lastIndex=0;let match;while((match=re.exec(text))){if(kind==='Literal credential'&&/process\.env|\$env:|example|placeholder|your[_ -]|<|\$\{|apiKey\b/i.test(match[1]))continue;console.error(`${file}:${text.slice(0,match.index).split('\n').length}: possible ${kind}; value withheld`);failures++;}}
}
if(failures)process.exitCode=1;else console.log('Public-file check passed: '+files.length+' tracked files; no private records or recognized credential patterns.');
