// Vista previa no destructiva: valida los recuentos sin alterar la selección.
export function surfacePreviewCounts(total, selectedFaces, maxFaces=2000000){
  if(!Number.isSafeInteger(total)||total<2||total>maxFaces)throw Error('La malla supera el límite de vista previa o no tiene suficientes triángulos.');
  const indices=selectedFaces instanceof Set?selectedFaces:new Set(selectedFaces);
  if(!indices.size||indices.size>=total)throw Error('Selecciona una región parcial antes de generar la vista previa.');
  for(const f of indices)if(!Number.isSafeInteger(f)||f<0||f>=total)throw Error('La selección incluye triángulos fuera de la malla.');
  return {selected:indices.size,remainder:total-indices.size,total,selectedPercent:100*indices.size/total};
}
