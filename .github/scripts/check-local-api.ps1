param(
    [int]$Port = 7071,
    [int]$StartupTimeoutSeconds = 30
)

$ErrorActionPreference = 'Stop'

function Test-CommandAvailable {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-AvailablePort {
    param(
        [Parameter(Mandatory = $true)]
        [int]$StartingPort
    )

    for ($candidatePort = $StartingPort; $candidatePort -lt ($StartingPort + 20); $candidatePort++) {
        $listener = $null

        try {
            $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $candidatePort)
            $listener.Start()
            return $candidatePort
        }
        catch {
            continue
        }
        finally {
            if ($listener) {
                $listener.Stop()
            }
        }
    }

    throw "Unable to find a free localhost port starting at $StartingPort"
}

if (-not (Test-CommandAvailable -Name 'node')) {
    throw 'Node.js is not installed or not on PATH.'
}

if (-not (Test-CommandAvailable -Name 'npm')) {
    throw 'npm is not installed or not on PATH.'
}

if (-not (Test-CommandAvailable -Name 'func')) {
    throw 'Azure Functions Core Tools is not installed or not on PATH. Install with: npm install -g azure-functions-core-tools@4'
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent (Split-Path -Parent $scriptDir)
$apiDir = Join-Path $repoRoot 'api'
$selectedPort = Get-AvailablePort -StartingPort $Port

if (-not (Test-Path $apiDir)) {
    throw "API directory not found: $apiDir"
}

$funcCommand = Get-Command func
$funcCmd = $funcCommand.Source

if ($IsWindows) {
    $funcCmdPath = Join-Path (Split-Path -Parent $funcCmd) 'func.cmd'
    if (Test-Path $funcCmdPath) {
        $funcCmd = $funcCmdPath
    }
}
$stdoutLog = Join-Path ([System.IO.Path]::GetTempPath()) ("retrodojo-func-{0}.out.log" -f [guid]::NewGuid())
$stderrLog = Join-Path ([System.IO.Path]::GetTempPath()) ("retrodojo-func-{0}.err.log" -f [guid]::NewGuid())

$process = $null
$apiUrl = "http://localhost:$selectedPort/api/hello"

try {
    Write-Host "Starting Azure Functions host from $apiDir on port $selectedPort..."
    $process = Start-Process -FilePath $funcCmd -ArgumentList 'start', '--port', $selectedPort -WorkingDirectory $apiDir -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru

    $deadline = (Get-Date).AddSeconds($StartupTimeoutSeconds)
    $response = $null

    do {
        if ($process.HasExited) {
            throw "Functions host exited early with code $($process.ExitCode)."
        }

        try {
            $response = Invoke-RestMethod -Uri $apiUrl -TimeoutSec 2
        }
        catch {
            $response = $null
        }

        if ($response) {
            break
        }

        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)

    if (-not $response) {
        throw "Timed out waiting for $apiUrl"
    }

    Write-Host 'Local API health check passed.'
    Write-Host ("Message: {0}" -f $response.message)
    Write-Host ("Timestamp: {0}" -f $response.timestamp)
}
catch {
    Write-Host $_.Exception.Message

    if (Test-Path $stdoutLog) {
        $stdoutTail = Get-Content $stdoutLog -Tail 40 -ErrorAction SilentlyContinue
        if ($stdoutTail) {
            Write-Host ''
            Write-Host 'Functions stdout:'
            $stdoutTail | ForEach-Object { Write-Host $_ }
        }
    }

    if (Test-Path $stderrLog) {
        $stderrTail = Get-Content $stderrLog -Tail 40 -ErrorAction SilentlyContinue
        if ($stderrTail) {
            Write-Host ''
            Write-Host 'Functions stderr:'
            $stderrTail | ForEach-Object { Write-Host $_ }
        }
    }

    exit 1
}
finally {
    if ($process -and -not $process.HasExited) {
        Stop-Process -Id $process.Id -Force
    }

    Remove-Item $stdoutLog, $stderrLog -ErrorAction SilentlyContinue
}