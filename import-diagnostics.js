/** Clasifica resultados topológicos sin bloquear la importación. */
export function classifyImportedMesh(result){
  if(!result || result.level==='unknown' || result.ok===undefined){
    return {status:'unknown',description:'Diagnóstico no concluyente; revisa esta pieza antes de cortarla.',repairCandidate:false};
  }
  if(result.ok)return {status:'ok',description:'Sin defectos topológicos detectados; no garantiza imprimibilidad.',repairCandidate:false};
  const bad=Number(result.invalid||0)+Number(result.degenerate||0)+Number(result.nonManifold||0)+Number(result.winding||0);
  const open=Number(result.boundary||0);
  const candidates=bad===0 && open>0;
  let description=`Bordes abiertos: ${open}; aristas no manifold: ${result.nonManifold||0}; orientación: ${result.winding||0}; degenerados: ${result.degenerate||0}; inválidos: ${result.invalid||0}.`;
  description+=candidates?' Puede intentarse una reparación limitada, previa revisión.':' Se requiere inspección; no se recomienda cortar esta malla.';
  return {status:'problem',description,repairCandidate:candidates};
}
