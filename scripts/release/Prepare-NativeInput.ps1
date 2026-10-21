param([string]$NativeBuildRoot='.artifacts/installer-native',[switch]$UpdateLock)
$ErrorActionPreference='Stop'
$inputRepo=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$inputMeta=(& node (Join-Path $PSScriptRoot 'version.cjs') check | ConvertFrom-Json)
if($LASTEXITCODE){throw 'Version check failed'}
$inputBuild=[IO.Path]::GetFullPath((Join-Path $inputRepo $NativeBuildRoot))
$inputInfo=Get-Content -LiteralPath (Join-Path $inputBuild 'build-info.json') -Raw | ConvertFrom-Json
$inputPlugin=Join-Path $inputBuild 'bin/AeltToolkitWebView2.aex'
$inputHash=(Get-FileHash -LiteralPath $inputPlugin).Hash.ToLowerInvariant()
$inputSource=& node (Join-Path $inputRepo 'native/build/source-fingerprint.cjs')
$inputVersion=(Get-Item -LiteralPath $inputPlugin).VersionInfo
if($inputInfo.Version -cne $inputMeta.version -or $inputInfo.DebugPort -ne 0 -or $inputInfo.PluginSha256.ToLowerInvariant() -cne $inputHash -or $inputInfo.SourceSha256 -cne $inputSource -or $inputVersion.ProductVersion -cne $inputMeta.version -or $inputVersion.FileVersion -cne ($inputMeta.version+'.0')){throw 'Rebuild and review the current non-debug AEX before preparing release inputs'}
$inputStage=Join-Path $inputRepo ('.artifacts/native-input-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path (Join-Path $inputStage 'bin') | Out-Null
Copy-Item -LiteralPath $inputPlugin -Destination (Join-Path $inputStage 'bin/AeltToolkitWebView2.aex')
Copy-Item -LiteralPath (Join-Path $inputBuild 'build-info.json') -Destination $inputStage
$inputAsset='aelt-native-'+$inputMeta.tag+'-windows-x64.zip'
$inputZip=Join-Path $inputRepo ('.artifacts/'+$inputAsset)
if(Test-Path -LiteralPath $inputZip){throw 'Refused to replace an existing native bundle; archive it explicitly before creating another'}
Compress-Archive -LiteralPath (Join-Path $inputStage 'bin'),(Join-Path $inputStage 'build-info.json') -DestinationPath $inputZip
$inputBundleHash=(Get-FileHash -LiteralPath $inputZip).Hash.ToLowerInvariant()
if($UpdateLock){$inputLockPath=Join-Path $inputRepo 'native/release-inputs.json';$inputLock=Get-Content -LiteralPath $inputLockPath -Raw | ConvertFrom-Json;$inputLock.version=$inputMeta.version;$inputLock.native=[pscustomobject]@{releaseTag=('native-inputs-'+$inputMeta.tag);assetName=$inputAsset;sha256=$inputBundleHash;sourceSha256=$inputSource};$inputLock.runtime.releaseTag=$inputLock.native.releaseTag;$inputLock.nsis.releaseTag=$inputLock.native.releaseTag;[IO.File]::WriteAllText($inputLockPath,($inputLock|ConvertTo-Json -Depth 8).Replace("`r`n","`n")+"`n",[Text.UTF8Encoding]::new($false))}
Write-Output "Reviewed native input: $inputZip"
Write-Output "SHA-256: $inputBundleHash"
Write-Output 'No upload or release was performed. Review the lock diff, then upload this asset as documented.'
