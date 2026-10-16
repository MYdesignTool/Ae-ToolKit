// Ae-ToolKit 发布页 · API 使用示例（非源码镜像）
// 示例通过 textContent 显示，复制失败会明确提示。

(function () {
  "use strict";

  var english, labels;

  var META = {
    organizer: "host/modules/organizer.jsx",
    expressions: "host/modules/expressions.jsx",
    launcher: "host/modules/launcher.jsx"
  };

  var SNIPPETS = {
    organizer: 'AELocalToolkit.organizer.organizeProjectWithScheme({\n  name: "素材整理",\n  fallbackPath: "Footage",\n  rules: [\n    { path: "Image", itemTypes: [], extensions: ["PNG", "JPG"] },\n    { path: "Video", itemTypes: [], extensions: ["MP4", "MOV"] }\n  ]\n});',
    expressions: '// 默认保留已有表达式\nAELocalToolkit.expressions.applyExpression(\n  "wiggle(5, 20)",\n  false\n);\n\n// 整批操作可在 AE 中一次撤销。',
    launcher: '// 先扫描用户选择的脚本目录\nvar result = AELocalToolkit.launcher.scanScripts(folderPath);\n\n// 只运行此次扫描找到的 JSX / JSXBIN 文件\nif (result.ok && result.scripts.length) {\n  AELocalToolkit.launcher.launchScript(result.scripts[0].fsName);\n}'
  };

  var ORIGINAL_SNIPPETS = Object.assign({}, SNIPPETS);
  function localize() {
    english = document.documentElement.lang === "en";
    labels = english ? {copy:"Copy", copied:"Copied", failed:"Copy failed; select manually", manual:"Select and copy the code manually"} : {copy:"复制", copied:"已复制", failed:"复制失败，请手动选择", manual:"请手动选择代码复制"};
    SNIPPETS = Object.assign({}, ORIGINAL_SNIPPETS);
    if (english) {
      var translations = {"素材整理":"Asset organization", "// 默认保留已有表达式":"// Keep existing expressions by default", "// 整批操作可在 AE 中一次撤销。":"// Undo the entire batch in one step in AE.", "// 先扫描用户选择的脚本目录":"// Scan the script folder selected by the user", "// 只运行此次扫描找到的 JSX / JSXBIN 文件":"// Run only JSX / JSXBIN files found by this scan"};
      Object.keys(SNIPPETS).forEach(function (key) {
        Object.keys(translations).forEach(function (source) { SNIPPETS[key] = SNIPPETS[key].split(source).join(translations[source]); });
      });
    }
  }
  localize();

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
      tabs.forEach(function (t) {
        t.classList.toggle("active", t.getAttribute("data-key") === key);
        t.setAttribute('aria-pressed', String(t.getAttribute('data-key')===key));
      });
    }

    tabs.forEach(function (t) {
      t.addEventListener("click", function () {
        render(t.getAttribute("data-key"));
      });
    });

    var copyTimer;
    function copiedLabel(text) { clearTimeout(copyTimer); copyBtn.textContent=text; copyTimer=setTimeout(function () { copyBtn.textContent=labels.copy; },1800); }
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var text = SNIPPETS[current] || "";
        var done = function () { copiedLabel(labels.copied); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () { copiedLabel(labels.failed); });
        } else {
          copiedLabel(labels.manual);
        }
      });
    }

    document.addEventListener("site-language-change", function () {
      localize();
      clearTimeout(copyTimer);
      if (copyBtn) copyBtn.textContent = labels.copy;
      render(current);
    });
    render("organizer");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
