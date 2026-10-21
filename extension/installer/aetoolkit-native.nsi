Unicode true
!ifndef VERSION
  !error "Use build.ps1 with a validated native payload"
!endif
!ifndef STAGE
  !error "STAGE is required"
!endif
!ifndef OUTPUT_FILE
  !error "OUTPUT_FILE is required"
!endif
!define APPNAME "AE Local Toolkit (WebView2)"
!define PRODUCT_ID "AeltToolkitWebView2"
!define UNINSTALL_ROOT "Software\Microsoft\Windows\CurrentVersion\Uninstall"
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "StrFunc.nsh"
!include "x64.nsh"
!include "nsDialogs.nsh"
${StrStr}
!ifndef TEST_ROOT
${UnStrStr}
!endif
Name "${APPNAME} ${VERSION}"
OutFile "${OUTPUT_FILE}"
!ifdef TEST_ROOT
  RequestExecutionLevel user
  InstallDir "${TEST_ROOT}\AE\Support Files"
!else
  RequestExecutionLevel admin
  InstallDir "$PROGRAMFILES64\Adobe\Adobe After Effects 2023\Support Files"
!endif
SetCompressor /SOLID lzma
VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "${APPNAME}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "FileDescription" "AE Local Toolkit Windows x64 native panel installer"
VIAddVersionKey "FileVersion" "${VERSION}.0"
VIAddVersionKey "LegalCopyright" "GPLv3 contributors; third-party notices included"
Var AeRoot
Var AeName
Var NativeTarget
Var AeCount
Var AeUseCustom
Var AeSelect
Var AeLocation
Var AeSelectedIndex
Var UpgradeStamp
Var CheckPath
Var RegistryKey
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TEXT "安装 Windows 原生面板（AEGP + WebView2）。$\r$\n$\r$\n请先关闭 AE，再选择自动发现的 AE 版本，或使用自定义路径。程序写入其 Plug-ins\AeltToolkitWebView2。$\r$\n$\r$\n已安装 WebView2 Runtime 时直接使用；缺少时自动从微软下载并安装，需要联网。"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\License.md"
Page custom AeSelectionPage AeSelectionLeave
!define MUI_PAGE_CUSTOMFUNCTION_PRE AeDirectoryPre
!define MUI_DIRECTORYPAGE_TEXT_TOP "选择包含 AfterFX.exe 的 Support Files 文件夹。每次安装只更新所选 AE 版本。"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_TEXT "启动 AE，在「窗口」菜单打开 AE Local Toolkit (WebView2)。$\r$\n$\r$\n在首选项启用「允许脚本写入文件和访问网络」。$\r$\n$\r$\n首次升级会备份迁移旧 CEP 数据，已有原生数据优先。旧 CEP 和脚本保留；也可在设置页导入 JSON 备份。"
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"

Function .onInit
  SetRegView 64
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "此安装器仅支持 Windows x64。" /SD IDOK
    Abort
  ${EndIf}
  !ifndef TEST_ROOT
  ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\App Paths\AfterFX.exe" ""
  ${If} $0 != ""
    ${GetParent} $0 $1
    IfFileExists "$1\AfterFX.exe" 0 +2
    StrCpy $INSTDIR $1
  ${EndIf}
  !endif
  Call DiscoverAe
  ${GetTime} "" "L" $0 $1 $2 $3 $4 $5 $6
  System::Call 'kernel32::GetTickCount() i.r7'
  StrCpy $UpgradeStamp "${VERSION}-$2$1$0-$4$5$6-$7"
FunctionEnd
Function DiscoverAe
  StrCpy $AeCount 0
  StrCpy $AeUseCustom 1
  StrCpy $AeSelectedIndex 0
  !ifndef TEST_ROOT
    InitPluginsDir
    SetOutPath "$PLUGINSDIR"
    File "${STAGE}\prerequisites\Discover-Ae.ps1"
    nsExec::ExecToLog /TIMEOUT=30000 '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\Discover-Ae.ps1" -OutputFile "$PLUGINSDIR\ae-versions.ini"'
    Pop $0
    StrCmp $0 0 0 done
    ReadINIStr $AeCount "$PLUGINSDIR\ae-versions.ini" "versions" "count"
    IntCmp $AeCount 0 done done +1
    ReadINIStr $INSTDIR "$PLUGINSDIR\ae-versions.ini" "ae0" "path"
    StrCpy $AeUseCustom 0
done:
  !endif
FunctionEnd
Function AeSelectionPage
  !insertmacro MUI_HEADER_TEXT "选择 After Effects" "选择一个已安装的 AE 版本，或在列表末尾选择自定义路径。"
  nsDialogs::Create 1018
  Pop $0
  StrCmp $0 error 0 +2
  Abort
  ${NSD_CreateLabel} 0 0 100% 16u "安装到哪个 AE 版本？"
  Pop $0
  ${NSD_CreateDropList} 0 22u 100% 100u ""
  Pop $AeSelect
  StrCpy $1 0
loop:
  IntCmp $1 $AeCount custom +1 custom
  ReadINIStr $2 "$PLUGINSDIR\ae-versions.ini" "ae$1" "name"
  ${NSD_CB_AddString} $AeSelect "$2"
  IntOp $1 $1 + 1
  Goto loop
custom:
  ${NSD_CB_AddString} $AeSelect "自定义路径…"
  SendMessage $AeSelect ${CB_SETCURSEL} $AeSelectedIndex 0
  ${NSD_CreateLabel} 0 53u 100% 70u ""
  Pop $AeLocation
  ${NSD_OnChange} $AeSelect AeSelectionChanged
  Call UpdateAeSelection
  nsDialogs::Show
FunctionEnd
Function UpdateAeSelection
  SendMessage $AeSelect ${CB_GETCURSEL} 0 0 $0
  StrCpy $AeSelectedIndex $0
  IntCmp $0 $AeCount custom selected custom
selected:
  ReadINIStr $INSTDIR "$PLUGINSDIR\ae-versions.ini" "ae$0" "path"
  StrCpy $AeUseCustom 0
  ${NSD_SetText} $AeLocation "安装位置：$INSTDIR\Plug-ins\${PRODUCT_ID}$\r$\n$\r$\n本次仅安装到所选 AE；其他版本可再次运行安装器安装。"
  Return
custom:
  StrCpy $AeUseCustom 1
  ${NSD_SetText} $AeLocation "下一步请选择自定义 AE 的 Support Files 文件夹。该文件夹中应包含 AfterFX.exe。"
FunctionEnd
Function AeSelectionChanged
  Pop $0
  Call UpdateAeSelection
FunctionEnd
Function AeSelectionLeave
  Call UpdateAeSelection
FunctionEnd
Function AeDirectoryPre
  StrCmp $AeUseCustom 1 +2
  Abort
FunctionEnd
Function .onVerifyInstDir
  IfFileExists "$INSTDIR\AfterFX.exe" done
  Abort
done:
FunctionEnd

Function RejectReparsePoint
  System::Call 'kernel32::GetFileAttributesW(w "$CheckPath") i.r0'
  IntCmp $0 -1 done
  IntOp $0 $0 & 0x400
  IntCmp $0 0 done
  MessageBox MB_ICONSTOP "目标目录包含链接，停止更新以保护开发工作区：$CheckPath" /SD IDOK
  SetErrorLevel 1
  Abort
done:
FunctionEnd
Function CheckTarget
  GetFullPathName $AeRoot "$INSTDIR"
  !ifdef TEST_ROOT
    StrCmp $AeRoot "${TEST_ROOT}\AE\Support Files" +2
    Abort
  !endif
  IfFileExists "$AeRoot\AfterFX.exe" 0 invalid
  StrCpy $NativeTarget "$AeRoot\Plug-ins\${PRODUCT_ID}"
  StrCpy $CheckPath $AeRoot
  Call RejectReparsePoint
  StrCpy $CheckPath "$AeRoot\Plug-ins"
  Call RejectReparsePoint
  StrCpy $CheckPath $NativeTarget
  Call RejectReparsePoint
  IfFileExists "$NativeTarget\*.*" 0 owned
  IfFileExists "$NativeTarget\aelt-native-install.json" 0 invalid
  FileOpen $1 "$NativeTarget\aelt-native-install.json" r
  IfErrors invalid
  StrCpy $3 ""
readMarker:
  ClearErrors
  FileRead $1 $2
  IfErrors closeMarker
  ${StrStr} $3 $2 'org.aelocaltoolkit.webview2.toolkit'
  StrCmp $3 "" readMarker
closeMarker:
  FileClose $1
  StrCmp $3 "" invalid
owned:
  !macro CheckOwnedDirectory NAME
    StrCpy $CheckPath "$NativeTarget\${NAME}"
    Call RejectReparsePoint
  !macroend
  !insertmacro CheckOwnedDirectory "extension"
  !insertmacro CheckOwnedDirectory "extension\client"
  !insertmacro CheckOwnedDirectory "extension\host"
  !insertmacro CheckOwnedDirectory "extension\CSXS"
  !insertmacro CheckOwnedDirectory "extension\data"
  !insertmacro CheckOwnedDirectory "licenses"
  !insertmacro CheckOwnedDirectory "backups"
  ${GetParent} $AeRoot $0
  ${GetFileName} $0 $AeName
  StrCpy $RegistryKey "${UNINSTALL_ROOT}\${APPNAME} ($AeName)"
  Return
invalid:
  MessageBox MB_ICONSTOP "请选择包含 AfterFX.exe 的 AE Support Files 目录；已有目标必须是本工具箱的正式安装目录。" /SD IDOK
  SetErrorLevel 1
  Abort
FunctionEnd
Function RequireAeClosed
  !ifdef TEST_ROOT
    Return
  !endif
  nsExec::ExecToStack /TIMEOUT=5000 '"$SYSDIR\tasklist.exe" /FI "IMAGENAME eq AfterFX*" /NH /FO CSV'
  Pop $0
  Pop $1
  StrCmp $0 0 0 failed
  ${StrStr} $2 $1 'AfterFX'
  StrCmp $2 "" done
failed:
  MessageBox MB_ICONSTOP "请保存工程并退出所有 AE 后再安装；无法核查进程时也会停止更新。" /SD IDOK
  SetErrorLevel 1
  Abort
done:
FunctionEnd
Function EnsureRuntime
  !ifdef TEST_ROOT
    Return
  !else
  InitPluginsDir
  SetOutPath "$PLUGINSDIR"
  File "${STAGE}\prerequisites\Ensure-WebView2.ps1"
  File "${STAGE}\prerequisites\webview2-bootstrapper.json"
  DetailPrint "检测 WebView2 Runtime；如缺少，将自动从微软下载并安装，请稍候…"
  nsExec::ExecToLog /TIMEOUT=900000 '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\Ensure-WebView2.ps1"'
  Pop $0
  StrCmp $0 0 0 failed
  Return
failed:
  MessageBox MB_ICONSTOP "WebView2 Runtime 准备失败，工具箱更新已停止。缺少运行时需要联网；请检查网络、微软下载服务或企业安装策略后重试。详见安装日志。" /SD IDOK
  SetErrorLevel 1
  Abort
  !endif
FunctionEnd

Section "Windows 原生工具箱" SecMain
  SectionIn RO
  Call RequireAeClosed
  Call CheckTarget
  Call EnsureRuntime
  StrCpy $INSTDIR $NativeTarget
  InitPluginsDir
  SetOutPath "$PLUGINSDIR"
  File "Manage-Installation.ps1"
  File "${STAGE}\AeltToolkitWebView2\installed-files.json"
  !ifdef TEST_ROOT
    ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\Manage-Installation.ps1" -Action Prepare -InstallRoot "$INSTDIR" -ProductVersion "${VERSION}" -PayloadManifest "$PLUGINSDIR\installed-files.json" -LegacyRoots "${TEST_ROOT}\legacy\AeLocalToolkit"' $0
  !else
    ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\Manage-Installation.ps1" -Action Prepare -InstallRoot "$INSTDIR" -ProductVersion "${VERSION}" -PayloadManifest "$PLUGINSDIR\installed-files.json"' $0
  !endif
  IfErrors failed
  StrCmp $0 0 0 failed
  CreateDirectory "$INSTDIR\extension\data"
  !ifndef TEST_ROOT
  System::Call 'secur32::GetUserNameExW(i 2, w .r0, *i ${NSIS_MAX_STRLEN}) i .r1'
  StrCmp $1 0 failed
  ClearErrors
  ExecWait '"$SYSDIR\icacls.exe" "$INSTDIR\extension\data" /grant "$0:(OI)(CI)M" /Q' $1
  IfErrors failed
  StrCmp $1 0 0 failed
  !endif
  SetOverwrite on
  ClearErrors
  SetOutPath "$INSTDIR"
  File "${STAGE}\AeltToolkitWebView2\AeltToolkitWebView2.aex"
  File "${STAGE}\AeltToolkitWebView2\aelt-native-install.json"
  File "${STAGE}\AeltToolkitWebView2\installed-files.json"
  File "${STAGE}\AeltToolkitWebView2\Manage-Installation.ps1"
  File /r "${STAGE}\AeltToolkitWebView2\licenses"
  SetOutPath "$INSTDIR\extension"
  File /r "${STAGE}\AeltToolkitWebView2\extension\client"
  File /r "${STAGE}\AeltToolkitWebView2\extension\host"
  File /r "${STAGE}\AeltToolkitWebView2\extension\CSXS"
  File "${STAGE}\AeltToolkitWebView2\extension\License.md"
  File "${STAGE}\AeltToolkitWebView2\extension\README.md"
  SetOutPath "$INSTDIR\extension\data"
  File "${STAGE}\AeltToolkitWebView2\extension\data\settings.default.json"
  File "${STAGE}\AeltToolkitWebView2\extension\data\organizer-rules.json"
  File "${STAGE}\AeltToolkitWebView2\extension\data\default-expressions.json"
  File "${STAGE}\AeltToolkitWebView2\extension\data\changelog.json"
  IfErrors failed
  SetOutPath "$INSTDIR"
  WriteUninstaller "$INSTDIR\uninstall.exe"
  IfErrors failed
  !ifndef TEST_ROOT
  WriteRegStr HKLM "$RegistryKey" "DisplayName" "${APPNAME} ($AeName)"
  WriteRegStr HKLM "$RegistryKey" "DisplayVersion" "${VERSION}"
  WriteRegStr HKLM "$RegistryKey" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "$RegistryKey" "UninstallString" '$\"$INSTDIR\uninstall.exe$\"'
  !endif
  DetailPrint "安装完成：$INSTDIR。未安装或修改 CEP；数据位于 extension\data。"
  Goto done
failed:
  MessageBox MB_ICONSTOP "安装或权限设置失败。原个人数据未覆盖，更新前备份保留在 backups。" /SD IDOK
  SetErrorLevel 1
  Abort
done:
SectionEnd

Section "Uninstall"
  ; Resolve and check our exact scope before recursively removing owned code.
  ; NSIS preserves the original uninstaller location in INSTDIR when it copies
  ; itself to TEMP. EXEDIR can point at that temporary execution directory.
  GetFullPathName $INSTDIR "$INSTDIR"
  ${GetFileName} $INSTDIR $0
  StrCmp $0 "${PRODUCT_ID}" 0 unsafe
  ${GetParent} $INSTDIR $1
  ${GetFileName} $1 $0
  StrCmp $0 "Plug-ins" 0 unsafe
  ${GetParent} $1 $AeRoot
  IfFileExists "$AeRoot\AfterFX.exe" 0 unsafe
  IfFileExists "$INSTDIR\aelt-native-install.json" 0 unsafe
  !ifdef TEST_ROOT
    StrCmp $INSTDIR "${TEST_ROOT}\AE\Support Files\Plug-ins\${PRODUCT_ID}" +2
    Goto unsafe
  !endif
  !macro UninstallNoLink PATH
    System::Call 'kernel32::GetFileAttributesW(w "${PATH}") i.r0'
    IntCmp $0 -1 +4
    IntOp $0 $0 & 0x400
    IntCmp $0 0 +2
    Goto unsafe
  !macroend
  !insertmacro UninstallNoLink "$INSTDIR"
  !insertmacro UninstallNoLink "$AeRoot"
  !insertmacro UninstallNoLink "$AeRoot\Plug-ins"
  !insertmacro UninstallNoLink "$INSTDIR\extension"
  !insertmacro UninstallNoLink "$INSTDIR\extension\client"
  !insertmacro UninstallNoLink "$INSTDIR\extension\host"
  !insertmacro UninstallNoLink "$INSTDIR\extension\CSXS"
  !insertmacro UninstallNoLink "$INSTDIR\licenses"
  !ifndef TEST_ROOT
  nsExec::ExecToStack /TIMEOUT=5000 '"$SYSDIR\tasklist.exe" /FI "IMAGENAME eq AfterFX*" /NH /FO CSV'
  Pop $0
  Pop $1
  StrCmp $0 0 0 unsafe
  ${UnStrStr} $2 $1 'AfterFX'
  StrCmp $2 "" 0 unsafe
  !endif
  ClearErrors
  ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\Manage-Installation.ps1" -Action Uninstall -InstallRoot "$INSTDIR"' $0
  IfErrors unsafe
  StrCmp $0 0 0 unsafe
  ; Keep the identity marker with retained data, so reinstall can recognize it.
  Delete "$INSTDIR\uninstall.exe"
  RMDir "$INSTDIR\extension"
  RMDir "$INSTDIR"
  ${GetParent} $AeRoot $0
  ${GetFileName} $0 $AeName
  SetRegView 64
  !ifndef TEST_ROOT
  DeleteRegKey HKLM "${UNINSTALL_ROOT}\${APPNAME} ($AeName)"
  !endif
  Goto done
unsafe:
  MessageBox MB_ICONSTOP "请退出 AE 并确认这是本工具箱的原生安装目录；路径或进程检查失败时不会删除文件。" /SD IDOK
  SetErrorLevel 1
  Abort
done:
SectionEnd
