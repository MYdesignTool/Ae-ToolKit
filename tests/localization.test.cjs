const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {renderEnglish}=require('../scripts/localize-site.cjs');
const {renderPage,selectRelease}=require('../scripts/sync-release.cjs');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'index.html'),'utf8');
const language=fs.readFileSync(path.join(root,'assets/js/language.js'),'utf8');
const changelog=JSON.parse(fs.readFileSync(path.join(root,'extension/data/changelog.json'),'utf8'));
function route({lang='zh-CN',browser='en-US',saved=null,query='',hash='',blocked=false}={}) {
  const values=new Map(saved===null?[]:[['site-language',saved]]),listeners={},linkListeners={};let redirect;
  const localStorage={getItem(key){if(blocked)throw Error('blocked');return values.get(key)||null;},setItem(key,value){if(blocked)throw Error('blocked');values.set(key,value);}};
  const href='https://example.test/Ae-ToolKit/'+(lang==='en'?'en/':'')+query+hash;
  const link={addEventListener(name,fn){linkListeners[name]=fn;}};
  const document={documentElement:{lang},currentScript:{src:'https://example.test/Ae-ToolKit/assets/js/language.js?v=lang1'},addEventListener(name,fn){listeners[name]=fn;},querySelector(){return link;},querySelectorAll(){return [];}};
  vm.runInNewContext(language,{document,URL,navigator:{language:browser},localStorage,location:{href,search:query,hash,replace(target){redirect=target;}}});
  listeners.DOMContentLoaded?.();
  return {redirect,values,link,switchLanguage(){linkListeners.click();}};
}
test('first visits use Chinese for Chinese browsers and English for every other browser',()=>{
 for(const browser of ['zh','zh-CN','zh-TW','zh-HK','ZH-Hans'])assert.equal(route({browser}).redirect,undefined);
 for(const browser of ['en-US','ja-JP','fr-FR','ko-KR','de-DE',''])assert.equal(route({browser}).redirect,'https://example.test/Ae-ToolKit/en/');
});
test('saved and explicit language choices override detection without losing URL state',()=>{
 assert.equal(route({browser:'ja-JP',saved:'zh'}).redirect,undefined);
 assert.equal(route({browser:'zh-CN',saved:'en'}).redirect,'https://example.test/Ae-ToolKit/en/');
 assert.equal(route({browser:'zh-CN',saved:'junk'}).redirect,undefined);
 const explicit=route({saved:'en',query:'?v=0.3.1&lang=zh',hash:'#install'});assert.equal(explicit.redirect,undefined);assert.equal(explicit.values.get('site-language'),'zh');
 const english=route({lang:'en',browser:'zh-CN',saved:'zh',query:'?v=0.3.1',hash:'#updates'});assert.equal(english.redirect,undefined,'an English URL stays English');assert.equal(english.link.href,'https://example.test/Ae-ToolKit/?v=0.3.1&lang=zh#updates');english.switchLanguage();assert.equal(english.values.get('site-language'),'zh');
 assert.equal(route({lang:'en',query:'?lang=zh'}).redirect,'https://example.test/Ae-ToolKit/?lang=zh');
 assert.equal(route({browser:'fr-FR',query:'?v=0.3.1&ui=test',hash:'#install'}).redirect,'https://example.test/Ae-ToolKit/en/?v=0.3.1&ui=test#install');
});
test('language negotiation and switching work when local storage is unavailable',()=>{
 assert.equal(route({blocked:true,browser:'fr-FR'}).redirect,'https://example.test/Ae-ToolKit/en/');
 const chinese=route({blocked:true,browser:'zh-CN'});assert.ok(chinese.link.href.endsWith('/en/?lang=en'));assert.doesNotThrow(()=>chinese.switchLanguage());
});
test('English generation keeps every release field and all section structure in sync',()=>{
 const rendered=renderEnglish(source);assert.equal(fs.readFileSync(path.join(root,'en/index.html'),'utf8').replace(/\r\n?/g,'\n'),rendered);
 assert.ok(rendered.includes('<html lang="en"'));assert.ok(rendered.includes('data-language-switch href="../?lang=zh"'));
 assert.equal((rendered.match(/<section\b/g)||[]).length,(source.match(/<section\b/g)||[]).length);
 assert.equal((rendered.match(/<article\b/g)||[]).length,(source.match(/<article\b/g)||[]).length);
 assert.equal((rendered.match(/data-release-link/g)||[]).length,4);
 const pageVersion=source.match(/data-release-field="version">([^<]+)/)[1];
 assert.ok(changelog.entries.some(entry=>entry.version===pageVersion),'published page version is retained in history');
 assert.ok(rendered.includes('Download '+pageVersion));
 assert.ok(renderEnglish(renderPage(source,selectRelease(changelog))).includes('Download '+changelog.version),'the development version can also be generated without publishing');
 assert.ok(rendered.includes('href="../assets/css/style.css?v=lang-motion2"'));
 assert.ok(rendered.includes('src="../assets/js/visuals.js?v=particles-half1"'));
 assert.ok(rendered.includes('Window → Extensions → AE Local Toolkit'));
 const future={version:'9.8.7',entries:[{version:'9.8.7',date:'2030-01-02',changes:['New release'],highlights:[{title:'New version',description:'New content'}]}]};
 const english=renderEnglish(renderPage(source,selectRelease(future)));assert.ok(english.includes('Download 9.8.7'));assert.ok(english.includes('v9.8.7'));assert.ok(!english.includes('v0.3.1'));assert.ok(english.includes('New content'));
});
test('missing translations fail explicitly and translated text is HTML escaped',()=>{
 assert.throws(()=>renderEnglish('<p>新的未翻译内容</p>'),/Missing English translations/);
 assert.ok(renderEnglish('<p>中文</p>',{strings:{'中文':'<img onerror="unsafe()"> & text'}}).includes('&lt;img onerror=&quot;unsafe()&quot;&gt; &amp; text'));
});

test('Windows CRLF checkout renders the same multilingual page as LF checkout',()=>{
 const lf=source.replace(/\r\n?/g,'\n');
 assert.equal(renderEnglish(lf.replace(/\n/g,'\r\n')),renderEnglish(lf));
});
