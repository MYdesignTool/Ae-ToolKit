# 项目内固定依赖

GitHub Actions 使用 `windows-2022` 自带的 Visual Studio 2022 x64 工具链和指定 Windows SDK。
Adobe SDK 头文件由仓库 Actions Secrets 提供，WebView2 SDK 从固定版本 NuGet 包恢复，均验证
`native/ci-dependencies.json` 中的 SHA-256。机密片段通过标准输入配置，不作为公开文件上传。
设置与维护见[自动构建说明](../../docs/release-automation.md)。下文为本机构建路径。

默认构建从工作区 `.local-deps/` 读取私有 SDK 与工具，不依赖其他项目的活动目录。
具体组件版本见锁文件；这些依赖不进入产品包。模块来源与许可证见相应 NOTICE/LICENSE。

`native/dependencies.lock.json` 记录来源、版本、数量、大小和内容树 SHA-256。构建
前计算真实文件哈希并与锁文件比较；文件被改变或缺失会停止，不自动下载新版本。
锁文件只保存可公开的组件版本、相对 directory 和内容指纹，不写入本机来源路径。

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

安装器检查共享 Evergreen，缺失时才下载微软 Bootstrapper、验证微软签名并安装；
已有 Runtime 不联网。卸载工具箱不卸载这个共享组件。
依据：[微软分发说明](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution)。
