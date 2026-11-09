// Tapas que cierran un bucle de borde. Los vértices del bucle no se mueven
// ni se subdividen sus aristas: la tapa encaja exactamente con la malla.
//
// Convención: el bucle sigue el orden de las caras marcadas (arista a→b).
// La tapa que se devuelve contiene b→a, es decir, cierra la pieza marcada.
// La pieza del otro lado usa la misma tapa con los triángulos invertidos.
import earcut, { deviation } from './earcut.js?v=2.10';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(...a); return l ? a.map(x => x / l) : a; };

// Plano medio del bucle: centroide ponderado por longitud y normal de Newell.
export function planoDe(Pv, verts) {
  const n = verts.length, P = verts.map(Pv);
  let c = [0, 0, 0], peso = 0;
  const N = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n], l = Math.hypot(...sub(b, a));
    for (let k = 0; k < 3; k++) c[k] += l * (a[k] + b[k]) / 2;
    peso += l;
    N[0] += (a[1] - b[1]) * (a[2] + b[2]); N[1] += (a[2] - b[2]) * (a[0] + b[0]); N[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  c = c.map(x => x / (peso || 1));
  let nrm = norm(N);
  if (!Math.hypot(...nrm)) nrm = [0, 0, 1];
  const aux = Math.abs(nrm[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], u = norm(cross(nrm, aux)), w = cross(nrm, u);
  return { c, n: nrm, u, w, P };
}

// Tapa radial: anillos concéntricos hacia el centro del bucle. La posición en
// el plano es una interpolación radial (sin pliegues si el bucle es estrellado
// respecto al centro) y la altura se relaja como una membrana: una tapa plana
// si el bucle es plano y una superficie suave si no lo es.
// meseta: la mitad central de la tapa queda exactamente plana (perpendicular a
// la normal media del bucle). Ahí se pueden colocar pasadores o pines.
export function tapaRadial(Pv, verts, base, { meseta = false } = {}) {
  const n = verts.length, { c, n: N, u, w, P } = planoDe(Pv, verts);
  const K = Math.max(2, Math.min(16, Math.ceil(Math.sqrt(n) / 1.5)));
  const plano = P.map(p => { const d = sub(p, c); return [dot(d, u), dot(d, w), dot(d, N)]; });
  // Alturas: [anillo][i]; anillo 0 = bucle (fijo), anillo K = centro.
  const H = Array.from({ length: K + 1 }, (_, r) => new Float64Array(r === K ? 1 : n));
  for (let i = 0; i < n; i++) for (let r = 0; r < K; r++) H[r][i] = (1 - r / K) * plano[i][2];
  const relajar = (hasta, conCentro) => {
    for (let it = 0; it < 400; it++) {
      let cambio = 0;
      for (let r = 1; r < hasta; r++) for (let i = 0; i < n; i++) {
        const dentro = r + 1 === K ? H[K][0] : H[r + 1][i];
        const nuevo = (H[r][(i + 1) % n] + H[r][(i + n - 1) % n] + H[r - 1][i] + dentro) / 4;
        cambio = Math.max(cambio, Math.abs(nuevo - H[r][i])); H[r][i] = nuevo;
      }
      if (conCentro) { let s = 0; for (let i = 0; i < n; i++) s += H[K - 1][i]; const centro = s / n; cambio = Math.max(cambio, Math.abs(centro - H[K][0])); H[K][0] = centro; }
      if (cambio < 1e-9) break;
    }
  };
  relajar(K, true);
  if (meseta && K >= 3) {
    // Los anillos interiores pasan a la altura del centro y el resto se vuelve a relajar.
    const rF = Math.ceil(K / 2), hc = H[K][0];
    for (let r = rF; r < K; r++) H[r].fill(hc);
    relajar(rF, false);
  }
  // Con meseta, la zona plana se cierra con un abanico desde el centro: pocos
  // triángulos grandes (normales precisas), sin anillos diminutos en el centro.
  const R = meseta && K >= 3 ? Math.ceil(K / 2) : K - 1, centroId = base + R * n;
  const nuevos = [];
  const lugar = (r, i) => (r === 0 ? verts[i] : r > R ? centroId : base + (r - 1) * n + i);
  // Cada anillo hacia el centro se suaviza un poco más: el escalonado del
  // borde no se propaga como «rayos» por la tapa.
  let S = plano.map(q => [q[0], q[1]]);
  for (let r = 1; r <= R; r++) {
    for (let it = 0; it < 3; it++) S = S.map((q, i) => { const a = S[(i + n - 1) % n], b = S[(i + 1) % n]; return [(a[0] + 2 * q[0] + b[0]) / 4, (a[1] + 2 * q[1] + b[1]) / 4]; });
    const t = 1 - r / K;
    for (let i = 0; i < n; i++) { const x = t * S[i][0], y = t * S[i][1], h = H[r][i]; for (let k = 0; k < 3; k++) nuevos.push(c[k] + x * u[k] + y * w[k] + h * N[k]); }
  }
  for (let k = 0; k < 3; k++) nuevos.push(c[k] + H[K][0] * N[k]);
  const tris = [];
  for (let r = 0; r < R; r++) for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, A0 = lugar(r, i), A1 = lugar(r, j), B0 = lugar(r + 1, i), B1 = lugar(r + 1, j);
    tris.push(A1, A0, B0, A1, B0, B1);
  }
  for (let i = 0; i < n; i++) tris.push(lugar(R, (i + 1) % n), lugar(R, i), centroId);
  // Tercer vértice del triángulo de tapa apoyado en la arista i del bucle.
  const tercero = [verts.map((_, i) => lugar(1, i))];
  return { metodo: meseta && K >= 3 ? 'radial-meseta' : 'radial', nuevos, tris, tercero };
}

// Faldón: une el bucle con un anillo interior, metido hacia dentro del sólido
// según la normal de la superficie y suavizado para quitar el escalonado.
// Así ninguna parte de la tapa toca la superficie salvo el propio borde.
export function faldon(Pv, verts, normalDe, base, profundidad) {
  const n = verts.length, Q = verts.map(v => { const p = Pv(v), m = normalDe(v); return [p[0] - profundidad * m[0], p[1] - profundidad * m[1], p[2] - profundidad * m[2]]; });
  for (let it = 0; it < 4; it++) {
    const R = Q.map(q => q.slice());
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) Q[i][k] = (R[(i + n - 1) % n][k] + 2 * R[i][k] + R[(i + 1) % n][k]) / 4;
  }
  const tris = [], anillo = verts.map((_, i) => base + i);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; tris.push(verts[j], verts[i], anillo[i], verts[j], anillo[i], anillo[j]); }
  return { nuevos: Q.flat(), tris, tercero: anillo, anillo };
}

// Tapa por triangulación del polígono proyectado (admite bucles cóncavos y,
// con varios bucles casi coplanares, tapas con agujeros: un anillo cortado).
export function tapaProyectada(Pv, bucles) {
  const todos = bucles.flatMap(b => b.verts), plano = planoDe(Pv, todos);
  // Si la proyección perpendicular deja aristas reducidas a un punto (paredes
  // verticales en un borde escalonado), se prueba con direcciones inclinadas.
  for (const [a, b] of [[0, 0], [0.2, 0], [0, 0.2], [-0.2, 0], [0, -0.2]]) {
    const n = norm(plano.n.map((x, k) => x + a * plano.u[k] + b * plano.w[k]));
    const aux = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], u = norm(cross(n, aux)), w = cross(n, u);
    const tapa = proyectarEn(Pv, bucles, plano.c, u, w);
    if (tapa) return tapa;
  }
  return null;
}

function proyectarEn(Pv, bucles, c, u, w) {
  const xy = v => { const d = sub(Pv(v), c); return [dot(d, u), dot(d, w)]; };
  const poli = bucles.map(b => b.verts.map(xy));
  const dentro = (p, anillo) => { let s = false; for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) { const a = anillo[i], b = anillo[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) s = !s; } return s; };
  const padres = poli.map((p, i) => poli.map((q, j) => (i !== j && dentro(p[0], q) ? j : -1)).filter(j => j >= 0));
  const tris = [];
  for (let i = 0; i < bucles.length; i++) {
    if (padres[i].length % 2) continue;
    const huecos = bucles.map((_, j) => j).filter(j => padres[j].length === padres[i].length + 1 && padres[j].includes(i));
    const grupo = [i, ...huecos], ids = grupo.flatMap(g => bucles[g].verts), datos = grupo.flatMap(g => poli[g].flat()), inicios = [];
    let o = bucles[i].verts.length;
    for (const g of huecos) { inicios.push(o); o += bucles[g].verts.length; }
    const idx = earcut(datos, inicios, 2);
    if (!idx.length || deviation(datos, inicios, 2, idx) > 1e-6) return null;
    for (let k = 0; k < idx.length; k++) tris.push(ids[idx[k]]);
  }
  // earcut omite vértices colineales o repetidos en la proyección. Se vuelven a
  // insertar abriendo en abanico el triángulo que se apoya en el tramo saltado,
  // así ninguna arista del borde queda partida (no hay uniones en T).
  const usados = new Set(tris), borrado = new Set(), aristas = new Map();
  const indexar = t => { for (let k = 0; k < 3; k++) aristas.set(tris[t + k] + ':' + tris[t + (k + 1) % 3], t); };
  for (let t = 0; t < tris.length; t += 3) indexar(t);
  for (const b of bucles) {
    const v = b.verts, n = v.length, primero = v.findIndex(x => usados.has(x));
    if (primero < 0) return null;
    for (let s = 0; s < n; s++) {
      const i = (primero + s) % n;
      if (!usados.has(v[i]) || usados.has(v[(i + 1) % n])) continue;
      const tramo = [];
      let j = (i + 1) % n;
      while (!usados.has(v[j])) { tramo.push(v[j]); j = (j + 1) % n; }
      const p = v[i], q = v[j];
      let t = aristas.get(p + ':' + q), cadena;
      if (t !== undefined) cadena = [p, ...tramo, q];
      else { t = aristas.get(q + ':' + p); if (t === undefined) return null; cadena = [q, ...tramo.slice().reverse(), p]; }
      const tri = tris.slice(t, t + 3), k = tri.findIndex((x, m) => x === cadena[0] && tri[(m + 1) % 3] === cadena[cadena.length - 1]), x = tri[(k + 2) % 3];
      borrado.add(t);
      for (let m = 0; m < 3; m++) aristas.delete(tri[m] + ':' + tri[(m + 1) % 3]);
      for (let m = 0; m + 1 < cadena.length; m++) { tris.push(cadena[m], cadena[m + 1], x); indexar(tris.length - 3); }
      for (const y of tramo) usados.add(y);
    }
  }
  if (borrado.size) { const limpio = []; for (let t = 0; t < tris.length; t += 3) if (!borrado.has(t)) limpio.push(tris[t], tris[t + 1], tris[t + 2]); tris.length = 0; for (const x of limpio) tris.push(x); }
  // Orientar: cada arista a→b del bucle debe aparecer como b→a en la tapa.
  const dirigidas = new Map();
  for (let t = 0; t < tris.length; t += 3) for (let k = 0; k < 3; k++) dirigidas.set(tris[t + k] + ':' + tris[t + (k + 1) % 3], tris[t + (k + 2) % 3]);
  let directas = 0, inversas = 0;
  for (const b of bucles) for (let i = 0; i < b.verts.length; i++) {
    const a = b.verts[i], d = b.verts[(i + 1) % b.verts.length];
    if (dirigidas.has(d + ':' + a)) inversas++; else if (dirigidas.has(a + ':' + d)) directas++;
  }
  const total = bucles.reduce((s, b) => s + b.verts.length, 0);
  if (Math.max(directas, inversas) !== total || Math.min(directas, inversas) !== 0) return null;
  if (directas) for (let t = 0; t < tris.length; t += 3) { const x = tris[t + 1]; tris[t + 1] = tris[t + 2]; tris[t + 2] = x; }
  const terceros = new Map();
  for (let t = 0; t < tris.length; t += 3) for (let k = 0; k < 3; k++) terceros.set(tris[t + k] + ':' + tris[t + (k + 1) % 3], tris[t + (k + 2) % 3]);
  const tercero = bucles.map(b => b.verts.map((a, i) => terceros.get(b.verts[(i + 1) % b.verts.length] + ':' + a)));
  return { metodo: bucles.length > 1 ? 'proyectada-con-huecos' : 'proyectada', nuevos: [], tris, tercero };
}
