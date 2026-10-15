/* Operate on explicitly selected properties; every batch is one undo step. */
AELocalToolkit.expressions = (function () {
  function selection() {
    var comp = app.project && app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error('请先打开合成，在时间线中选中需要处理的属性。');
    var properties = [], names = [], keys = [], existing = 0, skipped = 0;
    var selected = comp.selectedProperties;
    for (var i = 0; i < selected.length; i++) {
      var prop = selected[i];
      if (prop.propertyType !== PropertyType.PROPERTY || !prop.canSetExpression) { skipped++; continue; }
      var parent = prop, path = [];
      while (parent.parentProperty) { path.unshift(parent.propertyIndex); parent = parent.parentProperty; }
      var layer = prop.propertyGroup(prop.propertyDepth);
      keys.push(layer.index + ':' + path.join('.'));
      properties.push(prop);
      if (prop.expression) existing++;
      if (names.length < 8) names.push(layer.name + ' / ' + prop.name);
    }
    keys.sort();
    return { properties: properties, total: selected.length, supported: properties.length, existing: existing, skipped: skipped, names: names, comp: comp.name, selectionKey: comp.id + ':' + keys.join('|') };
  }
  function summary() {
    try {
      var data = selection(); delete data.properties; data.ok = true; return data;
    } catch (e) { return { ok: false, total: 0, supported: 0, existing: 0, skipped: 0, messages: [String(e)] }; }
  }
  function batch(expression, overwrite, remove, expectedSelection) {
    var result = { ok: false, applied: 0, removed: 0, skipped: 0, errors: 0, messages: [] }, selected;
    try {
      selected = selection();
      if (!selected.supported) throw new Error('没有可处理的属性。请在时间线中选中位置、旋转等具体属性。');
      if (expectedSelection && selected.selectionKey !== expectedSelection) throw new Error('AE 中的属性选择已改变，请检查目标后重试。');
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
  return { getSelectedPropertySummary: summary, applyExpression: function (code, overwrite, expected) { return batch(code, overwrite, false, expected); }, removeExpressions: function (expected) { return batch('', false, true, expected); } };
})();
