# GitHub Actions 构建、发布与回滚

工作流从当前提交编译 Windows AEX，生成轻量 NSIS 安装器和 macOS CEP ZIP。手动运行默认
只构建，推送 `v*` 标签时自动发布。产品版本统一来自 `extension/data/changelog.json`；SDK
与构建工具版本独立锁定。

## 一次性配置原生依赖

使用有权使用的 Adobe May 2023 SDK，获取入口见 [Adobe 官方页面](https://developer.adobe.com/after-effects/)。
SDK 不进入公开源码、Release 或 Actions artifact；只提供编译所需头文件，并通过仓库
Actions Secrets 私密保存。

1. 在本地封存头文件。归档只写入被忽略的 `.artifacts`，公开的
   `native/ci-dependencies.json` 只保存版本、文件数、大小、分段参数和 SHA-256：

   ```powershell
   node native/build/ae-sdk-secrets.cjs prepare '<AE SDK 根目录>'
   ```

2. 用已登录的 GitHub CLI，通过标准输入配置 `AELT_AE_SDK_PART_01` 至锁文件指定数量的
   仓库 Secrets。每段最多 30000 个字符，满足 Windows 环境变量和 GitHub 机密大小限制。
   不要把片段复制进源码、命令参数、日志或聊天：

   ```powershell
   node native/build/ae-sdk-secrets.cjs upload .artifacts/ae-sdk/headers.br
   ```

3. 审查并提交更新的依赖锁。只有 SDK 更新时才重复前两步；普通产品版本不需要重新上传
   SDK 或预编译 AEX。恢复时验证归档哈希、路径、文件数及大小，拒绝目录穿越和名称冲突。
   编译作业结束清除 runner 上的私密头文件。

WebView2 SDK 使用固定版本的微软 NuGet 包，解包前核对 SHA-256，静态链接 x64 Loader。
托管 runner 使用 Visual Studio 2022 和锁定的 Windows SDK，实际编译器版本写入产物元数据。
无需上传本机编译器、私有工具链或整个 Runtime。

NSIS 3.12 使用 `native/release-inputs.json` 指定的受控工具附件，验证原始 SHA-256。
工具附件与产品版本独立；历史 `native-inputs-v0.5.1` 中的 NSIS 可以复用，AEX 附件不再
作为当前流水线输入。

## 手动构建

Actions > **Build and release Ae-ToolKit** > Run workflow，选择开发分支或 main，保持
`publish=false`。流程如下：

- `validate`：公开文件/凭据格式检查、版本一致性、SDK 策略和现有逻辑检查。
- `native-windows`：恢复私密头文件和固定 WebView2 SDK，编译/执行原生队列及桥接检查，
  生成 AEX、PiPL、版本资源，并验证实际生成的 JSX。
- `windows`：只下载同一次运行的原生产物，核对源码、SDK、提交、二进制哈希、x64 PE、
  产品版本与插件身份；完成浏览器、迁移和真实 NSIS 安装循环后打包。
- `macos-cep`：只归档公共 CEP 文件，不包含 Windows 插件、SDK 或用户数据。
- `assemble`：等待两平台成功，生成中英文说明及 `SHA256SUMS.txt`。

`native-windows` artifact 仅含 AEX 和 `build-info.json`；`verified-release` 包含安装器、CEP
ZIP、校验文件和双语说明。PDB、对象文件、SDK、用户数据和调试输出不上传。原生编译或
任意检查失败均不能发布。

## 发布新版本

1. 更新 changelog 的版本、日期及中英文 `changes`，保留历史条目。执行
   `node scripts/sync-release.cjs` 同步运行时与清单；开发期可用 `--site-release-tag`
   让官网保持上一正式版本。
2. 审查源码和锁文件并合入 main。先手动运行完整工作流，核对 `verified-release` 与 SHA-256。
3. 为该提交创建新的 `v<版本>` 标签并推送。工作流从标签源码编译 AEX，完成全部构建、
   测试和打包后创建草稿，上传完整附件并验证服务端摘要，最后公开。

公开附件仅含 `aetoolkit-v<版本>-windows-x64-installer.exe`、
`aetoolkit-v<版本>-macos-cep.zip` 和 `SHA256SUMS.txt`。双语正文由 changelog 生成。
程序默认未签名，校验和用于文件完整性。

手动补发时选择版本匹配的已有 `v*` 标签并设 `publish=true`；普通分支不能发布。脚本
拒绝覆盖公开 Release 或其他人的草稿。新版本不复用旧标签，也不再手动封存 AEX 输入。

## 安装升级与数据保护

Windows 安装到所选 AE 的 `Support Files/Plug-ins/AeltToolkitWebView2`。已有原生版直接
运行新版安装器即可升级，无需先卸载。更新前备份 data，失败即停止覆盖；保留个人设置、
方案、表达式、脚本和旧 CEP。首次升级按扩展身份迁移旧 CEP，已有原生数据优先。卸载
按清单及哈希删除程序，保留数据和个人文件，不递归删除整个插件目录。

安装包使用共享 Evergreen Runtime，已有时不联网；缺失时下载微软官方 Bootstrapper、
验证微软签名并安装。安装器不携带完整 Runtime，成品有 10 MiB 上限。macOS 使用 CEP ZIP。

## 权限、失败重试与回滚

工作流仅由手动触发或 `v*` 标签推送启动，不向 fork PR 提供 SDK Secrets。默认
`GITHUB_TOKEN` 为 `contents:read`；只有 publish 作业请求 `contents:write`，独立
refresh-pages 作业请求 `actions:write`。官方 actions 固定提交 SHA。SDK Secrets 只注入
恢复步骤，不写入产物元数据；检查只报告疑似凭据位置，不打印值。

失败构建不公开 Release。上传失败时保留草稿，修复后重跑失败作业；超过 artifact 保留期
需重新构建。不要删除完整性或版本门禁来跳过失败。

回滚已发布版本时，将有问题的 Release 改为草稿，再从 main 手动运行现有 Pages 工作流，
使官网指向上一稳定版本。保留标签，修复后发布新补丁版本。用户可导出数据并恢复安装前
备份，或独立使用保留的 CEP；不要用旧数据覆盖新增编辑。

托管 runner 不安装或启动 AE，实际宿主兼容性需要在目标 AE 中检查。公共文档只记录操作
规范，个人调试和验收记录仅本地保存。
