# Dot-source for fixed project-local paths. No discovery in other checkouts.
$dependencyRepo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$dependencyBase=Join-Path $dependencyRepo '.local-deps'
$dependencyNode=Join-Path $dependencyBase 'node\node.exe'
if(!(Test-Path -LiteralPath $dependencyNode)){throw 'Project-local dependencies are missing. See native/build/README.md.'}
$dependencyLock=Get-Content -LiteralPath (Join-Path $dependencyRepo 'native\dependencies.lock.json') -Raw | ConvertFrom-Json
function Get-LocalDependency([string]$Id){
    $dependencyEntry=@($dependencyLock.components | Where-Object {$_.id -eq $Id})
    if($dependencyEntry.Count -ne 1){throw "Missing dependency lock: $Id"}
    return Join-Path $dependencyBase $dependencyEntry[0].directory
}
