// Agrupa triángulos seleccionados conectados por aristas geométricas.
// No modifica la geometría. Un borde compartido exige dos vértices en común.
export function selectedSurfaceIslands(geometry, selectedFaces, {maxFaces=250000}={}) {
  const pos=geometry?.getAttribute?.('position'),idx=geometry?.index;
  if(!pos||pos.itemSize!==3)throw Error('Geometría sin posiciones 3D.');
  const total=Math.floor((idx?idx.count:pos.count)/3);
  if(total<1||total>maxFaces)throw Error('La malla supera el límite de análisis.');
  const faceList=Array.from(selectedFaces);
  const selected=new Set(faceList);
  if(selected.size!==faceList.length)throw Error('Selección con índices repetidos.');
  if(selected.size===0)return [];
  if(selected.size>total)throw Error('Selección inválida.');
  const box={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
  for(let i=0;i<pos.count;i++)for(let j=0;j<3;j++){
    const v=j===0?pos.getX(i):j===1?pos.getY(i):pos.getZ(i);
    if(!Number.isFinite(v))throw Error('Coordenadas no finitas.');
    box.min[j]=Math.min(box.min[j],v);box.max[j]=Math.max(box.max[j],v);
  }
  const extent=Math.hypot(...box.max.map((v,i)=>v-box.min[i]));
  const eps=Math.max(extent*1e-7,1e-7);
  const keyVertex=i=>[pos.getX(i),pos.getY(i),pos.getZ(i)].map(v=>Math.round(v/eps)).join(',');
  const vertexKeys=new Map(),getKey=i=>{if(i<0||i>=pos.count||!Number.isInteger(i))throw Error('Índice de vértice inválido.');if(!vertexKeys.has(i))vertexKeys.set(i,keyVertex(i));return vertexKeys.get(i)};
  const edgeOwner=new Map(),neighbors=new Map();
  for(const face of selected){
    if(!Number.isInteger(face)||face<0||face>=total)throw Error('Índice de cara inválido.');
    const ids=[0,1,2].map(j=>getKey(idx?idx.getX(face*3+j):face*3+j));
    if(new Set(ids).size!==3)throw Error('Selección con triángulos degenerados.');
    neighbors.set(face,new Set());
    for(let j=0;j<3;j++){
      const a=ids[j],b=ids[(j+1)%3];const edge=a<b?a+'|'+b:b+'|'+a;
      const owners=edgeOwner.get(edge)||[];
      owners.push(face);
      if(owners.length>2)throw Error('Arista no manifold en la región seleccionada.');
      edgeOwner.set(edge,owners);
    }
  }
  for(const owners of edgeOwner.values())if(owners.length===2){neighbors.get(owners[0]).add(owners[1]);neighbors.get(owners[1]).add(owners[0]);}
  const remaining=new Set(selected),result=[];
  while(remaining.size){let seed=Infinity;for(const f of remaining)if(f<seed)seed=f;remaining.delete(seed);const stack=[seed],island=[];
    while(stack.length){const f=stack.pop();island.push(f);for(const n of neighbors.get(f))if(remaining.delete(n))stack.push(n)}
    result.push(island.sort((a,b)=>a-b));
  }
  return result.sort((a,b)=>b.length-a.length||a[0]-b[0]);
}
