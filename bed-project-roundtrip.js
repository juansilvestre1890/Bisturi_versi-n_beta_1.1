// Etapa 34: reconstrucción estricta y no destructiva de camas guardadas.
// Solo devuelve copias. No muta la escena ni el documento fuente.
export function recoverBedLayout(beds, meshIds, activeBed) {
  if (!Array.isArray(beds) || !beds.length || !(meshIds instanceof Set))
    throw Error('No se puede recuperar la distribución de las camas.');
  const assigned = new Set();
  const result = beds.map(b => {
    if (!Number.isSafeInteger(b.id) || b.id <= 0 || !Array.isArray(b.items) || !b.placements)
      throw Error('Datos incompletos de cama.');
    const placements = {};
    const items = [];
    for (const id of b.items) {
      if (typeof id !== 'string' || !meshIds.has(id) || assigned.has(id))
        throw Error('Una cama contiene piezas inexistentes o duplicadas.');
      const p = b.placements[id];
      if (!p || ![p.x,p.y,p.rot].every(v => typeof v === 'number' && Number.isFinite(v)))
        throw Error('La posición u orientación de una pieza no es válida.');
      assigned.add(id); items.push(id);
      placements[id] = {x:p.x,y:p.y,rot:p.rot};
    }
    if (Object.keys(b.placements).length !== items.length ||
        Object.keys(b.placements).some(id=>!items.includes(id)))
      throw Error('Se encontraron posiciones sin una pieza asignada.');
    if (![b.x,b.y,b.z].every(v => typeof v==='number' && Number.isFinite(v) && v>0))
      throw Error('Las dimensiones de una cama no son válidas.');
    return {id:b.id,name:b.name,x:b.x,y:b.y,z:b.z,items,placements};
  });
  if (new Set(result.map(b=>b.id)).size!==result.length)
    throw Error('Hay camas con identificadores repetidos.');
  if (!result.some(b=>b.id===activeBed))
    throw Error('La cama activa no existe.');
  return {beds:result,activeBed,nextBedId:Math.max(...result.map(b=>b.id))+1};
}

export function assertBedLayoutRoundTrip(original, restored) {
  if (!original || !restored || original.activeBed!==restored.activeBed ||
      JSON.stringify(original.beds)!==JSON.stringify(restored.beds))
    throw Error('La recuperación alteró las camas o las posiciones guardadas.');
  return {ok:true,beds:restored.beds.length,pieces:restored.beds.reduce((n,b)=>n+b.items.length,0)};
}
