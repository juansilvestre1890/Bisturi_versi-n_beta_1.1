// Puntúa orejas válidas de un contorno ligeramente curvo.
// Favorece triángulos bien alineados y diagonales cortas sin introducir vértices.
export function selectStableEar(candidates,points,normal,{minimumAlignment=0.65}={}) {
  if(!Array.isArray(candidates)||!Array.isArray(points)||!normal)return null;
  let winner=null;
  for(const candidate of candidates){
    if(!Array.isArray(candidate)||candidate.length!==3||candidate.some(i=>!Number.isInteger(i)||i<0||i>=points.length))continue;
    const [a,b,c]=candidate.map(i=>points[i]);
    const ux=b.x-a.x,uy=b.y-a.y,uz=b.z-a.z;
    const vx=c.x-a.x,vy=c.y-a.y,vz=c.z-a.z;
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    const area2=Math.hypot(nx,ny,nz);
    if(!Number.isFinite(area2)||area2<=1e-14)continue;
    const alignment=Math.abs((nx*normal.x+ny*normal.y+nz*normal.z)/area2);
    if(!Number.isFinite(alignment)||alignment<minimumAlignment)continue;
    const diagonal=Math.hypot(c.x-a.x,c.y-a.y,c.z-a.z);
    if(!Number.isFinite(diagonal))continue;
    const score=(1-alignment)*1e4+diagonal;
    if(!winner||score<winner.score)winner={candidate,score,alignment};
  }
  return winner;
}
