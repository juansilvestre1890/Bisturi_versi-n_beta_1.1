// Ensure the planar projection of a triangulated organic cap covers its boundary
// exactly once. This is a safety guard, not a general surface reconstruction.
export function validateCapCoverage(projected, triangles, {relativeTolerance=1e-5}={}) {
  if (!Array.isArray(projected)||projected.length<3||!Array.isArray(triangles)||!triangles.length)
    throw Error('La tapa no contiene un contorno triangulado válido.');
  const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  let boundaryTwice=0;
  for(let i=0;i<projected.length;i++){
    const a=projected[i],b=projected[(i+1)%projected.length];
    if(![a.x,a.y,b.x,b.y].every(Number.isFinite))throw Error('Contorno con coordenadas no válidas.');
    boundaryTwice+=a.x*b.y-a.y*b.x;
  }
  const magnitude=Math.abs(boundaryTwice);
  if(magnitude<=1e-12)throw Error('Contorno de área insuficiente.');
  const sign=Math.sign(boundaryTwice);
  let coveredTwice=0;
  for(const tri of triangles){
    if(!Array.isArray(tri)||tri.length!==3||tri.some(i=>!Number.isInteger(i)||i<0||i>=projected.length)||new Set(tri).size!==3)
      throw Error('Triángulo de tapa inválido.');
    const area=cross(...tri.map(i=>projected[i]));
    if(!Number.isFinite(area)||area*sign<=magnitude*1e-12)
      throw Error('Triángulo de tapa invertido o degenerado.');
    coveredTwice+=area;
  }
  const difference=Math.abs(coveredTwice-boundaryTwice);
  if(difference>magnitude*relativeTolerance)
    throw Error('La tapa no cubre exactamente el contorno seleccionado.');
  return {boundaryArea:magnitude/2,capArea:Math.abs(coveredTwice)/2,difference:difference/2};
}
