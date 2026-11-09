// Corte exacto por un plano perpendicular a un eje (X, Y o Z): parte los
// triángulos que cruzan el plano y cierra cada sección con una tapa plana
// (admite secciones con agujeros, como un aro). Es el corte de las
// herramientas «Cortes» y «Dividir para que quepa».
import { analizar, topologia, componentes, extraer, limites } from './nucleo-malla.js?v=2.10';
import { tapaProyectada } from './nucleo-tapa.js?v=2.10';
import { rellenarColor } from './nucleo-corte.js?v=2.10';

export function cortarPorPlano(m, eje, nivel, { color = null } = {}) {
  const info = analizar(m);
  if (!info.cerrada) throw new Error('El modelo no es un sólido cerrado; no se puede cortar con seguridad.');
  const { min, max } = limites(m.pos), span = Math.max(...max.map((x, k) => x - min[k]));
  if (!(nivel > min[eje] && nivel < max[eje])) throw new Error('El plano no cruza la pieza.');
  // Los vértices que caen en el plano se usan tal cual como parte del corte
  // (sin triángulos astilla). Solo si la sección es ambigua (una cara entera en
  // el plano o un contorno que se toca) se desplaza el plano un poco y se reintenta.
  let ultimo;
  for (const desplazar of [0, 1e-4, -1e-4, 1e-3, -1e-3, 1e-2]) {
    try { return cortarExacto(m, eje, nivel + desplazar * span, color, info, span); }
    catch (e) { ultimo = e; if (!e.reintentar) throw e; }
  }
  throw new Error('La sección del plano es ambigua en esta posición; muévelo un poco.');
}

function ambiguo(texto) { const e = new Error(texto); e.reintentar = true; return e; }

function cortarExacto(m, eje, nivel, color, info, span) {
  const p = m.pos, t = m.tri, nv = p.length / 3, eps = span * 1e-9;
  const s = new Float64Array(nv);
  for (let v = 0; v < nv; v++) { const d = p[3 * v + eje] - nivel; s[v] = Math.abs(d) <= eps ? 0 : d; }
  const pos = Array.from(p), cruce = new Map();
  for (let v = 0; v < nv; v++) if (s[v] === 0) pos[3 * v + eje] = nivel; // exactamente en el plano
  const punto = (a, b) => { // vértice nuevo en la arista a-b, compartido por las caras vecinas
    const clave = a < b ? a * nv + b : b * nv + a;
    let id = cruce.get(clave);
    if (id === undefined) {
      const k = s[a] / (s[a] - s[b]);
      id = pos.length / 3;
      for (let d = 0; d < 3; d++) pos.push(d === eje ? nivel : p[3 * a + d] + k * (p[3 * b + d] - p[3 * a + d]));
      cruce.set(clave, id);
    }
    return id;
  };
  const lados = [[], []], cols = [[], []]; // lados[0] = positivo (encima)
  const poner = (L, c, ...v) => { lados[L].push(...v); cols[L].push(c); };
  for (let f = 0; f < t.length / 3; f++) {
    const v = [t[3 * f], t[3 * f + 1], t[3 * f + 2]], sg = v.map(x => Math.sign(s[x])), c = color ? color[f] : 0;
    if (sg.every(x => x === 0)) throw ambiguo('Una cara está justo en el plano.');
    if (sg.every(x => x >= 0)) { poner(0, c, ...v); continue; }
    if (sg.every(x => x <= 0)) { poner(1, c, ...v); continue; }
    const z = sg.indexOf(0);
    if (z >= 0) { // un vértice en el plano, uno encima y uno debajo
      const a = v[(z + 1) % 3], b = v[(z + 2) % 3], X = punto(a, b), L = sg[(z + 1) % 3] > 0 ? 0 : 1;
      poner(L, c, v[z], a, X); poner(1 - L, c, X, b, v[z]);
      continue;
    }
    const np = sg.filter(x => x > 0).length, solo = np === 1 ? sg.indexOf(1) : sg.indexOf(-1);
    const o0 = v[solo], o1 = v[(solo + 1) % 3], o2 = v[(solo + 2) % 3], P = punto(o0, o1), Q = punto(o0, o2), L = np === 1 ? 0 : 1;
    poner(L, c, o0, P, Q); poner(1 - L, c, P, o1, o2); poner(1 - L, c, P, o2, Q);
  }
  // El contorno de la sección es el borde abierto de la mitad de encima.
  const todas = new Float32Array(pos), arriba = { pos: todas, tri: Uint32Array.from(lados[0]) }, topo = topologia(arriba);
  if (topo.noVariedad) throw ambiguo('La sección se ramifica.');
  const siguiente = new Map();
  for (let h = 0; h < arriba.tri.length; h++) {
    if (topo.gemela[h] !== -1) continue;
    const a = arriba.tri[h], b = arriba.tri[h - (h % 3) + ((h % 3) + 1) % 3];
    if (siguiente.has(a)) throw ambiguo('El contorno de la sección se toca en un punto.');
    siguiente.set(a, b);
  }
  if (!siguiente.size) throw new Error('El plano no cruza la pieza.');
  const bucles = [], visto = new Set();
  for (const ini of siguiente.keys()) {
    if (visto.has(ini)) continue;
    const verts = []; let x = ini;
    do { if (visto.has(x)) throw ambiguo('Sección ambigua.'); visto.add(x); verts.push(x); x = siguiente.get(x); if (x === undefined) throw new Error('La sección no se cierra: el modelo tiene un hueco en ese plano.'); } while (x !== ini);
    bucles.push({ verts });
  }
  const P = v => [pos[3 * v], pos[3 * v + 1], pos[3 * v + 2]];
  const tapa = tapaProyectada(P, bucles);
  if (!tapa) throw ambiguo('No se pudo triangular la sección.');
  const piezas = [];
  for (const L of [0, 1]) {
    const tri = lados[L].slice(), col = cols[L].slice();
    for (let i = 0; i < tapa.tris.length; i += 3) { if (L === 0) tri.push(tapa.tris[i], tapa.tris[i + 1], tapa.tris[i + 2]); else tri.push(tapa.tris[i], tapa.tris[i + 2], tapa.tris[i + 1]); col.push(-1); }
    const malla = { pos: todas, tri: Uint32Array.from(tri) }, comp = componentes(malla, topologia(malla));
    const grupos = Array.from({ length: comp.n }, () => []);
    for (let f = 0; f < comp.id.length; f++) grupos[comp.id[f]].push(f);
    for (const caras of grupos) {
      const pieza = extraer(todas, malla.tri, caras), a = analizar(pieza);
      if (!a.cerrada) throw ambiguo('Una pieza no quedó cerrada.');
      piezas.push({ malla: pieza, lado: L === 0 ? 'encima' : 'debajo', volumen: a.volumen, triangulos: a.triangulos, color: color ? rellenarColor(caras.map(f => col[f])) : null });
    }
  }
  const suma = piezas.reduce((x, q) => x + q.volumen, 0), err = Math.abs(suma - info.volumen) / info.volumen;
  if (err > 1e-5) throw ambiguo('El corte no conserva el volumen.');
  return { piezas, informe: { bucles: bucles.length, errorVolumen: err, nivel } };
}

// Planos para que cada parte quepa en la cama (como «Dividir para que quepa»).
export function planosParaCama(m, cama) {
  const { min, tam } = limites(m.pos), planos = [];
  for (let k = 0; k < 3; k++) { const n = Math.ceil(tam[k] / (cama[k] * 0.97)); for (let j = 1; j < n; j++) planos.push({ eje: k, nivel: min[k] + (tam[k] * j) / n }); }
  return planos;
}
