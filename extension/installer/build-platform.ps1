param([ValidateSet('windows','macos','all')][string]$Platform='all',[switch]$CreatePackage,[string]$NativeBuildRoot='')
$ErrorActionPreference='Stop'
$packageRepo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
. (Join-Path $packageRepo 'native\build\LocalDependencies.ps1')
& $dependencyNode (Join-Path $packageRepo 'native\build\dependencies.cjs') verify
if($LASTEXITCODE){throw 'Dependency snapshot verification failed'}
$packageVersion=(Get-Content -LiteralPath (Join-Path $packageRepo 'extension\data\changelog.json') -Raw -Encoding UTF8 | ConvertFrom-Json).version
if($packageVersion -notmatch '^\d+\.\d+\.\d+$'){throw 'Invalid version'}
[xml]$packageManifest=Get-Content -LiteralPath (Join-Path $packageRepo 'extension\CSXS\manifest.xml') -Raw -Encoding UTF8
if($packageManifest.ExtensionManifest.ExtensionBundleVersion -ne $packageVersion){throw 'Manifest version differs'}
$packageStage=Join-Path $packageRepo ('.artifacts\package-validation\'+[guid]::NewGuid().ToString('N'))
$packagePlatforms=if($Platform -eq 'all'){@('windows','macos')}else{@($Platform)}
if(!$NativeBuildRoot){$NativeBuildRoot=Join-Path $packageRepo '.artifacts\installer-native'}
if($packagePlatforms -contains 'windows'){
    if(!(Test-Path -LiteralPath (Join-Path $NativeBuildRoot 'build-info.json'))){throw 'Build first: native/toolkit/Build.ps1 -OutputRoot .artifacts/installer-native. Do not use the loaded debug candidate.'}
    $packageRuntime=Join-Path (Get-LocalDependency 'webview2-runtime-x64') 'MicrosoftEdgeWebView2RuntimeInstallerX64.exe'
    $packageSignature=Get-AuthenticodeSignature -LiteralPath $packageRuntime
    if($packageSignature.Status -ne 'Valid' -or $packageSignature.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation'){throw 'Runtime installer must have a valid Microsoft Authenticode signature'}
}
foreach($packagePlatform in $packagePlatforms){
    $packagePlatformStage=Join-Path $packageStage $packagePlatform
    & $dependencyNode (Join-Path $PSScriptRoot 'package.cjs') $packagePlatform $packagePlatformStage $NativeBuildRoot | Out-Null
    if($LASTEXITCODE){throw "$packagePlatform staging failed"}
    if($packagePlatform -eq 'windows'){
        $packageCompiler=Join-Path (Get-LocalDependency 'nsis') 'makensis.exe'
        $packageOutput=Join-Path $PSScriptRoot ('dist\aetoolkit-v'+$packageVersion+'-windows-x64-installer.exe')
        $packageArguments=@('/INPUTCHARSET','UTF8','/WX',('/DVERSION='+$packageVersion),('/DSTAGE='+$packagePlatformStage),('/DOUTPUT_FILE='+$packageOutput),(Join-Path $PSScriptRoot 'aetoolkit-native.nsi'))
        if(!$CreatePackage){$packageArguments=@('/PPO')+$packageArguments}
        else{New-Item -ItemType Directory -Force -Path (Split-Path $packageOutput -Parent) | Out-Null}
        $packagePreprocessed=& $packageCompiler @packageArguments
        if($LASTEXITCODE){throw 'Native installer preprocessing/build failed'}
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
