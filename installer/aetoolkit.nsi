Unicode true

; ============================================================================
;  AE Local Toolkit - NSIS 安装脚本
;  产出：单个 setup.exe（用户双击即运行，原生「许可协议 → 选择路径 → 安装」）。
;  无需管理员权限：仅写入 %APPDATA% 下的用户目录 + 设置 HKCU 注册表。
;  相比 pkg 单文件，NSIS 运行时被广泛信任，几乎不会触发杀软误报。
;
;  构建（需安装 NSIS，免费）：
;    winget install NSIS.NSIS
;    cd installer
;    makensis aetoolkit.nsi
;  产物： installer/dist/aetoolkit-installer.exe
; ============================================================================

!define APPNAME "AE Local Toolkit"
!define VERSION "0.2.4"
!define PUBLISHER "AE Local Toolkit"
!define EXT_ID "AeLocalToolkit"

; 安装目标默认路径（与 Node 版 install.js 的 getTargetDir 一致）。
!define DEFAULT_DIR "$APPDATA\Adobe\CEP\extensions\${EXT_ID}"

; ---------- 基础设置 ----------
Name "${APPNAME} ${VERSION}"
OutFile "dist\aetoolkit-installer.exe"
InstallDir "${DEFAULT_DIR}"
; 记住上次安装路径（写入 HKCU，无需管理员）。
InstallDirRegKey HKCU "Software\${APPNAME}" "InstallDir"

; 用户级安装（写 APPDATA + HKCU），不触发 UAC。
RequestExecutionLevel user

; 压缩（NSIS 自带 LZMA，体积小）。
SetCompressor /SOLID lzma

; 版本信息（资源管理器右键「属性」可见，提升可信度）。
VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "${APPNAME}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "CompanyName" "${PUBLISHER}"
VIAddVersionKey "LegalCopyright" "(c) ${PUBLISHER}"
VIAddVersionKey "FileDescription" "${APPNAME} 安装程序"
VIAddVersionKey "FileVersion" "${VERSION}.0"

; ---------- MUI2 界面 ----------
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"

; 安装程序图标（若仓库有图标可取消注释并放入 installer/）。
; !define MUI_ICON "installer.ico"

!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TEXT "本向导将安装 ${APPNAME} 到您的 After Effects CEP 扩展目录。$\r$\n$\r$\n点击「下一步」继续。"

; 许可协议页（直接复用仓库根目录的 License.md）。
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\License.md"

; 选择安装路径页（默认用户级 CEP 扩展目录）。
!define MUI_DIRECTORYPAGE_TEXT_TOP "选择扩展安装位置。默认即可，除非您清楚 CEP 扩展目录的自定义布局。"
!define MUI_DIRECTORYPAGE_VARIABLE $INSTDIR
!insertmacro MUI_PAGE_DIRECTORY

; 安装过程页。
!insertmacro MUI_PAGE_INSTFILES

; 完成页：给出后续使用提示。
!define MUI_FINISHPAGE_TEXT "安装完成！$\r$\n$\r$\n请重启 After Effects，然后在菜单中打开：$\r$\n窗口 > 扩展 > AE Local Toolkit$\r$\n$\r$\n首次使用请先在 AE 中开启脚本写文件权限：$\r$\n编辑 > 首选项 > 脚本与表达式$\r$\n勾选「允许脚本写入文件和访问网络」，重启 AE 生效。$\r$\n$\r$\n（PlayerDebugMode 已为您启用，使未签名扩展可被加载。）"
!insertmacro MUI_PAGE_FINISH

; 卸载页（标准）。
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "SimpChinese"

; ============================================================================
;  安装段
; ============================================================================
Section "Install" SecInstall
  SetOutPath "$INSTDIR"

  ; 嵌入真实扩展文件（与 build.js 的 DIRS/TOP_FILES 一致）。
  ; 排除本地生成文件：data/settings.json 与 data/organizer-schemes（安装后由面板重建）。
  File /r /x "settings.json" /x "organizer-schemes" "..\CSXS"
  File /r /x "settings.json" /x "organizer-schemes" "..\client"
  File /r /x "settings.json" /x "organizer-schemes" "..\host"
  File /r /x "settings.json" /x "organizer-schemes" "..\data"
  File "..\License.md"
  File "..\README.md"

  ; 写 PlayerDebugMode：覆盖 AE 2020~2025 对应的 CSXS 9~14（HKCU，无需管理员）。
  ${For} $R0 9 14
    WriteRegStr HKCU "Software\Adobe\CSXS.$R0" "PlayerDebugMode" "1"
  ${Next}

  ; 记住安装路径。
  WriteRegStr HKCU "Software\${APPNAME}" "InstallDir" "$INSTDIR"

  ; 写入卸载信息（添加/删除程序里可见）。
  WriteUninstaller "$INSTDIR\uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayName" "${APPNAME}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "Publisher" "${PUBLISHER}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "InstallLocation" "$INSTDIR"

  ; 详情输出（安装日志区可见文件数）。
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  DetailPrint "已安装到: $INSTDIR"
SectionEnd

; ============================================================================
;  卸载段
; ============================================================================
Section "Uninstall"
  ; 删除扩展目录（含卸载程序自身）。
  RMDir /r "$INSTDIR"
  ; 清理「添加/删除程序」注册表项（保留 PlayerDebugMode，避免影响其他未签名扩展）。
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}"
  DeleteRegKey HKCU "Software\${APPNAME}"
SectionEnd
