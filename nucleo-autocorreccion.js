// Autocorrección de cortes por región (pincel, varita, corte magnético).
// 1) limpiarSeleccion: quita islas sueltas pequeñas, rellena huecos pequeños y
//    elimina dientes de una sola cara, para que no salgan fragmentos ni bordes rotos.
// 2) suavizarBorde: desliza los vértices del contorno sobre la superficie para
//    quitar el «diente de sierra» que deja seguir las aristas de los triángulos.
import { desde, hacia, caraDe } from './nucleo-malla.js?v=2.10';
import { limpiarDientes } from './nucleo-seleccion.js?v=2.10';

function areaCara(m, f) {
  const p = m.pos, a = 3 * m.tri[3 * f], b = 3 * m.tri[3 * f + 1], c = 3 * m.tri[3 * f + 2];
  const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
  return Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
}

// Componentes conexas (por aristas) de las caras con mask[f] === valor.
function grupos(topo, mask, valor) {
  const id = new Int32Array(mask.length).fill(-1), lista = [];
  for (let s = 0; s < mask.length; s++) {
    if (mask[s] !== valor || id[s] >= 0) continue;
    const caras = [s]; id[s] = lista.length;
    for (let i = 0; i < caras.length; i++) {
      const f = caras[i];
      for (let k = 0; k < 3; k++) { const g = topo.gemela[3 * f + k]; if (g < 0) continue; const h = caraDe(g); if (mask[h] === valor && id[h] < 0) { id[h] = lista.length; caras.push(h); } }
    }
    lista.push(caras);
  }
  return lista;
}

export function limpiarSeleccion(m, topo, mask, { fraccion = 0.1 } = {}) {
  const informe = { islas: 0, huecos: 0, dientes: 0 }, cambiadas = [];
  if (limpiarDientes(topo, mask, cambiadas)) informe.dientes = cambiadas.length;
  for (const [valor, clave] of [[1, 'islas'], [0, 'huecos']]) {
    const gs = grupos(topo, mask, valor);
    if (gs.length < 2) continue;
    const areas = gs.map(c => c.reduce((s, f) => s + areaCara(m, f), 0)), mayor = Math.max(...areas);
    gs.forEach((caras, i) => {
      if (areas[i] >= fraccion * mayor) return;
      for (const f of caras) mask[f] = valor ^ 1;
      informe[clave]++;
    });
  }
  const antes = cambiadas.length;
  limpiarDientes(topo, mask, cambiadas);
  informe.dientes += cambiadas.length - antes;
  return informe;
}

// Normal de vértice ponderada por área.
function normales(m) {
  const n = new Float64Array(m.pos.length), p = m.pos;
  for (let f = 0; f < m.tri.length / 3; f++) {
    const a = 3 * m.tri[3 * f], b = 3 * m.tri[3 * f + 1], c = 3 * m.tri[3 * f + 2];
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const v of [a, b, c]) { n[v] += nx; n[v + 1] += ny; n[v + 2] += nz; }
  }
  return n;
}
function normalCara(p, tri, f) {
  const a = 3 * tri[3 * f], b = 3 * tri[3 * f + 1], c = 3 * tri[3 * f + 2];
  const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
  return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
}

// Devuelve una copia de m.pos con los vértices de los contornos suavizados.
// Cada paso mueve el vértice hacia el punto medio de sus vecinos del contorno,
// solo en el plano tangente, con un límite por arista y sin voltear caras.
export function suavizarBorde(m, bucles, { pasos = 6, factor = 0.5, limite = 0.45 } = {}) {
  const pos = Float32Array.from(m.pos), nv = pos.length / 3, nrm = normales(m);
  const cuenta = new Uint16Array(nv);
  for (const b of bucles) for (const v of b.verts) cuenta[v]++;
  // Caras alrededor de cada vértice del contorno y la arista más corta que toca.
  const caras = new Map(), corta = new Map();
  for (let f = 0; f < m.tri.length / 3; f++) for (let k = 0; k < 3; k++) {
    const v = m.tri[3 * f + k];
    if (cuenta[v] !== 1) continue;
    if (!caras.has(v)) caras.set(v, []);
    caras.get(v).push(f);
    for (const w of [m.tri[3 * f + (k + 1) % 3], m.tri[3 * f + (k + 2) % 3]]) {
      const d = Math.hypot(pos[3 * v] - pos[3 * w], pos[3 * v + 1] - pos[3 * w + 1], pos[3 * v + 2] - pos[3 * w + 2]);
      corta.set(v, Math.min(corta.get(v) ?? Infinity, d));
    }
  }
  const origen = new Map(), antes = new Map();
  for (const v of caras.keys()) { origen.set(v, [pos[3 * v], pos[3 * v + 1], pos[3 * v + 2]]); antes.set(v, caras.get(v).map(f => normalCara(m.pos, m.tri, f))); }
  for (let paso = 0; paso < pasos; paso++) {
    for (const b of bucles) {
      const vs = b.verts, L = vs.length;
      if (L < 4) continue;
      const nuevos = vs.map((v, i) => {
        if (cuenta[v] !== 1) return null;
        const a = vs[(i - 1 + L) % L], c = vs[(i + 1) % L], o = origen.get(v);
        let dx = (pos[3 * a] + pos[3 * c]) / 2 - pos[3 * v], dy = (pos[3 * a + 1] + pos[3 * c + 1]) / 2 - pos[3 * v + 1], dz = (pos[3 * a + 2] + pos[3 * c + 2]) / 2 - pos[3 * v + 2];
        const nx = nrm[3 * v], ny = nrm[3 * v + 1], nz = nrm[3 * v + 2], nl = Math.hypot(nx, ny, nz) || 1;
        const pr = (dx * nx + dy * ny + dz * nz) / (nl * nl);
        dx = (dx - pr * nx) * factor; dy = (dy - pr * ny) * factor; dz = (dz - pr * nz) * factor;
        let x = pos[3 * v] + dx, y = pos[3 * v + 1] + dy, z = pos[3 * v + 2] + dz;
        const tx = x - o[0], ty = y - o[1], tz = z - o[2], t = Math.hypot(tx, ty, tz), max = limite * corta.get(v);
        if (t > max) { const s = max / t; x = o[0] + tx * s; y = o[1] + ty * s; z = o[2] + tz * s; }
        return [x, y, z];
      });
      vs.forEach((v, i) => {
        const q = nuevos[i];
        if (!q) return;
        const viejo = [pos[3 * v], pos[3 * v + 1], pos[3 * v + 2]];
        pos[3 * v] = q[0]; pos[3 * v + 1] = q[1]; pos[3 * v + 2] = q[2];
        const ok = caras.get(v).every((f, j) => {
          const n0 = antes.get(v)[j], n1 = normalCara(pos, m.tri, f);
          const l0 = Math.hypot(...n0), l1 = Math.hypot(...n1);
          return l1 > 1e-3 * l0 && (n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2]) / (l0 * l1) > 0.5;
        });
        if (!ok) { pos[3 * v] = viejo[0]; pos[3 * v + 1] = viejo[1]; pos[3 * v + 2] = viejo[2]; }
      });
    }
  }
  let movidos = 0;
  for (const [v, o] of origen) if (Math.hypot(pos[3 * v] - o[0], pos[3 * v + 1] - o[1], pos[3 * v + 2] - o[2]) > 1e-6) movidos++;
  return { pos, movidos };
}
