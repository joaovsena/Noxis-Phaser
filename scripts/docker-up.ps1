$ErrorActionPreference = 'Stop'

. "$PSScriptRoot\docker-env.ps1"
. "$PSScriptRoot\docker-preflight.ps1"

$timeoutValue = $env:DOCKER_START_TIMEOUT_SECONDS
if ([string]::IsNullOrWhiteSpace($timeoutValue)) {
    $timeoutValue = '180'
}

$timeoutSeconds = [int]$timeoutValue
$pollSeconds = 2
$services = @('db', 'redis', 'app')

function Get-ServiceStatus {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ServiceName
    )

    $status = docker compose ps --format json $ServiceName | ConvertFrom-Json
    if ($null -eq $status) {
        throw "[docker-up] Nao foi possivel obter o status do servico '$ServiceName'."
    }

    return $status
}

function Test-ServiceReady {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ServiceName
    )

    $status = Get-ServiceStatus -ServiceName $ServiceName

    if ($status.State -ne 'running') {
        return $false
    }

    if ([string]::IsNullOrWhiteSpace($status.Health)) {
        return $true
    }

    return $status.Health -eq 'healthy'
}

Write-Host "[docker-up] Subindo containers..."
docker compose up --build -d

$deadline = (Get-Date).AddSeconds($timeoutSeconds)
while ((Get-Date) -lt $deadline) {
    $pending = @($services | Where-Object { -not (Test-ServiceReady -ServiceName $_) })
    if ($pending.Count -eq 0) {
        Write-Host "[docker-up] Stack pronta."
        docker compose ps
        exit 0
    }

    $states = foreach ($service in $services) {
        $status = Get-ServiceStatus -ServiceName $service
        $healthSuffix = if ([string]::IsNullOrWhiteSpace($status.Health)) { '' } else { "/$($status.Health)" }
        "$service=$($status.State)$healthSuffix"
    }

    Write-Host "[docker-up] Aguardando: $($states -join ', ')"
    Start-Sleep -Seconds $pollSeconds
}

Write-Error "[docker-up] Timeout ao aguardar a stack ficar pronta."
docker compose ps
docker compose logs --tail=200 db redis app
exit 1
