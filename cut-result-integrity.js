/**
 * Verificación posterior conservadora de un corte plano.
 * Comprueba la posición de todos los vértices en el semiespacio esperado,
 * el contacto de ambas tapas con el plano y los extremos proyectados.
 * No sustituye el análisis topológico ni el control de volumen.
 */
export function assertCutHalfspaces(source,positive,negative,{
  offset, project, relativeTolerance=1e-5, absoluteTolerance=1e-4
}={}){
  if(!Number.isFinite(offset)||typeof project!=='function') throw Error('Plano de corte inválido para verificación.');
  const values=(geometry,label)=>{
    const pos=geometry?.getAttribute?.('position');
    if(!pos||pos.itemSize<3||pos.count<3)throw Error(`${label}: vértices inválidos.`);
    let min=Infinity,max=-Infinity,near=Infinity;
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
      if(![x,y,z].every(Number.isFinite))throw Error(`${label}: coordenadas inválidas.`);
      const v=project(x,y,z);
      if(!Number.isFinite(v))throw Error(`${label}: proyección inválida.`);
      min=Math.min(min,v);max=Math.max(max,v);near=Math.min(near,Math.abs(v-offset));
    }
    return {min,max,near};
  };
  const orig=values(source,'Original');
  const upper=values(positive,'Mitad positiva');
  const lower=values(negative,'Mitad negativa');
  const span=orig.max-orig.min;
  if(!(span>0)||offset<=orig.min||offset>=orig.max)throw Error('El plano no atraviesa el interior de la figura.');
  const tolerance=Math.max(absoluteTolerance,span*relativeTolerance);
  if(upper.min<offset-tolerance)throw Error('Mitad positiva: tiene material al otro lado del plano.');
  if(lower.max>offset+tolerance)throw Error('Mitad negativa: tiene material al otro lado del plano.');
  if(upper.near>tolerance||lower.near>tolerance)throw Error('Una de las mitades no toca el plano de corte.');
  if(Math.abs(upper.max-orig.max)>tolerance||Math.abs(lower.min-orig.min)>tolerance)
    throw Error('El corte no conserva los extremos de la figura.');
  return {ok:true,tolerance,original:orig,positive:upper,negative:lower};
}
