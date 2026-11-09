# WaterManagement – Gestión centralizada del riego de parques y jardines

Práctica de Sistemas Distribuidos (SD 26/27).

## Objetivo 

Realizar un sistema que simula la gestión de una red de estaciones de riego (en adelante también **"Watering Station"** o **WS**) distribuidas por
los parques y jardines de una ciudad, y su uso tanto por el ayuntamiento/gestor de la red
como por los operarios de mantenimiento que activan y supervisan el riego sobre el terreno



## Documentación

- **[Guía de despliegue (DESPLIEGUE.md)](DESPLIEGUE.md):** cómo se despliega el escenario (Railway + 2 PCs de laboratorio con Docker) y cómo se comprueba que funciona.
- **[Prompts de IA (prompts/prompts.md)](prompts/prompts.md):** prompts utilizados durante el desarrollo.
- **[Nombres.txt](Nombres.txt):** integrantes del grupo.

## Arquitectura

```
 PC LAB 1                     Railway (Cloud)                   PC LAB 2
┌──────────────┐        ┌───────────────────────┐        ┌─────────────────────────┐
│ WM_FO (1)    │        │ WM_Central            │        │ WM_WS (1) Monitor+Engine│
│ WM_FO (2)    │◄──────►│ BD SQLite             │◄──────►│ WM_WS (2) Monitor+Engine│
└──────────────┘ Kafka  │ Kafka                 │ Kafka  └─────────────────────────┘
                        └───────────┬───────────┘ + sockets (Monitor ↔ Central)
                                    │ HTTPS (dominio de Railway → puerto 8080)
                             ┌──────┴───────┐
                             │  Navegador   │  Panel web de WM_Central
                             └──────────────┘
```

- **Panel de WM_Central:** se abre en el navegador con el dominio público de Railway. Muestra el estado de cada WS con sus colores y permite iniciar, bloquear y activar una o todas las WS.

## Estructura del repositorio

```
WM_Central/       WM_CENTRAL.py, Dockerfile, requirements.txt, panel (panel.html, panel.css, panel.js)
WM_FO/            WM_FO.py, Dockerfile, requirements.txt, servicios/ (ficheros de peticiones)
WM_WS/WM_M/       WM_WS_M.py (Monitor), Dockerfile
WM_WS/WM_E/       WM_WS_E.py (Engine), Dockerfile, requirements.txt
prompts/          prompts.md
docker-compose.fo.yml   Operadores (PC LAB 1)
docker-compose.ws.yml   Estaciones (PC LAB 2)
docker-compose.yml      Todo en un solo PC con Kafka local (solo para pruebas)
.env                    Configuración (direcciones de Railway e IDs)
desplegar.ps1           Script de despliegue para Windows
DESPLIEGUE.md           Guía de despliegue
Readme.md               Este fichero
Nombres.txt             Integrantes
```

## Ejecución rápida

Con la parte Cloud (Railway) desplegada, en cada PC del laboratorio (Windows, con Docker Desktop abierto), desde la carpeta del repositorio:

```powershell
# PC LAB 1 (operadores)
powershell -ExecutionPolicy Bypass -File .\desplegar.ps1 -Modo fo

# PC LAB 2 (estaciones)
powershell -ExecutionPolicy Bypass -File .\desplegar.ps1 -Modo ws
```

Para entrar al menú de un módulo (por ejemplo, el FO) y salir sin pararlo:

```powershell
docker compose -f docker-compose.fo.yml attach fo1      # salir: Ctrl+P, Ctrl+Q
```

Para añadir más instancias (otro FO u otra WS) sin recompilar, ver el apartado 6 de [DESPLIEGUE.md](DESPLIEGUE.md).

## Tecnologías

Python 3 · Sockets · Apache Kafka (`confluent-kafka`) · SQLite · Docker y Docker Compose · Railway · GitHub · HTML/CSS/JS.