# desplegar.ps1 - Despliegue de WaterManagement en un PC del laboratorio (Windows)
#
# Uso (desde la carpeta del repo, en PowerShell):
#   powershell -ExecutionPolicy Bypass -File .\desplegar.ps1 -Modo ws        # PC de estaciones (2 WS)
#   powershell -ExecutionPolicy Bypass -File .\desplegar.ps1 -Modo fo        # PC de operadores (2 FO)
#   ... -Pull        trae antes los ultimos cambios de GitHub
#   ... -NoCache     reconstruye las imagenes desde cero
#   ... -Parar       solo para y borra los contenedores de ese modo
#   ... -Estaciones WS-03,WS-04      ademas de ws1/ws2 arranca esas estaciones (ya registradas)
#   ... -Operarios OP-11=servicios1.txt,OP-12=servicios2.txt   ademas de fo1/fo2 lanza esos FO
#                                                                (con =fichero leen ese fichero solos)
# Al terminar abre una ventana por cada WS (monitor y engine) o por cada FO.
#
# Por que se construye servicio a servicio: ws1/ws2 (y fo1/fo2) comparten imagen y,
# si se construyen a la vez con --build, Docker falla con "image already exists".

param(
    [Parameter(Mandatory = $true)][ValidateSet("ws", "fo")][string]$Modo,
    [switch]$Pull,
    [switch]$NoCache,
    [switch]$Parar,
    [string]$Estaciones = "",
    [string]$Operarios  = "",
    [string]$Kafka   = "turntable.proxy.rlwy.net:42333",
    [string]$Central = "centerbeam.proxy.rlwy.net:45361"
)

Set-Location $PSScriptRoot
# con -File las listas llegan como un solo texto "A,B": las separamos nosotros
$ListaWS = @($Estaciones.Split(",") | Where-Object { $_.Trim() -ne "" } | ForEach-Object { $_.Trim() })
$ListaOP = @($Operarios.Split(",")  | Where-Object { $_.Trim() -ne "" } | ForEach-Object { $_.Trim() })
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

# leemos las direcciones del .env para las instancias extra
$e = @{}
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object { if ($_ -match "^(\w+)=(.*)$") { $e[$Matches[1]] = $Matches[2].Trim() } }
}

# abre una ventana nueva de PowerShell con un titulo y un comando
function Ventana($titulo, $comando) {
    Start-Process powershell -WorkingDirectory $PSScriptRoot -ArgumentList "-NoExit", "-Command", "`$host.UI.RawUI.WindowTitle='$titulo'; $comando"
}

# borra los contenedores de este modo (los del compose y los extra lanzados con run)
function Limpiar() {
    docker compose -f $Compose down --remove-orphans
    $prefijo = if ($Modo -eq "ws") { "ws" } else { "op" }
    $viejos = docker ps -aq --filter "name=^$prefijo"
    if ($viejos) { docker rm -f $viejos *> $null }
}

# ---------- modo parar ----------
if ($Parar) {
    Paso "Parando contenedores ($Compose)"
    Limpiar
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
Limpiar

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

# ---------- 9. Instancias extra ----------
if ($Modo -eq "ws" -and $ListaWS.Count -gt 0) {
    Paso "9. Estaciones extra"
    foreach ($id in $ListaWS) {
        $n = $id.ToLower().Replace("-", "")          # WS-03 -> ws03
        docker compose -f $Compose run -d --name "$n-monitor" ws1-monitor 6001 $e.IP_CENTRAL $e.PUERTO_CENTRAL $id | Out-Null
        # esperamos a que el monitor se autentique antes de lanzar su engine
        $ok = $false
        for ($i = 0; $i -lt 15; $i++) {
            Start-Sleep -Seconds 1
            if ((docker logs "$n-monitor" 2>&1 | Out-String) -match "STATUS#OK") { $ok = $true; break }
        }
        if ($ok) {
            docker compose -f $Compose run -d --name "$n-engine" ws1-engine $e.IP_KAFKA $e.PUERTO_KAFKA "$n-monitor" 6001 | Out-Null
            Write-Host "$id arrancada (monitor + engine)"
        } else {
            Write-Host "AVISO: $id no se ha autenticado (no esta registrada?). Registrala con .\nuevaWS.ps1 $id" -ForegroundColor Yellow
        }
    }
}

if ($Modo -eq "fo" -and $ListaOP.Count -gt 0) {
    Paso "9. Operarios extra"
    foreach ($op in $ListaOP) {
        $partes = $op.Split("=")
        $id = $partes[0]
        $n = $id.ToLower().Replace("-", "")
        $fichero = if ($partes.Count -gt 1) { "servicios/" + $partes[1] } else { "" }
        Ventana $id "docker compose -f $Compose run --rm --name $n fo2 $($e.IP_KAFKA) $($e.PUERTO_KAFKA) $id $fichero"
        Write-Host "$id lanzado en su ventana $fichero"
    }
}

# ---------- 10. Una ventana por modulo ----------
Paso "10. Abriendo una ventana por modulo"
Start-Sleep -Seconds 3
$prefijo = if ($Modo -eq "ws") { "^ws" } else { "^fo" }
$nombres = docker ps --format "{{.Names}}" --filter "name=$prefijo" | Sort-Object
foreach ($c in $nombres) {
    # primero lo ultimo que ha escrito (el menu) y luego conectamos el teclado
    Ventana $c "docker logs --tail 15 $c; docker attach $c"
}

Paso "11. Estado"
docker ps --format "table {{.Names}}\t{{.Status}}"

Write-Host ""
Write-Host "Listo. Comandos utiles:" -ForegroundColor Green
Write-Host "  Logs en directo : docker compose -f $Compose logs -f --tail 20 <servicio>"
Write-Host "  Entrar (menu)   : docker attach <contenedor>   (salir sin parar: Ctrl+P, Ctrl+Q)"
Write-Host "  Simular crash   : docker compose -f $Compose kill <servicio>"
Write-Host "  Recuperar       : docker compose -f $Compose up -d <servicio>"
Write-Host "  Volver a abrir un FO cerrado con la opcion 3: docker compose -f $Compose start fo1"