/**
 * AE Local Toolkit - 主机脚本入口
 * 作为 CEP 面板的后端，运行在 AE ExtendScript 环境中
 * 提供工程整理、表达式管理、脚本启动等功能 API
 */
var AELocalToolkit = AELocalToolkit || {};

(function() {
  var scriptFolder = (new File($.fileName)).parent.fsName;
  try { $.evalFile(scriptFolder + "/modules/organizer.jsx"); } catch (e) {}
  try { $.evalFile(scriptFolder + "/modules/expressions.jsx"); } catch (e) {}
  if (typeof AELocalToolkit.expressions !== "object") {
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
  }
})();

// ===== 脚本启动器模块 =====
AELocalToolkit.launcher = (function() {
  function scanScripts(folderPath) {
    var result = { ok: true, folder: folderPath, scripts: [], messages: [] };
    try {
      var folder = new Folder(folderPath);
      if (!folder.exists) {
        result.ok = false;
        result.messages.push("\u6587\u4ef6\u5939\u4e0d\u5b58\u5728: " + folderPath);
        return result;
      }
      result.scripts = collectScripts(folder, folder.fsName);
    } catch (e) {
      result.ok = false;
      result.messages.push(e.toString());
    }
    return result;
  }

  function collectScripts(folder, basePath) {
    var items = folder.getFiles();
    items.sort(sortByName);
    var files = [];
    for (var i = 0; i < items.length; i++) {
      if (items[i] instanceof Folder) {
        if (!items[i].name.match(/^\(.*\)$/))
          files = files.concat(collectScripts(items[i], basePath));
      } else if (items[i].name.match(/\.(jsx|jsxbin)$/)) {
        var fsName = items[i].fsName;
        var fileName = fsName.replace(/^.*[\\\/]/, "");
        files.push({
          name: fileName.replace(/\.(jsx|jsxbin)$/, ""),
          relativePath: fsName.substr(basePath.length + 1),
          absoluteURI: items[i].absoluteURI,
          fsName: fsName,
          iconPath: File(fsName.replace(/\.(jsx|jsxbin)$/, ".png")).exists ? "file:///" + fsName.replace(/\\/g, "/").replace(/\.(jsx|jsxbin)$/, ".png") : ""
        });
      }
    }
    return files;
  }

  function sortByName(a, b) {
    var na = a.name.toLowerCase(), nb = b.name.toLowerCase();
    return na < nb ? -1 : na > nb ? 1 : 0;
  }

  function launchScript(filePath) {
    var result = { ok: true, file: filePath, messages: [] };
    try {
      var decoded = decodeURI(filePath);
      var file = new File(decoded);
      if (!file.exists) {
        result.ok = false;
        result.messages.push("\u627e\u4e0d\u5230\u811a\u672c\u6587\u4ef6: " + decoded);
        return result;
      }
      $.evalFile(file);
    } catch (e) {
      result.ok = false;
      result.messages.push("\u811a\u672c\u8fd0\u884c\u51fa\u9519: " + e.toString());
    }
    return result;
  }

  return { scanScripts: scanScripts, launchScript: launchScript };
})();

// ===== JSON 安全序列化工具 =====
AELocalToolkit.safeStringify = function (value) {
  function escapeString(str) {
    return String(str)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\r/g, "\\r")
      .replace(/\n/g, "\\n")
      .replace(/\t/g, "\\t");
  }

  function stringify(obj) {
    var type = typeof obj;
    if (obj === null) return "null";
    if (type === "string") return '"' + escapeString(obj) + '"';
    if (type === "number" || type === "boolean") return String(obj);
    if (obj instanceof Array) {
      var arr = [];
      for (var i = 0; i < obj.length; i++) arr.push(stringify(obj[i]));
      return "[" + arr.join(",") + "]";
    }
    var props = [];
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        props.push('"' + escapeString(key) + '":' + stringify(obj[key]));
      }
    }
    return "{" + props.join(",") + "}";
  }

  return stringify(value);
};

// ===== 返回结果封装 =====
AELocalToolkit.returnResult = function (result) {
  return AELocalToolkit.safeStringify(result);
};

// ===== JSON 解析（含降级方案） =====
AELocalToolkit.parseJson = function (text, fallback) {
  try {
    if (typeof JSON !== "undefined" && JSON.parse) {
      return JSON.parse(text);
    }
  } catch (e) {
  }

  try {
    return eval("(" + text + ")");
  } catch (evalError) {
    return fallback;
  }
};


// ===== 本地文件存储模块（整理方案持久化） =====
AELocalToolkit.fileStorage = (function () {
  function getBaseFolder() {
    var folder = new Folder(Folder.userData.fullName + "/AE Local Toolkit");
    if (!folder.exists) folder.create();
    return folder;
  }

  function getSchemeFolder() {
    var folder = new Folder(getBaseFolder().fsName + "/organizer-schemes");
    if (!folder.exists) folder.create();
    return folder;
  }

  function safeFileName(id) {
    return String(id || "scheme").replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  function readText(file) {
    file.encoding = "UTF-8";
    if (!file.open("r")) return "";
    var text = file.read();
    file.close();
    return text;
  }

  function writeText(file, text) {
    file.encoding = "UTF-8";
    if (!file.open("w")) return false;
    file.write(text);
    file.close();
    return true;
  }

  function listSchemes() {
    var result = {
      ok: true,
      schemes: [AELocalToolkit.organizer.defaultScheme],
      schemeFolder: "",
      messages: []
    };

    try {
      var folder = getSchemeFolder();
      result.schemeFolder = folder.fsName;
      var files = folder.getFiles("*.json");
      for (var i = 0; i < files.length; i++) {
        try {
          var scheme = AELocalToolkit.parseJson(readText(files[i]), null);
          if (scheme && scheme.id && scheme.rules) {
            scheme.builtin = false;
            result.schemes.push(scheme);
          }
        } catch (fileError) {
          result.messages.push("Read scheme failed: " + files[i].name + " / " + fileError.toString());
        }
      }
    } catch (e) {
      result.ok = false;
      result.messages.push(e.toString());
    }

    return result;
  }

  function saveScheme(scheme) {
    var result = {
      ok: true,
      scheme: scheme,
      messages: []
    };

    try {
      if (!scheme || !scheme.id || !scheme.rules) {
        result.ok = false;
        result.messages.push("Invalid scheme.");
        return result;
      }

      scheme.builtin = false;
      var file = new File(getSchemeFolder().fsName + "/" + safeFileName(scheme.id) + ".json");
      if (!writeText(file, AELocalToolkit.safeStringify(scheme))) {
        result.ok = false;
        result.messages.push("Could not write scheme file.");
      }
    } catch (e) {
      result.ok = false;
      result.messages.push(e.toString());
    }

    return result;
  }

  function deleteScheme(id) {
    var result = {
      ok: true,
      id: id,
      messages: []
    };

    try {
      if (id === "preset-default") {
        result.ok = false;
        result.messages.push("Default scheme cannot be deleted.");
        return result;
      }

      var file = new File(getSchemeFolder().fsName + "/" + safeFileName(id) + ".json");
      if (file.exists) {
        file.remove();
      }
    } catch (e) {
      result.ok = false;
      result.messages.push(e.toString());
    }

    return result;
  }

  return {
    listSchemes: listSchemes,
    saveScheme: saveScheme,
    deleteScheme: deleteScheme
  };
})();

// ===== AE 连接检测 =====
function AELT_ping() {
  return AELocalToolkit.returnResult({
    ok: true,
    appVersion: app.version,
    message: "Host JSX loaded"
  });
}

// ===== AE 工程整理入口（使用默认方案） =====
function AELT_organizeProject() {
  return AELocalToolkit.returnResult(AELocalToolkit.organizer.organizeProject());
}

// ===== AE 工程整理入口（使用指定方案） =====
function AELT_organizeProjectWithScheme(schemeJson) {
  var scheme = AELocalToolkit.parseJson(schemeJson, null);
  return AELocalToolkit.returnResult(AELocalToolkit.organizer.organizeProjectWithScheme(scheme));
}

// ===== 加载所有整理方案列表 =====
function AELT_loadOrganizerSchemes() {
  return AELocalToolkit.returnResult(AELocalToolkit.fileStorage.listSchemes());
}

// ===== 保存整理方案 =====
function AELT_saveOrganizerScheme(schemeJson) {
  var scheme = AELocalToolkit.parseJson(schemeJson, null);
  return AELocalToolkit.returnResult(AELocalToolkit.fileStorage.saveScheme(scheme));
}

// ===== 删除整理方案 =====
function AELT_deleteOrganizerScheme(id) {
  return AELocalToolkit.returnResult(AELocalToolkit.fileStorage.deleteScheme(id));
}

// ===== 获取选中属性摘要 =====
function AELT_getSelectedPropertySummary() {
  return AELocalToolkit.returnResult(AELocalToolkit.expressions.getSelectedPropertySummary());
}

// ===== 批量应用表达式 =====
function AELT_applyExpression(expression, overwriteExisting) {
  return AELocalToolkit.returnResult(
    AELocalToolkit.expressions.applyExpression(expression, overwriteExisting === true || overwriteExisting === "true")
  );
}

// ===== 批量移除表达式 =====
function AELT_removeExpressions() {
  return AELocalToolkit.returnResult(AELocalToolkit.expressions.removeExpressions());
}

// ===== 选择脚本文件夹对话框 =====
function AELT_selectScriptFolder() {
  var folder = Folder.selectDialog("\u9009\u62e9\u811a\u672c\u6587\u4ef6\u5939");
  return AELocalToolkit.returnResult({
    ok: true,
    path: folder ? folder.fsName : ""
  });
}

// ===== 扫描指定文件夹中的脚本文件 =====
function AELT_scanScripts(folderPath) {
  try {
    if (!AELocalToolkit.launcher) return AELocalToolkit.returnResult({ ok: false, messages: ["launcher \u6a21\u5757\u672a\u52a0\u8f7d"] });
    return AELocalToolkit.returnResult(AELocalToolkit.launcher.scanScripts(folderPath));
  } catch (e) {
    return AELocalToolkit.returnResult({ ok: false, messages: [e.toString()] });
  }
}

// ===== 运行指定脚本 =====
function AELT_launchScript(filePath) {
  try {
    if (!AELocalToolkit.launcher) return AELocalToolkit.returnResult({ ok: false, messages: ["launcher \u6a21\u5757\u672a\u52a0\u8f7d"] });
    return AELocalToolkit.returnResult(AELocalToolkit.launcher.launchScript(filePath));
  } catch (e) {
    return AELocalToolkit.returnResult({ ok: false, messages: [e.toString()] });
  }
}
