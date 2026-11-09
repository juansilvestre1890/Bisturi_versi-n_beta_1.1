// Repara uniones en T (vértices que caen en medio de una arista vecina), típicas de las
// operaciones booleanas: el borde abierto se cierra partiendo el triángulo de la arista larga.
// Trabaja sobre una BufferGeometry (indexada o no) con grupos de material y devuelve otra
// sin indexar, con los grupos conservados.
export function repararUnionesT(THREE, geometry, { tolRel = 1e-6, pasadas = 4 } = {}) {
  const pos = geometry.getAttribute('position'), idx = geometry.getIndex();
  const nT = (idx ? idx.count : pos.count) / 3;
  const matDe = new Int32Array(nT);
  for (const g of geometry.groups) for (let f = g.start / 3; f < Math.min(nT, (g.start + g.count) / 3); f++) matDe[f] = g.materialIndex ?? 0;
  geometry.computeBoundingBox();
  const tol = Math.max(geometry.boundingBox.getSize(new THREE.Vector3()).length() * tolRel, 1e-7);
  // Soldadura: cada punto se une al vértice ya creado más cercano dentro de la tolerancia
  // (mirando las 27 celdas vecinas, para no separar puntos que caen a ambos lados de una celda).
  const P = [], mapa = new Map(), tol2 = tol * tol, cache = new Map();
  const id = v => {
    const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v), ex = x + ',' + y + ',' + z;
    const c = cache.get(ex); if (c !== undefined) return c;
    const cx = Math.floor(x / tol), cy = Math.floor(y / tol), cz = Math.floor(z / tol);
    let mejor = -1, md = tol2;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
      const l = mapa.get((cx + i) + ',' + (cy + j) + ',' + (cz + k)); if (!l) continue;
      for (const w of l) { const dx = P[3 * w] - x, dy = P[3 * w + 1] - y, dz = P[3 * w + 2] - z, d = dx * dx + dy * dy + dz * dz; if (d <= md) { md = d; mejor = w; } }
    }
    if (mejor < 0) { mejor = P.length / 3; P.push(x, y, z); const kk = cx + ',' + cy + ',' + cz; let l = mapa.get(kk); if (!l) mapa.set(kk, l = []); l.push(mejor); }
    cache.set(ex, mejor); return mejor;
  };
  let T = [], M = [];
  for (let f = 0; f < nT; f++) {
    const a = id(idx ? idx.getX(3 * f) : 3 * f), b = id(idx ? idx.getX(3 * f + 1) : 3 * f + 1), c = id(idx ? idx.getX(3 * f + 2) : 3 * f + 2);
    if (a === b || b === c || a === c) continue;
    T.push(a, b, c); M.push(matDe[f]);
  }
  // Triángulos repetidos (caras coplanares del booleano): opuestos se anulan, iguales se dejan uno.
  const limpiar = () => {
    const vistos = new Map(), quitar = new Uint8Array(T.length / 3);
    for (let i = 0; i < T.length; i += 3) {
      if (T[i] === T[i + 1] || T[i + 1] === T[i + 2] || T[i] === T[i + 2]) { quitar[i / 3] = 1; continue; }
      const t = [T[i], T[i + 1], T[i + 2]], s = [...t].sort((a, b) => a - b).join('|'), r = vistos.get(s);
      if (r === undefined) { vistos.set(s, i); continue; }
      // mismo sentido si la rotación coincide
      const u = [T[r], T[r + 1], T[r + 2]], k = u.indexOf(t[0]), igual = u[(k + 1) % 3] === t[1];
      quitar[i / 3] = 1; if (!igual) { quitar[r / 3] = 1; vistos.delete(s); }
    }
    const T2 = [], M2 = []; for (let i = 0; i < T.length; i += 3) if (!quitar[i / 3]) { T2.push(T[i], T[i + 1], T[i + 2]); M2.push(M[i / 3]); }
    T = T2; M = M2;
  };
  // Aristas más cortas que la resolución de impresión (≈ 2 µm): se colapsan para quitar astillas.
  const colapsar = eps => {
    const par = Array.from({ length: P.length / 3 }, (_, i) => i), find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    let n = 0;
    for (let i = 0; i < T.length; i += 3) for (let e = 0; e < 3; e++) {
      const a = T[i + e], b = T[i + (e + 1) % 3];
      if (Math.hypot(P[3 * a] - P[3 * b], P[3 * a + 1] - P[3 * b + 1], P[3 * a + 2] - P[3 * b + 2]) < eps) { const ra = find(a), rb = find(b); if (ra !== rb) { par[rb] = ra; n++; } }
    }
    if (n) for (let i = 0; i < T.length; i++) T[i] = find(T[i]);
    return n;
  };
  const epsColapso = Math.max(1e-3, tol * 20), distT = tol * 4;
  colapsar(epsColapso);
  limpiar();
  const ek = (a, b) => a < b ? a * 4294967296 + b : b * 4294967296 + a;
  for (let pasada = 0; pasada < pasadas; pasada++) {
    const cuenta = new Map();
    for (let i = 0; i < T.length; i += 3) for (let e = 0; e < 3; e++) { const k = ek(T[i + e], T[i + (e + 1) % 3]); cuenta.set(k, (cuenta.get(k) || 0) + 1); }
    // Vértices de borde en una rejilla espacial.
    const borde = new Set();
    for (let i = 0; i < T.length; i += 3) for (let e = 0; e < 3; e++) { const a = T[i + e], b = T[i + (e + 1) % 3]; if (cuenta.get(ek(a, b)) === 1) { borde.add(a); borde.add(b); } }
    if (!borde.size) break;
    let celda = 0; for (const v of borde) celda += 1; celda = Math.max(tol * 50, 0);
    let largo = 0, nb = 0;
    for (let i = 0; i < T.length; i += 3) for (let e = 0; e < 3; e++) { const a = T[i + e], b = T[i + (e + 1) % 3]; if (cuenta.get(ek(a, b)) === 1) { largo += Math.hypot(P[3 * a] - P[3 * b], P[3 * a + 1] - P[3 * b + 1], P[3 * a + 2] - P[3 * b + 2]); nb++; } }
    celda = Math.max(celda, largo / Math.max(1, nb));
    const rej = new Map(), ck = (x, y, z) => Math.floor(x / celda) + ',' + Math.floor(y / celda) + ',' + Math.floor(z / celda);
    for (const v of borde) { const k = ck(P[3 * v], P[3 * v + 1], P[3 * v + 2]); let l = rej.get(k); if (!l) rej.set(k, l = []); l.push(v); }
    const cerca = (a, b) => {
      const out = [], ax = P[3 * a], ay = P[3 * a + 1], az = P[3 * a + 2], bx = P[3 * b], by = P[3 * b + 1], bz = P[3 * b + 2];
      const dx = bx - ax, dy = by - ay, dz = bz - az, L2 = dx * dx + dy * dy + dz * dz; if (L2 < tol * tol) return out;
      const x0 = Math.floor((Math.min(ax, bx) - tol) / celda), x1 = Math.floor((Math.max(ax, bx) + tol) / celda);
      const y0 = Math.floor((Math.min(ay, by) - tol) / celda), y1 = Math.floor((Math.max(ay, by) + tol) / celda);
      const z0 = Math.floor((Math.min(az, bz) - tol) / celda), z1 = Math.floor((Math.max(az, bz) + tol) / celda);
      if ((x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1) > 4096) return out;
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
        const l = rej.get(x + ',' + y + ',' + z); if (!l) continue;
        for (const w of l) {
          if (w === a || w === b) continue;
          const wx = P[3 * w] - ax, wy = P[3 * w + 1] - ay, wz = P[3 * w + 2] - az, t = (wx * dx + wy * dy + wz * dz) / L2;
          if (t <= 1e-6 || t >= 1 - 1e-6) continue;
          const ex = wx - t * dx, ey = wy - t * dy, ez = wz - t * dz;
          if (ex * ex + ey * ey + ez * ez <= distT * distT) out.push([t, w]);
        }
      }
      return out.sort((p, q) => p[0] - q[0]);
    };
    let cambios = 0; const T2 = [], M2 = [];
    for (let i = 0; i < T.length; i += 3) {
      let hecho = false;
      for (let e = 0; e < 3 && !hecho; e++) {
        const a = T[i + e], b = T[i + (e + 1) % 3], o = T[i + (e + 2) % 3];
        if (cuenta.get(ek(a, b)) !== 1) continue;
        const ws = cerca(a, b).filter(x => x[1] !== o); if (!ws.length) continue;
        const cadena = [a, ...ws.map(x => x[1]), b];
        for (let k = 0; k < cadena.length - 1; k++) { if (cadena[k] === o || cadena[k + 1] === o) continue; T2.push(cadena[k], cadena[k + 1], o); M2.push(M[i / 3]); }
        hecho = true; cambios++;
      }
      if (!hecho) { T2.push(T[i], T[i + 1], T[i + 2]); M2.push(M[i / 3]); }
    }
    T = T2; M = M2;
    if (!cambios) break;
  }
  colapsar(epsColapso);
  limpiar();
  // Agujeritos que quedan (bucles de borde de pocos vértices): se tapan en abanico.
  {
    const cuenta = new Map(), sig = new Map(), matV = new Map();
    for (let i = 0; i < T.length; i += 3) for (let e = 0; e < 3; e++) { const k = ek(T[i + e], T[i + (e + 1) % 3]); cuenta.set(k, (cuenta.get(k) || 0) + 1); }
    for (let i = 0; i < T.length; i += 3) for (let e = 0; e < 3; e++) { const a = T[i + e], b = T[i + (e + 1) % 3]; if (cuenta.get(ek(a, b)) === 1) { if (sig.has(b)) sig.set(b, -1); else sig.set(b, a); matV.set(b, M[i / 3]); } }
    const usado = new Set();
    for (const [v0, w] of sig) {
      if (usado.has(v0) || w < 0) continue;
      const bucle = [v0]; let v = w, ok = true;
      while (v !== v0) { if (bucle.length > 12 || usado.has(v) || !sig.has(v) || sig.get(v) < 0) { ok = false; break; } bucle.push(v); v = sig.get(v); }
      for (const x of bucle) usado.add(x);
      if (!ok || bucle.length < 3) continue;
      // sig[b] = a significa arista a→b en la malla; el tapón recorre el bucle al revés: b→a.
      for (let k = 1; k < bucle.length - 1; k++) { T.push(bucle[0], bucle[k], bucle[k + 1]); M.push(matV.get(v0) ?? 0); }
    }
    limpiar();
  }
  // Salida sin indexar, ordenada por material.
  const orden = M.map((m, i) => i).sort((p, q) => M[p] - M[q]);
  const out = new Float32Array(orden.length * 9);
  orden.forEach((f, i) => { for (let k = 0; k < 3; k++) { const v = T[3 * f + k]; out[9 * i + 3 * k] = P[3 * v]; out[9 * i + 3 * k + 1] = P[3 * v + 1]; out[9 * i + 3 * k + 2] = P[3 * v + 2]; } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  let s = 0; for (let i = 1; i <= orden.length; i++) if (i === orden.length || M[orden[i]] !== M[orden[s]]) { g.addGroup(3 * s, 3 * (i - s), M[orden[s]]); s = i; }
  g.computeVertexNormals();
  return g;
}
