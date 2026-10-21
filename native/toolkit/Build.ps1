param([Parameter(Mandatory=$true)][string]$AeSdkRoot,[Parameter(Mandatory=$true)][string]$WebView2SdkRoot,[string]$SeedFromCepRoot='',[string]$CompilerRoot='C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Tools\MSVC\14.51.36231',[int]$DebugPort=0,[switch]$TestsOnly)
$ErrorActionPreference='Stop'
$toolkitRepo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$toolkitOutput=Join-Path $toolkitRepo '.artifacts\webview2-toolkit'
$toolkitObjects=Join-Path $toolkitOutput 'obj';$toolkitBin=Join-Path $toolkitOutput 'bin'
New-Item -ItemType Directory -Force -Path $toolkitObjects,$toolkitBin | Out-Null
# Reuse the toolchain initialization and extracted-host queue tests.
& (Join-Path $PSScriptRoot '..\input-probe\Build.ps1') -AeSdkRoot $AeSdkRoot -WebView2SdkRoot $WebView2SdkRoot -CompilerRoot $CompilerRoot -TestsOnly
$toolkitIncludes=@((Join-Path $AeSdkRoot 'Examples\Headers'),(Join-Path $AeSdkRoot 'Examples\Headers\SP'),(Join-Path $WebView2SdkRoot 'build\native\include'),(Join-Path $toolkitRepo 'native\panel-host'))
$toolkitCommon=@('/nologo','/utf-8','/std:c++20','/W4','/WX','/EHsc','/O2','/MT','/DMSWindows','/DWIN32','/D_WINDOWS','/DUNICODE','/D_UNICODE','/D_CRT_SECURE_NO_WARNINGS',('/Fo"'+$toolkitObjects+'\\"'))
if($DebugPort -lt 0 -or $DebugPort -gt 65535){throw 'Invalid debug port'}
if($DebugPort){$toolkitCommon+=('/DAELT_NATIVE_DEBUG_PORT='+$DebugPort)}
foreach($toolkitInclude in $toolkitIncludes){$toolkitCommon+=('/I"'+$toolkitInclude+'"')}
$toolkitLibraries=@(('"'+(Join-Path $WebView2SdkRoot 'build\native\x64\WebView2LoaderStatic.lib')+'"'),'Advapi32.lib','Ole32.lib','OleAut32.lib','Version.lib','Shlwapi.lib','Comctl32.lib','Gdi32.lib','Comdlg32.lib','User32.lib','Shell32.lib')
function Invoke-ToolkitCompiler([string]$Label,[string[]]$Arguments){$toolkitRsp=Join-Path $toolkitObjects ($Label+'.rsp');[IO.File]::WriteAllText($toolkitRsp,($Arguments -join ' '),[Text.UTF8Encoding]::new($true));& (Join-Path $CompilerRoot 'bin\Hostx64\x64\cl.exe') ('@'+$toolkitRsp);if($LASTEXITCODE){throw "$Label build failed"}}
Push-Location -LiteralPath $toolkitRepo
try{
    $toolkitBridgeTest=Join-Path $toolkitOutput 'bridge-tests.exe'
    Invoke-ToolkitCompiler 'bridge-tests' ($toolkitCommon+@(('"'+(Join-Path $PSScriptRoot 'tests\bridge-tests.cpp')+'"'),('"'+(Join-Path $PSScriptRoot 'ToolkitBridge.cpp')+'"'),'/link',('/OUT:"'+$toolkitBridgeTest+'"'))+$toolkitLibraries)
    & $toolkitBridgeTest (Join-Path $toolkitOutput 'generated-scripts.json');if($LASTEXITCODE){throw 'Native toolkit bridge tests failed'}
    if($TestsOnly){return}
    & cl.exe /nologo /EP /TC /DMSWindows ('/I'+(Join-Path $AeSdkRoot 'Examples\Headers')) (Join-Path $PSScriptRoot 'ToolkitPiPL.r') | Set-Content -LiteralPath (Join-Path $toolkitObjects 'ToolkitPiPL.rr') -Encoding ascii
    if($LASTEXITCODE){throw 'Toolkit PiPL preprocessing failed'}
    & node (Join-Path $PSScriptRoot '..\input-probe\GenerateGeneralPiPL.cjs') (Join-Path $toolkitObjects 'ToolkitPiPL.rr') $toolkitObjects
    if($LASTEXITCODE){throw 'Toolkit PiPL generation failed'}
    & rc.exe /nologo ('/fo'+(Join-Path $toolkitObjects 'ToolkitPiPL.res')) (Join-Path $toolkitObjects 'ProbePiPL.rc');if($LASTEXITCODE){throw 'Toolkit resource compilation failed'}
    $toolkitPlugin=Join-Path $toolkitBin 'AeltToolkitWebView2.aex'
    Invoke-ToolkitCompiler 'toolkit' ($toolkitCommon+@('/LD',('"'+(Join-Path $PSScriptRoot 'ToolkitEntry.cpp')+'"'),('"'+(Join-Path $PSScriptRoot 'ToolkitBridge.cpp')+'"'),('"'+(Join-Path $toolkitRepo 'native\panel-host\PanelHost.cpp')+'"'),('"'+(Join-Path $toolkitObjects 'ToolkitPiPL.res')+'"'),'/link',('/OUT:"'+$toolkitPlugin+'"'),('/IMPLIB:"'+(Join-Path $toolkitObjects 'AeltToolkitWebView2.lib')+'"'),'/DEBUG',('/PDB:"'+(Join-Path $toolkitBin 'AeltToolkitWebView2.pdb')+'"'))+$toolkitLibraries)
    & node (Join-Path $PSScriptRoot 'prepare-runtime.cjs') $toolkitBin $SeedFromCepRoot;if($LASTEXITCODE){throw 'Toolkit runtime preparation failed'}
    & (Join-Path $PSScriptRoot '..\input-probe\VerifyResource.ps1') -Plugin $toolkitPlugin -ResourceId 16001 -EntryPoint AeltToolkitEntry -ExpectedName 'AE Local Toolkit WebView2'
    Get-FileHash -LiteralPath $toolkitPlugin -Algorithm SHA256
    Write-Output 'Independent toolkit candidate built; no installer or release generated.'
}finally{Pop-Location}
