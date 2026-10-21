/* Preserve the original search + dropdown + editor workflow. */
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
  els.applyExpressionBtn.disabled = busy || !els.expressionCode.value.trim();
  els.removeExpressionBtn.disabled = busy || !(state.selection && state.selection.existing);
  els.applyExpressionBtn.textContent = busy && state.expressionOperation === 'apply' ? t('应用中…') : t('应用到选中属性');
  els.removeExpressionBtn.textContent = busy && state.expressionOperation === 'remove' ? t('移除中…') : t('移除表达式');
  AELT.editor.sync();
}
function renderExpressions() {
  var query = els.expressionSearch.value.trim().toLowerCase();
  var tagFilter = els.expressionTagFilter.value, tags = new Map();
  state.expressions.forEach(function (item) {
    expressionTags(item).forEach(function (tag) { if (!tags.has(tag)) tags.set(tag, expressionTagLabel(item, tag)); });
  });
  els.expressionTagFilter.innerHTML = '<option value="">' + escapeHtml(t('全部标签')) + '</option>' + Array.from(tags).sort(function (a, b) { return a[1].localeCompare(b[1]); }).map(function (tag) {
    return '<option value="' + escapeHtml(tag[0]) + '">' + escapeHtml(tag[1]) + '</option>';
  }).join('');
  els.expressionTagFilter.value = tags.has(tagFilter) ? tagFilter : '';
  tagFilter = els.expressionTagFilter.value;
  var items = state.expressions.filter(function (item) {
    return [item.name, AELT.i18n.builtin(item, 'name')].join(' ').toLowerCase().indexOf(query) >= 0 && (!tagFilter || expressionTags(item).indexOf(tagFilter) >= 0);
  });
  els.expressionList.innerHTML = "<select class=\"expression-select\" aria-label=\"" + escapeHtml(t("选择表达式")) + "\"><option value=\"\">" + (items.length ? t('选择表达式…') : t('没有匹配的表达式')) + '</option>' + items.map(function (item) {
    var labels = expressionTags(item).map(function (tag) { return expressionTagLabel(item, tag); });
    return '<option value="' + escapeHtml(item.id) + '"' + (item.id === state.selectedExpressionId ? ' selected' : '') + '>' + escapeHtml(AELT.i18n.builtin(item, 'name') + (labels.length ? ' · ' + labels.join(' / ') : '')) + '</option>';
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
  callHost('AELT_getSelectedPropertySummary', [], function (result) {
    state.selection = result.ok ? result : null;
    els.selectionStatus.textContent = result.ok ? t('已选 {count} 个属性 · 已有表达式 {existing} 个', {count:result.supported, existing:result.existing}) + (result.skipped ? t(' · 不支持 {count} 个', {count:result.skipped}) : '') : result.messages.join(' ');
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
      setStatus(summary.messages ? summary.messages.join(' ') : removing ? t('选中属性没有表达式。') : t('请先选择可应用表达式的属性。'));
      return;
    }
    function run() {
      state.expressionOperation = removing ? 'remove' : 'apply'; syncExpressionEditor();
      // Preserve the existing confirmation-before-overwrite policy and quiet-mode setting.
      callHost(removing ? 'AELT_removeExpressions' : 'AELT_applyExpression', removing ? [summary.selectionKey] : [code, true, summary.selectionKey], function (result) { finishExpressionBatch(result, removing); });
    }
    if (removing || summary.existing) {
      confirmAction(t(removing ? '移除选中属性上的 {count} 个表达式？可在 AE 中撤销。' : '已有 {count} 个属性包含表达式，是否覆盖？', {count:summary.existing}), function (ok) {
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
  els.expressionSearch.addEventListener('input', renderExpressions);
  els.expressionTagFilter.addEventListener('change', renderExpressions);
  els.editExpressionTagsBtn.addEventListener('click', function () { saveExpression(true); });
  els.expressionList.addEventListener('change', function (event) { if (event.target.matches('.expression-select')) selectExpression(event.target.value); });
  els.expressionCode.addEventListener('input', syncExpressionEditor);
  els.expressionCode.addEventListener('keydown', function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); applyExpression(); }
    if (event.key === 'Tab') { event.preventDefault(); event.target.setRangeText('  ', event.target.selectionStart, event.target.selectionEnd, 'end'); syncExpressionEditor(); }
  });
  els.refreshSelectionBtn.addEventListener('click', function () { refreshSelection(); });
  els.applyExpressionBtn.addEventListener('click', applyExpression);
  els.removeExpressionBtn.addEventListener('click', removeExpressions);
  els.saveExpressionBtn.addEventListener('click', function () { saveExpression(false); });
  els.updateExpressionBtn.addEventListener('click', function () { saveExpression(true); });
  els.deleteExpressionBtn.addEventListener('click', deleteExpression);
}
AELT.expressions = {bindEvents:bindExpressionEvents,renderExpressions:renderExpressions,refreshSelection:refreshSelection};
