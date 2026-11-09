// Plano de corte finito (el cuadrado que dibuja el Bisturí).
// El corte se hace con el plano completo y después se vuelven a pegar las secciones que
// quedan fuera del cuadrado: así solo se separa lo que la línea del usuario atraviesa
// (por ejemplo una pierna y no la otra).

const dentroCuadrado = (c, x, y, z) => {
  const dx = x - c.centro[0], dy = y - c.centro[1], dz = z - c.centro[2];
  return Math.abs(dx * c.u[0] + dy * c.u[1] + dz * c.u[2]) <= c.mitad && Math.abs(dx * c.w[0] + dy * c.w[1] + dz * c.w[2]) <= c.mitad;
};

// ¿Alguna sección de la malla (en coordenadas mundiales) cae dentro del cuadrado?
export function cruzaCuadrado(sopa, n, d0, c) {
  for (let o = 0; o < sopa.length; o += 9) {
    const s0 = n[0] * sopa[o] + n[1] * sopa[o + 1] + n[2] * sopa[o + 2] - d0;
    const s1 = n[0] * sopa[o + 3] + n[1] * sopa[o + 4] + n[2] * sopa[o + 5] - d0;
    const s2 = n[0] * sopa[o + 6] + n[1] * sopa[o + 7] + n[2] * sopa[o + 8] - d0;
    if ((s0 > 0 && s1 > 0 && s2 > 0) || (s0 < 0 && s1 < 0 && s2 < 0)) continue;
    const s = [s0, s1, s2];
    for (let k = 0; k < 3; k++) {
      const j = (k + 1) % 3, a = s[k], b = s[j];
      if ((a > 0) === (b > 0) && a !== 0) continue;
      const t = a === b ? 0 : a / (a - b), p = o + 3 * k, q = o + 3 * j;
      if (dentroCuadrado(c, sopa[p] + (sopa[q] - sopa[p]) * t, sopa[p + 1] + (sopa[q + 1] - sopa[p + 1]) * t, sopa[p + 2] + (sopa[q + 2] - sopa[p + 2]) * t)) return true;
    }
  }
  return false;
}

// P y N: mitades del corte {sopa (mundo), col}. Devuelve las piezas finales [{sopa, col}].
export function pegarFuera(P, N, n, d0, c) {
  const lados = [P, N], nP = P.sopa.length / 9, nT = nP + N.sopa.length / 9;
  const tri = f => (f < nP ? [P, f] : [N, f - nP]);
  // 1) Identificador por posición exacta (las dos mitades comparten los puntos del corte).
  let size = 1; while (size < nT * 6) size <<= 1;
  const tabla = new Int32Array(size).fill(-1), claves = [], vid = new Int32Array(nT * 3);
  const bitsDe = lados.map(l => new Uint32Array(l.sopa.buffer, l.sopa.byteOffset, l.sopa.length));
  let nV = 0;
  for (let f = 0; f < nT; f++) {
    const lado = f < nP ? 0 : 1, base = (f < nP ? f : f - nP) * 9, b = bitsDe[lado];
    for (let k = 0; k < 3; k++) {
      const x = b[base + 3 * k], y = b[base + 3 * k + 1], z = b[base + 3 * k + 2];
      let h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) & (size - 1);
      for (;;) {
        const t = tabla[h];
        if (t < 0) { tabla[h] = nV; claves.push(x, y, z); vid[3 * f + k] = nV++; break; }
        if (claves[3 * t] === x && claves[3 * t + 1] === y && claves[3 * t + 2] === z) { vid[3 * f + k] = t; break; }
        h = (h + 1) & (size - 1);
      }
    }
  }
  // 2) Componentes de cada mitad por separado (nodo = vértice + mitad).
  const par = new Int32Array(2 * nV); for (let i = 0; i < par.length; i++) par[i] = i;
  const find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  const unir = (a, b) => { a = find(a); b = find(b); if (a !== b) par[b] = a; };
  for (let f = 0; f < nT; f++) { const off = f < nP ? 0 : nV; unir(off + vid[3 * f], off + vid[3 * f + 1]); unir(off + vid[3 * f], off + vid[3 * f + 2]); }
  // 3) Islas de tapa (triángulos sobre el plano) de cada mitad.
  let tolP = 0; { let mx = 0; for (const l of lados) for (let i = 0; i < Math.min(l.sopa.length, 3e5); i++) mx = Math.max(mx, Math.abs(l.sopa[i])); tolP = Math.max(1e-6, mx * 1e-6); }
  const esTapa = new Uint8Array(nT);
  for (let f = 0; f < nT; f++) {
    const [l, g] = tri(f), s = l.sopa, o = g * 9; let ok = true;
    for (let k = 0; k < 3 && ok; k++) if (Math.abs(n[0] * s[o + 3 * k] + n[1] * s[o + 3 * k + 1] + n[2] * s[o + 3 * k + 2] - d0) > tolP) ok = false;
    esTapa[f] = ok ? 1 : 0;
  }
  const parI = new Int32Array(2 * nV); for (let i = 0; i < parI.length; i++) parI[i] = i;
  const findI = x => { while (parI[x] !== x) { parI[x] = parI[parI[x]]; x = parI[x]; } return x; };
  for (let f = 0; f < nT; f++) if (esTapa[f]) { const off = f < nP ? 0 : nV, a = findI(off + vid[3 * f]); for (let k = 1; k < 3; k++) { const b = findI(off + vid[3 * f + k]); if (a !== b) parI[b] = a; } }
  const islas = new Map(); // raíz → {lado, tris:[], dentro, fuera, verts:Set}
  for (let f = 0; f < nT; f++) if (esTapa[f]) {
    const off = f < nP ? 0 : nV, r = findI(off + vid[3 * f]);
    let is = islas.get(r); if (!is) islas.set(r, is = { lado: f < nP ? 0 : 1, tris: [], dentro: 0, fuera: 0, verts: new Set() });
    is.tris.push(f);
    const [l, g] = tri(f), s = l.sopa, o = g * 9;
    for (let k = 0; k < 3; k++) { if (is.verts.has(vid[3 * f + k])) continue; is.verts.add(vid[3 * f + k]); if (dentroCuadrado(c, s[o + 3 * k], s[o + 3 * k + 1], s[o + 3 * k + 2])) is.dentro++; else is.fuera++; }
  }
  // 4) Islas fuera del cuadrado: se quitan las dos tapas y se unen las piezas de ambos lados.
  const deP = new Map(); // vértice → isla del lado P
  for (const [r, is] of islas) if (is.lado === 0) for (const v of is.verts) deP.set(v, r);
  const quitar = new Uint8Array(nT); let pegadas = 0, cortadas = 0;
  for (const [r, is] of islas) {
    if (is.lado !== 1) continue;
    let rp = -1; for (const v of is.verts) { const x = deP.get(v); if (x !== undefined) { rp = x; break; } }
    if (rp < 0) continue;
    const ip = islas.get(rp), dentro = is.dentro + ip.dentro, fuera = is.fuera + ip.fuera;
    if (dentro >= fuera) { cortadas++; continue; }
    for (const f of is.tris) quitar[f] = 1; for (const f of ip.tris) quitar[f] = 1;
    unir(vid[3 * ip.tris[0]], nV + vid[3 * is.tris[0]]); pegadas++;
  }
  // 5) Piezas finales.
  const grupos = new Map();
  for (let f = 0; f < nT; f++) {
    if (quitar[f]) continue;
    const off = f < nP ? 0 : nV, r = find(off + vid[3 * f]);
    let g = grupos.get(r); if (!g) grupos.set(r, g = []); g.push(f);
  }
  const piezas = [...grupos.values()].map(lista => {
    const sopa = new Float32Array(lista.length * 9), col = new Int16Array(lista.length);
    lista.forEach((f, i) => { const [l, g] = tri(f); sopa.set(l.sopa.subarray(g * 9, g * 9 + 9), i * 9); col[i] = l.col[g]; });
    return { sopa, col };
  });
  return { piezas, pegadas, cortadas };
}
