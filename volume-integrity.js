/** Comprobación volumétrica conservadora para cortes de mallas cerradas.
 * Volumen firmado por tetraedros; el valor absoluto representa el volumen
 * solo si la superficie tiene orientación consistente y no se autointerseca.
 */
export function signedMeshVolume(geometry){
  const pos=geometry?.getAttribute?.('position');
  const idx=geometry?.getIndex?.() || geometry?.index || null;
  if(!pos || pos.itemSize<3) throw Error('Geometría sin vértices XYZ.');
  const corners=idx?idx.count:pos.count;
  if(corners===0 || corners%3!==0)throw Error('La malla no contiene triángulos completos.');
  let vol=0, compensation=0;
  for(let i=0;i<corners;i+=3){
    const ids=[i,i+1,i+2].map(j=>idx?idx.getX(j):j);
    if(ids.some(j=>!Number.isInteger(j)||j<0||j>=pos.count))throw Error('Índice de triángulo inválido.');
    const [a,b,c]=ids.map(j=>[pos.getX(j),pos.getY(j),pos.getZ(j)]);
    if([...a,...b,...c].some(v=>!Number.isFinite(v)))throw Error('Coordenadas no finitas.');
    const det=a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]);
    const y=det/6-compensation;const next=vol+y;compensation=(next-vol)-y;vol=next;
  }
  return vol;
}
export function assertCutVolumeConservation(source,positive,negative,{relativeTolerance=.015,absoluteTolerance=1e-5}={}){
  const original=signedMeshVolume(source);
  const a=signedMeshVolume(positive),b=signedMeshVolume(negative);
  const before=Math.abs(original),after=Math.abs(a)+Math.abs(b);
  if(before<=absoluteTolerance)throw Error('Volumen original nulo o demasiado pequeño para validar.');
  if(Math.abs(a)<=absoluteTolerance||Math.abs(b)<=absoluteTolerance)throw Error('Una mitad del corte tiene volumen prácticamente nulo.');
  const difference=Math.abs(before-after),maxDifference=Math.max(absoluteTolerance,before*relativeTolerance);
  if(difference>maxDifference)throw Error(`Corte cancelado: volumen no conservado (${(100*difference/before).toFixed(2)}% de diferencia).`);
  return {before,after,difference,relativeDifference:difference/before};
}
