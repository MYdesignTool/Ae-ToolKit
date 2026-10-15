# Windows 构建

显式安装 NSIS 后执行 `build-installer.cmd` 或 `./build.ps1`。脚本不会下载或静默安装依赖。版本来自 `../data/changelog.json`，必须与 manifest 一致。

产物在 dist/：安装器 `aetoolkit-installer.exe` 和干净扩展包 `aetoolkit-extension.zip`。ZIP 排除本地设置、用户方案和开发文件。脚本输出 SHA256，不会上传、发布或执行安装器。

NSIS 编译通过 /DVERSION 传入版本，不应直接无参调用 makensis。安装目录固定；卸载校验目录和清单，只删除已知程序路径，保留用户目录及遗留 data/。

开发模式为组件页默认不选的显式选项，仅影响当前用户 CSXS.11 / .12，不再批量写 HKLM 的 CSXS.9～14。当前源码包需要 CEP 开发模式或单独的 CEP 签名。

`sign-win.ps1` 用于安装器 Authenticode 签名，与 CEP 签名不同；签名不保证 SmartScreen 必然消失。
