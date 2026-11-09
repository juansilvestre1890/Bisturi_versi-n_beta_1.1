// Encastres exactos sobre la cara plana de un corte (sin operaciones booleanas).
// La tapa del corte se vuelve a triangular dejando la huella de cada encastre como hueco,
// y se añade un prisma recto a lo largo de la normal: saliente (pasador) o hacia dentro
// (alojamiento). El resultado es cerrado por construcción y se comprueba antes de devolverlo.
import { soldar, orientar, analizar, volumen, componentes, topologia, extraer } from './nucleo-malla.js?v=2.10';
import earcut from './earcut.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const area2 = r => { let s = 0; for (let i = 0; i < r.length; i++) { const [x1, y1] = r[i], [x2, y2] = r[(i + 1) % r.length]; s += x1 * y2 - x2 * y1; } return s / 2; };
function dentro2([x, y], r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
function distSeg2([px, py], [ax, ay], [bx, by]) { const ex = bx - ax, ey = by - ay, l = ex * ex + ey * ey, t = l ? Math.max(0, Math.min(1, ((px - ax) * ex + (py - ay) * ey) / l)) : 0; return Math.hypot(ax + t * ex - px, ay + t * ey - py); }
function segCruza(a, b, c, d) { const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; }

// Distancia de un punto a un triángulo (Ericson, Real-Time Collision Detection).
function distTri(p, a, b, c) {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return Math.hypot(...ap);
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return Math.hypot(...bp);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return Math.hypot(...sub(p, [a[0] + v * ab[0], a[1] + v * ab[1], a[2] + v * ab[2]])); }
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return Math.hypot(...cp);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return Math.hypot(...sub(p, [a[0] + w * ac[0], a[1] + w * ac[1], a[2] + w * ac[2]])); }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return Math.hypot(...sub(p, [b[0] + w * (c[0] - b[0]), b[1] + w * (c[1] - b[1]), b[2] + w * (c[2] - b[2])])); }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  return Math.hypot(...sub(p, [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w]));
}

/**
 * soup: Float32Array de triángulos (coordenadas de mundo, mm).
 * plano: { point:[x,y,z], normal:[x,y,z] } — el plano del corte.
 * huellas: [[ [x,y,z], ... ], ...] — polígonos sobre el plano (uno por encastre).
 * profundidad: mm a lo largo de sentido·normal. sentido: +1 o −1.
 * tipo: 'saliente' (añade material) o 'hueco' (quita material).
 * muro: espesor mínimo de material alrededor de un hueco (mm).
 */
function procesarCuerpo(m, origen, { plano, huellas, profundidad, sentido, tipo, muro = 1.2, margen = 0.6, soloComprobar = false, fuenteNueva = null }) {
  const n = norm(plano.normal), P0 = plano.point;
  const pos = m.pos, tri = m.tri, nf = tri.length / 3, V = i => [pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]];
  let span = 0; for (let k = 0; k < 3; k++) { let a = Infinity, b = -Infinity; for (let i = k; i < pos.length; i += 3) { a = Math.min(a, pos[i]); b = Math.max(b, pos[i]); } span = Math.max(span, b - a); }
  const eps = Math.max(1e-4, span * 2e-6);

  // 1) Caras de la tapa: sobre el plano y con normal paralela a él.
  const esTapa = new Uint8Array(nf); let signo = 0, ntapa = 0;
  for (let f = 0; f < nf; f++) {
    const a = V(tri[3 * f]), b = V(tri[3 * f + 1]), c = V(tri[3 * f + 2]);
    if (Math.abs(dot(sub(a, P0), n)) > eps || Math.abs(dot(sub(b, P0), n)) > eps || Math.abs(dot(sub(c, P0), n)) > eps) continue;
    const nn = cross(sub(b, a), sub(c, a)), l = Math.hypot(...nn);
    if (!l) continue;
    const d = dot(nn, n) / l;
    if (Math.abs(d) < 0.999) continue;
    esTapa[f] = 1; ntapa++; signo += d;
  }
  if (!ntapa) return null;
  const s0 = Math.sign(signo); // la tapa mira hacia s0·n (hacia fuera de la pieza)

  // 2) Marco 2D con (u, v) tal que u×v = s0·n: los contornos exteriores salen antihorarios.
  const guia = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = norm(cross(n, guia)); let v = norm(cross(n, u)); if (dot(cross(u, v), n) * s0 < 0) v = v.map(x => -x);
  const a2 = p => { const d = sub(p, P0); return [dot(d, u), dot(d, v)]; };

  // 3) Contornos de la tapa: medias aristas de tapa sin gemela en la tapa.
  const sig = new Map(), clave = (a, b) => a * 4294967296 + b;
  const dentroTapa = new Set();
  for (let f = 0; f < nf; f++) if (esTapa[f]) for (let k = 0; k < 3; k++) dentroTapa.add(clave(tri[3 * f + k], tri[3 * f + (k + 1) % 3]));
  for (let f = 0; f < nf; f++) if (esTapa[f]) for (let k = 0; k < 3; k++) {
    const a = tri[3 * f + k], b = tri[3 * f + (k + 1) % 3];
    if (!dentroTapa.has(clave(b, a))) (sig.get(a) || sig.set(a, []).get(a)).push(b);
  }
  // Recorre los contornos por aristas; en un vértice donde se tocan dos contornos elige el giro más cerrado.
  const lazos = [], usada = new Set();
  for (const [ini, salidas] of sig) for (const primero of salidas) {
    if (usada.has(clave(ini, primero))) continue;
    const lazo = [ini]; let prev = ini, a = primero; usada.add(clave(ini, primero));
    let guarda = 0;
    while (a !== ini) {
      if (++guarda > 1e7) throw Error('Contorno de la tapa no se cierra.');
      lazo.push(a);
      const op = (sig.get(a) || []).filter(b => !usada.has(clave(a, b)));
      if (!op.length) throw Error('Contorno de la tapa abierto.');
      let next = op[0];
      if (op.length > 1) {
        const [px, py] = a2(V(prev)), [ax, ay] = a2(V(a)), din = [ax - px, ay - py];
        let best = -Infinity;
        for (const b of op) { const [bx, by] = a2(V(b)), dout = [bx - ax, by - ay], ang = Math.atan2(din[0] * dout[1] - din[1] * dout[0], din[0] * dout[0] + din[1] * dout[1]); if (ang > best) { best = ang; next = b; } }
      }
      usada.add(clave(a, next)); prev = a; a = next;
    }
    lazos.push(lazo);
  }
  const anillos = lazos.map(l => ({ ids: l, p2: l.map(i => a2(V(i))) }));
  const exteriores = anillos.filter(r => area2(r.p2) > 0), agujeros = anillos.filter(r => area2(r.p2) < 0);
  for (const h of agujeros) { h.padre = exteriores.find(e => dentro2(h.p2[0], e.p2)); if (!h.padre) throw Error('No se pudo ordenar los contornos de la cara del corte.'); }

  if (soloComprobar) return huellas.map(h => {
    // 2: la huella cae entera dentro de esta cara; 1: la toca en parte; 0: no la toca.
    const p2 = (Array.isArray(h) ? h : h.base).map(a2);
    const enAgujero = p => agujeros.some(a => dentro2(p, a.p2));
    const dentroCara = p => exteriores.some(e => dentro2(p, e.p2)) && !enAgujero(p);
    const n = p2.filter(dentroCara).length;
    const cruza = anillos.some(r => r.p2.some((A, i) => { const B = r.p2[(i + 1) % r.p2.length]; return p2.some((q, j) => segCruza(A, B, q, p2[(j + 1) % p2.length])); }));
    const centro = [p2.reduce((a, q) => a + q[0], 0) / p2.length, p2.reduce((a, q) => a + q[1], 0) / p2.length];
    if (n === p2.length && !cruza) return 2;
    return n || cruza || dentroCara(centro) || anillos.some(r => r.p2.some(q => dentro2(q, p2))) ? 1 : 0;
  });
  // 4) Huellas: dentro de un contorno exterior, fuera de agujeros, lejos del borde y sin cruces.
  const nuevas = [];
  const pos2 = Array.from(pos), addV = p => { pos2.push(p[0], p[1], p[2]); return pos2.length / 3 - 1; };
  const formas = huellas.map(h => Array.isArray(h) ? { base: h, tope: null } : h);
  const huellas2 = formas.map(f => { let p2 = f.base.map(a2), inv = false; if (area2(p2) > 0) { p2 = p2.reverse(); inv = true; } f.inv = inv; return p2; }); // huecos: horarios
  huellas2.forEach((h2, idx) => {
    const padre = exteriores.find(e => h2.every(p => dentro2(p, e.p2)));
    if (!padre) throw Error(`El encastre ${idx + 1} se sale de la cara del corte. Muévelo hacia el centro o redúcelo.`);
    for (const ag of agujeros) if (ag.padre === padre && h2.some(p => dentro2(p, ag.p2))) throw Error(`El encastre ${idx + 1} cae sobre un hueco de la pieza.`);
    for (const r of [padre, ...agujeros.filter(a => a.padre === padre)]) {
      for (let i = 0; i < r.p2.length; i++) {
        const A = r.p2[i], B = r.p2[(i + 1) % r.p2.length];
        for (let j = 0; j < h2.length; j++) {
          if (distSeg2(h2[j], A, B) < margen) throw Error(`El encastre ${idx + 1} queda a menos de ${margen} mm del borde de la pieza. Muévelo hacia el centro o redúcelo.`);
          if (segCruza(A, B, h2[j], h2[(j + 1) % h2.length])) throw Error(`El encastre ${idx + 1} cruza el borde de la pieza.`);
        }
      }
    }
    // la base del prisma: vértices nuevos sobre el plano
    const base = h2.map(([x, y]) => addV([P0[0] + u[0] * x + v[0] * y, P0[1] + u[1] * x + v[1] * y, P0[2] + u[2] * x + v[2] * y]));
    nuevas.push({ h2, base, padre, forma: formas[idx] });
  });

  // 5) Nueva tapa: cada contorno exterior con sus agujeros y las huellas que le caen dentro.
  const caras = [], fuente = [];
  let fuenteTapa = -1;
  for (let f = 0; f < nf; f++) { if (esTapa[f]) { if (fuenteTapa < 0) fuenteTapa = origen[f]; continue; } caras.push(tri[3 * f], tri[3 * f + 1], tri[3 * f + 2]); fuente.push(origen[f]); }
  for (const e of exteriores) {
    const ids = [...e.ids], coords = e.p2.flat(), holes = [];
    for (const r of [...agujeros.filter(a => a.padre === e).map(a => ({ ids: a.ids, p2: a.p2 })), ...nuevas.filter(h => h.padre === e).map(h => ({ ids: h.base, p2: h.h2 }))]) {
      holes.push(ids.length); ids.push(...r.ids); coords.push(...r.p2.flat());
    }
    const t = earcut(coords, holes, 2);
    if (!t.length) throw Error('No se pudo triangular la cara del corte con los encastres.');
    for (let i = 0; i < t.length; i += 3) {
      const [x1, y1] = [coords[2 * t[i]], coords[2 * t[i] + 1]], [x2, y2] = [coords[2 * t[i + 1]], coords[2 * t[i + 1] + 1]], [x3, y3] = [coords[2 * t[i + 2]], coords[2 * t[i + 2] + 1]];
      const ccw = (x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1) > 0;
      caras.push(ids[t[i]], ccw ? ids[t[i + 1]] : ids[t[i + 2]], ccw ? ids[t[i + 2]] : ids[t[i + 1]]); fuente.push(fuenteTapa);
    }
  }

  // 6) Prismas: paredes y fondo/cabeza.
  const desplaz = n.map(x => x * sentido * profundidad);
  let volumenEsperado = 0;
  const prismas = [];
  const fuentePrisma = fuenteNueva ?? fuenteTapa;
  for (const h of nuevas) {
    const L = h.base.length;
    // Anillo superior: prisma recto (base desplazada) o anillo dado; vértices repetidos se comparten.
    let topePts;
    if (h.forma.tope) { topePts = h.forma.inv ? [...h.forma.tope].reverse() : h.forma.tope; }
    else topePts = h.base.map(i => [pos2[3 * i] + desplaz[0], pos2[3 * i + 1] + desplaz[1], pos2[3 * i + 2] + desplaz[2]]);
    const unicos = new Map(), tope = topePts.map(p => { const k = p.join(','); if (!unicos.has(k)) unicos.set(k, addV(p)); return unicos.get(k); });
    for (let i = 0; i < L; i++) {
      const a = h.base[i], b = h.base[(i + 1) % L], c = tope[(i + 1) % L], d = tope[i];
      caras.push(a, b, c); fuente.push(fuentePrisma);
      if (c !== d) { caras.push(a, c, d); fuente.push(fuentePrisma); }
    }
    // tapa superior: polígono de vértices únicos en orden
    const ring = tope.filter((v, i) => v !== tope[(i + L - 1) % L]);
    const ring2 = ring.map(i => a2([pos2[3 * i], pos2[3 * i + 1], pos2[3 * i + 2]]));
    const t = earcut(ring2.flat(), null, 2);
    for (let i = 0; i < t.length; i += 3) { caras.push(ring[t[i]], ring[t[i + 1]], ring[t[i + 2]]); fuente.push(fuentePrisma); }
    // volumen del sólido añadido/quitado: base + paredes + tapa superior, cerrado
    const solido = [];
    const tb = earcut(h.h2.flat(), null, 2); for (let i = 0; i < tb.length; i += 3) solido.push(h.base[tb[i]], h.base[tb[i + 2]], h.base[tb[i + 1]]);
    for (let i = 0; i < L; i++) { const a = h.base[i], b = h.base[(i + 1) % L], c = tope[(i + 1) % L], d = tope[i]; solido.push(a, b, c); if (c !== d) solido.push(a, c, d); }
    for (let i = 0; i < t.length; i += 3) solido.push(ring[t[i]], ring[t[i + 1]], ring[t[i + 2]]);
    volumenEsperado += Math.abs(volumen(orientar({ pos: Float32Array.from(pos2), tri: Uint32Array.from(solido) }).malla));
    prismas.push({ base: h.base, tope });
  }

  // 6b) Triángulos de área nula en la tapa (puntos alineados): se gira la diagonal con su vecino coplanario.
  {
    const P = i => [pos2[3 * i], pos2[3 * i + 1], pos2[3 * i + 2]];
    const areaT = (a, b, c) => Math.hypot(...cross(sub(P(b), P(a)), sub(P(c), P(a)))) / 2;
    const plano = i => Math.abs(dot(sub(P(i), P0), n)) <= eps;
    for (let pasada = 0; pasada < 40; pasada++) {
      const ar = new Map(), K = (a, b) => a < b ? a * 4294967296 + b : b * 4294967296 + a;
      for (let f = 0; f < caras.length / 3; f++) for (let k = 0; k < 3; k++) { const key = K(caras[3 * f + k], caras[3 * f + (k + 1) % 3]); (ar.get(key) || ar.set(key, []).get(key)).push(f); }
      let giros = 0;
      for (let f = 0; f < caras.length / 3; f++) {
        const t = [caras[3 * f], caras[3 * f + 1], caras[3 * f + 2]];
        if (!t.every(plano)) continue;
        const la = Math.max(...[0, 1, 2].map(k => Math.hypot(...sub(P(t[k]), P(t[(k + 1) % 3])))));
        if (areaT(...t) > 1e-7 * la * la + 1e-12) continue;
        // arista más larga (a,c) y vértice intermedio b
        let k = 0, best = -1; for (let q = 0; q < 3; q++) { const d = Math.hypot(...sub(P(t[q]), P(t[(q + 1) % 3]))); if (d > best) { best = d; k = q; } }
        const a = t[k], c = t[(k + 1) % 3], b = t[(k + 2) % 3];
        const g = (ar.get(K(a, c)) || []).find(x => x !== f);
        if (g === undefined) continue;
        const u2 = [caras[3 * g], caras[3 * g + 1], caras[3 * g + 2]], d = u2.find(x => x !== a && x !== c);
        if (!plano(d)) continue;
        // f = (a,c,b) en orden; g contiene la arista (c,a). Nuevos: (a,d,b)?? se reconstruye con la orientación de f.
        const fo = [caras[3 * f], caras[3 * f + 1], caras[3 * f + 2]], pos_a = fo.indexOf(a), sentidoAC = fo[(pos_a + 1) % 3] === c;
        const t1 = sentidoAC ? [a, d, b] : [a, b, d], t2 = sentidoAC ? [d, c, b] : [b, c, d];
        if (areaT(...t1) <= 1e-12 || areaT(...t2) <= 1e-12) continue;
        caras.splice(3 * f, 3, ...t1); caras.splice(3 * g, 3, ...t2); giros++;
        break; // el mapa de aristas cambió: se rehace en la siguiente pasada
      }
      if (!giros) break;
    }
  }

  // 7) Orientación coherente y comprobaciones.
  const res0 = { pos: Float32Array.from(pos2), tri: Uint32Array.from(caras) };
  const r = orientar(res0), res = r.malla, info = analizar(res);
  if (!info.cerrada) throw Error('El resultado no quedó cerrado; mueve un poco los encastres.');
  const v0 = Math.abs(volumen(m)), v1 = Math.abs(volumen(res)), cambio = v1 - v0, esperado = tipo === 'saliente' ? volumenEsperado : -volumenEsperado;
  if (Math.abs(cambio - esperado) > Math.max(0.02 * volumenEsperado, 1e-3)) throw Error(`El cambio de volumen (${cambio.toFixed(2)} mm³) no coincide con el esperado (${esperado.toFixed(2)} mm³): el encastre atraviesa la pieza. Reduce la profundidad o muévelo.`);

  // 8) Espesor alrededor de los huecos: ningún punto del alojamiento cerca de la superficie original.
  if (tipo === 'hueco') {
    const cel = Math.max(muro, 1), grid = new Map(), key = (x, y, z) => `${x},${y},${z}`;
    for (let f = 0; f < nf; f++) {
      if (esTapa[f]) continue;
      const a = V(tri[3 * f]), b = V(tri[3 * f + 1]), c = V(tri[3 * f + 2]);
      const lo = [0, 1, 2].map(k => Math.floor((Math.min(a[k], b[k], c[k]) - muro) / cel)), hi = [0, 1, 2].map(k => Math.floor((Math.max(a[k], b[k], c[k]) + muro) / cel));
      if ((hi[0] - lo[0] + 1) * (hi[1] - lo[1] + 1) * (hi[2] - lo[2] + 1) > 4000) continue; // cara enorme: se mide aparte
      for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) { const kk = key(x, y, z); (grid.get(kk) || grid.set(kk, []).get(kk)).push(f); }
    }
    const grandes = []; for (let f = 0; f < nf; f++) if (!esTapa[f]) { const a = V(tri[3 * f]), b = V(tri[3 * f + 1]), c = V(tri[3 * f + 2]); const lo = [0, 1, 2].map(k => Math.floor((Math.min(a[k], b[k], c[k]) - muro) / cel)), hi = [0, 1, 2].map(k => Math.floor((Math.max(a[k], b[k], c[k]) + muro) / cel)); if ((hi[0] - lo[0] + 1) * (hi[1] - lo[1] + 1) * (hi[2] - lo[2] + 1) > 4000) grandes.push(f); }
    const cercano = p => {
      let d = Infinity; const c = p.map(x => Math.floor(x / cel)), vistos = new Set();
      for (const f of [...(grid.get(key(...c)) || []), ...grandes]) { if (vistos.has(f)) continue; vistos.add(f); d = Math.min(d, distTri(p, V(tri[3 * f]), V(tri[3 * f + 1]), V(tri[3 * f + 2]))); }
      return d;
    };
    prismas.forEach((pr, idx) => {
      const L = pr.base.length, muestras = [];
      for (const t of [0.25, 0.5, 0.75, 1]) for (let i = 0; i < L; i += Math.max(1, Math.floor(L / 16))) { const b = pr.base[i], e = pr.tope[i]; muestras.push([0, 1, 2].map(k => pos2[3 * b + k] + (pos2[3 * e + k] - pos2[3 * b + k]) * t)); }
      const cx = [0, 1, 2].map(k => pr.tope.reduce((s, i) => s + pos2[3 * i + k], 0) / L); muestras.push(cx);
      for (const p of muestras) { const d = cercano(p); if (d < muro) throw Error(`El alojamiento ${idx + 1} deja solo ${d.toFixed(2)} mm de pared (mínimo ${muro} mm). Reduce la profundidad o el tamaño, o muévelo.`); }
    });
  }
  // la orientación puede haber girado caras pero no las reordena: la fuente sigue alineada
  return { pos: res.pos, tri: res.tri, fuente: Int32Array.from(fuente), cambioVolumen: cambio, volumenEsperado: esperado };
}

// Separa la pieza en cuerpos (dos cuerpos que se tocan, como sombrero y tallo, no se mezclan)
// y aplica cada encastre al cuerpo cuya cara de corte lo contiene.
export function aplicarEncastreExacto(soup, opciones) {
  const s = soldar(soup), base = s.malla, comp = componentes(base, topologia(base));
  const grupos = Array.from({ length: comp.n }, () => []);
  for (let f = 0; f < comp.id.length; f++) grupos[comp.id[f]].push(f);
  const cuerpos = grupos.map(caras => { const mm = orientar(extraer(base.pos, base.tri, caras)).malla; return { m: mm, origen: Int32Array.from(caras, f => s.origen[f]) }; });
  // Estado de cada huella en cada cuerpo (las figuras suelen tener partes superpuestas: cabeza, pelo, cuerpo…).
  const estados = cuerpos.map(c => procesarCuerpo(c.m, c.origen, { ...opciones, soloComprobar: true }) || opciones.huellas.map(() => 0));
  const destino = opciones.huellas.map(() => []);
  opciones.huellas.forEach((_, k) => {
    const llenos = estados.map((e, i) => e[k] === 2 ? i : -1).filter(i => i >= 0), parciales = estados.map((e, i) => e[k] === 1 ? i : -1).filter(i => i >= 0);
    if (!llenos.length) throw Error(parciales.length ? `El encastre ${k + 1} cruza el borde de la cara del corte. Muévelo hacia el centro o redúcelo.` : `El encastre ${k + 1} se sale de la cara del corte. Muévelo hacia el centro o redúcelo.`);
    if (opciones.tipo === 'hueco') {
      // El hueco debe abrirse en todas las partes superpuestas en ese punto; si alguna lo toca solo en parte, el hueco quedaría tapado.
      if (parciales.length) throw Error(`El alojamiento ${k + 1} queda a medias sobre otra parte del modelo que se superpone en el corte (el modelo tiene partes superpuestas). Muévelo a una zona donde todas las partes lo cubran o no lo toquen.`);
      destino[k] = llenos;
    } else destino[k] = [llenos[0]];
  });
  const pos = [], tri = [], fuente = []; let cambio = 0, esperado = 0;
  cuerpos.forEach((c, i) => {
    const mias = opciones.huellas.filter((_, k) => destino[k].includes(i)), varios = opciones.huellas.some((_, k) => destino[k].includes(i) && destino[k].length > 1);
    let r;
    if (mias.length) { try { r = procesarCuerpo(c.m, c.origen, { ...opciones, huellas: mias, superpuesto: varios }); } catch (e) { throw Error(e.message.replace(/(encastre|alojamiento) (\d+)/, (_, w, j) => `${w} ${opciones.huellas.indexOf(mias[j - 1]) + 1}`) + (varios ? ' (el modelo tiene partes superpuestas en ese punto)' : '')); } cambio += r.cambioVolumen; esperado += r.volumenEsperado; }
    else r = { pos: c.m.pos, tri: c.m.tri, fuente: c.origen };
    const b = pos.length / 3; for (const x of r.pos) pos.push(x); for (const t of r.tri) tri.push(t + b); for (const f of r.fuente) fuente.push(f);
  });
  return { pos: Float32Array.from(pos), tri: Uint32Array.from(tri), fuente: Int32Array.from(fuente), cambioVolumen: cambio, volumenEsperado: esperado };
}

/** Prisma cerrado independiente (pasador suelto) con base en el plano P0 + desplazamiento. */
export function prismaSuelto(huella, normal, desde, hasta) {
  const n = norm(normal), pos = [], tri = [], L = huella.length;
  for (const t of [desde, hasta]) for (const p of huella) pos.push(p[0] + n[0] * t, p[1] + n[1] * t, p[2] + n[2] * t);
  for (let i = 0; i < L; i++) { const a = i, b = (i + 1) % L; tri.push(a, b, L + b, a, L + b, L + a); }
  const guia = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], u = norm(cross(n, guia)), v = norm(cross(n, u));
  const t = earcut(huella.flatMap(p => [dot(p, u), dot(p, v)]), null, 2);
  for (let i = 0; i < t.length; i += 3) { tri.push(t[i], t[i + 1], t[i + 2]); tri.push(L + t[i], L + t[i + 2], L + t[i + 1]); }
  const r = orientar({ pos: Float32Array.from(pos), tri: Uint32Array.from(tri) }).malla;
  if (!analizar(r).cerrada) throw Error('No se pudo crear el pasador suelto.');
  return r;
}

/**
 * Cola de milano deslizante con entrada («ojo de cerradura»), toda dentro de la cara del corte.
 * Macho: riel de sección trapezoidal, estrecho en la cara (ancho − 2·estrechamiento) y ancho en la punta.
 * Hembra: canal con la misma sección más holgura y, a continuación, una entrada recta del ancho máximo.
 * Montaje: se apoya el riel en la entrada, se baja y se desliza hacia el canal hasta el tope.
 * Devuelve anillos {base, tope} en coordenadas de mundo; el riel crece hacia −normal (hacia la hembra).
 */
export function colaDeMilano({ centro, normal, eje, ancho, estrechamiento, altura, largo, holgura }) {
  const n = norm(normal), y = norm(sub(eje, n.map(x => x * dot(eje, n)))), x = norm(cross(n, y)), d = n.map(v => -v);
  const P = (px, py, pz) => [0, 1, 2].map(k => centro[k] + x[k] * px + y[k] * py + d[k] * pz);
  const r1 = ancho / 2, r0 = r1 - estrechamiento, c = holgura;
  if (!(r0 > 0.4)) throw Error('El estrechamiento es demasiado grande para ese ancho.');
  const a = largo + c, T = 2 * a, y0 = -T / 2, yA = y0 + a, y1 = T / 2;
  const macho = {
    base: [P(-r0, y0, 0), P(r0, y0, 0), P(r0, y0 + largo, 0), P(-r0, y0 + largo, 0)],
    tope: [P(-r1, y0, altura), P(r1, y0, altura), P(r1, y0 + largo, altura), P(-r1, y0 + largo, altura)]
  };
  const h0 = r0 + c, H = r1 + c, D = altura + c;
  const hembra = {
    base: [P(-h0, y0, 0), P(h0, y0, 0), P(h0, yA, 0), P(H, yA, 0), P(H, y1, 0), P(-H, y1, 0), P(-H, yA, 0), P(-h0, yA, 0)],
    tope: [P(-H, y0, D), P(H, y0, D), P(H, yA, D), P(H, yA, D), P(H, y1, D), P(-H, y1, D), P(-H, yA, D), P(-H, yA, D)]
  };
  return { macho, hembra, recorrido: a, largoTotal: T };
}
