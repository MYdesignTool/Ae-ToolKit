# 完整工具箱的 WebView2 移植

试验分支 `codex/webview2-migration`。CEP 的 0.5.1 开发状态保存在
`codex/cep-0.5.1-baseline`，提交 `0a631c9`，原工作区和现有 CEP 安装链接均保留。
移植在 Codex 附加的独立 worktree 中开发，不会因更改文件而改变原工作区的 CEP。

此使用方复用 `../panel-host/`，加载完整的现有界面与 ExtendScript 业务。它保留整理、
方案、表达式编辑器与标签、脚本扫描/运行、图片、设置、双语和导入导出。版本继续为
0.5.1；不生成安装器，不自动发布。

## 跨宿主边界

- `native-bridge.js` 在原生配置和 WebView2 都存在时启用；否则原有 CEP 路径继续使用。
- 原生消息只允许 17 个既有 `AELT_*` 方法与受限的外部 HTTP(S) 链接；没有通用 eval API。
- 请求在 WebView2 回调中排队，在 AE idle 执行，避免从浏览器回调直接打开模态对话框。
- C++ 生成词法封闭的 JSX 工厂，缓存于独立的 `$.global.__AELT_WEBVIEW2_V1`。模块、
  启动状态及扫描白名单保持在其闭包中，不替换 CEP 的全局 `AELocalToolkit` 或函数。
- 错误报告状态成对恢复，结果/错误句柄均释放；Unicode、百分号、引号及换行按 UTF-8
  与 JSON 字面值传递。文件路径不会作为待执行代码拼接。
- 仅已接收的设置快照允许在页面关闭后完成；表达式、整理和脚本操作仍在文档失效时
  丢弃。前端原生设置保存不等待 CEP 的 300ms 防抖，降低快速关闭时丢失最后修改的概率。
- 工具箱使用 WebView2 的本地 file URL 加载，保留原有相对资源和任意脚本目录图片路径；
  文件 URL 对 Unicode、字面 `%`、`#`、空格和 UNC 分别编码。导航只允许该唯一文档，
  新窗口/iframe/浏览器权限仍由公共宿主限制。

## 构建与独立数据

```powershell
& native/toolkit/Build.ps1 -AeSdkRoot '<AE May 2023 SDK>' -WebView2SdkRoot '<WebView2 SDK>' -SeedFromCepRoot '<现有 CEP 扩展根>'
```

构建产物在 `.artifacts/webview2-toolkit/`。`bin/extension` 是运行快照，包含静态界面、
JSX 与默认数据；用户设置和方案保存在该快照的 `data/user-data.json`。独立 profile
在同一 artifact 根的 `profile/`。任何缓存或保存都不指向原 CEP 或 Starfield 目录。

`-SeedFromCepRoot` 只在试验数据尚不存在时读取并复制 CEP 状态；包内相对脚本路径会
依据原根目录转换为绝对路径，以免错误指向运行快照。重新构建保留已存在的试验数据，
不会反复覆盖，也不修改源文件。两套面板的数据通过原有 JSON 备份显式互换，不共享写入。

开发验证可显式传 `-DebugPort 8316`，只为此独立 WebView2 环境开放本机调试；默认 0
不开放。调试候选不作为发布包。构建前应关闭已加载此候选的 AE，避免重写加载中的 AEX。

## 测试、部署与回退

```powershell
node --test tests/*.test.cjs
node native/toolkit/tests/gateway.cjs # 先运行 Build，使用实际 C++ 生成的包装代码
$env:AELT_TEST_NATIVE='1'
node tests/browser.cjs
node tests/preferences-tags-browser.cjs
node tests/organizer-tags-browser.cjs
& native/toolkit/Deploy.ps1            # 只报告
& native/toolkit/Deploy.ps1 -Apply     # 保存并退出 AE 后创建独立链接
& native/toolkit/Deploy.ps1 -Apply -Remove # 退出 AE 后只撤销该链接，保留数据
```

部署目标为 AE 2023 `Plug-ins/AeltToolkitWebView2`，与已通过输入法验证的探针及现有 CEP、
Starfield 分离。AE 启动后从 Window 菜单打开 **AE Local Toolkit (WebView2)**。

当前离线证据：62 项逻辑检查、240 项生产队列检查、12 项桥接检查通过；真实 C++ 包装
代码执行实际 JSX 的启动/设置/方案读取/对话框取消通过，并证明未泄漏 CEP 全局。
完整界面在原生传输 mock 下的整理、方案、脚本、表达式、标签、动画、双语与窄面板回归
通过；原有 CEP 输入、编辑器、启动诊断回归通过。

2026-10-21，用户在完整 **AE Local Toolkit (WebView2)** 中确认「完整界面正常，候选窗
跟随光标」。该结果对应已部署 AEX 的 SHA-256
`0A002BA66D18958827874436F18B834BDAE9F51608C3850797DD4221F37D0194`，
不是以独立输入探针的结果替代完整界面验收。完整工具箱的真实 AE 设置保存、方案增删、
图片和脚本调用另由 `node native/toolkit/tests/ae-live.cjs` 检查；需要该候选保持打开，
调试端口为 8316。实际 AE 回归已通过启动、独立运行根、设置保存/读取/恢复、方案
保存/列出/删除、中文与字面百分号路径、扫描返回的图片 URL 加载、临时脚本运行、选区
摘要读取和未知方法拒绝。测试修改均局限于独立试验数据和工作区文件，工程没有改动；
测试设置和方案已清理，原 CEP 数据 SHA-256 与种子记录一致。

实测发现 ExtendScript 会把原生路径的 `%20` 解码为空格。脚本模块现在仅在将原生路径
传入 File/Folder 构造函数时转义字面 `%`；扫描、图片查找和运行均覆盖该边界。测试替身
补充真实解码行为，避免仅用字符串文件系统误判通过。此修正只在迁移分支，CEP 保留分支
不变。AEX 本体不变，已同步运行快照中的该 JSX 模块并刷新试验宿主的私有缓存。

完整工具箱尚未在其他 AE 版本、多屏 DPI 或缺失 Runtime 的机器上实测。工程整理与
表达式修改的业务逻辑通过离线测试，本轮真实 AE 回归为避免修改当前工程未执行这两类
写入；文件对话框实机焦点和备份导入导出仍需后续交互验收。
