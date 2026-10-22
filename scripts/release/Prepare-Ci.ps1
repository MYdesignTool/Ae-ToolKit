param([string]$OutputRoot='.artifacts/ci-inputs',[Parameter(Mandatory=$true)][string]$NativeBuildRoot,[string]$CachedNsisZip='')
$ErrorActionPreference='Stop'
$ciRepo=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$ciRoot=[IO.Path]::GetFullPath((Join-Path $ciRepo $OutputRoot))
if(Test-Path -LiteralPath $ciRoot){throw 'Use a fresh CI inputs directory'}
$ciLock=& node (Join-Path $PSScriptRoot 'verify-inputs.cjs')
if($LASTEXITCODE){throw 'Release input lock is invalid'}
$ciLock=$ciLock | ConvertFrom-Json
New-Item -ItemType Directory -Force -Path $ciRoot | Out-Null
function Get-VerifiedInput([string[]]$Uris,[string]$Target,[string]$Hash,[string]$Cached='',[string]$ReleaseTag='',[string]$AssetName=''){
    Write-Host "Preparing pinned dependency: $([IO.Path]::GetFileName($Target))"
    if($Cached){Copy-Item -LiteralPath $Cached -Destination $Target}elseif($ReleaseTag){
        & gh release download $ReleaseTag --repo $env:GITHUB_REPOSITORY --pattern $AssetName --output $Target
        if($LASTEXITCODE){throw "Controlled dependency delivery failed: $ReleaseTag/$AssetName"}
    }else{
        for($ciAttempt=1;$ciAttempt -le 3;$ciAttempt++){try{$ciUri=$Uris[($ciAttempt-1)%$Uris.Count];Write-Host "Download attempt ${ciAttempt}: $ciUri";Invoke-WebRequest -Uri $ciUri -OutFile $Target -TimeoutSec 240 -ErrorAction Stop;$ciActualHash=(Get-FileHash -LiteralPath $Target).Hash.ToLowerInvariant();if($ciActualHash -cne $Hash){throw "Unexpected dependency response: $Target; bytes=$((Get-Item -LiteralPath $Target).Length); SHA-256=$ciActualHash"};break}catch{Write-Warning $_.Exception.Message;if($ciAttempt -eq 3){throw};Start-Sleep -Seconds 3}}
    }
    if((Get-FileHash -LiteralPath $Target).Hash.ToLowerInvariant() -cne $Hash){throw "Downloaded input SHA-256 mismatch: $Target"}
}
$ciNative=(Resolve-Path -LiteralPath $NativeBuildRoot).Path
& node (Join-Path $PSScriptRoot 'verify-inputs.cjs') native $ciNative
if($LASTEXITCODE){throw 'Native metadata verification failed'}
$ciPlugin=Join-Path $ciNative 'bin/AeltToolkitWebView2.aex'
$ciVersion=(Get-Item -LiteralPath $ciPlugin).VersionInfo
if($ciVersion.ProductVersion -cne $ciLock.version -or $ciVersion.FileVersion -cne ($ciLock.version+'.0')){throw 'PE product/file version differs from changelog'}
& (Join-Path $ciRepo 'native/input-probe/VerifyResource.ps1') -Plugin $ciPlugin -ResourceId 16001 -EntryPoint AeltToolkitEntry -ExpectedName 'AE Local Toolkit WebView2'
if($LASTEXITCODE){throw 'AEX resource validation failed'}
$ciNsisZip=Join-Path $ciRoot 'nsis.zip';Get-VerifiedInput (@($ciLock.nsis.url)+@($ciLock.nsis.fallbackUrls)) $ciNsisZip $ciLock.nsis.sha256 $CachedNsisZip $ciLock.nsis.releaseTag $ciLock.nsis.assetName
$ciNsisRoot=Join-Path $ciRoot 'nsis';Expand-Archive -LiteralPath $ciNsisZip -DestinationPath $ciNsisRoot
$ciCompiler=Join-Path $ciNsisRoot 'nsis-3.12/makensis.exe'
if((& $ciCompiler /VERSION) -cne 'v3.12'){throw 'Unexpected NSIS compiler version'}
@{nativeRoot=$ciNative;nsisCompiler=$ciCompiler} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $ciRoot 'paths.json') -Encoding utf8
