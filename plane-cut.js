import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/+esm';
import { soldar, orientar, componentes, topologia, extraer } from './nucleo-malla.js?v=2.10';
import { analyzeMeshGeometry } from './mesh-quality.js';
import { cortarPorPlano } from './nucleo-plano.js?v=2.10';

// Corte con el núcleo de arreglos tipados (sin objetos por vértice).
// Cada cuerpo se corta por separado (cuerpos que se tocan, como sombrero y tallo, no se mezclan).
// Conserva los materiales por grupos; no conserva UV ni colores de vértice.
function sliceLargeHorizontal(geometry,level){
  const pos=geometry.getAttribute('position'),index=geometry.getIndex(),n=index?index.count/3:pos.count/3,soup=new Float32Array(n*9);
  for(let f=0;f<n;f++)for(let k=0;k<3;k++){const v=index?index.getX(3*f+k):3*f+k;soup[9*f+3*k]=pos.getX(v);soup[9*f+3*k+1]=pos.getY(v);soup[9*f+3*k+2]=pos.getZ(v);}
  const mat=new Int16Array(n);for(const g of geometry.groups)for(let f=g.start/3;f<Math.min(n,(g.start+g.count)/3);f++)mat[f]=g.materialIndex;
  const s=soldar(soup),m=orientar(s.malla).malla,color=Int16Array.from(s.origen,f=>mat[f]);
  const comp=componentes(m,topologia(m)),grupos=Array.from({length:comp.n},()=>[]);
  for(let f=0;f<comp.id.length;f++)grupos[comp.id[f]].push(f);
  const cuerpos=grupos.map(caras=>({malla:extraer(m.pos,m.tri,caras),color:Int16Array.from(caras,f=>color[f])}));
  let span=1;{let mn=Infinity,mx=-Infinity;for(let i=1;i<m.pos.length;i+=3){mn=Math.min(mn,m.pos[i]);mx=Math.max(mx,m.pos[i]);}span=Math.max(mx-mn,1e-9);}
  let ultimo,mejor=null;
  for(const d of [0,2e-4,-2e-4,1e-3,-1e-3,3e-3,-3e-3]){
    let res=null,problemas=0,detalle='',malos=0,bordes=0;
    try{
      const nivel=level+d*span,r={piezas:[],informe:{bucles:0,nivel}};
      const tolB=1e-6*span,cortadas=[];
      for(const c of cuerpos){
        let mn=Infinity,mx=-Infinity;for(let i=1;i<c.malla.pos.length;i+=3){mn=Math.min(mn,c.malla.pos[i]);mx=Math.max(mx,c.malla.pos[i]);}
        // Un cuerpo que solo toca el plano (p. ej. sombrero apoyado en el tallo) pasa entero a su lado, sin cortarlo.
        if(mx<=nivel+tolB||mn>=nivel-tolB){r.piezas.push({malla:c.malla,color:c.color,lado:(mn+mx)/2>=nivel?'encima':'debajo'});continue;}
        // En un cuerpo que sí se corta, una cara justo en el plano haría la sección ambigua.
        const mm=c.malla;for(let f=0;f<mm.tri.length/3;f++){let k=0;for(;k<3;k++)if(Math.abs(mm.pos[3*mm.tri[3*f+k]+1]-nivel)>tolB)break;if(k===3)throw Error('Hay una cara del modelo justo en el plano de corte; muévelo un poco.');}
        const q=cortarPorPlano(c.malla,1,nivel,{color:c.color});
        if(Math.abs(q.informe.nivel-nivel)>1e-9*span)throw Object.assign(Error('Nivel desplazado'),{reintentar:true});
        r.piezas.push(...q.piezas);cortadas.push(...q.piezas);r.informe.bucles+=q.informe.bucles;
      }
      // Las caras nuevas de cada cuerpo cortado deben coincidir en las dos mitades.
      const enPlanoM=lado=>{const out=new Map();for(const p of cortadas){if(p.lado!==lado)continue;const P=p.malla.pos,T=p.malla.tri;for(let f=0;f<T.length/3;f++){const v=[0,1,2].map(k=>T[3*f+k]);if(v.some(i=>Math.abs(P[3*i+1]-nivel)>1e-6*span))continue;{const a=v[0]*3,b=v[1]*3,c=v[2]*3,ux=P[b]-P[a],uy=P[b+1]-P[a+1],uz=P[b+2]-P[a+2],wx=P[c]-P[a],wy=P[c+1]-P[a+1],wz=P[c+2]-P[a+2],nx=uy*wz-uz*wy,ny=uz*wx-ux*wz,nz=ux*wy-uy*wx,l=Math.hypot(nx,ny,nz);if(!(l>0)||Math.abs(ny)/l<0.999)continue;}const k=v.map(i=>`${P[3*i]},${P[3*i+1]},${P[3*i+2]}`).sort().join('|');out.set(k,(out.get(k)||0)+1);}}return out;};
      const A=enPlanoM('encima'),B=enPlanoM('debajo');
      let distintas=0;for(const [k,v] of A)if(B.get(k)!==v)distintas++;for(const [k,v] of B)if(!A.has(k))distintas++;
      res=construir(r,geometry,nivel);
      if(distintas){problemas+=distintas;detalle+=`${distintas} triángulo(s) de la cara de unión no coinciden entre las dos mitades; `;}
      // Cada trozo cortado debe quedar cerrado y sin triángulos degenerados. Se comprueba por cuerpo:
      // dos cuerpos que se tocan (sombrero y tallo, pelo y cabeza) ya compartían aristas en el modelo original.
      for(const pz of cortadas){const P=pz.malla.pos,T=pz.malla.tri,attr={array:P,itemSize:3,count:P.length/3,getX:i=>P[3*i],getY:i=>P[3*i+1],getZ:i=>P[3*i+2]};
        const q=analyzeMeshGeometry({getAttribute:()=>attr,index:{count:T.length,getX:i=>T[i]}},{tolerance:1e-6});
        if(!q.ok){problemas+=q.boundary+q.nonManifold+q.winding+q.degenerate;malos++;bordes+=q.boundary+q.nonManifold;}}
      if(malos)detalle+=`${malos} trozo(s) con ${bordes} borde(s) abiertos y triángulos muy finos; `;
      if(!problemas)return res;
    }catch(e){ultimo=e;}
    // Modelos con cáscaras superpuestas (pelo, accesorios): se guarda el mejor intento y se avisa.
    if(res&&(!mejor||problemas<mejor.problemas))mejor={res,problemas,detalle};
  }
  if(mejor){mejor.res.warning=`El corte se hizo, pero el modelo tiene partes que se cruzan entre sí: ${mejor.detalle.replace(/; $/,'')}. Suele imprimirse bien; revísalo en el laminador.`;return mejor.res;}
  throw ultimo;
}
function construir(r,geometry,cutLevel){
  const make=side=>{
    const piezas=r.piezas.filter(p=>p.lado===side);let total=0;for(const p of piezas)total+=p.malla.tri.length/3;
    if(!total)throw Error('Una de las mitades está vacía.');
    const caras=[];for(const p of piezas)for(let f=0;f<p.malla.tri.length/3;f++)caras.push([p,f,p.color?Math.max(0,p.color[f]):0]);
    caras.sort((a,b)=>a[2]-b[2]);
    const out=new Float32Array(total*9),g=new THREE.BufferGeometry();let start=0;
    caras.forEach(([p,f],i)=>{for(let k=0;k<3;k++){const v=p.malla.tri[3*f+k];out[9*i+3*k]=p.malla.pos[3*v];out[9*i+3*k+1]=p.malla.pos[3*v+1];out[9*i+3*k+2]=p.malla.pos[3*v+2];}});
    for(let i=1;i<=caras.length;i++)if(i===caras.length||caras[i][2]!==caras[start][2]){g.addGroup(3*start,3*(i-start),caras[start][2]);start=i;}
    g.setAttribute('position',new THREE.Float32BufferAttribute(out,3));return g;
  };
  const upper=make('encima'),lower=make('debajo');
  // Centro de encastre: punto de la sección más alejado de su contorno (círculo inscrito aproximado).
  const P=upper.getAttribute('position').array,box=geometry.boundingBox,eps=Math.max(box.max.y-box.min.y,1)*1e-5,cut=cutLevel;
  const enCara=A=>{const t=[];for(let i=0;i<A.length;i+=9)if(Math.abs(A[i+1]-cut)<=eps&&Math.abs(A[i+4]-cut)<=eps&&Math.abs(A[i+7]-cut)<=eps)t.push(i);return t;};
  const Q=lower.getAttribute('position').array,tapaQ=enCara(Q);
  const tapa=enCara(P);
  const clave=(i)=>`${P[i]},${P[i+2]}`,aristas=new Map();
  for(const i of tapa)for(const [u,v] of [[i,i+3],[i+3,i+6],[i+6,i]]){const ku=clave(u),kv=clave(v),k=ku<kv?ku+'|'+kv:kv+'|'+ku;const e=aristas.get(k);if(e)e.n++;else aristas.set(k,{n:1,ax:P[u],az:P[u+2],bx:P[v],bz:P[v+2]});}
  const borde=[...aristas.values()].filter(e=>e.n===1);
  {const ar2=new Map(),cl=(i)=>`${Q[i]},${Q[i+2]}`;for(const i of tapaQ)for(const [u,v] of [[i,i+3],[i+3,i+6],[i+6,i]]){const ku=cl(u),kv=cl(v),k=ku<kv?ku+'|'+kv:kv+'|'+ku;const e=ar2.get(k);if(e)e.n++;else ar2.set(k,{n:1,ax:Q[u],az:Q[u+2],bx:Q[v],bz:Q[v+2]});}for(const e of ar2.values())if(e.n===1)borde.push(e);}
  const distBorde=(x,z)=>{let d=Infinity;for(const e of borde){const ex=e.bx-e.ax,ez=e.bz-e.az,l=ex*ex+ez*ez,t=l?Math.max(0,Math.min(1,((x-e.ax)*ex+(z-e.az)*ez)/l)):0,dx=e.ax+t*ex-x,dz=e.az+t*ez-z,q=dx*dx+dz*dz;if(q<d)d=q;}return Math.sqrt(d);};
  const area=i=>Math.abs((P[i+3]-P[i])*(P[i+8]-P[i+2])-(P[i+6]-P[i])*(P[i+5]-P[i+2]))/2;
  let candidatos=tapaQ.length&&tapaQ.length<tapa.length?tapaQ.map(i=>i):tapa;const PP=candidatos===tapa?P:Q;const areaQ=i=>Math.abs((PP[i+3]-PP[i])*(PP[i+8]-PP[i+2])-(PP[i+6]-PP[i])*(PP[i+5]-PP[i+2]))/2;if(candidatos.length>2500)candidatos=[...candidatos].sort((x,y)=>areaQ(y)-areaQ(x)).slice(0,2500);
  let connectorCentre=null,connectorRadius=0;
  for(const i of candidatos){const x=(PP[i]+PP[i+3]+PP[i+6])/3,z=(PP[i+2]+PP[i+5]+PP[i+8])/3,d=distBorde(x,z);if(d>connectorRadius){connectorRadius=d;connectorCentre=new THREE.Vector3(x,cut,z);}}
  // Afinado: busca alrededor del mejor punto con pasos decrecientes.
  if(connectorCentre){let paso=connectorRadius/2;while(paso>connectorRadius*1e-3){let mejor=false;for(const [dx,dz] of [[paso,0],[-paso,0],[0,paso],[0,-paso]]){const x=connectorCentre.x+dx,z=connectorCentre.z+dz,d=distBorde(x,z);if(d>connectorRadius&&dentro(x,z)){connectorRadius=d;connectorCentre.set(x,cut,z);mejor=true;}}if(!mejor)paso/=2;}}
  function dentro(x,z){return dentroDe(P,tapa,x,z)&&(!tapaQ.length||dentroDe(Q,tapaQ,x,z));}
  function dentroDe(P,tapa,x,z){for(const i of tapa){const ax=P[i],az=P[i+2],bx=P[i+3],bz=P[i+5],cx=P[i+6],cz=P[i+8];const d1=(x-bx)*(az-bz)-(ax-bx)*(z-bz),d2=(x-cx)*(bz-cz)-(bx-cx)*(z-cz),d3=(x-ax)*(cz-az)-(cx-ax)*(z-az);if(!((d1<0||d2<0||d3<0)&&(d1>0||d2>0||d3>0)))return true;}return false;}
  if(!connectorCentre)throw Error('No se encontró la sección del corte.');
  return {planeLevel:cut,upper,lower,contours:r.informe.bucles,triangles:[upper.getAttribute('position').count/3,lower.getAttribute('position').count/3],connectorCentre,connectorRadius,largeMesh:true};
}


// Plane cut of an individual triangular mesh in its LOCAL XY coordinates.
// Caps are constructed from closed intersection contours; open/non-manifold
// sources are rejected where a closed contour cannot be reconstructed.
export function sliceMeshHorizontal(geometry,level,{capMaterialIndex=null}={}){
  const pos=geometry?.getAttribute('position');
  if(!pos ||pos.count<3)throw Error('La malla no contiene triángulos.');
  const index=geometry.getIndex(), triangles=index?index.count/3:pos.count/3;
  // Sin texturas ni colores de vértice (o malla grande): núcleo exacto, admite varios cuerpos y huecos.
  const hasSurfaceData=['uv','uv1','uv2','color'].some(name=>geometry.getAttribute(name));
  if(triangles>250000||!hasSurfaceData)return sliceLargeHorizontal(geometry,level);
  try{return sliceTexturedHorizontal(geometry,level,{capMaterialIndex})}
  catch(e){
    // Si el cortador que conserva texturas no puede cerrar la sección, se usa el núcleo (sin texturas).
    try{const r=sliceLargeHorizontal(geometry,level);r.lostTextures=true;return r}catch(_){throw e}
  }
}
function sliceTexturedHorizontal(geometry,level,{capMaterialIndex=null}={}){
  const pos=geometry.getAttribute('position'),index=geometry.getIndex(),triangles=index?index.count/3:pos.count/3;
  const box=geometry.boundingBox||geometry.computeBoundingBox()||geometry.boundingBox;
  const span=Math.max(...box.getSize(new THREE.Vector3()).toArray(),1);
  const eps=span*1e-6;
  if(level<=box.min.y+eps||level>=box.max.y-eps)throw Error('El plano debe cruzar el interior de la malla.');
  const tops=[],bottoms=[],segments=[];
  const names=['uv','uv1','uv2','color'].filter(name=>geometry.getAttribute(name));
  const data=new Map([[tops,{attributes:{},materials:[]}],[bottoms,{attributes:{},materials:[]}]]);
  for(const out of data.values())for(const name of names)out.attributes[name]=[];
  const capIndex=capMaterialIndex??Math.max(0,...geometry.groups.map(g=>g.materialIndex))+1;
  let materialIndex=0,isCap=false;
  const interpolate=(a,b,t)=>{const p=a.clone().lerp(b,t);p.cutAttrs={};for(const name of names)p.cutAttrs[name]=a.cutAttrs[name].map((x,i)=>x+(b.cutAttrs[name][i]-x)*t);return p};
  const vertex=i=>{const p=new THREE.Vector3(pos.getX(i),pos.getY(i),pos.getZ(i));p.cutAttrs={};for(const name of names){const attr=geometry.getAttribute(name);p.cutAttrs[name]=Array.from({length:attr.itemSize},(_,c)=>attr.getComponent(i,c));}return p};
  const pushTri=(out,a,b,c)=>{out.push(...a.toArray(),...b.toArray(),...c.toArray());const record=data.get(out);record.materials.push(isCap?capIndex:materialIndex);for(const p of [a,b,c])for(const name of names){const size=geometry.getAttribute(name).itemSize;const value=isCap?Array.from({length:size},(_,i)=>name==='color'?1:i===0?(p.x-box.min.x)/span:i===1?(p.z-box.min.z)/span:0):p.cutAttrs[name];record.attributes[name].push(...value);}};
  const clip=(polygon,upper)=>{
    let output=[];
    for(let i=0;i<polygon.length;i++){
      const a=polygon[i],b=polygon[(i+1)%polygon.length];
      const da=a.y-level,db=b.y-level;
      const insideA=upper?da>=0:da<=0,insideB=upper?db>=0:db<=0;
      if(insideA)output.push(a);
      if(da*db<0){const t=da/(da-db);const p=interpolate(a,b,t);p.y=level;output.push(p)}
    }
    if(output.length>2)for(let i=1;i<output.length-1;i++)pushTri(upper?tops:bottoms,output[0],output[i],output[i+1]);
  };
  for(let j=0;j<triangles;j++){
    materialIndex=geometry.groups.find(g=>3*j>=g.start&&3*j<g.start+g.count)?.materialIndex??0;
    // Snap the tolerance band once, before both contour extraction and clipping.
    // This keeps every cap seam on the same plane as the side triangles.
    const v=[0,1,2].map(k=>{const p=vertex(index?index.getX(j*3+k):j*3+k);if(Math.abs(p.y-level)<=eps)p.y=level;return p});
    const above=v.some(p=>p.y>level),below=v.some(p=>p.y<level);
    const onPlane=v.filter(p=>p.y===level).length;
    if(onPlane===3)throw Error('Una cara coincide con el plano; desplaza ligeramente el corte.');
    if((above&&below)||onPlane===2){
      const crossings=[];
      for(let i=0;i<3;i++){
        const a=v[i],b=v[(i+1)%3],da=a.y-level,db=b.y-level;
        if(da===0)crossings.push(a);
        if(da*db<0){
          const p=a.clone().lerp(b,da/(da-db));p.y=level;crossings.push(p);
        }
      }
      if(crossings.length===2 && crossings[0].distanceToSquared(crossings[1])>eps*eps)segments.push(crossings);
    }
    clip(v,true);clip(v,false);
  }
  if(!segments.length)throw Error('No se pudo obtener una intersección cerrada con este plano.');
  const pointKey=p=>`${Math.round(p.x/eps)},${Math.round(p.z/eps)}`;
  const nodes=new Map();
  const add=(p,q)=>{const key=pointKey(p);if(!nodes.has(key))nodes.set(key,{p,neighbors:new Set()});nodes.get(key).neighbors.add(pointKey(q))};
  for(const [a,b] of segments){add(a,b);add(b,a)}
  // All intersection contours must form closed, non-branching rings.
  if([...nodes.values()].some(n=>n.neighbors.size!==2))throw Error('El corte atraviesa bordes abiertos o geometría no manifold; no se pueden cerrar ambas piezas con seguridad.');
  const visited=new Set(),loops=[];
  for(const start of nodes.keys()){
    if(visited.has(start))continue;
    const keys=[],seen=new Set();let curr=start,prev=null;
    while(!seen.has(curr)){
      if(!nodes.has(curr))throw Error('Contorno incompleto.');
      seen.add(curr);visited.add(curr);keys.push(curr);
      const next=[...nodes.get(curr).neighbors].find(k=>k!==prev);
      prev=curr;curr=next;
      if(keys.length>nodes.size+1)throw Error('Contorno inválido.');
    }
    if(curr!==start ||keys.length<3)throw Error('Contorno de corte abierto o ambiguo.');
    loops.push(keys.map(k=>nodes.get(k).p));
  }
  // Project to XZ; use Three.js ShapeUtils for polygon triangulation.
  // Multi-ring holes/nesting are deliberately rejected rather than incorrectly capped.
  const paths=loops.map(loop=>loop.map(p=>new THREE.Vector2(p.x,p.z)));
  for(let i=0;i<paths.length;i++)for(let j=i+1;j<paths.length;j++){
    // Nested contours imply holes, for which a separate robust tessellation path is required.
    if(THREE.ShapeUtils.isClockWise(paths[i])===THREE.ShapeUtils.isClockWise(paths[j]))continue;
    // Keep simple single contours supported. Complex nested ring validation is conservative.
  }
  if(loops.length>1)throw Error('Se detectaron varios contornos (posibles huecos). Este tipo de corte necesita el algoritmo avanzado de triangulación.');
  const polygon=loops[0],shape=paths[0],faces=THREE.ShapeUtils.triangulateShape(shape,[]);
  if(!faces.length)throw Error('No se pudo cerrar la sección cortada.');
  // Preferred connector centre: centroid of the largest cap triangle.
  // The inradius limits a cylindrical pin to the inside of this triangle.
  let connectorCentre=null,connectorRadius=0;
  for(const [i,j,k] of faces){
    const a=polygon[i],b=polygon[j],c=polygon[k];
    const area=b.clone().sub(a).cross(c.clone().sub(a)).length()*.5;
    const perimeter=a.distanceTo(b)+b.distanceTo(c)+c.distanceTo(a);
    const radius=perimeter>0?2*area/perimeter:0;
    if(radius>connectorRadius){connectorRadius=radius;connectorCentre=a.clone().add(b).add(c).multiplyScalar(1/3)}
  }
  isCap=true;
  for(const [i,j,k] of faces){
    const a=polygon[i],b=polygon[j],c=polygon[k];
    const ny=new THREE.Vector3().crossVectors(b.clone().sub(a),c.clone().sub(a)).y;
    // Upper half outward normal on cap is -Y, lower is +Y.
    if(ny>0){pushTri(bottoms,a,b,c);pushTri(tops,c,b,a)}
    else{pushTri(bottoms,c,b,a);pushTri(tops,a,b,c)}
  }
  const make=arr=>{if(arr.length<9)throw Error('Una de las mitades está vacía.');const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));const record=data.get(arr);for(const name of names)g.setAttribute(name,new THREE.Float32BufferAttribute(record.attributes[name],geometry.getAttribute(name).itemSize));for(let i=0;i<record.materials.length;){let end=i+1;while(end<record.materials.length&&record.materials[end]===record.materials[i])end++;g.addGroup(i*3,(end-i)*3,record.materials[i]);i=end;}g.userData.cutCapMaterialIndex=capIndex;g.computeVertexNormals();g.computeBoundingBox();return g};
  return {upper:make(tops),lower:make(bottoms),contours:loops.length,triangles:[tops.length/9,bottoms.length/9],connectorCentre,connectorRadius};
}


// Cut an arbitrarily oriented plane expressed in WORLD coordinates. Move a copy
// of the mesh geometry into world space, rotate the plane normal to +Y,
// reuse the conservative closed-contour cutter, then return LOCAL geometries.
// Fraction is measured between extremal vertex projections on the plane normal.
export function sliceMeshByWorldPlane(mesh, normal, fraction){
  if(!Number.isFinite(fraction)||fraction<=0||fraction>=1)throw Error('El porcentaje debe estar entre 1 y 99.');
  mesh.updateWorldMatrix(true,false);
  const n=normal.clone().normalize();
  if(n.lengthSq()<.9)throw Error('Normal de corte no válida.');
  const rotation=new THREE.Quaternion().setFromUnitVectors(n,new THREE.Vector3(0,1,0));
  const forward=new THREE.Matrix4().makeRotationFromQuaternion(rotation).multiply(mesh.matrixWorld);
  const reverse=forward.clone().invert();
  const rotated=mesh.geometry.clone();
  rotated.applyMatrix4(forward);
  rotated.computeBoundingBox();
  const bounds=rotated.boundingBox;
  const level=THREE.MathUtils.lerp(bounds.min.y,bounds.max.y,fraction);
  try{
    const result=sliceMeshHorizontal(rotated,level,{capMaterialIndex:Array.isArray(mesh.material)?mesh.material.length:1});
    result.upper.applyMatrix4(reverse);
    result.lower.applyMatrix4(reverse);
    result.upper.computeVertexNormals();
    result.lower.computeVertexNormals();
    result.connectorPoint=result.connectorCentre?.clone().applyQuaternion(rotation.clone().invert())||null;
    result.connectorNormal=n.clone();
    result.planeOffset=result.planeLevel??level;
    return result;
  } finally {rotated.dispose()}
}
