import {cutSelection} from './selection-cut.js';
import {cutCurved,fitSurface,manualSurface,boundsOf,validateSurface} from './curved-cut.js';
import {auditSelectionFit} from './selection-fit-audit.js';
import {corteExacto} from './nucleo-puente.js';
self.onmessage=({data})=>{
 let surface=data.surface,comparison=null;
 try {
  const progress=text=>self.postMessage({type:'progress',text});
  if(data.mode==='manual')surface=manualSurface(boundsOf(data.positions),data.axis??2,data.fraction,data.curvature);
  if(data.mode==='selection'){
   progress('Ajustando la curva a la selección…');surface=fitSurface(data.positions,data.index,data.mask);if(Number.isInteger(data.axis))surface.axis=data.axis;
   progress('Comparando el ajuste con todas las caras seleccionadas…');comparison=auditSelectionFit(data.positions,data.index,data.mask,surface);
   if(surface.fit.iou<.65||comparison.metrics.areaIou<.65)throw Error(`La curva no representa suficientemente la selección (${(comparison.metrics.areaIou*100).toFixed(1)} % de coincidencia por área). Corrige lo marcado o cambia de método.`);
  }
  if(data.mode==='exact'){
   const result=corteExacto({positions:data.positions,index:data.index},data.mask,progress);
   const transfers=result.parts.flatMap(p=>[p.positions.buffer,p.index.buffer]);transfers.push(result.cap.positions.buffer,result.cap.index.buffer,result.comparison.missing.buffer,result.comparison.extra.buffer);
   self.postMessage({type:'result',result},transfers);return;
  }
  validateSurface(surface);
  const result=data.mode==='selection'?cutSelection({positions:data.positions,index:data.index},data.mask,surface,progress):cutCurved({positions:data.positions,index:data.index},surface,progress);
  if(result.comparison){comparison=result.comparison;surface=result.surface;}else if(comparison){result.comparison=comparison;result.report.selectionFit=comparison.metrics;}
  const transfers=result.parts.flatMap(p=>[p.positions.buffer,p.index.buffer]);transfers.push(result.cap.positions.buffer,result.cap.index.buffer);
  if(comparison)transfers.push(comparison.missing.buffer,comparison.extra.buffer);
  self.postMessage({type:'result',result},transfers);
 }catch(e){self.postMessage({type:'error',message:e.message||String(e),surface,comparison},comparison?[comparison.missing.buffer,comparison.extra.buffer]:[]);}
};
