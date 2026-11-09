// Colisiones entre piezas: una pieza que se mueve no puede atravesar a otra.
// Se comprueba si algún triángulo de la pieza móvil penetra un triángulo de las
// demás. Tocarse (caras coplanares, como las dos tapas de un corte, o aristas
// en contacto) NO cuenta como choque: las piezas recién cortadas se pueden
// separar en la dirección libre y deslizar una sobre otra.
import { Rejilla, cajaTri } from './nucleo-validar.js?v=2.10';
import { limites } from './nucleo-malla.js?v=2.10';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// Penetración estricta del segmento PQ a través del triángulo ABC.
function atraviesa(P, Q, A, B, C, tol) {
  const n = cross(sub(B, A), sub(C, A)), ln = Math.hypot(...n);
  if (!ln) return false;
  const dP = dot(n, sub(P, A)) / ln, dQ = dot(n, sub(Q, A)) / ln;
  if (!((dP > tol && dQ < -tol) || (dP < -tol && dQ > tol))) return false; // tocar no es atravesar
  const s = dP / (dP - dQ), X = [P[0] + s * (Q[0] - P[0]), P[1] + s * (Q[1] - P[1]), P[2] + s * (Q[2] - P[2])];
  const v0 = sub(B, A), v1 = sub(C, A), v2 = sub(X, A), d00 = dot(v0, v0), d01 = dot(v0, v1), d11 = dot(v1, v1), d20 = dot(v2, v0), d21 = dot(v2, v1), den = d00 * d11 - d01 * d01;
  if (!den) return false;
  const v = (d11 * d20 - d01 * d21) / den, w = (d00 * d21 - d01 * d20) / den, e = 1e-6;
  return v > e && w > e && v + w < 1 - e;
}
function penetran(A, B, C, D, E, F, tol) {
  return atraviesa(A, B, D, E, F, tol) || atraviesa(B, C, D, E, F, tol) || atraviesa(C, A, D, E, F, tol)
    || atraviesa(D, E, A, B, C, tol) || atraviesa(E, F, A, B, C, tol) || atraviesa(F, D, A, B, C, tol);
}

// Las piezas quietas: todos sus triángulos en una rejilla.
export function prepararObstaculos(mallas) {
  if (!mallas.length) return null;
  const tris = [], cajas = [];
  let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity], suma = 0;
  for (const m of mallas) {
    const l = limites(m.pos); cajas.push(l);
    for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], l.min[k]); max[k] = Math.max(max[k], l.max[k]); }
    for (let f = 0; f < m.tri.length / 3; f++) {
      const T = [0, 1, 2].map(j => { const v = 3 * m.tri[3 * f + j]; return [m.pos[v], m.pos[v + 1], m.pos[v + 2]]; });
      tris.push(T); if (tris.length % 7 === 0) suma += Math.hypot(...sub(T[1], T[0]));
    }
  }
  const media = suma / Math.max(1, Math.floor(tris.length / 7)) || 1, span = Math.max(...max.map((x, k) => x - min[k]));
  const celda = Math.max(2 * media, span / 300);
  const pad = 200; // margen para mover piezas fuera de la caja inicial
  const rejilla = new Rejilla(min.map(x => x - pad), max.map(x => x + pad), celda);
  tris.forEach((T, i) => rejilla.insertar(i, ...cajaTri(...T)));
  const planos = new Float64Array(tris.length * 4);
  tris.forEach((T, i) => { const n = cross(sub(T[1], T[0]), sub(T[2], T[0])), l = Math.hypot(...n) || 1; planos[4 * i] = n[0] / l; planos[4 * i + 1] = n[1] / l; planos[4 * i + 2] = n[2] / l; planos[4 * i + 3] = dot(n, T[0]) / l; });
  return { tris, planos, rejilla, cajas, min, max, tol: Math.max(1e-4, span * 1e-6) };
}

// La pieza que se mueve, preparada una vez por arrastre.
export function prepararMovil(m) {
  const tris = [];
  for (let f = 0; f < m.tri.length / 3; f++) tris.push([0, 1, 2].map(j => { const v = 3 * m.tri[3 * f + j]; return [m.pos[v], m.pos[v + 1], m.pos[v + 2]]; }));
  const planos = tris.map(T => { const n = cross(sub(T[1], T[0]), sub(T[2], T[0])), l = Math.hypot(...n) || 1; return [n[0] / l, n[1] / l, n[2] / l, dot(n, T[0]) / l]; });
  const cajas = new Float64Array(tris.length * 6);
  tris.forEach((T, i) => { for (let k = 0; k < 3; k++) { cajas[6 * i + k] = Math.min(T[0][k], T[1][k], T[2][k]); cajas[6 * i + 3 + k] = Math.max(T[0][k], T[1][k], T[2][k]); } });
  return { tris, planos, cajas, caja: limites(m.pos) };
}

// ¿Choca la pieza móvil desplazada d contra algún obstáculo?
export function choca(movil, obst, d) {
  if (!obst) return false;
  const lo = movil.caja.min.map((x, k) => x + d[k]), hi = movil.caja.max.map((x, k) => x + d[k]);
  // Fase amplia: solo importan los triángulos dentro de la zona común de las cajas.
  const zonas = obst.cajas.map(c => [lo.map((x, k) => Math.max(x, c.min[k])), hi.map((x, k) => Math.min(x, c.max[k]))]).filter(([a, b]) => a.every((x, k) => x <= b[k] + obst.tol));
  if (!zonas.length) return false;
  const tol = obst.tol, P = obst.planos, C = movil.cajas;
  for (let t = 0; t < movil.tris.length; t++) {
    // Descarte sin crear objetos: la caja del triángulo tiene que tocar alguna zona común.
    let dentro = false;
    for (const [a, b] of zonas) {
      if (C[6 * t] + d[0] <= b[0] + tol && C[6 * t + 3] + d[0] >= a[0] - tol && C[6 * t + 1] + d[1] <= b[1] + tol && C[6 * t + 4] + d[1] >= a[1] - tol && C[6 * t + 2] + d[2] <= b[2] + tol && C[6 * t + 5] + d[2] >= a[2] - tol) { dentro = true; break; }
    }
    if (!dentro) continue;
    const T0 = movil.tris[t], T = T0.map(p => [p[0] + d[0], p[1] + d[1], p[2] + d[2]]), [tlo, thi] = cajaTri(...T);
    const nt = movil.planos[t], ot = nt[3] + nt[0] * d[0] + nt[1] * d[1] + nt[2] * d[2];
    let hit = false;
    obst.rejilla.consultar(tlo, thi, i => {
      // Descarte rápido: si los vértices de un triángulo quedan todos del mismo
      // lado del plano del otro (o pegados a él), no hay penetración.
      const nx = P[4 * i], ny = P[4 * i + 1], nz = P[4 * i + 2], o = P[4 * i + 3];
      let pos = 0, neg = 0;
      for (const q of T) { const s = nx * q[0] + ny * q[1] + nz * q[2] - o; if (s > tol) pos++; else if (s < -tol) neg++; }
      if (!pos || !neg) return;
      const S = obst.tris[i]; pos = 0; neg = 0;
      for (const q of S) { const s = nt[0] * q[0] + nt[1] * q[1] + nt[2] * q[2] - ot; if (s > tol) pos++; else if (s < -tol) neg++; }
      if (!pos || !neg) return;
      if (penetran(T[0], T[1], T[2], S[0], S[1], S[2], tol)) { hit = true; return false; }
    });
    if (hit) return true;
  }
  return false;
}

// Avanza de d0 hacia d1 en pasos cortos y se detiene justo antes del primer choque.
function tramo(movil, obst, d0, d1, paso) {
  const L = Math.hypot(...sub(d1, d0)); if (L < 1e-9) return d0;
  const n = Math.min(12, Math.max(1, Math.ceil(L / paso)));
  let ok = d0;
  for (let i = 1; i <= n; i++) {
    const q = d0.map((x, k) => x + ((d1[k] - x) * i) / n);
    if (choca(movil, obst, q)) {
      // Afinar el punto de contacto entre ok y q.
      let a = ok, b = q;
      for (let j = 0; j < 6; j++) { const m = a.map((x, k) => (x + b[k]) / 2); if (choca(movil, obst, m)) b = m; else a = m; }
      return a;
    }
    ok = q;
  }
  return d1;
}

// Desplazamiento permitido desde d0 hacia d1. Si choca en línea recta, intenta
// deslizar eje por eje (como un objeto que roza una pared).
export function avanzar(movil, obst, d0, d1, paso = 0.5) {
  if (!obst) return d1.slice();
  let d = tramo(movil, obst, d0, d1, paso);
  if (d.every((x, k) => Math.abs(x - d1[k]) < 1e-9)) return d1.slice();
  for (let k = 0; k < 3; k++) { if (Math.abs(d[k] - d1[k]) < 1e-9) continue; const q = d.slice(); q[k] = d1[k]; d = tramo(movil, obst, d, q, paso); }
  return d;
}

function puntoMasCercano(p, a, b, c) {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return a;
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return b;
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return [a[0] + v * ab[0], a[1] + v * ab[1], a[2] + v * ab[2]]; }
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return c;
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return [a[0] + w * ac[0], a[1] + w * ac[1], a[2] + w * ac[2]]; }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / (d4 - d3 + (d5 - d6)); return [b[0] + w * (c[0] - b[0]), b[1] + w * (c[1] - b[1]), b[2] + w * (c[2] - b[2])]; }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  return [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w];
}
// ¿Está el punto sobre la superficie de algún obstáculo (a menos de tol)?
function sobreSuperficie(p, obst, tol) {
  let si = false;
  obst.rejilla.consultar(p.map(x => x - tol), p.map(x => x + tol), i => { const [A, B, C] = obst.tris[i], q = puntoMasCercano(p, A, B, C); if (Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) <= tol) { si = true; return false; } });
  return si;
}
// Paridad de cruces de un rayo: dentro si es impar.
function puntoDentro(p, obst, dir) {
  let n = 0;
  for (const [A, B, C] of obst.tris) {
    const e1 = sub(B, A), e2 = sub(C, A), q = cross(dir, e2), det = dot(e1, q);
    if (Math.abs(det) < 1e-14) continue;
    const t0 = sub(p, A), u = dot(t0, q) / det; if (u < 0 || u > 1) continue;
    const r = cross(t0, e1), v = dot(dir, r) / det; if (v < 0 || u + v > 1) continue;
    if (dot(e2, r) / det > 1e-9) n++;
  }
  return n % 2 === 1;
}

// Solape = superficies que se cruzan o pieza metida entera dentro de otra.
// Para lo segundo se usan varios vértices que NO estén sobre la superficie de
// un obstáculo (en un contacto el resultado sería ambiguo) y dos rayos.
export function solapada(movil, obst, d = [0, 0, 0]) {
  if (!obst) return false;
  if (choca(movil, obst, d)) return true;
  const lo = movil.caja.min.map((x, k) => x + d[k]), hi = movil.caja.max.map((x, k) => x + d[k]);
  if (!obst.cajas.some(c => lo.every((x, k) => x < c.max[k]) && hi.every((x, k) => x > c.min[k]))) return false;
  const n = movil.tris.length, tol = Math.max(obst.tol * 50, 1e-3);
  let dentro = 0, fuera = 0;
  for (let i = 0; i < 9 && dentro + fuera < 5; i++) {
    const v = movil.tris[Math.floor((i * n) / 9)][i % 3], p = [v[0] + d[0], v[1] + d[1], v[2] + d[2]];
    if (sobreSuperficie(p, obst, tol)) continue;
    if (puntoDentro(p, obst, [0.0731, 0.0417, 0.9964]) && puntoDentro(p, obst, [-0.6113, 0.7801, 0.1332])) dentro++; else fuera++;
  }
  return dentro > fuera;
}

// Desplazamiento más corto que deja la pieza libre (null si no hace falta).
// Prueba 14 direcciones (ejes, diagonales horizontales y hacia arriba) y nunca
// la baja por debajo de suelo.
export function desincrustar(movil, obst, { suelo = 0 } = {}) {
  if (!solapada(movil, obst)) return null;
  const tam = Math.max(...movil.caja.max.map((x, k) => x - movil.caja.min[k])), lim = Math.max(...obst.cajas.flatMap(c => c.max.map((x, k) => x - c.min[k]))) + tam + 5;
  const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (const a of [1, -1]) for (const b of [1, -1]) { dirs.push([a * Math.SQRT1_2, b * Math.SQRT1_2, 0]); dirs.push([a * 0.5773, b * 0.5773, 0.5773]); }
  let mejor = null;
  for (const u of dirs) {
    let ok = null, mal = 0;
    for (let s = 0.5; s <= lim * 2; s *= 1.6) {
      const d = u.map(x => x * s);
      if (movil.caja.min[2] + d[2] < suelo - 1e-6) break;
      if (!solapada(movil, obst, d)) { ok = s; break; }
      mal = s;
      if (mejor && s >= mejor.s) break; // ya hay una salida más corta
    }
    if (ok === null) continue;
    for (let j = 0; j < 10; j++) { const m = (mal + ok) / 2; if (solapada(movil, obst, u.map(x => x * m))) mal = m; else ok = m; }
    if (!mejor || ok < mejor.s) mejor = { s: ok, d: u.map(x => x * ok) };
  }
  return mejor ? mejor.d : null;
}
