// Worker de las herramientas del núcleo v2f sobre una pieza de la escena:
// separar partes sueltas, cerrar agujeros, dividir para la cama y separar por color.
// Recibe posiciones en coordenadas de mundo (mm) y devuelve piezas cerradas e indexadas.
import { soldar, orientar, analizar, topologia, componentes, extraer, volumen } from './nucleo-malla.js?v=2.10';
import { cerrarAgujeros } from './nucleo-corte.js?v=2.10';
import { cortarPorPlano, planosParaCama } from './nucleo-plano.js?v=2.10';
import { separarPorColor } from './nucleo-colores.js?v=2.10';

function sopaDe(positions, index) {
  const n = index ? index.length / 3 : positions.length / 9, s = new Float32Array(n * 9);
  if (!index) { s.set(positions.subarray(0, n * 9)); return s; }
  for (let i = 0; i < index.length; i++) { const v = index[i]; s[3 * i] = positions[3 * v]; s[3 * i + 1] = positions[3 * v + 1]; s[3 * i + 2] = positions[3 * v + 2]; }
  return s;
}
function piezasConexas(m, color) {
  const comp = componentes(m, topologia(m)), grupos = Array.from({ length: comp.n }, () => []);
  for (let f = 0; f < comp.id.length; f++) grupos[comp.id[f]].push(f);
  return grupos.map(caras => ({ malla: extraer(m.pos, m.tri, caras), color: color ? Int16Array.from(caras, f => color[f]) : null }));
}
const salida = p => ({ positions: p.malla.pos, index: p.malla.tri, color: p.color || null, volume: volumen(p.malla), closed: analizar(p.malla).cerrada });

export function ejecutarNucleo(d, progreso = () => {}) {
  progreso('Uniendo vértices duplicados…');
  const s = soldar(sopaDe(d.positions, d.index)), o = orientar(s.malla), m = o.malla;
  const color = d.color ? Int16Array.from(s.origen, f => d.color[f]) : null;
  if (d.op === 'partes') {
    const piezas = piezasConexas(m, color);
    if (piezas.length < 2) throw new Error('La pieza no tiene partes sueltas.');
    return { piezas: piezas.map(salida), informe: `${piezas.length} partes sueltas separadas.` };
  }
  if (d.op === 'reparar') {
    progreso('Cerrando agujeros…');
    const r = cerrarAgujeros(m);
    if (!r.agujeros) throw new Error('La pieza no tiene agujeros que cerrar.');
    const a = analizar(r.malla);
    if (!a.cerrada) throw new Error('No se pudo dejar la pieza cerrada.');
    const c = color ? Int16Array.from({ length: r.malla.tri.length / 3 }, (_, f) => f < color.length ? color[f] : -1) : null;
    return { piezas: [salida({ malla: r.malla, color: c })], informe: `${r.agujeros} agujero(s) cerrado(s). Volumen: ${(a.volumen / 1000).toFixed(2)} cm³.` };
  }
  if (d.op === 'cama') {
    const planos = planosParaCama(m, d.cama);
    if (!planos.length) throw new Error('La pieza ya cabe en la cama sin cortes.');
    let piezas = [{ malla: m, color }];
    for (const pl of planos) {
      progreso(`Cortando por ${'XYZ'[pl.eje]} = ${pl.nivel.toFixed(1)} mm…`);
      const siguientes = [];
      for (const p of piezas) {
        let mn = Infinity, mx = -Infinity;
        for (let i = pl.eje; i < p.malla.pos.length; i += 3) { mn = Math.min(mn, p.malla.pos[i]); mx = Math.max(mx, p.malla.pos[i]); }
        if (!(pl.nivel > mn + 1e-6 && pl.nivel < mx - 1e-6)) { siguientes.push(p); continue; }
        for (const q of cortarPorPlano(p.malla, pl.eje, pl.nivel, { color: p.color }).piezas) siguientes.push({ malla: q.malla, color: q.color });
      }
      piezas = siguientes;
    }
    const v0 = volumen(m), v1 = piezas.reduce((a, p) => a + volumen(p.malla), 0);
    if (Math.abs(v1 - v0) / v0 > 1e-5) throw new Error('El corte no conserva el volumen; se ha cancelado.');
    return { piezas: piezas.map(salida), informe: `Dividida con ${planos.length} plano(s) (${planos.map(p => 'XYZ'[p.eje] + ' ' + p.nivel.toFixed(0)).join(', ')} mm): ${piezas.length} piezas.` };
  }
  if (d.op === 'color') {
    if (!color) throw new Error('La pieza no tiene colores por cara (materiales o colores de vértice).');
    progreso('Repartiendo el volumen entre los colores…');
    const r = separarPorColor(m, color, { boquilla: d.boquilla });
    progreso('Formando las piezas de cada color…');
    const piezas = [];
    for (const parte of r.partes) {
      const q = soldar(parte.sopa), mm = orientar(q.malla).malla;
      for (const p of piezasConexas(mm, new Int16Array(mm.tri.length / 3).fill(parte.color))) piezas.push(p);
    }
    if (piezas.length < 2) throw new Error('Solo hay un color; no hay nada que separar.');
    const abiertas = piezas.map(salida).filter(p => !p.closed).length;
    return { piezas: piezas.map(salida), informe: `${r.partes.length} colores en ${piezas.length} piezas macizas${r.h ? ` (vóxel ${r.h.toFixed(2)} mm en las uniones internas)` : ''}.${abiertas ? ` Atención: ${abiertas} pieza(s) no quedaron cerradas.` : ''}` };
  }
  throw new Error('Operación desconocida.');
}

if (typeof self !== 'undefined' && typeof window === 'undefined' && typeof self.postMessage === 'function') {
  self.onmessage = ({ data }) => {
    try {
      const r = ejecutarNucleo(data, text => self.postMessage({ type: 'progress', text }));
      const transfers = r.piezas.flatMap(p => [p.positions.buffer, p.index.buffer, ...(p.color ? [p.color.buffer] : [])]);
      self.postMessage({ type: 'result', result: r }, transfers);
    } catch (e) { self.postMessage({ type: 'error', message: e.message || String(e) }); }
  };
}
