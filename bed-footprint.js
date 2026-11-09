// Revisión conservadora de siluetas convexas proyectadas en la cama (ejes X/Z).
// No es detección exacta de colisiones 3D; permite descartar falsas alarmas de AABB.
export function convexHull(points){
  if(!Array.isArray(points)||points.length<3||points.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)))return null;
  const sorted=[...points].sort((a,b)=>a.x-b.x||a.y-b.y),cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const lo=[],hi=[];
  for(const p of sorted){while(lo.length>1&&cross(lo.at(-2),lo.at(-1),p)<=1e-9)lo.pop();lo.push(p)}
  for(let i=sorted.length-1;i>=0;i--){const p=sorted[i];while(hi.length>1&&cross(hi.at(-2),hi.at(-1),p)<=1e-9)hi.pop();hi.push(p)}
  lo.pop();hi.pop();const hull=lo.concat(hi);return hull.length>=3?hull:null;
}
export function convexFootprintsOverlap(a,b,epsilon=0.01){
  if(!Array.isArray(a)||!Array.isArray(b)||a.length<3||b.length<3)return null;
  for(const poly of [a,b])for(let i=0;i<poly.length;i++){
    const p=poly[i],q=poly[(i+1)%poly.length],nx=q.y-p.y,ny=p.x-q.x;
    const pa=a.map(v=>v.x*nx+v.y*ny),pb=b.map(v=>v.x*nx+v.y*ny);
    if(Math.max(...pa)<Math.min(...pb)+epsilon||Math.max(...pb)<Math.min(...pa)+epsilon)return false;
  }
  return true;
}

// Distancia mínima entre polígonos convexos (mm), calculada en el plano de la cama.
// Devuelve null si las siluetas no son evaluables. 0 indica contacto o intersección.
export function convexFootprintsDistance(a,b){
  if(!Array.isArray(a)||!Array.isArray(b)||a.length<3||b.length<3||
    [...a,...b].some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)))return null;
  if(convexFootprintsOverlap(a,b,0)===true)return 0;
  const pointSegmentDistance=(p,u,v)=>{
    const dx=v.x-u.x,dy=v.y-u.y,den=dx*dx+dy*dy;
    if(den<=1e-20)return Math.hypot(p.x-u.x,p.y-u.y);
    const t=Math.max(0,Math.min(1,((p.x-u.x)*dx+(p.y-u.y)*dy)/den));
    return Math.hypot(p.x-u.x-t*dx,p.y-u.y-t*dy);
  };
  let min=Infinity;
  for(const [one,two] of [[a,b],[b,a]]){
    for(const p of one)for(let i=0;i<two.length;i++){
      min=Math.min(min,pointSegmentDistance(p,two[i],two[(i+1)%two.length]));
    }
  }
  return Number.isFinite(min)?min:null;
}
// Se usa solo si la silueta no está disponible: distancia de cajas 2D conservadora.
export function rectangleFootprintDistance(a,b){
  if(!a||!b||![a.x,a.y,a.w,a.h,b.x,b.y,b.w,b.h].every(Number.isFinite)||a.w<=0||a.h<=0||b.w<=0||b.h<=0)return null;
  const dx=Math.max(0,b.x-(a.x+a.w),a.x-(b.x+b.w));
  const dy=Math.max(0,b.y-(a.y+a.h),a.y-(b.y+b.h));
  return Math.hypot(dx,dy);
}
