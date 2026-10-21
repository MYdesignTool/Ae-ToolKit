# 项目内固定依赖

默认构建仅从当前 worktree 的 `.local-deps/` 读取 SDK 与工具，不搜索 Starfield，不使用
指向其他项目的链接。Starfield 宿主的改造代码早已成为 `native/panel-host/` 中的真实源码；
上游提交、哈希及 MIT 许可保留在其 NOTICE/LICENSE。

本次本地快照包含 Adobe May 2023 SDK、WebView2 SDK 1.0.4258.31、MSVC 14.51.36231
所需 x64 编译器/头文件/库、Windows SDK 10.0.26100.0 对应输入、NSIS 3.12、Node
24.18.0 和微软签名的 WebView2 Evergreen x64 离线安装程序。体积约 1.63 GiB，
其中大部分是私有构建工具链；不会装到用户的 AE，也不会进入 macOS 包。

`native/dependencies.lock.json` 记录来源、版本、数量、大小和内容树 SHA-256。构建
前计算真实文件哈希并与锁文件比较；文件被改变或缺失会停止，不自动下载新版本。
锁文件中的绝对来源路径只用于溯源，构建只用本地 directory 字段。

```powershell
.local-deps/node/node.exe native/build/dependencies.cjs verify
& native/toolkit/Build.ps1 -TestsOnly
& native/toolkit/Build.ps1 -OutputRoot .artifacts/installer-native
& extension/installer/build.ps1 -Platform all # 白名单暂存和预处理；不生成安装器/ZIP
```

`freeze <explicit-plan.json>` 用于维护者显式创建新快照；plan 的每项包含 id、directory、
version 和 parts（source/destination）。它拒绝覆盖已有锁文件。`freeze-resume` 只用于
首次封存中断、尚未存在锁文件时继续复制。每项均为实体文件，不允许快照中的符号链接。

这些 SDK 与工具只作为本机私有开发依赖保存，适用各自许可，未作为项目再分发源码上传。
`.local-deps/` 被 Git 忽略，普通克隆不包含它；迁移/归档此 worktree 前应单独保留整个目录
并运行 verify，不能只靠 Git 提交备份。不要将其误加入公开发布包。

操作系统、自带 Windows PowerShell 5.1（也支持 PowerShell 7）、Windows 系统 API/.NET Framework（资源检查的小工具使用系统
C# 编译器）和 AE 宿主本身仍是平台环境，不复制 Adobe 安装文件或整个操作系统。

运行时依赖使用共享 Evergreen：离线安装程序从
`https://go.microsoft.com/fwlink/?linkid=2124701` 获取，已校验有效 Microsoft Corporation
Authenticode 签名并锁定内容。下载不等于安装，本次没有运行它。正式安装脚本只在检测
不到 Runtime 时执行；卸载工具箱不卸载这个共享组件。
依据：[微软分发说明](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution)。
