// Ae-ToolKit 发布页 · 代码展示（截取自本地仓库 D:\Project\Code\AeLocalToolkit）
// 使用 String.raw 保留源码中的反斜杠与转义，textContent 注入避免 HTML 注入

(function () {
  "use strict";

  var META = {
    organizer: "host/modules/organizer.jsx",
    expressions: "host/modules/expressions.jsx",
    launcher: "host/modules/launcher.jsx"
  };

  var SNIPPETS = {
    organizer: String.raw`var defaultScheme = {
  id: "preset-default",
  name: "默认整理方案",
  builtin: true,
  fallbackPath: "Footage",
  rules: [
    { path: "Comp",  itemTypes: ["CompItem"], extensions: [] },
    { path: "Image", itemTypes: [], extensions: ["PNG","JPG","TIFF","EXR","WEBP"] },
    { path: "Video", itemTypes: [], extensions: ["MP4","MOV","MKV","WEBM"] },
    { path: "Audio", itemTypes: [], extensions: ["MP3","WAV","FLAC"] },
    { path: "Footage", itemTypes: [], extensions: [] }
  ]
};`,

    expressions: String.raw`function applyExpression(expression, overwrite) {
  var summary = resultBase();
  var selected = getSelectedProperties();
  if (!selected.ok) return summary;

  app.beginUndoGroup("AE Local Toolkit");
  for (var i = 0; i < selected.properties.length; i++) {
    var prop = selected.properties[i];
    if (hasExpression(prop) && !overwrite) {
      summary.existing++; continue;
    }
    try {
      prop.expression = expression;
      prop.expressionEnabled = true;
      summary.applied++;
    } catch (e) { summary.errors++; }
  }
  app.endUndoGroup();
  return summary;
}`,

    launcher: String.raw`function collectScripts(folder, basePath) {
  var items = folder.getFiles();
  items.sort(sortByName);
  var files = [];
  for (var i = 0; i < items.length; i++) {
    if (items[i] instanceof Folder)
      files = files.concat(collectScripts(items[i], basePath));
    else if (items[i].name.match(/\.(jsx|jsxbin)$/))
      files.push({ name: items[i].name, fsName: items[i].fsName });
  }
  return files;
}

function launchScript(filePath) {
  var file = new File(decodeURI(filePath));
  if (!file.exists) return { ok: false };
  $.evalFile(file);
  return { ok: true };
}`
  };

  function init() {
    var view = document.getElementById("code-view");
    var fileEl = document.getElementById("code-file");
    var copyBtn = document.getElementById("code-copy");
    var tabs = document.querySelectorAll(".code-tab");
    if (!view || !tabs.length) return;

    var current = "organizer";

    function render(key) {
      current = key;
      view.textContent = SNIPPETS[key] || "";
      if (fileEl) fileEl.textContent = META[key] || "";
      if (window.hljs) {
        try {
          view.removeAttribute("data-highlighted");
          window.hljs.highlightElement(view);
        } catch (e) {}
      }
      tabs.forEach(function (t) {
        t.classList.toggle("active", t.getAttribute("data-key") === key);
      });
    }

    tabs.forEach(function (t) {
      t.addEventListener("click", function () {
        render(t.getAttribute("data-key"));
      });
    });

    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var text = SNIPPETS[current] || "";
        var done = function () {
          var old = copyBtn.textContent;
          copyBtn.textContent = "已复制";
          setTimeout(function () { copyBtn.textContent = old; }, 1400);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, done);
        } else {
          done();
        }
      });
    }

    render("organizer");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
