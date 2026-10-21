param([string]$PluginDirectory='D:\Software\Adobe\Adobe After Effects 2023\Support Files\Plug-ins',[switch]$Apply,[switch]$Remove)
$ErrorActionPreference='Stop'
$toolkitRepo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$toolkitSource=[IO.Path]::GetFullPath((Join-Path $toolkitRepo '.artifacts\webview2-toolkit\bin'))
$toolkitPluginRoot=(Resolve-Path -LiteralPath $PluginDirectory).Path
$toolkitDestination=[IO.Path]::GetFullPath((Join-Path $toolkitPluginRoot 'AeltToolkitWebView2'))
if((Split-Path -Parent $toolkitDestination) -ine $toolkitPluginRoot -or (Split-Path -Leaf $toolkitDestination) -cne 'AeltToolkitWebView2'){throw 'Unexpected toolkit deployment destination'}
$toolkitExisting=Get-Item -LiteralPath $toolkitDestination -Force -ErrorAction SilentlyContinue
if($toolkitExisting -and ($toolkitExisting.LinkType -ne 'Junction' -or [IO.Path]::GetFullPath([string]$toolkitExisting.Target) -ine $toolkitSource)){throw 'Refused: existing destination is not this development junction'}
Write-Output ('Source: '+$toolkitSource);Write-Output ('Destination: '+$toolkitDestination)
if(!$Apply){Write-Output 'Report only. Use -Apply to deploy, or -Apply -Remove to remove only this verified junction.';return}
if(Get-Process -Name AfterFX,AfterFX_64 -ErrorAction SilentlyContinue){throw 'Save and close AE before changing the General AEGP development link'}
if($Remove){if($toolkitExisting){[IO.Directory]::Delete($toolkitDestination)};Write-Output 'Toolkit junction removed; candidate and user data retained in worktree.';return}
$toolkitPlugin=Join-Path $toolkitSource 'AeltToolkitWebView2.aex'
if(!(Test-Path -LiteralPath $toolkitPlugin) -or !(Test-Path -LiteralPath (Join-Path $toolkitSource 'extension\client\index.html'))){throw 'Build the complete toolkit candidate first'}
& (Join-Path $PSScriptRoot '..\input-probe\VerifyResource.ps1') -Plugin $toolkitPlugin -ResourceId 16001 -EntryPoint AeltToolkitEntry -ExpectedName 'AE Local Toolkit WebView2'
if(!$toolkitExisting){New-Item -ItemType Junction -Path $toolkitDestination -Target $toolkitSource | Out-Null}
$toolkitHash=(Get-FileHash -LiteralPath $toolkitPlugin -Algorithm SHA256).Hash
if((Get-FileHash -LiteralPath (Join-Path $toolkitDestination 'AeltToolkitWebView2.aex') -Algorithm SHA256).Hash -cne $toolkitHash){throw 'Installed toolkit hash mismatch'}
[ordered]@{Time=[DateTime]::UtcNow.ToString('o');Source=$toolkitSource;Destination=$toolkitDestination;PluginSha256=$toolkitHash;AEWasStopped=$true;HostQualified=$false;DataIsolated=$true} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path (Split-Path $toolkitSource -Parent) 'deployment.json') -Encoding utf8
Write-Output ('Independent toolkit development candidate installed: '+$toolkitHash)
Write-Output 'Undo after closing AE: native/toolkit/Deploy.ps1 -Apply -Remove. CEP, probe and Starfield remain installed.'
