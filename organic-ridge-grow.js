// Crecimiento conservador guiado por el relieve. Nunca altera la malla.
// No infiere una etiqueta semántica de «cabello»: solo sigue continuidad angular.
export function growToRidge(geometry, selected, {maxAngleDeg=35,maxDistance=25,maxFaces=250000,maxCumulativeBendDeg=120}={}){
 const pos=geometry?.getAttribute?.('position'), index=geometry?.index;
 if(!pos||pos.itemSize!==3)throw Error('Se requieren posiciones XYZ.');
 const count=(index?index.count:pos.count)/3;
 if(!Number.isInteger(count)||count<2||count>maxFaces)throw Error('Cantidad de triángulos no admitida.');
 if(!(Number.isFinite(maxAngleDeg)&&maxAngleDeg>0&&maxAngleDeg<90&&Number.isFinite(maxDistance)&&maxDistance>0&&Number.isFinite(maxCumulativeBendDeg)&&maxCumulativeBendDeg>0&&maxCumulativeBendDeg<=360))throw Error('Ángulo, curvatura acumulada o alcance inválido.');
 const initial=new Set(selected);
 if(!initial.size||initial.size===count)throw Error('Selecciona una región parcial.');
 const bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
 for(let i=0;i<pos.count;i++){
  const v=[pos.getX(i),pos.getY(i),pos.getZ(i)];
  if(v.some(x=>!Number.isFinite(x)))throw Error('Coordenadas no finitas.');
  for(let k=0;k<3;k++){bounds[k]=Math.min(bounds[k],v[k]);bounds[k+3]=Math.max(bounds[k+3],v[k]);}
 }
 const eps=Math.max(Math.hypot(bounds[3]-bounds[0],bounds[4]-bounds[1],bounds[5]-bounds[2])*1e-7,1e-7);
 const edges=new Map(),center=[],normals=[],neighbors=Array.from({length:count},()=>[]);
 for(let f=0;f<count;f++){
  const vv=[];
  for(let j=0;j<3;j++){
   const vi=index?index.getX(f*3+j):f*3+j;
   if(!Number.isInteger(vi)||vi<0||vi>=pos.count)throw Error('Índice inválido.');
   vv.push([pos.getX(vi),pos.getY(vi),pos.getZ(vi)]);
  }
  const a=vv[0],b=vv[1],c=vv[2];
  const u=b.map((x,k)=>x-a[k]),v=c.map((x,k)=>x-a[k]);
  const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  const len=Math.hypot(...n);if(len<=eps*eps)throw Error('Triángulo degenerado.');
  normals.push(n.map(x=>x/len));center.push(a.map((x,k)=>(x+b[k]+c[k])/3));
  const keys=vv.map(p=>p.map(x=>Math.round(x/eps)).join(','));
  if(new Set(keys).size!==3)throw Error('Triángulo degenerado.');
  for(let j=0;j<3;j++){
   const aa=keys[j],bb=keys[(j+1)%3],key=aa<bb?aa+'|'+bb:bb+'|'+aa;
   const list=edges.get(key)||[];list.push(f);if(list.length>2)throw Error('Arista no manifold.');edges.set(key,list);
  }
 }
 for(const pair of edges.values())if(pair.length===2){neighbors[pair[0]].push(pair[1]);neighbors[pair[1]].push(pair[0]);}
 for(const f of initial)if(!Number.isInteger(f)||f<0||f>=count)throw Error('Triángulo de selección inválido.');
 const cos=Math.cos(maxAngleDeg*Math.PI/180);
 const dist=new Float64Array(count).fill(Infinity),bend=new Float64Array(count).fill(Infinity),queue=[];
 for(const f of initial){dist[f]=0;bend[f]=0;queue.push([0,f,0]);}
 // Camino sobre centros de triángulos, acotado por el alcance en milímetros.
 const accepted=new Set(initial);let visited=0;
 while(queue.length){queue.sort((a,b)=>b[0]-a[0]);const [d,f,b]=queue.pop();
  if(d>dist[f]+1e-9||Math.abs(d-dist[f])<1e-9&&b>bend[f]+1e-9)continue;
  if(++visited>count*5)break;
  for(const to of neighbors[f]){
   const dot=normals[f].reduce((s,x,k)=>s+x*normals[to][k],0);
   if(dot<cos)continue;
   const nextBend=b+Math.acos(Math.max(-1,Math.min(1,dot)))*180/Math.PI;
   if(nextBend>maxCumulativeBendDeg+1e-9)continue;
   const length=Math.hypot(...center[f].map((x,k)=>x-center[to][k]));
   const nd=d+length;if(nd>maxDistance+1e-9||nd>dist[to]+1e-9||Math.abs(nd-dist[to])<1e-9&&nextBend>=bend[to]-1e-9)continue;
   dist[to]=nd;bend[to]=nextBend;accepted.add(to);queue.push([nd,to,nextBend]);
  }
 }
 if(accepted.size===count)throw Error('El crecimiento cubriría toda la malla; reduce el alcance.');
 return {faces:accepted,added:accepted.size-initial.size,angle:maxAngleDeg,maxDistance,maxCumulativeBendDeg};
}
