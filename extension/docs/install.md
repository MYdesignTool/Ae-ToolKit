# 安装与兼容

最低 AE 2023（23.x），CEP 11 / Chromium 88。AE 2025（25.x）起为 CEP 12 / Chromium 99。清单支持范围不等于所有版本均已实测；ExtendScript 保持 ES3 语法。

## Windows 安装器与更新

安装到可写的 `%APPDATA%/Adobe/CEP/extensions/AeLocalToolkit`。数据统一保存在这个文件夹的 `data/user-data.json`，不再写到扩展外的用户配置目录。

更新前关闭 AE，直接运行新版安装器，不要先卸载。安装器会：

1. 检查旧版标准系统目录及注册表记录的旧安装位置，确认清单属于本扩展。若新位置尚无个人数据，复制旧 `data`，原文件保留。
2. 将当前完整 `data` 复制到扩展内 `backups/before-版本-时间/`。备份失败则停止更新。
3. 覆盖程序文件和四个内置默认 JSON，保留 `user-data.json`、旧设置、方案、个人脚本和其他本地文件。
4. 将旧副本清单重命名停用，避免同 ID 扩展冲突，旧目录及数据保留。后续更新直接覆盖用户级目录。

安装器仍请求管理员权限，用于兼容旧系统级安装及停用旧副本。UAC 应使用实际运行 AE 的账户提权；若借用另一管理员账户，请改为手动安装到实际用户目录，避免安装进管理员的用户目录。

当前开发包未签名。组件页可选择“开发安装：允许当前用户加载未签名扩展”，默认不选；仅写当前用户 CSXS.11 / .12 的 PlayerDebugMode。安装器签名不等于 CEP 签名。

重启 AE，通过“窗口 > 扩展”打开面板。在首选项“脚本与表达式”启用“允许脚本写入文件和访问网络”。

## 复制到另一台电脑或手动更新

关闭 AE 后复制整个 `AeLocalToolkit` 文件夹，确保包含 `data/user-data.json`。推荐放在新电脑的用户级 CEP 目录：

| 平台 | 推荐的用户级目录 |
| --- | --- |
| Windows | `%APPDATA%/Adobe/CEP/extensions/` |
| macOS | `~/Library/Application Support/Adobe/CEP/extensions/` |

手动升级时将干净 ZIP 的内容合并覆盖到现有文件夹，保留原数据，避免先删除旧文件夹。新安装包不包含任何个人数据。复制到系统只读目录会导致无法保存，面板会明确报错，不会偷偷改用另一个数据位置。

可将脚本放进扩展内的 `scripts/` 后在设置中选择；这些脚本及收藏存相对路径，目录整体移动后仍可使用。外部脚本目录需要另行复制，路径改变后重新选择。脚本目录内的 `image` 文件夹一并携带。

不要保留多个启用的同 ID 副本；扩展路径不能含 `#`。未签名包仍需在新电脑启用对应 CEP 开发模式。卸载删除程序目录 CSXS、client、host，保留 data、backups 和扩展根目录额外的个人脚本目录。

## 旧数据整合

没有 `user-data.json` 时，首次运行整合旧 `data/settings.json`、`data/organizer-schemes/` 和上一版 `Folder.userData/AE Local Toolkit/`。上一版用户目录的设置及同 ID 方案优先，其他方案合并；所有源文件保留。已有便携数据时，不再读取其他位置，避免另一台电脑的旧配置覆盖随文件夹带来的数据。

依据：[Adobe CEP Cookbook 的扩展目录说明](https://github.com/Adobe-CEP/CEP-Resources/blob/master/CEP_12.x/Documentation/CEP%2012%20HTML%20Extension%20Cookbook.md#extension-folders)。
