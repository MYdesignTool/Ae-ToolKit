param([ValidateSet('windows','macos','all')][string]$Platform='all',[switch]$CreatePackage,[string]$NativeBuildRoot='',[string]$CiInputsRoot='')
$ErrorActionPreference='Stop'
$packageRepo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
if($CiInputsRoot){
    $dependencyNode=(Get-Command node.exe -ErrorAction Stop).Source
    $packageCi=Get-Content -LiteralPath (Join-Path $CiInputsRoot 'paths.json') -Raw | ConvertFrom-Json
    $NativeBuildRoot=$packageCi.nativeRoot
    $packageCompiler=$packageCi.nsisCompiler
    & $dependencyNode (Join-Path $packageRepo 'scripts/release/verify-inputs.cjs') native $NativeBuildRoot
    if($LASTEXITCODE){throw 'Controlled CI native input verification failed'}
}else{
    . (Join-Path $packageRepo 'native\build\LocalDependencies.ps1')
    & $dependencyNode (Join-Path $packageRepo 'native\build\dependencies.cjs') verify 'node,nsis'
    if($LASTEXITCODE){throw 'Dependency snapshot verification failed'}
    $packageCompiler=Join-Path (Get-LocalDependency 'nsis') 'makensis.exe'
}
$packageVersion=(Get-Content -LiteralPath (Join-Path $packageRepo 'extension\data\changelog.json') -Raw -Encoding UTF8 | ConvertFrom-Json).version
if($packageVersion -notmatch '^\d+\.\d+\.\d+$'){throw 'Invalid version'}
[xml]$packageManifest=Get-Content -LiteralPath (Join-Path $packageRepo 'extension\CSXS\manifest.xml') -Raw -Encoding UTF8
if($packageManifest.ExtensionManifest.ExtensionBundleVersion -ne $packageVersion){throw 'Manifest version differs'}
$packageStage=Join-Path $packageRepo ('.artifacts\package-validation\'+[guid]::NewGuid().ToString('N'))
$packagePlatforms=if($Platform -eq 'all'){@('windows','macos')}else{@($Platform)}
if(!$NativeBuildRoot){$NativeBuildRoot=Join-Path $packageRepo '.artifacts\installer-native'}
if($packagePlatforms -contains 'windows'){
    if(!(Test-Path -LiteralPath (Join-Path $NativeBuildRoot 'build-info.json'))){throw 'Build first: native/toolkit/Build.ps1 -OutputRoot .artifacts/installer-native. Do not use the loaded debug candidate.'}
    $packageNativeVersion=(Get-Item -LiteralPath (Join-Path $NativeBuildRoot 'bin/AeltToolkitWebView2.aex')).VersionInfo
    if($packageNativeVersion.ProductVersion -cne $packageVersion -or $packageNativeVersion.FileVersion -cne ($packageVersion+'.0')){throw 'AEX PE version differs from changelog; rebuild the native candidate'}
}
foreach($packagePlatform in $packagePlatforms){
    $packagePlatformStage=Join-Path $packageStage $packagePlatform
    & $dependencyNode (Join-Path $PSScriptRoot 'package.cjs') $packagePlatform $packagePlatformStage $NativeBuildRoot | Out-Null
    if($LASTEXITCODE){throw "$packagePlatform staging failed"}
    if($packagePlatform -eq 'windows'){
        $packageOutput=Join-Path $PSScriptRoot ('dist\aetoolkit-v'+$packageVersion+'-windows-x64-installer.exe')
        $packageArguments=@('/INPUTCHARSET','UTF8','/WX',('/DVERSION='+$packageVersion),('/DSTAGE='+$packagePlatformStage),('/DOUTPUT_FILE='+$packageOutput),(Join-Path $PSScriptRoot 'aetoolkit-native.nsi'))
        if(!$CreatePackage){$packageArguments=@('/PPO')+$packageArguments}
        else{New-Item -ItemType Directory -Force -Path (Split-Path $packageOutput -Parent) | Out-Null}
        $packagePreprocessed=& $packageCompiler @packageArguments
        if($LASTEXITCODE){$packagePreprocessed | Write-Output;throw 'Native installer preprocessing/build failed'}
        if($CreatePackage){$packageExe=Get-Item -LiteralPath $packageOutput;$packageExeVersion=$packageExe.VersionInfo;if($packageExeVersion.FileVersion -cne ($packageVersion+'.0') -or $packageExeVersion.ProductVersion -cne $packageVersion){throw 'NSIS file/product version resource differs from changelog'};if($packageExe.Length -gt 10MB){throw 'Lightweight installer exceeded 10 MiB; check for accidentally bundled runtime/development files'}}
        if(!$CreatePackage){$packagePreprocessed | Set-Content (Join-Path $packagePlatformStage 'installer-preprocessed.nsi') -Encoding utf8}
    }elseif($CreatePackage){
        $packageOutput=Join-Path $PSScriptRoot ('dist\aetoolkit-v'+$packageVersion+'-macos-cep.zip')
        New-Item -ItemType Directory -Force -Path (Split-Path $packageOutput -Parent) | Out-Null
        Compress-Archive -LiteralPath (Join-Path $packagePlatformStage 'AeLocalToolkit') -DestinationPath $packageOutput -Force
    }
    if($CreatePackage){Get-FileHash -LiteralPath $packageOutput -Algorithm SHA256}
}
Write-Output "Validated separate platform payloads: $packageStage"
if(!$CreatePackage){Write-Output 'Validation only: no installer or ZIP was generated. -CreatePackage is the explicit packaging step.'}
