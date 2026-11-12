# WaterManagement – Guía de despliegue

Esta guía explica cómo se despliega el escenario de la práctica y cómo se comprueba que funciona. Es la misma que seguimos el día de la corrección.

Todo se despliega con **Docker**, desde **PowerShell** y sin abrir ningún IDE ni compilar nada: se clona el repositorio y se lanza un script.

## 1. Escenario

```
 PC LAB 1                     Railway (Cloud)                    PC LAB 2
┌──────────────┐        ┌───────────────────────┐        ┌──────────────────────────┐
│ WM_FO (fo1)  │        │ WM_Central            │        │ WM_WS 1 (Monitor+Engine) │
│ WM_FO (fo2)  │◄──────►│ BD SQLite (volumen)   │◄──────►│ WM_WS 2 (Monitor+Engine) │
│ + FO extra   │ Kafka  │ Kafka                 │ Kafka  │ + WS extra               │
└──────────────┘        └───────────┬───────────┘ +sockets (Monitor ↔ Central)
                                    │ HTTPS (dominio de Railway → puerto 8080)
                             ┌──────┴───────┐
                             │  Navegador   │  Panel web de WM_Central
                             └──────────────┘
```

- **Cloud (Railway):** WM_Central, la base de datos SQLite (en un volumen montado en `/data`) y Kafka. La Central se vuelve a desplegar sola al hacer push a `master` (CI/CD: VS Code → GitHub → Railway).
- **PC LAB 1:** los operarios de campo (`fo1`, `fo2` y los que se añadan).
- **PC LAB 2:** las estaciones de riego (`ws1`, `ws2` y las que se añadan), cada una con su Monitor y su Engine.
- **Navegador:** el panel de WM_Central se abre con el dominio público de Railway, sin instalar nada.
- Los dos PCs del laboratorio **no se hablan entre sí**: todo pasa por Railway.

## 2. Ficheros que intervienen en el despliegue

```
WM_Central/             Central (Dockerfile, requirements.txt, WM_CENTRAL.py, panel.html, panel.css, panel.js)
WM_FO/                  Operario (Dockerfile, requirements.txt, WM_FO.py, servicios/)
WM_WS/WM_M/             Monitor de la estación (Dockerfile, WM_WS_M.py)
WM_WS/WM_E/             Engine de la estación (Dockerfile, requirements.txt, WM_WS_E.py)
docker-compose.fo.yml   PC de operarios: fo1 y fo2
docker-compose.ws.yml   PC de estaciones: ws1-monitor, ws1-engine, ws2-monitor, ws2-engine
docker-compose.yml      Todo en un solo PC con un Kafka local (solo para pruebas en casa)
.env                    Direcciones de Railway e IDs de las WS y operarios
desplegar.ps1           Despliega un PC entero (estaciones u operarios)
nuevaWS.ps1             Añade UNA estación más sin tocar las demás
nuevoFO.ps1             Añade UN operario más sin tocar los demás
```

## 3. Parámetros de cada módulo

Ningún dato está fijo en el código: todo se pasa por argumentos. En Docker, los compose y los scripts los rellenan con los valores del `.env`.

| Módulo | Argumentos |
|---|---|
| WM_Central | `<Puerto> <IP_Kafka> <Puerto_Kafka> [Puerto_web]` (sin puerto web, el panel usa el 8080) |
| WM_WS_M (Monitor) | `<Puerto para el Engine> <IP Central> <Puerto Central> <ID_WS>` |
| WM_WS_E (Engine) | `<IP_Kafka> <Puerto_Kafka> <IP Monitor> <Puerto Monitor>` |
| WM_FO | `<IP_Kafka> <Puerto_Kafka> <ID_Operador> [fichero]` |

La ruta de la base de datos de la Central se cambia con la variable de entorno `WM_DB_PATH`.

### Fichero `.env`

```
IP_KAFKA=turntable.proxy.rlwy.net        # TCP Proxy de Kafka en Railway
PUERTO_KAFKA=42333
IP_CENTRAL=centerbeam.proxy.rlwy.net     # TCP Proxy de WM_Central en Railway
PUERTO_CENTRAL=45361
WS1_ID=WS-01
WS2_ID=WS-02
OP1_ID=OP-01
OP2_ID=OP-02
```

Los IDs de las estaciones tienen que ser **únicos en todo el sistema**: no puede haber dos instancias con el mismo ID, ni en el mismo PC ni en PCs distintos.

## 4. Requisitos del PC del laboratorio (Windows)

- **Docker Desktop** instalado y abierto
- **Git**, para clonar el repositorio desde PowerShell.
- Acceso de red a las direcciones de Railway del `.env`. El script lo comprueba.
- **No** hace falta Python ni entornos virtuales: cada contenedor lleva su propio Python y sus librerías, que se instalan al construir la imagen.

## 5. Parte Cloud (Railway), que llega ya desplegada

**Kafka**
1. Servicio con la imagen oficial `apache/kafka` en modo KRaft (sin Zookeeper).
2. Dos listeners: uno interno en el puerto 9092 (para la Central, por la red interna de Railway) y otro externo en el 9094, anunciado con la dirección del TCP Proxy (para los PCs del laboratorio).
3. TCP Proxy al puerto 9094. Su dirección va en el `.env` como `IP_KAFKA` y `PUERTO_KAFKA`.

**WM_Central**
1. Servicio conectado al repositorio de GitHub, rama `master`, con *Root Directory* = `WM_Central` (así Railway usa su Dockerfile).
2. *Start Command* con los argumentos de la Central: `5000 kafka.railway.internal 9092` (el panel usa el 8080 por defecto).
3. Volumen montado en `/data`, donde vive `watermanagment.db`.
4. TCP Proxy al puerto 5000 (sockets de los Monitor). Su dirección va en el `.env` como `IP_CENTRAL` y `PUERTO_CENTRAL`.
5. Dominio público HTTPS hacia el puerto 8080: es la dirección del panel (`uasd-production-2f15.up.railway.app`). Solo lo usa el navegador; los FO, Monitor y Engine usan los TCP Proxy.
6. En *Deploy Logs* tiene que salir la lista de estaciones en `DISCONNECTED`, `Escuchando el topic wm.peticiones...`, `Escuchando el topic wm.caudal...` y `[WEB] Panel disponible en el puerto 8080`.

Para volver a desplegar se hace push a `master`. No se usa *Redeploy* sobre un despliegue antiguo, porque reconstruye el código viejo.

## 6. Despliegue en el laboratorio

### 6.1 Preparar cada PC (los dos)

1. Abrir **Docker Desktop** y esperar a que esté listo.
2. Abrir **PowerShell**, clonar el repositorio y entrar en la carpeta:

   ```powershell
   cd $env:USERPROFILE\Desktop
   git clone https://github.com/leonardorodad1/UA_SD.git
   cd UA_SD
   ```
3. Revisar el `.env` (direcciones de Railway e IDs de ese PC).
4. Abrir el panel en el navegador y dejarlo a la vista.

### 6.2 Lanzar el script `desplegar.ps1`

**PC LAB 2 (estaciones):**
```powershell
powershell -ExecutionPolicy Bypass -File .\desplegar.ps1 -Modo ws
```

**PC LAB 1 (operarios):**
```powershell
powershell -ExecutionPolicy Bypass -File .\desplegar.ps1 -Modo fo
```

Al terminar, el script **abre una ventana de PowerShell por cada módulo** (cada Monitor, cada Engine y cada FO). En cada ventana se ve primero lo último que escribió el módulo y después queda conectado el teclado, así que se puede usar su menú directamente.

Opciones del script:

| Opción | Qué hace |
|---|---|
| `-Modo ws` / `-Modo fo` | PC de estaciones o PC de operarios (obligatorio) |
| `-Estaciones WS-03,WS-04,...` | Además de ws1 y ws2, arranca esas estaciones (tienen que estar ya registradas) |
| `-Operarios OP-11,OP-12=servicios.txt,...` | Además de fo1 y fo2, lanza esos operarios, cada uno en su ventana. Con `=fichero` leen ese fichero solos, sin tocar nada |
| `-Pull` | Hace `git pull` antes de desplegar |
| `-NoCache` | Reconstruye las imágenes desde cero |
| `-Parar` | Solo para y borra los contenedores de ese PC (también los extra) |

Ejemplo del escenario en el que se añaden estaciones y operadores aparte de los que se crean por defecto siempre.
```powershell
# PC LAB 2
powershell -ExecutionPolicy Bypass -File .\desplegar.ps1 -Modo ws -Estaciones WS-03,WS-04,WS-05,WS-06,WS-07

# PC LAB 1
powershell -ExecutionPolicy Bypass -File .\desplegar.ps1 -Modo fo -Operarios OP-11=servicios.txt,OP-12=servicios.txt,OP-13=servicios.txt,OP-14=servicios.txt
```

Qué hace el script, por orden:
1. Comprueba que Docker responde.
2. Comprueba con `Test-NetConnection` que el PC llega a Kafka y a la Central en Railway. Si no llega, se para y avisa.
3. Muestra el `.env` para revisarlo.
4. Si se le pasa `-Pull`, hace `git pull`, y muestra la versión que se despliega.
5. Para y borra los contenedores anteriores de ese PC.
6. Construye las imágenes **de una en una**. Las dos WS (y los dos FO) comparten imagen y, si se construyen a la vez, Docker da el error `image already exists`.
7. Arranca los contenedores del compose.
8. Arranca las estaciones u operarios extra. En cada estación extra espera a que el Monitor se autentique antes de lanzar su Engine. Si una WS no está registrada, avisa y dice que se registre con `nuevaWS.ps1`.
9. Abre una ventana por módulo.
10. Muestra el estado de todos los contenedores.

> **Importante:** `desplegar.ps1` borra todo lo de ese PC antes de arrancar (paso 6). Con el sistema funcionando **no se vuelve a lanzar**, porque cortaría los riegos en marcha. Para añadir instancias se usan `nuevaWS.ps1` y `nuevoFO.ps1` (apartado 6.3).

**Equivalente manual, sin script:**
```powershell
# PC de estaciones
docker compose -f docker-compose.ws.yml build ws1-monitor
docker compose -f docker-compose.ws.yml build ws1-engine
docker compose -f docker-compose.ws.yml up -d

# PC de operarios
docker compose -f docker-compose.fo.yml build fo1
docker compose -f docker-compose.fo.yml up -d
```

### 6.3 Añadir una instancia más con todo funcionando

Las imágenes ya están construidas, así que se añaden instancias sin recompilar y sin parar las demás.

**Una estación nueva (PC LAB 2):**
Ejemplo estacion WS-08
```powershell
powershell -ExecutionPolicy Bypass -File .\nuevaWS.ps1 WS-08
```
1. El script lanza el Monitor (`ws08-monitor`) y lo abre en una ventana propia, mostrando lo que ya ha escrito.
2. Si la WS no está registrada, en esa ventana el Monitor pregunta si se quiere registrar: escribir `Y`, Enter, la ubicación (por ejemplo `Parque Lo Torrent`) y Enter. Si ya estaba registrada, se autentica solo.
3. En cuanto el Monitor se autentica, el script lanza el Engine (`ws08-engine`) conectado a su Monitor y lo abre también en su propia ventana. Mientras el Engine no está conectado, la WS aparece en rojo (Leak); cuando se conecta, pasa a verde.
4. Desde la ventana del Engine se usa su menú (Enter = fuga, `r` = riego, `f` = finalizar).

El registro solo hace falta la primera vez, porque queda guardado en la BD de Railway. Después la WS arranca directamente, también con `desplegar.ps1 -Estaciones`.

**Un operario nuevo (PC LAB 1):**
```powershell
powershell -ExecutionPolicy Bypass -File .\nuevoFO.ps1 OP-20                  # con menú
powershell -ExecutionPolicy Bypass -File .\nuevoFO.ps1 OP-20 servicios.txt    # lee el fichero solo
```
El fichero se busca en `WM_FO/servicios/`.

Por dentro, los dos scripts leen las direcciones del `.env` y usan `docker compose run` sobre un servicio que ya existe (`ws1-monitor`, `ws1-engine` o `fo2`) cambiándole los argumentos. Así la nueva instancia usa la misma imagen y entra en la misma red del compose, y el Engine encuentra a su Monitor por el nombre del contenedor.

## 7. Manejo de los módulos

| Qué | Comando |
|---|---|
| Ver todos los contenedores | `docker ps -a` |
| Ver lo que hace un módulo sin entrar | `docker logs -f --tail 20 ws1-engine` |
| Entrar al menú de un módulo | `docker attach fo1` (o `ws1-engine`, `ws08-monitor`…) |
| Salir sin pararlo | Ctrl+P y después Ctrl+Q (**nunca** Ctrl+C, que lo cierra) |
| Simular un crash | `docker kill ws1-monitor` (o `ws03-engine`, `fo1`…) |
| Levantarlo otra vez | `docker start -ai ws1-monitor` |
| Apagar un PC | `powershell -ExecutionPolicy Bypass -File .\desplegar.ps1 -Modo ws -Parar` (o `-Modo fo`) |

`docker kill` lo para de golpe. `docker start -ai` arranca **el mismo contenedor** con sus ficheros, así el Engine encuentra su `riego_en_curso.json` y manda lo que había regado.

Los operarios lanzados con `nuevoFO.ps1` o con `-Operarios` se borran al pararlos (`--rm`). Para recuperarlos se lanza otra vez el mismo ID (`.\nuevoFO.ps1 OP-11`): como el grupo de Kafka es fijo por operario, recibe el resultado de su riego.

### Teclas del Engine (menú de la WS)
- **Enter:** alterna OK / KO (simula una fuga). 
- **`r` + Enter:** pide un riego desde la propia estación.
- **`f` + Enter:** termina el riego en curso.

### Menú del FO
1. Solicitar riego (estación y segundos).
2. Leer servicios de un fichero (por ejemplo `servicios/servicios.txt`, una línea por riego: `WS-01#10`).
3. Ver estaciones disponibles.
4. Salir.
