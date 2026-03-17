$ErrorActionPreference = 'Stop'

. "$PSScriptRoot\docker-env.ps1"

Write-Host "[docker-restart] Derrubando stack..."
docker compose down --remove-orphans

Write-Host "[docker-restart] Subindo stack novamente..."
& "$PSScriptRoot\docker-up.ps1"
