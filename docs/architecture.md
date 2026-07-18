# 架构说明
# Architecture Notes

## Local-Only Principle

The panel does not call remote APIs. V1 data lives in:

- Shipped JSON files under `data/`
- `data/settings.json` for user settings (favorites, folders, toggles, custom expressions); `data/settings.default.json` is the cloud default
- `data/organizer-schemes/` for user-saved organize schemes (git-ignored); built-in default rules ship as `organizer-rules.json`
- AE project state through host JSX calls

## Runtime Layers

| Layer | Path | Purpose |
| --- | --- | --- |
| CEP manifest | `CSXS/manifest.xml` | Registers the AE panel |
| Panel UI | `client/` | 模块化前端：`js/core.js`(状态/兜底) + `js/util.js`(工具) + `js/ui.js`(面板/调试/设置) + `js/organizer.js`(整理) + `js/expressions.js`(表达式) + `js/scripts.js`(脚本启动器) + `js/app.js`(入口) |
| AE host script | `host/index.jsx` | Runs ExtendScript inside After Effects |
| Data | `data/` | Stores default rules, default expressions, changelog; per-device `settings.json` (user settings; `settings.default.json` is the cloud default, auto-created as a clean config copy on first launch if missing); per-device `organizer-schemes/` (user-saved organize schemes, git-ignored; built-in default rules ship as `organizer-rules.json`) |
| Docs | `docs/` | Install and architecture notes |

## Host API

前端通过 `evalScript` 调用以下全局 JSX 函数，每个函数返回 JSON 字符串（含简短结果摘要）：

### 整理（Organizer）
- `AELT_organizeProject()` — 使用默认方案整理当前工程
- `AELT_organizeProjectWithScheme(schemeJson)` — 使用指定方案（JSON 字符串）整理
- `AELT_loadOrganizerSchemes()` — 加载全部整理方案（内置默认 + 本地 `data/organizer-schemes/`）
- `AELT_saveOrganizerScheme(schemeJson)` — 保存方案到 `data/organizer-schemes/`
- `AELT_deleteOrganizerScheme(id)` — 删除指定方案

### 表达式（Expressions）
- `AELT_getSelectedPropertySummary()` — 获取选中属性摘要
- `AELT_applyExpression(expression, overwriteExisting)` — 应用表达式
- `AELT_removeExpressions()` — 移除表达式

### 设置（Settings）
- `AELT_loadSettings()` — 读取 `data/settings.json`（缺失时回退 `settings.default.json`）
- `AELT_saveSettings(jsonText)` — 写入 `data/settings.json`

### 脚本启动器（Script Launcher）
- `AELT_selectScriptFolder()` — 弹出文件夹选择对话框
- `AELT_scanScripts(folderPath)` — 扫描脚本
- `AELT_launchScript(filePath)` — 运行脚本

### 通用（Common）
- `AELT_setModuleBase(path)` — 注入扩展根目录
- `AELT_ping()` — 连接检测
- `AELT_readFile(path)` — 读取扩展内文件（如 `data/changelog.json`）

## Extension Points

前端与主机均已模块化，沿用“全局命名空间 + 多文件顺序加载”范式，无构建步骤：

- 主机端：`host/index.jsx` 为入口，脚本启动器逻辑已内联其中；其余模块（如 `host/modules/organizer.jsx`）通过 `$.evalFile` 加载，统一挂在 `AELocalToolkit` 命名空间。
- 前端：`client/index.html` 按依赖顺序加载 `client/js/` 下的 core → util → ui → organizer → expressions → scripts → app，模块函数均为全局函数，并挂到 `window.AELT` 命名空间下供调试。

新增功能建议遵循此模式：

1. 主机逻辑放入 `host/modules/` 对应模块，并暴露一个 `AELT_*` 函数。
2. 前端调用位于 `client/js/` 对应模块（如整理在 organizer.js、表达式在 expressions.js）。
3. 调试时通过 Debug 面板查看原始返回。
4. 默认数据放入 `data/`（含 `settings.default.json` 默认设置）；用户数据（收藏/文件夹/开关/自定义表达式）放入设备本地的 `data/settings.json`，该文件被 `.gitignore` 忽略，不会污染版本控制。

---

### 架构概览

AE Local Toolkit 遵循纯本地原则：
- 不调用远程 API，所有数据存储在本地
- 数据来源：data/ 下的 JSON 文件（含设备本地 `settings.json` 与 `organizer-schemes/`）+ AE 项目状态
- 运行时层次：CEP 清单 -> 前端 UI -> ExtendScript 主机操作 AE
- API 通信：前端通过 evalScript 调用 AELT_* 函数，主机返回 JSON 结果
- 扩展机制：新增模块需添加 JSX 逻辑 + 暴露 AELT_* 函数 + 在前端中调用