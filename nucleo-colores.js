// Separación por color en piezas MACIZAS (de Cortador STL).
// Cada color se queda con el volumen que tiene debajo: se voxeliza el interior,
// cada vóxel va al color de superficie más cercano (distancia × peso) y la
// superficie de cada color se reconstruye con «surface nets», ajustada a la
// malla original por fuera. Las piezas encajan entre sí como un rompecabezas.
// Exactitud: la del tamaño de vóxel (≈ 1,25 × boquilla) en las uniones internas.

import { topologia, componentes } from './nucleo-malla.js?v=2.10';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const pushTri = (arr, a, b, c) => arr.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);

function closestOnTri(p, a, b, c) {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return a;
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return b;
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return add(a, ab, d1 / (d1 - d3));
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return c;
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return add(a, ac, d2 / (d2 - d6));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return add(b, sub(c, b), (d4 - d3) / (d4 - d3 + (d5 - d6)));
  const den = 1 / (va + vb + vc);
  return add(add(a, ab, vb * den), ac, vc * den);
}
// Transformada de distancia euclídea exacta (Felzenszwalb) en 1D y 3D.
function edt1d(f, n, d, v, z) {
  let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
  for (let q = 1; q < n; q++) {
    if (f[q] >= 1e19) continue;
    if (f[v[k]] >= 1e19) { v[k] = q; continue; }
    let s;
    while (true) { const r = v[k]; s = (f[q] + q * q - (f[r] + r * r)) / (2 * q - 2 * r); if (s <= z[k] && k > 0) { k--; continue; } break; }
    k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
  }
  if (f[v[0]] >= 1e19) { for (let q = 0; q < n; q++) d[q] = 1e20; return; }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const r = v[k]; d[q] = (q - r) * (q - r) + f[r]; }
}
function edt3(F, nx, ny, nz) {
  const m = Math.max(nx, ny, nz), f = new Float64Array(m), d = new Float64Array(m), v = new Int32Array(m), z = new Float64Array(m + 1);
  const pasada = (n, cnt, idx) => { for (let a = 0; a < cnt; a++) { for (let q = 0; q < n; q++) f[q] = F[idx(a, q)]; edt1d(f, n, d, v, z); for (let q = 0; q < n; q++) F[idx(a, q)] = d[q]; } };
  pasada(nx, ny * nz, (a, q) => a * nx + q);
  pasada(ny, nx * nz, (a, q) => { const i = a % nx, k = (a / nx) | 0; return (k * ny + q) * nx + i; });
  pasada(nz, nx * ny, (a, q) => q * nx * ny + a);
}

function solidColors(pos, tris, cols, weights, h0, arr) {
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const t of tris) for (let j = 0; j < 9; j++) { const v = pos[t * 9 + j], k = j % 3; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v; }
  const PAD = 2; let h = h0, nx, ny, nz;
  for (let g = 0; g < 8; g++) { nx = Math.ceil((mx[0] - mn[0]) / h) + 2 * PAD; ny = Math.ceil((mx[1] - mn[1]) / h) + 2 * PAD; nz = Math.ceil((mx[2] - mn[2]) / h) + 2 * PAD; const N = nx * ny * nz; if (N <= 8e6) break; h *= Math.cbrt(N / 8e6) * 1.02; }
  const N = nx * ny * nz, o = [mn[0] - PAD * h, mn[1] - PAD * h, mn[2] - PAD * h], sxy = nx * ny, I = (i, j, k) => k * sxy + j * nx + i;
  const G = 4, gx = Math.ceil(nx / G), gy = Math.ceil(ny / G), gz = Math.ceil(nz / G), cellT = new Map();
  const TR = tris.map(t => [[pos[t * 9], pos[t * 9 + 1], pos[t * 9 + 2]], [pos[t * 9 + 3], pos[t * 9 + 4], pos[t * 9 + 5]], [pos[t * 9 + 6], pos[t * 9 + 7], pos[t * 9 + 8]]]);
  TR.forEach((T, ti) => {
    const lo = [0, 1, 2].map(k => Math.max(0, Math.floor((Math.min(T[0][k], T[1][k], T[2][k]) - o[k]) / h / G))), hi = [0, 1, 2].map(k => Math.floor((Math.max(T[0][k], T[1][k], T[2][k]) - o[k]) / h / G));
    for (let a = lo[0]; a <= Math.min(hi[0], gx - 1); a++) for (let b = lo[1]; b <= Math.min(hi[1], gy - 1); b++) for (let c = lo[2]; c <= Math.min(hi[2], gz - 1); c++) { const key = (c * gy + b) * gx + a; let l = cellT.get(key); if (!l) { l = []; cellT.set(key, l); } l.push(ti); }
  });
  function nearest(p) {
    const ca = Math.floor((p[0] - o[0]) / h / G), cb = Math.floor((p[1] - o[1]) / h / G), cc = Math.floor((p[2] - o[2]) / h / G); let best = null, bd = Infinity;
    for (let a = ca - 1; a <= ca + 1; a++) for (let b = cb - 1; b <= cb + 1; b++) for (let c = cc - 1; c <= cc + 1; c++) {
      if (a < 0 || b < 0 || c < 0 || a >= gx || b >= gy || c >= gz) continue;
      const l = cellT.get((c * gy + b) * gx + a); if (!l) continue;
      for (const ti of l) { const T = TR[ti], q = closestOnTri(p, T[0], T[1], T[2]), d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2; if (d < bd) { bd = d; best = { q, ti, d: Math.sqrt(d) }; } }
    }
    return best;
  }
  // Vóxeles interiores: rayos en Z con paridad por columna.
  const inside = new Uint8Array(N), col = new Map(), ex = 0.371 * h * 1e-3, ey = 0.613 * h * 1e-3;
  TR.forEach((T, ti) => {
    const i0 = Math.max(0, Math.floor((Math.min(T[0][0], T[1][0], T[2][0]) - o[0]) / h - 0.5)), i1 = Math.min(nx - 1, Math.ceil((Math.max(T[0][0], T[1][0], T[2][0]) - o[0]) / h - 0.5));
    const j0 = Math.max(0, Math.floor((Math.min(T[0][1], T[1][1], T[2][1]) - o[1]) / h - 0.5)), j1 = Math.min(ny - 1, Math.ceil((Math.max(T[0][1], T[1][1], T[2][1]) - o[1]) / h - 0.5));
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const key = j * nx + i; let l = col.get(key); if (!l) { l = []; col.set(key, l); } l.push(ti); }
  });
  for (const [key, l] of col) {
    const i = key % nx, j = (key / nx) | 0, px = o[0] + (i + 0.5) * h + ex, py = o[1] + (j + 0.5) * h + ey, zs = [];
    for (const ti of l) {
      const [a, b, c] = TR[ti], d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(d) < 1e-14) continue;
      const l1 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / d, l2 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / d, l3 = 1 - l1 - l2;
      if (l1 < 0 || l2 < 0 || l3 < 0) continue;
      zs.push(l1 * a[2] + l2 * b[2] + l3 * c[2]);
    }
    if (zs.length < 2) continue;
    zs.sort((x, y) => x - y); if (zs.length % 2) zs.pop();
    for (let m = 0; m < zs.length; m += 2) { const k0 = Math.max(0, Math.ceil((zs[m] - o[2]) / h - 0.5)), k1 = Math.min(nz - 1, Math.floor((zs[m + 1] - o[2]) / h - 0.5)); for (let k = k0; k <= k1; k++) inside[I(i, j, k)] = 1; }
  }
  // Semillas: vóxeles de superficie con el color del triángulo más cercano.
  const seedCol = new Int16Array(N).fill(-1), present = new Set(); let nIn = 0;
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const id = I(i, j, k); if (!inside[id]) continue; nIn++;
    if (inside[id - 1] && inside[id + 1] && inside[id - nx] && inside[id + nx] && inside[id - sxy] && inside[id + sxy]) continue;
    const r = nearest([o[0] + (i + 0.5) * h, o[1] + (j + 0.5) * h, o[2] + (k + 0.5) * h]);
    if (r) { seedCol[id] = cols[r.ti]; present.add(cols[r.ti]); }
  }
  if (!nIn) return 0;
  // Reparto del volumen: cada vóxel al color más cercano (distancia × peso).
  const lab = new Uint8Array(N), best = new Float32Array(N).fill(Infinity), pal = [...present], F = new Float32Array(N);
  // Los colores con poca superficie (ojos, cejas) entran menos hacia adentro.
  const Ac = {};
  TR.forEach((T, ti) => { const n = cross(sub(T[1], T[0]), sub(T[2], T[0])); Ac[cols[ti]] = (Ac[cols[ti]] || 0) + Math.hypot(n[0], n[1], n[2]); });
  const Amax = Math.max(...pal.map(c => Ac[c] || 0)), autoW = c => Math.min(3, Math.max(1, Math.pow(Amax / (Ac[c] || Amax), 0.25)));
  pal.forEach((c, ci) => {
    for (let q = 0; q < N; q++) F[q] = seedCol[q] === c ? 0 : 1e20;
    edt3(F, nx, ny, nz);
    const w = (weights[c] || 1) * autoW(c);
    for (let q = 0; q < N; q++) { if (!inside[q]) continue; const e = Math.sqrt(F[q]) * w; if (e < best[q]) { best[q] = e; lab[q] = ci + 1; } }
  });
  // Islas diminutas de color (ruido de textura) pasan al color vecino más común.
  {
    const minVox = Math.max(8, Math.round(6 / (h * h * h))), Qu = new Int32Array(F.buffer), seen = seedCol; seen.fill(0);
    const nb = [1, -1, nx, -nx, sxy, -sxy];
    for (let q0 = 0; q0 < N; q0++) {
      if (!lab[q0] || seen[q0]) continue;
      const L0 = lab[q0]; let hd = 0, tl = 0; Qu[tl++] = q0; seen[q0] = 1; const cnt = {};
      while (hd < tl) { const q = Qu[hd++]; for (const d of nb) { const r = q + d, lr = lab[r]; if (lr === L0) { if (!seen[r]) { seen[r] = 1; Qu[tl++] = r; } } else if (lr) cnt[lr] = (cnt[lr] || 0) + 1; } }
      if (tl < minVox) { let bl = 0, bc = 0; for (const k in cnt) if (cnt[k] > bc) { bc = cnt[k]; bl = +k; } if (bl) for (let m = 0; m < tl; m++) lab[Qu[m]] = bl; }
    }
  }
  // Damero 2×2 (dos vóxeles iguales que solo se tocan por una arista) haría
  // aristas compartidas por cuatro caras. Se rellena uno de los otros dos
  // vóxeles con esa etiqueta hasta que no quede ninguno: piezas cerradas y limpias.
  for (let pasada = 0; pasada < 12; pasada++) {
    let cambios = 0;
    for (const [da, db] of [[1, nx], [1, sxy], [nx, sxy]]) {
      for (let k = 1; k < nz - 2; k++) for (let j = 1; j < ny - 2; j++) for (let i = 1; i < nx - 2; i++) {
        const q = I(i, j, k), a = lab[q], b = lab[q + da], c = lab[q + db], d = lab[q + da + db];
        if (a === d && b !== a && c !== a) { if (a) { lab[q + da] = a; cambios++; } else if (b === c && b) { lab[q] = b; cambios++; } else if (b) { lab[q] = b; lab[q + da] = b; cambios++; } }
        else if (b === c && a !== b && d !== b) { if (b) { lab[q] = b; cambios++; } else if (a) { lab[q + db] = a; cambios++; } }
      }
    }
    if (!cambios) break;
  }
  for (let q = 0; q < N; q++) if (lab[q] && !inside[q]) inside[q] = 1;
  // Superficie dual (surface nets) por etiqueta; por fuera se pega a la malla.
  const cellV = new Int32Array(N).fill(-1), VP = [], snap = [];
  function vert(i, j, k) {
    const id = I(i, j, k); if (cellV[id] >= 0) return cellV[id];
    const L = (a, b, c) => lab[I(i + a, j + b, k + c)]; let sx = 0, sy = 0, sz = 0, n = 0, out = false;
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) {
      if (!L(a, b, c)) out = true;
      if (a === 0 && L(0, b, c) !== L(1, b, c)) { sx += 0.5; sy += b; sz += c; n++; }
      if (b === 0 && L(a, 0, c) !== L(a, 1, c)) { sx += a; sy += 0.5; sz += c; n++; }
      if (c === 0 && L(a, b, 0) !== L(a, b, 1)) { sx += a; sy += b; sz += 0.5; n++; }
    }
    let p = [o[0] + (i + 0.5 + sx / n) * h, o[1] + (j + 0.5 + sy / n) * h, o[2] + (k + 0.5 + sz / n) * h], sn = 0;
    if (out) { const r = nearest(p); if (r && r.d < 2.5 * h) { p = r.q; sn = 1; } }
    const vi = VP.length / 3; VP.push(p[0], p[1], p[2]); snap.push(sn); cellV[id] = vi; return vi;
  }
  const quads = pal.map(() => []), EDG = [];
  for (let a = 0; a < 3; a++) {
    const u = (a + 1) % 3, v = (a + 2) % 3, st = [1, nx, sxy];
    for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const id = I(i, j, k), la = lab[id], lb = lab[id + st[a]]; if (la === lb) continue;
      const c = [i, j, k], cv = (du, dv) => { const q = c.slice(); q[u] += du; q[v] += dv; return vert(q[0], q[1], q[2]); };
      const q0 = cv(-1, -1), q1 = cv(0, -1), q2 = cv(0, 0), q3 = cv(-1, 0);
      if (la) quads[la - 1].push(q0, q1, q2, q3);
      if (lb) quads[lb - 1].push(q0, q3, q2, q1);
      EDG.push(q0, q1, q1, q2, q2, q3, q3, q0);
    }
  }
  // Suaviza solo las uniones internas entre colores.
  const nv = VP.length / 3;
  for (let it = 0; it < 5; it++) {
    const S3 = new Float64Array(nv * 3), C = new Uint16Array(nv);
    for (let e = 0; e < EDG.length; e += 2) { const a = EDG[e], b = EDG[e + 1]; for (let k = 0; k < 3; k++) { S3[a * 3 + k] += VP[b * 3 + k]; S3[b * 3 + k] += VP[a * 3 + k]; } C[a]++; C[b]++; }
    for (let q = 0; q < nv; q++) { if (snap[q] || !C[q]) continue; for (let k = 0; k < 3; k++) VP[q * 3 + k] = 0.5 * VP[q * 3 + k] + (0.5 * S3[q * 3 + k]) / C[q]; }
  }
  pal.forEach((c, ci) => {
    const A = arr(c), Qd = quads[ci], P = q => [VP[q * 3], VP[q * 3 + 1], VP[q * 3 + 2]];
    for (let q = 0; q < Qd.length; q += 4) { pushTri(A, P(Qd[q]), P(Qd[q + 1]), P(Qd[q + 2])); pushTri(A, P(Qd[q]), P(Qd[q + 2]), P(Qd[q + 3])); }
  });
  return h;
}

const PESOS = { n: 1, thin: 2.5, thick: 0.5 };

// m: malla indexada; color: Int16Array por cara; opciones: boquilla, pesos
// ({color: 'n'|'thin'|'thick'}) y unir ({color: colorDestino}).
// Devuelve una sopa por color: [{color, sopa}], y el tamaño de vóxel usado.
export function separarPorColor(m, color, { boquilla = 0.4, pesos = {}, unir = {} } = {}) {
  const nf = m.tri.length / 3, pos = new Float32Array(nf * 9);
  for (let f = 0; f < nf; f++) for (let k = 0; k < 3; k++) for (let d = 0; d < 3; d++) pos[9 * f + 3 * k + d] = m.pos[3 * m.tri[3 * f + k] + d];
  const destino = c => { let n = 0; while (unir[c] !== undefined && unir[c] !== c && n++ < 50) c = unir[c]; return c; };
  const cols = Array.from(color, destino);
  const acc = new Map(), arr = c => { let a = acc.get(c); if (!a) { a = []; acc.set(c, a); } return a; };
  // Cada parte conexa de un solo color se conserva tal cual (exacta); solo las
  // partes con varios colores se reparten por volumen.
  const comp = componentes(m, topologia(m)), grupos = Array.from({ length: comp.n }, () => []);
  for (let f = 0; f < nf; f++) grupos[comp.id[f]].push(f);
  let mx = 0; for (const v of pos) mx = Math.max(mx, Math.abs(v));
  let h = 0;
  for (const tris of grupos) {
    const cs = new Set(tris.map(f => cols[f]));
    if (cs.size === 1) { const a = arr(cols[tris[0]]); for (const f of tris) for (let j = 0; j < 9; j++) a.push(pos[9 * f + j]); continue; }
    const W = {}; for (const c of cs) W[c] = PESOS[pesos[c] || 'n'];
    const hh = solidColors(pos, tris, cols, W, Math.max(boquilla * 1.25, (mx * 2) / 250), arr);
    if (!hh) throw new Error('No se pudo determinar el interior del modelo para separar los colores.');
    h = Math.max(h, hh);
  }
  return { partes: [...acc.entries()].filter(e => e[1].length).sort((a, b) => a[0] - b[0]).map(([c, a]) => ({ color: c, sopa: new Float32Array(a) })), h };
}
