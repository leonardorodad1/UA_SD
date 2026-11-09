#Módulo que recibe la información del caudalímetro y activa la electroválvula.
#Se conecta al monitor
import socket
import sys
import  threading
import time
import random
import json
from confluent_kafka import Consumer, Producer,KafkaError
import os

#ARGUMENTOS
# IP y puerto del Broker/Bootstrap-server del gestor de colas.
# IP y puerto del Monitor del WS

HEADER=64
FORMAT = "utf-8"
estado="OK" #vairable globar para controlar el estado 
#nos permite actualizar en tiempo de ejecución el estado

ID_WS=None #nos la manda el monitor cuando nos conectamos
valvula="CERRADA" #electrovalvula: "CERRADA" O "ABIERTA" 
regando=False #si hay riego activo se pone a true

pararRiego=threading.Event() #encargado de parar riego
motivo_parada="PARADAMANUAL" #por que se ha parado el riego: PARADAMANUAL (tecla f) o BLOQUEO (orden STOP de la central)

TOPIC_ORDENES="wm.ordenes" #central deja ordenes en este topic
TOPIC_CAUDAL="wm.caudal"
TOPIC_PETICIONES="wm.peticiones" #pedimos riegos desde la estacion
TOPIC_RESPUESTAS="wm.respuestas" 
TIEMPO_RESPUESTA=15 #segundos max esperando a que la central conteste una peticion manual
respuesta_recibida=threading.Event() 
ts_peticion_manual=None 
TIEMPO_CADUCIDAD=20 # 20 segundos es lo maximo que espera 
#una orden para ser usada, si no lo es en este tiempo 
#se da la orden como caducada
FICHERO_RIEGO="riego_en_curso.json" #aqui guardamos el riego que se hace
#Si acaba bien, borramos el archivo.
#Si se cae, el archivo se guarda.
#Al volver a arrancar, si encuentra el archivo, sabe que se cortó un riego: manda el FIN con lo regado (motivo AVERIA) y borra el archivo.
#El FO recibe su FINALIZADO y el panel guarda el último riego.

def send(objeto_socket,msg):
    message = msg.encode(FORMAT)
    msg_length = len(message)
    send_length = str(msg_length).encode(FORMAT)
    send_length += b' ' * (HEADER - len(send_length))
    objeto_socket.send(send_length)
    objeto_socket.send(message)

def receive(objeto_socket):
    msg_length=objeto_socket.recv(HEADER).decode(FORMAT)
    if msg_length=="":
        return "" # en caso de q cierre monitro, termino
    msg_length=int(msg_length)
    return objeto_socket.recv(msg_length).decode(FORMAT)

    
def leerTeclado():
    global estado
    print("Pulsa Enter para alternar OK -> KO")
    print("Pulsa r y Enter para pedir un riego")
    print("Pulsa f y Enter para finalizar riego")
    while True:
        
        #si usamos
        #input("Pulsa Enter para alternar OK->KO")
        # se queda pillado en caso de que hagamos control+c en la terminal del monitor
        linea=sys.stdin.readline()
        if linea=="":
            #no hay reclado, si no el \n se lee como 
            return
        linea=linea.strip().lower()   #quitamos el salto de linea
        if linea=="":           
            if estado=="KO":
                estado="OK"
            else:
                estado="KO"
                pararRiego.set()# se corta si estaba regando
            print(f"Estado: {estado}")
        elif linea=="r":
            print("Segundos de riego: ", end="", flush=True)
            texto=sys.stdin.readline().strip()
            if not texto.isdigit() or int(texto)<=0:
                print("Tiempo no valido")
            elif regando:
                print("Ya hay un riego en curso en esta estacion")
            else:
                pedirRiegoManual(int(texto))
        elif linea=="f":
            if regando:
                print("Finalizando el riego...")
            pararRiego.set()
        else:
            print("Opción no válida")


#desde la estacion
def pedirRiegoManual(tiempo):
    global ts_peticion_manual
    peticion={"operador": ID_WS, "ws": ID_WS, "tiempo": tiempo, "ts": time.time()}
    ts_peticion_manual=peticion["ts"]
    respuesta_recibida.clear()
    try:
        producer.produce(TOPIC_PETICIONES, key=ID_WS, value=json.dumps(peticion))
    except BufferError:
        print("Imposible enviar la peticion a Kafka, buffer lleno")
        return
    if producer.flush(5)>0:
        print("Imposible conectar con kafka")
        return
    print(f"Peticion de riego manual enviada a la Central ({tiempo} s)")
    if not respuesta_recibida.wait(TIEMPO_RESPUESTA):
        print("Imposible conectar con WM_Central")
        ts_peticion_manual=None


def escucharRespuestas(consumer_resp):
    while True:
        try:
            msg=consumer_resp.poll(1.0)
            if msg is None:
                continue
            if msg.error():
                if msg.error().code() not in (KafkaError.UNKNOWN_TOPIC_OR_PART, KafkaError._PARTITION_EOF):
                    print(f"{msg.error()}")
                continue
            respuesta=json.loads(msg.value().decode(FORMAT))
            if respuesta["operador"]!=ID_WS or respuesta["ts"]!=ts_peticion_manual:
                continue
            if respuesta["resultado"] in ("AUTORIZADA", "DENEGADA"):
                print(f"[CENTRAL] Riego manual {respuesta['resultado']} - {respuesta['motivo']}")
                respuesta_recibida.set()
        except(json.JSONDecodeError, KeyError, TypeError, ValueError):
            continue#ignoramos mensaje no valido
        except Exception as e:
            print(f"Error leyendo respuestas {e}")
            time.sleep(1)

############################
#Caudalimetro
############################

#Mido caudal solo si la válvula esta abierta
def medirCaudal():
    
    if valvula!="ABIERTA":
        return 0.0
    return round(random.uniform(5,20),1)
    #simulamos una medida 

############################
#Conexion con la central, envio de la info por kafka
############################

def publicar(dato):
    try:
        producer.produce(TOPIC_CAUDAL, key=ID_WS, value=json.dumps(dato))
        producer.poll(0)
    except BufferError:
        print("Kafka: buffer lleno, no se ha podido enviar")
 
def enviarCaudal(caudal,volumen,operador,ts):
    print(f"Caudal: {caudal} L/min Volumen acumulado: {round(volumen,3)} L")
    publicar({"ws":ID_WS,"tipo":"CAUDAL","caudal":caudal,"volumen":round(volumen,2),"operador":operador,"ts_peticion":ts})

def enviarFinRiego(resumen,operador,ts):
    print("RESUMEN RIEGO")
    print(f"Fin de riego por {resumen['motivo']}")
    print(f"Duración: {resumen['duracion']} segundos")
    print(f"Volumen total: {round(resumen['volumen'],3)} L")
    
    publicar({"ws":ID_WS,"tipo":"FIN","motivo":resumen["motivo"],"duracion":resumen["duracion"],"volumen":round(resumen["volumen"],2),"operador":operador,"ts_peticion":ts})
    producer.flush(5) #esperamos a que salga y asi no perdemos el riego 
    
######################
#Riego
######################

#lo ejecutamos en su hilo para que 
# siga funcionando el bucle de salud de monitor-engine 

def regar(tiempo,operador,ts):
    
    global regando,valvula,motivo_parada
    
    pararRiego.clear() #quitamos peticion anterior    
    motivo_parada="PARADAMANUAL"
    volumen=0.0
    inicio=time.time()
    motivo="TIEMPO" #si riega los x segundos, 
    #se acaba por tiempo, si pasa algo cambiamos motivo
    
    #abrimos valvula
    valvula="ABIERTA"
    print("Electroválvula abierta")
    
    for segundo in range(tiempo):
        
        if estado=="KO":#fuga
            motivo="FUGA"
            break
        
        caudal=medirCaudal()
        volumen+=caudal/60 # L/min aqui es caudal/60 segundos
        enviarCaudal(caudal,volumen,operador,ts)
        #guardamos cuanto llevamos regado, 
        # si el engine cae, al volver lo enviaremos
        fichero=open(FICHERO_RIEGO, "w")
        json.dump({"operador": operador, "ts": ts, "volumen": volumen, "duracion": round(time.time()-inicio)}, fichero)
        fichero.close()
        if pararRiego.wait(1):# si alguien activa parar riego en ese sec
            if estado=="KO":
                motivo="FUGA"
            else:
                motivo=motivo_parada #PARADAMANUAL si se pulso f, BLOQUEO si lo ordeno la central
            break
    valvula="CERRADA"
    print("Electroválvula cerrada")

    resumen={"motivo":motivo, "duracion":segundo+1, "volumen":volumen}
    #segundos que ha regado 
    
    enviarFinRiego(resumen,operador,ts)
    #si el riego acaba bien, borramos el fichero de riego
    if os.path.exists(FICHERO_RIEGO):
        os.remove(FICHERO_RIEGO)
    
    regando=False
        
def iniciarRiego(tiempo,operador, ts):
    
    global regando
    if regando:
        print("Ya hay un riego en curso, ignoro la orden")
        return
    regando=True
    #lanzamos regar en un hilo propio
    threading.Thread(target=regar,args=(tiempo,operador,ts),daemon=True).start()

######################
#Kafka
######################

#Hilo que lee topic y se queda con las ordenes 
# de la estacion asignada

def escucharOrdenes(consumer):
    global motivo_parada
    while True:
        try:
            msg=consumer.poll(1.0)
            
            if msg is None:
                continue
            if msg.error():
                #el topic no existe hasta la primera orden, no es un error real
                if msg.error().code() not in (KafkaError.UNKNOWN_TOPIC_OR_PART, KafkaError._PARTITION_EOF):
                    print(f"{msg.error()}")
                continue
 
            orden=json.loads(msg.value().decode(FORMAT))

            if orden['ws']!=ID_WS:        
                continue
                #es para otra estacion
            
            print(f"Orden recibida de la Central: {orden}")
            #iniciar riego
            if orden["orden"]=="START":
                iniciarRiego(int(orden["tiempo"]),orden["operador"],orden["ts_peticion"])
            #la central ha bloqueado la estacion y cortamos el riego si lo hay
            elif orden["orden"]=="STOP":
                if regando:
                    print("La Central ha bloqueado la estación. Finalizando el riego...")
                    motivo_parada="BLOQUEO"
                    pararRiego.set()
        except(json.JSONDecodeError, KeyError, TypeError, ValueError):
            continue#ignoramos mensaje no valido
                            
        except Exception as e:

            print(f"Error leyendo ordenes {e}")
            time.sleep(1)


#MAIN
if  (len(sys.argv) == 5):
    IP_K = sys.argv[1]
    PORT_K = int(sys.argv[2])

    IP_M=sys.argv[3]
    PORT_M =int(sys.argv[4])
        
    #Conectamos al monitor
    monitor = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    print("Estableciendo conexión con el monitor")
    ADDR = (IP_M, PORT_M)
    try:
        monitor.connect(ADDR)

    except Exception as e:
        print("Imposible conectar con el Monitor. WS AVERIADA: no se admiten riegos")
        sys.exit(1)

    print (f"Establecida conexión en [{ADDR}]")
    
    #asigno id del monitor al engine
    asignacion=receive(monitor)
    partes=asignacion.split('#')
    
    if partes[0]=="ID":
        ID_WS=partes[1]
        print(f"Engine asignado a {ID_WS}")  
    
    #conectamos con Kafka: productor (caudal) y consumidor (órdenes)
    producer=Producer({"bootstrap.servers": f"{IP_K}:{PORT_K}"})
    
    # si al arrancar existe el fichero, el engine se cayo a mitad de un riego
    if os.path.exists(FICHERO_RIEGO):
        fichero=open(FICHERO_RIEGO)
        pendiente=json.load(fichero)
        fichero.close()
        print(f"Recuperado riego interrumpido de {pendiente['operador']}: {round(pendiente['volumen'],2)} L. Enviando estado final a la Central")
        #enviamos estado
        enviarFinRiego({"motivo":"AVERIA", "duracion":pendiente["duracion"], "volumen":pendiente["volumen"]}, pendiente["operador"], pendiente["ts"])
        os.remove(FICHERO_RIEGO)
        
    consumer=Consumer({
        "bootstrap.servers": f"{IP_K}:{PORT_K}",
        "group.id": f"wm-engine-{ID_WS}-{int(time.time())}", 
        #Cada engine recibe todas las órdenes y filtra las suyas
        "auto.offset.reset": "latest",#solo ordenes nuevas, evitamos errores por distinta hora en los PCs
        "enable.auto.commit": False,
    })
    consumer.subscribe([TOPIC_ORDENES])
    #esperamos a que kafka nos asigne el topic para no perder la primera orden
    limite=time.time()+15
    while not consumer.assignment() and time.time()<limite:
        consumer.poll(0.5)
    hilo_ordenes=threading.Thread(target=escucharOrdenes, args=(consumer,), daemon=True)
    hilo_ordenes.start()
    
    print(f"Escuchando órdenes de la Central en {TOPIC_ORDENES}...")    

    #para riegos desde la estacion
    consumer_resp=Consumer({
        "bootstrap.servers": f"{IP_K}:{PORT_K}",
        "group.id": f"wm-engine-resp-{ID_WS}-{int(time.time())}",
        "auto.offset.reset": "latest", #solo nos interesan las respuestas a partir de ahora
        "enable.auto.commit": False,
    })
    consumer_resp.subscribe([TOPIC_RESPUESTAS])
    hilo_respuestas=threading.Thread(target=escucharRespuestas, args=(consumer_resp,), daemon=True)
    hilo_respuestas.start()
    
    respuesta_teclado=threading.Thread(target=leerTeclado, daemon=True)
    #si el programa principal termina lo mato con daemon=true
    respuesta_teclado.start()
    while True:
        try:
            msg=receive(monitor)
        except OSError:
            msg=""
        if msg=="":
            print("El monitor ha cerrado conexión. WS AVERIADA: no se admiten riegos")
            break               
        if msg=="CONEXION":
            send(monitor,estado)
    
    #si estaba regando, terminamos el riego de forma ordenada para que el FIN llegue a la central y al FO
    if regando:
        motivo_parada="MONITOR"
        pararRiego.set()
        while regando: #esperamos a que el hilo de riego mande el FIN
            time.sleep(0.2)
    monitor.close()
    sys.exit(1)
    
else:
    print ("Parece que algo falló. Necesito estos argumentos: <IP_KAFKA> <PORT_KAFKA> <IP_MONITOR> <PORT_MONITOR>")