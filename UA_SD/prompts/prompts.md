## Prompts Usados con IA
## Recopilación de chats

1.
"Estamos empezando la práctica de SD en Python para hacer un watermanagement. Vamos a trabajar con Sockets TCP, SQLite, Kafka, Docker y Railway. Necesito que me hagas de guía y pienses conmigo la arquitectura. No quiero que me des el código entero, quiero programarlo yo, me recuerdas con la practica 1 las funciones de sockets para el registro y autenticación de las estaciones en la Central, y cómo deberíamos estructurar el bucle principal en el servidor para soportar concurrencia sin perder el estado?"

2.
"bro como puedo comprobar que mi servidor sigue escuchando mientras atiende a varios clientes?, me puedes recordar como iba el servidor concurrente y el tema de los hilos"

3.
"Estoy implementando el módulo Monitor y el engine. El Monitor actúa como servidor de sockets para el Engine y le envía una comprobacion de estado cada sec. He creado un hilo para leer del teclado en el Engine y simular fallos (OK<->KO). Revisa la estructura de mi código, como puedo asegurarme de que si el Engine se cae o se cierra, el Monitor no muera, sino que notifique la avería (LEAK) a la Central y vuelva a ponerse a la escucha para admitir un nuevo Engine sin reiniciar el proceso?"

4.
"Te paso la implementación que he realizado del manejo de averías y actualización en SQLite en central y monitor. He probado la transición de estados LEAK <-> AVAILABLE y funciona, podrías revisar mi código para ver si detectas algún fallo de tipos en los sockets?

5.
"A nivel de código local ya tengo la comunicación socket y la base de datos funcionando. Ahora necesitamos integrar la parte de eventos con Kafka. No tengo ni idea de configurar despliegues con Docker y Railway, necesito que me guies paso a paso sobre cómo estructurar el docker-compose.yml para levantar un broker de Kafka en modo KRaft, y cómo debemos configurar los productores y consumidores en Python (kafka-python / confluent-kafka) para enviar la parte del caudal y volumen."

6.
"Tengo una duda de estructura de carpetas en el entorno local. Si renombro la carpeta raíz del proyecto para ajustar la nomenclatura a la requerida por la asignatura (UA_SD) tendría algun problema, o me renta mas hacer una carpeta UA_SD y meter todo ahí"

7.
"Dime que puntos nos quedan, mira la guia de correccion y analizame punto a punto revisa la practica por si hay algun punto que no aparece en la guia pero está en la practica y me falta"

8.
"holi, tengo que seguir con la practica a partir de este punto de la guia de correción asi que quiero que me ayudes a continuar y explicarme cada decision como y por que, dime si necesitas que te pase algo"

8.
"estoy intentando seguir, en teoria la conexion y el despliegue base ya funciona todo perfectamente, me podrias decir como desplegarlo en los ordenadores de la ua? paso a paso"

9.
"Hay diferencia práctica hay entre pasar argumentos mediante sys.argv, configurar el Start Command de Railway y leer variables de entorno con os.environ? Si configuro el Start Command con los tres argumentos que espera mi programa estaría bien no?, y asi me ahorro tener que modificar mas cosas"

10.
"Cómo tengo q configurar la ruta de SQLite y el volumen de Railway para que las estaciones registradas sigan apareciendo después de reiniciar o redesplegar la Central?"

11.
"Bro, el problema es que no sé cómo va SQLite, como lo añado al proyecto? porque se ponen tres comillas en las consultas SQL?, esq se lo he preguntado a google y me ha dado un ejemplo, necesito que me digas las extensiones para vscode y ver la base de datos desde el programa"

12.
"Me sale el error TypeError: object of type 'sqlite3.Cursor' has no len(), por que pasa esto?"

13.
"que debería hacer cada componente del proyecto y cómo se comunican entre ellos?, esque me he leido la parte del core system pero no veo como se llegan a comunicar y mantienen la concurrencia con los hilos"

14.
"como puedo repartir el trabajo con mi compañera para que no acabemos modificando los mismos archivos? dime como hacemos el reparto, tenemos que hacer ambos un pcoo de todo porque luego en la revisión pueden que me pregunten a mi sibre algo que ha hecho ella y al reves"


15.
"bro necesito que me hagas un script para probar el despliegue entero en la ua, estamos con los 2 ordenadores uno tiene que ser fo y otro monitor/engine, necesito que me hagas un script con la creación de los contenedores"




16.
me puedes dar la guia de desplieuge que hicimos el otro dia para poder meterlo al repositorio, el profesor necesita que se lo pongamos para que el sepa como va

17.
"Necesito que me hagas un readme y una guia de despliegue con todo lo que hemos hecho, luego te reviso y te voy guiando, empieza a partir de mi estructura, quiero que sigas mi punto de arquitercutra y de explicaicon del proyecto"

18.
"si se cae el engine mientras riega, como hago para que no se pierda lo regado y lo mande al volver?, me guardo una global y luego envio la peticion con un mensaje que guarde el resultado del riego o como lo harias tu"


19.
"el punto del session.timeout.ms del consumidor de caudal no lo entiendo, por que tarda 44 segundos cuando riego 45 segundos?"

20.
"hazme una tabla de cuando tengo que reiniciar todo y cuando solo un contenedor, hazme un resumen de docker otra vez"

21.
"con el wifi de la uni no me conecta a railway pero con otra red si, entonces como vamos a hacer el despliegue en los ordenadores de la ua? o al ir por cable lan si que dejara?"

22.
"hazme un resumen de los puntos que me faltan y como resolverlos, ordenamelos por orden de prioridad y urgencia por la guia de despliegue porque si no despliega es un 0"

23.
"bro, cuando hago una consulta con cursor.execute(), que es exactamente lo que devuelve? porque estoy intentando comprobar si existe una estacion antes de insertarla y no termino de entender cuando tengo que usar fetchone(), fetchall() o rowcount."

24.
"Si al arrancar la central pongo todas las estaciones como Disconnected, entonces cuando una estacion se vuelva a autenticar tengo que actualizar su estado a Available, hasta ahi bien pero no entiendo como entiendo como hacer que el parametro que le paso se distinga cuando quiero hacer aut o registrar si paso la id sola como lo hago, concateno el mensaje dependiendo de si esta o no esta o como "

25.
"bro voy a revisar la practica con la guia de correccion y los puntos que me diste el otro dia que me faltan, dime pasos para comprobar cada requisito y asi tacho las partes que me quedan.

26.
"Cuando hago docker attach a fo01 no veo el menu directamente y tengo que pulsar Enter, esperando una entrada, no se si es asi y se han cargado antes el menu o puede ser un problema de como Docker conecta la terminal al contenedor?"

27.
"Como hago para conectar la interfaz a railway, necesito conectarla cuanto antes que no tengo tiempo y voy muy justo, dime paso a paso como hacerlo desde railway"