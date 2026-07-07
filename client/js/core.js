// ============================================================================
// AE Local Toolkit — 前端核心引导 (client/js/core.js)
// ----------------------------------------------------------------------------
// 建立全局命名空间 window.AELT，并声明所有模块共享的运行时状态 state、
// DOM 元素缓存 els，以及 JSON 加载失败时的内置兜底数据(fallback*)。
// 采用与 host 端一致的“全局命名空间 + 多脚本顺序加载”范式，无构建步骤。
// 其余模块(util/ui/organizer/expressions/scripts/app)均依赖此处声明的
// 全局变量，因此本文件必须最先加载。
// ============================================================================

// 全局命名空间：所有模块都会把自身挂载到 window.AELT 之下，便于控制台调试。
window.AELT = window.AELT || {};

  var state = {
    rules: null,
    organizerSchemes: [],
    selectedSchemeId: "preset-default",
    changelog: null,
    expressions: [],
    selectedExpressionId: null,
    debugEntries: [],
    quietMode: false,
    debugMode: false,
    scriptFolder: "",
    scripts: [],
    scriptSearch: "",
    favFilterOn: false,
    favorites: [],
    selectedScriptFsName: null
  };

  var els = {};

  var fallbackRules = {
    id: "preset-default",
    name: "默认整理方案",
    version: 1,
    builtin: true,
    fallbackFolder: "Footage",
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

  var fallbackExpressions = {
    version: 1,
    expressions: [
      {
        id: "wiggle-basic",
        name: "基础抖动",
        category: "常用",
        description: "为选中属性添加基础随机抖动。",
        code: "wiggle(5, 20)",
        tags: ["wiggle", "抖动", "随机"],
        builtin: true,
        favorite: false
      },
      {
        id: "blink-opacity",
        name: "透明度闪烁",
        category: "动画",
        description: "让透明度在显示和隐藏之间闪烁。",
        code: "Math.sin(time * 10) > 0 ? 100 : 0",
        tags: ["opacity", "闪烁"],
        builtin: true,
        favorite: false
      }
    ]
  };

  function $(id) {
    return document.getElementById(id);
  }


// 将共享状态与 DOM 缓存暴露到命名空间，方便外部读取；
// 内部模块之间仍直接使用全局名 state / els，行为与单体版本一致。
AELT.state = state;
AELT.els = els;
