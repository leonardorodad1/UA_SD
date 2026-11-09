# Uso: .\nuevaWS.ps1 WS-id
#Script para añadir una nueva estacion

param([Parameter(Mandatory=$true)][string]$Id)
Set-Location $PSScriptRoot

# leemos IPs y puertos del .env
$e=@{}; Get-Content .env | ForEach-Object { if ($_ -match "^(\w+)=(.*)$") { $e[$Matches[1]]=$Matches[2].Trim() } }
$n = $Id.ToLower().Replace("-","")       

docker rm -f "$n-monitor" "$n-engine" *> $null   # por si quedaba una vieja

# 1. Monitor
docker compose -f docker-compose.ws.yml run -d --name "$n-monitor" ws1-monitor 6001 $e.IP_CENTRAL $e.PUERTO_CENTRAL $Id
Start-Sleep -Seconds 3
docker logs "$n-monitor"
Write-Host ""
Write-Host "Si arriba pregunta si quieres registrarla:" -ForegroundColor Yellow
Write-Host "  docker attach $n-monitor   ->  Y, Enter, ubicacion, Enter   (salir: Ctrl+P, Ctrl+Q)" -ForegroundColor Yellow
Read-Host "Pulsa Enter cuando el Monitor este autenticado"

# 2. Engine, conectado a SU monitor
docker compose -f docker-compose.ws.yml run -d --name "$n-engine" ws1-engine $e.IP_KAFKA $e.PUERTO_KAFKA "$n-monitor" 6001
Write-Host "Listo: $Id. Usar el Engine: docker attach $n-engine" -ForegroundColor Green