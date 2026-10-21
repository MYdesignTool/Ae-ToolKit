param(
    [Parameter(Mandatory=$true)][string]$AeSdkRoot,
    [Parameter(Mandatory=$true)][string]$WebView2SdkRoot,
    [string]$CompilerRoot='C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Tools\MSVC\14.51.36231',
    [string]$WindowsSdkRoot='C:\Program Files (x86)\Windows Kits\10',
    [string]$WindowsSdkVersion='10.0.26100.0',
    [switch]$TestsOnly,
    [switch]$UseAdobePiPLTool
)
$ErrorActionPreference='Stop'
$probeRepo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$probeOutput=Join-Path $probeRepo '.artifacts\webview2-probe'
$probeObjects=Join-Path $probeOutput 'obj'
$probeBin=Join-Path $probeOutput 'bin'
$probeHeaders=Join-Path $AeSdkRoot 'Examples\Headers'
$probeWebHeaders=Join-Path $WebView2SdkRoot 'build\native\include'
$probeLoader=Join-Path $WebView2SdkRoot 'build\native\x64\WebView2LoaderStatic.lib'
foreach($probeRequired in @((Join-Path $probeHeaders 'AE_GeneralPlugPanels.h'),(Join-Path $probeWebHeaders 'WebView2.h'),$probeLoader)) {if(!(Test-Path -LiteralPath $probeRequired)){throw "Build input not found: $probeRequired"}}
New-Item -ItemType Directory -Force -Path $probeObjects,$probeBin | Out-Null
# Environment changes apply only to this build process, never the AE process.
$env:PATH="$CompilerRoot\bin\Hostx64\x64;$WindowsSdkRoot\bin\$WindowsSdkVersion\x64;$env:PATH"
$env:INCLUDE="$CompilerRoot\include;$WindowsSdkRoot\Include\$WindowsSdkVersion\ucrt;$WindowsSdkRoot\Include\$WindowsSdkVersion\shared;$WindowsSdkRoot\Include\$WindowsSdkVersion\um;$WindowsSdkRoot\Include\$WindowsSdkVersion\winrt"
$env:LIB="$CompilerRoot\lib\x64;$WindowsSdkRoot\Lib\$WindowsSdkVersion\ucrt\x64;$WindowsSdkRoot\Lib\$WindowsSdkVersion\um\x64"
$probeCommon=@('/nologo','/utf-8','/std:c++20','/W4','/WX','/EHsc','/O2','/MT','/DMSWindows','/DWIN32','/D_WINDOWS','/DUNICODE','/D_UNICODE','/D_CRT_SECURE_NO_WARNINGS',
    ('/I"'+$probeHeaders+'"'),('/I"'+(Join-Path $probeHeaders 'SP')+'"'),('/I"'+$probeWebHeaders+'"'),('/I"'+(Join-Path $probeRepo 'native\panel-host')+'"'),('/Fo"'+$probeObjects+'\\"'))
$probeLibraries=@(('"'+$probeLoader+'"'),'Advapi32.lib','Ole32.lib','OleAut32.lib','Version.lib','Shlwapi.lib','Comctl32.lib','Gdi32.lib','Comdlg32.lib','User32.lib')
function Invoke-ProbeCompiler([string]$Name,[string[]]$Arguments){
    $probeResponse=Join-Path $probeObjects ($Name+'.rsp')
    [IO.File]::WriteAllText($probeResponse,($Arguments -join ' '),[Text.UTF8Encoding]::new($true))
    & (Join-Path $CompilerRoot 'bin\Hostx64\x64\cl.exe') ('@'+$probeResponse)
    if($LASTEXITCODE){throw "$Name compilation failed ($LASTEXITCODE)"}
}
Push-Location -LiteralPath $probeRepo
try {
    $probeTest=Join-Path $probeOutput 'host-tests.exe'
    Invoke-ProbeCompiler 'host-tests' ($probeCommon+@(('"'+(Join-Path $PSScriptRoot 'tests\host-tests.cpp')+'"'),'/link',('/OUT:"'+$probeTest+'"'))+$probeLibraries)
    & $probeTest
    if($LASTEXITCODE){throw 'Extracted host tests failed'}
    if($TestsOnly){return}
    $probePiPL=Join-Path $PSScriptRoot 'ProbePiPL.r'
    & cl.exe /nologo /EP /TC /DMSWindows ('/I'+$probeHeaders) $probePiPL | Set-Content -LiteralPath (Join-Path $probeObjects 'ProbePiPL.rr') -Encoding ascii
    if($LASTEXITCODE){throw 'PiPL source preprocessing failed'}
    if($UseAdobePiPLTool){
        Push-Location -LiteralPath $probeObjects
        try {
            & (Join-Path $AeSdkRoot 'Examples\Resources\PiPLtool.exe') 'ProbePiPL.rr' 'ProbePiPL.rrc'
            if($LASTEXITCODE){throw 'Adobe PiPLtool conversion failed'}
        } finally {Pop-Location}
        & cl.exe /nologo /EP /TC /DMSWindows (Join-Path $probeObjects 'ProbePiPL.rrc') | Set-Content -LiteralPath (Join-Path $probeObjects 'ProbePiPL.rc') -Encoding ascii
        if($LASTEXITCODE){throw 'PiPL resource preprocessing failed'}
    }else{
        & node (Join-Path $PSScriptRoot 'GenerateGeneralPiPL.cjs') (Join-Path $probeObjects 'ProbePiPL.rr') $probeObjects
        if($LASTEXITCODE){throw 'Limited General AEGP resource encoding failed'}
    }
    $probeResource=Join-Path $probeObjects 'ProbePiPL.res'
    & rc.exe /nologo ('/fo'+$probeResource) (Join-Path $probeObjects 'ProbePiPL.rc')
    if($LASTEXITCODE){throw 'PiPL resource compilation failed'}
    $probePlugin=Join-Path $probeBin 'AeltInputProbe.aex'
    Invoke-ProbeCompiler 'input-probe' ($probeCommon+@('/LD',('"'+(Join-Path $PSScriptRoot 'ProbeEntry.cpp')+'"'),('"'+(Join-Path $probeRepo 'native\panel-host\PanelHost.cpp')+'"'),('"'+$probeResource+'"'),'/link',('/OUT:"'+$probePlugin+'"'),('/IMPLIB:"'+(Join-Path $probeObjects 'AeltInputProbe.lib')+'"'),'/DEBUG',('/PDB:"'+(Join-Path $probeBin 'AeltInputProbe.pdb')+'"'))+$probeLibraries)
    $probeContent=Join-Path $probeBin 'content'
    New-Item -ItemType Directory -Force -Path (Join-Path $probeContent 'vendor') | Out-Null
    foreach($probeFile in @('index.html','probe.js','probe.css')){Copy-Item -LiteralPath (Join-Path $PSScriptRoot ('web\'+$probeFile)) -Destination (Join-Path $probeContent $probeFile) -Force}
    foreach($probeFile in @('codemirror.js','codemirror.css','javascript.js','LICENSE-codemirror')){Copy-Item -LiteralPath (Join-Path $probeRepo ('extension\client\vendor\'+$probeFile)) -Destination (Join-Path $probeContent ('vendor\'+$probeFile)) -Force}
    Get-FileHash -LiteralPath $probePlugin -Algorithm SHA256
    Write-Output 'Development probe built in .artifacts only; not deployed, no installer generated.'
} finally {Pop-Location}
