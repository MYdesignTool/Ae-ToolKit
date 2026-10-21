# 安装与兼容（0.5.1 未发布分支）

本分支 Windows 使用 AEGP + WebView2 原生面板；macOS 继续使用 CEP。现有正式发布页
仍对应旧 CEP 版本。本轮已本地构建两平台包并做隔离安装验证，没有发布或更新下载链接。

| 平台 | 程序目录 | 打开方式 |
| --- | --- | --- |
| Windows x64 | 所选 AE 的 `Support Files/Plug-ins/AeltToolkitWebView2/` | 窗口 > AE Local Toolkit (WebView2) |
| macOS CEP | `/Library/Application Support/Adobe/CEP/extensions/AeLocalToolkit/` | 窗口 > 扩展 > AE Local Toolkit |

最低目标为 AE 2023；当前真实原生宿主验证为 Windows AE 23.5。其他 AE 版本和 macOS
不能仅凭清单支持范围当作已实测。两版都需在 AE 首选项中允许脚本写入文件和访问网络。

## Windows 原生安装

安装或升级前保存工程并退出 AE。新的安装逻辑请求管理员权限，选择包含 `AfterFX.exe`
的 Support Files 文件夹，只写入它的 `Plug-ins/AeltToolkitWebView2`。多 AE 版本需要
分别选择目标。开发用 junction 或其他产品目录会被拒绝覆盖。

安装时检查共享的 WebView2 Runtime，缺失时才运行随包提供、经微软签名验证的离线安装
程序；不把完整 Edge 当作依赖，也不在每个 AE 目录放一份 WebView2。卸载不删除共享
Runtime。[微软分发说明](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution)

个人数据在插件目录内 `extension/data/user-data.json`；安装逻辑只给 data 授予安装账户
写入权限，不开放程序代码。浏览器缓存独立位于当前 AE 用户的
`%LOCALAPPDATA%/AE Local Toolkit/WebView2/profile`，不随程序更新覆盖。如果使用其他
管理员账户提权，需另行确认实际 AE 用户对 data 有写入权限。

更新前备份 data；安装器只覆盖代码和内置默认 JSON，保留个人文件。卸载保留 data、
backups 和产品身份标记，方便恢复与重装。保留的旧 CEP 也不会被修改，两者各自保存。
首次安装且没有原生个人数据时，自动备份并迁移旧 CEP 数据，将相对脚本路径重定位到
旧目录，脚本不移动。统一 JSON、旧设置/方案及有效 .bak 均支持；无法恢复的损坏数据
会停止安装，已有原生数据不会被旧数据覆盖。其他位置可在设置页显式导入 JSON。

原生 AEX 不能像 CEP 一样在加载中直接覆盖后重载；更换 AEX 前退出 AE。源码中的
`native/toolkit/Deploy.ps1` 仅管理开发链接，不是正式安装器。

## macOS CEP

macOS 包只含 `AeLocalToolkit/` 的 client、host、CSXS、许可证、README 和四个默认 JSON，
不含 Windows 二进制及依赖。复制至上表 CEP 目录，确保 data 对实际 AE 用户可写。
未签名 CEP 的开发加载设置及宿主兼容性沿用原流程；本轮已生成并校验 ZIP，未签名或发布。

手动升级应合并覆盖程序、保留 data，避免先删整个扩展。不要启用多个相同 CEP ID 的
副本。旧用户目录与旧 JSON 的整合逻辑保持兼容：已有 user-data.json 时不会反复覆盖。

## 数据与回退

JSON 备份包含设置、收藏、自定义表达式和整理方案，不包含外部脚本、图片或工程。换机
时另外复制这些文件；脚本内相对路径以各版本的 extension 根为基准。原生版与 CEP 不
同时写同一个数据文件，避免互相覆盖。

原 CEP 分支 `codex/cep-0.5.1-baseline`、原工作区及原安装均保留。输入探针安装链接已
移除，不再随 AE 启动注册菜单；已加载会话中的旧菜单在下次 AE 启动后消失。探针不进入
任何平台载荷。

开发构建和当前验证边界见 [安装器说明](../installer/README.md)。实际隔离安装/升级/
卸载和重装已通过，正式安装器尚未在真实 AE 目录执行。Actions 启用与发版见
[自动发布说明](../../docs/release-automation.md)。
