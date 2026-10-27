# 数据与备份

## 个人数据在哪里

设置、脚本收藏、自定义表达式与全部自定义整理方案，统一保存在当前版本扩展根下的 `data/user-data.json`。两平台扩展根不同：

| 平台 | 个人数据位置 |
| --- | --- |
| Windows 原生版 | 所选 AE 的 `Support Files/Plug-ins/AeltToolkitWebView2/extension/data/user-data.json` |
| macOS CEP | `/Library/Application Support/Adobe/CEP/extensions/AeLocalToolkit/data/user-data.json` |

内置默认数据独立分发，更新程序时不覆盖个人数据。`user-data.json.bak` 是上一次成功保存前的完整快照；Windows 安装器更新前另将完整 data 备份到插件内 `backups/before-*`。

Windows WebView2 的浏览器缓存位于 `%LOCALAPPDATA%/AE Local Toolkit/WebView2/profile`，与个人 JSON 分开，不随程序更新覆盖。原生版与 CEP 不同时写同一个数据文件。

## 导出与导入

在设置页导出完整 JSON 备份。需要恢复、在新安装中迁移或跨平台使用时，通过设置页导入。

导入源保留为 `last-import.json`，导入前快照保留为 `before-import.json`；损坏的原文件会保留为 `before-import-corrupt.json`。导入替换设置并合并同 ID 整理方案，不会复制实际脚本、图片或 AE 工程。

## 换一台电脑

1. 等待保存完成，导出 JSON 备份并关闭 AE。
2. 在新电脑安装对应平台版本，导入 JSON，并核对脚本目录。
3. 另行携带外部脚本、图片和 AE 工程，路径改变后重新选择目录。

若需要整体携带目录，Windows 复制整个 `AeltToolkitWebView2/` 到目标 AE 的 `Plug-ins/`；macOS 复制整个 `AeLocalToolkit/` 到系统级 CEP 目录。确认目标平台依赖、开发模式及实际 AE 用户的 data 写入权限，具体见[安装与更新](./installation.md)。跨平台迁移应安装对应平台程序后导入 JSON，不能直接使用另一平台二进制。

扩展内脚本路径与收藏以相对路径保存。Windows 的相对路径基准是 `AeltToolkitWebView2/extension/`，macOS 是 `AeLocalToolkit/`。整体复制时还需携带脚本目录中的 `image`。

## 从旧版升级

Windows 首次没有原生个人数据时，安装器先备份并迁移匹配 ID 的旧 CEP 数据，支持统一 JSON、旧设置/方案和有效 `.bak`。相对脚本路径重定位到旧 CEP 根目录，实际脚本不移动，旧 CEP 保留。已有原生个人数据后不会反复导入旧 CEP。

CEP 的旧数据整合逻辑继续兼容 `data/settings.json`、`data/organizer-schemes/` 和上一版用户目录；已有 `user-data.json` 后以它为准，不会反复导入已删除的旧方案。

## 保存失败或恢复

先保留原数据，检查实际运行 AE 的用户是否可写当前扩展的 `data`。若安装使用了另一管理员账户提权，需要为实际 AE 用户另行核对权限。无须授予整个程序目录写入权限。

主文件缺失时程序会尝试恢复 `.bak`；无法恢复的损坏数据不会用空默认数据覆盖。可在设置页显式导入备份。回退版本前先导出当前数据，保留新增编辑，再决定是否恢复安装前快照。
