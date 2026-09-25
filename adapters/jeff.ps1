param(
    [string]$Workspace = (Join-Path $env:USERPROFILE 'My Drive\Shared Cognition\BIS-Cognition'),
    [string]$Server = 'http://localhost:4310',
    [string]$PairCode
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$workspacePath = (Resolve-Path -LiteralPath $Workspace).Path
$personalFolder = Join-Path $workspacePath 'Personal-Cognition'
if ((Split-Path $workspacePath -Leaf) -ieq 'Personal-Cognition' -or
    (Test-Path -LiteralPath $personalFolder -PathType Container)) {
    throw 'Select BIS-Cognition as the workspace, not Shared Cognition or Personal-Cognition.'
}

$env:CREW_HANDLER = Join-Path $PSScriptRoot 'hermes.mjs'
$env:CREW_HERMES_WORKSPACE = $workspacePath
$env:CREW_HERMES_PROFILE = 'jeff'
$env:CREW_RUNTIME_ID = 'hermes-jeff'
$env:CREW_ADAPTER_CONFIG = Join-Path $repoRoot 'data\adapter-jeff.json'
$adapterCli = Join-Path $PSScriptRoot 'cli.mjs'

if ($PairCode) {
    & node $adapterCli pair $Server jeff $PairCode
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
if (-not (Test-Path -LiteralPath $env:CREW_ADAPTER_CONFIG -PathType Leaf)) {
    throw "Jeff is not paired. Generate a code in Jeff > Connection, then run .\adapters\jeff.ps1 -PairCode 'ONE_TIME_CODE'."
}
& node $adapterCli run
exit $LASTEXITCODE
