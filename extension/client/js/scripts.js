/* Keep row DOM stable on selection so double-clicks and keyboard focus survive. */
function getScriptFavorites() { return AELT.settings.get('scriptFavorites', []); }
function selectScriptFolder() {
  if (state.scriptBusy) return;
  callHost('AELT_selectScriptFolder', [], function (result) {
    if (!result.ok) { showToast(result.messages.join(' '), 'error'); return; }
    if (!result.path) return;
    state.scriptFolder = result.path; AELT.settings.set('scriptFolder', result.path);
    els.scriptFolderStatus.textContent = result.path; scanScripts();
  });
}
function scanScripts() {
  if (state.scriptBusy) return;
  if (!state.scriptFolder) { showToast('请先在设置中选择脚本文件夹', 'error'); return; }
  state.scriptBusy = true; els.refreshScriptsBtn.disabled = true;
  setStatus('正在扫描脚本…');
  callHost('AELT_scanScripts', [state.scriptFolder], function (result) {
    state.scriptBusy = false; els.refreshScriptsBtn.disabled = false;
    state.scripts = result.ok ? result.scripts : []; state.selectedScriptFsName = null;
    renderScripts();
    setStatus(result.ok ? '已加载 ' + result.scripts.length + ' 个脚本' : result.messages.join(' '));
    if (result.messages && result.messages.length) showToast(result.messages.join(' '), 'error');
  });
}
function renderScripts() {
  var query = els.scriptSearch.value.trim().toLowerCase(), favorites = getScriptFavorites();
  var filtered = state.scripts.filter(function (script) {
    return (!state.favFilterOn || favorites.indexOf(script.fsName) >= 0) && (script.name + ' ' + script.relativePath).toLowerCase().indexOf(query) >= 0;
  });
  if (!filtered.some(function (script) { return script.fsName === state.selectedScriptFsName; })) state.selectedScriptFsName = null;
  els.scriptList.innerHTML = filtered.map(function (script) {
    var selected = script.fsName === state.selectedScriptFsName, favorite = favorites.indexOf(script.fsName) >= 0;
    return '<div title="' + escapeHtml(script.relativePath) + '" class="script-item' + (selected ? ' active' : '') + '" tabindex="0" role="button" aria-pressed="' + selected + '" data-fsname="' + escapeHtml(script.fsName) + '"><span class="script-icon' + (script.iconPath ? '' : ' placeholder') + '"><img class="script-icon-img" loading="lazy" src="' + escapeHtml(script.iconPath || 'images/placeholder.png') + '" alt="" /></span><span class="script-name">' + escapeHtml(script.name) + '</span><button class="script-fav' + (favorite ? ' favored' : '') + '" aria-label="' + (favorite ? '取消收藏 ' : '收藏 ') + escapeHtml(script.name) + '" aria-pressed="' + favorite + '">' + (favorite ? '★' : '☆') + '</button></div>';
  }).join('') || '<div class="empty-state">' + (!state.scriptFolder ? '还没有脚本文件夹。在设置中选择目录开始。' : state.scripts.length ? '没有匹配的脚本，试试其他关键词。' : '目录中没有 .jsx 或 .jsxbin 脚本。') + '</div>';
  syncScriptSelection();
}
function syncScriptSelection() {
  els.scriptList.querySelectorAll('.script-item').forEach(function (row) {
    var selected = row.dataset.fsname === state.selectedScriptFsName;
    row.classList.toggle('active', selected); row.setAttribute('aria-pressed', String(selected));
  });
  els.scriptList.setAttribute("aria-busy", String(state.scriptBusy));
}
function launchScript() {
  if (state.scriptBusy || !state.selectedScriptFsName) return;
  var selected = state.selectedScriptFsName;
  state.scriptBusy = true; syncScriptSelection();
  setStatus('正在运行脚本…');
  callHost('AELT_launchScript', [selected], function (result) {
    state.scriptBusy = false; syncScriptSelection();
    setStatus(result.ok ? '已运行：' + selected : result.messages.join(' '));
    showToast(result.ok ? '脚本已运行' : result.messages.join(' '), result.ok ? 'success' : 'error');
  });
}
function bindScriptEvents() {
  els.scriptFolderBtn.addEventListener('click', selectScriptFolder);
  els.refreshScriptsBtn.addEventListener('click', scanScripts);
  els.scriptSearch.addEventListener('input', renderScripts);
  els.favFilterBtn.addEventListener('click', function () {
    state.favFilterOn = !state.favFilterOn;
    els.favFilterBtn.textContent = state.favFilterOn ? '★' : '☆'; els.favFilterBtn.setAttribute('aria-pressed', String(state.favFilterOn)); renderScripts();
  });
  els.scriptList.addEventListener('click', function (event) {
    var row = event.target.closest('.script-item'); if (!row) return;
    if (event.target.closest('.script-fav')) {
      var favorites = getScriptFavorites().slice(), index = favorites.indexOf(row.dataset.fsname);
      if (index < 0) favorites.push(row.dataset.fsname); else favorites.splice(index,1);
      AELT.settings.set('scriptFavorites', favorites); renderScripts(); return;
    }
    state.selectedScriptFsName = row.dataset.fsname; syncScriptSelection();
  });
  els.scriptList.addEventListener('dblclick', function (event) {
    if (event.target.closest('.script-fav')) return;
    var row = event.target.closest('.script-item'); if (row) { state.selectedScriptFsName=row.dataset.fsname; launchScript(); }
  });
  els.scriptList.addEventListener('keydown', function (event) {
    if (event.target.closest('.script-fav')) return;
    var row = event.target.closest('.script-item'); if (!row) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); state.selectedScriptFsName=row.dataset.fsname; syncScriptSelection(); if (event.key==='Enter') launchScript();
    }
  });
  els.scriptList.addEventListener('error', function (event) {
    if (event.target.tagName === 'IMG' && !event.target.dataset.fallback) { event.target.dataset.fallback='true'; event.target.parentElement.classList.add('placeholder'); event.target.src='images/placeholder.png'; }
  }, true);
}
function restoreScriptFolder() {
  state.scriptFolder = AELT.settings.get('scriptFolder', '');
  els.scriptFolderStatus.textContent = state.scriptFolder || '未选择脚本文件夹';
  if (state.scriptFolder) scanScripts(); else renderScripts();
}
AELT.scripts = { renderScripts:renderScripts, bindEvents:bindScriptEvents, launchScript:launchScript };
