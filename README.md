# Ae-ToolKit

After Effects 离线扩展工具集 —— 项目整理 · 表达式管理 · 脚本启动 · 完全离线运行

本仓库为 **Ae-ToolKit 项目主仓库**，同时承载两部分内容：

| 目录 | 内容 | 说明 |
| --- | --- | --- |
| **仓库根目录** | GitHub Pages 发布页 | `index.html` + `assets/`，静态宣传/下载页，由 GitHub Actions 自动部署 |
| [`extension/`](extension/README.md) | AE 扩展本体（产品） | CEP 扩展：`client/`（面板 UI）+ `host/`（ExtendScript 后端）+ `CSXS/`（清单）+ `data/`（配置） |

## 快速入口

- **发布页源码**：`index.html`（根目录），版本徽标由 `assets/js/main.js` 运行时从 GitHub Release API 自动获取，无需手动维护。
- **扩展安装说明**：见 [`extension/README.md`](extension/README.md)（含一键安装器与手动安装两种方式）。
- **扩展构建**：`extension/installer/build-installer.cmd` 一键重建安装器（`aetoolkit-installer.exe`）与干净扩展包（`aetoolkit-extension.zip`）。
- **Release**：安装包与扩展包通过 GitHub Release 分发，发布页自动同步版本号。

## 目录结构

```text
Ae-ToolKit/                    # 本仓库
  index.html                   # 发布页入口（GitHub Pages 根目录发布）
  assets/                      # 发布页静态资源
  .github/workflows/           # GitHub Pages 部署工作流
  extension/                   # AE 扩展本体
    CSXS/                      # CEP 清单
    client/                    # 面板前端 UI
    host/                      # ExtendScript 后端
    data/                      # JSON 配置（含默认规则/表达式）
    docs/                      # 架构与安装文档
    installer/                 # NSIS 安装器构建
    README.md                  # 扩展详细说明
```

## 当前状态

当前版本 **v0.2.5**。详见 [`extension/README.md`](extension/README.md) 与面板内更新日志。

## 许可证

本项目采用 **[GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.html)**。任何使用、修改或分发本项目代码的衍生作品，必须同样以 GPLv3 开源，并保留原始版权声明。
