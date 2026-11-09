// Bisturí libre automático: dentro del contorno dibujado busca qué parte quiere sacar el usuario.
//  1) Un cuerpo aparte (p. ej. una diadema modelada como pieza suelta encima del pelo).
//  2) Una zona de otro color (material o color de vértice).
//  3) Una zona rodeada por un surco: aristas cóncavas marcadas donde la parte se apoya.
// Devuelve la máscara de caras y el modo, o null si no encuentra nada claro.
import { soldar, topologia, componentes } from './nucleo-malla.js?v=2.10';

export function detectarZona({ sopa, col, proyectar, poligono, interior, borde, centro }) {
  const nfS = sopa.length / 9;
  const s = soldar(sopa, 1e-6), m = s.malla, origen = s.origen, nf = m.tri.length / 3;
  const inv = new Int32Array(nfS).fill(-1); for (let i = 0; i < nf; i++) inv[origen[i]] = i;
  const topo = topologia(m);
  const P = m.pos, T = m.tri;
  // Datos por cara soldada: centro, normal, área y si su centro cae dentro del contorno.
  const cx = new Float32Array(nf), cy = new Float32Array(nf), cz = new Float32Array(nf), nx = new Float32Array(nf), ny = new Float32Array(nf), nz = new Float32Array(nf), area = new Float32Array(nf);
  for (let f = 0; f < nf; f++) {
    const a = 3 * T[3 * f], b = 3 * T[3 * f + 1], c = 3 * T[3 * f + 2];
    cx[f] = (P[a] + P[b] + P[c]) / 3; cy[f] = (P[a + 1] + P[b + 1] + P[c + 1]) / 3; cz[f] = (P[a + 2] + P[b + 2] + P[c + 2]) / 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    let qx = uy * vz - uz * vy, qy = uz * vx - ux * vz, qz = ux * vy - uy * vx; const l = Math.hypot(qx, qy, qz) || 1;
    area[f] = l / 2; nx[f] = qx / l; ny[f] = qy / l; nz[f] = qz / l;
  }
  let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity, gx = 0, gy = 0;
  for (const p of poligono) { mnx = Math.min(mnx, p.x); mny = Math.min(mny, p.y); mxx = Math.max(mxx, p.x); mxy = Math.max(mxy, p.y); gx += p.x / poligono.length; gy += p.y / poligono.length; }
  const dentroPoli = (x, y, k = 1) => {
    const X = gx + (x - gx) / k, Y = gy + (y - gy) / k;
    if (X < mnx || X > mxx || Y < mny || Y > mxy) return false;
    let c = false; for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) { const a = poligono[i], b = poligono[j]; if ((a.y > Y) !== (b.y > Y) && X < (b.x - a.x) * (Y - a.y) / (b.y - a.y) + a.x) c = !c; } return c;
  };
  const dentro = new Uint8Array(nf), dentroAmplio = new Uint8Array(nf);
  for (let f = 0; f < nf; f++) { const [x, y] = proyectar(cx[f], cy[f], cz[f]); if (dentroPoli(x, y)) dentro[f] = 1; if (dentroPoli(x, y, 1.3)) dentroAmplio[f] = 1; }
  let areaTotal = 0; for (let f = 0; f < nf; f++) areaTotal += area[f];
  const soldadas = lista => lista.map(f => inv[f]).filter(f => f >= 0);
  const golpesInt = soldadas(interior), golpesBorde = soldadas(borde), golpeCentro = centro != null ? inv[centro] : -1;
  const resultado = (modo, mascara, detalle) => { let a = 0; for (let f = 0; f < nf; f++) if (mascara[f]) a += area[f]; return { modo, malla: m, mascara, origen, detalle, fraccion: a / areaTotal }; };

  // 1) Cuerpos aparte casi enteros dentro del contorno y visibles en él.
  const comp = componentes(m, topo);
  if (comp.n > 1) {
    const aT = new Float64Array(comp.n), aD = new Float64Array(comp.n);
    for (let f = 0; f < nf; f++) { aT[comp.id[f]] += area[f]; if (dentro[f]) aD[comp.id[f]] += area[f]; }
    const vistos = new Set(golpesInt.map(f => comp.id[f]));
    const elegidos = [...vistos].filter(c => aD[c] / aT[c] >= 0.85);
    const aEle = elegidos.reduce((s, c) => s + aT[c], 0);
    if (elegidos.length && aEle < areaTotal * 0.7) {
      const set = new Set(elegidos), mascara = new Uint8Array(nf); for (let f = 0; f < nf; f++) if (set.has(comp.id[f])) mascara[f] = 1;
      return resultado('cuerpo', mascara, elegidos.length);
    }
  }

  // 2) Zona de otro color.
  const colW = new Int32Array(nf); for (let f = 0; f < nf; f++) colW[f] = col[origen[f]];
  const distintos = new Set(colW);
  if (distintos.size > 1 && golpesInt.length) {
    const cuenta = new Map(); for (const f of golpesInt) cuenta.set(colW[f], (cuenta.get(colW[f]) || 0) + 1);
    // El color buscado es el que abunda dentro del contorno y casi no aparece sobre el contorno
    // (una diadema estrecha puede ocupar menos de la mitad de lo rodeado).
    const nB = Math.max(1, golpesBorde.length), fracB = k => golpesBorde.filter(f => colW[f] === k).length / nB;
    let K = null, mejor = -Infinity, nK = 0;
    for (const [k, n] of cuenta) { const sc = n / golpesInt.length - fracB(k); if (sc > mejor) { mejor = sc; K = k; nK = n; } }
    if (nK / golpesInt.length >= 0.25 && fracB(K) <= 0.3) {
      const crecer = limite => {
        const mascara = new Uint8Array(nf), pila = [];
        for (const f of golpesInt) if (colW[f] === K && !mascara[f] && (!limite || limite[f])) { mascara[f] = 1; pila.push(f); }
        while (pila.length) { const f = pila.pop(); for (let k = 0; k < 3; k++) { const g = topo.gemela[3 * f + k]; if (g < 0) continue; const F = (g / 3) | 0; if (!mascara[F] && colW[F] === K && (!limite || limite[F])) { mascara[F] = 1; pila.push(F); } } }
        return mascara;
      };
      let mascara = crecer(null), r = resultado('color', mascara, K);
      if (r.fraccion > 0.5) r = resultado('color', crecer(dentroAmplio), K);
      if (r.fraccion > 0 && r.fraccion <= 0.6) return r;
    }
  }

  // 3) Zona rodeada por un surco (aristas cóncavas marcadas).
  if (golpeCentro >= 0) {
    const COS = Math.cos(25 * Math.PI / 180);
    const surco = (f, F) => {
      const d = nx[f] * nx[F] + ny[f] * ny[F] + nz[f] * nz[F];
      if (d > COS) return false;
      return nx[f] * (cx[F] - cx[f]) + ny[f] * (cy[F] - cy[f]) + nz[f] * (cz[F] - cz[f]) > 0;
    };
    const mascara = new Uint8Array(nf), pila = [golpeCentro]; mascara[golpeCentro] = 1;
    while (pila.length) {
      const f = pila.pop();
      for (let k = 0; k < 3; k++) { const g = topo.gemela[3 * f + k]; if (g < 0) continue; const F = (g / 3) | 0; if (mascara[F] || !dentroAmplio[F] || surco(f, F) || surco(F, f)) continue; mascara[F] = 1; pila.push(F); }
    }
    // Calidad del borde: cuánto de él es surco de verdad (y no el límite del contorno).
    let lS = 0, lT = 0;
    for (let f = 0; f < nf; f++) if (mascara[f]) for (let k = 0; k < 3; k++) {
      const g = topo.gemela[3 * f + k]; if (g < 0) continue; const F = (g / 3) | 0; if (mascara[F]) continue;
      const a = 3 * T[3 * f + k], b = 3 * T[3 * f + (k + 1) % 3], L = Math.hypot(P[a] - P[b], P[a + 1] - P[b + 1], P[a + 2] - P[b + 2]);
      lT += L; if (surco(f, F) || surco(F, f)) lS += L;
    }
    const r = resultado('forma', mascara, lT ? lS / lT : 0);
    if (lT && lS / lT >= 0.6 && r.fraccion >= 0.002 && r.fraccion <= 0.6) return r;
  }
  return null;
}
