// Puente entre las mallas de Three.js (positions + index) y el núcleo exacto de la v2f.
// Corte exacto por el borde marcado: el exterior no se toca y el borde de cada pieza
// coincide con las aristas reales de la selección. Devuelve el mismo formato que
// selection-cut.js para que la vista previa y la confirmación del corte curvo lo usen.
import { soldar, orientar, analizar } from './nucleo-malla.js?v=2.10';
import { cortarPorSeleccion } from './nucleo-corte.js?v=2.10';

function sopaDe(positions, index) {
  const n = index ? index.length / 3 : positions.length / 9, s = new Float32Array(n * 9);
  if (!index) { s.set(positions.subarray(0, n * 9)); return s; }
  for (let i = 0; i < index.length; i++) { const v = index[i]; s[3 * i] = positions[3 * v]; s[3 * i + 1] = positions[3 * v + 1]; s[3 * i + 2] = positions[3 * v + 2]; }
  return s;
}

// Une varias mallas que comparten el mismo arreglo de posiciones y compacta los vértices.
function compactar(pos, listas) {
  const mapa = new Int32Array(pos.length / 3).fill(-1), p = [], t = [];
  for (const tri of listas) for (const v of tri) {
    if (mapa[v] < 0) { mapa[v] = p.length / 3; p.push(pos[3 * v], pos[3 * v + 1], pos[3 * v + 2]); }
    t.push(mapa[v]);
  }
  return { positions: Float32Array.from(p), index: Uint32Array.from(t) };
}

function area(pos, tri, f) {
  const a = 3 * tri[3 * f], b = 3 * tri[3 * f + 1], c = 3 * tri[3 * f + 2];
  const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
  const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
  return Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
}

export function corteExacto({ positions, index }, maskOriginal, progress = () => {}, { autocorregir = true } = {}) {
  progress('Uniendo vértices duplicados…');
  const { malla: soldada, origen, degenerados } = soldar(sopaDe(positions, index));
  const { malla, volteadas } = orientar(soldada);
  const nf = malla.tri.length / 3, mask = new Uint8Array(nf);
  for (let f = 0; f < nf; f++) mask[f] = maskOriginal[origen[f]] ? 1 : 0;
  const r = cortarPorSeleccion(malla, mask, { progreso: progress, autocorregir });

  // Diferencias entre lo marcado y lo que se cortó (limpieza automática y puntas del borde).
  const extra = [], faltan = [];
  let selArea = 0, extraArea = 0, faltaArea = 0;
  for (let f = 0; f < nf; f++) {
    const a = area(malla.pos, malla.tri, f);
    if (mask[f]) selArea += a;
    if (r.mascara[f] && !mask[f]) { extra.push(origen[f]); extraArea += a; }
    if (!r.mascara[f] && mask[f]) { faltan.push(origen[f]); faltaArea += a; }
  }
  const comparison = {
    missing: Uint32Array.from(faltan), extra: Uint32Array.from(extra),
    metrics: { evaluated: nf, selected: mask.reduce((s, x) => s + x, 0), predicted: r.mascara.reduce((s, x) => s + x, 0), missing: faltan.length, extra: extra.length,
      iou: 1, areaIou: (selArea - faltaArea) / (selArea + extraArea || 1), selectedCoverage: (selArea - faltaArea) / (selArea || 1), predictedPrecision: selArea / (selArea + extraArea || 1), method: 'exact-edge-boundary', areaSpace: 'local' }
  };

  progress('Preparando las piezas…');
  const parts = [], partReports = [];
  for (const lado of ['seleccion', 'resto']) {
    const propias = r.piezas.filter(p => p.lado === lado);
    const g = {};
    const unidas = { p: [], t: [] };
    for (const pieza of propias) { const base = unidas.p.length / 3; unidas.p.push(...pieza.malla.pos); for (const v of pieza.malla.tri) unidas.t.push(base + v); }
    g.positions = Float32Array.from(unidas.p); g.index = Uint32Array.from(unidas.t);
    const info = analizar({ pos: g.positions, tri: g.index });
    parts.push(g);
    partReports.push({ triangles: g.index.length / 3, components: propias.length, closed: info.cerrada, volume: propias.reduce((s, p) => s + p.volumen, 0) });
  }
  const cap = compactar(r.tapa.pos, [r.tapa.tri]);
  return {
    parts, cap, surface: null, comparison,
    report: {
      method: 'exacto-v2f', parts: partReports, unchangedExteriorAreaRatio: 1, relativeVolumeError: r.informe.errorVolumen,
      loops: r.informe.bucles, capMethods: r.informe.metodos, adjustedFaces: r.informe.carasAjustadas, capTriangles: r.informe.triangulosTapa,
      cleanup: r.informe.limpieza, smoothing: r.informe.suavizado, weldedDegenerate: degenerados, flippedFaces: volteadas, selectionFit: comparison.metrics
    }
  };
}
