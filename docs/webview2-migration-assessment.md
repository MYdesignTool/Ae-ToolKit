# Windows AEGP Panel + WebView2 迁移评估

评估日期：2026-10-21。范围：当前 AeLocalToolkit 的 Windows x64 面板，从 CEP 迁移到 AEGP 可停靠面板内的 WebView2。本文的人日是实施前的工程估计，不是交付承诺。用户随后授权保留 CEP 并开分支完成移植；完整候选已在 `codex/webview2-migration` 构建和独立部署。未发布、未生成安装器、未复制或替换 Adobe DLL。

后续实证：[`native/panel-host/`](../native/panel-host/README.md) 已成为可配置、无 Starfield 业务依赖的独立模块；[`native/input-probe/`](../native/input-probe/README.md) 作为首个使用方构建并通过 AE 23.5 用户实测。普通 input、textarea、CodeMirror 的微软拼音首次/连续输入、窗口状态变化及本轮要求的编辑操作均获用户确认正常。随后 [`native/toolkit/`](../native/toolkit/README.md) 接入全部 17 个业务入口、完整界面、资源和独立数据副本；用户确认完整界面正常、候选窗跟随光标。离线回归及真实 AE 的设置、方案、特殊路径图片、脚本扫描/运行、选区读取回归通过；工程写入、文件对话框和更多环境的验收范围见完整移植说明。复用成熟宿主降低了原型搭建成本，下文估计保留为实施前记录。

## 结论与证据边界

实施采用小型宿主验证后移植完整界面的顺序。现有 HTML/CSS、CodeMirror 与主要 ExtendScript 业务得以保留，新增工作集中在原生面板壳、WebView2 生命周期、消息桥接与宿主回归。

用户观察到多个 CEP 扩展有同类微软拼音问题，而其测试的 AEGP Panel + WebView2 面板正常。这支持排查 CEP 宿主与浏览器输入集成，但不能单凭观察证明所有 CEP 均受影响，或 WebView2 必然修复本项目。当前 CEP 组合仍是直接输入错位、删除后恢复；原生焦点顺序原型未改善这一结果。随后直接原生坐标同步原型导致宿主无响应，已停止并卸载。原生 hook 和坐标同步均不应视为已验证的产品方案。

微软官方反馈库也有 WebView2 输入法定位报告：[窗口缩放后韩文合成窗到左上角 #5675](https://github.com/MicrosoftEdge/WebView2Feedback/issues/5675)、[composition mode 在远程桌面中的候选窗定位 #5570](https://github.com/MicrosoftEdge/WebView2Feedback/issues/5570)。这些是报告者的复现与推测，不能当作本项目根因或微软已确认的修复结论。它们说明应在真实 AE 可停靠宿主中验证，而不能用普通 Edge 网页正常替代验收。

## 当前代码的复用与适配范围

| 范围 | 当前接点 | 迁移处理 |
| --- | --- | --- |
| 前端界面 | `extension/client/`，无框架、无构建步骤；本地 CodeMirror、Acorn、Prettier | 保留主要代码与样式，不为迁移重做界面 |
| 宿主调用 | `extension/client/js/util.js:89` 的 `callHost(name,args,callback)` | 保留对业务暴露的接口，更换或增加 WebView2 传输适配 |
| AE 业务 | `extension/host/index.jsx` 的 17 个 `AELT_*` 入口，及 organizer/expressions/launcher/storage 模块 | 优先继续用 ExtendScript；不必先把整理工程与表达式应用重写为 C++ |
| 初始化 | `extension/client/js/app.js:150` 从 `file:` URL 推导根目录；`extension/host/index.jsx:19` 还检查 `CSXS/manifest.xml` | 原生提供可信安装根目录，调整包身份校验与启动加载；不能照搬 CEP 假设 |
| 文件 IO | `extension/host/modules/storage.jsx` 读写 `data/user-data.json`，已有备份、相对路径与旧数据迁移 | 沿用 JSON 格式和串行写入逻辑；确定新安装位置及迁移策略，避免两套面板同时写同一文件 |
| 文件对话框 | `AELT_selectScriptFolder`、导入、导出通过 ExtendScript 打开对话框 | 在安全的 AE 主线程调度边界执行，验证对话框焦点、取消、关闭与回包 |
| 脚本图片 | launcher 返回本机图片路径，前端转 `file:` URL | 根据页面加载方式适配任意脚本目录中的图片，不只验证应用自身的相对资源 |
| 外部链接 | `extension/client/js/ui.js` 使用 `window.cep.util.openURLInDefaultBrowser` | 改为受控原生打开链接接口，不能直接假定 CEP API 存在 |
| 输入与快捷键 | CodeMirror extraKeys、标签 Enter、目录树键盘操作、AE 宿主快捷键 | 保留业务键位；原生壳只精确处理需要的组合键，实测 IME、剪贴板、撤销重做与 Tab 焦点 |
| 生命周期 | app 在 `visibilitychange`、`beforeunload` 发起异步保存 | 处理原生隐藏/关闭/重建及待处理请求；关闭时异步调用能否完成需要明确握手，不能只依赖 `beforeunload` |
| 安装与构建 | 当前是 CEP 清单和目录、NSIS/ZIP 白名单 | 后续新增 AEGP 插件构建、Runtime 检测与依赖、升级回退；本文不执行打包 |

以上路径是当前仓库接点，不是外部技术引用；行号可能随开发变化。现有脏工作区保持不变。

## 推荐的最小技术路线

先采用标准 HWND windowed WebView2，嵌入 AEGP 创建面板回调提供的 Windows 容器。不从 composition/windowless 模式起步，避免在首个验证中扩大输入、绘制和坐标集成范围。Adobe 原始 SDK 将 Windows `AEGP_PlatformViewRef` 定义为 HWND，Panelator 直接展示了该容器的使用，见后文原始文件索引。

前端保留 `callHost()`：WebView2 使用带请求 ID 的 JSON 消息，例如 `{id,method,args}`，原生只允许固定的 17 个已知入口，验证消息来源与参数。原生将任务排队，离开 WebView2 回调后由 AE 主线程 idle hook 通过 `AEGP_ExecuteScript` 执行，再异步回传结果；不把通用脚本执行能力暴露给外部导航页面。页面重载、关闭、旧回包、重复 ID、错误与超时需有明确处理。[微软原生与网页消息机制](https://learn.microsoft.com/en-us/microsoft-edge/hosting/webview2/gettingstarted)

WebView2 要求 STA、UI 消息泵以及同线程访问，回调内同步打开嵌套模态 UI 存在重入限制；不能在回调中阻塞等待浏览器异步完成。现有 JSX 的目录/文件对话框也是迁移的关键测试点。[微软线程与重入契约](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/threading-model)

本方案保守地将 AE Suite 获取、脚本执行和项目修改都限制在 AE 主线程调度边界。SDK 原始头文件明确说明 `AEGP_CauseIdleRoutinesToBeCalled` 可从非主线程异步调用，但获取 Suite 函数指针本身不具备线程安全保证，需先在主线程保存。这一条并未授权任意 Suite 在工作线程执行；不能据此省略调度。

面板壳需处理关闭/重开、停靠/浮动、隐藏、工作区切换、resize、移动和多屏 DPI。维护 WebView2 Bounds、焦点、Tab 出入、父窗口位置通知；不能把 AE 的全部按键全局吞掉或全部转发。WebView2 提供 `MoveFocus`、焦点事件、`AcceleratorKeyPressed` 及 `NotifyParentWindowPositionChanged` 等接点，但正确集成仍须实测。[微软控制器接口概述](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/overview-features-apis)

本地资源可采用受限的虚拟 HTTPS 域名映射或经验证的文件加载方案。若使用虚拟域名，不能继续从 URL pathname 推导真实安装目录，也要覆盖外部脚本目录图片的加载。仅映射应用静态资源目录，不为了方便暴露整个磁盘。[微软本地资源加载文档](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/working-with-local-content)

WebView2 的浏览器缓存目录应与业务 JSON 分开，显式放在用户可写目录。Win32 默认位置靠近宿主可执行文件，在 AE/Program Files 中可能无写权限，导致初始化失败。[微软用户数据目录要求](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/user-data-folder)

## 分阶段工作量

假设：一名熟悉 C++/Win32 的开发者、每人日约 8 小时；Windows x64；保留当前界面和 JSX；首轮 AE 23.5 加至少一个较新 AE 版本；能取得合法 SDK 和测试环境。不包含 macOS、业务改版、签名证书采购或外部审核等待时间。

| 阶段 | 可审查交付和退出条件 | 工程估计 |
| --- | --- | --- |
| 可停靠验证原型 | AEGP 壳加载最小 input/textarea/同一 CodeMirror 测试页；微软拼音首次和连续输入，以及停靠/移动/缩放后均正确；验证基础英文与编辑操作 | 2–4 人日 |
| 桥接与现有业务接入 | 17 个入口、启动与 Unicode 路径、异步请求生命周期、错误返回、目录/文件对话框、第三方脚本运行 | 3–5 人日 |
| 面板与资源完善 | 工作区、隐藏关闭与恢复、DPI、图片路径、焦点/快捷键、缓存目录和浏览器失败处理 | 2–4 人日 |
| 完整回归与分发准备 | 数据迁移、备份、AE 撤销、不同 AE/系统、缺失 Runtime、更新回退、可重复构建与维护文档 | 4–7 人日 |
| 总计取整 | 包含上述原型与适度集成余量 | **12–22 人日** |

原型是停止投入的决策点：如果真实宿主中微软拼音仍错位，先调查 WebView2 集成与运行时，再决定是否迁移，不继续用迁移工作量掩盖未通过的验收。更多 AE 版本、复杂多屏环境与企业离线部署可将预算扩大到约 18–30 人日；只有完成原型才能收窄估计。现成的可复用原生壳可能降低部分搭建成本，不能自动抵扣本项目的桥接与回归工作。

运行时优先评估 Evergreen，并处理缺失情况；Fixed Version 由开发者自行维护更新且显著增加包体。WebView2 Runtime 与完整 Edge 浏览器是不同依赖，不能用“装了 Edge”替代 Runtime 检测。原生插件部署与升级生命周期也不同于 CEP 文件重载。[微软 Runtime 分发说明](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution)

## 验证清单与版本建议

原型验收必须发生在 AE 宿主：普通 input、textarea、CodeMirror 的微软拼音首次输入、连续输入、选词、取消与删除；英文、选区、系统复制粘贴、撤销重做、Ctrl+Enter、Tab/Shift+Tab；面板浮动/停靠、移动/resize、多屏 DPI、焦点往返。浏览器自动化可以验证 DOM 编辑行为，不能代替原生候选窗定位验收。

完整迁移还需验证工程整理、表达式应用/移除及 AE 撤销组、方案/设置保存、失败保留草稿、备份导入导出、脚本扫描与运行、中文和特殊字符路径、图片、关闭重开、宿主退出、缺失或失败的 Runtime、数据迁移与回退。原生插件代码处于 AE 进程内，错误可影响宿主；不能把浏览器多进程当成整个插件的崩溃隔离保证。

v0.5.1 的原 CEP 保存在 `codex/cep-0.5.1-baseline`；原生完整工具箱在 `codex/webview2-migration` 独立开发，原型、原生工具箱与 CEP 安装及数据分离。用户已授权实施迁移，尚未授权发布或生成安装器。不同 AE 版本、多屏 DPI 和正式分发仍属于后续验证范围。

## 一手来源与本机 SDK 核查索引

Adobe 官方 SDK 获取入口：[After Effects 开发入口](https://developer.adobe.com/after-effects/) → Get the SDKs。以下是本机已存在并只读核查的 **May2023_AfterEffectsSDK 原始包**。路径用于审计来源，不表示此仓库或发布包可依赖该绝对位置，也不表示可以复制、再分发 SDK。正式实现应通过开发者配置定位其依法取得的 SDK，并核查许可；不复制或替换 Adobe 已安装的 DLL。

本机 SDK 根目录：

`D:\Project\Code\AE星辰粒子插件Stardust  v1.6.0b\newStardust\AdobeSDK\May2023_AfterEffectsSDK`

下列局部声明只帮助定位签名，完整类型与调用约定以原始头文件为准，不能猜测 ABI：

| 已核实的原始文件 | 关键行与接口/限制 |
| --- | --- |
| [AE_GeneralPlugPanels.h](<D:/Project/Code/AE星辰粒子插件Stardust  v1.6.0b/newStardust/AdobeSDK/May2023_AfterEffectsSDK/Examples/Headers/AE_GeneralPlugPanels.h:17>) | 第 17 行 Windows 容器类型为 `HWND`；第 86 行 `AEGP_CreatePanelHook` 回调接收 `AEGP_PlatformViewRef container`；第 97 行 `AEGP_RegisterCreatePanelHook`；第 118/122 行 `AEGP_ToggleVisibility`、`AEGP_IsShown`；PanelSuite1 版本注释为 frozen in AE 8.0。不能仅据此保证未来所有 AE 版本兼容。 |
| [AE_GeneralPlug.h](<D:/Project/Code/AE星辰粒子插件Stardust  v1.6.0b/newStardust/AdobeSDK/May2023_AfterEffectsSDK/Examples/Headers/AE_GeneralPlug.h:2773>) | 第 2773 行 `AEGP_RegisterIdleHook(plugin_id,idle_hook,refcon)`；第 2984–2989 行明示 `AEGP_CauseIdleRoutinesToBeCalled(void)` 的异步与非主线程限制及预先保存指针要求。 |
| [AE_GeneralPlug.h 的脚本入口](<D:/Project/Code/AE星辰粒子插件Stardust  v1.6.0b/newStardust/AdobeSDK/May2023_AfterEffectsSDK/Examples/Headers/AE_GeneralPlug.h:3021>) | 第 3021 行 `AEGP_ExecuteScript(inPlugin_id,inScriptZ,platform_encodingB,outResultPH0,outErrorStringPH0)`；第 3015–3020 行说明脚本文本可为 UTF-8 或应用当前编码，结果/错误使用所选编码，输出可省略。现有 JSON 与中文路径需要明确 UTF-8 边界及 MemHandle 释放。 |
| [Panelator.cpp](<D:/Project/Code/AE星辰粒子插件Stardust  v1.6.0b/newStardust/AdobeSDK/May2023_AfterEffectsSDK/Examples/AEGP/Panelator/Panelator.cpp:102>) | 第 102 行注册面板创建回调；第 115/126 行演示可见性切换与状态查询。它证明 AEGP 的面板接点，不是现成 WebView2 集成。 |
| [Windows PanelatorUI_Plat.cpp](<D:/Project/Code/AE星辰粒子插件Stardust  v1.6.0b/newStardust/AdobeSDK/May2023_AfterEffectsSDK/Examples/AEGP/Panelator/Win/PanelatorUI_Plat.cpp:21>) | 第 21 行设置容器窗口过程、第 25 行在容器内创建子控件、第 142 行链回原窗口过程。示例需改造和回归，不能将其简单复制视为生产生命周期处理完成。 |
| [随包 After_Effects_SDK_Guide.pdf](<D:/Project/Code/AE星辰粒子插件Stardust  v1.6.0b/newStardust/AdobeSDK/May2023_AfterEffectsSDK/After_Effects_SDK_Guide.pdf>) | 已确认只有一页，内容是指南迁移网址指引；本文没有把它当成完整线程手册，也未引用不存在的章节或页码。 |

本文外部技术依据仅为 Adobe 官方入口/本机原始 SDK、微软官方文档和微软官方反馈库。未以第三方博客、其他插件工程实现或现成商品宣传作为兼容性与工作量依据。
