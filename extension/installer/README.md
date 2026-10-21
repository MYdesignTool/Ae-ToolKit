# 按平台构建与校验（0.5.1 未发布）

| 平台 | 输出（显式允许生成时） | 安装位置 |
| --- | --- | --- |
| Windows x64 | `aetoolkit-v<version>-windows-x64-installer.exe` | 所选 AE 的 `Support Files/Plug-ins/AeltToolkitWebView2/` |
| macOS | `aetoolkit-v<version>-macos-cep.zip` | `/Library/Application Support/Adobe/CEP/extensions/AeLocalToolkit/` |

两平台从同一份 `extension/client` 和 `extension/host` 源码构建。Windows 不再附送或安装
CEP，macOS 不附送 AEX、Windows SDK 或 WebView2 Runtime；不会维护两套重复界面源码。
Windows 的 `extension/CSXS/manifest.xml` 仅供原有 JSX 根目录校验，不会安装至 CEP 搜索路径。
同一电脑针对多个 AE 版本安装时，每个所选 AE 各有自己的小型工具箱目录；Evergreen
Runtime 在系统中共享，不在每个 AE 中复制一套浏览器。

## 默认只校验

使用 Windows PowerShell 5.1 或 PowerShell 7。默认 CMD 入口使用系统自带版本；所有非系统构建输入固定在工作区 `.local-deps/`，先读
[`native/build/README.md`](../../native/build/README.md)。版本来自 changelog，并核对 CEP manifest。

```powershell
& native/toolkit/Build.ps1 -OutputRoot .artifacts/installer-native
& extension/installer/build.ps1 -Platform all
node tests/installer.cjs
```

第一步只构建单独的原生 AEX，不覆盖正在加载的开发面板。后两步创建干净的白名单暂存
目录并执行 NSIS `/PPO` 预处理；**不生成 EXE 安装器或 ZIP，不执行安装、不写注册表**。
`build-installer.cmd` 也默认进入这条校验流程。`-Platform windows` / `macos` 可分别校验。

只有收到生成授权后才使用 `build.ps1 -CreatePackage`。Windows 需先编译原生插件，再
执行 `aetoolkit-native.nsi`；macOS 直接归档 CEP 文件夹，不编译原生 Windows 代码。
调试端口非 0、版本不匹配、AEX 字节变化或原生源码指纹过期均拒绝进入 Windows 载荷。
签名脚本 `sign-win.ps1` 已改为定位 Windows x64 新文件名。不会自动签名、上传或发布。

## 安装、更新、卸载边界

Windows 安装器选择包含 `AfterFX.exe` 的 Support Files，校验 x64 和 AE 已退出，再写入
其 Plug-ins 子目录。存在其他产品或开发 junction 时停止，避免误改工作区。以管理员权限
安装代码，只对 `extension/data` 授予安装账户修改权限；WebView2 profile 由实际 AE 用户
写入 LocalAppData，不写进 Plug-ins。借用另一管理员账户提权时，需为实际 AE 用户设置
data 写入权限。

安装时检测机器/当前用户的 WebView2 Runtime 注册项，仅在缺失时运行随包的微软签名
Evergreen x64 离线安装程序。该依赖在暂存目录只有一份，不需要联网下载，不等同于
Edge 浏览器。卸载工具箱不会卸载共享 Runtime。

原生更新先备份完整 `extension/data` 到 `backups/before-*`；失败则在覆盖代码前停止。
载荷仅含四个默认 JSON，不含个人设置、方案、备份、脚本、profile、SDK、工具链、PDB
或探针。卸载删除本产品代码，保留数据、备份和身份标记以支持重装；保留当前用户缓存。

原有 CEP 安装不自动移除、停用或覆盖，符合保留回退版的要求；因此主动保留两版时仍会
有两个可分别打开的面板，这是回退副本，不是 Windows 新安装器重复部署。两版数据独立，
用设置页 JSON 备份显式迁移；相对脚本根变化后需重新选择目录。新安装器不会自动选择
哪一份旧数据覆盖用户当前原生数据。旧 Windows CEP 安装流程保存在 CEP 基线分支。

本轮结果：64 项 Node 检查、240 项原生队列检查、12 项桥接检查通过；固定本地依赖的
独立 AEX 构建与资源检查、两平台载荷和 NSIS 预处理通过。没有生成新安装器，因此新
安装器的实际安装、升级、卸载以及缺失 Runtime 场景仍待后续隔离执行验收。预处理不是
完整安装器执行测试，不能沿用旧 CEP 安装器的通过结论。
