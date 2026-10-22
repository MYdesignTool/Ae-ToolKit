# 独立 AEGP + WebView2 输入验证原型

此目录提供独立输入验证页面、通用构建辅助和 echo-only 消息桥接。探针不随产品安装器分发。
使用独立插件名、窗口类、消息 channel、域名及缓存目录，避免与其他使用方冲突。

## 构建与验证

默认使用当前工作区已固定的 AE May 2023 SDK 和 WebView2 SDK `1.0.4258.31`，见
`../build/README.md`。需要另行验证时可显式传入 SDK 路径：

```powershell
& native/input-probe/Build.ps1 -AeSdkRoot '<AE SDK>' -WebView2SdkRoot '<WebView2 SDK>'
& native/input-probe/VerifyResource.ps1 -Plugin .artifacts/webview2-probe/bin/AeltInputProbe.aex
$env:NODE_PATH='<Playwright 所在 node_modules>'
node native/input-probe/tests/browser.cjs
```

输出全部在忽略目录 `.artifacts/webview2-probe/`，包含开发 AEX、原始输入验证页面、
本项目既有 CodeMirror 及许可、测试可执行文件与截图，不生成安装器。构建需要 MSVC
与 Windows SDK；默认路径可通过参数覆盖。`-TestsOnly` 只构建并运行假宿主队列测试。

默认使用受限的 General AEGP PiPL 编码器，仅支持本原型声明的五个属性；其他声明直接失败。
`-UseAdobePiPLTool` 可选择 Adobe 工具链。资源读取检查不加载插件。

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
