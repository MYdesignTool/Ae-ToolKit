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

当前版本 **v0.2.4**，核心功能已完成。表达式库导入/导出功能计划后续添加。

### 产品方向

AE Local Toolkit 是一个面向 AE 2020 及以上版本的**离线**扩展。V1 聚焦于三个本地优先模块：

- 工程整理器
- 表达式管理器
- 更新日志与设置

扩展在日常工作中应保持安静，仅在重要操作（如覆盖或移除已有表达式）前才请求确认。

### V1 功能范围

#### 工程整理器

预设文件夹：

| 文件夹 | 匹配规则 |
| --- | --- |
| Comp | `CompItem` |
| Image | `JPEG`, `JPG`, `PNG`, `TIFF`, `GIF`, `BMP`, `SWF`, `EXR`, `WEBP` |
| Video | `AVI`, `MP4`, `MOV`, `MPEG2`, `MKV`, `M4V`, `WEBM` |
| Audio | `MP3`, `WAV`, `AIFF`, `AAC`, `FLAC` |
| PSD | `PSD`, `PSB` |
| Live2D | `CAE` |
| 3D | `OBJ`, `FBX`, `GLTF` |
| Solids | `SolidSource` |
| Footage | 未匹配素材的兜底目录 |

V1 行为：

- 自动创建缺失的目标文件夹。
- 先将所有非文件夹项目移到根目录，再分类（注：当前已优化为单遍整理，重挂载次数减半）。
- 分类时跳过文件夹。
- 不重命名素材。
- 不删除素材。
- 整理后清除空文件夹。
- 返回简短的整理摘要。

#### 表达式管理器

V1 行为：

- 将自定义表达式文本应用到所有选中属性。
- 将选中的已保存表达式应用到所有选中属性。
- 移除选中属性上的表达式。
- 覆盖已有表达式前先确认。
- 移除表达式前先确认。
- 跳过不支持的属性。
- 批量操作包裹在 AE 撤销组中。
- 表达式库保持本地存储。

表达式库行为：

- 内置表达式随扩展一起分发。
- 用户表达式存储在本地。
- 用户可创建、编辑、删除、收藏、搜索表达式。
- 不使用任何网络访问。

#### 脚本启动器（v0.2.1）

浏览并运行本地 `.jsx`/`.jsxbin` 脚本，支持收藏、实时搜索、仅显示收藏，自动显示关联 PNG 图标。

### 技术说明

- AEScriptsBox.jsx（rd_ScriptLauncher 2.5）在集成前已从约 495 行重构为约 120 行。
- 启动器的 host 逻辑（`scanScripts`、`launchScript`）最初位于独立模块 `host/modules/launcher.jsx`，后来内联到 `host/index.jsx`，以避免 ExtendScript 中 `$.evalFile` 作用域不确定及 UTF-8 BOM 解析问题。
- evalScript 的路径编码：客户端通过 `encodeURI()` 对 `fsName` 编码（生成纯 ASCII），host 端在 `new File()` 前通过 `decodeURI()` 解码。
- 双击使用直接的 `ondblclick` DOM 属性绑定（而非事件委托），以规避 CEP 事件冒泡的怪异行为。
- 收藏与文件夹路径持久化到扩展的 `data/settings.json`（每设备一份文件，被 git 忽略；`data/settings.default.json` 为云端默认模板）。
- PNG 图标检测在 host 端使用 `File(fsName.replace(...)).exists`；图标路径以 `file:///` URL 形式返回，供 CEP 面板内 `<img>` 标签直接使用。

### 关键改动文件

- `host/index.jsx` — 内联启动器模块，新增 `AELT_selectScriptFolder`、`AELT_scanScripts`、`AELT_launchScript`
- `client/index.html` — 新增脚本标签页与视图
- `client/app.js` — 新增脚本扫描、渲染、搜索、收藏、过滤切换
- `client/styles.css` — 新增脚本列表项、图标显示、收藏过滤切换样式

### 目录结构

```text
AeLocalToolkit/
  CSXS/
    manifest.xml
  client/
    index.html
    styles.css
    app.js
  data/
    changelog.json
    default-expressions.json
    organizer-rules.json        # 云端内置默认整理规则
    organizer-schemes/          # 用户保存的整理方案（git 忽略，存于工作目录 data/）
    settings.default.json       # 云端默认设置模板
    settings.json               # 本地设置（git 忽略，存于工作目录 data/）
  host/
    index.jsx
    modules/
      organizer.jsx
      expressions.jsx
      storage.jsx
  docs/
    install.md
```

### 开发里程碑

| 阶段 | 任务 | 状态 |
| --- | --- | --- |
| 1. 规划 | 确认 AE 2020+ 目标、离线行为、整理规则、表达式范围 | 已完成 |
| 2. 脚手架 | 创建 CEP 目录结构、manifest、面板 UI、host JSX 入口 | 已完成 |
| 3. 整理器 | 移植并清理已有整理逻辑，返回摘要数据 | 已完成 (v0.1.2) |
| 4. 表达式 | 构建批量添加/移除 JSX API 与本地表达式库 UI | 已完成 (v0.1.2) |
| 5. 更新日志 | 新增本地更新日志视图 | 已完成 (v0.1.2) |
| 6. 设置 | 新增安静模式、表达式库导入/导出、规则配置占位 | 已完成 (v0.1.3) |
| 7. 验证 | 在 AE 2020+ 中测试并准备安装说明 | 已完成 (v0.1.3) |
| 8. 脚本启动器 | 从 AEScriptsBox.jsx 移植脚本扫描/启动，新增搜索/收藏 | 已完成 (v0.2.1) |

### 后续开发任务

1. ~~将面板安装到 AE 并验证 CEP 加载。~~（v0.1.3 已测试）
2. ~~在复制的 AE 工程上测试整理功能。~~（v0.1.3 已测试）
3. ~~在变换、特效、文本、形状属性上测试表达式应用/移除。~~（v0.1.3 已测试）
4. ~~为已保存的用户表达式新增编辑流程。~~（v0.1.3 已完成）
5. 新增本地表达式库的导入/导出功能。（推迟）
6. ~~新增安静模式与未来自定义整理规则的设置视图。~~（v0.1.3 已完成）
7. ~~Host 模块拆分。~~（v0.1.3 已完成）
8. ~~脚本启动器模块。~~（v0.2.1 已完成）
9. 待修复：自定义表达式过多时表达式下拉选择框过长。（待办）

> 完整更新日志详见面板内（点击顶栏版本号）或 `data/changelog.json`。

## 许可证

本项目采用 **[GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.html)**。任何使用、修改或分发本项目代码的衍生作品，必须同样以 GPLv3 开源，并保留原始版权声明。