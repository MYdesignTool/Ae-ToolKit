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

 var fallbackChangelog = {
   version: "0.2.1",
   entries: [
     {
       version: "0.2.1",
       date: "2026-07-05",
       changes: [
         "新增: 脚本启动器 — 浏览和运行AE脚本",
         "新增: 脚本收藏功能 — 标记常用脚本",
         "新增: 收藏过滤开关 — 仅显示收藏脚本",
         "新增: 脚本搜索过滤 — 按名称实时筛选",
         "新增: 图标显示 — 脚本旁显示PNG图标",
         "修复: 脚本文件名中文显示乱码",
         "修复: 双击运行脚本无效",
         "修复: 图标与文字重叠",
         "优化: 脚本列表自适应窗口高度"
       ]
     },
     {
       version: "0.1.3",
       date: "2026-06-23",
       changes: [
         "修复: 修改默认整理方案规则后自动创建新方案并保留默认方案。",
         "重构: Host 模块拆分 — organizer 和 expressions 逻辑移至 host/modules/。",
         "新增: 设置页面 — 安静模式开关。",
         "新增: 自定义表达式编辑功能。",
         "修复: 表达式选中自定义表达式时显示更新表达式按钮。"
       ]
     },
     {
       version: "0.1.2",
       date: "2026-06-23",
       changes: [
         "修复：编辑默认方案不再自动创建新方案ID。",
         "修复：保存默认方案时才创建新ID，原预设保留不变。",
         "修复：切换回默认方案时自动恢复原始规则。",
         "新增：Toast 通知系统，操作成功/失败顶部提示。",
         "新增：更新日志弹窗，点击版本号查看。",
         "新增：表达式管理改为下拉选择，更紧凑。",
         "新增：整理模块 UI 紧凑布局，勾选框控制文件类型与 AE 类型。",
         "新增：整理规则列表内部滚动，默认显示3条。",
         "修复：各类错误提示（预设删除、重复类型、表达式等）。"
       ]
     },
     {
       version: "0.1.1",
       date: "2026-06-22",
       changes: [
         "加入内置默认数据兜底，避免 CEP 无法读取本地 JSON 时面板启动失败。",
         "修复自定义表达式在数据加载失败后无法恢复显示的问题。",
         "Debug 页加入本地存储检测按钮。",
         "表达式保存和删除加入存储读写日志。"
       ]
     },
     {
       version: "0.1.0",
       date: "2026-06-22",
       changes: [
         "创建 AE Local Toolkit 初始项目结构。",
         "加入工程整理预制规则。",
         "加入表达式管理第一版功能规划。",
         "加入本地更新日志数据结构。"
       ]
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
