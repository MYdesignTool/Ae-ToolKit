// ============================================================================
// AE Local Toolkit — 面板/调试/设置模块 (client/js/ui.js)
// 负责 Debug 选项卡可见性、设置读取、更新日志弹窗、AE 连接检测与本地存储
// 检测。依赖 core.js 的 state/els 与 util.js 的辅助函数。
// ============================================================================

  var RELEASE_URL = "https://mydesigntool.github.io/Ae-ToolKit/";

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

  // 设置页“AE工具箱”字样点击跳转发布页（脚本位于 body 末尾，DOM 已就绪，绑定一次）。
  (function bindAboutRepoLink() {
    var link = document.getElementById("aboutRepoLink");
    if (link) link.onclick = function () { openExternal(RELEASE_URL); };
  })();

 function syncDebugTabVisibility() {
    var debugTab = document.querySelector('.tab[data-view="debug"]');
    var debugView = document.getElementById("debugView");
    if (!debugTab || !debugView) return;
    if (state.debugMode || state.startupError) {
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
    // tab 数量变化会改变各 tab 宽度，需重新对齐滑动指示器
    if (AELT.app && AELT.app.positionTabIndicator) AELT.app.positionTabIndicator(true);
  }

  function loadSettings() {
    state.quietMode = AELT.settings.get("quietMode", false) === true;
    if (els.quietModeToggle) els.quietModeToggle.checked = state.quietMode;
    state.debugMode = AELT.settings.get("debugMode", false) === true;
    if (els.debugModeToggle) els.debugModeToggle.checked = state.debugMode;

    state.ignoreMainComp = AELT.settings.get("ignoreMainComp", false) === true;
    if (els.ignoreMainCompToggle) els.ignoreMainCompToggle.checked = state.ignoreMainComp;
    if (els.ignoreMainCompField) els.ignoreMainCompField.style.display = state.ignoreMainComp ? "" : "none";
    // 名称默认 “Main”（未显式清空时回退到 Main，保证开箱即用）。
    state.ignoreMainCompNames = AELT.settings.get("ignoreMainCompNames", "Main");
    if (!state.ignoreMainCompNames) state.ignoreMainCompNames = "Main";
    state.ignoreMainCompFuzzy = AELT.settings.get("ignoreMainCompFuzzy", false) === true;
    if (els.ignoreMainCompNames) {
      els.ignoreMainCompNames.value = state.ignoreMainCompNames;
      els.ignoreMainCompNames.disabled = !state.ignoreMainComp;
    }
    if (els.ignoreMainCompFuzzyToggle) {
      els.ignoreMainCompFuzzyToggle.checked = state.ignoreMainCompFuzzy;
      var fzOff = !state.ignoreMainComp;
      els.ignoreMainCompFuzzyToggle.disabled = fzOff;
      var fzLbl = els.ignoreMainCompFuzzyToggle.closest(".inline-check");
      if (fzLbl) fzLbl.classList.toggle("disabled", fzOff);
    }
    syncDebugTabVisibility();
  }

  function renderChangelog() {
   if (!state.changelog) {
     els.versionLabel.disabled = true;
     els.versionLabel.textContent = t("未找到更新日志");
     els.versionLabel.title = t("更新日志文件未找到");
     els.versionLabel.style.cursor = "default";
     els.versionLabel.onclick = null;
     return;
   }
   els.versionLabel.disabled = false;
   els.versionLabel.textContent = state.changelog.version;
   els.versionLabel.style.cursor = "pointer";
   els.versionLabel.title = t('更新日志');
   els.versionLabel.onclick = showChangelog;
   addDebug("changelog", state.changelog);
 }

 function showChangelog() {
   var modal = document.getElementById("changelogModal");
   var body = document.getElementById("changelogBody");
   if (!modal || !body) return;
   var entries = (state.changelog && state.changelog.entries) || [];
   var latest = entries[0];
   var intro = latest ? '<div class="changelog-intro"><img src="images/changelog-team.webp?v=peek" alt="" draggable="false" /><div class="changelog-intro-copy"><span>' + escapeHtml(t('AE工具箱')) + '</span><h3>v' + escapeHtml(latest.version) + '</h3><time datetime="' + escapeHtml(latest.date) + '">' + escapeHtml(latest.date) + '</time></div></div>' : '';
   body.innerHTML = intro + (entries.map(function (entry, index) {
     var heading = index ? '<div class="changelog-version"><strong>v' + escapeHtml(entry.version) + '</strong><time datetime="' + escapeHtml(entry.date) + '">' + escapeHtml(entry.date) + '</time></div>' : '';
     return '<div class="changelog-item' + (index ? '' : ' changelog-current') + '">' + heading + '<ul>' +
       (entry.changes || []).map(function (change, changeIndex) {
         var english = entry.changesEn || AELT.changelogTranslations[entry.version];
         return '<li>' + escapeHtml(AELT.i18n.getLanguage() === 'en' && english ? english[changeIndex] || change : t(change)) + '</li>';
       }).join('') + '</ul></div>';
   }).join('') || "<p class=\"muted\">" + escapeHtml(t("暂无更新日志")) + "</p>");
   modal._previousFocus = document.activeElement;
   modal.style.display = "flex";
   body.scrollTop = 0;
   var closeBtn = document.getElementById("closeChangelogBtn");
   if (closeBtn) { closeBtn.onclick = hideChangelog; closeBtn.focus(); }
  var repoBtn = document.getElementById("openRepoBtn");
  if (repoBtn) repoBtn.onclick = function () { openExternal(RELEASE_URL); };
   modal.onclick = function (e) { if (e.target === this) hideChangelog(); };
   modal.onkeydown = function (event) {
     if (event.key === 'Escape') { event.preventDefault(); hideChangelog(); }
     if (event.key === 'Tab') {
       var targets = Array.from(modal.querySelectorAll('button, [tabindex="0"]'));
       var first = targets[0], last = targets[targets.length - 1];
       if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
       else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
     }
   };
 }

 function hideChangelog() {
   var modal = document.getElementById("changelogModal");
   if (modal) {
     modal.style.display = 'none'; modal.onkeydown = null;
     if (modal._previousFocus) modal._previousFocus.focus();
   }
 }

  function pingHost() {
    callHost('AELT_ping', [], function (result) {
      addDebug('connection', result, true);
      if (result.loadErrors && result.loadErrors.length) {
        setStatus(t("Host 模块加载失败，详见 Debug。"));
        showToast(t("Host 模块加载失败"), "error");
        return;
      }
      if (result.ok) {
        setStatus(t("AE host 已连接：") + result.appVersion);
        showToast(t("AE host 已连接"), "success");
      } else {
        setStatus(t("AE host 检测失败。"));
        showToast(t("AE host 检测失败"), "error");
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

function allowMotion() { return !window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
function getViewMotionItems(view) {
  var bounds = view.getBoundingClientRect(), items = [];
  Array.from(view.children).forEach(function (child) {
    if (child.id === 'scriptList' || child.id === 'ruleGrid') {
      var listBounds = child.getBoundingClientRect();
      child.querySelectorAll('.script-item, .rule-item').forEach(function (row) {
        var rect = row.getBoundingClientRect();
        if (rect.bottom > listBounds.top && rect.top < listBounds.bottom) items.push(row);
      });
    } else items.push(child);
  });
  return items.filter(function (item) {
    var rect = item.getBoundingClientRect();
    return rect.width && rect.height && rect.bottom > bounds.top && rect.top < bounds.bottom;
  });
}
function animateViewEntrance(view) {
  (view._entranceAnimations || []).forEach(function (animation) { animation.cancel(); });
  var animations = view._entranceAnimations = [];
  if (!allowMotion() || view.classList.contains('is-exiting')) return;
  getViewMotionItems(view).forEach(function (item, index) {
    var animation = item.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }], {
      duration: 200, delay: Math.min(index * 18, 144), easing: 'cubic-bezier(.22,.68,.22,1)', fill: 'backwards'
    });
    animations.push(animation);
    animation.onfinish = function () { animations.splice(animations.indexOf(animation), 1); };
  });
}
function animateViewExit(view, direction, complete) {
  if (!allowMotion()) { complete(); return null; }
  // Keep an interrupted entrance's current pose instead of flashing its final state.
  var poses = getViewMotionItems(view).map(function (item) {
    var style = getComputedStyle(item);
    return { item: item, opacity: style.opacity, transform: style.transform };
  });
  (view._entranceAnimations || []).forEach(function (animation) { animation.cancel(); });
  view._entranceAnimations = [];
  if (!poses.length) { complete(); return null; }
  var animations = view._exitAnimations = [], remaining = poses.length;
  view.classList.add('is-exiting'); view.setAttribute('aria-hidden', 'true');
  function cancel() {
    animations.forEach(function (animation) { animation.cancel(); });
    view._exitAnimations = []; view.classList.remove('is-exiting'); view.removeAttribute('aria-hidden');
  }
  poses.forEach(function (pose, index) {
    var animation = pose.item.animate([
      { opacity: pose.opacity, transform: pose.transform },
      { opacity: 0, transform: 'translateX(' + (-direction * 12) + 'px)' }
    ], { duration: 110, delay: Math.min(Math.floor(index / 3) * 14, 42), easing: 'cubic-bezier(.4,0,1,1)', fill: 'both' });
    animations.push(animation);
    animation.onfinish = function () { if (--remaining === 0) { cancel(); complete(); } };
  });
  return cancel;
}
