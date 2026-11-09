/** Resumen y diagnóstico topológico en un único archivo de texto. */
export function buildGeneralReport({name,date,bed,nozzle,entries}){
  const clean=value=>String(value??'').replace(/[\r\n]+/g,' ').trim();
  const state=r=>r?.level==='unknown'?'Análisis no concluyente':r?.ok?'Sin defectos topológicos detectados':'Revisar';
  const count=entries.reduce((sum,{result:r})=>sum+(r?.ok?0:1),0);
  const lines=[
    'BISTURÍ 3D — INFORME GENERAL Y DIAGNÓSTICO PRELIMINAR',
    'Trabajo: '+clean(name),
    'Fecha: '+clean(date),
    'Objetos de malla: '+entries.length,
    'Boquilla seleccionada: '+clean(nozzle)+' mm (dato informativo; no calcula espesor)',
    'Cama activa: '+clean(bed?.name||'No asignada')+(bed?` (${bed.x} × ${bed.y} × ${bed.z} mm)`:''),
    'Mallas que requieren revisión o no pudieron analizarse: '+count,
    '',
    'DIAGNÓSTICO POR MALLA',
  ];
  entries.forEach(({mesh,result:r},i)=>{
    lines.push(`${i+1}. ${clean(mesh)} — ${state(r)}`);
    lines.push(`   Triángulos: ${r?.triangles??'no analizado'}; bordes abiertos: ${r?.boundary??'no analizado'}; aristas no manifold: ${r?.nonManifold??'no analizado'}; orientación inconsistente: ${r?.winding??'no analizado'}; degenerados: ${r?.degenerate??'no analizado'}; inválidos: ${r?.invalid??'no analizado'}.`);
    if(r?.level==='unknown'||r?.level==='error')lines.push('   Motivo: '+clean(r.reason||'No se pudo completar la comprobación.'));
  });
  lines.push('',
    'ALCANCE: esta revisión topológica no detecta todas las autointersecciones, paredes delgadas ni problemas de ajuste de encastres. No garantiza que los STL sean imprimibles; revisa las piezas en tu laminador.');
  return lines.join('\n')+'\n';
}
