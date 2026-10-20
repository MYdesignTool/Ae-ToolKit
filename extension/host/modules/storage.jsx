/* One portable document for settings and presets; defaults remain separate. */
AELocalToolkit.storage = (function () {
  var json = AELocalToolkit.json;
  var dataRoot = new Folder(AELocalToolkit.moduleBase + '/data');
  var previousRoot = new Folder(Folder.userData.fullName + '/AE Local Toolkit');
  var nativeRoot = new Folder(AELocalToolkit.moduleBase).fsName.replace(/\\/g, '/').replace(/\/$/, '');
  function ensureFolder(folder) {
    if (!folder.exists && !folder.create()) throw new Error('无法创建数据目录：' + folder.fsName);
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
    if (!temp.open('w')) throw new Error('无法写入：' + file.fsName + '。请确认 AE 已允许脚本写文件，且当前 Windows 用户对扩展 data 目录有写入权限。');
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
  function readData(name) { return read(new File(dataRoot.fullName + '/' + name)); }
  function validateSettings(settings) {
    if (!settings || typeof settings !== 'object' || settings instanceof Array) throw new Error('设置必须是 JSON 对象');
    if (settings.language !== undefined && settings.language !== 'zh-CN' && settings.language !== 'en') throw new Error('不支持的界面语言');
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
  function validateScheme(scheme) {
    if (!scheme || !/^[a-zA-Z0-9_-]+$/.test(scheme.id) || scheme.id === 'preset-default' || typeof scheme.name !== 'string' || !(scheme.rules instanceof Array)) throw new Error('整理方案格式错误');
    for (var i = 0; i < scheme.rules.length; i++) {
      var rule = scheme.rules[i];
      if (!rule || typeof rule.path !== 'string' || !rule.path || !(rule.extensions instanceof Array) || !(rule.itemTypes instanceof Array)) throw new Error('整理规则格式错误');
    }
    scheme.builtin = false; return scheme;
  }
  function validateDocument(data) {
    if (!data || data.format !== 'ae-local-toolkit' || data.version !== 1 || !(data.schemes instanceof Array)) throw new Error('不支持的数据文件格式');
    validateSettings(data.settings);
    var seen = {};
    for (var i = 0; i < data.schemes.length; i++) {
      var scheme = validateScheme(data.schemes[i]), key = '$' + scheme.id;
      if (seen[key]) throw new Error('整理方案 ID 重复：' + scheme.id);
      seen[key] = true;
    }
    return data;
  }
  function portablePath(value, restore, folder) {
    if (restore) return value.indexOf('./') === 0 ? (folder ? new Folder(nativeRoot + '/' + value.slice(2)) : new File(nativeRoot + '/' + value.slice(2))).fsName : value;
    var path = value.replace(/\\/g, '/');
    var insensitive = Folder.fs === 'Windows', root = insensitive ? nativeRoot.toLowerCase() : nativeRoot, compare = insensitive ? path.toLowerCase() : path;
    return compare === root ? './' : compare.indexOf(root + '/') === 0 ? './' + path.slice(nativeRoot.length + 1) : value;
  }
  function settingsPaths(settings, restore) {
    var result = json.parse(json.stringify(settings));
    if (result.scriptFolder) result.scriptFolder = portablePath(result.scriptFolder, restore, true);
    var favorites = result.scriptFavorites || [];
    for (var i = 0; i < favorites.length; i++) favorites[i] = portablePath(favorites[i], restore, false);
    return result;
  }
  function dataFile() { return recover(new File(dataRoot.fullName + '/user-data.json')); }
  function putScheme(schemes, scheme) {
    validateScheme(scheme);
    for (var i = 0; i < schemes.length; i++) if (schemes[i].id === scheme.id) { schemes[i] = scheme; return; }
    schemes.push(scheme);
  }
  function readOldSchemes(folder, schemes) {
    if (!folder.exists) return;
    var backups = folder.getFiles('*.json.bak'), files = folder.getFiles('*.json'), i;
    // Read backups for interrupted old writes without modifying the old source.
    for (i = 0; i < backups.length; i++) if (!new File(backups[i].fullName.replace(/\.bak$/, '')).exists) files.push(backups[i]);
    files.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
    for (i = 0; i < files.length; i++) {
      var old = read(files[i]);
      if (!old.rules && old.folders instanceof Array) {
        old.rules = old.folders;
        for (var r = 0; r < old.rules.length; r++) {
          old.rules[r].path = old.rules[r].path || old.rules[r].name;
          old.rules[r].itemTypes = old.rules[r].itemTypes || [];
          old.rules[r].extensions = old.rules[r].extensions || [];
        }
        old.fallbackPath = old.fallbackPath || old.fallbackFolder || 'Footage';
        delete old.folders; delete old.fallbackFolder;
      }
      putScheme(schemes, old);
    }
  }
  function legacySettings(folder) {
    var file = new File(folder.fullName + '/settings.json');
    return file.exists ? file : new File(file.fullName + '.bak');
  }
  function loadDocument() {
    var file = dataFile();
    if (file.exists) return validateDocument(read(file));
    var local = legacySettings(dataRoot), previous = legacySettings(previousRoot);
    var data = { format: 'ae-local-toolkit', version: 1, settings: previous.exists ? read(previous) : local.exists ? read(local) : readData('settings.default.json'), schemes: [] };
    readOldSchemes(new Folder(dataRoot.fullName + '/organizer-schemes'), data.schemes);
    // The preceding version saved newer edits in the profile; it wins same-ID conflicts.
    readOldSchemes(new Folder(previousRoot.fullName + '/organizer-schemes'), data.schemes);
    validateDocument(data); data.settings = settingsPaths(data.settings, false);
    write(file, data);
    return data;
  }
  function loadSettings() {
    try { return AELocalToolkit.returnResult({ ok: true, settings: settingsPaths(loadDocument().settings, true), path: dataFile().fsName }); }
    catch (e) { return AELocalToolkit.error(e); }
  }
  function saveSettings(settings) {
    validateSettings(settings);
    var data = loadDocument(); data.settings = settingsPaths(settings, false); write(dataFile(), data);
  }
  function listSchemes() { return [readData('organizer-rules.json')].concat(loadDocument().schemes); }
  function saveScheme(scheme) { var data = loadDocument(); putScheme(data.schemes, scheme); write(dataFile(), data); }
  function deleteScheme(id) {
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || id === 'preset-default') throw new Error('无效方案 ID');
    var data = loadDocument(), remaining = [];
    for (var i = 0; i < data.schemes.length; i++) if (data.schemes[i].id !== id) remaining.push(data.schemes[i]);
    data.schemes = remaining; write(dataFile(), data);
  }
  function exportData(language) {
    try {
      var file = File.saveDialog(language === 'en' ? 'Export Toolkit backup (JSON)' : '导出工具箱备份（JSON）', '*.json');
      if (!file) return AELocalToolkit.returnResult({ ok: true, cancelled: true });
      var path = file.fsName; write(file, loadDocument());
      return AELocalToolkit.returnResult({ ok: true, path: path });
    } catch (e) { return AELocalToolkit.error(e); }
  }
  function importData(language) {
    try {
      var file = File.openDialog(language === 'en' ? 'Choose Toolkit backup (JSON)' : '选择工具箱备份（JSON）', '*.json');
      if (!file) return AELocalToolkit.returnResult({ ok: true, cancelled: true });
      var imported = validateDocument(read(file)), previous = dataFile(), current;
      // Retain the valid import even if it came from the canonical file's .bak.
      write(new File(dataRoot.fullName + '/last-import.json'), imported);
      if (previous.exists) {
        try { current = validateDocument(read(previous)); }
        catch (invalid) { if (!previous.copy(dataRoot.fullName + '/before-import-corrupt.json')) throw new Error('无法备份损坏的数据，已停止导入'); }
      } else {
        try { current = loadDocument(); } catch (invalidLegacy) { current = null; }
      }
      if (current) write(new File(dataRoot.fullName + '/before-import.json'), current);
      else current = { format: 'ae-local-toolkit', version: 1, settings: {}, schemes: [] };
      for (var i = 0; i < imported.schemes.length; i++) putScheme(current.schemes, imported.schemes[i]);
      current.settings = settingsPaths(imported.settings, false);
      write(dataFile(), current);
      return AELocalToolkit.returnResult({ ok: true });
    } catch (e) { return AELocalToolkit.error(e); }
  }
  return { readData: readData, loadSettings: loadSettings, saveSettings: saveSettings, listSchemes: listSchemes, saveScheme: saveScheme, deleteScheme: deleteScheme, exportData: exportData, importData: importData };
})();
