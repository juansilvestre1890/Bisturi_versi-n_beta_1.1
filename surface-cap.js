import {validateCurvedCap} from './curved-cap-validation.js';
import {validateCapCoverage} from './cap-coverage.js';
import {selectStableEar} from './curved-ear-selection.js';
// Detecta puntos que impiden formar una oreja sin crear uniones en T.
// Un punto alineado con un borde de perímetro no bloquea por sí solo la oreja.
export function earBlockedByPoint(p,a,b,c,winding,tol){
  const area=(v1,v2,v3)=>(v2.x-v1.x)*(v3.y-v1.y)-(v2.y-v1.y)*(v3.x-v1.x);
  const s1=winding*area(a,b,p),s2=winding*area(b,c,p),s3=winding*area(c,a,p);
  if(s1>tol&&s2>tol&&s3>tol)return true;
  if(Math.abs(area(a,c,p))<=tol){
    const along=(p.x-a.x)*(p.x-c.x)+(p.y-a.y)*(p.y-c.y);
    if(along<=tol)return true;
  }
  return false;
}
export function segmentsConflict2D(a,b,c,d,eps=1e-7,tol=1e-12){
    const orient=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
    const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b);
    if((o1>tol&&o2< -tol||o1< -tol&&o2>tol)&&
       (o3>tol&&o4< -tol||o3< -tol&&o4>tol))return true;
    const onSegment=(p,q,r)=>Math.abs(orient(p,q,r))<=tol&&
      r.x>=Math.min(p.x,q.x)-eps&&r.x<=Math.max(p.x,q.x)+eps&&
      r.y>=Math.min(p.y,q.y)-eps&&r.y<=Math.max(p.y,q.y)+eps;
    return onSegment(a,b,c)||onSegment(a,b,d)||onSegment(c,d,a)||onSegment(c,d,b);
}
// Una diagonal nueva no puede cortar ni rozar otras aristas del contorno.
// Se omiten solamente las dos aristas incidentes en sus extremos.
export function diagonalCrossesBoundary(projected,remaining,ia,ic,eps=1e-7,tol=1e-12){
  if(!Array.isArray(projected)||!Array.isArray(remaining)||
     !Number.isInteger(ia)||!Number.isInteger(ic)||ia===ic||
     !projected[ia]||!projected[ic])return true;
  if(!remaining.includes(ia)||!remaining.includes(ic))return true;
  for(let i=0;i<remaining.length;i++){
    const b=remaining[i],c=remaining[(i+1)%remaining.length];
    if(b===ia||b===ic||c===ia||c===ic)continue;
    if(segmentsConflict2D(projected[ia],projected[ic],projected[b],projected[c],eps,tol))return true;
  }
  return false;
}
// Triangulación con retroceso acotado: no abandona un contorno solo porque
// la primera secuencia de orejas estables conduzca a un callejón sin salida.
// Cada candidato conserva las pruebas de visibilidad, curvatura y ausencia de T.
export function triangulateOrganicBoundary(projected,points,normal,{winding,tol=1e-12,eps=1e-7,maxStates=1500}={}){
  if(!Array.isArray(projected)||!Array.isArray(points)||projected.length!==points.length||
     projected.length<3||!normal||![1,-1].includes(winding))throw Error('Contorno de triangulación inválido.');
  const area2=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  let visited=0;
  const failedStates=new Set();
  // El coste y la validez geométrica de una oreja dependen de sus tres
  // vértices, que permanecen constantes durante el retroceso. Reutilizar
  // ese cálculo evita cientos de productos vectoriales en contornos densos.
  const earScoreCache=new Map();
  const scoreEar=(ia,ib,ic)=>{
    const key=`${ia},${ib},${ic}`;
    if(earScoreCache.has(key))return earScoreCache.get(key);
    const result=selectStableEar([[ia,ib,ic]],points,normal);
    const score=result?result.score:null;
    earScoreCache.set(key,score);
    return score;
  };
  const recurse=(remaining,triangles)=>{
    // La viabilidad del contorno restante depende de sus vértices y del orden,
    // no de las orejas ya extraídas: evita explorar repetidamente un mismo callejón sin salida.
    const key=remaining.join(',');
    if(failedStates.has(key))return null;
    if(++visited>maxStates)return null;
    if(remaining.length===3){
      const [ia,ib,ic]=remaining;
      if(winding*area2(projected[ia],projected[ib],projected[ic])<=tol)return null;
      return scoreEar(ia,ib,ic)!==null?[...triangles,[ia,ib,ic]]:null;
    }
    const available=[];
    for(let i=0;i<remaining.length;i++){
      const ia=remaining[(i-1+remaining.length)%remaining.length],ib=remaining[i],ic=remaining[(i+1)%remaining.length];
      const a=projected[ia],b=projected[ib],c=projected[ic];
      if(winding*area2(a,b,c)<=tol)continue;
      if(diagonalCrossesBoundary(projected,remaining,ia,ic,eps,tol))continue;
      if(remaining.some(j=>j!==ia&&j!==ib&&j!==ic&&earBlockedByPoint(projected[j],a,b,c,winding,tol)))continue;
      const score=scoreEar(ia,ib,ic);
      if(score!==null)available.push({ear:[ia,ib,ic],score});
    }
    available.sort((a,b)=>a.score-b.score);
    for(const {ear} of available){
      const next=remaining.filter(i=>i!==ear[1]);
      const result=recurse(next,[...triangles,ear]);
      if(result)return result;
      if(visited>=maxStates)break;
    }
    // Solo memorizar estados completamente explorados. Si agotamos el
    // presupuesto, no podemos concluir que este estado sea insoluble.
    if(visited<maxStates)failedStates.add(key);
    return null;
  };
  const result=recurse(projected.map((_,i)=>i),[]);
  if(!result)throw Error(visited>=maxStates?'Búsqueda de tapa demasiado compleja; no se modificó el modelo.':'No se encontró una triangulación curva suficientemente estable.');
  return result;
}
// Cierre conservador de selecciones: un ciclo simple, cóncavo permitido,
// con leve variación fuera del plano. Nunca rellena agujeros ni múltiples ciclos.
export function buildSelectionCaps(geometry, selectedFaces, THREE) {
  const pos=geometry.getAttribute('position'),idx=geometry.index;
  if(!pos)throw Error('Geometría sin posiciones.');
  const nfaces=Math.floor((idx?idx.count:pos.count)/3);
  const bounds=new THREE.Box3().setFromBufferAttribute(pos);
  const extent=bounds.getSize(new THREE.Vector3()).length();
  const eps=Math.max(extent*1e-7,1e-7);
  const quant=v=>`${Math.round(v.x/eps)},${Math.round(v.y/eps)},${Math.round(v.z/eps)}`;
  const coords=new Map(),sides=[new Map(),new Map()];
  for(let f=0;f<nfaces;f++){
    const side=selectedFaces.has(f)?0:1,v=[];
    for(let j=0;j<3;j++){
      const vertex=idx?idx.getX(f*3+j):f*3+j;
      if(vertex>=pos.count)throw Error('Índice de triángulo inválido.');
      const p=new THREE.Vector3().fromBufferAttribute(pos,vertex),key=quant(p);
      if(!coords.has(key))coords.set(key,p);
      v.push(key);
    }
    if(new Set(v).size!==3)throw Error('Hay triángulos degenerados.');
    for(let j=0;j<3;j++){
      const a=v[j],b=v[(j+1)%3],key=a<b?a+'|'+b:b+'|'+a;
      const entry=sides[side].get(key)||{count:0,a,b};entry.count++;
      sides[side].set(key,entry);
    }
  }
  if([...sides[0].values(),...sides[1].values()].some(e=>e.count>2))throw Error('Se detectaron aristas no manifold.');
  const open=[...sides[0]].filter(([,e])=>e.count===1);
  if(open.length<3||open.length>600)throw Error('Admite un único contorno de 3 a 600 aristas.');
  const restOpen=new Set([...sides[1]].filter(([,e])=>e.count===1).map(([k])=>k));
  if(restOpen.size!==open.length||open.some(([k])=>!restOpen.has(k)))throw Error('Los lados no comparten un contorno limpio.');
  const outgoing=new Map(), incoming=new Map();
  for(const [,e] of open){
    if(outgoing.has(e.a)||incoming.has(e.b))throw Error('Contorno ramificado o caras con orientación inconsistente.');
    outgoing.set(e.a,e.b);incoming.set(e.b,e.a);
  }
  const start=open[0][1].a,loop=[start],seen=new Set([start]);let cursor=start;
  for(let i=0;i<open.length;i++){
    cursor=outgoing.get(cursor);
    if(!cursor)throw Error('Contorno discontinuo.');
    if(cursor===start){if(i!==open.length-1)throw Error('Hay varios contornos.');break;}
    if(seen.has(cursor))throw Error('Contorno repetido.');seen.add(cursor);loop.push(cursor);
  }
  if(loop.length!==open.length)throw Error('Contorno con agujeros o múltiples ciclos.');
  const points=loop.map(k=>coords.get(k));
  // Normal de Newell, robusta para polígonos cóncavos.
  const normal=new THREE.Vector3();
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    normal.x+=(a.y-b.y)*(a.z+b.z);
    normal.y+=(a.z-b.z)*(a.x+b.x);
    normal.z+=(a.x-b.x)*(a.y+b.y);
  }
  if(normal.length()<eps*eps)throw Error('Contorno degenerado.');normal.normalize();
  const origin=new THREE.Vector3();for(const p of points)origin.add(p);origin.multiplyScalar(1/points.length);
  const ref=Math.abs(normal.z)<.8?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0);
  const u=new THREE.Vector3().crossVectors(ref,normal).normalize();
  const v=new THREE.Vector3().crossVectors(normal,u).normalize();
  const projected=points.map(p=>{const d=p.clone().sub(origin);return {x:d.dot(u),y:d.dot(v),h:d.dot(normal)}});
  const maxWarp=Math.max(...projected.map(p=>Math.abs(p.h)));
  // Solo curvaturas leves: cierres deformados requieren reconstrucción avanzada.
  // El límite de curvatura se evalúa sobre el contorno, no sobre toda la figura.
  const area2=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const scale=Math.max(extent,1),tol=scale*scale*1e-12;
  // Incluye cruces, contactos en T y tramos colineales solapados.
  // Los bordes no vecinos de una costura simple nunca deben tocarse.
  const segmentConflict=(a,b,c,d)=>segmentsConflict2D(a,b,c,d,eps,tol);
  for(let i=0;i<projected.length;i++){
    const a=projected[i],b=projected[(i+1)%projected.length];
    if(Math.hypot(b.x-a.x,b.y-a.y)<eps)throw Error('Borde demasiado corto.');
    for(let j=i+2;j<projected.length;j++){
      if(i===0&&j===projected.length-1)continue;
      if(segmentConflict(a,b,projected[j],projected[(j+1)%projected.length]))throw Error('El contorno se cruza consigo mismo.');
    }
  }
  let area=0;for(let i=0;i<projected.length;i++){const a=projected[i],b=projected[(i+1)%projected.length];area+=a.x*b.y-a.y*b.x;}
  if(Math.abs(area)<tol)throw Error('Contorno de área insuficiente.');
  const winding=Math.sign(area);
  // Evitar cierre de superficies de espesor cero.
  for(const side of [0,1]){
    let depth=0;
    for(let f=0;f<nfaces;f++)if(selectedFaces.has(f)===(side===0)){
      for(let j=0;j<3;j++){
        const index=idx?idx.getX(f*3+j):f*3+j;
        const p=new THREE.Vector3().fromBufferAttribute(pos,index);
        depth=Math.max(depth,Math.abs(p.sub(origin).dot(normal)));
      }
    }
    if(depth<Math.max(extent*1e-4,1e-5))throw Error('Se produciría una pieza sin espesor.');
  }
  // Explora otras triangulaciones si la primera secuencia de orejas falla.
  // Límite estricto para impedir búsquedas exponenciales en el navegador móvil.
  const triangles=triangulateOrganicBoundary(projected,points,normal,{winding,tol,eps});
  validateCapCoverage(projected,triangles);
  validateCurvedCap(projected,triangles,points,normal,{absoluteEpsilon:Math.max(eps,1e-5)});
  const caps=[[],[]];
  for(const [a,b,c] of triangles){
    const p=points[a],q=points[b],r=points[c];
    if(new THREE.Vector3().subVectors(q,p).cross(new THREE.Vector3().subVectors(r,p)).length()<tol)throw Error('Tapa con triángulo degenerado.');
    // Selección: sentido inverso a los bordes abiertos de la selección.
    caps[0].push(...p.toArray(),...r.toArray(),...q.toArray());
    caps[1].push(...p.toArray(),...q.toArray(),...r.toArray());
  }
  return {caps,kind:maxWarp<=Math.max(extent*1e-4,1e-5)?'plano cóncavo':'ligeramente curvo',warp:maxWarp};
}
export function appendCap(geometry,capPositions,THREE){
  const pos=geometry.getAttribute('position');const existing=pos.count,additional=capPositions.length/3;
  for(const name of Object.keys(geometry.attributes)){
    const attr=geometry.getAttribute(name);
    if(attr.isInterleavedBufferAttribute)throw Error('Atributos intercalados no admitidos.');
    // El cierre debe usar coordenadas flotantes incluso si la malla original
    // tiene un atributo de posición entero (p. ej. una importación cuantizada).
    const ArrayType=name==='position'?Float32Array:attr.array.constructor;
    const arr=new ArrayType((existing+additional)*attr.itemSize);arr.set(attr.array);
    if(name==='position')arr.set(capPositions,attr.array.length);
    else if(name==='color')for(let i=existing;i<existing+additional;i++)for(let j=0;j<attr.itemSize;j++)arr[i*attr.itemSize+j]=1;
    geometry.setAttribute(name,new THREE.BufferAttribute(arr,attr.itemSize,attr.normalized));
  }
  if(geometry.groups.length)geometry.addGroup(existing,additional,geometry.groups[geometry.groups.length-1].materialIndex);
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
