// Verifica que la exportación preserve la distancia proyectada entre piezas.
// Acepta siluetas convexas en mm; null indica medición no disponible.
import {convexFootprintsDistance} from './bed-footprint.js';
export function inspectBedExportClearance(before,after,{tolerance=0.05}={}){
  if(!Array.isArray(before)||!Array.isArray(after)||before.length!==after.length||!Number.isFinite(tolerance)||tolerance<0)
    throw Error('Comparación de camas inválida.');
  const a=new Map(),b=new Map();
  for(const [input,map] of [[before,a],[after,b]])for(const piece of input){
    if(!piece||typeof piece.id!=='string'||!piece.id||map.has(piece.id))throw Error('Pieza ausente o duplicada en la cama.');
    map.set(piece.id,piece.footprint);
  }
  if(a.size!==b.size||[...a.keys()].some(id=>!b.has(id)))throw Error('La exportación no conserva las piezas asignadas.');
  let compared=0,unverified=0;
  const ids=[...a.keys()];
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
    const initial=convexFootprintsDistance(a.get(ids[i]),a.get(ids[j]));
    const output=convexFootprintsDistance(b.get(ids[i]),b.get(ids[j]));
    if(initial===null||output===null){unverified++;continue;}
    if(Math.abs(initial-output)>tolerance)throw Error(`La distancia entre ${ids[i]} y ${ids[j]} cambió al exportar (${initial.toFixed(2)} → ${output.toFixed(2)} mm).`);
    compared++;
  }
  return {compared,unverified};
}
export function projectedSTLFootprint(data,{maxVertices=150000}={}){
  const buffer=data instanceof ArrayBuffer?data:ArrayBuffer.isView(data)?data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength):null;
  if(!buffer||buffer.byteLength<84)throw Error('STL de cama inválido.');
  const view=new DataView(buffer),count=view.getUint32(80,true);
  if(!count||84+count*50!==buffer.byteLength)throw Error('STL de cama incompleto.');
  if(count*3>maxVertices)return null;
  const pts=[];
  for(let i=0;i<count;i++)for(let k=0;k<3;k++){
    const start=84+i*50+12+k*12,x=view.getFloat32(start,true),y=view.getFloat32(start+8,true);
    if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('STL contiene coordenadas inválidas.');
    pts.push({x,y});
  }
  return convexHull(pts);
}
import {convexHull} from './bed-footprint.js';
