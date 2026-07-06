/**
 * AE Local Toolkit - 脚本启动器模块
 * 扫描本地文件夹中的 .jsx / .jsxbin 脚本文件，
 * 提供脚本浏览和运行功能
 */
var AELocalToolkit = AELocalToolkit || {};
AELocalToolkit.launcher = (function() {

  function scanScripts(folderPath) {
    var result = { ok: true, folder: folderPath, scripts: [], messages: [] };
    try {
      var folder = new Folder(folderPath);
      if (!folder.exists) {
        result.ok = false;
        result.messages.push("\u6587\u4ef6\u5939\u4e0d\u5b58\u5728: " + folderPath);
        return result;
      }
      result.scripts = collectScripts(folder, folder.fsName);
    } catch (e) {
      result.ok = false;
      result.messages.push(e.toString());
    }
    return result;
  }

  function collectScripts(folder, basePath) {
    var items = folder.getFiles();
    items.sort(sortByName);
    var files = [];
    for (var i = 0; i < items.length; i++) {
      if (items[i] instanceof Folder) {
        if (!items[i].name.match(/^\(.*\)$/))
          files = files.concat(collectScripts(items[i], basePath));
      } else if (items[i].name.match(/\.(jsx|jsxbin)$/)) {
        var fsName = items[i].fsName;
        files.push({
          name: items[i].name.replace(/\.(jsx|jsxbin)$/, ""),
          relativePath: fsName.substr(basePath.length + 1),
          absoluteURI: items[i].absoluteURI,
          fsName: fsName,
          hasIcon: File(fsName.replace(/\.(jsx|jsxbin)$/, ".png")).exists
        });
      }
    }
    return files;
  }

  function sortByName(a, b) {
    var na = a.name.toLowerCase(), nb = b.name.toLowerCase();
    return na < nb ? -1 : na > nb ? 1 : 0;
  }

  function launchScript(filePath) {
    var result = { ok: true, file: filePath, messages: [] };
    try {
      var file = new File(filePath);
      if (!file.exists) {
        result.ok = false;
        result.messages.push("\u627e\u4e0d\u5230\u811a\u672c\u6587\u4ef6: " + filePath);
        return result;
      }
      $.evalFile(file);
    } catch (e) {
      result.ok = false;
      result.messages.push("\u811a\u672c\u8fd0\u884c\u51fa\u9519: " + e.toString());
    }
    return result;
  }

  return {
    scanScripts: scanScripts,
    launchScript: launchScript
  };
})();
