# 架构与维护

Windows 使用 AEGP + WebView2 原生宿主，macOS 保持 CEP；两平台共用前端与 ExtendScript 业务模块。`native-bridge.js` 在 core 之前加载，仅在原生配置与 WebView2 同时存在时启用。界面调用集中于 `callHost`；CEP 走 `evalScript`，原生走有界消息队列和 AE idle。原生入口在独立 JSX 词法闭包中执行，不替换 CEP 全局对象。构建、安装与回退见[原生工具箱](../../native/toolkit/README.md)。

前端无框架、无构建步骤，按依赖顺序加载脚本。`callHost(name, args, callback)` 是唯一桥接入口，参数统一用 JSON 字面量编码，不混用 escape、URI 编码和字符串拼接。路径以原生路径传输；图片从 File.fsName 转换为浏览器 file URL，不把 ExtendScript 的 absoluteURI 路径直接当作网页地址。

0.5.1 加载顺序：`core → ime-focus → translations → i18n → util → settings → ui → organizer → organizer-paths → vendor → editor → expressions → scripts → app`。`editor.js` 封装本地 CodeMirror 5，原 `expressionCode` textarea 作为同步的数据入口；选择/保存/删除通过 `AELT.editor.setValue()` 更新编辑器，输入时同步 textarea。合成输入期间保护提交快捷键，并保留编辑器滚动和选区。启用时 app 缓存元素后先初始化焦点模块；原版跳过非空标签草稿，其他情况下保留文本选区执行一次延后 blur / focus。Acorn 只解析语法，允许 AE 常见的顶层 return 与宿主全局名称；Prettier standalone + Babel parser 在用户点击或使用快捷键时格式化，不执行表达式，错误不修改原稿。版本和许可见 `client/vendor/README.md`。无运行时 CDN 请求。

工程整理的 `organizer-paths.js` 提供单列可搜索目录树，汇集所有方案、全局目录和当前草稿的路径与父级，支持逐级新建、完整路径粘贴以及取消。选择结果先保存在弹层会话中，确认使用后才写回只读路径框，不访问宿主或实际创建目录。后缀在单一输入框内显示为可移除标签，按 Enter 生成；保存/整理前检查非法值和跨规则后缀冲突。发送给宿主的 `path` 与 `extensions` 数据结构沿用旧版。

0.6.1 在 `vendor` 与 `editor` 之间依次加载 `expression-help.js`、`completion.js`，提供离线双语函数与属性帮助、词库、Acorn token 成员链解析及深色补全列表。首字母或成员访问点即可开始匹配，输入事件延后 90ms 触发；名称前缀优先于词段前缀，排序后最多保留 7 个候选。独立表达式编辑设置分组提供 `expressionCompletion` 和 `expressionHelp` 两个独立布尔开关（缺省开启），以及 `expressionCompletionKey`（Enter / Tab，缺省 Enter），使用既有串行保存与备份导入导出流程。只有所选按键接受候选，另一键保持普通编辑功能。不绑定 Ctrl/Cmd+Space 或 Esc。列表保持原生输入焦点，复用 CodeMirror 键位映射和撤销历史；合成输入、失焦、光标移动、只读等状态清理会话。帮助区使用短句与分参数说明，短内容收紧高度，向上展开时将帮助放在列表上方以保留候选行位置，不在线查询。超大草稿有扫描上限。实现边界与验证见 [测试与构建](../../docs/manual/developers/testing.md)。

表达式标签过滤在前端会话数组 `expressionTagSelection` 中保存多选项，所有已选标签与名称搜索共同匹配，标签块可逐个移除或清空。标签编辑与过滤共用完整表达式列表的标签目录，保存窗口可以选择已有标签或输入后按 Enter 添加；目录选项使用文本节点渲染，不插入用户 HTML。过滤不改动当前草稿，标签源消失时清理过期过滤项。

`selects.js` 在原单选 select 数据模型旁显示统一 combobox，使用共享 listbox 浮层与 `animatePopup` 处理全部下拉菜单的进出动画。表达式 option 的 `data-tags` 保存转义后的标签数组，展示时使用文本节点拆成左侧名称和右侧标签块。原 select 保留 value、options、change 事件及既有业务逻辑；可见按钮承担键盘焦点和 ARIA 关系，源控件从辅助技术导航隐藏。选项与属性观察器在移除控件后断开，语言/设置刷新和弹窗焦点循环通过 `AELT.selects` 同步。

目录弹层打开时缓存目录节点及父级集合，单击只更新选中状态，不替换列表 DOM；搜索、展开时保留滚动及键盘焦点，打开即滚动到当前目录。搜索按路径关键词匹配，完整路径和同名目录优先。双击目录或搜索/树中按 Enter 直接使用；无搜索结果时 Enter 将搜索名称带入新建表单。新建或粘贴路径共用底部确认按钮，按当前模式执行，避免多次确认。Escape 先取消当前表单，再关闭弹层。搜索结果区保持高度，弹层方向在本次打开期间固定，减少位置跳变。

方案以宿主读取/成功写入的数据为基线，规则与名称编辑留在草稿中。内置预设另存为个人方案；个人方案按原 ID 保存修改，重命名、新建、复制和删除收进更多操作。未保存状态下切换方案或新建前会确认，保存失败保留草稿，保存期间禁用方案控件，成功后才更新基线。全局目录和忽略名单独立即时持久化，不参与方案脏状态。语言切换只刷新文案，保留规则和输入草稿。

忽略合成名称复用后缀标签外观，输入完整名称按 Enter 添加，失焦提交；数组形式保留名称中的空格，显式空数组不会补回 Main。旧分隔文本仍可读取、导入，并在首次编辑后存为数组。宿主原本已支持两种形式；设置校验与备份扩展为同时接收字符串和字符串数组，仍拒绝其他类型。匹配时继续忽略大小写，模糊匹配保持包含语义。

`i18n.js` 负责静态标签与动态文案，中文源键和英文翻译保存在 `translations.js`。用户名称、规则路径、表达式代码不翻译；内置条目名称及标签按语言显示。`language` 设置为 `zh-CN` / `en`，缺省中文，沿用串行持久化及完整备份机制。宿主原生文件选择对话框接收可选语言参数；已知宿主消息在前端翻译，Debug 保留桥接原始结果。切换语言不重建规则输入区或表达式编辑器，保留草稿和撤销历史。

面板从自身 URL 得到根目录，启动时调用 `AELT_setModuleBase(root, true)` 刷新宿主模块，依次加载 json、storage、organizer、expressions、launcher；不带重载参数的重复调用复用缓存。失败明确返回，不扫描其他扩展、不复制临时脚本执行。`AELT_bootstrap` 读取只读 JSON，默认规则保持单一来源。

ExtendScript 的 `host/lib/json.jsx` 是 ES3 兼容的严格 JSON 解析器，不使用 eval。模块加载与用户选定脚本使用 `$.evalFile`，属于明确的脚本执行入口。

`storage.jsx` 以扩展内 `data/user-data.json` 作为唯一用户数据文件，统一保存设置、收藏、自定义表达式和整理方案；内置默认数据独立。迁移时整合旧安装目录与上一版用户目录，已有便携数据始终优先。扩展内脚本路径和收藏存为相对路径。写入及备份覆盖完整文档，导入只替换一次，避免设置与方案部分更新。`settings.js` 用内存快照串行保存，避免异步返回乱序覆盖。设置读取失败时停止写入，仍可导入备份恢复。

表达式优先处理选中的可用属性；没有选中属性但选中图层时，按前端会话变量 `expressionTransformSelection` 勾选的目标解析图层变换。目标默认空选，重载面板后清空；非模态选择面板勾选立即生效，同次会话保留，不写入设置或备份，旧版目标设置也忽略。使用稳定的 AE match name；2D 跳过方向/X/Y 旋转，分离位置展开各轴，锁定和不存在的属性跳过。摘要、应用、移除三个接口接受同一可选目标数组，省略默认为空。批次签名包含合成、模式、图层 ID、维度/锁定状态、目标标识和属性路径，防止确认期间目标变化。面板保留原来的覆盖确认和安静模式；宿主接口也支持跳过已有表达式。失败尝试恢复原值，撤销组在 finally 关闭；界面异步刷新忽略过期响应。实际表达式求值仍需宿主回归。

脚本扫描维护本次文件集合，运行入口只接受其中的 JSX/JSXBIN。选择行不重建 DOM，保留双击和焦点。保留横幅列表及单次名称显示，优先匹配所选脚本根目录内 image 文件夹，再回退到脚本旁图片。第三方脚本不是沙箱代码，具有 AE 脚本权限。

Pages 发布 index.html、en/、assets/ 和 VitePress 使用文档构建产物 docs/；文档源目录为 docs/manual，内部记录不直接发布。安装器和 ZIP 使用程序目录及四个默认 JSON 的白名单，版本来自 changelog.json。Windows 安装器使用所选 AE 的 `Support Files/Plug-ins/AeltToolkitWebView2`，仅 data 授予安装账户修改权限；更新前备份 data，保留个人文件及旧 CEP。macOS 使用 CEP 目录。网页无 CDN 运行时依赖；首屏粒子使用 WebGL，在离屏、隐藏及减少动态效果时停止逐帧渲染。

验证：`node --test tests/*.test.cjs`；浏览器交互测试见 `tests/browser.cjs`，需要 Playwright。模拟测试不替代 AE 2023 / 新版 AE 回归。

Host 启动按 UTF-8 读取已安装的文本模块后执行，不对自身模块使用 `$.evalFile`。此入口显式控制编码和启动错误处理。启动失败时 Debug 临时可见并记录完整错误，不依赖尚未读取的 Debug 设置，也不写回用户偏好。
