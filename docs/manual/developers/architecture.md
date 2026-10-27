# 架构与加载流程

0.6.1 共享前端新增 `expression-help.js`、`completion.js` 与 `selects.js`：离线词库与帮助使用 CodeMirror 原生输入和撤销历史；所有单选下拉共用带动画的可见控件，原 select 保留值和 change 事件。表达式标签筛选在会话中取全部所选标签的交集；变换目标仅在没有明确属性选择时解析。宿主使用显式 `if / else` 判断属性优先，避免旧 ExtendScript 连续三元表达式的结合顺序差异。详细边界见[共享模块说明](https://github.com/MYdesignTool/Ae-ToolKit/blob/main/extension/docs/architecture.md)。

## 目录与平台分工

```text
extension/
├── CSXS/manifest.xml        macOS CEP 清单及 JSX 根目录校验
├── client/                 两平台共用 HTML、CSS 与 JavaScript
│   ├── js/native-bridge.js  Windows 原生传输适配
│   ├── js/                 功能模块、设置、国际化和桥接工具
│   └── vendor/             随程序分发的编辑器与解析工具
├── host/                   两平台共用 ExtendScript 业务
│   ├── index.jsx           CEP 初始化与 AELT_* 入口
│   ├── lib/json.jsx        ES3 兼容 JSON 处理
│   └── modules/            storage、organizer、expressions、launcher
├── data/                   内置默认 JSON 与运行时个人数据
└── installer/              平台白名单与 Windows NSIS 安装器
native/
├── panel-host/             Windows AEGP + WebView2 公共宿主
├── toolkit/                工具箱原生使用方、JSX 工厂与开发部署
└── build/                  固定依赖、源码构建和完整性校验
```

Windows 正式版安装于所选 AE 的 `Plug-ins/AeltToolkitWebView2/`，共享界面和 JSX 位于其 `extension/` 下；macOS 以 `AeLocalToolkit/` 作为 CEP 根目录。两平台共用业务源码，各自保存数据。

## 面板与传输选择

`native-bridge.js` 在 `core.js` 之前加载。仅当原生配置和 WebView2 同时存在时，建立 `AeltNativeBridge`；否则继续使用 CEP 路径。功能模块统一通过 `callHost(name, args, callback)` 调用，不直接依赖某个平台的传输 API。

| 路径 | 调用传输 | JSX 执行环境 |
| --- | --- | --- |
| macOS CEP / 旧 CEP 开发路径 | CEP `evalScript` | 现有全局 Host 入口 |
| Windows 原生版 | WebView2 消息 → 有界队列 → AE idle | C++ 生成的 JSX 词法闭包，缓存于独立命名空间 |

原生桥接仅开放 17 个既有业务方法和受限 HTTP(S) 外链，没有通用 eval API。原生闭包不覆盖 CEP 的全局对象，两套状态与扫描集合相互独立。

## 初始化

CEP 从面板 URL 获取扩展根目录，调用 `AELT_setModuleBase` 校验并加载 JSON、存储、整理、表达式和脚本模块，再由 `AELT_bootstrap` 读取默认数据。原生使用方通过生成的闭包包装执行共享 JSX；新增业务方法时，需同时维护原生允许列表和包装实现。

新增面板模块要在 `client/index.html` 中按依赖顺序插入；新增 Host 模块要同时维护模块加载与两平台导出入口。启动失败应明确报告，不扫描其他扩展或复制临时脚本启动。

## 兼容与生命周期

- 共用前端保持 CEP 11 / Chromium 88 兼容；原生 WebView2 的新能力不能直接成为共用功能的前置条件。
- Host 保持 ES3 语法。内置文本模块按 UTF-8 读取，用户选择的第三方脚本由 `$.evalFile` 执行。
- 表达式语法解析和格式化在本地面板进行，实际求值由 AE 完成；编辑器依赖本地分发，无运行时 CDN。
- 原生请求在 AE idle 执行，避免浏览器回调直接打开宿主模态对话框。
- 原生文档关闭后，只有已接收的设置快照允许完成；整理、表达式和脚本操作会在文档失效时丢弃，不自动重试。
- 修改 AEX 前退出 AE；CEP 前端重载不能替代原生插件重新加载。

详情见[原生工具箱](https://github.com/MYdesignTool/Ae-ToolKit/blob/main/native/toolkit/README.md)与[架构记录](https://github.com/MYdesignTool/Ae-ToolKit/blob/main/extension/docs/architecture.md)。
