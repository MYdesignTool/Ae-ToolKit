/**
 * AE Local Toolkit - 主机脚本入口
 * 作为 CEP 面板的后端，运行在 AE ExtendScript 环境中
 * 提供工程整理、表达式管理、脚本启动等功能 API
 */
var AELocalToolkit = AELocalToolkit || {};

// 诊断日志：写入临时目录（Folder.temp 在本环境可靠；Folder.userData 可能不可用）
function hostLog(msg) {
  try {
    var dir = Folder.temp;
    if (!dir || !dir.exists) dir = new Folder("C:/");
    var f = new File(dir.fullName + "/AELocalToolkit_debug.log");
    f.open("a");
    f.writeln((new Date()).toISOString() + " " + msg);
    f.close();
  } catch (e) {}
}

(function() {
  AELocalToolkit.__loadErrors = [];
  AELocalToolkit.__moduleBase = null;

  // 本 CEP 环境下 $.fileName 返回 80（指向 AE 自身的 Support Files），无法据此
  // 定位扩展内的模块，因此模块路径必须依赖客户端从自身 URL 推导后通过
  // AELT_setModuleBase() 传入的扩展根目录。
  // 在常见 CEP 扩展目录中扫描包含 host/modules/organizer.jsx 的扩展根目录，
  // 作为客户端未提供路径（或客户端缓存未更新）时的兜底。不依赖不可靠的 $.fileName。
  function findExtensionRoot() {
    var bases = [
      "C:/Program Files (x86)/Common Files/Adobe/CEP/extensions",
      "C:/Program Files/Common Files/Adobe/CEP/extensions"
    ];
    try { bases.push(Folder.userData.fullName + "/Adobe/CEP/extensions"); } catch (e) {}
    for (var b = 0; b < bases.length; b++) {
      var extFolder = new Folder(bases[b]);
      if (!extFolder.exists) continue;
      var subs = extFolder.getFiles();
      for (var i = 0; i < subs.length; i++) {
        // 直接通过候选文件是否存在来判断，避免依赖 instanceof Folder：
        // junction / 符号链接在 ExtendScript 下 instanceof Folder 判定可能不可靠。
        var subPath;
        try { subPath = subs[i].fsName; } catch (e) { continue; }
        if (!subPath) continue;
        var candidate = new File(subPath + "/host/modules/organizer.jsx");
        if (candidate.exists) return subPath;
      }
    }
    return null;
  }

  // 通过“读取文件内容 + eval(全局作用域)”加载模块。
  // 本环境确认 $.eval 不存在；且 $.evalFile 在 directory junction 路径下会“假成功”
  // （不抛错、也未定义模块全局变量）。因此改为：先读内容，再用全局 eval 在内存中执行
  // （完全绕过文件路径，不受 junction 影响）；若 eval 不可用则写临时真实路径再 $.evalFile。
  // 任何读取/解析失败都会被捕获并记录到 loadErrors（不再“假成功”）；并校验全局是否真正定义。
  function evalModuleFile(f, name) {
    try {
      f.encoding = "UTF-8";
      if (!f.open("r")) {
        AELocalToolkit.__loadErrors.push(name + ": 无法打开 -> " + f.fsName);
        return false;
      }
      var src = f.read();
      f.close();
      if (src === null || src === undefined || String(src).length === 0) {
        AELocalToolkit.__loadErrors.push(name + ": 读取内容为空 -> " + f.fsName);
        return false;
      }
      // 执行模块代码。本环境确认 $.eval 不存在；$.evalFile 在 junction 路径下会静默失败。
      // 因此优先：把内容写入临时文件（真实路径，非 junction），再用 $.evalFile 执行——
      // $.evalFile 在全局作用域运行，且真实路径与旧版 v0.1.3（正常工作的版本）一致，最可靠。
      // 若 $.evalFile 不可用，则退回全局 eval 在内存中执行。
      if (typeof $.evalFile === "function") {
        var tmp = new File(Folder.temp.fullName + "/AELT_" + name);
        tmp.encoding = "UTF-8";
        if (tmp.open("w")) {
          tmp.write(src);
          tmp.close();
          $.evalFile(tmp);
        } else {
          throw new Error("无法写入临时文件: " + tmp.fsName);
        }
      } else if (typeof eval === "function") {
        eval(src);
      } else {
        throw new Error("eval 与 $.evalFile 均不可用");
      }
      hostLog("evalModuleFile OK: " + f.fsName);
      return true;
    } catch (e) {
      try { f.close(); } catch (c) {}
      AELocalToolkit.__loadErrors.push(name + ": eval失败 -> " + f.fsName + " / " + (e && e.toString ? e.toString() : e));
      return false;
    }
  }

  function moduleIsDefined(name) {
    if (name === "organizer.jsx") return typeof AELocalToolkit.organizer === "object";
    if (name === "expressions.jsx") return typeof AELocalToolkit.expressions === "object";
    return true;
  }

  function tryLoadModule(name) {
    var candidates = [];
    if (AELocalToolkit.__moduleBase) {
      // 直接拼接完整路径字符串，避免嵌套 Folder(parent, name) 构造器在含空格路径下解析异常
      candidates.push(new File(AELocalToolkit.__moduleBase + "/host/modules/" + name));
    }
    var found = findExtensionRoot();
    if (found) {
      candidates.push(new File(found + "/host/modules/" + name));
    }
    // 兜底：直接尝试已知扩展根目录（防止 getFiles 枚举不出 junction/symlink 导致 findExtensionRoot 返回空）
    var fallbackRoots = [
      "C:/Program Files (x86)/Common Files/Adobe/CEP/extensions/AeLocalToolkit",
      "C:/Program Files/Common Files/Adobe/CEP/extensions/AeLocalToolkit"
    ];
    try { fallbackRoots.push(Folder.userData.fullName + "/Adobe/CEP/extensions/AeLocalToolkit"); } catch (e) {}
    for (var r = 0; r < fallbackRoots.length; r++) {
      candidates.push(new File(fallbackRoots[r] + "/host/modules/" + name));
    }
    if ($.fileName && typeof $.fileName === "string") {
      candidates.push(new File(new File($.fileName).parent.fsName + "/modules/" + name));
    }
    for (var i = 0; i < candidates.length; i++) {
      var f = candidates[i];
      if (f && f.exists) {
        // 读取内容并 $.eval，并校验模块全局变量确实被定义，避免 $.evalFile 式的“假成功”。
        if (evalModuleFile(f, name) && moduleIsDefined(name)) return;
      } else if (f) {
        AELocalToolkit.__loadErrors.push(name + ": 文件不存在 -> " + f.fsName);
      }
    }
    AELocalToolkit.__loadErrors.push(name + ": 未能定位模块文件 (尝试路径=" + (AELocalToolkit.__moduleBase ? (AELocalToolkit.__moduleBase + "/host/modules/" + name) : "n/a") + ")");
  }

  function loadModules() {
    // expressions 已在 index.jsx 内联定义（始终可用），此处仅加载外部 organizer 模块，
    // 避免“静默加载失败”被内联副本掩盖、也避免外部 expressions.jsx 与内联版本分歧。
    tryLoadModule("organizer.jsx");
  }
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

  // 按需确保 organizer 模块已加载：整理入口会调用，避免客户端竞态导致模块未就绪。
  AELocalToolkit.ensureOrganizerLoaded = function () {
    if (typeof AELocalToolkit.organizer === "object") return true;
    loadModules();
    // 最后兜底：直接用客户端提供的扩展根目录读取+$.eval 模块（绕过候选列表）
    if (typeof AELocalToolkit.organizer !== "object" && AELocalToolkit.__moduleBase) {
      evalModuleFile(new File(AELocalToolkit.__moduleBase + "/host/modules/organizer.jsx"), "organizer.jsx");
    }
    hostLog("ensureOrganizerLoaded: organizer=" + (typeof AELocalToolkit.organizer) + " errors=" + AELocalToolkit.__loadErrors.join(" | "));
    return typeof AELocalToolkit.organizer === "object";
  };

  // 客户端在面板启动早期调用：传入扩展根目录并加载模块。
  AELocalToolkit.setModuleBase = function (path) {
    try {
      var raw = path;
      try { raw = unescape(path); } catch (d) { raw = path; }
      AELocalToolkit.__moduleBase = raw;
    } catch (e) {}
    loadModules();
    hostLog("setModuleBase: path=" + AELocalToolkit.__moduleBase + " organizer=" + (typeof AELocalToolkit.organizer) + " errors=" + AELocalToolkit.__loadErrors.join(" | "));
    return AELocalToolkit.returnResult({ ok: true, moduleBase: AELocalToolkit.__moduleBase, loadErrors: AELocalToolkit.__loadErrors });
  };

  // 面板打开即自动加载模块：优先用客户端传入的路径，否则扫描 CEP 扩展目录兜底。
  // 不依赖客户端调用，避免客户端缓存导致模块永不加载。
  loadModules();
  hostLog("autoLoad: organizer=" + (typeof AELocalToolkit.organizer) + " errors=" + AELocalToolkit.__loadErrors.join(" | "));
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

// ===== 设置扩展根目录并加载 host 模块（面板启动早期由客户端调用） =====
function AELT_setModuleBase(path) {
  return AELocalToolkit.setModuleBase(path);
}

// ===== AE 连接检测 =====
function AELT_ping() {
  var hostParent = "";
  try { hostParent = (new File($.fileName)).parent.fsName; } catch (e) { hostParent = "ERR:" + (e && e.toString ? e.toString() : e); }
  return AELocalToolkit.returnResult({
    ok: true,
    appVersion: app.version,
    hostFileName: $.fileName,
    hostParent: hostParent,
    moduleBase: AELocalToolkit.__moduleBase,
    organizerType: typeof AELocalToolkit.organizer,
    loadErrors: AELocalToolkit.__loadErrors || [],
    message: "Host JSX loaded [r5]"
  });
}

// ===== AE 工程整理入口（使用默认方案） =====
function AELT_organizeProject() {
  if (!AELocalToolkit.ensureOrganizerLoaded()) {
    return AELocalToolkit.returnResult({ ok: false, messages: ["错误: organizer 模块未加载，请确认面板已正确初始化。"] });
  }
  try {
    return AELocalToolkit.returnResult(AELocalToolkit.organizer.organizeProject());
  } catch (e) {
    return AELocalToolkit.returnResult({ ok: false, messages: ["organizeProject 异常: " + (e && e.toString ? e.toString() : e)] });
  }
}

// ===== AE 工程整理入口（使用指定方案） =====
function AELT_organizeProjectWithScheme(schemeJson) {
  if (!AELocalToolkit.ensureOrganizerLoaded()) {
    return AELocalToolkit.returnResult({ ok: false, messages: ["错误: organizer 模块未加载，请确认面板已正确初始化。"] });
  }
  try {
    var raw;
    try { raw = unescape(schemeJson); } catch (d) { raw = schemeJson; }
    var scheme = AELocalToolkit.parseJson(raw, null);
    return AELocalToolkit.returnResult(AELocalToolkit.organizer.organizeProjectWithScheme(scheme));
  } catch (e) {
    return AELocalToolkit.returnResult({ ok: false, messages: ["organizeProjectWithScheme 异常: " + (e && e.toString ? e.toString() : e)] });
  }
}

// ===== 加载所有整理方案列表 =====
function AELT_loadOrganizerSchemes() {
  return AELocalToolkit.returnResult(AELocalToolkit.fileStorage.listSchemes());
}

// ===== 保存整理方案 =====
function AELT_saveOrganizerScheme(schemeJson) {
  var raw;
  try { raw = unescape(schemeJson); } catch (d) { raw = schemeJson; }
  var scheme = AELocalToolkit.parseJson(raw, null);
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
