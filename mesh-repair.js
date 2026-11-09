/** Reparación conservadora de hasta 4 agujeros pequeños de una malla triangular.
 * No repara autointersecciones ni promete imprimibilidad.
 */
import {analyzeMeshGeometry} from './mesh-quality.js';

export function prepareSmallHoleRepair(geometry,THREE,{maxEdges=80,maxHoles=4,maxRelativeDiameter=.35,planarityRatio=.005}={}){
  const p=geometry.getAttribute('position'),idx=geometry.index;
  if(!p||p.itemSize!==3)throw Error('La malla no tiene posiciones XYZ válidas.');
  if(geometry.morphAttributes&&Object.values(geometry.morphAttributes).some(a=>a.length))throw Error('Las mallas con morph targets no se reparan automáticamente.');
  if(geometry.getAttribute('skinIndex')||geometry.getAttribute('skinWeight'))throw Error('Las mallas animadas no se reparan automáticamente.');
  if(geometry.groups?.length>1)throw Error('Las mallas con varios grupos de material requieren revisión manual.');
  const before=analyzeMeshGeometry(geometry,{maxTriangles:500000});
  if(before.level==='unknown')throw Error(before.reason);
  if(before.invalid||before.degenerate||before.nonManifold||before.winding)throw Error('Primero hay que resolver vértices inválidos, degenerados, no manifold u orientaciones inconsistentes.');
  if(!before.boundary)throw Error('Esta pieza no presenta bordes abiertos.');
  const bounds=new THREE.Box3().setFromBufferAttribute(p);const extent=bounds.getSize(new THREE.Vector3()).length();
  if(!Number.isFinite(extent)||extent<=0)throw Error('Dimensiones inválidas.');
  const tol=Math.max(extent*1e-7,1e-7),key=v=>`${Math.round(v.x/tol)},${Math.round(v.y/tol)},${Math.round(v.z/tol)}`;
  const coords=new Map(),edgeMap=new Map();const n=(idx?idx.count:p.count)/3;
  if(n>500000)throw Error('Malla demasiado grande para la reparación móvil preliminar.');
  for(let f=0;f<n;f++){
    const v=[];
    for(let j=0;j<3;j++){const point=new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(f*3+j):f*3+j),k=key(point);coords.set(k,point);v.push(k)}
    for(let j=0;j<3;j++){
      const a=v[j],b=v[(j+1)%3],k=a<b?a+'|'+b:b+'|'+a;
      const e=edgeMap.get(k)||{count:0,a,b};e.count++;edgeMap.set(k,e);
    }
  }
  const borders=[...edgeMap.values()].filter(e=>e.count===1);
  if(borders.length<3||borders.length>maxEdges*maxHoles)throw Error(`Demasiadas aristas abiertas para una reparación conservadora (${borders.length}).`);
  // Reconstruir todos los ciclos dirigidos de borde sin unir agujeros distintos.
  const out=new Map(),inside=new Map();
  for(const e of borders){
    if(out.has(e.a)||inside.has(e.b))throw Error('El borde tiene ramificaciones o una orientación inconsistente.');
    out.set(e.a,e.b);inside.set(e.b,e.a);
  }
  const unused=new Set(out.keys()), loops=[];
  while(unused.size){
    const start=unused.values().next().value,ordered=[],visited=new Set();let cur=start;
    while(cur!==undefined && !visited.has(cur)){
      if(!unused.has(cur))throw Error('Los contornos abiertos se interconectan.');
      visited.add(cur);unused.delete(cur);ordered.push(cur);cur=out.get(cur);
    }
    if(cur!==start||ordered.length<3)throw Error('Borde abierto discontinuo o degenerado.');
    if(ordered.length>maxEdges)throw Error(`Uno de los agujeros supera las ${maxEdges} aristas.`);
    loops.push(ordered);
    if(loops.length>maxHoles)throw Error(`Solo se reparan hasta ${maxHoles} agujeros por operación.`);
  }
  const cap=[],allPoints=[],diameters=[];let facesAdded=0;
  for(const ordered of loops){
    const pts=ordered.map(k=>coords.get(k));
    const holeBounds=new THREE.Box3().setFromPoints(pts),holeDiameter=holeBounds.getSize(new THREE.Vector3()).length();
    if(holeDiameter/extent>maxRelativeDiameter)throw Error('Uno de los agujeros es demasiado grande respecto al modelo.');
    const centroid=new THREE.Vector3();pts.forEach(q=>centroid.add(q));centroid.multiplyScalar(1/pts.length);
    const normal=new THREE.Vector3();for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];normal.x+=(a.y-b.y)*(a.z+b.z);normal.y+=(a.z-b.z)*(a.x+b.x);normal.z+=(a.x-b.x)*(a.y+b.y)}
    if(normal.lengthSq()<=tol**4)throw Error('Contorno degenerado.');normal.normalize();
    const maxHeight=Math.max(...pts.map(q=>Math.abs(q.clone().sub(centroid).dot(normal))));
    if(maxHeight>Math.max(tol*3,holeDiameter*planarityRatio))throw Error('Uno de los bordes es demasiado curvo para repararlo con seguridad.');
    const ref=Math.abs(normal.z)<.8?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0);
    const axisU=new THREE.Vector3().crossVectors(ref,normal).normalize(),axisV=new THREE.Vector3().crossVectors(normal,axisU).normalize();
    const shape=pts.map(q=>new THREE.Vector2(q.clone().sub(centroid).dot(axisU),q.clone().sub(centroid).dot(axisV)));
    const triangleIds=THREE.ShapeUtils.triangulateShape(shape,[]);
    if(triangleIds.length!==pts.length-2)throw Error('Uno de los contornos no se pudo triangular.');
    // Mantener la normal de cada tapa; los triángulos deben oponerse a la orientación del borde.
    for(const face of triangleIds){
      const ids=[...face],a=shape[ids[0]],b=shape[ids[1]],c=shape[ids[2]];
      const cross=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
      const orderedIds=cross>0?[ids[0],ids[2],ids[1]]:ids;
      for(const i of orderedIds)cap.push(...pts[i].toArray());
    }
    facesAdded+=triangleIds.length;diameters.push(holeDiameter);allPoints.push(pts);
  }
  const nonIndexed=idx?geometry.toNonIndexed():geometry.clone();
  // Extendemos los atributos existentes sin descartarlos (color, UV, etc.).
  const result=new THREE.BufferGeometry();const originalVertexCount=nonIndexed.getAttribute('position').count;
  for(const [name,attr] of Object.entries(nonIndexed.attributes)){
    if(attr.isInterleavedBufferAttribute)throw Error('Atributos intercalados no admitidos.');
    const width=attr.itemSize,arr=new attr.array.constructor((originalVertexCount+cap.length/3)*width);
    arr.set(attr.array);
    for(let i=0;i<cap.length/3;i++){
      if(name==='position'){arr[originalVertexCount*width+i*width]=cap[i*3];arr[originalVertexCount*width+i*width+1]=cap[i*3+1];arr[originalVertexCount*width+i*width+2]=cap[i*3+2]}
            else { // Propiedades secundarias de tapa: promedio de los primeros vértices de borde.
        for(let j=0;j<width;j++)arr[originalVertexCount*width+i*width+j]=attr.array[j]??0;
      }
    }
    result.setAttribute(name,new THREE.BufferAttribute(arr,width,attr.normalized));
  }
  result.deleteAttribute('normal');result.computeVertexNormals();result.computeBoundingBox();result.computeBoundingSphere();
  const after=analyzeMeshGeometry(result,{maxTriangles:500000});
  if(after.boundary!==0||after.nonManifold||after.winding||after.degenerate||after.invalid)throw Error(`El cierre no superó el diagnóstico: abiertos=${after.boundary}, no manifold=${after.nonManifold}, orientación=${after.winding}.`);
  return {geometry:result,before,after,points:allPoints.flat(),loops:allPoints,diameter:Math.max(...diameters),facesAdded,holeCount:loops.length};
}
