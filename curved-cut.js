// Bisturí 3D: cuadráticas, corte con exterior intacto y tapas compartidas.
// El motor no usa DOM ni Three.js: se ejecuta en un Worker o en Node.
import {pointTriangleDistanceSquared} from './triangle-distance.js';
import {refineCap} from './refine-cap.js';
import {visitCapSamples} from './cap-samples.js';
import earcut, {deviation} from './earcut.js';
const fail = message => { throw new Error(message); };
export const evaluate = (q,x,y,z) => q[0]+q[1]*x+q[2]*y+q[3]*z+q[4]*x*x+q[5]*x*y+q[6]*x*z+q[7]*y*y+q[8]*y*z+q[9]*z*z;
const value = (q,p) => evaluate(q,...p);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const bilinear=(q,a,b)=>q[4]*a[0]*b[0]+q[7]*a[1]*b[1]+q[9]*a[2]*b[2]+q[5]*(a[0]*b[1]+a[1]*b[0])/2+q[6]*(a[0]*b[2]+a[2]*b[0])/2+q[8]*(a[1]*b[2]+a[2]*b[1])/2;
const gradient=(q,p)=>[q[1]+2*q[4]*p[0]+q[5]*p[1]+q[6]*p[2],q[2]+q[5]*p[0]+2*q[7]*p[1]+q[8]*p[2],q[3]+q[6]*p[0]+q[8]*p[1]+2*q[9]*p[2]];
export function boundsOf(p){
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<p.length;i++){if(!Number.isFinite(p[i]))fail('Coordenadas no finitas.');const k=i%3;min[k]=Math.min(min[k],p[i]);max[k]=Math.max(max[k],p[i]);}
 return {min,max};
}
export function validateSurface(s){
 if(!s||s.schema!=='bisturi.curved-surface.v1'||!Array.isArray(s.coefficients)||s.coefficients.length!==10||!s.coefficients.every(Number.isFinite)||![0,1,2].includes(s.axis))fail('Superficie curva JSON no válida.');
 if(Math.max(...s.coefficients.map(Math.abs))===0)fail('La superficie tiene todos sus coeficientes a cero.');
 return s;
}
// Orden: constante,x,y,z,xx,xy,xz,yy,yz,zz. Coordenadas locales del modelo.
export function manualSurface(bounds,axis=2,fraction=.65,curvature=.2){
 if(![0,1,2].includes(axis)||!(fraction>0&&fraction<1)||!Number.isFinite(curvature)||Math.abs(curvature)>1)fail('Parámetros de curva no válidos.');
 const u=(axis+1)%3,v=(axis+2)%3,c=bounds.min.map((x,i)=>(x+bounds.max[i])/2),size=bounds.max.map((x,i)=>x-bounds.min[i]);
 if(size.some(x=>x<=0))fail('La pieza no tiene volumen tridimensional.');
 const q=Array(10).fill(0),square=[4,7,9];q[axis+1]=1;q[0]=-(bounds.min[axis]+fraction*size[axis]);
 for(const k of [u,v]){const a=curvature*size[axis]/(size[k]/2)**2;q[square[k]]=-a;q[k+1]+=2*a*c[k];q[0]-=a*c[k]*c[k];}
 return {schema:'bisturi.curved-surface.v1',coefficients:q,axis,method:'manual',bounds};
}
// Ajuste aproximado a la selección, con muestra independiente de evaluación.
export function fitSurface(positions,index,mask){
 const count=(index?index.length:positions.length/3)/3;
 if(!mask||mask.length!==count)fail('Marca una selección antes de ajustar la curva.');
 const bounds=boundsOf(positions),center=bounds.min.map((v,i)=>(v+bounds.max[i])/2),scale=bounds.max.map((v,i)=>Math.max((v-bounds.min[i])/2,1e-9));
 const row=f=>{const p=[0,0,0];for(let k=0;k<3;k++){const vi=(index?index[3*f+k]:3*f+k)*3;for(let a=0;a<3;a++)p[a]+=positions[vi+a]/3;}const [x,y,z]=p.map((v,i)=>(v-center[i])/scale[i]);return [1,x,y,z,x*x,x*y,x*z,y*y,y*z,z*z];};
 const totals=[0,0];for(const x of mask)totals[x?1:0]++;
 if(Math.min(...totals)<10)fail('La selección y el resto deben contener al menos 10 triángulos.');
 const used=[0,0],step=totals.map(v=>Math.max(1,Math.floor(v/12000))),A=Array.from({length:10},()=>Array(11).fill(0));let samples=0;
 for(let f=0;f<count;f++){if(f%5===0)continue;const s=mask[f]?1:0;if(used[s]++%step[s])continue;const r=row(f),weight=1/Math.min(totals[s],12000),y=s?1:-1;samples++;for(let i=0;i<10;i++){for(let j=0;j<10;j++)A[i][j]+=weight*r[i]*r[j];A[i][10]+=weight*r[i]*y;}}
 for(let i=0;i<10;i++)A[i][i]+=1e-5;
 for(let k=0;k<10;k++){let best=k;for(let j=k+1;j<10;j++)if(Math.abs(A[j][k])>Math.abs(A[best][k]))best=j;[A[k],A[best]]=[A[best],A[k]];if(Math.abs(A[k][k])<1e-12)fail('No se pudo ajustar la curva.');const d=A[k][k];for(let j=k;j<=10;j++)A[k][j]/=d;for(let i=0;i<10;i++)if(i!==k){const a=A[i][k];for(let j=k;j<=10;j++)A[i][j]-=a*A[k][j];}}
 const w=A.map(r=>r[10]),q=Array(10).fill(0);q[0]=w[0];
 for(let i=0;i<3;i++){q[i+1]+=w[i+1]/scale[i];q[0]-=w[i+1]*center[i]/scale[i];}
 for(const [slot,i,j] of [[4,0,0],[5,0,1],[6,0,2],[7,1,1],[8,1,2],[9,2,2]]){const a=w[slot]/scale[i]/scale[j];q[slot]=a;q[i+1]-=a*center[j];q[j+1]-=a*center[i];q[0]+=a*center[i]*center[j];}
 let intersection=0,union=0,evaluated=0;for(let f=0;f<count;f+=5){const pred=dot10(w,row(f))>0,truth=!!mask[f];if(pred&&truth)intersection++;if(pred||truth)union++;evaluated++;}
 const g=gradient(q,center),axis=g.map(Math.abs).indexOf(Math.max(...g.map(Math.abs)));
 return {schema:'bisturi.curved-surface.v1',coefficients:q,axis,method:'selection-fit',bounds,fit:{iou:intersection/union,evaluated,samples}};
}
const dot10=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
export function weld(positions,index){
 if(!(positions instanceof Float32Array)||positions.length%3)fail('Posiciones Float32 no válidas.');
 boundsOf(positions);const n=positions.length/3,order=new Uint32Array(n);for(let i=0;i<n;i++)order[i]=i;
 order.sort((a,b)=>positions[3*a]-positions[3*b]||positions[3*a+1]-positions[3*b+1]||positions[3*a+2]-positions[3*b+2]);
 const map=new Uint32Array(n),vertices=new Float32Array(positions.length);let used=0,prev=-1;
 for(const i of order){if(prev<0||positions[3*i]!==positions[3*prev]||positions[3*i+1]!==positions[3*prev+1]||positions[3*i+2]!==positions[3*prev+2]){vertices.set(positions.subarray(3*i,3*i+3),3*used++);prev=i;}map[i]=used-1;}
 const faces=new Uint32Array(index?index.length:n);for(let i=0;i<faces.length;i++){const k=index?index[i]:i;if(!Number.isInteger(k)||k>=n||k<0)fail('Índice de malla inválido.');faces[i]=map[k];}
 if(faces.length%3)fail('Caras incompletas.');return {positions:vertices.slice(0,used*3),index:faces};
}
export function inspect(mesh){
 const p=mesh.positions,faces=mesh.index,n=p.length/3,edges=new Float64Array(faces.length),parent=new Int32Array(n).fill(-1),rank=new Uint8Array(n);let volume=0,degenerate=0;
 const find=x=>{while(parent[x]!==x){parent[x]=parent[parent[x]];x=parent[x];}return x;};
 const union=(a,b)=>{a=find(a);b=find(b);if(a===b)return;if(rank[a]<rank[b])[a,b]=[b,a];parent[b]=a;if(rank[a]===rank[b])rank[a]++;};
 const at=id=>[p[3*id],p[3*id+1],p[3*id+2]];
 // Local origin reduces cancellation for models far from zero.
 const origin=at(faces[0]);
 for(let f=0;f<faces.length;f+=3){const ids=[faces[f],faces[f+1],faces[f+2]];for(const id of ids)if(parent[id]===-1)parent[id]=id;union(ids[0],ids[1]);union(ids[1],ids[2]);const [a,b,c]=ids.map(at),normal=cross(sub(b,a),sub(c,a));if(new Set(ids).size!==3||dot(normal,normal)===0)degenerate++;volume+=dot(sub(a,origin),cross(sub(b,origin),sub(c,origin)))/6;for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3];edges[f+k]=2*(Math.min(a,b)*n+Math.max(a,b))+(a<b?0:1);}}
 edges.sort();let boundary=0,nonManifold=0,winding=0;
 for(let i=0;i<edges.length;){let j=i+1;const key=Math.floor(edges[i]/2);while(j<edges.length&&Math.floor(edges[j]/2)===key)j++;if(j-i===1)boundary++;else if(j-i!==2)nonManifold++;else if(edges[i]%2===edges[i+1]%2)winding++;i=j;}
 const componentVolumes=new Map();for(let f=0;f<faces.length;f+=3){const a=sub(at(faces[f]),origin),b=sub(at(faces[f+1]),origin),c=sub(at(faces[f+2]),origin),id=find(faces[f]);componentVolumes.set(id,(componentVolumes.get(id)||0)+dot(a,cross(b,c))/6);}
 return {triangles:faces.length/3,vertices:n,boundary,nonManifold,winding,degenerate,volume,components:componentVolumes.size,componentVolumes:[...componentVolumes.values()],closed:!boundary&&!nonManifold&&!winding&&!degenerate};
}
function extrema(q,a,b,c,fa,fb,fc){
 const e=sub(b,a),f=sub(c,a),g=gradient(q,a),A=bilinear(q,e,e),B=2*bilinear(q,e,f),C=bilinear(q,f,f),D=dot(g,e),E=dot(g,f);let min=Math.min(fa,fb,fc),max=Math.max(fa,fb,fc);
 const take=v=>{min=Math.min(min,v);max=Math.max(max,v);};
 for(const [qa,qb,qc] of [[A,D,fa],[C,E,fa],[A-B+C,-2*A+B-D+E,fb]]){if(Math.abs(qa)>1e-20){const t=-qb/(2*qa);if(t>0&&t<1)take(qa*t*t+qb*t+qc);}}
 const det=4*A*C-B*B;if(Math.abs(det)>1e-22){const u=(B*E-2*C*D)/det,v=(B*D-2*A*E)/det;if(u>0&&v>0&&u+v<1)take(A*u*u+B*u*v+C*v*v+D*u+E*v+fa);}
 return {min,max};
}
const orient=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function inside(point,loop,xy){let hit=false;for(let i=0,j=loop.length-1;i<loop.length;j=i++){const a=xy(loop[i]),b=xy(loop[j]);if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
function compact(vertices,faces){const remap=new Int32Array(vertices.length/3).fill(-1),p=[],idx=new Uint32Array(faces.length);for(let i=0;i<faces.length;i++){const v=faces[i];if(remap[v]<0){remap[v]=p.length/3;p.push(vertices[3*v],vertices[3*v+1],vertices[3*v+2]);}idx[i]=remap[v];}return {positions:new Float32Array(p),index:idx};}
// Muestreo conservador de la tapa en la entrada: rayos paralelos al eje.
// Control adicional; no equivale a una prueba exhaustiva de autointersecciones.
function capContainment(source,vertices,cap,axis,bounds){
 const u=(axis+1)%3,v=(axis+2)%3,N=64,p=source.positions,f=source.index,
  span=Math.max(...bounds.max.map((x,i)=>x-bounds.min[i])),tolerance=span*1e-6,
  scaleU=N/(bounds.max[u]-bounds.min[u]),scaleV=N/(bounds.max[v]-bounds.min[v]);
 const cells=Array.from({length:N*N},()=>[]),cellU=x=>Math.max(0,Math.min(N-1,Math.floor((x-bounds.min[u])*scaleU))),cellV=x=>Math.max(0,Math.min(N-1,Math.floor((x-bounds.min[v])*scaleV)));
 let entries=0;
 for(let i=0;i<f.length;i+=3){const a=f[i]*3,b=f[i+1]*3,c=f[i+2]*3,
  x0=cellU(Math.min(p[a+u],p[b+u],p[c+u])),x1=cellU(Math.max(p[a+u],p[b+u],p[c+u])),
  y0=cellV(Math.min(p[a+v],p[b+v],p[c+v])),y1=cellV(Math.max(p[a+v],p[b+v],p[c+v]));
  entries+=(x1-x0+1)*(y1-y0+1);if(entries>20000000)fail('La comprobación interior excede la memoria prevista.');
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)cells[y*N+x].push(i);
 }
 let checked=0,nearBoundary=0,nearByEuclidean=0,maxOutsideDistance=0;
 const nearSurface=P=>{
  const x0=cellU(P[u]-tolerance),x1=cellU(P[u]+tolerance),y0=cellV(P[v]-tolerance),y1=cellV(P[v]+tolerance);
  const point=id=>[p[3*id],p[3*id+1],p[3*id+2]];
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)for(const i of cells[y*N+x])
   if(pointTriangleDistanceSquared(P,point(f[i]),point(f[i+1]),point(f[i+2]))<=tolerance*tolerance)return true;
  return false;
 };
 const check=P=>{
  const hits=[];
  for(const i of cells[cellV(P[v])*N+cellU(P[u])]){const a=f[i]*3,b=f[i+1]*3,c=f[i+2]*3,
   ax=p[a+u],ay=p[a+v],bx=p[b+u],by=p[b+v],cx=p[c+u],cy=p[c+v],d=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
   if(Math.abs(d)<span*span*1e-20)continue;
   const A=((by-cy)*(P[u]-cx)+(cx-bx)*(P[v]-cy))/d,B=((cy-ay)*(P[u]-cx)+(ax-cx)*(P[v]-cy))/d,C=1-A-B;
   if(A>=-1e-10&&B>=-1e-10&&C>=-1e-10)hits.push(A*p[a+axis]+B*p[b+axis]+C*p[c+axis]);
  }
  hits.sort((a,b)=>a-b);const h=[];for(const x of hits)if(!h.length||x-h[h.length-1]>span*1e-10)h.push(x);
  if(!h.length){if(nearSurface(P)){checked++;nearByEuclidean++;return;}fail('Una parte de la tapa sale fuera de la figura.');}
  const z=P[axis],distance=Math.min(...h.map(x=>Math.abs(x-z)));checked++;
  if(distance<=tolerance){nearBoundary++;return;}
  if((h.length%2||h.filter(x=>x<z).length%2!==1)&&nearSurface(P)){nearByEuclidean++;return;}
  if(h.length%2)fail('La comprobación interior es ambigua; cambia ligeramente el corte.');
  const lower=h.filter(x=>x<z).length;if(lower%2!==1){maxOutsideDistance=Math.max(maxOutsideDistance,distance);fail('Una parte de la tapa atraviesa el exterior de la figura.');}
 };
 const sampleKinds=visitCapSamples(vertices,cap,(P,kind,ids)=>{try{check(P);}catch(e){e.capSample={point:P,kind,ids};throw e;}});
 return {samples:checked,sampleKinds,nearBoundary,nearByEuclidean,tolerance,maxOutsideDistance,exhaustive:false};
}
export function fingerprint(positions,index){
 let hash=2166136261;const bits=new Uint32Array(positions.buffer,positions.byteOffset,positions.length);
 for(const x of bits)hash=Math.imul(hash^x,16777619)>>>0;
 if(index)for(const x of index)hash=Math.imul(hash^x,16777619)>>>0;
 return positions.length+':'+(index?index.length:0)+':'+hash.toString(16);
}
export function cutCurved(input,surface,onProgress=()=>{}){ 
 validateSurface(surface);if(surface.sourceFingerprint&&surface.sourceFingerprint!==fingerprint(input.positions,input.index))fail('La superficie de referencia no corresponde a esta malla.');if((input.index?input.index.length:input.positions.length/3)>6000000)fail('Límite del corte curvo: 2 millones de triángulos.');
 onProgress('Uniendo vértices coincidentes…');const source=weld(input.positions,input.index);onProgress('Comprobando el sólido original…');const original=inspect(source);if(!original.closed||!Number.isFinite(original.volume)||original.volume<=0)fail('La entrada debe ser un sólido cerrado y orientado hacia fuera.');
 const bounds=boundsOf(source.positions),span=Math.max(...bounds.max.map((v,i)=>v-bounds.min[i]));
 if(surface.bounds){for(let k=0;k<3;k++)if(Math.abs(surface.bounds.min[k]-bounds.min[k])>span*1e-5||Math.abs(surface.bounds.max[k]-bounds.max[k])>span*1e-5)fail('La superficie guardada corresponde a otras dimensiones locales.');}
 const scale=Math.max(...surface.coefficients.map(Math.abs)),q=surface.coefficients.map(x=>x/scale),hasQuadratic=q.slice(4).some(x=>x!==0),verts=Array.from(source.positions),point=id=>verts.slice(id*3,id*3+3),values=new Float64Array(verts.length/3),positive=[],negative=[],segments=[],intersection=new Map(),touchingEdges=new Map();
 let intact=0,cut=0,totalArea=0,intactArea=0;
 for(let i=0;i<values.length;i++){const p=point(i),v=value(q,p);if(!Number.isFinite(v))fail('Escala numérica fuera del rango admitido.');
  // Treat a root closer than the mesh's Float32 resolution as a vertex hit.
  // Bound the snapping distance by the size of the model as well, so large
  // world coordinates cannot silently move the cut across a small feature.
  const g=gradient(q,p),resolution=g.reduce((s,d,k)=>s+Math.abs(d*p[k])*2**-24,0),limit=Math.hypot(...g)*span*1e-7;
  values[i]=Math.abs(v)<=Math.max(1e-13,Math.min(resolution,limit))?0:v;
 }
 const crosspoint=(i,j)=>{if(i>j)[i,j]=[j,i];const key=i*values.length+j;if(intersection.has(key))return intersection.get(key);const a=point(i),b=point(j);let lo=0,hi=1;for(let k=0;k<48;k++){const t=(lo+hi)/2,p=a.map((x,d)=>x+t*(b[d]-x));if((value(q,p)>0)===(values[i]>0))lo=t;else hi=t;}const t=(lo+hi)/2,p=a.map((x,k)=>Math.fround(x+t*(b[k]-x)));
  // A Float32 seam point identical to an endpoint creates a zero-length edge
  // and can make an apparently closed cap disagree with the exterior mesh.
  if([a,b].some(endpoint=>p.every((x,k)=>x===endpoint[k])))fail('La curva cruza demasiado cerca de un vértice para la precisión de esta malla. Desplaza ligeramente el corte.');
  const id=verts.length/3;verts.push(...p);intersection.set(key,id);return id;};
 onProgress('Recortando triángulos; conservando el exterior…');
 for(let f=0;f<source.index.length;f+=3){const ids=[source.index[f],source.index[f+1],source.index[f+2]],p=ids.map(point),v=ids.map(i=>values[i]),n=v.filter(x=>x>0).length,m=v.filter(x=>x<0).length,zeros=ids.filter((_,k)=>v[k]===0),area=Math.sqrt(dot(cross(sub(p[1],p[0]),sub(p[2],p[0])),cross(sub(p[1],p[0]),sub(p[2],p[0]))))/2;totalArea+=area;
  if(zeros.length===3)fail('Una cara coincide con la curva; desplaza ligeramente el corte.');
  // A quadratic may touch or cross an edge twice even when both endpoints
  // have the same sign. Inspect every source edge, including intact faces.
  for(let k=0;hasQuadratic&&k<3;k++){const j=(k+1)%3;if(!v[k]||!v[j]||Math.sign(v[k])!==Math.sign(v[j]))continue;
   const e=sub(p[j],p[k]),A=bilinear(q,e,e),B=dot(gradient(q,p[k]),e);
   if(!A)continue;const t=-B/(2*A);if(t<=0||t>=1)continue;
   const at=A*t*t+B*t+value(q,p[k]),tolerance=1e-12*Math.max(1,Math.abs(v[k]),Math.abs(v[j]));
   if(Math.abs(at)<=tolerance)fail('La curva toca tangencialmente una arista; desplaza ligeramente el corte.');
   if(Math.sign(at)!==Math.sign(v[k]))fail('Una arista cruza dos veces la curva; cambia el corte o subdivide la zona.');
  }
  const range=extrema(q,...p,...v);
  if(!n||!m){if((!n&&range.max>1e-12)||(!m&&range.min< -1e-12))fail('La curva cruza el interior de una cara sin cruzar sus vértices. Se requiere subdivisión local.');(n?positive:negative).push(...ids);intact++;intactArea+=area;
   if(zeros.length===2){const key=zeros.slice().sort((a,b)=>a-b).join(':');if(!touchingEdges.has(key))touchingEdges.set(key,{edge:zeros,sides:[]});touchingEdges.get(key).sides.push(n?1:-1);}
   continue;}
  cut++;const seam=[];
  for(const sign of [1,-1]){const polygon=[];for(let k=0;k<3;k++){const j=(k+1)%3;if(sign*v[k]>=0){polygon.push(ids[k]);if(sign===1&&v[k]===0)seam.push(ids[k]);}if(v[k]*v[j]<0){const id=crosspoint(ids[k],ids[j]);polygon.push(id);if(sign===1)seam.push(id);}}const out=sign===1?positive:negative;for(let k=1;k<polygon.length-1;k++)out.push(polygon[0],polygon[k],polygon[k+1]);}
  if(seam.length!==2||seam[0]===seam[1])fail('Contorno degenerado en la intersección.');segments.push(seam);
 }
 for(const {edge,sides} of touchingEdges.values()){if(sides.length!==2)fail('Una arista coincidente tiene una unión ambigua.');if(sides[0]!==sides[1]){segments.push(edge);cut+=2;}}
 if(!cut)fail('La curva no cruza la pieza.');
 onProgress('Construyendo contornos y superficies interiores…');
 const neighbors=new Map();for(const [a,b] of segments){if(!neighbors.has(a))neighbors.set(a,[]);if(!neighbors.has(b))neighbors.set(b,[]);neighbors.get(a).push(b);neighbors.get(b).push(a);}
 if([...neighbors.values()].some(n=>n.length!==2))fail('El contorno se ramifica: no se pueden construir tapas seguras.');
 const seen=new Set(),loops=[];for(const start of neighbors.keys()){if(seen.has(start))continue;const loop=[];let prev=-1,cur=start;do{if(seen.has(cur))fail('Contorno que se toca a sí mismo.');loop.push(cur);seen.add(cur);const next=neighbors.get(cur).find(v=>v!==prev);prev=cur;cur=next;}while(cur!==start);if(loop.length<3)fail('Contorno demasiado pequeño.');loops.push(loop);}
 const axis=surface.axis,u=(axis+1)%3,v=(axis+2)%3,xy=id=>[verts[3*id+u],verts[3*id+v]];
 // Reject projected crossings, touching rings, overlaps and duplicate coordinates.
 const eps=span*1e-10,allSegments=loops.flatMap(l=>l.map((a,i)=>[a,l[(i+1)%l.length]]));
 for(let i=0;i<allSegments.length;i++){const [ai,bi]=allSegments[i],a=xy(ai),b=xy(bi);if(Math.hypot(a[0]-b[0],a[1]-b[1])<eps)fail('La curva no admite esta proyección.');for(let j=i+1;j<allSegments.length;j++){const [ci,di]=allSegments[j];if(ai===ci||ai===di||bi===ci||bi===di)continue;const c=xy(ci),d=xy(di);if(Math.max(a[0],b[0])+eps<Math.min(c[0],d[0])||Math.max(c[0],d[0])+eps<Math.min(a[0],b[0])||Math.max(a[1],b[1])+eps<Math.min(c[1],d[1])||Math.max(c[1],d[1])+eps<Math.min(a[1],b[1]))continue;const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b);if(o1*o2<=0&&o3*o4<=0)fail('Los contornos se cruzan o se tocan al proyectarlos. Prueba otro eje.');}}
 const parents=loops.map((l,i)=>loops.map((other,j)=>j!==i&&inside(xy(l[0]),other,xy)?j:-1).filter(j=>j>=0));
 const derivative=[...neighbors.keys()].map(i=>gradient(q,point(i))[axis]);const branch=Math.sign(derivative[0]);if(!branch||derivative.some(x=>x*branch<=1e-10))fail('La superficie tiene varias alturas en el eje elegido. Prueba otro eje.');
 const cap=[];let holesTotal=0,domains=0;
 const height=(U,V,near)=>{const p=[0,0,0];p[u]=U;p[v]=V;const C=value(q,p);p[axis]=1;const f1=value(q,p);p[axis]=-1;const fm=value(q,p),A=(f1+fm)/2-C,B=(f1-fm)/2;let roots;if(Math.abs(A)<1e-14){if(Math.abs(B)<1e-14)fail('Curva vertical en la tapa.');roots=[-C/B];}else{const d=B*B-4*A*C;if(d<0)fail('No hay superficie real dentro de la tapa.');const r=-.5*(B+Math.sign(B||1)*Math.sqrt(d));roots=[r/A,r?C/r:-B/(2*A)];}const z=roots.find(z=>Number.isFinite(z)&&(2*A*z+B)*branch>0);if(z===undefined)fail('Rama ambigua de la superficie.');return z;};
 for(let i=0;i<loops.length;i++){
  if(parents[i].length%2)continue;domains++;const holes=loops.map((_,j)=>parents[j].length===parents[i].length+1&&parents[j].includes(i)?j:-1).filter(j=>j>=0);holesTotal+=holes.length;
  const rings=[loops[i],...holes.map(j=>loops[j])],ids=rings.flat(),holesAt=[];let offset=rings[0].length;for(let j=1;j<rings.length;j++){holesAt.push(offset);offset+=rings[j].length;}
  const data=ids.flatMap(xy);let indices=earcut(data,holesAt,2);if(!indices.length||deviation(data,holesAt,2,indices)>1e-8)fail('La triangulación no cubre correctamente la tapa.');
  // Earcut can omit collinear boundary vertices. Reinsert them by splitting
  // the corresponding triangle edge, preserving every original seam segment.
  let faces=[];for(let k=0;k<indices.length;k+=3)faces.push(indices.slice(k,k+3).map(x=>ids[x]));
  const required=new Set();for(const l of rings)for(let j=0;j<l.length;j++)required.add([l[j],l[(j+1)%l.length]].sort((a,b)=>a-b).join(':'));
  for(let pass=0;pass<3;pass++){let changed=false;const used=new Set(faces.flat());for(const id of ids){if(used.has(id))continue;const p=xy(id);let found=false;for(let f=0;f<faces.length&&!found;f++)for(let k=0;k<3;k++){const [a,b,c]=[faces[f][k],faces[f][(k+1)%3],faces[f][(k+2)%3]],A=xy(a),B=xy(b),l2=(B[0]-A[0])**2+(B[1]-A[1])**2,t=((p[0]-A[0])*(B[0]-A[0])+(p[1]-A[1])*(B[1]-A[1]))/l2;if(t>0&&t<1&&Math.abs(orient(A,B,p))<span*span*1e-12){faces[f]=[a,id,c];faces.push([id,b,c]);used.add(id);changed=found=true;break;}}if(!found)fail('No se pudo conservar un vértice del contorno.');}if(!changed)break;}
  const ec=new Map();for(const t of faces)for(let k=0;k<3;k++){const key=[t[k],t[(k+1)%3]].sort((a,b)=>a-b).join(':');ec.set(key,(ec.get(key)||0)+1);}const border=[...ec].filter(([,n])=>n===1).map(([k])=>k);if(border.length!==required.size||border.some(k=>!required.has(k))||[...ec.values()].some(n=>n>2))fail('La tapa no coincide exactamente con el contorno.');
  // Refine only interiors, never boundary edges; both pieces share this cap.
  for(let pass=0;pass<4;pass++){const next=[];for(const t of faces){const pts=t.map(xy),area=Math.abs(orient(...pts))/2;if(area<span*span*0.00003){next.push(t);continue;}const U=pts.reduce((s,p)=>s+p[0],0)/3,V=pts.reduce((s,p)=>s+p[1],0)/3,P=[0,0,0];P[u]=U;P[v]=V;P[axis]=height(U,V);const id=verts.length/3;verts.push(...P.map(Math.fround));next.push([t[0],t[1],id],[t[1],t[2],id],[t[2],t[0],id]);}faces=next;}
  for(let t of faces){if(orient(...t.map(xy))*branch<0)t=[t[0],t[2],t[1]];cap.push(...t);}
 }
 onProgress('Comprobando que la tapa quede dentro de la figura…');
 const containment=refineCap(verts,cap,axis,height,()=>capContainment(source,verts,cap,axis,bounds));
 for(let i=0;i<cap.length;i+=3){negative.push(cap[i],cap[i+1],cap[i+2]);positive.push(cap[i],cap[i+2],cap[i+1]);}
 onProgress('Verificando ambas mitades y el volumen…');
 const parts=[compact(verts,positive),compact(verts,negative)],reports=parts.map(inspect);
 for(const r of reports)if(!r.closed||!Number.isFinite(r.volume)||r.volume<=0||r.componentVolumes.some(v=>!Number.isFinite(v)||v<=0))fail('Una de las mitades no es un sólido cerrado con orientación válida.');
 const relativeVolumeError=Math.abs(reports[0].volume+reports[1].volume-original.volume)/original.volume;
 if(relativeVolumeError>1e-6)fail('Las mitades no conservan el volumen original.');
 return {parts,cap:compact(verts,cap),surface,report:{original,parts:reports,contours:loops.length,domains,holes:holesTotal,cutTriangles:cut,unchangedTriangles:intact,unchangedExteriorAreaRatio:intactArea/totalArea,capTriangles:cap.length/3,relativeVolumeError,containment,checks:{closed:true,winding:true,volume:true,hiddenFaceCrossings:true,projectedBoundaryCrossings:true},limits:['La cuádrica aproxima la selección; no sigue un contorno arbitrario.','No se certifican todas las autointersecciones ni la imprimibilidad.']}};
}
