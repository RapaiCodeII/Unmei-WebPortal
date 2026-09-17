param(
    [int]$StaticPort = 5000,
    [int]$FirebasePort = 5002,
    [switch]$OpenUrls,
    [switch]$StaticOnly,             # run the plain static server only (legacy mode)
    [switch]$ForceNoFirebase,        # alias of -StaticOnly (backward compatible)
    [switch]$EnableFirebaseHosting,  # accepted for backward compatibility; hosting is now the default
    [switch]$IncludeWebsiteSync,     # DEPRECATED (Phase 1): no-op
    [switch]$QuietMode
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$debugLogPath = Join-Path $repoRoot 'firebase-debug.log'

function Assert-Prerequisites {
    $required = @('node', 'npm', 'npx', 'firebase')
    $missing = @()

    foreach ($cmd in $required) {
        $found = Get-Command $cmd -ErrorAction SilentlyContinue
        if (-not $found) {
            $missing += $cmd
        }
    }

    if ($missing.Count -gt 0) {
        Write-Host ("PREREQ_FAIL: Missing commands: " + ($missing -join ', '))
        return $false
    }

    if (-not $QuietMode) {
        Write-Host 'PREREQ_PASS: node, npm, npx, firebase are available.'
    }
    return $true
}

function Wait-Url {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [int]$Retries = 25,
        [int]$DelayMs = 1000
    )

    for ($i = 1; $i -le $Retries; $i++) {
        try {
            $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
                return $true
            }
        } catch {
        }
        Start-Sleep -Milliseconds $DelayMs
    }
    return $false
}

function Get-AvailablePort {
    param(
        [int]$StartPort,
        [int]$MaxTries = 20
    )

    for ($i = 0; $i -lt $MaxTries; $i++) {
        $candidate = $StartPort + $i
        $inUse = Get-NetTCPConnection -LocalPort $candidate -State Listen -ErrorAction SilentlyContinue
        if (-not $inUse) {
            return $candidate
        }
    }

    throw "No available port found starting from $StartPort"
}

function Find-LivePort {
    param(
        [int]$StartPort,
        [int]$Range = 6,
        [int]$Attempts = 30,
        [int]$DelayMs = 1000
    )

    for ($a = 1; $a -le $Attempts; $a++) {
        for ($offset = 0; $offset -lt $Range; $offset++) {
            $candidate = $StartPort + $offset
            try {
                $resp = Invoke-WebRequest -Uri "http://localhost:$candidate/" -UseBasicParsing -TimeoutSec 3
                if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
                    return $candidate
                }
            } catch {
            }
        }
        Start-Sleep -Milliseconds $DelayMs
    }

    return $null
}

function Clear-StalePortProcesses {
    param(
        [Parameter(Mandatory = $true)][int]$Port
    )

    $stopped = @()
    try {
        # Plain `netstat -ano` (no -p tcp): the firebase hosting emulator binds
        # the IPv6 loopback ([::1]:5002), which `-p tcp` output does not list.
        $netstatLines = netstat -ano 2>$null
        foreach ($entry in $netstatLines) {
            if ($entry -match '^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$') {
                $listenPort = [int]$matches[1]
                $ownerProcess = [int]$matches[2]
                if ($listenPort -eq $Port) {
                    try {
                        Stop-Process -Id $ownerProcess -Force -ErrorAction SilentlyContinue
                        $stopped += $ownerProcess
                    } catch {
                    }
                }
            }
        }
    } catch {
    }

    if ($stopped.Count -gt 0) {
        if (-not $QuietMode) {
            Write-Host ("START_ALL_INFO: Cleared stale process(es) on port $Port" + ' (' + ($stopped -join ', ') + ')')
        }
        Start-Sleep -Seconds 1
    }
}

function Get-FirebaseAuthStatus {
    $firebasercPath = Join-Path $repoRoot '.firebaserc'

    $projectId = $null
    if (Test-Path $firebasercPath) {
        try {
            $firebaserc = Get-Content $firebasercPath -Raw | ConvertFrom-Json
            $projectId = $firebaserc.projects.default
        } catch {
            $projectId = $null
        }
    }

    $auth = [ordered]@{
        authenticated = $false
        email = $null
        projectId = $projectId
        reason = $null
    }

    $loginJsonText = ''
    $cmdExit = 1
    $loginJob = $null
    try {
        $loginJob = Start-Job -ScriptBlock {
            $env:NODE_OPTIONS = '--no-deprecation'
            $output = (& firebase login:list --json 2>$null) | Out-String
            [pscustomobject]@{
                output = $output
                exitCode = $LASTEXITCODE
            }
        }

        if (Wait-Job -Job $loginJob -Timeout 20) {
            $result = Receive-Job -Job $loginJob
            $loginJsonText = [string]$result.output
            $cmdExit = [int]$result.exitCode
        } else {
            Stop-Job -Job $loginJob -Force -ErrorAction SilentlyContinue
            $auth.reason = 'firebase login:list timed out'
        }
    } catch {
        $auth.reason = 'firebase login:list failed'
    } finally {
        if ($loginJob) {
            Remove-Job -Job $loginJob -Force -ErrorAction SilentlyContinue
        }
    }

    if ($cmdExit -eq 0 -and -not [string]::IsNullOrWhiteSpace($loginJsonText)) {
        try {
            $login = $loginJsonText | ConvertFrom-Json

            $loginResult = @()
            if ($null -ne $login.result) {
                $loginResult = @($login.result)
            }

            $isSuccessStatus = ($login.status -eq 'success')
            $hasLoginResult = ($loginResult.Count -gt 0)

            if ($isSuccessStatus -and $hasLoginResult) {
                $auth.authenticated = $true
                $auth.email = $login.result[0].user.email
                $auth.reason = 'active firebase login detected'
            } else {
                $auth.reason = 'no active firebase login'
            }
        } catch {
            $auth.reason = 'unable to parse firebase login output'
        }
    } elseif ([string]::IsNullOrWhiteSpace([string]$auth.reason)) {
        $auth.reason = 'firebase login:list failed'
    }

    return [pscustomobject]$auth
}

function Open-TargetUrls {
    param(
        [int]$PortalPort,
        [switch]$Hosting
    )

    # Hosting mode serves the firebase.json rewrites, so the pretty URLs work.
    if ($Hosting) {
        $urls = @(
            "http://localhost:$PortalPort/",
            "http://localhost:$PortalPort/register",
            "http://localhost:$PortalPort/student-login",
            "http://localhost:$PortalPort/admin-login",
            "http://localhost:$PortalPort/instructor-login"
        )
    } else {
        $urls = @(
            "http://localhost:$PortalPort/",
            "http://localhost:$PortalPort/UNMEIwebsite/register/",
            "http://localhost:$PortalPort/UNMEIstudentsportal/login.html",
            "http://localhost:$PortalPort/UNMEIadminportal/admin-login.html",
            "http://localhost:$PortalPort/UNMEIinstructorportal/instructor-login.html"
        )
    }

    foreach ($u in $urls) {
        Start-Process $u | Out-Null
    }
}

function Stop-BackgroundPidSafe {
    param(
        [Parameter(Mandatory = $false)][int]$Pid = 0,
        [Parameter(Mandatory = $true)][string]$Label
    )

    if ($Pid -le 0) {
        return
    }

    try {
        $proc = Get-Process -Id $Pid -ErrorAction SilentlyContinue
        if ($null -ne $proc) {
            Stop-Process -Id $Pid -Force -ErrorAction SilentlyContinue
            Write-Host ("START_ALL_INFO: Stopped $Label process pid=$Pid during cleanup.")
        }
    } catch {
    }
}

$firebasePid = 0
$staticPid = 0

try {
    # 1) Prereq check
    if (-not (Assert-Prerequisites)) {
        throw 'Prerequisite check failed.'
    }

    # Clean stale firebase debug artifacts from prior runs.
    if (Test-Path $debugLogPath) {
        Remove-Item -Path $debugLogPath -Force -ErrorAction SilentlyContinue
        if (-not $QuietMode) {
            Write-Host 'START_ALL_INFO: Removed stale firebase-debug.log.'
        }
    }

    if ($IncludeWebsiteSync -and -not $QuietMode) {
        Write-Host 'START_ALL_INFO: -IncludeWebsiteSync is deprecated (mirror removed in Phase 1); ignored.'
    }

    # 2) Mode: Firebase Hosting emulator on a FIXED port (5002) is the primary
    #    way to run. The static server (5000) is only a fallback when the
    #    Firebase CLI/login is unavailable.
    $staticOnlyMode = $StaticOnly -or $ForceNoFirebase
    $hostingLive = $false
    $portalPort = 0

    if (-not $staticOnlyMode) {
        $firebaseAuth = Get-FirebaseAuthStatus

        if ($firebaseAuth.authenticated) {
            # Reuse an emulator that is already serving the target port.
            if (Wait-Url -Url "http://localhost:$FirebasePort/" -Retries 1) {
                $hostingLive = $true
                $portalPort = $FirebasePort
                if (-not $QuietMode) {
                    Write-Host ("START_ALL_INFO: Reusing Firebase hosting already live on port $portalPort.")
                }
            } else {
                Clear-StalePortProcesses -Port $FirebasePort
                $cmd = "Set-Location '$repoRoot'; Remove-Item -Path '$debugLogPath' -Force -ErrorAction SilentlyContinue; `$env:FIREBASE_DEBUG=''; firebase serve --only hosting --port $FirebasePort"
                $firebasePid = (Start-Process -FilePath 'powershell' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-Command',$cmd) -WindowStyle Hidden -PassThru).Id

                $livePort = Find-LivePort -StartPort $FirebasePort -Range 6
                if ($null -ne $livePort) {
                    $portalPort = $livePort
                    $hostingLive = $true
                    if (-not $QuietMode) {
                        Write-Host ("START_ALL_INFO: Firebase hosting is live on port $portalPort (pid=$firebasePid).")
                    }
                } else {
                    Write-Host "START_ALL_WARN: Firebase hosting did not pass health check on port $FirebasePort."
                    Stop-BackgroundPidSafe -Pid $firebasePid -Label 'firebase hosting'
                    $firebasePid = 0
                }
            }
        } else {
            Write-Host ("START_ALL_WARN: Firebase login not active (" + $firebaseAuth.reason + "). Falling back to the static server.")
        }
    }

    # 3) Static fallback (only when hosting is unavailable or StaticOnly)
    if (-not $hostingLive) {
        Clear-StalePortProcesses -Port $StaticPort
        $staticCmd = "Set-Location '$repoRoot'; npx -y serve .\public -l $StaticPort"
        $staticPid = (Start-Process -FilePath 'powershell' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-Command',$staticCmd) -WindowStyle Hidden -PassThru).Id

        if (-not (Wait-Url -Url "http://localhost:$StaticPort/" -Retries 40)) {
            throw "Static fallback server failed health check on port $StaticPort. Run .\scripts\stop-all.ps1 and re-run start-all."
        }
        $portalPort = $StaticPort
        if (-not $QuietMode) {
            Write-Host ("START_ALL_INFO: Static fallback server is live on port $StaticPort (pid=$staticPid).")
        }
    }

    # 4) Optional URL open
    if ($OpenUrls) {
        Open-TargetUrls -PortalPort $portalPort -Hosting:$hostingLive
    }

    # Guardrail: keep workspace clean if firebase CLI emitted a debug log at startup.
    if (Test-Path $debugLogPath) {
        Remove-Item -Path $debugLogPath -Force -ErrorAction SilentlyContinue
        if (-not $QuietMode) { Write-Host 'START_ALL_INFO: Removed firebase-debug.log generated during startup.' }
    }

    if ($QuietMode) {
        Write-Host ''
        Write-Host 'Unmei Nihongo Center - Portal System v1.0'
        Write-Host 'All services started successfully.'
        Write-Host ''
        Write-Host "Portal: http://localhost:$portalPort/"
        Write-Host ''
        Write-Host 'Press Ctrl+C to stop (or run stop-all.ps1).'
    } else {
        if ($hostingLive) {
            Write-Host 'START_ALL_MODE=HOSTING (pretty URLs active: /register, /student-login, /admin-login, /instructor-login)'
            Write-Host 'START_ALL_INFO: The static port 5000 is intentionally not started in hosting mode.'
        } else {
            Write-Host 'START_ALL_MODE=STATIC_FALLBACK (pretty URLs unavailable; use full .html paths)'
        }
        Write-Host 'START_ALL_PASS'
        Write-Host ("PORTAL_URL=http://localhost:$portalPort/")
    }
    exit 0
}
catch {
    if ($firebasePid -gt 0) {
        Stop-BackgroundPidSafe -Pid $firebasePid -Label 'firebase hosting'
    }

    if ($staticPid -gt 0) {
        Stop-BackgroundPidSafe -Pid $staticPid -Label 'static server'
    }

    Write-Host ("START_ALL_FAIL: " + $_.Exception.Message)
    exit 1
}
