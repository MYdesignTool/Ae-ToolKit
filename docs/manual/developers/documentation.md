# 维护使用文档

本站使用开源框架 [VitePress](https://vitepress.dev/)，文档以 Markdown 维护，构建后与官网一起部署至 GitHub Pages。

## 本地开发

需要 Node.js 22 或更新版本。在仓库根目录执行：

```sh
npm ci
npm run docs:dev
```

访问命令行显示的地址，路径为 `/Ae-ToolKit/docs/`。开发模式支持修改 Markdown 后即时刷新。

```text
docs/
├── .vitepress/
│   ├── config.mjs          站点导航、两个板块的侧栏与搜索
│   └── theme/              主题与样式
└── manual/
    ├── index.md            两个指南入口
    ├── users/              普通用户文档
    └── developers/         二次开发者文档
```

仓库原有开发记录、审查记录等保留在 `docs/` 其他位置。`srcDir` 仅指向 `docs/manual`，不会将所有内部记录直接发布到文档站。

## 新增一页

1. 在对应板块目录新增 `.md` 文件。
2. 在 `docs/.vitepress/config.mjs` 对应侧栏中添加入口。
3. 文内链接优先使用相对 Markdown 路径，例如 `./installation.md`。
4. 运行 `npm run docs:build`，修正断链后检查桌面和手机视图。

用户文档描述已发布的操作。介绍开发分支的新接口或功能时，说明版本范围，并链接对应开发记录。

## 构建与发布

```sh
npm run docs:build
npm run docs:preview
```

输出目录为 `docs/.vitepress/dist/`。GitHub Pages 工作流会执行 `npm ci` 与文档构建，将产物复制到 `_site/docs/`，和首页、英文首页及公共资源一同发布。

GitHub Pages 项目路径是 `/Ae-ToolKit/`，因此文档配置的 `base` 为 `/Ae-ToolKit/docs/`。迁移域名或仓库名时，应同步更新 `base`、返回官网链接和官网 canonical / alternate 地址。

搜索索引随文档构建生成，浏览时无需外部搜索服务。Markdown 内容预渲染为 HTML，基础阅读与链接在禁用 JavaScript 时也能使用；搜索和主题切换需要 JavaScript。
