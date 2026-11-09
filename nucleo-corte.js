// Corte exacto por el borde de la selección.
// 1. Se separan las caras marcadas de las no marcadas por sus aristas reales:
//    el exterior no se toca y el borde coincide con lo marcado por construcción.
// 2. Cada bucle del borde se cierra con una tapa compartida por las dos piezas.
// 3. Se comprueba que las tapas queden dentro del sólido y sin cruces, que cada
//    pieza sea un sólido cerrado y que el volumen se conserve.
import { analizar, topologia, componentes, extraer, limites, desde, hacia } from './nucleo-malla.js?v=2.10';
import { regularizar, contornos, agujeros } from './nucleo-seleccion.js?v=2.10';
import { tapaRadial, tapaProyectada, faldon, planoDe } from './nucleo-tapa.js?v=2.10';
import { limpiarSeleccion, suavizarBorde } from './nucleo-autocorreccion.js?v=2.10';
import { volumen } from './nucleo-malla.js?v=2.10';
import { Rejilla, cajaTri, trianglosCruzan, entraHaciaDentro } from './nucleo-validar.js?v=2.10';

// Las caras sin color (tapas) toman el color más frecuente de la pieza.
export function rellenarColor(lista) {
  const c = Int16Array.from(lista), cuenta = new Map();
  for (const x of c) if (x >= 0) cuenta.set(x, (cuenta.get(x) || 0) + 1);
  let mejor = 0, n = -1; for (const [k, v] of cuenta) if (v > n) { n = v; mejor = k; }
  for (let i = 0; i < c.length; i++) if (c[i] < 0) c[i] = mejor;
  return c;
}

const tercerVertice = (m, h) => m.tri[h - (h % 3) + ((h % 3) + 2) % 3];

class Taller {
  constructor(m, topo) {
    this.m = m; this.topo = topo; this.nv = m.pos.length / 3; this.nuevos = [];
    const { min, max } = limites(m.pos), p = m.pos, t = m.tri, nf = t.length / 3;
    let suma = 0, cuenta = 0;
    for (let f = 0; f < nf; f += Math.max(1, Math.floor(nf / 5000))) {
      const a = this.P(t[3 * f]), b = this.P(t[3 * f + 1]);
      suma += Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); cuenta++;
    }
    this.celda = Math.max(2 * suma / cuenta, Math.max(...max.map((x, k) => x - min[k])) / 400, 1e-9);
    this.rejilla = new Rejilla(min, max, this.celda);
    // Normales por vértice (ponderadas por área) para meter el faldón hacia dentro.
    this.normal = new Float64Array(p.length);
    for (let f = 0; f < nf; f++) {
      const A = this.P(t[3 * f]), B = this.P(t[3 * f + 1]), C = this.P(t[3 * f + 2]);
      this.rejilla.insertar(f, ...cajaTri(A, B, C));
      const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
      const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
      for (let k = 0; k < 3; k++) for (let d = 0; d < 3; d++) this.normal[3 * t[3 * f + k] + d] += n[d];
    }
  }
  P(v) {
    if (v < this.nv) return [this.m.pos[3 * v], this.m.pos[3 * v + 1], this.m.pos[3 * v + 2]];
    const i = 3 * (v - this.nv); return [this.nuevos[i], this.nuevos[i + 1], this.nuevos[i + 2]];
  }
  normalDe(v) { const n = [this.normal[3 * v], this.normal[3 * v + 1], this.normal[3 * v + 2]], l = Math.hypot(...n) || 1; return n.map(x => x / l); }
  get base() { return this.nv + this.nuevos.length / 3; }
  // Accesor que ve también los vértices aún no aceptados de una tapa candidata.
  conExtra(extra, base) { return v => (v >= base ? [extra[3 * (v - base)], extra[3 * (v - base) + 1], extra[3 * (v - base) + 2]] : this.P(v)); }

  // Construye una tapa candidata para uno o varios bucles.
  construir(tipo, bucles) {
    const base = this.base, P0 = v => this.P(v), meseta = tipo.endsWith('-meseta'), t = tipo.replace('-meseta', '');
    if (t === 'proyectada') return tapaProyectada(P0, bucles);
    if (t === 'radial') return bucles.length === 1 ? tapaRadial(P0, bucles[0].verts, base, { meseta }) : null;
    // Con faldón: un anillo interior por bucle y después la tapa de los anillos.
    const nuevos = [], tris = [], tercero = [], anillos = [];
    for (const b of bucles) {
      const largo = b.verts.reduce((s, v, i) => { const a = this.P(v), c = this.P(b.verts[(i + 1) % b.verts.length]); return s + Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]); }, 0) / b.verts.length;
      const f = faldon(P0, b.verts, v => this.normalDe(v), base + nuevos.length / 3, largo * 1.2);
      nuevos.push(...f.nuevos); tris.push(...f.tris); tercero.push(f.tercero); anillos.push({ verts: f.anillo });
    }
    const P1 = this.conExtra(nuevos, base), interior = t === 'faldon-radial'
      ? (anillos.length === 1 ? tapaRadial(P1, anillos[0].verts, base + nuevos.length / 3, { meseta }) : null)
      : tapaProyectada(P1, anillos);
    if (!interior) return null;
    for (const x of interior.nuevos) nuevos.push(x);
    for (const x of interior.tris) tris.push(x);
    return { metodo: tipo, nuevos, tris, tercero };
  }

  // Devuelve null si la tapa es válida; si no, el motivo.
  revisar(tapa, bucles, conCuna) {
    const m = this.m, P = this.conExtra(tapa.nuevos, this.base);
    if (conCuna) for (let j = 0; j < bucles.length; j++) for (let i = 0; i < bucles[j].verts.length; i++) {
      const h = bucles[j].aristas[i], g = this.topo.gemela[h], c = tapa.tercero[j][i];
      if (c === undefined) return 'la tapa no cubre todo el contorno';
      if (!entraHaciaDentro(P(desde(m, h)), P(hacia(m, h)), P(tercerVertice(m, h)), P(tercerVertice(m, g)), P(c))) return 'la tapa sale hacia el exterior junto al borde';
    }
    const t = tapa.tris;
    for (let i = 0; i < t.length; i += 3) {
      const A = P(t[i]), B = P(t[i + 1]), C = P(t[i + 2]);
      let choque = false;
      this.rejilla.consultar(...cajaTri(A, B, C), f => {
        const a = m.tri[3 * f], b = m.tri[3 * f + 1], c = m.tri[3 * f + 2];
        if (a === t[i] || a === t[i + 1] || a === t[i + 2] || b === t[i] || b === t[i + 1] || b === t[i + 2] || c === t[i] || c === t[i + 1] || c === t[i + 2]) return;
        if (trianglosCruzan(A, B, C, P(a), P(b), P(c))) { choque = true; return false; }
      });
      if (choque) return 'la tapa atraviesa la superficie del modelo';
    }
    if (this.cruces(t, P)) return 'la tapa se pliega sobre sí misma';
    return null;
  }
  aceptar(tapa) { for (const x of tapa.nuevos) this.nuevos.push(x); }
  // Ninguna tapa puede cruzarse con otra (ni consigo misma).
  cruces(tris, P = v => this.P(v)) {
    const { min, max } = limites(this.m.pos), r = new Rejilla(min, max, this.celda), cajas = [];
    for (let i = 0; i < tris.length; i += 3) { const caja = cajaTri(P(tris[i]), P(tris[i + 1]), P(tris[i + 2])); cajas.push(caja); r.insertar(i, ...caja); }
    for (let i = 0; i < tris.length; i += 3) {
      const A = P(tris[i]), B = P(tris[i + 1]), C = P(tris[i + 2]);
      let choque = false;
      r.consultar(...cajas[i / 3], j => {
        if (j <= i) return;
        for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (tris[i + a] === tris[j + b]) return;
        if (trianglosCruzan(A, B, C, P(tris[j]), P(tris[j + 1]), P(tris[j + 2]))) { choque = true; return false; }
      });
      if (choque) return true;
    }
    return false;
  }
  todasLasPosiciones() { const p = new Float32Array(this.m.pos.length + this.nuevos.length); p.set(this.m.pos); p.set(this.nuevos, this.m.pos.length); return p; }
}

// Orden de preferencia: la tapa plana deja una cara lisa (mejor para imprimir);
// el faldón se usa cuando el borde escalonado o curvo no admite una tapa directa.
const TIPOS_PLANO = ['proyectada', 'radial-meseta', 'radial', 'faldon-radial-meseta', 'faldon-proyectada', 'faldon-radial'];
const TIPOS_CURVO = ['radial-meseta', 'radial', 'faldon-radial-meseta', 'proyectada', 'faldon-proyectada', 'faldon-radial'];
// Un bucle es «casi plano» si ningún punto se separa de su plano medio más del 2 % de su tamaño.
function casiPlano(taller, b) {
  const P = b.verts.map(v => taller.P(v)), { c, n } = planoDe(v => taller.P(v), b.verts);
  let dev = 0, tam = 0;
  for (const p of P) { const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]]; dev = Math.max(dev, Math.abs(d[0] * n[0] + d[1] * n[1] + d[2] * n[2])); tam = Math.max(tam, Math.hypot(...d)); }
  return dev <= 0.02 * tam;
}

// Cierra todos los bucles: primero uno a uno; si alguno falla, prueba una
// tapa común con huecos (p. ej. un aro cortado por la mitad).
function taparBucles(taller, bucles, conCuna) {
  const intentos = [], elegidas = [];
  for (const b of bucles) {
    let elegida = null;
    for (const tipo of casiPlano(taller, b) ? TIPOS_PLANO : TIPOS_CURVO) {
      const tapa = taller.construir(tipo, [b]);
      if (!tapa) continue;
      const motivo = taller.revisar(tapa, [b], conCuna);
      if (!motivo) { elegida = tapa; break; }
      intentos.push(motivo);
    }
    if (!elegida) break;
    taller.aceptar(elegida); elegidas.push(elegida);
  }
  if (elegidas.length === bucles.length) return { tris: elegidas.flatMap(t => t.tris), metodos: elegidas.map(t => t.metodo) };
  taller.nuevos.length = 0;
  if (bucles.length > 1) for (const tipo of ['proyectada', 'faldon-proyectada']) {
    const tapa = taller.construir(tipo, bucles);
    if (!tapa) continue;
    const motivo = taller.revisar(tapa, bucles, conCuna);
    if (!motivo) { taller.aceptar(tapa); return { tris: tapa.tris, metodos: [tipo + ' con huecos'] }; }
    intentos.push(motivo);
  }
  const motivo = [...new Set(intentos)].join('; ') || 'ningún método aplicable';
  throw new Error(`No se pudo cerrar el corte con una tapa segura (${motivo}). Prueba a suavizar la selección, a reducirla o a cortar en dos pasos.`);
}

// color (opcional): Int16Array con un color por cara; se conserva en cada pieza
// y las caras de la tapa toman el color más frecuente de la pieza.
export function cortarPorSeleccion(m, seleccion, { progreso = () => {}, color = null, autocorregir = false } = {}) {
  progreso('Comprobando el modelo…');
  const info = analizar(m);
  if (!info.cerrada) throw new Error('El modelo no es un sólido cerrado. Usa «Cerrar agujeros» o revisa el informe de importación.');
  const mask = Uint8Array.from(seleccion), topo = info.topo;
  let limpieza = null;
  if (autocorregir) { progreso('Limpiando la selección…'); limpieza = limpiarSeleccion(m, topo, mask); }
  const ajustadas = regularizar(m, topo, mask).length;
  const marcadas = mask.reduce((s, x) => s + x, 0);
  if (!marcadas) throw new Error('No hay nada seleccionado.');
  if (marcadas === mask.length) throw new Error('Está seleccionado todo el modelo; no hay nada que separar.');
  progreso('Siguiendo el borde de la selección…');
  const bucles = contornos(m, topo, mask);
  let suavizado = null, volumenOriginal = info.volumen;
  if (autocorregir) {
    progreso('Suavizando el borde del corte…');
    const r = suavizarBorde(m, bucles);
    if (r.movidos) { m = { pos: r.pos, tri: m.tri }; const v = volumen(m); suavizado = { vertices: r.movidos, cambioVolumen: (v - info.volumen) / info.volumen }; info.volumen = v; }
  }
  progreso('Construyendo las tapas…');
  const taller = new Taller(m, topo);
  const { tris: tapa, metodos } = taparBucles(taller, bucles, true);
  progreso('Comprobando que las tapas no se crucen…');
  if (metodos.length > 1 && taller.cruces(tapa)) throw new Error('Dos tapas se cruzan dentro del modelo. Separa más las regiones o corta en dos pasos.');
  progreso('Formando las piezas…');
  const pos = taller.todasLasPosiciones(), piezas = [];
  for (const lado of [1, 0]) {
    const tri = [];
    for (let f = 0; f < mask.length; f++) if (mask[f] === lado) tri.push(m.tri[3 * f], m.tri[3 * f + 1], m.tri[3 * f + 2]);
    for (let i = 0; i < tapa.length; i += 3) lado ? tri.push(tapa[i], tapa[i + 1], tapa[i + 2]) : tri.push(tapa[i], tapa[i + 2], tapa[i + 1]);
    const malla = { pos, tri: Uint32Array.from(tri) }, comp = componentes(malla, topologia(malla));
    const grupos = Array.from({ length: comp.n }, () => []);
    for (let f = 0; f < comp.id.length; f++) grupos[comp.id[f]].push(f);
    // Color de cada cara de esta mitad: las originales lo conservan, las de tapa = -1.
    const colMitad = color ? new Int16Array(malla.tri.length / 3).fill(-1) : null;
    if (color) { let i = 0; for (let f = 0; f < mask.length; f++) if (mask[f] === lado) colMitad[i++] = color[f]; }
    for (const caras of grupos) {
      const pieza = extraer(pos, malla.tri, caras), a = analizar(pieza);
      if (!a.cerrada) throw new Error('Una de las piezas no quedó cerrada; el corte se ha cancelado.');
      piezas.push({ malla: pieza, lado: lado ? 'seleccion' : 'resto', volumen: a.volumen, triangulos: a.triangulos, color: colMitad ? rellenarColor(caras.map(f => colMitad[f])) : null });
    }
  }
  const suma = piezas.reduce((s, p) => s + p.volumen, 0), errorVolumen = Math.abs(suma - info.volumen) / info.volumen;
  if (errorVolumen > 1e-5) throw new Error('Las piezas no conservan el volumen original; el corte se ha cancelado.');
  return { piezas, mascara: mask, informe: { bucles: bucles.length, metodos, carasAjustadas: ajustadas, volumen: info.volumen, errorVolumen, triangulosTapa: tapa.length / 3, limpieza, suavizado, volumenOriginal }, tapa: { pos, tri: Uint32Array.from(tapa) } };
}

// Cierra los agujeros de un modelo abierto con el mismo tipo de tapa.
export function cerrarAgujeros(m) {
  const topo = topologia(m);
  if (topo.noVariedad) throw new Error('El modelo tiene aristas compartidas por más de dos caras; no se puede reparar automáticamente.');
  const bucles = agujeros(m, topo);
  if (!bucles.length) return { malla: m, agujeros: 0 };
  const taller = new Taller(m, topo);
  const { tris } = taparBucles(taller, bucles, false);
  const pos = taller.todasLasPosiciones(), tri = new Uint32Array(m.tri.length + tris.length);
  tri.set(m.tri); tri.set(tris, m.tri.length);
  return { malla: { pos, tri }, agujeros: bucles.length };
}
