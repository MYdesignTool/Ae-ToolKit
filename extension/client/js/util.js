// ============================================================================
// AE Local Toolkit — 通用工具模块 (client/js/util.js)
// 提供状态栏/Toast/Debug 日志、统一主机调用、确认对话框，
// 以及路径/扩展名/类型/方案等各类规范化辅助函数。
// 全部为全局函数，任意模块可按名直接调用。依赖 core.js 的 state/els。
// ============================================================================

  function setStatus(message) {
   els.statusBar.textContent = message;
   addDebug("status", message);
 }

 function showToast(message, type) {
   var container = document.getElementById("toastContainer");
   if (!container) return;
   var toast = document.createElement("div");
   toast.className = "toast" + (type === "error" ? " error" : type === "success" ? " success" : "");
   toast.textContent = message;
   container.textContent = "";
   container.appendChild(toast);
   setTimeout(function () {
     toast.classList.add("out");
     setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
   }, type === "error" ? 6000 : 2400);
 }


function showDialog(options, callback) {
  var modal = $('inputModal'), previous = document.activeElement;
  var ok = $('inputModalOk'), cancel = $('inputModalCancel'), field = $('inputModalField');
  var tagsField = $('inputModalTagsField'), tags = $('inputModalTags');
  var tagBox = $('inputModalTagsEditor'), tagList = $('inputModalTagTokens'), tagComposing = false;
  var tagSelect = $('inputModalTagSelect');
  var tagTokens = options.expression ? normalizeExpressionTags(options.tags || []) : [];
  function renderTags() {
    tagList.textContent = '';
    tagTokens.forEach(function (token, index) {
      var chip = document.createElement('span'), name = document.createElement('span'), remove = document.createElement('button');
      chip.className = 'rule-tag'; name.className = 'rule-tag-name'; name.textContent = token;
      remove.type = 'button'; remove.className = 'rule-tag-remove'; remove.dataset.expressionTagRemove = index;
      remove.setAttribute('aria-label', t('移除标签 {name}', {name:token}));
      remove.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M3 3l6 6M9 3l-6 6" /></svg>';
      chip.appendChild(name); chip.appendChild(remove); tagList.appendChild(chip);
    });
    tagSelect.textContent = '';
    var placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = t('选择已有标签…'); tagSelect.appendChild(placeholder);
    if (options.expression) getExpressionTagOptions().forEach(function (tag) {
      if (tagTokens.some(function (token) { return token.toLowerCase() === tag.value.toLowerCase(); })) return;
      var option = document.createElement('option'); option.value = tag.value; option.textContent = tag.label; tagSelect.appendChild(option);
    });
    tagSelect.value = ''; tagSelect.disabled = tagSelect.options.length <= 1;
  }
  function commitTags() {
    if (tagComposing) return;
    tagTokens = normalizeExpressionTags(tagTokens.concat(normalizeExpressionTags(tags.value)));
    tags.value = ''; renderTags();
  }
  tagsField.hidden = !options.expression; tags.value = ''; renderTags();
  function startTagComposition() { tagComposing = true; }
  function endTagComposition() { tagComposing = false; }
  tags.addEventListener('compositionstart', startTagComposition);
  tags.addEventListener('compositionend', endTagComposition);
  tagBox.onclick = function (event) {
    var remove = event.target.closest('[data-expression-tag-remove]');
    if (remove) { tagTokens.splice(Number(remove.dataset.expressionTagRemove), 1); renderTags(); tags.focus(); }
    else if (event.target === tagBox || event.target === tagList) tags.focus();
  };
  tagSelect.onchange = function () {
    if (!tagSelect.value) return;
    tagTokens = normalizeExpressionTags(tagTokens.concat([tagSelect.value])); renderTags(); tags.focus();
  };
  $('inputModalTitle').textContent = options.title || t('确认操作');
  $('confirmMessage').textContent = options.message || '';
  $('confirmMessage').hidden = !options.message;
  field.hidden = !options.input; field.value = options.value || '';
  ok.textContent = options.confirmLabel || t('确定');
  ok.className = options.destructive ? 'danger' : 'primary';
  modal.style.display = 'flex';
  if (options.input) { field.focus(); field.select(); } else cancel.focus();
  function done(accepted) {
    if (AELT.selects) AELT.selects.close(false);
    if (accepted && options.expression) commitTags();
    modal.style.display = 'none';
    ok.onclick = null; cancel.onclick = null; modal.onclick = null; modal.onkeydown = null;
    tagBox.onclick = null; tagSelect.onchange = null;
    tags.removeEventListener('compositionstart', startTagComposition); tags.removeEventListener('compositionend', endTagComposition);
    var value = options.input ? (accepted ? field.value.trim() || null : null) : accepted;
    if (previous && previous.isConnected && !previous.disabled) previous.focus();
    callback(options.expression && value ? {name:value, tags:tagTokens.slice()} : value);
  }
  ok.onclick = function () { done(true); };
  cancel.onclick = function () { done(false); };
  modal.onclick = function (event) { if (event.target === modal) done(false); };
  modal.onkeydown = function (event) {
    if (event.isComposing || event.keyCode === 229 || event.target === tags && tagComposing) return;
    if (event.key === 'Escape') { event.preventDefault(); done(false); }
    if (event.key === 'Enter' && event.target === tags && options.expression) { event.preventDefault(); commitTags(); return; }
    if (event.key === 'Enter' && event.target === field) { event.preventDefault(); done(true); }
    if (event.key === 'Tab') {
      event.preventDefault();
      var controls = options.expression ? [field].concat(Array.from(tagList.querySelectorAll('button')), [tags, tagSelect, cancel, ok]).filter(function (control) { return !control.disabled; }) : options.input ? [field, cancel, ok] : [cancel, ok];
      if (AELT.selects) controls = controls.map(AELT.selects.control);
      var index = controls.indexOf(document.activeElement);
      controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length].focus();
    }
  };
}
function showInputDialog(title, value, callback) { showDialog({title:title,input:true,value:value,confirmLabel:t('保存')}, callback); }
function showConfirmDialog(message, callback, options) {
  options = options || {}; options.message = message;
  showDialog(options, callback);
}

function addDebug(type, detail, force) {
    if (!state.debugMode && !force) return;
    var time = new Date().toLocaleTimeString();
    state.debugEntries.unshift({
      time: time,
      type: type,
      detail: String(typeof detail === "string" ? detail : JSON.stringify(detail, null, 2)).slice(0, 16000)
    });
    if (state.debugEntries.length > 80) state.debugEntries.length = 80;
    renderDebug();
  }

  function renderDebug() {
    if (!els.debugLog) return;
    els.debugLog.innerHTML = state.debugEntries.map(function (entry) {
      return '<div class="debug-item"><strong>[' + entry.time + '] ' + escapeHtml(entry.type) + '</strong>\n' + escapeHtml(entry.detail) + '</div>';
    }).join("") || "<div class=\"selection-status\">" + escapeHtml(t("暂无 Debug 信息")) + "</div>";
  }

  // All bridge arguments use one JSON encoding; paths and percent signs stay literal.
  function callHost(name, args, callback) {
    if (!/^AELT_[a-zA-Z]+$/.test(name)) throw new Error(t('无效主机方法'));
    var script = name + '(' + (args || []).map(function (arg) {
      return JSON.stringify(arg).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    }).join(',') + ')';
    addDebug('host', name);
    if (window.AeltNativeBridge) {
      window.AeltNativeBridge.callHost(name, args || [], function (data) {
        addDebug('result', data);
        if (data.messages && AELT.i18n) data.messages = data.messages.map(AELT.i18n.hostMessage);
        callback(data);
      });
      return;
    }
    if (!window.__adobe_cep__) {
      callback({ ok: false, messages: [t('请在 After Effects 的扩展面板中使用此功能。')] }); return;
    }
    function fail(error) { callback({ ok: false, messages: [String(error)] }); }
    try {
      window.__adobe_cep__.evalScript(script, function (raw) {
        var data;
        try {
          data = JSON.parse(raw);
          if (!data || typeof data.ok !== 'boolean') throw new Error(t('无效主机返回'));
        } catch (e) { fail(t('无法解析 AE 返回结果：') + String(raw)); return; }
        addDebug('result', data);
        if (data.messages && AELT.i18n) data.messages = data.messages.map(AELT.i18n.hostMessage);
        callback(data);
      });
    } catch (e) { fail(e); }
  }
  function cloneData(value) { return JSON.parse(JSON.stringify(value)); }

  function getUserExpressions() {
    var items = AELT.settings.get("userExpressions", []);
    return Array.isArray(items) ? items : [];
  }

  function setUserExpressions(items, callback) {
    AELT.settings.set('userExpressions', items);
    AELT.settings.persist(callback);
  }

  function confirmAction(message, onConfirm, options) {
    if (state.quietMode) { if (onConfirm) onConfirm(true); return; }
    showConfirmDialog(message, function (result) {
      if (onConfirm) onConfirm(result === true);
    }, options);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function createId(prefix) {
    return prefix + "-" + Date.now() + "-" + Math.floor(Math.random() * 10000);
  }

  function normalizePath(value) {
    return String(value || "")
      .replace(/\\/g, "/")
      .split("/")
      .map(function (part) { return part.trim(); })
      .filter(Boolean)
      .join("/");
  }

  function normalizeExtensions(value) {
    if (value instanceof Array) {
      return value.map(function (ext) {
        return String(ext || "").trim().replace(/^\./, "").toUpperCase();
      }).filter(Boolean);
    }

    return String(value || "")
      .split(/[,，\s]+/)
      .map(function (ext) { return ext.trim().replace(/^\./, "").toUpperCase(); })
      .filter(Boolean);
  }

  function normalizeItemTypes(value) {
    if (value instanceof Array) {
      return value.map(function (type) {
        return String(type || "").trim();
      }).filter(Boolean);
    }

    return String(value || "")
      .split(/[,，\s]+/)
      .map(function (type) { return type.trim(); })
      .filter(Boolean);
  }

  function normalizeScheme(raw) {
    var scheme = cloneData(raw);

    scheme.id = scheme.id || createId("scheme");
    scheme.name = scheme.name || t("整理方案");
    scheme.fallbackPath = normalizePath(scheme.fallbackPath || "Footage");
    scheme.rules = (scheme.rules || []).map(function (rule) {
      return {
        path: normalizePath(rule.path),
        itemTypes: normalizeItemTypes(rule.itemTypes || []),
        extensions: normalizeExtensions(rule.extensions || [])
      };
    });
    return scheme;
  }

// 命名空间别名(仅供调试/阅读；调用点仍使用全局函数名，行为不变)。
AELT.util = {
  setStatus: setStatus,
  showToast: showToast,
  addDebug: addDebug,
  renderDebug: renderDebug,
  callHost: callHost,
  cloneData: cloneData,
  getUserExpressions: getUserExpressions,
  setUserExpressions: setUserExpressions,
  confirmAction: confirmAction,
  escapeHtml: escapeHtml,
  createId: createId,
  normalizePath: normalizePath,
  normalizeExtensions: normalizeExtensions,
  normalizeItemTypes: normalizeItemTypes,
  normalizeScheme: normalizeScheme
};
