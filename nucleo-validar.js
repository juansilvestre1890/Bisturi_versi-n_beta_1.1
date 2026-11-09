// Comprobaciones geométricas de las tapas: que no atraviesen la malla, que no
// se crucen entre sí y que entren hacia el interior del sólido en cada arista.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(...a); return l ? a.map(x => x / l) : a; };

export class Rejilla {
  constructor(min, max, celda) {
    this.min = min; this.celda = celda;
    this.n = max.map((x, k) => Math.max(1, Math.min(512, Math.ceil((x - min[k]) / celda) + 1)));
    this.celdas = new Map();
  }
  rango(lo, hi) {
    const c = k => [Math.max(0, Math.min(this.n[k] - 1, Math.floor((lo[k] - this.min[k]) / this.celda))), Math.max(0, Math.min(this.n[k] - 1, Math.floor((hi[k] - this.min[k]) / this.celda)))];
    return [c(0), c(1), c(2)];
  }
  *claves(lo, hi) {
    const [x, y, z] = this.rango(lo, hi);
    for (let i = x[0]; i <= x[1]; i++) for (let j = y[0]; j <= y[1]; j++) for (let k = z[0]; k <= z[1]; k++) yield (i * this.n[1] + j) * this.n[2] + k;
  }
  insertar(id, lo, hi) { for (const c of this.claves(lo, hi)) { let l = this.celdas.get(c); if (!l) this.celdas.set(c, (l = [])); l.push(id); } }
  consultar(lo, hi, visitar) { const vistos = new Set(); for (const c of this.claves(lo, hi)) for (const id of this.celdas.get(c) || []) if (!vistos.has(id)) { vistos.add(id); if (visitar(id) === false) return; } }
}

export function cajaTri(A, B, C, margen = 0) {
  return [[Math.min(A[0], B[0], C[0]) - margen, Math.min(A[1], B[1], C[1]) - margen, Math.min(A[2], B[2], C[2]) - margen], [Math.max(A[0], B[0], C[0]) + margen, Math.max(A[1], B[1], C[1]) + margen, Math.max(A[2], B[2], C[2]) + margen]];
}

// Segmento PQ contra triángulo ABC, por distancias al plano. Los casos
// coplanares se ignoran: las tapas proyectadas no se solapan por construcción
// y el ruido de coma flotante en piezas planas daría falsos positivos.
function segmentoTri(P, Q, A, B, C, tol) {
  const n = cross(sub(B, A), sub(C, A)), ln = Math.hypot(...n);
  if (!ln) return false;
  const dP = dot(n, sub(P, A)) / ln, dQ = dot(n, sub(Q, A)) / ln;
  if ((dP > tol && dQ > tol) || (dP < -tol && dQ < -tol)) return false;
  if (Math.abs(dP) <= tol && Math.abs(dQ) <= tol) return false;
  const s = dP / (dP - dQ), X = [P[0] + s * (Q[0] - P[0]), P[1] + s * (Q[1] - P[1]), P[2] + s * (Q[2] - P[2])];
  // Coordenadas baricéntricas de X en ABC.
  const v0 = sub(B, A), v1 = sub(C, A), v2 = sub(X, A), d00 = dot(v0, v0), d01 = dot(v0, v1), d11 = dot(v1, v1), d20 = dot(v2, v0), d21 = dot(v2, v1);
  const den = d00 * d11 - d01 * d01;
  if (!den) return false;
  const v = (d11 * d20 - d01 * d21) / den, w = (d00 * d21 - d01 * d20) / den, e = 1e-9;
  return v >= -e && w >= -e && v + w <= 1 + e;
}
export function trianglosCruzan(A, B, C, D, E, F) {
  const L = Math.max(...[[A, B], [B, C], [C, A], [D, E], [E, F], [F, D]].map(([x, y]) => Math.hypot(...sub(x, y)))), tol = 1e-6 * L;
  return segmentoTri(A, B, D, E, F, tol) || segmentoTri(B, C, D, E, F, tol) || segmentoTri(C, A, D, E, F, tol)
    || segmentoTri(D, E, A, B, C, tol) || segmentoTri(E, F, A, B, C, tol) || segmentoTri(F, D, A, B, C, tol);
}

// En la arista a→b del borde: s es el tercer vértice de la cara marcada,
// u el de la cara vecina y c el de la tapa. La tapa debe quedar dentro de la
// cuña interior que forman las dos caras.
export function entraHaciaDentro(a, b, s, u, c) {
  const e = norm(sub(b, a)), plano = x => { const d = sub(x, a), k = dot(d, e); return [d[0] - k * e[0], d[1] - k * e[1], d[2] - k * e[2]]; };
  const X = norm(plano(s)), Y = cross(e, X), ang = x => { const p = plano(x); let t = Math.atan2(dot(p, Y), dot(p, X)); return t < 0 ? t + 2 * Math.PI : t; };
  const nS = norm(cross(sub(b, a), sub(s, a))), nU = norm(cross(sub(a, b), sub(u, b)));
  let dentro = [-(nS[0] + nU[0]), -(nS[1] + nU[1]), -(nS[2] + nU[2])];
  if (Math.hypot(...dentro) < 1e-9) dentro = nS.map(x => -x);
  const pu = ang(u), pd = ang([a[0] + dentro[0], a[1] + dentro[1], a[2] + dentro[2]]), pc = ang(c), margen = 1e-6;
  return pd < pu ? pc > margen && pc < pu - margen : pc > pu + margen && pc < 2 * Math.PI - margen;
}
