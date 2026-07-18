// ============================================================================
// AE Local Toolkit — 通用工具模块 (client/js/util.js)
// 提供状态栏/Toast/Debug 日志、AE 脚本求值封装、本地存储读写、JSON 加载，
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
   container.appendChild(toast);
   setTimeout(function () {
     toast.classList.add("out");
     setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
   }, 1000);
 }

 // 自定义输入对话框（替代原生 window.prompt，避免 CEP 标题栏显示乱码扩展路径）。
// onConfirm(value) 中 value 为用户输入（已 trim），取消/关闭时为 null。
function showInputDialog(title, defaultText, onConfirm) {
  var modal = document.getElementById("inputModal");
  if (!modal) { var fb = window.prompt(title, defaultText); if (onConfirm) onConfirm(fb); return; }
  var titleEl = document.getElementById("inputModalTitle");
  var field = document.getElementById("inputModalField");
  var okBtn = document.getElementById("inputModalOk");
  var cancelBtn = document.getElementById("inputModalCancel");
  titleEl.textContent = title || "输入";
  field.style.display = "";
  field.value = defaultText || "";
  modal.style.display = "flex";
  field.focus();
  field.select();
  function done(val) {
    modal.style.display = "none";
    okBtn.onclick = null; cancelBtn.onclick = null; modal.onclick = null; field.onkeydown = null;
    if (onConfirm) onConfirm(val);
  }
  okBtn.onclick = function () { done(field.value.trim() || null); };
  cancelBtn.onclick = function () { done(null); };
  modal.onclick = function (e) { if (e.target === modal) done(null); };
  field.onkeydown = function (e) {
    if (e.key === "Enter") done(field.value.trim() || null);
    else if (e.key === "Escape") done(null);
  };
}

// 自定义确认对话框（替代原生 window.confirm，同样规避乱码标题栏）。
// onConfirm(result) 中 result 为 true(确定) / false(取消或关闭)。
function showConfirmDialog(message, onConfirm) {
  var modal = document.getElementById("inputModal");
  if (!modal) { var fb = window.confirm(message); if (onConfirm) onConfirm(fb); return; }
  var titleEl = document.getElementById("inputModalTitle");
  var field = document.getElementById("inputModalField");
  var okBtn = document.getElementById("inputModalOk");
  var cancelBtn = document.getElementById("inputModalCancel");
  titleEl.textContent = message || "确认";
  field.style.display = "none";
  field.value = "";
  modal.style.display = "flex";
  function done(val) {
    modal.style.display = "none";
    okBtn.onclick = null; cancelBtn.onclick = null; modal.onclick = null;
    if (onConfirm) onConfirm(val);
  }
  okBtn.onclick = function () { done(true); };
  cancelBtn.onclick = function () { done(false); };
  modal.onclick = function (e) { if (e.target === modal) done(false); };
}

function addDebug(type, detail) {
    var time = new Date().toLocaleTimeString();
    state.debugEntries.unshift({
      time: time,
      type: type,
      detail: typeof detail === "string" ? detail : JSON.stringify(detail, null, 2)
    });
    if (state.debugEntries.length > 80) state.debugEntries.length = 80;
    renderDebug();
  }

  function renderDebug() {
    if (!els.debugLog) return;
    els.debugLog.innerHTML = state.debugEntries.map(function (entry) {
      return '<div class="debug-item"><strong>[' + entry.time + '] ' + entry.type + '</strong>\n' + entry.detail + '</div>';
    }).join("") || '<div class="selection-status">暂无 Debug 信息</div>';
  }

  function escapeForEvalScript(value) {
    return String(value)
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\r/g, "\\r")
      .replace(/\n/g, "\\n");
  }

  function evalAe(script, callback) {
    addDebug("evalScript", script);
    if (window.__adobe_cep__ && window.__adobe_cep__.evalScript) {
      window.__adobe_cep__.evalScript(script, function (raw) {
        var data = null;
        addDebug("raw return", raw === "" ? "(empty string)" : raw);
        try {
          data = JSON.parse(raw);
        } catch (e) {
          data = { ok: false, messages: ["AE 返回结果解析失败。", String(raw)] };
        }
        addDebug("parsed return", data);
        callback(data);
      });
      return;
    }

    callback({
      ok: false,
      messages: ["当前不在 AE CEP 环境中，无法执行 AE 操作。"]
    });
  }

  function cloneData(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadJson(path, fallback) {
    return new Promise(function (resolve) {
      if (!window.fetch) {
        addDebug("data fallback", path + " fetch unavailable");
        resolve(cloneData(fallback));
        return;
      }

      // 注意：在 CEP（CEF）中通过 fetch 读取 file:// 本地资源时，响应常常
      // response.ok === false（status 为 0），但响应体仍是正常的 JSON。
      // 因此不能仅凭 !response.ok 就判定失败；直接解析响应体，仅当文件缺失
      // 或 JSON 解析出错时才回退到 fallback（changelog 的 fallback 为 null）。
      fetch(path).then(function (response) {
        return response.json();
      }).then(function (data) {
        addDebug("data loaded", path);
        resolve(data);
      }).catch(function (error) {
        addDebug("data fallback", path + " / " + error.toString());
        resolve(cloneData(fallback));
      });
    });
  }

  function getUserExpressions() {
    var items = AELT.settings.get("userExpressions", []);
    if (!(items instanceof Array)) return [];
    return items;
  }

  function setUserExpressions(items) {
    AELT.settings.set("userExpressions", items || []);
    return true;
  }

  function confirmAction(message, onConfirm) {
    if (state.quietMode) { if (onConfirm) onConfirm(true); return; }
    showConfirmDialog(message, function (result) {
      if (onConfirm) onConfirm(result === true);
    });
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
    var scheme = cloneData(raw || fallbackRules);

    if (scheme.folders && !scheme.rules) {
      scheme.rules = scheme.folders.map(function (folder) {
        return {
          path: folder.path || folder.name,
          itemTypes: folder.itemTypes || [],
          extensions: folder.extensions || []
        };
      });
    }

    scheme.id = scheme.id || createId("scheme");
    scheme.name = scheme.name || "整理方案";
    scheme.fallbackPath = normalizePath(scheme.fallbackPath || scheme.fallbackFolder || "Footage");
    scheme.rules = (scheme.rules || []).map(function (rule) {
      return {
        path: normalizePath(rule.path || rule.name),
        itemTypes: normalizeItemTypes(rule.itemTypes || []),
        extensions: normalizeExtensions(rule.extensions || [])
      };
    }).filter(function (rule) {
      return rule.path;
    });
    return scheme;
  }

// 命名空间别名(仅供调试/阅读；调用点仍使用全局函数名，行为不变)。
AELT.util = {
  setStatus: setStatus,
  showToast: showToast,
  addDebug: addDebug,
  renderDebug: renderDebug,
  escapeForEvalScript: escapeForEvalScript,
  evalAe: evalAe,
  cloneData: cloneData,
  loadJson: loadJson,
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
