# 架构与维护

前端无框架、无构建步骤，按依赖顺序加载脚本。`callHost(name, args, callback)` 是唯一桥接入口，参数统一用 JSON 字面量编码，不混用 escape、URI 编码和字符串拼接。路径以原生路径传输；图片从 File.fsName 转换为浏览器 file URL，不把 ExtendScript 的 absoluteURI 路径直接当作网页地址。

面板从自身 URL 得到根目录，一次调用 `AELT_setModuleBase`，依次加载 json、storage、organizer、expressions、launcher。失败明确返回，不扫描其他扩展、不复制临时脚本执行。`AELT_bootstrap` 读取只读 JSON，默认规则保持单一来源。

ExtendScript 的 `host/lib/json.jsx` 是 ES3 兼容的严格 JSON 解析器，不使用 eval。模块加载与用户选定脚本使用 `$.evalFile`，属于明确的脚本执行入口。

`storage.jsx` 以扩展内 `data/user-data.json` 作为唯一用户数据文件，统一保存设置、收藏、自定义表达式和整理方案；内置默认数据独立。迁移时整合旧安装目录与上一版用户目录，已有便携数据始终优先。扩展内脚本路径和收藏存为相对路径。写入及备份覆盖完整文档，导入只替换一次，避免设置与方案部分更新。`settings.js` 用内存快照串行保存，避免异步返回乱序覆盖。设置读取失败时停止写入，仍可导入备份恢复。

表达式只处理选中的可用属性；批次签名包含合成、图层和属性路径，用于防止目标变化。面板保留原来的覆盖确认和安静模式；宿主接口也支持跳过已有表达式。失败尝试恢复原值，撤销组在 finally 关闭。实际表达式求值仍需宿主回归。

脚本扫描维护本次文件集合，运行入口只接受其中的 JSX/JSXBIN。选择行不重建 DOM，保留双击和焦点。保留横幅列表及单次名称显示，优先匹配所选脚本根目录内 image 文件夹，再回退到脚本旁图片。第三方脚本不是沙箱代码，具有 AE 脚本权限。

Pages 只发布 index.html 与 assets/。安装器和 ZIP 使用程序目录及四个默认 JSON 的白名单，版本来自 changelog.json。安装器使用系统级 CEP 目录，仅 data 子目录授予安装用户的修改权限；更新前备份 data，保留个人文件，旧用户级及其他系统级清单校验扩展 ID 后重命名停用。网页无 CDN 运行时依赖；首屏粒子使用 WebGL，在离屏、隐藏及减少动态效果时停止逐帧渲染。

验证：`node --test tests/*.test.cjs`；浏览器交互测试见 `tests/browser.cjs`，需要 Playwright。模拟测试不替代 AE 2023 / 新版 AE 回归。

Host 启动按 UTF-8 读取已安装的文本模块后执行，不对自身模块使用 `$.evalFile`。真实 AE 中已复现后者对 launcher.jsx 抛出 Cannot convert，而 Node 模拟不会复现。启动失败时 Debug 临时可见并记录完整错误，不依赖尚未读取的 Debug 设置，也不写回用户偏好。
