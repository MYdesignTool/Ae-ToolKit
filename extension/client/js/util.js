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
  $('inputModalTitle').textContent = options.title || '确认操作';
  $('confirmMessage').textContent = options.message || '';
  $('confirmMessage').hidden = !options.message;
  field.hidden = !options.input; field.value = options.value || '';
  ok.textContent = options.confirmLabel || '确定';
  ok.className = options.destructive ? 'danger' : 'primary';
  modal.style.display = 'flex';
  if (options.input) { field.focus(); field.select(); } else cancel.focus();
  function done(accepted) {
    modal.style.display = 'none';
    ok.onclick = null; cancel.onclick = null; modal.onclick = null; modal.onkeydown = null;
    callback(options.input ? (accepted ? field.value.trim() || null : null) : accepted);
    if (previous && previous.isConnected && !previous.disabled) previous.focus();
  }
  ok.onclick = function () { done(true); };
  cancel.onclick = function () { done(false); };
  modal.onclick = function (event) { if (event.target === modal) done(false); };
  modal.onkeydown = function (event) {
    if (event.key === 'Escape') { event.preventDefault(); done(false); }
    if (event.key === 'Enter' && event.target === field) { event.preventDefault(); done(true); }
    if (event.key === 'Tab') {
      event.preventDefault();
      var controls = options.input ? [field, cancel, ok] : [cancel, ok];
      var index = controls.indexOf(document.activeElement);
      controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length].focus();
    }
  };
}
function showInputDialog(title, value, callback) { showDialog({title:title,input:true,value:value,confirmLabel:'保存'}, callback); }
function showConfirmDialog(message, callback, options) {
  options = options || {}; options.message = message;
  showDialog(options, callback);
}

function addDebug(type, detail) {
    if (!state.debugMode) return;
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
    }).join("") || '<div class="selection-status">暂无 Debug 信息</div>';
  }

  // All bridge arguments use one JSON encoding; paths and percent signs stay literal.
  function callHost(name, args, callback) {
    if (!/^AELT_[a-zA-Z]+$/.test(name)) throw new Error('无效主机方法');
    var script = name + '(' + (args || []).map(function (arg) {
      return JSON.stringify(arg).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    }).join(',') + ')';
    addDebug('host', name);
    if (!window.__adobe_cep__) {
      callback({ ok: false, messages: ['请在 After Effects 的扩展面板中使用此功能。'] }); return;
    }
    function fail(error) { callback({ ok: false, messages: [String(error)] }); }
    try {
      window.__adobe_cep__.evalScript(script, function (raw) {
        var data;
        try {
          data = JSON.parse(raw);
          if (!data || typeof data.ok !== 'boolean') throw new Error('无效主机返回');
        } catch (e) { fail('无法解析 AE 返回结果：' + String(raw)); return; }
        addDebug('result', data);
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
    scheme.name = scheme.name || "整理方案";
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
