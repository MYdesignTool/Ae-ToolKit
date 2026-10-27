// ============================================================================
// AE Local Toolkit — 工程整理模块 (client/js/organizer.js)
// 整理方案的读取/渲染/校验/保存/删除，以及一键整理逻辑。
// 依赖 core.js 的 state/els/state.rules 与 util.js 的规范化函数。
// ============================================================================

  // ==========================================================================
  // 全局整理文件夹（合成 / 固态层 / 未匹配素材）
  // 这三项由所有整理方案共用，持久化于用户数据目录，
  // 主界面只配置素材规则。主界面渲染时剥离内部项目规则；整理/保存时再动态注入回 scheme，
  // 保证发给 host 的数据结构与旧版完全一致。
  // ==========================================================================
  var organizerSaved = Object.create(null), organizerName = '', organizerSaving = false, organizerSaveError = '';
  var ORG_FOLDER_DEFAULTS = { comp: "Comp", solid: "Solids", fallback: "Footage" };
  function normalizeRulePath(value) {
    return normalizePath(String(value || '').replace(/[／＼]/g, '/'));
  }
  function parseRuleTags(value, kind) {
    if (kind === 'path') return normalizeRulePath(value).split('/').filter(Boolean);
    return String(value || '').split(/[,，;；\s]+/).map(function (ext) {
      return ext.trim().replace(/^\*?\./, '').toUpperCase();
    }).filter(Boolean);
  }
  function uniqueRuleExtensions(values) {
    return values.filter(function (value, index) { return values.indexOf(value) === index; });
  }
  function validRuleTag(value, kind) {
    return kind === 'path' ? value !== '.' && value !== '..' && !/[\x00-\x1f\/\\]/.test(value) : /^[A-Z0-9][A-Z0-9_-]*$/.test(value);
  }
  function validRulePath(value) {
    var parts = parseRuleTags(value, 'path');
    return !/[\x00-\x1f]/.test(value) && parts.length > 0 && parts.every(function (part) { return validRuleTag(part, 'path'); });
  }
  function rulePathSuggestions() {
    var paths = [];
    function add(value) {
      if (!validRulePath(value)) return;
      var parts = parseRuleTags(value, 'path');
      for (var i = 1; i <= parts.length; i++) paths.push(parts.slice(0, i).join('/'));
    }
    state.organizerSchemes.forEach(function (scheme) {
      (scheme.rules || []).forEach(function (rule) { add(rule.path); });
    });
    var global = getGlobalFolders(); Object.keys(global).forEach(function (key) { add(global[key]); });
    els.ruleGrid.querySelectorAll('[data-rule-path]').forEach(function (input) { add(input.value); });
    return uniqueRuleExtensions(paths).sort(function (a, b) { return a.localeCompare(b); });
  }
  function createRuleExtensionEditor(container, values) {
    var tokens = uniqueRuleExtensions(normalizeExtensions(values)), composing = false;
    container.innerHTML = '<div class="rule-extension-input"><span class="rule-tag-tokens"></span><input data-rule-extensions type="text" autocomplete="off" spellcheck="false" /></div>' +
      '<span class="rule-tag-error" role="alert" hidden></span>';
    var box = container.querySelector('.rule-extension-input'), list = container.querySelector('.rule-tag-tokens'), input = container.querySelector('input'), error = container.querySelector('.rule-tag-error');
    function value() { return uniqueRuleExtensions(tokens.concat(parseRuleTags(input.value, 'extensions'))); }
    function reportInvalid() {
      error.textContent = t('后缀只填写字母、数字、短横线或下划线，例如 PNG。');
      error.hidden = false; input.setAttribute('aria-invalid', 'true');
    }
    function render() {
      list.innerHTML = tokens.map(function (token, index) {
        return '<span class="rule-tag' + (validRuleTag(token, 'extensions') ? '' : ' invalid') + '"><span class="rule-tag-name">' + escapeHtml(token) + '</span>' +
          '<button type="button" class="rule-tag-remove" data-token-remove="' + index + '" aria-label="' + escapeHtml(t('移除标签 {name}', {name:token})) + '"><svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M3 3l6 6M9 3l-6 6" /></svg></button></span>';
      }).join('');
      input.placeholder = t('输入后缀，按 Enter 添加…'); input.setAttribute('aria-label', t('添加文件后缀'));
      if (!error.hidden) reportInvalid();
    }
    function commit() {
      if (composing) return false;
      var added = parseRuleTags(input.value, 'extensions');
      if (added.some(function (token) { return !validRuleTag(token, 'extensions'); })) { reportInvalid(); return false; }
      tokens = uniqueRuleExtensions(tokens.concat(added)); input.value = ''; error.hidden = true; input.removeAttribute('aria-invalid'); render(); organizerEdited(); return true;
    }
    input.addEventListener('compositionstart', function () { composing = true; });
    input.addEventListener('compositionend', function () { composing = false; });
    input.addEventListener('keydown', function (event) {
      if (composing || event.isComposing || event.keyCode === 229) return;
      if (event.key === 'Enter') { event.preventDefault(); commit(); }
    });
    input.addEventListener('blur', function () { if (input.value.trim()) commit(); });
    box.addEventListener('click', function (event) {
      var remove = event.target.closest('[data-token-remove]');
      if (remove) { tokens.splice(Number(remove.dataset.tokenRemove), 1); render(); organizerEdited(); input.focus(); }
      else if (event.target === box || event.target === list) input.focus();
    });
    container._ruleTags = {value:value, refresh:render}; render();
  }
  function refreshRuleTagLabels() {
    els.ruleGrid.querySelectorAll('[data-rule-path-editor]').forEach(function (container) { container._rulePath.refresh(); });
    els.ruleGrid.querySelectorAll('[data-rule-tags="extensions"]').forEach(function (container) { container._ruleTags.refresh(); });
    if (AELT.organizerPaths) AELT.organizerPaths.refresh();
    renderIgnoreNameTags();
  }

  var ignoreNameTokens = [], ignoreNameComposing = false;
  function parseIgnoreNameTags(value) {
    // Old text lists split on spaces; new tag arrays keep each complete name.
    var names = Array.isArray(value) ? value : String(value || '').split(/[\s,，;；]+/);
    return names.map(function (name) { return String(name).trim(); }).filter(function (name, index, list) {
      return name && list.findIndex(function (other) { return other.toLowerCase() === name.toLowerCase(); }) === index;
    });
  }
  function renderIgnoreNameTags() {
    var box = $('ignoreMainCompTags'); if (!box) return;
    box.querySelector('.rule-tag-tokens').innerHTML = ignoreNameTokens.map(function (name, index) {
      return '<span class="rule-tag"><span class="rule-tag-name">' + escapeHtml(name) + '</span><button type="button" class="rule-tag-remove" data-ignore-remove="' + index + '" aria-label="' + escapeHtml(t('移除标签 {name}', {name:name})) + '"><svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M3 3l6 6M9 3l-6 6" /></svg></button></span>';
    }).join('');
    els.ignoreMainCompNames.placeholder = t('输入合成名称，按 Enter 添加…');
    els.ignoreMainCompNames.setAttribute('aria-label', t('添加忽略的合成名称'));
    enableIgnoreNames(state.ignoreMainComp);
  }
  function setIgnoreNameTags(value) { ignoreNameTokens = parseIgnoreNameTags(value); els.ignoreMainCompNames.value = ''; renderIgnoreNameTags(); }
  function enableIgnoreNames(enabled) {
    $('ignoreMainCompTags').querySelectorAll('input,button').forEach(function (control) { control.disabled = !enabled; });
  }
  function persistIgnoreNameTags() {
    state.ignoreMainCompNames = ignoreNameTokens.slice();
    AELT.settings.set('ignoreMainCompNames', state.ignoreMainCompNames);
    renderIgnoreNameTags();
  }
  function bindIgnoreNameTags() {
    var input = els.ignoreMainCompNames, box = $('ignoreMainCompTags');
    function commit() {
      if (ignoreNameComposing) return;
      // Enter adds one complete name; pasted lines and commas can add several.
      var added = input.value.split(/[,，;；\r\n]+/);
      ignoreNameTokens = parseIgnoreNameTags(ignoreNameTokens.concat(added)); input.value = ''; persistIgnoreNameTags();
    }
    input.addEventListener('compositionstart', function () { ignoreNameComposing = true; });
    input.addEventListener('compositionend', function () { ignoreNameComposing = false; });
    input.addEventListener('keydown', function (event) {
      if (ignoreNameComposing || event.isComposing || event.keyCode === 229) return;
      if (event.key === 'Enter') { event.preventDefault(); commit(); }
    });
    input.addEventListener('blur', function () { if (input.value.trim()) commit(); });
    box.addEventListener('click', function (event) {
      var remove = event.target.closest('[data-ignore-remove]');
      if (remove) { ignoreNameTokens.splice(Number(remove.dataset.ignoreRemove), 1); persistIgnoreNameTags(); input.focus(); }
      else if (event.target === box || event.target.classList.contains('rule-tag-tokens')) input.focus();
    });
  }

  function getGlobalFolders() {
    return {
      comp: AELT.settings.get("compFolder", ORG_FOLDER_DEFAULTS.comp),
      solid: AELT.settings.get("solidFolder", ORG_FOLDER_DEFAULTS.solid),
      fallback: AELT.settings.get("fallbackFolder", ORG_FOLDER_DEFAULTS.fallback)
    };
  }

  function setGlobalFolder(kind, value) {
    var key = { comp: "compFolder", solid: "solidFolder", fallback: "fallbackFolder" }[kind];
    if (!key) return;
    AELT.settings.set(key, normalizePath(value));
  }

  // 首次启动时，从已有方案吸收合成/固态层/未匹配文件夹作为全局初始值；
  // 仅在对应设置尚未写入过时生效（幂等，切换方案不会覆盖用户设置）。
  function absorbGlobalFoldersFromScheme(scheme) {
    function setIfAbsent(key, value) {
      if (AELT.settings.get(key, undefined) === undefined && value) AELT.settings.set(key, value);
    }
    var comp = "", solid = "";
    (scheme.rules || []).forEach(function (rule) {
      var types = rule.itemTypes || [];
      if (types.indexOf("CompItem") >= 0) comp = rule.path;
      if (types.indexOf("SolidSource") >= 0) solid = rule.path;
    });
    setIfAbsent("compFolder", comp);
    setIfAbsent("solidFolder", solid);
    setIfAbsent("fallbackFolder", scheme.fallbackPath);
  }

  // 判断一条规则是否为“内部项目规则”（合成/固态层），这类规则不在主界面展示。
  function isInternalRule(rule) {
    var types = rule.itemTypes || [];
    return types.indexOf("CompItem") >= 0 || types.indexOf("SolidSource") >= 0;
  }

  // 将全局文件夹值回填到设置页输入框。
  function fillGlobalFolderInputs() {
    var folders = getGlobalFolders();
    if (els.compFolderInput) els.compFolderInput.value = folders.comp;
    if (els.solidFolderInput) els.solidFolderInput.value = folders.solid;
    if (els.fallbackFolderInput) els.fallbackFolderInput.value = folders.fallback;
  }

  // 绑定设置页全局文件夹输入框，输入即持久化到用户数据目录（全局共用）。
  function bindGlobalFolderInputs() {
    if (els.compFolderInput) {
      els.compFolderInput.addEventListener("input", function () {
        setGlobalFolder("comp", els.compFolderInput.value);
      });
    }
    if (els.solidFolderInput) {
      els.solidFolderInput.addEventListener("input", function () {
        setGlobalFolder("solid", els.solidFolderInput.value);
      });
    }
    if (els.fallbackFolderInput) {
      els.fallbackFolderInput.addEventListener("input", function () {
        setGlobalFolder("fallback", els.fallbackFolderInput.value);
      });
    }
  }

  function getSelectedScheme() {
    for (var i = 0; i < state.organizerSchemes.length; i++) {
      if (state.organizerSchemes[i].id === state.selectedSchemeId) {
        return state.organizerSchemes[i];
      }
    }
    return state.organizerSchemes[0] || normalizeScheme(state.rules);
  }

  function getSchemeFromEditor() {
    var current = getSelectedScheme();
    var rules = [];
    var cards = els.ruleGrid.querySelectorAll("[data-rule-index]");
    for (var i = 0; i < cards.length; i++) {
      var pathInput = cards[i].querySelector('[data-rule-path]');
      var extensionsInput = cards[i].querySelector('[data-rule-tags="extensions"]')._ruleTags;
      rules.push({
        path: normalizeRulePath(pathInput.value),
        itemTypes: [],
        extensions: normalizeExtensions(extensionsInput.value())
      });
    }

    // 注意：这里只返回主界面编辑的“可见规则”，不注入内部项目规则。
    // 内部规则（合成/固态层）由 buildHostScheme 在发给 host 的边界处注入，
    // 避免 addRule/removeRule/saveScheme 等内部状态操作导致重复注入。
    var folders = getGlobalFolders();
    return normalizeScheme({
      id: current.id,
      name: organizerName || getSelectedScheme().name || t("整理方案"),
      builtin: false,
      fallbackPath: normalizePath(folders.fallback || "Footage"),
      rules: rules
    });
  }

  // 在编辑器方案基础上注入全局的合成/固态层规则，生成与旧版一致、
  // 可直接发给 host 的完整方案。仅用于整理/保存等 host 边界。
  function buildHostScheme() {
    var scheme = getSchemeFromEditor();
    var folders = getGlobalFolders();
    scheme.rules.push({ path: normalizePath(folders.comp), itemTypes: ["CompItem"], extensions: [] });
    scheme.rules.push({ path: normalizePath(folders.solid), itemTypes: ["SolidSource"], extensions: [] });
    return scheme;
  }

  function validateScheme(scheme) {
    var seen = {};
    var duplicates = [];
    var invalidRules = [];

    scheme.rules.forEach(function (rule, ruleIndex) {
      if (!validRulePath(rule.path)) invalidRules.push(ruleIndex + 1);
      rule.extensions.forEach(function (ext) {
        if (!validRuleTag(ext, 'extensions')) invalidRules.push(ruleIndex + 1);
        if (seen[ext]) {
          duplicates.push(ext);
        } else {
          seen[ext] = rule.path;
        }
      });
    });

    if (invalidRules.length) {
      return { ok: false, message: t('请检查文件夹路径和后缀标签，修正空路径或无效内容。') };
    }
    if (duplicates.length) {
      return { ok: false, message: t("文件类型不能重复：") + duplicates.join(", ") };
    }
    return { ok: true, message: "" };
  }

  function renderSchemeSelect() {
    var groups = [{builtin:true, title:t('内置预设')}, {builtin:false, title:t('我的方案')}];
    els.schemeSelect.innerHTML = groups.map(function (group) {
      var items = state.organizerSchemes.filter(function (scheme) { return !!scheme.builtin === group.builtin; });
      if (!items.length) return '';
      return '<optgroup label="' + escapeHtml(group.title) + '">' + items.map(function (scheme) {
        var selected = scheme.id === state.selectedSchemeId;
        var label = selected && organizerName && !scheme.builtin ? organizerName : AELT.i18n.builtin(scheme, 'name');
        return '<option value="' + escapeHtml(scheme.id) + '"' + (selected ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
      }).join('') + '</optgroup>';
    }).join('');
  }

  function renderRules(draft) {
    if (AELT.organizerPaths) AELT.organizerPaths.close(false);
    var scheme = draft || getSelectedScheme();
    state.selectedSchemeId = scheme.id;
    organizerName = scheme.name || ''; organizerSaveError = '';
    // 首次从当前方案吸收全局文件夹初始值（幂等）。
    absorbGlobalFoldersFromScheme(scheme);
    // 回填设置页的全局文件夹输入框（此时已吸收过，显示用户/方案值）。
    fillGlobalFolderInputs();
    renderSchemeSelect();

    // 剥离内部项目规则（合成/固态层），主界面只展示素材路径规则。
    var visibleRules = (scheme.rules || []).filter(function (rule) {
      return !isInternalRule(rule);
    });

    var html = "";
    visibleRules.forEach(function (rule, index) {
      html += '<div class="rule-item" data-rule-index="' + index + '">';

      // Header row
      html += '<div class="rule-header">';
      html += '<div class="field"><span data-i18n="文件夹路径">' + escapeHtml(t('文件夹路径')) + '</span><div class="rule-path-editor" data-rule-path-editor></div></div>';
      html += '<button class="icon-btn danger" data-i18n-title="删除规则" data-remove-rule="' + index + '" title="' + escapeHtml(t('删除规则')) + '">✖</button>';
      html += '</div>';

      // File types
      html += '<div class="field"><span data-i18n="文件后缀标签">' + escapeHtml(t('文件后缀标签')) + '</span><div class="rule-tag-editor" data-rule-tags="extensions"></div></div>';

      html += '</div>';  // end rule-item
    });
    els.ruleGrid.innerHTML = html || '<div class="selection-status" data-i18n="暂无规则">' + escapeHtml(t('暂无规则')) + '</div>';
    els.ruleGrid.querySelectorAll('[data-rule-index]').forEach(function (card, index) {
      createRulePathEditor(card.querySelector('[data-rule-path-editor]'), visibleRules[index].path, index);
      createRuleExtensionEditor(card.querySelector('[data-rule-tags="extensions"]'), visibleRules[index].extensions || []);
    });
    syncOrganizerSaveUI();
  }

  function loadOrganizerSchemesFromHost() {
      callHost('AELT_loadOrganizerSchemes', [], function (result) {
        if (result.ok && result.schemes && result.schemes.length) {
          state.organizerSchemes = result.schemes.map(normalizeScheme);
          if (!state.organizerSchemes.some(function (scheme) { return scheme.id === state.selectedSchemeId; })) {
            state.selectedSchemeId = state.organizerSchemes[0].id;
          }
          rememberOrganizerSchemes(); renderRules();
          setStatus(t('已加载整理方案 {count} 套。', {count:state.organizerSchemes.length}));
        } else {
          state.organizerSchemes = [normalizeScheme(state.rules)];
          state.selectedSchemeId = "preset-default";
          rememberOrganizerSchemes(); renderRules();
          setStatus(t("整理方案文件读取失败，已使用内置预设。"));
        }
      });
  }

 function organizeProject() {
   var scheme = buildHostScheme();
   // 注入“忽略主合成”全局设置（来自客户端设置缓存，即时生效；不写入方案文件）。
   scheme.ignoreMainComp = AELT.settings.get("ignoreMainComp", false) === true;
   var ignoreNames = AELT.settings.get("ignoreMainCompNames", "Main");
   scheme.ignoreMainCompNames = ignoreNames;
   scheme.ignoreMainCompFuzzy = AELT.settings.get("ignoreMainCompFuzzy", false) === true;
   var validation = validateScheme(scheme);
   if (!validation.ok) {
     setStatus(validation.message);
     showToast(validation.message, "error");
     return;
   }

    if (els.organizeBtn) els.organizeBtn.disabled = true;
    showOrganizeProgress();
    setStatus(t("正在整理工程：") + scheme.name);
    callHost('AELT_organizeProjectWithScheme', [scheme], function (result) {
        hideOrganizeProgress();
        if (els.organizeBtn) els.organizeBtn.disabled = false;
        if (!result.ok) {
          setStatus((result.messages && result.messages[0]) || t("整理失败。"));
          return;
        }
        var ignoredMsg = result.ignoredMainComp > 0 ? t('，忽略主合成 {count} 项', {count:result.ignoredMainComp}) : '';
        setStatus(t('整理完成：移动 {moved} 项，跳过 {skipped} 项，错误 {errors} 个{ignored}。', {moved:result.moved, skipped:result.skipped, errors:result.errors, ignored:ignoredMsg}));
        showToast(t('整理完成：移动 {count} 项', {count:result.moved}), 'success');
      });
  }

  function showOrganizeProgress() {
    var el = document.getElementById("organizeProgress");
    if (el) el.classList.remove("hidden");
  }

  function hideOrganizeProgress() {
    var el = document.getElementById("organizeProgress");
    if (el) el.classList.add("hidden");
  }

  function rememberOrganizerSchemes() {
    organizerSaved = Object.create(null);
    state.organizerSchemes.forEach(function (scheme) { organizerSaved[scheme.id] = cloneData(scheme); });
  }
  function organizerContent(scheme) {
    return JSON.stringify({name:scheme.name, rules:(scheme.rules || []).filter(function (rule) { return !isInternalRule(rule); }).map(function (rule) {
      return {path:normalizeRulePath(rule.path), extensions:normalizeExtensions(rule.extensions || [])};
    })});
  }
  function organizerDirty() {
    if (!state.rules) return false;
    var selected = getSelectedScheme(), baseline = organizerSaved[selected.id] || (selected.builtin ? selected : null);
    return !baseline || organizerContent(getSchemeFromEditor()) !== organizerContent(baseline);
  }
  function syncOrganizerSaveUI() {
    if (!state.rules || !els.schemeSaveStatus) return;
    var scheme = getSelectedScheme(), dirty = organizerDirty(), fresh = !scheme.builtin && !organizerSaved[scheme.id];
    els.schemeSaveStatus.textContent = organizerSaving ? t('正在保存…') : organizerSaveError ? t('保存失败，修改仍保留') : scheme.builtin ? t(dirty ? '已修改预设，另存后保留' : '内置预设，可另存为个人方案') : t(fresh ? '新方案 · 尚未保存' : dirty ? '有未保存修改' : '已保存');
    els.schemeSaveStatus.classList.toggle('dirty', dirty); els.schemeSaveStatus.classList.toggle('error', !!organizerSaveError);
    els.saveSchemeBtn.textContent = organizerSaving ? t('正在保存…') : t(scheme.builtin ? '另存为我的方案' : fresh ? '保存方案' : '保存修改');
    els.saveSchemeBtn.hidden = !dirty; els.discardSchemeBtn.hidden = !dirty;
    els.saveSchemeBtn.disabled = organizerSaving || !dirty; els.discardSchemeBtn.disabled = organizerSaving || !dirty;
    els.schemeSelect.disabled = organizerSaving; els.schemeMenuBtn.disabled = organizerSaving;
    els.renameSchemeBtn.hidden = !!scheme.builtin; els.deleteSchemeBtn.hidden = !!scheme.builtin;
    [els.newSchemeBtn,els.renameSchemeBtn,els.copySchemeBtn,els.deleteSchemeBtn,els.addRuleBtn].forEach(function (button) { button.disabled = organizerSaving; });
    els.ruleGrid.querySelectorAll('input,button').forEach(function (input) { input.disabled = organizerSaving; });
  }
  function organizerEdited() { organizerSaveError = ''; syncOrganizerSaveUI(); }
  function closeSchemeMenu() { els.schemeMenu.hidden = true; els.schemeMenuBtn.setAttribute('aria-expanded', 'false'); }
  function discardOrganizerDraft() {
    var scheme = getSelectedScheme();
    if (!scheme.builtin && !organizerSaved[scheme.id]) {
      state.organizerSchemes = state.organizerSchemes.filter(function (item) { return item.id !== scheme.id; });
      state.selectedSchemeId = state.organizerSchemes[0].id;
    }
    else if (organizerSaved[scheme.id]) replaceOrAppendScheme(cloneData(organizerSaved[scheme.id]));
    renderRules();
  }
  function restoreOrganizerScheme() {
    closeSchemeMenu(); if (organizerSaving || !organizerDirty()) return;
    confirmAction(t('放弃当前方案的未保存修改并还原？'), function (ok) {
      if (!ok || organizerSaving) return;
      discardOrganizerDraft(); setStatus(t('已放弃修改并还原方案。')); els.schemeSelect.focus();
    }, {title:t('放弃修改并还原'),confirmLabel:t('放弃并还原'),destructive:true});
  }
  function guardOrganizerDraft(action) {
    if (organizerSaving) return;
    if (!organizerDirty()) { action(); return; }
    showConfirmDialog(t('当前方案有未保存修改。放弃这些修改并继续？'), function (ok) { if (ok) { discardOrganizerDraft(); action(); } }, {title:t('未保存的方案'),confirmLabel:t('放弃修改')});
  }
  function selectOrganizerScheme(id) {
    if (id === state.selectedSchemeId) return;
    els.schemeSelect.value = state.selectedSchemeId;
    guardOrganizerDraft(function () { state.selectedSchemeId = id; renderRules(); });
  }
  function availableSchemeName(base, excludeId) {
    var name = base, number = 2;
    while (state.organizerSchemes.some(function (item) { return item.id !== excludeId && item.name.toLowerCase() === name.toLowerCase(); })) name = base + ' (' + number++ + ')';
    return name;
  }
  function schemeNameTaken(name, excludeId) {
    return state.organizerSchemes.some(function (item) { return item.id !== excludeId && item.name.toLowerCase() === name.toLowerCase(); });
  }
  function newScheme() {
    closeSchemeMenu();
    guardOrganizerDraft(function () {
      showInputDialog(t('新建方案'), availableSchemeName(t('新的整理方案')), function (name) {
        if (!name) return;
        if (schemeNameTaken(name)) { showToast(t('方案名称已存在，请换一个名称。'), 'error'); return; }
        var scheme = normalizeScheme({id:createId('scheme'),name:name,builtin:false,fallbackPath:getGlobalFolders().fallback,rules:[]});
        state.organizerSchemes.push(scheme); state.selectedSchemeId = scheme.id; renderRules();
        setStatus(t('已创建草稿，添加规则后保存方案。'));
      });
    });
  }
  function renameOrganizerScheme() {
    closeSchemeMenu(); if (organizerSaving || getSelectedScheme().builtin) return;
    showInputDialog(t('重命名方案'), organizerName, function (name) {
      if (!name) return;
      if (schemeNameTaken(name, state.selectedSchemeId)) { showToast(t('方案名称已存在，请换一个名称。'), 'error'); return; }
      organizerName = name; renderSchemeSelect(); organizerEdited();
    });
  }
  function persistOrganizerScheme(scheme) {
    if (organizerSaving) return;
    var validation = validateScheme(scheme);
    if (!validation.ok) { setStatus(validation.message); showToast(validation.message, 'error'); return; }
    if (AELT.organizerPaths) AELT.organizerPaths.close(false);
    var previous = getSelectedScheme(); organizerSaving = true; organizerSaveError = ''; syncOrganizerSaveUI();
    callHost('AELT_saveOrganizerScheme', [scheme], function (result) {
      organizerSaving = false;
      if (!result.ok) { organizerSaveError = (result.messages && result.messages[0]) || t('方案保存失败。'); setStatus(organizerSaveError); syncOrganizerSaveUI(); return; }
      if (previous.id !== scheme.id && !previous.builtin && !organizerSaved[previous.id]) state.organizerSchemes = state.organizerSchemes.filter(function (item) { return item.id !== previous.id; });
      replaceOrAppendScheme(scheme); organizerSaved[scheme.id] = cloneData(scheme); state.selectedSchemeId = scheme.id;
      renderRules(); setStatus(t('方案已保存：') + scheme.name); showToast(t('方案已保存'), 'success');
    });
  }
  function saveScheme(copy) {
    closeSchemeMenu(); if (organizerSaving) return;
    var selected = getSelectedScheme(), scheme = buildHostScheme(), validation = validateScheme(scheme);
    if (!validation.ok) { setStatus(validation.message); showToast(validation.message, 'error'); return; }
    if (copy || selected.builtin) {
      var base = AELT.i18n.builtin(selected, 'name') + t(' 副本');
      showInputDialog(t(selected.builtin && !copy ? '另存为我的方案' : '另存为副本'), availableSchemeName(base), function (name) {
        if (!name) return;
        if (schemeNameTaken(name)) { showToast(t('方案名称已存在，请换一个名称。'), 'error'); return; }
        scheme.id = createId('scheme'); scheme.name = name; scheme.builtin = false; persistOrganizerScheme(scheme);
      });
    } else persistOrganizerScheme(scheme);
  }
  function deleteScheme() {
    closeSchemeMenu(); if (organizerSaving) return;
    var scheme = getSelectedScheme(); if (scheme.builtin) return;
    showConfirmDialog(t('确认删除整理方案“{name}”？', {name:organizerName}), function (ok) {
      if (!ok) return;
      function removed() {
        delete organizerSaved[scheme.id]; state.organizerSchemes = state.organizerSchemes.filter(function (item) { return item.id !== scheme.id; });
        state.selectedSchemeId = state.organizerSchemes[0].id; renderRules(); setStatus(t('方案已删除。'));
      }
      if (!organizerSaved[scheme.id]) { removed(); return; }
      organizerSaving = true; syncOrganizerSaveUI();
      callHost('AELT_deleteOrganizerScheme', [scheme.id], function (result) {
        organizerSaving = false;
        if (!result.ok) { setStatus((result.messages && result.messages[0]) || t('方案删除失败。')); syncOrganizerSaveUI(); return; }
        removed();
      });
    }, {title:t('删除方案'),confirmLabel:t('删除'),destructive:true});
  }
  function addRule() {
    if (organizerSaving) return;
    var scheme = getSchemeFromEditor(); scheme.rules.push({path:'Footage/New Folder',itemTypes:[],extensions:[]}); renderRules(scheme);
  }
  function replaceOrAppendScheme(scheme) {
    var index = state.organizerSchemes.findIndex(function (item) { return item.id === scheme.id; });
    if (index >= 0) state.organizerSchemes[index] = scheme; else state.organizerSchemes.push(scheme);
  }
  function bindOrganizerEvents() {
    els.schemeSelect.addEventListener('change', function () { selectOrganizerScheme(els.schemeSelect.value); });
    els.schemeMenuBtn.addEventListener('click', function () { els.schemeMenu.hidden = !els.schemeMenu.hidden; els.schemeMenuBtn.setAttribute('aria-expanded', String(!els.schemeMenu.hidden)); });
    els.schemeMenuBtn.addEventListener('keydown', function (event) { if (event.key === 'ArrowDown') { event.preventDefault(); els.schemeMenu.hidden = false; els.schemeMenuBtn.setAttribute('aria-expanded','true'); els.newSchemeBtn.focus(); } });
    els.schemeMenu.addEventListener('keydown', function (event) { if (event.key === 'Escape') { event.preventDefault(); closeSchemeMenu(); els.schemeMenuBtn.focus(); } });
    document.addEventListener('pointerdown', function (event) { if (!event.target.closest('.scheme-menu-wrap')) closeSchemeMenu(); });
    document.addEventListener('focusin', function (event) { if (!event.target.closest('.scheme-menu-wrap')) closeSchemeMenu(); });
    els.newSchemeBtn.addEventListener('click', newScheme); els.renameSchemeBtn.addEventListener('click', renameOrganizerScheme);
    els.copySchemeBtn.addEventListener('click', function () { saveScheme(true); }); els.saveSchemeBtn.addEventListener('click', function () { saveScheme(false); });
    els.discardSchemeBtn.addEventListener('click', restoreOrganizerScheme);
    els.deleteSchemeBtn.addEventListener('click', deleteScheme); els.addRuleBtn.addEventListener('click', addRule);
    els.ruleGrid.addEventListener('input', organizerEdited);
    els.ruleGrid.addEventListener('click', function (event) {
      var button = event.target.closest('[data-remove-rule]'); if (!button || organizerSaving) return;
      var scheme = getSchemeFromEditor(); scheme.rules.splice(Number(button.dataset.removeRule),1); renderRules(scheme);
    });
  }
AELT.organizer = {
  bindIgnoreNames:bindIgnoreNameTags, setIgnoreNames:setIgnoreNameTags, enableIgnoreNames:enableIgnoreNames,
  parseRuleTags:parseRuleTags, validRuleTag:validRuleTag, normalizeRulePath:normalizeRulePath, validRulePath:validRulePath, refreshTagLabels:refreshRuleTagLabels,
  getSelectedScheme:getSelectedScheme, getSchemeFromEditor:getSchemeFromEditor, validateScheme:validateScheme,
  renderSchemeSelect:renderSchemeSelect, renderRules:renderRules, loadOrganizerSchemesFromHost:loadOrganizerSchemesFromHost,
  organizeProject:organizeProject, newScheme:newScheme, saveScheme:saveScheme, deleteScheme:deleteScheme,
  addRule:addRule, replaceOrAppendScheme:replaceOrAppendScheme, fillGlobalFolderInputs:fillGlobalFolderInputs, bindGlobalFolderInputs:bindGlobalFolderInputs,
  bindEvents:bindOrganizerEvents, syncSaveUI:syncOrganizerSaveUI, isDirty:organizerDirty, rename:renameOrganizerScheme
};
