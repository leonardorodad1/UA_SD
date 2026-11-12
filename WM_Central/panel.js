var ESTADOS = [
  { clave: "AVAILABLE",      texto: "Available" },
  { clave: "WATERING",       texto: "Watering" },
  { clave: "LEAK",           texto: "Leak" },
  { clave: "OUT_OF_SERVICE", texto: "Out of Service" },
  { clave: "DISCONNECTED",   texto: "Disconnected" }
];
var TEXTO_ESTADO = {};
for (var k = 0; k < ESTADOS.length; k++) { TEXTO_ESTADO[ESTADOS[k].clave] = ESTADOS[k].texto; }

var TEXTO_MOTIVO = { "TIEMPO": "time limit", "PARADAMANUAL": "stopped at the station", "FUGA": "leak", "BLOQUEO": "blocked by CENTRAL", "MONITOR": "monitor down", "AVERIA": "engine failure" };
var seleccionada = null;
var marcadas = {};
var filtro_estado = "";
var ahora_central = 0;
var ultimas_estaciones = [];
var ultimos_mensajes = [];
var filtro = "todos";
var LONGITUD_ANILLO = 2 * Math.PI * 44;

function progresoRiego(ws) {
  if (ws.estado != "WATERING" || ws.riego == null) { return null; }
  var lleva = Math.round(ahora_central - ws.riego.inicio);
  if (lleva > ws.riego.tiempo) { lleva = ws.riego.tiempo; }
  if (lleva < 0) { lleva = 0; }
  return { lleva: lleva, total: ws.riego.tiempo };
}

function horaRiego(ts) {
  var opciones = { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", second: "2-digit" };
  var hora = new Date(ts * 1000).toLocaleTimeString("es-ES", opciones);
  var dia = new Date(ts * 1000).toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit" });
  var hoy = new Date(ahora_central * 1000).toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit" });
  return dia == hoy ? hora : dia + " " + hora;
}

function actualizar() {
  fetch("/estado")
    .then(function (respuesta) { return respuesta.json(); })
    .then(function (datos) {
      ahora_central = datos.ahora;
      ultimas_estaciones = datos.estaciones;
      ultimos_mensajes = datos.mensajes;
      quitarMarcasFantasma(datos.estaciones);
      pintarResumen(datos.estaciones);
      pintarMapa(datos.estaciones);
      pintarTabla(datos.estaciones);
      pintarDetalle(datos.estaciones);
      rellenarDesplegable(datos.estaciones);
      actualizarBotones();
      pintarMensajes(datos.mensajes);
      ponerTitulo(datos.estaciones);
      pintarUltimoEvento(datos.mensajes);
      document.getElementById("banner").className = "banner escondida";
      document.getElementById("contenido").className = "panel vista";
      document.getElementById("vivo").className = "vivo";
      document.getElementById("estado_central").textContent = "WM_Central online";
      document.getElementById("hora").textContent = datos.hora;
      document.getElementById("kafka").textContent = "Kafka broker " + datos.kafka;

      if (datos.kafka_ok) {
        document.getElementById("vivo_kafka").className = "vivo";
        document.getElementById("estado_kafka").textContent = "Kafka connected";
      } else {
        document.getElementById("vivo_kafka").className = "vivo caida";
        document.getElementById("estado_kafka").textContent = "Kafka unreachable";
      }
    })
    .catch(function () {

      document.getElementById("banner").className = "banner";
      document.getElementById("contenido").className = "panel vista stale";
      document.getElementById("vivo").className = "vivo caida";
      document.getElementById("estado_central").textContent = "Imposible conectar con WM_Central";
      document.getElementById("vivo_kafka").className = "vivo caida";
      document.getElementById("estado_kafka").textContent = "Kafka unknown";
    });
}

function ponerTitulo(estaciones) {
  var alertas = 0;
  for (var i = 0; i < estaciones.length; i++) {
    if (estaciones[i].estado == "LEAK" || estaciones[i].estado == "DISCONNECTED") { alertas += 1; }
  }
  document.title = (alertas > 0 ? "(" + alertas + ") " : "") + "WaterManagement — Central";
}

function pintarUltimoEvento(mensajes) {
  var html = "<small>Last event</small>";
  if (mensajes.length == 0) {
    html += "<span>No activity yet</span>";
  } else {
    var texto = mensajes[mensajes.length - 1];
    var hora = texto.substring(1, 9);
    var resto = texto.substring(11);
    var corte = resto.indexOf(" - ");
    if (corte >= 0) { html += "<b>" + resto.substring(0, corte) + "</b><span>" + resto.substring(corte + 3) + "</span>"; }
    else { html += "<span>" + resto + "</span>"; }
    html += "<span>" + hora + "</span>";
  }
  document.getElementById("ultimo_evento").innerHTML = html;
}

function quitarMarcasFantasma(estaciones) {
  var existen = {};
  for (var i = 0; i < estaciones.length; i++) { existen[estaciones[i].id] = true; }
  for (var id in marcadas) { if (!existen[id]) { delete marcadas[id]; } }
}

function pasaEstado(ws) { return filtro_estado == "" || ws.estado == filtro_estado; }
function pasaBusqueda(ws) {
  var texto = document.getElementById("buscar").value.trim().toLowerCase();
  return texto == "" || (ws.id + " " + ws.ubicacion).toLowerCase().indexOf(texto) >= 0;
}

function alternarEstado(clave) { elegirEstado(filtro_estado == clave ? "" : clave); }

function elegirEstado(clave) {
  filtro_estado = clave;
  document.getElementById("filtro_estado").value = clave;
  pintarResumen(ultimas_estaciones);
  pintarMapa(ultimas_estaciones);
  pintarTabla(ultimas_estaciones);
}

function pintarResumen(estaciones) {
  var cuenta = { "AVAILABLE": 0, "WATERING": 0, "LEAK": 0, "OUT_OF_SERVICE": 0, "DISCONNECTED": 0 };
  var total = 0;
  for (var i = 0; i < estaciones.length; i++) {
    cuenta[estaciones[i].estado] += 1;
    if (estaciones[i].estado == "WATERING") { total += estaciones[i].caudal; }
  }
  var html = "";
  for (var j = 0; j < ESTADOS.length; j++) {
    var clave = ESTADOS[j].clave;
     var clase = filtro_estado == "" ? "" : (filtro_estado == clave ? " filtrada" : " apagada");
     var latido = "";
     if (clave == "WATERING") {
       latido = " latiendo' style='--t:" + ((Date.now() / 1000) % 1.2).toFixed(2) + "s";
     }
     html += "<div class='estado" + clase + latido + "' onclick=\"alternarEstado('" + clave + "')\" title='Click to filter by this status'>"
      + "<span class='muestra " + clave + "'></span>"
      + "<span class='cuenta numero'>" + cuenta[clave] + "</span>"
      + "<span class='nombre'>" + ESTADOS[j].texto + "</span></div>";
  }

  html += "<div class='estado total'><span class='cuenta numero'>" + total.toFixed(1) + "<small>L/min</small></span>"
    + "<span class='nombre'>Flowing now</span></div>";
  document.getElementById("resumen").innerHTML = html;
}

var LEYENDA = "<div class='leyenda'><span><i style='background:#2e9e5b'></i>Available</span>"
  + "<span><i style='background:#2e9e5b;box-shadow:0 0 0 3px rgba(46,158,91,.3)'></i>Watering</span>"
  + "<span><i style='background:#d63c3c'></i>Leak</span><span><i style='background:#e8800c'></i>Out of Service</span>"
  + "<span><i style='background:#9b9a90'></i>Disconnected</span></div>";

function pintarMapa(estaciones) {
  var zonas = {};
  var orden = [];
  for (var i = 0; i < estaciones.length; i++) {
    var ws = estaciones[i];
    if (!(ws.ubicacion in zonas)) { zonas[ws.ubicacion] = []; orden.push(ws.ubicacion); }
    zonas[ws.ubicacion].push(ws);
  }
  var html = "";
  for (var z = 0; z < orden.length; z++) {
    var ubicacion = orden[z];
    html += "<div class='zona forma" + (z % 4) + "'><div class='nombre'>" + ubicacion + "</div><div class='puntos'>";
    for (var j = 0; j < zonas[ubicacion].length; j++) {
      var est = zonas[ubicacion][j];
      var elegido = est.id == seleccionada ? " elegido" : "";
      var atenuado = pasaEstado(est) ? "" : " atenuado";
      html += "<button class='punto" + elegido + atenuado + "' title='" + est.id + ": " + TEXTO_ESTADO[est.estado] + "' onclick=\"seleccionar('" + est.id + "')\">"
        + "<span class='circulo " + est.estado + "'></span>" + est.id + "</button>";
    }
    html += "</div></div>";
  }
  if (orden.length == 0) { html = "<p class='aviso'>No stations registered yet. They appear here when a monitor registers with WM_Central.</p>"; }
  document.getElementById("mapa").innerHTML = html + LEYENDA;
  document.getElementById("num_zonas").textContent = orden.length;
}

function pintarTabla(estaciones) {
  var html = "";
  var visibles = 0, marcadas_visibles = 0;
  for (var i = 0; i < estaciones.length; i++) {
    var ws = estaciones[i];
    if (!pasaEstado(ws) || !pasaBusqueda(ws)) { continue; }
    visibles += 1;
    var regando = ws.estado == "WATERING";
    var clase = (ws.id == seleccionada ? " elegida" : "") + (marcadas[ws.id] ? " marcada" : "");
    if (marcadas[ws.id]) { marcadas_visibles += 1; }
    html += "<tr class='" + clase.trim() + "' onclick=\"seleccionar('" + ws.id + "')\">"
      + "<td onclick='event.stopPropagation()'><input type='checkbox' " + (marcadas[ws.id] ? "checked" : "") + " onchange=\"marcar('" + ws.id + "', this.checked)\" aria-label='Select " + ws.id + "' /></td>"
      + "<td class='id'><span class='idb'>" + ws.id + "</span></td>"
      + "<td>" + ws.ubicacion + "</td>"
      + "<td><span class='etiqueta " + ws.estado + "'>" + TEXTO_ESTADO[ws.estado] + "</span>"
      + (progresoRiego(ws) ? "<span class='progreso-tabla numero'><span class='barra'><i style='width:" + Math.round(progresoRiego(ws).lleva * 100 / progresoRiego(ws).total) + "%'></i></span>" + progresoRiego(ws).lleva + " / " + progresoRiego(ws).total + " s</span>" : "")
      + "</td>"
      + "<td class='derecha numero'>" + ws.caudal.toFixed(1) + "</td>"
      + "<td class='derecha numero'>" + ws.volumen.toFixed(2) + "</td>"
      + "<td>" + (regando ? ws.operador : "<span class='vacio'>—</span>") + "</td>"
      + "<td>" + (ws.ultimo_fin ? "<span class='numero'>" + horaRiego(ws.ultimo_fin) + "</span>" : "<span class='vacio'>Never</span>") + "</td>"
      + "<td class='mas' onclick=\"abrirMenu(event, '" + ws.id + "')\" title='Orders for this station'>⋯</td>"
      + "</tr>";
  }
  if (estaciones.length == 0) { html = "<tr><td colspan='9' class='aviso'>No stations registered yet.</td></tr>"; }
  else if (visibles == 0) { html = "<tr><td colspan='9' class='aviso'>No stations match this filter.</td></tr>"; }
  document.getElementById("tabla").innerHTML = html;
  document.getElementById("num_estaciones").textContent = estaciones.length;
  document.getElementById("marcar_todas").checked = visibles > 0 && marcadas_visibles == visibles;
}

function pintarDetalle(estaciones) {
  if (seleccionada == null) { return; }
  for (var i = 0; i < estaciones.length; i++) {
    var ws = estaciones[i];
    if (ws.id == seleccionada) {
      var regando = ws.estado == "WATERING";
      var progreso = progresoRiego(ws);
      var sin_dato = regando && !progreso;
      var porcentaje = progreso ? Math.round(progreso.lleva * 100 / progreso.total) : (sin_dato ? 30 : 0);
      var desplazamiento = LONGITUD_ANILLO * (1 - porcentaje / 100);
      var ultimo;
      if (ws.ultimo_fin) {
        ultimo = "<div class='fila-dato'><span>Finished at</span><b class='numero'>" + horaRiego(ws.ultimo_fin) + "</b></div>"
          + "<div class='fila-dato'><span>Requested by</span><b>" + ws.ultimo_operador + "</b></div>"
          + "<div class='fila-dato'><span>Water used</span><b class='numero'>" + ws.ultimo_volumen.toFixed(2) + " L</b></div>"
          + "<div class='fila-dato'><span>Ended by</span><b>" + (TEXTO_MOTIVO[ws.ultimo_motivo] || ws.ultimo_motivo) + "</b></div>";
      } else {
        ultimo = "<div class='fila-dato'><span>This station has not watered yet</span></div>";
      }
      document.getElementById("detalle").innerHTML =
          "<div class='detalle'>"
        + "<p class='titulo'>" + ws.id + "</p>"
        + "<p class='lugar'>" + ws.ubicacion + "</p>"
        + "<span class='etiqueta " + ws.estado + "'>" + TEXTO_ESTADO[ws.estado] + "</span>"
        + "<div class='medidor'>"
        + "<div class='anillo" + (sin_dato ? " girando" : "") + "'><svg viewBox='0 0 104 104'><circle class='fondo' cx='52' cy='52' r='44' />"
        + "<circle class='relleno' cx='52' cy='52' r='44' stroke-dasharray='" + LONGITUD_ANILLO + "' stroke-dashoffset='" + desplazamiento + "' /></svg>"
        + "<div class='centro'><b class='numero'>" + ws.caudal.toFixed(1) + "</b><small>L/min</small></div></div>"
        + "<div class='cajas'><div>Supplied<b class='numero'>" + ws.volumen.toFixed(2) + " L</b></div>"
        + "<div>Progress<b class='numero'>" + (progreso ? progreso.lleva + " / " + progreso.total + " s" : "—") + "</b></div></div>"
        + "</div>"
        + "<div class='fila-dato'><span>Operator</span><b>" + (regando ? ws.operador : "—") + "</b></div>"
        + "<div class='fila-dato'><span>Valve</span><b>" + (regando ? "Open" : "Closed") + "</b></div>"
        + "<p class='subtitulo'>Last watering</p>"
        + ultimo
        + "</div>";
    }
  }
}

var lista_desplegable = "";
function rellenarDesplegable(estaciones) {
  var lista = "";
  for (var i = 0; i < estaciones.length; i++) { lista += estaciones[i].id + ","; }
  if (lista == lista_desplegable) { return; }
  lista_desplegable = lista;

  var filtro_ws = document.getElementById("filtro_ws");
  var elegida_filtro = filtro_ws.value;
  var html_filtro = "<option value=''>All stations</option>";
  for (var j = 0; j < estaciones.length; j++) {
    html_filtro += "<option value='" + estaciones[j].id + "'>" + estaciones[j].id + "</option>";
  }
  filtro_ws.innerHTML = html_filtro;
  filtro_ws.value = elegida_filtro;
}

function marcar(id, valor) {
  if (valor) { marcadas[id] = true; } else { delete marcadas[id]; }
  pintarTabla(ultimas_estaciones);
  actualizarBotones();
}

function marcarTodas(valor) {
  if (valor === undefined) { valor = true; }
  for (var i = 0; i < ultimas_estaciones.length; i++) {
    var ws = ultimas_estaciones[i];
    if (!pasaEstado(ws) || !pasaBusqueda(ws)) { continue; }
    if (valor) { marcadas[ws.id] = true; } else { delete marcadas[ws.id]; }
  }
  pintarTabla(ultimas_estaciones);
  actualizarBotones();
}

function limpiarSeleccion() {
  marcadas = {};
  pintarTabla(ultimas_estaciones);
  actualizarBotones();
}

function sirveOrden(orden, estado) {
  if (orden == "START") { return estado == "AVAILABLE"; }
  if (orden == "BLOCK") { return estado != "DISCONNECTED" && estado != "OUT_OF_SERVICE"; }
  return estado == "OUT_OF_SERVICE";
}

function idsMarcados() {
  var ids = [];
  for (var i = 0; i < ultimas_estaciones.length; i++) {
    if (marcadas[ultimas_estaciones[i].id]) { ids.push(ultimas_estaciones[i].id); }
  }
  return ids;
}

function actualizarBotones() {
  var ids = idsMarcados();
  var puede = { "START": false, "BLOCK": false, "ACTIVATE": false };
  for (var i = 0; i < ultimas_estaciones.length; i++) {
    var ws = ultimas_estaciones[i];
    if (!marcadas[ws.id]) { continue; }
    for (var orden in puede) { if (sirveOrden(orden, ws.estado)) { puede[orden] = true; } }
  }
  document.getElementById("cuenta_lote").textContent = ids.length + (ids.length == 1 ? " station selected" : " stations selected");
  document.getElementById("boton_START").disabled = !puede.START;
  document.getElementById("boton_BLOCK").disabled = !puede.BLOCK;
  document.getElementById("boton_ACTIVATE").disabled = !puede.ACTIVATE;
  document.getElementById("boton_limpiar").disabled = ids.length == 0;
}

function arreglarTiempo() {
  var campo = document.getElementById("tiempo");
  var valor = parseInt(campo.value, 10);
  if (isNaN(valor) || valor < 1) { valor = 1; }
  campo.value = valor;
  return valor;
}
function cambiarTiempo(salto) {
  var campo = document.getElementById("tiempo");
  campo.value = arreglarTiempo() + salto;
  arreglarTiempo();
}

function pasaFiltro(texto) {
  var ws = document.getElementById("filtro_ws").value;
  if (ws != "" && texto.indexOf(ws) < 0) { return false; }
  if (filtro == "peticiones") { return texto.indexOf("petición") >= 0 || texto.indexOf("inicio de riego") >= 0 || texto.indexOf("Fin por") >= 0; }
  if (filtro == "fugas")      { return texto.indexOf("fuga") >= 0 || texto.indexOf("LEAK") >= 0; }
  if (filtro == "central")    { return texto.indexOf("CENTRAL -") >= 0; }
  if (filtro == "conexion")   { return texto.indexOf("autenticada") >= 0 || texto.indexOf("registrada") >= 0 || texto.indexOf("DISCONNECTED") >= 0 || texto.indexOf("Kafka") >= 0; }
  return true;
}

function elegirFiltro(nombre) {
  filtro = nombre;
  var nombres = ["todos", "peticiones", "fugas", "central", "conexion"];
  for (var i = 0; i < nombres.length; i++) {
    document.getElementById("filtro_" + nombres[i]).className = nombres[i] == nombre ? "filtro activo" : "filtro";
  }
  pintarMensajes(ultimos_mensajes);
}

function pintarMensajes(mensajes) {
  var html = "";
  var mostrados = 0;
  for (var i = mensajes.length - 1; i >= 0; i--) {
    var texto = mensajes[i];
    if (!pasaFiltro(texto)) { continue; }
    mostrados += 1;
    var hora = texto.substring(1, 9);
    var resto = texto.substring(11);
    var color = "";
    if (texto.indexOf("resuelta") >= 0) { color = "verde"; }
    else if (texto.indexOf("LEAK") >= 0 || texto.indexOf("fuga") >= 0) { color = "rojo"; }
    else if (texto.indexOf("DISCONNECTED") >= 0) { color = "gris"; }
    else if (texto.indexOf("perdido") >= 0) { color = "rojo"; }
    else if (texto.indexOf("DENEGADA") >= 0 || texto.indexOf("OUT_OF_SERVICE") >= 0 || texto.indexOf("no se puede") >= 0) { color = "naranja"; }
    else if (texto.indexOf("AUTORIZADA") >= 0 || texto.indexOf("autenticada") >= 0 || texto.indexOf("registrada") >= 0 || texto.indexOf("activada") >= 0 || texto.indexOf("conectada con Kafka") >= 0) { color = "verde"; }
    html += "<div class='msg'><span class='hora'>" + hora + "</span><span class='tipo " + color + "'></span><span>" + resto + "</span></div>";
  }
  if (mensajes.length == 0) { html = "<p class='aviso' style='padding:6px 0'>No activity yet. Requests, leaks and disconnections will be listed here.</p>"; }
  else if (mostrados == 0) { html = "<p class='aviso' style='padding:6px 0'>No messages match this filter.</p>"; }
  document.getElementById("mensajes").innerHTML = html;
}

function seleccionar(id) {
  seleccionada = id;
  actualizar();
}

function abrirMenu(evento, id) {
  evento.stopPropagation();
  var estado = "";
  for (var i = 0; i < ultimas_estaciones.length; i++) { if (ultimas_estaciones[i].id == id) { estado = ultimas_estaciones[i].estado; } }
  var menu = document.getElementById("menu_fila");
  menu.innerHTML =
      "<button " + (sirveOrden("START", estado) ? "" : "disabled") + " onclick=\"ordenFila('START','" + id + "')\">Start watering</button>"
    + "<button class='peligro' " + (sirveOrden("BLOCK", estado) ? "" : "disabled") + " onclick=\"ordenFila('BLOCK','" + id + "')\">Put out of service</button>"
    + "<button " + (sirveOrden("ACTIVATE", estado) ? "" : "disabled") + " onclick=\"ordenFila('ACTIVATE','" + id + "')\">Activate</button>";
  menu.style.left = Math.min(evento.pageX, window.innerWidth - 220) + "px";
  menu.style.top = (evento.pageY + 6) + "px";
  menu.className = "menu-fila";
}
function cerrarMenu() { document.getElementById("menu_fila").className = "menu-fila escondida"; }
function ordenFila(orden, id) { cerrarMenu(); mandarOrden(orden, [id]); }
document.addEventListener("click", cerrarMenu);
document.addEventListener("keydown", function (e) { if (e.key == "Escape") { cerrarMenu(); } });

var orden_pendiente = null;
var TEXTO_ORDEN = {
  "START":    { verbo: "Start watering", boton: "Start watering" },
  "BLOCK":    { verbo: "Put out of service", boton: "Put out of service" },
  "ACTIVATE": { verbo: "Activate", boton: "Activate" }
};

function textoConfirmacion(orden, todas, n) {
  var quien = todas ? "Every available station" : "The " + n + " eligible stations";
  if (orden == "START") { return quien + " will open " + (todas ? "its valve" : "their valves") + " for " + arreglarTiempo() + " s."; }
  if (orden == "BLOCK") { return "Any watering in progress will stop and no station will accept new requests until you activate it again."; }
  return "Every selected station that is out of service will become available again.";
}

function enviarOrden(orden) {
  var ids = idsMarcados();
  if (ids.length == 0) { return; }

  var todas = ids.length > 1 && ids.length == ultimas_estaciones.length;
  var objetivos = [];
  if (todas) { objetivos = ["ALL"]; }
  else {
    for (var i = 0; i < ultimas_estaciones.length; i++) {
      if (marcadas[ultimas_estaciones[i].id] && sirveOrden(orden, ultimas_estaciones[i].estado)) { objetivos.push(ultimas_estaciones[i].id); }
    }
  }
  if (objetivos.length == 0) { return; }
  if (ids.length > 1) {

    orden_pendiente = { orden: orden, objetivos: objetivos };
    var quien = todas ? "all stations" : objetivos.length + " stations";
    document.getElementById("conf_titulo").textContent = TEXTO_ORDEN[orden].verbo + " at " + quien + "?";
    document.getElementById("conf_texto").textContent = textoConfirmacion(orden, todas, objetivos.length);
    document.getElementById("conf_aceptar").textContent = TEXTO_ORDEN[orden].boton;
    document.getElementById("conf_aceptar").className = "conf-aceptar " + orden;
    document.getElementById("confirmacion").showModal();
    return;
  }
  mandarOrden(orden, objetivos);
}

function cerrarConfirmacion() {
  orden_pendiente = null;
  document.getElementById("confirmacion").close();
}

function confirmarOrden() {
  var pendiente = orden_pendiente;
  cerrarConfirmacion();
  mandarOrden(pendiente.orden, pendiente.objetivos);
}

function mandarOrden(orden, objetivos) {
  var tiempo = arreglarTiempo();
  var respuesta_orden = document.getElementById("respuesta_orden");
  var respuestas = [];
  var fallo = false;
  respuesta_orden.textContent = "Sending order to " + (objetivos.length > 1 ? objetivos.length + " stations" : objetivos[0]) + "...";
  respuesta_orden.className = "";
  function siguiente(n) {
    if (n == objetivos.length) {
      respuesta_orden.textContent = respuestas.join("  ·  ");
      respuesta_orden.className = fallo ? "fallo" : "hecho";
      actualizar();
      return;
    }
    fetch("/orden?accion=" + orden + "&ws=" + objetivos[n] + "&tiempo=" + tiempo)
      .then(function (respuesta) { return respuesta.text(); })
      .then(function (texto) {
        respuestas.push(texto);

        if (texto.indexOf("Kafka no disponible") >= 0 || texto.indexOf("no valid") >= 0) { fallo = true; }
        siguiente(n + 1);
      })
      .catch(function () { respuesta_orden.textContent = "The order was not sent: WM_Central is not responding"; respuesta_orden.className = "fallo"; });
  }
  siguiente(0);
}

function verSeccion(nombre) {
  var secciones = ["estaciones", "mapa"];
  for (var i = 0; i < secciones.length; i++) {
    var visible = secciones[i] == nombre;
    document.getElementById("seccion_" + secciones[i]).className = visible ? (secciones[i] == "estaciones" ? "tabla-scroll" : "") : "escondida";
    document.getElementById("pestana_" + secciones[i]).className = visible ? "on" : "";
  }
  document.getElementById("herramientas").className = nombre == "mapa" ? "herramientas escondida" : "herramientas";
  document.getElementById("titulo_vista").textContent = nombre == "mapa" ? "Network map" : "Watering stations";
  history.replaceState(null, "", nombre == "mapa" ? "#map" : "#stations");
}

if (location.hash == "#map") { verSeccion("mapa"); }
actualizar();
setInterval(actualizar, 1000);