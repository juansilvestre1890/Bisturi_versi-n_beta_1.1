// Selección por caras: mask[f] = 1 si la cara está marcada.
import { caraDe, desde, hacia } from './nucleo-malla.js?v=2.10';

// Pincel: marca las caras conectadas a f0 cuyo centroide está dentro del radio.
// Avanzar por vecindad evita pintar la cara opuesta de una pared delgada.
export function pincel(topo, cent, mask, f0, punto, radio, valor) {
  const r2 = radio * radio, visto = new Set([f0]), pila = [f0], cambiadas = [];
  while (pila.length) {
    const f = pila.pop();
    if (mask[f] !== valor) { mask[f] = valor; cambiadas.push(f); }
    for (let k = 0; k < 3; k++) {
      const g = topo.gemela[3 * f + k];
      if (g < 0) continue;
      const F = caraDe(g);
      if (visto.has(F)) continue;
      visto.add(F);
      const dx = cent[3 * F] - punto[0], dy = cent[3 * F + 1] - punto[1], dz = cent[3 * F + 2] - punto[2];
      if (dx * dx + dy * dy + dz * dz <= r2) pila.push(F);
    }
  }
  return cambiadas;
}

// Relleno: desde f0, cubre las caras con el mismo estado sin cruzar aristas
// más vivas que anguloMax (grados). Permite trazar un contorno y rellenarlo.
export function rellenar(topo, norm, mask, f0, anguloMax, valor) {
  const estado = mask[f0], cosMin = Math.cos((anguloMax * Math.PI) / 180), pila = [f0], cambiadas = [];
  const visto = new Uint8Array(mask.length); visto[f0] = 1;
  while (pila.length) {
    const f = pila.pop();
    mask[f] = valor; cambiadas.push(f);
    for (let k = 0; k < 3; k++) {
      const g = topo.gemela[3 * f + k];
      if (g < 0) continue;
      const F = caraDe(g);
      if (visto[F] || mask[F] !== estado) continue;
      const c = norm[3 * f] * norm[3 * F] + norm[3 * f + 1] * norm[3 * F + 1] + norm[3 * f + 2] * norm[3 * F + 2];
      if (c < cosMin) continue;
      visto[F] = 1; pila.push(F);
    }
  }
  return cambiadas;
}

// Crecer / encoger un anillo de caras por aristas.
export function crecer(topo, mask, valor = 1) {
  const cambiar = [];
  for (let f = 0; f < mask.length; f++) {
    if (mask[f] === valor) continue;
    for (let k = 0; k < 3; k++) { const g = topo.gemela[3 * f + k]; if (g >= 0 && mask[caraDe(g)] === valor) { cambiar.push(f); break; } }
  }
  for (const f of cambiar) mask[f] = valor;
  return cambiar;
}
export const encoger = (topo, mask) => crecer(topo, mask, 0);

// Suaviza el borde: cierra huecos pequeños y quita salientes de una cara.
export function suavizar(topo, mask, pasos = 1) {
  const antes = mask.slice();
  for (let i = 0; i < pasos; i++) crecer(topo, mask);
  for (let i = 0; i < 2 * pasos; i++) encoger(topo, mask);
  for (let i = 0; i < pasos; i++) crecer(topo, mask);
  const cambiadas = [];
  for (let f = 0; f < mask.length; f++) if (mask[f] !== antes[f]) cambiadas.push(f);
  return cambiadas;
}

// Semiaristas del borde de la selección, orientadas como en la cara marcada.
function semiaristasBorde(m, topo, mask) {
  const borde = [];
  for (let h = 0; h < m.tri.length; h++) {
    if (!mask[caraDe(h)]) continue;
    const g = topo.gemela[h];
    if (g >= 0 && !mask[caraDe(g)]) borde.push(h);
  }
  return borde;
}

// Quita dientes y muescas de una sola cara (opcional, desde la interfaz).
export function limpiarDientes(topo, mask, cambiadas) {
  let hubo = false;
  for (let paso = 0; paso < 20; paso++) {
    const cambiar = [];
    for (let f = 0; f < mask.length; f++) {
      let distintos = 0;
      for (let k = 0; k < 3; k++) { const g = topo.gemela[3 * f + k]; if (g >= 0 && mask[caraDe(g)] !== mask[f]) distintos++; }
      if (distintos >= 2) cambiar.push(f);
    }
    if (!cambiar.length) break;
    for (const f of cambiar) { mask[f] ^= 1; cambiadas.push(f); }
    hubo = true;
  }
  return hubo;
}

// Un vértice donde la selección solo se toca en punta (forma de pajarita)
// haría un contorno ambiguo. Se resuelve marcando las caras de ese vértice.
export function regularizar(m, topo, mask) {
  const cambiadas = [];
  for (let vuelta = 0; vuelta < 10; vuelta++) {
    if (!quitarPajaritas(m, topo, mask, cambiadas)) break;
  }
  return [...new Set(cambiadas)];
}

function quitarPajaritas(m, topo, mask, cambiadas) {
  const nv = m.pos.length / 3, nf = mask.length;
  const inicio = new Uint32Array(nv + 1);
  for (const v of m.tri) inicio[v + 1]++;
  for (let i = 0; i < nv; i++) inicio[i + 1] += inicio[i];
  const caras = new Uint32Array(m.tri.length), lleno = inicio.slice(0, nv);
  for (let f = 0; f < nf; f++) for (let k = 0; k < 3; k++) caras[lleno[m.tri[3 * f + k]]++] = f;
  let hubo = false;
  for (let paso = 0; paso < 50; paso++) {
    const salen = new Uint8Array(nv), problema = new Set();
    for (const h of semiaristasBorde(m, topo, mask)) { const a = desde(m, h); if (++salen[a] > 1) problema.add(a); }
    if (!problema.size) return hubo;
    for (const v of problema) for (let i = inicio[v]; i < inicio[v + 1]; i++) if (!mask[caras[i]]) { mask[caras[i]] = 1; cambiadas.push(caras[i]); hubo = true; }
  }
  throw new Error('No se pudo limpiar el borde de la selección.');
}

// Bucles cerrados del borde. Cada bucle es una lista de vértices en el orden
// de las caras marcadas, con la información de las caras a cada lado.
export function contornos(m, topo, mask) {
  const siguiente = new Map();
  for (const h of semiaristasBorde(m, topo, mask)) {
    const a = desde(m, h);
    if (siguiente.has(a)) throw new Error('Contorno ambiguo: la selección se toca en un vértice.');
    siguiente.set(a, h);
  }
  const visto = new Set(), bucles = [];
  for (const inicio of siguiente.keys()) {
    if (visto.has(inicio)) continue;
    const verts = [], aristas = [];
    let v = inicio;
    do {
      if (visto.has(v)) throw new Error('Contorno que se cruza consigo mismo.');
      visto.add(v);
      const h = siguiente.get(v);
      if (h === undefined) throw new Error('Contorno abierto: revisa que el modelo esté cerrado.');
      verts.push(v); aristas.push(h);
      v = hacia(m, h);
    } while (v !== inicio);
    bucles.push({ verts, aristas });
  }
  return bucles;
}

// Bucles de borde abierto (agujeros del modelo), con la misma convención.
export function agujeros(m, topo) {
  const siguiente = new Map();
  for (let h = 0; h < m.tri.length; h++) {
    if (topo.gemela[h] !== -1) continue;
    const a = desde(m, h);
    if (siguiente.has(a)) throw new Error('Un agujero se toca consigo mismo en un vértice; no se puede cerrar automáticamente.');
    siguiente.set(a, h);
  }
  const visto = new Set(), bucles = [];
  for (const inicio of siguiente.keys()) {
    if (visto.has(inicio)) continue;
    const verts = [], aristas = [];
    let v = inicio;
    do {
      visto.add(v);
      const h = siguiente.get(v);
      if (h === undefined) throw new Error('Borde abierto que no forma un bucle.');
      verts.push(v); aristas.push(h); v = hacia(m, h);
    } while (v !== inicio && verts.length <= siguiente.size);
    if (v !== inicio) throw new Error('Borde abierto que no forma un bucle.');
    bucles.push({ verts, aristas });
  }
  return bucles;
}
