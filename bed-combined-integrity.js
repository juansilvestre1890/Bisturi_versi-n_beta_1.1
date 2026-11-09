// Etapa 33 — confirma que un STL de cama conjunta conserva todas sus piezas.
// Compara geometría por momentos (sin WebGL); no certifica colisiones ni imprimibilidad.
import {inspectSTLVertexMoments} from './export-geometry-integrity.js';

export function assertCombinedBedSTLIntegrity(parts,combined,{tolerance=0.05}={}){
  if(!Array.isArray(parts)||parts.length===0||!Number.isFinite(tolerance)||tolerance<=0)
    throw Error('Lista de piezas o tolerancia de cama inválida.');
  const seen=new Set(),data=[];
  for(const part of parts){
    if(!part||typeof part.id!=='string'||!part.id||seen.has(part.id))
      throw Error('Piezas duplicadas o sin identificador en la cama.');
    seen.add(part.id);
    data.push(inspectSTLVertexMoments(part.stl));
  }
  const actual=inspectSTLVertexMoments(combined);
  const total=data.reduce((s,x)=>s+x.triangles,0);
  if(actual.triangles!==total)throw Error('El STL conjunto perdió o duplicó triángulos de alguna pieza.');
  const expected={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity],mean:[0,0,0],meanSq:[0,0,0]};
  for(const m of data){
    for(let a=0;a<3;a++){
      expected.min[a]=Math.min(expected.min[a],m.min[a]);
      expected.max[a]=Math.max(expected.max[a],m.max[a]);
      expected.mean[a]+=m.mean[a]*m.triangles/total;
      expected.meanSq[a]+=m.meanSq[a]*m.triangles/total;
    }
  }
  for(const field of ['min','max','mean','meanSq'])for(let axis=0;axis<3;axis++){
    const target=expected[field][axis],found=actual[field][axis];
    const allowance=field==='meanSq'?tolerance*Math.max(1,Math.abs(target),Math.abs(found))*0.02:tolerance;
    if(Math.abs(target-found)>allowance)
      throw Error(`El STL conjunto altera las posiciones o dimensiones de las piezas (${field}).`);
  }
  return {ok:true,pieces:parts.length,triangles:total,bounds:{min:actual.min,max:actual.max}};
}
