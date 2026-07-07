# AE Local Toolkit

离线版 After Effects 2020+ 扩展 —— 项目整理 · 表达式管理 · 脚本启动 · 完全离线运行

## 主要功能

### 项目整理器
按预设规则（图片、视频、音频、PSD、3D 等）自动分类素材，支持自定义多方案、嵌套文件夹，整理后清除空文件夹。

### 表达式管理器
批量应用或移除表达式，内置示例库，支持用户自定义表达式（收藏、搜索、编辑），操作前确认覆盖或删除。

### 脚本启动器
浏览并运行本地 `.jsx`/`.jsxbin` 脚本，支持收藏、实时搜索、仅显示收藏，自动显示关联 PNG 图标。

### 更新日志与设置
点击版本号查看本地更新历史，支持静默模式减少提示。

## 安装

将下载的所有文件解压到名为`AeLocalToolkit/` 的文件夹，然后将 `AeLocalToolkit/` 文件夹放到 CEP 扩展目录：

- Windows: `C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\`
- macOS: `/Library/Application Support/Adobe/CEP/extensions/`

启动 After Effects 2020 或更高版本，在 `窗口 > 扩展 > AeLocalToolkit` 中打开面板。

> **重要**：本工具会在本地写入文件（整理素材、保存方案与自定义表达式），因此需要开启 AE 的脚本写权限。请先进入对应菜单，勾选脚本写文件选项，再重启 After Effects 使设置生效：
> - 中文：`编辑 > 首选项 > 脚本与表达式`，勾选 **允许脚本写入文件和访问网络**
> - English: `Edit > Preferences > Scripting & Expressions`, check **Allow Scripts to Write Files and Access Network**
>
> （本工具完全离线运行，不访问任何网络，勾选该选项仅用于开放本地文件写入。）

## 开发状态

当前版本 **v0.2.1**，核心功能已完成。表达式库导入/导出功能计划后续添加。

## 许可证

本项目采用 **[GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.html)**。任何使用、修改或分发本项目代码的衍生作品，必须同样以 GPLv3 开源，并保留原始版权声明。