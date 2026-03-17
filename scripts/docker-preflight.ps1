$ErrorActionPreference = 'Stop'

. "$PSScriptRoot\docker-env.ps1"

Write-Host "[docker-preflight] Validando Docker Desktop/WSL..."

$dockerService = Get-Service com.docker.service -ErrorAction SilentlyContinue
$wslState = (wsl -l -v 2>$null | Out-String)
$dockerConfigPath = Join-Path $env:DOCKER_CONFIG 'config.json'
$dockerConfig = $null

if (Test-Path $dockerConfigPath) {
    $dockerConfig = Get-Content $dockerConfigPath | ConvertFrom-Json
}

if ($dockerService -and $dockerService.Status -ne 'Running') {
    throw "[docker-preflight] com.docker.service esta '$($dockerService.Status)'. Feche o Docker Desktop, execute 'wsl --shutdown', abra o Docker Desktop novamente e aguarde ficar saudavel."
}

if ($wslState -notmatch 'docker-desktop') {
    Write-Warning "[docker-preflight] A distro docker-desktop nao apareceu no WSL."
}

if ($dockerConfig -and -not [string]::IsNullOrWhiteSpace($dockerConfig.currentContext)) {
    $contextName = [string]$dockerConfig.currentContext
    $contextList = docker context ls --format "{{.Name}}" 2>$null

    if ($LASTEXITCODE -ne 0) {
        throw "[docker-preflight] Nao foi possivel listar os contexts do Docker. Verifique o Docker Desktop antes de continuar."
    }

    if ($contextList -notcontains $contextName) {
        throw "[docker-preflight] O context atual '$contextName' nao existe no Docker configurado em '$dockerConfigPath'."
    }
}

try {
    docker version | Out-Null
} catch {
    throw "[docker-preflight] O daemon Docker nao respondeu. Reinicie o Docker Desktop antes de continuar."
}

Write-Host "[docker-preflight] Docker respondeu com sucesso."
