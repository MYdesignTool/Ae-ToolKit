/* Writable user data, strict validation and replace-with-backup writes. */
AELocalToolkit.storage = (function () {
  var json = AELocalToolkit.json;
  var userRoot = new Folder(Folder.userData.fullName + '/AE Local Toolkit');
  function ensureFolder(folder) {
    if (!folder.exists && !folder.create()) throw new Error('无法创建用户数据目录：' + folder.fsName);
    return folder;
  }
  function read(file) {
    file.encoding = 'UTF-8';
    if (!file.open('r')) throw new Error('无法读取：' + file.fsName);
    try { return json.parse(file.read()); } finally { file.close(); }
  }
  function recover(file) {
    var backup = new File(file.fullName + '.bak');
    if (!file.exists && backup.exists && !backup.copy(file.fullName)) throw new Error('恢复备份失败：' + file.fsName);
    return file;
  }
  function write(file, data) {
    ensureFolder(file.parent);
    var temp = new File(file.fullName + '.' + new Date().getTime() + '-' + Math.floor(Math.random() * 100000) + '.tmp');
    var targetPath = file.fullName, targetName = file.name;
    var backup = new File(targetPath + '.bak');
    temp.encoding = 'UTF-8';
    if (!temp.open('w')) throw new Error('无法写入：' + file.fsName);
    var written, closed;
    try { written = temp.write(json.stringify(data)); } finally { closed = temp.close(); }
    if (!written || !closed) { temp.remove(); throw new Error('写入失败：' + file.fsName); }
    try {
      if (backup.exists && !backup.remove()) throw new Error('无法更新备份：' + backup.fsName);
      if (file.exists && !file.rename(file.name + '.bak')) throw new Error('无法备份：' + file.fsName);
      var target = new File(targetPath);
      if (!temp.rename(targetName)) {
        if (backup.exists) backup.copy(target.fullName);
        throw new Error('无法替换：' + target.fsName);
      }
    } finally { if (temp.exists && /\.tmp$/.test(temp.name)) temp.remove(); }
  }
  function readData(name) { return read(new File(AELocalToolkit.moduleBase + '/data/' + name)); }
  function validateSettings(settings) {
    if (!settings || typeof settings !== 'object' || settings instanceof Array) throw new Error('设置必须是 JSON 对象');
    var arrays = ['scriptFavorites', 'userExpressions'];
    for (var i = 0; i < arrays.length; i++) if (settings[arrays[i]] !== undefined && !(settings[arrays[i]] instanceof Array)) throw new Error('设置列表格式错误：' + arrays[i]);
    var strings = ['compFolder', 'solidFolder', 'fallbackFolder', 'scriptFolder', 'ignoreMainCompNames'];
    for (i = 0; i < strings.length; i++) if (settings[strings[i]] !== undefined && typeof settings[strings[i]] !== 'string') throw new Error('设置文本格式错误：' + strings[i]);
    var expressions = settings.userExpressions || [], seen = {};
    for (i = 0; i < expressions.length; i++) {
      var item = expressions[i];
      if (item && item.tags !== undefined && !(item.tags instanceof Array)) throw new Error('表达式标签格式错误');
      if (!item || typeof item.id !== 'string' || item.id.indexOf('user-') !== 0 || seen[item.id] || typeof item.code !== 'string' || typeof item.name !== 'string') throw new Error('自定义表达式格式错误');
      seen[item.id] = true; item.builtin = false;
    }
    var favorites = settings.scriptFavorites || [];
    for (i = 0; i < favorites.length; i++) if (typeof favorites[i] !== 'string') throw new Error('脚本收藏格式错误');
    return settings;
  }
  function settingsFile() { return recover(new File(userRoot.fullName + '/settings.json')); }
  function loadSettings() {
    try {
      ensureFolder(userRoot);
      var file = settingsFile(), settings;
      if (file.exists) settings = validateSettings(read(file));
      else {
        var legacy = new File(AELocalToolkit.moduleBase + '/data/settings.json');
        settings = validateSettings(legacy.exists ? read(legacy) : readData('settings.default.json'));
        write(file, settings);
      }
      return AELocalToolkit.returnResult({ ok: true, settings: settings, path: userRoot.fsName });
    } catch (e) { return AELocalToolkit.error(e); }
  }
  function saveSettings(settings) { write(settingsFile(), validateSettings(settings)); }
  function schemesFolder() { return ensureFolder(new Folder(ensureFolder(userRoot).fullName + '/organizer-schemes')); }
  function validateScheme(scheme) {
    if (!scheme || !/^[a-zA-Z0-9_-]+$/.test(scheme.id) || scheme.id === 'preset-default' || typeof scheme.name !== 'string' || !(scheme.rules instanceof Array)) throw new Error('整理方案格式错误');
    for (var i = 0; i < scheme.rules.length; i++) {
      var rule = scheme.rules[i];
      if (!rule || typeof rule.path !== 'string' || !rule.path || !(rule.extensions instanceof Array) || !(rule.itemTypes instanceof Array)) throw new Error('整理规则格式错误');
    }
    scheme.builtin = false; return scheme;
  }
  function listSchemes() {
    var folder = schemesFolder();
    // Copy once, leaving the old installation intact. Never overwrite newer user data.
    var legacy = new Folder(AELocalToolkit.moduleBase + '/data/organizer-schemes');
    var marker = new File(userRoot.fullName + '/migration-v1.json');
    var files = !marker.exists && legacy.exists ? legacy.getFiles('*.json') : [], i;
    for (i = 0; i < files.length; i++) {
      var old = read(files[i]);
      if (!old.rules && old.folders instanceof Array) {
        old.rules = old.folders;
        for (var r=0; r<old.rules.length; r++) {
          old.rules[r].path = old.rules[r].path || old.rules[r].name;
          old.rules[r].itemTypes = old.rules[r].itemTypes || [];
          old.rules[r].extensions = old.rules[r].extensions || [];
        }
        old.fallbackPath = old.fallbackPath || old.fallbackFolder || 'Footage';
        delete old.folders; delete old.fallbackFolder;
      }
      validateScheme(old);
      var destination = recover(new File(folder.fullName + '/' + old.id + '.json'));
      if (!destination.exists) write(destination, old);
    }
    if (!marker.exists) write(marker, { complete: true });
    // Recover writes interrupted between backup and replacement.
    var backups = folder.getFiles('*.json.bak');
    for (i = 0; i < backups.length; i++) recover(new File(backups[i].fullName.replace(/\.bak$/, '')));
    files = folder.getFiles('*.json');
    files.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
    var result = [readData('organizer-rules.json')];
    for (i = 0; i < files.length; i++) result.push(validateScheme(read(files[i])));
    return result;
  }
  function saveScheme(scheme) { validateScheme(scheme); write(new File(schemesFolder().fullName + '/' + scheme.id + '.json'), scheme); }
  function deleteScheme(id) {
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || id === 'preset-default') throw new Error('无效方案 ID');
    var file = new File(schemesFolder().fullName + '/' + id + '.json');
    var backup = new File(file.fullName + '.bak');
    if (backup.exists && !backup.remove()) throw new Error('无法删除方案备份');
    if (file.exists && !file.remove()) throw new Error('无法删除整理方案');
  }
  function exportData() {
    try {
      var file = File.saveDialog('导出工具箱备份（JSON）', '*.json');
      if (!file) return AELocalToolkit.returnResult({ ok: true, cancelled: true });
      var exportPath = file.fsName;
      var settings = validateSettings(read(settingsFile()));
      write(file, { format: 'ae-local-toolkit', version: 1, settings: settings, schemes: listSchemes().slice(1) });
      return AELocalToolkit.returnResult({ ok: true, path: exportPath });
    } catch (e) { return AELocalToolkit.error(e); }
  }
  function importData() {
    try {
      var file = File.openDialog('选择工具箱备份（JSON）', '*.json');
      if (!file) return AELocalToolkit.returnResult({ ok: true, cancelled: true });
      var data = read(file);
      if (data.format !== 'ae-local-toolkit' || data.version !== 1 || !(data.schemes instanceof Array)) throw new Error('不支持的备份格式');
      validateSettings(data.settings);
      for (var i = 0; i < data.schemes.length; i++) validateScheme(data.schemes[i]);
      // Preserve a complete snapshot before merging same-ID schemes and replacing settings.
      var previous = settingsFile();
      if (previous.exists) {
        var oldSettings;
        try { oldSettings = validateSettings(read(previous)); }
        catch (invalid) { if (!previous.copy(userRoot.fullName + '/settings-before-import-corrupt.json')) throw new Error('无法备份损坏的设置，已停止导入'); }
        if (oldSettings) write(new File(userRoot.fullName + '/before-import.json'), { format: 'ae-local-toolkit', version: 1, settings: oldSettings, schemes: listSchemes().slice(1) });
      }
      for (i = 0; i < data.schemes.length; i++) saveScheme(data.schemes[i]);
      saveSettings(data.settings);
      return AELocalToolkit.returnResult({ ok: true });
    } catch (e) { return AELocalToolkit.error(e); }
  }
  return { readData: readData, loadSettings: loadSettings, saveSettings: saveSettings, listSchemes: listSchemes, saveScheme: saveScheme, deleteScheme: deleteScheme, exportData: exportData, importData: importData };
})();
