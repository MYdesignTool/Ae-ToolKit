# 独立 AEGP + WebView2 输入验证原型

本原型复用抽取后的 `../panel-host/`，与 CEP 工具箱、Starfield 使用独立插件名、
面板 match name、窗口类、消息 channel、虚拟域名和缓存目录。没有修改源 Starfield
项目，没有接入工具箱业务，也没有替换 Adobe DLL 或注入其他进程。

## 构建与验证

使用合法取得的 AE May 2023 SDK 和 WebView2 SDK `1.0.4258.31`，传入本机路径：

```powershell
& native/input-probe/Build.ps1 -AeSdkRoot '<AE SDK>' -WebView2SdkRoot '<WebView2 SDK>'
& native/input-probe/VerifyResource.ps1 -Plugin .artifacts/webview2-probe/bin/AeltInputProbe.aex
$env:NODE_PATH='<Playwright 所在 node_modules>'
node native/input-probe/tests/browser.cjs
```

输出全部在忽略目录 `.artifacts/webview2-probe/`，包含开发 AEX、原始输入验证页面、
本项目既有 CodeMirror 及许可、测试可执行文件与截图，不生成安装器。构建需要 MSVC
与 Windows SDK；默认路径可通过参数覆盖。`-TestsOnly` 只构建并运行假宿主队列测试。

本机 Adobe 旧版 PiPLtool 无法打开输出文件，因此默认使用严格限于本原型五个属性
的 General AEGP 编码器，依据 SDK 的 PiPL 属性布局生成新资源；不复用旧插件资源或
身份。遇到其他声明直接失败。`-UseAdobePiPLTool` 可选择原始 Adobe 工具链。实际 AEX
的资源由独立 Win32 资源读取器核查；这不执行插件代码，也不等于 AE 加载已通过。

2026-10-21：抽取后的生产宿主假 AE 检查 237 项通过；实际 AEX 的五项资源和导出入口
检查通过；浏览器测试页检查通过。

同日用户在 AE 23.5 / Windows 微软拼音完成独立原型验收：普通 input、textarea 和
CodeMirror 的首次与连续输入均正常；移动、缩放、浮动/停靠、切到其他窗口再回来后
候选窗仍正常；英文、系统复制粘贴、撤销重做、Tab/Shift+Tab 和编辑器 Ctrl+Enter
均正常。对应 AEX SHA-256：
`89F0F1276CB7216C19E30F8568AF743FB30548669012511D833204B56CDBFD9C`。
这证明该独立宿主在本次用户测试环境中可用，不代表当前 CEP 工具箱已经迁移完成。
多屏 DPI 未取得单独实测结论，不能据此宣称所有环境均已覆盖。

## 开发部署与撤销

保存并退出 AE 后：

```powershell
& native/input-probe/Deploy.ps1                    # 只报告路径
& native/input-probe/Deploy.ps1 -Apply             # 仅创建 AeltInputProbe junction
& native/input-probe/Deploy.ps1 -Apply -Remove     # 退出 AE 后一条命令撤销 junction
```

默认目标是 AE 2023 的 `Plug-ins/AeltInputProbe`，指向本工作区构建目录。已有同名
普通目录或指向其他位置的链接会拒绝操作；AE 运行时拒绝更改链接。保持源码、缓存和
构建输出在工作区，既有 CEP/Starfield 的安装目录与数据均不改动。安装后记录源/目标
和哈希。AEGP 由 AE 启动扫描，所以首次安装需要重新启动 AE；普通网页重载不够。

打开 AE 后，在 Window 菜单选择 **AeLocalToolkit Input Probe (WebView2)**。

分别在普通 input、textarea 与 CodeMirror 用微软拼音测试首次输入、连续输入、选词、
取消、删除；再验证英文、选区、系统复制粘贴、撤销重做、Tab/Shift+Tab、Ctrl+Enter。
移动/缩放、浮动/停靠、关闭重开、焦点往返以及多屏 DPI 后重复测试。页面右上方的
「已连接」只证明 echo 请求经过 AE idle 回包，不能替代输入法验收。浏览器截图中的
连接状态使用假桥接，不能作为真实宿主连接证据。
