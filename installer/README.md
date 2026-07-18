# AE Local Toolkit 安装器

将扩展打包为**单个 Windows 安装程序（setup.exe）**，用户双击即可完成安装（无需手动复制文件、无需管理员权限、无需任何外部依赖）。

## 工作原理

- `aetoolkit.nsi` 是 NSIS 安装脚本。NSIS 在**编译期**就把仓库中的扩展文件树（`CSXS/`、`client/`、`host/`、`data/` 及 `License.md`/`README.md`）内联进 exe，因此产出的 `aetoolkit-installer.exe` 是真正独立的单文件，运行时不需要 Node、不需要任何外部文件。
- 安装流程为原生 Windows 向导：「许可协议 → 选择安装路径 → 安装 → 完成提示」。
- 安装动作：把文件写到用户级 CEP 扩展目录（`%APPDATA%\Adobe\CEP\extensions\AeLocalToolkit`），并写入 `HKCU\Software\Adobe\CSXS.9~14\PlayerDebugMode=1`（覆盖 AE 2020–2025，启用未签名扩展加载）。**均不需要管理员权限**。
- 附带 `uninstall.exe`，可在「添加/删除程序」中卸载。

> 选择 NSIS 而非 pkg 单文件，是因为 pkg 把 Node 运行时压进 exe 会被杀软启发式误报为 `Trojan/Agent`；NSIS 运行时被广泛信任，几乎不会误报。

## 构建

直接双击 `build-installer.cmd` 即可（推荐）。脚本会先检测环境：若本机未安装 NSIS，会自动通过 `winget` 安装（无 winget 时回退到官方安装包静默安装），然后编译出单文件安装器。

```bash
build-installer.cmd
```

如需手动构建（已装 NSIS）：

```bash
makensis aetoolkit.nsi
```

产物：`dist\aetoolkit-installer.exe`（单个文件，可直接分发）。

## 使用（最终用户）

### Windows

1. 下载 `aetoolkit-installer.exe`，双击运行。
2. 阅读许可协议，点击「下一步」。
3. 确认安装路径（默认已填好用户级 CEP 目录，可点击「浏览…」自定义），点击「安装」。
4. 安装完成后按提示重启 After Effects，在 `窗口 > 扩展 > AE Local Toolkit` 打开。
5. 首次使用在 AE 中开启：`编辑 > 首选项 > 脚本与表达式 > 允许脚本写入文件和访问网络`，重启 AE 生效。

> 因 exe 未签名，Windows SmartScreen 可能提示「未知发布者」。这是警告不是病毒拦截，点「更多信息 → 仍要运行」即可。

### macOS（手动安装，无安装器）

macOS 不提供安装器，请手动复制文件：

1. 下载并解压扩展文件，得到 `AeLocalToolkit/` 文件夹。
2. 移动到用户级 CEP 扩展目录：`~/Library/Application Support/Adobe/CEP/extensions/`
   （系统级：`/Library/Application Support/Adobe/CEP/extensions/`，需管理员权限）。
3. 若为未签名扩展，还需开启调试模式（终端执行，对应 AE 2020~2025 的 CSXS.9~14）：
   ```bash
   for n in 9 10 11 12 13 14; do defaults write com.adobe.CSXS.$n PlayerDebugMode -bool true; done
   ```
4. 重启 After Effects，在 `窗口 > 扩展 > AeLocalToolkit` 打开。
5. 首次使用在 AE 中开启：`编辑 > 首选项 > 脚本与表达式 > 允许脚本写入文件和访问网络`，重启 AE 生效。

## 代码签名（可选，消除 SmartScreen 警告）

未签名的 exe 会被系统提示「未知发布者」。购买 Authenticode 代码签名证书后，用 `sign-win.ps1` 签名即可消除：

```powershell
.\sign-win.ps1 -CertPath "my.pfx" -Password "cert-password"
```

签名后建议在 VirusTotal 提交建立信誉。

## 产物说明

- `dist\aetoolkit-installer.exe`：单文件安装器，分发给用户双击安装。
- `dist\aetoolkit-extension.zip`：干净的扩展包（仅 `CSXS/`、`client/`、`host/`、`data/`、`License.md`、`README.md`，已排除 `installer/`、`docs/`、`data/settings.json`、`data/organizer-schemes`），供手动安装用户使用。
- 以上均位于 `installer/dist/`，已被 `.gitignore` 忽略；`installer/` 源文件纳入版本控制。
- `data/settings.json` 等本地生成文件由面板首次运行时自动创建。
