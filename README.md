# WaterManagement – Gestión centralizada del riego de parques y jardines

Práctica de Sistemas Distribuidos (SD 26/27) · Grupo 03

## Objetivo

Realizar un sistema que simula la gestión de una red de estaciones de riego (en adelante también **"Watering Station"** o **WS**) distribuidas por los parques y jardines de una ciudad, y su uso tanto por el ayuntamiento/gestor de la red como por los operarios de mantenimiento que activan y supervisan el riego sobre el terreno.

## Documentación

- **[Guía de despliegue (DESPLIEGUE.md)](DESPLIEGUE.md):** cómo se despliega el escenario (Railway + 2 PCs de laboratorio con Docker), cómo se añaden más estaciones y operarios y cómo se comprueba que funciona.
- **[Prompts de IA (prompts/prompts.md)](prompts/prompts.md):** prompts utilizados durante el desarrollo.
- **[nombres.txt](nombres.txt):** integrantes del grupo.

## Arquitectura

```
 PC LAB 1                     Railway (Cloud)                    PC LAB 2
┌──────────────┐        ┌───────────────────────┐        ┌──────────────────────────┐
│ WM_FO (1)    │        │ WM_Central            │        │ WM_WS (1) Monitor+Engine │
│ WM_FO (2)    │◄──────►│ BD SQLite             │◄──────►│ WM_WS (2) Monitor+Engine │
│ + FO extra   │ Kafka  │ Kafka                 │ Kafka  │ + WS extra               │
└──────────────┘        └───────────┬───────────┘ +sockets (Monitor ↔ Central)
                                    │ HTTPS (dominio de Railway → puerto 8080)
                             ┌──────┴───────┐
                             │  Navegador   │  Panel web de WM_Central
                             └──────────────┘
```

- **WM_Central:** decide si se autoriza cada riego y es la única que escribe en la base de datos SQLite.
- **WM_WS:** cada estación son dos programas. El **Monitor** se autentica en la Central por sockets, le manda un latido cada 2 s y vigila la salud del Engine cada segundo. El **Engine** riega (electroválvula y caudalímetro simulados) y habla con la Central por Kafka.
- **WM_FO:** el operario pide riegos (a mano o desde un fichero), ve las estaciones disponibles y recibe por Kafka el progreso de su riego.
- **Panel de WM_Central:** se abre en el navegador con el dominio público de Railway. Muestra cada WS con su ID, ubicación, agua suministrada y estado con sus colores, y permite iniciar riegos, poner fuera de servicio y activar una, varias o todas las WS.

## Estructura del repositorio

```
WM_Central/       WM_CENTRAL.py, Dockerfile, requirements.txt, panel web (panel.html, panel.css, panel.js)
WM_FO/            WM_FO.py, Dockerfile, requirements.txt, servicios/ (ficheros de riegos)
WM_WS/WM_M/       WM_WS_M.py (Monitor), Dockerfile
WM_WS/WM_E/       WM_WS_E.py (Engine), Dockerfile, requirements.txt
prompts/          prompts.md
docker-compose.fo.yml   Operarios (PC LAB 1)
docker-compose.ws.yml   Estaciones (PC LAB 2)
docker-compose.yml      Todo en un solo PC con Kafka local (solo para pruebas)
.env                    Configuración (direcciones de Railway e IDs)
desplegar.ps1           Despliega un PC entero del laboratorio (Windows)
nuevaWS.ps1             Añade una estación más sin parar las demás
nuevoFO.ps1             Añade un operario más sin parar los demás
DESPLIEGUE.md           Guía de despliegue
README.md               Este fichero
nombres.txt             Integrantes
```

## Ejecución rápida

Con la parte Cloud (Railway) desplegada, en cada PC del laboratorio (Windows, con Docker Desktop abierto):

```powershell
git clone https://github.com/leonardorodad1/UA_SD.git
cd UA_SD

# PC LAB 1 (operarios)
powershell -ExecutionPolicy Bypass -File .\desplegar.ps1 -Modo fo

# PC LAB 2 (estaciones)
powershell -ExecutionPolicy Bypass -File .\desplegar.ps1 -Modo ws
```

El script abre una ventana por cada módulo con su menú. Para salir de una sin parar el módulo: Ctrl+P y después Ctrl+Q.

Para añadir instancias con todo funcionando, sin recompilar:

```powershell
powershell -ExecutionPolicy Bypass -File .\nuevaWS.ps1 WS-08                 # PC LAB 2
powershell -ExecutionPolicy Bypass -File .\nuevoFO.ps1 OP-20                 # PC LAB 1, con menú
powershell -ExecutionPolicy Bypass -File .\nuevoFO.ps1 OP-20 servicios.txt   # PC LAB 1, leyendo un fichero
```

Todas las opciones (`-Estaciones`, `-Operarios`, `-Parar`…) y las pruebas están en [DESPLIEGUE.md](DESPLIEGUE.md).

## Tecnologías

Python 3 · Sockets · Apache Kafka (`confluent-kafka`) · SQLite · Docker y Docker Compose · Railway · GitHub · HTML/CSS/JS.