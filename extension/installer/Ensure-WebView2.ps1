param()
$ErrorActionPreference='Stop'

function Read-WebView2Versions {
    $subkey='Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
    foreach($location in @(@([Microsoft.Win32.RegistryHive]::LocalMachine,[Microsoft.Win32.RegistryView]::Registry32),@([Microsoft.Win32.RegistryHive]::CurrentUser,[Microsoft.Win32.RegistryView]::Registry64))){
        $base=$null;$key=$null
        try{$base=[Microsoft.Win32.RegistryKey]::OpenBaseKey($location[0],$location[1]);$key=$base.OpenSubKey($subkey);if($key){$key.GetValue('pv')}}catch{continue}finally{if($key){$key.Dispose()};if($base){$base.Dispose()}}
    }
}
function Get-WebView2Version {
    foreach($value in @(Read-WebView2Versions)){
        $version=$null
        if([version]::TryParse([string]$value,[ref]$version) -and $version -gt [version]'0.0.0.0'){return $version.ToString()}
    }
    return $null
}
function Save-WebView2Bootstrapper([string]$Uri,[string]$Destination){
    [Net.ServicePointManager]::SecurityProtocol=[Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    $ProgressPreference='SilentlyContinue'
    Invoke-WebRequest -UseBasicParsing -Uri $Uri -OutFile $Destination -TimeoutSec 120
}
function Assert-MicrosoftBootstrapper([string]$Path){
    $signature=Get-AuthenticodeSignature -LiteralPath $Path
    if($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch '(?:^|,\s*)O=Microsoft Corporation(?:,|$)'){throw 'The WebView2 bootstrapper must have a valid Microsoft signature.'}
}
function Start-WebView2Bootstrapper([string]$Path){
    $process=Start-Process -FilePath $Path -ArgumentList '/silent','/install' -WindowStyle Hidden -PassThru
    try{
        if(!$process.WaitForExit(600000)){throw 'WebView2 installation timed out. Check the network and retry.'}
        return $process.ExitCode
    }finally{$process.Dispose()}
}
function Ensure-WebView2Runtime([string]$WorkDirectory=$PSScriptRoot){
    $version=Get-WebView2Version
    if($version){Write-Output "WebView2 Runtime already installed ($version); no download needed.";return}
    $policy=Get-Content -LiteralPath (Join-Path $WorkDirectory 'webview2-bootstrapper.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if($policy.mode -cne 'evergreen-online' -or $policy.url -cne 'https://go.microsoft.com/fwlink/p/?LinkId=2124703'){throw 'Unexpected WebView2 bootstrapper policy.'}
    $bootstrapper=Join-Path $WorkDirectory 'MicrosoftEdgeWebview2Setup.exe'
    try{
        Write-Output 'WebView2 Runtime is missing. Downloading the Microsoft installer; internet access is required.'
        Save-WebView2Bootstrapper $policy.url $bootstrapper
        Assert-MicrosoftBootstrapper $bootstrapper
        $exitCode=Start-WebView2Bootstrapper $bootstrapper
        if($exitCode -ne 0 -and $exitCode -ne 3010){throw "Microsoft WebView2 installation failed ($exitCode)."}
        $version=Get-WebView2Version
        if(!$version){throw 'WebView2 Runtime is still unavailable after installation.'}
        Write-Output "WebView2 Runtime installed ($version)."
    }finally{if(Test-Path -LiteralPath $bootstrapper -PathType Leaf){Remove-Item -LiteralPath $bootstrapper -Force -ErrorAction SilentlyContinue}}
}
if($MyInvocation.InvocationName -ne '.'){
    try{Ensure-WebView2Runtime;exit 0}catch{Write-Output $_.Exception.Message;exit 1}
}
