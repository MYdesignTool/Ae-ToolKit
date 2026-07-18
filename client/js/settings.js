// ============================================================================
// AE Local Toolkit — 设置持久化模块 (client/js/settings.js)
// 所有用户设置（安静模式 / Debug 模式 / 全局整理文件夹 / 脚本文件夹 / 收藏 /
// 自定义表达式）统一持久化到扩展目录下的 data/settings.json。
// 不再使用浏览器 localStorage（旧版已废弃，不再迁移）；所有设置以后仅以 settings.json 为准。
// 该文件随扩展一起拷贝，换设备时直接复制整个扩展文件夹即可保留设置，
// 且不被电脑管家等清理工具当作缓存清除。
// 依赖 util.js 的 evalAe / escapeForEvalScript（本文件在 util.js 之后加载）。
// ============================================================================

window.AELT = window.AELT || {};

(function () {
  var cache = null;       // 内存缓存；null 表示尚未从 host 加载
  var loaded = false;     // 是否已加载过一次
  var saveTimer = null;   // 防抖写盘定时器

  // 从 host 读取设置（异步）。若本地无 settings.json（exists:false），则基于默认模板
  // （data/settings.default.json）自动创建一份本地 settings.json（纯配置，不含个人数据）。
  // 旧版 localStorage 已废弃，不再迁移；所有设置以后仅以 settings.json 为准。
  function load(callback) {
    if (loaded) { if (callback) callback(cache || {}); return; }
    evalAe("AELT_loadSettings()", function (result) {
      if (result && result.ok && result.settings) {
        cache = result.settings;
      } else {
        cache = {};
      }
      // 本地无 settings.json 时，先基于默认模板创建一份本地文件（纯配置）。
      if (!result || !result.exists) persist();
      loaded = true;
      if (callback) callback(cache);
    });
  }

  // 同步读取；设置未加载时回退到默认值。
  function get(key, def) {
    if (cache && cache[key] !== undefined) return cache[key];
    return def;
  }

  // 更新内存缓存并防抖写盘。
  function set(key, value) {
    if (!cache) cache = {};
    cache[key] = value;
    scheduleSave();
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 300);
  }

  // 立即写盘（防抖到点或强制调用）。
  function persist() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    if (!cache) return;
    var payload = escape(escapeForEvalScript(JSON.stringify(cache)));
    evalAe("AELT_saveSettings('" + payload + "')", function () {});
  }

  AELT.settings = {
    load: load,
    get: get,
    set: set,
    persist: persist
  };
})();
