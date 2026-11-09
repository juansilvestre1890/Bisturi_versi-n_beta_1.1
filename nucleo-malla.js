// Malla indexada: { pos: Float32Array (3·nv), tri: Uint32Array (3·nf) }.
// Sin DOM ni Three.js: funciona en el navegador, en un Worker y en Node.

export const caraDe = h => (h / 3) | 0;
export const desde = (m, h) => m.tri[h];
export const hacia = (m, h) => m.tri[h - (h % 3) + ((h % 3) + 1) % 3];

// Une vértices que coinciden (o casi) y descarta triángulos degenerados.
// Los modelos de IA suelen duplicar vértices en las costuras de UV.
export function soldar(sopa, tolRel = 1e-6) {
  const n = sopa.length / 3;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < sopa.length; i++) {
    const v = sopa[i], k = i % 3;
    if (!Number.isFinite(v)) throw new Error('El modelo tiene coordenadas no válidas.');
    if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v;
  }
  const diag = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  const tol = diag * tolRel || 1e-12;
  const q = new Float64Array(sopa.length);
  for (let i = 0; i < sopa.length; i++) q[i] = Math.round((sopa[i] - min[i % 3]) / tol);
  const orden = new Uint32Array(n);
  for (let i = 0; i < n; i++) orden[i] = i;
  orden.sort((a, b) => q[3 * a] - q[3 * b] || q[3 * a + 1] - q[3 * b + 1] || q[3 * a + 2] - q[3 * b + 2]);
  const mapa = new Uint32Array(n), pos = new Float32Array(sopa.length);
  let usados = 0, prev = -1;
  for (const i of orden) {
    if (prev < 0 || q[3 * i] !== q[3 * prev] || q[3 * i + 1] !== q[3 * prev + 1] || q[3 * i + 2] !== q[3 * prev + 2]) {
      pos[3 * usados] = sopa[3 * i]; pos[3 * usados + 1] = sopa[3 * i + 1]; pos[3 * usados + 2] = sopa[3 * i + 2];
      usados++; prev = i;
    }
    mapa[i] = usados - 1;
  }
  const tri = new Uint32Array(n), origen = new Uint32Array(n / 3);
  let t = 0, degenerados = 0;
  for (let f = 0; f < n / 3; f++) {
    const a = mapa[3 * f], b = mapa[3 * f + 1], c = mapa[3 * f + 2];
    if (a === b || b === c || a === c) { degenerados++; continue; }
    origen[t / 3] = f; tri[t++] = a; tri[t++] = b; tri[t++] = c;
  }
  // origen[i] = índice del triángulo de la sopa que dio la cara i (para colores).
  return { malla: { pos: pos.slice(0, 3 * usados), tri: tri.slice(0, t) }, degenerados, origen: origen.slice(0, t / 3) };
}

// Vecindad por aristas. gemela[h] = semiarista opuesta, -1 si es borde abierto,
// -2 si la arista la comparten más de dos caras (no variedad).
export function topologia(m) {
  const nh = m.tri.length, gemela = new Int32Array(nh).fill(-1);
  // Tabla hash de direccionamiento abierto con arreglos tipados (mucho más rápida que Map
  // con claves numéricas grandes en mallas de millones de triángulos).
  let size = 1; while (size < nh * 2) size <<= 1;
  const mask = size - 1, tLo = new Int32Array(size).fill(-1), tHi = new Int32Array(size), tVal = new Int32Array(size);
  const CERRADA = -2147483648;
  let noVariedad = 0;
  for (let h = 0; h < nh; h++) {
    const a = desde(m, h), b = hacia(m, h), lo = a < b ? a : b, hi = a < b ? b : a;
    let i = (Math.imul(lo, 0x9E3779B1) ^ Math.imul(hi, 0x85EBCA77)) & mask;
    while (tLo[i] !== -1 && (tLo[i] !== lo || tHi[i] !== hi)) i = (i + 1) & mask;
    if (tLo[i] === -1) { tLo[i] = lo; tHi[i] = hi; tVal[i] = h; continue; }
    const g = tVal[i];
    if (g >= 0) { gemela[h] = g; gemela[g] = h; tVal[i] = -1 - g; }
    else {
      if (g !== CERRADA) { const p = -1 - g, q = gemela[p]; gemela[p] = -2; if (q >= 0) gemela[q] = -2; noVariedad++; tVal[i] = CERRADA; }
      gemela[h] = -2;
    }
  }
  let abiertas = 0, invertidas = 0;
  for (let h = 0; h < nh; h++) {
    const g = gemela[h];
    if (g === -1) abiertas++;
    else if (g >= 0 && h < g && desde(m, h) === desde(m, g)) invertidas++;
  }
  return { gemela, abiertas, noVariedad, invertidas };
}

// Componentes conexas por aristas compartidas.
export function componentes(m, topo) {
  const nf = m.tri.length / 3, id = new Int32Array(nf).fill(-1), pila = [];
  let n = 0;
  for (let s = 0; s < nf; s++) {
    if (id[s] >= 0) continue;
    id[s] = n; pila.push(s);
    while (pila.length) {
      const f = pila.pop();
      for (let k = 0; k < 3; k++) {
        const g = topo.gemela[3 * f + k];
        if (g >= 0) { const F = caraDe(g); if (id[F] < 0) { id[F] = n; pila.push(F); } }
      }
    }
    n++;
  }
  return { id, n };
}

export function volumenCaras(m, caras) {
  const p = m.pos, t = m.tri;
  let v = 0;
  const o0 = p[3 * t[0]], o1 = p[3 * t[0] + 1], o2 = p[3 * t[0] + 2];
  for (const f of caras) {
    const a = 3 * t[3 * f], b = 3 * t[3 * f + 1], c = 3 * t[3 * f + 2];
    const ax = p[a] - o0, ay = p[a + 1] - o1, az = p[a + 2] - o2;
    const bx = p[b] - o0, by = p[b + 1] - o1, bz = p[b + 2] - o2;
    const cx = p[c] - o0, cy = p[c + 1] - o1, cz = p[c + 2] - o2;
    v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  return v;
}
const todas = m => ({ [Symbol.iterator]: function* () { for (let f = 0; f < m.tri.length / 3; f++) yield f; } });
export const volumen = m => volumenCaras(m, todas(m));

// Hace coherente la orientación de las caras y la pone hacia fuera.
export function orientar(m) {
  const topo = topologia(m), nf = m.tri.length / 3, giro = new Int8Array(nf).fill(-1), pila = [];
  let conflictos = 0, volteadas = 0;
  const grupos = [];
  for (let s = 0; s < nf; s++) {
    if (giro[s] >= 0) continue;
    giro[s] = 0; pila.push(s); const grupo = [s];
    while (pila.length) {
      const f = pila.pop();
      for (let k = 0; k < 3; k++) {
        const h = 3 * f + k, g = topo.gemela[h];
        if (g < 0) continue;
        const F = caraDe(g), mismaDireccion = desde(m, h) === desde(m, g) ? 1 : 0, quiere = giro[f] ^ mismaDireccion;
        if (giro[F] < 0) { giro[F] = quiere; pila.push(F); grupo.push(F); }
        else if (giro[F] !== quiere) conflictos++;
      }
    }
    grupos.push(grupo);
  }
  const tri = m.tri.slice();
  for (let f = 0; f < nf; f++) if (giro[f] === 1) { const b = tri[3 * f + 1]; tri[3 * f + 1] = tri[3 * f + 2]; tri[3 * f + 2] = b; volteadas++; }
  const salida = { pos: m.pos, tri };
  for (const grupo of grupos) {
    if (volumenCaras(salida, grupo) < 0) {
      for (const f of grupo) { const b = tri[3 * f + 1]; tri[3 * f + 1] = tri[3 * f + 2]; tri[3 * f + 2] = b; }
      volteadas += grupo.length;
    }
  }
  return { malla: salida, volteadas, conflictos: conflictos / 2 };
}

export function analizar(m) {
  const topo = topologia(m), comp = componentes(m, topo), v = volumen(m);
  const cerrada = topo.abiertas === 0 && topo.noVariedad === 0 && topo.invertidas === 0 && m.tri.length > 0;
  return { triangulos: m.tri.length / 3, vertices: m.pos.length / 3, abiertas: topo.abiertas, noVariedad: topo.noVariedad, invertidas: topo.invertidas, componentes: comp.n, volumen: v, cerrada: cerrada && v > 0, topo };
}

// Copia un subconjunto de caras con sus vértices renumerados.
export function extraer(pos, tri, caras) {
  const nuevo = new Map(), p = [], t = new Uint32Array(caras.length * 3);
  let i = 0;
  for (const f of caras) for (let k = 0; k < 3; k++) {
    const v = tri[3 * f + k];
    let j = nuevo.get(v);
    if (j === undefined) { j = p.length / 3; nuevo.set(v, j); p.push(pos[3 * v], pos[3 * v + 1], pos[3 * v + 2]); }
    t[i++] = j;
  }
  return { pos: new Float32Array(p), tri: t };
}

export function limites(pos) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i++) { const k = i % 3; if (pos[i] < min[k]) min[k] = pos[i]; if (pos[i] > max[k]) max[k] = pos[i]; }
  return { min, max, tam: max.map((x, k) => x - min[k]) };
}

export function centroides(m) {
  const nf = m.tri.length / 3, c = new Float32Array(3 * nf), p = m.pos, t = m.tri;
  for (let f = 0; f < nf; f++) for (let k = 0; k < 3; k++) c[3 * f + k] = (p[3 * t[3 * f] + k] + p[3 * t[3 * f + 1] + k] + p[3 * t[3 * f + 2] + k]) / 3;
  return c;
}

export function normales(m) {
  const nf = m.tri.length / 3, n = new Float32Array(3 * nf), p = m.pos, t = m.tri;
  for (let f = 0; f < nf; f++) {
    const a = 3 * t[3 * f], b = 3 * t[3 * f + 1], c = 3 * t[3 * f + 2];
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx, l = Math.hypot(x, y, z) || 1;
    n[3 * f] = x / l; n[3 * f + 1] = y / l; n[3 * f + 2] = z / l;
  }
  return n;
}

export function escalar(m, s) {
  const pos = new Float32Array(m.pos.length);
  for (let i = 0; i < pos.length; i++) pos[i] = m.pos[i] * s;
  return { pos, tri: m.tri };
}

// Coloca el modelo sobre la cama: centrado en X/Y y con la base en Z = 0.
export function apoyar(m) {
  const { min, max } = limites(m.pos), c = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, min[2]], pos = new Float32Array(m.pos.length);
  for (let i = 0; i < pos.length; i++) pos[i] = m.pos[i] - c[i % 3];
  return { pos, tri: m.tri };
}
