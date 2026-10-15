// Usage: node tests/local-images.cjs <script-directory>. No local directory is stored in source.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const {fileURLToPath,pathToFileURL}=require('node:url');const {chromium}=require('playwright');const {root,source}=require('./helpers.cjs');const {scanDirectory}=require('./filesystem-host.cjs');
async function main(){
 const directory=process.argv[2];if(!directory)throw Error('Pass a script directory as the first argument.');const result=scanDirectory(directory);assert.equal(result.ok,true,result.messages.join(' '));
 const matching=result.scripts.filter(script=>script.iconPath);for(const script of matching)assert.ok(fs.existsSync(fileURLToPath(script.iconPath)),'image URL resolves to disk: '+script.name);
 const data={rules:JSON.parse(source('extension/data/organizer-rules.json')),expressions:JSON.parse(source('extension/data/default-expressions.json')).expressions,changelog:JSON.parse(source('extension/data/changelog.json')),directory:path.resolve(directory),scan:result};
 const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:626,height:870},reducedMotion:'reduce'});const errors=[];page.on('pageerror',error=>errors.push(String(error)));
 await page.addInitScript(data=>{
   const settings={scriptFolder:data.directory,scriptFavorites:[],userExpressions:[]};
   const api={AELT_setModuleBase:()=>({ok:true}),AELT_loadSettings:()=>({ok:true,settings}),AELT_saveSettings:()=>({ok:true}),AELT_bootstrap:()=>({ok:true,...data}),AELT_loadOrganizerSchemes:()=>({ok:true,schemes:[data.rules]}),AELT_scanScripts:()=>data.scan,AELT_getSelectedPropertySummary:()=>({ok:false,messages:['未连接宿主，仅验证图片']})};
   Object.assign(window,api);window.__adobe_cep__={evalScript(script,callback){setTimeout(()=>callback(JSON.stringify((0,eval)(script))),0);}};
 },data);
 await page.goto(pathToFileURL(path.join(root,'extension/client/index.html')).href);await page.waitForFunction(()=>AELT.state.ready&&AELT.state.scripts.length>0);await page.locator('[data-view=scripts]').click();
 // Eagerly resolve every row's image so the result is not limited to the first viewport.
 await page.locator('.script-icon-img').evaluateAll(images=>images.forEach(image=>image.loading='eager'));
 await page.waitForFunction(()=>[...document.querySelectorAll('.script-icon-img')].every(image=>image.complete&&image.naturalWidth>0));
 const loaded=await page.evaluate(()=>[...document.querySelectorAll('.script-icon-img')].filter(image=>!image.dataset.fallback&&!image.src.endsWith('/placeholder.png')).length);assert.equal(loaded,matching.length);assert.equal(await page.locator('.script-folder').count(),0);assert.deepEqual(errors,[]);
 const output=process.env.ARTIFACT_DIR||path.join(root,'.artifacts');fs.mkdirSync(output,{recursive:true});
 const sizes=[{width:626,height:900,frameWidth:120,frameHeight:30,rowHeight:52,name:'scripts-local-images'},{width:360,height:520,frameWidth:96,frameHeight:24,rowHeight:48,name:'narrow-scripts-local-images'}];
 const naturalSizes=await page.locator('.script-icon-img').evaluateAll(images=>new Set(images.map(image=>image.naturalWidth+'x'+image.naturalHeight)).size);
 for(const size of sizes){
  await page.setViewportSize({width:size.width,height:size.height});
  await page.mouse.move(2,2);await page.locator('#scriptList').evaluate(list=>list.scrollTop=0);
  const layout=await page.locator('.script-item').evaluateAll(rows=>rows.map(row=>{
   const frame=row.querySelector('.script-icon'),image=row.querySelector('img'),name=row.querySelector('.script-name');
   return {height:row.getBoundingClientRect().height,width:frame.getBoundingClientRect().width,imageHeight:frame.getBoundingClientRect().height,imageWidth:image.getBoundingClientRect().width,nameX:name.getBoundingClientRect().x,radius:getComputedStyle(frame).borderRadius,clipped:getComputedStyle(frame).overflow,fit:getComputedStyle(image).objectFit};
  }));
  for(const item of layout){
   assert.equal(item.width,size.frameWidth);assert.equal(item.imageWidth,size.frameWidth);assert.equal(item.imageHeight,size.frameHeight);assert.equal(item.height,size.rowHeight);
   assert.equal(item.radius,'8px');assert.equal(item.clipped,'hidden');assert.equal(item.fit,'cover');assert.equal(item.nameX,layout[0].nameX,'all names align, including placeholders');
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:path.join(output,size.name+'.png')});
 }
 await page.setViewportSize({width:626,height:900});
 await page.locator('#scriptList').evaluate(list=>list.scrollTop=list.scrollHeight/2);
 await page.screenshot({path:path.join(output,'scripts-middle.png')});
 await page.locator('#scriptList').evaluate(list=>list.scrollTop=list.scrollHeight);
 await page.screenshot({path:path.join(output,'scripts-bottom.png')});
 console.log(JSON.stringify({scripts:result.scripts.length,matchedImages:matching.length,loadedImages:loaded,placeholders:result.scripts.length-loaded,sourceDimensions:naturalSizes,layout:'Every banner, placeholder, row and name alignment checked at 626px and 360px.'},null,2));
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
