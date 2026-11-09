// Reparación automática de mallas (rápida, con arreglos tipados; sirve para millones de triángulos).
// Pasos: unir vértices duplicados → quitar triángulos degenerados y repetidos → coser grietas
// (uniones en T y bordes casi pegados) → orientar las caras hacia fuera → cerrar agujeros.
// Conserva los materiales (grupos). Las partes con aristas compartidas por más de dos caras
// se orientan pero no se les cierran agujeros, y se informa de ello.
import { soldar, topologia, componentes, orientar, extraer } from './nucleo-malla.js?v=2.10';
import { cerrarAgujeros } from './nucleo-corte.js?v=2.10';

const espera = () => new Promise(r => setTimeout(r, 0));

export async function repararMalla(THREE, geometry, { progreso = () => {} } = {}) {
  const pos = geometry.getAttribute('position'), idx = geometry.getIndex();
  const nf0 = (idx ? idx.count : pos.count) / 3;
  if (!nf0) throw Error('La pieza no tiene triángulos.');
  // Sopa y material de cada cara.
  const sopa = new Float32Array(nf0 * 9), mat0 = new Int16Array(nf0);
  for (let f = 0; f < nf0; f++) for (let k = 0; k < 3; k++) { const v = idx ? idx.getX(3 * f + k) : 3 * f + k; sopa[9 * f + 3 * k] = pos.getX(v); sopa[9 * f + 3 * k + 1] = pos.getY(v); sopa[9 * f + 3 * k + 2] = pos.getZ(v); }
  for (const g of geometry.groups) for (let f = g.start / 3; f < Math.min(nf0, (g.start + g.count) / 3); f++) mat0[f] = g.materialIndex ?? 0;
  const informe = { triangulosAntes: nf0, unidos: 0, degenerados: 0, repetidos: 0, grietas: 0, volteadas: 0, agujeros: 0, sinCerrar: 0 };

  // 1) Unir vértices y quitar degenerados.
  progreso('Uniendo vértices duplicados…'); await espera();
  const s = soldar(sopa, 1e-6);
  let P = s.malla.pos, T = s.malla.tri, M = Int16Array.from(s.origen, f => mat0[f]);
  informe.degenerados = s.degenerados; informe.unidos = nf0 * 3 - P.length / 3;
  let diag = 0; { let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < P.length; i++) { const k = i % 3; if (P[i] < mn[k]) mn[k] = P[i]; if (P[i] > mx[k]) mx[k] = P[i]; } diag = Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) || 1; }

  // Quita caras repetidas (dos iguales: queda una; dos opuestas: se anulan) y las colapsadas.
  const limpiar = () => {
    const nf = T.length / 3, orden = new Uint32Array(nf), k0 = new Uint32Array(nf), k1 = new Uint32Array(nf), k2 = new Uint32Array(nf), quitar = new Uint8Array(nf);
    for (let f = 0; f < nf; f++) {
      let a = T[3 * f], b = T[3 * f + 1], c = T[3 * f + 2];
      if (a === b || b === c || a === c) { quitar[f] = 1; informe.degenerados++; }
      if (a > b) [a, b] = [b, a]; if (b > c) [b, c] = [c, b]; if (a > b) [a, b] = [b, a];
      k0[f] = a; k1[f] = b; k2[f] = c; orden[f] = f;
    }
    orden.sort((x, y) => k0[x] - k0[y] || k1[x] - k1[y] || k2[x] - k2[y]);
    for (let i = 0; i < nf;) {
      let j = i + 1; while (j < nf && k0[orden[j]] === k0[orden[i]] && k1[orden[j]] === k1[orden[i]] && k2[orden[j]] === k2[orden[i]]) j++;
      if (j - i > 1) {
        // Sentido de cada copia: par o impar respecto al orden creciente.
        const sentido = f => { const a = T[3 * f], b = T[3 * f + 1], c = T[3 * f + 2]; return (a < b) + (b < c) + (c < a) === 2 ? 1 : -1; };
        let suma = 0; for (let q = i; q < j; q++) suma += sentido(orden[q]);
        let queda = suma > 0 ? 1 : suma < 0 ? 1 : 0, signo = Math.sign(suma);
        for (let q = i; q < j; q++) { const f = orden[q]; if (queda && sentido(f) === signo) { queda = 0; continue; } quitar[f] = 1; informe.repetidos++; }
      }
      i = j;
    }
    let n = 0; for (let f = 0; f < nf; f++) if (!quitar[f]) n++;
    if (n === nf) return;
    const T2 = new Uint32Array(n * 3), M2 = new Int16Array(n);
    for (let f = 0, k = 0; f < nf; f++) if (!quitar[f]) { T2[3 * k] = T[3 * f]; T2[3 * k + 1] = T[3 * f + 1]; T2[3 * k + 2] = T[3 * f + 2]; M2[k++] = M[f]; }
    T = T2; M = M2;
  };
  limpiar();

  // Bordes abiertos de partida (para enseñarlos en la vista previa).
  const bordesAntes = [];
  { const t0 = topologia({ pos: P, tri: T }); informe.bordesAbiertos = t0.abiertas; informe.noVariedad = t0.noVariedad;
    for (let h = 0; h < T.length && bordesAntes.length < 6e4 * 6; h++) if (t0.gemela[h] < 0) { const a = T[h], b = T[h - (h % 3) + ((h % 3) + 1) % 3]; bordesAntes.push(P[3 * a], P[3 * a + 1], P[3 * a + 2], P[3 * b], P[3 * b + 1], P[3 * b + 2]); } }
  // 2) Coser grietas: bordes casi pegados (se unen sus vértices) y uniones en T (se parte el triángulo).
  progreso('Cosiendo grietas…'); await espera();
  const eps = Math.max(diag * 2e-5, 1e-4);
  for (let pasada = 0; pasada < 3; pasada++) {
    const topo = topologia({ pos: P, tri: T });
    if (!topo.abiertas) break;
    const nv = P.length / 3, enBorde = new Uint8Array(nv);
    const borde = [];
    for (let h = 0; h < T.length; h++) if (topo.gemela[h] === -1) { const a = T[h], b = T[h - (h % 3) + ((h % 3) + 1) % 3]; enBorde[a] = enBorde[b] = 1; borde.push(h); }
    // Rejilla de vértices de borde.
    const celda = eps * 4, rej = new Map(), ck = (x, y, z) => `${Math.floor(x / celda)},${Math.floor(y / celda)},${Math.floor(z / celda)}`;
    for (let v = 0; v < nv; v++) if (enBorde[v]) { const k = ck(P[3 * v], P[3 * v + 1], P[3 * v + 2]); let l = rej.get(k); if (!l) rej.set(k, l = []); l.push(v); }
    // a) Unir vértices de borde más cercanos que eps.
    const par = new Int32Array(nv); for (let i = 0; i < nv; i++) par[i] = i;
    const find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    let unidos = 0;
    for (const [k, l] of rej) {
      const [cx, cy, cz] = k.split(',').map(Number);
      for (const v of l) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let m = -1; m <= 1; m++) {
        const o = rej.get(`${cx + i},${cy + j},${cz + m}`); if (!o) continue;
        for (const w of o) { if (w <= v) continue; const d = Math.hypot(P[3 * v] - P[3 * w], P[3 * v + 1] - P[3 * w + 1], P[3 * v + 2] - P[3 * w + 2]); if (d < eps) { const a = find(v), b = find(w); if (a !== b) { par[b] = a; unidos++; } } }
      }
    }
    if (unidos) { for (let i = 0; i < T.length; i++) T[i] = find(T[i]); informe.grietas += unidos; limpiar(); continue; }
    // b) Uniones en T: un vértice de borde sobre una arista de borde ajena.
    const nuevos = [], nuevosM = [], partir = new Uint8Array(T.length / 3);
    for (const h of borde) {
      const f = (h / 3) | 0; if (partir[f]) continue;
      const a = T[h], b = T[h - (h % 3) + ((h % 3) + 1) % 3], o = T[h - (h % 3) + ((h % 3) + 2) % 3];
      const ax = P[3 * a], ay = P[3 * a + 1], az = P[3 * a + 2], dx = P[3 * b] - ax, dy = P[3 * b + 1] - ay, dz = P[3 * b + 2] - az, L2 = dx * dx + dy * dy + dz * dz;
      if (L2 < eps * eps) continue;
      const c0 = [Math.floor(Math.min(ax, ax + dx) / celda) - 1, Math.floor(Math.min(ay, ay + dy) / celda) - 1, Math.floor(Math.min(az, az + dz) / celda) - 1];
      const c1 = [Math.floor(Math.max(ax, ax + dx) / celda) + 1, Math.floor(Math.max(ay, ay + dy) / celda) + 1, Math.floor(Math.max(az, az + dz) / celda) + 1];
      if ((c1[0] - c0[0] + 1) * (c1[1] - c0[1] + 1) * (c1[2] - c0[2] + 1) > 20000) continue;
      const enMedio = [];
      for (let i = c0[0]; i <= c1[0]; i++) for (let j = c0[1]; j <= c1[1]; j++) for (let m = c0[2]; m <= c1[2]; m++) {
        const l = rej.get(`${i},${j},${m}`); if (!l) continue;
        for (const w of l) {
          if (w === a || w === b || w === o) continue;
          const wx = P[3 * w] - ax, wy = P[3 * w + 1] - ay, wz = P[3 * w + 2] - az, t = (wx * dx + wy * dy + wz * dz) / L2;
          if (t <= 1e-4 || t >= 1 - 1e-4) continue;
          const ex = wx - t * dx, ey = wy - t * dy, ez = wz - t * dz;
          if (ex * ex + ey * ey + ez * ez <= eps * eps) enMedio.push([t, w]);
        }
      }
      if (!enMedio.length) continue;
      enMedio.sort((p, q) => p[0] - q[0]);
      const cadena = [a, ...enMedio.map(x => x[1]), b];
      for (let q = 0; q < cadena.length - 1; q++) { nuevos.push(cadena[q], cadena[q + 1], o); nuevosM.push(M[f]); }
      partir[f] = 1; informe.grietas++;
    }
    if (!nuevos.length) break;
    let n = 0; for (let f = 0; f < T.length / 3; f++) if (!partir[f]) n++;
    const T2 = new Uint32Array(n * 3 + nuevos.length), M2 = new Int16Array(n + nuevosM.length);
    let k = 0; for (let f = 0; f < T.length / 3; f++) if (!partir[f]) { T2[3 * k] = T[3 * f]; T2[3 * k + 1] = T[3 * f + 1]; T2[3 * k + 2] = T[3 * f + 2]; M2[k++] = M[f]; }
    T2.set(nuevos, 3 * k); M2.set(nuevosM, k); T = T2; M = M2; limpiar();
  }

  // 3) Orientación coherente y hacia fuera, por cuerpo.
  progreso('Orientando las caras…'); await espera();
  { const o = orientar({ pos: P, tri: T }); T = o.malla.tri; informe.volteadas = o.volteadas; }

  // 4) Cerrar agujeros, cuerpo por cuerpo (un cuerpo con aristas no variedad se deja como está).
  progreso('Cerrando agujeros…'); await espera();
  const topo = topologia({ pos: P, tri: T });
  // Salida en arreglos tipados que crecen (sin listas de millones de números).
  let salidaP = new Float32Array(T.length * 3 + 9 * 1024), salidaM = new Int16Array(T.length / 3 + 1024), nOut = 0;
  const pushCara = (pos, tri, f, m) => {
    if (nOut === salidaM.length) { const p2 = new Float32Array(salidaP.length * 2); p2.set(salidaP); salidaP = p2; const m2 = new Int16Array(salidaM.length * 2); m2.set(salidaM); salidaM = m2; }
    for (let k = 0; k < 3; k++) { const v = tri[3 * f + k]; salidaP[9 * nOut + 3 * k] = pos[3 * v]; salidaP[9 * nOut + 3 * k + 1] = pos[3 * v + 1]; salidaP[9 * nOut + 3 * k + 2] = pos[3 * v + 2]; }
    salidaM[nOut++] = m;
  };
  if (!topo.abiertas) {
    for (let f = 0; f < T.length / 3; f++) pushCara(P, T, f, M[f]);
  } else {
    const comp = componentes({ pos: P, tri: T }, topo), caras = Array.from({ length: comp.n }, () => []), abierto = new Uint8Array(comp.n);
    for (let f = 0; f < comp.id.length; f++) caras[comp.id[f]].push(f);
    for (let h = 0; h < T.length; h++) if (topo.gemela[h] === -1) abierto[comp.id[(h / 3) | 0]] = 1;
    for (let c = 0; c < comp.n; c++) {
      const lista = caras[c];
      if (!abierto[c]) { for (const f of lista) pushCara(P, T, f, M[f]); continue; }
      const sub = extraer(P, T, lista);
      let cuenta = new Map(); for (const f of lista) cuenta.set(M[f], (cuenta.get(M[f]) || 0) + 1);
      const mMayor = [...cuenta].sort((a, b) => b[1] - a[1])[0][0];
      try {
        const r = cerrarAgujeros(sub);
        informe.agujeros += r.agujeros;
        const nOrig = lista.length;
        for (let f = 0; f < r.malla.tri.length / 3; f++) pushCara(r.malla.pos, r.malla.tri, f, f < nOrig ? M[lista[f]] : mMayor);
      } catch (e) {
        informe.sinCerrar++;
        for (const f of lista) pushCara(P, T, f, M[f]);
      }
    }
  }

  // 5) Geometría final, ordenada por material.
  const nf = nOut, orden = new Uint32Array(nf); for (let i = 0; i < nf; i++) orden[i] = i; orden.sort((a, b) => salidaM[a] - salidaM[b] || a - b);
  const out = new Float32Array(nf * 9);
  for (let i = 0; i < nf; i++) out.set(salidaP.subarray(9 * orden[i], 9 * orden[i] + 9), 9 * i);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  let st = 0; for (let i = 1; i <= nf; i++) if (i === nf || salidaM[orden[i]] !== salidaM[orden[st]]) { g.addGroup(3 * st, 3 * (i - st), salidaM[orden[st]]); st = i; }
  g.computeVertexNormals(); g.computeBoundingBox();
  informe.triangulosDespues = nf;
  return { geometry: g, informe, bordes: Float32Array.from(bordesAntes) };
}
