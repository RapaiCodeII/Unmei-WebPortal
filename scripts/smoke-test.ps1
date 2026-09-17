param(
    [int]$HostingPort = 5002,
    [int]$StaticPort = 5000,
    [switch]$IncludeWebsiteRoutes,
    [switch]$IncludeFirebase,        # accepted for backward compatibility; hosting is always tested first
    [int]$FirebasePort = 5002,       # legacy name, maps to HostingPort when HostingPort is default
    [int]$FirebasePortRange = 6
)

$ErrorActionPreference = 'Stop'

if ($PSBoundParameters.ContainsKey('FirebasePort') -and -not $PSBoundParameters.ContainsKey('HostingPort')) {
    $HostingPort = $FirebasePort
}

function Test-Url {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [int]$TimeoutSec = 8
    )

    try {
        $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec
        if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 400) {
            Write-Host ("SMOKE_URL_PASS: $Url STATUS=" + [int]$resp.StatusCode)
            return $true
        }

        Write-Host ("SMOKE_URL_FAIL: $Url STATUS=" + [int]$resp.StatusCode)
        return $false
    } catch {
        Write-Host ("SMOKE_URL_FAIL: $Url MSG=" + $_.Exception.Message)
        return $false
    }
}

function Find-LiveFirebasePort {
    param(
        [int]$StartPort,
        [int]$Range
    )

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

    return $null
}

# Common routes (work on both hosting emulator and static server).
$coreTargets = @(
    "/",
    "/UNMEIwebsite/index.html",
    "/UNMEIwebsite/register/index.html",
    "/UNMEIstudentsportal/login.html",
    "/UNMEIadminportal/admin-login.html",
    "/UNMEIinstructorportal/instructor-login.html",
    "/UNMEIstudentsportal/studentportal.css",
    "/UNMEIadminportal/adminportal.css",
    "/UNMEIinstructorportal/instructorportal.css"
)

if ($IncludeWebsiteRoutes) {
    $coreTargets += @(
        "/UNMEIwebsite/about.html",
        "/UNMEIwebsite/services.html",
        "/UNMEIwebsite/beginner-course.html",
        "/UNMEIwebsite/jlpt-n4-course.html",
        "/UNMEIwebsite/study-in-japan.html",
        "/UNMEIwebsite/contact.html",
        "/UNMEIwebsite/posts.html"
    )
}

# Pretty rewrites (hosting emulator only).
$prettyTargets = @(
    "/register",
    "/student-login",
    "/admin-login",
    "/instructor-login"
)

$failed = 0
$mode = 'STATIC_FALLBACK'

# 1) Try Firebase hosting first (fixed port, then a small scan range).
$liveHostingPort = Find-LiveFirebasePort -StartPort $HostingPort -Range $FirebasePortRange
if ($null -ne $liveHostingPort) {
    $mode = 'HOSTING'
    Write-Host ("SMOKE_INFO: Firebase hosting detected on port " + $liveHostingPort + " - testing pretty URLs too.")
    foreach ($t in $coreTargets) {
        if (-not (Test-Url "http://localhost:$liveHostingPort$t")) { $failed++ }
    }
    foreach ($t in $prettyTargets) {
        if (-not (Test-Url "http://localhost:$liveHostingPort$t")) { $failed++ }
    }
} else {
    Write-Host 'SMOKE_INFO: Firebase hosting not detected - testing static fallback (full paths only).'
    foreach ($t in $coreTargets) {
        if (-not (Test-Url "http://localhost:$StaticPort$t")) { $failed++ }
    }
}

if ($failed -gt 0) {
    Write-Host ("SMOKE_TEST_FAIL: " + $failed + " route(s) failed in " + $mode + " mode.")
    exit 1
}

Write-Host ("SMOKE_MODE=" + $mode)
Write-Host 'SMOKE_TEST_PASS'
exit 0
