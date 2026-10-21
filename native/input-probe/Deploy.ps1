param(
    [string]$PluginDirectory='D:\Software\Adobe\Adobe After Effects 2023\Support Files\Plug-ins',
    [switch]$Apply,
    [switch]$Remove
)
$ErrorActionPreference='Stop'
$probeRepo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$probeSource=[IO.Path]::GetFullPath((Join-Path $probeRepo '.artifacts\webview2-probe\bin'))
$probePluginRoot=(Resolve-Path -LiteralPath $PluginDirectory).Path
$probeDestination=[IO.Path]::GetFullPath((Join-Path $probePluginRoot 'AeltInputProbe'))
if((Split-Path -Parent $probeDestination) -ine $probePluginRoot -or (Split-Path -Leaf $probeDestination) -cne 'AeltInputProbe'){throw 'Unexpected deployment destination'}
$probeExisting=Get-Item -LiteralPath $probeDestination -Force -ErrorAction SilentlyContinue
if($probeExisting){
    if($probeExisting.LinkType -ne 'Junction' -or [IO.Path]::GetFullPath([string]$probeExisting.Target) -ine $probeSource){throw 'Refused: destination is not this probe junction'}
}
Write-Output ('Source: '+$probeSource)
Write-Output ('Destination: '+$probeDestination)
Write-Output ('Action: '+$(if($Remove){'Remove only the verified junction; retain workspace files'}else{'Create a dedicated development junction; retain CEP and Starfield'}))
if(!$Apply){Write-Output 'Report only. Add -Apply to act.';return}
if(Get-Process -Name AfterFX,AfterFX_64 -ErrorAction SilentlyContinue){throw 'Save and close AE before changing the development plugin junction'}
if($Remove){
    if($probeExisting){[IO.Directory]::Delete($probeDestination)}
    Write-Output 'Probe junction removed; workspace candidate retained.'
    return
}
$probePlugin=Join-Path $probeSource 'AeltInputProbe.aex'
if(!(Test-Path -LiteralPath $probePlugin) -or !(Test-Path -LiteralPath (Join-Path $probeSource 'content\index.html'))){throw 'Build the complete candidate first'}
& (Join-Path $PSScriptRoot 'VerifyResource.ps1') -Plugin $probePlugin
if(!$probeExisting){New-Item -ItemType Junction -Path $probeDestination -Target $probeSource | Out-Null}
$probeSourceHash=(Get-FileHash -LiteralPath $probePlugin -Algorithm SHA256).Hash
$probeInstalledHash=(Get-FileHash -LiteralPath (Join-Path $probeDestination 'AeltInputProbe.aex') -Algorithm SHA256).Hash
if($probeInstalledHash -cne $probeSourceHash){throw 'Installed development candidate hash mismatch'}
$probeEvidence=[ordered]@{Time=[DateTime]::UtcNow.ToString('o');Source=$probeSource;Destination=$probeDestination;PluginSha256=$probeSourceHash;AEWasStopped=$true;InstalledAs='development-junction';HostQualified=$false}
$probeEvidence | ConvertTo-Json | Set-Content -LiteralPath (Join-Path (Split-Path $probeSource -Parent) 'deployment.json') -Encoding utf8
Write-Output ('Development probe installed, SHA256 '+$probeSourceHash)
Write-Output 'Undo after closing AE: run native/input-probe/Deploy.ps1 -Apply -Remove with the same PluginDirectory.'
