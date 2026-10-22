# 架构与维护

`codex/webview2-migration` 试验分支保留以下 CEP 架构，并新增完整原生使用方。`native-bridge.js` 在 core 之前加载，仅在原生配置与 WebView2 同时存在时启用。界面调用仍集中于 `callHost`；CEP 走原 `evalScript`，原生走有界消息队列和 AE idle。17 个业务入口在独立的 JSX 词法闭包中执行，不替换 CEP 的全局对象。原生副本和数据位于隔离 worktree 的 `.artifacts/webview2-toolkit/bin/extension`；完整构建/部署/回退见 [原生工具箱](../../native/toolkit/README.md)。原工作区 CEP 基线分支不受此试验文件修改影响。

前端无框架、无构建步骤，按依赖顺序加载脚本。`callHost(name, args, callback)` 是唯一桥接入口，参数统一用 JSON 字面量编码，不混用 escape、URI 编码和字符串拼接。路径以原生路径传输；图片从 File.fsName 转换为浏览器 file URL，不把 ExtendScript 的 absoluteURI 路径直接当作网页地址。

0.5.1 加载顺序：`core → ime-focus → translations → i18n → util → settings → ui → organizer → organizer-paths → vendor → editor → expressions → scripts → app`。`editor.js` 封装本地 CodeMirror 5，原 `expressionCode` textarea 作为同步的数据入口；选择/保存/删除通过 `AELT.editor.setValue()` 更新编辑器，输入时同步 textarea。合成输入期间保护提交快捷键，并保留编辑器滚动和选区。启用时 app 缓存元素后先初始化焦点模块；原版跳过非空标签草稿，其他情况下保留文本选区执行一次延后 blur / focus。Acorn 只解析语法，允许 AE 常见的顶层 return 与宿主全局名称；Prettier standalone + Babel parser 在用户点击或使用快捷键时格式化，不执行表达式，错误不修改原稿。版本和许可见 `client/vendor/README.md`。无运行时 CDN 请求。

工程整理的 `organizer-paths.js` 提供单列可搜索目录树，汇集所有方案、全局目录和当前草稿的路径与父级，支持逐级新建、完整路径粘贴以及取消。选择结果先保存在弹层会话中，确认使用后才写回只读路径框，不访问宿主或实际创建目录。后缀在单一输入框内显示为可移除标签，按 Enter 生成；保存/整理前检查非法值和跨规则后缀冲突。发送给宿主的 `path` 与 `extensions` 数据结构沿用旧版。

目录弹层打开时缓存目录节点及父级集合，单击只更新选中状态，不替换列表 DOM；搜索、展开时保留滚动及键盘焦点，打开即滚动到当前目录。搜索按路径关键词匹配，完整路径和同名目录优先。双击目录或搜索/树中按 Enter 直接使用；无搜索结果时 Enter 将搜索名称带入新建表单。新建或粘贴路径共用底部确认按钮，按当前模式执行，避免多次确认。Escape 先取消当前表单，再关闭弹层。搜索结果区保持高度，弹层方向在本次打开期间固定，减少位置跳变。

方案以宿主读取/成功写入的数据为基线，规则与名称编辑留在草稿中。内置预设另存为个人方案；个人方案按原 ID 保存修改，重命名、新建、复制和删除收进更多操作。未保存状态下切换方案或新建前会确认，保存失败保留草稿，保存期间禁用方案控件，成功后才更新基线。全局目录和忽略名单独立即时持久化，不参与方案脏状态。语言切换只刷新文案，保留规则和输入草稿。

忽略合成名称复用后缀标签外观，输入完整名称按 Enter 添加，失焦提交；数组形式保留名称中的空格，显式空数组不会补回 Main。旧分隔文本仍可读取、导入，并在首次编辑后存为数组。宿主原本已支持两种形式；设置校验与备份扩展为同时接收字符串和字符串数组，仍拒绝其他类型。匹配时继续忽略大小写，模糊匹配保持包含语义。

`i18n.js` 负责静态标签与动态文案，中文源键和英文翻译保存在 `translations.js`。用户名称、规则路径、表达式代码不翻译；内置条目名称及标签按语言显示。`language` 设置为 `zh-CN` / `en`，缺省中文，沿用串行持久化及完整备份机制。宿主原生文件选择对话框接收可选语言参数；已知宿主消息在前端翻译，Debug 保留桥接原始结果。切换语言不重建规则输入区或表达式编辑器，保留草稿和撤销历史。

面板从自身 URL 得到根目录，一次调用 `AELT_setModuleBase`，依次加载 json、storage、organizer、expressions、launcher。失败明确返回，不扫描其他扩展、不复制临时脚本执行。`AELT_bootstrap` 读取只读 JSON，默认规则保持单一来源。

ExtendScript 的 `host/lib/json.jsx` 是 ES3 兼容的严格 JSON 解析器，不使用 eval。模块加载与用户选定脚本使用 `$.evalFile`，属于明确的脚本执行入口。

`storage.jsx` 以扩展内 `data/user-data.json` 作为唯一用户数据文件，统一保存设置、收藏、自定义表达式和整理方案；内置默认数据独立。迁移时整合旧安装目录与上一版用户目录，已有便携数据始终优先。扩展内脚本路径和收藏存为相对路径。写入及备份覆盖完整文档，导入只替换一次，避免设置与方案部分更新。`settings.js` 用内存快照串行保存，避免异步返回乱序覆盖。设置读取失败时停止写入，仍可导入备份恢复。

表达式只处理选中的可用属性；批次签名包含合成、图层和属性路径，用于防止目标变化。面板保留原来的覆盖确认和安静模式；宿主接口也支持跳过已有表达式。失败尝试恢复原值，撤销组在 finally 关闭。实际表达式求值仍需宿主回归。

脚本扫描维护本次文件集合，运行入口只接受其中的 JSX/JSXBIN。选择行不重建 DOM，保留双击和焦点。保留横幅列表及单次名称显示，优先匹配所选脚本根目录内 image 文件夹，再回退到脚本旁图片。第三方脚本不是沙箱代码，具有 AE 脚本权限。

Pages 只发布 index.html 与 assets/。安装器和 ZIP 使用程序目录及四个默认 JSON 的白名单，版本来自 changelog.json。Windows 安装器使用所选 AE 的 `Support Files/Plug-ins/AeltToolkitWebView2`，仅 data 授予安装账户修改权限；更新前备份 data，保留个人文件及旧 CEP。macOS 使用 CEP 目录。网页无 CDN 运行时依赖；首屏粒子使用 WebGL，在离屏、隐藏及减少动态效果时停止逐帧渲染。

验证：`node --test tests/*.test.cjs`；浏览器交互测试见 `tests/browser.cjs`，需要 Playwright。模拟测试不替代 AE 2023 / 新版 AE 回归。

Host 启动按 UTF-8 读取已安装的文本模块后执行，不对自身模块使用 `$.evalFile`。此入口显式控制编码和启动错误处理。启动失败时 Debug 临时可见并记录完整错误，不依赖尚未读取的 Debug 设置，也不写回用户偏好。
