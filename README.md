# AE Local Toolkit

面向 After Effects 2023 及更新版本的离线 CEP 工具箱：工程整理、脚本启动、批量表达式。当前版本 **0.3.1**。

这是项目唯一的主说明文档，覆盖安装、功能使用、数据与开发验证。扩展本体位于 `extension/`，面板最低支持 AE 2023（23.x）与 CEP 11，并兼容新版 CEP 12。

## 文档

| 文档 | 内容 |
| --- | --- |
| [安装与兼容](extension/docs/install.md) | Windows 安装器、更新与备份、换机迁移、旧数据整合 |
| [架构与维护](extension/docs/architecture.md) | 加载顺序、桥接入口、存储策略与已知限制 |
| [构建安装器](extension/installer/README.md) | NSIS 构建步骤、产物清单与 SHA256 校验 |
| [审查与回归记录](docs/audit.md) | 已修复问题、验证方式与待宿主验证清单 |

## 快速开始

1. 从 [GitHub Releases](https://github.com/MYdesignTool/Ae-ToolKit/releases) 下载 Windows 安装器 `aetoolkit-*.exe`，或下载 `aetoolkit-extension.zip` 将其中的 `AeLocalToolkit/` 放入系统级 CEP 目录。
2. 重启 After Effects，通过「窗口 > 扩展」打开 AE Local Toolkit。
3. 在首选项「脚本与表达式」中启用「允许脚本写入文件和访问网络」。

系统级 CEP 目录：Windows 为 `C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\`，macOS 为 `/Library/Application Support/Adobe/CEP/extensions/`。安装器只需为 `data` 子目录授予写入权限，无需放开整个程序目录。未签名开发包需在组件页显式启用开发模式，详见[安装与兼容](extension/docs/install.md)。

## 功能说明

### 批量表达式

1. 在 AE 时间线中展开属性，选中位置、旋转等具体属性；仅选中图层不等于选中属性。
2. 搜索并从下拉框选择表达式，直接在编辑区修改代码，也可清空选择后输入新代码。
3. 查看选中属性数量；回到面板或切换到表达式页时自动刷新，也可手动刷新。
4. 点击「应用到选中属性」，或在编辑器按 Ctrl/Cmd + Enter。已有表达式沿用原来的覆盖确认流程；安静模式沿用原来的免确认设置。
5. 底部状态栏显示成功、跳过和失败数量。失败属性尝试恢复原表达式；整批操作可在 AE 中一次撤销。

「另存为」打开命名弹窗，自定义条目可保存修改或删除。切换条目会提示未保存内容。Tab 在代码编辑器内插入两个空格。界面保留原有的搜索、下拉选择与编辑结构，编辑区随面板高度伸缩，保存操作集中在编辑区标题旁。

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

换电脑：保存完成并关闭 AE 后，复制整个 `AeLocalToolkit` 文件夹到新电脑的系统级 CEP 目录，并确保 `data` 子目录对当前用户可写，再打开面板即可。Windows 安装器会自动设置 `data` 权限。`user-data.json` 是完整数据，旁边的 `.bak` 是上一次成功保存前的完整快照。安装器更新前还会备份整个 `data` 到 `backups/before-版本-时间/`。

脚本目录和收藏如果位于扩展文件夹内，会存为相对路径，移动文件夹后自动对应新位置。例如将脚本放进 `AeLocalToolkit/scripts`，并在设置里选择它；其 `image` 子目录也一并复制。扩展外的脚本、图片和 AE 工程不会被配置文件复制，换电脑时需另行携带，并按实际位置重新选择脚本目录。

首次升级会整合旧版 `data/settings.json`、`data/organizer-schemes/` 以及上一版 `Folder.userData/AE Local Toolkit/` 中的数据，保留所有源文件。如果两处同时存在，上一版用户目录的设置和同 ID 方案优先；其他方案合并。此后始终以本扩展的 `user-data.json` 为准，不会重新导入已删除的旧方案。

保存先写临时文件再替换，失败保留原数据；主文件缺失时恢复 `.bak`。设置页仍可导入、导出完整 JSON 备份。导入源保留为 `last-import.json`；导入前保存 `before-import.json`，替换设置并合并同 ID 方案，最终单次写入完整数据；损坏原文件保留为 `before-import-corrupt.json`。

安装器直接运行即可升级，无需卸载。它只更新程序和内置默认 JSON，保留个人文件；从旧系统级安装迁移时，先复制数据，在新版写入后将旧清单重命名停用，旧目录与数据保留。卸载保留 `data`、`backups` 和扩展根目录额外的个人脚本目录。手动升级应将新包合并覆盖到旧文件夹，保留原 `data`，避免先删除旧文件夹。

## 发布页

`index.html`、`en/index.html` 和 `assets/` 是 GitHub Pages 发布页；部署只包含这几项。页面版本、日期、下载链接与更新摘要由同一份 `extension/data/changelog.json` 生成；GitHub Pages 部署会根据最新正式 Release 选择对应条目，发布或编辑 Release 时也会自动刷新。中文版在根目录，英文版 `en/index.html` 从中文页面与 `assets/i18n/en.json` 翻译表统一生成。首次访问按浏览器语言选择中文或英文，手动切换会记住选择；两版静态页面均支持禁用 JavaScript。浏览器无需请求 GitHub API，离线与禁用 JavaScript 时显示同一版本。

更新日志条目的 `changes` 同时供扩展使用；可选 `highlights` 是发布页的简短摘要（`title`、`description`），未提供时直接展示该版本的 `changes`。部署找不到已发布版本的对应条目时会报错，不会拼接不同版本的信息。

## 开发与验证

`extension/client/` 是无框架、无构建步骤的面板，最低 CEP 11 / Chromium 88；`extension/host/` 使用 ES3 兼容 ExtendScript。默认配置在 `extension/data/`，用户数据统一保存在扩展内 `data/user-data.json`。

- 回归测试：`node --test tests/*.test.cjs`
- 启动诊断：`node tests/startup.cjs`
- 本地交互预览：`node tests/preview.cjs [可选脚本目录]`
- 浏览器交互（需 Playwright 与 Microsoft Edge）：`node tests/browser.cjs`，可用 `ARTIFACT_DIR` 指定截图目录

版本源是 `extension/data/changelog.json`，构建校验其与 manifest 一致。新增版本后执行 `node scripts/sync-release.cjs`，统一生成 CEP 清单、说明文档与发布页中的版本信息。

安装器构建前需显式安装 NSIS（脚本不会下载或安装软件），再执行 `extension/installer/build-installer.cmd`。有本机 AE 时可显式运行 `node tests/ae-host.cjs "完整路径/AfterFX.exe"`，使用独立实例和临时扩展副本验证真实 ExtendScript 加载；浏览器与 Node 模拟不能替代此项兼容性检查。

CEP 内核由宿主 AE 携带，不能通过修改清单单独升级。发布页以原生元素呈现功能示意，不代表 AE 宿主实测结果。`extension/docs/architecture.md` 记录了未在本文件展开的技术约定。

## 许可证

本项目使用 [GPLv3](License.md) 授权。
