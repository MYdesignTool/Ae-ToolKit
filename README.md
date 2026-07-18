# MYpage

一个基于 **GitHub Pages** 搭建的静态网站。

## 项目结构

```
.
├── index.html                      # 网站入口页面（Ae-ToolKit 发布页）
├── assets/
│   ├── css/
│   │   ├── style.css               # 主样式（液态玻璃 / 响应式）
│   │   └── theme-light.css         # 亮色主题
│   ├── img/
│   │   ├── logo.svg                # 站点 Logo
│   │   ├── feature-organizer.png   # 功能截图：项目整理器
│   │   ├── feature-expression.png  # 功能截图：表达式管理器
│   │   └── feature-script.svg      # 功能截图：脚本启动器
│   └── js/
│       ├── main.js                 # 交互脚本（含自动获取最新版本号）
│       ├── effects.js              # 背景动效（矩阵 / 光标）
│       └── code-showcase.js        # 代码展示面板
├── .github/
│   └── workflows/
│       └── jekyll-gh-pages.yml     # 自动构建并部署到 GitHub Pages
└── README.md
```

## 版本号自动更新

发布页顶部的版本徽标（如 `v0.2.3`）**无需手动维护**：`assets/js/main.js` 会在页面加载时调用
GitHub 公开 API 拉取 `MYdesignTool/Ae-ToolKit` 的最新 Release `tag_name` 并自动填充徽标与下载按钮链接。

- 成功时：显示线上最新版本号，下载按钮指向对应 Release。
- 失败时（如 API 限流 / 网络异常）：保留代码中的兜底值，页面照常显示。

> 因此每次发版后，只需在 GitHub 创建新 Release，发布页会自动同步，无需改代码。

## 本地预览

直接用浏览器打开 `index.html` 即可，或启动一个简单的本地服务器：

```bash
# Python
python -m http.server 8000

# Node
npx serve .
```

然后访问 `http://localhost:8000`。

## 部署到 GitHub Pages

1. 将代码推送到 GitHub 仓库（默认分支，如 `main`）。
2. 在仓库 **Settings → Pages** 中，选择：
   - Source: `Deploy from a branch`
   - Branch: `main` / `/(root)`（根目录发布）
3. 保存后等待几分钟，访问 `https://<用户名>.github.io/<仓库名>/` 即可。

> 如需完全跳过 Jekyll 构建（例如使用了以下划线 `_` 开头的目录），可在根目录添加一个空的 `.nojekyll` 文件。
