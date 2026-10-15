// ============================================================================
// AE Local Toolkit — 前端入口 (client/js/app.js)
// 缓存 DOM 元素、绑定整理/表达式面板事件、初始化数据加载；并调用 scripts.js
// 暴露的 bindScriptEvents()/restoreScriptFolder()，统一在一个 DOMContentLoaded
// 中完成启动，保证 els 就绪后再绑定脚本事件。本文件必须最后加载。
// ============================================================================

  // 顶部 Tab 的滑动高亮指示器：把宽度与水平位移同步到当前激活的 tab。
  // 首次定位不做过渡（避免从 0 滑入）；之后切换 / 显隐 / 缩放时平滑滑动。
  function positionTabIndicator(animate) {
    var tabsEl = document.querySelector(".tabs");
    if (!tabsEl) return;
    var indicator = tabsEl.querySelector(".tab-indicator");
    var active = tabsEl.querySelector(".tab.active");
    if (!indicator || !active) return;
    var tabsRect = tabsEl.getBoundingClientRect();
    var activeRect = active.getBoundingClientRect();
    if (!animate) indicator.style.transition = "none";
    indicator.style.width = activeRect.width + "px";
    // 相对 .tabs 的 padding box 左边缘（扣除边框宽度），与指示器的 left:0 基准一致
    var offsetX = activeRect.left - tabsRect.left - tabsEl.clientLeft;
    indicator.style.transform = "translateX(" + offsetX + "px)";
    tabsEl.classList.add("tabs-ready");
    if (!animate) {
      // 下一帧恢复过渡，保证后续切换具备滑动动画
      setTimeout(function () { indicator.style.transition = ""; }, 0);
    }
  }

  var cancelViewExit = null;
  function bindEvents() {
    document.querySelectorAll(".tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        var previous=document.querySelector('.tab.active');
        if (previous===tab) { if (tab.dataset.view==='expressions') refreshSelection(); return; }
        var outgoing = document.querySelector('.view.active'), incoming = $(tab.dataset.view + 'View');
        var tabs = Array.from(document.querySelectorAll('.tab'));
        var direction = tabs.indexOf(tab) > tabs.indexOf(previous) ? 1 : -1;
        var interrupted = !!cancelViewExit;
        if (cancelViewExit) { cancelViewExit(); cancelViewExit = null; }
        tabs.forEach(function (item) {
          item.classList.toggle('active', item === tab);
          item.setAttribute('aria-selected', String(item === tab)); item.tabIndex = item === tab ? 0 : -1;
        });
        positionTabIndicator(true);
        function showIncoming() {
          cancelViewExit = null;
          document.querySelectorAll('.view').forEach(function (item) { item.classList.toggle('active', item === incoming); });
          if (tab.dataset.view === 'expressions') refreshSelection();
          animateViewEntrance(incoming);
        }
        // A new click during exit takes precedence immediately; never queue page switches.
        if (!interrupted && outgoing && outgoing !== incoming) cancelViewExit = animateViewExit(outgoing, direction, showIncoming);
        else showIncoming();
      });
    });

    els.organizeBtn.addEventListener("click", organizeProject);
   els.schemeSelect.addEventListener("change", function () {
     var newId = els.schemeSelect.value;
     if (newId === "preset-default") {
       for (var si = 0; si < state.organizerSchemes.length; si++) {
         if (state.organizerSchemes[si].id === "preset-default") {
           state.organizerSchemes[si] = cloneData(state.rules);
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
    bindGlobalFolderInputs();
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
    els.pingHostBtn.addEventListener('click', pingHost);
    els.debugModeToggle.addEventListener("change", function () {
      state.debugMode = els.debugModeToggle.checked;
      AELT.settings.set("debugMode", state.debugMode);
      syncDebugTabVisibility();
    });
    els.quietModeToggle.addEventListener("change", function () {
      state.quietMode = els.quietModeToggle.checked;
      AELT.settings.set("quietMode", state.quietMode);
      syncDebugTabVisibility();
    });
    els.ignoreMainCompToggle.addEventListener("change", function () {
      state.ignoreMainComp = els.ignoreMainCompToggle.checked;
      AELT.settings.set("ignoreMainComp", state.ignoreMainComp);
      var off = !state.ignoreMainComp;
      if (els.ignoreMainCompField) els.ignoreMainCompField.style.display = off ? "none" : "";
      if (els.ignoreMainCompNames) els.ignoreMainCompNames.disabled = off;
      if (els.ignoreMainCompFuzzyToggle) {
        els.ignoreMainCompFuzzyToggle.disabled = off;
        var fzLbl = els.ignoreMainCompFuzzyToggle.closest(".inline-check");
        if (fzLbl) fzLbl.classList.toggle("disabled", off);
      }
    });
    els.ignoreMainCompNames.addEventListener("input", function () {
      state.ignoreMainCompNames = els.ignoreMainCompNames.value;
      AELT.settings.set("ignoreMainCompNames", state.ignoreMainCompNames);
    });
    els.ignoreMainCompFuzzyToggle.addEventListener("change", function () {
      state.ignoreMainCompFuzzy = els.ignoreMainCompFuzzyToggle.checked;
      AELT.settings.set("ignoreMainCompFuzzy", state.ignoreMainCompFuzzy);
    });
    els.clearDebugBtn.addEventListener("click", function () {
      state.debugEntries = [];
      renderDebug();
      els.statusBar.textContent = "Debug 已清空";
    });
  }

  function cacheEls() {
    [
      "dataLocation", "exportDataBtn", "importDataBtn",
      "versionLabel",
      "statusBar",
      "ruleGrid",
      "organizeBtn",
      "schemeSelect",
      "newSchemeBtn",
      "saveSchemeBtn",
      "deleteSchemeBtn",
      "schemeNameInput",
      "compFolderInput",
      "solidFolderInput",
      "fallbackFolderInput",
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
      "clearDebugBtn",
      "updateExpressionBtn",
      "quietModeToggle",
      "debugModeToggle",
      "ignoreMainCompToggle",
      "ignoreMainCompNames",
      "ignoreMainCompFuzzyToggle",
      "ignoreMainCompField",
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

  function getExtensionRoot() {
    var url = new URL(window.location.href);
    var path = decodeURIComponent(url.pathname).replace(/\/client\/index\.html$/i, '');
    return url.hostname ? '//' + url.hostname + path : path.replace(/^\/([A-Za-z]:)/, '$1');
  }
  function init() {
    cacheEls(); bindEvents(); bindScriptEvents(); bindExpressionEvents();
    positionTabIndicator(false);
    window.addEventListener('resize', function () { positionTabIndicator(false); });
    window.addEventListener('focus', function () { if ($('expressionsView').classList.contains('active')) refreshSelection(); });
    document.querySelector('.tabs').addEventListener('keydown', function (event) {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      var tabs = Array.from(document.querySelectorAll('.tab')).filter(function (tab) { return tab.style.display !== 'none'; });
      var index = tabs.indexOf(document.activeElement);
      index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      event.preventDefault(); tabs[index].click(); tabs[index].focus();
    });
    function bootstrap() {
      callHost('AELT_bootstrap', [], function (result) {
        if (!result.ok) { setStatus(result.messages.join(' ')); showToast('默认数据加载失败，请重新安装扩展', 'error'); return; }
        state.rules = normalizeScheme(result.rules);
        state.organizerSchemes = [cloneData(state.rules)]; state.selectedSchemeId = state.rules.id;
        state.expressions = result.expressions.concat(getUserExpressions()); state.changelog = result.changelog;
        renderRules(); renderExpressions(); loadSettings(); renderChangelog();
        state.ready = true; loadOrganizerSchemesFromHost(); restoreScriptFolder(); refreshSelection();
      });
    }
    callHost('AELT_setModuleBase', [getExtensionRoot()], function (result) {
      if (!result.ok) { setStatus((result.messages || result.loadErrors || []).join(' ')); showToast('主机初始化失败，请检查扩展安装', 'error'); return; }
      AELT.settings.load(function () { bootstrap(); });
    });
    els.exportDataBtn.addEventListener('click', function () {
      AELT.settings.persist(function (saved) {
        if (!saved.ok) return;
        callHost('AELT_exportUserData', [], function (result) { if (!result.cancelled) showToast(result.ok ? '备份已导出' : result.messages.join(' '), result.ok ? 'success' : 'error'); });
      });
    });
    els.importDataBtn.addEventListener('click', function () {
      showConfirmDialog('导入将替换当前设置并合并整理方案。未保存的表达式草稿会丢失，原数据会自动备份。继续？', function (ok) {
        if (!ok) return;
        function importBackup() {
          callHost('AELT_importUserData', [], function (result) {
            if (result.cancelled) return;
            if (!result.ok) { showToast(result.messages.join(' '), 'error'); return; }
            window.location.reload();
          });
        }
        if (AELT.settings.isLoaded()) AELT.settings.persist(function (saved) { if (saved.ok) importBackup(); });
        else importBackup();
      });
    });
    document.addEventListener('visibilitychange', function () { if (document.hidden) AELT.settings.persist(); });
    window.addEventListener('beforeunload', function () { AELT.settings.persist(); });
  }

// 应用启动：DOM 就绪后执行 init（此时所有模块脚本均已加载完成）。
document.addEventListener("DOMContentLoaded", init);

AELT.app = {
  cacheEls: cacheEls,
  bindEvents: bindEvents,
  init: init,
  positionTabIndicator: positionTabIndicator,
};
