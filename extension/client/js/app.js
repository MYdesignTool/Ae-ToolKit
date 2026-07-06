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

  function init() {
    cacheEls();
    bindEvents();
    bindScriptEvents();
    restoreScriptFolder();

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


// 应用启动：DOM 就绪后执行 init（此时所有模块脚本均已加载完成）。
document.addEventListener("DOMContentLoaded", init);

AELT.app = {
  cacheEls: cacheEls,
  bindEvents: bindEvents,
  init: init
};
