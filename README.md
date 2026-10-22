# AE Local Toolkit

面向 After Effects 2023 及更新版本的离线工具箱：工程整理、脚本启动、批量表达式。当前版本 **0.5.1**。Windows 使用 AEGP + WebView2，macOS 保持 CEP；两平台共用界面与业务源码。

共享界面及 JSX 位于 `extension/`，Windows 原生宿主位于 `native/`；macOS CEP 路径最低支持 CEP 11，并兼容新版 CEP 12。

## 文档

| 文档 | 内容 |
| --- | --- |
| [安装与兼容](extension/docs/install.md) | Windows 安装器、更新与备份、换机迁移、旧数据整合 |
| [架构与维护](extension/docs/architecture.md) | 加载顺序、桥接入口、存储策略与已知限制 |
| [构建安装器](extension/installer/README.md) | NSIS 构建步骤、产物清单与 SHA256 校验 |
| [自动构建与发布](docs/release-automation.md) | 首次启用 Actions、受控 AEX 交付、发版与失败回滚 |
| [原生宿主](native/toolkit/README.md) | Windows 宿主架构、构建与开发部署 |

## 快速开始

[GitHub Releases](https://github.com/MYdesignTool/Ae-ToolKit/releases) 提供 0.5.1：Windows 安装器自动发现 AE，并提供自定义 `Support Files` 路径，安装到 `Plug-ins/AeltToolkitWebView2`，从「窗口」菜单打开；macOS 将 CEP 文件夹放入 `/Library/Application Support/Adobe/CEP/extensions/`，从「窗口 > 扩展」打开。Windows 已有版本可直接运行新安装器覆盖升级，无需先卸载。两版都需允许脚本写入文件和访问网络。具体更新、数据和回退见 [安装说明](extension/docs/install.md)。

## 功能说明

### 批量表达式

1. 在 AE 时间线中展开属性，选中位置、旋转等具体属性；仅选中图层不等于选中属性。
2. 搜索并从下拉框选择表达式，直接在编辑区修改代码，也可清空选择后输入新代码。
3. 查看选中属性数量；回到面板或切换到表达式页时自动刷新，也可手动刷新。
4. 点击「应用到选中属性」，或在编辑器按 Ctrl/Cmd + Enter。已有表达式沿用原来的覆盖确认流程；安静模式沿用原来的免确认设置。
5. 底部状态栏显示成功、跳过和失败数量。失败属性尝试恢复原表达式；整批操作可在 AE 中一次撤销。

「另存为」打开命名弹窗，自定义条目可保存修改或删除。切换条目会提示未保存内容。Tab 在代码编辑器内插入两个空格。界面保留原有的搜索、下拉选择与编辑结构，编辑区随面板高度伸缩，保存操作集中在编辑区标题旁。

0.3.2 加入行号、语法高亮、括号匹配与自动补全、自动缩进和语法错误定位。点击编辑器下方错误提示可跳到对应行列。点击「格式化」或按 Shift+Alt+F 排版，Ctrl/Cmd+Z 可一次撤销格式化；语法错误时保留原稿。基础检查不执行代码，也不判断 AE 属性或运行结果是否有效。设置页「通用设置 > 界面语言」可切换简体中文 / English，即时生效并随个人数据保存。

### 脚本集

在设置中选择脚本目录，扫描 JSX / JSXBIN 文件（不区分大小写）。保留原有的横幅列表、搜索、收藏与刷新；双击脚本运行，键盘 Enter 也可运行。每行只显示一次脚本名称，完整相对路径放在悬停提示中。标准行高 48px、横幅 120×30；窄面板为 44px、96×24。切页时可见行短距离依次向上淡入，收藏有弹性点亮和小粒子；启用系统减少动态效果时自动关闭这些动画。

图片相对于用户选择的脚本目录查找，支持 PNG/JPG/JPEG/WebP/GIF，依次匹配：

1. 根目录 image 中保留子路径的同名图片：`Sub/Tool.jsx` 对应 `image/Sub/Tool.png`。
2. 根目录 image 中的扁平同名图片：`image/Tool.png`。
3. 脚本旁的同名图片：`Sub/Tool.png`。

不绑定某台电脑的路径。原生文件路径转换为浏览器可用的 file URL，正确保留中文、百分号和井号；图片统一放入 4:1 的圆角横幅区域，等比填充并裁切边缘，不拉伸。加载失败或没有图片时使用项目原有的山景占位图。`image` 和括号包围的目录不扫描为脚本；扫描限制为 24 层、20000 项，达到限制会提示。第三方脚本由 AE 执行，具有宿主脚本权限，请使用可信来源。

### 工程整理

选择方案并配置后缀与目标路径。合成、固态层和未匹配素材路径在设置中全局配置；支持忽略指定名称的主合成。素材直接移到目标目录，整理后清除空文件夹，可在 AE 中撤销。

## 数据与备份

设置、脚本收藏、自定义表达式和全部自定义整理方案，统一保存在扩展文件夹内的 `data/user-data.json`。内置默认规则保持单独分发，更新时不会覆盖个人数据。

换电脑：保存完成并关闭 AE 后，Windows 携带整个 `AeltToolkitWebView2` 到目标 AE 的 Plug-ins，macOS 携带整个 `AeLocalToolkit` 到 CEP 目录；也可在新安装中导入 JSON 备份。Windows 的 data 位于插件内 extension 下，macOS 位于 CEP 根下。确保实际 AE 用户可写。`user-data.json` 是完整数据，旁边的 `.bak` 是上一次成功保存前的完整快照；原生安装逻辑更新前还会备份整个 data 到 backups。

脚本目录和收藏如果位于扩展文件夹内，会存为相对路径，移动文件夹后自动对应新位置。例如将脚本放进 `AeLocalToolkit/scripts`，并在设置里选择它；其 `image` 子目录也一并复制。扩展外的脚本、图片和 AE 工程不会被配置文件复制，换电脑时需另行携带，并按实际位置重新选择脚本目录。

首次升级会整合旧版 `data/settings.json`、`data/organizer-schemes/` 以及上一版 `Folder.userData/AE Local Toolkit/` 中的数据，保留所有源文件。如果两处同时存在，上一版用户目录的设置和同 ID 方案优先；其他方案合并。此后始终以本扩展的 `user-data.json` 为准，不会重新导入已删除的旧方案。

保存先写临时文件再替换，失败保留原数据；主文件缺失时恢复 `.bak`。设置页仍可导入、导出完整 JSON 备份。导入源保留为 `last-import.json`；导入前保存 `before-import.json`，替换设置并合并同 ID 方案，最终单次写入完整数据；损坏原文件保留为 `before-import-corrupt.json`。

Windows 安装器首次从匹配 ID 的旧 CEP 备份并迁移个人数据，重定位相对脚本路径；已有原生数据优先。旧 CEP 和脚本原地保留。直接运行新安装器并选择原 AE 即可升级，无需先卸载；更新只覆盖程序和默认 JSON，先备份数据。卸载按安装清单及哈希删除程序，保留个人文件、data、backups 和产品身份。macOS 手动升级合并覆盖程序、保留 data。

## 发布页

`index.html`、`en/index.html` 和 `assets/` 是 GitHub Pages 发布页；部署只包含这几项。页面版本、日期、下载链接与更新摘要由同一份 `extension/data/changelog.json` 生成；GitHub Pages 部署会根据最新正式 Release 选择对应条目，发布或编辑 Release 时也会自动刷新。中文版在根目录，英文版 `en/index.html` 从中文页面与 `assets/i18n/en.json` 翻译表统一生成。首次访问按浏览器语言选择中文或英文，手动切换会记住选择；两版静态页面均支持禁用 JavaScript。浏览器无需请求 GitHub API，离线与禁用 JavaScript 时显示同一版本。

更新日志条目的 `changes` 同时供扩展使用；可选 `highlights` 是发布页的简短摘要（`title`、`description`），未提供时直接展示该版本的 `changes`。部署找不到已发布版本的对应条目时会报错，不会拼接不同版本的信息。

## 项目维护

版本源是 `extension/data/changelog.json`，构建校验其与 manifest 一致。新增版本后执行 `node scripts/sync-release.cjs`，统一生成 CEP 清单、说明文档与发布页中的版本信息。

架构与接口见[架构说明](extension/docs/architecture.md)，平台构建及发布操作见上方文档入口。调试输出、现场记录、私有依赖与凭据均不属于公开仓库内容。

## 许可证

本项目使用 [GPLv3](License.md) 授权。
