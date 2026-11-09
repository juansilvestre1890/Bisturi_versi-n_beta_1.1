// Selección por aristas compartidas. No altera ni simplifica la malla de entrada.
import {weld} from './curved-cut.js';
export const MAX_SELECTION_FACES = 2000000;
export function buildSelectionTopology(positions,index=null,progress=()=>{}) {
  const count=(index?index.length:positions.length/3)/3;
  if(!Number.isInteger(count)||count<1||count>MAX_SELECTION_FACES)throw Error('La selección admite hasta 2 000 000 de triángulos por malla.');
  progress('Uniendo vértices coincidentes para seleccionar…');
  const mesh=weld(positions,index),p=mesh.positions,ids=mesh.index,n=p.length/3;
  const keys=new Float64Array(ids.length),order=new Uint32Array(ids.length);
  const neighbors=new Int32Array(ids.length).fill(-1),centers=new Float32Array(ids.length),normals=new Float32Array(ids.length);
  for(let f=0;f<count;f++){
    const offset=3*f,a=ids[offset],b=ids[offset+1],c=ids[offset+2];
    const ax=p[3*b]-p[3*a],ay=p[3*b+1]-p[3*a+1],az=p[3*b+2]-p[3*a+2];
    const bx=p[3*c]-p[3*a],by=p[3*c+1]-p[3*a+1],bz=p[3*c+2]-p[3*a+2];
    const nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx,len=Math.hypot(nx,ny,nz);
    if(!(len>0))throw Error('La malla contiene un triángulo degenerado; repara la pieza antes de seleccionar.');
    normals.set([nx/len,ny/len,nz/len],offset);
    for(let k=0;k<3;k++){
      centers[offset+k]=(p[3*a+k]+p[3*b+k]+p[3*c+k])/3;
      const u=ids[offset+k],v=ids[offset+(k+1)%3],slot=offset+k;
      keys[slot]=Math.min(u,v)*n+Math.max(u,v);order[slot]=slot;
    }
  }
  progress('Construyendo vecinos de superficie…');
  order.sort((a,b)=>keys[a]-keys[b]);let boundary=0,nonManifold=0;
  for(let i=0;i<order.length;){
    let j=i+1;while(j<order.length&&keys[order[j]]===keys[order[i]])j++;
    if(j-i===2){const a=order[i],b=order[i+1];if(Math.floor(a/3)!==Math.floor(b/3)){neighbors[a]=Math.floor(b/3);neighbors[b]=Math.floor(a/3);}}
    else if(j-i===1)boundary++;else nonManifold++;
    i=j;
  }
  // No se atraviesan aristas abiertas o con más de dos caras.
  return {count,neighbors,centers,normals,boundary,nonManifold};
}
function worldPoint(a,f,m){const x=a[3*f],y=a[3*f+1],z=a[3*f+2];return [m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]];}
function worldNormal(a,f,m){const x=a[3*f],y=a[3*f+1],z=a[3*f+2],v=[m[0]*x+m[3]*y+m[6]*z,m[1]*x+m[4]*y+m[7]*z,m[2]*x+m[5]*y+m[8]*z],l=Math.hypot(...v);return v.map(x=>x/l);}
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export function selectConnected(topology,options,colors=null) {
  const {count,neighbors,centers,normals}=topology,{seed,kind,matrix,normalMatrix}=options;
  if(!Number.isInteger(seed)||seed<0||seed>=count)throw Error('El triángulo tocado ya no existe.');
  if(!['brush','wand','magnetic'].includes(kind))throw Error('Herramienta de selección no válida.');
  if(!matrix||matrix.length!==16||!matrix.every(Number.isFinite)||!normalMatrix||normalMatrix.length!==9||!normalMatrix.every(Number.isFinite))throw Error('Transformación no válida.');
  if(kind==='brush'&&(!(options.radius>0)||!options.center?.every(Number.isFinite)||!options.cameraDirection?.every(Number.isFinite)))throw Error('Define un radio positivo para el pincel.');
  if(kind!=='brush'&&(!colors||colors.length!==count*3||!options.seedColor?.every(Number.isFinite)||!(options.tolerance>=0&&options.tolerance<=1)))throw Error('No se ha podido leer el color de la superficie.');
  if(kind==='magnetic'&&(!(options.reach>0)||!(options.angle>=0&&options.angle<=180)))throw Error('Alcance o ángulo magnético no válido.');
  if(kind==='magnetic')return magneticSelection(topology,options,colors);
  const visited=new Uint8Array(count),queue=new Uint32Array(count);let read=0,write=1;queue[0]=seed;visited[seed]=1;
  const center=options.center||worldPoint(centers,seed,matrix),threshold=(options.tolerance||0)**2*3+1e-12;
  const cos=Math.cos((options.angle||0)*Math.PI/180),radiusSq=options.radius**2,depthLimit=Math.max(options.radius*.30,.35);
  const accepts=(f,from)=>{
    if(kind!=='brush'){
      let d=0;for(let k=0;k<3;k++)d+=(colors[3*f+k]-options.seedColor[k])**2;
      if(d>threshold)return false;
      if(kind==='wand')return true;
    }
    const point=worldPoint(centers,f,matrix),normal=worldNormal(normals,f,normalMatrix),delta=point.map((v,i)=>v-center[i]);
    if(kind==='brush'){
      const depth=dot(delta,options.cameraDirection);
      return dot(normal,options.cameraDirection)>.02&&Math.abs(depth)<=depthLimit&&dot(delta,delta)-depth*depth<=radiusSq;
    }
    return dot(delta,delta)<=options.reach**2&&dot(normal,worldNormal(normals,from,normalMatrix))>=cos;
  };
  while(read<write){
    const from=queue[read++];
    for(let k=0;k<3;k++){
      const f=neighbors[3*from+k];if(f<0||visited[f])continue;
      // En magnético otra arista puede satisfacer el ángulo de entrada.
      if(kind!=='magnetic')visited[f]=1;
      if(accepts(f,from)){visited[f]=1;queue[write++]=f;}
    }
  }
  return queue.slice(0,write);
}
function magneticSelection(topology,options,colors){
  const {count,neighbors,centers,normals}=topology,{seed,matrix,normalMatrix,reach,angle,seedColor,tolerance}=options;
  const distance=new Float64Array(count).fill(Infinity),heap=new Uint32Array(count),slot=new Int32Array(count).fill(-1),chosen=new Uint32Array(count),done=new Uint8Array(count);
  let length=0,used=0;const threshold=tolerance*tolerance*3+1e-12,cos=Math.cos(angle*Math.PI/180);
  const swap=(a,b)=>{const f=heap[a];heap[a]=heap[b];heap[b]=f;slot[heap[a]]=a;slot[heap[b]]=b;};
  const up=i=>{while(i>0){const parent=(i-1)>>1;if(distance[heap[parent]]<=distance[heap[i]])break;swap(i,parent);i=parent;}};
  const push=f=>{if(slot[f]<0){slot[f]=length;heap[length++]=f;}up(slot[f]);};
  distance[seed]=0;push(seed);
  while(length){
    const f=heap[0];slot[f]=-1;length--;if(length){heap[0]=heap[length];slot[heap[0]]=0;let i=0;while(2*i+1<length){let j=2*i+1;if(j+1<length&&distance[heap[j+1]]<distance[heap[j]])j++;if(distance[heap[i]]<=distance[heap[j]])break;swap(i,j);i=j;}}
    done[f]=1;chosen[used++]=f;const a=worldPoint(centers,f,matrix),normal=worldNormal(normals,f,normalMatrix);
    for(let k=0;k<3;k++){
      const to=neighbors[3*f+k];if(to<0||done[to])continue;
      let colorDistance=0;for(let c=0;c<3;c++)colorDistance+=(colors[3*to+c]-seedColor[c])**2;
      if(colorDistance>threshold||dot(normal,worldNormal(normals,to,normalMatrix))<cos)continue;
      const b=worldPoint(centers,to,matrix),candidate=distance[f]+Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
      if(candidate<=reach&&candidate<distance[to]){distance[to]=candidate;push(to);}
    }
  }
  return chosen.slice(0,used);
}
