# 测试与构建

## 共享业务回归

在仓库根目录执行：

```sh
node --test tests/*.test.cjs
node tests/startup.cjs
```

共享面板无需前端打包。浏览器交互测试另需 Playwright 与 Microsoft Edge；例如 `node tests/browser.cjs`、`node tests/editor-browser.cjs`。启用原生传输模拟可设置 `AELT_TEST_NATIVE=1`，并运行相应浏览器脚本。

0.6.1 的专项回归：

```sh
node tests/completion-browser.cjs
node tests/expression-transform-browser.cjs
node tests/preferences-tags-browser.cjs
node tests/selects-browser.cjs
node tests/popup-motion-browser.cjs
node tests/organizer-tags-browser.cjs
node tests/editor-ime-browser.cjs
```

补全测试覆盖 Enter/Tab 二选一、旧设置默认值、单步撤销与参数帮助；变换测试覆盖具体属性优先、2D/3D、分离位置和会话空选；标签与下拉测试覆盖交集筛选、已有标签选择、名称/标签分列、焦点、双语、窄面板和动画倍率。`node tests/expression-transform-ae.cjs "完整路径/AfterFX.exe"` 可在运行中的 AE 中验证真实 ExtendScript 引擎的选择优先分支，使用隔离对象与当前选择只读检查，不改动用户工程。

这些检查不能替代真实 AE 的表达式求值、脚本执行、输入法、文件权限和宿主兼容性验证。CEP 宿主加载可显式运行 `node tests/ae-host.cjs "完整路径/AfterFX.exe"`；Windows 原生 AEX 另需在目标 AE 中检查。

## Windows 原生构建

先阅读[固定依赖说明](https://github.com/MYdesignTool/Ae-ToolKit/blob/main/native/build/README.md)。本机默认从被 Git 忽略的 `.local-deps/` 读取固定 SDK 和工具，普通克隆不包含这些输入。Adobe SDK 按其授权取得，不提交到公开仓库。

```powershell
# 依赖齐备后，先检查原生队列等测试
& native/toolkit/Build.ps1 -TestsOnly
# 构建独立安装候选，修改 AEX 前需退出使用它的 AE
& native/toolkit/Build.ps1 -OutputRoot .artifacts/installer-native
# 使用实际生成的 JSX 包装代码验证网关
node native/toolkit/tests/gateway.cjs .artifacts/installer-native/generated-scripts.json
# 默认只暂存、预处理与校验，不生成安装器或 ZIP
& extension/installer/build.ps1 -Platform all
```

`native/toolkit/Deploy.ps1` 默认只报告，显式 `-Apply` 才创建开发链接；它不是正式安装器。仅在明确需要包产物时使用 `build.ps1 -CreatePackage`，此前必须通过版本、源码指纹和发布候选校验。

平台产物、NSIS 与安装循环验证见[安装器构建说明](https://github.com/MYdesignTool/Ae-ToolKit/blob/main/extension/installer/README.md)。

## GitHub Actions

仓库的 **Build and release Ae-ToolKit** 工作流从当前提交编译 AEX，并生成 Windows 轻量安装器与 macOS CEP ZIP。手动运行默认 `publish=false`；发布由版本匹配的 `v*` 标签触发。

流水线先验证公开文件、版本和依赖，再构建原生宿主、验证桥接、执行迁移与安装循环；两平台均成功后生成双语说明与 `SHA256SUMS.txt`。SDK Secrets、调试输出、个人数据和本机绝对来源路径不属于公开产物。

配置、发布及回滚步骤以[自动构建与发布](https://github.com/MYdesignTool/Ae-ToolKit/blob/main/docs/release-automation.md)为准。发布网站文档无需生成新产品版本、安装器或标签。

## 版本与官网

版本源为 `extension/data/changelog.json`。新增产品版本后用 `node scripts/sync-release.cjs` 同步清单、面板和说明。仅生成官网时，可用 `--site-only --release-tag vX.Y.Z` 选择已发布版本，避免把开发版本当作正式下载。

## 文档站验证

```sh
npm ci
npm run docs:build
npm run docs:preview
```

VitePress 会校验内部文档链接。预览使用 `/Ae-ToolKit/docs/`，维护步骤见[维护使用文档](./documentation.md)。公开提交前运行 `node scripts/release/check-public-files.cjs`。
