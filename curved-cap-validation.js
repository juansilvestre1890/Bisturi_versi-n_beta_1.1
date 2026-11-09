// Conservative geometric screening of a lightly curved cap.
// Does not claim to reconstruct arbitrary high-curvature surfaces.
export function validateCurvedCap(projected, triangles, points, normal, options={}) {
  if(projected.length<3||points.length!==projected.length||!triangles.length)throw Error('Contorno sin datos suficientes.');
  const diameter=Math.hypot(
    Math.max(...projected.map(p=>p.x))-Math.min(...projected.map(p=>p.x)),
    Math.max(...projected.map(p=>p.y))-Math.min(...projected.map(p=>p.y))
  );
  if(!Number.isFinite(diameter)||diameter<=0)throw Error('Contorno sin tamaño válido.');
  const maxWarp=Math.max(...projected.map(p=>Math.abs(p.h)));
  const warpLimit=Math.max(diameter*.02,options.absoluteEpsilon??1e-5);
  if(maxWarp>warpLimit)throw Error('Borde excesivamente curvo respecto a su tamaño local: requiere cierre avanzado.');
  const minAlignment=options.minAlignment??.65;
  for(const tri of triangles){
    if(tri.length!==3||tri.some(i=>!Number.isInteger(i)||i<0||i>=points.length))throw Error('Índices de tapa inválidos.');
    const [a,b,c]=tri.map(i=>points[i]);
    const ux=b.x-a.x,uy=b.y-a.y,uz=b.z-a.z;
    const vx=c.x-a.x,vy=c.y-a.y,vz=c.z-a.z;
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    const len=Math.hypot(nx,ny,nz);
    if(!Number.isFinite(len)||len<=diameter*diameter*1e-12)throw Error('Triángulo de cierre degenerado.');
    const dot=(nx*normal.x+ny*normal.y+nz*normal.z)/len;
    if(!Number.isFinite(dot)||Math.abs(dot)<minAlignment)throw Error('Triángulo de tapa excesivamente inclinado o plegado.');
  }
  return {diameter,maxWarp,warpLimit};
}
