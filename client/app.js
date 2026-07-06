(function () {
  var state = {
    rules: null,
    organizerSchemes: [],
    selectedSchemeId: "preset-default",
    changelog: null,
    expressions: [],
    selectedExpressionId: null,
    debugEntries: [],
    quietMode: false,
    debugMode: false,
    scriptFolder: "",
    scripts: [],
    scriptSearch: "",
    favFilterOn: false,
    favorites: [],
    selectedScriptFsName: null
  };

  var els = {};

  var fallbackRules = {
    id: "preset-default",
    name: "默认整理方案",
    version: 1,
    builtin: true,
    fallbackFolder: "Footage",
    fallbackPath: "Footage",
    rules: [
      { path: "Comp", itemTypes: ["CompItem"], extensions: [] },
      { path: "Image", itemTypes: [], extensions: ["JPEG", "JPG", "PNG", "TIFF", "GIF", "BMP", "SWF", "EXR", "WEBP"] },
      { path: "Video", itemTypes: [], extensions: ["AVI", "MP4", "MOV", "MPEG2", "MKV", "M4V", "WEBM"] },
      { path: "Audio", itemTypes: [], extensions: ["MP3", "WAV", "AIFF", "AAC", "FLAC"] },
      { path: "PSD", itemTypes: [], extensions: ["PSD", "PSB"] },
      { path: "Live2D", itemTypes: [], extensions: ["CAE"] },
      { path: "3D", itemTypes: [], extensions: ["OBJ", "FBX", "GLTF"] },
      { path: "Solids", itemTypes: ["SolidSource"], extensions: [] },
      { path: "Footage", itemTypes: [], extensions: [] }
    ]
  };

  var fallbackExpressions = {
    version: 1,
    expressions: [
      {
        id: "wiggle-basic",
        name: "基础抖动",
        category: "常用",
        description: "为选中属性添加基础随机抖动。",
        code: "wiggle(5, 20)",
        tags: ["wiggle", "抖动", "随机"],
        builtin: true,
        favorite: false
      },
      {
        id: "loop-out-cycle",
        name: "循环关键帧",
        category: "常用",
        description: "循环播放当前属性的关键帧动画。",
        code: "loopOut(\"cycle\")",
        tags: ["loop", "循环", "关键帧"],
        builtin: true,
        favorite: false
      },
      {
        id: "time-rotation",
        name: "持续旋转",
        category: "动画",
        description: "让旋转类属性随时间持续变化。",
        code: "time * 60",
        tags: ["time", "旋转"],
        builtin: true,
        favorite: false
      },
      {
        id: "blink-opacity",
        name: "透明度闪烁",
        category: "动画",
        description: "让透明度在显示和隐藏之间闪烁。",
        code: "Math.sin(time * 10) > 0 ? 100 : 0",
        tags: ["opacity", "闪烁"],
        builtin: true,
        favorite: false
      },
      {
        id: "posterize-random",
        name: "分帧随机",
        category: "工具",
        description: "以较低频率生成随机值，适合跳动效果。",
        code: "posterizeTime(8);\nrandom(value - 20, value + 20);",
        tags: ["random", "posterizeTime"],
        builtin: true,
        favorite: false
      }
    ]
  };

 var fallbackChangelog = {
   version: "0.2.1",
   entries: [
     {
       version: "0.2.1",
       date: "2026-07-05",
       changes: [
         "新增: 脚本启动器 — 浏览和运行AE脚本",
         "新增: 脚本收藏功能 — 标记常用脚本",
         "新增: 收藏过滤开关 — 仅显示收藏脚本",
         "新增: 脚本搜索过滤 — 按名称实时筛选",
         "新增: 图标显示 — 脚本旁显示PNG图标",
         "修复: 脚本文件名中文显示乱码",
         "修复: 双击运行脚本无效",
         "修复: 图标与文字重叠",
         "优化: 脚本列表自适应窗口高度"
       ]
     },
     {
       version: "0.1.3",
       date: "2026-06-23",
       changes: [
         "修复: 修改默认整理方案规则后自动创建新方案并保留默认方案。",
         "重构: Host 模块拆分 — organizer 和 expressions 逻辑移至 host/modules/。",
         "新增: 设置页面 — 安静模式开关。",
         "新增: 自定义表达式编辑功能。",
         "修复: 表达式选中自定义表达式时显示更新表达式按钮。"
       ]
     },
     {
       version: "0.1.2",
       date: "2026-06-23",
       changes: [
         "修复：编辑默认方案不再自动创建新方案ID。",
         "修复：保存默认方案时才创建新ID，原预设保留不变。",
         "修复：切换回默认方案时自动恢复原始规则。",
         "新增：Toast 通知系统，操作成功/失败顶部提示。",
         "新增：更新日志弹窗，点击版本号查看。",
         "新增：表达式管理改为下拉选择，更紧凑。",
         "新增：整理模块 UI 紧凑布局，勾选框控制文件类型与 AE 类型。",
         "新增：整理规则列表内部滚动，默认显示3条。",
         "修复：各类错误提示（预设删除、重复类型、表达式等）。"
       ]
     },
     {
       version: "0.1.1",
       date: "2026-06-22",
       changes: [
         "加入内置默认数据兜底，避免 CEP 无法读取本地 JSON 时面板启动失败。",
         "修复自定义表达式在数据加载失败后无法恢复显示的问题。",
         "Debug 页加入本地存储检测按钮。",
         "表达式保存和删除加入存储读写日志。"
       ]
     },
     {
       version: "0.1.0",
       date: "2026-06-22",
       changes: [
         "创建 AE Local Toolkit 初始项目结构。",
         "加入工程整理预制规则。",
         "加入表达式管理第一版功能规划。",
         "加入本地更新日志数据结构。"
       ]
     }
   ]
 };

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(message) {
   els.statusBar.textContent = message;
   addDebug("status", message);
 }

 function showToast(message, type) {
   var container = document.getElementById("toastContainer");
   if (!container) return;
   var toast = document.createElement("div");
   toast.className = "toast" + (type === "error" ? " error" : type === "success" ? " success" : "");
   toast.textContent = message;
   container.appendChild(toast);
   setTimeout(function () {
     toast.classList.add("out");
     setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
   }, 1000);
 }

 function addDebug(type, detail) {
    var time = new Date().toLocaleTimeString();
    state.debugEntries.unshift({
      time: time,
      type: type,
      detail: typeof detail === "string" ? detail : JSON.stringify(detail, null, 2)
    });
    if (state.debugEntries.length > 80) state.debugEntries.length = 80;
    renderDebug();
  }

  function renderDebug() {
    if (!els.debugLog) return;
    els.debugLog.innerHTML = state.debugEntries.map(function (entry) {
      return '<div class="debug-item"><strong>[' + entry.time + '] ' + entry.type + '</strong>\n' + entry.detail + '</div>';
    }).join("") || '<div class="selection-status">暂无 Debug 信息</div>';
  }

  function escapeForEvalScript(value) {
    return String(value)
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\r/g, "\\r")
      .replace(/\n/g, "\\n");
  }

  function evalAe(script, callback) {
    addDebug("evalScript", script);
    if (window.__adobe_cep__ && window.__adobe_cep__.evalScript) {
      window.__adobe_cep__.evalScript(script, function (raw) {
        var data = null;
        addDebug("raw return", raw === "" ? "(empty string)" : raw);
        try {
          data = JSON.parse(raw);
        } catch (e) {
          data = { ok: false, messages: ["AE 返回结果解析失败。", String(raw)] };
        }
        addDebug("parsed return", data);
        callback(data);
      });
      return;
    }

    callback({
      ok: false,
      messages: ["当前不在 AE CEP 环境中，无法执行 AE 操作。"]
    });
  }

  function cloneData(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadJson(path, fallback) {
    return new Promise(function (resolve) {
      if (!window.fetch) {
        addDebug("data fallback", path + " fetch unavailable");
        resolve(cloneData(fallback));
        return;
      }

      fetch(path).then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      }).then(function (data) {
        addDebug("data loaded", path);
        resolve(data);
      }).catch(function (error) {
        addDebug("data fallback", path + " / " + error.toString());
        resolve(cloneData(fallback));
      });
    });
  }

  function getUserExpressions() {
    try {
      var raw = localStorage.getItem("aelt.userExpressions") || "[]";
      var items = JSON.parse(raw);
      if (!(items instanceof Array)) return [];
      addDebug("storage read", "读取自定义表达式 " + items.length + " 条");
      return items;
    } catch (e) {
      addDebug("storage read failed", e.toString());
      return [];
    }
  }

  function setUserExpressions(items) {
    try {
      localStorage.setItem("aelt.userExpressions", JSON.stringify(items));
      addDebug("storage write", "保存自定义表达式 " + items.length + " 条");
      return true;
    } catch (e) {
      addDebug("storage write failed", e.toString());
      return false;
    }
  }

  function confirmAction(message) {
    if (state.quietMode) return true;
    return window.confirm(message);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function createId(prefix) {
    return prefix + "-" + Date.now() + "-" + Math.floor(Math.random() * 10000);
  }

  function normalizePath(value) {
    return String(value || "")
      .replace(/\\/g, "/")
      .split("/")
      .map(function (part) { return part.trim(); })
      .filter(Boolean)
      .join("/");
  }

  function normalizeExtensions(value) {
    if (value instanceof Array) {
      return value.map(function (ext) {
        return String(ext || "").trim().replace(/^\./, "").toUpperCase();
      }).filter(Boolean);
    }

    return String(value || "")
      .split(/[,，\s]+/)
      .map(function (ext) { return ext.trim().replace(/^\./, "").toUpperCase(); })
      .filter(Boolean);
  }

  function normalizeItemTypes(value) {
    if (value instanceof Array) {
      return value.map(function (type) {
        return String(type || "").trim();
      }).filter(Boolean);
    }

    return String(value || "")
      .split(/[,，\s]+/)
      .map(function (type) { return type.trim(); })
      .filter(Boolean);
  }

  function normalizeScheme(raw) {
    var scheme = cloneData(raw || fallbackRules);

    if (scheme.folders && !scheme.rules) {
      scheme.rules = scheme.folders.map(function (folder) {
        return {
          path: folder.path || folder.name,
          itemTypes: folder.itemTypes || [],
          extensions: folder.extensions || []
        };
      });
    }

    scheme.id = scheme.id || createId("scheme");
    scheme.name = scheme.name || "整理方案";
    scheme.fallbackPath = normalizePath(scheme.fallbackPath || scheme.fallbackFolder || "Footage");
    scheme.rules = (scheme.rules || []).map(function (rule) {
      return {
        path: normalizePath(rule.path || rule.name),
        itemTypes: normalizeItemTypes(rule.itemTypes || []),
        extensions: normalizeExtensions(rule.extensions || [])
      };
    }).filter(function (rule) {
      return rule.path;
    });
    return scheme;
  }

  function getSelectedScheme() {
    for (var i = 0; i < state.organizerSchemes.length; i++) {
      if (state.organizerSchemes[i].id === state.selectedSchemeId) {
        return state.organizerSchemes[i];
      }
    }
    return state.organizerSchemes[0] || normalizeScheme(fallbackRules);
  }

  function getSchemeFromEditor() {
    var current = getSelectedScheme();
    var rules = [];
    var cards = els.ruleGrid.querySelectorAll("[data-rule-index]");
    for (var i = 0; i < cards.length; i++) {
      var pathInput = cards[i].querySelector("[data-rule-path]");
      var extensionsInput = cards[i].querySelector("[data-rule-extensions]");
      var itemTypesInput = cards[i].querySelector("[data-rule-item-types]");
      rules.push({
        path: normalizePath(pathInput.value),
        itemTypes: normalizeItemTypes(itemTypesInput.value),
        extensions: normalizeExtensions(extensionsInput.value)
      });
    }

   return normalizeScheme({
     id: current.id,
     name: els.schemeNameInput.value.trim() || "整理方案",
      builtin: false,
      fallbackPath: normalizePath(els.fallbackPathInput.value || "Footage"),
      rules: rules
    });
  }

  function validateScheme(scheme) {
    var seen = {};
    var seenItemTypes = {};
    var duplicates = [];
    var duplicateItemTypes = [];
    var invalidRules = [];

    scheme.rules.forEach(function (rule, ruleIndex) {
      if (!rule.path) invalidRules.push(ruleIndex + 1);
      rule.extensions.forEach(function (ext) {
        if (seen[ext]) {
          duplicates.push(ext);
        } else {
          seen[ext] = rule.path;
        }
      });
      rule.itemTypes.forEach(function (itemType) {
        if (seenItemTypes[itemType]) {
          duplicateItemTypes.push(itemType);
        } else {
          seenItemTypes[itemType] = rule.path;
        }
      });
    });

    if (invalidRules.length) {
      return { ok: false, message: "有规则缺少文件夹路径。" };
    }
    if (duplicates.length) {
      return { ok: false, message: "文件类型不能重复：" + duplicates.join(", ") };
    }
    if (duplicateItemTypes.length) {
      return { ok: false, message: "AE 类型不能重复：" + duplicateItemTypes.join(", ") };
    }
    return { ok: true, message: "" };
  }

  function renderSchemeSelect() {
    els.schemeSelect.innerHTML = state.organizerSchemes.map(function (scheme) {
      var selected = scheme.id === state.selectedSchemeId ? " selected" : "";
      var label = scheme.name + (scheme.builtin ? " · 预设" : "");
      return '<option value="' + escapeHtml(scheme.id) + '"' + selected + ">" + escapeHtml(label) + "</option>";
    }).join("");
  }

  function renderRules() {
    var scheme = getSelectedScheme();
    state.selectedSchemeId = scheme.id;
    els.schemeNameInput.value = scheme.name || "";
    els.fallbackPathInput.value = scheme.fallbackPath || "Footage";
    renderSchemeSelect();

    var html = "";
    scheme.rules.forEach(function (rule, index) {
      var itemTypes = (rule.itemTypes || []).map(function (t) { return String(t).trim(); }).filter(Boolean);
      var hasExt = (rule.extensions || []).length > 0;
      var hasTypes = itemTypes.length > 0;
      var hasComp = itemTypes.indexOf("CompItem") >= 0;
      var hasSolid = itemTypes.indexOf("SolidSource") >= 0;

      html += '<div class="rule-item" data-rule-index="' + index + '">';

      // Header row
      html += '<div class="rule-header">';
      html += '<label class="field"><span>文件夹路径</span><input data-rule-path type="text" value="' + escapeHtml(rule.path) + '" placeholder="Footage/Image" /></label>';
      html += '<button class="icon-btn danger" data-remove-rule="' + index + '" title="删除规则">\u2716</button>';
      html += '</div>';

      // Side-by-side criteria
      html += '<div class="rule-criteria-row">';

      // File types column
      html += '<div class="rule-criterion">';
      html += '<label class="checkbox-row"><input type="checkbox" data-toggle-extensions' + (hasExt ? ' checked' : '') + ' /><span>文件类型</span></label>';
      html += '<div class="rule-section" data-extensions-section' + (hasExt ? '' : ' style="display:none"') + '>';
      html += '<input data-rule-extensions type="text" value="' + escapeHtml((rule.extensions || []).join(", ")) + '" placeholder="MP4, MOV, PNG" />';
      html += '</div>';
      html += '</div>';

      // AE types column
      html += '<div class="rule-criterion">';
      html += '<label class="checkbox-row"><input type="checkbox" data-toggle-item-types' + (hasTypes ? ' checked' : '') + ' /><span>AE内部项目</span></label>';
      html += '<div class="rule-section" data-item-types-section' + (hasTypes ? '' : ' style="display:none"') + '>';
      html += '<label class="check-label"><input type="checkbox" data-item-type value="CompItem"' + (hasComp ? ' checked' : '') + ' /> 合成</label>';
      html += '<label class="check-label"><input type="checkbox" data-item-type value="SolidSource"' + (hasSolid ? ' checked' : '') + ' /> 固态层</label>';
      html += '<input data-rule-item-types type="hidden" value="' + escapeHtml(itemTypes.join(", ")) + '" />';
      html += '</div>';
      html += '</div>';

      html += '</div>';  // end criteria-row
      html += '</div>';  // end rule-item
    });
    els.ruleGrid.innerHTML = html || '<div class="selection-status">暂无规则</div>';

    // Toggle sections
    var toggles = els.ruleGrid.querySelectorAll("[data-toggle-extensions], [data-toggle-item-types]");
    for (var ti = 0; ti < toggles.length; ti++) {
      toggles[ti].addEventListener("change", function () {
        var isExt = this.hasAttribute("data-toggle-extensions");
        var sec = this.closest(".rule-item").querySelector(isExt ? "[data-extensions-section]" : "[data-item-types-section]");
        if (sec) sec.style.display = this.checked ? "block" : "none";
        if (!this.checked) {
          var inp = sec.querySelector(isExt ? "[data-rule-extensions]" : "[data-rule-item-types]");
          if (inp) inp.value = "";
        }
      });
    }

    // Sync type checkboxes with hidden input
    var typeCbs = els.ruleGrid.querySelectorAll("[data-item-type]");
    for (var ci = 0; ci < typeCbs.length; ci++) {
      typeCbs[ci].addEventListener("change", function () {
        var sec = this.closest("[data-item-types-section]");
        if (!sec) return;
        var hid = sec.querySelector("[data-rule-item-types]");
        if (!hid) return;
        var chk = sec.querySelectorAll("[data-item-type]:checked");
        var vals = [];
        for (var vi = 0; vi < chk.length; vi++) vals.push(chk[vi].value);
        hid.value = vals.join(", ");
      });
    }
  }

  function loadOrganizerSchemesFromHost() {
    evalAe("AELT_loadOrganizerSchemes()", function (result) {
      if (result.ok && result.schemes && result.schemes.length) {
        state.organizerSchemes = result.schemes.map(normalizeScheme);
        if (!state.organizerSchemes.some(function (scheme) { return scheme.id === state.selectedSchemeId; })) {
          state.selectedSchemeId = state.organizerSchemes[0].id;
        }
        renderRules();
        setStatus("已加载整理方案 " + state.organizerSchemes.length + " 套。");
      } else {
        state.organizerSchemes = [normalizeScheme(fallbackRules)];
        state.selectedSchemeId = "preset-default";
        renderRules();
        setStatus("整理方案文件读取失败，已使用内置预设。");
      }
    });
  }

 function renderExpressions() {
   var query = els.expressionSearch.value.trim().toLowerCase();
   var html = '<select class="expression-select">';
   html += '<option value="">-- 选择表达式 --</option>';
   state.expressions
     .filter(function (item) {
       var haystack = [item.name, item.category, item.description, (item.tags || []).join(" ")].join(" ").toLowerCase();
       return !query || haystack.indexOf(query) >= 0;
     })
     .forEach(function (item) {
       var selected = item.id === state.selectedExpressionId ? " selected" : "";
       html += '<option value="' + escapeHtml(item.id) + '"' + selected + ">" + escapeHtml(item.name + " · " + item.category) + "</option>";
     });
   html += "</select>";
   els.expressionList.innerHTML = html || '<div class="selection-status">没有匹配的表达式</div>';
   var sel = els.expressionList.querySelector("select");
   if (sel) sel.onchange = function () {
     var id = this.value;
     if (!id) { state.selectedExpressionId = null; els.expressionCode.value = ""; if (els.updateExpressionBtn) els.updateExpressionBtn.style.display = "none"; return; }
     var found = state.expressions.find(function (item) { return item.id === id; });
     if (!found) return;
     state.selectedExpressionId = id;
     els.expressionCode.value = found.code;
      if (els.updateExpressionBtn) {
        els.updateExpressionBtn.style.display = found.builtin ? "none" : "";
      }
   };
 }

 function syncDebugTabVisibility() {
    var debugTab = document.querySelector('.tab[data-view="debug"]');
    var debugView = document.getElementById("debugView");
    if (!debugTab || !debugView) return;
    if (state.debugMode) {
      debugTab.style.display = "";
    } else {
      debugTab.style.display = "none";
      if (debugView.classList.contains("active")) {
        var orgTab = document.querySelector('.tab[data-view="organizer"]');
        if (orgTab) orgTab.click();
      }
      debugView.classList.remove("active");
    }
    var visibleTabs = document.querySelectorAll('.tab:not([style*="display: none"])').length;
    var tabsEl = document.querySelector(".tabs");
    if (tabsEl && visibleTabs > 0) tabsEl.style.gridTemplateColumns = "repeat(" + visibleTabs + ", 1fr)";
  }

  function loadSettings() {
    try {
      var value = localStorage.getItem("aelt.quietMode");
      state.quietMode = value === "true";
      if (els.quietModeToggle) els.quietModeToggle.checked = state.quietMode;
    } catch (e) {}
    try {
      var debugVal = localStorage.getItem("aelt.debugMode");
      state.debugMode = debugVal === "true";
      if (els.debugModeToggle) els.debugModeToggle.checked = state.debugMode;
    } catch (e) {}
    syncDebugTabVisibility();
  }

  function renderChangelog() {
   els.versionLabel.textContent = state.changelog.version;
   els.versionLabel.style.cursor = "pointer";
   els.versionLabel.title = "更新日志";
   els.versionLabel.onclick = showChangelog;
   addDebug("changelog", state.changelog);
 }

 function showChangelog() {
   var modal = document.getElementById("changelogModal");
   var body = document.getElementById("changelogBody");
   if (!modal || !body) return;
   var entries = state.changelog.entries || [];
   body.innerHTML = entries.map(function (entry) {
     return '<div class="changelog-item"><strong>v' + entry.version + '</strong> <span class="muted">' + entry.date + '</span><ul>' +
       (entry.changes || []).map(function (c) { return "<li>" + escapeHtml(c) + "</li>"; }).join("") + "</ul></div>";
   }).join("") || '<p class="muted">暂无更新日志</p>';
   modal.style.display = "flex";
   var closeBtn = document.getElementById("closeChangelogBtn");
   if (closeBtn) closeBtn.onclick = hideChangelog;
   modal.onclick = function (e) { if (e.target === this) hideChangelog(); };
 }

 function hideChangelog() {
   var modal = document.getElementById("changelogModal");
   if (modal) modal.style.display = "none";
 }

 function refreshSelection() {
    evalAe("AELT_getSelectedPropertySummary()", function (result) {
      if (!result.ok) {
        els.selectionStatus.textContent = result.messages.join(" ");
        return;
      }
      els.selectionStatus.textContent = "已选择 " + result.total + " 个属性，已有表达式 " + result.existing + " 个，不支持 " + result.skipped + " 个。";
    });
  }

 function organizeProject() {
   var scheme = getSchemeFromEditor();
   var validation = validateScheme(scheme);
   if (!validation.ok) {
     setStatus(validation.message);
     showToast(validation.message, "error");
     return;
   }

    setStatus("正在整理工程：" + scheme.name);
    var script = "AELT_organizeProjectWithScheme('" + escapeForEvalScript(JSON.stringify(scheme)) + "')";
    evalAe(script, function (result) {
      if (!result.ok) {
        setStatus((result.messages && result.messages[0]) || "整理失败。");
        return;
      }
      setStatus("整理完成：移动 " + result.moved + " 项，跳过 " + result.skipped + " 项，错误 " + result.errors + " 个。");
      showToast("整理完成：移动 " + result.moved + " 项", "success");
    });
  }

  function newScheme() {
    var scheme = normalizeScheme({
   id: createId("scheme"),
   name: "新的整理方案",
   builtin: false,
      fallbackPath: "Footage",
      rules: [
        { path: "Footage/Image", itemTypes: [], extensions: ["PNG", "JPG", "JPEG"] },
        { path: "Footage/Video", itemTypes: [], extensions: ["MP4", "MOV"] }
      ]
    });
    state.organizerSchemes.push(scheme);
    state.selectedSchemeId = scheme.id;
    renderRules();
    setStatus("已创建新方案，保存后会写入方案文件。");
      showToast("已创建新方案", "success");
  }

 function saveScheme() {
   var scheme = getSchemeFromEditor();
   if (scheme.id === "preset-default") {
     scheme.id = createId("scheme");
   }
   var validation = validateScheme(scheme);
    if (!validation.ok) {
      setStatus(validation.message);
      showToast(validation.message, "error");
      return;
    }

    var script = "AELT_saveOrganizerScheme('" + escapeForEvalScript(JSON.stringify(scheme)) + "')";
    evalAe(script, function (result) {
      if (!result.ok) {
        setStatus((result.messages && result.messages[0]) || "方案保存失败。");
        return;
      }

      var replaced = false;
      for (var i = 0; i < state.organizerSchemes.length; i++) {
        if (state.organizerSchemes[i].id === scheme.id) {
          state.organizerSchemes[i] = scheme;
          replaced = true;
          break;
        }
      }
      if (!replaced) state.organizerSchemes.push(scheme);
      state.selectedSchemeId = scheme.id;
      renderRules();
      setStatus("方案已保存：" + scheme.name);
      showToast("方案已保存", "success");
    });
  }

  function deleteScheme() {
    var scheme = getSelectedScheme();
    if (scheme.builtin) {
      setStatus("预设方案不能删除。");
      showToast("预设方案不能删除", "error");
      return;
    }
    if (!confirmAction("确认删除整理方案“" + scheme.name + "”？")) return;

    evalAe("AELT_deleteOrganizerScheme('" + escapeForEvalScript(scheme.id) + "')", function (result) {
      if (!result.ok) {
        setStatus((result.messages && result.messages[0]) || "方案删除失败。");
        return;
      }
      state.organizerSchemes = state.organizerSchemes.filter(function (item) {
        return item.id !== scheme.id;
      });
      state.selectedSchemeId = state.organizerSchemes[0] ? state.organizerSchemes[0].id : "preset-default";
      renderRules();
      setStatus("方案已删除。");
      showToast("方案已删除", "success");
    });
  }

  function addRule() {
   var scheme = getSchemeFromEditor();
    if (scheme.id === "preset-default") {
      var newScheme = normalizeScheme({
        id: createId("scheme"),
        name: "新的整理方案",
        builtin: false,
        fallbackPath: scheme.fallbackPath || "Footage",
        rules: JSON.parse(JSON.stringify(scheme.rules))
      });
      newScheme.rules.push({ path: "Footage/New Folder", itemTypes: [], extensions: [] });
      state.organizerSchemes.push(newScheme);
      state.selectedSchemeId = newScheme.id;
      renderRules();
      return;
    }
   scheme.rules.push({ path: "Footage/New Folder", itemTypes: [], extensions: [] });
    replaceOrAppendScheme(scheme);
    state.selectedSchemeId = scheme.id;
    renderRules();
  }

  function replaceOrAppendScheme(scheme) {
    for (var i = 0; i < state.organizerSchemes.length; i++) {
      if (state.organizerSchemes[i].id === scheme.id) {
        state.organizerSchemes[i] = scheme;
        return;
      }
    }
    state.organizerSchemes.push(scheme);
  }

  function applyExpression() {
    var expression = els.expressionCode.value;
    if (!expression.trim()) {
      setStatus("表达式内容为空。");
      return;
    }

    evalAe("AELT_getSelectedPropertySummary()", function (summary) {
      if (!summary.ok) {
        setStatus(summary.messages.join(" "));
        return;
      }

      var overwrite = true;
      if (summary.existing > 0) {
        overwrite = confirmAction("检测到 " + summary.existing + " 个属性已有表达式，是否覆盖？");
      }
      if (!overwrite) {
        setStatus("已取消应用表达式。");
        return;
      }

      var script = "AELT_applyExpression('" + escapeForEvalScript(expression) + "', true)";
      evalAe(script, function (result) {
        setStatus("已应用 " + result.applied + " 个属性，跳过 " + result.skipped + " 个，错误 " + result.errors + " 个。");
        showToast("已应用表达式到 " + result.applied + " 个属性", "success");
        refreshSelection();
      });
    });
  }

  function removeExpressions() {
    if (!confirmAction("确认移除选中属性上的表达式？")) {
      setStatus("已取消移除表达式。");
      return;
    }

    evalAe("AELT_removeExpressions()", function (result) {
      if (!result.ok) {
        setStatus(result.messages.join(" "));
        return;
      }
      setStatus("已移除 " + result.removed + " 个表达式，跳过 " + result.skipped + " 个，错误 " + result.errors + " 个。");
      showToast("已移除 " + result.removed + " 个表达式", "success");
      refreshSelection();
    });
  }

  function pingHost() {
    evalAe("AELT_ping()", function (result) {
      if (result.ok) {
        setStatus("AE host 已连接：" + result.appVersion);
        showToast("AE host 已连接", "success");
      } else {
        setStatus("AE host 检测失败。");
        showToast("AE host 检测失败", "error");
      }
    });
  }

  function testStorage() {
    try {
      var key = "aelt.storageTest";
      var value = "ok-" + Date.now();
      localStorage.setItem(key, value);
      var stored = localStorage.getItem(key);
      localStorage.removeItem(key);
      if (stored === value) {
        setStatus("本地存储可用。");
      showToast("本地存储可用", "success");
      } else {
        setStatus("本地存储读取结果异常。");
      showToast("本地存储读取结果异常", "error");
      }
      addDebug("storage test", { written: value, read: stored });
    } catch (e) {
      setStatus("本地存储不可用。");
      showToast("本地存储不可用", "error");
      addDebug("storage test failed", e.toString());
    }
  }

  function saveExpression() {
    var code = els.expressionCode.value.trim();
    if (!code) {
      setStatus("表达式内容为空。");
      return;
    }

    var name = window.prompt("表达式名称", "自定义表达式");
    if (!name) return;

    var items = getUserExpressions();
    var item = {
      id: "user-" + Date.now(),
      name: name,
      category: "自定义",
      description: "用户保存的本地表达式。",
      code: code,
      tags: ["自定义"],
      builtin: false,
      favorite: false
    };

    items.push(item);
    if (!setUserExpressions(items)) {
      setStatus("保存失败：当前 CEP 本地存储不可用。");
      showToast("保存失败", "error");
      return;
    }
    state.expressions.push(item);
    state.selectedExpressionId = item.id;
    renderExpressions();
    setStatus("已保存到本地表达式库。");
      showToast("表达式已保存", "success");
  }

  function deleteExpression() {
    if (!state.selectedExpressionId) {
      setStatus("请先选择一个自定义表达式。");
      showToast("请先选择一个自定义表达式", "error");
      return;
    }

    var selected = state.expressions.find(function (item) {
      return item.id === state.selectedExpressionId;
    });

    if (!selected || selected.builtin) {
      setStatus("内置表达式不能删除。");
      showToast("内置表达式不能删除", "error");
      return;
    }

    if (!confirmAction("确认删除这个自定义表达式？")) return;

    var next = getUserExpressions().filter(function (item) {
      return item.id !== state.selectedExpressionId;
    });
    if (!setUserExpressions(next)) {
      setStatus("删除失败：当前 CEP 本地存储不可用。");
      showToast("删除失败", "error");
      return;
    }
    state.expressions = state.expressions.filter(function (item) {
      return item.id !== state.selectedExpressionId;
    });
    state.selectedExpressionId = null;
    els.expressionCode.value = "";
    renderExpressions();
    setStatus("已删除自定义表达式。");
      showToast("自定义表达式已删除", "success");
  }

  function updateExpression() {
    if (!state.selectedExpressionId) {
      setStatus("请先选择一个自定义表达式。");
      showToast("请先选择一个自定义表达式", "error");
      return;
    }
    var selected = state.expressions.find(function (item) {
      return item.id === state.selectedExpressionId;
    });
    if (!selected || selected.builtin) {
      setStatus("内置表达式不能编辑。");
      showToast("内置表达式不能编辑", "error");
      return;
    }
    var code = els.expressionCode.value.trim();
    if (!code) {
      setStatus("表达式内容为空。");
      return;
    }
    var name = window.prompt("表达式名称?", selected.name);
    if (!name) return;
    selected.name = name;
    selected.code = code;
    var userItems = getUserExpressions();
    for (var i = 0; i < userItems.length; i++) {
      if (userItems[i].id === state.selectedExpressionId) {
        userItems[i] = selected;
        break;
      }
    }
    if (!setUserExpressions(userItems)) {
      setStatus("保存失败：当前 CEP 本地存储不可用。");
      showToast("保存失败", "error");
      return;
    }
    renderExpressions();
    setStatus("表达式已更新。");
    showToast("表达式已更新", "success");
  }

  function bindEvents() {
    document.querySelectorAll(".tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        document.querySelectorAll(".tab").forEach(function (item) { item.classList.remove("active"); });
        document.querySelectorAll(".view").forEach(function (item) { item.classList.remove("active"); });
        tab.classList.add("active");
        $(tab.dataset.view + "View").classList.add("active");
      });
    });

    els.organizeBtn.addEventListener("click", organizeProject);
   els.schemeSelect.addEventListener("change", function () {
     var newId = els.schemeSelect.value;
     if (newId === "preset-default") {
       for (var si = 0; si < state.organizerSchemes.length; si++) {
         if (state.organizerSchemes[si].id === "preset-default") {
           state.organizerSchemes[si] = cloneData(fallbackRules);
           break;
         }
       }
     }
     state.selectedSchemeId = newId;
     renderRules();
   });
    els.newSchemeBtn.addEventListener("click", newScheme);
    els.saveSchemeBtn.addEventListener("click", saveScheme);
    els.deleteSchemeBtn.addEventListener("click", deleteScheme);
    els.addRuleBtn.addEventListener("click", addRule);
    els.ruleGrid.addEventListener("click", function (event) {
      var button = event.target.closest("[data-remove-rule]");
      if (!button) return;
      var index = parseInt(button.getAttribute("data-remove-rule"), 10);
     var scheme = getSchemeFromEditor();
      if (scheme.id === "preset-default") {
        var newScheme = normalizeScheme({
          id: createId("scheme"),
          name: "新的整理方案",
          builtin: false,
          fallbackPath: scheme.fallbackPath || "Footage",
          rules: JSON.parse(JSON.stringify(scheme.rules))
        });
        newScheme.rules.splice(index, 1);
        state.organizerSchemes.push(newScheme);
        state.selectedSchemeId = newScheme.id;
        renderRules();
        return;
      }
     scheme.rules.splice(index, 1);
      replaceOrAppendScheme(scheme);
      renderRules();
    });
    els.refreshSelectionBtn.addEventListener("click", refreshSelection);
    els.applyExpressionBtn.addEventListener("click", applyExpression);
    els.removeExpressionBtn.addEventListener("click", removeExpressions);
    els.saveExpressionBtn.addEventListener("click", saveExpression);
    els.deleteExpressionBtn.addEventListener("click", deleteExpression);
    els.pingHostBtn.addEventListener("click", pingHost);
    els.testStorageBtn.addEventListener("click", testStorage);
    els.updateExpressionBtn.addEventListener("click", updateExpression);
    els.debugModeToggle.addEventListener("change", function () {
      state.debugMode = els.debugModeToggle.checked;
      try { localStorage.setItem("aelt.debugMode", state.debugMode ? "true" : "false"); } catch (e) {}
      syncDebugTabVisibility();
    });
    els.quietModeToggle.addEventListener("change", function () {
      state.quietMode = els.quietModeToggle.checked;
      try { localStorage.setItem("aelt.quietMode", state.quietMode ? "true" : "false"); } catch (e) {}
    syncDebugTabVisibility();
    });
    els.clearDebugBtn.addEventListener("click", function () {
      state.debugEntries = [];
      renderDebug();
      els.statusBar.textContent = "Debug 已清空";
    });
    els.expressionSearch.addEventListener("input", renderExpressions);

    els.expressionList.addEventListener("click", function (event) {
      var button = event.target.closest("[data-expression-id]");
      if (!button) return;
      var id = button.getAttribute("data-expression-id");
      var selected = state.expressions.find(function (item) { return item.id === id; });
      if (!selected) return;
      state.selectedExpressionId = id;
      els.expressionCode.value = selected.code;
      renderExpressions();
    });
  }

  function cacheEls() {
    [
      "versionLabel",
      "statusBar",
      "ruleGrid",
      "organizeBtn",
      "schemeSelect",
      "newSchemeBtn",
      "saveSchemeBtn",
      "deleteSchemeBtn",
      "schemeNameInput",
      "fallbackPathInput",
      "addRuleBtn",
      "refreshSelectionBtn",
      "selectionStatus",
      "expressionSearch",
      "expressionList",
      "expressionCode",
      "applyExpressionBtn",
      "removeExpressionBtn",
      "saveExpressionBtn",
      "deleteExpressionBtn",
      "pingHostBtn",
      "testStorageBtn",
      "clearDebugBtn",
      "updateExpressionBtn",
      "quietModeToggle",
      "debugModeToggle",
      "debugLog",
      "scriptFolderBtn",
      "refreshScriptsBtn",
      "scriptFolderStatus",
      "scriptSearch",
      "favFilterBtn",
      "scriptList"
    ].forEach(function (id) {
      els[id] = $(id);
    });
  }

  function init() {
    cacheEls();
    bindEvents();

    Promise.all([
      loadJson("../data/organizer-rules.json", fallbackRules),
      loadJson("../data/default-expressions.json", fallbackExpressions),
      loadJson("../data/changelog.json", fallbackChangelog)
    ]).then(function (results) {
      state.rules = normalizeScheme(results[0]);
      state.organizerSchemes = [state.rules];
      state.selectedSchemeId = state.rules.id;
      state.expressions = results[1].expressions.concat(getUserExpressions());
      state.changelog = results[2];
      renderRules();
      renderExpressions();
      renderChangelog();
      loadSettings();
      pingHost();
      loadOrganizerSchemesFromHost();
      refreshSelection();
    }).catch(function () {
      state.rules = normalizeScheme(fallbackRules);
      state.organizerSchemes = [state.rules];
      state.selectedSchemeId = state.rules.id;
      state.expressions = cloneData(fallbackExpressions).expressions.concat(getUserExpressions());
      state.changelog = cloneData(fallbackChangelog);
      renderRules();
      renderExpressions();
      renderChangelog();
      loadSettings();
      setStatus("已使用内置数据启动。");
      pingHost();
      refreshSelection();
    });
  }

  document.addEventListener("DOMContentLoaded", init);

// ---- Script Launcher ----

function getScriptFavorites() {
  try { return JSON.parse(localStorage.getItem("aelt.scriptFavorites") || "[]") || []; }
  catch (e) { return []; }
}

function setScriptFavorites(favs) {
  try { localStorage.setItem("aelt.scriptFavorites", JSON.stringify(favs)); return true; }
  catch (e) { return false; }
}

function selectScriptFolder() {
  evalAe("AELT_selectScriptFolder()", function (result) {
    if (result.ok && result.path) {
      state.scriptFolder = result.path;
      try { localStorage.setItem("aelt.scriptFolder", result.path); } catch (e) {}
      els.scriptFolderStatus.textContent = result.path;
      scanScripts();
    }
  });
}

function scanScripts() {
  if (!state.scriptFolder) {
    setStatus("\u8bf7\u5148\u9009\u62e9\u811a\u672c\u6587\u4ef6\u5939");
    return;
  }
  setStatus("\u626b\u63cf\u4e2d: " + state.scriptFolder);
  els.scriptFolderStatus.textContent = state.scriptFolder;
  evalAe("AELT_scanScripts('" + escapeForEvalScript(state.scriptFolder) + "')", function (result) {
    if (!result.ok || !result.scripts) {
      setStatus((result.messages && result.messages[0]) || "\u626b\u63cf\u5931\u8d25");
      return;
    }
    state.scripts = result.scripts;
    state.selectedScriptFsName = null;
    setStatus("\u5df2\u52a0\u8f7d " + state.scripts.length + " \u4e2a\u811a\u672c");
    renderScripts();
  });
}

function renderScripts() {
  var query = els.scriptSearch.value.trim().toLowerCase();
  var favs = getScriptFavorites();
  var filtered = state.scripts;
  if (state.favFilterOn) {
    filtered = filtered.filter(function (s) { return favs.indexOf(s.fsName) >= 0; });
  }
  if (query) {
    filtered = filtered.filter(function (s) {
      return s.name.toLowerCase().indexOf(query) >= 0 || s.relativePath.toLowerCase().indexOf(query) >= 0;
    });
  }
  var html = "";
  for (var i = 0; i < filtered.length; i++) {
    var s = filtered[i];
    var isFav = favs.indexOf(s.fsName) >= 0;
    var selected = s.fsName === state.selectedScriptFsName ? ' active' : '';
    html += '<div class="script-item' + selected + '" data-url="' + escapeHtml(encodeURI(s.fsName)) + '" data-fsname="' + escapeHtml(s.fsName) + '">';
    html += '<span class="script-fav' + (isFav ? ' favored' : '') + '" data-fsname="' + escapeHtml(s.fsName) + '">' + (isFav ? '\u2605' : '\u2606') + '</span>';
    if (s.iconPath) {
      html += '<span class="script-icon" style="width:auto"><img class="script-icon-img" src="' + escapeHtml(s.iconPath) + '" /></span>';
    } else {
      html += '<span class="script-icon hidden"></span>';
    }
    html += '<span class="script-name">' + escapeHtml(s.name) + '</span>';
    if (s.relativePath.indexOf("\\") >= 0 || s.relativePath.indexOf("/") >= 0) {
      var folderPart = s.relativePath.substr(0, s.relativePath.length - s.relativePath.replace(/^.*[\\\/]/, "").length);
      html += '<span class="script-folder">' + escapeHtml(folderPart) + '</span>';
    }
    html += '</div>';
  }
  els.scriptList.innerHTML = html || '<div class="selection-status">\u6ca1\u6709\u5339\u914d\u7684\u811a\u672c</div>';
  var items = els.scriptList.querySelectorAll(".script-item");
  for (var i = 0; i < items.length; i++) {
    items[i].ondblclick = function() {
      state.selectedScriptFsName = this.getAttribute("data-url");
      launchScript();
    };
  }
}

function launchScript() {
  if (!state.selectedScriptFsName) return;
    setStatus("\u8fd0\u884c\u4e2d: " + state.selectedScriptFsName);
    evalAe("AELT_launchScript('" + escapeForEvalScript(state.selectedScriptFsName) + "')", function (result) {
    if (!result.ok) {
      setStatus((result.messages && result.messages[0]) || "\u8fd0\u884c\u5931\u8d25");
      showToast("\u811a\u672c\u8fd0\u884c\u5931\u8d25", "error");
    } else {
      setStatus("\u811a\u672c\u5df2\u8fd0\u884c: " + state.selectedScriptFsName);
      showToast("\u811a\u672c\u5df2\u8fd0\u884c", "success");
    }
  });
}

function toggleFavorite(fsName) {
  var favs = getScriptFavorites();
  var idx = favs.indexOf(fsName);
  if (idx >= 0) favs.splice(idx, 1); else favs.push(fsName);
  setScriptFavorites(favs);
  renderScripts();
}

function toggleFavFilter() {
  state.favFilterOn = !state.favFilterOn;
  els.favFilterBtn.textContent = state.favFilterOn ? '\u2605' : '\u2606';
  els.favFilterBtn.classList.toggle("active", state.favFilterOn);
  renderScripts();
}

document.addEventListener("DOMContentLoaded", function() {
  try {
    var saved = localStorage.getItem("aelt.scriptFolder");
    if (saved) {
      state.scriptFolder = saved;
      els.scriptFolderStatus.textContent = saved;
      scanScripts();
    }
  } catch (e) {}

  els.scriptFolderBtn.addEventListener("click", selectScriptFolder);
  els.refreshScriptsBtn.addEventListener("click", scanScripts);
  els.scriptSearch.addEventListener("input", renderScripts);
  els.favFilterBtn.addEventListener("click", toggleFavFilter);
  els.scriptList.addEventListener("click", function (e) {
    var item = e.target.closest(".script-item");
    if (!item) return;
    if (e.target.closest(".script-fav")) {
      toggleFavorite(item.getAttribute("data-fsname"));
      return;
    }
    state.selectedScriptFsName = item.getAttribute("data-url");
    renderScripts();
  });

});
})();
