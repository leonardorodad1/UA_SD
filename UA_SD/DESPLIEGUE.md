# WaterManagement – Guía de despliegue

Esta guía explica cómo se despliega el escenario de la práctica y cómo se comprueba que funciona. Todo el despliegue se hace con **Docker** y sin usar ningún IDE ni compilar nada: solo hace falta clonar el repositorio y lanzar un script.

## 1. Escenario

```
 PC LAB 1                     Railway (Cloud)                   PC LAB 2
┌──────────────┐        ┌───────────────────────┐        ┌────────────────────────┐
│ WM_FO (fo1)  │        │ WM_Central            │        │ WM_WS 1 (monitor+engine)│
│ WM_FO (fo2)  │◄──────►│ BD SQLite (volumen)   │◄──────►│ WM_WS 2 (monitor+engine)│
└──────────────┘ Kafka  │ Kafka                 │ Kafka  └────────────────────────┘
                        └───────────┬───────────┘  +sockets (Monitor ↔ Central)
                                    │ HTTPS (dominio de Railway → 8080)
                             ┌──────┴───────┐
                             │  Navegador   │  Panel web de WM_Central
                             └──────────────┘
```

- **Cloud (Railway):** WM_Central, la base de datos SQLite (en un volumen, `/data`) y Kafka. Se despliega automáticamente desde GitHub al hacer push a `master`.
- **PC LAB 1:** dos operadores de campo (`fo1`, `fo2`).
- **PC LAB 2:** dos estaciones de riego (`ws1`, `ws2`), cada una con su Monitor y su Engine.
- **Navegador:** el panel de WM_Central se abre con el dominio público de Railway (no hace falta instalar nada).
- Los dos PCs del laboratorio **no se comunican entre sí**: todo pasa por Railway.

## 2. Estructura del repositorio

```
WM_Central/          Central (Dockerfile, requirements.txt, WM_CENTRAL.py, panel.html, panel.css, panel.js)
WM_FO/               Operador de campo (Dockerfile, requirements.txt, WM_FO.py, servicios/)
WM_WS/WM_M/          Monitor de la estación (Dockerfile, WM_WS_M.py)
WM_WS/WM_E/          Engine de la estación (Dockerfile, requirements.txt, WM_WS_E.py)
docker-compose.fo.yml   Receta del PC de operadores (fo1, fo2)
docker-compose.ws.yml   Receta del PC de estaciones (ws1-monitor, ws1-engine, ws2-monitor, ws2-engine)
.env                    Configuración (direcciones de Railway e IDs)
desplegar.ps1           Script de despliegue para Windows
```

## 3. Parámetros de cada módulo

Ningún dato está fijo en el código: todo se pasa por argumentos. En Docker, el compose los rellena con los valores del `.env`.

| Módulo | Argumentos |
|---|---|
| WM_Central | `<Puerto> <IP_Kafka> <Puerto_Kafka> [Puerto_web]` (si no se pone, el panel usa el 8080) |
| WM_WS_M (Monitor) | `<Puerto para el Engine> <IP Central> <Puerto Central> <ID_WS>` |
| WM_WS_E (Engine) | `<IP_Kafka> <Puerto_Kafka> <IP Monitor> <Puerto Monitor>` |
| WM_FO | `<IP_Kafka> <Puerto_Kafka> <ID_Operador> [fichero]` |

La ruta de la base de datos de la Central se configura con la variable de entorno `WM_DB_PATH` 

### Fichero `.env`

```
IP_KAFKA=<dirección pública (TCP proxy) de Kafka en Railway>
PUERTO_KAFKA=<puerto>
IP_CENTRAL=<dirección pública (TCP proxy) de WM_Central en Railway>
PUERTO_CENTRAL=<puerto>
WS1_ID=WS-01
WS2_ID=WS-02
OP1_ID=OP-01
OP2_ID=OP-02
```

Los IDs de las estaciones deben ser **únicos en todo el sistema**: no puede haber dos instancias con el mismo ID de estación.

## 4. Requisitos del PC del laboratorio (Windows)

- **Docker Desktop** instalado y abierto (esperar a que termine de arrancar).
- **Git** (el repositorio se clona desde PowerShell; no se usa ningún IDE).
- Acceso de red a las direcciones de Railway del `.env` (el script lo comprueba).
- No hace falta Python ni ningún entorno virtual: cada contenedor lleva su propio Python y sus librerías (`pip install -r requirements.txt` durante la construcción de la imagen).

## 5. Despliegue paso a paso

### 5.1 Parte Cloud (ya desplegada antes de la corrección)
1. En Railway, el servicio de WM_Central está conectado al repositorio de GitHub (rama `master`) y tiene el volumen montado en `/data`.
2. Kafka está desplegado como otro servicio del mismo proyecto de Railway.
3. Ambos tienen un TCP proxy público, cuyas direcciones y puertos van en el `.env`: el de la Central apunta al puerto 5000 (sockets de los Monitor) y el de Kafka al listener externo.
4. La Central tiene además un **dominio público** (HTTPS) que apunta al puerto **8080**: es la dirección del panel web en el navegador. Ese dominio solo sirve para el navegador; los FO, Monitor y Engine usan los TCP proxy.

### 5.2 Laboratorio (en cada PC)

1. Abrir **Docker Desktop** y esperar a que esté listo.
2. Abrir **PowerShell**, clonar el repositorio y entrar en la carpeta del proyecto:

   ```powershell
   git clone https://github.com/leonardorodad1/WaterManagment.git
   cd WaterManagment\UA_SD
   ```
3. Revisar el fichero `.env` (direcciones de Railway e IDs de ese PC).
4. Lanzar el script según el PC:

   ```powershell
   # PC LAB 1 (operadores)
   powershell -ExecutionPolicy Bypass -File .\desplegar.ps1 -Modo fo

   # PC LAB 2 (estaciones)
   powershell -ExecutionPolicy Bypass -File .\desplegar.ps1 -Modo ws
   ```

El script hace, por orden:
1. Comprueba que Docker responde.
2. Comprueba que se llega a Kafka y a la Central en Railway.
3. Muestra el `.env`.
4. Compara el reloj de Docker con el de Windows (el Engine descarta las órdenes de más de 20 s).
5. Opcionalmente hace `git pull`.
6. Para los contenedores anteriores.
7. Construye las imágenes **de una en una** (las dos estaciones comparten imagen, y construirlas a la vez da el error `image already exists`).
8. Arranca los contenedores y muestra su estado.

### Equivalente manual (sin script)

```powershell
# PC de estaciones
docker compose -f docker-compose.ws.yml build ws1-monitor
docker compose -f docker-compose.ws.yml build ws1-engine
docker compose -f docker-compose.ws.yml up -d

# PC de operadores
docker compose -f docker-compose.fo.yml build fo1
docker compose -f docker-compose.fo.yml up -d
```

## 6. Manejo de los módulos

| Qué | Comando |
|---|---|
| Ver el estado | `docker compose -f docker-compose.ws.yml ps -a` |
| Ver logs en directo | `docker compose -f docker-compose.ws.yml logs -f --tail 20 ws1-engine` |
| Entrar al menú de un módulo | `docker compose -f docker-compose.fo.yml attach fo1` |
| Salir sin parar el módulo | Ctrl+P y después Ctrl+Q |
| Simular un crash | `docker compose -f docker-compose.ws.yml kill ws1-monitor` |
| Recuperar un módulo caído | `docker compose -f docker-compose.ws.yml up -d ws1-monitor` |
| Parar todo | `docker compose -f docker-compose.ws.yml down --remove-orphans` |

### Añadir más instancias 

Las imágenes ya están construidas, así que se pueden lanzar más FO o WS en cualquier momento. Con `docker compose run` la nueva instancia entra sola en la red del compose:

```powershell
# Otro operario (PC LAB 1)
docker compose -f docker-compose.fo.yml run --rm fo1 turntable.proxy.rlwy.net 42333 OP-03

# Otra estación (PC LAB 2), cada línea en su propia terminal
docker compose -f docker-compose.ws.yml run --rm --name ws3-monitor ws1-monitor 6001 centerbeam.proxy.rlwy.net 45361 WS-03
docker compose -f docker-compose.ws.yml run --rm --name ws3-engine ws1-engine turntable.proxy.rlwy.net 42333 ws3-monitor 6001
```

El Engine encuentra a su Monitor por el nombre del contenedor (`ws3-monitor`), por eso los dos tienen que lanzarse con el mismo compose.


### Teclas del Engine (simulación)
- **Enter:** alterna el estado OK / KO (simula una fuga). Si hay un riego en curso, se corta.
- **`r` + Enter:** pide un riego desde la propia estación (pasa por la Central, que lo valida).
- **`f` + Enter:** finaliza el riego en curso.

### Menú del FO
1. Solicitar riego (estación y segundos).
2. Leer servicios de un fichero.
3. Ver estaciones disponibles.
4. Salir.

## 7. Cómo comprobar que funciona

1. **Cloud:** en los logs de la Central en Railway aparecen las estaciones registradas (como `DISCONNECTED` hasta que conecten) y `Escuchando el topic wm.peticiones...` y `wm.caudal...`.
2. **Estaciones:** `docker compose -f docker-compose.ws.yml logs --tail 10 ws1-monitor ws2-monitor` muestra `Autenticada en ...` y `Engine responde: OK`.
3. **Riego:** en un FO (`attach fo1`), opción 1, estación `WS-01`, 10 segundos. Debe mostrar `RECIBIDA`, `AUTORIZADA`, varios `REGANDO` (caudal y volumen cada segundo) y `FINALIZADO` con el resumen. A la vez, el Engine de esa estación muestra la orden recibida y la electroválvula abierta/cerrada.
4. **Dos estaciones a la vez:** pedir un riego en `WS-01` desde `fo1` y en `WS-02` desde `fo2`. Ambos terminan correctamente.
5. **Estación ocupada o inexistente:** un riego en una estación que ya está regando, o en una no registrada, devuelve `DENEGADA` con el motivo.
6. **Fuga:** con un riego en curso, pulsar Enter en el Engine: el riego se corta por FUGA, la estación pasa a LEAK y no admite riegos hasta pulsar Enter otra vez.
7. **Parada manual:** `f` + Enter en el Engine durante un riego: termina por parada manual y el FO recibe el resumen.
8. **Panel:** al abrir el dominio de Railway en el navegador, las WS salen en gris (DISCONNECTED) y pasan a verde al conectarse. Mientras riegan, verde parpadeante con caudal (L/min), volumen (L) y operador. LEAK en rojo y Out of Service en naranja.
9. **Órdenes de la Central:** desde *Central commands* del panel, elegir una WS o ALL: START inicia un riego, BLOCK la pone en naranja "Out of Service" (y corta el riego si estaba regando) y ACTIVATE la devuelve a verde.
10. **Estaciones disponibles:** opción 3 del FO: lista las WS en AVAILABLE con su ubicación.
11. **Riego desde la WS:** `r` + Enter en el Engine: la Central lo valida y empieza el riego.
12. **Riego desde fichero:** lanzar el FO con el fichero (apartado 6): pide los riegos uno detrás de otro sin tocar nada.
13. **Caída de módulos:**
    - `kill` del **Monitor** durante un riego → la estación pasa a `DISCONNECTED` a los 6 s, el Engine termina el riego, muestra "WS AVERIADA" y no admite más riegos.
    - `kill` del **Engine** durante un riego → la estación pasa a LEAK y el FO recibe AVERIADA. Al recuperarlo (`up -d`), el Engine manda lo que ya había regado y el FO recibe FINALIZADO.
    - `kill` del **FO** durante un riego → el riego sigue. Al recuperarlo (`up -d fo1` y `attach fo1`) ve el FINALIZADO.
    - Parar la **Central** en Railway durante un riego → el riego termina. Monitor y FO muestran "Imposible conectar con WM_Central" y no se admiten riegos nuevos. Al volver, los Monitor se autentican solos.
    - Al recuperar cualquier módulo, la estación vuelve a estar disponible sin reiniciar el resto.