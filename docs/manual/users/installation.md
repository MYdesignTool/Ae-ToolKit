# 安装与更新

## 环境与安装包

最低目标为 After Effects 2023。两平台使用同一套界面和业务逻辑，安装位置和打开方式不同：

| 平台 | 正式发布附件 | 安装位置与打开方式 |
| --- | --- | --- |
| Windows x64 | `aetoolkit-v<版本>-windows-x64-installer.exe` | 所选 AE 的 `Support Files/Plug-ins/AeltToolkitWebView2/`；「窗口 → AE Local Toolkit (WebView2)」 |
| macOS | `aetoolkit-v<版本>-macos-cep.zip` | `/Library/Application Support/Adobe/CEP/extensions/AeLocalToolkit/`；「窗口 → 扩展 → AE Local Toolkit」 |

从 [GitHub Releases](https://github.com/MYdesignTool/Ae-ToolKit/releases) 下载对应平台附件，可使用同页的 `SHA256SUMS.txt` 核对完整性。安装后在 AE「首选项 → 脚本与表达式」中启用「允许脚本写入文件和访问网络」。兼容范围不代表每个 AE 版本都已完成实测。

## Windows 原生安装

1. 保存工程并退出 AE，再运行 Windows x64 安装器。
2. 完成管理员授权，在列表中选择要安装的 AE 2023+。默认选中发现的最高版本；多版本 AE 需分别运行安装器安装。
3. 如果未列出目标 AE，选择「自定义路径」，指定包含 `AfterFX.exe` 的 `Support Files` 目录。
4. 等待安装完成，重启 AE，从「窗口 → AE Local Toolkit (WebView2)」打开。
5. 按上方说明允许脚本写入文件和访问网络。

正式 Windows 版从 0.5.1 起使用 AEGP + WebView2，不需要设置 CEP 的 `PlayerDebugMode`。安装器遇到开发链接或其他产品目录时会停止，避免覆盖错误目标。

当前程序默认未签名。若系统提示“Windows 已保护你的电脑”，先确认安装包来自项目 Releases；确认来源后可通过“更多信息 → 仍要运行”继续。

### WebView2 Runtime

安装器使用系统共享的微软 Evergreen WebView2 Runtime。已安装 Runtime 时不联网；缺失时下载微软 Bootstrapper，验证微软签名后安装，并重新检测结果。下载、签名或安装失败会在覆盖工具箱程序前停止。

缺少 Runtime 的首次安装需要联网；工具箱日常功能在本地运行。无需安装完整 Edge，也不会为每个 AE 目录复制一套 Runtime。卸载工具箱不会删除共享 Runtime。

### 原生版直接升级

保存工程、退出 AE，运行新版安装器并选择原来的 AE 或同一 `Support Files` 路径即可升级，无需先卸载。

更新前备份完整 `extension/data`，备份失败则停止。只更新程序和内置默认数据，保留个人设置、表达式、整理方案与脚本；首次安装且没有原生个人数据时，会备份并迁移匹配身份的旧 CEP 数据，保留旧目录及脚本。已有原生个人数据优先，不会被旧 CEP 数据覆盖。

AEX 加载中不能直接覆盖后重载，因此更换原生插件前必须退出 AE。

## macOS CEP 安装与更新

1. 解压 macOS CEP ZIP，将整个 `AeLocalToolkit/` 放到 `/Library/Application Support/Adobe/CEP/extensions/`。
2. 确保其中的 `data` 对实际运行 AE 的用户可写。程序目录本身无需开放写权限。
3. 对未签名 CEP 配置对应版本的开发模式，重启 AE，从「窗口 → 扩展」打开面板。
4. 在 AE 首选项中允许脚本写入文件和访问网络。

AE 2023 / 2024 使用 CSXS.11，AE 2025 起使用 CSXS.12。根据实际宿主选择对应命令：

```sh
# AE 2023 / 2024
defaults write com.adobe.CSXS.11 PlayerDebugMode -bool true
# AE 2025 起
defaults write com.adobe.CSXS.12 PlayerDebugMode -bool true
```

手动升级时合并覆盖程序、保留原 `data`，不要先删除整个扩展。避免同时启用多个相同 CEP ID 的副本，扩展路径不要包含 `#`。旧版 Windows CEP 的安装流程应查看对应历史 Release 的说明。

## 卸载与回退

Windows 卸载按安装清单及哈希删除程序，保留个人文件、`data`、`backups`、产品身份及当前用户缓存；不会删除共享 Runtime，也不会修改旧 CEP。原生版和保留的 CEP 各自保存数据，可通过 JSON 备份显式迁移。

换机和恢复前先阅读[数据与备份](./backup.md)。
