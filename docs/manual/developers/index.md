# 二次开发者指南

Ae-ToolKit 的扩展本体位于 `extension/`。Windows 由 `native/` 中的 AEGP + WebView2 宿主加载，macOS 使用 CEP；共享界面使用原生 JavaScript，共享业务使用 ExtendScript。

## 获取代码

```sh
git clone https://github.com/MYdesignTool/Ae-ToolKit.git
cd Ae-ToolKit
node --test tests/*.test.cjs
```

扩展本体无需前端打包。文档站使用 VitePress，需要 Node.js 22 或更新版本及 npm；浏览器交互验证另需 Playwright 和 Microsoft Edge。

## 推荐阅读顺序

1. [架构与加载流程](./architecture.md)：理解面板、Host 和默认数据的边界。
2. [Host 桥接接口](./bridge.md)：沿用现有入口、参数编码和回调协议。
3. [数据与扩展约定](./data.md)：保存个人数据、添加功能并保持兼容。
4. [测试与构建](./testing.md)：运行回归，验证真实 AE 宿主，构建安装器。
5. [维护使用文档](./documentation.md)：预览、修改和部署本站。

## 开发版本与正式版本

`main` 中可能包含尚未发布的功能。对已发布安装包做兼容修改时，先切换到对应 Release 标签，再核对该版本源码。当前正式版为 0.5.1，平台构建与发布约定见[自动构建说明](https://github.com/MYdesignTool/Ae-ToolKit/blob/main/docs/release-automation.md)。

项目采用 [GPL v3.0](https://github.com/MYdesignTool/Ae-ToolKit/blob/main/License.md)。复用和分发时请阅读许可证，并保留第三方依赖的许可说明。
