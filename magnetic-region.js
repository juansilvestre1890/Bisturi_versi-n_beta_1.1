/** Selección de región por aristas, ángulo diedro y similitud de color. No corta mallas. */
export function magneticRegion(faces,seed,{maxAngleDeg=35,colorTolerance=0.18,maxDistanceMm=25,maxFaces=150000}={}){
  if(!Array.isArray(faces)||!Number.isInteger(seed)||seed<0||seed>=faces.length)throw Error('Semilla inválida');
  if(faces.length>maxFaces)throw Error('Malla demasiado grande para selección magnética');
  if(!(maxAngleDeg>=0&&maxAngleDeg<=180&&colorTolerance>=0&&colorTolerance<=Math.sqrt(3)&&Number.isFinite(maxDistanceMm)&&maxDistanceMm>0))throw Error('Parámetros inválidos');
  const edges=new Map();
  faces.forEach((f,i)=>{
    if(!Array.isArray(f.vertices)||f.vertices.length!==3||!Array.isArray(f.normal)||f.normal.length!==3)throw Error('Cara inválida');
    for(let j=0;j<3;j++){
      const a=f.vertices[j],b=f.vertices[(j+1)%3];
      const key=[a,b].sort().join('|');if(!edges.has(key))edges.set(key,[]);edges.get(key).push(i);
    }
  });
  const adjacency=Array.from({length:faces.length},()=>new Set());
  for(const sameEdge of edges.values())if(sameEdge.length===2){const [a,b]=sameEdge;adjacency[a].add(b);adjacency[b].add(a)};
  // Distancia geodésica aproximada: propagación sobre caras vecinas, nunca en línea recta a través de la figura.
  // En cada transición se toma la distancia entre centroides; no es un geodésico exacto.
  const minCos=Math.cos(maxAngleDeg*Math.PI/180),seedColor=faces[seed].color||[1,1,1];
  const distances=new Float64Array(faces.length).fill(Infinity);distances[seed]=0;
  const chosen=new Set(),pending=[[0,seed]];
  const metric=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
  while(pending.length){
    pending.sort((a,b)=>b[0]-a[0]);
    const [distance,current]=pending.pop();
    if(distance>distances[current]+1e-8||chosen.has(current))continue;
    chosen.add(current);
    for(const next of adjacency[current]){
      const n=faces[next].normal,c=faces[next].color||[1,1,1],prev=faces[current].normal;
      const cosine=prev[0]*n[0]+prev[1]*n[1]+prev[2]*n[2];
      const colorDelta=metric(c,seedColor);
      if(cosine<minCos-1e-7||colorDelta>colorTolerance+1e-7)continue;
      const ca=faces[current].centroid,cb=faces[next].centroid;
      if(!Array.isArray(ca)||!Array.isArray(cb)||ca.length!==3||cb.length!==3)throw Error('Falta centroide de cara');
      const candidate=distance+metric(ca,cb);
      if(candidate<=maxDistanceMm+1e-7&&candidate+1e-8<distances[next]){
        distances[next]=candidate;pending.push([candidate,next]);
      }
    }
  }
  return [...chosen];
}
