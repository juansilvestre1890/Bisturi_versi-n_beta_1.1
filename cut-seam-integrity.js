/** Compara la superficie del plano creada en ambas mitades de un corte.
 * Comprobación conservadora: rechaza superficies ausentes o discrepantes.
 * No sustituye pruebas de estanqueidad, volumen o autointersecciones.
 */
export function assertMatchingCutSeams(upper,lower,{offset,project,tolerance=1e-4}={}){
  if(!Number.isFinite(offset)||typeof project!=='function'||!Number.isFinite(tolerance)||tolerance<=0)
    throw Error('Parámetros inválidos para comparar las superficies del corte.');
  const capFaces=(geometry,label)=>{
    const pos=geometry?.getAttribute?.('position'), idx=geometry?.getIndex?.();
    if(!pos||pos.itemSize<3)throw Error(`${label}: geometría sin posiciones.`);
    const corners=idx?idx.count:pos.count;
    if(corners%3)throw Error(`${label}: triángulos incompletos.`);
    const caps=new Map();
    for(let i=0;i<corners;i+=3){
      const points=[];
      for(let j=0;j<3;j++){
        const at=idx?idx.getX(i+j):i+j;
        const p=[pos.getX(at),pos.getY(at),pos.getZ(at)];
        if(!p.every(Number.isFinite))throw Error(`${label}: vértice no finito.`);
        points.push(p);
      }
      if(!points.every(p=>Math.abs(project(...p)-offset)<=tolerance))continue;
      const keys=points.map(p=>p.map(v=>Math.round(v/(tolerance*1e-2))).join(',')).sort();
      if(new Set(keys).size!==3)throw Error(`${label}: triángulo degenerado sobre el corte.`);
      const key=keys.join('|'); caps.set(key,(caps.get(key)||0)+1);
    }
    if(!caps.size)throw Error(`${label}: falta superficie sobre el plano de corte.`);
    return caps;
  };
  const a=capFaces(upper,'Mitad positiva'),b=capFaces(lower,'Mitad negativa');
  const total=map=>[...map.values()].reduce((sum,count)=>sum+count,0);
  if(a.size!==b.size||total(a)!==total(b)||[...a].some(([key,count])=>b.get(key)!==count))
    throw Error('Las superficies de unión de las dos mitades no coinciden; se conserva el modelo original.');
  return {ok:true,capTriangles:total(a),distinctTriangles:a.size,tolerance};
}
