// Transiciones puras de la vista de camas: no escriben sobre las posiciones guardadas.
export function bedViewTransition(current, action) {
  const s={bedMode:!!current.bedMode,allBedsView:!!current.allBedsView,activeBed:current.activeBed};
  if(action==='showAll') return {...s,bedMode:true,allBedsView:true};
  if(action==='showSingle') return {...s,bedMode:true,allBedsView:false};
  if(action==='toggleAll') return {...s,bedMode:true,allBedsView:!s.allBedsView};
  if(action==='leave') return {...s,bedMode:false,allBedsView:false};
  if(action?.type==='selectBed') return {...s,bedMode:true,allBedsView:false,activeBed:action.id};
  throw new Error('Transición de vista no reconocida');
}
export function captureBedPlacementState(beds){
  return JSON.stringify(beds.map(b=>({id:b.id,items:[...b.items],placements:Object.fromEntries(Object.entries(b.placements||{}).sort(([a],[c])=>a.localeCompare(c)).map(([id,p])=>[id,{x:p.x,y:p.y,rot:p.rot}]))})));
}
