# AE Local Toolkit

面向 After Effects 2023 及更新版本的离线 CEP 工具箱：工程整理、脚本启动、批量表达式。当前开发版本 **0.3.1**。

- [扩展使用说明](extension/README.md)
- [安装说明](extension/docs/install.md)
- [架构与维护](extension/docs/architecture.md)
- [审查和回归记录](docs/audit.md)

## 目录与验证

`extension/client/` 是无框架、无构建步骤的面板，最低 CEP 11 / Chromium 88；`extension/host/` 使用 ES3 兼容 ExtendScript。默认配置在 `extension/data/`，用户数据统一保存在扩展内 `data/user-data.json`，复制整个扩展文件夹即可携带设置及预设。安装器支持更新前备份和保留数据覆盖更新。

`index.html` 和 `assets/` 是 GitHub Pages 发布页；部署只包含这两项。`extension/installer/` 提供 Windows 安装器及干净 ZIP。

执行 `node --test tests/*.test.cjs`。安装器构建前显式安装 NSIS，再执行 `extension/installer/build-installer.cmd`；脚本不会下载或安装软件。版本源是 `extension/data/changelog.json`，构建校验其与 manifest 一致。

CEP 内核由宿主 AE 携带，不能通过修改清单单独升级。发布页图片使用界面示例数据，不代表 AE 宿主实测结果。

[GPLv3](extension/License.md)
