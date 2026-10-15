/* CEP entry. The panel supplies its own root once; no global directory scan. */
var AELocalToolkit = AELocalToolkit || {};
AELocalToolkit.moduleBase = null;
AELocalToolkit.loadErrors = [];

AELocalToolkit.returnResult = function (result) {
  return AELocalToolkit.json.stringify(result);
};
AELocalToolkit.error = function (error) {
  return AELocalToolkit.returnResult({ ok: false, messages: [String(error)] });
};
function AELT_setModuleBase(path) {
  var root = new Folder(path);
  AELocalToolkit.loadErrors = [];
  try {
    if (!new File(root.fullName + '/CSXS/manifest.xml').exists) throw new Error('扩展根目录无效');
    if (AELocalToolkit.moduleBase === root.fullName && AELocalToolkit.ready) {
      return AELocalToolkit.returnResult({ ok: true, moduleBase: root.fullName });
    }
    AELocalToolkit.moduleBase = root.fullName;
    AELocalToolkit.ready = false;
    var modules = ['lib/json.jsx', 'modules/storage.jsx', 'modules/organizer.jsx', 'modules/expressions.jsx', 'modules/launcher.jsx'];
    var keys = ['json', 'storage', 'organizer', 'expressions', 'launcher'];
    for (var i = 0; i < modules.length; i++) {
      var file = new File(root.fullName + '/host/' + modules[i]);
      if (!file.exists) throw new Error('缺少模块：' + modules[i]);
      AELocalToolkit[keys[i]] = null;
      $.evalFile(file);
      if (!AELocalToolkit[keys[i]]) throw new Error("模块未执行：" + modules[i]);
    }
    AELocalToolkit.ready = true;
    return AELocalToolkit.returnResult({ ok: true, moduleBase: root.fullName });
  } catch (e) {
    AELocalToolkit.loadErrors.push(String(e));
    // The JSON module can itself be missing; this fixed response requires no serializer.
    if (!AELocalToolkit.json) return '{"ok":false,"messages":["JSON 模块加载失败，请重新安装扩展。"]}';
    return AELocalToolkit.error(e);
  }
}
function AELT_ping() {
  return AELocalToolkit.returnResult({ ok: AELocalToolkit.ready === true, appVersion: app.version, loadErrors: AELocalToolkit.loadErrors });
}
function AELT_bootstrap() {
  try {
    var storage = AELocalToolkit.storage;
    return AELocalToolkit.returnResult({ ok: true, rules: storage.readData('organizer-rules.json'), expressions: storage.readData('default-expressions.json').expressions, changelog: storage.readData('changelog.json') });
  } catch (e) { return AELocalToolkit.error(e); }
}
function AELT_loadSettings() { return AELocalToolkit.storage.loadSettings(); }
function AELT_saveSettings(settings) {
  try { AELocalToolkit.storage.saveSettings(settings); return AELocalToolkit.returnResult({ ok: true }); }
  catch (e) { return AELocalToolkit.error(e); }
}
function AELT_loadOrganizerSchemes() {
  try { return AELocalToolkit.returnResult({ ok: true, schemes: AELocalToolkit.storage.listSchemes() }); }
  catch (e) { return AELocalToolkit.error(e); }
}
function AELT_saveOrganizerScheme(scheme) {
  try { AELocalToolkit.storage.saveScheme(scheme); return AELocalToolkit.returnResult({ ok: true }); }
  catch (e) { return AELocalToolkit.error(e); }
}
function AELT_deleteOrganizerScheme(id) {
  try { AELocalToolkit.storage.deleteScheme(id); return AELocalToolkit.returnResult({ ok: true }); }
  catch (e) { return AELocalToolkit.error(e); }
}
function AELT_organizeProjectWithScheme(scheme) {
  try { return AELocalToolkit.returnResult(AELocalToolkit.organizer.organizeProjectWithScheme(scheme)); }
  catch (e) { return AELocalToolkit.error(e); }
}
function AELT_getSelectedPropertySummary() { return AELocalToolkit.returnResult(AELocalToolkit.expressions.getSelectedPropertySummary()); }
function AELT_applyExpression(expression, overwriteExisting, expectedSelection) { return AELocalToolkit.returnResult(AELocalToolkit.expressions.applyExpression(expression, overwriteExisting, expectedSelection)); }
function AELT_removeExpressions(expectedSelection) { return AELocalToolkit.returnResult(AELocalToolkit.expressions.removeExpressions(expectedSelection)); }
function AELT_selectScriptFolder() {
  var folder = Folder.selectDialog('选择脚本文件夹');
  return AELocalToolkit.returnResult({ ok: true, path: folder ? folder.fsName : '' });
}
function AELT_scanScripts(path) { return AELocalToolkit.returnResult(AELocalToolkit.launcher.scanScripts(path)); }
function AELT_launchScript(path) { return AELocalToolkit.returnResult(AELocalToolkit.launcher.launchScript(path)); }
function AELT_exportUserData() { return AELocalToolkit.storage.exportData(); }
function AELT_importUserData() { return AELocalToolkit.storage.importData(); }
