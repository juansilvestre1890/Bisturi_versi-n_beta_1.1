// Pure placement rules for the multi-bed workspace. No Three.js dependency.
const finite = n => typeof n === 'number' && Number.isFinite(n);
export function validateUniqueBedAssignments(beds){
  if(!Array.isArray(beds)||!beds.length)throw Error('No hay camas válidas.');
  const assigned=new Set();
  for(const bed of beds){
    if(!Array.isArray(bed.items)||!bed.placements||typeof bed.placements!=='object')throw Error('Cama incompleta.');
    const local=new Set();
    for(const id of bed.items){
      if(local.has(id)||assigned.has(id))throw Error('Pieza duplicada entre camas: '+id);
      local.add(id);assigned.add(id);
      const p=bed.placements[id];
      if(!p||![p.x,p.y,p.rot].every(finite))throw Error('Posición inválida en la cama.');
    }
    for(const id of Object.keys(bed.placements))if(!local.has(id))throw Error('Posición huérfana: '+id);
  }
  return true;
}
export function restoreDragPlacement(beds,drag){
  const b=beds.find(v=>v.id===drag.bedId);
  if(!b||!b.items.includes(drag.id)||!drag.initial)return false;
  b.placements[drag.id]={...drag.initial};return true;
}
// Validación de la caja envolvente del objeto completo después de girarlo.
// La caja ya debe encontrarse en coordenadas de cama, en milímetros.
export function validateFullBedBounds(bed,bounds,epsilon=0.01){
  if(!bed||!bounds||![bed.x,bed.y,bed.z].every(finite)||![bounds.minX,bounds.minY,bounds.minZ,bounds.maxX,bounds.maxY,bounds.maxZ].every(finite))return {ok:false,reason:'dimensiones inválidas'};
  if(bed.x<=0||bed.y<=0||bed.z<=0||bounds.maxX<=bounds.minX||bounds.maxY<=bounds.minY||bounds.maxZ<=bounds.minZ)return {ok:false,reason:'volumen inválido'};
  if(bounds.minX < -epsilon||bounds.minY < -epsilon||bounds.minZ < -epsilon||bounds.maxX > bed.x+epsilon||bounds.maxY > bed.y+epsilon||bounds.maxZ > bed.z+epsilon)return {ok:false,reason:'la pieza completa excede los límites de la cama'};
  return {ok:true};
}
export function transferBetweenBeds(beds,id,sourceId,targetId,position,checkBounds=null){
  const source=beds.find(b=>b.id===sourceId),target=beds.find(b=>b.id===targetId);
  if(!source||!target||!source.items.includes(id)||!source.placements[id])return {ok:false,reason:'pieza o cama de origen inexistente'};
  if(!position||![position.x,position.y].every(finite))return {ok:false,reason:'coordenadas inválidas'};
  if(position.x<0||position.y<0||position.x>target.x||position.y>target.y)return {ok:false,reason:'fuera de la cama de destino'};
  if(beds.some(b=>b!==source&&b.items.includes(id)))return {ok:false,reason:'pieza duplicada en otra cama'};
  const candidate={...source.placements[id],x:position.x,y:position.y};
  if(checkBounds){const result=checkBounds(target,candidate);if(!result?.ok)return {ok:false,reason:result?.reason||'fuera de los límites de impresión'};}
  if(source===target){source.placements[id]={...source.placements[id],x:position.x,y:position.y};return {ok:true,moved:false};}
  const original=source.placements[id];
  source.items=source.items.filter(x=>x!==id);delete source.placements[id];
  target.items.push(id);target.placements[id]={x:position.x,y:position.y,rot:original.rot};
  return {ok:true,moved:true};
}
