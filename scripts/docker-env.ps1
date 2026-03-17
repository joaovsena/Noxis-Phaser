$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$defaultDockerConfig = Join-Path $HOME '.docker'
if (Test-Path $defaultDockerConfig) {
    $env:DOCKER_CONFIG = $defaultDockerConfig
}
Set-Location $ProjectRoot
