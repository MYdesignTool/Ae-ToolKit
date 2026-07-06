# 安装说明
# Install Notes

This project is a CEP extension scaffold for After Effects 2020+.

## Development Install

1. Copy the `AeLocalToolkit` folder to the CEP extensions directory.
2. Enable unsigned CEP extensions for development.
3. Restart After Effects.
4. Open the panel from `Window > Extensions > AE Local Toolkit`.

## Windows CEP Extension Directory

```text
C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\
```

For per-user development installs, this directory is commonly used:

```text
%APPDATA%\Adobe\CEP\extensions\
```

## Development Mode

Unsigned CEP panels usually require PlayerDebugMode during local development.

Common Windows registry path:

```text
HKEY_CURRENT_USER\Software\Adobe\CSXS.9
```

Create or set this string value:

```text
PlayerDebugMode = 1
```

Newer AE versions may use a newer `CSXS.x` key. If the panel does not appear, check the matching CSXS version for that AE install.

## Offline Behavior

V1 stores all data locally and does not call any network API.

---

## 说明

> 本文档为安装指南，中英文对照版本。

### 安装要点

- 将 AeLocalToolkit/ 文件夹复制到 CEP 扩展目录即可完成安装
- Windows 系统目录：C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\
- 用户级开发目录：%APPDATA%\Adobe\CEP\extensions\
- 开发调试需开启 PlayerDebugMode=1（注册表 HKCU\Software\Adobe\CSXS.9）
- V1 版本所有数据本地存储，不依赖任何网络 API