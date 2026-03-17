$ErrorActionPreference = 'Stop'

. "$PSScriptRoot\docker-env.ps1"
. "$PSScriptRoot\docker-preflight.ps1"

Write-Host "[docker-reset] Derrubando stack e removendo volumes do projeto..."
docker compose down -v --remove-orphans

Write-Host "[docker-reset] Limpando imagens dangling e cache de build..."
docker image prune -f | Out-Null
docker builder prune -f | Out-Null

Write-Host "[docker-reset] Subindo stack limpa..."
& "$PSScriptRoot\docker-up.ps1"
