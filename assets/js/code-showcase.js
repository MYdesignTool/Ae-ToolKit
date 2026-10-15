// Ae-ToolKit 发布页 · API 使用示例（非源码镜像）
// 示例通过 textContent 显示，复制失败会明确提示。

(function () {
  "use strict";

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
    function copiedLabel(text) { clearTimeout(copyTimer); copyBtn.textContent=text; copyTimer=setTimeout(function () { copyBtn.textContent="复制"; },1800); }
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var text = SNIPPETS[current] || "";
        var done = function () { copiedLabel("已复制"); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () { copiedLabel('复制失败，请手动选择'); });
        } else {
          copiedLabel("请手动选择代码复制");
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
