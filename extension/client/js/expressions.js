/* Preserve the original search + dropdown + editor workflow. */
var expressionSelectionRequest = 0, expressionSelectionPending = 0;
var expressionTagSelection = [];
var expressionTransformSelection = [], expressionTargetsOpen = false, expressionTargetsCloseTimer = null;
var expressionTransformTargets = [
  {id:'anchorPoint', label:'锚点'}, {id:'position', label:'位置'}, {id:'scale', label:'缩放'},
  {id:'rotation', label:'旋转 / Z 旋转'}, {id:'opacity', label:'不透明度'},
  {id:'orientation', label:'方向（3D）'}, {id:'xRotation', label:'X 旋转（3D）'}, {id:'yRotation', label:'Y 旋转（3D）'}
];
function getExpressionTransformTargets() {
  return expressionTransformSelection.slice();
}
function cancelExpressionTargetsClose() {
  clearTimeout(expressionTargetsCloseTimer); expressionTargetsCloseTimer = null;
}
function scheduleExpressionTargetsClose() {
  cancelExpressionTargetsClose();
  // Allow the pointer to cross the gap between the button and its floating panel.
  expressionTargetsCloseTimer = setTimeout(function () { closeExpressionTransformTargets(false); }, 160);
}
function closeExpressionTransformTargets(restoreFocus) {
  cancelExpressionTargetsClose();
  if (!expressionTargetsOpen) return;
  expressionTargetsOpen = false;
  var panel = $('transformTargetsPanel'); panel.setAttribute('aria-hidden', 'true'); panel.style.pointerEvents = 'none';
  els.transformTargetsBtn.setAttribute('aria-expanded', 'false');
  if (panel.contains(document.activeElement)) document.activeElement.blur();
  if (restoreFocus && !els.transformTargetsBtn.hidden) els.transformTargetsBtn.focus();
  animatePopup(panel, false, function () { panel.hidden = true; });
}
function positionExpressionTransformTargets() {
  if (!expressionTargetsOpen) return;
  var panel = $('transformTargetsPanel'), button = els.transformTargetsBtn;
  if (button.hidden || !button.closest('.view.active')) { closeExpressionTransformTargets(false); return; }
  var rect = button.getBoundingClientRect(), width = Math.min(360, window.innerWidth - 24);
  var below = window.innerHeight - rect.bottom - 8, above = rect.top - 8;
  if (!panel.dataset.popupSide) panel.dataset.popupSide = below >= 280 || below >= above ? 'below' : 'above';
  var down = panel.dataset.popupSide === 'below', available = down ? below : above;
  panel.style.width = width + 'px'; panel.style.left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)) + 'px';
  panel.style.maxHeight = Math.max(100, Math.min(440, available - 12)) + 'px';
  var top = down ? rect.bottom + 8 : rect.top - panel.offsetHeight - 8;
  panel.style.top = Math.max(12, Math.min(top, window.innerHeight - panel.offsetHeight - 12)) + 'px';
}
function changeExpressionTransformTargets() {
  expressionTransformSelection = Array.from($('transformTargetOptions').querySelectorAll('input:checked')).map(function (input) { return input.value; });
  if (state.selection) { state.selection.supported = 0; state.selection.existing = 0; }
  syncExpressionEditor(); refreshSelection();
}
function showExpressionTransformTargets(focusOptions) {
  cancelExpressionTargetsClose();
  if (expressionTargetsOpen) {
    if (focusOptions) $('transformTargetOptions').querySelector('input').focus();
    return;
  }
  if (state.expressionBusy || !state.selection || state.selection.mode !== 'layers') return;
  var panel = $('transformTargetsPanel'), options = $('transformTargetOptions'), selected = getExpressionTransformTargets();
  options.textContent = '';
  expressionTransformTargets.forEach(function (target) {
    var label = document.createElement('label'), checkbox = document.createElement('input'), text = document.createElement('span');
    checkbox.type = 'checkbox'; checkbox.value = target.id; checkbox.checked = selected.indexOf(target.id) >= 0;
    text.textContent = t(target.label); label.appendChild(checkbox); label.appendChild(text); options.appendChild(label);
  });
  expressionTargetsOpen = true; panel.hidden = false; panel.style.pointerEvents = ''; panel.removeAttribute('aria-hidden'); panel.dataset.popupSide = '';
  els.transformTargetsBtn.setAttribute('aria-expanded', 'true');
  positionExpressionTransformTargets();
  if (focusOptions) options.querySelector('input').focus();
  animatePopup(panel, true);
}
function selectedExpression() { return state.expressions.find(function (item) { return item.id === state.selectedExpressionId; }); }
function normalizeExpressionTags(value) {
  var tags = Array.isArray(value) ? value : String(value || '').split(/[,，\n]+/);
  return tags.map(function (tag) { return tag.trim(); }).filter(function (tag, index, all) {
    return tag && all.findIndex(function (other) { return other.toLowerCase() === tag.toLowerCase(); }) === index;
  });
}
function expressionTags(item) {
  return normalizeExpressionTags((item.tags || []).concat(item.category ? [item.category] : []));
}
function expressionTagLabel(item, tag) { return item.builtin ? t(tag) : tag; }
function getExpressionTagOptions() {
  var tags = new Map();
  state.expressions.forEach(function (item) {
    expressionTags(item).forEach(function (tag) { if (!tags.has(tag)) tags.set(tag, expressionTagLabel(item, tag)); });
  });
  return Array.from(tags).map(function (tag) { return {value:tag[0], label:tag[1]}; }).sort(function (a, b) { return a.label.localeCompare(b.label); });
}
function renderExpressionTagFilter() {
  var options = getExpressionTagOptions(), tags = $('expressionFilterTags');
  expressionTagSelection = expressionTagSelection.filter(function (tag) { return options.some(function (option) { return option.value === tag; }); });
  $('expressionsView').classList.toggle('has-tag-filters', expressionTagSelection.length > 0);
  els.expressionTagFilter.textContent = '';
  var placeholder = document.createElement('option'); placeholder.value = '';
  placeholder.textContent = expressionTagSelection.length ? t('继续选择标签…') : t('全部标签');
  placeholder.disabled = expressionTagSelection.length > 0; els.expressionTagFilter.appendChild(placeholder);
  options.forEach(function (tag) {
    if (expressionTagSelection.indexOf(tag.value) >= 0) return;
    var option = document.createElement('option'); option.value = tag.value; option.textContent = tag.label; els.expressionTagFilter.appendChild(option);
  });
  els.expressionTagFilter.value = ''; tags.textContent = ''; tags.hidden = !expressionTagSelection.length;
  expressionTagSelection.forEach(function (tag, index) {
    var chip = document.createElement('span'), name = document.createElement('span'), remove = document.createElement('button');
    var label = options.find(function (option) { return option.value === tag; }).label;
    chip.className = 'rule-tag'; name.className = 'rule-tag-name'; name.textContent = label;
    remove.type = 'button'; remove.className = 'rule-tag-remove'; remove.dataset.filterTagRemove = index;
    remove.setAttribute('aria-label', t('移除筛选标签 {name}', {name:label}));
    remove.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M3 3l6 6M9 3l-6 6" /></svg>';
    chip.appendChild(name); chip.appendChild(remove); tags.appendChild(chip);
  });
  if (expressionTagSelection.length) {
    var clear = document.createElement('button'); clear.type = 'button'; clear.className = 'ghost filter-clear'; clear.dataset.filterTagsClear = '';
    clear.textContent = t('清空'); clear.setAttribute('aria-label', t('清空标签筛选')); tags.appendChild(clear);
  }
}
function expressionDirty() {
  var item = selectedExpression();
  return els.expressionCode.value !== (item ? item.code.replace(/\r\n?/g, '\n') : '');
}
function syncExpressionEditor() {
  var item = selectedExpression(), busy = state.expressionBusy;
  els.expressionCode.readOnly = busy;
  els.saveExpressionBtn.disabled = busy || !els.expressionCode.value.trim();
  els.updateExpressionBtn.hidden = !item || item.builtin;
  els.updateExpressionBtn.disabled = busy || !expressionDirty();
  els.deleteExpressionBtn.hidden = !item || item.builtin;
  els.deleteExpressionBtn.disabled = busy;
  els.editExpressionTagsBtn.hidden = !item || item.builtin;
  els.editExpressionTagsBtn.disabled = busy;
  els.expressionTags.textContent = item ? (expressionTags(item).map(function (tag) { return expressionTagLabel(item, tag); }).join(' · ') || t('无标签')) : '';
  els.refreshSelectionBtn.disabled = busy;
  var layers = state.selection && state.selection.mode === 'layers';
  els.transformTargetsBtn.hidden = !layers; els.transformTargetsBtn.disabled = busy;
  els.transformTargetsBtn.textContent = t('变换目标（{count}）', {count:getExpressionTransformTargets().length});
  els.transformTargetsBtn.title = expressionTransformTargets.filter(function (target) { return getExpressionTransformTargets().indexOf(target.id) >= 0; }).map(function (target) { return t(target.label); }).join(' · ');
  if (expressionTargetsOpen) {
    if (busy || !layers) closeExpressionTransformTargets(false);
    else {
      $('transformTargetOptions').querySelectorAll('label').forEach(function (label, index) { label.querySelector('span').textContent = t(expressionTransformTargets[index].label); });
      positionExpressionTransformTargets();
    }
  }
  els.applyExpressionBtn.disabled = busy || !els.expressionCode.value.trim() || layers && !state.selection.supported;
  els.removeExpressionBtn.disabled = busy || !(state.selection && state.selection.existing);
  els.applyExpressionBtn.textContent = busy && state.expressionOperation === 'apply' ? t('应用中…') : layers ? t('应用到图层变换') : t('应用到选中属性');
  els.removeExpressionBtn.textContent = busy && state.expressionOperation === 'remove' ? t('移除中…') : t('移除表达式');
  AELT.editor.sync();
}
function renderExpressions() {
  var query = els.expressionSearch.value.trim().toLowerCase();
  renderExpressionTagFilter();
  var items = state.expressions.filter(function (item) {
    return [item.name, AELT.i18n.builtin(item, 'name')].join(' ').toLowerCase().indexOf(query) >= 0 && expressionTagSelection.every(function (tag) { return expressionTags(item).indexOf(tag) >= 0; });
  });
  els.expressionList.innerHTML = "<select id=\"expressionPresetSelect\" class=\"expression-select\" aria-label=\"" + escapeHtml(t("选择表达式")) + "\"><option value=\"\">" + (items.length ? t('选择表达式…') : t('没有匹配的表达式')) + '</option>' + items.map(function (item) {
    var labels = expressionTags(item).map(function (tag) { return expressionTagLabel(item, tag); });
    return '<option value="' + escapeHtml(item.id) + '" data-tags="' + escapeHtml(JSON.stringify(labels)) + '"' + (item.id === state.selectedExpressionId ? ' selected' : '') + '>' + escapeHtml(AELT.i18n.builtin(item, 'name')) + '</option>';
  }).join('') + '</select>';
  syncExpressionEditor();
}
function selectExpression(id) {
  if (state.expressionBusy) { renderExpressions(); return; }
  if (id === state.selectedExpressionId) return;
  function select() {
    state.selectedExpressionId = id || null;
    var item = selectedExpression();
    AELT.editor.setValue(item ? item.code : '');
    renderExpressions();
  }
  if (expressionDirty()) confirmAction(t('当前编辑内容尚未保存，切换后会丢弃修改。继续？'), function (ok) { if (ok) select(); else renderExpressions(); });
  else select();
}
function refreshSelection(callback) {
  if (!state.ready) { if (callback) callback({ok:false}); return; }
  if (state.expressionBusy && !callback) return;
  var request = ++expressionSelectionRequest;
  expressionSelectionPending++;
  callHost('AELT_getSelectedPropertySummary', [getExpressionTransformTargets()], function (result) {
    expressionSelectionPending--;
    if (request !== expressionSelectionRequest) return;
    state.selection = result.ok ? result : null;
    els.selectionStatus.textContent = result.ok ? (result.mode === 'layers' ?
      t('已选 {layers} 个图层 · 目标 {count} 个属性 · 已有表达式 {existing} 个', {layers:result.layers, count:result.supported, existing:result.existing}) :
      t('已选 {count} 个属性 · 已有表达式 {existing} 个', {count:result.supported, existing:result.existing})) +
      (result.skipped ? t(' · 跳过 {count} 个不可用目标', {count:result.skipped}) : '') : result.messages.join(' ');
    els.selectionStatus.title = result.ok ? [result.comp].concat(result.names || []).join('\n') : result.messages.join(' ');
    syncExpressionEditor();
    if (callback) callback(result);
  });
}
function finishExpressionBatch(result, removing) {
  state.expressionBusy = false;
  var count = (removing ? result.removed : result.applied) || 0;
  var message = t(removing ? '已移除 {count} 项，跳过 {skipped} 项' : '已应用 {count} 项，跳过 {skipped} 项', {count:count, skipped:result.skipped || 0});
  if (result.errors) message += t('，失败 {count} 项', {count:result.errors});
  else if (!result.ok) message = t('操作未完成');
  setStatus(message);
  els.statusBar.title = message + (result.messages && result.messages.length ? '\n' + result.messages.join('\n') : '');
  if (!result.ok) showToast((result.messages && result.messages[0]) || message, 'error');
  refreshSelection();
}
function runExpressionBatch(removing) {
  if (state.expressionBusy || (!removing && !els.expressionCode.value.trim())) return;
  state.expressionOperation = null;
  state.expressionBusy = true; syncExpressionEditor();
  var code = els.expressionCode.value;
  refreshSelection(function (summary) {
    if (!summary.ok || !summary.supported || (removing && !summary.existing)) {
      state.expressionBusy = false; syncExpressionEditor();
      var message = summary.messages && summary.messages.length ? summary.messages.join(' ') : summary.mode === 'layers' ? t('请先勾选可用的图层变换目标。') : removing && summary.supported ? t('选中属性没有表达式。') : t('请先选择可应用表达式的属性。');
      setStatus(message); showToast(message, 'error');
      return;
    }
    function run() {
      state.expressionOperation = removing ? 'remove' : 'apply'; syncExpressionEditor();
      // Preserve the existing confirmation-before-overwrite policy and quiet-mode setting.
      callHost(removing ? 'AELT_removeExpressions' : 'AELT_applyExpression', removing ? [summary.selectionKey, summary.targets || getExpressionTransformTargets()] : [code, true, summary.selectionKey, summary.targets || getExpressionTransformTargets()], function (result) { finishExpressionBatch(result, removing); });
    }
    if (removing || summary.existing) {
      var prompt = removing && summary.mode === 'layers' ? t('移除图层变换目标上的 {count} 个表达式？可在 AE 中撤销。', {count:summary.existing}) :
        t(removing ? '移除选中属性上的 {count} 个表达式？可在 AE 中撤销。' : '已有 {count} 个属性包含表达式，是否覆盖？', {count:summary.existing});
      confirmAction(prompt, function (ok) {
        if (ok) run(); else { state.expressionBusy = false; syncExpressionEditor(); }
      }, {title:removing ? t('移除表达式') : t('覆盖表达式'), confirmLabel:removing ? t('移除') : t('覆盖'), destructive:removing});
    } else run();
  });
}
function applyExpression() { runExpressionBatch(false); }
function removeExpressions() { runExpressionBatch(true); }
function saveExpression(update) {
  if (state.expressionBusy) return;
  var selected = selectedExpression(), code = els.expressionCode.value.trim();
  if (!code || (update && (!selected || selected.builtin))) return;
  showDialog({title:update ? t('编辑表达式') : t('保存为自定义表达式'), input:true, expression:true, value:update ? selected.name : t('自定义表达式'), tags:selected ? expressionTags(selected).join(', ') : '', confirmLabel:t('保存')}, function (value) {
    if (!value) return;
    var item = update ? cloneData(selected) : {id:createId('user'), description:'用户保存的本地表达式。'};
    item.name = value.name; item.code = code; item.builtin = false; item.tags = normalizeExpressionTags(value.tags);
    delete item.category;
    var before = cloneData(getUserExpressions()), items = cloneData(before);
    var index = items.findIndex(function (entry) { return entry.id === item.id; });
    if (index < 0) items.push(item); else items[index] = item;
    state.expressionOperation = 'save'; state.expressionBusy = true; syncExpressionEditor();
    setUserExpressions(items, function (result) {
      state.expressionBusy = false;
      if (!result.ok) { AELT.settings.set('userExpressions', before); syncExpressionEditor(); return; }
      state.expressions = state.expressions.filter(function (entry) { return entry.builtin; }).concat(items);
      state.selectedExpressionId = item.id; AELT.editor.setValue(code);
      renderExpressions(); setStatus(update ? t('表达式已更新。') : t('已保存到自定义表达式。'));
    });
  });
}
function deleteExpression() {
  var selected = selectedExpression();
  if (state.expressionBusy || !selected || selected.builtin) return;
  confirmAction(t('删除自定义表达式“{name}”？', {name:selected.name}), function (ok) {
    if (!ok) return;
    var before = cloneData(getUserExpressions()), next = before.filter(function (item) { return item.id !== selected.id; });
    state.expressionOperation = 'save'; state.expressionBusy = true; syncExpressionEditor();
    setUserExpressions(next, function (result) {
      state.expressionBusy = false;
      if (!result.ok) { AELT.settings.set('userExpressions', before); syncExpressionEditor(); return; }
      state.expressions = state.expressions.filter(function (item) { return item.id !== selected.id; });
      state.selectedExpressionId = null; AELT.editor.setValue('');
      renderExpressions(); setStatus(t('自定义表达式已删除。'));
    });
  }, {title:t('删除表达式'),confirmLabel:t('删除'),destructive:true});
}
function bindExpressionEvents() {
  // Docked CEP panels do not always receive window focus when returning from the timeline.
  // Read selected-property lists only while this view is visible, without overlapping requests.
  window.setInterval(function () {
    if (document.hidden || !$('expressionsView').classList.contains('active') || expressionSelectionPending) return;
    refreshSelection();
  }, 800);
  els.expressionSearch.addEventListener('input', renderExpressions);
  els.expressionTagFilter.addEventListener('change', function () {
    var tag = els.expressionTagFilter.value;
    if (tag && expressionTagSelection.indexOf(tag) < 0) expressionTagSelection.push(tag);
    renderExpressions();
  });
  $('expressionFilterTags').addEventListener('click', function (event) {
    var remove = event.target.closest('[data-filter-tag-remove]'), clear = event.target.closest('[data-filter-tags-clear]');
    if (!remove && !clear) return;
    if (clear) expressionTagSelection = []; else expressionTagSelection.splice(Number(remove.dataset.filterTagRemove), 1);
    renderExpressions(); AELT.selects.control(els.expressionTagFilter).focus();
  });
  els.editExpressionTagsBtn.addEventListener('click', function () { saveExpression(true); });
  els.expressionList.addEventListener('change', function (event) { if (event.target.matches('.expression-select')) selectExpression(event.target.value); });
  els.expressionCode.addEventListener('input', syncExpressionEditor);
  els.expressionCode.addEventListener('keydown', function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); applyExpression(); }
    if (event.key === 'Tab') { event.preventDefault(); event.target.setRangeText('  ', event.target.selectionStart, event.target.selectionEnd, 'end'); syncExpressionEditor(); }
  });
  els.refreshSelectionBtn.addEventListener('click', function () { refreshSelection(); });
  var targetPanel = $('transformTargetsPanel');
  els.transformTargetsBtn.addEventListener('mouseenter', function () { showExpressionTransformTargets(false); });
  els.transformTargetsBtn.addEventListener('mouseleave', scheduleExpressionTargetsClose);
  targetPanel.addEventListener('mouseenter', cancelExpressionTargetsClose);
  targetPanel.addEventListener('mouseleave', scheduleExpressionTargetsClose);
  // Retain button activation for keyboard and touch; hover never takes editor focus.
  els.transformTargetsBtn.addEventListener('click', function () { showExpressionTransformTargets(true); });
  $('transformTargetOptions').addEventListener('change', changeExpressionTransformTargets);
  $('transformTargetsClose').addEventListener('click', function () { closeExpressionTransformTargets(true); });
  $('transformTargetsAll').addEventListener('click', function () { targetPanel.querySelectorAll('input').forEach(function (input) { input.checked = true; }); changeExpressionTransformTargets(); });
  $('transformTargetsNone').addEventListener('click', function () { targetPanel.querySelectorAll('input').forEach(function (input) { input.checked = false; }); changeExpressionTransformTargets(); });
  targetPanel.addEventListener('keydown', function (event) { if (event.key === 'Escape' && !event.isComposing && event.keyCode !== 229) { event.preventDefault(); event.stopPropagation(); closeExpressionTransformTargets(true); } });
  document.addEventListener('pointerdown', function (event) { if (expressionTargetsOpen && !targetPanel.contains(event.target) && event.target !== els.transformTargetsBtn) closeExpressionTransformTargets(false); });
  document.addEventListener('focusin', function (event) { if (expressionTargetsOpen && !targetPanel.contains(event.target) && event.target !== els.transformTargetsBtn) closeExpressionTransformTargets(false); });
  document.addEventListener('scroll', function (event) { if (expressionTargetsOpen && !targetPanel.contains(event.target)) positionExpressionTransformTargets(); }, true);
  window.addEventListener('resize', positionExpressionTransformTargets);
  els.applyExpressionBtn.addEventListener('click', applyExpression);
  els.removeExpressionBtn.addEventListener('click', removeExpressions);
  els.saveExpressionBtn.addEventListener('click', function () { saveExpression(false); });
  els.updateExpressionBtn.addEventListener('click', function () { saveExpression(true); });
  els.deleteExpressionBtn.addEventListener('click', deleteExpression);
}
AELT.expressions = {bindEvents:bindExpressionEvents,renderExpressions:renderExpressions,refreshSelection:refreshSelection};
