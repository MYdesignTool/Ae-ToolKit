// Verify resolved destinations and real navigation after in-place language changes.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{root}=require('./helpers.cjs');
const docs=path.join(root,'docs/.vitepress/dist');
const server=http.createServer((request,response)=>{
 const pathname=new URL(request.url,'http://localhost').pathname;
 if(!pathname.startsWith('/Ae-ToolKit/')){response.writeHead(404).end();return;}
 const relative=decodeURIComponent(pathname.slice('/Ae-ToolKit/'.length));
 const isDocs=relative.startsWith('docs/'),scope=isDocs?docs:root;
 const file=path.resolve(scope,(isDocs?relative.slice(5):relative)+(relative.endsWith('/')||!relative?'index.html':''));
 if(!file.startsWith(scope+path.sep)){response.writeHead(403).end();return;}
 fs.readFile(file,(error,bytes)=>{if(error){response.writeHead(404).end();return;}
  response.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream'}).end(bytes);
 });
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=process.env.SITE_URL||'http://127.0.0.1:'+server.address().port+'/Ae-ToolKit/';
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  for(const start of ['?lang=zh','en/']){
   const context=await browser.newContext({locale:'zh-CN',reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(base+start);const original=await page.locator('html').getAttribute('lang');
   await page.evaluate(()=>window.__originalDocument=true);
   async function check(){
    const links=await page.locator('[data-docs-link]').evaluateAll(elements=>elements.map(element=>element.href));
    const destinations=['docs/','docs/users/','docs/developers/','docs/developers/architecture.html','docs/'].map(relative=>new URL(relative,base).href);
    assert.deepEqual(links,destinations,'documentation destinations remain independent of the active language URL');
    for(const url of new Set(links)){const response=await page.request.get(url);assert.equal(response.status(),200,url);assert.ok((await response.text()).includes('Ae-ToolKit'),url);}
   }
   await check();
   async function toggle(){
    const previous=await page.locator('html').getAttribute('lang');
    await page.locator('[data-language-switch]').click();
    await page.waitForFunction(previous=>document.documentElement.lang!==previous&&!document.documentElement.hasAttribute('data-language-transition'),previous);
    assert.equal(await page.evaluate(()=>window.__originalDocument),true,'language switch stays in the same document');
    await check();
   }
   await toggle();
   await page.goBack();await page.waitForFunction(lang=>document.documentElement.lang===lang&&!document.documentElement.hasAttribute('data-language-transition'),original);await check();
   await page.goForward();await page.waitForFunction(lang=>document.documentElement.lang!==lang&&!document.documentElement.hasAttribute('data-language-transition'),original);await check();
   await toggle();await toggle();
   await page.locator('.nav-links [data-docs-link]').click();
   await page.waitForURL(new URL('docs/',base).href);
   await page.locator('.VPHome').waitFor();assert.equal(await page.locator('.not-found').count(),0);
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log('Documentation navigation passed: static Chinese/English entry, in-place switching both ways, back/forward, repeated switching, HTTP 200 for all five links and actual document-home navigation.');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
