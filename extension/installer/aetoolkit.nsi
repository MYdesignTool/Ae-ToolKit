Unicode true
!define APPNAME "AE Local Toolkit"
!ifndef VERSION
  !error "Build via build-installer.cmd to read VERSION from changelog.json"
!endif
!define EXT_ID "AeLocalToolkit"
!define DEFAULT_DIR "$COMMONFILES32\Adobe\CEP\extensions\${EXT_ID}"
Name "${APPNAME} ${VERSION}"
OutFile "dist\aetoolkit-installer.exe"
InstallDir "${DEFAULT_DIR}"
RequestExecutionLevel admin
SetCompressor /SOLID lzma
VIProductVersion "${VERSION}.0"
VIAddVersionKey "LegalCopyright" "GPLv3 contributors"
VIAddVersionKey "ProductName" "${APPNAME}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "FileDescription" "${APPNAME} 安装程序"
VIAddVersionKey "FileVersion" "${VERSION}.0"
!include "MUI2.nsh"
!include "LogicLib.nsh"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TEXT "安装 ${APPNAME}（AE 2023 及更新版本）。$\r$\n$\r$\n程序安装到系统 CEP 目录，设置保存在用户数据目录。$\r$\n$\r$\n未签名开发包需要在下一步选择启用开发模式。"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\License.md"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_TEXT "请重启 After Effects，在「窗口 > 扩展」打开 AE Local Toolkit。$\r$\n$\r$\n在 AE 首选项中启用「允许脚本写入文件和访问网络」。工具箱本身离线运行，运行第三方脚本前请核对来源。$\r$\n$\r$\n未签名开发包需要启用相应 CEP 的 PlayerDebugMode。签名 CEP 包无需开发模式。"
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"
Section "扩展本体（必需）" SecMain
  SectionIn RO
  StrCpy $INSTDIR "${DEFAULT_DIR}"
  SetOutPath "$INSTDIR"
  File /r /x ".gitkeep" "..\CSXS"
  File /r /x ".gitkeep" "..\client"
  File /r "..\host"
  File /r /x "settings.json" /x "organizer-schemes" "..\data"
  File "..\License.md"
  File "..\README.md"
  WriteUninstaller "$INSTDIR\uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayName" "${APPNAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "UninstallString" '$\"$INSTDIR\uninstall.exe$\"'
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "Publisher" "${APPNAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "InstallLocation" "$INSTDIR"
SectionEnd
Section /o "开发安装：允许当前用户加载未签名扩展" SecDebug
  SetRegView 64
  WriteRegStr HKCU "Software\Adobe\CSXS.11" "PlayerDebugMode" "1"
  WriteRegStr HKCU "Software\Adobe\CSXS.12" "PlayerDebugMode" "1"
SectionEnd
Section "Uninstall"
  StrCmp $INSTDIR "${DEFAULT_DIR}" 0 unsafe
  IfFileExists "$INSTDIR\CSXS\manifest.xml" 0 unsafe
  RMDir /r "$INSTDIR\CSXS"
  RMDir /r "$INSTDIR\client"
  RMDir /r "$INSTDIR\host"
  ; Retain legacy data/ until it has been migrated by the panel.
  Delete "$INSTDIR\README.md"
  Delete "$INSTDIR\License.md"
  Delete "$INSTDIR\uninstall.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}"
  DeleteRegKey HKLM "Software\${APPNAME}"
  Goto done
unsafe:
  MessageBox MB_ICONSTOP "卸载路径不符合预期，已停止删除。请检查安装目录。"
  Abort
done:
SectionEnd
