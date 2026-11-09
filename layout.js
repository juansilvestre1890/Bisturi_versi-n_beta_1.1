// Interfaz «pantalla de inicio + mesa de trabajo».
// No crea funciones nuevas de edición: mueve los controles originales (con sus ids y
// manejadores intactos) a los paneles de cada botón y conecta los atajos de la mesa.
const $ = id => document.getElementById(id);
const almacen = $('almacen');
const api = () => window.bisturi;

// ---------- utilidades para tomar los controles originales ----------
const etiqueta = id => $(id)?.closest('label') || $(id);
function seccion(texto, raiz = almacen) {
  const h2 = [...raiz.querySelectorAll('h2')].find(h => h.textContent.trim().startsWith(texto));
  if (!h2) return [];
  const padre = h2.parentElement;
  if (padre.firstElementChild === h2 && !padre.matches('aside')) return [padre];
  const out = [h2];
  for (let n = h2.nextElementSibling; n && n.tagName !== 'H2'; n = n.nextElementSibling) out.push(n);
  return out;
}
function grupo(titulo, nodos, nota) {
  const g = document.createElement('section');
  g.className = 'cajon-grupo';
  if (titulo) { const h = document.createElement('h3'); h.textContent = titulo; g.append(h); }
  if (nota) { const p = document.createElement('p'); p.className = 'hint nota'; p.textContent = nota; g.append(p); }
  for (const n of nodos.flat()) if (n) g.append(n);
  return g;
}
const boton = (texto, accion, clase = 'secondary full') => { const b = document.createElement('button'); b.type = 'button'; b.className = clase; b.textContent = texto; b.onclick = accion; return b; };

// ---------- paneles (cajones) ----------
const paneles = {};
function crearPaneles() {
  const tools = almacen.querySelector('.tools');
  const lanzadorCurvo = [...(tools?.querySelectorAll(':scope > button') || [])].find(b => /curvo/i.test(b.textContent));
  const planoIds = ['cutOrientation', 'cutAngles', 'cutPercent', 'previewCutBtn', 'touchPlaneBtn', 'cutPlaneBtn', 'showCutResult'];

  paneles.inteligente = { titulo: 'Separación inteligente', nodos: [
    grupo('Separación automática', [almacen.querySelector('.nucleo-tools')]),
    grupo('Modo de trabajo', seccion('Modo').filter(n => n.tagName !== 'H2'))
  ] };
  paneles.corte = { titulo: 'Corte manual', nodos: [
    grupo('Corte por plano', planoIds.map(etiqueta), 'Toca la pieza para seleccionarla, coloca el plano y pulsa «Aplicar corte por plano». «Mostrar plano de corte» solo enseña dónde cortará.'),
    grupo('Corte curvo', [boton('Abrir corte curvo', () => lanzadorCurvo?.click())], 'Corta con una superficie curva ajustable, o por el borde de una zona pintada con el pincel o la varita.')
  ] };
  paneles.seleccion = { titulo: 'Selección', nodos: [
    grupo('Herramienta de selección', [$('brushTool'), $('wandTool'), $('magneticTool')]),
    grupo(null, [almacen.querySelector('.surface-tools')]),
    grupo('Más opciones de corte', [lanzadorCurvo], 'Corte curvo: corta con una superficie curva ajustable o guardada, en vez de por el borde exacto de lo pintado.')
  ] };
  paneles.bisturi = { titulo: 'Bisturí', nodos: [grupo(null, [$('bisturiPlanoPanel')])] };
  paneles.bisturiLibre = { titulo: 'Bisturí libre', nodos: [grupo(null, [$('bisturiLibrePanel')])] };
  paneles.encastres = { titulo: 'Encastres 3D', nodos: [
    grupo(null, [almacen.querySelector('.connector-form')], 'Para quitar un encastre ya aplicado, pulsa «Atrás» justo después de agregarlo.')
  ] };
  paneles.piezas = { titulo: 'Gestionar piezas', nodos: [
    grupo('Vista de las piezas', [$('explodeBtn'), $('xrayBtn'), $('resetView'), $('viewBed3D'), $('viewAllBeds')]),
    grupo(null, seccion('Camas de impresión', almacen.querySelector('aside.right'))),
    grupo(null, seccion('Posición y giro', almacen.querySelector('aside.right')))
  ] };
  paneles.exportar = { titulo: 'Exportar piezas', nodos: [grupo(null, seccion('Exportación', almacen.querySelector('aside.right')))] };
  paneles.proyecto = { titulo: 'Proyecto', nodos: [
    grupo('Datos del proyecto', [etiqueta('projectName'), $('newBtn'), $('openBtn')]),
    grupo('Modelos de ejemplo', [$('demoBtn'), $('demoMushroomBtn'), $('demoPebbleBtn')]),
    grupo(null, seccion('Información', almacen.querySelector('aside.right'))),
    grupo(null, seccion('Diagnóstico al importar', almacen.querySelector('aside.right'))),
    grupo(null, seccion('Revisión de geometría', almacen.querySelector('aside.right'))),
    grupo(null, seccion('Reparación básica', almacen.querySelector('aside.right')))
  ] };
  paneles.ajustes = { titulo: 'Ajustes', nodos: [
    grupo('Tamaño y boquilla', [etiqueta('height'), $('scaleBtn'), etiqueta('nozzle')])
  ] };
  const ayuda = document.createElement('div');
  ayuda.className = 'ayuda';
  ayuda.innerHTML = `<p><strong>Abrir:</strong> Proyecto → Abrir modelo 3D (STL, 3MF, OBJ con MTL y texturas, FBX o GLB).</p>
  <p><strong>Ver:</strong> arrastra para girar, pellizca o usa la rueda para acercar. Abajo tienes las vistas fijas.</p>
  <p><strong>Seleccionar:</strong> toca una pieza; doble toque para quitar la selección.</p>
  <p><strong>Cortar por una zona:</strong> Selección (Pincel) o Varita mágica → pinta la zona → «Cortar región marcada» → «Calcular y previsualizar». El borde se limpia y suaviza solo.</p>
  <p><strong>Bisturí:</strong> dibuja una línea encima de lo que quieres cortar; aparece un plano de su mismo tamaño y solo corta lo que atraviesa. Pulsa «Hacer el corte plano». <strong>Bisturí libre:</strong> toca para poner puntos alrededor de una zona y cierra tocando el primero; sale una pieza con la profundidad indicada.</p>
  <p><strong>Cortar con un plano:</strong> Corte manual → elige orientación y posición → «Aplicar corte por plano».</p>
  <p><strong>Separar sin pintar:</strong> Separación inteligente → por color, por partes sueltas o para que quepa en la cama.</p>
  <p><strong>Deshacer:</strong> «Atrás» arriba a la derecha de la vista.</p>
  <p><strong>Exportar:</strong> «Exportar piezas» o «Guardar».</p>`;
  paneles.ayuda = { titulo: 'Ayuda', nodos: [ayuda] };
  // Cada panel tiene su contenedor propio para no mover nodos al abrir/cerrar.
  for (const [clave, p] of Object.entries(paneles)) {
    const c = document.createElement('div');
    c.className = 'cajon-panel'; c.dataset.panel = clave; c.hidden = true;
    for (const n of p.nodos) if (n) c.append(n);
    $('cajonCuerpo').append(c);
    p.el = c;
  }
}

let abierto = null;
function abrir(clave, titulo) {
  const p = paneles[clave];
  if (!p) return;
  if (abierto === clave && !titulo) { cerrar(); return; }
  for (const q of Object.values(paneles)) q.el.hidden = q !== p;
  $('cajonTitulo').textContent = titulo || p.titulo;
  $('cajon').hidden = false;
  abierto = clave;
  window.dispatchEvent(new CustomEvent('cajon-abierto', { detail: clave }));
  document.body.classList.add('cajon-abierto');
  window.dispatchEvent(new Event('resize'));
  if (matchMedia('(max-width:820px)').matches) document.querySelector('.escena').scrollIntoView({ block: 'start' });
  document.querySelectorAll('[data-cajon]').forEach(b => b.classList.toggle('activo', b.dataset.cajon === clave && (!titulo || b.dataset.titulo === titulo || !b.dataset.titulo)));
  $('cajonCuerpo').scrollTop = 0;
}
function cerrar() {
  $('cajon').hidden = true; abierto = null;
  document.body.classList.remove('cajon-abierto');
  window.dispatchEvent(new Event('resize'));
  document.querySelectorAll('[data-cajon].activo').forEach(b => b.classList.remove('activo'));
}

// ---------- pantalla de inicio ----------
function mostrarInicio() {
  $('inicioVolver').hidden = !api()?.modelLoaded;
  $('inicio').hidden = false; $('mesa').hidden = true;
}
function mostrarMesa() {
  $('inicio').hidden = true; $('mesa').hidden = false;
  window.dispatchEvent(new Event('resize'));
}

// ---------- ejes y datos del proyecto ----------
function dibujarEjes() {
  const c = $('ejes'), ctx = c.getContext('2d'), q = api()?.cameraQuaternion?.();
  if (!q || $('mesa').hidden) return;
  // Gira los ejes del mundo con la rotación inversa de la cámara (conjugado del cuaternión).
  const qx = -q.x, qy = -q.y, qz = -q.z, qw = q.w;
  const rot = ([vx, vy, vz]) => {
    const tx = 2 * (qy * vz - qz * vy), ty = 2 * (qz * vx - qx * vz), tz = 2 * (qx * vy - qy * vx);
    return [vx + qw * tx + (qy * tz - qz * ty), vy + qw * ty + (qz * tx - qx * tz), vz + qw * tz + (qx * ty - qy * tx)];
  };
  const ejes = [['X', [1, 0, 0], '#ff4d5e'], ['Y', [0, 1, 0], '#3ee07a'], ['Z', [0, 0, 1], '#3d8bff']].map(([n, v, col]) => [n, rot(v), col]).sort((a, b) => a[1][2] - b[1][2]);
  const s = c.width, m = s / 2, L = s * 0.32;
  ctx.clearRect(0, 0, s, s);
  for (const [n, v, col] of ejes) {
    const ex = m + v[0] * L, ey = m - v[1] * L;
    ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(m, m); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = col; ctx.font = '800 17px Nunito, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(n, m + v[0] * (L + 14), m - v[1] * (L + 14));
  }
}
let formato = '—';
function actualizarDatos() {
  const a = api(); if (!a) return;
  $('pNombre').textContent = $('projectName')?.value || 'Nuevo proyecto';
  $('pBoquilla').textContent = `${a.nozzle()} mm`;
  $('pFormato').textContent = a.modelLoaded ? formato : '—';
  const n = a.meshes.length;
  $('pPiezas').textContent = n; $('nPiezas').textContent = n;
  const t = a.modelSize?.();
  const alto = t ? `${(t.y / 10).toFixed(1)} cm` : '—';
  $('pAltura').textContent = alto;
  $('regla').hidden = !t; $('reglaValor').textContent = alto;
  $('vMover').classList.toggle('activo', a.tool === 'Mover' && a.transformMode === 'translate');
  $('vRotar').classList.toggle('activo', a.tool === 'Mover' && a.transformMode === 'rotate');
  $('vEscalar').classList.toggle('activo', a.tool === 'Mover' && a.transformMode === 'scale');
  $('vSeleccionar').classList.toggle('activo', a.tool === 'Seleccionar');
}

// ---------- montaje ----------
function montar() {
  // Vista 3D, estado y lista de piezas.
  $('escenaVista').prepend($('viewport'));
  $('estadoFila').append($('status'));
  $('listaPiezas').append($('pieces'));
  document.body.append($('warning'));
  document.querySelector('.barra-vertical').after($('cajon'));
  crearPaneles();

  document.querySelectorAll('[data-cajon]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.herramienta) $(b.dataset.herramienta)?.click();
    abrir(b.dataset.cajon, b.dataset.titulo);
  }));
  $('cajonCerrar').onclick = cerrar;
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && abierto) cerrar(); });

  // Barra superior / inicio.
  $('irInicio').onclick = mostrarInicio;
  $('inicioVolver').onclick = mostrarMesa;
  $('inicioNuevo').onclick = () => { mostrarMesa(); if (api()?.modelLoaded) $('newBtn').click(); };
  $('inicioAbrir').onclick = () => $('file').click();
  $('file').addEventListener('change', e => {
    const f = [...e.target.files].find(x => /\.(stl|3mf|obj|fbx|glb)$/i.test(x.name));
    if (f) { formato = f.name.split('.').pop().toUpperCase(); mostrarMesa(); }
  }, { capture: true });
  for (const id of ['demoBtn', 'demoMushroomBtn', 'demoPebbleBtn']) $(id)?.addEventListener('click', () => { formato = 'Ejemplo'; });

  // Barra vertical.
  $('vSeleccionar').onclick = () => $('selectTool').click();
  $('vMover').onclick = () => api()?.setTransformMode('translate');
  $('vRotar').onclick = () => api()?.setTransformMode('rotate');
  $('vEscalar').onclick = () => api()?.setTransformMode('scale');
  $('vEncuadrar').onclick = () => api()?.fit();
  $('vExplosion').onclick = () => $('explodeBtn').click();

  // Acciones sobre la vista.
  $('vAtras').onclick = () => $('undoBtn').click();
  $('vRehacer').onclick = () => $('redoBtn').click();
  $('vCompleta').onclick = () => {
    const el = $('escenaVista');
    try { document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen?.(); } catch (_) {}
  };
  document.querySelectorAll('[data-vista]').forEach(b => b.onclick = () => {
    api()?.setView(b.dataset.vista);
    document.querySelectorAll('[data-vista]').forEach(x => x.classList.toggle('activa', x === b));
  });

  // Acciones del panel de piezas.
  $('aUnir').onclick = () => api()?.mergeVisiblePieces();
  $('aDividir').onclick = () => abrir('corte');
  $('aAgregarEncastre').onclick = () => abrir('encastres');
  $('aQuitarEncastre').onclick = () => { abrir('encastres'); api()?.status('Para quitar un encastre ya aplicado, pulsa «Atrás» justo después de agregarlo.'); };
  $('aExportar').onclick = () => abrir('exportar');
  window.addEventListener('bisturi-menu-pieza', () => abrir('piezas'));

  // Ocultar la mascota de la columna si no cabe.
  const col = document.querySelector('.col-izq'), fijo = [col.querySelector('.proyecto-tarjeta'), col.querySelector('.herramientas')];
  const mascota = () => { const libre = col.clientHeight - fijo.reduce((s, e) => s + e.offsetHeight, 0) - 40; col.classList.toggle('sin-mascota', libre < 150); };
  new ResizeObserver(mascota).observe(col); mascota();

  // Aviso flotante sobre la vista 3D con el resultado de cada operación (en el móvil la línea de estado queda fuera de la pantalla).
  const aviso = document.createElement('div'); aviso.id = 'aviso'; aviso.className = 'aviso'; aviso.hidden = true; aviso.setAttribute('role', 'status');
  const avisoTexto = document.createElement('span'), avisoCerrar = document.createElement('button');
  avisoCerrar.type = 'button'; avisoCerrar.className = 'aviso-cerrar'; avisoCerrar.setAttribute('aria-label', 'Cerrar aviso'); avisoCerrar.textContent = '×';
  aviso.append(avisoTexto, avisoCerrar); $('escenaVista').append(aviso);
  let avisoT = 0; avisoCerrar.onclick = () => { aviso.hidden = true; };
  const importante = t => /cancel|no se aplic|no se pudo|error|fall|efectuad|agregad|aplicad|pasador\(es\)|cola\(s\)|encastre\(s\)|separ|cort|unid|importaci|selecciona|marca/i.test(t);
  new MutationObserver(() => {
    const t = $('status').textContent.trim();
    if (!t || !importante(t) || /^Seleccionado:/.test(t)) return;
    const malo = /cancel|no se aplic|no se pudo|error|fall|no cabe|fuera|demasiado|atraviesa|solapan/i.test(t);
    avisoTexto.textContent = t; aviso.classList.toggle('malo', malo); aviso.hidden = false;
    clearTimeout(avisoT); avisoT = setTimeout(() => { aviso.hidden = true; }, malo ? 12000 : 7000);
  }).observe($('status'), { childList: true, characterData: true, subtree: true });

  setInterval(actualizarDatos, 400);
  (function bucle() { dibujarEjes(); requestAnimationFrame(bucle); })();
  actualizarDatos();
}

montar();
