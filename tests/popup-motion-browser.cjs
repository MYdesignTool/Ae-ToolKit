// Deterministic Web Animations checks for completion and organizer folder popups.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const {root}=require('./helpers.cjs'),{bridge,data}=require('./motion.cjs');
const output=path.join(root,'.artifacts','0.6.1');fs.mkdirSync(output,{recursive:true});
async function main(){
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:626,height:870},reducedMotion:'reduce'}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(bridge,data);
    await page.goto(pathToFileURL(path.join(root,'extension/client/index.html')).href);await page.waitForFunction(()=>AELT.state.ready);
    await page.evaluate(()=>{
      window.__popupEffects=[];const original=animateMotion;
      window.animateMotion=function(element,frames,options){
        const animation=original(element,frames,options);
        if(element.matches('.expression-completion,#pathPicker')){animation.pause();window.__popupEffects.push(animation);}
        return animation;
      };
    });
    async function view(name){await page.emulateMedia({reducedMotion:'reduce'});await page.locator('[data-view='+name+']').click();await page.waitForFunction(name=>document.getElementById(name+'View').classList.contains('active'),name);await page.emulateMedia({reducedMotion:'no-preference'});}
    async function scale(value){await page.evaluate(value=>setAnimationScale(value),value);}
    async function finish(selector,state){await page.locator(selector).evaluate(el=>el._popupAnimation.finish());if(state)await page.waitForFunction(({selector,state})=>document.querySelector(selector)?.dataset.popupMotion===state,{selector,state});}
    async function timing(selector){return page.locator(selector).evaluate(el=>({duration:el._popupAnimation.effect.getTiming().duration,rate:el._popupAnimation.playbackRate,state:el.dataset.popupMotion,pointer:getComputedStyle(el).pointerEvents,hidden:el.getAttribute('aria-hidden')}));}
    async function openCompletion(){
      await page.evaluate(()=>{AELT.editor.setValue('');const cm=AELT.editor.getInstance();cm.focus();cm.replaceSelection('w','end','+input');});
      await page.waitForFunction(()=>document.querySelector('.expression-completion')?.dataset.popupMotion==='opening');
    }
    async function closeCompletion(){await page.locator('#expressionSearch').focus();await page.waitForFunction(()=>document.querySelector('.expression-completion')?.dataset.popupMotion==='closing');}
    await view('expressions');
    for(const value of [0.5,1,2]){
      await scale(value);await openCompletion();assert.equal((await timing('.expression-completion')).duration,140*value);
      if(value===1){await page.locator('.expression-completion').evaluate(el=>{el._popupAnimation.currentTime=70;});await page.screenshot({path:path.join(output,'completion-open-mid.png')});}
      const before=await page.evaluate(()=>{window.__completionElement=document.querySelector('.expression-completion');return __popupEffects.length;});
      await page.keyboard.type('i');await page.waitForFunction(()=>document.querySelector('.completion-name')?.textContent==='width');
      assert.equal(await page.evaluate(()=>document.querySelector('.expression-completion')===__completionElement),true);
      assert.equal(await page.evaluate(()=>__popupEffects.length),before,'typing updates the existing popup without replaying its entrance');
      await page.keyboard.press('Backspace');await page.waitForFunction(()=>document.querySelector('.completion-name')?.textContent==='while');
      assert.equal(await page.evaluate(()=>__popupEffects.length),before,'deletion also refreshes without replaying');
      await finish('.expression-completion','open');await closeCompletion();
      const exit=await timing('.expression-completion');assert.equal(exit.duration,110*value);assert.equal(exit.pointer,'none');assert.equal(exit.hidden,'true');
      if(value===1){await page.locator('.expression-completion').evaluate(el=>{el._popupAnimation.currentTime=55;});await page.screenshot({path:path.join(output,'completion-close-mid.png')});}
      assert.equal(await page.evaluate(()=>AELT.editor.getInstance().getInputField().getAttribute('aria-expanded')),'false');
      await finish('.expression-completion');await page.locator('.expression-completion').waitFor({state:'detached'});
    }
    await scale(2);await openCompletion();await page.locator('.expression-completion').evaluate(el=>{el._popupAnimation.currentTime=40;});
    await scale(1);assert.equal((await timing('.expression-completion')).rate,2,'changing the existing speed option retimes the animation');
    await scale(0);await page.waitForFunction(()=>document.querySelector('.expression-completion')?.dataset.popupMotion==='open');
    await page.locator('#expressionSearch').focus();assert.equal(await page.locator('.expression-completion').count(),0,'motion off removes synchronously');
    // Rapid dismissal/reopen cancels the old finish callback instead of removing the new session.
    await scale(2);await openCompletion();await finish('.expression-completion','open');await closeCompletion();
    await page.evaluate(()=>{const el=document.querySelector('.expression-completion');window.__oldCompletion=el;window.__oldFinish=el._popupAnimation.onfinish;});
    await page.evaluate(()=>{const cm=AELT.editor.getInstance();cm.focus();cm.replaceSelection('i','end','+input');});
    await page.waitForFunction(()=>document.querySelector('.expression-completion')?.dataset.popupMotion==='opening');
    await page.evaluate(()=>__oldFinish());assert.equal(await page.locator('.expression-completion').count(),1);
    assert.equal(await page.evaluate(()=>document.querySelector('.expression-completion')===__oldCompletion),true);
    await finish('.expression-completion','open');await closeCompletion();await scale(0);await page.locator('.expression-completion').waitFor({state:'detached'});
    await view('organizer');const folder=page.locator('[data-rule-path]').first(),picker=page.locator('#pathPicker');
    for(const value of [0.5,1,2]){
      await scale(value);await folder.click();assert.equal((await timing('#pathPicker')).duration,140*value);
      if(value===1){await picker.evaluate(el=>{el._popupAnimation.currentTime=70;});await page.screenshot({path:path.join(output,'folder-open-mid.png')});}
      assert.equal(await page.locator('#pathPickerSearch').evaluate(el=>document.activeElement===el),true);
      await finish('#pathPicker','open');const before=await page.evaluate(()=>__popupEffects.length);
      await page.locator('#pathPickerSearch').fill('Image');assert.equal(await page.evaluate(()=>__popupEffects.length),before,'search does not replay folder entrance');
      await page.locator('#pathPickerClose').click();const exit=await timing('#pathPicker');assert.equal(exit.duration,110*value);assert.equal(exit.pointer,'none');assert.equal(exit.hidden,'true');
      if(value===1){await picker.evaluate(el=>{el._popupAnimation.currentTime=55;});await page.screenshot({path:path.join(output,'folder-close-mid.png')});}
      assert.equal(await folder.getAttribute('aria-expanded'),'false');assert.equal(await folder.evaluate(el=>document.activeElement===el),true);
      await finish('#pathPicker','closed');assert.equal(await picker.isHidden(),true);
    }
    await scale(2);await folder.click();await finish('#pathPicker','open');await page.locator('#pathPickerClose').click();
    await picker.evaluate(el=>{window.__oldFolderFinish=el._popupAnimation.onfinish;});await folder.click();await page.evaluate(()=>__oldFolderFinish());
    assert.equal(await picker.isVisible(),true);assert.equal((await timing('#pathPicker')).state,'opening');
    await finish('#pathPicker','open');await page.locator('#pathPickerClose').click();await scale(0);await picker.waitFor({state:'hidden'});
    // Both explicit Off and system reduced motion skip entrance/exit entirely.
    for(const mode of ['off','reduce']){
      await page.emulateMedia({reducedMotion:mode==='reduce'?'reduce':'no-preference'});await scale(mode==='off'?0:2);
      const before=await page.evaluate(()=>__popupEffects.length);await folder.click();assert.equal(await picker.getAttribute('data-popup-motion'),'open');
      await page.locator('#pathPickerClose').click();assert.equal(await picker.isHidden(),true);assert.equal(await page.evaluate(()=>__popupEffects.length),before);
      await page.locator('[data-view=expressions]').click();await page.waitForFunction(()=>document.getElementById('expressionsView').classList.contains('active'));
      await page.evaluate(()=>{AELT.editor.setValue('');const cm=AELT.editor.getInstance();cm.focus();cm.replaceSelection('w','end','+input');});
      await page.waitForFunction(()=>document.querySelector('.expression-completion')?.dataset.popupMotion==='open');
      await page.locator('#expressionSearch').focus();assert.equal(await page.locator('.expression-completion').count(),0);assert.equal(await page.evaluate(()=>__popupEffects.length),before);
      await page.locator('[data-view=organizer]').click();await page.waitForFunction(()=>document.getElementById('organizerView').classList.contains('active'));
    }
    assert.deepEqual(errors,[]);
    console.log('Popup motion passed: completion and folder entrance/exit at 0.5x/1x/2x, live retiming, Off/reduced motion, focus/ARIA/pointer cleanup, in-place typing/deletion/search and interrupted close/reopen.');
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
