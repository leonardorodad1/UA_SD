# desplegar.ps1 - Despliegue de WaterManagement en un PC del laboratorio (Windows)
#
# Uso (desde la carpeta del repo, en PowerShell):
#   powershell -ExecutionPolicy Bypass -File .\desplegar.ps1 -Modo ws        # PC de estaciones (2 WS)
#   powershell -ExecutionPolicy Bypass -File .\desplegar.ps1 -Modo fo        # PC de operadores (2 FO)
#   ... -Pull        trae antes los ultimos cambios de GitHub
#   ... -NoCache     reconstruye las imagenes desde cero
#   ... -Parar       solo para y borra los contenedores de ese modo
#
# Por que se construye servicio a servicio: ws1/ws2 (y fo1/fo2) comparten imagen y,
# si se construyen a la vez con --build, Docker falla con "image already exists".

param(
    [Parameter(Mandatory = $true)][ValidateSet("ws", "fo")][string]$Modo,
    [switch]$Pull,
    [switch]$NoCache,
    [switch]$Parar,
    [string]$Kafka   = "turntable.proxy.rlwy.net:42333",
    [string]$Central = "centerbeam.proxy.rlwy.net:45361"
)

Set-Location $PSScriptRoot
$ProgressPreference = "SilentlyContinue"   # evita que la barra de progreso se mezcle con la salida

if ($Modo -eq "ws") {
    $Compose   = "docker-compose.ws.yml"
    $Servicios = @("ws1-monitor", "ws1-engine")   # uno por imagen; ws2-* reutilizan la misma imagen
} else {
    $Compose   = "docker-compose.fo.yml"
    $Servicios = @("fo1")                          # fo2 reutiliza la misma imagen
}

function Paso($texto) { Write-Host ""; Write-Host "== $texto ==" -ForegroundColor Cyan }
function Fallo($texto) { Write-Host "ERROR: $texto" -ForegroundColor Red; exit 1 }
function Comprobar($texto) { if ($LASTEXITCODE -ne 0) { Fallo $texto } }

# ---------- modo parar ----------
if ($Parar) {
    Paso "Parando contenedores ($Compose)"
    docker compose -f $Compose down
    Comprobar "docker compose down"
    exit 0
}

# ---------- 1. Docker ----------
Paso "1. Docker Desktop"
docker info *> $null
Comprobar "Docker no responde. Abre Docker Desktop y espera a que este listo."
Write-Host "Docker OK"

# ---------- 2. Red hasta Railway ----------
Paso "2. Red hasta Railway"
foreach ($destino in @($Kafka, $Central)) {
    $partes = $destino.Split(":")
    $ok = Test-NetConnection $partes[0] -Port ([int]$partes[1]) -InformationLevel Quiet -WarningAction SilentlyContinue
    if ($ok) {
        Write-Host "Alcanzable: $destino"
    } else {
        Fallo "No se llega a $destino (la red de este PC puede estar bloqueando Railway)."
    }
}

# ---------- 3. .env ----------
Paso "3. Fichero .env"
if (-not (Test-Path ".env")) { Fallo "No existe .env en esta carpeta." }
Get-Content ".env"
Write-Host "(revisa que las direcciones y los IDs son los de este PC)"

# ---------- 4. Reloj ----------
Paso "4. Reloj de Docker frente al de Windows"
$dockerSeg = docker run --rm alpine date -u +%s
if ($LASTEXITCODE -eq 0) {
    $diff = [math]::Abs([DateTimeOffset]::UtcNow.ToUnixTimeSeconds() - [long]$dockerSeg)
    if ($diff -gt 10) {
        Write-Host "AVISO: el reloj de Docker difiere $diff s. El Engine descartaria las ordenes." -ForegroundColor Yellow
        Write-Host "Solucion: wsl --shutdown, reabrir Docker Desktop y volver a lanzar este script." -ForegroundColor Yellow
    } else {
        Write-Host "Reloj OK (diferencia $diff s)"
    }
} else {
    Write-Host "No se pudo comprobar el reloj (continuo)" -ForegroundColor Yellow
}

# ---------- 5. Codigo ----------
if ($Pull) {
    Paso "5. git pull"
    git pull
    Comprobar "git pull"
}
Write-Host "Version desplegada:"
git log -1 --oneline

# ---------- 6. Limpiar ----------
Paso "6. Parando lo anterior"
docker compose -f $Compose down
Comprobar "docker compose down"

# ---------- 7. Construir (de uno en uno) ----------
Paso "7. Construyendo imagenes"
foreach ($s in $Servicios) {
    if ($NoCache) {
        docker compose -f $Compose build --no-cache $s
    } else {
        docker compose -f $Compose build $s
    }
    Comprobar "build de $s"
}

# ---------- 8. Levantar ----------
Paso "8. Arrancando"
docker compose -f $Compose up -d
Comprobar "docker compose up"

Paso "9. Estado"
Start-Sleep -Seconds 5
docker compose -f $Compose ps -a

Write-Host ""
Write-Host "Listo. Comandos utiles:" -ForegroundColor Green
Write-Host "  Logs en directo : docker compose -f $Compose logs -f --tail 20 <servicio>"
Write-Host "  Entrar (menu)   : docker compose -f $Compose attach <servicio>   (salir sin parar: Ctrl+P, Ctrl+Q)"
Write-Host "  Simular crash   : docker compose -f $Compose kill <servicio>"
Write-Host "  Recuperar       : docker compose -f $Compose up -d <servicio>"
Write-Host "  Volver a abrir un FO cerrado con la opcion 3: docker compose -f $Compose start fo1"