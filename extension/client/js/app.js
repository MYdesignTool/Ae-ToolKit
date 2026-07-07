// ============================================================================
// AE Local Toolkit — 前端入口 (client/js/app.js)
// 缓存 DOM 元素、绑定整理/表达式面板事件、初始化数据加载；并调用 scripts.js
// 暴露的 bindScriptEvents()/restoreScriptFolder()，统一在一个 DOMContentLoaded
// 中完成启动，保证 els 就绪后再绑定脚本事件。本文件必须最后加载。
// ============================================================================

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

  // 从面板自身 URL 推导扩展根目录：面板入口为 <root>/client/index.html，
  // 去掉该后缀即得到扩展根目录（host/ 与 client/ 并列）。
  function getExtensionRoot() {
    try {
      var href = window.location.href;
      href = href.replace(/^file:\/\/?/, "");
      href = href.split("?")[0].split("#")[0];
      href = href.replace(/\/client\/index\.html$/i, "");
      // file:// 路径中空格等被 URL 编码为 %20，需解码为真实字符，否则找不到文件夹
      try { href = decodeURIComponent(href); } catch (d) {}
      // 去掉 Windows 盘符前的多余斜杠：/C:/... -> C:/...
      href = href.replace(/^\/([A-Za-z]:)/, "$1");
      return href;
    } catch (e) {
      return "";
    }
  }

  // 告诉 host 扩展根目录，使其能定位 host/modules 下的模块。
  // 本 CEP 环境下 host 的 $.fileName 不可靠（返回 80，指向 AE 自身目录），
  // 因此必须由客户端提供路径。
  function initHostModuleBase() {
    var root = getExtensionRoot();
    if (!root) {
      addDebug("module base", "无法从 window.location 推导扩展根目录");
      return;
    }
    evalAe('AELT_setModuleBase("' + escape(root) + '")', function (result) {
      if (result && result.loadErrors && result.loadErrors.length) {
        addDebug("host module load errors", result.loadErrors);
      } else {
        addDebug("host module base", result && result.moduleBase);
      }
    });
  }

  function init() {
    cacheEls();
    bindEvents();
    bindScriptEvents();
    restoreScriptFolder();
    initHostModuleBase();

    var root = getExtensionRoot();

    Promise.all([
      loadJson("../data/organizer-rules.json", fallbackRules),
      loadJson("../data/default-expressions.json", fallbackExpressions)
    ]).then(function (results) {
      state.rules = normalizeScheme(results[0]);
      state.organizerSchemes = [state.rules];
      state.selectedSchemeId = state.rules.id;
      state.expressions = results[1].expressions.concat(getUserExpressions());
      renderRules();
      renderExpressions();
      loadSettings();
      pingHost();
      loadOrganizerSchemesFromHost();
      refreshSelection();
      loadChangelogFromHost(root);
    }).catch(function () {
      state.rules = normalizeScheme(fallbackRules);
      state.organizerSchemes = [state.rules];
      state.selectedSchemeId = state.rules.id;
      state.expressions = cloneData(fallbackExpressions).expressions.concat(getUserExpressions());
      renderRules();
      renderExpressions();
      loadSettings();
      setStatus("已使用内置数据启动。");
      pingHost();
      refreshSelection();
      loadChangelogFromHost(root);
    });
  }

  // 通过 host（ExtendScript）读取更新日志文件。
  // CEP 中 fetch 本地 file:// 资源常被安全策略拦截/不可用，故改由 host 直接读文件，
  // 保证数据单一来源、且前端无需硬编码兜底。文件缺失或解析失败时 state.changelog
  // 为 null，由 renderChangelog 显示“未找到更新日志”。
  function loadChangelogFromHost(root) {
    if (!root) {
      state.changelog = null;
      renderChangelog();
      return;
    }
    evalAe('AELT_readFile("' + escape(root + "/data/changelog.json") + '")', function (result) {
      if (result && result.ok && result.text) {
        try {
          state.changelog = JSON.parse(result.text);
        } catch (e) {
          state.changelog = null;
          addDebug("changelog parse failed", e.toString());
        }
      } else {
        state.changelog = null;
        if (result && result.exists === false) addDebug("changelog file not found", root + "/data/changelog.json");
      }
      renderChangelog();
    });
  }


// 应用启动：DOM 就绪后执行 init（此时所有模块脚本均已加载完成）。
document.addEventListener("DOMContentLoaded", init);

AELT.app = {
  cacheEls: cacheEls,
  bindEvents: bindEvents,
  init: init,
  loadChangelogFromHost: loadChangelogFromHost
};
