// Ajuste original de una selección orgánica por corte mínimo sobre la malla dual.
// La operación NO corta el sólido; modifica exclusivamente la selección de caras.
// Inspiración conceptual: segmentación interactiva por semillas y aristas geométricas.
export function refineOrganicBoundary(geometry, selectedFaces, {maxFaces=1800, dataPenalty=0.65, smoothness=2.8, creaseAngleDeg=24, fixedFaces=null}={}) {
  const position=geometry?.getAttribute?.('position'), idx=geometry?.index;
  if(!position||position.itemSize!==3)throw Error('La malla necesita coordenadas 3D.');
  const count=(idx?idx.count:position.count)/3;
  if(!Number.isInteger(count)||count<4||count>maxFaces)throw Error(`Ajuste limitado a mallas de 4 a ${maxFaces} triángulos. Divide el modelo o utiliza el pincel.`);
  if(!(selectedFaces instanceof Set)||selectedFaces.size<2||selectedFaces.size>=count-1)throw Error('Selecciona una región con interior y exterior suficientes.');
  if(!Number.isFinite(dataPenalty)||dataPenalty<=0||!Number.isFinite(smoothness)||smoothness<=0||!Number.isFinite(creaseAngleDeg)||creaseAngleDeg<=0)throw Error('Parámetros inválidos.');
  for(const f of selectedFaces)if(!Number.isInteger(f)||f<0||f>=count)throw Error('Selección con triángulos inválidos.');
  if(fixedFaces!==null && (!(fixedFaces instanceof Set)||[...fixedFaces].some(f=>!Number.isInteger(f)||f<0||f>=count)))throw Error('Protección del borde inválida.');
  const box=geometry.boundingBox;let extent=0;
  for(let i=0;i<position.count;i++)for(let a=0;a<3;a++)extent=Math.max(extent,Math.abs([position.getX(i),position.getY(i),position.getZ(i)][a]));
  const eps=Math.max(extent*1e-7,1e-7);
  const key=(x,y,z)=>`${Math.round(x/eps)},${Math.round(y/eps)},${Math.round(z/eps)}`;
  const edges=new Map(),normals=new Array(count),neighbors=Array.from({length:count},()=>[]);
  for(let f=0;f<count;f++){
    const v=[];
    for(let j=0;j<3;j++){
      const k=idx?idx.getX(f*3+j):f*3+j;
      if(k>=position.count)throw Error('Índice de malla inválido.');
      v.push([position.getX(k),position.getY(k),position.getZ(k)]);
      if(!v[j].every(Number.isFinite))throw Error('Coordenada no finita.');
    }
    const a=v[0],b=v[1],c=v[2];
    const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
    const n=[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];const mag=Math.hypot(...n);
    if(mag<=1e-12)throw Error('Triángulo degenerado.');normals[f]=n.map(x=>x/mag);
    const keys=v.map(p=>key(...p));if(new Set(keys).size!==3)throw Error('Triángulo degenerado.');
    for(let j=0;j<3;j++){
      const ka=keys[j],kb=keys[(j+1)%3],edge=ka<kb?ka+'|'+kb:kb+'|'+ka;
      if(!edges.has(edge))edges.set(edge,[]);edges.get(edge).push(f);
    }
  }
  for(const fs of edges.values()){
    if(fs.length>2)throw Error('Arista no manifold: no es posible optimizar con seguridad.');
    if(fs.length===2){const [a,b]=fs;neighbors[a].push(b);neighbors[b].push(a)}
  }
  // Semillas rígidas: triángulos totalmente rodeados por la misma etiqueta.
  // Es importante conservar el núcleo del cabello y de la cabeza.
  const core=new Set();let coreHair=0,coreHead=0;
  for(let i=0;i<count;i++){
    const isHair=selectedFaces.has(i);
    if(fixedFaces?.has(i)){core.add(i);if(isHair)coreHair++;else coreHead++;continue;}
    if(neighbors[i].length===3&&neighbors[i].every(n=>selectedFaces.has(n)===isHair)){
      core.add(i);if(isHair)coreHair++;else coreHead++;
    }
  }
  if(!coreHair||!coreHead)throw Error('No hay interior estable de ambas regiones. Amplía la selección antes de ajustar el contorno.');
  const N=count+2,S=count,T=count+1, graph=Array.from({length:N},()=>[]);
  const add=(u,v,c)=>{const f={to:v,rev:graph[v].length,cap:c},r={to:u,rev:graph[u].length,cap:0};graph[u].push(f);graph[v].push(r)};
  const INF=1e9,rad=creaseAngleDeg*Math.PI/180;
  for(let i=0;i<count;i++){
    const selected=selectedFaces.has(i),hard=core.has(i);
    add(S,i,selected?(hard?INF:dataPenalty):0);
    add(i,T,!selected?(hard?INF:dataPenalty):0);
  }
  let jointCount=0;
  for(let a=0;a<count;a++)for(const b of neighbors[a])if(a<b){
    let dot=normals[a][0]*normals[b][0]+normals[a][1]*normals[b][1]+normals[a][2]*normals[b][2];
    dot=Math.max(-1,Math.min(1,dot));const angle=Math.acos(dot);
    // Bajo coste en el relieve; alto coste en una superficie continua.
    const w=0.04+smoothness*Math.exp(-Math.pow(angle/rad,2));
    add(a,b,w);add(b,a,w);jointCount++;
  }
  if(!jointCount)throw Error('La malla no tiene aristas compartidas.');
  // Dinic con límite de complejidad para evitar bloqueo indefinido en móviles.
  const level=new Int32Array(N),iter=new Int32Array(N);let sweeps=0;
  function bfs(){level.fill(-1);level[S]=0;const q=[S];for(let h=0;h<q.length;h++){const u=q[h];for(const e of graph[u])if(e.cap>1e-8&&level[e.to]<0){level[e.to]=level[u]+1;q.push(e.to)}}return level[T]>=0}
  function dfs(u,flow){if(u===T)return flow;for(;iter[u]<graph[u].length;iter[u]++){const e=graph[u][iter[u]];if(e.cap<=1e-8||level[e.to]!==level[u]+1)continue;const d=dfs(e.to,Math.min(flow,e.cap));if(d>1e-8){e.cap-=d;graph[e.to][e.rev].cap+=d;return d}}return 0}
  // Profundidad de recursión máxima explícita: evitamos exceder la pila de Safari.
  // El editor limita este cálculo a modelos modestos; los muy densos usan selección manual.
  while(bfs()){
    if(++sweeps>count*2)throw Error('Límite de cálculo alcanzado; se conserva la selección.');
    iter.fill(0);let f;while((f=dfs(S,INF))>1e-8){}
  }
  const seen=new Uint8Array(N),queue=[S];seen[S]=1;
  for(let h=0;h<queue.length;h++)for(const e of graph[queue[h]])if(e.cap>1e-8&&!seen[e.to]){seen[e.to]=1;queue.push(e.to)}
  const result=new Set();for(let i=0;i<count;i++)if(seen[i])result.add(i);
  if(!result.size||result.size===count)throw Error('El resultado no conserva ambas regiones.');
  for(const i of core)if(result.has(i)!==selectedFaces.has(i))throw Error('El ajuste alteraría una región protegida.');
  // Nunca aceptar fragmentos independientes: el corte posterior exige una
  // costura simple; ambas regiones tienen que seguir conectadas por aristas.
  for(const label of [true,false]){
    const first=Array.from({length:count},(_,i)=>i).find(i=>result.has(i)===label);
    const visited=new Set([first]),q=[first];
    for(let h=0;h<q.length;h++)for(const next of neighbors[q[h]]){
      if(result.has(next)===label&&!visited.has(next)){visited.add(next);q.push(next)}
    }
    if(visited.size!==(label?result.size:count-result.size))throw Error('El ajuste crearía regiones desconectadas. Se conserva la selección anterior.');
  }
  return {faces:result,changed:[...result].filter(i=>!selectedFaces.has(i)).length+[...selectedFaces].filter(i=>!result.has(i)).length,coreHair,coreHead};
}
