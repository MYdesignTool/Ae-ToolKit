param([ValidateSet('Prepare','Uninstall')][string]$Action='Prepare',[Parameter(Mandatory=$true)][string]$InstallRoot,[string[]]$LegacyRoots=@(),[string]$ProductVersion='',[string]$PayloadManifest='')
$ErrorActionPreference='Stop'
function Assert-NoLinks([string]$Target){
    $installCursor=[IO.Path]::GetFullPath($Target)
    while($installCursor){
        if(Test-Path -LiteralPath $installCursor){$installItem=Get-Item -LiteralPath $installCursor -Force;if($installItem.Attributes -band [IO.FileAttributes]::ReparsePoint){throw "Refused linked path: $installCursor"}}
        $installParent=Split-Path -Parent $installCursor;if($installParent -eq $installCursor){break};$installCursor=$installParent
    }
}
function Assert-InstallRoot([string]$Target){
    $installResolved=[IO.Path]::GetFullPath($Target).TrimEnd('\','/')
    if((Split-Path -Leaf $installResolved) -cne 'AeltToolkitWebView2'){throw 'Unexpected product directory'}
    $installPluginRoot=Split-Path -Parent $installResolved
    if((Split-Path -Leaf $installPluginRoot) -cne 'Plug-ins' -or !(Test-Path -LiteralPath (Join-Path (Split-Path -Parent $installPluginRoot) 'AfterFX.exe'))){throw 'Expected a product directory inside AE Support Files/Plug-ins'}
    Assert-NoLinks $installResolved
    $installMarker=Join-Path $installResolved 'aelt-native-install.json'
    if(Test-Path -LiteralPath $installResolved){
        if(@(Get-ChildItem -LiteralPath $installResolved -Force).Count -and !(Test-Path -LiteralPath $installMarker)){throw 'Existing directory is not owned by this product'}
        if(Test-Path -LiteralPath $installMarker){$installIdentity=Get-Content -LiteralPath $installMarker -Raw -Encoding UTF8 | ConvertFrom-Json;if($installIdentity.product -cne 'org.aelocaltoolkit.webview2.toolkit'){throw 'Foreign product identity'}}
    }
    return $installResolved
}
function Copy-DataTree([string]$Source,[string]$Target){
    Assert-NoLinks $Source;Assert-NoLinks $Target
    New-Item -ItemType Directory -Force -Path $Target | Out-Null
    foreach($installFile in Get-ChildItem -LiteralPath $Source -Force){
        if($installFile.Attributes -band [IO.FileAttributes]::ReparsePoint){throw "Linked legacy data is not copied: $($installFile.FullName)"}
        $installDestination=Join-Path $Target $installFile.Name
        if($installFile.PSIsContainer){Copy-DataTree $installFile.FullName $installDestination}else{Copy-Item -LiteralPath $installFile.FullName -Destination $installDestination}
    }
}
function Read-Json([string]$File){return Get-Content -LiteralPath $File -Raw -Encoding UTF8 | ConvertFrom-Json}
function Assert-Settings($Settings){
    if(!$Settings -or $Settings -is [array] -or $Settings -isnot [pscustomobject]){throw 'Invalid settings object'}
    foreach($installKey in @('scriptFolder','compFolder','solidFolder','fallbackFolder')){if($Settings.PSObject.Properties[$installKey] -and $Settings.$installKey -isnot [string]){throw "Invalid setting: $installKey"}}
    foreach($installKey in @('scriptFavorites','userExpressions')){if($Settings.PSObject.Properties[$installKey] -and $Settings.$installKey -isnot [array]){throw "Invalid settings array: $installKey"}}
    if($Settings.PSObject.Properties['language'] -and $Settings.language -cnotin @('zh-CN','en')){throw 'Unsupported settings language'}
    foreach($installFavorite in $Settings.scriptFavorites){if($installFavorite -isnot [string]){throw 'Invalid script favorite'}}
    $installSeenExpressions=New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::Ordinal)
    foreach($installExpression in $Settings.userExpressions){
        if($installExpression.id -isnot [string] -or !$installExpression.id.StartsWith('user-') -or !$installSeenExpressions.Add($installExpression.id) -or $installExpression.name -isnot [string] -or $installExpression.code -isnot [string]){throw 'Invalid user expression'}
        if($installExpression.PSObject.Properties['tags']){if($installExpression.tags -isnot [array]){throw 'Invalid expression tags'};foreach($installTag in $installExpression.tags){if($installTag -isnot [string]){throw 'Invalid expression tag'}}}
    }
}
function Normalize-Scheme($Scheme){
    if(!$Scheme -or $Scheme.id -notmatch '^[a-zA-Z0-9_-]+$' -or $Scheme.id -ceq 'preset-default' -or $Scheme.name -isnot [string]){throw 'Invalid legacy scheme identity'}
    if(!$Scheme.PSObject.Properties['rules'] -and $Scheme.folders -is [array]){
        $installRules=@();foreach($installRule in $Scheme.folders){$installRules+= [pscustomobject]@{path=$(if($installRule.path){$installRule.path}else{$installRule.name});extensions=@($installRule.extensions | Where-Object {$null -ne $_});itemTypes=@($installRule.itemTypes | Where-Object {$null -ne $_})}}
        $Scheme | Add-Member -Force -NotePropertyName rules -NotePropertyValue $installRules
        $Scheme | Add-Member -Force -NotePropertyName fallbackPath -NotePropertyValue $(if($Scheme.fallbackFolder){$Scheme.fallbackFolder}else{'Footage'})
        $Scheme.PSObject.Properties.Remove('folders');$Scheme.PSObject.Properties.Remove('fallbackFolder')
    }
    if($Scheme.rules -isnot [array]){throw 'Invalid legacy scheme rules'}
    foreach($installRule in $Scheme.rules){if($installRule.path -isnot [string] -or !$installRule.path -or $installRule.extensions -isnot [array] -or $installRule.itemTypes -isnot [array]){throw 'Invalid legacy rule'}}
    return $Scheme
}
function Read-LegacyDocument([string]$Source){
    $installData=Join-Path $Source 'data'
    $installCanonical=Join-Path $installData 'user-data.json'
    $installHasCanonical=$false;$installLastError=$null
    foreach($installCandidate in @($installCanonical,($installCanonical+'.bak'))){
        if(!(Test-Path -LiteralPath $installCandidate)){continue};$installHasCanonical=$true
        try{$installDocument=Read-Json $installCandidate
            if($installDocument.format -cne 'ae-local-toolkit' -or $installDocument.version -ne 1 -or $installDocument.schemes -isnot [array]){throw 'Invalid data format'}
            Assert-Settings $installDocument.settings
            $installSeenSchemes=New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::Ordinal)
            foreach($installScheme in $installDocument.schemes){$null=Normalize-Scheme $installScheme;if(!$installSeenSchemes.Add($installScheme.id)){throw 'Duplicate legacy scheme ID'}}
            return $installDocument
        }catch{$installLastError=$_}
    }
    if($installHasCanonical){throw "No valid canonical legacy document: $installLastError"}
    $installSettingsFile=Join-Path $installData 'settings.json';$installSettings=$null;$installHasSettings=$false
    foreach($installCandidate in @($installSettingsFile,($installSettingsFile+'.bak'))){if(!(Test-Path -LiteralPath $installCandidate)){continue};$installHasSettings=$true;try{$installSettings=Read-Json $installCandidate;Assert-Settings $installSettings;break}catch{$installSettings=$null}}
    if(!$installHasSettings){return $null};if(!$installSettings){throw 'No valid legacy settings or backup'}
    $installSchemes=@();$installSchemesRoot=Join-Path $installData 'organizer-schemes'
    if(Test-Path -LiteralPath $installSchemesRoot){
        $installNames=@(Get-ChildItem -LiteralPath $installSchemesRoot -File | Where-Object {$_.Name -match '\.json(\.bak)?$'} | ForEach-Object {$_.Name -replace '\.bak$',''} | Sort-Object -Unique)
        foreach($installName in $installNames){$installValidScheme=$null;foreach($installCandidate in @((Join-Path $installSchemesRoot $installName),(Join-Path $installSchemesRoot ($installName+'.bak')))){if(!(Test-Path -LiteralPath $installCandidate)){continue};try{$installValidScheme=Normalize-Scheme (Read-Json $installCandidate);break}catch{$installValidScheme=$null}};if(!$installValidScheme){throw 'No valid legacy scheme or backup'};$installSchemes+=$installValidScheme}
    }
    return [pscustomobject]@{format='ae-local-toolkit';version=1;settings=$installSettings;schemes=$installSchemes}
}
function Rebase-Path([string]$Value,[string]$Source){
    if(!$Value.StartsWith('./')){return $Value}
    $installSourceRoot=[IO.Path]::GetFullPath($Source).TrimEnd('\','/')
    $installRebased=[IO.Path]::GetFullPath((Join-Path $installSourceRoot $Value.Substring(2)))
    if($installRebased -ine $installSourceRoot -and !$installRebased.StartsWith($installSourceRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Portable path escapes its legacy root'}
    return $installRebased
}
function Legacy-Candidates{
    if($LegacyRoots.Count){return $LegacyRoots}
    $installRoots=@((Join-Path $env:APPDATA 'Adobe\CEP\extensions\AeLocalToolkit'),(Join-Path ${env:CommonProgramFiles(x86)} 'Adobe\CEP\extensions\AeLocalToolkit'),(Join-Path $env:CommonProgramFiles 'Adobe\CEP\extensions\AeLocalToolkit'))
    foreach($installRegistry in @('HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\AE Local Toolkit','HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\AE Local Toolkit','HKLM:\Software\AE Local Toolkit','HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\AE Local Toolkit')){
        $installRecord=Get-ItemProperty -LiteralPath $installRegistry -ErrorAction SilentlyContinue
        if($installRecord){if($installRecord.InstallLocation){$installRoots+=$installRecord.InstallLocation};if($installRecord.InstallDir){$installRoots+=$installRecord.InstallDir}}
    }
    return @($installRoots | Select-Object -Unique)
}
function Prepare-Installation([string]$Target){
    if($ProductVersion -notmatch '^\d+\.\d+\.\d+$'){throw 'ProductVersion must come from the changelog'}
    $installTarget=Assert-InstallRoot $Target
    if($PayloadManifest){
        $installPlan=Read-Json $PayloadManifest
        if($installPlan.product -cne 'org.aelocaltoolkit.webview2.toolkit' -or $installPlan.version -cne $ProductVersion -or $installPlan.writePaths -isnot [array]){throw 'Invalid program write plan'}
        foreach($installRelative in $installPlan.writePaths){
            if($installRelative -isnot [string] -or $installRelative -notmatch '^(AeltToolkitWebView2\.aex|Manage-Installation\.ps1|aelt-native-install\.json|installed-files\.json|uninstall\.exe|licenses/[^:]+|extension/(client|host|CSXS)/[^:]+|extension/(README|License)\.md|extension/data/(settings\.default|organizer-rules|default-expressions|changelog)\.json)$' -or $installRelative -match '(^|/)\.\.?(/|$)|\\'){throw 'Unsafe program write path'}
            $installDestination=[IO.Path]::GetFullPath((Join-Path $installTarget $installRelative))
            if(!$installDestination.StartsWith($installTarget+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Program write escaped product scope'}
            Assert-NoLinks $installDestination
        }
    }
    New-Item -ItemType Directory -Force -Path $installTarget | Out-Null
    if(!(Test-Path -LiteralPath (Join-Path $installTarget 'aelt-native-install.json'))){[IO.File]::WriteAllText((Join-Path $installTarget 'aelt-native-install.json'),(@{product='org.aelocaltoolkit.webview2.toolkit';version=$ProductVersion} | ConvertTo-Json),[Text.UTF8Encoding]::new($false))}
    $installData=Join-Path $installTarget 'extension\data';Assert-NoLinks $installData
    $installStamp=[DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N')
    if(Test-Path -LiteralPath $installData){Copy-DataTree $installData (Join-Path $installTarget ('backups\before-'+$installStamp))}
    # Even damaged native data is authoritative. Never replace it with old CEP.
    foreach($installOwned in @('user-data.json','user-data.json.bak','settings.json','settings.json.bak','organizer-schemes')){if(Test-Path -LiteralPath (Join-Path $installData $installOwned)){return 'Existing native data retained and backed up'}}
    foreach($installSource in Legacy-Candidates){
        $installManifest=Join-Path $installSource 'CSXS\manifest.xml'
        if(!(Test-Path -LiteralPath $installManifest)){continue}
        $installXml=New-Object System.Xml.XmlDocument;$installXml.XmlResolver=$null
        $installXml.Load($installManifest)
        if($installXml.DocumentElement.GetAttribute('ExtensionBundleId') -cne 'com.local.aetoolkit'){continue}
        $installDocument=Read-LegacyDocument $installSource
        if(!$installDocument){continue}
        if($installDocument.settings.scriptFolder){$installDocument.settings.scriptFolder=Rebase-Path $installDocument.settings.scriptFolder $installSource}
        if($installDocument.settings.scriptFavorites){$installDocument.settings.scriptFavorites=@($installDocument.settings.scriptFavorites | ForEach-Object {Rebase-Path $_ $installSource})}
        Copy-DataTree (Join-Path $installSource 'data') (Join-Path $installTarget ('backups\cep-source-'+$installStamp))
        New-Item -ItemType Directory -Force -Path $installData | Out-Null
        $installTemp=Join-Path $installData ('migration-'+[guid]::NewGuid().ToString('N')+'.tmp')
        [IO.File]::WriteAllText($installTemp,($installDocument | ConvertTo-Json -Depth 100),[Text.UTF8Encoding]::new($false))
        [IO.File]::Move($installTemp,(Join-Path $installData 'user-data.json'))
        return 'Legacy CEP data copied; source and scripts retained'
    }
    return 'Clean install; no legacy personal data found'
}
function Remove-InstalledFiles([string]$Target){
    $installTarget=Assert-InstallRoot $Target
    $installManifest=Read-Json (Join-Path $installTarget 'installed-files.json')
    if($installManifest.product -cne 'org.aelocaltoolkit.webview2.toolkit' -or $installManifest.files -isnot [array]){throw 'Invalid installed file manifest'}
    $installRemovable=@();$installDirs=@()
    foreach($installRow in $installManifest.files){
        if($installRow.path -notmatch '^(AeltToolkitWebView2\.aex|Manage-Installation\.ps1|licenses/[^:]+|extension/(client|host|CSXS)/[^:]+|extension/(README|License)\.md)$' -or $installRow.path -match '(^|/)\.\.?(/|$)' -or $installRow.path -match '\\' -or $installRow.sha256 -notmatch '^[a-f0-9]{64}$'){throw 'Unsafe installed file entry'}
        $installFile=[IO.Path]::GetFullPath((Join-Path $installTarget $installRow.path))
        if(!$installFile.StartsWith($installTarget+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Uninstall path escaped product scope'}
        Assert-NoLinks $installFile
        if(Test-Path -LiteralPath $installFile -PathType Leaf){if((Get-FileHash -LiteralPath $installFile -Algorithm SHA256).Hash.ToLowerInvariant() -eq $installRow.sha256){$installRemovable+=$installFile;$installDirs+=Split-Path -Parent $installFile}}
    }
    # Validate every target before deleting any. Modified files and unknown scripts stay.
    foreach($installFile in $installRemovable){Remove-Item -LiteralPath $installFile -Force}
    foreach($installDir in @($installDirs | Sort-Object Length -Descending -Unique)){
        $installCursor=$installDir
        while($installCursor -ine $installTarget -and $installCursor.StartsWith($installTarget+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){
            if((Test-Path -LiteralPath $installCursor) -and @(Get-ChildItem -LiteralPath $installCursor -Force).Count -eq 0){Remove-Item -LiteralPath $installCursor -Force}else{break};$installCursor=Split-Path -Parent $installCursor
        }
    }
    return 'Only unchanged installed program files removed; data, scripts and identity retained'
}
try{if($Action -eq 'Prepare'){Prepare-Installation $InstallRoot}else{Remove-InstalledFiles $InstallRoot};exit 0}catch{Write-Error $_;exit 1}
