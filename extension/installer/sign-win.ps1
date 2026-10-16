# Sign the Windows installer exe files with an Authenticode code-signing
# certificate. Signing identifies the publisher; warnings may still occur.
# Prerequisites: Windows SDK (signtool.exe) in PATH; a .pfx code-signing cert.
# Usage (PowerShell):
#   .\sign-win.ps1 -CertPath "my.pfx" -Password "cert-password"
param(
  [Parameter(Mandatory = $true)][string]$CertPath,
  [Parameter(Mandatory = $true)][string]$Password,
  [string]$TimestampServer = "http://timestamp.digicert.com"
)

$signtool = "signtool.exe"
if (-not (Get-Command $signtool -ErrorAction SilentlyContinue)) {
  Write-Error "signtool.exe not found. Install Windows SDK and add it to PATH."
  exit 1
}

$version = (Get-Content -LiteralPath (Join-Path $PSScriptRoot '..\data\changelog.json') -Raw | ConvertFrom-Json).version
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw 'Invalid changelog version' }
$files = @((Join-Path $PSScriptRoot ('dist\aetoolkit-v' + $version + '-installer.exe')))
foreach ($f in $files) {
  if (-not (Test-Path $f)) { Write-Error "File not found: $f"; exit 1 }
  & $signtool sign /fd SHA256 /td SHA256 /tr $TimestampServer /f $CertPath /p $Password $f
  if ($LASTEXITCODE -ne 0) { Write-Error "Signing failed: $f"; exit 1 }
  Write-Host "Signed: $f"
}
Write-Host "Windows installer signing complete. CEP extension signing is a separate step."
