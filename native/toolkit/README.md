# 完整工具箱的 WebView2 移植

此使用方复用 `../panel-host/`，加载工具箱界面与 ExtendScript 业务。构建与发布使用统一版本源，操作见[发布与回滚](../../docs/release-automation.md)。

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

Actions 通过 `-UseHostToolchain` 显式传入经过校验的 SDK 和 runner 编译器目录，跳过本机
`.local-deps` 绑定；该模式要求同时提供 Adobe、WebView2、MSVC 和 Windows SDK 根目录。
产物元数据包含源码/依赖指纹、Git 提交、PE 哈希和工具链版本，不记录本机绝对来源路径。

```powershell
& native/toolkit/Build.ps1 -SeedFromCepRoot '<现有 CEP 扩展根>'
# 安装布局验证使用独立的无调试候选，避免覆盖正在加载的开发面板：
& native/toolkit/Build.ps1 -OutputRoot .artifacts/installer-native
```

构建产物在 `.artifacts/webview2-toolkit/`。`bin/extension` 是运行快照，包含静态界面、
JSX 与默认数据；用户设置和方案保存在该快照的 `data/user-data.json`。SDK 和 x64 工具链
默认来自当前工作区 `.local-deps/` 并核验锁文件，见 [固定依赖](../build/README.md)。
新的安装候选把 profile 放在当前用户 `%LOCALAPPDATA%/AE Local Toolkit/WebView2/profile`，
避免写入受保护的 Plug-ins。更换 AEX 前应退出 AE；数据和缓存使用独立目录。

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

开发部署创建 `Plug-ins/AeltToolkitWebView2` 链接，从「窗口」菜单打开工具箱。
正式分发使用 NSIS 安装器，不把开发链接或输入探针放入产品载荷。
