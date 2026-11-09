// Encastres en caras planas de contacto (de Cortador STL).
// Busca caras planas coincidentes y opuestas entre dos piezas (las tapas de un
// corte por plano o de una tapa plana) y coloca:
//  - «macho»: un pin pegado a una pieza y el agujero en la otra (la más gruesa);
//  - «pasadores»: un agujero en cada pieza y pasadores sueltos que se imprimen aparte.
// El punto elegido es el más alejado del borde de la cara común; con 2 por unión
// se buscan dos puntos separados. Si no cabe con la pared mínima, no se pone.
import earcut from './earcut.js?v=2.10';

const Q = 1e4;
const xkey = (p, o) => p[o] + ',' + p[o + 1] + ',' + p[o + 2];
const vkey = (p, o) => Math.round(p[o] * Q) + ',' + Math.round(p[o + 1] * Q) + ',' + Math.round(p[o + 2] * Q);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const nrm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const pushTri = (arr, a, b, c) => arr.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
const pushOriented = (arr, a, b, c, dir) => (dot(cross(sub(b, a), sub(c, a)), dir) < 0 ? pushTri(arr, a, c, b) : pushTri(arr, a, b, c));
const area2 = p2 => { let a = 0; for (let i = 0, n = p2.length; i < n; i++) { const p = p2[i], q = p2[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
function inPoly(pt, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < ((b[0] - a[0]) * (pt[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; }

function chainLoops(segs) {
  const adj = new Map();
  for (const [a, b] of segs) { let l = adj.get(a); if (!l) { l = []; adj.set(a, l); } l.push(b); }
  const loops = [];
  for (const st of adj.keys()) while (adj.get(st).length) {
    const loop = [st]; let cur = st, closed = false;
    for (let g = 0; g < 5e6; g++) { const ends = adj.get(cur); if (!ends || !ends.length) break; const nx = ends.pop(); if (nx === st) { closed = true; break; } loop.push(nx); cur = nx; }
    if (closed && loop.length >= 3) loops.push(loop);
  }
  return loops;
}
function nest(L) {
  L = L.filter(l => Math.abs(l.area) > 1e-9).sort((x, y) => Math.abs(y.area) - Math.abs(x.area));
  L.forEach((l, i) => { l.depth = 0; l.parent = -1; l.holes = []; for (let j = 0; j < i; j++) if (inPoly(l.p2[0], L[j].p2)) { l.depth++; l.parent = j; } });
  L.forEach(l => { if (l.depth % 2 === 1 && l.parent >= 0) L[l.parent].holes.push(l); });
  return L.filter(l => l.depth % 2 === 0);
}
function fillPoly(outer, holes, dir, out) {
  const datos = [], inicios = [], all3 = outer.p3.slice(), rings = [[0, outer.p2.length]];
  for (const p of outer.p2) datos.push(p[0], p[1]);
  for (const h of holes) { inicios.push(datos.length / 2); rings.push([datos.length / 2, h.p2.length]); for (const p of h.p2) datos.push(p[0], p[1]); for (const p of h.p3) all3.push(p); }
  const idx = Array.from(earcut(datos, inicios.length ? inicios : null, 2));
  if (!idx.length) return false;
  // earcut descarta los vértices alineados del borde; la pared sí los usa, así que se
  // vuelven a meter partiendo el triángulo que tiene la arista que los salta (malla cerrada).
  const used = new Uint8Array(datos.length / 2); for (const v of idx) used[v] = 1;
  for (const [st, len] of rings) for (let k = 0; k < len; k++) {
    const b = st + k; if (used[b]) continue;
    let pa = -1, pc = -1;
    for (let s = 1; s < len; s++) { const v = st + ((k - s + len) % len); if (used[v]) { pa = v; break; } }
    for (let s = 1; s < len; s++) { const v = st + ((k + s) % len); if (used[v]) { pc = v; break; } }
    if (pa < 0 || pc < 0 || pa === pc) continue;
    for (let t = 0; t < idx.length; t += 3) {
      let hit = -1;
      for (let e = 0; e < 3; e++) { const x = idx[t + e], y = idx[t + (e + 1) % 3]; if ((x === pa && y === pc) || (x === pc && y === pa)) { hit = e; break; } }
      if (hit < 0) continue;
      const x = idx[t + hit], y = idx[t + (hit + 1) % 3], z = idx[t + (hit + 2) % 3];
      idx[t] = x; idx[t + 1] = b; idx[t + 2] = z; idx.push(b, y, z); used[b] = 1; break;
    }
  }
  for (let i = 0; i < idx.length; i += 3) pushOriented(out, all3[idx[i]], all3[idx[i + 1]], all3[idx[i + 2]], dir);
  return true;
}
function lathe(prof, seg, cx = 0, cy = 0) {
  const out = [], P = (r, z, j) => { const a = (j / seg) * Math.PI * 2; return [cx + r * Math.cos(a), cy + r * Math.sin(a), z]; };
  for (let i = 0; i < prof.length - 1; i++) {
    const [r0, z0] = prof[i], [r1, z1] = prof[i + 1];
    for (let j = 0; j < seg; j++) { const A = P(r0, z0, j), B = P(r0, z0, j + 1), C = P(r1, z1, j + 1), D = P(r1, z1, j); if (r0 > 0) pushTri(out, A, B, C); if (r1 > 0) pushTri(out, A, C, D); }
  }
  return out;
}

function planarGroups(pos) {
  const g = new Map();
  for (let t = 0, o = 0; o < pos.length; o += 9, t++) {
    const n = cross([pos[o + 3] - pos[o], pos[o + 4] - pos[o + 1], pos[o + 5] - pos[o + 2]], [pos[o + 6] - pos[o], pos[o + 7] - pos[o + 1], pos[o + 8] - pos[o + 2]]);
    const l = Math.hypot(n[0], n[1], n[2]); if (l < 1e-6) continue;
    const u = [n[0] / l, n[1] / l, n[2] / l];
    for (let j = 0; j < 3; j++) if (Math.abs(u[j]) < 2e-4) u[j] = 0;
    const s = (u[0] !== 0 ? u[0] : u[1] !== 0 ? u[1] : u[2]) > 0 ? 1 : -1, cn = [u[0] * s, u[1] * s, u[2] * s], d = dot(cn, [pos[o], pos[o + 1], pos[o + 2]]);
    const key = ((Math.round(cn[0] * 800) + 800) * 1601 + (Math.round(cn[1] * 800) + 800)) * 1601 * 1e6 + (Math.round(cn[2] * 800) + 800) * 1e6 + (Math.round(d * 20) + 500000);
    let e = g.get(key); if (!e) { e = { cn, d, area: { 1: 0, '-1': 0 }, tris: { 1: [], '-1': [] } }; g.set(key, e); }
    e.tris[s].push(t); e.area[s] += l / 2;
  }
  return g;
}
function regionInfo(pos, tris, m, dPl) {
  const kp = new Map(), edges = new Set(), segs = [];
  for (const t of tris) {
    const ks = [0, 1, 2].map(j => { const o = t * 9 + j * 3, k = vkey(pos, o); if (!kp.has(k)) kp.set(k, [pos[o], pos[o + 1], pos[o + 2]]); return k; });
    for (let j = 0; j < 3; j++) edges.add(ks[j] + '>' + ks[(j + 1) % 3]);
  }
  for (const e of edges) { const [a, b] = e.split('>'); if (!edges.has(b + '>' + a)) segs.push([a, b]); }
  const loops = chainLoops(segs), ref = Math.abs(m[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], u = nrm(cross(m, ref)), v = cross(m, u);
  const L = loops.map(l => { const p3 = l.map(k => kp.get(k)), p2 = p3.map(p => [dot(p, u), dot(p, v)]); return { p3, p2, area: area2(p2) }; });
  return { L, u, v, m, d: dPl, abiertos };
}
function segDist(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1e-12; let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); }
function edgeDist(p, L) { let m = Infinity; for (const l of L) { const q = l.p2; for (let i = 0; i < q.length; i++) { const d = segDist(p, q[i], q[(i + 1) % q.length]); if (d < m) m = d; } } return m; }
function insideL(p, L) { let c = false; for (const l of L) if (inPoly(p, l.p2)) c = !c; return c; }
function rayDepth(pos, o, dir) {
  // Möller–Trumbore sin crear arreglos (rápido en mallas de millones de triángulos).
  let best = Infinity; const dx = dir[0], dy = dir[1], dz = dir[2], ox = o[0], oy = o[1], oz = o[2];
  for (let i = 0; i < pos.length; i += 9) {
    const ax = pos[i], ay = pos[i + 1], az = pos[i + 2];
    const e1x = pos[i + 3] - ax, e1y = pos[i + 4] - ay, e1z = pos[i + 5] - az, e2x = pos[i + 6] - ax, e2y = pos[i + 7] - ay, e2z = pos[i + 8] - az;
    const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x, det = e1x * px + e1y * py + e1z * pz;
    if (det > -1e-12 && det < 1e-12) continue;
    const inv = 1 / det, tx = ox - ax, ty = oy - ay, tz = oz - az, uu = (tx * px + ty * py + tz * pz) * inv; if (uu < 0 || uu > 1) continue;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, vv = (dx * qx + dy * qy + dz * qz) * inv; if (vv < 0 || uu + vv > 1) continue;
    const t = (e2x * qx + e2y * qy + e2z * qz) * inv; if (t > 1e-3 && t < best) best = t;
  }
  return best;
}
function thickness(pos, c, dir, r, R) { let m = rayDepth(pos, c, dir); for (const s of [[r, 0], [-r, 0], [0, r], [0, -r]]) m = Math.min(m, rayDepth(pos, add(add(c, R.u, s[0]), R.v, s[1]), dir)); return m; }

// piezas: [{sopa: Float32Array, col: Int16Array}] (posiciones reales, sin separar).
// J: {tipo:'macho'|'pasadores', d, profundidad, holgura, porUnion, pared}
export function anadirEncastres(piezas, J, { xPasadores = 0, yPasadores = 0 } = {}) {
  const WALL = J.pared, rp = (J.d + J.holgura) / 2, need = rp + WALL, minA = Math.PI * need * need;
  const groups = piezas.map(p => planarGroups(p.sopa)), ops = piezas.map(() => new Map()), pins = [];
  let skipped = 0, joins = 0;
  const getOp = (i, key, s) => {
    const id = key + '#' + s; let op = ops[i].get(id);
    if (!op) { const g = groups[i].get(key), m = [g.cn[0] * s, g.cn[1] * s, g.cn[2] * s]; op = { tris: g.tris[s], info: regionInfo(piezas[i].sopa, g.tris[s], m, g.d * s), holes: [] }; ops[i].set(id, op); }
    return op;
  };
  for (let i = 0; i < piezas.length; i++) for (const [key, g] of groups[i]) {
    if (g.area[1] < minA) continue;
    for (let j = 0; j < piezas.length; j++) {
      if (j === i) continue;
      const hh = groups[j].get(key); if (!hh || hh.area[-1] < minA) continue;
      const A = getOp(i, key, 1), B = getOp(j, key, -1), RA = A.info, LA = RA.L, LB = B.info.L.map(l => ({ p2: l.p3.map(p => [dot(p, RA.u), dot(p, RA.v)]) }));
      let mn = [Infinity, Infinity], mx = [-Infinity, -Infinity];
      for (const l of LA) for (const p of l.p2) { mn = [Math.min(mn[0], p[0]), Math.min(mn[1], p[1])]; mx = [Math.max(mx[0], p[0]), Math.max(mx[1], p[1])]; }
      const step = Math.max(0.4, Math.max(mx[0] - mn[0], mx[1] - mn[1]) / 48), cand = []; let overlap = 0;
      for (let x = mn[0] + step / 2; x < mx[0]; x += step) for (let y = mn[1] + step / 2; y < mx[1]; y += step) {
        const p = [x, y]; if (!insideL(p, LA) || !insideL(p, LB)) continue; overlap++;
        const dd = Math.min(edgeDist(p, LA), edgeDist(p, LB));
        if (dd >= need && !A.holes.some(h => Math.hypot(h.c2[0] - x, h.c2[1] - y) < h.r + rp + WALL)) cand.push({ p, dd });
      }
      if (overlap * step * step < minA) continue;
      if (!cand.length) { skipped++; continue; }
      cand.sort((a, b) => b.dd - a.dd);
      let chosen = [cand[0]];
      if (J.porUnion === 2) {
        const top = cand.slice(0, 500); let best = null, bs = 0;
        for (let a = 0; a < top.length; a++) for (let b = a + 1; b < top.length; b++) { const dd = Math.hypot(top[a].p[0] - top[b].p[0], top[a].p[1] - top[b].p[1]); if (dd < 2 * need) continue; const sc = Math.min(top[a].dd, top[b].dd) + dd * 0.5; if (sc > bs) { bs = sc; best = [top[a], top[b]]; } }
        if (best) chosen = best;
      }
      let placed = 0;
      for (const c of chosen) {
        const c3 = add(add(RA.m.map(x => x * RA.d), RA.u, c.p[0]), RA.v, c.p[1]);
        const ti = thickness(piezas[i].sopa, c3, RA.m.map(x => -x), rp, RA), tj = thickness(piezas[j].sopa, c3, RA.m, rp, RA), toB = p => [dot(p, B.info.u), dot(p, B.info.v)];
        if (J.tipo === 'pasadores') {
          const hi = Math.min(J.profundidad, ti - WALL), hj = Math.min(J.profundidad, tj - WALL); if (hi < 2 || hj < 2) continue;
          A.holes.push({ c2: c.p, c3, r: rp, h: hi, kind: 'pocket' }); B.holes.push({ c2: toB(c3), c3, r: rp, h: hj, kind: 'pocket' }); pins.push({ r: J.d / 2, L: hi + hj - 0.6 }); placed++;
        } else {
          const femA = ti >= tj, hf = Math.min(J.profundidad, (femA ? ti : tj) - WALL), hb = hf - 0.5; if (hb < 2) continue;
          const Fm = femA ? A : B, Mo = femA ? B : A, tf = p => (Fm === A ? c.p : toB(p)), tm = p => (Mo === A ? c.p : toB(p));
          Fm.holes.push({ c2: tf(c3), c3, r: rp, h: hf, kind: 'pocket' }); Mo.holes.push({ c2: tm(c3), c3, r: J.d / 2, h: hb, kind: 'boss' }); placed++;
        }
      }
      if (placed) joins++; else skipped++;
    }
  }
  const salida = piezas.map((pc, i) => {
    const mods = [...ops[i].values()].filter(o => o.holes.length); if (!mods.length) return { ...pc, cambiada: false };
    const rm = new Set(); mods.forEach(o => o.tris.forEach(t => rm.add(t)));
    const P = [], C = [], pos = pc.sopa;
    for (let t = 0; t < pos.length / 9; t++) { if (rm.has(t)) continue; for (let j = 0; j < 9; j++) P.push(pos[t * 9 + j]); C.push(pc.col[t]); }
    for (const op of mods) {
      const R = op.info, m = R.m, cc = pc.col[op.tris[0]], n0 = P.length;
      const circ = op.holes.map(h => { const p2 = [], p3 = [], seg = 28; for (let s = 0; s < seg; s++) { const a = (s / seg) * Math.PI * 2, q = [h.c2[0] + h.r * Math.cos(a), h.c2[1] + h.r * Math.sin(a)]; p2.push(q); p3.push(add(add(m.map(x => x * R.d), R.u, q[0]), R.v, q[1])); } return { p2, p3, area: area2(p2), h }; });
      const outers = nest(R.L.map(l => ({ p2: l.p2, p3: l.p3, area: l.area })));
      for (const ou of outers) { const mine = circ.filter(c => inPoly(c.h.c2, ou.p2) && !ou.holes.some(hh => inPoly(c.h.c2, hh.p2))); fillPoly(ou, ou.holes.concat(mine), m, P); }
      for (const c of circ) {
        const h = c.h, n = c.p3.length, dir = h.kind === 'pocket' ? -1 : 1, center = add(add(m.map(x => x * R.d), R.u, h.c2[0]), R.v, h.c2[1]);
        const end = c.p3.map(p => add(p, m, dir * h.h)), ce = add(center, m, dir * h.h);
        for (let s = 0; s < n; s++) {
          const a = c.p3[s], b = c.p3[(s + 1) % n], a2 = end[s], b2 = end[(s + 1) % n], radial = nrm(sub(a, center)), wdir = h.kind === 'pocket' ? radial.map(x => -x) : radial;
          pushOriented(P, a, b, b2, wdir); pushOriented(P, a, b2, a2, wdir); pushOriented(P, ce, a2, b2, m);
        }
      }
      for (let q = n0; q < P.length; q += 9) C.push(cc);
    }
    return { sopa: new Float32Array(P), col: Int16Array.from(C), cambiada: true };
  });
  let pasadores = null;
  if (pins.length) {
    const P = [];
    pins.forEach((p, i) => { const r = p.r, L = p.L, ch = Math.min(0.4, r * 0.2), x = xPasadores + (i % 6) * (J.d + 5), y = yPasadores + Math.floor(i / 6) * (J.d + 5); for (const v of lathe([[0, 0], [r - ch, 0], [r, ch], [r, L - ch], [r - ch, L], [0, L]], 28, x, y)) P.push(v); });
    pasadores = { sopa: new Float32Array(P), cantidad: pins.length, largos: pins.map(p => p.L) };
  }
  return { piezas: salida, pasadores, uniones: joins, sinEspacio: skipped };
}

// ---------------------------------------------------------------------------
// Borde de una región plana por paridad de aristas (sin depender del sentido de cada
// triángulo), para que las astillas con la normal invertida no abran grietas.
function regionInfoParidad(pos, tris, m, dPl) {
  const kp = new Map(), cnt = new Map();
  for (const t of tris) {
    const ks = [0, 1, 2].map(j => { const o = t * 9 + j * 3, k = xkey(pos, o); if (!kp.has(k)) kp.set(k, [pos[o], pos[o + 1], pos[o + 2]]); return k; });
    for (let j = 0; j < 3; j++) { const a = ks[j], b = ks[(j + 1) % 3]; if (a === b) continue; const e = a < b ? a + '|' + b : b + '|' + a; cnt.set(e, (cnt.get(e) || 0) + 1); }
  }
  const adj = new Map(), link = (a, b) => { let l = adj.get(a); if (!l) { l = []; adj.set(a, l); } l.push(b); };
  for (const [e, c] of cnt) if (c % 2) { const [a, b] = e.split('|'); link(a, b); link(b, a); }
  const loops = [], usedE = new Set(), ek = (a, b) => (a < b ? a + '|' + b : b + '|' + a); let abiertos = 0;
  for (const l of adj.values()) if (l.length % 2) abiertos++;
  for (const st of adj.keys()) for (const first of adj.get(st)) {
    if (usedE.has(ek(st, first))) continue;
    const loop = [st]; let prev = st, cur = first; usedE.add(ek(st, first)); let closed = false;
    for (let g = 0; g < 5e6; g++) {
      if (cur === st) { closed = true; break; }
      loop.push(cur);
      const nx = (adj.get(cur) || []).find(x => !usedE.has(ek(cur, x)));
      if (nx === undefined) break;
      usedE.add(ek(cur, nx)); prev = cur; cur = nx;
    }
    if (closed && loop.length >= 3) loops.push(loop); else abiertos++;
  }
  const ref = Math.abs(m[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], u = nrm(cross(m, ref)), v = cross(m, u);
  const L = loops.map(l => { const p3 = l.map(k => kp.get(k)), p2 = p3.map(p => [dot(p, u), dot(p, v)]); return { p3, p2, area: area2(p2) }; });
  return { L, u, v, m, d: dPl };
}

// Islas de la tapa: componentes conectados por vértices, cada uno con su borde por paridad.
function islasTapa(pos, tris, m, to2) {
  const id = new Map(), par = [], find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  const keys = tris.map(t => [0, 1, 2].map(j => { const k = xkey(pos, t * 9 + j * 3); if (!id.has(k)) { id.set(k, par.length); par.push(par.length); } return id.get(k); }));
  for (const [a, b, c] of keys) { const ra = find(a); par[find(b)] = ra; par[find(c)] = ra; }
  const grupos = new Map(); tris.forEach((t, i) => { const r = find(keys[i][0]); if (!grupos.has(r)) grupos.set(r, []); grupos.get(r).push(t); });
  const out = [];
  for (const g of grupos.values()) {
    const info = regionInfoParidad(pos, g, m, 0);
    const L = info.L.map(l => ({ p3: l.p3, p2: l.p3.map(to2), area: 0 })); L.forEach(l => { l.area = area2(l.p2); });
    let area = 0; for (const t of g) { const o = t * 9, c = cross([pos[o + 3] - pos[o], pos[o + 4] - pos[o + 1], pos[o + 5] - pos[o + 2]], [pos[o + 6] - pos[o], pos[o + 7] - pos[o + 1], pos[o + 8] - pos[o + 2]]); area += Math.hypot(c[0], c[1], c[2]) / 2; }
    const outers = nest(L.map(l => ({ ...l })));
    const contorno = outers.reduce((a, o) => a + Math.abs(o.area) - o.holes.reduce((b, h) => b + Math.abs(h.area), 0), 0);
    const ok = !info.abiertos && L.length > 0 && Math.abs(contorno - area) <= Math.max(0.01, area * 0.005);
    out.push({ tris: g, L, area, ok });
  }
  return out;
}

export const diagnostico = { zonas: null };
// Versión para Bisturí: dos mitades de un corte, en el mismo marco y sin separar.
// Igual que anadirEncastres (punto más alejado del borde, hembra en la pieza más
// gruesa, profundidad limitada por el grosor), pero:
//  - solo mira las caras que están sobre el plano del corte (rápido en mallas enormes);
//  - admite de 1 a 4 encastres y centros pedidos por el usuario (se ajustan al
//    punto válido más cercano si no caben donde se pidieron);
//  - no exige que el resto de la malla esté cerrada: solo cambia la tapa del corte;
//  - los pasadores sueltos salen ya colocados dentro de sus agujeros.
// piezas: [{sopa, col, colNuevo}] ; plano: {punto:[x,y,z], normal:[x,y,z]} (normal de la pieza 0 hacia fuera o hacia dentro, da igual)
export function encastresEnCorte(piezas, J, { plano, centros = null, soloUbicar = false, separacion = 0, evitar = null } = {}) {
  const WALL = J.pared, rp = (J.d + J.holgura) / 2, need = rp + WALL, minA = Math.PI * need * need, n = Math.max(1, Math.min(4, J.cantidad || 1));
  const N0 = nrm(plano.normal), d0 = dot(N0, plano.punto);
  // Tamaño para la tolerancia del plano.
  let span = 0; for (const p of piezas) for (let i = 0; i < Math.min(p.sopa.length, 3e5); i += 9) span = Math.max(span, Math.abs(p.sopa[i]), Math.abs(p.sopa[i + 1]), Math.abs(p.sopa[i + 2]));
  const tolD = Math.max(1e-3, span * 2e-6);
  // Caras de cada pieza sobre el plano, separadas por el sentido de su normal.
  const caras = piezas.map(p => {
    const pos = p.sopa, out = { 1: [], '-1': [] }, area = { 1: 0, '-1': 0 }, degen = [];
    for (let t = 0, o = 0; o < pos.length; o += 9, t++) {
      if (Math.abs(N0[0] * pos[o] + N0[1] * pos[o + 1] + N0[2] * pos[o + 2] - d0) > tolD) continue;
      if (Math.abs(N0[0] * pos[o + 3] + N0[1] * pos[o + 4] + N0[2] * pos[o + 5] - d0) > tolD) continue;
      if (Math.abs(N0[0] * pos[o + 6] + N0[1] * pos[o + 7] + N0[2] * pos[o + 8] - d0) > tolD) continue;
      const c = cross([pos[o + 3] - pos[o], pos[o + 4] - pos[o + 1], pos[o + 5] - pos[o + 2]], [pos[o + 6] - pos[o], pos[o + 7] - pos[o + 1], pos[o + 8] - pos[o + 2]]);
      const l = Math.hypot(c[0], c[1], c[2]);
      // Astillas de área casi nula sobre el plano: su normal no es fiable; van con la tapa.
      if (l < 2e-6) {
        let md = 0, me = 0; for (let k = 0; k < 3; k++) { md = Math.max(md, Math.abs(N0[0] * pos[o + 3 * k] + N0[1] * pos[o + 3 * k + 1] + N0[2] * pos[o + 3 * k + 2] - d0)); const q = o + 3 * ((k + 1) % 3); me = Math.max(me, Math.hypot(pos[q] - pos[o + 3 * k], pos[q + 1] - pos[o + 3 * k + 1], pos[q + 2] - pos[o + 3 * k + 2])); }
        if (md < tolD * 0.05 && l < 1e-3 * me * me) degen.push(t);
        continue;
      }
      const s = dot(c, N0) / l; if (Math.abs(s) < 0.999) continue;
      out[s > 0 ? 1 : -1].push(t); area[s > 0 ? 1 : -1] += l / 2;
    }
    return { tris: out, area, degen };
  });
  // La pieza i tiene su tapa mirando a +s·N0 y la j a −s·N0.
  let s = caras[0].area[1] >= caras[0].area[-1] ? 1 : -1;
  if (caras[0].area[s] < minA * 0.5 || caras[1].area[-s] < minA * 0.5) {
    if (caras[0].area[-s] >= minA * 0.5 && caras[1].area[s] >= minA * 0.5) s = -s;
    else return { piezas: piezas.map(p => ({ ...p, cambiada: false })), pasadores: [], ubicaciones: [], uniones: 0, sinEspacio: 1, motivo: 'sin-tapa' };
  }
  const tA = caras[0].tris[s].concat(caras[0].degen), tB = caras[1].tris[-s].concat(caras[1].degen);
  const mA = N0.map(x => x * s), refv = Math.abs(mA[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], uA = nrm(cross(mA, refv)), vA = cross(mA, uA);
  const RA = { m: mA, u: uA, v: vA, d: d0 * s }, to2 = p => [dot(p, uA), dot(p, vA)];
  // Cada tapa se divide en islas (componentes conectadas). Solo se usan las islas sanas:
  // borde cerrado y área de los contornos igual al área de sus triángulos. Así una grieta o
  // una cáscara superpuesta en otra zona del corte no estropea el encastre.
  const compsA = islasTapa(piezas[0].sopa, tA, mA, to2), compsB = islasTapa(piezas[1].sopa, tB, mA.map(x => -x), to2);
  if (evitar) { for (const k of evitar[0] || []) if (compsA[k]) compsA[k].ok = false; for (const k of evitar[1] || []) if (compsB[k]) compsB[k].ok = false; }
  const LA = compsA.flatMap(c => c.L), LB = compsB.flatMap(c => c.L);
  diagnostico.zonas = [compsA.filter(c => c.ok).length, compsA.length, compsB.filter(c => c.ok).length, compsB.length];
  if (!LA.length || !LB.length) return { piezas: piezas.map(p => ({ ...p, cambiada: false })), pasadores: [], ubicaciones: [], uniones: 0, sinEspacio: 1, motivo: 'sin-tapa' };
  let mn = [Infinity, Infinity], mx = [-Infinity, -Infinity];
  for (const l of LA) for (const p of l.p2) { mn = [Math.min(mn[0], p[0]), Math.min(mn[1], p[1])]; mx = [Math.max(mx[0], p[0]), Math.max(mx[1], p[1])]; }
  const step = Math.max(0.25, Math.max(mx[0] - mn[0], mx[1] - mn[1]) / 64);
  const xs = [], ys = []; for (let x = mn[0] + step / 2; x < mx[0]; x += step) xs.push(x); for (let y = mn[1] + step / 2; y < mx[1]; y += step) ys.push(y);
  const NX = xs.length, NY = ys.length, segs = [];
  for (const LL of [LA, LB]) for (const l of LL) { const q = l.p2; for (let i = 0; i < q.length; i++) segs.push([q[i], q[(i + 1) % q.length]]); }
  const dentro = (LL, g, id) => { for (let j = 0; j < NY; j++) { const y = ys[j], cr = []; for (const l of LL) { const q = l.p2; for (let i = 0, k = q.length - 1; i < q.length; k = i++) { const a = q[i], b = q[k]; if ((a[1] > y) !== (b[1] > y)) cr.push(((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]); } } if (!cr.length) continue; cr.sort((a, b) => a - b); let c = 0; for (let i = 0; i < NX; i++) { while (c < cr.length && cr[c] < xs[i]) c++; if (c % 2) { const k = j * NX + i; g[k] = g[k] === -1 ? id : -2; } } } };
  const isla = (comps, p) => { let r = -1; comps.forEach((c, k) => { if (insideL(p, c.L)) r = r === -1 ? k : -2; }); return r; };
  const CX = Math.max(1, Math.ceil((mx[0] - mn[0]) / step) + 1), CY = Math.max(1, Math.ceil((mx[1] - mn[1]) / step) + 1), buckets = new Map();
  const cell = (x, y) => Math.min(CX - 1, Math.max(0, Math.floor((x - mn[0]) / step))) + CX * Math.min(CY - 1, Math.max(0, Math.floor((y - mn[1]) / step)));
  for (const sg of segs) { const [a, b] = sg, L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(L / (step * 0.5))); for (let i = 0; i <= k; i++) { const c = cell(a[0] + (b[0] - a[0]) * i / k, a[1] + (b[1] - a[1]) * i / k); let lst = buckets.get(c); if (!lst) { lst = []; buckets.set(c, lst); } if (lst[lst.length - 1] !== sg) lst.push(sg); } }
  const marked = [...buckets.keys()].map(c => [mn[0] + ((c % CX) + 0.5) * step, mn[1] + (Math.floor(c / CX) + 0.5) * step, c]);
  const exacta = p => {
    let a = Infinity; for (const m of marked) { const d = Math.hypot(m[0] - p[0], m[1] - p[1]); if (d < a) a = d; }
    const lim = a + step * 1.5; let best = Infinity;
    for (const m of marked) { if (Math.hypot(m[0] - p[0], m[1] - p[1]) > lim) continue; for (const sg of buckets.get(m[2])) { const d = segDist(p, sg[0], sg[1]); if (d < best) best = d; } }
    return best;
  };
  const minSep = Math.max(2 * need, separacion || 0);
  const libre = (p, lista) => lista.every(c => Math.hypot(c.p[0] - p[0], c.p[1] - p[1]) >= minSep);
  let ultimo = null;
  for (let intento = 0; intento < 6; intento++) {
    const gA = new Int32Array(NX * NY).fill(-1), gB = new Int32Array(NX * NY).fill(-1);
    compsA.forEach((c, k) => dentro(c.L, gA, c.ok ? k : -3)); compsB.forEach((c, k) => dentro(c.L, gB, c.ok ? k : -3));
    const cand = []; let overlap = 0;
    for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) {
      const k = j * NX + i; if (gA[k] < 0 || gB[k] < 0) continue; overlap++;
      const p = [xs[i], ys[j]], dd = exacta(p);
      if (dd >= need) cand.push({ p, dd, ia: gA[k], ib: gB[k] });
    }
    if (overlap * step * step < minA * 0.5 || !cand.length) { if (ultimo) return ultimo; return { piezas: piezas.map(p => ({ ...p, cambiada: false })), pasadores: [], ubicaciones: [], uniones: 0, sinEspacio: 1, motivo: 'sin-espacio' }; }
    cand.sort((a, b) => b.dd - a.dd);
    let chosen = [];
    if (centros && centros.length) {
      for (const c3 of centros) {
        const p = to2(c3), ia = isla(compsA, p), ib = isla(compsB, p);
        let best = null;
        if (ia >= 0 && ib >= 0 && compsA[ia].ok && compsB[ib].ok && exacta(p) >= need && libre(p, chosen)) best = { p, dd: exacta(p), ia, ib };
        else { let bd = Infinity; for (const c of cand) { if (!libre(c.p, chosen)) continue; const dd = Math.hypot(c.p[0] - p[0], c.p[1] - p[1]); if (dd < bd) { bd = dd; best = { ...c, movido: dd }; } } }
        if (best) chosen.push(best);
      }
    } else if (n === 1) chosen = [cand[0]];
    else if (n === 2) {
      const top = cand.slice(0, 600); let best = null, bs = 0;
      for (let a = 0; a < top.length; a++) for (let b = a + 1; b < top.length; b++) { const dd = Math.hypot(top[a].p[0] - top[b].p[0], top[a].p[1] - top[b].p[1]); if (dd < minSep) continue; const sc = Math.min(top[a].dd, top[b].dd) + dd * 0.5; if (sc > bs) { bs = sc; best = [top[a], top[b]]; } }
      chosen = best || [cand[0]];
    } else {
      chosen = [cand[0]];
      const top = cand.slice(0, 3000);
      while (chosen.length < n) {
        let best = null, bs = -Infinity;
        for (const c of top) {
          let md = Infinity; for (const q of chosen) md = Math.min(md, Math.hypot(c.p[0] - q.p[0], c.p[1] - q.p[1]));
          if (md < minSep) continue;
          const sc = c.dd + md * 0.5; if (sc > bs) { bs = sc; best = c; }
        }
        if (!best) break; chosen.push(best);
      }
    }
    const holes = [[], []], ubicaciones = [], pins = [];
    let placed = 0, skipped = 0;
    for (const c of chosen) {
      const c3 = add(add(mA.map(x => x * RA.d), uA, c.p[0]), vA, c.p[1]);
      const ti = thickness(piezas[0].sopa, c3, mA.map(x => -x), rp, RA), tj = thickness(piezas[1].sopa, c3, mA, rp, RA);
      if (J.tipo === 'pasadores') {
        const hi = Math.min(J.profundidad, ti - WALL), hj = Math.min(J.profundidad, tj - WALL); if (hi < 2 || hj < 2) { skipped++; continue; }
        holes[0].push({ c2: c.p, r: rp, h: hi, kind: 'pocket', isla: c.ia }); holes[1].push({ c2: c.p, r: rp, h: hj, kind: 'pocket', isla: c.ib });
        pins.push({ c3, m: mA, u: uA, v: vA, r: J.d / 2, a: hi - 0.3, b: hj - 0.3 });
        ubicaciones.push({ centro: c3, hembra: 'ambas', profundidad: [hi, hj], movido: c.movido || 0, islas: [c.ia, c.ib] }); placed++;
      } else {
        const femA = ti >= tj, hf = Math.min(J.profundidad, (femA ? ti : tj) - WALL), hb = hf - 0.5; if (hb < 2) { skipped++; continue; }
        holes[femA ? 0 : 1].push({ c2: c.p, r: rp, h: hf, kind: 'pocket', isla: femA ? c.ia : c.ib });
        holes[femA ? 1 : 0].push({ c2: c.p, r: J.d / 2, h: hb, kind: 'boss', isla: femA ? c.ib : c.ia });
        ubicaciones.push({ centro: c3, hembra: femA ? 0 : 1, profundidad: [hf, hb], movido: c.movido || 0, islas: [c.ia, c.ib] }); placed++;
      }
    }
    if (!placed) return { piezas: piezas.map(p => ({ ...p, cambiada: false })), pasadores: [], ubicaciones: [], uniones: 0, sinEspacio: 1, motivo: 'poco-grosor' };
    if (soloUbicar) return { piezas: null, pasadores: [], ubicaciones, uniones: 1, sinEspacio: skipped, normal: mA, faltan: n - placed };
    // Construcción: solo se rehacen las islas que llevan encastre.
    let fallo = false;
    const salida = piezas.map((pc, i) => {
      const comps = i ? compsB : compsA, hs = holes[i]; if (!hs.length) return { ...pc, cambiada: false };
      const islas = [...new Set(hs.map(h => h.isla))], rm = new Uint8Array(pc.sopa.length / 9);
      for (const k of islas) for (const t of comps[k].tris) rm[t] = 1;
      const pos = pc.sopa, nT = pos.length / 9, P = [], C = [];
      const m = i ? mA.map(x => -x) : mA, dPl = i ? -RA.d : RA.d, cnew = pc.colNuevo ?? pc.col[comps[islas[0]].tris[0]];
      for (const k of islas) {
        const comp = comps[k], ccap = pc.col[comp.tris[0]], mine = hs.filter(h => h.isla === k), n0 = P.length;
        const circ = mine.map(h => { const p2 = [], p3 = [], seg = 32; for (let q = 0; q < seg; q++) { const a = (q / seg) * Math.PI * 2, w = [h.c2[0] + h.r * Math.cos(a), h.c2[1] + h.r * Math.sin(a)]; p2.push(w); p3.push(add(add(mA.map(x => x * RA.d), uA, w[0]), vA, w[1])); } return { p2, p3, h }; });
        const outers = nest(comp.L.map(l => ({ p2: l.p2, p3: l.p3, area: l.area })));
        for (const ou of outers) { const dent = circ.filter(c => inPoly(c.h.c2, ou.p2) && !ou.holes.some(hh => inPoly(c.h.c2, hh.p2))); fillPoly(ou, ou.holes.concat(dent), m, P); }
        // Comprobación: el área rellenada debe ser la de la isla menos los círculos.
        let ar = 0; for (let q = n0; q < P.length; q += 9) { const c = cross([P[q + 3] - P[q], P[q + 4] - P[q + 1], P[q + 5] - P[q + 2]], [P[q + 6] - P[q], P[q + 7] - P[q + 1], P[q + 8] - P[q + 2]]); ar += Math.hypot(c[0], c[1], c[2]) / 2; }
        const esperado = comp.area - circ.reduce((a, c) => a + Math.abs(area2(c.p2)), 0);
        if (Math.abs(ar - esperado) > Math.max(0.01, esperado * 0.005)) { comp.ok = false; fallo = true; }
        for (let q = n0; q < P.length; q += 9) C.push(ccap);
        const n1 = P.length;
        for (const c of circ) {
          const h = c.h, nn = c.p3.length, dir = h.kind === 'pocket' ? -1 : 1, center = add(add(mA.map(x => x * RA.d), uA, h.c2[0]), vA, h.c2[1]);
          const end = c.p3.map(p => add(p, m, dir * h.h)), ce = add(center, m, dir * h.h);
          for (let q = 0; q < nn; q++) {
            const a = c.p3[q], b = c.p3[(q + 1) % nn], a2 = end[q], b2 = end[(q + 1) % nn], radial = nrm(sub(a, center)), wdir = h.kind === 'pocket' ? radial.map(x => -x) : radial;
            pushOriented(P, a, b, b2, wdir); pushOriented(P, a, b2, a2, wdir); pushOriented(P, ce, a2, b2, m);
          }
        }
        for (let q = n1; q < P.length; q += 9) C.push(cnew);
      }
      let keep = 0; for (let t = 0; t < nT; t++) if (!rm[t]) keep++;
      const sopa = new Float32Array(keep * 9 + P.length), col = new Int16Array(keep + C.length);
      for (let t = 0, k = 0; t < nT; t++) { if (rm[t]) continue; sopa.set(pos.subarray(t * 9, t * 9 + 9), k * 9); col[k++] = pc.col[t]; }
      sopa.set(P, keep * 9); col.set(C, keep);
      return { sopa, col, cambiada: true };
    });
    if (fallo) { ultimo = null; continue; }
  // Pasadores sueltos colocados dentro de sus agujeros (eje = normal de la tapa).
  const pasadores = pins.map(p => {
    const out = [], ch = Math.min(0.4, p.r * 0.2), L = p.a + p.b, seg = 28;
    const prof = [[0, 0], [p.r - ch, 0], [p.r, ch], [p.r, L - ch], [p.r - ch, L], [0, L]];
    const at = (r, z, j) => { const a = (j / seg) * Math.PI * 2, x = r * Math.cos(a), y = r * Math.sin(a), w = z - p.b; return add(add(add(p.c3, p.u, x), p.v, y), p.m, -w); };
    for (let i = 0; i < prof.length - 1; i++) {
      const [r0, z0] = prof[i], [r1, z1] = prof[i + 1];
      for (let j = 0; j < seg; j++) { const a = at(r0, z0, j), b = at(r0, z0, j + 1), c = at(r1, z1, j + 1), d = at(r1, z1, j); if (r0 > 0) pushTri(out, a, c, b); if (r1 > 0) pushTri(out, a, d, c); }
    }
    return { sopa: new Float32Array(out), largo: L, d: 2 * p.r };
  });
  return { piezas: salida, pasadores, ubicaciones, uniones: 1, sinEspacio: skipped, normal: RA.m, faltan: n - placed };
  }
  return { piezas: piezas.map(p => ({ ...p, cambiada: false })), pasadores: [], ubicaciones: [], uniones: 0, sinEspacio: 1, motivo: 'tapa-defectuosa' };
}
