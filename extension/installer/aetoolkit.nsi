Unicode true
!define APPNAME "AE Local Toolkit"
!ifndef VERSION
  !error "Build via build-installer.cmd to read VERSION from changelog.json"
!endif
!define EXT_ID "AeLocalToolkit"
; Test builds only touch the caller's sandbox and never write registry keys.
!ifdef TEST_ROOT
  !define DEFAULT_DIR "${TEST_ROOT}\installed\${EXT_ID}"
  !define LEGACYUSER_DIR "${TEST_ROOT}\legacy-user\${EXT_ID}"
  !define LEGACY32_DIR "${TEST_ROOT}\legacy32\${EXT_ID}"
  !define LEGACY64_DIR "${TEST_ROOT}\legacy64\${EXT_ID}"
  OutFile "${TEST_ROOT}\setup.exe"
  RequestExecutionLevel user
!else
  !define DEFAULT_DIR "$COMMONFILES32\Adobe\CEP\extensions\${EXT_ID}"
  !define LEGACYUSER_DIR "$APPDATA\Adobe\CEP\extensions\${EXT_ID}"
  !define LEGACY32_DIR "$COMMONFILES32\Adobe\CEP\extensions\${EXT_ID}"
  !define LEGACY64_DIR "$COMMONFILES64\Adobe\CEP\extensions\${EXT_ID}"
  OutFile "dist\aetoolkit-installer.exe"
  ; Install program files system-wide; only data/ is writable without elevation.
  RequestExecutionLevel admin
!endif
Name "${APPNAME} ${VERSION}"
InstallDir "${DEFAULT_DIR}"
SetCompressor /SOLID lzma
VIProductVersion "${VERSION}.0"
VIAddVersionKey "LegalCopyright" "GPLv3 contributors"
VIAddVersionKey "ProductName" "${APPNAME}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "FileDescription" "${APPNAME} 安装程序"
VIAddVersionKey "FileVersion" "${VERSION}.0"
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "StrFunc.nsh"
${StrStr}
Var LegacyPath
Var LegacyValid
Var RegisteredLegacy
Var UpgradeStamp
Var MigrationStage
Var PreviousData
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TEXT "安装或更新 ${APPNAME}（AE 2023 及更新版本）。$\r$\n$\r$\n更新前请关闭 After Effects，无需卸载旧版。程序安装到系统级 CEP 目录，需要管理员授权。设置和预设随扩展文件夹保存，旧用户级数据自动迁移。$\r$\n$\r$\n更新会先备份数据，再覆盖程序文件。未签名开发包需要在组件页选择开发模式。"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\License.md"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_TEXT "请重启 After Effects，在「窗口 > 扩展」打开 AE Local Toolkit。$\r$\n$\r$\n在 AE 首选项中启用「允许脚本写入文件和访问网络」。$\r$\n$\r$\n设置、收藏、表达式及整理方案统一保存在扩展内 data\user-data.json。换电脑可复制整个文件夹。"
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"

Function .onInit
  SetShellVarContext current
  StrCpy $INSTDIR "${DEFAULT_DIR}"
  !ifndef TEST_ROOT
    ReadRegStr $RegisteredLegacy HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "InstallLocation"
    ${If} $RegisteredLegacy == ""
      ReadRegStr $RegisteredLegacy HKLM "Software\${APPNAME}" "InstallDir"
    ${EndIf}
  !endif
  ${GetTime} "" "L" $0 $1 $2 $3 $4 $5 $6
  System::Call 'kernel32::GetTickCount() i.r7'
  StrCpy $UpgradeStamp "${VERSION}-$2$1$0-$4$5$6-$7"
FunctionEnd

; Only migrate a directory whose manifest identifies this extension.
Function CheckLegacy
  StrCpy $LegacyValid 0
  StrCmp $LegacyPath "" done
  GetFullPathName $LegacyPath "$LegacyPath"
  StrCmp $LegacyPath $INSTDIR done
  ClearErrors
  FileOpen $R0 "$LegacyPath\CSXS\manifest.xml" r
  IfErrors done
loop:
  ClearErrors
  FileRead $R0 $R1
  IfErrors close
  ${StrStr} $R2 $R1 'ExtensionBundleId="com.local.aetoolkit"'
  StrCmp $R2 "" loop
  StrCpy $LegacyValid 1
close:
  FileClose $R0
done:
FunctionEnd

Function PreserveLegacyData
  Call CheckLegacy
  StrCmp $LegacyValid 1 0 done
  ; Existing portable/local data is authoritative and is never overwritten.
  IfFileExists "$INSTDIR\data\user-data.json" done
  IfFileExists "$INSTDIR\data\user-data.json.bak" done
  IfFileExists "$INSTDIR\data\settings.json" done
  IfFileExists "$INSTDIR\data\settings.json.bak" done
  IfFileExists "$INSTDIR\data\organizer-schemes\*.json" done
  IfFileExists "$INSTDIR\data\organizer-schemes\*.json.bak" done
  IfFileExists "$LegacyPath\data\*.*" 0 done
  ; Stage the entire legacy data folder before making it authoritative.
  StrCpy $MigrationStage "$INSTDIR\migration-$UpgradeStamp"
  StrCpy $PreviousData ""
  CreateDirectory "$MigrationStage"
  ClearErrors
  CopyFiles /SILENT "$LegacyPath\data\*.*" "$MigrationStage"
  IfErrors failed
  IfFileExists "$INSTDIR\data\*.*" 0 commit
  StrCpy $PreviousData "$INSTDIR\backups\before-migration-$UpgradeStamp"
  CreateDirectory "$INSTDIR\backups"
  ClearErrors
  Rename "$INSTDIR\data" "$PreviousData"
  IfErrors failed
commit:
  ClearErrors
  Rename "$MigrationStage" "$INSTDIR\data"
  IfErrors 0 done
  StrCmp $PreviousData "" failed
  Rename "$PreviousData" "$INSTDIR\data"
failed:
  MessageBox MB_ICONSTOP "旧版数据复制失败，已停止更新。旧文件保留在 $LegacyPath。" /SD IDOK
  SetErrorLevel 1
  Abort
done:
FunctionEnd

Function DisableLegacy
  Call CheckLegacy
  StrCmp $LegacyValid 1 0 done
  ClearErrors
  Rename "$LegacyPath\CSXS\manifest.xml" "$LegacyPath\CSXS\manifest.xml.before-$UpgradeStamp"
  IfErrors 0 done
  MessageBox MB_ICONSTOP "新版文件已写入，但旧版面板无法停用。请关闭 AE 后重试。旧数据仍保留在 $LegacyPath。" /SD IDOK
  SetErrorLevel 1
  Abort
done:
FunctionEnd

Function PrepareStorage
  ; Grant only the portable data directory; executable code stays protected.
  ClearErrors
  CreateDirectory "$INSTDIR\data"
  IfErrors failed
  ; Use the elevated account's full DOMAIN\user name, retaining normal-token write access.
  System::Call 'secur32::GetUserNameExW(i 2, w .r0, *i ${NSIS_MAX_STRLEN}) i .r1'
  StrCmp $1 0 failed
  ExecWait '"$SYSDIR\icacls.exe" "$INSTDIR\data" /grant "$0:(OI)(CI)M" /Q' $1
  IfErrors failed
  StrCmp $1 0 done
failed:
  MessageBox MB_ICONSTOP "data 目录的写入权限设置失败，已停止更新。请以管理员身份重新运行安装器。旧数据与备份仍然保留。" /SD IDOK
  SetErrorLevel 1
  Abort
done:
FunctionEnd

Section "扩展本体（安装 / 保留数据更新）" SecMain
  SectionIn RO
  StrCpy $LegacyPath "${LEGACYUSER_DIR}"
  Call PreserveLegacyData
  StrCpy $LegacyPath "${LEGACY32_DIR}"
  Call PreserveLegacyData
  StrCpy $LegacyPath "${LEGACY64_DIR}"
  Call PreserveLegacyData
  StrCpy $LegacyPath $RegisteredLegacy
  Call PreserveLegacyData
  ; A persistent snapshot is made before any shipped file is overwritten.
  IfFileExists "$INSTDIR\data\*.*" 0 extract
  CreateDirectory "$INSTDIR\backups\before-$UpgradeStamp"
  ClearErrors
  CopyFiles /SILENT "$INSTDIR\data\*.*" "$INSTDIR\backups\before-$UpgradeStamp"
  IfErrors 0 extract
  MessageBox MB_ICONSTOP "更新前的数据备份失败，已停止更新。请检查磁盘空间和目录权限。" /SD IDOK
  SetErrorLevel 1
  Abort
extract:
  Call PrepareStorage
  ClearErrors
  SetOverwrite on
  SetOutPath "$INSTDIR"
  File /r /x ".gitkeep" "..\CSXS"
  File /r /x ".gitkeep" "..\client"
  File /r "..\host"
  File "..\License.md"
  File "..\README.md"
  SetOutPath "$INSTDIR\data"
  ; Whitelist defaults: never ship or overwrite any user-created data file.
  File "..\data\settings.default.json"
  File "..\data\organizer-rules.json"
  File "..\data\default-expressions.json"
  File "..\data\changelog.json"
  IfErrors 0 extracted
  MessageBox MB_ICONSTOP "程序文件更新失败，请关闭 AE 后重试。用户数据未覆盖，备份位于扩展的 backups 文件夹。" /SD IDOK
  SetErrorLevel 1
  Abort
extracted:
  SetOutPath "$INSTDIR"
  ClearErrors
  WriteUninstaller "$INSTDIR\uninstall.exe"
  IfErrors 0 uninstallerReady
  MessageBox MB_ICONSTOP "卸载程序写入失败，已停止注册更新。用户数据保持不变。" /SD IDOK
  SetErrorLevel 1
  Abort
uninstallerReady:
  StrCpy $LegacyPath "${LEGACYUSER_DIR}"
  Call DisableLegacy
  StrCpy $LegacyPath "${LEGACY32_DIR}"
  Call DisableLegacy
  StrCpy $LegacyPath "${LEGACY64_DIR}"
  Call DisableLegacy
  StrCpy $LegacyPath $RegisteredLegacy
  Call DisableLegacy
  !ifndef TEST_ROOT
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}"
    DeleteRegKey HKLM "Software\${APPNAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayName" "${APPNAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "UninstallString" '$\"$INSTDIR\uninstall.exe$\"'
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayVersion" "${VERSION}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "Publisher" "${APPNAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "InstallLocation" "$INSTDIR"
  !endif
  DetailPrint "已安装 / 更新到: $INSTDIR；用户数据随扩展保存。"
SectionEnd
Section /o "开发安装：允许当前用户加载未签名扩展" SecDebug
  !ifndef TEST_ROOT
    SetRegView 64
    WriteRegStr HKCU "Software\Adobe\CSXS.11" "PlayerDebugMode" "1"
    WriteRegStr HKCU "Software\Adobe\CSXS.12" "PlayerDebugMode" "1"
  !endif
SectionEnd
Section "Uninstall"
  SetShellVarContext current
  StrCmp $INSTDIR "${DEFAULT_DIR}" 0 unsafe
  IfFileExists "$INSTDIR\CSXS\manifest.xml" 0 unsafe
  RMDir /r "$INSTDIR\CSXS"
  RMDir /r "$INSTDIR\client"
  RMDir /r "$INSTDIR\host"
  ; data/, backups/ and extra root-level script folders remain.
  Delete "$INSTDIR\README.md"
  Delete "$INSTDIR\License.md"
  Delete "$INSTDIR\uninstall.exe"
  RMDir "$INSTDIR"
  !ifndef TEST_ROOT
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}"
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}"
  !endif
  Goto done
unsafe:
  MessageBox MB_ICONSTOP "卸载路径不符合预期，已停止删除。请检查安装目录。" /SD IDOK
  SetErrorLevel 1
  Abort
done:
SectionEnd
