// ============================================================================
// AE Local Toolkit — 面板/调试/设置模块 (client/js/ui.js)
// 负责 Debug 选项卡可见性、设置读取、更新日志弹窗、AE 连接检测与本地存储
// 检测。依赖 core.js 的 state/els 与 util.js 的辅助函数。
// ============================================================================

  var REPO_URL = "https://github.com/MYdesignTool/Ae-ToolKit";

  // 在系统默认浏览器中打开外部链接：优先使用 CEP 提供的 API，
  // 非 CEP 环境（如本地浏览器调试）退回 window.open。
  function openExternal(url) {
    try {
      if (window.cep && window.cep.util && window.cep.util.openURLInDefaultBrowser) {
        window.cep.util.openURLInDefaultBrowser(url);
        return;
      }
    } catch (e) {}
    try { window.open(url, "_blank"); } catch (e) {}
  }

  // 设置页“AE工具箱”字样点击跳转仓库（脚本位于 body 末尾，DOM 已就绪，绑定一次）。
  (function bindAboutRepoLink() {
    var link = document.getElementById("aboutRepoLink");
    if (link) link.onclick = function () { openExternal(REPO_URL); };
  })();

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
    state.quietMode = AELT.settings.get("quietMode", false) === true;
    if (els.quietModeToggle) els.quietModeToggle.checked = state.quietMode;
    state.debugMode = AELT.settings.get("debugMode", false) === true;
    if (els.debugModeToggle) els.debugModeToggle.checked = state.debugMode;
    syncDebugTabVisibility();
  }

  function renderChangelog() {
   if (!state.changelog) {
     els.versionLabel.textContent = "未找到更新日志";
     els.versionLabel.title = "更新日志文件未找到";
     els.versionLabel.style.cursor = "default";
     els.versionLabel.onclick = null;
     return;
   }
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
   var entries = (state.changelog && state.changelog.entries) || [];
   body.innerHTML = entries.map(function (entry) {
     return '<div class="changelog-item"><strong>v' + entry.version + '</strong> <span class="muted">' + entry.date + '</span><ul>' +
       (entry.changes || []).map(function (c) { return "<li>" + escapeHtml(c) + "</li>"; }).join("") + "</ul></div>";
   }).join("") || '<p class="muted">暂无更新日志</p>';
   modal.style.display = "flex";
   var closeBtn = document.getElementById("closeChangelogBtn");
   if (closeBtn) closeBtn.onclick = hideChangelog;
   var repoBtn = document.getElementById("openRepoBtn");
   if (repoBtn) repoBtn.onclick = function () { openExternal(REPO_URL); };
   modal.onclick = function (e) { if (e.target === this) hideChangelog(); };
 }

 function hideChangelog() {
   var modal = document.getElementById("changelogModal");
   if (modal) modal.style.display = "none";
 }

  function pingHost() {
    evalAe("AELT_ping()", function (result) {
      if (result.loadErrors && result.loadErrors.length) {
        addDebug("host load errors", result.loadErrors);
        setStatus("Host 模块加载失败，详见 Debug。");
        showToast("Host 模块加载失败", "error");
        return;
      }
      if (result.ok) {
        setStatus("AE host 已连接：" + result.appVersion);
        showToast("AE host 已连接", "success");
      } else {
        setStatus("AE host 检测失败。");
        showToast("AE host 检测失败", "error");
      }
    });
  }




AELT.ui = {
  syncDebugTabVisibility: syncDebugTabVisibility,
  loadSettings: loadSettings,
  renderChangelog: renderChangelog,
  showChangelog: showChangelog,
  hideChangelog: hideChangelog,
  pingHost: pingHost
};
