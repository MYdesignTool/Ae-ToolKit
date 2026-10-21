# 按平台构建与校验

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

显式生成使用 `build.ps1 -CreatePackage`。Windows 需先编译或校验受控原生插件，再
执行 `aetoolkit-native.nsi`；macOS 直接归档 CEP 文件夹，不编译原生 Windows 代码。
调试端口非 0、版本不匹配、AEX 字节变化或原生源码指纹过期均拒绝进入 Windows 载荷。
签名脚本 `sign-win.ps1` 定位 Windows x64 新文件名，本地脚本不自动上传或发布。
Actions 已单独接入，首次 AEX 输入交付、手动构建、标签自动发布与回滚见
[自动发布说明](../../docs/release-automation.md)。干净 runner 通过 `-CiInputsRoot` 使用
已校验的 AEX、NSIS 和在线运行时策略，不读取私有 `.local-deps`。

## 安装、更新、卸载边界

Windows 安装器自动发现注册信息及标准安装位置中的 AE 2023+，去重并优先显示最高版本；
列表末尾为「自定义路径」。选择已发现版本后跳过手动目录页，自定义才要求选择包含
`AfterFX.exe` 的 Support Files。校验 x64 和 AE 已退出后，再写入其 Plug-ins 子目录。
存在其他产品或开发 junction 时停止，避免误改工作区。以管理员权限
安装代码，只对 `extension/data` 授予安装账户修改权限；WebView2 profile 由实际 AE 用户
写入 LocalAppData，不写进 Plug-ins。借用另一管理员账户提权时，需为实际 AE 用户设置
data 写入权限。

安装时检测机器/当前用户的 WebView2 Runtime 注册项，已有时不联网。缺失时自动从微软
下载小型 Evergreen Bootstrapper，验证 Microsoft Authenticode 签名后静默安装，并复查
注册项。下载、签名或安装失败时，在数据迁移和程序写入前停止。安装器不携带完整运行时；
构建门禁拒绝暂存 EXE，并限制成品不超过 10 MiB。卸载不删除共享 Runtime。

原生更新先备份完整 `extension/data` 到 `backups/before-*`；失败则在覆盖代码前停止。
载荷仅含四个默认 JSON，不含个人设置、方案、备份、脚本、profile、SDK、工具链、PDB
或探针。`Manage-Installation.ps1` 在覆盖代码前完成数据处理，失败即中止。卸载验证
installed-files.json，只删除哈希仍一致的已安装代码文件，保留新增脚本、修改文件、数据、
备份和身份标记以支持重装；保留当前用户缓存，不递归删除整个插件目录。

原有 CEP 安装不自动移除、停用或覆盖，符合保留回退版的要求；因此主动保留两版时仍会
有两个可分别打开的面板，这是回退副本，不是 Windows 新安装器重复部署。两版数据独立，
首次无原生个人数据时自动迁移旧 CEP 的统一 JSON 或旧 settings/organizer-schemes，
支持有效 .bak；源 data 先完整备份，./ 脚本路径变为旧根下的绝对路径，脚本不移动。
已有原生个人数据时只备份、从不以旧数据覆盖。损坏且没有有效备份时停止，不用空默认
替代。仍可在设置页用 JSON 显式迁移。旧 Windows CEP 安装流程保存在 CEP 基线分支。

本轮结果：72 项 Node 检查、240 项原生队列检查、12 项桥接检查通过；现有浏览器
回归通过。实际生成 Windows 成品和 macOS ZIP、校验 PE 版本、ZIP 字节及 SHA-256；
真实 PowerShell 迁移测试和 NSIS 隔离安装/更新/备份失败/卸载/重装循环通过。正式 EXE
没有在真实 AE 安装目录执行，没有运行共享 Runtime 安装程序，也没有线上发布；缺失
Runtime、跨管理员账户、实际 AE 和 macOS 场景仍需对应环境实测。
