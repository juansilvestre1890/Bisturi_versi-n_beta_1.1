// Expande o contrae una selección por una capa de caras que comparten arista.
// Las coordenadas se cuantizan para admitir STL con vértices duplicados.
export function adjustSurfaceBoundary(geometry, selected, direction, {maxFaces=250000}={}) {
  if(direction!=="grow" && direction!=="shrink") throw Error("Dirección de ajuste inválida.");
  const position=geometry?.getAttribute?.("position"), indices=geometry?.index;
  if(!position || position.itemSize!==3) throw Error("La malla carece de posiciones XYZ.");
  const faces=(indices?indices.count:position.count)/3;
  if(!Number.isInteger(faces)||faces<1||faces>maxFaces)throw Error("Número de triángulos fuera del límite permitido.");
  const marked=new Set(selected);
  for(const f of marked)if(!Number.isInteger(f)||f<0||f>=faces)throw Error("Selección con índices fuera de rango.");
  if(marked.size===0)throw Error("Selecciona una superficie antes de ajustar su borde.");
  let low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<position.count;i++)for(let j=0;j<3;j++){
    const v=position.getX ? (j===0?position.getX(i):j===1?position.getY(i):position.getZ(i)) : position.array[i*3+j];
    if(!Number.isFinite(v))throw Error("La malla contiene coordenadas inválidas.");
    low[j]=Math.min(low[j],v);high[j]=Math.max(high[j],v);
  }
  const extent=Math.hypot(high[0]-low[0],high[1]-low[1],high[2]-low[2]);
  const eps=Math.max(extent*1e-7,1e-7),edges=new Map();
  const vertex=i=>{
    if(!Number.isInteger(i)||i<0||i>=position.count)throw Error("Índice de vértice inválido.");
    return [position.getX(i),position.getY(i),position.getZ(i)].map(x=>Math.round(x/eps)).join(",");
  };
  for(let f=0;f<faces;f++){
    const vertices=[0,1,2].map(j=>vertex(indices?indices.getX(f*3+j):f*3+j));
    if(new Set(vertices).size!==3)throw Error("Hay triángulos degenerados.");
    for(let j=0;j<3;j++){
      const a=vertices[j],b=vertices[(j+1)%3],key=a<b?a+"|"+b:b+"|"+a;
      const arr=edges.get(key)||[];arr.push(f);
      if(arr.length>2)throw Error("La malla contiene una arista no manifold.");
      edges.set(key,arr);
    }
  }
  const changed=new Set(marked);
  for(const neighbors of edges.values()){
    if(neighbors.length!==2)continue;
    const [a,b]=neighbors,sa=marked.has(a),sb=marked.has(b);
    if(sa===sb)continue;
    if(direction==="grow")changed.add(sa?b:a);
    else changed.delete(sa?a:b);
  }
  if(changed.size===0)throw Error("El ajuste eliminaría toda la selección; se conserva el borde anterior.");
  if(changed.size===faces)throw Error("El ajuste cubriría toda la malla; se conserva el borde anterior.");
  return {faces:changed,added:direction==="grow"?changed.size-marked.size:0,removed:direction==="shrink"?marked.size-changed.size:0};
}
