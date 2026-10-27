/* A single-column folder picker for scheme paths. New folders remain draft configuration. */
var pathPickerSession = null, pathPickerBound = false;
function buildRulePathNodes(paths) {
  var nodes = new Map();
  paths.forEach(function (path) {
    if (!validRulePath(path)) return;
    var parts = parseRuleTags(path, 'path');
    parts.forEach(function (name, index) {
      var value = parts.slice(0, index + 1).join('/');
      if (!nodes.has(value)) nodes.set(value, {path:value, name:name, parent:parts.slice(0, index).join('/'), depth:index + 1});
    });
  });
  return Array.from(nodes.values()).sort(function (a, b) { return a.path.localeCompare(b.path); });
}
function searchRulePathNodes(nodes, query) {
  var words = normalizeRulePath(query).toLowerCase().split(/\s+/).filter(Boolean);
  return nodes.filter(function (node) {
    var path = node.path.toLowerCase();
    return words.every(function (word) { return path.indexOf(word) >= 0; });
  }).sort(function (a, b) {
    var term = words.join(' ');
    function rank(node) {
      var name = node.name.toLowerCase(), path = node.path.toLowerCase();
      return path === term ? 0 : name === term ? 1 : name.indexOf(term) === 0 ? 2 : 3;
    }
    return rank(a) - rank(b) || a.path.localeCompare(b.path);
  });
}
function closePathPicker(restoreFocus) {
  if (!pathPickerSession) return;
  var input = pathPickerSession.input;
  var popup = $('pathPicker'); pathPickerSession = null;
  popup.style.pointerEvents = 'none'; popup.setAttribute('aria-hidden', 'true');
  input.setAttribute('aria-expanded', 'false');
  if (popup.contains(document.activeElement)) document.activeElement.blur();
  if (restoreFocus && input.isConnected && !input.disabled) input.focus();
  animatePopup(popup, false, function () { popup.hidden = true; });
}
function positionPathPicker() {
  if (!pathPickerSession) return;
  var popup = $('pathPicker'), rect = pathPickerSession.input.getBoundingClientRect();
  if (!pathPickerSession.input.isConnected || !pathPickerSession.input.closest('.view.active')) { closePathPicker(false); return; }
  var width = Math.min(360, window.innerWidth - 24), below = window.innerHeight - rect.bottom - 8, above = rect.top - 8;
  popup.style.width = width + 'px'; popup.style.left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)) + 'px';
  if (!pathPickerSession.side) pathPickerSession.side = below >= 360 || below >= above ? 'below' : 'above';
  var useBelow = pathPickerSession.side === 'below', available = useBelow ? below : above;
  popup.dataset.popupSide = pathPickerSession.side;
  popup.style.maxHeight = Math.min(520, available < 240 ? window.innerHeight - 24 : available - 12) + 'px';
  var height = popup.getBoundingClientRect().height;
  var top = available < 240 ? 12 : useBelow ? rect.bottom + 8 : rect.top - height - 8;
  popup.style.top = Math.max(12, Math.min(top, window.innerHeight - height - 12)) + 'px';
}
function pathPickerError(message) {
  $('pathPickerError').textContent = message || ''; $('pathPickerError').hidden = !message;
  updatePathPickerSelection();
  positionPathPicker();
}
function updatePathPickerSelection() {
  var session = pathPickerSession; if (!session) return;
  $('pathPickerTree').querySelectorAll('[data-path-value]').forEach(function (row) {
    var selected = row.dataset.pathValue === session.selected, active = row.dataset.pathValue === session.active;
    row.classList.toggle('selected', selected); row.classList.toggle('search-target', !!$('pathPickerSearch').value.trim() && active);
    row.setAttribute('aria-selected', String(selected)); row.tabIndex = active ? 0 : -1;
    row.querySelector('.path-tree-check').hidden = !selected;
  });
  $('pathPickerParent').textContent = t('新建位置：{path}', {path:session.selected || t('工程根目录')});
  $('pathPickerParent').title = session.selected || t('工程根目录');
  var creating = !$('pathPickerNewForm').hidden, direct = !$('pathPickerDirectForm').hidden;
  $('pathPickerApply').textContent = t(creating ? '新建并使用' : direct ? '使用路径' : '使用此文件夹');
  $('pathPickerApply').disabled = creating ? !$('pathPickerNewName').value.trim() : direct ? !$('pathPickerDirectInput').value.trim() : !session.selected;
}
function focusPathPickerRow(row, focus) {
  if (!row || !pathPickerSession) return;
  pathPickerSession.active = row.dataset.pathValue; updatePathPickerSelection();
  if (focus) row.focus({preventScroll:true});
  var tree = $('pathPickerTree'), bounds = tree.getBoundingClientRect(), rect = row.getBoundingClientRect();
  if (rect.top < bounds.top) tree.scrollTop += rect.top - bounds.top;
  else if (rect.bottom > bounds.bottom) tree.scrollTop += rect.bottom - bounds.bottom;
}
function renderPathPicker(resetScroll) {
  var session = pathPickerSession; if (!session) return;
  var tree = $('pathPickerTree'), scroll = resetScroll ? 0 : tree.scrollTop;
  var focused = tree.contains(document.activeElement) && document.activeElement.closest('[data-path-value]');
  var focusedPath = focused ? focused.dataset.pathValue : null;
  var query = $('pathPickerSearch').value.trim(), nodes = session.nodes;
  var rows = query ? searchRulePathNodes(nodes, query) : [{path:'', name:t('工程根目录'), parent:null, depth:0}].concat(nodes).filter(function (node) {
    var parent = node.parent;
    while (parent) { if (!session.expanded.has(parent)) return false; parent = parent.split('/').slice(0, -1).join('/'); }
    return true;
  });
  if (resetScroll || !rows.some(function (row) { return row.path === session.active; })) session.active = rows.length ? rows[0].path : null;
  $('pathPickerTree').innerHTML = rows.map(function (node, index) {
    var children = session.parents.has(node.path), selected = node.path === session.selected;
    var expand = children && !query && node.path ? '<button type="button" class="path-tree-expand" tabindex="-1" data-path-expand aria-label="' + escapeHtml(t(session.expanded.has(node.path) ? '收起目录' : '展开目录')) + '">' + (session.expanded.has(node.path) ? '▾' : '▸') + '</button>' : '<span class="path-tree-expand" aria-hidden="true"></span>';
    return '<div class="path-tree-row" role="treeitem" aria-level="' + (query ? 1 : node.depth + 1) + '"' + (children && node.path && !query ? ' aria-expanded="' + session.expanded.has(node.path) + '"' : '') + ' data-path-value="' + escapeHtml(node.path) + '" style="padding-left:' + (query ? 8 : 8 + node.depth * 12) + 'px" title="' + escapeHtml(node.path || t('工程根目录')) + '">' + expand + '<span class="path-tree-name">' + escapeHtml(query ? node.path : node.name) + '</span><span class="path-tree-check" aria-hidden="true">✓</span></div>';
  }).join('') || '<div class="path-tree-empty">' + escapeHtml(t('没有匹配的目录，可在下方新建。')) + '</div>';
  updatePathPickerSelection(); positionPathPicker(); tree.scrollTop = scroll;
  if (focusedPath !== null) focusPathPickerRow(Array.from(tree.children).find(function (row) { return row.dataset.pathValue === focusedPath; }), true);
}
function applyPickedPath(path) {
  if (!pathPickerSession || !validRulePath(path)) { pathPickerError(t('请输入有效路径，不能包含 .、.. 或控制字符。')); return; }
  var session = pathPickerSession;
  session.input.value = normalizeRulePath(path); session.refresh();
  session.input.dispatchEvent(new Event('input', {bubbles:true}));
  closePathPicker(true);
}
function selectPickerPath(row, focus) {
  if (!row || !pathPickerSession) return;
  pathPickerSession.selected = row.dataset.pathValue; pathPickerError(''); focusPathPickerRow(row, focus);
}
function bindPathPicker() {
  if (pathPickerBound) return; pathPickerBound = true;
  var popup = $('pathPicker'), search = $('pathPickerSearch');
  $('pathPickerClose').addEventListener('click', function () { closePathPicker(true); });
  search.addEventListener('compositionstart', function () { if (pathPickerSession) pathPickerSession.composing = true; });
  search.addEventListener('compositionend', function () { if (pathPickerSession) { pathPickerSession.composing = false; renderPathPicker(true); } });
  search.addEventListener('input', function () { if (pathPickerSession && !pathPickerSession.composing) { pathPickerError(''); renderPathPicker(true); } });
  search.addEventListener('keydown', function (event) {
    if (!pathPickerSession || event.isComposing || event.keyCode === 229 || pathPickerSession.composing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter') {
      var rows = Array.from($('pathPickerTree').querySelectorAll('[data-path-value]'));
      var row = rows.find(function (item) { return item.dataset.pathValue === pathPickerSession.active; }) || rows[0];
      if (event.key === 'Enter') { event.preventDefault(); if (row && row.dataset.pathValue) applyPickedPath(row.dataset.pathValue); else if (!rows.length) openNewFolder(); }
      else if (row) { event.preventDefault(); selectPickerPath(event.key === 'ArrowUp' ? rows[rows.length - 1] : row, true); }
    }
  });
  $('pathPickerTree').addEventListener('click', function (event) {
    var row = event.target.closest('[data-path-value]'); if (!row || !pathPickerSession) return;
    if (event.target.closest('[data-path-expand]')) {
      var path = row.dataset.pathValue, expanded = pathPickerSession.expanded;
      if (expanded.has(path)) expanded.delete(path); else expanded.add(path);
      renderPathPicker();
      focusPathPickerRow(Array.from($('pathPickerTree').children).find(function (item) { return item.dataset.pathValue === path; }), true);
    } else selectPickerPath(row, true);
  });
  $('pathPickerTree').addEventListener('dblclick', function (event) {
    var row = event.target.closest('[data-path-value]');
    if (row && row.dataset.pathValue && !event.target.closest('[data-path-expand]')) applyPickedPath(row.dataset.pathValue);
  });
  $('pathPickerTree').addEventListener('keydown', function (event) {
    if (event.isComposing || event.keyCode === 229 || !pathPickerSession) return;
    var row = event.target.closest('[data-path-value]'); if (!row) return;
    var rows = Array.from($('pathPickerTree').querySelectorAll('[data-path-value]')), index = rows.indexOf(row), path = row.dataset.pathValue;
    if (['ArrowDown','ArrowUp','Home','End'].indexOf(event.key) >= 0) {
      event.preventDefault(); index = event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))); selectPickerPath(rows[index], true);
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      if ($('pathPickerSearch').value.trim()) return;
      var session = pathPickerSession;
      if (event.key === 'ArrowRight' && (!path || session.expanded.has(path))) {
        selectPickerPath(rows.find(function (item) { return item.dataset.pathValue && item.dataset.pathValue.split('/').slice(0, -1).join('/') === path; }), true);
      } else if ((event.key === 'ArrowRight' && session.parents.has(path)) || (event.key === 'ArrowLeft' && session.expanded.has(path))) {
        if (event.key === 'ArrowRight') session.expanded.add(path); else session.expanded.delete(path);
        renderPathPicker();
      } else if (event.key === 'ArrowLeft' && path) {
        var parent = path.split('/').slice(0, -1).join('/');
        selectPickerPath(rows.find(function (item) { return item.dataset.pathValue === parent; }), true);
      }
    } else if (event.key === 'Enter') { event.preventDefault(); if (path) applyPickedPath(path); }
    else if (event.key === ' ') { event.preventDefault(); selectPickerPath(row, true); }
  });
  $('pathPickerApply').addEventListener('click', function () {
    if (!pathPickerSession) return;
    if (!$('pathPickerNewForm').hidden) create();
    else applyPickedPath(!$('pathPickerDirectForm').hidden ? $('pathPickerDirectInput').value : pathPickerSession.selected);
  });
  function openNewFolder() {
    if (!pathPickerSession) return;
    $('pathPickerDirectForm').hidden = true; $('pathPickerDirectToggle').setAttribute('aria-expanded', 'false');
    var query = search.value.trim();
    if (!$('pathPickerNewName').value && !$('pathPickerTree').querySelector('[data-path-value]') && query && validRuleTag(query, 'path') && !/[／＼]/.test(query)) $('pathPickerNewName').value = query;
    $('pathPickerNewForm').hidden = false; pathPickerError(''); positionPathPicker(); $('pathPickerNewName').focus();
    $('pathPickerNewName').select();
  }
  $('pathPickerNewBtn').addEventListener('click', openNewFolder);
  $('pathPickerCancelNew').addEventListener('click', function () { $('pathPickerNewForm').hidden = true; pathPickerError(''); $('pathPickerNewBtn').focus(); });
  function create() {
    if (!pathPickerSession) return;
    var name = $('pathPickerNewName').value.trim();
    if (!name || !validRuleTag(name, 'path') || /[／＼]/.test(name)) { pathPickerError(t('只填写当前文件夹名称，不要包含路径分隔符。')); return; }
    var path = (pathPickerSession.selected ? pathPickerSession.selected + '/' : '') + name;
    if (pathPickerSession.nodes.some(function (node) { return node.path === path; })) { pathPickerError(t('该文件夹已存在，请直接选择。')); return; }
    applyPickedPath(path);
  }
  $('pathPickerNewName').addEventListener('keydown', function (event) { if (event.key === 'Enter' && !event.isComposing && event.keyCode !== 229 && pathPickerSession && !pathPickerSession.composing) { event.preventDefault(); create(); } });
  $('pathPickerDirectToggle').addEventListener('click', function () {
    var form = $('pathPickerDirectForm'); form.hidden = !form.hidden; $('pathPickerNewForm').hidden = true;
    $('pathPickerDirectToggle').setAttribute('aria-expanded', String(!form.hidden)); pathPickerError('');
    if (!form.hidden) { $('pathPickerDirectInput').value = pathPickerSession.selected; $('pathPickerDirectInput').focus(); }
    updatePathPickerSelection();
  });
  popup.addEventListener('input', function (event) {
    if (event.target === $('pathPickerNewName') || event.target === $('pathPickerDirectInput')) pathPickerError('');
  });
  $('pathPickerDirectInput').addEventListener('keydown', function (event) { if (event.key === 'Enter' && !event.isComposing && event.keyCode !== 229 && pathPickerSession && !pathPickerSession.composing) { event.preventDefault(); applyPickedPath(event.target.value); } });
  popup.addEventListener('compositionstart', function () { if (pathPickerSession) pathPickerSession.composing = true; });
  popup.addEventListener('compositionend', function () { if (pathPickerSession) pathPickerSession.composing = false; });
  popup.addEventListener('keydown', function (event) {
    if (event.isComposing || event.keyCode === 229 || pathPickerSession && pathPickerSession.composing) return;
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation();
      if (!$('pathPickerNewForm').hidden) { $('pathPickerNewForm').hidden = true; pathPickerError(''); $('pathPickerNewBtn').focus(); }
      else if (!$('pathPickerDirectForm').hidden) { $('pathPickerDirectForm').hidden = true; $('pathPickerDirectToggle').setAttribute('aria-expanded', 'false'); pathPickerError(''); $('pathPickerDirectToggle').focus(); }
      else closePathPicker(true);
    }
    if (event.key === 'Tab') {
      var controls = Array.from(popup.querySelectorAll('button,input,[role="treeitem"][tabindex="0"]')).filter(function (element) { return !element.disabled && element.getClientRects().length; });
      var first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && event.target === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && event.target === last) { event.preventDefault(); first.focus(); }
    }
  });
  document.addEventListener('pointerdown', function (event) { if (pathPickerSession && !popup.contains(event.target) && !pathPickerSession.input.parentElement.contains(event.target)) closePathPicker(false); });
  window.addEventListener('resize', positionPathPicker);
  document.addEventListener('scroll', function (event) { if (pathPickerSession && !popup.contains(event.target)) positionPathPicker(); }, true);
}
function createRulePathEditor(container, path) {
  container.innerHTML = '<div class="rule-path-control"><input data-rule-path type="text" readonly role="combobox" aria-haspopup="dialog" aria-controls="pathPicker" aria-expanded="false" /><button type="button" class="rule-path-open" tabindex="-1" aria-label="选择目标目录">▾</button></div><span class="rule-path-hint" hidden></span>';
  var input = container.querySelector('input'), hint = container.querySelector('.rule-path-hint'); input.value = path;
  function refresh() {
    var valid = validRulePath(input.value); input.title = input.value;
    input.placeholder = t('选择目标目录'); input.setAttribute('aria-label', t('文件夹路径')); input.setAttribute('aria-invalid', String(!valid));
    container.querySelector('button').setAttribute('aria-label', t('选择目标目录'));
    hint.classList.toggle('invalid', !valid); hint.hidden = valid;
    hint.textContent = valid ? '' : t('请输入有效路径，不能包含 .、.. 或控制字符。');
  }
  function open() {
    if (input.disabled) return;
    if (pathPickerSession && pathPickerSession.input === input) { closePathPicker(true); return; }
    closePathPicker(false); bindPathPicker();
    var selected = validRulePath(input.value) ? normalizeRulePath(input.value) : '', expanded = new Set();
    var parts = selected.split('/'); for (var i = 1; i < parts.length; i++) expanded.add(parts.slice(0, i).join('/'));
    var nodes = buildRulePathNodes(rulePathSuggestions());
    pathPickerSession = {input:input, refresh:refresh, selected:selected, active:selected, expanded:expanded, nodes:nodes, parents:new Set(nodes.map(function (node) { return node.parent; })), composing:false};
    $('pathPickerSearch').value = ''; $('pathPickerNewName').value = ''; $('pathPickerNewForm').hidden = true; $('pathPickerDirectForm').hidden = true;
    $('pathPickerDirectToggle').setAttribute('aria-expanded', 'false'); $('pathPicker').hidden = false; input.setAttribute('aria-expanded', 'true');
    $('pathPicker').style.pointerEvents = ''; $('pathPicker').removeAttribute('aria-hidden');
    pathPickerError(''); renderPathPicker();
    focusPathPickerRow(Array.from($('pathPickerTree').children).find(function (row) { return row.dataset.pathValue === selected; }), false);
    $('pathPickerSearch').focus({preventScroll:true});
    animatePopup($('pathPicker'), true);
  }
  input.addEventListener('click', open); container.querySelector('button').addEventListener('click', open);
  input.addEventListener('keydown', function (event) { if (!event.isComposing && event.keyCode !== 229 && ['Enter','ArrowDown',' '].indexOf(event.key) >= 0) { event.preventDefault(); open(); } });
  input.addEventListener('input', refresh);
  container._rulePath = {refresh:refresh}; refresh();
}
AELT.organizerPaths = {close:closePathPicker, refresh:renderPathPicker, buildNodes:buildRulePathNodes};
