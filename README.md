# MYpage

一个基于 **GitHub Pages** 搭建的静态网站。

## 项目结构

```
.
├── index.html            # 网站入口页面
├── assets/
│   ├── css/
│   │   └── style.css     # 样式文件
│   └── js/
│       └── main.js       # 脚本文件
└── README.md
```

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
