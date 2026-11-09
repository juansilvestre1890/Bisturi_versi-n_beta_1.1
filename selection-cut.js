import {chooseSelectionOffset} from './selection-threshold.js';
import {cutCurved} from './curved-cut.js';
import {auditSelectionFit} from './selection-fit-audit.js';
// Offsets operate on the dimensionless score produced by fitSurface, not mm.
// Candidate scoring uses all faces, so it is not independent validation.
export function cutSelection(input,mask,baseline,progress=()=>{},cut=cutCurved){
 const baseComparison=auditSelectionFit(input.positions,input.index,mask,baseline);
 const choice=chooseSelectionOffset(input,mask,baseline);
 const best={offset:choice.offset,surface:baseline,comparison:baseComparison};
 if(best.offset){
  progress('Comprobando la alternativa contra todas las caras…');
  best.surface={...baseline,coefficients:baseline.coefficients.slice()};best.surface.coefficients[0]-=best.offset;
  best.comparison=auditSelectionFit(input.positions,input.index,mask,best.surface);
 }
 const optimization={...choice,baselineAreaIou:baseComparison.metrics.areaIou,candidateAreaIou:best.comparison.metrics.areaIou,accepted:false,fallback:false,evaluation:'training-area-selection-with-untouched-heldout-report'};
 if(best.offset){
  best.surface.fit={...baseline.fit,baselineHeldOutIou:baseline.fit?.iou,iou:choice.candidateHeldOutAreaIou,evaluated:choice.holdoutTriangles,evaluation:optimization.evaluation};
  try{
   const result=cut(input,best.surface,progress);optimization.accepted=true;
   result.comparison=best.comparison;result.report.selectionFit=best.comparison.metrics;result.report.selectionOptimization=optimization;return result;
  }catch(error){optimization.fallback=true;optimization.rejectedReason=error.message;progress('El ajuste alternativo no se valida; comprobando el ajuste original…');}
 }
 const result=cut(input,baseline,progress);result.comparison=baseComparison;result.report.selectionFit=baseComparison.metrics;result.report.selectionOptimization=optimization;return result;
}
