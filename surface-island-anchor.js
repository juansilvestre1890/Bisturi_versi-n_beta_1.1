// Elige exclusivamente la región que contiene el triángulo señalado.
// Recibe las islas ya validadas por selectedSurfaceIslands y no altera las caras originales.
export function islandContainingFace(islands, face) {
  if (!Number.isInteger(face) || face < 0) throw new Error('Triángulo señalado inválido.');
  if (!Array.isArray(islands)) throw new Error('Lista de regiones inválida.');
  let found = null;
  const seen = new Set();
  for (const island of islands) {
    if (!Array.isArray(island) || !island.length) throw new Error('Región vacía o inválida.');
    for (const f of island) {
      if (!Number.isInteger(f) || f < 0 || seen.has(f)) throw new Error('Triángulos inválidos o duplicados entre regiones.');
      seen.add(f);
      if (f === face) found = island;
    }
  }
  return found ? [...found] : null;
}
