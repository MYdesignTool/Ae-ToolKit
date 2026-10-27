# Host 桥接接口

## 唯一面板入口

`extension/client/js/util.js` 中的 `callHost(name, args, callback)` 统一调用 `AELT_*` 方法。CEP 将每个参数编码为 JSON 字面量，通过 `evalScript` 调用并解析返回的 JSON；Windows 原生版经 `AeltNativeBridge` 和 AE idle 调用相同的宿主接口，前端回调均收到对象。原生传输允许对相同安装根目录传入布尔重载参数，不允许改变模块根目录。

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

以当前 `extension/host/index.jsx` 为准：

| 方法 | 参数 | 用途 |
| --- | --- | --- |
| `AELT_setModuleBase` | `path, reload?` | 校验扩展根目录并初始化模块；面板启动传 `true` 刷新宿主缓存 |
| `AELT_ping` | 无 | 检查就绪状态与宿主版本 |
| `AELT_bootstrap` | 无 | 读取默认规则、表达式与更新日志 |
| `AELT_loadSettings` / `AELT_saveSettings` | 无 / `settings` | 读取或保存设置 |
| `AELT_loadOrganizerSchemes` | 无 | 获取整理方案 |
| `AELT_saveOrganizerScheme` / `AELT_deleteOrganizerScheme` | `scheme` / `id` | 保存或删除个人方案 |
| `AELT_organizeProjectWithScheme` | `scheme` | 执行工程整理 |
| `AELT_getSelectedPropertySummary` | `targets?` | 获取具体属性或图层变换目标的摘要 |
| `AELT_applyExpression` | `expression, overwriteExisting, expectedSelection, targets?` | 应用表达式并核对选择目标 |
| `AELT_removeExpressions` | `expectedSelection, targets?` | 移除当前目标属性的表达式 |
| `AELT_selectScriptFolder` | `language` | 打开脚本目录选择对话框 |
| `AELT_scanScripts` / `AELT_launchScript` | `path` | 扫描目录或启动已扫描脚本 |
| `AELT_exportUserData` / `AELT_importUserData` | `language` | 导出或导入完整个人数据 |

`language` 使用 `zh-CN` 或 `en`。属性摘要、整理方案等具体对象结构应参考对应模块源码和测试，按所支持的版本核对。

`targets` 为变换标识数组：`anchorPoint`、`position`、`scale`、`rotation`、`opacity`、`orientation`、`xRotation`、`yRotation`。省略时默认 `[]`，表示无图层目标。具体属性选择优先；仅选中图层时才解析变换目标。`rotation` 使用 `ADBE Rotate Z`，兼容 2D 旋转和 3D Z 旋转；分离位置展开为各轴属性。摘要包含 `mode`（`properties` / `layers` / `none`）、`layers`、`targets`、`supported`、`existing`、`skipped` 及 `selectionKey`。应用或移除时应传回同一份 `selectionKey` 和 `targets`。

## 扩展接口的约定

1. 在 Host 模块中实现逻辑，在 `host/index.jsx` 暴露 `AELT_` 加英文字母组成的方法名。
2. 使用 `AELocalToolkit.returnResult` 编码返回结果；异常使用统一错误格式。
3. 在面板用 `callHost` 调用，检查 `ok` 后再更新界面或保存状态。
4. 路径以原生字符串传输，不混用 `escape`、URI 编码或手工拼接参数。
5. 修改 AE 工程时维护撤销组，在 `finally` 中正确关闭；表达式操作同时核对选择摘要，防止异步期间目标改变。

脚本启动入口只接受本次扫描集合中的 JSX / JSXBIN。不要为了新功能绕过该集合校验。
