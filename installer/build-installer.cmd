@echo off
REM ============================================================================
REM  AE Local Toolkit - installer build script (one-click)
REM  Builds a single setup.exe with NSIS (double-click to install, no deps).
REM  On a fresh machine it auto-installs NSIS if missing:
REM    1) winget install NSIS.NSIS   (preferred)
REM    2) direct download + silent install of nsis-3.12-setup.exe (fallback)
REM  Output: dist\aetoolkit-installer.exe        (single-file setup, distribute to users)
REM          dist\aetoolkit-extension.zip        (clean extension files only, for manual install)
REM ============================================================================

setlocal
set "INST=%~dp0"

REM ---- Locate makensis -------------------------------------------------------
set "MAKENSIS="
if exist "C:\Program Files (x86)\NSIS\makensis.exe" set "MAKENSIS=C:\Program Files (x86)\NSIS\makensis.exe"
if exist "C:\Program Files\NSIS\makensis.exe"        set "MAKENSIS=C:\Program Files\NSIS\makensis.exe"
if not defined MAKENSIS (
  where makensis >nul 2>nul && set "MAKENSIS=makensis"
)

REM ---- Auto-install NSIS if missing -----------------------------------------
if not defined MAKENSIS (
  echo [INFO] NSIS / makensis not found. Installing dependency automatically...
  call :ensure_nsis
  REM re-locate after install
  if exist "C:\Program Files (x86)\NSIS\makensis.exe" set "MAKENSIS=C:\Program Files (x86)\NSIS\makensis.exe"
  if exist "C:\Program Files\NSIS\makensis.exe"        set "MAKENSIS=C:\Program Files\NSIS\makensis.exe"
  if not defined MAKENSIS (
    where makensis >nul 2>nul && set "MAKENSIS=makensis"
  )
)

if not defined MAKENSIS (
  echo [ERROR] Could not install NSIS automatically.
  echo         Install it manually:  winget install NSIS.NSIS
  echo         or download from https://nsis.sourceforge.io/Download
  exit /b 1
)

if not exist "%INST%aetoolkit.nsi" (
  echo [ERROR] aetoolkit.nsi not found in this folder.
  exit /b 1
)

echo ==^> Building NSIS installer: dist\aetoolkit-installer.exe ...
"%MAKENSIS%" "%INST%aetoolkit.nsi"
if errorlevel 1 (
  echo [ERROR] NSIS build failed
  exit /b 1
)

REM ---- Build clean extension zip (manual install, no installer/ or dev files) ----
if not exist "%INST%dist" mkdir "%INST%dist"
set "ROOT=%INST%.."
echo ==^> Building clean extension zip: dist\aetoolkit-extension.zip ...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$root='%ROOT%'; $stage=Join-Path $env:TEMP ('aetk_stage_'+[guid]::NewGuid().ToString('N')); $ext=Join-Path $stage 'AeLocalToolkit'; New-Item -ItemType Directory -Force -Path $ext | Out-Null; foreach($d in @('CSXS','client','host','data')){ Copy-Item (Join-Path $root $d) (Join-Path $ext $d) -Recurse -Force }; foreach($f in @('License.md','README.md')){ Copy-Item (Join-Path $root $f) $ext -Force }; Remove-Item (Join-Path $ext 'data\settings.json') -Force -ErrorAction SilentlyContinue; Remove-Item (Join-Path $ext 'data\organizer-schemes') -Recurse -Force -ErrorAction SilentlyContinue; $zip=Join-Path '%INST%dist' 'aetoolkit-extension.zip'; if(Test-Path $zip){ Remove-Item $zip -Force }; Compress-Archive -Path $ext -DestinationPath $zip -Force; Remove-Item $stage -Recurse -Force; Write-Host ('[INFO] Extension zip: '+$zip)"
if errorlevel 1 (
  echo [ERROR] Extension zip build failed
  exit /b 1
)

echo.
echo Done. Output in dist\ :
echo   - aetoolkit-installer.exe     (single-file setup, distribute to users)
echo   - aetoolkit-extension.zip     (clean extension files only, for manual install)
echo.
echo Optional: sign with sign-win.ps1 to remove SmartScreen warning (needs code-signing cert).
endlocal
goto :eof

REM ===========================================================================
:ensure_nsis
  REM 1) winget (preferred: handles path + deps)
  where winget >nul 2>nul
  if not errorlevel 1 (
    echo [INFO] Installing NSIS via winget...
    winget install NSIS.NSIS --accept-package-agreements --accept-source-agreements --silent
    exit /b
  )

  REM 2) fallback: direct download + silent install
  echo [INFO] winget not found. Downloading NSIS installer directly...
  set "NSIS_URL=https://sourceforge.net/projects/nsis/files/NSIS%%203/3.12/nsis-3.12-setup.exe/download"
  set "NSIS_TMP=%TEMP%\nsis-3.12-setup.exe"
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri '%NSIS_URL%' -OutFile '%NSIS_TMP%' -UseBasicParsing"
  if not exist "%NSIS_TMP%" (
    echo [ERROR] Failed to download NSIS installer.
    exit /b 1
  )
  echo [INFO] Running NSIS installer silently...
  "%NSIS_TMP%" /S
  timeout /t 5 >nul
  exit /b
