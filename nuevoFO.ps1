# Uso: .\nuevoFO.ps1 OP-ID            (con menu)
#      .\nuevoF.ps1 OP-ID servicios1.txt   (lee el fichero solo)

param([Parameter(Mandatory=$true)][string]$Id, [string]$Fichero)
Set-Location $PSScriptRoot
$e=@{}; Get-Content .env | ForEach-Object { if ($_ -match "^(\w+)=(.*)$") { $e[$Matches[1]]=$Matches[2].Trim() } }
$n = $Id.ToLower().Replace("-","")

if ($Fichero) {
  docker compose -f docker-compose.fo.yml run --rm --name $n fo2 $e.IP_KAFKA $e.PUERTO_KAFKA $Id "servicios/$Fichero"
} else {
  docker compose -f docker-compose.fo.yml run --rm --name $n fo2 $e.IP_KAFKA $e.PUERTO_KAFKA $Id
}