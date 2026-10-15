// Public-page visual and interaction checks, plus privacy-safe panel screenshots for the site.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright'),{root}=require('./helpers.cjs'),{bridge,data}=require('./motion.cjs');
const out=process.env.ARTIFACT_DIR||path.join(root,'.artifacts','release-site');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;const file=path.resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));if(file!==path.join(root,'index.html')&&!file.startsWith(path.join(root,'assets')+path.sep)){res.writeHead(404).end();return;}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':({'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream'}).end(b);});});
async function main(){
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
 if(process.argv.includes('--update-previews')){
  const fixture=JSON.parse(JSON.stringify(data)),names=['关键帧缓动','图层批量重命名','锚点对齐','路径描边动画','合成尺寸调整','文本分行','颜色随机化','运动拖尾','自动排列图层','表达式工具','时间偏移','图层镜像','素材定位','循环动画'];
  fixture.scan={ok:true,messages:[],scripts:[]};fixture.settings.scriptFolder="C:/Example/Scripts";fixture.scan.scripts=names.map((name,i)=>({name,relativePath:'Tool-'+i+'.jsx',fsName:'C:/Example/Scripts/Tool-'+i+'.jsx',iconPath:''}));fixture.settings.scriptFavorites=[fixture.scan.scripts[0].fsName,fixture.scan.scripts[3].fsName];
  const panel=await browser.newPage({viewport:{width:626,height:870},reducedMotion:'reduce'});await panel.addInitScript(bridge,fixture);await panel.addInitScript(()=>{let n=0;Math.random=()=>++n%2?.2:.8;window.AELT_getSelectedPropertySummary=()=>({ok:true,total:3,supported:3,existing:0,names:['标题 / 位置','图形 / 旋转','图形 / 缩放'],comp:'演示合成',selectionKey:'demo'});});
  await panel.goto(pathToFileURL(path.join(root,'extension/client/index.html')).href);await panel.waitForFunction(()=>AELT.state.ready&&AELT.state.scripts.length);
  for(const [tab,name] of [['organizer','feature-organizer'],['expressions','feature-expression'],['scripts','feature-script']]){
   await panel.locator('[data-view='+tab+']').click();if(tab==='expressions')await panel.locator('.expression-select').selectOption('wiggle-basic');
   await panel.waitForFunction(()=>[...document.images].filter(i=>i.getBoundingClientRect().top<innerHeight&&i.getBoundingClientRect().bottom>0).every(i=>i.complete&&i.naturalWidth>0));await panel.mouse.move(2,2);await panel.screenshot({path:path.join(root,'assets/img',name+'.png')});
  }await panel.close();
 }
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('https://api.github.com/**',r=>r.fulfill({json:{tag_name:'v0.2.6'}}));await page.goto(base);await page.waitForFunction(()=>document.querySelector('#particle-logo').dataset.renderer);
 assert.equal(await page.locator('#app-version').textContent(),'v0.3.1','an older GitHub release cannot downgrade the bundled version');
 async function fit(){const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,nodes:[...document.querySelectorAll('body *')].map(el=>({tag:el.tagName,id:el.id,cls:el.className,right:el.getBoundingClientRect().right})).filter(el=>el.right>innerWidth+1).slice(0,12)}));assert.ok(overflow.scroll<=overflow.width,JSON.stringify(overflow));}
 for(const theme of ['light','dark']){
  if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#theme-toggle').click();await page.evaluate(()=>scrollTo(0,0));await fit();await page.mouse.move(1,1);await page.screenshot({path:path.join(out,'hero-'+theme+'.png')});await page.screenshot({path:path.join(out,'page-'+theme+'.png'),fullPage:true});
  await page.locator('#features').scrollIntoViewIfNeeded();await page.waitForFunction(()=>[...document.querySelectorAll('.feature-card img')].every(i=>i.complete&&i.naturalWidth>0));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:path.join(out,'features-'+theme+'.png')});await page.locator('.feature-card .preview-button').first().click();assert.equal(await page.locator('#image-preview').isVisible(),true);await page.keyboard.press('Escape');
 }
 await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark','theme persists');
 await page.locator('.code-tab[data-key=launcher]').click();assert.ok((await page.locator('#code-view').textContent()).includes('scanScripts'));
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(Error('denied'))}}));await page.locator('#code-copy').click();await page.waitForFunction(()=>document.getElementById('code-copy').textContent.includes('失败'));
 for(const width of [390,768]){
  await page.setViewportSize({width,height:844});await page.evaluate(()=>scrollTo(0,0));await fit();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:path.join(out,'mobile-'+width+'.png')});
  await page.locator('#mobile-toggle').click();assert.equal(await page.locator('#mobile-toggle').getAttribute('aria-expanded'),'true');await page.keyboard.press('Escape');assert.equal(await page.locator('#mobile-toggle').getAttribute('aria-expanded'),'false');
  await page.locator('#mobile-toggle').click();await page.locator('.nav-links a[href="#updates"]').click();assert.equal(await page.locator('#mobile-toggle').getAttribute('aria-expanded'),'false');
  for(const id of ['features','updates','code','install']){await page.locator('#'+id).scrollIntoViewIfNeeded();await fit();}
 }
 await page.setViewportSize({width:1440,height:1000});await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('#hero').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'hero-normal-motion.png')});
 assert.ok(await page.evaluate(()=>[...document.querySelectorAll('a[href]')].every(a=>!/^javascript:/i.test(a.getAttribute('href')))));
 assert.deepEqual(errors,[]);console.log('Site passed: current panel previews, both themes, remembered theme, desktop/mobile layout, image dialogs, copy failure, menu/anchors, offline version and normal/reduced motion.');await context.close();
 }finally{await browser.close();server.close();}
}
if(require.main===module)main().catch(e=>{console.error(e);server.close();process.exitCode=1;});
module.exports={server};
