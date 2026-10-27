/* Explicit properties take priority. Layer-only selections use opt-in transform targets. */
AELocalToolkit.expressions = (function () {
  var transformNames = {
    anchorPoint:'ADBE Anchor Point', position:'ADBE Position', scale:'ADBE Scale', rotation:'ADBE Rotate Z',
    opacity:'ADBE Opacity', orientation:'ADBE Orientation', xRotation:'ADBE Rotate X', yRotation:'ADBE Rotate Y'
  };
  function targetKeys(value) {
    if (value === undefined) value = [];
    if (!(value instanceof Array)) throw new Error('变换目标必须是属性列表。');
    var result = [], seen = {};
    for (var i = 0; i < value.length; i++) {
      var key = value[i];
      if (typeof key !== 'string' || !Object.prototype.hasOwnProperty.call(transformNames, key)) throw new Error('不支持的变换目标。');
      if (!seen['$' + key]) { seen['$' + key] = true; result.push(key); }
    }
    result.sort(); return result;
  }
  function layerKey(layer) { return (layer.id !== undefined ? 'id:' + layer.id : 'index:' + layer.index); }
  function isSpatialLayer(layer) {
    return !!layer.threeDLayer || layer.matchName === 'ADBE Camera Layer' || layer.matchName === 'ADBE Light Layer';
  }
  function selection(targets) {
    var comp = app.project && app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error('请先打开合成，在时间线中选中属性或图层。');
    var properties = [], names = [], keys = [], seen = {}, existing = 0, skipped = 0, total = 0;
    var selected = comp.selectedProperties || [], layers = comp.selectedLayers || [], targets = targetKeys(targets);
    // Some host contexts expose the current selection only on the layers.
    // Never fall back to transform targets while a layer reports selected properties.
    if (!selected.length) {
      selected = [];
      for (var l = 0; l < layers.length; l++) {
        var layerSelected = layers[l].selectedProperties || [];
        for (var p = 0; p < layerSelected.length; p++) selected.push(layerSelected[p]);
      }
    }
    // ExtendScript can evaluate chained ternaries with different associativity from JS.
    // A property selection also selects its layer, so the property branch must win explicitly.
    var mode = 'none', layerKeys = [];
    if (selected.length > 0) mode = 'properties';
    else if (layers.length > 0) mode = 'layers';
    function add(prop, layer) {
      total++;
      if (!prop || layer.locked || prop.propertyType !== PropertyType.PROPERTY || !prop.canSetExpression) { skipped++; return; }
      var parent = prop, path = [];
      while (parent.parentProperty) { path.unshift(parent.propertyIndex); parent = parent.parentProperty; }
      var key = layerKey(layer) + ':' + path.join('.');
      if (seen['$' + key]) { total--; return; }
      seen['$' + key] = true; keys.push(key);
      properties.push(prop);
      if (prop.expression) existing++;
      if (names.length < 8) names.push(layer.name + ' / ' + prop.name);
    }
    var i, j, prop, layer;
    if (mode === 'properties') {
      for (i = 0; i < selected.length; i++) {
        prop = selected[i];
        if (prop.propertyType !== PropertyType.PROPERTY || !prop.canSetExpression) { total++; skipped++; continue; }
        add(prop, prop.propertyGroup(prop.propertyDepth));
      }
    } else if (mode === 'layers') {
      for (i = 0; i < layers.length; i++) {
        layer = layers[i]; var spatial = isSpatialLayer(layer);
        layerKeys.push(layerKey(layer) + ':' + spatial + ':' + !!layer.locked);
        var transform = null;
        try { if (!layer.locked) transform = layer.property('ADBE Transform Group'); } catch (ignored) {}
        for (j = 0; j < targets.length; j++) {
          var name = targets[j]; prop = null;
          try {
            if (transform && (spatial || (name !== 'orientation' && name !== 'xRotation' && name !== 'yRotation'))) prop = transform.property(transformNames[name]);
            if (name === 'position' && prop && prop.isSeparationLeader && prop.dimensionsSeparated) {
              for (var axis = 0; axis < (spatial ? 3 : 2); axis++) {
                var follower = null;
                try { follower = prop.getSeparationFollower(axis); } catch (ignoredFollower) {}
                add(follower, layer);
              }
            } else add(prop, layer);
          } catch (unavailable) { total++; skipped++; }
        }
      }
    }
    keys.sort();
    layerKeys.sort();
    return { properties:properties, total:total, supported:properties.length, existing:existing, skipped:skipped, names:names,
      comp:comp.name, mode:mode, layers:layers.length, targets:targets,
      selectionKey:comp.id + ':' + mode + ':' + (mode === 'layers' ? layerKeys.join('|') + ':' + targets.join(',') + ':' : '') + keys.join('|') };
  }
  function summary(targets) {
    try {
      var data = selection(targets); delete data.properties; data.ok = true; return data;
    } catch (e) { return { ok: false, total: 0, supported: 0, existing: 0, skipped: 0, messages: [String(e)] }; }
  }
  function batch(expression, overwrite, remove, expectedSelection, targets) {
    var result = { ok: false, applied: 0, removed: 0, skipped: 0, errors: 0, messages: [] }, selected;
    try {
      selected = selection(targets);
      if (!selected.supported) throw new Error('没有可处理的属性。请选中具体属性，或选中图层并勾选变换目标。');
      if (expectedSelection && selected.selectionKey !== expectedSelection) throw new Error('AE 中的属性或图层选择已改变，请检查目标后重试。');
      if (!remove && !String(expression).replace(/\s/g, '')) throw new Error('请先输入表达式。');
    } catch (e) { result.messages.push(String(e)); return result; }
    result.skipped = selected.skipped;
    app.beginUndoGroup(remove ? 'AE工具箱 · 移除表达式' : 'AE工具箱 · 应用表达式');
    try {
      for (var i = 0; i < selected.properties.length; i++) {
        var prop = selected.properties[i], previous = prop.expression, enabled = prop.expressionEnabled;
        if ((remove && !previous) || (!remove && previous && !overwrite)) { result.skipped++; continue; }
        try {
          prop.expression = remove ? '' : expression;
          if (!remove) {
            prop.expressionEnabled = true;
            if (prop.expressionError) throw new Error(prop.expressionError);
            result.applied++;
          } else result.removed++;
        } catch (e) {
          result.errors++;
          if (result.messages.length < 20) result.messages.push(prop.name + '：' + String(e));
          try { prop.expression = previous; if (previous) prop.expressionEnabled = enabled; }
          catch (restoreError) { result.messages.push('恢复失败，请使用 AE 撤销：' + String(restoreError)); }
        }
      }
      result.ok = result.errors === 0;
    } catch (e) { result.errors++; result.messages.push(String(e)); }
    finally { app.endUndoGroup(); }
    return result;
  }
  return {getSelectedPropertySummary:summary,
    applyExpression:function (code, overwrite, expected, targets) { return batch(code, overwrite, false, expected, targets); },
    removeExpressions:function (expected, targets) { return batch('', false, true, expected, targets); }};
})();
