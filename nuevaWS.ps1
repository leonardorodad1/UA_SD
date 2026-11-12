# Uso: .\nuevaWS.ps1 WS-id
#Script para añadir una nueva estacion
param([Parameter(Mandatory=$true)][string]$Id)
Set-Location $PSScriptRoot
$env:COMPOSE_IGNORE_ORPHANS = "True"   # quita el aviso de "orphan containers"

# leemos IPs y puertos del .env
$e=@{}; Get-Content .env | ForEach-Object { if ($_ -match "^(\w+)=(.*)$") { $e[$Matches[1]]=$Matches[2].Trim() } }
$n = $Id.ToLower().Replace("-","")          # WS-10 -> ws10

# abre una ventana: primero lo que ya ha escrito el contenedor y luego conecta el teclado
function Ventana($c) {
    Start-Process powershell -WorkingDirectory $PSScriptRoot -ArgumentList "-NoExit", "-Command", "`$host.UI.RawUI.WindowTitle='$c'; docker logs $c; docker attach $c"
}

docker rm -f "$n-monitor" "$n-engine" *> $null   # por si quedaba una vieja

# 1. Monitor en su ventana
docker compose -f docker-compose.ws.yml run -d --no-deps --name "$n-monitor" ws1-monitor 6001 $e.IP_CENTRAL $e.PUERTO_CENTRAL $Id | Out-Null
Start-Sleep -Seconds 2
Ventana "$n-monitor"
Write-Host "Si la ventana $n-monitor pregunta si quieres registrarla: Y, Enter, ubicacion, Enter" -ForegroundColor Yellow

# 2. esperamos (hasta 60 s) a que el monitor se autentique o se registre
$ok = $false
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 1
    if ((docker logs "$n-monitor" 2>&1 | Out-String) -match "STATUS#OK") { $ok = $true; break }
}
if (-not $ok) { Write-Host "ERROR: $Id no se ha autenticado. Mira la ventana $n-monitor" -ForegroundColor Red; exit 1 }

# 3. Engine en su ventana, conectado a SU monitor
docker compose -f docker-compose.ws.yml run -d --no-deps --name "$n-engine" ws1-engine $e.IP_KAFKA $e.PUERTO_KAFKA "$n-monitor" 6001 | Out-Null
Start-Sleep -Seconds 2
Ventana "$n-engine"
Write-Host "Listo: $Id (monitor + engine, cada uno en su ventana)" -ForegroundColor Green