$ErrorActionPreference = 'Stop'
$extensionRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$version = (Get-Content -LiteralPath (Join-Path $extensionRoot 'data\changelog.json') -Raw | ConvertFrom-Json).version
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw 'Invalid changelog version' }
[xml]$manifest = Get-Content -LiteralPath (Join-Path $extensionRoot 'CSXS\manifest.xml') -Raw
if ($manifest.ExtensionManifest.ExtensionBundleVersion -ne $version) { throw 'Manifest and changelog versions differ' }
$compiler = Get-Command makensis.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1
if (-not $compiler) {
  foreach ($candidate in @('C:\Program Files (x86)\NSIS\makensis.exe', 'C:\Program Files\NSIS\makensis.exe')) {
    if (Test-Path -LiteralPath $candidate) { $compiler = $candidate; break }
  }
}
if (-not $compiler) { throw 'NSIS is required. Install it explicitly, then rerun this build.' }
$output = Join-Path $PSScriptRoot 'dist'
New-Item -ItemType Directory -Force -Path $output | Out-Null
Push-Location $PSScriptRoot
try {
  & $compiler "/DVERSION=$version" 'aetoolkit.nsi'
  if ($LASTEXITCODE -ne 0) { throw 'NSIS build failed' }
} finally { Pop-Location }
$stagingRoot = [IO.Path]::GetFullPath((Join-Path ([IO.Path]::GetTempPath()) ('aetoolkit-' + [guid]::NewGuid().ToString('N'))))
$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
if (-not $stagingRoot.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid staging path' }
try {
  $packageRoot = Join-Path $stagingRoot 'AeLocalToolkit'
  New-Item -ItemType Directory -Force -Path $packageRoot | Out-Null
  foreach ($directory in @('CSXS','client','host','data')) { Copy-Item -LiteralPath (Join-Path $extensionRoot $directory) -Destination $packageRoot -Recurse -Force }
  foreach ($file in @('License.md','README.md')) { Copy-Item -LiteralPath (Join-Path $extensionRoot $file) -Destination $packageRoot -Force }
  $localSettings = Join-Path $packageRoot 'data\settings.json'
  if (Test-Path -LiteralPath $localSettings) { Remove-Item -LiteralPath $localSettings -Force }
  $localSchemes = [IO.Path]::GetFullPath((Join-Path $packageRoot 'data\organizer-schemes'))
  if (-not $localSchemes.StartsWith($stagingRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid local scheme staging path' }
  if (Test-Path -LiteralPath $localSchemes) { Remove-Item -LiteralPath $localSchemes -Recurse -Force }
  Compress-Archive -LiteralPath $packageRoot -DestinationPath (Join-Path $output 'aetoolkit-extension.zip') -Force
} finally {
  if (Test-Path -LiteralPath $stagingRoot) { Remove-Item -LiteralPath $stagingRoot -Recurse -Force }
}
Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $output 'aetoolkit-installer.exe'), (Join-Path $output 'aetoolkit-extension.zip') | Format-Table -AutoSize
