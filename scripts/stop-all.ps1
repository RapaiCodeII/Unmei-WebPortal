param(
    [int]$StaticPort = 5000,
    [int]$FirebasePortStart = 5001,
    [int]$FirebasePortRange = 10
)

$ErrorActionPreference = 'Continue'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$debugLogPath = Join-Path $repoRoot 'firebase-debug.log'
$portCandidates = @($StaticPort)
for ($offset = 0; $offset -lt $FirebasePortRange; $offset++) {
    $portCandidates += ($FirebasePortStart + $offset)
}

$trackedProcesses = New-Object 'System.Collections.Generic.HashSet[int]'
try {
    # Plain `netstat -ano` (no -p tcp): the firebase hosting emulator binds the
    # IPv6 loopback ([::1]:5002), which `netstat -ano -p tcp` does not list.
    $netstatLines = netstat -ano 2>$null
    foreach ($entry in $netstatLines) {
        if ($entry -match '^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$') {
            $listenPort = [int]$matches[1]
            $ownerProcess = [int]$matches[2]
            if ($portCandidates -contains $listenPort) {
                $null = $trackedProcesses.Add($ownerProcess)
            }
        }
    }
} catch {
}

$stoppedProcesses = @()
foreach ($ownerProcess in $trackedProcesses) {
    try {
        Stop-Process -Id $ownerProcess -Force -ErrorAction Stop
        $stoppedProcesses += $ownerProcess
        Write-Host ("STOP_ALL_INFO: Stopped process=$ownerProcess via listener-port")
    } catch {
    }
}

if (Test-Path $debugLogPath) {
    Remove-Item -Path $debugLogPath -Force -ErrorAction SilentlyContinue
    Write-Host 'STOP_ALL_INFO: Removed firebase-debug.log.'
}

$finalStopped = $stoppedProcesses | Sort-Object -Unique
if (-not $finalStopped -or $finalStopped.Count -eq 0) {
    Write-Host 'STOP_ALL_PASS: No matching processes were found.'
    exit 0
}

Write-Host ("STOP_ALL_PASS: Stopped processes: " + ($finalStopped -join ', '))
exit 0
