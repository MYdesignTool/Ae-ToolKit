// Execute the production PowerShell helpers with isolated registry/network/process providers.
// Never installs or removes the shared WebView2 Runtime, and never changes AE registrations.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {root}=require('./helpers.cjs');
if(process.platform!=='win32')throw Error('Run prerequisite integration checks on Windows');
const fixture=path.join(root,'.artifacts','installer-prerequisites-'+crypto.randomUUID());fs.mkdirSync(fixture,{recursive:true});
const ae2023=path.join(fixture,'Adobe After Effects 2023','Support Files'),ae2025=path.join(fixture,'中文目录','Adobe After Effects 2025','Support Files');
for(const support of [ae2023,ae2025]){fs.mkdirSync(support,{recursive:true});fs.writeFileSync(path.join(support,'AfterFX.exe'),'fixture marker, never execute');}
fs.writeFileSync(path.join(fixture,'test.json'),JSON.stringify({root:fixture,source:path.join(root,'extension/installer'),ae2023,ae2025,policy:require('../scripts/release/verify-inputs.cjs').inputs().runtime}));
const script=String.raw`
$ErrorActionPreference='Stop'
$fixture=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'test.json') -Raw -Encoding UTF8|ConvertFrom-Json
. (Join-Path $fixture.source 'Ensure-WebView2.ps1')
function Assert($condition,$message){if(!$condition){throw $message}}
function Expect-Failure([scriptblock]$run,[string]$message){$failed=$false;try{& $run|Out-Null}catch{$failed=$true};Assert $failed $message}
$realSignatureCheck=(Get-Command Assert-MicrosoftBootstrapper).ScriptBlock
$script:versions=@('0.0.0.0','broken','145.0.1.2')
function Read-WebView2Versions { $script:versions }
Assert ((Get-WebView2Version) -eq '145.0.1.2') 'Per-user fallback was not detected'
$script:versions=@('','broken','0.0.0.0')
Assert (!(Get-WebView2Version)) 'Invalid or zero version must count as missing'
function Save-WebView2Bootstrapper { throw 'Installed runtime must never download' }
$script:versions=@('145.0.1.2')
Ensure-WebView2Runtime $fixture.root
$fixture.policy|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $fixture.root 'webview2-bootstrapper.json') -Encoding UTF8
$script:events=New-Object 'Collections.Generic.List[string]'
$script:versions=@()
$script:exitCode=0;$script:register=$true;$script:downloadFails=$false;$script:signatureFails=$false
function Save-WebView2Bootstrapper([string]$Uri,[string]$Destination){$script:events.Add('download');if($script:downloadFails){throw 'Network unavailable'};[IO.File]::WriteAllText($Destination,'unsigned fixture, never execute')}
function Assert-MicrosoftBootstrapper([string]$Path){$script:events.Add('signature');if($script:signatureFails){& $realSignatureCheck $Path}}
function Start-WebView2Bootstrapper([string]$Path){$script:events.Add('install');if($script:register){$script:versions=@('145.0.1.2')};return $script:exitCode}
Ensure-WebView2Runtime $fixture.root
Assert (($script:events -join ',') -eq 'download,signature,install') 'Download/signature/install order incorrect'
Assert (!(Test-Path -LiteralPath (Join-Path $fixture.root 'MicrosoftEdgeWebview2Setup.exe'))) 'Bootstrapper was not cleaned up'
$script:versions=@();$script:events.Clear();$script:downloadFails=$true
Expect-Failure {Ensure-WebView2Runtime $fixture.root} 'Network failure must stop setup'
Assert (($script:events -join ',') -eq 'download') 'Installation ran after download failure'
$script:downloadFails=$false;$script:signatureFails=$true;$script:events.Clear()
Expect-Failure {Ensure-WebView2Runtime $fixture.root} 'Unsigned download must be rejected'
Assert (($script:events -join ',') -eq 'download,signature') 'Unsigned executable was started'
$script:signatureFails=$false;$script:exitCode=1
Expect-Failure {Ensure-WebView2Runtime $fixture.root} 'Installer error must stop setup'
$script:versions=@();$script:exitCode=0;$script:register=$false
Expect-Failure {Ensure-WebView2Runtime $fixture.root} 'Missing runtime after successful exit must fail'
$script:versions=@();$script:exitCode=3010;$script:register=$true
Ensure-WebView2Runtime $fixture.root
$script:versions=@();$script:events.Clear();$fixture.policy.url='https://example.test/untrusted.exe'
$fixture.policy|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $fixture.root 'webview2-bootstrapper.json') -Encoding UTF8
Expect-Failure {Ensure-WebView2Runtime $fixture.root} 'Non-Microsoft URL must be rejected'
Assert ($script:events.Count -eq 0) 'Untrusted URL reached the downloader'
. (Join-Path $fixture.source 'Discover-Ae.ps1')
function Read-AeRegistryPaths { @([IO.Path]::GetDirectoryName($fixture.ae2023),(Join-Path $fixture.ae2025 'AfterFX.exe'),$fixture.ae2023.ToUpperInvariant(),(Join-Path $fixture.root 'stale installation')) }
function Read-AeDefaultPaths { @($fixture.ae2025) }
$found=@(Get-AeInstallations)
Assert ($found.Count -eq 2) 'Discovery must deduplicate real paths and reject stale paths'
Assert (@($found|Where-Object Path -eq $fixture.ae2023).Count -eq 1) 'Nonstandard registered AE path missing'
Assert (@($found|Where-Object Path -eq $fixture.ae2025).Count -eq 1) 'Unicode AE path missing'
Assert (!(Resolve-AeSupportFiles ('bad'+[char]10+'path'))) 'INI injection path must be rejected'
Write-AeInstallations (Join-Path $fixture.root 'ae.ini') $found
$ini=[IO.File]::ReadAllText((Join-Path $fixture.root 'ae.ini'),[Text.Encoding]::Unicode)
Assert ($ini.Contains('count=2') -and $ini.Contains($fixture.ae2025)) 'Unicode NSIS discovery output incorrect'
function Read-AeRegistryPaths { @() };function Read-AeDefaultPaths { @() }
$empty=@(Get-AeInstallations)
Assert ($empty.Count -eq 0) 'Empty device should leave only the custom-path option'
Write-AeInstallations (Join-Path $fixture.root 'empty.ini') $empty
Assert ([IO.File]::ReadAllText((Join-Path $fixture.root 'empty.ini'),[Text.Encoding]::Unicode).Contains('count=0')) 'Empty discovery output incorrect'
Write-Output 'PASS: installed/missing Runtime, signed-before-execute, network/signature/setup failures, recheck, reboot code, AE discovery, deduplication, stale paths, Unicode and custom-path fallback.'
`;
const testPath=path.join(fixture,'test.ps1');fs.writeFileSync(testPath,script);
const env={...process.env,PSModulePath:path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/Modules')};
const result=cp.spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',testPath],{env,cwd:root,windowsHide:true,encoding:'utf8',timeout:60000,maxBuffer:2*1024*1024});
if(result.error)throw result.error;assert.equal(result.status,0,result.stdout+'\n'+result.stderr);console.log(result.stdout.trim());
