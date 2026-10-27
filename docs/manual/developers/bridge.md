# Host 桥接接口

## 唯一面板入口

`extension/client/js/util.js` 中的 `callHost(name, args, callback)` 统一调用 `AELT_*` 方法。它统一参数和回调协议：CEP 将参数编码为 JSON 字面量并调用 `evalScript`；Windows 原生版优先通过 `AeltNativeBridge` 发送消息，在 AE idle 执行后返回结果。功能模块继续调用同一个入口。

以下示例在已初始化的扩展面板上下文中执行：

```js
callHost('AELT_getSelectedPropertySummary', [], function (result) {
  if (!result.ok) {
    console.error((result.messages || []).join('\n'));
    return;
  }
  console.log(result);
});
```

回调中的 `result` 已经是对象，不要再次 `JSON.parse`。Host 必须返回包含布尔值 `ok` 的 JSON 字符串，错误消息使用 `messages` 数组。

## 现有接口

共享接口以 `extension/host/index.jsx` 为准；Windows 原生允许列表位于 `native/toolkit/ToolkitScript.hpp`，当前包含同样的 17 个方法，执行状态由独立 JSX 闭包管理：

| 方法 | 参数 | 用途 |
| --- | --- | --- |
| `AELT_setModuleBase` | `path` | 校验扩展根目录并初始化模块；原生仅允许已绑定的根目录 |
| `AELT_ping` | 无 | 检查就绪状态与宿主版本 |
| `AELT_bootstrap` | 无 | 读取默认规则、表达式与更新日志 |
| `AELT_loadSettings` / `AELT_saveSettings` | 无 / `settings` | 读取或保存设置 |
| `AELT_loadOrganizerSchemes` | 无 | 获取整理方案 |
| `AELT_saveOrganizerScheme` / `AELT_deleteOrganizerScheme` | `scheme` / `id` | 保存或删除个人方案 |
| `AELT_organizeProjectWithScheme` | `scheme` | 执行工程整理 |
| `AELT_getSelectedPropertySummary` | 无 | 获取当前选中属性摘要 |
| `AELT_applyExpression` | `expression, overwriteExisting, expectedSelection` | 应用表达式并核对选择目标 |
| `AELT_removeExpressions` | `expectedSelection` | 移除选中属性表达式 |
| `AELT_selectScriptFolder` | `language` | 打开脚本目录选择对话框 |
| `AELT_scanScripts` / `AELT_launchScript` | `path` | 扫描目录或启动已扫描脚本 |
| `AELT_exportUserData` / `AELT_importUserData` | `language` | 导出或导入完整个人数据 |

`language` 使用 `zh-CN` 或 `en`。属性摘要、整理方案等具体对象结构应参考对应模块源码和测试，按所支持的版本核对。

## 扩展接口的约定

1. 在 Host 模块中实现逻辑，在 `host/index.jsx` 暴露 `AELT_` 加英文字母组成的方法名。
2. 使用 `AELocalToolkit.returnResult` 编码返回结果；异常使用统一错误格式。
3. 同时更新原生方法允许列表、参数检查和 JSX 包装；在面板用 `callHost` 调用，检查 `ok` 后再更新界面或保存状态。
4. 路径以原生字符串传输，不混用 `escape`、URI 编码或手工拼接参数。
5. 修改 AE 工程时维护撤销组，在 `finally` 中正确关闭；表达式操作同时核对选择摘要，防止异步期间目标改变。

脚本启动入口只接受本次扫描集合中的 JSX / JSXBIN。原生桥接没有通用 eval API，新增方法必须同时通过两平台边界检查；文档关闭后不自动重试宿主修改操作。
