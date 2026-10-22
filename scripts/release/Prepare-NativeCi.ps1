param([string]$OutputRoot='.artifacts/ci-compile',[string]$PrivateArchive='',[string]$CachedWebView2Zip='',[string]$CompilerRoot='',[string]$WindowsSdkRoot='')
$ErrorActionPreference='Stop'
$compileRepo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$compileRoot=[IO.Path]::GetFullPath((Join-Path $compileRepo $OutputRoot))
if(!$compileRoot.StartsWith((Join-Path $compileRepo '.artifacts')+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $compileRoot)){throw 'Use a fresh workspace .artifacts compile input directory'}
$compileLock=Get-Content -LiteralPath (Join-Path $compileRepo 'native/ci-dependencies.json') -Raw|ConvertFrom-Json
New-Item -ItemType Directory -Force -Path $compileRoot|Out-Null
$compileAdobe=Join-Path $compileRoot 'adobe-sdk'
try{
 if($PrivateArchive){
  $encoded=[Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $PrivateArchive).Path))
  for($i=1;$i -le $compileLock.adobe.parts;$i++){$start=($i-1)*$compileLock.adobe.partCharacters;$length=[Math]::Min($compileLock.adobe.partCharacters,$encoded.Length-$start);[Environment]::SetEnvironmentVariable(('AELT_AE_SDK_PART_'+$i.ToString('00')),$encoded.Substring($start,$length),'Process')}
 }
 & node (Join-Path $compileRepo 'native/build/ae-sdk-secrets.cjs') restore $compileAdobe
 if($LASTEXITCODE){throw 'Private Adobe SDK restore failed'}
}finally{for($i=1;$i -le 8;$i++){[Environment]::SetEnvironmentVariable(('AELT_AE_SDK_PART_'+$i.ToString('00')),$null,'Process')};$encoded=$null}
$compileZip=Join-Path $compileRoot 'webview2.zip'
if($CachedWebView2Zip){Copy-Item -LiteralPath $CachedWebView2Zip -Destination $compileZip}else{Invoke-WebRequest -Uri $compileLock.webview2.url -OutFile $compileZip -TimeoutSec 180}
if((Get-FileHash -LiteralPath $compileZip).Hash.ToLowerInvariant() -cne $compileLock.webview2.sha256){throw 'WebView2 NuGet SHA-256 mismatch'}
$archive=[IO.Compression.ZipFile]::OpenRead($compileZip)
try{foreach($entry in $archive.Entries){$name=$entry.FullName.Replace('\','/');if($name.StartsWith('/') -or $name.Contains(':') -or $name.Split('/') -contains '..'){throw 'Invalid NuGet archive path'}}}finally{$archive.Dispose()}
$compileWebView=Join-Path $compileRoot 'webview2'
Expand-Archive -LiteralPath $compileZip -DestinationPath $compileWebView
if(!$CompilerRoot){
 $vswhere=Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/Installer/vswhere.exe'
 $major=$compileLock.toolchain.visualStudioMajor
 $installation=& $vswhere -latest -products '*' -version "[$major.0,$($major+1).0)" -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
 if($LASTEXITCODE -or !$installation){throw 'Required hosted Visual Studio C++ toolchain unavailable'}
 $toolset=(Get-Content -LiteralPath (Join-Path $installation 'VC/Auxiliary/Build/Microsoft.VCToolsVersion.default.txt') -Raw).Trim()
 $CompilerRoot=Join-Path $installation ('VC/Tools/MSVC/'+$toolset)
}
if(!$WindowsSdkRoot){$WindowsSdkRoot=Join-Path ${env:ProgramFiles(x86)} 'Windows Kits/10'}
$sdkVersion=$compileLock.toolchain.windowsSdkVersion
foreach($required in @((Join-Path $CompilerRoot 'bin/Hostx64/x64/cl.exe'),(Join-Path $WindowsSdkRoot "bin/$sdkVersion/x64/rc.exe"),(Join-Path $compileWebView 'build/native/x64/WebView2LoaderStatic.lib'))){if(!(Test-Path -LiteralPath $required)){throw 'Required native compiler/SDK input missing'}}
@{adobeRoot=$compileAdobe;webview2Root=$compileWebView;compilerRoot=$CompilerRoot;windowsSdkRoot=$WindowsSdkRoot;windowsSdkVersion=$sdkVersion}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $compileRoot 'paths.json') -Encoding utf8
Write-Output 'Native SDK inputs verified; hosted toolchain selected.'
