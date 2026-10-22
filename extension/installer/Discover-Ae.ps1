param([string]$OutputFile='')
$ErrorActionPreference='Stop'

function Read-AeRegistryPaths {
    foreach($hive in @([Microsoft.Win32.RegistryHive]::LocalMachine,[Microsoft.Win32.RegistryHive]::CurrentUser)){
        foreach($view in @([Microsoft.Win32.RegistryView]::Registry64,[Microsoft.Win32.RegistryView]::Registry32)){
            $base=$null
            try{
                $base=[Microsoft.Win32.RegistryKey]::OpenBaseKey($hive,$view)
                foreach($branch in @('Software\Adobe\After Effects','Software\Microsoft\Windows\CurrentVersion\Uninstall')){
                    $root=$null
                    try{
                        $root=$base.OpenSubKey($branch)
                        if(!$root){continue}
                        foreach($name in $root.GetSubKeyNames()){
                            $key=$null
                            try{
                                $key=$root.OpenSubKey($name)
                                if(!$key){continue}
                                if($branch.EndsWith('Uninstall') -and [string]$key.GetValue('DisplayName') -notmatch '^Adobe\s+After\s+Effects\b'){continue}
                                foreach($valueName in @('InstallPath','InstallLocation','Path')){if($key.GetValue($valueName)){[string]$key.GetValue($valueName)}}
                            }catch{continue}finally{if($key){$key.Dispose()}}
                        }
                    }finally{if($root){$root.Dispose()}}
                }
                $app=$null
                try{$app=$base.OpenSubKey('Software\Microsoft\Windows\CurrentVersion\App Paths\AfterFX.exe');if($app){[string]$app.GetValue('')}}finally{if($app){$app.Dispose()}}
            }catch{continue}finally{if($base){$base.Dispose()}}
        }
    }
}
function Read-AeDefaultPaths {
    foreach($programFiles in @($env:ProgramFiles,${env:ProgramFiles(x86)})){
        if(!$programFiles){continue}
        $adobe=Join-Path $programFiles 'Adobe'
        if(Test-Path -LiteralPath $adobe -PathType Container){Get-ChildItem -LiteralPath $adobe -Directory -Filter 'Adobe After Effects*' -ErrorAction SilentlyContinue | ForEach-Object {$_.FullName}}
    }
}
function Resolve-AeSupportFiles([string]$Candidate){
    if([string]::IsNullOrWhiteSpace($Candidate) -or $Candidate -match '[\r\n]'){return}
    try{
        $path=[IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables($Candidate.Trim().Trim('"')))
        if([IO.Path]::GetFileName($path) -ieq 'AfterFX.exe'){$path=[IO.Path]::GetDirectoryName($path)}
        if(!(Test-Path -LiteralPath (Join-Path $path 'AfterFX.exe') -PathType Leaf)){$path=Join-Path $path 'Support Files'}
        if(Test-Path -LiteralPath (Join-Path $path 'AfterFX.exe') -PathType Leaf){return (Get-Item -LiteralPath $path).FullName.TrimEnd('\')}
    }catch{return}
}
function Get-AeInstallations([string[]]$Candidates=@()){
    if(!$Candidates.Count){$Candidates=@(Read-AeRegistryPaths)+@(Read-AeDefaultPaths)}
    $seen=New-Object 'Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    $installations=@(foreach($candidate in $Candidates){
        $support=Resolve-AeSupportFiles $candidate
        if(!$support -or !$seen.Add($support)){continue}
        $version=(Get-Item -LiteralPath (Join-Path $support 'AfterFX.exe')).VersionInfo
        if($version.FileMajorPart -gt 0 -and $version.FileMajorPart -lt 23){continue}
        $name=[IO.Path]::GetFileName([IO.Path]::GetDirectoryName($support))
        if($version.FileMajorPart -ge 23){$name="Adobe After Effects $($version.FileMajorPart+2000) ($($version.FileVersion))"}
        [pscustomobject]@{Name=($name -replace '[\r\n]',' ');Path=$support;Major=$version.FileMajorPart}
    })
    @($installations | Sort-Object @{Expression='Major';Descending=$true},@{Expression='Name';Descending=$true},Path)
}
function Write-AeInstallations([string]$Path,$Installations){
    $lines=New-Object 'Collections.Generic.List[string]'
    $lines.Add('[versions]');$lines.Add('count='+$Installations.Count)
    for($index=0;$index -lt $Installations.Count;$index++){$lines.Add('[ae'+$index+']');$lines.Add('name='+$Installations[$index].Name);$lines.Add('path='+$Installations[$index].Path)}
    [IO.File]::WriteAllLines($Path,$lines,[Text.Encoding]::Unicode)
}
if($MyInvocation.InvocationName -ne '.'){
    try{if(!$OutputFile){throw 'An output file is required.'};Write-AeInstallations $OutputFile @(Get-AeInstallations);exit 0}catch{Write-Output $_.Exception.Message;exit 1}
}
