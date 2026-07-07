/**
 * AE Local Toolkit - 表达式管理模块
 * 提供 AE 表达式的批量应用、移除及选中属性的摘要统计功能
 * 通过 ExtendScript 操作 AE 内部属性对象
 */
AELocalToolkit = AELocalToolkit || {};
AELocalToolkit.expressions = (function () {
  function resultBase() {
    return {
      ok: true,
      total: 0,
      applied: 0,
      removed: 0,
      skipped: 0,
      existing: 0,
      errors: 0,
      messages: []
    };
  }

  function collectLayerProperties(group, props) {
    try {
      for (var i = 1; i <= group.numProperties; i++) {
        var child = group.property(i);
        if (child.selected === true) {
          props.push(child);
        }
        if (child.numProperties && child.numProperties > 0) {
          collectLayerProperties(child, props);
        }
      }
    } catch (e) {
    }
  }

  function getSelectedProperties() {
    var comp = app.project ? app.project.activeItem : null;
    if (!comp || !(comp instanceof CompItem)) {
      return {
        ok: false,
        message: "Open a comp and select one or more properties.",
        properties: []
      };
    }

    var props = [];
    try {
      var directProps = comp.selectedProperties;
      for (var i = 0; i < directProps.length; i++) {
        props.push(directProps[i]);
      }
    } catch (e) {
      props = [];
    }

    if (props.length === 0) {
      var layers = comp.selectedLayers;
      for (var j = 0; j < layers.length; j++) {
        collectLayerProperties(layers[j], props);
      }
    }

    return {
      ok: true,
      message: "",
      properties: props
    };
  }

  function canUseExpression(prop) {
    try {
      return prop && prop.canSetExpression === true;
    } catch (e) {
      return false;
    }
  }

  function hasExpression(prop) {
    try {
      return prop.expressionEnabled === true || (prop.expression && prop.expression.length > 0);
    } catch (e) {
      return false;
    }
  }

  function getSelectedPropertySummary() {
    var selected = getSelectedProperties();
    var summary = resultBase();

    if (!selected.ok) {
      summary.ok = false;
      summary.messages.push(selected.message);
      return summary;
    }

    summary.total = selected.properties.length;
    for (var i = 0; i < selected.properties.length; i++) {
      var prop = selected.properties[i];
      if (!canUseExpression(prop)) {
        summary.skipped++;
      } else if (hasExpression(prop)) {
        summary.existing++;
      }
    }

    return summary;
  }

  function applyExpression(expression, overwriteExisting) {
    var summary = resultBase();
    var selected = getSelectedProperties();

    if (!selected.ok) {
      summary.ok = false;
      summary.messages.push(selected.message);
      return summary;
    }

    if (!expression || String(expression).replace(/\s/g, "").length === 0) {
      summary.ok = false;
      summary.messages.push("Expression is empty.");
      return summary;
    }

    summary.total = selected.properties.length;
    app.beginUndoGroup("AE Local Toolkit - Apply Expression");
    try {
      for (var i = 0; i < selected.properties.length; i++) {
        var prop = selected.properties[i];
        try {
          if (!canUseExpression(prop)) {
            summary.skipped++;
            continue;
          }

          if (hasExpression(prop) && !overwriteExisting) {
            summary.existing++;
            summary.skipped++;
            continue;
          }

          prop.expression = expression;
          prop.expressionEnabled = true;
          summary.applied++;
        } catch (e) {
          summary.errors++;
          summary.messages.push("Apply failed: " + e.toString());
        }
      }
    } catch (outerError) {
      summary.ok = false;
      summary.errors++;
      summary.messages.push(outerError.toString());
    } finally {
      app.endUndoGroup();
    }

    return summary;
  }

  function removeExpressions() {
    var summary = resultBase();
    var selected = getSelectedProperties();

    if (!selected.ok) {
      summary.ok = false;
      summary.messages.push(selected.message);
      return summary;
    }

    summary.total = selected.properties.length;
    app.beginUndoGroup("AE Local Toolkit - Remove Expressions");
    try {
      for (var i = 0; i < selected.properties.length; i++) {
        var prop = selected.properties[i];
        try {
          if (!canUseExpression(prop) || !hasExpression(prop)) {
            summary.skipped++;
            continue;
          }

          prop.expressionEnabled = false;
          prop.expression = "";
          summary.removed++;
        } catch (e) {
          summary.errors++;
          summary.messages.push("Remove failed: " + e.toString());
        }
      }
    } catch (outerError) {
      summary.ok = false;
      summary.errors++;
      summary.messages.push(outerError.toString());
    } finally {
      app.endUndoGroup();
    }

    return summary;
  }

  return {
    getSelectedPropertySummary: getSelectedPropertySummary,
    applyExpression: applyExpression,
    removeExpressions: removeExpressions
  };
})();
