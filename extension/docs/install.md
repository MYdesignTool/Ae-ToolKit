# 安装与兼容

Windows 使用 AEGP + WebView2 原生面板；macOS 继续使用 CEP。0.5.1 已正式发布。
轻量安装器约 1.13 MiB，已有 WebView2 Runtime 时无需下载运行时。

| 平台 | 程序目录 | 打开方式 |
| --- | --- | --- |
| Windows x64 | 所选 AE 的 `Support Files/Plug-ins/AeltToolkitWebView2/` | 窗口 > AE Local Toolkit (WebView2) |
| macOS CEP | `/Library/Application Support/Adobe/CEP/extensions/AeLocalToolkit/` | 窗口 > 扩展 > AE Local Toolkit |

最低目标为 AE 2023。两版都需在 AE 首选项中允许脚本写入文件和访问网络。

## Windows 原生安装

安装或升级前保存工程并退出 AE。安装器请求管理员权限，列出从注册信息和标准安装目录
发现的 AE 2023+，默认选择最高版本，列表末尾提供「自定义路径」。选择已发现版本后，
直接使用对应 Support Files；自定义时才浏览目录，要求其中包含 `AfterFX.exe`。
每次只写入所选 AE 的 `Plug-ins/AeltToolkitWebView2`，其他 AE 版本可再次运行安装器。
开发用 junction 或其他产品目录会被拒绝覆盖。

安装时检查机器和当前用户的共享 WebView2 Runtime；已有时不联网。缺失时自动从微软
下载 Evergreen Bootstrapper，验证微软 Authenticode 签名后静默安装，并重新检测结果。
网络、签名或安装失败时，在覆盖工具箱文件前停止。安装包不再携带完整运行时，缺失时
需要联网；不把完整 Edge 当作依赖，也不在每个 AE 目录放一份 WebView2。卸载不删除共享
Runtime。[微软分发说明](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution)

个人数据在插件目录内 `extension/data/user-data.json`；安装逻辑只给 data 授予安装账户
写入权限，不开放程序代码。浏览器缓存独立位于当前 AE 用户的
`%LOCALAPPDATA%/AE Local Toolkit/WebView2/profile`，不随程序更新覆盖。如果使用其他
管理员账户提权，需另行确认实际 AE 用户对 data 有写入权限。

**升级无需先卸载。** 保存工程并退出 AE，运行新版安装器，选择原来安装工具箱的 AE
版本（或同一个自定义 Support Files 路径），即可直接覆盖升级；旧完整运行时安装包
安装的原生版也适用。已有原生个人数据优先，设置、整理方案、表达式与个人脚本均保留。
安装器在更新前备份 data；备份失败时停止，不覆盖已有代码。正常升级不运行卸载器。

安装器只覆盖代码和内置默认 JSON，保留个人文件。卸载保留 data、
backups 和产品身份标记，方便恢复与重装。保留的旧 CEP 也不会被修改，两者各自保存。
首次安装且没有原生个人数据时，自动备份并迁移旧 CEP 数据，将相对脚本路径重定位到
旧目录，脚本不移动。统一 JSON、旧设置/方案及有效 .bak 均支持；无法恢复的损坏数据
会停止安装，已有原生数据不会被旧数据覆盖。其他位置可在设置页显式导入 JSON。

原生 AEX 不能像 CEP 一样在加载中直接覆盖后重载；更换 AEX 前退出 AE。源码中的
`native/toolkit/Deploy.ps1` 仅管理开发链接，不是正式安装器。

## macOS CEP

macOS 包只含 `AeLocalToolkit/` 的 client、host、CSXS、许可证、README 和四个默认 JSON，
不含 Windows 二进制及依赖。复制至上表 CEP 目录，确保 data 对实际 AE 用户可写。
未签名 CEP 的开发加载设置及宿主兼容性沿用原流程；发布包不额外签名。

手动升级应合并覆盖程序、保留 data，避免先删整个扩展。不要启用多个相同 CEP ID 的
副本。旧用户目录与旧 JSON 的整合逻辑保持兼容：已有 user-data.json 时不会反复覆盖。

## 数据与回退

JSON 备份包含设置、收藏、自定义表达式和整理方案，不包含外部脚本、图片或工程。换机
时另外复制这些文件；脚本内相对路径以各版本的 extension 根为基准。原生版与 CEP 不
同时写同一个数据文件，避免互相覆盖。

已有 CEP 可继续独立使用。开发时 CEP 可重载前端；更换 AEX 则需退出并重开 AE。
输入探针不进入任何平台载荷。

开发构建见 [安装器说明](../installer/README.md)。Actions 启用与发版见
[自动发布说明](../../docs/release-automation.md)。
