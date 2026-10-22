# GitHub Actions 构建、发布与回滚

本分支新增 `.github/workflows/release.yml`，现有 `jekyll-gh-pages.yml` 保留部署逻辑，仅过滤
输入资产预发布的 release 事件，避免其触发 Pages 标签保护拒绝。
2026-10-21 已完成首次正式发布 [v0.5.1](https://github.com/MYdesignTool/Ae-ToolKit/releases/tag/v0.5.1)：
Windows 原生安装器、macOS CEP ZIP、双语说明和 SHA256SUMS 全部由
[标签流水线](https://github.com/MYdesignTool/Ae-ToolKit/actions/runs/39628784548)生成并验证。
发布提交为 `d1808de9ea386e93deedcb252d02c8f05d85fb10`；官网刷新成功。

主线安装器改为轻量包和自动发现 AE，用户已确认实际安装成功，并授权更新 0.5.1 的
Windows 安装包。以下输入准备步骤采用新模式；历史 v0.5.1 标签保持原提交，按该标签
重建仍会生成当时的完整离线包。此次仅重打包安装器，程序版本及受控 AEX 保持 0.5.1；
更新资产须来自 main 上成功的完整 Actions 构建，并在 Release Notes 记录打包提交和运行。
常规发布脚本继续拒绝覆盖公开 Release；后续新版本须使用新的统一版本及 v* 标签。

用户升级时直接运行新版安装器并选择原 AE，无需先卸载。CI 的 NSIS 循环实际覆盖了
已有原生数据下再次安装、数据/个人脚本保留及备份失败中止；本地 CEP 保留作开发调试，
不因此复制新的开发备份。

## 第一阶段与依赖边界

Windows 使用标准 `windows-2022` runner；逻辑检查、CEP ZIP 和发布使用 `ubuntu-24.04`。
CEP ZIP 不依赖 macOS 原生编译，无需占用 macOS runner。使用标准 GitHub-hosted runners，
实际计费/额度以仓库公开性及 GitHub 账户规则为准。

Actions 不复制本机 1.63 GiB 的 `.local-deps`，也不引用 Starfield。第一阶段从同仓库的
`native-inputs-v<版本>` 预发布下载经审查的 AEX ZIP。其 SHA-256、源码指纹和文件名由
`native/release-inputs.json` 固定；解包只允许 AEX 与 build-info.json 两个文件，再核对
版本、禁用调试端口、二进制哈希、PE FileVersion/ProductVersion、AEGP PiPL 身份。
资源检查只读 PE，不加载执行插件。原生源文本指纹统一 LF，避免 runner 换行差异。

NSIS 从锁中记录的原始地址获取、审查，再将相同字节上传至受控输入预发布。Actions 从
同仓库下载并校验原始 SHA-256，避免外部 CDN 的 HTML 或不完整响应影响每次构建。NSIS 使用官方公布的
[3.12 SHA-256](https://sourceforge.net/projects/nsis/files/NSIS%203/3.12/nsis-3.12.zip/download)，
首次准备 NSIS 时，SourceForge 返回 HTML 或连接失败可切换锁中的 MIT 镜像，但内容必须是同一个官方哈希。
构建输入没有浮动 latest 下载或自动更新锁。构建 SDK 不会进入产品包。

轻量安装包不包含 WebView2 完整运行时，也不在 CI 下载它。运行时策略限定微软官方
Bootstrapper 地址：已有 Runtime 时不联网；缺失时下载当前 Evergreen 引导程序，验证
有效 Microsoft Authenticode 签名后才执行，并重新检测安装结果。这是用户设备上的动态
Evergreen 分发，不伪装为固定字节的构建输入。NSIS 和 AEX 的固定哈希门禁保持不变。
依据：[微软在线分发说明](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution#online-only-deployment)。

`native/release-inputs.json` 中的值必须通过维护者审查；哈希保护的是内容与来源选择，
不能代替对本机原生编译及 SDK 的信任。输入预发布不是最终产品发布，不设为 latest；
其标签不以 v 开头，不会触发产品流水线。

## 首次启用

1. 将当前试验分支的源码和 release.yml 合入默认分支 main。不要先推版本标签。
   Settings > Actions 允许官方 actions 和手动运行，默认 token 保持只读即可；各作业
   自行请求所需的最小权限。无需 PAT、Adobe SDK secret 或自托管 runner。
2. 确保本地原生候选已在 AE 中验收。构建和封存输入：

   ```powershell
   & native/toolkit/Build.ps1 -OutputRoot .artifacts/release-native
   & scripts/release/Prepare-NativeInput.ps1 -NativeBuildRoot .artifacts/release-native -UpdateLock
   node scripts/release/verify-inputs.cjs
   ```

   本轮已生成 `.artifacts/aelt-native-v0.5.1-windows-x64.zip` 并锁定其哈希。
   如果该文件仍在，可直接使用，不要重新压缩；ZIP 时间戳也会影响整体哈希。若需重建，
   显式保留/移走旧包后重新封存，审查并提交新的 release-inputs.json。不要手改二进制
   哈希来绕过校验。
3. 提交并合入输入锁。通过 GitHub Releases 页面创建 **预发布** `native-inputs-v0.5.1`，
   指向已合并的源码提交，上传上述 ZIP，以及锁中的 `nsis-3.12.zip`。
   依赖不要重新压缩，哈希必须与锁一致。也可用已登录的 GitHub CLI：

   ```powershell
   gh release create native-inputs-v0.5.1 .artifacts/aelt-native-v0.5.1-windows-x64.zip --repo MYdesignTool/Ae-ToolKit --target main --prerelease --latest=false --title 'Native inputs 0.5.1' --notes 'Reviewed native build inputs; not the public installer.'
   # 将已校验的依赖放入此目录，并保持以下精确文件名：
   gh release upload native-inputs-v0.5.1 .artifacts/release-dependencies/nsis-3.12.zip --repo MYdesignTool/Ae-ToolKit
   ```

   这是每个新版本的维护者输入交付步骤，0.5.1 已执行完成。输入上传后不能随意替换；
   任意字节变化都会使产品构建失败，避免不知情地发布其他二进制。
4. Actions > **Build and release Ae-ToolKit** > Run workflow，选择 main，保持 publish=false。
   下载 `verified-release` artifact，核对两个平台包和 SHA256SUMS.txt。这个手动运行
   只构建，不创建产品 Release。测试包含真实 NSIS 夹具安装循环。
   如果随后在本机试装，而目标仍是当前开发 junction：先导出原生版 JSON、保存并退出 AE，
   再用 `native/toolkit/Deploy.ps1 -Apply -Remove` 只撤销开发链接，保留工作区数据。正式安装
   后导入刚才的原生 JSON，避免只迁移 CEP 旧数据而漏掉试验版中的新编辑。不要删除整个
   开发产物目录来解除链接。
5. 确认后创建版本标签并推送：

   ```powershell
   git switch main
   git pull --ff-only
   git tag -a v0.5.1 -m 'AE Local Toolkit 0.5.1'
   git push origin v0.5.1
   ```

   v* 推送自动构建并发布。建议用仓库 ruleset 限制 v* 和 native-inputs-* 的创建、更新与
   删除权限。只允许维护者发布，不从 PR 或 fork 触发有写权限的发布作业。

若要手动补发，Run workflow 选择已有、与源码版本完全匹配的 v* 标签，再选择 publish=true。
不能从普通分支直接公开发布，也不能覆盖已经公开的同版本 Release。

## 新版本操作

唯一版本源为 `extension/data/changelog.json` 的 version 和首条 entry；同时维护中文
changes 与英文 changesEn。Release Notes 自动由这两组内容生成，缺失英文会停止，不做
不受控的在线机器翻译。版本必须能转换为 Windows 四段整数版本。

1. 更新 changelog 和日期。保留已发布条目，用以下命令同步运行时版本，同时让官网源码
   保持上一正式版本：

   ```powershell
   $lastPublished=gh api repos/MYdesignTool/Ae-ToolKit/releases/latest --jq .tag_name
   node scripts/sync-release.cjs --release-tag $lastPublished
   node scripts/release/version.cjs check
   ```

   为新增中文发布摘要补齐 assets/i18n/en.json，现有测试会检查英文官网可生成。
2. 重新构建、验收 AEX，生成新的输入 ZIP，审查提交输入锁，再上传对应 native-inputs-v*。
   同时上传锁定 NSIS；可以复用上一版本的相同字节，无需上传完整 WebView2 Runtime。
3. 先手动构建，核查后推送同版本 v* 标签。标签、清单、界面、README、AEX PE 版本和
   NSIS 文件版本都要一致；流水线对不一致直接失败。

最终 Release 仅包含：

- `aetoolkit-v<版本>-windows-x64-installer.exe`
- `aetoolkit-v<版本>-macos-cep.zip`
- `SHA256SUMS.txt`

双语说明作为 Release 正文，同时保存在构建 artifact 的 release-notes.md。程序默认未做
Authenticode 签名；SHA-256 用于完整性，不等于发行者签名。签名若后续加入，应在生成
校验和之前完成。

## 门禁、迁移和数据保护

validate、Windows 构建/测试、CEP ZIP 验证全部成功后才能 assemble；assemble 成功才允许
publish。所有 job 默认为 contents:read，只有 publish 获得 contents:write；官方 actions
均固定完整 commit SHA。构建不持久化 checkout 凭据。

publish 重新验证标签仍指向测试的提交和本地校验文件，然后创建草稿、上传两个平台包和
校验文件，并核对服务端摘要及完整资产集，最后才转为公开。失败留下未公开草稿；同一次
测试提交可以安全重试自己的草稿，不修改其他草稿或现有公开版本。

安装目标是所选 AE 的 Support Files/Plug-ins/AeltToolkitWebView2，不是 CEP。首次安装
按旧用户级 CEP、两个系统级 CEP、旧注册信息的顺序查找，要求 manifest 的扩展 ID 匹配；
已有原生个人数据优先，即使数据损坏也不会被旧副本覆盖。有效 canonical .bak 可恢复迁移；
损坏且无可用备份时停止。兼容旧 settings.json 与 organizer-schemes。

迁移前在原生 backups 中保存源 data 的原始副本，重定位 `./` 脚本路径后写入新的统一
JSON；不移动、删除、停用旧 CEP 或个人脚本。每次原生更新先备份原生 data，失败则停止
覆盖代码。路径中的链接或越界会被拒绝；开发 junction 应使用导出 JSON 等显式迁移方式。
若用另一管理员账户提权，旧用户 AppData 与 data 写权限应单独确认。

卸载验证产品根、身份和清单，只删除**内容仍匹配安装时哈希**的已安装程序文件；新增
脚本、修改过的文件、data、backups 和其他插件均保留，不递归删除整个插件目录。
保留身份标记支持卸载后的重装。WebView2 Runtime 为共享组件，不随工具箱卸载。

隔离测试编译同一 NSIS 源码，但限定 TEST_ROOT、禁用真实注册表和 Runtime 安装，只操作
工作区夹具。已覆盖迁移、相对路径、原生优先、损坏数据、备份失败中止、脚本保留、更新、
卸载和重装。真正安装/修复缺失 Runtime、管理员跨账户、实际 AE 与 macOS 仍需人工环境
验证；托管 runner 没有 AE，也不能替代微软拼音的真实候选窗验收。

## Pages、失败重试与回滚

现有 Pages 工作流继续部署官网，输入资产预发布跳过 deploy 作业。由于
[GITHUB_TOKEN 不会递归触发 release 工作流](https://docs.github.com/en/actions/concepts/security/github_token)，
产品发布成功后，单独的 refresh-pages 作业使用 actions:write 请求现有 Pages 的
workflow_dispatch；这个作业不具备 Release 写权限。无需扩大 publish 的 token 权限或用 PAT。
Pages 失败不删除已经验证的 Release；重跑 Pages 即可。

构建/测试/打包失败：不会公开 Release，修正原因后重跑；下载资产仍受锁控制。
上传失败：检查同版本草稿，重跑失败作业，在资产保留期内可复用成功构建；超过 14 天需
重新运行构建。不要为省事删除校验门禁或覆盖公开资产。

如果已经发布的版本出现问题，先停止分发，将该 Release 改回 draft，然后刷新 Pages：

```powershell
gh release edit v0.5.1 --repo MYdesignTool/Ae-ToolKit --draft
gh workflow run jekyll-gh-pages.yml --repo MYdesignTool/Ae-ToolKit --ref main
```

保留版本标签与失败证据，不强推或重用版本号；修复后发布新的补丁版本。用户保存工程，
导出当前数据后可切回保留的 CEP，或从安装前备份恢复；不要让旧备份直接覆盖新的个人
编辑。工具箱本地卸载保留数据及脚本，便于调查和回退。

## 第二阶段：把原生编译迁入 Actions

本次不把私有 Adobe SDK 打入 Git。准备好 SDK 授权及受控下载渠道后，在 Windows build
作业增加 SDK/锁定 WebView2 SDK 的准备，以 runner 的 MSVC/Windows SDK 编译独立 AEX；
调整本地依赖解析器以接受 runner 工具链。继续执行原生队列/桥接测试和资源/PE 版本检查，
将输出作为本次运行内 artifact 交付打包作业，替代 native-inputs 预发布下载步骤。
统一版本、数据保护、源码指纹、SHA-256 和末尾发布门禁全部保留；先手动跑通实际 AE
验收后，再启用这一模式。无需改变最终安装目录或 macOS CEP 包。
