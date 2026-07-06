var AELocalToolkit = AELocalToolkit || {};
AELocalToolkit.organizer = (function () {
  var defaultScheme = {
    id: "preset-default",
    name: "默认整理方案",
    builtin: true,
    fallbackPath: "Footage",
    rules: [
      { path: "Comp", itemTypes: ["CompItem"], extensions: [] },
      { path: "Image", itemTypes: [], extensions: ["JPEG", "JPG", "PNG", "TIFF", "GIF", "BMP", "SWF", "EXR", "WEBP"] },
      { path: "Video", itemTypes: [], extensions: ["AVI", "MP4", "MOV", "MPEG2", "MKV", "M4V", "WEBM"] },
      { path: "Audio", itemTypes: [], extensions: ["MP3", "WAV", "AIFF", "AAC", "FLAC"] },
      { path: "PSD", itemTypes: [], extensions: ["PSD", "PSB"] },
      { path: "Live2D", itemTypes: [], extensions: ["CAE"] },
      { path: "3D", itemTypes: [], extensions: ["OBJ", "FBX", "GLTF"] },
      { path: "Solids", itemTypes: ["SolidSource"], extensions: [] },
      { path: "Footage", itemTypes: [], extensions: [] }
    ]
  };

  function createSummary() {
    return {
      ok: true,
      moved: 0,
      skipped: 0,
      errors: 0,
      removedEmptyFolders: 0,
      folders: {},
      messages: []
    };
  }

  function incrementFolder(summary, folderPath) {
    if (!summary.folders[folderPath]) summary.folders[folderPath] = 0;
    summary.folders[folderPath]++;
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
      return ext.length <= 5 ? ext : "";
    } catch (e) {
      return "";
    }
  }

  function findRuleByExtension(scheme, ext) {
    for (var i = 0; i < scheme.rules.length; i++) {
      var extensions = scheme.rules[i].extensions || [];
      for (var j = 0; j < extensions.length; j++) {
        if (String(extensions[j]).toUpperCase() === ext) {
          return scheme.rules[i];
        }
      }
    }
    return null;
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

  function classifyItem(item, scheme, folders, summary) {
    try {
      if (item instanceof CompItem) {
        var compRule = findRuleByItemType(scheme, "CompItem");
        var compPath = compRule ? compRule.path : "Comp";
        moveToFolder(item, folders[compPath], compPath, summary);
        return;
      }

      if (item.mainSource instanceof SolidSource) {
        var solidRule = findRuleByItemType(scheme, "SolidSource");
        var solidPath = solidRule ? solidRule.path : "Solids";
        moveToFolder(item, folders[solidPath], solidPath, summary);
        return;
      }

      var ext = getFileExtension(item);
      var rule = ext ? findRuleByExtension(scheme, ext) : null;
      var targetPath = rule ? rule.path : scheme.fallbackPath;
      moveToFolder(item, folders[targetPath], targetPath, summary);
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
      scheme = defaultScheme;
    }

    var normalized = {
      id: scheme.id || "custom",
      name: scheme.name || "整理方案",
      builtin: scheme.builtin === true,
      fallbackPath: normalizePath(scheme.fallbackPath || "Footage"),
      rules: []
    };

    for (var i = 0; i < scheme.rules.length; i++) {
      var rule = scheme.rules[i];
      var path = normalizePath(rule.path || rule.name || "");
      if (!path) continue;
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
      paths[scheme.rules[i].path] = true;
    }
    paths[scheme.fallbackPath] = true;
    return paths;
  }

  function organizeProjectWithScheme(scheme) {
    var summary = createSummary();
    scheme = normalizeScheme(scheme);
    summary.scheme = scheme.name;

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

      for (var folderPath in targetPaths) {
        if (targetPaths.hasOwnProperty(folderPath)) {
          folders[folderPath] = getOrCreateFolderPath(project, rootFolder, folderPath);
        }
      }

      for (var i = 1; i <= project.numItems; i++) {
        var item = project.item(i);
        if (!(item instanceof FolderItem)) {
          allItems.push(item);
        }
      }

      for (var j = 0; j < allItems.length; j++) {
        try {
          if (allItems[j].parentFolder !== rootFolder) {
            allItems[j].parentFolder = rootFolder;
          }
        } catch (moveError) {
          summary.errors++;
          summary.messages.push("Move to root failed: " + allItems[j].name + " / " + moveError.toString());
        }
      }

      for (var k = 0; k < allItems.length; k++) {
        classifyItem(allItems[k], scheme, folders, summary);
      }

      purgeEmptyFolders(rootFolder, rootFolder, summary);
    } catch (e) {
      summary.ok = false;
      summary.errors++;
      summary.messages.push(e.toString());
    } finally {
      app.endUndoGroup();
    }

    return summary;
  }

  function organizeProject() {
    return organizeProjectWithScheme(defaultScheme);
  }

  return {
    organizeProject: organizeProject,
    organizeProjectWithScheme: organizeProjectWithScheme,
    defaultScheme: defaultScheme
  };
})();