# AE Local Toolkit

面向 After Effects 2023 及更新版本的离线 CEP 工具箱：工程整理、脚本启动、批量表达式。当前版本 **0.3.1**。

- [扩展使用说明](extension/README.md)
- [安装说明](extension/docs/install.md)
- [架构与维护](extension/docs/architecture.md)
- [审查和回归记录](docs/audit.md)
- [Code signing policy / 签名状态](docs/code-signing.md)

## 目录与验证

`extension/client/` 是无框架、无构建步骤的面板，最低 CEP 11 / Chromium 88；`extension/host/` 使用 ES3 兼容 ExtendScript。默认配置在 `extension/data/`，用户数据统一保存在扩展内 `data/user-data.json`，复制整个扩展文件夹即可携带设置及预设。安装器支持更新前备份和保留数据覆盖更新。

`index.html` 和 `assets/` 是 GitHub Pages 发布页；部署只包含这两项。页面版本、日期、下载链接与更新摘要由同一份 changelog 生成；GitHub Pages 部署会根据最新正式 Release 选择对应条目，发布或编辑 Release 时也会自动刷新。浏览器无需请求 GitHub API，离线与禁用 JavaScript 时显示同一版本。`extension/installer/` 提供 Windows 安装器及干净 ZIP。

执行 `node --test tests/*.test.cjs`。安装器构建前显式安装 NSIS，再执行 `extension/installer/build-installer.cmd`；脚本不会下载或安装软件。版本源是 `extension/data/changelog.json`，构建校验其与 manifest 一致。新增版本后执行 `node scripts/sync-release.cjs`，统一生成 CEP 清单、说明文档与发布页中的版本信息。

更新日志条目的 `changes` 同时供扩展使用；可选 `highlights` 是发布页的简短摘要（`title`、`description`），未提供时直接展示该版本的 `changes`。部署找不到已发布版本的对应条目时会报错，不会拼接不同版本的信息。

启动诊断回归运行 `node tests/startup.cjs`；有本机 AE 时可显式运行 `node tests/ae-host.cjs "完整路径/AfterFX.exe"`，使用独立实例和临时扩展副本验证真实 ExtendScript 加载。浏览器与 Node 模拟不能替代此项兼容性检查。

CEP 内核由宿主 AE 携带，不能通过修改清单单独升级。发布页以原生元素呈现功能示意，不代表 AE 宿主实测结果。

[GPLv3](extension/License.md)
