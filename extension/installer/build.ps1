# Default entry validates both platform payloads. Packaging must be explicit.
param([ValidateSet('windows','macos','all')][string]$Platform='all',[switch]$CreatePackage,[string]$NativeBuildRoot='')
& (Join-Path $PSScriptRoot 'build-platform.ps1') @PSBoundParameters