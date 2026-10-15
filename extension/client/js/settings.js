/* Serialize saves so an older callback cannot overwrite a newer edit. */
AELT.settings = (function () {
  var cache = {}, loaded = false, timer = null, saving = false, revision = 0, savedRevision = 0, waiting = [];
  function load(callback) {
    callHost('AELT_loadSettings', [], function (result) {
      loaded = result.ok;
      if (loaded) { cache = result.settings; savedRevision = revision = 0; }
      else { setStatus(result.messages.join(' ')); showToast('设置加载失败，已停止写入以保护原数据', 'error'); }
      if (els.dataLocation) els.dataLocation.textContent = result.path || '设置不可用';
      callback(result.ok);
    });
  }
  function set(key, value) {
    cache[key] = value; revision++;
    clearTimeout(timer); timer = setTimeout(function () { persist(); }, 300);
  }
  function persist(callback) {
    clearTimeout(timer);
    if (callback) waiting.push({ revision: revision, callback: callback });
    if (saving) return;
    if (!loaded) { complete({ ok: false, messages: ['设置尚未成功读取，无法保存。'] }, revision); return; }
    if (savedRevision === revision) { complete({ ok: true }, revision); return; }
    saving = true;
    var writing = revision;
    callHost('AELT_saveSettings', [cloneData(cache)], function (result) {
      saving = false;
      if (result.ok) savedRevision = writing;
      else { setStatus(result.messages.join(' ')); showToast('保存失败，请检查脚本写文件权限', 'error'); }
      complete(result, result.ok ? writing : revision);
      if (result.ok && revision > writing) persist();
    });
  }
  function complete(result, writing) {
    var completed = waiting.filter(function (entry) { return entry.revision <= writing; });
    waiting = waiting.filter(function (entry) { return entry.revision > writing; });
    completed.forEach(function (entry) { entry.callback(result); });
  }
  return { load: load, isLoaded: function () { return loaded; }, get: function (key, fallback) { return cache[key] === undefined ? fallback : cache[key]; }, set: set, persist: persist };
})();
