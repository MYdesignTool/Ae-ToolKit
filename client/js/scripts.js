// ============================================================================
// AE Local Toolkit — 脚本启动器模块 (client/js/scripts.js)
// 脚本文件夹选择/扫描/渲染/运行、收藏与收藏过滤。
// 依赖 core.js 的 state/els 与 util.js 的 evalAe/setStatus 等。
// ============================================================================

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
  // state.selectedScriptFsName 为 URL 编码路径，展示/对比时解码为可读路径。
  var selectedFs = state.selectedScriptFsName;
  try { selectedFs = decodeURI(state.selectedScriptFsName); } catch (e) {}
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
    var selected = s.fsName === selectedFs ? ' active' : '';
    html += '<div class="script-item' + selected + '" data-url="' + escapeHtml(encodeURI(s.fsName)) + '" data-fsname="' + escapeHtml(s.fsName) + '">';
    // 图标：有则显示图片，无则显示占位符以保持视觉一致（图标区域始终占位）。
    if (s.iconPath) {
      html += '<span class="script-icon"><img class="script-icon-img" src="' + escapeHtml(s.iconPath) + '" alt="" /></span>';
    } else {
      html += '<span class="script-icon placeholder" aria-hidden="true"><svg class="placeholder-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#666" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg></span>';
    }
    html += '<span class="script-name">' + escapeHtml(s.name) + '</span>';
    if (s.relativePath.indexOf("\\") >= 0 || s.relativePath.indexOf("/") >= 0) {
      var folderPart = s.relativePath.substr(0, s.relativePath.length - s.relativePath.replace(/^.*[\\\/]/, "").length);
      html += '<span class="script-folder">' + escapeHtml(folderPart) + '</span>';
    }
    // 收藏图标放在最右侧。
    html += '<span class="script-fav' + (isFav ? ' favored' : '') + '" data-fsname="' + escapeHtml(s.fsName) + '">' + (isFav ? '★' : '☆') + '</span>';
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
  // state.selectedScriptFsName 是为安全传输而做的 URL 编码路径，展示时解码为人类可读路径。
  var displayPath = state.selectedScriptFsName;
  try { displayPath = decodeURI(state.selectedScriptFsName); } catch (e) {}
    setStatus("\u8fd0\u884c\u4e2d: " + displayPath);
    evalAe("AELT_launchScript('" + escapeForEvalScript(state.selectedScriptFsName) + "')", function (result) {
    if (!result.ok) {
      setStatus((result.messages && result.messages[0]) || "\u8fd0\u884c\u5931\u8d25");
      showToast("\u811a\u672c\u8fd0\u884c\u5931\u8d25", "error");
    } else {
      setStatus("\u811a\u672c\u5df2\u8fd0\u884c: " + displayPath);
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
  els.favFilterBtn.textContent = state.favFilterOn ? '★' : '☆';
  els.favFilterBtn.classList.toggle("active", state.favFilterOn);
  renderScripts();
}


// 绑定脚本启动器相关 UI 事件。原单体版本在第二个 DOMContentLoaded 中绑定，
// 现抽出为独立函数，由入口 init() 在 cacheEls() 之后调用。
function bindScriptEvents() {
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

}

// 恢复上次选择的脚本文件夹并自动扫描。原单体版本同样在第二个 DOMContentLoaded 中执行。
function restoreScriptFolder() {
  try {
    var saved = localStorage.getItem("aelt.scriptFolder");
    if (saved) {
      state.scriptFolder = saved;
      els.scriptFolderStatus.textContent = saved;
      scanScripts();
    }
  } catch (e) {}

}

AELT.scripts = {
  getScriptFavorites: getScriptFavorites,
  setScriptFavorites: setScriptFavorites,
  selectScriptFolder: selectScriptFolder,
  scanScripts: scanScripts,
  renderScripts: renderScripts,
  launchScript: launchScript,
  toggleFavorite: toggleFavorite,
  toggleFavFilter: toggleFavFilter,
  bindScriptEvents: bindScriptEvents,
  restoreScriptFolder: restoreScriptFolder
};
