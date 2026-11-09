import {evaluate} from './curved-cut.js';
// Todas las caras, no solo la muestra usada para entrenar/evaluar el ajuste.
// Clasificación por centroide: la franja que atraviesa la curva se aproxima.
export function auditSelectionFit(positions,index,mask,surface){
  const count=(index?index.length:positions.length/3)/3;
  if(!mask||mask.length!==count)throw Error('Selección incompatible con la malla.');
  let intersection=0,union=0,selected=0,predicted=0,intersectionArea=0,unionArea=0,selectedArea=0,predictedArea=0;
  const missing=[],extra=[],q=surface.coefficients;
  for(let f=0;f<count;f++){
    const a=3*(index?index[3*f]:3*f),b=3*(index?index[3*f+1]:3*f+1),c=3*(index?index[3*f+2]:3*f+2);
    const x=(positions[a]+positions[b]+positions[c])/3,y=(positions[a+1]+positions[b+1]+positions[c+1])/3,z=(positions[a+2]+positions[b+2]+positions[c+2])/3;
    const u=[positions[b]-positions[a],positions[b+1]-positions[a+1],positions[b+2]-positions[a+2]],v=[positions[c]-positions[a],positions[c+1]-positions[a+1],positions[c+2]-positions[a+2]];
    const area=.5*Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]),truth=!!mask[f],pred=evaluate(q,x,y,z)>0;
    if(truth){selected++;selectedArea+=area;}if(pred){predicted++;predictedArea+=area;}
    if(truth&&pred){intersection++;intersectionArea+=area;}if(truth||pred){union++;unionArea+=area;}
    if(truth&&!pred)missing.push(f);if(pred&&!truth)extra.push(f);
  }
  return {missing:new Uint32Array(missing),extra:new Uint32Array(extra),metrics:{evaluated:count,selected,predicted,missing:missing.length,extra:extra.length,iou:union?intersection/union:0,areaIou:unionArea?intersectionArea/unionArea:0,selectedCoverage:selectedArea?intersectionArea/selectedArea:0,predictedPrecision:predictedArea?intersectionArea/predictedArea:0,method:'centroid-all-faces-area-weighted',areaSpace:'local'}};
}
