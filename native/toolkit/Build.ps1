param([string]$AeSdkRoot='',[string]$WebView2SdkRoot='',[string]$SeedFromCepRoot='',[string]$CompilerRoot='',[string]$WindowsSdkRoot='',[string]$WindowsSdkVersion='10.0.26100.0',[string]$OutputRoot='',[int]$DebugPort=0,[switch]$TestsOnly,[switch]$UseHostToolchain)
$ErrorActionPreference='Stop'
if($UseHostToolchain){
    if(!$AeSdkRoot -or !$WebView2SdkRoot -or !$CompilerRoot -or !$WindowsSdkRoot){throw 'Host toolchain mode requires explicit SDK and compiler roots'}
    $dependencyNode=(Get-Command node.exe -ErrorAction Stop).Source
}else{
    . (Join-Path $PSScriptRoot '..\build\LocalDependencies.ps1')
    & $dependencyNode (Join-Path $PSScriptRoot '..\build\dependencies.cjs') verify 'adobe-ae-sdk,webview2-sdk,msvc-x64,windows-sdk-x64,node'
    if($LASTEXITCODE){throw 'Dependency snapshot verification failed'}
    if(!$AeSdkRoot){$AeSdkRoot=Get-LocalDependency 'adobe-ae-sdk'}
    if(!$WebView2SdkRoot){$WebView2SdkRoot=Get-LocalDependency 'webview2-sdk'}
    if(!$CompilerRoot){$CompilerRoot=Get-LocalDependency 'msvc-x64'}
    if(!$WindowsSdkRoot){$WindowsSdkRoot=Get-LocalDependency 'windows-sdk-x64'}
}
$toolkitRepo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$toolkitOutput=if($OutputRoot){[IO.Path]::GetFullPath($OutputRoot)}else{Join-Path $toolkitRepo '.artifacts\webview2-toolkit'}
$toolkitObjects=Join-Path $toolkitOutput 'obj';$toolkitBin=Join-Path $toolkitOutput 'bin'
New-Item -ItemType Directory -Force -Path $toolkitObjects,$toolkitBin | Out-Null
# Reuse the toolchain initialization and extracted-host queue tests.
& (Join-Path $PSScriptRoot '..\input-probe\Build.ps1') -AeSdkRoot $AeSdkRoot -WebView2SdkRoot $WebView2SdkRoot -CompilerRoot $CompilerRoot -WindowsSdkRoot $WindowsSdkRoot -WindowsSdkVersion $WindowsSdkVersion -UseHostToolchain:$UseHostToolchain -TestsOnly
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
    & $dependencyNode (Join-Path $PSScriptRoot '..\input-probe\GenerateGeneralPiPL.cjs') (Join-Path $toolkitObjects 'ToolkitPiPL.rr') $toolkitObjects
    if($LASTEXITCODE){throw 'Toolkit PiPL generation failed'}
    & rc.exe /nologo ('/fo'+(Join-Path $toolkitObjects 'ToolkitPiPL.res')) (Join-Path $toolkitObjects 'ProbePiPL.rc');if($LASTEXITCODE){throw 'Toolkit resource compilation failed'}
    & $dependencyNode (Join-Path $toolkitRepo 'scripts\release\version.cjs') resource (Join-Path $toolkitObjects 'ToolkitVersion.rc')
    if($LASTEXITCODE){throw 'Product version resource generation failed'}
    & rc.exe /nologo ('/fo'+(Join-Path $toolkitObjects 'ToolkitVersion.res')) (Join-Path $toolkitObjects 'ToolkitVersion.rc')
    if($LASTEXITCODE){throw 'Product version resource compilation failed'}
    $toolkitPlugin=Join-Path $toolkitBin 'AeltToolkitWebView2.aex'
    Invoke-ToolkitCompiler 'toolkit' ($toolkitCommon+@('/LD',('"'+(Join-Path $PSScriptRoot 'ToolkitEntry.cpp')+'"'),('"'+(Join-Path $PSScriptRoot 'ToolkitBridge.cpp')+'"'),('"'+(Join-Path $toolkitRepo 'native\panel-host\PanelHost.cpp')+'"'),('"'+(Join-Path $toolkitObjects 'ToolkitPiPL.res')+'"'),('"'+(Join-Path $toolkitObjects 'ToolkitVersion.res')+'"'),'/link',('/OUT:"'+$toolkitPlugin+'"'),('/IMPLIB:"'+(Join-Path $toolkitObjects 'AeltToolkitWebView2.lib')+'"'),'/DEBUG','/PDBALTPATH:%_PDB%',('/PDB:"'+(Join-Path $toolkitBin 'AeltToolkitWebView2.pdb')+'"'))+$toolkitLibraries)
    & $dependencyNode (Join-Path $PSScriptRoot 'prepare-runtime.cjs') $toolkitBin $SeedFromCepRoot;if($LASTEXITCODE){throw 'Toolkit runtime preparation failed'}
    $toolkitSourceHash=& $dependencyNode (Join-Path $PSScriptRoot '..\build\source-fingerprint.cjs')
    if($LASTEXITCODE){throw 'Native source fingerprint failed'}
    $toolkitCommit=& git -C $toolkitRepo rev-parse HEAD
    if($LASTEXITCODE){throw 'Build commit identity unavailable'}
    [ordered]@{Version=(Get-Content (Join-Path $toolkitRepo 'extension\data\changelog.json') -Raw | ConvertFrom-Json).version;BuildMode='source';GitCommit=$toolkitCommit;DebugPort=$DebugPort;PluginSha256=(Get-FileHash $toolkitPlugin).Hash;SourceSha256=$toolkitSourceHash;BuildInputsSha256=(Get-FileHash (Join-Path $toolkitRepo 'native/ci-dependencies.json')).Hash.ToLowerInvariant();CompilerVersion=(Get-Item (Join-Path $CompilerRoot 'bin/Hostx64/x64/cl.exe')).VersionInfo.FileVersion;WindowsSdkVersion=$WindowsSdkVersion} | ConvertTo-Json | Set-Content (Join-Path $toolkitOutput 'build-info.json') -Encoding utf8
    & (Join-Path $PSScriptRoot '..\input-probe\VerifyResource.ps1') -Plugin $toolkitPlugin -ResourceId 16001 -EntryPoint AeltToolkitEntry -ExpectedName 'AE Local Toolkit WebView2'
    Get-FileHash -LiteralPath $toolkitPlugin -Algorithm SHA256
    Write-Output 'Independent toolkit candidate built; no installer or release generated.'
}finally{Pop-Location}
