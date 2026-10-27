# 数据与扩展约定

0.6.1 设置新增 `expressionCompletion`（布尔，默认 true）、`expressionHelp`（布尔，默认 true）和 `expressionCompletionKey`（Enter / Tab，默认 Enter）。旧数据缺少字段时使用上述默认值，保存与备份沿用原流程；无效字段类型或按键值拒绝写入。变换目标勾选、多标签过滤是前端会话状态，不进入备份；自定义表达式标签仍使用原 `tags` 字符串数组。

## 默认数据与个人数据

内置默认规则和表达式随程序分发，个人数据统一写入运行时扩展根的 `data/user-data.json`：Windows 位于插件 `extension/` 下，macOS 位于 CEP 根下。两平台数据独立，显式使用 JSON 导入导出迁移。安装器与 ZIP 按白名单打包，不包含个人数据。

持久化由 `host/modules/storage.jsx` 负责。写入先落临时文件再替换，保留完整备份；面板 `settings.js` 串行持久化，避免异步返回乱序覆盖。

新增设置时需要同步检查：

- 默认设置与缺省值。
- 读取校验、导入校验及旧数据兼容。
- 完整导入、导出与 `.bak` 恢复。
- 程序更新和卸载时保留个人文件的规则。

不要只修改界面内存而遗漏统一持久化，也不要把个人数据写入内置默认 JSON。

## 路径

扩展内的脚本路径与收藏存为相对路径，移动整个目录后可重新定位。传给 Host 的路径使用原生路径；显示本地图片时转成合法 file URL，正确处理中文、百分号和井号。

外部脚本目录需要用户另行携带，不能仅靠导出设置复制实际脚本内容。

## 国际化

Windows 另有独立的 WebView2 profile，位置见[用户备份指南](../users/backup.md)。个人设置不写入浏览器缓存，程序更新不覆盖 profile。

面板翻译由 `client/js/i18n.js` 与 `translations.js` 管理。新增静态标签、动态提示和校验信息时同时补齐中英文本。

用户命名、目录路径和表达式代码保持原内容。语言切换应保留编辑草稿、输入选区及撤销历史。

官网的英文版由 `scripts/localize-site.cjs` 和 `assets/i18n/en.json` 从中文页面生成，入口 URL 要按英文页的目录深度改写。当前使用文档为简体中文。

## 添加功能的检查顺序

先确定代码属于面板还是 Host，再实现模块与桥接入口；如涉及设置，则补齐默认值、校验、迁移和备份路径；最后补齐对应用户文档与有实际覆盖价值的回归验证。

完整约定见[架构与维护](https://github.com/MYdesignTool/Ae-ToolKit/blob/main/extension/docs/architecture.md)。
