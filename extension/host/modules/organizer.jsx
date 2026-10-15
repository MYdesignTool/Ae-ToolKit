/**
 * AE Local Toolkit - 工程整理模块
 * 根据预定义规则自动分类 AE 项目中的素材至对应文件夹，
 * 支持多方案管理、嵌套文件夹、空文件夹清理等功能
 */
AELocalToolkit = AELocalToolkit || {};
AELocalToolkit.organizer = (function () {

  function createSummary() {
    return {
      ok: true,
      moved: 0,
      skipped: 0,
      errors: 0,
      removedEmptyFolders: 0,
      ignoredMainComp: 0,
      folders: [],
      messages: []
    };
  }

  function incrementFolder(summary, folderPath) {
    for (var i=0; i<summary.folders.length; i++) {
      if (summary.folders[i].path === folderPath) { summary.folders[i].count++; return; }
    }
    summary.folders.push({path:folderPath,count:1});
  }

  function findChildFolder(parentFolder, folderName) {
    for (var i = 1; i <= parentFolder.numItems; i++) {
      var item = parentFolder.item(i);
      if (item instanceof FolderItem && item.name === folderName) {
        return item;
      }
    }
    return null;
  }

  function normalizePath(path) {
    var parts = String(path || "").replace(/\\/g, "/").split("/");
    var clean = [];
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].replace(/^\s+|\s+$/g, "");
      if (part) clean.push(part);
    }
    return clean.join("/");
  }

  function getOrCreateFolderPath(project, rootFolder, folderPath) {
    var normalized = normalizePath(folderPath);
    var parts = normalized.split("/");
    var parent = rootFolder;
    for (var i = 0; i < parts.length; i++) {
      var existing = findChildFolder(parent, parts[i]);
      if (!existing) {
        existing = project.items.addFolder(parts[i]);
        existing.parentFolder = parent;
      }
      parent = existing;
    }
    return parent;
  }

  function getFileExtension(item) {
    try {
      if (!item.file || !item.file.name) return "";
      var parts = item.file.name.split(".");
      if (parts.length < 2) return "";
      var ext = parts[parts.length - 1].toUpperCase();
      return ext;
    } catch (e) {
      return "";
    }
  }

  // 预建「扩展名 → 目标文件夹路径」查表，分类时 O(1) 命中，避免逐规则遍历。
  // 同名扩展名以首个匹配规则为准。
  function buildExtensionMap(scheme) {
    var map = {};
    for (var i = 0; i < scheme.rules.length; i++) {
      var extensions = scheme.rules[i].extensions || [];
      for (var j = 0; j < extensions.length; j++) {
        var ext = String(extensions[j]).toUpperCase();
        if (ext && !map.hasOwnProperty(ext)) {
          map[ext] = scheme.rules[i].path;
        }
      }
    }
    return map;
  }

  function moveToFolder(item, folder, folderPath, summary) {
    if (item.parentFolder === folder) {
      summary.skipped++;
      incrementFolder(summary, folderPath);
      return;
    }
    item.parentFolder = folder;
    summary.moved++;
    incrementFolder(summary, folderPath);
  }

  // ===== 忽略主合成（全局设置） =====
  // 解析名称名单：支持字符串（逗号/空格/换行/中文逗号/分号分隔）或数组，去空白、去空项。
  function parseIgnoreNames(raw) {
    if (!raw) return [];
    var arr = (typeof raw === "string") ? raw.split(/[\s,，;；]+/) : raw;
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var n = String(arr[i]).replace(/^\s+|\s+$/g, "");
      if (n) out.push(n);
    }
    return out;
  }

  function getEffectiveIgnoreConfig(scheme) {
    return { enabled: scheme.ignoreMainComp === true, names: parseIgnoreNames(scheme.ignoreMainCompNames), fuzzy: scheme.ignoreMainCompFuzzy === true };
  }

  // fuzzy=true 时为“包含式”部分匹配（名称含名单任一项即命中，仍忽略大小写）；
  // fuzzy=false 时为精确匹配（不区分大小写）。
  function nameMatchesIgnore(itemName, names, fuzzy) {
    if (!names || !names.length) return false;
    var target = String(itemName || "").toLowerCase();
    for (var i = 0; i < names.length; i++) {
      var n = String(names[i]).toLowerCase();
      if (fuzzy) {
        if (target.indexOf(n) !== -1) return true;
      } else {
        if (target === n) return true;
      }
    }
    return false;
  }

  // 将素材移到工程根目录（若已在根目录则跳过）。
  function moveToRoot(item, rootFolder, summary) {
    if (item.parentFolder === rootFolder) {
      summary.skipped++;
      return;
    }
    item.parentFolder = rootFolder;
    summary.moved++;
  }

  function classifyItem(item, scheme, extMap, folders, summary, rootFolder, ignoreConfig) {
    try {
      if (item instanceof CompItem) {
        // 忽略主合成：命中名称名单的合成留在工程根目录，不进入 Comp 文件夹。
        if (ignoreConfig && ignoreConfig.enabled && nameMatchesIgnore(item.name, ignoreConfig.names, ignoreConfig.fuzzy)) {
          moveToRoot(item, rootFolder, summary);
          summary.ignoredMainComp = (summary.ignoredMainComp || 0) + 1;
          return;
        }
        var compRule = findRuleByItemType(scheme, "CompItem");
        var compPath = compRule ? compRule.path : "Comp";
        moveToFolder(item, folders["$" + compPath], compPath, summary);
        return;
      }

      if (item.mainSource instanceof SolidSource) {
        var solidRule = findRuleByItemType(scheme, "SolidSource");
        var solidPath = solidRule ? solidRule.path : "Solids";
        moveToFolder(item, folders["$" + solidPath], solidPath, summary);
        return;
      }

      var ext = getFileExtension(item);
      var targetPath = (ext && extMap[ext]) ? extMap[ext] : scheme.fallbackPath;
      moveToFolder(item, folders["$" + targetPath], targetPath, summary);
    } catch (e) {
      summary.errors++;
      summary.messages.push("Classify failed: " + item.name + " / " + e.toString());
    }
  }

  function findRuleByItemType(scheme, itemType) {
    for (var i = 0; i < scheme.rules.length; i++) {
      var itemTypes = scheme.rules[i].itemTypes || [];
      for (var j = 0; j < itemTypes.length; j++) {
        if (itemTypes[j] === itemType) return scheme.rules[i];
      }
    }
    return null;
  }

  function purgeEmptyFolders(folder, rootFolder, summary) {
    for (var i = folder.numItems; i >= 1; i--) {
      var subItem = folder.item(i);
      if (subItem instanceof FolderItem) {
        purgeEmptyFolders(subItem, rootFolder, summary);
      }
    }

    if (folder !== rootFolder && folder.numItems === 0) {
      try {
        folder.remove();
        summary.removedEmptyFolders++;
      } catch (e) {
        summary.errors++;
        summary.messages.push("Remove empty folder failed: " + folder.name + " / " + e.toString());
      }
    }
  }

  function normalizeScheme(scheme) {
    if (!scheme || !scheme.rules || !(scheme.rules instanceof Array)) {
      throw new Error("整理方案缺少规则，请重新加载方案。");
    }

    var normalized = {
      id: scheme.id || "custom",
      name: scheme.name || "整理方案",
      builtin: scheme.builtin === true,
      fallbackPath: normalizePath(scheme.fallbackPath || "Footage"),
      ignoreMainComp: scheme.ignoreMainComp === true,
      ignoreMainCompNames: scheme.ignoreMainCompNames || "",
      ignoreMainCompFuzzy: scheme.ignoreMainCompFuzzy === true,
      rules: []
    };

    for (var i = 0; i < scheme.rules.length; i++) {
      var rule = scheme.rules[i];
      var path = normalizePath(rule.path || rule.name || "");
      if (!path) throw new Error("整理规则缺少文件夹路径。");
      normalized.rules.push({
        path: path,
        itemTypes: rule.itemTypes || [],
        extensions: normalizeExtensions(rule.extensions || [])
      });
    }

    if (!normalized.fallbackPath) normalized.fallbackPath = "Footage";
    return normalized;
  }

  function normalizeExtensions(extensions) {
    var result = [];
    for (var i = 0; i < extensions.length; i++) {
      var ext = String(extensions[i] || "").replace(/^\s+|\s+$/g, "").replace(/^\./, "").toUpperCase();
      if (ext) result.push(ext);
    }
    return result;
  }

  function collectTargetPaths(scheme) {
    var paths = {};
    for (var i = 0; i < scheme.rules.length; i++) {
      paths["$" + scheme.rules[i].path] = true;
    }
    paths["$" + scheme.fallbackPath] = true;
    return paths;
  }

  function organizeProjectWithScheme(scheme) {
    var summary = createSummary();
    scheme = normalizeScheme(scheme);
    summary.scheme = scheme.name;
    var ignoreConfig = getEffectiveIgnoreConfig(scheme);

    if (!app.project) {
      summary.ok = false;
      summary.messages.push("No AE project is open.");
      return summary;
    }

    app.beginUndoGroup("AE Local Toolkit - Organize Project");
    try {
      var project = app.project;
      var rootFolder = project.rootFolder;
      var folders = {};
      var allItems = [];
      var targetPaths = collectTargetPaths(scheme);
      var compRule = findRuleByItemType(scheme, 'CompItem');
      var solidRule = findRuleByItemType(scheme, 'SolidSource');
      targetPaths['$' + (compRule ? compRule.path : 'Comp')] = true;
      targetPaths['$' + (solidRule ? solidRule.path : 'Solids')] = true;

      for (var folderPath in targetPaths) {
        if (Object.prototype.hasOwnProperty.call(targetPaths, folderPath)) {
          folders[folderPath] = getOrCreateFolderPath(project, rootFolder, folderPath.slice(1));
        }
      }

      for (var i = 1; i <= project.numItems; i++) {
        var item = project.item(i);
        if (!(item instanceof FolderItem)) {
          allItems.push(item);
        }
      }

      // 单遍整理：直接把每个素材移到其目标文件夹（已在目标则跳过），
      // 省去“先全部移到根再分类”的二次重挂载，重挂载次数减半。
      var extMap = buildExtensionMap(scheme);
      for (var k = 0; k < allItems.length; k++) {
        classifyItem(allItems[k], scheme, extMap, folders, summary, rootFolder, ignoreConfig);
      }

      purgeEmptyFolders(rootFolder, rootFolder, summary);
    } catch (e) {
      summary.ok = false;
      summary.errors++;
      summary.messages.push(e.toString());
    } finally {
      app.endUndoGroup();
    }

    summary.ok = summary.ok && summary.errors === 0;
    return summary;
  }


  return {
    organizeProjectWithScheme: organizeProjectWithScheme
  };
})();
