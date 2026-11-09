/** Pure result classification for an export preflight after project restoration. */
export function summarizeRecoveredExport(records){
  if(!Array.isArray(records))throw Error('El diagnóstico de exportación debe ser una lista.');
  const seen=new Set(),out={ready:0,warnings:0,skipped:0,total:records.length,details:[]};
  for(const r of records){
    if(!r||typeof r.id!=='string'||!r.id||seen.has(r.id))throw Error('Diagnóstico con pieza duplicada o identificador inválido.');
    seen.add(r.id);
    if(!['ready','warning','skipped'].includes(r.state))throw Error('Estado de diagnóstico desconocido.');
    if(r.state==='ready')out.ready++;
    else if(r.state==='warning')out.warnings++;
    else out.skipped++;
    out.details.push({id:r.id,name:String(r.name||r.id).slice(0,100),state:r.state,reason:String(r.reason||'').slice(0,200)});
  }
  return out;
}
