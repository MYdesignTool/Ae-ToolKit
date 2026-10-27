const {test}=require('node:test');const assert=require('node:assert/strict');const {fixture,names}=require('./transform-host.cjs');const {storage}=require('./helpers.cjs');
test('layer-only batches apply only to checked transforms on selected layers in one undo group',()=>{
  const env=fixture([{}, {existing:{opacity:'time*20'}}]),other=env.layer({},3);
  const summary=env.summary(['position','opacity']);assert.equal(summary.mode,'layers');assert.equal(summary.layers,2);assert.equal(summary.supported,4);assert.equal(summary.existing,1);
  const result=env.apply('value',['position','opacity'],false,summary.selectionKey);assert.equal(result.applied,3);assert.equal(result.skipped,1);
  assert.equal(env.layers[1].props[names.opacity].expression,'time*20');assert.equal(other.props[names.position].expression,'');
  for(const layer of env.layers)assert.equal(layer.props[names.scale].expression,'');assert.deepEqual(env.undo,['begin','end']);
});
test('mixed 2D/3D batches map rotation to Z rotation and skip unavailable 3D-only targets',()=>{
  const env=fixture([{}, {threeD:true}]),targets=Object.keys(names),summary=env.summary(targets);
  assert.equal(summary.supported,13);assert.equal(summary.skipped,3);const result=env.apply('value',targets);assert.equal(result.applied,13);assert.equal(result.skipped,3);
  for(const layer of env.layers)assert.equal(layer.props[names.rotation].expression,'value');assert.equal(env.layers[1].props[names.orientation].expression,'value');
});
test('separated Position targets expand to existing X/Y and X/Y/Z followers',()=>{
  const env=fixture([{separated:true},{threeD:true,separated:true},{}]);assert.equal(env.summary(['position']).supported,6);
  assert.equal(env.apply('wiggle(5,20)',['position']).applied,6);
  for(const layer of env.layers.slice(0,2)){assert.equal(layer.props[names.position].expression,'');for(const follower of layer.followers)assert.equal(follower.expression,'wiggle(5,20)');}
});
test('camera and light layers retain their available 3D transforms without an AVLayer threeDLayer flag',()=>{
  for(const matchName of ['ADBE Camera Layer','ADBE Light Layer']){
    const env=fixture([{threeD:true,missing:['opacity','scale','anchorPoint']}]);env.layers[0].threeDLayer=undefined;env.layers[0].matchName=matchName;
    assert.equal(env.summary(['orientation','xRotation','yRotation']).supported,3);
    assert.equal(env.apply('value',['orientation','xRotation','yRotation']).applied,3);
  }
});
test('explicit property selection takes priority over layer transform targets',()=>{
  const env=fixture();env.comp.selectedProperties=[env.layers[0].props[names.opacity]];
  assert.equal(env.summary(['position']).mode,'properties');assert.equal(env.apply('value',['position']).applied,1);
  assert.equal(env.layers[0].props[names.opacity].expression,'value');for(const layer of env.layers)assert.equal(layer.props[names.position].expression,'');
});
test('layer-reported property selection takes priority when the composition list is empty',()=>{
  const env=fixture();env.layers[0].selectedProperties=[env.layers[0].props[names.scale]];
  assert.equal(env.summary(['position']).mode,'properties');assert.equal(env.apply('value',['position']).applied,1);
  assert.equal(env.layers[0].props[names.scale].expression,'value');
  for(const layer of env.layers)assert.equal(layer.props[names.position].writes,0);
  env.layers[0].selectedProperties=[env.layers[0].group];
  assert.equal(env.summary(['position']).mode,'properties');assert.equal(env.apply('value',['position']).ok,false);
});
test('a selected group or unsupported property cannot silently fall back to layer transforms',()=>{
  const env=fixture();env.comp.selectedProperties=[env.layers[0].group];assert.equal(env.summary(['position']).mode,'properties');
  assert.equal(env.apply('value',['position']).ok,false);assert.deepEqual(env.undo,[]);assert.equal(env.layers[0].props[names.position].writes,0);
});
test('locked layers and absent transform properties are skipped without modification',()=>{
  const env=fixture([{}, {locked:true}, {missing:['opacity']}]),summary=env.summary(['position','opacity']);
  assert.equal(summary.supported,3);assert.equal(summary.skipped,3);const result=env.apply('value',['position','opacity']);assert.equal(result.applied,3);assert.equal(result.skipped,3);
  assert.equal(env.layers[1].props[names.position].writes,0);assert.equal(env.layers[1].props[names.opacity].writes,0);
});
test('target or layer identity and 2D/3D changes invalidate confirmation before any writes',()=>{
  for(const change of ['target','identity','dimension','mode']){
    const env=fixture(),key=env.summary(['position']).selectionKey;let targets=['position'];
    if(change==='target')targets=['opacity'];if(change==='identity')env.comp.selectedLayers=[env.layer({},1)];
    if(change==='dimension')env.layers[0].threeDLayer=true;if(change==='mode')env.comp.selectedProperties=[env.layers[0].props[names.position]];
    const result=env.apply('value',targets,true,key);assert.equal(result.ok,false,change);assert.deepEqual(env.undo,[],change);assert.equal(env.layers[0].props[names.position].writes,0,change);
  }
});
test('target order and duplicates do not change the meaning of a layer batch',()=>{
  const env=fixture(),key=env.summary(['position','opacity']).selectionKey;env.comp.selectedLayers.reverse();
  const result=env.apply('value',['opacity','position','opacity'],true,key);assert.equal(result.ok,true);assert.equal(result.applied,4);
});
test('empty or invalid targets cannot create a successful batch or undo group',()=>{
  const env=fixture();assert.equal(env.apply('value',[]).ok,false);assert.equal(env.apply('value',['__proto__']).ok,false);
  assert.equal(env.summary().supported,0);assert.equal(env.call('AELocalToolkit.expressions.getSelectedPropertySummary()').targets.length,0);
  assert.equal(env.call('AELocalToolkit.expressions.applyExpression("value",true)').ok,false);
  assert.equal(env.call('AELocalToolkit.expressions.applyExpression("value",true,"","position")').ok,false);
  assert.deepEqual(env.undo,[]);assert.equal(env.summary([]).supported,0);
});
test('per-property evaluation failures restore old expressions and enabled state',()=>{
  const env=fixture([{existing:{opacity:'time*20'}}]);env.layers[0].props[names.opacity].expressionEnabled=false;
  const result=env.apply('needsVector',['position','opacity']);assert.equal(result.applied,1);assert.equal(result.errors,1);assert.equal(result.ok,false);
  assert.equal(env.layers[0].props[names.opacity].expression,'time*20');assert.equal(env.layers[0].props[names.opacity].expressionEnabled,false);assert.deepEqual(env.undo,['begin','end']);
});
test('removing in layer mode affects only chosen transforms',()=>{
  const env=fixture([{existing:{position:'wiggle(5,20)',opacity:'time*20'}}]),key=env.summary(['opacity']).selectionKey;
  env.ctx.expected=key;const result=env.call('AELocalToolkit.expressions.removeExpressions(expected,["opacity"])');
  assert.equal(result.removed,1);assert.equal(env.layers[0].props[names.opacity].expression,'');assert.equal(env.layers[0].props[names.position].expression,'wiggle(5,20)');
});
test('session-only transform targets are absent from settings and backups, including legacy preferences',()=>{
  const env=storage();assert.equal(JSON.parse(env.call('AELocalToolkit.storage.loadSettings()')).settings.expressionTransformTargets,undefined);
  env.call('AELocalToolkit.storage.saveSettings({language:"en",expressionTransformTargets:["opacity","orientation"]})');
  const saved=JSON.parse(env.call('AELocalToolkit.storage.loadSettings()')).settings;
  assert.equal(saved.expressionTransformTargets,undefined);assert.equal(saved.language,'en');
  env.context.File.saveDialog=()=>new env.context.File('/target-backup.json');env.call('AELocalToolkit.storage.exportData()');
  assert.equal(JSON.parse(env.files.get('/target-backup.json')).settings.expressionTransformTargets,undefined);
  const old=JSON.parse(env.files.get('/target-backup.json'));old.settings.expressionTransformTargets=['opacity'];env.files.set('/target-backup.json',JSON.stringify(old));
  env.context.File.openDialog=()=>new env.context.File('/target-backup.json');env.call('AELocalToolkit.storage.importData()');
  assert.equal(JSON.parse(env.call('AELocalToolkit.storage.loadSettings()')).settings.expressionTransformTargets,undefined);
});
