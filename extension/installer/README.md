# Windows 构建与更新验证

显式安装 NSIS 后执行 `build-installer.cmd` 或 `./build.ps1`。脚本不会下载或安装依赖。版本来自 `../data/changelog.json`，必须与 manifest 一致。

产物在 dist/：`aetoolkit-installer.exe` 和 `aetoolkit-extension.zip`。只打包 CSXS、client、host、许可证、README 和四个默认 JSON；不包含便携用户数据、迁移源、备份、个人脚本或开发文件。输出 SHA256，不上传、不运行安装器。

安装器固定使用系统级 CEP 目录：`C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\AeLocalToolkit`。直接运行即可覆盖更新，更新前备份完整 data；个人配置不在覆盖清单内。优先迁移旧用户级位置的数据，兼容另一系统级位置和注册表记录的位置，确认扩展 ID 后复制数据并停用旧清单，不调用旧版卸载器。卸载保留 data、backups 和扩展根目录额外的个人脚本目录。

`node tests/installer.cjs` 会将同一份 NSIS 源码编译为隔离测试包，只在 `.artifacts/upgrade-随机值/` 下执行安装、更新和卸载，不写注册表、不接触真实 CEP 目录。检查旧数据迁移、清单停用、连续覆盖更新、用户数据逐字节保留、程序文件替换及卸载保留数据。

`TEST_ROOT` 是编译期测试入口，正式构建不设置它。正式安装器请求管理员权限以写入系统目录、迁移旧副本；仅对扩展内 data 子目录授予安装用户的修改权限，程序代码不开放修改。隔离测试也检查 data ACL，仍不接触真实 CEP 目录。

开发模式为组件页默认不选的选项，仅影响当前用户 CSXS.11 / .12。`sign-win.ps1` 用于安装器 Authenticode 签名，与 CEP 签名不同。
