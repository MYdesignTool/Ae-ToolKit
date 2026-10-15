# 安装与兼容

最低 AE 2023（23.x），CEP 11 / Chromium 88。AE 2025（25.x）起为 CEP 12 / Chromium 99。面板以 CEP 11 为基线；ExtendScript 仍使用 ES3 兼容语法。清单支持范围不等于所有版本均已实测。

## Windows 安装器

从可信 Release 下载。固定安装到 `C:/Program Files (x86)/Common Files/Adobe/CEP/extensions/AeLocalToolkit`，需要管理员权限。

当前源代码包未经 CEP 签名。开发包需要在组件页勾选“开发安装：允许当前用户加载未签名扩展”，默认不勾选。只写当前用户 CSXS.11 / .12 调试设置。若使用其他管理员账户提权，需要为实际运行 AE 的用户单独设置。

重启 AE，通过“窗口 > 扩展”打开面板。在首选项“脚本与表达式”启用“允许脚本写入文件和访问网络”，用于本地写入。

## 手动安装

复制整个扩展文件夹。Adobe 官方支持系统级和用户级位置：

| 平台 | 系统级 | 用户级 |
| --- | --- | --- |
| Windows | `C:/Program Files (x86)/Common Files/Adobe/CEP/extensions/` | `%APPDATA%/Adobe/CEP/extensions/` |
| macOS | `/Library/Application Support/Adobe/CEP/extensions/` | `~/Library/Application Support/Adobe/CEP/extensions/` |

不要保留多个同 ID 副本。扩展路径不能含 `#`。

未签名开发包：Windows 在 `HKCU/Software/Adobe/CSXS.11`（或 `.12`）创建字符串 `PlayerDebugMode=1`；macOS 执行 `defaults write com.adobe.CSXS.11 PlayerDebugMode 1`（或 `.12`）。签名 CEP 包不需要开发模式。

安装器 Authenticode 签名与 CEP 扩展签名是两回事；前者不替代后者，也不能保证消除系统警告。

## 数据迁移

数据写入 `Folder.userData/AE Local Toolkit/`，不依赖 Program Files 写权限。首次运行从旧目录迁移；切换安装位置前先导出备份，再在新面板导入。

依据：[Adobe CEP Cookbook](https://github.com/Adobe-CEP/CEP-Resources/blob/master/CEP_12.x/Documentation/CEP%2012%20HTML%20Extension%20Cookbook.md)。
