import {evaluate} from './curved-cut.js';
// Select one score offset using triangles excluded from the original fit's holdout (f%5===0).
// Report the untouched holdout separately; it is never used to choose the offset.
export function chooseSelectionOffset(input,mask,surface,offsets=[0,-.1,-.05,-.025,-.01,.05,.1]){
 const p=input.positions,index=input.index,n=mask.length,stats=offsets.map(()=>({intersection:0,union:0})),holdout=offsets.map(()=>({intersection:0,union:0}));
 for(let f=0;f<n;f++){
  const a=3*(index?index[3*f]:3*f),b=3*(index?index[3*f+1]:3*f+1),c=3*(index?index[3*f+2]:3*f+2);
  const x=(p[a]+p[b]+p[c])/3,y=(p[a+1]+p[b+1]+p[c+1])/3,z=(p[a+2]+p[b+2]+p[c+2])/3;
  const ux=p[b]-p[a],uy=p[b+1]-p[a+1],uz=p[b+2]-p[a+2],vx=p[c]-p[a],vy=p[c+1]-p[a+1],vz=p[c+2]-p[a+2];
  const area=Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)/2,score=evaluate(surface.coefficients,x,y,z),truth=!!mask[f],target=f%5===0?holdout:stats;
  for(let i=0;i<offsets.length;i++){const pred=score>offsets[i];if(pred&&truth)target[i].intersection+=area;if(pred||truth)target[i].union+=area;}
 }
 const iou=s=>s.union?s.intersection/s.union:0;let best=0;
 for(let i=1;i<offsets.length;i++)if(iou(stats[i])>iou(stats[best])+1e-6)best=i;
 return {offset:offsets[best],baselineTrainingAreaIou:iou(stats[0]),candidateTrainingAreaIou:iou(stats[best]),baselineHeldOutAreaIou:iou(holdout[0]),candidateHeldOutAreaIou:iou(holdout[best]),trainingTriangles:n-Math.ceil(n/5),holdoutTriangles:Math.ceil(n/5)};
}
